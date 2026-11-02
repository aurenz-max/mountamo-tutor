/**
 * The harbor's two-boat comparison, pure: the items code builds and their check. The learner has two boats (boat A built
 * for them, or both their own), predicts which carries more pennies, tests each in the tank until it sinks, and says
 * which carried more. The prediction is never graded; the claim must match the tests. From medium the test must be fair
 * (boat B changes one thing from boat A), and at hard the item names the one thing to change.
 *
 * What a boat carries is `capacity` in `boatModel.ts`, the same number the tank shows when the learner loads it.
 */
import {
  HULL_SHAPES, HULL_SIZES, MATERIAL_LABEL, allBuilds, boatName, capacity,
  type BoatBuild, type BoatDraft, type HullMaterial,
} from './boatModel';
import type { Rng, Tier } from './buoyancyModel';

export const BOAT_PARTS = ['material', 'shape', 'size'] as const;
export type BoatPart = typeof BOAT_PARTS[number];
export const PART_LABEL: Record<BoatPart, string> = { material: 'what it is made of', shape: 'its shape', size: 'its size' };

export type Which = 'a' | 'b' | 'same';
export const WHICH_LABEL: Record<Which, string> = { a: 'Boat A', b: 'Boat B', same: 'The same' };

export interface CargoChallenge {
  id: string;
  type: 'cargo_two_designs';
  instruction: string;
  /** What the learner may build from. */
  materials: HullMaterial[];
  /** Boat A, built for the learner (easy, medium, practice). Null at hard: the learner builds both. */
  given: BoatBuild | null;
  /** Boat B, built for the learner: only on a practice item, which is just predict, test and say. */
  givenB?: BoatBuild | null;
  /** Boat B must change exactly one thing from boat A (medium, hard). */
  oneChange: boolean;
  /** Hard: the one thing the two boats must differ in, the question the test answers. */
  question: BoatPart | null;
  /** The lesson's support tier on this item: when the model levers come (`HARBOR_LEVERS.support`). */
  supportTier?: 'easy' | 'medium' | 'hard';
  /** Help levers drawn from the start (the tier's starting position). Not a pull: nothing is recorded. */
  startLevers?: string[];
}

/** The pennies a boat carried before it sank (a boat that sinks empty carried none). */
export const held = (b: BoatBuild): number => Math.max(0, capacity(b));
export const changedParts = (a: BoatBuild, b: BoatBuild): BoatPart[] => BOAT_PARTS.filter(p => a[p] !== b[p]);
export const sameBoat = (a: BoatDraft, b: BoatDraft): boolean => BOAT_PARTS.every(p => a[p] === b[p]);
/** Which boat carried more on its test. */
export const winner = (a: BoatBuild, b: BoatBuild): Which => (held(a) === held(b) ? 'same' : held(a) > held(b) ? 'a' : 'b');

const QUESTION_TEXT: Record<BoatPart, string> = {
  material: 'Does what a boat is made of change how many pennies it carries?',
  shape: 'Does a boat\'s shape change how many pennies it carries?',
  size: 'Does a bigger boat carry more pennies?',
};
const QUESTION_SAME: Record<BoatPart, string> = {
  material: 'the same except what they are made of', shape: 'the same except their shape', size: 'the same except their size',
};

export function cargoInstruction(c: Pick<CargoChallenge, 'given' | 'givenB' | 'oneChange' | 'question' | 'materials'>): string {
  const from = `You can use ${c.materials.map(m => MATERIAL_LABEL[m]).join(' or ')}.`;
  if (c.given && c.givenB) return `Boat A is ${boatName(c.given)} and boat B is ${boatName(c.givenB)}. Which carries more pennies? Test both and find out.`;
  if (c.question) return `${QUESTION_TEXT[c.question]} Build two boats that are ${QUESTION_SAME[c.question]}, test both, and say which carried more. ${from}`;
  if (c.oneChange) return `Boat A is ${boatName(c.given!)}. Build boat B by changing just one thing. Which carries more pennies? Test both and find out.`;
  return `Boat A is ${boatName(c.given!)}. Build boat B, a different boat. Which carries more pennies? Test both and find out. ${from}`;
}

// ============================================================================
// Items
// ============================================================================

const pick = <T,>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)];
const shuffle = <T,>(xs: readonly T[], rng: Rng): T[] => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};
const key = (b: BoatBuild) => `${b.material}:${b.shape}:${b.size}`;
/** The boats one change away from `a` that the materials allow. */
export const oneChangeAway = (a: BoatBuild, materials: readonly HullMaterial[]): BoatBuild[] => [
  ...materials.filter(m => m !== a.material).map(material => ({ ...a, material })),
  ...HULL_SHAPES.filter(s => s !== a.shape).map(shape => ({ ...a, shape })),
  ...HULL_SIZES.filter(z => z !== a.size).map(size => ({ ...a, size })),
];

/**
 * Whether code can judge the item fairly. A given boat A floats with a few pennies and some boat B the learner may build
 * carries more than it and some carries less, so "the new one wins" is never the rule. At hard the question part must
 * matter for some pair, and a material question needs two materials.
 */
export function cargoFair(c: CargoChallenge): boolean {
  if (!c.materials.length) return false;
  if (c.givenB) return !!c.given && changedParts(c.given, c.givenB).length === 1 && winner(c.given, c.givenB) !== 'same';
  if (c.question) {
    if (c.given || !c.oneChange) return false;
    if (c.question === 'material' && c.materials.length < 2) return false;
    return allBuilds(c.materials).some(a => oneChangeAway(a, c.materials).some(b => changedParts(a, b)[0] === c.question && winner(a, b) !== 'same'));
  }
  if (!c.given || !c.materials.includes(c.given.material)) return false;
  const h = held(c.given);
  if (h < 1) return false;
  const bs = c.oneChange ? oneChangeAway(c.given, c.materials) : allBuilds(c.materials).filter(b => !sameBoat(b, c.given!));
  return bs.some(b => held(b) > h) && bs.some(b => held(b) < h);
}

const MATERIAL_SETS: HullMaterial[][] = [['foil', 'clay'], ['clay', 'sticks'], ['foil', 'sticks'], ['foil', 'clay', 'sticks']];

/** N comparison items: easy and medium give boat A (a different one each time); hard asks a different question each time. */
export function pickCargoChallenges(n: number, tier: Tier, rng: Rng, idPrefix = 'cargo'): CargoChallenge[] {
  const out: CargoChallenge[] = [];
  if (tier === 'hard') {
    const questions = shuffle(BOAT_PARTS, rng);
    for (let i = 0; i < n; i++) {
      const question = questions[i % questions.length];
      const sets = MATERIAL_SETS.filter(s => question !== 'material' || s.length >= 2);
      const materials = [...pick(sets, rng)];
      const base = { id: `${idPrefix}-${i + 1}`, type: 'cargo_two_designs' as const, materials, given: null, oneChange: true, question };
      out.push({ ...base, instruction: cargoInstruction(base) });
    }
    return out;
  }
  const oneChange = tier === 'medium';
  const used = new Set<string>();
  for (let tries = 0; out.length < n && tries < 200; tries++) {
    const materials = [...pick(MATERIAL_SETS, rng)];
    const given = pick(allBuilds(materials), rng);
    if (used.has(key(given)) && tries < 150) continue;
    const base = { id: `${idPrefix}-${out.length + 1}`, type: 'cargo_two_designs' as const, materials, given, oneChange, question: null };
    const c: CargoChallenge = { ...base, instruction: cargoInstruction(base) };
    if (!cargoFair(c)) continue;
    used.add(key(given));
    out.push(c);
  }
  return out;
}

// ============================================================================
// The check
// ============================================================================

export interface CargoAnswer {
  a: BoatBuild;
  b: BoatBuild;
  /** Made before any test; never graded. */
  prediction: Which | null;
  claim: Which;
}
export type CargoMiss = 'changed_two' | 'wrong_change' | 'kept_prediction' | 'misread_results';

/** The named miss: an unfair test first (two things changed, or not the thing the question asks about), then a claim the
 *  tests do not show: the prediction kept against them, or the results read wrong. */
export function cargoMiss(c: CargoChallenge, x: CargoAnswer): CargoMiss | undefined {
  const changed = changedParts(x.a, x.b);
  if (c.oneChange && changed.length > 1) return 'changed_two';
  if (c.question && changed[0] !== c.question) return 'wrong_change';
  if (x.claim === winner(x.a, x.b)) return undefined;
  return x.claim === x.prediction ? 'kept_prediction' : 'misread_results';
}
export const cargoMatches = (c: CargoChallenge, x: CargoAnswer): boolean => !cargoMiss(c, x);

const pennies = (n: number) => `${n} ${n === 1 ? 'penny' : 'pennies'}`;
/** The learner's answer in words: their claim and the boats, never what the boats carry. */
export const describeCargo = (x: CargoAnswer): string =>
  `said ${x.claim === 'same' ? 'the two boats carried the same' : `${WHICH_LABEL[x.claim].toLowerCase()} carried more`} (boat A ${boatName(x.a)}, boat B ${boatName(x.b)})`;

export function cargoFeedback(c: CargoChallenge, x: CargoAnswer): string {
  const miss = cargoMiss(c, x);
  if (miss === 'changed_two') return 'You changed more than one thing. If boat B carries more, which change did it? Change just one thing.';
  if (miss === 'wrong_change') return `The question is about ${PART_LABEL[c.question!]}. Make the two boats the same except ${PART_LABEL[c.question!]}.`;
  if (miss === 'kept_prediction') return 'That was your guess before the tests. What did the tests show? Look at the lab notebook.';
  if (miss === 'misread_results') return 'Look at the lab notebook again: how many pennies did each boat carry before it sank?';
  const ha = held(x.a), hb = held(x.b);
  const changed = changedParts(x.a, x.b);
  const what = changed.length === 1 ? ` The only thing you changed was ${PART_LABEL[changed[0]]}, so that made the difference.` : '';
  if (ha === hb) return `Yes! Both boats carried ${pennies(ha)}.${changed.length === 1 ? ` Changing ${PART_LABEL[changed[0]]} made no difference here.` : ''}`;
  const [more, less] = ha > hb ? [['A', ha], ['B', hb]] as const : [['B', hb], ['A', ha]] as const;
  return `Yes! Boat ${more[0]} carried ${pennies(more[1])} and boat ${less[0]} carried ${pennies(less[1])}.${what}`;
}
