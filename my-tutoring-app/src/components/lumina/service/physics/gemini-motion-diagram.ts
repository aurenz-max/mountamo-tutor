import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  MotionDiagramData,
  PositionMarker,
  MotionType,
} from '../../primitives/visual-primitives/physics/MotionDiagram';

// Re-export for convenience
export type { MotionDiagramData, PositionMarker, MotionType };

/**
 * Schema for Position Marker
 */
const positionMarkerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    x: {
      type: Type.NUMBER,
      description: "X position in canvas coordinates (0-800)"
    },
    y: {
      type: Type.NUMBER,
      description: "Y position in canvas coordinates (0-400)"
    },
    time: {
      type: Type.NUMBER,
      description: "Time at this position in seconds"
    },
    velocityX: {
      type: Type.NUMBER,
      description: "X component of velocity (optional, for vector display)",
      nullable: true
    },
    velocityY: {
      type: Type.NUMBER,
      description: "Y component of velocity (optional, for vector display)",
      nullable: true
    },
    accelerationX: {
      type: Type.NUMBER,
      description: "X component of acceleration (optional)",
      nullable: true
    },
    accelerationY: {
      type: Type.NUMBER,
      description: "Y component of acceleration (optional)",
      nullable: true
    }
  },
  required: ["x", "y", "time"]
};

/**
 * Schema for Motion Diagram Data
 */
const motionDiagramSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the motion diagram activity"
    },
    description: {
      type: Type.STRING,
      description: "Educational description using age-appropriate language"
    },
    motionType: {
      type: Type.STRING,
      enum: ["uniform", "accelerated", "projectile", "circular", "custom"],
      description: "Type of motion to visualize"
    },
    timeInterval: {
      type: Type.NUMBER,
      description: "Seconds between markers. Middle School: 1.0, High School: 0.5-1.0"
    },
    showVelocityVectors: {
      type: Type.BOOLEAN,
      description: "Display velocity arrows at each position"
    },
    showAccelerationVectors: {
      type: Type.BOOLEAN,
      description: "Display acceleration arrows. High School only."
    },
    showPath: {
      type: Type.BOOLEAN,
      description: "Draw trajectory line connecting markers"
    },
    vectorScale: {
      type: Type.NUMBER,
      description: "Size multiplier for vector arrows (0.5-2.0)"
    },
    markerCount: {
      type: Type.NUMBER,
      description: "Number of position markers to show (5-10)"
    },
    gridSize: {
      type: Type.NUMBER,
      description: "Grid spacing in pixels (20-50)"
    },
    positions: {
      type: Type.ARRAY,
      items: positionMarkerSchema,
      description: "Pre-generated motion path (optional for evaluation mode)",
      nullable: true
    },
    interactive: {
      type: Type.BOOLEAN,
      description: "Allow student to create/modify motion"
    },
    showGrid: {
      type: Type.BOOLEAN,
      description: "Display grid overlay"
    },
    showMeasurements: {
      type: Type.BOOLEAN,
      description: "Show distance measurements between markers"
    },
    targetMotionType: {
      type: Type.STRING,
      enum: ["uniform", "accelerated", "projectile", "circular"],
      description: "Motion type student should identify (evaluation mode)",
      nullable: true
    },
    targetVectorCount: {
      type: Type.NUMBER,
      description: "How many vectors student should place (evaluation mode)",
      nullable: true
    }
  },
  required: [
    "title", "description", "motionType", "timeInterval",
    "showVelocityVectors", "showAccelerationVectors", "showPath",
    "vectorScale", "markerCount", "gridSize", "interactive",
    "showGrid", "showMeasurements"
  ]
};

/**
 * Generate Motion Diagram data for visualization
 *
 * Creates interactive motion diagrams appropriate for Middle School - High School physics:
 * - Middle School: Introduction to motion, velocity concepts
 * - High School: Acceleration, projectile motion, circular motion
 * - AP Physics: Advanced kinematics analysis
 *
 * @param topic - The physics topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns MotionDiagramData with complete configuration
 */
export const generateMotionDiagram = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<MotionDiagramData>
): Promise<MotionDiagramData> => {
  const prompt = `
Create an educational Motion Diagram (Strobe Diagram) visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - MOTION DIAGRAMS FOR KINEMATICS:
A motion diagram shows the position of an object at equal time intervals, revealing velocity and acceleration patterns.
This is THE foundational representation for understanding motion qualitatively before equations.

KEY CONCEPTS (grade-appropriate):

MIDDLE SCHOOL (Grades 6-8):
"What is motion?"
- Focus: Objects change position over time
- Motion types: uniform (constant speed)
- Show velocity vectors only (no acceleration yet)
- Language: "How fast is it moving?", "Is it speeding up or slowing down?"
- Settings:
  - timeInterval: 1.0 (easier to count)
  - showVelocityVectors: true
  - showAccelerationVectors: false
  - showPath: true
  - markerCount: 5-6
  - interactive: true (let students create motion)
  - showMeasurements: true (measure distances)
- Examples: "Car moving at constant speed", "Walking at steady pace"

GRADE 9-10 (High School Physics):
"Understanding acceleration"
- Focus: Velocity changes over time = acceleration
- Motion types: uniform, accelerated (speeding up/slowing down)
- Show both velocity and acceleration vectors
- Language: "How is the velocity changing?", "What direction is the acceleration?"
- Settings:
  - timeInterval: 0.5-1.0
  - showVelocityVectors: true
  - showAccelerationVectors: true
  - showPath: true
  - markerCount: 6-8
  - vectorScale: 1.0
  - showGrid: true
- Examples: "Car braking to a stop", "Dropped ball falling", "Rocket launching"

GRADE 11-12 (AP Physics):
"Analyzing projectile and circular motion"
- Focus: 2D motion, changing direction
- Motion types: projectile, circular
- Full vector analysis with components
- Language: "What are the horizontal and vertical components?", "Is there centripetal acceleration?"
- Settings:
  - timeInterval: 0.5
  - showVelocityVectors: true
  - showAccelerationVectors: true
  - showPath: true
  - markerCount: 8-10
  - vectorScale: 0.8 (prevent overlap)
  - showMeasurements: true
  - targetMotionType: for evaluation
- Examples: "Basketball arc", "Satellite orbiting Earth", "Baseball thrown at angle"

MOTION TYPE GUIDANCE:

UNIFORM MOTION:
- Constant velocity, zero acceleration
- Equal spacing between markers
- All velocity vectors same length and direction
- Use for: Introduction to motion (MS), constant velocity (HS)

ACCELERATED MOTION (1D):
- Changing velocity, constant acceleration
- Increasing OR decreasing spacing between markers
- Velocity vectors grow/shrink uniformly
- All acceleration vectors same length and direction
- Use for: Speeding up, slowing down, free fall

PROJECTILE MOTION (2D):
- Parabolic path
- Horizontal velocity constant
- Vertical velocity changes (gravity)
- Acceleration vectors all point downward
- Use for: Throwing, launching, trajectories

CIRCULAR MOTION:
- Markers in circular path
- Velocity vectors tangent to circle (same length)
- Acceleration vectors point toward center
- Use for: Turning, orbits, rotational motion

CUSTOM MOTION:
- Student-created or special motion patterns
- Use for: Open exploration, comparing motions

EVALUATION MODE:
When targetMotionType is specified, this becomes an assessment:
- Show pre-generated positions
- Hide motion type
- Student must identify the type of motion
- Student may place vectors to demonstrate understanding

EXAMPLE SCENARIOS BY GRADE:

Grade 6-7:
- "A toy car moving across the floor at constant speed"
- "You walking to school at a steady pace"
- motionType: uniform, interactive: true, showVelocityVectors: true

Grade 8:
- "A bike slowing down to stop at a traffic light"
- "A skateboard rolling down a ramp"
- motionType: accelerated, showVelocityVectors: true, showAccelerationVectors: false

Grade 9-10:
- "A ball dropped from rest"
- "A car accelerating from 0 to 60 mph"
- motionType: accelerated, showAccelerationVectors: true

Grade 11-12:
- "A soccer ball kicked at an angle"
- "A satellite orbiting Earth"
- motionType: projectile or circular, full vector analysis

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.motionType ? `- Motion type: ${config.motionType}` : ''}
${config.interactive !== undefined ? `- Interactive: ${config.interactive}` : ''}
${config.targetMotionType ? `- Target for evaluation: ${config.targetMotionType}` : ''}
` : ''}

Return a complete Motion Diagram configuration appropriate for the grade level and topic.
If generating positions for evaluation mode, create realistic physics-based motion with proper velocity and acceleration vectors.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: motionDiagramSchema
    },
  });

  console.log('[Motion Diagram] Gemini API Response:', {
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
    console.error('[Motion Diagram] Parse Error:', parseError);
    throw new Error(`Failed to parse Gemini response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }

  if (!data) {
    throw new Error('No valid Motion Diagram data returned from Gemini API');
  }

  // Validation and defaults
  if (data.timeInterval === undefined) data.timeInterval = gradeLevel >= '9' ? 0.5 : 1.0;
  if (data.showVelocityVectors === undefined) data.showVelocityVectors = true;
  if (data.showAccelerationVectors === undefined) data.showAccelerationVectors = gradeLevel >= '9';
  if (data.showPath === undefined) data.showPath = true;
  if (data.vectorScale === undefined) data.vectorScale = 1.0;
  if (data.markerCount === undefined) data.markerCount = gradeLevel >= '11' ? 8 : gradeLevel >= '9' ? 6 : 5;
  if (data.gridSize === undefined) data.gridSize = 40;
  if (data.interactive === undefined) data.interactive = true;
  if (data.showGrid === undefined) data.showGrid = true;
  if (data.showMeasurements === undefined) data.showMeasurements = gradeLevel <= '8';

  // Apply config overrides
  if (config) {
    if (config.motionType) data.motionType = config.motionType;
    if (config.timeInterval !== undefined) data.timeInterval = config.timeInterval;
    if (config.showVelocityVectors !== undefined) data.showVelocityVectors = config.showVelocityVectors;
    if (config.showAccelerationVectors !== undefined) data.showAccelerationVectors = config.showAccelerationVectors;
    if (config.showPath !== undefined) data.showPath = config.showPath;
    if (config.vectorScale !== undefined) data.vectorScale = config.vectorScale;
    if (config.markerCount !== undefined) data.markerCount = config.markerCount;
    if (config.gridSize !== undefined) data.gridSize = config.gridSize;
    if (config.positions) data.positions = config.positions;
    if (config.interactive !== undefined) data.interactive = config.interactive;
    if (config.showGrid !== undefined) data.showGrid = config.showGrid;
    if (config.showMeasurements !== undefined) data.showMeasurements = config.showMeasurements;
    if (config.targetMotionType) data.targetMotionType = config.targetMotionType;
    if (config.targetVectorCount !== undefined) data.targetVectorCount = config.targetVectorCount;
  }

  return data;
};
