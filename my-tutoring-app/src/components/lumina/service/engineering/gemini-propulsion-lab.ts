import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type { PropulsionLabData } from "../../primitives/visual-primitives/engineering/PropulsionLab";
import {
  buildPropulsionItems, PROPULSION_MODES, type PropulsionMode, type PropulsionTier,
} from "../../primitives/visual-primitives/engineering/propulsionWorkspace";
import { resolveEvalModeConstraint, logEvalModeResolution, type ChallengeTypeDoc } from "../evalMode";

export type { PropulsionLabData };

/**
 * Propulsion Lab generator. Gemini reads the topic and writes only the frame: a title and a one-sentence overview.
 * Every item, engine, place, choice and key is built by code (`propulsionWorkspace.ts`, `buildPropulsionItems`): the
 * old schema had the model write each multiple-choice question and its key, the right option was usually the longest
 * one ("Nothing happens because there is no air to push!"), and the score credited exploring the sandbox.
 * `config.difficulty` picks the structural band (easy: how each engine works is named, one stream, Test A set;
 * medium: the learner supplies what each engine needs, engines turned around, a stream with nothing in it, both tests
 * free; hard: two engines pushing opposite ways, streams one unit apart, tests that start two changes apart or where
 * the engine has nothing to push).
 */
const CHALLENGE_TYPE_DOCS: Record<PropulsionMode, ChallengeTypeDoc> = {
  predict: { promptDoc: "predict what a craft with a jet engine, rocket engine, propeller or sail does, on Earth or in space", schemaDescription: "Predict the motion" },
  observe: { promptDoc: "watch what comes out of a craft's engines and say which way it goes when let go", schemaDescription: "Read the streams" },
  experiment: { promptDoc: "set up two fair tests that answer a question about engines, air and throttle", schemaDescription: "Set up a fair test" },
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title for the lab, e.g. 'Push and Go Lab'. Never states a result." },
    overview: { type: Type.STRING, description: "One neutral sentence about what the learner will do with the craft. Never says what an engine does in a place (no 'works in space', 'needs air', 'moves forward')." },
  },
  required: ["title", "overview"],
};

type GradeBand = '1-2' | '3-5';
export function propulsionGradeBand(grade?: string, gradeContext?: string): GradeBand {
  const g = (grade ?? '').trim().toUpperCase();
  if (g === 'K' || g === '1' || g === '2') return '1-2';
  const n = parseInt(g, 10);
  if (!isNaN(n)) return n <= 2 ? '1-2' : '3-5';
  return /\b(k|kindergarten|grade 1|grade 2|first|second)\b/i.test(gradeContext ?? '') ? '1-2' : '3-5';
}

const DEFAULT_MODES: Record<GradeBand, PropulsionMode[]> = { '1-2': ['predict', 'observe'], '3-5': ['predict', 'observe', 'experiment'] };
const normalizeTier = (d?: string): PropulsionTier => {
  const t = (d ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

export const generatePropulsionLab = async (ctx: GenerationContext): Promise<PropulsionLabData> => {
  const { topic } = ctx;
  const config = (ctx.raw ?? {}) as { difficulty?: string };
  const gradeBand = propulsionGradeBand(ctx.grade, ctx.gradeContext);
  const constraint = resolveEvalModeConstraint('propulsion-lab', ctx.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('propulsion-lab', ctx.targetEvalMode, constraint);
  const modes: PropulsionMode[] = constraint ? PROPULSION_MODES.filter(m => constraint.allowedTypes.includes(m)) : DEFAULT_MODES[gradeBand];
  const tier = normalizeTier(config.difficulty);

  const intent = ctx.intent ? `\nLEARNING FOCUS: "${ctx.intent}".` : '';
  const prompt = `Frame a propulsion lab about "${topic}" for grades ${gradeBand}.${intent}

Code builds every question about how engines push a craft (Newton's third law: push something backward to go forward).
The learner will: ${modes.map(m => CHALLENGE_TYPE_DOCS[m].promptDoc).join('; ')}.

Return only:
1. title: short and neutral.
2. overview: one neutral sentence about what the learner does. Never say what any engine does or needs.`;

  let raw: { title?: string; overview?: string } = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        systemInstruction: 'You are a science teacher framing a propulsion lab. You never state what an engine does.',
      },
    });
    raw = JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('[propulsion-lab] framing call failed; using the topic-neutral frame', error);
  }

  const items = buildPropulsionItems({ modes, tier, rng: Math.random });
  const data: PropulsionLabData = {
    title: raw.title?.trim() || 'Propulsion Lab',
    overview: raw.overview?.trim() || 'Work out how engines push a craft along.',
    gradeBand,
    challengeTypes: modes,
    difficulty: tier,
    items,
  };
  console.log('🚀 Propulsion Lab Generated:', { title: data.title, gradeBand, tier, modes, items: items.map(i => i.id) });
  return data;
};
