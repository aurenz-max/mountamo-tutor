'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { TenFrameMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import CalculatorInput from '../../input-primitives/CalculatorInput';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface TenFrameChallenge {
  id: string;
  type: 'build' | 'subitize' | 'make_ten' | 'add' | 'subtract';
  instruction: string;
  targetCount: number;
  flashDuration?: number | null; // ms, for subitize mode
  hint: string;
  narration: string;
}

export interface TenFrameData {
  title: string;
  description?: string;
  mode: 'single' | 'double';
  counters: {
    count: number;
    color: string;
    positions: number[];
  };
  twoColorMode?: {
    enabled: boolean;
    color1Count: number;
    color2Count: number;
    color1: string;
    color2: string;
  };
  challenges: TenFrameChallenge[];
  showOptions?: {
    showCount?: boolean;
    showEquation?: boolean;
    showEmptyCount?: boolean;
    allowFlip?: boolean;
  };
  imagePrompt?: string | null;
  gradeBand?: 'K' | '1-2';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TenFrameMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

type Phase = 'build' | 'subitize' | 'makeTen' | 'operate';

const PHASE_CONFIG: Record<Phase, { label: string; description: string }> = {
  build: { label: 'Build', description: 'Place counters on the frame' },
  subitize: { label: 'Subitize', description: 'How many do you see?' },
  makeTen: { label: 'Make Ten', description: 'What makes 10?' },
  operate: { label: 'Operate', description: 'Add & subtract with frames' },
};

const COUNTER_COLORS: Record<string, string> = {
  red: '#ef4444',
  yellow: '#eab308',
  blue: '#3b82f6',
  green: '#22c55e',
};

const CELL_SIZE = 56;
const CELL_GAP = 4;
const CELL_RADIUS = 8;
const COUNTER_RADIUS = 18;
const FRAME_COLS = 5;
const FRAME_ROWS = 2;
const FRAME_PADDING = 8;

// ============================================================================
// Props
// ============================================================================

interface TenFrameProps {
  data: TenFrameData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const TenFrame: React.FC<TenFrameProps> = ({ data, className }) => {
  const {
    title,
    description,
    mode = 'single',
    counters: initialCounters,
    twoColorMode,
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
    showCount = true,
    showEmptyCount = false,
    showEquation = false,
    allowFlip = false,
  } = showOptions;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const totalCells = mode === 'double' ? 20 : 10;

  const [filledCells, setFilledCells] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    if (initialCounters?.positions) {
      initialCounters.positions.forEach(p => {
        if (p >= 0 && p < totalCells) initial.add(p);
      });
    }
    return initial;
  });

  const [cellColors, setCellColors] = useState<Map<number, string>>(() => {
    const map = new Map<number, string>();
    const color = initialCounters?.color || 'red';
    if (initialCounters?.positions) {
      initialCounters.positions.forEach(p => map.set(p, color));
    }
    return map;
  });

  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<Phase>(() => {
    if (challenges.length === 0) return 'build';
    const firstType = challenges[0].type;
    if (firstType === 'subitize') return 'subitize';
    if (firstType === 'make_ten') return 'makeTen';
    if (firstType === 'add' || firstType === 'subtract') return 'operate';
    return 'build';
  });

  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  // Subitize state
  const [isFlashing, setIsFlashing] = useState(false);
  const [showCounters, setShowCounters] = useState(true);
  const [subitizeInput, setSubitizeInput] = useState('');
  const [subitizeStartTime, setSubitizeStartTime] = useState(0);

  // Make-ten state
  const [makeTenInput, setMakeTenInput] = useState('');

  // Tracking
  const [challengeResults, setChallengeResults] = useState<Array<{
    challengeId: string;
    correct: boolean;
    timeMs?: number;
    attempts: number;
  }>>([]);
  const [currentAttempts, setCurrentAttempts] = useState(0);
  const [placementChanges, setPlacementChanges] = useState(0);
  const [fullFrameReached, setFullFrameReached] = useState(false);
  const [twoColorExplorations, setTwoColorExplorations] = useState(0);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `ten-frame-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const currentChallenge = challenges[currentChallengeIndex] || null;

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<TenFrameMetrics>({
    primitiveType: 'ten-frame',
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
    mode,
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    instruction: currentChallenge?.instruction ?? 'Free exploration',
    challengeType: currentChallenge?.type ?? 'build',
    targetCount: currentChallenge?.targetCount ?? 0,
    currentCount: filledCells.size,
    emptySpaces: totalCells - filledCells.size,
    attemptNumber: currentAttempts + 1,
    currentPhase,
  }), [
    mode, gradeBand, challenges.length, currentChallengeIndex,
    currentChallenge, filledCells.size, totalCells, currentAttempts, currentPhase,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'ten-frame',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1-2',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;

    sendText(
      `[ACTIVITY_START] This is a ten frame activity for ${gradeBand === 'K' ? 'Kindergarten' : 'Grades 1-2'}. `
      + `Mode: ${mode} frame. There are ${challenges.length} challenges. `
      + `First challenge: "${currentChallenge?.instruction}". `
      + `Introduce the activity warmly: mention we're going to use a ten frame to build numbers and discover patterns. `
      + `Then read the first instruction to the student.`,
      { silent: true }
    );
  }, [isConnected, challenges.length, mode, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Interaction Handlers
  // -------------------------------------------------------------------------
  const handleCellClick = useCallback((cellIndex: number) => {
    if (currentPhase === 'subitize' && !showCounters) return; // Can't click during subitize answer phase
    if (hasSubmittedEvaluation) return;

    setFilledCells(prev => {
      const next = new Set(prev);
      if (next.has(cellIndex)) {
        next.delete(cellIndex);
        setCellColors(colors => {
          const newColors = new Map(colors);
          newColors.delete(cellIndex);
          return newColors;
        });
      } else {
        next.add(cellIndex);
        const color = twoColorMode?.enabled
          ? (next.size <= (twoColorMode.color1Count || 5)
            ? twoColorMode.color1 || 'red'
            : twoColorMode.color2 || 'yellow')
          : (initialCounters?.color || 'red');
        setCellColors(colors => {
          const newColors = new Map(colors);
          newColors.set(cellIndex, color);
          return newColors;
        });
      }
      setPlacementChanges(p => p + 1);
      return next;
    });

    setFeedback('');
    setFeedbackType('');
  }, [currentPhase, showCounters, hasSubmittedEvaluation, twoColorMode, initialCounters?.color]);

  // Check if first frame is full (exactly 10)
  useEffect(() => {
    const frame1Count = Array.from(filledCells).filter(c => c < 10).length;
    if (frame1Count === 10 && !fullFrameReached) {
      setFullFrameReached(true);
      if (isConnected) {
        sendText(
          `[FULL_FRAME] The student just filled the ten frame completely with 10 counters! `
          + `Celebrate this moment: "You made 10! The frame is full!"`,
          { silent: true }
        );
      }
    }
  }, [filledCells, fullFrameReached, isConnected, sendText]);

  // -------------------------------------------------------------------------
  // Challenge Checking
  // -------------------------------------------------------------------------
  const checkBuildChallenge = useCallback(() => {
    if (!currentChallenge) return;
    const target = currentChallenge.targetCount;
    const current = filledCells.size;
    const correct = current === target;
    setCurrentAttempts(a => a + 1);

    if (correct) {
      setFeedback(`Correct! You placed ${target} counters!`);
      setFeedbackType('success');
      sendText(
        `[BUILD_CORRECT] Student placed exactly ${target} counters on the ten frame. `
        + `${currentAttempts === 0 ? 'First try!' : `After ${currentAttempts + 1} attempts.`} `
        + `Congratulate briefly and ask about the empty spaces.`,
        { silent: true }
      );
    } else {
      setFeedback(`You have ${current} counters. The target is ${target}. Try again!`);
      setFeedbackType('error');
      sendText(
        `[BUILD_INCORRECT] Student placed ${current} counters but target is ${target}. `
        + `Attempt ${currentAttempts + 1}. `
        + `Give a brief hint: "Count the counters. Do you need more or fewer?"`,
        { silent: true }
      );
    }

    return correct;
  }, [currentChallenge, filledCells.size, currentAttempts, sendText]);

  const startSubitizeFlash = useCallback(() => {
    if (!currentChallenge) return;
    const target = currentChallenge.targetCount;

    // Place counters for the flash
    const positions: number[] = [];
    for (let i = 0; i < target && i < totalCells; i++) {
      positions.push(i);
    }
    setFilledCells(new Set(positions));
    setCellColors(() => {
      const m = new Map<number, string>();
      positions.forEach(p => m.set(p, initialCounters?.color || 'red'));
      return m;
    });

    setIsFlashing(true);
    setShowCounters(true);
    setSubitizeInput('');
    setSubitizeStartTime(Date.now());

    const duration = currentChallenge.flashDuration || 1500;
    setTimeout(() => {
      setShowCounters(false);
      setIsFlashing(false);
    }, duration);
  }, [currentChallenge, totalCells, initialCounters?.color]);

  const checkSubitizeAnswer = useCallback(() => {
    if (!currentChallenge) return;
    const target = currentChallenge.targetCount;
    const answer = parseInt(subitizeInput, 10);
    const correct = answer === target;
    const timeMs = Date.now() - subitizeStartTime;
    setCurrentAttempts(a => a + 1);

    if (correct) {
      setShowCounters(true);
      setFeedback(`Yes! There were ${target} counters!`);
      setFeedbackType('success');
      sendText(
        `[SUBITIZE_CORRECT] Student correctly identified ${target} counters in ${timeMs}ms. `
        + `Celebrate: "Great eyes! You saw ${target} without counting!"`,
        { silent: true }
      );
    } else {
      setFeedback(`Not quite. You said ${answer}. Look again!`);
      setFeedbackType('error');
      sendText(
        `[SUBITIZE_INCORRECT] Student guessed ${answer} but there were ${target} counters. `
        + `Time: ${timeMs}ms. Give a brief hint without revealing the answer.`,
        { silent: true }
      );
    }

    return { correct, timeMs };
  }, [currentChallenge, subitizeInput, subitizeStartTime, sendText]);

  const checkMakeTenAnswer = useCallback(() => {
    if (!currentChallenge) return;
    const currentCount = filledCells.size;
    const complement = 10 - currentCount;
    const answer = parseInt(makeTenInput, 10);
    const correct = answer === complement;
    setCurrentAttempts(a => a + 1);

    if (correct) {
      setFeedback(`Yes! ${currentCount} + ${complement} = 10!`);
      setFeedbackType('success');
      sendText(
        `[MAKE_TEN_CORRECT] Student correctly found ${complement} as the complement to make 10. `
        + `Current count: ${currentCount}. Celebrate and connect to the empty spaces on the frame.`,
        { silent: true }
      );
    } else {
      setFeedback(`Not quite. Look at the empty spaces on the frame.`);
      setFeedbackType('error');
      sendText(
        `[MAKE_TEN_INCORRECT] Student answered ${answer} but ${currentCount} + ${complement} = 10. `
        + `Hint: "Count the empty spaces on the frame."`,
        { silent: true }
      );
    }

    return correct;
  }, [currentChallenge, filledCells.size, makeTenInput, sendText]);

  // -------------------------------------------------------------------------
  // Challenge Navigation
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;

    let correct = false;
    let timeMs: number | undefined;

    switch (currentChallenge.type) {
      case 'build':
        correct = checkBuildChallenge() ?? false;
        break;
      case 'subitize': {
        const result = checkSubitizeAnswer();
        correct = result?.correct ?? false;
        timeMs = result?.timeMs;
        break;
      }
      case 'make_ten':
        correct = checkMakeTenAnswer() ?? false;
        break;
      case 'add':
      case 'subtract':
        correct = checkBuildChallenge() ?? false;
        break;
    }

    if (correct) {
      setChallengeResults(prev => [
        ...prev,
        {
          challengeId: currentChallenge.id,
          correct: true,
          timeMs,
          attempts: currentAttempts + 1,
        },
      ]);
    }
  }, [currentChallenge, currentAttempts, checkBuildChallenge, checkSubitizeAnswer, checkMakeTenAnswer]);

  const advanceToNextChallenge = useCallback(() => {
    const nextIndex = currentChallengeIndex + 1;

    if (nextIndex >= challenges.length) {
      // All challenges complete
      sendText(
        `[CHALLENGE_COMPLETE] The student completed all ${challenges.length} challenges! `
        + `Celebrate the full session and summarize what they learned.`,
        { silent: true }
      );

      // Submit evaluation
      if (!hasSubmittedEvaluation) {
        const subitizeResults = challengeResults.filter(
          (r, i) => challenges[i]?.type === 'subitize'
        );
        const makeTenResults = challengeResults.filter(
          (r, i) => challenges[i]?.type === 'make_ten'
        );

        const subitizeAccuracy = subitizeResults.length > 0
          ? (subitizeResults.filter(r => r.correct).length / subitizeResults.length) * 100
          : 0;
        const subitizeAvgTime = subitizeResults.length > 0
          ? subitizeResults.reduce((sum, r) => sum + (r.timeMs || 0), 0) / subitizeResults.length
          : 0;

        const totalCorrect = challengeResults.filter(r => r.correct).length;
        const score = challenges.length > 0
          ? Math.round((totalCorrect / challenges.length) * 100)
          : 0;

        const metrics: TenFrameMetrics = {
          type: 'ten-frame',
          challengesCompleted: totalCorrect,
          challengesTotal: challenges.length,
          subitizeAccuracy,
          subitizeAverageTime: Math.round(subitizeAvgTime),
          makeTenCorrect: makeTenResults.filter(r => r.correct).length,
          makeTenTotal: makeTenResults.length,
          usedMakeTenStrategy: fullFrameReached,
          counterPlacementEfficiency: placementChanges <= challenges.reduce((s, c) => s + c.targetCount, 0),
          twoColorDecompositionsExplored: twoColorExplorations,
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
    setSubitizeInput('');
    setMakeTenInput('');
    setShowCounters(true);

    const nextChallenge = challenges[nextIndex];

    // Reset frame for next challenge unless it's an operate challenge building on previous
    if (nextChallenge.type !== 'add' && nextChallenge.type !== 'subtract') {
      setFilledCells(new Set());
      setCellColors(new Map());
    }

    // Set phase
    if (nextChallenge.type === 'subitize') setCurrentPhase('subitize');
    else if (nextChallenge.type === 'make_ten') setCurrentPhase('makeTen');
    else if (nextChallenge.type === 'add' || nextChallenge.type === 'subtract') setCurrentPhase('operate');
    else setCurrentPhase('build');

    sendText(
      `[PHASE_TRANSITION] Moving to challenge ${nextIndex + 1} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}). `
      + `Read the instruction to the student and encourage them.`,
      { silent: true }
    );
  }, [
    currentChallengeIndex, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, fullFrameReached, placementChanges,
    twoColorExplorations, submitEvaluation,
  ]);

  // -------------------------------------------------------------------------
  // Subitize auto-start
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (currentPhase === 'subitize' && currentChallenge?.type === 'subitize' && showCounters && !isFlashing) {
      // Ready to flash — give a brief delay for the student to prepare
      const timer = setTimeout(() => startSubitizeFlash(), 800);
      return () => clearTimeout(timer);
    }
  }, [currentPhase, currentChallenge, showCounters, isFlashing, startSubitizeFlash]);

  // -------------------------------------------------------------------------
  // Make-ten: pre-fill counters
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (currentPhase === 'makeTen' && currentChallenge?.type === 'make_ten') {
      const count = currentChallenge.targetCount;
      const positions: number[] = [];
      for (let i = 0; i < count && i < 10; i++) positions.push(i);
      setFilledCells(new Set(positions));
      setCellColors(() => {
        const m = new Map<number, string>();
        positions.forEach(p => m.set(p, initialCounters?.color || 'red'));
        return m;
      });
    }
  }, [currentPhase, currentChallenge, initialCounters?.color]);

  // -------------------------------------------------------------------------
  // SVG Rendering Helpers
  // -------------------------------------------------------------------------
  const renderFrame = useCallback((frameIndex: number) => {
    const offsetX = frameIndex * (FRAME_COLS * (CELL_SIZE + CELL_GAP) + FRAME_PADDING * 2 + 24);
    const cells: React.ReactNode[] = [];

    for (let row = 0; row < FRAME_ROWS; row++) {
      for (let col = 0; col < FRAME_COLS; col++) {
        const cellIndex = frameIndex * 10 + row * FRAME_COLS + col;
        const x = offsetX + FRAME_PADDING + col * (CELL_SIZE + CELL_GAP);
        const y = FRAME_PADDING + row * (CELL_SIZE + CELL_GAP);
        const isFilled = filledCells.has(cellIndex);
        const counterColor = cellColors.get(cellIndex) || 'red';
        const shouldShowCounter = isFilled && showCounters;

        cells.push(
          <g key={cellIndex}>
            {/* Cell background */}
            <rect
              x={x}
              y={y}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={CELL_RADIUS}
              ry={CELL_RADIUS}
              className="cursor-pointer transition-colors duration-150"
              fill={isFilled && showCounters ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1.5}
              onClick={() => handleCellClick(cellIndex)}
            />
            {/* Counter */}
            {shouldShowCounter && (
              <circle
                cx={x + CELL_SIZE / 2}
                cy={y + CELL_SIZE / 2}
                r={COUNTER_RADIUS}
                fill={COUNTER_COLORS[counterColor] || counterColor}
                className="transition-all duration-200"
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                }}
                onClick={() => handleCellClick(cellIndex)}
              />
            )}
          </g>
        );
      }
    }

    // Frame border
    const frameWidth = FRAME_COLS * (CELL_SIZE + CELL_GAP) - CELL_GAP + FRAME_PADDING * 2;
    const frameHeight = FRAME_ROWS * (CELL_SIZE + CELL_GAP) - CELL_GAP + FRAME_PADDING * 2;

    const frame1Full = Array.from(filledCells).filter(c => c >= frameIndex * 10 && c < (frameIndex + 1) * 10).length === 10;

    return (
      <g key={`frame-${frameIndex}`}>
        <rect
          x={offsetX}
          y={0}
          width={frameWidth}
          height={frameHeight}
          rx={12}
          ry={12}
          fill="none"
          stroke={frame1Full ? 'rgba(234,179,8,0.6)' : 'rgba(255,255,255,0.2)'}
          strokeWidth={frame1Full ? 3 : 2}
          className="transition-colors duration-300"
        />
        {frame1Full && (
          <rect
            x={offsetX}
            y={0}
            width={frameWidth}
            height={frameHeight}
            rx={12}
            ry={12}
            fill="none"
            stroke="rgba(234,179,8,0.3)"
            strokeWidth={8}
            className="animate-pulse"
          />
        )}
        {cells}
      </g>
    );
  }, [filledCells, cellColors, showCounters, handleCellClick]);

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------
  const counterCount = filledCells.size;
  const emptyCount = totalCells - counterCount;
  const frameCount = mode === 'double' ? 2 : 1;
  const svgWidth = frameCount * (FRAME_COLS * (CELL_SIZE + CELL_GAP) - CELL_GAP + FRAME_PADDING * 2) + (frameCount - 1) * 24;
  const svgHeight = FRAME_ROWS * (CELL_SIZE + CELL_GAP) - CELL_GAP + FRAME_PADDING * 2;

  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );
  const allChallengesComplete = challenges.length > 0 && challengeResults.filter(r => r.correct).length >= challenges.length;

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
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1-2'}
            </Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-emerald-300 text-xs">
              {mode === 'double' ? 'Double Frame' : 'Ten Frame'}
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

        {/* Ten Frame SVG */}
        <div className="flex justify-center">
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="max-w-full h-auto"
          >
            {Array.from({ length: frameCount }, (_, i) => renderFrame(i))}
          </svg>
        </div>

        {/* Counter Info */}
        <div className="flex items-center justify-center gap-4 text-sm">
          {showCount && (
            <span className="text-slate-300">
              Counters: <span className="text-orange-300 font-bold">{counterCount}</span>
            </span>
          )}
          {showEmptyCount && (
            <span className="text-slate-300">
              Empty: <span className="text-slate-400 font-bold">{emptyCount}</span>
            </span>
          )}
          {showEquation && currentChallenge?.type === 'add' && (
            <span className="text-slate-300">
              Equation: <span className="text-emerald-300 font-mono">{counterCount} = ?</span>
            </span>
          )}
        </div>

        {/* Subitize Input */}
        {currentPhase === 'subitize' && !showCounters && !isFlashing && !isCurrentChallengeComplete && (
          <CalculatorInput
            label="How many counters did you see?"
            value={subitizeInput}
            onChange={setSubitizeInput}
            onSubmit={handleCheckAnswer}
            showSubmitButton={true}
            allowNegative={false}
            allowDecimal={false}
            maxLength={2}
          />
        )}

        {/* Make-ten Input */}
        {currentPhase === 'makeTen' && !isCurrentChallengeComplete && (
          <CalculatorInput
            label={`${counterCount} + ___ = 10`}
            value={makeTenInput}
            onChange={setMakeTenInput}
            onSubmit={handleCheckAnswer}
            showSubmitButton={true}
            allowNegative={false}
            allowDecimal={false}
            maxLength={2}
          />
        )}

        {/* Flash button for subitize */}
        {currentPhase === 'subitize' && showCounters && !isFlashing && !isCurrentChallengeComplete && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              className="bg-orange-500/10 border border-orange-400/30 hover:bg-orange-500/20 text-orange-300"
              onClick={startSubitizeFlash}
            >
              Flash Counters
            </Button>
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
                  (currentPhase === 'subitize' && (showCounters || isFlashing)) ||
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
      </CardContent>
    </Card>
  );
};

export default TenFrame;
