/**
 * Coin counter on the shared tutor/JEV teaching workspace: the items, the ask, the spoken key, the activity's check and
 * the scene, which the boss (`coinCounter.boss.ts`), the component, the levers and the tests read.
 *
 * A count that is not enacted (every mixed count, a like count from Grade 2), a compare and a make-change ask for one
 * amount or one group, so each may also be said aloud: the boss hands the tutor its key (`coinKey`), and a typed or
 * tapped answer and Check is still checked by the activity. Identify (the question names the coin, so the answer is
 * which drawn coin), the Kindergarten and Grade 1 like counts (tapping or tagging every coin is part of the answer,
 * contract R9/R11) and the builds have no key. The scene never states a total, the group with more money, the change
 * or which coin to tap.
 *
 * Pure: no React.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { CoinCounterChallenge, CoinCounterData, CoinDef, CoinType } from './CoinCounter';
import { COIN_MISSES, type CoinMiss } from './coinCounter.card';

export { COIN_MISSES, type CoinMiss };

export const COIN_CENTS: Record<CoinType, number> = { penny: 1, nickel: 5, dime: 10, quarter: 25, 'half-dollar': 50, dollar: 100 };

/** One challenge as the lesson runs it: the lesson's grade band stamped on, because whether a like count is enacted
 *  (and so whether it has a key) differs by it. Never generated. */
export type CoinItem = CoinCounterChallenge & { band: string };

/** The lesson's items, in order. `gradeBand` defaults as the component's does. */
export const coinItems = (d: Pick<CoinCounterData, 'challenges' | 'gradeBand'>): CoinItem[] =>
  (d.challenges ?? []).map(c => ({ ...c, band: d.gradeBand ?? '1' }));

/** The item's eval mode. fewest-coins builds the same challenge as make-amount and is wired alike (contract G8). */
export const coinModeOf = (c: CoinCounterChallenge): string =>
  c.type === 'count' ? (c.countMode === 'like' ? 'count-like' : 'count-mixed') : c.type;

const coinName = (type: CoinType, count: number) =>
  count === 1 ? type : type === 'penny' ? 'pennies' : `${type}s`;
const listCoins = (coins: readonly CoinDef[]) => coins.map(c => `${c.count} ${coinName(c.type, c.count)}`).join(', ');
const centsOf = (coins: readonly CoinDef[]) => coins.reduce((sum, c) => sum + COIN_CENTS[c.type] * c.count, 0);
const coinCount = (coins: readonly CoinDef[] = []) => coins.reduce((n, d) => n + d.count, 0);
const tally = (coins: readonly CoinType[]): CoinDef[] => {
  const by = new Map<CoinType, number>();
  for (const c of coins) by.set(c, (by.get(c) ?? 0) + 1);
  return Array.from(by, ([type, count]) => ({ type, count }));
};

/** A like-coin count at Kindergarten (taps) or Grade 1 (tags, then the typed total): the taps are part of the answer. */
export const enactedCount = (c: CoinCounterChallenge, gradeBand: string): 'tap' | 'tag' | null =>
  c.type === 'count' && c.countMode === 'like' && (c.displayedCoins ?? []).some(d => d.count > 0)
    ? gradeBand === 'K' ? 'tap' : gradeBand === '1' ? 'tag' : null : null;

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

/**
 * An amount's key. The bare number ("thirteen", "13¢") is accepted by rule rather than listed, so an ask that says the
 * number for another reason ("two stickers") is not taken for a leak.
 */
const amountKey = (n: number, signatureError: string, acceptRule?: string): SpokenKey => {
  const forms = spokenCentsForms(n).filter(f => /cent|dollar|\$/i.test(f));
  return { answer: forms[0], alsoAccept: forms.slice(1),
    acceptRule: [`The number alone (${n}) counts.`, acceptRule].filter(Boolean).join(' '), signatureError };
};

// ── The ask and the key ──────────────────────────────────────────────────────

const GROUP_MENU = ['group A', 'group B', 'the same'];

/** The challenge's own words; a compare adds its three answers, the closed menu its key reads. */
export const coinAsk = (c: CoinCounterChallenge): string =>
  c.type === 'compare' ? `${c.instruction.trim()} Group A, group B, or the same?` : c.instruction;

/** What a make-change ask says by design: the price and the amount paid, which may equal the change. */
export const coinGiven = (c: CoinCounterChallenge): string[] =>
  (c.type === 'make-change' ? [c.itemCost ?? 0, c.paidAmount ?? 0].flatMap(spokenCentsForms) : []);

/** The key a spoken item is judged against; null on identify, an enacted like count and a build (shown only). */
export function coinKey(c: CoinItem): SpokenKey | null {
  if (c.type === 'count' && !enactedCount(c, c.band)) {
    const coins = c.displayedCoins ?? [], total = c.correctTotal ?? centsOf(coins), count = coinCount(coins);
    return amountKey(total, `${count !== total ? `The number of coins (${count}) is not the total. ` : ''}`
      + 'Naming the coins without a total is not an answer yet.');
  }
  if (c.type === 'make-change') {
    const change = c.correctChange ?? (c.paidAmount ?? 0) - (c.itemCost ?? 0);
    return amountKey(change, 'The price, the amount paid, or the two added is not the change.',
      `Naming coins worth exactly ${change}¢ in all counts.`);
  }
  if (c.type === 'compare' && c.correctGroup) {
    if (c.correctGroup === 'equal') return { answer: 'the same', menu: GROUP_MENU,
      alsoAccept: ['they are worth the same', 'they are equal', 'equal', 'both'],
      signatureError: 'Naming group A or group B as worth more is wrong: both are worth the same.' };
    const [is, side, nth] = c.correctGroup === 'A' ? ['A', 'left', 'first'] : ['B', 'right', 'second'];
    return { answer: `group ${is}`, menu: GROUP_MENU,
      alsoAccept: [is, `the ${nth} one`, `the ${side} one`, `the ${nth} group`, `group ${is} is worth more`],
      signatureError: `Naming group ${is === 'A' ? 'B' : 'A'}, or saying they are worth the same, is wrong.` };
  }
  return null;
}

/** The journey's spoken answers: the key's own words, or the mode's signature error. */
export function coinHarnessWords(c: CoinItem): { correct: string; plainWrong: string } {
  const key = coinKey(c);
  if (!key) throw new Error(`coin-counter ${c.id}: a shown item has no spoken answer`);
  if (c.type === 'count') {
    const count = coinCount(c.displayedCoins), total = c.correctTotal ?? 0;
    return { correct: key.answer, plainWrong: `${count !== total ? count : total - 1} cents` };
  }
  if (c.type === 'make-change') {
    const cost = c.itemCost ?? 0, change = c.correctChange ?? 0;
    return { correct: key.answer, plainWrong: `${cost !== change ? cost : change + 1} cents` };
  }
  return { correct: key.answer, plainWrong: c.correctGroup === 'A' ? 'group B' : 'group A' };
}

/**
 * A spoken item's known wrong answers, with the tap's ids (`coinMiss`, the card's lists), in `coinMiss` order. An
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
    const count = coinCount(coins), kinds = coins.map(d => COIN_CENTS[d.type]);
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
    const otherCoins = coinCount(other === 'A' ? c.groupA : c.groupB), keyCoins = coinCount(c.correctGroup === 'A' ? c.groupA : c.groupB);
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

// ── The learner's work and the activity's check ──────────────────────────────

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
      const all = view.counted >= coinCount(challenge.displayedCoins);
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

const SILVER: readonly CoinType[] = ['nickel', 'dime', 'quarter', 'half-dollar'];

function identifyMiss(picked: CoinType, target: CoinType): CoinMiss {
  const pair = new Set([picked, target]);
  if (pair.has('dime') && pair.has('nickel')) return 'dime_nickel';
  if (pair.has('dime') && pair.has('penny')) return 'dime_penny';
  return SILVER.includes(picked) && SILVER.includes(target) ? 'silver_coins' : 'other_coin';
}

/** A total that is not the target, read against the coins it was made from. */
function totalMiss(got: number, target: number, coins: readonly CoinDef[]): CoinMiss {
  const count = coinCount(coins);
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
      const mine = chosen === 'A' ? challenge.groupA : challenge.groupB;
      const other = chosen === 'A' ? challenge.groupB : challenge.groupA;
      return coinCount(mine) > coinCount(other) ? 'more_coins' : 'reversed';
    }
    default: {
      const got = parseInt(view.changeInput, 10);
      return Number.isNaN(got) || got === challenge.correctChange ? undefined : changeMiss(got, challenge);
    }
  }
}

// ── The scene ────────────────────────────────────────────────────────────────

const IDENTIFY_RULE = 'The coins are drawn by size and color only: never name, number or point to the coin to tap; '
  + 'describing what a named coin looks like is teaching.';
const COUNT_RULE = 'Counting aloud together by a coin\'s value is teaching; saying where the count ends is not.';
const BUILD_RULE = 'Never say which coin to add or take out, or how much more is needed.';

/** What is drawn and asked. The coins on screen are listed; no total, winner or change is. */
export function coinScene(challenge: CoinItem, view: CoinView): SceneOf {
  const drawn: Record<string, string | number> = {};
  const values = view.valuesShown ? 'shown on each coin' : 'hidden: do not say what any coin is worth';
  let rule = '';
  if (challenge.type === 'identify') {
    drawn.coins = `${(challenge.options ?? []).length || 4} coins, drawn by size and color with no names or values`;
    rule = IDENTIFY_RULE;
  } else if (challenge.type === 'count') {
    drawn.coins = listCoins(challenge.displayedCoins ?? []);
    drawn.coinValues = values;
    if (view.enacted === 'tag') drawn.runningTotal = view.runningTotalShown ? 'shown while tagging' : 'hidden';
    rule = COUNT_RULE;
  } else if (challenge.type === 'make-amount') {
    drawn.target = `${challenge.targetAmount ?? 0}¢`;
    drawn.coinsToAdd = (challenge.availableCoins ?? []).join(', ');
    drawn.coinValues = values;
    drawn.runningTotal = view.runningTotalShown ? 'shown' : 'hidden';
    rule = BUILD_RULE;
  } else if (challenge.type === 'show-amount') {
    // Open build: the amount is in the task. The made amount and each coin count are numbers, so the workspace's
    // work history can name a self-correction; the target is never set beside them.
    drawn.coinBins = (challenge.availableCoins ?? []).join(', ');
    drawn.coinValues = values;
    drawn.centsMade = centsOf(tally(view.placed));
    for (const type of challenge.availableCoins ?? []) drawn[TRAY_KEY[type]] = view.placed.filter(c => c === type).length;
    rule = BUILD_RULE;
  } else if (challenge.type === 'compare') {
    drawn.groups = `A (left): ${listCoins(challenge.groupA ?? [])}; B (right): ${listCoins(challenge.groupB ?? [])}`;
    drawn.coinValues = values;
  } else {
    drawn.paid = `${challenge.paidAmount ?? 0}¢`;
    drawn.itemCost = `${challenge.itemCost ?? 0}¢`;
  }
  return {
    objects: [],
    facts: {
      kind: challenge.type,
      grade: challenge.band === 'K' ? 'Kindergarten' : `Grade ${challenge.band}`,
      ...drawn,
      learnerWork: describeCoinWork(challenge, view),
      ...(rule ? { constraints: rule } : {}),
    },
  };
}

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
