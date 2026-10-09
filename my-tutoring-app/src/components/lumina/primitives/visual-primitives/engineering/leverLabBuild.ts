/**
 * Lever Lab open builds (`/add-eval-modes` references/build-mode.md). Pure: the generator, the component and vitest
 * share it.
 *
 * - `build_balance`: code seats a kid (or two) on the left of a seesaw that is held still by blocks. The learner
 *   seats kids of their choosing on the right, then presses "I'm done!": the blocks come away and the seesaw tips or
 *   stays level. Any seating whose turning effect (weight x distance from the middle) matches the left passes, so a
 *   heavy kid near the middle and two light kids far out both pass. A "different way" item repeats the left side and
 *   refuses the seating that passed before.
 * - `build_lift`: a rock sits on the left end of a bar. The learner puts the fulcrum under the bar and the helper (a
 *   kid lighter than the rock, which caps the effort) on it. It lifts when the helper is across the fulcrum from the
 *   rock and helper weight x distance >= rock weight x distance. A "different way" item asks for a new fulcrum spot.
 *
 * The torque rule is the one the sandbox has always used (`torquesAbout`, |L - R| < 0.1 is level).
 */

export type LeverBuildMode = 'build_balance' | 'build_lift';
export const LEVER_BUILD_MODES: readonly LeverBuildMode[] = ['build_balance', 'build_lift'];
export type LeverBand = 'K-2' | '3-5';

/** A kid on the seesaw. `seat` is signed distance from the middle: -5..-1 on the left, 1..5 on the right. */
export interface SeatedKid { seat: number; weight: number; icon: string }

export interface LeverBuildChallenge {
  id: string;
  type: LeverBuildMode;
  instruction: string;
  /** build_balance: the kids code seats on the left; the learner cannot move them. */
  given?: SeatedKid[];
  /** build_balance: the kid weights the learner can seat (one kid per seat, right side only). */
  palette?: number[];
  /** build_lift: the rock's weight; it sits at the left end of the bar (position 0). */
  rockWeight?: number;
  /** build_lift: the helper's weight. Lighter than the rock: the cap on the effort. */
  pusherWeight?: number;
  /** The id of an earlier item; this build must not repeat the one that passed there. */
  differentFrom?: string;
}

/** Seats per side of the seesaw. */
export const SEATS = 5;
/** The lift bar's marks run 0..LIFT_BAR; the rock is at 0, the fulcrum can go at 1..LIFT_BAR-1. */
export const LIFT_BAR = 10;
/** Kids the learner may seat on one item (there are five seats). */
export const MAX_SEATED = 4;

// ---------------------------------------------------------------------------
// Torque (lifted from the LeverLab sandbox's inline calculateTorques)
// ---------------------------------------------------------------------------

export interface PointLoad { position: number; weight: number }
export interface Torques { left: number; right: number }

/** Sum of weight x distance on each side of the fulcrum. A load on the fulcrum turns nothing. */
export function torquesAbout(loads: readonly PointLoad[], fulcrum: number): Torques {
  let left = 0, right = 0;
  for (const l of loads) {
    const d = l.position - fulcrum;
    if (d < 0) left += l.weight * -d;
    else if (d > 0) right += l.weight * d;
  }
  return { left, right };
}

export const BALANCE_TOLERANCE = 0.1;
export function isBalanced(t: Torques): boolean {
  return Math.abs(t.left - t.right) < BALANCE_TOLERANCE;
}

// ---------------------------------------------------------------------------
// Judges
// ---------------------------------------------------------------------------

export type BalanceMiss = 'left_down' | 'right_down' | 'same_way';
export type LiftMiss = 'same_side' | 'too_weak' | 'same_way';
export type LeverMiss = BalanceMiss | LiftMiss;

export const LEVER_MISSES: Record<LeverBuildMode, readonly LeverMiss[]> = {
  build_balance: ['left_down', 'right_down', 'same_way'],
  build_lift: ['same_side', 'too_weak', 'same_way'],
};

/** `tilt`: -1 the left end goes down, 0 level, 1 the right end goes down (the rock end comes up on a lift). */
export interface LeverVerdict { pass: boolean; miss: LeverMiss | null; tilt: -1 | 0 | 1 }

/** One seating, order-free: what "the same way" compares. */
export function seatingKey(placed: readonly SeatedKid[]): string {
  return placed.map(k => `${k.seat}:${k.weight}`).sort().join('|');
}

export function judgeBalance(given: readonly SeatedKid[], placed: readonly SeatedKid[], previousKey?: string): LeverVerdict {
  const t = torquesAbout([...given, ...placed].map(k => ({ position: k.seat, weight: k.weight })), 0);
  if (!isBalanced(t)) return t.left > t.right ? { pass: false, miss: 'left_down', tilt: -1 } : { pass: false, miss: 'right_down', tilt: 1 };
  if (previousKey !== undefined && seatingKey(placed) === previousKey) return { pass: false, miss: 'same_way', tilt: 0 };
  return { pass: true, miss: null, tilt: 0 };
}

export interface LiftBuild { fulcrum: number | null; pusherAt: number | null }

/** Null when the build is not ready to check (no fulcrum or no helper). */
export function judgeLift(rockWeight: number, pusherWeight: number, build: LiftBuild, previousFulcrum?: number): LeverVerdict | null {
  const { fulcrum, pusherAt } = build;
  if (fulcrum === null || pusherAt === null || pusherAt === fulcrum) return null;
  if (pusherAt < fulcrum) return { pass: false, miss: 'same_side', tilt: -1 };
  const t = torquesAbout([{ position: 0, weight: rockWeight }, { position: pusherAt, weight: pusherWeight }], fulcrum);
  if (t.right < t.left) return { pass: false, miss: 'too_weak', tilt: -1 };
  if (previousFulcrum !== undefined && previousFulcrum === fulcrum) return { pass: false, miss: 'same_way', tilt: 1 };
  return { pass: true, miss: null, tilt: 1 };
}

/** What the scene says after a miss. It names what happened, never which kid to seat or where to put the fulcrum. */
export const LEVER_MISS_WORDS: Record<LeverBuildMode, Partial<Record<LeverMiss, string>>> = {
  build_balance: {
    left_down: 'The seesaw tipped down on the left side. It is not level yet.',
    right_down: 'The seesaw tipped down on the right side. It is not level yet.',
    same_way: 'It is level, but that is the same way as last time. Find a different way.',
  },
  build_lift: {
    same_side: 'The helper is on the same side of the fulcrum as the rock, so the rock stayed down.',
    too_weak: 'The rock stayed down. The helper could not turn the bar far enough.',
    same_way: 'The rock went up, but the fulcrum is in the same place as last time. Find a different place.',
  },
};

export const LEVER_PASS_WORDS: Record<LeverBuildMode, string> = {
  build_balance: 'Yes! The blocks came away and the seesaw stayed level.',
  build_lift: 'Yes! The helper lifted the rock.',
};

// ---------------------------------------------------------------------------
// How many builds pass (generator side: a target is used only when many makes pass)
// ---------------------------------------------------------------------------

/** Every right-side seating (at most `maxKids`, one kid per seat, weights from `palette`) that levels `target`. */
export function balanceSeatings(target: number, palette: readonly number[], maxKids = MAX_SEATED): SeatedKid[][] {
  const out: SeatedKid[][] = [];
  const walk = (seat: number, sum: number, kids: SeatedKid[]) => {
    if (sum > target) return;
    if (seat > SEATS) { if (sum === target && kids.length) out.push(kids); return; }
    walk(seat + 1, sum, kids);
    if (kids.length >= maxKids) return;
    for (const w of palette) walk(seat + 1, sum + w * seat, [...kids, { seat, weight: w, icon: '' }]);
  };
  walk(1, 0, []);
  return out;
}

/** Fulcrum spots (1..LIFT_BAR-1) where some helper seat lifts the rock. */
export function liftFulcrums(rockWeight: number, pusherWeight: number): number[] {
  const out: number[] = [];
  for (let f = 1; f < LIFT_BAR; f++) if (pusherWeight * (LIFT_BAR - f) >= rockWeight * f) out.push(f);
  return out;
}

// ---------------------------------------------------------------------------
// Targets and asks (code owns them; the model never writes a weight or a seat)
// ---------------------------------------------------------------------------

export function leverBand(grade?: string, gradeContext = ''): LeverBand {
  const g = (grade ?? '').toUpperCase();
  if (g === 'K' || g === '1' || g === '2') return 'K-2';
  if (/^\d+$/.test(g)) return '3-5';
  return /kinder|pre-?k|toddler|preschool|grade ?[12]\b|first|second/i.test(gradeContext) ? 'K-2' : '3-5';
}

export const PALETTE: Record<LeverBand, number[]> = { 'K-2': [1, 2, 3, 4], '3-5': [1, 2, 3, 4, 5] };
const KID_ICONS = ['🧒', '👧', '👦', '🧑'];

/** Left sides per band, easiest first. Each levels many right-side seatings (checked in vitest). */
export const BALANCE_LEFT: Record<LeverBand, ReadonlyArray<ReadonlyArray<[number, number]>>> = {
  // [seat, weight]
  'K-2': [[[-2, 2]], [[-3, 2]], [[-2, 3]], [[-4, 2]], [[-3, 3]], [[-2, 4]], [[-4, 3]]],
  '3-5': [[[-3, 3]], [[-4, 3]], [[-3, 4]], [[-4, 4]], [[-2, 5], [-4, 1]], [[-3, 4], [-1, 3]], [[-5, 3], [-2, 2]], [[-4, 4], [-2, 2]]],
};

/** [rock, helper] per band, easiest first: the helper is always lighter, and at least two fulcrum spots lift it. */
export const LIFT_PAIRS: Record<LeverBand, ReadonlyArray<[number, number]>> = {
  'K-2': [[3, 2], [4, 2], [3, 1], [6, 3]],
  '3-5': [[4, 2], [6, 3], [6, 2], [5, 2], [8, 3], [9, 4], [8, 2]],
};

const describeLeft = (given: readonly SeatedKid[]) => given.length === 1 ? 'A kid sits on the left' : 'Two kids sit on the left';

export function balanceInstruction(given: readonly SeatedKid[], again: boolean): string {
  return again
    ? `Balance it a different way. ${describeLeft(given)} again. Seat kids on the right in a new way so the seesaw stays level.`
    : `Make the seesaw balance. ${describeLeft(given)}. Seat kids on the right so the seesaw stays level when the blocks come away.`;
}

export function liftInstruction(rockWeight: number, pusherWeight: number, again: boolean): string {
  return again
    ? 'Lift the rock again, with the fulcrum in a different place.'
    : `Build a lever that lifts the rock. The rock weighs ${rockWeight} and the helper weighs ${pusherWeight}. `
      + 'Put the fulcrum under the bar, then put the helper on the bar.';
}

function pickDistinct<T>(pool: readonly T[], n: number, rand: () => number): T[] {
  // A random subset, kept in pool order so the session runs easiest first.
  const idx = pool.map((_, i) => i).sort(() => rand() - 0.5).slice(0, Math.min(n, pool.length)).sort((a, b) => a - b);
  return idx.map(i => pool[i]);
}

/**
 * A session: each mode gives a pair (a build, then the same target "a different way"); a single-mode session adds a
 * third item on a new target, so the learner meets two targets.
 */
export function leverChallenges(modes: readonly LeverBuildMode[], band: LeverBand, rand: () => number = Math.random): LeverBuildChallenge[] {
  const out: LeverBuildChallenge[] = [];
  const targets = modes.length === 1 ? 2 : 1;
  let n = 0;
  for (const mode of modes) {
    if (mode === 'build_balance') {
      const lefts = pickDistinct(BALANCE_LEFT[band], targets, rand);
      lefts.forEach((left, t) => {
        let iconAt = Math.floor(rand() * KID_ICONS.length);
        const given = left.map(([seat, weight]) => ({ seat, weight, icon: KID_ICONS[iconAt++ % KID_ICONS.length] }));
        const first: LeverBuildChallenge = { id: `lever-${n++}`, type: mode, instruction: balanceInstruction(given, false), given, palette: PALETTE[band] };
        out.push(first);
        if (t === 0) out.push({ ...first, id: `lever-${n++}`, instruction: balanceInstruction(given, true), differentFrom: first.id });
      });
    } else {
      pickDistinct(LIFT_PAIRS[band], targets, rand).forEach(([rockWeight, pusherWeight], t) => {
        const first: LeverBuildChallenge = { id: `lever-${n++}`, type: mode, instruction: liftInstruction(rockWeight, pusherWeight, false), rockWeight, pusherWeight };
        out.push(first);
        if (t === 0) out.push({ ...first, id: `lever-${n++}`, instruction: liftInstruction(rockWeight, pusherWeight, true), differentFrom: first.id });
      });
    }
  }
  return out;
}

/** The left side's turning effect a balance item asks the learner to match. */
export function balanceTarget(c: LeverBuildChallenge): number {
  return torquesAbout((c.given ?? []).map(k => ({ position: k.seat, weight: k.weight })), 0).left;
}

/** Seat words for the watcher's `made` facts: where, never how far in numbers. */
export function spotWord(distance: number, max: number): string {
  return distance <= max * 0.35 ? 'near the middle' : distance >= max * 0.8 ? 'at the far end' : 'partway out';
}

export function sizeWord(weight: number): string {
  return weight <= 1 ? 'a little kid' : weight <= 3 ? 'a kid' : 'a big kid';
}
