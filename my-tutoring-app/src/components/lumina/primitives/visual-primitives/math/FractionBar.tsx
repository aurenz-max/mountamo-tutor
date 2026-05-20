'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  usePrimitiveEvaluation,
  type FractionBarMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

/**
 * Fraction Bar — multi-challenge interactive fraction model.
 *
 * Each session walks the student through 3-6 distinct fractions in the SAME
 * eval mode. Each fraction runs through a three-phase within-challenge flow:
 *   Phase 1: Identify the Numerator (multiple choice)
 *   Phase 2: Identify the Denominator (multiple choice)
 *   Phase 3: Build the Fraction on the bar (shade partitions)
 *
 * The session ends when every challenge has been completed; results aggregate
 * into one PhaseSummaryPanel row per eval mode (PRD §6e pattern).
 */

export type FractionBarChallengeType =
  | 'identify'
  | 'build'
  | 'compare'
  | 'add_subtract';

export interface FractionBarChallenge {
  id: string;
  numerator: number;
  denominator: number;
  numeratorChoices: number[];
  denominatorChoices: number[];
}

export interface FractionBarData {
  title: string;
  description: string;
  /** 1-6 challenges. Walked sequentially by the component. */
  challenges: FractionBarChallenge[];
  /** Eval mode pinned for this session (all challenges share one mode). */
  challengeType: FractionBarChallengeType;
  /** Whether to show the decimal approximation in the build phase. */
  showDecimal?: boolean;
  gradeLevel?: string;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FractionBarMetrics>) => void;
}

interface FractionBarProps {
  data: FractionBarData;
  className?: string;
}

type LearningPhase = 'identify-numerator' | 'identify-denominator' | 'build-fraction';

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  identify:     { label: 'Identify Fractions',  icon: '🔢', accentColor: 'purple' },
  build:        { label: 'Build Fractions',     icon: '🎯', accentColor: 'emerald' },
  compare:      { label: 'Compare Fractions',   icon: '⚖️', accentColor: 'blue' },
  add_subtract: { label: 'Fraction Operations', icon: '➕',       accentColor: 'pink' },
};

/** Per-challenge score: 100 first try, then -20 per extra attempt, floored at 20. */
function phaseScore(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.max(20, 100 - (attempts - 1) * 20);
}

const FractionBar: React.FC<FractionBarProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    challengeType: sessionChallengeType,
    showDecimal = true,
    gradeLevel,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `fraction-bar-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Challenge progress ─────────────────────────────────────────
  const {
    currentIndex,
    results,
    isComplete,
    recordResult,
    advance,
  } = useChallengeProgress<FractionBarChallenge>({
    challenges,
    getChallengeId: (c) => c.id,
  });

  const currentChallenge = challenges[currentIndex] ?? null;
  const numerator = currentChallenge?.numerator ?? 1;
  const denominator = currentChallenge?.denominator ?? 2;
  const numeratorChoices = currentChallenge?.numeratorChoices ?? [];
  const denominatorChoices = currentChallenge?.denominatorChoices ?? [];

  // ── Per-challenge interaction state (resets on advance) ────────
  const [currentPhase, setCurrentPhase] = useState<LearningPhase>('identify-numerator');
  const [feedback, setFeedback] = useState<string>('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'hint' | 'info'>('info');

  const [selectedNumerator, setSelectedNumerator] = useState<number | null>(null);
  const [numeratorAttempts, setNumeratorAttempts] = useState(0);

  const [selectedDenominator, setSelectedDenominator] = useState<number | null>(null);
  const [denominatorAttempts, setDenominatorAttempts] = useState(0);

  const [shadedCount, setShadedCount] = useState(0);
  const [shadingChanges, setShadingChanges] = useState(0);
  const [buildAttempts, setBuildAttempts] = useState(0);

  const [challengeHintCount, setChallengeHintCount] = useState(0);
  const [challengeDone, setChallengeDone] = useState(false);

  const recordedRef = useRef(false);
  const sessionCompleteFiredRef = useRef(false);

  // ── Reset every per-challenge slot when the active challenge changes ──
  // PRD §6c: missing any slot leaks state from challenge N into challenge N+1.
  useEffect(() => {
    if (!currentChallenge) return;
    setCurrentPhase('identify-numerator');
    setFeedback('');
    setFeedbackType('info');
    setSelectedNumerator(null);
    setNumeratorAttempts(0);
    setSelectedDenominator(null);
    setDenominatorAttempts(0);
    setShadedCount(0);
    setShadingChanges(0);
    setBuildAttempts(0);
    setChallengeHintCount(0);
    setChallengeDone(false);
    recordedRef.current = false;
  }, [currentChallenge?.id]);

  // ── AI Tutoring ──────────────────────────────────────────────
  const aiPrimitiveData = useMemo(
    () => ({
      numerator,
      denominator,
      currentPhase,
      shadedCount,
      currentChallengeIndex: currentIndex + 1,
      totalChallenges: challenges.length,
      challengeType: sessionChallengeType,
      gradeLevel: gradeLevel || 'Grade 3',
    }),
    [
      numerator,
      denominator,
      currentPhase,
      shadedCount,
      currentIndex,
      challenges.length,
      sessionChallengeType,
      gradeLevel,
    ],
  );

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'fraction-bar',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // Activity start — introduce the session once
  const activityStartSentRef = useRef(false);
  useEffect(() => {
    if (!isConnected) return;
    if (activityStartSentRef.current) return;
    if (challenges.length === 0) return;
    activityStartSentRef.current = true;
    sendText(
      `[ACTIVITY_START] Multi-challenge fraction bar activity for ${gradeLevel || 'Grade 3'}. `
        + `Mode: ${sessionChallengeType}. The student will work through ${challenges.length} different fractions, `
        + `each running through three phases (identify numerator, identify denominator, build on the bar). `
        + `Introduce the session warmly and briefly.`,
      { silent: true },
    );
  }, [isConnected, challenges.length, sessionChallengeType, gradeLevel, sendText]);

  // ── Evaluation hook ──────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<FractionBarMetrics>({
    primitiveType: 'fraction-bar',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── PhaseSummaryPanel: one row, aggregated by eval mode ────────
  const phaseResults = usePhaseResults({
    challenges,
    results,
    isComplete,
    getChallengeType: () => sessionChallengeType,
    phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) =>
      rs.length === 0
        ? 0
        : Math.round(rs.reduce((s, r) => s + Number(r.score ?? 0), 0) / rs.length),
  });

  // ── Per-challenge content match (stale-state guard, §6a #8) ────
  const stateMatchesChallenge = useCallback(
    (challenge: FractionBarChallenge | null): boolean => {
      if (!challenge) return false;
      return challenge.numerator === numerator && challenge.denominator === denominator;
    },
    [numerator, denominator],
  );

  // ── Per-challenge completion (called from submit handlers) ─────
  const completeCurrentChallenge = useCallback(
    (
      correct: boolean,
      score: number,
      totalAttempts: number,
      extras: Record<string, unknown> = {},
    ) => {
      if (!currentChallenge) return;
      if (recordedRef.current) return;
      if (!stateMatchesChallenge(currentChallenge)) return;
      recordedRef.current = true;
      setChallengeDone(true);
      recordResult({
        challengeId: currentChallenge.id,
        correct,
        attempts: totalAttempts,
        score,
        hintsUsed: challengeHintCount,
        ...extras,
      });
    },
    [currentChallenge, stateMatchesChallenge, recordResult, challengeHintCount],
  );

  // ── Session complete → aggregate metrics + submitEvaluation ────
  useEffect(() => {
    if (!isComplete) return;
    if (sessionCompleteFiredRef.current) return;
    if (challenges.length === 0) return;
    sessionCompleteFiredRef.current = true;

    const totalAttempts = results.reduce((s, r) => s + r.attempts, 0);
    const correctCount = results.filter((r) => r.correct).length;
    const firstTryCount = results.filter((r) => Number(r.score ?? 0) === 100).length;
    const hintsViewed = results.filter((r) => Number(r.hintsUsed ?? 0) > 0).length;
    const overallAccuracy = Math.round(
      results.reduce((s, r) => s + Number(r.score ?? 0), 0) / Math.max(1, results.length),
    );
    const averageAttemptsPerChallenge =
      Math.round((totalAttempts / Math.max(1, results.length)) * 10) / 10;

    const metrics: FractionBarMetrics = {
      type: 'fraction-bar',
      challengeType: sessionChallengeType,
      totalChallenges: challenges.length,
      correctCount,
      attemptsCount: totalAttempts,
      firstTryCount,
      hintsViewed,
      overallAccuracy,
      averageAttemptsPerChallenge,
    };

    if (!hasSubmittedEvaluation) {
      const goalMet = correctCount === challenges.length;
      submitEvaluation(goalMet, overallAccuracy, metrics, {
        studentWork: {
          challengeCount: challenges.length,
          challengeType: sessionChallengeType,
          fractions: challenges.map((c) => ({
            numerator: c.numerator,
            denominator: c.denominator,
          })),
          scoresPerChallenge: challenges.map((c) => {
            const r = results.find((rr) => rr.challengeId === c.id);
            return Number(r?.score ?? 0);
          }),
        },
      });
    }
  }, [
    isComplete, results, challenges, sessionChallengeType,
    submitEvaluation, hasSubmittedEvaluation,
  ]);

  // ── Phase 1: Check numerator ─────────────────────────────────
  const handleCheckNumerator = useCallback(() => {
    if (selectedNumerator === null || challengeDone) {
      if (selectedNumerator === null) {
        setFeedback('Please select an answer first!');
        setFeedbackType('error');
      }
      return;
    }
    const nextAttempts = numeratorAttempts + 1;
    setNumeratorAttempts(nextAttempts);

    if (selectedNumerator === numerator) {
      setFeedback(
        `Correct! The numerator is ${numerator} — it’s the top number that tells us how many parts are shaded.`,
      );
      setFeedbackType('success');

      sendText(
        `[ANSWER_CORRECT] Student correctly identified the numerator as ${numerator} for ${numerator}/${denominator}. `
          + `Attempt ${nextAttempts}. Congratulate briefly and explain what the numerator means.`,
        { silent: true },
      );

      setTimeout(() => {
        setCurrentPhase('identify-denominator');
        setFeedback('');
        sendText(
          `[PHASE_TRANSITION] Moving to Phase 2: Identify the Denominator for ${numerator}/${denominator}. `
            + `Briefly introduce what the denominator means.`,
          { silent: true },
        );
      }, 1500);
    } else {
      setFeedback(
        `Not quite. The numerator is the top number in a fraction. In ${numerator}/${denominator}, look at which number is on top.`,
      );
      setFeedbackType('error');

      sendText(
        `[ANSWER_INCORRECT] Student chose ${selectedNumerator} but the correct numerator is ${numerator}. `
          + `Attempt ${nextAttempts}. Give a gentle hint about what the numerator means without giving the answer.`,
        { silent: true },
      );
    }
  }, [selectedNumerator, challengeDone, numerator, denominator, numeratorAttempts, sendText]);

  // ── Phase 2: Check denominator ───────────────────────────────
  const handleCheckDenominator = useCallback(() => {
    if (selectedDenominator === null || challengeDone) {
      if (selectedDenominator === null) {
        setFeedback('Please select an answer first!');
        setFeedbackType('error');
      }
      return;
    }
    const nextAttempts = denominatorAttempts + 1;
    setDenominatorAttempts(nextAttempts);

    if (selectedDenominator === denominator) {
      setFeedback(
        `Correct! The denominator is ${denominator} — it’s the bottom number that tells us how many equal parts make up the whole.`,
      );
      setFeedbackType('success');

      sendText(
        `[ANSWER_CORRECT] Student correctly identified the denominator as ${denominator} for ${numerator}/${denominator}. `
          + `Attempt ${nextAttempts}. Congratulate and explain what the denominator means.`,
        { silent: true },
      );

      setTimeout(() => {
        setCurrentPhase('build-fraction');
        setFeedback('');
        sendText(
          `[PHASE_TRANSITION] Moving to Phase 3: Build ${numerator}/${denominator}. `
            + `The student must shade exactly ${numerator} out of ${denominator} equal parts on the bar.`,
          { silent: true },
        );
      }, 1500);
    } else {
      setFeedback(
        `Not quite. The denominator is the bottom number in a fraction. In ${numerator}/${denominator}, look at which number is on the bottom.`,
      );
      setFeedbackType('error');

      sendText(
        `[ANSWER_INCORRECT] Student chose ${selectedDenominator} but the correct denominator is ${denominator}. `
          + `Attempt ${nextAttempts}. Give a gentle hint about what the denominator means without giving the answer.`,
        { silent: true },
      );
    }
  }, [selectedDenominator, challengeDone, numerator, denominator, denominatorAttempts, sendText]);

  // ── Phase 3: Toggle partition ────────────────────────────────
  const togglePartition = useCallback(
    (partitionIndex: number) => {
      if (challengeDone) return;
      if (partitionIndex < shadedCount) {
        setShadedCount(partitionIndex);
      } else {
        setShadedCount(partitionIndex + 1);
      }
      setShadingChanges((p) => p + 1);
    },
    [shadedCount, challengeDone],
  );

  // ── Phase 3: Submit build ────────────────────────────────────
  const handleSubmitBuild = useCallback(() => {
    if (challengeDone || !currentChallenge) return;
    const nextBuildAttempts = buildAttempts + 1;
    setBuildAttempts(nextBuildAttempts);

    const isCorrect = shadedCount === numerator;
    const selectedFraction = `${shadedCount}/${denominator}`;
    const targetFraction = `${numerator}/${denominator}`;

    if (!isCorrect) {
      setFeedback(
        `You shaded ${shadedCount} out of ${denominator} parts, making ${selectedFraction}. The target is ${targetFraction}. Try shading exactly ${numerator} part${numerator !== 1 ? 's' : ''}!`,
      );
      setFeedbackType('error');

      sendText(
        `[BUILD_INCORRECT] Student shaded ${shadedCount}/${denominator} but target is ${numerator}/${denominator}. `
          + `Attempt ${nextBuildAttempts}. ${
            shadedCount < numerator
              ? `They shaded too few parts (${numerator - shadedCount} short). Encourage them to shade more.`
              : `They shaded too many parts (${shadedCount - numerator} extra). Encourage them to unshade some.`
          }`,
        { silent: true },
      );
      return;
    }

    // ── Score each within-challenge phase ──
    const p1 = phaseScore(numeratorAttempts);
    const p2 = phaseScore(denominatorAttempts);
    const p3 = phaseScore(nextBuildAttempts);
    const score = Math.round((p1 + p2 + p3) / 3);

    setFeedback(
      `Excellent! You correctly built ${targetFraction} by shading ${numerator} out of ${denominator} equal parts!`,
    );
    setFeedbackType('success');

    sendText(
      `[BUILD_CORRECT] Student built ${numerator}/${denominator} correctly. `
        + `Phase scores: numerator ${p1}, denominator ${p2}, build ${p3}, overall ${score}. `
        + `Briefly celebrate and acknowledge any phase that took multiple attempts.`,
      { silent: true },
    );

    const totalAttempts = numeratorAttempts + denominatorAttempts + nextBuildAttempts;
    completeCurrentChallenge(true, score, totalAttempts, {
      numeratorAttempts,
      denominatorAttempts,
      buildAttempts: nextBuildAttempts,
      shadingChanges,
    });
  }, [
    challengeDone,
    currentChallenge,
    buildAttempts,
    shadedCount,
    numerator,
    denominator,
    numeratorAttempts,
    denominatorAttempts,
    shadingChanges,
    sendText,
    completeCurrentChallenge,
  ]);

  // ── Hints ────────────────────────────────────────────────────
  const handleShowHint = useCallback(() => {
    if (challengeDone) return;
    setChallengeHintCount((c) => c + 1);
    setFeedbackType('hint');

    if (currentPhase === 'identify-numerator') {
      setFeedback(
        `Hint: The numerator is always the top number in a fraction. In ${numerator}/${denominator}, which number is on top?`,
      );
      sendText(
        `[HINT_REQUESTED] Student asked for a hint during Phase 1 (Identify Numerator) for ${numerator}/${denominator}. `
          + `Give a scaffolded hint about numerators without revealing the answer.`,
        { silent: true },
      );
    } else if (currentPhase === 'identify-denominator') {
      setFeedback(
        `Hint: The denominator is always the bottom number in a fraction. It tells us how many equal parts the whole is divided into.`,
      );
      sendText(
        `[HINT_REQUESTED] Student asked for a hint during Phase 2 (Identify Denominator) for ${numerator}/${denominator}. `
          + `Give a scaffolded hint about denominators without revealing the answer.`,
        { silent: true },
      );
    } else {
      setFeedback(
        `Hint: You need to shade exactly ${numerator} parts out of ${denominator}. Click parts from left to right to shade them!`,
      );
      sendText(
        `[HINT_REQUESTED] Student asked for a hint during Phase 3 (Build Fraction). `
          + `Target is ${numerator}/${denominator}. Guide them on how many parts to shade.`,
        { silent: true },
      );
    }
  }, [challengeDone, currentPhase, numerator, denominator, sendText]);

  // ── Advance to next challenge ──────────────────────────────────
  const handleNextChallenge = () => {
    advance();
  };

  // ── Helpers ──────────────────────────────────────────────────
  const feedbackColors: Record<typeof feedbackType, string> = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    error: 'bg-red-500/10 border-red-500/30 text-red-300',
    hint: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    info: 'bg-white/5 border-white/10 text-slate-300',
  };

  const hasNextChallenge = currentIndex + 1 < challenges.length;

  // ── Empty state ────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <div className={`w-full ${className || ''}`}>
        <div className="max-w-6xl mx-auto p-8 text-center text-slate-400">
          No fraction bar challenges available.
        </div>
      </div>
    );
  }

  // ── Session summary ────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className={`w-full ${className || ''}`}>
        <div className="max-w-6xl mx-auto my-16">
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score}
            durationMs={elapsedMs}
            heading="Fraction Bar Session Complete"
            celebrationMessage={
              results.every((r) => r.correct)
                ? 'Perfect! You built every fraction correctly.'
                : 'Great work — review the fractions you struggled with and try again next time.'
            }
          />
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={`w-full ${className || ''}`}>
      <div className="max-w-6xl mx-auto glass-panel rounded-3xl border border-white/10 p-8 relative overflow-hidden shadow-2xl">
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-15 bg-purple-500" />

        <div className="relative z-10">
          {/* ── Header ─────────────────────────────────────── */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                Math:
              </span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-mono border bg-purple-500/20 text-purple-300 border-purple-500/30">
                FRACTION BAR
              </span>
            </div>
            <h2 className="text-3xl font-light text-white mb-3">{title}</h2>
            <p className="text-slate-300 leading-relaxed">{description}</p>
          </div>

          {/* ── Session progress dots ──────────────────────── */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {challenges.map((c, idx) => {
              const r = results.find((rr) => rr.challengeId === c.id);
              const isDone = !!r;
              const isCurrent = idx === currentIndex && !challengeDone;
              return (
                <div
                  key={c.id}
                  className={`flex items-center justify-center rounded-full border text-xs font-mono w-8 h-8 ${
                    isDone
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isCurrent
                        ? 'bg-purple-500/20 text-purple-200 border-purple-400/50 shadow-lg scale-105'
                        : 'bg-white/5 text-slate-400 border-white/10'
                  }`}
                >
                  {idx + 1}
                </div>
              );
            })}
            <span className="ml-3 text-xs font-mono uppercase tracking-wider text-slate-400">
              Problem {currentIndex + 1} / {challenges.length}
            </span>
          </div>

          {/* ── Fraction display (constant reference) ──────── */}
          <div className="flex justify-center mb-8">
            <div className="glass-panel rounded-2xl border border-purple-500/20 px-12 py-6 text-center">
              <div className="text-6xl font-bold text-white font-mono flex items-center justify-center gap-2">
                <span className="text-purple-300">{numerator}</span>
                <span className="text-slate-500 text-4xl">/</span>
                <span className="text-blue-300">{denominator}</span>
              </div>
              {showDecimal && (
                <div className="mt-2 text-sm text-slate-400 font-mono">
                  = {(numerator / denominator).toFixed(3)}
                </div>
              )}
            </div>
          </div>

          {/* ── Within-challenge phase indicator ──────────── */}
          <div className="flex items-center justify-center gap-3 mb-8">
            {/* Phase 1 pill */}
            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                currentPhase === 'identify-numerator'
                  ? 'glass-panel border-white/30 text-white shadow-lg scale-105'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <span className="text-lg">
                {currentPhase === 'identify-numerator' ? '🔢' : '✅'}
              </span>
              <span className="font-medium text-sm">1. Numerator</span>
            </div>
            <div className="text-slate-600">{'→'}</div>

            {/* Phase 2 pill */}
            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                currentPhase === 'identify-denominator'
                  ? 'glass-panel border-white/30 text-white shadow-lg scale-105'
                  : currentPhase === 'build-fraction'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              <span className="text-lg">
                {currentPhase === 'build-fraction'
                  ? '✅'
                  : '🔢'}
              </span>
              <span className="font-medium text-sm">2. Denominator</span>
            </div>
            <div className="text-slate-600">{'→'}</div>

            {/* Phase 3 pill */}
            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                currentPhase === 'build-fraction'
                  ? 'glass-panel border-white/30 text-white shadow-lg scale-105'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              <span className="text-lg">
                {challengeDone ? '✅' : '🎯'}
              </span>
              <span className="font-medium text-sm">3. Build It</span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              Phase 1 — Identify the Numerator
             ═══════════════════════════════════════════════════ */}
          {currentPhase === 'identify-numerator' && !challengeDone && (
            <div className="glass-panel rounded-2xl border border-purple-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">{'🔢'}</span>
                  Step 1: Identify the Numerator
                </h3>
                <p className="text-slate-300 leading-relaxed mb-6">
                  In the fraction{' '}
                  <span className="font-mono font-bold text-purple-300">
                    {numerator}/{denominator}
                  </span>
                  , which number is the{' '}
                  <span className="text-purple-300 font-semibold">numerator</span> (the top number)?
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {numeratorChoices.map((choice, idx) => (
                    <button
                      key={`${choice}-${idx}`}
                      onClick={() => setSelectedNumerator(choice)}
                      className={`p-4 rounded-xl border text-center transition-all duration-300 text-2xl font-bold font-mono ${
                        selectedNumerator === choice
                          ? 'glass-panel border-purple-400/50 text-purple-300 shadow-lg scale-105'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCheckNumerator}
                  disabled={selectedNumerator === null}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-3 px-6 rounded-xl disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02]"
                >
                  Check Answer
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              Phase 2 — Identify the Denominator
             ═══════════════════════════════════════════════════ */}
          {currentPhase === 'identify-denominator' && !challengeDone && (
            <div className="glass-panel rounded-2xl border border-blue-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">{'🔢'}</span>
                  Step 2: Identify the Denominator
                </h3>
                <p className="text-slate-300 leading-relaxed mb-6">
                  In the fraction{' '}
                  <span className="font-mono font-bold text-blue-300">
                    {numerator}/{denominator}
                  </span>
                  , which number is the{' '}
                  <span className="text-blue-300 font-semibold">denominator</span> (the bottom
                  number)?
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {denominatorChoices.map((choice, idx) => (
                    <button
                      key={`${choice}-${idx}`}
                      onClick={() => setSelectedDenominator(choice)}
                      className={`p-4 rounded-xl border text-center transition-all duration-300 text-2xl font-bold font-mono ${
                        selectedDenominator === choice
                          ? 'glass-panel border-blue-400/50 text-blue-300 shadow-lg scale-105'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCheckDenominator}
                  disabled={selectedDenominator === null}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-6 rounded-xl disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02]"
                >
                  Check Answer
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              Phase 3 — Build the Fraction on the Bar
             ═══════════════════════════════════════════════════ */}
          {currentPhase === 'build-fraction' && !challengeDone && (
            <div className="glass-panel rounded-2xl border border-emerald-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">{'🎯'}</span>
                  Step 3: Build the Fraction
                </h3>
                <p className="text-slate-300 leading-relaxed mb-6">
                  Now shade exactly{' '}
                  <span className="text-purple-300 font-bold">{numerator}</span> out of{' '}
                  <span className="text-blue-300 font-bold">{denominator}</span> equal parts to
                  build the fraction{' '}
                  <span className="font-mono font-bold text-white">
                    {numerator}/{denominator}
                  </span>
                  .
                </p>

                {/* Current vs target */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-lg font-mono text-white">
                    Shaded:{' '}
                    <span
                      className={`font-bold ${shadedCount === numerator ? 'text-emerald-300' : 'text-purple-300'}`}
                    >
                      {shadedCount}
                    </span>
                    <span className="text-slate-500">/{denominator}</span>
                  </div>
                  <div className="text-sm text-slate-400">
                    Target:{' '}
                    <span className="font-mono text-white">
                      {numerator}/{denominator}
                    </span>
                  </div>
                </div>

                {/* The fraction bar */}
                <div
                  className={`flex border-2 rounded-lg overflow-hidden h-20 shadow-lg mb-4 transition-colors duration-300 ${
                    shadedCount === numerator
                      ? 'border-emerald-500/50'
                      : 'border-slate-600'
                  }`}
                >
                  {Array.from({ length: denominator }).map((_, i) => {
                    const isShaded = i < shadedCount;
                    return (
                      <button
                        key={i}
                        onClick={() => togglePartition(i)}
                        disabled={challengeDone}
                        className={`flex-1 border-r border-slate-600 last:border-r-0 transition-all duration-200 flex items-center justify-center ${
                          challengeDone
                            ? 'cursor-default'
                            : 'cursor-pointer hover:brightness-110'
                        } ${
                          isShaded
                            ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                            : 'bg-slate-700/50 hover:bg-slate-700'
                        }`}
                        title={`${isShaded ? 'Unshade' : 'Shade'} part ${i + 1}`}
                      >
                        {denominator <= 12 && (
                          <span className="text-xs text-white/40 font-mono">{i + 1}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {showDecimal && (
                  <div className="text-xs text-slate-400 text-right font-mono mb-4">
                    {'≈'} {(shadedCount / denominator).toFixed(3)}
                  </div>
                )}

                <button
                  onClick={handleSubmitBuild}
                  disabled={challengeDone}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-6 rounded-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Submit Fraction
                </button>
              </div>
            </div>
          )}

          {/* ── Feedback bar ───────────────────────────────── */}
          {feedback && (
            <div
              className={`p-4 rounded-xl mb-6 border transition-all duration-300 ${feedbackColors[feedbackType]}`}
            >
              {feedback}
            </div>
          )}

          {/* ── Between-challenge interstitial ──────────────── */}
          {challengeDone && (
            <div className="glass-panel rounded-2xl border border-emerald-500/30 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-emerald-300">
                  &#x2713; Problem {currentIndex + 1} complete!
                </h4>
                {hasNextChallenge ? (
                  <Button
                    variant="ghost"
                    onClick={handleNextChallenge}
                    className="bg-purple-500/80 text-white border border-purple-400/30 hover:bg-purple-500"
                  >
                    Next Problem →
                  </Button>
                ) : (
                  <span className="text-sm text-slate-400 font-mono uppercase tracking-wider">
                    Last problem
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-300">
                You correctly built the fraction{' '}
                <span className="font-bold text-white">
                  {numerator}/{denominator}
                </span>{' '}
                by shading {numerator} out of {denominator} equal parts.
              </p>
            </div>
          )}

          {/* ── Bottom actions ─────────────────────────────── */}
          {!challengeDone && (
            <div className="flex gap-3 pt-4 border-t border-white/10">
              <Button
                variant="ghost"
                onClick={handleShowHint}
                className="px-5 py-2.5 bg-white/5 text-slate-300 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20"
              >
                Show Hint
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FractionBar;
