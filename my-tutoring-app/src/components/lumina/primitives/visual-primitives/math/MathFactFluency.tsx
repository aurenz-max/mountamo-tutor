'use client';

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPrompt,
  LuminaButton,
  LuminaActionButton,
  answerStateClass,
  type AnswerChoiceState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { MathFactFluencyMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  describeMathFactCheck, formatMathFact, mathFactMatches, mathFactMiss, mathFactScene, type MathFactResponse,
} from './mathFactFluencyWorkspace';
import {
  DOTS_LEVER, FLUENCY_LEVERS, MARKS_LEVER, PARTS_LEVER, WHOLE_LEVER, factModel, helpLevers, startLevers,
} from './mathFactFluencyLevers';
import { mathFactFluencyBoss } from './mathFactFluency.boss';
import type { StepSegment } from '../../../components/live-activity/runtime/contract';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface MathFactFluencyChallenge {
  id: string;
  type: 'visual-fact' | 'equation-solve' | 'missing-number' | 'match' | 'speed-round';
  instruction: string;
  equation: string;                // "3 + 2 = 5"
  operation: 'addition' | 'subtraction';
  operand1: number;
  operand2: number;
  result: number;
  unknownPosition: 'result' | 'operand1' | 'operand2';
  correctAnswer: number;
  // visual-fact & match
  visualType?: 'dot-array' | 'fingers' | 'ten-frame' | 'objects';
  visualCount?: number;
  // equation-solve & speed-round
  options?: number[];
  // match
  matchDirection?: 'visual-to-equation' | 'equation-to-visual';
  equationOptions?: string[];
  visualOptions?: Array<{ type: string; count: number }>;
  // Within-mode support tier ('easy' | 'medium' | 'hard'), set by the generator when
  // the manifest emits config.difficulty. Read by the live tutor to calibrate reveal.
  supportTier?: 'easy' | 'medium' | 'hard';
  /** Item-space calibration stamp (a tier on a fitting strand): never rendered or sent to the tutor. */
  itemSpace?: { space: string; structure: string; beta: number };
}

export interface MathFactFluencyData {
  title: string;
  description?: string;
  challenges: MathFactFluencyChallenge[];
  maxNumber: number;               // driven by lesson scope: 5, 10, or 20
  includeSubtraction: boolean;
  showVisualAids: boolean;
  // Goal response time in seconds, used ONLY as a silent automaticity signal for
  // analytics/IRT. Never surfaced to the student and never enforced as a deadline.
  targetResponseTime: number;
  adaptiveDifficulty: boolean;
  gradeBand: 'K' | '1' | '2';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MathFactFluencyMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'visual-fact':    { label: 'Visual Fact',    icon: '👁️', accentColor: 'purple' },
  'equation-solve': { label: 'Equation Solve', icon: '💡',       accentColor: 'blue' },
  'missing-number': { label: 'Missing Number', icon: '❓',             accentColor: 'amber' },
  'match':          { label: 'Match',          icon: '🔗',       accentColor: 'emerald' },
  'speed-round':    { label: 'Rapid Recall',   icon: '🎯',             accentColor: 'orange' },
};

// ============================================================================
// Visual Renderers
// ============================================================================

/** Render a dot array in a 5-frame layout */
function DotArray({ count, size = 120 }: { count: number; size?: number }) {
  const cols = 5;
  const rows = Math.ceil(count / cols);
  const dotR = Math.min(size / (cols * 2.5), 10);
  const gapX = size / cols;
  const gapY = Math.min(size / (rows + 1), gapX);

  return (
    <svg width={size} height={rows * gapY + dotR * 2} className="mx-auto">
      {Array.from({ length: count }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return (
          <circle
            key={i}
            cx={gapX / 2 + col * gapX}
            cy={dotR + gapY / 2 + row * gapY}
            r={dotR}
            className="fill-blue-400"
          />
        );
      })}
    </svg>
  );
}

/** Render a mini ten-frame. Grows to a DOUBLE ten-frame (20 cells) when the count
 *  exceeds 10 so within-20 facts render honestly instead of overflowing a single frame. */
function TenFrameVisual({ count, size = 140 }: { count: number; size?: number }) {
  const frames = count > 10 ? 2 : 1;
  const cellCount = frames * 10;
  const cellW = size / 5;
  const cellH = cellW * 0.8;
  const frameGap = 6;
  const totalH = cellH * 2 * frames + frameGap * (frames - 1);

  return (
    <svg width={size} height={totalH + 4} className="mx-auto">
      {/* Grid — one 5×2 frame per 10, stacked vertically */}
      {Array.from({ length: cellCount }, (_, i) => {
        const frame = Math.floor(i / 10);
        const within = i % 10;
        const col = within % 5;
        const row = Math.floor(within / 5);
        const y = frame * (cellH * 2 + frameGap) + row * cellH;
        const filled = i < count;
        return (
          <g key={i}>
            <rect
              x={col * cellW + 1}
              y={y + 1}
              width={cellW - 2}
              height={cellH - 2}
              rx={3}
              className={filled ? 'fill-blue-500/30 stroke-blue-400/60' : 'fill-white/5 stroke-white/10'}
              strokeWidth={1}
            />
            {filled && (
              <circle
                cx={col * cellW + cellW / 2}
                cy={y + cellH / 2}
                r={Math.min(cellW, cellH) / 3}
                className="fill-blue-400"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Render finger count image */
function FingerVisual({ count }: { count: number }) {
  // Show finger emoji representation
  const fingerEmojis: Record<number, string> = {
    0: '✊', 1: '☝️', 2: '✌️', 3: '🤞',
    4: '🖐️', 5: '🖐️',
  };
  const safeCount = Math.min(count, 10);
  const leftHand = Math.min(safeCount, 5);
  const rightHand = safeCount - leftHand;

  return (
    <div className="flex items-center justify-center gap-4 text-4xl select-none">
      <span>{fingerEmojis[leftHand] || '🖐️'}</span>
      {rightHand > 0 && <span>{fingerEmojis[rightHand] || '🖐️'}</span>}
    </div>
  );
}

/** Choose and render the correct visual aid */
function VisualAid({ type, count }: { type?: string; count: number }) {
  switch (type) {
    case 'ten-frame':
      return <TenFrameVisual count={count} />;
    case 'fingers':
      return <FingerVisual count={count} />;
    case 'dot-array':
    default:
      return <DotArray count={count} />;
  }
}

// ============================================================================
// Match Visual Option (small inline visual for match challenges)
// ============================================================================

function MatchVisualOption({ type, count }: { type: string; count: number }) {
  if (type === 'ten-frame') return <TenFrameVisual count={count} size={80} />;
  return <DotArray count={count} size={80} />;
}

// ============================================================================
// Lever dots (`mathFactFluencyLevers.ts`)
// ============================================================================

const DOT_TONE: Record<StepSegment['tone'], string> = {
  plain: 'bg-blue-400 border-blue-300',
  added: 'bg-amber-400 border-amber-300',
  marked: 'bg-blue-400 border-blue-300',
  empty: 'bg-transparent border-dashed border-slate-300',
  crossed: 'bg-slate-500/60 border-slate-400',
};

/**
 * A lever's dots in rows of five: the fact model (`two_parts`, `fact_dots`, `part_whole`) or the picture made
 * tappable (`count_marks`). No numeral is drawn, except the running count on a dot the learner tapped.
 */
function LeverDots({ lever, segments, tapped, onTap }: {
  lever: string; segments: StepSegment[]; tapped?: number[]; onTap?: (index: number) => void;
}) {
  const dots = segments.flatMap(s => Array.from({ length: Math.max(s.count, 0) }, () => s.tone));
  return (
    <div data-lever={lever} className="mx-auto grid w-fit grid-cols-5 gap-2 py-2">
      {dots.map((tone, i) => {
        const stamp = tapped ? tapped.indexOf(i) + 1 : 0;
        const cls = `relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold text-slate-900 ${DOT_TONE[tone]}`;
        const mark = tone === 'crossed' && <span aria-hidden className="absolute text-lg leading-none text-red-300">✕</span>;
        return onTap ? (
          <button key={i} type="button" data-lever-dot={tone} aria-label="dot" className={cls} onClick={() => onTap(i)}>
            {mark}{stamp > 0 && <span data-lever="tap-number">{stamp}</span>}
          </button>
        ) : <span key={i} data-lever-dot={tone} className={cls}>{mark}</span>;
      })}
    </div>
  );
}

// ============================================================================
// Props
// ============================================================================

interface MathFactFluencyProps {
  data: MathFactFluencyData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

const useMathFactProgress = useWorkspaceProgressFor('math-fact-fluency');

// ============================================================================
// Component
// ============================================================================

function MathFactFluencySurface({ data, className, runtimePlanItemId }: MathFactFluencyProps) {
  const {
    title,
    description,
    challenges = [],
    maxNumber = 5,
    gradeBand = 'K',
    targetResponseTime = 3,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceIdRef = useRef(instanceId || `math-fact-fluency-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  /** Bound after the state it clears is declared; the progress hook calls it only after render. */
  const reopen = useRef<(retry: boolean) => void>(() => {});
  /** Bound below: records a fact the learner answered aloud and the tutor's feedback credited. */
  const solvedAloud = useRef<(index: number) => void>(() => {});
  /** Bound below; an answer the observer credited on the simplify lever's practice item. */
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});

  // -------------------------------------------------------------------------
  // Challenge progress: the teaching workspace owns it
  // -------------------------------------------------------------------------
  const progress = useMathFactProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: mathFactFluencyBoss.assignment,
    onItemOpened: (_index, retry) => reopen.current(retry),
    onSolved: index => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
  } = progress;
  const canAttempt = progress.canAttempt !== false;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  const sessionChallenge = challenges[currentChallengeIndex] ?? null;

  // -------------------------------------------------------------------------
  // Local state
  // -------------------------------------------------------------------------
  // In-item levers (`mathFactFluencyLevers.ts`), keyed by the session item they were pulled on; the easier fact a
  // simplify lever put on screen in its place (ungraded); and, under `count_marks`, the dots tapped, in order.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<MathFactFluencyChallenge | null>(null);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [tapped, setTapped] = useState<number[]>([]);
  /** What is on screen: the easier fact while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : startLevers(sessionChallenge);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [selectedEquation, setSelectedEquation] = useState<string | null>(null);
  const [selectedVisualIdx, setSelectedVisualIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // Streak and accuracy across every checked answer.
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [responseTimes, setResponseTimes] = useState<number[]>([]);

  // Response time is measured SILENTLY for the automaticity metric, from when the fact opened. There
  // is no countdown and no deadline; nothing advances or grades on it, and the learner never sees it.
  const openedAt = useRef(Date.now());
  useEffect(() => { openedAt.current = Date.now(); }, [currentChallenge?.id]);

  // A fresh fact starts clean; Try again clears the rejected answer (an easier practice fact stays).
  reopen.current = (retry) => {
    if (!retry) setPractice(null);
    setPracticeSolved(false);
    setTapped([]);
    setSelectedAnswer(null);
    setTypedAnswer('');
    setSelectedEquation(null);
    setSelectedVisualIdx(null);
    setFeedback('');
    setFeedbackType('');
  };

  const currentSolved = practice ? practiceSolved
    : challengeResults.some(r => r.challengeId === currentChallenge?.id && r.correct);
  /** Learner input is closed while a checked answer waits for Try again, and once the fact is solved. */
  const learnerBlocked = () => !canAttempt || currentSolved || allChallengesComplete || !currentChallenge;
  /** A checked miss waiting for Try again: the rejected choice shows as wrong, never the right one. */
  const missShown = !canAttempt && !currentSolved;

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<MathFactFluencyMetrics>({
    primitiveType: 'math-fact-fluency',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 100;

  // -------------------------------------------------------------------------
  // The activity's check: every answer is checked and committed; the runtime advances
  // -------------------------------------------------------------------------
  const check = (response: MathFactResponse) => {
    if (!currentChallenge || learnerBlocked()) return;
    const correct = mathFactMatches(currentChallenge, response);
    if (practice) {
      // An easier practice fact is ungraded: no streak, no metric, no result; the workspace records it as practice.
      if (correct) { SoundManager.playCorrect(); setPracticeSolved(true); setFeedback('Correct!'); setFeedbackType('success'); }
      else { SoundManager.playIncorrect(); setFeedback('Not quite.'); setFeedbackType('error'); }
      progress.commitCheck(describeMathFactCheck(currentChallenge, response), correct, mathFactMiss(currentChallenge, response));
      return;
    }
    const responseTime = Date.now() - openedAt.current;
    const responseTimeSec = responseTime / 1000;
    if (correct) checkedCorrect.current = currentChallenge.id;

    setTotalAnswered(prev => prev + 1);
    setResponseTimes(prev => [...prev, responseTimeSec]);

    if (correct) {
      SoundManager.playCorrect();
      setTotalCorrect(prev => prev + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      setFeedback('Correct!');
      setFeedbackType('success');
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        timeMs: responseTime,
        responseTimeSec,
        // A SILENT automaticity signal for the metric, never shown or praised.
        isFast: currentAttempts === 0 && responseTimeSec <= targetResponseTime,
        streak: newStreak,
      });
    } else {
      SoundManager.playIncorrect();
      setStreak(0);
      setFeedback('Not quite.');
      setFeedbackType('error');
    }
    progress.commitCheck(describeMathFactCheck(currentChallenge, response), correct, mathFactMiss(currentChallenge, response));
  };

  // A spoken answer the observer credited (`onSolved` fires once per fact, for a tap too): the same books as a
  // correct tap, which `check` already kept.
  const checkedCorrect = useRef<string | null>(null);
  solvedAloud.current = (index) => {
    const solved = challenges[index];
    if (!solved || checkedCorrect.current === solved.id) return;
    const responseTime = Date.now() - openedAt.current;
    const responseTimeSec = responseTime / 1000;
    const newStreak = streak + 1;
    setTotalAnswered(prev => prev + 1);
    setTotalCorrect(prev => prev + 1);
    setResponseTimes(prev => [...prev, responseTimeSec]);
    setStreak(newStreak);
    if (newStreak > bestStreak) setBestStreak(newStreak);
    setFeedback('Correct!');
    setFeedbackType('success');
    if (solved.options?.includes(solved.correctAnswer)) setSelectedAnswer(solved.correctAnswer);
    else setTypedAnswer(String(solved.correctAnswer));
    recordResult({
      challengeId: solved.id, correct: true, attempts: currentAttempts + 1, timeMs: responseTime, responseTimeSec,
      isFast: currentAttempts === 0 && responseTimeSec <= targetResponseTime, streak: newStreak,
    });
  };

  // A spoken answer credited on the practice item: shown there as on a session item, recorded nowhere. The full item
  // comes back blank when the practice closes. A tap shows its own credit in the check.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice) return;
    setPracticeSolved(true);
    setFeedback('Correct!'); setFeedbackType('success');
    if (practice.options?.includes(practice.correctAnswer)) setSelectedAnswer(practice.correctAnswer);
    else setTypedAnswer(String(practice.correctAnswer));
  };

  const handleSelectOption = (value: number) => {
    if (learnerBlocked()) return;
    setSelectedAnswer(value);
    check({ kind: 'number', value });
  };

  const handleSelectEquation = (eq: string) => {
    if (learnerBlocked()) return;
    setSelectedEquation(eq);
    check({ kind: 'equation', value: eq });
  };

  const handleSelectVisual = (idx: number) => {
    if (learnerBlocked()) return;
    setSelectedVisualIdx(idx);
    check({ kind: 'picture', index: idx });
  };

  const handleTypedSubmit = () => {
    const parsed = parseInt(typedAnswer, 10);
    if (isNaN(parsed) || learnerBlocked()) return;
    check({ kind: 'number', value: parsed });
  };

  // -------------------------------------------------------------------------
  // Completion: once every fact is solved, submit once (only under an evaluation provider)
  // -------------------------------------------------------------------------
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation || hasAutoSubmittedRef.current) return;
    // The live host has no evaluation provider; a workspace family submits only under one.
    if (progress.recordsEvaluation === false) return;
    hasAutoSubmittedRef.current = true;
    const correctCount = challengeResults.filter(r => r.correct).length;
    const score = Math.round((correctCount / Math.max(challenges.length, 1)) * 100);
    const fastCount = challengeResults.filter(r => (r.isFast as boolean)).length;
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
    // First-try accuracy by operation: 100% on + and 50% on - has not met a mixed-set objective.
    const firstTry = (op: 'addition' | 'subtraction') => {
      const ids = new Set(challenges.filter(c => c.operation === op).map(c => c.id));
      const mine = challengeResults.filter(r => ids.has(r.challengeId));
      return { total: ids.size, firstTry: mine.filter(r => r.correct && r.attempts === 1).length };
    };
    const add = firstTry('addition'), sub = firstTry('subtraction');
    const metrics: MathFactFluencyMetrics = {
      type: 'math-fact-fluency',
      accuracy: score,
      additionFirstTry: add.firstTry, additionTotal: add.total,
      subtractionFirstTry: sub.firstTry, subtractionTotal: sub.total,
      averageResponseTime: Math.round(avgResponseTime * 1000),
      fastAnswerCount: fastCount,
      bestStreak,
      attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
      factsWithinTarget: fastCount,
      factsTotal: challenges.length,
    };
    submitEvaluation(correctCount === challenges.length, score, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmittedEvaluation, progress.recordsEvaluation, challengeResults, challenges.length,
    responseTimes, bestStreak, submitEvaluation, challenges]);

  // What the tutor and the observer are shown, republished every render. Derived from the challenge
  // alone, so opening an item adds no revision after the advance.
  useLayoutEffect(() => {
    if (!currentChallenge) return;
    const leverCtx = { maxNumber };
    const levers = practice || !sessionChallenge ? [] : FLUENCY_LEVERS.declare(sessionChallenge, leverCtx, pulledLevers);
    // On the easier fact the session item's pulls stay drawn, so the scene names what is drawn on it.
    const onScreen = FLUENCY_LEVERS.onScreen(currentChallenge, leverCtx, pulledLevers);
    workspace.current = {
      ...leverScene(mathFactScene(currentChallenge, { maxNumber }), { support: '', onScreen }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !sessionChallenge || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = FLUENCY_LEVERS.simpler(sessionChallenge, leverCtx, id);
          if (!easier) return 'There is no easier fact for this one.';
          setLeverState(pulled);
          reopen.current(true); setPractice(easier);
          return { practice: mathFactFluencyBoss.assignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { reopen.current(false); },
    };
  });

  // -------------------------------------------------------------------------
  // Overall Score
  // -------------------------------------------------------------------------
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  // Grading-state color language for the answerable options comes from the kit
  // tokens (answerStateClass). A solved choice shows as correct; a checked miss shows
  // the rejected choice as incorrect and never marks the right one.
  const choiceState = (isSelected: boolean): AnswerChoiceState => !isSelected ? 'idle'
    : currentSolved ? 'correct' : missShown ? 'incorrect' : 'selected';
  const inputClosed = currentSolved || allChallengesComplete || !canAttempt;

  // The levers on screen for this fact (pulled on the session item, or its starting position).
  const leverOn = (id: string) => pulledLevers.includes(id) && !!currentChallenge && helpLevers(currentChallenge).includes(id);
  const modelUnderFact = !currentChallenge ? null
    : (currentChallenge.type === 'equation-solve' || currentChallenge.type === 'match') && leverOn(DOTS_LEVER) ? 'fact-dots'
      : currentChallenge.type === 'missing-number' && leverOn(WHOLE_LEVER) ? 'part-whole' : null;
  /**
   * The picture the fact is read from: as drawn, or redrawn by `two_parts` / `count_marks`. Hands cannot be tapped
   * or split, so on a fingers picture the lever's dots are drawn under the hands.
   */
  const renderPicture = (type: string) => {
    const c = currentChallenge!;
    const count = c.visualCount ?? c.correctAnswer;
    const parts = c.type === 'visual-fact' && leverOn(PARTS_LEVER);
    const marks = leverOn(MARKS_LEVER);
    if (!parts && !marks) return <VisualAid type={type} count={count} />;
    const onTap = marks ? (i: number) => {
      if (learnerBlocked()) return;
      SoundManager.tick();
      setTapped(prev => prev.includes(i) ? prev : [...prev, i]);
    } : undefined;
    const dots = <LeverDots lever={parts ? 'two-parts' : 'count-marks'} segments={parts ? factModel(c) : [{ count, tone: 'plain' }]}
      tapped={marks ? tapped : undefined} onTap={onTap} />;
    return type === 'fingers' ? <><VisualAid type={type} count={count} />{dots}</> : dots;
  };

  const renderChoiceButtons = (options: number[]) => (
    <div className="flex flex-wrap justify-center gap-3">
      {options.map((opt) => (
        <button
          key={opt}
          data-pip-object={`option-${opt}`}
          type="button"
          className={`w-16 h-16 text-2xl font-bold border rounded-xl transition-all duration-200 ${answerStateClass(choiceState(selectedAnswer === opt))}`}
          onClick={() => { if (learnerBlocked()) return; handleSelectOption(opt); }}
          disabled={inputClosed}
        >
          {opt}
        </button>
      ))}
    </div>
  );

  const numericValue = typedAnswer === '' ? 0 : parseInt(typedAnswer, 10) || 0;
  const handleIncrement = () => {
    if (learnerBlocked()) return;
    SoundManager.tick();
    setTypedAnswer(String(Math.min(numericValue + 1, maxNumber + 5)));
  };
  const handleDecrement = () => {
    if (learnerBlocked()) return;
    SoundManager.tick();
    setTypedAnswer(String(Math.max(numericValue - 1, 0)));
  };

  const renderTypedInput = () => (
    <div className="flex flex-col items-center gap-3">
      <div data-pip-object="entry" className="flex items-center gap-2">
        {/* Minus button */}
        <LuminaButton
          aria-label="One less"
          className="w-14 h-14 text-2xl font-bold rounded-xl"
          onClick={handleDecrement}
          disabled={numericValue <= 0 || inputClosed}
        >
          &minus;
        </LuminaButton>

        {/* Number display — bespoke answer-entry readout (kept as the painting) */}
        <div className="w-20 h-14 flex items-center justify-center bg-slate-800/50 border border-white/20 rounded-xl">
          <span className="text-3xl font-bold text-slate-100">
            {typedAnswer === '' ? '–' : numericValue}
          </span>
        </div>

        {/* Plus button */}
        <LuminaButton
          aria-label="One more"
          className="w-14 h-14 text-2xl font-bold rounded-xl"
          onClick={handleIncrement}
          disabled={inputClosed}
        >
          +
        </LuminaButton>
      </div>

      <LuminaActionButton
        action="check"
        onClick={handleTypedSubmit}
        disabled={typedAnswer === '' || inputClosed}
      >
        Submit
      </LuminaActionButton>
    </div>
  );

  const renderMatchEquationOptions = (eqOptions: string[]) => (
    <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
      {eqOptions.map((eq, idx) => (
        <button
          key={eq}
          data-pip-object={`equation-${idx}`}
          type="button"
          className={`h-12 text-lg font-mono border rounded-xl transition-all ${answerStateClass(choiceState(selectedEquation === eq))}`}
          onClick={() => { if (learnerBlocked()) return; handleSelectEquation(eq); }}
          disabled={inputClosed}
        >
          {eq}
        </button>
      ))}
    </div>
  );

  const renderMatchVisualOptions = (visOptions: Array<{ type: string; count: number }>) => (
    <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
      {visOptions.map((vo, idx) => (
        <button
          key={idx}
          data-pip-object={`picture-${idx}`}
          type="button"
          className={`p-3 rounded-lg border transition-all ${answerStateClass(choiceState(selectedVisualIdx === idx))}`}
          onClick={() => { if (learnerBlocked()) return; handleSelectVisual(idx); }}
          disabled={inputClosed}
        >
          {/* Bespoke interaction surface — the SVG visual the student picks. */}
          <MatchVisualOption type={vo.type} count={vo.count} />
        </button>
      ))}
    </div>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="blue" className="text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : `Grade ${gradeBand}`}
            </LuminaBadge>
            <LuminaBadge accent="amber" className="text-xs">
              Within {maxNumber}
            </LuminaBadge>
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Progress & Stats Bar */}
        {challenges.length > 0 && !allChallengesComplete && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="text-slate-500">
                {currentChallengeIndex + 1} / {challenges.length}
              </span>
              {currentChallenge && (
                <LuminaBadge className="text-xs">
                  {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                  {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
                </LuminaBadge>
              )}
            </div>
            <div className="flex items-center gap-3">
              {streak >= 2 && (
                <span className="text-orange-400 font-bold text-sm animate-pulse">
                  {streak} in a row!
                </span>
              )}
              {accuracy < 100 && totalAnswered > 0 && (
                <span className="text-slate-500 text-xs">{accuracy}% accuracy</span>
              )}
            </div>
          </div>
        )}

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <LuminaPrompt>
            <span className="text-sm">{currentChallenge.instruction}</span>
          </LuminaPrompt>
        )}

        {/* Main Challenge Area. Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): its dock sits between
            what the fact is read from (above) and the answers (below), and it outlines the answers as one region,
            never a single choice. */}
        {currentChallenge && !allChallengesComplete && (
          <div className="relative">
            {/* Visual Aid (visual-fact phase) — bespoke SVG interaction surface */}
            {currentChallenge.type === 'visual-fact' && currentChallenge.visualType && (
              <div data-pip-object="visual" className="mb-4 p-4 bg-slate-800/20 rounded-xl border border-white/5">
                {renderPicture(currentChallenge.visualType)}
              </div>
            )}

            {/* Equation Display — bespoke math readout */}
            {(currentChallenge.type !== 'match' || currentChallenge.matchDirection === 'equation-to-visual') && (
              <div className="text-center py-6">
                <span data-pip-object="problem" className="text-5xl font-bold text-slate-100 font-mono tracking-wider">
                  {formatMathFact(currentChallenge)}
                </span>
                {/* fact_dots / part_whole levers: the printed numbers as dots under the fact; nothing for the "?". */}
                {modelUnderFact && <LeverDots lever={modelUnderFact} segments={factModel(currentChallenge)} />}
              </div>
            )}

            {/* Match: Visual-to-equation — show visual then equation options */}
            {currentChallenge.type === 'match' && currentChallenge.matchDirection === 'visual-to-equation' && (
              <div className="space-y-4">
                <div data-pip-object="visual" className="p-4 bg-slate-800/20 rounded-xl border border-white/5">
                  {renderPicture(currentChallenge.visualType || 'dot-array')}
                </div>
                <PipDock />
                {currentChallenge.equationOptions && <PipWorkspace>{renderMatchEquationOptions(currentChallenge.equationOptions)}</PipWorkspace>}
              </div>
            )}

            {/* Match: Equation-to-visual — show equation then visual options */}
            {currentChallenge.type === 'match' && currentChallenge.matchDirection === 'equation-to-visual' && currentChallenge.visualOptions && (
              <div className="space-y-4">
                <PipDock />
                <PipWorkspace>{renderMatchVisualOptions(currentChallenge.visualOptions)}</PipWorkspace>
              </div>
            )}

            {/* Answer Inputs (non-match types) */}
            {currentChallenge.type !== 'match' && <PipDock />}
            {currentChallenge.type !== 'match' && (
              <PipWorkspace className="mt-4">
                {currentChallenge.options && currentChallenge.options.length > 0
                  ? renderChoiceButtons(currentChallenge.options)
                  : renderTypedInput()
                }
              </PipWorkspace>
            )}
          </div>
        )}

        {/* Feedback */}
        {feedback && !allChallengesComplete && (
          <div className={`text-center text-sm font-medium transition-all duration-300 ${
            feedbackType === 'success'
              ? 'text-emerald-400'
              : feedbackType === 'error'
                ? 'text-red-400'
                : 'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* All Complete */}
        {allChallengesComplete && !phaseResults.length && (
          <div className="text-center py-4">
            <p className="text-emerald-400 text-sm font-medium mb-2">All challenges complete!</p>
            <p className="text-slate-400 text-xs">
              {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
              {bestStreak > 1 && ` | Best streak: ${bestStreak}`}
            </p>
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localOverallScore)}
            durationMs={elapsedMs}
            heading="Fact Fluency Complete!"
            celebrationMessage={`You completed ${challenges.length} facts! Best streak: ${bestStreak} in a row!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const MathFactFluency = withWorkspaceOnly<MathFactFluencyProps>('math-fact-fluency', MathFactFluencySurface, props => props.data.title);

export default MathFactFluency;
