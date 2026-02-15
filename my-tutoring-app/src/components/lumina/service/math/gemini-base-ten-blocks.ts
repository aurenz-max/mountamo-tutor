/**
 * Base-Ten Blocks Generator - Dedicated service for place value visualizations
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { BaseTenBlocksData, BaseTenBlocksChallenge } from '../../primitives/visual-primitives/math/BaseTenBlocks';

/**
 * Generate Base-Ten Blocks content
 *
 * Creates a base-ten blocks visualization for elementary math education,
 * helping students understand place value (ones, tens, hundreds, thousands).
 * Supports multiple interaction modes: build, decompose, regroup, operate.
 *
 * @param topic - The topic being visualized
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent
 * @returns Base-ten blocks data with number value and challenges
 */
export const generateBaseTenBlocks = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
  }
): Promise<BaseTenBlocksData> => {
  const challengeSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      type: {
        type: Type.STRING,
        enum: ["build_number", "read_blocks", "regroup", "add_with_blocks", "subtract_with_blocks"],
        description: "The type of challenge"
      },
      instruction: {
        type: Type.STRING,
        description: "Clear instruction telling the student what to do"
      },
      targetNumber: {
        type: Type.NUMBER,
        description: "The target number the student should build or identify"
      },
      secondNumber: {
        type: Type.NUMBER,
        description: "Second number for operations (add/subtract challenges). Optional.",
        nullable: true
      },
      hint: {
        type: Type.STRING,
        description: "A helpful hint shown after multiple failed attempts"
      }
    },
    required: ["type", "instruction", "targetNumber", "hint"]
  };

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "Title for the base-ten blocks visualization"
      },
      description: {
        type: Type.STRING,
        description: "Brief explanation of what the blocks demonstrate"
      },
      numberValue: {
        type: Type.NUMBER,
        description: "The primary number to represent using base-ten blocks"
      },
      interactionMode: {
        type: Type.STRING,
        enum: ["build", "decompose", "regroup", "operate"],
        description: "How the student interacts with the blocks. 'build' = construct a number, 'decompose' = break apart, 'regroup' = trade between places, 'operate' = add/subtract"
      },
      decimalMode: {
        type: Type.BOOLEAN,
        description: "Whether to include decimal places (tenths, hundredths). Default: false"
      },
      maxPlace: {
        type: Type.STRING,
        enum: ["ones", "tens", "hundreds", "thousands"],
        description: "The highest place value column to show. Default: 'hundreds'"
      },
      supplyTray: {
        type: Type.BOOLEAN,
        description: "Whether to show add/remove buttons for blocks. Default: true"
      },
      challenges: {
        type: Type.ARRAY,
        items: challengeSchema,
        description: "Array of sequential challenges for the student to complete"
      },
      gradeBand: {
        type: Type.STRING,
        enum: ["K-1", "2-3", "4-5"],
        description: "Target grade band for difficulty calibration"
      }
    },
    required: ["title", "description", "numberValue"]
  };

  const prompt = `You are generating a Base-Ten Blocks visualization for elementary math education.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Intent: ${config?.intent || topic}

Generate base-ten blocks content that helps students understand place value (ones, tens, hundreds, thousands).

GRADE BAND GUIDELINES:

K-1 (Kindergarten-Grade 1):
- Numbers 1-20 only
- maxPlace: 'tens'
- interactionMode: 'build' (build numbers from blocks)
- decimalMode: false
- Simple challenges: build_number, read_blocks
- 2-3 challenges max
- Very simple instructions with encouraging language
- Example challenge: { type: 'build_number', instruction: 'Can you build the number 14?', targetNumber: 14, hint: '14 has 1 ten and 4 ones' }

2-3 (Grades 2-3):
- Numbers 1-999
- maxPlace: 'hundreds'
- interactionMode: 'build' or 'regroup'
- decimalMode: false
- Challenges: build_number, read_blocks, regroup, add_with_blocks
- 3-4 challenges
- Introduce regrouping (trading 10 ones for 1 ten, etc.)
- Example challenge: { type: 'regroup', instruction: 'Regroup 15 ones into tens and ones', targetNumber: 15, hint: '15 ones = 1 ten and 5 ones' }

4-5 (Grades 4-5):
- Numbers up to 9999, may include decimals
- maxPlace: 'thousands'
- interactionMode: 'operate' or 'decompose'
- decimalMode: true if topic involves decimals
- Challenges: all types including add_with_blocks, subtract_with_blocks
- 3-5 challenges
- More complex operations and multi-step problems
- Example challenge: { type: 'add_with_blocks', instruction: 'Add 347 + 285 using blocks', targetNumber: 632, secondNumber: 285, hint: 'Start by adding the ones. Do you need to regroup?' }

CHALLENGE TYPES:
- build_number: Student builds a given number from scratch using blocks
- read_blocks: Student identifies the number shown by pre-placed blocks
- regroup: Student regroups blocks (e.g., trade 10 ones for 1 ten)
- add_with_blocks: Student adds two numbers using blocks, regrouping as needed
- subtract_with_blocks: Student subtracts using blocks, borrowing as needed

REQUIREMENTS:
1. Title should be engaging and age-appropriate
2. Description should explain the place value concept being practiced
3. Choose a numberValue appropriate for the grade level and topic
4. Set interactionMode based on the learning objective
5. Include 2-5 challenges that progress in difficulty
6. Each challenge must have a clear instruction, targetNumber, and helpful hint
7. For operation challenges, include secondNumber
8. Set gradeBand based on the target audience
9. Set maxPlace and decimalMode appropriately for the grade band

Return the complete base-ten blocks data structure.`;

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);

  // Apply defaults for optional fields
  data.interactionMode = data.interactionMode || 'build';
  data.decimalMode = data.decimalMode ?? false;
  data.maxPlace = data.maxPlace || 'hundreds';
  data.supplyTray = data.supplyTray ?? true;
  data.challenges = data.challenges || [];
  data.gradeBand = data.gradeBand || '2-3';

  // Validate numberValue is reasonable
  if (data.numberValue < 0) data.numberValue = Math.abs(data.numberValue);
  if (data.gradeBand === 'K-1' && data.numberValue > 20) data.numberValue = Math.min(data.numberValue, 20);
  if (data.gradeBand === '2-3' && data.numberValue > 999) data.numberValue = Math.min(data.numberValue, 999);
  if (data.gradeBand === '4-5' && data.numberValue > 9999) data.numberValue = Math.min(data.numberValue, 9999);

  // Validate challenges
  data.challenges = data.challenges.map((c: BaseTenBlocksChallenge) => ({
    type: c.type || 'build_number',
    instruction: c.instruction || 'Build this number with blocks',
    targetNumber: c.targetNumber ?? data.numberValue,
    secondNumber: c.secondNumber,
    hint: c.hint || 'Think about the place values',
  }));

  console.log('🧱 Base-Ten Blocks Generated from dedicated service:', {
    topic,
    numberValue: data.numberValue,
    gradeBand: data.gradeBand,
    interactionMode: data.interactionMode,
    challengeCount: data.challenges.length,
  });

  return data as BaseTenBlocksData;
};
