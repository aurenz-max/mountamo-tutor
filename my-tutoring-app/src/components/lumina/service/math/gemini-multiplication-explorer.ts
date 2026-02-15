import { Type, Schema } from "@google/genai";
import { MultiplicationExplorerData } from "../../primitives/visual-primitives/math/MultiplicationExplorer";
import { ai } from "../geminiClient";

/**
 * Schema definition for Multiplication Explorer Data
 *
 * Generates multiplication facts with multi-representation configurations,
 * progressive challenges (build, connect, commutative, distributive, missing_factor, fluency),
 * and grade-band awareness.
 */
const multiplicationExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title (e.g., 'Wheels on Cars: 4 × 3', 'Pack It Up: 5 × 6')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description tying multiplication to a concrete context"
    },
    fact: {
      type: Type.OBJECT,
      properties: {
        factor1: { type: Type.NUMBER, description: "First factor (number of groups)" },
        factor2: { type: Type.NUMBER, description: "Second factor (items per group)" },
        product: { type: Type.NUMBER, description: "Product (factor1 × factor2)" }
      },
      required: ["factor1", "factor2", "product"]
    },
    representations: {
      type: Type.OBJECT,
      properties: {
        equalGroups: { type: Type.BOOLEAN },
        array: { type: Type.BOOLEAN },
        repeatedAddition: { type: Type.BOOLEAN },
        numberLine: { type: Type.BOOLEAN },
        areaModel: { type: Type.BOOLEAN }
      },
      required: ["equalGroups", "array", "repeatedAddition", "numberLine", "areaModel"]
    },
    activeRepresentation: {
      type: Type.STRING,
      description: "Starting representation: 'groups', 'array', 'repeated_addition', 'number_line', 'area_model', or 'all'"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: {
            type: Type.STRING,
            description: "Challenge type: 'build', 'connect', 'commutative', 'distributive', 'missing_factor', 'fluency'"
          },
          instruction: { type: Type.STRING, description: "Student-facing instruction" },
          targetFact: { type: Type.STRING, description: "e.g., '3 × 4 = 12'" },
          hiddenValue: {
            type: Type.STRING,
            nullable: true,
            description: "'factor1', 'factor2', 'product', or null"
          },
          timeLimit: {
            type: Type.NUMBER,
            nullable: true,
            description: "Seconds for fluency mode, or null"
          },
          hint: { type: Type.STRING },
          narration: { type: Type.STRING, description: "AI tutor narration for this challenge" }
        },
        required: ["id", "type", "instruction", "targetFact", "hint", "narration"]
      },
      description: "3-6 progressive challenges"
    },
    showOptions: {
      type: Type.OBJECT,
      properties: {
        showProduct: { type: Type.BOOLEAN },
        showFactFamily: { type: Type.BOOLEAN },
        showCommutativeFlip: { type: Type.BOOLEAN },
        showDistributiveBreakdown: { type: Type.BOOLEAN }
      },
      required: ["showProduct", "showFactFamily", "showCommutativeFlip", "showDistributiveBreakdown"]
    },
    imagePrompt: {
      type: Type.STRING,
      nullable: true,
      description: "Real-world context image prompt (e.g., 'rows of desks in a classroom')"
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: '2-3' or '3-4'"
    }
  },
  required: ["title", "description", "fact", "representations", "activeRepresentation", "challenges", "showOptions", "gradeBand"]
};

/**
 * Generate multiplication explorer data
 *
 * Grade-aware content:
 * - Grade 2: ×2, ×5, ×10 only; equal groups and arrays; no distributive property
 * - Grade 3: All facts through 10×10; commutative property; introduce distributive
 * - Grade 4: Multi-digit × single-digit; area model emphasis; division as inverse
 */
export const generateMultiplicationExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: {
    factor1?: number;
    factor2?: number;
    gradeBand?: '2-3' | '3-4';
    challengeTypes?: string[];
    representations?: string[];
  }
): Promise<MultiplicationExplorerData> => {
  const prompt = `
Create an educational multiplication explorer activity for "${topic}" at ${gradeLevel} level.

CONTEXT:
The multiplication explorer connects 5 representations of the same fact:
1. Equal Groups (circles with dots — "3 groups of 4")
2. Array (rows × columns grid — "3 rows, 4 columns")
3. Repeated Addition (4 + 4 + 4)
4. Number Line (jumps of 4, 3 times)
5. Area Model (3 × 4 rectangle)

Students progress through 4 phases:
- Phase 1 (Groups): Build equal groups, count total
- Phase 2 (Array): Build the array, see rows × columns = total
- Phase 3 (Connect): See the same fact in ALL 5 representations simultaneously
- Phase 4 (Strategy): Use distributive property to derive unknown facts

GRADE-LEVEL GUIDELINES:
Grade 2 (gradeBand "2-3"):
  * Only ×2, ×5, ×10 facts
  * Focus on equal groups and arrays
  * Concrete contexts (packs of gum, wheels on cars, fingers on hands)
  * showDistributiveBreakdown: false
  * showCommutativeFlip: true (simple)
  * Include 'build' and 'connect' challenges only
  * Keep products ≤ 50

Grade 3 (gradeBand "2-3" or "3-4"):
  * All facts through 10×10
  * All 5 representations
  * Commutative property emphasized
  * Introduce distributive property: 7×8 = 5×8 + 2×8
  * Include 'commutative', 'missing_factor', and 'fluency' challenges
  * showDistributiveBreakdown: true for harder facts (×6, ×7, ×8, ×9)

Grade 4 (gradeBand "3-4"):
  * Multi-digit × single-digit (e.g., 12 × 4, 23 × 3)
  * Area model emphasis for partial products
  * Division as inverse (fact family)
  * showFactFamily: true
  * All challenge types

CHALLENGE TYPES:
- "build": Build equal groups or an array for the given fact, then count
- "connect": Same fact shown in all representations; student identifies the connection
- "commutative": Flip the factors; is the product the same?
- "distributive": Break a hard fact into easier parts (e.g., 7×6 = 5×6 + 2×6)
- "missing_factor": Given product and one factor, find the other
- "fluency": Quick-fire fact recall with optional time limit

${config ? `
CONFIGURATION HINTS:
${config.factor1 !== undefined ? `- Factor 1: ${config.factor1}` : ''}
${config.factor2 !== undefined ? `- Factor 2: ${config.factor2}` : ''}
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config.challengeTypes ? `- Challenge types: ${config.challengeTypes.join(', ')}` : ''}
${config.representations ? `- Representations: ${config.representations.join(', ')}` : ''}
` : ''}

REQUIREMENTS:
1. Choose a concrete, kid-friendly context (packs of stickers, rows of desks, eggs in cartons, wheels on cars)
2. product MUST equal factor1 × factor2 exactly
3. Generate 3-6 challenges that progress in difficulty
4. Start with 'build' challenges and progress to harder types
5. For grade 2, keep factors ≤ 10 and use only ×2, ×5, ×10
6. For grade 3-4, any facts through 12×12 are fine
7. hiddenValue should be null for build/connect, 'product' for fluency, 'factor1' or 'factor2' for missing_factor
8. Include warm, encouraging hint and narration text
9. All 5 representations should generally be true (set false only if factor is too large for visual)
10. Set activeRepresentation to 'groups' as the starting view

Return the complete multiplication explorer configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: multiplicationExplorerSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid multiplication explorer data returned from Gemini API');
  }

  // Validation: ensure product = factor1 × factor2
  if (data.fact) {
    data.fact.product = data.fact.factor1 * data.fact.factor2;
  }

  // Validation: gradeBand
  if (data.gradeBand !== '2-3' && data.gradeBand !== '3-4') {
    data.gradeBand = '2-3';
  }

  // Validation: activeRepresentation
  const validReps = ['groups', 'array', 'repeated_addition', 'number_line', 'area_model', 'all'];
  if (!validReps.includes(data.activeRepresentation)) {
    data.activeRepresentation = 'groups';
  }

  // Validation: challenge types
  const validChallengeTypes = ['build', 'connect', 'commutative', 'distributive', 'missing_factor', 'fluency'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // Ensure at least one challenge
  if (data.challenges.length === 0) {
    data.challenges = [{
      id: 'c1',
      type: 'build',
      instruction: `How many is ${data.fact.factor1} groups of ${data.fact.factor2}?`,
      targetFact: `${data.fact.factor1} × ${data.fact.factor2} = ${data.fact.product}`,
      hiddenValue: 'product',
      timeLimit: null,
      hint: `Count the groups: ${Array.from({ length: data.fact.factor1 }).map((_, i) => data.fact.factor2 * (i + 1)).join(', ')}`,
      narration: `Let's find out what ${data.fact.factor1} times ${data.fact.factor2} equals!`,
    }];
  }

  // Ensure representations object has all fields
  data.representations = {
    equalGroups: data.representations?.equalGroups ?? true,
    array: data.representations?.array ?? true,
    repeatedAddition: data.representations?.repeatedAddition ?? true,
    numberLine: data.representations?.numberLine ?? true,
    areaModel: data.representations?.areaModel ?? true,
  };

  // Ensure showOptions
  data.showOptions = {
    showProduct: data.showOptions?.showProduct ?? true,
    showFactFamily: data.showOptions?.showFactFamily ?? (data.gradeBand === '3-4'),
    showCommutativeFlip: data.showOptions?.showCommutativeFlip ?? true,
    showDistributiveBreakdown: data.showOptions?.showDistributiveBreakdown ?? (data.gradeBand === '3-4'),
  };

  // Disable number line for large products (>50 looks cramped)
  if (data.fact.product > 50) {
    data.representations.numberLine = false;
  }

  // Apply explicit config overrides
  if (config) {
    if (config.factor1 !== undefined) {
      data.fact.factor1 = config.factor1;
      data.fact.product = config.factor1 * data.fact.factor2;
    }
    if (config.factor2 !== undefined) {
      data.fact.factor2 = config.factor2;
      data.fact.product = data.fact.factor1 * config.factor2;
    }
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
  }

  return data;
};
