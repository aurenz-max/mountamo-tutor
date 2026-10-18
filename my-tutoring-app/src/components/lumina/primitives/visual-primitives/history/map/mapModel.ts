/**
 * map-explorer's model. Pure: code owns every direction, every ask and every verdict.
 *
 * Two scales share one language (north, south, east, west):
 * - the WORLD (a globe): continents and oceans; relations come from the curated table in mapGeo.
 * - a CITY: real places (Google Maps) at their true coordinates on a real street map. A direction is the true
 *   compass bearing between two places. An ask is made only when it is clean: the answer lies within a narrow
 *   cone of the named direction and no other place lies anywhere near that way, so the key is computed from what
 *   is drawn and a child cannot reasonably pick a second "right" place.
 *
 * The map can be turned (`rotation`: the map's bearing, degrees clockwise). The compass rose turns with it, so
 * "up" is north only when the rose says so.
 */
import {
  DIRECTIONS, OPPOSITE, REGION_NAME, WORLD_RELATIONS, isContinent, isOcean, regionTitle,
  type ContinentId, type Direction, type RegionId, type WaterId,
} from './mapGeo';

export type { Direction } from './mapGeo';

export const MAP_TASKS = ['find_by_direction', 'name_direction', 'build_route', 'find_on_globe', 'world_direction'] as const;
export type MapTask = typeof MAP_TASKS[number];
export const TOWN_TASKS: readonly MapTask[] = ['find_by_direction', 'name_direction', 'build_route'];
export const isTownTask = (t: MapTask) => TOWN_TASKS.includes(t);

export type Rotation = 0 | 90 | 180 | 270;
export type MapDifficulty = 'easy' | 'medium' | 'hard';

// ── Places ─────────────────────────────────────────────────────────────────────────────────────────
export const PLACE_KINDS = ['school', 'park', 'library', 'museum', 'aquarium', 'zoo', 'playground', 'fire_station',
  'police_station', 'hospital', 'store', 'market', 'bakery', 'post_office', 'train_station', 'stadium', 'pond',
  'landmark', 'monument', 'home', 'restaurant'] as const;
export type PlaceKind = typeof PLACE_KINDS[number];

export const PLACE_EMOJI: Record<PlaceKind, string> = {
  school: '🏫', park: '🌳', library: '📚', museum: '🏛️', aquarium: '🐠', zoo: '🦁', playground: '🛝',
  fire_station: '🚒', police_station: '🚓', hospital: '🏥', store: '🛒', market: '🍎', bakery: '🥐',
  post_office: '📮', train_station: '🚉', stadium: '🏟️', pond: '🦆', landmark: '⭐', monument: '🗽', home: '🏠',
  restaurant: '🍕',
};

export interface MapPlace {
  id: string;
  /** The label on the map and in the asks (short, kid-readable). */
  name: string;
  /** The real place's full name, when the label is shorter. */
  fullName?: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  /** One short kid-friendly line about the place, shown once it is found. */
  blurb?: string;
  /** The Google Maps page for the place. */
  mapsUri?: string;
}

export interface TownMap {
  /** "Downtown Boston". */
  name: string;
  /** "Boston, Massachusetts". */
  city: string;
  source: 'google_maps' | 'curated';
  center: { lat: number; lng: number };
  places: MapPlace[];
}

export interface MapChallenge {
  id: string;
  type: MapTask;
  /** The ask, written by code. */
  instruction: string;
  /** The map's bearing when the ask opens (degrees clockwise; 0 = north up). World asks: 0. */
  rotation: Rotation;
  /** The place or continent the ask starts from (the reference place, the trip's start). */
  fromId?: string;
  /** The place or region to find, or the trip's end. Never shown, never sent to the tutor. */
  targetId?: string;
  /** find_by_direction / world_direction: the direction the ask names. name_direction: the ANSWER (never sent). */
  direction?: Direction;
  /** build_route: how far one hop flies, in metres. */
  hopMeters?: number;
  /** Easy: the compass rose glows. */
  compassGlow?: boolean;
}

// ── True directions between places ─────────────────────────────────────────────────────────────────
const DIR_ANGLE: Record<Direction, number> = { north: 0, east: 90, south: 180, west: 270 };

/** Metres east and north from a to b (local flat approximation; exact enough within a few kilometres). */
export function offsetMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): { east: number; north: number } {
  const k = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return { east: (b.lng - a.lng) * 111320 * k, north: (b.lat - a.lat) * 110540 };
}

/** Compass bearing from a to b, degrees clockwise from north (0-360). */
export function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const { east, north } = offsetMeters(a, b);
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

/** How far a bearing is from a direction, 0-180 degrees. */
export const offAxis = (deg: number, dir: Direction) => Math.abs(((deg - DIR_ANGLE[dir] + 540) % 360) - 180);

/** The direction a bearing lies in (nearest of the four). */
export const quadrant = (deg: number): Direction => DIRECTIONS[Math.round((((deg % 360) + 360) % 360) / 90) % 4];

/** A clean direction: within `cone` degrees of one of the four, else null (a diagonal is never asked). */
export function cleanDirection(a: { lat: number; lng: number }, b: { lat: number; lng: number }, cone = 25): Direction | null {
  const deg = bearing(a, b);
  return DIRECTIONS.find(d => offAxis(deg, d) <= cone) ?? null;
}

export const placeById = (map: TownMap | undefined, id: string | undefined) => map?.places.find(p => p.id === id);

// ── Relations a question can ask ───────────────────────────────────────────────────────────────────
export interface PlaceRelation { from: MapPlace; dir: Direction; to: MapPlace }

/** "What is <dir> of <from>?": one place within 25° of the direction, and every other place nearer another direction. */
export function uniqueRelations(map: TownMap): PlaceRelation[] {
  const out: PlaceRelation[] = [];
  for (const from of map.places) for (const dir of DIRECTIONS) {
    const near = map.places.filter(p => p.id !== from.id && offAxis(bearing(from, p), dir) <= 45);
    if (near.length === 1 && offAxis(bearing(from, near[0]), dir) <= 25) out.push({ from, dir, to: near[0] });
  }
  return out;
}

/** "Which way is <to> from <from>?": pairs whose bearing is within 22° of one direction. */
export function namedPairs(map: TownMap): PlaceRelation[] {
  const out: PlaceRelation[] = [];
  for (const from of map.places) for (const to of map.places) {
    if (from.id === to.id) continue;
    const dir = cleanDirection(from, to, 22);
    if (dir) out.push({ from, dir, to });
  }
  return out;
}

/** Trip ends that need a turn: both the east-west and the north-south legs at least a fifth of the longer one. */
export function routePairs(map: TownMap): { from: MapPlace; to: MapPlace }[] {
  const out: { from: MapPlace; to: MapPlace }[] = [];
  for (const from of map.places) for (const to of map.places) {
    if (from.id === to.id) continue;
    const { east, north } = offsetMeters(from, to);
    const long = Math.max(Math.abs(east), Math.abs(north)), short = Math.min(Math.abs(east), Math.abs(north));
    if (long > 150 && short >= long / 5) out.push({ from, to });
  }
  return out;
}

/** One hop for a trip: the longer leg is three hops, so the trip is 4-6 hops and has one whole-hop answer. */
export function hopFor(from: MapPlace, to: MapPlace): number {
  const { east, north } = offsetMeters(from, to);
  return Math.round(Math.max(Math.abs(east), Math.abs(north)) / 3);
}

// ── Building a session ─────────────────────────────────────────────────────────────────────────────
/** Hard: the map opens turned, so up is not north. */
export function rotationsFor(difficulty: MapDifficulty, count: number): Rotation[] {
  if (difficulty !== 'hard') return Array.from({ length: count }, () => 0 as Rotation);
  const turns: Rotation[] = [90, 180, 270];
  return Array.from({ length: count }, (_, i) => turns[i % 3]);
}

const pairKey = (r: { from: MapPlace; to: MapPlace }) => [r.from.id, r.to.id].sort().join('|');

/** The four directions in turn, never the same two places twice (either order), no answer twice until forced. */
export function pickByDirection(pool: PlaceRelation[], count: number, rng: () => number = Math.random): PlaceRelation[] {
  const picked: PlaceRelation[] = [];
  const pairs = new Set<string>(), answers = new Set<string>();
  const order = shuffle([...DIRECTIONS], rng);
  for (const strict of [true, false]) {
    let stalled = 0;
    for (let i = 0; picked.length < count && stalled < 4; i++) {
      const dir = order[i % 4];
      const options = shuffle(pool.filter(r => r.dir === dir && !pairs.has(pairKey(r)) && (!strict || !answers.has(r.to.id))), rng);
      if (!options.length) { stalled++; continue; }
      stalled = 0;
      picked.push(options[0]); pairs.add(pairKey(options[0])); answers.add(options[0].to.id);
    }
  }
  return picked;
}

export function buildTownChallenges(map: TownMap, task: MapTask, count: number, difficulty: MapDifficulty,
  rng: () => number = Math.random): MapChallenge[] {
  const rot = rotationsFor(difficulty, count);
  const glow = difficulty === 'easy';
  const base = (i: number) => ({ id: `map-${i + 1}`, type: task, rotation: rot[i], ...(glow ? { compassGlow: true } : {}) });
  if (task === 'find_by_direction' || task === 'name_direction') {
    const picks = pickByDirection(task === 'find_by_direction' ? uniqueRelations(map) : namedPairs(map), count, rng);
    return picks.map((r, i) => ({ ...base(i), fromId: r.from.id, targetId: r.to.id, direction: r.dir,
      instruction: task === 'find_by_direction'
        ? `What is ${r.dir} of ${r.from.name}? Tap it on the map.`
        : `Which way is ${r.to.name} from ${r.from.name}? Tap the compass.` }));
  }
  if (task === 'build_route') {
    const picked: { from: MapPlace; to: MapPlace }[] = [];
    const used = new Set<string>();
    for (const r of shuffle(routePairs(map), rng)) {
      if (picked.length >= count) break;
      if (used.has(pairKey(r)) || picked.some(p => p.to.id === r.to.id || p.from.id === r.from.id)) continue;
      picked.push(r); used.add(pairKey(r));
    }
    for (const r of shuffle(routePairs(map), rng)) {
      if (picked.length >= count) break;
      if (!used.has(pairKey(r))) { picked.push(r); used.add(pairKey(r)); }
    }
    return picked.map((r, i) => ({ ...base(i), fromId: r.from.id, targetId: r.to.id, hopMeters: hopFor(r.from, r.to),
      instruction: `Fly the helicopter from ${r.from.name} to ${r.to.name}. Use the arrows to plan the trip, then press Land.` }));
  }
  throw new Error(`${task} is not a town task`);
}

/** How many different asks a map supports for a task (the generator rejects a map that cannot fill a session). */
export function townCapacity(map: TownMap, task: MapTask): number {
  if (task === 'find_by_direction') return new Set(uniqueRelations(map).map(pairKey)).size;
  if (task === 'name_direction') return new Set(namedPairs(map).map(pairKey)).size;
  if (task === 'build_route') return new Set(routePairs(map).map(pairKey)).size;
  return 0;
}

const FIND_ORDER: RegionId[] = ['africa', 'north_america', 'south_america', 'asia', 'europe', 'australia', 'antarctica',
  'pacific', 'atlantic', 'indian', 'arctic', 'southern'];

export function buildWorldChallenges(task: MapTask, count: number, difficulty: MapDifficulty,
  rng: () => number = Math.random): MapChallenge[] {
  if (task === 'find_on_globe') {
    // Easy: continents only. Medium: continents, then one ocean. Hard: continents and oceans mixed.
    const continents = shuffle(FIND_ORDER.filter(isContinent), rng), oceans = shuffle(FIND_ORDER.filter(isOcean), rng);
    const pool = difficulty === 'easy' ? continents
      : difficulty === 'medium' ? [...continents.slice(0, count - 1), oceans[0]]
        : shuffle([...continents.slice(0, Math.ceil(count / 2)), ...oceans.slice(0, Math.floor(count / 2))], rng);
    return pool.slice(0, count).map((id, i) => ({ id: `map-${i + 1}`, type: task, rotation: 0, targetId: id,
      instruction: `Find ${REGION_NAME[id]}. Spin the globe to look around, then tap it.` }));
  }
  if (task === 'world_direction') {
    const pool = difficulty === 'easy' ? WORLD_RELATIONS.filter(r => isContinent(r.to)) : [...WORLD_RELATIONS];
    const picked: (typeof pool)[number][] = [];
    for (const r of shuffle([...pool], rng)) { if (picked.length < count && !picked.some(p => p.to === r.to)) picked.push(r); }
    return picked.map((r, i) => ({ id: `map-${i + 1}`, type: task, rotation: 0, fromId: r.from, targetId: r.to,
      direction: r.dir,
      instruction: `Find the ${isContinent(r.to) ? 'continent' : 'ocean'} just ${r.dir} of ${REGION_NAME[r.from]}.` }));
  }
  throw new Error(`${task} is not a world task`);
}

/** Easiest first: the order a mixed or blended session runs its tasks in (the catalog's β order). */
export const TASK_ORDER: readonly MapTask[] = ['find_on_globe', 'find_by_direction', 'name_direction', 'world_direction', 'build_route'];

/**
 * A session over one or more tasks: `count` asks shared out across the tasks in turn, easiest task first, ids by
 * position. Town tasks share the one city map.
 */
export function buildSession(tasks: readonly MapTask[], map: TownMap | undefined, count: number, difficulty: MapDifficulty,
  rng: () => number = Math.random): MapChallenge[] {
  const ordered = TASK_ORDER.filter(t => tasks.includes(t));
  const per = new Map<MapTask, number>(ordered.map(t => [t, 0]));
  for (let i = 0; i < count; i++) per.set(ordered[i % ordered.length], per.get(ordered[i % ordered.length])! + 1);
  const out: MapChallenge[] = [];
  for (const t of ordered) {
    const n = per.get(t)!;
    if (!n) continue;
    out.push(...(isTownTask(t) ? (map ? buildTownChallenges(map, t, n, difficulty, rng) : []) : buildWorldChallenges(t, n, difficulty, rng)));
  }
  return out.map((c, i) => ({ ...c, id: `map-${i + 1}` }));
}

// ── The curated fallback city: the National Mall, laid out along the compass ────────────────────────
/** Used when Google Maps returns no usable city. */
export const NATIONAL_MALL: TownMap = {
  name: 'The National Mall', city: 'Washington, D.C.', source: 'curated', center: { lat: 38.8893, lng: -77.0290 },
  places: [
    { id: 'place-1', name: 'Washington Monument', kind: 'monument', lat: 38.8895, lng: -77.0353, blurb: 'A tall white tower you can ride an elevator up.' },
    { id: 'place-2', name: 'Lincoln Memorial', kind: 'monument', lat: 38.8893, lng: -77.0502, blurb: 'A giant statue of President Lincoln sits inside.' },
    { id: 'place-3', name: 'U.S. Capitol', kind: 'landmark', lat: 38.8899, lng: -77.0091, blurb: 'Lawmakers meet here under the big white dome.' },
    { id: 'place-4', name: 'White House', kind: 'landmark', lat: 38.8977, lng: -77.0365, blurb: 'The President lives and works here.' },
    { id: 'place-5', name: 'Jefferson Memorial', kind: 'monument', lat: 38.8814, lng: -77.0365, blurb: 'A round memorial beside the water.' },
    { id: 'place-6', name: 'Air and Space Museum', kind: 'museum', lat: 38.8882, lng: -77.0199, blurb: 'Real rockets and airplanes hang inside.' },
    { id: 'place-7', name: 'Natural History Museum', kind: 'museum', lat: 38.8913, lng: -77.0261, blurb: 'Dinosaur skeletons and a giant elephant!' },
  ],
};

// ── Checks, misses and the learner's work in words ─────────────────────────────────────────────────
/** A learner's answer: a tapped place or region (with the map's bearing at the tap), a compass arm, or hops. */
export type MapAnswer =
  | { kind: 'tap'; id: string; viewBearing?: number }
  | { kind: 'arm'; dir: Direction; viewBearing?: number }
  | { kind: 'route'; steps: Direction[] };

const STEP: Record<Direction, [east: number, north: number]> = { north: [0, 1], south: [0, -1], east: [1, 0], west: [-1, 0] };

export interface RouteFlight {
  /** Each hop's end, starting at the start. */
  points: { lat: number; lng: number }[];
  /** Hops flown east and north. */
  flown: { east: number; north: number };
  /** Hops the destination is east and north of the start. */
  wanted: { east: number; north: number };
}

export function flyRoute(map: TownMap, c: MapChallenge, steps: Direction[]): RouteFlight {
  const from = placeById(map, c.fromId)!, to = placeById(map, c.targetId)!, hop = c.hopMeters || 200;
  const k = Math.cos((from.lat * Math.PI) / 180);
  let e = 0, n = 0;
  const points = [{ lat: from.lat, lng: from.lng }];
  for (const s of steps) {
    e += STEP[s][0]; n += STEP[s][1];
    points.push({ lat: from.lat + (n * hop) / 110540, lng: from.lng + (e * hop) / (111320 * k) });
  }
  const want = offsetMeters(from, to);
  return { points, flown: { east: e, north: n }, wanted: { east: want.east / hop, north: want.north / hop } };
}

const near = (a: number, b: number) => Math.abs(a - b) <= 0.5;
/** Lands at the destination: within half a hop on both axes (the one whole-hop answer, in any order). */
export const routeArrives = (f: RouteFlight) => near(f.flown.east, f.wanted.east) && near(f.flown.north, f.wanted.north);

export function mapMatches(c: MapChallenge, map: TownMap | undefined, answer: MapAnswer): boolean {
  if (c.type === 'name_direction') return answer.kind === 'arm' && answer.dir === c.direction;
  if (c.type === 'build_route') return answer.kind === 'route' && !!map && answer.steps.length > 0 && routeArrives(flyRoute(map, c, answer.steps));
  return answer.kind === 'tap' && answer.id === c.targetId;
}

export const MAP_MISSES = ['screen_direction', 'opposite_way', 'turned_way', 'reference_place', 'other_place',
  'other_continent', 'water_not_land', 'land_not_water', 'other_ocean', 'sea_not_ocean',
  'route_mirrored', 'route_wrong_end'] as const;
export type MapMiss = typeof MAP_MISSES[number];

/** The map is turned far enough that up is no longer north. */
const turnedView = (b: number | undefined): b is number => b != null && offAxis(b, 'north') >= 45;

/** The named wrong answer, most specific first. Undefined for a right answer or one nothing names. */
export function mapMiss(c: MapChallenge, map: TownMap | undefined, answer: MapAnswer): MapMiss | undefined {
  if (mapMatches(c, map, answer)) return undefined;
  if (c.type === 'name_direction') {
    if (answer.kind !== 'arm' || !c.direction) return undefined;
    // Named by the screen (right = east): the arm whose usual place is where the target sits on screen.
    if (turnedView(answer.viewBearing) && answer.dir === quadrant(DIR_ANGLE[c.direction] - answer.viewBearing)) return 'screen_direction';
    return answer.dir === OPPOSITE[c.direction] ? 'opposite_way' : 'turned_way';
  }
  if (c.type === 'build_route') {
    if (answer.kind !== 'route' || !map) return undefined;
    const { flown: f, wanted: w } = flyRoute(map, c, answer.steps);
    const mirrored = (near(f.east, -w.east) && near(f.north, w.north)) || (near(f.east, w.east) && near(f.north, -w.north))
      || (near(f.east, -w.east) && near(f.north, -w.north));
    return mirrored ? 'route_mirrored' : 'route_wrong_end';
  }
  if (answer.kind !== 'tap') return undefined;
  if (c.type === 'find_by_direction') {
    const from = placeById(map, c.fromId), tapped = placeById(map, answer.id);
    if (!from || !tapped || !c.direction) return undefined;
    if (tapped.id === from.id) return 'reference_place';
    const actual = quadrant(bearing(from, tapped));
    // Read up as north: picked what sits in the named direction's place on the turned screen.
    if (turnedView(answer.viewBearing) && actual === quadrant(DIR_ANGLE[c.direction] + answer.viewBearing)) return 'screen_direction';
    if (actual === OPPOSITE[c.direction]) return 'opposite_way';
    if (actual !== c.direction) return 'turned_way';
    return 'other_place';
  }
  // The world: find_on_globe and world_direction.
  const target = c.targetId as RegionId | undefined, tapped = answer.id as RegionId | 'sea';
  if (!target) return undefined;
  if (c.type === 'world_direction' && c.fromId && tapped === c.fromId) return 'reference_place';
  if (c.type === 'world_direction' && c.fromId && c.direction && isContinent(c.fromId)) {
    const rel = WORLD_RELATIONS.find(r => r.from === c.fromId && r.to === tapped);
    if (rel?.dir === OPPOSITE[c.direction]) return 'opposite_way';
    if (rel) return 'turned_way';
  }
  if (isContinent(target)) return isContinent(tapped) ? 'other_continent' : 'water_not_land';
  if (tapped === 'sea') return 'sea_not_ocean';
  return isContinent(tapped) ? 'land_not_water' : 'other_ocean';
}

export function collapseSteps(steps: Direction[]): { dir: Direction; hops: number }[] {
  const out: { dir: Direction; hops: number }[] = [];
  for (const dir of steps) {
    const last = out[out.length - 1];
    if (last && last.dir === dir) last.hops++; else out.push({ dir, hops: 1 });
  }
  return out;
}
export const stepsInWords = (steps: Direction[]) =>
  collapseSteps(steps).map(s => `${s.hops} hop${s.hops === 1 ? '' : 's'} ${s.dir}`).join(', then ');

export function answerName(map: TownMap | undefined, id: string): string {
  if (id === 'sea') return 'a sea';
  if (isContinent(id) || isOcean(id)) return REGION_NAME[id as RegionId];
  return placeById(map, id)?.name ?? id;
}

/** The learner's work in words (never the key). */
export function describeMapAnswer(_c: MapChallenge, map: TownMap | undefined, answer: MapAnswer): string {
  if (answer.kind === 'arm') return `tapped the compass arm marked ${cap(answer.dir)}`;
  if (answer.kind === 'route') {
    if (!answer.steps.length) return 'pressed Land with no directions';
    return `planned the flight ${stepsInWords(answer.steps)}, then pressed Land`;
  }
  return `tapped ${answerName(map, answer.id)}`;
}

/** What the screen says after a check. A miss names what the learner chose and where it is, never the answer. */
export function checkFeedback(c: MapChallenge, map: TownMap | undefined, answer: MapAnswer): string {
  const correct = mapMatches(c, map, answer);
  if (c.type === 'name_direction' && answer.kind === 'arm') {
    const to = placeById(map, c.targetId), from = placeById(map, c.fromId);
    return correct ? `Yes! ${to?.name} is ${c.direction} of ${from?.name}.`
      : `That arm points ${answer.dir}. Look from ${from?.name} to ${to?.name}, then find the arm that points the same way.`;
  }
  if (c.type === 'build_route' && answer.kind === 'route') {
    const to = placeById(map, c.targetId);
    if (correct) return `You landed at ${to?.name}! ${cap(stepsInWords(answer.steps))}.`;
    return `The helicopter landed away from ${to?.name}. Check the compass and plan again.`;
  }
  if (answer.kind !== 'tap') return '';
  const name = answerName(map, answer.id);
  if (correct) {
    if (c.type === 'find_by_direction') return `Yes! ${name} is ${c.direction} of ${placeById(map, c.fromId)?.name}.`;
    if (c.type === 'world_direction') return `Yes! ${cap(name)} is just ${c.direction} of ${REGION_NAME[c.fromId as RegionId]}.`;
    return `Yes! That is ${name}.`;
  }
  if (c.type === 'find_by_direction') {
    const from = placeById(map, c.fromId), tapped = placeById(map, answer.id);
    if (from && tapped?.id === from.id) return `That is ${from.name} itself. Look ${c.direction} of it.`;
    const actual = from && tapped ? cleanDirection(from, tapped, 30) : null;
    return actual ? `That is ${name}. It is ${actual} of ${from!.name}. Use the compass to find ${c.direction}.`
      : `That is ${name}. Use the compass to find ${c.direction} of ${from?.name}.`;
  }
  if (c.type === 'world_direction') {
    if (answer.id === c.fromId) return `That is ${REGION_NAME[c.fromId as RegionId]} itself. Look ${c.direction} of it.`;
    const rel = WORLD_RELATIONS.find(r => r.from === c.fromId && r.to === answer.id);
    return rel ? `That is ${name}. It is ${rel.dir} of ${REGION_NAME[c.fromId as RegionId]}. Use the compass to find ${c.direction}.`
      : `That is ${name}. Use the compass to find ${c.direction} of ${REGION_NAME[c.fromId as RegionId]}.`;
  }
  const t = c.targetId as RegionId;
  if (answer.id === 'sea') return 'That water is a sea, not an ocean. Oceans are the biggest waters. Keep looking.';
  if (isContinent(t) && !isContinent(answer.id)) return `That is ${name}, an ocean. ${regionTitle(t)} is land. Keep looking.`;
  if (isOcean(t) && isContinent(answer.id)) return `That is ${name}, land. ${regionTitle(t)} is water. Keep looking.`;
  return `That is ${name}. Keep looking.`;
}

export type { ContinentId, RegionId, WaterId };

// ── Small helpers ──────────────────────────────────────────────────────────────────────────────────
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
