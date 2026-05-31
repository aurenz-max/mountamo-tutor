'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPrompt,
  LuminaModeTabs,
  LuminaChallengeCounter,
  LuminaSlider,
  LuminaInput,
  LuminaButton,
  LuminaActionButton,
  LuminaPanel,
  type LuminaModeTab,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { RatioTableMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface RatioTableChallenge {
  id: string;
  type: 'missing-value' | 'find-multiplier' | 'build-ratio' | 'unit-rate';
  instruction: string;
  baseRatio: [number, number];
  rowLabels: [string, string];
  targetMultiplier: number;
  hiddenValue?: 'scaled-first' | 'scaled-second'; // For missing-value
  hint: string;
  tolerance?: number; // Percentage tolerance for answer checking (default 1%)
}

export interface RatioTableData {
  title: string;
  description?: string;
  challenges: RatioTableChallenge[];
  showUnitRate?: boolean;
  showBarChart?: boolean;
  maxMultiplier?: number;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<RatioTableMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'missing-value': { label: 'Missing Value', icon: '❓', accentColor: 'purple' },
  'find-multiplier': { label: 'Find Multiplier', icon: '✖️', accentColor: 'blue' },
  'build-ratio': { label: 'Build Ratio', icon: '🔨', accentColor: 'emerald' },
  'unit-rate': { label: 'Unit Rate', icon: '📏', accentColor: 'amber' },
};

// ============================================================================
// Props
// ============================================================================

interface RatioTableProps {
  data: RatioTableData;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatNum(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

// ============================================================================
// Component
// ============================================================================

const RatioTable: React.FC<RatioTableProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    showUnitRate = true,
    showBarChart = true,
    maxMultiplier = 10,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Challenge Progress (shared hooks)
  // -------------------------------------------------------------------------
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
  });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
    // Use accuracy averaging — each challenge records a precision score
    getScore: (rs) =>
      Math.round(
        rs.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / rs.length,
      ),
  });

  // -------------------------------------------------------------------------
  // Current challenge
  // -------------------------------------------------------------------------
  const currentChallenge = useMemo(
    () => challenges[currentChallengeIndex] ?? null,
    [challenges, currentChallengeIndex],
  );

  // -------------------------------------------------------------------------
  // Per-challenge interaction state
  // -------------------------------------------------------------------------
  const [studentAnswer, setStudentAnswer] = useState('');
  const [sliderMultiplier, setSliderMultiplier] = useState(1);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'hint' | ''>('');

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `ratio-table-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Derived values for current challenge
  // -------------------------------------------------------------------------
  const baseRatio = currentChallenge?.baseRatio ?? [1, 1];
  const rowLabels = currentChallenge?.rowLabels ?? ['Quantity A', 'Quantity B'];
  const targetMultiplier = currentChallenge?.targetMultiplier ?? 1;
  const hiddenValue = currentChallenge?.hiddenValue ?? 'scaled-second';
  const tolerance = currentChallenge?.tolerance ?? 1;

  const scaledColumn: [number, number] = useMemo(() => {
    if (!currentChallenge) return [0, 0];
    if (currentChallenge.type === 'build-ratio') {
      return [baseRatio[0] * sliderMultiplier, baseRatio[1] * sliderMultiplier];
    }
    return [baseRatio[0] * targetMultiplier, baseRatio[1] * targetMultiplier];
  }, [currentChallenge, baseRatio, targetMultiplier, sliderMultiplier]);

  const unitRate = baseRatio[0] !== 0 ? baseRatio[1] / baseRatio[0] : 0;

  const targetValue = useMemo(() => {
    if (!currentChallenge) return 0;
    switch (currentChallenge.type) {
      case 'missing-value':
        return hiddenValue === 'scaled-first'
          ? baseRatio[0] * targetMultiplier
          : baseRatio[1] * targetMultiplier;
      case 'find-multiplier':
        return targetMultiplier;
      case 'unit-rate':
        return unitRate;
      case 'build-ratio':
        return targetMultiplier;
      default:
        return 0;
    }
  }, [currentChallenge, baseRatio, targetMultiplier, hiddenValue, unitRate]);

  // Bar chart max for proportional widths
  const barMaxValue = useMemo(() => {
    return Math.max(scaledColumn[0], scaledColumn[1], baseRatio[0], baseRatio[1], 1);
  }, [scaledColumn, baseRatio]);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<RatioTableMetrics>({
    primitiveType: 'ratio-table',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    baseRatio,
    rowLabels,
    challengeType: currentChallenge?.type ?? 'missing-value',
    targetMultiplier,
    studentAnswer,
    targetValue,
    unitRate: unitRate.toFixed(2),
    hintsUsed,
    currentChallengeIndex,
    totalChallenges: challenges.length,
    currentAttempts,
  }), [
    baseRatio, rowLabels, currentChallenge?.type, targetMultiplier,
    studentAnswer, targetValue, unitRate, hintsUsed, currentChallengeIndex,
    challenges.length, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'ratio-table',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;

    const types = Array.from(new Set(challenges.map(c => c.type))).join(', ');
    sendText(
      `[ACTIVITY_START] Student is working on ratio tables with ${challenges.length} challenges covering: ${types}. `
      + `First challenge: "${currentChallenge?.instruction}". `
      + `Base ratio: ${baseRatio[0]} ${rowLabels[0]} to ${baseRatio[1]} ${rowLabels[1]}. `
      + `Introduce the activity warmly and read the first instruction.`,
      { silent: true },
    );
  }, [isConnected, challenges.length, currentChallenge, baseRatio, rowLabels, sendText]);

  // -------------------------------------------------------------------------
  // Answer Checking
  // -------------------------------------------------------------------------
  const checkAnswer = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();

    let correct = false;
    let precision = 0;

    if (currentChallenge.type === 'build-ratio') {
      // Slider-based: compare sliderMultiplier to targetMultiplier
      const sliderError = Math.abs((sliderMultiplier - targetMultiplier) / targetMultiplier) * 100;
      correct = sliderError <= tolerance * 2; // slightly more tolerant for slider
      precision = Math.max(0, 100 - sliderError);

      if (correct) {
        SoundManager.playCorrect();
        setFeedback(`Great! You built the correct equivalent ratio (×${formatNum(sliderMultiplier)}).`);
        setFeedbackType('success');
        sendText(
          `[ANSWER_CORRECT] Student built ratio ×${formatNum(sliderMultiplier)} (target: ×${targetMultiplier}). `
          + `Attempts: ${currentAttempts + 1}. Celebrate briefly!`,
          { silent: true },
        );
      } else {
        SoundManager.playIncorrect();
        setFeedback(`Your multiplier ×${formatNum(sliderMultiplier)} doesn't match yet. Keep adjusting!`);
        setFeedbackType('error');
        sendText(
          `[ANSWER_INCORRECT] Student slider at ×${formatNum(sliderMultiplier)} but target is ×${targetMultiplier}. `
          + `Attempt ${currentAttempts + 1}. Encourage adjusting.`,
          { silent: true },
        );
      }
    } else {
      // Text-input based: parse student answer
      const parsed = parseFloat(studentAnswer);
      if (isNaN(parsed)) {
        SoundManager.invalid();
        setFeedback('Please enter a number.');
        setFeedbackType('error');
        return;
      }

      const percentError = targetValue !== 0
        ? Math.abs((parsed - targetValue) / targetValue) * 100
        : (parsed === 0 ? 0 : 100);
      correct = percentError <= tolerance;
      precision = Math.max(0, 100 - percentError);

      if (correct) {
        const label = currentChallenge.type === 'find-multiplier'
          ? `The multiplier is ×${formatNum(targetValue)}.`
          : currentChallenge.type === 'unit-rate'
          ? `The unit rate is ${formatNum(unitRate)} ${rowLabels[1]} per ${rowLabels[0]}.`
          : `${hiddenValue === 'scaled-first' ? rowLabels[0] : rowLabels[1]} = ${formatNum(targetValue)}`;

        SoundManager.playCorrect();
        setFeedback(`Correct! ${label}`);
        setFeedbackType('success');
        sendText(
          `[ANSWER_CORRECT] Student answered ${formatNum(parsed)} for ${currentChallenge.type} (target: ${formatNum(targetValue)}). `
          + `Attempts: ${currentAttempts + 1}, hints: ${hintsUsed}. Celebrate and reinforce the proportional reasoning.`,
          { silent: true },
        );
      } else if (percentError < 10) {
        SoundManager.playIncorrect();
        setFeedback(`Very close! Your answer ${formatNum(parsed)} is almost right. Check your arithmetic.`);
        setFeedbackType('error');
        sendText(
          `[ANSWER_CLOSE] Student answered ${formatNum(parsed)} but target is ${formatNum(targetValue)} (${percentError.toFixed(1)}% off). `
          + `Encourage them — they’re close.`,
          { silent: true },
        );
      } else {
        const hintMsg = currentChallenge.type === 'find-multiplier'
          ? `Try dividing the scaled value by the base value.`
          : currentChallenge.type === 'unit-rate'
          ? `Divide ${baseRatio[1]} by ${baseRatio[0]} to find the unit rate.`
          : `Think about the relationship between ${rowLabels[0]} and ${rowLabels[1]}.`;
        SoundManager.playIncorrect();
        setFeedback(`Not quite. ${hintMsg}`);
        setFeedbackType('error');
        sendText(
          `[ANSWER_INCORRECT] Student answered ${formatNum(parsed)} but target is ${formatNum(targetValue)} `
          + `(${percentError.toFixed(1)}% off). Attempt ${currentAttempts + 1}. `
          + `Guide toward ${currentChallenge.type === 'unit-rate' ? 'dividing to find unit rate' : 'the unit rate (' + formatNum(unitRate) + ')'}.`,
          { silent: true },
        );
      }
    }

    if (correct) {
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        score: Math.round(precision),
        hintsUsed,
      });
    }
  }, [
    currentChallenge, studentAnswer, sliderMultiplier, targetValue, targetMultiplier,
    unitRate, tolerance, hiddenValue, rowLabels, baseRatio, hintsUsed,
    currentAttempts, incrementAttempts, recordResult, sendText,
  ]);

  // -------------------------------------------------------------------------
  // Hint System
  // -------------------------------------------------------------------------
  const provideHint = useCallback(() => {
    if (hasSubmittedEvaluation || !currentChallenge) return;
    const newHints = hintsUsed + 1;
    setHintsUsed(newHints);

    if (newHints === 1) {
      setFeedback(`Hint: The unit rate is ${formatNum(unitRate)} ${rowLabels[1]} per ${rowLabels[0]}.`);
    } else if (newHints === 2) {
      if (currentChallenge.type === 'find-multiplier') {
        setFeedback(`Hint: Divide the scaled value by the base value to find the multiplier.`);
      } else if (currentChallenge.type === 'unit-rate') {
        setFeedback(`Hint: Divide ${baseRatio[1]} ÷ ${baseRatio[0]}.`);
      } else {
        setFeedback(`Hint: Multiply the unit rate (${formatNum(unitRate)}) by the known quantity.`);
      }
    } else {
      setFeedback(`Hint: ${currentChallenge.hint}`);
    }
    setFeedbackType('hint');

    sendText(
      `[HINT_REQUESTED] Student requested hint ${newHints}/3. Challenge type: ${currentChallenge.type}. `
      + `Base ratio: ${baseRatio[0]}:${baseRatio[1]}, unit rate: ${formatNum(unitRate)}. `
      + `Provide scaffolding at level ${Math.min(newHints, 3)} without revealing the answer.`,
      { silent: true },
    );
  }, [hasSubmittedEvaluation, currentChallenge, hintsUsed, unitRate, rowLabels, baseRatio, sendText]);

  // -------------------------------------------------------------------------
  // Challenge Navigation
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All complete — submit evaluation
      const phaseScoreStr = phaseResults
        .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const correctCount = challengeResults.filter(r => r.correct).length;
      const overallPct = challenges.length > 0
        ? Math.round((correctCount / challenges.length) * 100)
        : 0;

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their proportional reasoning!`,
        { silent: true },
      );

      if (!hasSubmittedEvaluation) {
        const overallAccuracy = overallPct;
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
        const avgPrecision = challengeResults.length > 0
          ? Math.round(challengeResults.reduce((s, r) => s + ((r.score as number) ?? 0), 0) / challengeResults.length)
          : 0;
        const totalHints = challengeResults.reduce((s, r) => s + ((r.hintsUsed as number) ?? 0), 0);

        // Per-type scores
        const typeScores: Record<string, number[]> = {};
        challengeResults.forEach((r) => {
          const ch = challenges.find(c => c.id === r.challengeId);
          if (ch) {
            if (!typeScores[ch.type]) typeScores[ch.type] = [];
            typeScores[ch.type].push((r.score as number) ?? (r.correct ? 100 : 0));
          }
        });
        const avgTypeScore = (type: string): number | undefined => {
          const scores = typeScores[type];
          if (!scores || scores.length === 0) return undefined;
          return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        };

        const metrics: RatioTableMetrics = {
          type: 'ratio-table',
          goalMet: correctCount === challenges.length,
          overallAccuracy,
          totalChallenges: challenges.length,
          correctCount,
          attemptsCount: totalAttempts,
          averagePrecision: avgPrecision,
          hintsRequested: totalHints,
          missingValueScore: avgTypeScore('missing-value'),
          findMultiplierScore: avgTypeScore('find-multiplier'),
          buildRatioScore: avgTypeScore('build-ratio'),
          unitRateScore: avgTypeScore('unit-rate'),
        };

        submitEvaluation(
          correctCount === challenges.length,
          overallAccuracy,
          metrics,
          { challengeResults },
        );
      }
      return;
    }

    // Reset per-challenge state
    setStudentAnswer('');
    setSliderMultiplier(1);
    setHintsUsed(0);
    setFeedback('');
    setFeedbackType('');

    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}). `
      + `Base ratio: ${nextChallenge.baseRatio[0]} ${nextChallenge.rowLabels[0]} to ${nextChallenge.baseRatio[1]} ${nextChallenge.rowLabels[1]}. `
      + `Introduce it briefly.`,
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, submitEvaluation, currentChallengeIndex,
  ]);

  // -------------------------------------------------------------------------
  // Auto-submit when all complete
  // -------------------------------------------------------------------------
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------
  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct,
  );

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round(
      challengeResults.reduce((s, r) => s + ((r.score as number) ?? (r.correct ? 100 : 0)), 0) / challenges.length,
    );
  }, [allChallengesComplete, challenges, challengeResults]);

  // Eval-mode pill row — challenge types present in this session.
  const modeTabs: LuminaModeTab[] = useMemo(
    () =>
      Object.entries(CHALLENGE_TYPE_CONFIG)
        .filter(([type]) => challenges.some(c => c.type === type))
        .map(([type, config]) => ({ value: type, label: `${config.icon} ${config.label}` })),
    [challenges],
  );

  // Themed feedback text color (grading language stays consistent).
  const feedbackColor =
    feedbackType === 'success' ? 'text-emerald-400'
    : feedbackType === 'error' ? 'text-rose-400'
    : feedbackType === 'hint' ? 'text-amber-400'
    : 'text-slate-300';

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="cyan" className="text-xs">
              Ratios
            </LuminaBadge>
            {challenges.length > 0 && (
              <LuminaBadge className="text-xs">
                {Math.min(currentChallengeIndex + 1, challenges.length)} / {challenges.length}
              </LuminaBadge>
            )}
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Phase Progress Pills + Challenge Counter */}
        {challenges.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <LuminaModeTabs
              tabs={modeTabs}
              active={currentChallenge?.type ?? ''}
              accent="cyan"
            />
            <LuminaChallengeCounter
              current={Math.min(currentChallengeIndex + 1, challenges.length)}
              total={challenges.length}
              className="ml-auto"
            />
          </div>
        )}

        {/* Challenge Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <LuminaPrompt>
            <span className="text-sm">{currentChallenge.instruction}</span>
          </LuminaPrompt>
        )}

        {/* Ratio Table Visualization */}
        {currentChallenge && !allChallengesComplete && (
          <div className="grid grid-cols-2 gap-4">
            {/* Base Ratio Column */}
            <div className="space-y-3">
              <div className="text-center">
                <span className="text-teal-400 font-mono text-xs uppercase tracking-wider">
                  Base Ratio
                </span>
              </div>
              <div className="p-3 bg-teal-500/10 border border-teal-400/30 rounded-xl text-center">
                <p className="text-xs text-teal-400 mb-1">{rowLabels[0]}</p>
                <p className="text-2xl font-bold text-slate-100 font-mono">{formatNum(baseRatio[0])}</p>
              </div>
              <div className="p-3 bg-teal-500/10 border border-teal-400/30 rounded-xl text-center">
                <p className="text-xs text-teal-400 mb-1">{rowLabels[1]}</p>
                <p className="text-2xl font-bold text-slate-100 font-mono">{formatNum(baseRatio[1])}</p>
              </div>
            </div>

            {/* Scaled / Target Column */}
            <div className="space-y-3">
              <div className="text-center">
                <span className="text-purple-400 font-mono text-xs uppercase tracking-wider">
                  {currentChallenge.type === 'build-ratio'
                    ? `Scaled ×${formatNum(sliderMultiplier)}`
                    : currentChallenge.type === 'find-multiplier'
                    ? 'Scaled ×?'
                    : currentChallenge.type === 'unit-rate'
                    ? 'Unit Rate'
                    : `Scaled ×${targetMultiplier}`
                  }
                </span>
              </div>

              {currentChallenge.type === 'unit-rate' ? (
                /* Unit rate: show the division prompt */
                <div className="p-4 bg-purple-500/10 border border-purple-400/30 rounded-xl text-center">
                  <p className="text-xs text-purple-400 mb-2">{rowLabels[1]} per {rowLabels[0]}</p>
                  <p className="text-xl font-bold text-purple-200 font-mono">
                    {formatNum(baseRatio[1])} &divide; {formatNum(baseRatio[0])} = ?
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-purple-500/10 border border-purple-400/30 rounded-xl text-center">
                    <p className="text-xs text-purple-400 mb-1">{rowLabels[0]}</p>
                    <p className="text-2xl font-bold text-slate-100 font-mono">
                      {currentChallenge.type === 'missing-value' && hiddenValue === 'scaled-first' && !isCurrentChallengeComplete
                        ? '?'
                        : formatNum(scaledColumn[0])
                      }
                    </p>
                  </div>
                  <div className="p-3 bg-purple-500/10 border border-purple-400/30 rounded-xl text-center">
                    <p className="text-xs text-purple-400 mb-1">{rowLabels[1]}</p>
                    <p className="text-2xl font-bold text-slate-100 font-mono">
                      {currentChallenge.type === 'missing-value' && hiddenValue === 'scaled-second' && !isCurrentChallengeComplete
                        ? '?'
                        : formatNum(scaledColumn[1])
                      }
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Unit Rate Display */}
        {showUnitRate && currentChallenge && !allChallengesComplete && currentChallenge.type !== 'unit-rate' && (
          <div className="bg-teal-500/10 border border-teal-400/20 rounded-lg p-2 text-center">
            <p className="text-xs text-teal-300 font-mono">
              Unit Rate:{' '}
              <span className="font-bold text-teal-100">{formatNum(unitRate)}</span>
              {' '}
              <span className="text-teal-400">({rowLabels[1]} per {rowLabels[0]})</span>
            </p>
          </div>
        )}

        {/* Bar Chart Visualization */}
        {showBarChart && currentChallenge && !allChallengesComplete && currentChallenge.type !== 'unit-rate' && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 font-mono uppercase tracking-wider text-center">
              Visual Comparison
            </p>
            <div className="space-y-1.5">
              {/* Base bars */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-20 text-right truncate">{rowLabels[0]}</span>
                <div className="flex-1 h-6 bg-slate-800/30 rounded overflow-hidden">
                  <div
                    className="h-full bg-teal-500/30 border-r border-teal-400/50 rounded transition-all duration-300 flex items-center justify-center"
                    style={{ width: `${Math.max(Math.min((baseRatio[0] / barMaxValue) * 100, 100), 8)}%` }}
                  >
                    <span className="text-xs text-teal-200 font-mono">{formatNum(baseRatio[0])}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-20 text-right truncate">{rowLabels[1]}</span>
                <div className="flex-1 h-6 bg-slate-800/30 rounded overflow-hidden">
                  <div
                    className="h-full bg-teal-500/30 border-r border-teal-400/50 rounded transition-all duration-300 flex items-center justify-center"
                    style={{ width: `${Math.max(Math.min((baseRatio[1] / barMaxValue) * 100, 100), 8)}%` }}
                  >
                    <span className="text-xs text-teal-200 font-mono">{formatNum(baseRatio[1])}</span>
                  </div>
                </div>
              </div>

              {/* Scaled bars */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-500 w-20 text-right truncate">{rowLabels[0]}&times;</span>
                <div className="flex-1 h-6 bg-slate-800/30 rounded overflow-hidden">
                  <div
                    className="h-full bg-purple-500/30 border-r border-purple-400/50 rounded transition-all duration-300 flex items-center justify-center"
                    style={{ width: `${Math.max(Math.min((scaledColumn[0] / barMaxValue) * 100, 100), 8)}%` }}
                  >
                    <span className="text-xs text-purple-200 font-mono">
                      {currentChallenge.type === 'missing-value' && hiddenValue === 'scaled-first' && !isCurrentChallengeComplete
                        ? '?'
                        : formatNum(scaledColumn[0])
                      }
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-20 text-right truncate">{rowLabels[1]}&times;</span>
                <div className="flex-1 h-6 bg-slate-800/30 rounded overflow-hidden">
                  <div
                    className="h-full bg-purple-500/30 border-r border-purple-400/50 rounded transition-all duration-300 flex items-center justify-center"
                    style={{ width: `${Math.max(Math.min((scaledColumn[1] / barMaxValue) * 100, 100), 8)}%` }}
                  >
                    <span className="text-xs text-purple-200 font-mono">
                      {currentChallenge.type === 'missing-value' && hiddenValue === 'scaled-second' && !isCurrentChallengeComplete
                        ? '?'
                        : formatNum(scaledColumn[1])
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Build-Ratio Slider */}
        {currentChallenge?.type === 'build-ratio' && !isCurrentChallengeComplete && !allChallengesComplete && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-purple-300 font-medium">Adjust Multiplier</span>
              <span className="text-sm text-purple-200 font-mono font-bold">&times;{formatNum(sliderMultiplier)}</span>
            </div>
            <LuminaSlider
              accent="purple"
              min={0.5}
              max={maxMultiplier}
              step={0.1}
              value={[sliderMultiplier]}
              onValueChange={([v]) => setSliderMultiplier(v)}
              disabled={hasSubmittedEvaluation}
            />
            <div className="flex justify-between text-xs text-slate-500 font-mono">
              <span>&times;0.5</span>
              <span>&times;{maxMultiplier}</span>
            </div>
          </div>
        )}

        {/* Answer Input (for non-slider challenges) */}
        {currentChallenge && currentChallenge.type !== 'build-ratio' && !isCurrentChallengeComplete && !allChallengesComplete && (
          <div className="flex items-center gap-3">
            <LuminaInput
              type="number"
              step="0.01"
              value={studentAnswer}
              onChange={(e) => setStudentAnswer(e.target.value)}
              disabled={hasSubmittedEvaluation}
              placeholder={
                currentChallenge.type === 'find-multiplier' ? 'Enter the multiplier'
                : currentChallenge.type === 'unit-rate' ? 'Enter the unit rate'
                : 'Enter the missing value'
              }
              className="flex-1 text-center font-mono"
              onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
            />
            <LuminaButton
              tone="subtle"
              className="text-xs"
              onClick={provideHint}
              disabled={hasSubmittedEvaluation || hintsUsed >= 3}
            >
              Hint ({hintsUsed}/3)
            </LuminaButton>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${feedbackColor}`}>
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        {challenges.length > 0 && !allChallengesComplete && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && (
              <LuminaActionButton
                action="check"
                onClick={checkAnswer}
                disabled={
                  hasSubmittedEvaluation ||
                  (currentChallenge?.type !== 'build-ratio' && !studentAnswer)
                }
              />
            )}
            {isCurrentChallengeComplete && (
              <LuminaActionButton
                action="next"
                onClick={advanceToNextChallenge}
              >
                Next Challenge
              </LuminaActionButton>
            )}
          </div>
        )}

        {/* Hint on multiple failed attempts */}
        {currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <LuminaPanel className="p-2 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </LuminaPanel>
        )}

        {/* All Complete Message */}
        {allChallengesComplete && (
          <div className="text-center">
            <p className="text-emerald-400 text-sm font-medium mb-1">All challenges complete!</p>
            <p className="text-slate-400 text-xs">
              {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
            </p>
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Ratio Challenge Complete!"
            celebrationMessage={`You completed all ${challenges.length} ratio challenges!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default RatioTable;
