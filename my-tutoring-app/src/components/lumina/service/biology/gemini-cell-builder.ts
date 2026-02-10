import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { CellBuilderData } from "../../primitives/visual-primitives/biology/CellBuilder";

/**
 * Schema definition for Cell Builder Data
 *
 * Three-phase evaluation:
 * Phase 1 (Sort): Students classify organelles as belonging or not belonging in this cell type
 * Phase 2 (Place): Zone-based placement + quantity reasoning for specialized cells
 * Phase 3 (Match): Function matching quiz
 *
 * Handles:
 * - Animal cells (no cell wall, centrioles present) + specialized: muscle, nerve, blood
 * - Plant cells (cell wall, chloroplasts, large central vacuole) + specialized: leaf, root
 * - Prokaryotic cells (no membrane-bound organelles, simpler structure)
 * - Fungal cells (cell wall, no chloroplasts)
 */
const cellBuilderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the cell building activity"
    },
    description: {
      type: Type.STRING,
      description: "Brief instructions for students (1-2 sentences)"
    },
    cellType: {
      type: Type.STRING,
      enum: ["animal", "plant", "prokaryotic", "fungal"],
      description: "Base type of cell to build"
    },
    cellContext: {
      type: Type.STRING,
      description: "Specific cell context, e.g., 'muscle cell', 'nerve cell', 'leaf cell', 'root cell', 'generic animal cell'. Used to drive quantity reasoning."
    },
    organelles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier for the organelle"
          },
          name: {
            type: Type.STRING,
            description: "Name of the organelle (e.g., 'Nucleus', 'Mitochondria')"
          },
          function: {
            type: Type.STRING,
            description: "Brief description of the organelle's function (1 sentence)"
          },
          analogy: {
            type: Type.STRING,
            description: "Real-world analogy to help students understand (e.g., 'Like a power plant for the cell')"
          },
          uniqueTo: {
            type: Type.STRING,
            description: "Which cell type this is unique to, or null if found in all (e.g., 'plant cells only')"
          },
          belongsInCell: {
            type: Type.BOOLEAN,
            description: "true if this organelle belongs in this cell type, false if it is a DISTRACTOR that does NOT belong"
          },
          distractorExplanation: {
            type: Type.STRING,
            description: "For distractors only: brief explanation of why this organelle doesn't belong (e.g., 'Chloroplasts are only found in plant cells'). null for valid organelles."
          },
          correctZone: {
            type: Type.STRING,
            enum: ["center", "peripheral", "near-nucleus", "membrane-associated", "large-central", "scattered"],
            description: "Biological zone where this organelle belongs. null for distractors. center=nucleus/nucleolus, peripheral=cytoplasm throughout, near-nucleus=ER/Golgi/centrioles, membrane-associated=near cell edge, large-central=large vacuole, scattered=distributed throughout"
          },
          sizeRelative: {
            type: Type.STRING,
            enum: ["small", "medium", "large"],
            description: "Relative size of the organelle in the diagram"
          },
          expectedQuantity: {
            type: Type.STRING,
            enum: ["few", "some", "many", "lots"],
            description: "Expected relative quantity in this specific cell context. 'few'=1-2, 'some'=3-5, 'many'=6-10, 'lots'=10+. null for distractors or when quantity is not meaningful."
          },
          quantityReasoning: {
            type: Type.STRING,
            description: "For specialized cells: WHY this quantity is expected (e.g., 'Muscle cells need lots of mitochondria because they use a lot of energy for movement'). null if not applicable."
          }
        },
        required: ["id", "name", "function", "analogy", "belongsInCell", "sizeRelative"]
      },
      description: "5-10 organelles that BELONG in this cell type PLUS 2-4 DISTRACTOR organelles that do NOT belong"
    },
    functionMatches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          organelleId: {
            type: Type.STRING,
            description: "ID of the organelle (must match an organelle with belongsInCell=true)"
          },
          functionDescription: {
            type: Type.STRING,
            description: "Detailed function description for the matching quiz. Should be different wording than the brief 'function' field - more detailed and challenging."
          }
        },
        required: ["organelleId", "functionDescription"]
      },
      description: "Function descriptions for Phase 3 matching quiz. One per valid (non-distractor) organelle."
    },
    cellMembrane: {
      type: Type.OBJECT,
      properties: {
        description: {
          type: Type.STRING,
          description: "Brief description of the cell membrane"
        },
        function: {
          type: Type.STRING,
          description: "What the cell membrane does"
        }
      },
      required: ["description", "function"]
    },
    cellWall: {
      type: Type.OBJECT,
      properties: {
        present: {
          type: Type.BOOLEAN,
          description: "Whether the cell has a cell wall (true for plant, prokaryotic, fungal)"
        },
        description: {
          type: Type.STRING,
          description: "Description of the cell wall (null if not present)"
        }
      },
      required: ["present"]
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["4-5", "6-8"],
      description: "Target grade band - determines complexity and terminology"
    }
  },
  required: ["title", "description", "cellType", "cellContext", "organelles", "functionMatches", "cellMembrane", "cellWall", "gradeBand"]
};

/**
 * Generate cell builder data using Gemini AI
 *
 * Creates a three-phase cell biology activity:
 * Phase 1: Sort organelles (belongs vs distractor)
 * Phase 2: Place organelles in biological zones + quantity reasoning
 * Phase 3: Match organelles to their functions
 *
 * Supports specialized cell contexts (muscle, nerve, leaf, root) that
 * drive quantity reasoning (e.g., "muscle cells need lots of mitochondria").
 *
 * @param topic - The cell topic (e.g., "muscle cell", "plant cell", "nerve cell")
 * @param gradeBand - Grade level ('4-5' or '6-8') determines complexity
 * @param config - Optional partial configuration to override generated values
 * @returns CellBuilderData with three-phase cell activity
 */
export const generateCellBuilder = async (
  topic: string,
  gradeBand: '4-5' | '6-8' = '4-5',
  config?: Partial<CellBuilderData>
): Promise<CellBuilderData> => {

  const gradeContext = {
    '4-5': `
GRADE 4-5 GUIDELINES:
- Use simpler vocabulary with everyday analogies for each organelle
- Include 5-7 major organelles that BELONG (nucleus, mitochondria, cell membrane, cytoplasm, vacuole, and cell-type-specific ones)
- Include 2-3 DISTRACTOR organelles from other cell types
- Analogies should reference things kids know (school, factory, power plant, post office)
- Functions described in 1 simple sentence
- For plant cells: add chloroplasts and cell wall as valid; add centrioles as distractor
- For animal cells: add chloroplasts, cell wall, large central vacuole as distractors
- DO NOT include complex organelles like ER or Golgi for this grade band
- Quantity reasoning: use simple language ("This cell needs LOTS of these because...")
- Function match descriptions: simple, clear, 1 sentence
`,
    '6-8': `
GRADE 6-8 GUIDELINES:
- Use proper scientific terminology
- Include 7-10 organelles that BELONG, including specialized ones (ER, Golgi apparatus, lysosomes, ribosomes)
- Include 3-4 DISTRACTOR organelles from other cell types
- More detailed function descriptions
- Analogies can be more sophisticated (shipping department, recycling center, quality control)
- For prokaryotic cells: include ribosomes, cell membrane, cell wall, nucleoid region; distractors = nucleus, ER, mitochondria
- Include organelles unique to specific cell types (centrioles for animal, chloroplasts for plant)
- Quantity reasoning: include scientific reasoning ("Mitochondria are abundant in muscle cells because oxidative phosphorylation provides ATP for sustained contraction")
- Function match descriptions: more detailed, may reference biochemical processes
`
  };

  const generationPrompt = `Create a three-phase cell biology activity for: "${topic}".

TARGET GRADE BAND: ${gradeBand}

${gradeContext[gradeBand]}

ACTIVITY STRUCTURE:
This is a three-phase activity testing biological understanding:
1. SORT PHASE: Students classify which organelles belong in this cell and which don't
2. PLACE PHASE: Students place organelles in the correct biological zone of the cell + answer quantity questions
3. MATCH PHASE: Students match organelles to their function descriptions

REQUIREMENTS:

1. **Cell Type & Context**: Determine the base cell type (animal/plant/prokaryotic/fungal) AND the specific context.
   - "muscle cell" → cellType: "animal", cellContext: "muscle cell"
   - "leaf cell" → cellType: "plant", cellContext: "leaf cell"
   - "animal cell" → cellType: "animal", cellContext: "generic animal cell"
   - "bacteria" → cellType: "prokaryotic", cellContext: "generic prokaryotic cell"
   - "nerve cell" → cellType: "animal", cellContext: "nerve cell"
   - "root cell" → cellType: "plant", cellContext: "root cell"

2. **Organelles (valid + distractors)**:
   Include BOTH organelles that belong AND 2-4 distractor organelles that do NOT belong.

   For each VALID organelle:
   - belongsInCell: true
   - correctZone: one of "center", "peripheral", "near-nucleus", "membrane-associated", "large-central", "scattered"
   - expectedQuantity: relative amount for this SPECIFIC cell context
   - quantityReasoning: WHY this cell has this many (especially for specialized cells)

   For each DISTRACTOR organelle:
   - belongsInCell: false
   - distractorExplanation: brief reason why it doesn't belong
   - correctZone: null (omit)
   - expectedQuantity: null (omit)

   ZONE ASSIGNMENT RULES:
   - Nucleus/nucleolus → "center"
   - Mitochondria → "peripheral" (scattered through cytoplasm)
   - Endoplasmic Reticulum → "near-nucleus"
   - Golgi Apparatus → "near-nucleus"
   - Ribosomes → "scattered"
   - Lysosomes → "scattered"
   - Centrioles → "near-nucleus"
   - Large central vacuole (plant) → "large-central"
   - Small vacuoles → "peripheral"
   - Chloroplasts → "scattered"
   - Flagella/cilia → "membrane-associated"
   - Cell membrane proteins → "membrane-associated"

3. **Quantity Reasoning (CRITICAL for specialized cells)**:
   For specialized cell contexts, set expectedQuantity based on the cell's function:
   - Muscle cell: mitochondria = "lots" (energy for contraction), ribosomes = "many" (protein synthesis)
   - Nerve cell: mitochondria = "many" (energy for signal transmission), ER = "many" (neurotransmitter packaging)
   - Leaf cell: chloroplasts = "lots" (photosynthesis), mitochondria = "some"
   - Root cell: mitochondria = "many" (active transport), vacuole = "some" (water storage)
   - Red blood cell: NO nucleus, NO mitochondria (special case - make these distractors!)
   - Generic cells: use "some" for most organelles, "few" for specialized ones

   ALWAYS include quantityReasoning for any organelle with expectedQuantity "many" or "lots".

4. **Function Matches**: For EACH valid (belongsInCell=true) organelle, provide a detailed function description
   that uses DIFFERENT wording than the brief "function" field. This is for the Phase 3 matching quiz.
   Make them challenging but fair - students should need to think, not just pattern-match words.

5. **Cell Membrane**: Always present. Describe what it does.

6. **Cell Wall**: Present for plant, prokaryotic, and fungal cells. Absent for animal cells.

COMMON DISTRACTOR PAIRINGS:
- Animal cell distractors: chloroplasts, cell wall, large central vacuole
- Plant cell distractors: centrioles, lysosomes (fewer in plants)
- Prokaryotic cell distractors: nucleus, mitochondria, ER, Golgi (no membrane-bound organelles!)
- Fungal cell distractors: chloroplasts, centrioles

Now generate the activity for "${topic}" at grade level ${gradeBand}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: cellBuilderSchema,
        systemInstruction: `You are an expert cell biology educator specializing in K-8 life sciences. You understand how students develop understanding of cell structure and function. You create engaging, accurate cell biology activities with age-appropriate vocabulary and helpful analogies. You know the correct organelles for each cell type, their biological zones within the cell, and how specialized cells differ in organelle composition and quantity. You always include distractor organelles that students commonly confuse with valid ones.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as CellBuilderData;

    // Merge with any config overrides
    const finalData: CellBuilderData = {
      ...result,
      ...config,
    };

    const validCount = finalData.organelles.filter(o => o.belongsInCell).length;
    const distractorCount = finalData.organelles.filter(o => !o.belongsInCell).length;

    console.log('🔬 Cell Builder Generated:', {
      title: finalData.title,
      cellType: finalData.cellType,
      cellContext: finalData.cellContext,
      validOrganelles: validCount,
      distractors: distractorCount,
      functionMatches: finalData.functionMatches.length,
      gradeBand: finalData.gradeBand,
    });

    return finalData;

  } catch (error) {
    console.error("Error generating cell builder:", error);
    throw error;
  }
};
