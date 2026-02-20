import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  VehicleDesignStudioData,
} from '../../primitives/visual-primitives/engineering/VehicleDesignStudio';

// Re-export for convenience if needed elsewhere
export type { VehicleDesignStudioData };

/**
 * Schema for VehicleBody
 */
const vehicleBodySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique identifier for the body (e.g., 'body-sedan', 'body-boat-hull')."
    },
    name: {
      type: Type.STRING,
      description: "Display name for the body (e.g., 'Sleek Sedan', 'Cargo Hull')."
    },
    weight: {
      type: Type.NUMBER,
      description: "Weight in kg. Range 50-500 depending on size. Lighter = faster but less capacity."
    },
    dragCoefficient: {
      type: Type.NUMBER,
      description: "Aerodynamic/hydrodynamic drag coefficient (0.1-1.0). Lower = less resistance."
    },
    capacity: {
      type: Type.NUMBER,
      description: "Cargo/passenger capacity (1-200). Larger bodies carry more."
    },
    cost: {
      type: Type.NUMBER,
      description: "Cost in dollars (100-5000). More advanced bodies cost more."
    },
    imagePrompt: {
      type: Type.STRING,
      description: "Short description of the body's appearance for visualization."
    }
  },
  required: ["id", "name", "weight", "dragCoefficient", "capacity", "cost", "imagePrompt"]
};

/**
 * Schema for VehiclePropulsion
 */
const vehiclePropulsionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique identifier for the propulsion (e.g., 'prop-electric-motor', 'prop-jet')."
    },
    name: {
      type: Type.STRING,
      description: "Display name (e.g., 'Electric Motor', 'Jet Engine')."
    },
    thrustOutput: {
      type: Type.NUMBER,
      description: "Thrust in Newtons (100-10000). Higher = faster acceleration."
    },
    fuelEfficiency: {
      type: Type.NUMBER,
      description: "Fuel efficiency rating (1-100). Higher = greater range."
    },
    weight: {
      type: Type.NUMBER,
      description: "Weight in kg (10-200). Heavier engines reduce speed."
    },
    cost: {
      type: Type.NUMBER,
      description: "Cost in dollars (50-3000)."
    },
    requires: {
      type: Type.STRING,
      enum: ["air", "ground", "water", "any"],
      description: "Medium this propulsion requires: 'air' for propellers/jets, 'ground' for wheels/treads, 'water' for propellers/jets, 'any' for universal."
    }
  },
  required: ["id", "name", "thrustOutput", "fuelEfficiency", "weight", "cost", "requires"]
};

/**
 * Schema for VehicleControl
 */
const vehicleControlSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique identifier (e.g., 'ctrl-fins', 'ctrl-gyroscope')."
    },
    name: {
      type: Type.STRING,
      description: "Display name (e.g., 'Stabilizer Fins', 'Gyroscope')."
    },
    stabilityBonus: {
      type: Type.NUMBER,
      description: "Stability bonus points (5-30). Higher = more stable."
    },
    dragPenalty: {
      type: Type.NUMBER,
      description: "Additional drag caused by this control (0.0-0.3). More surfaces = more drag."
    },
    weight: {
      type: Type.NUMBER,
      description: "Weight in kg (5-50)."
    },
    cost: {
      type: Type.NUMBER,
      description: "Cost in dollars (25-500)."
    }
  },
  required: ["id", "name", "stabilityBonus", "dragPenalty", "weight", "cost"]
};

/**
 * Schema for VehicleConstraints
 */
const vehicleConstraintsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    maxWeight: {
      type: Type.NUMBER,
      nullable: true,
      description: "Maximum allowed total weight in kg, or null for no limit."
    },
    maxCost: {
      type: Type.NUMBER,
      nullable: true,
      description: "Maximum allowed total cost in dollars, or null for no limit."
    },
    minRange: {
      type: Type.NUMBER,
      nullable: true,
      description: "Minimum required range, or null for no requirement."
    },
    minSpeed: {
      type: Type.NUMBER,
      nullable: true,
      description: "Minimum required speed, or null for no requirement."
    },
    minCapacity: {
      type: Type.NUMBER,
      nullable: true,
      description: "Minimum required capacity, or null for no requirement."
    },
    requiredDomain: {
      type: Type.STRING,
      nullable: true,
      description: "Required domain (land/sea/air/amphibious), or null for any."
    }
  },
  required: ["maxWeight", "maxCost", "minRange", "minSpeed", "minCapacity", "requiredDomain"]
};

/**
 * Schema for DesignTip
 */
const designTipSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    condition: {
      type: Type.STRING,
      description: "JavaScript condition string evaluated against simulation metrics. Use variable names: stability, speed, range, efficiency, capacity, weight, cost. Examples: 'stability < 30', 'speed < 50', 'cost > 3000'."
    },
    tip: {
      type: Type.STRING,
      description: "Helpful tip shown when the condition is true. Use encouraging, age-appropriate language."
    }
  },
  required: ["condition", "tip"]
};

/**
 * Schema for VehicleChallenge
 */
const vehicleChallengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: "Short name for the challenge (e.g., 'Speed Racer', 'Eco Explorer')."
    },
    description: {
      type: Type.STRING,
      description: "Description of what the challenge requires. Use age-appropriate language."
    },
    constraints: vehicleConstraintsSchema,
    targetMetric: {
      type: Type.STRING,
      description: "Primary metric to optimize (e.g., 'speed', 'range', 'efficiency', 'capacity')."
    },
    difficulty: {
      type: Type.NUMBER,
      description: "Difficulty level from 1 (easy) to 5 (hard)."
    }
  },
  required: ["name", "description", "constraints", "targetMetric", "difficulty"]
};

/**
 * Schema for VehicleDesignStudioData
 */
const vehicleDesignStudioSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the vehicle design activity (e.g., 'Desert Rover Challenge', 'Ocean Explorer Studio')."
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining the challenge and what students will learn. Use age-appropriate language.",
      nullable: true
    },
    domain: {
      type: Type.STRING,
      enum: ["land", "sea", "air", "amphibious"],
      description: "Domain/environment the vehicle operates in. Match to the topic."
    },
    partsPalette: {
      type: Type.OBJECT,
      properties: {
        bodies: {
          type: Type.ARRAY,
          items: vehicleBodySchema,
          description: "Array of 3-4 body options with different weight/drag/capacity trade-offs."
        },
        propulsion: {
          type: Type.ARRAY,
          items: vehiclePropulsionSchema,
          description: "Array of 3-4 propulsion options with different thrust/efficiency/requirement trade-offs."
        },
        controls: {
          type: Type.ARRAY,
          items: vehicleControlSchema,
          description: "Array of 3-4 control/stabilizer options with stability vs. drag trade-offs."
        }
      },
      required: ["bodies", "propulsion", "controls"],
      description: "The parts palette students can choose from."
    },
    constraints: vehicleConstraintsSchema,
    designTips: {
      type: Type.ARRAY,
      items: designTipSchema,
      description: "Array of 3-5 conditional design tips shown based on simulation results."
    },
    challenges: {
      type: Type.ARRAY,
      items: vehicleChallengeSchema,
      description: "Array of 2-3 design challenges with specific constraints and target metrics."
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["2-3", "4-5"],
      description: "Grade band for complexity. '2-3' for simpler values and language, '4-5' for more complex."
    }
  },
  required: ["title", "domain", "partsPalette", "constraints", "designTips", "challenges", "gradeBand"]
};

/**
 * Generate Vehicle Design Studio data for visualization
 *
 * Creates vehicle design challenges appropriate for grades 2-5 engineering education:
 * - Grades 2-3: Simpler parts, fewer constraints, guided design tips
 * - Grades 4-5: More complex trade-offs, tighter constraints, optimization challenges
 *
 * Students select body, propulsion, and controls, then test against physics metrics.
 * The design-test-iterate cycle teaches the engineering design process.
 *
 * @param topic - The engineering topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns VehicleDesignStudioData with complete configuration
 */
export const generateVehicleDesignStudio = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<VehicleDesignStudioData>
): Promise<VehicleDesignStudioData> => {
  const prompt = `
Create an educational Vehicle Design Studio configuration for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - VEHICLE DESIGN STUDIO:
Vehicle Design Studio teaches the engineering design process through drag-and-drop vehicle building:
1. BODY - The vehicle chassis/hull (affects weight, drag, capacity, cost)
2. PROPULSION - The engine/motor (affects thrust, fuel efficiency, weight, cost, medium requirement)
3. CONTROLS - Stabilizers, fins, gyroscopes (affect stability bonus, drag penalty, weight, cost)
4. PHYSICS SIMULATION - Tests the design against real physics metrics (speed, range, stability, efficiency, capacity)
5. DESIGN CHALLENGES - Specific constraints students must meet

KEY ENGINEERING PRINCIPLES:
- Trade-offs: faster vehicles use more fuel; bigger bodies carry more but weigh more
- Drag coefficient (0.1-1.0): lower values = less air/water resistance = faster
- Thrust must overcome weight and drag for speed
- Stability comes from controls but adds drag and weight
- The engineering design cycle: Design → Test → Analyze → Iterate

DOMAIN SELECTION:
Choose a domain that matches the topic:
- "land" for cars, trucks, rovers, trains
- "sea" for boats, ships, submarines
- "air" for planes, drones, helicopters
- "amphibious" for vehicles that work in multiple environments

GRADE-LEVEL GUIDELINES:

GRADES 2-3 (ages 7-9, gradeBand "2-3"):
- Simpler part names and descriptions (e.g., "Big Truck Body" not "Aerodynamic Chassis")
- Fewer extreme trade-offs; values closer together
- Weight: bodies 50-200kg, propulsion 20-80kg, controls 5-30kg
- Thrust: 500-3000N
- Drag coefficients: 0.2-0.8
- Costs: bodies $200-$1000, propulsion $100-$800, controls $50-$300
- Capacity: 10-100
- Fuel efficiency: 30-80
- Stability bonuses: 10-25
- Drag penalties: 0.02-0.15
- Challenges: 2, difficulty 1-3, generous constraints
- Design tips: 3-4 with simple conditions
- Language: simple, encouraging, concrete

GRADES 4-5 (ages 9-11, gradeBand "4-5"):
- More technical part names (e.g., "Low-Drag Composite Shell")
- Wider trade-off ranges; optimization matters more
- Weight: bodies 80-400kg, propulsion 30-150kg, controls 10-50kg
- Thrust: 800-8000N
- Drag coefficients: 0.1-1.0
- Costs: bodies $500-$4000, propulsion $300-$2500, controls $100-$500
- Capacity: 20-200
- Fuel efficiency: 20-90
- Stability bonuses: 5-30
- Drag penalties: 0.03-0.25
- Challenges: 2-3, difficulty 2-5, tighter constraints
- Design tips: 4-5 with more specific conditions
- Language: more technical, challenge-oriented

PARTS PALETTE REQUIREMENTS:
- Generate 3-4 BODIES with different weight/drag/capacity trade-offs
  - Include one light/fast option, one heavy/high-capacity option, and one balanced option
  - Each needs a unique id (e.g., "body-1", "body-2"), name, weight, dragCoefficient, capacity, cost, and imagePrompt
- Generate 3-4 PROPULSION options with different thrust/efficiency trade-offs
  - Include one high-thrust/low-efficiency option, one low-thrust/high-efficiency option, and one balanced option
  - Each needs: id, name, thrustOutput, fuelEfficiency, weight, cost, requires (match to domain: land→"ground", sea→"water", air→"air", amphibious→"any")
- Generate 3-4 CONTROLS with different stability/drag trade-offs
  - Each needs: id, name, stabilityBonus, dragPenalty, weight, cost

CONSTRAINTS:
- Set overall constraints that are achievable but require thoughtful design
- Use null for unconstrained dimensions
- At least 2-3 constraints should be non-null

DESIGN TIPS:
- Generate 3-5 tips with condition strings that reference simulation variables
- Valid variable names in conditions: stability, speed, range, efficiency, capacity, weight, cost
- Example conditions: "stability < 30", "speed < 50", "cost > 3000", "weight > 400"
- Tips should guide students toward better designs

CHALLENGES:
- Generate 2-3 challenges with increasing difficulty
- Each challenge has its own constraints (can be different from the overall constraints)
- targetMetric should be one of: "speed", "range", "efficiency", "capacity", "stability"
- difficulty: 1-5 stars

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.domain ? `- Domain: ${config.domain}` : ''}
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config.title ? `- Title: ${config.title}` : ''}
${config.constraints ? `- Constraints hints: ${JSON.stringify(config.constraints)}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. partsPalette.bodies must have 3-4 items
2. partsPalette.propulsion must have 3-4 items
3. partsPalette.controls must have 3-4 items
4. All IDs must be unique strings
5. All numeric values must be positive
6. dragCoefficient must be between 0.1 and 1.0
7. difficulty must be between 1 and 5
8. designTips must have 3-5 items
9. challenges must have 2-3 items
10. Physics values should be realistic for the grade band

Return a complete Vehicle Design Studio configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: vehicleDesignStudioSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Vehicle Design Studio data returned from Gemini API');
  }

  // Validation: ensure domain is valid
  if (!data.domain || !['land', 'sea', 'air', 'amphibious'].includes(data.domain)) {
    console.warn('Invalid domain. Setting default to "land".');
    data.domain = 'land';
  }

  // Validation: ensure gradeBand is valid
  if (!data.gradeBand || !['2-3', '4-5'].includes(data.gradeBand)) {
    console.warn('Invalid gradeBand. Setting default.');
    data.gradeBand = '2-3';
  }

  // Validation: ensure partsPalette exists with all sub-arrays
  if (!data.partsPalette) {
    data.partsPalette = { bodies: [], propulsion: [], controls: [] };
  }
  if (!Array.isArray(data.partsPalette.bodies)) {
    data.partsPalette.bodies = [];
  }
  if (!Array.isArray(data.partsPalette.propulsion)) {
    data.partsPalette.propulsion = [];
  }
  if (!Array.isArray(data.partsPalette.controls)) {
    data.partsPalette.controls = [];
  }

  // Validation: ensure bodies have valid properties
  data.partsPalette.bodies = data.partsPalette.bodies.map((b: any, i: number) => ({
    id: b.id || `body-${i + 1}`,
    name: b.name || `Body ${i + 1}`,
    weight: Math.max(10, b.weight || 100),
    dragCoefficient: Math.max(0.1, Math.min(1.0, b.dragCoefficient || 0.4)),
    capacity: Math.max(1, b.capacity || 50),
    cost: Math.max(10, b.cost || 500),
    imagePrompt: b.imagePrompt || 'A vehicle body',
  }));

  // Validation: ensure propulsion have valid properties
  data.partsPalette.propulsion = data.partsPalette.propulsion.map((p: any, i: number) => ({
    id: p.id || `prop-${i + 1}`,
    name: p.name || `Propulsion ${i + 1}`,
    thrustOutput: Math.max(100, p.thrustOutput || 1000),
    fuelEfficiency: Math.max(1, Math.min(100, p.fuelEfficiency || 50)),
    weight: Math.max(5, p.weight || 50),
    cost: Math.max(10, p.cost || 300),
    requires: ['air', 'ground', 'water', 'any'].includes(p.requires) ? p.requires : 'any',
  }));

  // Validation: ensure controls have valid properties
  data.partsPalette.controls = data.partsPalette.controls.map((c: any, i: number) => ({
    id: c.id || `ctrl-${i + 1}`,
    name: c.name || `Control ${i + 1}`,
    stabilityBonus: Math.max(1, Math.min(50, c.stabilityBonus || 15)),
    dragPenalty: Math.max(0, Math.min(0.5, c.dragPenalty || 0.05)),
    weight: Math.max(1, c.weight || 15),
    cost: Math.max(5, c.cost || 100),
  }));

  // Validation: provide default bodies if empty
  if (data.partsPalette.bodies.length === 0) {
    console.warn('No bodies provided. Setting defaults.');
    data.partsPalette.bodies = [
      { id: 'body-light', name: 'Light Frame', weight: 80, dragCoefficient: 0.25, capacity: 20, cost: 400, imagePrompt: 'A lightweight vehicle frame' },
      { id: 'body-standard', name: 'Standard Body', weight: 150, dragCoefficient: 0.4, capacity: 60, cost: 700, imagePrompt: 'A standard vehicle body' },
      { id: 'body-heavy', name: 'Heavy Hauler', weight: 300, dragCoefficient: 0.6, capacity: 150, cost: 1200, imagePrompt: 'A large heavy-duty vehicle body' },
    ];
  }

  // Validation: provide default propulsion if empty
  if (data.partsPalette.propulsion.length === 0) {
    console.warn('No propulsion provided. Setting defaults.');
    data.partsPalette.propulsion = [
      { id: 'prop-eco', name: 'Eco Motor', thrustOutput: 800, fuelEfficiency: 80, weight: 30, cost: 300, requires: 'any' as const },
      { id: 'prop-standard', name: 'Standard Engine', thrustOutput: 2000, fuelEfficiency: 50, weight: 60, cost: 600, requires: 'any' as const },
      { id: 'prop-power', name: 'Power Engine', thrustOutput: 5000, fuelEfficiency: 25, weight: 100, cost: 1500, requires: 'any' as const },
    ];
  }

  // Validation: provide default controls if empty
  if (data.partsPalette.controls.length === 0) {
    console.warn('No controls provided. Setting defaults.');
    data.partsPalette.controls = [
      { id: 'ctrl-basic', name: 'Basic Stabilizer', stabilityBonus: 10, dragPenalty: 0.05, weight: 10, cost: 100 },
      { id: 'ctrl-advanced', name: 'Advanced Stabilizer', stabilityBonus: 20, dragPenalty: 0.1, weight: 20, cost: 250 },
      { id: 'ctrl-gyro', name: 'Gyroscope', stabilityBonus: 25, dragPenalty: 0.03, weight: 15, cost: 400 },
    ];
  }

  // Validation: ensure constraints object exists with all fields
  if (!data.constraints) {
    data.constraints = {
      maxWeight: null,
      maxCost: null,
      minRange: null,
      minSpeed: null,
      minCapacity: null,
      requiredDomain: null,
    };
  } else {
    data.constraints = {
      maxWeight: data.constraints.maxWeight ?? null,
      maxCost: data.constraints.maxCost ?? null,
      minRange: data.constraints.minRange ?? null,
      minSpeed: data.constraints.minSpeed ?? null,
      minCapacity: data.constraints.minCapacity ?? null,
      requiredDomain: data.constraints.requiredDomain ?? null,
    };
  }

  // Validation: ensure designTips array exists
  if (!Array.isArray(data.designTips) || data.designTips.length === 0) {
    console.warn('No designTips provided. Setting defaults.');
    data.designTips = [
      { condition: 'stability < 30', tip: 'Your vehicle is unstable! Try adding a stabilizer or gyroscope to improve balance.' },
      { condition: 'speed < 50', tip: 'Your vehicle is slow. Consider a lighter body or a more powerful engine.' },
      { condition: 'cost > 3000', tip: 'Your design is getting expensive! Look for cheaper parts that still meet your needs.' },
    ];
  }

  // Validation: ensure challenges array exists
  if (!Array.isArray(data.challenges) || data.challenges.length === 0) {
    console.warn('No challenges provided. Setting defaults.');
    data.challenges = [
      {
        name: 'Speed Run',
        description: 'Build the fastest vehicle you can!',
        constraints: { maxWeight: 400, maxCost: null, minRange: null, minSpeed: 80, minCapacity: null, requiredDomain: null },
        targetMetric: 'speed',
        difficulty: 2,
      },
      {
        name: 'Long Haul',
        description: 'Build a vehicle that can travel the farthest distance!',
        constraints: { maxWeight: null, maxCost: 2000, minRange: 200, minSpeed: null, minCapacity: null, requiredDomain: null },
        targetMetric: 'range',
        difficulty: 3,
      },
    ];
  }

  // Validation: ensure challenges have valid constraints and difficulty
  data.challenges = data.challenges.map((ch: any) => ({
    name: ch.name || 'Challenge',
    description: ch.description || 'Complete this design challenge!',
    constraints: {
      maxWeight: ch.constraints?.maxWeight ?? null,
      maxCost: ch.constraints?.maxCost ?? null,
      minRange: ch.constraints?.minRange ?? null,
      minSpeed: ch.constraints?.minSpeed ?? null,
      minCapacity: ch.constraints?.minCapacity ?? null,
      requiredDomain: ch.constraints?.requiredDomain ?? null,
    },
    targetMetric: ch.targetMetric || 'speed',
    difficulty: Math.max(1, Math.min(5, ch.difficulty || 2)),
  }));

  // Validation: ensure title exists
  if (!data.title) {
    data.title = 'Vehicle Design Studio';
  }

  // Apply config overrides
  if (config) {
    if (config.title) data.title = config.title;
    if (config.description !== undefined) data.description = config.description;
    if (config.domain) data.domain = config.domain;
    if (config.partsPalette) data.partsPalette = config.partsPalette;
    if (config.constraints) data.constraints = config.constraints;
    if (config.designTips) data.designTips = config.designTips;
    if (config.challenges) data.challenges = config.challenges;
    if (config.gradeBand) data.gradeBand = config.gradeBand;
  }

  return data;
};
