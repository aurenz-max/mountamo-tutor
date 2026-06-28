import { Type, Schema } from "@google/genai";
import { HundredsChartData, HundredsChartChallenge } from '../../primitives/visual-primitives/math/HundredsChart';
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
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
// Within-mode SUPPORT TIER (config.difficulty) — second axis of the two-field
// contract: targetEvalMode = WHICH skill (task identity), difficulty = HOW MUCH
// support within it. Hundreds-chart has NO showOptions, so its tiers are
// generator-side STRUCTURAL levers:
//   #1 structural — `givenCells` prefill slice count (complete_sequence /
//      find_skip_value) + distractor closeness (identify_pattern /
//      find_skip_value pools).
//   #2 instruction-as-scaffold — buildInstruction strategy-naming + hint tone.
// The invariant: a tier NEVER changes skipValue / grade-band number pool /
// magnitude / task identity. See memory [[structural-difficulty-not-numeric]]
// and [[feedback_llm-window-code-builds-structure]].
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

const TIER_GUARDRAIL =
  'Keep every number within this lesson/grade-band scope. This tier changes ' +
  'problem STRUCTURE (how many cells are pre-filled, how close the distractors ' +
  'are) and instruction/hint explicitness — NOT raw magnitude. The skipValue and ' +
  'number pool are fixed; never just "make the numbers bigger".';

/** Scaffolding tone (instruction strategy-naming + hint explicitness, #2). */
interface SupportScaffold {
  promptLines: string[];
}

/** easy → hard scaffolding tone, per pinned eval mode (prompt-tone only). */
function resolveSupportStructure(mode: ChallengeType, tier: SupportTier): SupportScaffold {
  switch (mode) {
    case 'highlight_sequence':
      // No structural prefill lever here (the whole sequence IS the task).
      // The instruction + hint are the only dials.
      return {
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: the instruction NAMES the counting strategy (count by the skip value; the ones digits repeat). Hint is explicit and walks the pattern.'
            : tier === 'medium'
              ? 'MEDIUM: bare task instruction; hint appears only after a miss and nudges the pattern without naming the rule.'
              : 'HARD: bare instruction; terse hint — ask what changes from one cell to the next, never name the count-by rule or a number.',
        ],
      };
    case 'complete_sequence':
      return {
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: more starting cells are pre-filled and the instruction names the strategy ("keep adding the same amount; the ones digits repeat"). Hint is explicit.'
            : tier === 'medium'
              ? 'MEDIUM: the current default prefill; hint nudges the pattern without naming the rule.'
              : 'HARD: the fewest cells are pre-filled (still ≥2); terse hint — ask what the gap between highlighted cells is, never name the skip value.',
        ],
      };
    case 'find_skip_value':
      return {
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: more cells are shown and the distractor options are FAR from the answer; hint is explicit ("subtract two highlighted numbers next to each other").'
            : tier === 'medium'
              ? 'MEDIUM: current cell count + distractor spread; hint nudges without naming the interval.'
              : 'HARD: the fewest cells are shown (still ≥3) and the distractors are ADJACENT (answer ±1), so the student must compute carefully; terse hint, never name the value.',
        ],
      };
    case 'identify_pattern':
      // RECOGNITION mode — the pattern shape IS the answer, so neither the
      // instruction NOR the hint may name it at any tier. The lever is purely
      // distractor closeness (handled in resolveProblemShape) + hint depth.
      return {
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: the distractor descriptions are far-off / obviously wrong; hint may use shape vocabulary ("look at the rows vs the columns") WITHOUT naming the correct shape.'
            : tier === 'medium'
              ? 'MEDIUM: the current distractor pool; hint nudges where to look without naming the shape.'
              : 'HARD: the distractors are near-misses (plausible shapes); terse hint — never name or strongly hint the correct shape.',
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Structural PROBLEM difficulty (the second thing config.difficulty drives).
// In-mode, structural, never magnitude. Each mode exposes ONE lever:
//   complete_sequence → prefill slice count (5 / 3 / 2-FLOOR)
//   find_skip_value   → prefill slice count (5 / 4 / 3-FLOOR) + distractor closeness
//   identify_pattern  → distractor closeness (far / current / near-miss)
//   highlight_sequence→ none structural (instruction/hint only)
// Numeric levers (prefill counts, distractor pool) are CODE-ENFORCED in
// buildChallenge; never trusted to the LLM.
// ---------------------------------------------------------------------------

type DistractorCloseness = 'far' | 'current' | 'near';

interface ProblemShape {
  /** complete_sequence / find_skip_value: exact pre-fill cell count to enforce. */
  prefillCount?: number;
  /** identify_pattern / find_skip_value: how close the distractor options sit. */
  distractorCloseness?: DistractorCloseness;
}

/**
 * Structural levers, code-enforced in buildChallenge. FLOORS (task collapses
 * otherwise): complete_sequence ≥2 given cells (fewer → it IS highlight_sequence);
 * find_skip_value ≥3 given cells (2 = under-determined interval). prefillCount is
 * additionally clamped against the sequence length in buildChallenge so a
 * prefill can never swallow the whole answer set.
 */
function resolveProblemShape(mode: ChallengeType, tier: SupportTier): ProblemShape {
  switch (mode) {
    case 'complete_sequence':
      return { prefillCount: tier === 'easy' ? 5 : tier === 'medium' ? 3 : 2 };
    case 'find_skip_value':
      return {
        prefillCount: tier === 'easy' ? 5 : tier === 'medium' ? 4 : 3,
        distractorCloseness: tier === 'hard' ? 'near' : 'far',
      };
    case 'identify_pattern':
      return {
        distractorCloseness: tier === 'easy' ? 'far' : tier === 'medium' ? 'current' : 'near',
      };
    case 'highlight_sequence':
    default:
      return {};
  }
}

/**
 * Combined tier prompt block: scaffolding tone (resolveSupportStructure) — the
 * structural levers (resolveProblemShape) are code-enforced, not LLM-shaped, so
 * they need no prompt lines beyond the scaffolding tone, but TIER_GUARDRAIL
 * already states the structure-not-magnitude contract.
 */
function buildTierPromptSection(mode: ChallengeType, tier: SupportTier): string {
  const lines = resolveSupportStructure(mode, tier).promptLines;
  return `\n## WITHIN-MODE SUPPORT TIER "${tier}" (scaffolding + structural — NOT bigger numbers)\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
}

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

/**
 * Instruction text — modality #2 (instruction-as-scaffold). At the EASY tier
 * the instruction NAMES the counting strategy (count by N, the ones digits
 * repeat); at medium/hard it is the bare task. identify_pattern is a RECOGNITION
 * mode — the shape IS the answer, so its instruction never gains a strategy
 * name at any tier. `givenCount` keeps the prose honest about how many cells are
 * pre-filled (which the tier changes). `tier == null` → byte-identical default.
 */
function buildInstruction(
  type: string,
  skipValue: number,
  givenCount: number,
  tier: SupportTier | null,
): string {
  const namesStrategy = tier === 'easy';
  switch (type) {
    case 'highlight_sequence':
      return namesStrategy
        ? `Count by ${skipValue}s and tap every number you land on, all the way to 100. Tip: the ones digits repeat in a pattern.`
        : `Tap every number in the skip-counting-by-${skipValue}s pattern, all the way to 100.`;
    case 'complete_sequence':
      return namesStrategy
        ? `The first ${givenCount} numbers are highlighted. Keep adding ${skipValue} each time — tap all the remaining numbers in the pattern up to 100.`
        : `The first ${givenCount} numbers are highlighted. Tap all the remaining numbers in the pattern up to 100.`;
    case 'identify_pattern':
      // Recognition: never name the shape, any tier.
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

/** Obviously-wrong "far" pattern distractors (used at the easy tier). The
 *  per-sv `distractors` above are the plausible "current"/"near" pool. */
const FAR_PATTERN_DISTRACTORS = [
  'They are scattered randomly',
  'They fill every row completely',
  'They fill the whole grid',
];

function getPatternOptions(
  sv: number,
  closeness: DistractorCloseness = 'current',
): { options: string[]; correctAnswer: string } {
  const entry = PATTERN_DESCRIPTIONS[sv] ?? PATTERN_DESCRIPTIONS[5];
  // 'far' (easy) → obvious non-shape distractors; 'current'/'near' → the
  // plausible per-sv pool (near-miss shapes). Same correct answer always.
  const distractors =
    closeness === 'far'
      ? FAR_PATTERN_DISTRACTORS.filter(d => d !== entry.correct).slice(0, 3)
      : entry.distractors;
  const allOptions = [entry.correct, ...distractors];
  const shuffled = allOptions.sort(() => Math.random() - 0.5);
  return { options: shuffled, correctAnswer: entry.correct };
}

/** Adjacent (answer ±1) numeric distractors for the HARD find_skip_value tier:
 *  the student can't eliminate by gross magnitude and must compute carefully.
 *  In-scope: drawn from sv-2..sv+2, clamped to the valid 2-10 interval. */
function nearSkipDistractors(sv: number): number[] {
  const candidates = [sv - 1, sv + 1, sv - 2, sv + 2, sv + 3]
    .filter(d => d >= 2 && d <= 10 && d !== sv);
  return Array.from(new Set(candidates)).slice(0, 3);
}

function getSkipValueOptions(
  sv: number,
  closeness: DistractorCloseness = 'current',
): { options: string[]; correctAnswer: string } {
  const distractors =
    closeness === 'near'
      ? nearSkipDistractors(sv)
      : (SKIP_VALUE_DISTRACTORS[sv] ?? [2, 5, 10]);
  const allNums = [sv, ...distractors.filter(d => d !== sv)].slice(0, 4);
  const shuffled = allNums.sort(() => Math.random() - 0.5);
  return { options: shuffled.map(String), correctAnswer: String(sv) };
}

/** Floors that keep each mode's identity intact when the tier changes prefill:
 *  complete_sequence ≥2 given cells (fewer collapses into highlight_sequence);
 *  find_skip_value ≥3 given cells (2 = under-determined interval). prefillCount
 *  is also clamped so it never swallows the whole answer set (leave ≥1 to find).
 */
const PREFILL_FLOOR: Partial<Record<ChallengeType, number>> = {
  complete_sequence: 2,
  find_skip_value: 3,
};

/** Resolve the prefill slice count for a mode under a tier, applying the mode's
 *  floor and clamping against the sequence length so ≥1 cell is always left to
 *  answer (find_skip_value uses all given cells as its data, so it isn't clamped
 *  for an answer set — only floored). */
function resolvePrefillCount(
  type: ChallengeType,
  seqLen: number,
  defaultCount: number,
  shape: ProblemShape | null,
): number {
  const requested = shape?.prefillCount ?? defaultCount;
  const floor = PREFILL_FLOOR[type] ?? 0;
  let n = Math.max(floor, requested);
  if (type === 'complete_sequence') {
    // Leave at least one cell to find; never prefill the entire sequence.
    n = Math.min(n, Math.max(floor, seqLen - 1));
  } else {
    n = Math.min(n, seqLen);
  }
  return n;
}

/**
 * Build the full challenge data deterministically from type + skipValue.
 * Gemini provides only the hint text. `tier` (when present) drives the
 * structural levers — prefill slice count + distractor closeness — which are
 * code-enforced here, never trusted to the LLM. `tier == null` reproduces the
 * pre-tier defaults byte-for-byte.
 */
function buildChallenge(
  index: number,
  type: string,
  skipValue: number,
  hint: string,
  tier: SupportTier | null = null,
): HundredsChartChallenge {
  const startNumber = skipValue; // tidy multiples
  const fullSeq = buildSequence(skipValue, startNumber);
  const shape = tier ? resolveProblemShape(type as ChallengeType, tier) : null;

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
      // Default 3 (current); tier may raise (easy=5) or lower to the floor (hard=2).
      const prefill = resolvePrefillCount('complete_sequence', fullSeq.length, 3, shape);
      givenCells = fullSeq.slice(0, prefill);
      const givenSet = new Set(givenCells);
      // correctCells = fullSeq minus givenCells → a bigger easy slice auto-removes
      // those from the answer set, so a prefill can never include the answer.
      correctCells = fullSeq.filter(n => !givenSet.has(n));
      break;
    }
    case 'identify_pattern': {
      givenCells = fullSeq;
      correctCells = fullSeq;
      const patternOpts = getPatternOptions(skipValue, shape?.distractorCloseness);
      options = patternOpts.options;
      correctAnswer = patternOpts.correctAnswer;
      break;
    }
    case 'find_skip_value': {
      // Default 4 (current); tier may raise (easy=5) or lower to the floor (hard=3).
      const prefill = resolvePrefillCount('find_skip_value', fullSeq.length, 4, shape);
      givenCells = fullSeq.slice(0, prefill);
      correctCells = givenCells;
      const skipOpts = getSkipValueOptions(skipValue, shape?.distractorCloseness);
      options = skipOpts.options;
      correctAnswer = skipOpts.correctAnswer;
      break;
    }
  }

  return {
    id: `c${index + 1}`,
    type: type as HundredsChartChallenge['type'],
    instruction: buildInstruction(type, skipValue, givenCells.length, tier),
    skipValue,
    startNumber,
    givenCells,
    correctCells,
    correctAnswer,
    options,
    hint,
    ...(tier ? { supportTier: tier } : {}),
  };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type HundredsChartConfig = {
  skipValue?: number;
  gradeBand?: '1' | '2' | '3' | '4';
  challengeTypes?: string[];
  targetEvalMode?: string;
  intent?: string;
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second axis of the two-field contract: targetEvalMode = which skill,
   * difficulty = how much scaffolding/structural support within it. NEVER
   * changes skipValue, the grade-band number pool, or magnitude.
   */
  difficulty?: string;
};

export const generateHundredsChart = async (
  ctx: GenerationContext,
): Promise<HundredsChartData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as HundredsChartConfig;
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

  // ── Resolve support tier (config.difficulty) — DRIVES application per challenge.
  // pinnedType is ONLY for the prompt-section tone (a blend has no single mode). ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType = singleMode;
  const tierSection = pinnedType && supportTier
    ? buildTierPromptSection(pinnedType, supportTier)
    : '';

  // ── Build prompt — Gemini only picks types/skips and writes hints + topic flavor ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create a hundreds-chart activity for "${topic}" for ${gradeLevel} students.

A hundreds chart is a 10×10 grid (numbers 1-100). Students explore skip-counting patterns.

${challengeTypeSection}
${tierSection}
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
        supportTier, // structural levers code-enforced per challenge from its OWN mode
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
      supportTier,
    ));
    console.log('[HundredsChart] No valid challenges from Gemini — using fallback');
  }

  if (supportTier) {
    const tierBreakdown = challenges
      .map(c => `${c.type}(given=${c.givenCells.length})`)
      .join(', ');
    console.log(
      `[HundredsChart] Support tier "${supportTier}" applied per-challenge ` +
      `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'}) → [${tierBreakdown}]`,
    );
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
