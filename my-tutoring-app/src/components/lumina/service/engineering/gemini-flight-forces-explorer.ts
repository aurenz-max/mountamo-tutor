import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  FlightForcesExplorerData,
  AircraftProfile,
  ForceInfo,
  FlightState,
  FlightChallenge,
} from '../../primitives/visual-primitives/engineering/FlightForcesExplorer';

// Re-export for convenience if needed elsewhere
export type { FlightForcesExplorerData };

/**
 * Schema for Aircraft Profile
 */
const aircraftProfileSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: "Display name of the aircraft (e.g., 'Cessna 172', 'Boeing 747', 'Paper Glider')"
    },
    type: {
      type: Type.STRING,
      enum: ["cessna", "jumbo_jet", "glider", "fighter", "biplane", "custom"],
      description: "Aircraft type. K-2: cessna or biplane (simple). 3-5: any type including jumbo_jet, glider, fighter."
    },
    imagePrompt: {
      type: Type.STRING,
      description: "A descriptive prompt for generating or selecting an image of this aircraft."
    },
    emptyWeight: {
      type: Type.NUMBER,
      description: "Empty weight of the aircraft in Newtons. Cessna: ~7000, Jumbo jet: ~1800000, Glider: ~2500, Fighter: ~90000, Biplane: ~5000."
    },
    maxThrust: {
      type: Type.NUMBER,
      description: "Maximum thrust in Newtons. Cessna: ~2400, Jumbo jet: ~900000, Glider: 0, Fighter: ~130000, Biplane: ~2000."
    },
    wingArea: {
      type: Type.NUMBER,
      description: "Wing area in square meters. Cessna: ~16, Jumbo jet: ~540, Glider: ~18, Fighter: ~50, Biplane: ~25."
    },
    maxSpeed: {
      type: Type.NUMBER,
      description: "Maximum speed in m/s. Cessna: ~75, Jumbo jet: ~260, Glider: ~70, Fighter: ~600, Biplane: ~60."
    }
  },
  required: ["name", "type", "imagePrompt", "emptyWeight", "maxThrust", "wingArea", "maxSpeed"]
};

/**
 * Schema for Force Info
 */
const forceInfoSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    magnitude: {
      type: Type.NUMBER,
      description: "Force magnitude in Newtons. Must be a positive number."
    },
    description: {
      type: Type.STRING,
      description: "Educational description of the force. K-2: simple ('Lift pushes the plane up'). 3-5: include real magnitudes and physics."
    }
  },
  required: ["magnitude", "description"]
};

/**
 * Schema for Flight State
 */
const flightStateSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    condition: {
      type: Type.STRING,
      description: "Brief description of the conditions that produce this flight state (e.g., 'Thrust > Drag and nose angled up')."
    },
    name: {
      type: Type.STRING,
      enum: ["climbing", "descending", "cruising", "stalling", "accelerating"],
      description: "The flight state name."
    },
    description: {
      type: Type.STRING,
      description: "Educational explanation of this flight state and what forces are at play."
    },
    narration: {
      type: Type.STRING,
      description: "Conversational narration for this state, as if a friendly instructor is explaining. Age-appropriate language."
    }
  },
  required: ["condition", "name", "description", "narration"]
};

/**
 * Schema for Flight Challenge
 */
const flightChallengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique identifier for this challenge (e.g., 'challenge-1', 'reach-cruising-altitude')."
    },
    instruction: {
      type: Type.STRING,
      description: "What the student needs to do (e.g., 'Adjust thrust to reach cruising altitude')."
    },
    targetConditions: {
      type: Type.OBJECT,
      properties: {
        altitudeRange: {
          type: Type.OBJECT,
          properties: {
            min: {
              type: Type.NUMBER,
              description: "Minimum altitude in meters for this challenge."
            },
            max: {
              type: Type.NUMBER,
              description: "Maximum altitude in meters for this challenge."
            }
          },
          required: ["min", "max"]
        },
        speedRange: {
          type: Type.OBJECT,
          properties: {
            min: {
              type: Type.NUMBER,
              description: "Minimum speed in m/s for this challenge."
            },
            max: {
              type: Type.NUMBER,
              description: "Maximum speed in m/s for this challenge."
            }
          },
          required: ["min", "max"]
        }
      },
      required: ["altitudeRange", "speedRange"],
      description: "Target conditions the student must achieve."
    },
    hint: {
      type: Type.STRING,
      description: "A helpful hint if the student is struggling. Age-appropriate and encouraging."
    }
  },
  required: ["id", "instruction", "targetConditions", "hint"]
};

/**
 * Schema for Show Options
 */
const showOptionsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    forceArrows: {
      type: Type.BOOLEAN,
      description: "Show force arrows on the aircraft. True for all grade levels."
    },
    forceValues: {
      type: Type.BOOLEAN,
      description: "Show numeric force values. False for K-2 (too complex), true for 3-5."
    },
    airflowStreamlines: {
      type: Type.BOOLEAN,
      description: "Show airflow streamlines around the aircraft. False for K-2, true for 3-5."
    },
    forceBalanceChart: {
      type: Type.BOOLEAN,
      description: "Show a chart comparing opposing forces. False for K-2, true for 3-5."
    },
    flightPathTrace: {
      type: Type.BOOLEAN,
      description: "Show the flight path trace. False for K-2, optional for 3-5."
    },
    altitudeIndicator: {
      type: Type.BOOLEAN,
      description: "Show an altitude indicator. False for K-2, true for 3-5."
    }
  },
  required: ["forceArrows", "forceValues", "airflowStreamlines", "forceBalanceChart", "flightPathTrace", "altitudeIndicator"]
};

/**
 * Schema for Flight Forces Explorer Data
 */
const flightForcesExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    aircraft: aircraftProfileSchema,
    initialConditions: {
      type: Type.OBJECT,
      properties: {
        altitude: {
          type: Type.NUMBER,
          description: "Starting altitude in meters (0-10000). K-2: 500-2000. 3-5: 1000-5000."
        },
        speed: {
          type: Type.NUMBER,
          description: "Starting speed in m/s (0-1000). Should be within the aircraft's capability."
        },
        thrustPercent: {
          type: Type.NUMBER,
          description: "Starting thrust as percentage of max (0-100). Typically 50-75 for initial state."
        },
        angleOfAttack: {
          type: Type.NUMBER,
          description: "Starting angle of attack in degrees (-10 to 25). Typically 2-5 for level flight."
        },
        cargoWeight: {
          type: Type.NUMBER,
          description: "Additional cargo weight in Newtons (>= 0). K-2: 0 (simple). 3-5: 0-5000 for challenges."
        }
      },
      required: ["altitude", "speed", "thrustPercent", "angleOfAttack", "cargoWeight"],
      description: "Initial flight conditions when the simulation starts."
    },
    forces: {
      type: Type.OBJECT,
      properties: {
        lift: forceInfoSchema,
        weight: forceInfoSchema,
        thrust: forceInfoSchema,
        drag: forceInfoSchema
      },
      required: ["lift", "weight", "thrust", "drag"],
      description: "The four fundamental forces of flight with magnitudes and descriptions."
    },
    flightStates: {
      type: Type.ARRAY,
      items: flightStateSchema,
      description: "Array of 4-5 flight states covering climbing, descending, cruising, stalling, and accelerating."
    },
    challenges: {
      type: Type.ARRAY,
      items: flightChallengeSchema,
      description: "Array of 2-4 challenges for the student to complete."
    },
    showOptions: showOptionsSchema,
    gradeBand: {
      type: Type.STRING,
      description: "Grade band for content calibration: 'K-2' or '3-5'."
    }
  },
  required: ["aircraft", "initialConditions", "forces", "flightStates", "challenges", "showOptions", "gradeBand"]
};

/**
 * Generate Flight Forces Explorer data for visualization
 *
 * Creates flight forces simulations appropriate for K-5 engineering/science education:
 * - K-2: Simple force concepts (push/pull), basic aircraft, visual arrows only
 * - 3-5: Real force magnitudes, quantitative challenges, all visual options
 *
 * @param topic - The flight/forces topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns FlightForcesExplorerData with complete configuration
 */
export const generateFlightForcesExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<FlightForcesExplorerData>
): Promise<FlightForcesExplorerData> => {
  const prompt = `
Create an educational Flight Forces Explorer visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - FLIGHT FORCES:
The Flight Forces Explorer teaches the four fundamental forces of flight through interactive simulation:
1. LIFT - The upward force generated by the wings as air flows over them
2. WEIGHT (GRAVITY) - The downward force pulling the aircraft toward the earth
3. THRUST - The forward force generated by the engine(s)
4. DRAG - The backward force caused by air resistance

KEY PHYSICS PRINCIPLES:
- Lift > Weight = climbing; Lift < Weight = descending; Lift = Weight = level flight
- Thrust > Drag = accelerating; Thrust < Drag = decelerating; Thrust = Drag = constant speed
- Angle of attack affects lift: more angle = more lift (up to stall angle)
- Speed affects lift: faster = more lift
- Stalling occurs when the angle of attack is too high and lift drops suddenly

GRADE-LEVEL GUIDELINES:

K-2 (ages 5-8):
- Concept: Simple force descriptions ("Lift pushes the plane up", "Gravity pulls the plane down")
- Omit numeric values in force descriptions - use simple language only
- Aircraft: Simple types only - cessna or biplane
- Challenges: 1-2 easy challenges (e.g., "Make the plane go up!", "Keep the plane flying straight!")
- showOptions: forceArrows: true, all others: false (keep it simple and visual)
- Initial conditions: low altitude (500-2000m), moderate speed, simple angle
- Force magnitudes: Use realistic values but descriptions should NOT reference numbers
- Language: Conversational, encouraging, simple words
- gradeBand: "K-2"

3-5 (ages 8-11):
- Concept: Real force magnitudes, cause-and-effect reasoning
- Include numeric values in force descriptions and challenge targets
- Aircraft: Any type - can use more complex aircraft (jumbo_jet, glider, fighter)
- Challenges: 2-4 challenges requiring quantitative reasoning (e.g., "Reach cruising altitude between 3000-4000m at a speed of 60-80 m/s")
- showOptions: All can be true - forceArrows, forceValues, airflowStreamlines, forceBalanceChart, flightPathTrace, altitudeIndicator
- Initial conditions: varied altitude (1000-5000m), realistic speeds, meaningful angle of attack
- Force magnitudes: Realistic and referenced in descriptions
- Language: More technical but still accessible, introduce vocabulary like "angle of attack" and "drag coefficient"
- gradeBand: "3-5"

FLIGHT STATES:
Always include 4-5 flight states covering these conditions:
1. CLIMBING - Lift > Weight, thrust is high, nose angled up
2. DESCENDING - Lift < Weight or thrust reduced, nose angled down
3. CRUISING - Forces are balanced, level flight
4. STALLING - Angle of attack too high, lift drops dramatically
5. ACCELERATING - Thrust increased significantly, speed building up

Each flight state MUST have:
- condition: What causes this state (e.g., "Thrust at maximum, angle of attack at 10 degrees")
- name: One of climbing, descending, cruising, stalling, accelerating
- description: Educational explanation
- narration: Conversational, friendly instructor voice narration (age-appropriate)

AIRCRAFT PROFILES:
- Cessna: emptyWeight ~7000N, maxThrust ~2400N, wingArea ~16m2, maxSpeed ~75 m/s
- Jumbo Jet: emptyWeight ~1800000N, maxThrust ~900000N, wingArea ~540m2, maxSpeed ~260 m/s
- Glider: emptyWeight ~2500N, maxThrust 0N (no engine!), wingArea ~18m2, maxSpeed ~70 m/s
- Fighter: emptyWeight ~90000N, maxThrust ~130000N, wingArea ~50m2, maxSpeed ~600 m/s
- Biplane: emptyWeight ~5000N, maxThrust ~2000N, wingArea ~25m2, maxSpeed ~60 m/s

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.aircraft ? `- Aircraft type: ${config.aircraft.type}` : ''}
${config.initialConditions ? `- Initial altitude: ${config.initialConditions.altitude}` : ''}
${config.initialConditions?.speed !== undefined ? `- Initial speed: ${config.initialConditions.speed}` : ''}
${config.initialConditions?.thrustPercent !== undefined ? `- Initial thrust%: ${config.initialConditions.thrustPercent}` : ''}
${config.initialConditions?.angleOfAttack !== undefined ? `- Initial angle of attack: ${config.initialConditions.angleOfAttack}` : ''}
${config.initialConditions?.cargoWeight !== undefined ? `- Cargo weight: ${config.initialConditions.cargoWeight}` : ''}
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config.showOptions ? `- Show options override provided` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. aircraft must have a valid type (cessna, jumbo_jet, glider, fighter, biplane, or custom)
2. All four forces (lift, weight, thrust, drag) must be present with magnitude and description
3. flightStates must have at least 3 entries (ideally 4-5)
4. challenges must have at least 1 entry (K-2: 1-2, 3-5: 2-4)
5. initialConditions ranges: altitude 0-10000, speed 0-1000, thrustPercent 0-100, angleOfAttack -10 to 25, cargoWeight >= 0
6. Include narration fields in all flight states - conversational and age-appropriate
7. Force magnitudes should be physically reasonable for the chosen aircraft

Return a complete Flight Forces Explorer configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: flightForcesExplorerSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Flight Forces Explorer data returned from Gemini API');
  }

  // Validation: ensure aircraft has a valid type
  const validAircraftTypes = ["cessna", "jumbo_jet", "glider", "fighter", "biplane", "custom"];
  if (!data.aircraft || !validAircraftTypes.includes(data.aircraft.type)) {
    console.warn('Invalid aircraft type. Setting default.');
    if (!data.aircraft) {
      data.aircraft = {
        name: "Cessna 172",
        type: "cessna",
        imagePrompt: "A small single-engine Cessna 172 aircraft in flight against a blue sky",
        emptyWeight: 7000,
        maxThrust: 2400,
        wingArea: 16,
        maxSpeed: 75
      };
    } else {
      data.aircraft.type = "cessna";
    }
  }

  // Validation: ensure all four forces are present
  if (!data.forces) {
    data.forces = {};
  }
  if (!data.forces.lift) {
    console.warn('Missing lift force. Setting default.');
    data.forces.lift = { magnitude: 7000, description: "Lift pushes the plane up as air flows over the wings." };
  }
  if (!data.forces.weight) {
    console.warn('Missing weight force. Setting default.');
    data.forces.weight = { magnitude: 7000, description: "Gravity pulls the plane down toward the ground." };
  }
  if (!data.forces.thrust) {
    console.warn('Missing thrust force. Setting default.');
    data.forces.thrust = { magnitude: 2400, description: "The engine pushes the plane forward." };
  }
  if (!data.forces.drag) {
    console.warn('Missing drag force. Setting default.');
    data.forces.drag = { magnitude: 1200, description: "Air resistance slows the plane down." };
  }

  // Validation: ensure force magnitudes are positive numbers
  for (const forceKey of ['lift', 'weight', 'thrust', 'drag'] as const) {
    if (typeof data.forces[forceKey].magnitude !== 'number' || data.forces[forceKey].magnitude < 0) {
      console.warn(`Invalid ${forceKey} magnitude. Setting default.`);
      data.forces[forceKey].magnitude = forceKey === 'lift' ? 7000 : forceKey === 'weight' ? 7000 : forceKey === 'thrust' ? 2400 : 1200;
    }
  }

  // Validation: ensure flightStates has at least 3 entries
  if (!data.flightStates || data.flightStates.length < 3) {
    console.warn('Insufficient flightStates. Setting defaults.');
    data.flightStates = [
      {
        condition: "Thrust is high and nose is angled up",
        name: "climbing",
        description: "The plane is going up because lift is greater than weight.",
        narration: "We're climbing! The engine is working hard and our wings are tilted up to push us higher into the sky."
      },
      {
        condition: "Thrust is reduced and nose is angled down",
        name: "descending",
        description: "The plane is going down because weight is greater than lift.",
        narration: "We're coming down now. We reduced the engine power, and gravity is gently pulling us lower."
      },
      {
        condition: "All forces are balanced",
        name: "cruising",
        description: "The plane flies level because lift equals weight and thrust equals drag.",
        narration: "Smooth sailing! All the forces are perfectly balanced, so we fly nice and level."
      },
      {
        condition: "Angle of attack is too high",
        name: "stalling",
        description: "The plane loses lift because the wings are tilted too steeply.",
        narration: "Whoa, we tilted the nose too high! The air can't flow smoothly over the wings anymore, so we're losing lift."
      },
      {
        condition: "Thrust has been increased significantly",
        name: "accelerating",
        description: "The plane speeds up because thrust is greater than drag.",
        narration: "Full throttle! The engine is pushing us forward faster than the air can slow us down. Feel the speed!"
      }
    ];
  }

  // Validation: ensure each flight state has required fields
  const validStateNames = ["climbing", "descending", "cruising", "stalling", "accelerating"];
  data.flightStates = data.flightStates.map((state: FlightState) => ({
    condition: state.condition || "Forces are unbalanced",
    name: validStateNames.includes(state.name) ? state.name : "cruising",
    description: state.description || "The aircraft is in this flight state.",
    narration: state.narration || state.description || "The aircraft is flying."
  }));

  // Validation: ensure challenges is an array with at least 1 entry
  if (!data.challenges || !Array.isArray(data.challenges) || data.challenges.length < 1) {
    console.warn('Insufficient challenges. Setting defaults.');
    data.challenges = [
      {
        id: "challenge-1",
        instruction: "Make the plane climb to a higher altitude!",
        targetConditions: {
          altitudeRange: { min: 2000, max: 4000 },
          speedRange: { min: 30, max: 80 }
        },
        hint: "Try increasing the thrust and tilting the nose up a little."
      }
    ];
  }

  // Validation: ensure each challenge has required fields
  data.challenges = data.challenges.map((challenge: FlightChallenge, index: number) => ({
    id: challenge.id || `challenge-${index + 1}`,
    instruction: challenge.instruction || "Complete this flight challenge!",
    targetConditions: {
      altitudeRange: {
        min: challenge.targetConditions?.altitudeRange?.min ?? 1000,
        max: challenge.targetConditions?.altitudeRange?.max ?? 5000
      },
      speedRange: {
        min: challenge.targetConditions?.speedRange?.min ?? 20,
        max: challenge.targetConditions?.speedRange?.max ?? 100
      }
    },
    hint: challenge.hint || "Adjust the thrust and angle of attack to reach the target."
  }));

  // Validation: initialConditions ranges
  if (!data.initialConditions) {
    data.initialConditions = { altitude: 1000, speed: 50, thrustPercent: 60, angleOfAttack: 3, cargoWeight: 0 };
  }
  data.initialConditions.altitude = Math.max(0, Math.min(10000, data.initialConditions.altitude ?? 1000));
  data.initialConditions.speed = Math.max(0, Math.min(1000, data.initialConditions.speed ?? 50));
  data.initialConditions.thrustPercent = Math.max(0, Math.min(100, data.initialConditions.thrustPercent ?? 60));
  data.initialConditions.angleOfAttack = Math.max(-10, Math.min(25, data.initialConditions.angleOfAttack ?? 3));
  data.initialConditions.cargoWeight = Math.max(0, data.initialConditions.cargoWeight ?? 0);

  // Validation: ensure showOptions exists with defaults
  if (!data.showOptions) {
    data.showOptions = {
      forceArrows: true,
      forceValues: false,
      airflowStreamlines: false,
      forceBalanceChart: false,
      flightPathTrace: false,
      altitudeIndicator: false
    };
  }

  // Validation: default gradeBand based on gradeLevel
  if (!data.gradeBand) {
    const gradeNum = parseInt(gradeLevel.replace(/[^0-9]/g, ''), 10);
    if (isNaN(gradeNum) || gradeNum <= 2) {
      data.gradeBand = "K-2";
    } else {
      data.gradeBand = "3-5";
    }
  }

  // Apply config overrides
  if (config) {
    if (config.aircraft) data.aircraft = { ...data.aircraft, ...config.aircraft };
    if (config.initialConditions) data.initialConditions = { ...data.initialConditions, ...config.initialConditions };
    if (config.forces) data.forces = { ...data.forces, ...config.forces };
    if (config.flightStates) data.flightStates = config.flightStates;
    if (config.challenges) data.challenges = config.challenges;
    if (config.showOptions) data.showOptions = { ...data.showOptions, ...config.showOptions };
    if (config.gradeBand) data.gradeBand = config.gradeBand;
  }

  return data;
};
