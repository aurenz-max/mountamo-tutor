import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type { TelescopeSimulatorData } from '../../primitives/visual-primitives/astronomy/TelescopeSimulator';
import {
  buildTelescopeItems, defaultModes, TELESCOPE_MODES, type TelescopeMode, type TelescopeTier,
} from '../../primitives/visual-primitives/astronomy/telescopeWorkspace';
import { resolveEvalModes, type ChallengeTypeDoc } from '../evalMode';

export type { TelescopeSimulatorData };

/**
 * Telescope Simulator generator (rebuilt 2026-10-16 under the 10-15 ruling). Gemini reads the topic and writes only
 * the frame: a title and a one-sentence overview. Every item, object, position, choice and key is built by code from
 * a table of real sky objects (`telescopeWorkspace.ts`, `buildTelescopeItems`). The old schema had the model place
 * every object and force Venus into the targets; the component drew each target's name with a ring around it and
 * scored the share of objects explored.
 * `config.difficulty` picks the structural band: how many objects or choices, and how alike they are (easy: far
 * apart; medium: one with the same shape, closer brightness, a third choice; hard: a look-alike missing one clue, a big
 * faint patch, both look-alike kinds through binoculars, four instruments).
 */
const CHALLENGE_TYPE_DOCS: Record<TelescopeMode, ChallengeTypeDoc> = {
  find_by_look: { promptDoc: 'find one unnamed object in a telescope view from a description of its look', schemaDescription: 'Find by look' },
  brightest: { promptDoc: 'tap the brightest of a few unnamed objects seen through binoculars', schemaDescription: 'Brightest' },
  object_type: { promptDoc: 'say what kind of object is in the view: moon, planet, star, star cluster, nebula or galaxy', schemaDescription: 'Object type' },
  pick_instrument: { promptDoc: 'pick the least powerful instrument (eyes, binoculars, small, large or space telescope) that shows a named detail', schemaDescription: 'Pick the instrument' },
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title for the telescope session, e.g. 'Night Sky Detective'. Never names an object or a kind of object." },
    overview: { type: Type.STRING, description: "One neutral sentence about what the learner will do with the telescope. Names no object, no kind of object and no instrument." },
  },
  required: ["title", "overview"],
};

/**
 * Resolve the telescope's working grade rung ('2'|'3'|'4'|'5') from the canonical curriculum grade, applying the
 * primitive's BAND FLOOR (reader-fit 2026-08-06: anything below '2' clamps to '2'). `ctx.grade` is canonical and
 * authoritative; the prose band is the fallback. Returns null with no canonical grade.
 */
export const telescopeGradeFromGrade = (
  grade?: string,
): '2' | '3' | '4' | '5' | null => {
  const g = (grade ?? '').toString().trim().toUpperCase();
  if (!g) return null;
  if (g === 'K') return '2';
  const n = parseInt(g, 10);
  if (isNaN(n)) return null;
  if (n <= 2) return '2';
  if (n >= 5) return '5';
  return String(n) as '3' | '4';
};

/** Legacy prose fallback — kept as the second resolver, never the first. */
const telescopeGradeFromProse = (prose?: string): '2' | '3' | '4' | '5' => {
  const p = (prose ?? '').toLowerCase();
  if (/\b(kindergarten|preschool|grade 1|1st grade|grade 2|2nd grade)\b/.test(p)) return '2';
  if (/\b(grade 3|3rd grade)\b/.test(p)) return '3';
  if (/\b(grade 4|4th grade)\b/.test(p)) return '4';
  if (/\b(grade 5|5th grade|middle|high school)\b/.test(p)) return '5';
  return '2';
};

const normalizeTier = (d?: unknown): TelescopeTier => {
  const t = String(d ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

export const generateTelescopeSimulator = async (
  ctx: GenerationContext,
): Promise<TelescopeSimulatorData> => {
  const { topic } = ctx;
  const gradeLevel = telescopeGradeFromGrade(ctx.grade) ?? telescopeGradeFromProse(ctx.gradeContext);
  const config = (ctx.raw ?? {}) as { difficulty?: string };
  const resolution = await resolveEvalModes(
    'telescope-simulator',
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective?.text },
    CHALLENGE_TYPE_DOCS,
  );
  const modes: TelescopeMode[] = resolution
    ? TELESCOPE_MODES.filter(m => resolution.allowedTypes.includes(m))
    : defaultModes(gradeLevel);
  const tier = normalizeTier(ctx.supportTier ?? config.difficulty);
  console.log(`[telescope-simulator] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join('+')} (${resolution.source})` : `grade ${gradeLevel} default`} → [${modes.join(', ')}], tier ${tier}`);

  const intent = ctx.intent ? `\nLEARNING FOCUS: "${ctx.intent}".` : '';
  const prompt = `Frame a virtual telescope session about "${topic}" for grade ${gradeLevel}.${intent}

Code builds every question and picks every object in the sky.
The learner will: ${modes.map(m => CHALLENGE_TYPE_DOCS[m].promptDoc).join('; ')}.

Return only:
1. title: short and inviting. Names no object (no "Saturn", "Venus", "Moon") and no kind of object.
2. overview: one neutral sentence about looking through the telescope at the night sky. Names no object, kind of object
   or instrument. Describe only this telescope task, even when the subject above is about something else: no counting,
   numbers or other subjects.`;

  let raw: { title?: string; overview?: string } = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        systemInstruction: 'You are a science teacher framing a telescope session. You never name or describe a sky object.',
      },
    });
    raw = JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('[telescope-simulator] framing call failed; using the topic-neutral frame', error);
  }

  const items = buildTelescopeItems({ modes, tier, rng: Math.random });
  const data: TelescopeSimulatorData = {
    title: raw.title?.trim() || 'Night Sky Observer',
    overview: raw.overview?.trim() || 'Look through the eyepiece and answer what you see.',
    gradeLevel,
    challengeTypes: modes,
    difficulty: tier,
    items,
  };
  console.log('🔭 Telescope Simulator Generated:', { title: data.title, gradeLevel, tier, modes, items: items.map(i => i.id) });
  return data;
};
