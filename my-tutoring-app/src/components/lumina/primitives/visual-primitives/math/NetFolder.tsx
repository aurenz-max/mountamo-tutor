'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaButton,
  LuminaBadge,
  LuminaPanel,
  LuminaActionButton,
  LuminaInput,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { NetFolderMetrics } from '../../../evaluation/types';
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
  baseFaces, baseView, cellNet, cellsOf, foldCubeCells, projectSolid, sharedEdges, solidModel, solidNet, boxNet,
  CROSS_NET, type Cell, type NetFace, type Point,
} from './netFolderGeometry';
import {
  boxDims, countsOf, describeNetWork, itemSolid, matchTarget, netCorrect, netFolderMiss, netFolds, solidWords,
  surfaceTotal, workspaceAssignment, workspaceScene, type NetWork,
} from './netFolderWorkspace';
import {
  AREA_VS_VOLUME, BASE_OUTLINE, FAMILY_MODEL, FOLD_GUIDES, MATCH_LIST, NET_BESIDE, OPPOSITE_RULE, PAIR_COLORS,
  PART_NAMES, PRACTICE_NOTE, SEE_THROUGH, SIX_FACES_MODEL, THIRD_LABEL, TURN_TO_BASE, VALID_MODEL, WRAP_MODEL,
  familyModelSolids, isPracticeNet, leverFacts, netLevers, simplerNet, solidOf, thirdLabelCell, validModelNet,
} from './netFolderLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type SolidType =
  | 'cube'
  | 'rectangular_prism'
  | 'triangular_prism'
  | 'square_pyramid'
  | 'triangular_pyramid'
  | 'cylinder'
  | 'cone';

export type NetLayout = 'cross' | 't_shape' | 'l_shape' | 'strip' | 'custom';

export interface NetFolderSolid {
  type: SolidType;
  name: string;
  dimensions: {
    length?: number | null;
    width?: number | null;
    height?: number | null;
    radius?: number | null;
  };
  faces: number;
  edges: number;
  vertices: number;
}

export interface NetFolderAlternativeNet {
  layout: string;
  valid: boolean;
  explanation: string;
}

export interface NetFolderChallenge {
  id: string;
  type: 'identify_solid' | 'match_faces' | 'valid_net' | 'surface_area' | 'count_faces_edges_vertices';
  instruction: string;
  targetAnswer: string | number;
  hint: string;
  narration: string;
  // identify_solid
  options?: string[];
  // match_faces
  /** Legacy (model-written): the face name of the highlighted square, which was also the answer. */
  highlightedFace?: string;
  faceOptions?: string[];
  // match_faces / valid_net: the drawn cube net, code-built. Its fold decides the answer.
  /** The net's unit squares, [row, column]. */
  netCells?: Array<[number, number]>;
  /** match_faces: the squares labelled with their face (the first folds to front), which fix the net's turn. */
  anchorCells?: number[];
  /** match_faces: the yellow square asked about. */
  highlightCell?: number;
  // valid_net
  netLayout?: string;
  isValidNet?: boolean;
  netExplanation?: string;
  // surface_area
  faceDimensions?: Array<{ width: number; height: number }>;
  unitLabel?: string;
  /** A practice item's own solid (a simplify lever); else the session's. */
  solid?: NetFolderSolid;
}

export interface NetFolderData {
  title: string;
  description?: string;
  solid: NetFolderSolid;
  net: {
    layout: NetLayout;
    faceLabels: string[];
    gridOverlay: boolean;
  };
  challenges: NetFolderChallenge[];
  alternativeNets?: NetFolderAlternativeNet[];
  showOptions?: {
    showDimensions?: boolean;
    showFaceLabels?: boolean;
    showGridOverlay?: boolean;
    showFaceCorrespondence?: boolean;
    /** Within-mode support tier lever (#1 perception): dashed fold-line guides
     *  drawn between adjacent net faces, showing where the net hinges when it
     *  folds. Pure scaffold — never changes the net or which solid it folds into
     *  (that is the eval-mode axis). Withdrawn at the hard tier. */
    showFoldGuides?: boolean;
    /** Within-mode support tier lever: face-match correspondence highlighting
     *  (tap a net face → its match lights up on the solid, and vice-versa).
     *  ANSWER-LEAK GUARD: on match_faces / valid_net the correspondence IS the
     *  asked answer, so the component never offers it on those items. */
    showFaceMatchHints?: boolean;
    allowRotation?: boolean;
    animationSpeed?: number;
  };
  imagePrompt?: string | null;
  gradeBand?: '3-4' | '4-5';
  /** Within-mode support tier (config.difficulty). Surfaced to the live tutor so
   *  its reveal level stays in sync with the on-screen fold scaffolds. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<NetFolderMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  identify_solid: { label: 'Identify', icon: '🔍', accentColor: 'blue' },
  count_faces_edges_vertices: { label: 'Count', icon: '🔢', accentColor: 'orange' },
  match_faces: { label: 'Match', icon: '🎯', accentColor: 'purple' },
  valid_net: { label: 'Valid Net', icon: '✓', accentColor: 'emerald' },
  surface_area: { label: 'Area', icon: '📐', accentColor: 'amber' },
};

const FACE_COLORS = [
  'rgba(99, 102, 241, 0.75)',   // indigo
  'rgba(236, 72, 153, 0.75)',   // pink
  'rgba(34, 197, 94, 0.75)',    // green
  'rgba(251, 146, 60, 0.75)',   // orange
  'rgba(59, 130, 246, 0.75)',   // blue
  'rgba(168, 85, 247, 0.75)',   // purple
];
/** pair_colors: one colour per pair of matching faces. */
const PAIR_FILLS = ['rgba(56, 189, 248, 0.8)', 'rgba(251, 191, 36, 0.8)', 'rgba(244, 114, 182, 0.8)'];
const BLANK_FILL = 'rgba(100, 116, 139, 0.55)';
const GOLD = '#facc15';

// ============================================================================
// Sub-components
// ============================================================================

const pts = (ps: Point[]) => ps.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

/** The solid, projected from its vertices (`netFolderGeometry.ts`); drag turns it. */
const SolidViewer: React.FC<{
  solid: NetFolderSolid;
  rotation: { x: number; y: number };
  highlightedFace: string | null;
  onFaceClick?: (label: string) => void;
  showLabels: boolean;
  allowRotation: boolean;
  onRotate?: (delta: { x: number; y: number }) => void;
  /** see_through lever: the hidden edges dashed and the hidden corners ringed. */
  seeThrough?: boolean;
  /** base_outline lever: these faces outlined in gold. */
  outline?: readonly string[];
  size?: number;
  label?: string;
}> = ({ solid, rotation, highlightedFace, onFaceClick, showLabels, allowRotation, onRotate, seeThrough = false, outline = [],
  size = 220, label = 'The solid' }) => {
  const model = useMemo(() => solidModel(solid), [solid]);
  const view = useMemo(() => projectSolid(model, rotation, size), [model, rotation, size]);
  const colorOf = (face: string) => FACE_COLORS[Math.max(0, model.faces.findIndex(f => f.label === face)) % FACE_COLORS.length];
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      className="mx-auto block touch-none"
      onPointerDown={(e) => {
        if (!allowRotation) return;
        dragging.current = true;
        last.current = { x: e.clientX, y: e.clientY };
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging.current || !onRotate) return;
        const dx = e.clientX - last.current.x, dy = e.clientY - last.current.y;
        last.current = { x: e.clientX, y: e.clientY };
        onRotate({ x: -dy * 0.5, y: dx * 0.5 });
      }}
      onPointerUp={() => { dragging.current = false; }}
    >
      {seeThrough && view.edges.filter(e => !e.visible).map((e, i) => (
        <line key={`h${i}`} data-hidden-edge="true" x1={e.a[0]} y1={e.a[1]} x2={e.b[0]} y2={e.b[1]}
          stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} strokeDasharray="5 4" />
      ))}
      {view.faces.filter(f => f.visible).map(f => (
        <polygon
          key={f.label}
          data-face={f.label}
          points={pts(f.points)}
          onClick={() => onFaceClick?.(f.label)}
          fill={colorOf(f.label)}
          stroke={outline.includes(f.label) ? GOLD : highlightedFace === f.label ? GOLD : 'rgba(255,255,255,0.7)'}
          strokeWidth={outline.includes(f.label) ? 4 : highlightedFace === f.label ? 3 : 1.5}
          strokeLinejoin="round"
          {...(outline.includes(f.label) ? { 'data-lever': 'base-outline' } : {})}
          className={onFaceClick ? 'cursor-pointer' : undefined}
        />
      ))}
      {view.vertices.map((v, i) => (v.visible || seeThrough) && (
        <circle key={`v${i}`} cx={v.at[0]} cy={v.at[1]} r={v.visible ? 3 : 4}
          fill={v.visible ? 'white' : 'none'} stroke="white" strokeWidth={v.visible ? 0 : 1.5}
          {...(!v.visible ? { 'data-hidden-corner': 'true' } : {})} />
      ))}
      {showLabels && view.faces.filter(f => f.visible).map(f => (
        <text key={`t${f.label}`} x={f.center[0]} y={f.center[1]} textAnchor="middle" dominantBaseline="middle"
          fontSize={10} fontWeight={700} fill="white" pointerEvents="none">{f.label}</text>
      ))}
    </svg>
  );
};

/** A net as flat polygons, scaled to fit; fold lines on shared edges. */
const NetDisplay: React.FC<{
  faces: NetFace[];
  labelFor: (face: NetFace, index: number) => string;
  fillFor?: (face: NetFace, index: number) => string;
  highlightId?: string | null;
  showFoldGuides: boolean;
  /** Unit squares drawn inside faces whose sides are whole numbers (a surface-area box). */
  showGrid?: boolean;
  onFaceClick?: (label: string) => void;
  label?: string;
  maxWidth?: number;
}> = ({ faces, labelFor, fillFor, highlightId = null, showFoldGuides, showGrid = false, onFaceClick, label = 'The net', maxWidth = 280 }) => {
  const all = faces.flatMap(f => f.points);
  const minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0]));
  const minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]));
  const pad = 6, w = Math.max(maxX - minX, 1e-6), h = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((maxWidth - 2 * pad) / w, (220 - 2 * pad) / h);
  const at = (p: Point): Point => [pad + (p[0] - minX) * scale, pad + (p[1] - minY) * scale];
  const folds = showFoldGuides ? sharedEdges(faces) : [];
  const grid = showGrid ? faces.flatMap(f => {
    const xs = f.points.map(p => p[0]), ys = f.points.map(p => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    if (f.points.length !== 4 || !Number.isInteger(x1 - x0) || !Number.isInteger(y1 - y0) || x1 - x0 > 20 || y1 - y0 > 20) return [];
    return [
      ...Array.from({ length: x1 - x0 - 1 }, (_, i) => [[x0 + i + 1, y0], [x0 + i + 1, y1]] as [Point, Point]),
      ...Array.from({ length: y1 - y0 - 1 }, (_, i) => [[x0, y0 + i + 1], [x1, y0 + i + 1]] as [Point, Point]),
    ];
  }) : [];
  return (
    <svg width={w * scale + 2 * pad} height={h * scale + 2 * pad} viewBox={`0 0 ${w * scale + 2 * pad} ${h * scale + 2 * pad}`}
      role="img" aria-label={label} className="mx-auto block">
      {faces.map((f, i) => {
        const lit = highlightId === f.id;
        const ps = f.points.map(at);
        const cx = ps.reduce((s, p) => s + p[0], 0) / ps.length, cy = ps.reduce((s, p) => s + p[1], 0) / ps.length;
        const text = lit ? '?' : labelFor(f, i);
        return (
          <g key={f.id} data-net-face={f.id} {...(lit ? { 'data-highlight': 'true' } : {})}>
            <polygon points={pts(ps)} onClick={() => onFaceClick?.(f.label)}
              fill={lit ? 'rgba(250, 204, 21, 0.85)' : fillFor?.(f, i) ?? FACE_COLORS[i % FACE_COLORS.length]}
              stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} strokeLinejoin="round" className={onFaceClick ? 'cursor-pointer' : undefined} />
            {text && (
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={lit ? 18 : 11} fontWeight={700}
                fill={lit ? '#1e293b' : 'white'} pointerEvents="none">{text}</text>
            )}
          </g>
        );
      })}
      {grid.map(([a, b], i) => {
        const [p, q] = [at(a), at(b)];
        return <line key={`g${i}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="rgba(255,255,255,0.35)" strokeWidth={1} pointerEvents="none" />;
      })}
      {folds.map(([a, b], i) => {
        const [p, q] = [at(a), at(b)];
        return <line key={`f${i}`} data-fold-line="true" x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]}
          stroke={GOLD} strokeWidth={2} strokeDasharray="5 4" pointerEvents="none" />;
      })}
    </svg>
  );
};

/** A lever's picture outside the item: a caption under a small drawing. */
const ModelFigure: React.FC<{ lever: string; caption: string; children: React.ReactNode }> = ({ lever, caption, children }) => (
  <figure data-lever={lever} className="w-56 text-center">
    <div className="flex justify-center gap-2">{children}</div>
    <figcaption className="mt-1 text-xs text-slate-300">{caption}</figcaption>
  </figure>
);

/** Squares on a small grid, for the pictures outside the item. */
const MiniCells: React.FC<{ cells: Cell[]; marks?: number[]; unit?: number }> = ({ cells, marks = [], unit = 16 }) => {
  const rows = Math.max(...cells.map(c => c[0])) + 1, cols = Math.max(...cells.map(c => c[1])) + 1;
  return (
    <svg width={cols * unit + 2} height={rows * unit + 2} viewBox={`0 0 ${cols * unit + 2} ${rows * unit + 2}`} aria-hidden="true">
      {cells.map(([r, c], i) => (
        <rect key={i} x={1 + c * unit} y={1 + r * unit} width={unit} height={unit}
          fill={marks.includes(i) ? 'rgba(250, 204, 21, 0.8)' : 'rgba(148, 163, 184, 0.5)'} stroke="white" strokeWidth={1} />
      ))}
    </svg>
  );
};

// ============================================================================
// Tutor reveal policy — keep the live tutor in sync with the fold scaffolds (scripted path)
// ============================================================================

/**
 * How much the live tutor may reveal, calibrated to the on-screen support tier
 * and the eval mode. The tutor is a second information channel: at 'hard' the UI
 * withdraws the fold-line guides and (where shown) the face-match highlighting,
 * so the tutor must not narrate that withheld help either. For the recognition
 * modes where the correspondence IS the answer (match_faces / valid_net), the
 * tutor never names which faces meet or whether the net folds, at ANY tier.
 */
function tutorRevealPolicy(
  tier: 'easy' | 'medium' | 'hard' | undefined,
  mode: NetFolderChallenge['type'],
): string {
  if (!tier) return '';
  const answerGuard =
    mode === 'match_faces'
      ? 'Never name which face on the solid the highlighted net face folds to — discovering the correspondence IS the task.'
      : mode === 'valid_net'
        ? 'Never say whether the net is valid or invalid, or whether the faces will overlap — judging the fold IS the task.'
        : mode === 'surface_area'
          ? 'Never state a face area or the total surface area for the student.'
          : mode === 'identify_solid'
            ? 'Never name the solid for the student.'
            : 'Never state the face/edge/vertex counts for the student.';
  switch (tier) {
    case 'easy':
      return `SUPPORT TIER easy: maximum scaffolding. The fold-line guides are visible on the net; you may point to where the net hinges and folds, and (when face-match highlighting is shown) talk through which net face lines up with which solid face. ${answerGuard}`;
    case 'medium':
      return `SUPPORT TIER medium: the fold-line guides are shown but face-match highlighting is withdrawn. Nudge the student to trace the fold lines themselves; do not call out specific face pairings. ${answerGuard}`;
    default:
      return `SUPPORT TIER hard: the fold-line guides and the face-match highlighting are BOTH withdrawn. Do NOT supply the fold lines or name any face pairing — ask the student to imagine folding the net up edge by edge and reason it out themselves. ${answerGuard}`;
  }
}

// ============================================================================
// Props
// ============================================================================

interface NetFolderProps {
  data: NetFolderData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const EMPTY_WORK: NetWork = { selected: null, total: '', faces: '', edges: '', vertices: '' };
const DEFAULT_ROTATION = { x: -25, y: 35 };

// ============================================================================
// Component
// ============================================================================

const NetFolderSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  NetFolderProps & { tutorOwned: boolean; useController: (options: ProgressOptions<NetFolderChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    solid,
    net,
    challenges = [],
    showOptions = {},
    gradeBand = '3-4',
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showDimensions = true,
    showFaceLabels = true,
    showGridOverlay = false,
    showFaceCorrespondence = true,
    // Support-tier fold scaffolds. Default true = max scaffolding when unset
    // (no tier applied → grade-band defaults stand).
    showFoldGuides = true,
    showFaceMatchHints = true,
    allowRotation = true,
  } = showOptions;

  const stableInstanceIdRef = useRef(instanceId || `net-folder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Challenge progress. On the workspace path the runtime moves the index.
  // -------------------------------------------------------------------------
  /** Bound below, once the setters and the evaluation exist; the progress hook calls them only after render. */
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
    advance: advanceProgress,
  } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const blocked = tutorOwned && progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

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
  const [rotation, setRotation] = useState(DEFAULT_ROTATION);
  const [isFolded, setIsFolded] = useState(true);
  const [highlightedFace, setHighlightedFace] = useState<string | null>(null);
  const [work, setWork] = useState<NetWork>(EMPTY_WORK);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  // In-item levers (`netFolderLevers.ts`), keyed by the session item they were pulled on, and the easier item a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<NetFolderChallenge | null>(null);
  const sessionChallenge = challenges[currentChallengeIndex] ?? null;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice item. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);

  /** The solid drawn for this item (a practice item's own, a surface-area item's box, else the session's). */
  const shownSolid = useMemo(() => itemSolid(solid, currentChallenge), [solid, currentChallenge]);
  const mode = currentChallenge?.type ?? 'identify_solid';
  /** match_faces and valid_net draw the item's own cube net, always open; the others fold and unfold the solid's. */
  const itemNet = mode === 'match_faces' || mode === 'valid_net';
  const netShown = itemNet || !isFolded;
  const foldGuides = showFoldGuides || leverOn(FOLD_GUIDES);
  // Face-match correspondence (tap a net face → its face lights on the solid) is the answer on match_faces and
  // valid_net, so it is never offered there, whatever the flags say.
  const faceMatchEnabled = showFaceCorrespondence && showFaceMatchHints && !itemNet;
  /** An identify item asks for the solid's name: the header and title never print it while the lesson has one. */
  const asksName = challenges.some(c => c.type === 'identify_solid');

  const resetWork = () => {
    setWork(EMPTY_WORK);
    setFeedback('');
    setFeedbackType('');
    setHighlightedFace(null);
  };
  const resetView = () => {
    setRotation(DEFAULT_ROTATION);
    setIsFolded(true);
  };
  openItem.current = (_index, retry) => {
    // Try again keeps the item (a practice item too) and the view; a fresh item (or the full item back) drops both.
    if (retry) resetWork();
    else { setPractice(null); resetWork(); resetView(); }
  };

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<NetFolderMetrics>({
    primitiveType: 'net-folder',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration (scripted path; its context carries the counts, so it is off with the tutor)
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    solidType: solid.type,
    solidName: solid.name,
    faces: solid.faces,
    edges: solid.edges,
    vertices: solid.vertices,
    netLayout: net.layout,
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    challengeType: currentChallenge?.type ?? 'identify_solid',
    instruction: currentChallenge?.instruction ?? '',
    attemptNumber: currentAttempts + 1,
    isFolded,
    supportTier: supportTier ?? null,
  }), [
    solid, net.layout, gradeBand, challenges.length,
    currentChallengeIndex, currentChallenge, currentAttempts, isFolded, supportTier,
  ]);

  const revealPolicy = tutorRevealPolicy(supportTier, currentChallenge?.type ?? 'identify_solid');

  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'net-folder',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '3-4' ? 'Grade 3-4' : 'Grade 4-5',
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] This is a 3D shapes activity${asksName ? '' : ` about ${solid.name} (${solid.type})`}. `
      + `The student will explore a solid, its net, and answer ${challenges.length} challenges. `
      + `Grade band: ${gradeBand}. `
      + `Introduce warmly: "Today we're going to explore a 3D shape! Let's discover its faces, edges, and how it unfolds."`
      + (revealPolicy ? ` ${revealPolicy}` : ''),
      { silent: true }
    );
  }, [isConnected, challenges.length, solid, gradeBand, revealPolicy, sendText, asksName]);

  // -------------------------------------------------------------------------
  // Rotation and face taps
  // -------------------------------------------------------------------------
  const handleRotate = useCallback((delta: { x: number; y: number }) => {
    setRotation(prev => ({
      x: Math.max(-90, Math.min(90, prev.x + delta.x)),
      y: prev.y + delta.y,
    }));
  }, []);

  const handleFaceClick = useCallback((label: string) => {
    if (!faceMatchEnabled || !label) return;
    SoundManager.tap();
    setHighlightedFace(prev => prev === label ? null : label);
  }, [faceMatchEnabled]);

  // -------------------------------------------------------------------------
  // Check
  // -------------------------------------------------------------------------
  const inputClosed = allChallengesComplete || hasSubmittedEvaluation || blocked
    || challengeResults.some(r => r.challengeId === sessionChallenge?.id && r.correct && !practice);

  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation || learnerBlocked()) return;
    const ch = currentChallenge;
    const correct = netCorrect(ch, shownSolid, work);
    const response = describeNetWork(ch, work);

    if (correct) {
      SoundManager.playCorrect();
      setFeedbackType('success');
      switch (ch.type) {
        case 'identify_solid': setFeedback(`Correct! This is a ${solidWords(String(ch.targetAnswer))}.`); break;
        case 'match_faces': setFeedback(`Yes! The yellow square folds up to become the ${matchTarget(ch)} face.`); break;
        case 'valid_net': setFeedback(`Correct! This net ${netFolds(ch) ? 'folds' : 'does NOT fold'} into a cube. ${ch.netExplanation ?? ''}`); break;
        case 'surface_area': setFeedback(`Correct! The surface area is ${surfaceTotal(ch)} ${ch.unitLabel || 'square units'}.`); break;
        case 'count_faces_edges_vertices': {
          const c = countsOf(shownSolid);
          setFeedback(`Correct! It has ${c.faces} faces, ${c.edges} edges, and ${c.vertices} vertices.`);
          break;
        }
      }
      sendText(`[ANSWER_CORRECT] Student answered the ${ch.type} challenge correctly (${response}). Celebrate briefly.`, { silent: true });
      progress.commitCheck(response, true);
      return;
    }

    SoundManager.playIncorrect();
    setFeedbackType('error');
    switch (ch.type) {
      case 'identify_solid': setFeedback('Not quite. Look at the faces and the base carefully and try again!'); break;
      case 'match_faces': setFeedback('Not quite. Fold the net in your mind, one square at a time, starting from the front.'); break;
      case 'valid_net': setFeedback('Not quite. Imagine folding each square up. Does every square land on its own face?'); break;
      case 'surface_area': setFeedback('Not quite. Find the area of each face, then add all of them up.'); break;
      case 'count_faces_edges_vertices': {
        // Which counts are off, never their right values: a retry would copy them.
        const c = countsOf(shownSolid), n = (s: string) => Number(s);
        const off = [n(work.faces) !== c.faces && 'faces', n(work.edges) !== c.edges && 'edges', n(work.vertices) !== c.vertices && 'vertices']
          .filter(Boolean);
        setFeedback(`Not quite. Check your count of the ${off.join(' and ')}.`);
        break;
      }
    }
    sendText(
      `[ANSWER_INCORRECT] Student ${response} on a ${ch.type} challenge. Hint: "${ch.hint}"`
      + (revealPolicy ? ` ${revealPolicy}` : ''),
      { silent: true },
    );
    progress.commitCheck(response, false, netFolderMiss(ch, shownSolid, work));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge, hasSubmittedEvaluation, shownSolid, work, sendText, revealPolicy, progress.commitCheck]);

  // -------------------------------------------------------------------------
  // Advance (scripted path; the workspace path hides Next and the runtime advances)
  // -------------------------------------------------------------------------
  const metricsFrom = (solved: (type: string) => { correct: number; total: number }, totalAttempts: number, accuracy: number): NetFolderMetrics => {
    const id = solved('identify_solid'), match = solved('match_faces'), valid = solved('valid_net');
    const area = solved('surface_area'), fev = solved('count_faces_edges_vertices');
    return {
      type: 'net-folder',
      evalMode: challenges[0]?.type ?? 'default',
      solidsIdentified: id.correct, solidsTotal: id.total,
      facesMatchedCorrectly: match.correct, facesTotal: match.total,
      validNetsIdentified: valid.correct, netsTotal: valid.total,
      surfaceAreaCorrect: area.correct, surfaceAreaTotal: area.total,
      facesEdgesVerticesCounted: fev.correct === fev.total && fev.total > 0,
      totalAttempts,
      accuracy,
    };
  };

  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      const overallPct = Math.round((challengeResults.filter(r => r.correct).length / Math.max(challenges.length, 1)) * 100);
      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ')}. `
        + `Overall: ${overallPct}%. Give encouraging phase-specific feedback about their 3D shape understanding!`,
        { silent: true }
      );
      if (!hasSubmittedEvaluation && progress.recordsEvaluation !== false && !tutorOwned) {
        const correct = challengeResults.filter(r => r.correct).length;
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
        const score = Math.round((correct / Math.max(challenges.length, 1)) * 100);
        const byType = (type: string) => {
          const ofType = challengeResults.filter(r => challenges.find(c => c.id === r.challengeId)?.type === type);
          return { correct: ofType.filter(r => r.correct).length, total: ofType.length };
        };
        submitEvaluation(correct === challenges.length, score, metricsFrom(byType, totalAttempts, score), { challengeResults });
      }
      return;
    }
    resetWork();
    resetView();
    const next = challenges[currentChallengeIndex + 1];
    if (next) {
      sendText(
        `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. `
        + `Type: ${next.type}. Instruction: "${next.instruction}". Introduce it briefly.`
        + (() => { const p = tutorRevealPolicy(supportTier, next.type); return p ? ` ${p}` : ''; })(),
        { silent: true }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceProgress, phaseResults, challengeResults, challenges, currentChallengeIndex, hasSubmittedEvaluation,
    supportTier, sendText, submitEvaluation, tutorOwned, progress.recordsEvaluation]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmittedEvaluation || challenges.length === 0) return;
    const byType = (type: string) => {
      const ofType = result.outcomes.filter(o => challenges.find(c => c.id === o.id)?.type === type);
      return { correct: ofType.filter(o => o.solved).length, total: challenges.filter(c => c.type === type).length };
    };
    submitEvaluation(result.passed, result.accuracy, metricsFrom(byType, result.attemptsCount, result.accuracy),
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // -------------------------------------------------------------------------
  // Check readiness
  // -------------------------------------------------------------------------
  const canCheck = useMemo(() => {
    if (!currentChallenge) return false;
    switch (currentChallenge.type) {
      case 'identify_solid':
      case 'match_faces':
      case 'valid_net':
        return work.selected !== null;
      case 'surface_area':
        return work.total.trim() !== '';
      case 'count_faces_edges_vertices':
        return work.faces.trim() !== '' && work.edges.trim() !== '' && work.vertices.trim() !== '';
      default:
        return false;
    }
  }, [currentChallenge, work]);

  const currentSolved = !practice && challengeResults.some(r => r.challengeId === sessionChallenge?.id && r.correct);
  const practiceSolved = !!practice && feedbackType === 'success';
  const showNextButton = !tutorOwned && currentSolved;

  // -------------------------------------------------------------------------
  // Nets
  // -------------------------------------------------------------------------
  const cellFold = useMemo(() => (currentChallenge?.netCells?.length
    ? foldCubeCells(currentChallenge.netCells as Cell[], currentChallenge.anchorCells?.[0] ?? 0) : null), [currentChallenge]);
  const surfaceDims = currentChallenge?.type === 'surface_area' ? boxDims(currentChallenge.faceDimensions) : null;
  const netFaces = useMemo<NetFace[]>(() => {
    if (itemNet && currentChallenge?.netCells?.length) return cellNet(currentChallenge.netCells as Cell[]);
    if (surfaceDims) return boxNet(surfaceDims[0], surfaceDims[1], surfaceDims[2]);
    if (itemNet) return cellNet(cellsOf(CROSS_NET)); // a legacy item with no net of its own
    return solidNet(shownSolid, net.layout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemNet, currentChallenge, shownSolid, net.layout, surfaceDims?.join()]);

  const thirdCell = leverOn(THIRD_LABEL) && sessionChallenge ? thirdLabelCell(sessionChallenge) : null;
  /** match_list: each surface face's place in the face list (greedy on equal dimensions). */
  const listPlace = useMemo(() => {
    const out = new Map<string, number>();
    if (!surfaceDims || !currentChallenge?.faceDimensions) return out;
    const used = new Set<number>();
    for (const f of netFaces) {
      const xs = f.points.map(p => p[0]), ys = f.points.map(p => p[1]);
      const a = Math.max(...xs) - Math.min(...xs), b = Math.max(...ys) - Math.min(...ys);
      const i = currentChallenge.faceDimensions.findIndex((d, k) => !used.has(k)
        && Math.min(d.width, d.height) === Math.min(a, b) && Math.max(d.width, d.height) === Math.max(a, b));
      if (i >= 0) { used.add(i); out.set(f.id, i); }
    }
    return out;
  }, [netFaces, surfaceDims, currentChallenge]);
  const pairOf = (w: number, h: number) => {
    if (!surfaceDims) return 0;
    const [l, wd, ht] = surfaceDims, key = [Math.min(w, h), Math.max(w, h)].join('x');
    return [[l, wd], [l, ht], [wd, ht]].findIndex(([a, b]) => [Math.min(a, b), Math.max(a, b)].join('x') === key);
  };

  const netLabel = (f: NetFace, i: number): string => {
    if (mode === 'match_faces') {
      if (!cellFold) return '';
      const anchors = currentChallenge?.anchorCells ?? [];
      return anchors.includes(i) || thirdCell === i ? cellFold.faces[i] ?? '' : '';
    }
    if (mode === 'valid_net') return '';
    if (leverOn(MATCH_LIST) && listPlace.has(f.id)) return String(listPlace.get(f.id)! + 1);
    return showFaceLabels ? f.label : '';
  };
  const netFill = (f: NetFace, i: number): string => {
    if (itemNet) return mode === 'match_faces' && !(currentChallenge?.anchorCells ?? []).includes(i) && thirdCell !== i ? BLANK_FILL
      : mode === 'valid_net' ? 'rgba(99, 102, 241, 0.7)' : FACE_COLORS[i % FACE_COLORS.length];
    if (leverOn(PAIR_COLORS) && surfaceDims) {
      const xs = f.points.map(p => p[0]), ys = f.points.map(p => p[1]);
      return PAIR_FILLS[Math.max(0, pairOf(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)))];
    }
    return FACE_COLORS[i % FACE_COLORS.length];
  };
  const highlightId = mode === 'match_faces' && typeof currentChallenge?.highlightCell === 'number'
    ? `cell-${currentChallenge.highlightCell}` : null;

  // -------------------------------------------------------------------------
  // Workspace path: what the tutor and the observer are shown, republished every render. No demonstration, no
  // presentation; every mode declares levers (`netFolderLevers.ts`).
  // -------------------------------------------------------------------------
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, { ...work, solid: shownSolid, netShown, showLabels: showFaceLabels, foldGuides });
    const sessionSolid = itemSolid(solid, sessionChallenge);
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers);
    const levers = practice ? [] : netLevers(sessionChallenge, pulledLevers, { solid: sessionSolid, foldGuidesShown: showFoldGuides, netShown: netShown && !leverOn(NET_BESIDE) });
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}), ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = simplerNet(sessionChallenge, sessionSolid);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetWork(); resetView();
          return { practice: workspaceAssignment(easier) };
        }
        if (id === NET_BESIDE && netShown) return 'The net is already open beside the solid.';
        if (id === NET_BESIDE || id === MATCH_LIST) setIsFolded(false);
        if (id === TURN_TO_BASE) setRotation(baseView(sessionSolid.type));
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetWork(); resetView(); },
    };
  });

  // -------------------------------------------------------------------------
  // Render challenge UI
  // -------------------------------------------------------------------------
  const setField = (field: keyof NetWork, value: string | null) => {
    if (inputClosed || learnerBlocked()) return;
    setWork(prev => ({ ...prev, [field]: value }));
  };
  const choose = (value: string) => {
    if (inputClosed || learnerBlocked()) return;
    SoundManager.select();
    setWork(prev => ({ ...prev, selected: value }));
  };
  const optionClass = (on: boolean) => (on ? 'bg-indigo-600/40 border-indigo-400 text-white' : '');

  const renderChallengeInput = () => {
    if (!currentChallenge) return null;
    switch (currentChallenge.type) {
      case 'identify_solid':
        return (
          <div className="flex flex-wrap gap-2">
            {(currentChallenge.options || []).map(opt => (
              <LuminaButton key={opt} onClick={() => choose(opt)} disabled={inputClosed || blocked}
                className={optionClass(work.selected === opt)}>
                {solidWords(opt)}
              </LuminaButton>
            ))}
          </div>
        );
      case 'match_faces':
        return (
          <div className="flex flex-wrap gap-2">
            {(currentChallenge.faceOptions || []).map(opt => (
              <LuminaButton key={opt} onClick={() => choose(opt)} disabled={inputClosed || blocked}
                className={optionClass(work.selected === opt)}>
                {opt}
              </LuminaButton>
            ))}
          </div>
        );
      case 'valid_net':
        return (
          <div className="flex gap-3">
            <LuminaButton aria-label="Valid net" onClick={() => choose('valid')} disabled={inputClosed || blocked}
              className={`flex-1 ${work.selected === 'valid' ? 'bg-emerald-600/40 border-emerald-400 text-white' : ''}`}>
              Valid Net ✓
            </LuminaButton>
            <LuminaButton aria-label="Invalid net" onClick={() => choose('invalid')} disabled={inputClosed || blocked}
              className={`flex-1 ${work.selected === 'invalid' ? 'bg-red-600/40 border-red-400 text-white' : ''}`}>
              Invalid Net ✗
            </LuminaButton>
          </div>
        );
      case 'surface_area':
        return (
          <div className="space-y-3">
            {currentChallenge.faceDimensions && (
              <div className="flex flex-wrap gap-2">
                {currentChallenge.faceDimensions.map((fd, i) => (
                  <LuminaBadge key={i}
                    {...(leverOn(PAIR_COLORS) && surfaceDims ? { style: { backgroundColor: PAIR_FILLS[Math.max(0, pairOf(fd.width, fd.height))] } } : {})}>
                    Face {i + 1}: {fd.width} × {fd.height} = {fd.width * fd.height}
                  </LuminaBadge>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <LuminaInput
                type="number"
                inputMode="numeric"
                aria-label="Total surface area"
                value={work.total}
                onChange={e => setField('total', e.target.value)}
                disabled={inputClosed || blocked}
                placeholder="Total"
                className="w-40"
              />
              <span className="text-slate-400 text-sm">{currentChallenge.unitLabel || 'square units'}</span>
            </div>
          </div>
        );
      case 'count_faces_edges_vertices':
        return (
          <div className="grid grid-cols-3 gap-3">
            {(['faces', 'edges', 'vertices'] as const).map(field => (
              <div key={field}>
                <label className="text-xs text-slate-400 mb-1 block capitalize">{field}</label>
                <LuminaInput
                  type="number"
                  inputMode="numeric"
                  aria-label={field[0].toUpperCase() + field.slice(1)}
                  value={work[field]}
                  onChange={e => setField(field, e.target.value)}
                  disabled={inputClosed || blocked}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const localOverallScore = challenges.length > 0
    ? Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100)
    : 0;

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete || hasSubmittedEvaluation ? null : currentChallenge?.id ?? null,
    label: 'The solid, its net, and the challenge',
    solved: currentSolved,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  const shownTitle = asksName ? title.split(solid.name).join('a 3D Shape') : title;
  const shownDescription = asksName && description ? description.split(solid.name).join('a 3D shape')
    .split(solid.name.toLowerCase()).join('a 3D shape') : description;
  const dims = surfaceDims
    ? { length: surfaceDims[0], width: surfaceDims[1], height: surfaceDims[2] }
    : shownSolid.dimensions;
  const seeThrough = leverOn(SEE_THROUGH);
  const outline = leverOn(BASE_OUTLINE) ? baseFaces(shownSolid.type) : [];
  const [modelPrism, modelPyramid] = familyModelSolids(String(sessionChallenge?.targetAnswer ?? ''));
  const pictures = !practice && sessionChallenge && [PART_NAMES, FAMILY_MODEL, OPPOSITE_RULE, SIX_FACES_MODEL, WRAP_MODEL,
    VALID_MODEL, AREA_VS_VOLUME].some(leverOn);

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <LuminaCardTitle>{shownTitle}</LuminaCardTitle>
            {shownDescription && <p className="text-sm text-slate-400 mt-1">{shownDescription}</p>}
          </div>
          <div className="flex items-center gap-2">
            {challenges.length > 0 && (
              <LuminaBadge>
                {Math.min(currentChallengeIndex + 1, challenges.length)} / {challenges.length}
              </LuminaBadge>
            )}
            {/* The solid's name is the answer to an identify item. */}
            {!asksName && <LuminaBadge>{shownSolid.name}</LuminaBadge>}
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {showDimensions && mode !== 'match_faces' && mode !== 'valid_net' && (
          <div className="flex flex-wrap gap-2">
            {dims.length != null && <LuminaBadge>L: {dims.length}</LuminaBadge>}
            {dims.width != null && <LuminaBadge>W: {dims.width}</LuminaBadge>}
            {dims.height != null && <LuminaBadge>H: {dims.height}</LuminaBadge>}
            {dims.radius != null && <LuminaBadge>R: {dims.radius}</LuminaBadge>}
          </div>
        )}

        {/* Pip's dock sits above the workspace, which it outlines as a region. */}
        {pip.store && !allChallengesComplete && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LuminaPanel>
            <div className="text-xs text-slate-400 text-center mb-2 font-medium">3D Solid</div>
            <SolidViewer
              solid={shownSolid}
              rotation={rotation}
              highlightedFace={highlightedFace}
              onFaceClick={faceMatchEnabled ? handleFaceClick : undefined}
              showLabels={showFaceLabels}
              allowRotation={allowRotation}
              onRotate={handleRotate}
              seeThrough={seeThrough}
              outline={outline}
            />
            {allowRotation && <div className="text-center text-[10px] text-slate-500">Drag to rotate</div>}
          </LuminaPanel>

          <LuminaPanel>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium">2D Net</span>
              {!itemNet && (
                <LuminaButton
                  size="sm"
                  onClick={() => { SoundManager.toggle(isFolded); setIsFolded(prev => !prev); }}
                  className="text-xs text-slate-300 h-6 px-2"
                >
                  {isFolded ? 'Unfold' : 'Fold'}
                </LuminaButton>
              )}
            </div>
            {netShown ? (
              <NetDisplay
                faces={netFaces}
                labelFor={netLabel}
                fillFor={netFill}
                highlightId={highlightId}
                showFoldGuides={foldGuides}
                showGrid={showGridOverlay || !!surfaceDims}
                onFaceClick={faceMatchEnabled ? handleFaceClick : undefined}
              />
            ) : (
              <SolidViewer
                solid={shownSolid}
                rotation={DEFAULT_ROTATION}
                highlightedFace={highlightedFace}
                onFaceClick={faceMatchEnabled ? handleFaceClick : undefined}
                showLabels={showFaceLabels}
                allowRotation={false}
                seeThrough={seeThrough}
                outline={outline}
                label="The solid, folded"
              />
            )}
          </LuminaPanel>
        </div>

        {/* Lever pictures outside the item: never the item's solid or net, no number. */}
        {pictures && (
          <div className="flex flex-wrap justify-center gap-4">
            {leverOn(PART_NAMES) && (
              <ModelFigure lever="part-names" caption="Face: a flat side. Edge: where two faces meet. Vertex: a corner where edges meet.">
                <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
                  <polygon points="20,20 90,20 90,70 20,70" fill="rgba(148,163,184,0.5)" stroke="white" />
                  <text x="55" y="48" textAnchor="middle" fontSize="10" fill="white">face</text>
                  <line x1="90" y1="20" x2="90" y2="70" stroke={GOLD} strokeWidth="3" />
                  <text x="104" y="48" fontSize="10" fill={GOLD}>edge</text>
                  <circle cx="20" cy="20" r="4" fill="#38bdf8" />
                  <text x="6" y="12" fontSize="10" fill="#38bdf8">vertex</text>
                </svg>
              </ModelFigure>
            )}
            {leverOn(FAMILY_MODEL) && (
              <>
                <ModelFigure lever="family-model-prism" caption="A prism: two matching ends joined by flat sides.">
                  <SolidViewer solid={solidOf(modelPrism)} rotation={DEFAULT_ROTATION} highlightedFace={null} showLabels={false}
                    allowRotation={false} size={100} label="A prism, outside the item" />
                </ModelFigure>
                <ModelFigure lever="family-model-pyramid" caption="A pyramid: one base, and its other faces meet at a point.">
                  <SolidViewer solid={solidOf(modelPyramid)} rotation={DEFAULT_ROTATION} highlightedFace={null} showLabels={false}
                    allowRotation={false} size={100} label="A pyramid, outside the item" />
                </ModelFigure>
              </>
            )}
            {leverOn(OPPOSITE_RULE) && (
              <ModelFigure lever="opposite-rule" caption="In a straight row, two squares with one square between them land on opposite faces.">
                <MiniCells cells={[[0, 0], [0, 1], [0, 2]]} marks={[0, 2]} unit={24} />
              </ModelFigure>
            )}
            {leverOn(SIX_FACES_MODEL) && (
              <ModelFigure lever="six-faces-model" caption="A cube has six faces, so its net has one square for each face.">
                <SolidViewer solid={solidOf('cube')} rotation={DEFAULT_ROTATION} highlightedFace={null} showLabels={false}
                  allowRotation={false} size={80} label="A cube, outside the item" />
              </ModelFigure>
            )}
            {leverOn(WRAP_MODEL) && (
              <ModelFigure lever="wrap-model" caption="Four squares in a row wrap all the way round. A square that lands where another already is leaves a face open.">
                <MiniCells cells={[[0, 0], [0, 1], [0, 2], [0, 3]]} marks={[0]} unit={22} />
              </ModelFigure>
            )}
            {leverOn(VALID_MODEL) && (
              <ModelFigure lever="valid-model" caption="Each square of this net folds onto its own face of the cube.">
                <MiniCells cells={validModelNet(sessionChallenge?.netCells as Cell[] | undefined)} unit={16} />
              </ModelFigure>
            )}
            {leverOn(AREA_VS_VOLUME) && (
              <ModelFigure lever="area-vs-volume" caption="Surface area covers the outside: add the area of every face. Volume fills the inside.">
                <svg width="150" height="70" viewBox="0 0 150 70" aria-hidden="true">
                  <rect x="8" y="15" width="55" height="45" fill="none" stroke={GOLD} strokeWidth="4" />
                  <text x="35" y="10" textAnchor="middle" fontSize="9" fill={GOLD}>outside</text>
                  {Array.from({ length: 6 }, (_, i) => (
                    <rect key={i} x={85 + (i % 3) * 18} y={15 + Math.floor(i / 3) * 22} width="16" height="20" fill="rgba(56,189,248,0.6)" stroke="white" />
                  ))}
                  <text x="112" y="10" textAnchor="middle" fontSize="9" fill="#38bdf8">inside</text>
                </svg>
              </ModelFigure>
            )}
          </div>
        )}

        {/* Challenge area */}
        {currentChallenge && !allChallengesComplete && (
          <LuminaPanel className="space-y-3">
            <div className="flex items-center gap-2">
              <LuminaBadge accent="blue">
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </LuminaBadge>
              {practice && <LuminaBadge accent="amber">Practice</LuminaBadge>}
            </div>
            <p className="text-slate-200 font-medium">{currentChallenge.instruction}</p>

            {renderChallengeInput()}

            {feedback && (
              <div
                className={`rounded-md p-3 text-sm ${
                  feedbackType === 'success'
                    ? 'bg-emerald-900/30 border border-emerald-500/30 text-emerald-300'
                    : feedbackType === 'error'
                    ? 'bg-red-900/30 border border-red-500/30 text-red-300'
                    : 'bg-blue-900/30 border border-blue-500/30 text-blue-300'
                }`}
              >
                {feedback}
              </div>
            )}

            {/* Action buttons. On the workspace path the shell's Try again / Next challenge replace Next. */}
            <div className="flex gap-2">
              {!currentSolved && !practiceSolved && (
                <LuminaActionButton
                  action="check"
                  onClick={handleCheckAnswer}
                  disabled={!canCheck || hasSubmittedEvaluation || blocked}
                />
              )}
              {showNextButton && (
                <LuminaActionButton
                  action="next"
                  onClick={advanceToNextChallenge}
                >
                  {currentChallengeIndex + 1 < challenges.length ? 'Next Challenge →' : 'Finish!'}
                </LuminaActionButton>
              )}
            </div>
          </LuminaPanel>
        )}

        </div>

        {/* Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage="You explored 3D solids and their nets and completed all challenges!"
            className="mb-6"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const NetFolder = withWorkspaceController<NetFolderProps, ProgressOptions<NetFolderChallenge>, Progress>(
  'net-folder', NetFolderSurface, useScriptedProgress, useWorkspaceProgressFor('net-folder'));

export default NetFolder;
