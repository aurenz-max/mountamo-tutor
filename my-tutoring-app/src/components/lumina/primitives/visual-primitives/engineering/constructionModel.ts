/**
 * Construction site diorama, the domain: the materials, the asks, the check and the misses. Pure (no three.js),
 * so the generator, the workspace module, the boss and the tests share one source.
 *
 * The task is to LOAD the dump truck with the right number of scoops and send it. The learner works the
 * excavator: tap the pile to dig a scoop, tap the truck to dump it (or, with an empty bucket, tap the truck to
 * take a scoop back out). Every scoop lands as its own mound in the bed, so a K-2 learner can count them.
 * Sending the truck is the check.
 * - K-2 (`units: 'scoops'`): the ask names the number of scoops. Counting the scoops while loading is the task.
 * - 3-5 (`units: 'tons'`): the ask gives the truck's limit and what one scoop weighs; the number of scoops is
 *   never on screen, and the weight in the bed shows only after the truck is sent.
 */
import type { ConstructionMiss } from './constructionSiteDiorama.card';

export const CONSTRUCTION_TASKS = ['load_truck'] as const;
export type ConstructionTask = typeof CONSTRUCTION_TASKS[number];

export type ConstructionBand = 'K-2' | '3-5';

export const MATERIALS = ['dirt', 'sand', 'gravel', 'rocks'] as const;
export type Material = typeof MATERIALS[number];

/** Code-owned: what one bucket scoop of each material weighs, in tons (kid-level; heavier stuff, heavier scoop). */
export const SCOOP_TONS: Record<Material, number> = { dirt: 2, sand: 3, gravel: 4, rocks: 5 };

/** Mounds the bed holds before a dump spills over the side: well past any key, so the bed never hints. */
export const BED_SLOTS = 12;

export interface LoadTruckChallenge {
  id: string;
  type: 'load_truck';
  material: Material;
  /** Where the load goes, e.g. "the new playground". Words only. */
  destination: string;
  units: 'scoops' | 'tons';
  /** The key: scoops in the bed when the truck is sent. Never reaches the tutor on a tons ask. */
  target: number;
  /** tons asks: the truck's limit (target × scoopTons) and one scoop's weight. */
  capacityTons?: number;
  scoopTons?: number;
  instruction: string;
}

export type ConstructionChallenge = LoadTruckChallenge;

export const scoopWord = (n: number) => `${n} scoop${n === 1 ? '' : 's'}`;
export const tonWord = (n: number) => `${n} ton${n === 1 ? '' : 's'}`;

export function loadInstruction(c: Omit<LoadTruckChallenge, 'id' | 'type' | 'instruction'>): string {
  if (c.units === 'scoops') {
    return `Put ${scoopWord(c.target)} of ${c.material} in the dump truck for ${c.destination}, then send the truck.`;
  }
  return `This truck can carry ${tonWord(c.capacityTons!)}. One scoop of ${c.material} weighs ${tonWord(c.scoopTons!)}. `
    + `Fill the truck for ${c.destination} as full as it can safely go, then send it.`;
}

export interface LoadNumbers { units: 'scoops' | 'tons'; material: Material; target: number }

function shuffle<T>(xs: readonly T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * `count` loads with different scoop counts, each material at least once before any repeats.
 * K-2: 2-7 scoops. 3-5: 3-8 scoops, so the limit runs from 6 to 40 tons.
 */
export function pickLoads(band: ConstructionBand, count: number, rng: () => number = Math.random): LoadNumbers[] {
  const targets = shuffle(band === 'K-2' ? [2, 3, 4, 5, 6, 7] : [3, 4, 5, 6, 7, 8], rng);
  const materials = shuffle(MATERIALS, rng);
  return Array.from({ length: count }, (_, i) => ({
    units: band === 'K-2' ? 'scoops' as const : 'tons' as const,
    material: materials[i % materials.length],
    target: targets[i % targets.length],
  }));
}

export function buildLoadChallenge(n: LoadNumbers, destination: string, id: string): LoadTruckChallenge {
  const scoopTons = SCOOP_TONS[n.material];
  const base = n.units === 'scoops'
    ? { material: n.material, destination, units: n.units, target: n.target }
    : { material: n.material, destination, units: n.units, target: n.target, scoopTons, capacityTons: n.target * scoopTons };
  return { id, type: 'load_truck', ...base, instruction: loadInstruction(base) };
}

// ── The check (the misses it names are the card's, `constructionSiteDiorama.card.ts`) ──

export const loadMatches = (c: LoadTruckChallenge, loaded: number) => loaded === c.target;

/** The named wrong load: one off (a counting slip) or further off. */
export function loadMiss(c: LoadTruckChallenge, loaded: number): ConstructionMiss | undefined {
  const d = loaded - c.target;
  if (d === 0) return undefined;
  if (d === -1) return 'one_short';
  if (d === 1) return 'one_over';
  return d < 0 ? 'too_few' : 'too_many';
}

/** "Loaded 4 scoops and sent the truck": the learner's work, in words. */
export const describeLoad = (loaded: number) => `Loaded ${scoopWord(loaded)} and sent the truck`;

/** What sending the truck showed. Names what is in the bed (the learner's work), never how many it needed. */
export function sendFeedback(c: LoadTruckChallenge, loaded: number): string {
  if (c.units === 'scoops') {
    if (loaded === c.target) return `Just right! The truck drives off to ${c.destination}.`;
    if (loaded === 0) return 'The truck is empty! Dig some ' + c.material + ' and dump it in the truck.';
    return loaded < c.target
      ? `The truck has ${scoopWord(loaded)}. The job needs more ${c.material}. Count the mounds in the truck.`
      : `The truck has ${scoopWord(loaded)}. That's too much ${c.material}! Count the mounds in the truck.`;
  }
  const tons = loaded * c.scoopTons!;
  if (loaded === c.target) return `The scale reads ${tonWord(tons)}. Full and safe! The truck drives off to ${c.destination}.`;
  if (loaded === 0) return 'The scale reads 0 tons. The truck is empty!';
  return tons < c.capacityTons!
    ? `The scale reads ${tonWord(tons)}. The truck can safely carry more. A truck that goes half empty makes extra trips.`
    : `The scale reads ${tonWord(tons)}. Too heavy! That is more than the ${tonWord(c.capacityTons!)} this truck can carry, and its springs squash flat.`;
}
