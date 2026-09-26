'use client';

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
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
import {
  describeMathFactCheck, formatMathFact, mathFactAssignment, mathFactMatches, mathFactScene,
  type MathFactResponse,
} from './mathFactFluencyWorkspace';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { mathFactFluencyPipPose } from '../../../pip/mathFactFluencyPipPose';
import { useSpeechScope } from '../../../pip/useSpeechScope';

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
  gradeBand: 'K' | '1';

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

function MathFactFluencySurface({ data, className, runtimePlanItemId, runtimeEvalMode }: MathFactFluencyProps) {
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

  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceIdRef = useRef(instanceId || `math-fact-fluency-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  /** Bound after the state it clears is declared; the progress hook calls it only after render. */
  const reopen = useRef<(retry: boolean) => void>(() => {});

  // -------------------------------------------------------------------------
  // Challenge progress: the teaching workspace owns it
  // -------------------------------------------------------------------------
  const progress = useMathFactProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    evalMode: runtimeEvalMode || 'mixed', workspace, assignment: mathFactAssignment,
    onItemOpened: (_index, retry) => reopen.current(retry),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
  } = progress;
  const canAttempt = progress.canAttempt !== false;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // -------------------------------------------------------------------------
  // Local state
  // -------------------------------------------------------------------------
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

  // A fresh fact starts clean; Try again clears the rejected answer.
  reopen.current = () => {
    setSelectedAnswer(null);
    setTypedAnswer('');
    setSelectedEquation(null);
    setSelectedVisualIdx(null);
    setFeedback('');
    setFeedbackType('');
  };

  const currentSolved = challengeResults.some(r => r.challengeId === currentChallenge?.id && r.correct);
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
    const responseTime = Date.now() - openedAt.current;
    const responseTimeSec = responseTime / 1000;

    incrementAttempts();
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
    progress.commitCheck?.(describeMathFactCheck(currentChallenge, response), correct);
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
    const metrics: MathFactFluencyMetrics = {
      type: 'math-fact-fluency',
      accuracy: score,
      averageResponseTime: Math.round(avgResponseTime * 1000),
      fastAnswerCount: fastCount,
      bestStreak,
      attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
      factsWithinTarget: fastCount,
      factsTotal: challenges.length,
    };
    submitEvaluation(correctCount === challenges.length, score, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmittedEvaluation, progress.recordsEvaluation, challengeResults, challenges.length,
    responseTimes, bestStreak, submitEvaluation]);

  // What the tutor and the observer are shown, republished every render. Derived from the challenge
  // alone, so opening an item adds no revision after the advance.
  useLayoutEffect(() => {
    if (!currentChallenge) return;
    workspace.current = { ...mathFactScene(currentChallenge, { maxNumber }), demonstration: [],
      canDemonstrate: false, canPresent: false, readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    progress.publishWorkspace?.();
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
  // Pip shared surface
  // -------------------------------------------------------------------------
  // A projection of this fact's check state, the tutor's speech on it, and the
  // child's last touch; Pip never picks an answer, checks, or advances. Tutor
  // audio counts only while the tutor is on this block and began on this fact.
  const pip = usePipTargets(currentChallenge?.id ?? null, !currentSolved && !allChallengesComplete);
  const tutorSpeaking = ctx.isAudioPlaying && !!currentChallenge
    && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId);
  const speechOnFact = useSpeechScope(currentChallenge?.id ?? null, tutorSpeaking);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentChallenge || allChallengesComplete || hasSubmittedEvaluation) return null;
    const targets = pip.targets();
    const pose = mathFactFluencyPipPose({
      running: true, preparing: false, currentSolved, revealHeld: false,
      judging: false, tutorSpeaking, cueMatchesItem: !tutorSpeaking || speechOnFact,
      type: currentChallenge.type, matchDirection: currentChallenge.matchDirection,
      visibleIds: targets.map((target) => target.id), lastTouchedId: pip.lastTouchedId,
    });
    return {
      instanceId: resolvedInstanceId, scopeId: currentChallenge.id, label: 'Math facts',
      dock: pip.dock.current, targets, pose,
    };
  });
  // Pip's dock sits between what the fact is read from (above) and the answer
  // choices (below), so a pointer to the picture or equation never crosses a choice.
  const pipDock = pipStore && (
    <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
      className="mx-auto my-3 flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />
  );

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  // Grading-state color language for the answerable options comes from the kit
  // tokens (answerStateClass). A solved choice shows as correct; a checked miss shows
  // the rejected choice as incorrect and never marks the right one.
  const choiceState = (isSelected: boolean): AnswerChoiceState => !isSelected ? 'idle'
    : currentSolved ? 'correct' : missShown ? 'incorrect' : 'selected';
  const inputClosed = currentSolved || allChallengesComplete || !canAttempt;

  const renderChoiceButtons = (options: number[]) => (
    <div className="flex flex-wrap justify-center gap-3">
      {options.map((opt) => (
        <button
          key={opt}
          ref={pip.ref(`option-${opt}`)}
          data-pip-object={`option-${opt}`}
          type="button"
          className={`w-16 h-16 text-2xl font-bold border rounded-xl transition-all duration-200 ${answerStateClass(choiceState(selectedAnswer === opt))}`}
          onClick={() => { if (learnerBlocked()) return; pip.look(`option-${opt}`); handleSelectOption(opt); }}
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
      <div ref={pip.ref('entry')} data-pip-object="entry" className="flex items-center gap-2">
        {/* Minus button */}
        <LuminaButton
          aria-label="One less"
          className="w-14 h-14 text-2xl font-bold rounded-xl"
          onClick={() => { pip.look('entry'); handleDecrement(); }}
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
          onClick={() => { pip.look('entry'); handleIncrement(); }}
          disabled={inputClosed}
        >
          +
        </LuminaButton>
      </div>

      <LuminaActionButton
        action="check"
        onClick={() => { pip.look('entry'); handleTypedSubmit(); }}
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
          ref={pip.ref(`equation-${idx}`)}
          data-pip-object={`equation-${idx}`}
          type="button"
          className={`h-12 text-lg font-mono border rounded-xl transition-all ${answerStateClass(choiceState(selectedEquation === eq))}`}
          onClick={() => { if (learnerBlocked()) return; pip.look(`equation-${idx}`); handleSelectEquation(eq); }}
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
          ref={pip.ref(`picture-${idx}`)}
          data-pip-object={`picture-${idx}`}
          type="button"
          className={`p-3 rounded-lg border transition-all ${answerStateClass(choiceState(selectedVisualIdx === idx))}`}
          onClick={() => { if (learnerBlocked()) return; pip.look(`picture-${idx}`); handleSelectVisual(idx); }}
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
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
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

        {/* Main Challenge Area */}
        {currentChallenge && !allChallengesComplete && (
          <div className="relative">
            {/* Visual Aid (visual-fact phase) — bespoke SVG interaction surface */}
            {currentChallenge.type === 'visual-fact' && currentChallenge.visualType && (
              <div ref={pip.ref('visual')} data-pip-object="visual" className="mb-4 p-4 bg-slate-800/20 rounded-xl border border-white/5">
                <VisualAid
                  type={currentChallenge.visualType}
                  count={currentChallenge.visualCount ?? currentChallenge.correctAnswer}
                />
              </div>
            )}

            {/* Equation Display — bespoke math readout */}
            {(currentChallenge.type !== 'match' || currentChallenge.matchDirection === 'equation-to-visual') && (
              <div className="text-center py-6">
                <span ref={pip.ref('problem')} data-pip-object="problem" className="text-5xl font-bold text-slate-100 font-mono tracking-wider">
                  {formatMathFact(currentChallenge)}
                </span>
              </div>
            )}

            {/* Match: Visual-to-equation — show visual then equation options */}
            {currentChallenge.type === 'match' && currentChallenge.matchDirection === 'visual-to-equation' && (
              <div className="space-y-4">
                <div ref={pip.ref('visual')} data-pip-object="visual" className="p-4 bg-slate-800/20 rounded-xl border border-white/5">
                  <VisualAid
                    type={currentChallenge.visualType || 'dot-array'}
                    count={currentChallenge.visualCount ?? currentChallenge.correctAnswer}
                  />
                </div>
                {pipDock}
                {currentChallenge.equationOptions && renderMatchEquationOptions(currentChallenge.equationOptions)}
              </div>
            )}

            {/* Match: Equation-to-visual — show equation then visual options */}
            {currentChallenge.type === 'match' && currentChallenge.matchDirection === 'equation-to-visual' && currentChallenge.visualOptions && (
              <div className="space-y-4">
                {pipDock}
                {renderMatchVisualOptions(currentChallenge.visualOptions)}
              </div>
            )}

            {/* Answer Inputs (non-match types) */}
            {currentChallenge.type !== 'match' && pipDock}
            {currentChallenge.type !== 'match' && (
              <div className="mt-4">
                {currentChallenge.options && currentChallenge.options.length > 0
                  ? renderChoiceButtons(currentChallenge.options)
                  : renderTypedInput()
                }
              </div>
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
            overallScore={submittedResult?.score ?? localOverallScore}
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
