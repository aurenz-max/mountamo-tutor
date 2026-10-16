/**
 * Tape Diagram Generator — multi-instance word-problem generator.
 *
 * Each session walks the student through 3-6 distinct tape-diagram challenges
 * of the SAME eval mode, surfaced sequentially. Per-challenge data is content-
 * bearing (word problem text + segment labels), so we use the orchestrator-
 * same-mode pattern (per PRD §6a #1 / §6a #7): the orchestrator fans out N
 * parallel calls to the existing per-mode sub-generator. Variance comes from
 * independent generations of the same sub-generator — structured-output
 * convergence is per-call, not across independent calls.
 */

import { Type, Schema, ThinkingLevel } from "@google/genai";
import {
  TapeDiagramData,
  TapeDiagramChallenge,
  BarSegment,
} from "../../primitives/visual-primitives/math/TapeDiagram";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import { buildScopePromptSection } from "../scopeContext";
import { buildRemediationPrompt } from "../generation/remediationPrompt";
import { difficultyBand, getItemSpace, resolveItemSpace, tierPick } from "../itemSpace";
import { compareSpec, type CompareItem } from "../itemSpace/compareStories";
import {
  comparisonBars, comparisonChallengeFromItem, comparisonStoryFits, plainComparison, type WrittenComparison,
  multiStepBars, multiStepChallengeFromItem, multiStepHint, multiStepStoryFits, plainMultiStep,
  type ChainStep, type WrittenMultiStep,
} from "./tapeDiagramItemSpace";
import type { AddSub20Item } from "../itemSpace/addSub20";
import { questionFitsSpec } from "../knowledge-check/itemSpaceProblems";
import { createNumberPool } from "./numberPoolService";
import { resolveScopeRange } from "../scopeRangeResolver";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'represent': {
    promptDoc:
      `"represent": Focus on building/understanding the tape diagram. `
      + `Given a word problem, identify the parts and represent them as bar segments. `
      + `Easiest mode — student labels and organizes diagram from problem description.`,
    schemaDescription: "'represent' (build tape diagram from word problem)",
  },
  'solve_part_whole': {
    promptDoc:
      `"solve_part_whole": Standard part-whole problems. `
      + `Given parts, find total. Or given total and one part, find the other part. `
      + `Classic tape diagram usage for addition/subtraction word problems.`,
    schemaDescription: "'solve_part_whole' (standard part-whole solving)",
  },
  'solve_comparison': {
    promptDoc:
      `"solve_comparison": Comparison problems where bars represent different quantities being compared. `
      + `Uses language like "more than", "less than", "how many more". `
      + `Harder — requires understanding the difference between quantities.`,
    schemaDescription: "'solve_comparison' (comparison word problems)",
  },
  'multi_step': {
    promptDoc:
      `"multi_step": Multi-step problems requiring multiple operations to find unknowns. `
      + `Student must find intermediate values before solving for the final unknown. `
      + `Hardest mode — requires synthesis across all segments.`,
    schemaDescription: "'multi_step' (multi-step word problems)",
  },
};

// ---------------------------------------------------------------------------
// Grade-appropriate number ranges
// ---------------------------------------------------------------------------

function getNumberGuidance(gradeLevel: string): string {
  if (/[kK]|[0-2]/.test(gradeLevel)) return 'Use numbers 1–20 (small, manageable).';
  if (/[3-5]/.test(gradeLevel)) return 'Use numbers 10–100 (medium).';
  return 'Use numbers 20–500 (larger, realistic).';
}

/** The grade band's number range (the ceiling a lesson's scope narrows), from the canonical grade. */
function gradeBandRange(grade: string | undefined): { min: number; max: number } {
  if (!grade || grade === 'K' || grade === '1') return { min: 1, max: 20 };
  if (grade === '2') return { min: 1, max: 100 }; // 2.OA.A.1: within 100
  if (['3', '4', '5'].includes(grade)) return { min: 10, max: 100 };
  return { min: 20, max: 500 };
}

const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

/** `n` positive whole parts that add to `total`, in random order (8.1b: code owns part-whole values). */
export function splitTotal(total: number, n: number): number[] {
  // Every part gets a floor first (random cuts alone gave 1 | 1 | 12 | 4), then the rest is cut at random.
  const floor = Math.max(1, Math.floor(total / (2 * n)));
  const rest = total - floor * n;
  const cuts = Array.from({ length: n - 1 }, () => randInt(0, rest)).sort((a, b) => a - b);
  const points = [0, ...cuts, rest];
  return points.slice(1).map((v, i) => floor + v - points[i]);
}

/**
 * A start and `steps` changes that stay inside `range` at every step, mixing adding and taking away
 * (8.1b: the own path's chains converged on 12 + 5 - 4 at every tier). Change sizes are at least 2.
 */
export function rollChain(range: { min: number; max: number }, steps: number): { start: number; chain: { op: '+' | '-'; value: number }[] } {
  const lo = Math.max(1, range.min);
  for (let guard = 0; guard < 500; guard++) {
    const ops: ('+' | '-')[] = Array.from({ length: steps }, () => (Math.random() < 0.5 ? '+' : '-'));
    if (!ops.includes('+')) ops[randInt(0, steps - 1)] = '+';
    if (!ops.includes('-')) ops[ops.indexOf('+') === 0 ? steps - 1 : 0] = '-';
    let current = randInt(lo, range.max);
    const start = current;
    const chain: { op: '+' | '-'; value: number }[] = [];
    let ok = true;
    for (const op of ops) {
      const room = op === '+' ? range.max - current : current - lo;
      if (room < 2) { ok = false; break; }
      const value = randInt(2, room);
      current = op === '+' ? current + value : current - value;
      chain.push({ op, value });
    }
    if (ok) return { start, chain };
  }
  return { start: lo + 4, chain: Array.from({ length: steps }, (_, i) => ({ op: i % 2 ? '-' : '+', value: 2 })) };
}

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — second axis of the two-field
// contract: targetEvalMode = WHICH skill, difficulty = HOW MUCH on-screen
// scaffolding within it. A tier withdraws on-screen help (known-value readouts,
// the labeled total bracket, phase ramp, step locking) and dials hint depth, AND
// makes the PROBLEM structurally harder (part count, unknown placement, steps) —
// it NEVER changes the magnitude/scope of the numbers (those are owned by the
// eval mode + grade band). See memory [[structural-difficulty-not-numeric]] /
// [[feedback_llm-window-code-builds-structure]].
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; current defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

// --- Scaffolding axis -------------------------------------------------------

/** How the total bracket above a bar is labeled at this tier.
 *  'total'     → "Total = N" (the number is shown — max scaffold).
 *  'unlabeled' → bracket drawn but generic ("Total = ?") — student supplies it.
 *  'none'      → no bracket at all. */
type BracketLabelMode = 'total' | 'unlabeled' | 'none';

/** Phase ramp for solve_part_whole.
 *  'full'        → Explore → Practice → Apply (max scaffold).
 *  'skip-explore'→ start at Practice.
 *  'apply-only'  → collapse straight to Apply (all unknowns at once). */
type PhaseScaffold = 'full' | 'skip-explore' | 'apply-only';

interface SupportScaffold {
  /** Print the numeric value on KNOWN segments. The UNKNOWN/answer segment is
   *  hidden by the component at every tier, so this only ever gates known parts —
   *  it can never reveal the answer. */
  showKnownValues: boolean;
  /** How the total bracket is labeled (withdrawing the NUMBER is the key hard move). */
  bracketLabelMode: BracketLabelMode;
  /** part-whole only: how much of the Explore→Practice→Apply ramp is shown. */
  phaseScaffold: PhaseScaffold;
  /** multi_step only: lock later steps until earlier ones are solved (vs. unlock all). */
  lockSteps: boolean;
  /** comparison hard: hide the non-answer bar's value so the student re-reads it. */
  hideNonAnswerValue: boolean;
  /** Prompt lines describing the tier to the sub-generator (hint-tone only). */
  promptLines: string[];
}

const TIER_GUARDRAIL =
  'Keep every number within this lesson/grade-band scope. This tier changes ' +
  'problem STRUCTURE (number of parts, unknown placement, number of steps) and ' +
  'on-screen help — NOT raw magnitude. Never just "make the numbers bigger".';

/** easy → hard support gradient, per pinned eval mode. */
function resolveSupportStructure(
  mode: TapeDiagramChallengeType,
  tier: SupportTier,
): SupportScaffold {
  switch (mode) {
    case 'represent':
      return {
        showKnownValues: false,             // represent: the student FILLS every segment
        bracketLabelMode:
          tier === 'easy' ? 'total' : tier === 'medium' ? 'unlabeled' : 'none',
        phaseScaffold: 'full',
        lockSteps: false,
        hideNonAnswerValue: false,
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: a total bracket labeled "Total = N" sits above the diagram; the hint names the mapping "each number in the story = one segment".'
            : tier === 'medium'
              ? 'MEDIUM: the bracket is unlabeled; the hint is generic — "re-read the problem and place each number".'
              : 'HARD: no total bracket; the hint only asks "which numbers did the problem give you?" — the student maps numbers to segments unaided.',
        ],
      };
    case 'solve_part_whole':
      // Bracket label: at easy/medium the unknown is a PART and the total is the
      // GIVEN that bridges the parts, so it stays labeled. At hard the structural
      // lever makes the unknown a KNOWN part found by total-minus-part — the total
      // is STILL the given (not the answer), so it must remain labeled or the
      // problem is unsolvable from the diagram. We never label the total when the
      // unknown IS the total (this generator's unknowns are always parts), so the
      // labeled total never reveals the answer here. The hard withdrawal is the
      // phase collapse + strategy-sentence removal, not the number.
      return {
        showKnownValues: true,              // known parts are the scaffold for finding the unknown
        bracketLabelMode: 'total',
        phaseScaffold:
          tier === 'easy' ? 'full' : tier === 'medium' ? 'skip-explore' : 'apply-only',
        lockSteps: false,
        hideNonAnswerValue: false,
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: full Explore→Practice→Apply ramp; known values are shown; the total bracket reads "Total = N"; the prompt NAMES the strategy ("add the parts to find the whole; subtract a part from the whole to find the other").'
            : tier === 'medium'
              ? 'MEDIUM: skip Explore (start at Practice); known values shown; bracket reads "Total = N"; the prompt names only the OPERATION ("add" / "subtract"), not the full strategy.'
              : 'HARD: collapse to Apply only — all unknowns at once; NO strategy sentence. The total is given (needed for total-minus-part) but the student decides the operation alone.',
        ],
      };
    case 'solve_comparison':
      return {
        showKnownValues: tier !== 'hard',   // hard hides the non-answer value (re-read)
        bracketLabelMode: 'none',           // comparison bars use per-bar labels, not a total bracket
        phaseScaffold: 'full',
        lockSteps: false,
        hideNonAnswerValue: tier === 'hard',
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: both known values are shown; the hint names the operation AND the two numbers ("subtract 12 from 20").'
            : tier === 'medium'
              ? 'MEDIUM: known values shown; the hint names only the operation ("subtract"), not the numbers.'
              : 'HARD: the non-answer bar hides its number — the student re-reads it from the problem; the hint only asks what "how many more" is really asking for.',
        ],
      };
    case 'multi_step':
    default:
      // Each step is its own part-whole bar with the whole drawn under the parts, so there is no
      // total bracket to label or withdraw (a bracket over the chain summed intermediates and answer).
      return {
        showKnownValues: true,
        bracketLabelMode: 'none',
        phaseScaffold: 'full',
        lockSteps: tier !== 'hard',         // hard unlocks all unknowns (any order)
        hideNonAnswerValue: false,
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: steps are locked stepwise; each step hint names the operation and both numbers ("add 8 and 5").'
            : tier === 'medium'
              ? 'MEDIUM: steps stay locked, but the hints name only the OPERATION ("add", "subtract"), no values.'
              : 'HARD: all steps are unlocked (solve in any order); hints are question-only ("what do you need before the final answer?").',
        ],
      };
  }
}

// --- Structural problem-difficulty axis -------------------------------------
//
// One in-mode structural lever per mode, code-enforced where possible. NEVER a
// magnitude change and NEVER a jump to another eval mode (the mode is the task
// identity; see [[structural-difficulty-not-numeric]]):
//   represent        → segment/part count 2 → 3 → 4
//   solve_part_whole → unknown placement: 1 unknown → 2 unknowns → unknown is a
//                      KNOWN part (total-minus-part), not the total
//   solve_comparison → which value is unknown: difference → given-difference
//                      (find smaller) → larger-from-difference (forced by tier)
//   multi_step       → solveOrder length 2 → 3 steps (chain extended); op-type
//                      harder is prompt-shaped + validated

/** part-whole unknown placement (which segments carry isUnknown). */
type UnknownPlacement = 'one' | 'two' | 'known-part';

interface ProblemShape {
  promptLines: string[];
  /** represent: exact number of segments (2–4). */
  partCount?: number;
  /** solve_part_whole: which segments are unknown. */
  unknownPlacement?: UnknownPlacement;
  /** solve_comparison: forced unknownPart enum (overrides the LLM's pick). */
  forcedUnknownPart?: 'difference' | 'quantity1' | 'quantity2';
  /** multi_step: number of solve steps (2 or 3). */
  stepCount?: number;
}

function resolveProblemShape(
  mode: TapeDiagramChallengeType,
  tier: SupportTier,
): ProblemShape {
  switch (mode) {
    case 'represent':
      return {
        partCount: tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4,
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: the story has exactly TWO quantities to place — a simple two-segment map.'
            : tier === 'medium'
              ? 'PROBLEM: the story has THREE quantities to place.'
              : 'PROBLEM: the story has FOUR quantities to place — the student must track more numbers without dropping one.',
        ],
      };
    case 'solve_part_whole':
      return {
        unknownPlacement: tier === 'easy' ? 'one' : tier === 'medium' ? 'two' : 'known-part',
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: exactly ONE part is unknown (find one missing part given the others and the whole).'
            : tier === 'medium'
              ? 'PROBLEM: TWO parts are unknown — the student must reason about both.'
              : 'PROBLEM: the unknown is a KNOWN part found by total-minus-part (subtract a part from the whole), not the whole itself — a structurally different relationship.',
        ],
      };
    case 'solve_comparison':
      return {
        forcedUnknownPart: tier === 'easy' ? 'difference' : tier === 'medium' ? 'quantity2' : 'quantity1',
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: the unknown is the DIFFERENCE ("how many more?") — both quantities are given.'
            : tier === 'medium'
              ? 'PROBLEM: the difference is GIVEN and the SMALLER quantity is unknown (subtract the difference from the larger).'
              : 'PROBLEM: the difference is given and the LARGER quantity is unknown (add the difference to the smaller) — the harder direction.',
        ],
      };
    case 'multi_step':
    default:
      return {
        stepCount: tier === 'hard' ? 3 : 2,
        promptLines: [
          tier === 'hard'
            ? 'PROBLEM: a THREE-step chain — two intermediate results must be found before the final answer (e.g. add, then add again, then subtract). Use richer operations.'
            : 'PROBLEM: a TWO-step chain — one intermediate result, then the final answer.',
        ],
      };
  }
}

/**
 * Combined tier prompt block: scaffolding tone (resolveSupportStructure) PLUS
 * structural problem difficulty (resolveProblemShape). One section so the LLM
 * sees both axes of config.difficulty together.
 */
function buildTierPromptSection(mode: TapeDiagramChallengeType, tier: SupportTier): string {
  const lines = [
    ...resolveSupportStructure(mode, tier).promptLines,
    ...resolveProblemShape(mode, tier).promptLines,
  ];
  return `\n\n## SUPPORT TIER "${tier}" (scaffolding + structural problem difficulty — NOT bigger numbers)\n${lines.map((l) => `- ${l}`).join('\n')}`;
}

// ---------------------------------------------------------------------------
// Sub-generator return shape
// ---------------------------------------------------------------------------

interface SubGenResult {
  title: string;
  description: string;
  challenge: TapeDiagramChallenge;
}

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------
//
// `solve_part_whole` and `multi_step` are T4 (3+ within-challenge sub-phases:
// explore → practice → apply per challenge). At 4 challenges, sessions ran
// ~6 min past the T4 7-min ceiling — cut to 3 per the B3 sweep.
//
// `represent` and `solve_comparison` are T3 (single-submit, content-bearing
// word problems) — held at 4.

type TapeDiagramChallengeType =
  | 'represent'
  | 'solve_part_whole'
  | 'solve_comparison'
  | 'multi_step';

type TapeDiagramRemediationMove =
  | 'force_gap_segment'
  | 'require_gap_identification'
  | 'diagnostic_distractor'
  | 'reversed_ask'
  | 'explicit_intermediate';

function buildTapeRemediationSection(
  mode: TapeDiagramChallengeType,
  remediationFocus?: string,
): string {
  if (!remediationFocus?.trim() || mode === 'solve_part_whole') return '';
  const moves: Record<Exclude<TapeDiagramChallengeType, 'solve_part_whole'>, string> = {
    represent: 'force_gap_segment',
    solve_comparison: 'require_gap_identification, diagnostic_distractor, or reversed_ask',
    multi_step: 'explicit_intermediate',
  };
  return buildRemediationPrompt(remediationFocus)
    + `\n- Set remediationMove to exactly one supported move for this mode: ${moves[mode]}.`;
}

const DEFAULT_INSTANCE_COUNT = 4; // T3 fallback for any future mode not listed
const MAX_INSTANCE_COUNT = 5;     // T3 hard max; T4 modes are clamped via COUNT_BY_MODE

const COUNT_BY_MODE: Record<TapeDiagramChallengeType, number> = {
  represent: 4,         // T3
  solve_comparison: 4,  // T3
  solve_part_whole: 3,  // T4 cut (was 4)
  multi_step: 3,        // T4 cut (was 4)
};

// ===========================================================================
// Schema: Represent mode
// ===========================================================================

/** Build a represent schema for N parts (default 3 — the no-tier behavior). */
function buildRepresentSchema(partCount: number): Schema {
  const props: Record<string, Schema> = {
    title: { type: Type.STRING, description: "Title for the problem" },
    wordProblem: {
      type: Type.STRING,
      description: "A clear word problem that contains all the numerical values the student must extract and place on the diagram. Must mention each part explicitly."
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of the task"
    },
    remediationMove: {
      type: Type.STRING,
      enum: ['force_gap_segment'],
      description: 'Private structural remediation move; omit when no remediation focus is provided.',
    },
  };
  const required = ["title", "wordProblem", "description"];
  for (let i = 1; i <= partCount; i++) {
    props[`part${i}Value`] = { type: Type.NUMBER, description: `Value of part ${i} mentioned in the word problem` };
    props[`part${i}Label`] = { type: Type.STRING, description: `Label for part ${i} (e.g. 'red apples')` };
    required.push(`part${i}Value`, `part${i}Label`);
  }
  return { type: Type.OBJECT, properties: props, required };
}

// ===========================================================================
// Schema: Part-Whole mode
// ===========================================================================

const partWholeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the problem" },
    description: { type: Type.STRING, description: "Educational description" },
    knownPart1Label: { type: Type.STRING, description: "Label for first known part (no numbers)" },
    knownPart2Label: { type: Type.STRING, description: "Label for second known part (no numbers)" },
    unknown1Label: { type: Type.STRING, description: "Label for first unknown part (no numbers)" },
    unknown2Label: { type: Type.STRING, description: "Label for second unknown part (no numbers)" },
  },
  required: [
    "title", "description",
    "knownPart1Label", "knownPart2Label", "unknown1Label", "unknown2Label",
  ],
};

// ===========================================================================
// Schema: Comparison mode
// ===========================================================================

const comparisonSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the comparison problem" },
    description: { type: Type.STRING, description: "Educational description" },
    wordProblem: {
      type: Type.STRING,
      description: "A comparison word problem using 'more than', 'fewer than', 'how many more', etc."
    },
    quantity1Label: { type: Type.STRING, description: "Label for the larger quantity (e.g. 'Sam\\'s stickers')" },
    quantity1Value: { type: Type.NUMBER, description: "Value of the larger quantity" },
    quantity2Label: { type: Type.STRING, description: "Label for the smaller quantity (e.g. 'Maya\\'s stickers')" },
    quantity2Value: { type: Type.NUMBER, description: "Value of the smaller quantity" },
    comparisonWord: {
      type: Type.STRING,
      description: "The comparison word: 'more' or 'fewer'"
    },
    unknownPart: {
      type: Type.STRING,
      description: "Which value the student must find: 'difference', 'quantity1', or 'quantity2'",
      enum: ["difference", "quantity1", "quantity2"],
    },
    remediationMove: {
      type: Type.STRING,
      enum: ['require_gap_identification', 'diagnostic_distractor', 'reversed_ask'],
      description: 'Private structural remediation move; omit when no remediation focus is provided.',
    },
  },
  required: [
    "title", "description", "wordProblem",
    "quantity1Label", "quantity1Value",
    "quantity2Label", "quantity2Value",
    "comparisonWord", "unknownPart",
  ],
};

// ===========================================================================
// Sub-generators per mode (each emits a single SubGenResult)
// ===========================================================================

async function generateRepresentMode(
  topic: string,
  gradeLevel: string,
  tier: SupportTier | null = null,
  scopeSection = '',
  remediationFocus?: string,
  range: { min: number; max: number } = gradeBandRange(undefined),
): Promise<SubGenResult> {
  const shape = tier ? resolveProblemShape('represent', tier) : null;
  const tierSection = scopeSection + (tier ? buildTierPromptSection('represent', tier) : '')
    + buildTapeRemediationSection('represent', remediationFocus);
  // Structural lever: part count 2→3→4 (default 3 when no tier). Clamp to 2-4.
  const partCount = Math.max(2, Math.min(4, shape?.partCount ?? 3));
  // The model picked the same parts every run (4/6/5, 8.1b). Each call rolls its own pool; parts stay
  // small enough that their total stays inside the lesson's range.
  const partMax = Math.max(Math.min(range.max, 2 * partCount), Math.floor(range.max / partCount));
  const pool = createNumberPool({ min: Math.min(range.min, partMax - 1), max: partMax }, { count: partCount * 2, integers: true });
  const poolSection = pool ? '\n\n' + pool.toPromptSection({
    label: 'PART VALUE POOL',
    usePrimaryInstruction: false,
    extraInstructions: `- Use ${partCount} numbers from this pool as the part values, written in digits in the story.`,
  }) : '';
  const prompt = `
Create a word problem for teaching "${topic}" to ${gradeLevel} students using a tape diagram.

The student's task is to READ the word problem and FILL IN the values on an empty tape diagram.
The diagram has ${partCount} labeled segments — the student must identify each value from the word problem text.

${getNumberGuidance(gradeLevel)}

RULES:
- The word problem must clearly state all ${partCount} numerical values in natural language
- Use a single coherent scenario (fruits, books, toys, animals, etc.)
- Labels should be concrete and descriptive (not "Part 1")
- Values must be positive integers
- Do NOT put the answer in the title or description${tierSection}${poolSection}
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: buildRepresentSchema(partCount),
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) throw new Error('No valid represent data returned from Gemini API');

  const segments: BarSegment[] = [];
  let total = 0;
  for (let i = 1; i <= partCount; i++) {
    const value = Number(data[`part${i}Value`]);
    segments.push({ value, label: data[`part${i}Label`], isUnknown: true });
    if (Number.isFinite(value)) total += value;
  }
  // The values are read from the story, so the story must state each one.
  const story = String(data.wordProblem ?? '');
  const stated = segments.every((seg) => new RegExp(`(^|\\D)${seg.value}(\\D|$)`).test(story));
  if (!stated) console.log(`[TapeDiagram] represent story does not state every part (${segments.map((x) => x.value).join(', ')}): ${story.slice(0, 160)}`);

  return {
    title: data.title,
    description: data.description,
    challenge: {
      id: 'td-pending',
      challengeType: 'represent',
      wordProblem: data.wordProblem,
      bars: [{
        segments,
        totalLabel: `Total = ${total}`,
      }],
      comparisonMode: false,
      showBrackets: false,
      remediationMove: remediationFocus ? 'force_gap_segment' : undefined,
    },
  };
}

async function generatePartWholeMode(
  topic: string,
  gradeLevel: string,
  tier: SupportTier | null = null,
  scopeSection = '',
  _remediationFocus?: string,
  range: { min: number; max: number } = gradeBandRange(undefined),
): Promise<SubGenResult> {
  const shape = tier ? resolveProblemShape('solve_part_whole', tier) : null;
  const tierSection = scopeSection + (tier ? buildTierPromptSection('solve_part_whole', tier) : '');
  const prompt = `
Create a cohesive part-whole problem for teaching "${topic}" to ${gradeLevel} students.

You need to provide labels (no numbers; code sets the values) for 4 different parts used across 3 learning phases:
- 2 known parts (always shown)
- 2 unknown parts (revealed progressively)

STRUCTURE:
- knownPart1, knownPart2: concrete values with meaningful labels
- unknown1: revealed in Phase 2
- unknown2: revealed in Phase 3

HOW PHASES WORK:
Phase 1 (Explore): Show knownPart1 + knownPart2, student finds total
Phase 2 (Practice): Show knownPart1 + unknown1 (as ?), show total, student solves for unknown1
Phase 3 (Apply): Show all 4 segments, student solves for both unknowns

RULES:
- Use a single coherent scenario (marbles, cookies, books, points, etc.)
- All 4 labels should fit the same theme
- Use concrete, descriptive labels (not "Part 1", "Segment A")${tierSection}
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: partWholeSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) throw new Error('No valid part-whole data returned from Gemini API');

  // Code owns the values (8.1b: the model gave 12/8/15 every run, and four parts of 1-20 summed past a
  // "within 20" lesson). No text states them, so the model writes only the labels; the whole stays
  // inside the lesson's range.
  const grandTotal = randInt(Math.max(8, Math.ceil(range.max * 0.4), range.min), Math.max(8, range.max));
  const [v1, v2, v3, v4] = splitTotal(grandTotal, 4);

  const segments: BarSegment[] = [
    { value: v1, label: data.knownPart1Label },
    { value: v2, label: data.knownPart2Label },
    { value: v3, label: data.unknown1Label, isUnknown: true },
    { value: v4, label: data.unknown2Label, isUnknown: true },
  ];

  // Structural lever: unknown placement (code-enforced via isUnknown flags).
  //   'one'        → only ONE unknown (segment[2]); segment[3] becomes a known part.
  //   'two'        → both segment[2] and segment[3] unknown (the default shape).
  //   'known-part' → the unknown is a KNOWN part recovered by total-minus-part:
  //                  reveal both authored "unknown" parts as known, and make a
  //                  KNOWN part (segment[1]) the thing to find from the whole.
  if (shape?.unknownPlacement === 'one') {
    segments[2].isUnknown = true;
    segments[3].isUnknown = false;
  } else if (shape?.unknownPlacement === 'known-part') {
    segments[0].isUnknown = false;
    segments[1].isUnknown = true;   // find a part by whole-minus-other-parts
    segments[2].isUnknown = false;
    segments[3].isUnknown = false;
  }
  // 'two' (and no-tier) keep the authored two-unknown shape.

  return {
    title: data.title,
    description: data.description,
    challenge: {
      id: 'td-pending',
      challengeType: 'solve_part_whole',
      bars: [{
        segments,
        totalLabel: `Total = ${grandTotal}`,
      }],
      comparisonMode: false,
      showBrackets: true,
    },
  };
}

async function generateComparisonMode(
  topic: string,
  gradeLevel: string,
  tier: SupportTier | null = null,
  scopeSection = '',
  remediationFocus?: string,
): Promise<SubGenResult> {
  const shape = tier ? resolveProblemShape('solve_comparison', tier) : null;
  const tierSection = scopeSection + (tier ? buildTierPromptSection('solve_comparison', tier) : '')
    + buildTapeRemediationSection('solve_comparison', remediationFocus);
  const prompt = `
Create a comparison word problem for teaching "${topic}" to ${gradeLevel} students.

This is a COMPARISON problem with TWO bars on a tape diagram. The student compares two quantities
and finds the difference or a missing quantity.

${getNumberGuidance(gradeLevel)}

RULES:
- quantity1 must be LARGER than quantity2
- The word problem must use comparison language ("more than", "fewer than", "how many more")
- Values must be positive integers
- Use a single coherent scenario with two people/groups being compared
- unknownPart: "difference" means student finds how many more/fewer,
  "quantity2" means student finds the smaller quantity given the difference,
  "quantity1" means student finds the larger quantity given the difference${tierSection}
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: comparisonSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) throw new Error('No valid comparison data returned from Gemini API');

  const q1 = Math.max(data.quantity1Value, data.quantity2Value);
  const q2 = Math.min(data.quantity1Value, data.quantity2Value);
  const diff = q1 - q2;

  // Structural lever: FORCE which value is unknown by tier (don't trust the LLM's
  // pick). difference (easy) → quantity2/find-smaller (med) → quantity1/find-larger
  // (hard). Code-enforced; the diagram assembly below branches on this value.
  let remediationMove = remediationFocus
    && ['require_gap_identification', 'diagnostic_distractor', 'reversed_ask'].includes(data.remediationMove)
      ? data.remediationMove as TapeDiagramRemediationMove
      : remediationFocus
        ? 'require_gap_identification'
        : undefined;
  if (remediationMove === 'diagnostic_distractor' && q2 === diff) {
    remediationMove = 'require_gap_identification';
  }
  const remediationUnknown = remediationMove === 'require_gap_identification'
    || remediationMove === 'diagnostic_distractor'
      ? 'difference'
      : remediationMove === 'reversed_ask'
        ? (data.unknownPart === 'quantity1' ? 'quantity1' : 'quantity2')
        : undefined;
  const unknownPart: string = remediationUnknown ?? shape?.forcedUnknownPart ?? data.unknownPart;

  return {
    title: data.title,
    description: data.description,
    challenge: {
      id: 'td-pending',
      challengeType: 'solve_comparison',
      wordProblem: data.wordProblem,
      bars: comparisonBars(
        { q1, q2, unknownPart: unknownPart as 'difference' | 'quantity1' | 'quantity2', comparisonWord: data.comparisonWord || 'more' },
        { larger: data.quantity1Label, smaller: data.quantity2Label },
      ),
      comparisonMode: true,
      showBrackets: true,
      remediationMove,
      comparisonData: {
        quantity1: q1,
        quantity2: q2,
        difference: diff,
        comparisonWord: data.comparisonWord || 'more',
        unknownPart,
      },
    },
  };
}

async function generateMultiStepMode(
  topic: string,
  gradeLevel: string,
  tier: SupportTier | null = null,
  scopeSection = '',
  remediationFocus?: string,
  range: { min: number; max: number } = gradeBandRange(undefined),
): Promise<SubGenResult> {
  const shape = tier ? resolveProblemShape('multi_step', tier) : null;
  const tierSection = scopeSection + (tier ? buildTierPromptSection('multi_step', tier) : '')
    + buildTapeRemediationSection('multi_step', remediationFocus);
  // Structural lever: step count (2 default, 3 at hard).
  const stepCount = shape?.stepCount === 3 ? 3 : 2;
  // Code rolls the chain (8.1b: the model's chains converged on 12 + 5 - 4 at every tier); the model
  // writes the story around it and names what is counted.
  const { start, chain: rolled } = rollChain(range, stepCount);
  const spec = `${start} ${rolled.map((c) => `${c.op} ${c.value}`).join(' ')}`;
  const prompt = `
Create a multi-step word problem for teaching "${topic}" to ${gradeLevel} students.

Something is counted. The story says how many there are at the start, then tells ${stepCount} changes in this
order, and asks how many there are at the end:
- Start: ${start}
${rolled.map((c, i) => `- Change ${i + 1}: ${c.op === '+' ? `${c.value} are added` : `${c.value} are taken away`}`).join('\n')}

RULES:
- Use exactly these numbers, written in digits, in this order (${spec}); no other number
- Never state a running total or the answer
- Use a single coherent scenario${tierSection}
`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Title (no numbers)' },
      description: { type: Type.STRING, description: 'Educational description (no numbers)' },
      wordProblem: { type: Type.STRING, description: 'The story, ending with the question.' },
      thing: { type: Type.STRING, description: "What is counted, plural (e.g. 'marbles')" },
      ...Object.fromEntries(rolled.map((_, i) => [`step${i + 1}Label`, { type: Type.STRING, description: `1-3 words for change ${i + 1}, no numbers (e.g. 'found', 'eaten')` }])),
    },
    required: ['title', 'description', 'wordProblem', 'thing', ...rolled.map((_, i) => `step${i + 1}Label`)],
  };
  let data: Record<string, unknown> = {};
  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, responseMimeType: "application/json", responseSchema: schema },
    });
    data = result.text ? JSON.parse(result.text) : {};
  } catch (err) {
    console.log(`[TapeDiagram] multi_step wording failed; plain story shipped (${String(err).slice(0, 120)})`);
  }
  const thing = String(data.thing || 'things');
  const chain: ChainStep[] = rolled.map((c, i) => ({
    ...c,
    label: String(data[`step${i + 1}Label`] || (c.op === '-' ? 'taken away' : 'added')),
    resultLabel: i === stepCount - 1 ? `${thing} at the end` : `${thing} after step ${i + 1}`,
  }));
  const built = multiStepBars(start, `${thing} at first`, chain);
  if (!built) throw new Error(`rolled chain ${spec} left its range`);
  const answer = built.results[built.results.length - 1];
  const fits = questionFitsSpec(String(data.wordProblem ?? ''), [start, ...chain.map((c) => c.value)].map(String), String(answer));
  if (!fits) console.log(`[TapeDiagram] multi_step story off spec (${spec}), plain story shipped: ${String(data.wordProblem ?? '').slice(0, 200)}`);
  const story = fits ? String(data.wordProblem) : plainChainStory(thing, start, chain);
  const hints = chain.map((c, i) => multiStepHint(c.op, i === 0 ? start : 'previous', c.value, tier));
  return {
    title: String(data.title || 'Multi-Step Problems'),
    description: String(data.description || 'Solve one step at a time.'),
    challenge: {
      id: 'td-pending',
      challengeType: 'multi_step',
      wordProblem: story,
      remediationMove: remediationFocus ? 'explicit_intermediate' : undefined,
      bars: built.bars,
      comparisonMode: false,
      showBrackets: false,
      multiStepData: { step1Hint: hints[0], step2Hint: hints[1], step3Hint: hints[2], solveOrder: [], steps: built.steps },
    },
  };
}

/** A correct story built in code, used when the written one drops a number or states a result. */
function plainChainStory(thing: string, start: number, chain: ChainStep[]): string {
  const told = chain.map((c, i) => `${i === 0 ? 'Then' : 'Next'} ${c.op === '+' ? `${c.value} more are added` : `${c.value} are taken away`}.`);
  return `There are ${start} ${thing}. ${told.join(' ')} How many ${thing} are there now?`;
}

// ===========================================================================
// multi_step from the add-sub-20 item space (two-step items, tapeDiagramItemSpace.ts)
// ===========================================================================

const multiStepWordingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    problems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          story: { type: Type.STRING, description: 'The word problem, telling the two changes in order and ending with the question.' },
          thing: { type: Type.STRING, description: "What is counted, plural (e.g. 'shells'). No numbers." },
          change1: { type: Type.STRING, description: "1-3 words for the first change (e.g. 'found', 'given away'). No numbers." },
          change2: { type: Type.STRING, description: '1-3 words for the second change. No numbers.' },
        },
        required: ['id', 'story', 'thing', 'change1', 'change2'],
      },
    },
  },
  required: ['title', 'description', 'problems'],
};

/**
 * Two-step problems picked by code at the tier's beta, or null: no tier, the objective is not
 * add-sub-20, or the band cannot fill the session. Every item the mode draws has two steps, so the
 * tier's 3-step lever does not run here; the tier moves bridging ten, subtraction and teen numbers.
 */
async function multiStepsFromItemSpace(
  topic: string, gradeLevel: string, grade: string | undefined, difficulty: string | undefined, count: number,
): Promise<SubGenResult[] | null> {
  const band = difficultyBand(difficulty);
  const tier = normalizeSupportTier(difficulty);
  if (!band || !tier) return null;
  const space = await resolveItemSpace(
    `Lesson: ${topic}. In this activity the learner solves two-step word problems (add, then take away, or the reverse) with a tape diagram.`,
    grade, ['add-sub-20'],
  );
  if (!space) return null;
  const log = (m: string) => console.log(`[TapeDiagram] Item space ${space}: ${m}`);
  const twoStep = (it: AddSub20Item) => it.steps.length === 2;
  const items = tierPick(getItemSpace(space), log, twoStep)(count, band[0], band[1], undefined, twoStep) as AddSub20Item[];
  if (items.length < count) {
    log(`band [${band.join(', ')}] gave ${items.length} of ${count}; own path kept`);
    return null;
  }
  let written: { title?: string; description?: string; problems?: (WrittenMultiStep & { id: string })[] } = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `Write ${count} two-step word problems for ${gradeLevel} students in a lesson on "${topic}". `
        + `Each is about one kind of thing (a different kind for each problem): how many at the start, then two changes, `
        + `told in the order of the spec. Use only the numbers in the spec, never state a running total or the answer, `
        + `and end with the question.\n\n`
        + items.map((it, i) => `p${i + 1}: ${getItemSpace(space).solve(it).spec}`).join('\n')
        + `\n\nAlso give a short title and a one-sentence description for the set (no numbers).`,
      config: { responseMimeType: 'application/json', responseSchema: multiStepWordingSchema, temperature: 0.9 },
    });
    written = JSON.parse(response.text ?? '{}');
  } catch (err) {
    log(`wording call failed; plain stories shipped (${String(err).slice(0, 120)})`);
  }
  const byId = new Map((written.problems ?? []).map((w) => [w.id, w]));
  let replaced = 0;
  const title = written.title && !/\d/.test(written.title) ? written.title : 'Two-Step Problems with Tape Diagrams';
  const description = written.description && !/\d/.test(written.description) ? written.description : 'Solve one step at a time.';
  const results = items.map((it, i) => {
    const w = byId.get(`p${i + 1}`);
    const fits = !!w && multiStepStoryFits(it, w);
    if (!fits) replaced++;
    return { title, description, challenge: multiStepChallengeFromItem(it, fits ? w! : plainMultiStep(it), space, tier) };
  });
  log(`band [${band.join(', ')}]: ${items.map((it) => `${it.structure}@${it.beta.toFixed(2)}`).join(' ')}`
    + `${replaced ? `; ${replaced} story(ies) off spec, plain story shipped` : ''}`);
  return results;
}

// ===========================================================================
// solve_comparison from an item space (tapeDiagramItemSpace.ts)
// ===========================================================================

const comparisonWordingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    problems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          story: { type: Type.STRING, description: 'The word problem, ending with the question.' },
          largerLabel: { type: Type.STRING, description: "Bar label for the FIRST person's amount, e.g. \"Liam's shells\". No numbers." },
          smallerLabel: { type: Type.STRING, description: "Bar label for the SECOND person's amount, e.g. \"Zoe's shells\". No numbers." },
        },
        required: ['id', 'story', 'largerLabel', 'smallerLabel'],
      },
    },
  },
  required: ['title', 'description', 'problems'],
};

/**
 * Comparison problems picked by code at the tier's beta, or null: no tier, no strand fits, or the band
 * cannot fill the session. One wording call writes every story; a failed call or a story off its spec
 * ships the space's plain story.
 */
async function comparisonsFromItemSpace(
  topic: string, gradeLevel: string, grade: string | undefined, difficulty: string | undefined, count: number,
): Promise<SubGenResult[] | null> {
  const band = difficultyBand(difficulty);
  if (!band) return null;
  const space = await resolveItemSpace(
    `Lesson: ${topic}. In this activity the learner solves comparison word problems ("how many more", "fewer than") with a tape diagram.`,
    grade, ['compare-20', 'compare-100'],
  );
  if (!space) return null;
  const log = (m: string) => console.log(`[TapeDiagram] Item space ${space}: ${m}`);
  const items = tierPick(getItemSpace(space), log)(count, band[0], band[1]) as CompareItem[];
  if (items.length < count) {
    log(`band [${band.join(', ')}] gave ${items.length} of ${count}; own path kept`);
    return null;
  }
  let written: { title?: string; description?: string; problems?: (WrittenComparison & { id: string })[] } = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `Write ${count} comparison word problems for ${gradeLevel} students in a lesson on "${topic}". `
        + `Each compares what two people have of one kind of thing (a different kind for each problem). `
        + `Follow each spec exactly: the FIRST person always has the larger amount. Use only the numbers in the spec, `
        + `use the relational word it names, never state the answer, and end with the question.\n\n`
        + items.map((it, i) => `p${i + 1}: ${compareSpec(it)}`).join('\n')
        + `\n\nAlso give a short title and a one-sentence description for the set (no numbers).`,
      config: { responseMimeType: 'application/json', responseSchema: comparisonWordingSchema, temperature: 0.9 },
    });
    written = JSON.parse(response.text ?? '{}');
  } catch (err) {
    log(`wording call failed; plain stories shipped (${String(err).slice(0, 120)})`);
  }
  const byId = new Map((written.problems ?? []).map((w) => [w.id, w]));
  let replaced = 0;
  const title = written.title && !/\d/.test(written.title) ? written.title : 'Comparing with Tape Diagrams';
  const description = written.description && !/\d/.test(written.description) ? written.description : 'Use bars to compare two amounts.';
  const results = items.map((it, i) => {
    const w = byId.get(`p${i + 1}`);
    const fits = !!w && comparisonStoryFits(it, w);
    if (!fits) replaced++;
    return { title, description, challenge: comparisonChallengeFromItem(it, fits ? w! : plainComparison(it), space) };
  });
  log(`band [${band.join(', ')}]: ${items.map((it) => `${it.structure}@${it.beta}`).join(' ')}`
    + `${replaced ? `; ${replaced} story(ies) off spec, plain story shipped` : ''}`);
  return results;
}

// ===========================================================================
// Orchestrator: fan out N parallel sub-generator calls for one eval mode
// ===========================================================================

function subGeneratorFor(
  challengeType: string,
): (topic: string, gradeLevel: string, tier?: SupportTier | null, scopeSection?: string, remediationFocus?: string, range?: { min: number; max: number }) => Promise<SubGenResult> {
  switch (challengeType) {
    case 'represent':         return generateRepresentMode;
    case 'solve_comparison':  return generateComparisonMode;
    case 'multi_step':        return generateMultiStepMode;
    case 'solve_part_whole':
    default:                  return generatePartWholeMode;
  }
}

type TapeDiagramConfig = {
    targetEvalMode?: string;
    /** How many challenges in this session. Defaults from COUNT_BY_MODE (3 for T4, 4 for T3). */
    instanceCount?: number;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-screen scaffolding (and how structurally hard the
     * problem) within it. NEVER changes the magnitude/scope of the numbers.
     */
    difficulty?: string;
};

export const generateTapeDiagram = async (
  ctx: GenerationContext,
): Promise<TapeDiagramData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as TapeDiagramConfig;
  const scopeSection = buildScopePromptSection(ctx.scope);
  const evalConstraint = resolveEvalModeConstraint('tape-diagram', config?.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('TapeDiagram', config?.targetEvalMode, evalConstraint);

  const challengeType = evalConstraint?.allowedTypes[0] || 'solve_part_whole';
  // pinnedType (single mode resolved) — used only for the log line tone.
  const pinnedType = (evalConstraint?.allowedTypes.length === 1
    ? evalConstraint.allowedTypes[0]
    : undefined) as TapeDiagramChallengeType | undefined;
  const fromTable = (COUNT_BY_MODE as Record<string, number>)[challengeType];
  const instanceCount = Math.max(
    1,
    Math.min(
      MAX_INSTANCE_COUNT,
      config?.instanceCount ?? fromTable ?? DEFAULT_INSTANCE_COUNT,
    ),
  );

  // Support tier (config.difficulty) drives BOTH axes: scaffolding withdrawal
  // (applied to the rendered challenge below) AND structural problem difficulty
  // (threaded into each sub-generator's prompt + post-process). DRIVES application
  // whenever present — single OR (future) blend.
  const supportTier = normalizeSupportTier(config?.difficulty);

  // Fan out N parallel calls of the same per-mode sub-generator. Variance
  // comes from independent generations (per PRD §6a #2 — structured output
  // converges per-call, not across independent calls).
  const runOne = subGeneratorFor(challengeType);
  // solve_comparison with a tier: the space picks the problems and owns their shape (the tier's forced
  // unknown does not run); scaffolds below still follow the tier. A remediation focus keeps the own path
  // (its moves rewrite the unknown).
  const spaceResults = ctx.remediationFocus ? null
    : challengeType === 'solve_comparison'
      ? await comparisonsFromItemSpace(topic, gradeLevel, ctx.grade, config?.difficulty, instanceCount)
      : challengeType === 'multi_step'
        ? await multiStepsFromItemSpace(topic, gradeLevel, ctx.grade, config?.difficulty, instanceCount)
        : null;
  // The lesson's number range, read once (a "within 10" lesson narrows the grade band). Comparison owns
  // its numbers through the LLM or the space and does not take it.
  const range = !spaceResults && challengeType !== 'solve_comparison'
    ? (await resolveScopeRange(
      { ...ctx.scope, topic }, gradeLevel, 'the largest number in a problem (a total or an amount)', gradeBandRange(ctx.grade),
    )) ?? gradeBandRange(ctx.grade)
    : undefined;
  if (range) console.log(`[TapeDiagram] number range ${range.min}-${range.max} (grade ${ctx.grade ?? '?'})`);
  const subResults = spaceResults ?? await Promise.all(
    Array.from({ length: instanceCount }, () => runOne(
      topic,
      gradeLevel,
      supportTier,
      scopeSection,
      ctx.remediationFocus,
      range,
    )),
  );

  const head = subResults[0];
  const challenges: TapeDiagramChallenge[] = subResults.map((r, idx) => ({
    ...r.challenge,
    id: `td-${idx + 1}`,
  }));

  // Apply the support-tier SCAFFOLDS deterministically at the END, after all
  // structural assembly. Resolve each challenge's scaffold from its OWN mode
  // (so a future blended session still gets difficulty); single-mode just gives
  // every challenge the same one. Code owns the support STRUCTURE; the sub-
  // generators already applied the structural problem-difficulty params.
  if (supportTier) {
    for (const ch of challenges) {
      const sc = resolveSupportStructure(ch.challengeType, supportTier);
      ch.supportTier = supportTier;
      ch.showKnownValues = sc.showKnownValues;
      // bracketLabelMode is not stored on the challenge — it is translated into
      // showBrackets + totalLabel below (the component reads those, not the mode).
      // part-whole phase ramp (only meaningful for that mode).
      if (ch.challengeType === 'solve_part_whole') {
        ch.phaseScaffold = sc.phaseScaffold;
      }
      // multi_step step locking (only meaningful for that mode).
      if (ch.challengeType === 'multi_step') {
        ch.lockSteps = sc.lockSteps;
      }
      // comparison hard: hide the non-answer bar's value (re-read from problem).
      if (ch.challengeType === 'solve_comparison') {
        ch.hideNonAnswerValue = sc.hideNonAnswerValue;
      }
      // Bracket LABEL withdrawal — the single most important hard move. The
      // bracket is rendered from `showBrackets` + the per-bar `totalLabel`;
      // 'none' hides it, 'unlabeled' strips the NUMBER but keeps the bracket.
      // Guard the part-whole Explore leak: the labeled total is only ever shown
      // from Practice onward (component gates on currentPhase), so withdrawing
      // the number here can never expose the Explore answer.
      if (sc.bracketLabelMode === 'none') {
        ch.showBrackets = false;
      } else if (sc.bracketLabelMode === 'unlabeled') {
        ch.showBrackets = true;
        for (const bar of ch.bars) {
          if (bar.totalLabel && /^Total\s*=/.test(bar.totalLabel)) {
            bar.totalLabel = 'Total = ?';
          }
        }
      }
    }
    console.log(
      `[TapeDiagram] Support tier "${supportTier}" applied per-challenge `
      + `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'})`,
    );
  }

  console.log('📏 Tape Diagram generated:', {
    topic,
    challengeType,
    supportTier,
    instanceCount: challenges.length,
    barsPerChallenge: challenges.map((c) => c.bars.length),
  });

  return {
    title: head.title,
    description: head.description,
    challenges,
  };
};
