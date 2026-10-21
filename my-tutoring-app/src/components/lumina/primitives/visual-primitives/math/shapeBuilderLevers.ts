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
 * - `fewer_properties` (easier): the same ask with its last property dropped, ungraded, then the full item.
 * The other modes declare no levers (their misses are `unanswered` on the card).
 *
 * Declared once as a lever set (`SHAPE_BUILDER_LEVERS`, `bossLevers.ts`); its context is the lesson's grade band,
 * which words the easier ask.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { ShapeBuilderChallenge } from './ShapeBuilder';
import { askOf } from './shapeBuilderWorkspace';
import { fewerProperties, shapeAskText, type ShapeBand } from './shapeMakeBuild';
import { SHAPE_BUILDER_MISSES_BY_MODE } from './shapeBuilder.card';

export const SIDE_TAGS_LEVER = 'side_tags';
export const CORNER_MARKS_LEVER = 'corner_marks';
export const PARALLEL_MARKS_LEVER = 'parallel_marks';
export const EQUAL_TICKS_LEVER = 'equal_ticks';
export const FOLD_LINES_LEVER = 'fold_lines';
export const FEWER_LEVER = 'fewer_properties';

const FEWER = '~fewer';
export const isPracticeShape = (c: Pick<ShapeBuilderChallenge, 'id'>) => c.id.endsWith(FEWER);
/** The session item id a practice id stands in for. */
export const practiceParent = (id: string) => (id.endsWith(FEWER) ? id.slice(0, -FEWER.length) : id);

/** The easier ask for a make_shape item, or null: the same sides with the last property dropped, on an empty grid. */
export function fewerShape(c: ShapeBuilderChallenge, band: ShapeBand): ShapeBuilderChallenge | null {
  if (c.type !== 'make_shape' || isPracticeShape(c)) return null;
  const ask = fewerProperties(askOf(c));
  if (!ask) return null;
  return { ...c, id: `${c.id}${FEWER}`, instruction: shapeAskText(ask, band),
    targetProperties: { sides: ask.sides, rightAngles: ask.rightAngles, parallelPairs: ask.parallelPairs,
      equalSides: ask.equalSides, linesOfSymmetry: ask.linesOfSymmetry } };
}

const MAKE = ['make_shape'];

/** The levers, declared once (`bossLevers.ts`). None is offered on a practice item: the component declares nothing then. */
export const SHAPE_BUILDER_LEVERS = leverSet<ShapeBuilderChallenge, ShapeBand>({
  modeOf: c => c.type,
  missesOf: mode => SHAPE_BUILDER_MISSES_BY_MODE[mode] ?? [],
  specs: [
    { id: SIDE_TAGS_LEVER, type: 'marks', modes: MAKE, answers: ['sides_off'],
      when: 'The learner makes a shape with too many or too few sides, or counts dots on a straight run as corners.',
      does: "Puts a small number on each side of the learner's shape, 1, 2, 3 and on; dots on one straight run share one side.",
      fact: "Each side of the learner's shape carries a small number." },
    { id: CORNER_MARKS_LEVER, type: 'marks', modes: MAKE, answers: ['right_angles_off'],
      when: 'The learner cannot tell which corners of their shape are right angles (square corners).',
      does: "Draws a small square in every corner of the learner's shape that is a right angle. Marks only their own shape.",
      fact: "Each right-angle corner of the learner's shape has a small square in it." },
    { id: PARALLEL_MARKS_LEVER, type: 'marks', modes: MAKE, answers: ['parallel_off'],
      when: 'The learner cannot tell which sides of their shape are parallel.',
      does: "Puts matching arrows on each pair of parallel sides of the learner's shape.",
      fact: "Parallel sides of the learner's shape carry matching arrows." },
    { id: EQUAL_TICKS_LEVER, type: 'marks', modes: MAKE, answers: ['equal_sides_off'],
      when: 'The learner cannot tell which sides of their shape are the same length.',
      does: "Puts matching tick marks on the sides of the learner's shape that are the same length.",
      fact: "Sides of the learner's shape that are the same length carry matching ticks." },
    { id: FOLD_LINES_LEVER, type: 'marks', modes: MAKE, answers: ['symmetry_off'],
      when: 'The learner cannot see where their shape folds onto itself.',
      does: "Draws a dashed line through the learner's shape wherever it folds exactly onto itself.",
      fact: "Dashed fold lines are drawn through the learner's shape where it folds onto itself." },
    // Offered only when the ask has a property to drop (`fewerShape`).
    { id: FEWER_LEVER, type: 'easier', modes: MAKE, answers: ['right_angles_off', 'parallel_off', 'equal_sides_off', 'symmetry_off'],
      when: 'The learner cannot make a shape with all of these properties at once yet.',
      does: 'Opens an easier ask first on an empty grid: the same number of sides with one property fewer. It is not graded; '
        + 'the full item comes back after it.',
      content: (c, band) => fewerShape(c, band) },
  ],
});
