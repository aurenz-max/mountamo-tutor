/**
 * The workbench's two-bulb test (G4), pure: two bulbs to wire in a row (series) or side by side (parallel), the items
 * code builds, and the check. `circuitModel.ts` decides what lights and how brightly.
 *
 * In a row there is one path, through both bulbs: each glows dimly, and taking one out breaks the path, so the other goes
 * out too. Side by side each bulb has its own path from the battery and back: each glows brightly, and taking one out
 * leaves the other on. The learner can unscrew either bulb to test which way the circuit is wired.
 */
import { evaluate, wire, type BulbColor, type Rng, type Tier, type Wire } from './circuitModel';

export type Arrangement = 'row' | 'side_by_side';

export interface TwoBulbChallenge {
  id: string;
  type: 'two_bulbs';
  instruction: string;
  bulbs: ['red', 'blue'];
  /** How the bulbs must be wired. */
  arrangement: Arrangement;
  start: Wire[];
  maxWires: number;
  supportTier?: Tier;
  /** Help levers drawn from the start (the tier's starting position). Not a pull: nothing is recorded. */
  startLevers?: string[];
}

export function twoBulbInstruction(a: Arrangement): string {
  return a === 'row' ? 'Wire both bulbs in a row, so there is one path through both of them.'
    : 'Wire both bulbs side by side, so each bulb has its own path to the battery.';
}

export function makeTwoBulb(id: string, arrangement: Arrangement, start: Wire[]): TwoBulbChallenge {
  return { id, type: 'two_bulbs', instruction: twoBulbInstruction(arrangement), bulbs: ['red', 'blue'], arrangement, start, maxWires: 5 };
}

const BULBS: BulbColor[] = ['red', 'blue'];
const ROW: Wire[] = [wire('bat+', 'red.left'), wire('red.right', 'blue.left'), wire('blue.right', 'bat-')];
const SIDE: Wire[] = [wire('bat+', 'red.left'), wire('bat+', 'blue.left'), wire('red.right', 'bat-'), wire('blue.right', 'bat-')];

/** How the wires join the bulbs: both lit, and whether each stays on when the other is taken out. */
export function arrangementOf(wires: readonly Wire[]): Arrangement | null {
  const s = evaluate(BULBS, wires);
  if (s.short || s.lit.length !== 2) return null;
  const redAlone = evaluate(BULBS, wires, { burnt: ['blue'] }).lit.includes('red');
  const blueAlone = evaluate(BULBS, wires, { burnt: ['red'] }).lit.includes('blue');
  if (redAlone && blueAlone) return 'side_by_side';
  if (!redAlone && !blueAlone) return 'row';
  return null;
}

/**
 * Every start a tier allows. Easy: in a row, the first wire on. Medium: side by side, nothing on. Hard: wired the
 * other way already, both lit: the learner must rewire it.
 */
export function twoBulbStarts(tier: Tier): Array<{ arrangement: Arrangement; start: Wire[] }> {
  if (tier === 'easy') return [{ arrangement: 'row', start: [ROW[0]] }, { arrangement: 'row', start: [ROW[2]] }];
  if (tier === 'medium') return [{ arrangement: 'side_by_side', start: [] }, { arrangement: 'side_by_side', start: [SIDE[0]] }];
  return [{ arrangement: 'side_by_side', start: ROW }, { arrangement: 'row', start: SIDE }];
}

export function pickTwoBulbs(n: number, tier: Tier, rng: Rng, idPrefix = 'two'): TwoBulbChallenge[] {
  const pool = twoBulbStarts(tier);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return Array.from({ length: n }, (_, i) => makeTwoBulb(`${idPrefix}-${i + 1}`, pool[i % pool.length].arrangement, pool[i % pool.length].start));
}

// ============================================================================
// The check
// ============================================================================

export type TwoBulbMiss = 'short_circuit' | 'not_both_lit' | 'made_a_row' | 'made_side_by_side';

export const twoBulbMatches = (c: TwoBulbChallenge, wires: readonly Wire[]) => arrangementOf(wires) === c.arrangement;

export function twoBulbMiss(c: TwoBulbChallenge, wires: readonly Wire[]): TwoBulbMiss | undefined {
  if (twoBulbMatches(c, wires)) return undefined;
  const s = evaluate(BULBS, wires);
  if (s.short) return 'short_circuit';
  const a = arrangementOf(wires);
  if (a === 'row') return 'made_a_row';
  if (a === 'side_by_side') return 'made_side_by_side';
  return 'not_both_lit';
}

export function twoBulbFeedback(c: TwoBulbChallenge, wires: readonly Wire[]): string {
  const miss = twoBulbMiss(c, wires);
  if (!miss) {
    return c.arrangement === 'row'
      ? 'In a row! There is one path through both bulbs, so they share the push and glow dimly. Take one out and the path breaks: both go out.'
      : 'Side by side! Each bulb has its own path, so each glows brightly. Take one out and the other stays on.';
  }
  if (miss === 'short_circuit') return 'Nothing lights and the battery gets warm: a wire lets the electricity skip the bulbs.';
  if (miss === 'not_both_lit') return 'Not both bulbs are lit. Follow each path from the battery and back.';
  if (miss === 'made_a_row') return 'Both light, but they are in a row: take one out and the other goes out too. Can each bulb get its own path?';
  return 'Both light, but each has its own path: take one out and the other stays on. Can you make one path through both?';
}
