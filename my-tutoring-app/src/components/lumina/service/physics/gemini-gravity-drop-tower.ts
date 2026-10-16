import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import type { GravityDropTowerData } from '../../primitives/visual-primitives/physics/GravityDropTower';
import {
  buildDropItems, DROP_MODES, type DropMode, type DropTier,
} from '../../primitives/visual-primitives/physics/gravityDropWorkspace';
import { resolveEvalModeConstraint, logEvalModeResolution, type ChallengeTypeDoc } from '../evalMode';

export type { GravityDropTowerData };

/**
 * Gravity Drop Tower generator. Gemini reads the topic and writes only the frame: a title and one neutral sentence.
 * Every item, object, height, choice and key is built by code (`gravityDropWorkspace.ts`, `buildDropItems`) from one
 * physics model: before 2026-10-15 the model wrote each question and its answer string, so a key could disagree with
 * what the sim drew, and the instruction or the readouts often gave the answer. `config.difficulty` picks the
 * structural band (observe: air pair / no-air pair / speeding up; predict: contrast pairs / same-mass shapes / outcome
 * and reason; compare: same object / mass against height / air against height; measure: 4x step / 9x step / height
 * for a time; calculate: time / height / impact speed).
 */
const CHALLENGE_TYPE_DOCS: Record<DropMode, ChallengeTypeDoc> = {
  observe: { promptDoc: 'observe: drop objects and watch, then tell which landed first or whether it sped up', schemaDescription: 'Watch and tell' },
  predict: { promptDoc: 'predict: say which of two objects lands first before they are dropped (with or without air)', schemaDescription: 'Predict the landing' },
  compare: { promptDoc: 'compare: put three drops from different heights in landing order', schemaDescription: 'Landing order' },
  measure: { promptDoc: 'measure: use a stopwatch table to find the fall time for a new height', schemaDescription: 'Fall time from a table' },
  calculate: { promptDoc: 'calculate: use h = 1/2 g t^2 for a fall time, a height or an impact speed', schemaDescription: 'Free-fall calculation' },
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title for the activity, e.g. 'The Great Drop Test'. Never states a result." },
    description: { type: Type.STRING, description: 'One neutral sentence about what the learner investigates. Never says which object lands first or that mass does not matter.' },
  },
  required: ['title', 'description'],
};

/** Modes by canonical grade when the lesson pins none (the catalog's constraints). */
export function defaultDropModes(grade?: string): DropMode[] {
  const g = (grade ?? '').trim().toUpperCase();
  const n = g === 'K' ? 0 : parseInt(g, 10);
  if (Number.isNaN(n)) return ['predict', 'compare'];
  if (n <= 0) return ['observe'];
  if (n === 1) return ['observe', 'predict'];
  if (n <= 3) return ['predict', 'compare'];
  if (n === 4) return ['compare', 'measure'];
  if (n === 5) return ['measure'];
  if (n === 6) return ['measure', 'calculate'];
  return ['calculate'];
}

const normalizeTier = (d?: string): DropTier => {
  const t = (d ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

export const generateGravityDropTower = async (ctx: GenerationContext): Promise<GravityDropTowerData> => {
  const { topic } = ctx;
  const config = (ctx.raw ?? {}) as { difficulty?: string; targetEvalMode?: string };
  const constraint = resolveEvalModeConstraint('gravity-drop-tower', ctx.targetEvalMode ?? config.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('gravity-drop-tower', ctx.targetEvalMode ?? config.targetEvalMode, constraint);
  const modes: DropMode[] = constraint ? DROP_MODES.filter(m => constraint.allowedTypes.includes(m)) : defaultDropModes(ctx.grade);
  const tier = normalizeTier(config.difficulty);
  const gradeLevel = ctx.grade ? (ctx.grade.toUpperCase() === 'K' ? 'Kindergarten' : `Grade ${ctx.grade}`) : 'Grade 3';

  const intent = ctx.intent ? `\nLEARNING FOCUS: "${ctx.intent}".` : '';
  const prompt = `Frame a gravity drop-tower activity about "${topic}" for ${gradeLevel}.${intent}

Code builds every question (objects dropped from a tower, with or without air).
The learner will: ${modes.map(m => CHALLENGE_TYPE_DOCS[m].promptDoc).join('; ')}.

Return only:
1. title: short and neutral.
2. description: one neutral sentence about what the learner investigates. Never say which object lands first, that
   heavy and light objects fall together, or what air does.`;

  let raw: { title?: string; description?: string } = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        systemInstruction: 'You are a science teacher framing a drop-tower activity. You never state results.',
      },
    });
    raw = JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('[gravity-drop-tower] framing call failed; using the topic-neutral frame', error);
  }

  const items = buildDropItems({ modes, tier, rng: Math.random });
  const data: GravityDropTowerData = {
    title: raw.title?.trim() || 'Gravity Drop Tower',
    description: raw.description?.trim() || 'Drop objects from a tall tower and find out what decides how they fall.',
    challengeTypes: modes,
    difficulty: tier,
    gradeLevel,
    items,
  };
  console.log('[gravity-drop-tower] generated', { title: data.title, modes, tier, items: items.map(i => i.id) });
  return data;
};
