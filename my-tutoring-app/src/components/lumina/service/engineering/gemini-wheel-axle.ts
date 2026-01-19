import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Wheel & Axle Explorer Data - complete configuration for wheel/axle visualization
 */
export interface WheelAxleExplorerData {
  title: string;
  description: string;
  wheelDiameter: number;        // Size of outer wheel (units)
  axleDiameter: number;         // Size of inner axle (units)
  adjustable: boolean;          // Allow resizing wheel/axle
  attachedLoad: number;         // Weight on axle rope (0 = no load)
  showRatio: boolean;           // Display diameter ratio
  showForce: boolean;           // Display force values
  rotationInput: 'drag' | 'buttons' | 'slider';  // How to rotate wheel
  theme: 'steering_wheel' | 'winch' | 'doorknob' | 'well_crank';
  showMechanicalAdvantage?: boolean;  // Show MA calculation (grades 4-5)
  showRotationCount?: boolean;  // Show how many wheel turns = axle turns
  targetRotations?: number;     // Goal rotations for challenge mode
}

/**
 * Schema definition for Wheel & Axle Explorer Data
 */
const wheelAxleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the wheel & axle activity (e.g., 'Turn the Winch!', 'Doorknob Discovery', 'Steering Wheel Physics')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn and do. Use age-appropriate language."
    },
    wheelDiameter: {
      type: Type.NUMBER,
      description: "Diameter of the outer wheel in units. Larger = easier to turn. Use 6-12 for elementary (default 8)."
    },
    axleDiameter: {
      type: Type.NUMBER,
      description: "Diameter of the inner axle in units. Smaller = more force multiplication. Use 1-4 for elementary (default 2)."
    },
    adjustable: {
      type: Type.BOOLEAN,
      description: "Allow students to resize wheel and axle. True for exploration/discovery, false for specific problems."
    },
    attachedLoad: {
      type: Type.NUMBER,
      description: "Weight attached to axle rope (in units). 0 = no load (pure exploration). 1-10 for lifting challenges."
    },
    showRatio: {
      type: Type.BOOLEAN,
      description: "Display the wheel:axle diameter ratio. True for grades 2+, false for K-1."
    },
    showForce: {
      type: Type.BOOLEAN,
      description: "Display force calculations. True only for grades 4-5."
    },
    rotationInput: {
      type: Type.STRING,
      enum: ["drag", "buttons", "slider"],
      description: "How students rotate the wheel. 'drag' for hands-on feel (K-2), 'buttons' for step control (1-3), 'slider' for precise (3-5)."
    },
    theme: {
      type: Type.STRING,
      enum: ["steering_wheel", "winch", "doorknob", "well_crank"],
      description: "Visual theme connecting to real-world. 'doorknob' for K-1, 'well_crank' for 1-2, 'winch' for 2-4, 'steering_wheel' for 3-5."
    },
    showMechanicalAdvantage: {
      type: Type.BOOLEAN,
      description: "Show mechanical advantage calculation (wheel diameter / axle diameter). Only for grades 4-5."
    },
    showRotationCount: {
      type: Type.BOOLEAN,
      description: "Show rotation counter. Helps younger students track turns. True for most grades."
    },
    targetRotations: {
      type: Type.NUMBER,
      description: "Goal number of rotations for challenge mode. 0 = no goal (free exploration). Use 2-5 for challenges.",
      nullable: true
    }
  },
  required: ["title", "description", "wheelDiameter", "axleDiameter", "adjustable", "attachedLoad", "showRatio", "showForce", "rotationInput", "theme"]
};

/**
 * Generate Wheel & Axle Explorer data for visualization
 *
 * Creates wheel/axle simulations appropriate for K-5 engineering education:
 * - K-1: Wheels make moving easier (doorknob theme)
 * - 1-2: Doorknobs vs handles, well cranks
 * - 2-3: Bigger wheel = easier turn
 * - 4-5: Gear ratio and mechanical advantage introduction
 *
 * @param topic - The engineering topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns WheelAxleExplorerData with complete configuration
 */
export const generateWheelAxleExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<WheelAxleExplorerData>
): Promise<WheelAxleExplorerData> => {
  // Generate random scenarios for variety
  const randomScenarios = [
    { wheel: 8, axle: 2, load: 4 },   // 4:1 ratio
    { wheel: 10, axle: 2, load: 6 },  // 5:1 ratio
    { wheel: 6, axle: 3, load: 3 },   // 2:1 ratio
    { wheel: 12, axle: 3, load: 8 },  // 4:1 ratio
    { wheel: 8, axle: 4, load: 5 },   // 2:1 ratio
  ];
  const randomScenario = randomScenarios[Math.floor(Math.random() * randomScenarios.length)];

  const prompt = `
Create an educational Wheel & Axle Explorer visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - WHEEL & AXLE BASICS:
A wheel and axle is a simple machine consisting of:
1. WHEEL - The larger circular object (like a steering wheel rim)
2. AXLE - The smaller cylinder attached to the wheel center (like the steering column)
3. Both rotate together as one unit

KEY PHYSICS:
- Mechanical Advantage = Wheel Diameter / Axle Diameter
- Force on wheel × Wheel radius = Force on axle × Axle radius
- Bigger wheel = less effort needed to turn axle
- Trade-off: Bigger wheel = more distance your hand travels per axle turn

REAL-WORLD EXAMPLES:
- Steering wheel: Large wheel → small steering column → easy steering
- Doorknob: Round knob (wheel) → small latch mechanism (axle)
- Well crank: Handle you turn (wheel) → rope drum (axle) → lifts bucket
- Winch: Crank handle (wheel) → drum (axle) → pulls heavy loads
- Screwdriver: Handle (wheel) → shaft (axle) → drives screws

RANDOMIZATION: Use these starting values for variety: wheel diameter ${randomScenario.wheel}, axle diameter ${randomScenario.axle}, load ${randomScenario.load}.

GRADE-LEVEL GUIDELINES:

KINDERGARTEN - GRADE 1 (ages 5-7):
- Theme: 'doorknob' - familiar household context
- Concept: Wheels help us turn things, doorknobs are easier than handles
- Features: showRatio: false, showForce: false, showMechanicalAdvantage: false
- Rotation: 'drag' or 'buttons' for intuitive control
- Adjustable: true for exploration
- Load: 0 (focus on rotation concept, not lifting)
- Language: "Spin the doorknob! See how it opens the door."
- Challenge: None (free play)

GRADES 1-2 (ages 6-8):
- Theme: 'doorknob' or 'well_crank'
- Concept: Bigger wheels are easier to turn
- Features: showRatio: true (introduce ratio concept), showForce: false
- Rotation: 'drag' or 'buttons'
- Adjustable: true (let them discover bigger = easier)
- Load: 0-3 (light loads)
- Language: "Make the wheel bigger - is it easier or harder to turn?"
- Challenge: Can you lift the bucket? Count your turns!

GRADES 2-3 (ages 7-9):
- Theme: 'well_crank' or 'winch'
- Concept: Wheel size vs axle size affects how easy it is
- Features: showRatio: true, showForce: false, showRotationCount: true
- Rotation: 'buttons' or 'slider'
- Adjustable: true (experiment with different ratios)
- Load: 3-6 (moderate loads)
- Language: "Change the wheel and axle sizes. What makes lifting easiest?"
- Challenge: Lift the load with the fewest turns!

GRADES 3-4 (ages 8-10):
- Theme: 'winch' or 'steering_wheel'
- Concept: Mechanical advantage preview
- Features: showRatio: true, showForce: true (introduce force concept)
- Rotation: 'slider'
- Adjustable: true or false (can set specific challenge)
- Load: 5-8
- Language: "Notice how less force is needed with a bigger wheel!"
- Challenge: What ratio do you need to lift this load?

GRADES 4-5 (ages 9-11):
- Theme: 'steering_wheel' or 'winch'
- Concept: Full mechanical advantage calculations
- Features: showRatio: true, showForce: true, showMechanicalAdvantage: true
- Rotation: 'slider' for precise control
- Adjustable: sometimes fixed for calculation problems
- Load: 6-10
- Language: "Calculate the mechanical advantage. Predict the force needed!"
- Challenge: Design a system with MA = 4 to lift this load

THEME DESCRIPTIONS:
- 'doorknob': Golden/brass doorknob, familiar to all ages. Best for K-2.
- 'well_crank': Wooden well with rope and bucket. Story-rich, grades 1-3.
- 'winch': Construction/crane winch. Industrial feel, grades 2-5.
- 'steering_wheel': Car steering wheel (black with red accents). Cool factor, grades 3-5.

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.wheelDiameter !== undefined ? `- Wheel diameter: ${config.wheelDiameter}` : ''}
${config.axleDiameter !== undefined ? `- Axle diameter: ${config.axleDiameter}` : ''}
${config.adjustable !== undefined ? `- Adjustable: ${config.adjustable}` : ''}
${config.attachedLoad !== undefined ? `- Attached load: ${config.attachedLoad}` : ''}
${config.showRatio !== undefined ? `- Show ratio: ${config.showRatio}` : ''}
${config.showForce !== undefined ? `- Show force: ${config.showForce}` : ''}
${config.theme ? `- Theme: ${config.theme}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. wheelDiameter must be 4-12 (reasonable visual size)
2. axleDiameter must be 1-6 and less than wheelDiameter
3. attachedLoad should be 0-10
4. Ratio (wheel/axle) should be between 1.5 and 6 for meaningful MA
5. Theme should match grade level appropriateness

EDUCATIONAL PRINCIPLES:
1. Start with familiar contexts (doorknob, well)
2. Build from play (K-1) to calculation (4-5)
3. Use discovery learning - let students find patterns
4. Connect to real-world applications
5. Provide clear visual feedback

Return a complete Wheel & Axle Explorer configuration appropriate for the grade level.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: wheelAxleSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Wheel & Axle Explorer data returned from Gemini API');
  }

  // Validation: ensure wheelDiameter is reasonable
  if (!data.wheelDiameter || data.wheelDiameter < 4 || data.wheelDiameter > 12) {
    console.warn('Invalid wheelDiameter. Setting default.');
    data.wheelDiameter = 8;
  }

  // Validation: ensure axleDiameter is reasonable and less than wheel
  if (!data.axleDiameter || data.axleDiameter < 1 || data.axleDiameter > 6) {
    console.warn('Invalid axleDiameter. Setting default.');
    data.axleDiameter = 2;
  }

  // Ensure axle is smaller than wheel
  if (data.axleDiameter >= data.wheelDiameter) {
    console.warn('Axle must be smaller than wheel. Adjusting.');
    data.axleDiameter = Math.max(1, data.wheelDiameter / 3);
  }

  // Validation: ensure attachedLoad is reasonable
  if (data.attachedLoad === undefined || data.attachedLoad < 0 || data.attachedLoad > 10) {
    data.attachedLoad = 0;
  }

  // Apply config overrides
  if (config) {
    if (config.wheelDiameter !== undefined) data.wheelDiameter = config.wheelDiameter;
    if (config.axleDiameter !== undefined) data.axleDiameter = config.axleDiameter;
    if (config.adjustable !== undefined) data.adjustable = config.adjustable;
    if (config.attachedLoad !== undefined) data.attachedLoad = config.attachedLoad;
    if (config.showRatio !== undefined) data.showRatio = config.showRatio;
    if (config.showForce !== undefined) data.showForce = config.showForce;
    if (config.rotationInput) data.rotationInput = config.rotationInput;
    if (config.theme) data.theme = config.theme;
    if (config.showMechanicalAdvantage !== undefined) data.showMechanicalAdvantage = config.showMechanicalAdvantage;
    if (config.showRotationCount !== undefined) data.showRotationCount = config.showRotationCount;
    if (config.targetRotations !== undefined) data.targetRotations = config.targetRotations;
  }

  // Set sensible defaults for optional fields
  if (data.showMechanicalAdvantage === undefined) data.showMechanicalAdvantage = false;
  if (data.showRotationCount === undefined) data.showRotationCount = true;
  if (data.targetRotations === undefined) data.targetRotations = 0;

  return data;
};
