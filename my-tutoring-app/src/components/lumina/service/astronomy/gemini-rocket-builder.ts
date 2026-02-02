import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  RocketBuilderData,
  RocketComponent,
} from '../../primitives/visual-primitives/astronomy/RocketBuilder';

// Re-export for convenience if needed elsewhere
export type { RocketBuilderData, RocketComponent };

/**
 * Schema for Rocket Component
 */
const rocketComponentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique identifier (lowercase, hyphenated). E.g., 'capsule-small', 'fuel-tank-medium', 'engine-large'"
    },
    name: {
      type: Type.STRING,
      description: "Display name of the component. E.g., 'Small Capsule', 'Medium Fuel Tank', 'Powerful Engine'"
    },
    type: {
      type: Type.STRING,
      enum: ["capsule", "fuel_tank", "engine", "booster", "fins", "fairing", "payload"],
      description: "Type of rocket component. capsule: crew/payload compartment, fuel_tank: holds propellant, engine: provides thrust, booster: solid rocket booster, fins: stability, fairing: aerodynamic cover, payload: satellite/cargo"
    },
    massKg: {
      type: Type.INTEGER,
      description: "Mass in kilograms as a whole number (dry mass for fuel tanks, total mass for others)"
    },
    thrustKN: {
      type: Type.INTEGER,
      description: "Thrust in kilonewtons as a whole number (only for engines and boosters)",
      nullable: true
    },
    specificImpulse: {
      type: Type.INTEGER,
      description: "Specific impulse in seconds as a whole number - engine efficiency (higher = more efficient). Typical values: 250-350 for simple engines, 350-450 for efficient engines",
      nullable: true
    },
    burnTimeSeconds: {
      type: Type.INTEGER,
      description: "How long the engine/booster burns in seconds as a whole number",
      nullable: true
    },
    propellantMassKg: {
      type: Type.INTEGER,
      description: "Mass of fuel/propellant in kilograms as a whole number (only for fuel tanks)",
      nullable: true
    },
    widthUnits: {
      type: Type.INTEGER,
      description: "Visual width in units (1-4). 2 is standard rocket width."
    },
    heightUnits: {
      type: Type.INTEGER,
      description: "Visual height in units (1-5). Affects stacking appearance."
    },
    color: {
      type: Type.STRING,
      description: "Hex color code for the component. Capsules: #E74C3C (red), Fuel tanks: #3498DB (blue), Engines: #F39C12 (orange), Boosters: #E67E22 (dark orange), Fins: #95A5A6 (gray), Fairings: #BDC3C7 (light gray), Payloads: #9B59B6 (purple)"
    },
    description: {
      type: Type.STRING,
      description: "Age-appropriate description of the component (1-2 sentences)"
    },
    cost: {
      type: Type.INTEGER,
      description: "Optional cost for budget constraints as a whole number. K-2: no cost, 3-5: include cost for budgeting challenge",
      nullable: true
    }
  },
  required: ["id", "name", "type", "massKg", "widthUnits", "heightUnits", "color", "description"]
};

/**
 * Schema for Rocket Builder Data
 */
const rocketBuilderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the rocket building activity (e.g., 'Build Your Own Rocket!', 'Space Launch Challenge')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining the activity. Use age-appropriate language."
    },
    availableComponents: {
      type: Type.ARRAY,
      items: rocketComponentSchema,
      description: "Array of components available for building. K-2: 5-8 simple components. 3-5: 10-15 components with varied stats."
    },
    maxStages: {
      type: Type.INTEGER,
      description: "Maximum number of stages allowed. K-1: 1-2 stages, 2-3: 2-3 stages, 4-5: 3-5 stages"
    },
    targetAltitudeKm: {
      type: Type.INTEGER,
      description: "Goal altitude in kilometers as a whole number. K: 10-20, 1: 20-50, 2: 50-100, 3: 100 (space!), 4: 150-200, 5: 200+ (orbit)"
    },
    targetOrbit: {
      type: Type.BOOLEAN,
      description: "Whether the mission requires reaching stable orbit. K-4: false, 5: can be true for advanced challenges"
    },
    showTWR: {
      type: Type.BOOLEAN,
      description: "Show thrust-to-weight ratio indicator. K-1: false (too complex), 2-5: true"
    },
    showFuelGauge: {
      type: Type.BOOLEAN,
      description: "Show remaining fuel indicator. K: false, 1-5: true"
    },
    showForces: {
      type: Type.BOOLEAN,
      description: "Show force vectors (thrust, drag, gravity). K-2: false, 3-5: true"
    },
    atmosphereModel: {
      type: Type.STRING,
      enum: ["simple", "realistic"],
      description: "Atmosphere simulation complexity. K-3: simple, 4-5: realistic for discussing drag"
    },
    guidedMode: {
      type: Type.BOOLEAN,
      description: "Enable hints and suggestions. K-2: true, 3-5: optional based on difficulty"
    },
    budget: {
      type: Type.INTEGER,
      description: "Optional cost constraint as a whole number. K-2: null (no budget), 3-5: include budget for resource management",
      nullable: true
    },
    simulationSpeed: {
      type: Type.INTEGER,
      description: "Time compression for launch animation as a whole number. 1 = realtime, 10-100 = faster. K-2: 50-100 (fast, engaging), 3-5: 20-50 (observable)"
    },
    gradeLevel: {
      type: Type.STRING,
      enum: ["K", "1", "2", "3", "4", "5"],
      description: "Target grade level for content"
    },
    learningFocus: {
      type: Type.STRING,
      description: "The main learning objective for this grade level (2-3 sentences explaining what students should discover)"
    },
    hints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Array of progressive hints appropriate for the grade level (3-5 hints)"
    }
  },
  required: ["title", "description", "availableComponents", "maxStages", "targetAltitudeKm", "targetOrbit", "showTWR", "showFuelGauge", "showForces", "atmosphereModel", "guidedMode", "simulationSpeed", "gradeLevel", "learningFocus", "hints"]
};

/**
 * Generate Rocket Builder data for interactive spaceflight education
 *
 * Creates comprehensive rocket design and simulation configurations appropriate for K-5:
 * - K: Rockets go up, have parts (capsule, engine, fuel)
 * - 1: Engines push, fuel gets used up
 * - 2: Heavier rockets need more thrust
 * - 3: Staging—dropping empty parts helps
 * - 4: Thrust-to-weight ratio, fuel efficiency
 * - 5: Delta-v budgets, orbit insertion
 *
 * @param topic - The spaceflight topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns RocketBuilderData with complete configuration
 */
export const generateRocketBuilder = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<RocketBuilderData>
): Promise<RocketBuilderData> => {
  const prompt = `
Create an educational Rocket Builder configuration for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - ROCKET BUILDER PRIMITIVE:
The Rocket Builder is a comprehensive rocket design and simulation tool where students:
1. SELECT rocket components from a library (capsules, fuel tanks, engines, boosters, fins, fairings, payloads)
2. STACK components to build multi-stage rockets
3. BALANCE thrust and weight to achieve liftoff
4. LAUNCH and watch the flight profile in real-time
5. ANALYZE results to understand why designs succeed or fail

KEY ROCKETRY CONCEPTS:
- Thrust-to-Weight Ratio (TWR): Must be > 1 to lift off. TWR = Thrust / (Mass × gravity)
- Staging: Dropping empty fuel tanks reduces mass, allowing rockets to go higher
- Delta-v: Total velocity change a rocket can achieve (determines if you can reach orbit)
- Specific Impulse (Isp): Engine efficiency - how much thrust per fuel burned
- Propellant Mass Fraction: Higher fuel ratio = more delta-v

GRADE-LEVEL LEARNING PROGRESSION:

KINDERGARTEN (ages 5-6):
- Focus: "Rockets go up! Rockets have parts!"
- Components: 3-5 very simple pieces (capsule, fuel tank, engine)
- Vocabulary: "rocket", "engine", "fuel", "push up"
- maxStages: 1 (keep it simple!)
- targetAltitudeKm: 10-20 (easy to achieve)
- showTWR: false (too abstract)
- showFuelGauge: false
- showForces: false
- atmosphereModel: 'simple'
- guidedMode: true (lots of help!)
- budget: null (no cost complexity)
- Description: "Let's build a rocket! Put an engine on the bottom to push it up, add some fuel, and a capsule on top!"
- Hints: "Every rocket needs an engine!", "Fuel makes the engine work!", "The capsule goes on top!"

GRADE 1 (ages 6-7):
- Focus: "Engines push! Fuel gets used up!"
- Components: 5-7 pieces with size variation
- Vocabulary: "thrust", "propellant", "launch"
- maxStages: 1-2
- targetAltitudeKm: 20-50
- showTWR: false
- showFuelGauge: true (watch fuel run out!)
- showForces: false
- atmosphereModel: 'simple'
- guidedMode: true
- budget: null
- Description: "Build a rocket that can reach the clouds! Watch how the engine uses up fuel to push the rocket higher."
- Hints: "Bigger engines push harder!", "More fuel = fly longer!", "Watch the fuel gauge as you launch!"

GRADE 2 (ages 7-8):
- Focus: "Heavier rockets need more thrust!"
- Components: 7-10 pieces with mass variation
- Vocabulary: "mass", "heavy", "light", "balance"
- maxStages: 2
- targetAltitudeKm: 50-100 (reaching toward space!)
- showTWR: true (introduce the concept)
- showFuelGauge: true
- showForces: false
- atmosphereModel: 'simple'
- guidedMode: true
- budget: null
- Description: "Design a rocket powerful enough to reach the edge of space! Remember: heavier rockets need stronger engines."
- Hints: "Check your thrust-to-weight - it needs to be above 1!", "Adding more fuel makes it heavier!", "Try a bigger engine if you can't lift off!"

GRADE 3 (ages 8-9):
- Focus: "Staging - dropping empty parts helps!"
- Components: 10-12 pieces including staging options
- Vocabulary: "stage", "separation", "efficiency"
- maxStages: 2-3
- targetAltitudeKm: 100 (space! The Karman line!)
- showTWR: true
- showFuelGauge: true
- showForces: true (show thrust arrow)
- atmosphereModel: 'simple'
- guidedMode: true
- budget: (optional) $5000-10000
- Description: "Reach space (100 km)! Use staging - when a fuel tank is empty, drop it! The rocket gets lighter and can go higher."
- Hints: "Empty tanks are dead weight - drop them!", "Put your biggest stage at the bottom", "Watch for staging events in the flight!"

GRADE 4 (ages 9-10):
- Focus: "Thrust-to-weight ratio and fuel efficiency"
- Components: 12-15 pieces with efficiency stats (Isp)
- Vocabulary: "ratio", "efficiency", "Isp", "specific impulse"
- maxStages: 3-4
- targetAltitudeKm: 150-200
- showTWR: true
- showFuelGauge: true
- showForces: true
- atmosphereModel: 'realistic' (introduce drag concept)
- guidedMode: optional (can turn off for challenge)
- budget: $10000-20000
- Description: "Design an efficient rocket! Balance powerful engines (high thrust) with efficient engines (high Isp). Can you reach 200 km under budget?"
- Hints: "High Isp engines are more fuel-efficient", "TWR > 1.2 is good for a strong launch", "Drag slows you down in atmosphere - go fast early!"

GRADE 5 (ages 10-11):
- Focus: "Delta-v budgets and orbit insertion"
- Components: 15+ pieces with full stats
- Vocabulary: "delta-v", "orbit", "orbital velocity", "payload"
- maxStages: 3-5
- targetAltitudeKm: 200+ (Low Earth Orbit)
- targetOrbit: true (must achieve stable orbit!)
- showTWR: true
- showFuelGauge: true
- showForces: true
- atmosphereModel: 'realistic'
- guidedMode: false (challenge mode)
- budget: $15000-30000
- Description: "Launch a satellite into orbit! You need enough delta-v to reach 200 km AND achieve orbital velocity (~7.8 km/s). Design smart - every kilogram counts!"
- Hints: "Orbit requires ~9 km/s delta-v from ground", "High TWR first stage punches through atmosphere", "High Isp upper stages are more efficient in vacuum", "Lighter payload = easier mission"

COMPONENT LIBRARY REFERENCE:
Return components appropriate for the grade level. Here are example stats:

CAPSULES:
| ID | Name | Mass | Width | Height | Cost | Notes |
|----|------|------|-------|--------|------|-------|
| capsule-tiny | Tiny Capsule | 300 kg | 1 | 1 | $500 | Smallest capsule |
| capsule-small | Small Capsule | 500 kg | 2 | 2 | $1000 | 1 crew |
| capsule-medium | Medium Capsule | 2000 kg | 2 | 3 | $3000 | 3 crew |

FUEL TANKS:
| ID | Name | Mass (dry) | Propellant | Width | Height | Cost |
|----|------|-----------|------------|-------|--------|------|
| fuel-tiny | Tiny Tank | 50 kg | 500 kg | 2 | 1 | $200 |
| fuel-small | Small Tank | 100 kg | 1000 kg | 2 | 2 | $500 |
| fuel-medium | Medium Tank | 500 kg | 5000 kg | 2 | 3 | $1500 |
| fuel-large | Large Tank | 2000 kg | 20000 kg | 2 | 4 | $4000 |

ENGINES:
| ID | Name | Mass | Thrust | Isp | Burn Time | Width | Height | Cost |
|----|------|------|--------|-----|-----------|-------|--------|------|
| engine-small | Small Engine | 200 kg | 50 kN | 280 | 120s | 2 | 1 | $800 |
| engine-medium | Medium Engine | 500 kg | 200 kN | 310 | 180s | 2 | 2 | $2000 |
| engine-large | Large Engine | 1500 kg | 1000 kN | 350 | 240s | 2 | 2 | $5000 |
| engine-efficient | Efficient Engine | 400 kg | 100 kN | 420 | 300s | 2 | 2 | $3500 |

SOLID BOOSTERS:
| ID | Name | Mass | Thrust | Burn Time | Width | Height | Cost |
|----|------|------|--------|-----------|-------|--------|------|
| booster-small | Small Booster | 1000 kg | 300 kN | 60s | 1 | 3 | $600 |
| booster-large | Large Booster | 5000 kg | 1500 kN | 90s | 1 | 4 | $2000 |

ACCESSORIES:
| ID | Name | Mass | Width | Height | Cost | Effect |
|----|------|------|-------|--------|------|--------|
| fins | Stability Fins | 50 kg | 3 | 1 | $100 | Improves stability |
| fairing | Aerodynamic Fairing | 200 kg | 2 | 2 | $500 | Reduces drag |
| satellite | Small Satellite | 100 kg | 1 | 1 | $1000 | Payload |

COLOR PALETTE:
- Capsules: #E74C3C (red)
- Fuel Tanks: #3498DB (blue)
- Engines: #F39C12 (orange)
- Boosters: #E67E22 (dark orange)
- Fins: #95A5A6 (gray)
- Fairings: #BDC3C7 (light gray)
- Payloads: #9B59B6 (purple)

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.maxStages ? `- Max stages: ${config.maxStages}` : ''}
${config.targetAltitudeKm ? `- Target altitude: ${config.targetAltitudeKm} km` : ''}
${config.targetOrbit !== undefined ? `- Target orbit: ${config.targetOrbit}` : ''}
${config.budget ? `- Budget: $${config.budget}` : ''}
${config.guidedMode !== undefined ? `- Guided mode: ${config.guidedMode}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. availableComponents must include at least: 1 capsule, 1 fuel tank, 1 engine
2. Components must have valid mass, dimensions, and colors
3. Engine components must have thrustKN, specificImpulse, burnTimeSeconds
4. Fuel tank components must have propellantMassKg
5. For K-2: Keep component count low (5-8), no cost/budget
6. For 3-5: Include variety and cost for budget challenges
7. hints array must have 3-5 progressive hints appropriate for grade level
8. learningFocus must explain what students should discover (2-3 sentences)

Return a complete Rocket Builder configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: rocketBuilderSchema
    },
  });

  // Debug logging
  console.log('[Rocket Builder] Gemini API Response:', {
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

    console.log('[Rocket Builder] Raw text to parse:', result.text.substring(0, 500));

    data = JSON.parse(result.text);
  } catch (parseError) {
    console.error('[Rocket Builder] Parse Error Details:', {
      error: parseError instanceof Error ? parseError.message : String(parseError),
      textContent: result.text,
    });
    throw new Error(`Failed to parse Gemini response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }

  if (!data) {
    throw new Error('No valid Rocket Builder data returned from Gemini API');
  }

  // Validation: ensure components array exists and has required types
  if (!data.availableComponents || data.availableComponents.length === 0) {
    console.warn('No components provided. Setting default components.');
    data.availableComponents = getDefaultComponents(gradeLevel);
  }

  // Validate we have at least one of each required type
  const hasEngine = data.availableComponents.some((c: RocketComponent) => c.type === 'engine' || c.type === 'booster');
  const hasFuel = data.availableComponents.some((c: RocketComponent) => c.type === 'fuel_tank');
  const hasCapsule = data.availableComponents.some((c: RocketComponent) => c.type === 'capsule' || c.type === 'payload');

  if (!hasEngine || !hasFuel || !hasCapsule) {
    console.warn('Missing required component types. Adding defaults.');
    const defaults = getDefaultComponents(gradeLevel);
    if (!hasEngine) data.availableComponents.push(...defaults.filter((c: RocketComponent) => c.type === 'engine'));
    if (!hasFuel) data.availableComponents.push(...defaults.filter((c: RocketComponent) => c.type === 'fuel_tank'));
    if (!hasCapsule) data.availableComponents.push(...defaults.filter((c: RocketComponent) => c.type === 'capsule'));
  }

  // Validate hints
  if (!data.hints || data.hints.length === 0) {
    data.hints = getDefaultHints(gradeLevel);
  }

  // Validate learning focus
  if (!data.learningFocus) {
    data.learningFocus = getDefaultLearningFocus(gradeLevel);
  }

  // Apply config overrides
  if (config) {
    if (config.availableComponents) data.availableComponents = config.availableComponents;
    if (config.maxStages !== undefined) data.maxStages = config.maxStages;
    if (config.targetAltitudeKm !== undefined) data.targetAltitudeKm = config.targetAltitudeKm;
    if (config.targetOrbit !== undefined) data.targetOrbit = config.targetOrbit;
    if (config.showTWR !== undefined) data.showTWR = config.showTWR;
    if (config.showFuelGauge !== undefined) data.showFuelGauge = config.showFuelGauge;
    if (config.showForces !== undefined) data.showForces = config.showForces;
    if (config.atmosphereModel) data.atmosphereModel = config.atmosphereModel;
    if (config.guidedMode !== undefined) data.guidedMode = config.guidedMode;
    if (config.budget !== undefined) data.budget = config.budget;
    if (config.simulationSpeed !== undefined) data.simulationSpeed = config.simulationSpeed;
  }

  // Set sensible defaults
  if (data.maxStages === undefined) data.maxStages = 2;
  if (data.targetAltitudeKm === undefined) data.targetAltitudeKm = 100;
  if (data.simulationSpeed === undefined) data.simulationSpeed = 50;

  return data;
};

/**
 * Helper: Get default components based on grade level
 */
function getDefaultComponents(gradeLevel: string): RocketComponent[] {
  const basicComponents: RocketComponent[] = [
    {
      id: 'capsule-small',
      name: 'Small Capsule',
      type: 'capsule',
      massKg: 500,
      widthUnits: 2,
      heightUnits: 2,
      color: '#E74C3C',
      description: 'A small capsule for your astronauts!',
    },
    {
      id: 'fuel-small',
      name: 'Small Fuel Tank',
      type: 'fuel_tank',
      massKg: 100,
      propellantMassKg: 1000,
      widthUnits: 2,
      heightUnits: 2,
      color: '#3498DB',
      description: 'Holds fuel to power your engine.',
    },
    {
      id: 'fuel-medium',
      name: 'Medium Fuel Tank',
      type: 'fuel_tank',
      massKg: 500,
      propellantMassKg: 5000,
      widthUnits: 2,
      heightUnits: 3,
      color: '#3498DB',
      description: 'A bigger tank for longer flights!',
    },
    {
      id: 'engine-small',
      name: 'Small Engine',
      type: 'engine',
      massKg: 200,
      thrustKN: 50,
      specificImpulse: 280,
      burnTimeSeconds: 120,
      widthUnits: 2,
      heightUnits: 1,
      color: '#F39C12',
      description: 'A basic engine to get you started.',
    },
    {
      id: 'engine-medium',
      name: 'Medium Engine',
      type: 'engine',
      massKg: 500,
      thrustKN: 200,
      specificImpulse: 310,
      burnTimeSeconds: 180,
      widthUnits: 2,
      heightUnits: 2,
      color: '#F39C12',
      description: 'More power for heavier rockets!',
    },
  ];

  // Add cost for grades 3+
  if (['3', '4', '5'].includes(gradeLevel)) {
    basicComponents.forEach((c, i) => {
      c.cost = [1000, 500, 1500, 800, 2000][i];
    });

    // Add more advanced components
    basicComponents.push(
      {
        id: 'fuel-large',
        name: 'Large Fuel Tank',
        type: 'fuel_tank',
        massKg: 2000,
        propellantMassKg: 20000,
        widthUnits: 2,
        heightUnits: 4,
        color: '#3498DB',
        description: 'Massive fuel tank for long missions.',
        cost: 4000,
      },
      {
        id: 'engine-large',
        name: 'Large Engine',
        type: 'engine',
        massKg: 1500,
        thrustKN: 1000,
        specificImpulse: 350,
        burnTimeSeconds: 240,
        widthUnits: 2,
        heightUnits: 2,
        color: '#F39C12',
        description: 'Powerful engine for heavy lifters!',
        cost: 5000,
      },
      {
        id: 'fins',
        name: 'Stability Fins',
        type: 'fins',
        massKg: 50,
        widthUnits: 3,
        heightUnits: 1,
        color: '#95A5A6',
        description: 'Helps keep your rocket flying straight.',
        cost: 100,
      }
    );
  }

  return basicComponents;
}

/**
 * Helper: Get default hints based on grade level
 */
function getDefaultHints(gradeLevel: string): string[] {
  const hintsByGrade: Record<string, string[]> = {
    'K': [
      'Every rocket needs an engine at the bottom!',
      'Add some fuel so the engine can work!',
      'Put the capsule on top to carry astronauts!',
    ],
    '1': [
      'Bigger engines push harder!',
      'More fuel means you can fly longer!',
      'Watch the fuel gauge during launch!',
    ],
    '2': [
      'Check your thrust-to-weight ratio - it needs to be above 1!',
      'Adding more fuel makes your rocket heavier!',
      'Try a bigger engine if you can\'t lift off!',
    ],
    '3': [
      'Empty tanks are dead weight - use staging to drop them!',
      'Put your biggest, most powerful stage at the bottom!',
      'Watch for staging events in the flight profile!',
    ],
    '4': [
      'High Isp engines are more fuel-efficient but have less thrust.',
      'You need TWR > 1.2 for a strong launch.',
      'Drag slows you down in the atmosphere - punch through quickly!',
    ],
    '5': [
      'Reaching orbit requires about 9 km/s of delta-v.',
      'Use high TWR engines for your first stage (atmosphere).',
      'Use high Isp engines for upper stages (vacuum).',
      'Every kilogram of payload requires more fuel!',
    ],
  };

  return hintsByGrade[gradeLevel] || hintsByGrade['3'];
}

/**
 * Helper: Get default learning focus based on grade level
 */
function getDefaultLearningFocus(gradeLevel: string): string {
  const focusByGrade: Record<string, string> = {
    'K': 'Rockets have parts that work together! The engine pushes, the fuel gives it power, and the capsule carries astronauts.',
    '1': 'Engines need fuel to work. When the fuel runs out, the engine stops. More fuel = longer flight!',
    '2': 'Heavy rockets need more push (thrust) to lift off. If your rocket is too heavy, add a bigger engine!',
    '3': 'Staging is a clever trick! When a fuel tank is empty, drop it. Your rocket gets lighter and can go higher.',
    '4': 'Efficient engines use less fuel but push softer. Powerful engines push hard but use more fuel. Balance is key!',
    '5': 'Delta-v is the total "speed budget" your rocket has. You need ~9 km/s to reach orbit. Design efficiently!',
  };

  return focusByGrade[gradeLevel] || focusByGrade['3'];
}
