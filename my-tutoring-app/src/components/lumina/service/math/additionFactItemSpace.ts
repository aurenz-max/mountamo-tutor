/**
 * addition-fact-strategies facts by tier, from the add-sub-20 item space (skill /add-item-space).
 *
 * The facts were already chosen in code from each family's pool, but at random: every tier of
 * big_facts drew the same mix (5 + 3 beside 9 + 8 at easy and at hard, 10-14 probe), so
 * `config.difficulty` moved only the levers. Each family's facts now rank by the add-sub-20 space's
 * predicted beta (a sum with the result unknown: crossing ten, the anchor (+1, +2/+3, double), sums
 * over ten, the smaller addend's size) and each tier draws from its window of that ranking
 * (`tierWindow`): easy the low end, hard the high end. A family holds 6 to 42 facts, too few for
 * `tierPick`'s three bands of eight, so the window is the whole mechanism here.
 *
 * On this path: the families whose facts differ in structure, not only in size: facts_mixed (big_facts),
 * turnaround and facts_3_4 hold sums that stay inside ten and sums that cross it (3 + 4 at -1.66 beside
 * 8 + 9 at 0.34). Not on it, so the full pool is kept:
 *   - plus_zero: n + 0 is not in the space (it tests the rule for zero, not this strand).
 *   - plus_one, plus_two, doubles, facts_5_6, facts_7_8: one structure each (every 5s/6s fact crosses
 *     ten; every +1 fact is counting on one). Their betas differ by the addend's size alone, at most
 *     0.1 logit, so a tier would be a window of sums: magnitude, not difficulty (principle 3).
 *   - A family whose pool under the lesson's sum window is shorter than two sessions.
 */
import type { AdditionFactStrategy } from '../../primitives/visual-primitives/math/AdditionFactStrategies';
import { strategyPool, type Pair } from '../../primitives/visual-primitives/math/additionFactPools';
import { addSub20Items, type AddSub20Item } from '../itemSpace/addSub20';
import { tierWindow } from '../itemSpace';

export interface FactItemSpaceStamp { space: 'add-sub-20'; structure: string; beta: number }

/** The add-sub-20 item for a + b with the sum unknown, or null when the space has none (a zero). */
export function factItem(a: number, b: number): AddSub20Item | null {
  return addSub20Items().find((it) => it.steps.length === 1 && it.unknown === 'result'
    && it.steps[0].op === '+' && it.steps[0].a === a && it.steps[0].b === b) ?? null;
}

/**
 * Below this gap between the mean beta of the hard and easy windows a family is one structure (1 + 1,
 * a double, is the only plus_one fact apart from the rest), and its tiers would differ only in size.
 */
const MIN_GAP = 0.5;

/**
 * The family's facts a tier draws from, ranked by predicted beta. Null when the family is not on the
 * item-space path (see the header), so the caller keeps the full pool.
 */
export function tierFactPool(
  strategy: AdditionFactStrategy, maxSum: number, tier: 'easy' | 'medium' | 'hard', sessionSize: number,
): Pair[] | null {
  // plus_zero is one structure; near_doubles' tier is the order of the session (buildNearDoublesSession), not the facts.
  if (strategy === 'plus_zero' || strategy === 'near_doubles') return null;
  const pool = strategyPool(strategy, maxSum);
  // A fact with a zero (turnaround's 0 + 9) is not in the space; it ranks easiest.
  const ranked = pool.map((p) => ({ p, beta: factItem(p[0], p[1])?.beta ?? -Infinity }));
  if (pool.length < 2 * sessionSize) return null;
  ranked.sort((x, y) => x.beta - y.beta || (x.p[0] + x.p[1]) - (y.p[0] + y.p[1]));
  const mean = (t: 'easy' | 'hard') => {
    const w = tierWindow(ranked, t, sessionSize).filter((r) => Number.isFinite(r.beta));
    return w.reduce((s, r) => s + r.beta, 0) / Math.max(1, w.length);
  };
  if (mean('hard') - mean('easy') < MIN_GAP) return null;
  return tierWindow(ranked.map((r) => r.p), tier, sessionSize);
}

/** The calibration stamp for a fact (never rendered, never sent to the tutor). */
export function factStamp(a: number, b: number): FactItemSpaceStamp | null {
  const it = factItem(a, b);
  return it ? { space: 'add-sub-20', structure: it.structure, beta: Math.round(it.beta * 100) / 100 } : null;
}
