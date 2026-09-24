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
 * What the drill also shipped and this path does not report yet: silent per-item response
 * timing (`meanResponseMs` is null) and the Tier-A misconception packet (queued with the other
 * DI packs for /add-misconception-loop), and Pip (queued for /add-pip-surface on DiTeachingStage).
 */

import React, { useMemo } from 'react';
import type { PrimitiveEvaluationResult, DiShapesMetrics } from '../../../evaluation/types';
import DiTeachingStage, { diStageMetrics } from './DiTeachingStage';
import { answerWordFor, countNoun, isCountingType, type DiShapesChallenge, type DiShapesChallengeType,
  type DiShapeName, type ShapeExemplar } from './diShapesScript';
import { shapesAssignment, shapesScene } from './diShapesWorkspace';
import { geometryFor, pointsAttr } from './diShapesGeometry';
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

export const ShapeStage: React.FC<{
  shape: DiShapeName;
  rotationDeg: number;
  exemplar?: ShapeExemplar;
  scalePct?: number;
  className?: string;
  strokeWidth?: number;
}> = ({ shape, rotationDeg, exemplar, scalePct, className = 'h-44 w-44', strokeWidth = 6 }) => {
  const scale = (scalePct ?? 100) / 100;
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="shape to name">
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
      </g>
    </svg>
  );
};

const COPY = {
  empty: 'These shapes are still being prepared. Try generating this practice again.',
  title: 'Shape Time', badge: 'Say it out loud', prompt: 'Say the answer out loud, or ask for help.',
  heading: 'Great shape work!', celebration: 'You answered every shape!',
};

/** The drawing alone: no name, no count. A tutor mark outlines it. */
function stimulus(item: DiShapesChallenge, marks: readonly string[]) {
  const marked = marks.includes('shape');
  return <div className="flex min-h-56 items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8">
    <div data-shape-object="shape" data-assignment-target="true" data-tutor-demonstration={marked}
      className={marked ? 'rounded-2xl outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}>
      {item.challengeType === 'name_real_object' && item.realObjectId
        ? <RealWorldShapeObject objectId={item.realObjectId} />
        : <ShapeStage shape={item.shape} rotationDeg={item.rotationDeg} exemplar={item.exemplar} scalePct={item.scalePct} />}
    </div>
  </div>;
}

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
  const evalMode = runtimeEvalMode || data.challengeType || 'name_shape';
  return <DiTeachingStage<DiShapesChallenge, DiShapesMetrics> primitiveId="di-shapes" data={data}
    items={items} evalMode={evalMode} className={className} runtimePlanItemId={runtimePlanItemId}
    assignment={shapesAssignment} scene={shapesScene} copy={COPY} stimulus={stimulus} trail={creditedShapes}
    recapLabel={recapLabel}
    metrics={result => ({ type: 'di-shapes', ...diStageMetrics(result, items, data.challengeType), meanResponseMs: null })} />;
};

export default DiShapes;
