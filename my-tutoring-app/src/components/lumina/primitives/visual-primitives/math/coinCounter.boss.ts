/**
 * coin-counter's boss, on the spoken preset (`components/live-activity/boss.ts`): a total, the group worth more and the
 * change are said (the tutor judges the words against the key) or typed or tapped and checked (the activity checks
 * it), SAY_OR_SHOW items; identify, the Kindergarten and Grade 1 like counts and the builds have no key, the activity
 * checks them, and they play through `show`. The card is `coinCounter.card.ts`; this file holds the content check, the
 * items, the ask and key, the levers and the harness play.
 */
import type { CoinCounterData, CoinDef, CoinType } from './CoinCounter';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { coinCounterCard, type CoinMiss } from './coinCounter.card';
import { COIN_LEVERS, practiceItem, practiceParent } from './coinCounterLevers';
import {
  COIN_CENTS, coinAsk, coinGiven, coinHarnessWords, coinItems, coinKey, coinModeOf, coinSpokenMisses, enactedCount,
  fewestCoins, type CoinItem,
} from './coinCounterWorkspace';

const CHALLENGE_TYPES = ['identify', 'count', 'make-amount', 'compare', 'make-change', 'show-amount'];
const coinsOk = (coins: CoinDef[] | undefined) => Array.isArray(coins) && coins.length > 0
  && coins.every(c => c && c.type in COIN_CENTS && Number.isInteger(c.count) && c.count > 0);
const cents = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;

/** Reject a coin lesson whose challenges cannot be attempted. */
export function validateCoinCounterData(value: unknown): CoinCounterData {
  const d = value as CoinCounterData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated coin counter has invalid lesson content.');
  // Each type needs the material its own check reads, or it mounts unanswerable.
  for (const c of d.challenges) {
    const ok = c.type === 'identify' ? !!c.targetCoin && (!c.options || c.options.includes(c.targetCoin))
      : c.type === 'count' ? coinsOk(c.displayedCoins) && cents(c.correctTotal)
      : c.type === 'make-amount' ? cents(c.targetAmount) && (c.targetAmount ?? 0) > 0
      // The open build needs bins to take coins from, a penny among them or the amount may not be makeable.
      : c.type === 'show-amount' ? cents(c.targetAmount) && (c.targetAmount ?? 0) > 0
        && !!c.availableCoins?.length && c.availableCoins.every(t => t in COIN_CENTS) && c.availableCoins.includes('penny')
      : c.type === 'compare' ? coinsOk(c.groupA) && coinsOk(c.groupB) && ['A', 'B', 'equal'].includes(c.correctGroup ?? '')
      : cents(c.paidAmount) && cents(c.itemCost) && cents(c.correctChange);
    if (!ok) throw new Error(`A coin-counter ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

const choose = (label: string): DriverInput => ({ type: 'choose', label });
const check: DriverInput = { type: 'check' };
const add = (coins: readonly string[]) => coins.map(coin => choose(`Add a ${coin}`));
const coinTaps = (n: number) => Array.from({ length: n }, (_, i) => choose(`Coin ${i + 1}`));
const SILVER = ['nickel', 'dime', 'quarter', 'half-dollar'];

export const coinCounterBoss = spokenBoss<CoinCounterData, CoinItem, CoinMiss>({
  card: coinCounterCard,
  validate: validateCoinCounterData,
  items: coinItems,
  levers: COIN_LEVERS,
  speech: {
    ask: coinAsk,
    // Identify, an enacted like count and the builds have no key: the activity checks them.
    key: coinKey,
    given: coinGiven,
    misses: coinSpokenMisses,
    say: coinHarnessWords,
    modeOf: coinModeOf,
    // The shown items through their real controls. A wrong one is the mode's signature error from `coinMiss`: another
    // coin of the same metal, the number of coins for a total, one coin too many or one short. Kindergarten like coins
    // have no wrong check: the wrong play taps one coin twice, a double count the activity refuses on the coin itself.
    show: (right, c, ctx) => {
      if (c.type === 'identify') {
        const options: string[] = c.options ?? ['penny', 'nickel', 'dime', 'quarter'];
        const pick = right ? c.targetCoin! : options.find(o => o !== c.targetCoin && SILVER.includes(o) === SILVER.includes(c.targetCoin!))
          ?? options.find(o => o !== c.targetCoin)!;
        return [choose(`Coin ${options.indexOf(pick) + 1}`), check];
      }
      if (c.type === 'count') {
        const n = (c.displayedCoins ?? []).reduce((s, x) => s + x.count, 0), total = c.correctTotal ?? 0;
        if (enactedCount(c, c.band) === 'tap') return right ? coinTaps(n) : [...coinTaps(1), ...coinTaps(1)];
        const typed = right ? total : n !== total ? n : total - 1;
        return [...coinTaps(n), { type: 'write', label: 'Total in cents', text: String(typed) }, check];
      }
      const bins: CoinType[] = c.availableCoins ?? ['penny', 'nickel', 'dime', 'quarter'];
      if (c.type === 'make-amount') {
        const coins = fewestCoins(c.targetAmount ?? 0, bins);
        if (!coins) throw new Error(`coin-counter make-amount: ${c.targetAmount}¢ cannot be made from ${bins.join(', ')}`);
        const smallest = [...bins].sort((a, b) => COIN_CENTS[a] - COIN_CENTS[b])[0];
        return [...add(right ? coins : [...coins, smallest]), check];
      }
      // Open build: Try again keeps the tray, so the play reads what is on it (`centsMade`) and adds to it. A wrong
      // build is one coin short; pressing done again on the kept build is the second wrong.
      const made = Number(ctx.demand?.centsMade ?? 0), target = c.targetAmount ?? 0;
      const done = choose("I'm done!");
      if (made > target || (!right && made === target)) throw new Error(`coin-counter show-amount: ${made}¢ on the tray for ${target}¢`);
      if (!right) return made ? [done] : [...add((fewestCoins(target, bins) ?? []).slice(0, -1)), done];
      const rest = fewestCoins(target - made, bins);
      if (!rest) throw new Error(`coin-counter show-amount: ${target - made}¢ cannot be made from ${bins.join(', ')}`);
      return [...add(rest), done];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/math/CoinCounter.tsx',
    instanceId: 'coins',
    defaults: { grade: 'Grade 2', mode: 'count-mixed', topic: 'Counting mixed coins' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice item a simplify lever opened (`~smaller`), rebuilt from its parent.
    current: ctx => {
      const items = coinItems(ctx.data as CoinCounterData);
      const parent = practiceParent(ctx.itemId, items);
      return parent ? practiceItem(parent) ?? undefined : items.find(c => c.id === ctx.itemId);
    },
  },
});
