'use client';

/**
 * DiShapes — DI family primitive #5: the child sees a drawn 2D shape (or a familiar object
 * drawn in code) and SAYS its name, or on the counting modes how many sides or corners it has.
 * The Live tutor teaches it on the shared tutor/JEV workspace through `DiTeachingStage`
 * (workspace rollout B3; the scripted DISTAR drill was retired, LA-14, user ruling 09-23: one
 * path). An unbound mount renders the stage's visible "needs the tutor" card.
 *
 * ANSWER-LEAK RULE: the stage draws the SHAPE ONLY. Under a counting mode the shape's NAME is
 * also withheld, because it hands the count to any child who knows it (triangle → three). The
 * labeled reward ("triangle", or "three sides") renders only for answers the observer has
 * credited, and a missed item recaps unlabeled.
 *
 * GEOMETRY IS THE PEDAGOGY GUARD: rectangles draw clearly elongated (≥1.6:1) and ovals clearly
 * non-circular, so each drawing has exactly ONE defensible name. Rotation, exemplar and scale are
 * stamped per challenge by the generator (K.G.2: regardless of orientation and size).
 *
 * LEVERS (`diShapesLevers.ts`, DI family 3). A small "my turn" card with a DIFFERENT shape, solved
 * (a shape, an object beside its outline, or a polygon with a mark on each side or corner); on the
 * counting modes one start dot and tappable sides or corners on the child's own shape. Every mark
 * sits inside the shape's own rotate/scale transform, and the tap handlers are on the <line> and
 * <circle> elements, never on the <g> (jsdom does not dispatch clicks to <g>).
 *
 * What the drill also shipped and this path does not report yet: silent per-item response
 * timing (`meanResponseMs` is null) and the Tier-A misconception packet (queued with the other
 * DI packs for /add-misconception-loop).
 */

import React, { useMemo, useState } from 'react';
import type { PrimitiveEvaluationResult, DiShapesMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import DiTeachingStage, { diStageMetrics, type DiStageLevers, type DiStageView } from './DiTeachingStage';
import { answerWordFor, countNoun, isCountingType, type DiShapesChallenge, type DiShapesChallengeType,
  type DiShapeName, type ShapeExemplar } from './diShapesScript';
import { shapesAssignment, shapesScene } from './diShapesWorkspace';
import { geometryFor, pointsAttr } from './diShapesGeometry';
import { MODEL_COUNT, MODEL_OBJECT, MODEL_SHAPE, START_MARK, TOUCH_MARKS, modelFor, shapeLeverFacts, shapeLevers,
  simplerShape, startingLevers } from './diShapesLevers';
import RealWorldShapeObject from '../shared/RealWorldShapeObject';

export type {
  DiShapesChallenge,
  DiShapesChallengeType,
  DiShapeName,
  DiShapesSupportTier,
} from './diShapesScript';

export interface DiShapesData {
  title: string;
  description: string;
  /** 3-6 drawn shapes. REQUIRED. Built by the menu-scoped generator. */
  challenges: DiShapesChallenge[];
  /** Session core task identity (L0 = name_shape). */
  challengeType: DiShapesChallengeType;
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiShapesMetrics>) => void;
}

export interface DiShapesProps {
  data: DiShapesData;
  index?: number;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the live mount; never rebuilt from a label. */
  runtimeEvalMode?: string;
}

/** POST-credit only: "triangle", or "three sides". */
const rewardLabelFor = (item: DiShapesChallenge): string =>
  isCountingType(item.challengeType) ? `${answerWordFor(item)} ${countNoun(item.challengeType)}` : answerWordFor(item);

// ── The drawn-shape stage (code-owned geometry) ─────────────────────
// One 200×200 viewBox, shape centered at (100,100). The geometry and its pedagogy guards live as
// DATA in diShapesGeometry.ts so they can be asserted; see diShapesGeometry.test.ts.
const ShapeDrawing: React.FC<{ shape: DiShapeName; exemplar?: ShapeExemplar }> = ({ shape, exemplar }) => {
  const g = geometryFor(shape, exemplar ?? 'prototype');
  if (g.kind === 'circle') return <circle cx={100} cy={100} r={g.r} />;
  if (g.kind === 'ellipse') return <ellipse cx={100} cy={100} rx={g.rx} ry={g.ry} />;
  return <polygon points={pointsAttr(g.points)} />;
};

/** Marks drawn on a polygon, inside its transform. Never a numeral, never an order. */
export interface ShapeMarks {
  /** A tick across the middle of every side (the model's sides, counted for the child). */
  ticks?: boolean;
  /** A dot on every corner (the model's corners). */
  cornerDots?: boolean;
  /** `start_mark`: one dot on the first side or corner. */
  start?: 'side' | 'corner';
  /** `touch_marks`: each side or corner is a tap target; a tapped one is marked. */
  tap?: { kind: 'side' | 'corner'; marked: ReadonlySet<number>; onTap: (index: number) => void };
}

const sidesOf = (points: ReadonlyArray<readonly [number, number]>) =>
  points.map((p, i) => [p, points[(i + 1) % points.length]] as const);
const midpoint = ([a, b]: readonly [readonly [number, number], readonly [number, number]]) =>
  [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;

const ShapeMarksLayer: React.FC<{ shape: DiShapeName; exemplar?: ShapeExemplar; marks: ShapeMarks; scale: number }> = ({
  shape, exemplar, marks, scale }) => {
  const g = geometryFor(shape, exemplar ?? 'prototype');
  if (g.kind !== 'polygon') return null;
  const sides = sidesOf(g.points);
  const s = (n: number) => n / scale;
  return <>
    {marks.ticks && sides.map((side, i) => {
      const [[x1, y1], [x2, y2]] = side, [mx, my] = midpoint(side);
      const len = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
      return <line key={`t${i}`} data-shape-tick={i} x1={mx - nx * s(14)} y1={my - ny * s(14)} x2={mx + nx * s(14)} y2={my + ny * s(14)}
        stroke="#fbbf24" strokeWidth={s(6)} strokeLinecap="round" />;
    })}
    {marks.cornerDots && g.points.map(([x, y], i) => <circle key={`c${i}`} data-shape-corner-dot={i} cx={x} cy={y} r={s(9)}
      fill="#fbbf24" stroke="none" />)}
    {marks.tap?.kind === 'side' && sides.map((side, i) => {
      const [[x1, y1], [x2, y2]] = side, on = marks.tap!.marked.has(i);
      return <line key={`s${i}`} data-shape-tap="side" data-tap-index={i} data-marked={on} role="button" aria-label="A side"
        x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? '#fbbf24' : 'rgba(0,0,0,0)'} strokeWidth={on ? s(12) : s(30)}
        strokeLinecap="round" style={{ cursor: 'pointer', pointerEvents: 'stroke' }} onClick={() => marks.tap!.onTap(i)} />;
    })}
    {marks.tap?.kind === 'corner' && g.points.map(([x, y], i) => {
      const on = marks.tap!.marked.has(i);
      return <circle key={`k${i}`} data-shape-tap="corner" data-tap-index={i} data-marked={on} role="button" aria-label="A corner"
        cx={x} cy={y} r={s(16)} fill="rgba(0,0,0,0)" stroke={on ? '#fbbf24' : 'none'} strokeWidth={s(5)}
        style={{ cursor: 'pointer', pointerEvents: 'all' }} onClick={() => marks.tap!.onTap(i)} />;
    })}
    {marks.start && (() => {
      const [x, y] = marks.start === 'side' ? midpoint(sides[0]) : g.points[0];
      return <circle data-shape-start={marks.start} cx={x} cy={y} r={s(10)} fill="#f472b6" stroke="#fdf2f8" strokeWidth={s(3)}
        style={{ pointerEvents: 'none' }} />;
    })()}
  </>;
};

export const ShapeStage: React.FC<{
  shape: DiShapeName;
  rotationDeg: number;
  exemplar?: ShapeExemplar;
  scalePct?: number;
  className?: string;
  strokeWidth?: number;
  marks?: ShapeMarks;
  ariaLabel?: string;
}> = ({ shape, rotationDeg, exemplar, scalePct, className = 'h-44 w-44', strokeWidth = 6, marks, ariaLabel = 'shape to name' }) => {
  const scale = (scalePct ?? 100) / 100;
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={ariaLabel}>
      <g
        // Rotate AND scale about the stage centre, so a small shape stays centred and a rotated one never clips.
        transform={`rotate(${rotationDeg} 100 100) translate(100 100) scale(${scale}) translate(-100 -100)`}
        fill="rgba(34,211,238,0.14)"
        stroke="#67e8f9"
        // A constant visual outline as the shape shrinks: a thicker relative stroke would blur the corners a
        // child is asked to count.
        strokeWidth={strokeWidth / scale}
        strokeLinejoin="round"
      >
        <ShapeDrawing shape={shape} exemplar={exemplar} />
        {marks && <ShapeMarksLayer shape={shape} exemplar={exemplar} marks={marks} scale={scale} />}
      </g>
    </svg>
  );
};

const COPY = {
  empty: 'These shapes are still being prepared. Try generating this practice again.',
  title: 'Shape Time', badge: 'Say it out loud', prompt: 'Say the answer out loud, or ask for help.',
  heading: 'Great shape work!', celebration: 'You answered every shape!',
};

/** The model card: a DIFFERENT shape (or object), solved, small and apart from the child's (DI's "my turn"). */
function ModelCard({ model }: { model: DiShapesChallenge }) {
  const counting = isCountingType(model.challengeType);
  const lever = model.challengeType === 'name_real_object' ? MODEL_OBJECT : counting ? MODEL_COUNT : MODEL_SHAPE;
  return <div data-lever={lever} data-model-shape={model.shape}
    aria-label={`My turn: a different ${model.challengeType === 'name_real_object' ? 'object' : 'shape'}`}
    className="flex items-center gap-3 rounded-xl border-2 border-dashed border-purple-400/70 bg-purple-500/10 px-3 py-2">
    <span aria-hidden="true" className="text-xl leading-none">🗣️</span>
    {model.challengeType === 'name_real_object' && model.realObjectId && <>
      <RealWorldShapeObject objectId={model.realObjectId} className="h-20 w-20" showLabel={false} />
      <span aria-hidden="true" className="text-xl text-purple-200">→</span>
    </>}
    <ShapeStage shape={model.shape} rotationDeg={0} className="h-20 w-20" strokeWidth={8} ariaLabel="the model shape"
      marks={counting ? model.challengeType === 'count_corners' ? { cornerDots: true } : { ticks: true } : undefined} />
  </div>;
}

/** The child's drawing, any lever marks on it, and the model card beside it. Keyed by item. */
const ShapeTask: React.FC<{ item: DiShapesChallenge; marked: boolean; view: DiStageView; model: DiShapesChallenge | null }> = ({
  item, marked, view, model }) => {
  const [tapped, setTapped] = useState<ReadonlySet<number>>(new Set());
  const counting = isCountingType(item.challengeType);
  const kind = item.challengeType === 'count_corners' ? 'corner' as const : 'side' as const;
  const marks: ShapeMarks | undefined = !counting ? undefined : {
    ...(view.pulled.includes(START_MARK) ? { start: kind } : {}),
    ...(view.pulled.includes(TOUCH_MARKS) ? { tap: { kind, marked: tapped, onTap: (i: number) => {
      SoundManager.tap();
      setTapped(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; });
    } } } : {}),
  };
  const showModel = !!model && view.pulled.some(p => p.startsWith('model_'));
  return <div data-practice-item={view.practice || undefined}
    className="flex min-h-56 flex-wrap items-center justify-center gap-6 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8">
    <div data-shape-object="shape" data-assignment-target="true" data-tutor-demonstration={marked}
      className={marked ? 'rounded-2xl outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}>
      {item.challengeType === 'name_real_object' && item.realObjectId
        ? <RealWorldShapeObject objectId={item.realObjectId} />
        : <ShapeStage shape={item.shape} rotationDeg={item.rotationDeg} exemplar={item.exemplar} scalePct={item.scalePct} marks={marks} />}
    </div>
    {showModel && <ModelCard model={model!} />}
  </div>;
};

/** The reward trail: only answers the observer has credited, each drawn small with its label. */
function creditedShapes(done: DiShapesChallenge[]) {
  return done.length > 0 && <div className="flex flex-wrap justify-center gap-2" aria-label="Shapes you have answered">
    {done.map(item => <div key={item.id} data-shape-credited={item.id}
      className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1">
      <ShapeStage shape={item.shape} rotationDeg={item.rotationDeg} exemplar={item.exemplar} className="h-8 w-8" strokeWidth={10} />
      <span className="text-sm font-semibold text-emerald-200">{rewardLabelFor(item)}</span>
    </div>)}
  </div>;
}

/** A missed shape recaps unlabeled: the recap must not print an answer the child never produced. */
const recapLabel = (item: DiShapesChallenge, solved: boolean) => solved ? rewardLabelFor(item) : 'a shape';

/** PLATFORM PROP CONTRACT: registry primitives mount as `<Component data={…} index={…} />`. */
export const DiShapes: React.FC<DiShapesProps> = ({ data, className, runtimePlanItemId, runtimeEvalMode }) => {
  const items = useMemo(() => data.challenges ?? [], [data.challenges]);
  // The levers read the whole session: a model never shows a shape (or count) a later item asks.
  const levers = useMemo<DiStageLevers<DiShapesChallenge>>(() => ({
    declare: (item, pulled) => shapeLevers(item, pulled, items),
    onScreen: (item, pulled) => shapeLeverFacts(item, pulled, items),
    starting: item => startingLevers(item, items),
    simpler: (item, lever) => simplerShape(item, lever, items),
  }), [items]);
  return <DiTeachingStage<DiShapesChallenge, DiShapesMetrics> primitiveId="di-shapes" data={data}
    items={items} runtimeEvalMode={runtimeEvalMode} className={className} runtimePlanItemId={runtimePlanItemId}
    assignment={shapesAssignment} scene={shapesScene} copy={COPY} trail={creditedShapes} recapLabel={recapLabel} levers={levers}
    stimulus={(item, marks, view) => <ShapeTask key={item.id} item={item} marked={marks.includes('shape')} view={view}
      model={view.practice ? null : modelFor(item, items)} />}
    metrics={result => ({ type: 'di-shapes', ...diStageMetrics(result, items, data.challengeType), meanResponseMs: null })} />;
};

export default DiShapes;
