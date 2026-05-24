import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  PercentBarData,
  PercentBarChallenge,
  PercentContext,
} from "../../primitives/visual-primitives/math/PercentBar";
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

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  direct: {
    promptDoc:
      `"direct": Percent-of-a-number visualization. Student places the named percent on the bar. `
      + `Contexts: benchmark percents on quantities (cookies, students, test points). `
      + `Grade 5-6 focus. Target = rate stated in the problem.`,
    schemaDescription: "'direct' (place percent of a number)",
  },
  subtraction: {
    promptDoc:
      `"subtraction": Discount problems requiring 100 - rate subtraction. `
      + `"30% off — what percent of the original price do you still pay?" → answer 70. `
      + `Grade 6-7 focus. Target = 100 minus the discount rate.`,
    schemaDescription: "'subtraction' (discount, remaining percent)",
  },
  addition: {
    promptDoc:
      `"addition": Tax/tip/markup identification. Student places the percent being added. `
      + `"$40 bill, 15% tip — what percent IS the tip?" → answer 15. `
      + `The bar only accepts 0-100, never dollar amounts or totals. `
      + `Grade 6-7 focus. Target = the additive rate.`,
    schemaDescription: "'addition' (tax, tip, markup rate)",
  },
  comparison: {
    promptDoc:
      `"comparison": Compare two percents and place the LARGER one on the bar. `
      + `"Store A: 30% off. Store B: 20% off. Place the larger discount." → answer 30. `
      + `Grade 7-8 focus. Target = max of the two rates.`,
    schemaDescription: "'comparison' (place the larger percent)",
  },
};

// ---------------------------------------------------------------------------
// Pool service — per-mode scenario builders
// ---------------------------------------------------------------------------

const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;

type ChallengeType = 'direct' | 'subtraction' | 'addition' | 'comparison';

const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface ChallengeSpec {
  scenario: string;
  wholeValue: number;
  wholeValueLabel: string;
  question: string;
  targetPercent: number;
  hint: string;
  context: PercentContext;
}

// -- Direct mode pool ----------------------------------------------------------

interface DirectTemplate {
  id: string;
  build: (rate: number, base: number) => Omit<ChallengeSpec, 'targetPercent' | 'context'>;
}

const DIRECT_TEMPLATES: readonly DirectTemplate[] = [
  {
    id: 'cookies',
    build: (rate, base) => ({
      scenario: `A batch of ${base} cookies is on the table.`,
      wholeValue: base,
      wholeValueLabel: 'Total Cookies',
      question: `Show ${rate}% on the bar to mark that portion of the batch.`,
      hint: `${rate}% means ${rate} out of every 100 cookies. Slide the bar until it reads ${rate}%.`,
    }),
  },
  {
    id: 'students',
    build: (rate, base) => ({
      scenario: `There are ${base} students in the class.`,
      wholeValue: base,
      wholeValueLabel: 'Total Students',
      question: `Show what ${rate}% of the class looks like on the bar.`,
      hint: `Think of the bar as the whole class (100%). Where is ${rate}% of that?`,
    }),
  },
  {
    id: 'test-score',
    build: (rate, base) => ({
      scenario: `You took a ${base}-point test.`,
      wholeValue: base,
      wholeValueLabel: 'Total Points',
      question: `You scored ${rate}% on the test. Show ${rate}% on the bar.`,
      hint: `${rate}% of ${base} points — slide the bar to ${rate}%.`,
    }),
  },
  {
    id: 'pages-read',
    build: (rate, base) => ({
      scenario: `Your book has ${base} pages.`,
      wholeValue: base,
      wholeValueLabel: 'Total Pages',
      question: `You have read ${rate}% of the book so far. Show ${rate}% on the bar.`,
      hint: `Slide the bar to ${rate}% — the value display tells you how many pages that is.`,
    }),
  },
  {
    id: 'pizza-slices',
    build: (rate, base) => ({
      scenario: `A party platter has ${base} slices of pizza.`,
      wholeValue: base,
      wholeValueLabel: 'Total Slices',
      question: `${rate}% of the slices have been eaten. Show ${rate}% on the bar.`,
      hint: `${rate}% out of the ${base} slices — slide the bar to ${rate}%.`,
    }),
  },
  {
    id: 'jar-marbles',
    build: (rate, base) => ({
      scenario: `A jar holds ${base} marbles.`,
      wholeValue: base,
      wholeValueLabel: 'Total Marbles',
      question: `${rate}% of the marbles are blue. Show ${rate}% on the bar.`,
      hint: `Where on the 0%–100% bar does ${rate}% sit?`,
    }),
  },
  {
    id: 'stickers',
    build: (rate, base) => ({
      scenario: `A sticker sheet has ${base} stickers.`,
      wholeValue: base,
      wholeValueLabel: 'Total Stickers',
      question: `You have already used ${rate}% of them. Show ${rate}% on the bar.`,
      hint: `${rate} out of every 100 stickers — that is where the bar should land.`,
    }),
  },
];

const DIRECT_RATES = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90] as const;
const DIRECT_BASES = [20, 25, 40, 50, 60, 80, 100] as const;

function buildDirect(): ChallengeSpec {
  const template = pick(DIRECT_TEMPLATES);
  const rate = pick(DIRECT_RATES);
  const base = pick(DIRECT_BASES);
  const partial = template.build(rate, base);
  const finalValue = (base * rate) / 100;
  return {
    ...partial,
    targetPercent: rate,
    context: {
      problemType: 'direct',
      initialValue: base,
      changeRate: 0,
      discountFactor: rate / 100,
      finalValue,
    },
  };
}

// -- Subtraction mode pool -----------------------------------------------------

interface SubtractionTemplate {
  id: string;
  build: (rate: number, base: number) => Omit<ChallengeSpec, 'targetPercent' | 'context'>;
}

const SUBTRACTION_TEMPLATES: readonly SubtractionTemplate[] = [
  {
    id: 'shirt-discount',
    build: (rate, base) => ({
      scenario: `A shirt costs $${base}. The store offers a ${rate}% discount.`,
      wholeValue: base,
      wholeValueLabel: 'Original Price ($)',
      question: `What percent of the original price do you still pay after the ${rate}% discount? Show that percent on the bar.`,
      hint: `Start at 100% (the full price) and subtract the discount: 100 - ${rate} = ?`,
    }),
  },
  {
    id: 'jacket-sale',
    build: (rate, base) => ({
      scenario: `A jacket is on sale: ${rate}% off the regular price of $${base}.`,
      wholeValue: base,
      wholeValueLabel: 'Original Price ($)',
      question: `What percent of the original price is the sale price? Place that percent on the bar.`,
      hint: `Sale price as a percent = 100% minus the discount percent.`,
    }),
  },
  {
    id: 'backpack-clearance',
    build: (rate, base) => ({
      scenario: `A $${base} backpack is on clearance — ${rate}% off.`,
      wholeValue: base,
      wholeValueLabel: 'Original Price ($)',
      question: `What percent of the original price remains after the discount?`,
      hint: `Subtract the discount from 100%. 100 - ${rate} = ?`,
    }),
  },
  {
    id: 'book-coupon',
    build: (rate, base) => ({
      scenario: `A bookstore has a ${rate}% off coupon on a $${base} book.`,
      wholeValue: base,
      wholeValueLabel: 'Original Price ($)',
      question: `What percent of the price will you pay with the coupon? Place that percent on the bar.`,
      hint: `If ${rate}% is removed, then 100% - ${rate}% remains.`,
    }),
  },
  {
    id: 'sneakers-markdown',
    build: (rate, base) => ({
      scenario: `Sneakers regularly cost $${base}. They are marked down ${rate}%.`,
      wholeValue: base,
      wholeValueLabel: 'Original Price ($)',
      question: `What percent of the original price is the new price? Show it on the bar.`,
      hint: `New price percent = 100% - markdown percent.`,
    }),
  },
  {
    id: 'tablet-discount',
    build: (rate, base) => ({
      scenario: `A tablet listed at $${base} has a ${rate}% in-store discount.`,
      wholeValue: base,
      wholeValueLabel: 'Original Price ($)',
      question: `What percent of the list price will you actually pay? Place that on the bar.`,
      hint: `Take 100% and remove the discount: 100 - ${rate}.`,
    }),
  },
];

const SUBTRACTION_RATES = [10, 15, 20, 25, 30, 40, 50, 60] as const;
const SUBTRACTION_BASES = [20, 30, 40, 50, 60, 80, 100, 120] as const;

function buildSubtraction(): ChallengeSpec {
  const template = pick(SUBTRACTION_TEMPLATES);
  const rate = pick(SUBTRACTION_RATES);
  const base = pick(SUBTRACTION_BASES);
  const partial = template.build(rate, base);
  const remainingPercent = 100 - rate;
  const finalValue = (base * remainingPercent) / 100;
  return {
    ...partial,
    targetPercent: remainingPercent,
    context: {
      problemType: 'subtraction',
      initialValue: base,
      changeRate: -rate,
      discountFactor: remainingPercent / 100,
      finalValue,
    },
  };
}

// -- Addition mode pool --------------------------------------------------------

interface AdditionTemplate {
  id: string;
  build: (rate: number, base: number) => Omit<ChallengeSpec, 'targetPercent' | 'context'>;
}

const ADDITION_TEMPLATES: readonly AdditionTemplate[] = [
  {
    id: 'sales-tax',
    build: (rate, base) => ({
      scenario: `You are buying a $${base} item. The sales tax in your state is ${rate}%.`,
      wholeValue: base,
      wholeValueLabel: 'Purchase Price ($)',
      question: `What percent IS the sales tax? Place that percent on the bar.`,
      hint: `The tax rate is given right in the scenario — that is what you are placing.`,
    }),
  },
  {
    id: 'restaurant-tip',
    build: (rate, base) => ({
      scenario: `Your restaurant bill is $${base}. You decide to leave a ${rate}% tip.`,
      wholeValue: base,
      wholeValueLabel: 'Bill ($)',
      question: `What percent of the bill IS the tip? Show it on the bar.`,
      hint: `Tip percent = the rate stated in the problem.`,
    }),
  },
  {
    id: 'store-markup',
    build: (rate, base) => ({
      scenario: `A store buys an item for $${base} and adds a ${rate}% markup.`,
      wholeValue: base,
      wholeValueLabel: 'Cost ($)',
      question: `What percent IS the markup? Place it on the bar.`,
      hint: `Markup percent = the rate stated in the scenario.`,
    }),
  },
  {
    id: 'service-charge',
    build: (rate, base) => ({
      scenario: `A $${base} hotel bill has a ${rate}% service charge added.`,
      wholeValue: base,
      wholeValueLabel: 'Bill ($)',
      question: `What percent IS the service charge? Show it on the bar.`,
      hint: `The service charge percent is stated in the scenario.`,
    }),
  },
  {
    id: 'delivery-fee',
    build: (rate, base) => ({
      scenario: `An online order of $${base} adds a ${rate}% delivery fee.`,
      wholeValue: base,
      wholeValueLabel: 'Order ($)',
      question: `What percent IS the delivery fee? Place that percent on the bar.`,
      hint: `Read the scenario — the delivery fee percent is given.`,
    }),
  },
  {
    id: 'commission',
    build: (rate, base) => ({
      scenario: `A salesperson earns a ${rate}% commission on a $${base} sale.`,
      wholeValue: base,
      wholeValueLabel: 'Sale Price ($)',
      question: `What percent IS the commission? Show it on the bar.`,
      hint: `The commission rate is given right in the problem.`,
    }),
  },
];

const ADDITION_RATES = [5, 6, 7, 8, 10, 12, 15, 18, 20, 25] as const;
const ADDITION_BASES = [20, 30, 40, 50, 60, 80, 100] as const;

function buildAddition(): ChallengeSpec {
  const template = pick(ADDITION_TEMPLATES);
  const rate = pick(ADDITION_RATES);
  const base = pick(ADDITION_BASES);
  const partial = template.build(rate, base);
  const finalValue = (base * (100 + rate)) / 100;
  return {
    ...partial,
    targetPercent: rate,
    context: {
      problemType: 'addition',
      initialValue: base,
      changeRate: rate,
      discountFactor: (100 + rate) / 100,
      finalValue,
    },
  };
}

// -- Comparison mode pool ------------------------------------------------------

interface ComparisonTemplate {
  id: string;
  build: (rateA: number, rateB: number) => Omit<ChallengeSpec, 'targetPercent' | 'context'>;
}

const COMPARISON_TEMPLATES: readonly ComparisonTemplate[] = [
  {
    id: 'stores',
    build: (rateA, rateB) => ({
      scenario: `Store A is offering ${rateA}% off everything. Store B is offering ${rateB}% off everything.`,
      wholeValue: 100,
      wholeValueLabel: 'Reference (100%)',
      question: `Which store has the larger discount? Place the LARGER percent on the bar.`,
      hint: `Compare ${rateA} and ${rateB}. Place the bigger number.`,
    }),
  },
  {
    id: 'attendance',
    build: (rateA, rateB) => ({
      scenario: `School X reported ${rateA}% attendance today. School Y reported ${rateB}% attendance.`,
      wholeValue: 100,
      wholeValueLabel: 'Reference (100%)',
      question: `Which school had higher attendance? Place that percent on the bar.`,
      hint: `Pick the larger of ${rateA} and ${rateB}.`,
    }),
  },
  {
    id: 'battery',
    build: (rateA, rateB) => ({
      scenario: `Phone A's battery is at ${rateA}%. Phone B's battery is at ${rateB}%.`,
      wholeValue: 100,
      wholeValueLabel: 'Reference (100%)',
      question: `Which phone has more battery left? Place that percent on the bar.`,
      hint: `Whichever number is bigger is the larger battery percent.`,
    }),
  },
  {
    id: 'reviews',
    build: (rateA, rateB) => ({
      scenario: `Movie A scored ${rateA}% on a review site. Movie B scored ${rateB}%.`,
      wholeValue: 100,
      wholeValueLabel: 'Reference (100%)',
      question: `Which movie has the better score? Place that percent on the bar.`,
      hint: `Place the larger of ${rateA} and ${rateB}.`,
    }),
  },
  {
    id: 'tip-comparison',
    build: (rateA, rateB) => ({
      scenario: `One restaurant suggests a ${rateA}% tip. Another suggests ${rateB}%.`,
      wholeValue: 100,
      wholeValueLabel: 'Reference (100%)',
      question: `Which suggested tip is larger? Place that percent on the bar.`,
      hint: `Compare the two rates and place the bigger one.`,
    }),
  },
];

const COMPARISON_RATES = [10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 75, 80] as const;

function buildComparison(): ChallengeSpec {
  const template = pick(COMPARISON_TEMPLATES);
  // Pick two distinct rates from the pool — ensure rateA != rateB.
  let rateA = pick(COMPARISON_RATES);
  let rateB = pick(COMPARISON_RATES);
  while (rateB === rateA) rateB = pick(COMPARISON_RATES);
  const partial = template.build(rateA, rateB);
  const target = Math.max(rateA, rateB);
  return {
    ...partial,
    targetPercent: target,
    context: {
      problemType: 'comparison',
      initialValue: Math.min(rateA, rateB),
      changeRate: target - Math.min(rateA, rateB),
      discountFactor: target / 100,
      finalValue: target,
    },
  };
}

// -- Pool service entry --------------------------------------------------------

const BUILDERS: Record<ChallengeType, () => ChallengeSpec> = {
  direct: buildDirect,
  subtraction: buildSubtraction,
  addition: buildAddition,
  comparison: buildComparison,
};

function challengeKey(spec: ChallengeSpec): string {
  return `${spec.context.problemType}|${spec.targetPercent}|${spec.wholeValue}|${spec.scenario.slice(0, 32)}`;
}

export function selectPercentBarChallenges(
  challengeType: ChallengeType,
  count: number = DEFAULT_INSTANCE_COUNT,
): PercentBarChallenge[] {
  const target = Math.max(1, Math.min(MAX_INSTANCE_COUNT, count));
  const builder = BUILDERS[challengeType];
  const seen = new Set<string>();
  const specs: ChallengeSpec[] = [];

  for (let i = 0; i < target * 6 && specs.length < target; i++) {
    const spec = builder();
    const key = challengeKey(spec);
    if (seen.has(key)) continue;
    seen.add(key);
    specs.push(spec);
  }

  // Fallback — if the pool can't produce N distinct, fill with possible repeats.
  while (specs.length < target) specs.push(builder());

  // Shuffle so order is not template-aligned.
  return shuffle(specs).map((spec, i) => ({
    id: `pb-${i + 1}`,
    type: challengeType,
    scenario: spec.scenario,
    wholeValue: spec.wholeValue,
    wholeValueLabel: spec.wholeValueLabel,
    question: spec.question,
    targetPercent: spec.targetPercent,
    hint: spec.hint,
    context: spec.context,
  }));
}

// ---------------------------------------------------------------------------
// Schema (wrapper metadata only — Gemini does NOT emit per-challenge scenarios)
// ---------------------------------------------------------------------------

const percentBarSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Title for the multi-challenge percent-bar session (e.g., 'Visualizing Percentages', 'Discounts and Sale Prices'). Do NOT name specific numbers — the session walks through several scenarios.",
    },
    description: {
      type: Type.STRING,
      description:
        "1-2 sentence educational description of what students will practice across the session.",
    },
    challengeType: {
      type: Type.STRING,
      enum: ["direct", "subtraction", "addition", "comparison"],
      description:
        "Difficulty tier of the session. The system uses this to build the per-challenge scenarios. All challenges in the session share this type.",
    },
  },
  required: ["title", "description", "challengeType"],
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generatePercentBar = async (
  topic: string,
  gradeLevel: string,
  config?: {
    /** How many challenges in this session. Default 4, max 6. */
    instanceCount?: number;
    showPercentLabels?: boolean;
    showValueLabels?: boolean;
    benchmarkLines?: number[];
    doubleBar?: boolean;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
  }
): Promise<PercentBarData> => {
  // Resolve eval mode from catalog (single source of truth)
  const evalConstraint = resolveEvalModeConstraint(
    'percent-bar',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('PercentBar', config?.targetEvalMode, evalConstraint);

  // Constrain schema when eval mode is active
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(percentBarSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : percentBarSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const prompt = `
Create the wrapper metadata for a multi-challenge percent-bar session on "${topic}" for ${gradeLevel} students.

CONTEXT:
- A percent-bar session contains 3-6 separate percent problems of the same difficulty tier.
- The system has ALREADY pre-built each scenario (wholeValue, question, targetPercent) — you do NOT pick numbers, scenarios, or questions.
- Your job is only to write the session-level title and description, and to set the challengeType.

${challengeTypeSection}

REQUIREMENTS:
1. Write a clear, student-friendly title for the whole session. Do NOT name any specific scenario — the session walks through several.
2. Provide a 1-2 sentence educational description of what students will practice across the session.
3. Set challengeType to the correct difficulty tier (matches the eval mode constraint above).

Return ONLY the wrapper fields described above.
`;

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

  const wrapper = result.text ? JSON.parse(result.text) : null;
  if (!wrapper) {
    throw new Error('No valid percent-bar wrapper returned from Gemini API');
  }

  // Validate challengeType
  const validTypes: ChallengeType[] = ['direct', 'subtraction', 'addition', 'comparison'];
  let challengeType: ChallengeType = validTypes.includes(wrapper.challengeType as ChallengeType)
    ? (wrapper.challengeType as ChallengeType)
    : (evalConstraint?.allowedTypes[0] as ChallengeType) ?? 'direct';
  if (!validTypes.includes(challengeType)) challengeType = 'direct';

  // Build challenges from the local pool service
  const challenges = selectPercentBarChallenges(challengeType, config?.instanceCount);

  const data: PercentBarData = {
    title: wrapper.title,
    description: wrapper.description,
    challenges,
    showPercentLabels: config?.showPercentLabels ?? true,
    showValueLabels: config?.showValueLabels ?? true,
    benchmarkLines: config?.benchmarkLines ?? [25, 50, 75],
    doubleBar: config?.doubleBar ?? false,
  };

  const summary = challenges
    .map((c) => `${c.targetPercent}%@${c.wholeValue}`)
    .join(', ');
  console.log(`[PercentBar] Final: challengeType=${challengeType}, instances=${challenges.length} [${summary}]`);

  return data;
};
