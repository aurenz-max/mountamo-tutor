import { Type, Schema, ThinkingLevel } from "@google/genai";
import { TapeDiagramData, BarSegment } from "../../primitives/visual-primitives/math/TapeDiagram";
import { ai } from "../geminiClient";

/**
 * Strict 3-Phase Tape Diagram Schema
 *
 * Enforces a well-defined structure for part-whole problems:
 * - Exactly 2 known parts for Phase 1 (Explore)
 * - Exactly 2 unknowns for Phase 2 (Practice)
 * - Exactly 3 unknowns for Phase 3 (Apply) - requires synthesis
 */

const tapeDiagramSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the problem"
    },
    description: {
      type: Type.STRING,
      description: "Educational description"
    },
    knownPart1Value: {
      type: Type.NUMBER,
      description: "Value of first known part (used in all 3 phases)"
    },
    knownPart1Label: {
      type: Type.STRING,
      description: "Label for first known part"
    },
    knownPart2Value: {
      type: Type.NUMBER,
      description: "Value of second known part (used in Phase 1 and Phase 3)"
    },
    knownPart2Label: {
      type: Type.STRING,
      description: "Label for second known part"
    },
    unknown1Value: {
      type: Type.NUMBER,
      description: "Value of first unknown part (shown in Phase 2 and Phase 3)"
    },
    unknown1Label: {
      type: Type.STRING,
      description: "Label for first unknown part"
    },
    unknown2Value: {
      type: Type.NUMBER,
      description: "Value of second unknown part (shown in Phase 3 only)"
    },
    unknown2Label: {
      type: Type.STRING,
      description: "Label for second unknown part"
    }
  },
  required: [
    "title",
    "description",
    "knownPart1Value",
    "knownPart1Label",
    "knownPart2Value",
    "knownPart2Label",
    "unknown1Value",
    "unknown1Label",
    "unknown2Value",
    "unknown2Label"
  ]
};

/**
 * Response structure from Gemini API
 */
interface TapeDiagramResponse {
  title: string;
  description: string;
  knownPart1Value: number;
  knownPart1Label: string;
  knownPart2Value: number;
  knownPart2Label: string;
  unknown1Value: number;
  unknown1Label: string;
  unknown2Value: number;
  unknown2Label: string;
}

/**
 * Generate a structured 3-phase tape diagram problem
 *
 * Enforces a strict learning progression:
 * - Phase 1 (Explore): Show 2 known parts, student finds total (no unknowns shown)
 * - Phase 2 (Practice): Show 1 known part + total, student finds 1 unknown (first unknown revealed)
 * - Phase 3 (Apply): Show 2 known parts + total, student finds 2nd unknown (synthesis, both unknowns active)
 *
 * @param topic - The math topic or word problem context
 * @param gradeLevel - Grade level for age-appropriate content and numbers
 * @returns TapeDiagramData structured for 3-phase evaluation
 */
export const generateTapeDiagram = async (
  topic: string,
  gradeLevel: string
): Promise<TapeDiagramData> => {
  const prompt = `
Create a cohesive part-whole problem for teaching "${topic}" to ${gradeLevel} students.

You need to provide values and labels for 4 different parts that will be used across 3 learning phases:
- 2 known parts (always shown)
- 2 unknown parts (revealed progressively)

STRUCTURE REQUIRED:
- knownPart1: A concrete value with meaningful label
- knownPart2: A concrete value with meaningful label
- unknown1: A value with meaningful label (revealed in Phase 2)
- unknown2: A value with meaningful label (revealed in Phase 3)

HOW THESE ARE USED IN PHASES:
Phase 1 (Explore): Show knownPart1 + knownPart2, student finds total
Phase 2 (Practice): Show knownPart1 + unknown1 (marked as unknown), show total, student solves for unknown1
Phase 3 (Apply): Show knownPart1 + knownPart2 + unknown1 + unknown2 (both unknowns marked), show total, student solves for both unknowns

MATHEMATICAL CONSTRAINTS:
- All values must be positive integers
- Choose values appropriate for ${gradeLevel}
- Ensure the math works out correctly across all phases

GRADE-LEVEL NUMBER GUIDANCE:
- Grades 1-3: Use 1-20 (small, manageable numbers)
- Grades 4-5: Use 10-100 (medium numbers)
- Grades 6+: Use 20-500 (larger, realistic numbers)

CONTEXT & LABELS:
- Use a single coherent scenario (marbles, fruits, books, points, etc.)
- All 4 labels should fit the same theme
- Use concrete, descriptive labels (not "Part 1", "Segment A")
- Examples: "red marbles", "chocolate cookies", "fiction books", "Monday points"

EXAMPLE for "Addition" (Grade 3):
{
  "title": "Marble Collection",
  "description": "Learn to find the whole and unknown parts using a tape diagram",
  "knownPart1Value": 8,
  "knownPart1Label": "red marbles",
  "knownPart2Value": 5,
  "knownPart2Label": "blue marbles",
  "unknown1Value": 7,
  "unknown1Label": "green marbles",
  "unknown2Value": 4,
  "unknown2Label": "yellow marbles"
}

Generate appropriate values and labels for the given topic and grade level.
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
      responseMimeType: "application/json",
      responseSchema: tapeDiagramSchema
    },
  });

  const data: TapeDiagramResponse = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid tape diagram data returned from Gemini API');
  }

  // Calculate the grand total (sum of all 4 parts)
  const grandTotal =
    data.knownPart1Value +
    data.knownPart2Value +
    data.unknown1Value +
    data.unknown2Value;

  // Build the tape diagram with all segments
  // Phase 1 will show: knownPart1, knownPart2 (no unknowns, no total shown)
  // Phase 2 will show: knownPart1, unknown1 (first unknown active)
  // Phase 3 will show: knownPart1, knownPart2, unknown1, unknown2 (both unknowns active)
  const segments: BarSegment[] = [
    {
      value: data.knownPart1Value,
      label: data.knownPart1Label
    },
    {
      value: data.knownPart2Value,
      label: data.knownPart2Label
    },
    {
      value: data.unknown1Value,
      label: data.unknown1Label,
      isUnknown: true
    },
    {
      value: data.unknown2Value,
      label: data.unknown2Label,
      isUnknown: true
    }
  ];

  const tapeDiagramData: TapeDiagramData = {
    title: data.title,
    description: data.description,
    bars: [
      {
        segments,
        totalLabel: `Total = ${grandTotal}`
      }
    ],
    comparisonMode: false,
    showBrackets: true
  };

  return tapeDiagramData;
};
