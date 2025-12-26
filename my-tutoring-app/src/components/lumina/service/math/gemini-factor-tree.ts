import { Type, Schema, ThinkingLevel } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Factor Tree Data Interface
 *
 * This matches the FactorTreeData interface in the component
 */
export interface FactorTreeData {
  title: string;
  description: string;
  rootValue: number;
  highlightPrimes?: boolean;
  showExponentForm?: boolean;
  guidedMode?: boolean;
  allowReset?: boolean;
}

/**
 * Schema definition for Factor Tree Data
 *
 * This schema defines the structure for factor tree visualization,
 * including the starting composite number and interactive features.
 */
const factorTreeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the factor tree (e.g., 'Prime Factorization of 24')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn from this visualization"
    },
    rootValue: {
      type: Type.NUMBER,
      description: "Starting composite number to factor. Range 4-100. Choose numbers with clear factorizations for grade level."
    },
    highlightPrimes: {
      type: Type.BOOLEAN,
      description: "Visually distinguish prime leaves with green highlighting. Default: true"
    },
    showExponentForm: {
      type: Type.BOOLEAN,
      description: "Display final factorization in exponential form (e.g., 2^3 × 3). Default: true"
    },
    guidedMode: {
      type: Type.BOOLEAN,
      description: "Suggest valid factor pairs to help students. Use true for learning, false for assessment. Default: true"
    },
    allowReset: {
      type: Type.BOOLEAN,
      description: "Allow students to clear and restart. Default: true"
    }
  },
  required: ["title", "description", "rootValue"]
};

/**
 * Generate factor tree data for visualization
 *
 * This function creates factor tree data including:
 * - Appropriate composite number for the topic and grade level
 * - Educational context and descriptions
 * - Configuration for interactive features
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns FactorTreeData with complete configuration
 */
export const generateFactorTree = async (
  topic: string,
  gradeLevel: string,
  config?: {
    rootValue?: number;
    highlightPrimes?: boolean;
    showExponentForm?: boolean;
    guidedMode?: boolean;
    allowReset?: boolean;
  }
): Promise<FactorTreeData> => {
  const prompt = `
Create an educational factor tree visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- Factor trees are branching diagrams showing prime factorization
- Students repeatedly split composite numbers into factor pairs
- The process continues until all branches end in prime numbers
- The prime factors are then collected to show the prime factorization

GUIDELINES FOR GRADE LEVELS:
- Grades 3-4: Simple composite numbers (12, 18, 20, 24, 30), focus on understanding factors
- Grades 4-5: Two-digit composites (36, 48, 54, 60, 72), introduce prime factorization
- Grades 5-6: Larger numbers (84, 90, 96, 100), exponential notation, GCF/LCM applications
- Grades 6-7: More complex numbers, use for simplifying fractions and finding GCF/LCM
- Grades 7+: Three-digit numbers, connect to algebraic factoring

TOPIC-SPECIFIC GUIDANCE:
- "Introduction to factors": Use smaller numbers (12, 18, 20) with clear factor pairs
- "Prime factorization": Use numbers with multiple prime factors (24, 30, 36, 48)
- "Prime vs composite": Use numbers that illustrate the difference (17 is prime, 18 is composite)
- "GCF and LCM": Use pairs of related numbers (24 and 36, 48 and 60)
- "Simplifying fractions": Use numbers that are common denominators (24, 36, 48, 60)
- "Powers and exponents": Use numbers with repeated prime factors (16=2^4, 27=3^3, 72=2^3×3^2)

GOOD NUMBERS BY PRIME FACTOR PATTERNS:
- Two primes: 6, 10, 14, 15, 21, 22, 26, 33, 34, 35, 38, 39
- Three prime factors: 12, 18, 20, 28, 30, 42, 44, 45, 50, 52
- Four prime factors: 24, 40, 48, 54, 56, 60, 63, 72, 80, 84, 90, 96
- Powers of 2: 16, 32, 64, 128 (for exponential form emphasis)
- Powers of 3: 27, 81 (for exponential form emphasis)
- Mixed: 36 (2^2 × 3^2), 72 (2^3 × 3^2), 100 (2^2 × 5^2)

AVOID:
- Numbers less than 4
- Prime numbers (unless teaching prime vs composite)
- Numbers greater than 100 for elementary
- Numbers with too many factors for the grade level

${config ? `
CONFIGURATION HINTS:
${config.rootValue !== undefined ? `- Root value: ${config.rootValue}` : ''}
${config.highlightPrimes !== undefined ? `- Highlight primes: ${config.highlightPrimes}` : ''}
${config.showExponentForm !== undefined ? `- Show exponent form: ${config.showExponentForm}` : ''}
${config.guidedMode !== undefined ? `- Guided mode: ${config.guidedMode}` : ''}
${config.allowReset !== undefined ? `- Allow reset: ${config.allowReset}` : ''}
` : ''}

REQUIREMENTS:
1. Choose a composite number appropriate for the grade level and topic (range: 4-100)
2. Write a clear, student-friendly title that includes the number being factored
3. Provide an educational description of what students will learn
4. Enable guidedMode for learning activities, disable for assessments
5. Always show exponent form unless specifically teaching basic factorization
6. Always highlight primes to help students identify when factorization is complete
7. Always allow reset unless this is a graded assessment

IMPORTANT:
- For introduction to factors: Use numbers like 12, 18, 24 with multiple factor pairs
- For prime factorization: Use numbers like 30, 36, 48 with clear prime structure
- For GCF/LCM practice: Use numbers like 24, 36, or 48, 60
- For exponential form: Use numbers like 16, 36, 72, 100 with repeated primes
- The number should have educational value for the specific topic

Return the complete factor tree configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
      responseMimeType: "application/json",
      responseSchema: factorTreeSchema,
      temperature: 0.8,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid factor tree data returned from Gemini API');
  }

  // Validation: ensure rootValue is composite and in valid range
  if (data.rootValue < 4 || data.rootValue > 100) {
    console.warn(`Invalid root value: ${data.rootValue}. Adjusting to 24.`);
    data.rootValue = 24;
  }

  // Helper to check if number is prime
  const isPrime = (n: number): boolean => {
    if (n < 2) return false;
    if (n === 2) return true;
    if (n % 2 === 0) return false;
    for (let i = 3; i <= Math.sqrt(n); i += 2) {
      if (n % i === 0) return false;
    }
    return true;
  };

  // Ensure it's composite (not prime)
  if (isPrime(data.rootValue)) {
    console.warn(`Root value ${data.rootValue} is prime. Adjusting to nearby composite.`);
    // Find nearest composite
    const adjustedValue = data.rootValue + 1;
    data.rootValue = isPrime(adjustedValue) ? adjustedValue + 1 : adjustedValue;
  }

  // Apply any explicit config overrides from manifest
  if (config) {
    if (config.rootValue !== undefined) data.rootValue = config.rootValue;
    if (config.highlightPrimes !== undefined) data.highlightPrimes = config.highlightPrimes;
    if (config.showExponentForm !== undefined) data.showExponentForm = config.showExponentForm;
    if (config.guidedMode !== undefined) data.guidedMode = config.guidedMode;
    if (config.allowReset !== undefined) data.allowReset = config.allowReset;
  }

  // Set defaults
  if (data.highlightPrimes === undefined) data.highlightPrimes = true;
  if (data.showExponentForm === undefined) data.showExponentForm = true;
  if (data.guidedMode === undefined) data.guidedMode = true;
  if (data.allowReset === undefined) data.allowReset = true;

  return data;
};
