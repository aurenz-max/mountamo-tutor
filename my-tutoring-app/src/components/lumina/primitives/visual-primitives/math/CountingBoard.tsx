'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CountingBoardMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface CountingBoardChallenge {
  id: string;
  type: 'count_all' | 'subitize' | 'count_on' | 'group_count' | 'compare';
  instruction: string;
  targetAnswer: number;
  count: number;
  arrangement: 'scattered' | 'line' | 'groups' | 'circle';
  groupSize?: number | null;
  startFrom?: number | null;    // for count_on mode
  hint: string;
  narration: string;
}

export interface CountingBoardData {
  title: string;
  description?: string;
  objects: {
    type: 'bears' | 'apples' | 'stars' | 'blocks' | 'fish' | 'butterflies' | 'custom';
  };
  challenges: CountingBoardChallenge[];
  showOptions?: {
    showRunningCount?: boolean;
    showGroupCircles?: boolean;
    highlightOnTap?: boolean;
    showLastNumber?: boolean;
  };
  imagePrompt?: string | null;
  gradeBand?: 'K' | '1';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CountingBoardMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

type Phase = 'count' | 'subitize' | 'organize' | 'countOn';

const PHASE_CONFIG: Record<Phase, { label: string; description: string }> = {
  count: { label: 'Count', description: 'Tap each object to count' },
  subitize: { label: 'Subitize', description: 'How many do you see?' },
  organize: { label: 'Organize', description: 'Group objects to count faster' },
  countOn: { label: 'Count On', description: 'Start from a number and keep counting' },
};

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  count_all: { label: 'Count All', icon: '\uD83D\uDD22', accentColor: 'orange' },
  subitize: { label: 'Subitize', icon: '\u26A1', accentColor: 'purple' },
  group_count: { label: 'Group Count', icon: '\uD83C\uDFAF', accentColor: 'emerald' },
  count_on: { label: 'Count On', icon: '\u2795', accentColor: 'blue' },
  compare: { label: 'Compare', icon: '\u2696\uFE0F', accentColor: 'amber' },
};

const OBJECT_EMOJI: Record<string, string> = {
  bears: '\uD83E\uDDF8',
  apples: '\uD83C\uDF4E',
  stars: '\u2B50',
  blocks: '\uD83D\uDFE6',
  fish: '\uD83D\uDC1F',
  butterflies: '\uD83E\uDD8B',
  custom: '\u2B24',
};

const WORKSPACE_WIDTH = 480;
const WORKSPACE_HEIGHT = 320;
const OBJECT_SIZE = 40;
const OBJECT_PADDING = 24;

// ============================================================================
// Position Generators
// ============================================================================

function generateScatteredPositions(count: number, seed: number = 42): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  let s = seed;
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 2147483647;
  };

  const padX = OBJECT_PADDING + OBJECT_SIZE / 2;
  const padY = OBJECT_PADDING + OBJECT_SIZE / 2;
  const maxX = WORKSPACE_WIDTH - padX;
  const maxY = WORKSPACE_HEIGHT - padY;

  for (let i = 0; i < count; i++) {
    let bestX = padX + rand() * (maxX - padX);
    let bestY = padY + rand() * (maxY - padY);

    for (let attempt = 0; attempt < 20; attempt++) {
      const x = padX + rand() * (maxX - padX);
      const y = padY + rand() * (maxY - padY);
      let tooClose = false;
      for (const p of positions) {
        const dx = x - p.x;
        const dy = y - p.y;
        if (Math.sqrt(dx * dx + dy * dy) < OBJECT_SIZE + 4) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        bestX = x;
        bestY = y;
        break;
      }
    }
    positions.push({ x: bestX, y: bestY });
  }
  return positions;
}

function generateLinePositions(count: number): Array<{ x: number; y: number }> {
  const spacing = Math.min(
    (WORKSPACE_WIDTH - 2 * OBJECT_PADDING) / Math.max(count - 1, 1),
    OBJECT_SIZE + 12
  );
  const totalWidth = spacing * (count - 1);
  const startX = (WORKSPACE_WIDTH - totalWidth) / 2;
  const y = WORKSPACE_HEIGHT / 2;

  return Array.from({ length: count }, (_, i) => ({
    x: startX + i * spacing,
    y,
  }));
}

function generateGroupPositions(count: number, groupSize: number): Array<{ x: number; y: number }> {
  const numGroups = Math.ceil(count / groupSize);
  const groupSpacing = Math.min(
    (WORKSPACE_WIDTH - 2 * OBJECT_PADDING) / Math.max(numGroups, 1),
    160
  );
  const startX = (WORKSPACE_WIDTH - groupSpacing * (numGroups - 1)) / 2;
  const positions: Array<{ x: number; y: number }> = [];

  for (let g = 0; g < numGroups; g++) {
    const groupCenterX = startX + g * groupSpacing;
    const itemsInGroup = Math.min(groupSize, count - g * groupSize);

    for (let i = 0; i < itemsInGroup; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const itemsInRow = Math.min(3, itemsInGroup - row * 3);
      const rowStartX = groupCenterX - ((itemsInRow - 1) * (OBJECT_SIZE * 0.6)) / 2;

      positions.push({
        x: rowStartX + col * (OBJECT_SIZE * 0.6),
        y: WORKSPACE_HEIGHT / 2 - 20 + row * (OBJECT_SIZE * 0.6),
      });
    }
  }
  return positions;
}

function generateCirclePositions(count: number): Array<{ x: number; y: number }> {
  const cx = WORKSPACE_WIDTH / 2;
  const cy = WORKSPACE_HEIGHT / 2;
  const radius = Math.min(WORKSPACE_WIDTH, WORKSPACE_HEIGHT) / 2 - OBJECT_PADDING - OBJECT_SIZE / 2;

  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
}

function generatePositions(count: number, arrangement: string, groupSize?: number | null): Array<{ x: number; y: number }> {
  switch (arrangement) {
    case 'line': return generateLinePositions(count);
    case 'groups': return generateGroupPositions(count, groupSize || 5);
    case 'circle': return generateCirclePositions(count);
    case 'scattered':
    default: return generateScatteredPositions(count);
  }
}

// ============================================================================
// Props
// ============================================================================

interface CountingBoardProps {
  data: CountingBoardData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const CountingBoard: React.FC<CountingBoardProps> = ({ data, className }) => {
  const {
    title,
    description,
    objects,
    challenges = [],
    showOptions = {},
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showRunningCount = true,
    showGroupCircles = false,
    highlightOnTap = true,
    showLastNumber = true,
  } = showOptions;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const emoji = OBJECT_EMOJI[objects.type] || OBJECT_EMOJI.custom;

  const [countedObjects, setCountedObjects] = useState<Set<number>>(new Set());
  const [countOrder, setCountOrder] = useState<Map<number, number>>(new Map());
  const [doubleCounted, setDoubleCounted] = useState(false);

  // Challenge progress tracking (shared hooks)
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

  const [currentPhase, setCurrentPhase] = useState<Phase>(() => {
    if (challenges.length === 0) return 'count';
    const firstType = challenges[0].type;
    if (firstType === 'subitize') return 'subitize';
    if (firstType === 'count_on') return 'countOn';
    if (firstType === 'group_count') return 'organize';
    return 'count';
  });

  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  // Subitize state
  const [subitizeInput, setSubitizeInput] = useState('');
  const [subitizeStartTime, setSubitizeStartTime] = useState(0);

  // Count-on state
  const [countOnInput, setCountOnInput] = useState('');
  const [preCountedCount, setPreCountedCount] = useState(0);

  // Domain-specific tracking (not covered by shared hooks)
  const [usedGrouping, setUsedGrouping] = useState(false);
  const [usedCountOn, setUsedCountOn] = useState(false);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `counting-board-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Per-challenge layout
  // -------------------------------------------------------------------------
  const rawChallenge = challenges[currentChallengeIndex] ?? null;
  const challengeCount = rawChallenge?.count ?? 5;
  const challengeArrangement = rawChallenge?.arrangement ?? 'scattered';
  const challengeGroupSize = rawChallenge?.groupSize;

  const currentChallenge = useMemo(() => {
    return challenges[currentChallengeIndex] || null;
  }, [challenges, currentChallengeIndex]);

  const positions = useMemo(() =>
    generatePositions(challengeCount, challengeArrangement, challengeGroupSize),
    [challengeCount, challengeArrangement, challengeGroupSize]
  );

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<CountingBoardMetrics>({
    primitiveType: 'counting-board',
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
    objectType: objects.type,
    objectCount: challengeCount,
    arrangement: challengeArrangement,
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    instruction: currentChallenge?.instruction ?? 'Free counting',
    challengeType: currentChallenge?.type ?? 'count_all',
    targetAnswer: currentChallenge?.targetAnswer ?? challengeCount,
    currentCount: countedObjects.size,
    attemptNumber: currentAttempts + 1,
    currentPhase,
  }), [
    objects.type, challengeCount, challengeArrangement, gradeBand, challenges.length,
    currentChallengeIndex, currentChallenge, countedObjects.size, currentAttempts, currentPhase,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'counting-board',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;

    sendText(
      `[ACTIVITY_START] This is a counting board activity for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `The first challenge has ${challengeCount} ${objects.type} arranged in a ${challengeArrangement} pattern. `
      + `Each challenge has a different count and arrangement. `
      + `${challenges.length} challenges total. First challenge: "${currentChallenge?.instruction}". `
      + `Introduce the activity warmly: "Look at all these ${objects.type}! Let's count them together." `
      + `Then read the first instruction.`,
      { silent: true }
    );
  }, [isConnected, challenges.length, challengeCount, objects.type, challengeArrangement, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Interaction Handlers
  // -------------------------------------------------------------------------
  const handleObjectTap = useCallback((objectIndex: number) => {
    if (hasSubmittedEvaluation) return;

    if (countedObjects.has(objectIndex)) {
      if (!doubleCounted) {
        setDoubleCounted(true);
        if (isConnected) {
          sendText(
            `[DOUBLE_COUNT] The student tapped an object they already counted (object #${objectIndex + 1}). `
            + `Gently correct: "Oops, you already counted that one! Try tapping a different ${objects.type}."`,
            { silent: true }
          );
        }
      }
      setFeedback(`You already counted that ${objects.type === 'custom' ? 'object' : objects.type.slice(0, -1)}!`);
      setFeedbackType('error');
      return;
    }

    const newCount = countedObjects.size + 1;
    setCountedObjects(prev => {
      const next = new Set(prev);
      next.add(objectIndex);
      return next;
    });
    setCountOrder(prev => {
      const next = new Map(prev);
      next.set(objectIndex, newCount);
      return next;
    });
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, countedObjects, doubleCounted, isConnected, sendText, objects.type]);

  // -------------------------------------------------------------------------
  // Challenge Checking
  // -------------------------------------------------------------------------
  const checkCountChallenge = useCallback(() => {
    if (!currentChallenge) return false;
    const target = currentChallenge.targetAnswer;
    const counted = countedObjects.size;
    const correct = counted === target;
    const oneToOne = counted === target && !doubleCounted;
    incrementAttempts();

    if (correct) {
      setFeedback(`Yes! There are ${target} ${objects.type}!`);
      setFeedbackType('success');
      sendText(
        `[COUNT_CORRECT] Student correctly counted ${target} ${objects.type}. `
        + `${!doubleCounted ? 'Perfect one-to-one correspondence!' : 'They double-counted once but got the right answer.'} `
        + `[CARDINALITY_CHECK] Ask: "How many ${objects.type} altogether?" to check cardinality understanding.`,
        { silent: true }
      );
    } else {
      setFeedback(`You counted ${counted} but there are ${target} ${objects.type}. Try again!`);
      setFeedbackType('error');
      sendText(
        `[COUNT_INCORRECT] Student counted ${counted} but there are ${target} ${objects.type}. `
        + `Attempt ${currentAttempts + 1}. Hint: "Touch each ${objects.type === 'custom' ? 'object' : objects.type.slice(0, -1)} one time as you count."`,
        { silent: true }
      );
    }

    return { correct, oneToOne };
  }, [currentChallenge, countedObjects.size, doubleCounted, objects.type, currentAttempts, sendText, incrementAttempts]);

  const checkSubitizeAnswer = useCallback(() => {
    if (!currentChallenge) return { correct: false, timeMs: 0 };
    const target = currentChallenge.targetAnswer;
    const answer = parseInt(subitizeInput, 10);
    const correct = answer === target;
    const timeMs = Date.now() - subitizeStartTime;
    incrementAttempts();

    if (correct) {
      setFeedback(`Yes! There are ${target} ${objects.type}!`);
      setFeedbackType('success');
      sendText(
        `[SUBITIZE_CORRECT] Student correctly recognized ${target} ${objects.type} in ${timeMs}ms. `
        + `Celebrate: "Great eyes! You knew it was ${target} without counting one by one!"`,
        { silent: true }
      );
    } else {
      setFeedback(`Not quite — you said ${answer}. Look again!`);
      setFeedbackType('error');
      sendText(
        `[SUBITIZE_INCORRECT] Student guessed ${answer} but there are ${target} ${objects.type}. `
        + `Time: ${timeMs}ms. Give a brief hint without revealing the answer.`,
        { silent: true }
      );
    }

    return { correct, timeMs };
  }, [currentChallenge, subitizeInput, subitizeStartTime, objects.type, sendText, incrementAttempts]);

  const checkCountOnAnswer = useCallback(() => {
    if (!currentChallenge) return false;
    const target = currentChallenge.targetAnswer;
    const answer = parseInt(countOnInput, 10);
    const correct = answer === target;
    incrementAttempts();

    if (correct) {
      setFeedback(`Yes! ${preCountedCount} and ${target - preCountedCount} more makes ${target}!`);
      setFeedbackType('success');
      setUsedCountOn(true);
      sendText(
        `[COUNT_ON_CORRECT] Student counted on from ${preCountedCount} to get ${target}. `
        + `Celebrate: "You didn't start from 1 — you counted on from ${preCountedCount}! Smart strategy!"`,
        { silent: true }
      );
    } else {
      setFeedback(`Not quite. Start from ${preCountedCount} and count the rest.`);
      setFeedbackType('error');
      sendText(
        `[COUNT_ON_INCORRECT] Student answered ${answer} but target is ${target}. `
        + `Start from: ${preCountedCount}. Hint: "You know there are ${preCountedCount} in this group. Now count the others: ${preCountedCount + 1}, ${preCountedCount + 2}..."`,
        { silent: true }
      );
    }

    return correct;
  }, [currentChallenge, countOnInput, preCountedCount, sendText, incrementAttempts]);

  // -------------------------------------------------------------------------
  // Challenge Navigation
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;

    let correct = false;
    let timeMs: number | undefined;
    let oneToOne = false;

    switch (currentChallenge.type) {
      case 'count_all':
      case 'group_count':
      case 'compare': {
        const result = checkCountChallenge();
        correct = result ? result.correct : false;
        oneToOne = result ? result.oneToOne : false;
        break;
      }
      case 'subitize': {
        const result = checkSubitizeAnswer();
        correct = result.correct;
        timeMs = result.timeMs;
        break;
      }
      case 'count_on':
        correct = checkCountOnAnswer() ?? false;
        oneToOne = true;
        break;
    }

    if (correct) {
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        timeMs,
        attempts: currentAttempts + 1,
        oneToOne,
      });
    }
  }, [currentChallenge, currentAttempts, checkCountChallenge, checkSubitizeAnswer, checkCountOnAnswer, recordResult]);

  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges complete — use phaseResults for AI feedback
      const phaseScoreStr = phaseResults
        .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100);

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their counting skills!`,
        { silent: true }
      );

      // Submit evaluation
      if (!hasSubmittedEvaluation) {
        const subitizeResults = challengeResults.filter(r => {
          const ch = challenges.find(c => c.id === r.challengeId);
          return ch?.type === 'subitize';
        });

        const countingCorrect = challengeResults.filter(r => r.correct).length;
        const countingAccuracy = challenges.length > 0
          ? Math.round((countingCorrect / challenges.length) * 100) : 0;
        const subitizeAccuracy = subitizeResults.length > 0
          ? Math.round((subitizeResults.filter(r => r.correct).length / subitizeResults.length) * 100) : 0;
        const subitizeSpeed = subitizeResults.length > 0
          ? Math.round(subitizeResults.reduce((s, r) => s + ((r.timeMs as number) || 0), 0) / subitizeResults.length) : 0;
        const oneToOneAll = challengeResults.every(r => r.oneToOne);

        const score = countingAccuracy;

        const metrics: CountingBoardMetrics = {
          type: 'counting-board',
          countingAccuracy,
          oneToOneCorrespondence: oneToOneAll,
          subitizeAccuracy,
          subitizeSpeed,
          countOnUsed: usedCountOn,
          groupingUsed: usedGrouping,
          cardinalityUnderstood: oneToOneAll && countingAccuracy >= 80,
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
        };

        submitEvaluation(
          countingCorrect === challenges.length,
          score,
          metrics,
          { challengeResults }
        );
      }
      return;
    }

    // advanceProgress() already incremented index and reset attempts.
    // Now reset domain-specific state.
    setFeedback('');
    setFeedbackType('');
    setSubitizeInput('');
    setCountOnInput('');
    setCountedObjects(new Set());
    setCountOrder(new Map());
    setDoubleCounted(false);
    const nextChallenge = challenges[currentChallengeIndex + 1];

    // Set phase
    if (nextChallenge.type === 'subitize') setCurrentPhase('subitize');
    else if (nextChallenge.type === 'count_on') {
      setCurrentPhase('countOn');
      const nextChallengeCount = nextChallenge.count ?? 5;
      const startFrom = nextChallenge.startFrom || Math.floor(nextChallenge.targetAnswer / 2);
      setPreCountedCount(startFrom);
      const preCounted = new Set<number>();
      const preOrder = new Map<number, number>();
      for (let i = 0; i < startFrom && i < nextChallengeCount; i++) {
        preCounted.add(i);
        preOrder.set(i, i + 1);
      }
      setCountedObjects(preCounted);
      setCountOrder(preOrder);
    }
    else if (nextChallenge.type === 'group_count') {
      setCurrentPhase('organize');
      setUsedGrouping(true);
    }
    else setCurrentPhase('count');

    sendText(
      `[PHASE_TRANSITION] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}, ${nextChallenge.count} objects in ${nextChallenge.arrangement}). `
      + `Read the instruction to the student and encourage them.`,
      { silent: true }
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, usedCountOn, usedGrouping, submitEvaluation, currentChallengeIndex,
  ]);

  // -------------------------------------------------------------------------
  // Subitize timer start
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (currentChallenge?.type === 'subitize') {
      setSubitizeStartTime(Date.now());
    }
  }, [currentChallengeIndex, currentChallenge?.type]);

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------
  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );

  // -------------------------------------------------------------------------
  // Auto-submit evaluation when all challenges complete
  // -------------------------------------------------------------------------
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // -------------------------------------------------------------------------
  // Overall Score
  // -------------------------------------------------------------------------
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-orange-300 text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-emerald-300 text-xs">
              {challengeArrangement}
            </Badge>
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

        {/* Counting Workspace */}
        <div className="flex justify-center">
          <svg
            width={WORKSPACE_WIDTH}
            height={WORKSPACE_HEIGHT}
            viewBox={`0 0 ${WORKSPACE_WIDTH} ${WORKSPACE_HEIGHT}`}
            className="max-w-full h-auto rounded-xl"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            {/* Workspace border */}
            <rect
              x={1}
              y={1}
              width={WORKSPACE_WIDTH - 2}
              height={WORKSPACE_HEIGHT - 2}
              rx={12}
              ry={12}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1.5}
            />

            {/* Group circles */}
            {showGroupCircles && challengeArrangement === 'groups' && challengeGroupSize && (
              (() => {
                const gs = challengeGroupSize;
                const numGroups = Math.ceil(challengeCount / gs);
                const groupSpacing = Math.min(
                  (WORKSPACE_WIDTH - 2 * OBJECT_PADDING) / Math.max(numGroups, 1),
                  160
                );
                const startX = (WORKSPACE_WIDTH - groupSpacing * (numGroups - 1)) / 2;

                return Array.from({ length: numGroups }, (_, g) => {
                  const itemsInGroup = Math.min(gs, challengeCount - g * gs);
                  const rows = Math.ceil(itemsInGroup / 3);
                  const groupCenterY = WORKSPACE_HEIGHT / 2 - 20 + ((rows - 1) * (OBJECT_SIZE * 0.6)) / 2;
                  const cols = Math.min(3, itemsInGroup);
                  const rx = Math.max(((cols - 1) * (OBJECT_SIZE * 0.6)) / 2 + OBJECT_SIZE / 2 + 6, OBJECT_SIZE);
                  const ry = Math.max(((rows - 1) * (OBJECT_SIZE * 0.6)) / 2 + OBJECT_SIZE / 2 + 6, OBJECT_SIZE);

                  return (
                    <ellipse
                      key={`group-${g}`}
                      cx={startX + g * groupSpacing}
                      cy={groupCenterY}
                      rx={rx}
                      ry={ry}
                      fill="rgba(234,179,8,0.05)"
                      stroke="rgba(234,179,8,0.2)"
                      strokeWidth={1.5}
                      strokeDasharray="6 3"
                    />
                  );
                });
              })()
            )}

            {/* Objects */}
            {positions.map((pos, index) => {
              const isCounted = countedObjects.has(index);
              const countNum = countOrder.get(index);
              const isPreCounted = currentPhase === 'countOn' && index < preCountedCount;

              return (
                <g
                  key={index}
                  className="cursor-pointer"
                  onClick={() => handleObjectTap(index)}
                >
                  {/* Highlight ring */}
                  {highlightOnTap && isCounted && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={OBJECT_SIZE / 2 + 4}
                      fill="none"
                      stroke={isPreCounted ? 'rgba(59,130,246,0.5)' : 'rgba(234,179,8,0.5)'}
                      strokeWidth={2.5}
                      className="transition-all duration-200"
                    />
                  )}

                  {/* Object background circle */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={OBJECT_SIZE / 2}
                    fill={isCounted
                      ? (isPreCounted ? 'rgba(59,130,246,0.15)' : 'rgba(234,179,8,0.12)')
                      : 'rgba(255,255,255,0.04)'
                    }
                    className="transition-colors duration-150"
                  />

                  {/* Emoji */}
                  <text
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={OBJECT_SIZE * 0.6}
                    className="select-none pointer-events-none"
                    style={{ opacity: isCounted ? 1 : 0.7 }}
                  >
                    {emoji}
                  </text>

                  {/* Count number overlay */}
                  {showLastNumber && isCounted && countNum !== undefined && (
                    <g>
                      <circle
                        cx={pos.x + OBJECT_SIZE / 2 - 4}
                        cy={pos.y - OBJECT_SIZE / 2 + 4}
                        r={10}
                        fill={isPreCounted ? '#3b82f6' : '#eab308'}
                        stroke="rgba(0,0,0,0.3)"
                        strokeWidth={1}
                      />
                      <text
                        x={pos.x + OBJECT_SIZE / 2 - 4}
                        y={pos.y - OBJECT_SIZE / 2 + 4}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={11}
                        fill="white"
                        fontWeight="bold"
                        className="pointer-events-none select-none"
                      >
                        {countNum}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Running Count */}
        {showRunningCount && currentPhase !== 'subitize' && (
          <div className="flex items-center justify-center gap-4 text-sm">
            <span className="text-slate-300">
              Counted: <span className="text-orange-300 font-bold text-lg">{countedObjects.size}</span>
              <span className="text-slate-500"> / {challengeCount}</span>
            </span>
          </div>
        )}

        {/* Subitize Input */}
        {currentPhase === 'subitize' && !isCurrentChallengeComplete && (
          <div className="flex items-center justify-center gap-3">
            <span className="text-slate-300 text-sm">How many {objects.type} do you see?</span>
            <input
              type="number"
              min={0}
              max={30}
              value={subitizeInput}
              onChange={e => setSubitizeInput(e.target.value)}
              className="w-16 px-3 py-1.5 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-center text-lg focus:outline-none focus:border-orange-400/50"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCheckAnswer()}
            />
          </div>
        )}

        {/* Count-on Input */}
        {currentPhase === 'countOn' && !isCurrentChallengeComplete && (
          <div className="flex items-center justify-center gap-3">
            <span className="text-slate-300 text-sm">
              There are <span className="text-blue-400 font-bold">{preCountedCount}</span> already counted.
              How many altogether?
            </span>
            <input
              type="number"
              min={0}
              max={30}
              value={countOnInput}
              onChange={e => setCountOnInput(e.target.value)}
              className="w-16 px-3 py-1.5 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-center text-lg focus:outline-none focus:border-orange-400/50"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCheckAnswer()}
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

        {/* Action Buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                onClick={handleCheckAnswer}
                disabled={
                  (currentPhase === 'subitize' && !subitizeInput) ||
                  (currentPhase === 'count' && countedObjects.size === 0) ||
                  hasSubmittedEvaluation
                }
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
                  {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
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

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Counting Complete!"
            celebrationMessage={`You completed all ${challenges.length} challenges with ${objects.type}!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default CountingBoard;
