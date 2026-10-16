/**
 * gravity-drop-tower on the shared tutor/JEV teaching workspace (W1, plain shape; ROLLOUT C28).
 *
 * Every item is built and keyed by code from one physics model: without air every object falls h = 1/2 g t^2; with air
 * each object has its own top speed in air (`vt`), and it falls y = (vt^2/g) ln cosh(g t / vt). The key is what that
 * model says happens. Each mode is a task the learner does before the answer is on screen:
 * - observe (K-1): drop and WATCH, then report what happened (which landed first, or whether it sped up). The tower
 *   prints no times or speeds; the choices open once the learner has dropped.
 * - predict (1-3): say which of two objects lands first BEFORE the drop; the drop runs once the answer is credited.
 *   Hard items add the reason (outcome + reason choices), so "the ball first, because heavier things fall faster" is a
 *   named miss even when the outcome is right.
 * - compare (2-4): three objects released together from different heights; tap them in the order they will land.
 * - measure (4-5): a stopwatch table of measured drops; choose the fall time for a new height (or, hard, the height
 *   for a new time). The asked drop runs once credited.
 * - calculate (6-8): h = 1/2 g t^2; the fall time from a height (easy), the height from a time (medium), or the impact
 *   speed from a height (hard, two steps).
 * Difficulty (`config.difficulty`) is structural, never bigger numbers.
 *
 * Pure: the component, the generator, the adapter, the journey row and the tests read the same items, checks, misses
 * and scene.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';

export type DropMode = 'observe' | 'predict' | 'compare' | 'measure' | 'calculate';
export const DROP_MODES: DropMode[] = ['observe', 'predict', 'compare', 'measure', 'calculate'];
export type DropTier = 'easy' | 'medium' | 'hard';
/** observe: first | speed. predict: first | reason. compare: order. measure: time | height. calculate: time | height | impact. */
export type DropAsk = 'first' | 'speed' | 'reason' | 'order' | 'time' | 'height' | 'impact';

export const G = 9.8;

// ── Objects ──────────────────────────────────────────────────────────────────────────────

export type FallerId = 'bowling_ball' | 'rock' | 'brick' | 'hammer' | 'watermelon' | 'baseball' | 'marble'
  | 'tennis_ball' | 'basketball' | 'feather' | 'balloon' | 'paper_sheet' | 'paper_ball';
export interface Faller { name: string; emoji: string; mass: number; /** Top speed falling through air, m/s. */ vt: number }

/** `vt` is the speed air lets each object reach: compact heavy things ~30-80 m/s, a feather or a flat sheet ~1 m/s. */
export const FALLERS: Record<FallerId, Faller> = {
  bowling_ball: { name: 'bowling ball', emoji: '🎳', mass: 7, vt: 80 },
  rock: { name: 'rock', emoji: '🪨', mass: 3, vt: 50 },
  brick: { name: 'brick', emoji: '🧱', mass: 2, vt: 45 },
  hammer: { name: 'hammer', emoji: '🔨', mass: 1, vt: 40 },
  watermelon: { name: 'watermelon', emoji: '🍉', mass: 5, vt: 50 },
  baseball: { name: 'baseball', emoji: '⚾', mass: 0.15, vt: 33 },
  marble: { name: 'marble', emoji: '🔵', mass: 0.01, vt: 25 },
  tennis_ball: { name: 'tennis ball', emoji: '🎾', mass: 0.06, vt: 20 },
  basketball: { name: 'basketball', emoji: '🏀', mass: 0.6, vt: 20 },
  feather: { name: 'feather', emoji: '🪶', mass: 0.003, vt: 1 },
  balloon: { name: 'balloon', emoji: '🎈', mass: 0.005, vt: 1.5 },
  paper_sheet: { name: 'flat sheet of paper', emoji: '📄', mass: 0.005, vt: 1.2 },
  paper_ball: { name: 'crumpled paper ball', emoji: '🗞️', mass: 0.005, vt: 9 },
};
const DENSE: FallerId[] = ['bowling_ball', 'rock', 'brick', 'hammer', 'watermelon', 'baseball'];
const COMPACT_LIGHT: FallerId[] = ['marble', 'tennis_ball', 'baseball'];
const FLOATERS: FallerId[] = ['feather', 'balloon', 'paper_sheet'];
export const isFloater = (id: FallerId) => FALLERS[id].vt <= 2;
const kg = (m: number) => (m >= 1 ? `${m} kg` : m >= 0.01 ? `${Math.round(m * 1000)} g` : `${Math.round(m * 1000 * 10) / 10} g`);
export const massText = (id: FallerId) => kg(FALLERS[id].mass);

// ── Physics ──────────────────────────────────────────────────────────────────────────────

const lnCosh = (z: number) => (z > 20 ? z - Math.LN2 : Math.log(Math.cosh(z)));
const acoshExp = (x: number) => (x > 20 ? x + Math.LN2 : Math.acosh(Math.exp(x)));

/** Seconds to fall h metres from rest. */
export function fallTime(id: FallerId, h: number, air: boolean): number {
  if (!air) return Math.sqrt((2 * h) / G);
  const vt = FALLERS[id].vt;
  return (vt / G) * acoshExp((h * G) / (vt * vt));
}
/** Metres fallen after t seconds from rest. */
export function fallen(id: FallerId, t: number, air: boolean): number {
  if (!air) return 0.5 * G * t * t;
  const vt = FALLERS[id].vt;
  return ((vt * vt) / G) * lnCosh((G * t) / vt);
}
/** Speed (m/s) after t seconds. */
export function speedAt(id: FallerId, t: number, air: boolean): number {
  return air ? FALLERS[id].vt * Math.tanh((G * t) / FALLERS[id].vt) : G * t;
}

export const round2 = (x: number) => Math.round(x * 100) / 100;
export const fmt = (x: number) => String(round2(x));

// ── Items ────────────────────────────────────────────────────────────────────────────────

export interface Drop { obj: FallerId; height: number }
export interface DropItem {
  id: string;
  mode: DropMode;
  ask: DropAsk;
  air: boolean;
  /** Released together. For measure 'height' and calculate 'height' the height is the key and is never shown. */
  drops: Drop[];
  /** measure: the heights whose stopwatch times are in the table. */
  measured?: number[];
  /** measure 'height': the asked fall time; calculate 'height': the given fall time (s). */
  time?: number;
}

/** Two drops land "together" only without air (then exactly); with air, items are built only with clear gaps. */
const TOGETHER_GAP = 1e-9;
/** The order the drops land in (indices), and whether all land together. */
export function landingOrder(item: Pick<DropItem, 'drops' | 'air'>): number[] {
  return item.drops.map((d, i) => ({ i, t: fallTime(d.obj, d.height, item.air) })).sort((a, b) => a.t - b.t).map(x => x.i);
}
export function landTimes(item: Pick<DropItem, 'drops' | 'air'>): number[] {
  return item.drops.map(d => fallTime(d.obj, d.height, item.air));
}
export function landTogether(item: Pick<DropItem, 'drops' | 'air'>): boolean {
  const t = landTimes(item);
  return Math.max(...t) - Math.min(...t) < TOGETHER_GAP * Math.max(1, ...t);
}
/** The smallest gap between landings as a fraction of the later one. */
function minGap(item: Pick<DropItem, 'drops' | 'air'>): number {
  const t = landTimes(item).sort((a, b) => a - b);
  let g = Infinity;
  for (let i = 1; i < t.length; i++) g = Math.min(g, (t[i] - t[i - 1]) / t[i]);
  return g;
}

export const nameOf = (d: Drop) => FALLERS[d.obj].name;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ── Choices, keys, misses ────────────────────────────────────────────────────────────────

export type ObserveMiss = 'heavier_first' | 'lighter_first' | 'said_together' | 'slowed_first' | 'said_steady' | 'said_slowed';
export type PredictMiss = 'heavier_first' | 'lighter_first' | 'shape_first' | 'ignored_air' | 'slowed_first'
  | 'heavier_reason' | 'air_when_none';
export type CompareMiss = 'ranked_by_mass' | 'ignored_air' | 'reversed' | 'other_order';
export type MeasureMiss = 'linear_scaling' | 'kept_value' | 'added_step';
export type CalculateMiss = 'forgot_half' | 'no_root' | 'not_squared' | 'gave_time';
export type GravityDropMiss = ObserveMiss | PredictMiss | CompareMiss | MeasureMiss | CalculateMiss;
export const DROP_MISSES: Record<DropMode, readonly GravityDropMiss[]> = {
  observe: ['heavier_first', 'lighter_first', 'said_together', 'slowed_first', 'said_steady', 'said_slowed'],
  predict: ['heavier_first', 'lighter_first', 'shape_first', 'ignored_air', 'slowed_first', 'heavier_reason', 'air_when_none'],
  compare: ['ranked_by_mass', 'ignored_air', 'reversed', 'other_order'],
  measure: ['linear_scaling', 'kept_value', 'added_step'],
  calculate: ['forgot_half', 'no_root', 'not_squared', 'gave_time'],
};

export interface DropChoice { label: string; kind: 'key' | GravityDropMiss; value?: number }

const SPEED_CHOICES = ['It sped up', 'It kept the same speed', 'It slowed down'] as const;
const REASON = {
  same: 'gravity speeds both up the same',
  heavier: 'heavier things fall faster',
  lighter: 'lighter things fall faster',
  air: (slowed: string) => `air slows the ${slowed} more`,
};

/** A two-object item's verdict for "this one first", from the model. */
function pairMiss(item: DropItem, picked: number | 'together'): GravityDropMiss | 'key' {
  const [a, b] = item.drops, order = landingOrder(item), together = landTogether(item);
  if (picked === 'together') return together ? 'key' : item.mode === 'observe' ? 'said_together' : 'ignored_air';
  if (!together && order[0] === picked) return 'key';
  const me = item.drops[picked], other = picked === 0 ? b : a;
  if (item.air && !together) return 'slowed_first';
  if (FALLERS[me.obj].mass === FALLERS[other.obj].mass) return item.mode === 'observe' ? 'heavier_first' : 'shape_first';
  return FALLERS[me.obj].mass > FALLERS[other.obj].mass ? 'heavier_first' : 'lighter_first';
}

function numericLabel(item: DropItem, x: number): string {
  const unit = item.mode === 'measure' ? (item.ask === 'time' ? 's' : 'm')
    : item.ask === 'time' ? 's' : item.ask === 'height' ? 'm' : 'm/s';
  return `${fmt(x)} ${unit}`;
}

/** measure: the measured rows' times, and the asked value's key and wrong values. */
export const measuredTime = (h: number) => fallTime('rock', h, false);
function measureValues(item: DropItem): Array<{ v: number; kind: 'key' | MeasureMiss }> {
  const rows = item.measured ?? [], last = rows[rows.length - 1], lastT = measuredTime(last);
  if (item.ask === 'time') {
    const H = item.drops[0].height, out: Array<{ v: number; kind: 'key' | MeasureMiss }> = [{ v: measuredTime(H), kind: 'key' }];
    out.push({ v: lastT * (H / last), kind: 'linear_scaling' }, { v: lastT, kind: 'kept_value' });
    const step = lastT + (lastT - measuredTime(rows[rows.length - 2] ?? last));
    // "The same step again" is a miss only where it is not also the key (9x the height is 3x the time).
    if (rows.length > 1 && Math.abs(step - out[0].v) > 0.005) out.push({ v: step, kind: 'added_step' });
    return out;
  }
  const T = item.time!, out: Array<{ v: number; kind: 'key' | MeasureMiss }> = [{ v: item.drops[0].height, kind: 'key' }];
  out.push({ v: last * (T / lastT), kind: 'linear_scaling' }, { v: last, kind: 'kept_value' });
  if (rows.length > 1) out.push({ v: last + (last - rows[rows.length - 2]), kind: 'added_step' });
  return out;
}
function calculateValues(item: DropItem): Array<{ v: number; kind: 'key' | CalculateMiss }> {
  const h = item.drops[0].height;
  if (item.ask === 'time') return [{ v: Math.sqrt((2 * h) / G), kind: 'key' }, { v: Math.sqrt(h / G), kind: 'forgot_half' }, { v: (2 * h) / G, kind: 'no_root' }];
  if (item.ask === 'height') {
    const t = item.time!;
    return [{ v: 0.5 * G * t * t, kind: 'key' }, { v: G * t * t, kind: 'forgot_half' }, { v: 0.5 * G * t, kind: 'not_squared' }];
  }
  const t = Math.sqrt((2 * h) / G);
  return [{ v: G * t, kind: 'key' }, { v: Math.sqrt(G * h), kind: 'forgot_half' }, { v: 2 * G * h, kind: 'no_root' }, { v: t, kind: 'gave_time' }];
}

/** Every choice of a choice item, in screen order; null when two coincide (the item is not built). Compare has none. */
export function dropChoices(item: DropItem): DropChoice[] | null {
  if (item.ask === 'order') return null;
  let out: DropChoice[];
  if (item.ask === 'speed') {
    out = SPEED_CHOICES.map(label => ({ label, kind: label === 'It sped up' ? 'key' : label === 'It kept the same speed' ? 'said_steady' : 'said_slowed' }));
  } else if (item.ask === 'first') {
    const past = item.mode === 'observe';
    out = item.drops.map((d, i) => ({ label: past ? `The ${nameOf(d)}` : `The ${nameOf(d)} first`, kind: pairMiss(item, i) }));
    out.push({ label: past ? 'They landed together' : 'They land together', kind: pairMiss(item, 'together') });
  } else if (item.ask === 'reason') {
    const [heavy, light] = [...item.drops].sort((x, y) => FALLERS[y.obj].mass - FALLERS[x.obj].mass);
    const together = landTogether(item);
    out = [
      { label: `They land together: ${REASON.same}`, kind: together ? 'key' : 'ignored_air' },
      { label: `The ${nameOf(heavy)} first: ${REASON.heavier}`, kind: together ? 'heavier_first' : 'heavier_reason' },
      { label: `The ${nameOf(heavy)} first: ${REASON.air(nameOf(light))}`, kind: together ? 'air_when_none' : 'key' },
      { label: `The ${nameOf(light)} first: ${REASON.lighter}`, kind: together ? 'lighter_first' : 'slowed_first' },
    ];
  } else {
    const vals = item.mode === 'measure' ? measureValues(item) : calculateValues(item);
    out = vals.map(x => ({ label: numericLabel(item, x.v), kind: x.kind, value: x.v }));
    if (out.some(c => !Number.isFinite(c.value!) || c.value! <= 0)) return null;
    out.sort((a, b) => a.value! - b.value!);
  }
  if (new Set(out.map(c => c.label)).size !== out.length || out.filter(c => c.kind === 'key').length !== 1) return null;
  return out;
}

export const choicesOf = (item: DropItem): string[] => (dropChoices(item) ?? []).map(c => c.label);
export function keyChoice(item: DropItem): string {
  if (item.ask === 'order') return keyOrder(item).map(i => nameOf(item.drops[i])).join(', ');
  return dropChoices(item)!.find(c => c.kind === 'key')!.label;
}

/** compare: the key is the landing order; an order is the indices tapped, first to land first. */
export const keyOrder = (item: DropItem) => landingOrder(item);
const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const byHeight = (item: DropItem) => item.drops.map((d, i) => ({ i, h: d.height })).sort((a, b) => a.h - b.h).map(x => x.i);
const byMass = (item: DropItem) => item.drops.map((d, i) => ({ i, m: FALLERS[d.obj].mass })).sort((a, b) => b.m - a.m).map(x => x.i);
const distinctMasses = (item: DropItem) => new Set(item.drops.map(d => FALLERS[d.obj].mass)).size === item.drops.length;

export function orderMiss(item: DropItem, order: number[]): CompareMiss | undefined {
  if (order.length !== item.drops.length || same(order, keyOrder(item))) return undefined;
  if (distinctMasses(item) && same(order, byMass(item))) return 'ranked_by_mass';
  if (item.air && same(order, byHeight(item))) return 'ignored_air';
  if (same(order, [...byHeight(item)].reverse())) return 'reversed';
  return 'other_order';
}

/** The learner's answer: a choice label, or for compare the tapped order. */
export type DropWork = { choice: string | null; order: number[] };

export function dropCorrect(item: DropItem | undefined, work: DropWork): boolean {
  if (!item) return false;
  if (item.ask === 'order') return same(work.order, keyOrder(item));
  return work.choice !== null && work.choice === keyChoice(item);
}
export function dropMiss(item: DropItem | undefined, work: DropWork): GravityDropMiss | undefined {
  if (!item || dropCorrect(item, work)) return undefined;
  if (item.ask === 'order') return orderMiss(item, work.order);
  const c = dropChoices(item)?.find(x => x.label === work.choice);
  return c && c.kind !== 'key' ? c.kind : undefined;
}

// ── The ask ──────────────────────────────────────────────────────────────────────────────

const AIR_TEXT = (air: boolean) => (air ? 'in ordinary air' : 'inside a tall tube with all the air pumped out');
const listOf = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const withMass = (d: Drop) => `a ${nameOf(d)} (${massText(d.obj)})`;

export function askOf(item: DropItem): string {
  const d = item.drops, h = d[0]?.height;
  switch (item.mode) {
    case 'observe':
      return item.ask === 'speed'
        ? `Drop the ${nameOf(d[0])} from ${h} m ${AIR_TEXT(item.air)} and watch it fall. As it fell, did it speed up, keep the same speed, or slow down?`
        : `Drop ${listOf(d.map(withMass))} together from ${h} m ${AIR_TEXT(item.air)} and watch. Which one reached the ground first, or did they land together?`;
    case 'predict':
      return `${cap(listOf(d.map(withMass)))} will be let go at the same moment from ${h} m, ${AIR_TEXT(item.air)}. `
        + (item.ask === 'reason' ? 'Before the drop: which lands first, and why?' : 'Before the drop: which lands first, or do they land together?');
    case 'compare':
      return `Three objects are let go at the same moment ${AIR_TEXT(item.air)}: ${listOf(d.map(x => `a ${nameOf(x)} (${massText(x.obj)}) from ${x.height} m`))}. `
        + 'Tap them in the order they will land, first to land first.';
    case 'measure': {
      const rows = (item.measured ?? []).map(m => `${m} m took ${fmt(measuredTime(m))} s`);
      return `A stopwatch timed a rock dropped with no air: ${listOf(rows)}. `
        + (item.ask === 'time' ? `How long will it take to fall from ${h} m?` : `From what height will the fall take ${fmt(item.time!)} s?`);
    }
    case 'calculate':
      return item.ask === 'time' ? `A rock is dropped from ${h} m with no air (g = 9.8 m/s²). How long does it take to reach the ground?`
        : item.ask === 'height' ? `A rock dropped with no air takes ${fmt(item.time!)} s to reach the ground (g = 9.8 m/s²). From what height was it dropped?`
          : `A rock is dropped from ${h} m with no air (g = 9.8 m/s²). How fast is it moving when it reaches the ground?`;
  }
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
const shuffle = <T,>(xs: T[], rng: Rng): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const pick = <T,>(xs: T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)];

const HEIGHTS = [5, 8, 10, 12];
/** With air, a pair or a three-way order is built only when every landing is at least this far apart. */
const CLEAR_GAP = 0.15;

function pairItem(mode: DropMode, ask: DropAsk, a: FallerId, b: FallerId, air: boolean, h: number, rng: Rng): DropItem {
  const drops = shuffle([{ obj: a, height: h }, { obj: b, height: h }], rng);
  return { id: '', mode, ask, air, drops };
}

/** observe and predict: two-object items. A pair with air is a floater and a dense or compact object. */
function pairCandidates(mode: 'observe' | 'predict', tier: DropTier, rng: Rng): DropItem[] {
  const out: DropItem[] = [];
  const airPair = (ask: DropAsk) => pairItem(mode, ask, pick(DENSE, rng), pick(FLOATERS, rng), true, pick(HEIGHTS, rng), rng);
  const noAirPair = (ask: DropAsk) => pairItem(mode, ask, pick(DENSE.slice(0, 5), rng), pick([...FLOATERS, ...COMPACT_LIGHT], rng), false, pick(HEIGHTS, rng), rng);
  if (mode === 'observe') {
    if (tier === 'easy') for (let i = 0; i < 6; i++) out.push(airPair('first'));
    if (tier === 'medium') for (let i = 0; i < 6; i++) out.push(i % 2 ? airPair('first') : noAirPair('first'));
    if (tier === 'hard') {
      for (let i = 0; i < 3; i++) out.push({ id: '', mode, ask: 'speed', air: false, drops: [{ obj: pick(DENSE, rng), height: pick(HEIGHTS, rng) }] });
      for (let i = 0; i < 3; i++) out.push(i % 2 ? airPair('first') : noAirPair('first'));
    }
    return out;
  }
  if (tier === 'easy') {
    // The same pair twice: once without air, once with (the contrast is the support).
    for (let i = 0; i < 3; i++) {
      const a = pick(DENSE, rng), b = pick(FLOATERS, rng), h = pick(HEIGHTS, rng);
      out.push(pairItem(mode, 'first', a, b, false, h, rng), pairItem(mode, 'first', a, b, true, h, rng));
    }
  } else if (tier === 'medium') {
    // The paper pair (the same mass, a different shape) and unrelated pairs, air on or off in no set order.
    const h = pick(HEIGHTS, rng);
    out.push(pairItem(mode, 'first', 'paper_sheet', 'paper_ball', true, h, rng), pairItem(mode, 'first', 'paper_sheet', 'paper_ball', false, h, rng));
    for (let i = 0; i < 4; i++) out.push(i % 2 ? airPair('first') : noAirPair('first'));
  } else {
    for (let i = 0; i < 6; i++) out.push(i % 2 ? airPair('reason') : noAirPair('reason'));
  }
  return out;
}

function compareCandidates(tier: DropTier, rng: Rng): DropItem[] {
  const out: DropItem[] = [];
  const heightSets = [[2, 5, 10], [3, 8, 15], [4, 9, 16], [5, 10, 20], [2, 6, 12], [3, 6, 12]];
  for (let n = 0; n < 60 && out.length < 8; n++) {
    const hs = shuffle(pick(heightSets, rng), rng);
    let objs: FallerId[];
    if (tier === 'easy') { const o = pick(DENSE, rng); objs = [o, o, o]; }
    else if (tier === 'medium') objs = shuffle(DENSE, rng).slice(0, 3);
    else objs = [...shuffle(DENSE, rng).slice(0, 2), pick(FLOATERS, rng)];
    const air = tier === 'hard';
    const item: DropItem = { id: '', mode: 'compare', ask: 'order', air, drops: objs.map((obj, i) => ({ obj, height: hs[i] })) };
    if (minGap(item) < CLEAR_GAP) continue;
    // medium: the mass order is not the landing order; hard: the height order is not either (air changes it).
    if (tier !== 'easy' && same(byMass(item), keyOrder(item))) continue;
    if (tier === 'hard' && same(byHeight(item), keyOrder(item))) continue;
    if (tier === 'hard' && !isFloater(item.drops[keyOrder(item)[2]].obj)) continue;
    out.push(item);
  }
  return out;
}

/** Base heights whose 4x and 9x and 16x stay on the tower (80 m). */
const BASES = [1.25, 2, 3, 5];
function measureCandidates(tier: DropTier): DropItem[] {
  const out: DropItem[] = [];
  for (const h0 of BASES) {
    const base = { id: '', mode: 'measure' as const, air: false, measured: [h0, 4 * h0] };
    if (tier === 'easy') out.push({ ...base, ask: 'time', drops: [{ obj: 'rock', height: 16 * h0 }] });
    if (tier === 'medium') out.push({ ...base, ask: 'time', drops: [{ obj: 'rock', height: 9 * h0 }] });
    if (tier === 'hard') out.push({ ...base, ask: 'height', time: round2(3 * measuredTime(h0)), drops: [{ obj: 'rock', height: 9 * h0 }] });
  }
  return out;
}

function calculateCandidates(tier: DropTier): DropItem[] {
  const base = { id: '', mode: 'calculate' as const, air: false };
  if (tier === 'medium') return [1.5, 2, 2.5, 3].map(t => ({ ...base, ask: 'height' as const, time: t, drops: [{ obj: 'rock' as const, height: round2(0.5 * G * t * t) }] }));
  const ask: DropAsk = tier === 'easy' ? 'time' : 'impact';
  // From 4.9 m the fall takes 1 s, so the impact speed is g itself; that item is not built.
  return (ask === 'impact' ? [19.6, 44.1, 78.4] : [4.9, 19.6, 44.1, 78.4]).map(h => ({ ...base, ask, drops: [{ obj: 'rock' as const, height: h }] }));
}

function candidates(mode: DropMode, tier: DropTier, rng: Rng): DropItem[] {
  const raw = mode === 'observe' || mode === 'predict' ? pairCandidates(mode, tier, rng)
    : mode === 'compare' ? compareCandidates(tier, rng) : mode === 'measure' ? measureCandidates(tier) : calculateCandidates(tier);
  return raw.filter(i => validDropItem({ ...i, id: 'x' }));
}

/** A session spreads over pairs, air settings and keys. */
const shapeKey = (i: DropItem) => `${i.ask}:${i.air}:${i.drops.map(d => d.obj).sort().join('+')}`;

export const ITEM_COUNT: Record<DropMode, [number, number]> = { observe: [3, 2], predict: [4, 2], compare: [3, 2], measure: [3, 2], calculate: [3, 2] };

export function buildModeItems(mode: DropMode, tier: DropTier, count: number, rng: Rng): DropItem[] {
  const pool = candidates(mode, tier, rng);
  // observe/predict easy and medium keep their order (contrast pairs sit together); the rest are shuffled.
  const ordered = (mode === 'predict' && tier === 'easy') ? pool : shuffle(pool, rng);
  const picked: DropItem[] = [];
  const shapes = new Set<string>();
  // observe hard: the speed item first; then the rest without a repeated shape.
  if (mode === 'observe' && tier === 'hard') { const s = ordered.find(i => i.ask === 'speed'); if (s) { picked.push(s); shapes.add(shapeKey(s)); } }
  for (const i of ordered) {
    if (picked.length >= count) break;
    if (mode === 'observe' && tier === 'hard' && i.ask === 'speed') continue;
    if (!shapes.has(shapeKey(i))) { picked.push(i); shapes.add(shapeKey(i)); }
  }
  for (const i of ordered) { if (picked.length >= count) break; if (!picked.includes(i)) picked.push(i); }
  // No session whose every key is "together" or every key is the same choice position.
  return picked;
}

export function buildDropItems(opts: { modes: DropMode[]; tier: DropTier; rng: Rng }): DropItem[] {
  const out: DropItem[] = [];
  for (const mode of opts.modes) out.push(...buildModeItems(mode, opts.tier, ITEM_COUNT[mode][opts.modes.length === 1 ? 0 : 1], opts.rng));
  return out.map((item, i) => ({ ...item, id: `${item.mode}-${i + 1}` }));
}

// ── Lesson data → items ──────────────────────────────────────────────────────────────────

export interface DropItemsSource {
  title?: string;
  challengeTypes?: string[];
  difficulty?: string;
  supportTier?: string;
  items?: DropItem[];
  gradeLevel?: string;
  /** Legacy generations (before 2026-10-15): read only for the modes. */
  challenges?: Array<{ type?: string }>;
}

export const resolveTier = (d: DropItemsSource): DropTier => {
  const t = (d.difficulty ?? d.supportTier ?? '').toLowerCase();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

/** The modes a lesson asks: its pin, else the legacy challenges' types, else predict. */
export function resolveDropModes(d: DropItemsSource): DropMode[] {
  const asked = (d.challengeTypes ?? []).filter((m): m is DropMode => (DROP_MODES as string[]).includes(m));
  if (asked.length) return DROP_MODES.filter(m => asked.includes(m));
  const legacy = (d.challenges ?? []).map(c => c?.type).filter((m): m is DropMode => (DROP_MODES as string[]).includes(m ?? ''));
  if (legacy.length) return DROP_MODES.filter(m => legacy.includes(m));
  return ['predict'];
}

const ASKS: Record<DropMode, DropAsk[]> = {
  observe: ['first', 'speed'], predict: ['first', 'reason'], compare: ['order'], measure: ['time', 'height'], calculate: ['time', 'height', 'impact'],
};
const positive = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x > 0;

/** False when a stored item is not one code could have built (its key would not be computable or would be unclear). */
export function validDropItem(i: DropItem | undefined): i is DropItem {
  if (!i || typeof i.id !== 'string' || !(DROP_MODES as string[]).includes(i.mode) || !ASKS[i.mode]?.includes(i.ask)) return false;
  if (!Array.isArray(i.drops) || !i.drops.every(d => d && d.obj in FALLERS && positive(d.height) && d.height <= 80)) return false;
  // An order is three drops (two on its simpler practice item); a pair is two from one height.
  const n = i.ask === 'order' ? (i.drops.length === 2 ? 2 : 3) : i.ask === 'first' || i.ask === 'reason' ? 2 : 1;
  if (i.drops.length !== n || typeof i.air !== 'boolean') return false;
  if (i.ask !== 'order' && n === 2 && i.drops[0].height !== i.drops[1].height) return false;
  if ((i.ask === 'first' || i.ask === 'reason') && i.air && (landTogether(i) || minGap(i) < CLEAR_GAP)) return false;
  if (i.ask === 'reason' && (FALLERS[i.drops[0].obj].mass === FALLERS[i.drops[1].obj].mass)) return false;
  if (i.ask === 'order' && (minGap(i) < CLEAR_GAP)) return false;
  if (i.ask === 'speed' && (i.air && isFloater(i.drops[0].obj))) return false;
  if (i.mode === 'measure' && (!Array.isArray(i.measured) || !i.measured.length || !i.measured.every(positive) || i.air)) return false;
  if (i.ask === 'height' && !positive(i.time)) return false;
  if ((i.mode === 'measure' || i.mode === 'calculate') && i.air) return false;
  if (i.ask !== 'order' && !dropChoices(i)) return false;
  return true;
}

/** Every item of the session: the stored, code-built items when valid, else built from the lesson's own fields. */
export function dropItems(d: DropItemsSource): DropItem[] {
  const stored = Array.isArray(d.items) ? d.items.filter(validDropItem) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  const modes = resolveDropModes(d);
  return buildDropItems({ modes, tier: resolveTier(d), rng: seededRng(`${d.title ?? 'drop'}:${modes.join(',')}`) });
}

// ── Assignment, spoken answers ───────────────────────────────────────────────────────────

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];

/** The answer a spoken reply is judged against, with the ways a learner says it. */
export function dropExpectedAnswer(item: DropItem): string {
  const key = keyChoice(item), choices = choicesOf(item), at = choices.indexOf(key);
  const place = `its place in the list ("the ${ORDINAL[at]} one")`;
  const others = choices.filter(c => c !== key).map(c => `"${c}"`).join(', ');
  if (item.ask === 'reason') {
    const [outcome, reason] = key.split(': ');
    return `"${key}": the outcome ("${outcome}") AND that reason in the learner's own words, or ${place}. The outcome `
      + `alone is not complete yet. ${others} are wrong, and so is the right outcome with one of their reasons.`;
  }
  if (item.ask === 'first' || item.ask === 'speed') {
    return `"${key}": those words or the same meaning in the learner's own words, or ${place}, count. ${others} are wrong, `
      + 'and so is naming two or hedging between them.';
  }
  const [num, unit] = key.split(' ');
  return `"${key}": the number ${num} said any way (rounded to one decimal counts), with or without "${unit}", or ${place}, counts. ${others} are wrong.`;
}

const WHAT: Record<GravityDropMiss, string> = {
  heavier_first: 'says the heavier one lands first',
  lighter_first: 'says the lighter one lands first',
  said_together: 'says they landed together',
  slowed_first: 'picks the one the air slows most as first',
  said_steady: 'says it kept the same speed',
  said_slowed: 'says it slowed down',
  shape_first: 'says one shape lands first with no air',
  ignored_air: 'says they land together though air is in the tower',
  heavier_reason: 'gives the right object for the wrong reason (heavier things fall faster)',
  air_when_none: 'blames the air though the tube has no air',
  ranked_by_mass: 'orders them heaviest first',
  reversed: 'orders them highest first',
  other_order: 'is another order',
  linear_scaling: 'scales the time in step with the height',
  kept_value: 'keeps the last measured value',
  added_step: 'adds the same step again',
  forgot_half: 'leaves out the one half',
  no_root: 'leaves out the square root',
  not_squared: 'does not square the time',
  gave_time: 'gives the fall time instead of the speed',
};

/** A spoken item's known wrong answers, most specific first, with the tap's miss ids. Compare (an order) has none. */
export function dropSpokenMisses(item: DropItem): KnownMiss[] {
  if (item.ask === 'order') return [];
  const groups = new Map<GravityDropMiss, string[]>();
  for (const c of dropChoices(item) ?? []) if (c.kind !== 'key') groups.set(c.kind, [...(groups.get(c.kind) ?? []), c.label]);
  const fact = `The right answer is "${keyChoice(item)}".`;
  return DROP_MISSES[item.mode].filter(m => groups.has(m)).map(m => ({ id: m,
    pattern: `${fact} The learner's answer ${WHAT[m]}: ${groups.get(m)!.map(x => `"${x}"`).join(', ')}.`, examples: groups.get(m)! }));
}

const HOW_CHOICE = 'The learner answers by saying it, or tapping one choice and pressing Check Answer.';
const HOW_ORDER = 'The learner taps the three objects in landing order and presses Check Answer.';

export function workspaceAssignment(item: DropItem): TeachingAssignment {
  if (item.ask === 'order') return { id: item.id, task: `${askOf(item)} ${HOW_ORDER}`, response: 'gesture' };
  const misses = dropSpokenMisses(item);
  return { id: item.id, task: `${askOf(item)} ${HOW_CHOICE}`, response: 'speech', acceptsGesture: true,
    expectedAnswer: dropExpectedAnswer(item), ...(misses.length ? { misses } : {}) };
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface DropView extends DropWork {
  /** observe: how many drops the learner has run. */
  drops: number;
  /** The item is credited (or, scripted, revealed) and the drop has run. */
  solved: boolean;
}

export function describeDropWork(item: DropItem | undefined, view: DropWork): string {
  if (!item) return 'Nothing chosen yet';
  if (item.ask === 'order') return view.order.length ? `Tapped in order: ${view.order.map(i => nameOf(item.drops[i])).join(', ')}` : 'Nothing tapped yet';
  return view.choice ? `Chose "${view.choice}"` : 'Nothing chosen yet';
}

const CONSTRAINTS: Record<DropMode, string> = {
  observe: 'The learner presses Drop to watch (as many times as they like, with Slow motion if they want), then says or taps what they saw; the activity judges the tap. No times or speeds are printed. "Which one landed first?" assumes one did, so it is not asked; ask what the learner saw at the ground. You cannot drop, tap or check for the learner.',
  predict: 'The learner says or taps a prediction before anything falls; the drop runs on screen only after the answer is credited. You cannot drop, tap or check for the learner.',
  compare: 'The learner taps the objects in landing order and checks; the drop runs on screen only after the order is credited. You cannot tap, check or drop for the learner.',
  measure: 'The learner may replay any measured drop (its stopwatch shows the time in the table). The asked drop runs only after the answer is credited. You cannot tap, check or drop for the learner.',
  calculate: 'The learner says or taps a value; the drop runs on screen, with its stopwatch, only after the answer is credited. You cannot tap, check or drop for the learner.',
};

function shownText(item: DropItem): string {
  const air = item.air ? 'Air is in the tower (drawn as faint air lines).' : 'The tower is an empty tube with the air pumped out (no air lines).';
  const objs = (ds: Drop[]) => ds.map(d => `${FALLERS[d.obj].emoji} ${nameOf(d)} (${massText(d.obj)})`).join(', ');
  switch (item.mode) {
    case 'observe': case 'predict':
      return `A drop tower ${item.drops[0].height} m tall with ${objs(item.drops)} side by side on the top platform. ${air}`
        + (item.mode === 'observe' ? ' No stopwatch or speed is shown.' : ' Nothing has fallen yet.');
    case 'compare':
      return `Three columns, each with its own platform: ${item.drops.map(d => `${nameOf(d)} (${massText(d.obj)}) at ${d.height} m`).join(', ')}. ${air} Nothing has fallen yet.`;
    case 'measure':
      return `A stopwatch table for a rock dropped with no air: ${(item.measured ?? []).map(m => `${m} m, ${fmt(measuredTime(m))} s`).join('; ')}; `
        + (item.ask === 'time' ? `and ${item.drops[0].height} m, "?" s.` : `and "?" m, ${fmt(item.time!)} s.`) + ' Each measured row has a replay button.';
    case 'calculate':
      return item.ask === 'height' ? `A tower whose height is marked "?" m, a rock, and a stopwatch reading ${fmt(item.time!)} s. g = 9.8 m/s².`
        : `A tower ${item.drops[0].height} m tall with a rock on top. g = 9.8 m/s². The ${item.ask === 'time' ? 'stopwatch' : 'speed at the ground'} shows "?".`;
  }
}

function runText(item: DropItem): string {
  const order = landingOrder(item);
  if (item.mode === 'measure' || item.mode === 'calculate') {
    const t = fallTime('rock', item.drops[0].height, false);
    return `The drop has run: from ${item.drops[0].height} m the stopwatch read ${fmt(t)} s`
      + (item.ask === 'impact' ? ` and the rock hit the ground at ${fmt(speedAt('rock', t, false))} m/s.` : '.');
  }
  if (item.ask === 'speed') return 'The drop has run with ghost pictures every tenth of the fall: the gaps between them grew, so it sped up.';
  if (item.ask === 'order') return `The drop has run: they landed ${order.map(i => nameOf(item.drops[i])).join(', then ')}.`;
  return landTogether(item) ? 'The drop has run: they landed together.' : `The drop has run: the ${nameOf(item.drops[order[0]])} landed first.`;
}

/** What is drawn and asked. Never which choice is right; the outcome only once credited. */
export function workspaceScene(item: DropItem, view: DropView): WorkspaceScene {
  const facts: Record<string, string> = { kind: item.mode, question: askOf(item), shown: shownText(item) };
  if (item.ask === 'order') facts.objects = item.drops.map(d => nameOf(d)).join(', ');
  else facts.choices = choicesOf(item).map((c, i) => `${i + 1}) ${c}`).join('  ');
  if (item.mode === 'observe') facts.watched = view.drops ? `The learner has dropped them ${view.drops === 1 ? 'once' : `${view.drops} times`}.` : 'The learner has not dropped yet; the choices open after the first drop.';
  if (view.solved) facts.run = runText(item);
  facts.learnerWork = describeDropWork(item, view);
  facts.constraints = CONSTRAINTS[item.mode];
  return { objects: [], facts };
}

// ── The journey's learner (liveJourneySpec row, the dry sweep) ───────────────────────────

/** The journey's answers: the key and the wrong answer that shows the mode's first-listed miss it can. */
export function dropHarnessAnswers(item: DropItem): { correct: string[]; plainWrong: string[] } {
  if (item.ask === 'order') {
    const names = (o: number[]) => o.map(i => tapLabel(item, i));
    const key = keyOrder(item);
    const wrongs = [byMass(item), byHeight(item), [...byHeight(item)].reverse(), [...key].reverse(), [key[1], key[0], key[2]]]
      .filter(o => !same(o, key));
    const rank = DROP_MISSES.compare;
    wrongs.sort((a, b) => rank.indexOf(orderMiss(item, a)!) - rank.indexOf(orderMiss(item, b)!));
    return { correct: names(key), plainWrong: names(wrongs[0]) };
  }
  const rank = DROP_MISSES[item.mode];
  const wrong = (dropChoices(item) ?? []).filter(c => c.kind !== 'key')
    .sort((a, b) => rank.indexOf(a.kind as GravityDropMiss) - rank.indexOf(b.kind as GravityDropMiss));
  return { correct: [keyChoice(item)], plainWrong: wrong[0] ? [wrong[0].label] : [] };
}

/** The aria-label of a compare object's tap button. */
export const tapLabel = (item: DropItem, i: number) => `${cap(nameOf(item.drops[i]))} from ${item.drops[i].height} m`;
