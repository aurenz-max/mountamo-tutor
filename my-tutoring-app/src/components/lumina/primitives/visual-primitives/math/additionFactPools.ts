/**
 * The addition fact families and their fact pools, from the source game "Pip's Number Adventure".
 * Pure: the generator builds sessions from it and the component builds a simplify lever's smaller fact.
 */
import type { AdditionFactStrategy } from './AdditionFactStrategies';

export const ADDITION_FACT_STRATEGIES: readonly AdditionFactStrategy[] = [
  'plus_zero', 'plus_one', 'doubles', 'turnaround', 'plus_two',
  'facts_3_4', 'facts_5_6', 'facts_7_8', 'facts_mixed',
];

export type Pair = [number, number];

const both = (pairs: Pair[]): Pair[] =>
  pairs.flatMap(([a, b]) => (a === b ? [[a, b] as Pair] : [[a, b] as Pair, [b, a] as Pair]));

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

const REMAIN: Pair[] = [
  [3, 4], [3, 5], [3, 6], [3, 7], [3, 8], [3, 9], [4, 5], [4, 6], [4, 7], [4, 8], [4, 9],
  [5, 6], [5, 7], [5, 8], [5, 9], [6, 7], [6, 8], [6, 9], [7, 8], [7, 9], [8, 9],
];

/** Largest sum any family reaches (9 + 9). */
export const MAX_FACT_SUM = 18;
/** A family needs this many facts under the sum ceiling to fill a session without repeats. */
const MIN_POOL = 4;

/** Every fact (oriented) a strategy may ask, with sums up to `maxSum` (the lesson's own window).
 *  Turnaround lists unordered pairs; orientation is picked per session. */
export function strategyPool(strategy: AdditionFactStrategy, maxSum = MAX_FACT_SUM): Pair[] {
  return familyPool(strategy).filter(([a, b]) => a + b <= maxSum);
}

/** Families that can fill a session when sums stop at `maxSum`. */
export const strategiesWithin = (strategies: readonly AdditionFactStrategy[], maxSum: number) =>
  strategies.filter((s) => strategyPool(s, maxSum).length >= MIN_POOL);

function familyPool(strategy: AdditionFactStrategy): Pair[] {
  switch (strategy) {
    case 'plus_zero': return both(range(1, 9).map((a) => [a, 0] as Pair));
    case 'plus_one': return both(range(1, 9).map((a) => [a, 1] as Pair));
    case 'doubles': return range(1, 9).map((n) => [n, n] as Pair);
    case 'turnaround': return REMAIN.concat([[1, 6], [2, 7], [0, 9], [1, 8], [2, 5]]);
    case 'plus_two': return both(range(2, 9).map((a) => [a, 2] as Pair));
    case 'facts_3_4': return both(REMAIN.filter(([a]) => a <= 4));
    case 'facts_5_6': return both(REMAIN.filter(([a]) => a === 5 || a === 6));
    case 'facts_7_8': return both(REMAIN.filter(([a]) => a >= 7));
    case 'facts_mixed': return both(REMAIN);
  }
}

