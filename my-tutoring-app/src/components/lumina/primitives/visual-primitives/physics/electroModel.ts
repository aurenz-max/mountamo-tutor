/**
 * The workbench's electromagnet, pure: a core with wire wrapped round it, a battery or two and a switch, how many paper
 * clips it lifts, the items code builds, and the check. The 3D bench dips the core into a tray of clips and lifts what
 * this file says.
 *
 * Wire wrapped round an iron or steel core makes a magnet, but only while electricity flows: switch off and the clips
 * drop. More wraps, or a second battery, make it stronger. A core that is not iron or steel (wood, aluminium) makes a
 * magnet too weak to lift a clip. Every number here is a teaching model, not a measurement: each two wraps on one
 * battery lift one clip, and a second battery doubles it.
 */
import type { Rng, Tier } from './circuitModel';

export type Core = 'steel' | 'wood' | 'aluminium';
export const CORE_WORDS: Record<Core, string> = { steel: 'a steel nail', wood: 'a wooden pencil', aluminium: 'an aluminium rod' };
export const MAX_TURNS = 10;
export interface ElectroBuild { core: Core; turns: number; batteries: 1 | 2; on: boolean }

/** How strong the magnet is right now, before rounding to whole clips: 0 when off, with no wraps, or on a core that is
 *  not iron or steel (a twelfth as strong: never a whole clip). */
export const strength = (b: ElectroBuild) => (!b.on || b.turns <= 0 ? 0 : (b.turns * b.batteries) / (b.core === 'steel' ? 2 : 25));
export const clipsLifted = (b: ElectroBuild) => Math.floor(strength(b) + 1e-9);
/** The most clips a build can lift: every wrap on, and both batteries when a second one may go in. */
export const maxClips = (twoBatteries: boolean) => clipsLifted({ core: 'steel', turns: MAX_TURNS, batteries: twoBatteries ? 2 : 1, on: true });

export interface ElectroGoal { kind: 'at_least' | 'exactly'; clips: number }
export interface ElectroChallenge {
  id: string;
  type: 'electromagnet';
  instruction: string;
  goal: ElectroGoal;
  /** The build on the bench when the item opens: the switch always off. */
  start: ElectroBuild;
  /** A second battery on the table to put in (hard), and a tray of cores to swap (hard). */
  spareBattery: boolean;
  coreTray: boolean;
  supportTier?: Tier;
  startLevers?: string[];
}

export const goalWords = (g: ElectroGoal) => `${g.kind === 'exactly' ? 'exactly' : 'at least'} ${g.clips} paper clip${g.clips === 1 ? '' : 's'}`;
export function electroInstruction(g: ElectroGoal, spare: boolean, tray: boolean): string {
  const tools = [spare ? 'a spare battery' : '', tray ? 'other things to wrap the wire round' : ''].filter(Boolean).join(' and ');
  return `Make an electromagnet that picks up ${goalWords(g)}. Wrap the wire round the core, switch it on, and dip it in the clips to test.`
    + (tools ? ` You can use ${tools}.` : '');
}
export const makeElectro = (id: string, goal: ElectroGoal, start: ElectroBuild, spareBattery = false, coreTray = false): ElectroChallenge =>
  ({ id, type: 'electromagnet', instruction: electroInstruction(goal, spareBattery, coreTray), goal, start: { ...start, on: false }, spareBattery, coreTray });

export const meetsGoal = (g: ElectroGoal, clips: number) => (g.kind === 'exactly' ? clips === g.clips : clips >= g.clips);
/** Some build on this bench meets the goal. */
export function reachable(c: Pick<ElectroChallenge, 'goal' | 'start' | 'spareBattery' | 'coreTray'>): boolean {
  const cores: Core[] = c.coreTray ? ['steel', 'wood', 'aluminium'] : [c.start.core];
  const bats: Array<1 | 2> = c.spareBattery ? [1, 2] : [c.start.batteries];
  return cores.some(core => bats.some(batteries => Array.from({ length: MAX_TURNS + 1 }, (_, turns) => turns)
    .some(turns => meetsGoal(c.goal, clipsLifted({ core, turns, batteries, on: true })))));
}
/** Fair: whole-clip goals the bench can meet, wraps in range, and the opening build (switched on) does not already meet
 *  it, so the learner always has to change something. */
export function electroFair(c: Pick<ElectroChallenge, 'goal' | 'start' | 'spareBattery' | 'coreTray'>): boolean {
  const s = c.start;
  if (!Number.isInteger(c.goal.clips) || c.goal.clips < 1 || !Number.isInteger(s.turns) || s.turns < 0 || s.turns > MAX_TURNS) return false;
  if (!(s.core in CORE_WORDS) || (s.batteries !== 1 && s.batteries !== 2)) return false;
  return reachable(c) && !meetsGoal(c.goal, clipsLifted({ ...s, on: true }));
}

const int = (lo: number, hi: number, rng: Rng) => lo + Math.floor(rng() * (hi - lo + 1));

/**
 * One item. Easy: a bare steel nail, one battery; lift at least 1-2 clips (wrap it and switch it on). Medium: exactly
 * 2-5 clips on one battery, starting from some wraps that lift the wrong number: more wraps lift more. Hard: exactly
 * 6-10 clips, which one battery cannot reach, starting on a core that is not iron or steel, with a spare battery and a
 * tray of cores.
 */
export function buildElectro(tier: Tier, rng: Rng, id: string): ElectroChallenge {
  if (tier === 'easy') return makeElectro(id, { kind: 'at_least', clips: int(1, 2, rng) }, { core: 'steel', turns: 0, batteries: 1, on: false });
  if (tier === 'medium') {
    const clips = int(2, 5, rng);
    // Start on wraps that lift a different number: sometimes too few, sometimes too many.
    const options = Array.from({ length: MAX_TURNS - 1 }, (_, i) => i + 2).filter(t => Math.floor(t / 2) !== clips);
    return makeElectro(id, { kind: 'exactly', clips }, { core: 'steel', turns: options[int(0, options.length - 1, rng)], batteries: 1, on: false });
  }
  const clips = int(maxClips(false) + 1, maxClips(true), rng);
  return makeElectro(id, { kind: 'exactly', clips }, { core: rng() < 0.5 ? 'wood' : 'aluminium', turns: int(3, MAX_TURNS, rng), batteries: 1, on: false }, true, true);
}

export function pickElectro(n: number, tier: Tier, rng: Rng, idPrefix = 'electro'): ElectroChallenge[] {
  return Array.from({ length: n }, (_, i) => buildElectro(tier, rng, `${idPrefix}-${i + 1}`));
}

// ============================================================================
// The check: the build on the bench, as it is (the switch counts)
// ============================================================================

export type ElectroMiss = 'switch_off' | 'no_coil' | 'not_iron_core' | 'too_few_clips' | 'too_many_clips';

export function electroMiss(c: ElectroChallenge, b: ElectroBuild): ElectroMiss | undefined {
  const clips = clipsLifted(b);
  if (meetsGoal(c.goal, clips)) return undefined;
  if (b.turns <= 0) return 'no_coil';
  if (!b.on) return 'switch_off';
  if (b.core !== 'steel') return 'not_iron_core';
  return clips < c.goal.clips ? 'too_few_clips' : 'too_many_clips';
}

export const buildWords = (b: ElectroBuild) =>
  `${b.turns} wrap${b.turns === 1 ? '' : 's'} of wire round ${CORE_WORDS[b.core]}, ${b.batteries} batter${b.batteries === 1 ? 'y' : 'ies'}, the switch ${b.on ? 'on' : 'off'}`;
export const describeElectro = (b: ElectroBuild) => `built ${buildWords(b)}, which lifts ${clipsLifted(b)} clip${clipsLifted(b) === 1 ? '' : 's'}`;

export function electroFeedback(c: ElectroChallenge, b: ElectroBuild): string {
  const miss = electroMiss(c, b);
  if (!miss) return `Yes! It lifts ${clipsLifted(b)}. Electricity flowing round the wire makes the steel a magnet: more wraps or more batteries make it stronger, and switching off drops the clips.`;
  if (miss === 'no_coil') return 'The wire is not wrapped round the core yet. Can a plain nail pick up clips?';
  if (miss === 'switch_off') return 'Is electricity flowing through the wire right now? Look at the switch.';
  if (miss === 'not_iron_core') return `Look at your tests: did ${CORE_WORDS[b.core]} pick anything up? What could you wrap the wire round instead?`;
  if (miss === 'too_few_clips') return 'It is not strong enough yet. What could make it stronger?';
  return 'It is too strong: it picks up too many. What could make it a little weaker?';
}
