import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  PaperAirplaneDesignerData,
  Challenge,
} from '../../primitives/visual-primitives/engineering/PaperAirplaneDesigner';

// Re-export for convenience if needed elsewhere
export type { PaperAirplaneDesignerData };

/**
 * Schema for AdjustableParam (value + range)
 */
const adjustableParamSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    value: {
      type: Type.NUMBER,
      description: "Current value for this parameter."
    },
    adjustable: {
      type: Type.BOOLEAN,
      description: "Whether the student can adjust this parameter."
    },
    min: {
      type: Type.NUMBER,
      description: "Minimum allowed value."
    },
    max: {
      type: Type.NUMBER,
      description: "Maximum allowed value."
    }
  },
  required: ["value", "adjustable", "min", "max"]
};

/**
 * Schema for nose weight (value + adjustable only, no min/max)
 */
const noseWeightSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    value: {
      type: Type.NUMBER,
      description: "Nose weight value (0 = none, 1 = light paper clip, 2 = heavy clip). Range 0-3."
    },
    adjustable: {
      type: Type.BOOLEAN,
      description: "Whether the student can adjust nose weight."
    }
  },
  required: ["value", "adjustable"]
};

/**
 * Schema for PlaneTemplate
 */
const templateSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      enum: ["dart", "glider", "stunt", "wide_body", "custom"],
      description: "Template type. 'dart' = fast/pointy, 'glider' = wide wings/slow, 'stunt' = loops/tricks, 'wide_body' = stable/large, 'custom' = blank slate."
    },
    description: {
      type: Type.STRING,
      description: "Kid-friendly description of this airplane template and what makes it special."
    },
    baseFolds: {
      type: Type.INTEGER,
      description: "Number of base folds for this template. K-2: 3-5 folds, 3-5: 5-8 folds."
    },
    imagePrompt: {
      type: Type.STRING,
      description: "A prompt to generate an illustration of this paper airplane design."
    }
  },
  required: ["name", "description", "baseFolds", "imagePrompt"]
};

/**
 * Schema for DesignParameters
 */
const designParametersSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    noseAngle: {
      ...adjustableParamSchema,
      description: "Nose angle in degrees. Pointy (15-25) = fast, Wide (35-45) = stable. Default range: 15-45."
    },
    wingSpan: {
      ...adjustableParamSchema,
      description: "Wing span in cm. Short (8-12) = fast, Long (16-20) = glidy. Default range: 8-20."
    },
    wingAngle: {
      ...adjustableParamSchema,
      description: "Wing dihedral angle in degrees. Flat (0-10) = stable, Angled (20-30) = maneuverable. Default range: 0-30."
    },
    hasWinglets: {
      type: Type.BOOLEAN,
      description: "Whether the design includes winglets (small vertical folds at wing tips). Adds stability."
    },
    hasElevatorTab: {
      type: Type.BOOLEAN,
      description: "Whether the design includes an elevator tab (small fold at tail). Affects pitch."
    },
    noseWeight: {
      ...noseWeightSchema,
      description: "Nose weight to shift center of gravity forward. Helps stability."
    }
  },
  required: ["noseAngle", "wingSpan", "wingAngle", "hasWinglets", "hasElevatorTab", "noseWeight"]
};

/**
 * Schema for LaunchSettings
 */
const launchSettingsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    angle: {
      ...adjustableParamSchema,
      description: "Launch angle in degrees above horizontal. 0 = level, 45 = steep upward. Range: -10 to 60."
    },
    force: {
      ...adjustableParamSchema,
      description: "Launch force (1-10 scale). 1 = gentle toss, 10 = hard throw. Range: 1-10."
    },
    windSpeed: {
      type: Type.NUMBER,
      description: "Wind speed (0-10). 0 = calm, 10 = strong breeze. K-2: 0-3, 3-5: 0-7."
    },
    windDirection: {
      type: Type.NUMBER,
      description: "Wind direction in degrees. 0 = headwind, 90 = crosswind right, 180 = tailwind, 270 = crosswind left."
    }
  },
  required: ["angle", "force", "windSpeed", "windDirection"]
};

/**
 * Schema for Challenge
 */
const challengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique challenge identifier (e.g., 'distance-1', 'hangtime-1', 'accuracy-1')."
    },
    name: {
      type: Type.STRING,
      description: "Kid-friendly challenge name (e.g., 'Long Distance Flyer!', 'Hang Time Hero')."
    },
    goal: {
      type: Type.STRING,
      description: "Description of what the student needs to achieve."
    },
    targetMetric: {
      type: Type.STRING,
      enum: ["distance", "hangTime", "accuracy"],
      description: "Which metric the challenge measures."
    },
    targetValue: {
      type: Type.NUMBER,
      description: "Target value to beat. Distance in meters (2-15), hangTime in seconds (1-8), accuracy 0-100."
    },
    hint: {
      type: Type.STRING,
      description: "A helpful hint for the student if they're stuck."
    },
    maxAttempts: {
      type: Type.INTEGER,
      description: "Maximum number of attempts allowed, or null for unlimited.",
      nullable: true
    }
  },
  required: ["id", "name", "goal", "targetMetric", "targetValue", "hint", "maxAttempts"]
};

/**
 * Schema for PaperAirplaneDesignerData
 */
const paperAirplaneDesignerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the paper airplane activity (e.g., 'Design & Fly: The Distance Challenge!')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining the challenge and what students will learn. Use age-appropriate language."
    },
    template: templateSchema,
    designParameters: designParametersSchema,
    launchSettings: launchSettingsSchema,
    challenges: {
      type: Type.ARRAY,
      items: challengeSchema,
      description: "Array of 1-3 challenges for the student. Start with one easy challenge, add harder ones for higher grades."
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K-2", "3-5"],
      description: "Grade band. 'K-2' for kindergarten through 2nd grade, '3-5' for 3rd through 5th grade."
    }
  },
  required: ["title", "description", "template", "designParameters", "launchSettings", "challenges", "gradeBand"]
};

/**
 * Generate Paper Airplane Designer data for visualization
 *
 * Creates paper airplane design challenges appropriate for K-5 engineering education:
 * - K: Pick a template, throw it, see what happens (cause & effect)
 * - 1: Symmetry matters — even wings fly straight
 * - 2: Fold angles change flight path; nose weight adds stability
 * - 3: Design iteration — change ONE thing, test, compare results
 * - 4: Trade-offs: distance vs hang time vs accuracy; constraint challenges
 * - 5: Systematic variable testing, data collection, optimization
 *
 * @param topic - The engineering topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns PaperAirplaneDesignerData with complete configuration
 */
export const generatePaperAirplaneDesigner = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<PaperAirplaneDesignerData>
): Promise<PaperAirplaneDesignerData> => {
  const prompt = `
Create an educational Paper Airplane Designer visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT — PAPER AIRPLANE ENGINEERING DESIGN PROCESS:
Paper Airplane Designer teaches the engineering design process through iterative airplane creation:
1. DESIGN — Choose a template and modify parameters (nose angle, wingspan, wing angle, winglets, elevator tab, nose weight)
2. BUILD — See the fold pattern update in real time as parameters change
3. TEST — Launch the airplane in a simulated flight and observe the trajectory
4. ITERATE — Review performance metrics (distance, hang time, stability, accuracy), change ONE variable, and fly again

KEY ENGINEERING PRINCIPLES:
- Pointy noses (low nose angle) reduce drag → more distance
- Wide wingspans increase lift → more hang time
- Wing dihedral angle affects stability vs maneuverability
- Winglets reduce vortex drag at wingtips
- Elevator tabs control pitch (up/down flight path)
- Nose weight shifts center of gravity forward → straighter flight
- Launch angle and force interact with design for different outcomes
- Design iteration: change one variable at a time to understand cause and effect

GRADE-LEVEL GUIDELINES:

KINDERGARTEN (ages 5-6):
- Concept: Different shapes fly differently — cause and effect
- Challenge: One simple "fly the farthest" challenge
- Template: Pre-selected (dart or glider), limited adjustability
- Design: Most parameters locked; only 1-2 adjustable (e.g., wingSpan, force)
- Launch: Simple force slider only; no wind
- gradeBand: "K-2"
- Challenges: 1 easy challenge, unlimited attempts, generous target
- Language: "Pick your airplane and throw it! How far did it go?"
- noseAngle: adjustable=false, wingSpan: adjustable=true, wingAngle: adjustable=false
- hasWinglets: false, hasElevatorTab: false, noseWeight adjustable=false
- Wind: windSpeed=0, windDirection=0
- Launch angle: adjustable=false (fixed at ~15°)

GRADE 1 (ages 6-7):
- Concept: Symmetry — even wings fly straight
- Challenge: 1-2 challenges (distance, maybe accuracy)
- Template: Choose from 2 templates; a few more adjustable parameters
- Design: wingSpan adjustable, wingAngle adjustable, others locked
- Launch: Force adjustable, angle still locked
- gradeBand: "K-2"
- Language: "Make both wings the same size! Symmetry helps your plane fly straight."

GRADE 2 (ages 7-8):
- Concept: Fold angles change how the plane flies; nose weight helps
- Challenge: 2 challenges mixing distance and hang time
- Template: Choose from 3 templates; most design parameters adjustable
- Design: noseAngle, wingSpan, wingAngle adjustable; noseWeight adjustable
- Launch: Force and angle both adjustable; light wind possible (0-3)
- gradeBand: "K-2"
- Language: "Try changing the nose angle! A pointy nose goes fast, a wide nose floats longer."

GRADE 3 (ages 8-9):
- Concept: Design iteration — change ONE thing, test, compare
- Challenge: 2-3 challenges; encourage iteration
- Template: All templates available; full parameter control
- Design: All parameters adjustable
- Launch: Full control; moderate wind (0-5)
- gradeBand: "3-5"
- Language: "Change just one thing at a time. What happened when you made the wings wider?"
- maxAttempts: Use limits (e.g., 5) to encourage thoughtful iteration

GRADE 4 (ages 9-10):
- Concept: Trade-offs — you can't optimize everything at once
- Challenge: 2-3 challenges with conflicting goals (distance AND accuracy)
- Template: All templates; custom template available
- Design: All parameters adjustable
- Launch: Full control; wind (0-7)
- gradeBand: "3-5"
- Language: "This plane flies far but not very straight. Can you find a design that does both?"
- maxAttempts: Stricter limits (3-5) to promote strategic thinking

GRADE 5 (ages 10-11):
- Concept: Systematic variable testing, data collection, optimization
- Challenge: 3 challenges including multi-metric goals
- Template: Custom template encouraged; full control
- Design: All parameters adjustable; narrow ranges for precision
- Launch: Full control; stronger wind (0-10)
- gradeBand: "3-5"
- Language: "Test each variable systematically. Record your results. Can you find the optimal design?"
- maxAttempts: Limited (3-4) to force hypothesis-driven testing

DESIGN PARAMETER GUIDELINES:

For TEMPLATES:
- dart: baseFolds 4-5, fast and straight, good for distance
- glider: baseFolds 5-6, wide wings, good for hang time
- stunt: baseFolds 6-7, asymmetric folds, does loops and tricks
- wide_body: baseFolds 4-5, very stable, good for accuracy
- custom: baseFolds 3, blank slate for advanced students

For DESIGN PARAMETERS:
- noseAngle: min 15, max 45; pointy (15-25) = fast, wide (35-45) = stable
- wingSpan: min 8, max 20 (cm); short = fast, long = glidy
- wingAngle: min 0, max 30 (degrees dihedral); flat = stable, angled = maneuverable
- hasWinglets: false for K-1, optional for 2-3, true for complex designs
- hasElevatorTab: false for K-2, optional for 3+
- noseWeight: value 0-3; 0 = none, 1 = light clip, 2-3 = heavier

For LAUNCH SETTINGS:
- angle: min -10, max 60; 0 = level, positive = upward
- force: min 1, max 10; 1 = gentle, 10 = hard
- windSpeed: 0 for K-1, 0-3 for grade 2, 0-5 for grade 3, 0-7 for grade 4, 0-10 for grade 5
- windDirection: 0 = headwind, 90 = crosswind right, 180 = tailwind

For CHALLENGES:
- Distance targets: K: 3-5m, 1: 4-6m, 2: 5-8m, 3: 6-10m, 4: 8-12m, 5: 10-15m
- Hang time targets: K: 1-2s, 1: 1.5-2.5s, 2: 2-3s, 3: 2.5-4s, 4: 3-5s, 5: 4-8s
- Accuracy targets: K: not used, 1: 50+, 2: 60+, 3: 65+, 4: 70+, 5: 80+
- Hints should be specific and actionable (e.g., "Try making the wings wider for more lift!")

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.template ? `- Template: ${JSON.stringify(config.template)}` : ''}
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config.challenges ? `- Challenges: ${JSON.stringify(config.challenges)}` : ''}
${config.designParameters ? `- Design parameters: ${JSON.stringify(config.designParameters)}` : ''}
${config.launchSettings ? `- Launch settings: ${JSON.stringify(config.launchSettings)}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. challenges must have 1-3 items
2. Each challenge must have a unique id
3. targetMetric must be one of: distance, hangTime, accuracy
4. targetValue must be positive and reasonable for the grade level
5. gradeBand must be "K-2" or "3-5"
6. All AdjustableParam objects must have value within [min, max]
7. noseWeight.value should be 0-3
8. Template baseFolds should be 3-8

Return a complete Paper Airplane Designer configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: paperAirplaneDesignerSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Paper Airplane Designer data returned from Gemini API');
  }

  // Validation: ensure gradeBand is valid
  if (!data.gradeBand || !['K-2', '3-5'].includes(data.gradeBand)) {
    console.warn('Invalid gradeBand. Inferring from gradeLevel.');
    const gradeNum = parseInt(gradeLevel.replace(/\D/g, ''), 10);
    data.gradeBand = (isNaN(gradeNum) || gradeNum <= 2) ? 'K-2' : '3-5';
  }

  // Validation: ensure template exists and has valid name
  if (!data.template) {
    console.warn('No template provided. Setting default dart template.');
    data.template = {
      name: 'dart',
      description: 'A classic fast-flying paper airplane with a pointy nose.',
      baseFolds: 5,
      imagePrompt: 'A simple dart paper airplane with sharp folds',
    };
  }
  if (!['dart', 'glider', 'stunt', 'wide_body', 'custom'].includes(data.template.name)) {
    data.template.name = 'dart';
  }
  if (!data.template.baseFolds || data.template.baseFolds < 3 || data.template.baseFolds > 8) {
    data.template.baseFolds = 5;
  }

  // Validation: ensure designParameters exist
  if (!data.designParameters) {
    console.warn('No designParameters provided. Setting defaults.');
    data.designParameters = {
      noseAngle: { value: 25, adjustable: true, min: 15, max: 45 },
      wingSpan: { value: 14, adjustable: true, min: 8, max: 20 },
      wingAngle: { value: 10, adjustable: true, min: 0, max: 30 },
      hasWinglets: false,
      hasElevatorTab: false,
      noseWeight: { value: 0, adjustable: true },
    };
  }

  // Validation: ensure adjustable params have value in range
  const clampParam = (p: { value: number; adjustable: boolean; min: number; max: number }) => {
    if (p.min > p.max) { const tmp = p.min; p.min = p.max; p.max = tmp; }
    p.value = Math.max(p.min, Math.min(p.max, p.value));
    return p;
  };
  if (data.designParameters.noseAngle) clampParam(data.designParameters.noseAngle);
  if (data.designParameters.wingSpan) clampParam(data.designParameters.wingSpan);
  if (data.designParameters.wingAngle) clampParam(data.designParameters.wingAngle);

  // Validation: ensure noseWeight is reasonable
  if (data.designParameters.noseWeight) {
    data.designParameters.noseWeight.value = Math.max(0, Math.min(3, data.designParameters.noseWeight.value || 0));
  }

  // Validation: ensure launchSettings exist
  if (!data.launchSettings) {
    console.warn('No launchSettings provided. Setting defaults.');
    data.launchSettings = {
      angle: { value: 15, adjustable: true, min: -10, max: 60 },
      force: { value: 5, adjustable: true, min: 1, max: 10 },
      windSpeed: 0,
      windDirection: 0,
    };
  }
  if (data.launchSettings.angle) clampParam(data.launchSettings.angle);
  if (data.launchSettings.force) clampParam(data.launchSettings.force);
  if (data.launchSettings.windSpeed == null || data.launchSettings.windSpeed < 0) {
    data.launchSettings.windSpeed = 0;
  }
  if (data.launchSettings.windSpeed > 10) {
    data.launchSettings.windSpeed = 10;
  }
  if (data.launchSettings.windDirection == null) {
    data.launchSettings.windDirection = 0;
  }

  // Validation: ensure challenges array exists and is non-empty
  if (!data.challenges || !Array.isArray(data.challenges) || data.challenges.length === 0) {
    console.warn('No challenges provided. Setting default challenge.');
    data.challenges = [{
      id: 'distance-1',
      name: 'Fly Far!',
      goal: 'Make your airplane fly as far as you can!',
      targetMetric: 'distance' as const,
      targetValue: 5,
      hint: 'Try a pointy nose and a strong throw!',
      maxAttempts: null,
    }];
  }

  // Validation: ensure each challenge has valid fields
  data.challenges = data.challenges.map((c: Challenge, i: number) => ({
    id: c.id || `challenge-${i + 1}`,
    name: c.name || `Challenge ${i + 1}`,
    goal: c.goal || 'Complete this challenge!',
    targetMetric: ['distance', 'hangTime', 'accuracy'].includes(c.targetMetric) ? c.targetMetric : 'distance',
    targetValue: (c.targetValue && c.targetValue > 0) ? c.targetValue : 5,
    hint: c.hint || 'Try changing one thing at a time!',
    maxAttempts: c.maxAttempts ?? null,
  }));

  // Trim challenges to max 3
  if (data.challenges.length > 3) {
    data.challenges = data.challenges.slice(0, 3);
  }

  // Apply config overrides
  if (config) {
    if (config.title) data.title = config.title;
    if (config.description) data.description = config.description;
    if (config.template) data.template = config.template;
    if (config.designParameters) data.designParameters = config.designParameters;
    if (config.launchSettings) data.launchSettings = config.launchSettings;
    if (config.challenges) data.challenges = config.challenges;
    if (config.gradeBand) data.gradeBand = config.gradeBand;
  }

  return data;
};
