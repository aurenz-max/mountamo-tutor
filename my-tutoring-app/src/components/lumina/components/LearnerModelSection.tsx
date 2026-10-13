'use client';

/**
 * LearnerModelSection — the two-layer learner model's view of the student
 * (GET /api/analytics/student/{id}/learner-model), one subject at a time:
 *
 *   - Ready to learn next: not yet mastered, every prerequisite mastered,
 *     ranked by P(ready) x P(right) (expected learning)
 *   - Getting stronger: subskills practised but not yet mastered
 *   - Mastered: count, split into practised and inferred from the graph
 *
 * Laid out like ProgressReport (question eyebrow, title, plain lede, divided
 * rows with the published parent sentence). Each skill's chance of getting it
 * right is shown as a MasteryBands band, not a percentage.
 *
 * The backend keeps this state current on every submission, so this is one
 * read, never a replay. Shadow: nothing that picks content reads it yet, so
 * it is labelled Preview. Fails quietly (renders null).
 */

import React, { useEffect, useState } from 'react';
import { LuminaCard, LuminaCardContent, LuminaBadge, LuminaChoiceChip } from '../ui';
import { analyticsApi, type LearnerModelResponse, type LearnerModelRow } from '@/lib/studentAnalyticsAPI';
import MasteryBands from './MasteryBands';
import GrownPastBanner from './GrownPastBanner';

export interface LearnerModelSectionProps {
  studentId: number;
}

const prettySubject = (key: string): string =>
  key.split('_').map((w) => (w ? w[0] + w.slice(1).toLowerCase() : w)).join(' ');

export const gradeName = (grade: string): string => (grade === 'Kindergarten' ? 'Kindergarten' : `Grade ${grade}`);

function SkillRows({ rows }: { rows: LearnerModelRow[] }) {
  return (
    <ul className="divide-y divide-white/10">
      {rows.map((r) => (
        <li key={r.key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-slate-100">
              {r.label}
              <LuminaBadge accent="amber" className="ml-2 align-middle">{gradeName(r.grade)}</LuminaBadge>
            </p>
            <p className="text-xs text-slate-500">
              {[r.unit, r.answers ? `${r.answers} answer${r.answers === 1 ? '' : 's'}` : 'not practised yet']
                .filter(Boolean).join(' · ')}
            </p>
          </div>
          {/* A band is a claim about the child's own answers; with none, the
              model's prediction would read as "Got it" on a skill never tried. */}
          {r.answers
            ? <MasteryBands p={r.p_right} className="shrink-0 pt-1" />
            : <span className="shrink-0 pt-1 text-xs text-slate-500">Not started</span>}
        </li>
      ))}
    </ul>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-base font-semibold text-slate-200">{title}</h4>
      <LuminaCard>
        <LuminaCardContent className="p-5">{children}</LuminaCardContent>
      </LuminaCard>
    </div>
  );
}

export default function LearnerModelSection({ studentId }: LearnerModelSectionProps) {
  const [data, setData] = useState<LearnerModelResponse | null>(null);
  const [subject, setSubject] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    analyticsApi
      .getLearnerModel(studentId, { top: 5 })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        const first = [...d.subjects].filter((s) => s.observations > 0).sort((a, b) => b.observations - a.observations)[0];
        setSubject(first?.subject ?? null);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const subjects = (data?.subjects ?? []).filter((s) => s.observations > 0);
  const sec = subjects.find((s) => s.subject === subject);
  if (!sec) return null;

  // The demonstration states the report grid reads (backend engine.demonstration):
  // practised, or demonstrated by a harder skill practised. The model's guess from
  // general ability is never shown as known (it read 186 language arts skills from 19).
  const mastered = sec.counts.shown ?? sec.counts.mastered_seen ?? 0;
  const practised = sec.counts.shown_practised ?? sec.counts.mastered_seen ?? 0;
  const retained = sec.counts.shown_mastered ?? 0;

  return (
    <section className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">What do they know?</p>
          <LuminaBadge accent="indigo">Preview</LuminaBadge>
        </div>
        <h3 className="text-xl font-bold text-slate-100 text-balance">
          {mastered} {prettySubject(sec.subject).toLowerCase()} skills shown
        </h3>
        <p className="max-w-prose text-sm text-slate-400">
          {practised} of them were practised directly. The other {Math.max(0, mastered - practised)} are
          steps inside, or easier forms of, harder skills they showed: counting 20 objects shows counting 10.
          {retained > 0 && <> {retained} have also held up over time (mastered).</>}
          The bars show the chance of getting each skill right today.
        </p>
      </div>

      <GrownPastBanner audience="child" items={(sec.grown_past ?? []).map((g) => ({
        subject: prettySubject(sec.subject), grade: g.grade, nowLearning: sec.reach_grade,
      }))} />

      {subjects.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <LuminaChoiceChip
              key={s.subject}
              label={prettySubject(s.subject)}
              accent="cyan"
              selected={s.subject === subject}
              onClick={() => setSubject(s.subject)}
            />
          ))}
        </div>
      )}

      {sec.ready.length > 0 && <Panel title="Ready to learn next"><SkillRows rows={sec.ready} /></Panel>}
      {sec.working_on.length > 0 && <Panel title="Getting stronger"><SkillRows rows={sec.working_on} /></Panel>}
    </section>
  );
}
