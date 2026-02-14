import { Type, Schema } from "@google/genai";
import { TenFrameData } from "../../primitives/visual-primitives/math/TenFrame";
import { ai } from "../geminiClient";

/**
 * Schema definition for Ten Frame Data
 *
 * This schema defines the structure for ten frame challenges,
 * including counter placement, two-color decomposition, subitizing,
 * and make-ten activities for K-2 number sense.
 */
const tenFrameSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the ten frame activity (e.g., 'Building Numbers to 10', 'Make Ten!')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    mode: {
      type: Type.STRING,
      description: "Frame mode: 'single' for one 2x5 frame (numbers 0-10), 'double' for two frames (numbers 0-20)"
    },
    counters: {
      type: Type.OBJECT,
      properties: {
        count: {
          type: Type.NUMBER,
          description: "Initial number of counters to place (usually 0 for build challenges)"
        },
        color: {
          type: Type.STRING,
          description: "Counter color: 'red', 'yellow', 'blue', or 'green'"
        },
        positions: {
          type: Type.ARRAY,
          items: { type: Type.NUMBER },
          description: "Initial counter positions (0-9 for single, 0-19 for double). Usually empty array for build challenges."
        }
      },
      required: ["count", "color", "positions"]
    },
    twoColorMode: {
      type: Type.OBJECT,
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description: "Whether two-color decomposition is active"
        },
        color1Count: {
          type: Type.NUMBER,
          description: "Number of counters in color 1"
        },
        color2Count: {
          type: Type.NUMBER,
          description: "Number of counters in color 2"
        },
        color1: {
          type: Type.STRING,
          description: "First counter color"
        },
        color2: {
          type: Type.STRING,
          description: "Second counter color"
        }
      },
      required: ["enabled", "color1Count", "color2Count", "color1", "color2"]
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
            description: "Challenge type: 'build' (place counters), 'subitize' (flash and identify count), 'make_ten' (find complement to 10), 'add' (addition), 'subtract' (subtraction)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction text, warm and encouraging (e.g., 'Put 7 counters on the frame!')"
          },
          targetCount: {
            type: Type.NUMBER,
            description: "Target number for this challenge (0-10 for single, 0-20 for double)"
          },
          flashDuration: {
            type: Type.NUMBER,
            description: "Duration in ms for subitize flash (e.g., 1500). Only used for subitize challenges."
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after 2+ incorrect attempts"
          },
          narration: {
            type: Type.STRING,
            description: "AI narration for this challenge (used by the tutor to introduce the challenge)"
          }
        },
        required: ["id", "type", "instruction", "targetCount", "hint", "narration"]
      },
      description: "Array of 3-5 progressive challenges"
    },
    showOptions: {
      type: Type.OBJECT,
      properties: {
        showCount: {
          type: Type.BOOLEAN,
          description: "Show counter count below the frame"
        },
        showEquation: {
          type: Type.BOOLEAN,
          description: "Show equation representation (for add/subtract)"
        },
        showEmptyCount: {
          type: Type.BOOLEAN,
          description: "Show the number of empty spaces"
        },
        allowFlip: {
          type: Type.BOOLEAN,
          description: "Allow flipping counter colors"
        }
      },
      required: ["showCount", "showEquation", "showEmptyCount", "allowFlip"]
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' for Kindergarten, '1-2' for Grades 1-2"
    }
  },
  required: ["title", "description", "mode", "counters", "challenges", "showOptions", "gradeBand"]
};

/**
 * Generate ten frame data for interactive number sense activities
 *
 * This function creates ten frame challenges including:
 * - Build challenges (place N counters on the frame)
 * - Subitize challenges (flash counters, student identifies count)
 * - Make-ten challenges (find the complement to 10)
 * - Add/subtract challenges (operations using the frame)
 *
 * Grade-aware content:
 * - K: build (1-10), subitize (1-5), simple two-color decomposition
 * - Grade 1-2: make-ten, addition to 20 (double frame), subtraction
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns TenFrameData with complete configuration
 */
export const generateTenFrame = async (
  topic: string,
  gradeLevel: string,
  config?: {
    mode?: 'single' | 'double';
    gradeBand?: 'K' | '1-2';
    challengeTypes?: string[];
    counterColor?: string;
    twoColorEnabled?: boolean;
  }
): Promise<TenFrameData> => {
  const prompt = `
Create an educational ten frame activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A ten frame is a 2×5 rectangular grid used to build number sense
- Students place counters (colored circles) on the grid to represent numbers
- Key skills: subitizing (instant recognition), composing/decomposing numbers, making 10
- The frame makes the relationship to 5 and 10 highly visible

GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * Build challenges with numbers 1-10 (single frame)
  * Subitize flash with numbers 1-5 (short flash durations, 1500-2000ms)
  * Two-color decomposition (e.g., 3 red + 4 yellow = 7)
  * Focus on "how many?" and "how many more to make 5/10?"
  * Use single frame mode ONLY
  * Simple, encouraging language ("Put 4 counters on the frame!")

- Grades 1-2 (gradeBand "1-2"):
  * Make-ten challenges (given some counters, find the complement to 10)
  * Addition using double frames (e.g., 8 + 5 = 13)
  * Subtraction with counters (start with N, remove some)
  * Subitize with larger numbers (up to 10), faster flash (1000-1500ms)
  * Can use double frame for numbers 11-20
  * Build on make-ten strategy for mental math

CHALLENGE TYPES:
- "build": Student places exactly N counters on the frame. targetCount = N.
- "subitize": Counters flash briefly, student types how many. Set flashDuration (ms).
- "make_ten": Frame shows some counters, student enters how many more to make 10. targetCount = current count shown.
- "add": Student shows addition result on frame (could span to second frame). targetCount = sum.
- "subtract": Student removes counters to show subtraction result. targetCount = result.

${config ? `
CONFIGURATION HINTS:
${config.mode ? `- Frame mode: ${config.mode}` : ''}
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config.challengeTypes ? `- Challenge types to include: ${config.challengeTypes.join(', ')}` : ''}
${config.counterColor ? `- Counter color: ${config.counterColor}` : ''}
${config.twoColorEnabled ? `- Two-color decomposition: enabled` : ''}
` : ''}

REQUIREMENTS:
1. Generate 3-5 challenges that progress in difficulty
2. Start with easier challenges and build up
3. Use warm, encouraging instruction text appropriate for young children
4. Set initial counter count and positions to 0/empty for build challenges
5. For subitize challenges, use flashDuration between 1000-2000ms
6. For make_ten challenges, targetCount should be the number of counters ALREADY on the frame
7. Include meaningful hints that guide without giving the answer
8. Include narration text the AI tutor can use to introduce each challenge
9. For Kindergarten: stick to single frame, numbers 1-10, build and subitize only
10. For Grades 1-2: can include make_ten, add, subtract, and double frame
11. Set showOptions appropriately:
    - showCount: true for build challenges, false for subitize
    - showEmptyCount: true for make_ten
    - showEquation: true for add/subtract

Return the complete ten frame configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: tenFrameSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid ten frame data returned from Gemini API');
  }

  // Validation: ensure mode is valid
  if (data.mode !== 'single' && data.mode !== 'double') {
    data.mode = 'single';
  }

  // Validation: ensure gradeBand is valid
  if (data.gradeBand !== 'K' && data.gradeBand !== '1-2') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1-2';
  }

  // Kindergarten should never have double frame
  if (data.gradeBand === 'K' && data.mode === 'double') {
    data.mode = 'single';
  }

  // Ensure challenges have valid types
  const validTypes = ['build', 'subitize', 'make_ten', 'add', 'subtract'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validTypes.includes(c.type)
  );

  // Ensure at least one challenge
  if (data.challenges.length === 0) {
    data.challenges = [{
      id: 'c1',
      type: 'build',
      instruction: 'Put 5 counters on the ten frame!',
      targetCount: 5,
      hint: 'Fill up one whole row!',
      narration: "Let's start by building the number 5 on the ten frame.",
    }];
  }

  // Ensure counter positions is an array
  if (!data.counters) {
    data.counters = { count: 0, color: 'red', positions: [] };
  }
  if (!Array.isArray(data.counters.positions)) {
    data.counters.positions = [];
  }

  // Apply explicit config overrides from manifest
  if (config) {
    if (config.mode !== undefined) data.mode = config.mode;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
    if (config.counterColor !== undefined) data.counters.color = config.counterColor;
  }

  return data;
};
