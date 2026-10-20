/**
 * skip-counting-runner's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `skipCounting.boss.ts`.
 * Count along is taps on the line, each checked as it lands (a right tap makes the jump), so it is one tap at a time.
 * Predict, find the skip value and multiplication ask for one number: the learner says it (the tutor judges the words
 * against the key) or types it and presses Check (the activity checks it), so they are SAY_OR_SHOW. Fill missing is
 * SAY_OR_SHOW per item: an item with one "?" has a key; an item with two or more is typed one gap at a time and has none.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a wrong check or a wrong spoken number shows (`TeachingAttempt.miss`, handoff 20), from the work the check
 * reads (`skipMiss`) and, for spoken answers, `skipSpokenMisses`, with the same ids:
 * - count_along: `skipped_a_landing` (tapped two jumps ahead), `jumped_far` (three or more);
 * - predict: `stayed_put` (the number it is on), `added_one` (counted on by one), `two_jumps`, `wrong_way` (the
 *   landing before), `near_miss` (within 2 of the landing: an adding slip), `off_count`;
 * - fill_missing: `not_a_gap` (a number of the count that is not hidden), `already_filled`, `near_miss`, `off_count`;
 * - find_skip_value: `twice_the_step`, `half_the_step`, `typed_a_landing` (a number on the line), `one_short`,
 *   `one_over`, `short_by_more`, `over_by_more`;
 * - connect_multiplication: `typed_product` (the number reached), `typed_skip` (the jump size), `counted_start`
 *   (one more: the start counted as a jump), `one_short`, `short_by_more`, `over_by_more`.
 */
export type SkipCountingMiss = 'skipped_a_landing' | 'jumped_far'
  | 'stayed_put' | 'added_one' | 'two_jumps' | 'wrong_way' | 'near_miss' | 'off_count'
  | 'not_a_gap' | 'already_filled'
  | 'twice_the_step' | 'half_the_step' | 'typed_a_landing' | 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more'
  | 'typed_product' | 'typed_skip' | 'counted_start';

/** Each mode's misses, by the runner's check and the spoken-miss observer alike. */
export const SKIP_MISSES = {
  count_along: ['skipped_a_landing', 'jumped_far'],
  predict: ['stayed_put', 'added_one', 'two_jumps', 'wrong_way', 'near_miss', 'off_count'],
  fill_missing: ['not_a_gap', 'already_filled', 'near_miss', 'off_count'],
  find_skip_value: ['twice_the_step', 'half_the_step', 'typed_a_landing', 'one_short', 'one_over', 'short_by_more', 'over_by_more'],
  connect_multiplication: ['typed_product', 'typed_skip', 'counted_start', 'one_short', 'short_by_more', 'over_by_more'],
} as const satisfies Record<string, readonly SkipCountingMiss[]>;

export type SkipMode = keyof typeof SKIP_MISSES;

const TYPED = 'may instead type the number in the box, then press Check';

export const skipCountingCard = defineCard<SkipCountingMiss>({
  id: 'skip-counting-runner',
  grades: ['Grade 1', 'Grade 2', 'Grade 3'],
  modes: {
    count_along: { ...TAP_ONE, moves: 'taps the number where the character lands next, one jump at a time, then presses '
      + 'Check at the end; a tap further on is a miss', misses: SKIP_MISSES.count_along },
    predict: { ...SAY_OR_SHOW, moves: TYPED, misses: SKIP_MISSES.predict },
    fill_missing: { ...SAY_OR_SHOW, moves: 'types each missing number and presses Check, one at a time; on an item with '
      + 'one "?" may say the number instead', misses: SKIP_MISSES.fill_missing },
    find_skip_value: { ...SAY_OR_SHOW, moves: TYPED, misses: SKIP_MISSES.find_skip_value },
    connect_multiplication: { ...SAY_OR_SHOW, moves: TYPED, misses: SKIP_MISSES.connect_multiplication },
  },
  words: {
    job: 'skip count along a number line: tap where the character lands next, or give the next landing, a hidden '
      + 'number, how far each jump goes, or how many jumps it made',
    answer: 'their number',
    question: 'the instruction and the numbers written on the line',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
