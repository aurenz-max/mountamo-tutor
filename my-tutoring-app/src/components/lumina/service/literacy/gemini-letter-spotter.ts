import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { LetterSpotterData } from "../../primitives/visual-primitives/literacy/LetterSpotter";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'name-it': {
    promptDoc:
      `"name-it": Student sees a letter displayed visually (uppercase, lowercase, or both) and picks its name from 4 options. `
      + `2-3 challenges per session. Distractors are visually or phonetically similar letters from the cumulative group. `
      + `Do NOT include letterGrid or targetCount for this mode.`,
    schemaDescription: "'name-it' (identify letter by name)",
  },
  'find-it': {
    promptDoc:
      `"find-it": Student hears a letter name and finds all instances in a 4x4 grid of 16 uppercase letters. `
      + `2-3 challenges per session. Grid contains 2-3 instances of the target mixed with distractors. `
      + `targetCase must be "uppercase". Do NOT include options for this mode.`,
    schemaDescription: "'find-it' (locate letter in grid)",
  },
  'match-it': {
    promptDoc:
      `"match-it": Student sees an uppercase letter and matches it to the correct lowercase form from 4 options. `
      + `2-3 challenges per session. Distractors are visually similar lowercase letters (e.g., b/d, p/q, m/n). `
      + `targetCase must be "uppercase". Do NOT include letterGrid or targetCount for this mode.`,
    schemaDescription: "'match-it' (match uppercase to lowercase)",
  },
};

/**
 * Schema definition for Letter Spotter Data
 *
 * Generates interactive letter recognition activities for K-2 students.
 * Three modes: Name It (identify letter by name), Find It (locate letter in grid),
 * Match It (match uppercase to lowercase). Follows cumulative group progression
 * across 4 letter groups based on instructional frequency.
 */
const letterSpotterSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the letter recognition activity (e.g., 'Spot the Letters - Group 1!')",
    },
    letterGroup: {
      type: Type.NUMBER,
      description: "Which letter group (1, 2, 3, or 4)",
    },
    cumulativeLetters: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "All letters available in this group (lowercase)",
    },
    newLetters: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Letters newly introduced in this group (lowercase)",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge identifier (e.g., 'ch1', 'ch2')",
          },
          mode: {
            type: Type.STRING,
            enum: ["name-it", "find-it", "match-it"],
            description: "Challenge mode: name-it, find-it, or match-it",
          },
          targetLetter: {
            type: Type.STRING,
            description: "The letter to identify (lowercase, e.g., 's', 'a')",
          },
          targetCase: {
            type: Type.STRING,
            enum: ["uppercase", "lowercase", "both"],
            description: "How to display the target letter",
          },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "For name-it: 4 letter name options. For match-it: 4 lowercase letter options. Include the correct answer.",
          },
          letterGrid: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "For find-it: 16 uppercase letters in a 4x4 grid with 2-3 instances of the target mixed with distractors",
          },
          targetCount: {
            type: Type.NUMBER,
            description: "For find-it: how many instances of the target letter are in the grid (2 or 3)",
          },
        },
        required: ["id", "mode", "targetLetter", "targetCase"],
      },
      description: "Array of 6-8 challenges mixing name-it, find-it, and match-it modes",
    },
  },
  required: ["title", "letterGroup", "cumulativeLetters", "newLetters", "challenges"],
};

// ============================================================================
// Letter Group Definitions
// ============================================================================

const LETTER_GROUPS: Record<number, string[]> = {
  1: ['s', 'a', 't', 'i', 'p', 'n'],
  2: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd'],
  3: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b'],
  4: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b', 'j', 'z', 'w', 'v', 'y', 'x', 'q'],
};

const NEW_LETTERS: Record<number, string[]> = {
  1: ['s', 'a', 't', 'i', 'p', 'n'],
  2: ['c', 'k', 'e', 'h', 'r', 'm', 'd'],
  3: ['g', 'o', 'u', 'l', 'f', 'b'],
  4: ['j', 'z', 'w', 'v', 'y', 'x', 'q'],
};

/**
 * Generate Letter Spotter data using Gemini AI
 *
 * Creates interactive letter recognition activities with three modes:
 * - Name It: See a letter displayed visually, pick its name from options
 * - Find It: Hear a letter name, find all instances in a 4x4 grid
 * - Match It: See an uppercase letter, match it to the correct lowercase
 *
 * Follows cumulative group progression:
 * - Group 1: s, a, t, i, p, n (6 letters)
 * - Group 2: Group 1 + c, k, e, h, r, m, d (13 letters)
 * - Group 3: Group 2 + g, o, u, l, f, b (19 letters)
 * - Group 4: Group 3 + j, z, w, v, y, x, q (full 26)
 *
 * @param topic - Theme or context for the activity
 * @param gradeLevel - Grade level ('K', '1', or '2')
 * @param config - Optional config with letterGroup override and targetEvalMode
 * @returns LetterSpotterData with challenges across all three modes
 */
export const generateLetterSpotter = async (
  topic: string,
  gradeLevel: string = 'K',
  config?: Partial<{
    letterGroup: number;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode: string;
  }>,
): Promise<LetterSpotterData> => {

  // -------------------------------------------------------------------------
  // Eval mode resolution
  // -------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    'letter-spotter',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('LetterSpotter', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(letterSpotterSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'mode',
      })
    : letterSpotterSchema;

  // -------------------------------------------------------------------------
  // Letter group setup
  // -------------------------------------------------------------------------
  const letterGroup = (config?.letterGroup && config.letterGroup >= 1 && config.letterGroup <= 4)
    ? config.letterGroup
    : 1;

  const cumulativeLetters = LETTER_GROUPS[letterGroup];
  const newLetters = NEW_LETTERS[letterGroup];

  // -------------------------------------------------------------------------
  // Build prompt with eval-mode-scoped challenge type docs
  // -------------------------------------------------------------------------
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const generationPrompt = `Create an interactive letter recognition activity for the topic: "${topic}".

TARGET GRADE LEVEL: ${gradeLevel}
LETTER GROUP: ${letterGroup}
CUMULATIVE LETTERS (all available): ${cumulativeLetters.join(', ')}
NEW LETTERS (just introduced): ${newLetters.join(', ')}

Generate 6-8 challenges. Prioritize new letters but include some review letters too.

${challengeTypeSection}

MODE-SPECIFIC FIELD RULES:
- name-it: set options (4 letters), do NOT set letterGrid or targetCount
- find-it: set letterGrid (16 uppercase letters) and targetCount (2-3), do NOT set options
- match-it: set options (4 lowercase letters), do NOT set letterGrid or targetCount

RULES:
- Use IDs: ch1, ch2, ch3, etc.
- At least half the challenges should target NEW letters.
- All distractor letters must come from the cumulative letters list.
- For find-it grids: exactly 16 cells, each cell is a single UPPERCASE letter.
- For name-it and match-it: exactly 4 options, each a single lowercase letter.
- Vary targetCase across name-it challenges (some uppercase, some lowercase, some both).
${!evalConstraint ? '- Order challenges so modes alternate (don\'t cluster all the same mode together).' : ''}

LETTER GROUP DATA:
- letterGroup: ${letterGroup}
- cumulativeLetters: [${cumulativeLetters.map(l => `"${l}"`).join(', ')}]
- newLetters: [${newLetters.map(l => `"${l}"`).join(', ')}]`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: `You are an expert K-2 literacy specialist designing letter recognition activities. You create engaging, developmentally appropriate challenges that help young students learn to identify letters by name, find them visually, and match uppercase to lowercase forms. You understand common letter confusions (b/d, p/q, m/n, u/n) and use them as strategic distractors to strengthen discrimination skills. You always use letters only from the specified cumulative group.`,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as LetterSpotterData;

    // ========================================================================
    // Post-generation validation & defaults
    // ========================================================================

    // Ensure letterGroup is correct
    result.letterGroup = letterGroup as 1 | 2 | 3 | 4;

    // Enforce correct cumulative and new letter sets
    result.cumulativeLetters = cumulativeLetters;
    result.newLetters = newLetters;

    // Validate challenges
    if (result.challenges) {
      result.challenges = result.challenges.map((ch, i) => {
        // Ensure IDs exist
        if (!ch.id) ch.id = `ch${i + 1}`;

        // Ensure targetLetter is lowercase
        ch.targetLetter = (ch.targetLetter || 's').toLowerCase();

        // Ensure targetLetter is within the cumulative group
        if (!cumulativeLetters.includes(ch.targetLetter)) {
          ch.targetLetter = newLetters[i % newLetters.length];
        }

        // Validate mode-specific fields
        if (ch.mode === 'find-it') {
          // Ensure grid has exactly 16 cells
          if (!ch.letterGrid || ch.letterGrid.length !== 16) {
            // Build a valid grid with 2-3 target instances
            const count = ch.targetCount || 2;
            const grid: string[] = [];
            for (let j = 0; j < count; j++) {
              grid.push(ch.targetLetter.toUpperCase());
            }
            const distractors = cumulativeLetters.filter(l => l !== ch.targetLetter);
            while (grid.length < 16) {
              grid.push(distractors[Math.floor(Math.random() * distractors.length)].toUpperCase());
            }
            // Shuffle
            for (let j = grid.length - 1; j > 0; j--) {
              const k = Math.floor(Math.random() * (j + 1));
              [grid[j], grid[k]] = [grid[k], grid[j]];
            }
            ch.letterGrid = grid;
          } else {
            // Ensure all grid cells are uppercase
            ch.letterGrid = ch.letterGrid.map(l => l.toUpperCase());
          }

          // Ensure targetCount matches actual target instances in grid
          ch.targetCount = ch.letterGrid.filter(
            l => l.toLowerCase() === ch.targetLetter
          ).length;

          // Clean up fields that shouldn't exist for find-it
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).options;
        } else {
          // name-it or match-it: ensure 4 options including correct answer
          if (!ch.options || ch.options.length < 4) {
            const correct = ch.targetLetter;
            const distractors = cumulativeLetters
              .filter(l => l !== correct)
              .sort(() => Math.random() - 0.5)
              .slice(0, 3);
            ch.options = [correct, ...distractors].sort(() => Math.random() - 0.5);
          } else {
            // Ensure correct answer is in options
            ch.options = ch.options.map(o => o.toLowerCase());
            if (!ch.options.includes(ch.targetLetter)) {
              ch.options[Math.floor(Math.random() * ch.options.length)] = ch.targetLetter;
            }
          }

          // Clean up fields that shouldn't exist for name-it/match-it
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).letterGrid;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).targetCount;
        }

        return ch;
      });

      // Fallback: ensure at least one challenge exists
      if (result.challenges.length === 0) {
        const fallbackMode = evalConstraint?.allowedTypes[0] ?? 'name-it';
        const targetLetter = newLetters[0];
        const distractors = cumulativeLetters
          .filter(l => l !== targetLetter)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        result.challenges = [{
          id: 'ch1',
          mode: fallbackMode as 'name-it' | 'find-it' | 'match-it',
          targetLetter,
          targetCase: 'uppercase' as const,
          options: [targetLetter, ...distractors].sort(() => Math.random() - 0.5),
        }];
      }
    }

    console.log('Letter Spotter Generated:', {
      title: result.title,
      letterGroup: result.letterGroup,
      cumulativeLetters: result.cumulativeLetters.join(', '),
      newLetters: result.newLetters.join(', '),
      challengeCount: result.challenges?.length || 0,
      modes: result.challenges?.map(ch => ch.mode) || [],
    });

    return result;

  } catch (error) {
    console.error("Error generating letter spotter:", error);
    throw error;
  }
};
