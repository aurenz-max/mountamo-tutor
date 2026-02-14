import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  PropulsionLabData,
  PropulsionType,
  NewtonThirdLaw,
  WhatIfExperiment,
  PropulsionComparison,
} from '../../primitives/visual-primitives/engineering/PropulsionLab';

// Re-export for convenience
export type { PropulsionLabData };

/**
 * Schema for Propulsion Type
 */
const propulsionTypeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: "Unique identifier (kebab-case, e.g., 'jet-turbofan')." },
    name: { type: Type.STRING, description: "Display name (e.g., 'Jet Turbofan Engine')." },
    method: {
      type: Type.STRING,
      enum: ["propeller_air", "jet", "propeller_water", "wheel_friction", "sail", "paddle", "rocket", "electric"],
      description: "Type of propulsion method."
    },
    vehicle: { type: Type.STRING, description: "Real vehicle that uses this propulsion (e.g., 'Boeing 747')." },
    actionDescription: { type: Type.STRING, description: "What gets pushed backward (the action). Kid-friendly language." },
    reactionDescription: { type: Type.STRING, description: "The vehicle moving forward (the reaction). Kid-friendly language." },
    medium: {
      type: Type.STRING,
      enum: ["air", "water", "ground", "vacuum", "wind"],
      description: "What medium this propulsion pushes against."
    },
    thrustRange: {
      type: Type.OBJECT,
      properties: {
        min: { type: Type.NUMBER, description: "Minimum thrust in the given unit." },
        max: { type: Type.NUMBER, description: "Maximum thrust in the given unit." },
        unit: { type: Type.STRING, description: "Unit of thrust (e.g., 'N', 'kN')." },
      },
      required: ["min", "max", "unit"]
    },
    efficiency: { type: Type.STRING, description: "Brief description of this method's efficiency." },
    mediumRequired: { type: Type.BOOLEAN, description: "Whether this propulsion needs a medium to work (false for rockets)." },
    analogy: { type: Type.STRING, description: "Kid-friendly analogy (e.g., 'Like a balloon zooming around a room')." },
    imagePrompt: { type: Type.STRING, description: "Prompt for generating an illustration of this propulsion in action." },
  },
  required: ["id", "name", "method", "vehicle", "actionDescription", "reactionDescription", "medium", "thrustRange", "efficiency", "mediumRequired", "analogy", "imagePrompt"]
};

/**
 * Schema for Newton's Third Law
 */
const newtonThirdLawSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    statement: { type: Type.STRING, description: "Kid-friendly statement of Newton's Third Law." },
    examples: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING, description: "The action force." },
          reaction: { type: Type.STRING, description: "The equal and opposite reaction." },
          context: { type: Type.STRING, description: "Real-world context (e.g., 'When you jump, you push the ground down...')." },
        },
        required: ["action", "reaction", "context"]
      },
      description: "2-3 everyday examples of Newton's Third Law."
    },
  },
  required: ["statement", "examples"]
};

/**
 * Schema for What-If Experiment
 */
const whatIfExperimentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    scenario: { type: Type.STRING, description: "A thought experiment scenario (e.g., 'What if you put a propeller in space?')." },
    prediction_options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-4 possible answers for the student to choose from." },
    correctAnswer: { type: Type.STRING, description: "The correct answer (must match one of prediction_options exactly)." },
    explanation: { type: Type.STRING, description: "Kid-friendly explanation of the correct answer." },
    relatedPropulsionId: { type: Type.STRING, description: "ID of the propulsion type this experiment relates to." },
  },
  required: ["scenario", "prediction_options", "correctAnswer", "explanation", "relatedPropulsionId"]
};

/**
 * Schema for Propulsion Comparison
 */
const propulsionComparisonSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    propulsionA: { type: Type.STRING, description: "ID of first propulsion type." },
    propulsionB: { type: Type.STRING, description: "ID of second propulsion type." },
    question: { type: Type.STRING, description: "Guiding comparison question." },
    insight: { type: Type.STRING, description: "Key insight from comparing these two." },
  },
  required: ["propulsionA", "propulsionB", "question", "insight"]
};

/**
 * Schema for Propulsion Lab Data
 */
const propulsionLabSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    propulsionTypes: { type: Type.ARRAY, items: propulsionTypeSchema, description: "Array of 4-6 propulsion types to explore." },
    newtonThirdLaw: newtonThirdLawSchema,
    whatIfExperiments: { type: Type.ARRAY, items: whatIfExperimentSchema, description: "3-4 what-if thought experiments." },
    comparisons: { type: Type.ARRAY, items: propulsionComparisonSchema, description: "2-3 propulsion comparisons." },
    gradeBand: { type: Type.STRING, enum: ["1-2", "3-5"], description: "Grade band for complexity." },
  },
  required: ["propulsionTypes", "newtonThirdLaw", "whatIfExperiments", "comparisons", "gradeBand"]
};

/**
 * Generate Propulsion Lab data
 */
export const generatePropulsionLab = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<PropulsionLabData>
): Promise<PropulsionLabData> => {
  const prompt = `
Create a Propulsion Lab for teaching "${topic}" to ${gradeLevel} students.

CONTEXT — PROPULSION AND NEWTON'S THIRD LAW:
This lab teaches how vehicles generate thrust through Newton's Third Law:
"For every action, there is an equal and opposite reaction."

KEY PROPULSION TYPES (include at least 4):
1. Jet engine (jet) — Hot exhaust blasts backward → plane pushes forward. Vehicle: Boeing 747.
2. Propeller in air (propeller_air) — Spinning blade pushes air backward → plane moves forward. Vehicle: Cessna 172.
3. Propeller in water (propeller_water) — Spinning blade pushes water backward → ship moves forward. Vehicle: Container ship.
4. Wheels on road (wheel_friction) — Tires push ground backward → car moves forward. Vehicle: Tesla.
5. Sail (sail) — Wind pushes against sail → boat moves. Vehicle: Sailboat.
6. Rocket (rocket) — Exhaust fires out the back → rocket moves forward. Works in vacuum! Vehicle: Space Shuttle.
7. Paddle (paddle) — Push water backward with paddle → kayak moves forward. Vehicle: Kayak.
8. Electric motor (electric) — Electromagnetic force spins wheels → vehicle moves. Vehicle: Electric train.

CRITICAL: Rockets work in vacuum (mediumRequired: false). Propellers/wheels/sails need a medium (mediumRequired: true).

GRADE-LEVEL GUIDELINES:

GRADES 1-2:
- Newton's Third Law in simplest terms: "Push backward → go forward"
- 4 propulsion types maximum (balloon/jet, propeller, wheels, paddle)
- Everyday analogies: balloon zooming, rowing a boat, pushing off a wall
- thrustRange in simple numbers (e.g., 1-100 N)
- 2-3 simple what-if experiments
- gradeBand: "1-2"

GRADES 3-5:
- Full Newton's Third Law with action/reaction pair identification
- 5-6 propulsion types including rocket (vacuum discussion)
- Scientific language: thrust, medium, efficiency
- Real thrust values (e.g., jet engine: 100,000-300,000 N)
- 3-4 what-if experiments with medium dependency focus
- gradeBand: "3-5"

CRITICAL RULES:
- correctAnswer must EXACTLY match one of the prediction_options
- comparison propulsionA and propulsionB must match propulsionType ids
- whatIfExperiment relatedPropulsionId must match a propulsionType id
- analogy fields should reference experiences kids already know

${config ? `CONFIGURATION HINTS:\n${JSON.stringify(config, null, 2)}` : ''}

Return a complete Propulsion Lab configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: propulsionLabSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Propulsion Lab data returned from Gemini API');
  }

  // Validation
  if (!data.propulsionTypes || data.propulsionTypes.length < 2) {
    throw new Error('Propulsion Lab requires at least 2 propulsion types');
  }

  // Ensure valid methods
  const validMethods = ['propeller_air', 'jet', 'propeller_water', 'wheel_friction', 'sail', 'paddle', 'rocket', 'electric'];
  for (const pt of data.propulsionTypes) {
    if (!validMethods.includes(pt.method)) {
      console.warn(`Invalid method "${pt.method}" for ${pt.name}. Defaulting to "jet".`);
      pt.method = 'jet';
    }
  }

  // Ensure correctAnswer matches prediction_options
  for (const exp of data.whatIfExperiments || []) {
    if (!exp.prediction_options.includes(exp.correctAnswer)) {
      console.warn(`correctAnswer "${exp.correctAnswer}" not in prediction_options. Adding it.`);
      exp.prediction_options.push(exp.correctAnswer);
    }
  }

  return data;
};
