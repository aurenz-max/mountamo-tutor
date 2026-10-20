/**
 * gas-laws-simulator's items, keys, misses and scene: the pure half of its boss (`gasLawsSimulator.boss.ts`, a
 * SAY_OR_SHOW card on the spoken preset).
 *
 * Every item is built and keyed by code: a container of gas (a steel tank, a cylinder with a free piston, a sealed
 * syringe in a water bath, or a cylinder whose piston can be pressed), its state before, one or two changes, and the
 * quantity asked. The key is PV/(nT) held constant, solved for the asked quantity. Each mode is one closed choice the
 * learner taps and checks, or says (J14):
 * - observe: predict the direction (goes up, goes down, stays the same) before the change is run.
 * - predict: one change; choose the new value. Wrong choices are the inverted factor, the unchanged value and, with
 *   temperatures in degrees Celsius, the Celsius ratio.
 * - calculate: two changes at once (combined gas law); choose the new value. Wrong choices apply one change only,
 *   invert the second ratio, or use the Celsius ratio.
 * Difficulty (`config.difficulty`) is structural: easy = whole-number factors and the held quantities named; medium =
 * inverse relations and fractional factors; hard = the held quantities left to infer from the container (observe,
 * with "stays the same" keys) or temperatures in degrees Celsius (predict, calculate).
 *
 * Pure: the component, the generator, the boss, the levers and the tests read the same items, checks, misses and scene.
 */
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { GAS_MISSES } from './gasLawsSimulator.card';

export type GasMode = 'observe' | 'predict' | 'calculate';
export const GAS_MODES: GasMode[] = ['observe', 'predict', 'calculate'];
export type GasTier = 'easy' | 'medium' | 'hard';
export type GasVar = 'P' | 'V' | 'T' | 'n';
export type GasLawFocus = 'boyle' | 'charles' | 'gay_lussac' | 'combined' | 'ideal' | 'kmt_only';
/** tank: rigid (volume held). piston: free weighted piston (pressure held). syringe: in a water bath (temperature
 *  held). cylinder: a piston that is pressed, heated or moved (only the amount held). */
export type Apparatus = 'tank' | 'piston' | 'syringe' | 'cylinder';
export interface GasState { P: number; V: number; T: number; n: number }
export interface GasChange { v: GasVar; to: number }

export interface GasItem {
  id: string;
  mode: GasMode;
  apparatus: Apparatus;
  gas: string;
  /** T in kelvin; n is relative (1 = what the container holds before), never shown in moles. */
  before: GasState;
  changes: GasChange[];
  asked: GasVar;
  /** Temperatures are written in degrees Celsius; the learner converts. Never with T asked. */
  celsius: boolean;
  /** The quantities the container holds are named in the ask (else the learner infers them from the container). */
  heldNamed: boolean;
  /** A one-change cylinder (the calculate practice item) names the quantity that moves. */
  free?: GasVar;
}

export const NAME: Record<GasVar, string> = { P: 'pressure', V: 'volume', T: 'temperature', n: 'amount of gas' };
export const UNIT: Record<GasVar, string> = { P: 'atm', V: 'L', T: 'K', n: '' };
export const DIRECTIONS = ['Goes up', 'Goes down', 'Stays the same'] as const;
export type Direction = typeof DIRECTIONS[number];

// ── Physics ──────────────────────────────────────────────────────────────────────────────

/** The quantity each container lets move, for each change it takes. */
const FREE: Record<Apparatus, Partial<Record<GasVar, GasVar>>> = {
  tank: { T: 'P', n: 'P' },
  piston: { T: 'V', n: 'V' },
  syringe: { V: 'P', P: 'V' },
  cylinder: {},
};

/** The one quantity that moves: for the cylinder the one of P, V, T neither change names. */
export function freeVar(item: Pick<GasItem, 'apparatus' | 'changes' | 'free'>): GasVar {
  if (item.free) return item.free;
  if (item.apparatus === 'cylinder') return (['P', 'V', 'T'] as GasVar[]).find(v => !item.changes.some(c => c.v === v))!;
  return FREE[item.apparatus][item.changes[0].v]!;
}

/** Held: everything neither changed nor free. */
export function heldVars(item: Pick<GasItem, 'apparatus' | 'changes' | 'free'>): GasVar[] {
  const free = freeVar(item);
  return (['P', 'V', 'T', 'n'] as GasVar[]).filter(v => v !== free && !item.changes.some(c => c.v === v));
}

/** The state after the given changes: PV/(nT) is constant, solved for the free quantity. */
export function stateAfter(item: Pick<GasItem, 'apparatus' | 'changes' | 'before' | 'free'>, changes = item.changes): GasState {
  const b = item.before, k = (b.P * b.V) / (b.n * b.T);
  const s: GasState = { ...b };
  for (const c of changes) s[c.v] = c.to;
  const free = freeVar(item);
  if (free === 'P') s.P = (k * s.n * s.T) / s.V;
  else if (free === 'V') s.V = (k * s.n * s.T) / s.P;
  else if (free === 'T') s.T = (s.P * s.V) / (k * s.n);
  else s.n = (s.P * s.V) / (k * s.T);
  return s;
}

export const round2 = (x: number) => Math.round(x * 100) / 100;
const clean = (x: number) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6;
export const toC = (k: number) => Math.round(k - 273);
export const fmtNum = (x: number) => String(round2(x));

/** A value as written on screen: temperatures in degrees Celsius on a Celsius item. */
export function showValue(item: Pick<GasItem, 'celsius'>, v: GasVar, x: number): string {
  if (v === 'T') return item.celsius ? `${toC(x)} °C` : `${fmtNum(x)} K`;
  if (v === 'n') return `${fmtNum(x)} times the gas`;
  return `${fmtNum(x)} ${UNIT[v]}`;
}

// ── Choices, keys, misses ────────────────────────────────────────────────────────────────

export type ObserveMiss = 'opposite_direction' | 'said_unchanged' | 'missed_unchanged';
export type PredictMiss = 'inverse_factor' | 'kept_value' | 'celsius_ratio';
export type CalculateMiss = 'first_change_only' | 'second_change_only' | 'ratio_inverted' | 'celsius_ratio';
export type GasLawsMiss = ObserveMiss | PredictMiss | CalculateMiss;

export interface GasChoice { label: string; value: number; kind: 'key' | GasLawsMiss }

export function directionOf(item: GasItem): Direction {
  const before = item.before[item.asked], after = stateAfter(item)[item.asked];
  return Math.abs(after - before) < 1e-9 * Math.max(1, before) ? 'Stays the same' : after > before ? 'Goes up' : 'Goes down';
}

/** The ratio a change multiplies the asked quantity by, alone (from solving with that change only). */
const effect = (item: GasItem, change: GasChange) => stateAfter(item, [change])[item.asked] / item.before[item.asked];
/** The same ratio when the learner divides degrees Celsius instead of kelvin. */
const celsiusEffect = (item: GasItem, change: GasChange) => {
  const e = effect(item, change);
  if (change.v !== 'T') return e;
  const kRatio = change.to / item.before.T, cRatio = toC(change.to) / toC(item.before.T);
  return e >= 1 === kRatio >= 1 ? e * (cRatio / kRatio) : e * (kRatio / cRatio);
};

/** Every choice of a numeric item, with what it shows, in ascending order; null when two coincide. */
export function numericChoices(item: GasItem): GasChoice[] | null {
  const a = item.asked, b = item.before[a], key = stateAfter(item)[a];
  const raw: GasChoice[] = [{ label: '', value: key, kind: 'key' }];
  if (item.changes.length === 1) {
    raw.push({ label: '', value: (b * b) / key, kind: 'inverse_factor' }, { label: '', value: b, kind: 'kept_value' });
    if (item.celsius) raw.push({ label: '', value: b * celsiusEffect(item, item.changes[0]), kind: 'celsius_ratio' });
  } else {
    const [c1, c2] = item.changes;
    raw.push({ label: '', value: b * effect(item, c1), kind: 'first_change_only' },
      { label: '', value: b * effect(item, c2), kind: 'second_change_only' },
      { label: '', value: (b * effect(item, c1)) / effect(item, c2), kind: 'ratio_inverted' });
    if (item.celsius) raw.push({ label: '', value: b * celsiusEffect(item, c1) * celsiusEffect(item, c2), kind: 'celsius_ratio' });
  }
  const out = raw.map(c => ({ ...c, label: showValue({ celsius: false }, a, c.value) }));
  if (out.some(c => !Number.isFinite(c.value) || c.value <= 0)) return null;
  if (new Set(out.map(c => c.label)).size !== out.length) return null;
  return out.sort((x, y) => x.value - y.value);
}

export function choicesOf(item: GasItem): string[] {
  return item.mode === 'observe' ? [...DIRECTIONS] : (numericChoices(item) ?? []).map(c => c.label);
}

export function keyChoice(item: GasItem): string {
  return item.mode === 'observe' ? directionOf(item) : numericChoices(item)!.find(c => c.kind === 'key')!.label;
}
export const gasCorrect = (item: GasItem | undefined, choice: string | null) => !!item && choice !== null && choice === keyChoice(item);

export function gasMiss(item: GasItem | undefined, choice: string | null): GasLawsMiss | undefined {
  if (!item || choice === null || gasCorrect(item, choice) || !choicesOf(item).includes(choice)) return undefined;
  if (item.mode === 'observe') {
    if (directionOf(item) === 'Stays the same') return 'missed_unchanged';
    return choice === 'Stays the same' ? 'said_unchanged' : 'opposite_direction';
  }
  return numericChoices(item)!.find(c => c.label === choice)!.kind as GasLawsMiss;
}

// ── The ask ──────────────────────────────────────────────────────────────────────────────

const CONTAINER: Record<Apparatus, (gas: string) => string> = {
  tank: gas => `A sealed steel tank holds ${gas}`,
  piston: gas => `A cylinder of ${gas} is closed by a piston that slides freely, with a weight resting on it. The ${gas} is`,
  syringe: gas => `A sealed syringe of ${gas} sits in a large water bath. The ${gas} is`,
  cylinder: gas => `A cylinder of ${gas} is closed by a piston. The ${gas} is`,
};

const fraction = (r: number): string => {
  for (const [v, s] of [[2, 'twice as much'], [3, '3 times as much'], [1.5, '1.5 times as much'], [0.5, 'half as much'],
    [1 / 3, 'a third as much'], [2 / 3, 'two thirds as much'], [4 / 3, '4/3 as much'], [0.75, 'three quarters as much']] as const) {
    if (Math.abs(r - v) < 1e-9) return s;
  }
  return `${fmtNum(r)} times as much`;
};

/** One change in words: a sentence when it is the only change, else a clause for "At the same time, ... and ...". */
function changeText(item: GasItem, c: GasChange, alone: boolean): string {
  const from = item.before[c.v], up = c.to > from, to = showValue(item, c.v, c.to), gas = item.gas;
  const fromText = alone ? ` from ${showValue(item, c.v, from)}` : '';
  if (c.v === 'n') return up ? `More ${gas} is pumped in until it holds ${fraction(c.to / from)} ${gas} as before.`
    : `Some ${gas} is let out until it holds ${fraction(c.to / from)} ${gas} as before.`;
  if (item.apparatus === 'syringe') {
    return c.v === 'V' ? `The plunger is ${up ? 'pulled out' : 'pushed in'} from ${showValue(item, 'V', from)} to ${to}.`
      : `The plunger is ${up ? 'pressed harder' : 'eased back'} until the pressure is ${to}.`;
  }
  const clause = c.v === 'T' ? `the ${gas} is ${up ? 'heated' : 'cooled'}${fromText} to ${to}`
    : c.v === 'V' ? (up ? `the volume grows${fromText} to ${to}` : `the ${gas} is squeezed${fromText} to ${to}`)
      : `the pressure is ${up ? 'raised' : 'lowered'}${fromText} to ${to}`;
  return alone ? `${clause.charAt(0).toUpperCase()}${clause.slice(1)}.` : clause;
}

const listOf = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** What the ask states about the gas before, never the amount in moles. */
const beforeText = (item: GasItem) => `at ${listOf((['P', 'V', 'T'] as GasVar[]).map(v => showValue(item, v, item.before[v])))}`;

export function heldText(item: GasItem): string {
  const held = heldVars(item).map(v => (v === 'n' ? `the amount of ${item.gas}` : `the ${NAME[v]}`));
  const s = listOf(held);
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} ${held.length > 1 ? 'stay' : 'stays'} the same.`;
}

export function askOf(item: GasItem): string {
  const setup = `${CONTAINER[item.apparatus](item.gas)} ${beforeText(item)}.`;
  const change = item.changes.length === 1 ? changeText(item, item.changes[0], true)
    : `At the same time, ${changeText(item, item.changes[0], false)} and ${changeText(item, item.changes[1], false)}.`;
  const held = item.heldNamed ? ` ${heldText(item)}` : '';
  const q = item.mode === 'observe' ? `What happens to the ${NAME[item.asked]}?` : `What is the new ${NAME[item.asked]}?`;
  return `${setup} ${change}${held} ${q}`;
}

// ── Item space ───────────────────────────────────────────────────────────────────────────

export type Rng = () => number;
/** A seeded generator, so a lesson without stored items still builds the same items everywhere. */
export function seededRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const P_SET = [1, 2, 3, 4];
const V_SET = [2, 3, 4, 6, 8, 12];
const T_SET = [300, 400, 450, 600];
/** Kelvin values whose Celsius form is a positive whole number a learner can convert (27 °C, 127 °C, 177 °C...). */
const T_CELSIUS = new Set([300, 400, 450, 600, 750, 900]);
const WHOLE = [2, 3, 0.5, 1 / 3];
const FRACTIONAL = [1.5, 2 / 3, 4 / 3, 0.75];
const RANGE: Record<GasVar, [number, number]> = { P: [0.25, 12], V: [0.5, 36], T: [150, 1800], n: [0.25, 4] };
const inRange = (v: GasVar, x: number) => x >= RANGE[v][0] - 1e-9 && x <= RANGE[v][1] + 1e-9;

const APPARATUS_BY_FOCUS: Record<GasLawFocus, Apparatus[]> = {
  boyle: ['syringe'], charles: ['piston'], gay_lussac: ['tank'],
  combined: ['tank', 'piston', 'syringe'], ideal: ['tank', 'piston', 'syringe'], kmt_only: ['tank', 'piston', 'syringe'],
};
/** One-change shapes per container: [changed, asked]. A shape asking a held quantity has the key "stays the same". */
const SHAPES: Record<Exclude<Apparatus, 'cylinder'>, { free: Array<[GasVar, GasVar]>; held: Array<[GasVar, GasVar]> }> = {
  tank: { free: [['T', 'P'], ['n', 'P']], held: [['T', 'V']] },
  piston: { free: [['T', 'V'], ['n', 'V']], held: [['T', 'P'], ['n', 'T']] },
  syringe: { free: [['V', 'P'], ['P', 'V']], held: [['V', 'T']] },
};
/** Direct relations (the asked quantity moves the way the change does): the easy observe band. */
const isDirect = (app: Apparatus) => app === 'tank' || app === 'piston';

function candidates(mode: GasMode, tier: GasTier, focus: GasLawFocus, gas: string): GasItem[] {
  const out: GasItem[] = [];
  const base = { id: '', mode, gas };
  const befores: GasState[] = [];
  for (const P of P_SET) for (const V of V_SET) for (const T of T_SET) befores.push({ P, V, T, n: 1 });
  const push = (raw: GasItem) => {
    // A changed value must be exact to two decimals before it is written (6 x 2/3 = 4, not 2 x 2/3 = 0.67).
    if (raw.changes.some(c => !clean(c.to))) return;
    const item: GasItem = { ...raw, changes: raw.changes.map(c => ({ ...c, to: round2(c.to) })) };
    for (const c of item.changes) if (!clean(c.to) || !inRange(c.v, c.to) || Math.abs(c.to - item.before[c.v]) < 1e-9) return;
    if (item.changes.some(c => c.v === 'T' && !Number.isInteger(c.to))) return;
    if (item.celsius && item.changes.some(c => c.v === 'T' && (!T_CELSIUS.has(c.to) || !T_CELSIUS.has(item.before.T)))) return;
    const after = stateAfter(item)[item.asked];
    if (!inRange(item.asked, after)) return;
    if (mode !== 'observe') {
      // A key equal to the value before (two changes that cancel) would credit a learner who ignored both.
      if (!clean(after) || Math.abs(after - item.before[item.asked]) < 1e-9) return;
      const ch = numericChoices(item);
      if (!ch || ch.length < 3) return;
    }
    out.push(item);
  };
  if (mode === 'calculate') {
    const pairs: Array<[GasVar, GasVar, GasVar]> = tier === 'easy' ? [['P', 'T', 'V']]
      : tier === 'medium' ? [['V', 'T', 'P'], ['P', 'V', 'T'], ['P', 'T', 'V']] : [['P', 'T', 'V'], ['V', 'T', 'P']];
    const factors = tier === 'easy' ? WHOLE : [...WHOLE, ...FRACTIONAL];
    for (const [a, b, asked] of pairs) for (const before of befores) for (const f1 of factors) for (const f2 of factors) {
      if (tier === 'medium' && !FRACTIONAL.includes(f1) && !FRACTIONAL.includes(f2) && asked === 'V') continue;
      push({ ...base, apparatus: 'cylinder', before, asked, celsius: tier === 'hard', heldNamed: true,
        changes: [{ v: a, to: before[a] * f1 }, { v: b, to: before[b] * f2 }] });
    }
    return out;
  }
  const allowed = APPARATUS_BY_FOCUS[focus];
  for (const app of allowed as Array<Exclude<Apparatus, 'cylinder'>>) {
    const shapes = mode === 'observe' && tier === 'hard' ? [...SHAPES[app].free, ...SHAPES[app].held] : SHAPES[app].free;
    if (mode === 'observe' && tier === 'easy' && !isDirect(app) && allowed.some(isDirect)) continue;
    for (const [c, asked] of shapes) {
      if (mode === 'observe' && c === 'P') continue; // pressing a plunger harder is described by what it does to the plunger
      const celsius = mode === 'predict' && tier === 'hard' && c === 'T';
      const heldNamed = !(tier === 'hard' && (mode === 'observe' || !celsius));
      const factors = mode === 'observe' ? WHOLE.concat(tier === 'easy' ? [] : FRACTIONAL)
        : tier === 'easy' ? WHOLE : tier === 'medium' ? FRACTIONAL : [...WHOLE, ...FRACTIONAL];
      for (const before of befores) for (const f of factors) {
        const to = c === 'n' ? f : before[c] * f;
        if (c === 'n' && (f === 1 / 3 || f === 4 / 3)) continue;
        push({ ...base, apparatus: app, before, asked, celsius, heldNamed, changes: [{ v: c, to }] });
      }
    }
  }
  return out;
}

/** The structural shape of an item, so a session spreads over containers, questions and directions. */
const shapeKey = (i: GasItem) => `${i.apparatus}:${i.changes.map(c => `${c.v}${c.to > i.before[c.v] ? '+' : '-'}`).join(',')}:${i.asked}`;

export const ITEM_COUNT: Record<GasMode, [number, number]> = { observe: [4, 2], predict: [4, 2], calculate: [3, 2] };

/** The items of one mode at one tier: distinct shapes first; observe at hard includes a "stays the same" key. */
export function buildModeItems(mode: GasMode, tier: GasTier, focus: GasLawFocus, gas: string, count: number, rng: Rng): GasItem[] {
  const pool = candidates(mode, tier, focus, gas);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const picked: GasItem[] = [];
  const shapes = new Set<string>();
  // The band's defining shape comes first: a "stays the same" key (observe hard), a Celsius item (predict hard).
  const defining = mode === 'observe' && tier === 'hard' ? pool.find(i => directionOf(i) === 'Stays the same')
    : mode === 'predict' && tier === 'hard' ? pool.find(i => i.celsius) : undefined;
  if (defining) { picked.push(defining); shapes.add(shapeKey(defining)); }
  for (const i of pool) {
    if (picked.length >= count) break;
    if (!shapes.has(shapeKey(i))) { picked.push(i); shapes.add(shapeKey(i)); }
  }
  for (const i of pool) {
    if (picked.length >= count) break;
    if (!picked.includes(i) && !picked.some(p => JSON.stringify(p.before) === JSON.stringify(i.before) && shapeKey(p) === shapeKey(i))) picked.push(i);
  }
  return picked;
}

export function buildGasItems(opts: { modes: GasMode[]; tier: GasTier; focus: GasLawFocus; gas: string; rng: Rng }): GasItem[] {
  const out: GasItem[] = [];
  for (const mode of opts.modes) {
    const count = ITEM_COUNT[mode][opts.modes.length === 1 ? 0 : 1];
    out.push(...buildModeItems(mode, opts.tier, opts.focus, opts.gas, count, opts.rng));
  }
  return out.map((item, i) => ({ ...item, id: `${item.mode}-${i + 1}` }));
}

// ── Lesson data → items ──────────────────────────────────────────────────────────────────

export interface GasItemsSource {
  title?: string;
  challengeTypes?: string[];
  difficulty?: string;
  supportTier?: string;
  lawFocus?: string;
  gas?: string;
  gradeBand?: string;
  items?: GasItem[];
  /** Legacy generations (before 2026-10-15): read only for the law focus and the modes. */
  scenario?: { lawFocus?: string };
  challenges?: Array<{ type?: string }>;
}

const FOCI: GasLawFocus[] = ['boyle', 'charles', 'gay_lussac', 'combined', 'ideal', 'kmt_only'];
export const resolveFocus = (d: GasItemsSource): GasLawFocus => {
  const f = d.lawFocus ?? d.scenario?.lawFocus;
  return (FOCI as string[]).includes(f ?? '') ? (f as GasLawFocus) : 'combined';
};
export const resolveTier = (d: GasItemsSource): GasTier => {
  const t = (d.difficulty ?? d.supportTier ?? '').toLowerCase();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

/** The modes a lesson asks: its pin, else the legacy challenges' types, else by grade band. */
export function resolveGasModes(d: GasItemsSource): GasMode[] {
  const asked = (d.challengeTypes ?? []).filter((m): m is GasMode => (GAS_MODES as string[]).includes(m));
  if (asked.length) return GAS_MODES.filter(m => asked.includes(m));
  const legacy = (d.challenges ?? []).map(c => c?.type).filter((m): m is GasMode => (GAS_MODES as string[]).includes(m ?? ''));
  if (legacy.length) return GAS_MODES.filter(m => legacy.includes(m));
  return d.gradeBand === '8' ? ['observe'] : d.gradeBand === '11-12' ? ['predict', 'calculate'] : ['observe', 'predict'];
}

const APPS: Apparatus[] = ['tank', 'piston', 'syringe', 'cylinder'];
const VARS: GasVar[] = ['P', 'V', 'T', 'n'];
const positive = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x > 0;

/** Null when a stored item is not one code could have built (its key would not be computable). */
export function validGasItem(i: GasItem | undefined): i is GasItem {
  if (!i || typeof i.id !== 'string' || !(GAS_MODES as string[]).includes(i.mode) || !APPS.includes(i.apparatus)) return false;
  if (!i.before || !VARS.every(v => positive(i.before[v])) || !Array.isArray(i.changes) || !VARS.includes(i.asked)) return false;
  if (i.changes.length !== (i.apparatus === 'cylinder' ? 2 : 1) || !i.changes.every(c => VARS.includes(c.v) && positive(c.to))) return false;
  if (i.apparatus !== 'cylinder' && !FREE[i.apparatus][i.changes[0].v]) return false;
  if (i.celsius && i.asked === 'T') return false;
  if (i.mode !== 'observe' && (i.asked !== freeVar(i) || !numericChoices(i))) return false;
  return true;
}

/** Every item of the session: the stored, code-built items when valid, else built from the lesson's own fields. */
export function gasItems(d: GasItemsSource): GasItem[] {
  const stored = Array.isArray(d.items) ? d.items.filter(validGasItem) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  return buildGasItems({ modes: resolveGasModes(d), tier: resolveTier(d), focus: resolveFocus(d), gas: d.gas?.trim() || 'air',
    rng: seededRng(`${d.title ?? 'gas'}:${resolveFocus(d)}`) });
}

// ── The spoken key ───────────────────────────────────────────────────────────────────────

export const gasMode = (item: GasItem): GasMode => item.mode;

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];
const SAY_DIRECTION: Record<Direction, string[]> = {
  'Goes up': ['increases', 'rises', 'gets bigger', 'higher'],
  'Goes down': ['decreases', 'drops', 'gets smaller', 'lower'],
  'Stays the same': ['does not change', 'unchanged'],
};

/**
 * The key a spoken reply is judged against: the direction said any way, or the new value with or without its unit.
 * Each also takes the choice's place in the list. The bare number is a rule, not an accepted answer, so a number the
 * ask states for another quantity ("4 L" beside a key of "4 atm") is not read as the answer.
 */
export function gasKey(item: GasItem): SpokenKey {
  const key = keyChoice(item), choices = choicesOf(item), at = choices.indexOf(key);
  const place = `the ${ORDINAL[at] ?? 'last'} one`;
  const others = choices.filter(c => c !== key).map(c => `"${c}"`).join(', ');
  if (item.mode === 'observe') {
    return { answer: key.toLowerCase(), alsoAccept: [...SAY_DIRECTION[key as Direction], place],
      signatureError: `${others} are wrong, and so is naming two or hedging between them.` };
  }
  const [num, unit] = key.split(' ');
  return { answer: key, alsoAccept: [place], acceptRule: `The number ${num} said any way, with or without "${unit}", counts.`,
    signatureError: `${others} are wrong.` };
}

const WHAT: Record<GasLawsMiss, string> = {
  opposite_direction: 'says it moves the other way',
  said_unchanged: 'says it stays the same',
  missed_unchanged: 'says it changes',
  inverse_factor: 'is the change applied the wrong way round (multiplied instead of divided, or the reverse)',
  kept_value: 'is the value before the change',
  celsius_ratio: 'comes from dividing the degrees Celsius instead of kelvin',
  first_change_only: 'applies only the first change',
  second_change_only: 'applies only the second change',
  ratio_inverted: 'applies the second change the wrong way round',
};

/** A spoken item's known wrong answers, most specific first, with the tap's miss ids. */
export function gasSpokenMisses(item: GasItem): KnownMiss[] {
  const groups = new Map<GasLawsMiss, string[]>();
  for (const c of choicesOf(item)) {
    const m = gasMiss(item, c);
    if (m) groups.set(m, [...(groups.get(m) ?? []), c]);
  }
  const fact = `The right answer is "${keyChoice(item)}".`;
  return GAS_MISSES[item.mode].filter(m => groups.has(m)).map(m => ({ id: m,
    pattern: `${fact} The learner's answer ${WHAT[m]}: ${groups.get(m)!.map(x => `"${x}"`).join(', ')}.`, examples: groups.get(m)! }));
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface GasView {
  choice: string | null;
  /** The item is credited and the change has been run on screen. */
  solved: boolean;
}

export const describeGasWork = (item: GasItem | undefined, view: Pick<GasView, 'choice'>) =>
  item && view.choice ? `Chose "${view.choice}"` : 'Nothing chosen yet';

const DRAWN: Record<Apparatus, string> = {
  tank: 'a thick-walled steel tank (no gauge or reading is drawn)',
  piston: 'a cylinder with a free piston and a weight on top',
  syringe: 'a syringe in a water bath',
  cylinder: 'a cylinder closed by a piston',
};

/**
 * What the learner works out is the question: never said for them. How they answer is the card's `moves`. observe:
 * the direction, and (when the ask does not name it) what the container holds; predict and calculate: the value, the
 * factor, and after a miss where the wrong value came from.
 */
function constraintsOf(item: GasItem): string {
  if (item.mode === 'observe') {
    const held = item.heldNamed ? '' : 'What the container keeps the same is part of the question: never say it, or ask a '
      + 'yes-or-no question that settles it (can the steel stretch, can the piston move, does the bath keep the '
      + 'temperature); ask what the container keeps the same. ';
    return `${held}Never say which way the ${NAME[item.asked]} moves or that it stays the same; ask what the change does `
      + 'to the particles (pressure is how hard and how often they hit the walls, temperature how fast they move, volume '
      + 'the room they have).';
  }
  const celsius = item.celsius ? 'The temperatures are written in degrees Celsius; a gas-law ratio needs kelvin. ' : '';
  return `${celsius}Never say which value is right, that the ${NAME[item.asked]} doubles, halves or stays the same, or which `
    + 'factor to multiply or divide by. After a miss, never say what the wrong value came from or which change the '
    + 'learner left out or turned round; ask how each change on the table affects it.';
}

/** What is drawn and asked. The choices are named, never which is right; the after value only once credited. */
export function workspaceScene(item: GasItem, view: GasView): WorkspaceScene {
  const before = (['P', 'V', 'T'] as GasVar[]).map(v => `${NAME[v]} ${showValue(item, v, item.before[v])}`).join(', ');
  const facts: Record<string, string> = {
    kind: item.mode,
    question: askOf(item),
    choices: choicesOf(item).map((c, i) => `${i + 1}) ${c}`).join('  '),
    shown: `${DRAWN[item.apparatus]}, its gas particles moving at the starting temperature. A table: before, ${before}; `
      + `after, ${item.changes.map(c => `${NAME[c.v]} ${showValue(item, c.v, c.to)}`).join(', ')}, and "?" for the ${NAME[item.asked]}.`,
    held: item.heldNamed ? heldText(item) : 'Not stated: the learner works out from the container which quantities it holds fixed.',
  };
  if (view.solved) {
    const after = stateAfter(item);
    facts.run = `The change has been run on the container, and the table's "?" now reads ${showValue(item, item.asked, after[item.asked])}.`;
  }
  facts.learnerWork = describeGasWork(item, view);
  facts.constraints = constraintsOf(item);
  return { objects: [], facts };
}

// ── The journey's learner (liveJourneySpec row, the dry sweep) ───────────────────────────

/** The journey's answers: the key, and the wrong choice that shows the mode's first-listed miss it can. */
export function gasHarnessAnswers(item: GasItem): { correct: string; plainWrong: string } {
  const rank = GAS_MISSES[item.mode];
  const wrong = choicesOf(item).filter(c => !gasCorrect(item, c))
    .sort((a, b) => rank.indexOf(gasMiss(item, a)!) - rank.indexOf(gasMiss(item, b)!));
  return { correct: keyChoice(item), plainWrong: wrong[0] ?? '' };
}
