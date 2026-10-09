'use client';

/**
 * Light & Shadow Lab: a sun on an arc, an object, and its shadow; every item is one tapped choice and Check.
 *
 * Shared teaching workspace (W1, plain shape): `lightShadowWorkspace.ts` holds the choices, the assignment,
 * the scene, the learner's work in words and the named miss. Under a live runtime the tutor owns the item;
 * the activity's own check commits through `progress.commitCheck`, and the runtime owns Try again and Next.
 *
 * What each mode hides while it is open, because it is the answer: predict draws no shadow, apply draws no
 * sun and no clock, and no mode prints the "Shadow: <length>, <direction>" readout before a right answer.
 */

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { LightShadowLabMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  describeShadowWork, hidesShadow, hidesSun, keyOption, markAt, normalizeTime, openingSun, shadowCorrect, shadowHint,
  shadowLengthOf, shadowMiss, shadowOptions, timeMarks, workspaceAssignment, workspaceScene,
} from './lightShadowWorkspace';
import {
  HEIGHT_MODEL, HEIGHT_MODEL_LEVER, PRACTICE_NOTE, SHADOW_ZONES_LEVER, SIDE_MODEL, SIDE_MODEL_LEVER, leverFacts,
  lightShadowLevers, practiceItem,
} from './lightShadowLevers';

// =============================================================================
// Data Interface — Single Source of Truth
// =============================================================================

export type ShadowDirection = 'E' | 'W' | 'N';
export type RelativeLength = 'short' | 'medium' | 'long';
export type ChallengeType = 'observe' | 'predict' | 'measure' | 'apply';
export type LabTheme = 'playground' | 'sundial' | 'science_lab';

export interface ShadowObject {
  type: 'stick_figure' | 'tree' | 'flagpole' | 'building';
  height: number; // relative height units (1-5)
  label?: string;
}

export interface SunPosition {
  time: string;       // e.g., "7:00 AM", "12:00 PM"
  altitude: number;   // degrees above horizon (0-90)
  azimuth: number;    // degrees from east (0=east, 90=south, 180=west)
}

export interface ShadowChallenge {
  id: string;
  type: ChallengeType;
  instruction: string;
  sunPosition: SunPosition;
  correctShadow: {
    direction: ShadowDirection;
    relativeLength: RelativeLength;
  };
  /** Generator distractors and hint: no longer drawn. The choices and the hint are built in code
   *  (`shadowOptions`, `shadowHint`), because the key was the only option in its own format and the hint
   *  often stated the shadow. */
  distractor0?: string;
  distractor1?: string;
  distractor2?: string;
  hint?: string;

  // ── Within-mode support scaffolds (config.difficulty) — DISPLAY-ONLY, never
  //    read by the answer checker. Set by the generator per challenge; absent =
  //    no tier applied (legacy default behavior). See gemini-light-shadow-lab.ts. ──
  /** Was a live "Shadow: <length>, <direction>" readout while working. It printed the answer's words, so the
   *  readout now shows only after a right answer, whatever this says. */
  showLiveShadowReadout?: boolean;
  /** Show the dashed sun-path arc guide. */
  showSunPath?: boolean;
  /** Show the E/W ground direction labels. */
  showDirectionLabels?: boolean;
  /** An easier practice item (`easy_sun`, `easy_shadow`) carries its own two choices; built in code otherwise. */
  choices?: string[];
  /** Help levers drawn from the start (the support tier's starting position). Not a pull: nothing is recorded. */
  startLevers?: string[];
}

export interface LightShadowLabData {
  title: string;
  description: string;
  theme: LabTheme;
  gradeLevel: 'K' | '1' | '2' | '3' | '4' | '5';

  objects: ShadowObject[];
  sunPositions: SunPosition[];
  challenges: ShadowChallenge[];

  /** Within-mode support tier ('easy'|'medium'|'hard') — calibrates the AI
   *  tutor's reveal level. Present only when the manifest emitted difficulty. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<LightShadowLabMetrics>) => void;
}

interface LightShadowLabProps {
  data: LightShadowLabData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// =============================================================================
// Constants
// =============================================================================

const SVG_WIDTH = 700;
const SVG_HEIGHT = 400;
const GROUND_Y = 320;
const SUN_ARC_CX = SVG_WIDTH / 2;
const SUN_ARC_CY = GROUND_Y;
const SUN_ARC_RX = 300;
const SUN_ARC_RY = 260;
const OBJECT_X = SVG_WIDTH / 2;
/** Every object is drawn this tall, so the shadow's drawn length follows the sun's height alone: it ends 58px out at
 *  60 degrees (the short/medium edge) and 173px out at 30 degrees (the medium/long edge), the same bins as the key. */
const OBJECT_PX = 100;
/** Where the short and long zones begin on the ground (`shadow_zones`), from the object. */
const ZONE_EDGES = [OBJECT_PX / Math.tan(Math.PI / 3), OBJECT_PX / Math.tan(Math.PI / 6)];
/** Observe: a dragged sun within this many degrees of a time mark snaps onto it. */
const SNAP_DEGREES = 12;

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  observe:  { label: 'Observe',  icon: '👀', accentColor: 'blue' },
  predict:  { label: 'Predict',  icon: '🔮', accentColor: 'purple' },
  measure:  { label: 'Measure',  icon: '📏', accentColor: 'emerald' },
  apply:    { label: 'Apply',    icon: '🧠', accentColor: 'amber' },
};

// =============================================================================
// Shadow geometry helpers
// =============================================================================

/** Convert sun altitude (0-90°) and azimuth to SVG position on the arc. */
function sunToSvg(altitude: number, azimuth: number): { x: number; y: number } {
  // Position along the arc by azimuth (0 = east/left, 180 = west/right), height by altitude.
  const t = azimuth / 180;
  const xPos = SUN_ARC_CX - SUN_ARC_RX * (1 - 2 * t);
  const yPos = GROUND_Y - (SUN_ARC_RY * (altitude / 90));
  return { x: xPos, y: Math.max(40, yPos) };
}

/** Calculate shadow length and direction from sun position. */
function computeShadow(
  heightPx: number,
  altitude: number,
  azimuth: number,
): { length: number; direction: ShadowDirection; tipX: number } {
  if (altitude >= 85) {
    return { length: 5, direction: 'N', tipX: OBJECT_X };
  }

  const altRad = (altitude * Math.PI) / 180;
  const shadowLen = heightPx / Math.tan(Math.max(altRad, 0.05));
  const clampedLen = Math.min(shadowLen, 280);

  // Shadow points AWAY from sun. Sun in the east (azimuth < 80) → shadow points west (right);
  // sun in the west (azimuth > 100) → shadow points east (left).
  if (azimuth < 80) return { length: clampedLen, direction: 'W', tipX: OBJECT_X + clampedLen };
  if (azimuth > 100) return { length: clampedLen, direction: 'E', tipX: OBJECT_X - clampedLen };
  return { length: clampedLen, direction: 'N', tipX: OBJECT_X };
}

/** Get display icon/color for object types. */
function getObjectVisual(type: ShadowObject['type']): { color: string; width: number } {
  switch (type) {
    case 'stick_figure': return { color: '#F59E0B', width: 14 };
    case 'tree': return { color: '#22C55E', width: 20 };
    case 'flagpole': return { color: '#94A3B8', width: 6 };
    case 'building': return { color: '#8B5CF6', width: 30 };
    default: return { color: '#F59E0B', width: 14 };
  }
}

function getThemeBackground(theme: LabTheme): string {
  switch (theme) {
    case 'playground': return '#1a2744';
    case 'sundial': return '#1e293b';
    case 'science_lab': return '#0f172a';
    default: return '#1a2744';
  }
}

// =============================================================================
// Sun component (draggable along arc)
// =============================================================================

function Sun({ x, y, isDragging }: { x: number; y: number; isDragging: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={30} fill="rgba(255, 215, 0, 0.15)" />
      <circle cx={x} cy={y} r={20} fill="rgba(255, 215, 0, 0.3)" />
      <circle
        cx={x}
        cy={y}
        r={14}
        fill="#FFD700"
        stroke="#FFA500"
        strokeWidth={2}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', filter: 'drop-shadow(0 0 6px rgba(255, 215, 0, 0.6))' }}
      />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            x1={x + 16 * Math.cos(rad)}
            y1={y + 16 * Math.sin(rad)}
            x2={x + 22 * Math.cos(rad)}
            y2={y + 22 * Math.sin(rad)}
            stroke="#FFD700"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.7}
          />
        );
      })}
    </g>
  );
}

// =============================================================================
// Lever pictures (`lightShadowLevers.ts`): fixed models, no words, never the item
// =============================================================================

/** One small model: a sun at (altitude, azimuth), a block, and its shadow, drawn with the scene's own rule. */
function ModelPanel({ altitude, azimuth }: { altitude: number; azimuth: number }) {
  const W = 120, G = 62, X = 60, H = 26;
  const sx = 10 + (W - 20) * (azimuth / 180), sy = G - 6 - (G - 14) * (altitude / 90);
  const len = Math.min(H / Math.tan(Math.max((altitude * Math.PI) / 180, 0.05)), 52);
  const tip = azimuth < 80 ? X + len : azimuth > 100 ? X - len : X;
  return (
    <svg width={W} height={74} viewBox={`0 0 ${W} 74`} aria-hidden className="rounded-lg bg-slate-800/60">
      <rect x={0} y={G} width={W} height={12} fill="rgba(34,197,94,0.35)" />
      {tip === X ? <ellipse cx={X} cy={G + 1} rx={6} ry={2} fill="rgba(0,0,0,0.6)" />
        : <line x1={X} y1={G + 1} x2={tip} y2={G + 1} stroke="rgba(0,0,0,0.6)" strokeWidth={4} strokeLinecap="round" />}
      <rect x={X - 4} y={G - H} width={8} height={H} fill="#94A3B8" rx={1} />
      <circle cx={sx} cy={sy} r={6} fill="#FFD700" />
    </svg>
  );
}

const SideModel = () => (
  <div data-lever="side-model" className="flex justify-center gap-2">
    {SIDE_MODEL.map((az) => <ModelPanel key={az} altitude={az === 90 ? 80 : 40} azimuth={az} />)}
  </div>
);

const HeightModel = () => (
  <div data-lever="height-model" className="flex justify-center gap-2">
    {HEIGHT_MODEL.map((alt) => <ModelPanel key={alt} altitude={alt} azimuth={20} />)}
  </div>
);

// =============================================================================
// Main Component
// =============================================================================

const LightShadowLabSurface = ({ data, className = '', runtimePlanItemId, tutorOwned, useController }:
  LightShadowLabProps & { tutorOwned: boolean; useController: (options: ProgressOptions<ShadowChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    theme,
    gradeLevel,
    objects,
    sunPositions = [],
    challenges,
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  } = data;

  const resolvedInstanceId = instanceId || 'light-shadow-lab-default';

  // ── Evaluation hook ──────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<LightShadowLabMetrics>({
    primitiveType: 'light-shadow-lab',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  });

  // ── Challenge progress ───────────────────────────────────────────
  // On the workspace path the runtime moves the index; a fresh item and Try again clear the work (bound below).
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    advance: advanceProgress,
  } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = tutorOwned && progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── AI tutoring (scripted path only) ─────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    theme,
    gradeLevel,
    challengeCount: challenges.length,
    ...(supportTier ? { supportTier } : {}),
  }), [theme, gradeLevel, challenges.length, supportTier]);

  // The scripted tutor's context and cues: off on the workspace path, and its cues send nothing there.
  const { sendText: sendLegacyText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'light-shadow-lab',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  // ── Sun position and answer state ────────────────────────────────
  const sessionChallenge = challenges[currentChallengeIndex] ?? challenges[0];
  // In-item levers (`lightShadowLevers.ts`), keyed by the session item they were pulled on, and the easier item a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<ShadowChallenge | null>(null);
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull or the tier's starting position, on the session item only; never drawn on a practice item. */
  const leverOn = (id: string) => !practice && (pulledLevers.includes(id) || !!sessionChallenge?.startLevers?.includes(id));
  const opening = currentChallenge ? openingSun(currentChallenge) : { altitude: 45, azimuth: 90 };
  const [sunAltitude, setSunAltitude] = useState(opening.altitude);
  const [sunAzimuth, setSunAzimuth] = useState(opening.azimuth);
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const [selectedMcAnswer, setSelectedMcAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [showingAnswer, setShowingAnswer] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{ score: number } | null>(null);

  /** The work blank and the sun back at its opening place: a fresh challenge, or Try again on the workspace path. */
  const clearWork = useCallback((ch: ShadowChallenge | undefined) => {
    if (!ch) return;
    const sun = openingSun(ch);
    setSunAltitude(sun.altitude);
    setSunAzimuth(sun.azimuth);
    setSelectedMcAnswer(null);
    setFeedback(null);
    setShowingAnswer(false);
  }, []);
  // A fresh item (or the full item back after a practice item) drops the practice; Try again keeps it.
  openItem.current = (index, retry) => {
    if (retry && practice) { clearWork(practice); return; }
    setPractice(null); clearWork(challenges[index]);
  };

  useEffect(() => {
    if (currentChallenge && !allChallengesComplete) clearWork(currentChallenge);
  }, [currentChallenge?.id, allChallengesComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ───────────────────────────────────────────────
  const primaryObject = objects[0] ?? { type: 'flagpole' as const, height: 3 };
  const shadow = useMemo(() => computeShadow(OBJECT_PX, sunAltitude, sunAzimuth), [sunAltitude, sunAzimuth]);
  const sunSvg = useMemo(() => sunToSvg(sunAltitude, sunAzimuth), [sunAltitude, sunAzimuth]);
  const currentRelLen = shadowLengthOf(sunAltitude);
  const solved = feedback?.correct === true;

  const showSunPath = currentChallenge?.showSunPath ?? true;
  const showDirectionLabels = currentChallenge?.showDirectionLabels ?? true;
  const marks = useMemo(() => currentChallenge ? timeMarks(currentChallenge, sunPositions) : [], [currentChallenge, sunPositions]);
  const markHere = markAt(marks, { altitude: sunAltitude, azimuth: sunAzimuth });
  const timeLabel = useMemo(() => {
    if (sunAzimuth < 60) return 'Early Morning';
    if (sunAzimuth < 80) return 'Morning';
    if (sunAzimuth < 100) return 'Midday';
    if (sunAzimuth < 140) return 'Afternoon';
    return 'Evening';
  }, [sunAzimuth]);
  /** The clock at the top: observe names the mark the sun sits on; apply hides it until it is answered. */
  const clockText = !currentChallenge || allChallengesComplete ? timeLabel
    : currentChallenge.type === 'observe' ? (markHere?.time ?? timeLabel)
      : hidesSun(currentChallenge) && !solved ? null
        : normalizeTime(currentChallenge.sunPosition.time);
  const drawShadow = allChallengesComplete || !currentChallenge || !hidesShadow(currentChallenge) || solved;
  const drawSun = allChallengesComplete || !currentChallenge || !hidesSun(currentChallenge) || solved;

  // ── Sun dragging (observe only, and freely once the lab is done) ─
  const canDrag = allChallengesComplete || (currentChallenge?.type === 'observe' && !solved);
  const handleSunDrag = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * SVG_WIDTH;
    const svgY = ((clientY - rect.top) / rect.height) * SVG_HEIGHT;
    // Map x to azimuth (left = east 0°, right = west 180°) and y to altitude (ground 0°, top 90°).
    const rawAzimuth = ((svgX - (SUN_ARC_CX - SUN_ARC_RX)) / (2 * SUN_ARC_RX)) * 180;
    const rawAlt = ((GROUND_Y - svgY) / SUN_ARC_RY) * 90;
    setSunAzimuth(Math.max(5, Math.min(175, rawAzimuth)));
    setSunAltitude(Math.max(5, Math.min(85, rawAlt)));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!canDrag || learnerBlocked()) return;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [canDrag]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isDragging) handleSunDrag(e.clientX, e.clientY);
  }, [isDragging, handleSunDrag]);

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    SoundManager.snap();
    // Onto the nearest time mark, so the shadow drawn is exactly the one the question asks about.
    const near = marks.map(m => ({ m, d: Math.hypot(m.azimuth - sunAzimuth, m.altitude - sunAltitude) }))
      .sort((a, b) => a.d - b.d)[0];
    if (near && near.d <= SNAP_DEGREES) { setSunAzimuth(near.m.azimuth); setSunAltitude(near.m.altitude); }
  }, [isDragging, marks, sunAzimuth, sunAltitude]);

  // ── Choices (built in code, every one in the key's own form) ─────
  const mcOptions = useMemo(
    () => currentChallenge ? shadowOptions(currentChallenge, sunPositions) : [],
    [currentChallenge, sunPositions],
  );
  const correctMcAnswer = currentChallenge ? keyOption(currentChallenge) : '';

  // ── Tutor reveal policy (scripted path; mode-aware tier clause) ──
  const tutorRevealClause = useMemo(() => {
    if (supportTier === 'easy') {
      return 'SUPPORT=easy: you may name the shadow rule (low sun → long shadow; shadow points away from the sun) and walk the student through reading the scene. Never state the final answer.';
    }
    if (supportTier === 'hard') {
      return 'SUPPORT=hard: do NOT name the shadow rule and do NOT mention east/west sides directly — ask what the student notices about how HIGH the sun is and which side it is on. Never reveal the shadow length, direction, or answer.';
    }
    if (supportTier === 'medium') {
      return 'SUPPORT=medium: nudge the student\'s execution only — do not re-state the full rule; prompt them to apply what they see. Never reveal the answer.';
    }
    return '';
  }, [supportTier]);

  const handleChoose = (option: string) => {
    if (feedback?.correct || showingAnswer || learnerBlocked()) return;
    SoundManager.select();
    setSelectedMcAnswer(option);
  };

  // ── Answer checking ──────────────────────────────────────────────
  const handleCheckAnswer = () => {
    if (!currentChallenge || !selectedMcAnswer || feedback?.correct || learnerBlocked()) return;
    const isCorrect = shadowCorrect(currentChallenge, selectedMcAnswer);
    // Counts the attempt and records a correct result on both paths; on the workspace path it is the checked gesture.
    progress.commitCheck(describeShadowWork(selectedMcAnswer), isCorrect,
      isCorrect ? undefined : shadowMiss(currentChallenge, selectedMcAnswer, sunPositions));

    if (isCorrect) {
      SoundManager.playCorrect();
      setFeedback({ correct: true, message: 'Correct! Great observation!' });
      sendText(
        `[ANSWER_CORRECT] Student correctly identified shadow as "${correctMcAnswer}" for challenge "${currentChallenge.instruction}". Attempt ${currentAttempts + 1}. Congratulate briefly and explain the science.`,
        { silent: true },
      );
      return;
    }
    SoundManager.playIncorrect();
    setFeedback({ correct: false, message: `Not quite. ${shadowHint(currentChallenge)}` });
    // Scripted path only: after three tries the answer is shown and the item recorded as missed.
    if (!tutorOwned && currentAttempts >= 2) {
      recordResult({ challengeId: currentChallenge.id, correct: false, attempts: currentAttempts + 1 });
      setShowingAnswer(true);
    }
    sendText(
      `[ANSWER_INCORRECT] Student chose "${selectedMcAnswer}" but correct is "${correctMcAnswer}". Challenge: "${currentChallenge.instruction}". Attempt ${currentAttempts + 1}. Give a hint without revealing the answer. ${tutorRevealClause}`,
      { silent: true },
    );
  };

  // ── Advance to next challenge (scripted path) ────────────────────
  const handleNextChallenge = () => {
    if (!advanceProgress()) {
      const correctCount = challengeResults.filter(r => r.correct).length;
      const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
      const overallScore = Math.round((correctCount / Math.max(challengeResults.length, 1)) * 100);
      const metrics: LightShadowLabMetrics = {
        type: 'light-shadow-lab',
        evalMode: currentChallenge?.type,
        challengesCompleted: challengeResults.length,
        challengesCorrect: correctCount,
        totalAttempts,
        accuracy: overallScore,
        averageAttemptsPerChallenge: totalAttempts / Math.max(challengeResults.length, 1),
      };
      // The workspace path submits the scored session from `onFinished` (below), not this tally.
      if (!tutorOwned && progress.recordsEvaluation !== false) evaluation.submitResult(overallScore >= 70, overallScore, metrics);
      setSubmittedResult({ score: overallScore });
      const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
      sendText(
        `[ALL_COMPLETE] Student finished all shadow challenges! Phase scores: ${phaseScoreStr || `Overall ${overallScore}%`}. Overall: ${overallScore}%. Give encouraging phase-specific feedback about shadows and light.`,
        { silent: true },
      );
      return;
    }
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. Introduce it briefly.`,
      { silent: true },
    );
  };

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (evaluation.hasSubmitted || challenges.length === 0) return;
    const metrics: LightShadowLabMetrics = {
      type: 'light-shadow-lab',
      evalMode: challenges[0].type,
      challengesCompleted: challenges.length,
      challengesCorrect: result.solvedCount,
      totalAttempts: result.attemptsCount,
      accuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / challenges.length) * 10) / 10,
    };
    setSubmittedResult({ score: result.accuracy });
    evaluation.submitResult(result.passed, result.accuracy, metrics,
      { studentWork: { challengeCount: challenges.length, instructions: challenges.map((c) => c.instruction) },
        challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // Workspace path: what the tutor and the observer are shown, republished every render.
  // No demonstration targets and no presentation. Every mode declares its levers.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge || allChallengesComplete) return;
    const scene = workspaceScene(currentChallenge,
      { choice: selectedMcAnswer, sun: { altitude: sunAltitude, azimuth: sunAzimuth }, solved }, sunPositions);
    const shown = practice ? [] : [...pulledLevers, ...(sessionChallenge.startLevers ?? [])];
    const onScreen = practice ? '' : leverFacts(sessionChallenge, shown);
    const levers = practice ? [] : lightShadowLevers(sessionChallenge, shown);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}), ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceItem(sessionChallenge);
          if (!easier) return 'This item has no easier version; try a help lever.';
          // The practice item and the full item share no work: both start blank.
          setLeverState(pulled); clearWork(easier); setPractice(easier);
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); clearWork(sessionChallenge); },
    };
  });

  // ── Object rendering ─────────────────────────────────────────────
  const objVisual = getObjectVisual(primaryObject.type);
  const objectHeightPx = OBJECT_PX;

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete || submittedResult ? null : currentChallenge?.id ?? null,
    label: 'The shadow scene and answer choices',
    solved,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100">{title}</CardTitle>
            <CardDescription className="text-slate-400">{description}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="border-white/20 text-slate-300">
              {theme === 'playground' ? '🏫 Playground' : theme === 'sundial' ? '☀️ Sundial' : '🔬 Science Lab'}
            </Badge>
            {!allChallengesComplete && (
              <Badge variant="outline" className="border-white/20 text-slate-300">
                {currentChallengeIndex + 1}/{challenges.length}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Pip's dock sits above the workspace, which it outlines as a region. */}
        {pip.store && !allChallengesComplete && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-4">
        {/* ── SVG Scene ────────────────────────────────────────── */}
        <div className="relative rounded-xl overflow-hidden border border-white/10">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full"
            style={{ background: getThemeBackground(theme) }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <defs>
              <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={drawSun && sunAltitude > 30 ? '#1e40af' : '#0f172a'} />
                <stop offset="100%" stopColor={drawSun && sunAltitude > 30 ? '#3b82f6' : '#1e293b'} />
              </linearGradient>
              <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme === 'playground' ? '#166534' : '#374151'} />
                <stop offset="100%" stopColor={theme === 'playground' ? '#14532d' : '#1f2937'} />
              </linearGradient>
            </defs>

            <rect x={0} y={0} width={SVG_WIDTH} height={GROUND_Y} fill="url(#skyGrad)" />

            {/* Sun arc guide (dashed) — perception scaffold, withdrawn at hard */}
            {showSunPath && (
              <ellipse cx={SUN_ARC_CX} cy={SUN_ARC_CY} rx={SUN_ARC_RX} ry={SUN_ARC_RY}
                fill="none" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 8" />
            )}

            {/* Observe: the times on the sun's path, where the dragged sun snaps */}
            {marks.map((m) => {
              const p = sunToSvg(m.altitude, m.azimuth);
              return (
                <g key={m.time}>
                  <circle cx={p.x} cy={p.y} r={6} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} />
                  <text x={p.x} y={p.y - 12} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={12} fontFamily="sans-serif">{m.time}</text>
                </g>
              );
            })}

            <rect x={0} y={GROUND_Y} width={SVG_WIDTH} height={SVG_HEIGHT - GROUND_Y} fill="url(#groundGrad)" />

            {/* Direction labels — perception scaffold, withdrawn at medium+hard */}
            {showDirectionLabels && (
              <>
                <text x={30} y={GROUND_Y + 20} fill="rgba(255,255,255,0.4)" fontSize={13} fontFamily="sans-serif">E (East)</text>
                <text x={SVG_WIDTH - 80} y={GROUND_Y + 20} fill="rgba(255,255,255,0.4)" fontSize={13} fontFamily="sans-serif">W (West)</text>
              </>
            )}

            {/* shadow_zones lever: where a short shadow ends and a long one begins, the same on both sides, no words */}
            {leverOn(SHADOW_ZONES_LEVER) && ZONE_EDGES.flatMap((d) => [-1, 1].map((side) => (
              <line key={`${d}-${side}`} data-lever="zone-mark" x1={OBJECT_X + side * d} x2={OBJECT_X + side * d}
                y1={GROUND_Y - 6} y2={GROUND_Y + 14} stroke="rgba(255,255,255,0.55)" strokeWidth={2} />
            )))}

            {/* Shadow — predict draws none until the prediction is right */}
            {drawShadow && (
              <>
                <line x1={OBJECT_X} y1={GROUND_Y} x2={shadow.tipX} y2={GROUND_Y}
                  stroke="rgba(0,0,0,0.5)" strokeWidth={Math.max(objVisual.width * 0.6, 8)} strokeLinecap="round"
                  opacity={sunAltitude < 5 ? 0.2 : 0.6} />
                <line x1={OBJECT_X} y1={GROUND_Y} x2={shadow.tipX} y2={GROUND_Y}
                  stroke="rgba(0,0,0,0.2)" strokeWidth={Math.max(objVisual.width * 0.9, 14)} strokeLinecap="round"
                  opacity={sunAltitude < 20 ? 0.4 : 0.2} />
              </>
            )}

            {/* Object */}
            {primaryObject.type === 'tree' ? (
              <g>
                <rect x={OBJECT_X - 4} y={GROUND_Y - objectHeightPx} width={8} height={objectHeightPx} fill="#92400E" rx={2} />
                <circle cx={OBJECT_X} cy={GROUND_Y - objectHeightPx - 15} r={22} fill="#22C55E" opacity={0.9} />
              </g>
            ) : primaryObject.type === 'stick_figure' ? (
              <g>
                <line x1={OBJECT_X} y1={GROUND_Y - objectHeightPx * 0.4} x2={OBJECT_X} y2={GROUND_Y} stroke="#F59E0B" strokeWidth={3} />
                <circle cx={OBJECT_X} cy={GROUND_Y - objectHeightPx * 0.4 - 12} r={10} fill="#F59E0B" />
                <line x1={OBJECT_X - 15} y1={GROUND_Y - objectHeightPx * 0.25} x2={OBJECT_X + 15} y2={GROUND_Y - objectHeightPx * 0.25} stroke="#F59E0B" strokeWidth={2.5} />
                <line x1={OBJECT_X} y1={GROUND_Y} x2={OBJECT_X - 10} y2={GROUND_Y + 2} stroke="#F59E0B" strokeWidth={2.5} />
                <line x1={OBJECT_X} y1={GROUND_Y} x2={OBJECT_X + 10} y2={GROUND_Y + 2} stroke="#F59E0B" strokeWidth={2.5} />
              </g>
            ) : primaryObject.type === 'building' ? (
              <rect x={OBJECT_X - 15} y={GROUND_Y - objectHeightPx} width={30} height={objectHeightPx}
                fill="#8B5CF6" stroke="#A78BFA" strokeWidth={1} rx={2} />
            ) : (
              <g>
                <line x1={OBJECT_X} y1={GROUND_Y} x2={OBJECT_X} y2={GROUND_Y - objectHeightPx} stroke="#94A3B8" strokeWidth={3} />
                <rect x={OBJECT_X} y={GROUND_Y - objectHeightPx} width={18} height={12} fill="#EF4444" rx={1} />
              </g>
            )}

            {/* Sun — apply hides it until the time is answered */}
            {drawSun && <Sun x={sunSvg.x} y={sunSvg.y} isDragging={isDragging} />}

            {/* Clock */}
            {clockText && (
              <text x={SVG_WIDTH / 2} y={25} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={14} fontFamily="sans-serif">
                {clockText}
              </text>
            )}

            {/* Shadow readout: only after a right answer or once the lab is done, never while working */}
            {drawShadow && (allChallengesComplete || solved) && (
              <text
                x={shadow.tipX > OBJECT_X ? shadow.tipX + 10 : shadow.tipX - 10}
                y={GROUND_Y - 8}
                textAnchor={shadow.tipX > OBJECT_X ? 'start' : 'end'}
                fill="rgba(255,255,255,0.5)"
                fontSize={11}
                fontFamily="sans-serif"
              >
                Shadow: {currentRelLen}, {shadow.direction}
              </text>
            )}
          </svg>

          {currentChallenge?.type === 'observe' && !solved && !allChallengesComplete && (
            <div className="absolute top-2 right-2 bg-black/50 text-slate-300 text-xs px-2 py-1 rounded">
              Drag the sun to explore
            </div>
          )}
        </div>

        {/* Help levers: fixed models beside the scene */}
        {leverOn(SIDE_MODEL_LEVER) && <SideModel />}
        {leverOn(HEIGHT_MODEL_LEVER) && <HeightModel />}

        {/* ── Challenge / Question Area ────────────────────────── */}
        {!allChallengesComplete && currentChallenge && (
          <div className="space-y-3">
            {practice ? <div className="text-center text-xs text-amber-300" data-practice>Practice</div> : null}
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="border-white/20 text-slate-300 text-xs">
                  {PHASE_TYPE_CONFIG[currentChallenge.type]?.icon} {PHASE_TYPE_CONFIG[currentChallenge.type]?.label}
                </Badge>
              </div>
              <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
            </div>

            {/* MC options */}
            {!solved && !showingAnswer && (
              <div className="grid grid-cols-2 gap-2">
                {mcOptions.map((option) => (
                  <Button
                    key={option}
                    variant="ghost"
                    className={`bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 text-sm h-auto py-2 px-3 text-left justify-start ${
                      selectedMcAnswer === option ? 'ring-2 ring-blue-400 bg-blue-500/10' : ''
                    }`}
                    onClick={() => handleChoose(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            )}

            {/* Check / Next buttons */}
            <div className="flex gap-2">
              {!solved && !showingAnswer && (
                <Button
                  variant="ghost"
                  className="bg-blue-500/20 border border-blue-400/30 hover:bg-blue-500/30 text-blue-200"
                  onClick={handleCheckAnswer}
                  disabled={!selectedMcAnswer}
                >
                  Check Answer
                </Button>
              )}
              {(solved || showingAnswer) && !tutorOwned && (
                <Button
                  variant="ghost"
                  className="bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 text-emerald-200"
                  onClick={handleNextChallenge}
                >
                  {currentChallengeIndex < challenges.length - 1 ? 'Next Challenge' : 'See Results'}
                </Button>
              )}
            </div>

            {feedback && (
              <div className={`rounded-lg p-3 text-sm ${
                feedback.correct
                  ? 'bg-emerald-500/10 border border-emerald-400/20 text-emerald-200'
                  : 'bg-amber-500/10 border border-amber-400/20 text-amber-200'
              }`}>
                {feedback.message}
                {showingAnswer && (
                  <p className="mt-1 text-slate-300">The answer was: <strong>{correctMcAnswer}</strong></p>
                )}
              </div>
            )}
          </div>
        )}

        </div>

        {/* ── Phase Summary ────────────────────────────────────── */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? 0}
            durationMs={evaluation.elapsedMs}
            heading="Shadow Lab Complete!"
            celebrationMessage="You explored how light and shadows work!"
            className="mb-6"
          />
        )}
      </CardContent>
    </Card>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const LightShadowLab = withWorkspaceController<LightShadowLabProps, ProgressOptions<ShadowChallenge>, Progress>(
  'light-shadow-lab', LightShadowLabSurface, useScriptedProgress, useWorkspaceProgressFor('light-shadow-lab'));

export default LightShadowLab;
