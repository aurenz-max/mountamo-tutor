import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  BlueprintCanvasData,
} from '../../primitives/visual-primitives/engineering/BlueprintCanvas';

// Re-export for convenience if needed elsewhere
export type { BlueprintCanvasData };

/**
 * Schema for Blueprint Canvas Data
 */
const blueprintCanvasSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the blueprint activity (e.g., 'Design Your Dream House', 'Create a Classroom Floor Plan')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining the task and what students will learn. Use age-appropriate language."
    },
    gridSize: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "Canvas dimensions as [rows, cols]. K-1: [10,10], grades 2-3: [15,15], grades 4-5: [20,20]"
    },
    gridScale: {
      type: Type.NUMBER,
      description: "Units per grid square (e.g., 1 = 1 meter, 0.5 = 0.5 meters). K-1: 1, grades 2-3: 1, grades 4-5: 0.5"
    },
    showGrid: {
      type: Type.BOOLEAN,
      description: "Display grid lines. Always true for beginners to help alignment."
    },
    snapToGrid: {
      type: Type.BOOLEAN,
      description: "Constrain drawing to grid intersections. True for K-3, optional for 4-5."
    },
    viewType: {
      type: Type.STRING,
      enum: ["plan", "elevation", "section"],
      description: "Type of view. 'plan' (top-down floor plan) for K-3, can introduce 'elevation' (side view) for grades 4-5."
    },
    targetRoomCount: {
      type: Type.NUMBER,
      description: "Expected number of rooms (optional). K-1: 2-3, grades 2-3: 3-5, grades 4-5: 5-7. Use 0 or omit for open-ended.",
      nullable: true
    },
    showMeasurements: {
      type: Type.BOOLEAN,
      description: "Show dimension labels. False for K-1, true for grades 2+."
    },
    theme: {
      type: Type.STRING,
      enum: ["blueprint", "technical", "sketch"],
      description: "Visual style. 'sketch' for K-1 (playful), 'blueprint' for 2-3 (classic blue), 'technical' for 4-5 (professional)."
    }
  },
  required: ["title", "description", "gridSize", "gridScale", "showGrid", "snapToGrid", "viewType", "showMeasurements", "theme"]
};

/**
 * Generate Blueprint Canvas data for visualization
 *
 * Creates blueprint drawing activities appropriate for K-5 engineering education:
 * - K-1: Bird's eye view concept, simple shapes
 * - 1-2: Drawing simple floor plans with rooms
 * - 2-3: Adding measurements and dimensions
 * - 3-4: Multiple view correspondence (plan vs elevation)
 * - 4-5: Scale drawings and technical precision
 *
 * @param topic - The engineering or design topic to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns BlueprintCanvasData with complete configuration
 */
export const generateBlueprintCanvas = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<BlueprintCanvasData>
): Promise<BlueprintCanvasData> => {
  const prompt = `
Create an educational Blueprint Canvas activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - BLUEPRINT CANVAS:
Blueprint Canvas teaches technical drawing and spatial reasoning through hands-on design:
1. GRID - Visual guide for alignment and measurement
2. PLAN VIEW - Top-down view (bird's eye) showing layout
3. ELEVATION VIEW - Side view showing height and features
4. SCALE - Relationship between drawing units and real measurements
5. DIMENSIONS - Measurements showing size and distance
6. ROOMS/SPACES - Defined areas with specific purposes

KEY ENGINEERING PRINCIPLES:
- Technical drawings communicate designs before building
- Grids help maintain proportions and alignment
- Different views (plan, elevation, section) show different information
- Scale allows large objects to be represented on paper
- Measurements ensure accuracy and buildability
- Walls define spaces and provide structure

GRADE-LEVEL GUIDELINES:

KINDERGARTEN (ages 5-6):
- Concept: Bird's eye view - looking down from above
- Challenge: Draw simple shapes to represent rooms
- gridSize: [10, 10] (simple grid)
- gridScale: 1 (one unit = easy to understand)
- viewType: 'plan' (only top-down view)
- targetRoomCount: 2 (just 2 simple spaces like bedroom and kitchen)
- showGrid: true (helps alignment)
- snapToGrid: true (makes drawing easier)
- showMeasurements: false (too advanced)
- theme: 'sketch' (playful, less formal)
- Language: "Draw your house from above, like a bird sees it! Can you draw a bedroom and a kitchen?"

KINDERGARTEN - GRADE 1 (ages 5-7):
- Concept: Simple floor plans with walls and doors
- Challenge: Draw a basic house layout with labeled rooms
- gridSize: [12, 12]
- gridScale: 1
- viewType: 'plan'
- targetRoomCount: 2-3 (bedroom, kitchen, bathroom)
- showGrid: true
- snapToGrid: true
- showMeasurements: false
- theme: 'sketch'
- Language: "Design a simple house! Draw walls to make rooms. Don't forget a door to get in!"

GRADES 1-2 (ages 6-8):
- Concept: Drawing floor plans with multiple rooms and furniture
- Challenge: Create a house with specific rooms
- gridSize: [15, 15]
- gridScale: 1
- viewType: 'plan'
- targetRoomCount: 3-4 (bedroom, kitchen, bathroom, living room)
- showGrid: true
- snapToGrid: true
- showMeasurements: true (introduce measurements)
- theme: 'blueprint' (classic blue technical look)
- Language: "Design a floor plan with labeled rooms. Use the grid to keep your walls straight!"

GRADES 2-3 (ages 7-9):
- Concept: Adding measurements and understanding scale
- Challenge: Create detailed floor plan with dimensions
- gridSize: [15, 15]
- gridScale: 1 (1 grid unit = 1 meter)
- viewType: 'plan'
- targetRoomCount: 4-5 (multiple rooms with purpose)
- showGrid: true
- snapToGrid: true
- showMeasurements: true (emphasize dimensions)
- theme: 'blueprint'
- Language: "Create a blueprint with measurements! Each grid square equals 1 meter. Label room sizes."

GRADES 3-4 (ages 8-10):
- Concept: Multiple views - introducing elevation
- Challenge: Draw plan OR elevation view
- gridSize: [18, 18]
- gridScale: 1
- viewType: 'plan' or 'elevation' (can specify in topic)
- targetRoomCount: 5-6 (detailed layout)
- showGrid: true
- snapToGrid: true (but can be disabled)
- showMeasurements: true
- theme: 'blueprint' or 'technical'
- Language: "Create a technical drawing with accurate measurements. Think like an architect!"

GRADES 4-5 (ages 9-11):
- Concept: Scale drawings and technical precision
- Challenge: Create scaled blueprint with detailed dimensions
- gridSize: [20, 20]
- gridScale: 0.5 or 1 (can introduce smaller scale)
- viewType: 'plan' or 'elevation' (both views available)
- targetRoomCount: 6-7 (complex design)
- showGrid: true
- snapToGrid: false (allow precision placement)
- showMeasurements: true
- theme: 'technical' (professional engineering style)
- Language: "Design a professional blueprint to scale. Include all dimensions and use proper architectural symbols."

ACTIVITY TYPE GUIDELINES:

For HOUSES/BUILDINGS:
- K-1: Simple house with 2-3 rooms (bedroom, kitchen)
- 2-3: Family home with 4-5 rooms (add bathroom, living room)
- 4-5: Multi-story building or complex layout (stairs, hallways)
- targetRoomCount: 2 (K-1), 3-4 (2-3), 5-7 (4-5)

For CLASSROOMS/SCHOOLS:
- K-1: One classroom with desk area and reading corner
- 2-3: Classroom with multiple learning centers
- 4-5: School wing with multiple classrooms and hallways
- targetRoomCount: 2 (K-1), 3-4 (2-3), 5-6 (4-5)

For PLAYGROUNDS/OUTDOOR SPACES:
- K-1: Simple play area with 2-3 zones (swings, sandbox)
- 2-3: Playground with equipment layout (slide, climber, field)
- 4-5: Complete park design with paths and amenities
- targetRoomCount: 2-3 (K-1), 4-5 (2-3), 6-7 (4-5)

For CITY PLANNING:
- 2-3: Simple neighborhood block with houses and street
- 4-5: City block with buildings, roads, and green space
- targetRoomCount: 4-5 (2-3), 6-8 (4-5)

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.gridSize ? `- Grid size: ${config.gridSize}` : ''}
${config.gridScale ? `- Grid scale: ${config.gridScale}` : ''}
${config.viewType ? `- View type: ${config.viewType}` : ''}
${config.targetRoomCount ? `- Target rooms: ${config.targetRoomCount}` : ''}
${config.showMeasurements !== undefined ? `- Show measurements: ${config.showMeasurements}` : ''}
${config.theme ? `- Theme: ${config.theme}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. gridSize must be [rows, cols] with values between 8 and 25
2. gridScale must be a positive number (typically 0.5, 1, or 2)
3. viewType must be 'plan', 'elevation', or 'section'
4. targetRoomCount should match grade level complexity
5. theme should match student age (sketch for young, technical for older)
6. showMeasurements should be false for K-1, true for grades 2+

Return a complete Blueprint Canvas configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: blueprintCanvasSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Blueprint Canvas data returned from Gemini API');
  }

  // Validation: ensure gridSize is valid
  if (!data.gridSize || !Array.isArray(data.gridSize) || data.gridSize.length !== 2) {
    console.warn('Invalid gridSize. Setting default.');
    data.gridSize = [15, 15];
  }
  data.gridSize = data.gridSize.map((val: number) => Math.max(8, Math.min(25, val)));

  // Validation: ensure gridScale is positive
  if (!data.gridScale || data.gridScale <= 0) {
    console.warn('Invalid gridScale. Setting default.');
    data.gridScale = 1;
  }

  // Validation: ensure viewType is valid
  if (!['plan', 'elevation', 'section'].includes(data.viewType)) {
    console.warn('Invalid viewType. Setting default.');
    data.viewType = 'plan';
  }

  // Validation: ensure theme is valid
  if (!['blueprint', 'technical', 'sketch'].includes(data.theme)) {
    console.warn('Invalid theme. Setting default.');
    data.theme = 'blueprint';
  }

  // Validation: ensure targetRoomCount is reasonable (if provided)
  if (data.targetRoomCount !== undefined && data.targetRoomCount !== null) {
    data.targetRoomCount = Math.max(0, Math.min(10, data.targetRoomCount));
  }

  // Apply config overrides
  if (config) {
    if (config.gridSize) data.gridSize = config.gridSize;
    if (config.gridScale !== undefined) data.gridScale = config.gridScale;
    if (config.showGrid !== undefined) data.showGrid = config.showGrid;
    if (config.snapToGrid !== undefined) data.snapToGrid = config.snapToGrid;
    if (config.viewType) data.viewType = config.viewType;
    if (config.targetRoomCount !== undefined) data.targetRoomCount = config.targetRoomCount;
    if (config.showMeasurements !== undefined) data.showMeasurements = config.showMeasurements;
    if (config.theme) data.theme = config.theme;
  }

  // Set sensible defaults for optional fields
  if (data.showGrid === undefined) data.showGrid = true;
  if (data.snapToGrid === undefined) data.snapToGrid = true;
  if (data.showMeasurements === undefined) data.showMeasurements = false;

  return data;
};
