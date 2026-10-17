/**
 * mission-planner on the shared tutor/JEV teaching workspace (W1, plain shape; R2 batch B1, rebuilt 2026-10-16 under the
 * 10-15 ruling and the 10-16 ruling for this primitive: graded at grades 2-5, an ungraded story at K-1).
 *
 * The old planner was a four-step wizard that always passed: a "Best!" badge sat on the optimal launch window, the
 * window descriptions stated the answer ("Earth and Mars are closest!"), the supply rows showed packed and needed days
 * with a check mark, every destination's travel time was printed, and travel days, the optimal flag and the multipliers
 * all came from Gemini unchecked. The rebuild keeps the subject (places are different distances away, planets move so
 * launch timing matters, a trip needs supplies for the way home too, flybys trade time for fuel) and turns it into four
 * code-keyed choices. Gemini writes the title and overview only.
 *
 * - farther_closer: 2-4 places (the Moon, Mars, the asteroid belt, the giant planets) drawn as same-size pictures with
 *   their names; which is farthest (or closest) from Earth. The key is the real order of distances (`PLACE_AU`); no map
 *   or distance is drawn until the answer. easy: 2 places at least three steps apart; medium: 3, two steps apart;
 *   hard: 4, with the key's next-door neighbour.
 * - pick_window: 2-4 launch months, each a small picture of the Sun, Earth's orbit and the target's orbit with both
 *   planets where they are that month (real orbit speeds from a common start); which month needs the least fuel (or the
 *   most): the one where the target is closest to Earth. easy: same side vs far side; hard: four, a near miss.
 * - pack_days: a trip to the Moon drawn as day squares for the way there and the stay, then an arrow home "the same
 *   way" with no squares; how many food packs. Key = crew x (2 x days there + days staying). easy: one astronaut, two
 *   choices; medium: three; hard: a crew of 2-4, four choices. The foils are the known slips (forgot the way home,
 *   counted the stay twice, forgot the crew, ...), so no fixed pick (biggest, smallest, middle) wins.
 * - assist_tradeoff: 2-4 routes to Jupiter or Saturn, each with the planets it swings past drawn on its path and its
 *   trip time in years; which route uses the least fuel AND arrives within the limit. Each flyby gives the ship a free
 *   push, so more flybys need less fuel; flyby routes are slower. Fuel is never drawn.
 *
 * Every item is a sayable closed choice (J14, user 10-13): spoken and judged against `expectedAnswer`, or tapped and
 * checked by code. Pure: the component, the generator, the adapter, the journey row and the tests read the same items,
 * checks, misses and scene.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';

export type MissionMode = 'farther_closer' | 'pick_window' | 'pack_days' | 'assist_tradeoff';
export const MISSION_MODES: MissionMode[] = ['farther_closer', 'pick_window', 'pack_days', 'assist_tradeoff'];
export type MissionTier = 'easy' | 'medium' | 'hard';

// ── Places (real order of distance from Earth) ───────────────────────────────────────────

export type Place = 'moon' | 'mars' | 'asteroids' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';
/** Nearest first. The Moon circles Earth; the rest are in order out from the Sun past Earth's orbit. */
export const PLACES: Place[] = ['moon', 'mars', 'asteroids', 'jupiter', 'saturn', 'uranus', 'neptune'];
/** Distance in AU: the Moon from Earth; the others from the Sun (the average trip from Earth grows in the same order). */
export const PLACE_AU: Record<Place, number> = {
  moon: 0.00257, mars: 1.52, asteroids: 2.7, jupiter: 5.2, saturn: 9.5, uranus: 19.2, neptune: 30.1,
};
export const PLACE_NAME: Record<Place, string> = {
  moon: 'The Moon', mars: 'Mars', asteroids: 'The asteroid belt', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune',
};
export const PLACE_COLOR: Record<Place, string> = {
  moon: '#cbd5e1', mars: '#ef4444', asteroids: '#a8a29e', jupiter: '#d4a46a', saturn: '#e9c46a', uranus: '#7dd3fc', neptune: '#3b82f6',
};
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// ── Launch windows (real orbit speeds) ───────────────────────────────────────────────────

export type Target = 'venus' | 'mars' | 'jupiter';
export const TARGET_NAME: Record<Target, string> = { venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter' };
export const TARGET_AU: Record<Target, number> = { venus: 0.72, mars: 1.52, jupiter: 5.2 };
/** Degrees each planet moves around the Sun in one month (360 / orbital period in months). */
export const DEG_PER_MONTH: Record<Target | 'earth', number> = { earth: 30, venus: 48.1, mars: 15.9, jupiter: 2.5 };
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** One launch month: where Earth and the target are (degrees round the Sun, 0 = right of the Sun, counterclockwise). */
export interface LaunchWindow { month: string; earth: number; planet: number }

const norm360 = (a: number) => ((a % 360) + 360) % 360;
/** The angle between Earth and the target around the Sun, 0-180. */
export const separation = (w: LaunchWindow) => { const d = Math.abs(norm360(w.earth) - norm360(w.planet)) % 360; return d > 180 ? 360 - d : d; };
/** Straight-line distance from Earth to the target that month, in AU. */
export function windowDistance(target: Target, w: LaunchWindow): number {
  const r = TARGET_AU[target], d = (separation(w) * Math.PI) / 180;
  return Math.sqrt(1 + r * r - 2 * r * Math.cos(d));
}

// ── Routes (flybys) ──────────────────────────────────────────────────────────────────────

export type FarTarget = 'jupiter' | 'saturn';
export type FlybyPlanet = 'venus' | 'earth' | 'mars';
export const FLYBY_NAME: Record<FlybyPlanet, string> = { venus: 'Venus', earth: 'Earth', mars: 'Mars' };
export const FAR_NAME: Record<FarTarget, string> = { jupiter: 'Jupiter', saturn: 'Saturn' };
export interface Route { flybys: FlybyPlanet[]; years: number }
export const ROUTE_LETTERS = ['A', 'B', 'C', 'D'] as const;
export const routeLabel = (i: number) => `Route ${ROUTE_LETTERS[i]}`;

// ── Items ────────────────────────────────────────────────────────────────────────────────

export type Polarity = 'far' | 'near';
export interface FartherItem { id: string; mode: 'farther_closer'; ask: Polarity; places: Place[] }
export type FuelAsk = 'least' | 'most';
export interface WindowItem { id: string; mode: 'pick_window'; target: Target; ask: FuelAsk; windows: LaunchWindow[] }
export interface PackItem { id: string; mode: 'pack_days'; there: number; stay: number; crew: number; options: number[] }
export interface AssistItem { id: string; mode: 'assist_tradeoff'; target: FarTarget; limit: number; routes: Route[] }
export type MissionItem = FartherItem | WindowItem | PackItem | AssistItem;

/** The packs a trip needs: each astronaut eats one pack a day, there, staying, and home the same way. */
export const packsNeeded = (i: Pick<PackItem, 'there' | 'stay' | 'crew'>) => i.crew * (2 * i.there + i.stay);

export const optionCount = (item: MissionItem) =>
  item.mode === 'farther_closer' ? item.places.length : item.mode === 'pick_window' ? item.windows.length
    : item.mode === 'pack_days' ? item.options.length : item.routes.length;

export function optionLabel(item: MissionItem, i: number): string {
  if (item.mode === 'farther_closer') return PLACE_NAME[item.places[i]];
  if (item.mode === 'pick_window') return item.windows[i].month;
  if (item.mode === 'pack_days') return `${item.options[i]} packs`;
  return routeLabel(i);
}

/** The key's index, or -1 when the item has no single key. */
export function keyOf(item: MissionItem): number {
  const unique = (vals: number[], want: number) => (vals.filter(v => Math.abs(v - want) < 1e-9).length === 1 ? vals.findIndex(v => Math.abs(v - want) < 1e-9) : -1);
  if (item.mode === 'farther_closer') {
    const d = item.places.map(p => PLACE_AU[p]);
    return unique(d, item.ask === 'far' ? Math.max(...d) : Math.min(...d));
  }
  if (item.mode === 'pick_window') {
    const d = item.windows.map(w => windowDistance(item.target, w));
    return unique(d, item.ask === 'least' ? Math.min(...d) : Math.max(...d));
  }
  if (item.mode === 'pack_days') return unique(item.options, packsNeeded(item));
  const inTime = item.routes.map(r => (r.years <= item.limit ? r.flybys.length : -1));
  const best = Math.max(...inTime);
  return best < 0 ? -1 : unique(inTime, best);
}

/** The learner's work: the option tapped (choice index). */
export interface MissionWork { pick: number | null }
export const emptyWork = (): MissionWork => ({ pick: null });
export const workComplete = (_item: MissionItem, w: MissionWork) => w.pick !== null;
export function missionCorrect(item: MissionItem | undefined, w: MissionWork): boolean {
  return !!item && w.pick !== null && w.pick === keyOf(item);
}

// ── Misses ───────────────────────────────────────────────────────────────────────────────

export type FartherMiss = 'other_end' | 'next_in_line' | 'in_between';
export type WindowMiss = 'far_apart' | 'close_together' | 'in_between_window';
export type PackMiss = 'forgot_home' | 'stay_twice' | 'forgot_stay' | 'forgot_crew' | 'added_crew';
export type AssistMiss = 'too_slow' | 'picked_direct' | 'fewer_flybys';
export type MissionMiss = FartherMiss | WindowMiss | PackMiss | AssistMiss;
export const MISSION_MISSES: Record<MissionMode, readonly MissionMiss[]> = {
  farther_closer: ['other_end', 'next_in_line', 'in_between'],
  pick_window: ['far_apart', 'close_together', 'in_between_window'],
  pack_days: ['forgot_home', 'stay_twice', 'forgot_stay', 'forgot_crew', 'added_crew'],
  assist_tradeoff: ['too_slow', 'picked_direct', 'fewer_flybys'],
};

/** Each slip's count of packs for a trip (pack_days foils). Crew slips only with more than one astronaut. */
export function slipValue(i: Pick<PackItem, 'there' | 'stay' | 'crew'>, m: PackMiss): number | null {
  const { there: N, stay: S, crew: c } = i;
  if (m === 'forgot_home') return c * (N + S);
  if (m === 'stay_twice') return c * (2 * N + 2 * S);
  if (m === 'forgot_stay') return c * 2 * N;
  if (c < 2) return null;
  return m === 'forgot_crew' ? 2 * N + S : 2 * N + S + c;
}

export function optionMiss(item: MissionItem, i: number): MissionMiss | undefined {
  const key = keyOf(item);
  if (i === key || i < 0 || i >= optionCount(item)) return undefined;
  if (item.mode === 'farther_closer' || item.mode === 'pick_window') {
    // Rank by how far each option is from the asked end: 0 is the key.
    const v = item.mode === 'farther_closer' ? item.places.map(p => PLACE_AU[p]) : item.windows.map(w => windowDistance(item.target, w));
    const towardKey = (item.mode === 'farther_closer' ? item.ask === 'far' : item.ask === 'most') ? -1 : 1;
    const order = v.map((x, k) => ({ x, k })).sort((a, b) => towardKey * (a.x - b.x)).map(o => o.k);
    const rank = order.indexOf(i);
    if (item.mode === 'farther_closer') return rank === order.length - 1 ? 'other_end' : rank === 1 ? 'next_in_line' : 'in_between';
    const d = windowDistance(item.target, item.windows[i]);
    const all = item.windows.map(w => windowDistance(item.target, w));
    if (rank !== order.length - 1) return 'in_between_window';
    return d === Math.max(...all) ? 'far_apart' : 'close_together';
  }
  if (item.mode === 'pack_days') {
    const v = item.options[i];
    return MISSION_MISSES.pack_days.find(m => slipValue(item, m as PackMiss) === v) ?? 'forgot_home';
  }
  const r = item.routes[i];
  if (r.years > item.limit) return 'too_slow';
  return r.flybys.length === 0 ? 'picked_direct' : 'fewer_flybys';
}

export function missionMiss(item: MissionItem | undefined, w: MissionWork): MissionMiss | undefined {
  if (!item || w.pick === null) return undefined;
  return optionMiss(item, w.pick);
}

// ── The ask ──────────────────────────────────────────────────────────────────────────────

export function askOf(item: MissionItem): string {
  if (item.mode === 'farther_closer') {
    const n = item.places.length;
    if (item.ask === 'far') return n === 2 ? 'Your ship can fly to one of these places. Which one is farther from Earth?' : 'Your ship can fly to one of these places. Which one is farthest from Earth?';
    return n === 2 ? 'Your ship can fly to one of these places. Which one is closer to Earth?' : 'Your ship can fly to one of these places. Which one is closest to Earth?';
  }
  if (item.mode === 'pick_window') {
    return `You are flying to ${TARGET_NAME[item.target]}. Which launch month needs the ${item.ask === 'least' ? 'least' : 'most'} fuel?`;
  }
  if (item.mode === 'pack_days') {
    const crew = item.crew === 1 ? 'One astronaut flies' : `${item.crew} astronauts fly`;
    return `${crew} to the Moon. In this mission the trip there takes ${item.there} days, the crew stays ${item.stay} `
      + `day${item.stay === 1 ? '' : 's'}, then flies home the same way. Each astronaut eats 1 food pack a day. How many food packs must you pack?`;
  }
  return `Which route to ${FAR_NAME[item.target]} uses the least fuel and gets there in no more than ${item.limit} years?`;
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
const int = (lo: number, hi: number, rng: Rng) => lo + Math.floor(rng() * (hi - lo + 1));
/** The next value of a list, least used so far (a session's items ask different things). */
const fresh = <T extends string>(xs: readonly T[], used: Map<string, number>, rng: Rng, tag = ''): T => {
  const n = (x: string) => used.get(tag + x) ?? 0;
  const least = Math.min(...xs.map(n));
  const out = pickOne(xs.filter(x => n(x) === least), rng);
  used.set(tag + out, n(out) + 1);
  return out;
};

/** farther_closer. easy: 2 places 3+ steps apart; medium: 3, each 2+ apart; hard: 4, the key's neighbour among them. */
function buildFarther(tier: MissionTier, rng: Rng, used: Map<string, number>): FartherItem | null {
  const ask = fresh(['far', 'near'] as const, used, rng, 'ask');
  const n = tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4;
  const idx = shuffle(PLACES.map((_, i) => i), rng).slice(0, n).sort((a, b) => a - b);
  const gaps = idx.slice(1).map((x, k) => x - idx[k]);
  if (tier === 'easy' && gaps[0] < 3) return null;
  if (tier === 'medium' && gaps.some(g => g < 2)) return null;
  if (tier === 'hard') {
    // The key's next-door neighbour (one step away) is among the places.
    if (ask === 'far' ? gaps[gaps.length - 1] !== 1 : gaps[0] !== 1) return null;
  }
  const item: FartherItem = { id: 'x', mode: 'farther_closer', ask, places: shuffle(idx.map(i => PLACES[i]), rng) };
  return validMissionItem(item) ? { ...item, id: '' } : null;
}

/** pick_window: n launch months from one start, real orbit speeds, a clear key by the tier's separation bands. */
function buildWindow(tier: MissionTier, rng: Rng, used: Map<string, number>): WindowItem | null {
  const target = fresh(['mars', 'venus', 'jupiter'] as const, used, rng, 'target');
  const ask: FuelAsk = fresh(['least', 'most'] as const, used, rng, 'fuel');
  const n = tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4;
  const e0 = int(0, 359, rng), p0 = int(0, 359, rng), m0 = int(0, 11, rng);
  const months = shuffle(Array.from({ length: 30 }, (_, t) => t), rng).slice(0, n).sort((a, b) => a - b);
  if (months.slice(1).some((t, k) => t - months[k] < 2)) return null;
  const names = months.map(t => MONTHS[(m0 + t) % 12]);
  if (new Set(names).size !== names.length) return null;
  const windows: LaunchWindow[] = months.map((t, k) => ({
    month: `${names[k]} ${2027 + Math.floor((m0 + t) / 12)}`,
    earth: Math.round(norm360(e0 + DEG_PER_MONTH.earth * t)),
    planet: Math.round(norm360(p0 + DEG_PER_MONTH[target] * t)),
  }));
  // Separation from the asked end: 0 = the key's side (closest for least fuel, farthest apart for most).
  const s = windows.map(w => (ask === 'least' ? separation(w) : 180 - separation(w))).sort((a, b) => a - b);
  const ok = tier === 'easy' ? s[0] <= 35 && s[1] >= 140
    : tier === 'medium' ? s[0] <= 35 && s[1] >= 70 && s[2] - s[1] >= 30
      : s[0] <= 30 && s[1] >= 45 && s[1] <= 75 && s[2] >= 85 && s[3] - s[2] >= 20;
  if (!ok) return null;
  const item: WindowItem = { id: 'x', mode: 'pick_window', target, ask, windows };
  return validMissionItem(item) ? { ...item, id: '' } : null;
}

/**
 * pack_days. The foils are the slips (`slipValue`): easy one of {forgot the way home, counted the stay twice} (one
 * smaller, one bigger than the key); medium forgot-home plus one of {forgot the stay, stay twice}; hard three of the five
 * slips, so the key is sometimes the biggest, sometimes not, and never the smallest by rule.
 */
function buildPack(tier: MissionTier, rng: Rng, used: Map<string, number>): PackItem | null {
  const crew = tier === 'hard' ? int(2, 4, rng) : 1;
  const there = tier === 'easy' ? int(2, 4, rng) : tier === 'medium' ? int(3, 7, rng) : int(2, 5, rng);
  const stay = tier === 'easy' ? int(1, 2, rng) : int(1, 3, rng);
  if (stay >= there) return null;
  const base = { there, stay, crew };
  let slips: PackMiss[];
  if (tier === 'easy') slips = [fresh(['forgot_home', 'stay_twice'] as const, used, rng, 'slip')];
  else if (tier === 'medium') slips = ['forgot_home', fresh(['forgot_stay', 'stay_twice'] as const, used, rng, 'slip')];
  else slips = shuffle(['forgot_home', 'stay_twice', 'forgot_stay', 'forgot_crew', 'added_crew'] as const, rng).slice(0, 3);
  const values = [packsNeeded(base), ...slips.map(m => slipValue(base, m))];
  if (values.some(v => v === null || v <= 0) || new Set(values).size !== values.length) return null;
  const item: PackItem = { id: 'x', mode: 'pack_days', ...base, options: shuffle(values as number[], rng) };
  return validMissionItem(item) ? { ...item, id: '' } : null;
}

const FLYBYS: Record<number, FlybyPlanet[][]> = {
  0: [[]],
  1: [['venus'], ['earth'], ['mars']],
  2: [['venus', 'earth'], ['earth', 'mars'], ['venus', 'venus']],
  3: [['venus', 'venus', 'earth'], ['venus', 'earth', 'earth']],
};
type RouteRole = 'direct' | 'slow' | 'fewer' | 'slow_any';

/**
 * assist_tradeoff. The key is the in-time route with the most flybys. Foils: `direct` (no flyby, fastest, most fuel),
 * `slow` (more flybys than the key, past the limit), `fewer` (in time, fewer flybys), `slow_any` (past the limit, any
 * flybys). easy: key + direct or slow; medium: key + two of direct/slow/fewer; hard: key + direct + fewer + slow (key 2
 * flybys) or slow_any (key 3 flybys). Years of in-time flyby routes are drawn at random under the limit, so neither
 * "the slowest in time" nor "the most flybys" is the key by rule.
 */
function buildAssist(tier: MissionTier, rng: Rng, used: Map<string, number>): AssistItem | null {
  const target = fresh(['jupiter', 'saturn'] as const, used, rng, 'far');
  let roles: RouteRole[];
  let k: number;
  let fewerSlower = false;
  if (tier === 'easy') {
    // With two routes, a `fewer` foil is always the slower of the two in time, so "the slowest that arrives in time"
    // is not the key by rule (probe 10-16: it won every easy item before).
    const foil = fresh(['direct', 'slow', 'fewer'] as const, used, rng, 'afoil');
    roles = [foil]; k = foil === 'direct' ? int(1, 2, rng) : foil === 'fewer' ? 2 : int(0, 2, rng);
    fewerSlower = foil === 'fewer';
  } else if (tier === 'medium') {
    const pair = fresh(['direct+slow', 'direct+fewer', 'fewer+slow'] as const, used, rng, 'apair');
    roles = pair.split('+') as RouteRole[];
    k = pair === 'direct+slow' ? int(1, 2, rng) : pair === 'direct+fewer' ? int(2, 3, rng) : 2;
  } else {
    k = fresh(['2', '3'] as const, used, rng, 'ak') === '2' ? 2 : 3;
    roles = ['direct', 'fewer', k === 2 ? 'slow' : 'slow_any'];
  }
  const d0 = target === 'jupiter' ? int(2, 3, rng) : int(3, 4, rng);
  const limit = d0 + int(2, 4, rng);
  const inTimeYears = () => int(d0 + 1, limit, rng);
  const route = (f: number, years: number): Route => ({ flybys: [...pickOne(FLYBYS[f], rng)], years });
  const keyYears = k === 0 ? d0 : fewerSlower ? int(d0 + 1, limit - 1, rng) : inTimeYears();
  const routes: Route[] = [route(k, keyYears)];
  for (const role of roles) {
    if (role === 'direct') routes.push(route(0, d0));
    else if (role === 'fewer') routes.push(route(int(1, k - 1, rng), fewerSlower ? int(keyYears + 1, limit, rng) : inTimeYears()));
    else if (role === 'slow') routes.push(route(int(k + 1, 3, rng), int(limit + 1, limit + 3, rng)));
    else routes.push(route(int(0, 3, rng), int(limit + 1, limit + 3, rng)));
  }
  if (roles.includes('fewer') && k < 2) return null;
  if (roles.includes('slow') && k > 2) return null;
  const item: AssistItem = { id: 'x', mode: 'assist_tradeoff', target, limit, routes: shuffle(routes, rng) };
  return validMissionItem(item) ? { ...item, id: '' } : null;
}

export const ITEM_COUNT = { single: 4, blend: 2 };

/** The items of one mode at one tier; each asks something different where it can, and no two are the same. */
export function buildModeItems(mode: MissionMode, tier: MissionTier, count: number, rng: Rng): MissionItem[] {
  const out: MissionItem[] = [];
  const seen = new Set<string>();
  const used = new Map<string, number>();
  for (let tries = 0; out.length < count && tries < 2000; tries++) {
    const item = mode === 'farther_closer' ? buildFarther(tier, rng, used) : mode === 'pick_window' ? buildWindow(tier, rng, used)
      : mode === 'pack_days' ? buildPack(tier, rng, used) : buildAssist(tier, rng, used);
    if (!item) continue;
    const sig = JSON.stringify({ ...item, id: '' });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(item);
  }
  return out;
}

export function buildMissionItems(opts: { modes: MissionMode[]; tier: MissionTier; rng: Rng }): MissionItem[] {
  const count = opts.modes.length === 1 ? ITEM_COUNT.single : ITEM_COUNT.blend;
  const out: MissionItem[] = [];
  for (const mode of opts.modes) out.push(...buildModeItems(mode, opts.tier, count, opts.rng));
  return out.map((item, i) => ({ ...item, id: `${item.mode}-${i + 1}` }));
}

// ── Grade: K-1 is the ungraded story (user ruling 10-16) ─────────────────────────────────

/** The grade rung 0 (K) .. 5, or null when the grade cannot be read. */
export function gradeRung(grade?: string): number | null {
  const s = String(grade ?? '').trim().toUpperCase();
  if (!s) return null;
  if (s === 'K' || s.startsWith('KINDER') || s === 'PRESCHOOL') return 0;
  const n = parseInt(s.replace(/\D/g, ''), 10);
  return Number.isNaN(n) ? null : Math.max(0, Math.min(5, n));
}
/** K and Grade 1: an exploratory planning story, never scored and never on the graded workspace. */
export const isStoryGrade = (grade?: string) => { const r = gradeRung(grade); return r !== null && r <= 1; };

/** The modes a session asks when nothing pins them, by grade rung (2-5). */
export function defaultModes(grade?: string): MissionMode[] {
  const g = gradeRung(grade) ?? 3;
  if (g <= 2) return ['farther_closer', 'pick_window'];
  if (g === 3) return ['farther_closer', 'pick_window', 'pack_days'];
  return [...MISSION_MODES];
}

// ── Lesson data → items ──────────────────────────────────────────────────────────────────

export interface MissionItemsSource {
  title?: string;
  gradeLevel?: string;
  challengeTypes?: string[];
  difficulty?: string;
  items?: MissionItem[];
}

export const resolveTier = (d: MissionItemsSource): MissionTier => {
  const t = (d.difficulty ?? '').toLowerCase();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

/** The modes a lesson asks: its pin, else by grade. A legacy payload (destinations, windows, supplies) has no modes. */
export function resolveMissionModes(d: MissionItemsSource): MissionMode[] {
  const asked = (d.challengeTypes ?? []).filter((m): m is MissionMode => (MISSION_MODES as string[]).includes(m));
  return asked.length ? MISSION_MODES.filter(m => asked.includes(m)) : defaultModes(d.gradeLevel);
}

const isInt = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

/** False when a stored item is not one code could have built (its key must be computable, and only one). */
export function validMissionItem(i: MissionItem | undefined): i is MissionItem {
  if (!i || typeof i.id !== 'string' || !i.id) return false;
  if (i.mode === 'farther_closer') {
    if (!['far', 'near'].includes(i.ask) || !Array.isArray(i.places) || i.places.length < 2 || i.places.length > 4) return false;
    return i.places.every(p => PLACES.includes(p)) && new Set(i.places).size === i.places.length && keyOf(i) >= 0;
  }
  if (i.mode === 'pick_window') {
    if (!(['venus', 'mars', 'jupiter'] as string[]).includes(i.target) || !['least', 'most'].includes(i.ask)) return false;
    if (!Array.isArray(i.windows) || i.windows.length < 2 || i.windows.length > 4) return false;
    if (!i.windows.every(w => w && typeof w.month === 'string' && !!w.month && isInt(w.earth, 0, 359) && isInt(w.planet, 0, 359))) return false;
    const first = i.windows.map(w => w.month.split(' ')[0]);
    if (new Set(first).size !== first.length || keyOf(i) < 0) return false;
    // The key stands clear: at least 15 degrees nearer the asked end than the next window.
    const s = i.windows.map(w => (i.ask === 'least' ? separation(w) : 180 - separation(w))).sort((a, b) => a - b);
    return s[1] - s[0] >= 15;
  }
  if (i.mode === 'pack_days') {
    if (!isInt(i.there, 1, 12) || !isInt(i.stay, 0, 6) || !isInt(i.crew, 1, 5)) return false;
    if (!Array.isArray(i.options) || i.options.length < 2 || i.options.length > 4 || !i.options.every(v => isInt(v, 1, 200))) return false;
    if (new Set(i.options).size !== i.options.length || keyOf(i) < 0) return false;
    // Every foil is a named slip: nothing on the buttons is a random number.
    return i.options.every(v => v === packsNeeded(i) || MISSION_MISSES.pack_days.some(m => slipValue(i, m as PackMiss) === v));
  }
  if (i.mode === 'assist_tradeoff') {
    if (!(['jupiter', 'saturn'] as string[]).includes(i.target) || !isInt(i.limit, 2, 12)) return false;
    if (!Array.isArray(i.routes) || i.routes.length < 2 || i.routes.length > 4) return false;
    if (!i.routes.every(r => r && isInt(r.years, 1, 16) && Array.isArray(r.flybys) && r.flybys.length <= 3
      && r.flybys.every(f => (['venus', 'earth', 'mars'] as string[]).includes(f)))) return false;
    return keyOf(i) >= 0;
  }
  return false;
}

/** Every item of the session: the stored, code-built items when all are valid, else built from the lesson's fields. */
export function missionItems(d: MissionItemsSource): MissionItem[] {
  if (isStoryGrade(d.gradeLevel)) return [];
  const stored = Array.isArray(d.items) ? d.items.filter(validMissionItem) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  const tier = resolveTier(d);
  return buildMissionItems({ modes: resolveMissionModes(d), tier, rng: seededRng(`${d.title ?? 'mission'}:${d.gradeLevel ?? ''}:${tier}`) });
}

// ── What the screen says after the answer ────────────────────────────────────────────────

const listOf = (xs: string[]) => (xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** The answer, explained (shown after credit or a reveal). */
export function revealText(item: MissionItem): string {
  const key = keyOf(item);
  if (item.mode === 'farther_closer') {
    const order = [...item.places].sort((a, b) => PLACE_AU[a] - PLACE_AU[b]).map(p => lower(PLACE_NAME[p]));
    const k = PLACE_NAME[item.places[key]];
    return `${k} is the ${item.ask === 'far' ? 'farthest' : 'closest'}. Going out from Earth: ${listOf(order)}. `
      + `The farther the place, the longer the trip.`;
  }
  if (item.mode === 'pick_window') {
    const w = item.windows[key], t = TARGET_NAME[item.target];
    return item.ask === 'least'
      ? `${w.month}: Earth and ${t} are closest together then, so the ship's path is shortest and it needs the least fuel.`
      : `${w.month}: Earth and ${t} are on far sides of the Sun then, so the path is longest and it needs the most fuel.`;
  }
  if (item.mode === 'pack_days') {
    const days = 2 * item.there + item.stay;
    const each = `${item.there} days there, ${plural(item.stay, 'day')} staying and ${item.there} days home make ${days} days`;
    return item.crew === 1 ? `${packsNeeded(item)} packs: ${each}, one pack each day.`
      : `${packsNeeded(item)} packs: ${each}, and each of the ${item.crew} astronauts eats one pack a day: ${item.crew} times ${days}.`;
  }
  const r = item.routes[key], t = FAR_NAME[item.target];
  const swing = r.flybys.length
    ? `it swings past ${listOf(r.flybys.map(f => FLYBY_NAME[f]))}, and each flyby gives the ship a free push, so it needs less fuel than the other routes that arrive in time`
    : 'the route with more flybys would need less fuel, but it takes longer than the limit';
  return `${routeLabel(key)}: it gets to ${t} in ${plural(r.years, 'year')}, no more than ${item.limit}, and ${swing}.`;
}

// ── Assignment, spoken answers ───────────────────────────────────────────────────────────

const ORDINAL = ['first', 'second', 'third', 'fourth'];
const optionLabels = (item: MissionItem) => Array.from({ length: optionCount(item) }, (_, i) => optionLabel(item, i));

function keySays(item: MissionItem, at: number): string {
  if (item.mode === 'farther_closer') {
    const p = item.places[at], n = lower(PLACE_NAME[p]);
    return p === 'asteroids' ? `"${n}", "the asteroids", "the belt"` : `"${n}"${p === 'moon' ? ', "moon"' : ''}`;
  }
  if (item.mode === 'pick_window') {
    const m = item.windows[at].month.split(' ')[0];
    return `"${m}", "the ${m} one", "${item.windows[at].month}"`;
  }
  if (item.mode === 'pack_days') return `"${item.options[at]}", "${item.options[at]} packs"`;
  const l = ROUTE_LETTERS[at];
  return `"route ${l}", "${l}"`;
}

/** The answer a spoken reply is judged against, with the ways a learner says it. */
export function missionExpectedAnswer(item: MissionItem): string {
  const labels = optionLabels(item), at = keyOf(item);
  const others = labels.filter((_, i) => i !== at).map(l => `"${l}"`).join(', ');
  const place = item.mode === 'pack_days' ? '' : `, or its place in the row ("the ${ORDINAL[at]} one")`;
  return `"${labels[at]}" (choice ${at + 1} of ${labels.length}): ${keySays(item, at)}${place} count. `
    + `${others} ${labels.length > 2 ? 'are' : 'is'} wrong, and so is naming two or hedging between them.`;
}

const MISS_WORDS: Record<MissionMiss, string> = {
  other_end: 'names the place at the other end: the opposite of what was asked',
  next_in_line: 'names a place next in line to the right one, but not it',
  in_between: 'names a place in between',
  far_apart: 'names the month when the two planets are farthest apart',
  close_together: 'names the month when the two planets are closest together',
  in_between_window: 'names a month when the planets are neither closest nor farthest apart',
  forgot_home: 'gives the packs for the trip there and the stay, without the trip home',
  stay_twice: 'counts the days of the stay twice',
  forgot_stay: 'leaves out the days of the stay',
  forgot_crew: 'gives the packs for one astronaut, not the whole crew',
  added_crew: 'adds the number of astronauts instead of giving each one a pack every day',
  too_slow: 'names a route that takes longer than the limit',
  picked_direct: 'names the route with no flyby, which needs the most fuel',
  fewer_flybys: 'names a route in time with fewer flybys, which needs more fuel',
};

/** An item's known wrong spoken answers, most specific first, with the tap's miss ids. */
export function missionSpokenMisses(item: MissionItem): KnownMiss[] {
  const labels = optionLabels(item), at = keyOf(item);
  const groups = new Map<MissionMiss, string[]>();
  labels.forEach((l, i) => { if (i === at) return; const m = optionMiss(item, i)!; groups.set(m, [...(groups.get(m) ?? []), l]); });
  const out: KnownMiss[] = [];
  for (const m of MISSION_MISSES[item.mode]) {
    const xs = groups.get(m);
    if (!xs) continue;
    out.push({ id: m, pattern: `The right answer is "${labels[at]}". The learner's answer ${MISS_WORDS[m]}: ${xs.map(x => `"${x}"`).join(', ')}.`, examples: xs });
  }
  return out;
}

const HOW: Record<MissionMode, string> = {
  farther_closer: 'The learner answers by saying the place, or tapping it and pressing Check.',
  pick_window: 'The learner answers by saying the month, or tapping it and pressing Check.',
  pack_days: 'The learner answers by saying the number of packs, or tapping it and pressing Check.',
  assist_tradeoff: 'The learner answers by saying the route, or tapping it and pressing Check.',
};

/** Every item is a sayable closed choice: spoken (judged against `expectedAnswer`) or tapped and checked by code. */
export function workspaceAssignment(item: MissionItem): TeachingAssignment {
  const misses = missionSpokenMisses(item);
  return { id: item.id, task: `${askOf(item)} ${HOW[item.mode]}`, response: 'speech', acceptsGesture: true,
    expectedAnswer: missionExpectedAnswer(item), ...(misses.length ? { misses } : {}) };
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface MissionView {
  work: MissionWork;
  /** The answer has been credited (or revealed): the result is on screen. */
  solved: boolean;
}

/** A clock position for an angle round the Sun (0 = right of the Sun, counterclockwise), e.g. "3 o'clock". */
export function clockOf(deg: number): string {
  const h = Math.round(norm360(90 - deg) / 30) % 12;
  return `${h === 0 ? 12 : h} o'clock`;
}

export function describeMissionWork(item: MissionItem | undefined, w: MissionWork): string {
  if (!item || w.pick === null) return 'Nothing picked yet';
  const label = optionLabel(item, w.pick);
  if (item.mode === 'pick_window') return `Picked the ${label} launch`;
  return `Picked ${item.mode === 'farther_closer' || item.mode === 'assist_tradeoff' ? lower(label) : label}`;
}

const CONSTRAINTS = 'The learner answers by saying it, or by tapping and checking; the activity judges the tap. No distance, fuel '
  + 'amount, total or ranking is drawn before the answer. You cannot tap or check for the learner.';

/** What is drawn and asked. Never the key; results only after the answer. */
export function workspaceScene(item: MissionItem, view: MissionView): WorkspaceScene {
  const facts: Record<string, string> = { kind: item.mode, question: askOf(item) };
  if (item.mode === 'farther_closer') {
    facts.shown = `${item.places.length} places, each a picture of the same size with its name; no map and no distance is drawn. `
      + `In screen order: ${item.places.map(p => lower(PLACE_NAME[p])).join(', ')}.`;
    if (view.solved) facts.credited = 'A strip now shows each place at its distance from Earth.';
  } else if (item.mode === 'pick_window') {
    facts.shown = `${item.windows.length} launch months. Each shows the Sun in the middle, Earth's orbit and ${TARGET_NAME[item.target]}'s orbit `
      + `(not to scale), and where both planets are that month. No path, distance or fuel is drawn.`;
    item.windows.forEach((w, k) => { facts[`window_${k + 1}`] = `${w.month}: Earth at ${clockOf(w.earth)}, ${TARGET_NAME[item.target]} at ${clockOf(w.planet)} round the Sun.`; });
    if (view.solved) facts.credited = 'The ship\'s path is now drawn on the answer month.';
  } else if (item.mode === 'pack_days') {
    facts.shown = `A trip line: Earth, then ${plural(item.there, 'day square')} for the trip there, the Moon with ${plural(item.stay, 'day square')} for `
      + `the stay, then an arrow back to Earth marked "home the same way", with no squares on it.${item.crew > 1 ? ` ${item.crew} astronauts are drawn.` : ' One astronaut is drawn.'}`;
    facts.choices = item.options.map((v, i) => `${i + 1}) ${v} packs`).join('  ');
  } else {
    facts.shown = `${item.routes.length} routes from Earth to ${FAR_NAME[item.target]}, each a picture of its path; every planet the ship swings past `
      + `is marked on the path, and each route shows its trip time in years. Fuel is not drawn.`;
    item.routes.forEach((r, k) => {
      facts[`route_${ROUTE_LETTERS[k]}`] = `${routeLabel(k)}: ${r.flybys.length ? `swings past ${listOf(r.flybys.map(f => FLYBY_NAME[f]))}` : 'flies straight there, past no planet'}; ${plural(r.years, 'year')}.`;
    });
  }
  facts.learnerWork = describeMissionWork(item, view.work);
  facts.constraints = CONSTRAINTS;
  return { objects: [], facts };
}

// ── The journey's learner (liveJourneySpec row, the dry sweep) ───────────────────────────

/** The journey's answers: the key, and the wrong answer showing the mode's first-listed miss it can. */
export function missionHarnessAnswers(item: MissionItem): { correct: MissionWork; plainWrong: MissionWork } {
  const order = MISSION_MISSES[item.mode], key = keyOf(item);
  const wrongs = Array.from({ length: optionCount(item) }, (_, i) => i).filter(i => i !== key)
    .sort((a, b) => order.indexOf(optionMiss(item, a)!) - order.indexOf(optionMiss(item, b)!));
  return { correct: { pick: key }, plainWrong: { pick: wrongs[0] } };
}

// ── K-1 story (ungraded) ─────────────────────────────────────────────────────────────────

export type StoryPlace = 'moon' | 'mars' | 'jupiter';
export const STORY_PLACES: StoryPlace[] = ['moon', 'mars', 'jupiter'];
/** How long the trip feels, in words a five-year-old knows; no numbers (K-1 rule). */
export const STORY_TRIP: Record<StoryPlace, string> = {
  moon: 'The Moon is our closest neighbour. The trip takes just a few sleeps.',
  mars: 'Mars is much farther. The trip takes many, many months: longer than a whole school year.',
  jupiter: 'Jupiter is very, very far away. The trip takes years and years.',
};
/** The places the story offers: K the Moon and Mars, Grade 1 adds Jupiter. */
export const storyPlaces = (grade?: string): StoryPlace[] => ((gradeRung(grade) ?? 0) >= 1 ? STORY_PLACES : ['moon', 'mars']);
