import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
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
    promptDoc:
      `"equality": K-2 missing addend problems. Use □ or "mystery number" — no variable notation. `
      + `Simple addition equations: □ + 3 = 7 or 5 + □ = 8. `
      + `Positive integers under 20. allowOperations: ['add', 'subtract']. gradeBand: 'K-2'.`,
    schemaDescription: "'equality' (balance = equal, missing addend)",
  },
  equality_hard: {
    promptDoc:
      `"equality_hard": K-2 harder missing-addend problems with subtraction and larger numbers. `
      + `Subtraction equations: 12 - □ = 7 or □ - 3 = 5. Sums/differences 10-20. `
      + `Still □ or "mystery number" — no x. allowOperations: ['add', 'subtract']. gradeBand: 'K-2'.`,
    schemaDescription: "'equality_hard' (harder missing addend with subtraction)",
  },
  one_step: {
    promptDoc:
      `"one_step": Grades 3-4 one-step equations with x notation. `
      + `Examples: x + 5 = 12, x - 3 = 7. Positive integers under 50. `
      + `allowOperations: ['add', 'subtract']. gradeBand: '3-4'.`,
    schemaDescription: "'one_step' (single-operation x equation)",
  },
  one_step_hard: {
    promptDoc:
      `"one_step_hard": Grades 3-4 one-step equations using multiplication or division. `
      + `Examples: 3x = 12, x ÷ 2 = 5. Products under 50, divisors 2-10. `
      + `Coefficients shown as multiple variable objects. `
      + `allowOperations: ['multiply', 'divide']. gradeBand: '3-4'.`,
    schemaDescription: "'one_step_hard' (multiply/divide one-step equation)",
  },
  two_step_intro: {
    promptDoc:
      `"two_step_intro": Grades 4-5 simple two-step equations with small coefficients. `
      + `Examples: 2x + 1 = 7, 3x - 2 = 10. Coefficients 2-4, results under 30. `
      + `All values positive. allowOperations: ['add', 'subtract', 'multiply', 'divide']. gradeBand: '3-4'.`,
    schemaDescription: "'two_step_intro' (simple two-step, small coefficients)",
  },
  two_step: {
    promptDoc:
      `"two_step": Grade 5+ two-step equations with coefficients. `
      + `Examples: 2x + 3 = 11, 3x - 4 = 14. Coefficients 2-6, results under 50. `
      + `allowOperations: ['add', 'subtract', 'multiply', 'divide']. gradeBand: '5'.`,
    schemaDescription: "'two_step' (multi-step equation)",
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

/**
 * Easy→hard withdrawal of the three balance-feedback aids, most-explicit first:
 * exact side totals → BALANCED pill → beam tilt. The aids are mode-independent
 * (the `_mode` param is kept for signature parity with the skill pattern and
 * future per-mode tuning). Numbers are NEVER touched.
 */
function resolveSupportStructure(_mode: ChallengeType, tier: SupportTier): SupportScaffold {
  const base = 'This tier changes ONLY how much balance feedback is on screen — it never changes the equations or the numbers.';
  if (tier === 'easy') {
    return {
      showSideValues: true,
      showBalanceStatus: true,
      showTilt: true,
      promptLines: [
        base,
        'EASY: full self-check support — exact side totals, a BALANCED/UNBALANCED readout, and a tilting beam are all visible. Title/description may reassure the student the scale will show them when both sides match.',
      ],
    };
  }
  if (tier === 'medium') {
    return {
      showSideValues: false,
      showBalanceStatus: true,
      showTilt: true,
      promptLines: [
        base,
        'MEDIUM: the exact side totals are hidden, but the tilting beam and the BALANCED/UNBALANCED readout remain — the student adds each side themselves and confirms with the scale. Keep the tone matter-of-fact; do not reveal which operation to use.',
      ],
    };
  }
  // hard
  return {
    showSideValues: false,
    showBalanceStatus: false,
    showTilt: false,
    promptLines: [
      base,
      'HARD: all balance feedback is withdrawn — no side totals, no BALANCED readout, and the beam stays level. The student must reason about balance from the equation alone. Title/description should invite careful, justified reasoning and must never hint at the operation to use.',
    ],
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
    const x = randInt(1, 9);
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
  const isolatedForm = Math.random() < 0.35;
  if (isolatedForm) {
    // x = c + b  — variable pre-isolated. Student computes the sum.
    const x = randInt(8, 30);
    const b = randInt(1, Math.min(x - 1, 15));
    const c = x - b;
    return {
      leftSide: [VAR_BLOCK('x')],
      rightSide: [CONST_BLOCK(c), CONST_BLOCK(b)],
      variableValue: x,
      instruction: `Solve for x. The variable is already isolated.`,
      hint: `Add the right side: ${c} + ${b} = ?`,
    };
  }
  // x + b = c  →  [x, b] = [answer, b]. Student clicks b off both sides.
  const x = randInt(1, 25);
  const b = randInt(1, 20);
  return {
    leftSide: [VAR_BLOCK('x'), CONST_BLOCK(b)],
    rightSide: [CONST_BLOCK(x), CONST_BLOCK(b)],
    variableValue: x,
    instruction: `Solve for x.`,
    hint: `Remove ${b} from both sides to isolate x.`,
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
Create the wrapper metadata for a multi-equation balance scale session on "${topic}" for ${gradeLevel} students.

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

  // First challenge populates the legacy session-level leftSide/rightSide/variableValue
  // fields so the component's initial render has data before the per-challenge reset
  // effect runs. The component reads from challenges[currentIndex] thereafter.
  const first = challenges[0];

  const data: BalanceScaleData = {
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
