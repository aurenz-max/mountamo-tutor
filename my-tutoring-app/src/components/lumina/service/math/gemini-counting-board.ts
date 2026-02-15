import { Type, Schema } from "@google/genai";
import { CountingBoardData } from "../../primitives/visual-primitives/math/CountingBoard";
import { ai } from "../geminiClient";

/**
 * Schema definition for Counting Board Data
 *
 * This schema defines the structure for counting board activities,
 * including object arrangements, counting challenges, subitizing,
 * and count-on strategies for K-1 number sense.
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
          description: "Object type: 'bears', 'apples', 'stars', 'blocks', 'fish', 'butterflies'"
        },
        count: {
          type: Type.NUMBER,
          description: "Number of objects (1-30). K early: 1-5, K mid: 1-10, K late: 1-20, Grade 1: 1-30"
        },
        arrangement: {
          type: Type.STRING,
          description: "How objects are arranged: 'scattered' (random, harder), 'line' (in a row, easier), 'groups' (clustered), 'circle' (ring pattern)"
        },
        groupSize: {
          type: Type.NUMBER,
          description: "For 'groups' arrangement: objects per group (e.g., 5 for counting by 5s). Optional."
        }
      },
      required: ["type", "count", "arrangement"]
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
            description: "Challenge type: 'count_all' (tap each to count), 'subitize' (flash and identify), 'count_on' (start from a known group), 'group_count' (count by groups), 'compare' (which has more)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging (e.g., 'Can you count all the bears?')"
          },
          targetAnswer: {
            type: Type.NUMBER,
            description: "The correct answer (total count)"
          },
          flashDuration: {
            type: Type.NUMBER,
            description: "Duration in ms for subitize flash (e.g., 1500). Only for subitize challenges."
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
        required: ["id", "type", "instruction", "targetAnswer", "hint", "narration"]
      },
      description: "Array of 3-5 progressive challenges"
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
 * - Mid K: subitize 1-5, count 1-10
 * - Late K: count to 20, cardinality emphasis
 * - Grade 1: count on, group count by 2s/5s/10s, counts to 30
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
- Objects can be scattered (harder), in a line (easier), grouped, or in a circle

GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * Early K: count 1-5 objects, line arrangement, count_all only
  * Mid K: subitize 1-5 (flash and recognize), count 1-10
  * Late K: count to 20, scattered arrangement (harder), emphasize cardinality
  * Use concrete, fun objects kids love (bears, apples, fish, butterflies)
  * Simple, warm language ("Can you count all the bears? Touch each one!")

- Grade 1 (gradeBand "1"):
  * Count on from a known group (e.g., "There are 5 bears. Count on to find all of them")
  * Group counting by 2s, 5s, 10s (arrangement: groups)
  * Counts up to 30
  * Subitize larger groups (up to 10), faster flash (1000-1500ms)
  * Connect counting to addition concepts

CHALLENGE TYPES:
- "count_all": Tap each object one by one. targetAnswer = total count.
- "subitize": Objects flash briefly, student types how many. Set flashDuration (ms).
- "count_on": Some objects are pre-counted. Student counts the rest and gives total. Set startFrom.
- "group_count": Objects in groups. Count by groups (2s, 5s, 10s). targetAnswer = total.
- "compare": Two groups visible. "Which has more?" targetAnswer = count of the larger group.

${config ? `
CONFIGURATION HINTS:
${config.objectType ? `- Object type: ${config.objectType}` : ''}
${config.count ? `- Object count: ${config.count}` : ''}
${config.arrangement ? `- Arrangement: ${config.arrangement}` : ''}
${config.groupSize ? `- Group size: ${config.groupSize}` : ''}
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config.challengeTypes ? `- Challenge types: ${config.challengeTypes.join(', ')}` : ''}
` : ''}

REQUIREMENTS:
1. Generate 3-5 challenges that progress in difficulty
2. Start with easier challenges (count small numbers, line arrangement) and build up
3. Use warm, encouraging instruction text for young children
4. For Kindergarten: count_all and subitize only, counts 1-20
5. For Grade 1: include count_on and group_count, counts up to 30
6. Subitize flash durations: K = 1500-2000ms, Grade 1 = 1000-1500ms
7. Include meaningful hints that guide without giving the answer
8. Include narration text the AI tutor can use
9. Set showOptions:
   - showRunningCount: true for count_all, false for subitize
   - showGroupCircles: true for group_count
   - highlightOnTap: always true
   - showLastNumber: true (emphasizes cardinality)
10. Choose kid-friendly objects that match the topic context

CRITICAL: For count_all, group_count, and count_on challenges, targetAnswer MUST equal objects.count because ALL objects are displayed on screen and the student counts every one. Only subitize challenges may have a different targetAnswer.

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
    data.objects = { ...data.objects, type: 'stars' };
  }

  // Validation: ensure arrangement is valid
  const validArrangements = ['scattered', 'line', 'groups', 'circle'];
  if (!validArrangements.includes(data.objects?.arrangement)) {
    data.objects = { ...data.objects, arrangement: 'scattered' };
  }

  // Ensure challenges have valid types
  const validChallengeTypes = ['count_all', 'subitize', 'count_on', 'group_count', 'compare'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // CRITICAL: Force targetAnswer to match objects.count for whole-board challenges.
  // The LLM frequently generates mismatched values (e.g. targetAnswer=12 when count=25).
  for (const challenge of data.challenges) {
    if (['count_all', 'group_count', 'count_on'].includes(challenge.type)) {
      challenge.targetAnswer = data.objects.count;
    }
  }

  // Ensure at least one challenge
  if (data.challenges.length === 0) {
    data.challenges = [{
      id: 'c1',
      type: 'count_all',
      instruction: `Can you count all the ${data.objects?.type || 'stars'}?`,
      targetAnswer: data.objects?.count || 5,
      hint: 'Touch each one as you count!',
      narration: "Let's count together! Touch each one as you count.",
    }];
  }

  // Ensure count is reasonable
  if (!data.objects?.count || data.objects.count < 1) {
    data.objects = { ...data.objects, count: 5 };
  }
  if (data.gradeBand === 'K' && data.objects.count > 20) {
    data.objects.count = 20;
  }
  if (data.objects.count > 30) {
    data.objects.count = 30;
  }

  // Apply explicit config overrides
  if (config) {
    if (config.objectType !== undefined) data.objects.type = config.objectType;
    if (config.count !== undefined) data.objects.count = config.count;
    if (config.arrangement !== undefined) data.objects.arrangement = config.arrangement;
    if (config.groupSize !== undefined) data.objects.groupSize = config.groupSize;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
  }

  return data;
};
