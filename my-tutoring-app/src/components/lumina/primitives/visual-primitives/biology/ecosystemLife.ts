/**
 * Ecosystem diorama, the living world: weather records, seasons, plants and animals. Pure (no three.js). Code
 * owns every record, every plant's needs and every animal's winter place; Gemini writes words only.
 *
 * - Weather: each school day has one picture weather (sunny, cloudy, rainy, snowy, windy). A month of 20 school days
 *   is drawn for a season so the season's weather is clearly the most common (winter snowy, spring rainy, summer
 *   sunny, fall windy). Spring and fall look alike in real weather; giving each its own most-common weather keeps
 *   the K question answerable from the record.
 * - Plants need sunlight, water and soil. Animal things (a den, berries) are not plant needs.
 * - Winter: each animal has one winter place (bear: den; bird: flies south; squirrel: its tree hollow with stored
 *   nuts; deer: stays in the meadow and finds food).
 */
import { ECOSYSTEM_MISSES_BY_MODE } from './ecosystemDiorama.card';

// ── Weather and seasons ─────────────────────────────────────────────────────────────────────────────────────

export const WEATHERS = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'] as const;
export type Weather = typeof WEATHERS[number];
export const SEASONS = ['winter', 'spring', 'summer', 'fall'] as const;
export type Season = typeof SEASONS[number];

/** The weather that tells each season apart in a record (the evidence the learner names). */
export const SEASON_SIGN: Record<Season, Weather> = { winter: 'snowy', spring: 'rainy', summer: 'sunny', fall: 'windy' };

/** School days in one month's record. */
export const LOG_DAYS = 20;

/** Count ranges per season [min, max]; the season's sign is drawn first and is always the most common by 3+. */
const SEASON_COUNTS: Record<Season, Record<Weather, [number, number]>> = {
  winter: { snowy: [9, 11], cloudy: [4, 6], sunny: [2, 4], windy: [0, 2], rainy: [0, 0] },
  spring: { rainy: [9, 11], sunny: [3, 5], cloudy: [3, 5], windy: [0, 2], snowy: [0, 0] },
  summer: { sunny: [11, 13], cloudy: [2, 4], rainy: [2, 3], windy: [0, 1], snowy: [0, 0] },
  fall: { windy: [8, 10], cloudy: [4, 6], rainy: [2, 4], sunny: [2, 3], snowy: [0, 0] },
};

const randInt = (lo: number, hi: number, rng: () => number) => lo + Math.floor(rng() * (hi - lo + 1));
function shuffle<T>(xs: readonly T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function countWeather(days: readonly Weather[]): Record<Weather, number> {
  const c = { sunny: 0, cloudy: 0, rainy: 0, snowy: 0, windy: 0 };
  for (const d of days) c[d]++;
  return c;
}

/** The most common weather in a record (null on a tie). */
export function mostCommon(days: readonly Weather[]): Weather | null {
  const c = countWeather(days);
  const sorted = WEATHERS.slice().sort((a, b) => c[b] - c[a]);
  return c[sorted[0]] > c[sorted[1]] ? sorted[0] : null;
}

/** A month of school-day weather for a season: the sign 3+ ahead of every other weather, in a shuffled order. */
export function drawMonth(season: Season, rng: () => number = Math.random): Weather[] {
  const ranges = SEASON_COUNTS[season];
  const sign = SEASON_SIGN[season];
  for (let attempt = 0; attempt < 200; attempt++) {
    const counts = Object.fromEntries(WEATHERS.map(w => [w, randInt(ranges[w][0], ranges[w][1], rng)])) as Record<Weather, number>;
    // Fill or trim to LOG_DAYS through the second most common weather (never the sign, never a zero-range weather).
    const others = WEATHERS.filter(w => w !== sign && ranges[w][1] > 0).sort((a, b) => counts[b] - counts[a]);
    let total = WEATHERS.reduce((s, w) => s + counts[w], 0);
    for (const w of others) {
      while (total < LOG_DAYS && counts[w] < counts[sign] - 3) { counts[w]++; total++; }
      while (total > LOG_DAYS && counts[w] > 0) { counts[w]--; total--; }
    }
    if (total !== LOG_DAYS) continue;
    if (!others.every(w => counts[w] <= counts[sign] - 3)) continue;
    const days = shuffle(WEATHERS.flatMap(w => Array.from({ length: counts[w] }, () => w)), rng);
    return days;
  }
  throw new Error(`drawMonth: no record for ${season}`);
}

// ── Plants ────────────────────────────────────────────────────────────────────────────────────────────────

export const PLANTS = ['sunflower', 'bean plant', 'tomato plant', 'daisy'] as const;
export type PlantKind = typeof PLANTS[number];
export type PotFill = 'soil' | 'pebbles' | 'empty';
export type PotSpot = 'sun' | 'hut';
/** Things for animals, offered beside the plant things: a plant needs none of them. */
export const ANIMAL_THINGS = ['den', 'berries'] as const;
export type AnimalThing = typeof ANIMAL_THINGS[number];

export interface PlantSetup {
  spot: PotSpot;
  fill: PotFill;
  watered: boolean;
  extras: AnimalThing[];
}

export const PLANT_NEEDS_MISSES = ECOSYSTEM_MISSES_BY_MODE.plant_needs;
export type PlantNeedsMiss = typeof PLANT_NEEDS_MISSES[number];

/** What the plant is missing, in the order the check names them. */
export function plantMissing(s: PlantSetup): ('sun' | 'water' | 'soil')[] {
  const out: ('sun' | 'water' | 'soil')[] = [];
  if (s.spot !== 'sun') out.push('sun');
  if (!s.watered) out.push('water');
  if (s.fill !== 'soil') out.push('soil');
  return out;
}

/** Whether the plant grows in the time-lapse: sunlight, water and soil (animal things change nothing for it). */
export const plantGrows = (s: PlantSetup) => plantMissing(s).length === 0;

export function plantNeedsMiss(s: PlantSetup): PlantNeedsMiss | undefined {
  const missing = plantMissing(s);
  if (missing.includes('sun')) return 'no_sun';
  if (missing.includes('water')) return 'no_water';
  if (missing.includes('soil')) return 'no_soil';
  if (s.extras.length) return 'gave_animal_things';
  return undefined;
}

// ── Animals in winter ─────────────────────────────────────────────────────────────────────────────────────

export const ANIMALS = ['bear', 'bird', 'squirrel', 'deer'] as const;
export type Animal = typeof ANIMALS[number];
export const WINTER_PLACES = ['den', 'south', 'hollow', 'meadow'] as const;
export type WinterPlace = typeof WINTER_PLACES[number];

export const WINTER_PLACE: Record<Animal, WinterPlace> = { bear: 'den', bird: 'south', squirrel: 'hollow', deer: 'meadow' };

/** What each place means, in words a child hears (the place names, never which animal goes there). */
export const PLACE_WORDS: Record<WinterPlace, string> = {
  den: 'the cave den on the hill',
  south: 'fly away south (the arrow at the edge of the tank)',
  hollow: 'the hollow in the big tree, full of stored nuts',
  meadow: 'stay out in the meadow',
};

/** Why each animal does its winter thing (said after a correct move). */
export const WINTER_WHY: Record<Animal, string> = {
  bear: 'There is not enough food in winter, so the bear sleeps in its den until spring.',
  bird: 'It is too cold and there are no bugs to eat, so the bird flies south where it is warm.',
  squirrel: 'The squirrel stored nuts in the fall. It stays snug in its tree and eats them.',
  deer: 'The deer grows a thick coat and stays, looking for twigs and bark to eat.',
};

export const SEASON_BEHAVIOR_MISSES = ECOSYSTEM_MISSES_BY_MODE.season_behavior;
export type SeasonBehaviorMiss = typeof SEASON_BEHAVIOR_MISSES[number];

/** `count` animals for one winter, bear or bird always in (the two with the clearest winter change). */
export function pickWinterAnimals(count: number, rng: () => number = Math.random): Animal[] {
  const anchor: Animal = rng() < 0.5 ? 'bear' : 'bird';
  const rest = shuffle(ANIMALS.filter(a => a !== anchor), rng);
  return shuffle([anchor, ...rest.slice(0, Math.max(0, count - 1))], rng);
}
