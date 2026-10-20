'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  LuminaBadge,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaFeedbackCard,
  LuminaPanel,
  LuminaPrompt,
  answerStateClass,
  type AnswerChoiceState,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { AdditionFactStrategiesMetrics } from '../../../evaluation/types';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { additionFactMatches, additionFactMiss, additionFactScene, describeAdditionFactCheck } from './additionFactStrategiesWorkspace';
import {
  ADDITION_FACT_LEVERS, COUNT_LEVER, HOP_LEVER, KNOWN_LEVER, NEAR_LEVER, helpLevers, hopShape, nearDouble, startLevers,
} from './additionFactStrategiesLevers';
import { additionFactStrategiesBoss } from './additionFactStrategies.boss';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';

// ============================================================================
// Data types (single source of truth)
// ============================================================================

/** The fact family a session practises, in the order a learner meets them:
 *  +0 and +1, doubles, turn-around facts, +2, then the remaining facts in bands. */
export type AdditionFactStrategy =
  | 'plus_zero' | 'plus_one' | 'doubles' | 'turnaround' | 'plus_two'
  | 'facts_3_4' | 'facts_5_6' | 'facts_7_8' | 'facts_mixed';

export interface AdditionFactChallenge {
  id: string;
  /** The session's fact family, so a fact's type matches its eval mode's catalog `challengeTypes`. */
  type: AdditionFactStrategy;
  a: number;
  b: number;
  /** a + b, computed by the generator. */
  sum: number;
  /** Turn-around only: the flipped fact the learner already knows (b + a). Shown only as help after a miss. */
  knownFact?: { a: number; b: number };
  /** Calibration stamp from the add-sub-20 item space when a tier picked the fact. Never rendered or sent to the tutor. */
  itemSpace?: { space: string; structure: string; beta: number };
}

export interface AdditionFactStrategiesData {
  title: string;
  description: string;
  challengeType: 'recall';
  strategy: AdditionFactStrategy;
  /** The object drawn in the counting groups (one emoji). */
  objectEmoji: string;
  /** A worked example for the intro card. Never one of this session's facts, in either order. */
  introExample?: { a: number; b: number };
  challenges: AdditionFactChallenge[];
  gradeBand?: '1' | '2';
  /** config.difficulty: where the levers start (easy: the objects to count on screen); the generator also draws the tier's facts. */
  supportTier?: 'easy' | 'medium' | 'hard';

  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<AdditionFactStrategiesMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  recall: { label: 'Fact Recall', icon: '⭐', accentColor: 'amber' },
};

const STRATEGY_COPY: Record<AdditionFactStrategy, { name: string; intro: string; nudge: string }> = {
  plus_zero: {
    name: 'Adding Zero',
    intro: 'Zero means nothing at all. Adding zero keeps the number the same.',
    nudge: 'Adding zero adds nothing.',
  },
  plus_one: {
    name: 'Adding One',
    intro: 'Adding one is just the very next number. Say the first number, then one hop forward.',
    nudge: 'Start at the big number and say the very next number.',
  },
  doubles: {
    name: 'Doubles',
    intro: 'Doubles are when both numbers are the same, like the two wings of a butterfly.',
    nudge: 'Both groups are the same size. Count one group, then the other.',
  },
  turnaround: {
    name: 'Turn-Around Facts',
    intro: 'Flip a fact around and the answer stays the same. If you know one order, you know the other.',
    nudge: 'Flip it around. Do you know the other order?',
  },
  plus_two: {
    name: 'Adding Two',
    intro: 'Adding two is two little hops. Start at the first number, then hop, hop.',
    nudge: 'Start at the first number and hop forward two.',
  },
  facts_3_4: {
    name: 'The 3s and 4s',
    intro: 'These are bigger facts. Think, then tap. If you get stuck, we will count together, and that fact will come back so you can win it.',
    nudge: 'Use a fact you know, or count on from the bigger number.',
  },
  facts_5_6: {
    name: 'The 5s and 6s',
    intro: 'Next come the 5s and 6s. Think, then tap. A fact you miss will come back later.',
    nudge: 'Use a fact you know, or count on from the bigger number.',
  },
  facts_7_8: {
    name: 'The 7s and 8s',
    intro: 'Almost at the top: the 7s and 8s. There are only a few to learn.',
    nudge: 'Use a double you know, then add one more.',
  },
  facts_mixed: {
    name: 'Mixed Big Facts',
    intro: 'All the big facts, mixed together. Think, then tap.',
    nudge: 'Use a fact you know, or count on from the bigger number.',
  },
};

/** Every sum two single-digit addends can make. The pad never narrows to the answer's range. */
const ANSWER_PAD = Array.from({ length: 19 }, (_, i) => i);

/** Per-challenge score: first try 100, second 50, later tries 25. */
const scoreFor = (attempts: number) => (attempts <= 1 ? 100 : attempts === 2 ? 50 : 25);

// ============================================================================
// Representations (bespoke surface)
// ============================================================================

interface GroupProps {
  count: number;
  emoji: string;
  offset: number;
  counted: number[];
  onCount?: (index: number) => void;
  dots?: boolean;
}

/** One addend as a group of objects. Each object is tappable to count it. */
const CountGroup: React.FC<GroupProps> = ({ count, emoji, offset, counted, onCount, dots }) => {
  if (count === 0) {
    return (
      <div className="flex min-h-16 min-w-16 items-center justify-center rounded-2xl border-2 border-dashed border-white/20 px-4 text-sm font-semibold text-slate-400">
        empty
      </div>
    );
  }
  return (
    <div
      className="grid gap-2 rounded-2xl bg-white/5 p-3"
      style={{ gridTemplateColumns: `repeat(${Math.min(count, 5)}, minmax(0, auto))` }}
    >
      {Array.from({ length: count }, (_, i) => {
        const index = offset + i;
        const order = counted.indexOf(index);
        return (
          <button
            key={index}
            type="button"
            aria-label={order >= 0 ? `Counted ${order + 1}` : 'Count this one'}
            onClick={() => onCount?.(index)}
            disabled={!onCount}
            className={`relative select-none leading-none transition-transform ${order >= 0 ? 'scale-110' : ''} ${dots ? '' : 'text-3xl'}`}
          >
            {dots ? <span className="block h-5 w-5 rounded-full bg-fuchsia-400" /> : emoji}
            {order >= 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-white">
                {order + 1}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/** a + b drawn as two groups. Doubles draw as mirrored wings of dots. */
const FactGroups: React.FC<{
  a: number; b: number; emoji: string; counted: number[]; onCount?: (i: number) => void; wings?: boolean;
}> = ({ a, b, emoji, counted, onCount, wings }) => (
  <div className="flex flex-wrap items-center justify-center gap-3">
    <div className={wings ? 'rounded-l-[2.5rem] rounded-r-xl bg-pink-400/10 p-1' : ''}>
      <CountGroup count={a} emoji={emoji} offset={0} counted={counted} onCount={onCount} dots={wings} />
    </div>
    {wings ? <span className="h-20 w-2 rounded-full bg-slate-300/60" aria-hidden /> : <span className="text-3xl font-bold text-orange-400">+</span>}
    <div className={wings ? 'rounded-l-xl rounded-r-[2.5rem] bg-pink-400/10 p-1' : ''}>
      <CountGroup count={b} emoji={emoji} offset={a} counted={counted} onCount={onCount} dots={wings} />
    </div>
  </div>
);

/** Counting on: start at a, one hop per unit of b. Used only in the intro's worked example. */
const HopStrip: React.FC<{ a: number; b: number }> = ({ a, b }) => (
  <div className="flex items-end justify-center gap-1">
    {Array.from({ length: b + 1 }, (_, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span className="pb-3 text-2xl text-slate-500">›</span>}
        <div className="flex flex-col items-center gap-1">
          <span className={`text-2xl ${i === b ? '' : 'opacity-40'}`}>🐰</span>
          <span className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold ${i === 0 ? 'bg-white/10 text-slate-100' : 'bg-amber-300 text-slate-900'}`}>
            {a + i}
          </span>
        </div>
      </React.Fragment>
    ))}
  </div>
);

const FactLine: React.FC<{ a: number; b: number; showSum?: boolean; className?: string }> = ({ a, b, showSum = true, className }) => (
  <div className={`text-center text-3xl font-bold tracking-wide text-slate-100 ${className ?? ''}`}>
    {a} + {b} = <span className="text-emerald-400">{showSum ? a + b : '?'}</span>
  </div>
);

/** The intro's worked example, drawn in the strategy's own representation. */
const IntroExample: React.FC<{ strategy: AdditionFactStrategy; a: number; b: number; emoji: string }> = ({ strategy, a, b, emoji }) => {
  if (strategy === 'plus_one' || strategy === 'plus_two') {
    return <div className="space-y-4"><HopStrip a={a} b={b} /><FactLine a={a} b={b} /></div>;
  }
  if (strategy === 'turnaround') {
    return (
      <div className="flex flex-col items-center gap-3">
        <LuminaPanel className="px-6 py-3"><FactLine a={a} b={b} /></LuminaPanel>
        <span className="text-2xl" aria-hidden>🔄</span>
        <LuminaPanel accent="amber" className="px-6 py-3"><FactLine a={b} b={a} /></LuminaPanel>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <FactGroups a={a} b={b} emoji={emoji} counted={[]} wings={strategy === 'doubles'} />
      <FactLine a={a} b={b} />
    </div>
  );
};

// ============================================================================
// Lever renders (additionFactStrategiesLevers.ts owns what each may show)
// ============================================================================

/** `hop_strip`: the bigger addend, then blank hops; a hop shows its number only once tapped, in order. */
const LeverHops: React.FC<{ start: number; hops: number; tapped: number; onTap?: () => void }> = ({ start, hops, tapped, onTap }) => (
  <div data-lever="hop-strip" className="flex flex-wrap items-end justify-center gap-1">
    <div className="flex flex-col items-center gap-1">
      <span className="text-2xl opacity-40" aria-hidden>🐰</span>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold text-slate-100">{start}</span>
    </div>
    {Array.from({ length: hops }, (_, i) => {
      const shown = i < tapped;
      const next = i === tapped;
      return (
        <React.Fragment key={i}>
          <span className="pb-3 text-2xl text-slate-500" aria-hidden>›</span>
          <button
            type="button"
            aria-label={shown ? `Hop ${i + 1}: ${start + i + 1}` : 'Hop'}
            onClick={next ? onTap : undefined}
            disabled={!next || !onTap}
            className="flex flex-col items-center gap-1"
          >
            <span className={`text-2xl ${shown ? '' : 'opacity-40'}`} aria-hidden>🐰</span>
            <span data-lever="hop" className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold ${shown ? 'bg-amber-300 text-slate-900' : 'border-2 border-dashed border-amber-300/50 text-transparent'}`}>
              {shown ? start + i + 1 : '·'}
            </span>
          </button>
        </React.Fragment>
      );
    })}
  </div>
);

/** `near_double`: the double as two equal rows of dots, the extra dots apart. No total anywhere. */
const LeverNearDouble: React.FC<{ double: number; extra: number }> = ({ double, extra }) => (
  <div data-lever="near-double" className="flex flex-col items-center gap-3">
    <div className="flex items-center gap-4">
      <div className="space-y-2">
        {[0, 1].map((row) => (
          <div key={row} className="flex gap-1.5">
            {Array.from({ length: double }, (_, i) => <span key={i} data-lever-dot="double" className="block h-5 w-5 rounded-full bg-fuchsia-400" />)}
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 rounded-xl border border-dashed border-amber-300/60 p-2">
        {Array.from({ length: extra }, (_, i) => <span key={i} data-lever-dot="extra" className="block h-5 w-5 rounded-full bg-amber-300" />)}
      </div>
    </div>
    <p className="text-lg font-semibold text-slate-200">{double} + {double} and {extra === 1 ? 'one more' : 'two more'}</p>
  </div>
);

// ============================================================================
// Component
// ============================================================================

interface AdditionFactStrategiesProps {
  data: AdditionFactStrategiesData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

const useAdditionFactProgress = useWorkspaceProgressFor('addition-fact-strategies');

function AdditionFactStrategiesSurface({ data, className, runtimePlanItemId }: AdditionFactStrategiesProps) {
  const challenges = data.challenges ?? [];
  const strategy = data.strategy;
  const copy = STRATEGY_COPY[strategy] ?? STRATEGY_COPY.facts_mixed;
  const instanceId = useRef(data.instanceId ?? `addition-fact-strategies-${Math.random().toString(36).slice(2)}`).current;
  const workspace = useRef<TeachingWorkspace | null>(null);
  /** Bound after the state it clears is declared; the progress hook calls it only after render. */
  const reopen = useRef<(retry: boolean) => void>(() => {});
  /** Bound below; a spoken answer the observer credited (`onSolved`). */
  const solvedAloud = useRef<(index: number) => void>(() => {});
  /** Bound below; an answer the observer credited on the simplify lever's practice item. */
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});

  // ── Progress: the teaching workspace owns it ───────────────────
  const progress = useAdditionFactProgress({
    challenges, getChallengeId: (challenge) => challenge.id,
    instanceId, objectiveId: data.objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: additionFactStrategiesBoss.assignment,
    onItemOpened: (_index, retry) => reopen.current(retry),
    onSolved: (index) => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
  });
  const { currentIndex, currentAttempts, results, isComplete, recordResult } = progress;
  const canAttempt = progress.canAttempt !== false;
  const sessionItem = challenges[currentIndex] ?? null;

  // ── Levers (additionFactStrategiesLevers.ts), keyed by the session item they were pulled on; the smaller
  //    fact a simplify lever put on screen in its place (ungraded) ──
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<AdditionFactChallenge | null>(null);
  const [practiceSolved, setPracticeSolved] = useState(false);
  /** What is on screen: the smaller fact while a simplify lever holds it, else the session item. */
  const item = practice ?? sessionItem;
  const pulledLevers = leverState.item === sessionItem?.id ? leverState.pulled : startLevers(data.supportTier, sessionItem);

  // ── Per-item state ─────────────────────────────────────────────
  const [wrong, setWrong] = useState<number[]>([]);
  const [counted, setCounted] = useState<number[]>([]);
  const [tappedHops, setTappedHops] = useState(0);
  const firstResponseMsRef = useRef<number[]>([]);
  const openedAt = useRef(Date.now());
  useEffect(() => { openedAt.current = Date.now(); }, [item?.id]);

  // A fresh fact starts clean; Try again clears the rejected taps and keeps the levers and the smaller fact.
  reopen.current = (retry) => {
    if (!retry) { setPractice(null); setCounted([]); setTappedHops(0); }
    setPracticeSolved(false);
    setWrong([]);
  };

  const solved = practice ? practiceSolved : !!item && results.some((r) => r.challengeId === item.id && r.correct);
  /** Learner input is closed while a checked answer waits for Try again, and once the fact is solved. */
  const learnerBlocked = () => !canAttempt || solved || isComplete || !item;

  // ── Evaluation ─────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<AdditionFactStrategiesMetrics>({
    primitiveType: 'addition-fact-strategies', instanceId, skillId: data.skillId,
    subskillId: data.subskillId, objectiveId: data.objectiveId, exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const phaseResults = usePhaseResults({
    challenges, results, isComplete,
    // One phase: every fact in a session is the same family.
    getChallengeType: () => data.challengeType,
    phaseConfig: PHASE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((sum, r) => sum + (r.score ?? 0), 0) / Math.max(rs.length, 1)),
  });

  // The levers act on the item on screen; on the smaller fact they keep the session item's pulls.
  const leverOn = (id: string) => pulledLevers.includes(id) && !!item && helpLevers(item).includes(id);
  const countObject = (index: number) => {
    if (learnerBlocked()) return;
    setCounted((c) => (c.includes(index) ? c : [...c, index]));
    SoundManager.pop();
  };
  const tapHop = () => {
    if (learnerBlocked()) return;
    setTappedHops((n) => n + 1);
    SoundManager.pop();
  };

  // ── The activity's check: every tap is checked and committed; the runtime advances ──
  const answer = (value: number) => {
    if (!item || learnerBlocked() || wrong.includes(value)) return;
    const correct = additionFactMatches(item, value);
    if (practice) {
      // The smaller fact is ungraded: no result, no metric; the workspace records it as practice.
      if (correct) { SoundManager.playCorrect(); setPracticeSolved(true); }
      else { SoundManager.playIncorrect(); setWrong((w) => [...w, value]); }
      progress.commitCheck(describeAdditionFactCheck(value), correct, additionFactMiss(item, value));
      return;
    }
    if (currentAttempts === 0) firstResponseMsRef.current.push(Date.now() - openedAt.current);
    if (correct) {
      tappedCorrect.current = item.id;
      SoundManager.playCorrect();
      const attempts = currentAttempts + 1;
      recordResult({ challengeId: item.id, correct: true, attempts, score: scoreFor(attempts), a: item.a, b: item.b });
    } else {
      SoundManager.playIncorrect();
      setWrong((w) => [...w, value]);
    }
    progress.commitCheck(describeAdditionFactCheck(value), correct, additionFactMiss(item, value));
  };

  // A spoken answer the observer credited (`onSolved` fires once per fact, for a tap too): the result a correct tap
  // records, so the slot shows the sum. The shared lifecycle plays the success sound.
  const tappedCorrect = useRef<string | null>(null);
  solvedAloud.current = (index) => {
    const solvedFact = challenges[index];
    if (!solvedFact || tappedCorrect.current === solvedFact.id) return;
    if (currentAttempts === 0) firstResponseMsRef.current.push(Date.now() - openedAt.current);
    const attempts = currentAttempts + 1;
    progress.mergeResult({ challengeId: solvedFact.id, correct: true, attempts, score: scoreFor(attempts), a: solvedFact.a, b: solvedFact.b });
  };

  // A spoken answer credited on the practice item: shown there as on a session item, recorded nowhere. The full item
  // comes back blank when the practice closes. A tap shows its own credit in the check.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice) return;
    setPracticeSolved(true);
  };

  // ── Completion: once every fact is solved, submit once (only under an evaluation provider) ──
  const submittedRef = useRef(false);
  useEffect(() => {
    if (!isComplete || evaluation.hasSubmitted || submittedRef.current || challenges.length === 0) return;
    // The live host has no evaluation provider; a workspace family submits only under one.
    if (progress.recordsEvaluation === false) return;
    submittedRef.current = true;
    const correctCount = results.filter((r) => r.correct).length;
    const attemptsCount = results.reduce((sum, r) => sum + r.attempts, 0);
    const firstTryCount = results.filter((r) => r.correct && r.attempts === 1).length;
    const overallAccuracy = Math.round(results.reduce((sum, r) => sum + (r.score ?? 0), 0) / challenges.length);
    const times = firstResponseMsRef.current;
    const metrics: AdditionFactStrategiesMetrics = {
      type: 'addition-fact-strategies',
      challengeType: 'recall',
      totalChallenges: challenges.length,
      correctCount,
      attemptsCount,
      firstTryCount,
      hintsViewed: results.filter((r) => r.attempts > 1).length,
      overallAccuracy,
      averageAttemptsPerChallenge: attemptsCount / challenges.length,
      strategy,
      averageFirstResponseMs: times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : 0,
    };
    // Success is every fact solved; the first-response gate scores how many were right first time.
    evaluation.submitResult(correctCount === challenges.length, overallAccuracy, metrics, {
      strategy, facts: results.map((r) => ({ fact: `${r.a} + ${r.b}`, attempts: r.attempts })),
    });
  }, [isComplete, evaluation, challenges.length, results, strategy, progress.recordsEvaluation]);

  // The worked example sits beside the first fact only; it is never one of the session's facts.
  const example = currentIndex === 0 && !practice ? data.introExample : undefined;

  // What the tutor and the observer are shown, republished every render.
  useLayoutEffect(() => {
    if (!item) return;
    const leverCtx = { session: challenges };
    const levers = practice || !sessionItem ? [] : ADDITION_FACT_LEVERS.declare(sessionItem, leverCtx, pulledLevers);
    // On the smaller fact the session item's pulls stay drawn, so the scene names what is drawn on it.
    const onScreen = ADDITION_FACT_LEVERS.onScreen(item, leverCtx, pulledLevers);
    workspace.current = {
      ...leverScene(additionFactScene(item, { strategy, example }), { support: '', onScreen }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !sessionItem || !lever) return `No lever ${id} on this fact.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const pulled = { item: sessionItem.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const smaller = ADDITION_FACT_LEVERS.simpler(sessionItem, leverCtx, id);
          if (!smaller) return 'There is no smaller fact for this one.';
          setLeverState(pulled);
          reopen.current(true); setCounted([]); setTappedHops(0); setPractice(smaller);
          return { practice: additionFactStrategiesBoss.assignment(smaller) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { reopen.current(false); },
    };
  });

  const overallScore = evaluation.submittedResult?.score ?? (results.length
    ? Math.round(results.reduce((sum, r) => sum + (r.score ?? 0), 0) / Math.max(challenges.length, 1)) : 0);

  const tileState = (value: number): AnswerChoiceState => {
    if (solved && item && value === item.sum) return 'correct';
    if (wrong.includes(value)) return 'incorrect';
    return solved ? 'dimmed' : 'idle';
  };

  const hop = item && leverOn(HOP_LEVER) ? hopShape(item) : null;
  const near = item && leverOn(NEAR_LEVER) ? nearDouble(item) : null;
  const missShown = !canAttempt && !solved;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LuminaCardTitle>{data.title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="amber">{copy.name}</LuminaBadge>
            {!isComplete && challenges.length > 0 && (
              <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} variant="dots" />
            )}
          </div>
        </div>
        <p className="text-sm text-slate-400">{data.description}</p>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {challenges.length === 0 && <p className="py-8 text-center text-slate-400">No facts loaded.</p>}

        {isComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? overallScore}
            durationMs={evaluation.elapsedMs}
            heading={`${copy.name} Complete!`}
            celebrationMessage={`${results.filter((r) => r.attempts === 1).length} of ${challenges.length} facts right on the first try.`}
          />
        )}

        {/* The strategy, shown beside the first fact on a worked example the session never asks. */}
        {example && !isComplete && (
          <div className="space-y-3">
            <LuminaPrompt>{copy.intro}</LuminaPrompt>
            <LuminaPanel className="py-4">
              <IntroExample strategy={strategy} a={example.a} b={example.b} emoji={data.objectEmoji} />
            </LuminaPanel>
          </div>
        )}

        {item && !isComplete && (
          <>
            {practice && (
              <div className="flex justify-center"><LuminaBadge accent="purple">A smaller fact first</LuminaBadge></div>
            )}

            {/* The fact. The slot stays "?" until the child answers it. */}
            <div data-fact className="flex items-center justify-center gap-3 text-6xl font-bold text-slate-100" aria-live="polite">
              <span>{item.a}</span>
              <span className="text-orange-400">+</span>
              <span>{item.b}</span>
              <span className="text-orange-400">=</span>
              <span className={`min-w-[1.4em] rounded-2xl px-3 py-1 text-center ${solved ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-400 ring-4 ring-inset ring-amber-300/70'}`}>
                {solved ? item.sum : '?'}
              </span>
            </div>

            {/* The help levers pulled on this fact. */}
            {leverOn(KNOWN_LEVER) && item.knownFact && (
              <LuminaPanel data-lever="known-fact" accent="amber" className="mx-auto max-w-sm text-center">
                <p className="text-sm text-slate-300">You know the flipped fact:</p>
                <FactLine a={item.knownFact.a} b={item.knownFact.b} />
              </LuminaPanel>
            )}
            {near && <LuminaPanel className="py-4"><LeverNearDouble double={near.double} extra={near.extra} /></LuminaPanel>}
            {hop && (
              <LuminaPanel className="py-4">
                <LeverHops start={hop.start} hops={hop.hops} tapped={tappedHops} onTap={solved ? undefined : tapHop} />
              </LuminaPanel>
            )}
            {leverOn(COUNT_LEVER) && (
              <LuminaPanel data-lever="count-groups" className="py-4">
                <FactGroups
                  a={item.a} b={item.b} emoji={data.objectEmoji} counted={counted}
                  onCount={solved ? undefined : countObject}
                  wings={strategy === 'doubles'}
                />
              </LuminaPanel>
            )}

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock between the fact and the pad, so an
                outline of the pad never crosses the fact; the pad as one region, never a single number. */}
            <PipDock />

            <PipWorkspace className="mx-auto grid max-w-xl grid-cols-5 gap-2 sm:grid-cols-10">
              {ANSWER_PAD.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`Answer ${value}`}
                  onClick={() => answer(value)}
                  disabled={solved || !canAttempt || wrong.includes(value)}
                  className={`h-12 rounded-xl border text-xl font-bold transition-all ${answerStateClass(tileState(value))}`}
                >
                  {value}
                </button>
              ))}
            </PipWorkspace>

            {missShown && (
              <LuminaFeedbackCard status="incorrect" label="Not yet">{copy.nudge}</LuminaFeedbackCard>
            )}
            {solved && (
              <LuminaFeedbackCard status="correct" label={practice ? 'Nice!' : currentAttempts <= 1 ? 'You knew it!' : 'You got it!'}>
                {item.a} + {item.b} = {item.sum}
              </LuminaFeedbackCard>
            )}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const AdditionFactStrategies = withWorkspaceOnly<AdditionFactStrategiesProps>(
  'addition-fact-strategies', AdditionFactStrategiesSurface, (props) => props.data.title,
);

export default AdditionFactStrategies;
