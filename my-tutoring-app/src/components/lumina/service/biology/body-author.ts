/**
 * Body Workshop's author agent. Given the lesson and the task, it picks real animals that fit it and names, in order,
 * the body parts oxygen (deliver_oxygen) or food (fuel_the_body) passes through in each one, with a child's sentence for what each part does. Code then holds it to checks
 * before any child sees it (the pattern of `engineering/machine-author.ts`):
 *
 *   1. it FLOWS (`flowErrors`, the flow table in `bodyModel.ts`): each part takes what the one before passes on;
 *   2. it is the REAL animal (`fidelityErrors` against `bodyAtlas.ts`): the agent gets only the animal's name;
 *   3. the words fit K-5: the intro names no breathing part (the child builds the path), no middle-school words
 *      (alveoli, trachea, spiracle, capillary, hemoglobin, diffusion, respiration), short sentences.
 *
 * Errors go back to the agent once as a repair turn; an animal still wrong after that gets the atlas's own words, so a
 * lesson never breaks. Code owns the bench, the goal and every check.
 */
import { Type, type Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  BODY_PARTS, FLOW, PART_NAMES, TOKEN_WORDS, flowErrors, type BodyGoal, type BodyPart, type BodyTask, type Rng, type Token,
} from "../../primitives/visual-primitives/biology/bodyModel";
import {
  ATLAS_IDS, atlasAnimal, fidelityErrors, jobOf, type AtlasAnimal,
} from "../../primitives/visual-primitives/biology/bodyAtlas";

export const AUTHOR_MODEL = "gemini-flash-latest";

export interface AuthoredAnimal {
  animal: string;
  intro: string;
  principle: string;
  path: Array<{ part: string; job: string }>;
}

/** The checked words for one animal. */
export interface AnimalWords {
  animal: string;
  intro: string;
  principle: string;
  jobs: Partial<Record<BodyPart, string>>;
}

export interface AuthorLesson { topic: string; intent?: string; objective?: string; gradeLevel: string; grade?: string }
export interface AuthorPick { words: AnimalWords; source: 'agent' | 'repaired' | 'atlas'; errors: string[]; firstErrors?: string[] }
export interface AuthorResult { picks: AuthorPick[]; calls: number; failure?: string }

/** Words that name a breathing part: the intro must not give the path away. */
const PART_WORDS = /\b(lungs?|gills?|blowhole|windpipe|trachea|spiracles?|breathing holes?|air tubes?|skin|heart|blood|nose|nostrils?|mouth|breathes? (through|with)|stomachs?|intestines?|guts?|crop|gizzards?|esophagus|digest\w*)\b/i;
/** Middle-school words: K-5 never needs them. */
const TOO_HARD = /\b(alveol\w*|trache\w*|spiracl\w*|capillar\w*|hemoglobin|haemoglobin|diffus\w*|respirat\w*|bronch\w*|oxygenat\w*|pulmonary|circulatory|cellular)\b/i;

export function authoredErrors(m: AuthoredAnimal, task: BodyTask, goal: BodyGoal, allowed: readonly string[]): string[] {
  const atlas = atlasAnimal(m.animal);
  if (!atlas || !allowed.includes(m.animal) || !jobOf(atlas, task)) return [`"${m.animal}" is not an animal you may pick here; pick from: ${allowed.join(', ')}`];
  const source: Token = task === 'fuel_the_body' ? 'outside_food' : atlas.medium;
  const parts = (m.path ?? []).map(s => s.part);
  const unknown = parts.filter(p => !(BODY_PARTS as readonly string[]).includes(p));
  if (unknown.length) return [`unknown parts: ${unknown.join(', ')}; use only: ${BODY_PARTS.join(', ')}`];
  const path = parts as BodyPart[];
  const errs: string[] = [
    ...flowErrors(task, goal, source, path).map(e => `the path does not work: ${e}`),
    ...fidelityErrors(atlas, task, goal, path).map(e => `not the real animal: ${e}`),
  ];
  (m.path ?? []).forEach((s, i) => {
    const job = (s.job ?? '').trim();
    if (!job) errs.push(`part ${i + 1} (${s.part}) has no job`);
    else if (job.length > 90) errs.push(`part ${i + 1} (${s.part}) job is longer than 90 characters`);
    if (TOO_HARD.test(job)) errs.push(`part ${i + 1} job uses "${job.match(TOO_HARD)?.[0]}": too hard for grades K-5; use everyday words`);
  });
  const intro = (m.intro ?? '').trim();
  if (!intro || intro.length > 140) errs.push('intro must be one sentence under 140 characters');
  if (PART_WORDS.test(intro)) errs.push(`the intro says "${intro.match(PART_WORDS)?.[0]}", which gives away the path the child builds; say where the animal lives and what it does, not how it breathes`);
  const p = (m.principle ?? '').trim();
  if (!p || p.length > 220) errs.push('principle must be one or two short sentences under 220 characters');
  else if (!(task === 'fuel_the_body' ? /\bfood\b/i : /\boxygen\b/i).test(p))
    errs.push(`principle must say how the ${task === 'fuel_the_body' ? 'food' : 'oxygen'} gets there`);
  for (const [name, text] of [['intro', intro], ['principle', p]] as const)
    if (TOO_HARD.test(text)) errs.push(`${name} uses "${text.match(TOO_HARD)?.[0]}": too hard for grades K-5; use everyday words`);
  return errs;
}

export function authoredWords(m: AuthoredAnimal): AnimalWords {
  const jobs: Partial<Record<BodyPart, string>> = {};
  for (const s of m.path) jobs[s.part as BodyPart] = s.job.trim();
  return { animal: m.animal, intro: m.intro.trim(), principle: m.principle.trim(), jobs };
}

export const atlasWords = (a: AtlasAnimal, task: BodyTask, goal: BodyGoal): AnimalWords => {
  const j = jobOf(a, task)!;
  return { animal: a.id, intro: a.intro, principle: j.principle[goal], jobs: j.jobs };
};

// ── The prompt ──────────────────────────────────────────────────────────────

const libraryText = () => BODY_PARTS.map(p => {
  const ins = Object.entries(FLOW[p]).map(([i, o]) => `${TOKEN_WORDS[i as Token]} → ${TOKEN_WORDS[o as Token]}`).join('; ');
  return `- ${p} (${PART_NAMES[p]}): ${ins}`;
}).join('\n');

const GOAL_TEXT: Record<BodyTask, Record<BodyGoal, string>> = {
  deliver_oxygen: {
    into_body: 'OXYGEN takes from where the animal lives INTO ITS BLOOD (stop once oxygen is in the body)',
    to_muscle: 'OXYGEN takes from where the animal lives all the way TO A WORKING MUSCLE (through the heart and blood tubes where the animal uses them)',
  },
  fuel_the_body: {
    into_body: 'FOOD takes from the animal\'s mouth INTO ITS BLOOD (swallowed, mashed or ground up, then soaked into the blood)',
    to_muscle: 'FOOD takes from the animal\'s mouth all the way TO A WORKING MUSCLE (into the blood, then through the heart and blood tubes)',
  },
};

function lessonText(l: AuthorLesson): string {
  return [`Topic: ${l.topic}`, l.intent ? `Intent: ${l.intent}` : '', l.objective ? `Objective: ${l.objective}` : '',
    `Grade: ${l.grade ?? l.gradeLevel}`].filter(Boolean).join('\n');
}

function authorPrompt(l: AuthorLesson, task: BodyTask, goal: BodyGoal, allowed: readonly AtlasAnimal[], mustOne: readonly AtlasAnimal[], count: number): string {
  return `You are writing for a children's body workshop (grades K-5). A child builds, from picture buttons, the path
${GOAL_TEXT[task][goal]}.

LESSON
${lessonText(l)}

BODY PARTS (what each takes in → passes on)
${libraryText()}

ANIMALS YOU MAY PICK
${allowed.map(a => `- ${a.id}: ${a.name}`).join('\n')}

TASK
Pick ${count} DIFFERENT animals that best fit this lesson${mustOne.length ? `; at least one must be one of: ${mustOne.map(a => a.id).join(', ')}` : ''}.
For each, list the parts of the REAL animal's path in order, using only part ids above: every part a real one uses, and only those.
Write for a young child: short sentences, everyday words (no alveoli, trachea, spiracle, capillary, diffusion, respiration).
- job: for each part, what it does in this animal (one short sentence).
- intro: one sentence about where the animal lives and what it does. Do NOT mention how it ${task === 'fuel_the_body' ? 'eats or digests' : 'breathes'} or any body part.
- principle: one or two short sentences on how the ${task === 'fuel_the_body' ? 'food' : 'oxygen'} gets there in this animal.`;
}

function repairPrompt(base: string, bad: Array<{ m: AuthoredAnimal; errors: string[] }>): string {
  return `${base}

YOUR PREVIOUS ANSWER HAD PROBLEMS. Fix each animal below and return exactly ${bad.length} corrected animals.
${bad.map(({ m, errors }) => `Animal ${m.animal}: ${JSON.stringify((m.path ?? []).map(s => s.part))}\n${errors.map(e => `  - ${e}`).join('\n')}`).join('\n')}`;
}

const SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    animals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          animal: { type: Type.STRING, enum: [...ATLAS_IDS] },
          intro: { type: Type.STRING },
          principle: { type: Type.STRING },
          path: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { part: { type: Type.STRING, enum: [...BODY_PARTS] }, job: { type: Type.STRING } },
              required: ['part', 'job'],
            },
          },
        },
        required: ['animal', 'intro', 'principle', 'path'],
      },
    },
  },
  required: ['animals'],
};

async function callAgent(prompt: string): Promise<AuthoredAnimal[]> {
  const result = await ai.models.generateContent({
    model: AUTHOR_MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.8 },
  });
  const parsed = JSON.parse(result.text ?? '{}') as { animals?: AuthoredAnimal[] };
  return Array.isArray(parsed.animals) ? parsed.animals : [];
}

/** Animals ranked by how many of their topic words the lesson mentions; ties keep a random order. */
export function rankAnimals(l: AuthorLesson, pool: readonly AtlasAnimal[], rng: Rng): AtlasAnimal[] {
  const text = `${l.topic} ${l.intent ?? ''} ${l.objective ?? ''}`.toLowerCase();
  return pool.map(a => ({ a, s: a.topics.filter(t => text.includes(t)).length + rng() * 0.5 }))
    .sort((x, y) => y.s - x.s).map(x => x.a);
}

/**
 * Up to `count` animals for the lesson: the agent's where they pass every check (first answer or after one repair),
 * the atlas's words for the rest. When `mustOne` is set, at least one pick comes from it. Never throws.
 */
export async function authorAnimals(l: AuthorLesson, task: BodyTask, goal: BodyGoal, allowed: readonly AtlasAnimal[], mustOne: readonly AtlasAnimal[],
  count: number, rng: Rng, call: (prompt: string) => Promise<AuthoredAnimal[]> = callAgent): Promise<AuthorResult> {
  const ids = allowed.map(a => a.id);
  const picks: AuthorPick[] = [];
  const used = new Set<string>();
  let calls = 0;
  let failure: string | undefined;
  const take = (words: AnimalWords, source: AuthorPick['source'], errors: string[] = []) => {
    if (picks.length >= count || used.has(words.animal)) return;
    used.add(words.animal);
    picks.push({ words, source, errors });
  };
  try {
    const base = authorPrompt(l, task, goal, allowed, mustOne, count);
    calls++;
    const first = await call(base);
    const bad: Array<{ m: AuthoredAnimal; errors: string[] }> = [];
    for (const m of first) {
      const errors = authoredErrors(m, task, goal, ids);
      if (errors.length) bad.push({ m, errors }); else take(authoredWords(m), 'agent');
    }
    const retry = bad.filter(b => !used.has(b.m.animal)).slice(0, count - picks.length);
    if (retry.length && picks.length < count) {
      calls++;
      for (const m of await call(repairPrompt(base, retry))) {
        const errors = authoredErrors(m, task, goal, ids);
        if (errors.length) continue;
        take(authoredWords(m), 'repaired');
        const was = retry.find(b => b.m.animal === m.animal);
        const pick = picks.find(p => p.words.animal === m.animal);
        if (was && pick) pick.firstErrors = was.errors;
      }
    }
    for (const b of retry) {
      const a = atlasAnimal(b.m.animal);
      if (a && ids.includes(a.id)) take(atlasWords(a, task, goal), 'atlas', b.errors);
    }
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e);
    if (/LUMINA_BUDGET/.test(failure)) console.warn('[body-author] spend cap reached; using the atlas');
  }
  for (const a of rankAnimals(l, allowed, rng)) take(atlasWords(a, task, goal), 'atlas');
  // The tier's contrast: at least one of `mustOne`.
  if (mustOne.length && !picks.some(p => mustOne.some(a => a.id === p.words.animal))) {
    const swap = rankAnimals(l, mustOne, rng)[0];
    picks[picks.length - 1] = { words: atlasWords(swap, task, goal), source: 'atlas', errors: [] };
  }
  const fromAgent = picks.filter(p => p.source !== 'atlas').length;
  if (fromAgent < count || failure) console.log(`[body-author] ${fromAgent}/${count} from the agent${failure ? `; agent failed: ${failure}` : ''}`);
  return { picks, calls, ...(failure ? { failure } : {}) };
}
