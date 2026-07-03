'use client';

/**
 * UnitSkillsPanel — inline reveal for a curriculum unit clicked in the
 * "Your journey" map. Instead of a slide-over drawer, this renders in-flow
 * directly beneath the map and shows the unit's SKILLS (one glass card each,
 * subskills rolled up) in the same visual language as the map itself.
 *
 * Structure comes from getUnitDetail() (curriculum + knowledge-graph statuses);
 * per-skill INSIGHTS — mastery %, average score %, problems attempted, and
 * lesson evals — come from analyticsApi.getStudentMetrics(), fetched lazily per
 * subject and joined on skill_id. A summary strip totals the unit, and each
 * skill card expands into a per-subskill breakdown: mastery-gate progress
 * (4-gate lifecycle), attempts, average score, and IRT ability (θ) — the same
 * signals the personalization engine uses to pick follow-up lessons.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { subjectVisual } from '@/components/landing/LandingPrimitiveDemos';
import { accentText } from '@/components/lumina/ui';
import { analyticsApi, type SubskillData } from '@/lib/studentAnalyticsAPI';
import { GateProgressDots } from './PlannerDashboard/MasteryComponents';
import { gateStatusBadge } from './AnalyticsDashboard/helpers';
import type { MasteryStatus, UnitDetail, UnitSubskillDetail } from '../hooks/useStudentCurriculumMap';

const isMastered = (s: MasteryStatus) => s === 'mastered' || s === 'inferred';

// ── Per-skill analytics (from getStudentMetrics) ─────────────────────
interface SkillMetric {
  mastery: number; // 0–1
  avgScore: number; // 0–1 (attempt-weighted over ATTEMPTED subskills)
  attempts: number; // raw count
  lessons: number; // summed lesson_eval_count across subskills
  subskills: Map<string, SubskillData>; // subskill_id → full metrics row
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

// Knowledge-graph status → pill, for subskills with no attempt metrics yet.
// Same palette as gateStatusBadge so both sources read as one system.
const KG_PILL: Record<MasteryStatus, { label: string; cls: string }> = {
  mastered:    { label: 'Mastered',       cls: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' },
  inferred:    { label: 'Mastered',       cls: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' },
  in_review:   { label: 'Reviewing',      cls: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400' },
  in_progress: { label: 'In progress',    cls: 'bg-blue-500/20 border-blue-500/30 text-blue-400' },
  frontier:    { label: 'Ready to learn', cls: 'bg-amber-500/20 border-amber-500/30 text-amber-400' },
  not_started: { label: 'Not started',    cls: 'bg-slate-500/20 border-slate-500/30 text-slate-400' },
  locked:      { label: 'Locked',         cls: 'bg-slate-700/20 border-slate-700/30 text-slate-600' },
  unknown:     { label: 'Not started',    cls: 'bg-slate-500/20 border-slate-500/30 text-slate-500' },
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

/**
 * P(correct) → tint, banded by the mastery-gate thresholds it's checked
 * against (G1 ≥ 70%, G4 ≥ 90%): ≥90% mastery-ready, ≥70% learning zone,
 * below 70% a stretch.
 */
function successTier(p: number): string {
  if (p >= 0.9) return 'text-emerald-300';
  if (p >= 0.7) return 'text-blue-300';
  return 'text-amber-300';
}

/** One subskill row in a skill card's expanded breakdown. */
const SubskillRow: React.FC<{ sub: UnitSubskillDetail; metric?: SubskillData }> = ({ sub, metric }) => {
  const gate = metric?.current_gate ?? sub.gate;
  const pill = metric ? gateStatusBadge(metric) : null;
  const pillLabel = pill ? pill.label : KG_PILL[sub.status].label;
  const pillCls = pill ? `${pill.bg} ${pill.text}` : KG_PILL[sub.status].cls;
  const attempts = metric?.attempt_count ?? 0;
  const lessons = metric?.lesson_eval_count ?? 0;

  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-xs leading-snug text-slate-300">{sub.description}</p>
        <span
          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${pillCls}`}
        >
          {pillLabel}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <GateProgressDots gate={gate} />
        {attempts > 0 && (
          <span className="text-[10px] text-slate-400">
            {attempts} {attempts === 1 ? 'problem' : 'problems'}
          </span>
        )}
        {attempts > 0 && metric && (
          <span className="text-[10px] text-slate-400">avg {Math.round(metric.avg_score * 100)}%</span>
        )}
        {lessons > 0 && (
          <span className="text-[10px] text-slate-400">
            {lessons} {lessons === 1 ? 'lesson' : 'lessons'}
          </span>
        )}
        {sub.pCorrect != null && sub.abilityObservations > 0 && (
          // The prediction is only as good as its evidence: the mastery engine
          // itself won't act on θ until σ tightens (gate thresholds 1.5→0.8),
          // so a wide-σ estimate renders as a muted "early estimate", and a
          // no-evidence prior renders nothing at all (guard above).
          sub.sigma != null && sub.sigma <= 1.0 ? (
            <span
              className="inline-flex items-baseline gap-1.5"
              title={`Predicted chance of success at this focus's hardest assigned difficulty, from ${
                sub.abilityObservations
              } completed ${sub.abilityObservations === 1 ? 'task' : 'tasks'} across this skill${
                sub.theta != null ? ` (ability θ ${sub.theta.toFixed(2)}, σ ${sub.sigma.toFixed(2)})` : ''
              }. Mastery needs ≥90%.`}
            >
              <span className={`text-[10px] font-semibold ${successTier(sub.pCorrect)}`}>
                {Math.round(sub.pCorrect * 100)}% predicted success
              </span>
              {/* Ability is estimated per skill, so an untouched focus can carry a
                  confident prediction — say where the evidence came from. */}
              <span className="text-[10px] text-slate-500">
                {attempts > 0
                  ? `· ${sub.abilityObservations} ${sub.abilityObservations === 1 ? 'task' : 'tasks'}`
                  : `· from ${sub.abilityObservations} related ${
                      sub.abilityObservations === 1 ? 'task' : 'tasks'
                    } in this skill`}
              </span>
            </span>
          ) : (
            <span
              className="text-[10px] font-medium text-slate-500"
              title={`Early ability estimate from ${sub.abilityObservations} placement ${
                sub.abilityObservations === 1 ? 'task' : 'tasks'
              } — not yet confirmed by practice${
                sub.sigma != null ? ` (θ ${sub.theta?.toFixed(2)}, σ ${sub.sigma.toFixed(2)} still wide)` : ''
              }.`}
            >
              ~{Math.round(sub.pCorrect * 100)}% early estimate
            </span>
          )
        )}
      </div>
    </li>
  );
};

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
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // Bring the freshly-opened panel into view (it appears below the map), and
  // collapse any expanded breakdowns from the previously-viewed unit.
  useEffect(() => {
    if (detail) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setExpanded(new Set());
    }
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
  // Scoped by subject_id + grade: subjects are published per grade with
  // identical names and colliding unit/skill IDs, so an unscoped fetch joins
  // the student's data against the wrong grade's subskill roster.
  const subjectParam = detail?.subjectId ?? subject;
  const grade = detail?.grade;
  useEffect(() => {
    if (!subjectParam) return;
    const key = `${studentId}:${subjectParam}:${grade ?? ''}`;
    const cached = metricsCache.get(key);
    setMetrics(cached ?? null); // show cache instantly; clear stale subject otherwise
    if (cached) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await analyticsApi.getStudentMetrics(studentId, { subject: subjectParam, grade });
        const map = new Map<string, SkillMetric>();
        for (const unit of data.hierarchical_data ?? []) {
          for (const sk of unit.skills ?? []) {
            const subs = new Map<string, SubskillData>();
            let lessons = 0;
            // The backend's skill-level avg_score averages over EVERY subskill
            // (unattempted ones contribute 0), so a strong start on 2 of 7
            // focuses reads as a failing score. Recompute it attempt-weighted
            // over attempted subskills: "avg score" = average on work done.
            let scoreWeighted = 0;
            let scoredAttempts = 0;
            for (const ss of sk.subskills ?? []) {
              subs.set(ss.subskill_id, ss);
              lessons += ss.lesson_eval_count ?? 0;
              const n = ss.attempt_count ?? 0;
              if (n > 0) {
                scoreWeighted += (ss.avg_score ?? 0) * n;
                scoredAttempts += n;
              }
            }
            map.set(sk.skill_id, {
              mastery: sk.mastery ?? 0,
              avgScore: scoredAttempts > 0 ? scoreWeighted / scoredAttempts : sk.avg_score ?? 0,
              attempts: sk.attempt_count ?? 0,
              lessons,
              subskills: subs,
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
  }, [subjectParam, grade, studentId]);

  const accent = useMemo(() => (subject ? subjectVisual(subject).accent : 'cyan'), [subject]);

  // Unit-level rollup across every skill: activity totals from metrics, mastery
  // counts from the knowledge graph. Attempt-weighted average score.
  const summary = useMemo(() => {
    if (!detail) return null;
    let problems = 0;
    let lessons = 0;
    let scoreWeighted = 0;
    let done = 0;
    let total = 0;
    let ready = 0;
    for (const skill of detail.skills) {
      const m = metrics?.get(skill.id);
      if (m) {
        problems += m.attempts;
        lessons += m.lessons;
        scoreWeighted += m.avgScore * m.attempts;
      }
      for (const ss of skill.subskills) {
        total += 1;
        if (isMastered(ss.status)) done += 1;
        if (ss.status === 'frontier') ready += 1;
      }
    }
    const avgScorePct = problems > 0 ? Math.round((scoreWeighted / problems) * 100) : null;
    const hasMastery = detail.skills.some((sk) => sk.subskills.some((ss) => ss.status !== 'unknown'));
    return { problems, lessons, avgScorePct, done, total, ready, hasMastery };
  }, [detail, metrics]);

  if (!detail) return null;

  const toggleSkill = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const showSummary = !!summary && (summary.problems > 0 || summary.lessons > 0 || summary.hasMastery);

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

      {/* Unit summary strip — totals across every skill in this unit */}
      {showSummary && summary && (
        <div className="mb-4 flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <Stat label="Problems" value={String(summary.problems)} />
          <Stat label="Lessons" value={String(summary.lessons)} />
          <Stat
            label="Avg score"
            value={summary.avgScorePct != null ? `${summary.avgScorePct}%` : '—'}
            valueCls={summary.avgScorePct != null ? masteryTier(summary.avgScorePct / 100).text : undefined}
          />
          {summary.hasMastery && (
            <>
              <Stat label="Mastered" value={`${summary.done}/${summary.total}`} valueCls="text-emerald-300" />
              <Stat label="Ready to learn" value={String(summary.ready)} valueCls="text-amber-300" />
            </>
          )}
        </div>
      )}

      {detail.skills.length === 0 ? (
        <p className="text-sm text-slate-400">No skills mapped to this unit yet.</p>
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2">
          {detail.skills.map((skill, i) => {
            const m = metrics?.get(skill.id);
            const hasMetrics = !!m && m.attempts > 0;
            const { status, done, total, hasMastery } = rollupSkill(skill.subskills);
            const isOpen = expanded.has(skill.id);

            // Frame tint: real mastery when attempted, else knowledge-graph rollup.
            const tier = m ? masteryTier(m.mastery) : null;
            const st = SKILL_STATUS[status];
            const masteryPct = m ? Math.round(m.mastery * 100) : 0;
            const scorePct = m ? Math.round(m.avgScore * 100) : 0;
            const rollupPct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <div
                key={skill.id}
                style={{ animationDelay: `${0.05 * i}s` }}
                className={`lumina-skill-card flex flex-col gap-3 rounded-xl border p-4 ${
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
                    <div className="grid grid-cols-4 gap-2 pt-0.5">
                      <Stat label="Mastery" value={`${masteryPct}%`} valueCls={tier.text} />
                      <Stat label="Avg score" value={`${scorePct}%`} />
                      <Stat label="Problems" value={String(m.attempts)} />
                      <Stat label="Lessons" value={String(m.lessons)} />
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
                ) : null}

                {/* Per-subskill breakdown — gate progress, attempts, score, ability */}
                {skill.subskills.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => toggleSkill(skill.id)}
                      aria-expanded={isOpen}
                      className="flex w-fit items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-300"
                    >
                      <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      {skill.subskills.length} {skill.subskills.length === 1 ? 'skill focus' : 'skill focuses'}
                    </button>
                    {isOpen && (
                      <ul className="flex flex-col gap-1.5">
                        {skill.subskills.map((sub) => (
                          <SubskillRow key={sub.id} sub={sub} metric={m?.subskills.get(sub.id)} />
                        ))}
                      </ul>
                    )}
                  </div>
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
