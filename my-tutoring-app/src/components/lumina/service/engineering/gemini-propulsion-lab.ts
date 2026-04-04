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
  PropulsionLabData,
} from '../../primitives/visual-primitives/engineering/PropulsionLab';

// Re-export for convenience
export type { PropulsionLabData };

// ============================================================================
// Eval Mode Challenge Type Docs
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  predict: {
    promptDoc: 'Predict: Ask what will happen BEFORE the student tries it. Focus on hypotheses about action/reaction.',
    schemaDescription: 'predict — student predicts outcome before testing',
  },
  observe: {
    promptDoc: 'Observe: Ask the student to watch particles and describe what they see. Focus on visible evidence of Newton\'s Third Law.',
    schemaDescription: 'observe — student watches simulation and explains',
  },
  experiment: {
    promptDoc: 'Experiment: Ask the student to change variables (propulsion type, medium) and compare results. Focus on medium dependence.',
    schemaDescription: 'experiment — student designs tests and compares outcomes',
  },
};

// ============================================================================
// Gemini Schemas — flat, simple, content-only (no physics or propulsion params)
// ============================================================================

const challengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: "Unique ID like ch1, ch2, etc." },
    type: {
      type: Type.STRING,
      enum: ["predict", "observe", "experiment"],
      description: "predict = what will happen, observe = watch and describe, experiment = change variables and see results",
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

const propulsionFactSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Display name for this propulsion type (e.g., 'Jet Engine')." },
    description: { type: Type.STRING, description: "1-2 sentence explanation of how this propulsion works, grade-appropriate." },
    analogy: { type: Type.STRING, description: "Kid-friendly everyday analogy (e.g., 'Like a balloon zooming when you let go')." },
  },
  required: ["name", "description", "analogy"],
};

const mediumFactSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Display name for this medium (e.g., 'Air')." },
    description: { type: Type.STRING, description: "1-2 sentence explanation of how this medium affects propulsion." },
  },
  required: ["name", "description"],
};

const propulsionLabSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging activity title (e.g., 'Push It! Newton's Third Law Lab')." },
    description: { type: Type.STRING, description: "Short educational description of what students will learn." },
    overview: { type: Type.STRING, description: "1-2 sentence conversational overview of the lab activity." },
    gradeBand: { type: Type.STRING, enum: ["1-2", "3-5"], description: "Grade band for complexity." },
    // Challenges — flattened (up to 6)
    challenge0: challengeSchema,
    challenge1: challengeSchema,
    challenge2: challengeSchema,
    challenge3: { ...challengeSchema, nullable: true },
    challenge4: { ...challengeSchema, nullable: true },
    challenge5: { ...challengeSchema, nullable: true },
    // Propulsion facts — one per hardcoded type
    propulsionFact_jet: propulsionFactSchema,
    propulsionFact_rocket: propulsionFactSchema,
    propulsionFact_propeller: propulsionFactSchema,
    propulsionFact_sail: propulsionFactSchema,
    // Medium facts — one per hardcoded medium
    mediumFact_air: mediumFactSchema,
    mediumFact_water: mediumFactSchema,
    mediumFact_vacuum: mediumFactSchema,
  },
  required: [
    "title", "description", "overview", "gradeBand",
    "challenge0", "challenge1", "challenge2",
    "propulsionFact_jet", "propulsionFact_rocket", "propulsionFact_propeller", "propulsionFact_sail",
    "mediumFact_air", "mediumFact_water", "mediumFact_vacuum",
  ],
};

// ============================================================================
// Generator
// ============================================================================

export const generatePropulsionLab = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>
): Promise<PropulsionLabData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'propulsion-lab',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // When an eval mode is active, constrain the type enum on each flattened
  // challenge object so Gemini *cannot* produce disallowed types.
  // The standard constrainChallengeTypeEnum targets `challenges.items` (array form),
  // but our schema has flattened `challenge0..challenge5` objects. We constrain each manually.
  let activeSchema = propulsionLabSchema;
  if (evalConstraint) {
    activeSchema = JSON.parse(JSON.stringify(propulsionLabSchema)) as Schema;
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
Create educational content for a Propulsion Lab that teaches "${topic}" to ${gradeLevel} students.

IMPORTANT: You are providing ONLY educational text content — descriptions, analogies, facts, and challenge questions.
The component hardcodes all physics simulation, propulsion types (jet, rocket, propeller, sail), and mediums (air, water, vacuum).
You write the words and questions. You do NOT create physics parameters.

NEWTON'S THIRD LAW FOCUS:
Every challenge should relate to Newton's Third Law: "For every action, there is an equal and opposite reaction."
Cover concepts like:
- Action/reaction pairs in different propulsion types
- How the medium affects thrust (air vs water vs vacuum)
- Why rockets work in space but propellers don't
- Comparing thrust in different mediums

PROPULSION FACTS (provide educational text for each):
- jet: Jet engines that push hot exhaust backward to move forward
- rocket: Rockets that carry their own fuel and work in vacuum
- propeller: Spinning blades that push air/water backward
- sail: Catching wind to generate forward motion

MEDIUM FACTS (provide educational text for each):
- air: How air affects different propulsion types
- water: How water's density changes thrust behavior
- vacuum: Why only rockets work in space (nothing to push against for propellers/sails)

${challengeTypeSection}

CHALLENGES (create 3-6 multiple choice questions):
- Options: exactly 4 options (a, b, c, d). One correct.
- Hints: helpful but don't give the answer.

GRADE-LEVEL GUIDELINES:
GRADES 1-2:
- Simple language: "push backward to go forward"
- Everyday analogies: balloons, rowing boats, pushing off walls
- 3-4 challenges maximum
- gradeBand: "1-2"

GRADES 3-5:
- Scientific vocabulary: thrust, medium, action/reaction, Newton's Third Law
- Real-world vehicle examples in descriptions
- 4-6 challenges with medium-dependency focus
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
  if (!raw) throw new Error('No valid Propulsion Lab data returned from Gemini');

  // ---- Reconstruct nested structures from flat schema ----

  // Challenges
  const challenges: PropulsionLabData['challenges'] = [];
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
      hint: ch.hint || 'Think about Newton\'s Third Law!',
    });
  }

  // Propulsion facts
  const propulsionFacts: Record<string, { name: string; description: string; analogy: string }> = {};
  for (const key of ['jet', 'rocket', 'propeller', 'sail']) {
    const fact = raw[`propulsionFact_${key}`];
    if (fact?.name && fact?.description && fact?.analogy) {
      propulsionFacts[key] = {
        name: fact.name,
        description: fact.description,
        analogy: fact.analogy,
      };
    } else {
      // Defaults
      propulsionFacts[key] = {
        name: key.charAt(0).toUpperCase() + key.slice(1),
        description: `A ${key}-based propulsion system.`,
        analogy: 'Push backward to go forward!',
      };
    }
  }

  // Medium facts
  const mediumFacts: Record<string, { name: string; description: string }> = {};
  for (const key of ['air', 'water', 'vacuum']) {
    const fact = raw[`mediumFact_${key}`];
    if (fact?.name && fact?.description) {
      mediumFacts[key] = {
        name: fact.name,
        description: fact.description,
      };
    } else {
      mediumFacts[key] = {
        name: key.charAt(0).toUpperCase() + key.slice(1),
        description: `Propulsion through ${key}.`,
      };
    }
  }

  // Grade band
  const gradeBand = raw.gradeBand === '1-2' || raw.gradeBand === '3-5' ? raw.gradeBand : '3-5';

  const data: PropulsionLabData = {
    title: raw.title || 'Propulsion Lab: Newton\'s Third Law',
    description: raw.description || 'Explore how different propulsion types use action and reaction!',
    overview: raw.overview || 'Push backward to go forward — that\'s Newton\'s Third Law in action!',
    gradeBand,
    challenges: challenges.length > 0 ? challenges : undefined,
    propulsionFacts,
    mediumFacts,
  };

  return data;
};
