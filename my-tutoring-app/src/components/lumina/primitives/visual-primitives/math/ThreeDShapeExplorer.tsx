'use client';

/**
 * ThreeDShapeExplorer — solids, flat shapes, everyday objects and riddles; every answer is
 * spoken. It runs only on the shared tutor/JEV teaching workspace (workspace rollout C4; the
 * scripted runner was retired, LA-14, user ruling 09-23: one path). The observer judges the
 * spoken answer and the runtime owns progression. An unbound mount shows the shared "needs the
 * tutor" card.
 *
 * In-item levers (`threeDShapeExplorerLevers.ts`, /add-support-tiers 2026-10-08) change what is drawn: dashed back
 * edges, face prints, tinted surfaces, a turned copy, a shelf of the five solids, a model card, or an easier count.
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle,
  LuminaChallengeCounter, LuminaPanel, LuminaReadAloudGlyph,
} from '../../../ui';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { ThreeDShapeExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import {
  SHAPE_FACTS, SHAPE_LABELS, THREE_D_SHAPES, buildThreeDShapeItems, supportForItem,
  wrapperTextForSession, type PropertyKey, type ThreeDShapeChallengeLike,
  type ThreeDShapeItem, type ThreeDShapeMode, type ThreeDShapeName,
} from './threeDShapeExplorerScript';
import { hearQuestionRequest, threeDShapeAssignment, threeDShapeScene } from './threeDShapeExplorerWorkspace';
import {
  EDGE_VIEW, FACE_PRINTS, MODEL_OBJECT, MODEL_PROPERTY, SEE_THROUGH, SOLID_SHELF, TINT_SURFACES,
  modelObjectFor, modelPropertyFor, simplerFaces, startingLevers, threeDShapeLeverFacts, threeDShapeLevers,
  type ModelProperty,
} from './threeDShapeExplorerLevers';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { stimulusPipPose } from '../../../pip/stimulusPipPose';
import { PIP_DOCK_CLASS } from '../../../pip/useWorkspacePipSurface';

export interface ThreeDShapeExplorerChallenge extends ThreeDShapeChallengeLike {}

export interface ThreeDShapeExplorerData {
  title: string;
  description?: string;
  challenges: ThreeDShapeExplorerChallenge[];
  gradeBand?: 'K' | '1';
  showUnfoldAnimation?: boolean;
  show3dRotation?: boolean;
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ThreeDShapeExplorerMetrics>) => void;
}

const MODE_META: Record<ThreeDShapeMode, {
  label: string; icon: string; accent: 'blue' | 'purple' | 'emerald' | 'amber' | 'cyan';
}> = {
  'identify-3d': { label: 'Identify 3D', icon: '🔷', accent: 'blue' },
  '2d-vs-3d': { label: 'Flat or Solid', icon: '📐', accent: 'purple' },
  'match-to-real-world': { label: 'Real World', icon: '🌍', accent: 'emerald' },
  'faces-and-properties': { label: 'Properties', icon: '🔍', accent: 'amber' },
  'shape-riddle': { label: 'Shape Riddle', icon: '🕵️', accent: 'cyan' },
};

const elementLabels: Record<string, string[]> = {
  cube: ['flat faces', 'edges', 'corners'], sphere: ['curved surface'],
  cylinder: ['flat circular faces', 'curved surface', 'edges'],
  cone: ['flat circular face', 'curved surface', 'point'],
  'rectangular-prism': ['flat rectangular faces', 'edges', 'corners'],
};

/** Lever tints: flat faces amber, curved surfaces blue. */
const FLAT = ['#f59e0b', '#d97706', '#b45309'];
const CURVED = '#0ea5e9';

/**
 * The pseudo-3D solid, the visual stimulus. `tint` (lever) colours flat faces amber and curved surfaces blue;
 * `seeThrough` (lever) adds dashed lines for the back edges and curves.
 */
export function Shape3DSVG({ shape, size = 180, className, tint = false, seeThrough = false }: {
  shape: string; size?: number; className?: string; tint?: boolean; seeThrough?: boolean;
}) {
  const cx = size / 2, cy = size / 2, s = size * 0.35, id = `${shape}-${size}${tint ? '-t' : ''}`;
  const dash = { stroke: 'rgba(255,255,255,.85)', strokeWidth: 1.5, strokeDasharray: '5 4', fill: 'none', 'data-see-through': 'true' } as const;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label="Solid shape">
      <defs>
        <radialGradient id={`sphere-${id}`} cx="35%" cy="30%"><stop offset="0%" stopColor="#93c5fd" /><stop offset="70%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#1e3a8a" /></radialGradient>
        <linearGradient id={`purple-${id}`} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#4c1d95" /></linearGradient>
        <linearGradient id={`teal-${id}`} x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#2dd4bf" /><stop offset="50%" stopColor="#14b8a6" /><stop offset="100%" stopColor="#0f766e" /></linearGradient>
        <linearGradient id={`amber-${id}`} x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#b45309" /></linearGradient>
        <linearGradient id={`pink-${id}`} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f472b6" /><stop offset="100%" stopColor="#9d174d" /></linearGradient>
      </defs>
      {shape === 'sphere' && <>
        <circle cx={cx} cy={cy} r={s} fill={tint ? CURVED : `url(#sphere-${id})`} data-surface={tint ? 'curved' : undefined} />
        <ellipse cx={cx} cy={cy} rx={s} ry={s * .15} fill="none" stroke="rgba(255,255,255,.2)" strokeDasharray="4 3" />
        <ellipse cx={cx-s*.15} cy={cy-s*.2} rx={s*.15} ry={s*.08} fill="rgba(255,255,255,.25)" />
        {seeThrough && <><ellipse cx={cx} cy={cy} rx={s} ry={s * .3} {...dash} /><ellipse cx={cx} cy={cy} rx={s * .3} ry={s} {...dash} /></>}
      </>}
      {shape === 'cube' && (() => {
        const h=s*.8, dx=s*.6, dy=s*.35;
        const top=`${cx},${cy-h} ${cx+dx},${cy-h+dy} ${cx},${cy-h+2*dy} ${cx-dx},${cy-h+dy}`;
        const left=`${cx-dx},${cy-h+dy} ${cx},${cy-h+2*dy} ${cx},${cy+dy} ${cx-dx},${cy}`;
        const right=`${cx+dx},${cy-h+dy} ${cx},${cy-h+2*dy} ${cx},${cy+dy} ${cx+dx},${cy}`;
        const back = [cx, cy - dy];
        return <>
          <polygon points={left} fill={tint ? FLAT[1] : '#5b21b6'} data-surface={tint ? 'flat' : undefined} />
          <polygon points={right} fill={tint ? FLAT[2] : '#4c1d95'} data-surface={tint ? 'flat' : undefined} />
          <polygon points={top} fill={tint ? FLAT[0] : `url(#purple-${id})`} data-surface={tint ? 'flat' : undefined} />
          {seeThrough && <>
            <line x1={back[0]} y1={back[1]} x2={cx-dx} y2={cy} {...dash} />
            <line x1={back[0]} y1={back[1]} x2={cx+dx} y2={cy} {...dash} />
            <line x1={back[0]} y1={back[1]} x2={cx} y2={cy-h} {...dash} />
          </>}
        </>;
      })()}
      {shape === 'cylinder' && (() => { const rx=s*.7, ry=s*.2, top=cy-s*.5, bottom=cy+s*.5; return <>
        <rect x={cx-rx} y={top} width={rx*2} height={s} fill={tint ? CURVED : `url(#teal-${id})`} data-surface={tint ? 'curved' : undefined} />
        <ellipse cx={cx} cy={bottom} rx={rx} ry={ry} fill={tint ? FLAT[2] : '#0f766e'} data-surface={tint ? 'flat' : undefined} />
        <ellipse cx={cx} cy={top} rx={rx} ry={ry} fill={tint ? FLAT[0] : '#5eead4'} data-surface={tint ? 'flat' : undefined} />
        {seeThrough && <><ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...dash} /><line x1={cx} y1={top} x2={cx} y2={bottom} {...dash} /></>}
      </>; })()}
      {shape === 'cone' && (() => { const rx=s*.7, ry=s*.2, bottom=cy+s*.5, tip=cy-s*.8, mid=(bottom+tip)/2; return <>
        <path d={`M${cx-rx},${bottom} Q${cx},${bottom+ry*2} ${cx+rx},${bottom} L${cx},${tip} Z`} fill={tint ? CURVED : `url(#amber-${id})`} data-surface={tint ? 'curved' : undefined} />
        <ellipse cx={cx} cy={bottom} rx={rx} ry={ry} fill={tint ? FLAT[2] : '#92400e'} data-surface={tint ? 'flat' : undefined} />
        {seeThrough && <><ellipse cx={cx} cy={mid} rx={rx / 2} ry={ry / 2} {...dash} /><line x1={cx} y1={tip} x2={cx} y2={bottom} {...dash} /></>}
      </>; })()}
      {shape === 'rectangular-prism' && (() => {
        const left=`${cx-s},${cy-s*.35} ${cx+s*.35},${cy-s*.35} ${cx+s*.35},${cy+s*.55} ${cx-s},${cy+s*.55}`;
        const top=`${cx-s},${cy-s*.35} ${cx-s*.55},${cy-s*.7} ${cx+s*.8},${cy-s*.7} ${cx+s*.35},${cy-s*.35}`;
        const right=`${cx+s*.35},${cy-s*.35} ${cx+s*.8},${cy-s*.7} ${cx+s*.8},${cy+s*.2} ${cx+s*.35},${cy+s*.55}`;
        const hx = cx - s * .55, hy = cy + s * .2;
        return <>
          <polygon points={left} fill={tint ? FLAT[1] : '#be185d'} data-surface={tint ? 'flat' : undefined} />
          <polygon points={right} fill={tint ? FLAT[2] : '#9d174d'} data-surface={tint ? 'flat' : undefined} />
          <polygon points={top} fill={tint ? FLAT[0] : `url(#pink-${id})`} data-surface={tint ? 'flat' : undefined} />
          {seeThrough && <>
            <line x1={hx} y1={hy} x2={hx} y2={cy-s*.7} {...dash} />
            <line x1={hx} y1={hy} x2={cx-s} y2={cy+s*.55} {...dash} />
            <line x1={hx} y1={hy} x2={cx+s*.8} y2={cy+s*.2} {...dash} />
          </>}
        </>;
      })()}
    </svg>
  );
}

/** Code-owned 2D drawings replace the old semantic-emoji shortcut. */
export function Shape2DSVG({ shape, size = 150 }: { shape: string; size?: number }) {
  const c=size/2, r=size*.35;
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Flat shape">
    {shape === 'circle' && <circle cx={c} cy={c} r={r} fill="#60a5fa" stroke="#93c5fd" strokeWidth={3} />}
    {shape === 'square' && <rect x={c-r} y={c-r} width={r*2} height={r*2} fill="#a78bfa" stroke="#c4b5fd" strokeWidth={3} />}
    {shape === 'triangle' && <polygon points={`${c},${c-r} ${c+r},${c+r} ${c-r},${c+r}`} fill="#34d399" stroke="#6ee7b7" strokeWidth={3} />}
    {shape === 'rectangle' && <rect x={c-r*1.3} y={c-r*.7} width={r*2.6} height={r*1.4} fill="#f472b6" stroke="#f9a8d4" strokeWidth={3} />}
  </svg>;
}

/** face_prints lever: each flat face drawn flat, once, unnumbered. A prism's faces come in three sizes. */
const PRINTS: Record<ThreeDShapeName, Array<{ round: boolean; w: number; h: number }>> = {
  cube: Array.from({ length: 6 }, () => ({ round: false, w: 28, h: 28 })),
  'rectangular-prism': [[40, 24], [40, 24], [40, 14], [40, 14], [24, 14], [24, 14]].map(([w, h]) => ({ round: false, w, h })),
  cylinder: [{ round: true, w: 30, h: 30 }, { round: true, w: 30, h: 30 }],
  cone: [{ round: true, w: 30, h: 30 }],
  sphere: [],
};
function FacePrints({ shape }: { shape: ThreeDShapeName }) {
  return <div data-lever={FACE_PRINTS} className="flex flex-wrap items-center justify-center gap-2" aria-label="Flat faces, printed">
    {PRINTS[shape].map((p, i) => <svg key={i} data-face-print width={p.w + 4} height={p.h + 4} aria-hidden>
      {p.round ? <ellipse cx={(p.w + 4) / 2} cy={(p.h + 4) / 2} rx={p.w / 2} ry={p.h / 2} fill="rgba(245,158,11,.25)" stroke="#f59e0b" strokeWidth={2} />
        : <rect x={2} y={2} width={p.w} height={p.h} fill="rgba(245,158,11,.25)" stroke="#f59e0b" strokeWidth={2} />}
    </svg>)}
  </div>;
}

/** edge_view lever: the same shape turned. A flat shape is a thin line from its edge; a solid stays drawn. */
function EdgeView({ item }: { item: ThreeDShapeItem }) {
  if (!item.is3d) return <div data-lever={EDGE_VIEW} data-edge-view="line" className="flex justify-center" aria-label="The shape turned">
    <svg width={120} height={20} aria-hidden><rect x={10} y={8} width={100} height={3} rx={1.5} fill="#93c5fd" /></svg>
  </div>;
  return <div data-lever={EDGE_VIEW} data-edge-view="turned" className="flex justify-center" aria-label="The shape turned">
    <div style={{ transform: 'rotate(90deg)' }}><Shape3DSVG shape={item.shape ?? ''} size={84} /></div>
  </div>;
}

/** solid_shelf lever: all five solids, fixed order, unlabeled, none marked. */
function SolidShelf() {
  return <div data-lever={SOLID_SHELF} className="flex flex-wrap justify-center gap-2 rounded-2xl border border-white/10 p-2" aria-label="Five solids">
    {THREE_D_SHAPES.map((shape) => <div key={shape} data-shelf-solid><Shape3DSVG shape={shape} size={56} /></div>)}
  </div>;
}

function ModelCard({ lever, children, label }: { lever: string; children: React.ReactNode; label: string }) {
  return <div data-lever={lever} aria-label="My turn: a different one"
    className="mx-auto flex w-fit items-center gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-500/5 px-3 py-2">
    <span className="text-[10px] uppercase tracking-wide text-cyan-300">My turn</span>
    {children}
    <span className="text-sm font-semibold capitalize text-slate-200">{label}</span>
  </div>;
}

function ModelPropertyPicture({ model }: { model: ModelProperty }) {
  const solid = <Shape3DSVG shape={model.shape} size={64} tint={model.key === 'flatFaces' || model.key === 'curvedSurfaces'} />;
  if (model.key === 'canStack') return <div data-model-picture="stacked" className="flex flex-col items-center -space-y-6"><Shape3DSVG shape={model.shape} size={48} />{<Shape3DSVG shape={model.shape} size={48} />}</div>;
  if (model.key === 'canRoll' || model.key === 'canSlide') return <div data-model-picture={model.key === 'canRoll' ? 'rolling' : 'sliding'} className="flex items-end gap-1">
    {solid}<span aria-hidden className="text-2xl text-cyan-300">{model.key === 'canRoll' ? '↻' : '→'}</span>
    <svg width={50} height={30} aria-hidden><line x1={0} y1={2} x2={50} y2={28} stroke="#94a3b8" strokeWidth={2} /></svg>
  </div>;
  if (model.face) return <div data-model-picture="face" className="flex items-center gap-1">{solid}<Shape2DSVG shape={model.face} size={44} /></div>;
  return <div data-model-picture="tinted">{solid}</div>;
}

const propertyLabel = (key?: PropertyKey) => ({ flatFaces: 'flat faces', curvedSurfaces: 'curved surfaces', faceShape: 'flat-face shape', canRoll: 'rolling', canStack: 'stacking', canSlide: 'sliding' }[key ?? 'flatFaces']);

const averageFor = (summary: TeachingEvaluationResult, items: readonly ThreeDShapeItem[], predicate: (item: ThreeDShapeItem) => boolean): number | null => {
  const subset = items.filter(predicate);
  if (!subset.length) return null;
  return Math.round(subset.reduce((sum, item) => sum + (summary.outcomes.find((o) => o.id === item.id)?.score ?? 0), 0) / subset.length);
};

interface ThreeDShapeExplorerProps {
  data: ThreeDShapeExplorerData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

function ThreeDShapeExplorerSurface({ data, className, runtimePlanItemId }: ThreeDShapeExplorerProps) {
  const { challenges=[], gradeBand='K', show3dRotation=true, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceIdRef = useRef(instanceId || `3d-shape-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const build = useMemo(() => buildThreeDShapeItems(challenges), [challenges]);
  const items = build.items;
  const wrapper = useMemo(() => wrapperTextForSession(data.title, data.description, items), [data.title, data.description, items]);
  const [revealedItemId, setRevealedItemId] = useState<string | null>(null);
  // In-item levers, keyed by the session item they were pulled on, and the easier item a simplify lever put on
  // screen in its place. A retry on the easier item keeps it; only endPractice (or a fresh item) removes it.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<ThreeDShapeItem | null>(null);
  const evaluation = usePrimitiveEvaluation<ThreeDShapeExplorerMetrics>({
    primitiveType: '3d-shape-explorer', instanceId: resolvedInstanceId, skillId, subskillId,
    objectiveId, exhibitId, onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const identification = averageFor(summary, items, (item) => ['identify_shape','classify_dimension','solve_riddle'].includes(item.kind));
    const property = averageFor(summary, items, (item) => ['count_property','judge_property','name_face_shape'].includes(item.kind));
    const realWorld = averageFor(summary, items, (item) => item.kind === 'match_object');
    const metrics: ThreeDShapeExplorerMetrics = {
      type: '3d-shape-explorer', identificationAccuracy: identification ?? 100,
      // The legacy public booleans have no not-observed state. These neutral
      // values are explicitly marked in details instead of fabricating evidence.
      propertyKnowledge: property == null ? true : property >= 60,
      realWorldConnections: realWorld == null ? true : realWorld >= 60,
      attemptsCount: summary.attemptsCount,
    };
    evaluation.submitResult(summary.passed, summary.accuracy, metrics, {
      challengeResults: summary.outcomes, hearTaps: 0, learningResponses: summary.learningResponses,
      ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}),
      observedMetrics: { identification: identification != null, property: property != null, realWorld: realWorld != null },
      droppedChallenges: build.droppedChallenges, droppedItems: build.droppedItems,
    }, undefined, summary.diagnosisEvidence);
  };

  const runner = useWorkspaceRunner<ThreeDShapeItem>({
    primitiveId: '3d-shape-explorer',
    assignment: threeDShapeAssignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onAffirmed: (item) => setRevealedItemId(item.id),
    // A fresh item never carries an easier item over; a retry on the easier item keeps it.
    onItemOpened: () => setPractice(null),
    onCorrectionRetry: () => {},
    onPracticeClosed: () => setPractice(null),
  });
  const sessionItem = runner.currentItem;
  const revealItem = runner.revealHeld ? items.find((entry) => entry.id === revealedItemId) ?? null : null;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const item = practice ?? revealItem ?? sessionItem;
  const displayedIndex = sessionItem ? items.findIndex((entry) => entry.id === sessionItem.id) : 0;
  const meta = MODE_META[item?.sourceMode ?? 'identify-3d'];
  const support = item ? supportForItem(item, !!revealItem && !practice) : null;
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;
  const pulled = sessionItem && leverState.item === sessionItem.id ? leverState.pulled : [];
  /** A lever's drawing is on the session item only, while pulled or started by the tier. */
  const on = (id: string) => !practice && !!sessionItem && (pulled.includes(id) || startingLevers(sessionItem).includes(id));

  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!sessionItem) return;
    const scene = threeDShapeScene(practice ?? sessionItem);
    const onScreen = practice ? '' : threeDShapeLeverFacts(sessionItem, pulled, items);
    // No lever on an easier item: it is practice, and the full item's levers come back with it.
    const levers = practice ? [] : threeDShapeLevers(sessionItem, pulled, items);
    workspace.current = {
      ...scene,
      ...(onScreen ? { facts: { ...scene.facts, onScreen } } : {}),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        if (lever.kind === 'simplify') {
          const easier = simplerFaces(sessionItem, items);
          if (!easier) return 'There is no easier item for this one.';
          setLeverState(next); setPractice(easier);
          return { practice: threeDShapeAssignment(easier) };
        }
        setLeverState(next);
        return true;
      },
      endPractice: () => { setPractice(null); },
    };
  });

  /** Asks the tutor for the question again: a silent host request, never the answer. */
  const hearQuestion = useCallback(() => {
    const asked = practice ?? runner.currentItem;
    if (!asked) return;
    ctx.sendText(hearQuestionRequest(asked), { silent: true, author: 'host' });
  }, [ctx, runner.currentItem, practice]);

  // ── Pip shared surface ───────────────────────────────────────────────────
  // Every answer is spoken; the solid, object, flat shape or clue list is the
  // question side, so Pip points at it as a whole — never at one face or edge.
  const pip = usePipTargets(runner.currentItem?.id ?? null, false);
  const pipStore = usePipSurface(() => {
    const current = runner.currentItem;
    if (!pip.dock.current || !current || showSummary) return null;
    const targets = pip.targets(['stimulus'], () => 'The shape');
    const pose = stimulusPipPose({
      running: runner.running, preparing: false,
      currentSolved: runner.currentSolved, revealHeld: runner.revealHeld,
      judging: false, tutorSpeaking: runner.tutorSpeaking,
      cueMatchesItem: runner.cuedItemId === current.id,
      visibleIds: targets.map((target) => target.id),
    });
    return { instanceId: resolvedInstanceId, scopeId: current.id, label: 'Solid shape lab', dock: pip.dock.current, targets, pose };
  });
  const phases = useMemo<PhaseResult[]>(() => runner.practiceSummary
    ? phaseResultsFromSummary(items, runner.practiceSummary, (entry) => ({ label: MODE_META[entry.sourceMode].label, icon: MODE_META[entry.sourceMode].icon, accentColor: MODE_META[entry.sourceMode].accent }))
    : [], [runner.practiceSummary, items]);

  if (!items.length) return <LuminaCard className={className}><LuminaCardContent className="p-8 text-center text-slate-300">These shape challenges could not make a safe spoken activity. Please generate them again.</LuminaCardContent></LuminaCard>;

  const renderStimulus = (current: ThreeDShapeItem) => {
    if (current.kind === 'match_object') return <LuminaPanel className="mx-auto max-w-sm p-6 text-center"><div className="text-7xl" aria-hidden>{current.emoji || '🧩'}</div><p className="mt-3 text-xl font-semibold text-slate-100">{current.objectName}</p></LuminaPanel>;
    if (current.kind === 'solve_riddle' && !revealItem) return <LuminaPanel className="mx-auto max-w-lg p-5"><div className="mb-3 text-center text-6xl" aria-hidden>?</div><ul className="space-y-2 text-base text-slate-200">{(current.clues ?? []).map((clue) => <li key={clue}>• {clue}</li>)}</ul></LuminaPanel>;
    if (current.kind === 'classify_dimension' && current.shape && !current.is3d) return <div className="flex justify-center"><Shape2DSVG shape={current.shape} /></div>;
    const shape = current.shape3d ?? (current.shape as string | undefined);
    return <div className="text-center">
      <div className={`mx-auto w-fit rounded-full ${support?.showFaceHighlight ? 'ring-4 ring-amber-300/70 shadow-[0_0_28px_rgba(251,191,36,.35)]' : ''}`}>
        <Shape3DSVG shape={shape ?? ''} tint={on(TINT_SURFACES)} seeThrough={on(SEE_THROUGH)} />
      </div>
      {current.sourceMode === 'faces-and-properties' && <p className="mt-1 text-base font-semibold capitalize text-slate-100">{SHAPE_LABELS[current.shape3d!]}</p>}
      {support?.showElementLabels && shape && <div className="mt-2 flex flex-wrap justify-center gap-2" aria-label="Revealed shape properties">{(elementLabels[shape] ?? []).map((label) => <LuminaBadge key={label}>{label}</LuminaBadge>)}</div>}
    </div>;
  };

  /** What a help lever put beside the session item. */
  const renderLevers = () => {
    if (!sessionItem || practice) return null;
    const object = on(MODEL_OBJECT) ? modelObjectFor(sessionItem, items) : null;
    const model = on(MODEL_PROPERTY) ? modelPropertyFor(sessionItem, items) : null;
    return <>
      {on(FACE_PRINTS) && sessionItem.shape3d && SHAPE_FACTS[sessionItem.shape3d].flatFaces > 0 && <FacePrints shape={sessionItem.shape3d} />}
      {on(EDGE_VIEW) && <EdgeView item={sessionItem} />}
      {on(SOLID_SHELF) && <SolidShelf />}
      {object && <ModelCard lever={MODEL_OBJECT} label={`${object.object} · ${SHAPE_LABELS[object.shape]}`}>
        <span aria-hidden className="text-4xl">{object.emoji}</span><Shape3DSVG shape={object.shape} size={64} />
      </ModelCard>}
      {model && <ModelCard lever={MODEL_PROPERTY} label={SHAPE_LABELS[model.shape]}><ModelPropertyPicture model={model} /></ModelCard>}
    </>;
  };

  return <LuminaCard className={className}>
    <LuminaCardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><LuminaCardTitle className="text-lg">{wrapper.title}</LuminaCardTitle>{wrapper.description && <p className="mt-1 text-sm text-slate-400">{wrapper.description}</p>}</div>{!showSummary && <div className="flex gap-2"><LuminaBadge className="text-xs">Grade {gradeBand}</LuminaBadge><LuminaBadge accent={meta.accent} className="text-xs">{meta.icon} {meta.label}</LuminaBadge></div>}</div></LuminaCardHeader>
    <LuminaCardContent className="space-y-5">
      {!showSummary && item && <>
        <div className="flex items-center justify-center gap-4"><LuminaChallengeCounter current={Math.max(1, displayedIndex + 1)} total={items.length} variant="dots" /><button type="button" onClick={hearQuestion} className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-amber-500/30 bg-amber-500/15 transition hover:bg-amber-500/25" aria-label="Hear the question again"><span aria-hidden>🔁</span></button></div>
        {practice && <div className="text-center text-xs text-amber-300" data-practice-item>Practice shape</div>}
        {pipStore && <div ref={pip.dock} data-pip-dock={resolvedInstanceId} className={PIP_DOCK_CLASS} />}
        <div ref={pip.ref('stimulus')} data-pip-object="stimulus" className="mx-auto w-fit">{renderStimulus(item)}</div>
        {renderLevers()}
        {item.sourceMode === 'faces-and-properties' && !revealItem && <p className="text-center text-xs uppercase tracking-wide text-slate-500">Look for: {propertyLabel(item.propertyKey)}</p>}
        {show3dRotation && item.shape3d && item.supportTier !== 'hard' && <p className="text-center text-xs text-slate-500">Look all the way around the solid.</p>}
        <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={runner.tutorSpeaking} /></div>
        {revealItem && !practice && <p className="text-center text-xl font-semibold capitalize text-emerald-300">{revealItem.answer}</p>}
      </>}
      {showSummary && <PhaseSummaryPanel phases={phases} overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy} durationMs={evaluation.elapsedMs} heading="Solid Shape Lab Complete!" celebrationMessage="Great shape work - you told me every answer out loud!" />}
    </LuminaCardContent>
  </LuminaCard>;
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const ThreeDShapeExplorer = withWorkspaceOnly<ThreeDShapeExplorerProps>('3d-shape-explorer', ThreeDShapeExplorerSurface, props => props.data.title);

export default ThreeDShapeExplorer;
