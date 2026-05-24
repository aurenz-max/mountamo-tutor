'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SystemsEquationsMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

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
    attemptNumber: currentAttempts + 1,
  }), [
    challengeType,
    currentChallengeIndex,
    challenges.length,
    currentChallenge,
    gradeBand,
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
    sendText(
      `[ACTIVITY_START] Systems-of-equations session: ${totalCh > 1 ? `${totalCh} systems` : 'one system'}. `
      + `Mode: ${challengeType}. Grade band: ${gradeBand}. `
      + `Introduce briefly: "Each system has two equations and one (x, y) solution — find it using ${challengeType}."`,
      { silent: true }
    );
  }, [isConnected, challenges.length, challengeType, gradeBand, sendText]);

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
      setFeedback('Enter both x and y values.');
      setFeedbackType('error');
      return;
    }
    const xVal = parseFloat(trimmedX);
    const yVal = parseFloat(trimmedY);
    if (!Number.isFinite(xVal) || !Number.isFinite(yVal)) {
      setFeedback('Enter numbers for x and y.');
      setFeedbackType('error');
      return;
    }
    const correct =
      Math.abs(xVal - currentChallenge.expectedX) < 0.01 &&
      Math.abs(yVal - currentChallenge.expectedY) < 0.01;
    if (correct) {
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
      setFeedback(`Not quite. Check both equations carefully.`);
      setFeedbackType('error');
      incrementAttempts();
      sendText(
        `[ANSWER_INCORRECT] Student tried (${xVal}, ${yVal}) for ${challengeType} mode. `
        + `Actual: (${currentChallenge.expectedX}, ${currentChallenge.expectedY}). Coach the method without giving the answer.`,
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
      sendText(
        `[NEXT_ITEM] System ${nextIdx + 1} of ${challenges.length}: "${next?.equationA.display}" and "${next?.equationB.display}". `
        + `Introduce briefly: "Here's the next system. Same method, different numbers."`,
        { silent: true },
      );
    }
  }, [advanceProgress, currentChallengeIndex, challenges, sendText]);

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
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
        <CardContent className="p-6 text-center text-slate-400">
          No systems-of-equations challenges in this session.
        </CardContent>
      </Card>
    );
  }

  const modeLabel =
    challengeType === 'graph' ? 'Graphing'
    : challengeType === 'substitution' ? 'Substitution'
    : 'Elimination';

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-blue-300 text-xs">{modeLabel}</Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-emerald-300 text-xs">{gradeBand}</Badge>
            <span className="text-slate-500 text-xs">
              {Math.min(currentChallengeIndex + 1, challenges.length)} / {challenges.length}
            </span>
          </div>
        </div>
        <p className="text-slate-400 text-sm mt-1">
          {currentChallenge.instruction}
        </p>
        {description && (
          <p className="text-slate-500 text-xs mt-0.5">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Equation banners */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg border border-blue-500/30">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: currentChallenge.equationA.color || '#3b82f6' }}
            />
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{currentChallenge.equationA.label || 'A'}</span>
            <span className="text-base font-mono font-bold text-blue-300">{currentChallenge.equationA.display}</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg border border-emerald-500/30">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: currentChallenge.equationB.color || '#10b981' }}
            />
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{currentChallenge.equationB.label || 'B'}</span>
            <span className="text-base font-mono font-bold text-emerald-300">{currentChallenge.equationB.display}</span>
          </div>
        </div>

        {/* Progress dots */}
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

        {/* Canvas */}
        <div className="p-3 bg-slate-800/30 rounded-2xl border border-blue-500/20">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="rounded-lg w-full"
            style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}`, backgroundColor: 'rgba(15, 23, 42, 0.6)' }}
          />
          {!revealLines && challengeType !== 'graph' && (
            <div className="mt-2 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400 text-xs"
                onClick={() => setRevealLines(true)}
              >
                Peek at the graph
              </Button>
            </div>
          )}
        </div>

        {/* Answer panel */}
        {!isCurrentComplete && !allChallengesComplete && (
          <div className="bg-slate-800/20 rounded-lg p-4 border border-white/5 space-y-3">
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
                <input
                  type="number"
                  value={xInput}
                  onChange={(e) => setXInput(e.target.value)}
                  className="w-20 px-2 py-1.5 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-center focus:outline-none focus:border-blue-400/50"
                  placeholder="?"
                  onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                />
              </label>
              <label className="flex items-center gap-2 text-slate-300 text-sm">
                <span className="text-emerald-300 font-mono">y =</span>
                <input
                  type="number"
                  value={yInput}
                  onChange={(e) => setYInput(e.target.value)}
                  className="w-20 px-2 py-1.5 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-center focus:outline-none focus:border-emerald-400/50"
                  placeholder="?"
                  onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                />
              </label>
              <Button
                variant="ghost"
                className="bg-blue-500/10 border border-blue-400/30 text-blue-300"
                onClick={handleCheck}
              >
                Check
              </Button>
            </div>
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

        {/* Hint */}
        {showHint && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <p className="text-amber-200 text-sm">
              <span className="font-mono uppercase text-amber-300 text-xs mr-2">Hint</span>
              {currentChallenge.hint}
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-2 flex-wrap">
          {isCurrentComplete && !allChallengesComplete && (
            <Button
              variant="ghost"
              className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
              onClick={advanceChallenge}
            >
              Next System →
            </Button>
          )}
          {!isCurrentComplete && !allChallengesComplete && (
            <Button
              variant="ghost"
              size="sm"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400"
              onClick={handleShowHint}
              disabled={showHint}
            >
              {showHint ? 'Hint shown' : 'Show hint'}
            </Button>
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
      </CardContent>
    </Card>
  );
};

export default SystemsEquationsVisualizer;
