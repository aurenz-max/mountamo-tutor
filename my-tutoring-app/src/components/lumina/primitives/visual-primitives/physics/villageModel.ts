/**
 * Volcano Island's save-the-village build, pure: a height map of the island's slope, how lava flows over it from the
 * crater, the walls the learner can place, the items code builds, and the check. The map (`VolcanoIsland.tsx`) floods
 * the cells this file says the lava reaches, in the order it reaches them.
 *
 * Lava runs downhill: from the crater it moves into the lowest neighbouring ground it can reach, filling hollows, until
 * the eruption's lava is used up. A rock wall stops it, so a wall across the way the lava goes turns it aside. The
 * learner tests by erupting, sees where the lava goes, and moves the walls until the village is safe.
 */
import type { Rng, Tier } from './volcanoModel';

export const SIZE = 9;
export type Cell = number; // y * SIZE + x
export const cell = (x: number, y: number): Cell => y * SIZE + x;
export const xy = (c: Cell) => ({ x: c % SIZE, y: Math.floor(c / SIZE) });
const neighbours = (c: Cell): Cell[] => {
  const { x, y } = xy(c);
  return [[x, y + 1], [x - 1, y], [x + 1, y], [x, y - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < SIZE && b < SIZE).map(([a, b]) => cell(a, b));
};

export interface VillageChallenge {
  id: string;
  type: 'save_the_village';
  instruction: string;
  /** Ground height per cell, row by row from the crater's side (y = 0) to the shore (y = SIZE - 1). */
  heights: number[];
  crater: Cell;
  village: Cell[];
  /** How many cells of lava the eruption makes. */
  volume: number;
  /** The most walls the learner may place. */
  maxWalls: number;
  supportTier?: Tier;
  startLevers?: string[];
}

/**
 * Where the lava goes, in order: from the crater, always into the lowest cell next to the lava so far that is no higher
 * than the lava cell beside it, until the volume is used. Walls are never entered. Ties go to the lower row, then left.
 */
export function lavaPath(c: Pick<VillageChallenge, 'heights' | 'crater' | 'volume'>, walls: readonly Cell[] = []): Cell[] {
  const wall = new Set(walls);
  const done: Cell[] = [c.crater];
  const inLava = new Set(done);
  while (done.length < c.volume) {
    let best: Cell | null = null;
    for (const from of done) {
      for (const n of neighbours(from)) {
        if (inLava.has(n) || wall.has(n) || c.heights[n] > c.heights[from]) continue;
        if (best == null || c.heights[n] < c.heights[best] || (c.heights[n] === c.heights[best] && n > best)) best = n;
      }
    }
    if (best == null) break;
    done.push(best); inLava.add(best);
  }
  return done;
}

export const villageSafe = (c: VillageChallenge, walls: readonly Cell[]) => {
  const lava = new Set(lavaPath(c, walls));
  return !c.village.some(v => lava.has(v));
};

/** The fewest walls (up to `limit`) that keep the village safe, tried only on cells the lava can reach. */
export function fewestWalls(c: VillageChallenge, limit = 3): Cell[] | null {
  const candidates = lavaPath(c).filter(x => x !== c.crater && !c.village.includes(x));
  if (villageSafe(c, [])) return [];
  const pick = (k: number, start: number, chosen: Cell[]): Cell[] | null => {
    if (chosen.length === k) return villageSafe(c, chosen) ? chosen : null;
    for (let i = start; i < candidates.length; i++) {
      const r = pick(k, i + 1, [...chosen, candidates[i]]);
      if (r) return r;
    }
    return null;
  };
  for (let k = 1; k <= limit; k++) {
    const r = pick(k, 0, []);
    if (r) return r;
  }
  return null;
}

export const villageInstruction = (maxWalls: number) =>
  `Lava is coming! Place up to ${maxWalls} rock ${maxWalls === 1 ? 'wall' : 'walls'} so the lava misses the village. Erupt to test.`;

/** A random slope: high at the crater, falling toward the shore, with a few ridges and hollows. */
function randomMap(rng: Rng): number[] {
  const h = Array.from({ length: SIZE * SIZE }, (_, i) => 30 - 3 * xy(i).y + Math.floor(rng() * 2));
  const ridges = 2 + Math.floor(rng() * 2);
  for (let r = 0; r < ridges; r++) {
    const x0 = 1 + Math.floor(rng() * (SIZE - 2)), len = 3 + Math.floor(rng() * 4), y0 = 2 + Math.floor(rng() * 3);
    for (let k = 0; k < len && y0 + k < SIZE; k++) h[cell(x0, y0 + k)] += 6;
  }
  return h;
}

/**
 * One item. The village is two shore cells the lava reaches with no walls. Kept only when the fewest walls that save it
 * is the tier's number (easy 1, medium 2, hard 3) and that many walls are allowed (easy allows one spare).
 */
export function buildVillage(tier: Tier, rng: Rng, id: string): VillageChallenge | null {
  const need = tier === 'easy' ? 1 : tier === 'medium' ? 2 : 3;
  for (let attempt = 0; attempt < 400; attempt++) {
    const heights = randomMap(rng);
    const crater = cell(4, 0);
    const volume = 14 + Math.floor(rng() * 8);
    const reached = lavaPath({ heights, crater, volume }).filter(x => xy(x).y === SIZE - 1);
    if (!reached.length) continue;
    const v0 = reached[Math.floor(rng() * reached.length)];
    const pair = [v0, ...[v0 - 1, v0 + 1].filter(x => xy(x).y === SIZE - 1 && Math.abs(xy(x).x - xy(v0).x) === 1)].slice(0, 2);
    const c: VillageChallenge = { id, type: 'save_the_village', instruction: '', heights, crater, village: pair, volume, maxWalls: need + (tier === 'easy' ? 1 : 0) };
    const fix = fewestWalls(c, need);
    if (!fix || fix.length !== need) continue;
    return { ...c, instruction: villageInstruction(c.maxWalls) };
  }
  return null;
}

export function pickVillages(n: number, tier: Tier, rng: Rng, idPrefix = 'village'): VillageChallenge[] {
  const out: VillageChallenge[] = [];
  for (let i = 0; out.length < n && i < n * 4; i++) {
    const c = buildVillage(tier, rng, `${idPrefix}-${out.length + 1}`);
    if (c) out.push(c);
  }
  return out;
}

// ============================================================================
// The check
// ============================================================================

export type VillageMiss = 'walls_off_path' | 'lava_went_around';

export const villageMatches = (c: VillageChallenge, walls: readonly Cell[]) => walls.length <= c.maxWalls && villageSafe(c, walls);

/** The named miss: no wall is where the lava goes, else the lava went around the walls. */
export function villageMiss(c: VillageChallenge, walls: readonly Cell[]): VillageMiss | undefined {
  if (villageMatches(c, walls)) return undefined;
  const path = new Set(lavaPath(c));
  return walls.some(w => path.has(w)) ? 'lava_went_around' : 'walls_off_path';
}

export const describeVillage = (c: VillageChallenge, walls: readonly Cell[]) =>
  `placed ${walls.length} ${walls.length === 1 ? 'wall' : 'walls'}${walls.length ? ` at ${walls.map(w => `row ${xy(w).y + 1}, column ${xy(w).x + 1}`).join('; ')}` : ''}; `
  + `the lava ${villageSafe(c, walls) ? 'misses' : 'reaches'} the village`;

export function villageFeedback(c: VillageChallenge, walls: readonly Cell[]): string {
  const miss = villageMiss(c, walls);
  if (!miss) return 'The village is safe! Lava flows downhill, and your walls turned it aside before it got there.';
  if (miss === 'walls_off_path') return 'The lava reached the village. Erupt again and watch: which way does the lava go? Put a wall in its way.';
  return 'The lava went around your walls. Watch where it goes downhill next, and block that way too.';
}
