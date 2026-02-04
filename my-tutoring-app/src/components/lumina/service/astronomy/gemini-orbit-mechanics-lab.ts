import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  OrbitMechanicsLabData,
  OrbitConfig,
  OrbitalBody,
  RocketConfig,
  ThrustConfig,
} from '../../primitives/visual-primitives/astronomy/OrbitMechanicsLab';

// Re-export for convenience
export type { OrbitMechanicsLabData, OrbitConfig, OrbitalBody, RocketConfig, ThrustConfig };

/**
 * Schema for Orbit Configuration
 */
const orbitConfigSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    semiMajorAxis: {
      type: Type.NUMBER,
      description: "Semi-major axis of orbit (arbitrary units, 1-5 typical range)"
    },
    eccentricity: {
      type: Type.NUMBER,
      description: "Orbital eccentricity (0 = circular, 0-0.9 = elliptical). Keep under 0.7 for K-5."
    },
    argumentOfPeriapsis: {
      type: Type.NUMBER,
      description: "Rotation angle of orbit in degrees (0-360). Optional.",
      nullable: true
    }
  },
  required: ["semiMajorAxis", "eccentricity"]
};

/**
 * Schema for Rocket Configuration (connects to RocketBuilder concepts)
 */
const rocketConfigSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    massKg: {
      type: Type.NUMBER,
      description: "Total rocket mass in kg. K-2: 1000-3000. 3-4: 2000-5000. 5: 3000-10000."
    },
    propellantMassKg: {
      type: Type.NUMBER,
      description: "Fuel mass in kg (should be 40-70% of total mass)."
    },
    name: {
      type: Type.STRING,
      description: "Fun name for the rocket (e.g., 'Explorer I', 'Star Hopper'). Optional.",
      nullable: true
    }
  },
  required: ["massKg", "propellantMassKg"]
};

/**
 * Schema for Thrust Options (student-selectable thrust range)
 */
const thrustOptionsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    minKN: {
      type: Type.NUMBER,
      description: "Minimum thrust in kN. Should be low enough that TWR < 1 (can't lift off)."
    },
    maxKN: {
      type: Type.NUMBER,
      description: "Maximum thrust in kN. Must give TWR of ~2.5 at max so orbit is achievable."
    },
    defaultKN: {
      type: Type.NUMBER,
      description: "Default thrust in kN. Should give TWR around 1.3 (may not orbit - learning opportunity)."
    },
    stepKN: {
      type: Type.NUMBER,
      description: "Slider step size in kN. 10-50 typical.",
      nullable: true
    }
  },
  required: ["minKN", "maxKN", "defaultKN"]
};

/**
 * Schema for Challenge Configuration
 */
const challengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: ["reach_altitude", "circularize", "rendezvous", "change_orbit", "reach_orbit"],
      description: "Type of orbital challenge. K-2: reach_altitude. 3-4: circularize, reach_orbit. 5: rendezvous, change_orbit."
    },
    targetAltitude: {
      type: Type.NUMBER,
      description: "Target altitude to reach (for reach_altitude challenges). 100-500 typical.",
      nullable: true
    },
    targetOrbit: orbitConfigSchema,
    maxBurns: {
      type: Type.NUMBER,
      description: "Maximum number of burns allowed. K-2: unlimited (null). 3-4: 5-10. 5: 3-5.",
      nullable: true
    },
    description: {
      type: Type.STRING,
      description: "Age-appropriate description of the challenge goal."
    },
    successMessage: {
      type: Type.STRING,
      description: "Congratulations message when challenge is completed."
    }
  },
  required: ["type", "description", "successMessage"]
};

/**
 * Schema for Orbit Mechanics Lab Data
 */
const orbitMechanicsLabSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the orbital mechanics activity (e.g., 'Rocket to Orbit!', 'Orbit Designer')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will explore. Use age-appropriate language."
    },
    gradeLevel: {
      type: Type.STRING,
      enum: ["K", "1", "2", "3", "4", "5"],
      description: "Target grade level for content"
    },
    centralBody: {
      type: Type.STRING,
      enum: ["earth", "moon", "mars", "sun"],
      description: "Central body to orbit around. K-2: earth (familiar). 3-4: earth, moon. 5: earth, mars, moon."
    },
    centralBodyRadius: {
      type: Type.NUMBER,
      description: "Visual radius of central body in pixels. 30-50 typical. Larger for younger grades."
    },
    rocket: {
      ...rocketConfigSchema,
      description: "Rocket configuration with mass and propellant. Connects to RocketBuilder concepts."
    },
    thrustOptions: {
      ...thrustOptionsSchema,
      description: "Thrust range for student selection. Must allow TWR < 1 at min and TWR > 1.5 at max."
    },
    showTWR: {
      type: Type.BOOLEAN,
      description: "Display thrust-to-weight ratio. K-1: false. 2+: true."
    },
    showFuelGauge: {
      type: Type.BOOLEAN,
      description: "Display remaining propellant. K-1: false. 2+: true."
    },
    initialOrbit: {
      ...orbitConfigSchema,
      description: "Initial orbit configuration (if spacecraft starts in orbit). Null for launch challenges.",
      nullable: true
    },
    targetOrbit: {
      ...orbitConfigSchema,
      description: "Target orbit to achieve (for orbit change challenges). Optional.",
      nullable: true
    },
    showOrbitPath: {
      type: Type.BOOLEAN,
      description: "Display projected orbital trajectory. True for all grades."
    },
    showVelocityVector: {
      type: Type.BOOLEAN,
      description: "Display velocity arrow. K-1: false. 2+: true."
    },
    showApogeePerigee: {
      type: Type.BOOLEAN,
      description: "Mark highest and lowest points. K-1: false. 2+: true."
    },
    showOrbitalPeriod: {
      type: Type.BOOLEAN,
      description: "Display time per orbit. K-3: false. 4-5: true."
    },
    gravityVisualization: {
      type: Type.STRING,
      enum: ["none", "field_lines", "well"],
      description: "How to show gravity. K-1: none. 2-3: field_lines. 4-5: field_lines or well."
    },
    allowLaunch: {
      type: Type.BOOLEAN,
      description: "Student can launch spacecraft. True for most activities."
    },
    allowBurns: {
      type: Type.BOOLEAN,
      description: "Student can add velocity during orbit. K-2: false. 3+: true."
    },
    burnMode: {
      type: Type.STRING,
      enum: ["direction_picker", "prograde_retrograde", "manual"],
      description: "How burns work. 3: direction_picker. 4: prograde_retrograde. 5: manual."
    },
    challenge: {
      ...challengeSchema,
      description: "Optional challenge for goal-oriented learning.",
      nullable: true
    },
    hints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Array of helpful hints for students. Include 2-4 age-appropriate hints."
    },
    funFact: {
      type: Type.STRING,
      description: "Fun fact about orbital mechanics appropriate for grade level.",
      nullable: true
    }
  },
  required: ["title", "description", "gradeLevel", "centralBody", "centralBodyRadius", "rocket", "thrustOptions", "showOrbitPath", "showVelocityVector", "showApogeePerigee", "showOrbitalPeriod", "showTWR", "showFuelGauge", "gravityVisualization", "allowLaunch", "allowBurns", "burnMode", "hints"]
};

/**
 * Generate Orbit Mechanics Lab data for visualization
 *
 * Creates interactive orbital mechanics simulations appropriate for K-5 astronomy education:
 * - K: Things can go around and around (simple circular paths)
 * - 1: Satellites don't fall because they're fast
 * - 2: Different orbits—high, low, around equator
 * - 3: Orbit shape depends on speed
 * - 4: Changing orbits with burns
 * - 5: Hohmann transfers, orbital rendezvous
 *
 * @param topic - The astronomy topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns OrbitMechanicsLabData with complete configuration
 */
export const generateOrbitMechanicsLab = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<OrbitMechanicsLabData>
): Promise<OrbitMechanicsLabData> => {
  const prompt = `
Create an educational Orbit Mechanics Lab visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - ORBITAL MECHANICS FOR K-5:
The Orbit Mechanics Lab is an interactive orbital mechanics sandbox where students learn:
1. Orbiting is falling while moving sideways
2. Speed determines if you crash, orbit, or escape
3. Orbit shape (circular vs elliptical) depends on velocity
4. Burns (adding velocity) change your orbit
5. Prograde burns raise your orbit, retrograde burns lower it
6. Hohmann transfers efficiently move between orbits

KEY ORBITAL CONCEPTS (age-appropriate explanations):

KINDERGARTEN (ages 5-6):
"Things go around and around like a merry-go-round in space!"
- Focus: Circular motion, things orbiting
- No math, no orbital mechanics vocabulary
- Language: "The rocket goes around and around the Earth!"
- Challenge: None or just "Watch the rocket go around!"
- Features: showOrbitPath: true, everything else: false/none
- Hints: "Press launch and watch it go around!", "The rocket doesn't fall because it's going sideways too!"

GRADE 1 (ages 6-7):
"Satellites don't fall because they're moving so fast sideways!"
- Focus: Why things orbit (falling + sideways = orbit)
- Introduce speed concept: too slow = crash, just right = orbit
- Language: "Go too slow and you fall! Go just right and you orbit!"
- Challenge: reach_altitude (simple - just get into orbit)
- Features: showOrbitPath: true, allowLaunch: true
- Hints: "Try different speeds!", "Not too slow, not too fast!"

GRADE 2 (ages 7-8):
"Different orbits: some are high, some are low, some are round, some are stretched!"
- Focus: Orbit height and shape variety
- Introduce high/low orbits, circular vs "stretched" (elliptical)
- Language: "Higher orbits take longer to go around!"
- Challenge: reach_altitude with specific height target
- Features: + showVelocityVector: true, showApogeePerigee: true
- Hints: "Go faster to reach higher!", "Watch the highest and lowest points!"

GRADE 3 (ages 8-9):
"The speed you launch at decides your orbit shape!"
- Focus: Speed-orbit relationship, elliptical orbits
- Introduce eccentricity concept (stretched circles)
- Language: "Launch faster for a taller orbit, slower for a rounder one"
- Challenge: circularize (make orbit round)
- Features: + gravityVisualization: "field_lines", allowBurns: true (direction_picker)
- Hints: "Gravity always pulls toward the center", "Try to make a perfect circle!"

GRADE 4 (ages 9-10):
"Thrust your rocket to change orbits! Prograde speeds up, retrograde slows down!"
- Focus: Orbital maneuvers, burns
- Introduce prograde/retrograde vocabulary
- Language: "Speed up to go higher, slow down to go lower"
- Challenge: change_orbit with specific target
- Features: + burnMode: "prograde_retrograde", showOrbitalPeriod: true
- Hints: "Burn prograde at the lowest point to raise your orbit", "Retrograde burns make you fall closer"

GRADE 5 (ages 10-11):
"Hohmann transfers: the efficient way to change orbits!"
- Focus: Efficient orbital transfers, rendezvous
- Introduce delta-v budgets, Hohmann transfers
- Language: "Two burns get you to any orbit efficiently"
- Challenge: rendezvous or change_orbit with burn limit
- Features: All features enabled, maxBurns constraint
- Hints: "Burn at periapsis to raise apoapsis", "A Hohmann transfer uses two burns"

ROCKET CONFIGURATION (connects to RocketBuilder):
Students select thrust, LLM provides rocket mass. TWR = Thrust / (Mass * 9.81).
- TWR < 1.0: Rocket can't lift off (too heavy)
- TWR > 1.0: Rocket can lift off
- TWR 1.2-1.5: Good for learning
- TWR > 2.0: Very powerful, reaches space quickly

ROCKET & THRUST BY GRADE:
Students need enough max thrust to overcome gravity losses and achieve orbit.
Max TWR ~2.5 gives design space; default TWR ~1.3 may not orbit (learning opportunity).

K-1: Simple rocket, limited thrust options
  rocket: { massKg: 2000, propellantMassKg: 1200, name: "Star Hopper" }
  thrustOptions: { minKN: 14, maxKN: 49, defaultKN: 26, stepKN: 5 }
  (At 2000 kg: minTWR=0.71, maxTWR=2.50, defaultTWR=1.33)

Grade 2-3: Medium rocket, wider thrust range
  rocket: { massKg: 3000, propellantMassKg: 1800, name: "Explorer I" }
  thrustOptions: { minKN: 21, maxKN: 74, defaultKN: 38, stepKN: 5 }
  (At 3000 kg: minTWR=0.71, maxTWR=2.51, defaultTWR=1.29)

Grade 4-5: Larger rocket, more control
  rocket: { massKg: 5000, propellantMassKg: 3000, name: "Orbit Master" }
  thrustOptions: { minKN: 34, maxKN: 123, defaultKN: 64, stepKN: 5 }
  (At 5000 kg: minTWR=0.69, maxTWR=2.51, defaultTWR=1.31)

CONFIGURATION BY GRADE:

KINDERGARTEN:
{
  centralBody: "earth",
  centralBodyRadius: 50,
  rocket: { massKg: 2000, propellantMassKg: 1200, name: "Star Hopper" },
  thrustOptions: { minKN: 14, maxKN: 49, defaultKN: 26, stepKN: 5 },
  showOrbitPath: true,
  showVelocityVector: false,
  showApogeePerigee: false,
  showOrbitalPeriod: false,
  showTWR: false,
  showFuelGauge: false,
  gravityVisualization: "none",
  allowLaunch: true,
  allowBurns: false,
  burnMode: "direction_picker",
  challenge: null (or simple watch challenge)
}

GRADE 1:
{
  centralBody: "earth",
  centralBodyRadius: 45,
  rocket: { massKg: 2000, propellantMassKg: 1200, name: "Sky Jumper" },
  thrustOptions: { minKN: 14, maxKN: 49, defaultKN: 26, stepKN: 5 },
  showOrbitPath: true,
  showVelocityVector: false,
  showApogeePerigee: false,
  showOrbitalPeriod: false,
  showTWR: false,
  showFuelGauge: false,
  gravityVisualization: "none",
  allowLaunch: true,
  allowBurns: false,
  burnMode: "direction_picker",
  challenge: { type: "reach_altitude", targetAltitude: 150, description: "Launch your rocket into space!" }
}

GRADE 2:
{
  centralBody: "earth",
  centralBodyRadius: 40,
  rocket: { massKg: 2500, propellantMassKg: 1500, name: "Explorer I" },
  thrustOptions: { minKN: 17, maxKN: 61, defaultKN: 32, stepKN: 3 },
  showOrbitPath: true,
  showVelocityVector: true,
  showApogeePerigee: true,
  showOrbitalPeriod: false,
  showTWR: true,
  showFuelGauge: true,
  gravityVisualization: "none",
  allowLaunch: true,
  allowBurns: false,
  burnMode: "direction_picker",
  challenge: { type: "reach_altitude", targetAltitude: 200, description: "Reach 200 km altitude!" }
}

GRADE 3:
{
  centralBody: "earth",
  centralBodyRadius: 35,
  rocket: { massKg: 3000, propellantMassKg: 1800, name: "Orbit Seeker" },
  thrustOptions: { minKN: 21, maxKN: 74, defaultKN: 38, stepKN: 5 },
  showOrbitPath: true,
  showVelocityVector: true,
  showApogeePerigee: true,
  showOrbitalPeriod: false,
  showTWR: true,
  showFuelGauge: true,
  gravityVisualization: "field_lines",
  allowLaunch: true,
  allowBurns: true,
  burnMode: "direction_picker",
  challenge: { type: "reach_orbit", description: "Get into a stable orbit around Earth!" }
}

GRADE 4:
{
  centralBody: "earth" or "moon",
  centralBodyRadius: 35,
  rocket: { massKg: 4000, propellantMassKg: 2400, name: "Orbit Changer" },
  thrustOptions: { minKN: 27, maxKN: 98, defaultKN: 51, stepKN: 5 },
  showOrbitPath: true,
  showVelocityVector: true,
  showApogeePerigee: true,
  showOrbitalPeriod: true,
  showTWR: true,
  showFuelGauge: true,
  gravityVisualization: "field_lines",
  allowLaunch: true,
  allowBurns: true,
  burnMode: "prograde_retrograde",
  challenge: { type: "change_orbit", targetOrbit: {...}, maxBurns: 5 }
}

GRADE 5:
{
  centralBody: "earth", "moon", or "mars",
  centralBodyRadius: 30,
  rocket: { massKg: 5000, propellantMassKg: 3000, name: "Orbit Master" },
  thrustOptions: { minKN: 34, maxKN: 123, defaultKN: 64, stepKN: 5 },
  showOrbitPath: true,
  showVelocityVector: true,
  showApogeePerigee: true,
  showOrbitalPeriod: true,
  showTWR: true,
  showFuelGauge: true,
  gravityVisualization: "field_lines" or "well",
  allowLaunch: true,
  allowBurns: true,
  burnMode: "prograde_retrograde" or "manual",
  challenge: { type: "rendezvous" or "change_orbit", maxBurns: 3-5 }
}

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.centralBody ? `- Central body: ${config.centralBody}` : ''}
${config.showOrbitPath !== undefined ? `- Show orbit path: ${config.showOrbitPath}` : ''}
${config.allowBurns !== undefined ? `- Allow burns: ${config.allowBurns}` : ''}
${config.burnMode ? `- Burn mode: ${config.burnMode}` : ''}
${config.challenge ? `- Challenge type: ${config.challenge.type}` : ''}
` : ''}

HINT EXAMPLES BY GRADE:

K: ["Press the big Launch button!", "Watch your rocket fly around Earth!"]
1: ["Try different speeds with the slider!", "Too slow means crash, just right means orbit!"]
2: ["The green arrow shows which way you're going", "High point and low point - can you spot them?"]
3: ["Gravity pulls everything toward the center", "Round orbits are called circular!", "Stretched orbits are called elliptical!"]
4: ["Burn prograde (forward) to go higher", "Burn retrograde (backward) to go lower", "Time your burns at the lowest point!"]
5: ["Hohmann transfer: burn at periapsis, wait half an orbit, burn again!", "delta-v is how much speed you can change", "Save fuel by timing your burns perfectly!"]

FUN FACTS BY GRADE:

K: "The Moon is always orbiting around Earth, just like your rocket!"
1: "The International Space Station goes around Earth 16 times every day!"
2: "GPS satellites orbit 20,000 km above Earth - that's really high!"
3: "Planets orbit the Sun in elliptical (stretched) orbits, not perfect circles!"
4: "Astronauts on the ISS feel weightless because they're constantly falling around Earth!"
5: "To reach Mars, spacecraft use a Hohmann transfer orbit that takes about 9 months!"

Return a complete Orbit Mechanics Lab configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: orbitMechanicsLabSchema
    },
  });

  console.log('[Orbit Mechanics Lab] Gemini API Response:', {
    hasText: !!result.text,
    textType: typeof result.text,
    textLength: result.text?.length,
    textPreview: result.text?.substring(0, 200),
  });

  let data;
  try {
    if (!result.text) {
      throw new Error('No text property in Gemini response');
    }

    data = JSON.parse(result.text);
  } catch (parseError) {
    console.error('[Orbit Mechanics Lab] Parse Error:', parseError);
    throw new Error(`Failed to parse Gemini response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }

  if (!data) {
    throw new Error('No valid Orbit Mechanics Lab data returned from Gemini API');
  }

  // Validation and defaults
  if (!data.centralBody) data.centralBody = 'earth';
  if (!data.centralBodyRadius || data.centralBodyRadius < 20) data.centralBodyRadius = 35;

  // Rocket configuration defaults (by grade level)
  if (!data.rocket || !data.rocket.massKg) {
    data.rocket = getDefaultRocketConfig(gradeLevel);
  }
  if (!data.thrustOptions || !data.thrustOptions.minKN) {
    data.thrustOptions = getDefaultThrustOptions(gradeLevel, data.rocket.massKg);
  }

  // Display options
  if (data.showOrbitPath === undefined) data.showOrbitPath = true;
  if (data.showVelocityVector === undefined) data.showVelocityVector = gradeLevel !== 'K' && gradeLevel !== '1';
  if (data.showApogeePerigee === undefined) data.showApogeePerigee = gradeLevel !== 'K' && gradeLevel !== '1';
  if (data.showOrbitalPeriod === undefined) data.showOrbitalPeriod = gradeLevel === '4' || gradeLevel === '5';
  if (data.showTWR === undefined) data.showTWR = gradeLevel !== 'K' && gradeLevel !== '1';
  if (data.showFuelGauge === undefined) data.showFuelGauge = gradeLevel !== 'K' && gradeLevel !== '1';
  if (!data.gravityVisualization) data.gravityVisualization = gradeLevel >= '3' ? 'field_lines' : 'none';
  if (data.allowLaunch === undefined) data.allowLaunch = true;
  if (data.allowBurns === undefined) data.allowBurns = gradeLevel >= '3';
  if (!data.burnMode) data.burnMode = gradeLevel === '5' ? 'prograde_retrograde' : 'direction_picker';
  if (!data.hints || data.hints.length === 0) {
    data.hints = getDefaultHints(gradeLevel);
  }

  // Apply config overrides
  if (config) {
    if (config.centralBody) data.centralBody = config.centralBody;
    if (config.centralBodyRadius) data.centralBodyRadius = config.centralBodyRadius;
    if (config.rocket) data.rocket = { ...data.rocket, ...config.rocket };
    if (config.thrustOptions) data.thrustOptions = { ...data.thrustOptions, ...config.thrustOptions };
    if (config.initialOrbit) data.initialOrbit = config.initialOrbit;
    if (config.targetOrbit) data.targetOrbit = config.targetOrbit;
    if (config.showOrbitPath !== undefined) data.showOrbitPath = config.showOrbitPath;
    if (config.showVelocityVector !== undefined) data.showVelocityVector = config.showVelocityVector;
    if (config.showApogeePerigee !== undefined) data.showApogeePerigee = config.showApogeePerigee;
    if (config.showOrbitalPeriod !== undefined) data.showOrbitalPeriod = config.showOrbitalPeriod;
    if (config.showTWR !== undefined) data.showTWR = config.showTWR;
    if (config.showFuelGauge !== undefined) data.showFuelGauge = config.showFuelGauge;
    if (config.gravityVisualization) data.gravityVisualization = config.gravityVisualization;
    if (config.allowLaunch !== undefined) data.allowLaunch = config.allowLaunch;
    if (config.allowBurns !== undefined) data.allowBurns = config.allowBurns;
    if (config.burnMode) data.burnMode = config.burnMode;
    if (config.challenge) data.challenge = config.challenge;
    if (config.hints) data.hints = config.hints;
    if (config.funFact) data.funFact = config.funFact;
  }

  return data;
};

/**
 * Helper: Get default hints based on grade level
 */
function getDefaultHints(gradeLevel: string): string[] {
  const hintsByGrade: Record<string, string[]> = {
    'K': [
      "Press the big Launch button!",
      "Watch your rocket fly around Earth!",
      "See how it goes around and around!"
    ],
    '1': [
      "Try different speeds with the slider!",
      "Too slow and you'll crash, just right and you orbit!",
      "The rocket falls toward Earth but keeps missing it!"
    ],
    '2': [
      "The green arrow shows which way you're moving",
      "Look for the highest point and lowest point!",
      "Go faster to reach higher up!"
    ],
    '3': [
      "Gravity always pulls toward the center",
      "Round orbits are called circular!",
      "Stretched orbits are called elliptical!",
      "Use burns to change your orbit shape!"
    ],
    '4': [
      "Burn prograde (forward) to raise your orbit!",
      "Burn retrograde (backward) to lower your orbit!",
      "Time your burns at the lowest point for best results!",
      "Watch how your apogee and perigee change with burns!"
    ],
    '5': [
      "A Hohmann transfer uses two burns to change orbits efficiently!",
      "Burn at periapsis to raise your apoapsis!",
      "Burn at apoapsis to raise your periapsis!",
      "Minimize fuel by planning your burns carefully!"
    ]
  };

  return hintsByGrade[gradeLevel] || hintsByGrade['3'];
}

/**
 * Helper: Get default rocket configuration based on grade level
 * Rocket mass increases with grade to provide more complex scenarios
 */
function getDefaultRocketConfig(gradeLevel: string): RocketConfig {
  const rocketsByGrade: Record<string, RocketConfig> = {
    'K': { massKg: 2000, propellantMassKg: 1200, name: 'Star Hopper' },
    '1': { massKg: 2000, propellantMassKg: 1200, name: 'Sky Jumper' },
    '2': { massKg: 2500, propellantMassKg: 1500, name: 'Explorer I' },
    '3': { massKg: 3000, propellantMassKg: 1800, name: 'Orbit Seeker' },
    '4': { massKg: 4000, propellantMassKg: 2400, name: 'Orbit Changer' },
    '5': { massKg: 5000, propellantMassKg: 3000, name: 'Orbit Master' },
  };

  return rocketsByGrade[gradeLevel] || rocketsByGrade['3'];
}

/**
 * Helper: Get default thrust options based on grade level and rocket mass
 * Calculates min/max/default thrust to provide appropriate TWR range
 * TWR = Thrust (N) / (Mass (kg) * 9.81)
 * We want: minTWR < 1.0 (can't lift), defaultTWR ~1.2-1.3, maxTWR ~1.6-1.8
 */
function getDefaultThrustOptions(gradeLevel: string, massKg: number): ThrustConfig {
  const gravity = 9.81;
  const weightKN = (massKg * gravity) / 1000; // Weight in kN

  // Calculate thrust values for desired TWR ranges
  // Higher max TWR gives students design space to overcome gravity losses and achieve orbit
  const minTWR = 0.7;   // Can't lift off
  const defaultTWR = 1.3; // Good starting point, may not orbit (learning opportunity)
  const maxTWR = 2.5;   // Enough to overcome gravity losses and reach stable orbit

  const minKN = Math.round(weightKN * minTWR);
  const defaultKN = Math.round(weightKN * defaultTWR);
  const maxKN = Math.round(weightKN * maxTWR);

  // Step size based on grade (smaller steps for older grades = more precision)
  const stepByGrade: Record<string, number> = {
    'K': 5, '1': 5, '2': 3, '3': 5, '4': 5, '5': 5
  };

  return {
    minKN,
    maxKN,
    defaultKN,
    stepKN: stepByGrade[gradeLevel] || 5
  };
}
