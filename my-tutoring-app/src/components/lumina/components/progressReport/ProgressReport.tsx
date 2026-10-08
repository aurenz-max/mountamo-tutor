'use client';

/**
 * ProgressReport — "how is my child doing?".
 *
 * Two calls: GET .../report returns the numbers (fast) and renders at once with
 * templated sentences; GET .../report/narrative then returns Gemini-written
 * text over those numbers, parent-facing skill sentences, and at-home tips,
 * and each replaces its template when it arrives. A missing part keeps the
 * template, so the report never waits on or breaks from the model.
 *
 * Each section is a parent's question with a plain answer first. Mastery means
 * lifecycle gate 4; the legacy competency score is not shown.
 * Queue: my-tutoring-app/qa/parent-report/ROADMAP.md.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LuminaCard, LuminaCardContent, LuminaSectionLabel, LuminaBadge } from '../../ui';
import {
  analyticsApi,
  type ProgressReportNarrativeResponse,
  type ProgressReportResponse,
  type ProgressReportSkillRow,
} from '@/lib/studentAnalyticsAPI';
import { AccuracyChart, GATE_LEGEND, GradeMap, MinutesChart } from './ProgressReportCharts';
import { buildReportText, gradeName, isAboveGrade, LEARNING_BAND } from './reportText';

export interface ProgressReportProps {
  studentId: number;
  /** What the report calls the learner; defaults to the signed-in name for their own report. */
  displayName?: string;
}

const shortDate = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

const evidence = (r: ProgressReportSkillRow) =>
  r.answers
    ? `${r.answers} answer${r.answers === 1 ? '' : 's'}${r.accuracy != null ? `, ${r.accuracy}% right` : ''}`
    : 'evidence from earlier lessons';

function Question({ eyebrow, title, lede, children }: {
  eyebrow: string; title: string; lede?: string; children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{eyebrow}</p>
        <h3 className="text-xl font-bold text-slate-100 text-balance">{title}</h3>
        {lede && <p className="max-w-prose text-sm text-slate-400">{lede}</p>}
      </div>
      {children}
    </section>
  );
}

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <LuminaCard>
      <LuminaCardContent className="p-5 space-y-3">
        {title && <h4 className="text-sm font-semibold text-slate-200">{title}</h4>}
        {children}
      </LuminaCardContent>
    </LuminaCard>
  );
}

function SkillList({ rows, grade, describe, side }: {
  rows: ProgressReportSkillRow[];
  grade: string;
  describe: (subskillId: string, fallback: string | null) => string;
  side: (r: ProgressReportSkillRow) => React.ReactNode;
}) {
  return (
    <ul className="divide-y divide-white/10">
      {rows.map((r) => (
        <li key={r.subskill_id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-slate-100">
              {describe(r.subskill_id, r.description)}
              {isAboveGrade(r.grade, grade) && <LuminaBadge accent="amber" className="ml-2 align-middle">{gradeName(r.grade!)}</LuminaBadge>}
            </p>
            <p className="text-xs text-slate-500 tabular-nums">{[r.unit, evidence(r)].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="shrink-0 text-right text-xs text-slate-400">{side(r)}</div>
        </li>
      ))}
    </ul>
  );
}

const GateSteps = ({ gate }: { gate: number }) => (
  <span className="inline-flex items-center gap-2 whitespace-nowrap">
    <span className="inline-flex gap-[3px]">
      {[1, 2, 3, 4].map((k) => (
        <i key={k} className={`block h-1.5 w-3.5 rounded-full ${k <= gate ? 'bg-emerald-400' : 'bg-slate-700'}`} />
      ))}
    </span>
    {gate} of 4
  </span>
);

function Bars({ rows }: { rows: Array<{ label: string; value: number; display: string; warm?: boolean }> }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[7.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
          <span className="truncate text-slate-300">{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-slate-700/50">
            <i className={`block h-full rounded-full ${r.warm ? 'bg-amber-400/80' : 'bg-emerald-500/80'}`}
              style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-right text-xs text-slate-500 tabular-nums">{r.display}</span>
        </div>
      ))}
    </div>
  );
}

function HelpItem({ kind, seen, aboveLabel, title, detail, tip, tipsLoaded }: {
  kind: string; seen: string | null; aboveLabel: string | null; title: string; detail: string | null;
  tip?: string; tipsLoaded: boolean;
}) {
  return (
    <div className="space-y-1.5 border-l-2 border-amber-400/70 pl-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {kind} · seen {shortDate(seen)}{aboveLabel && ` · ${aboveLabel} material`}
      </p>
      <p className="text-sm font-semibold text-slate-100">{title}</p>
      {detail && <p className="text-xs text-slate-400 tabular-nums">{detail}</p>}
      {tip ? (
        <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-slate-200">
          <span className="font-semibold text-amber-300">Try at home: </span>{tip}
        </p>
      ) : tipsLoaded && aboveLabel ? (
        <p className="text-xs text-slate-500">This came from material well above their grade, so there is nothing to practice at home.</p>
      ) : null}
    </div>
  );
}

export default function ProgressReport({ studentId, displayName }: ProgressReportProps) {
  const { user, userProfile } = useAuth();
  const [report, setReport] = useState<ProgressReportResponse | null>(null);
  const [prose, setProse] = useState<ProgressReportNarrativeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The signed-in learner's own name; another student's report uses their id.
  const ownName = userProfile?.student_id === studentId ? (userProfile?.displayName || user?.displayName || '') : '';
  const name = (displayName || ownName).trim() || `Student ${studentId}`;

  useEffect(() => {
    let live = true;
    setReport(null);
    setProse(null);
    setError(null);
    analyticsApi.getProgressReport(studentId)
      .then((r) => {
        if (!live) return;
        setReport(r);
        // Prose arrives second; a failure leaves the templated text in place.
        analyticsApi.getProgressReportNarrative(studentId, { name })
          .then((n) => live && setProse(n))
          .catch(() => undefined);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : 'The report could not load.'));
    return () => { live = false; };
  }, [studentId, name]);

  const text = useMemo(() => (report ? buildReportText(report, name) : null), [report, name]);

  if (error) {
    return (
      <Panel>
        <p className="text-sm text-slate-400">The progress report could not load: {error}. Reopen My Progress to try again.</p>
      </Panel>
    );
  }
  if (!report || !text) {
    return <Panel><p className="text-sm text-slate-500">Building the progress report…</p></Panel>;
  }

  const r = report;
  const n = prose?.narrative ?? null;
  // Published parent sentence first (instant), then a generated one, then the author text.
  const published: Record<string, string> = {};
  [...r.recent_mastered, ...r.in_progress, ...r.needs_practice, ...r.misconceptions].forEach((x) => {
    if (x.parent_summary) published[x.subskill_id] = x.parent_summary;
  });
  const describe = (sid: string, fallback: string | null) => published[sid] || prose?.summaries[sid] || fallback || sid;
  const minutesTotal = r.time_by_subject.reduce((a, s) => a + s.minutes, 0) || 1;
  const practiceOnly = r.needs_practice.filter((p) => !r.misconceptions.some((m) => m.subskill_id === p.subskill_id));
  const aboveLabel = (g: string | null) => (isAboveGrade(g, r.grade) ? gradeName(g!) : null);

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <LuminaSectionLabel accent="emerald">Progress report</LuminaSectionLabel>
          <LuminaBadge accent="cyan">{gradeName(r.grade)}</LuminaBadge>
          <span className="text-xs text-slate-500">As of {shortDate(r.as_of)}</span>
        </div>
        <LuminaCard topAccent="emerald">
          <LuminaCardContent className="p-6 space-y-5">
            <h2 className="text-2xl font-bold text-slate-100">How is {name} doing?</h2>
            <p className="max-w-prose text-[15px] leading-relaxed text-slate-300">{n?.short_answer ?? text.shortAnswer}</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                [r.recent.active_days, `days practiced in the last ${r.recent.days}`],
                [`${Math.floor(r.recent.minutes / 60)}h ${r.recent.minutes % 60}m`, `practice time, last ${r.recent.days} days`],
                [r.recent.mastered, `skills mastered, last ${r.recent.days} days`],
                [r.accuracy_recent_weeks != null ? `${r.accuracy_recent_weeks}%` : '—', 'answers correct, recent weeks'],
              ].map(([value, label]) => (
                <div key={String(label)} className="border-t-2 border-white/10 pt-3">
                  <p className="text-2xl font-bold text-slate-100 tabular-nums">{value}</p>
                  <p className="text-xs text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </LuminaCardContent>
        </LuminaCard>
      </div>

      <Question eyebrow="Are they learning?" title={n?.learning_headline ?? text.learningHeadline} lede={n?.learning_lede ?? text.learningLede}>
        <Panel title="Minutes practiced each week"><MinutesChart weeks={r.weeks} /></Panel>
        <Panel title="Share of answers correct each week">
          <AccuracyChart weeks={r.weeks} />
          <p className="text-xs text-slate-500">
            The shaded band ({LEARNING_BAND.low}-{LEARNING_BAND.high}%) is where children usually learn fastest: hard enough
            to stretch, easy enough to keep going. Week after week above it means the lessons can be harder.
          </p>
        </Panel>
      </Question>

      <Question eyebrow={`Where are they in the ${gradeName(r.grade)} year?`} title={text.yearHeadline} lede={n?.year_lede ?? text.yearLede}>
        <Panel><GradeMap subjects={r.grade_map} /></Panel>
        <div className="flex flex-wrap gap-4 text-xs text-slate-400">
          {GATE_LEGEND.map(([label, cls]) => (
            <span key={label} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-sm ${cls}`} />{label}</span>
          ))}
        </div>
      </Question>

      <Question eyebrow="Where are they doing well?" title="Recently mastered"
        lede="Mastered means the skill passed all four checks over time, not only that one answer was right.">
        {r.recent_mastered.length
          ? <Panel><SkillList rows={r.recent_mastered} grade={r.grade} describe={describe} side={(x) => shortDate(x.mastered_on)} /></Panel>
          : <Panel><p className="text-sm text-slate-400">Nothing mastered yet. Skills reach mastery after several lessons.</p></Panel>}
        {r.in_progress.length > 0 && (
          <>
            <h4 className="pt-2 text-base font-semibold text-slate-200">Working on now</h4>
            <Panel><SkillList rows={r.in_progress} grade={r.grade} describe={describe} side={(x) => <GateSteps gate={x.gate} />} /></Panel>
          </>
        )}
      </Question>

      <Question eyebrow="Where can I help?" title={text.helpHeadline} lede={n?.help_lede ?? text.helpLede}>
        {(r.misconceptions.length > 0 || practiceOnly.length > 0) && (
          <Panel>
            <div className="space-y-5">
              {r.misconceptions.map((m) => (
                <HelpItem key={`${m.subskill_id}-${m.pattern}`} kind="Mistake pattern" seen={m.detected_on}
                  aboveLabel={aboveLabel(m.grade)}
                  title={m.pattern.replace(/^The student (\w)/, (_, c: string) => c.toUpperCase())}
                  detail={describe(m.subskill_id, m.description)}
                  tip={prose?.tips[`pattern:${m.subskill_id}`]} tipsLoaded={!!prose} />
              ))}
              {practiceOnly.map((p) => (
                <HelpItem key={p.subskill_id} kind="Needs practice" seen={p.last_seen} aboveLabel={aboveLabel(p.grade)}
                  title={describe(p.subskill_id, p.description)}
                  detail={`${evidence(p)} · ${p.gate} of 4 checks passed`}
                  tip={prose?.tips[`practice:${p.subskill_id}`]} tipsLoaded={!!prose} />
              ))}
            </div>
          </Panel>
        )}
      </Question>

      <Question eyebrow="What are they into?" title={r.interests.length ? `Interests: ${r.interests.join(', ')}` : 'Where their time goes'}>
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Their interests">
            {r.interests.length ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {r.interests.map((i) => <LuminaBadge key={i} accent="cyan">{i}</LuminaBadge>)}
                </div>
                <p className="text-xs text-slate-400">
                  Lessons use these themes where they fit. {r.interest_answers} answers so far came from activities on these themes.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">No interests saved yet. Lessons can be themed around them once they are.</p>
            )}
          </Panel>
          <Panel title="Where their time goes">
            <Bars rows={r.time_by_subject.map((s) => ({
              label: s.name, value: s.minutes, display: `${Math.round((s.minutes / minutesTotal) * 100)}%`,
            }))} />
          </Panel>
        </div>
        {text.aheadShare >= 10 && (
          <Panel title={`Working ahead of ${gradeName(r.grade)}`}>
            <p className="text-sm text-slate-400">{text.aheadLine}</p>
            <Bars rows={r.grade_mix.map((g) => ({
              label: gradeName(g.grade), value: g.answers, display: String(g.answers), warm: isAboveGrade(g.grade, r.grade),
            }))} />
          </Panel>
        )}
      </Question>

      <Question eyebrow="How sure are we?" title="What this report is based on">
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-400 max-w-prose">
          <li>
            {r.evidence.answers} answers across {r.evidence.sessions} sessions on {r.evidence.active_days} days. Practice time is
            estimated from when each session started and ended.
          </li>
          {r.evidence.excluded_burst_answers > 0 && (
            <li>
              {r.evidence.excluded_burst_answers.toLocaleString()} answers were left out. On{' '}
              {r.evidence.burst_days.map(shortDate).join(', ')}, single skills logged more answers in a day than a child can
              give, which points to a system replay rather than practice.
            </li>
          )}
          <li>
            Mastered means a skill kept being answered correctly across separate lessons as the questions got harder. A
            skill with one lucky answer stays at Tried.
          </li>
          {n && <li>The written summary is generated from the numbers on this page and checked so it uses only those numbers.</li>}
        </ul>
      </Question>
    </div>
  );
}
