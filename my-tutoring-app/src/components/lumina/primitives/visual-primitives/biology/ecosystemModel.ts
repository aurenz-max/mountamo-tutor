/**
 * Ecosystem diorama, the domain: an island world in a glass tank, run by code. Pure (no three.js), so the
 * generator, the workspace module, the live adapter, the scene and the tests share one source.
 *
 * The world model owns every number the learner observes. Gemini writes words only.
 * - The sun travels an arc across the sky over one school day (`sunAngle`); its strength is the sine of its height.
 * - A thing in the tank warms by what it absorbs, how much sun reaches it and how much heat it takes to warm it
 *   (`warmthAt`): dark beats light, sun beats shade, sand beats water. Code decides which one gets warmer.
 *
 * Modes. `sun_test` is the birth mode (SCI001-03-G, K-PS3-1). The weather log, season and living-things modes plug
 * into the same world later (see qa/eval-reports/ecosystem-diorama-birth.md).
 *
 * sun_test: a fair test of two things that differ in ONE way (colour, place, or material).
 *   1. Guess: the learner taps the one they think will get warmer (recorded, never scored alone).
 *   2. Run: the learner drags the sun across the sky; a picture thermometer beside each thing fills.
 *   3. Read: the learner taps the one that got warmer. That tap is the check.
 */

import {
  LOG_DAYS, PLANT_NEEDS_MISSES, SEASONS, SEASON_BEHAVIOR_MISSES, SEASON_SIGN, WINTER_PLACE, WINTER_WHY,
  countWeather, drawMonth, mostCommon, pickWinterAnimals, plantGrows, plantMissing, plantNeedsMiss,
  type Animal, type AnimalThing, type PlantKind, type PlantSetup, type Season, type Weather, type WinterPlace,
} from './ecosystemLife';
import { ECOSYSTEM_MISSES_BY_MODE } from './ecosystemDiorama.card';

/** The ladder, easiest first (β order in the catalog). */
export const ECOSYSTEM_TASKS = ['plant_needs', 'sun_test', 'season_behavior', 'season_from_log', 'compare_logs', 'keep_it_cool'] as const;
export type EcosystemTask = typeof ECOSYSTEM_TASKS[number];
export type EcosystemBand = 'K-2' | '3-5';

// ── The sun ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Sun angle above the eastern horizon, radians, for day progress p in [0, 1] (morning to mid-afternoon). */
export const sunAngle = (p: number) => Math.PI * (0.28 + 0.44 * clamp01(p));
/** How strong the sunlight is at day progress p: the sine of the sun's height (0 to 1). */
export const sunStrength = (p: number) => Math.max(0, Math.sin(sunAngle(p)));
/** The sun has crossed the sky: the test is over and the thermometers can be read. */
export const DAY_DONE = 0.97;

export function dayWord(p: number): 'morning' | 'late morning' | 'midday' | 'afternoon' {
  if (p < 0.25) return 'morning';
  if (p < 0.45) return 'late morning';
  if (p < 0.65) return 'midday';
  return 'afternoon';
}

// ── Things in the tank ──────────────────────────────────────────────────────────────────────────────────────

export type ThingKind = 'paper' | 'stone' | 'water' | 'sand';
/** dark / light are a colour difference; natural is the thing's own colour. */
export type ThingColour = 'dark' | 'light' | 'natural';
export type ThingPlace = 'sun' | 'shade';
export type Side = 'left' | 'right';
/** Where a thing stands. `sunLeft`/`sunRight` are open sand; `hut` is under the shade hut's roof. */
export type Spot = 'sunLeft' | 'hut' | 'sunRight';

export interface TestThing {
  kind: ThingKind;
  colour: ThingColour;
  place: ThingPlace;
  spot: Spot;
  /** What the learner hears and reads: "the black paper", "the sand in the shade hut". */
  name: string;
}

/** Share of the sunlight a thing soaks up. Dark things soak up more. */
const ABSORB: Record<ThingKind, Record<ThingColour, number>> = {
  paper: { dark: 0.92, light: 0.3, natural: 0.6 },
  stone: { dark: 0.92, light: 0.35, natural: 0.7 },
  water: { dark: 0.95, light: 0.25, natural: 0.62 },
  sand: { dark: 0.9, light: 0.4, natural: 0.75 },
};
/** Heat it takes to warm the thing (water needs much more than sand). */
const HEAT_CAPACITY: Record<ThingKind, number> = { paper: 0.6, stone: 1.4, water: 2.4, sand: 1.0 };
/** Share of the sunlight that reaches a thing in each place. */
const EXPOSURE: Record<ThingPlace, number> = { sun: 1, shade: 0.12 };
const GAIN = 48, LOSS = 0.9, STEPS = 96;

/** Degrees of warming above the morning start at day progress p (a simple heat balance, integrated in steps). */
export function warmthAt(t: Pick<TestThing, 'kind' | 'colour' | 'place'>, p: number): number {
  return warmthWith(ABSORB[t.kind][t.colour] * EXPOSURE[t.place], HEAT_CAPACITY[t.kind], p);
}

/** The heat balance for a thing that soaks up share `a` of full sunlight and takes `c` heat to warm. */
export function warmthWith(a: number, c: number, p: number): number {
  const end = clamp01(p);
  const n = Math.max(1, Math.round(STEPS * end));
  const dt = end / n;
  let T = 0;
  for (let i = 0; i < n; i++) T += ((GAIN * a * sunStrength((i + 0.5) * dt) - LOSS * T) / c) * dt;
  return T;
}

/** The picture thermometer's red fill, 0.1 (cool, the morning start) to 1 (hot). */
export const THERMO_FULL = 32;
export const thermoFill = (warmth: number) => 0.1 + 0.9 * Math.min(1, Math.max(0, warmth) / THERMO_FULL);
/** Tick marks (of 5, at fills 0.2 ... 1.0) the red has reached: what is drawn, in words for the tutor. Starts at 0. */
export const thermoMarks = (fill: number) => Math.max(0, Math.min(5, Math.floor(fill * 5 + 1e-6)));

// ── The sun_test pool (code-owned) ──────────────────────────────────────────────────────────────────────────

export type SunTestVariable = 'colour' | 'place' | 'material';

interface PairSpec {
  key: string;
  variable: SunTestVariable;
  a: Omit<TestThing, 'spot'>;
  b: Omit<TestThing, 'spot'>;
}

const T = (kind: ThingKind, colour: ThingColour, place: ThingPlace, name: string): Omit<TestThing, 'spot'> =>
  ({ kind, colour, place, name });

/** Every pair differs in exactly one way; `sunTestPool.test` checks that and that the readings differ clearly. */
export const SUN_TEST_PAIRS: readonly PairSpec[] = [
  { key: 'paper-colour', variable: 'colour', a: T('paper', 'dark', 'sun', 'the black paper'), b: T('paper', 'light', 'sun', 'the white paper') },
  { key: 'stone-colour', variable: 'colour', a: T('stone', 'dark', 'sun', 'the dark stone'), b: T('stone', 'light', 'sun', 'the pale stone') },
  { key: 'cup-colour', variable: 'colour', a: T('water', 'dark', 'sun', 'the water in the black cup'), b: T('water', 'light', 'sun', 'the water in the white cup') },
  { key: 'stone-place', variable: 'place', a: T('stone', 'natural', 'sun', 'the stone in the sun'), b: T('stone', 'natural', 'shade', 'the stone in the shade hut') },
  { key: 'sand-place', variable: 'place', a: T('sand', 'natural', 'sun', 'the sand in the sun'), b: T('sand', 'natural', 'shade', 'the sand in the shade hut') },
  { key: 'paper-place', variable: 'place', a: T('paper', 'natural', 'sun', 'the paper in the sun'), b: T('paper', 'natural', 'shade', 'the paper in the shade hut') },
  { key: 'sand-water', variable: 'material', a: T('sand', 'natural', 'sun', 'the cup of sand'), b: T('water', 'natural', 'sun', 'the cup of water') },
];

export interface SunTestChallenge {
  id: string;
  type: 'sun_test';
  variable: SunTestVariable;
  /** The thing drawn on the left of the test and the one on the right, as the learner sees them. */
  left: TestThing;
  right: TestThing;
  /** The key: the side that is warmer when the sun has crossed the sky. Never reaches the tutor. */
  warmer: Side;
  /** What changes between the two, said plainly ("only the colour is different"). */
  difference: string;
  instruction: string;
}


const DIFFERENCE: Record<SunTestVariable, string> = {
  colour: 'Only the colour is different.',
  place: 'Only the place is different: one is in the sun, one is in the shade hut.',
  material: 'Only what is in the cup is different.',
};

export function sunTestInstruction(left: TestThing, right: TestThing, variable: SunTestVariable): string {
  return `${cap(left.name)} and ${right.name} sit in the same tank all day. ${DIFFERENCE[variable]} `
    + 'Which one will get warmer? Tap it to make your guess, then move the sun across the sky.';
}

function shuffle<T>(xs: readonly T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Place a pair on the sand. Sun things take the open spots; a shade thing stands in the hut between them. Which of
 * the two ends up on the left is chosen by `flip`, so the warmer one is not always on the same side.
 */
export function placePair(spec: PairSpec, flip: boolean): { left: TestThing; right: TestThing } {
  const [first, second] = flip ? [spec.b, spec.a] : [spec.a, spec.b];
  const spotOf = (t: Omit<TestThing, 'spot'>, side: Side): Spot => (t.place === 'shade' ? 'hut' : side === 'left' ? 'sunLeft' : 'sunRight');
  return { left: { ...first, spot: spotOf(first, 'left') }, right: { ...second, spot: spotOf(second, 'right') } };
}

export function buildSunTest(spec: PairSpec, flip: boolean, id: string): SunTestChallenge {
  const { left, right } = placePair(spec, flip);
  const warmer: Side = warmthAt(left, 1) > warmthAt(right, 1) ? 'left' : 'right';
  return { id, type: 'sun_test', variable: spec.variable, left, right, warmer, difference: DIFFERENCE[spec.variable],
    instruction: sunTestInstruction(left, right, spec.variable) };
}

/**
 * `count` tests: every variable (colour, place, material) once before any repeats, no pair twice, and the warmer
 * one on each side at least once.
 */
export function pickSunTests(count: number, rng: () => number = Math.random): SunTestChallenge[] {
  const byVar = (v: SunTestVariable) => shuffle(SUN_TEST_PAIRS.filter(p => p.variable === v), rng);
  const queues = { colour: byVar('colour'), place: byVar('place'), material: byVar('material') };
  const order: SunTestVariable[] = [];
  const vars = shuffle(['colour', 'place', 'material'] as SunTestVariable[], rng);
  while (order.length < count) order.push(...vars);
  const specs: PairSpec[] = [];
  const used = new Set<string>();
  for (const v of order) {
    if (specs.length >= count) break;
    const next = queues[v].find(p => !used.has(p.key)) ?? SUN_TEST_PAIRS.find(p => !used.has(p.key));
    if (!next) break;
    used.add(next.key); specs.push(next);
  }
  while (specs.length < count) specs.push(SUN_TEST_PAIRS[specs.length % SUN_TEST_PAIRS.length]);
  const flips = specs.map(() => rng() < 0.5);
  const tests = specs.map((s, i) => buildSunTest(s, flips[i], `eco-${i + 1}`));
  // The warmer one on each side at least once.
  if (tests.length > 1 && tests.every(t => t.warmer === tests[0].warmer)) {
    const i = tests.length - 1;
    tests[i] = buildSunTest(specs[i], !flips[i], tests[i].id);
  }
  return tests;
}

// ── The check ───────────────────────────────────────────────────────────────────────────────────────────────

export const SUN_TEST_MISSES = ECOSYSTEM_MISSES_BY_MODE.sun_test;

export const thingOn = (c: SunTestChallenge, side: Side) => (side === 'left' ? c.left : c.right);
export const readMatches = (c: SunTestChallenge, picked: Side) => picked === c.warmer;
export const readMiss = (c: SunTestChallenge, picked: Side): (typeof SUN_TEST_MISSES)[number] | undefined =>
  (picked === c.warmer ? undefined : 'picked_cooler');

/** The learner's work in words: the guess and the reading, never the key. */
export function describeRead(c: SunTestChallenge, guess: Side | null, picked: Side): string {
  const g = guess ? `Guessed ${thingOn(c, guess).name} would get warmer. ` : '';
  return `${g}After the sun crossed the sky, tapped ${thingOn(c, picked).name} as the one that got warmer`;
}

const WHY: Record<SunTestVariable, (warm: TestThing, cool: TestThing) => string> = {
  colour: (w) => `${cap(w.name)} soaked up more sunlight. Dark things get warmer in the sun.`,
  place: () => 'The sun shone on one all day. The shade hut kept the sunlight off the other one.',
  material: () => 'The same sun shone on both. Sand warms up faster than water.',
};

/** What the reading showed. On a miss it sends the learner back to the thermometers without naming the warmer one. */
export function readFeedback(c: SunTestChallenge, picked: Side): string {
  if (picked !== c.warmer) return 'Look at the two thermometers again. Which red line went up higher?';
  const warm = thingOn(c, c.warmer), cool = thingOn(c, c.warmer === 'left' ? 'right' : 'left');
  return `Yes! The red line by ${warm.name} went up higher. ${WHY[c.variable](warm, cool)}`;
}

/** What the guess was, said after the reading (a guess is a guess: it is compared, never graded). */
export function guessFeedback(c: SunTestChallenge, guess: Side | null): string | null {
  if (!guess) return null;
  return guess === c.warmer ? 'Your guess matched what happened.' : 'Your guess was different from what happened. Scientists change their minds when a test shows them something new.';
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
// The other modes of the same world
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const weatherDays = (w: Weather, n?: number) => (n == null ? `${w} days` : `${n} ${w} day${n === 1 ? '' : 's'}`);

// ── season_from_log (SCI003-01-D) ────────────────────────────────────────────────────────────────────────

/**
 * Run a month in the tank: each school day's weather happens and its picture goes into the weather log. The month
 * is unnamed ("this month"). Then the learner picks the season and the weather in the log that showed it.
 */
export interface SeasonLogChallenge {
  id: string;
  type: 'season_from_log';
  /** The key. Never reaches the tutor. */
  season: Season;
  days: Weather[];
  instruction: string;
}

export const SEASON_LOG_MISSES = ECOSYSTEM_MISSES_BY_MODE.season_from_log;

export function buildSeasonLog(season: Season, id: string, rng: () => number = Math.random): SeasonLogChallenge {
  return { id, type: 'season_from_log', season, days: drawMonth(season, rng),
    instruction: 'Play the month. Each school day, watch the weather in the tank and see its picture go into the weather log. '
      + 'Then tell me: which season was it? Which weather in the log shows it?' };
}

/** The evidence that counts: the most common weather in the record (the season's sign). */
export const logEvidence = (c: SeasonLogChallenge) => mostCommon(c.days) ?? SEASON_SIGN[c.season];

export function seasonLogMiss(c: SeasonLogChallenge, season: Season, evidence: Weather): (typeof SEASON_LOG_MISSES)[number] | undefined {
  if (season !== c.season) return 'wrong_season';
  if (evidence !== logEvidence(c)) return 'present_not_most';
  return undefined;
}

export function describeSeasonLog(season: Season, evidence: Weather): string {
  return `Said it was ${season}, because of the ${weatherDays(evidence)} in the log`;
}

export function seasonLogFeedback(c: SeasonLogChallenge, season: Season, evidence: Weather): string {
  const miss = seasonLogMiss(c, season, evidence);
  const n = countWeather(c.days);
  if (miss === 'present_not_most') {
    return `There were some ${weatherDays(evidence)}. Which weather happened the MOST? Count the rows in the log.`;
  }
  if (miss === 'wrong_season') return 'Look at the log again. Which weather happened most days? What season has lots of that weather?';
  return `Yes! ${cap(weatherDays(evidence, n[evidence]))}: that weather tells us it was ${season}.`;
}

// ── compare_logs (SCI003-01-G) ──────────────────────────────────────────────────────────────────────────

export interface LogRecord { label: string; days: Weather[] }
export type CompareAsk = { kind: 'more'; weather: Weather } | { kind: 'warmer' };

/**
 * Two months (or two places in the same month) play in the tank, one after the other, and fill two logs. Then one
 * question: which had more of one weather, or which was warmer. The key is computed from the two records.
 */
export interface CompareLogsChallenge {
  id: string;
  type: 'compare_logs';
  a: LogRecord;
  b: LogRecord;
  ask: CompareAsk;
  /** The key. Never reaches the tutor. */
  answer: 'a' | 'b';
  instruction: string;
}

export const COMPARE_LOGS_MISSES = ECOSYSTEM_MISSES_BY_MODE.compare_logs;

const COMPARE_PAIRS: readonly { a: [string, Season]; b: [string, Season] }[] = [
  { a: ['January in our town', 'winter'], b: ['July in our town', 'summer'] },
  { a: ['April in our town', 'spring'], b: ['October in our town', 'fall'] },
  { a: ['January on Snowy Hill', 'winter'], b: ['January at Palm Beach', 'summer'] },
  { a: ['July in our town', 'summer'], b: ['October in our town', 'fall'] },
  { a: ['January in our town', 'winter'], b: ['April in our town', 'spring'] },
];

/** A warmth score for a record: sunny days warm it, snowy and windy days cool it. */
const warmthScore = (days: readonly Weather[]) => { const n = countWeather(days); return n.sunny * 2 - n.snowy * 3 - n.windy; };

export function compareAskText(ask: CompareAsk): string {
  return ask.kind === 'more' ? `Which one had more ${weatherDays(ask.weather)}?` : 'Which one was warmer?';
}

export function buildCompareLogs(pair: number, askKind: 'more' | 'warmer', id: string, rng: () => number = Math.random): CompareLogsChallenge {
  const p = COMPARE_PAIRS[pair % COMPARE_PAIRS.length];
  const [A, B] = rng() < 0.5 ? [p.b, p.a] : [p.a, p.b];
  const a: LogRecord = { label: A[0], days: drawMonth(A[1], rng) };
  const b: LogRecord = { label: B[0], days: drawMonth(B[1], rng) };
  const na = countWeather(a.days), nb = countWeather(b.days);
  let ask: CompareAsk;
  // "Warmer" only when the two records differ in warmth clearly; otherwise "more" of the weather with the biggest gap.
  if (askKind === 'warmer' && Math.abs(warmthScore(a.days) - warmthScore(b.days)) >= 8) ask = { kind: 'warmer' };
  else {
    const w = (['snowy', 'sunny', 'rainy', 'windy', 'cloudy'] as Weather[])
      .sort((x, y) => Math.abs(na[y] - nb[y]) - Math.abs(na[x] - nb[x]))[0];
    ask = { kind: 'more', weather: w };
  }
  const answer: 'a' | 'b' = ask.kind === 'warmer'
    ? (warmthScore(a.days) > warmthScore(b.days) ? 'a' : 'b')
    : (na[ask.weather] > nb[ask.weather] ? 'a' : 'b');
  return { id, type: 'compare_logs', a, b, ask, answer,
    instruction: `Play both months in the tank and watch two weather logs fill: ${a.label} and ${b.label}. Then: ${compareAskText(ask)}` };
}

export const compareMatches = (c: CompareLogsChallenge, pick: 'a' | 'b') => pick === c.answer;
export const compareMiss = (c: CompareLogsChallenge, pick: 'a' | 'b'): (typeof COMPARE_LOGS_MISSES)[number] | undefined =>
  (pick === c.answer ? undefined : c.ask.kind === 'warmer' ? 'picked_colder' : 'picked_fewer');
export const describeCompare = (c: CompareLogsChallenge, pick: 'a' | 'b') =>
  `Asked "${compareAskText(c.ask)}", picked ${(pick === 'a' ? c.a : c.b).label}`;

export function compareFeedback(c: CompareLogsChallenge, pick: 'a' | 'b'): string {
  const r = pick === 'a' ? c.a : c.b;
  if (pick !== c.answer) {
    return c.ask.kind === 'warmer'
      ? 'Look at both logs again. Which one has more sunny days and fewer snowy days?'
      : `Count the ${weatherDays(c.ask.weather)} in each log again. Which log has more?`;
  }
  const n = countWeather(r.days);
  return c.ask.kind === 'warmer'
    ? `Yes! ${cap(r.label)} had ${weatherDays('sunny', n.sunny)} and ${weatherDays('snowy', n.snowy)}. It was warmer.`
    : `Yes! ${cap(r.label)} had ${weatherDays(c.ask.weather, n[c.ask.weather])}. That is more.`;
}

// ── plant_needs (SCI002-02-B) ───────────────────────────────────────────────────────────────────────────

/**
 * A potted plant in the tank. The learner sets where it stands (the sunny sand or the shade hut), what is in the pot
 * (soil or pebbles), whether it is watered, and may add animal things (a den, berries). "Watch it grow" runs two
 * weeks of days: the plant grows tall with sun, water and soil, and droops without any of them. The check: the plant
 * grows and was given nothing it does not need.
 */
export interface PlantNeedsChallenge {
  id: string;
  type: 'plant_needs';
  plant: PlantKind;
  /** 'grow': a seedling in an empty pot; 'fix': a drooping plant missing one or two needs. */
  variant: 'grow' | 'fix';
  start: PlantSetup;
  instruction: string;
}

const FIX_STARTS: readonly PlantSetup[] = [
  { spot: 'hut', fill: 'soil', watered: true, extras: [] },
  { spot: 'sun', fill: 'soil', watered: false, extras: [] },
  { spot: 'sun', fill: 'pebbles', watered: true, extras: [] },
  { spot: 'hut', fill: 'soil', watered: false, extras: [] },
  { spot: 'sun', fill: 'pebbles', watered: false, extras: ['berries'] },
];

export function buildPlantNeeds(plant: PlantKind, variant: 'grow' | 'fix', id: string, rng: () => number = Math.random): PlantNeedsChallenge {
  const start: PlantSetup = variant === 'grow'
    ? { spot: 'sun', fill: 'empty', watered: false, extras: [] }
    : { ...FIX_STARTS[Math.floor(rng() * FIX_STARTS.length)] };
  const instruction = variant === 'grow'
    ? `Here is a little ${plant} seedling and an empty pot. Give it everything it needs to grow, and nothing it does not need. Then press Watch it grow.`
    : `This ${plant} is drooping. Find what it is missing and fix it, then press Watch it grow.`;
  return { id, type: 'plant_needs', plant, variant, start: { ...start, extras: [...start.extras] }, instruction };
}

export { plantGrows, plantMissing };
export const plantMatches = (s: PlantSetup) => plantGrows(s) && s.extras.length === 0;
export const plantMiss = (s: PlantSetup) => plantNeedsMiss(s);

const extraWords = (xs: readonly AnimalThing[], joiner: string) => xs.map(e => (e === 'den' ? 'a den' : 'berries')).join(joiner);

export function describePlant(s: PlantSetup): string {
  const where = s.spot === 'sun' ? 'in the sunny spot' : 'in the shade hut';
  const fill = s.fill === 'empty' ? 'an empty pot' : `a pot of ${s.fill}`;
  const extras = s.extras.length ? `, and added ${extraWords(s.extras, ' and ')}` : '';
  return `Put the plant ${where} in ${fill}, ${s.watered ? 'watered it' : 'did not water it'}${extras}, then watched it grow`;
}

const NEED_WORD = { sun: 'sunlight', water: 'water', soil: 'soil' } as const;

export function plantFeedback(c: PlantNeedsChallenge, s: PlantSetup): string {
  const missing = plantMissing(s);
  if (missing.length) return `The ${c.plant} drooped. It is missing something it needs to grow. What can you change?`;
  if (s.extras.length) {
    return `The ${c.plant} grew! But it did not need ${extraWords(s.extras, ' or ')}. `
      + 'Plants make their own food from sunlight. Take away what it does not need.';
  }
  return `It grew tall! ${cap(Object.values(NEED_WORD).join(', '))}: that is what a ${c.plant} needs.`;
}

// ── season_behavior (SCI002-02-E) ───────────────────────────────────────────────────────────────────────

/**
 * Summer on the island: every animal in its summer place. The learner brings winter (the leaves turn and fall,
 * snow falls), then moves each animal to where it spends the winter and presses Done. The winter places stay
 * empty until the learner moves an animal there.
 */
export interface SeasonBehaviorChallenge {
  id: string;
  type: 'season_behavior';
  animals: Animal[];
  instruction: string;
}

export function buildSeasonBehavior(animals: Animal[], id: string): SeasonBehaviorChallenge {
  const list = animals.map(a => `the ${a}`);
  const names = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0];
  return { id, type: 'season_behavior', animals,
    instruction: `It is summer on the island. Bring winter, then help ${names}: tap an animal, then tap where it spends the winter.` };
}

export type WinterMoves = Partial<Record<Animal, WinterPlace>>;
export const winterMatches = (c: SeasonBehaviorChallenge, moves: WinterMoves) => c.animals.every(a => moves[a] === WINTER_PLACE[a]);
export const winterMiss = (c: SeasonBehaviorChallenge, moves: WinterMoves): (typeof SEASON_BEHAVIOR_MISSES)[number] | undefined =>
  (winterMatches(c, moves) ? undefined : 'wrong_place');

export const PLACE_SHORT: Record<WinterPlace, string> = { den: 'the cave den', south: 'south', hollow: 'the tree hollow', meadow: 'the meadow' };
export const describeWinter = (c: SeasonBehaviorChallenge, moves: WinterMoves) =>
  `Moved ${c.animals.map(a => `the ${a} to ${moves[a] ? PLACE_SHORT[moves[a]!] : 'nowhere yet'}`).join(', ')}`;

export function winterFeedback(c: SeasonBehaviorChallenge, moves: WinterMoves): string {
  const wrong = c.animals.filter(a => moves[a] !== WINTER_PLACE[a]);
  if (wrong.length) return `Think about the ${wrong[0]} again. In winter it is cold and food is hard to find. What does the ${wrong[0]} do?`;
  return `Yes! ${c.animals.map(a => WINTER_WHY[a]).join(' ')}`;
}

// ── keep_it_cool (K-PS3-2) ──────────────────────────────────────────────────────────────────────────────

export const COVERS = ['umbrella', 'leaf roof', 'clear sheet', 'hut'] as const;
export type Cover = typeof COVERS[number];
/** Share of the sunlight that still reaches a thing under each cover ('hut' = moved into the shade hut). */
export const COVER_EXPOSURE: Record<Cover | 'none', number> = { none: 1, umbrella: 0.15, 'leaf roof': 0.2, 'clear sheet': 0.92, hut: 0.12 };
export const COOL_THINGS = ['ice pop', 'snowman', 'chocolate bar'] as const;
export type CoolThing = typeof COOL_THINGS[number];
/** The cool line on the thermometer: the red must stay below it all day. */
export const COOL_LINE = 0.4;

/**
 * Keep something cool in the sun: the learner builds shade over it (an umbrella, a roof of leaves, a clear sheet) or
 * moves it into the shade hut, then runs the sun. It passes when the red line stays below the cool line. Many designs
 * pass; the heat model judges.
 */
export interface KeepCoolChallenge {
  id: string;
  type: 'keep_it_cool';
  thing: CoolThing;
  /** The covers on offer (always two that work and the clear sheet, which does not). */
  covers: Cover[];
  instruction: string;
}

export const KEEP_COOL_MISSES = ECOSYSTEM_MISSES_BY_MODE.keep_it_cool;

export function buildKeepCool(thing: CoolThing, id: string, rng: () => number = Math.random): KeepCoolChallenge {
  const works = shuffle(['umbrella', 'leaf roof', 'hut'] as Cover[], rng).slice(0, 2);
  return { id, type: 'keep_it_cool', thing, covers: shuffle([...works, 'clear sheet'] as Cover[], rng),
    instruction: `The ${thing} is out on the sunny sand. Build something to keep it cool all day, so the red line stays below the blue cool line. Then move the sun across the sky.` };
}

/** How warm the thing gets by day progress p under a cover. The sun test's heat model, for a dark wrapper on sand. */
export const coolWarmth = (cover: Cover | null, p: number) =>
  warmthWith(0.9 * COVER_EXPOSURE[cover ?? 'none'], 1.0, p);
export const coolFill = (cover: Cover | null, p: number) => thermoFill(coolWarmth(cover, p));
export const coolMatches = (cover: Cover | null) => coolFill(cover, 1) < COOL_LINE;
export const coolMiss = (cover: Cover | null): (typeof KEEP_COOL_MISSES)[number] | undefined =>
  (coolMatches(cover) ? undefined : cover === 'clear sheet' ? 'clear_cover' : 'no_shade');
export const coverWords = (cover: Cover | null) =>
  (cover === 'hut' ? 'moved it into the shade hut' : cover ? `put a ${cover} over it` : 'left it in the sun with nothing over it');
export const describeCool = (cover: Cover | null) => `${cap(coverWords(cover))}, then ran the sun across the sky`;

export function coolFeedback(c: KeepCoolChallenge, cover: Cover | null): string {
  if (coolMatches(cover)) return `It stayed cool! The red line stayed below the cool line. The shade kept the sunlight off the ${c.thing}.`;
  if (cover === 'clear sheet') return `Oh no, the ${c.thing} got warm! Sunlight shines right through a clear sheet. What could block the sunlight?`;
  return `Oh no, the ${c.thing} got warm in the sun! What could you build to make shade?`;
}

// ── The whole world ─────────────────────────────────────────────────────────────────────────────────────

export type EcosystemChallenge =
  | SunTestChallenge | SeasonLogChallenge | CompareLogsChallenge | PlantNeedsChallenge | SeasonBehaviorChallenge | KeepCoolChallenge;

export { ECOSYSTEM_MISSES_BY_MODE, type EcosystemMiss } from './ecosystemDiorama.card';

/** `count` items of one task, varied: seasons, pairs, plants and animals each before any repeat. */
export function pickChallenges(task: EcosystemTask, count: number, startId = 1, rng: () => number = Math.random): EcosystemChallenge[] {
  const id = (i: number) => `eco-${startId + i}`;
  switch (task) {
    case 'sun_test': return pickSunTests(count, rng).map((c, i) => ({ ...c, id: id(i) }));
    case 'season_from_log': {
      const seasons = shuffle(SEASONS, rng);
      return Array.from({ length: count }, (_, i) => buildSeasonLog(seasons[i % 4], id(i), rng));
    }
    case 'compare_logs': {
      const pairs = shuffle([0, 1, 2, 3, 4], rng);
      return Array.from({ length: count }, (_, i) => buildCompareLogs(pairs[i % pairs.length], i % 2 ? 'warmer' : 'more', id(i), rng));
    }
    case 'plant_needs': {
      const plants = shuffle(['sunflower', 'bean plant', 'tomato plant', 'daisy'] as PlantKind[], rng);
      return Array.from({ length: count }, (_, i) => buildPlantNeeds(plants[i % 4], i % 2 ? 'fix' : 'grow', id(i), rng));
    }
    case 'season_behavior':
      return Array.from({ length: count }, (_, i) => buildSeasonBehavior(pickWinterAnimals(i === 0 ? 2 : 3, rng), id(i)));
    case 'keep_it_cool': {
      const things = shuffle(COOL_THINGS, rng);
      return Array.from({ length: count }, (_, i) => buildKeepCool(things[i % things.length], id(i), rng));
    }
  }
}

/** A mixed session: the tasks in the ladder's order (easiest first), spread as evenly as `count` allows. */
export function pickMixed(count: number, rng: () => number = Math.random): EcosystemChallenge[] {
  const tasks = ECOSYSTEM_TASKS.slice();
  const out: EcosystemChallenge[] = [];
  tasks.forEach((t, i) => {
    const n = Math.floor(count / tasks.length) + (i < count % tasks.length ? 1 : 0);
    if (n) out.push(...pickChallenges(t, n, out.length + 1, rng));
  });
  return out;
}

export type { Animal, AnimalThing, PlantKind, PlantSetup, Season, Weather, WinterPlace };
export { LOG_DAYS, WINTER_PLACE };
