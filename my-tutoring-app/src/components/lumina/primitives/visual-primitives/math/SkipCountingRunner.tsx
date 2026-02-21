'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SkipCountingRunnerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface SkipCountingChallenge {
  id: string;
  type: 'count_along' | 'predict' | 'fill_missing' | 'find_skip_value' | 'connect_multiplication';
  instruction: string;
  hiddenPositions?: number[];
  targetFact?: string | null;
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
  };
  gameMode?: {
    enabled?: boolean;
    type?: 'catch_the_number' | 'fill_the_gaps' | 'speed_count';
    timeLimit?: number | null;
  };
  gradeBand?: '1-2' | '2-3';

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
  } = showOptions;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<Phase>(() => {
    if (challenges.length === 0) return 'watch';
    const firstType = challenges[0].type;
    if (firstType === 'predict') return 'predict';
    if (firstType === 'connect_multiplication') return 'connect';
    if (firstType === 'count_along') return 'watch';
    return 'jump';
  });

  // Number line state
  const [currentPosition, setCurrentPosition] = useState(startFrom);
  const [landingSpots, setLandingSpots] = useState<number[]>([startFrom]);
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
  const [challengeResults, setChallengeResults] = useState<Array<{
    challengeId: string;
    correct: boolean;
    type: string;
    attempts: number;
  }>>([]);
  const [currentAttempts, setCurrentAttempts] = useState(0);
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
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
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
  }), [
    skipValue, startFrom, endAt, direction, currentPosition, jumpCount,
    challenges.length, currentChallengeIndex, currentChallenge,
    currentAttempts, currentPhase, currentStreak, landingSpots, gradeBand,
  ]);

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
    sendText(
      `[ACTIVITY_START] This is a skip counting activity for ${gradeBand === '1-2' ? 'Grades 1-2' : 'Grades 2-3'}. `
      + `Skip value: ${skipValue}. Count ${direction} from ${startFrom} to ${endAt}. `
      + `Character: ${charName}. There are ${challenges.length} challenges. `
      + `First challenge: "${currentChallenge?.instruction}". `
      + `Introduce the activity with excitement: "${charName} is going to jump by ${skipValue}s! Let's count together!" `
      + `Then read the first instruction.`,
      { silent: true }
    );
  }, [isConnected, challenges.length, skipValue, direction, startFrom, endAt, character.type, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Jump Logic
  // -------------------------------------------------------------------------
  const performJump = useCallback(() => {
    if (isAnimating || hasSubmittedEvaluation || nextExpectedPosition === null) return;

    setIsAnimating(true);

    // Animate jump
    setTimeout(() => {
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
            + `${jumpNum >= 3 ? `Connect to multiplication: "${jumpNum} × ${skipValue} = ${nextExpectedPosition}!"` : 'Keep counting along rhythmically.'}`,
            { silent: true }
          );
        }
      }
    }, 400);
  }, [isAnimating, hasSubmittedEvaluation, nextExpectedPosition, jumpCount, skipValue, endAt, landingSpots, isConnected, sendText]);

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
    setCurrentAttempts(a => a + 1);

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
      setTimeout(() => {
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
        + `Hint: "We're counting by ${skipValue}s. What is ${currentPosition} plus ${skipValue}?"`,
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, nextExpectedPosition, predictionInput, currentPosition, skipValue, currentAttempts, currentStreak, sendText, performJump]);

  const checkFillMissing = useCallback(() => {
    if (!currentChallenge) return false;
    const hiddenPos = currentChallenge.hiddenPositions || [];
    const answer = parseInt(fillInput, 10);
    // Check if the answer matches any hidden position that hasn't been found yet
    const correct = hiddenPos.includes(answer) && !landingSpots.includes(answer);
    setCurrentAttempts(a => a + 1);

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
        + `Hint: "Start from ${startFrom} and add ${skipValue} each time."`,
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, fillInput, skipValue, startFrom, landingSpots, currentAttempts, sendText]);

  const checkFindSkipValue = useCallback(() => {
    if (!currentChallenge) return false;
    const answer = parseInt(fillInput, 10);
    const correct = answer === skipValue;
    setCurrentAttempts(a => a + 1);

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
      sendText(
        `[SKIP_VALUE_INCORRECT] Student guessed ${answer} but the skip value is ${skipValue}. `
        + `Hint: "Look at the numbers: ${allPositions.slice(0, 4).join(', ')}. What do you add each time?"`,
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, fillInput, skipValue, allPositions, currentAttempts, sendText]);

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
    setCurrentAttempts(a => a + 1);

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
        + `Hint: "You made ${jumpCount} jumps, each jump was ${skipValue}. What is ${jumpCount} × ${skipValue}?"`,
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, jumpCount, skipValue, currentPosition, startFrom, multiplicationInput, currentAttempts, sendText]);

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
      setChallengeResults(prev => [
        ...prev,
        {
          challengeId: currentChallenge.id,
          correct: true,
          type: currentChallenge.type,
          attempts: currentAttempts + 1,
        },
      ]);
    }
  }, [
    currentChallenge, currentAttempts, nextExpectedPosition,
    checkPrediction, checkFillMissing, checkFindSkipValue, checkMultiplication,
    skipValue, startFrom, endAt, sendText,
  ]);

  const advanceToNextChallenge = useCallback(() => {
    const nextIndex = currentChallengeIndex + 1;

    if (nextIndex >= challenges.length) {
      // All challenges complete
      sendText(
        `[CHALLENGE_COMPLETE] The student completed all ${challenges.length} skip counting challenges! `
        + `Skip value: ${skipValue}. Jumps made: ${jumpCount}. Longest streak: ${longestStreak}. `
        + `Celebrate and summarize what they learned about counting by ${skipValue}s.`,
        { silent: true }
      );

      // Submit evaluation
      if (!hasSubmittedEvaluation) {
        const jumpResults = challengeResults.filter(r => r.type === 'count_along' || r.type === 'predict');
        const predictionResults = challengeResults.filter(r => r.type === 'predict');
        const totalCorrect = challengeResults.filter(r => r.correct).length;
        const score = challenges.length > 0
          ? Math.round((totalCorrect / challenges.length) * 100)
          : 0;

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
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
        };

        submitEvaluation(
          totalCorrect === challenges.length,
          score,
          metrics,
          { challengeResults }
        );
      }
      return;
    }

    // Move to next challenge
    setCurrentChallengeIndex(nextIndex);
    setCurrentAttempts(0);
    setFeedback('');
    setFeedbackType('');
    setPredictionInput('');
    setPredictedPosition(null);
    setMultiplicationInput('');
    setFillInput('');

    // Reset number line for the next challenge (keep progress for connect challenges)
    const nextChallenge = challenges[nextIndex];
    if (nextChallenge.type !== 'connect_multiplication') {
      setCurrentPosition(startFrom);
      setLandingSpots([startFrom]);
      setCurrentStreak(0);
    }

    // Set phase
    if (nextChallenge.type === 'count_along') setCurrentPhase('watch');
    else if (nextChallenge.type === 'predict') setCurrentPhase('predict');
    else if (nextChallenge.type === 'connect_multiplication') setCurrentPhase('connect');
    else setCurrentPhase('jump');

    sendText(
      `[PHASE_TRANSITION] Moving to challenge ${nextIndex + 1} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}). `
      + `Read the instruction and encourage them.`,
      { silent: true }
    );
  }, [
    currentChallengeIndex, challenges, challengeResults, sendText, skipValue,
    jumpCount, longestStreak, hasSubmittedEvaluation, skipValuesExplored,
    backwardCountingAttempted, multiplicationConnectionMade, patternIdentified,
    submitEvaluation, startFrom,
  ]);

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------
  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );
  const allChallengesComplete = challenges.length > 0
    && challengeResults.filter(r => r.correct).length >= challenges.length;

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
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">
            <span className="mr-2">{charEmoji}</span>{title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-orange-300 text-xs">
              {gradeBand === '1-2' ? 'Grades 1-2' : 'Grades 2-3'}
            </Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-emerald-300 text-xs">
              Count by {skipValue}s
            </Badge>
            {direction === 'backward' && (
              <Badge className="bg-slate-800/50 border-slate-700/50 text-purple-300 text-xs">
                Backward
              </Badge>
            )}
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase Progress */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(PHASE_CONFIG).map(([phase, config]) => (
              <Badge
                key={phase}
                className={`text-xs ${
                  currentPhase === phase
                    ? 'bg-orange-500/20 border-orange-400/50 text-orange-300'
                    : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                }`}
              >
                {config.label}
              </Badge>
            ))}
            <span className="text-slate-500 text-xs ml-auto">
              Challenge {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
            </span>
          </div>
        )}

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.instruction}
            </p>
          </div>
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
                  {/* Label */}
                  {isMultiple && (
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

        {/* Sequence Display */}
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
            <input
              type="number"
              value={predictionInput}
              onChange={e => setPredictionInput(e.target.value)}
              className="w-20 px-3 py-1.5 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-center text-lg focus:outline-none focus:border-orange-400/50"
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
            <input
              type="number"
              value={fillInput}
              onChange={e => setFillInput(e.target.value)}
              className="w-20 px-3 py-1.5 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-center text-lg focus:outline-none focus:border-orange-400/50"
              onKeyDown={e => e.key === 'Enter' && handleCheckAnswer()}
              autoFocus
            />
          </div>
        )}

        {/* Multiplication Input */}
        {currentChallenge?.type === 'connect_multiplication' && !isCurrentChallengeComplete && (
          <div className="flex items-center justify-center gap-3">
            <span className="text-slate-300 text-sm">{jumpCount} × {skipValue} =</span>
            <input
              type="text"
              value={multiplicationInput}
              onChange={e => setMultiplicationInput(e.target.value)}
              placeholder="?"
              className="w-20 px-3 py-1.5 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-center text-lg focus:outline-none focus:border-orange-400/50"
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
            <Badge className="bg-orange-500/10 border-orange-400/30 text-orange-300 text-xs">
              Streak: {currentStreak} correct in a row!
            </Badge>
          </div>
        )}

        {/* Action Buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && (
              <>
                {/* Jump button for watch/jump phases */}
                {(currentPhase === 'watch' || currentPhase === 'jump') && nextExpectedPosition !== null && !autoPlay && (
                  <Button
                    variant="ghost"
                    className="bg-orange-500/10 border border-orange-400/30 hover:bg-orange-500/20 text-orange-300"
                    onClick={performJump}
                    disabled={isAnimating || hasSubmittedEvaluation}
                  >
                    {charEmoji} Jump! (+{skipValue})
                  </Button>
                )}

                {/* Check Answer button */}
                {(isCountAlongComplete || currentChallenge?.type === 'predict' || currentChallenge?.type === 'fill_missing' || currentChallenge?.type === 'find_skip_value' || currentChallenge?.type === 'connect_multiplication') && (
                  <Button
                    variant="ghost"
                    className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                    onClick={handleCheckAnswer}
                    disabled={hasSubmittedEvaluation}
                  >
                    Check Answer
                  </Button>
                )}
              </>
            )}
            {isCurrentChallengeComplete && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={advanceToNextChallenge}
              >
                Next Challenge
              </Button>
            )}
            {allChallengesComplete && (
              <div className="text-center">
                <p className="text-emerald-400 text-sm font-medium mb-2">
                  All challenges complete!
                </p>
                <p className="text-slate-400 text-xs">
                  {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
                  {longestStreak > 0 && ` · Best streak: ${longestStreak}`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Hint */}
        {currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SkipCountingRunner;
