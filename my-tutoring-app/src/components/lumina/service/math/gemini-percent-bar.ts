import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  PercentBarData,
  PercentBarChallenge,
  PercentBarPlaceStep,
  PercentBarChoiceStep,
  PercentContext,
} from "../../primitives/visual-primitives/math/PercentBar";

// Generator-local step shapes carry BOTH hint variants; the explicit/strategy
// pick happens at build time (the component only ever sees a resolved `hint`).
type GenPlaceStep = PercentBarPlaceStep & { hintStrategy?: string };
type GenChoiceStep = PercentBarChoiceStep & { hintStrategy?: string };
type GenStep = GenPlaceStep | GenChoiceStep;
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
      `"addition": Tax/tip/markup, a TWO-STEP problem within each challenge. `
      + `Step 1 — place the added rate (the tip/tax/markup portion); the value readout shows it in dollars. `
      + `Step 2 — place the TOTAL = 100% + the rate on a bar that extends past 100% (value shows the dollar total). `
      + `"$40 bill, 10% tip" → step 1 = 10% ($4 tip), step 2 = 110% ($44 total). `
      + `Grade 6-7 focus.`,
    schemaDescription: "'addition' (two steps: added rate, then total = 100 + rate)",
  },
  comparison: {
    promptDoc:
      `"comparison": A MULTI-STEP shopping comparison within each challenge. Two goods, each with its own `
      + `price and discount. Step 1 — place good 1's sale price as a percent of its original (value shows the dollar price). `
      + `Step 2 — same for good 2. Step 3 — choose which is cheaper / more expensive. `
      + `Teaches that a bigger % discount is NOT always the cheaper price. Grade 7-8 focus.`,
    schemaDescription: "'comparison' (compute two sale prices, then choose cheaper/pricier)",
  },
};

// ---------------------------------------------------------------------------
// Support tiers (within-mode scaffolding axis — config.difficulty)
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/**
 * Bespoke support-lever set for percent-bar. Every field withdraws on-screen /
 * instructional help WITHOUT changing the target percent or whole magnitude.
 *  - showPercentLabels / showValueLabels / benchmarkLines / doubleBar — visual aids.
 *  - showCalculation — gates the LIVE `currentPercent% of whole = value` panel
 *    (a leak: at hard it would let the student dial the value, not the percent).
 *  - rateClass — STRUCTURAL lever: 'benchmark' (25/50/75 only) vs 'any' (also
 *    10/30/40/60/70/90). SAME magnitude pool, harder placement. Code-enforced.
 *  - hintExplicitness — 'explicit' hints encode the answer ("slide to 70%",
 *    "100 - 30 = ?"); 'strategy' hints name only the approach, no target number.
 */
interface SupportScaffold {
  showPercentLabels: boolean;
  showValueLabels: boolean;
  benchmarkLines: number[];
  doubleBar: boolean;
  showCalculation: boolean;
  rateClass: 'benchmark' | 'any';
  hintExplicitness: 'explicit' | 'strategy';
  promptLines: string[];
}

const BENCHMARK_RATES = [25, 50, 75] as const;

/**
 * easy→hard scaffolding gradient, per pinned challenge type.
 * identify_percent (direct) is the recognition mode: full aids + double bar +
 * calc panel + benchmark-only rates at easy, everything withdrawn at hard.
 * find_part/find_whole/convert: aids on + explicit hint → aids off, strategy hint.
 * INVARIANT: never changes the target percent or whole magnitude — rateClass
 * picks from the SAME pool (benchmark subset vs full), not a bigger number.
 */
function resolveSupportStructure(pinnedType: ChallengeType, tier: SupportTier): SupportScaffold {
  const guardrail =
    'This tier sets the SCAFFOLDING LEVEL only — it never changes the target percent or the whole-value magnitude.';

  if (pinnedType === 'direct') {
    // Recognition / placement mode — the benchmark-vs-any rate lever lives here.
    switch (tier) {
      case 'easy':
        return {
          showPercentLabels: true, showValueLabels: true,
          benchmarkLines: [...BENCHMARK_RATES], doubleBar: true,
          showCalculation: true, rateClass: 'benchmark', hintExplicitness: 'explicit',
          promptLines: [guardrail, 'Easy: all labels, benchmark guide lines, the value bar, and the calculation panel are shown; hints may name the exact percent. Targets land on benchmark percents (25/50/75).'],
        };
      case 'medium':
        return {
          showPercentLabels: true, showValueLabels: true,
          benchmarkLines: [50], doubleBar: false,
          showCalculation: true, rateClass: 'any', hintExplicitness: 'explicit',
          promptLines: [guardrail, 'Medium: percent + value labels and the calculation panel stay on, but only the 50% guide line remains and the value bar is hidden. Hints may still reference the target.'],
        };
      case 'hard':
      default:
        return {
          showPercentLabels: false, showValueLabels: false,
          benchmarkLines: [], doubleBar: false,
          showCalculation: false, rateClass: 'any', hintExplicitness: 'strategy',
          promptLines: [guardrail, 'Hard: NO percent labels, NO value labels, NO benchmark lines, NO calculation panel. The student must place the percent unaided. Hints name only the strategy — never the target percent or the arithmetic.'],
        };
    }
  }

  // subtraction / addition / comparison — multi-step word problems.
  switch (tier) {
    case 'easy':
      return {
        showPercentLabels: true, showValueLabels: true,
        benchmarkLines: [...BENCHMARK_RATES], doubleBar: false,
        showCalculation: true, rateClass: 'any', hintExplicitness: 'explicit',
        promptLines: [guardrail, 'Easy: all on-screen aids (labels, benchmark lines, calculation panel) are shown and the hint spells out the operation (e.g. "100 - discount", "the rate is stated").'],
      };
    case 'medium':
      return {
        showPercentLabels: true, showValueLabels: true,
        benchmarkLines: [50], doubleBar: false,
        showCalculation: true, rateClass: 'any', hintExplicitness: 'explicit',
        promptLines: [guardrail, 'Medium: labels and the calculation panel stay on with a single 50% guide line; the hint still names the operation.'],
      };
    case 'hard':
    default:
      return {
        showPercentLabels: false, showValueLabels: false,
        benchmarkLines: [], doubleBar: false,
        showCalculation: false, rateClass: 'any', hintExplicitness: 'strategy',
        promptLines: [guardrail, 'Hard: NO labels, NO benchmark lines, NO calculation panel. The hint names only the strategy (e.g. "what percent is left over?") — never the target number or the arithmetic.'],
      };
  }
}

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
  /** Bar scale max (default 100). Addition "total" mode extends past 100%. */
  maxPercent?: number;
  /** Ordered sub-steps for multi-step modes (addition, comparison). */
  steps?: GenStep[];
  /** Explicit hint (may encode the target/arithmetic) — used at easy/medium. */
  hint: string;
  /** Strategy-only hint (no target number, no answer arithmetic) — used at hard. */
  hintStrategy: string;
  context: PercentContext;
}

/** A built scenario carries BOTH hint variants so the tier can pick at the end. */
type ScenarioParts = Omit<ChallengeSpec, 'targetPercent' | 'context' | 'hint'> & {
  /** Explicit hint — may encode the target number / arithmetic. */
  hintExplicit: string;
  /** Strategy hint — names the approach only, no target number, no answer arithmetic. */
  hintStrategy: string;
};

// -- Direct mode pool ----------------------------------------------------------

interface DirectTemplate {
  id: string;
  build: (rate: number, base: number) => ScenarioParts;
}

const DIRECT_TEMPLATES: readonly DirectTemplate[] = [
  {
    id: 'cookies',
    build: (rate, base) => ({
      scenario: `A batch of ${base} cookies is on the table.`,
      wholeValue: base,
      wholeValueLabel: 'Total Cookies',
      question: `Show the stated percent on the bar to mark that portion of the batch.`,
      hintExplicit: `${rate}% means ${rate} out of every 100 cookies. Slide the bar until it reads ${rate}%.`,
      hintStrategy: `The percent in the question tells you how far along the 0%–100% bar to slide.`,
    }),
  },
  {
    id: 'students',
    build: (rate, base) => ({
      scenario: `There are ${base} students in the class.`,
      wholeValue: base,
      wholeValueLabel: 'Total Students',
      question: `Show what the stated percent of the class looks like on the bar.`,
      hintExplicit: `Think of the bar as the whole class (100%). Where is ${rate}% of that?`,
      hintStrategy: `The bar is the whole class (100%). Place the part the question names.`,
    }),
  },
  {
    id: 'test-score',
    build: (rate, base) => ({
      scenario: `You took a ${base}-point test.`,
      wholeValue: base,
      wholeValueLabel: 'Total Points',
      question: `You scored the stated percent on the test. Show that percent on the bar.`,
      hintExplicit: `${rate}% of ${base} points — slide the bar to ${rate}%.`,
      hintStrategy: `Find the score percent in the question and place it on the bar.`,
    }),
  },
  {
    id: 'pages-read',
    build: (rate, base) => ({
      scenario: `Your book has ${base} pages.`,
      wholeValue: base,
      wholeValueLabel: 'Total Pages',
      question: `You have read the stated percent of the book so far. Show that percent on the bar.`,
      hintExplicit: `Slide the bar to ${rate}% — the value display tells you how many pages that is.`,
      hintStrategy: `Place the percent of the book you have read; the whole book is 100%.`,
    }),
  },
  {
    id: 'pizza-slices',
    build: (rate, base) => ({
      scenario: `A party platter has ${base} slices of pizza.`,
      wholeValue: base,
      wholeValueLabel: 'Total Slices',
      question: `The stated percent of the slices have been eaten. Show that percent on the bar.`,
      hintExplicit: `${rate}% out of the ${base} slices — slide the bar to ${rate}%.`,
      hintStrategy: `Place the percent of slices eaten; the full platter is 100%.`,
    }),
  },
  {
    id: 'jar-marbles',
    build: (rate, base) => ({
      scenario: `A jar holds ${base} marbles.`,
      wholeValue: base,
      wholeValueLabel: 'Total Marbles',
      question: `The stated percent of the marbles are blue. Show that percent on the bar.`,
      hintExplicit: `Where on the 0%–100% bar does ${rate}% sit?`,
      hintStrategy: `Place the percent of marbles that are blue on the 0%–100% bar.`,
    }),
  },
  {
    id: 'stickers',
    build: (rate, base) => ({
      scenario: `A sticker sheet has ${base} stickers.`,
      wholeValue: base,
      wholeValueLabel: 'Total Stickers',
      question: `You have already used the stated percent of them. Show that percent on the bar.`,
      hintExplicit: `${rate} out of every 100 stickers — that is where the bar should land.`,
      hintStrategy: `Place the percent of stickers you have used on the bar.`,
    }),
  },
];

const DIRECT_RATES = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90] as const;
const DIRECT_BASES = [20, 25, 40, 50, 60, 80, 100] as const;

/** Structural rate lever: benchmark = 25/50/75 only; any = full pool.
 *  SAME magnitude pool — benchmark is a subset, not smaller numbers. */
function pickRate(pool: readonly number[], rateClass: 'benchmark' | 'any'): number {
  if (rateClass === 'benchmark') {
    const bench = pool.filter((r) => (BENCHMARK_RATES as readonly number[]).includes(r));
    if (bench.length > 0) return pick(bench);
  }
  return pick(pool);
}

function buildDirect(rateClass: 'benchmark' | 'any' = 'any'): ChallengeSpec {
  const template = pick(DIRECT_TEMPLATES);
  const rate = pickRate(DIRECT_RATES, rateClass);
  const base = pick(DIRECT_BASES);
  const parts = template.build(rate, base);
  const { hintExplicit, hintStrategy, ...partial } = parts;
  const finalValue = (base * rate) / 100;
  return {
    ...partial,
    hint: hintExplicit,
    hintStrategy,
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
  build: (rate: number, base: number) => ScenarioParts;
}

const SUBTRACTION_TEMPLATES: readonly SubtractionTemplate[] = [
  {
    id: 'shirt-discount',
    build: (rate, base) => ({
      scenario: `A shirt costs $${base}. The store offers a ${rate}% discount.`,
      wholeValue: base,
      wholeValueLabel: 'Original Price ($)',
      question: `What percent of the original price do you still pay after the ${rate}% discount? Show that percent on the bar.`,
      hintExplicit: `Start at 100% (the full price) and subtract the discount: 100 - ${rate} = ?`,
      hintStrategy: `The full price is 100%. Take away the discount to find the percent you still pay.`,
    }),
  },
  {
    id: 'jacket-sale',
    build: (rate, base) => ({
      scenario: `A jacket is on sale: ${rate}% off the regular price of $${base}.`,
      wholeValue: base,
      wholeValueLabel: 'Original Price ($)',
      question: `What percent of the original price is the sale price? Place that percent on the bar.`,
      hintExplicit: `Sale price as a percent = 100% minus the discount percent.`,
      hintStrategy: `Begin from the whole (100%) and remove what is taken off.`,
    }),
  },
  {
    id: 'backpack-clearance',
    build: (rate, base) => ({
      scenario: `A $${base} backpack is on clearance — ${rate}% off.`,
      wholeValue: base,
      wholeValueLabel: 'Original Price ($)',
      question: `What percent of the original price remains after the discount?`,
      hintExplicit: `Subtract the discount from 100%. 100 - ${rate} = ?`,
      hintStrategy: `The whole is 100%; find what is left after the part is removed.`,
    }),
  },
  {
    id: 'book-coupon',
    build: (rate, base) => ({
      scenario: `A bookstore has a ${rate}% off coupon on a $${base} book.`,
      wholeValue: base,
      wholeValueLabel: 'Original Price ($)',
      question: `What percent of the price will you pay with the coupon? Place that percent on the bar.`,
      hintExplicit: `If ${rate}% is removed, then 100% - ${rate}% remains.`,
      hintStrategy: `Start from 100% and take away the part that is removed.`,
    }),
  },
  {
    id: 'sneakers-markdown',
    build: (rate, base) => ({
      scenario: `Sneakers regularly cost $${base}. They are marked down ${rate}%.`,
      wholeValue: base,
      wholeValueLabel: 'Original Price ($)',
      question: `What percent of the original price is the new price? Show it on the bar.`,
      hintExplicit: `New price percent = 100% - markdown percent.`,
      hintStrategy: `The original is 100%; remove the markdown to find what remains.`,
    }),
  },
  {
    id: 'tablet-discount',
    build: (rate, base) => ({
      scenario: `A tablet listed at $${base} has a ${rate}% in-store discount.`,
      wholeValue: base,
      wholeValueLabel: 'Original Price ($)',
      question: `What percent of the list price will you actually pay? Place that on the bar.`,
      hintExplicit: `Take 100% and remove the discount: 100 - ${rate}.`,
      hintStrategy: `Start at the whole price (100%) and subtract what is discounted.`,
    }),
  },
];

const SUBTRACTION_RATES = [10, 15, 20, 25, 30, 40, 50, 60] as const;
const SUBTRACTION_BASES = [20, 30, 40, 50, 60, 80, 100, 120] as const;

function buildSubtraction(): ChallengeSpec {
  const template = pick(SUBTRACTION_TEMPLATES);
  const rate = pick(SUBTRACTION_RATES);
  const base = pick(SUBTRACTION_BASES);
  const { hintExplicit, hintStrategy, ...partial } = template.build(rate, base);
  const remainingPercent = 100 - rate;
  const finalValue = (base * remainingPercent) / 100;
  return {
    ...partial,
    hint: hintExplicit,
    hintStrategy,
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

/** Addition templates supply only the framing nouns; the two-step prompts and
 *  hints are generated uniformly from them in buildAddition. */
interface AdditionTemplate {
  id: string;
  build: (rate: number, base: number) => {
    scenario: string;
    wholeValueLabel: string;
    /** Noun for the whole, used in prose ('bill', 'price', 'order'). */
    wholeNoun: string;
    /** Noun for the added part, used in prose ('tip', 'sales tax', 'markup'). */
    addedNoun: string;
    /** Short label for the value readout column ('Tip', 'Tax', 'Fee'). */
    addedShort: string;
  };
}

const ADDITION_TEMPLATES: readonly AdditionTemplate[] = [
  {
    id: 'sales-tax',
    build: (rate, base) => ({
      scenario: `You are buying a $${base} item. The sales tax in your state is ${rate}%.`,
      wholeValueLabel: 'Price ($)', wholeNoun: 'price', addedNoun: 'sales tax', addedShort: 'Tax',
    }),
  },
  {
    id: 'restaurant-tip',
    build: (rate, base) => ({
      scenario: `Your restaurant bill is $${base}. You decide to leave a ${rate}% tip.`,
      wholeValueLabel: 'Bill ($)', wholeNoun: 'bill', addedNoun: 'tip', addedShort: 'Tip',
    }),
  },
  {
    id: 'store-markup',
    build: (rate, base) => ({
      scenario: `A store buys an item for $${base} and adds a ${rate}% markup.`,
      wholeValueLabel: 'Cost ($)', wholeNoun: 'cost', addedNoun: 'markup', addedShort: 'Markup',
    }),
  },
  {
    id: 'service-charge',
    build: (rate, base) => ({
      scenario: `A $${base} hotel bill has a ${rate}% service charge added.`,
      wholeValueLabel: 'Bill ($)', wholeNoun: 'bill', addedNoun: 'service charge', addedShort: 'Charge',
    }),
  },
  {
    id: 'delivery-fee',
    build: (rate, base) => ({
      scenario: `An online order of $${base} adds a ${rate}% delivery fee.`,
      wholeValueLabel: 'Order ($)', wholeNoun: 'order', addedNoun: 'delivery fee', addedShort: 'Fee',
    }),
  },
  {
    id: 'ticket-fee',
    build: (rate, base) => ({
      scenario: `A concert ticket costs $${base}. A ${rate}% booking fee is added.`,
      wholeValueLabel: 'Ticket ($)', wholeNoun: 'ticket price', addedNoun: 'booking fee', addedShort: 'Fee',
    }),
  },
];

const ADDITION_RATES = [5, 6, 7, 8, 10, 12, 15, 18, 20, 25] as const;
const ADDITION_BASES = [20, 30, 40, 50, 60, 80, 100] as const;
/** Bar scale for the TOTAL step: the total (100 + rate, ≤125 here) needs headroom
 *  above 100% so the "added on top" overshoot is visible. */
const ADDITION_BAR_MAX = 150;

function buildAddition(): ChallengeSpec {
  const template = pick(ADDITION_TEMPLATES);
  const rate = pick(ADDITION_RATES);
  const base = pick(ADDITION_BASES);
  const { scenario, wholeValueLabel, wholeNoun, addedNoun, addedShort } = template.build(rate, base);
  const totalPercent = 100 + rate;
  const totalValue = (base * totalPercent) / 100;

  const steps: GenStep[] = [
    {
      kind: 'place',
      prompt: `Step 1 — the ${addedNoun}: what percent of the ${wholeNoun} is the ${addedNoun}? Place it on the bar.`,
      wholeValue: base,
      wholeValueLabel,
      targetPercent: rate,
      maxPercent: 100,
      valueLabel: `${addedShort} ($)`,
      recapLabel: addedShort,
      hint: `The ${addedNoun} rate is stated in the scenario — ${rate}%. Place ${rate}%; the value shows it in dollars.`,
      hintStrategy: `The ${addedNoun} rate is named in the scenario. Place that percent.`,
    },
    {
      kind: 'place',
      prompt: `Step 2 — the total: including the ${addedNoun}, the total is what percent of the ${wholeNoun}? Place the TOTAL on the bar.`,
      wholeValue: base,
      wholeValueLabel,
      targetPercent: totalPercent,
      maxPercent: ADDITION_BAR_MAX,
      valueLabel: 'Total ($)',
      hint: `Add the ${addedNoun} to the whole: 100% + ${rate}% = ${totalPercent}%.`,
      hintStrategy: `The ${addedNoun} adds on top of the ${wholeNoun} (100%). The total lands past 100%.`,
    },
  ];

  return {
    scenario,
    wholeValue: base,
    wholeValueLabel,
    question: steps[0].prompt,
    targetPercent: totalPercent,
    maxPercent: ADDITION_BAR_MAX,
    steps,
    hint: steps[0].hint,
    hintStrategy: (steps[0] as GenPlaceStep).hintStrategy!,
    context: {
      problemType: 'addition',
      initialValue: base,
      changeRate: rate,
      discountFactor: totalPercent / 100,
      finalValue: totalValue,
    },
  };
}

// -- Comparison mode pool ------------------------------------------------------

/** Two-good shopping contexts: same item, two competing sellers. */
const COMPARISON_CONTEXTS: readonly { item: string; a: string; b: string }[] = [
  { item: 'jeans', a: 'Store A', b: 'Store B' },
  { item: 'sneakers', a: 'SneakerHub', b: 'FootZone' },
  { item: 'a backpack', a: 'Pack It', b: 'Bag World' },
  { item: 'headphones', a: 'AudioMart', b: 'SoundCity' },
  { item: 'a jacket', a: 'Outfitters', b: 'StyleCo' },
];

const COMPARISON_BASES = [20, 30, 40, 50, 60, 80] as const;
const COMPARISON_DISCOUNTS = [10, 20, 25, 30, 40, 50] as const;

/**
 * Multi-step shopping comparison. Each good has its OWN price and discount, so a
 * bigger % off is not always the cheaper final price — the choice step makes the
 * student compute both sale prices before deciding.
 */
function buildComparison(): ChallengeSpec {
  const ctx = pick(COMPARISON_CONTEXTS);
  const baseA = pick(COMPARISON_BASES);
  const discA = pick(COMPARISON_DISCOUNTS);
  let baseB = pick(COMPARISON_BASES);
  let discB = pick(COMPARISON_DISCOUNTS);

  const priceOf = (b: number, d: number) => (b * (100 - d)) / 100;
  let priceA = priceOf(baseA, discA);
  let priceB = priceOf(baseB, discB);
  // Re-roll good B until the two sale prices are clearly distinct AND the bases
  // differ (so the discounts alone don't determine the answer).
  let guard = 0;
  while ((Math.abs(priceA - priceB) < 1 || baseB === baseA) && guard < 40) {
    baseB = pick(COMPARISON_BASES);
    discB = pick(COMPARISON_DISCOUNTS);
    priceB = priceOf(baseB, discB);
    guard++;
  }

  const finalPctA = 100 - discA;
  const finalPctB = 100 - discB;
  const askCheaper = Math.random() < 0.5;
  const cheaperIsA = priceA < priceB;
  const correctIsA = askCheaper ? cheaperIsA : !cheaperIsA;

  const scenario =
    `${ctx.a} sells ${ctx.item} for $${baseA} at ${discA}% off. `
    + `${ctx.b} sells the same ${ctx.item} for $${baseB} at ${discB}% off.`;

  const steps: GenStep[] = [
    {
      kind: 'place',
      prompt: `Step 1 — ${ctx.a}: place the sale price as a percent of its original ($${baseA}).`,
      wholeValue: baseA,
      wholeValueLabel: `${ctx.a} Original ($)`,
      targetPercent: finalPctA,
      maxPercent: 100,
      valueLabel: 'Sale Price ($)',
      recapLabel: ctx.a,
      hint: `${discA}% off means you pay 100% − ${discA}% = ${finalPctA}%. The value shows the sale price.`,
      hintStrategy: `A ${discA}% discount means you still pay the rest of the 100%. Place what is left.`,
    },
    {
      kind: 'place',
      prompt: `Step 2 — ${ctx.b}: place the sale price as a percent of its original ($${baseB}).`,
      wholeValue: baseB,
      wholeValueLabel: `${ctx.b} Original ($)`,
      targetPercent: finalPctB,
      maxPercent: 100,
      valueLabel: 'Sale Price ($)',
      recapLabel: ctx.b,
      hint: `${discB}% off means you pay 100% − ${discB}% = ${finalPctB}%. The value shows the sale price.`,
      hintStrategy: `Take the discount off 100% to find the percent of the price you pay.`,
    },
    {
      kind: 'choice',
      prompt: `Step 3 — which is ${askCheaper ? 'cheaper' : 'more expensive'}?`,
      options: [
        { id: 'A', label: ctx.a, sublabel: `$${priceA.toFixed(2)}` },
        { id: 'B', label: ctx.b, sublabel: `$${priceB.toFixed(2)}` },
      ],
      correctOptionId: correctIsA ? 'A' : 'B',
      hint: `Compare the two sale prices you found. ${askCheaper ? 'The smaller price is cheaper' : 'The larger price costs more'} — a bigger % off is not always the better deal.`,
      hintStrategy: `Look at the two prices you computed, not the discount percents. ${askCheaper ? 'Smaller price wins' : 'Larger price costs more'}.`,
    },
  ];

  return {
    scenario,
    wholeValue: baseA,
    wholeValueLabel: `${ctx.a} Price ($)`,
    question: steps[0].prompt,
    targetPercent: correctIsA ? finalPctA : finalPctB,
    steps,
    hint: steps[0].hint,
    hintStrategy: (steps[0] as GenPlaceStep).hintStrategy!,
    context: {
      problemType: 'comparison',
      initialValue: Math.min(priceA, priceB),
      changeRate: Math.abs(priceA - priceB),
      discountFactor: (correctIsA ? finalPctA : finalPctB) / 100,
      finalValue: correctIsA ? priceA : priceB,
    },
  };
}

// -- Pool service entry --------------------------------------------------------

/** rateClass only reaches `direct` (the only mode with the benchmark-vs-any
 *  structural lever); the others ignore it. */
const BUILDERS: Record<ChallengeType, (rateClass: 'benchmark' | 'any') => ChallengeSpec> = {
  direct: (rateClass) => buildDirect(rateClass),
  subtraction: () => buildSubtraction(),
  addition: () => buildAddition(),
  comparison: () => buildComparison(),
};

function challengeKey(spec: ChallengeSpec): string {
  return `${spec.context.problemType}|${spec.targetPercent}|${spec.wholeValue}|${spec.scenario.slice(0, 32)}`;
}

export function selectPercentBarChallenges(
  challengeType: ChallengeType,
  count: number = DEFAULT_INSTANCE_COUNT,
  opts?: { rateClass?: 'benchmark' | 'any'; hintExplicitness?: 'explicit' | 'strategy' },
): PercentBarChallenge[] {
  const target = Math.max(1, Math.min(MAX_INSTANCE_COUNT, count));
  const rateClass = opts?.rateClass ?? 'any';
  const useStrategyHint = opts?.hintExplicitness === 'strategy';
  const builder = BUILDERS[challengeType];
  const seen = new Set<string>();
  const specs: ChallengeSpec[] = [];

  for (let i = 0; i < target * 6 && specs.length < target; i++) {
    const spec = builder(rateClass);
    const key = challengeKey(spec);
    if (seen.has(key)) continue;
    seen.add(key);
    specs.push(spec);
  }

  // Fallback — if the pool can't produce N distinct, fill with possible repeats.
  while (specs.length < target) specs.push(builder(rateClass));

  // Shuffle so order is not template-aligned.
  return shuffle(specs).map((spec, i) => {
    // Resolve each step's hint to explicit/strategy, then strip the build-time
    // hintStrategy so the component only sees the canonical PercentBarStep shape.
    const resolvedSteps = spec.steps?.map((s) => {
      const { hintStrategy, ...rest } = s;
      return useStrategyHint && hintStrategy ? { ...rest, hint: hintStrategy } : rest;
    });
    return {
      id: `pb-${i + 1}`,
      type: challengeType,
      scenario: spec.scenario,
      wholeValue: spec.wholeValue,
      wholeValueLabel: spec.wholeValueLabel,
      question: spec.question,
      targetPercent: spec.targetPercent,
      ...(spec.maxPercent ? { maxPercent: spec.maxPercent } : {}),
      ...(resolvedSteps ? { steps: resolvedSteps } : {}),
      // Strategy-only hint at hard (no target number / no answer arithmetic).
      hint: useStrategyHint ? spec.hintStrategy : spec.hint,
      context: spec.context,
    };
  });
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

type PercentBarConfig = {
  /** How many challenges in this session. Default 4, max 6. */
  instanceCount?: number;
  showPercentLabels?: boolean;
  showValueLabels?: boolean;
  benchmarkLines?: number[];
  doubleBar?: boolean;
  /** Target eval mode from the IRT calibration system. */
  targetEvalMode?: string;
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second axis of the two-field contract: targetEvalMode = which skill,
   * difficulty = how much on-screen scaffolding within it. NEVER changes the
   * target percent or whole-value magnitude (the benchmark-vs-any rate lever
   * draws from the SAME pool, so it is structural, not magnitude).
   */
  difficulty?: string;
};

export const generatePercentBar = async (
  ctx: GenerationContext,
): Promise<PercentBarData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as PercentBarConfig;
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

  // --- Support tier (within-mode scaffolding axis) ---
  const supportTier = normalizeSupportTier(config?.difficulty); // STUDENT's tier — DRIVES application
  // pinnedType is ONLY for the prompt tone (single-mode sessions describe one mode to the LLM).
  const pinnedType =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as ChallengeType)
      : undefined;
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier) : null; // tone only — NOT the application
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  const prompt = `
Create the wrapper metadata for a multi-challenge percent-bar session on "${topic}" for ${gradeLevel} students.

CONTEXT:
- A percent-bar session contains 3-6 separate percent problems of the same difficulty tier.
- The system has ALREADY pre-built each scenario (wholeValue, question, targetPercent) — you do NOT pick numbers, scenarios, or questions.
- Your job is only to write the session-level title and description, and to set the challengeType.

${challengeTypeSection}
${tierSection}
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

  // Resolve the support scaffold for this session's pinned type (content-affecting
  // levers — rateClass + hint explicitness — must be set at build time).
  const sessionScaffold = supportTier
    ? resolveSupportStructure(challengeType, supportTier)
    : null;

  // Build challenges from the local pool service
  const challenges = selectPercentBarChallenges(challengeType, config?.instanceCount, sessionScaffold
    ? { rateClass: sessionScaffold.rateClass, hintExplicitness: sessionScaffold.hintExplicitness }
    : undefined);

  const data: PercentBarData = {
    title: wrapper.title,
    description: wrapper.description,
    challenges,
    showPercentLabels: config?.showPercentLabels ?? true,
    showValueLabels: config?.showValueLabels ?? true,
    benchmarkLines: config?.benchmarkLines ?? [25, 50, 75],
    doubleBar: config?.doubleBar ?? false,
    // showCalculation defaults to true (current behavior); the tier withdraws it at hard.
    showCalculation: true,
  };

  // --- Apply support tier deterministically (AFTER defaults, before return) ---
  // Gate ONLY on a tier being present. The visual levers override the manifest's
  // explicit config so a hard tier genuinely withdraws aids. Magnitude untouched.
  if (supportTier && sessionScaffold) {
    data.showPercentLabels = sessionScaffold.showPercentLabels;
    data.showValueLabels = sessionScaffold.showValueLabels;
    data.benchmarkLines = sessionScaffold.benchmarkLines;
    data.doubleBar = sessionScaffold.doubleBar;
    data.showCalculation = sessionScaffold.showCalculation;
    data.supportTier = supportTier;
    console.log(
      `[PercentBar] Support tier "${supportTier}" applied (${pinnedType ? `single-mode ${pinnedType}` : `type ${challengeType}`}): `
      + `labels=${sessionScaffold.showPercentLabels}/${sessionScaffold.showValueLabels} benchmarks=[${sessionScaffold.benchmarkLines.join(',')}] `
      + `doubleBar=${sessionScaffold.doubleBar} calc=${sessionScaffold.showCalculation} rateClass=${sessionScaffold.rateClass} hint=${sessionScaffold.hintExplicitness}`,
    );
  }

  const summary = challenges
    .map((c) => `${c.targetPercent}%@${c.wholeValue}`)
    .join(', ');
  console.log(`[PercentBar] Final: challengeType=${challengeType}, instances=${challenges.length} [${summary}]`);

  return data;
};
