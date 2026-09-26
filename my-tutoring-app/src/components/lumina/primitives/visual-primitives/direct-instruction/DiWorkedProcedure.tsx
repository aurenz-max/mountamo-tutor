'use client';

/**
 * DiWorkedProcedure — the first "DI for Older Learners" pack (design brief 2026-09-07): a multi-digit
 * subtraction the child works OUT LOUD, one column at a time, judged step by step.
 *
 * WHAT THE CHILD DOES. Sees the problem printed in columns, empty, with the current column ringed, and
 * says the move — "three minus eight, I can't, so I regroup: four tens, thirteen ones" — then the
 * difference, then the next column.
 *
 * The Live tutor teaches it on the shared tutor/JEV workspace through `DiTeachingStage` (workspace
 * rollout C6; the judged runner is gone, one-path ruling 09-23). An unbound mount renders the stage's
 * visible "needs the tutor" card.
 *
 * THE SCREEN ONLY FOLLOWS — AND HERE IT SCRIBES. Every credited step writes itself onto the problem: the
 * strike and the small digit above on a regroup, the difference digit under the rule. Nothing the child
 * must say is printed before they say it, which is why the marks are keyed to credited item ids. A wrong
 * answer no longer closes a step, so there is no tutor-carried mark to draw.
 */

import React, { useMemo } from 'react';
import type { DiWorkedProcedureMetrics, PrimitiveEvaluationResult } from '../../../evaluation/types';
import DiTeachingStage, { diStageMetrics, type DiStageView } from './DiTeachingStage';
import type { DiWorkedProcedureData, WorkedProcedureItem } from './diWorkedProcedureScript';
import { workedProcedureAssignment, workedProcedureItems, workedProcedureScene } from './diWorkedProcedureWorkspace';

export type {
  DiWorkedProcedureData,
  WorkedProblemSpec,
  WorkedProcedureChallengeType,
  WorkedProcedureItem,
  WorkedProcedureSupportTier,
} from './diWorkedProcedureScript';

const COPY = {
  empty: 'No subtraction problems were built for this objective.',
  title: 'Talk It Through', badge: 'Talk it through', prompt: 'Say what you do in the ringed column, or ask for help.',
  heading: 'Subtraction Complete!', celebration: 'You talked through every column yourself.',
};

/** The problem in columns, with the credited marks of this problem written in. */
function ProblemColumns({ item, steps, view, marked }: { item: WorkedProcedureItem; steps: WorkedProcedureItem[];
    view: DiStageView; marked: boolean }) {
  const digits = String(item.minuend).length;
  const credited = (candidate?: WorkedProcedureItem) => !!candidate && view.committed.has(candidate.id);
  const columns = Array.from({ length: digits }, (_, c) => {
    const decide = steps.find(it => it.columnIndex === c && it.kind === 'decide');
    const subtract = steps.find(it => it.columnIndex === c && it.kind === 'subtract');
    const below = steps.find(it => it.columnIndex === c - 1 && it.kind === 'decide' && it.regroup);
    const answerItem = subtract ?? (decide && !decide.regroup ? decide : undefined);
    return { columnIndex: c, top: Math.floor(item.minuend / 10 ** c) % 10, bottom: Math.floor(item.subtrahend / 10 ** c) % 10,
      lent: credited(below), borrowed: !!decide?.regroup && credited(decide), answered: credited(answerItem),
      answerDigit: answerItem?.column.difference ?? null };
  }).reverse(); // render hundreds → ones
  const active = (columnIndex: number) => item.columnIndex === columnIndex ? 'bg-cyan-400/10 ring-1 ring-cyan-300/40' : '';
  const label = (columnIndex: number, row: string) => item.columnIndex === columnIndex ? `Current ${item.place} column, ${row}` : undefined;
  return <div data-procedure-object="problem" data-assignment-target="true" data-tutor-demonstration={marked}
    className={`rounded-xl border border-white/10 bg-white/5 px-4 py-10 ${marked ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
    <div className="mx-auto grid select-none font-mono text-6xl font-semibold text-slate-100" aria-label={item.problemDisplay}
      style={{ gridTemplateColumns: `1.2ch repeat(${digits}, 1.4ch)`, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
      <span />
      {columns.map((col, i) => <span key={`top-${i}`} className={`relative rounded-sm text-right ${active(col.columnIndex)}`}
        aria-label={label(col.columnIndex, 'top digit')}>
        {col.lent && <span className="absolute -top-6 right-0 text-2xl text-emerald-300">{col.top - 1}</span>}
        {col.borrowed && <span className="absolute -top-6 -left-3 text-2xl text-emerald-300">1</span>}
        <span className={col.lent ? 'line-through decoration-4 decoration-slate-400 text-slate-500' : ''}>{col.top}</span>
      </span>)}
      <span className="text-slate-400">−</span>
      {columns.map((col, i) => <span key={`bot-${i}`} className={`rounded-sm text-right ${active(col.columnIndex)}`}
        aria-label={label(col.columnIndex, 'bottom digit')}>{col.bottom}</span>)}
      <span className="col-span-full my-1 border-t-4 border-slate-200" />
      <span />
      {columns.map((col, i) => <span key={`ans-${i}`} data-procedure-digit={col.answered ? col.columnIndex : undefined}
        className={`rounded-sm text-right text-emerald-300 ${active(col.columnIndex)}`} aria-label={label(col.columnIndex, 'answer digit')}>
        {col.answered ? col.answerDigit : <span className="text-slate-700">·</span>}
      </span>)}
    </div>
  </div>;
}

/** A missed step recaps without its answer. */
const recapLabel = (item: WorkedProcedureItem, solved: boolean) =>
  `${item.problemDisplay} · ${item.place} ${item.kind === 'decide' ? (solved && item.regroup ? 'regroup' : 'column') : 'difference'}`;

const problemCounter = (item: WorkedProcedureItem, items: readonly WorkedProcedureItem[]) =>
  ({ current: item.problemIndex + 1, total: new Set(items.map(candidate => candidate.problemId)).size });

export interface DiWorkedProcedureProps {
  data: DiWorkedProcedureData & { onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiWorkedProcedureMetrics>) => void };
  index?: number;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the live mount; never rebuilt from a label. */
  runtimeEvalMode?: string;
}

/** PLATFORM PROP CONTRACT: registry primitives mount as `<Component data={…} index={…} />`. */
export const DiWorkedProcedure: React.FC<DiWorkedProcedureProps> = ({ data, className, runtimePlanItemId, runtimeEvalMode }) => {
  const items = useMemo(() => workedProcedureItems(data), [data]);
  const evalMode = runtimeEvalMode || data.challengeType || 'subtract_no_regroup';
  return <DiTeachingStage<WorkedProcedureItem, DiWorkedProcedureMetrics> primitiveId="di-worked-procedure" data={data}
    items={items} evalMode={evalMode} className={className} runtimePlanItemId={runtimePlanItemId}
    assignment={workedProcedureAssignment} scene={workedProcedureScene} copy={COPY} recapLabel={recapLabel} counter={problemCounter}
    stimulus={(item, marks, view) => <ProblemColumns item={item} view={view} marked={marks.includes('problem')}
      steps={items.filter(candidate => candidate.problemId === item.problemId)} />}
    metrics={result => {
      const regroup = items.filter(item => item.kind === 'decide' && item.regroup);
      const solved = new Set(result.outcomes.filter(outcome => outcome.solved).map(outcome => outcome.id));
      return { type: 'di-worked-procedure', ...diStageMetrics(result, items, data.challengeType),
        problemCount: new Set(items.map(item => item.problemId)).size,
        regroupStepsTotal: regroup.length, regroupStepsCorrect: regroup.filter(item => solved.has(item.id)).length,
        meanResponseMs: null };
    }} />;
};

export default DiWorkedProcedure;
