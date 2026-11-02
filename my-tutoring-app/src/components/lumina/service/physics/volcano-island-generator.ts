import type { GenerationContext } from "../generation/generationContext";
import type { VolcanoIslandData } from "../../primitives/visual-primitives/physics/VolcanoIsland";
import { VOLCANO_TASKS, pickKitchens, type Tier, type VolcanoChallenge, type VolcanoTask } from "../../primitives/visual-primitives/physics/volcanoModel";
import { pickMagmas } from "../../primitives/visual-primitives/physics/magmaModel";
import { pickLayers } from "../../primitives/visual-primitives/physics/layersModel";
import { pickVillages } from "../../primitives/visual-primitives/physics/villageModel";
import { pickRocks } from "../../primitives/visual-primitives/physics/rockModel";
import { resolveEvalModes, type ChallengeTypeDoc } from "../evalMode";
import { seeded } from "../../primitives/visual-primitives/physics/buoyancyModel";
import { FIZZ_LEVER } from "../../primitives/visual-primitives/physics/volcanoLevers";

export type { VolcanoIslandData };

/**
 * Volcano Island generator (Fork C, code-only: no content model call). Every item comes from `volcanoModel.ts`: volcano
 * A's mix, the amount to change, and the check. `config.difficulty` (the support tier) sets the structure: easy changes
 * the amount that runs out first with the other locked; medium the same with the learner keeping the other amount;
 * hard changes an amount that is already more than enough, so the foam stays the same height. One mode at birth.
 */

const SINGLE_COUNT: Record<VolcanoTask, number> = { kitchen_volcano: 4, runny_or_sticky: 4, layers_over_time: 4, save_the_village: 3, cool_the_rock: 4 };
const MIXED_COUNT: Record<VolcanoTask, number> = { kitchen_volcano: 2, runny_or_sticky: 2, layers_over_time: 1, save_the_village: 1, cool_the_rock: 1 };
const CHALLENGE_TYPE_DOCS: Record<VolcanoTask, ChallengeTypeDoc> = {
  kitchen_volcano: {
    promptDoc: '"kitchen_volcano": a fair test with two baking soda and vinegar volcanoes: change one amount, erupt both, say which foam rose higher.',
    schemaDescription: "'kitchen_volcano' (baking soda and vinegar fair test)",
  },
  runny_or_sticky: {
    promptDoc: '"runny_or_sticky": erupt real volcanoes\' magma on an island (runny lava flows far; thick, gassy magma explodes; thick magma with little gas piles into a dome), then say what a new volcano will do.',
    schemaDescription: "'runny_or_sticky' (runny or thick magma, flowing or explosive eruptions)",
  },
  layers_over_time: {
    promptDoc: '"layers_over_time": erupt a volcano and watch its new layer go on top, then put the rock layers in a cutaway in order, oldest (bottom) first; a lava crack that cuts through layers is younger than them.',
    schemaDescription: "'layers_over_time' (order a volcano's rock layers, oldest first)",
  },
  save_the_village: {
    promptDoc: '"save_the_village": an open build: place rock walls on a map of the volcano\'s slope so lava flowing downhill misses the village, testing with eruptions.',
    schemaDescription: "'save_the_village' (place walls so the lava misses the village)",
  },
  cool_the_rock: {
    promptDoc: '"cool_the_rock": cool lava deep underground (big crystals, granite), on the surface (tiny crystals, basalt) or in the sea (glass, obsidian); gassy lava makes pumice; then say where a found rock cooled from its look.',
    schemaDescription: "'cool_the_rock' (how fast lava cools decides the rock)",
  },
};
const isTask = (t: string): t is VolcanoTask => (VOLCANO_TASKS as readonly string[]).includes(t);
const MAGMA_FRAMING: Record<Tier, { title: string; description: string }> = {
  easy: { title: "Runny or Sticky?", description: "Erupt two volcanoes and watch. Then say what a new volcano will do." },
  medium: { title: "Flow or Explode?", description: "Is the magma runny or thick? Test, then use your tests to decide." },
  hard: { title: "Three Kinds of Eruption", description: "Runny, thick and gassy, thick and calm. Test all three, then decide." },
};
const LAYERS_FRAMING: Record<Tier, { title: string; description: string }> = {
  easy: { title: "Layer on Layer", description: "Erupt the volcano and watch. Where does the new layer go?" },
  medium: { title: "Read the Rocks", description: "Each eruption leaves a layer. Put them in order, oldest first." },
  hard: { title: "Rock Detective", description: "Layers and a lava crack. Which came first? Read the rocks and find out." },
};
const VILLAGE_FRAMING: Record<Tier, { title: string; description: string }> = {
  easy: { title: "Save the Village", description: "Lava flows downhill. Put a rock wall in its way so it misses the village." },
  medium: { title: "Lava Wall Builders", description: "Watch where the lava goes, then build walls to turn it aside." },
  hard: { title: "Every Wall Counts", description: "Only a few walls, and the lava finds every way down. Test and plan." },
};
const ROCK_FRAMING: Record<Tier, { title: string; description: string }> = {
  easy: { title: "Slow or Fast?", description: "Cool lava deep underground and in the sea. What rock does each make?" },
  medium: { title: "Rock Recipes", description: "Underground, on the surface, in the sea: cool lava three ways and read the crystals." },
  hard: { title: "Rock Detective", description: "Crystals, glass, or holes? Cool the samples, then tell where a found rock was made." },
};
const MIXED_FRAMING = { title: "Volcano Island", description: "Make kitchen volcanoes, then erupt real volcanoes on the island." };
const FRAMING: Record<Tier, { title: string; description: string }> = {
  easy: { title: "Kitchen Volcanoes", description: "Mix baking soda and vinegar. Change one amount and see which volcano erupts higher." },
  medium: { title: "A Fair Volcano Test", description: "Change just one thing, erupt both volcanoes, and let the foam tell you." },
  hard: { title: "More Is Not Always Higher", description: "Add more and test. Does more always make a bigger eruption?" },
};

/** The band from the exact grade where the lesson has one (`ctx.grade`: 'K', '1'..'12'); else from the grade key,
 *  which can be only a band ('elementary' covers grades 1-5). */
export function volcanoBand(gradeLevel: string, grade?: string): VolcanoIslandData["gradeBand"] {
  const n = parseInt(grade ?? '', 10);
  if (Number.isFinite(n)) return n >= 3 ? "3-5" : "K-2";
  return /\b([3-5]|third|fourth|fifth)\b/i.test(gradeLevel) ? "3-5" : "K-2";
}

export function buildVolcanoIsland(
  ctx: Pick<GenerationContext, "gradeLevel" | "supportTier" | "grade">, seed = Date.now(), tasks: readonly VolcanoTask[] = ["kitchen_volcano"],
): VolcanoIslandData {
  const tier: Tier = ctx.supportTier ?? "medium";
  const rng = seeded(seed);
  const counts = tasks.length === 1 ? SINGLE_COUNT : MIXED_COUNT;
  const challenges: VolcanoChallenge[] = [];
  if (tasks.includes("kitchen_volcano")) challenges.push(...pickKitchens(counts.kitchen_volcano, tier, rng, "kitchen"));
  if (tasks.includes("layers_over_time")) challenges.push(...pickLayers(counts.layers_over_time, tier, rng, "layers"));
  if (tasks.includes("save_the_village")) challenges.push(...pickVillages(counts.save_the_village, tier, rng, "village"));
  if (tasks.includes("cool_the_rock")) challenges.push(...pickRocks(counts.cool_the_rock, tier, rng, "rock"));
  if (tasks.includes("runny_or_sticky")) challenges.push(...pickMagmas(counts.runny_or_sticky, tier, rng, "magma"));
  // Where the levers start: at easy the fizz pairs are drawn once both volcanoes erupt. A starting position is not a pull.
  if (tier === "easy") challenges.forEach(c => { c.startLevers = [FIZZ_LEVER]; });
  return {
    ...(tasks.length > 1 ? MIXED_FRAMING : tasks[0] === "runny_or_sticky" ? MAGMA_FRAMING[tier] : tasks[0] === "layers_over_time" ? LAYERS_FRAMING[tier] : tasks[0] === "save_the_village" ? VILLAGE_FRAMING[tier] : tasks[0] === "cool_the_rock" ? ROCK_FRAMING[tier] : FRAMING[tier]),
    challenges,
    challengeType: tasks[0],
    gradeBand: volcanoBand(ctx.gradeLevel, ctx.grade),
    supportTier: tier,
  };
}

export async function generateVolcanoIsland(ctx: GenerationContext): Promise<VolcanoIslandData> {
  const resolution = await resolveEvalModes(
    "volcano-island",
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective?.text },
    CHALLENGE_TYPE_DOCS,
  );
  const resolved = (resolution?.allowedTypes ?? VOLCANO_TASKS).filter(isTask);
  const tasks = VOLCANO_TASKS.filter(t => resolved.includes(t));
  return buildVolcanoIsland(ctx, (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0, tasks.length ? tasks : ["kitchen_volcano"]);
}
