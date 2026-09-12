import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection } from '../scopeContext';
import { BalanceScaleData, BalanceScaleObject, BalanceScaleChallenge } from '../../primitives/visual-primitives/math/BalanceScale';
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
  equality: {
    promptDoc: '"equality": K-2 weight matching. One unnumbered block on the left; students place numbered weights on the right, add their chosen weights aloud, then infer the equal left weight. No x, typing, or paired removal.',
    schemaDescription: "'equality' (match, add weights, infer equality)",
  },
  equality_hard: {
    promptDoc: '"equality_hard": Match an unnumbered weight, then make the same weight with a different combination. Say each total and infer the left weight.',
    schemaDescription: "'equality_hard' (compose the same weight two ways)",
  },
  one_step: {
    promptDoc: '"one_step": Complete the load. One pan has a known starting weight; the other a known target total. Add blocks to the lighter pan, say the added weight, then name the missing part.',
    schemaDescription: "'one_step' (complete a known load)",
  },
  one_step_hard: {
    promptDoc: '"one_step_hard": Share the weight. Identical opaque parcels balance known weight units. Distribute units equally into one group per parcel, then say each group and parcel weight.',
    schemaDescription: "'one_step_hard' (equal sharing)",
  },
  two_step_intro: {
    promptDoc: '"two_step_intro": Unpack and share. Set known loose weight aside from both sides, say the remaining combined weight, then share it equally among identical parcels.',
    schemaDescription: "'two_step_intro' (separate and share)",
  },
  two_step: {
    promptDoc: '"two_step": Build equations from physical moves: subtract equal known weights, then form equal parcel groups. Show equations after their corresponding actions. Alternate rounds ask students to show a symbolic instruction with weights.',
    schemaDescription: "'two_step' (connect physical transformations to equations)",
  },

};

// ---------------------------------------------------------------------------
// Equation pool service (deterministic, per-challenge values built locally)
// ---------------------------------------------------------------------------

type ChallengeType = BalanceScaleChallenge['type'];

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — second axis of the two-field
// contract. targetEvalMode = WHICH skill; difficulty = HOW MUCH balance feedback
// is on screen within it. A tier withdraws perception aids; it NEVER changes the
// equations or numbers (the builders + per-mode tables own those).
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; component defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

interface SupportScaffold {
  /** Exact per-side numeric totals (Left: 12 / Right: 12). */
  showSideValues: boolean;
  /** BALANCED / UNBALANCED status pill. */
  showBalanceStatus: boolean;
  /** Beam tilts toward the heavier side (qualitative balance feedback). */
  showTilt: boolean;
  promptLines: string[];
}

/** Keep physical tilt at every tier; easy may add explicit group counts. */
function resolveSupportStructure(_mode: ChallengeType, tier: SupportTier): SupportScaffold {
  return {
    showSideValues: false, showBalanceStatus: tier === 'easy', showTilt: true,
    promptLines: ['Use a live tilting scale and hands-on weights. Never disclose an unknown weight through side totals. '
      + 'Easy may show group counts; other tiers let students count their units. Use the mode-specific action: compose, complete, separate, or share. '
      + 'Students speak their quantities after building. No typed-answer phase or generic solve-for-x instructions.'],
  };
}

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------
// T2 modes bumped 4→5 in the B4 sweep (equality / equality_hard / one_step).
// T3 modes hold at 4 (two_step_intro, two_step) — see B5 audit.

const DEFAULT_INSTANCE_COUNT = 4; // T3 fallback for any mode not listed
const MAX_INSTANCE_COUNT = 6;

const COUNT_BY_MODE: Record<ChallengeType, number> = {
  equality: 5,         // T2 bump (was 4)
  equality_hard: 5,    // T2 bump (was 4)
  one_step: 5,         // T2 bump (was 4)
  one_step_hard: 4,    // T3 hold
  two_step_intro: 4,   // T3 hold
  two_step: 4,         // T3 hold
};

interface EquationSpec {
  leftSide: BalanceScaleObject[];
  rightSide: BalanceScaleObject[];
  variableValue: number;
  instruction: string;
  hint: string;
}

const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Equation builders — all equations use DECOMPOSED RHS so the click-to-remove
// interaction in BalanceScale.tsx can actually isolate the variable. The
// generic pattern is `LHS = answerBlock + sharedConstants`, where every
// non-variable constant on LHS appears as a literal block on RHS too. The
// student then clicks shared blocks to remove from both sides until only the
// variable remains opposite the answer block.
// ---------------------------------------------------------------------------

const VAR_BLOCK = (label = 'x'): BalanceScaleObject => ({
  value: 1,
  label,
  isVariable: true,
});

const CONST_BLOCK = (n: number): BalanceScaleObject => ({
  value: n,
  label: String(n),
});

/** K-2 missing-addend addition: □ + b = c, shown as □ + b = answer + b. */
function buildEquality(): EquationSpec {
  const x = randInt(1, 12);
  const b = randInt(1, 12);
  const varLabel = '?';
  const xFirst = Math.random() < 0.5;
  const leftSide: BalanceScaleObject[] = xFirst
    ? [VAR_BLOCK(varLabel), CONST_BLOCK(b)]
    : [CONST_BLOCK(b), VAR_BLOCK(varLabel)];
  return {
    leftSide,
    // RHS decomposed: [answer, b] so student can click `b` off both sides.
    rightSide: [CONST_BLOCK(x), CONST_BLOCK(b)],
    variableValue: x,
    instruction: `Find the mystery number that makes both sides balance.`,
    hint: `Remove the ${b} block from both sides. What is left on each side?`,
  };
}

/** K-2 harder: missing addend with larger numbers, decomposed form. */
function buildEqualityHard(): EquationSpec {
  const useFirstSlot = Math.random() < 0.5;
  const varLabel = '?';
  if (useFirstSlot) {
    // c + ? = c + answer (shown as [c, ?] = [c, answer])
    const x = randInt(2, 9);
    const c = randInt(5, 12);
    return {
      leftSide: [CONST_BLOCK(c), VAR_BLOCK(varLabel)],
      rightSide: [CONST_BLOCK(c), CONST_BLOCK(x)],
      variableValue: x,
      instruction: `Find the mystery number that keeps the scale balanced.`,
      hint: `Remove the ${c} block from both sides. The mystery number must equal what is left.`,
    };
  }
  // [?] = [c, b]  — variable already isolated; student computes c + b.
  // This branch teaches "read the equation form" rather than removal.
  const x = randInt(8, 20);
  const b = randInt(1, Math.min(x - 1, 9));
  const c = x - b;
  return {
    leftSide: [VAR_BLOCK(varLabel)],
    rightSide: [CONST_BLOCK(c), CONST_BLOCK(b)],
    variableValue: x,
    instruction: `The mystery number is already alone. What value balances the scale?`,
    hint: `Add the blocks on the right side. ${c} + ${b} = ?`,
  };
}

/** Grades 3-4: x + b = c, shown as decomposed [x, b] = [answer, b]. */
function buildOneStep(): EquationSpec {
  const x = randInt(1, 25);
  const b = randInt(1, 20);
  return {
    leftSide: [VAR_BLOCK('x'), CONST_BLOCK(b)],
    rightSide: [CONST_BLOCK(x), CONST_BLOCK(b)],
    variableValue: x,
    instruction: 'Add weights to complete the load, then say how much you added.',
    hint: 'Compare the known weight on each pan. Add weight to the lighter side.',
  };
}

/** Grades 3-4: kx = c (k copies of x on left, c on right). Solved via divide. */
function buildOneStepHard(): EquationSpec {
  const k = randInt(2, 5);
  const x = randInt(2, 9);
  const c = k * x;
  const leftSide: BalanceScaleObject[] = Array.from({ length: k }, () => VAR_BLOCK('x'));
  return {
    leftSide,
    rightSide: [CONST_BLOCK(c)],
    variableValue: x,
    instruction: `Solve for x. ${k} copies of x equal ${c}.`,
    hint: `Divide both sides by ${k} to find x.`,
  };
}

/** Grades 4-5: kx + b = c, shown as [x..., b] = [k·answer, b]. */
function buildTwoStepIntro(): EquationSpec {
  const k = randInt(2, 4);
  const x = randInt(2, 6);
  const b = randInt(1, 5);
  const leftSide: BalanceScaleObject[] = [
    ...Array.from({ length: k }, () => VAR_BLOCK('x')),
    CONST_BLOCK(b),
  ];
  return {
    leftSide,
    rightSide: [CONST_BLOCK(k * x), CONST_BLOCK(b)],
    variableValue: x,
    instruction: `Solve for x. First remove the constant, then divide.`,
    hint: `Remove ${b} from both sides, then divide by ${k}.`,
  };
}

/** Grade 5+: kx + b = c, shown as [x..., b] = [k·answer, b]. Always addition form. */
function buildTwoStep(): EquationSpec {
  const k = randInt(2, 6);
  const x = randInt(2, 8);
  const b = randInt(1, 10);
  const leftSide: BalanceScaleObject[] = [
    ...Array.from({ length: k }, () => VAR_BLOCK('x')),
    CONST_BLOCK(b),
  ];
  return {
    leftSide,
    rightSide: [CONST_BLOCK(k * x), CONST_BLOCK(b)],
    variableValue: x,
    instruction: `Solve for x.`,
    hint: `Remove ${b} from both sides, then divide by ${k}.`,
  };
}

const BUILDERS: Record<ChallengeType, () => EquationSpec> = {
  equality: buildEquality,
  equality_hard: buildEqualityHard,
  one_step: buildOneStep,
  one_step_hard: buildOneStepHard,
  two_step_intro: buildTwoStepIntro,
  two_step: buildTwoStep,
};

const ALLOW_OPS_BY_TYPE: Record<ChallengeType, ('add' | 'subtract' | 'multiply' | 'divide')[]> = {
  equality: ['add', 'subtract'],
  equality_hard: ['add', 'subtract'],
  one_step: ['add', 'subtract'],
  one_step_hard: ['multiply', 'divide'],
  two_step_intro: ['add', 'subtract', 'multiply', 'divide'],
  two_step: ['add', 'subtract', 'multiply', 'divide'],
};

const GRADE_BAND_BY_TYPE: Record<ChallengeType, 'K-2' | '3-4' | '5'> = {
  equality: 'K-2',
  equality_hard: 'K-2',
  one_step: '3-4',
  one_step_hard: '3-4',
  two_step_intro: '3-4',
  two_step: '5',
};

/** Canonical key for de-duplicating equations within a session. */
function equationKey(spec: EquationSpec): string {
  const sideKey = (side: BalanceScaleObject[]) =>
    side
      .map((o) => (o.isVariable ? `v${o.value}` : `c${o.value}`))
      .sort()
      .join('|');
  return `${sideKey(spec.leftSide)}=${sideKey(spec.rightSide)}|x=${spec.variableValue}`;
}

/**
 * Cap on how many challenges in a session may share one variableValue. The
 * content contract (balance-scale oracle, checkAnswerVariety) rejects a session
 * when MORE than 60% of answers share a value; this keeps the relaxed pass
 * strictly at-or-under that line.
 */
function maxRepeatsPerAnswer(target: number): number {
  return Math.max(1, Math.floor(target * 0.6));
}

/**
 * Build N distinct equations for a session of one challenge type. Selection
 * spreads the ANSWER (variableValue), not just the equation shape — different
 * constants around the same x still read as "the answer is always 6" to a
 * student. Pass 1 requires an unseen answer; pass 2 relaxes to the clustering
 * cap for modes whose answer space is smaller than the target (e.g.
 * two_step_intro, x ∈ 2-6); the final fallback accepts duplicates rather than
 * ship a short session.
 */
export function selectBalanceScaleChallenges(
  challengeType: ChallengeType,
  count?: number,
): BalanceScaleChallenge[] {
  const modeCount = COUNT_BY_MODE[challengeType];
  const target = Math.max(
    1,
    Math.min(MAX_INSTANCE_COUNT, count ?? modeCount ?? DEFAULT_INSTANCE_COUNT),
  );
  const builder = BUILDERS[challengeType];
  const seen = new Set<string>();
  const answerCounts = new Map<number, number>();
  const challenges: BalanceScaleChallenge[] = [];

  const accept = (spec: EquationSpec) => {
    answerCounts.set(spec.variableValue, (answerCounts.get(spec.variableValue) ?? 0) + 1);
    challenges.push({
      type: challengeType,
      instruction: spec.instruction,
      leftSide: spec.leftSide,
      rightSide: spec.rightSide,
      variableValue: spec.variableValue,
      hint: spec.hint,
    });
  };

  // Pass 1 — distinct equation AND distinct answer.
  for (let i = 0; i < target * 8 && challenges.length < target; i++) {
    const spec = builder();
    const key = equationKey(spec);
    if (seen.has(key) || answerCounts.has(spec.variableValue)) continue;
    seen.add(key);
    accept(spec);
  }

  // Pass 2 — distinct equation; repeated answers allowed up to the clustering cap.
  const cap = maxRepeatsPerAnswer(target);
  for (let i = 0; i < target * 6 && challenges.length < target; i++) {
    const spec = builder();
    const key = equationKey(spec);
    if (seen.has(key)) continue;
    if ((answerCounts.get(spec.variableValue) ?? 0) >= cap) continue;
    seen.add(key);
    accept(spec);
  }

  // Fallback — if we couldn't fill the target with distinct equations, accept duplicates.
  while (challenges.length < target) {
    accept(builder());
  }

  // Easier-to-harder by sum of constants on the right (proxy for magnitude).
  return shuffle(challenges).sort((a, b) => {
    const sa = a.rightSide.reduce((s, o) => s + (o.isVariable ? 0 : o.value), 0);
    const sb = b.rightSide.reduce((s, o) => s + (o.isVariable ? 0 : o.value), 0);
    return sa - sb;
  });
}

// ---------------------------------------------------------------------------
// Schema (wrapper metadata only — Gemini does NOT emit per-challenge equations)
// ---------------------------------------------------------------------------

const balanceScaleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Title for the multi-equation session (e.g., 'Solving One-Step Equations'). Do NOT name specific numbers — the session walks through several equations.",
    },
    description: {
      type: Type.STRING,
      description:
        "1-2 sentence educational description of what students will practice across the session.",
    },
    challengeType: {
      type: Type.STRING,
      enum: ["equality", "equality_hard", "one_step", "one_step_hard", "two_step_intro", "two_step"],
      description: "Difficulty tier of the session. The system uses this to build the equations.",
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K-2", "3-4", "5"],
      description: "Target grade band. Should align with challengeType. Default: '3-4'.",
    },
    showTilt: {
      type: Type.BOOLEAN,
      description: "Whether to animate the scale tilting when imbalanced. Default: true.",
    },
  },
  required: ["title", "description", "challengeType"],
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type BalanceScaleConfig = {
    /** How many equations in this session. Defaults from COUNT_BY_MODE (5 for T2 modes, 4 for T3). */
    instanceCount?: number;
    showTilt?: boolean;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-screen balance feedback within it. NEVER changes numbers.
     */
    difficulty?: string;
};

export const generateBalanceScale = async (
  ctx: GenerationContext,
): Promise<BalanceScaleData> => {
  const { topic } = ctx;
  const scopeSection = buildScopePromptSection(ctx.scope);
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as BalanceScaleConfig;
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'balance-scale',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(balanceScaleSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : balanceScaleSchema;

  // ── Resolve the within-mode support tier (drives application below) ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  // pinnedType is ONLY for the prompt tone. This generator is always single-mode,
  // so a single pinned eval mode (when present) is the mode; otherwise fall back
  // for the (mode-independent) tier prose.
  const pinnedType: ChallengeType | undefined =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as ChallengeType)
      : undefined;
  const tierScaffold = supportTier
    ? resolveSupportStructure(pinnedType ?? 'one_step', supportTier)
    : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create the wrapper metadata for a multi-equation balance scale session on "${topic}"
${scopeSection} for ${gradeLevel} students.

CONTEXT:
- A balance scale session contains 3-6 separate equations of the same difficulty tier.
- The system has ALREADY pre-built each equation (leftSide, rightSide, variableValue) — you do NOT pick numbers.
- Your job is only to write the session-level title and description, and to set the challengeType + gradeBand.

${challengeTypeSection}
${tierSection}
REQUIREMENTS:
1. Write a clear, student-friendly title for the whole session. Do NOT name any specific equation — the session walks through several.
2. Provide a 1-2 sentence educational description of what students will practice across the session.
3. Set challengeType to the correct difficulty tier (matches the eval mode constraint above).
4. Set gradeBand consistent with challengeType.

Return ONLY the wrapper fields described above.
`;

  logEvalModeResolution('BalanceScale', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid balance scale wrapper returned from Gemini API');
  }

  // ── Validate challengeType ──
  const validTypes: ChallengeType[] = ['equality', 'equality_hard', 'one_step', 'one_step_hard', 'two_step_intro', 'two_step'];
  let challengeType: ChallengeType = validTypes.includes(wrapper.challengeType as ChallengeType)
    ? (wrapper.challengeType as ChallengeType)
    : (evalConstraint?.allowedTypes[0] as ChallengeType) ?? 'one_step';
  if (!validTypes.includes(challengeType)) challengeType = 'one_step';
  if (evalConstraint?.allowedTypes.length === 1) challengeType = evalConstraint.allowedTypes[0] as ChallengeType;

  // ── Build the per-challenge equation pool locally ──
  const challenges = selectBalanceScaleChallenges(challengeType, config?.instanceCount);

  const gradeBand = GRADE_BAND_BY_TYPE[challengeType];
  const allowOperations = ALLOW_OPS_BY_TYPE[challengeType];

  // ── Apply the support tier (perception aids only — numbers untouched) ──
  // Tier owns the three balance-feedback aids when present; otherwise component
  // defaults stand (all on) and showTilt honors any explicit config/wrapper value.
  // This generator is always single-mode, so the session-level flags are correct
  // for every challenge in the session.
  let showTilt = config?.showTilt ?? wrapper.showTilt ?? true;
  let showSideValues = true;
  let showBalanceStatus = true;
  if (supportTier) {
    const sc = resolveSupportStructure(challengeType, supportTier);
    showSideValues = sc.showSideValues;
    showBalanceStatus = sc.showBalanceStatus;
    showTilt = sc.showTilt;
    console.log(`[BalanceScale] Support tier "${supportTier}" applied (single-mode ${challengeType})`);
  }
  showTilt = true;
  showSideValues = false;

  // First challenge populates the legacy session-level leftSide/rightSide/variableValue
  // fields so the component's initial render has data before the per-challenge reset
  // effect runs. The component reads from challenges[currentIndex] thereafter.
  const workshopTitles: Record<ChallengeType, string> = {
    equality: 'Weigh It Together', equality_hard: 'Make It Another Way', one_step: 'Complete the Load',
    one_step_hard: 'Share the Weight', two_step_intro: 'Unpack and Share', two_step: 'Build the Equation',
  };
  const workshopInstructions: Record<ChallengeType, string> = {
    equality: 'Place weights on the right until balanced, then add their weights aloud.',
    equality_hard: 'Match the weight, then make the same weight with a different combination.',
    one_step: 'Add weights to complete the load. Say how much you added.',
    one_step_hard: 'Share the weight equally among identical parcels. Find one parcel weight.',
    two_step_intro: 'Set known weight aside on both sides, then share what remains among the parcels.',
    two_step: 'Use the weights to subtract and share. Connect each move to its equation.',
  };
  for (const challenge of challenges) {
    challenge.instruction = workshopInstructions[challengeType];
    challenge.hint = challengeType === 'equality' || challengeType === 'one_step'
      ? 'Watch which pan is heavier as you add or remove a weight.'
      : 'Use the current weight task. Keep equal amounts together and use one group per identical parcel.';
  }
  wrapper.title = workshopTitles[challengeType];
  wrapper.description = workshopInstructions[challengeType];

  const first = challenges[0];

  const data: BalanceScaleData = {
    gradeLevel: ctx.grade ?? ctx.gradeLevel,
    title: wrapper.title,
    description: wrapper.description,
    leftSide: first.leftSide,
    rightSide: first.rightSide,
    variableValue: first.variableValue,
    showTilt,
    showSideValues,
    showBalanceStatus,
    supportTier: supportTier ?? undefined,
    allowOperations,
    gradeBand,
    challenges,
  };

  const typeSummary = challenges
    .map((c) => `${c.leftSide.map((o) => (o.isVariable ? (o.label || 'x') : o.value)).join('+')}=${c.rightSide.map((o) => (o.isVariable ? (o.label || 'x') : o.value)).join('+')}`)
    .join(', ');
  console.log(`[BalanceScale] Final: challengeType=${challengeType}, instances=${challenges.length} [${typeSummary}], allowOps=[${allowOperations.join(',')}]`);

  return data;
};
