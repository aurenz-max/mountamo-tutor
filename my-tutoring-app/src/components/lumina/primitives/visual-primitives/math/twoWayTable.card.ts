/**
 * two-way-table's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `twoWayTable.boss.ts`.
 * Every mode asks for one probability read from the table: the learner types it and presses Check, and the activity
 * checks it within the item's tolerance. One item at a time, typed, activity-judged: a bespoke boss.
 */
import type { TwoWayTableChallengeType } from './TwoWayTable';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`twoWayMiss`, `TeachingAttempt.miss`, handoff 20), from the number typed, drawn from the
 * old catalog's commonStruggles (joint and marginal confused, a conditional divided by everyone, independence misread):
 * - joint: `row_denominator` / `column_denominator` the cell out of its own row or column (a conditional);
 *   `marginal_instead` the whole row or column out of everyone; `wrong_cell` another cell out of everyone;
 * - marginal: `one_cell` one cell of the row or column out of everyone (not added up); `other_marginal` another row's
 *   or column's total out of everyone;
 * - conditional: `joint_instead` the cell out of everyone; `reversed_condition` the cell out of the other axis's total
 *   (the condition swapped); `marginal_instead` a row or column total out of everyone; `wrong_cell` another cell of the
 *   given group out of the group;
 * - independence: `observed_joint` the cell out of everyone (what was observed, not expected); `one_factor` P(A) or
 *   P(B) alone; `added_factors` P(A) + P(B);
 * - every mode: `typed_count` a count from the table typed as the answer; `near_miss` within 0.05; else `too_high` /
 *   `too_low`.
 */
export type TwoWayMiss = 'row_denominator' | 'column_denominator' | 'marginal_instead' | 'wrong_cell' | 'one_cell'
  | 'other_marginal' | 'joint_instead' | 'reversed_condition' | 'observed_joint' | 'one_factor' | 'added_factors'
  | 'typed_count' | 'near_miss' | 'too_high' | 'too_low';

const SIZE: readonly TwoWayMiss[] = ['typed_count', 'near_miss', 'too_high', 'too_low'];
export const TWO_WAY_MISSES_BY_MODE: Record<TwoWayTableChallengeType, readonly TwoWayMiss[]> = {
  joint_probability: ['row_denominator', 'column_denominator', 'marginal_instead', 'wrong_cell', ...SIZE],
  marginal_distribution: ['one_cell', 'other_marginal', ...SIZE],
  conditional_probability: ['joint_instead', 'reversed_condition', 'marginal_instead', 'wrong_cell', ...SIZE],
  independence_test: ['observed_joint', 'one_factor', 'added_factors', ...SIZE],
};

const TYPED = { answer: 'type', judge: 'activity', flow: 'one-at-a-time',
  moves: 'types a probability in the answer box (a decimal from 0 to 1, or a percent with %), then presses Check Answer' } as const;

export const twoWayTableCard = defineCard<TwoWayMiss>({
  id: 'two-way-table',
  grades: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  // Every mode publishes levers (`twoWayTableLevers.ts`); every miss is answered by a help lever on every item.
  modes: {
    joint_probability: { ...TYPED, misses: TWO_WAY_MISSES_BY_MODE.joint_probability },
    marginal_distribution: { ...TYPED, misses: TWO_WAY_MISSES_BY_MODE.marginal_distribution },
    conditional_probability: { ...TYPED, misses: TWO_WAY_MISSES_BY_MODE.conditional_probability },
    independence_test: { ...TYPED, misses: TWO_WAY_MISSES_BY_MODE.independence_test },
  },
  words: {
    job: 'find a probability from the counts in a two-way table: one cell, a whole row or column, one cell within a '
      + 'given group, or the joint probability expected if the two categories were independent',
    answer: 'the probability they type',
    question: 'the scenario, the question, the category names and every count the table draws',
  },
  levers: true,
});
