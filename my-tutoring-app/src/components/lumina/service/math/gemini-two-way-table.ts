import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection } from '../scopeContext';
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

/**
 * Two-Way Table Data Interface (multi-instance, PRD A3)
 *
 * A session walks the student through 3-6 contingency-table problems of the same
 * challenge type (joint / marginal / conditional / independence), surfaced
 * sequentially with judgment per challenge. Per-challenge scenarios and frequencies
 * are pre-selected by the local pool service — Gemini structured output converges
 * per-call, so it cannot deliver scenario variance. Gemini contributes only
 * session-level wrapper metadata.
 */

export type TwoWayTableChallengeType =
  | 'joint_probability'
  | 'marginal_distribution'
  | 'conditional_probability'
  | 'independence_test';

export interface TwoWayTableChallenge {
  id: string;
  challengeType: TwoWayTableChallengeType;
  /** Real-world scenario label (e.g., "Pet preference by gender"). */
  scenario: string;
  rowLabel: string;
  columnLabel: string;
  rowCategories: string[];
  columnCategories: string[];
  frequencies: number[][];
  /** Question text shown above the answer input. */
  question: string;
  /** Pre-computed answer as a probability ∈ [0, 1]. */
  expectedProbability: number;
  /** Acceptance tolerance on the probability (±). 0.02 covers two-decimal rounding. */
  tolerance: number;
  /**
   * Whether to render marginal totals (row sums, column sums, grand total).
   * Mode-specific gating: hidden for marginal_distribution and conditional_probability
   * to prevent answer leak — student must compute totals.
   *
   * NOTE: this is the legacy single-switch. The component now reads the
   * fine-grained show* flags below (set from showTotals when no support tier is
   * present, or independently by the tier). showTotals is kept as the default
   * source and for backward compatibility.
   */
  showTotals: boolean;
  hint: string;

  // ── Support-tier scaffolds (set by the generator when config.difficulty present) ──
  /** Student's within-mode support tier ('easy'|'medium'|'hard'). */
  supportTier?: SupportTier;
  /** Render the per-row total column on the right edge. */
  showRowTotals?: boolean;
  /** Render the per-column total row along the bottom. */
  showColTotals?: boolean;
  /** Render the grand-total corner cell. */
  showGrandTotal?: boolean;
  /**
   * Easy-tier "sum reminder" — a worked anchor line shown under the table
   * (e.g. "Tip: the Male row adds to 28 + 12"). NEVER states a total that IS
   * the asked answer's numerator/denominator (see answerTotal guard below).
   */
  sumReminder?: string;

  // ── Answer-decouple guard (NOT rendered; read only by resolveSupportStructure) ──
  // Identifies the ONE margin total that equals the asked answer's key quantity
  // for this challenge, so the tier can show every OTHER total as a scaffold while
  // NEVER revealing this one — the two-way-table analogue of bar-model's
  // answerBarIndex. 'none' = no single margin total is the answer (joint mode:
  // the answer is a probability and the numerator cell is already visible).
  /** Which margin total is answer-bearing and must stay hidden at every tier. */
  answerTotalAxis?: 'row' | 'col' | 'both' | 'none';
  /** Index of the answer-bearing row/col total (when axis is 'row' or 'col'). */
  answerTotalIndex?: number;
}

export interface TwoWayTableData {
  title: string;
  description: string;
  /** 3-6 challenges. Required. Built in-generator from the local pool service. */
  challenges: TwoWayTableChallenge[];
  /** Session-level challenge type for AI tutor context. */
  challengeType: TwoWayTableChallengeType;
  educationalContext?: string;
  gradeBand?: '7-8' | 'statistics';

  // Evaluation props (auto-injected by ManifestOrderRenderer / tester)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEvaluationSubmit?: (result: any) => void;
}

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  joint_probability: {
    promptDoc:
      `"joint_probability": Student computes P(A AND B) — the probability of two `
      + `events occurring together. Answer = joint cell / grand total. Totals shown to `
      + `support context. Grades 7-8.`,
    schemaDescription: "'joint_probability' (P(A and B) from a cell)",
  },
  marginal_distribution: {
    promptDoc:
      `"marginal_distribution": Student computes P(A) for a single category by `
      + `summing across the other variable. Marginal totals are HIDDEN so the student `
      + `must compute the row/column sum themselves before dividing by the grand total. `
      + `Grades 7-8.`,
    schemaDescription: "'marginal_distribution' (P(A) from a row/column total)",
  },
  conditional_probability: {
    promptDoc:
      `"conditional_probability": Student computes P(A|B) — the probability of A `
      + `given B. Answer = joint cell / B's marginal. Marginal totals are HIDDEN so the `
      + `student must derive the conditioning marginal before dividing. Grades 7-Statistics.`,
    schemaDescription: "'conditional_probability' (P(A|B))",
  },
  independence_test: {
    promptDoc:
      `"independence_test": Student computes the expected joint under independence: `
      + `P(A) × P(B). They can compare to the observed P(A ∩ B) to judge independence. `
      + `Totals shown to support marginal computation. Statistics.`,
    schemaDescription: "'independence_test' (expected joint under independence)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — second axis of the two-field
// contract: targetEvalMode = WHICH probability concept, difficulty = HOW MUCH
// of the table is pre-summed for the student. A tier withdraws *display* totals
// (row sums, column sums, grand total) + a worked "sum reminder"; it NEVER
// changes the SCENARIO_POOL counts or the asked answer (that's the eval-mode
// axis). See memory [[structural-difficulty-not-numeric]] /
// [[feedback_support-tiers-natural-levers]].
//
// CRITICAL leak guard: in a two-way table the asked answer is OFTEN a margin
// total (marginal = a row/col total; conditional = the conditioning marginal;
// independence = both factors). So a tier that "shows totals" must NEVER show
// the total that equals the asked answer's numerator/denominator — it shows the
// OTHER totals only. Each builder stamps answerTotalAxis/answerTotalIndex so
// resolveSupportStructure can suppress exactly that one total at every tier
// (the two-way-table analogue of bar-model's decoupled answerBarIndex).
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; mode-default showTotals stands). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

interface SupportScaffold {
  showRowTotals: boolean;
  showColTotals: boolean;
  showGrandTotal: boolean;
  /** Whether to emit the easy-tier worked "sum reminder" anchor line. */
  emitSumReminder: boolean;
  /** Prompt lines describing the tier to the wrapper LLM (tone only). */
  promptLines: string[];
}

const TIER_GUARDRAIL =
  'This tier ONLY changes how many margin totals are pre-summed on screen — it ' +
  'NEVER changes the scenario, the cell counts, or the asked answer. Never make ' +
  'the numbers bigger; the difficulty is how much of the table the student must ' +
  'add up themselves.';

/**
 * easy → hard support gradient. `mode` is the eval mode; `answerAxis`/`answerIdx`
 * come from the built challenge so we can suppress the answer-bearing total.
 *
 * Tier intent (across modes):
 *   easy   — show every total that is NOT answer-bearing + a worked sum reminder.
 *   medium — show only the grand total (a shared anchor that's never the answer
 *            in any mode), no per-row/col sums, no reminder.
 *   hard   — hide ALL totals; the student computes every sum they need.
 */
function resolveSupportStructure(
  tier: SupportTier,
  answerAxis: 'row' | 'col' | 'both' | 'none' | undefined,
): SupportScaffold {
  // The grand total is never the asked answer in ANY mode (answers are
  // probabilities or expected-joint products), so it's always a safe anchor.
  // Row/col totals are safe ONLY on the axis that isn't answer-bearing.
  const rowIsAnswer = answerAxis === 'row' || answerAxis === 'both';
  const colIsAnswer = answerAxis === 'col' || answerAxis === 'both';

  if (tier === 'easy') {
    return {
      // Show each axis's totals UNLESS that axis carries the answer.
      showRowTotals: !rowIsAnswer,
      showColTotals: !colIsAnswer,
      showGrandTotal: true,
      emitSumReminder: true,
      promptLines: [
        TIER_GUARDRAIL,
        'EASY: the table pre-sums every total that is NOT the asked answer, plus a worked "sum reminder" anchor, so the student focuses on the final division.',
      ],
    };
  }
  if (tier === 'medium') {
    return {
      showRowTotals: false,
      showColTotals: false,
      showGrandTotal: true, // grand total is never the answer → safe shared anchor
      emitSumReminder: false,
      promptLines: [
        TIER_GUARDRAIL,
        'MEDIUM: only the grand total is shown; the student adds up the specific row or column they need on their own.',
      ],
    };
  }
  // hard
  return {
    showRowTotals: false,
    showColTotals: false,
    showGrandTotal: false,
    emitSumReminder: false,
    promptLines: [
      TIER_GUARDRAIL,
      'HARD: NO totals are shown — the student computes every sum (row, column, and grand total) needed before dividing.',
    ],
  };
}

// ---------------------------------------------------------------------------
// Structural difficulty (axis 2) — table DIMENSIONALITY, NOT cell magnitude.
// The honest in-mode SHAPE lever for a contingency-table primitive is "how many
// parts to coordinate": a builder-constructor dial driven by table size.
//
//   easy   → 2x2 (4 cells)  — floor: a genuine contingency table; a marginal
//            still sums >=2 cells (the property that DEFINES the non-joint modes),
//            so we never collapse below 2x2.
//   medium → 2x3 (6 cells)  — a row marginal now sums 3 cells; more decoy cells.
//   hard   → 3x3 (9 cells)  — both marginals sum 3 cells over a 9-cell grand
//            total; cap: cell counts stay in the SAME ~5-50 band as the 2x2 pool,
//            the grand total grows only because there are MORE cells.
//
// Code-enforced: the tier SELECTS a template of the target dimension from the
// matching pool; the builders + grandTotal/rowTotal/colTotal generalize over any
// number[][], so correctAnswer auto-recomputes. The LLM authors no frequencies,
// so there is nothing to validate/reconstruct — the structure IS the selected
// template. See memory [[structural-difficulty-not-numeric]].
// ---------------------------------------------------------------------------

type TableDimension = '2x2' | '2x3' | '3x3';

interface ProblemShape {
  /** Target table dimension for this tier (clamped to [2x2, 3x3]). */
  dimension: TableDimension;
  /** Prompt lines describing the structural difficulty to the wrapper LLM. */
  promptLines: string[];
}

/**
 * One tier → one structural intent. The dimension is clamped to [2x2, 3x3]:
 * below 2x2 a marginal would collapse to a single pre-given cell (silently a
 * different, joint-style mode = forbidden); above 3x3 we would be inflating
 * grand-total cardinality past the realistic-table cap. A two-tier band where
 * only one dimension fits SATURATES there honestly (e.g. if a future pool lacks
 * 3x3 templates, the selector falls back to the densest available — see
 * poolForDimension).
 */
function resolveProblemShape(tier: SupportTier): ProblemShape {
  if (tier === 'easy') {
    return {
      dimension: '2x2',
      promptLines: [
        'STRUCTURE: a 2x2 table (4 cells) — the fewest parts to coordinate; a marginal sums just 2 cells.',
      ],
    };
  }
  if (tier === 'medium') {
    return {
      dimension: '2x3',
      promptLines: [
        'STRUCTURE: a 2x3 table (6 cells) — a row marginal now sums 3 cells and there are more decoy cells to scan. Same small per-cell counts, just more of them.',
      ],
    };
  }
  // hard
  return {
    dimension: '3x3',
    promptLines: [
      'STRUCTURE: a 3x3 table (9 cells) — marginals sum 3 cells over a 9-cell grand total; more competing rows and columns to keep straight. Cells stay the same small size — only the COUNT of cells grows.',
    ],
  };
}

/** Pool for a target dimension. Falls back to the 2x2 pool if a denser pool is
 *  empty so the band saturates honestly rather than throwing. */
function poolForDimension(dim: TableDimension): ScenarioTemplate[] {
  if (dim === '3x3') return SCENARIO_POOL_3X3.length > 0 ? SCENARIO_POOL_3X3 : SCENARIO_POOL_2X3.length > 0 ? SCENARIO_POOL_2X3 : SCENARIO_POOL;
  if (dim === '2x3') return SCENARIO_POOL_2X3.length > 0 ? SCENARIO_POOL_2X3 : SCENARIO_POOL;
  return SCENARIO_POOL;
}

// ---------------------------------------------------------------------------
// Scenario pool — pre-authored real-world contingency tables
// ---------------------------------------------------------------------------

interface ScenarioTemplate {
  scenario: string;
  rowLabel: string;
  columnLabel: string;
  rowCategories: string[];
  columnCategories: string[];
  /** 2x2 or 2x3 frequencies. Realistic counts, no empty cells. */
  frequencies: number[][];
}

const SCENARIO_POOL: ScenarioTemplate[] = [
  {
    scenario: 'Pet preference by gender',
    rowLabel: 'Gender',
    columnLabel: 'Pet preference',
    rowCategories: ['Male', 'Female'],
    columnCategories: ['Dogs', 'Cats'],
    frequencies: [[28, 12], [18, 22]],
  },
  {
    scenario: 'Sport participation by grade',
    rowLabel: 'Grade',
    columnLabel: 'Sport',
    rowCategories: ['Grade 7', 'Grade 8'],
    columnCategories: ['Soccer', 'Basketball'],
    frequencies: [[24, 16], [20, 30]],
  },
  {
    scenario: 'Transportation to school by distance',
    rowLabel: 'Distance from school',
    columnLabel: 'Transportation',
    rowCategories: ['Under 1 mile', 'Over 1 mile'],
    columnCategories: ['Walks', 'Bus'],
    frequencies: [[35, 5], [10, 50]],
  },
  {
    scenario: 'Breakfast habit by day type',
    rowLabel: 'Day',
    columnLabel: 'Breakfast',
    rowCategories: ['Weekday', 'Weekend'],
    columnCategories: ['Eats', 'Skips'],
    frequencies: [[45, 15], [50, 10]],
  },
  {
    scenario: 'Favorite subject by gender',
    rowLabel: 'Gender',
    columnLabel: 'Favorite subject',
    rowCategories: ['Male', 'Female'],
    columnCategories: ['Math', 'Reading'],
    frequencies: [[26, 14], [16, 24]],
  },
  {
    scenario: 'Music preference by age group',
    rowLabel: 'Age group',
    columnLabel: 'Music',
    rowCategories: ['Teen', 'Adult'],
    columnCategories: ['Pop', 'Rock'],
    frequencies: [[32, 8], [12, 28]],
  },
  {
    scenario: 'Movie genre preference by gender',
    rowLabel: 'Gender',
    columnLabel: 'Genre',
    rowCategories: ['Male', 'Female'],
    columnCategories: ['Action', 'Comedy'],
    frequencies: [[30, 20], [18, 32]],
  },
  {
    scenario: 'Vacation preference by income',
    rowLabel: 'Income',
    columnLabel: 'Vacation type',
    rowCategories: ['Below median', 'Above median'],
    columnCategories: ['Beach', 'Mountain'],
    frequencies: [[22, 18], [27, 33]],
  },
  {
    scenario: 'Lunch choice by grade',
    rowLabel: 'Grade',
    columnLabel: 'Lunch',
    rowCategories: ['Grade 6', 'Grade 7'],
    columnCategories: ['Cafeteria', 'Packed'],
    frequencies: [[36, 24], [28, 32]],
  },
  {
    scenario: 'Phone brand by age group',
    rowLabel: 'Age group',
    columnLabel: 'Phone brand',
    rowCategories: ['Under 30', '30 and over'],
    columnCategories: ['Brand A', 'Brand B'],
    frequencies: [[42, 18], [15, 45]],
  },
];

// ── 2x3 pool (medium structural tier): 6 cells, same per-cell band (~5-50). ──
// Two row categories × three column categories. A row marginal now sums 3 cells.
const SCENARIO_POOL_2X3: ScenarioTemplate[] = [
  {
    scenario: 'Favorite snack by grade',
    rowLabel: 'Grade',
    columnLabel: 'Snack',
    rowCategories: ['Grade 7', 'Grade 8'],
    columnCategories: ['Fruit', 'Chips', 'Yogurt'],
    frequencies: [[18, 14, 8], [12, 20, 10]],
  },
  {
    scenario: 'Commute mode by neighborhood',
    rowLabel: 'Neighborhood',
    columnLabel: 'Commute mode',
    rowCategories: ['North', 'South'],
    columnCategories: ['Walk', 'Bike', 'Bus'],
    frequencies: [[16, 9, 25], [22, 14, 18]],
  },
  {
    scenario: 'Pet type by household',
    rowLabel: 'Household',
    columnLabel: 'Pet type',
    rowCategories: ['Apartment', 'House'],
    columnCategories: ['Dog', 'Cat', 'Fish'],
    frequencies: [[12, 24, 16], [30, 18, 10]],
  },
  {
    scenario: 'Drink choice by meal',
    rowLabel: 'Meal',
    columnLabel: 'Drink',
    rowCategories: ['Lunch', 'Dinner'],
    columnCategories: ['Water', 'Milk', 'Juice'],
    frequencies: [[28, 12, 20], [34, 8, 18]],
  },
  {
    scenario: 'Hobby by age group',
    rowLabel: 'Age group',
    columnLabel: 'Hobby',
    rowCategories: ['Teen', 'Adult'],
    columnCategories: ['Gaming', 'Reading', 'Sports'],
    frequencies: [[26, 10, 24], [14, 28, 18]],
  },
  {
    scenario: 'Movie type by ticket time',
    rowLabel: 'Ticket time',
    columnLabel: 'Movie type',
    rowCategories: ['Matinee', 'Evening'],
    columnCategories: ['Action', 'Comedy', 'Drama'],
    frequencies: [[20, 16, 9], [32, 22, 15]],
  },
];

// ── 3x3 pool (hard structural tier): 9 cells, same per-cell band (~5-50). ──
// Three row categories × three column categories. Marginals sum 3 cells over a
// 9-cell grand total — more addends and more decoy cells, never bigger numbers.
const SCENARIO_POOL_3X3: ScenarioTemplate[] = [
  {
    scenario: 'Sport by grade',
    rowLabel: 'Grade',
    columnLabel: 'Sport',
    rowCategories: ['Grade 6', 'Grade 7', 'Grade 8'],
    columnCategories: ['Soccer', 'Tennis', 'Track'],
    frequencies: [[18, 10, 14], [22, 16, 8], [12, 20, 24]],
  },
  {
    scenario: 'Lunch choice by day',
    rowLabel: 'Day',
    columnLabel: 'Lunch',
    rowCategories: ['Monday', 'Wednesday', 'Friday'],
    columnCategories: ['Cafeteria', 'Packed', 'Skip'],
    frequencies: [[30, 18, 6], [24, 22, 9], [28, 14, 11]],
  },
  {
    scenario: 'Transport by region',
    rowLabel: 'Region',
    columnLabel: 'Transport',
    rowCategories: ['Urban', 'Suburban', 'Rural'],
    columnCategories: ['Walk', 'Bus', 'Car'],
    frequencies: [[26, 20, 14], [10, 24, 32], [6, 12, 28]],
  },
  {
    scenario: 'Subject preference by grade',
    rowLabel: 'Grade',
    columnLabel: 'Subject',
    rowCategories: ['Grade 7', 'Grade 8', 'Grade 9'],
    columnCategories: ['Math', 'Science', 'History'],
    frequencies: [[20, 16, 12], [14, 26, 18], [22, 10, 24]],
  },
  {
    scenario: 'Music genre by age group',
    rowLabel: 'Age group',
    columnLabel: 'Genre',
    rowCategories: ['Under 20', '20 to 40', 'Over 40'],
    columnCategories: ['Pop', 'Rock', 'Jazz'],
    frequencies: [[32, 18, 6], [20, 28, 14], [10, 22, 30]],
  },
];

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;

const round = (n: number, decimals: number = 2): number => {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
};

const grandTotal = (f: number[][]): number =>
  f.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);

const rowTotal = (f: number[][], r: number): number =>
  f[r].reduce((a, b) => a + b, 0);

const colTotal = (f: number[][], c: number): number =>
  f.reduce((s, row) => s + (row[c] ?? 0), 0);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildJointChallenge(template: ScenarioTemplate, idx: number): TwoWayTableChallenge {
  // Pick a non-trivial cell (avoid largest cell so the answer isn't visually obvious).
  const total = grandTotal(template.frequencies);
  const r = idx % template.rowCategories.length;
  const c = (idx + 1) % template.columnCategories.length;
  const joint = template.frequencies[r][c];
  const expected = round(joint / total, 4);
  return {
    id: `twt-${idx + 1}`,
    challengeType: 'joint_probability',
    scenario: template.scenario,
    rowLabel: template.rowLabel,
    columnLabel: template.columnLabel,
    rowCategories: template.rowCategories,
    columnCategories: template.columnCategories,
    frequencies: template.frequencies,
    question: `What is P(${template.rowCategories[r]} AND ${template.columnCategories[c]})? Enter your answer as a decimal between 0 and 1 (round to 2 decimals).`,
    expectedProbability: expected,
    tolerance: 0.02,
    showTotals: true,
    // Answer = cell / grand total → no single margin total IS the answer.
    answerTotalAxis: 'none',
    hint: `Find the cell where ${template.rowCategories[r]} and ${template.columnCategories[c]} meet (${joint}). Divide by the grand total (${total}).`,
  };
}

function buildMarginalChallenge(template: ScenarioTemplate, idx: number): TwoWayTableChallenge {
  const total = grandTotal(template.frequencies);
  const useRow = idx % 2 === 0;
  const r = idx % template.rowCategories.length;
  const c = idx % template.columnCategories.length;
  if (useRow) {
    const marginal = rowTotal(template.frequencies, r);
    return {
      id: `twt-${idx + 1}`,
      challengeType: 'marginal_distribution',
      scenario: template.scenario,
      rowLabel: template.rowLabel,
      columnLabel: template.columnLabel,
      rowCategories: template.rowCategories,
      columnCategories: template.columnCategories,
      frequencies: template.frequencies,
      question: `What is P(${template.rowCategories[r]})? Enter your answer as a decimal between 0 and 1 (round to 2 decimals).`,
      expectedProbability: round(marginal / total, 4),
      tolerance: 0.02,
      showTotals: false,
      // Answer numerator IS this row's total → never reveal it, even at easy.
      answerTotalAxis: 'row',
      answerTotalIndex: r,
      hint: `Add the counts in the "${template.rowCategories[r]}" row (gives ${marginal}). Divide by the grand total (sum of all cells = ${total}).`,
    };
  }
  const marginal = colTotal(template.frequencies, c);
  return {
    id: `twt-${idx + 1}`,
    challengeType: 'marginal_distribution',
    scenario: template.scenario,
    rowLabel: template.rowLabel,
    columnLabel: template.columnLabel,
    rowCategories: template.rowCategories,
    columnCategories: template.columnCategories,
    frequencies: template.frequencies,
    question: `What is P(${template.columnCategories[c]})? Enter your answer as a decimal between 0 and 1 (round to 2 decimals).`,
    expectedProbability: round(marginal / total, 4),
    tolerance: 0.02,
    showTotals: false,
    // Answer numerator IS this column's total → never reveal it, even at easy.
    answerTotalAxis: 'col',
    answerTotalIndex: c,
    hint: `Add the counts in the "${template.columnCategories[c]}" column (gives ${marginal}). Divide by the grand total (sum of all cells = ${total}).`,
  };
}

function buildConditionalChallenge(template: ScenarioTemplate, idx: number): TwoWayTableChallenge {
  const givenRow = idx % 2 === 0;
  const r = idx % template.rowCategories.length;
  const c = (idx + 1) % template.columnCategories.length;
  const joint = template.frequencies[r][c];
  if (givenRow) {
    const condTotal = rowTotal(template.frequencies, r);
    const expected = round(joint / condTotal, 4);
    return {
      id: `twt-${idx + 1}`,
      challengeType: 'conditional_probability',
      scenario: template.scenario,
      rowLabel: template.rowLabel,
      columnLabel: template.columnLabel,
      rowCategories: template.rowCategories,
      columnCategories: template.columnCategories,
      frequencies: template.frequencies,
      question: `Given a member is ${template.rowCategories[r]}, what is the probability they are ${template.columnCategories[c]}? Enter P(${template.columnCategories[c]} | ${template.rowCategories[r]}) as a decimal (round to 2 decimals).`,
      expectedProbability: expected,
      tolerance: 0.02,
      showTotals: false,
      // Answer denominator IS this row's total (the conditioning marginal) → hide it.
      answerTotalAxis: 'row',
      answerTotalIndex: r,
      hint: `Only look at the "${template.rowCategories[r]}" row. The cell ${template.columnCategories[c]} in that row is ${joint}. The row total is ${condTotal}. Divide: ${joint} ÷ ${condTotal}.`,
    };
  }
  const condTotal = colTotal(template.frequencies, c);
  const expected = round(joint / condTotal, 4);
  return {
    id: `twt-${idx + 1}`,
    challengeType: 'conditional_probability',
    scenario: template.scenario,
    rowLabel: template.rowLabel,
    columnLabel: template.columnLabel,
    rowCategories: template.rowCategories,
    columnCategories: template.columnCategories,
    frequencies: template.frequencies,
    question: `Given a member is ${template.columnCategories[c]}, what is the probability they are ${template.rowCategories[r]}? Enter P(${template.rowCategories[r]} | ${template.columnCategories[c]}) as a decimal (round to 2 decimals).`,
    expectedProbability: expected,
    tolerance: 0.02,
    showTotals: false,
    // Answer denominator IS this column's total (the conditioning marginal) → hide it.
    answerTotalAxis: 'col',
    answerTotalIndex: c,
    hint: `Only look at the "${template.columnCategories[c]}" column. The cell ${template.rowCategories[r]} in that column is ${joint}. The column total is ${condTotal}. Divide: ${joint} ÷ ${condTotal}.`,
  };
}

function buildIndependenceChallenge(template: ScenarioTemplate, idx: number): TwoWayTableChallenge {
  const total = grandTotal(template.frequencies);
  const r = idx % template.rowCategories.length;
  const c = (idx + 1) % template.columnCategories.length;
  const rowSum = rowTotal(template.frequencies, r);
  const colSum = colTotal(template.frequencies, c);
  const pA = rowSum / total;
  const pB = colSum / total;
  const expected = round(pA * pB, 4);
  return {
    id: `twt-${idx + 1}`,
    challengeType: 'independence_test',
    scenario: template.scenario,
    rowLabel: template.rowLabel,
    columnLabel: template.columnLabel,
    rowCategories: template.rowCategories,
    columnCategories: template.columnCategories,
    frequencies: template.frequencies,
    question: `If ${template.rowCategories[r]} and ${template.columnCategories[c]} were independent, the expected joint probability would be P(${template.rowCategories[r]}) × P(${template.columnCategories[c]}). Compute this expected joint probability (round to 2 decimals).`,
    expectedProbability: expected,
    tolerance: 0.02,
    showTotals: true,
    // Both factors are margin totals (row total → P(A), col total → P(B)) → the
    // pair IS the answer's inputs. Showing both at easy would hand over the whole
    // computation, so the tier suppresses BOTH per-row and per-col totals (only
    // the grand total stays as a safe anchor).
    answerTotalAxis: 'both',
    hint: `P(${template.rowCategories[r]}) = ${rowSum}/${total} = ${round(pA, 2)}. P(${template.columnCategories[c]}) = ${colSum}/${total} = ${round(pB, 2)}. Multiply.`,
  };
}

/**
 * Build the easy-tier worked "sum reminder" — a single demonstrated total that
 * is GUARANTEED not to be the asked answer (picks a safe row/col on the
 * non-answer axis). Returns undefined if no safe total exists (independence: the
 * grand total is the only safe anchor and it's already shown, so no reminder).
 */
function buildSumReminder(ch: TwoWayTableChallenge): string | undefined {
  const f = ch.frequencies;
  const axis = ch.answerTotalAxis ?? 'none';
  // Pick a SAFE row whose total isn't the answer (row 0 unless it's the answer row).
  const safeRow = axis === 'row'
    ? f.findIndex((_, i) => i !== ch.answerTotalIndex)
    : 0;
  // Pick a SAFE column whose total isn't the answer.
  const colCount = ch.columnCategories.length;
  let safeCol = 0;
  if (axis === 'col') {
    for (let i = 0; i < colCount; i++) { if (i !== ch.answerTotalIndex) { safeCol = i; break; } }
  }

  if (axis === 'both') {
    // Independence: never demonstrate a row OR col factor. Anchor on the grand total.
    const total = grandTotal(f);
    return `Tip: the grand total (everyone counted) is ${total}.`;
  }
  if (axis === 'row' && safeRow >= 0) {
    const sum = rowTotal(f, safeRow);
    const parts = f[safeRow].join(' + ');
    return `Tip: the "${ch.rowCategories[safeRow]}" row adds to ${parts} = ${sum}.`;
  }
  if (axis === 'col') {
    const sum = colTotal(f, safeCol);
    const parts = f.map((row) => row[safeCol] ?? 0).join(' + ');
    return `Tip: the "${ch.columnCategories[safeCol]}" column adds to ${parts} = ${sum}.`;
  }
  // axis === 'none' (joint): demonstrate a row sum as a worked anchor.
  const sum = rowTotal(f, safeRow);
  const parts = f[safeRow].join(' + ');
  return `Tip: the "${ch.rowCategories[safeRow]}" row adds to ${parts} = ${sum}.`;
}

/**
 * Apply a support tier to one challenge IN PLACE — sets the fine-grained show*
 * flags, the sum reminder, and supportTier. Gated only on a tier being present;
 * resolves from the challenge's OWN answerTotalAxis so the answer-bearing total
 * is never revealed at any tier (the decoupled-answer guard). Code owns the
 * scaffold STRUCTURE; the pool already owns the counts (unchanged).
 */
function applySupportTier(ch: TwoWayTableChallenge, tier: SupportTier): void {
  const sc = resolveSupportStructure(tier, ch.answerTotalAxis);
  ch.supportTier = tier;
  ch.showRowTotals = sc.showRowTotals;
  ch.showColTotals = sc.showColTotals;
  ch.showGrandTotal = sc.showGrandTotal;
  // Keep the legacy single switch coherent: any total visible ⇒ showTotals true.
  ch.showTotals = sc.showRowTotals || sc.showColTotals || sc.showGrandTotal;
  ch.sumReminder = sc.emitSumReminder ? buildSumReminder(ch) : undefined;
}

function buildChallengeOfType(
  type: TwoWayTableChallengeType,
  template: ScenarioTemplate,
  idx: number,
): TwoWayTableChallenge {
  switch (type) {
    case 'joint_probability': return buildJointChallenge(template, idx);
    case 'marginal_distribution': return buildMarginalChallenge(template, idx);
    case 'conditional_probability': return buildConditionalChallenge(template, idx);
    case 'independence_test': return buildIndependenceChallenge(template, idx);
  }
}

interface SelectTwoWayTableChallengesOptions {
  count?: number;
  gradeBand?: '7-8' | 'statistics';
  /** Within-mode support tier from config.difficulty. Withdraws display totals
   *  per challenge; NEVER changes the SCENARIO_POOL counts or the asked answer. */
  supportTier?: SupportTier | null;
}

export function selectTwoWayTableChallenges(
  challengeTypes: TwoWayTableChallengeType | TwoWayTableChallengeType[],
  options: SelectTwoWayTableChallengesOptions = {},
): TwoWayTableChallenge[] {
  const target = Math.max(1, Math.min(MAX_INSTANCE_COUNT, options.count ?? DEFAULT_INSTANCE_COUNT));
  const allowed: TwoWayTableChallengeType[] = Array.isArray(challengeTypes)
    ? (challengeTypes.length > 0 ? challengeTypes : ['joint_probability'])
    : [challengeTypes];

  // For bundled modes, interleave allowed types across the session.
  const sessionOrder = allowed.length > 1 ? shuffle(allowed) : allowed;
  const pickType = (i: number): TwoWayTableChallengeType => sessionOrder[i % sessionOrder.length];

  // STRUCTURAL DIFFICULTY (axis 2): when a support tier is present, draw scenarios
  // from the dimension-appropriate pool (easy 2x2 → medium 2x3 → hard 3x3). The
  // no-tier path is BYTE-IDENTICAL: it always draws from the 2x2 SCENARIO_POOL.
  const dimension = options.supportTier ? resolveProblemShape(options.supportTier).dimension : '2x2';
  const sourcePool = options.supportTier ? poolForDimension(dimension) : SCENARIO_POOL;

  // Shuffle scenarios so each session draws a different sequence; cycle if we need more
  // challenges than scenarios.
  const scenarios = shuffle(sourcePool);
  const pickScenario = (i: number): ScenarioTemplate => scenarios[i % scenarios.length];

  const out: TwoWayTableChallenge[] = [];
  for (let i = 0; i < target; i++) {
    out.push(buildChallengeOfType(pickType(i), pickScenario(i), i));
  }

  // Apply the support tier deterministically AFTER each challenge is built, so it
  // can read the per-challenge answerTotalAxis and never reveal the answer total.
  // Gated ONLY on a tier being present (not on the mode), so a future blended
  // session still gets difficulty; single-mode just gives every challenge the
  // same tier resolved from its own answer axis.
  if (options.supportTier) {
    for (const ch of out) applySupportTier(ch, options.supportTier);
    console.log(
      `[TwoWayTable] Support tier "${options.supportTier}" applied per-challenge `
      + `(${allowed.length === 1 ? `single-mode ${allowed[0]}` : 'blended'}); table dimension=${dimension}`,
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// Wrapper schema — Gemini only writes session-level title/description
// ---------------------------------------------------------------------------

const wrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Session title. Do NOT mention specific scenarios — the session walks through several.",
    },
    description: {
      type: Type.STRING,
      description: "1-2 sentence description of what students will practice across the session.",
    },
    challengeType: {
      type: Type.STRING,
      enum: ['joint_probability', 'marginal_distribution', 'conditional_probability', 'independence_test'],
      description: "Challenge type for the session. All challenges share this type.",
    },
    educationalContext: {
      type: Type.STRING,
      description: "Optional short context paragraph explaining when/why this probability concept matters.",
    },
    gradeBand: {
      type: Type.STRING,
      enum: ['7-8', 'statistics'],
      description: "Grade band — '7-8' for intro probability, 'statistics' for inferential extensions.",
    },
  },
  required: ["title", "description", "challengeType"],
};

function inferGradeBand(gradeLevel: string): '7-8' | 'statistics' {
  const g = gradeLevel.toLowerCase();
  if (g.includes('statistic') || g.includes('college') || g.includes('ap')) return 'statistics';
  return '7-8';
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type TwoWayTableConfig = {
    instanceCount?: number;
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which concept,
     * difficulty = how many margin totals are pre-summed on screen. NEVER changes
     * the scenario counts or the asked answer.
     */
    difficulty?: string;
};

export const generateTwoWayTable = async (
  ctx: GenerationContext,
): Promise<TwoWayTableData> => {
  const { topic } = ctx;
  const scopeSection = buildScopePromptSection(ctx.scope);
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as TwoWayTableConfig;
  console.log('[TwoWayTable Gen] Starting generation:', { topic, gradeLevel, config });

  const evalConstraint = resolveEvalModeConstraint('two-way-table', config?.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('TwoWayTable', config?.targetEvalMode, evalConstraint);

  const supportTier = normalizeSupportTier(config?.difficulty);
  // pinnedType is ONLY for the prompt tone (which concept to describe to the LLM);
  // application is driven per-challenge in the selector, gated on supportTier.
  const pinnedType =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as TwoWayTableChallengeType)
      : undefined;
  // One coherent "what this tier means" block = scaffolding withdrawal (axis 1,
  // resolveSupportStructure) PLUS structural problem difficulty (axis 2,
  // resolveProblemShape table dimension). The LLM only authors wrapper prose, so
  // these lines just keep its title/description honest about table size; the
  // actual structure is code-enforced in the selector.
  const tierLines = supportTier
    ? [
        ...resolveSupportStructure(supportTier, undefined).promptLines,
        ...resolveProblemShape(supportTier).promptLines,
      ]
    : null;
  const tierSection = tierLines
    ? `\n## WITHIN-MODE SUPPORT TIER "${supportTier}" (scaffolding + table structure — NOT number size)\n${tierLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(wrapperSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : wrapperSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create the wrapper metadata for a multi-challenge two-way table practice session on "${topic}
${scopeSection}" for ${gradeLevel} students.

CONTEXT:
- A two-way table session contains 3-6 separate contingency-table problems of the same probability concept, surfaced sequentially.
- The system has ALREADY pre-selected the scenarios, categories, and frequencies for each challenge; you do NOT pick contexts, numbers, or any per-challenge data.
- Your job is ONLY to write the session-level title, description, and choose the challenge type.

${challengeTypeSection}
${tierSection}
REQUIREMENTS:
1. Write a clear, student-friendly title for the whole session. Do NOT name any specific scenario — the session walks through several.
2. Provide a 1-2 sentence educational description of what students will practice.
3. Set challengeType to the correct probability concept.
4. Optionally provide a short educational context paragraph.

Return ONLY the wrapper fields described above.
`;

  let wrapper: {
    title?: string;
    description?: string;
    challengeType?: TwoWayTableChallengeType;
    educationalContext?: string;
    gradeBand?: '7-8' | 'statistics';
  } = {};

  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        temperature: 0.9,
        topP: 0.95,
        responseMimeType: "application/json",
        responseSchema: activeSchema,
      },
    });
    wrapper = result.text ? JSON.parse(result.text) : {};
  } catch (err) {
    console.warn('[TwoWayTable Gen] Wrapper LLM call failed; using fallback metadata.', err);
  }

  const validTypes: TwoWayTableChallengeType[] = [
    'joint_probability',
    'marginal_distribution',
    'conditional_probability',
    'independence_test',
  ];

  let allowedChallengeTypes: TwoWayTableChallengeType[];
  if (evalConstraint && evalConstraint.allowedTypes.length > 0) {
    allowedChallengeTypes = evalConstraint.allowedTypes as TwoWayTableChallengeType[];
  } else if (wrapper.challengeType && validTypes.includes(wrapper.challengeType)) {
    allowedChallengeTypes = [wrapper.challengeType];
  } else {
    allowedChallengeTypes = ['joint_probability'];
  }
  const sessionChallengeType: TwoWayTableChallengeType = allowedChallengeTypes[0];

  const gradeBand = wrapper.gradeBand ?? inferGradeBand(gradeLevel);

  const challenges = selectTwoWayTableChallenges(allowedChallengeTypes, {
    count: config?.instanceCount,
    gradeBand,
    supportTier,
  });

  const structDim = supportTier ? resolveProblemShape(supportTier).dimension : 'none';
  console.log(
    `[TwoWayTable Gen] Final: allowedTypes=[${allowedChallengeTypes.join(',')}], instances=${challenges.length}, gradeBand=${gradeBand}, supportTier=${supportTier ?? 'none'}, tableDim=${structDim}${pinnedType ? `, pinned=${pinnedType}` : ''}`
  );

  return {
    title: wrapper.title ?? 'Two-Way Table Probability Practice',
    description:
      wrapper.description ??
      'Read contingency tables and compute joint, marginal, conditional, or independence probabilities.',
    challenges,
    challengeType: sessionChallengeType,
    educationalContext: wrapper.educationalContext,
    gradeBand,
  };
};
