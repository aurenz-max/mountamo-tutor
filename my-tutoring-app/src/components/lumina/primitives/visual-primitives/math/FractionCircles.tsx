'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { FractionCirclesMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface FractionCirclesChallenge {
  id: string;
  type: 'identify' | 'build' | 'compare' | 'equivalent';
  instruction: string;
  denominator: number;
  numerator: number;
  compareFraction?: { numerator: number; denominator: number };
  equivalentDenominator?: number;
  hint: string;
  narration: string;
}

export interface FractionCirclesData {
  title: string;
  description?: string;
  challenges: FractionCirclesChallenge[];
  gradeBand?: 'K-2' | '3-5';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FractionCirclesMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  identify:   { label: 'Identify',   icon: '\uD83D\uDD0D', accentColor: 'blue' },
  build:      { label: 'Build',      icon: '\uD83E\uDDF1', accentColor: 'purple' },
  compare:    { label: 'Compare',    icon: '\u2696\uFE0F', accentColor: 'amber' },
  equivalent: { label: 'Equivalent', icon: '\uD83D\uDD04', accentColor: 'emerald' },
};

const CIRCLE_SIZE = 140;
const CIRCLE_SIZE_SM = 100;

// ============================================================================
// SVG Circle Rendering
// ============================================================================

function renderFractionCircle(
  numerator: number,
  denominator: number,
  size: number,
  options?: {
    interactive?: boolean;
    shadedSet?: Set<number>;
    onSliceClick?: (index: number) => void;
    accentColor?: string;
  },
) {
  const { interactive, shadedSet, onSliceClick, accentColor = '#3b82f6' } = options || {};
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;

  const slices: React.ReactNode[] = [];
  for (let i = 0; i < denominator; i++) {
    const startAngle = (i * 360) / denominator - 90;
    const endAngle = ((i + 1) * 360) / denominator - 90;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = 360 / denominator > 180 ? 1 : 0;

    const isShaded = shadedSet ? shadedSet.has(i) : i < numerator;

    slices.push(
      <path
        key={i}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={isShaded ? accentColor : 'rgba(255,255,255,0.04)'}
        fillOpacity={isShaded ? 0.6 : 1}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1.5}
        className={interactive ? 'cursor-pointer hover:brightness-125 transition-all' : ''}
        onClick={interactive && onSliceClick ? () => onSliceClick(i) : undefined}
      />,
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-lg">
      {/* Background circle */}
      <circle cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      {slices}
      {/* Border ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={interactive ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.15)'} strokeWidth={interactive ? 2.5 : 1.5} />
    </svg>
  );
}

// ============================================================================
// Fraction Helpers
// ============================================================================

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function simplify(n: number, d: number) {
  const g = gcd(Math.abs(n), Math.abs(d));
  return { n: n / g, d: d / g };
}

function fractionsEquivalent(n1: number, d1: number, n2: number, d2: number): boolean {
  const s1 = simplify(n1, d1);
  const s2 = simplify(n2, d2);
  return s1.n === s2.n && s1.d === s2.d;
}

// ============================================================================
// Props
// ============================================================================

interface FractionCirclesProps {
  data: FractionCirclesData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const FractionCircles: React.FC<FractionCirclesProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    gradeBand = 'K-2',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Shared hooks
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
  // Domain state
  // -------------------------------------------------------------------------
  const currentChallenge = useMemo(
    () => challenges[currentChallengeIndex] || null,
    [challenges, currentChallengeIndex],
  );

  // Build / equivalent mode: which slices the student has toggled
  const [shadedSlices, setShadedSlices] = useState<Set<number>>(new Set());

  // Identify mode: student text input (e.g., "3/4")
  const [identifyInput, setIdentifyInput] = useState('');

  // Compare mode: student choice ('left' | 'right' | 'equal' | '')
  const [compareChoice, setCompareChoice] = useState<'left' | 'right' | 'equal' | ''>('');

  // Feedback
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // -------------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------------
  const stableInstanceIdRef = useRef(instanceId || `fraction-circles-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<FractionCirclesMetrics>({
    primitiveType: 'fraction-circles',
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
    challengeType: currentChallenge?.type ?? 'identify',
    instruction: currentChallenge?.instruction ?? '',
    denominator: currentChallenge?.denominator ?? 4,
    numerator: currentChallenge?.numerator ?? 0,
    shadedCount: shadedSlices.size,
    attemptNumber: currentAttempts + 1,
  }), [
    gradeBand, challenges.length, currentChallengeIndex, currentChallenge,
    shadedSlices.size, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'fraction-circles',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K-2' ? 'Grades K-2' : 'Grades 3-5',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;

    const types = Array.from(new Set(challenges.map(c => c.type))).join(', ');
    sendText(
      `[ACTIVITY_START] Fraction Circles activity for ${gradeBand}. `
      + `${challenges.length} challenges with types: ${types}. `
      + `First challenge: "${currentChallenge?.instruction}" (${currentChallenge?.type}). `
      + `Introduce warmly and read the first instruction.`,
      { silent: true },
    );
  }, [isConnected, challenges.length, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Slice click handler (build & equivalent modes)
  // -------------------------------------------------------------------------
  const handleSliceClick = useCallback((index: number) => {
    if (hasSubmittedEvaluation) return;
    setShadedSlices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation]);

  // -------------------------------------------------------------------------
  // Challenge checking
  // -------------------------------------------------------------------------
  const checkIdentify = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();

    const parts = identifyInput.trim().split('/');
    const userNum = parseInt(parts[0], 10);
    const userDen = parseInt(parts[1], 10);
    const correct = !isNaN(userNum) && !isNaN(userDen)
      && fractionsEquivalent(userNum, userDen, currentChallenge.numerator, currentChallenge.denominator);

    if (correct) {
      setFeedback(`Correct! ${currentChallenge.numerator}/${currentChallenge.denominator} is right!`);
      setFeedbackType('success');
      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
      sendText(
        `[IDENTIFY_CORRECT] Student correctly identified ${currentChallenge.numerator}/${currentChallenge.denominator}. `
        + `They answered "${identifyInput}". Celebrate briefly!`,
        { silent: true },
      );
    } else {
      setFeedback(`Not quite. Look at how many pieces are shaded out of the total.`);
      setFeedbackType('error');
      sendText(
        `[IDENTIFY_INCORRECT] Student answered "${identifyInput}" but correct is ${currentChallenge.numerator}/${currentChallenge.denominator}. `
        + `Attempt ${currentAttempts + 1}. The circle has ${currentChallenge.denominator} slices with ${currentChallenge.numerator} shaded. Give a hint.`,
        { silent: true },
      );
    }
  }, [currentChallenge, identifyInput, currentAttempts, incrementAttempts, recordResult, sendText]);

  const checkBuild = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();

    const correct = shadedSlices.size === currentChallenge.numerator;

    if (correct) {
      setFeedback(`Great job! You built ${currentChallenge.numerator}/${currentChallenge.denominator}!`);
      setFeedbackType('success');
      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
      sendText(
        `[BUILD_CORRECT] Student built ${currentChallenge.numerator}/${currentChallenge.denominator} by shading ${shadedSlices.size} of ${currentChallenge.denominator} slices. Celebrate!`,
        { silent: true },
      );
    } else {
      setFeedback(`You shaded ${shadedSlices.size}/${currentChallenge.denominator}. The target is ${currentChallenge.numerator}/${currentChallenge.denominator}.`);
      setFeedbackType('error');
      sendText(
        `[BUILD_INCORRECT] Student shaded ${shadedSlices.size} slices but target is ${currentChallenge.numerator}/${currentChallenge.denominator}. `
        + `Attempt ${currentAttempts + 1}. Hint: "Count the shaded pieces. You need exactly ${currentChallenge.numerator}."`,
        { silent: true },
      );
    }
  }, [currentChallenge, shadedSlices.size, currentAttempts, incrementAttempts, recordResult, sendText]);

  const checkCompare = useCallback(() => {
    if (!currentChallenge || !currentChallenge.compareFraction || !compareChoice) return;
    incrementAttempts();

    const leftVal = currentChallenge.numerator / currentChallenge.denominator;
    const rightVal = currentChallenge.compareFraction.numerator / currentChallenge.compareFraction.denominator;
    const areEqual = Math.abs(leftVal - rightVal) < 0.001;
    const correctChoice: 'left' | 'right' | 'equal' = areEqual ? 'equal' : leftVal > rightVal ? 'left' : 'right';
    const correct = compareChoice === correctChoice;

    const leftStr = `${currentChallenge.numerator}/${currentChallenge.denominator}`;
    const rightStr = `${currentChallenge.compareFraction.numerator}/${currentChallenge.compareFraction.denominator}`;

    if (correct) {
      const msg = areEqual
        ? `Yes! ${leftStr} and ${rightStr} are equal — they represent the same amount!`
        : `Yes! ${correctChoice === 'left' ? leftStr : rightStr} is larger!`;
      setFeedback(msg);
      setFeedbackType('success');
      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
      sendText(
        `[COMPARE_CORRECT] Student correctly compared ${leftStr} vs ${rightStr}. `
        + `They chose "${compareChoice}". ${areEqual ? 'These are equivalent fractions!' : `Explain why ${correctChoice === 'left' ? leftStr : rightStr} is larger.`}`,
        { silent: true },
      );
    } else {
      setFeedback(areEqual
        ? `These fractions are actually equal! Look at how much of each circle is shaded.`
        : `Look again at how much of each circle is shaded.`);
      setFeedbackType('error');
      sendText(
        `[COMPARE_INCORRECT] Student chose "${compareChoice}" comparing ${leftStr} vs ${rightStr} (correct: ${correctChoice}). `
        + `Attempt ${currentAttempts + 1}. Hint: "Look at how much of each circle is filled. Which has more color?"`,
        { silent: true },
      );
    }
  }, [currentChallenge, compareChoice, currentAttempts, incrementAttempts, recordResult, sendText]);

  const checkEquivalent = useCallback(() => {
    if (!currentChallenge || !currentChallenge.equivalentDenominator) return;
    incrementAttempts();

    const targetNum = currentChallenge.numerator;
    const targetDen = currentChallenge.denominator;
    const equivDen = currentChallenge.equivalentDenominator;
    const builtNum = shadedSlices.size;
    const correct = fractionsEquivalent(builtNum, equivDen, targetNum, targetDen);

    if (correct) {
      setFeedback(`Excellent! ${builtNum}/${equivDen} is equivalent to ${targetNum}/${targetDen}!`);
      setFeedbackType('success');
      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
      sendText(
        `[EQUIVALENT_CORRECT] Student found that ${builtNum}/${equivDen} = ${targetNum}/${targetDen}. `
        + `Celebrate and explain why these fractions are the same amount!`,
        { silent: true },
      );
    } else {
      setFeedback(`${builtNum}/${equivDen} is not equivalent to ${targetNum}/${targetDen}. Try adjusting the shaded slices.`);
      setFeedbackType('error');
      sendText(
        `[EQUIVALENT_INCORRECT] Student built ${builtNum}/${equivDen} trying to match ${targetNum}/${targetDen}. `
        + `Attempt ${currentAttempts + 1}. The equivalent denominator is ${equivDen}. Give a hint without revealing the answer.`,
        { silent: true },
      );
    }
  }, [currentChallenge, shadedSlices.size, currentAttempts, incrementAttempts, recordResult, sendText]);

  // -------------------------------------------------------------------------
  // Unified check answer
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;
    switch (currentChallenge.type) {
      case 'identify': checkIdentify(); break;
      case 'build': checkBuild(); break;
      case 'compare': checkCompare(); break;
      case 'equivalent': checkEquivalent(); break;
    }
  }, [currentChallenge, checkIdentify, checkBuild, checkCompare, checkEquivalent]);

  // -------------------------------------------------------------------------
  // Advance to next challenge
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges complete
      const phaseScoreStr = phaseResults
        .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const correctCount = challengeResults.filter(r => r.correct).length;
      const overallPct = Math.round((correctCount / challenges.length) * 100);

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their fraction understanding!`,
        { silent: true },
      );

      // Submit evaluation
      if (!hasSubmittedEvaluation) {
        const byType = (type: string) => {
          const matching = challenges.filter(c => c.type === type);
          if (matching.length === 0) return 0;
          const correct = matching.filter(c =>
            challengeResults.find(r => r.challengeId === c.id && r.correct),
          ).length;
          return Math.round((correct / matching.length) * 100);
        };

        const metrics: FractionCirclesMetrics = {
          type: 'fraction-circles',
          totalChallenges: challenges.length,
          correctCount,
          accuracy: overallPct,
          identifyAccuracy: byType('identify'),
          buildAccuracy: byType('build'),
          compareAccuracy: byType('compare'),
          equivalentAccuracy: byType('equivalent'),
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
        };

        submitEvaluation(
          correctCount === challenges.length,
          overallPct,
          metrics,
          { challengeResults },
        );
      }
      return;
    }

    // Reset domain-specific state for next challenge
    setShadedSlices(new Set());
    setIdentifyInput('');
    setCompareChoice('');
    setFeedback('');
    setFeedbackType('');

    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[PHASE_TRANSITION] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}, ${nextChallenge.numerator}/${nextChallenge.denominator}). `
      + `Read the instruction to the student and encourage them.`,
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, submitEvaluation, currentChallengeIndex,
  ]);

  // -------------------------------------------------------------------------
  // Auto-submit when all challenges complete
  // -------------------------------------------------------------------------
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
  const isCurrentChallengeCorrect = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct,
  );

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  const canCheck = useMemo(() => {
    if (!currentChallenge || hasSubmittedEvaluation) return false;
    switch (currentChallenge.type) {
      case 'identify': return identifyInput.trim().includes('/');
      case 'build': return shadedSlices.size > 0;
      case 'compare': return compareChoice !== '';
      case 'equivalent': return shadedSlices.size > 0;
      default: return false;
    }
  }, [currentChallenge, hasSubmittedEvaluation, identifyInput, shadedSlices.size, compareChoice]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const renderChallengeContent = () => {
    if (!currentChallenge || allChallengesComplete) return null;

    switch (currentChallenge.type) {
      case 'identify':
        return (
          <div className="flex flex-col items-center gap-4">
            {/* Show pre-shaded circle */}
            <div className="flex justify-center">
              {renderFractionCircle(currentChallenge.numerator, currentChallenge.denominator, CIRCLE_SIZE)}
            </div>
            <p className="text-slate-300 text-sm">
              {currentChallenge.denominator} equal pieces, {currentChallenge.numerator} shaded
            </p>
            {/* Input */}
            <div className="flex items-center gap-3">
              <span className="text-slate-300 text-sm">What fraction is shaded?</span>
              <input
                type="text"
                placeholder="e.g. 3/4"
                value={identifyInput}
                onChange={e => setIdentifyInput(e.target.value)}
                className="w-24 px-3 py-1.5 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-center text-lg focus:outline-none focus:border-blue-400/50"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && canCheck && handleCheckAnswer()}
              />
            </div>
          </div>
        );

      case 'build':
        return (
          <div className="flex flex-col items-center gap-4">
            <Badge className="bg-purple-500/20 border-purple-400/50 text-purple-300 text-sm">
              Target: {currentChallenge.numerator}/{currentChallenge.denominator}
            </Badge>
            {/* Interactive circle */}
            <div className="flex justify-center">
              {renderFractionCircle(0, currentChallenge.denominator, CIRCLE_SIZE, {
                interactive: true,
                shadedSet: shadedSlices,
                onSliceClick: handleSliceClick,
                accentColor: '#a855f7',
              })}
            </div>
            <p className="text-slate-400 text-xs">
              Click slices to shade them ({shadedSlices.size}/{currentChallenge.denominator} shaded)
            </p>
          </div>
        );

      case 'compare': {
        const cmp = currentChallenge.compareFraction!;
        return (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-8">
              {/* Left circle */}
              <div className="flex flex-col items-center gap-2">
                {renderFractionCircle(currentChallenge.numerator, currentChallenge.denominator, CIRCLE_SIZE_SM)}
                <span className="text-slate-200 font-mono text-lg">
                  {currentChallenge.numerator}/{currentChallenge.denominator}
                </span>
              </div>

              <span className="text-slate-500 text-2xl font-bold">vs</span>

              {/* Right circle */}
              <div className="flex flex-col items-center gap-2">
                {renderFractionCircle(cmp.numerator, cmp.denominator, CIRCLE_SIZE_SM, {
                  accentColor: '#f59e0b',
                })}
                <span className="text-slate-200 font-mono text-lg">
                  {cmp.numerator}/{cmp.denominator}
                </span>
              </div>
            </div>

            {/* Choice buttons */}
            <div className="flex gap-3 flex-wrap justify-center">
              <Button
                variant="ghost"
                className={`border ${
                  compareChoice === 'left'
                    ? 'bg-blue-500/20 border-blue-400/50 text-blue-300'
                    : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                }`}
                onClick={() => { setCompareChoice('left'); setFeedback(''); setFeedbackType(''); }}
              >
                Left ({currentChallenge.numerator}/{currentChallenge.denominator}) is larger
              </Button>
              <Button
                variant="ghost"
                className={`border ${
                  compareChoice === 'equal'
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                    : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                }`}
                onClick={() => { setCompareChoice('equal'); setFeedback(''); setFeedbackType(''); }}
              >
                They are equal
              </Button>
              <Button
                variant="ghost"
                className={`border ${
                  compareChoice === 'right'
                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                    : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                }`}
                onClick={() => { setCompareChoice('right'); setFeedback(''); setFeedbackType(''); }}
              >
                Right ({cmp.numerator}/{cmp.denominator}) is larger
              </Button>
            </div>
          </div>
        );
      }

      case 'equivalent': {
        const equivDen = currentChallenge.equivalentDenominator!;
        return (
          <div className="flex flex-col items-center gap-4">
            {/* Reference fraction */}
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center gap-2">
                {renderFractionCircle(currentChallenge.numerator, currentChallenge.denominator, CIRCLE_SIZE_SM)}
                <span className="text-slate-200 font-mono text-lg">
                  {currentChallenge.numerator}/{currentChallenge.denominator}
                </span>
                <span className="text-slate-500 text-xs">Reference</span>
              </div>

              <span className="text-emerald-400 text-xl">=</span>

              {/* Student builds equivalent */}
              <div className="flex flex-col items-center gap-2">
                {renderFractionCircle(0, equivDen, CIRCLE_SIZE_SM, {
                  interactive: true,
                  shadedSet: shadedSlices,
                  onSliceClick: handleSliceClick,
                  accentColor: '#10b981',
                })}
                <span className="text-slate-200 font-mono text-lg">
                  {shadedSlices.size}/{equivDen}
                </span>
                <span className="text-slate-500 text-xs">Build equivalent</span>
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-blue-300 text-xs">
              {gradeBand}
            </Badge>
            {currentChallenge && !allChallengesComplete && (
              <Badge className="bg-slate-800/50 border-slate-700/50 text-purple-300 text-xs">
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon} {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </Badge>
            )}
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Challenge Progress Badges */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(CHALLENGE_TYPE_CONFIG).map(([type, config]) => {
              const hasType = challenges.some(c => c.type === type);
              if (!hasType) return null;
              const isActive = currentChallenge?.type === type && !allChallengesComplete;
              return (
                <Badge
                  key={type}
                  className={`text-xs ${
                    isActive
                      ? 'bg-blue-500/20 border-blue-400/50 text-blue-300'
                      : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                  }`}
                >
                  {config.icon} {config.label}
                </Badge>
              );
            })}
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

        {/* Challenge Content */}
        {renderChallengeContent()}

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
        {challenges.length > 0 && !allChallengesComplete && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeCorrect && (
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                onClick={handleCheckAnswer}
                disabled={!canCheck}
              >
                Check Answer
              </Button>
            )}
            {isCurrentChallengeCorrect && (
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={advanceToNextChallenge}
              >
                Next Challenge
              </Button>
            )}
          </div>
        )}

        {/* Hint (shows after 2 failed attempts) */}
        {currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </div>
        )}

        {/* Completion message */}
        {allChallengesComplete && !phaseResults.length && (
          <div className="text-center">
            <p className="text-emerald-400 text-sm font-medium mb-2">
              All challenges complete!
            </p>
            <p className="text-slate-400 text-xs">
              {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
            </p>
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Fractions Complete!"
            celebrationMessage={`You completed all ${challenges.length} fraction challenges!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default FractionCircles;
