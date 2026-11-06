/**
 * The workbench's magnet poles, pure: two bar magnets, what happens when two ends meet, the items code builds, and the
 * check. The 3D bench slides the right magnet up to the left one and this file says whether they snap together or
 * push apart.
 *
 * Every magnet has an N end and an S end. Different ends pull together; the same ends push apart. The learner turns the
 * right magnet, tests both ways, and then uses what happened: on other magnets (a horseshoe, a ring), or on a magnet
 * whose letters rubbed off, to say which end is which.
 */
import type { Rng, Tier } from './circuitModel';

export type Pole = 'N' | 'S';
export type PoleResult = 'pull' | 'push';
export type MagnetKind = 'bar' | 'horseshoe' | 'ring';
export const flip = (p: Pole): Pole => (p === 'N' ? 'S' : 'N');
export const poleResult = (a: Pole, b: Pole): PoleResult => (a === b ? 'push' : 'pull');

/** Two ends facing each other: one of each magnet. */
export interface PolePair { a: { kind: MagnetKind; end: Pole }; b: { kind: MagnetKind; end: Pole } }
export const pairResult = (p: PolePair) => poleResult(p.a.end, p.b.end);
const endWord = (kind: MagnetKind) => (kind === 'ring' ? 'side' : 'end');
const oneEnd = (x: PolePair['a']) => `a ${x.kind} magnet's ${x.end} ${endWord(x.kind)}`;
export const pairWords = (p: PolePair) => `${oneEnd(p.a)} facing ${oneEnd(p.b)}`;

export interface PoleChallenge {
  id: string;
  type: 'magnet_poles';
  instruction: string;
  /** The left magnet's end that faces the right magnet. It never turns. */
  aEnd: Pole;
  /** The right magnet's letters rubbed off (hard): `striped` is the real pole of its striped end. */
  mystery: boolean;
  striped?: Pole;
  /** The pairs to call without testing; none on a mystery item, where the call is which pole the striped end is. */
  toCall: PolePair[];
  /** The right magnet's real pole facing the left one when the item opens, so the first slide is not always a push. */
  bStart?: Pole;
  supportTier?: Tier;
  startLevers?: string[];
}

/** One test on the bench: the right magnet's real pole facing the left magnet, and what happened. */
export interface PoleTest { facing: Pole; result: PoleResult }
/** Calls open once the learner has seen both: the right magnet tested facing each way. */
export const testedBothWays = (tests: readonly PoleTest[]) => tests.some(t => t.result === 'pull') && tests.some(t => t.result === 'push');

export function poleInstruction(c: Pick<PoleChallenge, 'mystery' | 'toCall'>): string {
  if (c.mystery) return 'The right magnet\'s letters rubbed off, and one end has a yellow stripe. Test it against the left magnet both ways. Then: is the striped end N or S?';
  const pairs = c.toCall.map(pairWords);
  return `Turn the right magnet and slide it up to the left one, both ways. Then, without testing: ${pairs.join('; and ')}. Pull together or push apart?`;
}
export const makePoles = (id: string, aEnd: Pole, toCall: PolePair[], striped?: Pole): PoleChallenge => {
  const mystery = !!striped;
  return { id, type: 'magnet_poles', instruction: poleInstruction({ mystery, toCall }), aEnd, mystery, ...(striped ? { striped } : {}), toCall };
};

/** Fair: a mystery item has a striped pole and nothing else to call; any other item calls 1-2 pairs, and two pairs
 *  are one pull and one push. */
export function polesFair(c: Pick<PoleChallenge, 'mystery' | 'striped' | 'toCall'>): boolean {
  if (c.mystery) return (c.striped === 'N' || c.striped === 'S') && c.toCall.length === 0;
  if (c.toCall.length < 1 || c.toCall.length > 2) return false;
  return c.toCall.length === 1 || new Set(c.toCall.map(pairResult)).size === 2;
}

const pick = <T,>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)];
const pole = (rng: Rng): Pole => (rng() < 0.5 ? 'N' : 'S');

/**
 * One item. Easy: one pair of bar magnets to call, the one pair the bench cannot show (the left magnet's other end).
 * Medium: two pairs on other magnets (a horseshoe, a ring), one pull and one push. Hard: the right magnet's letters
 * rubbed off; name the striped end.
 */
export function buildPoles(tier: Tier, rng: Rng, id: string): PoleChallenge {
  return { ...buildPoleItem(tier, rng, id), bStart: pole(rng) };
}

function buildPoleItem(tier: Tier, rng: Rng, id: string): PoleChallenge {
  const aEnd = pole(rng);
  if (tier === 'hard') return makePoles(id, aEnd, [], pole(rng));
  if (tier === 'easy') {
    const other = flip(aEnd);
    const b: Pole = rng() < 0.5 ? other : aEnd;
    return makePoles(id, aEnd, [{ a: { kind: 'bar', end: other }, b: { kind: 'bar', end: b } }]);
  }
  const kinds: MagnetKind[] = ['horseshoe', 'ring'];
  const pair = (same: boolean): PolePair => {
    const k = pick(kinds, rng), end = pole(rng);
    return { a: { kind: k, end }, b: { kind: pick(['bar', ...kinds] as MagnetKind[], rng), end: same ? end : flip(end) } };
  };
  const pairs = [pair(true), pair(false)];
  return makePoles(id, aEnd, rng() < 0.5 ? pairs : pairs.reverse());
}

export function pickPoles(n: number, tier: Tier, rng: Rng, idPrefix = 'poles'): PoleChallenge[] {
  return Array.from({ length: n }, (_, i) => buildPoles(tier, rng, `${idPrefix}-${i + 1}`));
}

// ============================================================================
// The check
// ============================================================================

export interface PoleAnswer { calls: ReadonlyArray<PoleResult | null>; striped: Pole | null }
export type PoleMiss = 'like_ends_pull' | 'unlike_ends_push' | 'mystery_backwards';

export const polesMatch = (c: PoleChallenge, a: PoleAnswer) =>
  c.mystery ? a.striped === c.striped : c.toCall.every((p, i) => a.calls[i] === pairResult(p));

/** The named miss: the same ends called a pull, else different ends called a push; on a mystery item, the wrong pole. */
export function polesMiss(c: PoleChallenge, a: PoleAnswer): PoleMiss | undefined {
  if (polesMatch(c, a)) return undefined;
  if (c.mystery) return 'mystery_backwards';
  return c.toCall.some((p, i) => pairResult(p) === 'push' && a.calls[i] === 'pull') ? 'like_ends_pull' : 'unlike_ends_push';
}

export const describePoles = (c: PoleChallenge, a: PoleAnswer) => c.mystery
  ? `said the striped end is ${a.striped ?? '(no call)'}`
  : `said ${c.toCall.map((p, i) => `${pairWords(p)} would ${a.calls[i] === 'pull' ? 'pull together' : a.calls[i] === 'push' ? 'push apart' : '(no call)'}`).join(' and ')}`;

export function polesFeedback(c: PoleChallenge, a: PoleAnswer): string {
  const miss = polesMiss(c, a);
  if (!miss) return c.mystery
    ? `Yes! The striped end is ${c.striped}. You used the rule: different ends pull together, the same ends push apart.`
    : 'Yes! Different ends pull together, and the same ends push apart, on every kind of magnet.';
  if (miss === 'mystery_backwards') return `Not quite. Look at your tests: when the striped end faced the ${c.aEnd} end, did they pull or push? What does that tell you?`;
  if (miss === 'like_ends_pull') return 'Look at your tests: what happened when the same ends faced each other?';
  return 'Look at your tests: what happened when different ends faced each other?';
}
