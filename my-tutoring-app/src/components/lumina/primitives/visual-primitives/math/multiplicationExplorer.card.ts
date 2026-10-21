/**
 * multiplication-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `multiplicationExplorer.boss.ts`.
 * Every mode asks for one number about one fact: the learner types it and presses Check, and the activity checks it.
 * One item at a time, typed, activity-judged: a bespoke boss.
 */
import type { MultiplicationExplorerChallenge } from './MultiplicationExplorer';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`multiplicationMiss`, `TeachingAttempt.miss`, handoff 20), from the typed number, drawn
 * from the old catalog's commonStruggles (groups confused with items per group, the distributive parts, missing-factor
 * confusion). Only the observable pattern:
 * - the product asked: `added_factors` (the two factors added), `one_part_only` (distributive: one of the two partial
 *   products on the break-apart), `one_group_short` / `one_group_over` (one group of either factor too few or too
 *   many), `off_by_one`, `other_product`;
 * - a factor asked: `gave_product` (the product typed back), `gave_known_factor` (the factor already shown),
 *   `subtracted` (the product less the known factor), `one_jump_off` (one more or less than the factor), `other_factor`.
 */
export type MultiplicationMiss = 'added_factors' | 'one_part_only' | 'one_group_short' | 'one_group_over' | 'off_by_one'
  | 'other_product' | 'gave_product' | 'gave_known_factor' | 'subtracted' | 'one_jump_off' | 'other_factor';

export const PRODUCT_MISSES: readonly MultiplicationMiss[] = ['added_factors', 'one_group_short', 'one_group_over', 'off_by_one', 'other_product'];
export const DISTRIBUTIVE_MISSES: readonly MultiplicationMiss[] = ['added_factors', 'one_part_only', 'one_group_short',
  'one_group_over', 'off_by_one', 'other_product'];
export const FACTOR_MISSES: readonly MultiplicationMiss[] = ['gave_product', 'gave_known_factor', 'subtracted', 'one_jump_off', 'other_factor'];

export const MULTIPLICATION_MISSES_BY_MODE: Record<MultiplicationExplorerChallenge['type'], readonly MultiplicationMiss[]> = {
  build: PRODUCT_MISSES,
  connect: PRODUCT_MISSES,
  commutative: PRODUCT_MISSES,
  distributive: DISTRIBUTIVE_MISSES,
  missing_factor: FACTOR_MISSES,
  fluency: PRODUCT_MISSES,
};

const TYPED = { answer: 'type', judge: 'activity', flow: 'one-at-a-time',
  moves: 'types one number in the answer box, then presses Check' } as const;

export const multiplicationExplorerCard = defineCard<MultiplicationMiss>({
  id: 'multiplication-explorer',
  grades: ['Grade 2', 'Grade 3', 'Grade 4'],
  // Every mode publishes levers (`multiplicationExplorerLevers.ts`); every miss is answered by a help lever on every item.
  modes: {
    build: { ...TYPED, misses: MULTIPLICATION_MISSES_BY_MODE.build },
    connect: { ...TYPED, misses: MULTIPLICATION_MISSES_BY_MODE.connect },
    commutative: { ...TYPED, misses: MULTIPLICATION_MISSES_BY_MODE.commutative },
    distributive: { ...TYPED, misses: MULTIPLICATION_MISSES_BY_MODE.distributive },
    missing_factor: { ...TYPED, misses: MULTIPLICATION_MISSES_BY_MODE.missing_factor },
    fluency: { ...TYPED, misses: MULTIPLICATION_MISSES_BY_MODE.fluency },
  },
  words: {
    job: 'find the product of one multiplication fact, read from a picture of it (equal groups, an array, repeated '
      + 'addition, a number line or an area model), across the turnaround, by breaking it into two easier facts or '
      + 'recalled bare; or find the missing factor when the product is given',
    answer: 'the number they type (the product, or on missing factor the missing factor)',
    question: 'the ask, the equation with its question mark, the factors printed on screen and what the picture draws',
  },
  levers: true,
});
