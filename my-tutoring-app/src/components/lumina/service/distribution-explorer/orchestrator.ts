/**
 * Distribution Explorer Orchestrator — single-stage Gemini call.
 *
 * Picks a distribution family, initial parameters, lesson framing, and
 * a phase-appropriate challenge set in one shot. The math is computed
 * client-side from the chosen (family, params) pair — Gemini never invents
 * PDF values, only narrative + challenges.
 *
 * Wave-1 simplification vs. annotated-example:
 * - No solver / planner / step-generator stages. The "rendered output" is a
 *   live workbench, not a worked solution; there's nothing to plan.
 * - No multi-stage challenger — challenges are part of the orchestrator's
 *   single response. Wave-2 can split this into a dedicated challenge stage
 *   if quality demands it.
 * - Discriminated-union challenge schema is flat with nullable fields, then
 *   coerced per `type`; mirrors the inset-bag pattern in the AE orchestrator.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';
import { FAMILIES, FAMILY_LIST, getFamily, resolveParameters } from '../../lib/probability';
import type {
  ChallengeType,
  ComputeChallenge,
  DistributionChallenge,
  DistributionEvalMode,
  DistributionExplorerData,
  DistributionFamily,
  GuidedExplorationChallenge,
  IdentifyChallenge,
  PredictShapeChallenge,
} from '../../primitives/distribution-explorer/types';

// ── Challenge type docs (used to label the constrained schema enum) ──
//
// Each eval mode in the catalog maps to a subset of these challenge types.
// The phase-specific authoring instructions in `phaseGuidance` below remain
// the primary source of mode-specific content guidance — these docs are a
// schema-level safety net so Gemini cannot emit a disallowed type.

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  guided_exploration: {
    promptDoc:
      `"guided_exploration": Open-ended prompt that points the student at an experiment with the parameter sliders. No graded answer; the student clicks "Got it" when satisfied.`,
    schemaDescription: "'guided_exploration' (no graded answer)",
  },
  identify: {
    promptDoc:
      `"identify": Give partial information (shape, mean/variance, scenario) and ask which family fits. Set correctFamily and 1-2 distractorFamilies.`,
    schemaDescription: "'identify' (pick the family)",
  },
  compute: {
    promptDoc:
      `"compute": 4-option MCQ with a concrete (family, params) scenario. Set correctValue plus exactly 3 numericDistractors that encode named misconceptions. Always include a scenario.`,
    schemaDescription: "'compute' (4-option MCQ)",
  },
  predict_shape: {
    promptDoc:
      `"predict_shape": MCQ description of distribution shape ("right-skewed", "symmetric", etc.). Set acceptableAnswers (first is canonical, rest are synonyms accepted as correct) AND 2-3 distractors (wrong shape descriptions).`,
    schemaDescription: "'predict_shape' (MCQ shape descriptor)",
  },
};

const VALID_FAMILIES = new Set<DistributionFamily>(['binomial', 'poisson', 'exponential']);
const VALID_CHALLENGE_TYPES = new Set<ChallengeType>([
  'guided_exploration',
  'identify',
  'compute',
  'predict_shape',
]);

// ── Schema ───────────────────────────────────────────────────────────
//
// Flat challenge bag: `type` discriminates which fields are required.
// Gemini schemas don't express discriminated unions cleanly, so per-type
// fields are nullable and we coerce in post-validation. Same pattern AE
// uses for the inset bag.

const PARAMETER_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: 'Parameter name. Must match the family\'s schema (e.g. "n", "p", "lambda").' },
    value: { type: Type.NUMBER, description: 'Initial value. Engine clamps to the parameter\'s [min, max] range.' },
  },
  required: ['name', 'value'],
};

const CHALLENGE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: ['guided_exploration', 'identify', 'compute', 'predict_shape'],
      description: 'Challenge variant. Determines which other fields are required.',
    },
    prompt: { type: Type.STRING, description: 'The question shown to the student.' },
    scenario: { type: Type.STRING, nullable: true, description: 'Optional actuarial / real-world setup ("An insurance company sees claims..."). Use for compute_basic and compute_advanced eval modes.' },
    hint: { type: Type.STRING, nullable: true, description: 'Single-sentence hint shown after the first wrong attempt.' },
    rationale: { type: Type.STRING, description: 'Plain-language explanation shown after the student commits.' },

    // identify-only
    correctFamily: { type: Type.STRING, enum: ['binomial', 'poisson', 'exponential'], nullable: true, description: 'Required when type=identify.' },
    distractorFamilies: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: ['binomial', 'poisson', 'exponential'] },
      nullable: true,
      description: '1-2 distractor families. Required when type=identify.',
    },

    // compute-only
    correctValue: { type: Type.NUMBER, nullable: true, description: 'Required when type=compute. The numeric answer.' },
    numericDistractors: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      nullable: true,
      description: 'Required when type=compute. 3 plausible wrong numeric answers — common errors (reciprocal, off-by-one, swapped params, forgot the complement, used PMF instead of CDF, etc.). All distinct and different from correctValue.',
    },
    unit: { type: Type.STRING, nullable: true, description: 'Optional display unit shown beside each choice ("%", "claims", "hours"). Used by type=compute.' },
    decimals: { type: Type.NUMBER, nullable: true, description: 'Optional decimal places to format choices. Defaults: 4 for fractional answers (probabilities), 2 for whole-ish numbers. Used by type=compute.' },

    // predict_shape-only
    acceptableAnswers: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      nullable: true,
      description: 'Required when type=predict_shape. First entry is canonical; rest are accepted synonyms.',
    },
    distractors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      nullable: true,
      description: 'Required when type=predict_shape. 2-3 wrong shape descriptions (MCQ distractors) that don\'t semantically match any acceptableAnswer. predict_shape is always rendered as multiple choice.',
    },
  },
  required: ['type', 'prompt', 'rationale'],
};

const ORCHESTRATOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Short lesson title (e.g. "Modeling claim counts with Poisson").' },
    subject: { type: Type.STRING, description: 'Subject pill: "Probability", "Actuarial Math", "Statistics".' },
    initialFamily: {
      type: Type.STRING,
      enum: ['binomial', 'poisson', 'exponential'],
      description: 'The distribution to mount the workbench with.',
    },
    initialParameters: {
      type: Type.ARRAY,
      items: PARAMETER_SCHEMA,
      description: 'Initial parameter values. Names MUST match the chosen family\'s schema.',
    },
    lessonContext: {
      type: Type.STRING,
      description: '2-4 sentences framing the lesson. Set the real-world context the family models.',
    },
    challenges: {
      type: Type.ARRAY,
      items: CHALLENGE_SCHEMA,
      description: 'Phase challenges, ordered easiest → hardest. 2-4 challenges total.',
    },
  },
  required: ['title', 'subject', 'initialFamily', 'initialParameters', 'lessonContext', 'challenges'],
};

// ── Prompt ───────────────────────────────────────────────────────────

function describeFamily(family: DistributionFamily): string {
  const def = FAMILIES[family];
  const params = def.parameters
    .map((p) => `${p.name} ∈ [${p.min}, ${p.max}]${p.integer ? ' (integer)' : ''}`)
    .join(', ');
  return `- **${def.label}** (${def.kind}). Parameters: ${params}. ${def.description}`;
}

function buildPrompt(
  topic: string,
  gradeLevel: string,
  evalMode: DistributionEvalMode,
  family: DistributionFamily | undefined,
  context: string | undefined,
): string {
  const familyConstraint = family
    ? `\nThe student is studying the **${family}** distribution. Set initialFamily="${family}" and pick parameters that produce a teaching-quality shape.`
    : `\nPick the family that best teaches "${topic}". Available: binomial, poisson, exponential.`;

  const phaseGuidance: Record<DistributionEvalMode, string> = {
    explore: `## Phase: EXPLORE (β=1.0)
Author 2 *guided_exploration* challenges. These are open-ended prompts that point the student at an experiment with the parameter sliders. They do NOT have graded answers; the student clicks "Got it" when satisfied. Examples:
  - "Drag λ from 0.5 to 5. What happens to the spread of the distribution?"
  - "Find a parameter combination where the mean equals the variance. What does that tell you?"`,

    identify: `## Phase: IDENTIFY (β=3.0)
Author 2 *identify* challenges. Give the student partial information (a shape description, mean/variance, or a real-world scenario) and ask which family fits. Set correctFamily and 1-2 distractorFamilies. Examples:
  - "A right-skewed continuous distribution with no upper bound, modeling waiting times. Which family?"
  - "Discrete, supports {0, 1, ..., 20}, mean 4. Which family?"`,

    compute_basic: `## Phase: COMPUTE BASIC (β=4.5)
Author 2-3 *compute* challenges. Give a concrete (family, params) scenario and ask for a probability or moment. Always include a scenario.
Each compute challenge MUST be a 4-option MCQ: set correctValue plus exactly 3 numericDistractors. Distractors should encode realistic mistakes — the WRONG answer a student would land on if they made one of these errors:
  - Used the rate as the mean for an Exponential (wrote λ instead of 1/λ)
  - Computed P(X=k) instead of P(X≤k) or P(X≥k)
  - Swapped n and p, or swapped success/failure (used 1-p)
  - Off-by-one on the boundary (≤ vs <, ≥ vs >)
  - Forgot to subtract from 1 for a complement
Examples:
  - scenario: "Claims arrive at λ=3/day." prompt: "P(no claims tomorrow) = ?" → correctValue=0.0498, numericDistractors=[0.1494, 0.0025, 0.9502], unit="", decimals=4
  - scenario: "X ~ Binomial(10, 0.3)." prompt: "Find E[X]." → correctValue=3, numericDistractors=[7, 0.3, 2.1], unit="", decimals=2`,

    compute_advanced: `## Phase: COMPUTE ADVANCED (β=6.5)
Author 2-3 challenges mixing *compute* and *predict_shape*. Computes use conditional probabilities, tail probabilities, or percentiles. Always include a scenario.
Each compute challenge MUST be a 4-option MCQ: set correctValue plus exactly 3 numericDistractors that encode the harder mistakes specific to advanced reasoning:
  - Ignoring memorylessness on Exponential conditionals (multiplying instead of using P(T>t))
  - Computing P(X≥k) when asked for P(X>k) (off by P(X=k))
  - Forgetting to take the complement for a tail probability
  - Confusing PMF with CDF, or PDF with CDF
Examples:
  - scenario: "Equipment lifetime ~ Exp(rate 0.2/year)." prompt: "Given the unit has survived 3 years, find P(survives 2 more)." (memoryless ⇒ same as P(T>2)) → correctValue=0.6703, numericDistractors=[0.3297, 0.5488, 0.4493], unit="", decimals=4
  - scenario: "X ~ Poisson(5)." prompt: "Find P(X ≥ 3)." → correctValue=0.8753, numericDistractors=[0.1247, 0.7350, 0.1755], unit="", decimals=4`,
  };

  return `You are an expert probability tutor authoring an interactive distribution-workbench lesson for a ${gradeLevel} student.

Topic: "${topic}"
${familyConstraint}

## Available families

${FAMILY_LIST.map((f) => describeFamily(f.family)).join('\n')}

${phaseGuidance[evalMode]}

## Authoring rules

1. **Lesson context, not problem statement.** \`lessonContext\` is a 2-4 sentence framing of the topic — set the real-world stakes (insurance claims, equipment failure, polling, etc.). It is shown ABOVE the workbench, before any challenge.

2. **Initial parameters must teach.** Pick values that produce a clear, instructive shape. For Poisson, λ in [2, 8] is generally most readable. For Binomial, n=10 with p=0.3 or p=0.5 makes a clean PMF. For Exponential, λ near 1 keeps the curve in view.

3. **No answer leakage.** Don't put the answer in the lesson context, the prompt, or the parameter values. If the challenge asks "Find E[X]" for Poisson(λ=4), don't write "Notice E[X] = 4 = λ" anywhere visible to the student before they commit.

4. **Challenge variety.** When the eval mode supports multiple challenge types (compute_advanced), mix them.

5. **Compute is always MCQ.** Every compute challenge gets exactly 3 numericDistractors plus the correctValue, for a 4-option MCQ. Distractors must be DISTINCT from correctValue and from each other, in the same order of magnitude as the answer. Pick distractors that encode named misconceptions — never random noise.

6. **predict_shape is always MCQ.** Set acceptableAnswers (first entry canonical, e.g. "right-skewed"; rest are synonyms accepted as correct, e.g. "skewed right", "positive skew") AND 2-3 distractors (wrong shape descriptions, e.g. "symmetric", "left-skewed", "uniform"). Distractors must NOT semantically equal any acceptableAnswer. Lexical match is case-insensitive.

${context ? `\n## Additional steering\n${context}\n` : ''}

Author the lesson now.`;
}

// ── Coercion ─────────────────────────────────────────────────────────

function coerceChallenge(raw: Record<string, unknown>, idx: number): DistributionChallenge | null {
  const type = typeof raw.type === 'string' ? raw.type : '';
  if (!VALID_CHALLENGE_TYPES.has(type as ChallengeType)) {
    console.warn(`[DE Orchestrator] Challenge ${idx}: unknown type "${type}", dropping`);
    return null;
  }

  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
  const rationale = typeof raw.rationale === 'string' ? raw.rationale.trim() : '';
  if (!prompt || !rationale) {
    console.warn(`[DE Orchestrator] Challenge ${idx}: missing prompt or rationale, dropping`);
    return null;
  }

  const scenario = typeof raw.scenario === 'string' && raw.scenario.trim() ? raw.scenario.trim() : undefined;
  const hint = typeof raw.hint === 'string' && raw.hint.trim() ? raw.hint.trim() : undefined;
  const id = `c-${idx}`;

  switch (type as ChallengeType) {
    case 'guided_exploration': {
      const challenge: GuidedExplorationChallenge = {
        id,
        type: 'guided_exploration',
        prompt,
        rationale,
        scenario,
        hint,
      };
      return challenge;
    }
    case 'identify': {
      const correctFamily = typeof raw.correctFamily === 'string' ? raw.correctFamily : '';
      if (!VALID_FAMILIES.has(correctFamily as DistributionFamily)) {
        console.warn(`[DE Orchestrator] Challenge ${idx}: identify needs valid correctFamily, got "${correctFamily}"`);
        return null;
      }
      const distractorsRaw = Array.isArray(raw.distractorFamilies) ? raw.distractorFamilies : [];
      const distractors = distractorsRaw
        .filter((d): d is string => typeof d === 'string')
        .filter((d) => VALID_FAMILIES.has(d as DistributionFamily) && d !== correctFamily) as DistributionFamily[];
      if (distractors.length === 0) {
        console.warn(`[DE Orchestrator] Challenge ${idx}: identify needs at least 1 distractor, dropping`);
        return null;
      }
      const challenge: IdentifyChallenge = {
        id,
        type: 'identify',
        prompt,
        rationale,
        scenario,
        hint,
        correctFamily: correctFamily as DistributionFamily,
        distractors,
      };
      return challenge;
    }
    case 'compute': {
      if (typeof raw.correctValue !== 'number' || !Number.isFinite(raw.correctValue)) {
        console.warn(`[DE Orchestrator] Challenge ${idx}: compute needs numeric correctValue, dropping`);
        return null;
      }
      const correctValue = raw.correctValue;
      const distractorsRaw = Array.isArray(raw.numericDistractors) ? raw.numericDistractors : [];
      // Filter to finite numbers, distinct from each other and from correctValue.
      // Use a relative epsilon so 0.0498 vs 0.0499 doesn't collapse, but exact dupes do.
      const seen = new Set<number>([correctValue]);
      const distractors: number[] = [];
      for (const d of distractorsRaw) {
        if (typeof d !== 'number' || !Number.isFinite(d)) continue;
        if (seen.has(d)) continue;
        seen.add(d);
        distractors.push(d);
      }
      if (distractors.length < 2) {
        console.warn(
          `[DE Orchestrator] Challenge ${idx}: compute needs ≥2 distinct numericDistractors, got ${distractors.length}, dropping`,
        );
        return null;
      }
      // Trim to 3 — the UI is sized for 4 options total (correct + 3 distractors).
      const trimmedDistractors = distractors.slice(0, 3);
      const unit = typeof raw.unit === 'string' && raw.unit.trim() ? raw.unit.trim() : undefined;
      const decimals =
        typeof raw.decimals === 'number' && Number.isFinite(raw.decimals) && raw.decimals >= 0 && raw.decimals <= 8
          ? Math.round(raw.decimals)
          : undefined;
      const challenge: ComputeChallenge = {
        id,
        type: 'compute',
        prompt,
        rationale,
        scenario,
        hint,
        correctValue,
        distractors: trimmedDistractors,
        unit,
        decimals,
      };
      return challenge;
    }
    case 'predict_shape': {
      const acceptableRaw = Array.isArray(raw.acceptableAnswers) ? raw.acceptableAnswers : [];
      const acceptable = acceptableRaw.filter((a): a is string => typeof a === 'string' && a.trim().length > 0);
      if (acceptable.length === 0) {
        console.warn(`[DE Orchestrator] Challenge ${idx}: predict_shape needs at least 1 acceptableAnswer, dropping`);
        return null;
      }
      const distractorsRaw = Array.isArray(raw.distractors) ? raw.distractors : [];
      const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      const acceptableNormalized = new Set(acceptable.map(normalize));
      const distractors = distractorsRaw
        .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
        .filter((d) => !acceptableNormalized.has(normalize(d)));
      if (distractors.length < 2) {
        console.warn(
          `[DE Orchestrator] Challenge ${idx}: predict_shape is MCQ-only and needs ≥2 distractors distinct from acceptableAnswers, got ${distractors.length}, dropping`,
        );
        return null;
      }
      const challenge: PredictShapeChallenge = {
        id,
        type: 'predict_shape',
        prompt,
        rationale,
        scenario,
        hint,
        acceptableAnswers: acceptable,
        distractors: distractors.slice(0, 3),
      };
      return challenge;
    }
  }
}

// ── Run ──────────────────────────────────────────────────────────────

export interface RunDistributionOrchestratorInput {
  topic: string;
  gradeLevel: string;
  evalMode: DistributionEvalMode;
  /** Optional: pin the family. When omitted, the orchestrator picks. */
  family?: DistributionFamily;
  /** Optional steering text. */
  context?: string;
}

export async function runDistributionOrchestrator(
  input: RunDistributionOrchestratorInput,
): Promise<DistributionExplorerData> {
  const start = Date.now();
  const prompt = buildPrompt(input.topic, input.gradeLevel, input.evalMode, input.family, input.context);

  // ── Resolve eval mode against the catalog (single source of truth) ──
  // The orchestrator's evalMode is required and matches catalog evalMode keys
  // 1:1, so the constraint resolution always succeeds when the catalog is in
  // sync. The schema enum is then narrowed to the catalog's challengeTypes for
  // this mode — defense-in-depth on top of the per-mode prompt guidance.
  const evalConstraint = resolveEvalModeConstraint(
    'distribution-explorer',
    input.evalMode,
    CHALLENGE_TYPE_DOCS,
  );

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(ORCHESTRATOR_SCHEMA, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : ORCHESTRATOR_SCHEMA;

  logEvalModeResolution('DistributionExplorer', input.evalMode, evalConstraint);

  console.log('[DE Orchestrator] Authoring:', {
    topic: input.topic,
    grade: input.gradeLevel,
    evalMode: input.evalMode,
    family: input.family ?? '(auto)',
  });

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: activeSchema,
    },
  });

  const text = response.text;
  if (!text) throw new Error('[DE Orchestrator] Empty response');

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    console.error('[DE Orchestrator] JSON parse failed:', error);
    throw new Error('[DE Orchestrator] Malformed response');
  }

  // Family + parameters
  const initialFamilyRaw = typeof raw.initialFamily === 'string' ? raw.initialFamily : '';
  if (!VALID_FAMILIES.has(initialFamilyRaw as DistributionFamily)) {
    throw new Error(`[DE Orchestrator] Invalid initialFamily: "${initialFamilyRaw}"`);
  }
  const initialFamily = initialFamilyRaw as DistributionFamily;

  const familyDef = getFamily(initialFamily);
  const validParamNames = new Set(familyDef.parameters.map((p) => p.name));
  const paramArray = Array.isArray(raw.initialParameters) ? raw.initialParameters : [];
  const provided: Record<string, number> = {};
  for (const entry of paramArray) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.name === 'string' && validParamNames.has(e.name) && typeof e.value === 'number') {
      provided[e.name] = e.value;
    }
  }
  const resolvedParams = resolveParameters(initialFamily, provided);

  // Challenges
  const challengesRaw = Array.isArray(raw.challenges) ? raw.challenges : [];
  const challenges: DistributionChallenge[] = [];
  for (let i = 0; i < challengesRaw.length; i++) {
    const c = challengesRaw[i];
    if (!c || typeof c !== 'object') continue;
    const coerced = coerceChallenge(c as Record<string, unknown>, i);
    if (coerced) challenges.push(coerced);
  }

  if (challenges.length === 0) {
    throw new Error('[DE Orchestrator] Produced no valid challenges');
  }

  const title = typeof raw.title === 'string' ? raw.title.trim() : 'Distribution Explorer';
  const subject = typeof raw.subject === 'string' ? raw.subject.trim() : 'Probability';
  const lessonContext =
    typeof raw.lessonContext === 'string' ? raw.lessonContext.trim() : '';
  if (!lessonContext) {
    console.warn('[DE Orchestrator] Empty lessonContext — student will see workbench with no framing');
  }

  const data: DistributionExplorerData = {
    title,
    subject,
    evalMode: input.evalMode,
    initial: {
      family: initialFamily,
      parameters: resolvedParams,
    },
    lessonContext,
    challenges,
    debug: {
      rawOrchestrator: raw,
      durationMs: Date.now() - start,
    },
  };

  console.log('[DE Orchestrator] Authored:', {
    family: initialFamily,
    params: resolvedParams,
    challengeCount: challenges.length,
    challengeTypes: challenges.map((c) => c.type),
    durationMs: data.debug?.durationMs,
  });

  return data;
}
