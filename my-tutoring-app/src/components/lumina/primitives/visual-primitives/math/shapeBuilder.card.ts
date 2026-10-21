/**
 * shape-builder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `shapeBuilder.boss.ts`.
 * Every mode is worked on the dot grid and checked by the activity itself: corners placed and closed into a shape,
 * tool buttons turned on, shapes tapped into categories, fold lines drawn. A bespoke boss: the modes mix a build,
 * a board of taps and toggles.
 */
import type { ShapeMakeMiss } from './shapeMakeBuild';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), only the observable pattern:
 * - build and coordinate_shape: the first target property the closed shape does not have, as the existing check
 *   reads it (`buildCheck`): `sides_off`, `right_angles_off`, `parallel_off`, `equal_sides_off`;
 * - make_shape: the first asked property the shape does not have (`shapeMakeMiss`), plus `symmetry_off`;
 * - classify and classify_by_lines: `misplaced_shape` (at least one shape in a category it does not belong to).
 * measure, compose and find_symmetry have no wrong check: an unfinished one is not checked.
 */
export type ShapeBuilderMiss = ShapeMakeMiss | 'misplaced_shape';

const BUILT: readonly ShapeBuilderMiss[] = ['sides_off', 'right_angles_off', 'parallel_off', 'equal_sides_off'];
export const SHAPE_BUILDER_MISSES_BY_MODE: Record<string, readonly ShapeBuilderMiss[]> = {
  build: BUILT,
  make_shape: [...BUILT, 'symmetry_off'],
  measure: [],
  classify_by_lines: ['misplaced_shape'],
  classify: ['misplaced_shape'],
  compose: [],
  find_symmetry: [],
  coordinate_shape: BUILT,
};

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;
const CORNERS = { ...CHECKED, answer: 'manipulate',
  moves: 'taps grid dots to place corners and taps the first corner again to close the shape (Clear Shape starts over), '
    + 'then presses Check' } as const;
// Not a board: the screen already says right or wrong on each shape as it is sorted, and the categories are often two.
const SORT = { ...CHECKED, answer: 'tap',
  moves: 'taps a shape on the grid, then the category button it belongs in, until every shape is sorted, then presses Check' } as const;

export const shapeBuilderCard = defineCard<ShapeBuilderMiss>({
  id: 'shape-builder',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  // Only the open build (make_shape) offers levers (`shapeBuilderLevers.ts`). The other checked modes have none yet:
  // their misses are listed in `unanswered` (a lever for them is /add-support-tiers work, not this wiring).
  modes: {
    build: { ...CORNERS, misses: SHAPE_BUILDER_MISSES_BY_MODE.build, unanswered: BUILT },
    make_shape: { ...CHECKED, answer: 'build', misses: SHAPE_BUILDER_MISSES_BY_MODE.make_shape,
      moves: 'taps dots to place corners, taps the first corner to close the shape, taps a corner to take it out, and with '
        + 'the shape closed taps a new dot to add a corner on the nearest side (Clear Shape starts over), then presses "I\'m done!"' },
    measure: { ...CHECKED, answer: 'manipulate', misses: [],
      moves: 'turns on each of the Ruler, Protractor and Parallel buttons shown, which mark the drawn shape\'s measures, then presses Check' },
    classify_by_lines: { ...SORT, misses: SHAPE_BUILDER_MISSES_BY_MODE.classify_by_lines, unanswered: ['misplaced_shape'] },
    classify: { ...SORT, misses: SHAPE_BUILDER_MISSES_BY_MODE.classify, unanswered: ['misplaced_shape'] },
    compose: { ...CHECKED, answer: 'manipulate', misses: [],
      moves: 'presses Check when done (the grid shows the shape; there are no pieces to place)' },
    find_symmetry: { ...CHECKED, answer: 'manipulate', misses: [],
      moves: 'taps two grid dots to draw a fold line across the drawn shape (a line that is not a fold is refused), as many '
        + 'as asked, then presses Check' },
    coordinate_shape: { ...CORNERS, misses: SHAPE_BUILDER_MISSES_BY_MODE.coordinate_shape, unanswered: BUILT },
  },
  words: {
    job: 'work with shapes on a dot grid: build a shape with the properties asked (on make_shape, any shape that has '
      + 'them), measure a drawn shape with the tools, sort shapes into categories, or draw a shape\'s fold lines',
    answer: 'the shape they build, where they sort each shape, the fold lines they draw or the tools they turn on',
    question: 'the instruction, the category buttons, the names printed on the shapes and the grid\'s coordinates',
  },
  levers: true,
});
