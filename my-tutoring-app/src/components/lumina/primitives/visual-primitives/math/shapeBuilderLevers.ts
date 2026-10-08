/**
 * The in-item levers on shape-builder's open build, `make_shape` (/add-eval-modes references/build-mode.md). The
 * learner makes any shape with the asked properties. Checking their own shape against the ask IS the task, so the
 * item starts bare and the levers come on a miss, never from the tier. Each help lever marks the learner's OWN
 * shape on the grid; none shows the ask's numbers beside it or names the shape.
 * - `side_tags`: a number on each side (a straight run of dots is one side).
 * - `corner_marks`: a small square in every right-angle corner.
 * - `parallel_marks`: matching arrows on each pair of parallel sides.
 * - `equal_ticks`: matching tick marks on sides of the same length.
 * - `fold_lines`: a dashed line wherever the shape folds onto itself.
 * - `fewer_properties` (simplify): the same ask with its last property dropped, ungraded, then the full item.
 * The other modes declare no levers.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { ShapeBuilderChallenge } from './ShapeBuilder';
import { askOf } from './shapeBuilderWorkspace';
import { fewerProperties, shapeAskText, type ShapeBand, type ShapeMakeMiss } from './shapeMakeBuild';

export const SIDE_TAGS_LEVER = 'side_tags';
export const CORNER_MARKS_LEVER = 'corner_marks';
export const PARALLEL_MARKS_LEVER = 'parallel_marks';
export const EQUAL_TICKS_LEVER = 'equal_ticks';
export const FOLD_LINES_LEVER = 'fold_lines';
export const FEWER_LEVER = 'fewer_properties';

const FEWER = '~fewer';
export const isPracticeShape = (c: Pick<ShapeBuilderChallenge, 'id'>) => c.id.endsWith(FEWER);

/** The easier ask for a make_shape item, or null: the same sides with the last property dropped, on an empty grid. */
export function fewerShape(c: ShapeBuilderChallenge, band: ShapeBand): ShapeBuilderChallenge | null {
  if (c.type !== 'make_shape' || isPracticeShape(c)) return null;
  const ask = fewerProperties(askOf(c));
  if (!ask) return null;
  return { ...c, id: `${c.id}${FEWER}`, instruction: shapeAskText(ask, band),
    targetProperties: { sides: ask.sides, rightAngles: ask.rightAngles, parallelPairs: ask.parallelPairs,
      equalSides: ask.equalSides, linesOfSymmetry: ask.linesOfSymmetry } };
}

export function shapeBuilderLevers(c: ShapeBuilderChallenge | null, pulled: readonly string[], band: ShapeBand): WorkspaceLever[] {
  if (c?.type !== 'make_shape') return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly ShapeMakeMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  return [
    lever(SIDE_TAGS_LEVER, 'help', ['sides_off'],
      'The learner makes a shape with too many or too few sides, or counts dots on a straight run as corners.',
      "Puts a small number on each side of the learner's shape, 1, 2, 3 and on; dots on one straight run share one side."),
    lever(CORNER_MARKS_LEVER, 'help', ['right_angles_off'],
      'The learner cannot tell which corners of their shape are right angles (square corners).',
      "Draws a small square in every corner of the learner's shape that is a right angle. Marks only their own shape."),
    lever(PARALLEL_MARKS_LEVER, 'help', ['parallel_off'],
      'The learner cannot tell which sides of their shape are parallel.',
      "Puts matching arrows on each pair of parallel sides of the learner's shape."),
    lever(EQUAL_TICKS_LEVER, 'help', ['equal_sides_off'],
      'The learner cannot tell which sides of their shape are the same length.',
      "Puts matching tick marks on the sides of the learner's shape that are the same length."),
    lever(FOLD_LINES_LEVER, 'help', ['symmetry_off'],
      'The learner cannot see where their shape folds onto itself.',
      "Draws a dashed line through the learner's shape wherever it folds exactly onto itself."),
    ...(fewerShape(c, band) ? [lever(FEWER_LEVER, 'simplify', ['right_angles_off', 'parallel_off', 'equal_sides_off', 'symmetry_off'],
      'The learner cannot make a shape with all of these properties at once yet.',
      'Opens an easier ask first on an empty grid: the same number of sides with one property fewer. It is not graded; '
        + 'the full item comes back after it.')] : []),
  ];
}

/** What the pulled help levers put on the grid, for the tutor. */
export function leverFacts(c: ShapeBuilderChallenge | null, pulled: readonly string[]): string {
  if (c?.type !== 'make_shape') return '';
  return [
    pulled.includes(SIDE_TAGS_LEVER) && "Each side of the learner's shape carries a small number.",
    pulled.includes(CORNER_MARKS_LEVER) && "Each right-angle corner of the learner's shape has a small square in it.",
    pulled.includes(PARALLEL_MARKS_LEVER) && "Parallel sides of the learner's shape carry matching arrows.",
    pulled.includes(EQUAL_TICKS_LEVER) && "Sides of the learner's shape that are the same length carry matching ticks.",
    pulled.includes(FOLD_LINES_LEVER) && "Dashed fold lines are drawn through the learner's shape where it folds onto itself.",
  ].filter((s): s is string => !!s).join(' ');
}
