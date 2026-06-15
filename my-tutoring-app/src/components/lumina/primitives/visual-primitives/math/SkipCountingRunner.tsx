'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaButton,
  LuminaBadge,
  LuminaPanel,
  LuminaActionButton,
  LuminaInput,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SkipCountingRunnerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface SkipCountingChallenge {
  id: string;
  type: 'count_along' | 'predict' | 'fill_missing' | 'find_skip_value' | 'connect_multiplication';
  instruction: string;
  hiddenPositions?: number[];
  targetFact?: string | null;
  startPosition?: number;
  hint: string;
  narration: string;
}

export interface SkipCountingRunnerData {
  title: string;
  description?: string;
  skipValue: number;
  startFrom: number;
  endAt: number;
  direction: 'forward' | 'backward';
  character: {
    type: 'frog' | 'kangaroo' | 'rabbit' | 'rocket' | 'custom';
    imagePrompt?: string;
  };
  challenges: SkipCountingChallenge[];
  showOptions?: {
    showArray?: boolean;
    showJumpArcs?: boolean;
    showEquation?: boolean;
    showDigitPattern?: boolean;
    autoPlay?: boolean;
    /** Gate the always-on multiple-number labels under the number-line ticks.
     *  Support lever: at hard tiers (predict / find_skip_value) hiding prior
     *  landing labels forces the student to track the sequence unaided. */
    showTrackLabels?: boolean;
    /** Gate the bottom sequence-chip row AND the "→ ?" next cue. Withdrawing it
     *  removes the running written record of landings the student can read off. */
    showSequenceChips?: boolean;
    /** Gate the "Count by Ns" header badge AND the "+N" in the Jump button label.
     *  CRITICAL leak guard: for find_skip_value / predict the skip value N is the
     *  ANSWER, so a hard tier MUST suppress BOTH surfaces, not just track labels. */
    showSkipValueBadge?: boolean;
  };
  gameMode?: {
    enabled?: boolean;
    type?: 'catch_the_number' | 'fill_the_gaps' | 'speed_count';
    timeLimit?: number | null;
  };
  gradeBand?: '1-2' | '2-3';
  /** Within-mode support tier persisted from the generator so the live tutor's
   *  reveal policy matches what the on-screen scaffold withholds. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SkipCountingRunnerMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

type Phase = 'watch' | 'jump' | 'predict' | 'connect';

const PHASE_CONFIG: Record<Phase, { label: string; description: string }> = {
  watch: { label: 'Watch', description: 'Watch the character jump' },
  jump: { label: 'Jump', description: 'Tap to make each jump' },
  predict: { label: 'Predict', description: 'Guess the next landing' },
  connect: { label: 'Connect', description: 'Link to multiplication' },
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  count_along:             { label: 'Count Along',    icon: '👀', accentColor: 'amber' },
  predict:                 { label: 'Predict',        icon: '🎯', accentColor: 'orange' },
  fill_missing:            { label: 'Fill Missing',   icon: '🧩', accentColor: 'cyan' },
  find_skip_value:         { label: 'Find Skip Value',icon: '🔍', accentColor: 'purple' },
  connect_multiplication:  { label: 'Multiply',       icon: '✖️', accentColor: 'emerald' },
};

const CHARACTER_EMOJI: Record<string, string> = {
  frog: '🐸',
  kangaroo: '🦘',
  rabbit: '🐰',
  rocket: '🚀',
  custom: '⭐',
};

// Number line layout
const NL_PADDING = 40;
const NL_HEIGHT = 160;
const TICK_HEIGHT = 12;
const JUMP_ARC_HEIGHT = 50;

// ============================================================================
// Props
// ============================================================================

interface SkipCountingRunnerProps {
  data: SkipCountingRunnerData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const SkipCountingRunner: React.FC<SkipCountingRunnerProps> = ({ data, className }) => {
  const {
    title,
    description,
    skipValue,
    startFrom = 0,
    endAt,
    direction = 'forward',
    character = { type: 'frog' as const },
    challenges = [],
    showOptions = {},
    gradeBand = '1-2',
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showArray = false,
    showJumpArcs = true,
    showEquation = false,
    showDigitPattern = false,
    autoPlay = false,
    // New support-tier levers — default ON so the no-tier path is byte-identical
    // to the prior always-on scaffolds. The generator withdraws them per tier.
    showTrackLabels = true,
    showSequenceChips = true,
    showSkipValueBadge = true,
  } = showOptions;

  // -------------------------------------------------------------------------
  // State
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

  const [currentPhase, setCurrentPhase] = useState<Phase>(() => {
    if (challenges.length === 0) return 'watch';
    const firstType = challenges[0].type;
    if (firstType === 'predict') return 'predict';
    if (firstType === 'connect_multiplication') return 'connect';
    if (firstType === 'count_along') return 'watch';
    return 'jump';
  });

  // Number line state — honor first challenge's startPosition
  const [currentPosition, setCurrentPosition] = useState(() => {
    const first = challenges[0];
    return first?.startPosition !== undefined ? first.startPosition : startFrom;
  });
  const [landingSpots, setLandingSpots] = useState<number[]>(() => {
    const first = challenges[0];
    if (first?.startPosition !== undefined && first.startPosition !== startFrom) {
      const spots: number[] = [];
      if (direction === 'forward') {
        for (let pos = startFrom; pos <= first.startPosition; pos += skipValue) spots.push(pos);
      } else {
        for (let pos = startFrom; pos >= first.startPosition; pos -= skipValue) spots.push(pos);
      }
      return spots.length > 0 ? spots : [startFrom];
    }
    return [startFrom];
  });
  const [isAnimating, setIsAnimating] = useState(false);

  // Prediction state
  const [predictionInput, setPredictionInput] = useState('');
  const [predictedPosition, setPredictedPosition] = useState<number | null>(null);

  // Multiplication connection state
  const [multiplicationInput, setMultiplicationInput] = useState('');

  // Fill-missing / find-skip-value state
  const [fillInput, setFillInput] = useState('');

  // Feedback
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  // Tracking
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [skipValuesExplored] = useState(new Set<number>([skipValue]));
  const [backwardCountingAttempted, setBackwardCountingAttempted] = useState(direction === 'backward');
  const [multiplicationConnectionMade, setMultiplicationConnectionMade] = useState(false);
  const [patternIdentified, setPatternIdentified] = useState(false);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `skip-counting-runner-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Jump animation timer (performJump's 400ms position update) and the predict
  // auto-advance timer (checkPrediction's 800ms wrapper that calls performJump).
  // Both must be cleared when the student advances early, otherwise the stale
  // closure fires after advanceToNextChallenge and overwrites the new challenge's
  // currentPosition/landingSpots with the previous challenge's values (SCR-1).
  const jumpAnimationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const predictAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingJumpTimers = useCallback(() => {
    if (predictAdvanceTimerRef.current) {
      clearTimeout(predictAdvanceTimerRef.current);
      predictAdvanceTimerRef.current = null;
    }
    if (jumpAnimationTimerRef.current) {
      clearTimeout(jumpAnimationTimerRef.current);
      jumpAnimationTimerRef.current = null;
    }
    setIsAnimating(false);
  }, []);

  useEffect(() => {
    return () => {
      if (predictAdvanceTimerRef.current) clearTimeout(predictAdvanceTimerRef.current);
      if (jumpAnimationTimerRef.current) clearTimeout(jumpAnimationTimerRef.current);
    };
  }, []);

  const currentChallenge = challenges[currentChallengeIndex] || null;

  // Compute all valid positions on the number line
  const allPositions = useMemo(() => {
    const positions: number[] = [];
    if (direction === 'forward') {
      for (let n = startFrom; n <= endAt; n += skipValue) {
        positions.push(n);
      }
    } else {
      for (let n = startFrom; n >= endAt; n -= skipValue) {
        positions.push(n);
      }
    }
    return positions;
  }, [startFrom, endAt, skipValue, direction]);

  // Next expected position
  const nextExpectedPosition = useMemo(() => {
    if (direction === 'forward') {
      const next = currentPosition + skipValue;
      return next <= endAt ? next : null;
    } else {
      const next = currentPosition - skipValue;
      return next >= endAt ? next : null;
    }
  }, [currentPosition, skipValue, endAt, direction]);

  // Number line range
  const nlMin = Math.min(startFrom, endAt, 0);
  const nlMax = Math.max(startFrom, endAt);

  // Jump count
  const jumpCount = landingSpots.length - 1; // exclude starting position

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<SkipCountingRunnerMetrics>({
    primitiveType: 'skip-counting-runner',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    skipValue,
    startFrom,
    endAt,
    direction,
    currentPosition,
    jumpCount,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    instruction: currentChallenge?.instruction ?? 'Free exploration',
    challengeType: currentChallenge?.type ?? 'count_along',
    attemptNumber: currentAttempts + 1,
    currentPhase,
    currentStreak,
    landingSpots: landingSpots.join(', '),
    gradeBand,
    supportTier,
  }), [
    skipValue, startFrom, endAt, direction, currentPosition, jumpCount,
    challenges.length, currentChallengeIndex, currentChallenge,
    currentAttempts, currentPhase, currentStreak, landingSpots, gradeBand,
    supportTier,
  ]);

  // Mode-aware tutor reveal policy — keeps the tutor's spoken help consistent
  // with what the on-screen support tier withholds (so the tutor doesn't leak a
  // withdrawn scaffold). For find_skip_value / predict the skip value is the
  // ANSWER, so at hard the tutor must NOT name it — it asks how much the number
  // grows each jump instead. No tier present → empty (legacy behavior unchanged).
  const tutorRevealClause = useCallback(
    (challengeType: string): string => {
      if (!supportTier) return '';
      const answerIsSkipValue =
        challengeType === 'find_skip_value' || challengeType === 'predict';
      if (supportTier === 'easy') {
        return answerIsSkipValue
          ? ` SUPPORT TIER: easy — you may name the count-by-${skipValue} strategy and walk the next step with the student.`
          : ` SUPPORT TIER: easy — you may name the count-by-${skipValue} strategy and model the setup step by step.`;
      }
      if (supportTier === 'medium') {
        return ` SUPPORT TIER: medium — the strategy is partly on screen; nudge the student's execution, do not solve it for them.`;
      }
      // hard
      return answerIsSkipValue
        ? ` SUPPORT TIER: hard — the skip value is the ANSWER and is hidden on screen. Do NOT name it or say "count by ${skipValue}". Ask the student how much the number GROWS from one jump to the next, and what they notice. Never reveal the answer.`
        : ` SUPPORT TIER: hard — scaffolds are withdrawn. Do NOT name the strategy; ask the student what they see in the sequence. Never reveal the answer.`;
    },
    [supportTier, skipValue],
  );

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'skip-counting-runner',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '1-2' ? 'Grade 1-2' : 'Grade 2-3',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;

    const charName = character.type === 'custom' ? 'our friend' : `the ${character.type}`;
    // When the skip value is the hidden answer (showSkipValueBadge=false at a hard
    // find_skip_value / predict tier), do NOT hand it to the tutor in the intro.
    const skipPhrase = showSkipValueBadge
      ? `Skip value: ${skipValue}. Count ${direction} from ${startFrom} to ${endAt}. `
      : `Count ${direction} from ${startFrom} to ${endAt} (the skip value is the answer the student must discover — do not state it). `;
    const introExcitement = showSkipValueBadge
      ? `Introduce the activity with excitement: "${charName} is going to jump by ${skipValue}s! Let's count together!" `
      : `Introduce the activity with excitement: "${charName} is going to jump! Watch the pattern and figure out how far each jump goes!" `;
    sendText(
      `[ACTIVITY_START] This is a skip counting activity for ${gradeBand === '1-2' ? 'Grades 1-2' : 'Grades 2-3'}. `
      + skipPhrase
      + `Character: ${charName}. There are ${challenges.length} challenges. `
      + `First challenge: "${currentChallenge?.instruction}". `
      + introExcitement
      + `Then read the first instruction.`
      + tutorRevealClause(currentChallenge?.type ?? 'count_along'),
      { silent: true }
    );
  }, [isConnected, challenges.length, skipValue, direction, startFrom, endAt, character.type, gradeBand, currentChallenge, sendText, tutorRevealClause, showSkipValueBadge]);

  // -------------------------------------------------------------------------
  // Jump Logic
  // -------------------------------------------------------------------------
  const performJump = useCallback(() => {
    if (isAnimating || hasSubmittedEvaluation || nextExpectedPosition === null) return;

    setIsAnimating(true);

    // Animate jump
    if (jumpAnimationTimerRef.current) clearTimeout(jumpAnimationTimerRef.current);
    jumpAnimationTimerRef.current = setTimeout(() => {
      jumpAnimationTimerRef.current = null;
      SoundManager.snap();        // ← character lands on the next number
      setCurrentPosition(nextExpectedPosition);
      setLandingSpots(prev => [...prev, nextExpectedPosition]);
      setIsAnimating(false);

      // Update streak
      setCurrentStreak(prev => {
        const newStreak = prev + 1;
        setLongestStreak(longest => Math.max(longest, newStreak));
        return newStreak;
      });

      // AI tutoring - rhythmic counting
      if (isConnected) {
        const jumpNum = jumpCount + 1;
        if (jumpNum % 3 === 0 || nextExpectedPosition === endAt) {
          sendText(
            `[JUMP_LANDING] The character landed on ${nextExpectedPosition}! `
            + `That's ${jumpNum} jumps of ${skipValue}. `
            + `${nextExpectedPosition === endAt ? 'They reached the end!' : `Count along: "${landingSpots.slice(-2).join('... ')}... ${nextExpectedPosition}!"`} `
            + `${jumpNum >= 3 ? `Connect to multiplication: "${jumpNum} × ${skipValue} = ${nextExpectedPosition}!"` : 'Keep counting along rhythmically.'}`
            + tutorRevealClause(currentChallenge?.type ?? 'count_along'),
            { silent: true }
          );
        }
      }
    }, 400);
  }, [isAnimating, hasSubmittedEvaluation, nextExpectedPosition, jumpCount, skipValue, endAt, landingSpots, isConnected, sendText, tutorRevealClause, currentChallenge]);

  // Auto-play mode
  useEffect(() => {
    if (!autoPlay || currentPhase !== 'watch' || isAnimating || nextExpectedPosition === null) return;

    autoPlayTimerRef.current = setTimeout(() => {
      performJump();
    }, 1200);

    return () => {
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    };
  }, [autoPlay, currentPhase, isAnimating, nextExpectedPosition, performJump]);

  // -------------------------------------------------------------------------
  // Challenge Checking
  // -------------------------------------------------------------------------
  const checkPrediction = useCallback(() => {
    if (!currentChallenge || nextExpectedPosition === null) return false;
    const answer = parseInt(predictionInput, 10);
    const correct = answer === nextExpectedPosition;
    incrementAttempts();

    if (correct) {
      setPredictedPosition(nextExpectedPosition);
      setFeedback(`Yes! ${nextExpectedPosition} is correct!`);
      setFeedbackType('success');
      setCurrentStreak(prev => {
        const newStreak = prev + 1;
        setLongestStreak(longest => Math.max(longest, newStreak));
        return newStreak;
      });
      sendText(
        `[PREDICT_CORRECT] Student correctly predicted ${nextExpectedPosition}! `
        + `Skip counting by ${skipValue}s from ${currentPosition}. `
        + `${currentAttempts === 0 ? 'First try!' : `After ${currentAttempts + 1} attempts.`} `
        + `Streak: ${currentStreak + 1}. `
        + `Celebrate: "You knew it was ${nextExpectedPosition}! ${skipValue} more than ${currentPosition}!"`,
        { silent: true }
      );
      // Auto-advance the jump after correct prediction
      if (predictAdvanceTimerRef.current) clearTimeout(predictAdvanceTimerRef.current);
      predictAdvanceTimerRef.current = setTimeout(() => {
        predictAdvanceTimerRef.current = null;
        performJump();
        setPredictionInput('');
        setPredictedPosition(null);
      }, 800);
    } else {
      setFeedback(`Not quite. You said ${answer}. What is ${currentPosition} + ${skipValue}?`);
      setFeedbackType('error');
      setCurrentStreak(0);
      sendText(
        `[PREDICT_INCORRECT] Student predicted ${answer} but the next landing is ${nextExpectedPosition}. `
        + `Current position: ${currentPosition}, skip value: ${skipValue}. `
        + `Hint: "We're counting by ${skipValue}s. What is ${currentPosition} plus ${skipValue}?"`
        + tutorRevealClause('predict'),
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, nextExpectedPosition, predictionInput, currentPosition, skipValue, currentAttempts, currentStreak, sendText, performJump, tutorRevealClause]);

  const checkFillMissing = useCallback(() => {
    if (!currentChallenge) return false;
    const hiddenPos = currentChallenge.hiddenPositions || [];
    const answer = parseInt(fillInput, 10);
    // Check if the answer matches any hidden position that hasn't been found yet
    const correct = hiddenPos.includes(answer) && !landingSpots.includes(answer);
    incrementAttempts();

    if (correct) {
      setLandingSpots(prev => [...prev, answer].sort((a, b) => a - b));
      setFeedback(`Yes! ${answer} is in the sequence!`);
      setFeedbackType('success');
      sendText(
        `[FILL_CORRECT] Student found missing number ${answer} in the skip counting sequence. `
        + `Celebrate and ask about the next missing number.`,
        { silent: true }
      );
      setFillInput('');
    } else {
      setFeedback(`${answer} doesn't fit. We're counting by ${skipValue}s.`);
      setFeedbackType('error');
      sendText(
        `[FILL_INCORRECT] Student guessed ${answer} but it's not a multiple of ${skipValue} from ${startFrom}. `
        + `Hint: "Start from ${startFrom} and add ${skipValue} each time."`
        + tutorRevealClause('fill_missing'),
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, fillInput, skipValue, startFrom, landingSpots, currentAttempts, sendText, tutorRevealClause]);

  const checkFindSkipValue = useCallback(() => {
    if (!currentChallenge) return false;
    const answer = parseInt(fillInput, 10);
    const correct = answer === skipValue;
    incrementAttempts();

    if (correct) {
      setPatternIdentified(true);
      setFeedback(`You got it! We're counting by ${skipValue}s!`);
      setFeedbackType('success');
      sendText(
        `[SKIP_VALUE_CORRECT] Student identified the skip value as ${skipValue}. `
        + `Celebrate: "You found the pattern! Every jump is ${skipValue} more!"`,
        { silent: true }
      );
    } else {
      setFeedback(`Not quite. Look at the difference between each number.`);
      setFeedbackType('error');
      // find_skip_value is a recognition mode — the skip value IS the answer.
      // At a hard tier the tutor must not be told it; tutorRevealClause('hard')
      // redirects it to "how much does the number grow each jump?".
      sendText(
        (supportTier === 'hard'
          ? `[SKIP_VALUE_INCORRECT] Student guessed ${answer}, which is not the skip value. `
            + `Do NOT reveal the correct skip value. Point them to the sequence: "${allPositions.slice(0, 4).join(', ')}". `
          : `[SKIP_VALUE_INCORRECT] Student guessed ${answer} but the skip value is ${skipValue}. `
            + `Hint: "Look at the numbers: ${allPositions.slice(0, 4).join(', ')}. What do you add each time?"`)
        + tutorRevealClause('find_skip_value'),
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, fillInput, skipValue, allPositions, currentAttempts, sendText, supportTier, tutorRevealClause]);

  const checkMultiplication = useCallback(() => {
    if (!currentChallenge) return false;
    const targetFact = currentChallenge.targetFact || `${jumpCount} × ${skipValue} = ${currentPosition}`;
    // Flexible check: just verify the product is correct
    const expectedProduct = jumpCount * skipValue + startFrom;
    const inputClean = multiplicationInput.replace(/\s/g, '');
    // Accept formats: "3×5=15", "3*5=15", "15", or just the product
    const productMatch = inputClean.match(/=?\s*(\d+)$/);
    const enteredProduct = productMatch ? parseInt(productMatch[1], 10) : parseInt(inputClean, 10);
    const correct = enteredProduct === expectedProduct || enteredProduct === currentPosition;
    incrementAttempts();

    if (correct) {
      setMultiplicationConnectionMade(true);
      setFeedback(`Correct! ${targetFact}`);
      setFeedbackType('success');
      sendText(
        `[MULTIPLY_CORRECT] Student connected skip counting to multiplication: ${targetFact}. `
        + `Celebrate: "You found the multiplication fact! ${jumpCount} jumps of ${skipValue} equals ${currentPosition}!"`,
        { silent: true }
      );
    } else {
      setFeedback(`Think about how many jumps of ${skipValue} you made.`);
      setFeedbackType('error');
      sendText(
        `[MULTIPLY_INCORRECT] Student answered "${multiplicationInput}" but the fact is: ${targetFact}. `
        + `Hint: "You made ${jumpCount} jumps, each jump was ${skipValue}. What is ${jumpCount} × ${skipValue}?"`
        + tutorRevealClause('connect_multiplication'),
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, jumpCount, skipValue, currentPosition, startFrom, multiplicationInput, currentAttempts, sendText, tutorRevealClause]);

  // -------------------------------------------------------------------------
  // Challenge Navigation
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;

    let correct = false;

    switch (currentChallenge.type) {
      case 'count_along':
        // Count-along is checked by completing all jumps
        correct = nextExpectedPosition === null;
        if (correct) {
          setFeedback('You counted all the way! Great job!');
          setFeedbackType('success');
          sendText(
            `[COUNT_COMPLETE] Student completed counting by ${skipValue}s from ${startFrom} to ${endAt}. `
            + `Celebrate the full count!`,
            { silent: true }
          );
        }
        break;
      case 'predict':
        correct = checkPrediction();
        break;
      case 'fill_missing':
        correct = checkFillMissing();
        break;
      case 'find_skip_value':
        correct = checkFindSkipValue();
        break;
      case 'connect_multiplication':
        correct = checkMultiplication();
        break;
    }

    if (correct) {
      SoundManager.playCorrect();
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        type: currentChallenge.type,
      });
    } else {
      SoundManager.playIncorrect();
    }
  }, [
    currentChallenge, currentAttempts, nextExpectedPosition,
    checkPrediction, checkFillMissing, checkFindSkipValue, checkMultiplication,
    skipValue, startFrom, endAt, sendText,
  ]);

  const advanceToNextChallenge = useCallback(() => {
    // Cancel any in-flight jump/predict-advance timers so their stale closures
    // can't overwrite the next challenge's state (SCR-1).
    clearPendingJumpTimers();

    if (!advanceProgress()) {
      // All challenges complete — build phase score string for AI
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const totalCorrect = challengeResults.filter(r => r.correct).length;
      const overallPct = challenges.length > 0
        ? Math.round((totalCorrect / challenges.length) * 100)
        : 0;

      sendText(
        `[CHALLENGE_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Skip value: ${skipValue}. Jumps made: ${jumpCount}. Longest streak: ${longestStreak}. `
        + `Give encouraging phase-specific feedback about counting by ${skipValue}s.`,
        { silent: true }
      );

      // Submit evaluation
      if (!hasSubmittedEvaluation) {
        const jumpResults = challengeResults.filter(r => r.type === 'count_along' || r.type === 'predict');
        const predictionResults = challengeResults.filter(r => r.type === 'predict');

        const metrics: SkipCountingRunnerMetrics = {
          type: 'skip-counting-runner',
          landingsCorrect: jumpResults.filter(r => r.correct).length,
          landingsTotal: jumpResults.length,
          predictionsCorrect: predictionResults.filter(r => r.correct).length,
          predictionsTotal: predictionResults.length,
          skipValuesExplored: Array.from(skipValuesExplored),
          backwardCountingAttempted,
          multiplicationConnectionMade,
          patternIdentified,
          longestCorrectStreak: longestStreak,
          attemptsCount: challengeResults.reduce((s, r) => s + (r.attempts ?? 0), 0),
        };

        submitEvaluation(
          totalCorrect === challenges.length,
          overallPct,
          metrics,
          { challengeResults }
        );
      }
      return;
    }

    // advanceProgress() already incremented index and reset attempts.
    // Reset domain-specific state:
    setFeedback('');
    setFeedbackType('');
    setPredictionInput('');
    setPredictedPosition(null);
    setMultiplicationInput('');
    setFillInput('');

    // Position character based on next challenge's startPosition
    const nextIndex = currentChallengeIndex + 1;
    const nextChallenge = challenges[nextIndex];
    if (!nextChallenge) return;
    const targetPos = nextChallenge.startPosition;

    if (targetPos !== undefined) {
      const spots: number[] = [];
      if (direction === 'forward') {
        for (let pos = startFrom; pos <= targetPos; pos += skipValue) spots.push(pos);
      } else {
        for (let pos = startFrom; pos >= targetPos; pos -= skipValue) spots.push(pos);
      }
      setLandingSpots(spots.length > 0 ? spots : [startFrom]);
      setCurrentPosition(spots.length > 0 ? spots[spots.length - 1] : startFrom);
    } else if (nextChallenge.type === 'connect_multiplication') {
      // Backward compat: keep current state when no startPosition for connect
    } else {
      setCurrentPosition(startFrom);
      setLandingSpots([startFrom]);
    }
    setCurrentStreak(0);

    // Set phase
    if (nextChallenge.type === 'count_along') setCurrentPhase('watch');
    else if (nextChallenge.type === 'predict') setCurrentPhase('predict');
    else if (nextChallenge.type === 'connect_multiplication') setCurrentPhase('connect');
    else setCurrentPhase('jump');

    sendText(
      `[PHASE_TRANSITION] Moving to challenge ${nextIndex + 1} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}). `
      + `Read the instruction and encourage them.`
      + tutorRevealClause(nextChallenge.type),
      { silent: true }
    );
  }, [
    advanceProgress, phaseResults, challengeResults, challenges, sendText, skipValue,
    jumpCount, longestStreak, hasSubmittedEvaluation, skipValuesExplored,
    backwardCountingAttempted, multiplicationConnectionMade, patternIdentified,
    submitEvaluation, startFrom, currentChallengeIndex, direction,
    clearPendingJumpTimers, tutorRevealClause,
  ]);

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------
  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );
  // allChallengesComplete provided by useChallengeProgress

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  const isCountAlongComplete = currentPhase === 'watch' && nextExpectedPosition === null;

  // -------------------------------------------------------------------------
  // SVG Number Line Rendering
  // -------------------------------------------------------------------------
  const svgWidth = 600;
  const lineY = NL_HEIGHT - 40;
  const usableWidth = svgWidth - NL_PADDING * 2;

  const posToX = useCallback((pos: number) => {
    const range = nlMax - nlMin;
    if (range === 0) return NL_PADDING;
    return NL_PADDING + ((pos - nlMin) / range) * usableWidth;
  }, [nlMin, nlMax, usableWidth]);

  // Generate tick marks for every number in range
  const tickMarks = useMemo(() => {
    const ticks: number[] = [];
    const step = nlMax - nlMin <= 50 ? 1 : skipValue;
    for (let n = nlMin; n <= nlMax; n += step) {
      ticks.push(n);
    }
    return ticks;
  }, [nlMin, nlMax, skipValue]);

  // Hidden positions for predict mode
  const hiddenSet = useMemo(() => {
    return new Set(currentChallenge?.hiddenPositions || []);
  }, [currentChallenge]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const charEmoji = CHARACTER_EMOJI[character.type] || '⭐';

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">
            <span className="mr-2">{charEmoji}</span>{title}
          </LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="orange" className="text-xs">
              {gradeBand === '1-2' ? 'Grades 1-2' : 'Grades 2-3'}
            </LuminaBadge>
            {/* "Count by Ns" badge — gated by showSkipValueBadge. CRITICAL leak
                guard: for find_skip_value / predict the skip value N IS the
                answer, so a hard tier suppresses this surface. */}
            {showSkipValueBadge && (
              <LuminaBadge accent="emerald" className="text-xs">
                Count by {skipValue}s
              </LuminaBadge>
            )}
            {direction === 'backward' && (
              <LuminaBadge accent="purple" className="text-xs">
                Backward
              </LuminaBadge>
            )}
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Phase Progress */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(PHASE_CONFIG).map(([phase, config]) => (
              <LuminaBadge
                key={phase}
                className={`text-xs ${
                  currentPhase === phase
                    ? 'bg-orange-500/20 border-orange-400/50 text-orange-300'
                    : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                }`}
              >
                {config.label}
              </LuminaBadge>
            ))}
            <span className="text-slate-500 text-xs ml-auto">
              Challenge {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
            </span>
          </div>
        )}

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <LuminaPanel className="p-3">
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.instruction}
            </p>
          </LuminaPanel>
        )}

        {/* Number Line SVG */}
        <div className="flex justify-center">
          <svg
            width={svgWidth}
            height={NL_HEIGHT}
            viewBox={`0 0 ${svgWidth} ${NL_HEIGHT}`}
            className="max-w-full h-auto"
          >
            {/* Number line base */}
            <line
              x1={NL_PADDING - 10}
              y1={lineY}
              x2={svgWidth - NL_PADDING + 10}
              y2={lineY}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={2}
            />

            {/* Arrow heads */}
            <polygon
              points={`${svgWidth - NL_PADDING + 10},${lineY} ${svgWidth - NL_PADDING + 2},${lineY - 5} ${svgWidth - NL_PADDING + 2},${lineY + 5}`}
              fill="rgba(255,255,255,0.3)"
            />

            {/* Tick marks and labels */}
            {tickMarks.map(n => {
              const x = posToX(n);
              const isLanding = landingSpots.includes(n);
              const isHidden = hiddenSet.has(n);
              const isMultiple = (n - startFrom) % skipValue === 0 && n >= Math.min(startFrom, endAt) && n <= Math.max(startFrom, endAt);

              return (
                <g key={n}>
                  <line
                    x1={x}
                    y1={lineY - (isMultiple ? TICK_HEIGHT : TICK_HEIGHT / 2)}
                    x2={x}
                    y2={lineY + (isMultiple ? TICK_HEIGHT : TICK_HEIGHT / 2)}
                    stroke={isLanding ? '#f97316' : isMultiple ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)'}
                    strokeWidth={isLanding ? 2 : 1}
                  />
                  {/* Label — gated by showTrackLabels. At hard tiers all numeric
                       labels (including prior landings) are withdrawn so the
                       student tracks the sequence unaided; the orange landing
                       tick + glow still render ("only landing ticks"). The
                       hidden "?" placeholder for fill_missing always renders so
                       the gap is still marked. */}
                  {isMultiple && (showTrackLabels || (isHidden && !isLanding)) && (
                    <text
                      x={x}
                      y={lineY + TICK_HEIGHT + 14}
                      textAnchor="middle"
                      fill={isLanding ? '#fb923c' : isHidden ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)'}
                      fontSize={11}
                      fontWeight={isLanding ? 'bold' : 'normal'}
                    >
                      {isHidden && !isLanding ? '?' : n}
                    </text>
                  )}
                  {/* Landing glow */}
                  {isLanding && (
                    <circle
                      cx={x}
                      cy={lineY}
                      r={6}
                      fill="#f97316"
                      opacity={0.6}
                      className="animate-pulse"
                    />
                  )}
                </g>
              );
            })}

            {/* Jump arcs */}
            {showJumpArcs && landingSpots.length > 1 && landingSpots.slice(1).map((pos, i) => {
              const prevPos = landingSpots[i];
              const x1 = posToX(prevPos);
              const x2 = posToX(pos);
              const midX = (x1 + x2) / 2;
              const arcY = lineY - JUMP_ARC_HEIGHT - Math.min(i * 3, 20);

              return (
                <path
                  key={`arc-${i}`}
                  d={`M ${x1} ${lineY - 8} Q ${midX} ${arcY} ${x2} ${lineY - 8}`}
                  fill="none"
                  stroke="rgba(249,115,22,0.3)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              );
            })}

            {/* Character */}
            <text
              x={posToX(currentPosition)}
              y={lineY - 22}
              textAnchor="middle"
              fontSize={24}
              className={isAnimating ? 'transition-all duration-400' : ''}
            >
              {charEmoji}
            </text>

            {/* Predicted position marker */}
            {predictedPosition !== null && (
              <g>
                <circle
                  cx={posToX(predictedPosition)}
                  cy={lineY}
                  r={8}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                />
                <text
                  x={posToX(predictedPosition)}
                  y={lineY - 14}
                  textAnchor="middle"
                  fill="#22c55e"
                  fontSize={10}
                >
                  ✓
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Sequence Display — gated by showSequenceChips. The written running
            record of landings (and the "→ ?" next cue) is a strong self-check
            scaffold; hard tiers withdraw it so the student tracks mentally. */}
        {showSequenceChips && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {landingSpots.map((pos, i) => (
              <React.Fragment key={pos}>
                {i > 0 && <span className="text-slate-600 text-xs">→</span>}
                <span className={`text-sm font-mono font-bold ${
                  pos === currentPosition ? 'text-orange-400' : 'text-slate-300'
                }`}>
                  {pos}
                </span>
              </React.Fragment>
            ))}
            {nextExpectedPosition !== null && (
              <>
                <span className="text-slate-600 text-xs">→</span>
                <span className="text-slate-600 text-sm font-mono">?</span>
              </>
            )}
          </div>
        )}

        {/* Equation Display */}
        {showEquation && jumpCount > 0 && (
          <div className="text-center">
            <span className="text-slate-300 text-sm font-mono">
              {jumpCount} × {skipValue} = <span className="text-orange-300 font-bold">{jumpCount * skipValue + startFrom}</span>
            </span>
          </div>
        )}

        {/* Digit Pattern Highlight */}
        {showDigitPattern && landingSpots.length > 2 && (
          <div className="text-center">
            <span className="text-slate-500 text-xs">
              Ones digits: {landingSpots.map(n => n % 10).join(', ')}
            </span>
          </div>
        )}

        {/* Array Visualization */}
        {showArray && jumpCount > 0 && (
          <div className="bg-slate-800/20 rounded-lg p-3 border border-white/5">
            <p className="text-slate-500 text-xs mb-2 text-center">Array: {jumpCount} rows of {skipValue}</p>
            <div className="flex flex-col items-center gap-1">
              {Array.from({ length: Math.min(jumpCount, 8) }, (_, row) => (
                <div key={row} className="flex gap-1">
                  {Array.from({ length: skipValue }, (_, col) => (
                    <div
                      key={col}
                      className="w-4 h-4 rounded-sm bg-orange-500/40 border border-orange-400/30"
                    />
                  ))}
                  <span className="text-slate-500 text-xs ml-2">{(row + 1) * skipValue + startFrom}</span>
                </div>
              ))}
              {jumpCount > 8 && (
                <span className="text-slate-600 text-xs">...</span>
              )}
            </div>
          </div>
        )}

        {/* Prediction Input */}
        {currentPhase === 'predict' && !isCurrentChallengeComplete && nextExpectedPosition !== null && (
          <div className="flex items-center justify-center gap-3">
            <span className="text-slate-300 text-sm">Next landing:</span>
            <LuminaInput
              type="number"
              inputMode="numeric"
              value={predictionInput}
              onChange={e => setPredictionInput(e.target.value)}
              className="w-20 text-center text-lg"
              onKeyDown={e => e.key === 'Enter' && handleCheckAnswer()}
              autoFocus
            />
          </div>
        )}

        {/* Fill Missing / Find Skip Value Input */}
        {(currentChallenge?.type === 'fill_missing' || currentChallenge?.type === 'find_skip_value') && !isCurrentChallengeComplete && (
          <div className="flex items-center justify-center gap-3">
            <span className="text-slate-300 text-sm">
              {currentChallenge.type === 'find_skip_value' ? 'Skip value:' : 'Missing number:'}
            </span>
            <LuminaInput
              type="number"
              inputMode="numeric"
              value={fillInput}
              onChange={e => setFillInput(e.target.value)}
              className="w-20 text-center text-lg"
              onKeyDown={e => e.key === 'Enter' && handleCheckAnswer()}
              autoFocus
            />
          </div>
        )}

        {/* Multiplication Input */}
        {currentChallenge?.type === 'connect_multiplication' && !isCurrentChallengeComplete && (
          <div className="flex items-center justify-center gap-3">
            <span className="text-slate-300 text-sm">{jumpCount} × {skipValue} =</span>
            <LuminaInput
              type="text"
              inputMode="numeric"
              value={multiplicationInput}
              onChange={e => setMultiplicationInput(e.target.value)}
              placeholder="?"
              className="w-20 text-center text-lg"
              onKeyDown={e => e.key === 'Enter' && handleCheckAnswer()}
              autoFocus
            />
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' :
            'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Streak indicator */}
        {currentStreak >= 3 && (
          <div className="text-center">
            <LuminaBadge accent="orange" className="text-xs">
              Streak: {currentStreak} correct in a row!
            </LuminaBadge>
          </div>
        )}

        {/* Action Buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && (
              <>
                {/* Jump button for watch/jump phases */}
                {(currentPhase === 'watch' || currentPhase === 'jump') && nextExpectedPosition !== null && !autoPlay && (
                  <LuminaButton
                    className="bg-orange-500/10 border border-orange-400/30 hover:bg-orange-500/20 text-orange-300"
                    onClick={performJump}
                    disabled={isAnimating || hasSubmittedEvaluation}
                  >
                    {/* "+N" suffix gated by showSkipValueBadge — same leak guard
                        as the header badge: it would otherwise hand the student
                        the skip value (the answer) for find_skip_value / predict. */}
                    {charEmoji} Jump!{showSkipValueBadge ? ` (+${skipValue})` : ''}
                  </LuminaButton>
                )}

                {/* Check Answer button */}
                {(isCountAlongComplete || currentChallenge?.type === 'predict' || currentChallenge?.type === 'fill_missing' || currentChallenge?.type === 'find_skip_value' || currentChallenge?.type === 'connect_multiplication') && (
                  <LuminaActionButton
                    action="check"
                    onClick={handleCheckAnswer}
                    disabled={hasSubmittedEvaluation}
                  />
                )}
              </>
            )}
            {isCurrentChallengeComplete && !allChallengesComplete && (
              <LuminaActionButton
                action="next"
                onClick={advanceToNextChallenge}
              >
                Next Challenge
              </LuminaActionButton>
            )}
            {allChallengesComplete && (
              <div className="text-center">
                <p className="text-emerald-400 text-sm font-medium mb-2">
                  All challenges complete!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Hint */}
        {currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <LuminaPanel className="p-2 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </LuminaPanel>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage={`You completed all ${challenges.length} skip counting challenges!${longestStreak > 0 ? ` Best streak: ${longestStreak}!` : ''}`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default SkipCountingRunner;
