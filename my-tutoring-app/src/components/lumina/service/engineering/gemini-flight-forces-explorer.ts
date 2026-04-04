import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  type ChallengeTypeDoc,
} from '../evalMode';

// Import types from the component - single source of truth
import type {
  FlightForcesExplorerData,
} from '../../primitives/visual-primitives/engineering/FlightForcesExplorer';

// Re-export for convenience
export type { FlightForcesExplorerData };

// ============================================================================
// Eval Mode Challenge Type Docs
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  predict: {
    promptDoc: 'Predict: Ask what will happen BEFORE the student tries it. Focus on hypotheses about force balance outcomes.',
    schemaDescription: 'predict — student predicts what will happen to the aircraft',
  },
  observe: {
    promptDoc: 'Observe: Ask the student to watch the aircraft and describe what they see. Focus on visible evidence of forces at work.',
    schemaDescription: 'observe — student watches simulation and explains what forces are doing',
  },
  adjust: {
    promptDoc: 'Adjust: Ask the student to change a variable (thrust, angle) and observe the result. Focus on cause-and-effect reasoning.',
    schemaDescription: 'adjust — student changes variables and compares outcomes',
  },
};

// ============================================================================
// Gemini Schemas — flat, simple, content-only (no physics params)
// ============================================================================

const challengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: "Unique ID like ch1, ch2, etc." },
    type: {
      type: Type.STRING,
      enum: ["predict", "observe", "adjust"],
      description: "predict = what will happen, observe = watch and describe, adjust = change variables and see results",
    },
    instruction: { type: Type.STRING, description: "The question or task for the student." },
    option0Id: { type: Type.STRING, description: "Option ID (e.g., 'a')" },
    option0Text: { type: Type.STRING, description: "Option text for first choice" },
    option1Id: { type: Type.STRING, description: "Option ID (e.g., 'b')" },
    option1Text: { type: Type.STRING, description: "Option text for second choice" },
    option2Id: { type: Type.STRING, description: "Option ID (e.g., 'c')" },
    option2Text: { type: Type.STRING, description: "Option text for third choice" },
    option3Id: { type: Type.STRING, description: "Option ID (e.g., 'd')" },
    option3Text: { type: Type.STRING, description: "Option text for fourth choice" },
    correctOptionId: { type: Type.STRING, description: "ID of the correct option (a, b, c, or d)." },
    hint: { type: Type.STRING, description: "A helpful hint without giving the answer directly." },
  },
  required: [
    "id", "type", "instruction",
    "option0Id", "option0Text", "option1Id", "option1Text",
    "option2Id", "option2Text", "option3Id", "option3Text",
    "correctOptionId", "hint",
  ],
};

const forceFactSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Display name for this force (e.g., 'Lift')." },
    description: { type: Type.STRING, description: "1-2 sentence explanation of how this force works in flight, grade-appropriate." },
    analogy: { type: Type.STRING, description: "Kid-friendly everyday analogy (e.g., 'Like sticking your hand out a car window and tilting it up')." },
  },
  required: ["name", "description", "analogy"],
};

const stateFactSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Display name for this flight state (e.g., 'Climbing')." },
    description: { type: Type.STRING, description: "1-2 sentence explanation of what forces cause this state and what happens to the aircraft." },
  },
  required: ["name", "description"],
};

const flightForcesExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging activity title (e.g., 'Sky Forces: How Planes Really Fly')." },
    description: { type: Type.STRING, description: "Short educational description of what students will learn." },
    overview: { type: Type.STRING, description: "1-2 sentence conversational overview of the activity." },
    aircraftType: {
      type: Type.STRING,
      enum: ["cessna", "jumbo_jet", "glider", "fighter"],
      description: "Aircraft type. K-2: cessna or glider. 3-5: any type.",
    },
    aircraftName: { type: Type.STRING, description: "Friendly display name for the aircraft (e.g., 'Cessna 172', 'Boeing 747')." },
    gradeBand: { type: Type.STRING, enum: ["1-2", "3-5"], description: "Grade band for complexity." },
    // Challenges — flattened (up to 6)
    challenge0: challengeSchema,
    challenge1: challengeSchema,
    challenge2: challengeSchema,
    challenge3: { ...challengeSchema, nullable: true },
    challenge4: { ...challengeSchema, nullable: true },
    challenge5: { ...challengeSchema, nullable: true },
    // Force facts — one per hardcoded force
    forceFact_lift: forceFactSchema,
    forceFact_weight: forceFactSchema,
    forceFact_thrust: forceFactSchema,
    forceFact_drag: forceFactSchema,
    // Flight state facts — one per hardcoded state
    stateFact_climbing: stateFactSchema,
    stateFact_descending: stateFactSchema,
    stateFact_cruising: stateFactSchema,
    stateFact_stalling: stateFactSchema,
  },
  required: [
    "title", "description", "overview", "aircraftType", "aircraftName", "gradeBand",
    "challenge0", "challenge1", "challenge2",
    "forceFact_lift", "forceFact_weight", "forceFact_thrust", "forceFact_drag",
    "stateFact_climbing", "stateFact_descending", "stateFact_cruising", "stateFact_stalling",
  ],
};

// ============================================================================
// Generator
// ============================================================================

export const generateFlightForcesExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>
): Promise<FlightForcesExplorerData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'flight-forces-explorer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // When an eval mode is active, constrain the type enum on each flattened
  // challenge object so Gemini *cannot* produce disallowed types.
  // Our schema has flattened `challenge0..challenge5` objects — constrain each manually.
  let activeSchema = flightForcesExplorerSchema;
  if (evalConstraint) {
    activeSchema = JSON.parse(JSON.stringify(flightForcesExplorerSchema)) as Schema;
    const props = (activeSchema as Record<string, unknown>).properties as Record<string, Record<string, unknown>>;
    const descriptions = evalConstraint.allowedTypes
      .map(t => CHALLENGE_TYPE_DOCS[t]?.schemaDescription ?? t)
      .join(', ');
    for (let i = 0; i < 6; i++) {
      const ch = props[`challenge${i}`];
      if (ch?.properties) {
        const chProps = ch.properties as Record<string, Record<string, unknown>>;
        if (chProps.type) {
          chProps.type = { ...chProps.type, enum: evalConstraint.allowedTypes, description: `Challenge type: ${descriptions}` };
        }
      }
    }
  }

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create educational content for a Flight Forces Explorer that teaches "${topic}" to ${gradeLevel} students.

IMPORTANT: You are providing ONLY educational text content — descriptions, analogies, facts, and challenge questions.
The component hardcodes all physics simulation, aircraft profiles (cessna, jumbo_jet, glider, fighter), forces (lift, weight, thrust, drag), and flight states (climbing, descending, cruising, stalling).
You write the words and questions. You do NOT create physics parameters.

FOUR FORCES OF FLIGHT FOCUS:
Every challenge should relate to the four forces of flight and how they interact:
- LIFT — The upward force from wings as air flows over them. Faster speed or steeper angle = more lift (until stall).
- WEIGHT — Gravity pulling the aircraft down. Heavier aircraft need more lift.
- THRUST — Forward force from the engine. More thrust = more speed = more lift.
- DRAG — Air resistance slowing the aircraft. Faster speed = more drag.

KEY CONCEPTS TO COVER:
- Lift vs Weight: Lift > Weight = climbing; Lift < Weight = descending; balanced = cruising
- Thrust vs Drag: Thrust > Drag = accelerating; balanced = constant speed
- Stalling: Angle of attack too high — airflow separates from wing, lift drops suddenly
- Different aircraft have different force balances (gliders have no thrust!)

FORCE FACTS (provide educational text for each):
- lift: How wings generate upward force by shaping airflow
- weight: How gravity acts on the aircraft's mass
- thrust: How engines push the aircraft forward
- drag: How air resistance opposes motion

FLIGHT STATE FACTS (provide educational text for each):
- climbing: What forces cause the aircraft to gain altitude
- descending: What forces cause the aircraft to lose altitude
- cruising: How balanced forces maintain level flight
- stalling: What happens when the angle of attack is too steep

${challengeTypeSection}

CHALLENGES (create 3-6 multiple choice questions):
- Options: exactly 4 options (a, b, c, d). One correct.
- Hints: helpful but don't give the answer.

GRADE-LEVEL GUIDELINES:
GRADES 1-2:
- Simple language: "lift pushes the plane up", "gravity pulls it down"
- Everyday analogies: kites, paper airplanes, birds, sticking hand out car window
- 3-4 challenges maximum
- Aircraft: cessna or glider (simple, relatable)
- gradeBand: "1-2"

GRADES 3-5:
- Scientific vocabulary: lift, drag, thrust, angle of attack, stall
- Real aircraft examples and comparisons in descriptions
- 4-6 challenges with force-balance reasoning
- Aircraft: any type including jumbo_jet and fighter
- gradeBand: "3-5"

${config?.targetEvalMode ? `Target eval mode: ${config.targetEvalMode}` : ''}
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const raw = result.text ? JSON.parse(result.text) : null;
  if (!raw) throw new Error('No valid Flight Forces Explorer data returned from Gemini');

  // ---- Reconstruct nested structures from flat schema ----

  // Challenges
  const challenges: NonNullable<FlightForcesExplorerData['challenges']> = [];
  for (let i = 0; i < 6; i++) {
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
      hint: ch.hint || 'Think about how the four forces balance!',
    });
  }

  // Force descriptions
  const forceDescriptions: Record<string, { name: string; description: string; analogy: string }> = {};
  for (const key of ['lift', 'weight', 'thrust', 'drag']) {
    const fact = raw[`forceFact_${key}`];
    if (fact?.name && fact?.description && fact?.analogy) {
      forceDescriptions[key] = {
        name: fact.name,
        description: fact.description,
        analogy: fact.analogy,
      };
    } else {
      forceDescriptions[key] = {
        name: key.charAt(0).toUpperCase() + key.slice(1),
        description: `The ${key} force acting on the aircraft.`,
        analogy: 'Think about how forces push and pull!',
      };
    }
  }

  // Flight state descriptions
  const flightStateDescriptions: Record<string, { name: string; description: string }> = {};
  for (const key of ['climbing', 'descending', 'cruising', 'stalling']) {
    const fact = raw[`stateFact_${key}`];
    if (fact?.name && fact?.description) {
      flightStateDescriptions[key] = {
        name: fact.name,
        description: fact.description,
      };
    } else {
      flightStateDescriptions[key] = {
        name: key.charAt(0).toUpperCase() + key.slice(1),
        description: `The aircraft is ${key}.`,
      };
    }
  }

  // Aircraft type validation
  const validAircraftTypes = ['cessna', 'jumbo_jet', 'glider', 'fighter'] as const;
  const aircraftType = validAircraftTypes.includes(raw.aircraftType) ? raw.aircraftType : 'cessna';

  // Grade band
  const gradeBand = raw.gradeBand === '1-2' || raw.gradeBand === '3-5' ? raw.gradeBand : '3-5';

  const data: FlightForcesExplorerData = {
    title: raw.title || 'Sky Forces: How Planes Really Fly',
    description: raw.description || 'Explore the four forces that keep aircraft in the sky!',
    overview: raw.overview || 'Discover how lift, weight, thrust, and drag work together to make flight possible!',
    aircraftType,
    aircraftName: raw.aircraftName || 'Cessna 172',
    gradeBand,
    challenges: challenges.length > 0 ? challenges : undefined,
    forceDescriptions,
    flightStateDescriptions,
  };

  return data;
};
