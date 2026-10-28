/**
 * regrouping-workbench's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `regroupingWorkbench.boss.ts`.
 * Every mode asks for one sum or difference: the learner types one digit in each answer box and presses Check, and the
 * activity checks the number. The blocks are the learner's model and never gate the check; whether they reached the
 * answer is recorded beside it. One item at a time, typed,
 * activity-judged: a bespoke boss.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`regroupMiss`, `TeachingAttempt.miss`, handoff 20), from the typed digits, drawn from the
 * old catalog's commonStruggles (forgetting to carry or borrow, subtracting the smaller digit from the larger):
 * - `left_blank`: a box inside the answer's digits left empty;
 * - `wrong_operation`: the other operation's result (added on a take-away, or the other way round);
 * - `no_carry` (addition): every column's own sum without the carried one (27 + 45 written as 62);
 * - `smaller_from_larger` (subtraction): each column's smaller digit taken from its larger (52 − 17 written as 45);
 * - `forgot_to_reduce` (subtraction): ten given to the column, but the next column's top digit not made one less;
 * - `misplaced_digits`: the answer's digits in the wrong boxes;
 * - `column_slip`: one column's digit wrong, the rest right;
 * - `other_answer`: any other number.
 */
export type RegroupMiss = 'left_blank' | 'wrong_operation' | 'no_carry' | 'smaller_from_larger' | 'forgot_to_reduce'
  | 'misplaced_digits' | 'column_slip' | 'other_answer';

export type RegroupMode = 'add_no_regroup' | 'subtract_no_regroup' | 'add_regroup' | 'subtract_regroup';

export const REGROUP_MISSES_BY_MODE: Record<RegroupMode, readonly RegroupMiss[]> = {
  add_no_regroup: ['left_blank', 'wrong_operation', 'misplaced_digits', 'column_slip', 'other_answer'],
  subtract_no_regroup: ['left_blank', 'wrong_operation', 'misplaced_digits', 'column_slip', 'other_answer'],
  add_regroup: ['left_blank', 'wrong_operation', 'no_carry', 'misplaced_digits', 'column_slip', 'other_answer'],
  subtract_regroup: ['left_blank', 'wrong_operation', 'smaller_from_larger', 'forgot_to_reduce', 'misplaced_digits', 'column_slip', 'other_answer'],
};

const TYPED = { answer: 'type', judge: 'activity', flow: 'one-at-a-time',
  moves: 'types one digit in each answer box under the written problem, ones on the right, then presses Check Answer; '
    + 'first, on the blocks, Put together (addition) or Take away (subtraction) under each column and Carry or Borrow where '
    + 'a column needs a trade' } as const;

export const regroupingWorkbenchCard = defineCard<RegroupMiss>({
  id: 'regrouping-workbench',
  grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4'],
  // Every mode publishes levers (`regroupingWorkbenchLevers.ts`); every miss is answered by a help lever on every item.
  modes: {
    add_no_regroup: { ...TYPED, misses: REGROUP_MISSES_BY_MODE.add_no_regroup },
    subtract_no_regroup: { ...TYPED, misses: REGROUP_MISSES_BY_MODE.subtract_no_regroup },
    add_regroup: { ...TYPED, misses: REGROUP_MISSES_BY_MODE.add_regroup },
    subtract_regroup: { ...TYPED, misses: REGROUP_MISSES_BY_MODE.subtract_regroup },
  },
  words: {
    job: 'add or subtract two numbers in columns with base-ten blocks beside the written problem: the learner puts the '
      + 'two numbers\' blocks together or takes the second away, column by column; where a column makes '
      + 'ten or more, ten of a place are carried as one of the next; where a top digit is too small, one of the next '
      + 'place is broken into ten',
    answer: 'the number they type in the answer boxes',
    question: 'the problem, its two numbers and any story',
  },
  levers: true,
});
