import type { CoinCounterData, CoinDef } from '../../../primitives/visual-primitives/math/CoinCounter';
import { COIN_CENTS } from '../../../primitives/visual-primitives/math/coinCounterWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

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

/** What the live adapter needs from the coin counter; the catalog's `teachingWorkspace` declares the rest. */
export const coinCounterLiveDomain: WorkspaceDomain<CoinCounterData> = {
  validate: validateCoinCounterData,
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges[0].instruction, total: d.challenges.length }),
};
