'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  usePrimitiveEvaluation,
  type FractionBarMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';

/**
 * Fraction Bar — Multi-phase interactive fraction model
 *
 * Three-phase educational flow:
 *   Phase 1: Identify the Numerator (multiple choice)
 *   Phase 2: Identify the Denominator (multiple choice)
 *   Phase 3: Build the Fraction on the bar (shade partitions)
 *
 * AI tutoring triggers at every pedagogical moment:
 *   [ACTIVITY_START]      — introduce the fraction challenge
 *   [ANSWER_CORRECT]      — celebrate correct MC answer
 *   [ANSWER_INCORRECT]    — nudge after wrong MC answer
 *   [PHASE_TRANSITION]    — introduce the next phase
 *   [BUILD_CORRECT]       — celebrate successful bar construction
 *   [BUILD_INCORRECT]     — coach on shading error
 *   [ALL_COMPLETE]        — celebrate full completion
 *   [HINT_REQUESTED]      — student asked for help
 *
 * Tracks per-phase accuracy, attempts, and interaction metrics.
 */

export interface FractionBarData {
  title: string;
  description: string;
  numerator: number;            // Target numerator (parts to shade)
  denominator: number;          // Target denominator (total equal parts)
  showDecimal?: boolean;        // Show decimal approximation in build phase
  gradeLevel?: string;          // Grade level for age-appropriate language
  numeratorChoices?: number[];  // Pre-generated MC options for phase 1
  denominatorChoices?: number[];// Pre-generated MC options for phase 2

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

/** Compute a phase score from attempt count (shared between submit and summary) */
function computePhaseScore(attempts: number, penalty: number): number {
  if (attempts <= 1) return 100;
  return Math.max(50, 100 - (attempts - 1) * penalty);
}

const FractionBar: React.FC<FractionBarProps> = ({ data, className }) => {
  const {
    title,
    description,
    numerator,
    denominator,
    showDecimal = true,
    gradeLevel,
    numeratorChoices: providedNumeratorChoices,
    denominatorChoices: providedDenominatorChoices,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const resolvedInstanceId = instanceId || `fraction-bar-${Date.now()}`;

  // ── Phase state ──────────────────────────────────────────────
  const [currentPhase, setCurrentPhase] = useState<LearningPhase>('identify-numerator');
  const [feedback, setFeedback] = useState<string>('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'hint' | 'info'>('info');

  // Phase 1: Identify numerator
  const [selectedNumerator, setSelectedNumerator] = useState<number | null>(null);
  const [numeratorAttempts, setNumeratorAttempts] = useState(0);

  // Phase 2: Identify denominator
  const [selectedDenominator, setSelectedDenominator] = useState<number | null>(null);
  const [denominatorAttempts, setDenominatorAttempts] = useState(0);

  // Phase 3: Build fraction on bar
  const [shadedCount, setShadedCount] = useState(0);
  const [shadingChanges, setShadingChanges] = useState(0);
  const [buildAttempts, setBuildAttempts] = useState(0);

  // Hints
  const [hintsUsed, setHintsUsed] = useState(0);

  // ── AI Tutoring ──────────────────────────────────────────────
  const aiPrimitiveData = useMemo(
    () => ({
      numerator,
      denominator,
      currentPhase,
      shadedCount,
      gradeLevel: gradeLevel || 'Grade 3',
    }),
    [numerator, denominator, currentPhase, shadedCount, gradeLevel],
  );

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'fraction-bar',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // Activity start — introduce the challenge
  useEffect(() => {
    if (!isConnected) return;
    sendText(
      `[ACTIVITY_START] This is a multi-phase fraction bar activity for ${gradeLevel || 'Grade 3'}. `
        + `The student will learn about the fraction ${numerator}/${denominator}. `
        + `Phase 1: identify the numerator. Phase 2: identify the denominator. Phase 3: build the fraction by shading ${numerator} of ${denominator} parts. `
        + `Introduce the activity warmly and briefly.`,
      { silent: true },
    );
  }, [isConnected, numerator, denominator, gradeLevel, sendText]);

  // ── Evaluation hook ──────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<FractionBarMetrics>({
    primitiveType: 'fraction-bar',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Phase summary data (for PhaseSummaryPanel) ─────────────
  const phaseSummaryData = useMemo((): PhaseResult[] => {
    if (!hasSubmittedEvaluation) return [];

    const p1Score = computePhaseScore(numeratorAttempts, 20);
    const p2Score = computePhaseScore(denominatorAttempts, 20);
    // buildAttempts is 0-indexed at submit time, so +1 for display
    const p3Score = buildAttempts === 0 ? 100 : Math.max(50, 100 - buildAttempts * 15);

    return [
      {
        label: 'Identify the Numerator',
        score: p1Score,
        attempts: numeratorAttempts,
        firstTry: numeratorAttempts === 1,
        icon: '\uD83D\uDD22',
        accentColor: 'purple',
      },
      {
        label: 'Identify the Denominator',
        score: p2Score,
        attempts: denominatorAttempts,
        firstTry: denominatorAttempts === 1,
        icon: '\uD83D\uDD22',
        accentColor: 'blue',
      },
      {
        label: 'Build the Fraction',
        score: p3Score,
        attempts: buildAttempts + 1,
        firstTry: buildAttempts === 0,
        icon: '\uD83C\uDFAF',
        accentColor: 'emerald',
      },
    ];
  }, [hasSubmittedEvaluation, numeratorAttempts, denominatorAttempts, buildAttempts]);

  // ── Generate MC choices ──────────────────────────────────────
  const generateChoices = useCallback(
    (correct: number, other: number): number[] => {
      const choices = new Set<number>([correct]);
      if (other !== correct) choices.add(other);
      const sum = numerator + denominator;
      if (!choices.has(sum)) choices.add(sum);
      if (correct > 1 && !choices.has(correct - 1)) choices.add(correct - 1);
      if (!choices.has(correct + 1)) choices.add(correct + 1);
      if (!choices.has(correct + 2)) choices.add(correct + 2);
      let v = 1;
      while (choices.size < 4) {
        if (!choices.has(v)) choices.add(v);
        v++;
      }
      return Array.from(choices)
        .sort((a, b) => a - b)
        .slice(0, 4);
    },
    [numerator, denominator],
  );

  const numeratorChoices = useMemo(
    () => providedNumeratorChoices ?? generateChoices(numerator, denominator),
    [providedNumeratorChoices, numerator, denominator, generateChoices],
  );

  const denominatorChoices = useMemo(
    () => providedDenominatorChoices ?? generateChoices(denominator, numerator),
    [providedDenominatorChoices, numerator, denominator, generateChoices],
  );

  // ── Phase 1: Check numerator ─────────────────────────────────
  const handleCheckNumerator = useCallback(() => {
    if (selectedNumerator === null) {
      setFeedback('Please select an answer first!');
      setFeedbackType('error');
      return;
    }
    setNumeratorAttempts((p) => p + 1);

    if (selectedNumerator === numerator) {
      setFeedback(
        `Correct! The numerator is ${numerator} \u2014 it\u2019s the top number that tells us how many parts are shaded.`,
      );
      setFeedbackType('success');

      sendText(
        `[ANSWER_CORRECT] Student correctly identified the numerator as ${numerator} for the fraction ${numerator}/${denominator}. `
          + `Attempt ${numeratorAttempts + 1}. Congratulate briefly and explain what the numerator means.`,
        { silent: true },
      );

      setTimeout(() => {
        setCurrentPhase('identify-denominator');
        setFeedback('');
        sendText(
          `[PHASE_TRANSITION] Moving to Phase 2: Identify the Denominator. `
            + `The student already knows the numerator is ${numerator}. Now they need to identify ${denominator} as the denominator. `
            + `Briefly introduce what the denominator means.`,
          { silent: true },
        );
      }, 2000);
    } else {
      setFeedback(
        `Not quite. The numerator is the top number in a fraction. In ${numerator}/${denominator}, look at which number is on top.`,
      );
      setFeedbackType('error');

      sendText(
        `[ANSWER_INCORRECT] Student chose ${selectedNumerator} but the correct numerator is ${numerator} for ${numerator}/${denominator}. `
          + `Attempt ${numeratorAttempts + 1}. Give a gentle hint about what the numerator means without giving the answer.`,
        { silent: true },
      );
    }
  }, [selectedNumerator, numerator, denominator, numeratorAttempts, sendText]);

  // ── Phase 2: Check denominator ───────────────────────────────
  const handleCheckDenominator = useCallback(() => {
    if (selectedDenominator === null) {
      setFeedback('Please select an answer first!');
      setFeedbackType('error');
      return;
    }
    setDenominatorAttempts((p) => p + 1);

    if (selectedDenominator === denominator) {
      setFeedback(
        `Correct! The denominator is ${denominator} \u2014 it\u2019s the bottom number that tells us how many equal parts make up the whole.`,
      );
      setFeedbackType('success');

      sendText(
        `[ANSWER_CORRECT] Student correctly identified the denominator as ${denominator} for ${numerator}/${denominator}. `
          + `Attempt ${denominatorAttempts + 1}. Congratulate and explain what the denominator means.`,
        { silent: true },
      );

      setTimeout(() => {
        setCurrentPhase('build-fraction');
        setFeedback('');
        sendText(
          `[PHASE_TRANSITION] Moving to Phase 3: Build the Fraction. `
            + `The student knows that in ${numerator}/${denominator}, the numerator is ${numerator} and the denominator is ${denominator}. `
            + `Now they must shade exactly ${numerator} out of ${denominator} equal parts on the bar. Encourage them to apply what they learned.`,
          { silent: true },
        );
      }, 2000);
    } else {
      setFeedback(
        `Not quite. The denominator is the bottom number in a fraction. In ${numerator}/${denominator}, look at which number is on the bottom.`,
      );
      setFeedbackType('error');

      sendText(
        `[ANSWER_INCORRECT] Student chose ${selectedDenominator} but the correct denominator is ${denominator} for ${numerator}/${denominator}. `
          + `Attempt ${denominatorAttempts + 1}. Give a gentle hint about what the denominator means without giving the answer.`,
        { silent: true },
      );
    }
  }, [selectedDenominator, numerator, denominator, denominatorAttempts, sendText]);

  // ── Phase 3: Toggle partition ────────────────────────────────
  const togglePartition = useCallback(
    (partitionIndex: number) => {
      if (partitionIndex < shadedCount) {
        setShadedCount(partitionIndex);
      } else {
        setShadedCount(partitionIndex + 1);
      }
      setShadingChanges((p) => p + 1);
    },
    [shadedCount],
  );

  // ── Phase 3: Submit build ────────────────────────────────────
  const handleSubmitBuild = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    setBuildAttempts((p) => p + 1);

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
          + `Attempt ${buildAttempts + 1}. ${
            shadedCount < numerator
              ? `They shaded too few parts (${numerator - shadedCount} short). Encourage them to shade more.`
              : `They shaded too many parts (${shadedCount - numerator} extra). Encourage them to unshade some.`
          }`,
        { silent: true },
      );
      return;
    }

    // ── Score each phase ──
    const p1 = computePhaseScore(numeratorAttempts, 20);
    const p2 = computePhaseScore(denominatorAttempts, 20);
    const p3 = buildAttempts === 0 ? 100 : Math.max(50, 100 - buildAttempts * 15);
    const overallScore = Math.round((p1 + p2 + p3) / 3);

    const metrics: FractionBarMetrics = {
      type: 'fraction-bar',

      // Overall
      allPhasesCompleted: true,
      finalSuccess: true,

      // Phase 1
      correctNumerator: numerator,
      studentNumeratorAnswer: selectedNumerator,
      numeratorCorrect: selectedNumerator === numerator,
      numeratorAttempts,

      // Phase 2
      correctDenominator: denominator,
      studentDenominatorAnswer: selectedDenominator,
      denominatorCorrect: selectedDenominator === denominator,
      denominatorAttempts,

      // Phase 3
      targetFraction,
      selectedFraction,
      buildCorrect: true,
      buildAttempts: buildAttempts + 1,
      shadingChanges,

      // Aggregate
      totalAttempts: numeratorAttempts + denominatorAttempts + buildAttempts + 1,
      solvedOnFirstTry: numeratorAttempts === 1 && denominatorAttempts === 1 && buildAttempts === 0,
      hintsUsed,
    };

    submitEvaluation(true, overallScore, metrics, {
      studentWork: {
        phases: {
          identifyNumerator: { answer: selectedNumerator, attempts: numeratorAttempts },
          identifyDenominator: { answer: selectedDenominator, attempts: denominatorAttempts },
          buildFraction: { shadedCount, attempts: buildAttempts + 1 },
        },
      },
    });

    setFeedback(
      `Excellent! You correctly built the fraction ${targetFraction} by shading ${numerator} out of ${denominator} equal parts!`,
    );
    setFeedbackType('success');

    sendText(
      `[ALL_COMPLETE] Student completed all 3 phases for ${numerator}/${denominator}! `
        + `Phase scores: Identify Numerator ${p1}% (${numeratorAttempts} attempt${numeratorAttempts !== 1 ? 's' : ''}), `
        + `Identify Denominator ${p2}% (${denominatorAttempts} attempt${denominatorAttempts !== 1 ? 's' : ''}), `
        + `Build Fraction ${p3}% (${buildAttempts + 1} attempt${buildAttempts !== 0 ? 's' : ''}). `
        + `Overall: ${overallScore}%. Hints used: ${hintsUsed}. `
        + `Give a brief, encouraging summary of their performance across all three phases. `
        + `If any phase had multiple attempts, mention what they could practice more.`,
      { silent: true },
    );
  }, [
    shadedCount,
    numerator,
    denominator,
    hasSubmittedEvaluation,
    numeratorAttempts,
    denominatorAttempts,
    buildAttempts,
    selectedNumerator,
    selectedDenominator,
    shadingChanges,
    hintsUsed,
    submitEvaluation,
    sendText,
  ]);

  // ── Hints ────────────────────────────────────────────────────
  const handleShowHint = useCallback(() => {
    setHintsUsed((p) => p + 1);
    setFeedbackType('hint');

    if (currentPhase === 'identify-numerator') {
      setFeedback(
        `Hint: The numerator is always the top number in a fraction. In ${numerator}/${denominator}, which number is on top?`,
      );
      sendText(
        `[HINT_REQUESTED] Student asked for a hint during Phase 1 (Identify Numerator) for ${numerator}/${denominator}. `
          + `Hint #${hintsUsed + 1}. Give a scaffolded hint about numerators without revealing the answer.`,
        { silent: true },
      );
    } else if (currentPhase === 'identify-denominator') {
      setFeedback(
        `Hint: The denominator is always the bottom number in a fraction. It tells us how many equal parts the whole is divided into.`,
      );
      sendText(
        `[HINT_REQUESTED] Student asked for a hint during Phase 2 (Identify Denominator) for ${numerator}/${denominator}. `
          + `Hint #${hintsUsed + 1}. Give a scaffolded hint about denominators without revealing the answer.`,
        { silent: true },
      );
    } else {
      setFeedback(
        `Hint: You need to shade exactly ${numerator} parts out of ${denominator}. Click parts from left to right to shade them!`,
      );
      sendText(
        `[HINT_REQUESTED] Student asked for a hint during Phase 3 (Build Fraction). `
          + `They have ${shadedCount}/${denominator} shaded, target is ${numerator}/${denominator}. `
          + `Hint #${hintsUsed + 1}. Guide them on how many parts to shade.`,
        { silent: true },
      );
    }
  }, [currentPhase, numerator, denominator, hintsUsed, shadedCount, sendText]);

  // ── Reset ────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setCurrentPhase('identify-numerator');
    setSelectedNumerator(null);
    setSelectedDenominator(null);
    setShadedCount(0);
    setNumeratorAttempts(0);
    setDenominatorAttempts(0);
    setBuildAttempts(0);
    setShadingChanges(0);
    setHintsUsed(0);
    setFeedback('');
    setFeedbackType('info');
    resetEvaluationAttempt();
  }, [resetEvaluationAttempt]);

  // ── Helpers ──────────────────────────────────────────────────
  const feedbackColors: Record<typeof feedbackType, string> = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    error: 'bg-red-500/10 border-red-500/30 text-red-300',
    hint: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    info: 'bg-white/5 border-white/10 text-slate-300',
  };

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

          {/* ── Phase progress indicator ───────────────────── */}
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
                {currentPhase === 'identify-numerator' ? '\uD83D\uDD22' : '\u2705'}
              </span>
              <span className="font-medium text-sm">1. Numerator</span>
            </div>
            <div className="text-slate-600">{'\u2192'}</div>

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
                  ? '\u2705'
                  : currentPhase === 'identify-denominator'
                    ? '\uD83D\uDD22'
                    : '\uD83D\uDD22'}
              </span>
              <span className="font-medium text-sm">2. Denominator</span>
            </div>
            <div className="text-slate-600">{'\u2192'}</div>

            {/* Phase 3 pill */}
            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                currentPhase === 'build-fraction'
                  ? 'glass-panel border-white/30 text-white shadow-lg scale-105'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              <span className="text-lg">
                {hasSubmittedEvaluation ? '\u2705' : '\uD83C\uDFAF'}
              </span>
              <span className="font-medium text-sm">3. Build It</span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              Phase 1 — Identify the Numerator
             ═══════════════════════════════════════════════════ */}
          {currentPhase === 'identify-numerator' && (
            <div className="glass-panel rounded-2xl border border-purple-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">{'\uD83D\uDD22'}</span>
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
                  {numeratorChoices.map((choice) => (
                    <button
                      key={choice}
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
          {currentPhase === 'identify-denominator' && (
            <div className="glass-panel rounded-2xl border border-blue-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">{'\uD83D\uDD22'}</span>
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
                  {denominatorChoices.map((choice) => (
                    <button
                      key={choice}
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
          {currentPhase === 'build-fraction' && (
            <div className="glass-panel rounded-2xl border border-emerald-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">{'\uD83C\uDFAF'}</span>
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
                        onClick={() => !hasSubmittedEvaluation && togglePartition(i)}
                        disabled={hasSubmittedEvaluation}
                        className={`flex-1 border-r border-slate-600 last:border-r-0 transition-all duration-200 flex items-center justify-center ${
                          hasSubmittedEvaluation
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
                    {'\u2248'} {(shadedCount / denominator).toFixed(3)}
                  </div>
                )}

                <button
                  onClick={handleSubmitBuild}
                  disabled={hasSubmittedEvaluation}
                  className={`w-full font-medium py-3 px-6 rounded-xl transition-all duration-300 hover:scale-[1.02] ${
                    hasSubmittedEvaluation
                      ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {hasSubmittedEvaluation ? '\u2713 Submitted' : 'Submit Fraction'}
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

          {/* ── Phase Evaluation Summary ────────────────────── */}
          {hasSubmittedEvaluation && phaseSummaryData.length > 0 && (
            <PhaseSummaryPanel
              phases={phaseSummaryData}
              overallScore={submittedResult?.score}
              durationMs={elapsedMs}
              heading="Fraction Challenge Complete!"
              celebrationMessage={`You correctly built the fraction ${numerator}/${denominator} by shading ${numerator} out of ${denominator} equal parts!`}
              className="mb-6"
            />
          )}

          {/* ── Bottom actions ─────────────────────────────── */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <Button
              variant="ghost"
              onClick={handleShowHint}
              className="px-5 py-2.5 bg-white/5 text-slate-300 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20"
            >
              Show Hint
            </Button>
            {hasSubmittedEvaluation && (
              <Button
                variant="ghost"
                onClick={handleReset}
                className="px-5 py-2.5 bg-white/5 text-slate-300 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20"
              >
                Try Again
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FractionBar;
