/**
 * The in-item levers on addition-fact-strategies (`/add-support-tiers`; approved table
 * qa/eval-reports/addition-fact-strategies-levers-2026-10-03.md). No real-learner or synthetic evidence: the misses
 * are what `additionFactMiss` observes, plus the source game's hint sequence and the catalog's documented struggles.
 *
 * - `count_groups` (help, every family): the two addends as groups of the session's object; tapping one stamps its
 *   running count on it. Only objects the learner taps are numbered. Answers every miss; declared last.
 * - `hop_strip` (help, a smaller addend of 1-3 outside doubles): the bigger addend, then one hop per unit of the
 *   smaller. A hop shows its number only when the learner taps it, in order. Answers `one_short`, `one_over`.
 * - `known_fact` (help, turnaround): the flipped fact with its total, the strategy itself. Answers every miss.
 * - `near_double` (help, big facts and turnaround with addends one or two apart): the double as two equal rows of
 *   dots and the extra dots set apart, captioned "m + m and one more" with no total. Answers every miss but `addend`.
 * - `smaller_fact` (simplify, every family): an ungraded fact of the same family with a smaller total that is not
 *   one of this session's facts; then the full item.
 *
 * No make-ten lever for the 9s: not in the source game, and it would cross into the make-ten skill.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { AdditionFactChallenge, AdditionFactStrategy } from './AdditionFactStrategies';
import { strategyPool } from './additionFactPools';

export const COUNT_LEVER = 'count_groups';
export const HOP_LEVER = 'hop_strip';
export const KNOWN_LEVER = 'known_fact';
export const NEAR_LEVER = 'near_double';
export const SMALLER_LEVER = 'smaller_fact';

type C = AdditionFactChallenge;
export type SupportTier = 'easy' | 'medium' | 'hard';

const BIG: readonly AdditionFactStrategy[] = ['facts_3_4', 'facts_5_6', 'facts_7_8', 'facts_mixed'];
const BY_MORE = ['short_by_more', 'over_by_more'];
const NEAR_MISSES = ['one_short', 'one_over', ...BY_MORE];
const ALL_MISSES = ['addend', ...NEAR_MISSES];

/** Count on from the bigger addend by the smaller one, when the smaller is 1-3. */
export function hopShape(c: C): { start: number; hops: number } | null {
  const small = Math.min(c.a, c.b);
  return small >= 1 && small <= 3 ? { start: Math.max(c.a, c.b), hops: small } : null;
}

/** The double this fact is one or two more than: 7 + 8 is 7 + 7 and one more. */
export function nearDouble(c: C): { double: number; extra: number } | null {
  const lo = Math.min(c.a, c.b), extra = Math.abs(c.a - c.b);
  return lo >= 2 && (extra === 1 || extra === 2) ? { double: lo, extra } : null;
}

/** The help levers this fact offers, in order. */
export function helpLevers(strategy: AdditionFactStrategy, c: C | null): string[] {
  if (!c) return [];
  const ids: string[] = [];
  if (strategy === 'turnaround' && c.knownFact) ids.push(KNOWN_LEVER);
  if ((BIG.includes(strategy) || strategy === 'turnaround') && nearDouble(c)) ids.push(NEAR_LEVER);
  if (strategy !== 'doubles' && hopShape(c)) ids.push(HOP_LEVER);
  ids.push(COUNT_LEVER);
  return ids;
}

/** easy starts with the objects to count on screen: a starting position, never a recorded pull. */
export function startLevers(tier: SupportTier | undefined, c: C | null): string[] {
  return tier === 'easy' && c ? [COUNT_LEVER] : [];
}

const pairKey = (a: number, b: number) => (a <= b ? `${a}|${b}` : `${b}|${a}`);

/**
 * `smaller_fact`: the same family, the largest total below this fact's, never a fact (in either order) this
 * session asks, and never this fact's total. Null when the fact is already the family's smallest.
 */
export function smallerFact(strategy: AdditionFactStrategy, c: C | null, session: readonly C[]): C | null {
  if (!c) return null;
  const asked = new Set(session.map((s) => pairKey(s.a, s.b)));
  const candidates = strategyPool(strategy)
    .filter(([a, b]) => a + b < c.sum && a + b > 0 && !asked.has(pairKey(a, b)))
    // Turnaround needs a fact whose flip is a different fact.
    .filter(([a, b]) => strategy !== 'turnaround' || a !== b)
    .sort(([a1, b1], [a2, b2]) => (a2 + b2) - (a1 + b1) || a1 - a2);
  const pick = candidates[0];
  if (!pick) return null;
  const [a, b] = pick;
  return { id: `${c.id}~simpler`, type: strategy, a, b, sum: a + b, ...(strategy === 'turnaround' ? { knownFact: { a: b, b: a } } : {}) };
}

export function additionFactLevers(strategy: AdditionFactStrategy, c: C | null, pulled: readonly string[], session: readonly C[]): WorkspaceLever[] {
  if (!c) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: string[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const help = helpLevers(strategy, c).map((id) => {
    if (id === KNOWN_LEVER) return lever(id, 'help', ALL_MISSES, 'The learner does not use the turn-around.',
      'Shows the flipped fact card: the same two numbers in the other order, with its total.');
    if (id === NEAR_LEVER) return lever(id, 'help', NEAR_MISSES, 'The learner cannot reach a big fact from a double it knows.',
      'Draws the double as two equal rows of dots and the extra dots set apart, captioned with the double and "one more" (or "two more"). No total is written.');
    if (id === HOP_LEVER) return lever(id, 'help', ['one_short', 'one_over'], 'The learner counts all, or slips by one counting on.',
      'Draws hops from the bigger number, one per unit of the smaller. A hop shows its number only when the learner taps it.');
    // Declared last, so a lever closer to the miss (hops, the double, the flip) is pulled first.
    return lever(id, 'help', ALL_MISSES,
      'The learner guesses, or answers with one of the two numbers.',
      'Shows the two numbers as two groups of objects. Tapping an object numbers it; only tapped objects are numbered.');
  });
  const simplify = smallerFact(strategy, c, session)
    ? [lever(SMALLER_LEVER, 'simplify', BY_MORE, 'This fact is too big to work yet.',
      'Opens a smaller fact of the same kind first. It is not graded; the full item comes back after it.')]
    : [];
  return [...help, ...simplify];
}

/** What the pulled levers put on screen, as a scene fact. Never the total of this fact. */
export function leverFacts(strategy: AdditionFactStrategy, c: C | null, pulled: readonly string[]): string {
  if (!c) return '';
  const on = (id: string) => pulled.includes(id) && helpLevers(strategy, c).includes(id);
  const near = nearDouble(c);
  return [
    on(KNOWN_LEVER) && 'The flipped fact card is on screen: the same two numbers in the other order, with its total.',
    on(NEAR_LEVER) && near && `Dots show the double ${near.double} + ${near.double} as two equal rows, and ${near.extra === 1 ? 'one more dot' : 'two more dots'} set apart. No total is written.`,
    on(HOP_LEVER) && 'Hops are drawn from the bigger number, one per unit of the smaller; a hop shows its number only when the learner taps it.',
    on(COUNT_LEVER) && 'The two numbers are on screen as two groups of objects; an object shows its running count only when the learner taps it.',
  ].filter((s): s is string => !!s).join(' ');
}

/** Leak rule, in code: the numbers a pulled help lever may print for this fact. `tapped` hops and objects are the learner's own count. */
export function leverNumbers(id: string, c: C, tappedHops = 0): number[] {
  if (id === KNOWN_LEVER) return c.knownFact ? [c.knownFact.a, c.knownFact.b, c.sum] : [];
  if (id === NEAR_LEVER) { const n = nearDouble(c); return n ? [n.double] : []; }
  if (id === HOP_LEVER) { const h = hopShape(c); return h ? Array.from({ length: tappedHops + 1 }, (_, i) => h.start + i) : []; }
  return [];
}
