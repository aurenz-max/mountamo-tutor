import { Type, Schema } from "@google/genai";
import { MultiplicationExplorerData } from "../../primitives/visual-primitives/math/MultiplicationExplorer";
import { ai } from "../geminiClient";
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
  build: {
    promptDoc:
      `"build": Student builds equal groups or an array for the given fact, then counts the total. `
      + `hiddenValue = "product". Concrete manipulative with full guidance. `
      + `Use kid-friendly contexts (packs of stickers, wheels on cars). `
      + `Grade 2: only ×2, ×5, ×10.`,
    schemaDescription: "'build' (construct groups/arrays)",
  },
  connect: {
    promptDoc:
      `"connect": Same fact shown in all 5 representations simultaneously (groups, array, `
      + `repeated addition, number line, area model). Student identifies the connection between them. `
      + `hiddenValue = null. Pictorial with prompts — linking visual models.`,
    schemaDescription: "'connect' (link representations)",
  },
  commutative: {
    promptDoc:
      `"commutative": Flip the factors — is the product the same? Student explores `
      + `a×b vs b×a. hiddenValue = null or "product". `
      + `Pictorial with reduced prompts — apply commutative property. `
      + `Show the array rotated to demonstrate rows↔columns swap.`,
    schemaDescription: "'commutative' (apply commutative property)",
  },
  distributive: {
    promptDoc:
      `"distributive": Break a harder fact into easier parts (e.g., 7×6 = 5×6 + 2×6). `
      + `hiddenValue = "product". Transitional: mixed symbolic/pictorial. `
      + `Show the area model split into two rectangles. Grade 3+ only.`,
    schemaDescription: "'distributive' (break apart with distribution)",
  },
  missing_factor: {
    promptDoc:
      `"missing_factor": Given product and one factor, find the other factor. `
      + `hiddenValue = "factor1" or "factor2". Symbolic, single operation. `
      + `E.g., "? × 4 = 20, what is the missing number?" `
      + `Encourage skip-counting or think-backwards strategy.`,
    schemaDescription: "'missing_factor' (solve for unknown factor)",
  },
  fluency: {
    promptDoc:
      `"fluency": Quick-fire fact recall with optional time limit. `
      + `hiddenValue = "product". timeLimit: 5-8 seconds. `
      + `Symbolic, multi-step / cross-concept — rapid recall without visual aids. `
      + `No representations needed, just bare fact.`,
    schemaDescription: "'fluency' (rapid fact recall)",
  },
};

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

const multiplicationExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title (e.g., 'Wheels on Cars: 4 × 3', 'Pack It Up: 5 × 6')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description tying multiplication to a concrete context"
    },
    fact: {
      type: Type.OBJECT,
      properties: {
        factor1: { type: Type.NUMBER, description: "First factor (number of groups)" },
        factor2: { type: Type.NUMBER, description: "Second factor (items per group)" },
        product: { type: Type.NUMBER, description: "Product (factor1 × factor2)" }
      },
      required: ["factor1", "factor2", "product"]
    },
    representations: {
      type: Type.OBJECT,
      properties: {
        equalGroups: { type: Type.BOOLEAN },
        array: { type: Type.BOOLEAN },
        repeatedAddition: { type: Type.BOOLEAN },
        numberLine: { type: Type.BOOLEAN },
        areaModel: { type: Type.BOOLEAN }
      },
      required: ["equalGroups", "array", "repeatedAddition", "numberLine", "areaModel"]
    },
    activeRepresentation: {
      type: Type.STRING,
      description: "Starting representation: 'groups', 'array', 'repeated_addition', 'number_line', 'area_model', or 'all'"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: {
            type: Type.STRING,
            description: "Challenge type: 'build' (construct groups/arrays), 'connect' (link representations), 'commutative' (apply commutative property), 'distributive' (break apart with distribution), 'missing_factor' (solve for unknown factor), 'fluency' (rapid fact recall)"
          },
          instruction: { type: Type.STRING, description: "Student-facing instruction" },
          targetFact: { type: Type.STRING, description: "e.g., '3 × 4 = 12'" },
          hiddenValue: {
            type: Type.STRING,
            nullable: true,
            description: "'factor1', 'factor2', 'product', or null"
          },
          timeLimit: {
            type: Type.NUMBER,
            nullable: true,
            description: "Seconds for fluency mode, or null"
          },
          hint: { type: Type.STRING },
          narration: { type: Type.STRING, description: "AI tutor narration for this challenge" }
        },
        required: ["id", "type", "instruction", "targetFact", "hint", "narration"]
      },
      description: "3-6 progressive challenges"
    },
    showOptions: {
      type: Type.OBJECT,
      properties: {
        showProduct: { type: Type.BOOLEAN },
        showFactFamily: { type: Type.BOOLEAN },
        showCommutativeFlip: { type: Type.BOOLEAN },
        showDistributiveBreakdown: { type: Type.BOOLEAN }
      },
      required: ["showProduct", "showFactFamily", "showCommutativeFlip", "showDistributiveBreakdown"]
    },
    imagePrompt: {
      type: Type.STRING,
      nullable: true,
      description: "Real-world context image prompt (e.g., 'rows of desks in a classroom')"
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: '2-3' or '3-4'"
    }
  },
  required: ["title", "description", "fact", "representations", "activeRepresentation", "challenges", "showOptions", "gradeBand"]
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateMultiplicationExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: {
    factor1?: number;
    factor2?: number;
    gradeBand?: '2-3' | '3-4';
    challengeTypes?: string[];
    representations?: string[];
    /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
    targetEvalMode?: string;
    /** Intent or title from the manifest item. */
    intent?: string;
  }
): Promise<MultiplicationExplorerData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'multiplication-explorer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // For config.challengeTypes without an eval mode, use them as a hint
  const effectiveChallengeTypes = evalConstraint?.allowedTypes ?? config?.challengeTypes;

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(multiplicationExplorerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : multiplicationExplorerSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create an educational multiplication explorer activity for "${topic}" at ${gradeLevel} level.

CONTEXT:
The multiplication explorer connects 5 representations of the same fact:
1. Equal Groups (circles with dots — "3 groups of 4")
2. Array (rows × columns grid — "3 rows, 4 columns")
3. Repeated Addition (4 + 4 + 4)
4. Number Line (jumps of 4, 3 times)
5. Area Model (3 × 4 rectangle)

${challengeTypeSection}

${!evalConstraint ? `
GRADE-LEVEL GUIDELINES:
Grade 2 (gradeBand "2-3"):
  * Only ×2, ×5, ×10 facts
  * Focus on equal groups and arrays
  * Concrete contexts (packs of gum, wheels on cars, fingers on hands)
  * showDistributiveBreakdown: false
  * showCommutativeFlip: true (simple)
  * Include 'build' and 'connect' challenges only
  * Keep products ≤ 50

Grade 3 (gradeBand "2-3" or "3-4"):
  * All facts through 10×10
  * All 5 representations
  * Commutative property emphasized
  * Introduce distributive property: 7×8 = 5×8 + 2×8
  * Include 'commutative', 'missing_factor', and 'fluency' challenges
  * showDistributiveBreakdown: true for harder facts (×6, ×7, ×8, ×9)

Grade 4 (gradeBand "3-4"):
  * Multi-digit × single-digit (e.g., 12 × 4, 23 × 3)
  * Area model emphasis for partial products
  * Division as inverse (fact family)
  * showFactFamily: true
  * All challenge types
` : ''}

${(() => {
  const hints: string[] = [];
  if (config?.factor1 !== undefined) hints.push(`- Factor 1: ${config.factor1}`);
  if (config?.factor2 !== undefined) hints.push(`- Factor 2: ${config.factor2}`);
  if (config?.gradeBand) hints.push(`- Grade band: ${config.gradeBand}`);
  if (effectiveChallengeTypes) hints.push(`- Challenge types to include: ${effectiveChallengeTypes.join(', ')}`);
  if (config?.representations) hints.push(`- Representations: ${config.representations.join(', ')}`);
  return hints.length > 0 ? `CONFIGURATION HINTS:\n${hints.join('\n')}` : '';
})()}

REQUIREMENTS:
1. Choose a concrete, kid-friendly context (packs of stickers, rows of desks, eggs in cartons, wheels on cars)
2. product MUST equal factor1 × factor2 exactly
3. Generate 3-6 challenges that progress in difficulty
4. Start with easier challenges and progress to harder types
5. For grade 2, keep factors ≤ 10 and use only ×2, ×5, ×10
6. For grade 3-4, any facts through 12×12 are fine
7. hiddenValue should be null for build/connect, 'product' for fluency, 'factor1' or 'factor2' for missing_factor
8. Include warm, encouraging hint and narration text
9. All 5 representations should generally be true (set false only if factor is too large for visual)
10. Set activeRepresentation to 'groups' as the starting view

Return the complete multiplication explorer configuration.
`;

  logEvalModeResolution('MultiplicationExplorer', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid multiplication explorer data returned from Gemini API');
  }

  // Validation: ensure product = factor1 × factor2
  if (data.fact) {
    data.fact.product = data.fact.factor1 * data.fact.factor2;
  }

  // Validation: gradeBand
  if (data.gradeBand !== '2-3' && data.gradeBand !== '3-4') {
    data.gradeBand = '2-3';
  }

  // Validation: activeRepresentation
  const validReps = ['groups', 'array', 'repeated_addition', 'number_line', 'area_model', 'all'];
  if (!validReps.includes(data.activeRepresentation)) {
    data.activeRepresentation = 'groups';
  }

  // Validation: challenge types (safety net — schema enum handles the eval mode case)
  const validChallengeTypes = ['build', 'connect', 'commutative', 'distributive', 'missing_factor', 'fluency'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'build';
    const fallbacks: Record<string, { type: string; instruction: string; targetFact: string; hiddenValue: string | null; timeLimit: number | null; hint: string; narration: string }> = {
      build: { type: 'build', instruction: `How many is ${data.fact.factor1} groups of ${data.fact.factor2}?`, targetFact: `${data.fact.factor1} × ${data.fact.factor2} = ${data.fact.product}`, hiddenValue: 'product', timeLimit: null, hint: `Count the groups: ${Array.from({ length: data.fact.factor1 }).map((_, i) => data.fact.factor2 * (i + 1)).join(', ')}`, narration: `Let's find out what ${data.fact.factor1} times ${data.fact.factor2} equals!` },
      connect: { type: 'connect', instruction: `Look at all 5 pictures. They all show ${data.fact.factor1} × ${data.fact.factor2}!`, targetFact: `${data.fact.factor1} × ${data.fact.factor2} = ${data.fact.product}`, hiddenValue: null, timeLimit: null, hint: 'Each picture shows the same fact in a different way.', narration: `Can you see how groups, arrays, and addition all show the same number?` },
      commutative: { type: 'commutative', instruction: `Is ${data.fact.factor1} × ${data.fact.factor2} the same as ${data.fact.factor2} × ${data.fact.factor1}?`, targetFact: `${data.fact.factor1} × ${data.fact.factor2} = ${data.fact.product}`, hiddenValue: null, timeLimit: null, hint: 'Flip the array sideways — do you get the same total?', narration: `Let's see what happens when we swap the numbers!` },
      distributive: { type: 'distributive', instruction: `Can you break ${data.fact.factor1} × ${data.fact.factor2} into easier parts?`, targetFact: `${data.fact.factor1} × ${data.fact.factor2} = ${data.fact.product}`, hiddenValue: 'product', timeLimit: null, hint: `Try splitting: 5 × ${data.fact.factor2} + ${Math.max(0, data.fact.factor1 - 5)} × ${data.fact.factor2}`, narration: `Let's use a trick to make this easier!` },
      missing_factor: { type: 'missing_factor', instruction: `? × ${data.fact.factor2} = ${data.fact.product}. What is the missing number?`, targetFact: `${data.fact.factor1} × ${data.fact.factor2} = ${data.fact.product}`, hiddenValue: 'factor1', timeLimit: null, hint: `Count by ${data.fact.factor2}s until you reach ${data.fact.product}.`, narration: `One factor is hidden. Can you figure it out?` },
      fluency: { type: 'fluency', instruction: `Quick! What is ${data.fact.factor1} × ${data.fact.factor2}?`, targetFact: `${data.fact.factor1} × ${data.fact.factor2} = ${data.fact.product}`, hiddenValue: 'product', timeLimit: 6, hint: `Think of ${data.fact.factor1} groups of ${data.fact.factor2}.`, narration: `Let's see how fast you know this fact!` },
    };
    console.log(`[MultiplicationExplorer] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [{ id: 'c1', ...fallbacks[fallbackType] ?? fallbacks.build }];
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[MultiplicationExplorer] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  // Ensure representations object has all fields
  data.representations = {
    equalGroups: data.representations?.equalGroups ?? true,
    array: data.representations?.array ?? true,
    repeatedAddition: data.representations?.repeatedAddition ?? true,
    numberLine: data.representations?.numberLine ?? true,
    areaModel: data.representations?.areaModel ?? true,
  };

  // Ensure showOptions
  data.showOptions = {
    showProduct: data.showOptions?.showProduct ?? true,
    showFactFamily: data.showOptions?.showFactFamily ?? (data.gradeBand === '3-4'),
    showCommutativeFlip: data.showOptions?.showCommutativeFlip ?? true,
    showDistributiveBreakdown: data.showOptions?.showDistributiveBreakdown ?? (data.gradeBand === '3-4'),
  };

  // Disable number line for large products (>50 looks cramped)
  if (data.fact.product > 50) {
    data.representations.numberLine = false;
  }

  // Apply explicit config overrides
  if (config) {
    if (config.factor1 !== undefined) {
      data.fact.factor1 = config.factor1;
      data.fact.product = config.factor1 * data.fact.factor2;
    }
    if (config.factor2 !== undefined) {
      data.fact.factor2 = config.factor2;
      data.fact.product = data.fact.factor1 * config.factor2;
    }
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
  }

  return data;
};
