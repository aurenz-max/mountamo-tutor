import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type { GasLawsSimulatorData } from "../../primitives/visual-primitives/chemistry/GasLawsSimulator";
import {
  buildGasItems, GAS_MODES, type GasLawFocus, type GasMode, type GasTier,
} from "../../primitives/visual-primitives/chemistry/gasLawsWorkspace";
import { resolveEvalModeConstraint, logEvalModeResolution, type ChallengeTypeDoc } from "../evalMode";

export type { GasLawsSimulatorData };

/**
 * Gas Laws Simulator generator. Gemini reads the topic and writes only the frame: a title, which gas law the lesson is
 * about, and the gas. Every item, number, choice and key is built by code (`gasLawsWorkspace.ts`, `buildGasItems`):
 * the model was unreliable at PV=nRT arithmetic and its instructions stated the answer, so the schema carries no
 * challenge, value or answer. `config.difficulty` picks the structural band of the items (easy: whole-number factors,
 * held quantities named; medium: inverse relations, fractional factors; hard: held quantities inferred, or Celsius).
 */
const CHALLENGE_TYPE_DOCS: Record<GasMode, ChallengeTypeDoc> = {
  observe: { promptDoc: "observe: predict whether a quantity goes up, goes down or stays the same", schemaDescription: "Direction prediction" },
  predict: { promptDoc: "predict: one change, choose the new value", schemaDescription: "One-change value prediction" },
  calculate: { promptDoc: "calculate: two changes at once, choose the new value", schemaDescription: "Combined gas law" },
};

const FOCI: GasLawFocus[] = ['boyle', 'charles', 'gay_lussac', 'combined', 'ideal', 'kmt_only'];
const GASES = ['air', 'helium', 'nitrogen', 'oxygen', 'argon', 'carbon dioxide'];

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title for the lab, e.g. 'Squeeze and Heat: Gas Laws Lab'. Never states a result." },
    description: { type: Type.STRING, description: "One neutral sentence about what the learner investigates. Never says what happens to any quantity." },
    lawFocus: {
      type: Type.STRING,
      enum: FOCI,
      description: "The law the topic is about: 'boyle' (pressure and volume), 'charles' (volume and temperature), "
        + "'gay_lussac' (pressure and temperature), 'combined' (several at once, or gas laws in general), 'ideal' (PV=nRT), "
        + "'kmt_only' (particle model / kinetic molecular theory).",
    },
    gas: { type: Type.STRING, enum: GASES, description: "The gas in the containers." },
  },
  required: ["title", "description", "lawFocus", "gas"],
};

type GradeBand = '8' | '9-10' | '11-12';

const resolveGradeBand = (gradeLevel: string): GradeBand => {
  const gl = (gradeLevel || '').toLowerCase();
  if (gl.includes('11') || gl.includes('12') || gl.includes('high school') || gl.includes('advanced')) return '11-12';
  if (gl.includes('9') || gl.includes('10')) return '9-10';
  if (gl.includes('8') || gl.includes('middle')) return '8';
  return '9-10';
};

/**
 * Canonical-grade → band mapper (systemic 14m). The prose test above matches the '12' in the high-school sentence
 * ("grades 9-12"), so canonical grade wins when present (below-range grades clamp to the '8' floor rung); null keeps
 * the prose fallback reachable.
 */
export function gasLawsGradeBandFromGrade(grade?: string): GradeBand | null {
  if (!grade) return null;
  const g = grade.trim().toUpperCase();
  if (g === 'K') return '8';
  const n = parseInt(g, 10);
  if (isNaN(n)) return null;
  if (n <= 8) return '8';
  if (n <= 10) return '9-10';
  return '11-12';
}

const DEFAULT_MODES: Record<GradeBand, GasMode[]> = { '8': ['observe'], '9-10': ['observe', 'predict'], '11-12': ['predict', 'calculate'] };

const normalizeTier = (d?: string): GasTier => {
  const t = (d ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

export const generateGasLawsSimulator = async (ctx: GenerationContext): Promise<GasLawsSimulatorData> => {
  const { topic } = ctx;
  const config = (ctx.raw ?? {}) as { difficulty?: string; lawFocus?: GasLawFocus; gas?: string };
  const gradeBand = gasLawsGradeBandFromGrade(ctx.grade) ?? resolveGradeBand(ctx.gradeContext);
  const constraint = resolveEvalModeConstraint('gas-laws-simulator', ctx.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('gas-laws-simulator', ctx.targetEvalMode, constraint);
  const modes: GasMode[] = constraint ? GAS_MODES.filter(m => constraint.allowedTypes.includes(m)) : DEFAULT_MODES[gradeBand];
  const tier = normalizeTier(config.difficulty);

  const intent = ctx.intent ? `\nLEARNING FOCUS: "${ctx.intent}".` : '';
  const prompt = `Frame a gas laws lab about "${topic}" for grade band ${gradeBand}.${intent}

Code builds every question (containers of gas: a steel tank, a cylinder with a free piston, a syringe in a water bath).
The learner will: ${modes.map(m => CHALLENGE_TYPE_DOCS[m].promptDoc).join('; ')}.

Return only:
1. title: short and neutral.
2. description: one neutral sentence about what the learner investigates. Never say what happens to pressure, volume
   or temperature (no "rises", "doubles", "shrinks", "expands").
3. lawFocus: the gas law the topic and learning focus are about. Use 'combined' when the topic is gas laws in general.
4. gas: the gas to use.`;

  let raw: { title?: string; description?: string; lawFocus?: string; gas?: string } = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        systemInstruction: 'You are a chemistry teacher framing a gas laws lab. You choose the law the lesson is about; you never state results.',
      },
    });
    raw = JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('[gas-laws-simulator] framing call failed; using the topic-neutral frame', error);
  }

  const lawFocus: GasLawFocus = config.lawFocus ?? ((FOCI as string[]).includes(raw.lawFocus ?? '') ? raw.lawFocus as GasLawFocus : 'combined');
  const gas = config.gas ?? (GASES.includes(raw.gas ?? '') ? raw.gas! : 'air');
  const items = buildGasItems({ modes, tier, focus: lawFocus, gas, rng: Math.random });

  const data: GasLawsSimulatorData = {
    title: raw.title?.trim() || 'Gas Laws Lab',
    description: raw.description?.trim() || 'Predict what a gas does when it is squeezed, heated or given more room.',
    lawFocus,
    gas,
    challengeTypes: modes,
    difficulty: tier,
    gradeBand,
    items,
  };
  console.log('🎈 Gas Laws Simulator Generated:', { title: data.title, gradeBand, lawFocus, tier, modes, items: items.map(i => i.id) });
  return data;
};
