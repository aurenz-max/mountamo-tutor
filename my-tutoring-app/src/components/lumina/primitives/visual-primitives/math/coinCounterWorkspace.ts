/**
 * Coin counter on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md).
 *
 * Pure: the component and any probe read the same assignment and scene. A count (typed total), compare (which group)
 * and make-change (typed change) ask for one amount or one group, so each may also be said aloud: the item is spoken
 * with `acceptsGesture`, and JEV judges it from the tutor's feedback against `expectedAnswer` (VB-1, 2026-10-13); a
 * typed or tapped answer and Check is still checked by the activity. Kept tap-only: identify (the question names the
 * coin, so the answer is which drawn coin, a position the size_row lever reorders), the Kindergarten and Grade 1 like
 * counts (tapping or tagging every coin is part of the answer, R9/R11), and the builds (make-amount, fewest-coins,
 * show-amount). The scene never states a total, the group with more money, the change or which coin to tap.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { CoinCounterChallenge, CoinDef, CoinType } from './CoinCounter';

export const COIN_CENTS: Record<CoinType, number> = { penny: 1, nickel: 5, dime: 10, quarter: 25, 'half-dollar': 50, dollar: 100 };

const coinName = (type: CoinType, count: number) =>
  count === 1 ? type : type === 'penny' ? 'pennies' : `${type}s`;
const listCoins = (coins: readonly CoinDef[]) => coins.map(c => `${c.count} ${coinName(c.type, c.count)}`).join(', ');
const centsOf = (coins: readonly CoinDef[]) => coins.reduce((sum, c) => sum + COIN_CENTS[c.type] * c.count, 0);
const tally = (coins: readonly CoinType[]): CoinDef[] => {
  const by = new Map<CoinType, number>();
  for (const c of coins) by.set(c, (by.get(c) ?? 0) + 1);
  return Array.from(by, ([type, count]) => ({ type, count }));
};

/** A like-coin count at Kindergarten (taps) or Grade 1 (tags, then the typed total): the taps are part of the answer. */
export const enactedCount = (c: CoinCounterChallenge, gradeBand: string): 'tap' | 'tag' | null =>
  c.type === 'count' && c.countMode === 'like' && (c.displayedCoins ?? []).some(d => d.count > 0)
    ? gradeBand === 'K' ? 'tap' : gradeBand === '1' ? 'tag' : null : null;

/** The challenges whose answer is one amount or one group a learner can say. */
export const isSpokenCoin = (c: CoinCounterChallenge, gradeBand: string) =>
  (c.type === 'count' && !enactedCount(c, gradeBand)) || c.type === 'compare' || c.type === 'make-change';

/** `gradeBand` defaults as the component's does. */
export function workspaceAssignment(challenge: CoinCounterChallenge, gradeBand = '1'): TeachingAssignment {
  const expectedAnswer = isSpokenCoin(challenge, gradeBand) ? coinExpectedAnswer(challenge) : undefined;
  if (!expectedAnswer) return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
  const how = challenge.type === 'compare' ? 'saying which group, or tapping it and pressing Check'
    : challenge.type === 'make-change' ? 'saying the change, or typing it and pressing Check'
      : 'saying the total, or typing it and pressing Check';
  return { id: challenge.id, task: `${challenge.instruction} The learner answers by ${how}.`,
    response: 'speech', acceptsGesture: true, expectedAnswer, misses: coinSpokenMisses(challenge) };
}

// ── Spoken amounts ────────────────────────────────────────────────────────────
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** 0-999 in words: "forty-five", "one hundred twenty-five". */
const words = (n: number): string => n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')
  : `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${words(n % 100)}` : ''}`;
const centsWord = (n: number) => n === 1 ? 'cent' : 'cents';

/** Every natural way to say an amount of money: "13 cents", "thirteen cents", "thirteen", "13¢"; "$1.25" and up. */
export function spokenCentsForms(n: number): string[] {
  if (n < 100) return [`${n} ${centsWord(n)}`, `${words(n)} ${centsWord(n)}`, words(n), `${n}¢`];
  const d = Math.floor(n / 100), r = n % 100, dollars = d === 1 ? 'one dollar' : `${words(d)} dollars`;
  return [`$${d}.${String(r).padStart(2, '0')}`, r ? `${dollars} and ${words(r)} ${centsWord(r)}` : dollars,
    ...(r ? [`${d === 1 ? 'a dollar' : `${words(d)} dollars`} ${words(r)}`] : d === 1 ? ['a dollar'] : []),
    `${n} cents`, `${words(n)} cents`];
}
/** The two plainest forms, for a miss's examples. */
const said = (n: number) => [`${words(n)} ${centsWord(n)}`, `${n} ${centsWord(n)}`];
const quoted = (forms: string[]) => forms.map(f => `"${f}"`).join(', ');

/** The one answer a spoken count, compare or make-change item is judged against, with the ways of saying it. */
export function coinExpectedAnswer(c: CoinCounterChallenge): string | undefined {
  if (c.type === 'count') {
    const coins = c.displayedCoins ?? [], total = c.correctTotal ?? centsOf(coins);
    const count = coins.reduce((n, d) => n + d.count, 0);
    return `${total}¢ in all (${listCoins(coins)}); said as ${quoted(spokenCentsForms(total))}. Naming the coins without `
      + 'a total is not an answer yet. '
      + (count !== total ? `The number of coins (${count}) is not the total. ` : '')
      + 'Any other amount is not it.';
  }
  if (c.type === 'make-change') {
    const change = c.correctChange ?? (c.paidAmount ?? 0) - (c.itemCost ?? 0);
    return `${change}¢ of change (${c.paidAmount ?? 0}¢ paid for a ${c.itemCost ?? 0}¢ item); said as `
      + `${quoted(spokenCentsForms(change))}. Naming coins worth exactly ${change}¢ in all is also it. The price, the `
      + 'amount paid, or any other amount is not it.';
  }
  if (c.type === 'compare' && c.correctGroup) {
    if (c.correctGroup === 'equal') return 'they are worth the same; said as "they are equal", "the same", "both", '
      + '"they are worth the same". Naming group A or group B as worth more is not it.';
    const [is, side, nth] = c.correctGroup === 'A' ? ['A', 'left', 'first'] : ['B', 'right', 'second'];
    const other = is === 'A' ? 'B' : 'A';
    return `group ${is}, the group on the ${side}; said as "group ${is}", "${is}", "the ${nth} one", "the ${side} one". `
      + `Naming group ${other}, or saying they are worth the same, is not it.`;
  }
  return undefined;
}

/**
 * A spoken item's known wrong answers, with the tap's ids (`coinMiss`, the catalog's lists), in `coinMiss` order. An
 * amount that is the key is never an example, and an amount two misses share goes to the first.
 */
export function coinSpokenMisses(c: CoinCounterChallenge): KnownMiss[] {
  const misses: KnownMiss[] = [];
  const claimed = new Set<number>();
  const amounts = (id: string, pattern: string, values: number[]) => {
    const fresh = Array.from(new Set(values)).filter(v => v > 0 && !claimed.has(v));
    if (!fresh.length) return;
    fresh.forEach(v => claimed.add(v));
    misses.push({ id, pattern: `${pattern}: ${fresh.map(v => `${v}¢`).join(' or ')}.`,
      examples: fresh.slice(0, 3).flatMap(said).slice(0, 6) });
  };
  if (c.type === 'count') {
    const coins = c.displayedCoins ?? [], key = c.correctTotal ?? centsOf(coins);
    const count = coins.reduce((n, d) => n + d.count, 0), kinds = coins.map(d => COIN_CENTS[d.type]);
    claimed.add(key);
    amounts('counted_coins', `The learner counts the coins (${count}) instead of what they are worth`, [count]);
    if (coins.length > 1) amounts('all_one_kind', 'The learner values every coin as one of the kinds shown', kinds.map(v => count * v));
    amounts('one_coin_short', 'The learner’s total is one coin short', kinds.map(v => key - v));
    amounts('one_coin_over', 'The learner’s total is one coin too many', kinds.map(v => key + v));
    misses.push({ id: 'short', pattern: `Any other total below ${key}¢.` }, { id: 'over', pattern: `Any other total above ${key}¢.` });
    return misses;
  }
  if (c.type === 'make-change') {
    const paid = c.paidAmount ?? 0, cost = c.itemCost ?? 0, key = c.correctChange ?? paid - cost;
    claimed.add(key);
    amounts('gave_cost', 'The learner says the price of the item', [cost]);
    amounts('gave_paid', 'The learner says the amount paid', [paid]);
    amounts('added', 'The learner adds the price to the amount paid', [paid + cost]);
    misses.push({ id: 'short', pattern: `Any other amount below ${key}¢.` }, { id: 'over', pattern: `Any other amount above ${key}¢.` });
    return misses;
  }
  if (c.type === 'compare' && c.correctGroup) {
    if (c.correctGroup === 'equal') return [{ id: 'missed_equal', pattern: 'The learner names group A or group B as worth '
      + 'more, but both groups are worth the same.', examples: ['group A', 'group B', 'the first one', 'the second one'] }];
    const other = c.correctGroup === 'A' ? 'B' : 'A';
    const count = (g: readonly CoinDef[] = []) => g.reduce((n, d) => n + d.count, 0);
    const otherCoins = count(other === 'A' ? c.groupA : c.groupB), keyCoins = count(c.correctGroup === 'A' ? c.groupA : c.groupB);
    const examples = [`group ${other}`, other === 'A' ? 'the first one' : 'the second one'];
    return [
      otherCoins > keyCoins
        ? { id: 'more_coins', pattern: `The learner names group ${other}, which has more coins but less money.`, examples }
        : { id: 'reversed', pattern: `The learner names group ${other}, which is worth less.`, examples },
      { id: 'said_equal', pattern: 'The learner says the two groups are worth the same.', examples: ['they are equal', 'the same'] },
    ];
  }
  return [];
}

export interface CoinView {
  selectedCoin: CoinType | null;
  countInput: string;
  /** Coins tapped so far on an enacted count (Kindergarten and Grade 1 like coins). */
  counted: number;
  /** 'tap' at Kindergarten (the taps are the answer), 'tag' at Grade 1 (tag every coin, then type the total). */
  enacted: 'tap' | 'tag' | null;
  placed: readonly CoinType[];
  selectedGroup: 'A' | 'B' | 'equal' | null;
  changeInput: string;
  /** Whether each coin shows its ¢ value (withdrawn at the hard tier; never on identify). */
  valuesShown: boolean;
  /** Whether the running total is on screen (make-amount, and the Grade 1 tag count). */
  runningTotalShown: boolean;
}

/** The numeric fact per coin kind on the show-amount tray. */
const TRAY_KEY: Record<CoinType, string> = { penny: 'penniesOnTray', nickel: 'nickelsOnTray', dime: 'dimesOnTray',
  quarter: 'quartersOnTray', 'half-dollar': 'halfDollarsOnTray', dollar: 'dollarsOnTray' };

const typed = (text: string, what: string) => text.trim() ? `Typed ${text.trim()}¢ as the ${what}` : `No ${what} typed yet`;

/** The learner's work in their own terms, never the key. */
export function describeCoinWork(challenge: CoinCounterChallenge, view: CoinView): string {
  switch (challenge.type) {
    case 'identify': return view.selectedCoin ? `Picked the ${view.selectedCoin}` : 'No coin picked yet';
    case 'count': {
      // No number of coins: with pennies it is the total.
      const all = view.counted >= (challenge.displayedCoins ?? []).reduce((n, c) => n + c.count, 0);
      if (view.enacted === 'tap') return all ? 'Tapped every coin once' : view.counted ? 'Tapping the coins, not all yet' : 'No coin tapped yet';
      const tags = view.enacted === 'tag' ? (all ? 'Tagged every coin. ' : 'Not every coin tagged yet. ') : '';
      return tags + typed(view.countInput, 'total');
    }
    case 'make-amount': return view.placed.length ? `Placed: ${listCoins(tally(view.placed))}` : 'No coins placed yet';
    case 'show-amount': return view.placed.length ? `On the tray: ${listCoins(tally(view.placed))}` : 'No coins on the tray yet';
    case 'compare':
      return view.selectedGroup === 'equal' ? 'Chose: they are equal'
        : view.selectedGroup ? `Chose group ${view.selectedGroup}` : 'No group chosen yet';
    default: return typed(view.changeInput, 'change');
  }
}

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the work the check reads, drawn from
 * the catalog's commonStruggles (small coin is not small value; skip-counting mixed values; change needs
 * subtraction). Only the observable pattern:
 * - identify: `dime_nickel` (the two swapped), `dime_penny` (the small coins swapped), `silver_coins`
 *   (another silver coin), `other_coin`;
 * - count, make-amount and show-amount: `counted_coins` (the number of coins, not their value), `all_one_kind` (every coin
 *   valued as one of the kinds shown), `one_coin_short` / `one_coin_over` (off by one coin's value),
 *   `short` / `over`;
 * - compare: `more_coins` (the group with more coins but less money), `said_equal`, `missed_equal`, `reversed`;
 * - make-change: `gave_cost` (the price), `gave_paid` (the amount paid), `added` (paid plus price), `short` / `over`.
 */
export type CoinMiss = 'dime_nickel' | 'dime_penny' | 'silver_coins' | 'other_coin'
  | 'counted_coins' | 'all_one_kind' | 'one_coin_short' | 'one_coin_over' | 'short' | 'over'
  | 'more_coins' | 'said_equal' | 'missed_equal' | 'reversed'
  | 'gave_cost' | 'gave_paid' | 'added';

const SILVER: readonly CoinType[] = ['nickel', 'dime', 'quarter', 'half-dollar'];

function identifyMiss(picked: CoinType, target: CoinType): CoinMiss {
  const pair = new Set([picked, target]);
  if (pair.has('dime') && pair.has('nickel')) return 'dime_nickel';
  if (pair.has('dime') && pair.has('penny')) return 'dime_penny';
  return SILVER.includes(picked) && SILVER.includes(target) ? 'silver_coins' : 'other_coin';
}

/** A total that is not the target, read against the coins it was made from. */
function totalMiss(got: number, target: number, coins: readonly CoinDef[]): CoinMiss {
  const count = coins.reduce((n, c) => n + c.count, 0);
  if (got === count && count !== target) return 'counted_coins';
  if (coins.length > 1 && coins.some(c => got === count * COIN_CENTS[c.type])) return 'all_one_kind';
  const kinds = coins.map(c => COIN_CENTS[c.type]);
  if (kinds.includes(target - got)) return 'one_coin_short';
  if (kinds.includes(got - target)) return 'one_coin_over';
  return got < target ? 'short' : 'over';
}

const changeMiss = (got: number, c: CoinCounterChallenge): CoinMiss => {
  const paid = c.paidAmount ?? 0, cost = c.itemCost ?? 0;
  if (got === cost) return 'gave_cost';
  if (got === paid) return 'gave_paid';
  if (got === paid + cost) return 'added';
  return got < (c.correctChange ?? paid - cost) ? 'short' : 'over';
};

export function coinMiss(challenge: CoinCounterChallenge | null, view: CoinView): CoinMiss | undefined {
  if (!challenge) return undefined;
  switch (challenge.type) {
    case 'identify':
      return view.selectedCoin && challenge.targetCoin && view.selectedCoin !== challenge.targetCoin
        ? identifyMiss(view.selectedCoin, challenge.targetCoin) : undefined;
    case 'count': {
      const got = parseInt(view.countInput, 10), target = challenge.correctTotal ?? 0;
      return Number.isNaN(got) || got === target ? undefined : totalMiss(got, target, challenge.displayedCoins ?? []);
    }
    // show-amount is make-amount's judgment on an empty tray: any coins that make the amount pass.
    case 'make-amount':
    case 'show-amount': {
      const placed = tally(view.placed), got = centsOf(placed), target = challenge.targetAmount ?? 0;
      if (got === target) return undefined;
      if (view.placed.length === target) return 'counted_coins';
      const kinds = (challenge.availableCoins ?? []).map(t => COIN_CENTS[t]);
      if (kinds.includes(target - got)) return 'one_coin_short';
      if (kinds.includes(got - target)) return 'one_coin_over';
      return got < target ? 'short' : 'over';
    }
    case 'compare': {
      const chosen = view.selectedGroup, key = challenge.correctGroup;
      if (!chosen || chosen === key) return undefined;
      if (chosen === 'equal') return 'said_equal';
      if (key === 'equal') return 'missed_equal';
      const count = (g: readonly CoinDef[] = []) => g.reduce((n, c) => n + c.count, 0);
      const mine = chosen === 'A' ? challenge.groupA : challenge.groupB;
      const other = chosen === 'A' ? challenge.groupB : challenge.groupA;
      return count(mine) > count(other) ? 'more_coins' : 'reversed';
    }
    default: {
      const got = parseInt(view.changeInput, 10);
      return Number.isNaN(got) || got === challenge.correctChange ? undefined : changeMiss(got, challenge);
    }
  }
}

/** What is drawn and asked. The coins on screen are listed; no total, winner or change is. */
export function workspaceScene(challenge: CoinCounterChallenge, view: CoinView): WorkspaceScene {
  const drawn: Record<string, string | number> = {};
  const values = view.valuesShown ? 'shown on each coin' : 'hidden: do not say what any coin is worth';
  if (challenge.type === 'identify') {
    drawn.coins = `${(challenge.options ?? []).length || 4} coins, drawn by size and color with no names or values`;
  } else if (challenge.type === 'count') {
    drawn.coins = listCoins(challenge.displayedCoins ?? []);
    drawn.coinValues = values;
    if (view.enacted === 'tap') drawn.howToAnswer = 'tap each coin once; the taps count up and the count checks itself';
    if (view.enacted === 'tag') drawn.howToAnswer = 'tap each coin once to tag it, then type the total and press Check';
    if (view.enacted === 'tag') drawn.runningTotal = view.runningTotalShown ? 'shown while tagging' : 'hidden';
  } else if (challenge.type === 'make-amount') {
    drawn.target = `${challenge.targetAmount ?? 0}¢`;
    drawn.coinsToAdd = (challenge.availableCoins ?? []).join(', ');
    drawn.coinValues = values;
    drawn.runningTotal = view.runningTotalShown ? 'shown' : 'hidden';
  } else if (challenge.type === 'show-amount') {
    // Open build: the amount is in the task. The made amount and each coin count are numbers, so the workspace's
    // work history can name a self-correction; the target is never set beside them.
    drawn.coinBins = (challenge.availableCoins ?? []).join(', ');
    drawn.coinValues = values;
    drawn.howToAnswer = 'tap a bin to put a coin on the tray, tap a coin on the tray to take it out, then press I\'m done';
    drawn.centsMade = centsOf(tally(view.placed));
    for (const type of challenge.availableCoins ?? []) drawn[TRAY_KEY[type]] = view.placed.filter(c => c === type).length;
  } else if (challenge.type === 'compare') {
    drawn.groups = `A (left): ${listCoins(challenge.groupA ?? [])}; B (right): ${listCoins(challenge.groupB ?? [])}`;
    drawn.coinValues = values;
    drawn.howToAnswer = 'say which group is worth more, or that they are worth the same; or tap a group or They’re Equal and press Check';
  } else {
    drawn.paid = `${challenge.paidAmount ?? 0}¢`;
    drawn.itemCost = `${challenge.itemCost ?? 0}¢`;
    drawn.howToAnswer = 'say the change, or type it in cents and press Check';
  }
  if (challenge.type === 'count' && !view.enacted) drawn.howToAnswer = 'say the total, or type it in cents and press Check';
  // `view.enacted` is the component's reading of the grade band, the one its assignment used.
  const spoken = challenge.type === 'compare' || challenge.type === 'make-change' || (challenge.type === 'count' && !view.enacted);
  return {
    objects: [],
    facts: {
      kind: challenge.type, ...drawn,
      learnerWork: describeCoinWork(challenge, view),
      constraints: spoken
        ? 'The learner says the answer, or types it or taps a group and presses Check; a Check is checked by the activity. '
          + `Before the learner has answered, never name ${WITHHELD[challenge.type]}. You cannot tap or type for the learner.`
        : 'The learner answers on the screen: taps a coin or a group, taps coins in or out, or types a number '
          + 'and presses Check; the activity checks the work itself. You cannot tap, place or type for the learner.',
    },
  };
}

/** What a spoken mode's answer is, which the scene withholds until the learner answers. */
const WITHHELD: Record<string, string> = {
  count: 'the total', compare: 'which group is worth more or whether they are worth the same', 'make-change': 'the change',
};

/** The fewest coins from `available` (unlimited supply) that make `target`, largest first; null when none can. */
export function fewestCoins(target: number, available: readonly CoinType[]): CoinType[] | null {
  const best: Array<CoinType[] | null> = [[]];
  for (let t = 1; t <= target; t++) {
    best[t] = null;
    for (const c of available) {
      const rest = best[t - COIN_CENTS[c]];
      if (COIN_CENTS[c] <= t && rest && (!best[t] || rest.length + 1 < best[t]!.length)) best[t] = [...rest, c];
    }
  }
  return best[target]?.sort((a, b) => COIN_CENTS[b] - COIN_CENTS[a]) ?? null;
}
