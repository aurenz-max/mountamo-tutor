/**
 * The workbench's add-a-switch test, pure: a battery, a bulb and a switch on the table, the wires already on, the items
 * code builds, and the check. `circuitModel.ts` decides what lights with the switch on (closed: its clips joined) and
 * off (open).
 *
 * A switch works by opening and closing the loop: put in the loop, it turns the bulb on and off. Wired beside the bulb
 * it does the opposite: the bulb is on while the switch is off, and turning it on lets the electricity skip the bulb
 * (a short circuit). A switch that is not in the loop at all does nothing.
 */
import { evaluate, wire, wireWords, type Rng, type Tier, type Wire } from './circuitModel';

export interface SwitchChallenge {
  id: string;
  type: 'add_a_switch';
  instruction: string;
  bulbs: ['red'];
  /** The wires on when the item opens. They never make a working switch. */
  start: Wire[];
  maxWires: number;
  supportTier?: Tier;
  /** Help levers drawn from the start (the tier's starting position). Not a pull: nothing is recorded. */
  startLevers?: string[];
}

export const SWITCH_INSTRUCTION = 'Wire the switch so it turns the bulb on and off.';

export function makeSwitch(id: string, start: Wire[]): SwitchChallenge {
  return { id, type: 'add_a_switch', instruction: SWITCH_INSTRUCTION, bulbs: ['red'], start, maxWires: 4 };
}

/** What the table does with the switch off and on. */
export function switchStates(wires: readonly Wire[]) {
  return { off: evaluate(['red'], wires, { switchClosed: false }), on: evaluate(['red'], wires, { switchClosed: true }) };
}

/** The goal: on lights the bulb, off leaves it dark, and nothing is shorted either way. */
export function switchWorks(wires: readonly Wire[]): boolean {
  const s = switchStates(wires);
  return s.on.lit.includes('red') && !s.on.short && !s.off.lit.length && !s.off.short;
}

/**
 * Every start a tier allows. Easy: the loop runs through the switch but for one wire. Medium: a loop that lights with
 * no switch in it; the learner must open the loop and put the switch in. Hard: the switch wired beside the bulb (on
 * while the switch is off; a short when it is on); the learner must rewire it.
 */
export function switchStarts(tier: Tier): Wire[][] {
  if (tier === 'easy') {
    return [
      [wire('bat+', 'red.left'), wire('red.right', 'sw.left')],
      [wire('bat+', 'sw.left'), wire('sw.right', 'red.left')],
      [wire('bat-', 'red.right'), wire('red.left', 'sw.right')],
    ];
  }
  if (tier === 'medium') return [[wire('bat+', 'red.left'), wire('red.right', 'bat-')], [wire('bat+', 'red.right'), wire('red.left', 'bat-')]];
  return [
    [wire('bat+', 'red.left'), wire('red.right', 'bat-'), wire('sw.left', 'red.left'), wire('sw.right', 'red.right')],
    [wire('bat+', 'red.left'), wire('red.right', 'bat-'), wire('sw.left', 'bat+'), wire('sw.right', 'red.right')],
  ];
}

export function pickSwitches(n: number, tier: Tier, rng: Rng, idPrefix = 'switch'): SwitchChallenge[] {
  const pool = switchStarts(tier).filter(w => !switchWorks(w));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return Array.from({ length: n }, (_, i) => makeSwitch(`${idPrefix}-${i + 1}`, pool[i % pool.length]));
}

// ============================================================================
// The check
// ============================================================================

export type SwitchMiss = 'switch_shorts' | 'no_loop' | 'switch_does_nothing' | 'switch_backwards';

/**
 * The named miss: turning the switch on makes a short; with the switch on the bulb still does not light; the bulb is
 * on whatever the switch does (the switch is not in the loop); or the bulb is on only while the switch is off.
 */
export function switchMiss(wires: readonly Wire[]): SwitchMiss | undefined {
  if (switchWorks(wires)) return undefined;
  const s = switchStates(wires);
  if (s.on.short) return 'switch_shorts';
  if (s.off.lit.length && s.on.lit.length) return 'switch_does_nothing';
  if (s.off.lit.length) return 'switch_backwards';
  return 'no_loop';
}

export function switchFeedback(wires: readonly Wire[]): string {
  const miss = switchMiss(wires);
  if (!miss) return 'It works! When the switch is on, it closes the loop and the bulb lights. Off, it opens the loop, and the electricity stops.';
  if (miss === 'switch_shorts') return 'Turning the switch on lets the electricity skip the bulb, and the battery gets warm. Where should the switch go?';
  if (miss === 'switch_does_nothing') return 'The bulb stays on whatever the switch does. Is the switch part of the loop?';
  if (miss === 'switch_backwards') return 'The bulb is on only while the switch is off. Follow the path: where does the electricity go when the switch is on?';
  return 'With the switch on, the bulb still does not light. Follow the path from the battery all the way round.';
}

/** The learner's wiring and what the switch does with it, never the wire it needs. */
export function describeSwitch(wires: readonly Wire[]): string {
  const s = switchStates(wires);
  const what = (st: ReturnType<typeof evaluate>) => (st.short ? 'nothing lit and the battery warm' : st.lit.length ? 'the bulb lit' : 'the bulb off');
  return `${wires.length ? wires.map(w => wireWords({ bulbs: ['red'] }, w)).join('; ') : 'no wires'}: switch on, ${what(s.on)}; switch off, ${what(s.off)}`;
}
