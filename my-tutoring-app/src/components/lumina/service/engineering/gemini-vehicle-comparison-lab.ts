import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection } from '../scopeContext';
import { resolveEvalModes, type ChallengeTypeDoc } from '../evalMode';
import {
  VEHICLE_VISUAL_KINDS,
  resolveVehicleVisualKind,
} from '../../primitives/visual-primitives/engineering/vehicleVisualKind';
import type {
  VehicleComparisonLabData,
  ComparisonVehicle,
  SurprisingFact,
} from '../../primitives/visual-primitives/engineering/VehicleComparisonLab';
import {
  buildVehicleItems, METRIC_KEYS, rosterOf, VEHICLE_MODES,
  type MetricKey, type VehicleMode, type VehicleTier,
} from '../../primitives/visual-primitives/engineering/vehicleComparisonWorkspace';

export type { VehicleComparisonLabData };

/**
 * Vehicle Comparison Lab generator. Gemini writes the frame (title, instructions, topic focus), a topic-specific
 * roster of real vehicles with their real statistics, and a few surprising facts for the end of the lab. Code builds
 * every item and key from those numbers (`vehicleComparisonWorkspace.ts`, `buildVehicleItems`): the eval-mode pin
 * picks the task, `config.difficulty` the structural band (rows, columns, how close the race is, how many minimums).
 * The old schema had the model write each mission and its key; code then rewrote most of them, and a learner could
 * read the leader off the comparison bay before answering.
 */
const CHALLENGE_TYPE_DOCS: Record<VehicleMode, ChallengeTypeDoc> = {
  metric_leader: {
    promptDoc: '"metric_leader": the learner reads one named column of a vehicle data table and chooses the vehicle that leads it.',
    schemaDescription: "'metric_leader' (read one column and find its leader)",
  },
  evidence_choice: {
    promptDoc: '"evidence_choice": the learner reads a job with one need and chooses the vehicle for it and the column that proves it.',
    schemaDescription: "'evidence_choice' (choose a vehicle and the column that proves it)",
  },
  constraint_tradeoff: {
    promptDoc: '"constraint_tradeoff": the learner rules out vehicles that miss a minimum, then chooses the best of the rest on one priority.',
    schemaDescription: "'constraint_tradeoff' (rule out by minimums, then choose on a priority)",
  },
};

const vehicleMetricSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    value: { type: Type.NUMBER, description: "The real statistic as a plain number (920 for 920 km/h). Never a placeholder such as 99999." },
    unit: { type: Type.STRING, description: "Unit; the SAME unit for every vehicle on this measure (km/h, kg, km, passengers, tons)." },
    display: { type: Type.STRING, description: "Human-readable value, e.g. '920 km/h'." },
  },
  required: ["value", "unit", "display"],
};

const comparisonVehicleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: "Unique kebab-case id." },
    name: { type: Type.STRING, description: "Short real name a child can say (e.g. 'Boeing 747', 'School bus')." },
    category: { type: Type.STRING, enum: ["air", "land", "sea", "space"] },
    visualKind: { type: Type.STRING, enum: [...VEHICLE_VISUAL_KINDS], description: "The vehicle's actual form; generic only when none fits." },
    imagePrompt: { type: Type.STRING, description: "A short description of the vehicle's look." },
    metrics: {
      type: Type.OBJECT,
      properties: {
        topSpeed: vehicleMetricSchema,
        weight: vehicleMetricSchema,
        passengerCapacity: vehicleMetricSchema,
        cargoCapacity: { ...vehicleMetricSchema, description: "Tons of freight per trip (unit 'tons'); 0 for a people-only vehicle." },
        range: vehicleMetricSchema,
        fuelType: { type: Type.STRING },
        yearIntroduced: { type: Type.NUMBER },
        costPerTrip: { type: Type.STRING, nullable: true },
        co2PerPassengerKm: { type: Type.NUMBER, nullable: true, description: "Grams of CO2 per passenger-kilometer; null when unknown." },
      },
      required: ["topSpeed", "weight", "passengerCapacity", "cargoCapacity", "range", "fuelType", "yearIntroduced"],
    },
    funFact: { type: Type.STRING },
  },
  required: ["id", "name", "category", "visualKind", "imagePrompt", "metrics", "funFact"],
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short neutral title, e.g. 'Airplanes by the Numbers'. Never names a winner." },
    instructions: { type: Type.STRING, description: "One neutral sentence: the learner reads a table of vehicle numbers to answer questions. Never names a vehicle or a winner." },
    topicFocus: { type: Type.STRING, description: "Short phrase naming the requested comparison focus." },
    vehicles: { type: Type.ARRAY, items: comparisonVehicleSchema, description: "5-6 real, topic-specific vehicles." },
    comparisonMetrics: { type: Type.ARRAY, items: { type: Type.STRING, enum: METRIC_KEYS }, description: "The 3-5 measures the lesson is about." },
    surprisingFacts: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { fact: { type: Type.STRING }, vehicleIds: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["fact", "vehicleIds"] },
      description: "2-3 true, counterintuitive comparison facts (shown after the lab).",
    },
  },
  required: ["title", "instructions", "topicFocus", "vehicles", "comparisonMetrics", "surprisingFacts"],
};

type GradeBand = 'K-2' | '3-5';
export function vehicleGradeBand(grade?: string, gradeContext?: string): GradeBand {
  const g = (grade ?? '').trim().toUpperCase();
  if (g === 'K' || g === '1' || g === '2') return 'K-2';
  const n = parseInt(g, 10);
  if (!isNaN(n)) return n <= 2 ? 'K-2' : '3-5';
  return /\b(k|kindergarten|grade 1|grade 2|first|second)\b/i.test(gradeContext ?? '') ? 'K-2' : '3-5';
}
const DEFAULT_MODES: Record<GradeBand, VehicleMode[]> = { 'K-2': ['metric_leader'], '3-5': [...VEHICLE_MODES] };
const normalizeTier = (d?: string): VehicleTier => {
  const t = (d ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

export const generateVehicleComparisonLab = async (ctx: GenerationContext): Promise<VehicleComparisonLabData> => {
  const { topic } = ctx;
  const scopeSection = buildScopePromptSection(ctx.scope);
  const raw = (ctx.raw ?? {}) as { difficulty?: string; targetEvalMode?: string; intent?: string; objectiveText?: string };
  const gradeBand = vehicleGradeBand(ctx.grade, ctx.gradeContext);
  const resolution = await resolveEvalModes('vehicle-comparison-lab', {
    targetEvalMode: ctx.targetEvalMode ?? raw.targetEvalMode,
    intent: ctx.intent ?? raw.intent,
    objectiveText: raw.objectiveText,
  }, CHALLENGE_TYPE_DOCS);
  const modes: VehicleMode[] = resolution
    ? VEHICLE_MODES.filter(m => resolution.allowedTypes.includes(m))
    : DEFAULT_MODES[gradeBand];
  const tier = normalizeTier(raw.difficulty);

  const prompt = `Build the vehicle roster for a comparison lab about "${topic}"
${scopeSection} for grades ${gradeBand}.${ctx.intent ? `\nLEARNING FOCUS: "${ctx.intent}".` : ''}

Code writes every question from the numbers you give. The learner will: ${modes.map(m => CHALLENGE_TYPE_DOCS[m].promptDoc).join(' ')}

TOPIC FIDELITY:
- Build the roster around the lesson topic. If it names a class (airplanes, bicycles, trains, boats, spacecraft,
  construction vehicles), compare examples INSIDE that class. If it names vehicles, include them plus close peers.
  Use a mixed air/land/sea set only when the topic is broad transportation.

THE ROSTER (5-6 vehicles):
- Real vehicles with REAL statistics. Never a placeholder number (no 99999 for "unlimited"); leave co2PerPassengerKm null when unknown.
- Use ONE unit per measure across all vehicles (all speeds in km/h, all weights in kg, all ranges in km).
- Make the vehicles differ: no vehicle should lead every measure (a fast one carries few, a big one is slow).
- comparisonMetrics: the 3-5 measures the lesson is about. A lesson about moving goods includes cargoCapacity;
  passengerCapacity and range suit people-movers; co2PerPassengerKm only when most vehicles have a value.
- Short names a child can say aloud.

FRAME:
- title and instructions are neutral: they never name a vehicle as best, fastest or biggest.
- surprisingFacts: 2-3 true, counterintuitive facts (they are shown only after the lab).`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) throw new Error('No valid Vehicle Comparison Lab data returned from Gemini API');

  const seen = new Set<string>();
  const vehicles: ComparisonVehicle[] = (Array.isArray(data.vehicles) ? data.vehicles : [])
    .filter((v: ComparisonVehicle) => {
      if (!v?.id || !v.name || !v.metrics || seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    })
    .map((v: ComparisonVehicle) => ({ ...v, visualKind: resolveVehicleVisualKind(v), imageUrl: null }));
  if (vehicles.length < 4) throw new Error('Vehicle Comparison Lab returned fewer than 4 valid unique vehicles');

  const comparisonMetrics = (Array.isArray(data.comparisonMetrics) ? data.comparisonMetrics : [])
    .filter((m: unknown, i: number, all: unknown[]): m is MetricKey => (METRIC_KEYS as unknown[]).includes(m) && all.indexOf(m) === i);
  const roster = rosterOf({ vehicles, comparisonMetrics });
  const items = buildVehicleItems({ modes, tier, roster, rng: Math.random });
  for (const mode of modes) {
    if (!items.some(i => i.mode === mode)) throw new Error(`Vehicle Comparison Lab roster cannot support a ${mode} item`);
  }

  const surprisingFacts: SurprisingFact[] = (Array.isArray(data.surprisingFacts) ? data.surprisingFacts : [])
    .filter((f: SurprisingFact) => typeof f?.fact === 'string' && f.fact.trim())
    .map((f: SurprisingFact) => ({ fact: f.fact.trim(), vehicleIds: (f.vehicleIds ?? []).filter(id => seen.has(id)) }));

  const out: VehicleComparisonLabData = {
    title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Vehicles by the Numbers',
    instructions: typeof data.instructions === 'string' && data.instructions.trim()
      ? data.instructions.trim() : 'Read the numbers in the table to answer each question.',
    topicFocus: typeof data.topicFocus === 'string' && data.topicFocus.trim() ? data.topicFocus.trim() : (ctx.intent || topic),
    vehicles,
    comparisonMetrics: roster.focus,
    surprisingFacts,
    gradeBand,
    challengeTypes: modes,
    difficulty: tier,
    items,
  };
  console.log(`[VehicleComparisonLab] modes ${modes.join('+')} (${resolution?.source ?? 'grade default'}), tier ${tier}, items ${items.map(i => i.id).join(', ')}`);
  return out;
};
