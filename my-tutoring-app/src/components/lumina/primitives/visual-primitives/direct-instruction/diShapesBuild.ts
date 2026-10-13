/**
 * di-shapes' open build, `build_shape` (/add-eval-modes references/build-mode.md): the tutor says "Make a hexagon",
 * the child makes ANY hexagon on an empty dot grid and presses "I'm done!". The inverse of name_shape: the name is
 * given, the shape is produced, so the child has to know what makes a hexagon a hexagon. Many shapes pass.
 *
 * The judge is shape-builder's exact grid geometry (`shapeMakeBuild.ts`: corners on a straight run are not corners,
 * right angles and parallel sides from integer dot and cross products). Only the shape names with a defining property
 * set a child can make from straight sides are buildable: no circle or oval.
 *
 * K convention, as on the naming modes: a square is not accepted for "rectangle" or "rhombus" (`made_square`). The
 * child is asked for the shape whose name is different, and a different name is a different shape at this band.
 */
import { readShape, type Pt, type ShapeFacts } from '../math/shapeMakeBuild';
import { SHAPE_MENU } from './diShapesMenu';
import type { DiShapeName } from './diShapesScript';

export type { Pt } from '../math/shapeMakeBuild';

/** Shapes a child can make on the dot grid, in menu order. */
export const BUILDABLE_SHAPES: readonly DiShapeName[] =
  ['triangle', 'square', 'rectangle', 'hexagon', 'pentagon', 'rhombus', 'trapezoid'];
export const isBuildable = (shape: DiShapeName) => BUILDABLE_SHAPES.includes(shape);

/** What the made shape got wrong, first one first (TeachingAttempt.miss). */
export type ShapeBuildMiss = 'too_few_sides' | 'too_many_sides' | 'corners_not_square' | 'sides_not_equal'
  | 'made_square' | 'parallel_off';
export const SHAPE_BUILD_MISSES: readonly ShapeBuildMiss[] =
  ['too_few_sides', 'too_many_sides', 'corners_not_square', 'sides_not_equal', 'made_square', 'parallel_off'];

const isSquare = (f: ShapeFacts) => f.sides === 4 && f.rightAngles === 4 && f.sidesOfOneLength === 4;

/** The first defining property of `shape` the made shape lacks, or undefined when it is one. */
export function shapeBuildMiss(shape: DiShapeName, facts: ShapeFacts | null): ShapeBuildMiss | undefined {
  const want = SHAPE_MENU[shape].sides ?? 0;
  const sides = facts?.sides ?? 0;
  if (!facts || sides < want) return 'too_few_sides';
  if (sides > want) return 'too_many_sides';
  switch (shape) {
    case 'square':
      if (facts.rightAngles !== 4) return 'corners_not_square';
      if (facts.sidesOfOneLength !== 4) return 'sides_not_equal';
      return undefined;
    case 'rectangle':
      if (facts.rightAngles !== 4) return 'corners_not_square';
      return isSquare(facts) ? 'made_square' : undefined;
    case 'rhombus':
      if (facts.sidesOfOneLength !== 4) return 'sides_not_equal';
      return isSquare(facts) ? 'made_square' : undefined;
    case 'trapezoid':
      return facts.parallelPairs === 1 ? undefined : 'parallel_off';
    default:
      return undefined;
  }
}

export interface ShapeBuildState { points: Pt[]; closed: boolean }
export const EMPTY_SHAPE_BUILD: ShapeBuildState = { points: [], closed: false };

/** The judge at "I'm done!": an open chain is never a shape. */
export const buildMissFor = (shape: DiShapeName, build: ShapeBuildState) =>
  shapeBuildMiss(shape, build.closed ? readShape(build.points) : null);

/** The ask. It STATES the shape name: here the name is the task, not the answer. */
export const buildAskFor = (shape: DiShapeName) => `Make ${SHAPE_MENU[shape].article} ${SHAPE_MENU[shape].word}.`;

/** The learner's shape in numbers, so the shared work history records how it changed (`workHistory`). */
export function buildFacts(build: ShapeBuildState): Record<string, number | string> {
  const f = build.closed ? readShape(build.points) : null;
  return {
    cornersPlaced: build.points.length,
    shapeClosed: build.closed ? 'yes' : 'no',
    sides: f?.sides ?? 0,
    squareCorners: f?.rightAngles ?? 0,
    sidesOfOneLength: f?.sidesOfOneLength ?? 0,
    parallelPairs: f?.parallelPairs ?? 0,
  };
}

/** What "I'm done!" submits: the learner's work in plain words, never the key. */
export const describeBuild = (build: ShapeBuildState) =>
  build.closed ? 'a closed shape on the dots' : build.points.length ? 'corners placed, shape not closed' : 'nothing yet';

/** The dot grid: 0..GRID_MAX on each axis. Every witness below fits it. */
export const GRID_MAX = 6;

const P = (...xy: number[]): Pt[] => Array.from({ length: xy.length / 2 }, (_, i) => ({ x: xy[2 * i], y: xy[2 * i + 1] }));

/** Two passing shapes of different form per buildable name: the proof each ask is open (and the journey's input). */
export const BUILD_WITNESSES: Record<string, Pt[][]> = {
  triangle: [P(1, 4, 5, 4, 3, 1), P(1, 1, 1, 5, 4, 5)],
  square: [P(1, 1, 4, 1, 4, 4, 1, 4), P(3, 0, 6, 3, 3, 6, 0, 3)],
  rectangle: [P(1, 2, 5, 2, 5, 4, 1, 4), P(2, 0, 4, 0, 4, 5, 2, 5)],
  hexagon: [P(2, 1, 4, 1, 5, 3, 4, 5, 2, 5, 1, 3), P(1, 1, 5, 1, 5, 3, 4, 5, 2, 5, 1, 3)],
  pentagon: [P(3, 0, 6, 2, 5, 5, 1, 5, 0, 2), P(1, 1, 5, 1, 5, 4, 3, 6, 1, 4)],
  rhombus: [P(3, 1, 5, 2, 3, 3, 1, 2), P(3, 0, 4, 3, 3, 6, 2, 3)],
  trapezoid: [P(0, 4, 6, 4, 4, 1, 2, 1), P(1, 1, 4, 1, 4, 5, 1, 3)],
};

/** A made shape that misses on purpose, for the journey's wrong try: three sides for any ask but a triangle. */
export const WRONG_BUILD: Record<string, Pt[]> = {
  triangle: P(1, 1, 5, 1, 5, 5, 1, 5),
  other: P(1, 4, 5, 4, 3, 1),
};
