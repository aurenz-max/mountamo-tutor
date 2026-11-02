/**
 * The harbor's make-it-float test, pure: a piece of clay that sinks as a ball, the shapes the learner can press it
 * into, the items code builds, and the check. It is the step before build_boat: the stuff and its size are fixed, so
 * only the shape changes, and the clay weighs the same whatever its shape. A ball pushes aside little water and sinks;
 * the same clay with sides pushes aside more water than it weighs and floats. The boat numbers are `boatModel.ts`'s,
 * so the 3D tank floats or sinks the clay as this file decides.
 */
import type { Call, Rng, Tier } from './buoyancyModel';
import { HULL_SHAPES, capacity, hullMass, type BoatBuild, type HullShape, type HullSize } from './boatModel';

export interface ShapeChallenge {
  id: string;
  type: 'make_it_float';
  instruction: string;
  /** The piece of clay: small or big. It starts as a ball, which sinks. */
  size: HullSize;
  /** Pennies the clay must carry while it floats; 0 = float with nothing in it. */
  goal: number;
  /** Always clay: the stuff is fixed, so the shape is the only change. */
  materials: ['clay'];
  /** The lesson's support tier on this item: when the model levers come (`HARBOR_LEVERS.support`). */
  supportTier?: 'easy' | 'medium' | 'hard';
  /** Help levers drawn from the start (the tier's starting position). Not a pull: nothing is recorded. */
  startLevers?: string[];
}

export const clayOf = (c: Pick<ShapeChallenge, 'size'>, shape: HullShape): BoatBuild => ({ material: 'clay', shape, size: c.size });
export const clayGrams = (c: Pick<ShapeChallenge, 'size'>): number => hullMass(clayOf(c, 'ball'));

export function shapeInstruction(goal: number): string {
  return goal ? `This ball of clay sinks. Change only its shape so it floats carrying ${goal} ${goal === 1 ? 'penny' : 'pennies'}.`
    : 'This ball of clay sinks. Change only its shape so it floats.';
}

export function makeShapeChallenge(id: string, size: HullSize, goal: number): ShapeChallenge {
  return { id, type: 'make_it_float', instruction: shapeInstruction(goal), size, goal, materials: ['clay'] };
}

/** The shapes of this clay that carry the goal. */
export const passingShapes = (c: Pick<ShapeChallenge, 'size' | 'goal'>): HullShape[] =>
  HULL_SHAPES.filter(s => capacity(clayOf(c, s)) >= c.goal);

/**
 * Every item a tier allows. Easy: float it empty (low or tall sides pass). Medium: carry a load low sides can still
 * take. Hard: a load only tall sides carry. The ball and the flat sheet sink at every tier.
 */
export function shapeCandidates(tier: Tier): Array<{ size: HullSize; goal: number }> {
  const out: Array<{ size: HullSize; goal: number }> = [];
  for (const size of ['small', 'big'] as const) {
    const low = capacity(clayOf({ size }, 'low_sides')), tall = capacity(clayOf({ size }, 'tall_sides'));
    if (tier === 'easy') out.push({ size, goal: 0 });
    if (tier === 'medium') for (let g = 1; g <= low; g++) out.push({ size, goal: g });
    if (tier === 'hard') for (let g = low + 1; g <= tall; g++) out.push({ size, goal: g });
  }
  return out;
}

/** N items from the tier's candidates, no item twice until they run out, goals rising through the session. */
export function pickShapeChallenges(n: number, tier: Tier, rng: Rng, idPrefix = 'shape'): ShapeChallenge[] {
  const pool = [...shapeCandidates(tier)];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const chosen = Array.from({ length: n }, (_, i) => pool[i % pool.length]).sort((a, b) => a.goal - b.goal);
  return chosen.map(({ size, goal }, i) => makeShapeChallenge(`${idPrefix}-${i + 1}`, size, goal));
}

// ============================================================================
// The check
// ============================================================================

export type ShapeMiss = 'kept_a_lump' | 'flat_sinks' | 'sides_too_low';

export const shapeMatches = (c: ShapeChallenge, shape: HullShape): boolean => capacity(clayOf(c, shape)) >= c.goal;

/** The named miss: still a ball, pressed flat (still sinks), or sides too low for the load. */
export function shapeMiss(c: ShapeChallenge, shape: HullShape): ShapeMiss | undefined {
  if (shapeMatches(c, shape)) return undefined;
  return shape === 'ball' ? 'kept_a_lump' : shape === 'flat' ? 'flat_sinks' : 'sides_too_low';
}

const SHAPE_WORDS: Record<HullShape, string> = {
  ball: 'a ball', flat: 'a flat sheet', low_sides: 'a boat with low sides', tall_sides: 'a boat with tall sides',
};
export const shapeWords = (shape: HullShape): string => SHAPE_WORDS[shape];

/** The learner's shape and guess in words, never what it carries. */
export const describeShape = (shape: HullShape, guess: Call | null): string =>
  `shaped the clay into ${shapeWords(shape)}${guess ? ` (guessed it would ${guess === 'floats' ? 'float' : 'sink'})` : ''}`;

export function shapeFeedback(c: ShapeChallenge, shape: HullShape): string {
  const miss = shapeMiss(c, shape);
  if (!miss) {
    return `It floats${c.goal ? ` with all ${c.goal} ${c.goal === 1 ? 'penny' : 'pennies'}` : ''}! It is the same clay, just as heavy, `
      + `but ${shapeWords(shape)} pushes a lot more water out of the way, and the water pushes back up.`;
  }
  if (miss === 'kept_a_lump') return 'A ball of clay sinks: it only pushes a little water out of the way. How could you change its shape?';
  if (miss === 'flat_sinks') return 'Flat clay still sinks. The water comes over the top. What could keep the water out?';
  return `It floats, but ${c.goal} ${c.goal === 1 ? 'penny is' : 'pennies are'} too many for these sides. How could it push away more water?`;
}
