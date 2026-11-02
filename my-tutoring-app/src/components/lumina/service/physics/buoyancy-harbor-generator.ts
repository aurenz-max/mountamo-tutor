import type { GenerationContext } from "../generation/generationContext";
import type { BuoyancyHarborData } from "../../primitives/visual-primitives/physics/BuoyancyHarbor";
import { resolveEvalModes, type ChallengeTypeDoc } from "../evalMode";
import {
  BUOYANCY_TASKS, pickDropTests, seeded, type BuoyancyBand, type BuoyancyChallenge, type BuoyancyTask, type Tier,
} from "../../primitives/visual-primitives/physics/buoyancyModel";
import { pickShapeChallenges } from "../../primitives/visual-primitives/physics/shapeModel";
import { pickBoatChallenges } from "../../primitives/visual-primitives/physics/boatModel";
import { pickSaltChallenges } from "../../primitives/visual-primitives/physics/saltModel";
import { pickRuleChallenges } from "../../primitives/visual-primitives/physics/ruleModel";
import { pickCargoChallenges } from "../../primitives/visual-primitives/physics/cargoModel";
import { XRAY_LEVER } from "../../primitives/visual-primitives/physics/buoyancyLevers";

export type { BuoyancyHarborData };

/**
 * Buoyancy harbor generator (Fork C, code-only: no content model call). Every item comes from the world models in
 * `buoyancyModel.ts` (drop tests), `ruleModel.ts` (find the rule), `shapeModel.ts` (make it float), `boatModel.ts` (boat builds), `cargoModel.ts` (two boats) and `saltModel.ts` (salt
 * water): the things, materials,
 * goals, results and the check. `config.difficulty` (the support tier) sets the structure: easy mysteries are sized as the
 * eye expects, easy boat goals are small and an easy salt item floats one food; hard mysteries fool the eye, hard goals
 * need a big boat with tall sides, and a hard salt item floats some of three foods with a window of one spoon. A fresh seed every call
 * varies the session. The mode is pinned or resolved from the lesson intent; unresolved (mixed) runs drop tests first.
 */

const SINGLE_COUNT: Record<BuoyancyTask, number> = { drop_test: 5, find_the_rule: 4, make_it_float: 4, build_boat: 4, cargo_two_designs: 1, salt_water: 4 };
const MIXED_COUNT: Record<BuoyancyTask, number> = { drop_test: 3, find_the_rule: 2, make_it_float: 1, build_boat: 2, cargo_two_designs: 1, salt_water: 2 };

const CHALLENGE_TYPE_DOCS: Record<BuoyancyTask, ChallengeTypeDoc> = {
  drop_test: {
    promptDoc: '"drop_test": test two everyday things in a tank of water, then decide whether a third thing made of the same stuff as one of them floats or sinks.',
    schemaDescription: "'drop_test' (test, then decide about a mystery thing)",
  },
  find_the_rule: {
    promptDoc: '"find_the_rule": test a few everyday things in water, then, without testing, sort things of the same stuff but another size into float or sink and say what decides it (what a thing is made of, not its size or weight).',
    schemaDescription: "'find_the_rule' (sort untested things and name what decides float or sink)",
  },
  make_it_float: {
    promptDoc: '"make_it_float": a ball of clay sinks; change only its shape (flat, low sides, tall sides) so the same clay floats, then carries a few pennies: a shape with sides pushes away more water.',
    schemaDescription: "'make_it_float' (reshape sinking clay so it floats)",
  },
  build_boat: {
    promptDoc: '"build_boat": build a boat from foil, clay or craft sticks (choosing its shape and size) that carries a number of pennies without sinking, testing it in the water.',
    schemaDescription: "'build_boat' (build a boat that carries pennies)",
  },
  cargo_two_designs: {
    promptDoc: '"cargo_two_designs": compare two boat designs: build boat B (and boat A at the top level), guess which carries more pennies, load each in the water until it sinks, and say which carried more from the tests; a fair test changes one thing.',
    schemaDescription: "'cargo_two_designs' (test two boats and compare the results)",
  },
  salt_water: {
    promptDoc: '"salt_water": drop foods (an egg, a grape, a potato) into fresh water, where they sink, then stir in salt one spoon at a time until the right foods float and the others stay on the bottom: salty water is heavier and pushes up harder.',
    schemaDescription: "'salt_water' (add salt until the right foods float)",
  },
};
const isTask = (t: string): t is BuoyancyTask => (BUOYANCY_TASKS as readonly string[]).includes(t);

const FRAMING: Record<Tier, { title: string; description: string }> = {
  easy: { title: "Sink or Float?", description: "Drop things into the harbor tank and see what floats. Then use your tests to decide about a mystery thing." },
  medium: { title: "Harbor Drop Tests", description: "Test things in the water, write what happens, and use your evidence to decide about each mystery thing." },
  hard: { title: "Big or Small, Float or Sink?", description: "Some things trick your eyes. Test, record, and let your evidence decide." },
};
const RULE_FRAMING: Record<Tier, { title: string; description: string }> = {
  easy: { title: "What Decides It?", description: "Test a few things, then sort the others without testing. What makes a thing float?" },
  medium: { title: "Find the Rule", description: "Test, then sort the things on the stands. Is it how big, how heavy, or what it is made of?" },
  hard: { title: "Tricky Sorting", description: "These things try to fool your eyes. Use your tests to find the rule, then sort them." },
};
const SHAPE_FRAMING: Record<Tier, { title: string; description: string }> = {
  easy: { title: "Make It Float", description: "A ball of clay sinks. Change its shape, test it, and make the same clay float." },
  medium: { title: "Clay Boats", description: "Shape the clay so it floats and carries pennies. Guess, test, and try again." },
  hard: { title: "Heavy Loads", description: "The same clay must carry a big load. Which shape pushes away the most water?" },
};
const BOAT_FRAMING: Record<Tier, { title: string; description: string }> = {
  easy: { title: "Build a Boat", description: "Build a boat, put it in the water and load it with pennies. Does it float?" },
  medium: { title: "Penny Boats", description: "Build a boat that carries the pennies. Test it, change it, and test it again." },
  hard: { title: "The Biggest Cargo", description: "Big loads need a clever boat. Test your designs and make one that carries them all." },
};
const CARGO_FRAMING: Record<Tier, { title: string; description: string }> = {
  easy: { title: "Which Boat Wins?", description: "Build a second boat, guess which carries more pennies, then test both and see." },
  medium: { title: "Change One Thing", description: "Change just one thing about the boat, test both, and let the pennies tell you what happened." },
  hard: { title: "Fair Boat Tests", description: "Plan a fair test: two boats the same except one thing. Test both and say what you found." },
};
const SALT_FRAMING: Record<Tier, { title: string; description: string }> = {
  easy: { title: "Make the Egg Float", description: "It sinks in fresh water. Stir in salt, one spoon at a time, and watch what happens." },
  medium: { title: "Salty Water", description: "Make one food float and keep the other on the bottom. Add salt, or pour some out." },
  hard: { title: "Just Enough Salt", description: "Three foods, and one spoon makes the difference. Test, record, and stop at just the right salt." },
};
const MIXED_FRAMING = { title: "Sink, Float and Sail", description: "Test what floats, then build boats that carry pennies across the harbor." };

/** The band from the exact grade where the lesson has one (`ctx.grade`: 'K', '1'..'12'); else from the grade key,
 *  which can be only a band ('elementary' covers grades 1-5). */
export function buoyancyBand(gradeLevel: string, grade?: string): BuoyancyBand {
  const n = parseInt(grade ?? '', 10);
  if (Number.isFinite(n)) return n >= 3 ? "3-5" : "K-2";
  return /\b([3-5]|third|fourth|fifth)\b/i.test(gradeLevel) ? "3-5" : "K-2";
}

/** A session of the given tasks (in ladder order); one task fills it, a mix runs some of each. */
export function buildBuoyancyHarbor(
  ctx: Pick<GenerationContext, "gradeLevel" | "supportTier" | "grade">, seed = Date.now(), tasks: readonly BuoyancyTask[] = ["drop_test"],
): BuoyancyHarborData {
  const tier: Tier = ctx.supportTier ?? "medium";
  const rng = seeded(seed);
  const counts = tasks.length === 1 ? SINGLE_COUNT : MIXED_COUNT;
  const challenges: BuoyancyChallenge[] = [];
  if (tasks.includes("drop_test")) challenges.push(...pickDropTests(counts.drop_test, tier, rng, "drop"));
  if (tasks.includes("find_the_rule")) challenges.push(...pickRuleChallenges(counts.find_the_rule, tier, rng, "rule"));
  if (tasks.includes("make_it_float")) challenges.push(...pickShapeChallenges(counts.make_it_float, tier, rng, "shape"));
  if (tasks.includes("build_boat")) challenges.push(...pickBoatChallenges(counts.build_boat, tier, rng, "boat"));
  if (tasks.includes("cargo_two_designs")) challenges.push(...pickCargoChallenges(counts.cargo_two_designs, tier, rng, "cargo"));
  if (tasks.includes("salt_water")) challenges.push(...pickSaltChallenges(counts.salt_water, tier, rng, "salt"));
  // Where the levers start (`buoyancyLevers.ts`): at easy the x-ray arrows are drawn from the start, on whatever the
  // learner puts in the water. A starting position is not a pull, so nothing is recorded as help.
  if (tier === "easy") challenges.forEach(c => { c.startLevers = [XRAY_LEVER]; });
  const framing = tasks.length > 1 ? MIXED_FRAMING
    : tasks[0] === "build_boat" ? BOAT_FRAMING[tier] : tasks[0] === "salt_water" ? SALT_FRAMING[tier]
      : tasks[0] === "cargo_two_designs" ? CARGO_FRAMING[tier] : tasks[0] === "make_it_float" ? SHAPE_FRAMING[tier]
      : tasks[0] === "find_the_rule" ? RULE_FRAMING[tier] : FRAMING[tier];
  return {
    ...framing,
    challenges,
    challengeType: tasks[0],
    gradeBand: buoyancyBand(ctx.gradeLevel, ctx.grade),
    supportTier: tier,
  };
}

export async function generateBuoyancyHarbor(ctx: GenerationContext): Promise<BuoyancyHarborData> {
  // Explicit pin wins (no model call); otherwise the intent resolves the task(s). null => mixed: some of each.
  const resolution = await resolveEvalModes(
    "buoyancy-harbor",
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective?.text },
    CHALLENGE_TYPE_DOCS,
  );
  const resolved = (resolution?.allowedTypes ?? BUOYANCY_TASKS).filter(isTask);
  const tasks = BUOYANCY_TASKS.filter(t => resolved.includes(t));
  console.log(`[BuoyancyHarbor] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join("+")} (${resolution.source})` : "mixed"} -> [${tasks.join(", ")}]`);
  return buildBuoyancyHarbor(ctx, (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0, tasks.length ? tasks : ["drop_test"]);
}
