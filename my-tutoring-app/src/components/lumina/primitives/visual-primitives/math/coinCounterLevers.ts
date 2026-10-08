/**
 * The in-item levers on coin-counter's open build, `show-amount` (/add-eval-modes references/build-mode.md). The
 * learner makes an amount on an empty tray, any coins that add up to it. Keeping track of what the coins add up to IS
 * the task, so the item starts bare and the levers come on a miss, never from the tier.
 * - `running_total` (help): under the tray, how much the coins put in make so far. Never the amount asked for.
 * - `value_tags` (help): on each coin in the tray, what the coins add up to at that coin, in the order put in.
 * - `smaller_amount` (simplify): an ungraded ask for about half the amount on an empty tray, then the full item.
 * The other modes declare no levers.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { CoinCounterChallenge, CoinType } from './CoinCounter';
import { COIN_CENTS, type CoinMiss } from './coinCounterWorkspace';

export const RUNNING_TOTAL_LEVER = 'running_total';
export const VALUE_TAGS_LEVER = 'value_tags';
export const SMALLER_LEVER = 'smaller_amount';

const SMALLER = '~smaller';
export const isPracticeAmount = (c: Pick<CoinCounterChallenge, 'id'>) => c.id.endsWith(SMALLER);

/** The build's ask, written by code: the amount is the task, stated, never set beside the learner's coins. */
export const showAmountAsk = (cents: number, thing?: string) =>
  thing ? `Show ${cents}¢ for ${thing}, any way you like.` : `Show ${cents}¢ any way you like.`;

/** The easier ask for a show-amount item, or null: about half the amount, on an empty tray. */
export function smallerAmount(c: CoinCounterChallenge): CoinCounterChallenge | null {
  if (c.type !== 'show-amount' || isPracticeAmount(c)) return null;
  const target = Math.ceil((c.targetAmount ?? 0) / 2);
  if (target < 2 || target >= (c.targetAmount ?? 0)) return null;
  return { ...c, id: `${c.id}${SMALLER}`, targetAmount: target, instruction: showAmountAsk(target) };
}

/** What the coins put in add up to at each coin, in the order put in (the value tags). */
export const runningValues = (placed: readonly CoinType[]) =>
  placed.reduce<number[]>((out, c) => [...out, (out.at(-1) ?? 0) + COIN_CENTS[c]], []);

export function coinCounterLevers(c: CoinCounterChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (c?.type !== 'show-amount') return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly CoinMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  return [
    lever(RUNNING_TOTAL_LEVER, 'help', ['one_coin_short', 'one_coin_over'],
      'The learner puts in one coin too many or one too few.',
      'Shows under the tray how much the coins the learner put in make so far. Never the amount asked for.'),
    lever(VALUE_TAGS_LEVER, 'help', ['counted_coins', 'short', 'over'],
      'The learner loses track of what the coins add up to, or counts coins instead of what they are worth.',
      'Puts a small number on each coin in the tray: what the coins add up to at that coin, in the order put in.'),
    ...(smallerAmount(c) ? [lever(SMALLER_LEVER, 'simplify', ['counted_coins', 'short', 'over'],
      'The learner cannot make an amount this big yet.',
      'Opens an easier ask first, about half the amount, on an empty tray. It is not graded; the full item comes back after it.')] : []),
  ];
}

/** What the pulled help levers put on screen, for the tutor. */
export function leverFacts(c: CoinCounterChallenge | null, pulled: readonly string[]): string {
  if (c?.type !== 'show-amount') return '';
  return [
    pulled.includes(RUNNING_TOTAL_LEVER) && 'Under the tray is how much the coins put in make so far.',
    pulled.includes(VALUE_TAGS_LEVER) && 'Each coin in the tray carries a small number: what the coins add up to at that coin.',
  ].filter((s): s is string => !!s).join(' ');
}
