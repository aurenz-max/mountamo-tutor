/**
 * orbit-mechanics-lab on the shared tutor/JEV teaching workspace (W1, plain shape; R2 batch B1, rebuilt 2026-10-16
 * under the 10-15 ruling).
 *
 * The old lab launched a rocket on a thrust slider whose physics put almost every thrust above lift-off into some
 * orbit, so outcomes could not be keyed; K-1 always had the middle "Medium" picture as the answer, attempts were
 * retried until right, and a session with no challenge scored 100. The rebuild uses Newton's cannon: the rocket is
 * already above the air and gets one sideways push, and gravity alone decides the path. Every item and key is built by
 * code from that physics (`calculateOrbitalElements` in `orbitPhysics.ts`); Gemini writes the title and an overview.
 * The flight is drawn only after the answer is checked, so the first answer is a committed prediction, never a trial.
 *
 * - pick_speed: 2-4 pushes drawn as sideways arrows; say or tap the one that makes the rocket fall back, go around in a
 *   circle, go around in a stretched loop, or fly away. The asked outcome varies, so no push size is always right.
 *   easy: 2 pushes; medium: 3 (falls, circle, away); hard: 4 (adds the stretched loop, close to the circle push).
 * - orbit_speed: 2-4 rockets on circular tracks at different distances, standing still; tap the fastest, the slowest,
 *   the one with the shortest or the longest trip around (say or tap). easy: 2 far apart; medium: 3; hard: 4 closer together,
 *   drawn at different sizes (the biggest is never the answer).
 * - predict_burn: a rocket on a circle fires a small or big push forward or backward; say or tap what its path does.
 *   easy: a small push, 2 choices; medium: small or big, 3 choices; hard: all 5 outcomes.
 * - circularize: a rocket on a stretched loop may fire once; say or tap where and which way, to go around in a circle
 *   at a named height. easy: it is at the named point, speed up or slow down; medium: 4 choices; hard: 4 choices and the
 *   target circle is drawn dashed, not named.
 *
 * Every item is a sayable closed choice (J14, user 10-13): spoken and judged against `expectedAnswer`, or tapped and
 * checked by code.
 *
 * Pure: the component, the generator, the adapter, the journey row and the tests read the same items, checks, misses
 * and scene.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { calculateOrbitalElements, gravitationalParameter, type OrbitBodyConfig } from '../../../service/astronomy/orbitPhysics';

export type OrbitMode = 'pick_speed' | 'orbit_speed' | 'predict_burn' | 'circularize';
export const ORBIT_MODES: OrbitMode[] = ['pick_speed', 'orbit_speed', 'predict_burn', 'circularize'];
export type OrbitTier = 'easy' | 'medium' | 'hard';

// ── Physics (Earth, real values) ─────────────────────────────────────────────────────────

export const EARTH: OrbitBodyConfig = { bodyRadiusKm: 6371, surfaceGravity: 9.81 };
export const RE = EARTH.bodyRadiusKm;
const MU = gravitationalParameter(EARTH);
/** The sideways speed that keeps a circle at radius r (km). */
export const circleSpeed = (rKm: number) => Math.sqrt(MU / rKm);
export const periodMin = (rKm: number) => (2 * Math.PI * Math.sqrt(rKm ** 3 / MU)) / 60;

/** What gravity does with a path. In order from the slowest push to the fastest. */
export type Path = 'falls' | 'circle' | 'stretched' | 'away';
export const PATHS: Path[] = ['falls', 'circle', 'stretched', 'away'];

/** The path a rocket at (x, y) km moving at (vx, vy) km/s follows. */
export function pathOf(x: number, y: number, vx: number, vy: number): Path {
  const el = calculateOrbitalElements({ x, y, vx, vy }, EARTH);
  if (el.energy >= 0) return 'away';
  if (el.perigee <= 0) return 'falls';
  return el.eccentricity < 0.02 ? 'circle' : 'stretched';
}

export interface Flight { points: Array<[number, number]>; end: 'lap' | 'crash' | 'leave' }

/** Fly a rocket under gravity (velocity Verlet) until it lands, leaves the view, or goes once around. World km. */
export function fly(x0: number, y0: number, vx0: number, vy0: number, viewKm: number): Flight {
  let x = x0, y = y0, vx = vx0, vy = vy0;
  const acc = (px: number, py: number): [number, number] => { const r3 = Math.hypot(px, py) ** 3; return [-MU * px / r3, -MU * py / r3]; };
  const dt = (2 * Math.PI * Math.sqrt(Math.hypot(x, y) ** 3 / MU)) / 900;
  let [ax, ay] = acc(x, y);
  const points: Array<[number, number]> = [[x, y]];
  let prev = Math.atan2(y, x), swept = 0;
  for (let i = 1; i <= 30000; i++) {
    vx += 0.5 * ax * dt; vy += 0.5 * ay * dt;
    x += vx * dt; y += vy * dt;
    [ax, ay] = acc(x, y);
    vx += 0.5 * ax * dt; vy += 0.5 * ay * dt;
    const r = Math.hypot(x, y);
    const ang = Math.atan2(y, x);
    let d = ang - prev;
    if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
    swept += Math.abs(d); prev = ang;
    if (r <= RE) { points.push([x * RE / r, y * RE / r]); return { points, end: 'crash' }; }
    if (r >= viewKm * 1.08) { points.push([x, y]); return { points, end: 'leave' }; }
    if (swept >= 2 * Math.PI) { points.push([x0, y0]); return { points, end: 'lap' }; }
    if (i % 5 === 0) points.push([x, y]);
  }
  return { points, end: 'lap' };
}

// ── Items ────────────────────────────────────────────────────────────────────────────────

/** pick_speed: one push, by how fast it sends the rocket sideways (a fraction of the circle speed). */
export interface Push { f: number }
export interface SpeedItem { id: string; mode: 'pick_speed'; /** Start height, Earth radii from the centre. */ height: number; ask: Path; pushes: Push[] }

export const ROCKET_COLORS = ['red', 'blue', 'green', 'yellow'] as const;
export type RocketColor = typeof ROCKET_COLORS[number];
export const COLOR_HEX: Record<RocketColor, string> = { red: '#f87171', blue: '#60a5fa', green: '#4ade80', yellow: '#facc15' };
export interface Craft { color: RocketColor; /** Earth radii. */ radius: number; /** Degrees, where it sits on its track. */ angle: number; /** Drawn size, 1 = normal. */ size: number }
export type RaceAsk = 'fastest' | 'slowest' | 'shortest_trip' | 'longest_trip';
export interface RaceItem { id: string; mode: 'orbit_speed'; ask: RaceAsk; crafts: Craft[] }

export type BurnDir = 'forward' | 'backward';
export type BurnSize = 'small' | 'big';
export type BurnOutcome = 'falls' | 'closer' | 'same' | 'farther' | 'away';
export const BURN_OUTCOMES: BurnOutcome[] = ['falls', 'closer', 'same', 'farther', 'away'];
export interface BurnItem { id: string; mode: 'predict_burn'; height: number; dir: BurnDir; size: BurnSize; choices: BurnOutcome[] }

export type CircleChoice = 'far_up' | 'far_down' | 'near_up' | 'near_down';
export const CIRCLE_CHOICES: CircleChoice[] = ['far_up', 'far_down', 'near_up', 'near_down'];
export interface CircleItem {
  id: string; mode: 'circularize';
  /** Closest and farthest distance of the loop, Earth radii from the centre. */
  near: number; far: number;
  /** Direction of the far point, degrees (90 = straight up). */
  tilt: number;
  target: 'far' | 'near';
  /** words: the ask names the height; ring: a dashed circle shows it. */
  show: 'words' | 'ring';
  /** Where the rocket is drawn before the answer: at a named point (easy), or partway round (no point hinted). */
  at: 'far' | 'near' | 'side';
  choices: CircleChoice[];
}

export type OrbitItem = SpeedItem | RaceItem | BurnItem | CircleItem;
export type TapItem = SpeedItem | RaceItem;
export type ChoiceItem = BurnItem | CircleItem;
export const isTapItem = (i: OrbitItem): i is TapItem => i.mode === 'pick_speed' || i.mode === 'orbit_speed';

// ── pick_speed ───────────────────────────────────────────────────────────────────────────

const startOf = (height: number) => ({ x: 0, y: height * RE });
export const pushPath = (item: SpeedItem, p: Push): Path => { const s = startOf(item.height); return pathOf(s.x, s.y, p.f * circleSpeed(s.y), 0); };
export const PUSH_WORD: Record<Path, string> = { falls: 'Small push', circle: 'Medium push', stretched: 'Big push', away: 'Huge push' };
export const pushLabel = (item: SpeedItem, i: number) => PUSH_WORD[pushPath(item, item.pushes[i])];
export const PATH_TEXT: Record<Path, string> = {
  falls: 'falls back down to Earth', circle: 'goes around and around Earth in a circle',
  stretched: 'goes around Earth in a long, stretched loop', away: 'flies away and never comes back',
};

// ── orbit_speed ──────────────────────────────────────────────────────────────────────────

export const craftSpeed = (c: Craft) => circleSpeed(c.radius * RE);
export const craftPeriod = (c: Craft) => periodMin(c.radius * RE);
export const craftLabel = (c: Craft) => `${c.color.charAt(0).toUpperCase()}${c.color.slice(1)} rocket`;
function raceKey(item: RaceItem): number {
  const val = item.crafts.map(c => (item.ask === 'fastest' || item.ask === 'slowest' ? craftSpeed(c) : craftPeriod(c)));
  const want = item.ask === 'fastest' || item.ask === 'longest_trip' ? Math.max(...val) : Math.min(...val);
  return val.filter(v => v === want).length === 1 ? val.indexOf(want) : -1;
}
/** The one rocket drawn bigger than all others, or -1 when sizes do not single one out. */
export function biggestCraft(item: RaceItem): number {
  const s = item.crafts.map(c => c.size), top = Math.max(...s);
  return s.filter(v => v === top).length === 1 ? s.indexOf(top) : -1;
}

// ── predict_burn ─────────────────────────────────────────────────────────────────────────

export const BURN_DV: Record<BurnSize, number> = { small: 0.1, big: 0.5 };
export const burnFactor = (item: Pick<BurnItem, 'dir' | 'size'>) => 1 + (item.dir === 'forward' ? 1 : -1) * BURN_DV[item.size];
export function burnResult(item: BurnItem): BurnOutcome {
  const s = startOf(item.height), v = circleSpeed(s.y) * burnFactor(item);
  const el = calculateOrbitalElements({ x: s.x, y: s.y, vx: v, vy: 0 }, EARTH);
  if (el.energy >= 0) return 'away';
  if (el.perigee <= 0) return 'falls';
  if (el.apogee + RE > s.y * 1.01) return 'farther';
  if (el.perigee + RE < s.y * 0.99) return 'closer';
  return 'same';
}
export const BURN_TEXT: Record<BurnOutcome, string> = {
  falls: 'It falls down to Earth', closer: 'Its loop dips closer to Earth on the other side', same: 'It stays on the same circle',
  farther: 'Its loop reaches farther out on the other side', away: 'It flies away into space',
};
const BURN_SAY: Record<BurnOutcome, string> = {
  falls: '"it falls", "it crashes", "it falls down to Earth"',
  closer: '"it dips closer", "the other side comes closer to Earth", "it goes lower on the other side"',
  same: '"it stays the same", "the same circle"',
  farther: '"it goes farther out", "the other side goes higher", "a bigger loop"',
  away: '"it flies away", "it escapes", "it goes off into space"',
};

// ── circularize ──────────────────────────────────────────────────────────────────────────

const rad = (deg: number) => (deg * Math.PI) / 180;
/** World position (km) and velocity (km/s) of a point of the loop. Travel is anticlockwise in world coordinates. */
export function loopPoint(item: CircleItem, which: 'far' | 'near' | 'side'): { x: number; y: number; vx: number; vy: number } {
  const rp = item.near * RE, ra = item.far * RE, a = (rp + ra) / 2, e = (ra - rp) / (ra + rp);
  const peri = rad(item.tilt + 180);
  const nu = which === 'near' ? 0 : which === 'far' ? Math.PI : Math.PI / 2;
  const p = a * (1 - e * e), r = p / (1 + e * Math.cos(nu));
  const th = peri + nu;
  // Velocity in the orbit's frame: radial and tangential parts.
  const h = Math.sqrt(MU * p), vr = (MU / h) * e * Math.sin(nu), vt = (MU / h) * (1 + e * Math.cos(nu));
  return { x: r * Math.cos(th), y: r * Math.sin(th), vx: vr * Math.cos(th) - vt * Math.sin(th), vy: vr * Math.sin(th) + vt * Math.cos(th) };
}
/** The speed change each burn applies: the size that turns the loop into a circle at that point, either way. */
export function circleBurn(item: CircleItem, c: CircleChoice): { x: number; y: number; vx: number; vy: number } {
  const at: 'far' | 'near' = c.startsWith('far') ? 'far' : 'near';
  const s = loopPoint(item, at), v = Math.hypot(s.vx, s.vy);
  const dv = Math.abs(circleSpeed(Math.hypot(s.x, s.y)) - v);
  const k = (v + (c.endsWith('up') ? dv : -dv)) / v;
  return { x: s.x, y: s.y, vx: s.vx * k, vy: s.vy * k };
}
export type CircleResult = 'circle_far' | 'circle_near' | 'stretched' | 'falls' | 'away';
export function circleResult(item: CircleItem, c: CircleChoice): CircleResult {
  const b = circleBurn(item, c), p = pathOf(b.x, b.y, b.vx, b.vy);
  if (p !== 'circle') return p === 'away' ? 'away' : p === 'falls' ? 'falls' : 'stretched';
  return c.startsWith('far') ? 'circle_far' : 'circle_near';
}
export const CIRCLE_TEXT: Record<CircleChoice, string> = {
  far_up: 'Speed up at the far point', far_down: 'Slow down at the far point',
  near_up: 'Speed up at the near point', near_down: 'Slow down at the near point',
};
const CIRCLE_SAY: Record<CircleChoice, string> = {
  far_up: '"speed up at the far point", "go faster when it is farthest from Earth"',
  far_down: '"slow down at the far point"',
  near_up: '"speed up at the near point", "go faster when it is closest to Earth"',
  near_down: '"slow down at the near point", "slow down when it is closest to Earth"',
};
const RESULT_TEXT: Record<CircleResult, string> = {
  circle_far: 'goes around in a circle as far out as the far point', circle_near: 'goes around in a circle as close in as the near point',
  stretched: 'goes around in a loop that is even more stretched', falls: 'falls down to Earth', away: 'flies away into space',
};

// ── Keys, checks ─────────────────────────────────────────────────────────────────────────

export function tapKey(item: TapItem): number {
  if (item.mode === 'orbit_speed') return raceKey(item);
  const m = item.pushes.map((p, i) => ({ p: pushPath(item, p), i })).filter(x => x.p === item.ask);
  return m.length === 1 ? m[0].i : -1;
}
export function choiceKey(item: ChoiceItem): string {
  if (item.mode === 'predict_burn') return burnResult(item);
  const want: CircleResult = item.target === 'far' ? 'circle_far' : 'circle_near';
  const m = item.choices.filter(c => circleResult(item, c) === want);
  return m.length === 1 ? m[0] : '';
}
export const choiceLabel = (item: ChoiceItem, c: string) => (item.mode === 'predict_burn' ? BURN_TEXT[c as BurnOutcome] : CIRCLE_TEXT[c as CircleChoice]);
export const tapLabel = (item: TapItem, i: number) => (item.mode === 'pick_speed' ? pushLabel(item, i) : craftLabel(item.crafts[i]));
export const tapCount = (item: TapItem) => (item.mode === 'pick_speed' ? item.pushes.length : item.crafts.length);

/** The learner's work: the push or rocket tapped, or the choice. */
export interface OrbitWork { pick: number | null; choice: string | null }
export const emptyWork = (): OrbitWork => ({ pick: null, choice: null });
export const workComplete = (item: OrbitItem, w: OrbitWork) => (isTapItem(item) ? w.pick !== null : w.choice !== null);
export function orbitCorrect(item: OrbitItem | undefined, w: OrbitWork): boolean {
  if (!item) return false;
  if (isTapItem(item)) return w.pick !== null && w.pick === tapKey(item);
  return w.choice !== null && w.choice === choiceKey(item);
}

// ── Misses ───────────────────────────────────────────────────────────────────────────────

export type SpeedMiss = 'picked_slower' | 'picked_faster';
export type RaceMiss = 'picked_biggest' | 'picked_farther' | 'picked_closer';
export type BurnMiss = 'wrong_way' | 'said_no_change' | 'too_strong' | 'too_weak';
export type CircleMiss = 'other_circle' | 'wrong_way' | 'wrong_place';
export type OrbitMiss = SpeedMiss | RaceMiss | BurnMiss | CircleMiss;
export const ORBIT_MISSES: Record<OrbitMode, readonly OrbitMiss[]> = {
  pick_speed: ['picked_slower', 'picked_faster'],
  orbit_speed: ['picked_biggest', 'picked_farther', 'picked_closer'],
  predict_burn: ['wrong_way', 'said_no_change', 'too_strong', 'too_weak'],
  circularize: ['other_circle', 'wrong_way', 'wrong_place'],
};

export function tapMiss(item: TapItem, pick: number): SpeedMiss | RaceMiss | undefined {
  const key = tapKey(item);
  if (pick === key || pick < 0 || pick >= tapCount(item)) return undefined;
  if (item.mode === 'pick_speed') return PATHS.indexOf(pushPath(item, item.pushes[pick])) < PATHS.indexOf(item.ask) ? 'picked_slower' : 'picked_faster';
  if (biggestCraft(item) === pick) return 'picked_biggest';
  return item.crafts[pick].radius > item.crafts[key].radius ? 'picked_farther' : 'picked_closer';
}

export function choiceMiss(item: ChoiceItem, choice: string): BurnMiss | CircleMiss | undefined {
  const key = choiceKey(item);
  if (choice === key) return undefined;
  if (item.mode === 'predict_burn') {
    const c = BURN_OUTCOMES.indexOf(choice as BurnOutcome) - 2, k = BURN_OUTCOMES.indexOf(key as BurnOutcome) - 2;
    if (c === 0) return 'said_no_change';
    if (Math.sign(c) !== Math.sign(k)) return 'wrong_way';
    return Math.abs(c) > Math.abs(k) ? 'too_strong' : 'too_weak';
  }
  const samePlace = choice.split('_')[0] === key.split('_')[0];
  if (samePlace) return 'wrong_way';
  return choice.split('_')[1] === key.split('_')[1] ? 'wrong_place' : 'other_circle';
}

export function orbitMiss(item: OrbitItem | undefined, w: OrbitWork): OrbitMiss | undefined {
  if (!item || !workComplete(item, w)) return undefined;
  return isTapItem(item) ? tapMiss(item, w.pick!) : choiceMiss(item, w.choice!);
}

// ── The ask ──────────────────────────────────────────────────────────────────────────────

const SPEED_ASK: Record<Path, string> = {
  falls: 'Which push makes the rocket fall back down to Earth?',
  circle: 'Which push makes the rocket go around and around Earth in a circle?',
  stretched: 'Which push makes the rocket go around Earth in a long, stretched loop?',
  away: 'Which push makes the rocket fly away and never come back?',
};
const RACE_ASK: Record<RaceAsk, string> = {
  fastest: 'Which rocket is moving the fastest?',
  slowest: 'Which rocket is moving the slowest?',
  shortest_trip: 'Which rocket gets all the way around Earth in the shortest time?',
  longest_trip: 'Which rocket takes the longest time to go all the way around Earth?',
};

export function askOf(item: OrbitItem): string {
  if (item.mode === 'pick_speed') return SPEED_ASK[item.ask];
  if (item.mode === 'orbit_speed') return RACE_ASK[item.ask];
  if (item.mode === 'predict_burn') {
    return `The rocket goes around Earth in a circle. It fires its engine for a ${item.size} push ${item.dir === 'forward' ? 'forward, the way it is going' : 'backward, against the way it is going'}. What happens to its path?`;
  }
  const where = item.target === 'far' ? 'as far out as the far point of its loop' : 'as close in as the near point of its loop';
  if (item.at !== 'side') {
    return `The rocket is at the ${item.at} point of its loop. To go around in a circle ${item.target === 'far' ? 'this far out' : 'this close in'}, should it speed up or slow down here?`;
  }
  return item.show === 'ring' ? 'Fire the engine once so the rocket goes around on the dashed circle. Where, and which way?'
    : `Fire the engine once so the rocket goes around in a circle ${where}. Where, and which way?`;
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
const between = (lo: number, hi: number, rng: Rng) => Math.round((lo + (hi - lo) * rng()) * 100) / 100;
/** The next ask of a list, least used so far (a session's items ask different things). */
const fresh = <T extends string>(xs: readonly T[], used: Map<string, number>, rng: Rng): T => {
  const least = Math.min(...xs.map(x => used.get(x) ?? 0));
  const out = pickOne(xs.filter(x => (used.get(x) ?? 0) === least), rng);
  used.set(out, (used.get(out) ?? 0) + 1);
  return out;
};

/** Push sizes, as a fraction of the circle speed, for each path. Checked against the physics on every build. */
const PUSH_F: Record<Path, [number, number]> = { falls: [0.5, 0.62], circle: [1, 1], stretched: [1.17, 1.22], away: [1.5, 1.65] };

function buildSpeed(tier: OrbitTier, rng: Rng, used: Map<string, number>): SpeedItem | null {
  const sets: Path[][] = tier === 'easy' ? [['falls', 'away'], ['falls', 'circle'], ['circle', 'away']]
    : tier === 'medium' ? [['falls', 'circle', 'away']] : [['falls', 'circle', 'stretched', 'away']];
  const set = pickOne(sets, rng);
  const ask = fresh(set, used, rng);
  const height = tier === 'hard' ? between(1.4, 1.6, rng) : between(1.5, 1.9, rng);
  const pushes = shuffle(set.map(p => ({ f: between(PUSH_F[p][0], PUSH_F[p][1], rng) })), rng);
  const item: SpeedItem = { id: '', mode: 'pick_speed', height, ask, pushes };
  return validOrbitItem({ ...item, id: 'x' }) ? item : null;
}

/** orbit_speed: track radii (Earth radii) by tier, closest first; neighbours at least this far apart (ratio). */
const RACE_GAP: Record<OrbitTier, [number, number]> = { easy: [1.9, 2.3], medium: [1.35, 1.5], hard: [1.18, 1.26] };
function buildRace(tier: OrbitTier, rng: Rng, used: Map<string, number>): RaceItem | null {
  const n = tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4;
  const asks: RaceAsk[] = tier === 'easy' ? ['fastest', 'longest_trip'] : tier === 'medium' ? ['fastest', 'slowest', 'longest_trip'] : ['fastest', 'slowest', 'shortest_trip', 'longest_trip'];
  const ask = fresh(asks, used, rng);
  const radii = [between(1.3, 1.5, rng)];
  while (radii.length < n) radii.push(Math.round(radii[radii.length - 1] * between(RACE_GAP[tier][0], RACE_GAP[tier][1], rng) * 100) / 100);
  const colors = shuffle(ROCKET_COLORS, rng).slice(0, n);
  const base = rng() * 360;
  const angles = shuffle(Array.from({ length: n }, (_, i) => Math.round((base + (i * 360) / n + (rng() - 0.5) * 30) % 360)), rng);
  let crafts: Craft[] = radii.map((radius, i) => ({ color: colors[i], radius, angle: angles[i], size: 1 }));
  if (tier === 'hard') {
    const sizes = shuffle([0.8, 0.95, 1.1, 1.35], rng);
    crafts = crafts.map((c, i) => ({ ...c, size: sizes[i] }));
  }
  crafts = shuffle(crafts, rng);
  const item: RaceItem = { id: 'x', mode: 'orbit_speed', ask, crafts };
  if (tier === 'hard' && biggestCraft(item) === raceKey(item)) {
    // The biggest rocket is never the answer: swap its size with the smallest one's.
    const big = biggestCraft(item), small = crafts.map(c => c.size).indexOf(Math.min(...crafts.map(c => c.size)));
    const sizes = crafts.map(c => c.size); [sizes[big], sizes[small]] = [sizes[small], sizes[big]];
    item.crafts = crafts.map((c, i) => ({ ...c, size: sizes[i] }));
  }
  return validOrbitItem(item) ? { ...item, id: '' } : null;
}

function buildBurn(tier: OrbitTier, rng: Rng, used: Map<string, number>): BurnItem | null {
  const combos = tier === 'easy' ? ['forward:small', 'backward:small'] : ['forward:small', 'backward:small', 'forward:big', 'backward:big'];
  const [dir, size] = fresh(combos, used, rng).split(':') as [BurnDir, BurnSize];
  const height = between(1.8, 2.2, rng);
  const probe: BurnItem = { id: 'x', mode: 'predict_burn', height, dir, size, choices: [] };
  const key = burnResult(probe);
  let choices: BurnOutcome[];
  if (tier === 'easy') choices = ['closer', 'farther'];
  else if (tier === 'medium') {
    const other = burnResult({ ...probe, size: size === 'small' ? 'big' : 'small' });
    const flip = burnResult({ ...probe, dir: dir === 'forward' ? 'backward' : 'forward' });
    choices = BURN_OUTCOMES.filter(o => o === key || o === other || o === flip);
  } else choices = [...BURN_OUTCOMES];
  const item: BurnItem = { ...probe, choices };
  return validOrbitItem(item) ? { ...item, id: '' } : null;
}

function buildCircle(tier: OrbitTier, rng: Rng, used: Map<string, number>): CircleItem | null {
  const target = fresh(['far', 'near'] as const, used, rng);
  const near = between(1.4, 1.7, rng), far = Math.round(near * between(1.8, 2.3, rng) * 100) / 100;
  const tilt = tier === 'easy' ? 90 : tier === 'medium' ? pickOne([90, 0, 180, 270], rng) : Math.round(rng() * 359);
  const item: CircleItem = {
    id: 'x', mode: 'circularize', near, far, tilt, target,
    show: tier === 'hard' ? 'ring' : 'words', at: tier === 'easy' ? target : 'side',
    choices: tier === 'easy' ? CIRCLE_CHOICES.filter(c => c.startsWith(target)) : [...CIRCLE_CHOICES],
  };
  return validOrbitItem(item) ? { ...item, id: '' } : null;
}

export const ITEM_COUNT = { single: 4, blend: 2 };

/** The items of one mode at one tier; each asks something different where it can. */
export function buildModeItems(mode: OrbitMode, tier: OrbitTier, count: number, rng: Rng): OrbitItem[] {
  const out: OrbitItem[] = [];
  const used = new Map<string, number>();
  for (let tries = 0; out.length < count && tries < 200; tries++) {
    const item = mode === 'pick_speed' ? buildSpeed(tier, rng, used) : mode === 'orbit_speed' ? buildRace(tier, rng, used)
      : mode === 'predict_burn' ? buildBurn(tier, rng, used) : buildCircle(tier, rng, used);
    if (item) out.push(item);
  }
  return out;
}

export function buildOrbitItems(opts: { modes: OrbitMode[]; tier: OrbitTier; rng: Rng }): OrbitItem[] {
  const count = opts.modes.length === 1 ? ITEM_COUNT.single : ITEM_COUNT.blend;
  const out: OrbitItem[] = [];
  for (const mode of opts.modes) out.push(...buildModeItems(mode, opts.tier, count, opts.rng));
  return out.map((item, i) => ({ ...item, id: `${item.mode}-${i + 1}` }));
}

// ── Lesson data → items ──────────────────────────────────────────────────────────────────

export interface OrbitItemsSource {
  title?: string;
  gradeLevel?: string;
  challengeTypes?: string[];
  difficulty?: string;
  items?: OrbitItem[];
}

export const resolveTier = (d: OrbitItemsSource): OrbitTier => {
  const t = (d.difficulty ?? '').toLowerCase();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

/** The modes a session asks when nothing pins them, by grade rung (K-5). */
export function defaultModes(grade?: string): OrbitMode[] {
  const s = String(grade ?? '').trim().toUpperCase();
  const g = s === 'K' || s.startsWith('KINDER') ? 0 : parseInt(s.replace(/\D/g, ''), 10);
  if (Number.isNaN(g) || g <= 1) return ['pick_speed'];
  if (g === 2) return ['pick_speed', 'orbit_speed'];
  if (g === 3) return ['pick_speed', 'orbit_speed', 'predict_burn'];
  return [...ORBIT_MODES];
}

/** The modes a lesson asks: its pin, else by grade. A legacy payload (thrust, rocket, challenge) has no modes. */
export function resolveOrbitModes(d: OrbitItemsSource): OrbitMode[] {
  const asked = (d.challengeTypes ?? []).filter((m): m is OrbitMode => (ORBIT_MODES as string[]).includes(m));
  return asked.length ? ORBIT_MODES.filter(m => asked.includes(m)) : defaultModes(d.gradeLevel);
}

const inRange = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** False when a stored item is not one code could have built (its key must be computable, and only one). */
export function validOrbitItem(i: OrbitItem | undefined): i is OrbitItem {
  if (!i || typeof i.id !== 'string' || !i.id) return false;
  if (i.mode === 'pick_speed') {
    if (!inRange(i.height, 1.2, 2.5) || !(PATHS as string[]).includes(i.ask) || !Array.isArray(i.pushes) || i.pushes.length < 2 || i.pushes.length > 4) return false;
    if (!i.pushes.every(p => inRange(p?.f, 0.3, 2))) return false;
    const paths = i.pushes.map(p => pushPath(i, p));
    return new Set(paths).size === paths.length && tapKey(i) >= 0;
  }
  if (i.mode === 'orbit_speed') {
    if (!(['fastest', 'slowest', 'shortest_trip', 'longest_trip'] as string[]).includes(i.ask) || !Array.isArray(i.crafts) || i.crafts.length < 2 || i.crafts.length > 4) return false;
    if (!i.crafts.every(c => (ROCKET_COLORS as readonly string[]).includes(c?.color) && inRange(c.radius, 1.15, 6) && inRange(c.angle, 0, 360) && inRange(c.size, 0.5, 1.6))) return false;
    const radii = [...i.crafts.map(c => c.radius)].sort((a, b) => a - b);
    if (radii.some((r, k) => k > 0 && r / radii[k - 1] < 1.15)) return false;
    if (new Set(i.crafts.map(c => c.color)).size !== i.crafts.length) return false;
    const big = biggestCraft(i);
    return raceKey(i) >= 0 && (big < 0 || big !== raceKey(i));
  }
  if (i.mode === 'predict_burn') {
    if (!inRange(i.height, 1.6, 2.5) || !['forward', 'backward'].includes(i.dir) || !['small', 'big'].includes(i.size)) return false;
    if (!Array.isArray(i.choices) || i.choices.length < 2 || !i.choices.every(c => (BURN_OUTCOMES as string[]).includes(c)) || new Set(i.choices).size !== i.choices.length) return false;
    const key = burnResult(i);
    const expect: BurnOutcome = i.size === 'small' ? (i.dir === 'forward' ? 'farther' : 'closer') : (i.dir === 'forward' ? 'away' : 'falls');
    return key === expect && i.choices.includes(key);
  }
  if (i.mode === 'circularize') {
    if (!inRange(i.near, 1.2, 2.5) || !inRange(i.far, i.near * 1.4, 6) || !inRange(i.tilt, 0, 360)) return false;
    if (!['far', 'near'].includes(i.target) || !['words', 'ring'].includes(i.show) || !['far', 'near', 'side'].includes(i.at)) return false;
    if (!Array.isArray(i.choices) || i.choices.length < 2 || !i.choices.every(c => (CIRCLE_CHOICES as string[]).includes(c)) || new Set(i.choices).size !== i.choices.length) return false;
    if (i.at !== 'side' && (i.at !== i.target || i.choices.some(c => !c.startsWith(i.at)))) return false;
    return choiceKey(i) !== '';
  }
  return false;
}

/** Every item of the session: the stored, code-built items when all are valid, else built from the lesson's fields. */
export function orbitItems(d: OrbitItemsSource): OrbitItem[] {
  const stored = Array.isArray(d.items) ? d.items.filter(validOrbitItem) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  const tier = resolveTier(d);
  return buildOrbitItems({ modes: resolveOrbitModes(d), tier, rng: seededRng(`${d.title ?? 'orbit'}:${d.gradeLevel ?? ''}:${tier}`) });
}

// ── What each answer does (the flight drawn after a check) ───────────────────────────────

/** How far out the view reaches, km from Earth's centre. */
export function viewKm(item: OrbitItem): number {
  if (item.mode === 'pick_speed') {
    const h = item.height * RE;
    const stretched = item.pushes.map(p => p.f).filter(f => f > 1.05 && f < Math.SQRT2);
    const apo = stretched.length ? Math.max(...stretched.map(f => (h * f * f) / (2 - f * f))) : 0;
    return Math.max(h * 1.45, apo * 1.1);
  }
  if (item.mode === 'orbit_speed') return Math.max(...item.crafts.map(c => c.radius)) * RE * 1.18;
  if (item.mode === 'predict_burn') return item.height * RE * 1.75;
  return item.far * RE * 1.2;
}

/** The flight one answer makes: a push (pick_speed), a burn outcome (predict_burn) or a burn choice (circularize). */
export function answerFlight(item: OrbitItem, w: OrbitWork): Flight | null {
  const view = viewKm(item);
  if (item.mode === 'pick_speed') {
    if (w.pick === null || !item.pushes[w.pick]) return null;
    const s = startOf(item.height);
    return fly(s.x, s.y, item.pushes[w.pick].f * circleSpeed(s.y), 0, view);
  }
  if (item.mode === 'predict_burn') {
    const s = startOf(item.height);
    return fly(s.x, s.y, circleSpeed(s.y) * burnFactor(item), 0, view);
  }
  if (item.mode === 'circularize') {
    if (!w.choice || !(CIRCLE_CHOICES as string[]).includes(w.choice)) return null;
    const b = circleBurn(item, w.choice as CircleChoice);
    return fly(b.x, b.y, b.vx, b.vy, view);
  }
  return null;
}

/** What the flight of a learner's answer did, in words drawn on screen. */
export function flightText(item: OrbitItem, w: OrbitWork): string | null {
  if (item.mode === 'pick_speed' && w.pick !== null && item.pushes[w.pick]) return `The rocket ${PATH_TEXT[pushPath(item, item.pushes[w.pick])]}.`;
  if (item.mode === 'circularize' && w.choice) return `The rocket ${RESULT_TEXT[circleResult(item, w.choice as CircleChoice)]}.`;
  return null;
}

// ── Assignment, spoken answers ───────────────────────────────────────────────────────────

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];

/** Every option of an item, as its label, in screen order. */
const optionLabels = (item: OrbitItem): string[] => (isTapItem(item)
  ? Array.from({ length: tapCount(item) }, (_, i) => tapLabel(item, i)) : (item.choices as string[]).map(c => choiceLabel(item, c)));
const keyIndex = (item: OrbitItem) => (isTapItem(item) ? tapKey(item) : (item.choices as string[]).indexOf(choiceKey(item)));
const optionMiss = (item: OrbitItem, i: number): OrbitMiss | undefined =>
  (isTapItem(item) ? tapMiss(item, i) : choiceMiss(item, (item.choices as string[])[i]));

/** How a learner says one push: its size word, and where its arrow ranks by length among the item's pushes. */
function pushSays(item: SpeedItem, i: number): string {
  const word = pushLabel(item, i).toLowerCase(), n = item.pushes.length;
  const rank = [...item.pushes].sort((a, b) => a.f - b.f).indexOf(item.pushes[i]);
  const byLength = n === 2 ? ['the shorter arrow', 'the longer arrow'] : n === 3 ? ['the shortest arrow', 'the middle-sized arrow', 'the longest arrow']
    : ['the shortest arrow', 'the second shortest arrow', 'the second longest arrow', 'the longest arrow'];
  return `"the ${word}", "${byLength[rank]}"`;
}

/** The answer a spoken reply is judged against, with the ways a learner says it. */
export function orbitExpectedAnswer(item: OrbitItem): string {
  const labels = optionLabels(item), at = keyIndex(item);
  const others = labels.filter((_, i) => i !== at).map(l => `"${l}"`).join(', ');
  const says = item.mode === 'pick_speed' ? pushSays(item, at)
    : item.mode === 'orbit_speed' ? `"the ${item.crafts[at].color} rocket", "the ${item.crafts[at].color} one", "${item.crafts[at].color}"`
      : item.mode === 'predict_burn' ? BURN_SAY[choiceKey(item) as BurnOutcome] : CIRCLE_SAY[choiceKey(item) as CircleChoice];
  return `"${labels[at]}" (choice ${at + 1} of ${labels.length}): ${says}, or its place in the row ("the ${ORDINAL[at]} one") count. `
    + `${others} ${labels.length > 2 ? 'are' : 'is'} wrong, and so is naming two or hedging between them.`;
}

const MISS_WORDS: Record<OrbitMiss, string> = {
  picked_slower: 'names a smaller push, whose rocket does something slower than asked',
  picked_faster: 'names a bigger push, whose rocket does something faster than asked',
  picked_biggest: 'names the rocket drawn biggest',
  picked_farther: 'names a rocket on a track farther out',
  picked_closer: 'names a rocket on a track closer in',
  wrong_way: 'picks the change the other way round',
  said_no_change: 'says the path stays the same',
  too_strong: 'picks a bigger change than the push makes',
  too_weak: 'picks a smaller change than the push makes',
  other_circle: 'picks the burn that makes a circle at the other height',
  wrong_place: 'picks the right way to fire at the wrong point of the loop',
};

/** An item's known wrong spoken answers, most specific first, with the tap's miss ids. */
export function orbitSpokenMisses(item: OrbitItem): KnownMiss[] {
  const labels = optionLabels(item), at = keyIndex(item);
  const groups = new Map<OrbitMiss, string[]>();
  labels.forEach((l, i) => { if (i === at) return; const m = optionMiss(item, i)!; groups.set(m, [...(groups.get(m) ?? []), l]); });
  const out: KnownMiss[] = [];
  for (const m of ORBIT_MISSES[item.mode]) {
    const xs = groups.get(m);
    if (!xs) continue;
    out.push({ id: m, pattern: `The right answer is "${labels[at]}". The learner's answer ${MISS_WORDS[m]}: ${xs.map(x => `"${x}"`).join(', ')}.`, examples: xs });
  }
  return out;
}

const HOW: Record<OrbitMode, string> = {
  pick_speed: 'The learner answers by saying which push, or tapping one and pressing Launch and check; the rocket flies only after that.',
  orbit_speed: 'The learner answers by saying which rocket, or tapping one and checking it.',
  predict_burn: 'The learner answers by saying it, or tapping a choice and checking it.',
  circularize: 'The learner answers by saying it, or tapping a choice and checking it.',
};

/** Every item is a sayable closed choice: spoken (judged against `expectedAnswer`) or tapped and checked by code. */
export function workspaceAssignment(item: OrbitItem): TeachingAssignment {
  const misses = orbitSpokenMisses(item);
  return { id: item.id, task: `${askOf(item)} ${HOW[item.mode]}`, response: 'speech', acceptsGesture: true,
    expectedAnswer: orbitExpectedAnswer(item), ...(misses.length ? { misses } : {}) };
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface OrbitView {
  work: OrbitWork;
  /** The answer has been credited (or revealed): the flight and the result are on screen. */
  solved: boolean;
  /** A checked answer's flight is on screen (the learner's own pick). */
  flown: boolean;
}

const SIZE_ORDER: Path[] = ['falls', 'circle', 'stretched', 'away'];
const RANK_WORDS = ['closest to Earth', 'next out', 'farther out', 'farthest out'];

export function describeOrbitWork(item: OrbitItem | undefined, w: OrbitWork): string {
  if (!item) return 'Nothing chosen yet';
  if (isTapItem(item)) return w.pick === null ? 'Nothing picked yet' : `Picked the ${tapLabel(item, w.pick).toLowerCase()}`;
  return w.choice ? `Chose "${choiceLabel(item, w.choice)}"` : 'Nothing chosen yet';
}

const CONSTRAINTS_TAP = 'The learner answers by saying it, or by tapping and checking; the activity judges the tap. Nothing flies or '
  + 'moves until the answer. You cannot tap or check for the learner.';
const CONSTRAINTS_CHOICE = 'The learner answers by saying it, or by tapping and checking; the activity judges the tap. '
  + 'The new path is drawn only after the answer. You cannot tap or check a choice for the learner.';

/** What is drawn and asked. Never the key; results only for what has flown. */
export function workspaceScene(item: OrbitItem, view: OrbitView): WorkspaceScene {
  const facts: Record<string, string> = { kind: item.mode, question: askOf(item) };
  if (item.mode === 'pick_speed') {
    const sizes = SIZE_ORDER.filter(p => item.pushes.some(x => pushPath(item, x) === p)).map(p => PUSH_WORD[p].toLowerCase());
    facts.shown = `Earth, and the rocket high above the air, standing still. ${item.pushes.length} pushes to choose from, each a sideways arrow; from shortest to longest: ${sizes.join(', ')}. No path is drawn.`;
  } else if (item.mode === 'orbit_speed') {
    const byR = [...item.crafts].sort((a, b) => a.radius - b.radius);
    const words = item.crafts.map(c => `${craftLabel(c).toLowerCase()} ${RANK_WORDS[byR.indexOf(c)] ?? ''}`.trim()).sort();
    facts.shown = `Earth with ${item.crafts.length} rockets, each on its own round track, standing still: ${words.join('; ')}.`
      + `${biggestCraft(item) >= 0 ? ' The rockets are drawn at different sizes.' : ''}`;
    if (view.solved) facts.credited = 'All the rockets now move around their tracks.';
  } else if (item.mode === 'predict_burn') {
    facts.shown = `The rocket on a round track around Earth (dashed), with an arrow for its ${item.size} push ${item.dir === 'forward' ? 'forward' : 'backward'}. Its new path is not drawn.`;
    facts.choices = item.choices.map((c, i) => `${i + 1}) ${BURN_TEXT[c]}`).join('  ');
    if (view.solved) facts.credited = `The new path is drawn: ${BURN_TEXT[burnResult(item)].toLowerCase()}.`;
  } else {
    facts.shown = `The rocket going around Earth on a stretched loop${item.at === 'side' ? ', partway between its near point and its far point' : `, now at its ${item.at} point`}.`
      + `${item.show === 'ring' ? ' A dashed circle around Earth passes through one point of the loop.' : ''} The near point and the far point are not marked.`;
    facts.choices = item.choices.map((c, i) => `${i + 1}) ${CIRCLE_TEXT[c]}`).join('  ');
  }
  if (view.flown || view.solved) {
    const ft = flightText(item, view.work);
    if (ft) facts.flight = `The learner's answer has flown: ${ft}`;
  }
  facts.learnerWork = describeOrbitWork(item, view.work);
  facts.constraints = isTapItem(item) ? CONSTRAINTS_TAP : CONSTRAINTS_CHOICE;
  return { objects: [], facts };
}

// ── The journey's learner (liveJourneySpec row, the dry sweep) ───────────────────────────

/** The journey's answers: the key, and the wrong answer showing the mode's first-listed miss it can. */
export function orbitHarnessAnswers(item: OrbitItem): { correct: OrbitWork; plainWrong: OrbitWork } {
  const order = ORBIT_MISSES[item.mode];
  if (isTapItem(item)) {
    const key = tapKey(item);
    const wrongs = Array.from({ length: tapCount(item) }, (_, i) => i).filter(i => i !== key)
      .sort((a, b) => order.indexOf(tapMiss(item, a)!) - order.indexOf(tapMiss(item, b)!));
    return { correct: { pick: key, choice: null }, plainWrong: { pick: wrongs[0], choice: null } };
  }
  const key = choiceKey(item);
  const wrongs = (item.choices as string[]).filter(c => c !== key)
    .sort((a, b) => order.indexOf(choiceMiss(item, a)!) - order.indexOf(choiceMiss(item, b)!));
  return { correct: { pick: null, choice: key }, plainWrong: { pick: null, choice: wrongs[0] } };
}
