import { Type, Schema, ThinkingLevel } from "@google/genai";
import { FractionBarData } from "../../types";
import { ai } from "../geminiClient";

/**
 * Schema definition for Fraction Bar Data
 *
 * This schema defines the structure for fraction bar visualization,
 * including partitions, shading, stacking, and interactive features.
 */
const fractionBarSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the fraction bar (e.g., 'Comparing Fractions: 1/2 and 3/4')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn from this visualization"
    },
    partitions: {
      type: Type.NUMBER,
      description: "Number of equal parts (denominator). Range 2-24. Common values: 2, 3, 4, 5, 6, 8, 10, 12"
    },
    shaded: {
      type: Type.NUMBER,
      description: "Number of shaded parts (numerator). Must be <= partitions"
    },
    barCount: {
      type: Type.NUMBER,
      description: "Number of stacked bars for comparison. Use 1 for introduction, 2-3 for comparison/operations. Max: 4"
    },
    showLabels: {
      type: Type.BOOLEAN,
      description: "Display fraction notation (numerator/denominator) and decimal representation. Default: true"
    },
    allowPartitionEdit: {
      type: Type.BOOLEAN,
      description: "Allow students to change the denominator for exploration. Use true for practice. Default: false"
    },
    showEquivalentLines: {
      type: Type.BOOLEAN,
      description: "Draw alignment guides between bars to show equivalence. Useful for comparing fractions. Default: false"
    }
  },
  required: ["title", "description", "partitions", "shaded", "barCount"]
};

/**
 * Generate fraction bar data for visualization
 *
 * This function creates fraction bar data including:
 * - Appropriate partitions (denominator) for the topic and grade level
 * - Initial shading (numerator) to demonstrate concepts
 * - Multiple bars for comparison when needed
 * - Educational context and descriptions
 * - Configuration for interactive features
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns FractionBarData with complete configuration
 */
export const generateFractionBar = async (
  topic: string,
  gradeLevel: string,
  config?: {
    partitions?: number;
    shaded?: number;
    barCount?: number;
    showLabels?: boolean;
    allowPartitionEdit?: boolean;
    showEquivalentLines?: boolean;
  }
): Promise<FractionBarData> => {
  const prompt = `
Create an educational fraction bar visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- Fraction bars are rectangular strips divided into equal parts
- Students can see fractions as parts of a whole
- Multiple bars can be stacked for comparison and operations
- Interactive features help students explore fraction concepts

GUIDELINES FOR GRADE LEVELS:
- Grades 2-3: Simple fractions (halves, thirds, fourths), 1 bar, basic introduction
- Grades 4-5: Equivalent fractions, comparing fractions, 2-3 bars, enable alignment guides
- Grades 6-7: Operations with fractions (addition/subtraction), show relationships
- Grades 8+: Advanced operations, improper fractions, mixed numbers

TOPIC-SPECIFIC GUIDANCE:
- "Fraction introduction": Use 1 bar with simple denominators (2, 3, 4)
- "Equivalent fractions": Use 2-3 bars with related denominators (e.g., 1/2 and 2/4, 3/6), enable alignment
- "Comparing fractions": Use 2 bars with different denominators, enable alignment
- "Adding fractions": Use 2 bars showing addends, optional third bar for sum
- "Subtracting fractions": Use 2 bars showing minuend and subtrahend
- "Fraction of a whole": Use 1 bar with word problem context
- "Improper fractions": Show bars that exceed whole (shaded > partitions not directly supported, use multiple whole bars)

COMMON DENOMINATORS FOR DIFFERENT CONCEPTS:
- Halves: 2 partitions
- Thirds: 3 partitions
- Fourths/Quarters: 4 partitions
- Fifths: 5 partitions
- Sixths: 6 partitions
- Eighths: 8 partitions
- Tenths: 10 partitions (connects to decimals)
- Twelfths: 12 partitions (good for equivalence with thirds, fourths, sixths)

${config ? `
CONFIGURATION HINTS:
${config.partitions !== undefined ? `- Partitions (denominator): ${config.partitions}` : ''}
${config.shaded !== undefined ? `- Shaded parts (numerator): ${config.shaded}` : ''}
${config.barCount !== undefined ? `- Number of bars: ${config.barCount}` : ''}
${config.showLabels !== undefined ? `- Show labels: ${config.showLabels}` : ''}
${config.allowPartitionEdit !== undefined ? `- Allow partition editing: ${config.allowPartitionEdit}` : ''}
${config.showEquivalentLines !== undefined ? `- Show alignment guides: ${config.showEquivalentLines}` : ''}
` : ''}

REQUIREMENTS:
1. Choose appropriate partitions based on topic and grade level (range: 2-24)
2. Set shaded value to clearly demonstrate the concept (must be <= partitions)
3. Use 1 bar for introduction, 2-3 bars for comparison/operations
4. Write a clear, student-friendly title that includes the fraction(s) being shown
5. Provide an educational description of what students will learn
6. Enable allowPartitionEdit for practice/exploration activities
7. Enable showEquivalentLines when comparing or showing equivalent fractions
8. Always show labels unless specifically teaching visual estimation

IMPORTANT:
- For single fraction introduction: barCount = 1
- For comparing two fractions: barCount = 2, showEquivalentLines = true
- For adding fractions: barCount = 2 or 3 (two addends, optional sum bar)
- Keep denominators reasonable (prefer 2-12 for elementary, up to 24 for advanced)

Return the complete fraction bar configuration.
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

  // Validation: ensure shaded <= partitions
  if (data.shaded > data.partitions) {
    console.warn(`Invalid fraction bar: shaded (${data.shaded}) > partitions (${data.partitions}). Adjusting shaded to ${data.partitions}.`);
    data.shaded = data.partitions;
  }

  // Apply any explicit config overrides from manifest
  if (config) {
    if (config.partitions !== undefined) data.partitions = config.partitions;
    if (config.shaded !== undefined) data.shaded = Math.min(config.shaded, data.partitions); // Ensure valid
    if (config.barCount !== undefined) data.barCount = config.barCount;
    if (config.showLabels !== undefined) data.showLabels = config.showLabels;
    if (config.allowPartitionEdit !== undefined) data.allowPartitionEdit = config.allowPartitionEdit;
    if (config.showEquivalentLines !== undefined) data.showEquivalentLines = config.showEquivalentLines;
  }

  return data;
};
