/**
 * The workbench's magnet strength against distance, pure: a bar magnet at one end of a ruler, a steel ball on one of its
 * marks, the items code builds, and the check. The 3D bench rolls the ball to the magnet when the magnet pulls it.
 *
 * A magnet pulls harder the closer a thing is. Each magnet has a reach: it pulls the ball from that mark or closer and
 * not from farther. The learner tries the ball near and far, then finds the reach (easy), uses the rule on another
 * magnet without testing (medium), or finds which of two magnets is stronger, where the small one can be (hard).
 */
import type { Rng, Tier } from './circuitModel';

/** The ruler's marks, 1 (next to the magnet) to MARKS (the far end). Every reach is 1..MARKS-1, so the far end never
 *  pulls and mark 1 always does: a learner can always see both. */
export const MARKS = 6;
export type MagnetSize = 'small' | 'big';
export interface DistMagnet { size: MagnetSize; reach: number }
export const pullsAt = (m: DistMagnet, mark: number) => mark <= m.reach;

/** A call on another magnet, without testing: it did (or did not) pull a ball on `known`; would it pull one on `ask`?
 *  `ask` is always on the side the rule decides (nearer than a pull, or farther than a miss). */
export interface DistCall { known: number; knownPull: boolean; ask: number }
export const callAnswer = (c: DistCall) => c.knownPull;
export const callWords = (c: DistCall) =>
  `Another magnet ${c.knownPull ? 'pulled' : 'did not pull'} a ball on mark ${c.known}. Would it pull a ball on mark ${c.ask}?`;

export type DistAsk = 'reach' | 'calls' | 'stronger';
export interface DistanceChallenge {
  id: string;
  type: 'magnet_distance';
  instruction: string;
  ask: DistAsk;
  /** One magnet, or two (stronger: one small and one big, each on its own ruler). */
  magnets: DistMagnet[];
  /** The calls on another magnet (ask 'calls'); none otherwise. */
  toCall: DistCall[];
  /** Each ball's mark when the item opens (2..MARKS-1), so the first try is a real guess and not always near or far. */
  ballStart?: number[];
  supportTier?: Tier;
  startLevers?: string[];
}

/** One test on the bench: which magnet, the ball's mark, and whether it rolled to the magnet. */
export interface DistTest { magnet: number; mark: number; pulled: boolean }
/** The question opens once every magnet has been tried and the learner has seen a pull and a miss. */
export const readyToDecide = (c: Pick<DistanceChallenge, 'magnets'>, tests: readonly DistTest[]) =>
  c.magnets.every((_, i) => tests.some(t => t.magnet === i)) && tests.some(t => t.pulled) && tests.some(t => !t.pulled);

export const magnetName = (c: Pick<DistanceChallenge, 'magnets'>, i: number) => (c.magnets.length > 1 ? `the ${c.magnets[i].size} magnet` : 'the magnet');
export const strongest = (c: Pick<DistanceChallenge, 'magnets'>) => (c.magnets.length > 1 && c.magnets[1].reach > c.magnets[0].reach ? 1 : 0);

export function distanceInstruction(ask: DistAsk): string {
  if (ask === 'reach') return 'Put the steel ball on a mark and try the magnet: does it pull the ball? Try near and far. What is the farthest mark the magnet pulls the ball from?';
  if (ask === 'calls') return 'Try the magnet with the ball near and far. Then decide about another magnet, without testing.';
  return 'Two magnets, a small one and a big one. Try each with its ball near and far. Which magnet is stronger?';
}
export const makeDistance = (id: string, ask: DistAsk, magnets: DistMagnet[], toCall: DistCall[] = []): DistanceChallenge =>
  ({ id, type: 'magnet_distance', instruction: distanceInstruction(ask), ask, magnets, toCall });

/** Fair: reaches in 1..MARKS-1; reach and calls items have one magnet, a stronger item two of different sizes and
 *  reaches; calls are 1-2 on the side the rule decides, two being one pull and one miss. */
export function distanceFair(c: Pick<DistanceChallenge, 'ask' | 'magnets' | 'toCall'>): boolean {
  const reachOk = (m: DistMagnet) => Number.isInteger(m.reach) && m.reach >= 1 && m.reach < MARKS && (m.size === 'small' || m.size === 'big');
  if (!c.magnets.every(reachOk)) return false;
  if (c.ask === 'stronger') return c.magnets.length === 2 && c.magnets[0].size !== c.magnets[1].size && c.magnets[0].reach !== c.magnets[1].reach && !c.toCall.length;
  if (c.magnets.length !== 1) return false;
  if (c.ask === 'reach') return !c.toCall.length;
  const decided = (k: DistCall) => k.known >= 1 && k.known <= MARKS && k.ask >= 1 && k.ask <= MARKS && (k.knownPull ? k.ask < k.known : k.ask > k.known);
  if (c.toCall.length < 1 || c.toCall.length > 2 || !c.toCall.every(decided)) return false;
  return c.toCall.length === 1 || c.toCall[0].knownPull !== c.toCall[1].knownPull;
}

const int = (lo: number, hi: number, rng: Rng) => lo + Math.floor(rng() * (hi - lo + 1));
const size = (rng: Rng): MagnetSize => (rng() < 0.5 ? 'small' : 'big');

/**
 * One item. Easy: find one magnet's reach. Medium: test one magnet, then two calls on another (one nearer than a pull,
 * one farther than a miss). Hard: a small and a big magnet; half the time the small one is stronger.
 */
export function buildDistance(tier: Tier, rng: Rng, id: string): DistanceChallenge {
  const c = buildDistanceItem(tier, rng, id);
  return { ...c, ballStart: c.magnets.map(() => int(2, MARKS - 1, rng)) };
}

function buildDistanceItem(tier: Tier, rng: Rng, id: string): DistanceChallenge {
  if (tier === 'easy') return makeDistance(id, 'reach', [{ size: size(rng), reach: int(2, MARKS - 1, rng) }]);
  if (tier === 'medium') {
    const pullKnown = int(2, MARKS, rng), missKnown = int(2, MARKS - 1, rng);
    const calls: DistCall[] = [
      { known: pullKnown, knownPull: true, ask: int(1, pullKnown - 1, rng) },
      { known: missKnown, knownPull: false, ask: int(missKnown + 1, MARKS, rng) },
    ];
    return makeDistance(id, 'calls', [{ size: size(rng), reach: int(2, MARKS - 1, rng) }], rng() < 0.5 ? calls : calls.reverse());
  }
  const weak = int(1, MARKS - 2, rng), strong = int(weak + 1, MARKS - 1, rng);
  const smallStronger = rng() < 0.5;
  const magnets: DistMagnet[] = [{ size: 'small', reach: smallStronger ? strong : weak }, { size: 'big', reach: smallStronger ? weak : strong }];
  return makeDistance(id, 'stronger', rng() < 0.5 ? magnets : magnets.reverse());
}

export function pickDistance(n: number, tier: Tier, rng: Rng, idPrefix = 'distance'): DistanceChallenge[] {
  return Array.from({ length: n }, (_, i) => buildDistance(tier, rng, `${idPrefix}-${i + 1}`));
}

// ============================================================================
// The check
// ============================================================================

export interface DistAnswer { reach: number | null; calls: ReadonlyArray<boolean | null>; stronger: number | null }
export type DistMiss = 'reach_too_far' | 'reach_too_near' | 'farther_pulled' | 'nearer_not_pulled' | 'judged_by_size' | 'picked_weaker';

export function distanceMatch(c: DistanceChallenge, a: DistAnswer): boolean {
  if (c.ask === 'reach') return a.reach === c.magnets[0].reach;
  if (c.ask === 'calls') return c.toCall.every((k, i) => a.calls[i] === callAnswer(k));
  return a.stronger === strongest(c);
}

/** The named miss. Reach: past it, else short of it. Calls: a ball farther than a miss called pulled, else a ball nearer
 *  than a pull called not pulled. Stronger: the big magnet picked when the small one is stronger, else the weaker one. */
export function distanceMiss(c: DistanceChallenge, a: DistAnswer): DistMiss | undefined {
  if (distanceMatch(c, a)) return undefined;
  if (c.ask === 'reach') return (a.reach ?? 0) > c.magnets[0].reach ? 'reach_too_far' : 'reach_too_near';
  if (c.ask === 'calls') return c.toCall.some((k, i) => !k.knownPull && a.calls[i] === true) ? 'farther_pulled' : 'nearer_not_pulled';
  return a.stronger !== null && c.magnets[a.stronger]?.size === 'big' ? 'judged_by_size' : 'picked_weaker';
}

export function describeDistance(c: DistanceChallenge, a: DistAnswer): string {
  if (c.ask === 'reach') return `said the farthest mark the magnet pulls the ball from is ${a.reach ?? '(no answer)'}`;
  if (c.ask === 'calls') return `said ${c.toCall.map((k, i) => `${a.calls[i] === null ? '(no call)' : a.calls[i] ? 'yes' : 'no'} to "${callWords(k)}"`).join(' and ')}`;
  return `said ${a.stronger === null ? '(no pick)' : magnetName(c, a.stronger)} is stronger`;
}

export function distanceFeedback(c: DistanceChallenge, a: DistAnswer): string {
  const miss = distanceMiss(c, a);
  if (!miss) {
    if (c.ask === 'reach') return `Yes! It pulls the ball from mark ${c.magnets[0].reach} or closer, and not from farther away. The closer the ball, the stronger the pull.`;
    if (c.ask === 'calls') return 'Yes! The closer the ball, the stronger the pull: if a magnet pulls from one mark it pulls from closer too, and if it cannot pull from one mark it cannot pull from farther.';
    const s = c.magnets[strongest(c)];
    return `Yes! The ${s.size} magnet pulls the ball from farther away, so it is stronger.${s.size === 'small' ? ' A magnet\'s size does not tell you how strong it is.' : ''}`;
  }
  if (miss === 'reach_too_far') return 'Look at your tests: did the magnet pull the ball from that mark? Try it.';
  if (miss === 'reach_too_near') return 'Look at your tests: did the magnet pull the ball from a mark farther away than that?';
  if (miss === 'farther_pulled') return 'If a magnet cannot pull a ball from one mark, can it pull a ball that is even farther away?';
  if (miss === 'nearer_not_pulled') return 'If a magnet pulls a ball from one mark, what about a ball that is closer to it?';
  if (miss === 'judged_by_size') return 'Bigger is not always stronger. Look at your tests: which magnet pulled the ball from farther away?';
  return 'Look at your tests: which magnet pulled the ball from farther away?';
}
