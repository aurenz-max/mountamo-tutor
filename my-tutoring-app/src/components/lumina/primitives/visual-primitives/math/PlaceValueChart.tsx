'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  usePrimitiveEvaluation,
  type PlaceValueChartMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

/**
 * Place Value Chart — multi-challenge place value model.
 *
 * Session walks the student through 3 distinct numbers in the SAME eval mode.
 * Each challenge has its own 3-phase within-challenge flow:
 *   Phase 1: Identify the Place (MC — which place is this digit in?)
 *   Phase 2: Find the Value     (MC — what is this digit worth?)
 *   Phase 3: Build the Number   (interactive — enter digits to construct)
 *
 * Per PRD §6c, every per-challenge state slot must reset on advance — see the
 * reset useEffect below. Per §6a #8, the stale-state guard lives in
 * completeCurrentChallenge (handler-driven, not effect-driven).
 */

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type PlaceValueChartChallengeType =
  | 'identify'
  | 'build'
  | 'compare'
  | 'expanded_form';

/** One place-value challenge. Owns its own number + place range + MC choices. */
export interface PlaceValueChartChallenge {
  id: string;
  targetNumber: number;
  highlightedDigitPlace: number;
  minPlace: number;
  maxPlace: number;
  placeNameChoices: string[];
  /**
   * Phase 2 MC. Display uses `wordForm` ("Seventy"); correctness compares on
   * `value`. Word-form forces students to retrieve place-value vocabulary
   * instead of mechanically appending zeros to the visible digit (PVC-1).
   */
  digitValueChoices: { value: number; wordForm: string }[];
}

export interface PlaceValueChartData {
  title: string;
  description: string;
  /** 1-6 challenges. Walked sequentially by the component. */
  challenges: PlaceValueChartChallenge[];
  /** Eval mode pinned for this session (all challenges share one mode). */
  challengeType: PlaceValueChartChallengeType;

  // Session-level flags
  showExpandedForm?: boolean;
  showMultipliers?: boolean;
  /**
   * Within-mode support tier ('easy' | 'medium' | 'hard'). Set by the generator
   * whenever the manifest pins config.difficulty. Drives the tutor's reveal level
   * so it stays in sync with the on-chart scaffolds (multipliers / expanded-form
   * panel) the tier withdrew. Absent = no tier (legacy default behavior).
   */
  supportTier?: 'easy' | 'medium' | 'hard';
  gradeLevel?: string;

  // Evaluation integration (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PlaceValueChartMetrics>) => void;
}

interface PlaceValueChartProps {
  data: PlaceValueChartData;
  className?: string;
}

// ============================================================================
// Within-challenge phase types
// ============================================================================

type LearningPhase = 'identify-place' | 'find-value' | 'build-number' | 'challenge-done';

type FeedbackTone = 'success' | 'error' | 'hint' | 'info';

// ============================================================================
// Constants
// ============================================================================

const PLACE_NAMES: Record<number, string> = {
  6: 'Millions',
  5: 'Hundred Thousands',
  4: 'Ten Thousands',
  3: 'Thousands',
  2: 'Hundreds',
  1: 'Tens',
  0: 'Ones',
  '-1': 'Tenths',
  '-2': 'Hundredths',
  '-3': 'Thousandths',
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  identify:      { label: 'Identify',      icon: '📍', accentColor: 'purple' },
  build:         { label: 'Build',         icon: '🏗️', accentColor: 'emerald' },
  compare:       { label: 'Compare',       icon: '⚖️', accentColor: 'amber' },
  expanded_form: { label: 'Expanded Form', icon: '🧮', accentColor: 'blue' },
};

// ============================================================================
// Helpers
// ============================================================================

function getPlaceName(place: number): string {
  return PLACE_NAMES[place] || `10^${place}`;
}

function getMultiplierLabel(place: number): string {
  if (place === 0) return '×1';
  if (place > 0) return `×${Math.pow(10, place).toLocaleString()}`;
  return `×${(1 / Math.pow(10, Math.abs(place))).toString()}`;
}

function getDigitAtPlace(value: number, place: number): number {
  const abs = Math.abs(value);
  if (place >= 0) {
    return Math.floor(abs / Math.pow(10, place)) % 10;
  }
  const decimalStr = abs.toFixed(Math.abs(place));
  const parts = decimalStr.split('.');
  if (!parts[1]) return 0;
  const idx = Math.abs(place) - 1;
  return idx < parts[1].length ? parseInt(parts[1][idx], 10) : 0;
}

function getDigitValue(digit: number, place: number): number {
  return digit * Math.pow(10, place);
}

/** Per-phase score: 100 first try, then -20 per extra attempt, floored at 20. */
function phaseScore(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.max(20, 100 - (attempts - 1) * 20);
}

/**
 * Tutor reveal level, calibrated to match the on-chart scaffolds the support
 * tier withdrew. Keeps the tutor from leaking what the tier hid:
 *   easy   → may name the place-value strategy / show expanded-form decomposition.
 *   medium → strategy is on-screen; nudge execution only, don't decompose for them.
 *   hard   → multipliers + panel gone; do NOT gift the decomposition — ask what
 *            each column is worth and let the student produce it.
 * Absent tier → legacy default coaching (treated like medium-ish nudging).
 */
function tutorRevealClause(tier?: 'easy' | 'medium' | 'hard'): string {
  switch (tier) {
    case 'easy':
      return 'TIER easy: maximum support — you may name the place-value strategy and walk the expanded-form decomposition (e.g. "300 + 40 + 7") step by step.';
    case 'medium':
      return 'TIER medium: the expanded-form panel is on-screen but multiplier labels are gone — nudge the student to read it and reason about each column; do NOT decompose the whole number for them.';
    case 'hard':
      return 'TIER hard: multiplier labels and the expanded-form panel are withdrawn — do NOT name the decomposition or the place value. Ask what each column is worth and let the student produce it; never reveal the answer.';
    default:
      return '';
  }
}

// ============================================================================
// Component
// ============================================================================

const PlaceValueChart: React.FC<PlaceValueChartProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    challengeType: sessionChallengeType,
    showExpandedForm = true,
    showMultipliers = true,
    supportTier,
    gradeLevel,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `place-value-chart-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Challenge progress ─────────────────────────────────────────
  const {
    currentIndex,
    results,
    isComplete,
    recordResult,
    advance,
  } = useChallengeProgress<PlaceValueChartChallenge>({
    challenges,
    getChallengeId: (c) => c.id,
  });

  const currentChallenge = challenges[currentIndex] ?? null;
  const targetNumber = currentChallenge?.targetNumber ?? 0;
  const highlightedDigitPlace = currentChallenge?.highlightedDigitPlace ?? 0;
  const minPlace = currentChallenge?.minPlace ?? 0;
  const maxPlace = currentChallenge?.maxPlace ?? 3;
  const placeNameChoices = currentChallenge?.placeNameChoices ?? [];
  const digitValueChoices = currentChallenge?.digitValueChoices ?? [];

  const highlightedDigit = currentChallenge
    ? getDigitAtPlace(targetNumber, highlightedDigitPlace)
    : 0;
  const highlightedValue = getDigitValue(highlightedDigit, highlightedDigitPlace);
  const correctPlaceName = getPlaceName(highlightedDigitPlace);

  const places = useMemo(() => {
    const arr: number[] = [];
    for (let p = maxPlace; p >= minPlace; p--) arr.push(p);
    return arr;
  }, [maxPlace, minPlace]);

  // ── Per-challenge interaction state (resets on advance) ────────
  const [currentPhase, setCurrentPhase] = useState<LearningPhase>('identify-place');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<FeedbackTone>('info');
  const [selectedPlaceName, setSelectedPlaceName] = useState<string | null>(null);
  const [placeAttempts, setPlaceAttempts] = useState(0);
  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  const [valueAttempts, setValueAttempts] = useState(0);
  const [digits, setDigits] = useState<Record<number, string>>({});
  const [digitChangeCount, setDigitChangeCount] = useState(0);
  const [buildAttempts, setBuildAttempts] = useState(0);
  const [challengeHintCount, setChallengeHintCount] = useState(0);

  const recordedRef = useRef(false);
  const sessionCompleteFiredRef = useRef(false);

  // Reset every per-challenge slot when the active challenge changes.
  // PRD §6c: missing any slot leaks state from challenge N into challenge N+1.
  useEffect(() => {
    if (!currentChallenge) return;
    setCurrentPhase('identify-place');
    setFeedback('');
    setFeedbackType('info');
    setSelectedPlaceName(null);
    setPlaceAttempts(0);
    setSelectedValue(null);
    setValueAttempts(0);
    setDigits({});
    setDigitChangeCount(0);
    setBuildAttempts(0);
    setChallengeHintCount(0);
    recordedRef.current = false;
  }, [currentChallenge?.id]);

  // ── Evaluation hook ────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<PlaceValueChartMetrics>({
    primitiveType: 'place-value-chart',
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

  // ── AI Tutoring ────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    title,
    challengeType: sessionChallengeType,
    currentChallengeIndex: currentIndex,
    totalChallenges: challenges.length,
    targetNumber,
    highlightedDigit,
    highlightedPlace: correctPlaceName,
    highlightedValue,
    currentPhase,
    supportTier,
    gradeLevel: gradeLevel || 'Grade 3',
  }), [
    title, sessionChallengeType, currentIndex, challenges.length,
    targetNumber, highlightedDigit, correctPlaceName, highlightedValue,
    currentPhase, supportTier, gradeLevel,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'place-value-chart',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    if (challenges.length === 0 || !currentChallenge) return;
    hasIntroducedRef.current = true;
    const tierClause = tutorRevealClause(supportTier);
    sendText(
      `[ACTIVITY_START] Place value chart session: ${sessionChallengeType} mode, ${challenges.length} numbers. `
      + `Each number runs through three phases (identify place, find value, build). `
      + `First number: ${targetNumber.toLocaleString()}. Guide warmly.`
      + (tierClause ? ` ${tierClause}` : ''),
      { silent: true },
    );
  }, [isConnected, currentChallenge, challenges.length, sessionChallengeType, targetNumber, supportTier, sendText]);

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
      `[CHALLENGE_START] Number ${currentIndex + 1} of ${challenges.length}: ${targetNumber.toLocaleString()}. `
      + `Highlighted digit: ${highlightedDigit} in the ${correctPlaceName} place. `
      + `Start with Phase 1 (identify the place).`,
      { silent: true },
    );
  }, [
    currentChallenge, currentIndex, challenges.length, targetNumber,
    highlightedDigit, correctPlaceName, isConnected, sendText,
  ]);

  // ── Per-challenge content match (stale-state guard, §6a #8) ────
  const stateMatchesChallenge = useCallback(
    (challenge: PlaceValueChartChallenge | null): boolean => {
      if (!challenge) return false;
      const expectedDigit = getDigitAtPlace(
        challenge.targetNumber,
        challenge.highlightedDigitPlace,
      );
      // The handler that called us reads highlightedDigit (derived from
      // currentChallenge). If those match, state belongs to this challenge.
      return expectedDigit === highlightedDigit;
    },
    [highlightedDigit],
  );

  // ── Per-challenge completion (called from build-phase submit) ──
  const completeCurrentChallenge = useCallback(
    (correct: boolean, score: number, extras: Record<string, unknown> = {}) => {
      if (!currentChallenge) return;
      if (recordedRef.current) return;
      if (!stateMatchesChallenge(currentChallenge)) return;
      recordedRef.current = true;
      recordResult({
        challengeId: currentChallenge.id,
        correct,
        attempts: placeAttempts + valueAttempts + buildAttempts,
        score,
        hintsUsed: challengeHintCount,
        ...extras,
      });
    },
    [
      currentChallenge, stateMatchesChallenge, recordResult,
      placeAttempts, valueAttempts, buildAttempts, challengeHintCount,
    ],
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

    const metrics: PlaceValueChartMetrics = {
      type: 'place-value-chart',
      challengeType: sessionChallengeType,
      totalChallenges: challenges.length,
      correctCount,
      attemptsCount: totalAttempts,
      firstTryCount,
      hintsViewed,
      overallAccuracy,
      averageAttemptsPerChallenge,
    };

    sendText(
      `[ALL_COMPLETE] Place value session complete. ${correctCount}/${challenges.length} correct. `
      + `Overall accuracy: ${overallAccuracy}%. Celebrate completion.`,
      { silent: true },
    );

    if (!hasSubmittedEvaluation) {
      const goalMet = correctCount === challenges.length;
      submitEvaluation(goalMet, overallAccuracy, metrics, {
        studentWork: {
          challengeCount: challenges.length,
          challengeType: sessionChallengeType,
          numbers: challenges.map((c) => c.targetNumber),
          scoresPerChallenge: challenges.map((c) => {
            const r = results.find((rr) => rr.challengeId === c.id);
            return Number(r?.score ?? 0);
          }),
        },
      });
    }
  }, [
    isComplete, results, challenges, sessionChallengeType,
    sendText, submitEvaluation, hasSubmittedEvaluation,
  ]);

  // ── Phase 1: Check place name ──────────────────────────────────
  const handleCheckPlace = useCallback(() => {
    if (!currentChallenge) return;
    if (selectedPlaceName === null) {
      setFeedback('Please select an answer first!');
      setFeedbackType('error');
      return;
    }
    const nextPlaceAttempts = placeAttempts + 1;
    setPlaceAttempts(nextPlaceAttempts);

    if (selectedPlaceName === correctPlaceName) {
      SoundManager.playCorrect();
      setFeedback(`Correct! The digit ${highlightedDigit} is in the ${correctPlaceName} place.`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Phase 1 (challenge ${currentIndex + 1}/${challenges.length}). `
        + `Digit ${highlightedDigit} is in the ${correctPlaceName} place of ${targetNumber.toLocaleString()}. `
        + `Attempt ${nextPlaceAttempts}. Brief celebration.`,
        { silent: true },
      );
      setTimeout(() => {
        setCurrentPhase('find-value');
        setFeedback('');
      }, 1200);
    } else {
      setFeedback(
        `Not quite. Look at where the digit ${highlightedDigit} sits in ${targetNumber.toLocaleString()}. Count positions from the ones place.`,
      );
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Phase 1 (identify the place — the place name IS the answer, so NEVER name it). `
        + `Student chose "${selectedPlaceName}" but digit ${highlightedDigit} is in the ${correctPlaceName} place. `
        + `Attempt ${nextPlaceAttempts}. Gentle hint about counting positions. `
        + tutorRevealClause(supportTier),
        { silent: true },
      );
      SoundManager.playIncorrect();
    }
  }, [
    currentChallenge, selectedPlaceName, correctPlaceName, highlightedDigit,
    targetNumber, placeAttempts, currentIndex, challenges.length, supportTier, sendText,
  ]);

  // ── Phase 2: Check digit value ─────────────────────────────────
  const handleCheckValue = useCallback(() => {
    if (!currentChallenge) return;
    if (selectedValue === null) {
      setFeedback('Please select an answer first!');
      setFeedbackType('error');
      return;
    }
    const nextValueAttempts = valueAttempts + 1;
    setValueAttempts(nextValueAttempts);

    if (selectedValue === highlightedValue) {
      SoundManager.playCorrect();
      const correctWord =
        currentChallenge.digitValueChoices.find((c) => c.value === highlightedValue)?.wordForm
        ?? highlightedValue.toLocaleString();
      setFeedback(
        `Correct! The digit ${highlightedDigit} in the ${correctPlaceName} place is "${correctWord}" (${highlightedValue.toLocaleString()}).`,
      );
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Phase 2 (challenge ${currentIndex + 1}/${challenges.length}). `
        + `Spoken value of digit ${highlightedDigit} in ${correctPlaceName} = "${correctWord}" (${highlightedValue.toLocaleString()}). `
        + `Attempt ${nextValueAttempts}. Brief celebration that reinforces the vocabulary word.`,
        { silent: true },
      );
      setTimeout(() => {
        setCurrentPhase('build-number');
        setFeedback('');
      }, 1200);
    } else {
      const chosen = currentChallenge.digitValueChoices.find((c) => c.value === selectedValue);
      setFeedback(
        `Not quite. Try saying the digit ${highlightedDigit} together with its place name (${correctPlaceName}).`,
      );
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Phase 2 (the spoken value IS the answer, so NEVER say the answer word directly). `
        + `Student chose "${chosen?.wordForm ?? selectedValue}" but correct is the spoken value of digit ${highlightedDigit} in the ${correctPlaceName} place. `
        + `Attempt ${nextValueAttempts}. Coach the student to verbalize the place-value vocabulary (e.g., "thirty", "two hundred", "five tenths"). `
        + tutorRevealClause(supportTier),
        { silent: true },
      );
      SoundManager.playIncorrect();
    }
  }, [
    currentChallenge, selectedValue, highlightedValue, highlightedDigit,
    correctPlaceName, highlightedDigitPlace, valueAttempts,
    currentIndex, challenges.length, supportTier, sendText,
  ]);

  // ── Phase 3: Digit entry ───────────────────────────────────────
  const handleDigitChange = useCallback((place: number, value: string) => {
    if (currentPhase === 'challenge-done') return;
    const sanitized = value.replace(/[^0-9]/g, '').slice(-1);
    if (sanitized !== '') SoundManager.tick();
    setDigits((prev) => {
      const updated = { ...prev };
      if (sanitized === '') {
        delete updated[place];
      } else {
        updated[place] = sanitized;
      }
      return updated;
    });
    setDigitChangeCount((p) => p + 1);
  }, [currentPhase]);

  const calculateStudentValue = useCallback((): number => {
    let value = 0;
    for (let place = maxPlace; place >= minPlace; place--) {
      const d = digits[place] || '0';
      value += parseInt(d, 10) * Math.pow(10, place);
    }
    const decimalPlaces = minPlace < 0 ? Math.abs(minPlace) : 0;
    return parseFloat(value.toFixed(decimalPlaces));
  }, [digits, maxPlace, minPlace]);

  const getExpandedForm = useCallback((): string[] => {
    const parts: string[] = [];
    for (let place = maxPlace; place >= minPlace; place--) {
      const d = digits[place] || '0';
      if (d !== '0') {
        const val = parseInt(d, 10) * Math.pow(10, place);
        parts.push(val.toLocaleString());
      }
    }
    return parts;
  }, [digits, maxPlace, minPlace]);

  // ── Phase 3: Submit build ──────────────────────────────────────
  const handleSubmitBuild = useCallback(() => {
    if (!currentChallenge) return;
    if (currentPhase === 'challenge-done') return;
    const nextBuildAttempts = buildAttempts + 1;
    setBuildAttempts(nextBuildAttempts);

    const studentValue = calculateStudentValue();
    const isCorrect = Math.abs(studentValue - targetNumber) < 0.0001;

    if (!isCorrect) {
      SoundManager.playIncorrect();
      setFeedback(
        `You built ${studentValue.toLocaleString()}, but the target is ${targetNumber.toLocaleString()}. Check each digit's column!`,
      );
      setFeedbackType('error');
      sendText(
        `[BUILD_INCORRECT] Phase 3 (challenge ${currentIndex + 1}/${challenges.length}). `
        + `Built ${studentValue.toLocaleString()}; target ${targetNumber.toLocaleString()}. Attempt ${nextBuildAttempts}. `
        + `Help find the wrong digit without giving the answer. `
        + tutorRevealClause(supportTier),
        { silent: true },
      );
      return;
    }

    const p1 = phaseScore(placeAttempts);
    const p2 = phaseScore(valueAttempts);
    const p3 = phaseScore(nextBuildAttempts);
    const overallScore = Math.round((p1 + p2 + p3) / 3);

    SoundManager.playCorrect();
    setFeedback(`Excellent! You built ${targetNumber.toLocaleString()} correctly!`);
    setFeedbackType('success');
    setCurrentPhase('challenge-done');

    completeCurrentChallenge(true, overallScore, {
      targetNumber,
      finalValue: studentValue,
      placeAttempts,
      valueAttempts,
      buildAttempts: nextBuildAttempts,
      digitChanges: digitChangeCount,
    });

    sendText(
      `[CHALLENGE_COMPLETE] Number ${targetNumber.toLocaleString()} solved. `
      + `Phase scores: Identify ${p1}%, Value ${p2}%, Build ${p3}%. Overall ${overallScore}%. `
      + `${currentIndex + 1 < challenges.length ? 'Brief celebration; next number coming up.' : 'Final number — celebrate the full session!'}`,
      { silent: true },
    );
  }, [
    currentChallenge, currentPhase, buildAttempts, calculateStudentValue,
    targetNumber, placeAttempts, valueAttempts, digitChangeCount,
    currentIndex, challenges.length, completeCurrentChallenge, supportTier, sendText,
  ]);

  // ── Advance to next challenge ──────────────────────────────────
  const handleNextChallenge = useCallback(() => {
    advance();
    // The per-challenge reset useEffect picks up the new currentChallenge.id
    // and resets every state slot. recordedRef is reset there as well.
  }, [advance]);

  // ── Hints ──────────────────────────────────────────────────────
  const handleShowHint = useCallback(() => {
    if (!currentChallenge) return;
    if (currentPhase === 'challenge-done') return;
    setChallengeHintCount((c) => c + 1);
    setFeedbackType('hint');

    if (currentPhase === 'identify-place') {
      setFeedback(
        `Hint: In ${targetNumber.toLocaleString()}, count right-to-left from the ones place to find where ${highlightedDigit} sits.`,
      );
    } else if (currentPhase === 'find-value') {
      setFeedback(
        `Hint: Say the digit name, then the place. For example, a 3 in the Hundreds place is "Three Hundred"; a 5 in the Tens place is "Fifty".`,
      );
    } else {
      setFeedback(
        `Hint: Break ${targetNumber.toLocaleString()} into digits and match each to its column.`,
      );
    }
    sendText(
      `[HINT_REQUESTED] Phase ${currentPhase} for number ${targetNumber.toLocaleString()}. Help without giving the answer.`,
      { silent: true },
    );
  }, [
    currentChallenge, currentPhase, targetNumber, highlightedDigit,
    correctPlaceName, highlightedDigitPlace, sendText,
  ]);

  // ── Feedback color map ─────────────────────────────────────────
  const feedbackColors: Record<FeedbackTone, string> = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    error: 'bg-red-500/10 border-red-500/30 text-red-300',
    hint: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    info: 'bg-white/5 border-white/10 text-slate-300',
  };

  // ── Render number with highlighted digit ───────────────────────
  const renderHighlightedNumber = () => {
    if (!currentChallenge) return null;
    const absStr = Math.abs(targetNumber).toString();
    const parts = absStr.split('.');
    const intPart = parts[0];
    const decPart = parts[1] || '';

    const charElements: React.ReactNode[] = [];
    let charIdx = 0;

    for (let i = 0; i < intPart.length; i++) {
      const place = intPart.length - 1 - i;
      const isHighlighted = place === highlightedDigitPlace;
      if (i > 0 && (intPart.length - i) % 3 === 0) {
        charElements.push(<span key={`comma-${charIdx++}`} className="text-slate-500">,</span>);
      }
      charElements.push(
        <span
          key={`digit-${charIdx++}`}
          className={isHighlighted
            ? 'text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded-lg border border-indigo-400/40 mx-0.5'
            : 'text-white'}
        >
          {intPart[i]}
        </span>,
      );
    }

    if (decPart) {
      charElements.push(<span key={`dot-${charIdx++}`} className="text-yellow-400">.</span>);
      for (let i = 0; i < decPart.length; i++) {
        const place = -(i + 1);
        const isHighlighted = place === highlightedDigitPlace;
        charElements.push(
          <span
            key={`dec-${charIdx++}`}
            className={isHighlighted
              ? 'text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded-lg border border-indigo-400/40 mx-0.5'
              : 'text-white'}
          >
            {decPart[i]}
          </span>,
        );
      }
    }

    return charElements;
  };

  // ── Empty state ────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <div className={`w-full ${className || ''}`}>
        <div className="max-w-6xl mx-auto p-8 text-center text-slate-400">
          No place value challenges available.
        </div>
      </div>
    );
  }

  const hasNextChallenge = currentIndex + 1 < challenges.length;

  return (
    <div className={`w-full ${className || ''}`}>
      <div className="max-w-6xl mx-auto glass-panel rounded-3xl border border-white/10 p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-15 bg-indigo-500" />

        <div className="relative z-10">
          {/* ── Header ─────────────────────────────────── */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Math:</span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-mono border bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                PLACE VALUE CHART
              </span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-mono border bg-white/5 text-slate-300 border-white/10">
                {sessionChallengeType}
              </span>
            </div>
            <h2 className="text-3xl font-light text-white mb-3">{title}</h2>
            <p className="text-slate-300 leading-relaxed">{description}</p>
          </div>

          {/* ── Session progress dots ──────────────────── */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {challenges.map((c, idx) => {
              const r = results.find((rr) => rr.challengeId === c.id);
              const isDone = !!r;
              const isCurrent = idx === currentIndex && !isComplete;
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <div
                    className={`flex items-center justify-center rounded-full border text-xs font-mono w-8 h-8 ${
                      isDone
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : isCurrent
                          ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/50 shadow-lg scale-105'
                          : 'bg-white/5 text-slate-500 border-white/10'
                    }`}
                  >
                    {isDone ? '✓' : idx + 1}
                  </div>
                  {idx < challenges.length - 1 && <div className="w-4 h-px bg-slate-600/40" />}
                </div>
              );
            })}
            <span className="ml-3 text-xs font-mono text-slate-400">
              Number {Math.min(currentIndex + 1, challenges.length)} of {challenges.length}
            </span>
          </div>

          {/* ── Number display ─────────────────────────── */}
          {!isComplete && currentChallenge && (
            <div className="flex justify-center mb-6">
              <div className="glass-panel rounded-2xl border border-indigo-500/20 px-10 py-5 text-center">
                <div className="text-5xl font-bold font-mono flex items-center justify-center gap-0.5">
                  {renderHighlightedNumber()}
                </div>
                {currentPhase !== 'build-number' && currentPhase !== 'challenge-done' && (
                  <div className="mt-3 text-sm text-slate-400">
                    Highlighted digit: <span className="text-indigo-300 font-bold">{highlightedDigit}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Phase indicator ────────────────────────── */}
          {!isComplete && currentChallenge && currentPhase !== 'challenge-done' && (
            <div className="flex items-center justify-center gap-3 mb-6">
              <PhasePill
                label="1. Find the Place"
                icon="📍"
                state={
                  currentPhase === 'identify-place' ? 'current'
                  : 'done'
                }
              />
              <div className="text-slate-600">{'→'}</div>
              <PhasePill
                label="2. Find the Value"
                icon="💰"
                state={
                  currentPhase === 'find-value' ? 'current'
                  : currentPhase === 'build-number' ? 'done'
                  : 'upcoming'
                }
              />
              <div className="text-slate-600">{'→'}</div>
              <PhasePill
                label="3. Build It"
                icon="🏗️"
                state={currentPhase === 'build-number' ? 'current' : 'upcoming'}
              />
            </div>
          )}

          {/* ═══════════════════════════════════════════
              Phase 1 — Identify the Place
              ═══════════════════════════════════════════ */}
          {!isComplete && currentChallenge && currentPhase === 'identify-place' && (
            <div className="glass-panel rounded-2xl border border-indigo-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">{'📍'}</span>
                  Step 1: Identify the Place
                </h3>
                <p className="text-slate-300 leading-relaxed mb-6">
                  In the number{' '}
                  <span className="font-mono font-bold text-white">{targetNumber.toLocaleString()}</span>, which place value is the highlighted digit{' '}
                  <span className="text-indigo-300 font-bold">{highlightedDigit}</span> in?
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {placeNameChoices.map((choice) => (
                    <button
                      key={choice}
                      onClick={() => { SoundManager.select(); setSelectedPlaceName(choice); }}
                      className={`p-4 rounded-xl border text-center transition-all duration-300 text-lg font-semibold ${
                        selectedPlaceName === choice
                          ? 'glass-panel border-indigo-400/50 text-indigo-300 shadow-lg scale-105'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCheckPlace}
                  disabled={selectedPlaceName === null}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-6 rounded-xl disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02]"
                >
                  Check Answer
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════
              Phase 2 — Find the Value
              ═══════════════════════════════════════════ */}
          {!isComplete && currentChallenge && currentPhase === 'find-value' && (
            <div className="glass-panel rounded-2xl border border-amber-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">{'💰'}</span>
                  Step 2: Find the Value
                </h3>
                <p className="text-slate-300 leading-relaxed mb-6">
                  The digit{' '}
                  <span className="text-indigo-300 font-bold">{highlightedDigit}</span> is in the{' '}
                  <span className="text-amber-300 font-semibold">{correctPlaceName}</span> place. How do you{' '}
                  <span className="text-amber-300 font-semibold">say this digit&apos;s value</span> out loud?
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {digitValueChoices.map((choice) => (
                    <button
                      key={choice.value}
                      onClick={() => { SoundManager.select(); setSelectedValue(choice.value); }}
                      className={`p-4 rounded-xl border text-center transition-all duration-300 text-xl font-semibold ${
                        selectedValue === choice.value
                          ? 'glass-panel border-amber-400/50 text-amber-300 shadow-lg scale-105'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      {choice.wordForm}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCheckValue}
                  disabled={selectedValue === null}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium py-3 px-6 rounded-xl disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02]"
                >
                  Check Answer
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════
              Phase 3 — Build the Number
              ═══════════════════════════════════════════ */}
          {!isComplete && currentChallenge && currentPhase === 'build-number' && (
            <div className="glass-panel rounded-2xl border border-emerald-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">{'🏗️'}</span>
                  Step 3: Build the Number
                </h3>
                <p className="text-slate-300 leading-relaxed mb-6">
                  Now build{' '}
                  <span className="font-mono font-bold text-white">{targetNumber.toLocaleString()}</span> by entering each digit in the right column.
                </p>

                <div className="overflow-x-auto pb-4">
                  <div className="inline-block min-w-full">
                    {showMultipliers && (
                      <div className="flex border-b border-white/10 mb-2">
                        {places.map((place) => (
                          <div
                            key={`mult-${place}`}
                            className="flex-1 min-w-[80px] px-2 py-2 text-center text-xs font-mono text-indigo-300/70"
                          >
                            {getMultiplierLabel(place)}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex border-b border-white/10 mb-4">
                      {places.map((place) => (
                        <div
                          key={`name-${place}`}
                          className={`flex-1 min-w-[80px] px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide ${
                            place === 0 ? 'border-l border-r border-yellow-500/30 bg-yellow-500/5' : ''
                          } ${place < 0 ? 'text-purple-300' : 'text-blue-300'}`}
                        >
                          {getPlaceName(place)}
                        </div>
                      ))}
                    </div>

                    <div className="flex">
                      {places.map((place) => (
                        <div
                          key={`digit-${place}`}
                          className={`flex-1 min-w-[80px] px-2 ${
                            place === 0 ? 'border-l border-r border-yellow-500/30' : ''
                          }`}
                        >
                          <input
                            type="text"
                            value={digits[place] || ''}
                            onChange={(e) => handleDigitChange(place, e.target.value)}
                            className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-3 py-4 text-center text-3xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-600"
                            maxLength={1}
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>

                    {minPlace < 0 && (
                      <div className="mt-2 text-center">
                        <div className="inline-block text-yellow-400 text-xs font-mono">
                          {'↑'} Decimal point between Ones and Tenths
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 mb-4">
                  <div className="text-lg font-mono text-white">
                    Your number:{' '}
                    <span
                      className={`font-bold ${
                        Math.abs(calculateStudentValue() - targetNumber) < 0.0001
                          ? 'text-emerald-300'
                          : 'text-indigo-300'
                      }`}
                    >
                      {calculateStudentValue().toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400">
                    Target: <span className="font-mono text-white">{targetNumber.toLocaleString()}</span>
                  </div>
                </div>

                {showExpandedForm && (
                  <div className="mb-4 p-4 bg-slate-800/20 rounded-xl border border-white/5">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">Expanded Form</h4>
                    <div className="text-base text-white font-mono">
                      {getExpandedForm().length > 0 ? getExpandedForm().join(' + ') : <span className="text-slate-500">0</span>}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSubmitBuild}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-6 rounded-xl transition-all duration-300 hover:scale-[1.02]"
                >
                  Submit Number
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════
              Challenge done — between-challenge step
              ═══════════════════════════════════════════ */}
          {!isComplete && currentChallenge && currentPhase === 'challenge-done' && hasNextChallenge && (
            <div className="glass-panel rounded-2xl border border-emerald-500/30 p-6 mb-6 text-center">
              <h3 className="text-xl font-light text-emerald-300 mb-3">Number {currentIndex + 1} complete!</h3>
              <p className="text-slate-300 mb-4">
                You built <span className="font-mono font-bold text-white">{targetNumber.toLocaleString()}</span> across all three phases. Ready for the next number?
              </p>
              <button
                onClick={handleNextChallenge}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-8 rounded-xl transition-all duration-300 hover:scale-[1.02]"
              >
                Next Number →
              </button>
            </div>
          )}

          {/* ── Feedback bar ──────────────────────────── */}
          {feedback && !isComplete && (
            <div className={`p-4 rounded-xl mb-6 border transition-all duration-300 ${feedbackColors[feedbackType]}`}>
              {feedback}
            </div>
          )}

          {/* ── Phase Summary (session complete) ─────── */}
          {isComplete && phaseResults.length > 0 && (
            <PhaseSummaryPanel
              phases={phaseResults}
              overallScore={submittedResult?.score}
              durationMs={elapsedMs}
              heading="Session Complete!"
              celebrationMessage={`You explored ${challenges.length} numbers across all three phases.`}
              className="mb-6"
            />
          )}

          {/* ── Bottom actions ────────────────────────── */}
          {!isComplete && currentPhase !== 'challenge-done' && (
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

// ============================================================================
// Helper components
// ============================================================================

interface PhasePillProps {
  label: string;
  icon: string;
  state: 'current' | 'done' | 'upcoming';
}

const PhasePill: React.FC<PhasePillProps> = ({ label, icon, state }) => (
  <div
    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
      state === 'current'
        ? 'glass-panel border-white/30 text-white shadow-lg scale-105'
        : state === 'done'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : 'bg-white/5 border-white/10 text-slate-400'
    }`}
  >
    <span className="text-lg">{state === 'done' ? '✅' : icon}</span>
    <span className="font-medium text-sm">{label}</span>
  </div>
);

export default PlaceValueChart;
