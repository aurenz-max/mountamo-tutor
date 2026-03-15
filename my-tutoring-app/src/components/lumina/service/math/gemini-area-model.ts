import { Type, Schema } from "@google/genai";
import { AreaModelData } from "../../primitives/visual-primitives/math/AreaModel";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  build_model: {
    promptDoc:
      `"build_model": Given two factors, student constructs the area model grid. `
      + `IMPORTANT: At least one factor MUST be decomposed into 2+ parts `
      + `(e.g., 3 × 14 → factor1Parts=[3], factor2Parts=[10,4] for a 1×2 grid, `
      + `or 12 × 8 → factor1Parts=[10,2], factor2Parts=[8] for a 2×1 grid). `
      + `A 1×1 grid is NOT a valid area model — decomposition is the whole point. `
      + `showPartialProducts = false so student fills them in. `
      + `Grades 3-4. Concrete manipulative level.`,
    schemaDescription: "'build_model' (construct area model from factors)",
  },
  find_area: {
    promptDoc:
      `"find_area": Area model is shown with factor decomposition visible. `
      + `Student calculates each partial product cell and finds the total area. `
      + `Use 2-digit × 1-digit or 2-digit × 2-digit factors. `
      + `showDimensions = true, showPartialProducts = false. `
      + `Grades 3-4. Pictorial with prompts.`,
    schemaDescription: "'find_area' (calculate partial products and total)",
  },
  multiply: {
    promptDoc:
      `"multiply": Multi-digit × multi-digit multiplication using area model decomposition. `
      + `MUST be harder than find_area — use 3-digit × 2-digit numbers `
      + `(e.g., 145 × 23 → factor1Parts=[100,40,5], factor2Parts=[20,3]) `
      + `or use 3-part decompositions for at least one factor. `
      + `The grid should be at least 2×3 or 3×2. `
      + `Grades 4-5. Pictorial with reduced prompts.`,
    schemaDescription: "'multiply' (multi-digit multiplication via model)",
  },
  factor: {
    promptDoc:
      `"factor": Reverse operation — student sees partial products in each cell `
      + `and must discover the factor decomposition (dimension labels). `
      + `showDimensions = false (student discovers them), showPartialProducts = true. `
      + `Use 2-digit × 2-digit numbers with 2×2 grid. `
      + `CRITICAL: The title MUST state the correct product (sum of all partial products). `
      + `Grades 5-6. Transitional symbolic/pictorial.`,
    schemaDescription: "'factor' (find factors from given area)",
  },
};

// ---------------------------------------------------------------------------
// Schema definition for Area Model Data
// ---------------------------------------------------------------------------

/**
 * Schema definition for Area Model Data
 *
 * This schema defines the structure for area model visualization,
 * including factor decomposition, partial products, and algebraic extensions.
 */
const areaModelSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challengeType: {
      type: Type.STRING,
      description: "Challenge type: 'build_model' (construct area model from factors), 'find_area' (calculate partial products and total), 'multiply' (multi-digit multiplication via model), 'factor' (find factors from given area)",
      enum: ["build_model", "find_area", "multiply", "factor"],
    },
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
  required: ["challengeType", "title", "description", "factor1Parts", "factor2Parts"]
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
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
  }
): Promise<AreaModelData> => {
  // ---------------------------------------------------------------------------
  // Eval mode resolution
  // ---------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    'area-model',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('AreaModel', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(areaModelSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, { fieldName: 'challengeType', rootLevel: true })
    : areaModelSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

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

${challengeTypeSection}

CONTEXT:
- Area models are rectangular grids representing multiplication as area
- Each dimension is decomposed into parts (e.g., 23 = 20 + 3)
- Cells show partial products that sum to the final answer
- Excellent for multi-digit multiplication and distributive property
- Can extend to polynomial multiplication in algebra

${!evalConstraint ? `GUIDELINES FOR GRADE LEVELS:
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
` : ''}
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
9. ${evalConstraint ? 'Use ONLY the allowed challenge type' : 'Choose the most appropriate challenge type for the topic and grade level'}

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
      responseSchema: activeSchema
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

  // Validation: ensure challengeType is valid
  const validChallengeTypes = ['build_model', 'find_area', 'multiply', 'factor'];
  if (!data.challengeType || !validChallengeTypes.includes(data.challengeType)) {
    data.challengeType = evalConstraint?.allowedTypes[0] ?? 'find_area';
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

  // ---------------------------------------------------------------------------
  // Mode-specific post-validation (fixes eval report issues)
  // ---------------------------------------------------------------------------

  // build_model: ensure at least one factor has 2+ parts (no trivial 1×1 grids)
  if (data.challengeType === 'build_model') {
    data.showPartialProducts = false; // student fills these in
    if (Math.max(data.factor1Parts.length, data.factor2Parts.length) < 2) {
      // Decompose the larger factor by place value
      const f1Total = data.factor1Parts.reduce((s: number, v: number) => s + v, 0);
      const f2Total = data.factor2Parts.reduce((s: number, v: number) => s + v, 0);
      const larger = Math.max(f1Total, f2Total);
      if (larger >= 10) {
        const tens = Math.floor(larger / 10) * 10;
        const ones = larger - tens;
        const parts = ones > 0 ? [tens, ones] : [tens];
        if (f1Total >= f2Total) {
          data.factor1Parts = parts;
        } else {
          data.factor2Parts = parts;
        }
      } else {
        // Both single-digit: split the larger into friendly parts
        const splitTarget = Math.max(f1Total, f2Total);
        const half = Math.floor(splitTarget / 2);
        const remainder = splitTarget - half;
        if (f1Total >= f2Total) {
          data.factor1Parts = [half, remainder];
        } else {
          data.factor2Parts = [half, remainder];
        }
      }
      console.warn('build_model: decomposed factor to avoid trivial 1×1 grid');
    }
  }

  // find_area: force correct display settings
  if (data.challengeType === 'find_area') {
    data.showPartialProducts = false; // student calculates these
    data.showDimensions = true;
  }

  // multiply: ensure harder than find_area (3-digit×2-digit or 3-part decomposition)
  if (data.challengeType === 'multiply') {
    data.showPartialProducts = false; // student calculates these
    const f1Total = data.factor1Parts.reduce((s: number, v: number) => s + v, 0);
    const f2Total = data.factor2Parts.reduce((s: number, v: number) => s + v, 0);
    const maxParts = Math.max(data.factor1Parts.length, data.factor2Parts.length);
    const maxTotal = Math.max(f1Total, f2Total);

    // If grid is only 2×2 with small numbers, upgrade to 3-part decomposition
    if (maxParts < 3 && maxTotal < 100) {
      // Redecompose the larger factor into 3 parts by place value
      if (f1Total >= f2Total && f1Total >= 10) {
        const hundreds = Math.floor(f1Total / 100) * 100;
        const tens = Math.floor((f1Total - hundreds) / 10) * 10;
        const ones = f1Total - hundreds - tens;
        if (hundreds > 0) {
          data.factor1Parts = ones > 0 ? [hundreds, tens, ones] : [hundreds, tens || 1];
        } else {
          // Number is < 100, bump it up
          const bumped = f1Total + 100;
          data.factor1Parts = [100, Math.floor((bumped - 100) / 10) * 10, (bumped - 100) % 10 || 1];
          console.warn(`multiply: bumped factor1 from ${f1Total} to ${bumped} for difficulty`);
        }
      } else if (f2Total >= 10) {
        const hundreds = Math.floor(f2Total / 100) * 100;
        const tens = Math.floor((f2Total - hundreds) / 10) * 10;
        const ones = f2Total - hundreds - tens;
        if (hundreds > 0) {
          data.factor2Parts = ones > 0 ? [hundreds, tens, ones] : [hundreds, tens || 1];
        } else {
          const bumped = f2Total + 100;
          data.factor2Parts = [100, Math.floor((bumped - 100) / 10) * 10, (bumped - 100) % 10 || 1];
          console.warn(`multiply: bumped factor2 from ${f2Total} to ${bumped} for difficulty`);
        }
      }
    }
  }

  // factor: force correct display settings and validate title product
  if (data.challengeType === 'factor') {
    data.showDimensions = false; // student discovers dimensions
    data.showPartialProducts = true; // show products so student can reverse-engineer
    // Fix title if the stated product doesn't match the actual product
    const actualProduct = data.factor1Parts.reduce((s: number, v: number) => s + v, 0)
      * data.factor2Parts.reduce((s: number, v: number) => s + v, 0);
    const titleMatch = data.title.match(/\d+/g);
    if (titleMatch) {
      const titleNumbers = titleMatch.map(Number);
      // If the title contains a number that doesn't match the actual product,
      // rewrite the title with the correct product
      const hasCorrectProduct = titleNumbers.includes(actualProduct);
      if (!hasCorrectProduct) {
        data.title = `Finding the Factors of ${actualProduct} Using the Area Model`;
        console.warn(`factor: corrected title product from stated value to ${actualProduct}`);
      }
    }
  }

  return data;
};
