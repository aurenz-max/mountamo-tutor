import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type { FlightForcesExplorerData } from "../../primitives/visual-primitives/engineering/FlightForcesExplorer";
import {
  AIRCRAFT_IDS, buildFlightItems, FLIGHT_MODES, type AircraftId, type FlightMode, type FlightTier,
} from "../../primitives/visual-primitives/engineering/flightForcesWorkspace";
import { resolveEvalModeConstraint, logEvalModeResolution, type ChallengeTypeDoc } from "../evalMode";

export type { FlightForcesExplorerData };

/**
 * Flight Forces Explorer generator. Gemini reads the topic and writes only the frame: a title, a one-sentence
 * overview and which plane to draw. Every item, force size, choice and key is built by code
 * (`flightForcesWorkspace.ts`, `buildFlightItems`): the old schema had the model write each multiple-choice question
 * and its key, and the right option was usually the longest, most detailed one. `config.difficulty` picks the
 * structural band (easy: the force that changes is named, or one control; medium: an action to map to its force, both
 * directions asked, two controls; hard: two-step effects, stalls, cancelling changes, one-unit gaps, a nose that
 * points up while the plane sinks, a nose that adds drag).
 */
const CHALLENGE_TYPE_DOCS: Record<FlightMode, ChallengeTypeDoc> = {
  predict: { promptDoc: "predict what a plane does after one change (a load, the throttle, the landing gear, the nose angle)", schemaDescription: "Predict the motion" },
  observe: { promptDoc: "read a plane's four force arrows and say what its height and speed are doing", schemaDescription: "Read the force arrows" },
  adjust: { promptDoc: "set the thrust and the nose angle so the plane meets a goal", schemaDescription: "Balance the forces" },
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title for the lab, e.g. 'Four Forces Flight Lab'. Never states a result." },
    overview: { type: Type.STRING, description: "One neutral sentence about what the learner will do with the plane. Never says what a force does to the plane (no 'climbs', 'sinks', 'faster')." },
    aircraftType: { type: Type.STRING, enum: AIRCRAFT_IDS, description: "The plane to draw: 'cessna' (a small plane), 'jumbo_jet' or 'fighter'." },
  },
  required: ["title", "overview", "aircraftType"],
};

type GradeBand = '1-2' | '3-5';
export function flightGradeBand(grade?: string, gradeContext?: string): GradeBand {
  const g = (grade ?? '').trim().toUpperCase();
  if (g === 'K' || g === '1' || g === '2') return '1-2';
  const n = parseInt(g, 10);
  if (!isNaN(n)) return n <= 2 ? '1-2' : '3-5';
  return /\b(k|kindergarten|grade 1|grade 2|first|second)\b/i.test(gradeContext ?? '') ? '1-2' : '3-5';
}

const DEFAULT_MODES: Record<GradeBand, FlightMode[]> = { '1-2': ['predict'], '3-5': ['predict', 'observe', 'adjust'] };
const normalizeTier = (d?: string): FlightTier => {
  const t = (d ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

export const generateFlightForcesExplorer = async (ctx: GenerationContext): Promise<FlightForcesExplorerData> => {
  const { topic } = ctx;
  const config = (ctx.raw ?? {}) as { difficulty?: string; aircraftType?: string };
  const gradeBand = flightGradeBand(ctx.grade, ctx.gradeContext);
  const constraint = resolveEvalModeConstraint('flight-forces-explorer', ctx.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('flight-forces-explorer', ctx.targetEvalMode, constraint);
  const modes: FlightMode[] = constraint ? FLIGHT_MODES.filter(m => constraint.allowedTypes.includes(m)) : DEFAULT_MODES[gradeBand];
  const tier = normalizeTier(config.difficulty);

  const intent = ctx.intent ? `\nLEARNING FOCUS: "${ctx.intent}".` : '';
  const prompt = `Frame a flight lab about "${topic}" for grades ${gradeBand}.${intent}

Code builds every question about the four forces of flight (lift, weight, thrust, drag).
The learner will: ${modes.map(m => CHALLENGE_TYPE_DOCS[m].promptDoc).join('; ')}.

Return only:
1. title: short and neutral.
2. overview: one neutral sentence about what the learner does. Never say what any force does to the plane.
3. aircraftType: the plane that fits the topic best.`;

  let raw: { title?: string; overview?: string; aircraftType?: string } = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        systemInstruction: 'You are a science teacher framing a flight lab. You never state what happens to the plane.',
      },
    });
    raw = JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('[flight-forces-explorer] framing call failed; using the topic-neutral frame', error);
  }

  const pick = config.aircraftType ?? raw.aircraftType;
  const aircraft: AircraftId = (AIRCRAFT_IDS as string[]).includes(pick ?? '') ? pick as AircraftId : 'cessna';
  const items = buildFlightItems({ modes, tier, aircraft, rng: Math.random });

  const data: FlightForcesExplorerData = {
    title: raw.title?.trim() || 'Flight Forces Lab',
    overview: raw.overview?.trim() || 'Work out what a plane does from the four forces on it.',
    aircraftType: aircraft,
    gradeBand,
    challengeTypes: modes,
    difficulty: tier,
    items,
  };
  console.log('✈️ Flight Forces Explorer Generated:', { title: data.title, gradeBand, aircraft, tier, modes, items: items.map(i => i.id) });
  return data;
};
