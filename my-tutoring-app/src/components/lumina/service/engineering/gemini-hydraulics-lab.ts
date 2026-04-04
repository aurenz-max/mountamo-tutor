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
  HydraulicsLabData,
} from '../../primitives/visual-primitives/engineering/HydraulicsLab';

// Re-export for convenience
export type { HydraulicsLabData };

// ============================================================================
// Eval Mode Challenge Type Docs
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  predict: {
    promptDoc: 'Predict: Ask what will happen BEFORE the student tries it. Focus on hypotheses about pressure, force, or motion outcomes.',
    schemaDescription: 'predict — student predicts what will happen in the hydraulic system',
  },
  observe: {
    promptDoc: 'Observe: Ask the student to watch the simulation and describe what they see. Focus on visible evidence of pressure transmission and force multiplication.',
    schemaDescription: 'observe — student watches simulation and explains what forces/pressures are doing',
  },
  adjust: {
    promptDoc: 'Adjust: Ask the student to change a variable (piston area, applied force) and observe the result. Focus on cause-and-effect reasoning about Pascal\'s Law.',
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

const zoneDescSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    analogy: { type: Type.STRING, description: "Kid-friendly everyday analogy for this part of the hydraulic system." },
    explanation: { type: Type.STRING, description: "1-2 sentence explanation of what this component does and why it matters." },
  },
  required: ["analogy", "explanation"],
};

const hydraulicsLabSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging activity title (e.g., 'Hydraulic Power: How Small Forces Move Big Things')." },
    description: { type: Type.STRING, description: "Short educational description of what students will learn." },
    overview: { type: Type.STRING, description: "1-2 sentence conversational overview of the activity." },
    scenario: {
      type: Type.STRING,
      enum: ["hydraulic_press", "car_lift", "excavator", "brake_system"],
      description: "Real-world hydraulic scenario to contextualize the simulation.",
    },
    scenarioName: { type: Type.STRING, description: "Friendly display name for the scenario (e.g., 'Car Lift at the Mechanic')." },
    realWorldContext: { type: Type.STRING, description: "1-2 sentences explaining where this hydraulic system is used in the real world." },
    gradeBand: { type: Type.STRING, enum: ["3-5", "6-8"], description: "Grade band for complexity." },
    // Pascal's Law explanations
    pascalsLawSimple: { type: Type.STRING, description: "Simple, kid-friendly explanation of Pascal's Law (no formulas)." },
    pascalsLawDetailed: { type: Type.STRING, description: "Detailed explanation of Pascal's Law with F=P*A formula for older students." },
    // Zone descriptions — one per clickable zone
    zoneDesc_small_piston: zoneDescSchema,
    zoneDesc_large_piston: zoneDescSchema,
    zoneDesc_connecting_pipe: zoneDescSchema,
    zoneDesc_load: zoneDescSchema,
    // Challenges — flattened (up to 5)
    challenge0: challengeSchema,
    challenge1: challengeSchema,
    challenge2: challengeSchema,
    challenge3: { ...challengeSchema, nullable: true },
    challenge4: { ...challengeSchema, nullable: true },
  },
  required: [
    "title", "description", "overview", "scenario", "scenarioName", "realWorldContext", "gradeBand",
    "pascalsLawSimple", "pascalsLawDetailed",
    "zoneDesc_small_piston", "zoneDesc_large_piston", "zoneDesc_connecting_pipe", "zoneDesc_load",
    "challenge0", "challenge1", "challenge2",
  ],
};

// ============================================================================
// Generator
// ============================================================================

export const generateHydraulicsLab = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>
): Promise<HydraulicsLabData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'hydraulics-lab',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // When an eval mode is active, constrain the type enum on each flattened
  // challenge object so Gemini *cannot* produce disallowed types.
  let activeSchema = hydraulicsLabSchema;
  if (evalConstraint) {
    activeSchema = JSON.parse(JSON.stringify(hydraulicsLabSchema)) as Schema;
    const props = (activeSchema as Record<string, unknown>).properties as Record<string, Record<string, unknown>>;
    const descriptions = evalConstraint.allowedTypes
      .map(t => CHALLENGE_TYPE_DOCS[t]?.schemaDescription ?? t)
      .join(', ');
    for (let i = 0; i < 5; i++) {
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
Create educational content for a Hydraulics Lab that teaches "${topic}" to ${gradeLevel} students.

IMPORTANT: You are providing ONLY educational text content — descriptions, analogies, zone explanations, challenges, and Pascal's Law explanation.
The component hardcodes all physics simulation, canvas rendering, fluid particles, piston geometry, and pressure calculations.
You write the words and questions. You do NOT create physics parameters.

PASCAL'S LAW FOCUS:
Every challenge should relate to Pascal's Law and hydraulic force multiplication:
- PRESSURE is force divided by area: P = F / A
- Pascal's Law: pressure applied to a confined fluid is transmitted equally in all directions
- FORCE MULTIPLICATION: A small force on a small piston creates the same pressure as a large force on a large piston
- The key equation: F1/A1 = F2/A2, so F2 = F1 × (A2/A1)
- Bigger area ratio = more force multiplication (but less distance moved)

KEY CONCEPTS TO COVER:
- Small piston: where you apply the input force (effort)
- Large piston: where the multiplied output force acts (load)
- Connecting pipe: transmits pressure equally through the fluid
- Trade-off: force is multiplied but distance is reduced (conservation of energy)
- Real-world applications: car lifts, hydraulic brakes, excavator arms, hydraulic presses

ZONE DESCRIPTIONS (provide analogy + explanation for each clickable zone):
- small_piston: The input side where you push — like the handle of a pump
- large_piston: The output side that does heavy lifting — like the platform of a car lift
- connecting_pipe: The sealed tube carrying pressurized fluid between pistons
- load: The object being lifted or compressed by the hydraulic force

${challengeTypeSection}

CHALLENGES (create 3-5 multiple choice questions):
- Options: exactly 4 options (a, b, c, d). One correct.
- Hints: helpful but don't give the answer.
- NEVER reveal the answer in the hint or instruction text.

GRADE-LEVEL GUIDELINES:
GRADES 3-5:
- Simple language: "pushing on the small side makes the big side push harder"
- Everyday analogies: squeezing a balloon, water squirter, stepping on a ketchup packet
- No formulas — focus on "bigger area = bigger force" concept
- 3 challenges maximum
- Scenarios: hydraulic_press or car_lift (simple, relatable)
- gradeBand: "3-5"

GRADES 6-8:
- Scientific vocabulary: pressure, force, area, Pascal's Law, force multiplication ratio
- Include F = P × A, area = π × r², and F1/A1 = F2/A2 reasoning
- Quantitative challenges: "If the small piston has area 2 cm² and the large piston has area 20 cm², what is the force multiplication?"
- 4-5 challenges with calculation and reasoning
- Scenarios: any type including excavator and brake_system
- gradeBand: "6-8"

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
  if (!raw) throw new Error('No valid Hydraulics Lab data returned from Gemini');

  // ---- Reconstruct nested structures from flat schema ----

  // Challenges
  const challenges: NonNullable<HydraulicsLabData['challenges']> = [];
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
      hint: ch.hint || 'Think about how pressure spreads through the fluid!',
    });
  }

  // Zone descriptions
  const zoneDescriptions: Record<string, { analogy: string; explanation: string }> = {};
  for (const key of ['small_piston', 'large_piston', 'connecting_pipe', 'load']) {
    const zone = raw[`zoneDesc_${key}`];
    if (zone?.analogy && zone?.explanation) {
      zoneDescriptions[key] = {
        analogy: zone.analogy,
        explanation: zone.explanation,
      };
    } else {
      zoneDescriptions[key] = {
        analogy: `This is the ${key.replace(/_/g, ' ')} of the hydraulic system.`,
        explanation: `The ${key.replace(/_/g, ' ')} plays an important role in how hydraulics work.`,
      };
    }
  }

  // Pascal's Law explanation
  const pascalsLawExplanation = {
    simple: raw.pascalsLawSimple || 'When you push on liquid in a closed container, the push spreads out equally everywhere!',
    detailed: raw.pascalsLawDetailed || 'Pascal\'s Law states that pressure applied to a confined fluid is transmitted undiminished throughout the fluid. Since P = F/A, a larger piston area produces a proportionally larger force.',
  };

  // Scenario validation
  const validScenarios = ['hydraulic_press', 'car_lift', 'excavator', 'brake_system'] as const;
  const scenario = validScenarios.includes(raw.scenario) ? raw.scenario : 'hydraulic_press';

  // Grade band
  const gradeBand = raw.gradeBand === '3-5' || raw.gradeBand === '6-8' ? raw.gradeBand : '3-5';

  const data: HydraulicsLabData = {
    title: raw.title || 'Hydraulic Power: How Small Forces Move Big Things',
    description: raw.description || 'Explore how hydraulic systems multiply force using Pascal\'s Law!',
    overview: raw.overview || 'Discover how a small push can lift a heavy car using the power of pressurized fluid!',
    scenario,
    scenarioName: raw.scenarioName || 'Hydraulic Press',
    realWorldContext: raw.realWorldContext || 'Hydraulic systems are used in car lifts, excavators, brakes, and many other machines.',
    gradeBand,
    zoneDescriptions,
    challenges: challenges.length > 0 ? challenges : undefined,
    pascalsLawExplanation,
  };

  return data;
};
