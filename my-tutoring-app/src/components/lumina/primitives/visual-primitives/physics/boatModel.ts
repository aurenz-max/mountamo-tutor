/**
 * The harbor's boat build, pure: what a learner can build a boat from, how many pennies each build carries before it
 * sinks, the build items code makes, and the check. The 3D tank (`buoyancy3d.ts`) floats the boat at the depth this
 * file computes, so what the learner sees is what this file decides.
 *
 * A boat floats while the water it can push aside weighs more than the boat and its load. A lump of clay pushes aside
 * little water and sinks; the same clay shaped with sides pushes aside much more and floats. Taller sides and a bigger
 * floor push aside more water, so the boat carries more pennies. Units: grams and cubic centimetres (water is 1 g/cm³).
 */
import type { Rng, Tier } from './buoyancyModel';

export type HullMaterial = 'foil' | 'clay' | 'sticks';
export type HullShape = 'ball' | 'flat' | 'low_sides' | 'tall_sides';
export type HullSize = 'small' | 'big';
export const HULL_MATERIALS: readonly HullMaterial[] = ['foil', 'clay', 'sticks'];
export const HULL_SHAPES: readonly HullShape[] = ['ball', 'flat', 'low_sides', 'tall_sides'];
export const HULL_SIZES: readonly HullSize[] = ['small', 'big'];

export interface BoatBuild { material: HullMaterial; shape: HullShape; size: HullSize }
/** A build in progress: any part may still be unchosen. */
export type BoatDraft = { [K in keyof BoatBuild]: BoatBuild[K] | null };
export const EMPTY_DRAFT: BoatDraft = { material: null, shape: null, size: null };
export const isBuilt = (d: BoatDraft): d is BoatBuild => !!d.material && !!d.shape && !!d.size;

/** One penny's mass. */
export const PENNY = 2.5;
/** The most pennies the tank's penny jar holds. */
export const MAX_PENNIES = 30;

/** Floor area (cm²) by size, and how high the water can reach up the hull before it pours in (cm) by shape. */
const FLOOR: Record<HullSize, number> = { small: 10, big: 20 };
const WALL: Record<HullShape, number> = { ball: 0, flat: 0.25, low_sides: 1.5, tall_sides: 3 };
/** The stuff itself: mass (g) and volume (cm³) of the piece the learner gets, by size. Clay 1.5 g/cm³, sticks 0.5. */
const HULL: Record<HullMaterial, { mass: Record<HullSize, number>; volume: Record<HullSize, number> }> = {
  foil: { mass: { small: 2, big: 3 }, volume: { small: 0.8, big: 1.2 } },
  clay: { mass: { small: 24, big: 36 }, volume: { small: 16, big: 24 } },
  sticks: { mass: { small: 6, big: 12 }, volume: { small: 12, big: 24 } },
};
/** Air a crumpled foil ball traps. */
const FOIL_BALL_AIR = 3;

/** The most water (g) the build can push aside before water comes in or it goes under. */
export function maxDisplaced(b: BoatBuild): number {
  const air = b.material === 'foil' && b.shape === 'ball' ? FOIL_BALL_AIR : 0;
  return FLOOR[b.size] * WALL[b.shape] + HULL[b.material].volume[b.size] + air;
}
export const hullMass = (b: BoatBuild): number => HULL[b.material].mass[b.size];
/** Whether the build floats carrying n pennies. */
export const floatsWith = (b: BoatBuild, n: number): boolean => hullMass(b) + n * PENNY <= maxDisplaced(b);
/** The most pennies it carries; -1 when it sinks empty. */
export function capacity(b: BoatBuild): number {
  const spare = maxDisplaced(b) - hullMass(b);
  return spare < 0 ? -1 : Math.min(MAX_PENNIES, Math.floor(spare / PENNY));
}
/** How much of its height sits under the water carrying n pennies (1 = full, and over 1 it sinks). */
export const draft = (b: BoatBuild, n: number): number => (hullMass(b) + n * PENNY) / maxDisplaced(b);
export const hasSides = (b: BoatBuild): boolean => b.shape === 'low_sides' || b.shape === 'tall_sides';

export const allBuilds = (materials: readonly HullMaterial[] = HULL_MATERIALS): BoatBuild[] =>
  materials.flatMap(material => HULL_SHAPES.flatMap(shape => HULL_SIZES.map(size => ({ material, shape, size }))));

// ============================================================================
// Words
// ============================================================================

export const MATERIAL_LABEL: Record<HullMaterial, string> = { foil: 'foil', clay: 'clay', sticks: 'craft sticks' };
export function shapeLabel(shape: HullShape, material: HullMaterial | null): string {
  if (shape === 'ball') return material === 'sticks' ? 'a bundle' : 'a ball';
  if (shape === 'flat') return material === 'sticks' ? 'a flat raft' : 'flat';
  return shape === 'low_sides' ? 'low sides' : 'tall sides';
}
/** "a big foil boat with tall sides", "a small lump of clay", "a big flat raft of craft sticks". */
export function boatName(b: BoatBuild): string {
  const mat = MATERIAL_LABEL[b.material];
  if (hasSides(b)) return `a ${b.size} ${mat} boat with ${shapeLabel(b.shape, b.material)}`;
  if (b.shape === 'ball') return b.material === 'sticks' ? `a ${b.size} bundle of craft sticks` : `a ${b.size} ${mat} ball`;
  return b.material === 'sticks' ? `a ${b.size} flat raft of craft sticks` : `a ${b.size} flat sheet of ${mat}`;
}

// ============================================================================
// Items
// ============================================================================

export interface BoatChallenge {
  id: string;
  type: 'build_boat';
  instruction: string;
  /** Pennies the boat must carry without sinking. */
  goal: number;
  /** What the learner may build from (2 or 3 of foil, clay, craft sticks). */
  materials: HullMaterial[];  /** The lesson's support tier on this item: when the model levers come (`HARBOR_LEVERS.support`). */
  supportTier?: 'easy' | 'medium' | 'hard';
  /** Help levers drawn from the start (the tier's starting position). Not a pull: nothing is recorded. */
  startLevers?: string[];
}

export const boatInstruction = (goal: number, materials: readonly HullMaterial[]): string =>
  `Build a boat that carries ${goal} pennies without sinking. You can use ${materials.map(m => MATERIAL_LABEL[m]).join(' or ')}.`;

const GOALS: Record<Tier, [number, number]> = { easy: [2, 5], medium: [4, 9], hard: [9, 15] };

/** The share of builds from these materials that carry the goal: some must, and most must not at hard. */
export function passingShare(goal: number, materials: readonly HullMaterial[]): number {
  const builds = allBuilds(materials);
  return builds.filter(b => capacity(b) >= goal).length / builds.length;
}

/**
 * N boat items: distinct goals inside the tier's range, rising through the session, each with a material set where
 * some builds carry the goal and (above easy) most do not. Hard leaves out the craft sticks, which float on their own.
 */
export function pickBoatChallenges(n: number, tier: Tier, rng: Rng, idPrefix = 'boat'): BoatChallenge[] {
  const [lo, hi] = GOALS[tier];
  const goals: number[] = [];
  for (let g = lo; g <= hi; g++) goals.push(g);
  for (let i = goals.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [goals[i], goals[j]] = [goals[j], goals[i]]; }
  const chosen = goals.slice(0, n);
  while (chosen.length < n) chosen.push(goals[chosen.length % goals.length]);
  chosen.sort((a, b) => a - b);
  const sets: HullMaterial[][] = tier === 'hard' ? [['foil', 'clay']]
    : [['foil', 'clay'], ['clay', 'sticks'], ['foil', 'clay', 'sticks'], ['foil', 'sticks']];
  const maxShare = tier === 'easy' ? 1 : tier === 'medium' ? 0.5 : 0.35;
  return chosen.map((goal, i) => {
    const ok = sets.filter(s => { const p = passingShare(goal, s); return p > 0 && p <= maxShare; });
    const materials = [...(ok.length ? ok : sets)[Math.floor(rng() * (ok.length || sets.length))]];
    return { id: `${idPrefix}-${i + 1}`, type: 'build_boat', instruction: boatInstruction(goal, materials), goal, materials };
  });
}

// ============================================================================
// The check
// ============================================================================

export type BoatMiss = 'sinks_empty' | 'no_sides' | 'too_small';

export const boatMatches = (c: BoatChallenge, b: BoatBuild): boolean => capacity(b) >= c.goal;

/** The named miss: it sinks with nothing in it, it floats but has no sides to hold a load, or it is too small. */
export function boatMiss(c: BoatChallenge, b: BoatBuild): BoatMiss | undefined {
  const cap = capacity(b);
  if (cap >= c.goal) return undefined;
  if (cap < 0) return 'sinks_empty';
  return hasSides(b) ? 'too_small' : 'no_sides';
}

/** The learner's build in words, never what it carries. */
export const describeBoat = (b: BoatBuild): string => `built ${boatName(b)}`;

export function boatFeedback(c: BoatChallenge, b: BoatBuild): string {
  const miss = boatMiss(c, b);
  const name = boatName(b);
  if (!miss) return `It floats with all ${c.goal} pennies! ${name[0].toUpperCase()}${name.slice(1)} pushes a lot of water out of the way, and the water pushes back up.`;
  if (miss === 'sinks_empty') return `It sinks with nothing in it. A lump of ${MATERIAL_LABEL[b.material]} is heavier than the little bit of water it pushes away. Can you shape it so it pushes away more water?`;
  if (miss === 'no_sides') return `It floats, but where do the pennies go? With no sides, the water comes over the top. What shape could hold them?`;
  return `Good boat! It cannot carry ${c.goal} pennies yet. Test it to see how many it holds. How could it push away more water?`;
}
