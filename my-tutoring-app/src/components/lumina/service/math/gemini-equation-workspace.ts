import { Type, Schema, ThinkingLevel } from "@google/genai";
import {
  EquationWorkspaceData,
  EquationWorkspaceChallenge,
  EquationWorkspaceSolutionStep,
  EquationWorkspaceOperation,
} from "../../primitives/visual-primitives/math/EquationWorkspace";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  "guided-solve": {
    promptDoc:
      `"guided-solve": Easiest mode. The student applies algebraic operations step-by-step ` +
      `to isolate the target variable. The UI highlights the correct next operation as a hint. ` +
      `Good for learning the sequence of operations.`,
    schemaDescription: "'guided-solve' (step-by-step with hints)",
  },
  solve: {
    promptDoc:
      `"solve": Standard mode. Student picks operations freely to isolate the target variable. ` +
      `No highlighting — student must reason about which operation to apply next. ` +
      `Medium difficulty.`,
    schemaDescription: "'solve' (free-form algebraic solving)",
  },
  "multi-step": {
    promptDoc:
      `"multi-step": Hard mode. Longer equations requiring 4+ algebraic steps to solve. ` +
      `Tests fluency with multi-operation manipulation (distribute, combine like terms, etc.).`,
    schemaDescription: "'multi-step' (4+ step complex equations)",
  },
  "identify-operation": {
    promptDoc:
      `"identify-operation": MC mode. Given an equation and target variable, the student ` +
      `identifies which operation should be applied NEXT. Tests conceptual understanding ` +
      `without requiring the student to execute the full solve.`,
    schemaDescription: "'identify-operation' (MC next-step identification)",
  },
};

// ---------------------------------------------------------------------------
// Grade-appropriate equation guidance
// ---------------------------------------------------------------------------

function getEquationGuidance(gradeLevel: string): string {
  if (/[7-8]|middle/i.test(gradeLevel)) {
    return (
      "Use simple linear equations: ax + b = c, x/a + b = c. " +
      "Operations: add/subtract constants, multiply/divide by coefficients. " +
      "Avoid trig, logs, radicals."
    );
  }
  if (/9|algebra.*1/i.test(gradeLevel)) {
    return (
      "Use linear equations with distribution and combining like terms: " +
      "a(x + b) = c, ax + b = cx + d. May include simple fractions. " +
      "Operations: distribute, combine like terms, add/subtract variable terms, divide."
    );
  }
  if (/10|geometry|algebra.*2/i.test(gradeLevel)) {
    return (
      "Use quadratic-adjacent and multi-variable formulas: " +
      "A = lw, V = lwh, d = rt, ax^2 + bx = c (factorable). " +
      "Include square roots and simple radical operations."
    );
  }
  if (/11|12|pre.?calc|calc|trig/i.test(gradeLevel)) {
    return (
      "Use formulas from physics, trig, and pre-calc: " +
      "V = IR, F = ma, sin(x) = a/c, A = Pe^{rt}, log equations. " +
      "Include trig, logarithmic, and exponential operations."
    );
  }
  // Default: algebra level
  return (
    "Use standard algebraic equations: ax + b = c, formulas like d = rt. " +
    "Include a mix of arithmetic and algebraic operations."
  );
}

// ---------------------------------------------------------------------------
// Schemas — flat indexed fields per challenge type
// ---------------------------------------------------------------------------

/** Shared fields across all schemas */
function sharedProperties(): Record<string, Schema> {
  return {
    title: { type: Type.STRING, description: "Title for the equation workspace session" } as Schema,
    context: { type: Type.STRING, description: "Brief real-world context or motivation for this equation" } as Schema,
    instruction: { type: Type.STRING, description: "What the student should do. Do NOT reveal the answer." } as Schema,
    equation: { type: Type.STRING, description: "The equation in LaTeX. Use \\cdot for multiplication, \\frac{a}{b} for fractions, \\sqrt{x}, \\sin, \\log, etc." } as Schema,
    targetVariable: { type: Type.STRING, description: "The variable to isolate (e.g. 'x', 'R', 't')" } as Schema,
  };
}

/** Flat step fields for N steps */
function stepFields(count: number): Record<string, Schema> {
  const fields: Record<string, Schema> = {};
  for (let i = 0; i < count; i++) {
    fields[`step${i}Operation`] = {
      type: Type.STRING,
      description: `Step ${i + 1}: human-readable description of the operation (e.g. "Subtract 3 from both sides")`,
    } as Schema;
    fields[`step${i}OperationId`] = {
      type: Type.STRING,
      description: `Step ${i + 1}: machine ID matching one of the op*Id fields (e.g. "algebraic_subtract_3")`,
    } as Schema;
    fields[`step${i}ResultLatex`] = {
      type: Type.STRING,
      description: `Step ${i + 1}: the resulting equation in LaTeX after applying this operation`,
    } as Schema;
  }
  return fields;
}

/** Flat operation fields for N operations */
function operationFields(count: number): Record<string, Schema> {
  const fields: Record<string, Schema> = {};
  for (let i = 0; i < count; i++) {
    fields[`op${i}Id`] = {
      type: Type.STRING,
      description: `Operation ${i + 1}: unique ID like "algebraic_subtract_3" or "arithmetic_divide_2"`,
    } as Schema;
    fields[`op${i}Label`] = {
      type: Type.STRING,
      description: `Operation ${i + 1}: human-readable label (e.g. "Subtract 3 from both sides")`,
    } as Schema;
    fields[`op${i}Category`] = {
      type: Type.STRING,
      description: `Operation ${i + 1}: one of 'arithmetic', 'algebraic', 'trigonometric', 'logarithmic', 'radical'`,
      enum: ["arithmetic", "algebraic", "trigonometric", "logarithmic", "radical"],
    } as Schema;
  }
  return fields;
}

// guided-solve and solve: 3 steps, 6 operations
const guidedSolveSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ...sharedProperties(),
    ...stepFields(3),
    ...operationFields(6),
  },
  required: [
    "title", "context", "instruction", "equation", "targetVariable",
    "step0Operation", "step0OperationId", "step0ResultLatex",
    "step1Operation", "step1OperationId", "step1ResultLatex",
    "step2Operation", "step2OperationId", "step2ResultLatex",
    "op0Id", "op0Label", "op0Category",
    "op1Id", "op1Label", "op1Category",
    "op2Id", "op2Label", "op2Category",
    "op3Id", "op3Label", "op3Category",
    "op4Id", "op4Label", "op4Category",
    "op5Id", "op5Label", "op5Category",
  ],
};

// solve: same schema structure as guided-solve
const solveSchema: Schema = guidedSolveSchema;

// multi-step: 5 steps, 8 operations
const multiStepSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ...sharedProperties(),
    ...stepFields(5),
    ...operationFields(8),
  },
  required: [
    "title", "context", "instruction", "equation", "targetVariable",
    "step0Operation", "step0OperationId", "step0ResultLatex",
    "step1Operation", "step1OperationId", "step1ResultLatex",
    "step2Operation", "step2OperationId", "step2ResultLatex",
    "step3Operation", "step3OperationId", "step3ResultLatex",
    "step4Operation", "step4OperationId", "step4ResultLatex",
    "op0Id", "op0Label", "op0Category",
    "op1Id", "op1Label", "op1Category",
    "op2Id", "op2Label", "op2Category",
    "op3Id", "op3Label", "op3Category",
    "op4Id", "op4Label", "op4Category",
    "op5Id", "op5Label", "op5Category",
    "op6Id", "op6Label", "op6Category",
    "op7Id", "op7Label", "op7Category",
  ],
};

// identify-operation: 1 step (just need the first step), 5 operations, plus correctOperationId
const identifyOperationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ...sharedProperties(),
    ...stepFields(2),
    ...operationFields(5),
    correctOperationId: {
      type: Type.STRING,
      description: "The ID of the correct next operation (must match one of the op*Id fields)",
    } as Schema,
  },
  required: [
    "title", "context", "instruction", "equation", "targetVariable",
    "step0Operation", "step0OperationId", "step0ResultLatex",
    "step1Operation", "step1OperationId", "step1ResultLatex",
    "op0Id", "op0Label", "op0Category",
    "op1Id", "op1Label", "op1Category",
    "op2Id", "op2Label", "op2Category",
    "op3Id", "op3Label", "op3Category",
    "op4Id", "op4Label", "op4Category",
    "correctOperationId",
  ],
};

// ---------------------------------------------------------------------------
// Flat field → array reconstruction
// ---------------------------------------------------------------------------

function reconstructSteps(
  data: Record<string, unknown>,
  maxSteps: number,
): EquationWorkspaceSolutionStep[] {
  const steps: EquationWorkspaceSolutionStep[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const operation = data[`step${i}Operation`] as string | undefined;
    const operationId = data[`step${i}OperationId`] as string | undefined;
    const resultLatex = data[`step${i}ResultLatex`] as string | undefined;
    if (operation && operationId && resultLatex) {
      // Drop degenerate no-op steps where resultLatex is unchanged from the
      // previous step (Gemini sometimes pads with "multiply by 1" or "add 0").
      const prevLatex = steps.length > 0 ? steps[steps.length - 1].resultLatex : null;
      if (prevLatex && resultLatex.replace(/\s/g, "") === prevLatex.replace(/\s/g, "")) {
        continue;
      }
      // Drop "check/verify" padding steps that don't advance the solve
      if (/\b(check|verify|confirm|substitute.*back)\b/i.test(operation)) {
        continue;
      }
      steps.push({ operation, operationId, resultLatex });
    }
  }
  return steps;
}

function reconstructOperations(
  data: Record<string, unknown>,
  maxOps: number,
): EquationWorkspaceOperation[] {
  const ops: EquationWorkspaceOperation[] = [];
  const validCategories = new Set([
    "arithmetic",
    "algebraic",
    "trigonometric",
    "logarithmic",
    "radical",
  ]);
  for (let i = 0; i < maxOps; i++) {
    const id = data[`op${i}Id`] as string | undefined;
    const label = data[`op${i}Label`] as string | undefined;
    const category = data[`op${i}Category`] as string | undefined;
    if (id && label && category) {
      const safeCategory = validCategories.has(category) ? category : "algebraic";
      ops.push({
        id,
        label,
        category: safeCategory as EquationWorkspaceOperation["category"],
      });
    }
  }
  return ops;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

function validateChallenge(
  challenge: EquationWorkspaceChallenge,
): ValidationResult {
  if (!challenge.equation || challenge.equation.trim() === "") {
    return { valid: false, reason: "empty equation" };
  }
  if (!challenge.targetVariable || challenge.targetVariable.trim() === "") {
    return { valid: false, reason: "empty targetVariable" };
  }
  if (!challenge.solutionSteps || challenge.solutionSteps.length < 1) {
    return { valid: false, reason: "no solution steps" };
  }
  if (
    challenge.type === "multi-step" &&
    challenge.solutionSteps.length < 4
  ) {
    return {
      valid: false,
      reason: `multi-step needs 4+ steps, got ${challenge.solutionSteps.length}`,
    };
  }
  for (let i = 0; i < challenge.solutionSteps.length; i++) {
    const s = challenge.solutionSteps[i];
    if (!s.operation || !s.operationId || !s.resultLatex) {
      return { valid: false, reason: `step ${i} has empty fields` };
    }
  }
  if (!challenge.availableOperations || challenge.availableOperations.length < 4) {
    return {
      valid: false,
      reason: `need 4+ operations, got ${challenge.availableOperations?.length ?? 0}`,
    };
  }

  // Verify all solution step operationIds appear in availableOperations
  const opIdSet = new Set(challenge.availableOperations.map((o) => o.id));
  for (const step of challenge.solutionSteps) {
    if (!opIdSet.has(step.operationId)) {
      return {
        valid: false,
        reason: `step operationId "${step.operationId}" not in availableOperations`,
      };
    }
  }

  // identify-operation specific
  if (challenge.type === "identify-operation") {
    if (!challenge.correctOperationId) {
      return { valid: false, reason: "missing correctOperationId" };
    }
    if (!opIdSet.has(challenge.correctOperationId)) {
      return {
        valid: false,
        reason: `correctOperationId "${challenge.correctOperationId}" not in availableOperations`,
      };
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Hardcoded fallback (simple V=IR solve-for-R)
// ---------------------------------------------------------------------------

function fallbackChallenges(): EquationWorkspaceChallenge[] {
  return [
    {
      id: "fallback-1",
      type: "solve",
      instruction: "Solve for R in Ohm's Law.",
      equation: "V = I \\cdot R",
      targetVariable: "R",
      solutionSteps: [
        {
          operation: "Divide both sides by I",
          operationId: "algebraic_divide_I",
          resultLatex: "\\frac{V}{I} = R",
        },
      ],
      availableOperations: [
        { id: "algebraic_divide_I", label: "Divide both sides by I", category: "algebraic" },
        { id: "algebraic_multiply_I", label: "Multiply both sides by I", category: "algebraic" },
        { id: "arithmetic_subtract_V", label: "Subtract V from both sides", category: "arithmetic" },
        { id: "algebraic_divide_R", label: "Divide both sides by R", category: "algebraic" },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Sub-generators — one Gemini call per challenge type
// ---------------------------------------------------------------------------

type ChallengeType = EquationWorkspaceChallenge["type"];

interface SubGenConfig {
  schema: Schema;
  maxSteps: number;
  maxOps: number;
  challengeType: ChallengeType;
}

const SUB_GEN_CONFIGS: Record<ChallengeType, SubGenConfig> = {
  "guided-solve": { schema: guidedSolveSchema, maxSteps: 3, maxOps: 6, challengeType: "guided-solve" },
  solve: { schema: solveSchema, maxSteps: 3, maxOps: 6, challengeType: "solve" },
  "multi-step": { schema: multiStepSchema, maxSteps: 5, maxOps: 8, challengeType: "multi-step" },
  "identify-operation": { schema: identifyOperationSchema, maxSteps: 2, maxOps: 5, challengeType: "identify-operation" },
};

async function generateSingleChallenge(
  type: ChallengeType,
  topic: string,
  gradeLevel: string,
  index: number,
): Promise<EquationWorkspaceChallenge | null> {
  const cfg = SUB_GEN_CONFIGS[type];
  const typeDoc = CHALLENGE_TYPE_DOCS[type];

  const prompt = `
Generate ONE algebraic equation challenge for a ${gradeLevel} student learning "${topic}".

Challenge type: ${type}
${typeDoc.promptDoc}

${getEquationGuidance(gradeLevel)}

RULES:
- The equation MUST be in valid LaTeX (use \\cdot for multiplication, \\frac{a}{b} for fractions, \\sqrt{x}, \\sin, \\log)
- Provide the CANONICAL solution path as sequential steps
- Each step's operationId MUST match exactly one of the op*Id fields
- Include ${cfg.maxOps} operations total: the correct ones plus plausible distractors
- Distractor operations should be related but wrong (e.g., adding instead of subtracting)
- Do NOT reveal the answer in the instruction text
- Do NOT include "check" or "verify" steps — only include steps that transform the equation
- The instruction should tell the student to solve for the target variable${type === "identify-operation" ? " by choosing the correct next operation" : ""}
${type === "multi-step" ? "- The equation MUST genuinely require 4-5 distinct algebraic steps (e.g. distribute, combine like terms, isolate variable term, divide). NEVER pad with identity operations like 'multiply by 1', 'add 0', or 'verify/check'. Every step must change the equation. Use equations like: a(bx + c) + dx = e, or a(x + b) - c(x - d) = e." : ""}
${type === "identify-operation" ? "- Set correctOperationId to the op*Id of the FIRST correct step (step0OperationId)" : ""}

IMPORTANT:
- Each step${index}OperationId must EXACTLY match one of the op*Id values you provide
- operation categories must be one of: arithmetic, algebraic, trigonometric, logarithmic, radical
- Give each operation a UNIQUE id that encodes its category and action (e.g. "algebraic_subtract_3", "arithmetic_divide_2")
`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: cfg.schema,
      },
    });

    const data = result.text ? JSON.parse(result.text) : null;
    if (!data) {
      console.warn(`[EquationWorkspace] No data returned for ${type} challenge ${index}`);
      return null;
    }

    // Reconstruct arrays from flat fields
    const solutionSteps = reconstructSteps(data, cfg.maxSteps);
    const availableOperations = reconstructOperations(data, cfg.maxOps);

    const challenge: EquationWorkspaceChallenge = {
      id: `eq-${type}-${index}`,
      type,
      instruction: data.instruction ?? "",
      equation: data.equation ?? "",
      targetVariable: data.targetVariable ?? "",
      solutionSteps,
      availableOperations,
    };

    // For identify-operation, wire correctOperationId
    if (type === "identify-operation") {
      challenge.correctOperationId =
        (data.correctOperationId as string) ||
        (solutionSteps[0]?.operationId ?? "");
    }

    // Validate
    const validation = validateChallenge(challenge);
    if (!validation.valid) {
      console.warn(
        `[EquationWorkspace] Rejected ${type} challenge ${index}: ${validation.reason}`,
      );
      return null;
    }

    return challenge;
  } catch (err) {
    console.error(`[EquationWorkspace] Error generating ${type} challenge ${index}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export const generateEquationWorkspace = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<EquationWorkspaceData> => {
  const evalConstraint = resolveEvalModeConstraint(
    "equation-workspace",
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution("EquationWorkspace", config?.targetEvalMode, evalConstraint);

  // Determine which challenge types to generate
  let typePlan: ChallengeType[];

  if (evalConstraint && evalConstraint.allowedTypes.length > 0) {
    // Eval mode targets specific type(s) — generate 4-5 of that type
    const targetType = evalConstraint.allowedTypes[0] as ChallengeType;
    typePlan = [targetType, targetType, targetType, targetType];
    if (evalConstraint.allowedTypes.length > 1) {
      typePlan.push(evalConstraint.allowedTypes[1] as ChallengeType);
    } else {
      typePlan.push(targetType);
    }
  } else {
    // No eval mode — generate a balanced mix
    typePlan = [
      "guided-solve",
      "identify-operation",
      "solve",
      "solve",
      "multi-step",
    ];
  }

  // Generate all challenges in parallel
  const results = await Promise.all(
    typePlan.map((type, idx) =>
      generateSingleChallenge(type, topic, gradeLevel, idx),
    ),
  );

  // Filter out nulls (rejected/failed challenges)
  const validChallenges = results.filter(
    (c): c is EquationWorkspaceChallenge => c !== null,
  );

  const rejectedCount = results.length - validChallenges.length;
  if (rejectedCount > 0) {
    console.warn(
      `[EquationWorkspace] ${rejectedCount}/${results.length} challenges rejected`,
    );
  }

  // Assign unique IDs
  validChallenges.forEach((ch, idx) => {
    ch.id = `eq-${ch.type}-${idx}`;
  });

  // Fallback if all challenges were rejected
  const challenges =
    validChallenges.length > 0 ? validChallenges : fallbackChallenges();

  return {
    title: `Equation Workspace: ${topic}`,
    context: `Solve equations by applying algebraic operations step by step.`,
    challenges,
  };
};
