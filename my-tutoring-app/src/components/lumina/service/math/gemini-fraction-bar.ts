import { Type, Schema } from "@google/genai";
import { FractionBarData } from "../../primitives/visual-primitives/math/FractionBar";
import { ai } from "../geminiClient";

/**
 * Schema definition for Fraction Bar Data
 *
 * This schema defines the structure for the multi-phase fraction bar,
 * including the target fraction, MC choices, and display options.
 */
const fractionBarSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the fraction bar challenge (e.g., 'Shade 3/4 of the bar')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn from this activity"
    },
    numerator: {
      type: Type.NUMBER,
      description: "Target numerator — the number of parts to shade. Must be <= denominator"
    },
    denominator: {
      type: Type.NUMBER,
      description: "Target denominator — total equal parts the bar is divided into. Must be >= 2"
    },
    showDecimal: {
      type: Type.BOOLEAN,
      description: "Whether to show the decimal approximation during the build phase. Default: true"
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Grade level string for age-appropriate language (e.g., 'Grade 3', 'Grade 5')"
    },
    numeratorChoices: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "Exactly 4 multiple-choice options for identifying the numerator. Must include the correct numerator plus 3 plausible distractors, shuffled"
    },
    denominatorChoices: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "Exactly 4 multiple-choice options for identifying the denominator. Must include the correct denominator plus 3 plausible distractors, shuffled"
    }
  },
  required: ["title", "description", "numerator", "denominator"]
};

/**
 * Generate fraction bar data for the multi-phase interactive component
 *
 * The FractionBar component uses a three-phase educational flow:
 *   Phase 1 — Identify the Numerator (multiple choice)
 *   Phase 2 — Identify the Denominator (multiple choice)
 *   Phase 3 — Build the Fraction on a bar by shading parts
 *
 * This generator produces a proper fraction with MC distractors
 * appropriate for the given topic and grade level.
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional overrides for numerator, denominator, showDecimal
 * @returns FractionBarData with complete configuration
 */
export const generateFractionBar = async (
  topic: string,
  gradeLevel: string,
  config?: {
    numerator?: number;
    denominator?: number;
    showDecimal?: boolean;
  }
): Promise<FractionBarData> => {
  const prompt = `
Create an educational fraction bar challenge for teaching "${topic}" to ${gradeLevel} students.

THE FRACTION BAR COMPONENT — MULTI-PHASE FLOW:
This component guides students through three phases to deeply understand a single fraction:

  Phase 1 — Identify the Numerator (multiple choice)
    The student sees a shaded bar and must pick how many parts are shaded.
    You must provide "numeratorChoices": an array of exactly 4 numbers,
    one of which is the correct numerator. The other 3 should be plausible
    distractors (e.g., off-by-one, the denominator, or a nearby number).

  Phase 2 — Identify the Denominator (multiple choice)
    The student must pick how many total equal parts the bar has.
    You must provide "denominatorChoices": an array of exactly 4 numbers,
    one of which is the correct denominator. Distractors should be plausible
    (e.g., adjacent numbers, common denominators, the numerator).

  Phase 3 — Build the Fraction
    The student shades the correct number of parts on a blank bar divided
    into the correct number of equal parts.

REQUIREMENTS:
1. Generate a PROPER fraction: numerator <= denominator, denominator >= 2.
2. Choose an appropriate fraction for the topic and grade level:
   - Grades 2-3: Simple fractions with small denominators (2, 3, 4)
   - Grades 4-5: Broader denominators (2-8), including unit and non-unit fractions
   - Grades 6+: Larger denominators (2-12), more complex fractions
3. Write a clear, student-friendly title that mentions the fraction.
4. Provide an educational description of what the student will practice.
5. numeratorChoices: exactly 4 numbers including the correct numerator. Shuffle the order.
6. denominatorChoices: exactly 4 numbers including the correct denominator. Shuffle the order.
7. Set showDecimal to true if connecting fractions to decimals is relevant, false otherwise.
8. Set gradeLevel to "${gradeLevel}".

${config ? `
CONFIGURATION HINTS (use these values if provided):
${config.numerator !== undefined ? `- Numerator: ${config.numerator}` : ''}
${config.denominator !== undefined ? `- Denominator: ${config.denominator}` : ''}
${config.showDecimal !== undefined ? `- Show decimal: ${config.showDecimal}` : ''}
` : ''}

DISTRACTOR GUIDELINES:
- For numeratorChoices: include the correct numerator, plus 3 distractors such as
  (numerator ± 1), the denominator, or 0. All values should be non-negative integers.
- For denominatorChoices: include the correct denominator, plus 3 distractors such as
  (denominator ± 1), the numerator, or a common denominator like 10.
  All values should be positive integers >= 1.
- Shuffle the choices so the correct answer is not always in the same position.

Return the complete fraction bar configuration as JSON.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: fractionBarSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid fraction bar data returned from Gemini API');
  }

  // Apply explicit config overrides
  if (config) {
    if (config.denominator !== undefined) data.denominator = config.denominator;
    if (config.numerator !== undefined) data.numerator = config.numerator;
    if (config.showDecimal !== undefined) data.showDecimal = config.showDecimal;
  }

  // Validation: denominator must be >= 2
  if (data.denominator < 2) {
    console.warn(`Invalid fraction bar: denominator (${data.denominator}) < 2. Setting to 2.`);
    data.denominator = 2;
  }

  // Validation: numerator must be <= denominator (proper fraction)
  if (data.numerator > data.denominator) {
    console.warn(`Invalid fraction bar: numerator (${data.numerator}) > denominator (${data.denominator}). Clamping numerator to ${data.denominator}.`);
    data.numerator = data.denominator;
  }

  // Validation: numerator must be non-negative
  if (data.numerator < 0) {
    console.warn(`Invalid fraction bar: numerator (${data.numerator}) < 0. Setting to 0.`);
    data.numerator = 0;
  }

  // Ensure numeratorChoices includes the correct numerator
  if (Array.isArray(data.numeratorChoices) && !data.numeratorChoices.includes(data.numerator)) {
    data.numeratorChoices[0] = data.numerator;
  }

  // Ensure denominatorChoices includes the correct denominator
  if (Array.isArray(data.denominatorChoices) && !data.denominatorChoices.includes(data.denominator)) {
    data.denominatorChoices[0] = data.denominator;
  }

  return data;
};
