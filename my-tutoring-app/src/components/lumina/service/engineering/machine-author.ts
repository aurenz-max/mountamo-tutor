/**
 * Machine Workshop's author agent. Given the lesson, it picks real machines that fit it and names, in order, the parts
 * each one is built from and the job each part does. Code then holds it to two checks before any child sees it:
 *
 *   1. it ASSEMBLES (`assemblyErrors`, the bench's own motion table): source first, each stage fed the motion it takes,
 *      one part that turns spinning into up-and-down, a working end last;
 *   2. it is the REAL machine (`fidelityErrors` against `machineAtlas.ts`): the agent is told only the machine's name,
 *      never its parts, so naming the right parts in the right order is the agent's own work.
 *
 * Plus the words: no stage's job may name the converter's parts (the child builds it), and the principle sentence
 * must say both the round motion and the up-and-down one. Errors go back to the agent once, as a repair turn; a
 * machine still wrong after that is replaced by the atlas's own words for a machine that fits the lesson, so a
 * lesson never breaks. Code owns every number (`buildItem`); the agent writes no size, stroke or answer.
 */
import { Type, type Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  CHAIN_KINDS, KIND_NAMES, MOTION, assemblyErrors, isConverter, type ChainKind, type ItemWords, type Rng,
} from "../../primitives/visual-primitives/engineering/machineModel";
import {
  ATLAS_IDS, MACHINE_ATLAS, atlasMachine, atlasWords, fidelityErrors, type AtlasMachine,
} from "../../primitives/visual-primitives/engineering/machineAtlas";

export const AUTHOR_MODEL = "gemini-flash-latest";

/** What the agent returns for one machine. */
export interface AuthoredMachine {
  machine: string;
  intro: string;
  principle: string;
  doesWord: string;
  stages: Array<{ part: string; job: string }>;
}

export interface AuthorLesson { topic: string; intent?: string; objective?: string; gradeLevel: string; grade?: string }

/** `errors`: why the agent's machine was replaced by the atlas; `firstErrors`: what a repaired machine first got wrong. */
export interface AuthorPick { words: ItemWords; source: 'agent' | 'repaired' | 'atlas'; errors: string[]; firstErrors?: string[] }
export interface AuthorResult { picks: AuthorPick[]; calls: number; failure?: string }

// Words that name the converter's parts: the child builds that part, so no other stage may say them.
const CONVERTER_WORDS = /\b(crank|cranks|cam|cams|camshaft|connecting|follower|pitman|eccentric)\b/i;
const ROUND_WORDS = /\b(round|circle|circles|turn|turns|turning|spin|spins|spinning|rotat\w*)\b/i;
const UPDOWN_WORDS = /\b(up|down|push|pushes|pull|pulls|lift|lifts|drop|drops|falls?|rock|rocks|back and forth)\b/i;

/**
 * Every reason this authored machine cannot go on the bench, or none. Pure: the tests and the agent's repair turn both
 * read these messages.
 */
export function authoredErrors(m: AuthoredMachine): string[] {
  const atlas = atlasMachine(m.machine);
  if (!atlas) return [`"${m.machine}" is not a machine the workshop knows; pick one of: ${ATLAS_IDS.join(', ')}`];
  const errs: string[] = [];
  const kinds = (m.stages ?? []).map(s => s.part);
  const unknown = kinds.filter(k => !(CHAIN_KINDS as readonly string[]).includes(k));
  if (unknown.length) return [`unknown parts: ${unknown.join(', ')}; use only: ${CHAIN_KINDS.join(', ')}`];
  const chain = kinds as ChainKind[];
  errs.push(...assemblyErrors(chain).map(e => `does not assemble: ${e}`));
  errs.push(...fidelityErrors(atlas, chain).map(e => `not the real machine: ${e}`));
  (m.stages ?? []).forEach((s, i) => {
    const job = (s.job ?? '').trim();
    if (!job) errs.push(`stage ${i + 1} (${s.part}) has no job`);
    else if (job.length > 110) errs.push(`stage ${i + 1} (${s.part}) job is longer than 110 characters`);
    if (!isConverter(s.part as ChainKind) && s.part !== 'hand_crank' && CONVERTER_WORDS.test(job))
      errs.push(`stage ${i + 1} (${s.part}) job names the part the child must build ("${job.match(CONVERTER_WORDS)?.[0]}"); describe only what this stage does`);
  });
  if (CONVERTER_WORDS.test(m.intro ?? '')) errs.push('the intro names the part the child must build; leave it out');
  if (CONVERTER_WORDS.test(m.doesWord ?? '')) errs.push('doesWord names the part the child must build');
  if (!m.intro?.trim() || m.intro.length > 160) errs.push('intro must be one sentence under 160 characters');
  if (!m.doesWord?.trim() || m.doesWord.length > 60) errs.push('doesWord must be a short verb phrase under 60 characters, like "pumps oil up from underground"');
  const p = m.principle ?? '';
  if (!p.trim() || p.length > 240) errs.push('principle must be one or two sentences under 240 characters');
  else if (!ROUND_WORDS.test(p) || !UPDOWN_WORDS.test(p))
    errs.push('principle must say how the round-and-round motion becomes the up-and-down motion in this machine');
  return errs;
}

/** An authored machine that passed, as the item's words (the fluid comes from the atlas: it is a fact, not prose). */
export function authoredWords(m: AuthoredMachine): ItemWords {
  const atlas = atlasMachine(m.machine)!;
  return {
    machine: atlas.id, name: atlas.name, where: atlas.where, intro: m.intro.trim(), principle: m.principle.trim(),
    doesWord: m.doesWord.trim().replace(/[.!]+$/, ''), ...(atlas.fluid ? { fluid: atlas.fluid } : {}),
    stages: m.stages.map(s => ({ kind: s.part as ChainKind, job: s.job.trim() })), real: atlas.converter,
  };
}

// ── The prompt ──────────────────────────────────────────────────────────────

const PART_LIBRARY: Record<ChainKind, string> = {
  motor: 'power source: an electric or engine motor that spins',
  hand_crank: 'power source: a handle a person turns round',
  windmill: 'power source: a wind wheel that spins in the wind',
  water_wheel: 'power source: a wheel a river pushes round',
  belt: 'carries spinning from one shaft to another (often slows it)',
  gearbox: 'gears that slow spinning down and make it stronger',
  crank_rod: 'a crank (a disc with a pin off-centre) and a connecting rod: turns spinning into a steady up-and-down push and pull',
  cam_follower: 'a cam (a wheel with a bump) and a follower resting on it: turns spinning into a lift and a drop',
  walking_beam: 'a beam on a pivot, like a seesaw: one end goes up as the other goes down',
  pump: 'working end: a piston pump (oil, water or air)',
  needle: 'working end: a sewing needle',
  saw: 'working end: a saw blade',
  stamp: 'working end: a heavy stamp or hammer that is lifted and dropped',
  figure: 'working end: a toy figure that moves',
};

const libraryText = () => CHAIN_KINDS.map(k => {
  const mo = MOTION[k];
  return `- ${k}: ${PART_LIBRARY[k]} [in: ${mo.in ?? 'nothing'}; out: ${mo.out ?? 'does the work'}]`;
}).join('\n');

const machinesText = () => MACHINE_ATLAS.map(m => `- ${m.id}: ${m.name} (${m.where})`).join('\n');

function lessonText(l: AuthorLesson): string {
  return [`Topic: ${l.topic}`, l.intent ? `Intent: ${l.intent}` : '', l.objective ? `Objective: ${l.objective}` : '',
    `Grade: ${l.grade ?? l.gradeLevel}`].filter(Boolean).join('\n');
}

function authorPrompt(l: AuthorLesson, count: number): string {
  return `You are designing machines for a children's machine workshop. Each machine turns SPINNING into UP-AND-DOWN motion.
A child will see the machine on a workbench with one stage missing (the part that turns spinning into up-and-down) and build it.

LESSON
${lessonText(l)}

PARTS LIBRARY (motion flows from each stage into the next)
${libraryText()}

MACHINES THE WORKSHOP CAN BUILD
${machinesText()}

TASK
Pick ${count} DIFFERENT machines from the list that best fit this lesson (closest to its topic first). For each one, list
the stages of the REAL machine from its power source to its working end, in the order power flows, using only part names
from the library. Include every stage a real one has, and only those. Then write, for a child at this grade:
- job: for each stage, what it does in THIS machine (one short sentence). Only the crank_rod or cam_follower stage may
  mention a crank, cam, rod or follower; every other stage must not mention them.
- intro: one sentence saying what this machine is for, without naming its crank or cam.
- doesWord: a short verb phrase for what it does when it works, e.g. "pumps oil up from underground".
- principle: one or two sentences on how the round-and-round motion becomes up-and-down in this machine.`;
}

function repairPrompt(l: AuthorLesson, bad: Array<{ m: AuthoredMachine; errors: string[] }>): string {
  return `${authorPrompt(l, bad.length)}

YOUR PREVIOUS ANSWER HAD PROBLEMS. Fix each machine below and return the corrected machines (you may keep the same
machine; return exactly ${bad.length}).
${bad.map(({ m, errors }) => `Machine ${m.machine}: ${JSON.stringify(m.stages.map(s => s.part))}\n${errors.map(e => `  - ${e}`).join('\n')}`).join('\n')}`;
}

const SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    machines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          machine: { type: Type.STRING, enum: [...ATLAS_IDS] },
          intro: { type: Type.STRING },
          doesWord: { type: Type.STRING },
          principle: { type: Type.STRING },
          stages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { part: { type: Type.STRING, enum: [...CHAIN_KINDS] }, job: { type: Type.STRING } },
              required: ['part', 'job'],
            },
          },
        },
        required: ['machine', 'intro', 'doesWord', 'principle', 'stages'],
      },
    },
  },
  required: ['machines'],
};

async function callAgent(prompt: string): Promise<AuthoredMachine[]> {
  const result = await ai.models.generateContent({
    model: AUTHOR_MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.7 },
  });
  const parsed = JSON.parse(result.text ?? '{}') as { machines?: AuthoredMachine[] };
  return Array.isArray(parsed.machines) ? parsed.machines : [];
}

// ── The fallback pick ───────────────────────────────────────────────────────

/** Atlas machines ranked by how many of their topic words the lesson mentions; ties keep a random order. */
export function rankAtlas(l: AuthorLesson, rng: Rng): AtlasMachine[] {
  const text = `${l.topic} ${l.intent ?? ''} ${l.objective ?? ''}`.toLowerCase();
  const scored = MACHINE_ATLAS.map(m => ({ m, s: m.topics.filter(t => text.includes(t)).length + rng() * 0.5 }));
  return scored.sort((a, b) => b.s - a.s).map(x => x.m);
}

/**
 * Up to `count` machines for the lesson: the agent's where they pass both checks (first answer or after one repair),
 * the atlas's own words for the rest. Never throws.
 */
export async function authorMachines(l: AuthorLesson, count: number, rng: Rng,
  call: (prompt: string) => Promise<AuthoredMachine[]> = callAgent): Promise<AuthorResult> {
  const picks: AuthorPick[] = [];
  const used = new Set<string>();
  let calls = 0;
  let failure: string | undefined;
  const take = (m: AuthoredMachine, source: AuthorPick['source']) => {
    if (picks.length >= count || used.has(m.machine)) return;
    used.add(m.machine);
    picks.push({ words: authoredWords(m), source, errors: [] });
  };
  try {
    calls++;
    const first = await call(authorPrompt(l, count));
    const bad: Array<{ m: AuthoredMachine; errors: string[] }> = [];
    for (const m of first) {
      const errors = authoredErrors(m);
      if (errors.length) bad.push({ m, errors });
      else take(m, 'agent');
    }
    const stillNeeded = bad.filter(b => !used.has(b.m.machine)).slice(0, count - picks.length);
    if (stillNeeded.length && picks.length < count) {
      calls++;
      const fixed = await call(repairPrompt(l, stillNeeded));
      for (const m of fixed) {
        const errors = authoredErrors(m);
        if (!errors.length) {
          take(m, 'repaired');
          // Keep what the first answer got wrong, for the report.
          const was = stillNeeded.find(b => b.m.machine === m.machine);
          const pick = picks.find(p => p.words.machine === m.machine);
          if (was && pick) pick.firstErrors = was.errors;
        }
        else if (!used.has(m.machine)) stillNeeded.push({ m, errors });
      }
    }
    // Record what was rejected on the machines that fall back, for the report.
    for (const b of stillNeeded) {
      if (picks.length >= count) break;
      const atlas = atlasMachine(b.m.machine);
      if (atlas && !used.has(atlas.id)) { used.add(atlas.id); picks.push({ words: atlasWords(atlas), source: 'atlas', errors: b.errors }); }
    }
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e);
    if (/LUMINA_BUDGET/.test(failure)) console.warn('[machine-author] spend cap reached; using the atlas');
  }
  for (const m of rankAtlas(l, rng)) {
    if (picks.length >= count) break;
    if (used.has(m.id)) continue;
    used.add(m.id);
    picks.push({ words: atlasWords(m), source: 'atlas', errors: [] });
  }
  const rejected = picks.filter(p => p.errors.length).length;
  if (rejected || failure) console.log(`[machine-author] ${picks.filter(p => p.source !== 'atlas').length}/${count} from the agent; ${rejected} rejected after repair${failure ? `; agent failed: ${failure}` : ''}`);
  return { picks, calls, ...(failure ? { failure } : {}) };
}

/** For messages: the part list a stage chain names, in words. */
export const chainWords = (chain: readonly ChainKind[]) => chain.map(k => KIND_NAMES[k]).join(' → ');
