/**
 * shape-composer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `shapeComposer.boss.ts`.
 * Every mode is one item at a time, answered on the board and checked by the activity itself: pieces dragged into an
 * outline or a picture, the parts of a big shape tapped, a number of pieces typed, or a picture of the learner's own
 * built from listed shapes. A bespoke boss: the modes mix a drag, a run of taps and a typed number.
 */
import type { ShapeBuildMiss } from './shapeComposerBuild';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), from the work the check reads (`shapeComposerMiss`):
 * - compose-match: `pieces_left` (pieces still in the palette), `piece_off_outline` (all out, one not on its spot);
 * - compose-picture: `shape_missing` (a shape the picture needs is not on the board), `shape_off_spot`;
 * - decompose: `not_a_part` (tapped a shape the big shape is not made of), `missed_part` (fewer parts than it has),
 *   `extra_part` (more), `wrong_mix` (as many parts, the wrong kinds of each);
 * - how-many-ways: `too_few` (fewer than the fewest pieces that build it), `too_many` (more than the fewest);
 * - free-create: the open build's own misses (`ShapeBuildMiss`), or `too_few_shapes` on an older payload with no recipe.
 */
export type ShapeComposerMiss = 'pieces_left' | 'piece_off_outline'
  | 'shape_missing' | 'shape_off_spot'
  | 'not_a_part' | 'missed_part' | 'extra_part' | 'wrong_mix'
  | 'too_few' | 'too_many'
  | ShapeBuildMiss | 'too_few_shapes';

export const SHAPE_COMPOSER_MISSES_BY_MODE: Record<string, readonly ShapeComposerMiss[]> = {
  'compose-match': ['pieces_left', 'piece_off_outline'],
  'compose-picture': ['shape_missing', 'shape_off_spot'],
  decompose: ['not_a_part', 'missed_part', 'extra_part', 'wrong_mix'],
  'how-many-ways': ['too_few', 'too_many'],
  'free-create': ['missing_piece', 'extra_piece', 'overlapping', 'not_touching', 'too_few_shapes'],
};

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;
const DRAG = 'taps a palette piece onto the board and drags it into place (it snaps when close; a selected piece can be '
  + 'turned or removed)';

export const shapeComposerCard = defineCard<ShapeComposerMiss>({
  id: 'shape-composer',
  grades: ['Kindergarten', 'Grade 1'],
  // Every mode declares levers (`shapeComposerLevers.ts`). An older free-create payload with no recipe has no list to
  // match or shorten: its any-two-shapes check (`too_few_shapes`) has no lever.
  modes: {
    'compose-match': { ...CHECKED, answer: 'build', misses: SHAPE_COMPOSER_MISSES_BY_MODE['compose-match'],
      moves: `${DRAG}, then presses Check Answer` },
    'compose-picture': { ...CHECKED, answer: 'build', misses: SHAPE_COMPOSER_MISSES_BY_MODE['compose-picture'],
      moves: `${DRAG}, then presses Check Answer` },
    decompose: { ...CHECKED, answer: 'tap', misses: SHAPE_COMPOSER_MISSES_BY_MODE.decompose,
      moves: 'taps a shape button once for each part of that kind in the big shape (Reset Selections clears the taps), '
        + 'then presses Check Answer' },
    'how-many-ways': { ...CHECKED, answer: 'type', misses: SHAPE_COMPOSER_MISSES_BY_MODE['how-many-ways'],
      moves: 'types how many pieces build the named shape, then presses Check Answer; palette pieces may be put on the '
        + 'board to try it first' },
    'free-create': { ...CHECKED, answer: 'build', misses: SHAPE_COMPOSER_MISSES_BY_MODE['free-create'],
      unanswered: ['too_few_shapes'],
      moves: `${DRAG}, then presses "I'm done!"; Start over clears the board` },
  },
  words: {
    job: 'put shapes together and take them apart: fill an outline or a picture with pieces, name the shapes a big '
      + 'shape is made of, find how many pieces build a shape, or make a picture of their own from listed shapes',
    answer: 'where each piece goes and which way it turns, which shapes and how many make up a big shape, how many '
      + 'pieces build a shape, and what to add, take off or move on their own picture',
    question: 'the instruction, the shapes listed under it on a build, the outline or picture named, and the shape names '
      + 'on the palette and the buttons',
  },
  levers: true,
});
