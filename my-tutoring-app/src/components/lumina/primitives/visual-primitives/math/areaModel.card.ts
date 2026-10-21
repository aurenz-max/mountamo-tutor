/**
 * area-model's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `areaModel.boss.ts`.
 * Every mode is typed and checked by the activity: a forward item (build_model, find_area, multiply) cell by cell and
 * then the sum, a perimeter as one number, a factor grid as its parts. One item at a time: a bespoke boss.
 */
import type { AreaModelChallengeType } from './AreaModel';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong entry shows (`areaMiss`, `TeachingAttempt.miss`, handoff 20), from the entry the check reads. Only the
 * observable pattern, drawn from the old catalog's commonStruggles (wrong partial product, place-value errors) and the
 * perimeter remediation (adding only two sides, area for perimeter):
 * - a cell: `added_not_multiplied` (the two parts added), `dropped_zeros` / `extra_zeros` (the product with a power of
 *   ten too few or too many), `one_group_off` (one column part or one row part away), `wrong_product`;
 * - the sum: `left_out_part` (the total less one cell), `carry_slip` (off by 10, 100 or 1000), `sum_off`;
 * - the perimeter: `gave_area` (length times width), `two_sides_only` (length plus width), `three_sides`,
 *   `perimeter_off`;
 * - the parts: `swapped` (the column parts typed as the row parts and back), `one_part_wrong`, `parts_wrong`.
 */
export type AreaModelMiss = 'added_not_multiplied' | 'dropped_zeros' | 'extra_zeros' | 'one_group_off' | 'wrong_product'
  | 'left_out_part' | 'carry_slip' | 'sum_off'
  | 'gave_area' | 'two_sides_only' | 'three_sides' | 'perimeter_off'
  | 'swapped' | 'one_part_wrong' | 'parts_wrong';

export const CELL_MISSES: readonly AreaModelMiss[] = ['added_not_multiplied', 'dropped_zeros', 'extra_zeros', 'one_group_off', 'wrong_product'];
export const SUM_MISSES: readonly AreaModelMiss[] = ['left_out_part', 'carry_slip', 'sum_off'];
export const PERIMETER_MISSES: readonly AreaModelMiss[] = ['gave_area', 'two_sides_only', 'three_sides', 'perimeter_off'];
export const FACTOR_MISSES: readonly AreaModelMiss[] = ['swapped', 'one_part_wrong', 'parts_wrong'];

/** A forward item's misses are a cell's or the sum's. */
export const AREA_MISSES_BY_MODE: Record<AreaModelChallengeType, readonly AreaModelMiss[]> = {
  build_model: [...CELL_MISSES, ...SUM_MISSES],
  find_area: [...CELL_MISSES, ...SUM_MISSES],
  multiply: [...CELL_MISSES, ...SUM_MISSES],
  perimeter: PERIMETER_MISSES,
  factor: FACTOR_MISSES,
};

const TYPED = { answer: 'type', judge: 'activity', flow: 'one-at-a-time' } as const;
const FORWARD = { ...TYPED, moves: 'taps a cell, types its product and presses Check, one cell at a time; once every cell '
  + 'is right, types the sum of the cell products and presses Submit Final Answer' } as const;

export const areaModelCard = defineCard<AreaModelMiss>({
  id: 'area-model',
  grades: ['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  // Every mode publishes levers (`areaModelLevers.ts`); every miss is answered by a lever in its mode.
  modes: {
    build_model: { ...FORWARD, misses: AREA_MISSES_BY_MODE.build_model },
    find_area: { ...FORWARD, misses: AREA_MISSES_BY_MODE.find_area },
    perimeter: { ...TYPED, moves: 'types the perimeter in the box, then presses Submit', misses: AREA_MISSES_BY_MODE.perimeter },
    multiply: { ...FORWARD, misses: AREA_MISSES_BY_MODE.multiply },
    factor: { ...TYPED, moves: 'types each column part along the top and each row part down the side, then presses Check '
      + 'My Factors', misses: AREA_MISSES_BY_MODE.factor },
  },
  words: {
    job: 'multiply with an area model: find each cell\'s product, its column part times its row part, then add the '
      + 'cells; or find the perimeter of a rectangle from its two sides; or find the column and row parts that make '
      + 'every cell of a filled grid',
    answer: 'each number they type (a cell product, the sum, the perimeter or a part)',
    question: 'the multiplication or the rectangle, the column and row parts and side lengths printed on the grid, and '
      + 'on factor the cell products and the total area',
  },
  levers: true,
});
