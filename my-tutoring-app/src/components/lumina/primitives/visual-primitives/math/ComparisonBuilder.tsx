'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ComparisonBuilderMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ComparisonBuilderChallenge {
  id: string;
  type: 'compare-groups' | 'compare-numbers' | 'order' | 'one-more-one-less';
  instruction: string;
  // compare-groups
  leftGroup?: { count: number; objectType: string };
  rightGroup?: { count: number; objectType: string };
  correctAnswer?: 'more' | 'less' | 'equal';
  // compare-numbers
  leftNumber?: number;
  rightNumber?: number;
  correctSymbol?: '<' | '>' | '=';
  // order
  numbers?: number[];
  direction?: 'ascending' | 'descending';
  // one-more-one-less
  targetNumber?: number;
  askFor?: 'one-more' | 'one-less' | 'both';
}

export interface ComparisonBuilderData {
  title: string;
  description?: string;
  challenges: ComparisonBuilderChallenge[];
  gradeBand: 'K' | '1';
  showCorrespondenceLines: boolean;
  useAlligatorMnemonic: boolean;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ComparisonBuilderMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'compare-groups': { label: 'Compare Groups', icon: '\uD83D\uDC3B', accentColor: 'orange' },
  'compare-numbers': { label: 'Compare Numbers', icon: '\uD83D\uDD22', accentColor: 'blue' },
  'order': { label: 'Order', icon: '\uD83D\uDCCA', accentColor: 'purple' },
  'one-more-one-less': { label: 'One More / Less', icon: '\u2795', accentColor: 'emerald' },
};

const OBJECT_EMOJI: Record<string, string> = {
  bears: '\uD83E\uDDF8',
  apples: '\uD83C\uDF4E',
  stars: '\u2B50',
  blocks: '\uD83D\uDFE6',
  fish: '\uD83D\uDC1F',
  butterflies: '\uD83E\uDD8B',
  hearts: '\u2764\uFE0F',
  flowers: '\uD83C\uDF38',
  cookies: '\uD83C\uDF6A',
  balls: '\uD83D\uDD34',
};

const GROUP_WIDTH = 200;
const GROUP_HEIGHT = 200;
const GAP = 80;
const SVG_WIDTH = GROUP_WIDTH * 2 + GAP;
const SVG_HEIGHT = GROUP_HEIGHT + 40;

// ============================================================================
// Position Helpers
// ============================================================================

function generateGridPositions(
  count: number,
  offsetX: number,
  offsetY: number,
): Array<{ x: number; y: number }> {
  const cols = Math.min(count, 5);
  const rows = Math.ceil(count / 5);
  const spacing = 36;
  const totalWidth = (cols - 1) * spacing;
  const totalHeight = (rows - 1) * spacing;
  const startX = offsetX + (GROUP_WIDTH - totalWidth) / 2;
  const startY = offsetY + (GROUP_HEIGHT - totalHeight) / 2;

  return Array.from({ length: count }, (_, i) => ({
    x: startX + (i % cols) * spacing,
    y: startY + Math.floor(i / cols) * spacing,
  }));
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Renders an inequality symbol — optionally as a friendly alligator mouth.
 *
 * Layout: the alligator body sits behind the jaw hinge (V vertex) and the
 * mouth opens AWAY from the body toward the bigger number.
 *
 *   < (less-than):  body LEFT,  mouth opens RIGHT  →  eats bigger right number
 *   > (greater-than): body RIGHT, mouth opens LEFT  →  eats bigger left number
 */
function AlligatorSymbol({
  symbol,
  size = 48,
  useAlligator,
}: {
  symbol: '<' | '>' | '=';
  size?: number;
  useAlligator: boolean;
}) {
  if (!useAlligator || symbol === '=') {
    return (
      <span className="text-slate-100 font-bold" style={{ fontSize: size }}>
        {symbol}
      </span>
    );
  }

  const isLessThan = symbol === '<';
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 60 40" width={size} height={size * 0.67}>
        {/* Body (behind the jaw hinge) */}
        <ellipse
          cx={isLessThan ? 10 : 50}
          cy={20}
          rx={8}
          ry={7}
          fill="rgba(34,197,94,0.25)"
          stroke="rgba(34,197,94,0.5)"
          strokeWidth={1.5}
        />
        {/* Eye */}
        <circle cx={isLessThan ? 12 : 48} cy={15} r={2.5} fill="white" />
        <circle cx={isLessThan ? 12 : 48} cy={15} r={1.2} fill="#1e293b" />
        {/* Jaw V — vertex (hinge) near body, tips (opening) away from body */}
        <path
          d={
            isLessThan
              ? 'M 48 6 L 16 20 L 48 34'   /* < shape: hinge left, opens right */
              : 'M 12 6 L 44 20 L 12 34'    /* > shape: hinge right, opens left */
          }
          fill="none"
          stroke="rgba(34,197,94,0.8)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Teeth (near the mouth opening / jaw tips) */}
        {isLessThan ? (
          /* < mouth opens RIGHT — teeth near x ≈ 40-46 */
          <>
            <line x1="40" y1="11" x2="44" y2="14" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
            <line x1="36" y1="9" x2="40" y2="12" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
            <line x1="40" y1="29" x2="44" y2="26" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
            <line x1="36" y1="31" x2="40" y2="28" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
          </>
        ) : (
          /* > mouth opens LEFT — teeth near x ≈ 14-20 */
          <>
            <line x1="20" y1="11" x2="16" y2="14" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
            <line x1="24" y1="9" x2="20" y2="12" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
            <line x1="20" y1="29" x2="16" y2="26" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
            <line x1="24" y1="31" x2="20" y2="28" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
          </>
        )}
      </svg>
    </div>
  );
}

// ============================================================================
// Props
// ============================================================================

interface ComparisonBuilderProps {
  data: ComparisonBuilderData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const ComparisonBuilder: React.FC<ComparisonBuilderProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    gradeBand = 'K',
    showCorrespondenceLines = true,
    useAlligatorMnemonic = true,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Shared challenge progress
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
  });

  // -------------------------------------------------------------------------
  // Domain-specific state
  // -------------------------------------------------------------------------
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [orderedNumbers, setOrderedNumbers] = useState<number[]>([]);
  const [oneMoreAnswer, setOneMoreAnswer] = useState<number | null>(null);
  const [oneLessAnswer, setOneLessAnswer] = useState<number | null>(null);
  const [showLines, setShowLines] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // Shuffled numbers for order challenges
  const [shuffledNumbers, setShuffledNumbers] = useState<number[]>([]);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `comparison-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // Current challenge
  const currentChallenge = useMemo(
    () => challenges[currentChallengeIndex] || null,
    [challenges, currentChallengeIndex],
  );

  // Shuffle numbers when entering an order challenge
  useEffect(() => {
    if (currentChallenge?.type === 'order' && currentChallenge.numbers) {
      const nums = [...currentChallenge.numbers];
      // Simple deterministic shuffle seeded by challenge index
      for (let i = nums.length - 1; i > 0; i--) {
        const j = Math.abs(((currentChallengeIndex + 1) * 7 + i * 13) % (i + 1));
        [nums[i], nums[j]] = [nums[j], nums[i]];
      }
      setShuffledNumbers(nums);
    }
  }, [currentChallenge, currentChallengeIndex]);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<ComparisonBuilderMetrics>({
    primitiveType: 'comparison-builder',
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
    challengeType: currentChallenge?.type ?? 'compare-groups',
    leftCount: currentChallenge?.leftGroup?.count,
    rightCount: currentChallenge?.rightGroup?.count,
    leftNumber: currentChallenge?.leftNumber,
    rightNumber: currentChallenge?.rightNumber,
    correctAnswer: currentChallenge?.correctAnswer ?? currentChallenge?.correctSymbol,
    targetNumber: currentChallenge?.targetNumber,
    askFor: currentChallenge?.askFor,
    gradeBand,
    useAlligatorMnemonic,
    instruction: currentChallenge?.instruction ?? '',
    totalChallenges: challenges.length,
    currentChallengeIndex,
    attemptNumber: currentAttempts + 1,
  }), [
    currentChallenge, gradeBand, useAlligatorMnemonic,
    challenges.length, currentChallengeIndex, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'comparison-builder',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;

    const types = Array.from(new Set(challenges.map((c) => c.type))).join(', ');
    sendText(
      `[ACTIVITY_START] Comparison activity for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges covering: ${types}. `
      + `${useAlligatorMnemonic ? 'Using alligator mnemonic for inequality symbols. ' : ''}`
      + `First challenge: "${currentChallenge?.instruction}". Introduce warmly.`,
      { silent: true },
    );
  }, [isConnected, challenges.length, gradeBand, useAlligatorMnemonic, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Check Answer — compare-groups
  // -------------------------------------------------------------------------
  const checkCompareGroups = useCallback(() => {
    if (!currentChallenge || !selectedAnswer) return false;
    const correct = selectedAnswer === currentChallenge.correctAnswer;
    const leftCount = currentChallenge.leftGroup?.count ?? 0;
    const rightCount = currentChallenge.rightGroup?.count ?? 0;
    incrementAttempts();

    if (correct) {
      const answerWord = currentChallenge.correctAnswer === 'equal' ? 'the same as' : `${currentChallenge.correctAnswer === 'more' ? 'more' : 'fewer'} than`;
      setFeedback(
        `That's right! The left group (${leftCount}) has ${answerWord} the right group (${rightCount})!`,
      );
      setFeedbackType('success');
      setShowLines(true);
      sendText(
        `[ANSWER_CORRECT] Student correctly identified that left (${leftCount}) has ${answerWord} right (${rightCount}). `
        + `Congratulate briefly! ${showCorrespondenceLines ? 'Point out the matching lines.' : ''}`,
        { silent: true },
      );
    } else {
      setFeedback('Not quite — count each group carefully and try again!');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student chose "${selectedAnswer}" but correct is "${currentChallenge.correctAnswer}". `
        + `Left has ${leftCount}, right has ${rightCount}. Attempt ${currentAttempts + 1}. `
        + `${useAlligatorMnemonic
          ? 'Hint: "Count the objects on each side. Which side has more?"'
          : 'Give a gentle hint to count each group.'}`,
        { silent: true },
      );
    }

    return correct;
  }, [
    currentChallenge, selectedAnswer, incrementAttempts,
    showCorrespondenceLines, useAlligatorMnemonic, currentAttempts, sendText,
  ]);

  // -------------------------------------------------------------------------
  // Check Answer — compare-numbers
  // -------------------------------------------------------------------------
  const checkCompareNumbers = useCallback(() => {
    if (!currentChallenge || !selectedAnswer) return false;
    const correct = selectedAnswer === currentChallenge.correctSymbol;
    incrementAttempts();

    if (correct) {
      setFeedback(
        `Yes! ${currentChallenge.leftNumber} ${currentChallenge.correctSymbol} ${currentChallenge.rightNumber}`,
      );
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student correctly chose ${currentChallenge.correctSymbol} `
        + `for ${currentChallenge.leftNumber} vs ${currentChallenge.rightNumber}. Congratulate!`,
        { silent: true },
      );
    } else {
      setFeedback('Not quite. Think about which number is bigger.');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student chose "${selectedAnswer}" but correct is "${currentChallenge.correctSymbol}" `
        + `for ${currentChallenge.leftNumber} vs ${currentChallenge.rightNumber}. `
        + `Attempt ${currentAttempts + 1}. `
        + `${useAlligatorMnemonic
          ? '"Remember, the alligator always eats the bigger number! Which number is bigger?"'
          : 'Give a hint about which is bigger.'}`,
        { silent: true },
      );
    }

    return correct;
  }, [currentChallenge, selectedAnswer, incrementAttempts, useAlligatorMnemonic, currentAttempts, sendText]);

  // -------------------------------------------------------------------------
  // Check Answer — order
  // -------------------------------------------------------------------------
  const checkOrder = useCallback(() => {
    if (!currentChallenge || !currentChallenge.numbers) return false;
    const expected = [...currentChallenge.numbers].sort((a, b) =>
      currentChallenge.direction === 'descending' ? b - a : a - b,
    );
    const correct =
      orderedNumbers.length === expected.length &&
      orderedNumbers.every((n, i) => n === expected[i]);
    incrementAttempts();

    if (correct) {
      setFeedback(`Perfect order! ${orderedNumbers.join(', ')}`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student correctly ordered numbers ${currentChallenge.direction}: `
        + `${orderedNumbers.join(', ')}. Celebrate!`,
        { silent: true },
      );
    } else {
      setFeedback('Not quite the right order. Try again!');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student ordered: ${orderedNumbers.join(', ')} but correct is: `
        + `${expected.join(', ')} (${currentChallenge.direction}). `
        + `Attempt ${currentAttempts + 1}. `
        + `Hint: "Which number is the ${currentChallenge.direction === 'ascending' ? 'smallest' : 'biggest'}? Start with that one."`,
        { silent: true },
      );
    }

    return correct;
  }, [currentChallenge, orderedNumbers, incrementAttempts, currentAttempts, sendText]);

  // -------------------------------------------------------------------------
  // Check Answer — one-more-one-less
  // -------------------------------------------------------------------------
  const checkOneMoreOneLess = useCallback(() => {
    if (!currentChallenge || currentChallenge.targetNumber === undefined) return false;
    const target = currentChallenge.targetNumber;
    const askFor = currentChallenge.askFor ?? 'both';
    incrementAttempts();

    let correct = false;
    if (askFor === 'one-more') {
      correct = oneMoreAnswer === target + 1;
    } else if (askFor === 'one-less') {
      correct = oneLessAnswer === target - 1;
    } else {
      correct = oneMoreAnswer === target + 1 && oneLessAnswer === target - 1;
    }

    if (correct) {
      const parts: string[] = [];
      if (askFor !== 'one-less') parts.push(`one more is ${target + 1}`);
      if (askFor !== 'one-more') parts.push(`one less is ${target - 1}`);
      setFeedback(`That's right! ${parts.join(' and ')}.`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student correctly found one ${askFor} of ${target}. `
        + `${askFor === 'both' ? `One more: ${target + 1}, one less: ${target - 1}.` : ''} Congratulate!`,
        { silent: true },
      );
    } else {
      setFeedback('Not quite. Think about counting forward or backward by 1.');
      setFeedbackType('error');
      const studentAnswers =
        askFor === 'both'
          ? `one more: ${oneMoreAnswer ?? '?'}, one less: ${oneLessAnswer ?? '?'}`
          : askFor === 'one-more'
            ? `${oneMoreAnswer ?? '?'}`
            : `${oneLessAnswer ?? '?'}`;
      sendText(
        `[ANSWER_INCORRECT] Target: ${target}, askFor: ${askFor}. Student answered: ${studentAnswers}. `
        + `Correct: one more=${target + 1}, one less=${target - 1}. `
        + `Attempt ${currentAttempts + 1}. `
        + `Hint: "Start at ${target} and count ${askFor === 'one-less' ? 'backward' : 'forward'} by one."`,
        { silent: true },
      );
    }

    return correct;
  }, [currentChallenge, oneMoreAnswer, oneLessAnswer, incrementAttempts, currentAttempts, sendText]);

  // -------------------------------------------------------------------------
  // Master check handler
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;

    let correct = false;
    switch (currentChallenge.type) {
      case 'compare-groups':
        correct = checkCompareGroups();
        break;
      case 'compare-numbers':
        correct = checkCompareNumbers();
        break;
      case 'order':
        correct = checkOrder();
        break;
      case 'one-more-one-less':
        correct = checkOneMoreOneLess();
        break;
    }

    if (correct) {
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
    }
  }, [
    currentChallenge, currentAttempts,
    checkCompareGroups, checkCompareNumbers, checkOrder, checkOneMoreOneLess,
    recordResult,
  ]);

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------
  const isCurrentChallengeComplete = challengeResults.some(
    (r) => r.challengeId === currentChallenge?.id && r.correct,
  );

  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges complete
      const phaseScoreStr = phaseResults
        .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter((r) => r.correct).length / challenges.length) * 100,
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their comparison skills!`,
        { silent: true },
      );

      // Submit evaluation
      if (!hasSubmittedEvaluation) {
        const totalCorrect = challengeResults.filter((r) => r.correct).length;
        const overallAccuracy = Math.round(
          (totalCorrect / challenges.length) * 100,
        );

        const accuracyByType = (type: string) => {
          const chs = challenges.filter((c) => c.type === type);
          const rs = challengeResults.filter((r) =>
            chs.some((c) => c.id === r.challengeId),
          );
          if (chs.length === 0) return -1;
          return Math.round(
            (rs.filter((r) => r.correct).length / chs.length) * 100,
          );
        };

        const symbolChallenges = challenges.filter(
          (c) => c.type === 'compare-numbers',
        );
        const symbolCorrect = challengeResults.filter((r) =>
          symbolChallenges.some((c) => c.id === r.challengeId && r.correct),
        ).length;

        const metrics: ComparisonBuilderMetrics = {
          type: 'comparison-builder',
          overallAccuracy,
          compareGroupsAccuracy: accuracyByType('compare-groups'),
          compareNumbersAccuracy: accuracyByType('compare-numbers'),
          orderAccuracy: accuracyByType('order'),
          oneMoreOneLessAccuracy: accuracyByType('one-more-one-less'),
          symbolsCorrect: symbolCorrect,
          symbolsTotal: symbolChallenges.length,
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
        };

        submitEvaluation(
          totalCorrect === challenges.length,
          overallAccuracy,
          metrics,
          { challengeResults },
        );
      }
      return;
    }

    // Reset domain-specific state for next challenge
    setSelectedAnswer(null);
    setOrderedNumbers([]);
    setOneMoreAnswer(null);
    setOneLessAnswer(null);
    setShowLines(false);
    setFeedback('');
    setFeedbackType('');

    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}). `
      + `Read the instruction and encourage the student.`,
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, submitEvaluation, currentChallengeIndex,
  ]);

  // Auto-submit when all complete
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // Overall score
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter((r) => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // -------------------------------------------------------------------------
  // Can-check guard
  // -------------------------------------------------------------------------
  const canCheck = useMemo(() => {
    if (!currentChallenge || isCurrentChallengeComplete || allChallengesComplete) return false;
    switch (currentChallenge.type) {
      case 'compare-groups':
      case 'compare-numbers':
        return !!selectedAnswer;
      case 'order':
        return orderedNumbers.length === (currentChallenge.numbers?.length ?? 0);
      case 'one-more-one-less': {
        const askFor = currentChallenge.askFor ?? 'both';
        if (askFor === 'one-more') return oneMoreAnswer !== null;
        if (askFor === 'one-less') return oneLessAnswer !== null;
        return oneMoreAnswer !== null && oneLessAnswer !== null;
      }
      default:
        return false;
    }
  }, [
    currentChallenge, isCurrentChallengeComplete, allChallengesComplete,
    selectedAnswer, orderedNumbers, oneMoreAnswer, oneLessAnswer,
  ]);

  // =========================================================================
  // Render: compare-groups
  // =========================================================================
  const renderCompareGroups = () => {
    if (!currentChallenge || currentChallenge.type !== 'compare-groups') return null;

    const left = currentChallenge.leftGroup ?? { count: 3, objectType: 'stars' };
    const right = currentChallenge.rightGroup ?? { count: 5, objectType: 'stars' };
    const leftEmoji = OBJECT_EMOJI[left.objectType] || '\u2B50';
    const rightEmoji = OBJECT_EMOJI[right.objectType] || '\u2B50';

    const leftPositions = generateGridPositions(left.count, 0, 20);
    const rightPositions = generateGridPositions(right.count, GROUP_WIDTH + GAP, 20);
    const pairCount = Math.min(left.count, right.count);

    return (
      <div className="space-y-4">
        {/* SVG workspace */}
        <div className="flex justify-center">
          <svg
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="max-w-full h-auto"
          >
            {/* Left group bg */}
            <rect
              x={4} y={4}
              width={GROUP_WIDTH - 8} height={GROUP_HEIGHT + 12}
              rx={12}
              fill="rgba(249,115,22,0.06)"
              stroke="rgba(249,115,22,0.2)"
              strokeWidth={1.5}
            />
            <text
              x={GROUP_WIDTH / 2} y={GROUP_HEIGHT + 32}
              textAnchor="middle" fontSize={13}
              fill="rgba(249,115,22,0.7)"
              className="select-none"
            >
              Left
            </text>

            {/* Right group bg */}
            <rect
              x={GROUP_WIDTH + GAP + 4} y={4}
              width={GROUP_WIDTH - 8} height={GROUP_HEIGHT + 12}
              rx={12}
              fill="rgba(59,130,246,0.06)"
              stroke="rgba(59,130,246,0.2)"
              strokeWidth={1.5}
            />
            <text
              x={GROUP_WIDTH + GAP + GROUP_WIDTH / 2} y={GROUP_HEIGHT + 32}
              textAnchor="middle" fontSize={13}
              fill="rgba(59,130,246,0.7)"
              className="select-none"
            >
              Right
            </text>

            {/* Correspondence lines */}
            {showLines && showCorrespondenceLines && (
              <>
                {Array.from({ length: pairCount }, (_, i) => (
                  <line
                    key={`line-${i}`}
                    x1={leftPositions[i].x} y1={leftPositions[i].y}
                    x2={rightPositions[i].x} y2={rightPositions[i].y}
                    stroke="rgba(168,85,247,0.4)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                ))}
              </>
            )}

            {/* Left objects */}
            {leftPositions.map((pos, i) => {
              const isLeftover = showLines && i >= pairCount;
              return (
                <g key={`left-${i}`}>
                  {isLeftover && (
                    <circle
                      cx={pos.x} cy={pos.y} r={18}
                      fill="none"
                      stroke="rgba(249,115,22,0.5)"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  )}
                  <text
                    x={pos.x} y={pos.y}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={24}
                    className="select-none pointer-events-none"
                  >
                    {leftEmoji}
                  </text>
                </g>
              );
            })}

            {/* Right objects */}
            {rightPositions.map((pos, i) => {
              const isLeftover = showLines && i >= pairCount;
              return (
                <g key={`right-${i}`}>
                  {isLeftover && (
                    <circle
                      cx={pos.x} cy={pos.y} r={18}
                      fill="none"
                      stroke="rgba(59,130,246,0.5)"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  )}
                  <text
                    x={pos.x} y={pos.y}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={24}
                    className="select-none pointer-events-none"
                  >
                    {rightEmoji}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Count labels */}
        <div className="flex items-center justify-center gap-8 text-sm">
          <span className="text-orange-300">
            Left: <span className="font-bold text-lg">{left.count}</span>
          </span>
          <span className="text-slate-500">vs</span>
          <span className="text-blue-300">
            Right: <span className="font-bold text-lg">{right.count}</span>
          </span>
        </div>

        {/* Answer buttons */}
        {!isCurrentChallengeComplete && (
          <div className="space-y-2">
            <p className="text-center text-sm text-slate-400">
              The <span className="text-orange-300 font-semibold">left</span> group has…
            </p>
            <div className="flex justify-center gap-3">
              {(['more', 'less', 'equal'] as const).map((answer) => (
                <Button
                  key={answer}
                  variant="ghost"
                  className={`px-6 py-3 text-base ${
                    selectedAnswer === answer
                      ? 'bg-purple-500/20 border-purple-400/50 text-purple-300 border'
                      : 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200'
                  }`}
                  onClick={() => setSelectedAnswer(answer)}
                >
                  {answer === 'equal' ? 'The Same' : answer === 'more' ? 'More' : 'Fewer'}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Toggle correspondence lines button */}
        {showCorrespondenceLines && !showLines && isCurrentChallengeComplete && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 text-xs"
              onClick={() => setShowLines(true)}
            >
              Show matching lines
            </Button>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // Render: compare-numbers
  // =========================================================================
  const renderCompareNumbers = () => {
    if (!currentChallenge || currentChallenge.type !== 'compare-numbers') return null;

    const left = currentChallenge.leftNumber ?? 0;
    const right = currentChallenge.rightNumber ?? 0;

    return (
      <div className="space-y-6">
        {/* Large number display with symbol slot */}
        <div className="flex items-center justify-center gap-6">
          <div className="w-28 h-28 flex items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-400/30">
            <span className="text-5xl font-bold text-orange-300">{left}</span>
          </div>

          <div className="w-20 h-20 flex items-center justify-center rounded-xl bg-slate-800/40 border border-white/10">
            {selectedAnswer ? (
              <AlligatorSymbol
                symbol={selectedAnswer as '<' | '>' | '='}
                size={40}
                useAlligator={useAlligatorMnemonic}
              />
            ) : (
              <span className="text-2xl text-slate-600">?</span>
            )}
          </div>

          <div className="w-28 h-28 flex items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-400/30">
            <span className="text-5xl font-bold text-blue-300">{right}</span>
          </div>
        </div>

        {/* Alligator hint */}
        {useAlligatorMnemonic && !isCurrentChallengeComplete && (
          <p className="text-center text-slate-500 text-xs italic">
            The alligator always eats the bigger number!
          </p>
        )}

        {/* Symbol buttons */}
        {!isCurrentChallengeComplete && (
          <div className="flex justify-center gap-3">
            {(['<', '>', '='] as const).map((symbol) => (
              <Button
                key={symbol}
                variant="ghost"
                className={`w-16 h-20 text-2xl font-bold flex flex-col items-center gap-0.5 ${
                  selectedAnswer === symbol
                    ? 'bg-purple-500/20 border-purple-400/50 text-purple-300 border-2'
                    : 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200'
                }`}
                onClick={() => setSelectedAnswer(symbol)}
              >
                {useAlligatorMnemonic && symbol !== '=' ? (
                  <>
                    <AlligatorSymbol symbol={symbol} size={28} useAlligator />
                    <span className="text-xs text-slate-500 font-mono">{symbol}</span>
                  </>
                ) : (
                  symbol
                )}
              </Button>
            ))}
          </div>
        )}

        {/* Confirmed answer */}
        {isCurrentChallengeComplete && (
          <div className="flex items-center justify-center gap-3 text-2xl">
            <span className="text-orange-300 font-bold">{left}</span>
            <AlligatorSymbol
              symbol={currentChallenge.correctSymbol ?? '='}
              size={36}
              useAlligator={useAlligatorMnemonic}
            />
            <span className="text-blue-300 font-bold">{right}</span>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // Render: order
  // =========================================================================
  const renderOrder = () => {
    if (!currentChallenge || currentChallenge.type !== 'order') return null;

    const direction = currentChallenge.direction ?? 'ascending';
    const totalSlots = currentChallenge.numbers?.length ?? 0;
    const availableNumbers = shuffledNumbers.filter(
      (n) => !orderedNumbers.includes(n),
    );

    return (
      <div className="space-y-5">
        {/* Direction label */}
        <div className="text-center">
          <Badge className="bg-purple-500/20 border-purple-400/30 text-purple-300 text-xs">
            {direction === 'ascending' ? 'Least \u2192 Greatest' : 'Greatest \u2192 Least'}
          </Badge>
        </div>

        {/* Ordered slots */}
        <div className="flex justify-center gap-2 min-h-[64px]">
          {Array.from({ length: totalSlots }, (_, i) => (
            <div
              key={`slot-${i}`}
              className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 border-dashed transition-all ${
                i < orderedNumbers.length
                  ? 'bg-emerald-500/15 border-emerald-400/40 cursor-pointer'
                  : i === orderedNumbers.length
                    ? 'bg-white/5 border-white/30'
                    : 'bg-slate-800/30 border-slate-600/30'
              }`}
              onClick={() => {
                if (
                  i === orderedNumbers.length - 1 &&
                  !isCurrentChallengeComplete
                ) {
                  setOrderedNumbers((prev) => prev.slice(0, -1));
                }
              }}
            >
              {i < orderedNumbers.length ? (
                <span className="text-xl font-bold text-emerald-300">
                  {orderedNumbers[i]}
                </span>
              ) : (
                <span className="text-slate-600 text-sm">{i + 1}</span>
              )}
            </div>
          ))}
        </div>

        {/* Available number cards */}
        {!isCurrentChallengeComplete && (
          <div className="flex justify-center gap-2 flex-wrap">
            {availableNumbers.map((num) => (
              <Button
                key={`card-${num}`}
                variant="ghost"
                className="w-14 h-14 text-xl font-bold bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 hover:text-white"
                onClick={() => setOrderedNumbers((prev) => [...prev, num])}
              >
                {num}
              </Button>
            ))}
          </div>
        )}

        {/* Reset button */}
        {!isCurrentChallengeComplete && orderedNumbers.length > 0 && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400 text-xs"
              onClick={() => setOrderedNumbers([])}
            >
              Start Over
            </Button>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // Render: one-more-one-less
  // =========================================================================
  const renderOneMoreOneLess = () => {
    if (!currentChallenge || currentChallenge.type !== 'one-more-one-less') return null;

    const target = currentChallenge.targetNumber ?? 5;
    const askFor = currentChallenge.askFor ?? 'both';
    const maxNum = Math.max(target + 5, 20);

    const numberRow = (
      selected: number | null,
      onSelect: (n: number) => void,
      label: string,
      colorClass: string,
    ) => (
      <div className="space-y-2">
        <p className={`text-sm font-medium text-center ${colorClass}`}>{label}</p>
        <div className="flex justify-center gap-1.5 flex-wrap">
          {Array.from({ length: Math.min(maxNum + 1, 21) }, (_, i) => (
            <Button
              key={i}
              variant="ghost"
              className={`w-10 h-10 text-sm font-bold p-0 ${
                selected === i
                  ? 'bg-purple-500/20 border-purple-400/50 text-purple-300 border-2'
                  : i === target
                    ? 'bg-amber-500/10 border-amber-400/30 text-amber-300 border'
                    : 'bg-white/5 border border-white/15 hover:bg-white/10 text-slate-300'
              }`}
              onClick={() => {
                if (!isCurrentChallengeComplete) onSelect(i);
              }}
              disabled={isCurrentChallengeComplete}
            >
              {i}
            </Button>
          ))}
        </div>
      </div>
    );

    return (
      <div className="space-y-5">
        {/* Target number */}
        <div className="flex items-center justify-center">
          <div className="w-24 h-24 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-amber-300">{target}</span>
            <span className="text-xs text-amber-400/70 mt-1">Target</span>
          </div>
        </div>

        {/* Number rows */}
        {(askFor === 'one-more' || askFor === 'both') &&
          numberRow(
            oneMoreAnswer,
            setOneMoreAnswer,
            `One more than ${target}?`,
            'text-emerald-400',
          )}
        {(askFor === 'one-less' || askFor === 'both') &&
          numberRow(
            oneLessAnswer,
            setOneLessAnswer,
            `One less than ${target}?`,
            'text-blue-400',
          )}
      </div>
    );
  };

  // =========================================================================
  // Main Render
  // =========================================================================
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-orange-300 text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </Badge>
            {currentChallenge && (
              <Badge className="bg-slate-800/50 border-slate-700/50 text-purple-300 text-xs">
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </Badge>
            )}
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase badges + progress */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(CHALLENGE_TYPE_CONFIG).map(([type, config]) => {
              if (!challenges.some((c) => c.type === type)) return null;
              return (
                <Badge
                  key={type}
                  className={`text-xs ${
                    currentChallenge?.type === type
                      ? 'bg-orange-500/20 border-orange-400/50 text-orange-300'
                      : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                  }`}
                >
                  {config.icon} {config.label}
                </Badge>
              );
            })}
            <span className="text-slate-500 text-xs ml-auto">
              Challenge {Math.min(currentChallengeIndex + 1, challenges.length)} of{' '}
              {challenges.length}
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

        {/* Challenge workspace */}
        {!allChallengesComplete && (
          <>
            {currentChallenge?.type === 'compare-groups' && renderCompareGroups()}
            {currentChallenge?.type === 'compare-numbers' && renderCompareNumbers()}
            {currentChallenge?.type === 'order' && renderOrder()}
            {currentChallenge?.type === 'one-more-one-less' && renderOneMoreOneLess()}
          </>
        )}

        {/* Feedback */}
        {feedback && (
          <div
            className={`text-center text-sm font-medium ${
              feedbackType === 'success'
                ? 'text-emerald-400'
                : feedbackType === 'error'
                  ? 'text-red-400'
                  : 'text-slate-300'
            }`}
          >
            {feedback}
          </div>
        )}

        {/* Action buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                onClick={handleCheckAnswer}
                disabled={!canCheck || hasSubmittedEvaluation}
              >
                Check Answer
              </Button>
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
                  {challengeResults.filter((r) => r.correct).length} / {challenges.length} correct
                </p>
              </div>
            )}
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Comparison Complete!"
            celebrationMessage={`You completed all ${challenges.length} comparison challenges!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default ComparisonBuilder;
