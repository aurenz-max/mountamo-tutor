/**
 * circle-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `circleExplorer.boss.ts`.
 * Every mode asks for one number: the learner types it and presses Check, and the activity checks it within the
 * item's tolerance (which covers π ≈ 3.14 against the true π). One item at a time, typed, activity-judged: a bespoke boss.
 */
import type { CircleExplorerChallengeType } from './CircleExplorer';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`circleMiss`, `TeachingAttempt.miss`, handoff 20), from the number typed, drawn from the
 * old catalog's commonStruggles (radius and diameter swapped, the radius not squared, around and inside confused,
 * multiplying where the reverse divides) and from what each mode's formula can be mistaken for:
 * - discover π: `inverse_ratio` d ÷ C; `typed_length` the circumference or the diameter typed instead of the ratio (a
 *   plain 3 is inside the item's tolerance and is credited);
 * - circumference: `pi_times_radius` π × r (half of it); `two_pi_times_diameter` 2 × π × d (twice it);
 *   `area_formula` π × r²; `no_pi` the diameter or the radius alone;
 * - area: `circumference_formula` 2 × π × r; `pi_times_radius` π × r (not squared); `diameter_squared` π × d²;
 *   `no_pi` r²;
 * - reverse: `diameter_not_radius` C ÷ π (the diameter); `multiplied` C or A times π (or 2π); `divided_by_two_only`
 *   C ÷ 2; `no_square_root` A ÷ π (r²); `divided_by_two_pi` A ÷ 2π; `no_pi_divide` √A;
 * - composite: semicircle area `whole_circle` π × r², `diameter_as_radius` ½ × π × (2r)², `half_circumference` π × r;
 *   semicircle perimeter `curve_only` π × r, `full_circle_edge` 2 × π × r (with or without the diameter), `radius_edge`
 *   π × r + r; circle in square `circle_area` π × r², `square_area` s², `added` s² + π × r²;
 * - every mode: `near_miss` within 10%, else `too_high` / `too_low`.
 */
export type CircleMiss = 'inverse_ratio' | 'typed_length'
  | 'pi_times_radius' | 'two_pi_times_diameter' | 'area_formula' | 'no_pi'
  | 'circumference_formula' | 'diameter_squared'
  | 'diameter_not_radius' | 'multiplied' | 'divided_by_two_only' | 'no_square_root' | 'divided_by_two_pi' | 'no_pi_divide'
  | 'whole_circle' | 'diameter_as_radius' | 'half_circumference' | 'curve_only' | 'full_circle_edge' | 'radius_edge'
  | 'circle_area' | 'square_area' | 'added'
  | 'near_miss' | 'too_high' | 'too_low';

const SIZE: readonly CircleMiss[] = ['near_miss', 'too_high', 'too_low'];
export const CIRCLE_MISSES_BY_MODE: Record<CircleExplorerChallengeType, readonly CircleMiss[]> = {
  discover_pi: ['inverse_ratio', 'typed_length', ...SIZE],
  circumference: ['pi_times_radius', 'two_pi_times_diameter', 'area_formula', 'no_pi', ...SIZE],
  area: ['circumference_formula', 'pi_times_radius', 'diameter_squared', 'no_pi', ...SIZE],
  reverse: ['diameter_not_radius', 'multiplied', 'divided_by_two_only', 'no_square_root', 'divided_by_two_pi', 'no_pi_divide', ...SIZE],
  composite: ['whole_circle', 'diameter_as_radius', 'half_circumference', 'curve_only', 'full_circle_edge', 'radius_edge',
    'circle_area', 'square_area', 'added', ...SIZE],
};

const TYPED = { answer: 'type', judge: 'activity', flow: 'one-at-a-time' } as const;
const CHECK = 'types a number in the answer box and presses Check';

export const circleExplorerCard = defineCard<CircleMiss>({
  id: 'circle-explorer',
  grades: ['Grade 6', 'Grade 7', 'Grade 8'],
  // Every mode publishes levers (`circleExplorerLevers.ts`); every miss is answered by a help lever on every item.
  modes: {
    discover_pi: { ...TYPED, moves: `presses "Unroll the circumference" first, then ${CHECK}`,
      misses: CIRCLE_MISSES_BY_MODE.discover_pi },
    circumference: { ...TYPED, moves: `may press "Unroll the circumference" to see it laid straight, then ${CHECK}`,
      misses: CIRCLE_MISSES_BY_MODE.circumference },
    area: { ...TYPED, moves: `may press "Slice into wedges & rearrange" to see the circle as a near-rectangle, then ${CHECK}`,
      misses: CIRCLE_MISSES_BY_MODE.area },
    reverse: { ...TYPED, moves: CHECK, misses: CIRCLE_MISSES_BY_MODE.reverse },
    composite: { ...TYPED, moves: CHECK, misses: CIRCLE_MISSES_BY_MODE.composite },
  },
  words: {
    job: 'find a circle\'s measures with π: the circumference divided by the diameter, the distance around, the space '
      + 'inside, the radius worked back from a given circumference or area, or a figure made from part of a circle',
    answer: 'the number they type',
    question: 'the circle\'s story, the question, and every length, value and caption the figure labels',
  },
  levers: true,
});
