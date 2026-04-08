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
      description: "Engaging title for the blueprint activity (e.g., 'Design Your Dream House', 'Draw an Excavator Arm', 'Map a Playground')"
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
      description: "Type of view. 'plan' (top-down) for layouts/floor plans, 'elevation' (side view) for machines/buildings, 'section' (cross-section) for internal structure."
    },
    targetElementCount: {
      type: Type.NUMBER,
      description: "Expected number of distinct elements to draw. For floor plans: rooms (2-7). For machines: components (3-6). For maps: zones/areas (3-8). Use 0 or omit for open-ended.",
      nullable: true
    },
    elementLabel: {
      type: Type.STRING,
      description: "What to call the countable elements (e.g., 'rooms' for buildings, 'components' for machines, 'zones' for playgrounds, 'parts' for vehicles, 'sections' for bridges). Must be a plural noun."
    },
    challengeText: {
      type: Type.STRING,
      description: "A short, specific challenge prompt for the student (e.g., 'Draw a floor plan with at least 5 rooms', 'Draw the boom, stick, and bucket of an excavator arm', 'Map out a playground with 4 play zones'). Should reference the targetElementCount and elementLabel."
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
  required: ["title", "description", "gridSize", "gridScale", "showGrid", "snapToGrid", "viewType", "elementLabel", "challengeText", "showMeasurements", "theme"]
};

/**
 * Generate Blueprint Canvas data for visualization
 *
 * Creates blueprint drawing activities appropriate for K-5 engineering education.
 * The canvas is general-purpose: it can be used for floor plans, machine diagrams,
 * playground maps, vehicle schematics, bridge cross-sections, etc. Gemini decides
 * the appropriate element type, labels, and challenge based on the topic.
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
Blueprint Canvas is a general-purpose grid-based drawing surface for technical drawings.
It can be used for ANY topic that benefits from spatial/technical drawing:
- Floor plans and building layouts (rooms, hallways, doors)
- Machine diagrams and schematics (components, joints, mechanisms)
- Playground/park maps (zones, equipment areas, paths)
- Vehicle designs (parts, sections, features)
- Bridge/structure cross-sections (members, supports, spans)
- City planning (blocks, roads, green spaces)
- Garden layouts (beds, paths, features)

KEY PRINCIPLES:
1. GRID - Visual guide for alignment and measurement
2. VIEWS - Plan (top-down), elevation (side), section (cross-section)
3. SCALE - Relationship between drawing units and real measurements
4. ELEMENTS - The distinct parts/areas the student should identify and draw
5. LABELS - Naming and measuring what they draw

IMPORTANT: Match the viewType to the topic:
- 'plan' (top-down): floor plans, playground maps, garden layouts, city blocks
- 'elevation' (side view): machines, vehicles, buildings from the side, bridges
- 'section' (cross-section): internal structure, layered designs

IMPORTANT: Match elementLabel to the topic:
- Buildings/houses → "rooms"
- Machines/vehicles → "components" or "parts"
- Playgrounds/parks → "zones" or "areas"
- Bridges/structures → "sections" or "members"
- Gardens → "beds" or "areas"
- City layouts → "blocks" or "districts"

GRADE-LEVEL GUIDELINES:

KINDERGARTEN (ages 5-6):
- Simple shapes, 2-3 elements
- gridSize: [10, 10], gridScale: 1
- viewType: 'plan' (easiest to understand)
- snapToGrid: true, showMeasurements: false
- theme: 'sketch'

GRADES 1-2 (ages 6-8):
- 3-4 elements with labels
- gridSize: [15, 15], gridScale: 1
- snapToGrid: true, showMeasurements: true
- theme: 'blueprint'

GRADES 2-3 (ages 7-9):
- 4-5 elements with measurements
- gridSize: [15, 15], gridScale: 1
- snapToGrid: true, showMeasurements: true
- theme: 'blueprint'

GRADES 3-4 (ages 8-10):
- 5-6 elements, can use elevation view
- gridSize: [18, 18], gridScale: 1
- theme: 'blueprint' or 'technical'

GRADES 4-5 (ages 9-11):
- 6-7 elements, technical precision
- gridSize: [20, 20], gridScale: 0.5
- snapToGrid: false, showMeasurements: true
- theme: 'technical'

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.gridSize ? `- Grid size: ${config.gridSize}` : ''}
${config.gridScale ? `- Grid scale: ${config.gridScale}` : ''}
${config.viewType ? `- View type: ${config.viewType}` : ''}
${config.targetElementCount ? `- Target elements: ${config.targetElementCount}` : ''}
${config.elementLabel ? `- Element label: ${config.elementLabel}` : ''}
${config.showMeasurements !== undefined ? `- Show measurements: ${config.showMeasurements}` : ''}
${config.theme ? `- Theme: ${config.theme}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. gridSize must be [rows, cols] with values between 8 and 25
2. gridScale must be a positive number (typically 0.5, 1, or 2)
3. viewType must be 'plan', 'elevation', or 'section'
4. elementLabel must be a plural noun describing what students draw
5. challengeText must be a short, specific instruction referencing the elements
6. theme should match student age (sketch for young, technical for older)
7. showMeasurements should be false for K-1, true for grades 2+

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

  // Validation: ensure targetElementCount is reasonable (if provided)
  if (data.targetElementCount !== undefined && data.targetElementCount !== null) {
    data.targetElementCount = Math.max(0, Math.min(10, data.targetElementCount));
  }

  // Validation: ensure elementLabel has a sensible default
  if (!data.elementLabel || typeof data.elementLabel !== 'string') {
    data.elementLabel = 'elements';
  }

  // Apply config overrides
  if (config) {
    if (config.gridSize) data.gridSize = config.gridSize;
    if (config.gridScale !== undefined) data.gridScale = config.gridScale;
    if (config.showGrid !== undefined) data.showGrid = config.showGrid;
    if (config.snapToGrid !== undefined) data.snapToGrid = config.snapToGrid;
    if (config.viewType) data.viewType = config.viewType;
    if (config.targetElementCount !== undefined) data.targetElementCount = config.targetElementCount;
    if (config.elementLabel) data.elementLabel = config.elementLabel;
    if (config.challengeText) data.challengeText = config.challengeText;
    if (config.showMeasurements !== undefined) data.showMeasurements = config.showMeasurements;
    if (config.theme) data.theme = config.theme;
  }

  // Set sensible defaults for optional fields
  if (data.showGrid === undefined) data.showGrid = true;
  if (data.snapToGrid === undefined) data.snapToGrid = true;
  if (data.showMeasurements === undefined) data.showMeasurements = false;

  return data;
};
