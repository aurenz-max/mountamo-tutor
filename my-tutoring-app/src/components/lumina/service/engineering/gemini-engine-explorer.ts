import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  EngineExplorerData,
  ZoneDescription,
  EngineChallenge,
} from '../../primitives/visual-primitives/engineering/EngineExplorer';

// Re-export for convenience
export type { EngineExplorerData };

// ============================================================================
// Zone IDs per engine type — must match the hardcoded layouts in the component
// ============================================================================

const ZONE_IDS_BY_TYPE: Record<string, string[]> = {
  steam: ['boiler', 'pipe', 'chamber', 'exhaust', 'condenser'],
  piston_4stroke: ['boiler', 'pipe', 'chamber', 'exhaust', 'condenser'],
  diesel: ['boiler', 'pipe', 'chamber', 'exhaust', 'condenser'],
  jet_turbofan: ['boiler', 'pipe', 'chamber', 'exhaust', 'condenser'],
  turboprop: ['boiler', 'pipe', 'chamber', 'exhaust', 'condenser'],
  electric_motor: ['boiler', 'pipe', 'chamber', 'exhaust', 'condenser'],
  rocket: ['boiler', 'pipe', 'chamber', 'exhaust', 'condenser'],
};

// ============================================================================
// Gemini Schemas — flat, simple, content-only (no geometry or physics)
// ============================================================================

const zoneDescriptionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    analogy: {
      type: Type.STRING,
      description: "Everyday analogy for this engine part (e.g., 'Like a giant kettle on a stove').",
    },
    explanation: {
      type: Type.STRING,
      description: "What this part does, explained for the target grade level.",
    },
  },
  required: ["analogy", "explanation"],
};

const challengeOptionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: "Option letter: a, b, c, or d" },
    text: { type: Type.STRING, description: "Answer text" },
  },
  required: ["id", "text"],
};

const challengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: "Unique ID like ch1, ch2, etc." },
    type: {
      type: Type.STRING,
      enum: ["predict", "observe", "adjust"],
      description: "predict = what will happen, observe = watch and describe, adjust = change controls to achieve goal",
    },
    instruction: { type: Type.STRING, description: "The question or task for the student." },
    option0Id: { type: Type.STRING }, option0Text: { type: Type.STRING },
    option1Id: { type: Type.STRING }, option1Text: { type: Type.STRING },
    option2Id: { type: Type.STRING }, option2Text: { type: Type.STRING },
    option3Id: { type: Type.STRING }, option3Text: { type: Type.STRING },
    correctOptionId: { type: Type.STRING, description: "ID of the correct option (a, b, c, or d)." },
    hint: { type: Type.STRING, description: "A helpful hint without giving the answer directly." },
  },
  required: ["id", "type", "instruction", "option0Id", "option0Text", "option1Id", "option1Text",
    "option2Id", "option2Text", "option3Id", "option3Text", "correctOptionId", "hint"],
};

const energyFlowSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    input: { type: Type.STRING, description: "Primary energy input (e.g., 'Coal (chemical energy)')." },
    transformation0: { type: Type.STRING, description: "First energy transformation step" },
    transformation1: { type: Type.STRING, description: "Second energy transformation step" },
    transformation2: { type: Type.STRING, nullable: true, description: "Optional third step (null if not needed)" },
    output: { type: Type.STRING, description: "Final useful energy output" },
    efficiency: { type: Type.STRING, nullable: true, description: "Approximate efficiency (null for grades 1-2)" },
    loss0: { type: Type.STRING, nullable: true, description: "First energy loss (null for grades 1-2)" },
    loss1: { type: Type.STRING, nullable: true, description: "Second energy loss (null for grades 1-2)" },
    loss2: { type: Type.STRING, nullable: true, description: "Third energy loss (null for grades 1-2)" },
  },
  required: ["input", "transformation0", "transformation1", "output", "efficiency"],
};

const engineExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging activity title (e.g., 'Chugging Along: The Steam Engine')" },
    description: { type: Type.STRING, description: "Short educational description of what students will learn" },
    engineType: {
      type: Type.STRING,
      enum: ["steam", "piston_4stroke", "electric_motor", "diesel", "jet_turbofan", "turboprop", "rocket"],
      description: "Engine type — pick the most relevant for the topic",
    },
    engineName: { type: Type.STRING, description: "Specific engine name (e.g., 'Steam Engine', 'V8 Gasoline Engine')" },
    vehicleContext: { type: Type.STRING, description: "The vehicle this engine powers (e.g., 'Steam Locomotive', 'Family Car')" },
    overview: { type: Type.STRING, description: "1-2 sentence conversational overview of how this engine works" },
    gradeBand: { type: Type.STRING, enum: ["1-2", "3-5"] },
    observeNarration: {
      type: Type.STRING,
      description: "Narration for when the student first sees the engine running. Conversational, enthusiastic. Point out what to watch.",
    },
    // Zone descriptions — keyed by zone ID
    zoneDesc_boiler: zoneDescriptionSchema,
    zoneDesc_pipe: zoneDescriptionSchema,
    zoneDesc_chamber: zoneDescriptionSchema,
    zoneDesc_exhaust: zoneDescriptionSchema,
    zoneDesc_condenser: zoneDescriptionSchema,
    // Challenges
    challenge0: challengeSchema,
    challenge1: challengeSchema,
    challenge2: challengeSchema,
    challenge3: { ...challengeSchema, nullable: true },
    challenge4: { ...challengeSchema, nullable: true },
    // Energy flow
    energyFlow: energyFlowSchema,
  },
  required: [
    "title", "description", "engineType", "engineName", "vehicleContext",
    "overview", "gradeBand", "observeNarration",
    "zoneDesc_boiler", "zoneDesc_pipe", "zoneDesc_chamber", "zoneDesc_exhaust", "zoneDesc_condenser",
    "challenge0", "challenge1", "challenge2", "energyFlow",
  ],
};

// ============================================================================
// Generator
// ============================================================================

export const generateEngineExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<EngineExplorerData>
): Promise<EngineExplorerData> => {
  const prompt = `
Create educational content for a Living Engine simulation that teaches "${topic}" to ${gradeLevel} students.

IMPORTANT: You are providing ONLY the educational text content — analogies, explanations, challenges, and narration.
The engine simulation (particles, physics, animation) is handled by the component. You write the words.

The simulation shows a particle-based engine cross-section where students see:
- Water/fuel particles heating up and speeding up in the boiler/source zone
- Particles flowing through a pipe to the piston chamber
- Particles hitting the piston, building visible pressure that turns a drive wheel
- Particles cooling down in the condenser and returning to the boiler
- A fuel slider that controls heat (more fuel = faster particles = more pressure = faster wheel)
- A load slider that adds resistance to the wheel

ZONES (provide analogy + explanation for each):
- boiler: Where fuel/energy enters and particles heat up
- pipe: The path from energy source to the work zone
- chamber: Where particle pressure pushes the piston
- exhaust: Where spent particles exit after doing work
- condenser: Where particles cool down and return for reuse

ZONE DESCRIPTION GUIDELINES:
- Adapt zone descriptions to match the engine type. For a steam engine, the boiler heats water.
  For a gasoline engine, the "boiler" is the fuel injection zone. Map concepts appropriately.
- Analogies must reference everyday kid experiences (kettles, balloons, bike pumps, etc.)

CHALLENGES (create 3-5 multiple choice questions):
- "predict" type: Ask what will happen BEFORE the student tries it (e.g., "What happens if you add more coal?")
- "observe" type: Ask the student to watch something specific (e.g., "What color are hot vs cool particles?")
- "adjust" type: Ask the student to change a control and see the effect (e.g., "Add load — what does the engine need?")
- Options: exactly 4 options (a, b, c, d). One correct.
- Hints: helpful but don't give the answer. Reference what they can see in the simulation.

NARRATION:
- Conversational, enthusiastic, uses "you" and "we"
- Grade 1-2: Short sentences, wonder-focused
- Grade 3-5: More technical but still friendly

ENERGY FLOW:
- 2-3 transformation steps showing how energy changes form
- Efficiency and losses only for grades 3-5 (null for 1-2)

${config?.engineType ? `Engine type hint: ${config.engineType}` : ''}
${config?.vehicleContext ? `Vehicle context: ${config.vehicleContext}` : ''}
${config?.gradeBand ? `Grade band: ${config.gradeBand}` : ''}
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: engineExplorerSchema,
    },
  });

  const raw = result.text ? JSON.parse(result.text) : null;
  if (!raw) throw new Error('No valid Engine Explorer data returned from Gemini');

  // ---- Reconstruct from flat schema ----

  // Zone descriptions
  const zoneDescriptions: Record<string, ZoneDescription> = {};
  for (const zoneId of ['boiler', 'pipe', 'chamber', 'exhaust', 'condenser']) {
    const desc = raw[`zoneDesc_${zoneId}`];
    if (desc?.analogy && desc?.explanation) {
      zoneDescriptions[zoneId] = { analogy: desc.analogy, explanation: desc.explanation };
    }
  }

  // Challenges
  const challenges: EngineChallenge[] = [];
  for (let i = 0; i < 5; i++) {
    const ch = raw[`challenge${i}`];
    if (!ch?.instruction) continue;
    challenges.push({
      id: ch.id || `ch${i + 1}`,
      type: ch.type || 'predict',
      instruction: ch.instruction,
      options: [
        { id: ch.option0Id || 'a', text: ch.option0Text || '' },
        { id: ch.option1Id || 'b', text: ch.option1Text || '' },
        { id: ch.option2Id || 'c', text: ch.option2Text || '' },
        { id: ch.option3Id || 'd', text: ch.option3Text || '' },
      ].filter(o => o.text),
      correctOptionId: ch.correctOptionId || 'a',
      hint: ch.hint || 'Look carefully at the simulation!',
    });
  }

  // Energy flow
  const ef = raw.energyFlow || {};
  const transformations = [ef.transformation0, ef.transformation1, ef.transformation2].filter(Boolean) as string[];
  const losses = [ef.loss0, ef.loss1, ef.loss2].filter(Boolean) as string[];

  // Validate engine type
  const validTypes = ['steam', 'piston_4stroke', 'electric_motor', 'diesel', 'jet_turbofan', 'turboprop', 'rocket'];
  const engineType = validTypes.includes(raw.engineType) ? raw.engineType : 'steam';

  // Grade band
  const gradeBand = raw.gradeBand === '1-2' || raw.gradeBand === '3-5' ? raw.gradeBand : '3-5';

  // Enforce grade constraints
  const energyFlow = {
    input: ef.input || 'Fuel (chemical energy)',
    transformations: transformations.length > 0 ? transformations : ['Heat energy', 'Mechanical energy'],
    output: ef.output || 'Motion (kinetic energy)',
    efficiency: gradeBand === '1-2' ? null : (ef.efficiency || '~25%'),
    losses: gradeBand === '1-2' ? [] : (losses.length > 0 ? losses : ['Heat', 'Sound']),
  };

  const data: EngineExplorerData = {
    title: raw.title || `Exploring the ${engineType} Engine`,
    description: raw.description || 'Learn how this engine works!',
    engineType,
    engineName: raw.engineName || engineType.replace(/_/g, ' '),
    vehicleContext: raw.vehicleContext || 'Vehicle',
    overview: raw.overview || 'Watch the particles flow through the engine and see how energy becomes motion!',
    gradeBand,
    observeNarration: raw.observeNarration || 'Watch the engine come to life! See the particles heating up?',
    zoneDescriptions,
    challenges: challenges.length > 0 ? challenges : undefined,
    energyFlow,
  };

  // Apply config overrides
  if (config) {
    if (config.engineType) data.engineType = config.engineType;
    if (config.engineName) data.engineName = config.engineName;
    if (config.vehicleContext) data.vehicleContext = config.vehicleContext;
    if (config.gradeBand) data.gradeBand = config.gradeBand;
  }

  return data;
};
