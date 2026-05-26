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
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// One Gemini call produces all challenges (pool-service), so bumping past 6
// is safe for any mode resolved here.
// ---------------------------------------------------------------------------

type ChallengeType =
  | 'highlight_sequence'
  | 'complete_sequence'
  | 'identify_pattern'
  | 'find_skip_value';

const DEFAULT_INSTANCE_COUNT = 7; // tier fallback (T1)
const MAX_INSTANCE_COUNT = 8;

const COUNT_BY_MODE: Record<ChallengeType, number> = {
  highlight_sequence: 7,
  complete_sequence: 5,
  identify_pattern: 5,
  find_skip_value: 5,
};

function resolveCount(mode: ChallengeType | undefined): number {
  const base = mode != null ? COUNT_BY_MODE[mode] ?? DEFAULT_INSTANCE_COUNT : DEFAULT_INSTANCE_COUNT;
  return Math.max(1, Math.min(MAX_INSTANCE_COUNT, base));
}

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  highlight_sequence: {
    promptDoc: `"highlight_sequence": Student clicks every cell in a skip-count sequence from 1-100.`,
    schemaDescription: "'highlight_sequence' (click all skip-count cells)",
  },
  complete_sequence: {
    promptDoc: `"complete_sequence": First 3 cells are pre-highlighted. Student clicks all remaining cells of the sequence to 100.`,
    schemaDescription: "'complete_sequence' (continue a partially-shown pattern)",
  },
  identify_pattern: {
    promptDoc: `"identify_pattern": Full sequence is shown. Student picks which visual description matches the grid pattern from 4 options.`,
    schemaDescription: "'identify_pattern' (name the visual shape on the grid)",
  },
  find_skip_value: {
    promptDoc: `"find_skip_value": First 3-4 cells are shown. Student picks the correct skip interval from 4 number options.`,
    schemaDescription: "'find_skip_value' (deduce the skip interval)",
  },
};

// ---------------------------------------------------------------------------
// Schema — Gemini provides only title/description and per-challenge type +
// skipValue + hint. The `instruction` field is generated deterministically
// inside buildChallenge so it cannot desync with the canonical cell data
// (SP-17). The `hint` is shown after a wrong answer and makes no structural
// claims about cells, so it stays LLM-generated.
// ---------------------------------------------------------------------------

function buildHundredsChartSchema(count: number): Schema {
  return {
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
      description: `Exactly ${count} challenges. IMPORTANT: vary skipValue across challenges for variety; repeats are allowed only if the grade-appropriate skip pool has fewer values than challenges.`,
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
          hint: {
            type: Type.STRING,
            description: "Helpful, encouraging hint shown after a wrong answer. Must not give away the answer or the skip value.",
          },
        },
        required: ["type", "skipValue", "hint"],
      },
    },
  },
  required: ["title", "description", "challenges"],
  };
}

// ---------------------------------------------------------------------------
// Deterministic helpers — all math + instruction text computed here, never
// by the LLM. Eliminates SP-17 (instruction-data desync) by construction.
// ---------------------------------------------------------------------------

function buildSequence(skipValue: number, startNumber: number): number[] {
  const seq: number[] = [];
  for (let n = startNumber; n <= 100; n += skipValue) {
    seq.push(n);
  }
  return seq;
}

function buildInstruction(type: string, skipValue: number): string {
  switch (type) {
    case 'highlight_sequence':
      return `Tap every number in the skip-counting-by-${skipValue}s pattern, all the way to 100.`;
    case 'complete_sequence':
      return `The first 3 numbers are highlighted. Tap all the remaining numbers in the pattern up to 100.`;
    case 'identify_pattern':
      return `Look at the highlighted cells. Which description best matches the visual pattern on the grid?`;
    case 'find_skip_value':
      return `Look at the highlighted numbers. What is the skip value (how much is added each step)?`;
    default:
      return `Look at the highlighted numbers.`;
  }
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
 * Gemini provides only the hint text.
 */
function buildChallenge(
  index: number,
  type: string,
  skipValue: number,
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
    instruction: buildInstruction(type, skipValue),
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

  // ── Resolve per-mode instance count (only meaningful when an eval mode is pinned) ──
  const singleMode = effectiveChallengeTypes && effectiveChallengeTypes.length === 1
    ? (effectiveChallengeTypes[0] as ChallengeType)
    : undefined;
  const count = resolveCount(singleMode);

  // ── Build prompt — Gemini only picks types/skips and writes hints + topic flavor ──
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
- Generate exactly ${count} challenges.
- Vary skipValue across challenges (choose from: ${gradeSkips.join(', ')}). Each skipValue from the pool should appear at least once before any repeats; if there are more challenges than skip values, you may reuse a skipValue but pair it with a different challenge type so the activity still feels varied.
${config?.skipValue ? `- At least one challenge must use skipValue=${config.skipValue}.` : ''}
${effectiveChallengeTypes ? `- All challenges must use type: ${effectiveChallengeTypes.join(' or ')}.` : ''}
- Hints should guide thinking without giving away the answer or the skip value. Keep them short (one sentence).
- Title and description may reference the topic for flavor; do NOT name specific numbers, rows, or quantities (the chart and instruction handle that).
`;

  logEvalModeResolution('HundredsChart', config?.targetEvalMode, evalConstraint);

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: buildHundredsChartSchema(count),
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = result.text ? JSON.parse(result.text) : null;

  if (!raw) {
    throw new Error('No valid hundreds chart data returned from Gemini API');
  }

  // ── Build challenges deterministically; Gemini supplies only type/skip/hint ──
  const validTypes = new Set(['highlight_sequence', 'complete_sequence', 'identify_pattern', 'find_skip_value']);

  const rawChallenges = Array.isArray(raw.challenges) ? raw.challenges : [];
  const challenges: HundredsChartChallenge[] = rawChallenges
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((c: any) => validTypes.has(c.type))
    .slice(0, Math.min(count, rawChallenges.length))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((c: any, i: number) => {
      let sv: number = c.skipValue;
      if (!sv || sv <= 0 || sv > 10) {
        sv = config?.skipValue ?? gradeSkips[i % gradeSkips.length];
      }
      return buildChallenge(
        i,
        c.type,
        sv,
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
