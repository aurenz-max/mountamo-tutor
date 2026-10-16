/**
 * race-track-lab on the shared tutor/JEV teaching workspace (W1, plain shape; ROLLOUT C28).
 *
 * Every item is built and keyed by code: two or three toy cars named by colour (no animal or vehicle whose usual speed
 * hints the answer), each with a whole-number speed in squares per second and a starting square. The key is computed
 * from those numbers. Each mode is one closed choice the learner taps and checks, or says (J14):
 * - observe: the learner runs a timed race that a bell stops before any car finishes; which car is the fastest? Same
 *   time, so the car that moved the most squares. Hard items give one slower car a head start.
 * - predict: a card per car gives its speed; which car will cross the finish line first? The race runs only after
 *   the answer is credited. Medium gives the distance in a few seconds; hard gives one slower car a head start.
 * - measure: the learner runs a timed race, then counts squares: how far one car moved (hard: from a head start), or
 *   how much farther one car moved than another (medium).
 * - calculate: a race log gives where a car started, where it stopped and the seconds; the learner computes its speed.
 *   Medium starts the car past square 0; hard gives two cars different times and asks the faster car's speed, where
 *   the slower car moved farther.
 * - graph: a position-time graph; which car is fastest (steepest line)? Medium gives one slower car a head start, so
 *   its line ends highest; hard asks a car's speed from a line that does not start at 0.
 * Difficulty (`config.difficulty`) is structural (head starts, more cars, two steps), never bigger numbers.
 *
 * Pure: the component, the generator, the adapter, the journey row and the tests read the same items, checks, misses
 * and scene.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';

export type RaceMode = 'observe' | 'predict' | 'measure' | 'calculate' | 'graph';
export const RACE_MODES: RaceMode[] = ['observe', 'predict', 'measure', 'calculate', 'graph'];
export type RaceTier = 'easy' | 'medium' | 'hard';
export type RaceAsk = 'fastest' | 'winner' | 'distance' | 'farther_by' | 'speed' | 'faster_speed';

export interface RaceCar { name: string; color: string; speed: number; start: number; /** Own run time (calculate hard). */ time?: number }

export interface RaceItem {
  id: string;
  mode: RaceMode;
  ask: RaceAsk;
  /** In lane order, top lane first; the choices list them in this order. */
  racers: RaceCar[];
  trackLength: number;
  /** Seconds a timed run lasts before the bell; 0 for predict (a race to the finish line). */
  time: number;
  /** predict: each card gives the squares per second, or the squares moved in `window` seconds. */
  given?: 'per_second' | 'in_time';
  window?: number;
  /** The car asked about (lane index); farther_by asks `target` minus `other`. */
  target?: number;
  other?: number;
}

export const CARS: ReadonlyArray<{ name: string; color: string }> = [
  { name: 'Red car', color: '#EF4444' }, { name: 'Blue car', color: '#3B82F6' }, { name: 'Green car', color: '#22C55E' },
  { name: 'Yellow car', color: '#EAB308' }, { name: 'Purple car', color: '#A855F7' }, { name: 'Orange car', color: '#F97316' },
];

// ── Motion ────────────────────────────────────────────────────────────────────────────────

export const runTime = (item: Pick<RaceItem, 'time'>, r: RaceCar) => r.time ?? item.time;
export const movedOf = (item: Pick<RaceItem, 'time'>, r: RaceCar) => r.speed * runTime(item, r);
export const endOf = (item: Pick<RaceItem, 'time'>, r: RaceCar) => r.start + movedOf(item, r);
export const finishTime = (item: Pick<RaceItem, 'trackLength'>, r: RaceCar) => (item.trackLength - r.start) / r.speed;
/** Where a car is after t seconds of the run (it stops at its own run time, or at the finish line). */
export function positionAt(item: Pick<RaceItem, 'time' | 'trackLength' | 'mode'>, r: RaceCar, t: number): number {
  const until = item.mode === 'predict' ? finishTime(item as RaceItem, r) : runTime(item, r);
  return Math.min(item.trackLength, r.start + r.speed * Math.min(t, until));
}

const argBy = (xs: number[], better: (a: number, b: number) => boolean) => xs.reduce((best, x, i) => (better(x, xs[best]) ? i : best), 0);
export const fastestIndex = (item: RaceItem) => argBy(item.racers.map(r => r.speed), (a, b) => a > b);
export const winnerIndex = (item: RaceItem) => argBy(item.racers.map(r => finishTime(item, r)), (a, b) => a < b);
/** The car farthest along when the run stops (the line that ends highest on a graph). */
export const frontIndex = (item: RaceItem) => argBy(item.racers.map(r => endOf(item, r)), (a, b) => a > b);
const headStartIndex = (item: RaceItem) => {
  const i = argBy(item.racers.map(r => r.start), (a, b) => a > b);
  return item.racers[i].start > 0 ? i : -1;
};
export const hasHeadStart = (item: RaceItem) => item.racers.some(r => r.start > 0);

// ── Choices, keys, misses ─────────────────────────────────────────────────────────────────

export type ObserveMiss = 'ahead_not_fastest' | 'slower_racer';
export type PredictMiss = 'fastest_not_winner' | 'head_start_not_winner' | 'slower_racer';
export type MeasureMiss = 'read_position' | 'farther_total' | 'other_racer' | 'off_by_one' | 'shorter_total' | 'added' | 'time_as_distance';
export type CalculateMiss = 'ignored_start' | 'farther_racer' | 'distance_as_speed' | 'multiplied';
export type GraphMiss = 'highest_line' | 'ignored_start' | 'read_position' | 'distance_as_speed' | 'slower_racer';
export type RaceTrackMiss = ObserveMiss | PredictMiss | MeasureMiss | CalculateMiss | GraphMiss;
/** Most telling first: the journey's wrong answer is the first one an item can show. */
export const RACE_MISSES: Record<RaceMode, readonly RaceTrackMiss[]> = {
  observe: ['ahead_not_fastest', 'slower_racer'],
  predict: ['fastest_not_winner', 'head_start_not_winner', 'slower_racer'],
  measure: ['read_position', 'farther_total', 'other_racer', 'off_by_one', 'shorter_total', 'added', 'time_as_distance'],
  calculate: ['ignored_start', 'farther_racer', 'distance_as_speed', 'multiplied'],
  graph: ['highest_line', 'ignored_start', 'read_position', 'distance_as_speed', 'slower_racer'],
};

export interface RaceChoice { label: string; value: number; kind: 'key' | RaceTrackMiss }

export const isNameAsk = (ask: RaceAsk) => ask === 'fastest' || ask === 'winner';
const round2 = (x: number) => Math.round(x * 100) / 100;
const clean = (x: number) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6;
export const fmtNum = (x: number) => String(round2(x));
const isSpeedAsk = (ask: RaceAsk) => ask === 'speed' || ask === 'faster_speed';
/** A number as a choice: "8 squares", "1 square", "4 squares per second". */
export const numberLabel = (ask: RaceAsk, x: number) =>
  `${fmtNum(x)} ${x === 1 ? 'square' : 'squares'}${isSpeedAsk(ask) ? ' per second' : ''}`;

/** Every choice of a numeric item, ascending; null when two coincide, one is not positive, or one is not exact. */
export function numericChoices(item: RaceItem): RaceChoice[] | null {
  if (isNameAsk(item.ask)) return null;
  const t = item.racers[item.target ?? 0];
  if (!t) return null;
  const d = movedOf(item, t), T = runTime(item, t), end = endOf(item, t);
  const raw: Array<[number, RaceChoice['kind']]> = [];
  if (item.ask === 'distance') {
    const o = item.racers.find((_, i) => i !== (item.target ?? 0));
    raw.push([d, 'key']);
    if (t.start > 0) raw.push([end, 'read_position']);
    if (o) raw.push([movedOf(item, o), 'other_racer']);
    raw.push([d + 1, 'off_by_one']);
    if (t.start === 0) raw.push([item.time, 'time_as_distance']);
  } else if (item.ask === 'farther_by') {
    const o = item.racers[item.other ?? -1];
    if (!o) return null;
    raw.push([d - movedOf(item, o), 'key'], [d, 'farther_total'], [movedOf(item, o), 'shorter_total'], [d + movedOf(item, o), 'added']);
  } else if (item.ask === 'speed') {
    raw.push([t.speed, 'key']);
    if (item.mode === 'graph') {
      if (t.start > 0) raw.push([end / T, 'ignored_start']);
      raw.push([end, 'read_position'], [d, 'distance_as_speed']);
    } else {
      if (t.start > 0) raw.push([end / T, 'ignored_start']);
      raw.push([d, 'distance_as_speed'], [d * T, 'multiplied']);
    }
  } else {
    const f = item.racers[fastestIndex(item)], s = item.racers.find(r => r !== f);
    if (!s) return null;
    raw.push([f.speed, 'key'], [s.speed, 'farther_racer'], [movedOf(item, f), 'distance_as_speed'], [movedOf(item, f) * runTime(item, f), 'multiplied']);
  }
  const out = raw.map(([value, kind]) => ({ value, kind, label: numberLabel(item.ask, value) }));
  if (out.some(c => !Number.isFinite(c.value) || c.value <= 0 || !clean(c.value))) return null;
  if (new Set(out.map(c => c.label)).size !== out.length) return null;
  return out.sort((a, b) => a.value - b.value);
}

export function choicesOf(item: RaceItem): string[] {
  return isNameAsk(item.ask) ? item.racers.map(r => r.name) : (numericChoices(item) ?? []).map(c => c.label);
}

export function keyChoice(item: RaceItem): string {
  if (item.ask === 'fastest') return item.racers[fastestIndex(item)].name;
  if (item.ask === 'winner') return item.racers[winnerIndex(item)].name;
  return numericChoices(item)!.find(c => c.kind === 'key')!.label;
}
export const raceCorrect = (item: RaceItem | undefined, choice: string | null) => !!item && choice !== null && choice === keyChoice(item);

export function raceMiss(item: RaceItem | undefined, choice: string | null): RaceTrackMiss | undefined {
  if (!item || choice === null || raceCorrect(item, choice) || !choicesOf(item).includes(choice)) return undefined;
  if (isNameAsk(item.ask)) {
    const c = item.racers.findIndex(r => r.name === choice);
    if (item.ask === 'fastest') {
      if (c === frontIndex(item) && frontIndex(item) !== fastestIndex(item)) return item.mode === 'graph' ? 'highest_line' : 'ahead_not_fastest';
      return 'slower_racer';
    }
    if (c === fastestIndex(item)) return 'fastest_not_winner';
    if (c === headStartIndex(item)) return 'head_start_not_winner';
    return 'slower_racer';
  }
  return numericChoices(item)!.find(c => c.label === choice)!.kind as RaceTrackMiss;
}

// ── The ask ───────────────────────────────────────────────────────────────────────────────

const squares = (n: number) => `${fmtNum(n)} ${n === 1 ? 'square' : 'squares'}`;
const seconds = (n: number) => `${fmtNum(n)} ${n === 1 ? 'second' : 'seconds'}`;
const listOf = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** What a predict card says about one car. */
export function cardText(item: RaceItem, r: RaceCar): string {
  const how = item.given === 'in_time' ? `goes ${squares(r.speed * (item.window ?? 1))} in ${seconds(item.window ?? 1)}`
    : `goes ${squares(r.speed)} each second`;
  return `${r.name} ${how}, starting at square ${r.start}`;
}

/** One row of the calculate race log, in words. */
export const logText = (item: RaceItem, r: RaceCar) =>
  `${r.name} started at square ${r.start} and stopped at square ${fmtNum(endOf(item, r))} after ${seconds(runTime(item, r))}`;

export function askOf(item: RaceItem): string {
  const target = item.racers[item.target ?? 0];
  const timed = `The cars race for ${seconds(item.time)}, then a bell stops them.`;
  const headStart = hasHeadStart(item) ? ' Not every car starts on square 0.' : '';
  switch (item.ask) {
    case 'fastest':
      return item.mode === 'graph'
        ? 'The graph shows where each car was at every second of the race. Which car is the fastest?'
        : `${timed}${headStart} Run the race and watch. Which car is the fastest?`;
    case 'winner':
      return `The cars race to the finish line at square ${item.trackLength}. ${listOf(item.racers.map(r => cardText(item, r)))}. `
        + 'Which car will cross the finish line first?';
    case 'distance':
      return `${timed}${headStart} Run the race, then count: how many squares did ${target.name} move?`;
    case 'farther_by':
      return `${timed} Run the race, then count: how many more squares did ${target.name} move than ${item.racers[item.other ?? 0].name}?`;
    case 'speed':
      return item.mode === 'graph'
        ? `The graph shows where each car was at every second of the race. What is ${target.name}'s speed?`
        : `${logText(item, target)}. What is ${target.name}'s speed?`;
    case 'faster_speed':
      return `${listOf(item.racers.map(r => `${r.name} ran for ${seconds(runTime(item, r))} and moved ${squares(movedOf(item, r))}`))}. `
        + 'What is the faster car\'s speed?';
  }
}

/** Whether the learner must run the race before answering (the stimulus is pending until then). */
export const needsRun = (item: Pick<RaceItem, 'mode'>) => item.mode === 'observe' || item.mode === 'measure';

// ── Item space ────────────────────────────────────────────────────────────────────────────

export type Rng = () => number;
/** A seeded generator, so a lesson without stored items still builds the same items everywhere. */
export function seededRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
function shuffle<T>(xs: readonly T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const distinctInts = (n: number, lo: number, hi: number, rng: Rng) => shuffle(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), rng).slice(0, n);
const gapOfTopTwo = (speeds: number[]) => { const s = [...speeds].sort((a, b) => b - a); return s[0] - s[1]; };
const distinct = (xs: number[]) => new Set(xs).size === xs.length;

/** Cars in lane order with the given speeds and starts; colours drawn at random, never chosen by speed. */
function cars(speeds: number[], starts: number[], rng: Rng, exclude: readonly string[] = [], times?: number[]): RaceCar[] {
  const picked = shuffle(CARS.filter(c => !exclude.includes(c.name)), rng).slice(0, speeds.length);
  return picked.map((c, i) => ({ ...c, speed: speeds[i], start: starts[i], ...(times ? { time: times[i] } : {}) }));
}

/** Variant of a head-start item: the slower car with the head start ends in front / wins, or does not. */
type Variant = 'head_ahead' | 'head_behind' | 'any';

/** One candidate of a mode at a tier, or null when the draw broke a rule. */
function draw(mode: RaceMode, tier: RaceTier, rng: Rng, variant: Variant, exclude: readonly string[] = []): RaceItem | null {
  const base = { id: '', mode };
  if (mode === 'observe' || (mode === 'graph' && tier !== 'hard')) {
    const L = mode === 'observe' ? 12 : 20, T = mode === 'observe' ? 2 : 4;
    const n = tier === 'easy' ? 2 : tier === 'medium' && mode === 'observe' ? 3 : int(rng, 2, 3);
    const speeds = distinctInts(n, 1, mode === 'observe' ? (tier === 'hard' ? 4 : 5) : 4, rng);
    if (tier === 'easy' && gapOfTopTwo(speeds) < 2) return null;
    if (mode === 'observe' && tier === 'medium' && gapOfTopTwo(speeds) !== 1) return null;
    const starts = speeds.map(() => 0);
    const headStart = (mode === 'observe' && tier === 'hard') || (mode === 'graph' && tier === 'medium');
    if (headStart) {
      const f = argBy(speeds, (a, b) => a > b);
      const h = shuffle(speeds.map((_, i) => i).filter(i => i !== f), rng)[0];
      starts[h] = int(rng, 2, Math.max(2, L - 1 - speeds[h] * T));
    }
    const item: RaceItem = { ...base, ask: 'fastest', racers: cars(speeds, starts, rng, exclude), trackLength: L, time: T };
    const ends = item.racers.map(r => endOf(item, r));
    if (ends.some(e => e > L - 1) || !distinct(ends)) return null;
    if (headStart) {
      const ahead = frontIndex(item) !== fastestIndex(item);
      if ((variant === 'head_ahead' && !ahead) || (variant === 'head_behind' && ahead)) return null;
    }
    return item;
  }
  if (mode === 'predict') {
    const L = 12, n = tier === 'medium' ? 3 : tier === 'easy' ? 2 : int(rng, 2, 3);
    const speeds = distinctInts(n, 1, 4, rng);
    if (tier === 'easy' && gapOfTopTwo(speeds) < 2) return null;
    const starts = speeds.map(() => 0);
    if (tier === 'hard') {
      const f = argBy(speeds, (a, b) => a > b);
      const h = shuffle(speeds.map((_, i) => i).filter(i => i !== f), rng)[0];
      starts[h] = int(rng, 2, L - 2);
    }
    const window = tier === 'medium' ? int(rng, 2, 3) : undefined;
    const item: RaceItem = { ...base, ask: 'winner', racers: cars(speeds, starts, rng, exclude), trackLength: L, time: 0,
      given: tier === 'medium' ? 'in_time' : 'per_second', ...(window ? { window } : {}) };
    if (window && item.racers.some(r => r.speed * window > L)) return null;
    const times = item.racers.map(r => finishTime(item, r)).sort((a, b) => a - b);
    if (times[1] - times[0] < 1) return null;
    if (tier === 'hard') {
      const headWins = winnerIndex(item) !== fastestIndex(item);
      if ((variant === 'head_ahead' && !headWins) || (variant === 'head_behind' && headWins)) return null;
    }
    return item;
  }
  if (mode === 'measure') {
    const L = 16, T = int(rng, 2, 4);
    const speeds = distinctInts(2, 1, 4, rng);
    const starts = [0, 0];
    const target = int(rng, 0, 1);
    if (tier === 'hard') starts[target] = int(rng, 2, 6);
    const item: RaceItem = { ...base, ask: tier === 'medium' ? 'farther_by' : 'distance', racers: cars(speeds, starts, rng, exclude),
      trackLength: L, time: T, target };
    if (tier === 'medium') {
      item.target = argBy(item.racers.map(r => movedOf(item, r)), (a, b) => a > b);
      item.other = 1 - item.target;
    }
    if (item.racers.some(r => endOf(item, r) > L - 1)) return null;
    return numericChoices(item) ? item : null;
  }
  if (mode === 'calculate') {
    const L = 20;
    if (tier === 'hard') {
      const [sf, ss] = distinctInts(2, 1, 6, rng).sort((a, b) => b - a);
      const tf = int(rng, 2, 4), ts = int(rng, tf + 1, 5);
      if (ss * ts <= sf * tf || ss * ts > L || sf * tf > L) return null;
      const order = rng() < 0.5;
      const item: RaceItem = { ...base, ask: 'faster_speed', trackLength: L, time: 0,
        racers: cars(order ? [sf, ss] : [ss, sf], [0, 0], rng, exclude, order ? [tf, ts] : [ts, tf]) };
      return numericChoices(item) ? item : null;
    }
    const s = int(rng, 2, tier === 'easy' ? 6 : 5), T = int(rng, 2, tier === 'easy' ? 5 : 4);
    const start = tier === 'medium' ? int(rng, 2, 8) : 0;
    const item: RaceItem = { ...base, ask: 'speed', racers: cars([s], [start], rng, exclude), trackLength: L, time: T, target: 0 };
    if (endOf(item, item.racers[0]) > L) return null;
    return numericChoices(item) ? item : null;
  }
  // graph hard: a car's speed from a line that starts past 0.
  const L = 20, T = 4;
  const speeds = distinctInts(2, 1, 4, rng);
  const target = int(rng, 0, 1);
  const starts = [0, 0];
  starts[target] = int(rng, 2, 8);
  const item: RaceItem = { ...base, ask: 'speed', racers: cars(speeds, starts, rng, exclude), trackLength: L, time: T, target };
  if (item.racers.some(r => endOf(item, r) > L)) return null;
  return numericChoices(item) ? item : null;
}

/** The structural shape of an item, so a session does not repeat one. */
const signature = (i: RaceItem) => JSON.stringify([i.ask, i.time, i.window, i.target, i.racers.map(r => [r.speed, r.start, r.time])]);

/** Items per mode: [one mode in the session, several modes]. */
export const ITEM_COUNT: Record<RaceMode, [number, number]> = { observe: [4, 2], predict: [4, 2], measure: [4, 2], calculate: [3, 2], graph: [3, 2] };

/** Whether a mode at a tier has head-start items, and so a defining first item (the head start fools the eye). */
const HEAD_START_BAND = (mode: RaceMode, tier: RaceTier) =>
  (mode === 'observe' && tier === 'hard') || (mode === 'predict' && tier === 'hard') || (mode === 'graph' && tier === 'medium');

export function buildModeItems(mode: RaceMode, tier: RaceTier, count: number, rng: Rng): RaceItem[] {
  const picked: RaceItem[] = [];
  const seen = new Set<string>();
  for (let tries = 0; picked.length < count && tries < 4000; tries++) {
    // The band's defining shape comes first: the slower car with the head start ends in front, or wins.
    const variant: Variant = HEAD_START_BAND(mode, tier) ? (picked.length === 0 ? 'head_ahead' : picked.length === 1 ? 'head_behind' : 'any') : 'any';
    const item = draw(mode, tier, rng, variant);
    if (!item || seen.has(signature(item)) || keyChoice(item) === undefined) continue;
    // Spread the key over the lanes and values: no two items in a row with the same key.
    if (picked.length && keyChoice(picked[picked.length - 1]) === keyChoice(item) && tries < 3000) continue;
    seen.add(signature(item));
    picked.push(item);
  }
  return picked;
}

export function buildRaceItems(opts: { modes: RaceMode[]; tier: RaceTier; rng: Rng }): RaceItem[] {
  const out: RaceItem[] = [];
  for (const mode of opts.modes) out.push(...buildModeItems(mode, opts.tier, ITEM_COUNT[mode][opts.modes.length === 1 ? 0 : 1], opts.rng));
  return out.map((item, i) => ({ ...item, id: `${item.mode}-${i + 1}` }));
}

/** A fresh simpler race for a simplify lever: other cars, the easy shape of the same mode. */
export function drawSimpler(mode: RaceMode, rng: Rng, exclude: readonly string[]): RaceItem | null {
  for (let tries = 0; tries < 2000; tries++) {
    const item = mode === 'graph' ? draw('graph', 'easy', rng, 'any', exclude)
      : mode === 'measure' ? (() => { const i = draw('measure', 'easy', rng, 'any', exclude); return i && i.time === 2 ? i : null; })()
        : mode === 'calculate' ? (() => { const i = draw('calculate', 'easy', rng, 'any', exclude); return i && i.time === 2 ? i : null; })()
          : draw(mode, 'easy', rng, 'any', exclude);
    if (item) return item;
  }
  return null;
}

// ── Lesson data → items ───────────────────────────────────────────────────────────────────

export interface RaceItemsSource {
  title?: string;
  challengeTypes?: string[];
  difficulty?: string;
  supportTier?: string;
  /** 'K', '1' ... '8': picks the modes when no mode is pinned. */
  grade?: string;
  items?: RaceItem[];
  /** Legacy generations (before 2026-10-15): read only for their modes. */
  challenges?: Array<{ type?: string }>;
}

export const resolveRaceTier = (d: RaceItemsSource): RaceTier => {
  const t = (d.difficulty ?? d.supportTier ?? '').toLowerCase();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

/** The modes a grade asks when no mode is pinned. */
export function gradeModes(grade?: string): RaceMode[] {
  const g = (grade ?? '').toUpperCase() === 'K' ? 0 : parseInt(grade ?? '', 10);
  if (Number.isNaN(g)) return ['predict', 'measure'];
  if (g <= 0) return ['observe'];
  if (g === 1) return ['observe', 'predict'];
  if (g === 2) return ['predict', 'measure'];
  if (g === 3) return ['measure', 'calculate'];
  if (g <= 5) return ['calculate', 'graph'];
  return ['graph'];
}

/** The modes a lesson asks: its pin, else the legacy challenges' types, else by grade. */
export function resolveRaceModes(d: RaceItemsSource): RaceMode[] {
  const asked = (d.challengeTypes ?? []).filter((m): m is RaceMode => (RACE_MODES as string[]).includes(m));
  if (asked.length) return RACE_MODES.filter(m => asked.includes(m));
  const legacy = (d.challenges ?? []).map(c => c?.type).filter((m): m is RaceMode => (RACE_MODES as string[]).includes(m ?? ''));
  if (legacy.length) return RACE_MODES.filter(m => legacy.includes(m));
  return gradeModes(d.grade);
}

const ASKS: Record<RaceMode, RaceAsk[]> = {
  observe: ['fastest'], predict: ['winner'], measure: ['distance', 'farther_by'], calculate: ['speed', 'faster_speed'], graph: ['fastest', 'speed'],
};
const whole = (x: unknown, min: number) => typeof x === 'number' && Number.isInteger(x) && x >= min;

/** False when a stored item is not one code could have built (its key would not be computable). */
export function validRaceItem(i: RaceItem | undefined): i is RaceItem {
  if (!i || typeof i.id !== 'string' || !(RACE_MODES as string[]).includes(i.mode) || !ASKS[i.mode]?.includes(i.ask)) return false;
  if (!Array.isArray(i.racers) || i.racers.length < 1 || i.racers.length > 4 || !whole(i.trackLength, 4)) return false;
  if (!i.racers.every(r => r && typeof r.name === 'string' && whole(r.speed, 1) && whole(r.start, 0) && (r.time === undefined || whole(r.time, 1)))) return false;
  if (new Set(i.racers.map(r => r.name)).size !== i.racers.length) return false;
  if (i.mode !== 'predict' && i.ask !== 'faster_speed' && !whole(i.time, 1)) return false;
  if (i.racers.some(r => endOf(i, r) > i.trackLength && i.mode !== 'predict')) return false;
  if (isNameAsk(i.ask)) {
    if (i.racers.length < 2) return false;
    const values = i.ask === 'fastest' ? i.racers.map(r => r.speed) : i.racers.map(r => finishTime(i, r));
    return distinct(values);
  }
  return !!numericChoices(i);
}

/** Every item of the session: the stored, code-built items when all are valid, else built from the lesson's fields. */
export function raceItems(d: RaceItemsSource): RaceItem[] {
  const stored = Array.isArray(d.items) ? d.items.filter(validRaceItem) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  const modes = resolveRaceModes(d), tier = resolveRaceTier(d);
  return buildRaceItems({ modes, tier, rng: seededRng(`${d.title ?? 'race'}:${modes.join(',')}:${tier}`) });
}

// ── Assignment, spoken answers ────────────────────────────────────────────────────────────

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];

/** The answer a spoken reply is judged against, with the ways a learner says it. */
export function raceExpectedAnswer(item: RaceItem): string {
  const key = keyChoice(item), choices = choicesOf(item), at = choices.indexOf(key);
  const place = `its place in the list ("the ${ORDINAL[at]} one")`;
  const others = choices.filter(c => c !== key).map(c => `"${c}"`).join(', ');
  if (isNameAsk(item.ask)) {
    const colour = key.split(' ')[0].toLowerCase();
    return `"${key}": the car's name or its colour said any way ("${colour}", "the ${colour} one"), or ${place}, counts. `
      + `${others} are wrong, and so is naming two cars or hedging between them.`;
  }
  const num = fmtNum(numericChoices(item)!.find(c => c.kind === 'key')!.value);
  return `"${key}": the number ${num} said any way, with or without the unit, or ${place}, counts. ${others} are wrong.`;
}

const WHAT: Record<RaceTrackMiss, string> = {
  ahead_not_fastest: 'names the car that ended in front, which started ahead and is not the fastest',
  slower_racer: 'names a slower car',
  fastest_not_winner: 'names the fastest car, which does not win because another car starts ahead',
  head_start_not_winner: 'names the car with the head start, which is caught before the finish',
  read_position: 'is the square the car stopped on, not the squares it moved',
  farther_total: 'is all the squares the farther car moved, not the difference',
  other_racer: 'is the other car\'s distance',
  off_by_one: 'is one more than the squares moved (the lines counted instead of the squares)',
  shorter_total: 'is the squares the shorter car moved, not the difference',
  added: 'adds the two distances instead of finding the difference',
  time_as_distance: 'is the number of seconds, not squares',
  ignored_start: 'divides the square it stopped on by the seconds, ignoring where it started',
  farther_racer: 'is the speed of the car that moved farther, which ran longer and is slower',
  distance_as_speed: 'is the squares moved, not divided by the seconds',
  multiplied: 'multiplies the squares by the seconds instead of dividing',
  highest_line: 'names the line that ends highest, which started higher and is not the steepest',
};

/** A spoken item's known wrong answers, most specific first, with the tap's miss ids. */
export function raceSpokenMisses(item: RaceItem): KnownMiss[] {
  const groups = new Map<RaceTrackMiss, string[]>();
  for (const c of choicesOf(item)) {
    const m = raceMiss(item, c);
    if (m) groups.set(m, [...(groups.get(m) ?? []), c]);
  }
  const fact = `The right answer is "${keyChoice(item)}".`;
  return RACE_MISSES[item.mode].filter(m => groups.has(m)).map(m => ({ id: m,
    pattern: `${fact} The learner's answer ${WHAT[m]}: ${groups.get(m)!.map(x => `"${x}"`).join(', ')}.`, examples: groups.get(m)! }));
}

const HOW = 'The learner answers by saying it, or by tapping one choice and pressing Check Answer.';
const HOW_RUN = 'The learner first presses Run the race, then answers by saying it, or by tapping one choice and pressing Check Answer.';

export function workspaceAssignment(item: RaceItem): TeachingAssignment {
  const misses = raceSpokenMisses(item);
  return { id: item.id, task: `${askOf(item)} ${needsRun(item) ? HOW_RUN : HOW}`, response: 'speech', acceptsGesture: true,
    expectedAnswer: raceExpectedAnswer(item), ...(misses.length ? { misses } : {}) };
}

// ── Scene ─────────────────────────────────────────────────────────────────────────────────

export interface RaceView {
  choice: string | null;
  /** observe, measure: the learner pressed Run the race. */
  ran: boolean;
  /** The item is credited (or, on the scripted path, revealed): the race has played out on screen. */
  solved: boolean;
}

export const describeRaceWork = (item: RaceItem | undefined, view: Pick<RaceView, 'choice'>) =>
  item && view.choice ? `Chose "${view.choice}"` : 'Nothing chosen yet';

const CONSTRAINTS = 'The learner answers by saying it, or by tapping one choice and checking it; the activity judges the tap. '
  + 'You cannot run the race, tap or check for the learner.';

const lanes = (item: RaceItem) => item.racers.map(r => `${r.name} on square ${r.start}`).join(', ');

/** What is drawn and asked. Where a timed car stopped is never stated (counting it is the task); no key before credit. */
export function workspaceScene(item: RaceItem, view: RaceView): WorkspaceScene {
  const facts: Record<string, string> = {
    kind: item.mode,
    question: askOf(item),
    choices: choicesOf(item).map((c, i) => `${i + 1}) ${c}`).join('  '),
  };
  const track = `A track of squares numbered 0 to ${item.trackLength}, one lane per car`;
  if (needsRun(item)) {
    facts.shown = `${track}: ${lanes(item)} before the race. Run the race plays ${seconds(item.time)} on a timer, then a bell stops every car before the end of the track.`;
    facts.run = view.ran
      ? 'The race has run and stopped at the bell. Each car\'s lane shows a trail from its starting square to where it stopped, over the numbered squares. Where each car stopped is not given to you: the learner reads it off the track.'
      : 'Not run yet: every car is still on its starting square, so there is nothing to compare until the learner presses Run the race.';
  } else if (item.mode === 'predict') {
    facts.shown = `${track}, a finish line at square ${item.trackLength}, each car on its starting square, and a card per car: ${item.racers.map(r => cardText(item, r)).join('; ')}. The race does not run until the answer is credited.`;
  } else if (item.mode === 'calculate') {
    facts.shown = `A race log with one row per car: ${item.racers.map(r => logText(item, r)).join('; ')}; its speed column reads "?". ${track}, each lane with a trail from where the car started to where it stopped.`;
  } else {
    facts.shown = `A position-time graph: time 0 to ${seconds(item.time)} across, position 0 to ${item.trackLength} squares up, one line per car with a dot at every second. `
      + `${item.racers.map(r => `${r.name}'s line starts at square ${r.start} at 0 seconds and ends at square ${fmtNum(endOf(item, r))} at ${seconds(item.time)}`).join('; ')}.`;
  }
  if (view.solved) {
    facts.run = item.mode === 'predict' ? `The race has run to the finish line, and ${keyChoice(item)} crossed first.`
      : item.mode === 'calculate' ? `The race has been replayed, and the log's "?" now reads ${keyChoice(item)}.`
        : item.mode === 'graph' ? 'The race now plays on a track under the graph.'
          : facts.run;
  }
  facts.learnerWork = describeRaceWork(item, view);
  facts.constraints = `${CONSTRAINTS}${item.mode === 'predict' ? ' The race runs only after the answer is credited.' : ''}`;
  return { objects: [], facts };
}

// ── The journey's learner (liveJourneySpec row, the dry sweep) ────────────────────────────

/** The journey's answers: the key, and the wrong choice that shows the mode's first-listed miss it can. */
export function raceHarnessAnswers(item: RaceItem): { correct: string; plainWrong: string } {
  const rank = RACE_MISSES[item.mode];
  const wrong = choicesOf(item).filter(c => !raceCorrect(item, c))
    .sort((a, b) => rank.indexOf(raceMiss(item, a)!) - rank.indexOf(raceMiss(item, b)!));
  return { correct: keyChoice(item), plainWrong: wrong[0] ?? '' };
}
