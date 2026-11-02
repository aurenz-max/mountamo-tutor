/**
 * The in-item levers on a buoyancy-harbor item, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/buoyancy-harbor-levers-2026-10-29.md). No real-learner evidence yet: the misses are what
 * `dropTestMiss` and `boatMiss` observe, and the documented misconception (big things sink, small things float). Every
 * help lever is a drawing in the 3D tank, for K-2 pre-readers; every easier item has the id `<item>~easier`.
 *
 * - `xray` (marks, both modes): a red arrow down (the weight) and a blue arrow up (the water's push) on everything in
 *   the water. A floater's two arrows match; a sinker's blue arrow is short. Only on what the learner has already put in
 *   the water: the mystery is never in the tank before a right call, so it never gets arrows early.
 * - `material_tags` (legend, drop_test): a coloured tag with the material's word over every thing, all three alike.
 * - `side_by_side` (model, drop_test): a small and a big thing of one other stuff, dropped at the back of the tank; both
 *   do the same. Never the item's materials.
 * - `solved_boat` (model, build_boat): two model boats of one stuff at the tank's sides, a lump that sinks and a boat
 *   with sides that floats with a few pennies. The model boat never carries the item's goal from the item's materials.
 * - `one_step_less` (easier, every mode): an ungraded drop test whose sizes match what the eye expects, with none of the
 *   item's things or stuff; the same boat task with half the pennies; or one food alone to float (the lightest food the
 *   item asks to float, or a lighter food when the item has one).
 *
 * make_it_float's misses are answered by `xray` (on the clay in the water: a ball's blue arrow is short) and
 * `one_step_less` (the same clay, floating with nothing in it; none on an item that already carries nothing).
 *
 * salt_water's misses are answered by `xray` (the water's push grows with each spoon) and `one_step_less`.
 * find_the_rule's by `xray` on the tests, `material_tags`, `side_by_side` (a small and a big thing of other stuff do the
 * same) and `one_step_less` (one thing to sort, sized as the eye expects, none of the item's stuff).
 *
 * cargo_two_designs' misses are answered by `penny_rows` (layout: each tested boat's pennies drawn as a row of dots,
 * boat A's above boat B's), `changes_marked` (marks: every part where boat B differs from boat A is marked in the build
 * panel) and `one_step_less` (both boats built, one change apart: predict, test and say).
 *
 * When the model levers come is the lesson's support tier (`support`; medium when it has none).
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { BUOYANCY_MISSES_BY_MODE } from './buoyancyHarbor.card';
import {
  MATERIAL_WORD, THINGS, buildDropTest, floats, mysteryPool, seeded, sizeSurprise, thingByKey,
  type BuoyancyChallenge, type DropTestChallenge, type HarborThing, type Material,
} from './buoyancyModel';
import {
  MATERIAL_LABEL, allBuilds, boatInstruction, capacity, type BoatBuild, type BoatChallenge, type HullMaterial,
} from './boatModel';
import { FOODS, makeSaltChallenge, spoonsToFloat, type SaltChallenge } from './saltModel';
import { buildRuleChallenge, ruleInstruction, type RuleChallenge } from './ruleModel';
import { makeShapeChallenge, type ShapeChallenge } from './shapeModel';
import { cargoFair, cargoInstruction, changedParts, held, oneChangeAway, type CargoChallenge } from './cargoModel';

export const XRAY_LEVER = 'xray';
export const TAGS_LEVER = 'material_tags';
export const SIDE_BY_SIDE_LEVER = 'side_by_side';
export const SOLVED_BOAT_LEVER = 'solved_boat';
export const EASIER_LEVER = 'one_step_less';
export const PENNY_ROWS_LEVER = 'penny_rows';
export const CHANGES_LEVER = 'changes_marked';

export const PRACTICE_SUFFIX = '~easier';
export const isPractice = (c: Pick<BuoyancyChallenge, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);
export const PRACTICE_NOTE = 'An easier practice item, ungraded; the full item comes back after it.';

/** What the screen shows that a lever needs: tests that have settled, and whether the boat is in the water. */
export interface HarborLeverCtx { settledTests: number; boatLaunched: boolean }

const isDrop = (c: BuoyancyChallenge): c is DropTestChallenge => c.type === 'drop_test';
const isBoat = (c: BuoyancyChallenge): c is BoatChallenge => c.type === 'build_boat';
const isSalt = (c: BuoyancyChallenge): c is SaltChallenge => c.type === 'salt_water';
const isRule = (c: BuoyancyChallenge): c is RuleChallenge => c.type === 'find_the_rule';
const isCargo = (c: BuoyancyChallenge): c is CargoChallenge => c.type === 'cargo_two_designs';
const isShape = (c: BuoyancyChallenge): c is ShapeChallenge => c.type === 'make_it_float';
/** A hull in the water (a boat, or the clay being shaped): its arrows are drawn on the hull. */
const isHull = (c: BuoyancyChallenge) => isBoat(c) || isShape(c);
type Sorting = DropTestChallenge | RuleChallenge;
const itemThings = (c: Sorting): HarborThing[] => (isRule(c) ? [...c.tested, ...c.toSort] : [...c.tested, c.mystery]);
const itemMaterials = (c: Sorting): Set<Material> => new Set(itemThings(c).map(t => t.material));
/** The thing decided without a test: the mystery, or a rule item's first thing to sort whose size fools the eye. */
const decided = (c: Sorting): HarborThing => (isRule(c) ? c.toSort.find(sizeSurprise) ?? c.toSort[0] : c.mystery);

// ── side_by_side: a small and a big thing of one other stuff ──────────────────
/** Same-stuff pairs, small then big, in the order they are offered. */
const PAIRS: ReadonlyArray<[string, string]> = [
  ['twig', 'log'], ['paper-clip', 'wrench'], ['pebble', 'boulder'], ['foam-peanut', 'pool-noodle'],
  ['ice-cube', 'ice-block'], ['birthday-candle', 'big-candle'], ['cork', 'cork-board'],
];
/** The pair for a drop test or rule item: made of none of the item's stuff, and, where one exists, the size fools the
 *  eye the way the decided thing's does (a sinker's pair for a small sinker). Null when no pair is left. */
export function sameStuffPair(c: Sorting): [HarborThing, HarborThing] | null {
  if (isPractice(c)) return null;
  const used = itemMaterials(c);
  const pairs = PAIRS.map(([a, b]) => [thingByKey(a)!, thingByKey(b)!] as [HarborThing, HarborThing])
    .filter(([a]) => !used.has(a.material));
  return pairs.find(([a]) => floats(a) === floats(decided(c))) ?? pairs[0] ?? null;
}
/** Leak rule: the pair is one stuff, two sizes, and shares no stuff with the item. */
export const pairLeaks = (c: Sorting, pair: readonly HarborThing[]): boolean =>
  pair.length !== 2 || pair[0].material !== pair[1].material || pair[0].size === pair[1].size || itemMaterials(c).has(pair[0].material);

// ── solved_boat: a lump and a boat with sides, of one stuff ───────────────────
export interface ModelBoats { boats: [{ build: BoatBuild; pennies: number }, { build: BoatBuild; pennies: number }] }
const MODEL_CANDIDATES: readonly BoatBuild[] = [
  { material: 'clay', shape: 'low_sides', size: 'small' }, { material: 'clay', shape: 'tall_sides', size: 'small' },
  { material: 'foil', shape: 'low_sides', size: 'small' }, { material: 'clay', shape: 'low_sides', size: 'big' },
  { material: 'foil', shape: 'tall_sides', size: 'small' },
];
/** Leak rule: a model boat that, built from the item's stuff, carries the item's goal would solve the item. */
export const modelBoatLeaks = (c: BoatChallenge, b: BoatBuild): boolean =>
  c.materials.includes(b.material) && capacity(b) >= c.goal;
export function solvedBoats(c: BoatChallenge): ModelBoats | null {
  if (isPractice(c)) return null;
  const sided = MODEL_CANDIDATES.find(b => !modelBoatLeaks(c, b) && capacity(b) >= 1);
  if (!sided) return null;
  const lump: BoatBuild = { material: sided.material, shape: 'ball', size: sided.size };
  return { boats: [{ build: lump, pennies: 0 }, { build: sided, pennies: Math.min(3, capacity(sided)) }] };
}

// ── one_step_less: the easier practice item ───────────────────────────────────
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** An easy drop test (the size matches what the eye expects) with none of the item's things or stuff. */
export function easierDropTest(c: DropTestChallenge): DropTestChallenge | null {
  if (isPractice(c)) return null;
  const used = itemMaterials(c);
  const itemStuff = new Set(THINGS.filter(t => used.has(t.material)).map(t => t.key));
  const rng = seeded(hash(c.id + c.mystery.key));
  const pool = mysteryPool('easy', !floats(c.mystery)).filter(t => !used.has(t.material));
  for (const m of pool) {
    const p = buildDropTest(m, 'easy', rng, `${c.id}${PRACTICE_SUFFIX}`, itemStuff);
    if (!practiceLeaks(c, p)) return p;
  }
  return null;
}
/** The same boat task with half the pennies (at least one), never the item's goal. */
export function easierBoat(c: BoatChallenge): BoatChallenge | null {
  if (isPractice(c) || c.goal < 2) return null;
  const goal = Math.max(1, Math.floor(c.goal / 2));
  return { id: `${c.id}${PRACTICE_SUFFIX}`, type: 'build_boat', goal, materials: [...c.materials], instruction: boatInstruction(goal, c.materials) };
}
/** The same clay floating with nothing in it; none when the item already carries nothing. */
export function easierShape(c: ShapeChallenge): ShapeChallenge | null {
  if (isPractice(c) || c.goal === 0) return null;
  return makeShapeChallenge(`${c.id}${PRACTICE_SUFFIX}`, c.size, 0);
}
/** One food alone to float: the lightest food the item asks to float, or, on a one-food item, the next lighter food. */
export function easierSalt(c: SaltChallenge): SaltChallenge | null {
  if (isPractice(c)) return null;
  const id = `${c.id}${PRACTICE_SUFFIX}`;
  if (c.things.length > 1) {
    const t = c.things.filter(f => c.floatGoal.includes(f.key)).sort((a, b) => spoonsToFloat(a) - spoonsToFloat(b))[0];
    return makeSaltChallenge(id, [t], [t.key], []);
  }
  const lighter = FOODS.filter(f => spoonsToFloat(f) < spoonsToFloat(c.things[0]));
  const t = lighter[lighter.length - 1];
  return t ? makeSaltChallenge(id, [t], [t.key], []) : null;
}
/** One thing to sort, sized as the eye expects, beside two tests: none of the item's things or stuff. */
export function easierRule(c: RuleChallenge): RuleChallenge | null {
  if (isPractice(c)) return null;
  const used = itemMaterials(c);
  const rng = seeded(hash(c.id + c.toSort.map(t => t.key).join()));
  for (let i = 0; i < 60; i++) {
    const p = buildRuleChallenge('easy', rng, `${c.id}${PRACTICE_SUFFIX}`);
    if (!p || itemThings(p).some(t => used.has(t.material))) continue;
    // Keep the thing to sort beside the surprise test's other stuff, so that test still shows size does not decide.
    const keep = p.toSort.find(s => p.tested.some(t => t.material !== s.material && sizeSurprise(t))) ?? p.toSort[0];
    const easier = { ...p, toSort: [keep], instruction: ruleInstruction(p.tested, [keep]) };
    if (!practiceLeaks(c, easier)) return easier;
  }
  return null;
}
/** Both boats built for the learner, one change apart with a clear difference, from the item's materials: predict,
 *  test both and say which carried more. Never the item's own boat A. */
export function easierCargo(c: CargoChallenge): CargoChallenge | null {
  if (isPractice(c) || c.givenB) return null;
  const rng = seeded(hash(c.id + c.materials.join()));
  const pairs = allBuilds(c.materials).flatMap(a => oneChangeAway(a, c.materials).map(b => [a, b] as const))
    .filter(([a, b]) => held(a) >= 1 && Math.abs(held(a) - held(b)) >= 2
      && !(c.given && changedParts(a, c.given).length === 0));
  if (!pairs.length) return null;
  const [a, b] = pairs[Math.floor(rng() * pairs.length)];
  const base = { id: `${c.id}${PRACTICE_SUFFIX}`, type: 'cargo_two_designs' as const, materials: [...c.materials],
    given: a, givenB: b, oneChange: false, question: null };
  return { ...base, instruction: cargoInstruction(base) };
}
export const practiceItem = (c: BuoyancyChallenge): BuoyancyChallenge | null =>
  (isDrop(c) ? easierDropTest(c) : isRule(c) ? easierRule(c) : isBoat(c) ? easierBoat(c) : isShape(c) ? easierShape(c) : isCargo(c) ? easierCargo(c) : easierSalt(c));

/** Leak rule for the easier item: same mode, not the item, nothing of the item's on screen, and simpler. */
export function practiceLeaks(parent: BuoyancyChallenge, p: BuoyancyChallenge): boolean {
  if (p.id === parent.id || p.type !== parent.type) return true;
  if (isBoat(parent) && isBoat(p)) return p.goal >= parent.goal;
  if (isShape(parent) && isShape(p)) return p.goal >= parent.goal || p.size !== parent.size;
  if (isCargo(parent) && isCargo(p)) return !p.given || !p.givenB || !!parent.givenB || !cargoFair(p)
    || (!!parent.given && changedParts(p.given, parent.given).length === 0);
  if (isSalt(parent) && isSalt(p)) {
    return p.things.length !== 1 || p.sinkGoal.length > 0
      || (parent.things.length === 1 && spoonsToFloat(p.things[0]) >= spoonsToFloat(parent.things[0]));
  }
  if (isRule(parent) && isRule(p)) {
    const used = itemMaterials(parent);
    return p.toSort.length >= parent.toSort.length || itemThings(p).some(t => used.has(t.material));
  }
  if (isDrop(parent) && isDrop(p)) {
    const used = itemMaterials(parent);
    return [...p.tested, p.mystery].some(t => used.has(t.material)) || p.mystery.size === (floats(p.mystery) ? 'big' : 'small');
  }
  return true;
}

export const practiceParent = (itemId: string | null | undefined, challenges: readonly BuoyancyChallenge[]) =>
  itemId?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === itemId) ?? null : null;

// ── The set ───────────────────────────────────────────────────────────────────
const DROP_MISSES = BUOYANCY_MISSES_BY_MODE.drop_test;
const BOAT_MISSES = BUOYANCY_MISSES_BY_MODE.build_boat;
const SALT_MISSES = BUOYANCY_MISSES_BY_MODE.salt_water;
const RULE_MISSES = BUOYANCY_MISSES_BY_MODE.find_the_rule;
const CARGO_MISSES = BUOYANCY_MISSES_BY_MODE.cargo_two_designs;
const SHAPE_MISSES = BUOYANCY_MISSES_BY_MODE.make_it_float;
const notPractice = (c: BuoyancyChallenge) => (isPractice(c) ? null : true);
const did = (t: HarborThing) => (floats(t) ? 'float' : 'sink');

export const HARBOR_LEVERS = leverSet<BuoyancyChallenge, HarborLeverCtx>({
  modeOf: c => c.type,
  missesOf: mode => (mode === 'build_boat' ? BOAT_MISSES : mode === 'make_it_float' ? SHAPE_MISSES : mode === 'salt_water' ? SALT_MISSES
    : mode === 'find_the_rule' ? RULE_MISSES : mode === 'cargo_two_designs' ? CARGO_MISSES : DROP_MISSES),
  support: {
    tier: c => c.supportTier ?? 'medium',
    different: c => (isDrop(c) || isRule(c) ? 'two other things of one stuff, a small one and a big one'
      : isBoat(c) ? 'two model boats that are not this boat' : isShape(c) ? 'the same clay floating with nothing in it'
        : 'one food alone to float'),
    own: c => (isDrop(c) ? 'whether the mystery thing floats or sinks' : isRule(c) ? 'how the things on the stands sort, and why'
      : isBoat(c) ? 'which boat carries this many pennies' : isShape(c) ? 'which shape of this clay floats with this load'
      : 'how much salt makes these foods float and keeps the others down'),
  },
  specs: [
    { id: XRAY_LEVER, type: 'marks', modes: ['drop_test', 'find_the_rule', 'make_it_float', 'build_boat', 'salt_water'],
      answers: ['judged_by_size', 'wrong_call', 'sorted_by_size', 'kept_a_lump', 'flat_sinks', 'sides_too_low', 'sinks_empty',
        'no_sides', 'too_small', 'too_little_salt', 'too_much_salt'],
      answersOn: c => (isDrop(c) ? ['judged_by_size', 'wrong_call'] : isRule(c) ? ['sorted_by_size']
        : isBoat(c) ? [...BOAT_MISSES] : isShape(c) ? [...SHAPE_MISSES] : [...SALT_MISSES]),
      when: c => (isDrop(c) || isRule(c) ? 'The learner decides by size, or does not use what the tests did.'
        : isHull(c) ? 'The boat sinks or carries too few pennies, and the learner cannot see why.'
          : 'The learner does not see that the salt changes how hard the water pushes up.'),
      does: c => (!isHull(c)
        ? 'Draws a red arrow down (the weight) and a blue arrow up (the water\'s push) on each thing in the water, with no '
          + 'words. On a thing that floats the two are the same length; on a thing that sank the blue one is short.'
          + (isSalt(c) ? ' Each spoon of salt makes the blue arrows longer.' : '')
        : 'Draws a red arrow down (the boat and its pennies) and a blue arrow up (the water\'s push) on the boat in the water, '
          + 'with no words. While it floats the two match; when it sinks the blue one is shorter.'),
      content: notPractice,
      offer: (c, ctx) => (isHull(c) ? ctx.boatLaunched : ctx.settledTests > 0),
      fact: (_content, c) => (!isHull(c)
        ? 'Arrows are drawn on each thing in the water: red down for its weight, blue up for the water\'s push. On a thing '
          + 'that floats they are the same length; on a thing that sank the blue arrow is shorter.'
          + (isSalt(c) ? ' Salt in the water makes the blue arrows longer.' : '')
        : 'Arrows are drawn on the boat in the water: red down for the boat and its pennies, blue up for the water\'s push. '
          + 'While it floats they match; when it sinks the blue arrow is shorter.') },
    { id: TAGS_LEVER, type: 'legend', modes: ['drop_test', 'find_the_rule'], answers: ['other_thing', 'sort_slip'],
      answersOn: c => (isRule(c) ? ['sort_slip'] : ['other_thing']),
      when: c => (isRule(c) ? 'The learner sorts a thing without matching it to the test made of its stuff.'
        : 'The learner picks a test made of different stuff as the one that tells.'),
      does: c => `Puts a coloured tag with its material's word over every thing, ${isRule(c) ? 'the tests and the things on the stands' : 'the mystery and both tests'} alike.`,
      content: notPractice,
      fact: (_content, c) => `A coloured tag over every thing (${isRule(c) ? 'the tests and the things on the stands' : 'both tests and the mystery'} alike) shows what it is made of.` },
    { id: SIDE_BY_SIDE_LEVER, type: 'model', modes: ['drop_test', 'find_the_rule'],
      answers: ['judged_by_size', 'wrong_call', 'sorted_by_size', 'wrong_rule'],
      answersOn: c => (isRule(c) ? ['sorted_by_size', 'wrong_rule'] : ['judged_by_size', 'wrong_call']),
      when: c => (isRule(c) ? 'The learner sorts by size, or thinks size or weight decides it.'
        : 'The learner thinks big things sink and small things float.'),
      does: 'Drops two extra things of one stuff, a small one and a big one, at the back of the tank: both do the same. '
        + 'They are made of other stuff than this item\'s things.',
      content: c => (isDrop(c) || isRule(c) ? sameStuffPair(c) : null),
      fact: (pair: [HarborThing, HarborThing]) => `At the back of the tank, a ${pair[0].name} and a ${pair[1].name}, both `
        + `made of ${MATERIAL_WORD[pair[0].material]}, were dropped: both ${did(pair[0])}. They are not part of this item.` },
    { id: SOLVED_BOAT_LEVER, type: 'model', modes: ['build_boat'], answers: ['sinks_empty', 'no_sides'],
      when: 'The learner\'s build has no sides (a ball or a flat piece), so it sinks or holds nothing.',
      does: 'Puts two model boats of one stuff in the tank, at its sides: a lump that sinks and a boat with sides that floats '
        + 'with a few pennies. Not this item\'s goal.',
      content: c => (isBoat(c) ? solvedBoats(c) : null),
      fact: (m: ModelBoats) => {
        const [lump, boat] = m.boats;
        const mat = MATERIAL_LABEL[boat.build.material as HullMaterial];
        return `Two model boats are in the tank, not this item: a ${lump.build.size} lump of ${mat} `
          + `${capacity(lump.build) < 0 ? 'on the bottom' : 'floating with nothing in it'}, and the same ${mat} shaped with `
          + `${boat.build.shape === 'tall_sides' ? 'tall' : 'low'} sides floating with ${boat.pennies} `
          + `${boat.pennies === 1 ? 'penny' : 'pennies'}.`;
      } },
    { id: PENNY_ROWS_LEVER, type: 'layout', modes: ['cargo_two_designs'], answers: ['kept_prediction', 'misread_results'],
      when: 'The learner says which boat carried more from the guess or a misread, not from the tests.',
      does: 'Draws the pennies each tested boat carried as a row of dots under the lab notebook, boat A above boat B.',
      content: notPractice,
      offer: (_c, ctx) => ctx.settledTests > 0,
      fact: 'Under the lab notebook, the pennies each tested boat carried are drawn as a row of dots, boat A above boat B.' },
    { id: CHANGES_LEVER, type: 'marks', modes: ['cargo_two_designs'], answers: ['changed_two', 'wrong_change'],
      when: 'Boat B changes more than one thing from boat A, or not the thing the question asks about.',
      does: 'Marks every part (what it is made of, shape, size) where boat B is different from boat A in the build panel.',
      content: notPractice,
      fact: 'In the build panel, every part where boat B is different from boat A is marked "changed".' },
    { id: EASIER_LEVER, type: 'easier', answers: 'all',
      when: c => (isDrop(c) ? 'The learner cannot yet use a test to decide about a mystery thing.'
        : isRule(c) ? 'The learner cannot yet sort untested things by what the tests showed.'
        : isCargo(c) ? 'The learner cannot yet run two boat tests and say what they showed.'
        : isBoat(c) ? 'The learner cannot yet build a boat that carries this many pennies.'
        : isShape(c) ? 'The learner cannot yet shape the clay to carry this load.'
          : 'The learner cannot yet get the right foods to float with the salt.'),
      does: c => (isDrop(c)
        ? 'Opens an easier drop test first, with things whose size matches what the eye expects. It is not graded; the full '
          + 'item comes back after it.'
        : isRule(c) ? 'Opens an easier sort first: two tests and one thing to sort, sized as the eye expects. It is not '
          + 'graded; the full item comes back after it.'
        : isCargo(c) ? 'Opens an easier comparison first: both boats are built, one change apart; the learner guesses, tests '
          + 'both and says which carried more. It is not graded; the full item comes back after it.'
        : isShape(c) ? 'Opens an easier shape test first: the same clay, to float with nothing in it. It is not graded; the '
          + 'full item comes back after it.'
        : isSalt(c) ? 'Opens an easier salt test first: one food alone to make float, in fresh water. It is not graded; the '
          + 'full item comes back after it.'
        : 'Opens an easier boat first: the same build with half as many pennies to carry. It is not graded; the full item '
          + 'comes back after it.'),
      content: c => practiceItem(c) },
  ],
});

/** What the 3D tank draws for the levers on screen (pulled, or the tier's starting position). */
export function leverDrawings(c: BuoyancyChallenge | null, on: (id: string) => boolean) {
  return {
    xray: on(XRAY_LEVER),
    tags: on(TAGS_LEVER),
    extras: c && (isDrop(c) || isRule(c)) && on(SIDE_BY_SIDE_LEVER) ? sameStuffPair(c) : null,
    modelBoats: c && isBoat(c) && on(SOLVED_BOAT_LEVER) ? solvedBoats(c)?.boats ?? null : null,
    pennyRows: !!c && isCargo(c) && on(PENNY_ROWS_LEVER),
    changes: !!c && isCargo(c) && on(CHANGES_LEVER),
  };
}
