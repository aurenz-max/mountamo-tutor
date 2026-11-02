/**
 * buoyancy-harbor's boss (`components/live-activity/boss.ts`), bespoke because build_boat is a build beside the taps:
 * after the tests in the 3D water tank the learner taps a float or sink call and the test that tells (or sorts untested
 * things and picks the rule), or builds a boat and presses I'm done!, and the activity's own check judges. The card is `buoyancyHarbor.card.ts`; this file
 * validates a lesson, lists its items, asks one and names the harness.
 */
import type { BuoyancyHarborData } from './BuoyancyHarbor';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { buoyancyHarborCard, type BuoyancyMiss } from './buoyancyHarbor.card';
import { BUOYANCY_TASKS, floats, thingByKey, type BuoyancyChallenge, type HarborThing } from './buoyancyModel';
import { HARBOR_LEVERS, practiceItem, practiceParent } from './buoyancyLevers';
import { HULL_MATERIALS, HULL_SHAPES, HULL_SIZES, MAX_PENNIES, allBuilds, capacity, type BoatBuild, type BoatChallenge } from './boatModel';
import { BOAT_PARTS, cargoFair, type CargoChallenge } from './cargoModel';
import { MAX_SPOONS, foodByKey, saltWindow, type SaltChallenge } from './saltModel';
import { ruleFair, type RuleChallenge } from './ruleModel';
import { passingShapes, type ShapeChallenge } from './shapeModel';

const known = (t: HarborThing | undefined): t is HarborThing => !!t && !!thingByKey(t.key) && thingByKey(t.key)!.material === t.material;

/** A boat item: a whole-number goal some build from its materials can carry. */
function validBoat(c: BoatChallenge): boolean {
  if (!Number.isInteger(c.goal) || c.goal < 1 || c.goal > MAX_PENNIES) return false;
  if (!Array.isArray(c.materials) || !c.materials.length || c.materials.some(m => !HULL_MATERIALS.includes(m))) return false;
  return allBuilds(c.materials).some(b => capacity(b) >= c.goal);
}

/** A salt item: 1-3 known foods, each in exactly one goal, every float-goal food floats at some salt that keeps the
 *  sink-goal foods down. */
function validSalt(c: SaltChallenge): boolean {
  const things = Array.isArray(c.things) ? c.things : [];
  if (!things.length || things.length > 3 || things.some(t => !t || foodByKey(t.key)?.density !== t.density)) return false;
  const keys = things.map(t => t.key);
  const goals = [...(c.floatGoal ?? []), ...(c.sinkGoal ?? [])];
  if (!c.floatGoal?.length || goals.length !== keys.length || new Set(goals).size !== goals.length || !goals.every(k => keys.includes(k))) return false;
  const [lo, hi] = saltWindow(c);
  return lo <= hi && hi <= MAX_SPOONS;
}

/** A rule item: 2-3 known tests and 1-2 known things to sort, each sharing its stuff with exactly one test in another
 *  size, and a test whose size fools the eye (`ruleFair`). At most five things fit on the pier. */
function validRule(c: RuleChallenge): boolean {
  const tested = Array.isArray(c.tested) ? c.tested : [], toSort = Array.isArray(c.toSort) ? c.toSort : [];
  if (tested.length < 2 || tested.length > 3 || toSort.length < 1 || toSort.length > 2) return false;
  return [...tested, ...toSort].every(known) && ruleFair(c);
}

/** A shape item: a known size of clay, a whole-number goal some shape of it carries, and a ball that sinks. */
function validShape(c: ShapeChallenge): boolean {
  if (!HULL_SIZES.includes(c.size) || !Number.isInteger(c.goal) || c.goal < 0) return false;
  if (!Array.isArray(c.materials) || c.materials.length !== 1 || c.materials[0] !== 'clay') return false;
  const ok = passingShapes(c);
  return ok.length > 0 && !ok.includes('ball');
}

const buildOf = (b: BoatBuild | null | undefined): b is BoatBuild =>
  !!b && HULL_MATERIALS.includes(b.material) && HULL_SHAPES.includes(b.shape) && HULL_SIZES.includes(b.size);

/** A two-boat item: known materials, a known boat A where one is given, a known question, and a fair comparison. */
function validCargo(c: CargoChallenge): boolean {
  if (!Array.isArray(c.materials) || !c.materials.length || c.materials.some(m => !HULL_MATERIALS.includes(m))) return false;
  if (c.given != null && !buildOf(c.given)) return false;
  if (c.givenB != null && !buildOf(c.givenB)) return false;
  if (c.question != null && !(BOAT_PARTS as readonly string[]).includes(c.question)) return false;
  return cargoFair(c);
}

/** Whether one item carries what its task needs, and its parts agree with the world model. */
function validItem(c: BuoyancyChallenge): boolean {
  if (!c || typeof c.id !== 'string' || !c.id || !(BUOYANCY_TASKS as readonly string[]).includes(c.type)) return false;
  if (typeof c.instruction !== 'string' || !c.instruction.trim()) return false;
  if (c.type === 'build_boat') return validBoat(c);
  if (c.type === 'make_it_float') return validShape(c);
  if (c.type === 'salt_water') return validSalt(c);
  if (c.type === 'find_the_rule') return validRule(c);
  if (c.type === 'cargo_two_designs') return validCargo(c);
  const [a, b] = Array.isArray(c.tested) ? c.tested : [];
  if (!known(a) || !known(b) || !known(c.mystery)) return false;
  // One test floats and one sinks; exactly one is made of the mystery's stuff; the mystery is not itself a test.
  if (floats(a) === floats(b)) return false;
  if ((a.material === c.mystery.material) === (b.material === c.mystery.material)) return false;
  return a.key !== c.mystery.key && b.key !== c.mystery.key;
}

/** Reject a harbor session the workspace cannot run. */
export function validateBuoyancyHarborData(value: unknown): BuoyancyHarborData {
  const d = value as BuoyancyHarborData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated harbor has no title.');
  const items = Array.isArray(d.challenges) ? d.challenges : [];
  if (!items.length || items.length > 12 || new Set(items.map(c => c?.id)).size !== items.length || items.some(c => !validItem(c)))
    throw new Error('Generated harbor has invalid lesson content.');
  return d;
}

export const buoyancyHarborBoss = defineBoss<BuoyancyHarborData, BuoyancyChallenge, BuoyancyMiss>({
  card: buoyancyHarborCard,
  validate: validateBuoyancyHarborData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // Taps, a build and the salt in the water, which the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: HARBOR_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/physics/BuoyancyHarbor.tsx',
    instanceId: 'harbor',
    defaults: { grade: 'Grade 1', mode: 'drop_test', topic: 'Sink or float: what decides it' },
    mounted: '[data-pip-object="workspace"]',
    // An easier item (`~easier`) is rebuilt from its parent with the same builder.
    current: ctx => {
      const challenges: BuoyancyChallenge[] = ctx.data.challenges ?? [];
      const parent = practiceParent(ctx.itemId, challenges);
      return parent ? practiceItem(parent) ?? undefined : challenges.find(c => c.id === ctx.itemId);
    },
    // The tests drop and the choices open only as the 3D tank (WebGL) runs, which the dry sweep's jsdom cannot draw
    // (journey-sweep-baseline: J1 by design); BuoyancyHarbor.workspace.test.tsx drives the commit through a stubbed scene.
    play: () => {
      throw new Error('Buoyancy-harbor runs a 3D tank, not driven at W1');
    },
  },
});
