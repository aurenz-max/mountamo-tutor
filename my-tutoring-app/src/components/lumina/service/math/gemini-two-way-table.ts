import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
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
   */
  showTotals: boolean;
  hint: string;
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
    hint: `P(${template.rowCategories[r]}) = ${rowSum}/${total} = ${round(pA, 2)}. P(${template.columnCategories[c]}) = ${colSum}/${total} = ${round(pB, 2)}. Multiply.`,
  };
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

  // Shuffle scenarios so each session draws a different sequence; cycle if we need more
  // challenges than scenarios.
  const scenarios = shuffle(SCENARIO_POOL);
  const pickScenario = (i: number): ScenarioTemplate => scenarios[i % scenarios.length];

  const out: TwoWayTableChallenge[] = [];
  for (let i = 0; i < target; i++) {
    out.push(buildChallengeOfType(pickType(i), pickScenario(i), i));
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

export const generateTwoWayTable = async (
  topic: string,
  gradeLevel: string,
  config?: {
    instanceCount?: number;
    targetEvalMode?: string;
  }
): Promise<TwoWayTableData> => {
  console.log('[TwoWayTable Gen] Starting generation:', { topic, gradeLevel, config });

  const evalConstraint = resolveEvalModeConstraint('two-way-table', config?.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('TwoWayTable', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(wrapperSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : wrapperSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create the wrapper metadata for a multi-challenge two-way table practice session on "${topic}" for ${gradeLevel} students.

CONTEXT:
- A two-way table session contains 3-6 separate contingency-table problems of the same probability concept, surfaced sequentially.
- The system has ALREADY pre-selected the scenarios, categories, and frequencies for each challenge; you do NOT pick contexts, numbers, or any per-challenge data.
- Your job is ONLY to write the session-level title, description, and choose the challenge type.

${challengeTypeSection}

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
  });

  console.log(
    `[TwoWayTable Gen] Final: allowedTypes=[${allowedChallengeTypes.join(',')}], instances=${challenges.length}, gradeBand=${gradeBand}`
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
