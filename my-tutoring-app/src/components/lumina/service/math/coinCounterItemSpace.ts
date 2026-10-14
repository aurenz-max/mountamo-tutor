/**
 * coin-counter items from the money item spaces (service/itemSpace/money.ts, skill /add-item-space).
 *
 * Before (10-13 probe, grade 2): every tier ran the same ramp inside one session (make-amount 12¢, 26¢, 35¢,
 * 41¢, 58¢, 77¢ at easy and at hard), count-mixed opened 2 dimes + 3 pennies or 1 dime + 3 pennies in most
 * runs, and make-change repeated 25 − 15, 50 − 20, 100 − 60 and paid with "a 75-cent coin". With a tier,
 * code picks the sets and prices: count-like, count-mixed, make-amount and show-amount from coin-sets,
 * compare from pairs of coin sets, make-change from make-change. The tier still sets the value labels
 * and the running total, as before.
 *
 * What each mode can draw (contract, item-space clause): coins from the grade's pool (K: pennies, nickels,
 * dimes; grade 1 adds quarters) and totals up to the lesson's ceiling (K 20¢, grade 1 50¢, then 99¢, lower
 * when the objective says "within 20"). count-like is one kind of coin, count-mixed two or more.
 * make-amount and show-amount ask for the amount of a set that is already the fewest coins for it (so
 * its difficulty is the amount's), never a single coin's value. compare: easy pairs differ by 10¢ or
 * more and the group with more coins has more money; hard pairs differ by at most 10¢ and the group with
 * MORE coins has LESS money (the strand's main misconception); the answer side alternates. make-change
 * pays with a real coin or bill from the pool.
 */
import type { CoinCounterChallenge, CoinDef } from '../../primitives/visual-primitives/math/CoinCounter';
import { showAmountAsk } from '../../primitives/visual-primitives/math/coinCounterLevers';
import {
  COIN_CENTS, coinCount, coinKindsIn, coinSetItems, coinsWithin, fewestCoins, paidWith,
  type ChangeItem, type CoinKind, type CoinSetItem,
} from '../itemSpace/money';

type Pick<I> = (n: number, lo: number, hi: number, rand?: () => number, accept?: (item: I) => boolean) => I[];
export type CoinSpaceMode = 'count-like' | 'count-mixed' | 'compare' | 'make-amount' | 'show-amount' | 'make-change';
const tag = (space: string, it: { structure: string; beta: number }) => ({ itemSpace: { space, structure: it.structure, beta: it.beta } });

const defs = (it: CoinSetItem): CoinDef[] => coinKindsIn(it.coins).map((k) => ({ type: k, count: it.coins[k] }));
const isFewest = (it: CoinSetItem, pool: readonly string[]) => {
  const f = fewestCoins(it.total, pool);
  return (Object.keys(f) as CoinKind[]).every((k) => f[k] === it.coins[k]);
};
const singleCoinValue = (n: number, pool: readonly string[]) => pool.some((k) => (COIN_CENTS as Record<string, number>)[k] === n);

/** What a mode can draw from coin-sets, independent of the tier (tierPick's scope). */
export function coinSetScope(mode: CoinSpaceMode, pool: readonly string[], ceiling: number): (it: CoinSetItem) => boolean {
  const inPool = coinsWithin(pool);
  return (it) => {
    if (!inPool(it) || it.total > ceiling) return false;
    const kinds = coinKindsIn(it.coins).length;
    if (mode === 'count-like') return kinds === 1;
    if (mode === 'count-mixed') return kinds >= 2;
    if (mode === 'make-amount' || mode === 'show-amount') return isFewest(it, pool) && !singleCoinValue(it.total, pool);
    return true; // compare
  };
}

const COUNT_ASK = ['How much money is shown?', 'Count the coins. How many cents is that?', 'What is the total value of these coins?'];

export function countChallenges(opts: {
  pick: Pick<CoinSetItem>; band: [number, number]; count: number; scope: (it: CoinSetItem) => boolean; like: boolean;
  rand?: () => number;
}): CoinCounterChallenge[] {
  const items = opts.pick(opts.count, opts.band[0], opts.band[1], opts.rand, opts.scope);
  if (items.length < opts.count) return [];
  return items.map((it, i) => ({
    id: `c${i + 1}`, type: 'count', instruction: COUNT_ASK[i % COUNT_ASK.length],
    hint: coinKindsIn(it.coins).length > 1 ? 'Start with the coins worth the most, then count on.' : 'Skip count by the value of one coin.',
    displayedCoins: defs(it), correctTotal: it.total, countMode: opts.like ? 'like' : 'mixed', ...tag('coin-sets', it),
  }));
}

/** Things to buy, one per amount, from the wording call; code writes the ask around them. */
const thingFor = (things: string[], i: number) => things[i % Math.max(1, things.length)];

export function amountChallenges(opts: {
  pick: Pick<CoinSetItem>; band: [number, number]; count: number; scope: (it: CoinSetItem) => boolean;
  mode: 'make-amount' | 'show-amount'; pool: CoinCounterChallenge['availableCoins']; things: string[]; rand?: () => number;
}): CoinCounterChallenge[] {
  const items = opts.pick(opts.count, opts.band[0], opts.band[1], opts.rand, opts.scope);
  if (items.length < opts.count) return [];
  return items.map((it, i) => {
    const thing = thingFor(opts.things, i);
    return opts.mode === 'show-amount'
      ? {
        id: `s${i + 1}`, type: 'show-amount', instruction: showAmountAsk(it.total, thing),
        hint: 'Put in big coins first, then count on with smaller ones.', targetAmount: it.total, availableCoins: opts.pool,
        ...tag('coin-sets', it),
      }
      : {
        id: `c${i + 1}`, type: 'make-amount',
        instruction: thing ? `${thing[0].toUpperCase()}${thing.slice(1)} costs ${it.total}¢. Make ${it.total}¢ with coins.` : `Make ${it.total}¢ with coins.`,
        hint: 'Start with the biggest coin that fits, then add smaller ones.', targetAmount: it.total, availableCoins: opts.pool,
        ...tag('coin-sets', it),
      };
  });
}

const COMPARE_ASK = ['Which group has more money?', 'Count each group. Which one is worth more?', 'Which group of coins has more cents?'];

/**
 * Compare pairs: group A from the tier's band, its partner from the same scope by the tier's rule.
 * easy: 10¢ or more apart, the group with more coins has more money. medium: 5-15¢ apart. hard: at most
 * 10¢ apart and the group with more coins has less money.
 */
export function compareChallenges(opts: {
  pick: Pick<CoinSetItem>; band: [number, number]; count: number; scope: (it: CoinSetItem) => boolean;
  tier: 'easy' | 'medium' | 'hard'; rand?: () => number;
}): CoinCounterChallenge[] {
  const rand = opts.rand ?? Math.random;
  const pool = coinSetItems().filter(opts.scope);
  const partner = (a: CoinSetItem) => (b: CoinSetItem) => {
    const diff = Math.abs(a.total - b.total);
    const richer = a.total > b.total ? a : b;
    const poorer = richer === a ? b : a;
    if (opts.tier === 'easy') return diff >= 10 && coinCount(richer.coins) > coinCount(poorer.coins);
    if (opts.tier === 'medium') return diff >= 5 && diff <= 15;
    return diff >= 1 && diff <= 10 && coinCount(richer.coins) < coinCount(poorer.coins);
  };
  const firsts = opts.pick(opts.count * 3, opts.band[0], opts.band[1], rand, (a) => opts.scope(a) && pool.some(partner(a)));
  const out: CoinCounterChallenge[] = [];
  const used = new Set<number>();
  for (const a of firsts) {
    if (out.length === opts.count) break;
    const options = pool.filter((b) => partner(a)(b) && !used.has(b.total) && b.total !== a.total);
    if (!options.length || used.has(a.total)) continue;
    const b = options[Math.floor(rand() * options.length)];
    used.add(a.total); used.add(b.total);
    // Alternate the side that holds more money.
    const richerFirst = out.length % 2 === 0;
    const [ga, gb] = (a.total > b.total) === richerFirst ? [a, b] : [b, a];
    out.push({
      id: `c${out.length + 1}`, type: 'compare', instruction: COMPARE_ASK[out.length % COMPARE_ASK.length],
      hint: 'Count the value of each group, not the number of coins.', groupA: defs(ga), groupB: defs(gb),
      correctGroup: ga.total > gb.total ? 'A' : 'B',
      itemSpace: { space: 'coin-sets', structure: `compare-${opts.tier}|${a.structure}`, beta: a.beta },
    });
  }
  return out.length === opts.count ? out : [];
}

/** Payments the pool can make: a quarter; 50¢ as a half-dollar or two quarters; a dollar from grade 2. */
export const changePaidScope = (pool: readonly string[]) => (it: ChangeItem) =>
  pool.includes('quarter') && (it.paid !== 100 || pool.includes('dollar'));

export function changeChallenges(opts: {
  pick: Pick<ChangeItem>; band: [number, number]; count: number; pool: readonly string[]; things: string[]; rand?: () => number;
}): CoinCounterChallenge[] {
  const items = opts.pick(opts.count, opts.band[0], opts.band[1], opts.rand, changePaidScope(opts.pool));
  if (items.length < opts.count) return [];
  const halfDollar = opts.pool.includes('half-dollar');
  return items.map((it, i) => {
    const thing = thingFor(opts.things, i) ?? 'something';
    return {
      id: `c${i + 1}`, type: 'make-change',
      instruction: `You buy ${thing} for ${it.cost}¢ and pay with ${paidWith(it.paid, halfDollar)} (${it.paid}¢). How much change do you get back?`,
      hint: 'Count up from the price to what you paid.', paidAmount: it.paid, itemCost: it.cost, correctChange: it.paid - it.cost,
      ...tag('make-change', it),
    };
  });
}
