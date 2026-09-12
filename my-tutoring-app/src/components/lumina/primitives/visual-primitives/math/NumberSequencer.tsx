'use client';

import React, { useMemo, useRef, useState } from 'react';
import { LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardContent, LuminaBadge } from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { NumberSequencerMetrics } from '../../../evaluation/types';
import { useJudgedScriptRunner, type JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import DiActionPanel from '../../../components/DiActionPanel';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import { buildSequencerItems, sequencerPackBase, sequencerOrderCue, type SequencerItem } from './numberSequencerScript';

const PHASE_TYPE_CONFIG = {
  'fill-missing': { label: 'Fill Missing', icon: '\uD83D\uDD22', accentColor: 'purple' },
  'before-after': { label: 'Before & After', icon: '\u2194\uFE0F', accentColor: 'blue' },
  'order-cards': { label: 'Order Cards', icon: '\uD83C\uDCCF', accentColor: 'amber' },
  'count-from': { label: 'Count From', icon: '\uD83D\uDE80', accentColor: 'emerald' },
  'spot-error': { label: 'Spot the Error', icon: '\uD83D\uDD0D', accentColor: 'pink' },
  'decade-fill': { label: 'Decade Fill', icon: '\uD83D\uDCAF', accentColor: 'cyan' },
} as const;

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


/** The train is the working surface. Voice fills one gap per judged turn;
 * ordering closes on stillness, including incomplete or incorrect arrangements. */
export default function NumberSequencer({ data, className }: { data: NumberSequencerData; className?: string }) {
  const { items, droppedChallenges } = useMemo(() => buildSequencerItems(data.challenges ?? []), [data.challenges]);
  const instance = useRef(data.instanceId ?? `number-sequencer-${Date.now()}`);
  const [affirmedOrder, setAffirmedOrder] = useState<number[]>([]);
  const [lastAffirmed, setLastAffirmed] = useState<SequencerItem | null>(null);
  const [placed, setPlaced] = useState<number[]>([]);
  const placedRef = useRef<number[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const evaluation = usePrimitiveEvaluation<NumberSequencerMetrics>({ primitiveType: 'number-sequencer',
    instanceId: instance.current, skillId: data.skillId, subskillId: data.subskillId,
    objectiveId: data.objectiveId, exhibitId: data.exhibitId, onSubmit: data.onEvaluationSubmit });
  const pack = useMemo<JudgedScriptPack<SequencerItem>>(() => ({ ...sequencerPackBase(items),
    diagnosisObservation: (item, { lastHeard }) => ({ challenge: item.actionContract.instruction,
      expected: item.answerKind === 'gesture' ? item.answerOrder.join(', ') : String(item.answer),
      observed: item.answerKind === 'gesture' ? placedRef.current.join(', ') : lastHeard ?? 'No intelligible number.' }),
  }), [items]);
  const finish = (summary: JudgedRunSummary) => {
    const scores = new Map(summary.outcomes.map(o => [o.id, o.score]));
    const accuracy = (type: NumberSequencerChallenge['type']) => {
      const group = items.filter(i => i.challengeType === type);
      return group.length ? Math.round(group.reduce((sum, i) => sum + (scores.get(i.id) ?? 0), 0) / group.length) : undefined;
    };
    evaluation.submitResult(summary.solvedCount === items.length, summary.accuracy,
      { type: 'number-sequencer', accuracy: summary.accuracy, attemptsCount: summary.attemptsCount,
        sequenceUnderstanding: summary.accuracy >= 80,
        fillMissingAccuracy: accuracy('fill-missing'), beforeAfterAccuracy: accuracy('before-after'),
        orderCardsAccuracy: accuracy('order-cards'), countFromAccuracy: accuracy('count-from'),
        spotErrorAccuracy: accuracy('spot-error'), decadeFillAccuracy: accuracy('decade-fill') },
      { interactionVersion: 'judged-number-train-v1', droppedChallenges, challengeResults: summary.outcomes.map(o => ({ ...o,
        sourceId: items.find(i => i.id === o.id)?.sourceId,
        viaVoice: items.find(i => i.id === o.id)?.answerKind === 'voice' })) }, undefined, summary.diagnosisEvidence);
  };
  const runner = useJudgedScriptRunner({ pack, instanceId: instance.current,
    gradeLevel: data.gradeBand === 'K' ? 'Kindergarten' : 'Grade 1', exhibitId: data.exhibitId,
    onFinished: finish,
    onItemOpened: (item, index) => {
      if (index === 0) setRevealed(new Set());
      if (item.answerKind === 'gesture') { placedRef.current = []; setPlaced([]); }
    },
    onAffirmed: item => { setAffirmedOrder([...placedRef.current]); setLastAffirmed(item); setRevealed(prev => new Set(Array.from(prev).concat(item.id))); },
  });
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (summaryItem) => PHASE_TYPE_CONFIG[summaryItem.challengeType]);
  }, [evaluation.hasSubmitted, runner.summary, items]);
  const item = runner.revealHeld && lastAffirmed ? lastAffirmed : runner.currentItem;
  const canArrange = !!item && item.answerKind === 'gesture' && runner.canAttempt && !runner.revealHeld;
  const changeOrder = (next: number[], sound: 'place' | 'remove') => {
    if (!item || !canArrange || runner.isAwaitingGesture()) return;
    if (sound === 'place') SoundManager.snap();
    else SoundManager.tap();
    placedRef.current = next; setPlaced(next);
    runner.armStillness(() => runner.submitGestureAttempt(sequencerOrderCue(item, placedRef.current)), 3000);
  };
  if (!item) return <LuminaCard className={className}><LuminaCardContent>
    <p>No usable number trains are available. Generate another activity.</p>
  </LuminaCardContent></LuminaCard>;
  const displayOrder = runner.revealHeld ? affirmedOrder : placed;
  const steps = items.filter(i => i.sourceId === item.sourceId);
  const shown = item.sequence.map((number, index) => {
    const step = steps.find(i => i.slot === index);
    return step && revealed.has(step.id) ? (step.repair ?? step.answer) : number;
  });
  const card = (value: number | null, index: number) => {
    const active = item.challengeType !== 'spot-error' && index === item.slot;
    return <div key={index} data-testid={`train-car-${index}`} aria-label={value === null ? (active ? 'Current missing number' : 'Missing number') : `Number ${value}`}
      className={`relative flex min-h-24 w-20 flex-col items-center justify-center gap-2 rounded-xl border-2 pb-3 text-3xl font-semibold ${active ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100' : 'border-slate-500/40 bg-slate-800/60 text-white'}`}>
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
      <LuminaCardTitle>Number Train</LuminaCardTitle><LuminaBadge accent="cyan">{data.gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}</LuminaBadge>
    </div></LuminaCardHeader>
    <LuminaCardContent className="space-y-6">
      {evaluation.hasSubmitted ? phaseResults.length > 0 && <PhaseSummaryPanel
        phases={phaseResults}
        overallScore={evaluation.submittedResult?.score}
        durationMs={evaluation.elapsedMs}
        heading="Sequence Complete!"
        celebrationMessage="You practiced each number sequence!"
        className="mt-4"
      /> : <>
        {item.answerKind === 'gesture' ? <section aria-label="Arrange number cards" className="space-y-5">
          <div className="flex flex-wrap justify-center gap-3" aria-label="Your number train">
            {item.answerOrder.map((_, index) => <button key={index} type="button" disabled={!canArrange || displayOrder[index] === undefined}
              onClick={() => changeOrder(placed.filter((_, n) => n !== index), 'remove')}
              aria-label={displayOrder[index] === undefined ? `Empty place ${index + 1}` : `Remove ${displayOrder[index]}`}
              className="min-h-20 min-w-16 rounded-xl border-2 border-dashed border-cyan-300/50 text-2xl text-cyan-100 disabled:cursor-default">
              {displayOrder[index] ?? '?'}
            </button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3" aria-label="Number cards">
            {item.sequence.filter((n): n is number => n !== null && !placed.includes(n)).map(n => <button key={n} type="button"
              disabled={!canArrange} onClick={() => changeOrder([...placed, n], 'place')} aria-label={`Place ${n}`}
              className="min-h-16 min-w-16 rounded-xl border border-purple-300/40 bg-purple-400/15 text-2xl text-purple-100 disabled:opacity-50">{n}</button>)}
          </div>
        </section> : <div className="flex flex-wrap justify-center gap-3 pb-3" aria-label="Number train">{shown.map(card)}</div>}
        {data.showNumberLine && item.answerKind !== 'gesture' && item.challengeType !== 'spot-error'
          && item.rangeMax - item.rangeMin <= 30 && <div aria-label="Number line reference" className="flex flex-wrap justify-center gap-2 border-t border-slate-600 pt-3 text-sm text-slate-400">
            {Array.from({ length: item.rangeMax - item.rangeMin + 1 }, (_, i) => <span key={i} className="min-w-6 text-center">{item.rangeMin + i}</span>)}
          </div>}
        <DiActionPanel run={runner} running={runner.running} stage={runner.stage} currentItem={item}
          steps={steps} completedIds={runner.solvedIds}
          carriedIds={new Set(items.filter((i, index) => index < runner.currentIndex && !runner.solvedIds.has(i.id)).map(i => i.id))}
          startInstruction="Start the tutor to work on your number train." />
        <button type="button" disabled={!runner.running} onClick={runner.hearStimulus}
          className="mx-auto block text-sm text-cyan-300 underline disabled:opacity-40">Hear the question again</button>
      </>}
    </LuminaCardContent>
  </LuminaCard>;
}
