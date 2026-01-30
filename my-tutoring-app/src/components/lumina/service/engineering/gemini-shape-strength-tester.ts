import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  ShapeStrengthTesterData,
  BeamMaterial,
  TestType,
} from '../../primitives/visual-primitives/engineering/ShapeStrengthTester';

// Re-export for convenience if needed elsewhere
export type { ShapeStrengthTesterData, BeamMaterial, TestType };

/**
 * Schema for Shape Strength Tester Data (Free-form LEGO-style version)
 */
const shapeStrengthTesterSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the structural building activity (e.g., 'Build a Strong Tower', 'Earthquake-Proof Bridge Challenge')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will build and discover. Use age-appropriate language that emphasizes hands-on exploration and discovery."
    },
    canvasWidth: {
      type: Type.NUMBER,
      description: "Canvas width in pixels. Default: 600. Can be 500-700 depending on activity needs.",
      nullable: true
    },
    canvasHeight: {
      type: Type.NUMBER,
      description: "Canvas height in pixels. Default: 400. Can be 300-500 depending on activity needs.",
      nullable: true
    },
    testType: {
      type: Type.STRING,
      enum: ["compression", "shear", "earthquake"],
      description: "Test type. 'compression' for downward force (gravity), 'shear' for sideways force (wind), 'earthquake' for dynamic shaking. K-2: compression, 3-4: shear, 4-5: earthquake."
    },
    testLoad: {
      type: Type.NUMBER,
      description: "Force to apply in Newtons. K-1: 40-50N, Grades 1-2: 50-60N, Grades 2-3: 60-70N, Grades 3-5: 70-90N."
    },
    targetTriangles: {
      type: Type.NUMBER,
      description: "Challenge: build structure with at least X triangles. 0 for free exploration, 1-2 for K-2, 2-4 for grades 2-3, 3-6 for grades 3-5.",
      nullable: true
    },
    targetHeight: {
      type: Type.NUMBER,
      description: "Challenge: structure must reach at least this height in pixels. 0 for no requirement, 120-180 for K-2, 180-240 for grades 2-3, 240-300 for grades 3-5.",
      nullable: true
    },
    availableMaterials: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        enum: ["straw", "wood", "steel"]
      },
      description: "Materials students can choose. K-2: ['wood'], Grades 2-3: ['wood', 'steel'], Grades 3-5: ['straw', 'wood', 'steel'] to compare."
    },
    defaultMaterial: {
      type: Type.STRING,
      enum: ["straw", "wood", "steel"],
      description: "Starting material selection. 'wood' for most grades, 'straw' for K-1 dramatic demos."
    },
    hint: {
      type: Type.STRING,
      description: "Initial hint or tip to guide students (e.g., 'Try building triangular shapes - they're super strong!')",
      nullable: true
    }
  },
  required: ["title", "description", "testType", "testLoad", "availableMaterials", "defaultMaterial"]
};

/**
 * Generate Shape Strength Tester data for free-form structural building
 *
 * Creates LEGO-style building challenges appropriate for K-5 engineering education:
 * - K-1: Simple structures, discover triangles are strong
 * - 2-3: Build bridges and towers, learn diagonal bracing
 * - 3-4: Test different forces, understand shear vs compression
 * - 4-5: Optimize designs, minimize materials while maximizing strength
 *
 * @param topic - The engineering topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns ShapeStrengthTesterData with complete configuration
 */
export const generateShapeStrengthTester = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<ShapeStrengthTesterData>
): Promise<ShapeStrengthTesterData> => {
  const prompt = `
Create an educational Free-Form Structural Building Simulator for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - FREE-FORM LEGO-STYLE BUILDING:
This primitive teaches structural engineering through hands-on building with beams:
1. BUILDING PHASE - Click and drag on canvas to place beams anywhere (like LEGO)
2. MATERIALS - Choose straw (weak), wood (medium), or steel (strong) for each beam
3. BEAM PLACEMENT - Free-form placement, beams snap to grid for alignment
4. JOINTS - Beams connect at endpoints, forming joints
5. TESTING PHASE - Apply compression, shear, or earthquake forces
6. PHYSICS - Beams fail if load exceeds material strength
7. DISCOVERY - Learn that TRIANGLES make structures rigid and strong

MATERIALS (Strength in Newtons):
- STRAW: 30N - Very weak, fails easily. Good for dramatic demonstrations (K-1)
- WOOD: 60N - Moderate strength. Realistic for most building challenges (2-4)
- STEEL: 120N - Very strong. Good for high-load challenges (4-5)

TEST TYPES:
- COMPRESSION: Downward force (like gravity on a building, weight from above)
  - Top beams experience most stress
  - Teaches: vertical load distribution, foundation strength
- SHEAR: Sideways force (like wind pushing a building)
  - Horizontal beams experience most stress
  - Teaches: lateral stability, wind resistance
- EARTHQUAKE: Dynamic shaking (combination of forces)
  - All beams experience stress, diagonal bracing helps
  - Teaches: earthquake engineering, dynamic loads

KEY ENGINEERING PRINCIPLES:
- TRIANGLES ARE RIGID - Cannot be deformed without changing beam lengths
- SQUARES/RECTANGLES DEFORM - Can collapse into parallelograms under load
- DIAGONAL BRACING - Adding diagonal beams creates triangles within squares
- TRUSS STRUCTURES - Interconnected triangles distribute loads efficiently
- MATERIAL SELECTION - Stronger materials can handle higher loads
- Real-world: Bridge trusses, tower frames, earthquake bracing

GRADE-LEVEL GUIDELINES:

KINDERGARTEN - GRADE 1 (ages 5-7):
- Concept: "Build with beams like LEGO! Discover which shapes are strongest!"
- Goal: Free exploration, discover that triangles don't collapse
- Canvas size: 600×400 (default, good working area)
- Test type: compression (easiest to understand - "push down")
- Test load: 40-50N (achievable with triangular structures)
- Target triangles: 0-1 (free exploration, or suggest building 1 triangle)
- Target height: 0-120 (optional, or suggest building up)
- Available materials: ["wood"] (keep it simple)
- Default material: wood
- Hint: "Try connecting beams to make triangle shapes - they're super strong!"
- Language: Simple, playful, emphasize fun and discovery

GRADES 1-2 (ages 6-8):
- Concept: "Build a tower or bridge! Triangles make it strong!"
- Goal: Learn that diagonal bracing prevents collapse
- Canvas size: 600×400
- Test type: compression
- Test load: 50-60N
- Target triangles: 1-2 (build at least 1-2 triangles)
- Target height: 120-180 (build upward)
- Available materials: ["wood"]
- Default material: wood
- Hint: "Squares can wobble, but adding diagonal beams makes triangles that stay rigid!"
- Language: Encourage experimentation, compare shapes

GRADES 2-3 (ages 7-9):
- Concept: "Engineer a bridge or tower using triangular trusses!"
- Goal: Understand triangulation and strategic beam placement
- Canvas size: 600×400
- Test type: compression or shear (introduce both)
- Test load: 60-70N
- Target triangles: 2-4 (multiple triangles required)
- Target height: 180-240 (taller structures)
- Available materials: ["wood", "steel"] (let them compare)
- Default material: wood
- Hint: "Engineers use triangular trusses in bridges and towers. Can you see why?"
- Language: Use engineering vocabulary, explain real-world connections

GRADES 3-4 (ages 8-10):
- Concept: "Test your structure against earthquakes and wind forces!"
- Goal: Learn about different force types and how structures respond
- Canvas size: 600×400
- Test type: shear or earthquake (introduce lateral forces)
- Test load: 70-80N
- Target triangles: 3-5 (complex truss structures)
- Target height: 240-280 (challenge: build tall AND strong)
- Available materials: ["wood", "steel"]
- Default material: steel
- Hint: "Diagonal bracing helps resist sideways forces. Where should you place beams?"
- Language: Engineering concepts, force types, structural analysis

GRADES 4-5 (ages 9-11):
- Concept: "Structural optimization - build the strongest structure with fewest beams!"
- Goal: Optimize designs, understand efficiency in engineering
- Canvas size: 600×400
- Test type: earthquake or shear (advanced challenges)
- Test load: 80-90N (high loads require good design)
- Target triangles: 4-6 (efficient triangulation)
- Target height: 260-300 (tall structures)
- Available materials: ["straw", "wood", "steel"] (compare all materials)
- Default material: steel
- Hint: "Real engineers minimize materials while maximizing strength. Can you optimize your design?"
- Language: Advanced engineering, optimization, trade-offs

CHALLENGE TYPES BY TOPIC:
- "bridges": compression test, target height 120-180px (span distance)
- "towers": compression test, target height 240-300px (build tall)
- "earthquakes", "seismic design": earthquake test, emphasize diagonal bracing
- "wind resistance": shear test, horizontal forces
- "trusses", "structural engineering": any test, target triangles 3-6
- "optimization", "efficiency": high loads (80-90N), minimize beams used
- "materials", "material science": offer all 3 materials to compare

CANVAS SIZE:
- Default: 600×400 (good working area for most activities)
- Wider: 700×400 (for bridge-spanning challenges)
- Taller: 600×500 (for tower-building challenges)
- Smaller: 500×350 (for K-1 to reduce complexity)

TARGET TRIANGLES:
- 0: Free exploration, no requirement
- 1-2: K-2, basic triangulation
- 2-4: Grades 2-3, intermediate truss structures
- 3-6: Grades 3-5, complex optimized designs

TARGET HEIGHT (pixels):
- 0: No requirement, any height OK
- 120-180: K-2, small structures
- 180-240: Grades 2-3, medium structures
- 240-300: Grades 3-5, tall towers/high bridges

TEST LOAD BY MATERIAL:
- Straw (30N): Use 40-50N loads (requires triangulation)
- Wood (60N): Use 50-70N loads (standard challenges)
- Steel (120N): Use 70-90N loads (high-performance challenges)

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.canvasWidth ? `- Canvas width: ${config.canvasWidth}` : ''}
${config.canvasHeight ? `- Canvas height: ${config.canvasHeight}` : ''}
${config.testType ? `- Test type: ${config.testType}` : ''}
${config.testLoad ? `- Test load: ${config.testLoad}` : ''}
${config.targetTriangles ? `- Target triangles: ${config.targetTriangles}` : ''}
${config.targetHeight ? `- Target height: ${config.targetHeight}` : ''}
${config.availableMaterials ? `- Materials: ${config.availableMaterials.join(', ')}` : ''}
${config.defaultMaterial ? `- Default material: ${config.defaultMaterial}` : ''}
${config.hint ? `- Hint: ${config.hint}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. testLoad should be achievable with triangular structures (40-90N range)
2. targetTriangles should be 0-6 (reasonable for K-5)
3. targetHeight should be 0-300 (fits in canvas)
4. availableMaterials must include at least one material
5. Descriptions should emphasize hands-on building and discovery
6. Language should be age-appropriate and encourage experimentation
7. Challenges should build from discovery (K-1) to optimization (4-5)

REAL-WORLD CONNECTIONS TO EMPHASIZE:
- Bridge trusses (triangular frameworks span rivers)
- Cell phone towers (triangulated steel structures)
- Eiffel Tower (iconic triangle-based design)
- Earthquake bracing (diagonal X-bracing in buildings)
- Playground equipment (triangle geometry for safety)
- Crane booms (triangular truss structures)

USER EXPERIENCE:
- Students click and drag to place beams anywhere on canvas
- Beams snap to grid for easier alignment
- Click on existing beams to remove them
- Select materials before placing each beam
- Real-time feedback: see triangle count and structure height
- Test their structure when ready
- Learn from failures: which beams collapsed? Where to add triangles?

Return a complete Free-Form Structural Building configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: shapeStrengthTesterSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Shape Strength Tester data returned from Gemini API');
  }

  // Validation: ensure canvas size is reasonable
  if (data.canvasWidth && (data.canvasWidth < 400 || data.canvasWidth > 800)) {
    console.warn('Invalid canvasWidth. Setting default.');
    data.canvasWidth = 600;
  }
  if (data.canvasHeight && (data.canvasHeight < 300 || data.canvasHeight > 600)) {
    console.warn('Invalid canvasHeight. Setting default.');
    data.canvasHeight = 400;
  }

  // Validation: ensure testLoad is reasonable
  if (!data.testLoad || data.testLoad < 30 || data.testLoad > 100) {
    console.warn('Invalid testLoad. Setting default.');
    data.testLoad = 60;
  }

  // Validation: ensure targetTriangles is reasonable
  if (data.targetTriangles !== null && data.targetTriangles !== undefined) {
    if (data.targetTriangles < 0 || data.targetTriangles > 10) {
      console.warn('Invalid targetTriangles. Adjusting.');
      data.targetTriangles = 2;
    }
  }

  // Validation: ensure targetHeight is reasonable
  if (data.targetHeight !== null && data.targetHeight !== undefined) {
    if (data.targetHeight < 0 || data.targetHeight > 400) {
      console.warn('Invalid targetHeight. Adjusting.');
      data.targetHeight = 180;
    }
  }

  // Validation: ensure testType is valid
  if (!['compression', 'shear', 'earthquake'].includes(data.testType)) {
    data.testType = 'compression';
  }

  // Validation: ensure availableMaterials is valid
  if (!data.availableMaterials || data.availableMaterials.length === 0) {
    data.availableMaterials = ['wood'];
  }
  data.availableMaterials = data.availableMaterials.filter((m: string) =>
    ['straw', 'wood', 'steel'].includes(m)
  );

  // Validation: ensure defaultMaterial is valid and in availableMaterials
  if (!data.defaultMaterial || !['straw', 'wood', 'steel'].includes(data.defaultMaterial)) {
    data.defaultMaterial = 'wood';
  }
  if (!data.availableMaterials.includes(data.defaultMaterial)) {
    data.defaultMaterial = data.availableMaterials[0];
  }

  // Apply config overrides (after validation)
  if (config) {
    if (config.canvasWidth !== undefined) data.canvasWidth = config.canvasWidth;
    if (config.canvasHeight !== undefined) data.canvasHeight = config.canvasHeight;
    if (config.testType) data.testType = config.testType;
    if (config.testLoad !== undefined) data.testLoad = config.testLoad;
    if (config.targetTriangles !== undefined) data.targetTriangles = config.targetTriangles;
    if (config.targetHeight !== undefined) data.targetHeight = config.targetHeight;
    if (config.availableMaterials) data.availableMaterials = config.availableMaterials;
    if (config.defaultMaterial) data.defaultMaterial = config.defaultMaterial;
    if (config.hint) data.hint = config.hint;
  }

  // Set sensible defaults for optional fields
  if (!data.canvasWidth) data.canvasWidth = 600;
  if (!data.canvasHeight) data.canvasHeight = 400;
  if (data.targetTriangles === undefined || data.targetTriangles === null) {
    data.targetTriangles = 0; // Default to free exploration
  }
  if (data.targetHeight === undefined || data.targetHeight === null) {
    data.targetHeight = 0; // Default to no height requirement
  }

  return data;
};
