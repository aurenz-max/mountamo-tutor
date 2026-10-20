/**
 * flight-forces-explorer's domain: the items, their keys, checks and misses, and the scene. Its live wiring is
 * `flightForcesExplorer.card.ts` + `flightForcesExplorer.boss.ts` (SAY_OR_SHOW choices and an adjust flight on the
 * spoken preset).
 *
 * Every item is built and keyed by code from four force sizes in whole units (lift up, weight down, thrust forward,
 * drag back). The motion follows from comparing each pair: lift against weight sets the height (climbs, sinks, stays
 * level), thrust against drag sets the speed (speeds up, slows down, keeps its speed). Each mode is a task:
 * - predict: a plane flying level at a steady speed, then one change (a pilot action, a load). The learner predicts
 *   what the plane does before the change runs. easy names the force that changes; medium gives only the action;
 *   hard asks a two-step effect (less thrust, then less lift as the plane slows), a stall, or two changes that cancel.
 * - observe: a plane drawn with its four arrows at code-chosen lengths; the learner reads what it is doing. easy asks
 *   one direction with a wide gap; medium asks both directions, one pair balanced; hard asks both with one-unit gaps,
 *   and on some items the nose points up while the forces say otherwise.
 * - adjust: a goal ("climb and keep a steady speed"); the learner sets the thrust and the nose angle, then flies it.
 *   easy has one control; medium two; hard two where raising the nose also adds drag, with a stall angle in reach.
 * predict and observe are closed choices said aloud or tapped (J14); adjust is a gesture checked by code.
 *
 * Pure: the component, the generator, the boss and the tests read the same items, checks, misses and scene.
 */
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { FLIGHT_MISSES } from './flightForcesExplorer.card';

export type FlightMode = 'predict' | 'observe' | 'adjust';
export const FLIGHT_MODES: FlightMode[] = ['predict', 'observe', 'adjust'];
export type FlightTier = 'easy' | 'medium' | 'hard';
export type AircraftId = 'cessna' | 'jumbo_jet' | 'fighter';
export const AIRCRAFT_IDS: AircraftId[] = ['cessna', 'jumbo_jet', 'fighter'];
export const AIRCRAFT: Record<AircraftId, { label: string; stallAngle: number }> = {
  cessna: { label: 'small plane', stallAngle: 15 },
  jumbo_jet: { label: 'jumbo jet', stallAngle: 14 },
  fighter: { label: 'fighter jet', stallAngle: 16 },
};

export interface Forces { lift: number; weight: number; thrust: number; drag: number }
export type Axis = 'height' | 'speed';
export const HEIGHT_CHOICES = ['Climbs', 'Sinks', 'Stays level'] as const;
export const SPEED_CHOICES = ['Speeds up', 'Slows down', 'Keeps its speed'] as const;
export type HeightChoice = typeof HEIGHT_CHOICES[number];
export type SpeedChoice = typeof SPEED_CHOICES[number];

export const heightOf = (f: Forces): HeightChoice => (f.lift > f.weight ? 'Climbs' : f.lift < f.weight ? 'Sinks' : 'Stays level');
export const speedOf = (f: Forces): SpeedChoice => (f.thrust > f.drag ? 'Speeds up' : f.thrust < f.drag ? 'Slows down' : 'Keeps its speed');
export const choicesFor = (axis: Axis): readonly string[] => (axis === 'height' ? HEIGHT_CHOICES : SPEED_CHOICES);
const isChange = (c: string) => c === 'Climbs' || c === 'Sinks' || c === 'Speeds up' || c === 'Slows down';

// ── Items ────────────────────────────────────────────────────────────────────────────────

export type ChangeId = 'load_water' | 'drop_crate' | 'throttle_up' | 'throttle_back' | 'gear_down' | 'gear_up'
  | 'nose_up' | 'nose_down' | 'stall' | 'gear_and_throttle' | 'crate_and_nose';

export interface PredictItem {
  id: string; mode: 'predict'; aircraft: AircraftId;
  change: ChangeId;
  asked: Axis;
  /** The ask names the force that changes ("its weight gets bigger"). */
  named: boolean;
  /** A thrust or drag change asked about the height a little later (the plane's speed changes its lift). */
  later: boolean;
}
export interface ObserveItem {
  id: string; mode: 'observe'; aircraft: AircraftId;
  forces: Forces;
  asked: Axis | 'both';
  /** The plane is drawn nose up (its attitude), whatever the forces say. */
  noseUp: boolean;
}
export type Control = 'thrust' | 'nose';
export interface Setting { thrust: number; nose: number }
export interface Goal { height?: HeightChoice; speed?: SpeedChoice }
export interface AdjustItem {
  id: string; mode: 'adjust'; aircraft: AircraftId;
  weight: number;
  /** Lift at the lowest nose step; each step up adds one. */
  lift0: number;
  /** Drag at the lowest nose step; with `coupled`, each step up adds one. */
  drag0: number;
  start: Setting;
  goal: Goal;
  controls: Control[];
  coupled: boolean;
  /** The top nose step is past the stall angle: lift collapses there. */
  stall: boolean;
  /** One sentence of why the plane needs setting (a load taken on, the gear down). */
  story: string;
}
export type FlightItem = PredictItem | ObserveItem | AdjustItem;

export const MAX_THRUST = 8;
/** Nose angles of the steps; the last one is offered only on a stall item, and it is past every plane's stall angle. */
export const NOSE_ANGLES = [0, 3, 6, 9, 12, 18];
export const maxNose = (item: Pick<AdjustItem, 'stall'>) => (item.stall ? 5 : 4);
export const STALLED_LIFT = 1;

// ── Physics (in units) ───────────────────────────────────────────────────────────────────

export const LEVEL: Forces = { lift: 6, weight: 6, thrust: 4, drag: 4 };

const DELTA: Record<ChangeId, Partial<Forces>> = {
  load_water: { weight: 2 }, drop_crate: { weight: -2 }, throttle_up: { thrust: 2 }, throttle_back: { thrust: -2 },
  gear_down: { drag: 2 }, gear_up: { drag: -2 }, nose_up: { lift: 2 }, nose_down: { lift: -2 }, stall: {},
  gear_and_throttle: { drag: 2, thrust: 2 }, crate_and_nose: { weight: -2, lift: -2 },
};
/** The axis a change acts on directly. */
const DIRECT: Record<ChangeId, Axis> = {
  load_water: 'height', drop_crate: 'height', throttle_up: 'speed', throttle_back: 'speed', gear_down: 'speed',
  gear_up: 'speed', nose_up: 'height', nose_down: 'height', stall: 'height', gear_and_throttle: 'speed', crate_and_nose: 'height',
};

/** The forces right after the change, before the plane's speed has changed anything else. */
export function forcesAfter(item: Pick<PredictItem, 'change'>): Forces {
  const d = DELTA[item.change], f: Forces = { ...LEVEL };
  for (const k of Object.keys(d) as (keyof Forces)[]) f[k] += d[k]!;
  if (item.change === 'stall') f.lift = STALLED_LIFT + 1;
  return f;
}

/** The forces once the change has played out: on a `later` item the new speed has changed the lift by one. */
export function forcesRun(item: PredictItem): Forces {
  const f = forcesAfter(item);
  if (!item.later) return f;
  const s = speedOf(f);
  return { ...f, lift: f.lift + (s === 'Speeds up' ? 1 : s === 'Slows down' ? -1 : 0) };
}

export function forcesAt(item: AdjustItem, s: Setting): Forces {
  const stalled = item.stall && s.nose >= 5;
  return {
    lift: stalled ? STALLED_LIFT : item.lift0 + s.nose,
    weight: item.weight,
    thrust: s.thrust,
    drag: item.drag0 + (item.coupled ? s.nose : 0),
  };
}
export const isStalled = (item: AdjustItem, s: Setting) => item.stall && s.nose >= 5;
export function goalMet(item: AdjustItem, s: Setting): boolean {
  const f = forcesAt(item, s);
  return (!item.goal.height || heightOf(f) === item.goal.height) && (!item.goal.speed || speedOf(f) === item.goal.speed);
}

/** Every setting the controls can reach from the start. */
export function settings(item: AdjustItem): Setting[] {
  const out: Setting[] = [];
  const thrusts = item.controls.includes('thrust') ? Array.from({ length: MAX_THRUST + 1 }, (_, i) => i) : [item.start.thrust];
  const noses = item.controls.includes('nose') ? Array.from({ length: maxNose(item) + 1 }, (_, i) => i) : [item.start.nose];
  for (const thrust of thrusts) for (const nose of noses) out.push({ thrust, nose });
  return out;
}
const presses = (a: Setting, b: Setting) => Math.abs(a.thrust - b.thrust) + Math.abs(a.nose - b.nose);
/** The goal setting nearest the start (fewest presses). */
export function solution(item: AdjustItem): Setting | null {
  const ok = settings(item).filter(s => goalMet(item, s)).sort((a, b) => presses(a, item.start) - presses(b, item.start));
  return ok[0] ?? null;
}

// ── Keys and checks ──────────────────────────────────────────────────────────────────────

export const askedAxes = (item: FlightItem): Axis[] => (item.mode === 'predict' ? [item.asked]
  : item.mode === 'observe' ? (item.asked === 'both' ? ['height', 'speed'] : [item.asked]) : []);

/** The key of a choice item, per asked axis. */
export function keyOf(item: PredictItem | ObserveItem): { height?: HeightChoice; speed?: SpeedChoice } {
  if (item.mode === 'observe') {
    const out: { height?: HeightChoice; speed?: SpeedChoice } = {};
    for (const a of askedAxes(item)) { if (a === 'height') out.height = heightOf(item.forces); else out.speed = speedOf(item.forces); }
    return out;
  }
  const f = forcesRun(item);
  return item.asked === 'height' ? { height: heightOf(f) } : { speed: speedOf(f) };
}
export const keyLabel = (item: PredictItem | ObserveItem, axis: Axis): string => keyOf(item)[axis] ?? '';

/** The learner's work: one choice per row, or the adjust controls. */
export interface FlightWork { height: string | null; speed: string | null; setting: Setting }
export const emptyWork = (item: FlightItem | undefined): FlightWork =>
  ({ height: null, speed: null, setting: item?.mode === 'adjust' ? { ...item.start } : { thrust: 0, nose: 0 } });
export const workComplete = (item: FlightItem, w: FlightWork) => item.mode === 'adjust' || askedAxes(item).every(a => w[a] !== null);

export function flightCorrect(item: FlightItem | undefined, w: FlightWork): boolean {
  if (!item) return false;
  if (item.mode === 'adjust') return goalMet(item, w.setting);
  const key = keyOf(item);
  return askedAxes(item).every(a => w[a] !== null && w[a] === key[a]);
}

export type PredictMiss = 'stall_more_lift' | 'missed_balance' | 'said_no_change' | 'opposite_way';
export type ObserveMiss = 'followed_nose' | 'missed_balance' | 'said_no_change' | 'opposite_way';
export type AdjustMiss = 'stalled' | 'forgot_drag' | 'lift_vs_weight' | 'thrust_vs_drag';
export type FlightMiss = PredictMiss | ObserveMiss | AdjustMiss;
export { FLIGHT_MISSES };

/** The miss of one wrong row. */
function rowMiss(item: PredictItem | ObserveItem, axis: Axis, chose: string): FlightMiss {
  const key = keyLabel(item, axis);
  if (item.mode === 'predict' && item.change === 'stall' && chose === 'Climbs') return 'stall_more_lift';
  if (item.mode === 'observe' && item.noseUp && axis === 'height' && chose === 'Climbs') return 'followed_nose';
  if (!isChange(key)) return 'missed_balance';
  return isChange(chose) ? 'opposite_way' : 'said_no_change';
}

export function flightMiss(item: FlightItem | undefined, w: FlightWork): FlightMiss | undefined {
  if (!item || !workComplete(item, w) || flightCorrect(item, w)) return undefined;
  if (item.mode === 'adjust') {
    const f = forcesAt(item, w.setting);
    if (isStalled(item, w.setting)) return 'stalled';
    if (item.goal.speed && speedOf(f) !== item.goal.speed && item.coupled && w.setting.nose > 0 && w.setting.thrust === item.drag0) return 'forgot_drag';
    if (item.goal.height && heightOf(f) !== item.goal.height) return 'lift_vs_weight';
    return 'thrust_vs_drag';
  }
  const key = keyOf(item);
  for (const a of askedAxes(item)) if (w[a] !== key[a]) return rowMiss(item, a, w[a]!);
  return undefined;
}

// ── The ask ──────────────────────────────────────────────────────────────────────────────

const ACTION = (item: PredictItem): string => {
  const stall = AIRCRAFT[item.aircraft].stallAngle;
  switch (item.change) {
    case 'load_water': return 'The plane scoops up a heavy load of water to fight a fire.';
    case 'drop_crate': return 'The plane drops a heavy crate of supplies by parachute.';
    case 'throttle_up': return 'The pilot pushes the throttle forward.';
    case 'throttle_back': return 'The pilot pulls the throttle back.';
    case 'gear_down': return 'The pilot lowers the landing gear (the wheels).';
    case 'gear_up': return 'The pilot folds the landing gear (the wheels) up into the plane.';
    case 'nose_up': return `The pilot tilts the nose up a little, to 6°. This plane's wings stall past ${stall}°.`;
    case 'nose_down': return 'The pilot tilts the nose down a little.';
    case 'stall': return `The pilot pulls the nose up steeply, to ${NOSE_ANGLES[5]}°. This plane's wings stall past ${stall}°.`;
    case 'gear_and_throttle': return 'At the same moment, the pilot lowers the landing gear and pushes the throttle forward. The extra thrust is exactly as big as the extra drag.';
    case 'crate_and_nose': return 'At the same moment, the plane drops a heavy crate and the pilot tilts the nose down a little. The lift gets smaller by exactly as much as the weight does.';
  }
};
const NAMED: Partial<Record<ChangeId, string>> = {
  load_water: 'Its weight gets bigger.', drop_crate: 'Its weight gets smaller.',
  throttle_up: "The engine's thrust gets bigger.", throttle_back: "The engine's thrust gets smaller.",
  gear_down: 'The drag gets bigger.', gear_up: 'The drag gets smaller.',
  nose_up: 'The lift gets bigger.', nose_down: 'The lift gets smaller.',
};

const article = (s: string) => (/^[aeiou]/i.test(s) ? 'An' : 'A');
const planeName = (a: AircraftId) => `${article(AIRCRAFT[a].label)} ${AIRCRAFT[a].label}`;

const GOAL_HEIGHT: Record<HeightChoice, string> = { Climbs: 'climbs', Sinks: 'sinks gently', 'Stays level': 'flies level' };
const GOAL_SPEED: Record<SpeedChoice, string> = { 'Speeds up': 'speeds up', 'Slows down': 'slows down', 'Keeps its speed': 'keeps a steady speed' };
export const goalText = (g: Goal) => [g.height ? GOAL_HEIGHT[g.height] : '', g.speed ? GOAL_SPEED[g.speed] : ''].filter(Boolean).join(' and ');

export function askOf(item: FlightItem): string {
  if (item.mode === 'predict') {
    const setup = `${planeName(item.aircraft)} is flying level at a steady speed: its lift is as big as its weight, and its thrust is as big as its drag.`;
    const change = `${ACTION(item)}${item.named && NAMED[item.change] ? ` ${NAMED[item.change]}` : ''}`;
    const q = item.later ? "If the pilot changes nothing else, what happens to the plane's height a little later?"
      : item.asked === 'height' ? "What happens to the plane's height?" : "What happens to the plane's speed?";
    return `${setup} ${change} ${q}`;
  }
  if (item.mode === 'observe') {
    const setup = `${planeName(item.aircraft)} is drawn with its four force arrows${item.noseUp ? ', its nose pointing up' : ''}. Each arrow's length shows how big that force is.`;
    const q = item.asked === 'both' ? "What are the plane's height and its speed doing? Choose one for each."
      : item.asked === 'height' ? "What is the plane's height doing?" : "What is the plane's speed doing?";
    return `${setup} ${q}`;
  }
  const what = item.controls.length === 2 ? 'the thrust and the nose angle' : item.controls[0] === 'thrust' ? 'the thrust' : 'the nose angle';
  return `${item.story} Set ${what} so the plane ${goalText(item.goal)}, then press Fly and check.`;
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
const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

const DIRECT_CHANGES: ChangeId[] = ['load_water', 'drop_crate', 'throttle_up', 'throttle_back', 'gear_down', 'gear_up', 'nose_up', 'nose_down'];

function predictCandidates(tier: FlightTier, aircraft: AircraftId): PredictItem[] {
  const base = { id: '', mode: 'predict' as const, aircraft };
  if (tier !== 'hard') return DIRECT_CHANGES.map(change => ({ ...base, change, asked: DIRECT[change], named: tier === 'easy', later: false }));
  return [
    { ...base, change: 'stall', asked: 'height', named: false, later: false },
    { ...base, change: 'gear_and_throttle', asked: 'speed', named: false, later: false },
    { ...base, change: 'crate_and_nose', asked: 'height', named: false, later: false },
    ...(['throttle_back', 'throttle_up', 'gear_down', 'gear_up'] as ChangeId[]).map(change => ({ ...base, change, asked: 'height' as const, named: false, later: true })),
  ];
}

function observeCandidates(tier: FlightTier, aircraft: AircraftId): ObserveItem[] {
  const out: ObserveItem[] = [];
  const base = { id: '', mode: 'observe' as const, aircraft };
  const units = range(2, 8);
  const pairs = (gap: (d: number) => boolean) => {
    const ps: Array<[number, number]> = [];
    for (const a of units) for (const b of units) if (gap(Math.abs(a - b))) ps.push([a, b]);
    return ps;
  };
  if (tier === 'easy') {
    // One direction asked, a wide gap on that pair; the other pair is equal.
    for (const [a, b] of pairs(d => d >= 3)) for (const eq of [3, 5]) {
      out.push({ ...base, forces: { lift: a, weight: b, thrust: eq, drag: eq }, asked: 'height', noseUp: false });
      out.push({ ...base, forces: { lift: eq + 1, weight: eq + 1, thrust: a, drag: b }, asked: 'speed', noseUp: false });
    }
    return out;
  }
  if (tier === 'medium') {
    // Both directions, one pair equal and the other two units apart; or one direction asked whose pair is equal.
    for (const [a, b] of pairs(d => d === 2)) for (const eq of [3, 5, 6]) {
      out.push({ ...base, forces: { lift: a, weight: b, thrust: eq, drag: eq }, asked: 'both', noseUp: false });
      out.push({ ...base, forces: { lift: eq, weight: eq, thrust: a, drag: b }, asked: 'both', noseUp: false });
    }
    for (const eq of [4, 5, 6]) for (const [a, b] of pairs(d => d === 2)) {
      out.push({ ...base, forces: { lift: eq, weight: eq, thrust: a, drag: b }, asked: 'height', noseUp: false });
      out.push({ ...base, forces: { lift: a, weight: b, thrust: eq, drag: eq }, asked: 'speed', noseUp: false });
    }
    return out;
  }
  // hard: both directions, gaps of one unit (or equal); some drawn nose up while lift is not bigger than weight.
  for (const [l, w] of pairs(d => d <= 1)) for (const [t, d] of pairs(x => x <= 1)) {
    if (l === w && t === d) continue;
    for (const noseUp of [true, false]) out.push({ ...base, forces: { lift: l, weight: w, thrust: t, drag: d }, asked: 'both', noseUp });
  }
  return out;
}

const ADJUST_STORY = {
  load: 'The plane has just taken on a heavy load of water.',
  gear: 'The pilot has lowered the landing gear.',
  both: 'The plane has taken on a heavy load of water, and its landing gear is down.',
  nose: 'The plane is flying with its nose angle set low.',
  climb: 'The plane must climb over a ridge ahead.',
  late: 'The plane must go faster to reach the airport before dark.',
  fast: 'The pilot has pushed the throttle too far forward.',
};

function adjustCandidates(tier: FlightTier, aircraft: AircraftId): AdjustItem[] {
  const out: AdjustItem[] = [];
  const base = { id: '', mode: 'adjust' as const, aircraft };
  if (tier === 'easy') {
    // Thrust only: the lift is already as big as the weight.
    for (const drag0 of range(3, 6)) for (const thrust of range(1, 7)) for (const speed of ['Speeds up', 'Keeps its speed'] as SpeedChoice[]) {
      if (speed === 'Speeds up' && thrust > drag0) continue;
      if (speed === 'Keeps its speed' && Math.abs(thrust - drag0) < 2) continue;
      out.push({ ...base, weight: 6, lift0: 4, drag0, start: { thrust, nose: 2 }, goal: { speed }, controls: ['thrust'], coupled: false, stall: false,
        story: speed === 'Speeds up' ? ADJUST_STORY.late : thrust < drag0 ? ADJUST_STORY.gear : ADJUST_STORY.fast });
    }
    // Nose only: thrust already as big as drag.
    for (const weight of range(5, 7)) for (const k of range(1, 3)) for (const height of ['Climbs', 'Stays level'] as HeightChoice[]) {
      out.push({ ...base, weight, lift0: weight - k - 1, drag0: 4, start: { thrust: 4, nose: 0 }, goal: { height }, controls: ['nose'], coupled: false, stall: false,
        story: height === 'Climbs' ? ADJUST_STORY.climb : ADJUST_STORY.nose });
    }
    return out;
  }
  if (tier === 'medium') {
    for (const weight of range(5, 7)) for (const k of range(1, 3)) for (const drag0 of range(3, 6)) for (const height of ['Climbs', 'Stays level'] as HeightChoice[]) {
      for (const speed of ['Keeps its speed', 'Speeds up'] as SpeedChoice[]) {
        out.push({ ...base, weight, lift0: weight - k - 1, drag0, start: { thrust: drag0 - 2, nose: 0 }, goal: { height, speed }, controls: ['thrust', 'nose'],
          coupled: false, stall: false, story: ADJUST_STORY.both });
      }
    }
    return out;
  }
  // hard: raising the nose adds lift AND drag, and the top step stalls.
  for (const weight of range(5, 7)) for (const k of range(1, 3)) for (const drag0 of range(2, 4)) for (const height of ['Climbs', 'Stays level'] as HeightChoice[]) {
    out.push({ ...base, weight, lift0: weight - k - 1, drag0, start: { thrust: drag0, nose: 0 }, goal: { height, speed: 'Keeps its speed' }, controls: ['thrust', 'nose'],
      coupled: true, stall: true, story: height === 'Climbs' ? ADJUST_STORY.climb : ADJUST_STORY.load });
  }
  return out;
}

/** A buildable adjust item: the start misses the goal, a setting reaches it, and every force is at least one unit. */
function adjustOk(item: AdjustItem): boolean {
  if (goalMet(item, item.start) || !solution(item)) return false;
  return settings(item).every(s => { const f = forcesAt(item, s); return f.lift >= 1 && f.weight >= 1 && f.drag >= 1 && f.drag <= MAX_THRUST + 1; })
    && item.lift0 >= 1 && item.start.thrust >= 0 && item.start.thrust <= MAX_THRUST;
}

export const ITEM_COUNT: Record<FlightMode, [number, number]> = { predict: [4, 2], observe: [4, 2], adjust: [3, 2] };

const shapeKey = (i: FlightItem): string => i.mode === 'predict' ? `${i.change}:${i.asked}`
  : i.mode === 'observe' ? `${i.asked}:${heightOf(i.forces)}:${speedOf(i.forces)}:${i.noseUp}`
    : `${i.controls.join('+')}:${goalText(i.goal)}`;

/** The items of one mode at one tier: distinct shapes first, the band's defining shape first. */
export function buildModeItems(mode: FlightMode, tier: FlightTier, aircraft: AircraftId, count: number, rng: Rng): FlightItem[] {
  const pool: FlightItem[] = shuffle<FlightItem>(mode === 'predict' ? predictCandidates(tier, aircraft)
    : mode === 'observe' ? observeCandidates(tier, aircraft) : adjustCandidates(tier, aircraft).filter(adjustOk), rng);
  const picked: FlightItem[] = [];
  const shapes = new Set<string>();
  const take = (i: FlightItem | undefined) => { if (i && picked.length < count && !picked.includes(i)) { picked.push(i); shapes.add(shapeKey(i)); } };
  if (mode === 'predict' && tier === 'hard') {
    take(pool.find(i => i.mode === 'predict' && i.later));
    take(pool.find(i => i.mode === 'predict' && i.change === 'stall'));
  }
  if (mode === 'observe' && tier === 'hard') take(pool.find(i => i.mode === 'observe' && i.noseUp && heightOf(i.forces) !== 'Climbs'));
  if (mode === 'observe' && tier === 'medium') take(pool.find(i => i.mode === 'observe' && i.asked === 'both'));
  if (mode === 'adjust' && tier === 'hard') take(pool.find(i => i.mode === 'adjust' && i.goal.height === 'Climbs'));
  for (const i of pool) if (!shapes.has(shapeKey(i))) take(i);
  for (const i of pool) take(i);
  return picked;
}

export function buildFlightItems(opts: { modes: FlightMode[]; tier: FlightTier; aircraft: AircraftId; rng: Rng }): FlightItem[] {
  const out: FlightItem[] = [];
  for (const mode of opts.modes) out.push(...buildModeItems(mode, opts.tier, opts.aircraft, ITEM_COUNT[mode][opts.modes.length === 1 ? 0 : 1], opts.rng));
  return out.map((item, i) => ({ ...item, id: `${item.mode}-${i + 1}` }));
}

// ── Lesson data → items ──────────────────────────────────────────────────────────────────

export interface FlightItemsSource {
  title?: string;
  aircraftType?: string;
  gradeBand?: string;
  challengeTypes?: string[];
  difficulty?: string;
  items?: FlightItem[];
  /** Legacy generations (before 2026-10-15): read only for their modes. */
  challenges?: Array<{ type?: string }>;
}

export const resolveAircraft = (d: FlightItemsSource): AircraftId =>
  ((AIRCRAFT_IDS as string[]).includes(d.aircraftType ?? '') ? d.aircraftType as AircraftId : 'cessna');
export const resolveTier = (d: FlightItemsSource): FlightTier => {
  const t = (d.difficulty ?? '').toLowerCase();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};
/** The modes a lesson asks: its pin, else the legacy challenges' types, else by grade band. */
export function resolveFlightModes(d: FlightItemsSource): FlightMode[] {
  const asked = (d.challengeTypes ?? []).filter((m): m is FlightMode => (FLIGHT_MODES as string[]).includes(m));
  if (asked.length) return FLIGHT_MODES.filter(m => asked.includes(m));
  const legacy = (d.challenges ?? []).map(c => c?.type).filter((m): m is FlightMode => (FLIGHT_MODES as string[]).includes(m ?? ''));
  if (legacy.length) return FLIGHT_MODES.filter(m => legacy.includes(m));
  return d.gradeBand === '1-2' ? ['predict'] : ['predict', 'observe', 'adjust'];
}

const unit = (x: unknown) => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 12;
const CHANGES = Object.keys(DELTA) as ChangeId[];

/** False when a stored item is not one code could have built (its key would not be computable). */
export function validFlightItem(i: FlightItem | undefined): i is FlightItem {
  if (!i || typeof i.id !== 'string' || !(AIRCRAFT_IDS as string[]).includes(i.aircraft)) return false;
  if (i.mode === 'predict') return CHANGES.includes(i.change) && (i.asked === 'height' || i.asked === 'speed');
  if (i.mode === 'observe') {
    const f = i.forces;
    return !!f && [f.lift, f.weight, f.thrust, f.drag].every(unit) && ['height', 'speed', 'both'].includes(i.asked);
  }
  if (i.mode === 'adjust') {
    return [i.weight, i.lift0, i.drag0].every(unit) && !!i.start && unit(i.start.thrust) && unit(i.start.nose) && !!i.goal
      && Array.isArray(i.controls) && i.controls.length > 0 && i.controls.every(c => c === 'thrust' || c === 'nose') && adjustOk(i);
  }
  return false;
}

/** Every item of the session: the stored, code-built items when valid, else built from the lesson's own fields. */
export function flightItems(d: FlightItemsSource): FlightItem[] {
  const stored = Array.isArray(d.items) ? d.items.filter(validFlightItem) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  return buildFlightItems({ modes: resolveFlightModes(d), tier: resolveTier(d), aircraft: resolveAircraft(d),
    rng: seededRng(`${d.title ?? 'flight'}:${resolveAircraft(d)}`) });
}

// ── The spoken key ───────────────────────────────────────────────────────────────────────

const ORDINAL = ['first', 'second', 'third'];
/** The ways a learner says each choice, beside the choice itself. */
const SAY: Record<string, readonly string[]> = {
  Climbs: ['goes up', 'rises', 'gains height'],
  Sinks: ['goes down', 'drops', 'descends', 'loses height'],
  'Stays level': ['flies level', 'stays at the same height'],
  'Speeds up': ['goes faster', 'accelerates'],
  'Slows down': ['goes slower', 'loses speed'],
  'Keeps its speed': ['stays at the same speed', 'steady speed'],
};
const said = (choice: string) => choice.toLowerCase();
const ways = (choice: string) => [said(choice), ...SAY[choice]].map(w => `"${w}"`).join(', ');
const place = (item: PredictItem | ObserveItem, a: Axis) => `the ${ORDINAL[choicesFor(a).indexOf(keyLabel(item, a))]} one`;

/**
 * The key a spoken reply is judged against: the choice on each asked row, in any of its everyday wordings or by its
 * place in the row. On a two-row item both parts are needed. The other choices are the signature error. An adjust item
 * has no key: the activity checks the flight.
 */
export function flightKey(item: FlightItem): SpokenKey | null {
  if (item.mode === 'adjust') return null;
  const axes = askedAxes(item);
  if (axes.length === 1) {
    const a = axes[0], key = keyLabel(item, a);
    const others = choicesFor(a).filter(c => c !== key).map(c => `"${said(c)}"`).join(', ');
    return { answer: said(key), alsoAccept: [...SAY[key], place(item, a)],
      acceptRule: `Its place in the ${a} row ("${place(item, a)}") names it too.`,
      signatureError: `${others} are wrong, and so is naming two or hedging between them.` };
  }
  const h = keyLabel(item, 'height'), s = keyLabel(item, 'speed');
  return { answer: `${said(h)} and ${said(s)}`, alsoAccept: [`${said(s)} and ${said(h)}`],
    acceptRule: `Two parts, both needed, in any order: the height (${ways(h)}, or "${place(item, 'height')}" in the height row) `
      + `and the speed (${ways(s)}, or "${place(item, 'speed')}" in the speed row).`,
    signatureError: 'One part wrong, or only one part said, is not credited.' };
}

/** A predict ask states the plane before the change by design ("flying level at a steady speed"). */
export const flightGiven = (item: FlightItem): readonly string[] => (item.mode === 'predict' ? ['flying level at a steady speed'] : []);

/** How a learner says a choice item's work aloud (the harness's spoken answers). */
export function flightSaid(item: PredictItem | ObserveItem, w: FlightWork): string {
  return askedAxes(item).map(a => said(w[a] ?? '')).join(' and ');
}

const WHAT: Record<FlightMiss, string> = {
  stall_more_lift: 'says the plane climbs, as if tilting the nose further always makes more lift',
  followed_nose: 'says the plane climbs because its nose points up',
  missed_balance: 'says it changes when the pair is balanced',
  said_no_change: 'says it does not change',
  opposite_way: 'says it changes the other way',
  stalled: '', forgot_drag: '', lift_vs_weight: '', thrust_vs_drag: '',
};

/** A spoken item's known wrong answers per asked direction, most specific first, with the tap's miss ids. */
export function flightSpokenMisses(item: PredictItem | ObserveItem): KnownMiss[] {
  const out: KnownMiss[] = [];
  for (const a of askedAxes(item)) {
    const groups = new Map<FlightMiss, string[]>();
    for (const c of choicesFor(a)) if (c !== keyLabel(item, a)) { const m = rowMiss(item, a, c); groups.set(m, [...(groups.get(m) ?? []), c]); }
    for (const m of FLIGHT_MISSES[item.mode]) {
      if (!groups.has(m) || out.some(k => k.id === m)) continue;
      out.push({ id: m, pattern: `The right answer for the ${a} is "${keyLabel(item, a)}". The learner's answer ${WHAT[m]}: ${groups.get(m)!.map(x => `"${x}"`).join(', ')}.`,
        examples: groups.get(m)! });
    }
  }
  return out;
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface FlightView {
  work: FlightWork;
  /** Choice items: credited, and the change (or the drawn forces) has been run on screen. */
  solved: boolean;
  /** Adjust: the last setting flown (after Fly and check), credited or not. */
  flown: Setting | null;
}

export const angleOf = (nose: number) => NOSE_ANGLES[Math.max(0, Math.min(5, nose))];
const arrows = (f: Forces) => `lift ${f.lift}, weight ${f.weight}, thrust ${f.thrust}, drag ${f.drag}`;
export const motionText = (f: Forces) => `${heightOf(f) === 'Stays level' ? 'flies level' : heightOf(f).toLowerCase()} and ${speedOf(f) === 'Keeps its speed' ? 'keeps its speed' : speedOf(f).toLowerCase()}`;
export const motionOf = (f: Forces) => `The plane ${motionText(f)}.`;

export function describeFlightWork(item: FlightItem | undefined, w: FlightWork): string {
  if (!item) return 'Nothing chosen yet';
  if (item.mode === 'adjust') {
    const f = forcesAt(item, w.setting);
    return `Thrust set to ${w.setting.thrust}, nose angle ${angleOf(w.setting.nose)}°; the arrows now read ${arrows(f)}${isStalled(item, w.setting) ? ' (the wing is past its stall angle)' : ''}`;
  }
  const chosen = askedAxes(item).filter(a => w[a] !== null).map(a => `"${w[a]}"`);
  return chosen.length ? `Chose ${chosen.join(' and ')}` : 'Nothing chosen yet';
}

const LAYOUT_CHOICE = 'Nothing on screen names what the plane is doing; the plane holds still until the answer is credited.';
const LAYOUT_ADJUST = 'No label names what the plane is doing; it holds still until it is flown.';

const PAIR_RULE = 'never say a pair is now bigger, smaller or equal ("lift is smaller than weight", "when lift is much smaller '
  + 'than weight, what happens?"), even when a card or the arrows show it, or what the plane does.';
/** What this item's task forbids saying, beyond the shared rules (kept from the catalog's guidance before the boss). */
function neverSay(item: FlightItem): string {
  if (item.mode === 'predict') {
    return [item.named ? `Never ${PAIR_RULE.slice('never '.length)}` : `Never say which force the action changes; ${PAIR_RULE}`,
      item.later ? 'Never say what happens to the speed or that the speed changes the lift: that step is the task.' : '']
      .filter(Boolean).join(' ');
  }
  if (item.mode === 'observe') {
    return 'Never compare a pair for the learner ("lift is longer") or count its units; ask which two arrows decide the '
      + 'height and which two the speed.';
  }
  return 'Never say which control to change, which way or by how much, and never tell the learner to balance, match or '
    + 'even out a pair (that is the answer on a level or steady goal); after a flight, ask what the plane did and which pair '
    + 'of arrows explains it. The dashed marks only show where an arrow would equal its partner: never call them targets '
    + 'or say an arrow must reach or match them.';
}
const NEVER_EXPLAIN = 'After a miss, never say what the wrong choice came from. Describe a lever card only by what the scene '
  + 'says it shows, never as the conclusion.';

/** What is drawn and asked. Choices named, never which is right; the motion only once credited (or flown). */
export function workspaceScene(item: FlightItem, view: FlightView): WorkspaceScene {
  const facts: Record<string, string> = { kind: item.mode, question: askOf(item) };
  const plane = AIRCRAFT[item.aircraft].label;
  if (item.mode === 'predict') {
    facts.choices = choicesFor(item.asked).map((c, i) => `${i + 1}) ${c}`).join('  ');
    facts.shown = `The ${plane} flying level, with four arrows drawn in matching pairs (lift as long as weight, thrust as long as drag). The change has not been run.`;
    if (view.solved) facts.run = `The change has been run on screen: the arrows now read ${arrows(forcesRun(item))}, and the plane ${motionText(forcesRun(item))}.`;
  } else if (item.mode === 'observe') {
    facts.choices = askedAxes(item).map(a => `${a}: ${choicesFor(a).map((c, i) => `${i + 1}) ${c}`).join('  ')}`).join('; ');
    facts.shown = `The ${plane}${item.noseUp ? ' drawn nose up' : ''}, standing still on screen, with its arrows drawn in units: ${arrows(item.forces)}.`;
    if (view.solved) facts.run = `The plane now moves on screen as its forces say: it ${motionText(item.forces)}.`;
  } else {
    const f = forcesAt(item, view.work.setting);
    facts.goal = `The plane ${goalText(item.goal)}.`;
    facts.controls = `${item.controls.includes('thrust') ? `Thrust buttons (0 to ${MAX_THRUST})` : `Thrust fixed at ${item.start.thrust}`}; `
      + `${item.controls.includes('nose') ? `nose angle buttons (${NOSE_ANGLES.slice(0, maxNose(item) + 1).join('°, ')}°)` : `nose angle fixed at ${angleOf(item.start.nose)}°`}.`
      + `${item.coupled ? ' Each nose step up adds one unit of lift and one unit of drag.' : item.controls.includes('nose') ? ' Each nose step up adds one unit of lift.' : ''}`;
    facts.shown = `The ${plane} with its arrows drawn in units, changing as the controls change: ${arrows(f)}. Weight is ${item.weight}.`;
    if (view.flown) {
      const ff = forcesAt(item, view.flown);
      facts.run = `The learner flew the setting thrust ${view.flown.thrust}, nose ${angleOf(view.flown.nose)}°: the plane ${motionText(ff)}.`;
    }
  }
  facts.learnerWork = describeFlightWork(item, view.work);
  facts.layout = item.mode === 'adjust' ? LAYOUT_ADJUST : LAYOUT_CHOICE;
  facts.constraints = neverSay(item);
  facts.neverSay = NEVER_EXPLAIN;
  return { objects: [], facts };
}

// ── The harness's learner (the boss's drive, the dry sweep) ──────────────────────────────

/** The journey's answers: the key, and a wrong answer showing the mode's first-listed miss it can. */
export function flightHarnessAnswers(item: FlightItem): { correct: FlightWork; plainWrong: FlightWork } {
  const work = emptyWork(item);
  if (item.mode === 'adjust') {
    const rank: AdjustMiss[] = ['forgot_drag', 'lift_vs_weight', 'thrust_vs_drag', 'stalled'];
    const wrong = settings(item).filter(s => !goalMet(item, s))
      .map(s => ({ s, m: flightMiss(item, { ...work, setting: s }) as AdjustMiss }))
      .sort((a, b) => rank.indexOf(a.m) - rank.indexOf(b.m) || presses(a.s, item.start) - presses(b.s, item.start));
    return { correct: { ...work, setting: solution(item)! }, plainWrong: { ...work, setting: wrong[0]?.s ?? item.start } };
  }
  const key = keyOf(item), axes = askedAxes(item);
  const correct: FlightWork = { ...work, height: key.height ?? null, speed: key.speed ?? null };
  const rank = FLIGHT_MISSES[item.mode];
  const a0 = axes[0];
  const wrongs = choicesFor(a0).filter(c => c !== key[a0]).sort((x, y) => rank.indexOf(rowMiss(item, a0, x)) - rank.indexOf(rowMiss(item, a0, y)));
  return { correct, plainWrong: { ...correct, [a0]: wrongs[0] } };
}

/** The button presses that take the controls from one setting to another. */
export function pressesTo(from: Setting, to: Setting): string[] {
  const out: string[] = [];
  for (let t = from.thrust; t < to.thrust; t++) out.push('More thrust');
  for (let t = from.thrust; t > to.thrust; t--) out.push('Less thrust');
  for (let n = from.nose; n < to.nose; n++) out.push('Nose up');
  for (let n = from.nose; n > to.nose; n--) out.push('Nose down');
  return out;
}
