import { Type, Schema } from "@google/genai";
import { NumberBondData } from "../../primitives/visual-primitives/math/NumberBond";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  decompose: {
    promptDoc:
      `"decompose": Student finds ALL ways to split a whole into two parts. `
      + `part1 and part2 should be null (student discovers them). `
      + `allPairs MUST include every unique pair [a, b] where a + b = whole and a <= b. `
      + `Example for whole=5: [[0,5],[1,4],[2,3]]. Concrete manipulative with full guidance.`,
    schemaDescription: "'decompose' (find all pairs)",
  },
  'missing-part': {
    promptDoc:
      `"missing-part": Given the whole and one part, find the other. `
      + `Set part1 to the known part, part2 to null (student finds it). `
      + `Choose part1 values that are not trivially 0 or equal to whole. `
      + `Pictorial representation with prompts.`,
    schemaDescription: "'missing-part' (find unknown part)",
  },
  'fact-family': {
    promptDoc:
      `"fact-family": Student identifies all 4 related equations. `
      + `Set part1 and part2 to the two parts. `
      + `factFamily MUST have exactly 4 equations: ["a+b=w","b+a=w","w-a=b","w-b=a"]. `
      + `Example for 2,3,5: ["2+3=5","3+2=5","5-2=3","5-3=2"]. Grade 1 only.`,
    schemaDescription: "'fact-family' (all 4 equations)",
  },
  'build-equation': {
    promptDoc:
      `"build-equation": Student constructs a specific equation from the bond. `
      + `Set part1 and part2 to the two parts. `
      + `targetEquation to the equation string — MIX addition AND subtraction forms across challenges. `
      + `Use all 4 fact-family forms: "p1+p2=w", "p2+p1=w", "w-p1=p2", "w-p2=p1". `
      + `Example targets for 3,4,7: "3+4=7", "7-3=4", "7-4=3". `
      + `Grade 1 only. Transitional symbolic/pictorial.`,
    schemaDescription: "'build-equation' (construct equation — mix + and −)",
  },
};

// ---------------------------------------------------------------------------
// Per-type field relevance — controls which fields appear in the schema
// ---------------------------------------------------------------------------

/** Fields relevant to each challenge type (beyond the always-required id/type/instruction/whole) */
const CHALLENGE_TYPE_FIELDS: Record<string, string[]> = {
  decompose: ['allPairs'],
  'missing-part': ['part1'],
  'fact-family': ['part1', 'part2', 'factFamily'],
  'build-equation': ['part1', 'part2', 'targetEquation'],
};

/** All optional challenge-level field definitions (reusable across schema builds) */
const OPTIONAL_FIELD_SCHEMAS: Record<string, Schema> = {
  part1: {
    type: Type.NUMBER,
    description: "First part (nullable — null when student must find it). For missing-part: the known part.",
    nullable: true,
  },
  part2: {
    type: Type.NUMBER,
    description: "Second part (nullable — null when student must find it).",
    nullable: true,
  },
  allPairs: {
    type: Type.ARRAY,
    items: { type: Type.ARRAY, items: { type: Type.NUMBER } },
    description: "ALL valid pairs [a, b] where a + b = whole and a <= b. E.g., for 5: [[0,5],[1,4],[2,3]].",
  },
  factFamily: {
    type: Type.ARRAY,
    items: { type: Type.STRING },
    description: "All 4 related equations. E.g., ['2+3=5','3+2=5','5-2=3','5-3=2'].",
  },
  targetEquation: {
    type: Type.STRING,
    description: "The equation to construct (e.g., '3+2=5').",
  },
};

// ---------------------------------------------------------------------------
// Schema builder
// ---------------------------------------------------------------------------

/**
 * Build a Gemini schema tailored to the allowed challenge types.
 * When constrained to a single type (e.g. decompose-only), irrelevant
 * fields like factFamily / targetEquation are omitted entirely so the
 * LLM focuses on the fields that matter.
 */
function buildNumberBondSchema(allowedTypes?: string[]): Schema {
  // Determine which optional fields to include
  const types = allowedTypes ?? Object.keys(CHALLENGE_TYPE_FIELDS);
  const fieldSet: Record<string, boolean> = {};
  for (let ti = 0; ti < types.length; ti++) {
    const fields = CHALLENGE_TYPE_FIELDS[types[ti]] ?? [];
    for (let fi = 0; fi < fields.length; fi++) {
      fieldSet[fields[fi]] = true;
    }
  }

  // Build challenge item properties — always include core fields
  const challengeProps: Record<string, Schema> = {
    id: { type: Type.STRING, description: "Unique challenge ID (e.g., 'c1', 'c2')" },
    type: {
      type: Type.STRING,
      description: types.length === 1
        ? `Challenge type: always '${types[0]}'`
        : `Challenge type: ${types.map(t => CHALLENGE_TYPE_DOCS[t]?.schemaDescription ?? t).join(', ')}`,
      ...(allowedTypes ? { enum: allowedTypes } : {}),
    },
    instruction: {
      type: Type.STRING,
      description: "Student-facing instruction, warm and encouraging. MUST reference the same 'whole' number used in the challenge.",
    },
    whole: { type: Type.NUMBER, description: "The whole number in the bond (e.g., 5). The instruction MUST match this number." },
  };

  // Add only the relevant optional fields
  const activeFields = Object.keys(fieldSet);
  for (let i = 0; i < activeFields.length; i++) {
    const field = activeFields[i];
    if (OPTIONAL_FIELD_SCHEMAS[field]) {
      challengeProps[field] = OPTIONAL_FIELD_SCHEMAS[field];
    }
  }

  return {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "Title for the number bond activity (e.g., 'Break Apart 5!', 'Number Bond Fun')",
      },
      description: {
        type: Type.STRING,
        description: "Brief educational description of what students will learn",
      },
      maxNumber: {
        type: Type.NUMBER,
        description: "Maximum whole number used in challenges. 5 for Kindergarten, 10 for Grade 1.",
      },
      showCounters: {
        type: Type.BOOLEAN,
        description: "Whether to show visual counters (dots) alongside the bond diagram",
      },
      showEquation: {
        type: Type.BOOLEAN,
        description: "Whether to display the equation representation below the bond",
      },
      gradeBand: {
        type: Type.STRING,
        description: "Grade band: 'K' for Kindergarten, '1' for Grade 1",
      },
      challenges: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: challengeProps,
          required: ["id", "type", "instruction", "whole"],
        },
        description: `Array of 3-6 progressive challenges${types.length === 1 ? ` (all type '${types[0]}')` : ''}`,
      },
    },
    required: ["title", "description", "maxNumber", "showCounters", "showEquation", "gradeBand", "challenges"],
  };
}

// ---------------------------------------------------------------------------
// Instruction ↔ whole consistency helpers
// ---------------------------------------------------------------------------

/** Check whether the instruction text mentions the correct whole number */
function instructionMatchesWhole(instruction: string | undefined, whole: number): boolean {
  if (!instruction) return false;
  // Look for the whole number as a standalone token (not part of a larger number)
  const regex = new RegExp(`\\b${whole}\\b`);
  return regex.test(instruction);
}

/** Generate a safe instruction that always references the correct whole */
function generateInstruction(type: string, whole: number): string {
  switch (type) {
    case 'decompose':
      return `Find all the ways to break apart ${whole}. How many pairs can you find?`;
    case 'missing-part':
      return `The whole is ${whole}. One part is shown — can you find the missing part?`;
    case 'fact-family':
      return `Write all 4 equations for this number bond with ${whole}.`;
    case 'build-equation':
      return `Use the tiles to build an equation with ${whole}.`;
    default:
      return `Work with the number ${whole}.`;
  }
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate number bond data for interactive part-part-whole activities
 *
 * Grade-aware content:
 * - Kindergarten (K): maxNumber 5, focus on decompose and missing-part
 * - Grade 1: maxNumber 10, include all 4 challenge types
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns NumberBondData with complete configuration
 */
export const generateNumberBond = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{
    maxNumber: number;
    challengeTypes: string[];
    challengeCount: number;
    /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
    targetEvalMode: string;
  }>
): Promise<NumberBondData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'number-bond',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // For config.challengeTypes without an eval mode, use them as a hint
  const effectiveChallengeTypes = evalConstraint?.allowedTypes ?? config?.challengeTypes;

  // ── Build mode-constrained schema (strips irrelevant fields per type) ──
  const activeSchema = buildNumberBondSchema(evalConstraint?.allowedTypes ?? effectiveChallengeTypes);

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create an educational number bond activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A number bond shows part-part-whole relationships: a whole number connected to two parts that add up to it
- Students learn to decompose numbers, find missing parts, build equations, and understand fact families
- This builds addition/subtraction fluency through visual part-part-whole reasoning

${challengeTypeSection}

${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * maxNumber: 5 (wholes range from 2 to 5)
  * Focus on 'decompose' and 'missing-part' types ONLY
  * Use warm, playful language ("Can you break apart 4? How many ways?")
  * showCounters: true (visual dots help young learners)
  * showEquation: false (K students work visually, not symbolically)

- Grade 1 (gradeBand "1"):
  * maxNumber: 10 (wholes range from 3 to 10)
  * Include ALL 4 types: decompose, missing-part, fact-family, build-equation
  * More formal but still encouraging language
  * showCounters: true
  * showEquation: true (Grade 1 connects bonds to equations)
` : ''}

${(() => {
  const hints: string[] = [];
  if (config?.maxNumber) hints.push(`- Max number: ${config.maxNumber}`);
  if (effectiveChallengeTypes) hints.push(`- Challenge types to include: ${effectiveChallengeTypes.join(', ')}`);
  if (config?.challengeCount) hints.push(`- Number of challenges: ${config.challengeCount}`);
  return hints.length > 0 ? `CONFIGURATION HINTS:\n${hints.join('\n')}` : '';
})()}

REQUIREMENTS:
1. Generate ${config?.challengeCount || '3-5'} challenges that progress in difficulty
2. Start with smaller wholes and simpler types, increase gradually
3. Use warm, encouraging instruction text for young children
4. For Kindergarten: ONLY use 'decompose' and 'missing-part' types
5. For Grade 1: mix all 4 types, progressing from decompose to build-equation
6. For decompose challenges, allPairs MUST include ALL valid unique pairs (a <= b)
7. For fact-family challenges, factFamily MUST have exactly 4 equations
8. Vary the whole numbers across challenges (don't repeat the same whole consecutively)
9. Ensure part1 + part2 = whole whenever parts are specified
10. For missing-part, choose part1 values that are not trivially 0 or equal to whole
11. CRITICAL: Each challenge's "instruction" text MUST reference the SAME number as its "whole" field. If whole is 5, the instruction must say 5 — never a different number.

Return the complete number bond configuration.
`;

  logEvalModeResolution('NumberBond', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid number bond data returned from Gemini API');
  }

  // ---- Validation & defaults ----

  // Validate gradeBand
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  // Validate maxNumber
  if (!data.maxNumber || data.maxNumber < 2) {
    data.maxNumber = data.gradeBand === 'K' ? 5 : 10;
  }
  if (data.gradeBand === 'K' && data.maxNumber > 5) {
    data.maxNumber = 5;
  }
  if (data.maxNumber > 10) {
    data.maxNumber = 10;
  }

  // Ensure booleans
  if (typeof data.showCounters !== 'boolean') {
    data.showCounters = true;
  }
  if (typeof data.showEquation !== 'boolean') {
    data.showEquation = data.gradeBand === '1';
  }

  // Valid challenge types (safety net — schema enum handles eval mode case)
  const validTypes = ['decompose', 'missing-part', 'fact-family', 'build-equation'];
  const kOnlyTypes = ['decompose', 'missing-part'];

  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validTypes.includes(c.type)
  );

  // For K, strip out fact-family and build-equation
  if (data.gradeBand === 'K') {
    data.challenges = data.challenges.filter(
      (c: { type: string }) => kOnlyTypes.includes(c.type)
    );
  }

  // Per-challenge validation
  let buildEqIndex = 0;
  for (const challenge of data.challenges) {
    // Capture original whole before clamping (to detect instruction drift)
    const originalWhole = challenge.whole;

    // Ensure whole is within range
    if (!challenge.whole || challenge.whole < 2) {
      challenge.whole = data.gradeBand === 'K' ? 4 : 7;
    }
    if (challenge.whole > data.maxNumber) {
      challenge.whole = data.maxNumber;
    }

    // If whole was clamped, the instruction likely references the wrong number — regenerate it
    if (originalWhole !== challenge.whole || !instructionMatchesWhole(challenge.instruction, challenge.whole)) {
      challenge.instruction = generateInstruction(challenge.type, challenge.whole);
    }

    // Compute allPairs for decompose if missing or incomplete
    if (challenge.type === 'decompose') {
      const expectedPairs: [number, number][] = [];
      for (let a = 0; a <= Math.floor(challenge.whole / 2); a++) {
        expectedPairs.push([a, challenge.whole - a]);
      }
      // Always recompute — never trust Gemini's allPairs
      challenge.allPairs = expectedPairs;
      // Nullify parts for decompose (student discovers them)
      challenge.part1 = null;
      challenge.part2 = null;
    }

    // Validate missing-part
    if (challenge.type === 'missing-part') {
      if (challenge.part1 == null || challenge.part1 < 0 || challenge.part1 >= challenge.whole) {
        challenge.part1 = Math.max(1, Math.floor(challenge.whole / 2));
      }
      challenge.part2 = null;
      challenge.allPairs = null;
      challenge.factFamily = null;
      challenge.targetEquation = null;
    }

    // Validate fact-family
    if (challenge.type === 'fact-family') {
      const p1 = challenge.part1 ?? Math.max(1, Math.floor(challenge.whole / 3));
      const p2 = challenge.whole - p1;
      challenge.part1 = p1;
      challenge.part2 = p2;
      // Ensure exactly 4 equations
      challenge.factFamily = [
        `${p1}+${p2}=${challenge.whole}`,
        `${p2}+${p1}=${challenge.whole}`,
        `${challenge.whole}-${p1}=${p2}`,
        `${challenge.whole}-${p2}=${p1}`
      ];
      challenge.allPairs = null;
      challenge.targetEquation = null;
    }

    // Validate build-equation
    if (challenge.type === 'build-equation') {
      const p1 = challenge.part1 ?? Math.max(1, Math.floor(challenge.whole / 2));
      const p2 = challenge.whole - p1;
      challenge.part1 = p1;
      challenge.part2 = p2;

      // Validate targetEquation — must use the correct numbers and be mathematically valid
      if (challenge.targetEquation) {
        const eq = challenge.targetEquation.replace(/\s+/g, '');
        const w = challenge.whole;
        const validForms = [
          `${p1}+${p2}=${w}`, `${p2}+${p1}=${w}`,
          `${w}-${p1}=${p2}`, `${w}-${p2}=${p1}`,
        ];
        if (!validForms.includes(eq)) {
          challenge.targetEquation = null; // force regeneration below
        }
      }

      // If no valid targetEquation, cycle through fact-family forms
      if (!challenge.targetEquation) {
        const w = challenge.whole;
        const forms = [
          `${p1}+${p2}=${w}`,
          `${w}-${p1}=${p2}`,
          `${w}-${p2}=${p1}`,
          `${p2}+${p1}=${w}`,
        ];
        challenge.targetEquation = forms[buildEqIndex % forms.length];
        buildEqIndex++;
      }

      challenge.allPairs = null;
      challenge.factFamily = null;
    }
  }

  // Ensure at least one challenge (use eval constraint fallback type)
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'decompose';
    const w = data.gradeBand === 'K' ? 4 : 7;
    const pairs: [number, number][] = [];
    for (let a = 0; a <= Math.floor(w / 2); a++) {
      pairs.push([a, w - a]);
    }

    const fallbacks: Record<string, object> = {
      decompose: {
        type: 'decompose',
        instruction: `Can you find all the ways to break apart ${w}?`,
        whole: w,
        part1: null,
        part2: null,
        allPairs: pairs,
        factFamily: null,
        targetEquation: null,
      },
      'missing-part': {
        type: 'missing-part',
        instruction: `The whole is ${w}. One part is 2. What is the other part?`,
        whole: w,
        part1: 2,
        part2: null,
        allPairs: null,
        factFamily: null,
        targetEquation: null,
      },
      'fact-family': {
        type: 'fact-family',
        instruction: `Write all 4 equations for 3 + ${w - 3} = ${w}.`,
        whole: w,
        part1: 3,
        part2: w - 3,
        allPairs: null,
        factFamily: [`3+${w - 3}=${w}`, `${w - 3}+3=${w}`, `${w}-3=${w - 3}`, `${w}-${w - 3}=3`],
        targetEquation: null,
      },
      'build-equation': {
        type: 'build-equation',
        instruction: `Build the equation: 3 + ${w - 3} = ${w}`,
        whole: w,
        part1: 3,
        part2: w - 3,
        allPairs: null,
        factFamily: null,
        targetEquation: `3+${w - 3}=${w}`,
      },
    };

    console.log(`[NumberBond] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [{ id: 'c1', ...(fallbacks[fallbackType] ?? fallbacks.decompose) }];
  }

  // Apply explicit config overrides
  if (config) {
    if (config.maxNumber !== undefined) {
      data.maxNumber = Math.min(config.maxNumber, data.gradeBand === 'K' ? 5 : 10);
    }
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c) => c.type).join(', ');
  console.log(`[NumberBond] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  return data;
};
