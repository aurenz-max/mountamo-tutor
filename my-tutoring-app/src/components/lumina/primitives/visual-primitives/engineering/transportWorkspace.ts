/**
 * transport-challenge's domain: the items, their keys, checks and misses, and the scene. Its live wiring is
 * `transportChallenge.card.ts` + `transportChallenge.boss.ts` (a SAY_OR_SHOW card on the spoken preset).
 *
 * Every item is a job (move a load of people or tons of cargo) and a set of vehicles, each card showing what ONE trip
 * carries and costs (dollars, hours, kg of CO2). A vehicle does every trip itself, one after another, so its totals
 * are trips x the per-trip figure, and trips = the load / what one trip carries, rounded up (a part-full trip is still
 * a trip). Code builds the numbers and the key; Gemini writes only the names (title, places, what is moved, which
 * vehicle the lesson is about). Each mode is one task:
 * - single_constraint: one limit (a budget, a time or a CO2 cap); exactly one vehicle can do the job within it.
 * - multi_constraint: two limits; exactly one vehicle keeps both, and the others each break one or both.
 * - full_optimization: three limits; no vehicle keeps all three, exactly one breaks only one of them.
 * `config.difficulty` is structural: easy loads divide evenly into every vehicle's trips and the cards show only the
 * limited figures; medium needs a part-full trip somewhere, shows every figure, and the vehicle cheapest per trip is
 * not the answer; hard adds a vehicle that would pass only if its part-full trip were not counted.
 * The answer is one vehicle: said aloud or tapped and checked (J14).
 *
 * Pure: the component, the generator, the boss and the tests read the same items, checks, misses and scene.
 */
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { TRANSPORT_MISSES } from './transportChallenge.card';

export type TransportMode = 'single_constraint' | 'multi_constraint' | 'full_optimization';
export const TRANSPORT_MODES: TransportMode[] = ['single_constraint', 'multi_constraint', 'full_optimization'];
export type TransportTier = 'easy' | 'medium' | 'hard';
export type LimitType = 'budget' | 'time' | 'co2';
export const LIMIT_TYPES: LimitType[] = ['budget', 'time', 'co2'];
export type LoadKind = 'people' | 'cargo';

// ── The vehicles (per trip, there and back) ──────────────────────────────────────────────

export interface TransportVehicle {
  id: string; name: string; emoji: string;
  /** What one trip carries, in the job's unit (people, or tons). */
  capacity: number;
  /** Per trip: dollars, hours (there and back), kg of CO2. */
  cost: number; hours: number; co2: number;
}
interface VehicleSpec extends TransportVehicle { kind: LoadKind }

export const VEHICLES: VehicleSpec[] = [
  { id: 'car', kind: 'people', name: 'Car', emoji: '🚗', capacity: 4, cost: 15, hours: 1, co2: 5 },
  { id: 'minivan', kind: 'people', name: 'Minivan', emoji: '🚐', capacity: 8, cost: 25, hours: 1, co2: 8 },
  { id: 'bus', kind: 'people', name: 'Bus', emoji: '🚌', capacity: 40, cost: 90, hours: 2, co2: 30 },
  { id: 'ferry', kind: 'people', name: 'Ferry', emoji: '⛴️', capacity: 120, cost: 300, hours: 3, co2: 120 },
  { id: 'plane', kind: 'people', name: 'Plane', emoji: '✈️', capacity: 150, cost: 1500, hours: 1, co2: 500 },
  { id: 'train', kind: 'people', name: 'Train', emoji: '🚆', capacity: 300, cost: 600, hours: 1, co2: 50 },
  { id: 'delivery_truck', kind: 'cargo', name: 'Delivery truck', emoji: '🚚', capacity: 5, cost: 40, hours: 2, co2: 15 },
  { id: 'semi_truck', kind: 'cargo', name: 'Semi truck', emoji: '🚛', capacity: 20, cost: 150, hours: 2, co2: 60 },
  { id: 'cargo_plane', kind: 'cargo', name: 'Cargo plane', emoji: '🛩️', capacity: 100, cost: 5000, hours: 1, co2: 3000 },
  { id: 'freight_train', kind: 'cargo', name: 'Freight train', emoji: '🚂', capacity: 400, cost: 1800, hours: 4, co2: 400 },
  { id: 'cargo_ship', kind: 'cargo', name: 'Cargo ship', emoji: '🚢', capacity: 1000, cost: 4000, hours: 12, co2: 1500 },
];
export const VEHICLE_IDS = VEHICLES.map(v => v.id);
/** A vehicle needs at most this many trips, so every product stays one a child can work. */
export const MAX_TRIPS = 40;

// ── Items ────────────────────────────────────────────────────────────────────────────────

export interface TransportLimit { type: LimitType; max: number }
export interface TransportLoad { kind: LoadKind; amount: number; name: string }
export interface TransportItem {
  id: string; mode: TransportMode;
  title: string; origin: string; destination: string;
  load: TransportLoad;
  limits: TransportLimit[];
  /** In card order. */
  vehicles: TransportVehicle[];
  /** The per-trip figures each card shows (easy: only the limited ones). */
  shows: LimitType[];
}

/** The lesson's names for one job; code builds its numbers. */
export interface TransportFrame { title: string; origin: string; destination: string; kind: LoadKind; loadName: string; featured?: string }

export const unitOf = (kind: LoadKind) => (kind === 'people' ? 'people' : 'tons');
export const figure = (v: TransportVehicle, t: LimitType) => (t === 'budget' ? v.cost : t === 'time' ? v.hours : v.co2);
export const tripsFor = (item: Pick<TransportItem, 'load'>, v: TransportVehicle) => Math.ceil(item.load.amount / v.capacity);
export const totalFor = (item: Pick<TransportItem, 'load'>, v: TransportVehicle, t: LimitType) => tripsFor(item, v) * figure(v, t);
/** The total if the last, part-full trip were not counted (the load / the capacity, unrounded); one trip stays one. */
const unroundedTotal = (item: Pick<TransportItem, 'load'>, v: TransportVehicle, t: LimitType) =>
  Math.max(1, item.load.amount / v.capacity) * figure(v, t);
/** The load fills every trip, or fits in one trip: no part-full trip to count. */
export const fillsEvenly = (item: Pick<TransportItem, 'load'>, v: TransportVehicle) =>
  item.load.amount % v.capacity === 0 || item.load.amount < v.capacity;
export const brokenLimits = (item: Pick<TransportItem, 'load' | 'limits'>, v: TransportVehicle) =>
  item.limits.filter(l => totalFor(item, v, l.type) > l.max);
const brokenUnrounded = (item: Pick<TransportItem, 'load' | 'limits'>, v: TransportVehicle) =>
  item.limits.filter(l => unroundedTotal(item, v, l.type) > l.max).length;
/** The number of limits the answer breaks: none, or exactly one when no vehicle keeps all three. */
export const targetBroken = (mode: TransportMode) => (mode === 'full_optimization' ? 1 : 0);

/** The vehicle that answers the item, or null when the item has no single answer. */
export function keyVehicle(item: TransportItem): TransportVehicle | null {
  const counts = item.vehicles.map(v => brokenLimits(item, v).length);
  const target = targetBroken(item.mode);
  if (Math.min(...counts) !== target) return null;
  const at = counts.filter(c => c === target);
  return at.length === 1 ? item.vehicles[counts.indexOf(target)] : null;
}

// ── Checks and misses ────────────────────────────────────────────────────────────────────

/** The learner's work: the card picked. */
export interface TransportWork { picked: string | null }
export const emptyWork = (): TransportWork => ({ picked: null });

export function transportCorrect(item: TransportItem | undefined, w: TransportWork): boolean {
  return !!item && !!w.picked && keyVehicle(item)?.id === w.picked;
}

export type TransportMiss = 'forgot_round_up' | 'cheapest_per_trip' | 'fewest_trips' | 'one_limit_only' | 'over_limit' | 'breaks_more';
export { TRANSPORT_MISSES };

/** The pattern of one wrong pick, most specific first. Names what the pick is, never why the learner chose it. */
export function vehicleMiss(item: TransportItem, v: TransportVehicle): TransportMiss {
  const broken = brokenLimits(item, v);
  // It would do as well as the answer if its part-full trip were not counted.
  if (brokenUnrounded(item, v) <= targetBroken(item.mode)) return 'forgot_round_up';
  // It is the cheapest per trip (strictly) on a limit it breaks.
  const lowest = (t: LimitType) => { const fs = item.vehicles.map(x => figure(x, t)); const m = Math.min(...fs); return fs.filter(f => f === m).length === 1 && figure(v, t) === m; };
  if (broken.some(l => lowest(l.type))) return 'cheapest_per_trip';
  // It carries the most per trip (strictly), so it needs the fewest trips.
  const caps = item.vehicles.map(x => x.capacity), maxCap = Math.max(...caps);
  if (v.capacity === maxCap && caps.filter(c => c === maxCap).length === 1) return 'fewest_trips';
  if (item.mode === 'full_optimization') return 'breaks_more';
  if (item.mode === 'multi_constraint' && broken.length === 1) return 'one_limit_only';
  return 'over_limit';
}

export function transportMiss(item: TransportItem | undefined, w: TransportWork): TransportMiss | undefined {
  if (!item || !w.picked || transportCorrect(item, w)) return undefined;
  const v = item.vehicles.find(x => x.id === w.picked);
  return v ? vehicleMiss(item, v) : undefined;
}

// ── Words ────────────────────────────────────────────────────────────────────────────────

export const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
export const amountText = (t: LimitType, n: number) => (t === 'budget' ? money(n) : t === 'time' ? `${n} hour${n === 1 ? '' : 's'}` : `${n.toLocaleString('en-US')} kg of CO₂`);
export const LIMIT_NAME: Record<LimitType, string> = { budget: 'budget', time: 'time limit', co2: 'CO₂ limit' };
export const limitText = (l: TransportLimit) => (l.type === 'budget' ? `spend no more than ${money(l.max)}`
  : l.type === 'time' ? `finish in ${amountText('time', l.max)} or less` : `give off no more than ${amountText('co2', l.max)}`);
export const limitLabel = (l: TransportLimit) => (l.type === 'budget' ? `Budget: ${money(l.max)} at most`
  : l.type === 'time' ? `Time: ${amountText('time', l.max)} at most` : `CO₂: ${amountText('co2', l.max)} at most`);
export const loadText = (load: TransportLoad) => (load.kind === 'people'
  ? `${load.amount.toLocaleString('en-US')} ${load.name}` : `${load.amount.toLocaleString('en-US')} tons of ${load.name}`);
export const perTripText = (v: TransportVehicle, t: LimitType) => (t === 'budget' ? `${money(v.cost)} a trip`
  : t === 'time' ? `${amountText('time', v.hours)} a trip` : `${amountText('co2', v.co2)} a trip`);
export const carriesText = (item: Pick<TransportItem, 'load'>, v: TransportVehicle) =>
  `carries ${v.capacity.toLocaleString('en-US')} ${unitOf(item.load.kind)} a trip`;
const joinAnd = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export const RULE = 'Each vehicle does every trip itself, one after another; a trip\'s hours count the way there and back.';

export function askOf(item: TransportItem): string {
  const job = `Move ${loadText(item.load)} from ${item.origin} to ${item.destination}.`;
  const limits = `You must ${joinAnd(item.limits.map(limitText))}.`;
  const q = item.mode === 'single_constraint' ? 'Which vehicle can do the whole job within the limit?'
    : item.mode === 'multi_constraint' ? 'Which vehicle can do the whole job within both limits?'
      : 'No vehicle keeps all three limits. Which vehicle breaks only one of them?';
  return `${job} ${limits} ${RULE} ${q}`;
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
const shuffle = <T,>(xs: readonly T[], rng: Rng): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const pickOne = <T,>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)];

/** The roundest whole number in [lo, hi], preferring one above lo (a limit equal to a total reads as a trick). */
export function roundIn(lo: number, hi: number): number {
  const from = hi > lo ? lo + 1 : lo;
  for (const d of [1000, 500, 100, 50, 25, 10, 5, 2, 1]) {
    const m = Math.ceil(from / d) * d;
    if (m <= hi) return m;
  }
  return lo;
}

/** Every way to set each limit: at or above some vehicle's total, below the next one up (or below them all). */
function limitChoices(item: Pick<TransportItem, 'load' | 'vehicles'>, t: LimitType): Array<[number, number]> {
  const totals = Array.from(new Set(item.vehicles.map(v => totalFor(item, v, t)))).sort((a, b) => a - b);
  const out: Array<[number, number]> = [];
  if (totals[0] > 1) out.push([Math.max(1, Math.floor(totals[0] / 2)), totals[0] - 1]);
  totals.forEach((x, i) => out.push([x, i + 1 < totals.length ? totals[i + 1] - 1 : x * 2]));
  return out;
}

const tierOk = (item: TransportItem, tier: TransportTier): boolean => {
  const key = keyVehicle(item);
  if (!key) return false;
  const wrong = item.vehicles.filter(v => v.id !== key.id);
  const divides = item.vehicles.every(v => fillsEvenly(item, v));
  if (tier === 'easy') return divides;
  if (divides) return false;
  const first = item.limits[0].type;
  const fs = item.vehicles.map(v => figure(v, first)), cheapest = item.vehicles[fs.indexOf(Math.min(...fs))];
  if (cheapest.id === key.id) return false;
  // Every wrong vehicle breaks a limit by its rounded total; hard: one passes only if its part-full trip is not counted.
  const trap = wrong.some(v => vehicleMiss(item, v) === 'forgot_round_up');
  return tier === 'hard' ? trap : true;
};

/** The mode's shape beyond a single key: multi has a vehicle that keeps each limit alone (the trade-off). */
const modeOk = (item: TransportItem): boolean => {
  const key = keyVehicle(item);
  if (!key) return false;
  if (item.mode !== 'multi_constraint') return true;
  const wrong = item.vehicles.filter(v => v.id !== key.id);
  return item.limits.every(l => wrong.some(v => totalFor(item, v, l.type) <= l.max && brokenLimits(item, v).length === 1));
};

const LOADS: Record<LoadKind, number[]> = {
  people: Array.from({ length: 78 }, (_, i) => 6 + i * 2),
  cargo: [...Array.from({ length: 40 }, (_, i) => 10 + i * 5), ...Array.from({ length: 36 }, (_, i) => 220 + i * 20)],
};
const LIMIT_COUNT: Record<TransportMode, number> = { single_constraint: 1, multi_constraint: 2, full_optimization: 3 };
const VEHICLE_COUNT: Record<TransportMode, Record<TransportTier, number>> = {
  single_constraint: { easy: 3, medium: 3, hard: 4 },
  multi_constraint: { easy: 3, medium: 4, hard: 4 },
  full_optimization: { easy: 4, medium: 4, hard: 4 },
};
const LIMIT_SETS: Record<TransportMode, LimitType[][]> = {
  single_constraint: [['budget'], ['time'], ['co2']],
  multi_constraint: [['budget', 'time'], ['budget', 'co2'], ['time', 'co2']],
  full_optimization: [['budget', 'time', 'co2']],
};

/** Two significant figures at most ($1,400, 850 kg, 7 hours): a limit at $1,375 or 825 kg reads as a trick. */
export const roundLimit = (n: number) => n < 20 || n % 10 ** (Math.floor(Math.log10(n)) - 1) === 0;

/**
 * One item of a mode at a tier, on a frame; null when the search finds none. The lesson's featured vehicle is on the
 * job (its load is one the vehicle can carry in MAX_TRIPS) and every limit is a round number, when such a job can be
 * found; the search falls back to a job without them rather than none (ruling R23, 2026-10-16).
 */
export function buildItem(mode: TransportMode, tier: TransportTier, frame: TransportFrame, rng: Rng, id = ''): TransportItem | null {
  const pool = VEHICLES.filter(v => v.kind === frame.kind);
  const featured = pool.find(v => v.id === frame.featured);
  const n = Math.min(VEHICLE_COUNT[mode][tier], pool.length);
  const featuredLoads = featured ? LOADS[frame.kind].filter(a => Math.ceil(a / featured.capacity) <= MAX_TRIPS) : [];
  let fallback: TransportItem | null = null;
  for (let attempt = 0; attempt < 600; attempt++) {
    const amount = pickOne(attempt < 450 && featuredLoads.length ? featuredLoads : LOADS[frame.kind], rng);
    const fits = pool.filter(v => Math.ceil(amount / v.capacity) <= MAX_TRIPS);
    if (fits.length < n) continue;
    let chosen = shuffle(fits, rng).slice(0, n);
    if (featured && fits.includes(featured) && !chosen.includes(featured)) chosen = [featured, ...chosen.slice(0, n - 1)];
    // Each card keeps its own figures; a longer route doubles them all.
    const r = rng() < 0.5 ? 1 : 2;
    const vehicles = shuffle(chosen, rng).map(({ kind: _k, ...v }) => ({ ...v, cost: v.cost * r, hours: v.hours * r, co2: v.co2 * r }));
    const types = pickOne(LIMIT_SETS[mode], rng);
    const base = { id, mode, title: frame.title, origin: frame.origin, destination: frame.destination,
      load: { kind: frame.kind, amount, name: frame.loadName }, vehicles };
    const choices = types.map(t => shuffle(limitChoices(base, t), rng));
    const combos: Array<Array<[number, number]>> = [[]];
    for (const cs of choices) { const next: Array<Array<[number, number]>> = []; for (const c of combos) for (const x of cs) next.push([...c, x]); combos.splice(0, combos.length, ...next); }
    const featuredOn = !featured || vehicles.some(v => v.id === featured.id);
    for (const combo of combos) {
      const limits = types.map((type, i) => ({ type, max: roundIn(combo[i][0], combo[i][1]) }));
      const item: TransportItem = { ...base, limits, shows: tier === 'easy' ? [...types] : [...LIMIT_TYPES] };
      if (!modeOk(item) || !tierOk(item, tier)) continue;
      if (featuredOn && limits.every(l => roundLimit(l.max))) return item;
      if (!fallback || (featuredOn && featured && !fallback.vehicles.some(v => v.id === featured.id))) fallback = item;
    }
  }
  return fallback;
}

export const ITEM_COUNT: Record<TransportMode, [number, number]> = {
  single_constraint: [3, 2], multi_constraint: [3, 2], full_optimization: [3, 2],
};

export const DEFAULT_FRAMES: TransportFrame[] = [
  { title: 'Festival day', origin: 'Maple Station', destination: 'Riverside Fairground', kind: 'people', loadName: 'festival visitors' },
  { title: 'Lumber run', origin: 'Pine Ridge Mill', destination: 'Harbor Building Site', kind: 'cargo', loadName: 'lumber' },
  { title: 'Big game night', origin: 'Hilltop Town', destination: 'Lakeside Stadium', kind: 'people', loadName: 'fans' },
  { title: 'Harvest haul', origin: 'Golden Grain Farm', destination: 'City Flour Mill', kind: 'cargo', loadName: 'wheat' },
  { title: 'School trip', origin: 'Oak Street School', destination: 'City Science Museum', kind: 'people', loadName: 'students' },
  { title: 'Gravel order', origin: 'Stone Creek Quarry', destination: 'New Road Site', kind: 'cargo', loadName: 'gravel' },
];

/** The items of a session: per mode, its count, on the frames in order (a frame that builds nothing is skipped). */
export function buildTransportItems(opts: { modes: TransportMode[]; tier: TransportTier; frames: TransportFrame[]; rng: Rng }): TransportItem[] {
  const out: TransportItem[] = [];
  const frames = opts.frames.length ? opts.frames : DEFAULT_FRAMES;
  let f = 0;
  for (const mode of opts.modes) {
    const count = ITEM_COUNT[mode][opts.modes.length === 1 ? 0 : 1];
    for (let k = 0, tries = 0; k < count && tries < count + frames.length + DEFAULT_FRAMES.length; tries++) {
      const frame = tries < count + frames.length ? frames[f++ % frames.length] : DEFAULT_FRAMES[tries % DEFAULT_FRAMES.length];
      const item = buildItem(mode, opts.tier, frame, opts.rng);
      if (item) { out.push(item); k++; }
    }
  }
  return out.map((item, i) => ({ ...item, id: `${item.mode}-${i + 1}` }));
}

// ── Lesson data → items ──────────────────────────────────────────────────────────────────

export interface TransportItemsSource {
  title?: string;
  challengeTypes?: string[];
  difficulty?: string;
  frames?: TransportFrame[];
  items?: TransportItem[];
  /** Legacy generations (before 2026-10-16): read only for their modes and names. */
  scenarios?: Array<{ type?: string; title?: string; origin?: string; destination?: string; load?: { kind?: string; name?: string } }>;
}

export const resolveTier = (d: TransportItemsSource): TransportTier => {
  const t = (d.difficulty ?? '').toLowerCase();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};
export function resolveTransportModes(d: TransportItemsSource): TransportMode[] {
  const asked = (d.challengeTypes ?? []).filter((m): m is TransportMode => (TRANSPORT_MODES as string[]).includes(m));
  if (asked.length) return TRANSPORT_MODES.filter(m => asked.includes(m));
  const legacy = (d.scenarios ?? []).map(s => s?.type).filter((m): m is TransportMode => (TRANSPORT_MODES as string[]).includes(m ?? ''));
  if (legacy.length) return TRANSPORT_MODES.filter(m => legacy.includes(m));
  return [...TRANSPORT_MODES];
}
function legacyFrames(d: TransportItemsSource): TransportFrame[] {
  return (d.scenarios ?? []).flatMap(s => (s?.title && s.origin && s.destination
    ? [{ title: s.title, origin: s.origin, destination: s.destination, kind: s.load?.kind === 'cargo' ? 'cargo' as const : 'people' as const,
      loadName: s.load?.name?.trim() || (s.load?.kind === 'cargo' ? 'goods' : 'people') }] : []));
}

const whole = (x: unknown, lo = 1) => typeof x === 'number' && Number.isInteger(x) && x >= lo;
/** False when a stored item is not one code could have built (its key would not be computable, or not single). */
export function validTransportItem(i: TransportItem | undefined): i is TransportItem {
  if (!i || typeof i.id !== 'string' || !(TRANSPORT_MODES as string[]).includes(i.mode)) return false;
  if (!i.load || (i.load.kind !== 'people' && i.load.kind !== 'cargo') || !whole(i.load.amount) || typeof i.load.name !== 'string') return false;
  if (!Array.isArray(i.limits) || i.limits.length !== LIMIT_COUNT[i.mode]) return false;
  if (new Set(i.limits.map(l => l.type)).size !== i.limits.length || !i.limits.every(l => LIMIT_TYPES.includes(l.type) && whole(l.max))) return false;
  if (!Array.isArray(i.vehicles) || i.vehicles.length < 2 || i.vehicles.length > 5) return false;
  if (new Set(i.vehicles.map(v => v.id)).size !== i.vehicles.length || new Set(i.vehicles.map(v => v.name)).size !== i.vehicles.length) return false;
  if (!i.vehicles.every(v => typeof v.name === 'string' && whole(v.capacity) && whole(v.cost) && whole(v.hours) && whole(v.co2))) return false;
  if (!Array.isArray(i.shows) || !i.limits.every(l => i.shows.includes(l.type))) return false;
  return !!keyVehicle(i);
}

/** Every item of the session: the stored, code-built items when valid, else built from the lesson's own fields. */
export function transportItems(d: TransportItemsSource): TransportItem[] {
  const stored = Array.isArray(d.items) ? d.items.filter(validTransportItem) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  const frames = Array.isArray(d.frames) && d.frames.length ? d.frames : legacyFrames(d);
  return buildTransportItems({ modes: resolveTransportModes(d), tier: resolveTier(d), frames, rng: seededRng(`${d.title ?? 'transport'}`) });
}

// ── Spoken answers ───────────────────────────────────────────────────────────────────────

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];

/**
 * The key a spoken reply is judged against: the vehicle, by name or by its card's place in the row. The other
 * vehicles, two vehicles at once and a hedge are the signature error.
 */
export function transportKey(item: TransportItem): SpokenKey {
  const key = keyVehicle(item)!;
  const at = item.vehicles.findIndex(v => v.id === key.id);
  const others = item.vehicles.filter(v => v.id !== key.id).map(v => `"${v.name}"`);
  return { answer: key.name, alsoAccept: [`the ${ORDINAL[at]} one`],
    acceptRule: `Any clear way of naming the ${key.name.toLowerCase()}, or its card's place in the row, counts.`,
    signatureError: `${others.join(', ')} ${others.length > 1 ? 'are' : 'is'} wrong, and so is naming two vehicles or hedging between them.` };
}

/** What the ask says by design: the job's places and load are names, so a vehicle word inside one ("Ferry Landing") is not the answer said. */
export const transportGiven = (item: TransportItem): string[] => [item.origin, item.destination, item.load.name];

const WHAT: Record<TransportMiss, string> = {
  forgot_round_up: 'a vehicle that would do it only if its last, part-full trip were not counted',
  cheapest_per_trip: 'the vehicle that costs least per trip on a limit it breaks, because it needs many trips',
  fewest_trips: 'the vehicle that carries the most per trip, whose few trips still break a limit',
  one_limit_only: 'a vehicle that keeps one limit and breaks the other',
  over_limit: 'a vehicle whose total breaks the limit',
  breaks_more: 'a vehicle that breaks two or more of the limits',
};

/** A spoken item's known wrong answers, most specific first, with the tap's miss ids. */
export function transportSpokenMisses(item: TransportItem): KnownMiss[] {
  const key = keyVehicle(item)!;
  const groups = new Map<TransportMiss, TransportVehicle[]>();
  for (const v of item.vehicles) if (v.id !== key.id) { const m = vehicleMiss(item, v); groups.set(m, [...(groups.get(m) ?? []), v]); }
  return TRANSPORT_MISSES[item.mode].filter(m => groups.has(m)).map(m => ({
    id: m,
    pattern: `The right vehicle is the ${key.name.toLowerCase()}. The learner names ${groups.get(m)!.map(v => `the ${v.name.toLowerCase()}`).join(' or ')}: ${WHAT[m]}.`,
    examples: groups.get(m)!.flatMap(v => [v.name, `the ${v.name.toLowerCase()}`]).slice(0, 6),
  }));
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface TransportView {
  work: TransportWork;
  /** The vehicle whose run is on screen (the learner's checked pick), or null. */
  ran: string | null;
  /** Credited: every vehicle's totals are shown. */
  solved: boolean;
}

export const cardText = (item: TransportItem, v: TransportVehicle) =>
  `${v.name}: ${carriesText(item, v)}; ${item.shows.map(t => perTripText(v, t)).join(', ')}`;

/** A vehicle's whole job: trips and each limited total, and which limits it breaks. Shown only once it has run. */
export function runText(item: TransportItem, v: TransportVehicle): string {
  const trips = tripsFor(item, v);
  const parts = item.limits.map(l => `${amountText(l.type, totalFor(item, v, l.type))} against the ${amountText(l.type, l.max)} ${LIMIT_NAME[l.type]} (${totalFor(item, v, l.type) > l.max ? 'over' : 'within'})`);
  return `the ${v.name.toLowerCase()} makes ${trips} trip${trips === 1 ? '' : 's'}: ${parts.join('; ')}`;
}

export function describeTransportWork(item: TransportItem | undefined, w: TransportWork): string {
  const v = item?.vehicles.find(x => x.id === w.picked);
  return v ? `Picked the ${v.name.toLowerCase()}` : 'Nothing picked yet';
}

const LAYOUT = 'No card shows trips or totals: the learner works them out (trips = the load divided by what one trip carries, '
  + 'rounded up, since a part-full trip is still a trip; each total = trips times the per-trip figure). A checked pick runs '
  + 'that one vehicle on screen; the table of every vehicle appears only once the job is credited.';

/** What this task forbids saying, beyond the shared rules (kept from the catalog's guidance before the boss). */
const NEVER_SAY = 'Never say how many trips a vehicle needs, a total, or whether a vehicle keeps or breaks a limit, unless '
  + 'that vehicle\'s number is already on screen (a lever card, the learner\'s own checked run); never compare two vehicles '
  + 'for the learner.';
const NAMING = 'Name only a vehicle the learner has already picked or named: to choose the next card, ask which one the '
  + 'learner wants to work, and never suggest a vehicle or list the ones left to check, even right after a lever puts '
  + 'numbers on every card.';
const ONE_AT_A_TIME = 'Ask the learner to take one vehicle at a time: its trips, then its totals, then each limit. After a '
  + 'checked pick, its run is on screen: ask which limit it broke.';

/** What is drawn and asked. Vehicles and limits named, never which vehicle answers; a run only for a checked pick. */
export function workspaceScene(item: TransportItem, view: TransportView): WorkspaceScene {
  const facts: Record<string, string> = {
    kind: item.mode,
    question: askOf(item),
    job: `${loadText(item.load)} to move from ${item.origin} to ${item.destination}.`,
    limits: item.limits.map(limitLabel).join('. ') + '.',
    cards: item.vehicles.map((v, i) => `${i + 1}) ${cardText(item, v)}`).join('. ') + '.',
  };
  const ran = item.vehicles.find(v => v.id === view.ran);
  if (view.solved) facts.run = `Credited. A table now shows every vehicle's trips and totals: ${item.vehicles.map(v => runText(item, v)).join('. ')}.`;
  else if (ran) facts.run = `The learner's checked pick was run on screen: ${runText(item, ran)}.`;
  facts.learnerWork = describeTransportWork(item, view.work);
  facts.layout = LAYOUT;
  facts.constraints = NEVER_SAY;
  facts.naming = NAMING;
  facts.approach = ONE_AT_A_TIME;
  return { objects: [], facts };
}

// ── The harness's learner (the boss's drive, the dry sweep) ──────────────────────────────

/** The journey's answers: the key, and the wrong pick showing the mode's first-listed miss it can. */
export function transportHarnessAnswers(item: TransportItem): { correct: string; plainWrong: string } {
  const key = keyVehicle(item)!;
  const rank = TRANSPORT_MISSES[item.mode];
  const wrong = item.vehicles.filter(v => v.id !== key.id).sort((a, b) => rank.indexOf(vehicleMiss(item, a)) - rank.indexOf(vehicleMiss(item, b)));
  return { correct: key.name, plainWrong: wrong[0].name };
}
