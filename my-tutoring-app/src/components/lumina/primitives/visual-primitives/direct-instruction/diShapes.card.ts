/**
 * Shapes' card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `diShapes.boss.ts`.
 * Five modes are one spoken answer the tutor judges against the key; build_shape is made on the dots and the board
 * checks it, so the boss is bespoke.
 */
import type { SpokenShapeMiss } from '../math/shapeSorterDomain';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What the made shape got wrong, first one first (`shapeBuildMiss`, `TeachingAttempt.miss`). */
export type ShapeBuildMiss = 'too_few_sides' | 'too_many_sides' | 'corners_not_square' | 'sides_not_equal'
  | 'made_square' | 'parallel_off';
export const SHAPE_BUILD_MISSES: readonly ShapeBuildMiss[] =
  ['too_few_sides', 'too_many_sides', 'corners_not_square', 'sides_not_equal', 'made_square', 'parallel_off'];

const NAME = ['near_name', 'other_shape_name', 'described_shape'] as const;
const COUNT = ['said_shape_name', 'one_short', 'one_over', 'short_by_more', 'over_by_more'] as const;

export const diShapesCard = defineCard<SpokenShapeMiss | ShapeBuildMiss>({
  id: 'di-shapes',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2'],
  // The spoken modes' known wrong answers (`shapesSpokenMisses`, shape-sorter's ids), named by the `spoken_miss`
  // observer; the open build's are the board's own check (`shapeBuildMiss`), not words.
  modes: {
    name_shape: { ...SPOKEN, misses: NAME },
    shape_review: { ...SPOKEN, misses: NAME },
    find_real_object: { ...SPOKEN, misses: ['said_object', ...NAME] },
    count_sides: { ...SPOKEN, misses: COUNT },
    count_corners: { ...SPOKEN, misses: COUNT },
    build_shape: { answer: 'build', judge: 'activity', flow: 'one-at-a-time',
      moves: 'taps dots to place corners, taps the first corner to close the shape, and presses "I\'m done!"',
      misses: SHAPE_BUILD_MISSES },
  },
  words: {
    job: 'name the drawn shape, say how many sides or corners it has, or make the named shape on the dots',
    answer: 'the answer',
    question: 'the ask',
    special: 'The stage draws one flat shape, or a familiar object; on a real object the shape in it is the answer. On '
      + 'a counting item never say the shape name: it gives the count away. On a naming item never describe the shape '
      + 'or offer a choice of names. Stuck with the model on screen: say the model again, then ask. On a build item '
      + 'never say how many sides or corners the asked shape has or what the learner\'s shape is short of.',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
