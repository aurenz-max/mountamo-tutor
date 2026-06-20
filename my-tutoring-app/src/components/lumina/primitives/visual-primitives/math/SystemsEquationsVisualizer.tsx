'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaPanel,
  LuminaInput,
  LuminaButton,
  LuminaActionButton,
  LuminaFeedbackCard,
  LuminaHintDisclosure,
  LuminaChallengeCounter,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SystemsEquationsMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth — mirrored in gemini-systems-equations.ts)
// ============================================================================

export type SystemsEquationsChallengeType =
  | 'graph'
  | 'substitution'
  | 'elimination';

export interface SystemEquation {
  display: string;
  slope: number;
  yIntercept: number;
  a?: number;
  b?: number;
  c?: number;
  color?: string;
  label?: string;
}

export interface SystemsEquationsChallenge {
  id: string;
  type: SystemsEquationsChallengeType;
  systemForm: 'slope-intercept' | 'standard';
  equationA: SystemEquation;
  equationB: SystemEquation;
  expectedX: number;
  expectedY: number;
  instruction: string;
  hint: string;

  // ── Within-mode support-tier scaffolds (display-only; set by the generator when
  //    a tier is present). The checker NEVER reads these. The exact intersection
  //    point is the answer, so it is never marked pre-answer at any tier. ──
  /** Easy-only fuzzy crossing-region cue (no exact point, no coordinates). */
  showIntersectionRegion?: boolean;
  /** Show numbered axis tick labels (perception aid). Withdrawn at hard. */
  showAxisLabels?: boolean;
  /** Open the method/inverse-op step hint by default (vs. on-demand). */
  showStepHint?: boolean;
  /** Coordinate-free method hint (auto-shown at easy; never the answer). */
  stepHint?: string;
}

export interface SystemsEquationsVisualizerData {
  title: string;
  description: string;
  xRange: [number, number];
  yRange: [number, number];
  gridSpacing?: { x: number; y: number };
  showGrid?: boolean;
  showAxes?: boolean;
  gradeBand?: '7-8' | 'algebra-1' | 'algebra-2';
  /**
   * Within-mode support tier ('easy' | 'medium' | 'hard'), present only when the
   * generator applied one. Calibrates the live tutor's reveal level. At 'hard'
   * the tutor must NOT name the method or the intersection — only ask what the
   * lines share — and never reveal the solution.
   */
  supportTier?: 'easy' | 'medium' | 'hard';
  challenges: SystemsEquationsChallenge[];

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SystemsEquationsMetrics>) => void;
}

// ============================================================================
// Phase Summary Config
// ============================================================================

const PHASE_CONFIG_BY_TYPE: Record<SystemsEquationsChallengeType, PhaseConfig> = {
  graph:        { label: 'Graphing',     icon: '📈', accentColor: 'cyan' },
  substitution: { label: 'Substitution', icon: '🔁', accentColor: 'purple' },
  elimination:  { label: 'Elimination',  icon: '➖', accentColor: 'emerald' },
};

// ============================================================================
// Tutor reveal policy — calibrates how much the live tutor reveals per tier.
// The intersection IS the (x, y) answer on every mode, so the tutor never states
// the coordinates and, at 'hard', never names the method or the intersection —
// it only asks what the two lines share.
// ============================================================================

function tutorRevealPolicy(
  tier: 'easy' | 'medium' | 'hard' | undefined,
  challengeType: SystemsEquationsChallengeType,
): string {
  if (!tier) return '';
  const common = 'Never state the final answer — the solution (x, y) where the lines cross.';
  const methodWord =
    challengeType === 'graph' ? 'reading the crossing point off the graph'
    : challengeType === 'substitution' ? 'substitution (set the two y-expressions equal, then inverse-operate)'
    : 'elimination (scale/add the equations so one variable cancels)';
  switch (tier) {
    case 'easy':
      return `SUPPORT TIER easy: maximum scaffolding. You may name the method (${methodWord}) and walk the setup step by step. ${common}`;
    case 'medium':
      return `SUPPORT TIER medium: the method is named on screen — let the student do the setup and arithmetic. Nudge the next step only; do not solve it. ${common}`;
    default:
      return `SUPPORT TIER hard: the on-screen scaffolds are withdrawn. Do NOT name the method or the intersection point; instead ask what the two lines share (the single point on BOTH). Let the student choose and execute the approach unaided. ${common}`;
  }
}

// ============================================================================
// Component
// ============================================================================

interface SystemsEquationsVisualizerProps {
  data: SystemsEquationsVisualizerData;
  className?: string;
}

const SystemsEquationsVisualizer: React.FC<SystemsEquationsVisualizerProps> = ({ data, className }) => {
  const {
    title,
    description,
    xRange,
    yRange,
    gridSpacing = { x: 1, y: 1 },
    showAxes = true,
    showGrid = true,
    gradeBand = 'algebra-1',
    supportTier,
    challenges,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Multi-challenge state
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

  const currentChallenge = challenges[currentChallengeIndex] || null;
  const challengeType = currentChallenge?.type ?? 'graph';

  // -------------------------------------------------------------------------
  // Per-challenge UI state (reset on advance)
  // -------------------------------------------------------------------------
  const [xInput, setXInput] = useState('');
  const [yInput, setYInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [showHint, setShowHint] = useState(false);
  const [revealLines, setRevealLines] = useState(false); // for non-graph modes, lines hide until correct

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `systems-equations-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const recordedRef = useRef(false);
  const hintViewedRef = useRef(false);
  const hintsViewedRef = useRef(0);
  const submittedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canvas constants
  const padding = 50;
  const canvasWidth = 600;
  const canvasHeight = 540;

  // -------------------------------------------------------------------------
  // Per-challenge reset — fires whenever advance() flips currentChallenge.id.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!currentChallenge) return;
    setXInput('');
    setYInput('');
    setFeedback('');
    setFeedbackType('');
    setShowHint(false);
    setRevealLines(currentChallenge.type === 'graph');
    recordedRef.current = false;
    hintViewedRef.current = false;
  }, [currentChallenge?.id, currentChallenge]);

  // -------------------------------------------------------------------------
  // Coordinate helpers
  // -------------------------------------------------------------------------
  const graphToCanvas = useCallback((x: number, y: number): { x: number; y: number } => {
    const graphWidth = xRange[1] - xRange[0];
    const graphHeight = yRange[1] - yRange[0];
    const effectiveWidth = canvasWidth - 2 * padding;
    const effectiveHeight = canvasHeight - 2 * padding;
    const canvasX = padding + ((x - xRange[0]) / graphWidth) * effectiveWidth;
    const canvasY = canvasHeight - padding - ((y - yRange[0]) / graphHeight) * effectiveHeight;
    return { x: canvasX, y: canvasY };
  }, [xRange, yRange]);

  // -------------------------------------------------------------------------
  // Canvas draw
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentChallenge) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
      ctx.lineWidth = 0.5;
      for (let x = Math.ceil(xRange[0] / gridSpacing.x) * gridSpacing.x; x <= xRange[1]; x += gridSpacing.x) {
        const { x: cx } = graphToCanvas(x, 0);
        ctx.beginPath();
        ctx.moveTo(cx, padding);
        ctx.lineTo(cx, canvasHeight - padding);
        ctx.stroke();
      }
      for (let y = Math.ceil(yRange[0] / gridSpacing.y) * gridSpacing.y; y <= yRange[1]; y += gridSpacing.y) {
        const { y: cy } = graphToCanvas(0, y);
        ctx.beginPath();
        ctx.moveTo(padding, cy);
        ctx.lineTo(canvasWidth - padding, cy);
        ctx.stroke();
      }
    }

    // Axes
    if (showAxes) {
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.8)';
      ctx.lineWidth = 2;
      const { y: xAxisY } = graphToCanvas(0, 0);
      ctx.beginPath();
      ctx.moveTo(padding, xAxisY);
      ctx.lineTo(canvasWidth - padding, xAxisY);
      ctx.stroke();
      const { x: yAxisX } = graphToCanvas(0, 0);
      ctx.beginPath();
      ctx.moveTo(yAxisX, padding);
      ctx.lineTo(yAxisX, canvasHeight - padding);
      ctx.stroke();

      // Numbered tick labels — perception aid, withdrawn at the hard support tier
      // (showAxisLabels === false). Undefined (no tier present) → labels shown.
      const showAxisLabels = currentChallenge.showAxisLabels !== false;
      if (showAxisLabels) {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let x = Math.ceil(xRange[0]); x <= xRange[1]; x += gridSpacing.x) {
          if (x === 0) continue;
          const { x: cx, y: cy } = graphToCanvas(x, 0);
          ctx.fillText(x.toString(), cx, cy + 16);
        }
        for (let y = Math.ceil(yRange[0]); y <= yRange[1]; y += gridSpacing.y) {
          if (y === 0) continue;
          const { x: cx, y: cy } = graphToCanvas(0, y);
          ctx.fillText(y.toString(), cx - 18, cy);
        }
      }
    }

    // Lines — both A and B
    if (revealLines) {
      const drawLine = (slope: number, yIntercept: number, color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        let firstPoint = true;
        const step = (xRange[1] - xRange[0]) / 400;
        for (let x = xRange[0]; x <= xRange[1]; x += step) {
          const y = slope * x + yIntercept;
          if (y < yRange[0] || y > yRange[1]) {
            firstPoint = true;
            continue;
          }
          const { x: cx, y: cy } = graphToCanvas(x, y);
          if (firstPoint) { ctx.moveTo(cx, cy); firstPoint = false; }
          else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      };

      drawLine(currentChallenge.equationA.slope, currentChallenge.equationA.yIntercept, currentChallenge.equationA.color || '#3b82f6');
      drawLine(currentChallenge.equationB.slope, currentChallenge.equationB.yIntercept, currentChallenge.equationB.color || '#10b981');

      // ── Support-tier (easy) FUZZY crossing-region cue — a "look here" self-check
      //    hint. NEVER the exact point and NEVER coordinates: the intersection IS the
      //    (x, y) answer, so this is a soft translucent blob whose radius spans ~1.6
      //    grid units, withdrawn the instant the student answers correctly. ──
      if (currentChallenge.showIntersectionRegion && !recordedRef.current) {
        const center = graphToCanvas(currentChallenge.expectedX, currentChallenge.expectedY);
        const unit = Math.abs(graphToCanvas(1, 0).x - graphToCanvas(0, 0).x);
        const radius = unit * 1.6; // deliberately fuzzy — covers several integer points
        const grad = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
        grad.addColorStop(0, 'rgba(250, 204, 21, 0.28)'); // soft amber glow
        grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Intersection marker — shown only once correct (post-correct reveal per §6m #4).
      if (recordedRef.current) {
        const pos = graphToCanvas(currentChallenge.expectedX, currentChallenge.expectedY);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#fca5a5';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`(${currentChallenge.expectedX}, ${currentChallenge.expectedY})`, pos.x, pos.y - 14);
      }
    } else {
      // Lines hidden — show a "Verify on graph" placeholder for substitution/elimination modes.
      ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Solve algebraically — the graph reveals after you check.', canvasWidth / 2, canvasHeight / 2);
    }
  }, [
    currentChallenge,
    xRange,
    yRange,
    gridSpacing,
    showAxes,
    showGrid,
    revealLines,
    graphToCanvas,
    // recordedRef.current isn't reactive, but we redraw on feedbackType change which gates on it.
    feedbackType,
  ]);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_CONFIG_BY_TYPE,
    getScore: (rs) =>
      Math.round(
        rs.reduce(
          (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
          0,
        ) / Math.max(rs.length, 1),
      ),
  });

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<SystemsEquationsMetrics>({
    primitiveType: 'systems-equations-visualizer',
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
    challengeType,
    currentChallengeIndex: currentChallengeIndex + 1,
    totalChallenges: challenges.length,
    equationA: currentChallenge?.equationA.display ?? '',
    equationB: currentChallenge?.equationB.display ?? '',
    expectedX: currentChallenge?.expectedX ?? 0,
    expectedY: currentChallenge?.expectedY ?? 0,
    systemForm: currentChallenge?.systemForm ?? 'slope-intercept',
    gradeBand,
    supportTier: supportTier ?? null,
    attemptNumber: currentAttempts + 1,
  }), [
    challengeType,
    currentChallengeIndex,
    challenges.length,
    currentChallenge,
    gradeBand,
    supportTier,
    currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'systems-equations-visualizer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel:
      gradeBand === '7-8' ? 'Grade 8' : gradeBand === 'algebra-1' ? 'Algebra 1' : 'Algebra 2',
  });

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    const totalCh = challenges.length;
    const policy = tutorRevealPolicy(supportTier, challengeType);
    sendText(
      `[ACTIVITY_START] Systems-of-equations session: ${totalCh > 1 ? `${totalCh} systems` : 'one system'}. `
      + `Mode: ${challengeType}. Grade band: ${gradeBand}. `
      + `Introduce briefly: "Each system has two equations and one (x, y) solution — find it using ${challengeType}."`
      + (policy ? ` ${policy}` : ''),
      { silent: true }
    );
  }, [isConnected, challenges.length, challengeType, gradeBand, supportTier, sendText]);

  // -------------------------------------------------------------------------
  // Submit handler (single, used by all 3 modes — answer is always (x, y))
  // -------------------------------------------------------------------------

  const completeChallenge = useCallback((correct: boolean) => {
    if (!currentChallenge) return;
    if (recordedRef.current) return; // stale-state guard
    incrementAttempts();
    const attempts = currentAttempts + 1;

    if (correct) {
      const score = Math.max(20, 100 - (attempts - 1) * 20);
      recordedRef.current = true;
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts,
        score,
      });
    }
  }, [currentChallenge, currentAttempts, incrementAttempts, recordResult]);

  const handleCheck = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation) return;
    const trimmedX = xInput.trim();
    const trimmedY = yInput.trim();
    if (!trimmedX || !trimmedY) {
      SoundManager.invalid();
      setFeedback('Enter both x and y values.');
      setFeedbackType('error');
      return;
    }
    const xVal = parseFloat(trimmedX);
    const yVal = parseFloat(trimmedY);
    if (!Number.isFinite(xVal) || !Number.isFinite(yVal)) {
      SoundManager.invalid();
      setFeedback('Enter numbers for x and y.');
      setFeedbackType('error');
      return;
    }
    const correct =
      Math.abs(xVal - currentChallenge.expectedX) < 0.01 &&
      Math.abs(yVal - currentChallenge.expectedY) < 0.01;
    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Correct! The solution is (${currentChallenge.expectedX}, ${currentChallenge.expectedY}).`);
      setFeedbackType('success');
      setRevealLines(true);
      sendText(
        `[ANSWER_CORRECT] Student solved system via ${challengeType}. `
        + `Celebrate briefly and emphasize verification: "Plug into both equations to confirm."`,
        { silent: true },
      );
      completeChallenge(true);
    } else {
      SoundManager.playIncorrect();
      setFeedback(`Not quite. Check both equations carefully.`);
      setFeedbackType('error');
      incrementAttempts();
      const revealPolicy = tutorRevealPolicy(supportTier, currentChallenge.type);
      sendText(
        `[ANSWER_INCORRECT] Student tried (${xVal}, ${yVal}) for ${challengeType} mode. `
        + `Actual: (${currentChallenge.expectedX}, ${currentChallenge.expectedY}). Coach the method without giving the answer.`
        + (revealPolicy ? ` ${revealPolicy}` : ''),
        { silent: true },
      );
    }
  }, [
    currentChallenge,
    hasSubmittedEvaluation,
    xInput,
    yInput,
    challengeType,
    completeChallenge,
    incrementAttempts,
    supportTier,
    sendText,
  ]);

  const handleShowHint = useCallback(() => {
    if (showHint) return;
    setShowHint(true);
    if (!hintViewedRef.current) {
      hintViewedRef.current = true;
      hintsViewedRef.current += 1;
    }
  }, [showHint]);

  const advanceChallenge = useCallback(() => {
    if (advanceProgress()) {
      const nextIdx = currentChallengeIndex + 1;
      const next = challenges[nextIdx];
      const nextPolicy = next ? tutorRevealPolicy(supportTier, next.type) : '';
      sendText(
        `[NEXT_ITEM] System ${nextIdx + 1} of ${challenges.length}: "${next?.equationA.display}" and "${next?.equationB.display}". `
        + `Introduce briefly: "Here's the next system. Same method, different numbers."`
        + (nextPolicy ? ` ${nextPolicy}` : ''),
        { silent: true },
      );
    }
  }, [advanceProgress, currentChallengeIndex, challenges, supportTier, sendText]);

  // -------------------------------------------------------------------------
  // Session-complete: build metrics and submit exactly once.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation || challenges.length === 0) return;
    if (submittedRef.current) return;
    submittedRef.current = true;

    const total = challenges.length;
    const correctCount = challengeResults.filter((r) => r.correct).length;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const firstTryCount = challengeResults.filter((r) => r.correct && r.attempts === 1).length;
    const avgScore = Math.round(
      challengeResults.reduce(
        (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
        0,
      ) / Math.max(challengeResults.length, 1),
    );

    const metrics: SystemsEquationsMetrics = {
      type: 'systems-equations-visualizer',
      challengeType: (currentChallenge?.type ?? challenges[0]?.type ?? 'graph') as SystemsEquationsMetrics['challengeType'],
      totalChallenges: total,
      correctCount,
      attemptsCount,
      firstTryCount,
      hintsViewed: hintsViewedRef.current,
      overallAccuracy: avgScore,
      averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
    };

    const goalMet = correctCount === total;
    submitEvaluation(goalMet, avgScore, metrics, { challengeResults });

    sendText(
      `[ALL_COMPLETE] All ${total} systems done. Correct: ${correctCount}/${total}. First-try: ${firstTryCount}. Accuracy: ${avgScore}%. Give encouraging summary.`,
      { silent: true },
    );
  }, [allChallengesComplete, hasSubmittedEvaluation, challenges, challengeResults, currentChallenge, submitEvaluation, sendText]);

  // -------------------------------------------------------------------------
  // Derived UI state
  // -------------------------------------------------------------------------
  const isCurrentComplete =
    challenges.length > 0 &&
    challengeResults.length > currentChallengeIndex &&
    challengeResults[currentChallengeIndex]?.correct;

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challengeResults.length === 0) return 0;
    return Math.round(
      challengeResults.reduce(
        (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
        0,
      ) / challengeResults.length,
    );
  }, [allChallengesComplete, challengeResults]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (!currentChallenge) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6 text-center text-slate-400">
          No systems-of-equations challenges in this session.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const modeLabel =
    challengeType === 'graph' ? 'Graphing'
    : challengeType === 'substitution' ? 'Substitution'
    : 'Elimination';

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="blue" className="text-xs">{modeLabel}</LuminaBadge>
            <LuminaBadge accent="emerald" className="text-xs">{gradeBand}</LuminaBadge>
            <LuminaChallengeCounter
              current={Math.min(currentChallengeIndex + 1, challenges.length)}
              total={challenges.length}
            />
          </div>
        </div>
        <p className="text-slate-400 text-sm mt-1">
          {currentChallenge.instruction}
        </p>
        {description && (
          <p className="text-slate-500 text-xs mt-0.5">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Equation banners */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <LuminaPanel accent="blue" className="flex items-center gap-3 p-3">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: currentChallenge.equationA.color || '#3b82f6' }}
            />
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{currentChallenge.equationA.label || 'A'}</span>
            <span className="text-base font-mono font-bold text-blue-300">{currentChallenge.equationA.display}</span>
          </LuminaPanel>
          <LuminaPanel accent="emerald" className="flex items-center gap-3 p-3">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: currentChallenge.equationB.color || '#10b981' }}
            />
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{currentChallenge.equationB.label || 'B'}</span>
            <span className="text-base font-mono font-bold text-emerald-300">{currentChallenge.equationB.display}</span>
          </LuminaPanel>
        </div>

        {/* Progress dots — bespoke per-challenge state visual tied to results. */}
        <div className="flex items-center justify-center gap-1.5">
          {challenges.map((ch, idx) => {
            const result = challengeResults.find((r) => r.challengeId === ch.id);
            const isActive = idx === currentChallengeIndex;
            const isDone = !!result?.correct;
            return (
              <div
                key={ch.id}
                className={`h-2 rounded-full transition-all ${
                  isDone
                    ? 'w-6 bg-emerald-400/80'
                    : isActive
                    ? 'w-8 bg-blue-400/80'
                    : 'w-2 bg-slate-600/60'
                }`}
              />
            );
          })}
        </div>

        {/* Canvas — bespoke interaction surface (left untouched). */}
        <LuminaPanel accent="blue" className="p-3 rounded-2xl">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="rounded-lg w-full"
            style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}`, backgroundColor: 'rgba(15, 23, 42, 0.6)' }}
          />
          {!revealLines && challengeType !== 'graph' && (
            <div className="mt-2 flex justify-center">
              <LuminaButton
                tone="subtle"
                size="sm"
                className="text-xs"
                onClick={() => { SoundManager.tap(); setRevealLines(true); }}
              >
                Peek at the graph
              </LuminaButton>
            </div>
          )}
        </LuminaPanel>

        {/* Answer panel */}
        {!isCurrentComplete && !allChallengesComplete && (
          <LuminaPanel className="space-y-3">
            <p className="text-slate-300 text-sm font-medium text-center">
              {challengeType === 'graph'
                ? 'Enter the intersection coordinates:'
                : challengeType === 'substitution'
                ? 'Solve by substitution and enter (x, y):'
                : 'Solve by elimination and enter (x, y):'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <label className="flex items-center gap-2 text-slate-300 text-sm">
                <span className="text-blue-300 font-mono">x =</span>
                <LuminaInput
                  type="number"
                  value={xInput}
                  onChange={(e) => setXInput(e.target.value)}
                  className="w-20 px-2 py-1.5 text-center"
                  placeholder="?"
                  onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                />
              </label>
              <label className="flex items-center gap-2 text-slate-300 text-sm">
                <span className="text-emerald-300 font-mono">y =</span>
                <LuminaInput
                  type="number"
                  value={yInput}
                  onChange={(e) => setYInput(e.target.value)}
                  className="w-20 px-2 py-1.5 text-center"
                  placeholder="?"
                  onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                />
              </label>
              <LuminaActionButton action="check" onClick={handleCheck}>
                Check
              </LuminaActionButton>
            </div>
          </LuminaPanel>
        )}

        {/* Feedback */}
        {feedback && (
          <LuminaFeedbackCard
            status={feedbackType === 'success' ? 'correct' : feedbackType === 'error' ? 'incorrect' : 'insight'}
          >
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Method step hint — easy support tier only. Coordinate-free (never the
            answer), shown by default as a self-check scaffold; withdrawn at medium/hard. */}
        {currentChallenge.showStepHint && currentChallenge.stepHint && !isCurrentComplete && (
          <LuminaHintDisclosure defaultOpen label="Method steps">
            {currentChallenge.stepHint}
          </LuminaHintDisclosure>
        )}

        {/* Hint — on-demand (carries the numbers); unchanged by tier. */}
        {showHint && (
          <LuminaHintDisclosure defaultOpen label="Hint">
            {currentChallenge.hint}
          </LuminaHintDisclosure>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-2 flex-wrap">
          {isCurrentComplete && !allChallengesComplete && (
            <LuminaActionButton action="next" onClick={advanceChallenge}>
              Next System →
            </LuminaActionButton>
          )}
          {!isCurrentComplete && !allChallengesComplete && (
            <LuminaButton
              tone="subtle"
              size="sm"
              onClick={handleShowHint}
              disabled={showHint}
            >
              {showHint ? 'Hint shown' : 'Show hint'}
            </LuminaButton>
          )}
        </div>

        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="All Systems Solved!"
            celebrationMessage={`You completed all ${challenges.length} systems-of-equations challenges.`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default SystemsEquationsVisualizer;
