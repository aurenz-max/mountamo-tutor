import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  NumberLineData,
  NumberLineOperation,
  NumberLineChallenge,
} from "../../primitives/visual-primitives/math/NumberLine";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import { createSubRangePool } from './numberPoolService';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  plot_point: {
    promptDoc:
      `"plot_point": Student places a point at the correct value on the number line. `
      + `targetValues contains the exact value(s) to plot. `
      + `K-2: integers 0-20, warm language ("Can you find where 7 lives?"). `
      + `3-5: fractions, decimals, negatives. Concrete manipulative with full guidance.`,
    schemaDescription: "'plot_point' (place value on line)",
  },
  show_jump: {
    promptDoc:
      `"show_jump": Student shows an operation as movement on the number line. `
      + `EACH challenge MUST include its own "startValue" and "operations" array. `
      + `operations: [{type, startValue, changeValue, showJumpArc: false}]. `
      + `targetValues contains the FINAL landing value after all operations. `
      + `K-2: simple +1/+2/+3 jumps within 0-20. 3-5: larger jumps, fractions, negatives.`,
    schemaDescription: "'show_jump' (operation as movement)",
  },
  order_values: {
    promptDoc:
      `"order_values": Student arranges 3-5 values in order on the number line. `
      + `targetValues contains the values to be ordered (3-5 numbers). `
      + `3-5: fractions, decimals, mixed numbers, negatives. `
      + `K-2: integers only, typically 3 values within 0-20.`,
    schemaDescription: "'order_values' (sequence values)",
  },
  find_between: {
    promptDoc:
      `"find_between": Student estimates or finds a value between two given marks. `
      + `targetValues contains exactly 2 boundary values; student must identify a value between them. `
      + `Use for fraction/decimal estimation, number sense reasoning. `
      + `Primarily 3-5: fractions between benchmarks, decimals on a zoomed line.`,
    schemaDescription: "'find_between' (estimate between marks)",
  },
};

// ---------------------------------------------------------------------------
// Per-mode schemas — focused, minimal fields (SP-14)
// ---------------------------------------------------------------------------

function buildPlotPointSchema(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging, age-appropriate title" },
      description: { type: Type.STRING, description: "Brief explanation of the learning goal" },
      rangeMin: { type: Type.NUMBER, description: "Minimum value on the number line" },
      rangeMax: { type: Type.NUMBER, description: "Maximum value on the number line" },
      gradeBand: { type: Type.STRING, description: "Grade band", enum: ["K-2", "3-5"] },
      numberType: { type: Type.STRING, description: "Type of numbers", enum: ["integer", "fraction", "decimal", "mixed"] },
      highlight0Label: { type: Type.STRING, description: "Optional reference point 1 label" },
      highlight0Value: { type: Type.NUMBER, description: "Optional reference point 1 value" },
      highlight1Label: { type: Type.STRING, description: "Optional reference point 2 label" },
      highlight1Value: { type: Type.NUMBER, description: "Optional reference point 2 value" },
      c1Instruction: { type: Type.STRING, description: "Challenge 1 instruction" },
      c1Target0: { type: Type.NUMBER, description: "Challenge 1 target value" },
      c1Hint: { type: Type.STRING, description: "Challenge 1 hint" },
      c2Instruction: { type: Type.STRING, description: "Challenge 2 instruction" },
      c2Target0: { type: Type.NUMBER, description: "Challenge 2 target value" },
      c2Hint: { type: Type.STRING, description: "Challenge 2 hint" },
      c3Instruction: { type: Type.STRING, description: "Challenge 3 instruction" },
      c3Target0: { type: Type.NUMBER, description: "Challenge 3 target value" },
      c3Hint: { type: Type.STRING, description: "Challenge 3 hint" },
      c4Instruction: { type: Type.STRING, description: "Challenge 4 instruction (optional)" },
      c4Target0: { type: Type.NUMBER, description: "Challenge 4 target value (optional)" },
      c4Hint: { type: Type.STRING, description: "Challenge 4 hint (optional)" },
    },
    required: [
      "title", "description", "rangeMin", "rangeMax", "gradeBand", "numberType",
      "c1Instruction", "c1Target0", "c1Hint",
      "c2Instruction", "c2Target0", "c2Hint",
      "c3Instruction", "c3Target0", "c3Hint",
    ],
  };
}

function buildShowJumpSchema(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging title" },
      description: { type: Type.STRING, description: "Brief learning goal" },
      rangeMin: { type: Type.NUMBER, description: "Minimum value on the number line" },
      rangeMax: { type: Type.NUMBER, description: "Maximum value on the number line" },
      gradeBand: { type: Type.STRING, description: "Grade band", enum: ["K-2", "3-5"] },
      // Challenge 1
      c1Instruction: { type: Type.STRING, description: "Challenge 1 instruction" },
      c1StartValue: { type: Type.NUMBER, description: "Challenge 1 starting position" },
      c1Op0Type: { type: Type.STRING, description: "Challenge 1 operation type", enum: ["add", "subtract"] },
      c1Op0Change: { type: Type.NUMBER, description: "Challenge 1 jump amount (positive)" },
      c1TargetValue: { type: Type.NUMBER, description: "Challenge 1 final landing value" },
      c1Hint: { type: Type.STRING, description: "Challenge 1 hint" },
      // Challenge 2
      c2Instruction: { type: Type.STRING, description: "Challenge 2 instruction" },
      c2StartValue: { type: Type.NUMBER, description: "Challenge 2 starting position" },
      c2Op0Type: { type: Type.STRING, description: "Challenge 2 operation type", enum: ["add", "subtract"] },
      c2Op0Change: { type: Type.NUMBER, description: "Challenge 2 jump amount (positive)" },
      c2TargetValue: { type: Type.NUMBER, description: "Challenge 2 final landing value" },
      c2Hint: { type: Type.STRING, description: "Challenge 2 hint" },
      // Challenge 3
      c3Instruction: { type: Type.STRING, description: "Challenge 3 instruction" },
      c3StartValue: { type: Type.NUMBER, description: "Challenge 3 starting position" },
      c3Op0Type: { type: Type.STRING, description: "Challenge 3 operation type", enum: ["add", "subtract"] },
      c3Op0Change: { type: Type.NUMBER, description: "Challenge 3 jump amount (positive)" },
      c3TargetValue: { type: Type.NUMBER, description: "Challenge 3 final landing value" },
      c3Hint: { type: Type.STRING, description: "Challenge 3 hint" },
    },
    required: [
      "title", "description", "rangeMin", "rangeMax", "gradeBand",
      "c1Instruction", "c1StartValue", "c1Op0Type", "c1Op0Change", "c1TargetValue", "c1Hint",
      "c2Instruction", "c2StartValue", "c2Op0Type", "c2Op0Change", "c2TargetValue", "c2Hint",
      "c3Instruction", "c3StartValue", "c3Op0Type", "c3Op0Change", "c3TargetValue", "c3Hint",
    ],
  };
}

function buildOrderValuesSchema(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging title" },
      description: { type: Type.STRING, description: "Brief learning goal" },
      rangeMin: { type: Type.NUMBER, description: "Minimum value" },
      rangeMax: { type: Type.NUMBER, description: "Maximum value" },
      gradeBand: { type: Type.STRING, description: "Grade band", enum: ["K-2", "3-5"] },
      numberType: { type: Type.STRING, description: "Type of numbers", enum: ["integer", "fraction", "decimal", "mixed"] },
      // Challenge 1: 4 values
      c1Instruction: { type: Type.STRING, description: "Challenge 1 instruction" },
      c1Val0: { type: Type.NUMBER, description: "Value 1 to order" },
      c1Val1: { type: Type.NUMBER, description: "Value 2 to order" },
      c1Val2: { type: Type.NUMBER, description: "Value 3 to order" },
      c1Val3: { type: Type.NUMBER, description: "Value 4 to order (optional)" },
      c1Hint: { type: Type.STRING, description: "Challenge 1 hint" },
      // Challenge 2
      c2Instruction: { type: Type.STRING, description: "Challenge 2 instruction" },
      c2Val0: { type: Type.NUMBER, description: "Value 1 to order" },
      c2Val1: { type: Type.NUMBER, description: "Value 2 to order" },
      c2Val2: { type: Type.NUMBER, description: "Value 3 to order" },
      c2Val3: { type: Type.NUMBER, description: "Value 4 to order (optional)" },
      c2Hint: { type: Type.STRING, description: "Challenge 2 hint" },
      // Challenge 3
      c3Instruction: { type: Type.STRING, description: "Challenge 3 instruction" },
      c3Val0: { type: Type.NUMBER, description: "Value 1 to order" },
      c3Val1: { type: Type.NUMBER, description: "Value 2 to order" },
      c3Val2: { type: Type.NUMBER, description: "Value 3 to order" },
      c3Val3: { type: Type.NUMBER, description: "Value 4 to order (optional)" },
      c3Hint: { type: Type.STRING, description: "Challenge 3 hint" },
    },
    required: [
      "title", "description", "rangeMin", "rangeMax", "gradeBand", "numberType",
      "c1Instruction", "c1Val0", "c1Val1", "c1Val2", "c1Hint",
      "c2Instruction", "c2Val0", "c2Val1", "c2Val2", "c2Hint",
      "c3Instruction", "c3Val0", "c3Val1", "c3Val2", "c3Hint",
    ],
  };
}

function buildFindBetweenSchema(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging title" },
      description: { type: Type.STRING, description: "Brief learning goal" },
      rangeMin: { type: Type.NUMBER, description: "Minimum value" },
      rangeMax: { type: Type.NUMBER, description: "Maximum value" },
      gradeBand: { type: Type.STRING, description: "Grade band", enum: ["K-2", "3-5"] },
      numberType: { type: Type.STRING, description: "Type of numbers", enum: ["integer", "fraction", "decimal", "mixed"] },
      // Challenge 1: 2 boundary values
      c1Instruction: { type: Type.STRING, description: "Challenge 1 instruction" },
      c1Boundary0: { type: Type.NUMBER, description: "Challenge 1 lower boundary" },
      c1Boundary1: { type: Type.NUMBER, description: "Challenge 1 upper boundary" },
      c1Hint: { type: Type.STRING, description: "Challenge 1 hint" },
      // Challenge 2
      c2Instruction: { type: Type.STRING, description: "Challenge 2 instruction" },
      c2Boundary0: { type: Type.NUMBER, description: "Challenge 2 lower boundary" },
      c2Boundary1: { type: Type.NUMBER, description: "Challenge 2 upper boundary" },
      c2Hint: { type: Type.STRING, description: "Challenge 2 hint" },
      // Challenge 3
      c3Instruction: { type: Type.STRING, description: "Challenge 3 instruction" },
      c3Boundary0: { type: Type.NUMBER, description: "Challenge 3 lower boundary" },
      c3Boundary1: { type: Type.NUMBER, description: "Challenge 3 upper boundary" },
      c3Hint: { type: Type.STRING, description: "Challenge 3 hint" },
    },
    required: [
      "title", "description", "rangeMin", "rangeMax", "gradeBand", "numberType",
      "c1Instruction", "c1Boundary0", "c1Boundary1", "c1Hint",
      "c2Instruction", "c2Boundary0", "c2Boundary1", "c2Hint",
      "c3Instruction", "c3Boundary0", "c3Boundary1", "c3Hint",
    ],
  };
}

// ---------------------------------------------------------------------------
// Flat → structured reconstruction helpers
// ---------------------------------------------------------------------------

interface FlatData {
  [key: string]: unknown;
}

function reconstructPlotPointChallenges(flat: FlatData): NumberLineChallenge[] {
  const challenges: NumberLineChallenge[] = [];
  for (let i = 1; i <= 4; i++) {
    const instruction = flat[`c${i}Instruction`] as string | undefined;
    const target = flat[`c${i}Target0`] as number | undefined;
    const hint = flat[`c${i}Hint`] as string | undefined;
    if (!instruction || target === undefined) continue;
    challenges.push({
      id: `plot_point-${i - 1}`,
      type: 'plot_point',
      instruction,
      targetValues: [target],
      hint: hint || "Look carefully at the numbers on the line.",
    });
  }
  return challenges;
}

function reconstructShowJumpChallenges(flat: FlatData): NumberLineChallenge[] {
  const challenges: NumberLineChallenge[] = [];
  for (let i = 1; i <= 3; i++) {
    const instruction = flat[`c${i}Instruction`] as string | undefined;
    const startValue = flat[`c${i}StartValue`] as number | undefined;
    const opType = flat[`c${i}Op0Type`] as string | undefined;
    const opChange = flat[`c${i}Op0Change`] as number | undefined;
    const target = flat[`c${i}TargetValue`] as number | undefined;
    const hint = flat[`c${i}Hint`] as string | undefined;
    if (!instruction || startValue === undefined || target === undefined) continue;

    const resolvedType = opType === 'subtract' ? 'subtract' as const : 'add' as const;
    const resolvedChange = typeof opChange === 'number' && opChange > 0 ? opChange : Math.abs(target - startValue);

    challenges.push({
      id: `show_jump-${i - 1}`,
      type: 'show_jump',
      instruction,
      targetValues: [target],
      hint: hint || "Count the hops on the number line.",
      startValue,
      operations: [{
        type: resolvedType,
        startValue,
        changeValue: resolvedChange,
        showJumpArc: false,
      }],
    });
  }
  return challenges;
}

function reconstructOrderValuesChallenges(flat: FlatData): NumberLineChallenge[] {
  const challenges: NumberLineChallenge[] = [];
  for (let i = 1; i <= 3; i++) {
    const instruction = flat[`c${i}Instruction`] as string | undefined;
    const hint = flat[`c${i}Hint`] as string | undefined;
    if (!instruction) continue;

    const values: number[] = [];
    for (let v = 0; v < 5; v++) {
      const val = flat[`c${i}Val${v}`] as number | undefined;
      if (val !== undefined) values.push(val);
    }
    if (values.length < 3) continue;

    challenges.push({
      id: `order_values-${i - 1}`,
      type: 'order_values',
      instruction,
      targetValues: values,
      hint: hint || "Find each number on the line. Which is furthest left?",
    });
  }
  return challenges;
}

function reconstructFindBetweenChallenges(flat: FlatData): NumberLineChallenge[] {
  const challenges: NumberLineChallenge[] = [];
  for (let i = 1; i <= 3; i++) {
    const instruction = flat[`c${i}Instruction`] as string | undefined;
    const b0 = flat[`c${i}Boundary0`] as number | undefined;
    const b1 = flat[`c${i}Boundary1`] as number | undefined;
    const hint = flat[`c${i}Hint`] as string | undefined;
    if (!instruction || b0 === undefined || b1 === undefined) continue;

    challenges.push({
      id: `find_between-${i - 1}`,
      type: 'find_between',
      instruction,
      targetValues: [b0, b1],
      hint: hint || "Look at the tick marks between the two values.",
    });
  }
  return challenges;
}

function reconstructHighlights(flat: FlatData): { label: string; value: number }[] {
  const highlights: { label: string; value: number }[] = [];
  for (let i = 0; i < 2; i++) {
    const label = flat[`highlight${i}Label`] as string | undefined;
    const value = flat[`highlight${i}Value`] as number | undefined;
    if (label && value !== undefined) highlights.push({ label, value });
  }
  return highlights;
}

// ---------------------------------------------------------------------------
// Per-mode sub-generators
// ---------------------------------------------------------------------------

type SubResult = {
  title: string;
  description: string;
  range: { min: number; max: number };
  gradeBand: 'K-2' | '3-5';
  numberType: string;
  interactionMode: string;
  challenges: NumberLineChallenge[];
  highlights: { label: string; value: number }[];
  operations: NumberLineOperation[];
};

function resolveGradeBand(gradeLevel: string): 'K-2' | '3-5' {
  const lower = gradeLevel.toLowerCase();
  return lower.includes('k') || lower.includes('1') || lower.includes('2') ? 'K-2' : '3-5';
}

async function generatePlotPointChallenges(
  topic: string,
  gradeLevel: string,
  config?: { targetEvalMode?: string; numberRange?: { min: number; max: number }; difficulty?: string },
): Promise<SubResult> {
  const isIdentify = config?.targetEvalMode === 'identify';
  const pool = createSubRangePool(config?.numberRange, { sorted: true, unique: true, maxSpan: 25 });
  const rangeSection = pool?.toPromptSection() ?? '';

  const modeConstraint = isIdentify
    ? `\nIMPORTANT — IDENTIFY MODE (Kindergarten):
- Range MUST be 0 to 10.
- ALL target values must be whole numbers between 0 and 10.
- Use very warm, simple language: "Can you find where 3 lives on the line?"
- gradeBand MUST be "K-2", numberType MUST be "integer".
- Every tick mark on the line is labeled — this is pure number recognition.\n`
    : '';

  const gradeBand = resolveGradeBand(gradeLevel);
  const gradeGuidelines = isIdentify ? '' : `
GRADE-LEVEL GUIDELINES:
- K-2: integers 0-20, warm language, simple plotting
- 3-5: fractions, decimals, negatives, more precise placement`;

  const prompt = `Create an interactive Number Line PLOT activity for "${topic}" (Grade ${gradeLevel}).
${modeConstraint}
${rangeSection}
${gradeGuidelines}

For each challenge, the student places a point at the correct value on the number line.
- c1..c4: instruction (warm, grade-appropriate), target value, hint
- Challenges should progress in difficulty (first easier, last harder)
- Hints guide without giving the answer
- Include 0-2 reference highlight points on the line (optional)

Generate 3-4 challenges.`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      temperature: 0.9,
      topP: 0.95,
      responseMimeType: 'application/json',
      responseSchema: buildPlotPointSchema(),
    },
  });

  const flat = result.text ? JSON.parse(result.text) : null;
  if (!flat) return emptySubResult('plot');

  let challenges = reconstructPlotPointChallenges(flat);
  const highlights = reconstructHighlights(flat);

  // ── Semantic differentiation for identify mode (post-filter) ──
  if (isIdentify) {
    const before = challenges.length;
    challenges = challenges.filter(ch =>
      ch.targetValues.every(v => Number.isInteger(v) && v >= 0 && v <= 10)
    );
    if (challenges.length < before) {
      console.log(`[NumberLine] identify: filtered ${before - challenges.length} out-of-range challenges`);
    }
  }

  const rangeMin = isIdentify ? 0 : (flat.rangeMin ?? 0);
  const rangeMax = isIdentify ? 10 : (flat.rangeMax ?? 20);

  return {
    title: flat.title || `Number Line: ${topic}`,
    description: flat.description || '',
    range: { min: rangeMin, max: rangeMax },
    gradeBand: isIdentify ? 'K-2' : (flat.gradeBand === '3-5' ? '3-5' : gradeBand),
    numberType: isIdentify ? 'integer' : (flat.numberType || (gradeBand === 'K-2' ? 'integer' : 'decimal')),
    interactionMode: 'plot',
    challenges,
    highlights,
    operations: [],
  };
}

async function generateShowJumpChallenges(
  topic: string,
  gradeLevel: string,
  config?: { numberRange?: { min: number; max: number }; difficulty?: string },
): Promise<SubResult> {
  const pool = createSubRangePool(config?.numberRange, { sorted: true, unique: true, maxSpan: 25 });
  const rangeSection = pool?.toPromptSection() ?? '';
  const gradeBand = resolveGradeBand(gradeLevel);

  const prompt = `Create an interactive Number Line JUMP activity for "${topic}" (Grade ${gradeLevel}).

${rangeSection}

Students show operations as movement on the number line.
For each challenge:
- instruction: what jump(s) to show
- startValue: where the student starts on the line
- op0Type: "add" or "subtract"
- op0Change: how far to jump (positive number)
- targetValue: the final landing position after the jump

K-2: simple +1/+2/+3/+5 jumps within 0-20, warm language.
3-5: larger jumps, negatives, fractions possible.

Each challenge should have DIFFERENT starting points and operations.
Hints should guide without giving the answer.

Generate 3 challenges with increasing difficulty.`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      temperature: 0.9,
      topP: 0.95,
      responseMimeType: 'application/json',
      responseSchema: buildShowJumpSchema(),
    },
  });

  const flat = result.text ? JSON.parse(result.text) : null;
  if (!flat) return emptySubResult('jump');

  const challenges = reconstructShowJumpChallenges(flat);

  // Build global operations from first challenge for backward compatibility
  const firstOps = challenges[0]?.operations ?? [];
  const globalOps: NumberLineOperation[] = firstOps.length > 0
    ? firstOps
    : [{ type: 'add' as const, startValue: flat.rangeMin ?? 0, changeValue: 3, showJumpArc: false }];

  return {
    title: flat.title || `Number Line Jumps: ${topic}`,
    description: flat.description || '',
    range: { min: flat.rangeMin ?? 0, max: flat.rangeMax ?? 20 },
    gradeBand: flat.gradeBand === '3-5' ? '3-5' : gradeBand,
    numberType: 'integer',
    interactionMode: 'jump',
    challenges,
    highlights: [],
    operations: globalOps,
  };
}

async function generateOrderValuesChallenges(
  topic: string,
  gradeLevel: string,
  config?: { numberRange?: { min: number; max: number }; difficulty?: string },
): Promise<SubResult> {
  const pool = createSubRangePool(config?.numberRange, { sorted: true, unique: true, maxSpan: 25 });
  const rangeSection = pool?.toPromptSection() ?? '';
  const gradeBand = resolveGradeBand(gradeLevel);

  const prompt = `Create an interactive Number Line ORDER activity for "${topic}" (Grade ${gradeLevel}).

${rangeSection}

Students arrange 3-4 values in correct order on the number line.
For each challenge:
- instruction: what to order
- val0..val3: 3-4 values to be ordered
- hint: guide without revealing the answer

K-2: integers only, typically 3 values within 0-20.
3-5: fractions, decimals, mixed numbers, negatives, 3-5 values.

Generate 3 challenges with increasing difficulty.`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      temperature: 0.9,
      topP: 0.95,
      responseMimeType: 'application/json',
      responseSchema: buildOrderValuesSchema(),
    },
  });

  const flat = result.text ? JSON.parse(result.text) : null;
  if (!flat) return emptySubResult('order');

  return {
    title: flat.title || `Number Line Order: ${topic}`,
    description: flat.description || '',
    range: { min: flat.rangeMin ?? 0, max: flat.rangeMax ?? 20 },
    gradeBand: flat.gradeBand === '3-5' ? '3-5' : gradeBand,
    numberType: flat.numberType || (gradeBand === 'K-2' ? 'integer' : 'decimal'),
    interactionMode: 'order',
    challenges: reconstructOrderValuesChallenges(flat),
    highlights: [],
    operations: [],
  };
}

async function generateFindBetweenChallenges(
  topic: string,
  gradeLevel: string,
  config?: { numberRange?: { min: number; max: number }; difficulty?: string },
): Promise<SubResult> {
  const pool = createSubRangePool(config?.numberRange, { sorted: true, unique: true, maxSpan: 25 });
  const rangeSection = pool?.toPromptSection() ?? '';
  const gradeBand = resolveGradeBand(gradeLevel);

  const prompt = `Create an interactive Number Line FIND BETWEEN activity for "${topic}" (Grade ${gradeLevel}).

${rangeSection}

Students find or estimate a value between two given marks.
For each challenge:
- instruction: what to find between
- boundary0, boundary1: the two boundary values
- hint: guide without giving the answer

Primarily 3-5: fractions between benchmarks, decimals on a zoomed line.
Can include K-2 with integers if range is simple.

Generate 3 challenges with increasing difficulty.`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      temperature: 0.9,
      topP: 0.95,
      responseMimeType: 'application/json',
      responseSchema: buildFindBetweenSchema(),
    },
  });

  const flat = result.text ? JSON.parse(result.text) : null;
  if (!flat) return emptySubResult('compare');

  return {
    title: flat.title || `Number Line: Find Between — ${topic}`,
    description: flat.description || '',
    range: { min: flat.rangeMin ?? 0, max: flat.rangeMax ?? 10 },
    gradeBand: flat.gradeBand === '3-5' ? '3-5' : gradeBand,
    numberType: flat.numberType || 'decimal',
    interactionMode: 'compare',
    challenges: reconstructFindBetweenChallenges(flat),
    highlights: [],
    operations: [],
  };
}

function emptySubResult(interactionMode: string): SubResult {
  return {
    title: '', description: '',
    range: { min: 0, max: 10 },
    gradeBand: 'K-2', numberType: 'integer',
    interactionMode,
    challenges: [], highlights: [], operations: [],
  };
}

// ---------------------------------------------------------------------------
// Fallback challenges
// ---------------------------------------------------------------------------

function buildFallbackChallenge(type: string, range: { min: number; max: number }): NumberLineChallenge {
  const mid = Math.round((range.min + range.max) / 2);

  const fallbacks: Record<string, NumberLineChallenge> = {
    plot_point: {
      id: 'fallback-0', type: 'plot_point',
      instruction: `Can you find ${mid} on the number line?`,
      targetValues: [mid],
      hint: 'Count the tick marks from the start.',
    },
    show_jump: {
      id: 'fallback-0', type: 'show_jump',
      instruction: `Start at ${range.min} and jump forward 3. Where do you land?`,
      targetValues: [range.min + 3],
      hint: 'Count 3 hops to the right from the start.',
      startValue: range.min,
      operations: [{ type: 'add', startValue: range.min, changeValue: 3, showJumpArc: false }],
    },
    order_values: {
      id: 'fallback-0', type: 'order_values',
      instruction: 'Put these numbers in order from smallest to largest.',
      targetValues: [range.min + 1, mid, range.max - 1],
      hint: 'Find each number on the line. Which is furthest left?',
    },
    find_between: {
      id: 'fallback-0', type: 'find_between',
      instruction: `Find a number between ${range.min + 1} and ${mid}.`,
      targetValues: [range.min + 1, mid],
      hint: 'Look at the tick marks between the two values.',
    },
  };

  return fallbacks[type] ?? fallbacks.plot_point;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Generate interactive Number Line content
 *
 * Uses per-mode sub-generators (orchestrator pattern) to avoid Gemini Flash
 * Lite dropping fields in overly complex schemas (SP-14). Each challenge type
 * has its own focused schema and generation function; the orchestrator
 * dispatches them in parallel and merges results.
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration including intent and targetEvalMode
 * @returns NumberLineData with full interactive configuration
 */
export const generateNumberLine = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{
    intent: string;
    targetEvalMode: string;
    numberRange: { min: number; max: number };
    difficulty: string;
  }>
): Promise<NumberLineData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'number-line',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('NumberLine', config?.targetEvalMode, evalConstraint);

  // ── Determine which challenge types to generate ──
  const allowedTypes = evalConstraint
    ? evalConstraint.allowedTypes
    : ['plot_point', 'show_jump', 'order_values', 'find_between'];

  // ── Build number pool ──
  const pool = createSubRangePool(config?.numberRange, { sorted: true, unique: true, maxSpan: 25 });
  console.log(`[NumberLine] display:`, pool?.displayRange ?? 'none', `pool:`, pool?.numbers ?? 'none', `difficulty:`, config?.difficulty ?? 'none');

  const subConfig = {
    targetEvalMode: config?.targetEvalMode,
    numberRange: config?.numberRange,
    difficulty: config?.difficulty,
  };

  // ── Dispatch per-mode sub-generators in parallel ──
  const generators: Promise<SubResult>[] = [];

  if (allowedTypes.includes('plot_point')) {
    generators.push(generatePlotPointChallenges(topic, gradeLevel, subConfig));
  }
  if (allowedTypes.includes('show_jump')) {
    generators.push(generateShowJumpChallenges(topic, gradeLevel, subConfig));
  }
  if (allowedTypes.includes('order_values')) {
    generators.push(generateOrderValuesChallenges(topic, gradeLevel, subConfig));
  }
  if (allowedTypes.includes('find_between')) {
    generators.push(generateFindBetweenChallenges(topic, gradeLevel, subConfig));
  }

  const subResults = await Promise.all(generators);

  // ── Combine results ──
  const allChallenges = subResults.flatMap(r => r.challenges);

  // Pick metadata from first successful sub-result
  const primary = subResults.find(r => r.challenges.length > 0) ?? subResults[0] ?? emptySubResult('plot');

  const data: NumberLineData = {
    title: primary.title || `Number Line: ${topic}`,
    description: primary.description || undefined,
    range: primary.range,
    gradeBand: primary.gradeBand,
    numberType: primary.numberType as NumberLineData['numberType'],
    interactionMode: primary.interactionMode as NumberLineData['interactionMode'],
    challenges: allChallenges,
    highlights: primary.highlights,
    operations: primary.operations,
  };

  // ---------------------------------------------------------------------------
  // Validation & Defaults
  // ---------------------------------------------------------------------------

  // Ensure gradeBand is valid
  if (data.gradeBand !== 'K-2' && data.gradeBand !== '3-5') {
    data.gradeBand = resolveGradeBand(gradeLevel);
  }

  // Ensure numberType is valid
  const validNumberTypes = ['integer', 'fraction', 'decimal', 'mixed'];
  if (!data.numberType || !validNumberTypes.includes(data.numberType)) {
    data.numberType = data.gradeBand === 'K-2' ? 'integer' : 'decimal';
  }

  // Ensure interactionMode is valid
  const validModes = ['plot', 'jump', 'compare', 'order'];
  if (!data.interactionMode || !validModes.includes(data.interactionMode)) {
    data.interactionMode = 'plot';
  }

  // Ensure range is reasonable
  if (!data.range || typeof data.range.min !== 'number' || typeof data.range.max !== 'number') {
    data.range = { min: 0, max: 10 };
  }
  if (data.range.min >= data.range.max) {
    data.range = { min: 0, max: data.gradeBand === 'K-2' ? 20 : 10 };
  }

  // K-2 guardrails
  if (data.gradeBand === 'K-2') {
    data.numberType = 'integer';
    data.range.min = Math.max(-1, Math.round(data.range.min));
    data.range.max = Math.min(30, Math.round(data.range.max));
  }

  // Ensure challenges is an array with at least one entry
  if (!data.challenges || data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'plot_point';
    console.log(`[NumberLine] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [buildFallbackChallenge(fallbackType, data.range)];
  }

  // Ensure highlights is an array
  if (!Array.isArray(data.highlights)) {
    data.highlights = [];
  }

  // Ensure operations is an array
  if (!Array.isArray(data.operations)) {
    data.operations = [];
  }

  // Final summary log
  const typeBreakdown = data.challenges.map(c => c.type).join(', ');
  console.log(`[NumberLine] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  console.log('Number Line Generated:', {
    topic,
    gradeBand: data.gradeBand,
    mode: data.interactionMode,
    numberType: data.numberType,
    range: `${data.range.min}-${data.range.max}`,
    challengeCount: data.challenges.length,
    operationCount: data.operations?.length || 0,
  });

  return data;
};
