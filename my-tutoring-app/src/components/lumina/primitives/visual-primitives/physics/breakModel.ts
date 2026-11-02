/**
 * The workbench's find-the-break test, pure: a device wired as a closed loop that stays dark because one part is broken
 * (a dead battery, a burnt-out bulb, or a wire whose clip came off), the fixes the learner can try one at a time, the
 * items code builds, and the check. `circuitModel.ts` decides what lights, with the faults left after the fixes.
 *
 * Testing one part at a time is how you find the break: swap the battery and watch; if it is still dark, the battery
 * was fine. A burnt-out bulb and a dead battery look the same from outside; only a test tells them apart. Two bulbs in
 * a row both go dark when either one burns out, because the loop is broken there.
 */
import {
  bulbName, evaluate, wire, type BulbColor, type Faults, type Rng, type Tier, type Wire,
} from './circuitModel';

export type BreakKind = 'dead_battery' | 'burnt_bulb' | 'loose_wire';
/** What the learner can name as broken. */
export type BrokenPart = 'battery' | `bulb:${BulbColor}` | 'wire';
/** A fix the learner tries: a fresh battery, a fresh bulb, or the loose clip put back on. */
export type BreakFix = 'battery' | `bulb:${BulbColor}` | 'clip';

export interface BreakChallenge {
  id: string;
  type: 'find_the_break';
  instruction: string;
  /** One bulb, or two in a row (red, then blue). */
  bulbs: BulbColor[];
  /** The device's wires: a closed loop through every bulb. */
  wires: Wire[];
  fault: { kind: BreakKind; bulb?: BulbColor; wire?: number };
  supportTier?: Tier;
  /** Help levers drawn from the start (the tier's starting position). Not a pull: nothing is recorded. */
  startLevers?: string[];
}

export const loopFor = (bulbs: readonly BulbColor[]): Wire[] => (bulbs.length === 1
  ? [wire('bat+', 'red.left'), wire('red.right', 'bat-')]
  : [wire('bat+', 'red.left'), wire('red.right', 'blue.left'), wire('blue.right', 'bat-')]);

export const brokenPart = (c: BreakChallenge): BrokenPart =>
  (c.fault.kind === 'dead_battery' ? 'battery' : c.fault.kind === 'loose_wire' ? 'wire' : `bulb:${c.fault.bulb!}`);

/** The fix that mends the fault. */
const fixFor = (c: BreakChallenge): BreakFix => (c.fault.kind === 'loose_wire' ? 'clip' : brokenPart(c) as BreakFix);

/** The wires on the table and the faults left after the fixes tried so far. */
export function breakState(c: BreakChallenge, fixes: readonly BreakFix[]): { wires: Wire[]; faults: Faults } {
  const mended = fixes.includes(fixFor(c));
  const loose = c.fault.kind === 'loose_wire' && !mended;
  return {
    wires: loose ? c.wires.filter((_, i) => i !== c.fault.wire) : c.wires,
    faults: mended ? {} : c.fault.kind === 'dead_battery' ? { deadBattery: true } : c.fault.kind === 'burnt_bulb' ? { burnt: [c.fault.bulb!] } : {},
  };
}
export const breakLit = (c: BreakChallenge, fixes: readonly BreakFix[]): BulbColor[] => {
  const s = breakState(c, fixes);
  return evaluate(c.bulbs, s.wires, s.faults).lit;
};
export const allLit = (c: BreakChallenge, fixes: readonly BreakFix[]) => breakLit(c, fixes).length === c.bulbs.length;

export function breakInstruction(bulbs: readonly BulbColor[]): string {
  return bulbs.length === 1 ? 'This light should turn on, but it stays dark. Find what is broken and fix it.'
    : 'Both bulbs should light, but they stay dark. Find what is broken and fix it.';
}

export function makeBreak(id: string, bulbs: BulbColor[], fault: BreakChallenge['fault']): BreakChallenge {
  return { id, type: 'find_the_break', instruction: breakInstruction(bulbs), bulbs, wires: loopFor(bulbs), fault };
}

/**
 * Every item a tier allows. Easy: a wire's clip came off (you can see it). Medium: a dead battery or a burnt-out bulb
 * (they look fine; only a test tells). Hard: two bulbs in a row, both dark: a dead battery or either bulb burnt out.
 */
export function breakCandidates(tier: Tier): Array<{ bulbs: BulbColor[]; fault: BreakChallenge['fault'] }> {
  if (tier === 'easy') return [0, 1].map(w => ({ bulbs: ['red'] as BulbColor[], fault: { kind: 'loose_wire' as const, wire: w } }));
  if (tier === 'medium') return [{ bulbs: ['red'], fault: { kind: 'dead_battery' } }, { bulbs: ['red'], fault: { kind: 'burnt_bulb', bulb: 'red' } }];
  const two: BulbColor[] = ['red', 'blue'];
  return [{ bulbs: two, fault: { kind: 'dead_battery' } }, { bulbs: two, fault: { kind: 'burnt_bulb', bulb: 'red' } },
    { bulbs: two, fault: { kind: 'burnt_bulb', bulb: 'blue' } }];
}

/** N items: each kind of break in turn (shuffled), so a session is not all one fault. */
export function pickBreaks(n: number, tier: Tier, rng: Rng, idPrefix = 'break'): BreakChallenge[] {
  const pool = [...breakCandidates(tier)];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return Array.from({ length: n }, (_, i) => makeBreak(`${idPrefix}-${i + 1}`, pool[i % pool.length].bulbs, pool[i % pool.length].fault));
}

// ============================================================================
// The check
// ============================================================================

export type BreakMiss = 'still_dark' | 'wrong_part_named';

export interface BreakAnswer { fixes: readonly BreakFix[]; claim: BrokenPart | null }

/** It lights again, and the learner names the part that was broken. */
export const breakMatches = (c: BreakChallenge, a: BreakAnswer): boolean => allLit(c, a.fixes) && a.claim === brokenPart(c);

export function breakMiss(c: BreakChallenge, a: BreakAnswer): BreakMiss | undefined {
  if (breakMatches(c, a)) return undefined;
  return allLit(c, a.fixes) ? 'wrong_part_named' : 'still_dark';
}

export function partWords(c: { bulbs: readonly BulbColor[] }, p: BrokenPart): string {
  if (p === 'battery') return 'the battery';
  if (p === 'wire') return 'a wire that came off its clip';
  return bulbName(c, p.slice(5) as BulbColor);
}
export function fixWords(c: { bulbs: readonly BulbColor[] }, f: BreakFix): string {
  if (f === 'battery') return 'put in a new battery';
  if (f === 'clip') return 'pushed every clip on tight';
  return `put in a new ${c.bulbs.length === 1 ? 'bulb' : `${f.slice(5)} bulb`}`;
}

/** The learner's tries and claim in words, never which part was broken. */
export const describeBreak = (c: BreakChallenge, a: BreakAnswer): string =>
  `${a.fixes.length ? a.fixes.map(f => fixWords(c, f)).join(', then ') : 'tried no fixes'}; `
  + `${allLit(c, a.fixes) ? 'it lights' : 'it is still dark'}; said the broken part was ${a.claim ? partWords(c, a.claim) : 'nothing yet'}`;

export function breakFeedback(c: BreakChallenge, a: BreakAnswer): string {
  const miss = breakMiss(c, a);
  if (!miss) return `You found it: ${partWords(c, brokenPart(c))} was broken. You tested one part at a time, so you could tell which one.`;
  if (miss === 'still_dark') return 'It is still dark, so something is still broken. Try one part at a time and watch what happens.';
  return 'It lights now! Look at your tests: which change made it light?';
}
