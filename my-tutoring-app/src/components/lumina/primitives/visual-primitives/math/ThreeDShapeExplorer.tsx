'use client';

/**
 * ThreeDShapeExplorer — solids, flat shapes, everyday objects and riddles; every answer is
 * spoken. It runs only on the shared tutor/JEV teaching workspace (workspace rollout C4; the
 * scripted runner was retired, LA-14, user ruling 09-23: one path). The observer judges the
 * spoken answer and the runtime owns progression. An unbound mount shows the shared "needs the
 * tutor" card.
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
  SHAPE_LABELS, buildThreeDShapeItems, supportForItem,
  wrapperTextForSession, type PropertyKey, type ThreeDShapeChallengeLike,
  type ThreeDShapeItem, type ThreeDShapeMode,
} from './threeDShapeExplorerScript';
import { hearQuestionRequest, threeDShapeAssignment, threeDShapeScene } from './threeDShapeExplorerWorkspace';
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

/** The catalog's eval-mode name for each item mode. */
const CATALOG_MODE: Record<ThreeDShapeMode, string> = {
  'identify-3d': 'identify_3d', '2d-vs-3d': '2d_vs_3d', 'match-to-real-world': 'match_real_world',
  'faces-and-properties': 'faces_properties', 'shape-riddle': 'shape_riddle',
};

const elementLabels: Record<string, string[]> = {
  cube: ['flat faces', 'edges', 'corners'], sphere: ['curved surface'],
  cylinder: ['flat circular faces', 'curved surface', 'edges'],
  cone: ['flat circular face', 'curved surface', 'point'],
  'rectangular-prism': ['flat rectangular faces', 'edges', 'corners'],
};

/** The existing pseudo-3D solid remains the visual stimulus. */
export function Shape3DSVG({ shape, size = 180, className }: { shape: string; size?: number; className?: string }) {
  const cx = size / 2, cy = size / 2, s = size * 0.35, id = `${shape}-${size}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label="Solid shape">
      <defs>
        <radialGradient id={`sphere-${id}`} cx="35%" cy="30%"><stop offset="0%" stopColor="#93c5fd" /><stop offset="70%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#1e3a8a" /></radialGradient>
        <linearGradient id={`purple-${id}`} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#4c1d95" /></linearGradient>
        <linearGradient id={`teal-${id}`} x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#2dd4bf" /><stop offset="50%" stopColor="#14b8a6" /><stop offset="100%" stopColor="#0f766e" /></linearGradient>
        <linearGradient id={`amber-${id}`} x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#b45309" /></linearGradient>
        <linearGradient id={`pink-${id}`} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f472b6" /><stop offset="100%" stopColor="#9d174d" /></linearGradient>
      </defs>
      {shape === 'sphere' && <><circle cx={cx} cy={cy} r={s} fill={`url(#sphere-${id})`} /><ellipse cx={cx} cy={cy} rx={s} ry={s * .15} fill="none" stroke="rgba(255,255,255,.2)" strokeDasharray="4 3" /><ellipse cx={cx-s*.15} cy={cy-s*.2} rx={s*.15} ry={s*.08} fill="rgba(255,255,255,.25)" /></>}
      {shape === 'cube' && (() => {
        const h=s*.8, dx=s*.6, dy=s*.35;
        const top=`${cx},${cy-h} ${cx+dx},${cy-h+dy} ${cx},${cy-h+2*dy} ${cx-dx},${cy-h+dy}`;
        const left=`${cx-dx},${cy-h+dy} ${cx},${cy-h+2*dy} ${cx},${cy+dy} ${cx-dx},${cy}`;
        const right=`${cx+dx},${cy-h+dy} ${cx},${cy-h+2*dy} ${cx},${cy+dy} ${cx+dx},${cy}`;
        return <><polygon points={left} fill="#5b21b6" /><polygon points={right} fill="#4c1d95" /><polygon points={top} fill={`url(#purple-${id})`} /></>;
      })()}
      {shape === 'cylinder' && (() => { const rx=s*.7, ry=s*.2, top=cy-s*.5, bottom=cy+s*.5; return <><rect x={cx-rx} y={top} width={rx*2} height={s} fill={`url(#teal-${id})`} /><ellipse cx={cx} cy={bottom} rx={rx} ry={ry} fill="#0f766e" /><ellipse cx={cx} cy={top} rx={rx} ry={ry} fill="#5eead4" /></>; })()}
      {shape === 'cone' && (() => { const rx=s*.7, ry=s*.2, bottom=cy+s*.5, tip=cy-s*.8; return <><path d={`M${cx-rx},${bottom} Q${cx},${bottom+ry*2} ${cx+rx},${bottom} L${cx},${tip} Z`} fill={`url(#amber-${id})`} /><ellipse cx={cx} cy={bottom} rx={rx} ry={ry} fill="#92400e" /></>; })()}
      {shape === 'rectangular-prism' && (() => {
        const left=`${cx-s},${cy-s*.35} ${cx+s*.35},${cy-s*.35} ${cx+s*.35},${cy+s*.55} ${cx-s},${cy+s*.55}`;
        const top=`${cx-s},${cy-s*.35} ${cx-s*.55},${cy-s*.7} ${cx+s*.8},${cy-s*.7} ${cx+s*.35},${cy-s*.35}`;
        const right=`${cx+s*.35},${cy-s*.35} ${cx+s*.8},${cy-s*.7} ${cx+s*.8},${cy+s*.2} ${cx+s*.35},${cy+s*.55}`;
        return <><polygon points={left} fill="#be185d" /><polygon points={right} fill="#9d174d" /><polygon points={top} fill={`url(#pink-${id})`} /></>;
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

function ThreeDShapeExplorerSurface({ data, className, runtimePlanItemId, runtimeEvalMode }: ThreeDShapeExplorerProps) {
  const { challenges=[], gradeBand='K', show3dRotation=true, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceIdRef = useRef(instanceId || `3d-shape-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const build = useMemo(() => buildThreeDShapeItems(challenges), [challenges]);
  const items = build.items;
  const wrapper = useMemo(() => wrapperTextForSession(data.title, data.description, items), [data.title, data.description, items]);
  const [revealedItemId, setRevealedItemId] = useState<string | null>(null);
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
    evalMode: runtimeEvalMode || CATALOG_MODE[items[0]?.sourceMode ?? 'identify-3d'],
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onAffirmed: (item) => setRevealedItemId(item.id),
  });
  const revealItem = runner.revealHeld ? items.find((entry) => entry.id === revealedItemId) ?? null : null;
  const item = revealItem ?? runner.currentItem;
  const displayedIndex = item ? items.findIndex((entry) => entry.id === item.id) : 0;
  const meta = MODE_META[item?.sourceMode ?? 'identify-3d'];
  const support = item ? supportForItem(item, !!revealItem) : null;
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;

  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!runner.currentItem) return;
    workspace.current = { ...threeDShapeScene(runner.currentItem), demonstration: [], canDemonstrate: false,
      canPresent: false, readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    runner.publishWorkspace();
  });

  /** Asks the tutor for the question again: a silent host request, never the answer. */
  const hearQuestion = useCallback(() => {
    if (!runner.currentItem) return;
    ctx.sendText(hearQuestionRequest(runner.currentItem), { silent: true, author: 'host' });
  }, [ctx, runner.currentItem]);

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
      <div className={`mx-auto w-fit rounded-full ${support?.showFaceHighlight ? 'ring-4 ring-amber-300/70 shadow-[0_0_28px_rgba(251,191,36,.35)]' : ''}`}><Shape3DSVG shape={shape ?? ''} /></div>
      {current.sourceMode === 'faces-and-properties' && <p className="mt-1 text-base font-semibold capitalize text-slate-100">{SHAPE_LABELS[current.shape3d!]}</p>}
      {support?.showElementLabels && shape && <div className="mt-2 flex flex-wrap justify-center gap-2" aria-label="Revealed shape properties">{(elementLabels[shape] ?? []).map((label) => <LuminaBadge key={label}>{label}</LuminaBadge>)}</div>}
    </div>;
  };

  return <LuminaCard className={className}>
    <LuminaCardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><LuminaCardTitle className="text-lg">{wrapper.title}</LuminaCardTitle>{wrapper.description && <p className="mt-1 text-sm text-slate-400">{wrapper.description}</p>}</div>{!showSummary && <div className="flex gap-2"><LuminaBadge className="text-xs">Grade {gradeBand}</LuminaBadge><LuminaBadge accent={meta.accent} className="text-xs">{meta.icon} {meta.label}</LuminaBadge></div>}</div></LuminaCardHeader>
    <LuminaCardContent className="space-y-5">
      {!showSummary && item && <>
        <div className="flex items-center justify-center gap-4"><LuminaChallengeCounter current={Math.max(1, displayedIndex + 1)} total={items.length} variant="dots" /><button type="button" onClick={hearQuestion} className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-amber-500/30 bg-amber-500/15 transition hover:bg-amber-500/25" aria-label="Hear the question again"><span aria-hidden>🔁</span></button></div>
        {pipStore && <div ref={pip.dock} data-pip-dock={resolvedInstanceId} className={PIP_DOCK_CLASS} />}
        <div ref={pip.ref('stimulus')} data-pip-object="stimulus" className="mx-auto w-fit">{renderStimulus(item)}</div>
        {item.sourceMode === 'faces-and-properties' && !revealItem && <p className="text-center text-xs uppercase tracking-wide text-slate-500">Look for: {propertyLabel(item.propertyKey)}</p>}
        {show3dRotation && item.shape3d && item.supportTier !== 'hard' && <p className="text-center text-xs text-slate-500">Look all the way around the solid.</p>}
        <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={runner.tutorSpeaking} /></div>
        {revealItem && <p className="text-center text-xl font-semibold capitalize text-emerald-300">{revealItem.answer}</p>}
      </>}
      {showSummary && <PhaseSummaryPanel phases={phases} overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy} durationMs={evaluation.elapsedMs} heading="Solid Shape Lab Complete!" celebrationMessage="Great shape work - you told me every answer out loud!" />}
    </LuminaCardContent>
  </LuminaCard>;
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const ThreeDShapeExplorer = withWorkspaceOnly<ThreeDShapeExplorerProps>('3d-shape-explorer', ThreeDShapeExplorerSurface, props => props.data.title);

export default ThreeDShapeExplorer;
