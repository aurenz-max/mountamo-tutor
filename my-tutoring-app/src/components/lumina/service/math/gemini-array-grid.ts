import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// Import the data type from the component - single source of truth
import { ArrayGridData } from "../../primitives/visual-primitives/math/ArrayGrid";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  build_array: {
    promptDoc:
      `"build_array": Student builds an array with given row and column counts. `
      + `Concrete manipulative — use small dimensions (2-5). `
      + `Grades 2-3. Description should tell student to set rows and columns, then count the total. `
      + `IMPORTANT: Title must NOT contain multiplication notation like "3 × 5" — use neutral titles like "Build an Array" or "Star Array Challenge".`,
    schemaDescription: "'build_array' (build array with given dimensions)",
  },
  count_array: {
    promptDoc:
      `"count_array": Array is displayed pre-built, student counts total objects. `
      + `Skip counting or multiplication. Grades 2-3. `
      + `Description should ask student to count the total items in the shown array.`,
    schemaDescription: "'count_array' (count total from displayed array)",
  },
  multiply_array: {
    promptDoc:
      `"multiply_array": Array is shown, student writes the multiplication sentence (rows × columns = total). `
      + `Grades 3-4. Description should ask student to write the multiplication fact for the array.`,
    schemaDescription: "'multiply_array' (write multiplication sentence from array)",
  },
};

/**
 * Schema definition for Array Grid Data
 *
 * Simple task: Student builds an array with specific dimensions, then calculates total.
 */
const arrayGridSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Task title. For build_array: use neutral titles WITHOUT multiplication notation (e.g., 'Star Array Challenge', 'Build an Array'). For count_array/multiply_array: descriptive titles (e.g., 'Count the Array', 'Multiplication Fact')."
    },
    description: {
      type: Type.STRING,
      description: "Clear instructions (e.g., 'Use the row and column buttons to build an array that shows 3 rows of 5 stars. How many stars will there be in total?')"
    },

    // Challenge type for eval mode targeting
    challengeType: {
      type: Type.STRING,
      description: "Challenge type: 'build_array' (build array with given dimensions), 'count_array' (count total from displayed array), 'multiply_array' (write multiplication sentence from array)",
      enum: ["build_array", "count_array", "multiply_array"]
    },

    // Required: target dimensions
    targetRows: {
      type: Type.NUMBER,
      description: "Number of rows (e.g., 3). MUST be between 1 and 6 inclusive — the component caps row buttons at 6."
    },
    targetColumns: {
      type: Type.NUMBER,
      description: "Number of columns (e.g., 5). MUST be between 1 and 8 inclusive — the component caps column buttons at 8."
    },

    // Display options
    iconType: {
      type: Type.STRING,
      description: "Icon type: 'dot' (general), 'square' (area models), 'star' (engaging for young students)",
      enum: ["dot", "square", "star"]
    },
    showLabels: {
      type: Type.BOOLEAN,
      description: "Show row and column numbers (default true)"
    },
    maxRows: {
      type: Type.NUMBER,
      description: "Maximum rows in button panel (default 10, range 6-10)"
    },
    maxColumns: {
      type: Type.NUMBER,
      description: "Maximum columns in button panel (default 12, range 6-12)"
    }
  },
  required: ["title", "description", "challengeType", "targetRows", "targetColumns"]
};

/**
 * Generate array grid problems
 *
 * Task: Student builds an array with specific dimensions, then calculates the total.
 *
 * @param topic - The math concept to teach
 * @param gradeLevel - Grade level for age-appropriate tasks
 * @param config - Optional configuration hints
 * @returns ArrayGridData with task configuration
 */
export const generateArrayGrid = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<ArrayGridData> & {
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
  }
): Promise<ArrayGridData> => {
  // ---------------------------------------------------------------------------
  // Eval mode resolution
  // ---------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    'array-grid',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('ArrayGrid', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(arrayGridSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : arrayGridSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const prompt = `
Create an array building task for teaching "${topic}" to ${gradeLevel} students.

${challengeTypeSection}

TASK FORMAT:
Students will:
1. Use row and column buttons to build an array with specific dimensions
2. Once built, enter the total number of items
3. Submit their answer for evaluation

=== GRADE LEVEL GUIDELINES ===

Grade K-1:
- Simple arrays: 2×2, 2×3, 3×3
- targetRows: 2-3
- targetColumns: 2-3
- Use 'star' icons for engagement

Grade 2:
- Basic multiplication: products up to 25
- targetRows: 2-5
- targetColumns: 2-5
- Use 'star' or 'dot' icons

Grade 3:
- Multiplication facts through 6×8
- targetRows: 2-6
- targetColumns: 2-8
- Use 'dot' for general, 'square' for area models

Grade 4-5:
- Larger products within 6×8 grid
- targetRows: 3-6
- targetColumns: 4-8
- Use 'square' for area/measurement contexts

=== CHALLENGE TYPE SPECIFICS ===

For "build_array":
- Student must use buttons to set rows and columns, then count total
- Description should guide: "Use the row and column buttons to build an array..."
- Keep dimensions small (2-5 range)

For "count_array":
- Array is pre-built (the component shows it), student counts total
- Description: "Look at this array and count the total number of items."
- Encourage skip counting by rows or columns

For "multiply_array":
- Array is shown, student writes the multiplication sentence
- Description: "Write the multiplication fact shown by this array."
- Focus on rows × columns = total

=== EXAMPLE OUTPUTS ===

Example for "build_array":
{
  "title": "Star Array Challenge",
  "description": "Use the row and column buttons to build an array that shows 3 rows of 5 stars. How many stars will there be in total?",
  "challengeType": "build_array",
  "targetRows": 3,
  "targetColumns": 5,
  "iconType": "star",
  "showLabels": true,
  "maxRows": 6,
  "maxColumns": 8
}

Example for "count_array":
{
  "title": "Count the Array",
  "description": "Look at this array of dots. Count the total number of dots. Try skip counting by rows!",
  "challengeType": "count_array",
  "targetRows": 4,
  "targetColumns": 6,
  "iconType": "dot",
  "showLabels": true,
  "maxRows": 6,
  "maxColumns": 8
}

Example for "multiply_array":
{
  "title": "Write the Multiplication Fact",
  "description": "Look at this array. Write the multiplication sentence that matches: how many rows × how many columns = total?",
  "challengeType": "multiply_array",
  "targetRows": 4,
  "targetColumns": 6,
  "iconType": "square",
  "showLabels": true,
  "maxRows": 6,
  "maxColumns": 8
}

=== WRITING INSTRUCTIONS ===

Title: Clear, concise (e.g., "Build an Array for 3 × 5")

Description: Explain the steps based on challenge type:
- build_array: Step 1: Build the array, Step 2: Count/calculate total
- count_array: Count the total items in the array shown
- multiply_array: Write the multiplication sentence for the array

Use age-appropriate language:
- K-2: "How many [items] will there be in total?"
- 3-5: "Calculate the total number of [items]"

${config ? `
CONFIGURATION HINTS (use these to guide your response):
${JSON.stringify(config, null, 2)}
` : ''}

Return a complete task configuration. Make it educational, clear, and age-appropriate.
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
    throw new Error('No valid array grid data returned from Gemini API');
  }

  // Validation and defaults
  data.iconType = data.iconType || 'star';
  data.showLabels = data.showLabels !== false;
  data.maxRows = data.maxRows || 10;
  data.maxColumns = data.maxColumns || 12;
  data.challengeType = data.challengeType || 'build_array';

  // Ensure target dimensions are set
  if (!data.targetRows || !data.targetColumns) {
    console.warn('Array Grid missing target dimensions. Setting defaults.');
    data.targetRows = data.targetRows || 3;
    data.targetColumns = data.targetColumns || 4;
  }

  // Apply any explicit config overrides
  if (config) {
    if (config.targetRows !== undefined) data.targetRows = config.targetRows;
    if (config.targetColumns !== undefined) data.targetColumns = config.targetColumns;
    if (config.iconType !== undefined) data.iconType = config.iconType;
    if (config.showLabels !== undefined) data.showLabels = config.showLabels;
    if (config.maxRows !== undefined) data.maxRows = config.maxRows;
    if (config.maxColumns !== undefined) data.maxColumns = config.maxColumns;
  }

  return data;
};
