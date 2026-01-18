import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Lever Load - represents objects placed on the lever
 */
export interface LeverLoad {
  position: number;      // Distance from left end (0-beamLength)
  weight: number;        // Weight in arbitrary units
  icon?: string;         // Emoji or icon identifier
  label?: string;        // Optional label for the load
  color?: string;        // Optional color for the load
  isDraggable?: boolean; // Whether user can drag this load
}

/**
 * Lever Lab Data - complete configuration for lever/fulcrum visualization
 */
export interface LeverLabData {
  title: string;
  description: string;
  beamLength: number;           // Length of lever in units
  fulcrumPosition: number;      // Initial fulcrum placement (distance from left)
  fixedFulcrum: boolean;        // Lock fulcrum in place
  loads: LeverLoad[];           // Objects on the lever
  showDistances: boolean;       // Display measurement labels
  showMA: boolean;              // Display mechanical advantage ratio
  effortInput: 'drag' | 'slider' | 'numeric';  // How to apply effort
  theme: 'seesaw' | 'excavator' | 'crowbar' | 'generic';
  effortPosition?: number;      // Where effort is applied
  effortForce?: number;         // Initial effort force
  showTorque?: boolean;         // Show torque calculations (grades 4-5)
  allowAddLoads?: boolean;      // Allow adding new loads
  maxLoads?: number;            // Maximum number of loads allowed
}

/**
 * Schema definition for Lever Load
 */
const leverLoadSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    position: {
      type: Type.NUMBER,
      description: "Distance from left end of beam (0 to beamLength). Example: if beamLength is 10, position 2 means 2 units from the left."
    },
    weight: {
      type: Type.NUMBER,
      description: "Weight of the object in arbitrary units. Keep between 1-10 for elementary."
    },
    icon: {
      type: Type.STRING,
      description: "Emoji icon for the load (e.g., '📦', '🪨', '🧸', '🎒'). Use fun, age-appropriate icons.",
      nullable: true
    },
    label: {
      type: Type.STRING,
      description: "Optional label (e.g., 'Heavy box', 'Teddy bear')",
      nullable: true
    },
    color: {
      type: Type.STRING,
      description: "Optional CSS color for the load (e.g., '#3B82F6', 'hsl(210, 70%, 50%)')",
      nullable: true
    },
    isDraggable: {
      type: Type.BOOLEAN,
      description: "Whether the student can drag this load. Default: true for interactive learning."
    }
  },
  required: ["position", "weight"]
};

/**
 * Schema definition for Lever Lab Data
 */
const leverLabSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the lever lab activity (e.g., 'Seesaw Balance Challenge!', 'Help the Excavator Lift!')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn and do. Use age-appropriate language."
    },
    beamLength: {
      type: Type.NUMBER,
      description: "Length of the lever beam in units. Use 10 for simple activities, 12-15 for more complex."
    },
    fulcrumPosition: {
      type: Type.NUMBER,
      description: "Initial position of the fulcrum from left end. For balanced start, put at center (beamLength/2)."
    },
    fixedFulcrum: {
      type: Type.BOOLEAN,
      description: "If true, fulcrum cannot be moved. Use false for exploration, true for specific challenges."
    },
    loads: {
      type: Type.ARRAY,
      items: leverLoadSchema,
      description: "Array of objects placed on the lever. Include 2-4 loads for elementary."
    },
    showDistances: {
      type: Type.BOOLEAN,
      description: "Show distance measurements from fulcrum. True for grades 2+, false for K-1."
    },
    showMA: {
      type: Type.BOOLEAN,
      description: "Show mechanical advantage calculation. Only true for grades 4-5."
    },
    effortInput: {
      type: Type.STRING,
      enum: ["drag", "slider", "numeric"],
      description: "How students apply effort force. 'slider' is best for most grades, 'numeric' for advanced."
    },
    theme: {
      type: Type.STRING,
      enum: ["seesaw", "excavator", "crowbar", "generic"],
      description: "Visual theme. 'seesaw' for K-2, 'excavator' for engineering-focused, 'crowbar' for real-world tools."
    },
    effortPosition: {
      type: Type.NUMBER,
      description: "Where effort force is applied (position on beam). Place away from loads for leverage.",
      nullable: true
    },
    effortForce: {
      type: Type.NUMBER,
      description: "Initial effort force value. Default 0 so students can experiment.",
      nullable: true
    },
    showTorque: {
      type: Type.BOOLEAN,
      description: "Show torque calculations (force × distance). Only for grades 4-5."
    },
    allowAddLoads: {
      type: Type.BOOLEAN,
      description: "Allow students to add their own loads. True for exploration, false for specific problems."
    },
    maxLoads: {
      type: Type.NUMBER,
      description: "Maximum number of loads allowed if allowAddLoads is true. Default 6.",
      nullable: true
    }
  },
  required: ["title", "description", "beamLength", "fulcrumPosition", "fixedFulcrum", "loads", "showDistances", "showMA", "effortInput", "theme"]
};

/**
 * Generate Lever Lab data for visualization
 *
 * Creates lever/fulcrum simulations appropriate for K-5 engineering education:
 * - K-1: Simple balance concepts with seesaw theme
 * - 1-2: Fulcrum position exploration
 * - 2-3: Load vs effort trade-offs
 * - 4-5: Mechanical advantage calculations
 *
 * @param topic - The engineering topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns LeverLabData with complete configuration
 */
export const generateLeverLab = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<LeverLabData>
): Promise<LeverLabData> => {
  // Generate random UNBALANCED scenarios for problem-solving
  // These are intentionally NOT balanced so students must solve them
  const randomScenarios = [
    { left: 2, right: 7, weights: [3, 2] },   // Left torque: 3*3=9, Right: 2*2=4 - unbalanced
    { left: 3, right: 8, weights: [2, 3] },   // Left torque: 2*2=4, Right: 3*3=9 - unbalanced
    { left: 2, right: 6, weights: [4, 2] },   // Left torque: 4*3=12, Right: 2*1=2 - unbalanced
    { left: 4, right: 8, weights: [2, 5] },   // Left torque: 2*1=2, Right: 5*3=15 - unbalanced
    { left: 2, right: 9, weights: [3, 1] },   // Left torque: 3*3=9, Right: 1*4=4 - unbalanced
    { left: 1, right: 7, weights: [2, 4] },   // Left torque: 2*4=8, Right: 4*2=8 - close but different
  ];
  const randomScenario = randomScenarios[Math.floor(Math.random() * randomScenarios.length)];

  const prompt = `
Create an educational Lever Lab visualization for teaching "${topic}" to ${gradeLevel} students.

CRITICAL REQUIREMENT - UNBALANCED START:
The lever MUST start in an UNBALANCED state! This is a problem-solving activity where students need to figure out how to balance it.
DO NOT create a balanced starting configuration. The initial torques on left and right sides MUST be different.

RANDOMIZATION: Use these UNBALANCED positions and weights: positions ${randomScenario.left} and ${randomScenario.right}, weights ${randomScenario.weights.join(' and ')}.

CONTEXT - LEVER BASICS:
A lever is a simple machine with three parts:
1. BEAM - The rigid bar that rotates
2. FULCRUM - The pivot point (triangle support)
3. LOADS - Objects placed on the beam

KEY PHYSICS:
- Torque = Weight × Distance from fulcrum
- Balanced when: Left Torque = Right Torque
- Mechanical Advantage = Effort Distance / Load Distance

GRADE-LEVEL GUIDELINES:

KINDERGARTEN - GRADE 1 (ages 5-7):
- Theme: ALWAYS use 'seesaw' - familiar playground context
- Concept: Basic balance - students must SOLVE the imbalance by dragging objects
- Loads: Use fun objects (teddy bears, blocks, toys) - START UNBALANCED
- Fulcrum: Center position, NOT movable (fixedFulcrum: true)
- Numbers: Weights 1-3 only, positions 1-9
- Features: showDistances: false, showMA: false, showTorque: false
- Language: "Oh no! The seesaw is tilted! Can you move the toys to make it balance?"
- effortInput: 'slider' (simple)
- allowAddLoads: true (exploration)
- IMPORTANT: Loads must be draggable (isDraggable: true) so students can move them to solve
- Example (UNBALANCED - student must move objects):
  - beamLength: 10
  - fulcrumPosition: 5
  - loads: [{position: 2, weight: 2, icon: '🧸', isDraggable: true}, {position: 7, weight: 3, icon: '🎁', isDraggable: true}]
  - This is unbalanced: Left torque = 2×3=6, Right torque = 3×2=6... WAIT - use different values!
  - Better: [{position: 3, weight: 3, icon: '🧸', isDraggable: true}, {position: 7, weight: 2, icon: '🎁', isDraggable: true}]
  - Left torque = 3×2=6, Right torque = 2×2=4 - UNBALANCED! Student must adjust.

GRADES 1-2 (ages 6-8):
- Theme: 'seesaw' or 'generic'
- Concept: Fulcrum position affects balance - students must MOVE FULCRUM to solve
- Loads: 2-3 objects with different weights (1-5) - START UNBALANCED
- Fulcrum: Movable (fixedFulcrum: false)
- Features: showDistances: true, showMA: false
- Language: "The seesaw is unbalanced! Move the triangle (fulcrum) to make it level!"
- Challenge: Given unequal weights, find where to put fulcrum to balance
- effortInput: 'slider'
- IMPORTANT: Start with fulcrum at center (5) so it's clearly unbalanced with different weights
- Example (UNBALANCED - student must move fulcrum):
  - beamLength: 10
  - fulcrumPosition: 5 (center - student will need to move it)
  - loads: [{position: 2, weight: 4, icon: '📦', isDraggable: true}, {position: 8, weight: 2, icon: '🪨', isDraggable: true}]
  - Left torque = 4×3=12, Right torque = 2×3=6 - UNBALANCED! Student must move fulcrum.

GRADES 2-3 (ages 7-9):
- Theme: 'seesaw', 'excavator', or 'generic'
- Concept: Distance matters as much as weight
- Loads: 3-4 objects with varied weights (1-8)
- Fulcrum: Sometimes fixed for specific challenges
- Features: showDistances: true, showMA: false
- Introduce: Effort force concept (slider)
- Language: "Farther from the middle = more lifting power!"
- effortInput: 'slider'
- Example with effort:
  - beamLength: 12
  - fulcrumPosition: 4
  - loads: [{position: 2, weight: 6, icon: '🪨', label: 'Heavy rock'}]
  - effortPosition: 10
  - effortForce: 0 (student adjusts)

GRADES 3-4 (ages 8-10):
- Theme: 'excavator' or 'crowbar' (real-world tools)
- Concept: Mechanical advantage preview
- Loads: Multiple objects, calculations needed
- Fulcrum: Fixed for problem-solving
- Features: showDistances: true, showMA: true (introduce concept)
- Language: "Calculate: How much force do you need?"
- effortInput: 'slider' or 'numeric'
- Real-world: "How do construction workers lift heavy beams?"

GRADES 4-5 (ages 9-11):
- Theme: 'excavator', 'crowbar', or 'generic'
- Concept: Full mechanical advantage, torque calculations
- Loads: Complex scenarios with 3-4 loads
- Fulcrum: Fixed for calculation problems
- Features: showDistances: true, showMA: true, showTorque: true
- Language: Technical but accessible: "Torque", "Mechanical Advantage"
- effortInput: 'numeric' for precise calculations
- Challenge: "What's the minimum force needed to lift this?"
- Real-world: Excavator boom, wheelbarrow, crowbar, scissors

ICON SUGGESTIONS BY CONTEXT:
- Playground: 🧸 🎁 🧒 👧 🪀 🏀
- Construction: 🪨 📦 🧱 🪵 ⚙️ 🔧
- Science: ⚗️ 🧪 📊 🔬 ⚖️
- Nature: 🪨 🌳 🍎 🌻 🪵

COLOR PALETTE:
- Loads: '#3B82F6' (blue), '#10B981' (green), '#F59E0B' (amber), '#EF4444' (red), '#8B5CF6' (purple)
- Use distinct colors for different loads

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.beamLength ? `- Beam length: ${config.beamLength}` : ''}
${config.fulcrumPosition !== undefined ? `- Fulcrum position: ${config.fulcrumPosition}` : ''}
${config.fixedFulcrum !== undefined ? `- Fulcrum fixed: ${config.fixedFulcrum}` : ''}
${config.theme ? `- Theme: ${config.theme}` : ''}
${config.showMA !== undefined ? `- Show mechanical advantage: ${config.showMA}` : ''}
${config.loads ? `- Loads provided: ${JSON.stringify(config.loads)}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. All load positions must be 0 <= position <= beamLength
2. Fulcrum position must be 0 < position < beamLength
3. For balanced scenarios, verify: sum(weight × distance_from_fulcrum) is equal on both sides
4. Weights should be positive integers (1-10)
5. Include at least 2 loads for any activity
6. effortPosition should be different from fulcrum position

EDUCATIONAL PRINCIPLES:
1. Start with concrete, familiar examples
2. Build from simple (K-1) to complex (4-5)
3. Use real-world connections (seesaw, excavator, crowbar)
4. Encourage experimentation and discovery
5. Provide clear visual feedback

Return a complete Lever Lab configuration appropriate for the grade level.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: leverLabSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Lever Lab data returned from Gemini API');
  }

  // Validation: ensure beamLength is reasonable
  if (!data.beamLength || data.beamLength < 5 || data.beamLength > 20) {
    console.warn('Invalid beamLength. Setting default.');
    data.beamLength = 10;
  }

  // Validation: ensure fulcrum is within bounds
  if (data.fulcrumPosition <= 0 || data.fulcrumPosition >= data.beamLength) {
    console.warn('Invalid fulcrumPosition. Setting to center.');
    data.fulcrumPosition = data.beamLength / 2;
  }

  // Validation: ensure loads array exists and has items
  if (!data.loads || data.loads.length === 0) {
    console.warn('No loads provided. Setting defaults.');
    data.loads = [
      { position: data.beamLength * 0.3, weight: 2, icon: '📦', isDraggable: true },
      { position: data.beamLength * 0.7, weight: 2, icon: '🪨', isDraggable: true }
    ];
  }

  // Validation: ensure all loads have valid positions
  data.loads = data.loads.map((load: LeverLoad) => ({
    ...load,
    position: Math.max(0, Math.min(data.beamLength, load.position)),
    weight: Math.max(1, Math.min(10, load.weight || 1)),
    isDraggable: load.isDraggable !== false // Default to true
  }));

  // Apply config overrides
  if (config) {
    if (config.beamLength) data.beamLength = config.beamLength;
    if (config.fulcrumPosition !== undefined) data.fulcrumPosition = config.fulcrumPosition;
    if (config.fixedFulcrum !== undefined) data.fixedFulcrum = config.fixedFulcrum;
    if (config.loads) data.loads = config.loads;
    if (config.showDistances !== undefined) data.showDistances = config.showDistances;
    if (config.showMA !== undefined) data.showMA = config.showMA;
    if (config.effortInput) data.effortInput = config.effortInput;
    if (config.theme) data.theme = config.theme;
    if (config.effortPosition !== undefined) data.effortPosition = config.effortPosition;
    if (config.effortForce !== undefined) data.effortForce = config.effortForce;
    if (config.showTorque !== undefined) data.showTorque = config.showTorque;
    if (config.allowAddLoads !== undefined) data.allowAddLoads = config.allowAddLoads;
    if (config.maxLoads !== undefined) data.maxLoads = config.maxLoads;
  }

  // Set sensible defaults for optional fields
  if (data.showTorque === undefined) data.showTorque = false;
  if (data.allowAddLoads === undefined) data.allowAddLoads = true;
  if (data.maxLoads === undefined) data.maxLoads = 6;
  if (data.effortForce === undefined) data.effortForce = 0;

  // CRITICAL: Ensure the lever starts UNBALANCED for problem-solving
  // Calculate torques to verify it's not balanced
  let leftTorque = 0;
  let rightTorque = 0;
  data.loads.forEach((load: LeverLoad) => {
    const distanceFromFulcrum = load.position - data.fulcrumPosition;
    const torque = load.weight * Math.abs(distanceFromFulcrum);
    if (distanceFromFulcrum < 0) {
      leftTorque += torque;
    } else if (distanceFromFulcrum > 0) {
      rightTorque += torque;
    }
  });

  // If somehow balanced, shift one load to create imbalance
  const isBalanced = Math.abs(leftTorque - rightTorque) < 0.5;
  if (isBalanced && data.loads.length >= 2) {
    console.warn('Generated balanced state - adjusting to create imbalance');
    // Move the first load slightly to create imbalance
    const firstLoad = data.loads[0];
    if (firstLoad.position < data.fulcrumPosition) {
      // Move left load closer to fulcrum (reduces left torque)
      firstLoad.position = Math.min(firstLoad.position + 1, data.fulcrumPosition - 0.5);
    } else {
      // Move right load farther from fulcrum (increases right torque)
      firstLoad.position = Math.min(firstLoad.position + 1, data.beamLength - 0.5);
    }
  }

  return data;
};
