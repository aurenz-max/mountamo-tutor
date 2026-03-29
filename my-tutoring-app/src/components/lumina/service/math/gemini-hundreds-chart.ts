import { Type, Schema } from "@google/genai";
import { HundredsChartData, HundredsChartChallenge } from '../../primitives/visual-primitives/math/HundredsChart';
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  highlight_sequence: {
    promptDoc:
      `"highlight_sequence": Student clicks every cell in a skip-count sequence. `
      + `Instruction MUST say "click" or "tap" — never "watch" or "observe".`,
    schemaDescription: "'highlight_sequence' (click all skip-count cells)",
  },
  complete_sequence: {
    promptDoc:
      `"complete_sequence": First 3 cells are pre-highlighted. Student clicks the remaining cells to complete the pattern.`,
    schemaDescription: "'complete_sequence' (continue a partially-shown pattern)",
  },
  identify_pattern: {
    promptDoc:
      `"identify_pattern": Full sequence is shown. Student picks which visual description matches the grid pattern from 4 options.`,
    schemaDescription: "'identify_pattern' (name the visual shape on the grid)",
  },
  find_skip_value: {
    promptDoc:
      `"find_skip_value": First 3-4 cells are shown. Student picks the correct skip interval from 4 number options.`,
    schemaDescription: "'find_skip_value' (deduce the skip interval)",
  },
};

// ---------------------------------------------------------------------------
// Minimal schema — Gemini only provides creative text + skip values
// All cell lists, options, and correct answers are computed deterministically.
// ---------------------------------------------------------------------------

const hundredsChartSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Fun, kid-friendly title (e.g., 'Skip-Count Safari!', 'The Fives Train')",
    },
    description: {
      type: Type.STRING,
      description: "One-sentence description of what the student will explore",
    },
    challenges: {
      type: Type.ARRAY,
      description: "3-4 challenges. IMPORTANT: use a DIFFERENT skipValue for each challenge for variety.",
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: "'highlight_sequence', 'complete_sequence', 'identify_pattern', or 'find_skip_value'",
          },
          skipValue: {
            type: Type.INTEGER,
            description: "Skip interval (2, 3, 4, 5, or 10). Use a DIFFERENT value per challenge.",
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction. For highlight/complete: must say 'click' or 'tap'. Must NOT reveal the answer or the skip value for find_skip_value.",
          },
          hint: {
            type: Type.STRING,
            description: "Helpful hint shown after a wrong answer. Must not give away the answer.",
          },
        },
        required: ["type", "skipValue", "instruction", "hint"],
      },
    },
  },
  required: ["title", "description", "challenges"],
};

// ---------------------------------------------------------------------------
// Deterministic helpers — all math computed here, never by the LLM
// ---------------------------------------------------------------------------

function buildSequence(skipValue: number, startNumber: number): number[] {
  const seq: number[] = [];
  for (let n = startNumber; n <= 100; n += skipValue) {
    seq.push(n);
  }
  return seq;
}

/** Correct visual pattern descriptions for each skip value on a 10×10 grid */
const PATTERN_DESCRIPTIONS: Record<number, { correct: string; distractors: string[] }> = {
  2:  { correct: 'Every other cell in each row',           distractors: ['A checkerboard pattern', 'They fill every row completely', 'They are scattered randomly'] },
  3:  { correct: 'A repeating diagonal pattern',           distractors: ['Every other cell in each row', 'They fill two columns', 'A zigzag going left and right'] },
  4:  { correct: 'Columns that shift across rows',         distractors: ['Every other cell in each row', 'A single diagonal line', 'They fill every other row'] },
  5:  { correct: 'Two vertical columns (5th and 10th)',    distractors: ['They fill every other row', 'A diagonal stripe across the grid', 'Every other cell in each row'] },
  6:  { correct: 'A shifting pattern across rows',         distractors: ['Every other cell in each row', 'Two vertical columns', 'They fill every other row'] },
  7:  { correct: 'A shifting diagonal pattern',            distractors: ['Every other cell in each row', 'They fill every other row', 'A zigzag going left and right'] },
  8:  { correct: 'A sparse shifting pattern',              distractors: ['Every other cell in each row', 'A single diagonal line', 'They fill every other row'] },
  9:  { correct: 'A slow diagonal stepping pattern',       distractors: ['They fill every other row', 'Every other cell in each row', 'They are scattered randomly'] },
  10: { correct: 'One vertical column (the last column)',  distractors: ['They fill every other row', 'Every other cell in each row', 'A diagonal stripe across the grid'] },
};

/** Skip-value distractor options for find_skip_value */
const SKIP_VALUE_DISTRACTORS: Record<number, number[]> = {
  2:  [3, 5, 10],
  3:  [2, 4, 5],
  4:  [2, 3, 5],
  5:  [2, 3, 10],
  6:  [3, 5, 8],
  7:  [5, 6, 9],
  8:  [4, 6, 10],
  9:  [7, 8, 10],
  10: [2, 5, 20],
};

/** Grade-appropriate skip values */
const GRADE_SKIP_VALUES: Record<string, number[]> = {
  '1': [2, 5, 10],
  '2': [2, 5, 10],
  '3': [2, 3, 4, 5],
  '4': [3, 4, 6, 7, 8, 9],
};

function getPatternOptions(sv: number): { options: string[]; correctAnswer: string } {
  const entry = PATTERN_DESCRIPTIONS[sv] ?? PATTERN_DESCRIPTIONS[5];
  const allOptions = [entry.correct, ...entry.distractors];
  // Shuffle distractors but keep correct answer trackable
  const shuffled = allOptions.sort(() => Math.random() - 0.5);
  return { options: shuffled, correctAnswer: entry.correct };
}

function getSkipValueOptions(sv: number): { options: string[]; correctAnswer: string } {
  const distractors = SKIP_VALUE_DISTRACTORS[sv] ?? [2, 5, 10];
  const allNums = [sv, ...distractors.filter(d => d !== sv)].slice(0, 4);
  const shuffled = allNums.sort(() => Math.random() - 0.5);
  return { options: shuffled.map(String), correctAnswer: String(sv) };
}

/**
 * Build the full challenge data deterministically from type + skipValue.
 * Gemini only provides instruction + hint text.
 */
function buildChallenge(
  index: number,
  type: string,
  skipValue: number,
  instruction: string,
  hint: string,
): HundredsChartChallenge {
  const startNumber = skipValue; // tidy multiples
  const fullSeq = buildSequence(skipValue, startNumber);

  let givenCells: number[] = [];
  let correctCells: number[] = [];
  let options: string[] = [];
  let correctAnswer = '';

  switch (type) {
    case 'highlight_sequence': {
      correctCells = fullSeq;
      break;
    }
    case 'complete_sequence': {
      givenCells = fullSeq.slice(0, 3);
      const givenSet = new Set(givenCells);
      correctCells = fullSeq.filter(n => !givenSet.has(n));
      break;
    }
    case 'identify_pattern': {
      givenCells = fullSeq;
      correctCells = fullSeq;
      const patternOpts = getPatternOptions(skipValue);
      options = patternOpts.options;
      correctAnswer = patternOpts.correctAnswer;
      break;
    }
    case 'find_skip_value': {
      givenCells = fullSeq.slice(0, 4);
      correctCells = givenCells;
      const skipOpts = getSkipValueOptions(skipValue);
      options = skipOpts.options;
      correctAnswer = skipOpts.correctAnswer;
      break;
    }
  }

  return {
    id: `c${index + 1}`,
    type: type as HundredsChartChallenge['type'],
    instruction,
    skipValue,
    startNumber,
    givenCells,
    correctCells,
    correctAnswer,
    options,
    hint,
  };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateHundredsChart = async (
  topic: string,
  gradeLevel: string,
  config?: {
    skipValue?: number;
    gradeBand?: '1' | '2' | '3' | '4';
    challengeTypes?: string[];
    targetEvalMode?: string;
    intent?: string;
  }
): Promise<HundredsChartData> => {
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    'hundreds-chart',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  const effectiveChallengeTypes = evalConstraint?.allowedTypes ?? config?.challengeTypes;
  const gradeBand = config?.gradeBand ?? '2';
  const gradeSkips = GRADE_SKIP_VALUES[gradeBand] ?? GRADE_SKIP_VALUES['2'];

  // ── Build prompt — only ask for creative text ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create a hundreds-chart activity for "${topic}" for ${gradeLevel} students.

A hundreds chart is a 10×10 grid (numbers 1-100). Students explore skip-counting patterns.

${challengeTypeSection}

${!evalConstraint ? `
PROGRESSION (use this order when no eval mode is specified):
1. highlight_sequence — click all cells in the pattern
2. complete_sequence — continue a partially-shown pattern
3. identify_pattern — name the visual pattern
4. find_skip_value — discover the hidden skip rule
` : ''}

RULES:
- Generate 3-4 challenges.
- Use DIFFERENT skipValue for each challenge (choose from: ${gradeSkips.join(', ')}).
${config?.skipValue ? `- At least one challenge must use skipValue=${config.skipValue}.` : ''}
${effectiveChallengeTypes ? `- All challenges must use type: ${effectiveChallengeTypes.join(' or ')}.` : ''}
- For highlight_sequence / complete_sequence: instruction MUST say "click" or "tap". Never "watch" or "observe".
- For find_skip_value: instruction must NOT reveal the skip value.
- Instructions must be student-friendly, encouraging, and NOT reveal answers.
- Hints should guide thinking without giving away the answer.
`;

  logEvalModeResolution('HundredsChart', config?.targetEvalMode, evalConstraint);

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: hundredsChartSchema,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = result.text ? JSON.parse(result.text) : null;

  if (!raw) {
    throw new Error('No valid hundreds chart data returned from Gemini API');
  }

  // ── Build challenges deterministically from Gemini's creative text ──
  const validTypes = new Set(['highlight_sequence', 'complete_sequence', 'identify_pattern', 'find_skip_value']);

  const challenges: HundredsChartChallenge[] = (raw.challenges ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((c: any) => validTypes.has(c.type))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((c: any, i: number) => {
      // Validate skipValue — must be a positive integer in grade-appropriate range
      let sv: number = c.skipValue;
      if (!sv || sv <= 0 || sv > 10) {
        sv = config?.skipValue ?? gradeSkips[i % gradeSkips.length];
      }

      return buildChallenge(
        i,
        c.type,
        sv,
        c.instruction ?? `Click the numbers when counting by ${sv}s!`,
        c.hint ?? `Look at the pattern — what do the ones digits have in common?`,
      );
    });

  // Fallback if Gemini returned nothing usable
  if (challenges.length === 0) {
    const sv = config?.skipValue ?? 5;
    challenges.push(buildChallenge(
      0,
      effectiveChallengeTypes?.[0] ?? 'highlight_sequence',
      sv,
      `Click every number you say when counting by ${sv}s!`,
      `Start at ${sv} and keep adding ${sv}. Click each number you land on.`,
    ));
    console.log('[HundredsChart] No valid challenges from Gemini — using fallback');
  }

  const typeBreakdown = challenges.map(c => `${c.type}(skip=${c.skipValue})`).join(', ');
  console.log(`[HundredsChart] Final: ${challenges.length} challenge(s) → [${typeBreakdown}]`);

  return {
    title: raw.title ?? `Hundreds Chart — ${topic}`,
    description: raw.description ?? '',
    challenges,
    gridMax: 100,
    gradeBand: gradeBand as '1' | '2' | '3' | '4',
  };
};
