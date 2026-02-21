import { Type, Schema } from "@google/genai";
import { CountingBoardData } from "../../primitives/visual-primitives/math/CountingBoard";
import { ai } from "../geminiClient";

/**
 * Schema definition for Counting Board Data
 *
 * This schema defines the structure for counting board activities,
 * including object arrangements, counting challenges, subitizing,
 * and count-on strategies for K-1 number sense.
 *
 * Each challenge has its own count and arrangement so the board
 * changes between challenges for progressive difficulty.
 */
const countingBoardSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the counting activity (e.g., 'Count the Bears!', 'How Many Stars?')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    objects: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          description: "Object type (theme for all challenges): 'bears', 'apples', 'stars', 'blocks', 'fish', 'butterflies'"
        }
      },
      required: ["type"]
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
            description: "Challenge type: 'count_all' (tap each to count), 'subitize' (look and quickly recognize how many without counting one by one), 'count_on' (start from a known group), 'group_count' (count by groups), 'compare' (which has more)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging (e.g., 'Can you count all the bears?')"
          },
          targetAnswer: {
            type: Type.NUMBER,
            description: "The correct answer — must equal count for this challenge"
          },
          count: {
            type: Type.NUMBER,
            description: "Number of objects for this challenge (1-30). Vary across challenges for progression. K: 1-20, Grade 1: 1-30."
          },
          arrangement: {
            type: Type.STRING,
            description: "How objects are arranged for this challenge: 'scattered' (random, harder), 'line' (in a row, easier), 'groups' (clustered), 'circle' (ring pattern). Vary across challenges."
          },
          groupSize: {
            type: Type.NUMBER,
            description: "For 'groups' arrangement: objects per group (e.g., 5 for counting by 5s). Required when arrangement is 'groups'."
          },
          startFrom: {
            type: Type.NUMBER,
            description: "For count_on challenges: the known starting count. Student counts on from here."
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after 2+ incorrect attempts"
          },
          narration: {
            type: Type.STRING,
            description: "AI narration for this challenge (used by the tutor to introduce it)"
          }
        },
        required: ["id", "type", "instruction", "targetAnswer", "count", "arrangement", "hint", "narration"]
      },
      description: "Array of 3-5 progressive challenges, each with its own count and arrangement"
    },
    showOptions: {
      type: Type.OBJECT,
      properties: {
        showRunningCount: {
          type: Type.BOOLEAN,
          description: "Show the running count as student taps objects"
        },
        showGroupCircles: {
          type: Type.BOOLEAN,
          description: "Show visual grouping circles (for group counting)"
        },
        highlightOnTap: {
          type: Type.BOOLEAN,
          description: "Highlight objects when tapped/counted"
        },
        showLastNumber: {
          type: Type.BOOLEAN,
          description: "Show the count number on each counted object (cardinality emphasis)"
        }
      },
      required: ["showRunningCount", "showGroupCircles", "highlightOnTap", "showLastNumber"]
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' for Kindergarten, '1' for Grade 1"
    }
  },
  required: ["title", "description", "objects", "challenges", "showOptions", "gradeBand"]
};

/**
 * Generate counting board data for interactive counting activities
 *
 * Grade-aware content:
 * - Early K: count 1-5, scattered/line, count_all only
 * - Mid K: subitize 1-5 (quick visual recognition), count 1-10
 * - Late K: count to 20, cardinality emphasis
 * - Grade 1: count on, group count by 2s/5s/10s, counts to 30
 *
 * Each challenge has its own count and arrangement for progressive difficulty.
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns CountingBoardData with complete configuration
 */
export const generateCountingBoard = async (
  topic: string,
  gradeLevel: string,
  config?: {
    objectType?: string;
    count?: number;
    arrangement?: string;
    groupSize?: number;
    gradeBand?: 'K' | '1';
    challengeTypes?: string[];
  }
): Promise<CountingBoardData> => {
  const prompt = `
Create an educational counting board activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A counting board is a workspace with countable objects (bears, apples, stars, etc.)
- Students tap/click objects to count them one by one (one-to-one correspondence)
- Key skills: counting, subitizing, cardinality, counting on, grouping
- Each challenge gets its OWN count and arrangement, so the board changes between challenges

GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * Early K: count 1-5 objects, line arrangement, count_all only
  * Mid K: subitize 1-5 (quick visual recognition), count 1-10
  * Late K: count to 20, scattered arrangement (harder), emphasize cardinality
  * Use concrete, fun objects kids love (bears, apples, fish, butterflies)
  * Simple, warm language ("Can you count all the bears? Touch each one!")

- Grade 1 (gradeBand "1"):
  * Count on from a known group (e.g., "There are 5 bears. Count on to find all of them")
  * Group counting by 2s, 5s, 10s (arrangement: groups)
  * Counts up to 30
  * Subitize larger groups (up to 10)
  * Connect counting to addition concepts

CHALLENGE TYPES:
- "count_all": Tap each object one by one. targetAnswer = count.
- "subitize": Objects are always visible. Student looks and quickly recognizes how many without counting one by one, then types their answer. Best for small counts (1-5 for K, up to 10 for Grade 1).
- "count_on": Some objects are pre-counted. Student counts the rest and gives total. Set startFrom.
- "group_count": Objects in groups. Count by groups (2s, 5s, 10s). Use arrangement 'groups' with groupSize.
- "compare": Two groups visible. "Which has more?" targetAnswer = count.

${config ? `
CONFIGURATION HINTS:
${config.objectType ? `- Object type: ${config.objectType}` : ''}
${config.count ? `- Suggested starting count: ${config.count}` : ''}
${config.arrangement ? `- Suggested starting arrangement: ${config.arrangement}` : ''}
${config.groupSize ? `- Group size: ${config.groupSize}` : ''}
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config.challengeTypes ? `- Challenge types: ${config.challengeTypes.join(', ')}` : ''}
` : ''}

REQUIREMENTS:
1. Generate 3-5 challenges that progress in difficulty
2. IMPORTANT: Each challenge has its own count and arrangement — vary them!
   Example progression: 3 in a line → 5 scattered → 4 in a circle → 10 in groups of 5
3. Start with smaller counts and simpler arrangements, then increase
4. Use warm, encouraging instruction text for young children
5. For Kindergarten: count_all and subitize only, counts 1-20 per challenge
6. For Grade 1: include count_on and group_count, counts up to 30 per challenge
7. For subitize challenges, use small counts (1-5 for K, up to 10 for Grade 1) and encouraging language like "How many do you see right away?"
8. For group_count challenges, set arrangement to 'groups' and provide groupSize
9. For each challenge, targetAnswer MUST equal that challenge's count
10. Include meaningful hints that guide without giving the answer
11. Include narration text the AI tutor can use
12. Set showOptions:
   - showRunningCount: true for count_all, false for subitize
   - showGroupCircles: true for group_count
   - highlightOnTap: always true
   - showLastNumber: true (emphasizes cardinality)
13. Choose kid-friendly objects that match the topic context
14. objects.type defines the emoji theme for ALL challenges (e.g., 'stars')

Return the complete counting board configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: countingBoardSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid counting board data returned from Gemini API');
  }

  // Validation: ensure gradeBand is valid
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  // Validation: ensure object type is valid
  const validTypes = ['bears', 'apples', 'stars', 'blocks', 'fish', 'butterflies', 'custom'];
  if (!validTypes.includes(data.objects?.type)) {
    data.objects = { type: 'stars' };
  }

  // Ensure challenges have valid types
  const validChallengeTypes = ['count_all', 'subitize', 'count_on', 'group_count', 'compare'];
  const validArrangements = ['scattered', 'line', 'groups', 'circle'];

  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // Per-challenge validation
  for (const challenge of data.challenges) {
    // Validate arrangement
    if (!validArrangements.includes(challenge.arrangement)) {
      challenge.arrangement = 'scattered';
    }

    // Validate count
    if (!challenge.count || challenge.count < 1) {
      challenge.count = 5;
    }
    if (data.gradeBand === 'K' && challenge.count > 20) {
      challenge.count = 20;
    }
    if (challenge.count > 30) {
      challenge.count = 30;
    }

    // Force targetAnswer = count
    if (['count_all', 'group_count', 'count_on', 'subitize'].includes(challenge.type)) {
      challenge.targetAnswer = challenge.count;
    }

    // Ensure groupSize exists when arrangement is 'groups'
    if (challenge.arrangement === 'groups' && !challenge.groupSize) {
      challenge.groupSize = Math.min(5, challenge.count);
    }
  }

  // Ensure at least one challenge
  if (data.challenges.length === 0) {
    data.challenges = [{
      id: 'c1',
      type: 'count_all',
      count: 5,
      arrangement: 'scattered',
      instruction: `Can you count all the ${data.objects?.type || 'stars'}?`,
      targetAnswer: 5,
      hint: 'Touch each one as you count!',
      narration: "Let's count together! Touch each one as you count.",
    }];
  }

  // Apply explicit config overrides
  if (config) {
    if (config.objectType !== undefined) data.objects.type = config.objectType;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
    // count/arrangement/groupSize overrides apply per-challenge as defaults
    if (config.count !== undefined || config.arrangement !== undefined || config.groupSize !== undefined) {
      for (const challenge of data.challenges) {
        if (config.count !== undefined) challenge.count = config.count;
        if (config.arrangement !== undefined) challenge.arrangement = config.arrangement;
        if (config.groupSize !== undefined) challenge.groupSize = config.groupSize;
        // Re-force targetAnswer after override
        if (['count_all', 'group_count', 'count_on', 'subitize'].includes(challenge.type)) {
          challenge.targetAnswer = challenge.count;
        }
      }
    }
  }

  return data;
};
