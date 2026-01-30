import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  ExcavatorArmSimulatorData,
  MaterialLayer,
  TerrainPoint,
  TargetZone,
  DiggingChallenge,
} from '../../primitives/visual-primitives/engineering/ExcavatorArmSimulator';

// Re-export for convenience if needed elsewhere
export type { ExcavatorArmSimulatorData, MaterialLayer, TerrainPoint, TargetZone, DiggingChallenge };

/**
 * Schema for Material Layer
 */
const materialLayerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      description: "Material type: 'topsoil', 'clay', 'sand', 'gravel', 'rock'"
    },
    color: {
      type: Type.STRING,
      description: "Hex color code for the layer (e.g., '#8B7355' for dirt, '#CD853F' for clay)"
    },
    depth: {
      type: Type.NUMBER,
      description: "Depth from ground level in pixels (0-300)"
    },
    hardness: {
      type: Type.NUMBER,
      description: "Hardness rating (1-10). 1=easy to dig, 10=very hard. Topsoil: 1-2, Clay: 3-4, Sand: 2-3, Rock: 8-10"
    }
  },
  required: ["type", "color", "depth", "hardness"]
};

/**
 * Schema for Terrain Point
 */
const terrainPointSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    x: {
      type: Type.NUMBER,
      description: "X position (0-800)"
    },
    height: {
      type: Type.NUMBER,
      description: "Height of terrain at this x (0-50)"
    }
  },
  required: ["x", "height"]
};

/**
 * Schema for Target Zone
 */
const targetZoneSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    x: {
      type: Type.NUMBER,
      description: "Center X position of target zone (typically 600-750)"
    },
    y: {
      type: Type.NUMBER,
      description: "Center Y position of target zone (typically 400-500)"
    },
    width: {
      type: Type.NUMBER,
      description: "Width of target zone (typically 80-120)"
    },
    height: {
      type: Type.NUMBER,
      description: "Height of target zone (typically 60-100)"
    },
    label: {
      type: Type.STRING,
      description: "Display label (e.g., 'Dump Truck', 'Pile Here')"
    }
  },
  required: ["x", "y", "width", "height", "label"]
};

/**
 * Schema for Digging Challenge
 */
const diggingChallengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    description: {
      type: Type.STRING,
      description: "What needs to be excavated (age-appropriate language)"
    },
    targetX: {
      type: Type.NUMBER,
      description: "X location to dig (200-600)"
    },
    targetY: {
      type: Type.NUMBER,
      description: "Y location to dig (depth, typically 520-580)"
    },
    targetAmount: {
      type: Type.NUMBER,
      description: "Amount of material to excavate (units, K: 5-10, 1-2: 10-20, 3-5: 20-40)"
    },
    materialType: {
      type: Type.STRING,
      description: "Specific material type (optional)",
      nullable: true
    }
  },
  required: ["description", "targetX", "targetY", "targetAmount"]
};

/**
 * Schema for Excavator Arm Simulator Data
 */
const excavatorArmSimulatorSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the excavator activity (e.g., 'Dig and Move!', 'Excavator Challenge')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining the activity and what students will learn. Use age-appropriate language."
    },
    boomLength: {
      type: Type.NUMBER,
      description: "Length of boom segment in pixels (K: 60-80, grades 1-2: 80-100, grades 3-5: 100-120)"
    },
    stickLength: {
      type: Type.NUMBER,
      description: "Length of stick segment in pixels (K: 40-60, grades 1-2: 60-80, grades 3-5: 80-100)"
    },
    bucketSize: {
      type: Type.NUMBER,
      description: "Capacity of bucket in units (K: 5-8, grades 1-2: 8-12, grades 3-5: 10-15)"
    },
    jointControl: {
      type: Type.STRING,
      enum: ["sliders", "buttons", "drag"],
      description: "Control method. 'sliders' for K-3, 'buttons' for K-1, 'drag' for 4-5 (advanced)"
    },
    showAngles: {
      type: Type.BOOLEAN,
      description: "Display joint angles. False for K, true for grades 1+"
    },
    showReach: {
      type: Type.BOOLEAN,
      description: "Display reach envelope. False for K-2, true for grades 3+"
    },
    terrainProfile: {
      type: Type.ARRAY,
      items: terrainPointSchema,
      description: "Ground height profile. Include 5-10 points for varied terrain."
    },
    materialLayers: {
      type: Type.ARRAY,
      items: materialLayerSchema,
      description: "Soil layers. Include 2-4 layers (topsoil, subsoil, bedrock, etc.)"
    },
    targetZone: {
      ...targetZoneSchema,
      nullable: true,
      description: "Dump target location (optional, for dump challenges)"
    },
    challenge: {
      ...diggingChallengeSchema,
      nullable: true,
      description: "Specific excavation task (optional)"
    },
    minBoomAngle: {
      type: Type.NUMBER,
      description: "Minimum boom angle in degrees (typically -30 to 0)"
    },
    maxBoomAngle: {
      type: Type.NUMBER,
      description: "Maximum boom angle in degrees (typically 60 to 90)"
    },
    minStickAngle: {
      type: Type.NUMBER,
      description: "Minimum stick angle in degrees (typically -120 to -90)"
    },
    maxStickAngle: {
      type: Type.NUMBER,
      description: "Maximum stick angle in degrees (typically 0 to 30)"
    },
    minBucketAngle: {
      type: Type.NUMBER,
      description: "Minimum bucket angle in degrees (typically -90 to -60)"
    },
    maxBucketAngle: {
      type: Type.NUMBER,
      description: "Maximum bucket angle in degrees (typically 60 to 90)"
    },
    theme: {
      type: Type.STRING,
      enum: ["realistic", "cartoon", "blueprint"],
      description: "Visual theme. 'cartoon' for K-2, 'realistic' for 3-5, 'blueprint' for advanced"
    },
    excavatorColor: {
      type: Type.STRING,
      description: "Color of the excavator arm (e.g., '#F59E0B' amber, '#EAB308' yellow)"
    }
  },
  required: [
    "title", "description", "boomLength", "stickLength", "bucketSize",
    "jointControl", "showAngles", "showReach", "terrainProfile", "materialLayers",
    "minBoomAngle", "maxBoomAngle", "minStickAngle", "maxStickAngle",
    "minBucketAngle", "maxBucketAngle", "theme", "excavatorColor"
  ]
};

/**
 * Generate Excavator Arm Simulator data for visualization
 *
 * Creates excavator arm simulations appropriate for K-5 engineering education:
 * - K-1: Cause and effect with joints, basic digging
 * - 1-2: Reach and range exploration
 * - 2-3: Sequencing dig operations
 * - 3-4: Joint angle coordination
 * - 4-5: Reach envelope and efficiency
 *
 * @param topic - The engineering topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns ExcavatorArmSimulatorData with complete configuration
 */
export const generateExcavatorArmSimulator = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<ExcavatorArmSimulatorData>
): Promise<ExcavatorArmSimulatorData> => {
  const prompt = `
Create an educational Excavator Arm Simulator visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - EXCAVATOR ARM ENGINEERING:
The excavator arm is a multi-jointed mechanical system with three main components:
1. BOOM - The main arm extending from the base (like your upper arm)
2. STICK - The middle segment (like your forearm)
3. BUCKET - The scoop at the end (like your hand)

Each joint can rotate independently, creating a complex system that requires coordination.

KEY ENGINEERING PRINCIPLES:
- Each joint controls rotation, affecting the position of all segments beyond it
- The boom angle affects the overall height and reach
- The stick angle extends or retracts the arm
- The bucket angle controls digging and dumping
- All three joints must work together to position the bucket precisely
- Reach envelope = the area the bucket can reach from a fixed base

REAL-WORLD CONNECTIONS:
- Construction excavators dig foundations for buildings
- Backhoes excavate trenches for pipes and cables
- Mining equipment moves earth and ore
- Robotic arms in factories use similar joint systems
- Hydraulic systems power the joints with fluid pressure

GRADE-LEVEL GUIDELINES:

KINDERGARTEN (ages 5-6):
- Concept: Cause and effect - "If I move this slider, the arm moves!"
- Challenge: Simple exploration - dig up some dirt and dump it
- Arm config: Short boom (60-80px), short stick (40-60px), large bucket (8 units)
- Controls: 'buttons' (easier than sliders for young kids)
- Angles: Wide ranges for exploration (boom: -20 to 80, stick: -100 to 20, bucket: -80 to 80)
- showAngles: false (numbers are abstract)
- showReach: false (too advanced)
- Terrain: Flat or gently sloping
- Materials: 1-2 simple layers (topsoil, clay)
- Challenge: "Dig up 5 scoops of dirt!" (targetAmount: 5)
- Theme: 'cartoon' (bright, friendly)
- Language: "Move the excavator arm to dig! Can you scoop up the dirt and dump it?"

KINDERGARTEN - GRADE 1 (ages 5-7):
- Concept: Joint exploration - each slider controls a different part
- Challenge: Dig and move material to a target
- Arm config: Boom 70-90px, stick 50-70px, bucket 8-10 units
- Controls: 'sliders' (introduce slider control)
- Angles: boom: -30 to 80, stick: -110 to 25, bucket: -85 to 85
- showAngles: false
- showReach: false
- Terrain: Slightly varied terrain (3-5 terrain points)
- Materials: 2 layers (topsoil, subsoil)
- Challenge: "Dig 8 scoops and dump them in the truck!" with targetZone
- TargetZone: { x: 650, y: 450, width: 100, height: 80, label: "Dump Truck" }
- Theme: 'cartoon'
- Language: "Control each part of the arm to dig dirt and fill the truck!"

GRADES 1-2 (ages 6-8):
- Concept: Reach and range - where can the bucket go?
- Challenge: Dig from specific locations, understand reachable areas
- Arm config: Boom 80-100px, stick 60-80px, bucket 10 units
- Controls: 'sliders'
- Angles: boom: -30 to 85, stick: -115 to 25, bucket: -85 to 85
- showAngles: true (introduce angle numbers)
- showReach: false
- Terrain: Varied terrain (5-7 points)
- Materials: 2-3 layers (topsoil, clay, sand)
- Challenge: "Dig 12 scoops from the sandy area!" (targetX near sandy layer)
- TargetZone: { x: 700, y: 420, width: 110, height: 90, label: "Pile Here" }
- Theme: 'realistic'
- Language: "Use the boom and stick to reach different areas. Watch the angles change!"

GRADES 2-3 (ages 7-9):
- Concept: Sequencing operations - dig, lift, move, dump in order
- Challenge: Complete multi-step excavation tasks
- Arm config: Boom 90-110px, stick 70-90px, bucket 12 units
- Controls: 'sliders'
- Angles: boom: -30 to 90, stick: -120 to 30, bucket: -90 to 90
- showAngles: true
- showReach: true (introduce reach envelope visualization)
- Terrain: Complex terrain (7-10 points with hills and valleys)
- Materials: 3 layers (topsoil, clay, gravel) with varied hardness
- Challenge: "Dig 18 scoops and move them to the pile. Plan your moves!"
- TargetZone: { x: 680, y: 400, width: 100, height: 100, label: "Material Pile" }
- Theme: 'realistic'
- Language: "Sequence your movements: dig, lift, move to the pile, dump. The reach circle shows where you can go!"

GRADES 3-4 (ages 8-10):
- Concept: Joint angle coordination - all three joints work together
- Challenge: Precise positioning and efficiency (fewer scoops to dig more)
- Arm config: Boom 100-120px, stick 80-100px, bucket 12-14 units
- Controls: 'sliders'
- Angles: boom: -30 to 90, stick: -120 to 30, bucket: -90 to 90
- showAngles: true
- showReach: true
- Terrain: Complex terrain with obstacles (8-10 points)
- Materials: 3-4 layers including harder materials (rock layer with hardness 7-8)
- Challenge: "Dig 25 units efficiently. Harder materials take more work!"
- TargetZone: { x: 660, y: 380, width: 90, height: 90, label: "Storage" }
- Theme: 'realistic'
- Language: "Coordinate all three joints to position the bucket precisely. Watch for hard layers!"

GRADES 4-5 (ages 9-11):
- Concept: Reach envelope and efficiency - optimize movements
- Challenge: Advanced excavation with efficiency scoring
- Arm config: Boom 110-120px, stick 90-100px, bucket 14-15 units
- Controls: 'sliders' (or 'drag' for advanced students)
- Angles: Full range (boom: -30 to 90, stick: -120 to 30, bucket: -90 to 90)
- showAngles: true
- showReach: true
- Terrain: Realistic varied terrain (10+ points)
- Materials: 4 layers with realistic hardness (topsoil: 1-2, clay: 4-5, gravel: 5-6, bedrock: 9-10)
- Challenge: "Excavate 35 units with minimum operations. Plan your approach!"
- TargetZone: { x: 650, y: 360, width: 80, height: 80, label: "Target Site" }
- Theme: 'realistic' or 'blueprint'
- Language: "Optimize your excavation strategy. The reach envelope shows your workspace. Minimize wasted movement!"

MATERIAL LAYER EXAMPLES:
- Topsoil: { type: "topsoil", color: "#8B7355", depth: 0, hardness: 1 }
- Clay: { type: "clay", color: "#CD853F", depth: 50, hardness: 4 }
- Sand: { type: "sand", color: "#F4A460", depth: 80, hardness: 2 }
- Gravel: { type: "gravel", color: "#A9A9A9", depth: 120, hardness: 6 }
- Rock: { type: "rock", color: "#696969", depth: 150, hardness: 9 }

TERRAIN PROFILE EXAMPLES:
Flat terrain (K-1):
- [{ x: 0, height: 0 }, { x: 200, height: 0 }, { x: 400, height: 0 }, { x: 600, height: 0 }, { x: 800, height: 0 }]

Gentle slopes (1-2):
- [{ x: 0, height: 5 }, { x: 200, height: 10 }, { x: 400, height: 15 }, { x: 600, height: 10 }, { x: 800, height: 5 }]

Complex terrain (3-5):
- [{ x: 0, height: 10 }, { x: 100, height: 20 }, { x: 200, height: 15 }, { x: 300, height: 25 }, { x: 400, height: 30 }, { x: 500, height: 20 }, { x: 600, height: 10 }, { x: 700, height: 15 }, { x: 800, height: 5 }]

COLOR SUGGESTIONS:
- Excavator: '#F59E0B' (amber), '#EAB308' (yellow), '#F97316' (orange)
- For cartoon theme: Brighter colors like '#FBBF24' (bright yellow)
- For realistic theme: Construction equipment colors like '#F59E0B' (amber)
- For blueprint theme: '#3B82F6' (blue) with technical appearance

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.boomLength ? `- Boom length: ${config.boomLength}` : ''}
${config.stickLength ? `- Stick length: ${config.stickLength}` : ''}
${config.bucketSize ? `- Bucket size: ${config.bucketSize}` : ''}
${config.jointControl ? `- Joint control: ${config.jointControl}` : ''}
${config.showAngles !== undefined ? `- Show angles: ${config.showAngles}` : ''}
${config.showReach !== undefined ? `- Show reach: ${config.showReach}` : ''}
${config.theme ? `- Theme: ${config.theme}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. boomLength and stickLength must create reachable workspace (boom + stick should be 140-220px total)
2. Terrain points should span the canvas width (0-800)
3. Material layers should be ordered by depth (shallow to deep)
4. TargetZone should be reachable by the arm
5. Challenge targetAmount should be appropriate for grade level and bucket size
6. Angle ranges should allow functional movement (not too restrictive)
7. Include at least 2 material layers for educational value

Return a complete Excavator Arm Simulator configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: excavatorArmSimulatorSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Excavator Arm Simulator data returned from Gemini API');
  }

  // Validation: ensure arm segments are reasonable
  if (!data.boomLength || data.boomLength < 60 || data.boomLength > 150) {
    console.warn('Invalid boomLength. Setting default.');
    data.boomLength = 100;
  }

  if (!data.stickLength || data.stickLength < 40 || data.stickLength > 120) {
    console.warn('Invalid stickLength. Setting default.');
    data.stickLength = 80;
  }

  if (!data.bucketSize || data.bucketSize < 5 || data.bucketSize > 20) {
    console.warn('Invalid bucketSize. Setting default.');
    data.bucketSize = 10;
  }

  // Validation: ensure terrainProfile exists and has points
  if (!data.terrainProfile || data.terrainProfile.length === 0) {
    console.warn('No terrainProfile provided. Setting defaults.');
    data.terrainProfile = [
      { x: 0, height: 10 },
      { x: 200, height: 15 },
      { x: 400, height: 20 },
      { x: 600, height: 15 },
      { x: 800, height: 10 },
    ];
  }

  // Validation: ensure materialLayers exists
  if (!data.materialLayers || data.materialLayers.length === 0) {
    console.warn('No materialLayers provided. Setting defaults.');
    data.materialLayers = [
      { type: 'topsoil', color: '#8B7355', depth: 0, hardness: 1 },
      { type: 'clay', color: '#CD853F', depth: 50, hardness: 4 },
    ];
  }

  // Validation: ensure angle ranges are valid
  if (data.minBoomAngle === undefined || data.maxBoomAngle === undefined) {
    data.minBoomAngle = -30;
    data.maxBoomAngle = 90;
  }

  if (data.minStickAngle === undefined || data.maxStickAngle === undefined) {
    data.minStickAngle = -120;
    data.maxStickAngle = 30;
  }

  if (data.minBucketAngle === undefined || data.maxBucketAngle === undefined) {
    data.minBucketAngle = -90;
    data.maxBucketAngle = 90;
  }

  // Validation: ensure theme is valid
  if (!['realistic', 'cartoon', 'blueprint'].includes(data.theme)) {
    data.theme = 'realistic';
  }

  // Validation: ensure excavatorColor is set
  if (!data.excavatorColor) {
    data.excavatorColor = '#F59E0B';
  }

  // Validation: ensure jointControl is valid
  if (!['sliders', 'buttons', 'drag'].includes(data.jointControl)) {
    data.jointControl = 'sliders';
  }

  // Apply config overrides
  if (config) {
    if (config.boomLength !== undefined) data.boomLength = config.boomLength;
    if (config.stickLength !== undefined) data.stickLength = config.stickLength;
    if (config.bucketSize !== undefined) data.bucketSize = config.bucketSize;
    if (config.jointControl) data.jointControl = config.jointControl;
    if (config.showAngles !== undefined) data.showAngles = config.showAngles;
    if (config.showReach !== undefined) data.showReach = config.showReach;
    if (config.terrainProfile) data.terrainProfile = config.terrainProfile;
    if (config.materialLayers) data.materialLayers = config.materialLayers;
    if (config.targetZone) data.targetZone = config.targetZone;
    if (config.challenge) data.challenge = config.challenge;
    if (config.minBoomAngle !== undefined) data.minBoomAngle = config.minBoomAngle;
    if (config.maxBoomAngle !== undefined) data.maxBoomAngle = config.maxBoomAngle;
    if (config.minStickAngle !== undefined) data.minStickAngle = config.minStickAngle;
    if (config.maxStickAngle !== undefined) data.maxStickAngle = config.maxStickAngle;
    if (config.minBucketAngle !== undefined) data.minBucketAngle = config.minBucketAngle;
    if (config.maxBucketAngle !== undefined) data.maxBucketAngle = config.maxBucketAngle;
    if (config.theme) data.theme = config.theme;
    if (config.excavatorColor) data.excavatorColor = config.excavatorColor;
  }

  // Set sensible defaults for optional fields
  if (data.showAngles === undefined) data.showAngles = true;
  if (data.showReach === undefined) data.showReach = false;

  return data;
};
