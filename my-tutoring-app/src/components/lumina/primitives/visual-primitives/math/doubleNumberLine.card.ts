/**
 * double-number-line's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `doubleNumberLine.boss.ts`.
 * Every mode asks for the bottom-line value that matches a marked top value: the learner types it (or steps it with
 * - and +) and presses Check, and the activity checks it within 0.1. One item at a time, typed, activity-judged: a
 * bespoke boss.
 */
import type { DoubleNumberLineChallengeType } from './DoubleNumberLine';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`ratioLineMiss`, `TeachingAttempt.miss`, handoff 20), from the first target typed wrong,
 * drawn from the old catalog's commonStruggles (adding instead of multiplying, not finding the unit rate, scaling
 * errors):
 * - `gave_top`: the top value typed back as the bottom one;
 * - `stopped_at_rate`: the unit rate typed, not scaled to the asked top value;
 * - `gave_given`: the given pair's bottom value copied;
 * - `inverted_rate` (a find-the-rate item): top divided by bottom; `multiplied_not_divided`: the given pair's two
 *   values multiplied; `subtracted`: the given pair's top taken from its bottom;
 * - `added_rate`: the top value plus the rate (added once, not multiplied);
 * - `added_difference`: the given pair's difference carried over (bottom + the change in top), additive thinking;
 * - `one_unit_off`: one rate too many or too few (a skip-count slip);
 * - `too_high` / `too_low`: any other number.
 */
export type DoubleNumberLineMiss = 'gave_top' | 'stopped_at_rate' | 'gave_given' | 'inverted_rate' | 'multiplied_not_divided'
  | 'subtracted' | 'added_rate' | 'added_difference' | 'one_unit_off' | 'too_high' | 'too_low';

export const RATIO_LINE_MISSES_BY_MODE: Record<DoubleNumberLineChallengeType, readonly DoubleNumberLineMiss[]> = {
  equivalent_ratios: ['gave_top', 'stopped_at_rate', 'added_rate', 'one_unit_off', 'too_high', 'too_low'],
  find_missing: ['gave_top', 'stopped_at_rate', 'gave_given', 'added_rate', 'added_difference', 'one_unit_off', 'too_high', 'too_low'],
  unit_rate: ['gave_top', 'stopped_at_rate', 'gave_given', 'inverted_rate', 'multiplied_not_divided', 'subtracted', 'added_rate',
    'added_difference', 'one_unit_off', 'too_high', 'too_low'],
};

const TYPED = { answer: 'type', judge: 'activity', flow: 'one-at-a-time',
  moves: 'types the bottom-line value in the box under the marked top value (or steps it with - and +), then presses '
    + 'Check Answer' } as const;

export const doubleNumberLineCard = defineCard<DoubleNumberLineMiss>({
  id: 'double-number-line',
  grades: ['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  // Every mode publishes levers (`doubleNumberLineLevers.ts`); every miss is answered by a help lever on every item.
  modes: {
    equivalent_ratios: { ...TYPED, misses: RATIO_LINE_MISSES_BY_MODE.equivalent_ratios },
    find_missing: { ...TYPED, misses: RATIO_LINE_MISSES_BY_MODE.find_missing },
    unit_rate: { ...TYPED, misses: RATIO_LINE_MISSES_BY_MODE.unit_rate },
  },
  words: {
    job: 'find the bottom-line value that matches a marked top value on a double number line, where both lines grow by '
      + 'multiplying: scale a given unit rate, find a missing value from a given pair, or find the unit rate itself',
    answer: 'the bottom-line value they type',
    question: 'the question, the two line labels, the given pair and the marked top value',
  },
  levers: true,
});
