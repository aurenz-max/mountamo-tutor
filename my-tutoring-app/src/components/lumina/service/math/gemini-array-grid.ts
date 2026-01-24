import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component - single source of truth
import { ArrayGridData } from "../../primitives/visual-primitives/math/ArrayGrid";

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
      description: "Task title (e.g., 'Build an Array for 3 × 5')"
    },
    description: {
      type: Type.STRING,
      description: "Clear instructions (e.g., 'Use the row and column buttons to build an array that shows 3 rows of 5 stars. How many stars will there be in total?')"
    },

    // Required: target dimensions
    targetRows: {
      type: Type.NUMBER,
      description: "Number of rows the student must build (e.g., 3)"
    },
    targetColumns: {
      type: Type.NUMBER,
      description: "Number of columns the student must build (e.g., 5)"
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
  required: ["title", "description", "targetRows", "targetColumns"]
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
  config?: Partial<ArrayGridData>
): Promise<ArrayGridData> => {
  const prompt = `
Create an array building task for teaching "${topic}" to ${gradeLevel} students.

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
- Multiplication facts through 10×10
- targetRows: 2-7
- targetColumns: 2-8
- Use 'dot' for general, 'square' for area models

Grade 4-5:
- Larger products and area models
- targetRows: 2-10
- targetColumns: 2-12
- Use 'square' for area/measurement contexts

=== EXAMPLE OUTPUTS ===

Example for "3×5 multiplication":
{
  "title": "Build an Array for 3 × 5",
  "description": "Use the row and column buttons to build an array that shows 3 rows of 5 stars. How many stars will there be in total?",
  "targetRows": 3,
  "targetColumns": 5,
  "iconType": "star",
  "showLabels": true,
  "maxRows": 6,
  "maxColumns": 8
}

Example for "area model for 4×6":
{
  "title": "Build a 4 × 6 Area Model",
  "description": "Create a rectangular array with 4 rows and 6 columns. Calculate the total area (number of squares).",
  "targetRows": 4,
  "targetColumns": 6,
  "iconType": "square",
  "showLabels": true,
  "maxRows": 6,
  "maxColumns": 8
}

=== WRITING INSTRUCTIONS ===

Title: Clear, concise (e.g., "Build an Array for 3 × 5")

Description: Explain the two steps:
- Step 1: Build the array with [targetRows] rows and [targetColumns] columns
- Step 2: Count/calculate the total number of items

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
    model: "gemini-2.0-flash-exp",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: arrayGridSchema
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

  // Ensure target dimensions are set
  if (!data.targetRows || !data.targetColumns) {
    console.warn('Array Grid missing target dimensions. Setting defaults.');
    data.targetRows = data.targetRows || 3;
    data.targetColumns = data.targetColumns || 4;
  }

  // Apply any explicit config overrides
  if (config) {
    Object.assign(data, config);
  }

  return data;
};
