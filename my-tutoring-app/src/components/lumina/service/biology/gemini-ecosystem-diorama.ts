import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { resolveEvalModes, type ChallengeTypeDoc } from "../evalMode";
import { airplaneBand } from "../engineering/gemini-airplane-diorama";
import type { EcosystemDioramaData } from "../../primitives/visual-primitives/biology/EcosystemDiorama";
import {
  ECOSYSTEM_TASKS, pickChallenges, pickMixed, type EcosystemChallenge, type EcosystemTask,
} from "../../primitives/visual-primitives/biology/ecosystemModel";

export type { EcosystemDioramaData };

/**
 * Ecosystem diorama generator (Fork A, every mode). Gemini reads the lesson and returns only words: a title, one
 * sentence and a made-up island name for the sign. Code builds every item from the world model: the sun-test pairs
 * and their results, the weather records, the plants and what they are missing, the winter animals, and the covers.
 *
 * The task comes from `resolveEvalModes`: a pin, or the lesson's intent resolved to one task or a blend. Mixed (no
 * pin, broad intent) builds one of each task, easiest first (`pickMixed`).
 */

const ITEMS = 5;
const MIXED_ITEMS = 6;
const FALLBACK_ISLAND = "Sunny Island";

const CHALLENGE_TYPE_DOCS: Record<EcosystemTask, ChallengeTypeDoc> = {
  plant_needs: { promptDoc: '"plant_needs": give a potted plant sunlight, water and soil (and nothing an animal needs), then watch it grow.', schemaDescription: "'plant_needs' (what plants need)" },
  sun_test: { promptDoc: '"sun_test": a fair test of two things in the sun (dark/light, sun/shade, sand/water); guess, run the sun, read the thermometers.', schemaDescription: "'sun_test' (sunlight warms things)" },
  season_behavior: { promptDoc: '"season_behavior": winter comes to the island; move each animal (bear, bird, squirrel, deer) to where it spends the winter.', schemaDescription: "'season_behavior' (animals in winter)" },
  season_from_log: { promptDoc: '"season_from_log": play a month of weather into a picture log, then name the season and the weather that shows it.', schemaDescription: "'season_from_log' (season from weather)" },
  compare_logs: { promptDoc: '"compare_logs": play two months or places into two weather logs, then compare them (more of a weather, or warmer).', schemaDescription: "'compare_logs' (compare weather)" },
  keep_it_cool: { promptDoc: '"keep_it_cool": build shade over an ice pop or snowman so it stays cool while the sun crosses the sky.', schemaDescription: "'keep_it_cool' (design to block sunlight)" },
};

const FRAMING: Record<EcosystemTask | "mixed", { title: string; description: string }> = {
  plant_needs: { title: "Help the Plants Grow", description: "Each plant needs your help. Give it what it needs, then watch it grow!" },
  sun_test: { title: "The Sun Test", description: "Which things does the sun warm the most? Make a guess, move the sun across the sky, and read the thermometers." },
  season_behavior: { title: "Winter on the Island", description: "Winter is coming! Help each animal get ready for the cold." },
  season_from_log: { title: "Weather Detectives", description: "Watch a month of weather, fill the weather log, and figure out the season." },
  compare_logs: { title: "Two Weather Logs", description: "Fill two weather logs and see how the weather was different." },
  keep_it_cool: { title: "Keep It Cool", description: "The sun is strong today. Build something to keep your treat cool!" },
  mixed: { title: "Life on the Island", description: "Plants, animals, sunshine and weather: let's explore the island tank!" },
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Names the activity, 2-5 words. No numbers. Never gives an answer (which thing gets warmer, which season, where an animal goes)." },
    description: { type: Type.STRING, description: "One child-friendly sentence inviting the learner into the island tank activity. No numbers. Never gives an answer." },
    islandName: { type: Type.STRING, description: "A made-up, friendly island name of two or three words, 6-16 letters, painted on a sign, e.g. 'Turtle Island', 'Pebble Isle'." },
  },
  required: ["title", "description", "islandName"],
};

function buildPrompt(ctx: GenerationContext, band: "K-2" | "3-5", tasks: EcosystemTask[]): string {
  const lines = [`LESSON TOPIC: ${ctx.topic}`];
  if (ctx.title) lines.push(`ACTIVITY TITLE: ${ctx.title}`);
  if (ctx.intent) lines.push(`ACTIVITY INTENT (what the lesson asked this activity to do): ${ctx.intent}`);
  if (ctx.objective?.text) lines.push(`LEARNING OBJECTIVE: ${ctx.objective.text}`);
  return `${lines.join("\n")}

You are framing a 3D island-in-a-glass-tank activity for ${ctx.gradeContext || (band === "K-2" ? "grades K-2" : "grades 3-5")}.
In this session the learner will:
${tasks.map(t => `- ${CHALLENGE_TYPE_DOCS[t].promptDoc}`).join("\n")}
The app builds every item and works out every result itself.

Return a title and a one-sentence description for this lesson, and a made-up island name for the sign. Never say or hint
at an answer.`;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** A painted name a child can read: two or three words of letters, 6-18 characters. */
export function cleanIslandName(raw: unknown): string {
  const s = str(raw).replace(/\s+/g, " ");
  return /^[A-Za-z]+( [A-Za-z]+){1,2}$/.test(s) && s.length >= 6 && s.length <= 18 ? s : FALLBACK_ISLAND;
}

/** Framing that would give an answer away before the learner works it out, per task. */
const ANSWER_HINT: Record<EcosystemTask, RegExp> = {
  sun_test: /\b(dark|black|sunny|shad(e|y)|sand|water)\b[^.]*\b(warm|hot)/i,
  plant_needs: /\b(sun|sunlight|sunshine|light|water|soil|dirt)\b/i,
  season_behavior: /\b(hibernat\w*|south|den|cave|hollow|nuts?|migrat\w*)\b/i,
  season_from_log: /\b(winter|spring|summer|fall|autumn|snow\w*|rain\w*|sunny|windy)\b/i,
  compare_logs: /\b(warmer|colder|more|fewer)\b/i,
  keep_it_cool: /\b(umbrella|shade|shadow|roof|hut|clear|block\w*)\b/i,
};
const clean = (s: string, fallback: string, tasks: EcosystemTask[]) =>
  (s && !/\d/.test(s) && !tasks.some(t => ANSWER_HINT[t].test(s)) ? s : fallback);
const isTask = (t: string): t is EcosystemTask => (ECOSYSTEM_TASKS as readonly string[]).includes(t);

export const generateEcosystemDiorama = async (ctx: GenerationContext): Promise<EcosystemDioramaData> => {
  const band = airplaneBand(ctx);
  // Explicit pin wins; otherwise the intent resolves the task(s). null => mixed: one of each task.
  const resolution = await resolveEvalModes(
    "ecosystem-diorama",
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective?.text },
    CHALLENGE_TYPE_DOCS,
  );
  const resolved = (resolution?.allowedTypes ?? []).filter(isTask);
  const tasks: EcosystemTask[] = resolved.length ? ECOSYSTEM_TASKS.filter(t => resolved.includes(t)) : [...ECOSYSTEM_TASKS];
  const mixed = !resolution;

  let title = "", description = "", islandName = FALLBACK_ISLAND;
  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: buildPrompt(ctx, band, tasks),
      config: { responseMimeType: "application/json", responseSchema: schema },
    });
    const data = result.text ? JSON.parse(result.text) : null;
    title = str(data?.title);
    description = str(data?.description);
    islandName = cleanIslandName(data?.islandName);
  } catch (err) {
    console.warn("[EcosystemDiorama] generation failed:", err);
  }

  let challenges: EcosystemChallenge[];
  if (mixed) challenges = pickMixed(MIXED_ITEMS);
  else if (tasks.length === 1) challenges = pickChallenges(tasks[0], ITEMS);
  else {
    // A blend: the items shared out over the tasks, easiest task first.
    challenges = [];
    tasks.forEach((t, i) => {
      const n = Math.floor(ITEMS / tasks.length) + (i < ITEMS % tasks.length ? 1 : 0);
      if (n) challenges.push(...pickChallenges(t, n, challenges.length + 1));
    });
  }

  console.log(
    `[EcosystemDiorama] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join("+")} (${resolution.source})` : "mixed"}`
      + ` band=${band} items=[${challenges.map(c => c.type).join(", ")}] island=${islandName}`,
  );

  const fallback = FRAMING[tasks.length === 1 ? tasks[0] : "mixed"];
  return {
    title: clean(title, fallback.title, tasks),
    description: clean(description, fallback.description, tasks),
    challenges,
    challengeType: challenges[challenges.length - 1]?.type ?? tasks[0],
    gradeBand: band,
    islandName,
    ...(ctx.supportTier ? { supportTier: ctx.supportTier } : {}),
  };
};
