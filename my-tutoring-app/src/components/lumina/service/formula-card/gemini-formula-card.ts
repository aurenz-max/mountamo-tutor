/**
 * Formula Card Generator - Dedicated service for interactive formula explanations
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { EquationData, FormulaSegment, FormulaParameter, FormulaRelationship, FormulaExample } from "../../types";
import { ai } from "../geminiClient";

export interface FormulaCardData extends Omit<EquationData, 'type'> {
  type: 'equation';
}

/**
 * Generate Formula Card content
 *
 * Creates an interactive formula display with segments for variables,
 * detailed parameter explanations, relationships, and real-world examples.
 *
 * @param topic - The formula/topic being explained
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent
 * @returns Formula card data with segments, parameters, and examples
 */
export const generateFormulaCard = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
  }
): Promise<FormulaCardData> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title of the formula (e.g., 'Newton's Second Law')" },
      description: { type: Type.STRING, description: "Brief overview of what the formula represents" },
      formula: { type: Type.STRING, description: "The formula as plain text (e.g., 'F = ma')" },
      segments: {
        type: Type.ARRAY,
        description: "Interactive segments for the formula display",
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "The text segment (variable, operator, or symbol)" },
            meaning: { type: Type.STRING, description: "Brief tooltip explanation (for variables only)" },
            isVariable: { type: Type.BOOLEAN, description: "True if this is a variable/parameter, false for operators" }
          },
          required: ["text", "isVariable"]
        }
      },
      parameters: {
        type: Type.ARRAY,
        description: "Detailed explanation cards for each parameter/variable in the formula",
        items: {
          type: Type.OBJECT,
          properties: {
            symbol: { type: Type.STRING, description: "The variable symbol (e.g., 'F', 'm', 'a')" },
            name: { type: Type.STRING, description: "Full name (e.g., 'Force', 'Mass', 'Acceleration')" },
            description: { type: Type.STRING, description: "Clear explanation of what this parameter represents (2-3 sentences)" },
            unit: { type: Type.STRING, description: "Standard unit of measurement (e.g., 'Newtons (N)', 'kilograms (kg)', 'm/s²')" },
            isHighlighted: { type: Type.BOOLEAN, description: "True for the MOST IMPORTANT parameters that students should focus on (typically 1-2 parameters). Consider L'Hôpital's rule principle - highlight parameters that have the most significant impact or are most commonly misunderstood." }
          },
          required: ["symbol", "name", "description"]
        }
      },
      relationships: {
        type: Type.ARRAY,
        description: "Key relationships between parameters (optional, 1-3 relationships)",
        items: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "Explanation of the relationship (e.g., 'Force is directly proportional to both mass and acceleration')" },
            type: { type: Type.STRING, enum: ["proportional", "inverse", "complex"], description: "Type of mathematical relationship" }
          },
          required: ["description"]
        }
      },
      examples: {
        type: Type.ARRAY,
        description: "Real-world examples demonstrating the formula (2-3 examples recommended)",
        items: {
          type: Type.OBJECT,
          properties: {
            scenario: { type: Type.STRING, description: "Concrete real-world scenario (e.g., 'Pushing a shopping cart')" },
            calculation: { type: Type.STRING, description: "Optional: Show the calculation with specific numbers" },
            result: { type: Type.STRING, description: "The outcome or what it demonstrates" }
          },
          required: ["scenario", "result"]
        }
      },
      applicationContext: { type: Type.STRING, description: "When and where this formula is used (1-2 sentences)" }
    },
    required: ["title", "description", "formula", "segments", "parameters"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Create a comprehensive formula card for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${config?.intent || 'Explain formula components and applications'}

## Task: Generate a rich, educational formula explanation

You are creating an interactive formula display that helps students deeply understand a mathematical or scientific formula.

## Design Principles:

1. **Parameter Highlighting** (L'Hôpital's Rule Principle):
   - Mark 1-2 parameters as "highlighted" (isHighlighted: true)
   - Highlight parameters that are:
     * Most conceptually important
     * Most commonly misunderstood
     * Have the greatest impact on the result
   - For F=ma, you might highlight 'a' (acceleration) as it's often the key variable being solved for
   - For complex formulas (Snell's Law, Einstein's equations), highlight the parameters that reveal the core insight

2. **Parameter Cards**:
   - Each variable gets a detailed explanation card
   - Include the standard unit of measurement
   - Use clear, accessible language appropriate for ${gradeContext}
   - Explain what the parameter represents in practical terms

3. **Relationships**:
   - Explain how parameters interact (proportional, inverse, etc.)
   - Make mathematical relationships intuitive
   - Focus on the 1-3 most important relationships

4. **Real-World Examples**:
   - Provide 2-3 concrete, relatable scenarios
   - Use everyday situations students can visualize
   - Show how the formula applies in practice
   - Optional: Include simple numerical calculations

5. **Segments**:
   - Break the formula into interactive parts
   - Variables should have isVariable: true with a brief meaning
   - Operators (=, +, -, ×, ÷, etc.) should have isVariable: false

Now generate comprehensive formula data following these principles.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);

  console.log('🔢 Formula Card Generated from dedicated service:', {
    topic,
    formula: data.formula,
    paramCount: data.parameters?.length || 0
  });

  return { ...data, type: 'equation' } as FormulaCardData;
};
