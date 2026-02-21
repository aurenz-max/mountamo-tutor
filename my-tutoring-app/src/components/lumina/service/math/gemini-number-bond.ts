import { Type, Schema } from "@google/genai";
import { NumberBondData } from "../../primitives/visual-primitives/math/NumberBond";
import { ai } from "../geminiClient";

/**
 * Schema definition for Number Bond Data
 *
 * This schema defines the structure for number bond activities,
 * covering part-part-whole relationships and number decomposition
 * for addition/subtraction fluency in K-1.
 *
 * Challenge types:
 * - decompose: Find ALL ways to split a whole into two parts
 * - missing-part: Given the whole and one part, find the other
 * - fact-family: Identify all 4 related addition/subtraction equations
 * - build-equation: Construct a specific equation from parts
 */
const numberBondSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the number bond activity (e.g., 'Break Apart 5!', 'Number Bond Fun')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    maxNumber: {
      type: Type.NUMBER,
      description: "Maximum whole number used in challenges. 5 for Kindergarten, 10 for Grade 1."
    },
    showCounters: {
      type: Type.BOOLEAN,
      description: "Whether to show visual counters (dots) alongside the bond diagram"
    },
    showEquation: {
      type: Type.BOOLEAN,
      description: "Whether to display the equation representation below the bond"
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' for Kindergarten, '1' for Grade 1"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID (e.g., 'c1', 'c2')"
          },
          type: {
            type: Type.STRING,
            description: "Challenge type: 'decompose' (find all pairs), 'missing-part' (find unknown part), 'fact-family' (all 4 equations), 'build-equation' (construct equation from parts)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging (e.g., 'Can you find all the ways to break apart 5?')"
          },
          whole: {
            type: Type.NUMBER,
            description: "The whole number in the bond (e.g., 5)"
          },
          part1: {
            type: Type.NUMBER,
            description: "First part (nullable — null when student must find it). For missing-part: the known part. For decompose: null (student finds all).",
            nullable: true
          },
          part2: {
            type: Type.NUMBER,
            description: "Second part (nullable — null when student must find it). For missing-part: null (the unknown). For decompose: null.",
            nullable: true
          },
          allPairs: {
            type: Type.ARRAY,
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.NUMBER
              }
            },
            description: "For 'decompose': ALL valid pairs that sum to whole. E.g., for 5: [[0,5],[1,4],[2,3]]. Nullable for other types.",
            nullable: true
          },
          factFamily: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING
            },
            description: "For 'fact-family': all 4 related equations. E.g., ['2+3=5','3+2=5','5-2=3','5-3=2']. Nullable for other types.",
            nullable: true
          },
          targetEquation: {
            type: Type.STRING,
            description: "For 'build-equation': the equation to construct (e.g., '3+2=5'). Nullable for other types.",
            nullable: true
          }
        },
        required: ["id", "type", "instruction", "whole"]
      },
      description: "Array of 3-6 progressive challenges"
    }
  },
  required: ["title", "description", "maxNumber", "showCounters", "showEquation", "gradeBand", "challenges"]
};

/**
 * Generate number bond data for interactive part-part-whole activities
 *
 * Grade-aware content:
 * - Kindergarten (K): maxNumber 5, focus on decompose and missing-part
 * - Grade 1: maxNumber 10, include all 4 challenge types
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns NumberBondData with complete configuration
 */
export const generateNumberBond = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{
    maxNumber: number;
    challengeTypes: string[];
    challengeCount: number;
  }>
): Promise<NumberBondData> => {
  const prompt = `
Create an educational number bond activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A number bond shows part-part-whole relationships: a whole number connected to two parts that add up to it
- Students learn to decompose numbers, find missing parts, build equations, and understand fact families
- This builds addition/subtraction fluency through visual part-part-whole reasoning

GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * maxNumber: 5 (wholes range from 2 to 5)
  * Focus on 'decompose' and 'missing-part' types ONLY
  * Use warm, playful language ("Can you break apart 4? How many ways?")
  * showCounters: true (visual dots help young learners)
  * showEquation: false (K students work visually, not symbolically)

- Grade 1 (gradeBand "1"):
  * maxNumber: 10 (wholes range from 3 to 10)
  * Include ALL 4 types: decompose, missing-part, fact-family, build-equation
  * More formal but still encouraging language
  * showCounters: true
  * showEquation: true (Grade 1 connects bonds to equations)

CHALLENGE TYPES:
- "decompose": Student finds ALL ways to split a whole into two parts.
  * part1 and part2 should be null (student discovers them)
  * allPairs MUST include every unique pair [a, b] where a + b = whole and a <= b
  * Example for whole=5: [[0,5],[1,4],[2,3]]
  * Example for whole=4: [[0,4],[1,3],[2,2]]

- "missing-part": Given the whole and one part, find the other.
  * Set part1 to the known part, part2 to null (student finds it)
  * allPairs, factFamily, targetEquation should be null

- "fact-family": Student identifies all 4 related equations.
  * Set part1 and part2 to the two parts
  * factFamily MUST have exactly 4 equations: ["a+b=w","b+a=w","w-a=b","w-b=a"]
  * Example for 2,3,5: ["2+3=5","3+2=5","5-2=3","5-3=2"]
  * allPairs and targetEquation should be null

- "build-equation": Student constructs a specific equation from the bond.
  * Set part1 and part2 to the two parts
  * targetEquation to the equation string (e.g., "3+2=5")
  * allPairs and factFamily should be null

${config ? `
CONFIGURATION HINTS:
${config.maxNumber ? `- Max number: ${config.maxNumber}` : ''}
${config.challengeTypes ? `- Challenge types to include: ${config.challengeTypes.join(', ')}` : ''}
${config.challengeCount ? `- Number of challenges: ${config.challengeCount}` : ''}
` : ''}

REQUIREMENTS:
1. Generate ${config?.challengeCount || '3-5'} challenges that progress in difficulty
2. Start with smaller wholes and simpler types, increase gradually
3. Use warm, encouraging instruction text for young children
4. For Kindergarten: ONLY use 'decompose' and 'missing-part' types
5. For Grade 1: mix all 4 types, progressing from decompose to build-equation
6. For decompose challenges, allPairs MUST include ALL valid unique pairs (a <= b)
7. For fact-family challenges, factFamily MUST have exactly 4 equations
8. Vary the whole numbers across challenges (don't repeat the same whole consecutively)
9. Ensure part1 + part2 = whole whenever parts are specified
10. For missing-part, choose part1 values that are not trivially 0 or equal to whole

Return the complete number bond configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: numberBondSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid number bond data returned from Gemini API');
  }

  // ---- Validation & defaults ----

  // Validate gradeBand
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  // Validate maxNumber
  if (!data.maxNumber || data.maxNumber < 2) {
    data.maxNumber = data.gradeBand === 'K' ? 5 : 10;
  }
  if (data.gradeBand === 'K' && data.maxNumber > 5) {
    data.maxNumber = 5;
  }
  if (data.maxNumber > 10) {
    data.maxNumber = 10;
  }

  // Ensure booleans
  if (typeof data.showCounters !== 'boolean') {
    data.showCounters = true;
  }
  if (typeof data.showEquation !== 'boolean') {
    data.showEquation = data.gradeBand === '1';
  }

  // Valid challenge types
  const validTypes = ['decompose', 'missing-part', 'fact-family', 'build-equation'];
  const kOnlyTypes = ['decompose', 'missing-part'];

  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validTypes.includes(c.type)
  );

  // For K, strip out fact-family and build-equation
  if (data.gradeBand === 'K') {
    data.challenges = data.challenges.filter(
      (c: { type: string }) => kOnlyTypes.includes(c.type)
    );
  }

  // Per-challenge validation
  for (const challenge of data.challenges) {
    // Ensure whole is within range
    if (!challenge.whole || challenge.whole < 2) {
      challenge.whole = data.gradeBand === 'K' ? 4 : 7;
    }
    if (challenge.whole > data.maxNumber) {
      challenge.whole = data.maxNumber;
    }

    // Compute allPairs for decompose if missing or incomplete
    if (challenge.type === 'decompose') {
      const expectedPairs: [number, number][] = [];
      for (let a = 0; a <= Math.floor(challenge.whole / 2); a++) {
        expectedPairs.push([a, challenge.whole - a]);
      }
      // Validate existing allPairs or replace
      if (!Array.isArray(challenge.allPairs) || challenge.allPairs.length !== expectedPairs.length) {
        challenge.allPairs = expectedPairs;
      }
      // Nullify parts for decompose (student discovers them)
      challenge.part1 = null;
      challenge.part2 = null;
    }

    // Validate missing-part
    if (challenge.type === 'missing-part') {
      if (challenge.part1 == null || challenge.part1 < 0 || challenge.part1 >= challenge.whole) {
        challenge.part1 = Math.max(1, Math.floor(challenge.whole / 2));
      }
      challenge.part2 = null;
      challenge.allPairs = null;
      challenge.factFamily = null;
      challenge.targetEquation = null;
    }

    // Validate fact-family
    if (challenge.type === 'fact-family') {
      const p1 = challenge.part1 ?? Math.max(1, Math.floor(challenge.whole / 3));
      const p2 = challenge.whole - p1;
      challenge.part1 = p1;
      challenge.part2 = p2;
      // Ensure exactly 4 equations
      challenge.factFamily = [
        `${p1}+${p2}=${challenge.whole}`,
        `${p2}+${p1}=${challenge.whole}`,
        `${challenge.whole}-${p1}=${p2}`,
        `${challenge.whole}-${p2}=${p1}`
      ];
      challenge.allPairs = null;
      challenge.targetEquation = null;
    }

    // Validate build-equation
    if (challenge.type === 'build-equation') {
      const p1 = challenge.part1 ?? Math.max(1, Math.floor(challenge.whole / 2));
      const p2 = challenge.whole - p1;
      challenge.part1 = p1;
      challenge.part2 = p2;
      if (!challenge.targetEquation) {
        challenge.targetEquation = `${p1}+${p2}=${challenge.whole}`;
      }
      challenge.allPairs = null;
      challenge.factFamily = null;
    }
  }

  // Ensure at least one challenge
  if (data.challenges.length === 0) {
    const w = data.gradeBand === 'K' ? 4 : 7;
    const pairs: [number, number][] = [];
    for (let a = 0; a <= Math.floor(w / 2); a++) {
      pairs.push([a, w - a]);
    }
    data.challenges = [{
      id: 'c1',
      type: 'decompose',
      instruction: `Can you find all the ways to break apart ${w}?`,
      whole: w,
      part1: null,
      part2: null,
      allPairs: pairs,
      factFamily: null,
      targetEquation: null,
    }];
  }

  // Apply explicit config overrides
  if (config) {
    if (config.maxNumber !== undefined) {
      data.maxNumber = Math.min(config.maxNumber, data.gradeBand === 'K' ? 5 : 10);
    }
  }

  return data;
};
