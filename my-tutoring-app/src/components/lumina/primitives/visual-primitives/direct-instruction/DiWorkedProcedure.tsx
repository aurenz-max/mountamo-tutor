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
 *
 * LEVERS (`diWorkedProcedureLevers.ts`, DI family 7): a "my turn" card with a DIFFERENT subtraction fully
 * worked (the same columns render, compact, every mark drawn); place pieces for each column's top number
 * as it reads now; cubes for the ringed column with the bottom number crossed out; and a 2-digit regroup
 * step to practise first after a `no_decrement` on a 3-digit tens column.
 */

import React, { useMemo } from 'react';
import type { DiWorkedProcedureMetrics, PrimitiveEvaluationResult } from '../../../evaluation/types';
import DiTeachingStage, { diStageMetrics, type DiStageLevers, type DiStageView } from './DiTeachingStage';
import { itemsFromProblems, type DiWorkedProcedureData, type WorkedProcedureItem } from './diWorkedProcedureScript';
import { workedProcedureAssignment, workedProcedureItems, workedProcedureScene } from './diWorkedProcedureWorkspace';
import { MODEL_PROBLEM, TAKE_AWAY_CUBES, TOP_BLOCKS, fewerColumnsFor, modelFor, procedureLeverFacts, procedureLevers,
  startingLevers } from './diWorkedProcedureLevers';

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

interface ColumnView {
  columnIndex: number; top: number; bottom: number; lent: boolean; borrowed: boolean; answered: boolean; answerDigit: number | null;
}

/** Each column of a problem, as the page draws it now (hundreds → ones). */
function columnsOf(item: WorkedProcedureItem, steps: readonly WorkedProcedureItem[], credited: (it?: WorkedProcedureItem) => boolean): ColumnView[] {
  const digits = String(item.minuend).length;
  return Array.from({ length: digits }, (_, c) => {
    const decide = steps.find(it => it.columnIndex === c && it.kind === 'decide');
    const subtract = steps.find(it => it.columnIndex === c && it.kind === 'subtract');
    const below = steps.find(it => it.columnIndex === c - 1 && it.kind === 'decide' && it.regroup);
    const answerItem = subtract ?? (decide && !decide.regroup ? decide : undefined);
    return { columnIndex: c, top: Math.floor(item.minuend / 10 ** c) % 10, bottom: Math.floor(item.subtrahend / 10 ** c) % 10,
      lent: credited(below), borrowed: !!decide?.regroup && credited(decide), answered: credited(answerItem),
      answerDigit: answerItem?.column.difference ?? null };
  }).reverse();
}

/** The problem in columns, with the credited marks written in. `compact` draws the model card's worked problem. */
function ProblemColumns({ item, steps, credited, marked, compact = false }: { item: WorkedProcedureItem;
    steps: readonly WorkedProcedureItem[]; credited: (it?: WorkedProcedureItem) => boolean; marked: boolean; compact?: boolean }) {
  const digits = String(item.minuend).length;
  const columns = columnsOf(item, steps, credited);
  const active = (columnIndex: number) => !compact && item.columnIndex === columnIndex ? 'bg-cyan-400/10 ring-1 ring-cyan-300/40' : '';
  const label = (columnIndex: number, row: string) => !compact && item.columnIndex === columnIndex ? `Current ${item.place} column, ${row}` : undefined;
  return <div data-procedure-object={compact ? undefined : 'problem'} data-assignment-target={compact ? undefined : 'true'}
    data-tutor-demonstration={marked}
    className={compact ? 'px-2 py-3' : `rounded-xl border border-white/10 bg-white/5 px-4 py-10 ${marked ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
    <div className={`mx-auto grid select-none font-mono font-semibold text-slate-100 ${compact ? 'text-2xl' : 'text-6xl'}`} aria-label={item.problemDisplay}
      style={{ gridTemplateColumns: `1.2ch repeat(${digits}, 1.4ch)`, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
      <span />
      {columns.map((col, i) => <span key={`top-${i}`} className={`relative rounded-sm text-right ${active(col.columnIndex)}`}
        aria-label={label(col.columnIndex, 'top digit')}>
        {col.lent && <span className={`absolute right-0 text-emerald-300 ${compact ? '-top-3 text-sm' : '-top-6 text-2xl'}`}>{col.top - 1}</span>}
        {col.borrowed && <span className={`absolute text-emerald-300 ${compact ? '-top-3 -left-1.5 text-sm' : '-top-6 -left-3 text-2xl'}`}>1</span>}
        <span className={col.lent ? 'line-through decoration-4 decoration-slate-400 text-slate-500' : ''}>{col.top}</span>
      </span>)}
      <span className="text-slate-400">−</span>
      {columns.map((col, i) => <span key={`bot-${i}`} className={`rounded-sm text-right ${active(col.columnIndex)}`}
        aria-label={label(col.columnIndex, 'bottom digit')}>{col.bottom}</span>)}
      <span className={`col-span-full my-1 border-slate-200 ${compact ? 'border-t-2' : 'border-t-4'}`} />
      <span />
      {columns.map((col, i) => <span key={`ans-${i}`} data-procedure-digit={!compact && col.answered ? col.columnIndex : undefined}
        className={`rounded-sm text-right text-emerald-300 ${active(col.columnIndex)}`} aria-label={label(col.columnIndex, 'answer digit')}>
        {col.answered ? col.answerDigit : <span className="text-slate-700">·</span>}
      </span>)}
    </div>
  </div>;
}

const PIECE: Record<number, string> = { 0: 'h-3 w-3', 1: 'h-10 w-2.5', 2: 'h-8 w-8' };

/** `top_blocks`: under each column, its top number as it reads now, as place pieces (cubes, rods, flats). No count. */
function TopBlocks({ columns }: { columns: ColumnView[] }) {
  return <div data-lever={TOP_BLOCKS} aria-label="Each column's top number as place-value pieces" className="flex justify-center gap-6">
    {columns.map(col => {
      const n = col.lent ? col.top - 1 : col.top;
      return <div key={col.columnIndex} data-top-blocks={col.columnIndex} className="flex max-w-24 flex-wrap content-start justify-center gap-1">
        {Array.from({ length: n }, (_, i) => <span key={i} data-piece className={`${PIECE[col.columnIndex]} rounded-sm bg-amber-300/80`} />)}
      </div>;
    })}
  </div>;
}

/** `take_away_cubes`: the ringed column's top as cubes, the last `bottom` of them crossed out. No count of what is left. */
function TakeAwayCubes({ item }: { item: WorkedProcedureItem }) {
  const top = item.kind === 'subtract' ? item.column.effectiveTop : item.column.topAfterLend;
  return <div data-lever={TAKE_AWAY_CUBES} aria-label="The top number as cubes, the bottom number of them crossed out" className="flex flex-wrap justify-center gap-1.5">
    {Array.from({ length: top }, (_, i) => {
      const gone = i >= top - item.column.bottom;
      return <span key={i} data-cube data-crossed={gone} className={`relative h-5 w-5 rounded-sm ${gone ? 'bg-slate-500/50' : 'bg-cyan-300/80'}`}>
        {gone && <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-sm font-bold text-rose-300">✕</span>}
      </span>;
    })}
  </div>;
}

/** The model card: a different subtraction of the same width, every step drawn. */
function ModelCard({ item }: { item: WorkedProcedureItem }) {
  const plan = modelFor(item);
  const steps = useMemo(() => plan ? itemsFromProblems([{ id: 'model', minuend: plan.minuend, subtrahend: plan.subtrahend,
    challengeType: item.challengeType }]).items : [], [plan, item.challengeType]);
  if (!plan || !steps.length) return null;
  return <div data-lever={MODEL_PROBLEM} data-model-problem={`${plan.minuend}-${plan.subtrahend}`} aria-label="My turn: a different subtraction, worked"
    className="flex items-center gap-2 rounded-xl border-2 border-dashed border-purple-400/70 bg-purple-500/10 px-3">
    <span aria-hidden="true" className="text-xl leading-none">🗣️</span>
    <ProblemColumns item={steps[0]} steps={steps} credited={() => true} marked={false} compact />
  </div>;
}

function ProcedureStage({ item, steps, view, marked }: { item: WorkedProcedureItem; steps: WorkedProcedureItem[]; view: DiStageView;
  marked: boolean }) {
  const credited = (candidate?: WorkedProcedureItem) => !!candidate && view.committed.has(candidate.id);
  return <div data-practice-item={view.practice || undefined} className="space-y-4">
    <div className="flex flex-wrap items-center justify-center gap-6">
      <ProblemColumns item={item} steps={steps} credited={credited} marked={marked} />
      {view.pulled.includes(MODEL_PROBLEM) && <ModelCard item={item} />}
    </div>
    {view.pulled.includes(TOP_BLOCKS) && item.kind === 'decide' && <TopBlocks columns={columnsOf(item, steps, credited)} />}
    {view.pulled.includes(TAKE_AWAY_CUBES) && <TakeAwayCubes item={item} />}
  </div>;
}

/** A missed step recaps without its answer. */
const recapLabel = (item: WorkedProcedureItem, solved: boolean) =>
  `${item.problemDisplay} · ${item.place} ${item.kind === 'decide' ? (solved && item.regroup ? 'regroup' : 'column') : 'difference'}`;

const problemCounter = (item: WorkedProcedureItem, items: readonly WorkedProcedureItem[]) =>
  ({ current: item.problemIndex + 1, total: new Set(items.map(candidate => candidate.problemId)).size });

const LEVERS: DiStageLevers<WorkedProcedureItem> = {
  declare: procedureLevers, onScreen: procedureLeverFacts, starting: startingLevers,
  simpler: (item, lever, lastMiss) => lever === 'fewer_columns' ? fewerColumnsFor(item, lastMiss) : null,
};

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
  return <DiTeachingStage<WorkedProcedureItem, DiWorkedProcedureMetrics> primitiveId="di-worked-procedure" data={data}
    items={items} runtimeEvalMode={runtimeEvalMode} className={className} runtimePlanItemId={runtimePlanItemId}
    assignment={workedProcedureAssignment} scene={workedProcedureScene} copy={COPY} recapLabel={recapLabel} counter={problemCounter}
    levers={LEVERS}
    stimulus={(item, marks, view) => <ProcedureStage item={item} view={view} marked={marks.includes('problem')}
      // A practice step is the first step of its own small problem: its earlier marks are none.
      steps={view.practice ? [item] : items.filter(candidate => candidate.problemId === item.problemId)} />}
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
