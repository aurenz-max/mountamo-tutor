/**
 * Coin counter on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md).
 *
 * Pure: the component and any probe read the same assignment and scene. Every challenge is answered on
 * the screen (a tapped coin or group, placed coins, or a typed number) and checked by the activity's own
 * check, so the tutor is never handed `correctTotal`, `correctGroup`, `correctChange` or which coin to tap.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
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

export function workspaceAssignment(challenge: CoinCounterChallenge): TeachingAssignment {
  return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
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
    drawn.groups = `A: ${listCoins(challenge.groupA ?? [])}; B: ${listCoins(challenge.groupB ?? [])}`;
    drawn.coinValues = values;
  } else {
    drawn.paid = `${challenge.paidAmount ?? 0}¢`;
    drawn.itemCost = `${challenge.itemCost ?? 0}¢`;
  }
  return {
    objects: [],
    facts: {
      kind: challenge.type, ...drawn,
      learnerWork: describeCoinWork(challenge, view),
      constraints: 'The learner answers on the screen: taps a coin or a group, taps coins in or out, or types a number '
        + 'and presses Check; the activity checks the work itself. You cannot tap, place or type for the learner.',
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
