'use client';

/**
 * NumberSequencerTeaching — the number train as a tutor/JEV teaching workspace
 * (third adopter, after Counting Board and Shape Sorter).
 *
 * The train defines the assignment and the legal scene actions; the tutor chooses
 * how to teach; JEV observes its completed feedback; the runtime commits scoped
 * outcomes. Nothing here writes a correction line, counts misses or advances.
 *
 * Five of the six modes are SPOKEN: the child says the number that belongs, and
 * the tutor's finished feedback is the evidence. `order_cards` is the one page-work
 * mode — the child arranges the cards, and the ARRANGEMENT is checked here, by
 * code, the moment the last card lands. There is no stillness timer: a committed
 * arrangement is a deliberate learner act, not a pause the application interprets.
 *
 * Demonstration marks whole cars or whole cards. It never fills an empty car,
 * reorders the train or moves a card into a place — those would be answering.
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuminaBadge, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle,
  LuminaChallengeCounter, LuminaReadAloudGlyph } from '../../../ui';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useTeachingWorkspace, type TeachingItem, type TeachingWorkspace }
  from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useTeachingEvaluation } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import type { NumberSequencerMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { askFor, buildSequencerItems, sameOrder, type SequencerItem } from './numberSequencerDomain';
import type { NumberSequencerChallenge, NumberSequencerData } from './NumberSequencer';

export interface NumberSequencerTeachingProps {
  data: NumberSequencerData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<NumberSequencerChallenge['type'], string> = {
  'fill-missing': 'Fill Missing', 'before-after': 'Before & After', 'order-cards': 'Order Cards',
  'count-from': 'Count From', 'spot-error': 'Spot the Error', 'decade-fill': 'Decade Fill',
};

/** What completes THIS item, said plainly, and what does not. Never the answer. */
function assignmentFor(item: SequencerItem): string {
  switch (item.challengeType) {
    case 'count-from': return `Say the next number counting ${item.direction} from ${item.previous}. `
      + 'Counting along with the child is teaching; the number the child says is the answer.';
    case 'before-after': return 'Say the number that belongs in the empty car. '
      + 'Reading back the number already printed on the train is not the answer.';
    case 'spot-error': return 'Say which printed number breaks the count. '
      + 'The number that should have been there instead is not the answer to this question.';
    case 'order-cards': return 'Put every card on the train from smallest to largest. '
      + 'The train checks the arrangement itself as soon as the last card is placed.';
    default: return 'Say the number that belongs in the glowing empty car. '
      + 'A number already printed on another car is not the answer.';
  }
}

export default function NumberSequencerTeaching({ data, className, runtimePlanItemId, runtimeEvalMode }: NumberSequencerTeachingProps) {
  const { items } = useMemo(() => buildSequencerItems(data.challenges ?? []), [data.challenges]);
  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent>
      <p>No usable number trains are available. Generate another activity.</p>
    </LuminaCardContent></LuminaCard>;
  }
  return <TrainWorkspace key={data.instanceId} data={data} items={items} className={className}
    runtimePlanItemId={runtimePlanItemId} runtimeEvalMode={runtimeEvalMode} />;
}

function TrainWorkspace({ data, items, className, runtimePlanItemId, runtimeEvalMode }:
  NumberSequencerTeachingProps & { items: SequencerItem[] }) {
  const instance = useRef(data.instanceId || `number-sequencer-${Date.now()}`);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [marks, mark] = useState<string[]>([]);
  const [placed, setPlaced] = useState<number[]>([]);
  const evalMode = runtimeEvalMode || 'count_from';

  const assignments = useMemo<TeachingItem[]>(() => items.map(item => ({
    id: item.id,
    task: askFor(item),
    // The whole assignment's answer, for tutor-feedback assessment. Gesture items
    // are checked here instead; the string is what the tutor sees, not a parser.
    expectedAnswer: item.answerKind === 'gesture' ? item.answerOrder.join(', ') : String(item.answer),
    response: item.answerKind === 'gesture' ? 'gesture' : 'speech',
    checkResponse: item.answerKind === 'gesture'
      ? (response: string) => sameOrder(response.split(',').filter(Boolean).map(Number), item.answerOrder)
      : () => null,
  })), [items]);

  const lesson = useTeachingWorkspace({ instanceId: instance.current, primitiveId: 'number-sequencer',
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId, evalMode, items: assignments, workspace,
    onItemOpened: () => setPlaced([]) });

  const evaluation = useTeachingEvaluation<NumberSequencerMetrics>({ primitiveType: 'number-sequencer',
    instanceId: instance.current, data, assignments, lesson, evalMode,
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
  const item = items[index];
  const gesture = item.answerKind === 'gesture';
  // Slots of this same challenge already answered, filled in on the drawn train.
  const shown = useMemo(() => item.sequence.map((value, position) => {
    const solved = items.find((other, k) => k < index && other.sourceId === item.sourceId && other.slot === position);
    return solved ? (solved.repair ?? solved.answer) : value;
  }), [items, index, item]);
  const cards = useMemo(() => item.sequence.filter((n): n is number => n !== null), [item]);
  const target = item.challengeType === 'spot-error' ? -1 : item.slot;

  useLayoutEffect(() => {
    workspace.current = {
      objects: gesture
        ? cards.map(n => ({ id: `card-${n}`, label: `number card ${n}`, selected: placed.includes(n),
          group: placed.includes(n) ? `on the train in place ${placed.indexOf(n) + 1}` : 'still waiting beside the train' }))
        : shown.map((value, position) => ({ id: `car-${position}`,
          label: value === null ? `car ${position + 1}, empty` : `car ${position + 1} showing ${value}`,
          selected: false, group: position === target ? 'assignment target (the glowing empty car)' : 'visible car' })),
      demonstration: marks,
      facts: { kind: item.challengeType, assignment: assignmentFor(item),
        ...(item.challengeType === 'count-from' ? { countingDirection: item.direction, countingFrom: item.previous } : {}),
        ...(gesture ? { cardsPlaced: placed.length, cardsWaiting: cards.length - placed.length } : {}),
        markMeaning: 'Purple dashed rings are tutor marks. They never fill a car, move a card or change which car is being asked about.' },
      readyForResponse: true, canDemonstrate: true, canPresent: false,
      mark, clearPresentation: () => mark([]),
    };
    lesson.publishWorkspace();
  });

  const changeOrder = (next: number[], sound: 'place' | 'remove') => {
    if (!gesture || !lesson.canAttempt) return;
    if (sound === 'place') SoundManager.snap(); else SoundManager.tap();
    setPlaced(next);
    if (next.length === item.answerOrder.length) lesson.submitGestureResponse(next.join(','));
  };

  const summary = lesson.summary;
  if (summary) return <LuminaCard className={className} surface="elevated">
    <LuminaCardContent className="space-y-6">
      <PhaseSummaryPanel heading="Sequence Complete!" celebrationMessage="You worked through every number train!"
        overallScore={evaluation.submittedResult?.score} durationMs={evaluation.elapsedMs}
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
      {gesture ? <section aria-label="Arrange number cards" className="space-y-5">
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
              marks.includes(`card-${n}`) ? 'border-purple-300 outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : 'border-purple-300/40'}`}>{n}</button>)}
        </div>
      </section> : <div className="flex flex-wrap justify-center gap-3 pb-3" aria-label="Number train">{shown.map(car)}</div>}
      {data.showNumberLine && !gesture && item.challengeType !== 'spot-error' && item.rangeMax - item.rangeMin <= 30
        && <div aria-label="Number line reference" className="flex flex-wrap justify-center gap-2 border-t border-slate-600 pt-3 text-sm text-slate-400">
          {Array.from({ length: item.rangeMax - item.rangeMin + 1 }, (_, i) => <span key={i} className="min-w-6 text-center">{item.rangeMin + i}</span>)}
        </div>}
      <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} /></div>
      <p className="text-center text-sm text-slate-400">{gesture
        ? 'Put the cards in order, or ask for help.' : 'Say your answer, or ask for help.'}</p>
    </LuminaCardContent>
  </LuminaCard>;
}
