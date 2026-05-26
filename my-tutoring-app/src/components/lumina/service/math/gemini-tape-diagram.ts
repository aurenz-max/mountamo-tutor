/**
 * Tape Diagram Generator — multi-instance word-problem generator.
 *
 * Each session walks the student through 3-6 distinct tape-diagram challenges
 * of the SAME eval mode, surfaced sequentially. Per-challenge data is content-
 * bearing (word problem text + segment labels), so we use the orchestrator-
 * same-mode pattern (per PRD §6a #1 / §6a #7): the orchestrator fans out N
 * parallel calls to the existing per-mode sub-generator. Variance comes from
 * independent generations of the same sub-generator — structured-output
 * convergence is per-call, not across independent calls.
 */

import { Type, Schema, ThinkingLevel } from "@google/genai";
import {
  TapeDiagramData,
  TapeDiagramChallenge,
  BarSegment,
} from "../../primitives/visual-primitives/math/TapeDiagram";
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
  'represent': {
    promptDoc:
      `"represent": Focus on building/understanding the tape diagram. `
      + `Given a word problem, identify the parts and represent them as bar segments. `
      + `Easiest mode — student labels and organizes diagram from problem description.`,
    schemaDescription: "'represent' (build tape diagram from word problem)",
  },
  'solve_part_whole': {
    promptDoc:
      `"solve_part_whole": Standard part-whole problems. `
      + `Given parts, find total. Or given total and one part, find the other part. `
      + `Classic tape diagram usage for addition/subtraction word problems.`,
    schemaDescription: "'solve_part_whole' (standard part-whole solving)",
  },
  'solve_comparison': {
    promptDoc:
      `"solve_comparison": Comparison problems where bars represent different quantities being compared. `
      + `Uses language like "more than", "less than", "how many more". `
      + `Harder — requires understanding the difference between quantities.`,
    schemaDescription: "'solve_comparison' (comparison word problems)",
  },
  'multi_step': {
    promptDoc:
      `"multi_step": Multi-step problems requiring multiple operations to find unknowns. `
      + `Student must find intermediate values before solving for the final unknown. `
      + `Hardest mode — requires synthesis across all segments.`,
    schemaDescription: "'multi_step' (multi-step word problems)",
  },
};

// ---------------------------------------------------------------------------
// Grade-appropriate number ranges
// ---------------------------------------------------------------------------

function getNumberGuidance(gradeLevel: string): string {
  if (/[kK]|[0-2]/.test(gradeLevel)) return 'Use numbers 1–20 (small, manageable).';
  if (/[3-5]/.test(gradeLevel)) return 'Use numbers 10–100 (medium).';
  return 'Use numbers 20–500 (larger, realistic).';
}

// ---------------------------------------------------------------------------
// Sub-generator return shape
// ---------------------------------------------------------------------------

interface SubGenResult {
  title: string;
  description: string;
  challenge: TapeDiagramChallenge;
}

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------
//
// `solve_part_whole` and `multi_step` are T4 (3+ within-challenge sub-phases:
// explore → practice → apply per challenge). At 4 challenges, sessions ran
// ~6 min past the T4 7-min ceiling — cut to 3 per the B3 sweep.
//
// `represent` and `solve_comparison` are T3 (single-submit, content-bearing
// word problems) — held at 4.

type TapeDiagramChallengeType =
  | 'represent'
  | 'solve_part_whole'
  | 'solve_comparison'
  | 'multi_step';

const DEFAULT_INSTANCE_COUNT = 4; // T3 fallback for any future mode not listed
const MAX_INSTANCE_COUNT = 5;     // T3 hard max; T4 modes are clamped via COUNT_BY_MODE

const COUNT_BY_MODE: Record<TapeDiagramChallengeType, number> = {
  represent: 4,         // T3
  solve_comparison: 4,  // T3
  solve_part_whole: 3,  // T4 cut (was 4)
  multi_step: 3,        // T4 cut (was 4)
};

// ===========================================================================
// Schema: Represent mode
// ===========================================================================

const representSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the problem" },
    wordProblem: {
      type: Type.STRING,
      description: "A clear word problem that contains all the numerical values the student must extract and place on the diagram. Must mention each part explicitly."
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of the task"
    },
    part1Value: { type: Type.NUMBER, description: "Value of first part mentioned in the word problem" },
    part1Label: { type: Type.STRING, description: "Label for first part (e.g. 'red apples')" },
    part2Value: { type: Type.NUMBER, description: "Value of second part mentioned in the word problem" },
    part2Label: { type: Type.STRING, description: "Label for second part (e.g. 'green apples')" },
    part3Value: { type: Type.NUMBER, description: "Value of third part mentioned in the word problem" },
    part3Label: { type: Type.STRING, description: "Label for third part (e.g. 'yellow apples')" },
  },
  required: ["title", "wordProblem", "description", "part1Value", "part1Label", "part2Value", "part2Label", "part3Value", "part3Label"],
};

// ===========================================================================
// Schema: Part-Whole mode
// ===========================================================================

const partWholeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the problem" },
    description: { type: Type.STRING, description: "Educational description" },
    knownPart1Value: { type: Type.NUMBER, description: "Value of first known part" },
    knownPart1Label: { type: Type.STRING, description: "Label for first known part" },
    knownPart2Value: { type: Type.NUMBER, description: "Value of second known part" },
    knownPart2Label: { type: Type.STRING, description: "Label for second known part" },
    unknown1Value: { type: Type.NUMBER, description: "Value of first unknown part" },
    unknown1Label: { type: Type.STRING, description: "Label for first unknown part" },
    unknown2Value: { type: Type.NUMBER, description: "Value of second unknown part" },
    unknown2Label: { type: Type.STRING, description: "Label for second unknown part" },
  },
  required: [
    "title", "description",
    "knownPart1Value", "knownPart1Label",
    "knownPart2Value", "knownPart2Label",
    "unknown1Value", "unknown1Label",
    "unknown2Value", "unknown2Label",
  ],
};

// ===========================================================================
// Schema: Comparison mode
// ===========================================================================

const comparisonSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the comparison problem" },
    description: { type: Type.STRING, description: "Educational description" },
    wordProblem: {
      type: Type.STRING,
      description: "A comparison word problem using 'more than', 'fewer than', 'how many more', etc."
    },
    quantity1Label: { type: Type.STRING, description: "Label for the larger quantity (e.g. 'Sam\\'s stickers')" },
    quantity1Value: { type: Type.NUMBER, description: "Value of the larger quantity" },
    quantity2Label: { type: Type.STRING, description: "Label for the smaller quantity (e.g. 'Maya\\'s stickers')" },
    quantity2Value: { type: Type.NUMBER, description: "Value of the smaller quantity" },
    comparisonWord: {
      type: Type.STRING,
      description: "The comparison word: 'more' or 'fewer'"
    },
    unknownPart: {
      type: Type.STRING,
      description: "Which value the student must find: 'difference', 'quantity1', or 'quantity2'",
      enum: ["difference", "quantity1", "quantity2"],
    },
  },
  required: [
    "title", "description", "wordProblem",
    "quantity1Label", "quantity1Value",
    "quantity2Label", "quantity2Value",
    "comparisonWord", "unknownPart",
  ],
};

// ===========================================================================
// Schema: Multi-Step mode
// ===========================================================================

const multiStepSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the multi-step problem" },
    description: { type: Type.STRING, description: "Educational description" },
    wordProblem: {
      type: Type.STRING,
      description: "A multi-step word problem requiring 2 operations to solve. Must describe a situation where the student finds an intermediate result first, then uses it."
    },
    part1Value: { type: Type.NUMBER, description: "First known value" },
    part1Label: { type: Type.STRING, description: "Label for first known value" },
    part2Value: { type: Type.NUMBER, description: "Second known value" },
    part2Label: { type: Type.STRING, description: "Label for second known value" },
    intermediateValue: { type: Type.NUMBER, description: "The intermediate result the student must find first (e.g. subtotal)" },
    intermediateLabel: { type: Type.STRING, description: "Label for the intermediate result" },
    finalValue: { type: Type.NUMBER, description: "The final answer that depends on the intermediate result" },
    finalLabel: { type: Type.STRING, description: "Label for the final answer" },
    step1Hint: { type: Type.STRING, description: "Brief hint for finding the intermediate value (e.g. 'Add the first two parts')" },
    step2Hint: { type: Type.STRING, description: "Brief hint for finding the final value using the intermediate (e.g. 'Subtract from the total')" },
  },
  required: [
    "title", "description", "wordProblem",
    "part1Value", "part1Label",
    "part2Value", "part2Label",
    "intermediateValue", "intermediateLabel",
    "finalValue", "finalLabel",
    "step1Hint", "step2Hint",
  ],
};

// ===========================================================================
// Sub-generators per mode (each emits a single SubGenResult)
// ===========================================================================

async function generateRepresentMode(topic: string, gradeLevel: string): Promise<SubGenResult> {
  const prompt = `
Create a word problem for teaching "${topic}" to ${gradeLevel} students using a tape diagram.

The student's task is to READ the word problem and FILL IN the values on an empty tape diagram.
The diagram has 3 labeled segments — the student must identify each value from the word problem text.

${getNumberGuidance(gradeLevel)}

RULES:
- The word problem must clearly state all 3 numerical values in natural language
- Use a single coherent scenario (fruits, books, toys, animals, etc.)
- Labels should be concrete and descriptive (not "Part 1")
- Values must be positive integers
- Do NOT put the answer in the title or description
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: representSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) throw new Error('No valid represent data returned from Gemini API');

  const segments: BarSegment[] = [
    { value: data.part1Value, label: data.part1Label, isUnknown: true },
    { value: data.part2Value, label: data.part2Label, isUnknown: true },
    { value: data.part3Value, label: data.part3Label, isUnknown: true },
  ];

  const total = data.part1Value + data.part2Value + data.part3Value;

  return {
    title: data.title,
    description: data.description,
    challenge: {
      id: 'td-pending',
      challengeType: 'represent',
      wordProblem: data.wordProblem,
      bars: [{
        segments,
        totalLabel: `Total = ${total}`,
      }],
      comparisonMode: false,
      showBrackets: false,
    },
  };
}

async function generatePartWholeMode(topic: string, gradeLevel: string): Promise<SubGenResult> {
  const prompt = `
Create a cohesive part-whole problem for teaching "${topic}" to ${gradeLevel} students.

You need to provide values and labels for 4 different parts used across 3 learning phases:
- 2 known parts (always shown)
- 2 unknown parts (revealed progressively)

STRUCTURE:
- knownPart1, knownPart2: concrete values with meaningful labels
- unknown1: revealed in Phase 2
- unknown2: revealed in Phase 3

HOW PHASES WORK:
Phase 1 (Explore): Show knownPart1 + knownPart2, student finds total
Phase 2 (Practice): Show knownPart1 + unknown1 (as ?), show total, student solves for unknown1
Phase 3 (Apply): Show all 4 segments, student solves for both unknowns

${getNumberGuidance(gradeLevel)}

RULES:
- All values must be positive integers
- Use a single coherent scenario (marbles, cookies, books, points, etc.)
- All 4 labels should fit the same theme
- Use concrete, descriptive labels (not "Part 1", "Segment A")
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: partWholeSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) throw new Error('No valid part-whole data returned from Gemini API');

  const grandTotal =
    data.knownPart1Value + data.knownPart2Value +
    data.unknown1Value + data.unknown2Value;

  const segments: BarSegment[] = [
    { value: data.knownPart1Value, label: data.knownPart1Label },
    { value: data.knownPart2Value, label: data.knownPart2Label },
    { value: data.unknown1Value, label: data.unknown1Label, isUnknown: true },
    { value: data.unknown2Value, label: data.unknown2Label, isUnknown: true },
  ];

  return {
    title: data.title,
    description: data.description,
    challenge: {
      id: 'td-pending',
      challengeType: 'solve_part_whole',
      bars: [{
        segments,
        totalLabel: `Total = ${grandTotal}`,
      }],
      comparisonMode: false,
      showBrackets: true,
    },
  };
}

async function generateComparisonMode(topic: string, gradeLevel: string): Promise<SubGenResult> {
  const prompt = `
Create a comparison word problem for teaching "${topic}" to ${gradeLevel} students.

This is a COMPARISON problem with TWO bars on a tape diagram. The student compares two quantities
and finds the difference or a missing quantity.

${getNumberGuidance(gradeLevel)}

RULES:
- quantity1 must be LARGER than quantity2
- The word problem must use comparison language ("more than", "fewer than", "how many more")
- Values must be positive integers
- Use a single coherent scenario with two people/groups being compared
- unknownPart: "difference" means student finds how many more/fewer,
  "quantity2" means student finds the smaller quantity given the difference,
  "quantity1" means student finds the larger quantity given the difference
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: comparisonSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) throw new Error('No valid comparison data returned from Gemini API');

  const q1 = Math.max(data.quantity1Value, data.quantity2Value);
  const q2 = Math.min(data.quantity1Value, data.quantity2Value);
  const diff = q1 - q2;

  let bar1Segments: BarSegment[];
  let bar2Segments: BarSegment[];

  if (data.unknownPart === 'difference') {
    bar1Segments = [
      { value: q2, label: `matching ${data.quantity2Label}` },
      { value: diff, label: 'difference', isUnknown: true },
    ];
    bar2Segments = [
      { value: q2, label: data.quantity2Label },
    ];
  } else if (data.unknownPart === 'quantity2') {
    bar1Segments = [
      { value: q1, label: data.quantity1Label },
    ];
    bar2Segments = [
      { value: q2, label: data.quantity2Label, isUnknown: true },
    ];
  } else {
    bar1Segments = [
      { value: q1, label: data.quantity1Label, isUnknown: true },
    ];
    bar2Segments = [
      { value: q2, label: data.quantity2Label },
    ];
  }

  return {
    title: data.title,
    description: data.description,
    challenge: {
      id: 'td-pending',
      challengeType: 'solve_comparison',
      wordProblem: data.wordProblem,
      bars: [
        { segments: bar1Segments, totalLabel: data.quantity1Label, color: 'from-blue-500 to-blue-600' },
        { segments: bar2Segments, totalLabel: data.quantity2Label, color: 'from-purple-500 to-purple-600' },
      ],
      comparisonMode: true,
      showBrackets: true,
      comparisonData: {
        quantity1: q1,
        quantity2: q2,
        difference: diff,
        comparisonWord: data.comparisonWord || 'more',
        unknownPart: data.unknownPart,
      },
    },
  };
}

async function generateMultiStepMode(topic: string, gradeLevel: string): Promise<SubGenResult> {
  const prompt = `
Create a multi-step word problem for teaching "${topic}" to ${gradeLevel} students.

This problem requires TWO operations to solve:
- Step 1: Find an intermediate value using the two known parts
- Step 2: Use the intermediate value to find the final answer

${getNumberGuidance(gradeLevel)}

RULES:
- All values must be positive integers
- The intermediate value must be derivable from part1 and part2 (e.g., their sum)
- The final value must require knowing the intermediate value
- step1Hint should guide toward finding the intermediate (without giving the answer)
- step2Hint should guide toward using the intermediate to find the final value
- Use a single coherent scenario

MATHEMATICAL RELATIONSHIP:
- intermediateValue = part1Value + part2Value (or a clear operation on them)
- finalValue should relate to intermediateValue via another operation
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: multiStepSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) throw new Error('No valid multi-step data returned from Gemini API');

  const segments: BarSegment[] = [
    { value: data.part1Value, label: data.part1Label },
    { value: data.part2Value, label: data.part2Label },
    { value: data.intermediateValue, label: data.intermediateLabel, isUnknown: true },
    { value: data.finalValue, label: data.finalLabel, isUnknown: true },
  ];

  const total = data.part1Value + data.part2Value + data.intermediateValue + data.finalValue;

  return {
    title: data.title,
    description: data.description,
    challenge: {
      id: 'td-pending',
      challengeType: 'multi_step',
      wordProblem: data.wordProblem,
      bars: [{
        segments,
        totalLabel: `Total = ${total}`,
      }],
      comparisonMode: false,
      showBrackets: true,
      multiStepData: {
        step1Hint: data.step1Hint,
        step2Hint: data.step2Hint,
        solveOrder: [2, 3],
      },
    },
  };
}

// ===========================================================================
// Orchestrator: fan out N parallel sub-generator calls for one eval mode
// ===========================================================================

function subGeneratorFor(
  challengeType: string,
): (topic: string, gradeLevel: string) => Promise<SubGenResult> {
  switch (challengeType) {
    case 'represent':         return generateRepresentMode;
    case 'solve_comparison':  return generateComparisonMode;
    case 'multi_step':        return generateMultiStepMode;
    case 'solve_part_whole':
    default:                  return generatePartWholeMode;
  }
}

export const generateTapeDiagram = async (
  topic: string,
  gradeLevel: string,
  config?: {
    targetEvalMode?: string;
    /** How many challenges in this session. Defaults from COUNT_BY_MODE (3 for T4, 4 for T3). */
    instanceCount?: number;
  }
): Promise<TapeDiagramData> => {
  const evalConstraint = resolveEvalModeConstraint('tape-diagram', config?.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('TapeDiagram', config?.targetEvalMode, evalConstraint);

  const challengeType = evalConstraint?.allowedTypes[0] || 'solve_part_whole';
  const fromTable = (COUNT_BY_MODE as Record<string, number>)[challengeType];
  const instanceCount = Math.max(
    1,
    Math.min(
      MAX_INSTANCE_COUNT,
      config?.instanceCount ?? fromTable ?? DEFAULT_INSTANCE_COUNT,
    ),
  );

  // Fan out N parallel calls of the same per-mode sub-generator. Variance
  // comes from independent generations (per PRD §6a #2 — structured output
  // converges per-call, not across independent calls).
  const runOne = subGeneratorFor(challengeType);
  const subResults = await Promise.all(
    Array.from({ length: instanceCount }, () => runOne(topic, gradeLevel)),
  );

  const head = subResults[0];
  const challenges: TapeDiagramChallenge[] = subResults.map((r, idx) => ({
    ...r.challenge,
    id: `td-${idx + 1}`,
  }));

  console.log('📏 Tape Diagram generated:', {
    topic,
    challengeType,
    instanceCount: challenges.length,
    barsPerChallenge: challenges.map((c) => c.bars.length),
  });

  return {
    title: head.title,
    description: head.description,
    challenges,
  };
};
