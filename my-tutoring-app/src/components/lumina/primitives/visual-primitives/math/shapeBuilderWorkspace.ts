/**
 * Shape builder on the shared tutor/JEV teaching workspace (boss: `shapeBuilder.boss.ts`), plus the open build
 * `make_shape` (shapeMakeBuild.ts).
 *
 * Pure: the component and any probe read the same scene. Every challenge is answered on the grid (placed corners,
 * tapped shapes and categories, drawn fold lines, measuring tools) and checked by the activity's own check, so the
 * tutor is never handed a target shape name, a `correctCategory` or where to place a corner.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { ShapeBuilderChallenge } from './ShapeBuilder';
import { readShape, shapeMakeMiss, type Pt, type ShapeAsk, type ShapeMakeMiss } from './shapeMakeBuild';

export { SHAPE_BUILDER_MISSES_BY_MODE, type ShapeBuilderMiss } from './shapeBuilder.card';

export interface ShapeView {
  /** The corners placed on the grid (build, coordinate_shape, make_shape), in order. */
  points: readonly Pt[];
  closed: boolean;
  /** classify: the learner's sort so far, shape name -> category. */
  classifications: Readonly<Record<string, string>>;
  /** classify: shapes on the board, by the name drawn on each. */
  shapeNames: readonly string[];
  categories: readonly string[];
  /** find_symmetry: fold lines found, and how many the screen asks for. */
  linesFound: number;
  /** measure: which tools are on. */
  toolsOn: readonly string[];
}

/** The open build's ask, from the challenge's code-written property set. */
export const askOf = (c: Pick<ShapeBuilderChallenge, 'targetProperties'>): ShapeAsk => ({
  sides: c.targetProperties?.sides ?? 3,
  ...(c.targetProperties?.rightAngles != null ? { rightAngles: c.targetProperties.rightAngles } : {}),
  ...(c.targetProperties?.parallelPairs != null ? { parallelPairs: c.targetProperties.parallelPairs } : {}),
  ...(c.targetProperties?.equalSides === 'all' ? { equalSides: 'all' as const } : {}),
  ...(c.targetProperties?.linesOfSymmetry != null ? { linesOfSymmetry: c.targetProperties.linesOfSymmetry } : {}),
});

/** The learner's work in their own terms, never the key. A built shape is never named: naming can be the skill. */
export function describeShapeWork(challenge: ShapeBuilderChallenge, view: ShapeView): string {
  switch (challenge.type) {
    case 'build': case 'coordinate_shape': case 'make_shape':
      return view.closed ? 'A closed shape on the grid' : view.points.length ? 'Corners placed, shape not closed yet' : 'No corners placed yet';
    case 'classify': case 'classify_by_lines': {
      const sorted = Object.entries(view.classifications);
      return sorted.length ? `Sorted: ${sorted.map(([s, c]) => `${s} -> ${c}`).join('; ')}` : 'No shape sorted yet';
    }
    case 'find_symmetry': return view.linesFound ? 'Drew fold lines on the shape' : 'No fold line drawn yet';
    case 'measure': return view.toolsOn.length ? `Turned on: ${view.toolsOn.join(', ')}` : 'No measuring tool on yet';
    default: return 'Working on the shape';
  }
}

type BuildTarget = NonNullable<ShapeBuilderChallenge['targetProperties']>;
interface BuiltProps { sides: number; rightAngles: number; parallelPairs: number; equalSides: 'all' | 'pairs' | 'none' }

/**
 * The `build` / `coordinate_shape` check, unchanged in what it accepts: sides exact; right angles and parallel pairs
 * only when a positive count is asked (parallel pairs at least); equal sides only when 'all' or 'pairs' is asked.
 */
export function buildCheck(target: BuildTarget | null | undefined, props: BuiltProps): { miss?: ShapeMakeMiss; mismatches: string[] } {
  if (!target) return { mismatches: [] };
  const out: Array<[ShapeMakeMiss, string]> = [];
  if (target.sides !== undefined && props.sides !== target.sides) out.push(['sides_off', `needs ${target.sides} sides, has ${props.sides}`]);
  if (target.rightAngles !== undefined && target.rightAngles > 0 && props.rightAngles !== target.rightAngles)
    out.push(['right_angles_off', `needs ${target.rightAngles} right angles, has ${props.rightAngles}`]);
  if (target.parallelPairs !== undefined && target.parallelPairs > 0 && props.parallelPairs < target.parallelPairs)
    out.push(['parallel_off', `needs ${target.parallelPairs} parallel pairs, has ${props.parallelPairs}`]);
  if (target.equalSides && target.equalSides !== 'none' && props.equalSides !== target.equalSides)
    out.push(['equal_sides_off', `sides should be ${target.equalSides} equal`]);
  return { miss: out[0]?.[0], mismatches: out.map(([, m]) => m) };
}

/** The open build's facts as numbers, so the shared work history can read how the learner's shape changed. */
export function makeShapeFacts(view: ShapeView): Record<string, number | string> {
  const f = view.closed ? readShape(view.points) : null;
  return {
    cornersPlaced: view.points.length,
    shapeClosed: view.closed ? 'yes' : 'no',
    sides: f?.sides ?? 0,
    rightAngles: f?.rightAngles ?? 0,
    parallelPairs: f?.parallelPairs ?? 0,
    sidesOfOneLength: f?.sidesOfOneLength ?? 0,
    symmetryLines: f?.symmetryLines ?? 0,
  };
}

export function makeShapeMiss(challenge: ShapeBuilderChallenge, view: ShapeView): ShapeMakeMiss | undefined {
  return shapeMakeMiss(askOf(challenge), view.closed ? readShape(view.points) : null);
}

/**
 * What is drawn and asked. No target shape name, category key or placement is ever published. On make_shape the
 * learner's own shape goes as numbers; the shape is never named, because naming it can be the skill.
 */
export function workspaceScene(challenge: ShapeBuilderChallenge, view: ShapeView): SceneOf {
  const drawn: Record<string, string | number> = {};
  if (challenge.type === 'make_shape') {
    Object.assign(drawn, makeShapeFacts(view));
    drawn.shapeFacts = "the numbers above are the learner's own shape as it is now, measured by the activity; the "
      + 'shape is not named (square, trapezoid), because naming it can be the skill';
  } else if (challenge.type === 'build' || challenge.type === 'coordinate_shape') {
    drawn.cornersPlaced = view.points.length;
    drawn.shapeClosed = view.closed ? 'yes' : 'no';
  } else if (challenge.type === 'classify' || challenge.type === 'classify_by_lines') {
    drawn.shapes = view.shapeNames.join(', ');
    drawn.categories = view.categories.join(', ');
  } else if (challenge.type === 'find_symmetry') {
    drawn.foldLinesFound = view.linesFound;
  } else if (challenge.type === 'measure') {
    drawn.toolsOn = view.toolsOn.join(', ') || 'none';
  }
  return { objects: [], facts: { kind: challenge.type, ...drawn, learnerWork: describeShapeWork(challenge, view) } };
}
