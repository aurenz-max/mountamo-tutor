import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection } from '../scopeContext';
import { resolveEvalModeConstraint, logEvalModeResolution, type ChallengeTypeDoc } from "../evalMode";
import type { TransportChallengeData } from "../../primitives/visual-primitives/engineering/TransportChallenge";
import {
  buildTransportItems, DEFAULT_FRAMES, ITEM_COUNT, TRANSPORT_MODES, VEHICLES,
  type TransportFrame, type TransportMode, type TransportTier,
} from "../../primitives/visual-primitives/engineering/transportWorkspace";

export type { TransportChallengeData };

/**
 * Transport Challenge generator. Gemini reads the lesson and writes only the names of each job: a title, where it
 * starts and ends, what is moved (people or tons of cargo) and which vehicle the lesson is about. Every number, limit
 * and key is built by code (`transportWorkspace.ts`, `buildTransportItems`): the old schema had the model write each
 * vehicle's figures, a trade-off question and its key, and the comparison table on screen gave the answer away.
 * `config.difficulty` picks the structural band (easy: every load fills its trips and the cards show only the limited
 * figures; medium: a part-full trip somewhere, every figure shown, the cheapest-per-trip vehicle not the answer; hard:
 * a vehicle that would pass only if its part-full trip were not counted).
 */
const CHALLENGE_TYPE_DOCS: Record<TransportMode, ChallengeTypeDoc> = {
  single_constraint: { promptDoc: "pick the vehicle that does a whole job within one limit (a budget, a time or a CO2 cap)", schemaDescription: "One limit" },
  multi_constraint: { promptDoc: "pick the vehicle that keeps two limits at once", schemaDescription: "Two limits" },
  full_optimization: { promptDoc: "no vehicle keeps all three limits; pick the one that breaks only one", schemaDescription: "Three limits" },
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title for the activity. Never names a vehicle as the best." },
    description: { type: Type.STRING, description: "One neutral sentence about what the learner does. Never says which vehicle is better." },
    jobs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "A short name for the job, e.g. 'Festival day', 'Lumber run'" },
          origin: { type: Type.STRING, description: "Where the load starts: a named place (a grain farm, a lumber mill, a suburb station)" },
          destination: { type: Type.STRING, description: "Where the load goes: a named place" },
          loadKind: { type: Type.STRING, enum: ["people", "cargo"], description: "people = passengers; cargo = goods measured in tons" },
          loadName: { type: Type.STRING, description: "What is moved, as a short plural noun: 'commuters', 'festival visitors', 'lumber', 'grain'" },
          featuredVehicle: { type: Type.STRING, enum: VEHICLES.map(v => v.id), description: "The vehicle the lesson is about; it must carry the loadKind (people: car, minivan, bus, ferry, plane, train; cargo: delivery_truck, semi_truck, cargo_plane, freight_train, cargo_ship)" },
        },
        required: ["title", "origin", "destination", "loadKind", "loadName", "featuredVehicle"],
      },
    },
  },
  required: ["title", "description", "jobs"],
};

const normalizeTier = (d?: string): TransportTier => {
  const t = (d ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

const clean = (s: unknown, max = 60) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

function toFrame(raw: Record<string, unknown>): TransportFrame | null {
  const kind = raw.loadKind === 'cargo' ? 'cargo' : raw.loadKind === 'people' ? 'people' : null;
  const title = clean(raw.title), origin = clean(raw.origin), destination = clean(raw.destination), loadName = clean(raw.loadName, 40);
  if (!kind || !title || !origin || !destination || !loadName || origin === destination) return null;
  const featured = VEHICLES.find(v => v.id === raw.featuredVehicle && v.kind === kind)?.id;
  return { title, origin, destination, kind, loadName, ...(featured ? { featured } : {}) };
}

export const generateTransportChallenge = async (ctx: GenerationContext): Promise<TransportChallengeData> => {
  const config = (ctx.raw ?? {}) as { difficulty?: string; targetEvalMode?: string };
  const constraint = resolveEvalModeConstraint('transport-challenge', ctx.targetEvalMode ?? config.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('TransportChallenge', ctx.targetEvalMode ?? config.targetEvalMode, constraint);
  const modes: TransportMode[] = constraint ? TRANSPORT_MODES.filter(m => constraint.allowedTypes.includes(m)) : [...TRANSPORT_MODES];
  const tier = normalizeTier(config.difficulty);
  const count = modes.reduce((n, m) => n + ITEM_COUNT[m][modes.length === 1 ? 0 : 1], 0);

  const lines = [`LESSON TOPIC: ${ctx.topic}`];
  if (ctx.intent) lines.push(`ACTIVITY INTENT: ${ctx.intent}`);
  if (ctx.objective?.text) lines.push(`LEARNING OBJECTIVE: ${ctx.objective.text}`);
  const prompt = `Name ${count + 2} transport jobs for ${ctx.gradeContext} students.
${lines.join('\n')}
${buildScopePromptSection(ctx.scope)}

Code builds every number (how much is moved, each vehicle's figures, the limits) and checks every answer.
The learner will: ${modes.map(m => CHALLENGE_TYPE_DOCS[m].promptDoc).join('; ')}.

For each job return only names:
- title, origin, destination: a real-sounding job that fits the lesson. The jobs differ in route and load.
- loadKind: "people" for passengers, "cargo" for goods. A lesson about moving people stays with people; a lesson about freight or goods uses cargo; a lesson about both mixes them.
- loadName: what is moved, a short plural noun.
- featuredVehicle: the vehicle the lesson is about (a trains lesson features a train), and it must carry that loadKind.
Also return a short neutral title and one neutral sentence of description.`;

  let raw: { title?: string; description?: string; jobs?: Record<string, unknown>[] } = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: schema },
    });
    raw = JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('[transport-challenge] naming call failed; using the default jobs', error);
  }

  const frames = (raw.jobs ?? []).map(toFrame).filter((f): f is TransportFrame => !!f);
  const items = buildTransportItems({ modes, tier, frames: frames.length ? frames : DEFAULT_FRAMES, rng: Math.random });

  const data: TransportChallengeData = {
    title: clean(raw.title, 80) || 'Transport Challenge',
    description: clean(raw.description, 200) || 'Work out how many trips each vehicle needs and what the whole job costs, then pick.',
    challengeTypes: modes,
    difficulty: tier,
    frames,
    items,
  };
  console.log('🚛 Transport Challenge Generated:', { title: data.title, tier, modes, items: items.map(i => `${i.id}:${i.load.kind}`) });
  return data;
};
