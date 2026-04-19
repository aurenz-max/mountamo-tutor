'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CoordinateGraphMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface CoordinateGraphChallenge {
  id: string;
  type: 'plot_point' | 'read_point' | 'find_slope' | 'find_intercept';
  instruction: string;
  hint: string;
  /** Primary coordinate — target for plot_point, displayed point for read_point, first point for slope/intercept */
  x1: number;
  y1: number;
  /** Secondary coordinate — second point for find_slope/find_intercept (unused by plot_point/read_point) */
  x2: number;
  y2: number;
  /** MC options (used by read_point, find_slope, find_intercept) */
  option0?: string;
  option1?: string;
  option2?: string;
  option3?: string;
  correctOptionIndex?: number;
  /** Optional equation label shown on the graph for find_intercept */
  equationLabel?: string;
}

export interface CoordinateGraphData {
  title: string;
  description?: string;
  challenges: CoordinateGraphChallenge[];
  gridMin: number;
  gridMax: number;
  gradeBand?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CoordinateGraphMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const SVG_SIZE = 500;
const PAD = 50;
const DRAW = SVG_SIZE - 2 * PAD;

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  plot_point:     { label: 'Plot Point',      icon: '\uD83D\uDCCD', accentColor: 'amber' },
  read_point:     { label: 'Read Point',      icon: '\uD83D\uDC41\uFE0F', accentColor: 'blue' },
  find_slope:     { label: 'Find Slope',      icon: '\uD83D\uDCC8', accentColor: 'purple' },
  find_intercept: { label: 'Find Intercept',  icon: '\uD83C\uDFAF', accentColor: 'emerald' },
};

// ============================================================================
// Component
// ============================================================================

const CoordinateGraph: React.FC<{ data: CoordinateGraphData; className?: string }> = ({ data, className }) => {
  const { gridMin, gridMax, challenges } = data;
  const svgRef = useRef<SVGSVGElement>(null);
  const stableInstanceIdRef = useRef(data.instanceId || `coordinate-graph-${Date.now()}`);
  const resolvedInstanceId = data.instanceId || stableInstanceIdRef.current;

  // --- Shared hooks ---
  const {
    currentIndex, currentAttempts, results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult, incrementAttempts, advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  const {
    submitResult: submitEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<CoordinateGraphMetrics>({
    primitiveType: 'coordinate-graph',
    instanceId: resolvedInstanceId,
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const challenge = challenges[currentIndex] ?? null;

  // --- AI Tutoring ---
  const aiData = useMemo(() => ({
    title: data.title,
    challenge: challenge ? { type: challenge.type, instruction: challenge.instruction } : null,
    progress: `${currentIndex + 1}/${challenges.length}`,
  }), [data.title, challenge, currentIndex, challenges.length]);

  const { sendText } = useLuminaAI({
    primitiveType: 'coordinate-graph',
    instanceId: resolvedInstanceId,
    primitiveData: aiData,
    gradeLevel: data.gradeBand || '6-8',
  });

  // --- Local state ---
  const [hoverPt, setHoverPt] = useState<{ x: number; y: number } | null>(null);
  const [placedPt, setPlacedPt] = useState<{ x: number; y: number } | null>(null);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | 'show_answer' | null>(null);

  // --- SVG coordinate helpers ---
  const span = gridMax - gridMin;
  const toX = (x: number) => PAD + ((x - gridMin) / span) * DRAW;
  const toY = (y: number) => PAD + ((gridMax - y) / span) * DRAW;

  const gridValues = useMemo(() => {
    const vals: number[] = [];
    for (let i = gridMin; i <= gridMax; i++) vals.push(i);
    return vals;
  }, [gridMin, gridMax]);

  const labelStep = span > 14 ? 2 : 1;

  // --- find_intercept computed values ---
  const interceptData = useMemo(() => {
    if (!challenge || challenge.type !== 'find_intercept') return null;
    const dx = challenge.x2 - challenge.x1;
    if (dx === 0) return null;
    const slope = (challenge.y2 - challenge.y1) / dx;
    const yInt = challenge.y1 - slope * challenge.x1;
    return {
      slope, yInt,
      lineY1: challenge.y1 + slope * (gridMin - challenge.x1),
      lineY2: challenge.y1 + slope * (gridMax - challenge.x1),
    };
  }, [challenge, gridMin, gridMax]);

  // --- Answer handling ---
  const handleAnswer = useCallback((correct: boolean, student: string, answer: string) => {
    if (feedback) return;
    if (correct) {
      setFeedback('correct');
      recordResult({
        challengeId: challenge!.id, correct: true,
        score: currentAttempts === 0 ? 100 : 50,
        attempts: currentAttempts + 1, challengeType: challenge!.type,
      });
      sendText(`[ANSWER_CORRECT] Challenge ${currentIndex + 1}/${challenges.length}: "${challenge!.instruction}". Student answered "${student}" correctly on attempt ${currentAttempts + 1}. Congratulate briefly.`, { silent: true });
    } else {
      incrementAttempts();
      if (currentAttempts >= 1) {
        setFeedback('show_answer');
        recordResult({
          challengeId: challenge!.id, correct: false, score: 0,
          attempts: currentAttempts + 1, challengeType: challenge!.type,
        });
        sendText(`[ANSWER_INCORRECT] Challenge ${currentIndex + 1}/${challenges.length}: Student answered "${student}" but correct is "${answer}". Attempt 2. Show answer and explain.`, { silent: true });
      } else {
        setFeedback('incorrect');
        sendText(`[ANSWER_INCORRECT] Challenge ${currentIndex + 1}/${challenges.length}: Student answered "${student}" but correct is "${answer}". Attempt 1. Give a hint.`, { silent: true });
      }
    }
  }, [feedback, challenge, currentIndex, challenges.length, currentAttempts, recordResult, incrementAttempts, sendText]);

  // --- Advance ---
  const advanceToNext = useCallback(() => {
    setFeedback(null);
    setPlacedPt(null);
    setSelectedOpt(null);
    setHoverPt(null);
    if (!advanceProgress()) {
      const totalCorrect = challengeResults.filter(r => r.correct).length;
      const score = Math.round((totalCorrect / challenges.length) * 100);
      const types = challenges.map(c => c.type);
      const uniqueTypes = types.filter((t, i) => types.indexOf(t) === i);
      submitEvaluation(
        totalCorrect === challenges.length,
        score,
        {
          type: 'coordinate-graph',
          totalCorrect,
          totalChallenges: challenges.length,
          challengeTypes: uniqueTypes,
          averageAttempts: challengeResults.reduce((s, r) => s + (r.attempts ?? 1), 0) / challengeResults.length,
          durationMs: elapsedMs,
        },
        { challengeResults },
      );
      const ps = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
      sendText(`[ALL_COMPLETE] Phase scores: ${ps}. Overall: ${score}%. Give encouraging phase-specific feedback.`, { silent: true });
    } else {
      sendText(`[NEXT_ITEM] Moving to challenge ${currentIndex + 2} of ${challenges.length}. Introduce it briefly.`, { silent: true });
    }
  }, [advanceProgress, challengeResults, challenges, currentIndex, phaseResults, sendText, submitEvaluation]);

  // Auto-advance on correct
  useEffect(() => {
    if (feedback === 'correct') {
      const t = setTimeout(advanceToNext, 1500);
      return () => clearTimeout(t);
    }
  }, [feedback, advanceToNext]);

  // --- SVG interaction handlers ---
  const svgToGraph = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (SVG_SIZE / rect.width);
    const sy = (e.clientY - rect.top) * (SVG_SIZE / rect.height);
    const gx = Math.round(((sx - PAD) / DRAW) * span + gridMin);
    const gy = Math.round(gridMax - ((sy - PAD) / DRAW) * span);
    if (gx < gridMin || gx > gridMax || gy < gridMin || gy > gridMax) return null;
    return { x: gx, y: gy };
  }, [span, gridMin, gridMax]);

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!challenge || challenge.type !== 'plot_point' || feedback) return;
    const pt = svgToGraph(e);
    if (!pt) return;
    setPlacedPt(pt);
    const correct = pt.x === challenge.x1 && pt.y === challenge.y1;
    handleAnswer(correct, `(${pt.x}, ${pt.y})`, `(${challenge.x1}, ${challenge.y1})`);
  }, [challenge, feedback, svgToGraph, handleAnswer]);

  const handleSvgMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!challenge || challenge.type !== 'plot_point' || feedback) return;
    setHoverPt(svgToGraph(e));
  }, [challenge, feedback, svgToGraph]);

  const handleOptionClick = useCallback((idx: number) => {
    if (!challenge || feedback) return;
    setSelectedOpt(idx);
    const opts = [challenge.option0, challenge.option1, challenge.option2, challenge.option3];
    const correct = idx === challenge.correctOptionIndex;
    handleAnswer(correct, opts[idx] ?? '', opts[challenge.correctOptionIndex ?? 0] ?? '');
  }, [challenge, feedback, handleAnswer]);

  // --- Render helpers ---
  const optionColors = (idx: number) => {
    if (!feedback || selectedOpt === null) return 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-100';
    const isSelected = idx === selectedOpt;
    const isCorrect = idx === challenge?.correctOptionIndex;
    if (feedback === 'correct' && isSelected) return 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200';
    if (feedback === 'show_answer' && isCorrect) return 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200';
    if ((feedback === 'incorrect' || feedback === 'show_answer') && isSelected) return 'bg-red-500/20 border-red-400/60 text-red-200';
    return 'bg-white/5 border-white/10 text-slate-400';
  };

  // --- Guard ---
  if (!challenges || challenges.length === 0) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <p className="text-slate-400">No challenges available.</p>
        </CardContent>
      </Card>
    );
  }

  const overallScore = challengeResults.length > 0
    ? Math.round(challengeResults.filter(r => r.correct).length / challengeResults.length * 100)
    : 0;

  return (
    <div className={`w-full max-w-3xl mx-auto my-12 animate-fade-in ${className || ''}`}>
      {/* Summary panel when complete */}
      {allChallengesComplete && phaseResults.length > 0 && (
        <PhaseSummaryPanel
          phases={phaseResults}
          overallScore={submittedResult?.score ?? overallScore}
          durationMs={elapsedMs}
          heading="Challenge Complete!"
          celebrationMessage="Great work on the coordinate plane!"
          className="mb-6"
        />
      )}

      {/* Active challenge */}
      {!allChallengesComplete && challenge && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            {/* Header + progress */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-100">{data.title}</h3>
                {data.description && <p className="text-sm text-slate-400 mt-0.5">{data.description}</p>}
              </div>
              <Badge variant="outline" className="text-blue-300 border-blue-400/30 text-xs">
                {currentIndex + 1} / {challenges.length}
              </Badge>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${((currentIndex) / challenges.length) * 100}%` }} />
            </div>

            {/* Instruction */}
            <p className="text-base text-slate-200 font-medium text-center py-2">
              {challenge.instruction}
            </p>

            {/* SVG Coordinate Plane */}
            <div className="flex justify-center">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
                className="w-full max-w-md rounded-xl bg-slate-950/60 border border-white/5"
                style={{ cursor: challenge.type === 'plot_point' && !feedback ? 'crosshair' : 'default' }}
                onClick={handleSvgClick}
                onMouseMove={handleSvgMove}
                onMouseLeave={() => setHoverPt(null)}
              >
                <defs>
                  <clipPath id="grid-clip">
                    <rect x={PAD} y={PAD} width={DRAW} height={DRAW} />
                  </clipPath>
                </defs>

                {/* Grid lines */}
                {gridValues.map(v => (
                  <React.Fragment key={`g-${v}`}>
                    <line x1={toX(v)} y1={PAD} x2={toX(v)} y2={SVG_SIZE - PAD}
                      stroke="white" strokeOpacity={v === 0 ? 0 : 0.06} strokeWidth={1} />
                    <line x1={PAD} y1={toY(v)} x2={SVG_SIZE - PAD} y2={toY(v)}
                      stroke="white" strokeOpacity={v === 0 ? 0 : 0.06} strokeWidth={1} />
                  </React.Fragment>
                ))}

                {/* Axes */}
                {gridMin <= 0 && gridMax >= 0 && (
                  <>
                    <line x1={PAD} y1={toY(0)} x2={SVG_SIZE - PAD} y2={toY(0)}
                      stroke="white" strokeOpacity={0.5} strokeWidth={1.5} />
                    <line x1={toX(0)} y1={PAD} x2={toX(0)} y2={SVG_SIZE - PAD}
                      stroke="white" strokeOpacity={0.5} strokeWidth={1.5} />
                  </>
                )}

                {/* Axis labels */}
                {gridValues.filter(v => v !== 0 && v % labelStep === 0).map(v => (
                  <React.Fragment key={`l-${v}`}>
                    <text x={toX(v)} y={toY(0) + 14} fill="white" fillOpacity={0.35}
                      fontSize={9} textAnchor="middle" fontFamily="ui-monospace, monospace">{v}</text>
                    <text x={toX(0) - 8} y={toY(v) + 3} fill="white" fillOpacity={0.35}
                      fontSize={9} textAnchor="end" fontFamily="ui-monospace, monospace">{v}</text>
                  </React.Fragment>
                ))}

                {/* ===== Challenge-specific overlays ===== */}
                <g clipPath="url(#grid-clip)">

                  {/* plot_point: hover ghost */}
                  {challenge.type === 'plot_point' && hoverPt && !feedback && (
                    <>
                      <circle cx={toX(hoverPt.x)} cy={toY(hoverPt.y)} r={7}
                        fill="#fbbf24" fillOpacity={0.25} stroke="#fbbf24" strokeOpacity={0.5} strokeWidth={1.5} />
                      <text x={toX(hoverPt.x)} y={toY(hoverPt.y) - 12} fill="white" fillOpacity={0.5}
                        fontSize={10} textAnchor="middle" fontFamily="ui-monospace, monospace">
                        ({hoverPt.x}, {hoverPt.y})
                      </text>
                    </>
                  )}

                  {/* plot_point: placed point */}
                  {challenge.type === 'plot_point' && placedPt && (
                    <circle cx={toX(placedPt.x)} cy={toY(placedPt.y)} r={7}
                      fill={feedback === 'correct' ? '#4ade80' : '#f87171'}
                      stroke="white" strokeWidth={2} />
                  )}

                  {/* plot_point: show correct answer after 2 fails */}
                  {challenge.type === 'plot_point' && feedback === 'show_answer' && (
                    <>
                      <circle cx={toX(challenge.x1)} cy={toY(challenge.y1)} r={9}
                        fill="#4ade80" fillOpacity={0.2} stroke="#4ade80" strokeWidth={1.5} strokeDasharray="4 3" />
                      <circle cx={toX(challenge.x1)} cy={toY(challenge.y1)} r={5}
                        fill="#4ade80" />
                      <text x={toX(challenge.x1)} y={toY(challenge.y1) - 14} fill="#4ade80"
                        fontSize={10} textAnchor="middle" fontFamily="ui-monospace, monospace">
                        ({challenge.x1}, {challenge.y1})
                      </text>
                    </>
                  )}

                  {/* read_point: displayed point */}
                  {challenge.type === 'read_point' && (
                    <>
                      <circle cx={toX(challenge.x1)} cy={toY(challenge.y1)} r={12}
                        fill="#60a5fa" fillOpacity={0.15} stroke="#60a5fa" strokeOpacity={0.4} strokeWidth={1}>
                        <animate attributeName="r" values="12;16;12" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="fillOpacity" values="0.15;0.05;0.15" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={toX(challenge.x1)} cy={toY(challenge.y1)} r={7}
                        fill="#60a5fa" stroke="white" strokeWidth={2} />
                    </>
                  )}

                  {/* find_slope: line + rise/run triangle */}
                  {challenge.type === 'find_slope' && (
                    <>
                      <line x1={toX(challenge.x1)} y1={toY(challenge.y1)}
                        x2={toX(challenge.x2)} y2={toY(challenge.y2)}
                        stroke="#60a5fa" strokeWidth={2.5} strokeLinecap="round" />
                      {/* Run (horizontal) */}
                      <line x1={toX(challenge.x1)} y1={toY(challenge.y1)}
                        x2={toX(challenge.x2)} y2={toY(challenge.y1)}
                        stroke="#34d399" strokeWidth={1.5} strokeDasharray="6 4" />
                      {/* Rise (vertical) */}
                      <line x1={toX(challenge.x2)} y1={toY(challenge.y1)}
                        x2={toX(challenge.x2)} y2={toY(challenge.y2)}
                        stroke="#f472b6" strokeWidth={1.5} strokeDasharray="6 4" />
                      {/* Points */}
                      <circle cx={toX(challenge.x1)} cy={toY(challenge.y1)} r={6}
                        fill="#60a5fa" stroke="white" strokeWidth={2} />
                      <circle cx={toX(challenge.x2)} cy={toY(challenge.y2)} r={6}
                        fill="#60a5fa" stroke="white" strokeWidth={2} />
                      {/* Point labels */}
                      <text x={toX(challenge.x1)} y={toY(challenge.y1) - 12} fill="white"
                        fontSize={10} textAnchor="middle" fontFamily="ui-monospace, monospace">
                        ({challenge.x1}, {challenge.y1})
                      </text>
                      <text x={toX(challenge.x2)} y={toY(challenge.y2) - 12} fill="white"
                        fontSize={10} textAnchor="middle" fontFamily="ui-monospace, monospace">
                        ({challenge.x2}, {challenge.y2})
                      </text>
                      {/* Rise label */}
                      <text x={toX(challenge.x2) + 12}
                        y={(toY(challenge.y1) + toY(challenge.y2)) / 2 + 4}
                        fill="#f472b6" fontSize={10} fontFamily="ui-monospace, monospace">
                        rise = {challenge.y2 - challenge.y1}
                      </text>
                      {/* Run label */}
                      <text x={(toX(challenge.x1) + toX(challenge.x2)) / 2}
                        y={toY(challenge.y1) + 16}
                        fill="#34d399" fontSize={10} textAnchor="middle" fontFamily="ui-monospace, monospace">
                        run = {challenge.x2 - challenge.x1}
                      </text>
                    </>
                  )}

                  {/* find_intercept: extended line + y-axis highlight */}
                  {challenge.type === 'find_intercept' && interceptData && (
                    <>
                      {/* y-axis glow */}
                      <line x1={toX(0)} y1={PAD} x2={toX(0)} y2={SVG_SIZE - PAD}
                        stroke="#fbbf24" strokeWidth={4} strokeOpacity={0.15} />
                      {/* Full line */}
                      <line x1={toX(gridMin)} y1={toY(interceptData.lineY1)}
                        x2={toX(gridMax)} y2={toY(interceptData.lineY2)}
                        stroke="#60a5fa" strokeWidth={2.5} strokeLinecap="round" />
                      {/* Defining points */}
                      <circle cx={toX(challenge.x1)} cy={toY(challenge.y1)} r={5}
                        fill="#60a5fa" stroke="white" strokeWidth={1.5} />
                      <circle cx={toX(challenge.x2)} cy={toY(challenge.y2)} r={5}
                        fill="#60a5fa" stroke="white" strokeWidth={1.5} />
                      {/* Y-intercept marker */}
                      <circle cx={toX(0)} cy={toY(interceptData.yInt)} r={10}
                        fill="#fbbf24" fillOpacity={0.15} stroke="#fbbf24" strokeOpacity={0.4} strokeWidth={1}>
                        <animate attributeName="r" values="10;14;10" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={toX(0)} cy={toY(interceptData.yInt)} r={7}
                        fill="#fbbf24" stroke="white" strokeWidth={2} />
                      <text x={toX(0)} y={toY(interceptData.yInt) + 4} fill="white"
                        fontSize={11} textAnchor="middle" fontWeight="bold">?</text>
                      {/* Equation label */}
                      {challenge.equationLabel && (
                        <text x={toX(gridMax) - 8} y={toY(interceptData.lineY2) - 8}
                          fill="white" fillOpacity={0.6} fontSize={11} textAnchor="end"
                          fontFamily="ui-monospace, monospace">
                          {challenge.equationLabel}
                        </text>
                      )}
                    </>
                  )}
                </g>
              </svg>
            </div>

            {/* plot_point click instruction */}
            {challenge.type === 'plot_point' && !feedback && (
              <p className="text-xs text-center text-slate-500">Click on the grid to plot your answer</p>
            )}

            {/* MC Options */}
            {challenge.type !== 'plot_point' && (
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map(i => {
                  const text = [challenge.option0, challenge.option1, challenge.option2, challenge.option3][i];
                  if (!text) return null;
                  return (
                    <Button key={i} variant="ghost"
                      className={`h-auto py-3 px-4 text-sm font-mono border transition-all ${optionColors(i)}`}
                      disabled={!!feedback}
                      onClick={() => handleOptionClick(i)}>
                      {text}
                    </Button>
                  );
                })}
              </div>
            )}

            {/* Feedback */}
            {feedback && (
              <div className={`p-4 rounded-xl border ${
                feedback === 'correct'
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                {feedback === 'correct' && (
                  <p className="text-emerald-300 text-sm font-medium">Correct! Well done.</p>
                )}
                {feedback === 'incorrect' && (
                  <div className="space-y-3">
                    <p className="text-red-300 text-sm font-medium">Not quite. Try again!</p>
                    <p className="text-slate-400 text-xs">{challenge.hint}</p>
                    <Button variant="ghost" size="sm"
                      className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                      onClick={() => { setFeedback(null); setPlacedPt(null); setSelectedOpt(null); }}>
                      Try Again
                    </Button>
                  </div>
                )}
                {feedback === 'show_answer' && (
                  <div className="space-y-3">
                    <p className="text-red-300 text-sm font-medium">
                      The correct answer is{' '}
                      <span className="text-emerald-300 font-bold">
                        {challenge.type === 'plot_point'
                          ? `(${challenge.x1}, ${challenge.y1})`
                          : [challenge.option0, challenge.option1, challenge.option2, challenge.option3][challenge.correctOptionIndex ?? 0]}
                      </span>
                    </p>
                    <p className="text-slate-400 text-xs">{challenge.hint}</p>
                    <Button variant="ghost" size="sm"
                      className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                      onClick={advanceToNext}>
                      Continue
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CoordinateGraph;
