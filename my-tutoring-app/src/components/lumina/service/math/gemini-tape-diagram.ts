import { Type, Schema, ThinkingLevel } from "@google/genai";
import { TapeDiagramData, BarSegment } from "../../primitives/visual-primitives/math/TapeDiagram";
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
// Schema: Part-Whole mode (existing behavior)
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
// Sub-generators per mode
// ===========================================================================

async function generateRepresentMode(topic: string, gradeLevel: string): Promise<TapeDiagramData> {
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

EXAMPLE for "Addition" (Grade 2):
{
  "title": "Fruit Basket",
  "wordProblem": "Emma has a basket with 5 red apples, 3 green apples, and 4 yellow apples. Help her organize the tape diagram!",
  "description": "Read the problem and fill in each part of the tape diagram.",
  "part1Value": 5, "part1Label": "red apples",
  "part2Value": 3, "part2Label": "green apples",
  "part3Value": 4, "part3Label": "yellow apples"
}
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
    challengeType: 'represent',
    title: data.title,
    description: data.description,
    wordProblem: data.wordProblem,
    bars: [{
      segments,
      totalLabel: `Total = ${total}`,
    }],
    comparisonMode: false,
    showBrackets: false,
  };
}

async function generatePartWholeMode(topic: string, gradeLevel: string): Promise<TapeDiagramData> {
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

EXAMPLE for "Addition" (Grade 3):
{
  "title": "Marble Collection",
  "description": "Learn to find the whole and unknown parts using a tape diagram",
  "knownPart1Value": 8, "knownPart1Label": "red marbles",
  "knownPart2Value": 5, "knownPart2Label": "blue marbles",
  "unknown1Value": 7, "unknown1Label": "green marbles",
  "unknown2Value": 4, "unknown2Label": "yellow marbles"
}
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
    challengeType: 'solve_part_whole',
    title: data.title,
    description: data.description,
    bars: [{
      segments,
      totalLabel: `Total = ${grandTotal}`,
    }],
    comparisonMode: false,
    showBrackets: true,
  };
}

async function generateComparisonMode(topic: string, gradeLevel: string): Promise<TapeDiagramData> {
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

EXAMPLE for "Subtraction" (Grade 3):
{
  "title": "Sticker Collection",
  "description": "Compare two collections to find the difference",
  "wordProblem": "Sam has 15 stickers and Maya has 9 stickers. How many more stickers does Sam have than Maya?",
  "quantity1Label": "Sam's stickers", "quantity1Value": 15,
  "quantity2Label": "Maya's stickers", "quantity2Value": 9,
  "comparisonWord": "more",
  "unknownPart": "difference"
}
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

  // Ensure quantity1 >= quantity2
  const q1 = Math.max(data.quantity1Value, data.quantity2Value);
  const q2 = Math.min(data.quantity1Value, data.quantity2Value);
  const diff = q1 - q2;

  // Bar 1: the larger quantity (fully known, or with unknown segment)
  // Bar 2: the smaller quantity (fully known, or with unknown segment)
  // We also show the difference as a segment on the larger bar

  let bar1Segments: BarSegment[];
  let bar2Segments: BarSegment[];

  if (data.unknownPart === 'difference') {
    // Student finds the difference: bar1 has [quantity2 portion | difference?], bar2 has [quantity2]
    bar1Segments = [
      { value: q2, label: `matching ${data.quantity2Label}` },
      { value: diff, label: 'difference', isUnknown: true },
    ];
    bar2Segments = [
      { value: q2, label: data.quantity2Label },
    ];
  } else if (data.unknownPart === 'quantity2') {
    // Student finds quantity2: bar1 has [quantity1], bar2 has [quantity2?]
    bar1Segments = [
      { value: q1, label: data.quantity1Label },
    ];
    bar2Segments = [
      { value: q2, label: data.quantity2Label, isUnknown: true },
    ];
  } else {
    // Student finds quantity1: bar1 has [quantity1?], bar2 has [quantity2]
    bar1Segments = [
      { value: q1, label: data.quantity1Label, isUnknown: true },
    ];
    bar2Segments = [
      { value: q2, label: data.quantity2Label },
    ];
  }

  return {
    challengeType: 'solve_comparison',
    title: data.title,
    description: data.description,
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
  };
}

async function generateMultiStepMode(topic: string, gradeLevel: string): Promise<TapeDiagramData> {
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

EXAMPLE for "Multi-step Addition/Subtraction" (Grade 4):
{
  "title": "School Supply Budget",
  "description": "Solve a two-step problem using a tape diagram",
  "wordProblem": "Alex spent $12 on pens and $8 on notebooks. He started with $35. How much does he have left after buying a $5 eraser too?",
  "part1Value": 12, "part1Label": "pens cost",
  "part2Value": 8, "part2Label": "notebooks cost",
  "intermediateValue": 20, "intermediateLabel": "supplies subtotal",
  "finalValue": 10, "finalLabel": "money remaining",
  "step1Hint": "First, find the total spent on pens and notebooks",
  "step2Hint": "Now subtract the subtotal and eraser cost from 35"
}
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

  // Build bar with 4 segments: 2 known + intermediate (unknown step 1) + final (unknown step 2)
  const segments: BarSegment[] = [
    { value: data.part1Value, label: data.part1Label },
    { value: data.part2Value, label: data.part2Label },
    { value: data.intermediateValue, label: data.intermediateLabel, isUnknown: true },
    { value: data.finalValue, label: data.finalLabel, isUnknown: true },
  ];

  const total = data.part1Value + data.part2Value + data.intermediateValue + data.finalValue;

  return {
    challengeType: 'multi_step',
    title: data.title,
    description: data.description,
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
      solveOrder: [2, 3], // segment indices: solve intermediate first, then final
    },
  };
}

// ===========================================================================
// Main generator — delegates to sub-generator based on eval mode
// ===========================================================================

export const generateTapeDiagram = async (
  topic: string,
  gradeLevel: string,
  config?: {
    targetEvalMode?: string;
  }
): Promise<TapeDiagramData> => {
  const evalConstraint = resolveEvalModeConstraint('tape-diagram', config?.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('TapeDiagram', config?.targetEvalMode, evalConstraint);

  // Determine challenge type from eval constraint (defaults to solve_part_whole)
  const challengeType = evalConstraint?.allowedTypes[0] || 'solve_part_whole';

  switch (challengeType) {
    case 'represent':
      return generateRepresentMode(topic, gradeLevel);
    case 'solve_comparison':
      return generateComparisonMode(topic, gradeLevel);
    case 'multi_step':
      return generateMultiStepMode(topic, gradeLevel);
    case 'solve_part_whole':
    default:
      return generatePartWholeMode(topic, gradeLevel);
  }
};
