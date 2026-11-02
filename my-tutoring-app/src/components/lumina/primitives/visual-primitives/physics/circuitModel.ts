/**
 * The circuit workbench's world model, pure: the parts on the table, the clips a wire can join, what lights for a set
 * of wires, the items code builds, and the check. The 3D table (`circuit3d.ts`) lights what this file says is lit, so
 * what the learner sees is what this file decides.
 *
 * Electricity flows only round a closed loop: out of one end of the battery, through the bulb, and back into the
 * battery's other end. One wire from the battery to the bulb lights nothing; both bulb clips on the same battery end
 * lights nothing; a wire straight from one battery end to the other makes a short circuit, so nothing lights and the
 * battery gets warm. With two bulbs, a bulb lights when it is on a loop from one battery end to the other.
 */
import type { BreakChallenge } from './breakModel';
import type { ConductorChallenge } from './conductorModel';
import type { SwitchChallenge } from './switchModel';
import type { TwoBulbChallenge } from './twoBulbModel';
import type { DeviceChallenge } from './deviceModel';
import type { MagnetChallenge } from './magnetModel';

/** A load on the table: a red or blue bulb, a motor with a fan, or a buzzer. Each has two clips and lets electricity
 *  through it, so any of them works (lights, spins, buzzes) on a closed loop. */
export type BulbColor = 'red' | 'blue' | 'motor' | 'buzzer';
export const isBulb = (b: BulbColor) => b === 'red' || b === 'blue';
export type Clip = 'bat+' | 'bat-' | `${BulbColor}.left` | `${BulbColor}.right` | 'sw.left' | 'sw.right';
/** A wire joins two different clips; stored with its clips sorted, so one wire has one key. */
export type Wire = [Clip, Clip];

export const BATTERY_CLIPS: readonly Clip[] = ['bat+', 'bat-'];
export const bulbClips = (b: BulbColor): [Clip, Clip] => [`${b}.left`, `${b}.right`];
export const SWITCH_CLIPS: readonly Clip[] = ['sw.left', 'sw.right'];
/** The clips on the table: the battery's, each bulb's, and the switch's when there is one. */
export const clipsOf = (bulbs: readonly BulbColor[], withSwitch = false): Clip[] =>
  [...BATTERY_CLIPS, ...bulbs.flatMap(bulbClips), ...(withSwitch ? SWITCH_CLIPS : [])];

export const wire = (a: Clip, b: Clip): Wire => (a < b ? [a, b] : [b, a]);
export const wireKey = (w: Wire): string => `${w[0]}~${w[1]}`;
export const sameWire = (a: Wire, b: Wire) => wireKey(a) === wireKey(b);

// ============================================================================
// What lights
// ============================================================================

export interface CircuitState {
  /** The bulbs that light. */
  lit: BulbColor[];
  /** A wire joins the battery's two ends straight: nothing lights and the battery gets warm. */
  short: boolean;
  /** Lit bulbs that glow dimly: every path through them goes through another bulb too (bulbs in a row). */
  dim?: BulbColor[];
}

/** Which clips the wires join into one piece of metal: each clip's group. */
function groups(clips: readonly Clip[], wires: readonly Wire[]): Map<Clip, number> {
  const parent = new Map<Clip, Clip>(clips.map(c => [c, c]));
  const find = (c: Clip): Clip => { let r = c; while (parent.get(r) !== r) r = parent.get(r)!; return r; };
  for (const [a, b] of wires) if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b));
  const ids = new Map<Clip, number>(), out = new Map<Clip, number>();
  for (const c of clips) { const r = find(c); if (!ids.has(r)) ids.set(r, ids.size); out.set(c, ids.get(r)!); }
  return out;
}

/** Broken parts (find_the_break): a dead battery pushes nothing; a burnt-out bulb lets nothing through. */
export interface Faults { deadBattery?: boolean; burnt?: readonly BulbColor[]; switchClosed?: boolean }

/**
 * What lights: every bulb on some path from the battery's + group to its - group, each step through a bulb, no group
 * twice. A bulb with both clips in one group is bypassed. A short (both battery ends in one group) lights nothing.
 * A dead battery lights nothing; a burnt-out bulb is a gap in the path. A closed switch joins its two clips like a wire;
 * an open one joins nothing.
 */
export function evaluate(bulbs: readonly BulbColor[], wires: readonly Wire[], faults: Faults = {}): CircuitState {
  const g = groups(clipsOf(bulbs, true), faults.switchClosed ? [...wires, wire('sw.left', 'sw.right')] : wires);
  const plus = g.get('bat+')!, minus = g.get('bat-')!;
  if (plus === minus) return { lit: [], short: !faults.deadBattery };
  if (faults.deadBattery) return { lit: [], short: false };
  const edges = bulbs.filter(b => !faults.burnt?.includes(b))
    .map(b => ({ b, u: g.get(`${b}.left`)!, v: g.get(`${b}.right`)! })).filter(e => e.u !== e.v);
  const lit = new Set<BulbColor>(), bright = new Set<BulbColor>();
  const walk = (at: number, seen: Set<number>, used: BulbColor[]) => {
    if (at === minus) { used.forEach(b => lit.add(b)); if (used.length === 1) bright.add(used[0]); return; }
    for (const e of edges) {
      if (used.includes(e.b)) continue;
      const next = e.u === at ? e.v : e.v === at ? e.u : -1;
      if (next < 0 || seen.has(next)) continue;
      walk(next, new Set(Array.from(seen).concat(next)), [...used, e.b]);
    }
  };
  walk(plus, new Set([plus]), []);
  const dim = bulbs.filter(b => lit.has(b) && !bright.has(b));
  return { lit: bulbs.filter(b => lit.has(b)), short: false, ...(dim.length ? { dim } : {}) };
}

/**
 * The clips electricity can reach from the battery's + end: along wires, through bulbs that are not burnt out, and
 * through a closed switch. The x-ray lever draws charge on the wires among them, moving when something is lit and
 * standing still where the path stops.
 */
export function reachedFromPlus(bulbs: readonly BulbColor[], wires: readonly Wire[], faults: Faults = {}): Clip[] {
  const clips = clipsOf(bulbs, true);
  const g = groups(clips, faults.switchClosed ? [...wires, wire('sw.left', 'sw.right')] : wires);
  const reached = new Set<number>([g.get('bat+')!]);
  for (let grew = true; grew;) {
    grew = false;
    for (const b of bulbs) {
      if (faults.burnt?.includes(b)) continue;
      const u = g.get(`${b}.left`)!, v = g.get(`${b}.right`)!;
      if (reached.has(u) !== reached.has(v)) { reached.add(u); reached.add(v); grew = true; }
    }
  }
  return clips.filter(c => reached.has(g.get(c)!));
}

// ============================================================================
// Items
// ============================================================================

export type Tier = 'easy' | 'medium' | 'hard';
export type Rng = () => number;
export const CIRCUIT_TASKS = ['light_it', 'find_the_break', 'conductor_test', 'magnet_test', 'add_a_switch', 'build_device', 'two_bulbs'] as const;
export type CircuitTask = typeof CIRCUIT_TASKS[number];

export interface LightItChallenge {
  id: string;
  type: 'light_it';
  instruction: string;
  /** The bulbs on the table: one, or a red and a blue one. */
  bulbs: BulbColor[];
  /** The bulb that must light; any other bulb must stay off. */
  target: BulbColor;
  /** The wires already clipped on when the item opens. They never light the target alone. */
  start: Wire[];
  /** The most wires the learner may have on the table at once. */
  maxWires: number;
  /** The lesson's support tier on this item. */
  supportTier?: Tier;
  /** Help levers drawn from the start (the tier's starting position). Not a pull: nothing is recorded. */
  startLevers?: string[];
}
export type CircuitChallenge = LightItChallenge | BreakChallenge | ConductorChallenge | SwitchChallenge | TwoBulbChallenge | DeviceChallenge | MagnetChallenge;

export const BULB_WORD: Record<BulbColor, string> = { red: 'red', blue: 'blue', motor: 'motor', buzzer: 'buzzer' };
/** "the bulb" when it is the only bulb, "the red bulb" beside another; "the motor", "the buzzer". */
export const bulbName = (c: { bulbs: readonly BulbColor[] }, b: BulbColor) =>
  (!isBulb(b) ? `the ${BULB_WORD[b]}` : c.bulbs.filter(isBulb).length === 1 ? 'the bulb' : `the ${BULB_WORD[b]} bulb`);

export function lightItInstruction(c: Pick<LightItChallenge, 'bulbs' | 'target'>): string {
  if (c.bulbs.length === 1) return 'Use the wires to make the bulb light up.';
  const other = c.bulbs.find(b => b !== c.target)!;
  return `Make the ${BULB_WORD[c.target]} bulb light up, but not the ${BULB_WORD[other]} one.`;
}

/** The goal: the target lights and every other bulb stays off. */
export const goalMet = (c: LightItChallenge, wires: readonly Wire[]): boolean => {
  const s = evaluate(c.bulbs, wires);
  return s.lit.includes(c.target) && s.lit.length === 1;
};

/** Every start a tier allows, for one bulb's clips (left/right) and the battery ends. */
function startsFor(tier: Tier, bulbs: BulbColor[], target: BulbColor): Wire[][] {
  const [l, r] = bulbClips(target);
  const ends: Clip[] = ['bat+', 'bat-'];
  const out: Wire[][] = [];
  // Easy: one wire from a battery end to a bulb clip; one more wire closes the loop.
  if (tier === 'easy') for (const e of ends) for (const c of [l, r]) out.push([wire(e, c)]);
  if (tier === 'medium') {
    // The three ways a first try goes wrong: one end only, both bulb clips on one end, a short beside the bulb.
    for (const e of ends) for (const c of [l, r]) out.push([wire(e, c)]);
    for (const e of ends) out.push([wire(e, l), wire(e, r)]);
    for (const c of [l, r]) out.push([wire('bat+', 'bat-'), wire('bat+', c)]);
  }
  if (tier === 'hard') {
    // Two bulbs: nothing clipped, or the other bulb already half wired (so wiring "everything" lights both).
    const other = bulbs.find(b => b !== target)!;
    const [ol, or] = bulbClips(other);
    out.push([]);
    for (const e of ends) for (const c of [ol, or]) out.push([wire(e, c)]);
  }
  return out;
}

const shuffle = <T,>(xs: readonly T[], rng: Rng): T[] => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

export function makeLightIt(id: string, bulbs: BulbColor[], target: BulbColor, start: Wire[]): LightItChallenge {
  return { id, type: 'light_it', instruction: lightItInstruction({ bulbs, target }), bulbs, target, start,
    maxWires: bulbs.length === 1 ? 3 : 4 };
}

/** N light_it items: the tier's starts, shuffled, no start twice until they run out; none lights the target alone. */
export function pickLightIt(n: number, tier: Tier, rng: Rng, idPrefix = 'light'): LightItChallenge[] {
  const pool = (tier === 'hard' ? (['red', 'blue'] as const) : (['red'] as const)).flatMap(target => {
    const bulbs: BulbColor[] = tier === 'hard' ? ['red', 'blue'] : ['red'];
    return startsFor(tier, bulbs, target).map(start => ({ bulbs, target, start }));
  }).filter(p => !goalMet(makeLightIt('x', p.bulbs, p.target, p.start), p.start));
  const order = shuffle(pool, rng);
  return Array.from({ length: n }, (_, i) => {
    const p = order[i % order.length];
    return makeLightIt(`${idPrefix}-${i + 1}`, p.bulbs, p.target, p.start);
  });
}

// ============================================================================
// The check
// ============================================================================

export type CircuitMiss = 'short_circuit' | 'wrong_bulb' | 'lit_both' | 'both_on_one_end' | 'open_loop';

/**
 * The named miss: a short (battery ends joined), the other bulb lit instead, both bulbs lit, both of the target's clips
 * on one piece of metal, or the loop not closed (one end only, or a gap).
 */
export function lightItMiss(c: LightItChallenge, wires: readonly Wire[]): CircuitMiss | undefined {
  if (goalMet(c, wires)) return undefined;
  const s = evaluate(c.bulbs, wires);
  if (s.short) return 'short_circuit';
  if (s.lit.includes(c.target)) return 'lit_both';
  if (s.lit.length) return 'wrong_bulb';
  const g = groups(clipsOf(c.bulbs), wires);
  const [l, r] = bulbClips(c.target);
  if (g.get(l) === g.get(r) && (g.get(l) === g.get('bat+') || g.get(l) === g.get('bat-'))) return 'both_on_one_end';
  return 'open_loop';
}

// ============================================================================
// Words
// ============================================================================

export function clipWords(c: { bulbs: readonly BulbColor[] }, clip: Clip): string {
  if (clip === 'bat+') return "the battery's + end";
  if (clip === 'bat-') return "the battery's − end";
  if (clip === 'sw.left' || clip === 'sw.right') return `the switch's ${clip.slice(3)} clip`;
  const [b, side] = clip.split('.') as [BulbColor, 'left' | 'right'];
  return `${bulbName(c, b)}'s ${side} clip`;
}
export const wireWords = (c: { bulbs: readonly BulbColor[] }, w: Wire): string => `a wire from ${clipWords(c, w[0])} to ${clipWords(c, w[1])}`;

/** What the table shows: the wires and what is lit. Never the wire that would close the loop. */
export function describeCircuit(c: LightItChallenge, wires: readonly Wire[]): string {
  const s = evaluate(c.bulbs, wires);
  const what = s.short ? 'nothing lit and the battery got warm' : s.lit.length ? `${s.lit.map(b => bulbName(c, b)).join(' and ')} lit` : 'nothing lit';
  return `${wires.length ? wires.map(w => wireWords(c, w)).join('; ') : 'no wires'}: ${what}`;
}

export function lightItFeedback(c: LightItChallenge, wires: readonly Wire[]): string {
  const miss = lightItMiss(c, wires);
  if (!miss) {
    return `It lights! Electricity goes out of one end of the battery, through ${bulbName(c, c.target)}, and back into the other end. `
      + 'That path all the way round is a closed loop.';
  }
  if (miss === 'short_circuit') return 'Nothing lights, and the battery gets warm! A wire goes straight from one battery end to the other, so the electricity skips the bulb. Which wire should go?';
  if (miss === 'wrong_bulb') return `The wrong bulb lit! Follow the wires from the battery. Which bulb is in the loop?`;
  if (miss === 'lit_both') return `Both bulbs lit! Only ${bulbName(c, c.target)} should be in the loop. Which bulb could you leave out?`;
  if (miss === 'both_on_one_end') return 'Both of the bulb\'s clips go to the same end of the battery. Electricity needs a path out of one end and back into the other.';
  return 'The bulb is not lit. Follow the path from the battery: does it go through the bulb and all the way back to the other end?';
}
