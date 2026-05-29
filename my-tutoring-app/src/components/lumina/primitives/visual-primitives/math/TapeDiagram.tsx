'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  usePrimitiveEvaluation,
  type TapeDiagramMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ---------------------------------------------------------------------------
// Data Interfaces
// ---------------------------------------------------------------------------

export interface BarSegment {
  value?: number;
  label: string;
  isUnknown?: boolean;
}

export interface BarConfig {
  segments: BarSegment[];
  totalLabel?: string;
  color?: string;
}

export type TapeDiagramChallengeType =
  | 'represent'
  | 'solve_part_whole'
  | 'solve_comparison'
  | 'multi_step';

/** One tape-diagram challenge. Owns its own bars + word problem + mode-specific data. */
export interface TapeDiagramChallenge {
  id: string;
  challengeType: TapeDiagramChallengeType;
  bars: BarConfig[];
  wordProblem?: string;
  comparisonMode?: boolean;
  showBrackets?: boolean;
  comparisonData?: {
    quantity1: number;
    quantity2: number;
    difference: number;
    comparisonWord: string;
    unknownPart: string;
  };
  multiStepData?: {
    step1Hint: string;
    step2Hint: string;
    solveOrder: number[];
  };
}

export interface TapeDiagramData {
  title: string;
  description: string;
  /** 3-6 challenges. Walked sequentially by the component. */
  challenges: TapeDiagramChallenge[];

  // Evaluation integration (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TapeDiagramMetrics>) => void;
}

interface TapeDiagramProps {
  data: TapeDiagramData;
  className?: string;
}

// ---------------------------------------------------------------------------
// Within-challenge phase types
// ---------------------------------------------------------------------------

type LearningPhase = 'explore' | 'practice' | 'apply';

interface SegmentAttempt {
  barIndex: number;
  segmentIndex: number;
  attempts: number;
  correctOnFirstTry: boolean;
}

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const COLOR_PALETTE = [
  'from-blue-500 to-blue-600',
  'from-purple-500 to-purple-600',
  'from-green-500 to-green-600',
  'from-orange-500 to-orange-600',
  'from-pink-500 to-pink-600',
  'from-teal-500 to-teal-600',
];

function getBarColor(barIndex: number, customColor?: string) {
  if (customColor) return customColor;
  return COLOR_PALETTE[barIndex % COLOR_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Phase summary config — one entry per challenge type. The session pins to a
// single mode, so phaseResults collapses to a single row labeled by mode.
// ---------------------------------------------------------------------------

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  represent: { label: 'Represent', icon: '📊', accentColor: 'blue' },
  solve_part_whole: { label: 'Part-Whole', icon: '⚖️', accentColor: 'emerald' },
  solve_comparison: { label: 'Compare', icon: '🔀', accentColor: 'orange' },
  multi_step: { label: 'Multi-Step', icon: '🧮', accentColor: 'purple' },
};

// ---------------------------------------------------------------------------
// SegmentStepper — compact numeric input with −/+ steppers and type-in
// support. Used for unknown-segment values and the part-whole "Total =" input.
// ---------------------------------------------------------------------------

interface SegmentStepperProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  submitLabel?: string;
}

const SegmentStepper: React.FC<SegmentStepperProps> = ({
  label,
  value,
  onChange,
  onSubmit,
  disabled,
  submitLabel = 'Check',
}) => {
  const parsed = parseInt(value, 10);
  const safeValue = Number.isFinite(parsed) ? parsed : 0;

  const adjust = (delta: number) => {
    const next = Math.max(0, safeValue + delta);
    SoundManager.tick();
    onChange(String(next));
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 text-center truncate">
          {label}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => adjust(-1)}
          disabled={disabled || safeValue === 0}
          className="w-9 h-9 flex-shrink-0 rounded-lg bg-white/5 border border-white/20 text-slate-100 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-lg font-bold flex items-center justify-center"
          aria-label="Decrease"
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => {
            const next = e.target.value.replace(/[^0-9]/g, '');
            onChange(next);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
          }}
          disabled={disabled}
          placeholder="?"
          className="flex-1 min-w-0 text-center text-2xl font-mono font-bold text-orange-400 bg-slate-900/50 border border-slate-700 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-orange-400/50 disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => adjust(1)}
          disabled={disabled}
          className="w-9 h-9 flex-shrink-0 rounded-lg bg-white/5 border border-white/20 text-slate-100 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-lg font-bold flex items-center justify-center"
          aria-label="Increase"
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || value === ''}
        className="w-full px-3 py-1.5 bg-orange-600/30 border-2 border-orange-500/50 text-orange-200 hover:bg-orange-600/40 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-colors"
      >
        {submitLabel}
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TapeDiagram: React.FC<TapeDiagramProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `tape-diagram-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Challenge progress ─────────────────────────────────────────────────────
  const {
    currentIndex,
    currentAttempts,
    results,
    isComplete,
    recordResult,
    incrementAttempts,
    advance,
  } = useChallengeProgress<TapeDiagramChallenge>({
    challenges,
    getChallengeId: (c) => c.id,
  });

  const phaseResults = usePhaseResults({
    challenges,
    results,
    isComplete,
    getChallengeType: (c) => c.challengeType,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Evaluation hook ────────────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<TapeDiagramMetrics>({
    primitiveType: 'tape-diagram',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const currentChallenge = challenges[currentIndex] ?? null;
  const challengeType: TapeDiagramChallengeType =
    currentChallenge?.challengeType ?? 'solve_part_whole';
  const bars = currentChallenge?.bars ?? [];
  const wordProblem = currentChallenge?.wordProblem;
  const comparisonMode = currentChallenge?.comparisonMode ?? false;
  const showBrackets = currentChallenge?.showBrackets ?? true;
  const comparisonData = currentChallenge?.comparisonData;
  const multiStepData = currentChallenge?.multiStepData;

  // ── Per-challenge interaction state (resets on advance) ────────────────────
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, 'correct' | 'incorrect' | null>>({});
  const [segmentAttempts, setSegmentAttempts] = useState<Map<string, SegmentAttempt>>(new Map());
  const [showHints, setShowHints] = useState(false);
  const [challengeHintCount, setChallengeHintCount] = useState(0);

  // Part-whole within-challenge phase state
  const [currentPhase, setCurrentPhase] = useState<LearningPhase>('explore');
  const [wholeValue, setWholeValue] = useState('');
  const [wholeFound, setWholeFound] = useState(false);
  const [phaseAttempts, setPhaseAttempts] = useState({ explore: 0, practice: 0, apply: 0 });

  // Multi-step within-challenge step state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const recordedRef = useRef(false);
  const sessionCompleteFiredRef = useRef(false);

  // Reset per-challenge state when the active challenge changes.
  useEffect(() => {
    if (!currentChallenge) return;
    setUserAnswers({});
    setFeedback({});
    setSegmentAttempts(new Map());
    setShowHints(false);
    setChallengeHintCount(0);
    setCurrentPhase('explore');
    setWholeValue('');
    setWholeFound(false);
    setPhaseAttempts({ explore: 0, practice: 0, apply: 0 });
    setCurrentStepIndex(0);
    recordedRef.current = false;
  }, [currentChallenge?.id]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getSegmentKey = useCallback(
    (barIndex: number, segmentIndex: number) => `${barIndex}-${segmentIndex}`,
    [],
  );

  const allUnknowns = useMemo(() => {
    const unknowns: Array<{ barIndex: number; segmentIndex: number }> = [];
    bars.forEach((bar, barIndex) => {
      bar.segments.forEach((segment, segmentIndex) => {
        if (segment.isUnknown) {
          unknowns.push({ barIndex, segmentIndex });
        }
      });
    });
    return unknowns;
  }, [bars]);

  // Per-challenge content match for stale-state guard (PRD §6a #8): the per-
  // challenge reset useEffect's setX() is async, so after advance() the next
  // render still has the previous challenge's bar labels in segmentAttempts /
  // feedback. Match the current challenge's first segment label against the
  // bars we're rendering before recording a result.
  const stateMatchesChallenge = useCallback(
    (challenge: TapeDiagramChallenge | null): boolean => {
      if (!challenge) return false;
      // After reset, segmentAttempts is empty and feedback is empty — that's a
      // clean state for this challenge, OK to proceed.
      if (segmentAttempts.size === 0 && Object.keys(feedback).length === 0) return true;
      // Otherwise, any tracked attempt must belong to a segment on this challenge's bars.
      const firstAttempt = Array.from(segmentAttempts.values())[0];
      if (!firstAttempt) return true;
      const expectedLabel = challenge.bars[firstAttempt.barIndex]?.segments[firstAttempt.segmentIndex]?.label;
      // If the segment doesn't exist on the new challenge's bars (or label
      // differs from what produced the attempt), state is stale.
      if (!expectedLabel) return false;
      return true;
    },
    [segmentAttempts, feedback],
  );

  const trackAttempt = useCallback(
    (barIndex: number, segmentIndex: number, isCorrect: boolean) => {
      const key = getSegmentKey(barIndex, segmentIndex);
      setSegmentAttempts((prev) => {
        const next = new Map(prev);
        const current = prev.get(key) || {
          barIndex,
          segmentIndex,
          attempts: 0,
          correctOnFirstTry: false,
        };
        const updated: SegmentAttempt = {
          ...current,
          attempts: current.attempts + 1,
          correctOnFirstTry:
            isCorrect && current.attempts === 0 ? true : current.correctOnFirstTry,
        };
        next.set(key, updated);
        return next;
      });
    },
    [getSegmentKey],
  );

  const handleShowHints = () => {
    if (!showHints) {
      setChallengeHintCount((c) => c + 1);
    }
    setShowHints(!showHints);
  };

  const advanceToNextChallenge = () => {
    advance();
  };

  // Record one ChallengeResult per challenge (called by the per-mode handler
  // when the student has solved the active challenge).
  const completeCurrentChallenge = useCallback(
    (correct: boolean, extras: Record<string, unknown> = {}) => {
      if (!currentChallenge) return;
      if (recordedRef.current) return;
      // Stale-state guard (PRD §6a #8): in-flight handlers can race ahead of
      // the per-challenge reset useEffect. Only record when local state
      // belongs to the active challenge.
      if (!stateMatchesChallenge(currentChallenge)) return;
      recordedRef.current = true;
      // currentAttempts is incremented by the calling handler before this fires
      // (via incrementAttempts), so currentAttempts here is the final count.
      recordResult({
        challengeId: currentChallenge.id,
        correct,
        attempts: currentAttempts,
        hintsUsed: challengeHintCount,
        ...extras,
      });
    },
    [currentChallenge, currentAttempts, challengeHintCount, recordResult, stateMatchesChallenge],
  );

  // ── AI Tutoring ────────────────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    title,
    challengeType,
    currentChallengeIndex: currentIndex,
    totalChallenges: challenges.length,
    currentPhase,
    totalBars: bars.length,
    unknownSegments: allUnknowns.length,
    solvedSegments: Object.values(feedback).filter((f) => f === 'correct').length,
    currentWordProblem: wordProblem,
    challengeHintCount,
  }), [
    title, challengeType, currentIndex, challenges.length, currentPhase,
    bars.length, allUnknowns.length, feedback, wordProblem, challengeHintCount,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'tape-diagram',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'Grade 3',
  });

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    if (challenges.length === 0 || !currentChallenge) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Tape diagram session: ${challengeType} mode, ${challenges.length} challenges. `
      + `First problem: ${wordProblem ? `"${wordProblem}". ` : `${allUnknowns.length} unknowns. `}`
      + `Guide the student through the diagram.`,
      { silent: true },
    );
  }, [
    isConnected, currentChallenge, challenges.length, challengeType,
    wordProblem, allUnknowns.length, sendText,
  ]);

  const lastAnnouncedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isConnected || !currentChallenge) return;
    if (!hasIntroducedRef.current) return;
    if (lastAnnouncedIdRef.current === null) {
      lastAnnouncedIdRef.current = currentChallenge.id;
      return;
    }
    if (lastAnnouncedIdRef.current === currentChallenge.id) return;
    lastAnnouncedIdRef.current = currentChallenge.id;
    sendText(
      `[CHALLENGE_START] Challenge ${currentIndex + 1} of ${challenges.length}. `
      + `${wordProblem ? `Problem: "${wordProblem}". ` : ''}`
      + `Guide the student through the diagram.`,
      { silent: true },
    );
  }, [currentChallenge, currentIndex, challenges.length, wordProblem, isConnected, sendText]);

  // ── Session complete → aggregate metrics + submitEvaluation ────────────────
  useEffect(() => {
    if (!isComplete) return;
    if (sessionCompleteFiredRef.current) return;
    if (challenges.length === 0) return;
    sessionCompleteFiredRef.current = true;

    const totalAttempts = results.reduce((s, r) => s + r.attempts, 0);
    const correctCount = results.filter((r) => r.correct).length;
    const firstTryCount = results.filter((r) => r.attempts === 1 && r.correct).length;
    const hintsViewed = results.filter((r) => Number(r.hintsUsed ?? 0) > 0).length;
    // Per-challenge score: 100 on first try, then decays per extra attempt.
    const perChallengeScore = (r: typeof results[number]) =>
      r.correct ? Math.max(20, 100 - (r.attempts - 1) * 20) : 0;
    const overallAccuracy = Math.round(
      results.reduce((s, r) => s + perChallengeScore(r), 0) / Math.max(1, results.length),
    );
    const averageAttemptsPerChallenge =
      Math.round((totalAttempts / Math.max(1, results.length)) * 10) / 10;

    const sessionMode = challenges[0].challengeType;

    const metrics: TapeDiagramMetrics = {
      type: 'tape-diagram',
      challengeType: sessionMode,
      totalChallenges: challenges.length,
      correctCount,
      attemptsCount: totalAttempts,
      firstTryCount,
      hintsViewed,
      overallAccuracy,
      averageAttemptsPerChallenge,
    };

    const phaseStr = phaseResults
      .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
      .join(', ');
    sendText(
      `[ALL_COMPLETE] Phase scores: ${phaseStr}. Overall: ${overallAccuracy}%. `
      + `Celebrate completion of the ${challenges.length}-challenge tape-diagram session.`,
      { silent: true },
    );

    if (!hasSubmittedEvaluation) {
      const goalMet = correctCount === challenges.length;
      submitEvaluation(goalMet, overallAccuracy, metrics, {
        studentWork: {
          challengeCount: challenges.length,
          challengeType: sessionMode,
          attemptsPerChallenge: challenges.map((c) => {
            const r = results.find((rr) => rr.challengeId === c.id);
            return r?.attempts ?? 0;
          }),
        },
      });
    }
  }, [
    isComplete, results, phaseResults, challenges,
    sendText, submitEvaluation, hasSubmittedEvaluation,
  ]);

  // ── Input change handler (shared across modes) ─────────────────────────────
  const handleAnswerChange = (barIndex: number, segmentIndex: number, value: string) => {
    const key = getSegmentKey(barIndex, segmentIndex);
    setUserAnswers((prev) => ({ ...prev, [key]: value }));
    if (feedback[key]) {
      setFeedback((prev) => ({ ...prev, [key]: null }));
    }
  };

  // =========================================================================
  // Shared bar visualization
  // =========================================================================

  const renderBar = (
    bar: BarConfig,
    barIndex: number,
    options: {
      visibleSegmentIndices?: number[];
      showBracket?: boolean;
      bracketLabel?: string;
      showUnknownInputs?: boolean;
      isSegmentLocked?: (segIdx: number) => boolean;
      onSegmentSubmit?: (barIdx: number, segIdx: number) => void;
    } = {},
  ) => {
    const {
      visibleSegmentIndices,
      showBracket = false,
      bracketLabel = '',
      showUnknownInputs = true,
      isSegmentLocked,
      onSegmentSubmit,
    } = options;

    const indices = visibleSegmentIndices || bar.segments.map((_, i) => i);
    const visibleSegments = indices.map((idx) => ({ segment: bar.segments[idx], originalIndex: idx }));
    const total = bar.segments.reduce((s, seg) => s + (seg.value || 0), 0);

    return (
      <div key={barIndex} className="relative">
        {/* Bracket */}
        {showBracket && bracketLabel && (
          <div className="absolute -top-16 left-0 right-0 flex items-start justify-center">
            <div className="flex flex-col items-center">
              <svg width="100%" height="30" className="mb-1">
                <path
                  d="M 0 25 L 0 5 Q 0 0 5 0 L 95% 0 Q 100% 0 100% 5 L 100% 25"
                  fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"
                />
              </svg>
              <div className="text-sm font-bold text-white bg-slate-800/80 px-3 py-1 rounded-full border border-slate-600">
                {bracketLabel}
              </div>
            </div>
          </div>
        )}

        {/* Bar label (for comparison mode) */}
        {comparisonMode && bar.totalLabel && (
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
            {bar.totalLabel}
          </div>
        )}

        {/* Segments */}
        <div className={`flex ${comparisonMode ? 'items-start' : 'items-stretch'} gap-1`}>
          {visibleSegments.map(({ segment, originalIndex: segIdx }) => {
            const key = getSegmentKey(barIndex, segIdx);
            const isUnknown = segment.isUnknown;
            const locked = isSegmentLocked?.(segIdx) || false;
            const segFeedback = feedback[key];
            const widthPct = segment.value ? (segment.value / (total || 1)) * 100 : 100 / bar.segments.length;

            return (
              <div
                key={segIdx}
                className="relative flex-1"
                style={{ minWidth: '80px', flex: comparisonMode ? `0 0 ${widthPct}%` : 1 }}
              >
                <div
                  className={`
                    w-full h-20 rounded-lg border-2 transition-all duration-200 flex items-center justify-center shadow-lg
                    ${isUnknown
                      ? locked
                        ? 'bg-slate-800/50 border-slate-600 opacity-50'
                        : segFeedback === 'correct'
                          ? 'bg-green-900/30 border-green-500'
                          : 'bg-slate-700/50 border-yellow-500 border-dashed'
                      : `bg-gradient-to-br ${getBarColor(barIndex, bar.color)} border-slate-600`
                    }
                  `}
                >
                  <div className="text-center">
                    {isUnknown ? (
                      segFeedback === 'correct' ? (
                        <div className="text-2xl font-bold text-green-400">{segment.value}</div>
                      ) : locked ? (
                        <div className="text-2xl font-bold text-slate-600">🔒</div>
                      ) : (
                        <div className="text-3xl font-bold text-yellow-400">?</div>
                      )
                    ) : (
                      segment.value !== undefined && (
                        <div className="text-2xl font-bold text-white">{segment.value}</div>
                      )
                    )}
                    <div className="text-xs font-medium text-white/90 px-2 truncate">
                      {segment.label}
                    </div>
                  </div>
                </div>

                {/* Input for unknown segments */}
                {isUnknown && showUnknownInputs && !locked && segFeedback !== 'correct' && !isComplete && (
                  <div className="mt-3">
                    <SegmentStepper
                      label={`${segment.label} =`}
                      value={userAnswers[key] || ''}
                      onChange={(v) => handleAnswerChange(barIndex, segIdx, v)}
                      onSubmit={() => onSegmentSubmit?.(barIndex, segIdx)}
                    />
                    {segFeedback === 'incorrect' && (
                      <div className="mt-2 text-center text-red-400 text-sm font-semibold">Not quite — try again!</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Comparison alignment line */}
        {comparisonMode && barIndex < bars.length - 1 && (
          <div className="mt-4 mb-4 h-px bg-slate-600/50"></div>
        )}
      </div>
    );
  };

  // =========================================================================
  // MODE: Represent
  // =========================================================================

  const renderRepresentMode = () => {
    const allCorrect = allUnknowns.every(({ barIndex, segmentIndex }) =>
      feedback[getSegmentKey(barIndex, segmentIndex)] === 'correct',
    );

    const handleRepresentSubmit = (barIndex: number, segmentIndex: number) => {
      if (isComplete || recordedRef.current) return;
      const key = getSegmentKey(barIndex, segmentIndex);
      const userVal = parseFloat(userAnswers[key]);
      const segment = bars[barIndex]?.segments[segmentIndex];
      if (isNaN(userVal) || segment?.value === undefined) return;

      const isCorrect = Math.abs(userVal - segment.value) < 0.01;
      incrementAttempts();
      trackAttempt(barIndex, segmentIndex, isCorrect);
      if (isCorrect) SoundManager.playCorrect();
      else SoundManager.playIncorrect();

      const newFeedback = { ...feedback, [key]: (isCorrect ? 'correct' : 'incorrect') as 'correct' | 'incorrect' };
      setFeedback(newFeedback);

      if (isCorrect) {
        const nowAllCorrect = allUnknowns.every(({ barIndex: bi, segmentIndex: si }) =>
          (bi === barIndex && si === segmentIndex) ? true : newFeedback[getSegmentKey(bi, si)] === 'correct',
        );
        if (nowAllCorrect) {
          completeCurrentChallenge(true);
        }
      }
    };

    return (
      <>
        {wordProblem && (
          <div className="mb-8 p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="text-sm font-mono uppercase tracking-wider text-blue-400 mb-2">Read the Problem</div>
            <p className="text-lg text-blue-100 leading-relaxed">{wordProblem}</p>
          </div>
        )}

        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center">
          <p className="text-sm text-yellow-200">Fill in each segment value from the word problem above.</p>
        </div>

        <div className="space-y-16">
          {bars.map((bar, barIndex) =>
            renderBar(bar, barIndex, {
              showBracket: false,
              showUnknownInputs: true,
              onSegmentSubmit: handleRepresentSubmit,
            }),
          )}
        </div>

        {Object.values(feedback).some((f) => f === 'incorrect') && !allCorrect && (
          <div className="mt-4 text-center">
            <button onClick={handleShowHints} className="px-6 py-2 bg-blue-600/20 border-2 border-blue-500/40 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-all text-sm font-semibold">
              {showHints ? 'Hide Hint' : 'Need a Hint?'}
            </button>
            {showHints && wordProblem && (
              <div className="mt-3 p-4 bg-blue-500/20 border border-blue-500/50 rounded-xl text-sm text-blue-200">
                Re-read the word problem carefully. Each number mentioned corresponds to one segment on the diagram.
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  // =========================================================================
  // MODE: Solve Part-Whole (within-challenge 3-phase progression)
  // =========================================================================

  const renderPartWholeMode = () => {
    const getVisibleSegments = (barIndex: number): number[] => {
      const bar = bars[barIndex];
      if (!bar) return [];
      if (currentPhase === 'explore') return [0, 1];
      if (currentPhase === 'practice') return [0, 2];
      return bar.segments.map((_, i) => i);
    };

    const getVisibleUnknowns = (): Array<{ barIndex: number; segmentIndex: number }> => {
      if (currentPhase === 'explore') return [];
      if (currentPhase === 'practice') return allUnknowns.slice(0, 1);
      return allUnknowns;
    };

    const visibleUnknowns = getVisibleUnknowns();

    const handleCheckWhole = () => {
      if (isComplete || recordedRef.current) return;
      const inputWhole = parseFloat(wholeValue);
      if (isNaN(inputWhole)) return;

      const firstBar = bars[0];
      if (!firstBar) return;

      let actualTotal = 0;
      for (let i = 0; i < 2 && i < firstBar.segments.length; i++) {
        const seg = firstBar.segments[i];
        if (seg.value !== undefined) actualTotal += seg.value;
      }

      incrementAttempts();
      setPhaseAttempts((prev) => ({ ...prev, explore: prev.explore + 1 }));

      if (Math.abs(inputWhole - actualTotal) < 0.01) {
        SoundManager.playCorrect();
        setWholeFound(true);
        setFeedback({ explore: 'correct' });
        sendText('[PHASE_TRANSITION] Student found the whole. Moving to practice phase.', { silent: true });
        setTimeout(() => { setCurrentPhase('practice'); setFeedback({}); }, 1500);
      } else {
        SoundManager.playIncorrect();
        setFeedback({ explore: 'incorrect' });
      }
    };

    const handlePartWholeSubmit = (barIndex: number, segmentIndex: number) => {
      if (isComplete || recordedRef.current) return;
      const key = getSegmentKey(barIndex, segmentIndex);
      const userVal = parseFloat(userAnswers[key]);
      const segment = bars[barIndex]?.segments[segmentIndex];
      if (isNaN(userVal) || segment?.value === undefined) return;

      const isCorrect = Math.abs(userVal - segment.value) < 0.01;
      incrementAttempts();
      trackAttempt(barIndex, segmentIndex, isCorrect);
      if (isCorrect) SoundManager.playCorrect();
      else SoundManager.playIncorrect();
      setPhaseAttempts((prev) => ({ ...prev, [currentPhase]: prev[currentPhase] + 1 }));

      const newFeedback = { ...feedback, [key]: (isCorrect ? 'correct' : 'incorrect') as 'correct' | 'incorrect' };
      setFeedback(newFeedback);

      if (isCorrect) {
        if (currentPhase === 'practice') {
          const firstUnknown = allUnknowns[0];
          if (firstUnknown && getSegmentKey(firstUnknown.barIndex, firstUnknown.segmentIndex) === key) {
            sendText('[PHASE_TRANSITION] Practice complete. Moving to apply phase.', { silent: true });
            setTimeout(() => setCurrentPhase('apply'), 1200);
          }
        } else if (currentPhase === 'apply') {
          const allSolved = allUnknowns.every(({ barIndex: bi, segmentIndex: si }) =>
            newFeedback[getSegmentKey(bi, si)] === 'correct',
          );
          if (allSolved) {
            completeCurrentChallenge(true, {
              wholeCorrectlyIdentified: wholeFound,
              phaseAttempts: { ...phaseAttempts, apply: phaseAttempts.apply + 1 },
            });
          }
        }
      }
    };

    const bar = bars[0];
    const visibleIndices = bar ? getVisibleSegments(0) : [];
    let phaseTotal = 0;
    visibleIndices.forEach((idx) => {
      const seg = bar?.segments[idx];
      if (seg?.value !== undefined) phaseTotal += seg.value;
    });

    let bracketLabel = '';
    if (currentPhase === 'practice') bracketLabel = `Total = ${phaseTotal}`;
    else if (currentPhase === 'apply') bracketLabel = bar?.totalLabel || `Total = ${phaseTotal}`;

    return (
      <>
        {/* Phase progress (within-challenge) */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {(['explore', 'practice', 'apply'] as LearningPhase[]).map((phase, i) => {
            const isActive = currentPhase === phase;
            const isDone = phase === 'explore'
              ? wholeFound
              : phase === 'practice'
                ? currentPhase === 'apply'
                : false;
            return (
              <React.Fragment key={phase}>
                {i > 0 && <div className="h-px w-8 bg-slate-600"></div>}
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                  isActive ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                    : isDone ? 'bg-green-500/20 border-green-500/50 text-green-300'
                    : 'bg-slate-700/50 border-slate-600 text-slate-400'
                }`}>
                  {isDone ? '✓' : i + 1} {phase === 'explore' ? 'Explore' : phase === 'practice' ? 'Practice' : 'Apply'}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Phase instructions */}
        {!isComplete && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-center">
            <div className="text-sm font-mono uppercase tracking-wider text-blue-400 mb-2">
              {currentPhase === 'explore' && 'Step 1: Find the Whole'}
              {currentPhase === 'practice' && 'Step 2: Find the Unknown Part'}
              {currentPhase === 'apply' && 'Step 3: Solve with Multiple Parts'}
            </div>
            <p className="text-sm text-blue-200">
              {currentPhase === 'explore' && 'Add the two parts together to find the total'}
              {currentPhase === 'practice' && 'Use the total and known part to find the unknown part'}
              {currentPhase === 'apply' && 'Use all the parts to find the missing values'}
            </p>
          </div>
        )}

        {/* Bars (phase-filtered) */}
        <div className="space-y-16">
          {bars.map((bar, barIndex) =>
            renderBar(bar, barIndex, {
              visibleSegmentIndices: getVisibleSegments(barIndex),
              showBracket: showBrackets && currentPhase !== 'explore',
              bracketLabel,
              showUnknownInputs: currentPhase !== 'explore',
              onSegmentSubmit: handlePartWholeSubmit,
            }),
          )}
        </div>

        {/* Phase 1: Find the whole */}
        {currentPhase === 'explore' && !isComplete && (
          <div className="mt-8">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-orange-400 text-sm font-mono uppercase tracking-widest">Phase 1: Explore</span>
              <div className="h-px flex-1 bg-gradient-to-r from-orange-700 to-transparent"></div>
            </div>
            <div className="mb-6 text-center">
              <h5 className="text-2xl font-bold text-white">
                What is the <span className="text-orange-400">total</span> of all the known parts?
              </h5>
            </div>
            <div className="max-w-xs mx-auto mb-6">
              <SegmentStepper
                label="Total ="
                value={wholeValue}
                onChange={setWholeValue}
                onSubmit={handleCheckWhole}
                submitLabel="Check total"
              />
            </div>
            {feedback.explore === 'correct' && (
              <div className="p-4 bg-green-500/20 border-2 border-green-500/50 rounded-xl text-center">
                <div className="text-green-400 font-bold text-lg">Perfect!</div>
                <div className="text-green-300/80 text-sm">You found the whole. Now let&apos;s find the unknowns!</div>
              </div>
            )}
            {feedback.explore === 'incorrect' && renderFeedbackIncorrect('Try adding all the known values together.')}
          </div>
        )}

        {(currentPhase === 'practice' || currentPhase === 'apply') && !isComplete && visibleUnknowns.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-orange-400 text-sm font-mono uppercase tracking-widest">
                {currentPhase === 'practice' ? 'Phase 2: Practice' : 'Phase 3: Apply'}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-orange-700 to-transparent"></div>
            </div>
          </div>
        )}
      </>
    );
  };

  // =========================================================================
  // MODE: Solve Comparison
  // =========================================================================

  const renderComparisonMode = () => {
    const handleComparisonSubmit = (barIndex: number, segmentIndex: number) => {
      if (isComplete || recordedRef.current) return;
      const key = getSegmentKey(barIndex, segmentIndex);
      const userVal = parseFloat(userAnswers[key]);
      const segment = bars[barIndex]?.segments[segmentIndex];
      if (isNaN(userVal) || segment?.value === undefined) return;

      const isCorrect = Math.abs(userVal - segment.value) < 0.01;
      incrementAttempts();
      trackAttempt(barIndex, segmentIndex, isCorrect);
      if (isCorrect) SoundManager.playCorrect();
      else SoundManager.playIncorrect();

      const newFeedback = { ...feedback, [key]: (isCorrect ? 'correct' : 'incorrect') as 'correct' | 'incorrect' };
      setFeedback(newFeedback);

      if (isCorrect) {
        const allSolved = allUnknowns.every(({ barIndex: bi, segmentIndex: si }) =>
          newFeedback[getSegmentKey(bi, si)] === 'correct',
        );
        if (allSolved) {
          completeCurrentChallenge(true);
        }
      }
    };

    return (
      <>
        {wordProblem && (
          <div className="mb-8 p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="text-sm font-mono uppercase tracking-wider text-blue-400 mb-2">Comparison Problem</div>
            <p className="text-lg text-blue-100 leading-relaxed">{wordProblem}</p>
          </div>
        )}

        <div className="space-y-8">
          {bars.map((bar, barIndex) =>
            renderBar(bar, barIndex, {
              showBracket: false,
              showUnknownInputs: true,
              onSegmentSubmit: handleComparisonSubmit,
            }),
          )}
        </div>

        {comparisonData && (
          <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl text-center">
            <p className="text-sm text-purple-200">
              {comparisonData.unknownPart === 'difference'
                ? `How many ${comparisonData.comparisonWord} does the first group have?`
                : `Find the missing quantity.`}
            </p>
          </div>
        )}

        {Object.values(feedback).some((f) => f === 'incorrect') && (
          <div className="mt-4 text-center">
            <button onClick={handleShowHints} className="px-6 py-2 bg-blue-600/20 border-2 border-blue-500/40 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-all text-sm font-semibold">
              {showHints ? 'Hide Hint' : 'Need a Hint?'}
            </button>
            {showHints && comparisonData && (
              <div className="mt-3 p-4 bg-blue-500/20 border border-blue-500/50 rounded-xl text-sm text-blue-200">
                {comparisonData.unknownPart === 'difference'
                  ? `Subtract the smaller value (${comparisonData.quantity2}) from the larger value (${comparisonData.quantity1}).`
                  : comparisonData.unknownPart === 'quantity2'
                    ? `The difference is ${comparisonData.difference}. Subtract it from the larger value.`
                    : `The difference is ${comparisonData.difference}. Add it to the smaller value.`}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  // =========================================================================
  // MODE: Multi-Step
  // =========================================================================

  const renderMultiStepMode = () => {
    const solveOrder = multiStepData?.solveOrder || [2, 3];
    const currentSolveSegIdx = solveOrder[currentStepIndex];
    const totalSteps = solveOrder.length;

    const isSegmentLocked = (segIdx: number) => {
      const orderIdx = solveOrder.indexOf(segIdx);
      if (orderIdx < 0) return false;
      return orderIdx > currentStepIndex;
    };

    const handleMultiStepSubmit = (barIndex: number, segmentIndex: number) => {
      if (isComplete || recordedRef.current) return;
      if (segmentIndex !== currentSolveSegIdx) return;

      const key = getSegmentKey(barIndex, segmentIndex);
      const userVal = parseFloat(userAnswers[key]);
      const segment = bars[barIndex]?.segments[segmentIndex];
      if (isNaN(userVal) || segment?.value === undefined) return;

      const isCorrect = Math.abs(userVal - segment.value) < 0.01;
      incrementAttempts();
      trackAttempt(barIndex, segmentIndex, isCorrect);
      if (isCorrect) SoundManager.playCorrect();
      else SoundManager.playIncorrect();

      const newFeedback = { ...feedback, [key]: (isCorrect ? 'correct' : 'incorrect') as 'correct' | 'incorrect' };
      setFeedback(newFeedback);

      if (isCorrect) {
        const nextStep = currentStepIndex + 1;
        if (nextStep >= totalSteps) {
          completeCurrentChallenge(true);
        } else {
          setTimeout(() => {
            setCurrentStepIndex(nextStep);
            setShowHints(false);
          }, 1200);
        }
      }
    };

    const currentHint = currentStepIndex === 0
      ? multiStepData?.step1Hint
      : multiStepData?.step2Hint;

    return (
      <>
        {wordProblem && (
          <div className="mb-8 p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="text-sm font-mono uppercase tracking-wider text-blue-400 mb-2">Multi-Step Problem</div>
            <p className="text-lg text-blue-100 leading-relaxed">{wordProblem}</p>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 mb-8">
          {solveOrder.map((_, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div className="h-px w-8 bg-slate-600"></div>}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                i === currentStepIndex ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                  : i < currentStepIndex ? 'bg-green-500/20 border-green-500/50 text-green-300'
                  : 'bg-slate-700/50 border-slate-600 text-slate-400'
              }`}>
                {i < currentStepIndex ? '✓' : i + 1} Step {i + 1}
              </div>
            </React.Fragment>
          ))}
        </div>

        {!isComplete && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-center">
            <div className="text-sm font-mono uppercase tracking-wider text-yellow-400 mb-1">
              Step {currentStepIndex + 1} of {totalSteps}
            </div>
            <p className="text-sm text-yellow-200">
              Find the value of <span className="font-bold text-yellow-300">
                {bars[0]?.segments[currentSolveSegIdx]?.label || 'the unknown'}
              </span>
            </p>
          </div>
        )}

        <div className="space-y-16">
          {bars.map((bar, barIndex) =>
            renderBar(bar, barIndex, {
              showBracket: showBrackets,
              bracketLabel: bar.totalLabel || '',
              showUnknownInputs: true,
              isSegmentLocked,
              onSegmentSubmit: handleMultiStepSubmit,
            }),
          )}
        </div>

        {Object.values(feedback).some((f) => f === 'incorrect') && !isComplete && (
          <div className="mt-4 text-center">
            <button onClick={handleShowHints} className="px-6 py-2 bg-blue-600/20 border-2 border-blue-500/40 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-all text-sm font-semibold">
              {showHints ? 'Hide Hint' : 'Need a Hint?'}
            </button>
            {showHints && currentHint && (
              <div className="mt-3 p-4 bg-blue-500/20 border border-blue-500/50 rounded-xl text-sm text-blue-200">
                {currentHint}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  // =========================================================================
  // Shared incorrect-feedback helper (used by part-whole explore phase)
  // =========================================================================

  const renderFeedbackIncorrect = (message: string) => (
    <div className="space-y-3">
      <div className="p-4 bg-red-500/20 border-2 border-red-500/50 rounded-xl text-center">
        <div className="text-red-400 font-bold text-lg">Not Quite</div>
        <div className="text-red-300/80 text-sm">{message}</div>
      </div>
      <div className="text-center">
        <button onClick={handleShowHints} className="px-6 py-2 bg-blue-600/20 border-2 border-blue-500/40 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-all text-sm font-semibold">
          {showHints ? 'Hide Hint' : 'Need a Hint?'}
        </button>
      </div>
    </div>
  );

  // =========================================================================
  // Mode label
  // =========================================================================

  const modeLabel = {
    represent: 'Diagram Builder',
    solve_part_whole: 'Part-Whole Visualization',
    solve_comparison: 'Comparison Model',
    multi_step: 'Multi-Step Problem',
  }[challengeType] || 'Part-Whole Visualization';

  // =========================================================================
  // Empty state
  // =========================================================================

  if (challenges.length === 0) {
    return (
      <div className={`w-full max-w-6xl mx-auto my-12 ${className || ''}`}>
        <div className="backdrop-blur-xl bg-slate-900/40 rounded-3xl border border-white/10 p-6 text-center">
          <p className="text-slate-300">No tape-diagram challenges available.</p>
        </div>
      </div>
    );
  }

  // Has the active challenge already been recorded? (used to gate the "Next challenge" CTA)
  const currentChallengeSolved = currentChallenge
    ? results.some((r) => r.challengeId === currentChallenge.id)
    : false;

  // =========================================================================
  // Main render
  // =========================================================================

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30 text-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Tape Diagram / Bar Model</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            <p className="text-xs text-orange-400 font-mono uppercase tracking-wider">{modeLabel}</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-orange-500/20 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#f97316 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full">
          <div className="mb-8 text-center max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          {/* Session progress (challenge X of N) */}
          {!isComplete && challenges.length > 1 && (
            <div className="flex items-center justify-center gap-3 text-xs text-orange-300 font-mono uppercase tracking-wider mb-6">
              <span>Challenge {Math.min(currentIndex + 1, challenges.length)} of {challenges.length}</span>
              <div className="flex gap-1.5">
                {challenges.map((ch, idx) => {
                  const done = results.some((r) => r.challengeId === ch.id);
                  const isCurrent = idx === currentIndex && !isComplete;
                  return (
                    <div
                      key={ch.id}
                      className={`w-2.5 h-2.5 rounded-full border ${
                        done
                          ? 'bg-green-400/70 border-green-300/80 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                          : isCurrent
                            ? 'bg-orange-400/70 border-orange-300/80 shadow-[0_0_8px_rgba(249,115,22,0.5)]'
                            : 'bg-slate-700/40 border-slate-600/50'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode-specific content */}
          {!isComplete && currentChallenge && (
            <>
              {challengeType === 'represent' && renderRepresentMode()}
              {challengeType === 'solve_part_whole' && renderPartWholeMode()}
              {challengeType === 'solve_comparison' && renderComparisonMode()}
              {challengeType === 'multi_step' && renderMultiStepMode()}

              {/* Per-challenge advance CTA */}
              {currentChallengeSolved && (
                <div className="mt-8 text-center">
                  <button
                    onClick={advanceToNextChallenge}
                    className="px-6 py-2 bg-emerald-500/30 border-2 border-emerald-400/60 text-emerald-100 rounded-lg hover:bg-emerald-500/40 transition-all font-semibold"
                  >
                    {currentIndex + 1 < challenges.length ? 'Next Challenge →' : 'Finish Session'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Session complete state */}
          {isComplete && (
            <div className="mt-4 space-y-4">
              {phaseResults.length > 0 && (
                <PhaseSummaryPanel
                  phases={phaseResults}
                  overallScore={submittedResult?.score}
                  durationMs={elapsedMs}
                  heading="All Complete!"
                  celebrationMessage={`You worked through ${challenges.length} tape-diagram ${challenges.length === 1 ? 'problem' : 'problems'}!`}
                  className="mt-4"
                />
              )}
            </div>
          )}

          {/* Instructions */}
          {!isComplete && (
            <div className="mt-8 p-6 bg-slate-800/30 rounded-xl border border-slate-700">
              <h4 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">Interactive Controls</h4>
              <ul className="text-sm text-slate-300 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">▸</span>
                  <span>
                    {challengeType === 'represent'
                      ? 'Read the word problem and enter the value for each segment'
                      : challengeType === 'solve_comparison'
                        ? 'Compare the two bars and find the missing value'
                        : challengeType === 'multi_step'
                          ? 'Solve each step in order — later steps unlock as you progress'
                          : 'Follow the 3-step progression: Explore → Practice → Apply'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">▸</span>
                  <span>Yellow dashed segments with &ldquo;?&rdquo; represent values to solve for</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TapeDiagram;
