'use client';

/**
 * UnitSkillsPanel — inline reveal for a curriculum unit clicked in the
 * "Your journey" map. Instead of a slide-over drawer, this renders in-flow
 * directly beneath the map and shows the unit's SKILLS (one glass card each,
 * subskills rolled up) in the same visual language as the map itself.
 *
 * Structure comes from getUnitDetail() (curriculum + knowledge-graph statuses);
 * per-skill INSIGHTS — mastery %, average score %, and problems attempted — come
 * from analyticsApi.getStudentMetrics(), fetched lazily per subject and joined
 * on skill_id. Skills the student hasn't touched yet fall back to a plain
 * subskill-count chip.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { subjectVisual } from '@/components/landing/LandingPrimitiveDemos';
import { accentText, accentChipBg, accentSoftBorder } from '@/components/lumina/ui';
import { analyticsApi } from '@/lib/studentAnalyticsAPI';
import type { MasteryStatus, UnitDetail, UnitSubskillDetail } from '../hooks/useStudentCurriculumMap';

const isMastered = (s: MasteryStatus) => s === 'mastered' || s === 'inferred';

// ── Per-skill analytics (from getStudentMetrics) ─────────────────────
interface SkillMetric {
  mastery: number; // 0–1
  avgScore: number; // 0–10
  attempts: number; // raw count
}
// Cache the skill_id→metric map per "studentId:subject" so re-opening units in
// the same subject never refetches. Module-level so it survives panel unmounts.
const metricsCache = new Map<string, Map<string, SkillMetric>>();

/** mastery (0–1) → bar + text tint, matching the app's mastery color language. */
function masteryTier(m: number): { bar: string; text: string } {
  if (m >= 0.8) return { bar: 'bg-emerald-400', text: 'text-emerald-300' };
  if (m >= 0.4) return { bar: 'bg-blue-400', text: 'text-blue-300' };
  if (m > 0) return { bar: 'bg-amber-400', text: 'text-amber-300' };
  return { bar: 'bg-slate-500', text: 'text-slate-400' };
}

// Skill-level rollup status → frame tint (used when there's no attempt data yet
// but the knowledge graph has statuses). Mirrors the unit-frame tints on the map.
type SkillStatus = 'mastered' | 'frontier' | 'in_progress' | 'locked' | 'not_started' | 'unknown';
const SKILL_STATUS: Record<SkillStatus, { frame: string; bar: string; label: string }> = {
  mastered:    { frame: 'border-emerald-500/40 bg-emerald-500/10', bar: 'bg-emerald-400', label: 'Mastered' },
  frontier:    { frame: 'border-amber-500/40 bg-amber-500/10',     bar: 'bg-amber-400',   label: 'Ready to learn' },
  in_progress: { frame: 'border-blue-500/40 bg-blue-500/10',       bar: 'bg-blue-400',    label: 'In progress' },
  not_started: { frame: 'border-white/10 bg-white/[0.03]',         bar: 'bg-slate-500',   label: 'Not started' },
  locked:      { frame: 'border-slate-700/40 bg-slate-800/40',     bar: 'bg-slate-600',   label: 'Locked' },
  unknown:     { frame: 'border-white/10 bg-white/[0.03]',         bar: 'bg-slate-500',   label: '' },
};

/** Roll a skill's subskill statuses up to one status + a mastered/total count. */
function rollupSkill(subskills: UnitSubskillDetail[]): {
  status: SkillStatus;
  done: number;
  total: number;
  hasMastery: boolean;
} {
  const total = subskills.length;
  const done = subskills.filter((s) => isMastered(s.status)).length;
  const hasMastery = subskills.some((s) => s.status !== 'unknown');
  if (!hasMastery) return { status: 'unknown', done, total, hasMastery };
  const statuses = subskills.map((s) => s.status);
  let status: SkillStatus;
  if (total > 0 && statuses.every(isMastered)) status = 'mastered';
  else if (statuses.some((s) => s === 'frontier')) status = 'frontier';
  else if (statuses.some((s) => isMastered(s) || s === 'in_progress' || s === 'in_review')) status = 'in_progress';
  else if (total > 0 && statuses.every((s) => s === 'locked')) status = 'locked';
  else status = 'not_started';
  return { status, done, total, hasMastery };
}

const PANEL_CSS = `
@keyframes luminaSkillsIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes luminaSkillCardIn { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
.lumina-skills-panel { animation: luminaSkillsIn .3s cubic-bezier(0.16, 1, 0.3, 1) both; }
.lumina-skill-card { animation: luminaSkillCardIn .4s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .lumina-skills-panel, .lumina-skill-card { animation: none; }
}
`;

/** One compact "label / value" insight, shown in the card footer. */
const Stat: React.FC<{ label: string; value: string; valueCls?: string }> = ({ label, value, valueCls }) => (
  <div className="flex flex-col gap-0.5">
    <span className={`text-sm font-bold leading-none ${valueCls ?? 'text-slate-100'}`}>{value}</span>
    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
  </div>
);

export interface UnitSkillsPanelProps {
  detail: UnitDetail | null;
  /** The student whose analytics to join in for per-skill insights. */
  studentId: number;
  onClose: () => void;
}

export const UnitSkillsPanel: React.FC<UnitSkillsPanelProps> = ({ detail, studentId, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const subject = detail?.subject;
  const [metrics, setMetrics] = useState<Map<string, SkillMetric> | null>(null);

  // Bring the freshly-opened panel into view (it appears below the map).
  useEffect(() => {
    if (detail) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [detail]);

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [detail, onClose]);

  // Fetch (and cache) this subject's per-skill metrics, joined by skill_id.
  useEffect(() => {
    if (!subject) return;
    const key = `${studentId}:${subject}`;
    const cached = metricsCache.get(key);
    setMetrics(cached ?? null); // show cache instantly; clear stale subject otherwise
    if (cached) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await analyticsApi.getStudentMetrics(studentId, { subject });
        const map = new Map<string, SkillMetric>();
        for (const unit of data.hierarchical_data ?? []) {
          for (const sk of unit.skills ?? []) {
            map.set(sk.skill_id, {
              mastery: sk.mastery ?? 0,
              avgScore: sk.avg_score ?? 0,
              attempts: sk.attempt_count ?? 0,
            });
          }
        }
        metricsCache.set(key, map);
        if (!cancelled) setMetrics(map);
      } catch {
        // Analytics unavailable — cards fall back to the knowledge-graph rollup.
        if (!cancelled) setMetrics(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subject, studentId]);

  const accent = useMemo(() => (subject ? subjectVisual(subject).accent : 'cyan'), [subject]);

  if (!detail) return null;

  return (
    <div
      ref={ref}
      className="lumina-skills-panel mt-4 rounded-2xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-xl"
    >
      <style>{PANEL_CSS}</style>

      {/* Header — subject · unit, with a dismiss control */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            {detail.subject} · skills
          </p>
          <h3 className={`mt-0.5 text-base font-bold leading-tight ${accentText[accent]}`}>
            {detail.title}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close skills"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {detail.skills.length === 0 ? (
        <p className="text-sm text-slate-400">No skills mapped to this unit yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {detail.skills.map((skill, i) => {
            const m = metrics?.get(skill.id);
            const hasMetrics = !!m && m.attempts > 0;
            const { status, done, total, hasMastery } = rollupSkill(skill.subskills);

            // Frame tint: real mastery when attempted, else knowledge-graph rollup.
            const tier = m ? masteryTier(m.mastery) : null;
            const st = SKILL_STATUS[status];
            const masteryPct = m ? Math.round(m.mastery * 100) : 0;
            const scorePct = m ? Math.round(m.avgScore * 10) : 0;
            const rollupPct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <div
                key={skill.id}
                style={{ animationDelay: `${0.05 * i}s` }}
                className={`lumina-skill-card flex flex-col justify-between gap-3 rounded-xl border p-4 ${
                  hasMetrics ? 'border-white/10 bg-white/[0.03]' : st.frame
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="min-w-0 text-sm font-semibold leading-snug text-slate-100">
                    {skill.description}
                  </h4>
                  {hasMetrics && tier && (
                    <span className={`shrink-0 text-sm font-bold ${tier.text}`}>{masteryPct}%</span>
                  )}
                  {!hasMetrics && hasMastery && total > 0 && (
                    <span className="shrink-0 text-[11px] font-medium text-slate-400">
                      {done}/{total}
                    </span>
                  )}
                </div>

                {hasMetrics && tier ? (
                  <>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all ${tier.bar}`}
                        style={{ width: `${masteryPct}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-0.5">
                      <Stat label="Mastery" value={`${masteryPct}%`} valueCls={tier.text} />
                      <Stat label="Avg score" value={`${scorePct}%`} />
                      <Stat label="Problems" value={String(m.attempts)} />
                    </div>
                  </>
                ) : hasMastery ? (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all ${st.bar}`}
                        style={{ width: `${rollupPct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {st.label}
                    </span>
                  </div>
                ) : (
                  <span
                    className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${accentSoftBorder[accent]} ${accentChipBg[accent]} ${accentText[accent]}`}
                  >
                    {total} {total === 1 ? 'skill focus' : 'skill focuses'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UnitSkillsPanel;
