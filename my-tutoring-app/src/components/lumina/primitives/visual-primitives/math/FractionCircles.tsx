'use client';

import FractionTouch from './FractionTouch';
import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaActionButton,
  LuminaPanel,
  LuminaInput,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { FractionCirclesMetrics } from '../../../evaluation/types';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { useLiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { describeWork, workspaceAssignment, workspaceScene } from './fractionCirclesWorkspace';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { buildFractionCompareEvidence, type FractionCompareResponse } from './fractionCompareEvidence';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface FractionCirclesChallenge {
  id: string;
  type: 'identify' | 'build' | 'compare' | 'equivalent' | 'touch_fraction';
  instruction: string;
  denominator: number;
  numerator: number;
  compareFraction?: { numerator: number; denominator: number };
  equivalentDenominator?: number;
  hint: string;
  narration: string;

  // ── Support-tier scaffolds (set by the generator from config.difficulty).
  //    All DISPLAY-ONLY — the checkers read numerator/denominator, never these. ──
  /** identify: show the "N equal pieces" caption; build: show the denominator slice label */
  showTotalPieces?: boolean;
  /** running shaded/built tally (identify "M shaded", build & equivalent live count) */
  showWorkingCount?: boolean;
  /** compare ONLY: numeric fraction labels under each circle + inside the buttons */
  showFractionLabels?: boolean;
  /** within-mode support tier the generator resolved the scaffolds above from */
  supportTier?: 'easy' | 'medium' | 'hard';
}

import type { LearningAdaptation } from '../../../service/generation/learningAdaptation';
export interface FractionCirclesData {
  title: string;
  description?: string;
  challenges: FractionCirclesChallenge[];
  gradeBand?: 'K-2' | '3-5';
  /** Safe generation metadata only; never rendered, never observation text. */
  learningAdaptation?: LearningAdaptation<'contrast_same_numerator_denominators'>;

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
  identify:   { label: 'Identify',   icon: '🔍', accentColor: 'blue' },
  build:      { label: 'Build',      icon: '🧱', accentColor: 'purple' },
  compare:    { label: 'Compare',    icon: '⚖️', accentColor: 'amber' },
  equivalent: { label: 'Equivalent', icon: '🔄', accentColor: 'emerald' },
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
        data-pip-object={interactive ? `slice-${i}` : undefined}
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
  localOnly?: boolean;
  runtimePlanItemId?: string;
  /** The RESOLVED pin from the mount; a pin the family binds mounts the teaching workspace. */
  runtimeEvalMode?: string;
  /** This surface's teaching session settled (the mixed chain's cue to move on). */
  onWorkspaceFinished?: () => void;
}

// ============================================================================
// Component
// ============================================================================

/** The teaching workspace is fraction-circles' only controller: the runtime owns progression. */
const useFractionCirclesProgress = useWorkspaceProgressFor('fraction-circles');

const FractionCirclesSurface = ({ data, className, localOnly = false, runtimePlanItemId, runtimeEvalMode, onWorkspaceFinished }:
  FractionCirclesProps) => {
  const liveRuntime = useLiveRuntime();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const componentMounted = useRef(true);
  useLayoutEffect(() => { componentMounted.current = true; return () => { componentMounted.current = false; }; }, []);
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  const learnerBlocked = () => !componentMounted.current || workspaceClosed.current
    || !!liveRuntime && !['empty', 'active'].includes(liveRuntime.getSnapshot().status);
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
  // Shared hooks. The runtime moves the index.
  // -------------------------------------------------------------------------
  const stableInstanceIdRef = useRef(instanceId || `fraction-circles-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const progress = useFractionCirclesProgress<FractionCirclesChallenge>({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    evalMode: runtimeEvalMode || (new Set(challenges.map(c => c.type)).size === 1 ? challenges[0].type : 'mixed'),
    workspace, assignment: workspaceAssignment,
    // A fresh challenge and Try again both start from a blank circle. The setters are declared
    // below; this runs only after render.
    onItemOpened: () => {
      setShadedSlices(new Set()); setIdentifyInput(''); setCompareChoice('');
      setFeedback(''); setFeedbackType('');
    },
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
  } = progress;
  workspaceClosed.current = progress.canAttempt === false;

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
  // Every compare response in order; compare advances only after a correct one,
  // so first responses are the only evidence of an unassisted comparison.
  const compareResponsesRef = useRef<FractionCompareResponse[]>([]);

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
    localOnly,
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // The tutor teaches from the workspace packet; Pip only reads whether it is speaking.
  const { isAudioPlaying, activePrimitiveId } = useLuminaAIContext();

  // -------------------------------------------------------------------------
  // Slice click handler (build & equivalent modes)
  // -------------------------------------------------------------------------
  const handleSliceClick = useCallback((index: number) => {
    if (hasSubmittedEvaluation || learnerBlocked()) return;
    const willShade = !shadedSlices.has(index);
    SoundManager.toggle(willShade);   // ← rising blip when shading, falling when clearing
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
  }, [hasSubmittedEvaluation, shadedSlices]);

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
    progress.commitCheck?.(describeWork(currentChallenge, { typed: identifyInput, shaded: 0, choice: '' }), correct);

    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Correct! ${currentChallenge.numerator}/${currentChallenge.denominator} is right!`);
      setFeedbackType('success');
      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
    } else {
      SoundManager.playIncorrect();
      setFeedback(`Not quite. Look at how many pieces are shaded out of the total.`);
      setFeedbackType('error');
    }
  }, [currentChallenge, identifyInput, currentAttempts, incrementAttempts, recordResult, progress]);

  const checkBuild = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();

    const correct = shadedSlices.size === currentChallenge.numerator;
    progress.commitCheck?.(describeWork(currentChallenge, { typed: '', shaded: shadedSlices.size, choice: '' }), correct);

    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Great job! You built ${currentChallenge.numerator}/${currentChallenge.denominator}!`);
      setFeedbackType('success');
      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
    } else {
      SoundManager.playIncorrect();
      setFeedback(`You shaded ${shadedSlices.size}/${currentChallenge.denominator}. The target is ${currentChallenge.numerator}/${currentChallenge.denominator}.`);
      setFeedbackType('error');
    }
  }, [currentChallenge, shadedSlices.size, currentAttempts, incrementAttempts, recordResult, progress]);

  const checkCompare = useCallback(() => {
    if (!currentChallenge || !currentChallenge.compareFraction || !compareChoice) return;
    incrementAttempts();

    const leftVal = currentChallenge.numerator / currentChallenge.denominator;
    const rightVal = currentChallenge.compareFraction.numerator / currentChallenge.compareFraction.denominator;
    const areEqual = Math.abs(leftVal - rightVal) < 0.001;
    const correctChoice: 'left' | 'right' | 'equal' = areEqual ? 'equal' : leftVal > rightVal ? 'left' : 'right';
    const correct = compareChoice === correctChoice;
    progress.commitCheck?.(describeWork(currentChallenge, { typed: '', shaded: 0, choice: compareChoice }), correct);
    compareResponsesRef.current.push({
      itemId: currentChallenge.id,
      left: { numerator: currentChallenge.numerator, denominator: currentChallenge.denominator },
      right: { ...currentChallenge.compareFraction },
      chosen: compareChoice, correct: correctChoice, attempt: currentAttempts + 1,
      labelsShown: currentChallenge.showFractionLabels !== false, hintShown: currentAttempts >= 2,
    });

    const leftStr = `${currentChallenge.numerator}/${currentChallenge.denominator}`;
    const rightStr = `${currentChallenge.compareFraction.numerator}/${currentChallenge.compareFraction.denominator}`;

    if (correct) {
      const msg = areEqual
        ? `Yes! ${leftStr} and ${rightStr} are equal — they represent the same amount!`
        : `Yes! ${correctChoice === 'left' ? leftStr : rightStr} is larger!`;
      SoundManager.playCorrect();
      setFeedback(msg);
      setFeedbackType('success');
      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
    } else {
      SoundManager.playIncorrect();
      setFeedback(areEqual
        ? `These fractions are actually equal! Look at how much of each circle is shaded.`
        : `Look again at how much of each circle is shaded.`);
      setFeedbackType('error');
    }
  }, [currentChallenge, compareChoice, currentAttempts, incrementAttempts, recordResult, progress]);

  const checkEquivalent = useCallback(() => {
    if (!currentChallenge || !currentChallenge.equivalentDenominator) return;
    incrementAttempts();

    const targetNum = currentChallenge.numerator;
    const targetDen = currentChallenge.denominator;
    const equivDen = currentChallenge.equivalentDenominator;
    const builtNum = shadedSlices.size;
    const correct = fractionsEquivalent(builtNum, equivDen, targetNum, targetDen);
    progress.commitCheck?.(describeWork(currentChallenge, { typed: '', shaded: builtNum, choice: '' }), correct);

    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Excellent! ${builtNum}/${equivDen} is equivalent to ${targetNum}/${targetDen}!`);
      setFeedbackType('success');
      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
    } else {
      SoundManager.playIncorrect();
      setFeedback(`${builtNum}/${equivDen} is not equivalent to ${targetNum}/${targetDen}. Try adjusting the shaded slices.`);
      setFeedbackType('error');
    }
  }, [currentChallenge, shadedSlices.size, currentAttempts, incrementAttempts, recordResult, progress]);

  // -------------------------------------------------------------------------
  // Unified check answer
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge || learnerBlocked()) return;
    switch (currentChallenge.type) {
      case 'identify': checkIdentify(); break;
      case 'build': checkBuild(); break;
      case 'compare': checkCompare(); break;
      case 'equivalent': checkEquivalent(); break;
    }
  }, [currentChallenge, checkIdentify, checkBuild, checkCompare, checkEquivalent]);

  // -------------------------------------------------------------------------
  // Session complete: submit once, and only under a lesson's evaluation provider
  // (the live host has none). The runtime moves between challenges.
  // -------------------------------------------------------------------------
  const submitSession = useCallback(() => {
    if (hasSubmittedEvaluation || !progress.recordsEvaluation) return;
    const correctCount = challengeResults.filter(r => r.correct).length;
    const overallPct = Math.round((correctCount / challenges.length) * 100);
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
      evalMode: new Set(challenges.map(c => c.type)).size === 1 ? challenges[0].type : 'mixed',
      totalChallenges: challenges.length,
      correctCount,
      accuracy: overallPct,
      identifyAccuracy: byType('identify'),
      buildAccuracy: byType('build'),
      compareAccuracy: byType('compare'),
      equivalentAccuracy: byType('equivalent'),
      attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
    };

    const compareResponses = compareResponsesRef.current;
    submitEvaluation(
      correctCount === challenges.length,
      overallPct,
      metrics,
      { challengeResults, ...(compareResponses.length ? { compareResponses } : {}) },
      undefined,
      buildFractionCompareEvidence(compareResponses),
    );
  }, [challenges, challengeResults, hasSubmittedEvaluation, submitEvaluation, progress.recordsEvaluation]);

  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      submitSession();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, submitSession]);

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------
  const isCurrentChallengeCorrect = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct,
  );

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this challenge's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete || hasSubmittedEvaluation ? null : currentChallenge?.id ?? null,
    label: 'The fraction circles',
    solved: isCurrentChallengeCorrect,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!currentChallenge) return;
    workspace.current = { ...workspaceScene(currentChallenge, { typed: identifyInput, shaded: shadedSlices.size, choice: compareChoice }),
      demonstration: [], canDemonstrate: false, canPresent: false, readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    progress.publishWorkspace?.();
  });
  const finishedRef = useRef(onWorkspaceFinished); finishedRef.current = onWorkspaceFinished;
  const reportedFinish = useRef(false);
  useEffect(() => {
    if (!progress.practiceSummary || reportedFinish.current) return;
    reportedFinish.current = true;
    finishedRef.current?.();
  }, [progress.practiceSummary]);

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
            {/* Count caption — withdrawn by support tier (undefined = legacy = show both) */}
            {(currentChallenge.showTotalPieces !== false || currentChallenge.showWorkingCount !== false) && (
              <p className="text-slate-300 text-sm">
                {currentChallenge.showTotalPieces !== false && `${currentChallenge.denominator} equal pieces`}
                {currentChallenge.showTotalPieces !== false && currentChallenge.showWorkingCount !== false && ', '}
                {currentChallenge.showWorkingCount !== false && `${currentChallenge.numerator} shaded`}
              </p>
            )}
            {/* Input */}
            <div className="flex items-center gap-3">
              <span className="text-slate-300 text-sm">What fraction is shaded?</span>
              <LuminaInput
                type="text"
                placeholder="e.g. 3/4"
                value={identifyInput}
                onChange={e => { if (!learnerBlocked()) setIdentifyInput(e.target.value); }}
                aria-label="Fraction answer"
                className="w-24 text-center text-lg"
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
            {/* Count readout — withdrawn by support tier (running tally → total-only → none) */}
            <p className="text-slate-400 text-xs">
              Click slices to shade them
              {currentChallenge.showWorkingCount !== false
                ? ` (${shadedSlices.size}/${currentChallenge.denominator} shaded)`
                : currentChallenge.showTotalPieces !== false
                  ? ` (${currentChallenge.denominator} slices)`
                  : ''}
            </p>
          </div>
        );

      case 'compare': {
        const cmp = currentChallenge.compareFraction!;
        // Numeric fraction labels are withdrawn at harder tiers → pure visual
        // area comparison (undefined = legacy = show labels).
        const showLabels = currentChallenge.showFractionLabels !== false;
        return (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-8">
              {/* Left circle */}
              <div className="flex flex-col items-center gap-2">
                {renderFractionCircle(currentChallenge.numerator, currentChallenge.denominator, CIRCLE_SIZE_SM)}
                {showLabels && (
                  <span className="text-slate-200 font-mono text-lg">
                    {currentChallenge.numerator}/{currentChallenge.denominator}
                  </span>
                )}
              </div>

              <span className="text-slate-500 text-2xl font-bold">vs</span>

              {/* Right circle */}
              <div className="flex flex-col items-center gap-2">
                {renderFractionCircle(cmp.numerator, cmp.denominator, CIRCLE_SIZE_SM, {
                  accentColor: '#f59e0b',
                })}
                {showLabels && (
                  <span className="text-slate-200 font-mono text-lg">
                    {cmp.numerator}/{cmp.denominator}
                  </span>
                )}
              </div>
            </div>

            {/* Choice buttons — interaction surface (answer selection), left as-is */}
            <div className="flex gap-3 flex-wrap justify-center">
              <Button
                variant="ghost"
                className={`border ${
                  compareChoice === 'left'
                    ? 'bg-blue-500/20 border-blue-400/50 text-blue-300'
                    : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                }`}
                onClick={() => { if (learnerBlocked()) return; SoundManager.select(); setCompareChoice('left'); setFeedback(''); setFeedbackType(''); }}
              >
                {showLabels ? `Left (${currentChallenge.numerator}/${currentChallenge.denominator}) is larger` : 'Left is larger'}
              </Button>
              <Button
                variant="ghost"
                className={`border ${
                  compareChoice === 'equal'
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                    : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                }`}
                onClick={() => { if (learnerBlocked()) return; SoundManager.select(); setCompareChoice('equal'); setFeedback(''); setFeedbackType(''); }}
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
                onClick={() => { if (learnerBlocked()) return; SoundManager.select(); setCompareChoice('right'); setFeedback(''); setFeedbackType(''); }}
              >
                {showLabels ? `Right (${cmp.numerator}/${cmp.denominator}) is larger` : 'Right is larger'}
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
                {/* Live built tally — withdrawn at hard so the student self-tracks */}
                <span className="text-slate-200 font-mono text-lg">
                  {currentChallenge.showWorkingCount !== false ? `${shadedSlices.size}/${equivDen}` : `?/${equivDen}`}
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
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="blue" className="text-xs">
              {gradeBand}
            </LuminaBadge>
            {currentChallenge && !allChallengesComplete && (
              <LuminaBadge accent="purple" className="text-xs">
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon} {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </LuminaBadge>
            )}
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
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
          <LuminaPanel className="p-3">
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.instruction}
            </p>
          </LuminaPanel>
        )}

        {/* Pip's dock sits above the circle and its controls, which it outlines
            as the workspace — never one slice. */}
        {pip.store && currentChallenge && !allChallengesComplete && <div {...pip.dock} />}

        {/* Challenge Content */}
        <div {...pip.workspace}>{renderChallengeContent()}</div>

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
              <LuminaActionButton
                action="check"
                onClick={handleCheckAnswer}
                disabled={!canCheck || progress.canAttempt === false}
              />
            )}
          </div>
        )}

        {/* Hint (shows after 2 failed attempts) */}
        {currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <LuminaPanel className="p-2 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </LuminaPanel>
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
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const PlainFractionCircles = withWorkspaceOnly<FractionCirclesProps>('fraction-circles', FractionCirclesSurface, props => props.data.title);

// Route to the surface the challenges need; a touch-and-circle session runs as a chain of blocks.
const FractionCircles: React.FC<FractionCirclesProps> = (props) => {
  const hasTouch = props.data.challenges.some(c => c.type === 'touch_fraction');
  if (!hasTouch) return <PlainFractionCircles {...props} />;
  if (props.data.challenges.every(c => c.type === 'touch_fraction')) return <FractionTouch key={`${props.data.instanceId ?? ''}:${props.data.challenges.map(c => `${c.id}-${c.numerator}-${c.denominator}`).join('|')}`} {...props} />;
  return <MixedFractionCircles key={props.data.instanceId ?? props.data.challenges.map(c => c.id).join('|')} {...props} />;
};
/**
 * Touch and non-touch challenges in one session run as a chain of blocks, one surface each.
 *
 * Each block is its own workspace session (one per mounted surface): its evaluation only records (it
 * exists only under a lesson's evaluation provider), and the block's settled teaching session moves
 * the chain on. The first block keeps the section's instance id so the lesson host introduces it;
 * later blocks need their own, since a new session reading the previous block's completed runtime
 * under the same id would settle at once. The family submits one aggregate evaluation.
 */
const MixedFractionChain: React.FC<FractionCirclesProps> = ({ data, className, runtimePlanItemId, runtimeEvalMode }) => {
  const groups = useMemo(() => {
    const blocks: FractionCirclesChallenge[][] = [];
    for (const c of data.challenges) {
      const last = blocks[blocks.length - 1];
      if (last && (last[0].type === 'touch_fraction') === (c.type === 'touch_fraction')) last.push(c);
      else blocks.push([c]);
    }
    return blocks;
  }, [data.challenges]);
  const [index, setIndex] = useState(0);
  const results = useRef<PrimitiveEvaluationResult<FractionCirclesMetrics>[]>([]);
  const finishedBlocks = useRef(0);
  const instance = useRef(data.instanceId ?? `fraction-mixed-${Date.now()}`);
  const evaluation = usePrimitiveEvaluation<FractionCirclesMetrics>({
    primitiveType: 'fraction-circles', instanceId: instance.current, skillId: data.skillId,
    subskillId: data.subskillId, objectiveId: data.objectiveId, exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit,
  });
  const submitAggregate = () => {
    const blocks = results.current;
    const total = data.challenges.length;
    const accuracy = blocks.reduce((sum, r) => sum + r.score * r.metrics.totalChallenges, 0) / total;
    const modeAccuracy = (mode: FractionCirclesChallenge['type'], field: keyof FractionCirclesMetrics) => {
      const count = data.challenges.filter(c => c.type === mode).length;
      return count ? blocks.reduce((sum, r, i) => sum + Number(r.metrics[field] ?? 0) * groups[i].filter(c => c.type === mode).length, 0) / count : 0;
    };
    evaluation.submitResult(blocks.every(r => r.success), accuracy, {
      type: 'fraction-circles', evalMode: 'mixed', totalChallenges: total, accuracy,
      correctCount: blocks.reduce((n, r) => n + r.metrics.correctCount, 0),
      attemptsCount: blocks.reduce((n, r) => n + r.metrics.attemptsCount, 0),
      identifyAccuracy: modeAccuracy('identify', 'identifyAccuracy'), buildAccuracy: modeAccuracy('build', 'buildAccuracy'),
      compareAccuracy: modeAccuracy('compare', 'compareAccuracy'), equivalentAccuracy: modeAccuracy('equivalent', 'equivalentAccuracy'),
      touchFractionAccuracy: modeAccuracy('touch_fraction', 'touchFractionAccuracy'),
    }, { blocks: blocks.map(r => ({ metrics: r.metrics, studentWork: r.studentWork, diagnosisEvidence: r.diagnosisEvidence })) });
  };
  /** Close the current block: mount the next one, or submit once every block has a result. */
  const finishBlock = () => {
    if (finishedBlocks.current !== index) return;
    finishedBlocks.current = index + 1;
    if (index + 1 < groups.length) { setIndex(index + 1); return; }
    // Without an evaluation provider (the live host) no block recorded; nothing is submitted.
    if (results.current.length === groups.length) submitAggregate();
  };
  /** A block's evaluation only records; its settled teaching session closes it (`finishBlock`). */
  const completeBlock = (result: PrimitiveEvaluationResult<FractionCirclesMetrics>) => {
    if (results.current.length !== index) return;
    results.current.push(result);
  };
  // The last block stays mounted with its own summary: its settled session is what the host completed.
  const childData = { ...data, challenges: groups[index],
    instanceId: index === 0 ? instance.current : `${instance.current}-block-${index}`,
    onEvaluationSubmit: completeBlock };
  const mount = { runtimePlanItemId, runtimeEvalMode, onWorkspaceFinished: finishBlock };
  return groups[index][0].type === 'touch_fraction'
    ? <FractionTouch key={index} data={childData} className={className} localOnly {...mount} />
    : <PlainFractionCircles key={index} data={childData} className={className} localOnly {...mount} />;
};
const MixedFractionCircles = withWorkspaceOnly<FractionCirclesProps>('fraction-circles', MixedFractionChain, props => props.data.title);
export default FractionCircles;
