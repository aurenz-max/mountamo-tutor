import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Load types for the ramp
 */
export type LoadType = 'box' | 'barrel' | 'wheel' | 'custom';
export type FrictionLevel = 'none' | 'low' | 'medium' | 'high';
export type RampTheme = 'loading_dock' | 'dump_truck' | 'skateboard' | 'generic';

/**
 * Ramp Lab Data - complete configuration for inclined plane visualization
 */
export interface RampLabData {
  title: string;
  description: string;
  rampLength: number;           // Length of ramp surface in units
  rampAngle: number;            // Angle in degrees (0-60)
  adjustableAngle: boolean;     // Allow student control
  loadWeight: number;           // Object weight in arbitrary units
  loadType: LoadType;           // Type of object on ramp
  showMeasurements: boolean;    // Display h, l, angle
  frictionLevel: FrictionLevel; // Friction coefficient
  theme: RampTheme;             // Visual theme
  showForceArrows?: boolean;    // Show force decomposition arrows (grades 3-5)
  showMA?: boolean;             // Show mechanical advantage (grades 4-5)
  allowPush?: boolean;          // Allow student to apply push force
  pushForce?: number;           // Initial push force
  customLoadIcon?: string;      // Custom emoji for load
  customLoadLabel?: string;     // Custom label for load
}

/**
 * Schema definition for Ramp Lab Data
 */
const rampLabSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the ramp lab activity (e.g., 'Loading Dock Challenge!', 'Help the Truck Unload!')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn and do. Use age-appropriate language."
    },
    rampLength: {
      type: Type.NUMBER,
      description: "Length of the ramp surface in units. Use 8-12 for most activities."
    },
    rampAngle: {
      type: Type.NUMBER,
      description: "Angle of the ramp in degrees. Use 15-30 for gentle, 30-45 for moderate, 45-60 for steep."
    },
    adjustableAngle: {
      type: Type.BOOLEAN,
      description: "If true, students can adjust the ramp angle. True for exploration, false for specific challenges."
    },
    loadWeight: {
      type: Type.NUMBER,
      description: "Weight of the object in arbitrary units. Keep between 1-10 for elementary."
    },
    loadType: {
      type: Type.STRING,
      enum: ["box", "barrel", "wheel", "custom"],
      description: "Type of object on ramp. 'box' slides, 'barrel' and 'wheel' roll. Use 'custom' with customLoadIcon."
    },
    showMeasurements: {
      type: Type.BOOLEAN,
      description: "Show height, length, and angle measurements. True for grades 2+, false for K-1."
    },
    frictionLevel: {
      type: Type.STRING,
      enum: ["none", "low", "medium", "high"],
      description: "Friction level: 'none' for ideal, 'low' for wheels, 'medium' for boxes, 'high' for rough surfaces."
    },
    theme: {
      type: Type.STRING,
      enum: ["loading_dock", "dump_truck", "skateboard", "generic"],
      description: "Visual theme. 'loading_dock' for work context, 'dump_truck' for vehicles, 'skateboard' for fun context."
    },
    showForceArrows: {
      type: Type.BOOLEAN,
      description: "Show force decomposition arrows (gravity, normal, friction, push). Only for grades 3-5.",
      nullable: true
    },
    showMA: {
      type: Type.BOOLEAN,
      description: "Show mechanical advantage calculation. Only for grades 4-5.",
      nullable: true
    },
    allowPush: {
      type: Type.BOOLEAN,
      description: "Allow students to apply push force to move the load. Default true.",
      nullable: true
    },
    pushForce: {
      type: Type.NUMBER,
      description: "Initial push force value. Default 0 so students can experiment.",
      nullable: true
    },
    customLoadIcon: {
      type: Type.STRING,
      description: "Custom emoji icon for the load when loadType is 'custom' (e.g., '🛷', '🎿', '🛹').",
      nullable: true
    },
    customLoadLabel: {
      type: Type.STRING,
      description: "Custom label for the load when loadType is 'custom' (e.g., 'Sled', 'Skateboard').",
      nullable: true
    }
  },
  required: ["title", "description", "rampLength", "rampAngle", "adjustableAngle", "loadWeight", "loadType", "showMeasurements", "frictionLevel", "theme"]
};

/**
 * Generate Ramp Lab data for visualization
 *
 * Creates inclined plane simulations appropriate for K-5 engineering education:
 * - K-1: Rolling vs sliding exploration
 * - 1-2: Steeper = harder to push
 * - 2-3: Height vs length trade-off
 * - 4-5: Calculating slope advantage
 *
 * @param topic - The engineering topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns RampLabData with complete configuration
 */
export const generateRampLab = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<RampLabData>
): Promise<RampLabData> => {
  // Generate random scenarios for variety
  const randomScenarios = [
    { angle: 20, weight: 3, friction: 'low' as FrictionLevel, load: 'wheel' as LoadType },
    { angle: 35, weight: 5, friction: 'medium' as FrictionLevel, load: 'box' as LoadType },
    { angle: 25, weight: 4, friction: 'low' as FrictionLevel, load: 'barrel' as LoadType },
    { angle: 40, weight: 6, friction: 'high' as FrictionLevel, load: 'box' as LoadType },
    { angle: 15, weight: 2, friction: 'none' as FrictionLevel, load: 'wheel' as LoadType },
    { angle: 30, weight: 5, friction: 'medium' as FrictionLevel, load: 'barrel' as LoadType },
  ];
  const randomScenario = randomScenarios[Math.floor(Math.random() * randomScenarios.length)];

  const prompt = `
Create an educational Ramp Lab (Inclined Plane) visualization for teaching "${topic}" to ${gradeLevel} students.

RANDOMIZATION: Use these values for variety: angle ${randomScenario.angle}°, weight ${randomScenario.weight}, friction ${randomScenario.friction}, load type ${randomScenario.load}.

CONTEXT - INCLINED PLANE BASICS:
An inclined plane (ramp) is a simple machine that:
1. Reduces the force needed to lift objects
2. Trades distance for force (longer ramp = less force, but more distance)
3. Introduces friction as a real-world factor

KEY PHYSICS:
- Mechanical Advantage = Ramp Length / Height
- Force to push up = Weight × sin(angle) + Friction
- Friction Force = Friction Coefficient × Normal Force
- Normal Force = Weight × cos(angle)

REAL-WORLD CONNECTIONS:
- Loading docks for trucks
- Wheelchair ramps (ADA compliance)
- Dump truck beds
- Skateboard/BMX ramps
- Playground slides
- Moving furniture with ramps

GRADE-LEVEL GUIDELINES:

KINDERGARTEN - GRADE 1 (ages 5-7):
- Theme: 'skateboard' or 'generic' - fun, playful context
- Concept: Rolling vs sliding - wheels roll easier!
- Load: Use 'wheel' or 'barrel' for rolling exploration
- Angle: Gentle slopes (15-25°), adjustable for play
- Weight: Light (1-3 units)
- Friction: 'none' or 'low' for clear demonstrations
- Features: showMeasurements: false, showForceArrows: false, showMA: false
- Language: "Can you help the ball roll up the ramp? Which is easier - steep or flat?"
- allowPush: true
- Example:
  - rampAngle: 20
  - loadType: 'wheel'
  - frictionLevel: 'none'
  - theme: 'skateboard'

GRADES 1-2 (ages 6-8):
- Theme: 'skateboard' or 'loading_dock'
- Concept: Steeper = harder to push
- Load: Compare rolling ('wheel', 'barrel') vs sliding ('box')
- Angle: Moderate range (15-40°), adjustable
- Weight: 2-5 units
- Friction: 'low' or 'medium' to show sliding difficulty
- Features: showMeasurements: true (basic), showForceArrows: false
- Language: "Why is it harder to push the box up a steep ramp?"
- Challenge: "Make the ramp gentle enough to push the heavy box!"

GRADES 2-3 (ages 7-9):
- Theme: 'loading_dock' or 'dump_truck'
- Concept: Height vs length trade-off
- Load: Various types for comparison
- Angle: Full range (10-50°), adjustable
- Weight: 3-7 units
- Friction: 'medium' for realistic scenarios
- Features: showMeasurements: true, showForceArrows: false
- Language: "A longer, gentler ramp needs less force! But you have to push farther."
- Real-world: "How do workers load heavy boxes onto trucks?"
- Challenge: "Design a ramp that's easy enough to push but not too long!"

GRADES 3-4 (ages 8-10):
- Theme: 'loading_dock' or 'dump_truck'
- Concept: Introduce mechanical advantage concept
- Load: Heavier objects (5-8 units)
- Angle: Problem-specific (20-45°)
- Friction: 'medium' or 'high'
- Features: showMeasurements: true, showForceArrows: true (introduce), showMA: true
- Language: "The mechanical advantage tells us how much the ramp helps!"
- Real-world: "Why do wheelchair ramps need to be a certain slope?"
- ADA Connection: "ADA ramps must be no steeper than 1:12 (about 5°)"

GRADES 4-5 (ages 9-11):
- Theme: 'loading_dock', 'dump_truck', or 'generic'
- Concept: Calculate forces, design optimal ramps
- Load: Heavy objects (6-10 units), various types
- Angle: Specific values for calculations
- Friction: All levels, compare effects
- Features: showMeasurements: true, showForceArrows: true, showMA: true
- Language: Technical: "force parallel to surface", "normal force", "coefficient of friction"
- Calculations: "What angle gives MA of 2? What force is needed at 30°?"
- Design Challenge: "Design a ramp that requires less than 50N of force"

LOAD TYPE GUIDANCE:
- 'box': Slides, affected by friction. Good for demonstrating friction effects.
- 'barrel': Rolls, less friction. Shows rolling vs sliding difference.
- 'wheel': Rolls easily, minimal friction. Best for demonstrating pure ramp mechanics.
- 'custom': Use with customLoadIcon and customLoadLabel for themed scenarios.

THEME DESCRIPTIONS:
- 'loading_dock': Industrial setting, gray/orange colors, practical context
- 'dump_truck': Construction site, orange/brown colors, vehicle theme
- 'skateboard': Fun/sporty, purple colors, relatable to kids
- 'generic': Neutral blue, good for abstract learning

ICON SUGGESTIONS (for custom loads):
- Fun: 🛷 🛹 🎿 ⚽ 🏀 🎱
- Work: 📦 🧳 🪵 🧱 🛢️
- Food: 🍎 🎃 🥔 🍉

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.rampLength ? `- Ramp length: ${config.rampLength}` : ''}
${config.rampAngle !== undefined ? `- Ramp angle: ${config.rampAngle}` : ''}
${config.adjustableAngle !== undefined ? `- Adjustable angle: ${config.adjustableAngle}` : ''}
${config.loadWeight !== undefined ? `- Load weight: ${config.loadWeight}` : ''}
${config.loadType ? `- Load type: ${config.loadType}` : ''}
${config.frictionLevel ? `- Friction level: ${config.frictionLevel}` : ''}
${config.theme ? `- Theme: ${config.theme}` : ''}
${config.showMA !== undefined ? `- Show mechanical advantage: ${config.showMA}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. rampAngle must be between 5 and 60 degrees
2. rampLength must be between 5 and 15 units
3. loadWeight must be between 1 and 10 units
4. pushForce, if provided, must be between 0 and 100
5. Description should be 1-2 sentences, grade-appropriate
6. Title should be engaging and action-oriented

EDUCATIONAL PRINCIPLES:
1. Start with concrete, familiar examples (playground, toys)
2. Build from simple (K-1) to complex (4-5)
3. Use real-world connections (wheelchair ramps, loading docks)
4. Encourage experimentation - "What happens if...?"
5. Provide clear visual feedback for physics concepts

Return a complete Ramp Lab configuration appropriate for the grade level.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: rampLabSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Ramp Lab data returned from Gemini API');
  }

  // Validation: ensure rampLength is reasonable
  if (!data.rampLength || data.rampLength < 5 || data.rampLength > 15) {
    console.warn('Invalid rampLength. Setting default.');
    data.rampLength = 10;
  }

  // Validation: ensure rampAngle is within bounds
  if (data.rampAngle < 5 || data.rampAngle > 60) {
    console.warn('Invalid rampAngle. Setting to 30.');
    data.rampAngle = 30;
  }

  // Validation: ensure loadWeight is reasonable
  if (!data.loadWeight || data.loadWeight < 1 || data.loadWeight > 10) {
    console.warn('Invalid loadWeight. Setting default.');
    data.loadWeight = 5;
  }

  // Validation: ensure loadType is valid
  const validLoadTypes: LoadType[] = ['box', 'barrel', 'wheel', 'custom'];
  if (!validLoadTypes.includes(data.loadType)) {
    console.warn('Invalid loadType. Setting to box.');
    data.loadType = 'box';
  }

  // Validation: ensure frictionLevel is valid
  const validFrictionLevels: FrictionLevel[] = ['none', 'low', 'medium', 'high'];
  if (!validFrictionLevels.includes(data.frictionLevel)) {
    console.warn('Invalid frictionLevel. Setting to medium.');
    data.frictionLevel = 'medium';
  }

  // Validation: ensure theme is valid
  const validThemes: RampTheme[] = ['loading_dock', 'dump_truck', 'skateboard', 'generic'];
  if (!validThemes.includes(data.theme)) {
    console.warn('Invalid theme. Setting to generic.');
    data.theme = 'generic';
  }

  // Apply config overrides
  if (config) {
    if (config.rampLength) data.rampLength = config.rampLength;
    if (config.rampAngle !== undefined) data.rampAngle = config.rampAngle;
    if (config.adjustableAngle !== undefined) data.adjustableAngle = config.adjustableAngle;
    if (config.loadWeight !== undefined) data.loadWeight = config.loadWeight;
    if (config.loadType) data.loadType = config.loadType;
    if (config.showMeasurements !== undefined) data.showMeasurements = config.showMeasurements;
    if (config.frictionLevel) data.frictionLevel = config.frictionLevel;
    if (config.theme) data.theme = config.theme;
    if (config.showForceArrows !== undefined) data.showForceArrows = config.showForceArrows;
    if (config.showMA !== undefined) data.showMA = config.showMA;
    if (config.allowPush !== undefined) data.allowPush = config.allowPush;
    if (config.pushForce !== undefined) data.pushForce = config.pushForce;
    if (config.customLoadIcon) data.customLoadIcon = config.customLoadIcon;
    if (config.customLoadLabel) data.customLoadLabel = config.customLoadLabel;
  }

  // Set sensible defaults for optional fields
  if (data.showForceArrows === undefined) data.showForceArrows = false;
  if (data.showMA === undefined) data.showMA = false;
  if (data.allowPush === undefined) data.allowPush = true;
  if (data.pushForce === undefined) data.pushForce = 0;

  return data;
};
