/**
 * Item spaces for money (1.MD money foundations in many state standards, 2.MD.8, 3-4 making change).
 *
 * coin-sets — the task is finding the value of a set of coins. Items are every set of pennies, nickels,
 * dimes and quarters with at most ten coins and a total under one dollar. A lesson's scope is the coins
 * its grade uses (K: pennies, nickels, dimes) and whether a set is one kind of coin (count like coins) or
 * several (count mixed coins); the consumer passes it as `accept`. What makes a set harder to count:
 *   - types: each extra kind of coin is one more change of skip-count (10, 20, 25, 26, 27);
 *   - nickel and dimeNickel: counting by fives, and switching from tens to fives;
 *   - quarter: counting on from 25 (25, 35, 45; 50, 75), the step children lose most often;
 *   - extraCoins: each coin past four is one more to keep track of.
 * Which coins of a kind, or the order they lie in, is incidental. The near mistakes are the ones in the
 * coin-counting literature: every coin counted as one, every coin counted at the value of the first
 * (or largest) coin, one kind of coin left out, one coin miscounted.
 *
 * make-change — how much change a buyer gets: something costs `cost` cents and is paid for with one
 * quarter, one half-dollar or one dollar (a real coin or bill; "a 75-cent coin" does not exist).
 * Harder: a borrow in the subtraction (50 − 27), a borrow across the zeros of 100 (100 − 57), a price
 * off the five-cent grid (count up by pennies), paying with a dollar. Near mistakes: regrouped without
 * taking the ten away (50 − 27 = 33), smaller digit taken from the larger (50 − 27 = 37), ten off, the
 * price itself given as the change.
 *
 * Betas are logits for a typical grade-2 learner taught counting coins and counting up to make change.
 * The weights are priors from those error patterns, not fitted; refit from attempts' `first_try`.
 */
import type { ItemSpace } from './types';
import { linearBeta, pickSpread } from './spread';

export type CoinKind = 'quarter' | 'dime' | 'nickel' | 'penny';
export const COIN_CENTS: Record<CoinKind, number> = { quarter: 25, dime: 10, nickel: 5, penny: 1 };
const KINDS: CoinKind[] = ['quarter', 'dime', 'nickel', 'penny'];

// ── coin-sets ─────────────────────────────────────────────────────────────────────────────────────

export interface CoinSetFeatures { types: number; nickel: number; dimeNickel: number; quarter: number; extraCoins: number }
export interface CoinSetItem {
  /** Count of each coin, largest first. */
  coins: Record<CoinKind, number>;
  total: number;
  features: CoinSetFeatures;
  beta: number;
  structure: string;
}

export const COIN_SET_WEIGHTS: Record<keyof CoinSetFeatures | 'base', number> = {
  base: -1.5, types: 0.6, nickel: 0.3, dimeNickel: 0.3, quarter: 0.8, extraCoins: 0.15,
};

export const coinCount = (c: Record<CoinKind, number>): number => KINDS.reduce((s, k) => s + c[k], 0);
export const coinKindsIn = (c: Record<CoinKind, number>): CoinKind[] => KINDS.filter((k) => c[k] > 0);
const plural = (k: CoinKind, n: number) => (n === 1 ? k : k === 'penny' ? 'pennies' : `${k}s`);
/** "2 dimes and 3 pennies". */
export const coinSetText = (c: Record<CoinKind, number>): string => {
  const parts = coinKindsIn(c).map((k) => `${c[k]} ${plural(k, c[k])}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
};

export function coinSetFeatures(c: Record<CoinKind, number>): CoinSetFeatures {
  return {
    types: coinKindsIn(c).length - 1,
    nickel: c.nickel > 0 ? 1 : 0,
    dimeNickel: c.dime > 0 && c.nickel > 0 ? 1 : 0,
    quarter: c.quarter > 0 ? 1 : 0,
    extraCoins: Math.max(0, coinCount(c) - 4),
  };
}

let coinCache: CoinSetItem[] | null = null;
export const coinSetItems = (): CoinSetItem[] => (coinCache ??= (() => {
  const out: CoinSetItem[] = [];
  for (let q = 0; q <= 3; q++) for (let d = 0; d <= 9; d++) for (let n = 0; n <= 9; n++) for (let p = 0; p <= 9; p++) {
    const coins = { quarter: q, dime: d, nickel: n, penny: p };
    const count = q + d + n + p;
    const total = 25 * q + 10 * d + 5 * n + p;
    // Two coins at least (one coin is identifying it, not counting), ten at most (the tray), under a dollar.
    if (count < 2 || count > 10 || total >= 100) continue;
    const features = coinSetFeatures(coins);
    const kinds = coinKindsIn(coins).map((k) => k[0]).join('');
    out.push({ coins, total, features, beta: linearBeta(features, COIN_SET_WEIGHTS), structure: `${kinds}|${count > 4 ? '5+' : 'few'}` });
  }
  return out;
})());

/** Every coin in the set is in the lesson's coin pool. */
export const coinsWithin = (pool: readonly string[]) => (it: CoinSetItem) => coinKindsIn(it.coins).every((k) => pool.includes(k));

/** The fewest-coin set for an amount from a pool (greedy is exact for US coins). */
export function fewestCoins(amount: number, pool: readonly string[] = KINDS): Record<CoinKind, number> {
  const c = { quarter: 0, dime: 0, nickel: 0, penny: 0 };
  let left = amount;
  for (const k of KINDS) {
    if (!pool.includes(k)) continue;
    c[k] = Math.floor(left / COIN_CENTS[k]);
    left -= c[k] * COIN_CENTS[k];
  }
  return c;
}

/**
 * Three wrong totals. Near: every coin counted as one, every coin counted at the largest coin's value,
 * the smallest kind of coin left out, one coin of a kind miscounted. Far: twenty or more cents off.
 */
export function coinSetDistractors(it: CoinSetItem, rand: () => number = Math.random): { value: number; distance: 'near' | 'far' }[] {
  const kinds = coinKindsIn(it.coins);
  const ok = (v: number) => v >= 1 && v <= 120 && v !== it.total;
  const near = [coinCount(it.coins), COIN_CENTS[kinds[0]] * coinCount(it.coins)];
  if (kinds.length > 1) near.push(it.total - COIN_CENTS[kinds[kinds.length - 1]] * it.coins[kinds[kinds.length - 1]]);
  near.push(it.total + COIN_CENTS[kinds[Math.floor(rand() * kinds.length)]] * (rand() < 0.5 ? 1 : -1));
  const picked = Array.from(new Set(near.filter(ok))).sort(() => rand() - 0.5)
    .slice(0, it.beta < -0.6 ? 1 : 2).map((value): { value: number; distance: 'near' | 'far' } => ({ value, distance: 'near' }));
  for (const d of [20, -20, 30, -30, 40, 25, -25]) {
    if (picked.length === 3) break;
    const v = it.total + d;
    if (ok(v) && !picked.some((p) => p.value === v)) picked.push({ value: v, distance: 'far' });
  }
  return picked;
}

export const COIN_SETS: ItemSpace<CoinSetItem> = {
  id: 'coin-sets',
  describe: 'money: find the total value of a set of coins (pennies, nickels, dimes, quarters) in cents',
  grades: ['K', '1', '2', '3'],
  criterion: 'Find the value of a set of coins',
  wordingGrade: 'grade 2',
  pick: (n, lo, hi, rand, accept) => pickSpread(coinSetItems(), n, lo, hi, rand, accept, (it) => coinSetText(it.coins), (it) => String(it.total)),
  items: coinSetItems,
  solve: (it) => ({
    answer: `${it.total}¢`,
    shown: coinKindsIn(it.coins).map((k) => `${it.coins[k]} ${plural(k, it.coins[k])}`),
    spec: `someone has ${coinSetText(it.coins)}; the learner finds how many cents that is (${it.total}¢)`,
  }),
  distractors: (it, rand) => coinSetDistractors(it, rand).map((d) => ({ value: `${d.value}¢`, distance: d.distance })),
  plainQuestion: (it) => `Maya has ${coinSetText(it.coins)}. How many cents does Maya have?`,
};

// ── make-change ───────────────────────────────────────────────────────────────────────────────────

export interface ChangeFeatures { dollar: number; borrow: number; acrossZero: number; oddCents: number; smallChange: number }
export interface ChangeItem { paid: 25 | 50 | 100; cost: number; features: ChangeFeatures; beta: number; structure: string }

export const CHANGE_WEIGHTS: Record<keyof ChangeFeatures | 'base', number> = {
  base: -1.3, dollar: 0.5, borrow: 0.8, acrossZero: 0.5, oddCents: 0.4, smallChange: -0.3,
};

/**
 * What the buyer pays with, by name: a quarter, a half-dollar (or two quarters below grade 2), three
 * quarters, a dollar. Null for an amount no coin, bill or handful of quarters makes ("a 75-cent coin").
 */
export const paidWithOrNull = (paid: number, halfDollar = true): string | null =>
  paid === 25 ? 'a quarter' : paid === 50 ? (halfDollar ? 'a half-dollar' : 'two quarters')
    : paid === 75 ? 'three quarters' : paid === 100 ? 'a dollar' : null;
export const paidWith = (paid: number, halfDollar = true): string => paidWithOrNull(paid, halfDollar) ?? `${paid}¢`;

export function changeFeatures(paid: number, cost: number): ChangeFeatures {
  const borrow = paid % 10 < cost % 10 ? 1 : 0;
  return {
    dollar: paid === 100 ? 1 : 0,
    borrow,
    acrossZero: paid === 100 && cost % 10 !== 0 ? 1 : 0,
    oddCents: cost % 5 !== 0 ? 1 : 0,
    smallChange: paid - cost <= 10 ? 1 : 0,
  };
}

let changeCache: ChangeItem[] | null = null;
export const changeItems = (): ChangeItem[] => (changeCache ??= ([25, 50, 100] as const).flatMap((paid) =>
  // A price of at least 5 cents, and change of at least 1 cent.
  Array.from({ length: paid - 5 }, (_, i) => i + 5).map((cost) => {
    const features = changeFeatures(paid, cost);
    const structure = `${paid}|${features.borrow ? (features.acrossZero ? 'across-zero' : 'borrow') : 'no-borrow'}`
      + `|${features.oddCents ? 'pennies' : 'fives'}${features.smallChange ? '|small' : ''}`;
    return { paid, cost, features, beta: linearBeta(features, CHANGE_WEIGHTS), structure };
  })));

/**
 * Three wrong amounts of change. Near: regrouped without taking the ten away (50 − 27 = 33), the smaller
 * digit taken from the larger in each column (50 − 27 = 37), ten cents off, the price given back. Far:
 * a quarter off.
 */
export function changeDistractors(it: ChangeItem, rand: () => number = Math.random): { value: number; distance: 'near' | 'far' }[] {
  const answer = it.paid - it.cost;
  const ok = (v: number) => v >= 1 && v < it.paid && v !== answer;
  const pO = it.paid % 10;
  const cO = it.cost % 10;
  const pT = Math.floor(it.paid / 10);
  const cT = Math.floor(it.cost / 10);
  // The two column mistakes lead when the subtraction borrows: they are the strand's signature.
  const lead = it.features.borrow
    ? [(pT - cT) * 10 + (pO + 10 - cO), Math.abs(pT - cT) * 10 + Math.abs(pO - cO)].sort(() => rand() - 0.5) : [];
  const others = [answer + 10, answer - 10, it.cost].sort(() => rand() - 0.5);
  const picked = Array.from(new Set([...lead, ...others].filter(ok)))
    .slice(0, it.beta < -0.6 ? 1 : 2).map((value): { value: number; distance: 'near' | 'far' } => ({ value, distance: 'near' }));
  // Far: a quarter or more off; for a small purchase, the amounts farthest from the answer that are
  // still less than what was paid.
  const far = [25, -25, 30, -30, 20, -20, 15, -15];
  const fill = Array.from({ length: it.paid - 1 }, (_, i) => i + 1).sort((a, b) => Math.abs(b - answer) - Math.abs(a - answer));
  for (const v of [...far.map((d) => answer + d), ...fill]) {
    if (picked.length === 3) break;
    if (ok(v) && !picked.some((p) => p.value === v)) picked.push({ value: v, distance: 'far' });
  }
  return picked;
}

export const MAKE_CHANGE: ItemSpace<ChangeItem> = {
  id: 'make-change',
  describe: 'money: make change, how much change a buyer gets back after paying for something with a quarter, half-dollar or dollar',
  grades: ['1', '2', '3', '4'],
  criterion: 'Find the change from a purchase',
  wordingGrade: 'grade 2',
  pick: (n, lo, hi, rand, accept) => pickSpread(changeItems(), n, lo, hi, rand, accept, (it) => `${it.paid}-${it.cost}`, (it) => String(it.cost)),
  items: changeItems,
  solve: (it) => ({
    answer: `${it.paid - it.cost}¢`,
    shown: [`${it.cost}¢`, `${it.paid}¢`],
    spec: `something costs ${it.cost}¢ and the buyer pays with ${paidWith(it.paid)} (${it.paid}¢); the learner finds the change (${it.paid - it.cost}¢)`,
    operation: '-',
  }),
  distractors: (it, rand) => changeDistractors(it, rand).map((d) => ({ value: `${d.value}¢`, distance: d.distance })),
  plainQuestion: (it) => `A pencil costs ${it.cost}¢. Sam pays with ${paidWith(it.paid)} (${it.paid}¢). How much change does Sam get back?`,
};
