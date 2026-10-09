/**
 * The in-item levers on a coin-counter item (`/add-support-tiers`; reports qa/open-build/coin-counter-2026-10-07 and
 * qa/eval-reports/coin-counter-levers-2026-10-08.md). No real-learner evidence: the misses are what `coinMiss` observes
 * and the catalog's commonStruggles. Pure: the component draws from these, the workspace publishes them, the tests
 * hold each leak rule. Every easier item has the id `<item>~smaller`, the same mode, and is built by `practiceItem`.
 *
 * - every mode whose coins print values: `coin_values` (help) puts each coin's value back when the tier hid it.
 * - identify: the coin IS the answer, so the help never marks one: `size_row` (help) lines every option up by size on
 *   one shelf, whatever the asked coin; `two_coins` (simplify) asks for ANOTHER coin between two far-apart coins,
 *   neither of them the asked one.
 * - count, one kind of coin: `skip_strip` (help) a counting strip by that coin's value that runs past the total with
 *   nothing marked. More kinds: `sort_coins` (help) one row per kind. `fewer_coins` (simplify) fewer coins, same kinds.
 * - compare: `sort_coins` (help) in each group; `plainer_groups` (simplify) one coin against a few smaller ones.
 * - make-amount (and fewest-coins, which renders as make-amount), show-amount: `running_total`, `value_tags` (help),
 *   `smaller_amount` (simplify) about half the amount.
 * - make-change: `change_bar` (help) a bar for what was paid with the cost shaded and the rest marked "?", unlabelled
 *   ticks every 5¢; `round_change` (simplify) the same payment, a cost whose change is whole tens.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { CoinCounterChallenge, CoinDef, CoinType } from './CoinCounter';
import { COIN_CENTS, fewestCoins, type CoinMiss } from './coinCounterWorkspace';

export const COIN_VALUES_LEVER = 'coin_values';
export const SIZE_ROW_LEVER = 'size_row';
export const SKIP_STRIP_LEVER = 'skip_strip';
export const SORT_LEVER = 'sort_coins';
export const RUNNING_TOTAL_LEVER = 'running_total';
export const VALUE_TAGS_LEVER = 'value_tags';
export const CHANGE_BAR_LEVER = 'change_bar';
export const SMALLER_LEVER = 'smaller_amount';
export const TWO_COINS_LEVER = 'two_coins';
export const FEWER_COINS_LEVER = 'fewer_coins';
export const PLAINER_GROUPS_LEVER = 'plainer_groups';
export const ROUND_CHANGE_LEVER = 'round_change';

export const PRACTICE_SUFFIX = '~smaller';
export const isPractice = (c: Pick<CoinCounterChallenge, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);
export const PRACTICE_NOTE = 'An easier practice item, ungraded; the full item comes back after it.';

/** What the screen shows beyond the item: the tier's aids and the Kindergarten tap count. */
export interface CoinLeverView {
  /** Coin values printed on the coins (the tier's `showCoinValues`; never on identify). */
  valuesShown: boolean;
  /** The make-amount running total from the tier (`showRunningTotal`). */
  runningTotalShown: boolean;
  /** A Kindergarten count of like coins: the taps already build the skip count on screen. */
  enactedTap: boolean;
}
const PLAIN_VIEW: CoinLeverView = { valuesShown: true, runningTotalShown: false, enactedTap: false };

const cents = (n: number) => n >= 100 ? `$${Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}` : `${n}¢`;
const coinCount = (coins: readonly CoinDef[] = []) => coins.reduce((n, c) => n + c.count, 0);
const total = (coins: readonly CoinDef[] = []) => coins.reduce((s, c) => s + COIN_CENTS[c.type] * c.count, 0);
const kindsOf = (coins: readonly CoinDef[] = []) => Array.from(new Set(coins.filter(c => c.count > 0).map(c => c.type)));
const sameSet = (a: readonly CoinDef[] = [], b: readonly CoinDef[] = []) => {
  const key = (g: readonly CoinDef[]) => kindsOf(g).sort().map(t => `${t}:${g.filter(c => c.type === t).reduce((n, c) => n + c.count, 0)}`).join(',');
  return key(a) === key(b);
};
const practiceOf = (c: CoinCounterChallenge, fields: Partial<CoinCounterChallenge>): CoinCounterChallenge =>
  ({ ...c, id: `${c.id}${PRACTICE_SUFFIX}`, hint: undefined, ...fields });

// ── identify: the size row and the two-coin ask ────────────────────────────

/** How each coin is drawn (`COIN_DISPLAY` in CoinCounter.tsx): its metal and its width in px. */
const LOOK: Record<CoinType, { metal: 'copper' | 'silver' | 'gold'; size: number }> = {
  penny: { metal: 'copper', size: 40 }, nickel: { metal: 'silver', size: 44 }, dime: { metal: 'silver', size: 36 },
  quarter: { metal: 'silver', size: 48 }, 'half-dollar': { metal: 'silver', size: 56 }, dollar: { metal: 'gold', size: 56 },
};
const apart = (a: CoinType, b: CoinType) => (LOOK[a].metal !== LOOK[b].metal ? 100 : 0) + Math.abs(LOOK[a].size - LOOK[b].size);
const optionsOf = (c: CoinCounterChallenge): CoinType[] =>
  Array.from(new Set(c.options?.length ? c.options : ['penny', 'nickel', 'dime', 'quarter'] as CoinType[]));

/** The size row: indexes into the options, smallest coin first. It reads only the options, never the asked coin. */
export const sizeOrder = (options: readonly CoinType[]) =>
  options.map((_, i) => i).sort((i, j) => LOOK[options[i]].size - LOOK[options[j]].size || i - j);

/** Leak rule for an identify practice: it never asks for, or shows, the coin the learner is stuck on. */
export function twoCoinsLeaks(p: CoinCounterChallenge, c: CoinCounterChallenge): boolean {
  return p.id === c.id || p.type !== 'identify' || p.targetCoin === c.targetCoin || (p.options ?? []).length !== 2
    || (p.options ?? []).includes(c.targetCoin!) || !(p.options ?? []).includes(p.targetCoin!);
}

/** Two coins far apart in look, asking for the one that looks most like the item's coin; null with under 3 options. */
export function twoCoins(c: CoinCounterChallenge): CoinCounterChallenge | null {
  if (c.type !== 'identify' || !c.targetCoin || isPractice(c)) return null;
  const target = c.targetCoin, others = optionsOf(c).filter(o => o !== target);
  if (others.length < 2) return null;
  const asked = [...others].sort((a, b) => apart(a, target) - apart(b, target))[0];
  const foil = others.filter(o => o !== asked).sort((a, b) => apart(b, asked) - apart(a, asked))[0];
  const options = [asked, foil].sort((a, b) => LOOK[a].size - LOOK[b].size);
  const name = asked === 'half-dollar' ? 'half-dollar' : asked;
  const p = practiceOf(c, { targetCoin: asked, options, coins: options.map(type => ({ type, count: 1 })),
    instruction: `Which coin is the ${name}?` });
  return twoCoinsLeaks(p, c) ? null : p;
}

// ── count: the counting strip, the sorted rows, fewer coins ────────────────

/** A strip counting by one coin's value, from that value, at least three steps past the total. Null on mixed coins. */
export function skipStrip(c: CoinCounterChallenge): number[] | null {
  const coins = c.displayedCoins ?? [], kinds = kindsOf(coins);
  // One coin: its strip's first step would be the total (contract G4).
  if (c.type !== 'count' || kinds.length !== 1 || coinCount(coins) < 2) return null;
  const v = COIN_CENTS[kinds[0]], steps = Math.max(8, coinCount(coins) + 3);
  return Array.from({ length: steps }, (_, i) => v * (i + 1));
}

/** Leak rule: the strip never ends at the total (it runs past it) and holds only steps of one coin's value. */
export function stripLeaks(strip: readonly number[], c: CoinCounterChallenge): boolean {
  const t = total(c.displayedCoins), v = strip[0];
  return strip.at(-1)! <= t || strip.some((n, i) => n !== v * (i + 1));
}

/** The coins as one row per kind: most valuable first when values are on screen, else in the order first drawn
 *  (sorting by worth with values hidden would tell the learner which coin is worth more). */
export function sortedRows(coins: readonly CoinDef[], valuesOnScreen: boolean): CoinDef[] {
  const rows = kindsOf(coins).map(type => ({ type, count: coins.filter(c => c.type === type).reduce((n, c) => n + c.count, 0) }));
  return valuesOnScreen ? rows.sort((a, b) => COIN_CENTS[b.type] - COIN_CENTS[a.type]) : rows;
}

/** Leak rule for an easier count: never the item's coins, its total, or half its total (doubling would give it). */
export function fewerLeaks(p: CoinCounterChallenge, c: CoinCounterChallenge): boolean {
  const pt = total(p.displayedCoins), ct = total(c.displayedCoins);
  return p.id === c.id || p.type !== 'count' || p.countMode !== c.countMode || sameSet(p.displayedCoins, c.displayedCoins)
    || pt !== p.correctTotal || pt === ct || pt * 2 === ct || coinCount(p.displayedCoins) >= coinCount(c.displayedCoins)
    || (kindsOf(c.displayedCoins).length > 1 && kindsOf(p.displayedCoins).length < 2);
}

/** Fewer coins of the same kinds (the most and least valuable when there are more than two); null on two coins. */
export function fewerCoins(c: CoinCounterChallenge): CoinCounterChallenge | null {
  if (c.type !== 'count' || isPractice(c)) return null;
  const coins = c.displayedCoins ?? [], n = coinCount(coins), kinds = kindsOf(coins);
  if (n <= 2 || !kinds.length) return null;
  const countOf = (t: CoinType) => coins.filter(x => x.type === t).reduce((s, x) => s + x.count, 0);
  const aim = Math.max(2, Math.ceil(n / 2));
  const sets: CoinDef[][] = [];
  if (kinds.length === 1) {
    for (let k = 2; k < n; k++) sets.push([{ type: kinds[0], count: k }]);
  } else {
    const byValue = [...kinds].sort((a, b) => COIN_CENTS[b] - COIN_CENTS[a]);
    const hi = byValue[0], lo = byValue.at(-1)!;
    for (let a = 1; a <= countOf(hi); a++) for (let b = 1; b <= countOf(lo); b++) {
      if (a + b < n) sets.push([{ type: hi, count: a }, { type: lo, count: b }]);
    }
  }
  sets.sort((x, y) => Math.abs(coinCount(x) - aim) - Math.abs(coinCount(y) - aim) || coinCount(x) - coinCount(y));
  for (const displayedCoins of sets) {
    const p = practiceOf(c, { displayedCoins, correctTotal: total(displayedCoins), instruction: 'How much money is shown here?' });
    if (!fewerLeaks(p, c)) return p;
  }
  return null;
}

// ── compare: one coin against a few ────────────────────────────────────────

const winner = (a: readonly CoinDef[], b: readonly CoinDef[]): 'A' | 'B' | 'equal' =>
  total(a) === total(b) ? 'equal' : total(a) > total(b) ? 'A' : 'B';

/** Leak rule for an easier compare: never the item's groups (either way round), and always a winner. */
export function plainerLeaks(p: CoinCounterChallenge, c: CoinCounterChallenge): boolean {
  const same = (sameSet(p.groupA, c.groupA) && sameSet(p.groupB, c.groupB)) || (sameSet(p.groupA, c.groupB) && sameSet(p.groupB, c.groupA));
  return p.id === c.id || p.type !== 'compare' || same || p.correctGroup !== winner(p.groupA ?? [], p.groupB ?? [])
    || p.correctGroup === 'equal' || coinCount([...(p.groupA ?? []), ...(p.groupB ?? [])]) >= coinCount([...(c.groupA ?? []), ...(c.groupB ?? [])]);
}

/** From the item's coin kinds: one big coin against two or three small ones worth less; else one coin against one
 *  (a smaller coin worth more first). Null on an item of two coins. */
export function plainerGroups(c: CoinCounterChallenge): CoinCounterChallenge | null {
  if (c.type !== 'compare' || isPractice(c)) return null;
  const all = [...(c.groupA ?? []), ...(c.groupB ?? [])], n = coinCount(all);
  if (n <= 2) return null;
  const kinds = kindsOf(all).sort((a, b) => COIN_CENTS[a] - COIN_CENTS[b]);
  const tries: Array<[CoinDef[], CoinDef[]]> = [];
  if (n > 3) for (const hi of [...kinds].reverse()) for (const lo of kinds) {
    const m = Math.min(3, Math.ceil(COIN_CENTS[hi] / COIN_CENTS[lo]) - 1);
    if (COIN_CENTS[lo] < COIN_CENTS[hi] && m >= 2) tries.push([[{ type: lo, count: m }], [{ type: hi, count: 1 }]]);
  }
  const pairs: Array<[CoinType, CoinType]> = [];
  for (const hi of kinds) for (const lo of kinds) if (COIN_CENTS[lo] < COIN_CENTS[hi]) pairs.push([lo, hi]);
  pairs.sort(([l1, h1], [l2, h2]) => Number(LOOK[h2].size < LOOK[l2].size) - Number(LOOK[h1].size < LOOK[l1].size));
  for (const [lo, hi] of pairs) tries.push([[{ type: lo, count: 1 }], [{ type: hi, count: 1 }]]);
  if (kinds.length === 1 && n > 3) tries.push([[{ type: kinds[0], count: 2 }], [{ type: kinds[0], count: 1 }]]);
  for (const [groupA, groupB] of tries) {
    const p = practiceOf(c, { groupA, groupB, correctGroup: winner(groupA, groupB), instruction: 'Which group has more money?' });
    if (!plainerLeaks(p, c)) return p;
  }
  return null;
}

// ── make-amount, show-amount: about half the amount ────────────────────────

/** The build's ask, written by code: the amount is the task, stated, never set beside the learner's coins. */
export const showAmountAsk = (n: number, thing?: string) =>
  thing ? `Show ${n}¢ for ${thing}, any way you like.` : `Show ${n}¢ any way you like.`;

/** The easier ask for a show-amount or make-amount item, or null: about half the amount, one the coins can make. */
export function smallerAmount(c: CoinCounterChallenge): CoinCounterChallenge | null {
  if ((c.type !== 'show-amount' && c.type !== 'make-amount') || isPractice(c)) return null;
  const full = c.targetAmount ?? 0;
  for (let target = Math.ceil(full / 2); target >= 2 && target < full; target--) {
    if (c.type === 'make-amount' && !fewestCoins(target, c.availableCoins ?? ['penny', 'nickel', 'dime', 'quarter'])) continue;
    const instruction = c.type === 'show-amount' ? showAmountAsk(target)
      : /fewest/i.test(c.instruction) ? `Make ${target}¢ with the fewest coins you can.` : `Make ${target}¢ with coins.`;
    return practiceOf(c, { targetAmount: target, instruction });
  }
  return null;
}

/** What the coins put in add up to at each coin, in the order put in (the value tags). */
export const runningValues = (placed: readonly CoinType[]) =>
  placed.reduce<number[]>((out, c) => [...out, (out.at(-1) ?? 0) + COIN_CENTS[c]], []);

// ── make-change: the bar and the round change ──────────────────────────────

/** The change bar: from 0 to what was paid, the cost shaded, a tick at each multiple of 5¢ past the cost, unlabelled. */
export function changeBar(c: CoinCounterChallenge): { paid: number; cost: number; ticks: number[] } | null {
  const paid = c.paidAmount ?? 0, cost = c.itemCost ?? 0;
  if (c.type !== 'make-change' || paid <= cost || cost < 0) return null;
  const ticks: number[] = [];
  for (let t = Math.floor(cost / 5) * 5 + 5; t < paid; t += 5) ticks.push(t);
  return { paid, cost, ticks };
}

/** Leak rule: the bar's only numbers are the two already on screen (paid and cost); the change is never written. */
export const changeBarLabels = (bar: { paid: number; cost: number }) => [cents(bar.cost), cents(bar.paid), '?'];

/** Leak rule for an easier change: the same payment, never the item's cost or its change. */
export function roundLeaks(p: CoinCounterChallenge, c: CoinCounterChallenge): boolean {
  return p.id === c.id || p.type !== 'make-change' || p.paidAmount !== c.paidAmount || p.itemCost === c.itemCost
    || p.correctChange !== (p.paidAmount ?? 0) - (p.itemCost ?? 0) || p.correctChange === c.correctChange
    || (p.correctChange ?? 0) % 10 !== 0 || (p.itemCost ?? 0) <= 0 || (p.correctChange ?? 0) <= 0;
}

/** The same payment and a cost whose change is whole tens (nearest first); when the change already is whole tens, ten
 *  less. Null when the change is 10¢ or no cost fits. */
export function roundChange(c: CoinCounterChallenge): CoinCounterChallenge | null {
  if (c.type !== 'make-change' || isPractice(c)) return null;
  const paid = c.paidAmount ?? 0, change = c.correctChange ?? paid - (c.itemCost ?? 0);
  const tens = Array.from({ length: Math.floor((paid - 1) / 10) }, (_, i) => (i + 1) * 10);
  const order = change % 10 === 0 ? tens.filter(t => t < change).reverse()
    : [...tens].sort((a, b) => Math.abs(a - change) - Math.abs(b - change) || a - b);
  for (const next of order) {
    const cost = paid - next;
    const p = practiceOf(c, { itemCost: cost, correctChange: next,
      instruction: `You pay ${cents(paid)} for something that costs ${cents(cost)}. How much change do you get?` });
    if (!roundLeaks(p, c)) return p;
  }
  return null;
}

// ── the levers ─────────────────────────────────────────────────────────────

/** The easier item for a session item, same mode, or null on an item already the plainest shape. */
export function practiceItem(c: CoinCounterChallenge): CoinCounterChallenge | null {
  switch (c.type) {
    case 'identify': return twoCoins(c);
    case 'count': return fewerCoins(c);
    case 'compare': return plainerGroups(c);
    case 'make-amount':
    case 'show-amount': return smallerAmount(c);
    case 'make-change': return roundChange(c);
  }
}

/** The session item a practice id stands in for. */
export const practiceParent = (id: string | null | undefined, challenges: readonly CoinCounterChallenge[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

const COUNT_MISSES: CoinMiss[] = ['counted_coins', 'all_one_kind', 'one_coin_short', 'one_coin_over', 'short', 'over'];
const COMPARE_MISSES: CoinMiss[] = ['more_coins', 'said_equal', 'missed_equal', 'reversed'];
const BUILD_MISSES: CoinMiss[] = ['counted_coins', 'one_coin_short', 'one_coin_over', 'short', 'over'];

/** The levers on a session item. `pulled` holds this item's runtime pulls; a tier aid already on screen is `pulled`. */
export function coinCounterLevers(c: CoinCounterChallenge | null, pulled: readonly string[], view: CoinLeverView = PLAIN_VIEW):
  WorkspaceLever[] {
  if (!c) return [];
  const levers: WorkspaceLever[] = [];
  const add = (id: string, kind: WorkspaceLever['kind'], answers: readonly CoinMiss[], when: string, does: string, shown = false) =>
    levers.push({ id, kind, carrier: 'shown', pulled: shown || pulled.includes(id), answers, when, does });
  const simplify = (id: string, answers: readonly CoinMiss[], when: string, does: string) => {
    if (practiceItem(c)) add(id, 'simplify', answers, when, `${does} It is not graded; the full item comes back after it, blank.`);
  };
  const values = (answers: readonly CoinMiss[]) => {
    if (!view.valuesShown) add(COIN_VALUES_LEVER, 'help', answers,
      'The learner does not know or forgets what the coins are worth (the values are hidden on screen).',
      'Prints each coin\'s value on the coin. Never a total.');
  };
  switch (c.type) {
    case 'identify':
      if (optionsOf(c).length >= 2) add(SIZE_ROW_LEVER, 'help', ['dime_nickel', 'dime_penny', 'silver_coins', 'other_coin'],
        'The learner mixes up coins that look alike, or picks by size the wrong way.',
        'Lines every coin up on one shelf from smallest to biggest, bottoms even, so sizes and colors can be compared. '
          + 'No name or value is drawn; never say which coin to tap.');
      simplify(TWO_COINS_LEVER, ['dime_nickel', 'dime_penny', 'silver_coins', 'other_coin'],
        'The learner cannot pick the coin among this many.',
        'Opens an easier ask first: another coin, between two coins that look very different.');
      return levers;
    case 'count': {
      const coins = c.displayedCoins ?? [];
      if (coinCount(coins) >= 2) values(COUNT_MISSES);
      if (skipStrip(c) && !view.enactedTap) add(SKIP_STRIP_LEVER, 'help', COUNT_MISSES,
        'The learner counts the coins one by one, or loses the skip count.',
        'Draws a counting strip under the coins that counts by one coin\'s value and runs past the total, nothing marked. '
          + 'You may count along it with the learner, one coin per step; never say where the count ends.');
      if (kindsOf(coins).length > 1) add(SORT_LEVER, 'help', COUNT_MISSES,
        'The learner counts mixed coins as if they were all one kind, or loses track among them.',
        'Sorts the coins into one row per kind (the kind worth most first when values are shown). No number is added.');
      simplify(FEWER_COINS_LEVER, ['counted_coins', 'all_one_kind', 'short', 'over'],
        'The learner cannot count this many coins yet.', 'Opens an easier ask first: fewer coins of the same kinds.');
      return levers;
    }
    case 'compare': {
      const groups = [c.groupA ?? [], c.groupB ?? []];
      values(COMPARE_MISSES);
      if (groups.some(g => kindsOf(g).length > 1)) add(SORT_LEVER, 'help', COMPARE_MISSES,
        'The learner judges by how many coins a group has, or loses track inside a group.',
        'Sorts each group into one row per kind (the kind worth most first when values are shown). No total is added; '
          + 'never say which group has more.');
      simplify(PLAINER_GROUPS_LEVER, COMPARE_MISSES, 'The learner cannot compare groups this big yet.',
        'Opens an easier ask first: one coin against one to three smaller coins.');
      return levers;
    }
    case 'make-amount':
    case 'show-amount': {
      values(BUILD_MISSES);
      const build = c.type === 'show-amount';
      add(RUNNING_TOTAL_LEVER, 'help', ['one_coin_short', 'one_coin_over'],
        'The learner puts in one coin too many or one too few.',
        build ? 'Shows under the tray how much the coins the learner put in make so far. Never the amount asked for.'
          : 'Shows beside the learner\'s coins how much the coins put in make so far. Never which coin to add.',
        !build && view.runningTotalShown);
      add(VALUE_TAGS_LEVER, 'help', build ? ['counted_coins', 'short', 'over'] : BUILD_MISSES,
        'The learner loses track of what the coins add up to, or counts coins instead of what they are worth.',
        `Puts a small number on each coin ${build ? 'in the tray' : 'put in'}: what the coins add up to at that coin, in the order put in.`);
      if (smallerAmount(c)) add(SMALLER_LEVER, 'simplify', ['counted_coins', 'short', 'over'],
        'The learner cannot make an amount this big yet.',
        build ? 'Opens an easier ask first, about half the amount, on an empty tray. It is not graded; the full item comes back after it.'
          : 'Opens an easier ask first, about half the amount. It is not graded; the full item comes back after it, blank.');
      return levers;
    }
    case 'make-change':
      if (changeBar(c)) add(CHANGE_BAR_LEVER, 'help', ['gave_cost', 'gave_paid', 'added', 'short', 'over'],
        'The learner gives the price or the amount paid, adds them, or is off counting up.',
        'Draws a bar for what was paid: the part up to the cost shaded, the rest marked "?" with an unlabelled tick at '
          + 'every 5¢. You may count up along the ticks with the learner; never say the change.');
      simplify(ROUND_CHANGE_LEVER, ['gave_cost', 'gave_paid', 'added', 'short', 'over'],
        'The learner cannot find this change yet.', 'Opens an easier ask first: the same payment, and change in whole tens.');
      return levers;
  }
}

/** What the pulled help levers put on screen, for the tutor and JEV. What is drawn, never the key. */
export function leverFacts(c: CoinCounterChallenge | null, pulled: readonly string[], view: CoinLeverView = PLAIN_VIEW): string {
  if (!c) return '';
  const on = (id: string) => pulled.includes(id);
  const strip = skipStrip(c), bar = changeBar(c);
  const build = c.type === 'show-amount';
  return [
    on(COIN_VALUES_LEVER) && 'Each coin now shows its value.',
    on(SIZE_ROW_LEVER) && c.type === 'identify' && 'The coins stand on one shelf from smallest to biggest, bottoms even, with no name or value.',
    on(SKIP_STRIP_LEVER) && strip && `Under the coins is a counting strip in steps of ${cents(strip[0])}, from ${cents(strip[0])} to ${cents(strip.at(-1)!)}, with nothing marked on it.`,
    on(SORT_LEVER) && (c.type === 'compare' ? 'Each group is sorted into one row per kind of coin' : 'The coins are sorted into one row per kind')
      + (view.valuesShown || on(COIN_VALUES_LEVER) ? ', the kind worth most first.' : ', in the order first drawn.'),
    on(RUNNING_TOTAL_LEVER) && (build ? 'Under the tray is how much the coins put in make so far.' : 'Beside the learner\'s coins is how much they make so far.'),
    on(VALUE_TAGS_LEVER) && `Each coin ${build ? 'in the tray' : 'put in'} carries a small number: what the coins add up to at that coin.`,
    on(CHANGE_BAR_LEVER) && bar && `Under the sum is a bar for the ${cents(bar.paid)} paid: shaded up to ${cents(bar.cost)} (the cost), the rest marked "?" with an unlabelled tick at every 5¢.`,
  ].filter((s): s is string => !!s).join(' ');
}
