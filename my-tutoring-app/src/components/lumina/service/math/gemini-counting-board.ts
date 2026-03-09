import { Type, Schema } from "@google/genai";
import { CountingBoardData } from "../../primitives/visual-primitives/math/CountingBoard";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------
// Each entry provides:
//   promptDoc     — injected into the Gemini prompt (only for allowed types)
//   schemaDescription — concise label for the schema enum description
//
// When an eval mode is active, only the relevant entries are included.
// When no eval mode, all entries are included for mixed-difficulty generation.

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  count_all: {
    promptDoc:
      `"count_all": Tap each object one by one. targetAnswer = count. `
      + `Use warm language ("Can you count all the bears? Touch each one!"). `
      + `K: counts 1-20, Grade 1: counts 1-30. Full scaffolding — concrete 1:1 correspondence.`,
    schemaDescription: "'count_all' (tap each to count)",
  },
  subitize: {
    promptDoc:
      `"subitize": Objects are always visible. Student looks and quickly recognizes how many `
      + `without counting one by one, then types their answer. `
      + `Best for small counts (1-5 for K, up to 10 for Grade 1). `
      + `Use encouraging language like "How many do you see right away?"`,
    schemaDescription: "'subitize' (quick visual recognition)",
  },
  count_on: {
    promptDoc:
      `"count_on": Some objects are pre-counted. Student counts the rest and gives total. `
      + `Set startFrom (the known starting count). `
      + `Example: startFrom=5, count=8 means student counts on 3 more from 5. `
      + `targetAnswer = count. Grade 1 only.`,
    schemaDescription: "'count_on' (start from known group)",
  },
  group_count: {
    promptDoc:
      `"group_count": Objects in groups. Use arrangement 'groups' with groupSize of 2, 3, 4, or 5. `
      + `Use only 2-3 groups total (so count = groupSize × numGroups, e.g. 3 groups of 4 = 12). `
      + `targetAnswer = count. Grade 1 only.`,
    schemaDescription: "'group_count' (count by groups)",
  },
  compare: {
    promptDoc:
      `"compare": Two groups visible side by side. "Which has more?" `
      + `MUST use arrangement='groups'. groupSize = the larger group's count. `
      + `count = total of both groups. targetAnswer = the larger group's count. `
      + `The two groups should differ by at least 2 so the difference is visible. Grade 1 only.`,
    schemaDescription: "'compare' (which has more)",
  },
};

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

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
            description: "Challenge type: 'count_all' (tap each to count), 'subitize' (quick visual recognition), 'count_on' (start from known group), 'group_count' (count by groups), 'compare' (which has more)"
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

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

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
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
  }
): Promise<CountingBoardData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'counting-board',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // For config.challengeTypes without an eval mode, use them as a hint
  const effectiveChallengeTypes = evalConstraint?.allowedTypes ?? config?.challengeTypes;

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(countingBoardSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : countingBoardSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // Randomize starting parameters so Gemini doesn't always pick the same counts
  const startCounts = [3, 4, 5, 6, 7, 8];
  const randomStartCount = startCounts[Math.floor(Math.random() * startCounts.length)];
  const arrangements = ['scattered', 'line', 'circle'];
  const randomArrangement = arrangements[Math.floor(Math.random() * arrangements.length)];
  const objectTypes = ['bears', 'apples', 'stars', 'blocks', 'fish', 'butterflies'];
  const randomObject = objectTypes[Math.floor(Math.random() * objectTypes.length)];
  // Randomize count-on parameters: startFrom 3-7, total 2-5 more than startFrom
  const countOnStart = 3 + Math.floor(Math.random() * 5);       // 3-7
  const countOnExtra = 2 + Math.floor(Math.random() * 4);       // 2-5
  const countOnTotal = countOnStart + countOnExtra;              // 5-12

  const prompt = `
Create an educational counting board activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A counting board is a workspace with countable objects (bears, apples, stars, etc.)
- Students tap/click objects to count them one by one (one-to-one correspondence)
- Key skills: counting, subitizing, cardinality, counting on, grouping
- Each challenge gets its OWN count and arrangement, so the board changes between challenges

${challengeTypeSection}

${!evalConstraint ? `
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
` : ''}

COUNT-ON PARAMETERS (if generating count_on challenges):
- For this session use startFrom=${countOnStart} and count=${countOnTotal} (so the student counts on ${countOnExtra} more).

GROUP-COUNT GUIDELINES (if generating group_count challenges):
- Set arrangement to 'groups' and provide groupSize (2, 3, 4, or 5)
- Use only 2-3 groups total (so count = groupSize × numGroups, e.g. 3 groups of 4 = 12)

${(() => {
  const hints: string[] = [];
  if (config?.objectType) hints.push(`- Object type: ${config.objectType}`);
  if (config?.count) hints.push(`- Suggested starting count: ${config.count}`);
  if (config?.arrangement) hints.push(`- Suggested starting arrangement: ${config.arrangement}`);
  if (config?.groupSize) hints.push(`- Group size: ${config.groupSize}`);
  if (config?.gradeBand) hints.push(`- Grade band: ${config.gradeBand}`);
  if (effectiveChallengeTypes) hints.push(`- Challenge types to include: ${effectiveChallengeTypes.join(', ')}`);
  return hints.length > 0 ? `CONFIGURATION HINTS:\n${hints.join('\n')}` : '';
})()}

REQUIREMENTS:
1. Generate 3-5 challenges that progress in difficulty
2. IMPORTANT: Each challenge has its own count and arrangement — vary them!
3. Start the FIRST challenge with exactly ${randomStartCount} ${randomObject} in a ${randomArrangement} arrangement, then progress upward from there
4. Use warm, encouraging instruction text for young children
5. For each challenge, targetAnswer MUST equal that challenge's count
6. Include meaningful hints that guide without giving the answer
7. Include narration text the AI tutor can use
8. Set showOptions:
   - showRunningCount: true for count_all, false for subitize
   - showGroupCircles: true for group_count
   - highlightOnTap: always true
   - showLastNumber: true (emphasizes cardinality)
9. Choose kid-friendly objects that match the topic context
10. objects.type defines the emoji theme for ALL challenges (e.g., 'stars')

Return the complete counting board configuration.
`;

  logEvalModeResolution('CountingBoard', config?.targetEvalMode, evalConstraint);

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid counting board data returned from Gemini API');
  }

  // ── Structural validation ──

  // Validation: ensure gradeBand is valid
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  // Validation: ensure object type is valid
  const validTypes = ['bears', 'apples', 'stars', 'blocks', 'fish', 'butterflies', 'custom'];
  if (!validTypes.includes(data.objects?.type)) {
    data.objects = { type: 'stars' };
  }

  // Filter to valid challenge types (safety net — schema enum handles the eval mode case)
  const validChallengeTypes = ['count_all', 'subitize', 'count_on', 'group_count', 'compare'];
  const validArrangements = ['scattered', 'line', 'groups', 'circle'];

  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // ── Per-challenge validation ──

  for (const challenge of data.challenges) {
    // Validate arrangement
    if (!validArrangements.includes(challenge.arrangement)) {
      challenge.arrangement = 'scattered';
    }

    // group_count: force 2-3 groups of 2-5 objects for reasonable layout
    if (challenge.type === 'group_count') {
      challenge.arrangement = 'groups';
      const validGroupSizes = [2, 3, 4, 5];
      const gs = validGroupSizes.includes(challenge.groupSize)
        ? challenge.groupSize
        : validGroupSizes[Math.floor(Math.random() * validGroupSizes.length)];
      const numGroups = Math.random() < 0.5 ? 2 : 3;
      challenge.groupSize = gs;
      challenge.count = gs * numGroups;
    }

    // compare: force 2 groups with different sizes so one is visibly "more"
    if (challenge.type === 'compare') {
      challenge.arrangement = 'groups';
      // Pick two distinct group sizes (larger 4-8, smaller 2-5, at least 2 apart)
      const larger = 4 + Math.floor(Math.random() * 5);            // 4-8
      const smaller = Math.max(1, larger - 2 - Math.floor(Math.random() * 3)); // at least 2 less
      // groupSize = larger so first group is the big one
      challenge.groupSize = larger;
      challenge.count = larger + smaller;
      challenge.targetAnswer = larger;
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

    // Force targetAnswer = count (except compare, where targetAnswer = larger group)
    if (['count_all', 'group_count', 'count_on', 'subitize'].includes(challenge.type)) {
      challenge.targetAnswer = challenge.count;
    }

    // Ensure groupSize exists when arrangement is 'groups'
    if (challenge.arrangement === 'groups' && !challenge.groupSize) {
      challenge.groupSize = Math.min(5, challenge.count);
    }
  }

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'count_all';
    const fallbacks: Record<string, { type: string; count: number; arrangement: string; instruction: string; targetAnswer: number; hint: string; narration: string; groupSize?: number; startFrom?: number }> = {
      count_all: { type: 'count_all', count: 5, arrangement: 'scattered', instruction: `Can you count all the ${data.objects?.type || 'stars'}?`, targetAnswer: 5, hint: 'Touch each one as you count!', narration: "Let's count together! Touch each one as you count." },
      subitize: { type: 'subitize', count: 4, arrangement: 'scattered', instruction: 'How many do you see right away?', targetAnswer: 4, hint: 'Look at the whole group — how many?', narration: "Look carefully — how many do you see without counting?" },
      count_on: { type: 'count_on', count: 8, arrangement: 'scattered', instruction: 'There are 5 already. Count on to find the total!', targetAnswer: 8, hint: 'Start from 5 and keep counting: 6, 7, 8...', narration: "Some are already counted. Count on from there!", startFrom: 5 },
      group_count: { type: 'group_count', count: 8, arrangement: 'groups', instruction: 'Count the groups! How many altogether?', targetAnswer: 8, hint: 'Count each group, then add them up!', narration: "Let's count by groups!", groupSize: 4 },
      compare: { type: 'compare', count: 11, arrangement: 'groups', instruction: 'Which group has more?', targetAnswer: 7, hint: 'Count each group and compare!', narration: "Which side has more? Let's find out!", groupSize: 7 },
    };
    console.log(`[CountingBoard] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [{ id: 'c1', ...fallbacks[fallbackType] ?? fallbacks.count_all }];
  }

  // Enable group circles if any challenge uses groups (compare or group_count)
  const hasGroupChallenges = data.challenges.some(
    (c: { type: string }) => c.type === 'compare' || c.type === 'group_count'
  );
  if (hasGroupChallenges && data.showOptions) {
    data.showOptions.showGroupCircles = true;
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[CountingBoard] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

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
