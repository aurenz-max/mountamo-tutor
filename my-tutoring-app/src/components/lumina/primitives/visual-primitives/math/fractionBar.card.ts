/**
 * fraction-bar's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `fractionBar.boss.ts`.
 * Every mode is a gesture the bar checks in code: the three-step item (pick the numerator, pick the denominator, shade
 * the bar), a sign picked between two bars, or an open build. One item at a time, activity-judged: a bespoke boss.
 */
import type { EqualBuildMiss } from './fractionEqualBuild';
import { TAP_ONE, defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`fractionBarMiss`, `TeachingAttempt.miss`) on the three-step item, from the learner's own
 * work: numerator step `chose_denominator` (the bottom number picked) / `other_numerator`; denominator step
 * `chose_numerator` / `other_denominator`; shading `shaded_all`, `shaded_the_rest` (the unshaded count shaded instead),
 * `one_short` / `one_over` / `short_by_more` / `over_by_more`. build_equal names `EqualBuildMiss` (`fractionEqualBuild.ts`).
 */
export type FractionBarMiss = 'chose_denominator' | 'other_numerator' | 'chose_numerator' | 'other_denominator'
  | 'shaded_all' | 'shaded_the_rest' | 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more';

/**
 * compare's misses, from the sign picked: `said_equal` (= for two different amounts), `said_unequal` (a side for an
 * equal pair), `more_parts_bigger` (the reversed sign on a same-numerator pair: the fraction with more parts read as
 * the bigger one, whole-number bias), `flipped` (the reversed sign on any other pair).
 */
export type FractionCompareMiss = 'said_equal' | 'said_unequal' | 'more_parts_bigger' | 'flipped';

export type FractionBarAnyMiss = FractionBarMiss | FractionCompareMiss | EqualBuildMiss;
export type FractionBarMode = 'identify' | 'build' | 'larger_denominators' | 'compare' | 'add_subtract' | 'build_equal';

const FRACTION_BAR_MISSES: readonly FractionBarMiss[] = ['chose_denominator', 'other_numerator', 'chose_numerator',
  'other_denominator', 'shaded_all', 'shaded_the_rest', 'one_short', 'one_over', 'short_by_more', 'over_by_more'];
const FRACTION_COMPARE_MISSES: readonly FractionCompareMiss[] = ['said_equal', 'said_unequal', 'more_parts_bigger', 'flipped'];

export const FRACTION_BAR_MISSES_BY_MODE: Record<FractionBarMode, readonly FractionBarAnyMiss[]> = {
  identify: FRACTION_BAR_MISSES,
  build: FRACTION_BAR_MISSES,
  larger_denominators: FRACTION_BAR_MISSES,
  add_subtract: FRACTION_BAR_MISSES,
  compare: FRACTION_COMPARE_MISSES,
  // The open build's check (`equalBuildMiss`, shared with fraction-circles).
  build_equal: ['unequal_pieces', 'same_pieces', 'shaded_the_rest', 'cut_cannot_make', 'one_off', 'off_by_more'],
};

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;
const M = FRACTION_BAR_MISSES_BY_MODE;
/** The three-step item: two picks and a shading, each with its own Check, judged as one item. */
const STEPS = { ...CHECKED, answer: 'build',
  moves: 'picks the numerator from four number buttons and presses Check Answer, picks the denominator the same way, '
    + 'then taps parts of the bar to shade them and presses Submit Fraction' } as const;

export const fractionBarCard = defineCard<FractionBarAnyMiss>({
  id: 'fraction-bar',
  grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  // The three-step modes and build_equal publish levers (`fractionBarLevers.ts`); compare has none yet.
  modes: {
    identify: { ...STEPS, misses: M.identify },
    build: { ...STEPS, misses: M.build },
    larger_denominators: { ...STEPS, misses: M.larger_denominators },
    // No lever is built for compare yet (QUEUE 8.1g residual: /add-support-tiers).
    compare: { ...TAP_ONE, moves: 'picks <, = or > between the two fractions, then presses Check Answer',
      misses: M.compare, unanswered: M.compare },
    add_subtract: { ...STEPS, misses: M.add_subtract },
    build_equal: { ...CHECKED, answer: 'build',
      moves: "picks how many equal parts to split the bar into, may cut one part in half, taps parts to shade them, then presses I'm done",
      misses: M.build_equal },
  },
  words: {
    job: 'show fractions on a bar cut into equal parts: name the numerator and the denominator of a printed fraction and '
      + 'shade it, pick <, = or > between two shaded bars, or make an equal fraction their own way',
    answer: 'the number they pick, the parts they shade, the sign they pick or the bar they make',
    question: 'the instruction and every fraction printed on screen',
  },
  levers: true,
});
