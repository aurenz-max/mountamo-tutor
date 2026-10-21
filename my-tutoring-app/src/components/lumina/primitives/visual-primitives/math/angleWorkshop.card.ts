/**
 * angle-workshop's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `angleWorkshop.boss.ts`.
 * Every mode is one item at a time, answered on screen and checked by the activity: measure, the solving modes and
 * transversal type a number, classify_pairs taps a relationship, both then Check; make_angle turns a ray and presses
 * I'm done!. A bespoke boss: the modes mix typing, a tap and a build.
 */
import type { AngleWorkshopChallengeType } from './AngleWorkshop';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a missed make_angle build shows (`makeAngleMiss`): the kind of angle the learner MADE (never a guessed cause),
 * or, on a degree range, which side of it. `not_opened`: the ray never left the fixed ray.
 */
export type MakeAngleMiss = 'not_opened' | 'made_acute' | 'made_right' | 'made_obtuse' | 'made_straight' | 'below_range' | 'above_range';
export const MAKE_ANGLE_MISSES: readonly MakeAngleMiss[] =
  ['not_opened', 'made_acute', 'made_right', 'made_obtuse', 'made_straight', 'below_range', 'above_range'];

/**
 * The pattern a wrong answer shows on a classic mode (`classicMiss`), named for the value typed (never a guessed cause).
 * Each id is the total or given the learner's number matches, checked in this order; `near` / `far` are the rest.
 * - measure: `other_scale` (the reading from the other end of the scale, 180 − the angle).
 * - classify_pairs: `chose_<relationship>` (the relationship tapped).
 * - solve_unknown: `total_ninety` / `total_one_eighty` / `total_three_sixty` (a total other than the figure's minus the
 *   labeled angles), `copied_known` (a labeled angle), `one_known_left` (360 minus one labeled angle only, around a point).
 * - solve_algebraic: `typed_an_angle` (the value of one labeled expression, not x), `total_ninety` / `total_one_eighty`
 *   (x for a sum to the other total, or to a total on equal angles).
 * - transversal: `supplement_given` (180 − the marked angle), `copied_given` (a labeled angle), `added_givens` (the two
 *   labeled angles added, on a triangle), `one_given_left` (180 minus one labeled angle only), `found_interior` (the
 *   triangle's own corner where the exterior angle is, 180 − both labeled angles).
 */
export const CLASSIC_MISSES = {
  measure: ['other_scale', 'near', 'far'],
  classify_pairs: ['chose_complementary', 'chose_supplementary', 'chose_vertical', 'chose_adjacent'],
  solve_unknown: ['total_ninety', 'total_one_eighty', 'total_three_sixty', 'copied_known', 'one_known_left', 'near', 'far'],
  solve_algebraic: ['typed_an_angle', 'total_ninety', 'total_one_eighty', 'near', 'far'],
  transversal: ['supplement_given', 'copied_given', 'added_givens', 'one_given_left', 'found_interior', 'near', 'far'],
} as const;

export type ClassicMiss = (typeof CLASSIC_MISSES)[keyof typeof CLASSIC_MISSES][number];
export type AngleMiss = MakeAngleMiss | ClassicMiss;

export const ANGLE_MISSES_BY_MODE: Record<AngleWorkshopChallengeType, readonly AngleMiss[]> = {
  make_angle: MAKE_ANGLE_MISSES, ...CLASSIC_MISSES,
};

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;
const TYPED = { ...CHECKED, answer: 'type' } as const;

export const angleWorkshopCard = defineCard<AngleMiss>({
  id: 'angle-workshop',
  grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  // Every mode publishes levers (`angleWorkshopLevers.ts`): a help picture on the figure, a simpler item of the mode.
  modes: {
    measure: { ...TYPED, misses: CLASSIC_MISSES.measure,
      moves: 'presses Place the protractor, types the reading in degrees in the answer box, then presses Check' },
    make_angle: { ...CHECKED, answer: 'build', misses: MAKE_ANGLE_MISSES,
      // The ray never left the fixed ray: the screen already says to open it.
      unanswered: ['not_opened'],
      moves: 'turns the second ray from the fixed ray (drags its end, or presses Open wider, Close in or Start over), '
        + 'then presses I\'m done!' },
    classify_pairs: { ...CHECKED, answer: 'tap', misses: CLASSIC_MISSES.classify_pairs,
      moves: 'taps one relationship (Complementary, Supplementary, Vertical or Adjacent), then presses Check' },
    solve_unknown: { ...TYPED, misses: CLASSIC_MISSES.solve_unknown,
      moves: 'types the unknown angle x in degrees in the answer box, then presses Check' },
    solve_algebraic: { ...TYPED, misses: CLASSIC_MISSES.solve_algebraic,
      moves: 'types the value of x in the answer box, then presses Check' },
    transversal: { ...TYPED, misses: CLASSIC_MISSES.transversal,
      moves: 'types the unknown angle x in degrees in the answer box, then presses Check' },
  },
  words: {
    job: 'work with angles: read one off a protractor, make an angle of the asked kind by turning a ray, name how two '
      + 'angles are related, or find an unknown angle or the value of x from the angles a figure labels',
    answer: 'the number they type, the relationship they tap, or the angle they make',
    question: 'the instruction, the relationship choices, and every angle or expression the figure labels',
  },
  levers: true,
});
