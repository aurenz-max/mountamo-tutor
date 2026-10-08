import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { resolveEvalModes, type ChallengeTypeDoc } from "../evalMode";
import type { TrainYardData } from "../../primitives/visual-primitives/engineering/TrainYard";
import {
  buildTrainYardChallenge,
  TRAIN_YARD_TASKS,
  type CargoForm,
  type TrainJobStory,
  type TrainYardBand,
  type TrainYardChallenge,
  type TrainYardTask,
} from "../../primitives/visual-primitives/engineering/trainYardModel";

export type { TrainYardData };

/**
 * Train yard generator. Gemini writes the job STORIES (cargo, its physical form, route, hill);
 * `buildTrainYardChallenge` sets every number (load, grade, distance) and writes the instruction,
 * so the key the component checks and the numbers the learner reads come from one place.
 */

const CARGO_FORMS: readonly CargoForm[] = ["loose_bulk", "liquid", "long_bundles", "boxed_goods", "vehicles", "people"];
const ASKED = 6;
const SHIPPED = 4;
const MIN_VALID = 3;
const MAX_TITLE = 40;
const MAX_CARGO = 30;

const ENGINE_TARGETS: Record<TrainYardBand, readonly number[]> = { "K-2": [1, 2, 1, 2], "3-5": [1, 2, 3, 2] };

/**
 * The tasks. Gemini writes only job stories, so the resolved modes are not a schema enum: code assigns a task to
 * each job (`assignTasks`) and `buildTrainYardChallenge` writes that task's instruction.
 */
const CHALLENGE_TYPE_DOCS: Record<TrainYardTask, ChallengeTypeDoc> = {
  match_car: {
    promptDoc: '"match_car": choose the kind of car built for the cargo; the yard sets the counts and the engines.',
    schemaDescription: "'match_car' (match the car to the cargo)",
  },
  enough_cars: {
    promptDoc: '"enough_cars": the right car is given; couple the fewest cars that hold the whole load.',
    schemaDescription: "'enough_cars' (count the cars)",
  },
  enough_pull: {
    promptDoc: '"enough_pull": the loaded cars are given; add the fewest engines that pull them up the hill.',
    schemaDescription: "'enough_pull' (choose the engines)",
  },
  build_train: {
    promptDoc: '"build_train": build the whole train: the car kind, the fewest cars and the fewest engines.',
    schemaDescription: "'build_train' (build the train)",
  },
};

const isTask = (t: string): t is TrainYardTask => (TRAIN_YARD_TASKS as readonly string[]).includes(t);

/** Jobs whose engine count is always 1 (light trains), so they cannot carry an engine-count task. */
const lightTrain = (s: TrainJobStory) => s.cargoForm === "people" || s.cargoForm === "vehicles";

/**
 * One task per job, easiest first, cycling through `tasks` (one task: every job; all four on a mixed
 * session: one of each). An `enough_pull` on a light train asks for one engine every time, so it trades
 * places with a freight job's task when one exists.
 */
export function assignTasks(stories: TrainJobStory[], tasks: readonly TrainYardTask[]): TrainYardTask[] {
  const ordered = TRAIN_YARD_TASKS.filter(t => tasks.includes(t));
  const out = stories.map((_, i) => ordered[Math.floor((i * ordered.length) / Math.max(stories.length, 1))] ?? "build_train");
  out.forEach((task, i) => {
    if (task !== "enough_pull" || !lightTrain(stories[i])) return;
    const j = stories.findIndex((s, k) => !lightTrain(s) && out[k] !== "enough_pull");
    if (j >= 0) [out[i], out[j]] = [out[j], out[i]];
  });
  return out;
}

// ── Lesson grounding ────────────────────────────────────────────────────────────

function buildLessonSection(ctx: GenerationContext): string {
  const lines = [`LESSON TOPIC: ${ctx.topic}`];
  if (ctx.title) lines.push(`ACTIVITY TITLE: ${ctx.title}`);
  if (ctx.intent) lines.push(`ACTIVITY INTENT (what the lesson asked this activity to do): ${ctx.intent}`);
  if (ctx.objective?.text) lines.push(`LEARNING OBJECTIVE: ${ctx.objective.text}`);
  return lines.join("\n");
}

// ── Band ────────────────────────────────────────────────────────────────────────

/** 'K-2' for kindergarten, grade 1 and grade 2; '3-5' otherwise or when the grade is unknown. */
export function trainYardBand(ctx: Pick<GenerationContext, "grade" | "gradeLevel" | "gradeContext">): TrainYardBand {
  const g = (ctx.grade ?? "").toString().trim().toUpperCase();
  if (g) {
    if (g === "K") return "K-2";
    const n = parseInt(g, 10);
    if (!isNaN(n)) return n <= 2 ? "K-2" : "3-5";
  }
  const level = (ctx.gradeLevel ?? "").toLowerCase();
  if (["kindergarten", "preschool", "toddler"].includes(level)) return "K-2";
  const prose = (ctx.gradeContext ?? "").toLowerCase();
  if (/\b(kindergarten|preschool|grade [12]|[12](st|nd) grade)\b/.test(prose)) return "K-2";
  return "3-5";
}

// ── Schema ──────────────────────────────────────────────────────────────────────

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Names the activity, e.g. 'Train Yard: Rail Jobs'. No numbers." },
    description: { type: Type.STRING, description: "One child-friendly sentence about the activity. No numbers." },
    jobs: {
      type: Type.ARRAY,
      description: `${ASKED} rail job stories`,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "2-4 word job name, e.g. 'Harvest Rush'" },
          cargo: { type: Type.STRING, description: "What is moved, a short plural or mass noun a child knows: 'grain', 'lumber', 'commuters'" },
          cargoForm: { type: Type.STRING, enum: [...CARGO_FORMS], description: "The physical form of the cargo" },
          from: { type: Type.STRING, description: "Named starting place that fits the cargo" },
          to: { type: Type.STRING, description: "Named destination that fits the cargo" },
          hillName: { type: Type.STRING, description: "Named hill, pass or grade on the route: 'Cedar Hill', 'Raven Pass'" },
        },
        required: ["title", "cargo", "cargoForm", "from", "to", "hillName"],
      },
    },
  },
  required: ["title", "description", "jobs"],
};

function buildPrompt(ctx: GenerationContext, band: TrainYardBand): string {
  return `Write ${ASKED} rail job stories for a train-yard activity for ${ctx.gradeContext || (band === "K-2" ? "grades K-2" : "grades 3-5")}.
In each job the student builds a freight or passenger train to carry a load over a hill.

${buildLessonSection(ctx)}

GROUNDING:
- Every job must be about this lesson. If the intent names cargo, places or kinds of trains, use them.
- A lesson about passenger AND freight trains gets freight jobs AND at least one passenger (people) job.
- A lesson about grain or farms gets farm loads. A lesson only about passenger trains gets people jobs on different routes.
- Prefer ${ASKED} different cargoForms where the lesson allows; otherwise vary the cargo and routes.

FIELDS:
- title: a 2-4 word job name ("Harvest Rush").
- cargo: a short plural or mass noun a child knows ("grain", "lumber", "heating oil", "commuters", "new cars", "packages").
- cargoForm: the physical form of the cargo:
  loose_bulk = grain, coal, sand, gravel; liquid = oil, milk, water, chemicals;
  long_bundles = lumber, logs, steel pipes, rails; boxed_goods = packages, furniture, paper rolls, canned food;
  vehicles = new cars, tractors, trucks; people = commuters, fans, tourists, students.
- from / to: named places that fit the cargo (a sawmill, a grain elevator, a port, a suburb station).
- hillName: a named hill, pass or grade on the route ("Cedar Hill", "Raven Pass").
- Never mention kinds of rail cars, numbers, tons, amounts or engine counts in any field. The app sets those.

The session title names the activity (e.g. "Train Yard: Rail Jobs"). The description is one child-friendly sentence with no numbers.`;
}

// ── Validation ──────────────────────────────────────────────────────────────────

/** Unmistakable cargo words and the form they require. Words not listed pass on the model's label. */
const KEYWORD_FORMS: ReadonlyArray<[RegExp, CargoForm]> = [
  [/^(grain|grains|corn|wheat|coal|sand|gravel|rock|rocks)$/, "loose_bulk"],
  [/^(oil|fuel|milk|water|juice|chemical|chemicals|gas|gasoline)$/, "liquid"],
  [/^(lumber|logs?|timber|pipes?|rails|beams?)$/, "long_bundles"],
  [/^(car|cars|trucks?|tractors?)$/, "vehicles"],
  [/^(commuters?|passengers?|riders?|fans?|tourists?|students?|people|travell?ers?)$/, "people"],
];

/** Words that mean the cargo is packed or a part, not the thing itself ("car parts", "bottles of milk"). */
const PACKED_WORDS = /^(parts?|bottles?|cans?|cartons?|crates?|boxes|bags?|jugs?|packages?|toys?|models?)$/;

/** The form a cargo's words require, or a contradiction reason; null when no rule applies. */
export function cargoContradiction(cargo: string, form: CargoForm): string | null {
  const words = cargo.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (words.some(w => PACKED_WORDS.test(w))) return null;
  for (const word of words) {
    for (const [pattern, required] of KEYWORD_FORMS) {
      if (pattern.test(word) && required !== form) return `"${word}" needs ${required}, got ${form}`;
    }
  }
  return null;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function validateJob(raw: unknown): { story: TrainJobStory } | { reason: string } {
  const j = (raw ?? {}) as Record<string, unknown>;
  const story = {
    title: str(j.title), cargo: str(j.cargo), cargoForm: str(j.cargoForm) as CargoForm,
    from: str(j.from), to: str(j.to), hillName: str(j.hillName),
  };
  const empty = (Object.keys(story) as (keyof typeof story)[]).filter(k => !story[k]);
  if (empty.length) return { reason: `empty ${empty.join(", ")}` };
  if (!CARGO_FORMS.includes(story.cargoForm)) return { reason: `bad cargoForm ${story.cargoForm}` };
  if (story.title.length > MAX_TITLE) return { reason: `title too long (${story.title.length})` };
  if (story.cargo.length > MAX_CARGO) return { reason: `cargo too long (${story.cargo.length})` };
  const clash = cargoContradiction(story.cargo, story.cargoForm);
  if (clash) return { reason: `cargo "${story.cargo}": ${clash}` };
  return { story };
}

/** Up to `n` jobs, distinct cargoForms first in the model's order, then the rest. */
export function selectJobs(stories: TrainJobStory[], n = SHIPPED): TrainJobStory[] {
  const seen = new Set<CargoForm>();
  const distinct: TrainJobStory[] = [];
  const rest: TrainJobStory[] = [];
  for (const s of stories) {
    if (seen.has(s.cargoForm)) rest.push(s);
    else { seen.add(s.cargoForm); distinct.push(s); }
  }
  let chosen = [...distinct, ...rest].slice(0, n);
  // People vs goods is the contrast a rail lesson is about, and the prompt asks for a people job only when the
  // lesson calls for one; so when the model wrote one, it ships even if it came after four other forms.
  const people = distinct.find(s => s.cargoForm === 'people');
  if (people && !chosen.includes(people)) chosen = [...chosen.slice(0, n - 1), people];
  // Keep the model's order among the chosen jobs.
  return stories.filter(s => chosen.includes(s));
}

// ── Fallback ────────────────────────────────────────────────────────────────────

const FALLBACK_STORIES: TrainJobStory[] = [
  { title: "Harvest Rush", cargo: "grain", cargoForm: "loose_bulk", from: "the grain elevator", to: "the port", hillName: "Cedar Hill" },
  { title: "Timber Run", cargo: "lumber", cargoForm: "long_bundles", from: "the sawmill", to: "the building site", hillName: "Pine Ridge Pass" },
  { title: "Winter Fuel", cargo: "heating oil", cargoForm: "liquid", from: "the refinery", to: "the fuel depot", hillName: "Raven Pass" },
  { title: "Morning Commute", cargo: "commuters", cargoForm: "people", from: "the suburb station", to: "downtown", hillName: "the River Bridge climb" },
];

// ── Generator ───────────────────────────────────────────────────────────────────

export const generateTrainYard = async (ctx: GenerationContext): Promise<TrainYardData> => {
  const band = trainYardBand(ctx);
  // Explicit pin wins; otherwise the intent resolves the task(s). null => mixed: one job of each task.
  const resolution = await resolveEvalModes(
    "train-yard",
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective?.text },
    CHALLENGE_TYPE_DOCS,
  );
  const tasks = (resolution?.allowedTypes ?? TRAIN_YARD_TASKS).filter(isTask);
  let title = "";
  let description = "";
  let rawJobs: unknown[] = [];

  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: buildPrompt(ctx, band),
      config: { responseMimeType: "application/json", responseSchema: schema },
    });
    const data = result.text ? JSON.parse(result.text) : null;
    title = str(data?.title);
    description = str(data?.description);
    rawJobs = Array.isArray(data?.jobs) ? data.jobs : [];
  } catch (err) {
    console.warn("[TrainYard] generation failed:", err);
  }

  let rejected = 0;
  const valid: TrainJobStory[] = [];
  const cargoSeen = new Set<string>();
  rawJobs.forEach((raw, i) => {
    const checked = validateJob(raw);
    if ("reason" in checked) {
      rejected++;
      console.warn(`[TrainYard] job ${i} rejected: ${checked.reason}`);
      return;
    }
    const key = checked.story.cargo.toLowerCase();
    if (cargoSeen.has(key)) {
      rejected++;
      console.warn(`[TrainYard] job ${i} rejected: duplicate cargo "${checked.story.cargo}"`);
      return;
    }
    cargoSeen.add(key);
    valid.push(checked.story);
  });

  let stories: TrainJobStory[];
  if (valid.length < MIN_VALID) {
    console.warn(`[TrainYard] only ${valid.length} valid job(s) of ${rawJobs.length} — using fallback stories`);
    stories = FALLBACK_STORIES;
  } else {
    stories = selectJobs(valid);
  }

  // An engines-only session drops light trains when it can: they always need one engine, the first click.
  if (tasks.length === 1 && tasks[0] === "enough_pull") {
    const freightOnly = (valid.length >= MIN_VALID ? valid : FALLBACK_STORIES).filter(s => !lightTrain(s));
    if (freightOnly.length >= MIN_VALID) stories = selectJobs(freightOnly);
  }

  const targets = ENGINE_TARGETS[band];
  const jobTasks = assignTasks(stories, tasks.length ? tasks : ["build_train"]);
  // Engine targets cycle over the freight jobs only, so an engines task gets a count above 1 where the band has one.
  let freight = 0;
  const challenges: TrainYardChallenge[] = stories.map((story, i) =>
    buildTrainYardChallenge(story, {
      id: `ty-${i + 1}`,
      band,
      type: jobTasks[i],
      targetEngines: lightTrain(story) ? 1
        : jobTasks[i] === "enough_pull" ? Math.max(2, targets[freight++ % targets.length])
        : targets[freight++ % targets.length],
    }));

  console.log(
    `[TrainYard] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join("+")} (${resolution.source})` : "mixed"}`
      + ` jobs: ${challenges.map(c => `${c.type}:${c.cargo}/${c.cargoForm}`).join(", ")} band=${band} rejected=${rejected}`,
  );

  return {
    title: title && !/\d/.test(title) ? title : "Train Yard: Rail Jobs",
    description: description && !/\d/.test(description)
      ? description
      : "Build the right train for each job and get every load over the hill.",
    challenges,
    // One task: that task. Mixed or a blend: the hardest task in the session (each job carries its own).
    challengeType: TRAIN_YARD_TASKS.filter(t => jobTasks.includes(t)).pop() ?? "build_train",
    gradeBand: band,
    // Where the levers start (`trainYardLevers.startLevers`); the numbers and tasks never change with it.
    ...(ctx.supportTier ? { supportTier: ctx.supportTier } : {}),
  };
};
