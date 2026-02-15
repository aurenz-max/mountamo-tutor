import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  EngineExplorerData,
  EngineComponentItem,
  CycleStage,
} from '../../primitives/visual-primitives/engineering/EngineExplorer';

// Re-export for convenience if needed elsewhere
export type { EngineExplorerData, EngineComponentItem, CycleStage };

/**
 * Schema for engine component position
 */
const positionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    x: {
      type: Type.NUMBER,
      description: "X position as percentage (0-100) within the engine diagram."
    },
    y: {
      type: Type.NUMBER,
      description: "Y position as percentage (0-100) within the engine diagram."
    }
  },
  required: ["x", "y"]
};

/**
 * Schema for individual engine component
 */
const engineComponentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique kebab-case identifier for the component (e.g., 'piston', 'combustion-chamber', 'stator-coil')."
    },
    name: {
      type: Type.STRING,
      description: "Human-readable name of the component (e.g., 'Piston', 'Combustion Chamber')."
    },
    function: {
      type: Type.STRING,
      description: "What this component does in the engine, explained at the appropriate grade level."
    },
    analogy: {
      type: Type.STRING,
      description: "Everyday analogy to help students understand (e.g., 'Like a bicycle pump pushing air' for a piston). Use familiar objects: balloons, toys, kitchen items."
    },
    position: positionSchema
  },
  required: ["id", "name", "function", "analogy", "position"]
};

/**
 * Schema for a cycle stage
 */
const cycleStageSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    order: {
      type: Type.NUMBER,
      description: "Stage number starting from 1."
    },
    name: {
      type: Type.STRING,
      description: "Name of this stage (e.g., 'Intake', 'Compression', 'Power', 'Exhaust')."
    },
    description: {
      type: Type.STRING,
      description: "Brief technical description of what happens in this stage."
    },
    narration: {
      type: Type.STRING,
      description: "Conversational narration as if talking to a student. Friendly, enthusiastic, uses 'you' and 'we'. Example: 'Now watch — the piston squeezes the air really tight, like when you squeeze a balloon!'"
    },
    visualDescription: {
      type: Type.STRING,
      description: "What the student would see happening visually (used as alt-text / caption)."
    },
    energyState: {
      type: Type.STRING,
      description: "Energy form at this stage (e.g., 'Chemical energy stored in fuel', 'Heat energy expanding gas', 'Kinetic energy turning shaft')."
    }
  },
  required: ["order", "name", "description", "narration", "visualDescription", "energyState"]
};

/**
 * Schema for engine cycle
 */
const engineCycleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: "Name of the engine cycle (e.g., 'Four-Stroke Cycle', 'Turbofan Cycle', 'Electromagnetic Rotation')."
    },
    stages: {
      type: Type.ARRAY,
      items: cycleStageSchema,
      description: "Ordered stages of the engine cycle. Grades 1-2: 3 stages max. Grades 3-5: full cycle (3-6 stages)."
    }
  },
  required: ["name", "stages"]
};

/**
 * Schema for energy flow
 */
const energyFlowSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    input: {
      type: Type.STRING,
      description: "Primary energy input (e.g., 'Gasoline (chemical energy)', 'Electricity', 'Jet fuel')."
    },
    transformations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Sequence of energy transformations (e.g., ['Combustion (heat)', 'Gas expansion (pressure)', 'Crankshaft rotation (motion)'])."
    },
    output: {
      type: Type.STRING,
      description: "Final useful energy output (e.g., 'Wheel rotation (kinetic energy)', 'Thrust (kinetic energy)')."
    },
    efficiency: {
      type: Type.STRING,
      nullable: true,
      description: "Approximate efficiency as a human-readable string (e.g., '~25-30%'). Null for grades 1-2."
    },
    losses: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Where energy is lost (e.g., ['Heat from exhaust', 'Friction in moving parts', 'Sound/vibration']). Empty array for grades 1-2."
    }
  },
  required: ["input", "transformations", "output", "efficiency", "losses"]
};

/**
 * Schema for vehicle connection
 */
const vehicleConnectionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    vehicle: {
      type: Type.STRING,
      description: "The vehicle or machine this engine powers (e.g., 'Boeing 737 Airplane', 'Family Car', 'Electric Train')."
    },
    howConnected: {
      type: Type.STRING,
      description: "How the engine connects to the vehicle to make it move (e.g., 'The crankshaft turns the wheels through a transmission')."
    },
    whyThisEngine: {
      type: Type.STRING,
      description: "Why this engine type is the best choice for this vehicle (e.g., 'Jet engines produce enormous thrust needed to push a heavy airplane fast enough to fly')."
    }
  },
  required: ["vehicle", "howConnected", "whyThisEngine"]
};

/**
 * Schema for comparison point
 */
const comparisonPointSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    feature: {
      type: Type.STRING,
      description: "Feature being compared (e.g., 'Fuel type', 'Speed', 'Pollution', 'Noise level')."
    },
    thisEngine: {
      type: Type.STRING,
      description: "Value for this engine (e.g., 'Gasoline', 'Very fast', 'Some exhaust')."
    },
    vs: {
      type: Type.STRING,
      description: "Engine type being compared against, as a snake_case id (e.g., 'electric_motor', 'steam')."
    },
    vsValue: {
      type: Type.STRING,
      description: "Value for the compared engine (e.g., 'Electricity', 'Slower', 'No exhaust')."
    }
  },
  required: ["feature", "thisEngine", "vs", "vsValue"]
};

/**
 * Schema for the complete EngineExplorerData
 */
const engineExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the activity (e.g., 'Inside a Jet Engine!', 'How Does a Car Engine Work?')."
    },
    description: {
      type: Type.STRING,
      description: "Short educational description of what students will learn. Age-appropriate language."
    },
    engineType: {
      type: Type.STRING,
      enum: ["jet_turbofan", "piston_4stroke", "electric_motor", "steam", "diesel", "turboprop", "rocket"],
      description: "The type of engine to explore. Pick the most relevant engine for the given topic."
    },
    engineName: {
      type: Type.STRING,
      description: "Specific name for this engine (e.g., 'Turbofan Jet Engine', 'Four-Stroke Gasoline Engine', 'Electric Motor')."
    },
    vehicleContext: {
      type: Type.STRING,
      enum: ["airplane", "car", "train", "ship", "helicopter", "motorcycle"],
      description: "The vehicle context this engine is commonly used in."
    },
    overview: {
      type: Type.STRING,
      description: "1-2 sentence overview of how this engine works, written conversationally for students."
    },
    components: {
      type: Type.ARRAY,
      items: engineComponentSchema,
      description: "Engine components to explore. Grades 1-2: 3-4 main components. Grades 3-5: 5-7 components with more detail."
    },
    cycle: engineCycleSchema,
    energyFlow: energyFlowSchema,
    vehicleConnection: vehicleConnectionSchema,
    comparisonPoints: {
      type: Type.ARRAY,
      items: comparisonPointSchema,
      description: "3-5 comparison points between this engine and a contrasting engine type."
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["1-2", "3-5"],
      description: "Grade band for content complexity. '1-2' for younger students (simpler), '3-5' for older (more detail)."
    }
  },
  required: [
    "title", "description", "engineType", "engineName", "vehicleContext",
    "overview", "components", "cycle", "energyFlow", "vehicleConnection",
    "comparisonPoints", "gradeBand"
  ]
};

/**
 * Generate Engine Explorer data for visualization
 *
 * Creates interactive engine exploration experiences for grades 1-5:
 * - Grades 1-2: Simple components (3-4), short cycle (3 stages), everyday analogies, no efficiency data
 * - Grades 3-5: Full components (5-7), complete cycle, energy flow with efficiency and losses
 *
 * Engine types: jet_turbofan, piston_4stroke, electric_motor, steam, diesel, turboprop, rocket
 *
 * @param topic - The engineering topic or concept (e.g., "how airplane engines work")
 * @param gradeLevel - Grade level string for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns EngineExplorerData with complete configuration
 */
export const generateEngineExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<EngineExplorerData>
): Promise<EngineExplorerData> => {
  const prompt = `
Create an educational Engine Explorer visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - ENGINE EXPLORER:
Engine Explorer is an interactive cutaway view that teaches students how machines are powered.
Students explore engine components, watch the engine cycle animate, trace energy flow, and
connect the engine to the vehicle it powers.

FOUR INTERACTION PHASES:
1. WATCH - Animated cycle showing how the engine works step-by-step
2. EXPLORE - Tap on components to learn what each part does (with analogies)
3. COMPARE - Side-by-side comparison with a different engine type
4. CONNECT - See how the engine fits in its vehicle and why it was chosen

ENGINE TYPES (pick the most relevant for the topic):
- jet_turbofan: Used in airplanes. Sucks air in, compresses it, burns fuel, blasts it out the back.
- piston_4stroke: Used in cars/motorcycles. Intake-Compression-Power-Exhaust cycle.
- electric_motor: Used in electric cars/trains. Magnets + electricity = spinning motion.
- steam: Used in old trains/ships. Water → steam → push piston → turn wheels.
- diesel: Used in trucks/ships. Like gasoline but fuel ignites from compression heat (no spark plug).
- turboprop: Used in smaller airplanes. Like a jet but spins a propeller.
- rocket: Used in space vehicles. Burns fuel + oxidizer, blasts exhaust for thrust.

ANALOGY GUIDELINES (CRITICAL):
Analogies must reference everyday kid experiences:
- Compression → "Like squeezing a balloon really tight"
- Turbine spinning → "Like blowing on a pinwheel and watching it spin"
- Electric motor/magnets → "Like the magnets on your fridge — they push and pull without touching"
- Intake → "Like taking a big breath before blowing out birthday candles"
- Exhaust → "Like the air rushing out when you pop a balloon"
- Crankshaft → "Like pedaling a bicycle — your legs push down and the wheels go round"
- Fuel injection → "Like a spray bottle squirting a mist"
- Spark plug → "Like flicking a lighter to start a campfire"
- Piston → "Like a bicycle pump pushing air"

NARRATION STYLE:
- Conversational, enthusiastic, uses "you" and "we"
- Examples: "Now watch — the piston squeezes the air really tight!", "See how the spark lights up the fuel? That's where the power comes from!"
- Grade 1-2: Short sentences, wonder-focused ("Wow, look at that!")
- Grade 3-5: More technical but still friendly ("Notice how the expanding gas pushes the piston down with a lot of force")

GRADE-LEVEL GUIDELINES:

GRADES 1-2 (ages 6-8):
- gradeBand: "1-2"
- Components: 3-4 main parts only (the biggest, most visible parts)
- Cycle stages: 3 stages maximum (simplified)
- Analogies: Every component needs a strong everyday analogy
- Energy flow: Simple input → output, efficiency = null, losses = empty array []
- Comparison: 3 simple comparison points (fuel, noise, speed)
- Language: Simple, exciting, wonder-based
- Component positions: Spread out (easy to tap), avoid clustering

GRADES 3-5 (ages 8-11):
- gradeBand: "3-5"
- Components: 5-7 parts with more detail
- Cycle stages: Full cycle (4-6 stages)
- Analogies: Still use analogies but can add technical terms alongside
- Energy flow: Full chain with efficiency percentage and energy losses
- Comparison: 4-5 detailed comparison points
- Language: More technical vocabulary introduced naturally
- Component positions: Can be more detailed layout

COMPONENT POSITION GUIDELINES:
- x and y values are percentages (0-100) representing position in the engine diagram
- Spread components logically: intake on left, output on right
- For vertical engines (piston): top-to-bottom flow
- For horizontal engines (jet/turbofan): left-to-right flow
- Keep components at least 15 units apart to prevent overlap
- Center the layout: avoid clustering everything in one corner

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.engineType ? `- Engine type: ${config.engineType}` : ''}
${config.vehicleContext ? `- Vehicle context: ${config.vehicleContext}` : ''}
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. components must have 3-7 items (3-4 for grades 1-2, 5-7 for grades 3-5)
2. cycle.stages must have 3-6 items with sequential order numbers starting from 1
3. All stage order values must be unique and sequential
4. component positions must be within 5-95 range for both x and y
5. comparisonPoints must have 3-5 items, all comparing against the SAME engine type
6. energyFlow.transformations must have at least 1 item
7. energyFlow.efficiency should be null for grades 1-2
8. energyFlow.losses should be empty array for grades 1-2

Return a complete Engine Explorer configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: engineExplorerSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Engine Explorer data returned from Gemini API');
  }

  // Validation: ensure engineType is valid
  const validEngineTypes = ['jet_turbofan', 'piston_4stroke', 'electric_motor', 'steam', 'diesel', 'turboprop', 'rocket'];
  if (!data.engineType || !validEngineTypes.includes(data.engineType)) {
    console.warn('Invalid engineType. Setting default: piston_4stroke');
    data.engineType = 'piston_4stroke';
  }

  // Validation: ensure vehicleContext is valid
  const validVehicles = ['airplane', 'car', 'train', 'ship', 'helicopter', 'motorcycle'];
  if (!data.vehicleContext || !validVehicles.includes(data.vehicleContext)) {
    console.warn('Invalid vehicleContext. Setting default: car');
    data.vehicleContext = 'car';
  }

  // Validation: ensure gradeBand is valid
  if (!data.gradeBand || !['1-2', '3-5'].includes(data.gradeBand)) {
    console.warn('Invalid gradeBand. Setting default based on grade level.');
    const gradeNum = parseInt(gradeLevel.replace(/\D/g, ''), 10);
    data.gradeBand = gradeNum <= 2 ? '1-2' : '3-5';
  }

  // Validation: ensure components exist and are valid
  if (!data.components || data.components.length === 0) {
    console.warn('No components provided. Setting defaults for piston engine.');
    data.components = [
      { id: 'piston', name: 'Piston', function: 'Moves up and down to compress fuel and create power', analogy: 'Like a bicycle pump pushing air', position: { x: 50, y: 30 } },
      { id: 'spark-plug', name: 'Spark Plug', function: 'Creates a spark to ignite the fuel', analogy: 'Like flicking a lighter to start a campfire', position: { x: 50, y: 10 } },
      { id: 'crankshaft', name: 'Crankshaft', function: 'Turns the up-down piston motion into spinning motion', analogy: 'Like pedaling a bicycle — your legs push down and the wheels go round', position: { x: 50, y: 70 } },
      { id: 'fuel-injector', name: 'Fuel Injector', function: 'Sprays fuel into the engine', analogy: 'Like a spray bottle squirting a fine mist', position: { x: 20, y: 20 } },
    ];
  }

  // Validation: clamp component positions to safe range
  data.components = data.components.map((comp: EngineComponentItem) => ({
    ...comp,
    id: comp.id || `comp-${Math.random().toString(36).slice(2, 8)}`,
    name: comp.name || 'Unknown Part',
    function: comp.function || 'Part of the engine',
    analogy: comp.analogy || 'Like a tool that does an important job',
    position: {
      x: Math.max(5, Math.min(95, comp.position?.x ?? 50)),
      y: Math.max(5, Math.min(95, comp.position?.y ?? 50)),
    },
  }));

  // Validation: ensure cycle exists with valid stages
  if (!data.cycle || !data.cycle.stages || data.cycle.stages.length === 0) {
    console.warn('No cycle data provided. Setting defaults.');
    data.cycle = {
      name: 'Engine Cycle',
      stages: [
        { order: 1, name: 'Start', description: 'The engine begins its cycle', narration: 'Here we go! The engine is starting up!', visualDescription: 'The engine parts begin to move', energyState: 'Fuel energy ready' },
        { order: 2, name: 'Power', description: 'Energy is converted to motion', narration: 'Watch the power happen! The engine is pushing things forward!', visualDescription: 'Energy flows through the engine', energyState: 'Energy converting to motion' },
        { order: 3, name: 'Output', description: 'The engine produces useful work', narration: 'And there it is — the engine made the vehicle move!', visualDescription: 'The vehicle moves forward', energyState: 'Kinetic energy output' },
      ],
    };
  }

  // Validation: ensure stage order numbers are sequential starting from 1
  data.cycle.stages = data.cycle.stages.map((stage: CycleStage, i: number) => ({
    ...stage,
    order: i + 1,
    name: stage.name || `Stage ${i + 1}`,
    description: stage.description || '',
    narration: stage.narration || `Here's stage ${i + 1}!`,
    visualDescription: stage.visualDescription || '',
    energyState: stage.energyState || 'Energy in motion',
  }));

  // Validation: ensure energyFlow exists
  if (!data.energyFlow) {
    console.warn('No energyFlow provided. Setting defaults.');
    data.energyFlow = {
      input: 'Fuel (chemical energy)',
      transformations: ['Heat energy', 'Mechanical energy'],
      output: 'Motion (kinetic energy)',
      efficiency: data.gradeBand === '1-2' ? null : '~25%',
      losses: data.gradeBand === '1-2' ? [] : ['Heat', 'Sound'],
    };
  }

  // Validation: ensure transformations is a non-empty array
  if (!data.energyFlow.transformations || data.energyFlow.transformations.length === 0) {
    data.energyFlow.transformations = ['Energy transformation'];
  }

  // Validation: enforce grade-band constraints on energy flow
  if (data.gradeBand === '1-2') {
    data.energyFlow.efficiency = null;
    data.energyFlow.losses = [];
  }

  // Validation: ensure vehicleConnection exists
  if (!data.vehicleConnection) {
    console.warn('No vehicleConnection provided. Setting defaults.');
    data.vehicleConnection = {
      vehicle: data.vehicleContext || 'Vehicle',
      howConnected: 'The engine connects to the vehicle to make it move',
      whyThisEngine: 'This engine is a good match for this vehicle',
    };
  }

  // Validation: ensure comparisonPoints exist
  if (!data.comparisonPoints || data.comparisonPoints.length === 0) {
    console.warn('No comparisonPoints provided. Setting defaults.');
    const vsEngine = data.engineType === 'electric_motor' ? 'piston_4stroke' : 'electric_motor';
    data.comparisonPoints = [
      { feature: 'Fuel type', thisEngine: data.engineType === 'electric_motor' ? 'Electricity' : 'Gasoline', vs: vsEngine, vsValue: data.engineType === 'electric_motor' ? 'Gasoline' : 'Electricity' },
      { feature: 'Noise level', thisEngine: data.engineType === 'electric_motor' ? 'Very quiet' : 'Loud', vs: vsEngine, vsValue: data.engineType === 'electric_motor' ? 'Loud' : 'Very quiet' },
      { feature: 'Pollution', thisEngine: data.engineType === 'electric_motor' ? 'None' : 'Some exhaust', vs: vsEngine, vsValue: data.engineType === 'electric_motor' ? 'Some exhaust' : 'None' },
    ];
  }

  // Apply config overrides
  if (config) {
    if (config.engineType) data.engineType = config.engineType;
    if (config.engineName) data.engineName = config.engineName;
    if (config.vehicleContext) data.vehicleContext = config.vehicleContext;
    if (config.overview) data.overview = config.overview;
    if (config.components) data.components = config.components;
    if (config.cycle) data.cycle = config.cycle;
    if (config.energyFlow) data.energyFlow = config.energyFlow;
    if (config.vehicleConnection) data.vehicleConnection = config.vehicleConnection;
    if (config.comparisonPoints) data.comparisonPoints = config.comparisonPoints;
    if (config.gradeBand) data.gradeBand = config.gradeBand;
  }

  return data;
};
