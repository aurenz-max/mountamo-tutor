import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { CompareContrastData } from "../../primitives/visual-primitives/biology/CompareContrast";

/**
 * Schema definition for Compare & Contrast Data
 *
 * This schema defines the structure for biological entity comparisons,
 * supporting both side-by-side viewing and interactive Venn diagram activities.
 *
 * The primitive follows the PRD specification for "Compare & Contrast Viewer"
 * from the biology primitives document - the essential "how are these alike
 * and different?" primitive.
 */
const compareContrastSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the comparison (e.g., 'Frogs vs Toads: Amphibian Comparison')"
    },
    mode: {
      type: Type.STRING,
      enum: ["side-by-side", "venn-interactive"],
      description: "Display mode: side-by-side for viewing, venn-interactive for student activity"
    },
    entityA: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Name of the first entity (e.g., 'Frog', 'Plant Cell', 'Desert')"
        },
        imagePrompt: {
          type: Type.STRING,
          description: "Concise description for image generation or reference"
        },
        imageUrl: {
          type: Type.STRING,
          description: "Optional generated or provided image URL"
        },
        attributes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: "Attribute category (e.g., 'Skin', 'Diet', 'Habitat', 'Cell Wall')"
              },
              value: {
                type: Type.STRING,
                description: "Value for this entity (e.g., 'Smooth and moist', 'Insects and worms')"
              },
              isShared: {
                type: Type.BOOLEAN,
                description: "True if this attribute is shared with the other entity"
              }
            },
            required: ["category", "value", "isShared"]
          }
        }
      },
      required: ["name", "imagePrompt", "attributes"]
    },
    entityB: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Name of the second entity (e.g., 'Toad', 'Animal Cell', 'Rainforest')"
        },
        imagePrompt: {
          type: Type.STRING,
          description: "Concise description for image generation or reference"
        },
        imageUrl: {
          type: Type.STRING,
          description: "Optional generated or provided image URL"
        },
        attributes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: "Attribute category (e.g., 'Skin', 'Diet', 'Habitat', 'Cell Wall')"
              },
              value: {
                type: Type.STRING,
                description: "Value for this entity (e.g., 'Dry and bumpy', 'Insects and spiders')"
              },
              isShared: {
                type: Type.BOOLEAN,
                description: "True if this attribute is shared with the other entity"
              }
            },
            required: ["category", "value", "isShared"]
          }
        }
      },
      required: ["name", "imagePrompt", "attributes"]
    },
    sharedAttributes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            description: "Shared attribute category"
          },
          value: {
            type: Type.STRING,
            description: "Shared value for both entities"
          }
        },
        required: ["category", "value"]
      },
      description: "Attributes that both entities have in common"
    },
    keyInsight: {
      type: Type.STRING,
      description: "The 'so what' — why this comparison matters and what students should take away"
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K-2", "3-5", "6-8"],
      description: "Target grade band - determines vocabulary complexity"
    }
  },
  required: ["title", "mode", "entityA", "entityB", "sharedAttributes", "keyInsight", "gradeBand"]
};

/**
 * Grade band complexity guidelines
 */
const GRADE_BAND_GUIDELINES = {
  'K-2': `
GRADE K-2 GUIDELINES:
- Use simple, concrete vocabulary (no scientific jargon)
- Focus on observable characteristics (what you can see, touch, hear)
- 4-6 total attributes per entity (keep it simple)
- 2-3 shared attributes
- Compare familiar organisms or objects (pets, common animals, plants)
- Use clear, short descriptions
- Key insight should be in simple language students can understand
`,
  '3-5': `
GRADE 3-5 GUIDELINES:
- Introduce scientific vocabulary with clear explanations
- Include both observable and non-observable characteristics
- 6-8 total attributes per entity
- 3-4 shared attributes
- Compare organisms, cells, organs, or ecosystems
- Include functional attributes (what it does, how it works)
- Key insight should connect to broader biological concepts
- Use grade-appropriate scientific terms (photosynthesis, vertebrate, etc.)
`,
  '6-8': `
GRADE 6-8 GUIDELINES:
- Use proper scientific terminology
- Include cellular, molecular, and system-level characteristics
- 8-10 total attributes per entity
- 4-5 shared attributes
- Compare complex biological entities (organelles, systems, biomes, processes)
- Include evolutionary, ecological, or physiological context
- Key insight should address mechanisms, adaptations, or systems thinking
- Expect deeper analysis and critical thinking
`
};

/**
 * Generate compare & contrast data using Gemini AI
 *
 * This function creates side-by-side or Venn diagram comparisons of biological
 * entities (organisms, cells, organs, processes, biomes). The essential
 * "how are these alike and different?" primitive.
 *
 * Supports:
 * - Organism comparisons (frog vs toad, shark vs dolphin)
 * - Cell comparisons (plant cell vs animal cell, prokaryote vs eukaryote)
 * - Organ/system comparisons (heart vs lungs, root vs stem)
 * - Process comparisons (mitosis vs meiosis, photosynthesis vs respiration)
 * - Biome comparisons (desert vs rainforest, tundra vs taiga)
 *
 * @param entityA - Name of first entity to compare
 * @param entityB - Name of second entity to compare
 * @param gradeBand - Grade level ('K-2', '3-5', or '6-8') determines complexity
 * @param mode - Display mode ('side-by-side' for viewing, 'venn-interactive' for activity)
 * @param config - Optional partial configuration to override generated values
 * @returns CompareContrastData with comparison information
 */
export const generateCompareContrast = async (
  entityA: string,
  entityB: string,
  gradeBand: 'K-2' | '3-5' | '6-8' = '3-5',
  mode: 'side-by-side' | 'venn-interactive' = 'side-by-side',
  config?: Partial<CompareContrastData>
): Promise<CompareContrastData> => {

  const gradeContext = GRADE_BAND_GUIDELINES[gradeBand];

  const generationPrompt = `Create a biological comparison between "${entityA}" and "${entityB}".

TARGET GRADE BAND: ${gradeBand}
DISPLAY MODE: ${mode}

${gradeContext}

COMPARISON STRUCTURE:

1. **Title**: Create an engaging title that names both entities and hints at the comparison purpose

2. **Entity A** (${entityA}):
   - Name: Clear, accurate name
   - Image Prompt: Concise visual description
   - Attributes: Array of characteristics with category, value, and isShared flag
     - Mark isShared = true for any attribute that BOTH entities have in common
     - Mark isShared = false for unique attributes

3. **Entity B** (${entityB}):
   - Name: Clear, accurate name
   - Image Prompt: Concise visual description
   - Attributes: Array of characteristics with category, value, and isShared flag
     - Use the SAME categories as Entity A where comparing the same aspect
     - Mark isShared = true for any attribute that BOTH entities have in common
     - Mark isShared = false for unique attributes

4. **Shared Attributes**:
   - List all attributes that both entities have in common
   - These should match the attributes marked isShared = true in entityA and entityB
   - Include the category name and the shared value

5. **Key Insight**:
   - Why does this comparison matter?
   - What's the "so what" that helps students understand biology better?
   - Connect to broader concepts (adaptation, classification, function, evolution)
   - Use grade-appropriate language

COMPARISON STRATEGIES BY TYPE:

**Organisms** (e.g., Frog vs Toad, Bee vs Wasp):
- Physical characteristics (size, color, texture, body parts)
- Habitat and distribution
- Diet and feeding behavior
- Reproduction and life cycle
- Adaptations and survival strategies
- Classification (kingdom, phylum, class)

**Cells** (e.g., Plant Cell vs Animal Cell, Prokaryote vs Eukaryote):
- Structure (organelles, membranes, walls)
- Size and shape
- Function and specialization
- Energy production methods
- Reproduction methods
- Evolutionary context

**Organs/Systems** (e.g., Heart vs Lungs, Roots vs Stems):
- Structure and composition
- Primary function
- Location in organism
- Associated tissues
- Processes performed
- Relationship to other systems

**Processes** (e.g., Mitosis vs Meiosis, Photosynthesis vs Respiration):
- Where it occurs (location)
- When it occurs (timing/conditions)
- What goes in (inputs/reactants)
- What comes out (outputs/products)
- Purpose/function
- Number of stages/steps

**Biomes** (e.g., Desert vs Rainforest, Tundra vs Taiga):
- Climate (temperature, precipitation)
- Vegetation (dominant plants)
- Animal life (common organisms)
- Soil characteristics
- Seasonal patterns
- Human impact

QUALITY GUIDELINES:
- Choose attributes that reveal MEANINGFUL differences and similarities
- Avoid trivial comparisons ("both are living things" - too obvious for grades 3+)
- Include "boundary attributes" that challenge thinking (e.g., both frogs and toads are amphibians, but skin texture differs)
- Balance similarities and differences (not all unique, not all shared)
- Use parallel categories (if comparing "diet" for entityA, compare "diet" for entityB)
- Age-appropriate vocabulary and complexity for ${gradeBand}

EXAMPLE (K-2: Dog vs Cat):
{
  "title": "Comparing Our Furry Friends: Dogs and Cats",
  "mode": "side-by-side",
  "entityA": {
    "name": "Dog",
    "imagePrompt": "A friendly golden retriever sitting on grass, wagging its tail",
    "attributes": [
      { "category": "Size", "value": "Usually bigger than a cat", "isShared": false },
      { "category": "Sound", "value": "Barks and growls", "isShared": false },
      { "category": "Behavior", "value": "Loves to play fetch and go for walks", "isShared": false },
      { "category": "Body covering", "value": "Covered in fur", "isShared": true },
      { "category": "Diet", "value": "Eats meat and some plants", "isShared": true }
    ]
  },
  "entityB": {
    "name": "Cat",
    "imagePrompt": "A fluffy orange tabby cat sitting on a windowsill, looking outside",
    "attributes": [
      { "category": "Size", "value": "Usually smaller than a dog", "isShared": false },
      { "category": "Sound", "value": "Meows and purrs", "isShared": false },
      { "category": "Behavior", "value": "Likes to climb and nap in sunny spots", "isShared": false },
      { "category": "Body covering", "value": "Covered in fur", "isShared": true },
      { "category": "Diet", "value": "Eats meat and some plants", "isShared": true }
    ]
  },
  "sharedAttributes": [
    { "category": "Body covering", "value": "Covered in fur" },
    { "category": "Diet", "value": "Eats meat and some plants" }
  ],
  "keyInsight": "Dogs and cats are both furry pets that live in our homes, but they behave differently. Dogs like to play and go outside, while cats like to climb and rest. Both need food and love to be healthy!",
  "gradeBand": "K-2"
}

EXAMPLE (6-8: Mitosis vs Meiosis):
{
  "title": "Cell Division Showdown: Mitosis vs Meiosis",
  "mode": "venn-interactive",
  "entityA": {
    "name": "Mitosis",
    "imagePrompt": "Diagram of mitosis showing one cell dividing into two identical daughter cells with same chromosome number",
    "attributes": [
      { "category": "Number of divisions", "value": "One division cycle", "isShared": false },
      { "category": "Daughter cells produced", "value": "Two genetically identical cells", "isShared": false },
      { "category": "Chromosome number", "value": "Daughter cells are diploid (2n), same as parent", "isShared": false },
      { "category": "Genetic variation", "value": "No genetic variation - clones of parent cell", "isShared": false },
      { "category": "Purpose", "value": "Growth, repair, asexual reproduction", "isShared": false },
      { "category": "Where it occurs", "value": "Somatic (body) cells", "isShared": false },
      { "category": "Phases", "value": "Prophase, Metaphase, Anaphase, Telophase (PMAT)", "isShared": true },
      { "category": "DNA replication", "value": "DNA replicates before division begins", "isShared": true }
    ]
  },
  "entityB": {
    "name": "Meiosis",
    "imagePrompt": "Diagram of meiosis showing one cell dividing twice to produce four non-identical daughter cells with half chromosome number",
    "attributes": [
      { "category": "Number of divisions", "value": "Two division cycles (Meiosis I and II)", "isShared": false },
      { "category": "Daughter cells produced", "value": "Four genetically unique cells", "isShared": false },
      { "category": "Chromosome number", "value": "Daughter cells are haploid (n), half of parent", "isShared": false },
      { "category": "Genetic variation", "value": "High genetic variation due to crossing over and independent assortment", "isShared": false },
      { "category": "Purpose", "value": "Production of gametes (sex cells) for sexual reproduction", "isShared": false },
      { "category": "Where it occurs", "value": "Germ cells (reproductive organs)", "isShared": false },
      { "category": "Phases", "value": "Prophase, Metaphase, Anaphase, Telophase (PMAT) - twice", "isShared": true },
      { "category": "DNA replication", "value": "DNA replicates before division begins", "isShared": true }
    ]
  },
  "sharedAttributes": [
    { "category": "Phases", "value": "Both go through Prophase, Metaphase, Anaphase, and Telophase (PMAT)" },
    { "category": "DNA replication", "value": "DNA replicates during S phase before division begins" },
    { "category": "Cell type", "value": "Both are types of cell division in eukaryotic cells" },
    { "category": "Chromosome condensation", "value": "Chromosomes condense and become visible during prophase" }
  ],
  "keyInsight": "Mitosis and meiosis are both cell division processes, but serve different purposes. Mitosis creates identical cells for growth and repair (like healing a cut), while meiosis creates diverse sex cells for reproduction (sperm and eggs). This is why you look similar to but not identical to your parents - meiosis shuffles genes to create genetic variation, which is essential for evolution and adaptation.",
  "gradeBand": "6-8"
}

Now generate a comparison for "${entityA}" vs "${entityB}" at grade level ${gradeBand}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: compareContrastSchema,
        systemInstruction: `You are an expert biology educator specializing in K-8 life sciences with deep expertise in comparative biology. You create engaging, scientifically accurate comparisons that help students understand similarities and differences between biological entities. You understand developmental psychology and choose attributes, vocabulary, and complexity appropriate for each age group. You make comparisons meaningful by highlighting attributes that reveal important biological concepts like adaptation, classification, function, and systems thinking.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as CompareContrastData;

    // Merge with any config overrides
    const finalData: CompareContrastData = {
      ...result,
      mode, // Ensure mode matches the requested mode
      gradeBand, // Ensure gradeBand matches the requested gradeBand
      ...config,
    };

    console.log('🔄 Compare & Contrast Generated:', {
      entityA: finalData.entityA.name,
      entityB: finalData.entityB.name,
      mode: finalData.mode,
      gradeBand: finalData.gradeBand,
      totalAttributes: finalData.entityA.attributes.length + finalData.entityB.attributes.length,
      sharedAttributes: finalData.sharedAttributes.length
    });

    return finalData;

  } catch (error) {
    console.error("Error generating compare & contrast:", error);
    throw error;
  }
};

/**
 * Generate a comparison from a topic string
 *
 * Useful when the topic contains "vs" or "versus" (e.g., "frogs vs toads",
 * "plant cell versus animal cell")
 *
 * @param topic - Topic string containing both entities (e.g., "mitosis vs meiosis")
 * @param gradeBand - Grade level
 * @param mode - Display mode
 * @returns CompareContrastData
 */
export const generateCompareContrastFromTopic = async (
  topic: string,
  gradeBand: 'K-2' | '3-5' | '6-8' = '3-5',
  mode: 'side-by-side' | 'venn-interactive' = 'side-by-side'
): Promise<CompareContrastData> => {
  // Parse topic to extract entities
  const parts = topic.split(/\s+(?:vs\.?|versus)\s+/i);

  if (parts.length !== 2) {
    throw new Error(`Topic "${topic}" must contain exactly two entities separated by "vs" or "versus"`);
  }

  const [entityA, entityB] = parts.map(s => s.trim());

  return generateCompareContrast(entityA, entityB, gradeBand, mode);
};
