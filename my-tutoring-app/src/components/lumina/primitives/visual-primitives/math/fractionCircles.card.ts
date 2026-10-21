/**
 * fraction-circles' card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `fractionCircles.boss.ts`.
 * Every mode is a gesture the circle checks in code: a typed fraction, shaded slices, a chosen side, an open build, or
 * a touched picture. One item at a time, activity-judged, answered five ways: a bespoke boss.
 */
import type { EqualBuildMiss } from './fractionEqualBuild';
import { TAP_ONE, defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong Check shows (`fractionMiss`, `TeachingAttempt.miss`), from the learner's own work on the circle. Only the
 * observable pattern; why the learner did it is the tutor's and the distiller's to judge.
 * - identify (typed n/d): `not_a_fraction`; `swapped` (the piece count on top, the shaded count below);
 *   `bottom_not_pieces` (the bottom is not the circle's piece count); `top_is_unshaded` (the top is the unshaded
 *   count); `top_one_off` / `top_off_by_more`.
 * - build (slices shaded): `shaded_all`; `shaded_the_rest` (the unshaded count shaded instead);
 *   `one_short` / `one_over` / `short_by_more` / `over_by_more`.
 * - equivalent (slices shaded on the finer circle): `copied_the_count` (the reference's shaded count shaded again);
 *   then the four count misses.
 * - compare: `picked_more_slices` (the smaller amount, on the circle with more slices); `picked_smaller`;
 *   `said_equal` (they are not); `missed_equal` (a side picked when they are equal).
 */
export type FractionMiss = 'not_a_fraction' | 'swapped' | 'bottom_not_pieces' | 'top_is_unshaded' | 'top_one_off'
  | 'top_off_by_more' | 'shaded_all' | 'shaded_the_rest' | 'copied_the_count' | 'one_short' | 'one_over'
  | 'short_by_more' | 'over_by_more' | 'picked_more_slices' | 'picked_smaller' | 'said_equal' | 'missed_equal';

/**
 * What a wrong touch shows, by the kind of picture touched, never which one (`touchMiss`):
 * `same_parts_other_shading` (as many equal parts as the fraction, a different amount shaded),
 * `same_shading_other_parts` (as many shaded parts, cut into a different number), `other_fraction`.
 */
export type TouchMiss = 'same_parts_other_shading' | 'same_shading_other_parts' | 'other_fraction';

export type FractionCirclesMiss = FractionMiss | TouchMiss | EqualBuildMiss;
export type FractionCirclesMode = 'identify' | 'build' | 'compare' | 'equivalent' | 'touch_fraction' | 'build_equal';

const COUNT = ['one_short', 'one_over', 'short_by_more', 'over_by_more'] as const;
export const FRACTION_CIRCLES_MISSES_BY_MODE: Record<FractionCirclesMode, readonly FractionCirclesMiss[]> = {
  identify: ['not_a_fraction', 'swapped', 'bottom_not_pieces', 'top_is_unshaded', 'top_one_off', 'top_off_by_more'],
  build: ['shaded_all', 'shaded_the_rest', ...COUNT],
  equivalent: ['copied_the_count', ...COUNT],
  compare: ['picked_more_slices', 'picked_smaller', 'said_equal', 'missed_equal'],
  touch_fraction: ['same_parts_other_shading', 'same_shading_other_parts', 'other_fraction'],
  // The open build's check (`equalBuildMiss`, shared with fraction-bar).
  build_equal: ['unequal_pieces', 'same_pieces', 'shaded_the_rest', 'cut_cannot_make', 'one_off', 'off_by_more'],
};

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;
const M = FRACTION_CIRCLES_MISSES_BY_MODE;

export const fractionCirclesCard = defineCard<FractionCirclesMiss>({
  id: 'fraction-circles',
  grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  // Every mode publishes levers (`fractionCirclesLevers.ts`); every miss is answered by a lever in its mode.
  modes: {
    identify: { ...CHECKED, answer: 'type', moves: 'types the fraction (like 1/2) in the answer box, then presses Check Answer',
      misses: M.identify },
    build: { ...CHECKED, answer: 'build', moves: 'taps slices to shade them, then presses Check Answer', misses: M.build },
    compare: { ...TAP_ONE, moves: 'picks Left is larger, They are equal or Right is larger, then presses Check Answer',
      misses: M.compare },
    equivalent: { ...CHECKED, answer: 'build', moves: 'shades slices on the second circle, then presses Check Answer',
      misses: M.equivalent },
    touch_fraction: { ...TAP_ONE, moves: 'touches one of the pictures; the touch is the answer, with no Check button',
      misses: M.touch_fraction },
    build_equal: { ...CHECKED, answer: 'build',
      moves: "picks how many equal pieces to cut the circle into, may cut one piece in half, taps pieces to shade them, then presses I'm done",
      misses: M.build_equal },
  },
  words: {
    job: 'show fractions on circles cut into equal slices: name the fraction a shaded circle shows, shade a fraction, pick '
      + 'the larger of two circles, shade an equal fraction, make an equal fraction their own way, or touch the picture of '
      + 'a fraction you say',
    answer: 'the fraction they type, the slices they shade, the side they pick or the picture they touch',
    question: 'the instruction, every fraction printed on screen, and in touch-the-fraction the fraction the task names',
  },
  levers: true,
});
