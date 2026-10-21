/**
 * matrix-display's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `matrixDisplay.boss.ts`.
 * Every mode asks for one matrix operation: the learner types the result in the answer grid (or the determinant in its
 * one box) and presses Check, and the activity checks every box itself. One item at a time, typed, activity-judged: a
 * bespoke boss.
 */
import type { MatrixChallengeType } from './MatrixDisplay';
import { defineCard } from '../../../components/live-activity/boss';

/** Catalog eval mode -> the challenge types it generates. */
export const MATRIX_MODE_TYPES: Record<string, readonly MatrixChallengeType[]> = {
  transpose: ['transpose'], add_subtract: ['add', 'subtract'], multiply: ['multiply'], determinant_inverse: ['determinant', 'inverse'],
};

/**
 * What a wrong check shows (`matrixMiss`, `TeachingAttempt.miss`, handoff 20), drawn from the old catalog's
 * commonStruggles (wrong determinant formula, multiplication order, inverse confusion, transpose dimensions) and the
 * typed grid:
 * - transpose: `reshaped` A's entries typed in reading order into the new shape, not swapped;
 * - add / subtract: `wrong_operation` the other operation done; `reversed_subtraction` B − A;
 * - multiply: `entrywise` matching entries multiplied; `reversed_order` B·A; `row_times_row` row of A times row of B;
 *   `missed_term` every box one product short (the last term of each sum dropped);
 * - determinant: `added_products` the products added (2×2 ad + bc; 3×3 every cofactor term added);
 *   `opposite_sign` the determinant's negative; `one_product` only ad or only bc typed; else `near_miss` (within 2),
 *   `too_high`, `too_low`;
 * - inverse: `no_negation` a and d swapped, b and c not negated; `no_swap` b and c negated, a and d not swapped;
 *   `unscaled` not divided by a determinant of −1; `original` A itself typed;
 * - any grid: `sign_error` every wrong box is the right number with the wrong sign; `one_entry` one box wrong;
 *   `some_entries` more than one.
 */
export type MatrixMiss = 'reshaped' | 'wrong_operation' | 'reversed_subtraction' | 'entrywise' | 'reversed_order'
  | 'row_times_row' | 'missed_term' | 'added_products' | 'opposite_sign' | 'one_product' | 'near_miss' | 'too_high'
  | 'too_low' | 'no_negation' | 'no_swap' | 'unscaled' | 'original' | 'sign_error' | 'one_entry' | 'some_entries';

const GRID: readonly MatrixMiss[] = ['sign_error', 'one_entry', 'some_entries'];
export const MATRIX_MISSES_BY_TYPE: Record<MatrixChallengeType, readonly MatrixMiss[]> = {
  transpose: ['reshaped', ...GRID],
  add: ['wrong_operation', ...GRID],
  subtract: ['wrong_operation', 'reversed_subtraction', ...GRID],
  multiply: ['entrywise', 'reversed_order', 'row_times_row', 'missed_term', ...GRID],
  determinant: ['added_products', 'opposite_sign', 'one_product', 'near_miss', 'too_high', 'too_low'],
  inverse: ['no_negation', 'no_swap', 'unscaled', 'original', ...GRID],
};
export const MATRIX_MISSES_BY_MODE: Record<string, readonly MatrixMiss[]> = Object.fromEntries(
  Object.entries(MATRIX_MODE_TYPES).map(([mode, types]) =>
    [mode, Array.from(new Set(types.flatMap(t => MATRIX_MISSES_BY_TYPE[t])))]));

const TYPED = { answer: 'type', judge: 'activity', flow: 'one-at-a-time' } as const;
const GRID_MOVES = 'types a number in every box of the answer grid, then presses Check Answer';

export const matrixDisplayCard = defineCard<MatrixMiss>({
  id: 'matrix-display',
  grades: ['Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  // Every mode publishes levers (`matrixDisplayLevers.ts`); every miss of an item's type is answered by a help lever.
  modes: {
    transpose: { ...TYPED, moves: GRID_MOVES, misses: MATRIX_MISSES_BY_MODE.transpose },
    add_subtract: { ...TYPED, moves: GRID_MOVES, misses: MATRIX_MISSES_BY_MODE.add_subtract },
    multiply: { ...TYPED, moves: GRID_MOVES, misses: MATRIX_MISSES_BY_MODE.multiply },
    determinant_inverse: { ...TYPED,
      moves: 'types the determinant in its one box, or a number in every box of the inverse grid, then presses Check Answer',
      misses: MATRIX_MISSES_BY_MODE.determinant_inverse },
  },
  words: {
    job: 'work one matrix operation entry by entry: a transpose, a sum or difference, a product, a determinant, or a '
      + 'two by two inverse',
    answer: 'every number they type in the answer boxes',
    question: 'the task, the operation and every entry of the matrices drawn on screen',
  },
  levers: true,
});
