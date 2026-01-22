import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Gear - represents a single gear in the train
 */
export interface Gear {
  id: string;
  x: number;           // Grid column position
  y: number;           // Grid row position
  teeth: number;       // Number of teeth (determines size)
  color: string;       // Gear color
  isDriver?: boolean;  // Is this the input gear?
}

/**
 * Gear Train Builder Data - complete configuration for gear train visualization
 */
export interface GearTrainBuilderData {
  title: string;
  description: string;
  availableGears: number[];      // Gear sizes available (by tooth count)
  gridSize: [number, number];    // [rows, cols] workspace dimensions
  initialGears?: Gear[];         // Pre-placed gears for guided scenarios
  driverGearId?: string;         // Which gear receives input (by id)
  showTeethCount: boolean;       // Label gear teeth
  showSpeedRatio: boolean;       // Display rotation ratio
  showDirection: boolean;        // Indicate CW/CCW
  targetRatio?: number;          // Goal for design challenges (null = free play)
  maxGears: number;              // Limit for scaffolded problems
  theme: 'toy' | 'machine' | 'clock' | 'bicycle';
  allowAddGears?: boolean;       // Can students add new gears
  allowRemoveGears?: boolean;    // Can students remove gears
}

/**
 * Schema definition for Gear
 */
const gearSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique identifier for the gear (e.g., 'gear-1', 'gear-2')"
    },
    x: {
      type: Type.NUMBER,
      description: "Grid column position (0-indexed). Must be within gridSize bounds."
    },
    y: {
      type: Type.NUMBER,
      description: "Grid row position (0-indexed). Must be within gridSize bounds."
    },
    teeth: {
      type: Type.NUMBER,
      description: "Number of teeth on the gear. Common values: 8 (small), 12, 16, 24, 32 (large). More teeth = bigger gear."
    },
    color: {
      type: Type.STRING,
      description: "CSS color for the gear (e.g., '#F472B6', '#60A5FA'). Use bright, distinct colors."
    },
    isDriver: {
      type: Type.BOOLEAN,
      description: "Whether this gear receives input rotation. Only ONE gear should be the driver.",
      nullable: true
    }
  },
  required: ["id", "x", "y", "teeth", "color"]
};

/**
 * Schema definition for Gear Train Builder Data
 */
const gearTrainBuilderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the gear train activity (e.g., 'Gear Speed Challenge!', 'Build a Clock Mechanism!')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn and do. Use age-appropriate language."
    },
    availableGears: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "Array of gear sizes (by tooth count) available to students. E.g., [8, 12, 16, 24] for varied ratios."
    },
    gridSize: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "Grid dimensions as [rows, cols]. E.g., [4, 6] for a 4-row by 6-column grid."
    },
    initialGears: {
      type: Type.ARRAY,
      items: gearSchema,
      description: "Pre-placed gears for guided scenarios. Empty array for free exploration.",
      nullable: true
    },
    driverGearId: {
      type: Type.STRING,
      description: "ID of the gear that receives input rotation. Must match an initialGears entry id.",
      nullable: true
    },
    showTeethCount: {
      type: Type.BOOLEAN,
      description: "Display tooth count labels on gears. True for grades 2+, false for K-1 exploration."
    },
    showSpeedRatio: {
      type: Type.BOOLEAN,
      description: "Display speed ratio (e.g., '2x') on driven gears. True for grades 3+."
    },
    showDirection: {
      type: Type.BOOLEAN,
      description: "Display rotation direction arrows (CW/CCW). True for grades 1+."
    },
    targetRatio: {
      type: Type.NUMBER,
      description: "Target output ratio for design challenges (e.g., 2.0 for 2:1 ratio). Null for free play.",
      nullable: true
    },
    maxGears: {
      type: Type.NUMBER,
      description: "Maximum number of gears allowed. Use 4-6 for most activities, 2-3 for simple challenges."
    },
    theme: {
      type: Type.STRING,
      enum: ["toy", "machine", "clock", "bicycle"],
      description: "Visual theme. 'toy' for K-2 (colorful), 'clock' for 2-3 (golden), 'machine' for 3-4 (industrial), 'bicycle' for 4-5 (real-world)."
    },
    allowAddGears: {
      type: Type.BOOLEAN,
      description: "Whether students can add new gears. True for exploration/design, false for analysis challenges."
    },
    allowRemoveGears: {
      type: Type.BOOLEAN,
      description: "Whether students can remove gears. Usually matches allowAddGears."
    }
  },
  required: ["title", "description", "availableGears", "gridSize", "showTeethCount", "showSpeedRatio", "showDirection", "maxGears", "theme", "allowAddGears", "allowRemoveGears"]
};

/**
 * Generate Gear Train Builder data for visualization
 *
 * Creates gear train simulations appropriate for K-5 engineering education:
 * - K-1: Gears turn together (free play, colorful)
 * - 1-2: Direction changes with each gear
 * - 2-3: Big gear turns slow gear fast
 * - 3-4: Counting teeth for ratios
 * - 4-5: Design challenges with specific output speeds
 *
 * @param topic - The engineering topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns GearTrainBuilderData with complete configuration
 */
export const generateGearTrainBuilder = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<GearTrainBuilderData>
): Promise<GearTrainBuilderData> => {
  const prompt = `
Create an educational Gear Train Builder visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - GEAR BASICS:
Gears are toothed wheels that mesh together to transfer motion and force.
Key concepts:
1. MESHING - Gears must touch (teeth interlock) to transfer rotation
2. DIRECTION - Each gear reverses direction (driver CW → driven CCW → next CW)
3. SPEED RATIO - Smaller gears spin faster: ratio = driver teeth / driven teeth
4. TORQUE TRADE-OFF - Faster gears have less torque (twisting force)

GRADE-LEVEL GUIDELINES:

KINDERGARTEN - GRADE 1 (ages 5-7):
- Theme: 'toy' - bright, colorful, playful
- Concept: Gears turn together, simple cause-and-effect
- Grid: 3x4 (small, manageable)
- Gears: Large teeth counts only (16, 20, 24) for easy meshing
- Features: showTeethCount: false, showSpeedRatio: false, showDirection: false
- Mode: Free exploration (no target ratio)
- Language: "Let's make the gears spin! Put gears next to each other!"
- maxGears: 3-4
- Pre-place 1-2 gears to get started
- Example: Two 20-tooth gears side by side that spin together

GRADES 1-2 (ages 6-8):
- Theme: 'toy' or 'clock'
- Concept: Direction changes with each gear
- Grid: 4x5
- Gears: Mixed sizes (12, 16, 20, 24)
- Features: showTeethCount: false, showSpeedRatio: false, showDirection: true
- Mode: Free exploration with direction focus
- Language: "Each gear spins the opposite way! Can you make a chain?"
- maxGears: 4-5
- Pre-place driver gear, students add more
- Example: Chain of 3 gears showing alternating directions

GRADES 2-3 (ages 7-9):
- Theme: 'clock' or 'machine'
- Concept: Big gear makes small gear spin faster
- Grid: 4x6
- Gears: Varied sizes (8, 12, 16, 24)
- Features: showTeethCount: true, showSpeedRatio: true, showDirection: true
- Mode: Guided exploration or simple ratio challenges
- Language: "Big gears turn small gears faster! Count the teeth!"
- maxGears: 5
- targetRatio: simple ratios like 2.0 or 0.5
- Example: 24-tooth driver → 12-tooth driven (2:1 speed increase)

GRADES 3-4 (ages 8-10):
- Theme: 'machine' or 'bicycle'
- Concept: Counting teeth to predict ratios
- Grid: 4x6 or 5x7
- Gears: Full range (8, 12, 16, 20, 24, 32)
- Features: showTeethCount: true, showSpeedRatio: true, showDirection: true
- Mode: Design challenges with specific ratios
- Language: "Calculate: driver teeth ÷ driven teeth = speed ratio"
- maxGears: 6
- targetRatio: 2.0, 3.0, 0.5, 1.5, etc.
- Example: Build a gear train with output ratio of 3:1

GRADES 4-5 (ages 9-11):
- Theme: 'machine' or 'bicycle'
- Concept: Multi-gear trains, compound ratios
- Grid: 5x7 or larger
- Gears: Full range with more options (8, 10, 12, 16, 20, 24, 28, 32)
- Features: All enabled
- Mode: Complex design challenges
- Language: "Total ratio = multiply each stage. Design a 4:1 gear train!"
- maxGears: 6-8
- targetRatio: compound ratios like 4.0, 6.0, 0.25
- Real-world: "How does a bicycle use gears to go faster or climb hills?"
- Example: Multi-stage gear train with intermediate gears

GEAR PLACEMENT RULES:
1. Gears mesh when their centers are about (r1 + r2) apart (radius = teeth * 2 pixels)
2. On a grid, adjacent cells work well for similar-sized gears
3. For different sizes, may need diagonal placement
4. Leave room for students to experiment

COLOR PALETTE BY THEME:
- toy: '#F472B6' (pink), '#A78BFA' (purple), '#60A5FA' (blue), '#34D399' (green), '#FBBF24' (yellow)
- machine: '#71717A' (gray), '#A1A1AA' (silver), '#52525B' (dark gray)
- clock: '#D4AF37' (gold), '#B8860B' (dark gold), '#DAA520' (goldenrod)
- bicycle: '#94A3B8' (slate), '#64748B' (gray), '#475569' (dark slate)

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.availableGears ? `- Available gears: ${JSON.stringify(config.availableGears)}` : ''}
${config.gridSize ? `- Grid size: ${JSON.stringify(config.gridSize)}` : ''}
${config.initialGears ? `- Initial gears: ${JSON.stringify(config.initialGears)}` : ''}
${config.targetRatio !== undefined ? `- Target ratio: ${config.targetRatio}` : ''}
${config.maxGears ? `- Max gears: ${config.maxGears}` : ''}
${config.theme ? `- Theme: ${config.theme}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. All gear positions must be within grid bounds (0 to rows-1, 0 to cols-1)
2. Gear teeth must be between 8 and 32
3. If initialGears provided, one should have isDriver: true
4. driverGearId must match an initialGears entry if provided
5. availableGears should include sizes that can create the targetRatio (if set)
6. Colors should be from the theme palette

EDUCATIONAL PRINCIPLES:
1. Start with concrete, hands-on exploration
2. Build from observation (K-1) to calculation (4-5)
3. Use real-world connections (clocks, bikes, toys)
4. Encourage experimentation - wrong answers lead to discovery
5. Provide clear visual feedback (direction arrows, speed ratios)

Return a complete Gear Train Builder configuration appropriate for the grade level.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: gearTrainBuilderSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Gear Train Builder data returned from Gemini API');
  }

  // Validation: ensure gridSize is reasonable
  if (!data.gridSize || data.gridSize.length !== 2) {
    console.warn('Invalid gridSize. Setting default.');
    data.gridSize = [4, 6];
  }
  data.gridSize[0] = Math.max(3, Math.min(8, data.gridSize[0]));
  data.gridSize[1] = Math.max(4, Math.min(10, data.gridSize[1]));

  // Validation: ensure availableGears is valid
  if (!data.availableGears || data.availableGears.length === 0) {
    console.warn('No available gears. Setting defaults.');
    data.availableGears = [8, 12, 16, 24];
  }
  data.availableGears = data.availableGears.filter((t: number) => t >= 8 && t <= 32);

  // Validation: ensure maxGears is reasonable
  if (!data.maxGears || data.maxGears < 2 || data.maxGears > 10) {
    console.warn('Invalid maxGears. Setting default.');
    data.maxGears = 6;
  }

  // Validation: ensure theme is valid
  const validThemes = ['toy', 'machine', 'clock', 'bicycle'];
  if (!data.theme || !validThemes.includes(data.theme)) {
    console.warn('Invalid theme. Setting default.');
    data.theme = 'toy';
  }

  // Validation: ensure initialGears positions are within bounds
  if (data.initialGears && Array.isArray(data.initialGears)) {
    const [rows, cols] = data.gridSize;
    data.initialGears = data.initialGears.filter((gear: Gear) =>
      gear.x >= 0 && gear.x < cols && gear.y >= 0 && gear.y < rows
    );

    // Ensure at least one driver if gears exist
    if (data.initialGears.length > 0) {
      const hasDriver = data.initialGears.some((g: Gear) => g.isDriver);
      if (!hasDriver) {
        data.initialGears[0].isDriver = true;
        data.driverGearId = data.initialGears[0].id;
      }
    }
  }

  // Apply config overrides
  if (config) {
    if (config.availableGears) data.availableGears = config.availableGears;
    if (config.gridSize) data.gridSize = config.gridSize;
    if (config.initialGears) data.initialGears = config.initialGears;
    if (config.driverGearId) data.driverGearId = config.driverGearId;
    if (config.showTeethCount !== undefined) data.showTeethCount = config.showTeethCount;
    if (config.showSpeedRatio !== undefined) data.showSpeedRatio = config.showSpeedRatio;
    if (config.showDirection !== undefined) data.showDirection = config.showDirection;
    if (config.targetRatio !== undefined) data.targetRatio = config.targetRatio;
    if (config.maxGears) data.maxGears = config.maxGears;
    if (config.theme) data.theme = config.theme;
    if (config.allowAddGears !== undefined) data.allowAddGears = config.allowAddGears;
    if (config.allowRemoveGears !== undefined) data.allowRemoveGears = config.allowRemoveGears;
  }

  // Set sensible defaults for optional fields
  if (data.allowAddGears === undefined) data.allowAddGears = true;
  if (data.allowRemoveGears === undefined) data.allowRemoveGears = true;

  return data;
};
