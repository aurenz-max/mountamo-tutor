import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  FoundationBuilderData,
  SoilType,
  FoundationType,
  StructureMaterial,
} from '../../primitives/visual-primitives/engineering/FoundationBuilder';

// Re-export for convenience if needed elsewhere
export type { FoundationBuilderData, SoilType, FoundationType, StructureMaterial };

/**
 * Schema for Foundation Builder Data
 */
const foundationBuilderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the foundation engineering activity (e.g., 'Design a Foundation for the Library', 'Support the Community Center')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining the engineering challenge. Use age-appropriate language."
    },
    soilType: {
      type: Type.STRING,
      enum: ["rock", "gravel", "sand", "clay", "mud"],
      description: "Soil type determines bearing capacity. rock: 500 kN/m² (strongest), gravel: 200, sand: 100, clay: 75, mud: 30 (weakest)."
    },
    structureType: {
      type: Type.STRING,
      description: "Type of structure to support (e.g., 'house', 'apartment building', 'school', 'warehouse', 'library'). Make it relatable to students."
    },
    structureMaterial: {
      type: Type.STRING,
      enum: ["wood", "brick", "concrete", "steel"],
      description: "Building material affects weight density. wood: 1.5 kN/m²/story (lightest), brick: 3.0, concrete: 5.0 (heaviest), steel: 4.0."
    },
    structureFootprint: {
      type: Type.NUMBER,
      description: "Building base area in m². K-1: 10-20 m² (small), 1-2: 20-50 m², 2-3: 50-100 m², 3-5: 100-200 m² (large)."
    },
    structureStories: {
      type: Type.NUMBER,
      description: "Number of floors. K-1: 1-2 stories, 1-2: 2-3 stories, 2-3: 3-4 stories, 3-5: 4-6 stories."
    },
    targetFoundationType: {
      type: Type.STRING,
      enum: ["spread", "strip", "slab", "piles"],
      description: "Optional: require specific foundation type. null for student choice. Use for advanced challenges.",
      nullable: true
    },
    showPressure: {
      type: Type.BOOLEAN,
      description: "Display force/area calculation. False for K-1 (too advanced), true for 2-5 (show math)."
    },
    showSettlement: {
      type: Type.BOOLEAN,
      description: "Animate sinking on failure. True for all grades (visual feedback is powerful)."
    },
    designMode: {
      type: Type.BOOLEAN,
      description: "Allow custom footing shapes and sizes. True for all grades (hands-on exploration)."
    },
    hint: {
      type: Type.STRING,
      description: "Optional starter hint for students. Keep it encouraging and age-appropriate.",
      nullable: true
    }
  },
  required: ["title", "description", "soilType", "structureType", "structureMaterial", "structureFootprint", "structureStories", "showPressure", "showSettlement", "designMode"]
};

/**
 * Generate Foundation Builder data for soil/foundation engineering education
 *
 * Creates foundation design challenges appropriate for K-5 engineering education:
 * - K-1: Buildings need foundations (basic concept)
 * - 1-2: Bigger footings spread weight
 * - 2-3: Different soils hold different loads
 * - 3-4: Pressure = force ÷ area
 * - 4-5: Foundation design for soil types (optimization)
 *
 * @param topic - The engineering topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns FoundationBuilderData with complete configuration
 */
export const generateFoundationBuilder = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<FoundationBuilderData>
): Promise<FoundationBuilderData> => {
  const prompt = `
Create an educational Foundation Builder simulator for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - FOUNDATION BUILDER:
This primitive teaches foundation engineering through realistic design challenges:
1. GIVEN CONSTRAINTS - Students receive structure specs (type, material, footprint, stories) and soil type
2. CALCULATE LOAD - Students determine building weight from material density × footprint × stories
3. DESIGN FOUNDATION - Select foundation type (spread, strip, slab, piles) and size it appropriately
4. TEST DESIGN - Check if pressure stays below soil bearing capacity
5. REAL ENGINEERING - Like real engineers, students work from constraints to solution

STRUCTURE MATERIALS & WEIGHT DENSITY (kN/m² per story):
- WOOD: 1.5 kN/m²/story - Light wooden construction (houses, small buildings)
- BRICK: 3.0 kN/m²/story - Brick/masonry construction (traditional buildings)
- CONCRETE: 5.0 kN/m²/story - Reinforced concrete (modern buildings, heaviest)
- STEEL: 4.0 kN/m²/story - Steel frame construction (commercial buildings)

FOUNDATION TYPES:
- SPREAD FOOTING: Rectangular pad under individual columns (most common, adjustable size)
- STRIP FOOTING: Long continuous strip under walls (for bearing walls)
- SLAB: Large flat concrete slab under entire building (spreads load widely)
- PILES: Deep vertical shafts driven into ground (for weak surface soil, reaches strong soil below)

SOIL TYPES & BEARING CAPACITY:
- ROCK: 500 kN/m² - Very strong, can support heavy buildings with small footings
- GRAVEL: 200 kN/m² - Strong, good for most buildings
- SAND: 100 kN/m² - Moderate strength, requires larger footings
- CLAY: 75 kN/m² - Moderate strength, can shrink/swell with moisture
- MUD: 30 kN/m² - Very weak, requires very large footings or piles to reach deeper soil

KEY ENGINEERING PRINCIPLES:
- BUILDING LOAD = Material Density × Footprint × Stories
- PRESSURE = FORCE ÷ AREA - Bigger footing area = less pressure on soil
- MINIMUM FOUNDATION AREA = Building Load ÷ Soil Capacity
- Students figure out the load, then design a foundation to handle it
- Real-world: Engineers start with structure specs and soil reports, then design foundations

GRADE-LEVEL GUIDELINES:

KINDERGARTEN - GRADE 1 (ages 5-7):
- Concept: "Buildings need strong feet so they don't sink into the ground!"
- Goal: Discover that foundations are needed, bigger is better
- Structure: Small relatable buildings (house, shed, playhouse)
- Material: wood (lightest, simplest calculations)
- Footprint: 10-20 m² (small, easy numbers)
- Stories: 1-2 stories
- Soil type: mud or sand (dramatic failures make concept clear)
- Show pressure: false (too advanced - focus on "does it hold?")
- Show settlement: true (visual feedback is powerful)
- Design mode: true (exploration is key)
- Hint: "Try making a big flat foundation - like snowshoes!"
- Language: "Can you build a foundation to hold up this [structure]? Will it sink or stay up?"

GRADES 1-2 (ages 6-8):
- Concept: "Heavier buildings need bigger foundations!"
- Goal: Learn that material and size affect weight, which affects foundation needs
- Structure: Familiar buildings (house, garage, small store)
- Material: wood or brick
- Footprint: 20-50 m²
- Stories: 2-3 stories
- Soil type: sand or clay (moderate difficulty)
- Show pressure: false (K-2 focus on area, not calculation)
- Show settlement: true
- Design mode: true
- Hint: "This [material] building weighs more than a wooden one. Make a bigger foundation!"
- Language: "Design a foundation for this [stories]-story [material] [structure]. How wide should it be?"

GRADES 2-3 (ages 7-9):
- Concept: "Calculate building weight, then design for the soil type!"
- Goal: Use material density to estimate load, understand soil properties
- Structure: Community buildings (school, library, community center)
- Material: any (students compare different materials)
- Footprint: 50-100 m²
- Stories: 3-4 stories
- Soil type: any (explore different soils for same building)
- Show pressure: true (introduce pressure = force/area concept)
- Show settlement: true
- Design mode: true
- Hint: "This soil can hold [soilCapacity] kN/m². First calculate the building weight!"
- Language: "You're building a [structure] on [soil]. Calculate the load and design a foundation!"

GRADES 3-4 (ages 8-10):
- Concept: "Real engineers calculate load from specs, then design foundations!"
- Goal: Full engineering workflow - specs → load calculation → foundation design
- Structure: Larger buildings (apartment, office building, warehouse)
- Material: brick, concrete, or steel
- Footprint: 100-150 m²
- Stories: 4-5 stories
- Soil type: any (provide specific capacity, ask to design)
- Show pressure: true (emphasis on calculation)
- Show settlement: true
- Design mode: true
- Hint: "Calculate: Load = [density] × [footprint] × [stories]. Then find minimum foundation area!"
- Language: "Engineer a foundation for this [material] [structure]. Show your calculations!"

GRADES 4-5 (ages 9-11):
- Concept: "Optimize foundation design - efficiency and cost matter!"
- Goal: Design most efficient foundation meeting all constraints
- Structure: Complex buildings (high-rise, hospital, school complex)
- Material: concrete or steel (heaviest, realistic)
- Footprint: 150-200 m²
- Stories: 5-6 stories
- Soil type: challenging soils (clay or sand, require thoughtful design)
- Target foundation type: Optional - sometimes require specific type (e.g., must use piles for mud)
- Show pressure: true
- Show settlement: true
- Design mode: true
- Hint: "Calculate the load, find minimum area, then choose the most efficient foundation type!"
- Language: "You're the structural engineer for this [structure]. Design the most cost-effective foundation!"

CHALLENGE TYPES BY TOPIC:
- "foundations", "buildings", "support": focus on calculating load and sizing foundation
- "soil types", "geology": compare different soils, show how soil affects design
- "materials", "construction": compare wood vs brick vs concrete buildings
- "pressure", "force", "area": emphasize load and pressure calculations (grades 3-5)
- "optimization", "efficiency": minimal foundation area, choose best foundation type (grades 4-5)
- "settlement", "sinking": weak soils (mud/clay) to demonstrate failure modes

STRUCTURE FOOTPRINT GUIDELINES:
- K-1: 10-20 m² (small, simple numbers like 4m × 5m)
- 1-2: 20-50 m² (e.g., 5m × 8m)
- 2-3: 50-100 m² (e.g., 8m × 10m)
- 3-4: 100-150 m² (e.g., 10m × 12m)
- 4-5: 150-200 m² (e.g., 12m × 15m)

STRUCTURE STORIES GUIDELINES:
- K-1: 1-2 stories
- 1-2: 2-3 stories
- 2-3: 3-4 stories
- 3-4: 4-5 stories
- 4-5: 5-6 stories

SOIL SELECTION GUIDELINES:
- K-1: mud or sand (obvious failures teach concept)
- 1-2: sand or clay (moderate challenge)
- 2-3: any soil (compare different soils)
- 3-4: sand, clay, or gravel (calculation focus)
- 4-5: clay or sand, sometimes mud (require piles for optimization challenge)

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.soilType ? `- Soil type: ${config.soilType}` : ''}
${config.structureType ? `- Structure type: ${config.structureType}` : ''}
${config.structureMaterial ? `- Structure material: ${config.structureMaterial}` : ''}
${config.structureFootprint ? `- Structure footprint: ${config.structureFootprint} m²` : ''}
${config.structureStories ? `- Structure stories: ${config.structureStories}` : ''}
${config.targetFoundationType ? `- Required foundation type: ${config.targetFoundationType}` : ''}
${config.showPressure !== undefined ? `- Show pressure: ${config.showPressure}` : ''}
${config.hint ? `- Hint: ${config.hint}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. structureFootprint should be 10-200 m² (realistic for K-5)
2. structureStories should be 1-6 stories (grade-appropriate)
3. structureMaterial should match grade (wood for K-1, any for 2-5)
4. soilType should match grade difficulty (mud for K-1, any for 2-5)
5. showPressure should be false for K-2, true for 3-5
6. Descriptions should emphasize realistic engineering workflow
7. Language should be age-appropriate and encourage problem-solving
8. Challenges should build from discovery (K-1) to optimization (4-5)
9. Structure types should be relatable (house, school, library, etc.)

REAL-WORLD CONNECTIONS:
- Houses sit on concrete footings in the ground
- Skyscrapers need massive foundations or deep piles
- Soft soil (mud) requires bigger foundations than rock
- Engineers test soil before designing foundations
- Foundation failure causes buildings to settle (tilt, crack)

Return a complete Foundation Builder configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: foundationBuilderSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Foundation Builder data returned from Gemini API');
  }

  // Validation: ensure soil type is valid
  const validSoils: SoilType[] = ['rock', 'gravel', 'sand', 'clay', 'mud'];
  if (!validSoils.includes(data.soilType)) {
    console.warn('Invalid soilType. Setting default.');
    data.soilType = 'sand';
  }

  // Validation: ensure structure material is valid
  const validMaterials: StructureMaterial[] = ['wood', 'brick', 'concrete', 'steel'];
  if (!validMaterials.includes(data.structureMaterial)) {
    console.warn('Invalid structureMaterial. Setting default.');
    data.structureMaterial = 'wood';
  }

  // Validation: structureFootprint should be reasonable
  if (!data.structureFootprint || data.structureFootprint < 5 || data.structureFootprint > 300) {
    console.warn('Invalid structureFootprint. Setting default.');
    data.structureFootprint = 50;
  }

  // Validation: structureStories should be reasonable
  if (!data.structureStories || data.structureStories < 1 || data.structureStories > 10) {
    console.warn('Invalid structureStories. Setting default.');
    data.structureStories = 2;
  }

  // Validation: structureType should be present
  if (!data.structureType || data.structureType.trim() === '') {
    console.warn('Invalid structureType. Setting default.');
    data.structureType = 'building';
  }

  // Validation: targetFoundationType should be valid if set
  const validFoundationTypes: (FoundationType | null)[] = ['spread', 'strip', 'slab', 'piles', null];
  if (data.targetFoundationType !== null && data.targetFoundationType !== undefined &&
      !validFoundationTypes.includes(data.targetFoundationType)) {
    console.warn('Invalid targetFoundationType. Setting default.');
    data.targetFoundationType = null;
  }

  // Apply config overrides
  if (config) {
    if (config.soilType) data.soilType = config.soilType;
    if (config.structureType) data.structureType = config.structureType;
    if (config.structureMaterial) data.structureMaterial = config.structureMaterial;
    if (config.structureFootprint !== undefined) data.structureFootprint = config.structureFootprint;
    if (config.structureStories !== undefined) data.structureStories = config.structureStories;
    if (config.targetFoundationType !== undefined) data.targetFoundationType = config.targetFoundationType;
    if (config.showPressure !== undefined) data.showPressure = config.showPressure;
    if (config.showSettlement !== undefined) data.showSettlement = config.showSettlement;
    if (config.designMode !== undefined) data.designMode = config.designMode;
    if (config.hint) data.hint = config.hint;
  }

  // Set sensible defaults for optional fields
  if (data.showPressure === undefined || data.showPressure === null) {
    data.showPressure = true;
  }
  if (data.showSettlement === undefined || data.showSettlement === null) {
    data.showSettlement = true;
  }
  if (data.designMode === undefined || data.designMode === null) {
    data.designMode = true;
  }
  if (data.targetFoundationType === undefined) {
    data.targetFoundationType = null;
  }

  return data;
};
