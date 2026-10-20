'use client';

/**
 * ShapeSorter — spoken 2D geometry on the live tutor's workspace (boss: `shapeSorter.boss.ts`, card:
 * `shapeSorter.card.ts`). The child names the gold-ringed shape (or the shape an everyday object is drawn as), says
 * how many sides or corners it has, or says which printed mat it belongs on. The tutor teaches and judges; the
 * workspace commits outcomes and owns progression. This file draws the item and the levers the tutor pulls.
 *
 * Nothing here decides an answer. What the screen must never do (each was a leak in the click era): print numbered
 * per-side buttons under a "how many sides" ask, state a curved shape's side count, or show how many shapes match a
 * rule. The mats are labelled at every tier; the hard tier withholds the criterion in the ask (`namesChoices`).
 *
 * Workspace-only: an unbound mount shows the shared "needs the tutor" card (`withWorkspaceOnly`).
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuminaBadge, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle, LuminaChallengeCounter,
  LuminaDropZone, LuminaReadAloudGlyph, type DropZoneState } from '../../../ui';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import type { PrimitiveEvaluationResult } from '../../../evaluation';
import type { ShapeSorterMetrics } from '../../../evaluation/types';
import { useTeachingWorkspace, type TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useTeachingEvaluation } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import { useWorkspacePin } from '../../../components/live-activity/runtime/workspacePin';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace, useRunnerPip } from '../../../pip/WorkspacePip';
import { SoundManager } from '../../../utils/SoundManager';
import { SHAPE_PROPERTIES, workspaceScene, type ShapeSorterChallengeType, type ShapeSorterItem,
  type ShapeSorterTier } from './shapeSorterDomain';
import { renderShapeSVG, shapeFill, type ShapeMarks } from './shapeSorterDrawing';
import {
  FEWER_MATS, MAT_PICTURES, MODEL_COUNT, MODEL_OBJECT, MODEL_SHAPE, OUTLINE_ONLY, SHAPE_SORTER_LEVERS, SIDE_TICKS,
  START_MARK, TOUCH_MARKS, droppedMat, matPicture, modelCountFor, modelObjectFor, modelShapeFor, startingLevers,
  type MatPicture,
} from './shapeSorterLevers';
import { shapeSorterBoss, shapeSorterItems } from './shapeSorter.boss';
import RealWorldShapeObject from '../shared/RealWorldShapeObject';
import type { RealWorldShapeObjectId } from '../shared/realWorldShapeObjects';

// The geometry table has one home (the domain module, which the generator also imports).
export { SHAPE_PROPERTIES };

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ShapeSorterShape {
  shape: string;
  color: string;
  size: 'small' | 'medium' | 'large';
  rotation: number;
  /** Drawn as an everyday thing rather than a bare figure, when the objective asks the child to find shapes in real
   *  objects (K.G.A.2 / K.G.B.4). The name never contains a shape word — that is what is being asked for. */
  realObject?: string;
  realObjectId?: RealWorldShapeObjectId;
  emoji?: string;
}

export interface ShapeSorterChallenge {
  id: string;
  type: ShapeSorterChallengeType;
  instruction: string;
  /** The attribute being tested: shape name, color, side count, or curved. The SORT dimension (sort) or the pool
   *  composition lever (identify/count) — never an answer surface. */
  ruleAttribute: 'shape' | 'color' | 'sides' | 'curved';
  /** identify: the value the pool was composed around. count: the shape to examine. Never rendered. */
  targetValue?: string;
  /** Pool of shapes — all challenge types use this unified array. */
  shapes: ShapeSorterShape[];
  /** Tier this challenge was generated at ('easy' | 'medium' | 'hard'). */
  supportTier?: ShapeSorterTier;
  /** count: pre-reveal the corner dots. A perception aid that states no number. easy only. */
  showCornerHints?: boolean;
  /** sort: show each mat's count of credited shapes. */
  showBinCounts?: boolean;
}

export interface ShapeSorterData {
  title: string;
  description?: string;
  challenges: ShapeSorterChallenge[];
  gradeBand?: 'K' | '1';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ShapeSorterMetrics>) => void;
}

export interface ShapeSorterProps {
  data: ShapeSorterData;
  className?: string;
  /** The live host opts in only after its correlated mount handoff. */
  autoStart?: boolean;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const MAT_COLORS = ['text-cyan-300', 'text-purple-300', 'text-amber-300'];
const SIZE_SCALE: Record<string, number> = { small: 0.6, medium: 1, large: 1.4 };

/** `mat_pictures`: what a mat collects, drawn from its label alone. Never a shape. */
function MatPictureView({ picture }: { picture: MatPicture }) {
  if (picture.kind === 'sticks') return <svg data-mat-picture="sticks" width={Math.max(24, picture.n * 10)} height={22} aria-hidden="true">
    {Array.from({ length: picture.n }, (_, i) => <line key={i} x1={6 + i * 10} y1={3} x2={6 + i * 10} y2={19}
      stroke="#e2e8f0" strokeWidth={3} strokeLinecap="round" />)}
  </svg>;
  if (picture.kind === 'stroke') return <svg data-mat-picture={picture.curved ? 'curved' : 'straight'} width={40} height={22} aria-hidden="true">
    {picture.curved
      ? <path d="M4 18 Q20 -6 36 18" fill="none" stroke="#e2e8f0" strokeWidth={3} strokeLinecap="round" />
      : <line x1={4} y1={11} x2={36} y2={11} stroke="#e2e8f0" strokeWidth={3} strokeLinecap="round" />}
  </svg>;
  return <span data-mat-picture="swatch" aria-hidden="true" className="inline-block h-5 w-8 rounded-md border border-white/20"
    style={{ background: shapeFill(picture.color) }} />;
}

/** The model card: a DIFFERENT shape or object, solved by the tutor ("my turn"), small and apart from the item. */
function ModelCard({ lever, shape, objectId, marks }: { lever: string; shape: string; objectId?: RealWorldShapeObjectId; marks?: 'sides' | 'corners' }) {
  return <div data-lever={lever} data-model-shape={shape} aria-label="My turn: a different one"
    className="flex items-center gap-3 rounded-xl border-2 border-dashed border-purple-400/70 bg-purple-500/10 px-3 py-2">
    <span aria-hidden="true" className="text-xl leading-none">🗣️</span>
    {objectId && <>
      <RealWorldShapeObject objectId={objectId} className="h-20 w-20" showLabel={false} />
      <span aria-hidden="true" className="text-xl text-purple-200">→</span>
    </>}
    <svg width={80} height={80} viewBox="0 0 80 80" role="img" aria-label="the model shape">
      {renderShapeSVG(shape, 40, 40, 44, 'cyan', 0, {
        showCorners: marks === 'corners', ...(marks === 'sides' ? { marks: { ticks: true } } : {}) })}
    </svg>
  </div>;
}

function ShapeSorterSurface({ data, className, runtimePlanItemId }: ShapeSorterProps) {
  const items = useMemo(() => shapeSorterItems(data), [data]);
  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-8 text-center text-slate-400">
      These shape challenges are still being drawn. Try generating them again.</LuminaCardContent></LuminaCard>;
  }
  return <ShapesWorkspace key={data.instanceId} data={data} items={items} className={className}
    runtimePlanItemId={runtimePlanItemId} />;
}

function ShapesWorkspace({ data, items, className, runtimePlanItemId }: ShapeSorterProps & { items: ShapeSorterItem[] }) {
  const instance = useRef(data.instanceId || `shape-sorter-${Date.now()}`);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [marks, mark] = useState<string[]>([]);
  // Levers pulled, keyed by the session item they were pulled on, and the easier item a simplify lever put on screen
  // in its place. Retry on the easier item keeps it; only endPractice removes it.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<ShapeSorterItem | null>(null);
  const [tapped, setTapped] = useState<ReadonlySet<number>>(new Set());
  const openedIndex = useRef(-1);
  const assignments = useMemo(() => items.map(item => ({ ...shapeSorterBoss.assignment(item), checkResponse: () => null })), [items]);
  const evalMode = useWorkspacePin();
  const lesson = useTeachingWorkspace({ instanceId: instance.current, primitiveId: 'shape-sorter',
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId, items: assignments, workspace,
    onItemOpened: opened => {
      setTapped(new Set());
      if (opened !== openedIndex.current) setPractice(null);
      openedIndex.current = opened;
    } });
  useTeachingEvaluation<ShapeSorterMetrics>({ primitiveType: 'shape-sorter', instanceId: instance.current,
    data, assignments, lesson,
    metrics: result => {
      const scoreFor = (mode: 'identify' | 'count' | 'sort') => {
        const scores = result.outcomes.filter(o => items.find(i => i.id === o.id)?.mode === mode).map(o => o.score);
        return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      };
      return { type: 'shape-sorter', evalMode, identifyAccuracy: scoreFor('identify'),
        countAccuracy: scoreFor('count'), sortAccuracy: scoreFor('sort'), attemptsCount: result.attemptsCount };
    } });
  const sessionItem = items[lesson.state.index];
  const sessionShapes = data.challenges.find(c => c.id === sessionItem.challengeId)!.shapes;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const item = practice ?? sessionItem;
  const shapes = (practice?.practiceShapes ?? sessionShapes) as typeof sessionShapes;
  const pulled = leverState.item === sessionItem.id ? leverState.pulled : [];
  /** On screen: pulled, or started by the tier. */
  const shown = [...startingLevers(sessionItem), ...pulled];
  /** A lever's picture is drawn on the session item only. */
  const on = (id: string) => !practice && shown.includes(id);
  const leverCtx = { items, shapes: sessionShapes };

  const solved = lesson.state.phase === 'checked' && !!lesson.state.lastResponse?.correct && !lesson.state.practice;
  useRunnerPip({ instanceId: instance.current, itemId: item.id, running: lesson.state.phase !== 'completed', solved });

  useLayoutEffect(() => {
    const levers = practice ? [] : SHAPE_SORTER_LEVERS.declare(sessionItem, leverCtx, shown);
    workspace.current = {
      ...leverScene(workspaceScene(item, shapes), {
        support: practice ? '' : SHAPE_SORTER_LEVERS.support(sessionItem, leverCtx),
        onScreen: practice ? '' : SHAPE_SORTER_LEVERS.onScreen(sessionItem, leverCtx, shown) }),
      demonstration: marks,
      canDemonstrate: true, mark, clearPresentation: () => mark([]),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        const easier = SHAPE_SORTER_LEVERS.simpler(sessionItem, leverCtx, id);
        if (easier) {
          setLeverState(next); setPractice(easier); setTapped(new Set()); mark([]);
          return { practice: shapeSorterBoss.assignment(easier) };
        }
        setLeverState(next);
        return true;
      },
      endPractice: () => { setPractice(null); setTapped(new Set()); mark([]); },
    };
  });

  /** Which sort groups this challenge has already had a correct attempt land on — read off the session's own attempt
   *  history, never a local click map. */
  const placedByChoice = useMemo(() => {
    const map = new Map<string, number>();
    if (item.mode !== 'sort') return map;
    for (const attempt of lesson.state.attempts) {
      if (!attempt.correct) continue;
      const done = items.find(i => i.id === attempt.itemId);
      if (!done || done.mode !== 'sort' || done.challengeId !== item.challengeId) continue;
      map.set(done.answer, (map.get(done.answer) ?? 0) + 1);
    }
    return map;
  }, [item, items, lesson.state.attempts]);

  const summary = lesson.summary;
  const cols = Math.min(shapes.length, 4), cell = 108;

  /** The pool: printed material, never an answer surface. The asked shape is ringed and the rest dimmed, because the
   *  ask says "the gold-ringed shape" and exactly one drawing has to be the one meant. */
  const renderPool = () => (
    <div className="flex justify-center">
      <svg width={cols * cell} height={Math.ceil(shapes.length / cols) * cell}
        viewBox={`0 0 ${cols * cell} ${Math.ceil(shapes.length / cols) * cell}`}
        role="img" aria-label="Shapes to look at" className="max-w-full h-auto">
        {shapes.map((shape, index) => {
          const x = (index % cols) * cell + cell / 2, y = Math.floor(index / cols) * cell + cell / 2;
          const current = index === item.shapeIndex, marked = marks.includes(`shape-${index}`);
          return <g key={index} data-shape-id={`shape-${index}`} data-assignment-target={current}
            data-tutor-demonstration={marked}>
            {current && <circle cx={x} cy={y} r={46} fill="none" stroke="#fbbf24" strokeWidth={3} />}
            {marked && <circle cx={x} cy={y} r={50} fill="none" stroke="#c084fc" strokeWidth={3} strokeDasharray="5 4" />}
            {renderShapeSVG(shape.shape, x, y, 40 * (SIZE_SCALE[shape.size ?? 'medium'] ?? 1),
              shape.color, shape.rotation ?? 0, { dimmed: !current && !marked,
                // side_ticks lever: a tick across each side of the ringed shape only. No number.
                ...(current && item.mode === 'sort' && on(SIDE_TICKS) ? { marks: { ticks: true } } : {}) })}
          </g>;
        })}
      </svg>
    </div>
  );

  /** The single shape a counting item examines, drawn large. */
  const renderCount = () => {
    const shape = shapes[item.shapeIndex];
    const marked = marks.includes(`shape-${item.shapeIndex}`);
    const kind = item.countNoun === 'corners' ? 'corner' as const : 'side' as const;
    // start_mark / touch_marks levers: one start dot, and tap targets that mark; on the learner's own shape, no number.
    const leverMarks: ShapeMarks = {
      ...(on(START_MARK) ? { start: kind } : {}),
      ...(on(TOUCH_MARKS) ? { tap: { kind, marked: tapped, onTap: (i: number) => {
        SoundManager.tap();
        setTapped(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; });
      } } } : {}),
    };
    return <div className="flex justify-center">
      <svg data-shape-id={`shape-${item.shapeIndex}`} data-assignment-target="true"
        data-tutor-demonstration={marked} width={220} height={220} viewBox="0 0 220 220" role="img" aria-label="Shape to count">
        <circle cx={110} cy={110} r={100} fill="none" stroke="#fbbf24" strokeWidth={3} />
        {marked && <circle cx={110} cy={110} r={106} fill="none" stroke="#c084fc" strokeWidth={3} strokeDasharray="5 4" />}
        {renderShapeSVG(shape.shape, 110, 110, 88, shape.color, shape.rotation ?? 0, { showCorners: item.showCornerHints, marks: leverMarks })}
      </svg>
    </div>;
  };

  /** One familiar object at a time. Its label names the object, never the shape. */
  const renderRealObject = () => {
    const marked = marks.includes(`shape-${item.shapeIndex}`);
    return item.realObjectId ? <div data-shape-id={`shape-${item.shapeIndex}`} data-assignment-target="true"
      data-tutor-demonstration={marked}
      className={`flex justify-center rounded-2xl border p-5 ${marked ? 'border-purple-400/50 bg-purple-500/10' : 'border-amber-400/40 bg-amber-500/5'}`}>
      <RealWorldShapeObject objectId={item.realObjectId} className="h-48 w-48" detailsMuted={on(OUTLINE_ONLY)} />
    </div> : null;
  };

  /** The mats: printed, labelled at every tier, never clickable. The child says the group out loud. */
  const dropped = on(FEWER_MATS) ? droppedMat(item) : null;
  const renderMats = () => (
    <div className={`grid gap-4 ${item.choices.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {item.choices.map((label, idx) => {
        const placed = placedByChoice.get(label) ?? 0;
        const marked = marks.includes(`mat-${idx}`);
        const zoneState: DropZoneState = marked ? 'correct' : placed > 0 ? 'filled' : 'idle';
        const picture = on(MAT_PICTURES) ? matPicture(item, label) : null;
        return <div key={label} data-shape-id={`mat-${idx}`} data-tutor-demonstration={marked}
          data-mat-greyed={dropped === label || undefined} className={`w-full ${dropped === label ? 'opacity-30' : ''}`}>
          <h3 className={`mb-2 text-center font-bold text-sm ${MAT_COLORS[idx] ?? MAT_COLORS[0]}`}>{label}</h3>
          {picture && <div data-lever="mat-pictures" className="mb-2 flex justify-center"><MatPictureView picture={picture} /></div>}
          <LuminaDropZone state={zoneState} className="min-h-[64px] pointer-events-none content-center justify-center">
            {item.showBinCounts && placed > 0 && (
              <LuminaBadge className="bg-white/10 border-white/10 text-slate-200 text-xs">{placed}</LuminaBadge>
            )}
          </LuminaDropZone>
        </div>;
      })}
    </div>
  );

  /** The model card a help lever put beside the session item. */
  const renderModel = () => {
    if (practice) return null;
    const shape = on(MODEL_SHAPE) ? modelShapeFor(sessionItem, items) : null;
    if (shape) return <ModelCard lever={MODEL_SHAPE} shape={shape} />;
    const object = on(MODEL_OBJECT) ? modelObjectFor(sessionItem, items) : null;
    if (object) return <ModelCard lever={MODEL_OBJECT} shape={object.shape} objectId={object.id} />;
    const counted = on(MODEL_COUNT) ? modelCountFor(sessionItem, items) : null;
    if (counted) return <ModelCard lever={MODEL_COUNT} shape={counted} marks={sessionItem.countNoun === 'corners' ? 'corners' : 'sides'} />;
    return null;
  };

  const promptFor = (): string => {
    if (item.mode === 'count') return `Count this shape's ${item.countNoun ?? 'sides'}.`;
    if (item.mode === 'sort') return 'Say which group the gold-ringed shape belongs to.';
    if (item.realObjectId) return 'Name the shape you see in this everyday object.';
    return 'Name the shape inside the gold ring.';
  };

  const isRealObject = item.mode === 'identify' && !!item.realObjectId;

  return <LuminaCard className={className}>
    <LuminaCardHeader><LuminaCardTitle>{data.title}</LuminaCardTitle></LuminaCardHeader>
    <LuminaCardContent className="space-y-5">
      {summary ? <PhaseSummaryPanel heading="Shape Work Complete!" celebrationMessage="You worked out every shape!"
        phases={summary.outcomes.map((outcome, index) => ({ label: `Shape ${index + 1}`, score: outcome.score,
          attempts: outcome.attempts, firstTry: outcome.corrections === 0, accentColor: 'purple' as const }))} /> : <>
        <LuminaChallengeCounter current={lesson.state.index + 1} total={items.length} variant="dots" />
        {practice && <div className="text-center text-xs text-amber-300" data-practice-item>Practice shape</div>}
        <p className="text-center text-slate-200">{promptFor()}</p>
        <PipDock />
        <PipWorkspace className="space-y-5">
          <div className="flex flex-wrap items-center justify-center gap-6">
            {item.mode === 'count' ? renderCount() : isRealObject ? renderRealObject() : renderPool()}
            {renderModel()}
          </div>
          {item.mode === 'sort' && renderMats()}
        </PipWorkspace>
        <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} /></div>
        <p className="text-center text-sm text-slate-400">Say your answer, or ask for help.</p>
      </>}
    </LuminaCardContent>
  </LuminaCard>;
}

const ShapeSorter = withWorkspaceOnly<ShapeSorterProps>('shape-sorter', ShapeSorterSurface, props => props.data.title);
export default ShapeSorter;
