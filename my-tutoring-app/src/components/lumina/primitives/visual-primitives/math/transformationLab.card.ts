/**
 * transformation-lab's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `transformationLab.boss.ts`.
 * Every mode is one item at a time, made on screen and checked by the activity's own Check: the drag modes move the
 * pink image's corners, identify taps one named transformation, compose presses flip, turn and slide buttons.
 * A bespoke boss: the modes mix a drag, a tap and a run of button presses.
 */
import type { TransformationLabChallengeType } from './TransformationLab';
import { defineCard, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`transformMiss`, `TeachingAttempt.miss`, handoff 20), named from the figure the learner made
 * or the option tapped, drawn from the old catalog's commonStruggles (wrong axis, wrong turn direction, a dilation
 * taken as congruent) and the patterns a drag shows:
 * - `unmoved`: checked with the figure still on the pre-image (no corner dragged, no move pressed);
 * - translation: `opposite_shift` the slide the other way; `swapped_shift` the two numbers swapped; `one_axis_shift`
 *   only one of the two numbers applied;
 * - reflection: `wrong_axis` reflected over another line (identify: another reflection chosen);
 * - rotation: `wrong_direction` turned the other way (90 for 270); `wrong_angle` another angle (180 for a quarter turn);
 *   `reflected_instead` the figure flipped instead of turned;
 * - dilation: `added_factor` the scale factor added to each coordinate; `wrong_factor` scaled by another factor;
 *   `one_axis_scaled` only x or only y multiplied;
 * - `partly_placed`: some corners on their image points, not all; `shape_changed`: the corners no longer make the
 *   figure's shape (a rigid motion keeps it; a dilation keeps it in proportion); `misplaced`: the right shape, elsewhere;
 * - identify: `reflection_for_rotation` / `rotation_for_reflection` the other family chosen;
 * - compose: `orientation_off` the figure faces another way than the target; `position_off` it faces the target's way
 *   and sits elsewhere.
 */
export type TransformMiss = 'unmoved' | 'opposite_shift' | 'swapped_shift' | 'one_axis_shift' | 'wrong_axis'
  | 'wrong_direction' | 'wrong_angle' | 'reflected_instead' | 'added_factor' | 'wrong_factor' | 'one_axis_scaled'
  | 'partly_placed' | 'shape_changed' | 'misplaced' | 'reflection_for_rotation' | 'rotation_for_reflection'
  | 'orientation_off' | 'position_off';

const DRAG_TAIL: readonly TransformMiss[] = ['partly_placed', 'shape_changed', 'misplaced'];
export const TRANSFORM_MISSES_BY_MODE: Record<TransformationLabChallengeType, readonly TransformMiss[]> = {
  apply_translation_reflection: ['unmoved', 'opposite_shift', 'swapped_shift', 'one_axis_shift', 'wrong_axis', ...DRAG_TAIL],
  apply_rotation: ['unmoved', 'wrong_direction', 'wrong_angle', 'reflected_instead', ...DRAG_TAIL],
  identify_transformation: ['wrong_axis', 'reflection_for_rotation', 'rotation_for_reflection', 'wrong_direction', 'wrong_angle'],
  compose_sequence: ['unmoved', 'orientation_off', 'position_off'],
  dilation_similarity: ['unmoved', 'added_factor', 'wrong_factor', 'one_axis_scaled', ...DRAG_TAIL],
};

const DRAG = {
  answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
  moves: 'drags each pink corner to a grid point (corners snap; Reset corners puts them back), then presses Check',
} as const;

export const transformationLabCard = defineCard<TransformMiss>({
  id: 'transformation-lab',
  grades: ['Grade 7', 'Grade 8'],
  // Every mode publishes levers (`transformationLabLevers.ts`); every miss is answered by a lever on every item.
  modes: {
    apply_translation_reflection: { ...DRAG, misses: TRANSFORM_MISSES_BY_MODE.apply_translation_reflection },
    apply_rotation: { ...DRAG, misses: TRANSFORM_MISSES_BY_MODE.apply_rotation },
    identify_transformation: { ...TAP_ONE, misses: TRANSFORM_MISSES_BY_MODE.identify_transformation,
      moves: 'taps one of the named transformations, then presses Check' },
    compose_sequence: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
      misses: TRANSFORM_MISSES_BY_MODE.compose_sequence,
      moves: 'presses the flip, turn and slide buttons (each moves the whole pink figure; Reset starts over), then presses Check' },
    dilation_similarity: { ...DRAG, misses: TRANSFORM_MISSES_BY_MODE.dilation_similarity },
  },
  words: {
    job: 'transform a figure on the coordinate grid: make the image of a translation, reflection, rotation or dilation, '
      + 'name the one transformation that maps the cyan figure onto the amber one, or move the figure onto a dashed '
      + 'target with flips, turns and slides',
    answer: 'where the image\'s corners land, which transformation they name, or which moves put the figure on the target',
    question: 'the instruction, the cyan pre-image and any coordinates labelled on it, the option names, the move buttons, '
      + 'and any rule card on screen',
  },
  levers: true,
});
