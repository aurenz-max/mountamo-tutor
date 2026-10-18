/**
 * di-shapes items: the challenge shape the generator emits and the answer helpers the component, levers and
 * workspace share. The tutor's words come from the boss (`diShapes.boss.ts`), not from this module.
 *
 * Two response classes: NAMING (`name_shape`, `shape_review`, `name_real_object`) answers with a shape name;
 * COUNTING (`count_sides`, `count_corners`) answers with a number word. The answer never appears on screen
 * before the child says it, and under a counting mode the shape's name stays hidden too (it hints the count).
 * Curved shapes never carry a counting item: "how many sides does a circle have?" has no single defensible
 * answer for a young child, so the generator draws counting items from polygons only.
 */

import type { DiShapesChallengeType } from './diShapesModes';
export type { DiShapesChallengeType } from './diShapesModes';

/** How much the tutor models before the learner tries (`supportFact`). Absent = easy. */
export type DiShapesSupportTier = 'easy' | 'medium' | 'hard';

/**
 * Which DRAWING of a shape an item puts on screen — the L4 structural axis
 * (2026-08-07). `prototype` is the textbook picture (upright isoceles triangle,
 * regular hexagon, landscape rectangle); `variant` is the same shape by its
 * DEFINING attributes drawn against that prototype (scalene obtuse triangle,
 * irregular hexagon, portrait rectangle).
 *
 * This is the pack's structural lever precisely because the ANSWER is unchanged:
 * a scalene triangle is still "triangle" and still has three sides. What gets
 * harder is the percept — a child who learned the picture rather than the shape
 * fails the variant, which is the G1 defining-vs-non-defining-attributes skill
 * (`GEOM001-01-c`) and the "regardless of size, color, or orientation" half of
 * K's `GEOM001-01-A`. The geometry itself, and the guards on it, live in
 * `diShapesGeometry.ts`.
 */
export type ShapeExemplar = 'prototype' | 'variant';

/** Shapes the pack can draw. CORE = the K.G.2 five; the rest are the
 *  generator's extended menu (G1+, or named by the objective). */
export type DiShapeName =
  | 'circle'
  | 'triangle'
  | 'square'
  | 'rectangle'
  | 'hexagon'
  | 'oval'
  | 'pentagon'
  | 'rhombus'
  | 'trapezoid';

/** One drawn shape the tutor drills. Mirrors the generator output. */
export interface DiShapesChallenge {
  id: string;
  challengeType: DiShapesChallengeType;
  /** Absent = easy. */
  supportTier?: DiShapesSupportTier;
  /** Which shape the component draws — geometry is code-owned per name. */
  shape: DiShapeName;
  /** The shape's name, e.g. "triangle". Under a NAMING mode this is the spoken
   *  target; under a COUNTING mode it is still withheld pre-answer (it hints
   *  the count). Never rendered pre-affirmation under any mode. */
  shapeWord: string;
  /** Indefinite article ("a triangle", "an oval"). */
  article: 'a' | 'an';
  /** Straight sides / corners; null for curved shapes, which therefore never
   *  carry a counting item (see the module docblock). */
  sides: number | null;
  corners: number | null;
  /** COUNTING modes only: the numeric answer this item asks for (its `sides`
   *  or its `corners`, per challengeType) and its spoken number word. Both are
   *  derived in code by the generator — the LLM never emits either. */
  countNumeral?: number;
  countWord?: string;
  /** Generator-stamped rotation (degrees) so "regardless of orientation"
   *  (K.G.2) is real and the render is deterministic from data. The L4 tier
   *  scales the FRACTION of each shape's own cap used here; it never raises the
   *  cap (a 45° square reads as a diamond — a different percept, not a harder
   *  one). */
  rotationDeg: number;
  /** Which drawing to render (L4). Absent = `prototype`, the pre-L4 shape. */
  exemplar?: ShapeExemplar;
  /** Draw size as a percentage of the canonical stage size (L4). Absent = 100.
   *  "Regardless of SIZE" is the other half of K.G.2's orientation clause. */
  scalePct?: number;
  /** Whole-token ASR aliases for THIS item's answer — passive cross-check
   *  only, never the judge. Shape-name aliases under a naming mode, number-word
   *  aliases under a counting mode. */
  asrAliases?: string[];
  /** Names the judge must ALSO accept as correct (e.g. "diamond" for a
   *  rhombus — the K word for it). Naming modes only; a count has no synonym. */
  spokenAlternates?: string[];
  /** Real-object mode only: stable code-drawn object and answer-free label. */
  realObjectId?: import('../shared/realWorldShapeObjects').RealWorldShapeObjectId;
  realObjectLabel?: string;
}

/** True for the two attribute-counting identities (spoken number-word answer). */
export const isCountingType = (type: DiShapesChallengeType): boolean =>
  type === 'count_sides' || type === 'count_corners';

/** The countable feature this item asks about, in the child's word. K-1
 *  curriculum vocabulary is "corners"; "vertices" is the G1+ formal term and
 *  deliberately NOT spoken to a five-year-old. */
export const countNoun = (type: DiShapesChallengeType): 'sides' | 'corners' =>
  type === 'count_corners' ? 'corners' : 'sides';

/** The spoken answer for one item: a shape name, or a number word. */
export const answerWordFor = (it: DiShapesChallenge): string =>
  isCountingType(it.challengeType) ? (it.countWord ?? '') : it.shapeWord;
