import { Type, Schema, ThinkingLevel } from "@google/genai";
import { AreaModelData } from "../../types";
import { ai } from "../geminiClient";

/**
 * Schema definition for Area Model Data
 *
 * This schema defines the structure for area model visualization,
 * including factor decomposition, partial products, and algebraic extensions.
 */
const areaModelSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the area model (e.g., 'Multiplying 23 × 15 using Area Model')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn from this visualization"
    },
    factor1Parts: {
      type: Type.ARRAY,
      items: {
        type: Type.NUMBER,
        description: "Parts of first factor decomposition"
      },
      description: "Decomposition of first factor (e.g., [20, 3] for 23). For algebraic: use coefficient values"
    },
    factor2Parts: {
      type: Type.ARRAY,
      items: {
        type: Type.NUMBER,
        description: "Parts of second factor decomposition"
      },
      description: "Decomposition of second factor (e.g., [10, 5] for 15). For algebraic: use coefficient values"
    },
    showPartialProducts: {
      type: Type.BOOLEAN,
      description: "Display products in cells. Default: true"
    },
    showDimensions: {
      type: Type.BOOLEAN,
      description: "Label side lengths. Default: true"
    },
    algebraicMode: {
      type: Type.BOOLEAN,
      description: "Allow variable terms for polynomial multiplication. Use for algebra topics. Default: false"
    },
    highlightCell: {
      type: Type.ARRAY,
      items: {
        type: Type.NUMBER
      },
      description: "Emphasize specific cell [row, col]. Use to focus attention. Example: [0, 1]. Use null for no highlight.",
      nullable: true
    },
    showAnimation: {
      type: Type.BOOLEAN,
      description: "Animate assembly of final product. Good for first introduction. Default: false"
    },
    labels: {
      type: Type.OBJECT,
      properties: {
        factor1: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          },
          description: "Custom labels for factor1Parts (e.g., ['2x', '3'] for algebraic). Use only in algebraicMode."
        },
        factor2: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          },
          description: "Custom labels for factor2Parts (e.g., ['x', '4'] for algebraic). Use only in algebraicMode."
        }
      },
      description: "Custom labels for algebraic mode. Only include when algebraicMode is true.",
      nullable: true
    }
  },
  required: ["title", "description", "factor1Parts", "factor2Parts"]
};

/**
 * Generate area model data for visualization
 *
 * This function creates area model data including:
 * - Appropriate factor decompositions based on topic and grade level
 * - Configuration for partial products visualization
 * - Support for both numeric and algebraic multiplication
 * - Educational context and descriptions
 * - Interactive features configuration
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns AreaModelData with complete configuration
 */
export const generateAreaModel = async (
  topic: string,
  gradeLevel: string,
  config?: {
    factor1Parts?: number[];
    factor2Parts?: number[];
    showPartialProducts?: boolean;
    showDimensions?: boolean;
    algebraicMode?: boolean;
    highlightCell?: [number, number] | null;
    showAnimation?: boolean;
    labels?: {
      factor1?: string[];
      factor2?: string[];
    };
  }
): Promise<AreaModelData> => {
  // Generate 6-10 random number pairs to encourage variety
  const numPairs = 6 + Math.floor(Math.random() * 5); // 6-10 pairs
  const randomPairs: string[] = [];

  for (let i = 0; i < numPairs; i++) {
    const num1 = 10 + Math.floor(Math.random() * 31); // 10-40
    const num2 = Math.floor(Math.random() * 31); // 1-30
    randomPairs.push(`${num1}×${num2}`);
  }

  const prompt = `
Create an educational area model visualization for teaching "${topic}" to ${gradeLevel} students.

RANDOMIZATION GUIDANCE: Consider these diverse number combinations for variety: ${randomPairs.join(', ')}
IMPORTANT: Generate DIFFERENT and VARIED numbers each time. Vary the tens and ones digits across the full range appropriate for the grade level.

CONTEXT:
- Area models are rectangular grids representing multiplication as area
- Each dimension is decomposed into parts (e.g., 23 = 20 + 3)
- Cells show partial products that sum to the final answer
- Excellent for multi-digit multiplication and distributive property
- Can extend to polynomial multiplication in algebra

GUIDELINES FOR GRADE LEVELS:
- Grades 3-4: Single-digit × double-digit (e.g., 3 × 12 = 3 × [10 + 2])
  - Use 2 parts for one factor, 1 part for other
  - Keep numbers small (under 20)
  - Always show partial products and dimensions

- Grades 4-5: Multi-digit multiplication (e.g., 23 × 15)
  - Decompose both factors into 2 parts (tens and ones)
  - Use 2×2 grid
  - Show partial products breakdown

- Grades 6-7: Larger numbers, introduction to distributive property
  - Can use 3 parts for decomposition (hundreds, tens, ones)
  - Use 2×3 or 3×3 grids
  - Emphasize connection to standard algorithm

- Algebra (Grades 8+): Polynomial multiplication
  - Use algebraicMode = true
  - Provide labels with variables (e.g., ["2x", "3"], ["x", "4"])
  - Show (2x + 3)(x + 4) = 2x² + 8x + 3x + 12
  - Keep to 2×2 grids for clarity

TOPIC-SPECIFIC GUIDANCE:
- "Single-digit multiplication": Use 1×1 grid with simple decomposition
- "Multi-digit multiplication": Use 2×2 grid, decompose by place value
- "Distributive property": Highlight one cell to show distribution
- "Polynomial multiplication": Use algebraicMode with variable labels
- "Factoring": Reverse process - start with area, find dimensions
- "FOIL method": 2×2 grid with (a+b)(c+d) structure

DECOMPOSITION STRATEGIES:
- By place value: 23 = [20, 3], 145 = [100, 40, 5]
- By friendly numbers: 24 = [20, 4] or [10, 10, 4]
- For algebra: (2x + 3) = ["2x", "3"]

CONFIGURATION RULES:
1. factor1Parts and factor2Parts should have 1-3 elements each
2. For beginners: Use 1×2 or 2×2 grids
3. For advanced: Can use up to 3×3 grids
4. showPartialProducts = true (almost always, unless practicing mental math)
5. showDimensions = true (always for learning)
6. algebraicMode = true ONLY for polynomial topics
7. highlightCell = [row, col] to emphasize specific partial product
8. showAnimation = true for first introduction to concept
9. labels object ONLY when algebraicMode = true

${config ? `
CONFIGURATION HINTS:
${config.factor1Parts ? `- Factor 1 decomposition: ${JSON.stringify(config.factor1Parts)}` : ''}
${config.factor2Parts ? `- Factor 2 decomposition: ${JSON.stringify(config.factor2Parts)}` : ''}
${config.showPartialProducts !== undefined ? `- Show partial products: ${config.showPartialProducts}` : ''}
${config.showDimensions !== undefined ? `- Show dimensions: ${config.showDimensions}` : ''}
${config.algebraicMode !== undefined ? `- Algebraic mode: ${config.algebraicMode}` : ''}
${config.highlightCell ? `- Highlight cell: ${JSON.stringify(config.highlightCell)}` : ''}
${config.showAnimation !== undefined ? `- Show animation: ${config.showAnimation}` : ''}
${config.labels ? `- Custom labels: ${JSON.stringify(config.labels)}` : ''}
` : ''}

REQUIREMENTS:
1. Choose appropriate factor decompositions based on topic and grade level
2. For numeric multiplication: Use place value decomposition
3. For algebraic multiplication: Set algebraicMode = true and provide labels
4. Write a clear, student-friendly title describing the multiplication
5. Provide an educational description explaining the area model strategy
6. Enable showAnimation for introduction lessons
7. Use highlightCell to draw attention to specific concepts
8. Ensure factor1Parts and factor2Parts create a manageable grid (max 3×3)

EXAMPLES:
- Elementary (23 × 15):
  factor1Parts: [20, 3]
  factor2Parts: [10, 5]
  algebraicMode: false

- Algebra ((2x + 3)(x + 4)):
  factor1Parts: [2, 3]  // Coefficients for calculation
  factor2Parts: [1, 4]  // Coefficients for calculation
  algebraicMode: true
  labels: { factor1: ["2x", "3"], factor2: ["x", "4"] }

IMPORTANT:
- Always provide numeric values in factor1Parts and factor2Parts arrays
- Labels are ONLY for display in algebraicMode - the parts arrays still need numbers
- Keep grids reasonably sized (prefer 2×2, max 3×3)
- For polynomial multiplication: factor1Parts/factor2Parts are coefficients, labels show the algebraic terms

Return the complete area model configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: areaModelSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid area model data returned from Gemini API');
  }

  // Validation: ensure arrays are not empty
  if (!data.factor1Parts || data.factor1Parts.length === 0) {
    console.warn('Invalid area model: factor1Parts is empty. Setting default [10, 2].');
    data.factor1Parts = [10, 2];
  }

  if (!data.factor2Parts || data.factor2Parts.length === 0) {
    console.warn('Invalid area model: factor2Parts is empty. Setting default [10, 3].');
    data.factor2Parts = [10, 3];
  }

  // Validation: if algebraicMode is false, remove labels
  if (!data.algebraicMode) {
    delete data.labels;
  }

  // Validation: if labels exist, ensure they match array lengths
  if (data.labels) {
    if (data.labels.factor1 && data.labels.factor1.length !== data.factor1Parts.length) {
      console.warn('Mismatch between factor1Parts and labels.factor1 lengths. Removing labels.');
      delete data.labels;
    }
    if (data.labels.factor2 && data.labels.factor2.length !== data.factor2Parts.length) {
      console.warn('Mismatch between factor2Parts and labels.factor2 lengths. Removing labels.');
      delete data.labels;
    }
  }

  // Apply any explicit config overrides from manifest
  if (config) {
    if (config.factor1Parts) data.factor1Parts = config.factor1Parts;
    if (config.factor2Parts) data.factor2Parts = config.factor2Parts;
    if (config.showPartialProducts !== undefined) data.showPartialProducts = config.showPartialProducts;
    if (config.showDimensions !== undefined) data.showDimensions = config.showDimensions;
    if (config.algebraicMode !== undefined) data.algebraicMode = config.algebraicMode;
    if (config.highlightCell !== undefined) data.highlightCell = config.highlightCell;
    if (config.showAnimation !== undefined) data.showAnimation = config.showAnimation;
    if (config.labels) data.labels = config.labels;
  }

  // Set defaults for optional fields if not present
  if (data.showPartialProducts === undefined) data.showPartialProducts = true;
  if (data.showDimensions === undefined) data.showDimensions = true;
  if (data.algebraicMode === undefined) data.algebraicMode = false;
  if (data.showAnimation === undefined) data.showAnimation = false;
  if (data.highlightCell === undefined) data.highlightCell = null;

  return data;
};
