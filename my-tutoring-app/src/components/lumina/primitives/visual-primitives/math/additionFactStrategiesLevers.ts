/**
 * The in-item levers on addition-fact-strategies, as one lever set (`bossLevers.ts`; `/add-support-tiers`, approved
 * table qa/eval-reports/addition-fact-strategies-levers-2026-10-03.md). No real-learner or synthetic evidence: the
 * misses are what `additionFactMiss` observes, plus the source game's hint sequence and the catalog's documented
 * struggles. Declared in the order the tutor reaches for them: a lever closer to the miss comes first.
 *
 * - `known_fact` (custom; turnaround): the flipped fact with its total, the strategy itself. Answers every miss.
 * - `near_double` (layout; big facts and turnaround with addends one or two apart): the double as two equal rows of
 *   dots and the extra dots set apart, captioned "m + m and one more" with no total. Answers every miss but `addend`.
 * - `hop_strip` (marks; a smaller addend of 1-3 outside doubles): the bigger addend, then one hop per unit of the
 *   smaller. A hop shows its number only when the learner taps it, in order. Answers `one_short`, `one_over`.
 * - `count_groups` (marks; every family): the two addends as groups of the session's object; tapping one stamps its
 *   running count on it. Only objects the learner taps are numbered. Answers every miss.
 * - `smaller_fact` (easier; every family): an ungraded fact of the same family with a smaller total that is not one of
 *   this session's facts; then the full item.
 *
 * No make-ten lever for the 9s: not in the source game, and it would cross into the make-ten skill.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { AdditionFactChallenge, AdditionFactStrategy } from './AdditionFactStrategies';
import { ADDITION_FACT_MISSES } from './additionFactStrategies.card';
import { strategyPool } from './additionFactPools';
import { additionFactMode } from './additionFactStrategiesWorkspace';

export const COUNT_LEVER = 'count_groups';
export const HOP_LEVER = 'hop_strip';
export const KNOWN_LEVER = 'known_fact';
export const NEAR_LEVER = 'near_double';
export const SMALLER_LEVER = 'smaller_fact';

type C = AdditionFactChallenge;
export type SupportTier = 'easy' | 'medium' | 'hard';

const BY_MORE = ['short_by_more', 'over_by_more'];
const NEAR_MISSES = ['one_short', 'one_over', ...BY_MORE];
const NOT_DOUBLES = ['plus_zero', 'plus_one', 'turnaround', 'plus_two', 'big_facts'];

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

/** The lesson's facts, which a smaller fact never repeats. A fact's family is its `type` (contract R1). */
export interface AdditionFactLeverContext { session: readonly C[] }

export const ADDITION_FACT_LEVERS = leverSet<C, AdditionFactLeverContext>({
  modeOf: c => additionFactMode(c.type),
  missesOf: () => ADDITION_FACT_MISSES,
  specs: [
    { id: KNOWN_LEVER, type: 'custom', modes: ['turnaround'], carrier: 'shown', answers: 'all',
      why: 'It shows the flipped fact solved, which is the turn-around strategy itself: not a different item to model, '
        + 'and not words that keep the total back.',
      when: 'The learner does not use the turn-around.',
      does: 'Shows the flipped fact card: the same two numbers in the other order, with its total.',
      content: c => c.knownFact ?? null,
      fact: 'The flipped fact card is on screen: the same two numbers in the other order, with its total.' },
    { id: NEAR_LEVER, type: 'layout', modes: ['big_facts', 'turnaround'], answers: NEAR_MISSES,
      when: 'The learner cannot reach a big fact from a double it knows.',
      does: 'Draws the double as two equal rows of dots and the extra dots set apart, captioned with the double and "one more" (or "two more"). No total is written.',
      content: nearDouble,
      fact: (n: { double: number; extra: number }) => `Dots show the double ${n.double} + ${n.double} as two equal rows, and `
        + `${n.extra === 1 ? 'one more dot' : 'two more dots'} set apart. No total is written.` },
    { id: HOP_LEVER, type: 'marks', modes: NOT_DOUBLES, answers: ['one_short', 'one_over'],
      when: 'The learner counts all, or slips by one counting on.',
      does: 'Draws hops from the bigger number, one per unit of the smaller. A hop shows its number only when the learner taps it.',
      content: hopShape,
      fact: 'Hops are drawn from the bigger number, one per unit of the smaller; a hop shows its number only when the learner taps it.' },
    { id: COUNT_LEVER, type: 'marks', answers: 'all',
      when: 'The learner guesses, or answers with one of the two numbers.',
      does: 'Shows the two numbers as two groups of objects. Tapping an object numbers it; only tapped objects are numbered.',
      fact: 'The two numbers are on screen as two groups of objects; an object shows its running count only when the learner taps it.' },
    { id: SMALLER_LEVER, type: 'easier', carrier: 'shown', answers: BY_MORE,
      when: 'This fact is too big to work yet.',
      does: 'Opens a smaller fact of the same kind first. It is not graded; the full item comes back after it.',
      content: (c, { session }) => smallerFact(c.type, c, session) },
  ],
});

/** The help levers this fact offers, in order: the ones its screen can draw. */
export function helpLevers(c: C | null): string[] {
  if (!c) return [];
  return ADDITION_FACT_LEVERS.declare(c, { session: [] }, []).filter(l => l.kind === 'help').map(l => l.id);
}

/** easy starts with the objects to count on screen: a starting position, never a recorded pull. */
export function startLevers(tier: SupportTier | undefined, c: C | null): string[] {
  return tier === 'easy' && c ? [COUNT_LEVER] : [];
}

/** Leak rule, in code: the numbers a pulled help lever may print for this fact. `tapped` hops and objects are the learner's own count. */
export function leverNumbers(id: string, c: C, tappedHops = 0): number[] {
  if (id === KNOWN_LEVER) return c.knownFact ? [c.knownFact.a, c.knownFact.b, c.sum] : [];
  if (id === NEAR_LEVER) { const n = nearDouble(c); return n ? [n.double] : []; }
  if (id === HOP_LEVER) { const h = hopShape(c); return h ? Array.from({ length: tappedHops + 1 }, (_, i) => h.start + i) : []; }
  return [];
}
