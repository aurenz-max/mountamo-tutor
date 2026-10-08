'use client';

/**
 * UnitSkillsPanel — inline reveal for a curriculum unit clicked in the
 * "Your journey" map: the unit's SKILLS, one card each, with a per-subskill
 * breakdown.
 *
 * Structure and readiness come from getUnitDetail() (curriculum + knowledge
 * graph: frontier/locked, predicted success). Evidence comes from the progress
 * report service (analyticsApi.getProgressReport, `subskill_stats`): the
 * lifecycle gate, answers with machine bursts excluded, accuracy, and lessons.
 * Mastery is gate 4 only — the same rule as the progress report — so this panel
 * never shows the legacy competency "mastery %" that read 50% beside MASTERED.
 * Queue: my-tutoring-app/qa/parent-report/ROADMAP.md (PR-5).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { subjectVisual } from '@/components/landing/LandingPrimitiveDemos';
import { accentText } from '@/components/lumina/ui';
import { analyticsApi, type ProgressReportSubskillStats } from '@/lib/studentAnalyticsAPI';
import { GateProgressDots } from './PlannerDashboard/MasteryComponents';
import type { MasteryStatus, UnitDetail, UnitSubskillDetail } from '../hooks/useStudentCurriculumMap';

type Stats = Record<string, ProgressReportSubskillStats>;

// One report fetch per "student:grade", shared by every unit opened in that grade.
// Module-level so it survives panel unmounts; the backend caches the report too.
const statsCache = new Map<string, Promise<Stats>>();

function loadStats(studentId: number, grade: string | undefined): Promise<Stats> {
  const key = `${studentId}:${grade ?? ''}`;
  let p = statsCache.get(key);
  if (!p) {
    p = analyticsApi.getProgressReport(studentId, grade ? { grade } : {}).then((r) => r.subskill_stats ?? {});
    p.catch(() => statsCache.delete(key));
    statsCache.set(key, p);
  }
  return p;
}

/** One status per subskill: the lifecycle gate decides; the graph adds ready/locked. */
type RowStatus = 'mastered' | 'learning' | 'tried' | 'ready' | 'locked' | 'not_started';

function rowStatus(sub: UnitSubskillDetail, s?: ProgressReportSubskillStats): RowStatus {
  const gate = s?.gate ?? null;
  if (gate === 4 || sub.status === 'mastered' || sub.status === 'inferred') return 'mastered';
  if (gate != null && gate >= 1) return 'learning';
  if ((s?.answers ?? 0) > 0) return 'tried';
  if (sub.status === 'frontier') return 'ready';
  if (sub.status === 'locked') return 'locked';
  return 'not_started';
}

const PILL: Record<RowStatus, { label: string; cls: string }> = {
  mastered:    { label: 'Mastered',       cls: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' },
  learning:    { label: 'Learning',       cls: 'bg-blue-500/20 border-blue-500/30 text-blue-300' },
  tried:       { label: 'Started',        cls: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300' },
  ready:       { label: 'Ready to learn', cls: 'bg-amber-500/20 border-amber-500/30 text-amber-300' },
  locked:      { label: 'Locked',         cls: 'bg-slate-700/20 border-slate-700/30 text-slate-500' },
  not_started: { label: 'Not started',    cls: 'bg-slate-500/20 border-slate-500/30 text-slate-400' },
};

const PANEL_CSS = `
@keyframes luminaSkillsIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes luminaSkillCardIn { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
.lumina-skills-panel { animation: luminaSkillsIn .3s cubic-bezier(0.16, 1, 0.3, 1) both; }
.lumina-skill-card { animation: luminaSkillCardIn .4s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .lumina-skills-panel, .lumina-skill-card { animation: none; }
}
`;

const Stat: React.FC<{ label: string; value: string; valueCls?: string }> = ({ label, value, valueCls }) => (
  <div className="flex flex-col gap-0.5">
    <span className={`text-sm font-bold leading-none tabular-nums ${valueCls ?? 'text-slate-100'}`}>{value}</span>
    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
  </div>
);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Totals over a set of subskills: answers, attempt-weighted accuracy, lessons, gate counts. */
function rollup(subs: UnitSubskillDetail[], stats: Stats) {
  let answers = 0, right = 0, lessons = 0, mastered = 0, learning = 0, ready = 0;
  for (const sub of subs) {
    const s = stats[sub.id];
    if (s) {
      answers += s.answers;
      right += (s.accuracy ?? 0) * s.answers;
      lessons += s.lessons;
    }
    const st = rowStatus(sub, s);
    if (st === 'mastered') mastered += 1;
    else if (st === 'learning') learning += 1;
    else if (st === 'ready') ready += 1;
  }
  return { answers, accuracy: answers ? Math.round(right / answers) : null, lessons, mastered, learning, ready, total: subs.length };
}

const SubskillRow: React.FC<{ sub: UnitSubskillDetail; stats?: ProgressReportSubskillStats }> = ({ sub, stats }) => {
  const status = rowStatus(sub, stats);
  const pill = PILL[status];
  const gate = stats?.gate ?? sub.gate;
  // A prediction only helps on a skill the child can work on now, and only once
  // the ability estimate has settled (the mastery engine itself waits for σ ≤ 1).
  const showPrediction = (status === 'ready' || status === 'learning' || status === 'tried')
    && sub.pCorrect != null && sub.abilityObservations > 0 && sub.sigma != null && sub.sigma <= 1.0;

  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-xs leading-snug text-slate-300" title={sub.parentSummary ? sub.description : undefined}>
          {sub.parentSummary ?? sub.description}
        </p>
        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${pill.cls}`}>
          {pill.label}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400 tabular-nums">
        <GateProgressDots gate={gate} />
        {stats && stats.answers > 0 && (
          <span>{plural(stats.answers, 'answer')}{stats.accuracy != null ? `, ${stats.accuracy}% right` : ''}</span>
        )}
        {stats && stats.lessons > 0 && <span>{plural(stats.lessons, 'lesson')}</span>}
        {status === 'locked' && <span className="text-slate-500">Unlocks after the skills before it</span>}
        {showPrediction && (
          <span
            className="font-semibold text-blue-300"
            title={`Estimated from ${plural(sub.abilityObservations, 'completed task')} across this skill, at this focus's hardest difficulty. Mastery needs 90%.`}
          >
            {Math.round(sub.pCorrect! * 100)}% likely to get the next one right
          </span>
        )}
      </div>
    </li>
  );
};

export interface UnitSkillsPanelProps {
  detail: UnitDetail | null;
  /** The student whose evidence to show. */
  studentId: number;
  onClose: () => void;
}

export const UnitSkillsPanel: React.FC<UnitSkillsPanelProps> = ({ detail, studentId, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<Stats>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // Bring the freshly-opened panel into view and collapse the previous unit's breakdowns.
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

  // Evidence for the unit's grade (subjects repeat ids across grades, so grade matters).
  const grade = detail?.grade;
  useEffect(() => {
    if (!detail) return;
    let live = true;
    loadStats(studentId, grade)
      .then((s) => live && setStats(s))
      .catch(() => live && setStats({})); // no evidence: cards fall back to graph statuses
    return () => { live = false; };
  }, [detail, grade, studentId]);

  const accent = useMemo(() => (detail?.subject ? subjectVisual(detail.subject).accent : 'cyan'), [detail?.subject]);
  const unit = useMemo(() => (detail ? rollup(detail.skills.flatMap((sk) => sk.subskills), stats) : null), [detail, stats]);

  if (!detail || !unit) return null;

  const toggleSkill = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div ref={ref} className="lumina-skills-panel mt-4 rounded-2xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-xl">
      <style>{PANEL_CSS}</style>

      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{detail.subject} · skills</p>
          <h3 className={`mt-0.5 text-base font-bold leading-tight ${accentText[accent]}`}>{detail.title}</h3>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close skills"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <Stat label="Mastered" value={`${unit.mastered}/${unit.total}`} valueCls="text-emerald-300" />
        <Stat label="Learning" value={String(unit.learning)} valueCls="text-blue-300" />
        <Stat label="Ready to learn" value={String(unit.ready)} valueCls="text-amber-300" />
        <Stat label="Answers" value={String(unit.answers)} />
        <Stat label="Right" value={unit.accuracy != null ? `${unit.accuracy}%` : '—'} />
        <Stat label="Lessons" value={String(unit.lessons)} />
      </div>

      {detail.skills.length === 0 ? (
        <p className="text-sm text-slate-400">No skills mapped to this unit yet.</p>
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2">
          {detail.skills.map((skill, i) => {
            const r = rollup(skill.subskills, stats);
            const isOpen = expanded.has(skill.id);
            const pct = (n: number) => `${(n / Math.max(1, r.total)) * 100}%`;
            return (
              <div
                key={skill.id}
                style={{ animationDelay: `${0.05 * i}s` }}
                className="lumina-skill-card flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="min-w-0 text-sm font-semibold leading-snug text-slate-100">{skill.description}</h4>
                  <span className="shrink-0 text-xs font-semibold text-emerald-300 tabular-nums">
                    {r.mastered} of {r.total} mastered
                  </span>
                </div>
                <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-white/10"
                  role="img" aria-label={`${r.mastered} mastered, ${r.learning} learning, of ${r.total}`}>
                  {r.mastered > 0 && <i className="block h-full bg-emerald-400" style={{ width: pct(r.mastered) }} />}
                  {r.learning > 0 && <i className="block h-full bg-blue-400" style={{ width: pct(r.learning) }} />}
                </div>
                {r.answers > 0 ? (
                  <div className="grid grid-cols-3 gap-2 pt-0.5">
                    <Stat label="Answers" value={String(r.answers)} />
                    <Stat label="Right" value={r.accuracy != null ? `${r.accuracy}%` : '—'} />
                    <Stat label="Lessons" value={String(r.lessons)} />
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    {r.ready > 0 ? `${plural(r.ready, 'focus', 'focuses')} ready to learn` : 'No practice yet'}
                  </p>
                )}

                {skill.subskills.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => toggleSkill(skill.id)}
                      aria-expanded={isOpen}
                      className="flex w-fit items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-300"
                    >
                      <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      {plural(skill.subskills.length, 'skill focus', 'skill focuses')}
                    </button>
                    {isOpen && (
                      <ul className="flex flex-col gap-1.5">
                        {skill.subskills.map((sub) => (
                          <SubskillRow key={sub.id} sub={sub} stats={stats[sub.id]} />
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
