'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { StrategyPickerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type StrategyId =
  | 'counting-on'
  | 'counting-back'
  | 'make-ten'
  | 'doubles'
  | 'near-doubles'
  | 'tally-marks'
  | 'draw-objects';

export type ChallengeType =
  | 'guided-strategy'
  | 'try-another'
  | 'compare'
  | 'choose-your-strategy'
  | 'match-strategy';

export interface StrategyPickerChallenge {
  id: string;
  type: ChallengeType;
  instruction: string;
  problem: {
    equation: string;
    operation: 'addition' | 'subtraction';
    operand1: number;
    operand2: number;
    result: number;
  };
  // guided-strategy & try-another
  assignedStrategy?: StrategyId;
  strategySteps?: string[];
  // compare
  strategies?: string[];
  comparisonQuestion?: string;
  // choose-your-strategy
  availableStrategies?: StrategyId[];
  // match-strategy
  workedSolution?: string;
  strategyOptions?: string[];
  correctStrategy?: string;
}

export interface StrategyPickerData {
  title: string;
  description?: string;
  challenges: StrategyPickerChallenge[];
  maxNumber: number;
  operations: ('addition' | 'subtraction')[];
  strategiesIntroduced: StrategyId[];
  gradeBand: 'K' | '1';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<StrategyPickerMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'guided-strategy':      { label: 'Guided Strategy',      icon: '🎯', accentColor: 'purple' },
  'try-another':          { label: 'Try Another',          icon: '🔄', accentColor: 'blue' },
  'compare':              { label: 'Compare',              icon: '⚖️', accentColor: 'amber' },
  'choose-your-strategy': { label: 'Choose Strategy',      icon: '🧠', accentColor: 'emerald' },
  'match-strategy':       { label: 'Match Strategy',       icon: '🔍', accentColor: 'cyan' },
};

const STRATEGY_INFO: Record<StrategyId, { label: string; icon: string; color: string }> = {
  'counting-on':   { label: 'Counting On',   icon: '➡️', color: 'blue' },
  'counting-back': { label: 'Counting Back', icon: '⬅️', color: 'indigo' },
  'make-ten':      { label: 'Make Ten',      icon: '🔟', color: 'emerald' },
  'doubles':       { label: 'Doubles',       icon: '🪞', color: 'purple' },
  'near-doubles':  { label: 'Near Doubles',  icon: '🔢', color: 'pink' },
  'tally-marks':   { label: 'Tally Marks',   icon: '📊', color: 'amber' },
  'draw-objects':  { label: 'Draw Objects',  icon: '✏️', color: 'orange' },
};

// ============================================================================
// Strategy Visualizations (SVG)
// ============================================================================

const SVG_W = 420;
const SVG_H = 140;

function NumberLineViz({ operand1, operand2, operation, hopsRevealed }: {
  operand1: number; operand2: number; operation: 'addition' | 'subtraction'; hopsRevealed: number;
}) {
  const max = Math.max(operand1 + operand2 + 2, 12);
  const startNum = operation === 'subtraction' ? operand1 : operand1;
  const hopCount = operand2;
  const direction = operation === 'subtraction' ? -1 : 1;
  const lineY = 100;
  const margin = 30;
  const usable = SVG_W - margin * 2;
  const step = usable / max;

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="max-w-full h-auto">
      {/* Number line */}
      <line x1={margin} y1={lineY} x2={SVG_W - margin} y2={lineY} stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
      {/* Ticks and numbers */}
      {Array.from({ length: max + 1 }, (_, i) => {
        const x = margin + i * step;
        return (
          <g key={i}>
            <line x1={x} y1={lineY - 6} x2={x} y2={lineY + 6} stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
            <text x={x} y={lineY + 20} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.6)">{i}</text>
          </g>
        );
      })}
      {/* Start marker */}
      <circle cx={margin + startNum * step} cy={lineY} r={6} fill="#3b82f6" />
      {/* Hop arcs */}
      {Array.from({ length: Math.min(hopsRevealed, hopCount) }, (_, i) => {
        const fromNum = startNum + i * direction;
        const toNum = fromNum + direction;
        const x1 = margin + fromNum * step;
        const x2 = margin + toNum * step;
        const midX = (x1 + x2) / 2;
        return (
          <g key={`hop-${i}`}>
            <path
              d={`M ${x1} ${lineY} Q ${midX} ${lineY - 35} ${x2} ${lineY}`}
              fill="none"
              stroke="#60a5fa"
              strokeWidth={2}
              strokeDasharray={i === hopsRevealed - 1 ? '4 2' : 'none'}
            />
            <circle cx={x2} cy={lineY} r={4} fill="#60a5fa" />
            <text x={midX} y={lineY - 38} textAnchor="middle" fontSize={9} fill="#93c5fd">
              +1
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function TenFrameViz({ operand1, operand2 }: { operand1: number; operand2: number }) {
  const total = operand1 + operand2;
  const cellW = 36;
  const cellH = 36;
  const gap = 3;
  const cols = 5;
  const rows = 2;
  const frameW = cols * (cellW + gap) - gap;
  const startX = (SVG_W - frameW) / 2;
  const startY = 20;

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="max-w-full h-auto">
      {/* Frame cells */}
      {Array.from({ length: rows * cols }, (_, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = startX + col * (cellW + gap);
        const y = startY + row * (cellH + gap);
        const filled = i < total;
        const isFirstGroup = i < operand1;

        return (
          <g key={i}>
            <rect
              x={x} y={y} width={cellW} height={cellH} rx={4}
              fill={filled ? (isFirstGroup ? 'rgba(59,130,246,0.3)' : 'rgba(234,179,8,0.3)') : 'rgba(255,255,255,0.05)'}
              stroke={filled ? (isFirstGroup ? 'rgba(59,130,246,0.6)' : 'rgba(234,179,8,0.6)') : 'rgba(255,255,255,0.15)'}
              strokeWidth={1.5}
            />
            {filled && (
              <circle
                cx={x + cellW / 2} cy={y + cellH / 2} r={12}
                fill={isFirstGroup ? '#3b82f6' : '#eab308'}
              />
            )}
          </g>
        );
      })}
      {/* Labels */}
      <text x={SVG_W / 2} y={startY + rows * (cellH + gap) + 20} textAnchor="middle" fontSize={12} fill="rgba(255,255,255,0.7)">
        {operand1} + {operand2} = {total}
      </text>
    </svg>
  );
}

function DoublesViz({ operand1, operand2, isNearDoubles }: {
  operand1: number; operand2: number; isNearDoubles: boolean;
}) {
  const base = Math.min(operand1, operand2);
  const extra = Math.abs(operand1 - operand2);
  const dotR = 10;
  const dotGap = 26;
  const groupGap = 50;
  const colsPerGroup = Math.min(base, 5);
  const rowsPerGroup = Math.ceil(base / 5);

  const groupW = colsPerGroup * dotGap;
  const totalW = groupW * 2 + groupGap + (isNearDoubles ? dotGap : 0);
  const startX = (SVG_W - totalW) / 2;
  const startY = 20;

  const renderDots = (count: number, offsetX: number, color: string) =>
    Array.from({ length: count }, (_, i) => {
      const row = Math.floor(i / 5);
      const col = i % 5;
      return (
        <circle
          key={i}
          cx={offsetX + col * dotGap + dotR}
          cy={startY + row * dotGap + dotR}
          r={dotR}
          fill={color}
        />
      );
    });

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="max-w-full h-auto">
      {/* Mirror line */}
      <line
        x1={startX + groupW + groupGap / 2}
        y1={10}
        x2={startX + groupW + groupGap / 2}
        y2={SVG_H - 20}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      {/* Left group */}
      {renderDots(base, startX, '#a78bfa')}
      {/* Right group */}
      {renderDots(base, startX + groupW + groupGap, '#a78bfa')}
      {/* Extra dot for near-doubles */}
      {isNearDoubles && extra > 0 && (
        <circle
          cx={startX + groupW * 2 + groupGap + dotGap / 2 + dotR}
          cy={startY + (rowsPerGroup - 1) * dotGap + dotR}
          r={dotR}
          fill="#f472b6"
          strokeWidth={2}
          stroke="#f472b6"
        />
      )}
      {/* Label */}
      <text x={SVG_W / 2} y={SVG_H - 8} textAnchor="middle" fontSize={12} fill="rgba(255,255,255,0.7)">
        {isNearDoubles ? `${base} + ${base} + ${extra}` : `${base} + ${base}`} = {operand1 + operand2}
      </text>
    </svg>
  );
}

function TallyViz({ total }: { total: number }) {
  const groups = Math.floor(total / 5);
  const remainder = total % 5;
  const tallyGap = 14;
  const groupGap = 30;
  const lineH = 50;
  const startY = 25;

  const allGroups = groups + (remainder > 0 ? 1 : 0);
  const totalW = allGroups * groupGap + groups * 4 * tallyGap;
  const startX = Math.max((SVG_W - totalW) / 2, 20);

  let x = startX;
  const elements: React.ReactNode[] = [];

  for (let g = 0; g < groups; g++) {
    // 4 vertical lines
    for (let i = 0; i < 4; i++) {
      elements.push(
        <line key={`g${g}-v${i}`} x1={x} y1={startY} x2={x} y2={startY + lineH}
          stroke="#eab308" strokeWidth={3} strokeLinecap="round" />
      );
      x += tallyGap;
    }
    // Diagonal cross
    elements.push(
      <line key={`g${g}-d`} x1={x - 4 * tallyGap + 2} y1={startY + lineH - 5}
        x2={x - 2} y2={startY + 5}
        stroke="#eab308" strokeWidth={3} strokeLinecap="round" />
    );
    x += groupGap;
  }

  // Remainder
  for (let i = 0; i < remainder; i++) {
    elements.push(
      <line key={`rem-${i}`} x1={x} y1={startY} x2={x} y2={startY + lineH}
        stroke="#eab308" strokeWidth={3} strokeLinecap="round" />
    );
    x += tallyGap;
  }

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="max-w-full h-auto">
      {elements}
      <text x={SVG_W / 2} y={SVG_H - 10} textAnchor="middle" fontSize={12} fill="rgba(255,255,255,0.7)">
        {total} total
      </text>
    </svg>
  );
}

function DrawObjectsViz({ total }: { total: number }) {
  const cols = Math.min(total, 5);
  const rows = Math.ceil(total / 5);
  const r = 14;
  const gap = 36;
  const totalW = cols * gap;
  const startX = (SVG_W - totalW) / 2 + gap / 2;
  const startY = 25;

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="max-w-full h-auto">
      {Array.from({ length: total }, (_, i) => {
        const row = Math.floor(i / 5);
        const col = i % 5;
        return (
          <circle
            key={i}
            cx={startX + col * gap}
            cy={startY + row * gap}
            r={r}
            fill="rgba(251,146,60,0.3)"
            stroke="#fb923c"
            strokeWidth={2}
          />
        );
      })}
      <text x={SVG_W / 2} y={SVG_H - 10} textAnchor="middle" fontSize={12} fill="rgba(255,255,255,0.7)">
        {total} objects
      </text>
    </svg>
  );
}

function StrategyVisualization({ strategy, problem, hopsRevealed }: {
  strategy: StrategyId;
  problem: StrategyPickerChallenge['problem'];
  hopsRevealed: number;
}) {
  switch (strategy) {
    case 'counting-on':
    case 'counting-back':
      return <NumberLineViz operand1={problem.operand1} operand2={problem.operand2}
        operation={problem.operation} hopsRevealed={hopsRevealed} />;
    case 'make-ten':
      return <TenFrameViz operand1={problem.operand1} operand2={problem.operand2} />;
    case 'doubles':
      return <DoublesViz operand1={problem.operand1} operand2={problem.operand2} isNearDoubles={false} />;
    case 'near-doubles':
      return <DoublesViz operand1={problem.operand1} operand2={problem.operand2} isNearDoubles={true} />;
    case 'tally-marks':
      return <TallyViz total={problem.operand1 + problem.operand2} />;
    case 'draw-objects':
      return <DrawObjectsViz total={problem.operand1 + problem.operand2} />;
    default:
      return null;
  }
}

// ============================================================================
// Component
// ============================================================================

interface StrategyPickerProps {
  data: StrategyPickerData;
  className?: string;
}

const StrategyPicker: React.FC<StrategyPickerProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    gradeBand = 'K',
    strategiesIntroduced = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Shared Hooks
  // -------------------------------------------------------------------------
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [answerInput, setAnswerInput] = useState('');
  const [chosenStrategy, setChosenStrategy] = useState<StrategyId | null>(null);
  const [matchSelection, setMatchSelection] = useState<string | null>(null);
  const [compareAnswer, setCompareAnswer] = useState<string | null>(null);
  const [hopsRevealed, setHopsRevealed] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [strategiesUsed, setStrategiesUsed] = useState<Set<string>>(new Set());

  const stableInstanceIdRef = useRef(instanceId || `strategy-picker-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<StrategyPickerMetrics>({
    primitiveType: 'strategy-picker',
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
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    challengeType: currentChallenge?.type ?? 'guided-strategy',
    equation: currentChallenge?.problem?.equation ?? '',
    assignedStrategy: currentChallenge?.assignedStrategy ?? chosenStrategy ?? '',
    strategySteps: currentChallenge?.strategySteps ?? [],
    attemptNumber: currentAttempts + 1,
    chosenStrategy: chosenStrategy ?? '',
    strategiesCompleted: Array.from(strategiesUsed),
    studentAnswer: answerInput || matchSelection || compareAnswer || '',
  }), [
    gradeBand, challenges.length, currentChallengeIndex, currentChallenge,
    currentAttempts, chosenStrategy, strategiesUsed, answerInput, matchSelection, compareAnswer,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'strategy-picker',
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
      `[ACTIVITY_START] Strategy Picker for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges. Strategies: ${strategiesIntroduced.join(', ')}. `
      + `First challenge: "${currentChallenge?.instruction}". `
      + `Introduce warmly: "Today we'll solve problems in different ways! Let's see how many strategies you can use."`,
      { silent: true }
    );
  }, [isConnected, challenges.length, gradeBand, strategiesIntroduced, currentChallenge, sendText]);

  // Animate number line hops for counting strategies
  useEffect(() => {
    if (!currentChallenge) return;
    const strategy = currentChallenge.assignedStrategy ?? chosenStrategy;
    if (strategy !== 'counting-on' && strategy !== 'counting-back') {
      setHopsRevealed(999); // show all for non-hop strategies
      return;
    }
    setHopsRevealed(0);
    const hopCount = currentChallenge.problem.operand2;
    let hop = 0;
    const timer = setInterval(() => {
      hop++;
      setHopsRevealed(hop);
      if (hop >= hopCount) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [currentChallengeIndex, currentChallenge, chosenStrategy]);

  // -------------------------------------------------------------------------
  // Check Answer
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();
    const { type, problem } = currentChallenge;

    if (type === 'guided-strategy' || type === 'try-another' || type === 'choose-your-strategy') {
      const answer = parseInt(answerInput, 10);
      const correct = answer === problem.result;

      if (correct) {
        const strat = currentChallenge.assignedStrategy ?? chosenStrategy ?? 'unknown';
        setFeedback(`Correct! ${problem.equation.replace('?', String(problem.result))}`);
        setFeedbackType('success');
        setStrategiesUsed(prev => new Set(prev).add(strat));
        sendText(
          `[ANSWER_CORRECT] Student solved ${problem.equation} = ${problem.result} using ${strat}. `
          + `Attempt ${currentAttempts + 1}. Celebrate: "You got it using ${STRATEGY_INFO[strat as StrategyId]?.label ?? strat}!"`,
          { silent: true }
        );
        recordResult({
          challengeId: currentChallenge.id,
          correct: true,
          attempts: currentAttempts + 1,
          strategyUsed: strat,
        });
      } else {
        setFeedback(`Not quite. Try again!`);
        setFeedbackType('error');
        sendText(
          `[ANSWER_INCORRECT] Student answered ${answer} for ${problem.equation}, correct is ${problem.result}. `
          + `Strategy: ${currentChallenge.assignedStrategy ?? chosenStrategy}. Attempt ${currentAttempts + 1}. Give a hint.`,
          { silent: true }
        );
      }
    } else if (type === 'compare') {
      // Compare always counts as correct (metacognitive reflection)
      if (!compareAnswer) return;
      setFeedback('Great thinking! Both strategies give the same answer.');
      setFeedbackType('success');
      sendText(
        `[COMPARE_COMPLETE] Student chose "${compareAnswer}" for comparison question. `
        + `Ask "Which felt easier?" — there's no wrong answer.`,
        { silent: true }
      );
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        compareChoice: compareAnswer,
      });
    } else if (type === 'match-strategy') {
      const correct = matchSelection === currentChallenge.correctStrategy;
      if (correct) {
        setFeedback(`Yes! That's ${STRATEGY_INFO[matchSelection as StrategyId]?.label ?? matchSelection}!`);
        setFeedbackType('success');
        sendText(
          `[MATCH_CORRECT] Student correctly identified the strategy as "${matchSelection}". Celebrate briefly.`,
          { silent: true }
        );
        recordResult({
          challengeId: currentChallenge.id,
          correct: true,
          attempts: currentAttempts + 1,
        });
      } else {
        setFeedback(`Not quite — look at the steps again.`);
        setFeedbackType('error');
        sendText(
          `[MATCH_INCORRECT] Student picked "${matchSelection}" but correct is "${currentChallenge.correctStrategy}". `
          + `Give a hint about what makes ${currentChallenge.correctStrategy} different.`,
          { silent: true }
        );
      }
    }
  }, [currentChallenge, answerInput, compareAnswer, matchSelection, chosenStrategy,
      currentAttempts, incrementAttempts, recordResult, sendText]);

  // -------------------------------------------------------------------------
  // Advance
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All complete
      const phaseScoreStr = phaseResults
        .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter(r => r.correct).length / challenges.length) * 100
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Strategies used: ${Array.from(strategiesUsed).join(', ')}. `
        + `Celebrate flexibility: "You solved problems ${strategiesUsed.size} different ways!"`,
        { silent: true }
      );

      if (!hasSubmittedEvaluation) {
        const correct = challengeResults.filter(r => r.correct).length;
        const score = Math.round((correct / challenges.length) * 100);
        const metrics: StrategyPickerMetrics = {
          type: 'strategy-picker',
          accuracy: score,
          strategiesUsed: Array.from(strategiesUsed),
          strategyFlexibility: strategiesUsed.size >= 2,
          comparisonCompleted: challengeResults.some(r =>
            challenges.find(c => c.id === r.challengeId)?.type === 'compare' && r.correct
          ),
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
        };
        submitEvaluation(correct === challenges.length, score, metrics, { challengeResults });
      }
      return;
    }

    // Reset state
    setAnswerInput('');
    setChosenStrategy(null);
    setMatchSelection(null);
    setCompareAnswer(null);
    setFeedback('');
    setFeedbackType('');

    const next = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${next.instruction}" (${next.type}). Introduce it briefly.`,
      { silent: true }
    );
  }, [advanceProgress, phaseResults, challenges, challengeResults, sendText,
      hasSubmittedEvaluation, strategiesUsed, submitEvaluation, currentChallengeIndex]);

  // Auto-submit on completion
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
    r => r.challengeId === currentChallenge?.id && r.correct
  );

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  const activeStrategy = currentChallenge?.assignedStrategy ?? chosenStrategy;

  // -------------------------------------------------------------------------
  // Check button disabled logic
  // -------------------------------------------------------------------------
  const isCheckDisabled = useMemo(() => {
    if (!currentChallenge || hasSubmittedEvaluation) return true;
    const { type } = currentChallenge;
    if (type === 'guided-strategy' || type === 'try-another') return !answerInput;
    if (type === 'choose-your-strategy') return !chosenStrategy || !answerInput;
    if (type === 'compare') return !compareAnswer;
    if (type === 'match-strategy') return !matchSelection;
    return false;
  }, [currentChallenge, hasSubmittedEvaluation, answerInput, chosenStrategy, compareAnswer, matchSelection]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-purple-300 text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </Badge>
            {currentChallenge && (
              <Badge className="bg-slate-800/50 border-slate-700/50 text-cyan-300 text-xs">
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </Badge>
            )}
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress */}
        {challenges.length > 0 && !allChallengesComplete && (
          <div className="flex items-center gap-2 flex-wrap">
            {challenges.map((ch, i) => {
              const done = challengeResults.some(r => r.challengeId === ch.id && r.correct);
              const active = i === currentChallengeIndex;
              return (
                <div
                  key={ch.id}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border transition-all ${
                    done
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                      : active
                        ? 'bg-purple-500/20 border-purple-400/50 text-purple-300'
                        : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </div>
              );
            })}
            <span className="text-slate-500 text-xs ml-auto">
              Challenge {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
            </span>
          </div>
        )}

        {/* Problem Display */}
        {currentChallenge && !allChallengesComplete && (
          <>
            {/* Equation */}
            <div className="text-center">
              <span className="text-3xl font-bold text-white tracking-wider">
                {currentChallenge.problem.equation}
              </span>
            </div>

            {/* Instruction */}
            <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
              <p className="text-slate-200 text-sm font-medium text-center">
                {currentChallenge.instruction}
              </p>
            </div>

            {/* Strategy Steps (guided-strategy, try-another) */}
            {(currentChallenge.type === 'guided-strategy' || currentChallenge.type === 'try-another') &&
              currentChallenge.strategySteps && currentChallenge.strategySteps.length > 0 && (
              <div className="bg-slate-800/20 rounded-lg p-3 border border-white/5 space-y-1.5">
                {currentChallenge.strategySteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-purple-400 text-xs font-mono mt-0.5">{i + 1}.</span>
                    <span className="text-slate-300 text-sm">{step}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Strategy Visualization */}
            {activeStrategy && (currentChallenge.type === 'guided-strategy' ||
              currentChallenge.type === 'try-another' || currentChallenge.type === 'choose-your-strategy') && (
              <div className="flex justify-center bg-slate-800/10 rounded-lg p-2 border border-white/5">
                <StrategyVisualization
                  strategy={activeStrategy}
                  problem={currentChallenge.problem}
                  hopsRevealed={hopsRevealed}
                />
              </div>
            )}

            {/* Compare: two strategies side by side */}
            {currentChallenge.type === 'compare' && currentChallenge.strategies && (
              <div className="grid grid-cols-2 gap-3">
                {currentChallenge.strategies.map((strat) => (
                  <div key={strat} className="bg-slate-800/20 rounded-lg p-3 border border-white/5">
                    <p className="text-center text-xs text-slate-400 mb-2 font-medium">
                      {STRATEGY_INFO[strat as StrategyId]?.icon} {STRATEGY_INFO[strat as StrategyId]?.label}
                    </p>
                    <StrategyVisualization
                      strategy={strat as StrategyId}
                      problem={currentChallenge.problem}
                      hopsRevealed={999}
                    />
                  </div>
                ))}
                {/* Same answer badge */}
                <div className="col-span-2 text-center">
                  <Badge className="bg-emerald-500/20 border-emerald-400/50 text-emerald-300 text-xs">
                    Same answer: {currentChallenge.problem.result}
                  </Badge>
                </div>
              </div>
            )}

            {/* Choose-your-strategy: strategy menu */}
            {currentChallenge.type === 'choose-your-strategy' && !chosenStrategy && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(currentChallenge.availableStrategies ?? strategiesIntroduced).map((strat) => {
                  const info = STRATEGY_INFO[strat];
                  return (
                    <Button
                      key={strat}
                      variant="ghost"
                      className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 h-auto py-3 flex flex-col gap-1"
                      onClick={() => {
                        setChosenStrategy(strat);
                        sendText(
                          `[STRATEGY_CHOSEN] Student chose "${info.label}" for ${currentChallenge.problem.equation}. `
                          + `Encourage: "Great choice! Let's use ${info.label} to solve this."`,
                          { silent: true }
                        );
                      }}
                    >
                      <span className="text-xl">{info.icon}</span>
                      <span className="text-xs">{info.label}</span>
                    </Button>
                  );
                })}
              </div>
            )}

            {/* Match-strategy: worked solution + options */}
            {currentChallenge.type === 'match-strategy' && (
              <>
                {currentChallenge.workedSolution && (
                  <div className="bg-slate-800/20 rounded-lg p-4 border border-white/5">
                    <p className="text-slate-300 text-sm whitespace-pre-line">
                      {currentChallenge.workedSolution}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 justify-center">
                  {(currentChallenge.strategyOptions ?? []).map((opt) => (
                    <Button
                      key={opt}
                      variant="ghost"
                      className={`border text-sm ${
                        matchSelection === opt
                          ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                      }`}
                      onClick={() => setMatchSelection(opt)}
                    >
                      {STRATEGY_INFO[opt as StrategyId]?.icon ?? '?'}{' '}
                      {STRATEGY_INFO[opt as StrategyId]?.label ?? opt}
                    </Button>
                  ))}
                </div>
              </>
            )}

            {/* Compare question */}
            {currentChallenge.type === 'compare' && currentChallenge.comparisonQuestion && (
              <div className="space-y-2">
                <p className="text-slate-300 text-sm text-center font-medium">
                  {currentChallenge.comparisonQuestion}
                </p>
                <div className="flex gap-2 justify-center">
                  {(currentChallenge.strategies ?? []).map((strat) => (
                    <Button
                      key={strat}
                      variant="ghost"
                      className={`border text-sm ${
                        compareAnswer === strat
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                      }`}
                      onClick={() => setCompareAnswer(strat)}
                    >
                      {STRATEGY_INFO[strat as StrategyId]?.label ?? strat}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    className={`border text-sm ${
                      compareAnswer === 'both-same'
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                        : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                    }`}
                    onClick={() => setCompareAnswer('both-same')}
                  >
                    Both the same
                  </Button>
                </div>
              </div>
            )}

            {/* Answer Input (for strategy-solving types) */}
            {(currentChallenge.type === 'guided-strategy' ||
              currentChallenge.type === 'try-another' ||
              (currentChallenge.type === 'choose-your-strategy' && chosenStrategy)) &&
              !isCurrentChallengeComplete && (
              <div className="flex items-center justify-center gap-4">
                <span className="text-slate-400 text-sm">Answer:</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    className="w-11 h-11 rounded-full bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 text-xl font-medium p-0"
                    onClick={() => setAnswerInput(String(Math.max(0, (parseInt(answerInput, 10) || 0) - 1)))}
                    disabled={!answerInput || parseInt(answerInput, 10) <= 0}
                  >
                    −
                  </Button>
                  <div className="w-16 h-14 flex items-center justify-center rounded-xl bg-slate-800/60 border border-white/15 tabular-nums">
                    <span className="text-2xl font-bold text-white">
                      {answerInput || '?'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-11 h-11 rounded-full bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 text-xl font-medium p-0"
                    onClick={() => setAnswerInput(String(Math.min(20, (parseInt(answerInput, 10) || 0) + 1)))}
                  >
                    +
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' : 'text-slate-300'
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
                disabled={isCheckDisabled}
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
                <p className="text-emerald-400 text-sm font-medium mb-1">All challenges complete!</p>
                <p className="text-slate-400 text-xs">
                  {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
                  {strategiesUsed.size > 0 && ` · ${strategiesUsed.size} strategies used`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Hint */}
        {currentChallenge?.strategySteps && feedbackType === 'error' && currentAttempts >= 2 && (
          <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-400 text-xs italic">
              Follow the steps above carefully — each step brings you closer to the answer.
            </p>
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Strategy Practice Complete!"
            celebrationMessage={`You solved problems ${strategiesUsed.size} different way${strategiesUsed.size !== 1 ? 's' : ''}!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default StrategyPicker;
