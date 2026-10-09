'use client';

/**
 * MeasureLab — the K weight-and-capacity bench (K.MD.A.1, K.MD.A.2).
 *
 * A living simulation, not a picture with a question under it: the component
 * owns the physics and the child owns the objects. A pan balance TIPS because
 * of what the child put on it; a container FILLS because the child poured a cup
 * in. Gemini supplies only the vocabulary — what the things are called and how
 * the question is worded. Every weight and every capacity is code-owned and
 * never printed, so the only way to know is to test it.
 *
 * The four things a five-year-old does here:
 *   balance_predict  — say which is heavier, then put both on the scale and watch
 *   capacity_predict — say which holds more, then pour both full and count
 *   pour_count       — fill one container with cups and say how many it took
 *   order_capacity   — put three identical jars in order, least to most
 *
 * PREDICTION BEFORE TEST is the pedagogy, so it is also the mechanic: the
 * prediction modes will not run the test until the child has committed, and the
 * score is the prediction, never the pouring.
 *
 * Shared teaching workspace (W1, plain shape): `measureLabWorkspace.ts` holds the
 * assignment, the scene, the learner's work in words and the named miss. Under a
 * live runtime the tutor owns the item; the activity's own check commits through
 * `progress.commitCheck`, and the runtime owns Try again and Next.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPrompt,
  LuminaButton,
  LuminaSectionLabel,
  LuminaChallengeCounter,
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaFeedbackCard,
  answerStateClass,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type MeasureLabMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { measureLabPipPose } from '../../../pip/measureLabPipPose';
import { useSpeechScope } from '../../../pip/useSpeechScope';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { describeMeasureWork, measureMiss, workspaceAssignment, workspaceScene, type MeasureView } from './measureLabWorkspace';
import {
  CUP_LINES_LEVER, DOWN_MODEL, DOWN_MODEL_LEVER, LEVEL_LINES, LEVEL_LINES_LEVER, ORDER_STEPS, ORDER_STEPS_LEVER,
  POURED_SHELF_LEVER, PRACTICE_NOTE, leverFacts, measureLabLevers, practiceItem, shelfCups,
} from './measureLabLevers';

// ---------------------------------------------------------------------------
// Public types (mirrored by the generator)
// ---------------------------------------------------------------------------

export type MeasureLabChallengeType =
  | 'balance_predict'
  | 'capacity_predict'
  | 'pour_count'
  | 'order_capacity';

export interface MeasureObject {
  id: string;
  /** What the child hears it called ("the apple"). */
  name: string;
  emoji: string;
  /** Code-owned and NEVER rendered — the pan's tip is the only evidence. */
  weight: number;
}

export type ContainerShape = 'tall' | 'wide' | 'round';

export interface MeasureContainer {
  id: string;
  name: string;
  shape: ContainerShape;
  /** In cups. Code-owned and NEVER rendered. */
  capacity: number;
  /** order_capacity only: how much is already in it, in cups. */
  filled?: number;
  /** Drawn size, 1 by default. Only an easier practice item (`easy_pair`) draws one larger and one smaller. */
  scale?: number;
}

export interface MeasureLabChallenge {
  id: string;
  type: MeasureLabChallengeType;
  prompt: string;
  hint?: string;

  /** balance_predict */
  left?: MeasureObject;
  right?: MeasureObject;

  /** pour_count */
  container?: MeasureContainer;

  /** capacity_predict */
  containerA?: MeasureContainer;
  containerB?: MeasureContainer;

  /** order_capacity — three identical jars, different amounts inside. */
  containers?: MeasureContainer[];

  /** The unit the child pours with ("cups"). */
  unitName?: string;
  unitEmoji?: string;

  // ── Answer key, derived in code ──
  /** balance_predict / capacity_predict: the id that wins. */
  expectedChoice?: string;
  /** pour_count: how many units fill it. */
  expectedCount?: number;
  /** pour_count: the numbers offered. */
  options?: number[];
  /** order_capacity: container ids, least → most. */
  expectedOrder?: string[];
}

export interface MeasureLabData {
  title: string;
  description: string;
  /** 3-6 challenges. Required — one session walks them in order. */
  challenges: MeasureLabChallenge[];
  /** Session task identity. Widened by /add-eval-modes. */
  challengeType: MeasureLabChallengeType;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MeasureLabMetrics>) => void;
}

interface MeasureLabProps {
  data: MeasureLabData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ---------------------------------------------------------------------------
// The bench — SVG geometry the simulation runs on
// ---------------------------------------------------------------------------

const STAGE_W = 620;
const STAGE_H = 300;

/** Beam tilt in degrees, from the weight difference. Capped so the pans stay
 *  on the bench; the SIGN is the answer the child reads, not the angle. */
const tiltFor = (leftW: number, rightW: number): number => {
  const diff = rightW - leftW;
  if (diff === 0) return 0;
  const magnitude = Math.min(14, 4 + Math.abs(diff) * 2);
  return diff > 0 ? magnitude : -magnitude;
};

/** Outline of a container, by shape. Sizes are SHAPE, never capacity — a tall
 *  narrow jug holding less than a wide bowl is the whole point of the compare. */
const shapeBox = (shape: ContainerShape, scale = 1): { w: number; h: number } => {
  const box = shape === 'tall' ? { w: 62, h: 150 } : shape === 'wide' ? { w: 128, h: 78 } : { w: 96, h: 104 };
  return { w: Math.round(box.w * scale), h: Math.round(box.h * scale) };
};

interface ContainerViewProps {
  container: MeasureContainer;
  /** Units currently in it. */
  poured: number;
  /** Units it takes to fill — used only for the fill fraction. */
  capacity: number;
  selected?: boolean;
  state?: 'idle' | 'selected' | 'correct' | 'incorrect';
  badge?: string;
  onClick?: () => void;
  /** Pip's registry id for this container; presentation only. */
  pipId?: string;
  pipRef?: (element: Element | null) => void;
  /** level_lines lever: even lines across the glass, as fractions of its height (the same on every jar). */
  levelLines?: readonly number[];
}

const ContainerView: React.FC<ContainerViewProps> = ({
  container, poured, capacity, state = 'idle', badge, onClick, pipId, pipRef, levelLines,
}) => {
  const { w, h } = shapeBox(container.shape, container.scale);
  const fillFrac = capacity > 0 ? Math.max(0, Math.min(1, poured / capacity)) : 0;
  const fillH = Math.round(h * fillFrac);
  const rounded = container.shape === 'round' ? 28 : 8;

  return (
    <button
      ref={pipRef}
      data-pip-object={pipId}
      type="button"
      disabled={!onClick}
      onClick={onClick}
      // Named by the container alone, so the badge (cups poured, or the tap order) is not what is pressed.
      aria-label={container.name}
      className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition ${answerStateClass(state)} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <svg width={w + 16} height={h + 16} viewBox={`0 0 ${w + 16} ${h + 16}`} aria-hidden>
        {/* the water, drawn from the bottom up */}
        <rect
          x={8}
          y={8 + (h - fillH)}
          width={w}
          height={fillH}
          rx={Math.min(rounded, fillH / 2)}
          fill="rgba(56,189,248,0.55)"
          className="transition-all duration-500"
        />
        {levelLines?.map((f) => (
          <line key={f} data-lever="level-line" x1={8} x2={8 + w} y1={8 + h - Math.round(h * f)} y2={8 + h - Math.round(h * f)}
            stroke="rgba(255,255,255,0.28)" strokeWidth={1} strokeDasharray="4 3" />
        ))}
        {/* the glass */}
        <rect
          x={8} y={8} width={w} height={h} rx={rounded}
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={2.5}
        />
      </svg>
      <span className="text-sm text-slate-200">{container.name}</span>
      {badge ? <span className="text-xs font-mono text-cyan-300">{badge}</span> : null}
    </button>
  );
};

/** cup_lines / poured_shelf levers: a shelf with one cup picture per cup, in a row. No number. */
const CupShelf: React.FC<{ id: string; cups: number; emoji: string }> = ({ id, cups, emoji }) => (
  <div data-lever="cup-shelf" data-container={id} className="flex flex-col items-center gap-1">
    <div className="flex min-h-8 flex-wrap justify-center gap-1">
      {Array.from({ length: cups }).map((_, i) => (
        <span key={i} data-lever="shelf-cup" aria-hidden className="text-2xl leading-none">{emoji}</span>
      ))}
    </div>
    <div className="h-1.5 w-40 rounded-full bg-white/25" />
  </div>
);

/** down_model lever: a small model balance, fixed blocks, never the item's objects. */
const DownModel: React.FC = () => {
  const block = (x: number, y: number, k: number) => <rect key={k} x={x} y={y} width={16} height={14} rx={2} fill="rgba(251,191,36,0.85)" />;
  const leftDown = DOWN_MODEL.downSide === 'left';
  const ly = leftDown ? 62 : 38, ry = leftDown ? 38 : 62;
  return (
    <svg data-lever="down-model" aria-label="a model balance" width={200} height={100} viewBox="0 0 200 100">
      <rect x={96} y={40} width={8} height={50} rx={3} fill="rgba(255,255,255,0.15)" />
      <line x1={40} y1={ly - 14} x2={160} y2={ry - 14} stroke="rgba(148,163,184,0.85)" strokeWidth={5} strokeLinecap="round" />
      <rect x={18} y={ly} width={44} height={6} rx={3} fill="rgba(148,163,184,0.7)" />
      <rect x={138} y={ry} width={44} height={6} rx={3} fill="rgba(148,163,184,0.7)" />
      {Array.from({ length: leftDown ? DOWN_MODEL.heavyBlocks : DOWN_MODEL.lightBlocks }).map((_, k) => block(32, ly - 14 * (k + 1), k))}
      {Array.from({ length: leftDown ? DOWN_MODEL.lightBlocks : DOWN_MODEL.heavyBlocks }).map((_, k) => block(152, ry - 14 * (k + 1), k))}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Phase config
// ---------------------------------------------------------------------------

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  balance_predict: { label: 'Heavier', icon: '⚖️', accentColor: 'amber' },
  capacity_predict: { label: 'Holds More', icon: '🫗', accentColor: 'cyan' },
  pour_count: { label: 'How Many Cups', icon: '🥤', accentColor: 'emerald' },
  order_capacity: { label: 'Least to Most', icon: '📶', accentColor: 'purple' },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const MeasureLabSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  MeasureLabProps & { tutorOwned: boolean; useController: (options: ProgressOptions<MeasureLabChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `measure-lab-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // On the workspace path the runtime moves the index; a fresh item and Try again clear the bench (bound below).
  const openItem = useRef<(retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (c) => c.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (_index, retry) => openItem.current(retry),
    onFinished: (result) => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete, advance } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = tutorOwned && progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;
  // The activity's own check is the workspace's checked gesture. A ref, so the delayed verdicts read the latest.
  const commitCheck = useRef(progress.commitCheck);
  commitCheck.current = progress.commitCheck;

  const sessionChallenge = challenges[currentIndex] ?? null;
  // In-item levers (`measureLabLevers.ts`), keyed by the session item they were pulled on, and the easier item a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<MeasureLabChallenge | null>(null);
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice item. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);

  const phaseResults = usePhaseResults({
    challenges,
    results,
    isComplete,
    getChallengeType: (c) => c.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  const evaluation = usePrimitiveEvaluation<MeasureLabMetrics>({
    primitiveType: 'measure-lab',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Per-challenge interaction state ───────────────────────────────────────
  /** The prediction the child committed BEFORE testing (id), or null. */
  const [prediction, setPrediction] = useState<string | null>(null);
  /** Objects placed on the balance pans, by side. */
  const [placed, setPlaced] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  /** Units poured, per container id. */
  const [poured, setPoured] = useState<Record<string, number>>({});
  /** order_capacity: the order the child has tapped so far. */
  const [order, setOrder] = useState<string[]>([]);
  /** pour_count: the number the child chose. */
  const [chosenCount, setChosenCount] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [showHint, setShowHint] = useState(false);
  const recordedRef = useRef(false);
  const completeFiredRef = useRef(false);
  /**
   * The beam-settling delay, owned by a ref rather than by an effect.
   *
   * The first version put the `setTimeout` inside a `useEffect` keyed on
   * [bothPlaced, prediction, currentChallenge, feedback, submit]. `submit` is
   * rebuilt whenever the tutor hook re-renders, so any re-render inside the
   * 900ms window would have cleared the pending timer and swallowed the verdict.
   * It was not observed failing in the Chrome drive, but a delay that any
   * unrelated re-render can cancel is a race waiting for a slower machine, so
   * the timer is owned here where nothing else can reach it. The capacity pour
   * uses the same timer.
   */
  const verdictTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Always the latest `submit`, so the timer never fires a stale closure. */
  const submitRef = useRef<(correct: boolean, work?: Partial<MeasureView>) => void>(() => {});

  /** The bench blank: a fresh challenge, Try again on the workspace path, or the scripted Try again. */
  const clearWork = useCallback(() => {
    setPrediction(null);
    setPlaced({ left: false, right: false });
    setPoured({});
    setOrder([]);
    setChosenCount(null);
    setFeedback(null);
    setShowHint(false);
    recordedRef.current = false;
    if (verdictTimerRef.current) { clearTimeout(verdictTimerRef.current); verdictTimerRef.current = null; }
  }, []);
  // A fresh item (or the full item back after a practice item) drops the practice; Try again keeps it.
  openItem.current = (retry) => { clearWork(); if (!retry) setPractice(null); };

  // Per-challenge reset — every slot above that depends on the active challenge.
  useEffect(() => {
    if (!currentChallenge) return;
    clearWork();
  }, [currentChallenge?.id, clearWork]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (verdictTimerRef.current) clearTimeout(verdictTimerRef.current);
  }, []);

  /** The learner's work as the check reads it, as of the last render. */
  const view: MeasureView = { prediction, placed, poured, order, chosenCount };
  const viewRef = useRef(view);
  viewRef.current = view;

  // ── AI tutoring ───────────────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    title,
    challengeType: currentChallenge?.type,
    currentChallengeIndex: currentIndex,
    totalChallenges: challenges.length,
    currentPrompt: currentChallenge?.prompt,
    attemptNumber: currentAttempts,
    // Stimulus only — no weight, no capacity, no answer.
    objects: currentChallenge?.left && currentChallenge?.right
      ? `${currentChallenge.left.name} and ${currentChallenge.right.name}`
      : undefined,
    containers: [
      currentChallenge?.containerA?.name,
      currentChallenge?.containerB?.name,
      ...(currentChallenge?.containers ?? []).map((c) => c.name),
      currentChallenge?.container?.name,
    ].filter(Boolean).join(', '),
    unitName: currentChallenge?.unitName,
  }), [title, currentChallenge, currentIndex, challenges.length, currentAttempts]);

  // The scripted tutor's context and cues: off on the workspace path, and its cues send nothing there.
  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'measure-lab',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'K',
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  const introducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || introducedRef.current || !currentChallenge) return;
    introducedRef.current = true;
    sendText(
      `[ACTIVITY_START] ${title}. ${challenges.length} measuring challenges. First: ${currentChallenge.prompt}`,
      { silent: true },
    );
  }, [isConnected, currentChallenge, challenges.length, title, sendText]);

  const announcedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isConnected || !currentChallenge || !introducedRef.current) return;
    if (announcedRef.current === null) { announcedRef.current = currentChallenge.id; return; }
    if (announcedRef.current === currentChallenge.id) return;
    announcedRef.current = currentChallenge.id;
    sendText(
      `[NEXT_ITEM] Challenge ${currentIndex + 1} of ${challenges.length}. ${currentChallenge.prompt}`,
      { silent: true },
    );
  }, [isConnected, currentChallenge, currentIndex, challenges.length, sendText]);

  // ── Judging ───────────────────────────────────────────────────────────────
  // `work` carries what the triggering tap changed before it renders; the rest is read from the last render.
  const submit = useCallback((correct: boolean, work: Partial<MeasureView> = {}) => {
    if (!currentChallenge || recordedRef.current) return;
    const seen = { ...viewRef.current, ...work };
    // Counts the attempt and records a correct result on both paths; on the workspace path it is the checked gesture.
    commitCheck.current(describeMeasureWork(currentChallenge, seen), correct,
      correct ? undefined : measureMiss(currentChallenge, seen));
    setFeedback(correct ? 'correct' : 'incorrect');
    if (!correct) {
      SoundManager.playIncorrect();
      setShowHint(true);
      sendText(
        `[ANSWER_INCORRECT] ${currentChallenge.type}: the child's answer was wrong on attempt ${currentAttempts + 1}. Give one short hint — never the answer.`,
        { silent: true },
      );
      return;
    }
    SoundManager.playCorrect();
    recordedRef.current = true;
    sendText(
      `[ANSWER_CORRECT] ${currentChallenge.type} solved on attempt ${currentAttempts + 1}. Congratulate briefly.`,
      { silent: true },
    );
  }, [currentChallenge, currentAttempts, sendText]);

  submitRef.current = submit;

  // ── Session complete ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isComplete || completeFiredRef.current || challenges.length === 0) return;
    completeFiredRef.current = true;

    const totalAttempts = results.reduce((s, r) => s + r.attempts, 0);
    const correctCount = results.filter((r) => r.correct).length;
    const firstTryCount = results.filter((r) => r.correct && r.attempts === 1).length;
    const perChallenge = (r: typeof results[number]) =>
      r.correct ? Math.max(20, 100 - (r.attempts - 1) * 20) : 0;
    const overallAccuracy = Math.round(
      results.reduce((s, r) => s + perChallenge(r), 0) / Math.max(1, results.length),
    );

    const metrics: MeasureLabMetrics = {
      type: 'measure-lab',
      challengeType: challenges[0].type,
      totalChallenges: challenges.length,
      correctCount,
      attemptsCount: totalAttempts,
      firstTryCount,
      hintsViewed: results.filter((r) => r.attempts > 1).length,
      overallAccuracy,
      averageAttemptsPerChallenge:
        Math.round((totalAttempts / Math.max(1, results.length)) * 10) / 10,
    };

    sendText(
      `[ALL_COMPLETE] Phase scores: ${phaseResults.map((p) => `${p.label} ${p.score}%`).join(', ')}. Overall ${overallAccuracy}%. Celebrate the measuring work.`,
      { silent: true },
    );

    // The workspace path submits the scored session from `onFinished` (below), not this tally.
    if (!evaluation.hasSubmitted && !tutorOwned) {
      evaluation.submitResult(correctCount === challenges.length, overallAccuracy, metrics, {
        studentWork: {
          challengeCount: challenges.length,
          prompts: challenges.map((c) => c.prompt),
        },
      });
    }
  }, [isComplete, results, challenges, phaseResults, sendText, evaluation, tutorOwned]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (evaluation.hasSubmitted || challenges.length === 0) return;
    const metrics: MeasureLabMetrics = {
      type: 'measure-lab',
      challengeType: challenges[0].type,
      totalChallenges: challenges.length,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      hintsViewed: challenges.length - result.firstTryCount,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / challenges.length) * 10) / 10,
    };
    evaluation.submitResult(result.passed, result.accuracy, metrics,
      { studentWork: { challengeCount: challenges.length, prompts: challenges.map((c) => c.prompt) },
        challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── Interactions ──────────────────────────────────────────────────────────
  const bothPlaced = placed.left && placed.right;

  const handlePredict = (id: string) => {
    if (feedback !== null || learnerBlocked()) return;
    SoundManager.select();
    setPrediction(id);
  };

  const handlePlace = (side: 'left' | 'right') => {
    if (!currentChallenge || prediction === null || feedback !== null || learnerBlocked()) return;
    if (placed[side]) return;
    SoundManager.tick();
    const next = { ...placed, [side]: true };
    setPlaced(next);

    // The balance settling IS the verdict, and what it grades is the prediction
    // the child already committed to. The wait lets the beam finish tipping, so
    // the child sees the evidence before the words.
    if (next.left && next.right && !recordedRef.current) {
      const expected = currentChallenge.expectedChoice;
      if (verdictTimerRef.current) clearTimeout(verdictTimerRef.current);
      verdictTimerRef.current = setTimeout(() => {
        verdictTimerRef.current = null;
        submitRef.current(prediction === expected);
      }, 900);
    }
  };

  const handlePour = (containerId: string, capacity: number) => {
    if (!currentChallenge || feedback === 'correct' || learnerBlocked()) return;
    const already = poured[containerId] ?? 0;
    if (already >= capacity) return; // it is full — pouring more would spill
    SoundManager.tick();
    setPoured((prev) => ({ ...prev, [containerId]: already + 1 }));
  };

  const handleCapacityTest = () => {
    if (!currentChallenge?.containerA || !currentChallenge?.containerB) return;
    if (prediction === null || feedback !== null || learnerBlocked()) return;
    const a = currentChallenge.containerA;
    const b = currentChallenge.containerB;
    const expected = currentChallenge.expectedChoice;
    setPoured({ [a.id]: a.capacity, [b.id]: b.capacity });
    // The balance's ref-owned settle: the child sees both levels before the verdict.
    if (verdictTimerRef.current) clearTimeout(verdictTimerRef.current);
    verdictTimerRef.current = setTimeout(() => {
      verdictTimerRef.current = null;
      submitRef.current(prediction === expected);
    }, 900);
  };

  const handleOrderTap = (containerId: string) => {
    if (!currentChallenge || feedback === 'correct' || learnerBlocked()) return;
    if (order.includes(containerId)) {
      setOrder((prev) => prev.filter((id) => id !== containerId));
      return;
    }
    SoundManager.tick();
    const next = [...order, containerId];
    setOrder(next);
    if (next.length === (currentChallenge.containers?.length ?? 0)) {
      const expected = currentChallenge.expectedOrder ?? [];
      submit(next.length === expected.length && next.every((id, i) => id === expected[i]), { order: next });
    }
  };

  const handleCountChoice = (n: number) => {
    if (!currentChallenge || feedback === 'correct' || learnerBlocked()) return;
    setChosenCount(n);
    submit(n === currentChallenge.expectedCount, { chosenCount: n });
  };

  const advanceToNext = () => { advance(); };

  // Workspace path: what the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation. Every mode declares its levers.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, viewRef.current);
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers);
    const levers = practice ? [] : measureLabLevers(sessionChallenge, pulledLevers);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}), ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceItem(sessionChallenge);
          if (!easier) return 'This item has no easier version; try a help lever.';
          // The practice item and the full item share no work: both start blank.
          setLeverState(pulled); clearWork(); setPractice(easier);
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { clearWork(); setPractice(null); },
    };
  });

  // ── Pip shared surface ────────────────────────────────────────────────────
  // A projection of this challenge's own state, the tutor's speech on it, and
  // the child's last touch; Pip never predicts, pours, places, or advances.
  // Tutor audio counts only while the tutor is on this block and began on this challenge.
  const pip = usePipTargets(currentChallenge?.id ?? null, feedback !== 'correct');
  const tutorSpeaking = isAudioPlaying && activePrimitiveId === resolvedInstanceId;
  const speechOnChallenge = useSpeechScope(currentChallenge?.id ?? null, tutorSpeaking);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentChallenge || isComplete || evaluation.hasSubmitted) return null;
    const { type, id, container, containerA, containerB } = currentChallenge;
    const pouredBoth = !!containerA && !!containerB
      && poured[containerA.id] !== undefined && poured[containerB.id] !== undefined;
    const targets = pip.targets();
    const pose = measureLabPipPose({
      running: true, preparing: false, currentSolved: feedback === 'correct', revealHeld: false,
      judging: feedback === null
        && ((type === 'balance_predict' && bothPlaced) || (type === 'capacity_predict' && pouredBoth)),
      tutorSpeaking, cueMatchesItem: !tutorSpeaking || speechOnChallenge,
      type,
      committed: type === 'pour_count'
        ? !!container && (poured[container.id] ?? 0) >= container.capacity
        : prediction !== null,
      visibleIds: targets.map((target) => target.id),
      lastTouchedId: pip.lastTouchedId,
    });
    return { instanceId: resolvedInstanceId, scopeId: id, label: 'Measure lab', dock: pip.dock.current, targets, pose };
  });

  // ── Empty state ───────────────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <div className={`w-full max-w-4xl mx-auto my-12 ${className || ''}`}>
        <LuminaCard className="rounded-3xl p-6 text-center">
          <p className="text-slate-300">No measuring challenges available.</p>
        </LuminaCard>
      </div>
    );
  }

  const ch = currentChallenge;
  const unitEmoji = ch?.unitEmoji || '🥤';
  const unitName = ch?.unitName || 'cups';
  /** The prediction modes run their test once; after a wrong guess the scripted path offers Try again. */
  const scriptedRetry = !tutorOwned && feedback === 'incorrect'
    && (ch?.type === 'balance_predict' || ch?.type === 'capacity_predict');

  return (
    <div className={`w-full max-w-4xl mx-auto my-12 animate-fade-in ${className || ''}`}>
      <LuminaCard className="rounded-3xl">
        <LuminaCardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
              <p className="text-slate-400 text-sm mt-1">{description}</p>
            </div>
            {ch ? (
              <LuminaBadge accent="cyan" className="text-xs">
                {PHASE_TYPE_CONFIG[ch.type]?.icon} {PHASE_TYPE_CONFIG[ch.type]?.label}
              </LuminaBadge>
            ) : null}
          </div>
        </LuminaCardHeader>

        <LuminaCardContent className="space-y-5">
          {!isComplete && challenges.length > 1 ? (
            <div className="flex justify-center">
              <LuminaChallengeCounter
                current={Math.min(currentIndex + 1, challenges.length)}
                total={challenges.length}
                variant="dots"
                accent="cyan"
              />
            </div>
          ) : null}

          {!isComplete && ch ? (
            <>
              {practice ? <div className="text-center text-xs text-amber-300" data-practice>Practice</div> : null}
              <LuminaPrompt accent="cyan" center>
                <span className="text-base">{ch.prompt}</span>
              </LuminaPrompt>

              {/* Pip's dock sits above the bench: every cue target (the pair, the
                  scale, the containers, the cups) is below it and is a region, so
                  no pointer line reaches toward a single choice. */}
              {pipStore && <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
                className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />}

              {/* ── balance_predict ───────────────────────────────────────── */}
              {ch.type === 'balance_predict' && ch.left && ch.right ? (
                <div className="space-y-4">
                  {prediction === null ? (
                    <div className="space-y-2">
                      <div className="text-center">
                        <LuminaSectionLabel accent="amber" size="sm">
                          First — which one do you think is heavier?
                        </LuminaSectionLabel>
                      </div>
                      <div ref={pip.ref('objects')} data-pip-object="objects" className="flex justify-center gap-4">
                        {[ch.left, ch.right].map((obj) => (
                          <button
                            key={obj.id}
                            type="button"
                            aria-label={obj.name}
                            onClick={() => { pip.look('scale'); handlePredict(obj.id); }}
                            className={`flex flex-col items-center gap-1 rounded-2xl border px-6 py-4 transition ${answerStateClass('idle')}`}
                          >
                            <span className="text-4xl leading-none">{obj.emoji}</span>
                            <span className="text-sm text-slate-200">{obj.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <LuminaSectionLabel accent="amber" size="sm">
                        Now put them both on the scale
                      </LuminaSectionLabel>
                    </div>
                  )}

                  {/* The bench. The beam tips because of what is on it. */}
                  <div className="flex justify-center">
                    <svg ref={pip.ref('scale')} data-pip-object="scale"
                      width={STAGE_W} height={STAGE_H} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} className="max-w-full h-auto">
                      {(() => {
                        const cx = STAGE_W / 2;
                        const beamY = 96;
                        const arm = 170;
                        const tilt = bothPlaced ? tiltFor(ch.left!.weight, ch.right!.weight) : 0;
                        const dy = Math.tan((tilt * Math.PI) / 180) * arm;
                        return (
                          <g>
                            {/* stand */}
                            <rect x={cx - 8} y={beamY} width={16} height={150} rx={6} fill="rgba(255,255,255,0.12)" />
                            <rect x={cx - 70} y={STAGE_H - 40} width={140} height={14} rx={7} fill="rgba(255,255,255,0.16)" />
                            {/* beam */}
                            <g className="transition-transform duration-700" style={{ transformOrigin: `${cx}px ${beamY}px`, transform: `rotate(${tilt}deg)` }}>
                              <rect x={cx - arm} y={beamY - 5} width={arm * 2} height={10} rx={5} fill="rgba(148,163,184,0.85)" />
                            </g>
                            {/* pans, hanging level from the beam ends */}
                            {([['left', -1], ['right', 1]] as const).map(([side, dir]) => {
                              const px = cx + dir * arm;
                              const py = beamY + dir * dy + 60;
                              const obj = side === 'left' ? ch.left! : ch.right!;
                              const on = placed[side];
                              return (
                                <g key={side} className="transition-transform duration-700" style={{ transform: `translateY(${dir * dy}px)` }}>
                                  <line x1={px} y1={beamY} x2={px} y2={py - 12} stroke="rgba(148,163,184,0.6)" strokeWidth={2} />
                                  <rect x={px - 52} y={py - 12} width={104} height={12} rx={6} fill="rgba(148,163,184,0.7)" />
                                  {on ? (
                                    <text x={px} y={py - 30} textAnchor="middle" fontSize={34} className="select-none">
                                      {obj.emoji}
                                    </text>
                                  ) : null}
                                </g>
                              );
                            })}
                          </g>
                        );
                      })()}
                    </svg>
                  </div>

                  {leverOn(DOWN_MODEL_LEVER) ? <div className="flex justify-center"><DownModel /></div> : null}

                  {prediction !== null && !bothPlaced ? (
                    <div className="flex justify-center gap-4">
                      {(['left', 'right'] as const).map((side) => {
                        const obj = side === 'left' ? ch.left! : ch.right!;
                        if (placed[side]) return null;
                        return (
                          <button
                            key={side}
                            type="button"
                            aria-label={`Put ${obj.name} on`}
                            onClick={() => { pip.look('scale'); handlePlace(side); }}
                            className={`flex flex-col items-center gap-1 rounded-2xl border px-6 py-3 transition ${answerStateClass('idle')}`}
                          >
                            <span className="text-4xl leading-none">{obj.emoji}</span>
                            <span className="text-xs text-slate-300">Put {obj.name} on</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* ── capacity_predict ──────────────────────────────────────── */}
              {ch.type === 'capacity_predict' && ch.containerA && ch.containerB ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <LuminaSectionLabel accent="cyan" size="sm">
                      {prediction === null
                        ? 'First — which one do you think holds more?'
                        : `Now fill them both with ${unitName} and see`}
                    </LuminaSectionLabel>
                  </div>
                  <div ref={pip.ref('containers')} data-pip-object="containers" className="flex flex-wrap justify-center items-end gap-4 sm:gap-8">
                    {[ch.containerA, ch.containerB].map((c) => (
                      <div key={c.id} className="flex flex-col items-center gap-2">
                      <ContainerView
                        pipId={`container-${c.id}`}
                        pipRef={pip.ref(`container-${c.id}`)}
                        container={c}
                        poured={poured[c.id] ?? 0}
                        capacity={c.capacity}
                        state={prediction === c.id ? 'selected' : 'idle'}
                        badge={poured[c.id] ? `${poured[c.id]} ${unitName}` : undefined}
                        onClick={prediction === null && feedback === null
                          ? () => { pip.look(`container-${c.id}`); handlePredict(c.id); }
                          : undefined}
                      />
                      {leverOn(CUP_LINES_LEVER)
                        ? <CupShelf id={c.id} cups={shelfCups(ch, view)[c.id] ?? 0} emoji={unitEmoji} /> : null}
                      </div>
                    ))}
                  </div>
                  {prediction !== null && !Object.keys(poured).length ? (
                    <div className="flex justify-center">
                      <LuminaActionButton action="check"
                        onClick={() => { pip.look('containers'); handleCapacityTest(); }}>
                        Pour {unitName} into both
                      </LuminaActionButton>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* ── pour_count ────────────────────────────────────────────── */}
              {ch.type === 'pour_count' && ch.container ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <ContainerView
                      pipId="container"
                      pipRef={pip.ref('container')}
                      container={ch.container}
                      poured={poured[ch.container.id] ?? 0}
                      capacity={ch.container.capacity}
                    />
                  </div>
                  {leverOn(POURED_SHELF_LEVER) ? (
                    <div className="flex justify-center">
                      <CupShelf id={ch.container.id} cups={shelfCups(ch, view)[ch.container.id] ?? 0} emoji={unitEmoji} />
                    </div>
                  ) : null}
                  <div className="flex flex-col items-center gap-2">
                    <LuminaSectionLabel accent="emerald" size="sm">
                      Tap a {unitName.replace(/s$/, '')} to pour it in
                    </LuminaSectionLabel>
                    <div ref={pip.ref('cups')} data-pip-object="cups" className="flex flex-wrap justify-center gap-2">
                      {Array.from({ length: ch.container.capacity + 2 }).map((_, i) => {
                        const used = i < (poured[ch.container!.id] ?? 0);
                        // A poured cup is spent: drawn faded, no longer a control, so every "Pour one in" is a live one.
                        return used ? (
                          <span key={i} aria-hidden className="text-3xl leading-none opacity-20">{unitEmoji}</span>
                        ) : (
                          <button
                            key={i}
                            type="button"
                            disabled={feedback === 'correct'}
                            onClick={() => { pip.look('container'); handlePour(ch.container!.id, ch.container!.capacity); }}
                            className="text-3xl leading-none transition hover:scale-110"
                            aria-label="Pour one in"
                          >
                            {unitEmoji}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {(poured[ch.container.id] ?? 0) >= ch.container.capacity ? (
                    <div className="space-y-2">
                      <p className="text-center text-sm text-cyan-300">It is full! How many did it take?</p>
                      <div className="flex flex-wrap justify-center gap-3">
                        {(ch.options ?? []).map((opt) => (
                          <LuminaAnswerChoice
                            key={opt}
                            ref={pip.ref(`count-${opt}`)}
                            data-pip-object={`count-${opt}`}
                            state={
                              chosenCount === opt
                                ? (feedback === 'correct' ? 'correct' : 'incorrect')
                                : feedback === 'correct' && opt === ch.expectedCount ? 'correct' : 'idle'
                            }
                            disabled={feedback === 'correct'}
                            onClick={() => { pip.look(`count-${opt}`); handleCountChoice(opt); }}
                            className="w-auto min-w-[64px] pl-5 pr-9 py-3 text-center font-mono text-lg"
                          >
                            {opt}
                          </LuminaAnswerChoice>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* ── order_capacity ────────────────────────────────────────── */}
              {ch.type === 'order_capacity' && ch.containers ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <LuminaSectionLabel accent="purple" size="sm">
                      Tap them in order — the least first
                    </LuminaSectionLabel>
                  </div>
                  <div ref={pip.ref('containers')} data-pip-object="containers" className="flex flex-wrap justify-center items-end gap-4 sm:gap-6">
                    {ch.containers.map((c) => {
                      const pos = order.indexOf(c.id);
                      return (
                        <ContainerView
                          key={c.id}
                          pipId={`container-${c.id}`}
                          pipRef={pip.ref(`container-${c.id}`)}
                          container={c}
                          poured={c.filled ?? 0}
                          capacity={c.capacity}
                          state={pos >= 0 ? 'selected' : 'idle'}
                          badge={pos >= 0 ? `#${pos + 1}` : undefined}
                          levelLines={leverOn(LEVEL_LINES_LEVER) ? LEVEL_LINES : undefined}
                          onClick={feedback === 'correct' ? undefined : () => { pip.look(`container-${c.id}`); handleOrderTap(c.id); }}
                        />
                      );
                    })}
                  </div>
                  {leverOn(ORDER_STEPS_LEVER) ? (
                    <div data-lever="order-steps" aria-label="the way the order goes" className="flex items-end justify-center gap-2">
                      {ORDER_STEPS.map((hgt) => <div key={hgt} className="w-6 rounded-t bg-purple-300/60" style={{ height: hgt * 1.4 }} />)}
                    </div>
                  ) : null}
                  {order.length > 0 && feedback !== 'correct' ? (
                    <div className="flex justify-center">
                      <LuminaButton tone="ghost" onClick={() => { if (!learnerBlocked()) setOrder([]); }}>Start over</LuminaButton>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {feedback ? (
                <LuminaFeedbackCard
                  status={feedback === 'correct' ? 'correct' : 'incorrect'}
                  label={feedback === 'correct' ? 'Nice work' : 'Not quite'}
                  teachingNote={feedback === 'incorrect' && showHint ? ch.hint : undefined}
                >
                  {feedback === 'correct' ? 'You tested it and you were right.' : 'Look at what happened, then try again.'}
                </LuminaFeedbackCard>
              ) : null}

              {scriptedRetry ? (
                <div className="text-center">
                  <LuminaActionButton action="retry" onClick={clearWork}>Try again</LuminaActionButton>
                </div>
              ) : null}

              {feedback === 'correct' && !tutorOwned ? (
                <div className="text-center">
                  <LuminaActionButton action="next" onClick={advanceToNext}>
                    {currentIndex + 1 < challenges.length ? 'Next →' : 'Finish'}
                  </LuminaActionButton>
                </div>
              ) : null}
            </>
          ) : null}

          {isComplete && phaseResults.length > 0 ? (
            <PhaseSummaryPanel
              phases={phaseResults}
              overallScore={evaluation.submittedResult?.score}
              durationMs={evaluation.elapsedMs}
              heading="Measuring Complete!"
              celebrationMessage={`You tested ${challenges.length} ${challenges.length === 1 ? 'thing' : 'things'} yourself!`}
              className="mt-4"
            />
          ) : null}
        </LuminaCardContent>
      </LuminaCard>
    </div>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const MeasureLab = withWorkspaceController<MeasureLabProps, ProgressOptions<MeasureLabChallenge>, Progress>(
  'measure-lab', MeasureLabSurface, useScriptedProgress, useWorkspaceProgressFor('measure-lab'));

export default MeasureLab;
