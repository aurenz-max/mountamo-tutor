/**
 * Volcano Island's cool-the-rock test, pure: where lava cools, the rock it makes, the items code builds, and the check.
 * The rock tiles (`VolcanoIsland.tsx`) draw each rock's look (crystal size, glass, holes) from this file.
 *
 * The slower lava cools, the longer its crystals have to grow. Deep underground it cools very slowly into rock with big
 * crystals you can see (granite). On the surface it cools fast into rock with tiny crystals (basalt). Dropped in the sea
 * it cools so fast that no crystals grow: smooth glass (obsidian). Lava full of gas that cools fast keeps its bubbles as
 * holes (pumice, light enough to float). The learner cools samples, then decides where a new rock cooled from its look.
 */
import type { Rng, Tier } from './volcanoModel';

export type Cooling = 'underground' | 'surface' | 'sea';
export type RockKind = 'granite' | 'basalt' | 'obsidian' | 'pumice';
export interface Sample { cooling: Cooling; gassy: boolean }

export const rockOf = (s: Sample): RockKind =>
  s.cooling === 'underground' ? 'granite' : s.gassy ? 'pumice' : s.cooling === 'sea' ? 'obsidian' : 'basalt';

export const COOLING_WORDS: Record<Cooling, string> = {
  underground: 'deep underground (very slowly)', surface: 'on the surface (fast)', sea: 'in the sea (very fast)',
};
export const ROCK_LOOKS: Record<RockKind, string> = {
  granite: 'big crystals you can see', basalt: 'tiny crystals, too small to see', obsidian: 'smooth and glassy, no crystals',
  pumice: 'light and full of holes',
};
export const ROCK_NAMES: Record<RockKind, string> = { granite: 'granite', basalt: 'basalt', obsidian: 'obsidian', pumice: 'pumice' };

export interface RockChallenge {
  id: string;
  type: 'cool_the_rock';
  instruction: string;
  /** The lava samples the learner cools, each in its place. */
  tested: Sample[];
  /** The rock found on the island: the learner says where it cooled. */
  mystery: Sample;
  /** The places on offer for the call. */
  places: Cooling[];
  supportTier?: Tier;
  startLevers?: string[];
}

export const rockInstruction = (mystery: Sample) =>
  `Cool each lava sample and see what rock it makes. Then a rock is found on the island that is ${ROCK_LOOKS[rockOf(mystery)]}: where did it cool?`;

export function makeRock(id: string, tested: Sample[], mystery: Sample, places: Cooling[]): RockChallenge {
  return { id, type: 'cool_the_rock', instruction: rockInstruction(mystery), tested, mystery, places };
}

/** Fair: the tests show the mystery's rock, and every place on offer. */
export const rockFair = (c: Pick<RockChallenge, 'tested' | 'mystery' | 'places'>) =>
  c.tested.some(t => rockOf(t) === rockOf(c.mystery)) && c.places.every(p => c.tested.some(t => t.cooling === p))
  && c.places.includes(c.mystery.cooling);

const shuffle = <T,>(xs: readonly T[], rng: Rng): T[] => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

/**
 * One item. Easy: underground and sea (big crystals or glass), two places. Medium: all three places. Hard: all three
 * and a gassy sample that cools on the surface into pumice; the mystery may be pumice.
 */
export function buildRock(tier: Tier, rng: Rng, id: string): RockChallenge {
  const places: Cooling[] = tier === 'easy' ? ['underground', 'sea'] : ['underground', 'surface', 'sea'];
  const tested: Sample[] = places.map(cooling => ({ cooling, gassy: false }));
  if (tier === 'hard') tested.push({ cooling: 'surface', gassy: true });
  const mystery = { ...shuffle(tested, rng)[0] };
  return makeRock(id, shuffle(tested, rng), mystery, places);
}

export function pickRocks(n: number, tier: Tier, rng: Rng, idPrefix = 'rock'): RockChallenge[] {
  const out: RockChallenge[] = [];
  for (let i = 0; out.length < n && i < n * 10; i++) {
    const c = buildRock(tier, rng, `${idPrefix}-${out.length + 1}`);
    const kinds = new Set(out.map(x => rockOf(x.mystery)));
    if (i < n * 5 && kinds.has(rockOf(c.mystery)) && kinds.size < (tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4)) continue;
    out.push(c);
  }
  return out;
}

// ============================================================================
// The check
// ============================================================================

export type RockMiss = 'speed_swapped' | 'fast_mixup' | 'missed_bubbles';

export const rockMatches = (c: RockChallenge, call: Cooling | null) => call === c.mystery.cooling;

/** The named miss: slow called fast or fast called slow; the two fast places mixed up; or pumice's bubbles missed. */
export function rockMiss(c: RockChallenge, call: Cooling | null): RockMiss | undefined {
  if (rockMatches(c, call)) return undefined;
  if (c.mystery.gassy) return 'missed_bubbles';
  if ((call === 'underground') !== (c.mystery.cooling === 'underground')) return 'speed_swapped';
  return 'fast_mixup';
}

export const describeRock = (c: RockChallenge, call: Cooling | null) =>
  `said the rock that is ${ROCK_LOOKS[rockOf(c.mystery)]} cooled ${call ? COOLING_WORDS[call] : '(no call yet)'}`;

export function rockFeedback(c: RockChallenge, call: Cooling | null): string {
  const miss = rockMiss(c, call);
  if (!miss) {
    const k = rockOf(c.mystery);
    return k === 'granite' ? 'Yes! It cooled very slowly deep underground, so its crystals had time to grow big.'
      : k === 'basalt' ? 'Yes! It cooled fast on the surface, so its crystals stayed tiny.'
        : k === 'obsidian' ? 'Yes! The sea cooled it so fast that no crystals could grow: glass.'
          : 'Yes! Gassy lava cooled fast on the surface and kept its bubbles as holes.';
  }
  if (miss === 'speed_swapped') return 'Look at the crystals in your tests. Which place gave the lava time to grow big crystals?';
  if (miss === 'fast_mixup') return 'Both of those are fast. Look at your tests: which one made glass, and which made tiny crystals?';
  return 'Look at the holes. Which of your samples had lots of gas in it, and where did it cool?';
}
