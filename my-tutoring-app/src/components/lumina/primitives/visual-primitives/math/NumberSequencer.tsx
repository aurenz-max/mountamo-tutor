'use client';

/**
 * NumberSequencer — the number train on the shared tutor/JEV teaching workspace. Its wiring is
 * `numberSequencer.card.ts` + `numberSequencer.boss.ts`; an unbound mount shows the shared "needs the tutor" card
 * (`withWorkspaceOnly`; the scripted judged drill was retired 2026-10-26).
 *
 * The train defines the assignment and the legal scene actions; the tutor chooses how to teach; JEV observes its
 * completed feedback; the runtime commits scoped outcomes. Nothing here writes a correction line, counts misses or
 * advances.
 *
 * Five of the six modes are SPOKEN: the child says the number that belongs, and the tutor's finished feedback is the
 * evidence. `order_cards` is the one page-work mode: the child arranges the cards, and the ARRANGEMENT is checked here,
 * by code, the moment the last card lands. There is no stillness timer: a committed arrangement is a deliberate
 * learner act, not a pause the application interprets.
 *
 * Demonstration marks whole cars or whole cards. It never fills an empty car, reorders the train or moves a card into
 * a place — those would be answering.
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuminaBadge, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle,
  LuminaChallengeCounter, LuminaReadAloudGlyph } from '../../../ui';
import type { PrimitiveEvaluationResult } from '../../../evaluation';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useTeachingWorkspace, type TeachingItem, type TeachingWorkspace }
  from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useTeachingEvaluation } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace, useRunnerPip } from '../../../pip/WorkspacePip';
import type { NumberSequencerMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { orderMiss, sameOrder, sequencerItems, targetSlot, workspaceScene, type SequencerItem } from './numberSequencerDomain';
import { MARKS_LEVER, NUMBER_SEQUENCER_LEVERS, STEPS_LEVER, quantityParts, trainSteps } from './numberSequencerLevers';
import { CAR_MARKS_LEVER, MODEL_TRAIN_LEVER, STEP_ARROW_LEVER, modelTrain, stepArrow } from './numberSequencerSpokenLevers';
import { numberSequencerBoss } from './numberSequencer.boss';
import { practiceScore } from '../../../hooks/usePhaseResults';

export interface NumberSequencerChallenge {
  id: string;
  type: 'fill-missing' | 'before-after' | 'order-cards' | 'count-from' | 'spot-error' | 'decade-fill';
  instruction: string;
  sequence: (number | null)[];
  correctAnswers: number[];
  startNumber?: number;
  direction?: 'forward' | 'backward';
  /** Code-owned position of the one wrong value in a spot-error line. */
  wrongIndex?: number;
  rangeMin: number;
  rangeMax: number;
}

export interface NumberSequencerData {
  title: string;
  description?: string;
  challenges: NumberSequencerChallenge[];
  gradeBand: 'K' | '1';
  showNumberLine: boolean;
  showDotArrays: boolean;
  /** Within-mode support tier (set by the generator when config.difficulty is present).
   *  Keeps the AI tutor's reveal level in sync with the on-screen scaffolding. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<NumberSequencerMetrics>) => void;
}


export interface NumberSequencerProps {
  data: NumberSequencerData;
  className?: string;
  /** Every live host passes it; the teaching workspace starts from the tutor, so nothing here reads it. */
  autoStart?: boolean;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<NumberSequencerChallenge['type'], string> = {
  'fill-missing': 'Fill Missing', 'before-after': 'Before & After', 'order-cards': 'Order Cards',
  'count-from': 'Count From', 'spot-error': 'Spot the Error', 'decade-fill': 'Decade Fill',
};

/** The train on the teaching workspace. Exported for tests that mount it inside a runtime. */
export function NumberSequencerSurface({ data, className, runtimePlanItemId }: NumberSequencerProps) {
  const items = useMemo(() => sequencerItems(data), [data]);
  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent>
      <p>No usable number trains are available. Generate another activity.</p>
    </LuminaCardContent></LuminaCard>;
  }
  return <TrainWorkspace key={data.instanceId} data={data} items={items} className={className}
    runtimePlanItemId={runtimePlanItemId} />;
}

function CardMarks({ n }: { n: number }) {
  const { tens, ones } = quantityParts(n);
  return <span data-lever="card-marks" aria-hidden="true" className="flex items-end justify-center gap-0.5 px-1 pb-1">
    {Array.from({ length: tens }, (_, i) => <span key={`t${i}`} className="block h-4 w-1 rounded-sm bg-purple-200/80" />)}
    <span className="grid grid-cols-5 gap-0.5">{Array.from({ length: ones }, (_, i) =>
      <span key={`o${i}`} className="block h-1 w-1 rounded-full bg-purple-100" />)}</span>
  </span>;
}

function TrainWorkspace({ data, items, className, runtimePlanItemId }:
  NumberSequencerProps & { items: SequencerItem[] }) {
  const instance = useRef(data.instanceId || `number-sequencer-${Date.now()}`);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [marks, mark] = useState<string[]>([]);
  const [placed, setPlaced] = useState<number[]>([]);
  // In-item levers (`NUMBER_SEQUENCER_LEVERS`), keyed by the session item they were pulled on, and the easier train
  // a simplify lever put on screen in its place. Retry on the easier train keeps it; only endPractice removes it.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPracticeState] = useState<SequencerItem | null>(null);
  const practiceRef = useRef<SequencerItem | null>(null);
  const setPractice = (next: SequencerItem | null) => { practiceRef.current = next; setPracticeState(next); };
  const openedIndex = useRef(-1);

  const assignments = useMemo<TeachingItem[]>(() => items.map(item => ({
    ...numberSequencerBoss.assignment(item),
    checkResponse: item.answerKind === 'gesture'
      ? (response: string) => sameOrder(response.split(',').filter(Boolean).map(Number), item.answerOrder)
      : () => null,
  })), [items]);

  const lesson = useTeachingWorkspace({ instanceId: instance.current, primitiveId: 'number-sequencer',
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId, items: assignments, workspace,
    onItemOpened: opened => {
      setPlaced([]);
      if (opened !== openedIndex.current) setPractice(null);
      openedIndex.current = opened;
    },
    checkPractice: (id, response) => practiceRef.current?.id === id
      ? sameOrder(response.split(',').filter(Boolean).map(Number), practiceRef.current.answerOrder) : null });

  const evaluation = useTeachingEvaluation<NumberSequencerMetrics>({ primitiveType: 'number-sequencer',
    instanceId: instance.current, data, assignments, lesson,
    metrics: result => {
      const scores = new Map(result.outcomes.map(o => [o.id, o.score]));
      const accuracy = (type: NumberSequencerChallenge['type']) => {
        const group = items.filter(i => i.challengeType === type);
        return group.length ? Math.round(group.reduce((sum, i) => sum + (scores.get(i.id) ?? 0), 0) / group.length) : undefined;
      };
      return { type: 'number-sequencer', accuracy: result.accuracy, attemptsCount: result.attemptsCount,
        sequenceUnderstanding: result.accuracy >= 80,
        fillMissingAccuracy: accuracy('fill-missing'), beforeAfterAccuracy: accuracy('before-after'),
        orderCardsAccuracy: accuracy('order-cards'), countFromAccuracy: accuracy('count-from'),
        spotErrorAccuracy: accuracy('spot-error'), decadeFillAccuracy: accuracy('decade-fill') };
    } });

  const index = lesson.state.index;
  const sessionItem = items[index];
  /** What is on screen: the easier train while a simplify lever holds it, else the session item. */
  const item = practice ?? sessionItem;
  const pulled = leverState.item === sessionItem.id ? leverState.pulled : [];
  const leverOn = (id: string) => !practice && pulled.includes(id);
  const gesture = item.answerKind === 'gesture';
  // Slots of this same challenge already answered, filled in on the drawn train.
  const shown = useMemo(() => item.sequence.map((value, position) => {
    const solved = items.find((other, k) => k < index && other.sourceId === item.sourceId && other.slot === position);
    return solved ? (solved.repair ?? solved.answer) : value;
  }), [items, index, item]);
  const cards = useMemo(() => item.sequence.filter((n): n is number => n !== null), [item]);
  const target = targetSlot(item);
  const arrow = leverOn(STEP_ARROW_LEVER) ? stepArrow(item) : null;
  const model = leverOn(MODEL_TRAIN_LEVER) ? modelTrain(item) : null;
  const leverCtx = { session: items, band: data.gradeBand };

  const solved = lesson.state.phase === 'checked' && !!lesson.state.lastResponse?.correct && !lesson.state.practice;
  useRunnerPip({ instanceId: instance.current, itemId: item.id, running: lesson.state.phase !== 'completed', solved });

  useLayoutEffect(() => {
    const levers = practice ? [] : NUMBER_SEQUENCER_LEVERS.declare(sessionItem, leverCtx, pulled);
    workspace.current = {
      ...leverScene(workspaceScene(item, { shown, placed }), {
        support: practice ? '' : NUMBER_SEQUENCER_LEVERS.support(sessionItem, leverCtx),
        onScreen: practice ? '' : NUMBER_SEQUENCER_LEVERS.onScreen(sessionItem, leverCtx, pulled) }),
      demonstration: marks,
      canDemonstrate: true, mark, clearPresentation: () => mark([]),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the train changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (lever.kind === 'simplify') {
          const easier = NUMBER_SEQUENCER_LEVERS.simpler(sessionItem, leverCtx, id);
          if (!easier) return 'There is no easier train for this item.';
          setLeverState({ item: sessionItem.id, pulled: [...pulled, id] });
          setPractice(easier); setPlaced([]);
          return { practice: numberSequencerBoss.assignment(easier) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulled, id] });
        return true;
      },
      endPractice: () => { setPractice(null); setPlaced([]); },
    };
  });

  const changeOrder = (next: number[], sound: 'place' | 'remove') => {
    if (!gesture || !lesson.canAttempt) return;
    if (sound === 'place') SoundManager.snap(); else SoundManager.tap();
    setPlaced(next);
    if (next.length === item.answerOrder.length) lesson.submitGestureResponse(next.join(','), orderMiss(item, next));
  };

  const summary = lesson.summary;
  if (summary) return <LuminaCard className={className} surface="elevated">
    <LuminaCardContent className="space-y-6">
      <PhaseSummaryPanel heading="Sequence Complete!" celebrationMessage="You worked through every number train!"
        overallScore={practiceScore(summary) ?? evaluation.submittedResult?.score} durationMs={evaluation.elapsedMs}
        phases={summary.outcomes.map((outcome, position) => ({
          label: MODE_LABEL[items[position]?.challengeType ?? 'fill-missing'], score: outcome.score,
          attempts: outcome.attempts, firstTry: outcome.corrections === 0, accentColor: 'cyan' as const }))} />
    </LuminaCardContent>
  </LuminaCard>;

  const car = (value: number | null, position: number) => {
    const active = position === target;
    const marked = marks.includes(`car-${position}`);
    return <div key={position} data-testid={`train-car-${position}`} data-assignment-target={active}
      data-tutor-demonstration={marked}
      aria-label={value === null ? (active ? 'Current missing number' : 'Missing number') : `Number ${value}`}
      className={`relative flex min-h-24 w-20 flex-col items-center justify-center gap-2 rounded-xl border-2 pb-3 text-3xl font-semibold ${
        active ? 'border-amber-300 bg-amber-400/15 text-amber-100' : 'border-slate-500/40 bg-slate-800/60 text-white'} ${
        marked ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
      <span>{value ?? '?'}</span>
      {data.showDotArrays && value !== null && value <= 20 && <span aria-hidden="true" className="grid grid-cols-5 gap-1">
        {Array.from({ length: value }, (_, n) => <span key={n} className="h-1.5 w-1.5 rounded-full bg-slate-300" />)}
      </span>}
      {/* car_marks lever: a printed car's amount as sticks of ten and dots; an empty car shows none. */}
      {leverOn(CAR_MARKS_LEVER) && value !== null && <CardMarks n={value} />}
      {/* step_arrow lever: on the printed car beside the glowing one, pointing at it, marked with one step. */}
      {arrow?.from === position && <span data-lever="step-arrow" aria-hidden="true"
        className={`absolute top-1 whitespace-nowrap rounded bg-cyan-400/20 px-1 text-sm text-cyan-100 ${
          target > position ? '-right-7' : '-left-7'}`}>
        {target > position ? `${arrow.step > 0 ? '+' : '−'}${Math.abs(arrow.step)} →` : `← ${arrow.step > 0 ? '+' : '−'}${Math.abs(arrow.step)}`}
      </span>}
      <span aria-hidden="true" className="absolute -bottom-2 left-3 h-3 w-3 rounded-full bg-slate-500" />
      <span aria-hidden="true" className="absolute -bottom-2 right-3 h-3 w-3 rounded-full bg-slate-500" />
    </div>;
  };

  return <LuminaCard className={className} surface="elevated">
    <LuminaCardHeader><div className="flex items-center justify-between gap-3">
      <LuminaCardTitle>Number Train</LuminaCardTitle>
      <LuminaBadge accent="cyan">{data.gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}</LuminaBadge>
    </div></LuminaCardHeader>
    <LuminaCardContent className="space-y-6">
      <LuminaChallengeCounter current={index + 1} total={items.length} variant="dots" />
      {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the train as its region. */}
      <PipDock />
      <PipWorkspace className="space-y-6">
      {gesture ? <section aria-label="Arrange number cards" className="space-y-5">
        {/* train_steps lever: wordless bars that grow from the first place to the last; they name no card. */}
        {leverOn(STEPS_LEVER) && <div data-lever="train-steps" className="flex flex-wrap items-end justify-center gap-3" aria-hidden="true">
          {trainSteps(item.answerOrder.length).map((h, i) => <span key={i} className="flex min-w-16 justify-center">
            <span className="block w-8 rounded-sm bg-cyan-300/50" style={{ height: h }} /></span>)}
        </div>}
        <div className="flex flex-wrap justify-center gap-3" aria-label="Your number train">
          {item.answerOrder.map((_, position) => <button key={position} type="button"
            data-testid={`train-car-${position}`} data-tutor-demonstration={false}
            disabled={!lesson.canAttempt || placed[position] === undefined}
            onClick={() => changeOrder(placed.filter((_, n) => n !== position), 'remove')}
            aria-label={placed[position] === undefined ? `Empty place ${position + 1}` : `Remove ${placed[position]}`}
            className="min-h-20 min-w-16 rounded-xl border-2 border-dashed border-cyan-300/50 text-2xl text-cyan-100 disabled:cursor-default">
            {placed[position] ?? '?'}
          </button>)}
        </div>
        <div className="flex flex-wrap justify-center gap-3" aria-label="Number cards">
          {cards.filter(n => !placed.includes(n)).map(n => <button key={n} type="button"
            data-card-id={`card-${n}`} data-tutor-demonstration={marks.includes(`card-${n}`)}
            disabled={!lesson.canAttempt} onClick={() => changeOrder([...placed, n], 'place')} aria-label={`Place ${n}`}
            className={`min-h-16 min-w-16 rounded-xl border bg-purple-400/15 text-2xl text-purple-100 disabled:opacity-50 ${
              marks.includes(`card-${n}`) ? 'border-purple-300 outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : 'border-purple-300/40'}`}>
              {n}
              {/* card_marks lever: the card's amount as sticks of ten and dots, alike on every card. */}
              {leverOn(MARKS_LEVER) && <CardMarks n={n} />}
            </button>)}
        </div>
      </section> : <div className="flex flex-wrap justify-center gap-3 pb-3" aria-label="Number train">{shown.map(car)}</div>}
      {/* model_train lever: a train with its own numbers, the one that does not belong circled. */}
      {model && <div data-lever="model-train" aria-label="A model train" className="flex justify-center gap-2 opacity-80">
        {model.cars.map((n, i) => <span key={i} data-model-wrong={i === model.wrong}
          className={`flex h-10 w-10 items-center justify-center rounded-lg border text-lg text-slate-200 ${
            i === model.wrong ? 'border-rose-300 ring-2 ring-rose-400' : 'border-slate-500/40'}`}>{n}</span>)}
      </div>}
      {data.showNumberLine && !gesture && item.challengeType !== 'spot-error' && item.rangeMax - item.rangeMin <= 30
        && <div aria-label="Number line reference" className="flex flex-wrap justify-center gap-2 border-t border-slate-600 pt-3 text-sm text-slate-400">
          {Array.from({ length: item.rangeMax - item.rangeMin + 1 }, (_, i) => <span key={i} className="min-w-6 text-center">{item.rangeMin + i}</span>)}
        </div>}
      </PipWorkspace>
      <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} /></div>
      <p className="text-center text-sm text-slate-400">{gesture
        ? 'Put the cards in order, or ask for help.' : 'Say your answer, or ask for help.'}</p>
    </LuminaCardContent>
  </LuminaCard>;
}

const NumberSequencer = withWorkspaceOnly<NumberSequencerProps>('number-sequencer', NumberSequencerSurface,
  props => props.data.title);
export default NumberSequencer;
