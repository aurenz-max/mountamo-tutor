import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  AirfoilLabData,
  AirfoilShape,
  AerodynamicResults,
  PresetComparison,
  AirfoilChallenge,
} from '../../primitives/visual-primitives/engineering/AirfoilLab';

// Re-export for convenience if needed elsewhere
export type { AirfoilLabData };

/**
 * Schema for Airfoil Shape
 */
const airfoilShapeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    shape: {
      type: Type.STRING,
      enum: ["flat", "symmetric", "cambered", "thick", "supercritical", "bird_wing", "custom"],
      description: "Type of airfoil shape. Flat is a flat plate, symmetric has equal top/bottom curvature, cambered has more curvature on top, thick is a heavy-duty profile, supercritical is optimized for transonic speeds, bird_wing mimics natural flight, custom is user-defined."
    },
    name: {
      type: Type.STRING,
      description: "Human-readable name for this airfoil (e.g., 'Cambered Wing', 'Flat Plate', 'Bird Wing')."
    },
    description: {
      type: Type.STRING,
      description: "Educational description of this airfoil shape and why it produces lift/drag the way it does."
    },
    imagePrompt: {
      type: Type.STRING,
      description: "A prompt describing the visual appearance of this airfoil for illustration purposes."
    }
  },
  required: ["shape", "name", "description", "imagePrompt"]
};

/**
 * Schema for Aerodynamic Results
 */
const aerodynamicResultsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    liftCoefficient: {
      type: Type.NUMBER,
      description: "Coefficient of lift (Cl). Typically 0-2.0 for standard airfoils. Higher = more lift."
    },
    dragCoefficient: {
      type: Type.NUMBER,
      description: "Coefficient of drag (Cd). Typically 0.01-0.5. Lower = less drag."
    },
    liftForce: {
      type: Type.NUMBER,
      description: "Calculated lift force in Newtons based on conditions. Use L = 0.5 * rho * v^2 * Cl."
    },
    dragForce: {
      type: Type.NUMBER,
      description: "Calculated drag force in Newtons based on conditions. Use D = 0.5 * rho * v^2 * Cd."
    },
    stallAngle: {
      type: Type.NUMBER,
      description: "Angle of attack in degrees at which the airfoil stalls (loses lift). Typically 12-20 degrees."
    }
  },
  required: ["liftCoefficient", "dragCoefficient", "liftForce", "dragForce", "stallAngle"]
};

/**
 * Schema for Preset Comparison
 */
const presetComparisonSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: "Name of this comparison experiment (e.g., 'Flat vs Cambered')."
    },
    airfoilA: {
      type: Type.STRING,
      description: "Description or name of the first airfoil in the comparison."
    },
    airfoilB: {
      type: Type.STRING,
      description: "Description or name of the second airfoil in the comparison."
    },
    question: {
      type: Type.STRING,
      description: "Guiding question for students to investigate (e.g., 'Which shape produces more lift?')."
    },
    explanation: {
      type: Type.STRING,
      description: "Educational explanation of what students should discover from this comparison."
    }
  },
  required: ["name", "airfoilA", "airfoilB", "question", "explanation"]
};

/**
 * Schema for Airfoil Challenge
 */
const airfoilChallengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    scenario: {
      type: Type.STRING,
      description: "Real-world scenario for the challenge (e.g., 'Design a wing for a cargo plane that needs lots of lift')."
    },
    targetLift: {
      type: Type.STRING,
      enum: ["high", "medium", "low"],
      description: "Target lift level for this challenge."
    },
    targetDrag: {
      type: Type.STRING,
      enum: ["high", "medium", "low"],
      description: "Target drag level for this challenge."
    },
    hint: {
      type: Type.STRING,
      description: "A hint to help students pick the right airfoil shape and angle of attack."
    }
  },
  required: ["scenario", "targetLift", "targetDrag", "hint"]
};

/**
 * Schema for Visualization Options
 */
const visualizationOptionsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    streamlines: {
      type: Type.BOOLEAN,
      description: "Show airflow streamlines around the airfoil."
    },
    pressureMap: {
      type: Type.BOOLEAN,
      description: "Show color-coded pressure distribution on the airfoil surface."
    },
    velocityMap: {
      type: Type.BOOLEAN,
      description: "Show color-coded velocity field around the airfoil."
    },
    particleMode: {
      type: Type.BOOLEAN,
      description: "Show individual air particles flowing around the airfoil."
    },
    forceGauges: {
      type: Type.BOOLEAN,
      description: "Show force gauge indicators for lift and drag."
    },
    stallVisualization: {
      type: Type.BOOLEAN,
      description: "Visualize stall conditions (turbulent flow separation) when angle exceeds stall angle."
    }
  },
  required: ["streamlines", "pressureMap", "velocityMap", "particleMode", "forceGauges", "stallVisualization"]
};

/**
 * Schema for Airfoil Lab Data
 */
const airfoilLabSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    airfoil: airfoilShapeSchema,
    initialConditions: {
      type: Type.OBJECT,
      properties: {
        angleOfAttack: {
          type: Type.NUMBER,
          description: "Initial angle of attack in degrees (-10 to 25). Default 5 for most demos."
        },
        windSpeed: {
          type: Type.NUMBER,
          description: "Wind speed in m/s (1 to 100). Default 20 for visible effects."
        },
        airDensity: {
          type: Type.NUMBER,
          description: "Air density in kg/m^3. Default 1.225 (sea level standard)."
        }
      },
      required: ["angleOfAttack", "windSpeed", "airDensity"]
    },
    results: aerodynamicResultsSchema,
    presetComparisons: {
      type: Type.ARRAY,
      items: presetComparisonSchema,
      description: "Array of preset comparison experiments to scaffold structured investigation. Include at least 1."
    },
    challenges: {
      type: Type.ARRAY,
      items: airfoilChallengeSchema,
      description: "Array of design challenges for students. Include 2-3 challenges."
    },
    visualizationOptions: visualizationOptionsSchema,
    gradeBand: {
      type: Type.STRING,
      description: "Grade band for this lab (e.g., 'K-2', '3-5'). Determines complexity of content."
    }
  },
  required: ["airfoil", "initialConditions", "results", "presetComparisons", "challenges", "visualizationOptions", "gradeBand"]
};

/**
 * Generate Airfoil Lab data for visualization
 *
 * Creates airfoil / wind tunnel simulations appropriate for K-5 engineering education:
 * - Grades 1-2: Relative terms (more lift / less drag), kid-friendly analogies, simple shapes
 * - Grades 3-5: Quantitative coefficients, Bernoulli's principle, all shape types, complex challenges
 * - All grades: Preset comparisons for scaffolded experimentation, stall angle, 2-3 challenges
 *
 * @param topic - The engineering / science topic to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns AirfoilLabData with complete configuration
 */
export const generateAirfoilLab = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<AirfoilLabData>
): Promise<AirfoilLabData> => {
  const prompt = `
Create an educational Airfoil Lab visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - AIRFOIL AERODYNAMICS:
An Airfoil Lab teaches how wing shapes create lift and drag through hands-on experimentation:
1. AIRFOIL SHAPES - Different cross-section profiles (flat, symmetric, cambered, thick, supercritical, bird_wing)
2. ANGLE OF ATTACK - The tilt of the wing relative to the airflow
3. WIND SPEED - How fast the air flows past the wing
4. LIFT - The upward force created by pressure differences (Bernoulli's principle)
5. DRAG - The backward force that resists motion through the air
6. STALL - When the angle of attack is too high and the wing suddenly loses lift

KEY AERODYNAMIC PRINCIPLES:
- Cambered (curved-top) airfoils produce more lift than flat plates
- Higher angle of attack increases lift—up to the stall angle
- After the stall angle, lift drops sharply and drag spikes
- Faster wind speed means more lift AND more drag (force scales with v^2)
- Streamlined shapes have lower drag than blunt shapes
- Birds and planes use similar aerodynamic principles

GRADE-LEVEL GUIDELINES:

GRADES 1-2 (ages 6-8):
- OMIT numeric coefficients entirely. Use relative terms only: "more lift", "less drag", "a lot of push upward"
- Use kid-friendly analogies: a cambered airfoil is like "a raindrop sliced in half", a flat plate is like "holding a book flat in the wind"
- Focus on cambered and flat shapes only (simplest contrast)
- Simple preset comparisons: "Flat Plate vs Curved Wing — which one flies better?"
- Visualization: streamlines ON, particleMode ON, pressureMap OFF (too abstract), forceGauges ON (simple arrows)
- Stall visualization OFF (concept too advanced)
- Wind speed: low range (5-20 m/s)
- angleOfAttack: small positive values (0-10)
- gradeBand: "K-2"
- Language: Use "push up" instead of "lift force", "push back" instead of "drag force"
- For numeric results fields, still return numbers but keep them simple round values
- Description should use playful, encouraging language

GRADES 3-5 (ages 8-11):
- Include quantitative results: lift/drag coefficients to 2 decimal places
- Teach Bernoulli's principle: faster air over top = lower pressure = lift
- All airfoil shape types available (flat, symmetric, cambered, thick, supercritical, bird_wing)
- More complex challenges with real-world scenarios (cargo plane, fighter jet, glider)
- Preset comparisons should ask students to predict and then test
- Visualization: ALL options available (streamlines, pressureMap, velocityMap, particleMode, forceGauges, stallVisualization)
- Wind speed: full range (5-100 m/s)
- angleOfAttack: full range (-10 to 25)
- gradeBand: "3-5"
- Language: Use proper terms (lift coefficient, drag coefficient, angle of attack, stall)
- Description should reference real engineering applications

FOR ALL GRADES:
- ALWAYS include presetComparisons to scaffold structured experimentation (at least 1, ideally 2)
- ALWAYS include the stall angle in results (typically 12-20 degrees)
- ALWAYS include 2-3 challenges with real-world scenarios
- The airfoil description should explain WHY the shape works the way it does
- The imagePrompt should describe the visual profile clearly

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.airfoil ? `- Airfoil shape: ${JSON.stringify(config.airfoil)}` : ''}
${config.initialConditions ? `- Initial conditions: ${JSON.stringify(config.initialConditions)}` : ''}
${config.visualizationOptions ? `- Visualization options: ${JSON.stringify(config.visualizationOptions)}` : ''}
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config.presetComparisons ? `- Preset comparisons: ${JSON.stringify(config.presetComparisons)}` : ''}
${config.challenges ? `- Challenges: ${JSON.stringify(config.challenges)}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. airfoil.shape must be one of: flat, symmetric, cambered, thick, supercritical, bird_wing, custom
2. initialConditions.angleOfAttack must be between -10 and 25
3. initialConditions.windSpeed must be between 1 and 100
4. initialConditions.airDensity should default to 1.225 (sea level)
5. results must include all five fields (liftCoefficient, dragCoefficient, liftForce, dragForce, stallAngle)
6. stallAngle should be between 12 and 20 degrees
7. presetComparisons must have at least 1 entry
8. challenges must have at least 1 entry (ideally 2-3)
9. gradeBand should match the grade level provided

Return a complete Airfoil Lab configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: airfoilLabSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Airfoil Lab data returned from Gemini API');
  }

  // Validation: ensure airfoil has a valid shape type
  const validShapes = ['flat', 'symmetric', 'cambered', 'thick', 'supercritical', 'bird_wing', 'custom'];
  if (!data.airfoil || !validShapes.includes(data.airfoil.shape)) {
    console.warn('Invalid airfoil shape. Setting default cambered.');
    if (!data.airfoil) {
      data.airfoil = {
        shape: 'cambered',
        name: 'Cambered Wing',
        description: 'A wing shape with more curvature on top than bottom, creating lift.',
        imagePrompt: 'A curved airfoil cross-section with a rounded leading edge and pointed trailing edge, thicker on top.'
      };
    } else {
      data.airfoil.shape = 'cambered';
    }
  }

  // Validation: ensure initialConditions have reasonable ranges
  if (!data.initialConditions) {
    data.initialConditions = { angleOfAttack: 5, windSpeed: 20, airDensity: 1.225 };
  } else {
    if (data.initialConditions.angleOfAttack === undefined ||
        data.initialConditions.angleOfAttack < -10 ||
        data.initialConditions.angleOfAttack > 25) {
      console.warn('Invalid angleOfAttack. Setting default 5.');
      data.initialConditions.angleOfAttack = 5;
    }
    if (data.initialConditions.windSpeed === undefined ||
        data.initialConditions.windSpeed < 1 ||
        data.initialConditions.windSpeed > 100) {
      console.warn('Invalid windSpeed. Setting default 20.');
      data.initialConditions.windSpeed = 20;
    }
    if (data.initialConditions.airDensity === undefined ||
        data.initialConditions.airDensity <= 0) {
      console.warn('Invalid airDensity. Setting default 1.225.');
      data.initialConditions.airDensity = 1.225;
    }
  }

  // Validation: ensure results has all fields
  if (!data.results) {
    console.warn('No results provided. Setting defaults.');
    data.results = {
      liftCoefficient: 0.5,
      dragCoefficient: 0.05,
      liftForce: 50,
      dragForce: 5,
      stallAngle: 15
    };
  } else {
    if (data.results.liftCoefficient === undefined) data.results.liftCoefficient = 0.5;
    if (data.results.dragCoefficient === undefined) data.results.dragCoefficient = 0.05;
    if (data.results.liftForce === undefined) data.results.liftForce = 50;
    if (data.results.dragForce === undefined) data.results.dragForce = 5;
    if (data.results.stallAngle === undefined) data.results.stallAngle = 15;
  }

  // Validation: ensure stallAngle is reasonable (12-20 degrees typically)
  if (data.results.stallAngle < 12 || data.results.stallAngle > 20) {
    console.warn('Stall angle out of typical range (12-20). Clamping.');
    data.results.stallAngle = Math.max(12, Math.min(20, data.results.stallAngle));
  }

  // Validation: ensure presetComparisons has at least 1 entry
  if (!data.presetComparisons || data.presetComparisons.length === 0) {
    console.warn('No presetComparisons provided. Setting default.');
    data.presetComparisons = [
      {
        name: 'Flat vs Cambered',
        airfoilA: 'Flat Plate',
        airfoilB: 'Cambered Wing',
        question: 'Which shape produces more lift at the same angle?',
        explanation: 'The cambered wing creates a pressure difference because air travels faster over the curved top surface.'
      }
    ];
  }

  // Validation: ensure challenges has at least 1 entry
  if (!data.challenges || data.challenges.length === 0) {
    console.warn('No challenges provided. Setting defaults.');
    data.challenges = [
      {
        scenario: 'Design a wing for a paper airplane that needs to glide far.',
        targetLift: 'medium' as const,
        targetDrag: 'low' as const,
        hint: 'A shape that produces steady lift without too much drag will glide the farthest.'
      },
      {
        scenario: 'Design a wing for a heavy cargo plane that needs to carry lots of weight.',
        targetLift: 'high' as const,
        targetDrag: 'medium' as const,
        hint: 'A thicker, more cambered wing can produce more lift to carry heavy loads.'
      }
    ];
  }

  // Validation: ensure visualizationOptions exists
  if (!data.visualizationOptions) {
    console.warn('No visualizationOptions provided. Setting defaults.');
    data.visualizationOptions = {
      streamlines: true,
      pressureMap: false,
      velocityMap: false,
      particleMode: true,
      forceGauges: true,
      stallVisualization: false
    };
  }

  // Validation: default gradeBand based on gradeLevel
  if (!data.gradeBand) {
    const gradeNum = parseInt(gradeLevel.replace(/[^0-9]/g, ''), 10);
    if (isNaN(gradeNum) || gradeNum <= 2) {
      data.gradeBand = 'K-2';
    } else {
      data.gradeBand = '3-5';
    }
  }

  // Apply config overrides
  if (config) {
    if (config.airfoil) data.airfoil = { ...data.airfoil, ...config.airfoil };
    if (config.initialConditions) data.initialConditions = { ...data.initialConditions, ...config.initialConditions };
    if (config.results) data.results = { ...data.results, ...config.results };
    if (config.presetComparisons) data.presetComparisons = config.presetComparisons;
    if (config.challenges) data.challenges = config.challenges;
    if (config.visualizationOptions) data.visualizationOptions = { ...data.visualizationOptions, ...config.visualizationOptions };
    if (config.gradeBand) data.gradeBand = config.gradeBand;
  }

  return data;
};
