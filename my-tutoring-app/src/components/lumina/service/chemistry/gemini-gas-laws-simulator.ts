import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type {
  GasLawsSimulatorData,
  GasLawsChallenge,
  GasLawsScenario,
  GasVariable,
  DirectionAnswer,
  GasLawsChange,
  GasLawFocus,
} from "../../primitives/visual-primitives/chemistry/GasLawsSimulator";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// Re-export the hydrated data type for convenience.
export type { GasLawsSimulatorData };

// ---------------------------------------------------------------------------
// Physics constants + sim ranges (mirror the component)
// ---------------------------------------------------------------------------

const R_IDEAL = 0.0821; // L·atm/(mol·K)

const RANGES: Record<GasVariable, [number, number]> = {
  P: [0.2, 10],
  V: [0.5, 20],
  T: [100, 1500],
  n: [0.1, 5],
};

const ALL_VARS: GasVariable[] = ['P', 'V', 'T', 'n'];
const DIRECTIONS: DirectionAnswer[] = ['increase', 'decrease', 'unchanged'];

// Sentinel used in the schema so the enum is never nullable; post-validation maps this to null.
const DIR_NONE = 'none';

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function clampVar(variable: GasVariable, value: number): number {
  const [lo, hi] = RANGES[variable];
  return clamp(value, lo, hi);
}

function isGasVariable(x: unknown): x is GasVariable {
  return typeof x === 'string' && (x === 'P' || x === 'V' || x === 'T' || x === 'n');
}

function inRange(variable: GasVariable, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const [lo, hi] = RANGES[variable];
  return value >= lo && value <= hi;
}

// ---------------------------------------------------------------------------
// Per-challenge-type docs (used for prompt + schema description narrowing)
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  observe: {
    promptDoc:
      `"observe": Student watches the particle simulation after a perturbation and reports the DIRECTION ` +
      `of change of the asked variable. ` +
      `changeVariable + changeNewValue define the perturbation (within sim ranges P[0.2,10] atm, V[0.5,20] L, T[100,1500] K, n[0.1,5] mol). ` +
      `askedVariable is which variable the student reasons about (should NOT equal changeVariable, and should NOT be in scenario.lockedVariables). ` +
      `directionAnswer MUST be one of 'increase', 'decrease', 'unchanged' (NOT 'none') — reasoned from PV=nRT with the locked set fixed. ` +
      `targetAnswer MUST be 0 and tolerance MUST be 0 (both unused for observe).`,
    schemaDescription: "'observe' (direction of change)",
  },
  predict: {
    promptDoc:
      `"predict": Student predicts the NUMERIC new value of the asked variable after a perturbation, in its natural units. ` +
      `changeVariable + changeNewValue define the perturbation. ` +
      `askedVariable must differ from changeVariable and must NOT be in scenario.lockedVariables. ` +
      `targetAnswer = the correct new value of askedVariable after the change, computed from PV=nRT with the locked set held fixed. ` +
      `tolerance ≈ 5% of |targetAnswer| (minimum 0.01). ` +
      `directionAnswer MUST be 'none' (unused for predict).`,
    schemaDescription: "'predict' (numeric prediction)",
  },
  calculate: {
    promptDoc:
      `"calculate": Student computes the final value of askedVariable from the ideal gas law PV=nRT. ` +
      `CRITICAL SINGLE-PERTURBATION RULE: The scenario has EXACTLY ONE variable that changes — ` +
      `changeVariable moves from its initial value to changeNewValue. ALL OTHER variables that are NOT the asked ` +
      `variable MUST remain at their scenario initial values. Do NOT describe additional variable changes in the ` +
      `instruction (e.g. do NOT say "and the temperature rises to 400 K" unless that is the asked variable). ` +
      `The instruction must describe exactly the single changeVariable perturbation and ask for askedVariable. ` +
      `targetAnswer = correct final value of askedVariable computed as PV=nRT with all non-asked, non-changed ` +
      `variables held at their initial values. Tolerance ≈ 5% of |targetAnswer| (minimum 0.01). ` +
      `directionAnswer MUST be 'none' (unused). The "calculate" type differs from "predict" only in difficulty ` +
      `— prefer 'ideal' or 'combined' lawFocus and deeper numeric reasoning, but still ONE perturbation.`,
    schemaDescription: "'calculate' (PV=nRT with single perturbation)",
  },
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const scenarioSchema: Schema = {
  type: Type.OBJECT,
  description:
    "Single scenario describing the initial state and which variables are locked for the activity.",
  properties: {
    lawFocus: {
      type: Type.STRING,
      enum: ['boyle', 'charles', 'gay_lussac', 'combined', 'ideal', 'kmt_only'],
      description:
        "Law focus: 'boyle' (lock T,n), 'charles' (lock P,n), 'gay_lussac' (lock V,n), " +
        "'combined' (lock n only), 'ideal' (lock none), 'kmt_only' (grade 8 KMT only; lock n).",
    },
    initialP: {
      type: Type.NUMBER,
      description: "Initial pressure in atm. Must be in [0.2, 10].",
    },
    initialV: {
      type: Type.NUMBER,
      description: "Initial volume in L. Must be in [0.5, 20].",
    },
    initialT: {
      type: Type.NUMBER,
      description: "Initial temperature in Kelvin. Must be in [100, 1500].",
    },
    initialN: {
      type: Type.NUMBER,
      description: "Initial amount of gas in mol. Must be in [0.1, 5].",
    },
    lockedVariables: {
      type: Type.ARRAY,
      description:
        "Variables the student cannot change directly. MUST be consistent with lawFocus: " +
        "boyle=['T','n'], charles=['P','n'], gay_lussac=['V','n'], combined=['n'], ideal=[], kmt_only=['n'].",
      items: {
        type: Type.STRING,
        enum: ['P', 'V', 'T', 'n'],
      },
    },
  },
  required: [
    'lawFocus',
    'initialP',
    'initialV',
    'initialT',
    'initialN',
    'lockedVariables',
  ],
};

const gasLawsSimulatorSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short engaging title for the activity.",
    },
    description: {
      type: Type.STRING,
      description: "One-sentence activity description in grade-appropriate language.",
    },
    gradeBand: {
      type: Type.STRING,
      enum: ['8', '9-10', '11-12'],
      description: "Target grade band.",
    },
    scenario: scenarioSchema,
    challenges: {
      type: Type.ARRAY,
      description:
        "3-5 challenges, all referencing the single scenario. When an eval mode is targeted, all challenges must share the SAME type.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge id (e.g. 'ch1', 'ch2').",
          },
          type: {
            type: Type.STRING,
            enum: ['observe', 'predict', 'calculate'],
            description:
              "Challenge type: 'observe' (direction), 'predict' (numeric prediction), 'calculate' (multi-variable PV=nRT).",
          },
          instruction: {
            type: Type.STRING,
            description: "Grade-appropriate instruction telling the student what to do.",
          },
          hint: {
            type: Type.STRING,
            description: "Scaffolding hint that nudges without revealing the answer. Anchor in KMT when possible.",
          },
          narration: {
            type: Type.STRING,
            description: "Short celebratory reinforcement shown when the student is correct.",
          },
          askFor: {
            type: Type.STRING,
            description:
              "Short phrase naming what the student must find (e.g. 'the new pressure', 'direction of V').",
          },
          changeVariable: {
            type: Type.STRING,
            enum: ['P', 'V', 'T', 'n'],
            description: "Which variable is perturbed in this challenge.",
          },
          changeNewValue: {
            type: Type.NUMBER,
            description:
              "New value of changeVariable AFTER the perturbation, in its natural unit and within sim range.",
          },
          askedVariable: {
            type: Type.STRING,
            enum: ['P', 'V', 'T', 'n'],
            description:
              "Which variable the student must reason about. Typically DIFFERENT from changeVariable and NOT in scenario.lockedVariables.",
          },
          directionAnswer: {
            type: Type.STRING,
            enum: ['increase', 'decrease', 'unchanged', 'none'],
            description:
              "For 'observe' challenges, the direction of change of askedVariable: 'increase', 'decrease', or 'unchanged'. For 'predict' and 'calculate' challenges, MUST be 'none' (unused sentinel).",
          },
          targetAnswer: {
            type: Type.NUMBER,
            description:
              "For 'predict'/'calculate': the correct numeric answer > 0 in askedVariable's units, computed from PV=nRT. For 'observe': MUST be 0 (unused).",
          },
          tolerance: {
            type: Type.NUMBER,
            description:
              "For 'predict'/'calculate': ± tolerance on targetAnswer, about 5% of |targetAnswer|. For 'observe': MUST be 0.",
          },
        },
        required: [
          'id',
          'type',
          'instruction',
          'hint',
          'narration',
          'askFor',
          'changeVariable',
          'changeNewValue',
          'askedVariable',
          'directionAnswer',
          'targetAnswer',
          'tolerance',
        ],
      },
    },
  },
  required: ['title', 'description', 'gradeBand', 'scenario', 'challenges'],
};

// ---------------------------------------------------------------------------
// Grade bands
// ---------------------------------------------------------------------------

type GradeBand = '8' | '9-10' | '11-12';

const resolveGradeBand = (gradeLevel: string): GradeBand => {
  const gl = (gradeLevel || '').toLowerCase();
  if (
    gl.includes('11') ||
    gl.includes('12') ||
    gl.includes('11-12') ||
    gl.includes('high school') ||
    gl.includes('advanced')
  ) {
    return '11-12';
  }
  if (gl.includes('9') || gl.includes('10') || gl.includes('9-10')) {
    return '9-10';
  }
  if (gl.includes('8') || gl.includes('grade 8') || gl.includes('middle')) {
    return '8';
  }
  return '9-10';
};

const GRADE_BAND_GUIDANCE: Record<GradeBand, string> = {
  '8':
    "Grade 8 KMT introduction. Use lawFocus='kmt_only'. Every challenge MUST be type='observe' — " +
    "ask the student to predict direction (increase/decrease/unchanged) using kinetic molecular theory " +
    "reasoning. Phrase hints in terms of particle speed, collision frequency, and spacing. Keep the " +
    "initial state in a comfortable middle of the ranges (e.g. P≈2 atm, V≈4 L, T≈300 K, n≈1 mol).",
  '9-10':
    "Grades 9-10. Pick a single gas law focus: 'boyle' (lock T,n), 'charles' (lock P,n), or 'gay_lussac' " +
    "(lock V,n). Mix 'observe' and 'predict' challenges so students first reason directionally, then " +
    "quantify. Keep initial values moderate so perturbations stay inside sim ranges. Phrase hints around " +
    "the specific relationship (e.g. Boyle: P and V are inversely proportional at constant T).",
  '11-12':
    "Grades 11-12. Use lawFocus='combined' (lock only n) or 'ideal' (lock nothing). Emphasize 'calculate' " +
    "challenges requiring multi-variable PV=nRT reasoning. For 'ideal' focus, you may ask for n as well. " +
    "Hints should reference the ideal gas law explicitly. Ensure numerical answers lie comfortably inside " +
    "sim ranges after the change.",
};

// ---------------------------------------------------------------------------
// Locked-variable derivation from lawFocus
// ---------------------------------------------------------------------------

const LOCKED_BY_FOCUS: Record<GasLawFocus, GasVariable[]> = {
  boyle: ['T', 'n'],
  charles: ['P', 'n'],
  gay_lussac: ['V', 'n'],
  combined: ['n'],
  ideal: [],
  kmt_only: ['n'],
};

function deriveLocked(focus: GasLawFocus): GasVariable[] {
  return [...LOCKED_BY_FOCUS[focus]];
}

function sanitizeLocked(
  focus: GasLawFocus,
  raw: unknown,
): GasVariable[] {
  if (Array.isArray(raw)) {
    const cleaned = raw.filter(isGasVariable);
    const expected = LOCKED_BY_FOCUS[focus];
    // Require the expected locked set to be a subset of what Gemini provided;
    // otherwise derive from focus (source of truth).
    const providedSet = new Set(cleaned);
    const ok = expected.every(v => providedSet.has(v)) &&
      cleaned.every(v => (['P', 'V', 'T', 'n'] as GasVariable[]).includes(v));
    if (ok) {
      // Dedupe while preserving order
      return Array.from(new Set(cleaned));
    }
  }
  return deriveLocked(focus);
}

// ---------------------------------------------------------------------------
// Scenario expected-state solver (component uses same approach in applyChange)
// ---------------------------------------------------------------------------

interface GasState {
  P: number;
  V: number;
  T: number;
  n: number;
}

/**
 * Given an initial state, apply a single-variable perturbation and solve PV=nRT
 * for the one un-locked, non-driver variable. If multiple variables are free,
 * prefer solving for `askedVariable` (which is what the challenge asks about).
 */
function solveExpectedState(
  initial: GasState,
  locked: GasVariable[],
  change: GasLawsChange,
  askedVariable: GasVariable,
): GasState {
  const next: GasState = { ...initial };
  next[change.variable] = clampVar(change.variable, change.newValue);

  const lockedSet = new Set<GasVariable>(locked);
  lockedSet.add(change.variable);

  const solveFor: GasVariable[] = ALL_VARS.filter(v => !lockedSet.has(v));

  // Pick the variable to solve for. Prefer the asked variable when it's free;
  // otherwise the first free variable (component uses the same fallback order).
  let target: GasVariable | undefined;
  if (solveFor.includes(askedVariable)) {
    target = askedVariable;
  } else if (solveFor.length > 0) {
    target = solveFor.includes('P') ? 'P' : solveFor[0];
  }

  if (target === 'P') {
    next.P = (next.n * R_IDEAL * next.T) / Math.max(next.V, 0.001);
  } else if (target === 'V') {
    next.V = (next.n * R_IDEAL * next.T) / Math.max(next.P, 0.001);
  } else if (target === 'T') {
    next.T = (next.P * next.V) / Math.max(next.n * R_IDEAL, 0.001);
  } else if (target === 'n') {
    next.n = (next.P * next.V) / Math.max(R_IDEAL * next.T, 0.001);
  }

  // Clamp to sim ranges for safety
  next.P = clampVar('P', next.P);
  next.V = clampVar('V', next.V);
  next.T = clampVar('T', next.T);
  next.n = clampVar('n', next.n);
  return next;
}

/**
 * Compute the expected direction of askedVariable after change, by solving
 * for the new state and comparing against the initial value with a small
 * relative epsilon (~0.5%).
 */
function expectedDirection(
  initial: GasState,
  locked: GasVariable[],
  change: GasLawsChange,
  askedVariable: GasVariable,
): DirectionAnswer {
  const before = initial[askedVariable];
  const after = solveExpectedState(initial, locked, change, askedVariable)[askedVariable];
  const eps = Math.max(Math.abs(before) * 0.005, 0.001);
  if (after > before + eps) return 'increase';
  if (after < before - eps) return 'decrease';
  return 'unchanged';
}

// ---------------------------------------------------------------------------
// Fallback challenges (must be physically correct)
// ---------------------------------------------------------------------------

const FALLBACK_SCENARIO: GasLawsScenario = {
  lawFocus: 'combined',
  initialP: 2,
  initialV: 4,
  initialT: 300,
  initialN: 1,
  lockedVariables: ['n'],
};

function buildFallbackChallenges(
  scenario: GasLawsScenario,
  allowedTypes: string[] | null,
): GasLawsChallenge[] {
  const initial: GasState = {
    P: scenario.initialP,
    V: scenario.initialV,
    T: scenario.initialT,
    n: scenario.initialN,
  };

  const makeObserve = (): GasLawsChallenge => {
    const change: GasLawsChange = { variable: 'T', newValue: 600 };
    const dir = expectedDirection(initial, scenario.lockedVariables, change, 'P');
    return {
      id: 'ch-observe',
      type: 'observe',
      instruction:
        "We double the temperature from 300 K to 600 K while the amount of gas stays fixed. What happens to the pressure?",
      hint:
        "Hotter particles move faster and hit the walls harder and more often. With the same amount of gas in the same-ish volume, what does that do to pressure?",
      narration: "Right — more forceful, more frequent collisions mean higher pressure.",
      askFor: "direction of change of pressure",
      change,
      askedVariable: 'P',
      directionAnswer: dir,
      targetAnswer: 0,
      tolerance: 0,
    };
  };

  const makePredict = (): GasLawsChallenge => {
    const change: GasLawsChange = { variable: 'V', newValue: 2 };
    const after = solveExpectedState(initial, scenario.lockedVariables, change, 'P');
    const target = Math.round(after.P * 100) / 100;
    return {
      id: 'ch-predict',
      type: 'predict',
      instruction:
        "Starting from P=2 atm, V=4 L, T=300 K with n fixed, we compress the volume to 2 L at the same temperature. What is the new pressure?",
      hint: "Boyle-like behavior at constant T and n: P1·V1 = P2·V2. Solve for P2.",
      narration: "Exactly — halving the volume at constant temperature doubles the pressure.",
      askFor: "the new pressure in atm",
      change,
      askedVariable: 'P',
      directionAnswer: null,
      targetAnswer: target,
      tolerance: Math.max(0.05 * Math.abs(target), 0.01),
    };
  };

  const makeCalculate = (): GasLawsChallenge => {
    const change: GasLawsChange = { variable: 'T', newValue: 600 };
    const after = solveExpectedState(initial, scenario.lockedVariables, change, 'V');
    const target = Math.round(after.V * 100) / 100;
    return {
      id: 'ch-calculate',
      type: 'calculate',
      instruction:
        "We heat the gas from 300 K to 600 K while holding pressure at 2 atm and n fixed. What is the new volume?",
      hint: "At constant P and n, Charles's Law: V1/T1 = V2/T2. Solve for V2.",
      narration: "Good — doubling T at constant P doubles V.",
      askFor: "the new volume in L",
      change,
      askedVariable: 'V',
      directionAnswer: null,
      targetAnswer: target,
      tolerance: Math.max(0.05 * Math.abs(target), 0.01),
    };
  };

  const all: Record<string, GasLawsChallenge> = {
    observe: makeObserve(),
    predict: makePredict(),
    calculate: makeCalculate(),
  };

  if (allowedTypes && allowedTypes.length > 0) {
    return allowedTypes.filter(t => all[t]).map(t => all[t]);
  }
  return [all.observe, all.predict, all.calculate];
}

// ---------------------------------------------------------------------------
// Scenario validator / normalizer
// ---------------------------------------------------------------------------

function normalizeScenario(raw: unknown, gradeBand: GradeBand): GasLawsScenario {
  const fallbackFocus: GasLawFocus =
    gradeBand === '8' ? 'kmt_only' : gradeBand === '9-10' ? 'boyle' : 'combined';

  if (!raw || typeof raw !== 'object') {
    return { ...FALLBACK_SCENARIO, lawFocus: fallbackFocus, lockedVariables: deriveLocked(fallbackFocus) };
  }

  const r = raw as Record<string, unknown>;
  const validFocus: GasLawFocus[] = ['boyle', 'charles', 'gay_lussac', 'combined', 'ideal', 'kmt_only'];
  const focus = (validFocus.includes(r.lawFocus as GasLawFocus)
    ? (r.lawFocus as GasLawFocus)
    : fallbackFocus);

  const initialP = clampVar('P', Number(r.initialP));
  const initialV = clampVar('V', Number(r.initialV));
  const initialT = clampVar('T', Number(r.initialT));
  const initialN = clampVar('n', Number(r.initialN));

  // If Gemini returned NaN for any of these, fall back to sensible defaults in range.
  const finalP = Number.isFinite(initialP) ? initialP : 2;
  const finalV = Number.isFinite(initialV) ? initialV : 4;
  const finalT = Number.isFinite(initialT) ? initialT : 300;
  const finalN = Number.isFinite(initialN) ? initialN : 1;

  const locked = sanitizeLocked(focus, r.lockedVariables);

  return {
    lawFocus: focus,
    initialP: finalP,
    initialV: finalV,
    initialT: finalT,
    initialN: finalN,
    lockedVariables: locked,
  };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate Gas Laws Simulator data using Gemini.
 *
 * Because Gemini is unreliable at ideal-gas-law arithmetic, numeric answers
 * and observed directions are post-validated against PV=nRT computed from
 * the scenario and change. Target answers that diverge from the computed
 * value by more than 10% are REPLACED with the computed value.
 */
export const generateGasLawsSimulator = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string; intent?: string }>,
): Promise<GasLawsSimulatorData> => {
  const gradeBand = resolveGradeBand(gradeLevel);

  // Resolve eval mode constraint and narrow the challenge.type enum if needed.
  const constraint = resolveEvalModeConstraint(
    'gas-laws-simulator',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // Grade 8 additionally forces observe-only regardless of eval mode.
  const grade8Forced = gradeBand === '8';
  const allowedTypesForGrade: string[] | null = grade8Forced ? ['observe'] : null;

  // Combine eval-mode allowed types with grade-level constraints.
  let effectiveAllowed: string[] | null = null;
  if (constraint && allowedTypesForGrade) {
    effectiveAllowed = constraint.allowedTypes.filter(t => allowedTypesForGrade.includes(t));
    if (effectiveAllowed.length === 0) effectiveAllowed = allowedTypesForGrade;
  } else if (constraint) {
    effectiveAllowed = constraint.allowedTypes;
  } else if (allowedTypesForGrade) {
    effectiveAllowed = allowedTypesForGrade;
  }

  const constrainedSchema = effectiveAllowed
    ? constrainChallengeTypeEnum(
        gasLawsSimulatorSchema,
        effectiveAllowed,
        CHALLENGE_TYPE_DOCS,
      )
    : gasLawsSimulatorSchema;

  const challengeTypePromptSection = buildChallengeTypePromptSection(
    constraint,
    CHALLENGE_TYPE_DOCS,
  );

  logEvalModeResolution('gas-laws-simulator', config?.targetEvalMode, constraint);

  const intentHint = config?.intent ? `\nInstructor intent: ${config.intent}` : '';
  const grade8Rider = grade8Forced
    ? `\n\nGRADE 8 OVERRIDE: ONLY 'observe' challenges are permitted. Use lawFocus='kmt_only' ` +
      `and phrase every challenge as a directional KMT question.`
    : '';

  const generationPrompt = `Create a Gas Laws Simulator activity about "${topic}" for grade band ${gradeBand}.${intentHint}${grade8Rider}

GRADE BAND GUIDANCE:
${GRADE_BAND_GUIDANCE[gradeBand]}

${challengeTypePromptSection}

SCENARIO REQUIREMENTS:
1. Choose a lawFocus appropriate to the grade band.
2. lockedVariables MUST match lawFocus:
   - boyle → ['T','n']
   - charles → ['P','n']
   - gay_lussac → ['V','n']
   - combined → ['n']
   - ideal → []
   - kmt_only → ['n']
3. Initial values MUST satisfy:
   - initialP in [0.2, 10] atm
   - initialV in [0.5, 20] L
   - initialT in [100, 1500] K
   - initialN in [0.1, 5] mol
4. Pick values in the middle of the ranges so perturbations stay inside sim ranges after the change.

CHALLENGE REQUIREMENTS (3-5 challenges):
1. Each "id" is unique ("ch1", "ch2", ...).
2. "changeVariable" and "askedVariable" MUST be one of 'P','V','T','n'.
3. "changeNewValue" MUST be a positive number inside the sim range for changeVariable.
4. "askedVariable" should NOT equal "changeVariable" AND should NOT be in scenario.lockedVariables.
5. For type='observe': directionAnswer MUST be one of 'increase','decrease','unchanged'. targetAnswer MUST be 0, tolerance MUST be 0.
6. For type='predict' or 'calculate': directionAnswer MUST be 'none'. targetAnswer MUST be > 0 and correct per PV=nRT (computed with the locked variables AND every non-asked, non-changed variable held at their scenario initial values). tolerance ≈ 5% of |targetAnswer|.
7. SINGLE-PERTURBATION RULE (applies to predict AND calculate): Each challenge perturbs EXACTLY ONE variable — the one named in changeVariable. The instruction text MUST NOT describe any additional variable changes beyond changeVariable → changeNewValue. Any non-locked, non-asked, non-changed variable stays at its scenario initial value. A student reading the instruction should be able to compute targetAnswer using only the single perturbation.
8. Write grade-appropriate instruction/hint/narration and a clear askFor phrase.
9. If an eval mode is targeted, ALL challenges must share the same type (the schema enum will enforce this).

IDEAL GAS LAW (R = 0.0821 L·atm/(mol·K)):
- Boyle (constant T, n): P1·V1 = P2·V2.
- Charles (constant P, n): V1/T1 = V2/T2.
- Gay-Lussac (constant V, n): P1/T1 = P2/T2.
- Combined (constant n): P1·V1/T1 = P2·V2/T2.
- Ideal (all vary): PV = nRT.

DOUBLE-CHECK:
- For every predict/calculate challenge, verify targetAnswer numerically against PV=nRT with the locked variables held at their initial values.
- For every observe challenge, verify the direction matches what PV=nRT predicts (askedVariable increase/decrease/unchanged).
- Confirm every changeNewValue and every targetAnswer stays inside its sim range.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: constrainedSchema,
        systemInstruction:
          "You are an expert chemistry educator creating interactive ideal-gas-law activities for " +
          "grades 8-12. Your top priority is PHYSICAL ACCURACY: every numeric target must be computed " +
          "from PV=nRT with the locked variables held fixed. Never estimate — compute. Anchor hints in " +
          "kinetic molecular theory: faster particles = more forceful collisions = higher pressure; " +
          "less volume = more crowded particles = more collisions. Grade 8 students only get 'observe' " +
          "challenges; they reason directionally, not numerically.",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('No data returned from Gemini API for gas-laws-simulator');
    }

    const raw = JSON.parse(text) as Partial<GasLawsSimulatorData> & {
      scenario?: unknown;
      challenges?: unknown[];
    };

    // -----------------------------------------------------------------------
    // Scenario validation + normalization
    // -----------------------------------------------------------------------

    const scenario = normalizeScenario(raw.scenario, gradeBand);
    const initial: GasState = {
      P: scenario.initialP,
      V: scenario.initialV,
      T: scenario.initialT,
      n: scenario.initialN,
    };
    const lockedSet = new Set<GasVariable>(scenario.lockedVariables);

    // -----------------------------------------------------------------------
    // Per-challenge post-validation (THE critical step)
    // -----------------------------------------------------------------------

    const validated: GasLawsChallenge[] = [];
    const rawChallenges = Array.isArray(raw.challenges) ? (raw.challenges as Record<string, unknown>[]) : [];

    for (const chRaw of rawChallenges) {
      if (!chRaw || typeof chRaw !== 'object') continue;

      const id = chRaw.id;
      const typeRaw = chRaw.type;
      const instruction = chRaw.instruction;
      const hint = chRaw.hint;
      const narration = chRaw.narration;
      const askFor = chRaw.askFor;

      if (typeof id !== 'string' || !id.trim()) continue;
      if (typeof typeRaw !== 'string' || !['observe', 'predict', 'calculate'].includes(typeRaw)) continue;
      if (typeof instruction !== 'string' || !instruction.trim()) continue;
      if (typeof hint !== 'string' || !hint.trim()) continue;
      if (typeof askFor !== 'string' || !askFor.trim()) continue;

      const type = typeRaw as GasLawsChallenge['type'];

      // Reject types disallowed by grade-8 override or eval mode.
      if (effectiveAllowed && !effectiveAllowed.includes(type)) continue;

      const changeVariable = chRaw.changeVariable;
      const changeNewValueRaw = chRaw.changeNewValue;
      const askedVariableRaw = chRaw.askedVariable;

      if (!isGasVariable(changeVariable)) continue;
      if (!isGasVariable(askedVariableRaw)) continue;

      const changeNewValue = Number(changeNewValueRaw);
      if (!Number.isFinite(changeNewValue) || changeNewValue <= 0) continue;
      if (!inRange(changeVariable, changeNewValue)) continue;

      const askedVariable: GasVariable = askedVariableRaw;

      // Reconstruct the nested change object that the component reads.
      const change: GasLawsChange = {
        variable: changeVariable,
        newValue: changeNewValue,
      };

      const narrationFinal = typeof narration === 'string' && narration.trim()
        ? narration
        : `Observing ${askedVariable} after changing ${changeVariable}.`;

      if (type === 'observe') {
        // Direction must be a valid non-sentinel value.
        const dirRaw = chRaw.directionAnswer;
        let direction: DirectionAnswer | null = null;
        if (typeof dirRaw === 'string' && (DIRECTIONS as string[]).includes(dirRaw)) {
          direction = dirRaw as DirectionAnswer;
        }
        if (!direction) continue;

        // Verify against PV=nRT. If Gemini disagrees with the physics, trust the physics.
        const computedDir = expectedDirection(initial, scenario.lockedVariables, change, askedVariable);
        if (computedDir !== direction) {
          console.warn(
            `[gas-laws-simulator] Correcting directionAnswer for ${id}: ` +
            `gemini=${direction} computed=${computedDir}`,
          );
          direction = computedDir;
        }

        const ch: GasLawsChallenge = {
          id,
          type: 'observe',
          instruction,
          hint,
          narration: narrationFinal,
          askFor,
          change,
          askedVariable,
          directionAnswer: direction,
          targetAnswer: 0,
          tolerance: 0,
        };
        validated.push(ch);
      } else {
        // predict / calculate: numeric answer required.
        const targetRaw = Number(chRaw.targetAnswer);
        if (!Number.isFinite(targetRaw) || targetRaw <= 0) continue;

        // If askedVariable is locked, the component can't reason about it meaningfully.
        // We allow it only if askedVariable differs from changeVariable AND is not locked.
        if (lockedSet.has(askedVariable)) continue;
        if (askedVariable === changeVariable) continue;

        // Compute the expected numeric value from physics.
        const expectedState = solveExpectedState(
          initial,
          scenario.lockedVariables,
          change,
          askedVariable,
        );
        const expectedValue = expectedState[askedVariable];
        if (!Number.isFinite(expectedValue) || expectedValue <= 0) continue;
        if (!inRange(askedVariable, expectedValue)) continue;

        let finalTarget = targetRaw;
        const drift = Math.abs(targetRaw - expectedValue) / Math.max(Math.abs(expectedValue), 1e-6);
        if (drift > 0.10) {
          console.warn(
            `[gas-laws-simulator] Correcting targetAnswer for ${id}: ` +
            `gemini=${targetRaw} computed=${expectedValue.toFixed(4)} (drift ${(drift * 100).toFixed(1)}%)`,
          );
          finalTarget = expectedValue;
        }
        finalTarget = Math.round(finalTarget * 1000) / 1000;

        const toleranceRaw = Number(chRaw.tolerance);
        let tolerance = Number.isFinite(toleranceRaw) && toleranceRaw > 0
          ? toleranceRaw
          : 0;
        if (tolerance <= 0) {
          tolerance = Math.max(0.05 * Math.abs(finalTarget), 0.01);
        }
        tolerance = Math.round(tolerance * 1000) / 1000;

        const ch: GasLawsChallenge = {
          id,
          type,
          instruction,
          hint,
          narration: narrationFinal,
          askFor,
          change,
          askedVariable,
          directionAnswer: null,
          targetAnswer: finalTarget,
          tolerance,
        };
        validated.push(ch);
      }
    }

    // -----------------------------------------------------------------------
    // Fallback if everything got rejected
    // -----------------------------------------------------------------------

    let challenges = validated;
    if (challenges.length === 0) {
      console.warn('[gas-laws-simulator] All Gemini challenges rejected — using hardcoded fallback set');
      const fbScenario: GasLawsScenario =
        gradeBand === '8'
          ? { ...FALLBACK_SCENARIO, lawFocus: 'kmt_only', lockedVariables: deriveLocked('kmt_only') }
          : FALLBACK_SCENARIO;
      challenges = buildFallbackChallenges(fbScenario, effectiveAllowed);
      // If we substituted scenario, propagate.
      if (gradeBand === '8') {
        scenario.lawFocus = 'kmt_only';
        scenario.lockedVariables = deriveLocked('kmt_only');
        scenario.initialP = FALLBACK_SCENARIO.initialP;
        scenario.initialV = FALLBACK_SCENARIO.initialV;
        scenario.initialT = FALLBACK_SCENARIO.initialT;
        scenario.initialN = FALLBACK_SCENARIO.initialN;
      }
    }

    // -----------------------------------------------------------------------
    // Assemble final result
    // -----------------------------------------------------------------------

    const showOptions = raw.showOptions ?? undefined;

    const result: GasLawsSimulatorData = {
      title: raw.title || 'Gas Laws Lab',
      description: raw.description || 'Drag the piston, heat the gas, and watch PV = nRT unfold.',
      gradeBand: (raw.gradeBand as GasLawsSimulatorData['gradeBand']) || gradeBand,
      scenario,
      challenges,
      ...(showOptions ? { showOptions } : {}),
    };

    console.log('\uD83C\uDF88 Gas Laws Simulator Generated:', {
      title: result.title,
      gradeBand: result.gradeBand,
      lawFocus: scenario.lawFocus,
      lockedVariables: scenario.lockedVariables,
      challengeCount: result.challenges.length,
      challengeTypes: result.challenges.map(c => c.type),
      evalMode: config?.targetEvalMode ?? 'mixed',
    });

    return result;
  } catch (error) {
    console.error('Error generating gas-laws-simulator data:', error);

    // Absolute last-resort fallback
    const fbScenario: GasLawsScenario =
      gradeBand === '8'
        ? { ...FALLBACK_SCENARIO, lawFocus: 'kmt_only', lockedVariables: deriveLocked('kmt_only') }
        : FALLBACK_SCENARIO;
    return {
      title: 'Gas Laws Lab',
      description: 'Drag the piston, heat the gas, and watch PV = nRT unfold.',
      gradeBand,
      scenario: fbScenario,
      challenges: buildFallbackChallenges(fbScenario, allowedTypesForGrade ?? (constraint?.allowedTypes ?? null)),
    };
  }
};
