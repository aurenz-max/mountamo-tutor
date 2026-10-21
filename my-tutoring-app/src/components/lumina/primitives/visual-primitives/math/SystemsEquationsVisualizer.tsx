'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaPanel,
  LuminaInput,
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
  describeSystemsWork, enteredPoint, methodSteps, solutionCorrect, systemsMiss, workspaceScene,
  type SolutionPoint,
} from './systemsEquationsWorkspace';
import {
  AXIS_GUIDE, CHECK_BOTH, EVERY_LINE, LINE_UP, METHOD_STEPS, SET_EQUAL, SYSTEMS_LEVERS, WORKED_EXAMPLE,
  checkRows, isPracticeItem, lineUpColumns, setEqualLine, workedExample, type SystemsLeverCtx,
  type WorkedExample,
} from './systemsEquationsLevers';
import { systemsEquationsBoss } from './systemsEquations.boss';

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
  /** The method on this item's equations; never the solution. Not rendered: with the tutor, hints are the tutor's. */
  hint: string;

  // ── Within-mode support-tier scaffolds (display-only; set by the generator when
  //    a tier is present). The checker NEVER reads these. The exact intersection
  //    point is the answer, so it is never marked pre-answer at any tier. ──
  /** The item's support tier (generator-stamped); the lever set reads it to say when the model lever comes. */
  supportTier?: 'easy' | 'medium' | 'hard';
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
  /** Within-mode support tier ('easy' | 'medium' | 'hard'), present only when the generator applied one. Each
   *  challenge carries it too (`supportTier`), which is what the lever set reads. */
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

/** The worked_example lever on a graph item: two different lines on a small plane, their crossing marked and named. */
const GraphExampleInset: React.FC<{ example: WorkedExample }> = ({ example }) => {
  const S = 160, P = 12, D = S - 2 * P, lo = -5, hi = 5;
  const tx = (x: number) => P + ((x - lo) / (hi - lo)) * D;
  const ty = (y: number) => P + ((hi - y) / (hi - lo)) * D;
  const line = (eq: { slope: number; yIntercept: number }, color: string) => (
    <line x1={tx(lo)} y1={ty(eq.slope * lo + eq.yIntercept)} x2={tx(hi)} y2={ty(eq.slope * hi + eq.yIntercept)}
      stroke={color} strokeWidth={2} />
  );
  return (
    <figure data-lever="worked-example" className="mx-auto w-64 rounded-lg border border-white/10 bg-slate-900/40 p-2 text-center">
      <figcaption className="mb-1 text-xs uppercase tracking-wider text-slate-400">Worked example</figcaption>
      <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-40">
        <clipPath id="systems-example-clip"><rect x={P} y={P} width={D} height={D} /></clipPath>
        {Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map(v => (
          <React.Fragment key={v}>
            <line x1={tx(v)} y1={P} x2={tx(v)} y2={S - P} stroke="white" strokeOpacity={v === 0 ? 0.5 : 0.08} />
            <line x1={P} y1={ty(v)} x2={S - P} y2={ty(v)} stroke="white" strokeOpacity={v === 0 ? 0.5 : 0.08} />
          </React.Fragment>
        ))}
        <g clipPath="url(#systems-example-clip)">
          {line(example.equationA, '#a78bfa')}
          {line(example.equationB, '#f0abfc')}
        </g>
        <circle cx={tx(example.solution.x)} cy={ty(example.solution.y)} r={4} fill="none" stroke="#fde68a" strokeWidth={2} />
      </svg>
      <p className="mt-1 font-mono text-xs text-violet-200">{example.steps.join(' ')}</p>
    </figure>
  );
};

// ============================================================================
// Component
// ============================================================================

interface SystemsEquationsVisualizerProps {
  data: SystemsEquationsVisualizerData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const useSystemsProgress = useWorkspaceProgressFor('systems-equations-visualizer');
const PRACTICE_NOTE = 'An easier practice system is on screen in place of the item. It is not graded; the full item comes back after it.';

const SystemsEquationsVisualizerSurface = ({ data, className, runtimePlanItemId }: SystemsEquationsVisualizerProps) => {
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

  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceIdRef = useRef(instanceId || `systems-equations-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Challenge progression: the teaching workspace owns it.
  // -------------------------------------------------------------------------
  /** Bound below, once the setters exist; the progress hook calls them only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useSystemsProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: systemsEquationsBoss.assignment!,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    mergeResult,
  } = progress;
  /** A checked answer stays closed until Try again or the next item. */
  const blocked = progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

  // In-item levers (`SYSTEMS_LEVERS`), keyed by the session item they were pulled on, with the learner's last checked
  // pair on it (the check_both lever reads it), and the easier item a simplify lever put on screen.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[]; lastTried: SolutionPoint | null }>(
    { item: '', pulled: [], lastTried: null });
  const [practice, setPractice] = useState<SystemsEquationsChallenge | null>(null);
  const sessionChallenge = challenges[currentChallengeIndex] ?? null;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const onSessionItem = leverState.item === sessionChallenge?.id;
  const pulledLevers = onSessionItem ? leverState.pulled : [];
  const lastTried = onSessionItem ? leverState.lastTried : null;
  const leverCtx: SystemsLeverCtx = { lastTried };
  /** A runtime pull on the session item; never drawn on a practice item. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  const challengeType = currentChallenge?.type ?? 'graph';

  // -------------------------------------------------------------------------
  // Per-challenge UI state
  // -------------------------------------------------------------------------
  const [xInput, setXInput] = useState('');
  const [yInput, setYInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  /** The item on screen was checked right: its lines and crossing are drawn. */
  const [solved, setSolved] = useState(false);

  const submittedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /** A fresh item or Try again: the boxes empty, the feedback gone. */
  const resetWork = () => {
    setXInput(''); setYInput(''); setFeedback(''); setFeedbackType(''); setSolved(false);
  };
  openItem.current = (_index, retry) => {
    // Try again on a practice item keeps it; a fresh item (or the full item back after practice) drops it.
    if (!retry) setPractice(null);
    resetWork();
  };

  /** The lines are drawn on a graph item, and on any item once it is solved. The algebra modes keep them hidden. */
  const revealLines = challengeType === 'graph' || solved;

  // Canvas constants
  const padding = 50;
  const canvasWidth = 600;
  const canvasHeight = 540;

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

  /** Axis numbers: on unless the hard tier withheld them, and on again with the every_line lever. */
  const axisNumbers = !!currentChallenge && (currentChallenge.showAxisLabels !== false || leverOn(EVERY_LINE));

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

      // Numbered tick labels — perception aid, withdrawn at the hard support tier.
      if (axisNumbers) {
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

      // ── Support-tier (easy) FUZZY crossing-region cue — never the exact point, never coordinates;
      //    withdrawn the instant the student answers correctly. ──
      if (currentChallenge.showIntersectionRegion && !solved) {
        const center = graphToCanvas(currentChallenge.expectedX, currentChallenge.expectedY);
        const unit = Math.abs(graphToCanvas(1, 0).x - graphToCanvas(0, 0).x);
        const radius = unit * 1.6; // deliberately fuzzy — covers several integer points
        const grad = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
        grad.addColorStop(0, 'rgba(250, 204, 21, 0.28)');
        grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Intersection marker — shown only once correct.
      if (solved) {
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
      ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Solve algebraically — the graph reveals after you check.', canvasWidth / 2, canvasHeight / 2);
    }
  }, [currentChallenge, xRange, yRange, gridSpacing, showAxes, showGrid, revealLines, solved, axisNumbers, graphToCanvas]);

  // -------------------------------------------------------------------------
  // Evaluation
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
  // Check (single, used by all 3 modes — the answer is always (x, y)). Every graded check commits, right or wrong.
  // -------------------------------------------------------------------------
  const handleCheck = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation || solved || learnerBlocked()) return;
    const work = { x: xInput, y: yInput };
    if (!xInput.trim() || !yInput.trim()) {
      SoundManager.invalid();
      setFeedback('Enter both x and y values.');
      setFeedbackType('error');
      return;
    }
    const point = enteredPoint(work);
    if (!point) {
      SoundManager.invalid();
      setFeedback('Enter numbers for x and y.');
      setFeedbackType('error');
      return;
    }
    const correct = solutionCorrect(currentChallenge, point);
    const attempts = currentAttempts + 1;
    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Correct! The solution is (${currentChallenge.expectedX}, ${currentChallenge.expectedY}).`);
      setFeedbackType('success');
      setSolved(true);
    } else {
      SoundManager.playIncorrect();
      setFeedback('Not quite.');
      setFeedbackType('error');
      // The check_both lever reads the last checked pair on the session item.
      if (!practice && sessionChallenge) {
        setLeverState(s => ({ item: sessionChallenge.id, pulled: s.item === sessionChallenge.id ? s.pulled : [], lastTried: point }));
      }
    }
    // The checked gesture (counts the attempt, records the verdict), then this primitive's own score.
    progress.commitCheck(describeSystemsWork(work), correct, correct ? undefined : systemsMiss(currentChallenge, point));
    // An easier practice item (a simplify lever) is not the session's challenge: it records nothing of its own.
    if (correct && !isPracticeItem(currentChallenge)) {
      mergeResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts,
        score: Math.max(20, 100 - (attempts - 1) * 20),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentChallenge, sessionChallenge, practice, hasSubmittedEvaluation, solved, xInput, yInput,
    currentAttempts, mergeResult, progress.commitCheck,
  ]);

  // Under a lesson's evaluation provider only: the scored session, whose item scores count corrections and whose
  // evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmittedEvaluation || submittedRef.current || challenges.length === 0 || progress.recordsEvaluation === false) return;
    submittedRef.current = true;
    const total = challenges.length;
    submitEvaluation(result.passed, result.accuracy, {
      type: 'systems-equations-visualizer',
      challengeType: (challenges[0]?.type ?? 'graph') as SystemsEquationsMetrics['challengeType'],
      totalChallenges: total,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.outcomes.filter(o => o.solved && o.attempts === 1).length,
      hintsViewed: 0,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / total) * 10) / 10,
    }, { challengeResults: result.outcomes, learningResponses: result.learningResponses,
      teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
    undefined, result.diagnosisEvidence);
  };

  // -------------------------------------------------------------------------
  // What the tutor and the observer are shown, republished every render.
  // -------------------------------------------------------------------------
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, { xRange, yRange, work: { x: xInput, y: yInput }, linesShown: revealLines });
    const levers = practice ? [] : SYSTEMS_LEVERS.declare(sessionChallenge, leverCtx, pulledLevers);
    const published = leverScene(scene, {
      support: practice ? '' : SYSTEMS_LEVERS.support(sessionChallenge, leverCtx),
      onScreen: practice ? '' : SYSTEMS_LEVERS.onScreen(sessionChallenge, leverCtx, pulledLevers),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id], lastTried };
        if (lever.kind === 'simplify') {
          const easier = SYSTEMS_LEVERS.simpler(sessionChallenge, leverCtx, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetWork();
          return { practice: systemsEquationsBoss.assignment!(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetWork(); },
    };
  });

  // -------------------------------------------------------------------------
  // Derived UI state
  // -------------------------------------------------------------------------
  const isCurrentComplete = solved || (!practice && !!sessionChallenge
    && challengeResults.some(r => r.challengeId === sessionChallenge.id && r.correct));

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challengeResults.length === 0) return 0;
    return Math.round(
      challengeResults.reduce(
        (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
        0,
      ) / challengeResults.length,
    );
  }, [allChallengesComplete, challengeResults]);

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
  const inputsOpen = !isCurrentComplete && !blocked;

  // Lever pictures (`systemsEquationsLevers.ts`), on the session item only.
  const example = sessionChallenge && leverOn(WORKED_EXAMPLE) ? workedExample(sessionChallenge) : null;
  const columns = sessionChallenge && leverOn(LINE_UP) ? lineUpColumns(sessionChallenge) : null;
  const firstStep = sessionChallenge && leverOn(SET_EQUAL) ? setEqualLine(sessionChallenge) : null;
  const checked = sessionChallenge && leverOn(CHECK_BOTH) && lastTried ? checkRows(sessionChallenge, lastTried) : null;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="blue" className="text-xs">{modeLabel}</LuminaBadge>
            {practice && <LuminaBadge accent="amber" className="text-xs uppercase tracking-wider">Practice</LuminaBadge>}
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

        {/* set_equal lever: substitution's first step, not solved */}
        {firstStep && (
          <p data-lever="set-equal" className="rounded-lg border border-violet-500/30 bg-slate-950/40 p-3 text-center font-mono text-sm text-violet-200">
            Set the right-hand sides equal: {firstStep}
          </p>
        )}

        {/* line_up lever: elimination's equations in x, y and constant columns */}
        {columns && (
          <div data-lever="line-up" className="rounded-lg border border-violet-500/30 bg-slate-950/40 p-3 text-sm text-violet-200">
            <table className="mx-auto font-mono">
              <thead>
                <tr className="text-xs text-slate-400"><th className="px-3" /><th className="px-3">x</th><th className="px-3">y</th><th className="px-3">=</th></tr>
              </thead>
              <tbody>
                {columns.rows.map(r => (
                  <tr key={r.label}><td className="px-3 text-slate-400">{r.label}</td><td className="px-3 text-center">{r.a}</td>
                    <td className="px-3 text-center">{r.b}</td><td className="px-3 text-center">{r.c}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-center text-xs">{columns.note}</p>
          </div>
        )}

        {/* method_steps lever (the easy tier opens the steps itself, below) */}
        {leverOn(METHOD_STEPS) && (
          <p data-lever="method-steps" className="rounded-lg border border-violet-500/30 bg-slate-950/40 p-3 text-center text-sm text-violet-200">
            {methodSteps(challengeType)}
          </p>
        )}

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

        {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the graph and the answer boxes
            as one region. */}
        {!allChallengesComplete && <PipDock />}
        <PipWorkspace className="space-y-4">
          {/* Canvas — bespoke interaction surface. The algebra modes keep the lines hidden until solved:
              showing them would let the learner read the solution off the crossing. */}
          <LuminaPanel accent="blue" className="p-3 rounded-2xl">
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className="rounded-lg w-full"
              style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}`, backgroundColor: 'rgba(15, 23, 42, 0.6)' }}
            />
          </LuminaPanel>

          {/* axis_guide lever: how a crossing is read. No number. */}
          {leverOn(AXIS_GUIDE) && (
            <p data-lever="axis-guide" className="rounded-lg border border-violet-500/30 bg-slate-950/40 p-3 text-center text-sm text-violet-200">
              From the origin, read x across first (left is negative), then y up or down (down is negative). The solution is
              where the two lines meet, not where a line meets an axis.
            </p>
          )}

          {example && (example.form === 'slope-intercept' && challengeType === 'graph'
            ? <GraphExampleInset example={example} />
            : (
              <figure data-lever="worked-example" className="mx-auto max-w-md rounded-lg border border-white/10 bg-slate-900/40 p-3">
                <figcaption className="mb-1 text-center text-xs uppercase tracking-wider text-slate-400">Worked example</figcaption>
                <ol className="space-y-0.5 font-mono text-xs text-violet-200">
                  {example.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </figure>
            ))}

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
                    aria-label="x"
                    value={xInput}
                    disabled={!inputsOpen}
                    onChange={(e) => { if (!learnerBlocked()) setXInput(e.target.value); }}
                    className="w-20 px-2 py-1.5 text-center"
                    placeholder="?"
                    onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                  />
                </label>
                <label className="flex items-center gap-2 text-slate-300 text-sm">
                  <span className="text-emerald-300 font-mono">y =</span>
                  <LuminaInput
                    type="number"
                    aria-label="y"
                    value={yInput}
                    disabled={!inputsOpen}
                    onChange={(e) => { if (!learnerBlocked()) setYInput(e.target.value); }}
                    className="w-20 px-2 py-1.5 text-center"
                    placeholder="?"
                    onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                  />
                </label>
                <LuminaActionButton action="check" onClick={handleCheck} disabled={!inputsOpen}>
                  Check
                </LuminaActionButton>
              </div>
              {/* check_both lever: the learner's last checked pair in each equation; no computed value. */}
              {checked && lastTried && (
                <ul data-lever="check-both" className="space-y-1 text-center font-mono text-xs text-violet-200">
                  {checked.map(r => (
                    <li key={r.label}>
                      ({lastTried.x}, {lastTried.y}) in {r.display}: {r.works ? 'works ✓' : 'does not work ✗'}
                    </li>
                  ))}
                </ul>
              )}
            </LuminaPanel>
          )}
        </PipWorkspace>

        {/* Feedback */}
        {feedback && (
          <LuminaFeedbackCard
            status={feedbackType === 'success' ? 'correct' : feedbackType === 'error' ? 'incorrect' : 'insight'}
          >
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Method step hint — easy support tier (and a practice item). Coordinate-free, never the answer. */}
        {currentChallenge.showStepHint && currentChallenge.stepHint && !isCurrentComplete && (
          <LuminaHintDisclosure defaultOpen label="Method steps">
            {currentChallenge.stepHint}
          </LuminaHintDisclosure>
        )}

        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localOverallScore)}
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

// Taught only on the workspace: an unbound mount shows the shared "needs the tutor" card.
const SystemsEquationsVisualizer = withWorkspaceOnly<SystemsEquationsVisualizerProps>('systems-equations-visualizer',
  SystemsEquationsVisualizerSurface, props => props.data.title);

export default SystemsEquationsVisualizer;
