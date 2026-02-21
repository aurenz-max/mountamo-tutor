'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  usePrimitiveEvaluation,
  type PlaceValueChartMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';

/**
 * Place Value Chart — Multi-phase interactive place value model
 *
 * Three-phase educational flow:
 *   Phase 1: Identify the Place (multiple choice — which place is this digit in?)
 *   Phase 2: Find the Value (multiple choice — what is this digit worth?)
 *   Phase 3: Build the Number (interactive chart — enter digits to construct the number)
 *
 * AI tutoring triggers at every pedagogical moment:
 *   [ACTIVITY_START]      — introduce the place value challenge
 *   [ANSWER_CORRECT]      — celebrate correct MC answer
 *   [ANSWER_INCORRECT]    — nudge after wrong MC answer
 *   [PHASE_TRANSITION]    — introduce the next phase
 *   [BUILD_CORRECT]       — celebrate successful number construction
 *   [BUILD_INCORRECT]     — coach on digit placement error
 *   [ALL_COMPLETE]        — celebrate full completion
 *   [HINT_REQUESTED]      — student asked for help
 *
 * Tracks per-phase accuracy, attempts, and interaction metrics.
 */

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface PlaceValueChartData {
  title: string;
  description: string;
  targetNumber: number;            // The number to study and build
  highlightedDigitPlace: number;   // Which place to highlight for phases 1 & 2 (e.g., 2 = hundreds)
  minPlace: number;                // Smallest place column (e.g., 0 for ones, -2 for hundredths)
  maxPlace: number;                // Largest place column (e.g., 3 for thousands)
  showExpandedForm?: boolean;      // Show expanded form in build phase
  showMultipliers?: boolean;       // Show ×1, ×10, etc. row
  gradeLevel?: string;             // Grade level for age-appropriate language

  // Pre-generated MC options from AI
  placeNameChoices?: string[];     // Phase 1 options (e.g., ["Ones", "Tens", "Hundreds", "Thousands"])
  digitValueChoices?: number[];    // Phase 2 options (e.g., [4, 40, 400, 4000])

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PlaceValueChartMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

type LearningPhase = 'identify-place' | 'find-value' | 'build-number';

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
  // Decimal places
  const decimalStr = abs.toFixed(Math.abs(place));
  const parts = decimalStr.split('.');
  if (!parts[1]) return 0;
  const idx = Math.abs(place) - 1;
  return idx < parts[1].length ? parseInt(parts[1][idx], 10) : 0;
}

function getDigitValue(digit: number, place: number): number {
  return digit * Math.pow(10, place);
}

/** Generate plausible MC distractors for place name identification */
function generatePlaceNameChoices(correctPlace: number, minPlace: number, maxPlace: number): string[] {
  const choices = new Set<string>();
  choices.add(getPlaceName(correctPlace));

  // Add adjacent places as distractors
  for (let p = maxPlace; p >= minPlace && choices.size < 4; p--) {
    if (p !== correctPlace) choices.add(getPlaceName(p));
  }

  return Array.from(choices).slice(0, 4);
}

/** Generate plausible MC distractors for digit value */
function generateDigitValueChoices(digit: number, correctPlace: number): number[] {
  const correctValue = getDigitValue(digit, correctPlace);
  const choices = new Set<number>();
  choices.add(correctValue);

  // Common mistakes: confusing the digit itself with its value
  if (digit !== correctValue) choices.add(digit);

  // Off-by-one-place errors
  if (correctPlace > 0) choices.add(getDigitValue(digit, correctPlace - 1));
  choices.add(getDigitValue(digit, correctPlace + 1));

  // If still need more
  if (correctPlace > 1 && choices.size < 4) choices.add(getDigitValue(digit, correctPlace - 2));
  if (choices.size < 4) choices.add(getDigitValue(digit, correctPlace + 2));

  // Filter zeros and take 4
  return Array.from(choices)
    .filter(v => v !== 0 || correctValue === 0)
    .sort((a, b) => a - b)
    .slice(0, 4);
}

// ============================================================================
// Component
// ============================================================================

interface PlaceValueChartProps {
  data: PlaceValueChartData;
  className?: string;
}

const PlaceValueChart: React.FC<PlaceValueChartProps> = ({ data, className }) => {
  const {
    title,
    description,
    targetNumber,
    highlightedDigitPlace,
    minPlace = 0,
    maxPlace = 3,
    showExpandedForm = true,
    showMultipliers = true,
    gradeLevel,
    placeNameChoices: providedPlaceNameChoices,
    digitValueChoices: providedDigitValueChoices,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `place-value-chart-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Derived constants ──────────────────────────────────────
  const highlightedDigit = getDigitAtPlace(targetNumber, highlightedDigitPlace);
  const highlightedValue = getDigitValue(highlightedDigit, highlightedDigitPlace);
  const correctPlaceName = getPlaceName(highlightedDigitPlace);

  // Build place columns array
  const places = useMemo(() => {
    const arr: number[] = [];
    for (let p = maxPlace; p >= minPlace; p--) arr.push(p);
    return arr;
  }, [maxPlace, minPlace]);

  // ── Phase state ────────────────────────────────────────────
  const [currentPhase, setCurrentPhase] = useState<LearningPhase>('identify-place');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'hint' | 'info'>('info');

  // Phase 1: Identify the place
  const [selectedPlaceName, setSelectedPlaceName] = useState<string | null>(null);
  const [placeAttempts, setPlaceAttempts] = useState(0);

  // Phase 2: Find the value
  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  const [valueAttempts, setValueAttempts] = useState(0);

  // Phase 3: Build the number
  const [digits, setDigits] = useState<Record<number, string>>({});
  const [digitChangeCount, setDigitChangeCount] = useState(0);
  const [buildAttempts, setBuildAttempts] = useState(0);

  // Hints
  const [hintsUsed, setHintsUsed] = useState(0);

  // ── MC Choices ─────────────────────────────────────────────
  const placeNameChoices = useMemo(
    () => providedPlaceNameChoices ?? generatePlaceNameChoices(highlightedDigitPlace, minPlace, maxPlace),
    [providedPlaceNameChoices, highlightedDigitPlace, minPlace, maxPlace],
  );

  const digitValueChoices = useMemo(
    () => providedDigitValueChoices ?? generateDigitValueChoices(highlightedDigit, highlightedDigitPlace),
    [providedDigitValueChoices, highlightedDigit, highlightedDigitPlace],
  );

  // ── AI Tutoring ────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    targetNumber,
    highlightedDigit,
    highlightedPlace: correctPlaceName,
    highlightedValue,
    currentPhase,
    gradeLevel: gradeLevel || 'Grade 3',
  }), [targetNumber, highlightedDigit, correctPlaceName, highlightedValue, currentPhase, gradeLevel]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'place-value-chart',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;

    sendText(
      `[ACTIVITY_START] This is a multi-phase place value chart activity for ${gradeLevel || 'Grade 3'}. `
        + `The student will explore the number ${targetNumber.toLocaleString()}. `
        + `Phase 1: identify which place the digit ${highlightedDigit} is in. `
        + `Phase 2: find the value of that digit. `
        + `Phase 3: build the entire number on the place value chart. `
        + `Introduce the activity warmly: "Let's explore the number ${targetNumber.toLocaleString()} together!"`,
      { silent: true },
    );
  }, [isConnected, targetNumber, highlightedDigit, gradeLevel, sendText]);

  // ── Evaluation hook ────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
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

  // ── Phase summary data (for PhaseSummaryPanel) ─────────────
  const phaseSummaryData = useMemo((): PhaseResult[] => {
    if (!hasSubmittedEvaluation) return [];

    const p1 = placeAttempts === 1 ? 100 : Math.max(50, 100 - (placeAttempts - 1) * 20);
    const p2 = valueAttempts === 1 ? 100 : Math.max(50, 100 - (valueAttempts - 1) * 20);
    const p3 = buildAttempts === 0 ? 100 : Math.max(50, 100 - buildAttempts * 15);

    return [
      { label: 'Identify the Place', score: p1, attempts: placeAttempts, firstTry: placeAttempts === 1, icon: '\uD83D\uDCCD', accentColor: 'purple' },
      { label: 'Find the Value', score: p2, attempts: valueAttempts, firstTry: valueAttempts === 1, icon: '\uD83D\uDCB0', accentColor: 'amber' },
      { label: 'Build the Number', score: p3, attempts: buildAttempts + 1, firstTry: buildAttempts === 0, icon: '\uD83C\uDFD7\uFE0F', accentColor: 'emerald' },
    ];
  }, [hasSubmittedEvaluation, placeAttempts, valueAttempts, buildAttempts]);

  // ── Phase 1: Check place name ──────────────────────────────
  const handleCheckPlace = useCallback(() => {
    if (selectedPlaceName === null) {
      setFeedback('Please select an answer first!');
      setFeedbackType('error');
      return;
    }
    setPlaceAttempts(p => p + 1);

    if (selectedPlaceName === correctPlaceName) {
      setFeedback(
        `Correct! The digit ${highlightedDigit} is in the ${correctPlaceName} place.`,
      );
      setFeedbackType('success');

      sendText(
        `[ANSWER_CORRECT] Student correctly identified that the digit ${highlightedDigit} is in the ${correctPlaceName} place `
          + `in the number ${targetNumber.toLocaleString()}. Attempt ${placeAttempts + 1}. `
          + `Congratulate briefly and explain what this place means.`,
        { silent: true },
      );

      setTimeout(() => {
        setCurrentPhase('find-value');
        setFeedback('');
        sendText(
          `[PHASE_TRANSITION] Moving to Phase 2: Find the Value. `
            + `The student knows the digit ${highlightedDigit} is in the ${correctPlaceName} place. `
            + `Now they need to figure out the value of that digit (${highlightedValue.toLocaleString()}). `
            + `Briefly explain: "Now that you know the place, let's figure out what that digit is worth!"`,
          { silent: true },
        );
      }, 2000);
    } else {
      setFeedback(
        `Not quite. Look at where the digit ${highlightedDigit} sits in the number ${targetNumber.toLocaleString()}. Count the positions from the ones place.`,
      );
      setFeedbackType('error');

      sendText(
        `[ANSWER_INCORRECT] Student chose "${selectedPlaceName}" but the digit ${highlightedDigit} is in the ${correctPlaceName} place `
          + `in ${targetNumber.toLocaleString()}. Attempt ${placeAttempts + 1}. Give a gentle hint.`,
        { silent: true },
      );
    }
  }, [selectedPlaceName, correctPlaceName, highlightedDigit, targetNumber, highlightedValue, placeAttempts, sendText]);

  // ── Phase 2: Check digit value ─────────────────────────────
  const handleCheckValue = useCallback(() => {
    if (selectedValue === null) {
      setFeedback('Please select an answer first!');
      setFeedbackType('error');
      return;
    }
    setValueAttempts(p => p + 1);

    if (selectedValue === highlightedValue) {
      setFeedback(
        `Correct! The digit ${highlightedDigit} in the ${correctPlaceName} place has a value of ${highlightedValue.toLocaleString()}.`,
      );
      setFeedbackType('success');

      sendText(
        `[ANSWER_CORRECT] Student correctly identified that the digit ${highlightedDigit} in the ${correctPlaceName} place `
          + `is worth ${highlightedValue.toLocaleString()} in ${targetNumber.toLocaleString()}. Attempt ${valueAttempts + 1}. `
          + `Congratulate and explain: "${highlightedDigit} × ${getMultiplierLabel(highlightedDigitPlace).slice(1)} = ${highlightedValue.toLocaleString()}".`,
        { silent: true },
      );

      setTimeout(() => {
        setCurrentPhase('build-number');
        setFeedback('');
        sendText(
          `[PHASE_TRANSITION] Moving to Phase 3: Build the Number. `
            + `The student understands that in ${targetNumber.toLocaleString()}, the digit ${highlightedDigit} is in the ${correctPlaceName} place with value ${highlightedValue.toLocaleString()}. `
            + `Now they must build the entire number ${targetNumber.toLocaleString()} by entering each digit in the right column. `
            + `Encourage them: "Now let's put it all together — build ${targetNumber.toLocaleString()} on the chart!"`,
          { silent: true },
        );
      }, 2000);
    } else {
      setFeedback(
        `Not quite. The digit ${highlightedDigit} is in the ${correctPlaceName} place. Multiply ${highlightedDigit} by the place value multiplier.`,
      );
      setFeedbackType('error');

      sendText(
        `[ANSWER_INCORRECT] Student chose ${selectedValue?.toLocaleString()} but the correct value is ${highlightedValue.toLocaleString()} `
          + `(${highlightedDigit} in the ${correctPlaceName} place). Attempt ${valueAttempts + 1}. `
          + `Hint: "What do you get when you multiply ${highlightedDigit} × ${getMultiplierLabel(highlightedDigitPlace).slice(1)}?"`,
        { silent: true },
      );
    }
  }, [selectedValue, highlightedValue, highlightedDigit, correctPlaceName, highlightedDigitPlace, targetNumber, valueAttempts, sendText]);

  // ── Phase 3: Digit entry ───────────────────────────────────
  const handleDigitChange = useCallback((place: number, value: string) => {
    if (hasSubmittedEvaluation) return;
    const sanitized = value.replace(/[^0-9]/g, '').slice(-1);
    setDigits(prev => {
      const updated = { ...prev };
      if (sanitized === '') {
        delete updated[place];
      } else {
        updated[place] = sanitized;
      }
      return updated;
    });
    setDigitChangeCount(p => p + 1);
  }, [hasSubmittedEvaluation]);

  // Calculate the student's number from entered digits
  const calculateStudentValue = useCallback((): number => {
    let value = 0;
    for (let place = maxPlace; place >= minPlace; place--) {
      const d = digits[place] || '0';
      value += parseInt(d, 10) * Math.pow(10, place);
    }
    // Round to avoid floating-point drift
    const decimalPlaces = minPlace < 0 ? Math.abs(minPlace) : 0;
    return parseFloat(value.toFixed(decimalPlaces));
  }, [digits, maxPlace, minPlace]);

  // Get expanded form parts
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

  // ── Phase 3: Submit build ──────────────────────────────────
  const handleSubmitBuild = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    setBuildAttempts(p => p + 1);

    const studentValue = calculateStudentValue();
    const isCorrect = Math.abs(studentValue - targetNumber) < 0.0001;

    if (!isCorrect) {
      setFeedback(
        `You built ${studentValue.toLocaleString()}, but the target is ${targetNumber.toLocaleString()}. Check each digit's position!`,
      );
      setFeedbackType('error');

      sendText(
        `[BUILD_INCORRECT] Student built ${studentValue.toLocaleString()} but target is ${targetNumber.toLocaleString()}. `
          + `Attempt ${buildAttempts + 1}. Help them find which digit is wrong without giving the full answer.`,
        { silent: true },
      );
      return;
    }

    // ── Score each phase ──
    const p1 = placeAttempts === 1 ? 100 : Math.max(50, 100 - (placeAttempts - 1) * 20);
    const p2 = valueAttempts === 1 ? 100 : Math.max(50, 100 - (valueAttempts - 1) * 20);
    const p3 = buildAttempts === 0 ? 100 : Math.max(50, 100 - buildAttempts * 15);
    const overallScore = Math.round((p1 + p2 + p3) / 3);

    const expandedParts = getExpandedForm();
    const totalDigits = Object.values(digits).filter(d => d !== '0').length;
    const usesDecimals = minPlace < 0 && Object.keys(digits).some(k => parseInt(k, 10) < 0);
    const usesLargeNumbers = targetNumber >= 1000;

    const metrics: PlaceValueChartMetrics = {
      type: 'place-value-chart',

      // Overall
      allPhasesCompleted: true,
      finalSuccess: true,

      // Phase 1
      correctPlaceName,
      studentPlaceAnswer: selectedPlaceName,
      placeIdentifyCorrect: selectedPlaceName === correctPlaceName,
      placeAttempts,

      // Phase 2
      correctDigitValue: highlightedValue,
      studentValueAnswer: selectedValue,
      valueIdentifyCorrect: selectedValue === highlightedValue,
      valueAttempts,

      // Phase 3
      targetValue: targetNumber,
      finalValue: studentValue,
      isCorrect: true,
      buildAttempts: buildAttempts + 1,
      digitChanges: digitChangeCount,

      // Place value understanding
      placeRange: { minPlace, maxPlace },
      usesDecimals,
      usesLargeNumbers,
      totalDigitsEntered: totalDigits,
      digitsByPlace: { ...digits },
      expandedFormCorrect: expandedParts.length > 0,
      expandedFormParts: expandedParts,
      placeValueAccuracy: overallScore,

      // Aggregate
      totalAttempts: placeAttempts + valueAttempts + buildAttempts + 1,
      solvedOnFirstTry: placeAttempts === 1 && valueAttempts === 1 && buildAttempts === 0,
      hintsUsed,
    };

    submitEvaluation(true, overallScore, metrics, {
      studentWork: {
        phases: {
          identifyPlace: { answer: selectedPlaceName, attempts: placeAttempts },
          findValue: { answer: selectedValue, attempts: valueAttempts },
          buildNumber: { digits, attempts: buildAttempts + 1 },
        },
      },
    });

    setFeedback(
      `Excellent! You built ${targetNumber.toLocaleString()} correctly! Every digit is in the right place.`,
    );
    setFeedbackType('success');

    sendText(
      `[ALL_COMPLETE] Student completed all 3 phases for the number ${targetNumber.toLocaleString()}! `
        + `Phase scores: Identify Place ${p1}% (${placeAttempts} attempt${placeAttempts !== 1 ? 's' : ''}), `
        + `Find Value ${p2}% (${valueAttempts} attempt${valueAttempts !== 1 ? 's' : ''}), `
        + `Build Number ${p3}% (${buildAttempts + 1} attempt${buildAttempts !== 0 ? 's' : ''}). `
        + `Overall: ${overallScore}%. First try: ${placeAttempts === 1 && valueAttempts === 1 && buildAttempts === 0 ? 'yes' : 'no'}. `
        + `Hints used: ${hintsUsed}. Give encouraging phase-specific feedback!`,
      { silent: true },
    );
  }, [
    hasSubmittedEvaluation, calculateStudentValue, targetNumber, buildAttempts, placeAttempts,
    valueAttempts, selectedPlaceName, selectedValue, correctPlaceName, highlightedValue,
    digitChangeCount, digits, minPlace, maxPlace, getExpandedForm, hintsUsed, submitEvaluation, sendText,
  ]);

  // ── Hints ──────────────────────────────────────────────────
  const handleShowHint = useCallback(() => {
    setHintsUsed(p => p + 1);
    setFeedbackType('hint');

    if (currentPhase === 'identify-place') {
      setFeedback(
        `Hint: In ${targetNumber.toLocaleString()}, count from right to left starting at the ones place. Where is the digit ${highlightedDigit}?`,
      );
      sendText(
        `[HINT_REQUESTED] Student asked for a hint during Phase 1 (Identify Place) for the digit ${highlightedDigit} in ${targetNumber.toLocaleString()}. `
          + `Hint #${hintsUsed + 1}. Guide them to count places from right to left.`,
        { silent: true },
      );
    } else if (currentPhase === 'find-value') {
      setFeedback(
        `Hint: The digit ${highlightedDigit} is in the ${correctPlaceName} place. Multiply: ${highlightedDigit} ${getMultiplierLabel(highlightedDigitPlace)}.`,
      );
      sendText(
        `[HINT_REQUESTED] Student asked for a hint during Phase 2 (Find Value). `
          + `The digit ${highlightedDigit} is in the ${correctPlaceName} place. `
          + `Hint #${hintsUsed + 1}. Walk them through the multiplication.`,
        { silent: true },
      );
    } else {
      setFeedback(
        `Hint: Break ${targetNumber.toLocaleString()} into its digits. Think about what digit goes in each column from left to right.`,
      );
      sendText(
        `[HINT_REQUESTED] Student asked for a hint during Phase 3 (Build Number). `
          + `Target: ${targetNumber.toLocaleString()}. Current: ${calculateStudentValue().toLocaleString()}. `
          + `Hint #${hintsUsed + 1}. Help them think about one place at a time.`,
        { silent: true },
      );
    }
  }, [currentPhase, targetNumber, highlightedDigit, correctPlaceName, highlightedDigitPlace, hintsUsed, calculateStudentValue, sendText]);

  // ── Reset ──────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setCurrentPhase('identify-place');
    setSelectedPlaceName(null);
    setSelectedValue(null);
    setDigits({});
    setPlaceAttempts(0);
    setValueAttempts(0);
    setBuildAttempts(0);
    setDigitChangeCount(0);
    setHintsUsed(0);
    setFeedback('');
    setFeedbackType('info');
    resetEvaluationAttempt();
  }, [resetEvaluationAttempt]);

  // ── Feedback color map ─────────────────────────────────────
  const feedbackColors: Record<typeof feedbackType, string> = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    error: 'bg-red-500/10 border-red-500/30 text-red-300',
    hint: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    info: 'bg-white/5 border-white/10 text-slate-300',
  };

  // ── Render number with highlighted digit ───────────────────
  const renderHighlightedNumber = () => {
    // Render digit-by-digit from the unformatted number
    const absStr = Math.abs(targetNumber).toString();
    const parts = absStr.split('.');
    const intPart = parts[0];
    const decPart = parts[1] || '';

    const charElements: React.ReactNode[] = [];
    let charIdx = 0;

    // Integer part (add commas)
    for (let i = 0; i < intPart.length; i++) {
      const place = intPart.length - 1 - i;
      const isHighlighted = place === highlightedDigitPlace;

      // Comma before groups of 3 (not at start)
      if (i > 0 && (intPart.length - i) % 3 === 0) {
        charElements.push(
          <span key={`comma-${charIdx++}`} className="text-slate-500">,</span>,
        );
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

    // Decimal part
    if (decPart) {
      charElements.push(
        <span key={`dot-${charIdx++}`} className="text-yellow-400">.</span>,
      );
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

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className={`w-full ${className || ''}`}>
      <div className="max-w-6xl mx-auto glass-panel rounded-3xl border border-white/10 p-8 relative overflow-hidden shadow-2xl">
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-15 bg-indigo-500" />

        <div className="relative z-10">
          {/* ── Header ─────────────────────────────────────── */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                Math:
              </span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-mono border bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                PLACE VALUE CHART
              </span>
            </div>
            <h2 className="text-3xl font-light text-white mb-3">{title}</h2>
            <p className="text-slate-300 leading-relaxed">{description}</p>
          </div>

          {/* ── Number display (constant reference) ────────── */}
          <div className="flex justify-center mb-8">
            <div className="glass-panel rounded-2xl border border-indigo-500/20 px-12 py-6 text-center">
              <div className="text-5xl font-bold font-mono flex items-center justify-center gap-0.5">
                {renderHighlightedNumber()}
              </div>
              {currentPhase !== 'build-number' && (
                <div className="mt-3 text-sm text-slate-400">
                  Which digit is highlighted? <span className="text-indigo-300 font-bold">{highlightedDigit}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Phase progress indicator ───────────────────── */}
          <div className="flex items-center justify-center gap-3 mb-8">
            {/* Phase 1 pill */}
            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                currentPhase === 'identify-place'
                  ? 'glass-panel border-white/30 text-white shadow-lg scale-105'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <span className="text-lg">
                {currentPhase === 'identify-place' ? '\uD83D\uDCCD' : '\u2705'}
              </span>
              <span className="font-medium text-sm">1. Find the Place</span>
            </div>
            <div className="text-slate-600">{'\u2192'}</div>

            {/* Phase 2 pill */}
            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                currentPhase === 'find-value'
                  ? 'glass-panel border-white/30 text-white shadow-lg scale-105'
                  : currentPhase === 'build-number'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              <span className="text-lg">
                {currentPhase === 'build-number'
                  ? '\u2705'
                  : currentPhase === 'find-value'
                    ? '\uD83D\uDCB0'
                    : '\uD83D\uDCB0'}
              </span>
              <span className="font-medium text-sm">2. Find the Value</span>
            </div>
            <div className="text-slate-600">{'\u2192'}</div>

            {/* Phase 3 pill */}
            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                currentPhase === 'build-number'
                  ? 'glass-panel border-white/30 text-white shadow-lg scale-105'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              <span className="text-lg">
                {hasSubmittedEvaluation ? '\u2705' : '\uD83C\uDFD7\uFE0F'}
              </span>
              <span className="font-medium text-sm">3. Build It</span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              Phase 1 — Identify the Place
             ═══════════════════════════════════════════════════ */}
          {currentPhase === 'identify-place' && (
            <div className="glass-panel rounded-2xl border border-indigo-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">{'\uD83D\uDCCD'}</span>
                  Step 1: Identify the Place
                </h3>
                <p className="text-slate-300 leading-relaxed mb-6">
                  In the number{' '}
                  <span className="font-mono font-bold text-white">{targetNumber.toLocaleString()}</span>,
                  which place value is the highlighted digit{' '}
                  <span className="text-indigo-300 font-bold">{highlightedDigit}</span> in?
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {placeNameChoices.map(choice => (
                    <button
                      key={choice}
                      onClick={() => setSelectedPlaceName(choice)}
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

          {/* ═══════════════════════════════════════════════════
              Phase 2 — Find the Value
             ═══════════════════════════════════════════════════ */}
          {currentPhase === 'find-value' && (
            <div className="glass-panel rounded-2xl border border-amber-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">{'\uD83D\uDCB0'}</span>
                  Step 2: Find the Value
                </h3>
                <p className="text-slate-300 leading-relaxed mb-6">
                  The digit{' '}
                  <span className="text-indigo-300 font-bold">{highlightedDigit}</span> is in the{' '}
                  <span className="text-amber-300 font-semibold">{correctPlaceName}</span> place.
                  What is the <span className="text-amber-300 font-semibold">value</span> of this digit?
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {digitValueChoices.map(choice => (
                    <button
                      key={choice}
                      onClick={() => setSelectedValue(choice)}
                      className={`p-4 rounded-xl border text-center transition-all duration-300 text-2xl font-bold font-mono ${
                        selectedValue === choice
                          ? 'glass-panel border-amber-400/50 text-amber-300 shadow-lg scale-105'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      {choice.toLocaleString()}
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

          {/* ═══════════════════════════════════════════════════
              Phase 3 — Build the Number
             ═══════════════════════════════════════════════════ */}
          {currentPhase === 'build-number' && (
            <div className="glass-panel rounded-2xl border border-emerald-500/30 p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="pt-2">
                <h3 className="text-xl font-light text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">{'\uD83C\uDFD7\uFE0F'}</span>
                  Step 3: Build the Number
                </h3>
                <p className="text-slate-300 leading-relaxed mb-6">
                  Now build{' '}
                  <span className="font-mono font-bold text-white">{targetNumber.toLocaleString()}</span>{' '}
                  by entering the correct digit in each place value column.
                </p>

                {/* Place Value Chart */}
                <div className="overflow-x-auto pb-4">
                  <div className="inline-block min-w-full">
                    {/* Multipliers Row */}
                    {showMultipliers && (
                      <div className="flex border-b border-white/10 mb-2">
                        {places.map(place => (
                          <div
                            key={`mult-${place}`}
                            className="flex-1 min-w-[80px] px-2 py-2 text-center text-xs font-mono text-indigo-300/70"
                          >
                            {getMultiplierLabel(place)}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Place Names Row */}
                    <div className="flex border-b border-white/10 mb-4">
                      {places.map(place => (
                        <div
                          key={`name-${place}`}
                          className={`flex-1 min-w-[80px] px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide ${
                            place === 0
                              ? 'border-l border-r border-yellow-500/30 bg-yellow-500/5'
                              : ''
                          } ${place < 0 ? 'text-purple-300' : 'text-blue-300'}`}
                        >
                          {getPlaceName(place)}
                        </div>
                      ))}
                    </div>

                    {/* Digit Inputs Row */}
                    <div className="flex">
                      {places.map(place => (
                        <div
                          key={`digit-${place}`}
                          className={`flex-1 min-w-[80px] px-2 ${
                            place === 0 ? 'border-l border-r border-yellow-500/30' : ''
                          }`}
                        >
                          <input
                            type="text"
                            value={digits[place] || ''}
                            onChange={e => handleDigitChange(place, e.target.value)}
                            disabled={hasSubmittedEvaluation}
                            className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-3 py-4 text-center text-3xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-slate-600"
                            maxLength={1}
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Decimal point indicator */}
                    {minPlace < 0 && (
                      <div className="mt-2 text-center">
                        <div className="inline-block text-yellow-400 text-xs font-mono">
                          {'\u2191'} Decimal point between Ones and Tenths
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Current vs target */}
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
                    Target:{' '}
                    <span className="font-mono text-white">{targetNumber.toLocaleString()}</span>
                  </div>
                </div>

                {/* Expanded Form */}
                {showExpandedForm && (
                  <div className="mb-4 p-4 bg-slate-800/20 rounded-xl border border-white/5">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                      Expanded Form
                    </h4>
                    <div className="text-base text-white font-mono">
                      {getExpandedForm().length > 0 ? (
                        getExpandedForm().join(' + ')
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </div>
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
                  {hasSubmittedEvaluation ? '\u2713 Submitted' : 'Submit Number'}
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

          {/* ── Phase Summary (after all 3 phases complete) ── */}
          {hasSubmittedEvaluation && phaseSummaryData.length > 0 && (
            <PhaseSummaryPanel
              phases={phaseSummaryData}
              overallScore={submittedResult?.score}
              durationMs={elapsedMs}
              heading="Challenge Complete!"
              celebrationMessage={`You explored the number ${targetNumber.toLocaleString()} across all three phases!`}
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

export default PlaceValueChart;
