import { Type, Schema } from "@google/genai";
import { ComparisonBuilderData, ComparisonBuilderChallenge } from "../../primitives/visual-primitives/math/ComparisonBuilder";
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
  'compare-groups': {
    promptDoc:
      `"compare-groups": Two groups of objects shown side by side in LEFT and RIGHT boxes. `
      + `Student decides whether the LEFT group has MORE, FEWER, or THE SAME as the RIGHT group. `
      + `Requires: leftGroup (count + objectType), rightGroup (count + objectType), correctAnswer ('more'/'less'/'equal'). `
      + `correctAnswer describes the LEFT group relative to the RIGHT group ('more' = left > right, 'less' = left < right, 'equal' = left == right). `
      + `IMPORTANT: The instruction text MUST frame the question about the left group, e.g. "Does the left group have more, fewer, or the same as the right?" `
      + `Do NOT write instructions like "Which group has more?" because the answer buttons are about the left group specifically. `
      + `Use same objectType for both groups within a challenge so comparison is about quantity. Include some "equal" comparisons.`,
    schemaDescription: "'compare-groups' (visual group comparison)",
  },
  'one-more-one-less': {
    promptDoc:
      `"one-more-one-less": Given a target number, student finds one more, one less, or both. `
      + `Requires: targetNumber, askFor ('one-more'/'one-less'/'both'). `
      + `Ensure target stays in range so answers are valid (e.g., not 1 for one-less in K, not max for one-more).`,
    schemaDescription: "'one-more-one-less' (adjacent number reasoning)",
  },
  'compare-numbers': {
    promptDoc:
      `"compare-numbers": Two numbers shown with a blank between them. Student picks <, >, or =. `
      + `Requires: leftNumber, rightNumber, correctSymbol ('<'/'>'/'='). `
      + `correctSymbol goes between leftNumber and rightNumber (e.g., 5 > 3).`,
    schemaDescription: "'compare-numbers' (symbolic comparison with <, >, =)",
  },
  order: {
    promptDoc:
      `"order": A set of 3-5 numbers to arrange in ascending or descending order. `
      + `Requires: numbers (shuffled array), direction ('ascending'/'descending'). `
      + `Provide the numbers in a shuffled (non-sorted) order; the student must sort them.`,
    schemaDescription: "'order' (arrange numbers in sequence)",
  },
};

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

const comparisonBuilderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the comparison activity (e.g., 'Which Has More?', 'Compare the Numbers!')"
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
            description: "Unique challenge ID (e.g., 'c1', 'c2')"
          },
          type: {
            type: Type.STRING,
            description: "Challenge type: 'compare-groups' (visual group comparison), 'compare-numbers' (use <, >, = symbols), 'order' (arrange numbers), 'one-more-one-less' (find one more or one less)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging. For compare-groups: always frame about the left group (e.g., 'Does the left group have more, fewer, or the same number of stars?')"
          },
          leftGroup: {
            type: Type.OBJECT,
            properties: {
              count: {
                type: Type.NUMBER,
                description: "Number of objects in the left group"
              },
              objectType: {
                type: Type.STRING,
                description: "Type of object: 'bears', 'apples', 'stars', 'blocks', 'fish', 'butterflies', 'hearts', 'flowers', 'cookies', 'balls'"
              }
            },
            required: ["count", "objectType"],
            description: "Left group for compare-groups challenges"
          },
          rightGroup: {
            type: Type.OBJECT,
            properties: {
              count: {
                type: Type.NUMBER,
                description: "Number of objects in the right group"
              },
              objectType: {
                type: Type.STRING,
                description: "Type of object: 'bears', 'apples', 'stars', 'blocks', 'fish', 'butterflies', 'hearts', 'flowers', 'cookies', 'balls'"
              }
            },
            required: ["count", "objectType"],
            description: "Right group for compare-groups challenges"
          },
          correctAnswer: {
            type: Type.STRING,
            description: "For compare-groups: 'more', 'less', or 'equal' — which describes the LEFT group relative to the RIGHT group"
          },
          leftNumber: {
            type: Type.NUMBER,
            description: "Left number for compare-numbers challenges"
          },
          rightNumber: {
            type: Type.NUMBER,
            description: "Right number for compare-numbers challenges"
          },
          correctSymbol: {
            type: Type.STRING,
            description: "For compare-numbers: '<', '>', or '=' — the correct inequality symbol between leftNumber and rightNumber"
          },
          numbers: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "For order challenges: array of numbers to arrange in ascending or descending order"
          },
          direction: {
            type: Type.STRING,
            description: "For order challenges: 'ascending' or 'descending'"
          },
          targetNumber: {
            type: Type.NUMBER,
            description: "For one-more-one-less challenges: the reference number"
          },
          askFor: {
            type: Type.STRING,
            description: "For one-more-one-less challenges: 'one-more', 'one-less', or 'both'"
          }
        },
        required: ["id", "type", "instruction"]
      },
      description: "Array of 4-6 progressive challenges"
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' for Kindergarten, '1' for Grade 1"
    },
    showCorrespondenceLines: {
      type: Type.BOOLEAN,
      description: "Whether to show one-to-one correspondence lines between groups during compare-groups challenges"
    },
    useAlligatorMnemonic: {
      type: Type.BOOLEAN,
      description: "Whether to use the 'alligator eats the bigger number' mnemonic for inequality symbols"
    }
  },
  required: ["title", "challenges", "gradeBand", "showCorrespondenceLines", "useAlligatorMnemonic"]
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateComparisonBuilder = async (
  topic: string,
  gradeLevel: string,
  config?: {
    gradeBand?: 'K' | '1';
    showCorrespondenceLines?: boolean;
    useAlligatorMnemonic?: boolean;
    title?: string;
    description?: string;
    /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
    targetEvalMode?: string;
  }
): Promise<ComparisonBuilderData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'comparison-builder',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(comparisonBuilderSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : comparisonBuilderSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create an educational comparison activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A comparison builder helps students learn to compare quantities and use inequality symbols (<, >, =)
- Students work through challenges that build from concrete visual comparisons to abstract number comparisons
- Key skills: comparing groups, using inequality symbols, ordering numbers, one-more/one-less reasoning

${challengeTypeSection}

${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * Numbers 1-10 only
  * Groups up to 5-10 objects
  * Focus on compare-groups (concrete) and one-more-one-less
  * Include 1-2 compare-numbers challenges with small numbers (1-5)
  * Simple ordering with 3 numbers
  * Use warm, fun language ("Which group has more bears? Let's count and find out!")
  * Set showCorrespondenceLines: true (helps K students see 1-to-1 matching)
  * Set useAlligatorMnemonic: true (the alligator mouth opens toward the bigger number)

- Grade 1 (gradeBand "1"):
  * Numbers 1-20
  * Groups up to 10-15 objects
  * All 4 challenge types in good balance
  * Ordering with 4-5 numbers
  * Introduce both ascending and descending ordering
  * More abstract compare-numbers challenges
  * Use encouraging language that builds confidence with symbols
` : ''}

OBJECT TYPES (pick from these for groups):
bears, apples, stars, blocks, fish, butterflies, hearts, flowers, cookies, balls

${(() => {
  const hints: string[] = [];
  if (config?.gradeBand) hints.push(`- Grade band: ${config.gradeBand}`);
  if (config?.showCorrespondenceLines !== undefined) hints.push(`- Show correspondence lines: ${config.showCorrespondenceLines}`);
  if (config?.useAlligatorMnemonic !== undefined) hints.push(`- Use alligator mnemonic: ${config.useAlligatorMnemonic}`);
  return hints.length > 0 ? `CONFIGURATION HINTS:\n${hints.join('\n')}` : '';
})()}

REQUIREMENTS:
1. Generate 4-6 challenges that progress in difficulty
2. Start with easier challenges and build up
3. Use warm, encouraging instruction text for young children
4. For compare-groups: use the same object type in both groups for fair comparison. The instruction MUST ask about the LEFT group (e.g. "Does the left group have more, fewer, or the same?")
5. For compare-numbers: correctSymbol must be mathematically correct
6. For order: provide numbers in shuffled (non-sorted) order
7. For one-more-one-less: target numbers should be within range (not 1 for one-less in K, not max for one-more)
8. Each challenge must have a unique id (c1, c2, c3, etc.)
9. Vary the difficulty progressively

Return the complete comparison builder configuration.
`;

  logEvalModeResolution('ComparisonBuilder', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid comparison builder data returned from Gemini API');
  }

  // ── Structural validation ──

  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  if (typeof data.showCorrespondenceLines !== 'boolean') {
    data.showCorrespondenceLines = true;
  }
  if (typeof data.useAlligatorMnemonic !== 'boolean') {
    data.useAlligatorMnemonic = true;
  }

  // Valid values for validation
  const validTypes = ['compare-groups', 'compare-numbers', 'order', 'one-more-one-less'];
  const validObjectTypes = ['bears', 'apples', 'stars', 'blocks', 'fish', 'butterflies', 'hearts', 'flowers', 'cookies', 'balls'];
  const maxNumber = data.gradeBand === 'K' ? 10 : 20;

  // Filter to valid challenge types (safety net — schema enum handles the eval mode case)
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validTypes.includes(c.type)
  );

  // Ensure unique IDs
  const seenIds = new Set<string>();
  for (let i = 0; i < data.challenges.length; i++) {
    const challenge = data.challenges[i] as ComparisonBuilderChallenge;
    if (!challenge.id || seenIds.has(challenge.id)) {
      challenge.id = `c${i + 1}`;
    }
    seenIds.add(challenge.id);

    // Per-type validation
    switch (challenge.type) {
      case 'compare-groups': {
        if (!challenge.leftGroup) {
          challenge.leftGroup = { count: 3, objectType: 'bears' };
        }
        if (!challenge.rightGroup) {
          challenge.rightGroup = { count: 5, objectType: 'bears' };
        }
        challenge.leftGroup.count = Math.max(1, Math.min(challenge.leftGroup.count, maxNumber));
        challenge.rightGroup.count = Math.max(1, Math.min(challenge.rightGroup.count, maxNumber));
        if (!validObjectTypes.includes(challenge.leftGroup.objectType)) {
          challenge.leftGroup.objectType = 'bears';
        }
        if (!validObjectTypes.includes(challenge.rightGroup.objectType)) {
          challenge.rightGroup.objectType = 'bears';
        }
        // Compute correct answer based on actual counts
        if (challenge.leftGroup.count > challenge.rightGroup.count) {
          challenge.correctAnswer = 'more';
        } else if (challenge.leftGroup.count < challenge.rightGroup.count) {
          challenge.correctAnswer = 'less';
        } else {
          challenge.correctAnswer = 'equal';
        }
        break;
      }
      case 'compare-numbers': {
        if (typeof challenge.leftNumber !== 'number') challenge.leftNumber = 3;
        if (typeof challenge.rightNumber !== 'number') challenge.rightNumber = 5;
        challenge.leftNumber = Math.max(1, Math.min(challenge.leftNumber, maxNumber));
        challenge.rightNumber = Math.max(1, Math.min(challenge.rightNumber, maxNumber));
        if (challenge.leftNumber > challenge.rightNumber) {
          challenge.correctSymbol = '>';
        } else if (challenge.leftNumber < challenge.rightNumber) {
          challenge.correctSymbol = '<';
        } else {
          challenge.correctSymbol = '=';
        }
        break;
      }
      case 'order': {
        if (!Array.isArray(challenge.numbers) || challenge.numbers.length < 3) {
          challenge.numbers = [3, 1, 5];
        }
        challenge.numbers = challenge.numbers.map(
          (n: number) => Math.max(1, Math.min(typeof n === 'number' ? n : 1, maxNumber))
        );
        if (challenge.direction !== 'ascending' && challenge.direction !== 'descending') {
          challenge.direction = 'ascending';
        }
        break;
      }
      case 'one-more-one-less': {
        if (typeof challenge.targetNumber !== 'number') challenge.targetNumber = 5;
        challenge.targetNumber = Math.max(1, Math.min(challenge.targetNumber, maxNumber));
        if (challenge.askFor !== 'one-more' && challenge.askFor !== 'one-less' && challenge.askFor !== 'both') {
          challenge.askFor = 'both';
        }
        if (challenge.askFor === 'one-less' || challenge.askFor === 'both') {
          challenge.targetNumber = Math.max(2, challenge.targetNumber);
        }
        if (challenge.askFor === 'one-more' || challenge.askFor === 'both') {
          challenge.targetNumber = Math.min(maxNumber - 1, challenge.targetNumber);
        }
        break;
      }
    }
  }

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'compare-groups';
    const fallbacks: Record<string, ComparisonBuilderChallenge> = {
      'compare-groups': {
        id: 'c1',
        type: 'compare-groups' as const,
        instruction: 'Which group has more bears?',
        leftGroup: { count: 3, objectType: 'bears' },
        rightGroup: { count: 5, objectType: 'bears' },
        correctAnswer: 'less' as const,
      },
      'compare-numbers': {
        id: 'c1',
        type: 'compare-numbers' as const,
        instruction: 'Pick the right symbol: is 4 greater than, less than, or equal to 7?',
        leftNumber: 4,
        rightNumber: 7,
        correctSymbol: '<' as const,
      },
      order: {
        id: 'c1',
        type: 'order' as const,
        instruction: 'Put these numbers in order from least to greatest!',
        numbers: [3, 1, 5],
        direction: 'ascending' as const,
      },
      'one-more-one-less': {
        id: 'c1',
        type: 'one-more-one-less' as const,
        instruction: 'What is one more than 5? What is one less?',
        targetNumber: 5,
        askFor: 'both' as const,
      },
    };
    console.log(`[ComparisonBuilder] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [fallbacks[fallbackType] ?? fallbacks['compare-groups']];
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[ComparisonBuilder] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  // Apply config overrides
  if (config) {
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
    if (config.showCorrespondenceLines !== undefined) data.showCorrespondenceLines = config.showCorrespondenceLines;
    if (config.useAlligatorMnemonic !== undefined) data.useAlligatorMnemonic = config.useAlligatorMnemonic;
    if (config.title !== undefined) data.title = config.title;
    if (config.description !== undefined) data.description = config.description;
  }

  return data as ComparisonBuilderData;
};
