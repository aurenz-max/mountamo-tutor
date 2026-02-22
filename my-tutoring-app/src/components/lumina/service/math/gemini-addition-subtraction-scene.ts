import { Type, Schema } from "@google/genai";
import { AdditionSubtractionSceneData } from "../../primitives/visual-primitives/math/AdditionSubtractionScene";
import { ai } from "../geminiClient";

/**
 * Schema definition for Addition/Subtraction Scene Data
 *
 * This schema defines the structure for animated story-based addition and
 * subtraction activities. Children interact with concrete objects joining,
 * leaving, or being compared — bridging from manipulatives to equations.
 *
 * Each challenge presents a mini-story in a themed scene (pond, farm, etc.)
 * with one of four interaction modes: act-out, build-equation, solve-story,
 * or create-story.
 */
const additionSubtractionSceneSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the activity (e.g., 'Farm Addition Stories', 'Pond Subtraction Fun')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID (e.g., 'ch1', 'ch2')"
          },
          type: {
            type: Type.STRING,
            enum: ["act-out", "build-equation", "solve-story", "create-story"],
            description: "Challenge type: 'act-out' (drag objects to act out story), 'build-equation' (construct the equation from tiles), 'solve-story' (read story and find the answer), 'create-story' (given equation, write a story)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging"
          },
          storyText: {
            type: Type.STRING,
            description: "The story narrative (e.g., '3 ducks are swimming. 2 more ducks join them.')"
          },
          scene: {
            type: Type.STRING,
            enum: ["pond", "farm", "playground", "space", "kitchen", "garden"],
            description: "Scene theme for visual background"
          },
          objectType: {
            type: Type.STRING,
            description: "Type of objects in the story (e.g., 'ducks', 'apples', 'rockets')"
          },
          operation: {
            type: Type.STRING,
            enum: ["addition", "subtraction"],
            description: "Whether this challenge involves addition or subtraction"
          },
          storyType: {
            type: Type.STRING,
            enum: ["join", "separate", "compare", "part-whole"],
            description: "Story situation type: 'join' (adding to), 'separate' (taking away), 'compare' (how many more/fewer), 'part-whole' (parts make a whole)"
          },
          startCount: {
            type: Type.INTEGER,
            description: "Starting number of objects"
          },
          changeCount: {
            type: Type.INTEGER,
            description: "Number of objects added or removed"
          },
          resultCount: {
            type: Type.INTEGER,
            description: "Final count after the operation"
          },
          equation: {
            type: Type.STRING,
            description: "The equation string (e.g., '3 + 2 = 5', '7 - 3 = 4')"
          },
          unknownPosition: {
            type: Type.STRING,
            enum: ["result", "change", "start"],
            description: "Which part of the equation is unknown for the student to solve. Optional — defaults to 'result'."
          }
        },
        required: [
          "id", "type", "instruction", "storyText", "scene", "objectType",
          "operation", "storyType", "startCount", "changeCount", "resultCount", "equation"
        ]
      },
      description: "Array of 4-8 progressive challenges mixing different types and story situations"
    },
    maxNumber: {
      type: Type.INTEGER,
      description: "Maximum number used in any challenge (5 for K, 10 for Grade 1)"
    },
    showTenFrame: {
      type: Type.BOOLEAN,
      description: "Whether to show a ten-frame alongside the scene for counting support"
    },
    showEquationBar: {
      type: Type.BOOLEAN,
      description: "Whether to show the equation bar with draggable tiles"
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K", "1"],
      description: "Grade band: 'K' for Kindergarten, '1' for Grade 1"
    }
  },
  required: ["title", "challenges", "maxNumber", "showTenFrame", "showEquationBar", "gradeBand"]
};

/**
 * Generate addition/subtraction scene data for story-based math activities
 *
 * Grade-aware content:
 * - Kindergarten: numbers within 5, act-out and solve-story focus,
 *   join/separate story types, ten-frame scaffolding
 * - Grade 1: numbers within 10, all four challenge types,
 *   all story types including compare and part-whole,
 *   unknownPosition varies (result, change, start)
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints
 * @returns AdditionSubtractionSceneData with complete configuration
 */
export const generateAdditionSubtractionScene = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{
    maxNumber: number;
    gradeBand: string;
    challengeTypes: string[];
    operations: string[];
    storyTypes: string[];
  }>
): Promise<AdditionSubtractionSceneData> => {
  const prompt = `
Create an educational addition and subtraction story activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- This is an animated story scene where objects join, leave, or are compared
- Students interact with concrete objects to build understanding of addition and subtraction
- The bridge from manipulatives to equations — stories make math meaningful
- Each challenge has a themed scene (pond, farm, playground, space, kitchen, garden)

GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * Numbers within 5 (maxNumber = 5)
  * Focus on act-out and solve-story challenge types
  * Primarily join and separate story types
  * Simple, warm language with familiar objects (ducks, apples, bunnies)
  * Ten-frame support for counting
  * unknownPosition should usually be 'result'

- Grade 1 (gradeBand "1"):
  * Numbers within 10 (maxNumber = 10)
  * All four challenge types: act-out, build-equation, solve-story, create-story
  * All story types: join, separate, compare, part-whole
  * Vary unknownPosition: result, change, and occasionally start
  * More complex stories with multiple steps
  * Equation bar for building number sentences

CHALLENGE TYPES:
- "act-out": Student drags objects into the scene to act out the story. Best for beginners.
- "build-equation": Student constructs the equation from number/symbol tiles after seeing the story.
- "solve-story": Student reads/hears the story and provides the missing number.
- "create-story": Given an equation, student matches or creates a story. Advanced.

STORY TYPES:
- "join": Objects are added together (e.g., "3 ducks are swimming. 2 more join them.")
- "separate": Objects are removed (e.g., "5 apples on the table. 2 are eaten.")
- "compare": Two groups compared (e.g., "4 red flowers and 2 blue flowers. How many more red?")
- "part-whole": Parts make a whole (e.g., "There are 3 cats inside and 2 outside. How many total?")

${config ? `
CONFIGURATION HINTS:
${config.maxNumber ? `- Max number: ${config.maxNumber}` : ''}
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config.challengeTypes ? `- Challenge types to include: ${config.challengeTypes.join(', ')}` : ''}
${config.operations ? `- Operations to include: ${config.operations.join(', ')}` : ''}
${config.storyTypes ? `- Story types to include: ${config.storyTypes.join(', ')}` : ''}
` : ''}

REQUIREMENTS:
1. Generate 4-8 challenges mixing the 4 types (act-out, build-equation, solve-story, create-story)
2. Use appropriate story contexts (join, separate, compare, part-whole)
3. Keep all numbers within maxNumber (5 for K, 10 for Grade 1)
4. Create engaging, relatable story texts that match the scene theme
5. CRITICAL: Equation strings MUST be mathematically accurate (e.g., "3 + 2 = 5", "7 - 3 = 4")
6. CRITICAL: resultCount must equal startCount + changeCount for addition, startCount - changeCount for subtraction
7. Generate unique IDs for each challenge (e.g., 'ch1', 'ch2', etc.)
8. Match objectType to the scene (ducks for pond, apples for farm, rockets for space, etc.)
9. Progress from easier to harder: start with act-out/join, progress to build-equation/compare
10. Use warm, child-friendly instruction text
11. For Kindergarten: favor act-out and solve-story types, mostly join and separate
12. For Grade 1: include all types and all story types, vary unknownPosition
13. Mix addition and subtraction operations across challenges
14. Set showTenFrame to true for K, false for Grade 1 unless numbers > 5
15. Set showEquationBar to true when build-equation challenges are included

Return the complete addition/subtraction scene configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: additionSubtractionSceneSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid addition/subtraction scene data returned from Gemini API');
  }

  // Validation: ensure gradeBand is valid
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  // Validation: ensure maxNumber is appropriate
  if (!data.maxNumber || data.maxNumber < 1) {
    data.maxNumber = data.gradeBand === 'K' ? 5 : 10;
  }

  // Defaults for display options
  if (typeof data.showTenFrame !== 'boolean') {
    data.showTenFrame = data.gradeBand === 'K';
  }
  if (typeof data.showEquationBar !== 'boolean') {
    data.showEquationBar = true;
  }

  // Valid enums
  const validChallengeTypes = ['act-out', 'build-equation', 'solve-story', 'create-story'];
  const validScenes = ['pond', 'farm', 'playground', 'space', 'kitchen', 'garden'];
  const validOperations = ['addition', 'subtraction'];
  const validStoryTypes = ['join', 'separate', 'compare', 'part-whole'];
  const validUnknownPositions = ['result', 'change', 'start'];

  // Filter invalid challenges
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // Per-challenge validation
  for (const challenge of data.challenges) {
    // Validate scene
    if (!validScenes.includes(challenge.scene)) {
      challenge.scene = 'farm';
    }

    // Validate operation
    if (!validOperations.includes(challenge.operation)) {
      challenge.operation = 'addition';
    }

    // Validate storyType
    if (!validStoryTypes.includes(challenge.storyType)) {
      challenge.storyType = challenge.operation === 'addition' ? 'join' : 'separate';
    }

    // Validate unknownPosition
    if (challenge.unknownPosition && !validUnknownPositions.includes(challenge.unknownPosition)) {
      challenge.unknownPosition = 'result';
    }

    // Ensure counts are non-negative integers
    challenge.startCount = Math.max(0, Math.round(challenge.startCount || 0));
    challenge.changeCount = Math.max(0, Math.round(challenge.changeCount || 0));
    challenge.resultCount = Math.max(0, Math.round(challenge.resultCount || 0));

    // Clamp to maxNumber
    if (challenge.startCount > data.maxNumber) challenge.startCount = data.maxNumber;
    if (challenge.changeCount > data.maxNumber) challenge.changeCount = data.maxNumber;
    if (challenge.resultCount > data.maxNumber) challenge.resultCount = data.maxNumber;

    // Fix resultCount to match operation
    if (challenge.operation === 'addition') {
      challenge.resultCount = challenge.startCount + challenge.changeCount;
    } else {
      // For subtraction, ensure startCount >= changeCount
      if (challenge.startCount < challenge.changeCount) {
        const tmp = challenge.startCount;
        challenge.startCount = challenge.changeCount;
        challenge.changeCount = tmp;
      }
      challenge.resultCount = challenge.startCount - challenge.changeCount;
    }

    // Rebuild equation string to ensure accuracy
    if (challenge.operation === 'addition') {
      challenge.equation = `${challenge.startCount} + ${challenge.changeCount} = ${challenge.resultCount}`;
    } else {
      challenge.equation = `${challenge.startCount} - ${challenge.changeCount} = ${challenge.resultCount}`;
    }

    // Ensure id exists
    if (!challenge.id) {
      challenge.id = `ch${data.challenges.indexOf(challenge) + 1}`;
    }
  }

  // Ensure at least one challenge as a fallback
  if (data.challenges.length === 0) {
    data.challenges = [{
      id: 'ch1',
      type: 'act-out',
      instruction: 'Watch the story and drag the ducks into the pond!',
      storyText: '2 ducks are swimming in the pond. 1 more duck joins them. How many ducks are there now?',
      scene: 'pond',
      objectType: 'ducks',
      operation: 'addition',
      storyType: 'join',
      startCount: 2,
      changeCount: 1,
      resultCount: 3,
      equation: '2 + 1 = 3',
    }];
  }

  // Apply explicit config overrides
  if (config) {
    if (config.gradeBand === 'K' || config.gradeBand === '1') {
      data.gradeBand = config.gradeBand;
    }
    if (config.maxNumber !== undefined) {
      data.maxNumber = config.maxNumber;
    }
  }

  return data;
};
