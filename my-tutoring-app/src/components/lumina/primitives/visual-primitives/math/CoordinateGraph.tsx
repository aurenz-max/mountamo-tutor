'use client';

import React, { useState, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaAnswerChoice,
  LuminaFeedbackCard,
  LuminaBadge,
  LuminaChallengeCounter,
  LuminaProgress,
  type AnswerChoiceState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CoordinateGraphMetrics } from '../../../evaluation/types';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  PLANE, choiceCorrect, coordinateMiss, describeCoordinateWork, interceptOf, maskedEquation, nearestCrossing,
  plotCorrect, workspaceScene, type GridPoint,
} from './coordinateGraphWorkspace';
import {
  AXIS_GUIDE, COORDINATE_LEVERS, CROSSING, DROP_LINES, EVERY_LINE, INTERCEPT_FRAME, MODEL_LINE, MODEL_POINT, RISE_RUN,
  SLOPE_FRAME, UNIT_STEPS, isPracticeItem, lineModel, pointModel, type LineModel,
} from './coordinateGraphLevers';
import { coordinateGraphBoss } from './coordinateGraph.boss';

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
  /** Optional equation label for find_intercept. Drawn with the intercept masked (`maskedEquation`): it would state the answer. */
  equationLabel?: string;

  /**
   * Support-tier scaffold flags (set by the generator when config.difficulty is
   * applied; absent ⇒ default behavior). Existing aids default ON when absent so
   * the no-tier path is unchanged; the NEW `showDropLines` aid defaults OFF.
   */
  showHoverReadout?: boolean; // plot_point: live (x,y) echo under the hover ghost
  showDropLines?: boolean; // read_point: dashed lines from point to each axis
  showAxisLabels?: boolean; // numeric tick labels on the axes
  showRiseRunGuides?: boolean; // find_slope: dashed rise/run triangle
  showRiseRunLabels?: boolean; // find_slope: "rise = N" / "run = N" labels
  showPointLabels?: boolean; // find_slope: (x,y) text beside each point
  showEquationLabel?: boolean; // find_intercept: y = mx + ? label
  showInterceptMarker?: boolean; // find_intercept: pulsing "?" marker at the crossing
  supportTier?: 'easy' | 'medium' | 'hard';
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

const SVG_SIZE = PLANE.size;
const PAD = PLANE.pad;
const DRAW = SVG_SIZE - 2 * PAD;

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  plot_point:     { label: 'Plot Point',      icon: '📍', accentColor: 'amber' },
  read_point:     { label: 'Read Point',      icon: '👁️', accentColor: 'blue' },
  find_slope:     { label: 'Find Slope',      icon: '📈', accentColor: 'purple' },
  find_intercept: { label: 'Find Intercept',  icon: '🎯', accentColor: 'emerald' },
};

/** A pointer position in the plane's viewBox (the screen matrix inverted), or by its box where there is none. */
function viewBoxPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const matrix = svg.getScreenCTM?.();
  if (matrix && typeof svg.createSVGPoint === 'function') {
    const p = svg.createSVGPoint();
    p.x = clientX; p.y = clientY;
    const local = p.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
  }
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return { x: (clientX - rect.left) * (SVG_SIZE / rect.width), y: (clientY - rect.top) * (SVG_SIZE / rect.height) };
}

/** The model_line lever's worked example: a different line on a small plane from -4 to 4, with its caption. */
const LineModelInset: React.FC<{ model: LineModel }> = ({ model }) => {
  const S = 160, P = 12, D = S - 2 * P, lo = -4, hi = 4;
  const tx = (x: number) => P + ((x - lo) / (hi - lo)) * D;
  const ty = (y: number) => P + ((hi - y) / (hi - lo)) * D;
  const m = (model.b.y - model.a.y) / (model.b.x - model.a.x);
  const at = (x: number) => model.a.y + m * (x - model.a.x);
  return (
    <figure data-lever="model-line" className="mx-auto w-64 rounded-lg border border-white/10 bg-slate-900/40 p-2 text-center">
      <figcaption className="mb-1 text-xs uppercase tracking-wider text-slate-400">Worked example</figcaption>
      <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-40">
        {Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map(v => (
          <React.Fragment key={v}>
            <line x1={tx(v)} y1={P} x2={tx(v)} y2={S - P} stroke="white" strokeOpacity={v === 0 ? 0.5 : 0.08} />
            <line x1={P} y1={ty(v)} x2={S - P} y2={ty(v)} stroke="white" strokeOpacity={v === 0 ? 0.5 : 0.08} />
          </React.Fragment>
        ))}
        <line x1={tx(lo)} y1={ty(at(lo))} x2={tx(hi)} y2={ty(at(hi))} stroke="#a78bfa" strokeWidth={2} />
        {model.crossing == null && (
          <path d={`M ${tx(model.a.x)} ${ty(model.a.y)} L ${tx(model.b.x)} ${ty(model.a.y)} L ${tx(model.b.x)} ${ty(model.b.y)}`}
            fill="none" stroke="#fde68a" strokeDasharray="4 3" />
        )}
        {[model.a, model.b].map((p, i) => <circle key={i} cx={tx(p.x)} cy={ty(p.y)} r={3.5} fill="#a78bfa" />)}
        {model.crossing != null && <circle cx={tx(0)} cy={ty(model.crossing)} r={5} fill="none" stroke="#fde68a" strokeWidth={2} />}
      </svg>
      <p className="mt-1 font-mono text-xs text-violet-200">{model.caption}</p>
    </figure>
  );
};

// ============================================================================
// Component
// ============================================================================

interface CoordinateGraphProps {
  data: CoordinateGraphData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const useCoordinateProgress = useWorkspaceProgressFor('coordinate-graph');
const PRACTICE_NOTE = 'An easier practice item is on screen in place of the item. It is not graded; the full item comes back after it.';

const CoordinateGraphSurface = ({ data, className, runtimePlanItemId }: CoordinateGraphProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { gridMin, gridMax, challenges } = data;
  const svgRef = useRef<SVGSVGElement>(null);
  const stableInstanceIdRef = useRef(data.instanceId || `coordinate-graph-${Date.now()}`);
  const resolvedInstanceId = data.instanceId || stableInstanceIdRef.current;

  // --- Challenge progression: the teaching workspace owns it. ---
  /** Bound below, once the setters exist; the progress hook calls them only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useCoordinateProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId: data.objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: coordinateGraphBoss.assignment!,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const {
    currentIndex, currentAttempts, results: challengeResults,
    isComplete: allChallengesComplete,
    mergeResult,
  } = progress;
  /** A checked answer stays closed until Try again or the next item. */
  const blocked = progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  const {
    submitResult: submitEvaluation,
    submittedResult,
    hasSubmitted,
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

  // In-item levers (`coordinateGraphLevers.ts`), keyed by the session item they were pulled on, and the easier item a
  // simplify lever put on screen in its place.
  const grid = useMemo(() => ({ gridMin, gridMax }), [gridMin, gridMax]);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<CoordinateGraphChallenge | null>(null);
  const sessionChallenge = challenges[currentIndex] ?? null;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const challenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice item. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);

  // --- Local state ---
  const [hoverPt, setHoverPt] = useState<GridPoint | null>(null);
  const [placedPt, setPlacedPt] = useState<GridPoint | null>(null);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);

  /** A fresh item or Try again: nothing placed or chosen, the feedback gone. */
  const resetWork = () => { setFeedback(null); setPlacedPt(null); setSelectedOpt(null); setHoverPt(null); };
  openItem.current = (_index, retry) => {
    // Try again on a practice item keeps it; a fresh item (or the full item back after practice) drops it.
    if (!retry) setPractice(null);
    resetWork();
  };

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
    const yInt = interceptOf(challenge);
    return {
      slope, yInt,
      lineY1: challenge.y1 + slope * (gridMin - challenge.x1),
      lineY2: challenge.y1 + slope * (gridMax - challenge.x1),
    };
  }, [challenge, gridMin, gridMax]);

  // --- Answer handling. Every tap that grades commits, right or wrong. ---
  const handleAnswer = useCallback((correct: boolean, work: { placed: GridPoint | null; chosen: number | null }) => {
    if (feedback || !challenge) return;
    const attempts = currentAttempts + 1;
    if (correct) SoundManager.playCorrect();
    else SoundManager.playIncorrect();
    setFeedback(correct ? 'correct' : 'incorrect');
    // The checked gesture (counts the attempt, records the verdict), then this primitive's own fields.
    progress.commitCheck(describeCoordinateWork(challenge, work), correct, coordinateMiss(challenge, work));
    // An easier practice item (a simplify lever) is not the session's challenge: it records nothing of its own.
    if (correct && !isPracticeItem(challenge)) {
      mergeResult({
        challengeId: challenge.id, correct: true,
        score: currentAttempts === 0 ? 100 : 50,
        attempts, challengeType: challenge.type,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback, challenge, currentAttempts, mergeResult, progress.commitCheck]);

  // Under a lesson's evaluation provider only: the scored session, whose item scores count corrections and whose
  // evidence carries each wrong check's named miss.
  const submittedRef = useRef(false);
  finish.current = (result) => {
    if (hasSubmitted || submittedRef.current || challenges.length === 0 || progress.recordsEvaluation === false) return;
    submittedRef.current = true;
    const types = challenges.map(c => c.type);
    submitEvaluation(result.passed, result.accuracy, {
      type: 'coordinate-graph',
      totalCorrect: result.solvedCount,
      totalChallenges: challenges.length,
      challengeTypes: types.filter((t, i) => types.indexOf(t) === i),
      averageAttempts: result.attemptsCount / challenges.length,
      durationMs: elapsedMs,
    }, { challengeResults: result.outcomes, learningResponses: result.learningResponses,
      teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
    undefined, result.diagnosisEvidence);
  };

  // --- SVG interaction handlers ---
  const pointerCrossing = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const p = viewBoxPoint(svg, clientX, clientY);
    return p ? nearestCrossing(gridMin, gridMax, p.x, p.y) : null;
  }, [gridMin, gridMax]);

  const handlePlace = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!challenge || challenge.type !== 'plot_point' || feedback || learnerBlocked()) return;
    const pt = pointerCrossing(e.clientX, e.clientY);
    if (!pt) return;
    SoundManager.snap();
    setPlacedPt(pt);
    handleAnswer(plotCorrect(challenge, pt), { placed: pt, chosen: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge, feedback, pointerCrossing, handleAnswer]);

  const handleSvgMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!challenge || challenge.type !== 'plot_point' || feedback || learnerBlocked()) return;
    setHoverPt(pointerCrossing(e.clientX, e.clientY));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge, feedback, pointerCrossing]);

  const handleOptionClick = useCallback((idx: number) => {
    if (!challenge || feedback || learnerBlocked()) return;
    SoundManager.select();
    setSelectedOpt(idx);
    handleAnswer(choiceCorrect(challenge, idx), { placed: null, chosen: idx });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge, feedback, handleAnswer]);

  // --- What the tutor and the observer are shown, republished every render. ---
  useLayoutEffect(() => {
    if (!challenge || !sessionChallenge) return;
    const scene = workspaceScene(challenge, { gridMin, gridMax, work: { placed: placedPt, chosen: selectedOpt } });
    const levers = practice ? [] : COORDINATE_LEVERS.declare(sessionChallenge, grid, pulledLevers);
    const published = leverScene(scene, {
      support: practice ? '' : COORDINATE_LEVERS.support(sessionChallenge, grid),
      onScreen: practice ? '' : COORDINATE_LEVERS.onScreen(sessionChallenge, grid, pulledLevers),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = COORDINATE_LEVERS.simpler(sessionChallenge, grid, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetWork();
          return { practice: coordinateGraphBoss.assignment!(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetWork(); },
    };
  });

  // --- Render helpers ---
  // Map the option FSM onto the kit's grading-state language. The right choice is never shown after a wrong one.
  const optionState = (idx: number): AnswerChoiceState => {
    if (!feedback || selectedOpt === null) return 'idle';
    const isSelected = idx === selectedOpt;
    if (feedback === 'correct' && isSelected) return 'correct';
    if (feedback === 'incorrect' && isSelected) return 'incorrect';
    return 'dimmed';
  };

  if (!challenges || challenges.length === 0) {
    return (
      <LuminaCard className="max-w-2xl mx-auto">
        <LuminaCardContent className="p-8 text-center">
          <p className="text-slate-400">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const overallScore = challengeResults.length > 0
    ? Math.round(challengeResults.filter(r => r.correct).length / challengeResults.length * 100)
    : 0;
  const plotOpen = !!challenge && challenge.type === 'plot_point' && !feedback && !blocked;

  // Lever pictures (`coordinateGraphLevers.ts`), on the session item only; each also turns on the aid a tier withheld.
  const everyLine = leverOn(EVERY_LINE);
  const axisNumbers = !!challenge && (challenge.showAxisLabels !== false || everyLine);
  const tickStep = everyLine ? 1 : labelStep;
  const dropLines = !!challenge?.showDropLines || leverOn(DROP_LINES);
  const unitSteps = leverOn(UNIT_STEPS);
  const triangle = !!challenge && (challenge.showRiseRunGuides !== false || leverOn(RISE_RUN) || unitSteps);
  const crossingMarker = !!challenge && (challenge.showInterceptMarker !== false || leverOn(CROSSING));
  const modelPoint = sessionChallenge && leverOn(MODEL_POINT) ? pointModel(sessionChallenge, grid) : null;
  const modelLine = sessionChallenge && leverOn(MODEL_LINE) ? lineModel(sessionChallenge) : null;
  const quadrants = [
    { x: gridMax / 2, y: gridMax / 2, text: '(+, +)' }, { x: gridMin / 2, y: gridMax / 2, text: '(−, +)' },
    { x: gridMin / 2, y: gridMin / 2, text: '(−, −)' }, { x: gridMax / 2, y: gridMin / 2, text: '(+, −)' },
  ].filter(q => q.x !== 0 && q.y !== 0);

  return (
    <div className={`w-full max-w-3xl mx-auto my-12 animate-fade-in ${className || ''}`}>
      {/* Summary panel when complete */}
      {allChallengesComplete && phaseResults.length > 0 && (
        <PhaseSummaryPanel
          phases={phaseResults}
          overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? overallScore)}
          durationMs={elapsedMs}
          heading="Challenge Complete!"
          celebrationMessage="Great work on the coordinate plane!"
          className="mb-6"
        />
      )}

      {/* Active challenge */}
      {!allChallengesComplete && challenge && (
        <LuminaCard>
          <LuminaCardContent className="p-6 space-y-5">
            {/* Header + progress */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-100">{data.title}</h3>
                {data.description && <p className="text-sm text-slate-400 mt-0.5">{data.description}</p>}
              </div>
              <LuminaChallengeCounter current={currentIndex + 1} total={challenges.length} accent="blue" />
            </div>

            {/* Progress bar */}
            <LuminaProgress value={(currentIndex / challenges.length) * 100} accent="blue" />

            {/* Instruction */}
            <div className="flex items-center justify-center gap-2 py-2">
              {practice && <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>}
              <p className="text-base text-slate-200 font-medium text-center">{challenge.instruction}</p>
            </div>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the plane and the choices
                as one region. */}
            <PipDock />
            <PipWorkspace className="space-y-5">
            {/* SVG Coordinate Plane — bespoke interaction surface */}
            <div className="flex justify-center">
              <svg
                ref={svgRef}
                data-pip-object="plane"
                viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
                className="w-full max-w-md rounded-xl bg-slate-950/60 border border-white/5"
                style={{ cursor: plotOpen ? 'crosshair' : 'default', touchAction: 'none' }}
                onPointerUp={handlePlace}
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

                {/* Axis labels (withdrawn at the hard tier; every line numbered by the every_line lever) */}
                {axisNumbers && gridValues.filter(v => v !== 0 && v % tickStep === 0).map(v => (
                  <React.Fragment key={`l-${v}`}>
                    <text x={toX(v)} y={toY(0) + 14} fill="white" fillOpacity={0.35}
                      fontSize={9} textAnchor="middle" fontFamily="ui-monospace, monospace">{v}</text>
                    <text x={toX(0) - 8} y={toY(v) + 3} fill="white" fillOpacity={0.35}
                      fontSize={9} textAnchor="end" fontFamily="ui-monospace, monospace">{v}</text>
                  </React.Fragment>
                ))}

                {/* axis_guide lever: each axis's direction and each quadrant's sign pattern. No number. */}
                {leverOn(AXIS_GUIDE) && gridMin <= 0 && gridMax >= 0 && (
                  <g data-lever="axis-guide" fill="#a78bfa" fontSize={11} fontFamily="ui-sans-serif, system-ui">
                    <text x={SVG_SIZE - PAD} y={toY(0) - 8} textAnchor="end">x: across →</text>
                    <text x={toX(0) + 8} y={PAD + 12}>y: up ↑ or down ↓</text>
                    {quadrants.map(q => (
                      <text key={q.text} x={toX(q.x)} y={toY(q.y)} textAnchor="middle" fillOpacity={0.55} fontSize={14}
                        fontFamily="ui-monospace, monospace">{q.text}</text>
                    ))}
                  </g>
                )}

                {/* ===== Challenge-specific overlays ===== */}
                <g clipPath="url(#grid-clip)">

                  {/* model_point lever: a different example point, with its moves from the origin */}
                  {modelPoint && (
                    <g data-lever="model-point">
                      <path d={`M ${toX(0)} ${toY(0)} L ${toX(modelPoint.point.x)} ${toY(0)} L ${toX(modelPoint.point.x)} ${toY(modelPoint.point.y)}`}
                        fill="none" stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 3" />
                      <circle cx={toX(modelPoint.point.x)} cy={toY(modelPoint.point.y)} r={6} fill="#a78bfa" stroke="white" strokeWidth={1.5} />
                      <text x={toX(modelPoint.point.x)} y={toY(modelPoint.point.y) + (modelPoint.point.y >= 0 ? -12 : 20)} fill="#c4b5fd"
                        fontSize={10} textAnchor="middle" fontFamily="ui-monospace, monospace">
                        Example ({modelPoint.point.x}, {modelPoint.point.y})
                      </text>
                    </g>
                  )}

                  {/* plot_point: hover ghost */}
                  {challenge.type === 'plot_point' && hoverPt && plotOpen && (
                    <>
                      <circle cx={toX(hoverPt.x)} cy={toY(hoverPt.y)} r={7}
                        fill="#fbbf24" fillOpacity={0.25} stroke="#fbbf24" strokeOpacity={0.5} strokeWidth={1.5} />
                      {/* Live coordinate echo — withdrawn at medium/hard */}
                      {challenge.showHoverReadout !== false && (
                        <text x={toX(hoverPt.x)} y={toY(hoverPt.y) - 12} fill="white" fillOpacity={0.5}
                          fontSize={10} textAnchor="middle" fontFamily="ui-monospace, monospace">
                          ({hoverPt.x}, {hoverPt.y})
                        </text>
                      )}
                    </>
                  )}

                  {/* plot_point: placed point */}
                  {challenge.type === 'plot_point' && placedPt && (
                    <circle data-pip-object="placed-point" cx={toX(placedPt.x)} cy={toY(placedPt.y)} r={7}
                      fill={feedback === 'correct' ? '#4ade80' : '#f87171'}
                      stroke="white" strokeWidth={2} />
                  )}

                  {/* read_point: displayed point */}
                  {challenge.type === 'read_point' && (
                    <>
                      {/* Easy-tier drop-lines: connect the point straight to each axis */}
                      {dropLines && (
                        <>
                          <line x1={toX(challenge.x1)} y1={toY(challenge.y1)} x2={toX(challenge.x1)} y2={toY(0)}
                            stroke="#60a5fa" strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="4 3" />
                          <line x1={toX(challenge.x1)} y1={toY(challenge.y1)} x2={toX(0)} y2={toY(challenge.y1)}
                            stroke="#60a5fa" strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="4 3" />
                        </>
                      )}
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
                      {/* Rise/run triangle — withdrawn at the hard tier; drawn again by the rise_run_triangle and unit_steps levers */}
                      {triangle && (
                        <>
                          {/* unit_steps lever: a tick at every grid step along each leg, no number */}
                          {unitSteps && (
                            <g data-lever="unit-steps" stroke="#fde68a" strokeWidth={1.5}>
                              {Array.from({ length: Math.abs(challenge.x2 - challenge.x1) + 1 }, (_, i) => challenge.x1 + i * Math.sign(challenge.x2 - challenge.x1)).map(x => (
                                <line key={`rx-${x}`} x1={toX(x)} y1={toY(challenge.y1) - 5} x2={toX(x)} y2={toY(challenge.y1) + 5} />
                              ))}
                              {Array.from({ length: Math.abs(challenge.y2 - challenge.y1) + 1 }, (_, i) => challenge.y1 + i * Math.sign(challenge.y2 - challenge.y1)).map(y => (
                                <line key={`ry-${y}`} x1={toX(challenge.x2) - 5} y1={toY(y)} x2={toX(challenge.x2) + 5} y2={toY(y)} />
                              ))}
                            </g>
                          )}
                          {/* Run (horizontal) */}
                          <line x1={toX(challenge.x1)} y1={toY(challenge.y1)}
                            x2={toX(challenge.x2)} y2={toY(challenge.y1)}
                            stroke="#34d399" strokeWidth={1.5} strokeDasharray="6 4" />
                          {/* Rise (vertical) */}
                          <line x1={toX(challenge.x2)} y1={toY(challenge.y1)}
                            x2={toX(challenge.x2)} y2={toY(challenge.y2)}
                            stroke="#f472b6" strokeWidth={1.5} strokeDasharray="6 4" />
                        </>
                      )}
                      {/* Points */}
                      <circle cx={toX(challenge.x1)} cy={toY(challenge.y1)} r={6}
                        fill="#60a5fa" stroke="white" strokeWidth={2} />
                      <circle cx={toX(challenge.x2)} cy={toY(challenge.y2)} r={6}
                        fill="#60a5fa" stroke="white" strokeWidth={2} />
                      {/* Point labels — withdrawn at the hard tier */}
                      {challenge.showPointLabels !== false && (
                        <>
                          <text x={toX(challenge.x1)} y={toY(challenge.y1) - 12} fill="white"
                            fontSize={10} textAnchor="middle" fontFamily="ui-monospace, monospace">
                            ({challenge.x1}, {challenge.y1})
                          </text>
                          <text x={toX(challenge.x2)} y={toY(challenge.y2) - 12} fill="white"
                            fontSize={10} textAnchor="middle" fontFamily="ui-monospace, monospace">
                            ({challenge.x2}, {challenge.y2})
                          </text>
                        </>
                      )}
                      {/* Rise/run numeric labels — withdrawn at medium/hard */}
                      {challenge.showRiseRunGuides !== false && challenge.showRiseRunLabels !== false && !unitSteps && (
                        <>
                          <text x={toX(challenge.x2) + 12}
                            y={(toY(challenge.y1) + toY(challenge.y2)) / 2 + 4}
                            fill="#f472b6" fontSize={10} fontFamily="ui-monospace, monospace">
                            rise = {challenge.y2 - challenge.y1}
                          </text>
                          <text x={(toX(challenge.x1) + toX(challenge.x2)) / 2}
                            y={toY(challenge.y1) + 16}
                            fill="#34d399" fontSize={10} textAnchor="middle" fontFamily="ui-monospace, monospace">
                            run = {challenge.x2 - challenge.x1}
                          </text>
                        </>
                      )}
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
                      {/* Y-intercept marker — withdrawn at the hard tier */}
                      {crossingMarker && (
                        <>
                          <circle cx={toX(0)} cy={toY(interceptData.yInt)} r={10}
                            fill="#fbbf24" fillOpacity={0.15} stroke="#fbbf24" strokeOpacity={0.4} strokeWidth={1}>
                            <animate attributeName="r" values="10;14;10" dur="2s" repeatCount="indefinite" />
                          </circle>
                          <circle cx={toX(0)} cy={toY(interceptData.yInt)} r={7}
                            fill="#fbbf24" stroke="white" strokeWidth={2} />
                          <text x={toX(0)} y={toY(interceptData.yInt) + 4} fill="white"
                            fontSize={11} textAnchor="middle" fontWeight="bold">?</text>
                        </>
                      )}
                      {/* Equation label — withdrawn at medium/hard. Drawn with the intercept masked: the generated
                          label (y = mx + b) states the answer. */}
                      {challenge.equationLabel && challenge.showEquationLabel !== false && (
                        <text x={toX(gridMax) - 8} y={toY(interceptData.lineY2) - 8}
                          fill="white" fillOpacity={0.6} fontSize={11} textAnchor="end"
                          fontFamily="ui-monospace, monospace">
                          {maskedEquation(challenge)}
                        </text>
                      )}
                    </>
                  )}
                </g>
              </svg>
            </div>

            {/* Lever frames and the worked line (`coordinateGraphLevers.ts`) */}
            {leverOn(SLOPE_FRAME) && (
              <p data-lever="slope-frame" className="rounded-lg border border-violet-500/30 bg-slate-950/40 p-3 text-center text-sm text-violet-200">
                slope = rise ÷ run = (change in y, up or down) ÷ (change in x, left to right). A line that falls from left to right has a negative slope.
              </p>
            )}
            {leverOn(INTERCEPT_FRAME) && (
              <p data-lever="intercept-frame" className="rounded-lg border border-violet-500/30 bg-slate-950/40 p-3 text-center text-sm text-violet-200">
                The y-intercept is the y-value where the line meets the y-axis (the up-and-down axis), where x is zero. It is not the slope, and not where the line meets the x-axis.
              </p>
            )}
            {modelLine && <LineModelInset model={modelLine} />}

            {/* plot_point click instruction */}
            {plotOpen && (
              <p className="text-xs text-center text-slate-500">Click on the grid to plot your answer</p>
            )}

            {/* MC Options */}
            {challenge.type !== 'plot_point' && (
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map(i => {
                  const text = [challenge.option0, challenge.option1, challenge.option2, challenge.option3][i];
                  if (!text) return null;
                  return (
                    <LuminaAnswerChoice
                      key={i}
                      state={optionState(i)}
                      disabled={!!feedback || blocked}
                      className="p-3 text-center text-sm font-mono"
                      onClick={() => handleOptionClick(i)}
                    >
                      {text}
                    </LuminaAnswerChoice>
                  );
                })}
              </div>
            )}

            </PipWorkspace>

            {/* Feedback */}
            {feedback === 'correct' && (
              <LuminaFeedbackCard status="correct">Correct! Well done.</LuminaFeedbackCard>
            )}
            {/* Try again is the shell's and the hint is the tutor's. */}
            {feedback === 'incorrect' && (
              <LuminaFeedbackCard status="incorrect">Not quite.</LuminaFeedbackCard>
            )}
          </LuminaCardContent>
        </LuminaCard>
      )}
    </div>
  );
};

// Taught only on the workspace: an unbound mount shows the shared "needs the tutor" card.
const CoordinateGraph = withWorkspaceOnly<CoordinateGraphProps>('coordinate-graph', CoordinateGraphSurface, props => props.data.title);

export default CoordinateGraph;
