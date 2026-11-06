import type { GenerationContext } from "../generation/generationContext";
import type { BodyWorkshopData } from "../../primitives/visual-primitives/biology/BodyWorkshop";
import {
  BODY_TASKS, benchFor, seededRng, shuffled, type BodyChallenge, type BodyGoal, type BodyTask, type Rng, type Tier,
} from "../../primitives/visual-primitives/biology/bodyModel";
import { animalsFor, atlasAnimal, jobOf, newAt } from "../../primitives/visual-primitives/biology/bodyAtlas";
import { offJobLever } from "../../primitives/visual-primitives/biology/bodyLevers";
import { resolveEvalModes, type ChallengeTypeDoc } from "../evalMode";
import { authorAnimals, type AuthorResult } from "./body-author";

export type { BodyWorkshopData };

/**
 * Body Workshop generator (K-5). The author agent (`body-author.ts`) picks real animals for the lesson and names the
 * path oxygen or food takes through each; code checks that each path flows and is the real animal's, and falls back to
 * the atlas for any that are not. Code owns the rest:
 *   - the TASK (eval mode): an explicit pin wins; otherwise the intent resolves `deliver_oxygen`, `fuel_the_body` or
 *     both (mixed: some of each);
 *   - the GOAL by grade: K-3 get it into the blood (1-4 parts); 4-5 on to a working muscle (heart and blood tubes);
 *   - the TIER (`config.difficulty`, default easy for K-1 and medium from grade 2): which animals can appear and how
 *     many parts sit on the bench; medium and hard always include one animal the tier adds;
 *   - the BENCH: the same shuffled parts for every animal of a task in the session, so it never shows which animal
 *     needs what.
 */

const COUNT = 3;

const CHALLENGE_TYPE_DOCS: Record<BodyTask, ChallengeTypeDoc> = {
  deliver_oxygen: {
    promptDoc: '"deliver_oxygen": build the path oxygen takes through a real animal, from the air or water where it lives (nose, windpipe, lungs; mouth and gills; wet skin; breathing holes and air tubes) into its blood, or on through the heart to a muscle.',
    schemaDescription: "'deliver_oxygen' (breathing: the path oxygen takes)",
  },
  fuel_the_body: {
    promptDoc: '"fuel_the_body": build the path food takes through a real animal, from its mouth (stomach, intestines; a bird\'s crop and gizzard; a cow\'s four-part stomach) into its blood, or on through the heart to a muscle for energy.',
    schemaDescription: "'fuel_the_body' (digestion: the path food takes)",
  },
};

const FRAMING: Record<BodyTask, Record<BodyGoal, { title: string; description: string }>> = {
  deliver_oxygen: {
    into_body: { title: 'Breath Builder', description: 'Every animal needs oxygen. Build the path a breath takes into each animal\'s body.' },
    to_muscle: { title: 'Oxygen Delivery', description: 'Muscles need oxygen to move. Build the path oxygen takes from outside each animal to a working muscle.' },
  },
  fuel_the_body: {
    into_body: { title: 'Food Journey', description: 'Every animal needs food. Build the path food takes from the mouth into each animal\'s blood.' },
    to_muscle: { title: 'Fuel Delivery', description: 'Muscles need food for energy. Build the path food takes from the mouth to a working muscle.' },
  },
};
const MIXED_FRAMING = { title: 'Body Workshop', description: 'Every animal needs oxygen and food. Build the path each one takes through a real animal\'s body.' };

export function gradeNumber(gradeLevel: string, grade?: string): number {
  if (grade === 'K' || /^k(indergarten)?$/i.test(grade ?? '')) return 0;
  const n = parseInt(grade ?? '', 10);
  if (Number.isFinite(n)) return n;
  if (/\bk(indergarten)?\b/i.test(gradeLevel)) return 0;
  const m = gradeLevel.match(/\b([1-5])(st|nd|rd|th)?\b/);
  if (m) return parseInt(m[1], 10);
  return /\b(first|second)\b/i.test(gradeLevel) ? 1 : 4;
}

export const goalFor = (n: number): BodyGoal => (n <= 3 ? 'into_body' : 'to_muscle');

export function instructionFor(task: BodyTask, goal: BodyGoal, name: string, muscle: string, n: number): string {
  if (task === 'fuel_the_body') {
    if (goal === 'to_muscle') return `Build the path that gets the ${name}'s food to its ${muscle}.`;
    return n <= 1 ? `Help the ${name} eat! Build the path its food takes into its body.`
      : `Build the path that gets the ${name}'s food into its blood.`;
  }
  if (goal === 'to_muscle') return `Build the path that gets oxygen to the ${name}'s ${muscle}.`;
  return n <= 1 ? `Help the ${name} breathe! Build the path the breath takes into its body.`
    : `Build the path that gets oxygen into the ${name}'s body.`;
}

/** One task's items from its authored animals. Ids are filled in by the caller. */
export function bodyItems(authored: AuthorResult, task: BodyTask, goal: BodyGoal, tier: Tier, n: number, rng: Rng): BodyChallenge[] {
  const bench = shuffled(benchFor(task, goal, tier), rng);
  return authored.picks.map(p => {
    const a = atlasAnimal(p.words.animal)!;
    const job = jobOf(a, task)!;
    return {
      id: '', type: task, goal, animal: a.id, name: a.name, emoji: a.emoji, habitat: a.habitat,
      medium: task === 'fuel_the_body' ? 'outside_food' : a.medium, ...(job.food ? { food: job.food } : {}),
      muscle: a.muscle, intro: p.words.intro, instruction: instructionFor(task, goal, a.name, a.muscle, n),
      principle: p.words.principle, jobs: { ...job.jobs, ...p.words.jobs }, bench,
      // Where the levers start: easy opens with the other job's parts off the bench (a starting position, not a pull).
      startLevers: tier === 'easy' ? [offJobLever(task)] : [],
    };
  });
}

export function assembleBodyWorkshop(parts: Array<{ task: BodyTask; authored: AuthorResult }>, goal: BodyGoal, tier: Tier,
  n: number, rng: Rng): BodyWorkshopData {
  const perTask = parts.map(({ task, authored }) => bodyItems(authored, task, goal, tier, n, rng));
  // Interleave the tasks so a mixed session alternates; ids follow the final order.
  const challenges: BodyChallenge[] = [];
  for (let i = 0; challenges.length < perTask.flat().length; i++) perTask.forEach(items => { if (items[i]) challenges.push(items[i]); });
  challenges.forEach((c, i) => { c.id = `animal-${i + 1}`; });
  const tasks = parts.map(p => p.task);
  const all = parts.flatMap(p => p.authored.picks.map(pick => ({ task: p.task, pick })));
  return {
    ...(tasks.length > 1 ? MIXED_FRAMING : FRAMING[tasks[0]][goal]),
    challenges,
    challengeType: tasks[0],
    gradeBand: n <= 2 ? 'K-2' : '3-5',
    supportTier: tier,
    authoring: {
      calls: parts.reduce((s, p) => s + p.authored.calls, 0),
      sources: all.map(({ task, pick }) => `${task}:${pick.words.animal}:${pick.source}`),
      rejected: all.filter(x => x.pick.errors.length).map(x => ({ animal: x.pick.words.animal, errors: x.pick.errors })),
      repaired: all.filter(x => x.pick.firstErrors?.length).map(x => ({ animal: x.pick.words.animal, errors: x.pick.firstErrors! })),
      ...(parts.some(p => p.authored.failure) ? { failure: parts.find(p => p.authored.failure)!.authored.failure } : {}),
    },
  };
}

/** The tasks to run: an explicit pin, the intent's resolution, or both (mixed). Never throws. */
async function resolveTasks(ctx: GenerationContext): Promise<BodyTask[]> {
  try {
    const resolution = await resolveEvalModes(
      'body-workshop',
      { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective?.text },
      CHALLENGE_TYPE_DOCS,
    );
    const resolved = (resolution?.allowedTypes ?? BODY_TASKS) as readonly string[];
    const tasks = BODY_TASKS.filter(t => resolved.includes(t));
    return tasks.length ? tasks : [...BODY_TASKS];
  } catch (e) {
    console.warn(`[body-workshop] mode resolution failed (${e instanceof Error ? e.message : String(e)}); mixed`);
    return ctx.targetEvalMode && (BODY_TASKS as readonly string[]).includes(ctx.targetEvalMode)
      ? [ctx.targetEvalMode as BodyTask] : [...BODY_TASKS];
  }
}

export async function generateBodyWorkshop(ctx: GenerationContext): Promise<BodyWorkshopData> {
  const n = gradeNumber(ctx.gradeLevel, ctx.grade);
  const goal = goalFor(n);
  const tier: Tier = ctx.supportTier ?? (n <= 1 ? 'easy' : 'medium');
  const rng = seededRng((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);
  const tasks = await resolveTasks(ctx);
  // Mixed: two of one task and one of the other, the order random.
  const ordered = tasks.length > 1 && rng() < 0.5 ? [...tasks].reverse() : tasks;
  const counts = ordered.map((_, i) => (ordered.length === 1 ? COUNT : i === 0 ? 2 : 1));
  const lesson = { topic: ctx.topic, intent: ctx.intent, objective: ctx.objective?.text, gradeLevel: ctx.gradeLevel, grade: ctx.grade };
  const parts = await Promise.all(ordered.map(async (task, i) => ({
    task,
    authored: await authorAnimals(lesson, task, goal, animalsFor(task, tier), tier === 'easy' ? [] : newAt(task, tier), counts[i], rng),
  })));
  console.log(`[body-workshop] tasks ${ordered.join('+')} · goal ${goal} · tier ${tier}`);
  return assembleBodyWorkshop(parts, goal, tier, n, rng);
}
