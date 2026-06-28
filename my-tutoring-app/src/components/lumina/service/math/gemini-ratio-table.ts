import { Type, Schema } from "@google/genai";
import { RatioTableData, RatioTableChallenge } from "../../primitives/visual-primitives/math/RatioTable";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import { buildScopePromptSection } from "../scopeContext";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'build-ratio': {
    promptDoc:
      `"build-ratio": Student constructs an equivalent ratio using a slider. `
      + `Give base ratio and target; student adjusts multiplier to reach the target scaled value. `
      + `Example: baseRatio [5, 20], targetMultiplier 4 → "Build a ratio equivalent to 5:20 that gives 80."`,
    schemaDescription: "'build-ratio' (construct equivalent ratio)",
  },
  'missing-value': {
    promptDoc:
      `"missing-value": Student finds a hidden value in a scaled ratio. `
      + `Set hiddenValue to 'scaled-first' or 'scaled-second'. `
      + `Example: baseRatio [3, 36], targetMultiplier 2, hiddenValue 'scaled-second' → "How many cookies from 6 cups?" (Answer: 72).`,
    schemaDescription: "'missing-value' (find hidden scaled value)",
  },
  'find-multiplier': {
    promptDoc:
      `"find-multiplier": Student determines the scaling factor between base and scaled ratios. `
      + `Give both base and scaled values; student finds the multiplier. `
      + `Example: baseRatio [4, 12], targetMultiplier 3 → "You used 12 eggs, what multiplier did you use?"`,
    schemaDescription: "'find-multiplier' (determine scaling factor)",
  },
  'unit-rate': {
    promptDoc:
      `"unit-rate": Student calculates and applies the unit rate (rate per 1 unit). `
      + `Focus on division to find rate per 1. `
      + `Example: baseRatio [6, 48], targetMultiplier 1 → "If 6 notebooks cost $48, what is the cost per notebook?"`,
    schemaDescription: "'unit-rate' (calculate and apply unit rate)",
  },
};

type ChallengeType = 'missing-value' | 'find-multiplier' | 'build-ratio' | 'unit-rate';

// ---------------------------------------------------------------------------
// Within-mode difficulty = structural SUPPORT tier (config.difficulty)
// ---------------------------------------------------------------------------
// The two-field contract: config.targetEvalMode says WHICH skill (task identity,
// matched to the objective by the manifest); config.difficulty says how much
// on-workspace SUPPORT the student gets while doing it ('easy' = max scaffolding,
// 'hard' = min). It NEVER changes the ratio numbers/magnitude — the per-mode
// pedagogical scope owns those. A harder tier means LESS help (no unit-rate banner,
// no bar chart, terser division hints), never bigger/different numbers.
// See memory: structural-difficulty-not-numeric.

type SupportTier = 'easy' | 'medium' | 'hard';

const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/**
 * Read the manifest's support tier. The manifest schema enum-constrains
 * config.difficulty to exactly these values, so this is a STRICT lookup.
 * Unknown/absent → null (no tier applied; defaults stand).
 */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

interface SupportScaffold {
  /** The always-on Unit Rate banner. For non-unit-rate modes it prints
   *  baseRatio[1]/baseRatio[0] verbatim — i.e. it HANDS the answer to
   *  find-multiplier/missing-value in one step. Withdraw it at hard. */
  showUnitRate: boolean;
  /** The proportional bar chart — a perception aid for scaling. Withdraw at hard. */
  showBarChart: boolean;
  /** How explicit the hint ladder may be. 'verbose' may state the unit rate
   *  number; 'terse' may name the strategy but NEVER the unit-rate value. */
  hintExplicitness: 'verbose' | 'standard' | 'terse';
  /** Prompt instruction tone for the LLM (scaffolding level only). */
  instructionTone: 'guided' | 'standard' | 'bare';
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-workspace support structure for a tier on a pinned challenge
 * type. Support is withdrawn as the tier hardens; the lines reframe the SAME
 * task with less scaffolding — never a different task, never different numbers.
 *
 * The unit-rate B÷A framing is the TASK IDENTITY of unit-rate and is NEVER
 * removed — even at hard the division prompt stays; the tier only minimizes the
 * verbose hint around it.
 */
function resolveSupportStructure(pinnedType: ChallengeType, tier: SupportTier): SupportScaffold {
  // Banner: ON for forward-derivation modes only at easy; OFF at hard so it can't
  // hand over the unit rate. For build-ratio it's a self-check aid (on easy).
  const showUnitRate =
    pinnedType === 'unit-rate'
      ? false // unit-rate has its own B÷A display; the banner is redundant/leaky here
      : pinnedType === 'build-ratio'
        ? tier === 'easy'
        : tier === 'easy'; // missing-value / find-multiplier: easy only
  const showBarChart =
    pinnedType === 'unit-rate'
      ? tier !== 'hard'
      : pinnedType === 'build-ratio'
        ? tier !== 'hard' // bar on easy+medium, numeric slider readout only at hard
        : pinnedType === 'find-multiplier'
          ? tier === 'easy' // bar on at easy only (÷ cue), off after
          : tier === 'easy'; // missing-value: bar on at easy only
  const hintExplicitness: SupportScaffold['hintExplicitness'] =
    tier === 'easy' ? 'verbose' : tier === 'medium' ? 'standard' : 'terse';
  const instructionTone: SupportScaffold['instructionTone'] =
    tier === 'easy' ? 'guided' : tier === 'medium' ? 'standard' : 'bare';

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-workspace SCAFFOLDING only (${tier === 'easy' ? 'maximum support: the unit-rate banner and bar chart help the student see the relationship' : tier === 'medium' ? 'moderate support: some visual aids withdrawn, the student derives more unaided' : 'minimum support: the student derives the relationship unaided and justifies it'}). Keep every ratio number within the pedagogical scope; a harder tier NEVER means bigger or different numbers, only less help.`,
  ];
  switch (pinnedType) {
    case 'missing-value':
      promptLines.push(
        tier === 'easy'
          ? 'Easy: the unit-rate banner and bar chart are shown; the hint may state the unit rate and the scaling strategy ("find how many B per 1 A, then multiply").'
          : tier === 'medium'
            ? 'Medium: the unit-rate banner stays but the bar chart is withdrawn; the hint names the strategy without stating the final answer.'
            : 'Hard: both the unit-rate banner and the bar chart are withdrawn — the student must derive the unit rate unaided. The hint must NOT state the unit-rate number; only nudge ("find how many B per 1 A first").',
      );
      break;
    case 'find-multiplier':
      promptLines.push(
        tier === 'easy'
          ? 'Easy: the bar chart is shown with a division cue; the hint may walk the student through dividing the scaled value by the base value.'
          : tier === 'medium'
            ? 'Medium: the bar chart is withdrawn; the hint names the divide-to-find-multiplier strategy without giving the number.'
            : 'Hard: the bar chart and unit-rate banner are withdrawn — bare table only. The hint must NOT state the multiplier or unit rate; only nudge toward comparing scaled vs. base.',
      );
      break;
    case 'build-ratio':
      promptLines.push(
        tier === 'easy'
          ? 'Easy: the bar chart and unit-rate banner are shown so the student can watch both quantities scale together as they move the slider.'
          : tier === 'medium'
            ? 'Medium: the bar chart stays but the unit-rate banner is withdrawn; the student relies on the visual scaling.'
            : 'Hard: only the numeric slider readout remains — bar chart and banner withdrawn; the student reasons about the multiplier from the numbers alone.',
      );
      break;
    case 'unit-rate':
      promptLines.push(
        tier === 'easy'
          ? 'Easy: the bar chart is shown; the hint is verbose and walks the division B ÷ A step by step. ALWAYS keep the B÷A division prompt — it is the task identity.'
          : tier === 'medium'
            ? 'Medium: the B÷A division prompt is shown (default); the hint is standard. NEVER remove the B÷A framing.'
            : 'Hard: keep the B÷A division prompt (NEVER remove it — it is the task identity) but minimize the surrounding verbose hint; the bar chart is withdrawn so the student divides without visual support.',
      );
      break;
  }
  return { showUnitRate, showBarChart, hintExplicitness, instructionTone, promptLines };
}

// ---------------------------------------------------------------------------
// Base schema
// ---------------------------------------------------------------------------

const ratioTableChallengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique challenge ID (e.g., 'rt1', 'rt2', 'rt3')"
    },
    type: {
      type: Type.STRING,
      description: "Challenge type: 'missing-value' (find hidden scaled value), 'find-multiplier' (determine scaling factor), 'build-ratio' (construct equivalent ratio), 'unit-rate' (calculate and apply unit rate)",
      enum: ["missing-value", "find-multiplier", "build-ratio", "unit-rate"]
    },
    instruction: {
      type: Type.STRING,
      description: "Student-facing instruction/question for this challenge (e.g., 'If 3 cups of flour makes 36 cookies, how many cookies can you make with 7.5 cups?')"
    },
    baseRatio: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "The reference ratio as [quantity1, quantity2] (e.g., [3, 36]). This is the locked reference column."
    },
    rowLabels: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Two labels for the quantities being compared (e.g., ['Cups of Flour', 'Cookies Made']). Must have exactly 2 items."
    },
    targetMultiplier: {
      type: Type.NUMBER,
      description: "The multiplier used to create the scaled ratio. E.g., if baseRatio is [3, 36] and targetMultiplier is 2.5, scaled values are [7.5, 90]."
    },
    hiddenValue: {
      type: Type.STRING,
      description: "For missing-value challenges: which scaled value to hide — 'scaled-first' or 'scaled-second'",
      enum: ["scaled-first", "scaled-second"]
    },
    hint: {
      type: Type.STRING,
      description: "Hint text shown after incorrect attempts to guide the student"
    },
    tolerance: {
      type: Type.NUMBER,
      description: "Percentage tolerance for answer checking (default 1%). Use higher values for challenges where rounding is expected."
    }
  },
  required: ["id", "type", "instruction", "baseRatio", "rowLabels", "targetMultiplier", "hint"]
};

const ratioTableSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the ratio table activity (e.g., 'Ratio Reasoning: Recipes & Speed')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will practice across these challenges"
    },
    challenges: {
      type: Type.ARRAY,
      items: ratioTableChallengeSchema,
      description: "Array of 3-5 ratio challenges with mixed types and progressive difficulty"
    },
    showUnitRate: {
      type: Type.BOOLEAN,
      description: "Show the unit rate below each column. Default: true"
    },
    showBarChart: {
      type: Type.BOOLEAN,
      description: "Display visual bar chart comparing quantities. Default: true"
    },
    maxMultiplier: {
      type: Type.NUMBER,
      description: "Maximum value for the multiplier slider (default: 10)"
    }
  },
  required: ["title", "description", "challenges"]
};

/**
 * Generate ratio table data with multiple progressive challenges
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns RatioTableData with challenges array
 */
type RatioTableConfig = Partial<RatioTableData> & {
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * The second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-workspace scaffolding within it. NEVER changes the
     * ratio numbers — it only withdraws the unit-rate banner / bar chart and
     * makes the hint ladder terser.
     */
    difficulty?: string;
};

export const generateRatioTable = async (
  ctx: GenerationContext,
): Promise<RatioTableData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const scopeSection = buildScopePromptSection(ctx.scope);
  const config = ctx.raw as RatioTableConfig;
  // ---------------------------------------------------------------------------
  // Eval mode resolution
  // ---------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    'ratio-table',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('RatioTable', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(ratioTableSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : ratioTableSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Within-mode support tier (config.difficulty) ──────────────────────────
  // The STUDENT's tier DRIVES the deterministic application at the end (single
  // OR blend). pinnedType is ONLY for the prompt tone — a curated blend has no
  // single mode to describe to the LLM.
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType =
    evalConstraint?.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as ChallengeType)
      : undefined;
  const tierScaffold =
    pinnedType && supportTier ? resolveSupportStructure(pinnedType, supportTier) : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  const prompt = `
Create an educational ratio table activity for teaching "${topic}" to ${gradeLevel} students.
${scopeSection}
This activity should contain 3-5 CHALLENGES that progress in difficulty.

${challengeTypeSection}
${tierSection}
${!evalConstraint ? `DIFFICULTY PROGRESSION BY GRADE:
- Grades 6-7: Whole number multipliers (2, 3, 4, 5), integer results, simple contexts
- Grades 7-8: Decimal multipliers (1.5, 2.5, 3.5), may have decimal answers
- Grades 8+: Complex multipliers (2.25, 3.75, 0.75), multi-step reasoning
` : ''}
REAL-WORLD CONTEXTS (vary across challenges):
- Recipes: ingredients scaling (flour to cookies, eggs to muffins)
- Shopping: unit pricing (items to cost, quantity to total)
- Speed/Distance: travel problems (hours to miles, time to distance)
- Mixing: paint colors, solutions (parts A to parts B)
- Science: measurements, conversions, density
- Maps: scale factors (inches to miles)

${config ? `
CONFIGURATION HINTS:
${config.maxMultiplier ? `- Max multiplier: ${config.maxMultiplier}` : ''}
${config.showUnitRate !== undefined ? `- Show unit rate: ${config.showUnitRate}` : ''}
${config.showBarChart !== undefined ? `- Show bar chart: ${config.showBarChart}` : ''}
` : ''}

REQUIREMENTS:
1. Generate 3-5 challenges that PROGRESS in difficulty
2. ${evalConstraint ? 'ALL challenges must use ONLY the allowed challenge type(s)' : 'Use a MIX of challenge types — do NOT make them all the same type'}
3. Each challenge MUST have its own:
   - id: unique string (e.g., 'rt1', 'rt2', ...)
   - type: one of the allowed challenge types
   - instruction: a clear, specific question or task
   - baseRatio: [number, number] with positive values
   - rowLabels: [string, string] matching the context
   - targetMultiplier: positive number appropriate for grade level
   - hint: helpful guidance without giving the answer
4. For "missing-value" challenges, set hiddenValue to 'scaled-first' or 'scaled-second'
5. Start with easier challenges (simpler numbers) and progress to harder ones
6. Write engaging, age-appropriate instructions
7. Ensure all numbers produce reasonable, contextually sensible answers
8. Set tolerance for challenges where rounding may be needed (e.g., 5 for 5% tolerance)
9. Write a descriptive title and educational description that spans all challenges

Return the complete ratio table configuration.
`;

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
    throw new Error('No valid ratio table data returned from Gemini API');
  }

  // ── Validate challenges array ──────────────────────────────────────────

  if (!Array.isArray(data.challenges) || data.challenges.length === 0) {
    throw new Error('Gemini returned no challenges for ratio table');
  }

  const validTypes: RatioTableChallenge['type'][] = [
    'missing-value', 'find-multiplier', 'build-ratio', 'unit-rate'
  ];

  // Filter to only valid challenge types
  data.challenges = data.challenges.filter(
    (c: { type: string }) => validTypes.includes(c.type as RatioTableChallenge['type'])
  );

  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'missing-value';
    data.challenges = [{
      id: 'rt1',
      type: fallbackType,
      instruction: `Solve the ratio problem.`,
      baseRatio: [2, 6],
      rowLabels: ['Items', 'Cost ($)'],
      targetMultiplier: 3,
      hiddenValue: fallbackType === 'missing-value' ? 'scaled-second' : undefined,
      hint: 'Think about the relationship between the two quantities.',
    }];
  }

  // ── Per-challenge validation ───────────────────────────────────────────

  const seenIds = new Set<string>();

  for (let i = 0; i < data.challenges.length; i++) {
    const c = data.challenges[i];

    // Ensure unique id
    if (!c.id || seenIds.has(c.id)) {
      c.id = `rt${i + 1}`;
    }
    seenIds.add(c.id);

    // Validate baseRatio: must be [positive, positive]
    if (!Array.isArray(c.baseRatio) || c.baseRatio.length !== 2 ||
        c.baseRatio[0] <= 0 || c.baseRatio[1] <= 0) {
      console.warn(`Challenge ${c.id}: invalid baseRatio [${c.baseRatio}]. Using [1, 2].`);
      c.baseRatio = [1, 2];
    }

    // Validate rowLabels: must be [string, string]
    if (!Array.isArray(c.rowLabels) || c.rowLabels.length !== 2) {
      console.warn(`Challenge ${c.id}: invalid rowLabels. Using defaults.`);
      c.rowLabels = ["Quantity A", "Quantity B"];
    }

    // Validate targetMultiplier: must be a positive number
    if (!c.targetMultiplier || c.targetMultiplier <= 0) {
      console.warn(`Challenge ${c.id}: invalid targetMultiplier. Using 2.`);
      c.targetMultiplier = 2;
    }

    // For missing-value challenges, ensure hiddenValue is set
    if (c.type === 'missing-value' && !c.hiddenValue) {
      c.hiddenValue = 'scaled-second';
    }

    // Ensure instruction exists
    if (!c.instruction) {
      c.instruction = `Solve the ratio problem with base ratio ${c.baseRatio[0]}:${c.baseRatio[1]}`;
    }

    // Ensure hint exists
    if (!c.hint) {
      c.hint = 'Think about the relationship between the two quantities.';
    }
  }

  // ── Top-level defaults ─────────────────────────────────────────────────

  if (!data.maxMultiplier || data.maxMultiplier < 2) data.maxMultiplier = 10;
  if (data.showUnitRate === undefined) data.showUnitRate = true;
  if (data.showBarChart === undefined) data.showBarChart = true;

  // ── Apply explicit config overrides from manifest ──────────────────────

  if (config) {
    if (config.showUnitRate !== undefined) data.showUnitRate = config.showUnitRate;
    if (config.showBarChart !== undefined) data.showBarChart = config.showBarChart;
    if (config.maxMultiplier !== undefined) data.maxMultiplier = config.maxMultiplier;
    if (config.challenges) data.challenges = config.challenges;
  }

  // ── Apply the support-tier structure deterministically (code owns the SUPPORT
  // structure; the LLM only chose the numbers/contexts). Withdraws scaffolds as
  // the tier hardens — never alters the ratio numbers. Runs LAST, after all
  // fixups and config overrides, so a 'hard' tier can withdraw the leaky banner
  // and bar chart. Gated ONLY on supportTier being present (NOT pinnedType) so
  // blended/auto sessions get difficulty too.
  //
  // LEAK FIX: showUnitRate / showBarChart are SESSION-level booleans (one
  // config.difficulty per session). We resolve each challenge's scaffold from
  // its OWN mode (ch.type) and take the MOST CONSERVATIVE (leak-safe) value
  // across the session — a lever is only shown if EVERY challenge's mode permits
  // it at this tier. This guarantees a tiered session never hands the unit rate
  // to a find-multiplier/missing-value challenge via the always-on banner. ──
  if (supportTier) {
    const challengeTypes = Array.from(
      new Set((data.challenges as RatioTableChallenge[]).map((c) => c.type)),
    ) as ChallengeType[];
    if (challengeTypes.length > 0) {
      // AND across modes: show a lever only if every mode allows it at this tier.
      const showUnitRate = challengeTypes.every(
        (t) => resolveSupportStructure(t, supportTier).showUnitRate,
      );
      const showBarChart = challengeTypes.every(
        (t) => resolveSupportStructure(t, supportTier).showBarChart,
      );
      data.showUnitRate = showUnitRate;
      data.showBarChart = showBarChart;
      // Persist the tier so the tutor's reveal policy matches the on-screen scaffold.
      data.supportTier = supportTier;
      console.log(
        `[RatioTable] Support tier "${supportTier}" applied (${pinnedType ? `single-mode ${pinnedType}` : `blended [${challengeTypes.join(', ')}]`}) → showUnitRate=${showUnitRate}, showBarChart=${showBarChart}`,
      );
    }
  }

  return data as RatioTableData;
};
