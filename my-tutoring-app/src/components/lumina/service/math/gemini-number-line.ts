import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  NumberLineData,
  NumberLineOperation,
  NumberLineChallenge,
} from "../../primitives/visual-primitives/math/NumberLine";

/**
 * Schema definition for interactive Number Line data
 *
 * Covers drag-to-plot, jump arcs, ordering, and grade-band adaptivity.
 * K-2: integers 0-20, counting/plotting focus
 * 3-5: fractions, decimals, negative numbers, comparison & ordering
 */
const numberLineSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging, age-appropriate title for the number line activity",
    },
    description: {
      type: Type.STRING,
      description: "Brief explanation of the learning goal",
    },
    range: {
      type: Type.OBJECT,
      description: "Min/max values displayed on the number line",
      properties: {
        min: { type: Type.NUMBER, description: "Minimum value on the number line" },
        max: { type: Type.NUMBER, description: "Maximum value on the number line" },
      },
      required: ["min", "max"],
    },
    highlights: {
      type: Type.ARRAY,
      description: "Optional reference points pre-placed on the line (shown but not interactive)",
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: "Short label for the highlighted point" },
          value: { type: Type.NUMBER, description: "Position on the number line" },
        },
        required: ["label", "value"],
      },
    },
    interactionMode: {
      type: Type.STRING,
      description: "Primary interaction mode: 'plot' (place points), 'jump' (jump arcs for add/subtract), 'compare' (compare two values), 'order' (drag values into order)",
      enum: ["plot", "jump", "compare", "order"],
    },
    numberType: {
      type: Type.STRING,
      description: "Type of numbers used: 'integer', 'fraction', 'decimal', or 'mixed'",
      enum: ["integer", "fraction", "decimal", "mixed"],
    },
    operations: {
      type: Type.ARRAY,
      description: "Operations for jump mode — each describes an addition or subtraction jump arc",
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: "Operation type",
            enum: ["add", "subtract"],
          },
          startValue: {
            type: Type.NUMBER,
            description: "Starting point for the jump on the number line",
          },
          changeValue: {
            type: Type.NUMBER,
            description: "How far to jump (always positive; direction is determined by type)",
          },
          showJumpArc: {
            type: Type.BOOLEAN,
            description: "Whether to display the jump arc visually as a reference",
          },
        },
        required: ["type", "startValue", "changeValue", "showJumpArc"],
      },
    },
    challenges: {
      type: Type.ARRAY,
      description: "Array of 2-4 interactive challenges for the student",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID (e.g., 'c1', 'c2')",
          },
          type: {
            type: Type.STRING,
            description: "Challenge type — must align with the interactionMode",
            enum: ["plot_point", "show_jump", "order_values", "find_between"],
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction text, warm and grade-appropriate",
          },
          targetValues: {
            type: Type.ARRAY,
            description: "Correct answer value(s) the student needs to place or identify",
            items: { type: Type.NUMBER },
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after 2+ incorrect attempts",
          },
        },
        required: ["id", "type", "instruction", "targetValues", "hint"],
      },
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K-2' for early elementary, '3-5' for upper elementary",
      enum: ["K-2", "3-5"],
    },
  },
  required: [
    "title",
    "description",
    "range",
    "interactionMode",
    "numberType",
    "challenges",
    "gradeBand",
  ],
};

/**
 * Generate interactive Number Line content
 *
 * Creates grade-appropriate number line challenges with drag-to-plot,
 * jump-arc operations, ordering, and comparison modes.
 *
 * Grade-aware content:
 * - K-2: integers 0-20, counting and plotting focus, simple addition jumps
 * - 3-5: fractions, decimals, negative numbers, ordering and comparison
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration including intent
 * @returns NumberLineData with full interactive configuration
 */
export const generateNumberLine = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ intent: string }>
): Promise<NumberLineData> => {
  const prompt = `You are generating an interactive Number Line activity for elementary math education.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeLevel}
- Intent: ${config?.intent || topic}

GRADE-LEVEL GUIDELINES:
- K-2 (gradeBand "K-2"):
  * Use ONLY integers, numberType "integer"
  * Range: 0 to 20 (or a subset like 0-10 for Kindergarten)
  * Interaction modes: "plot" (place a number) or "jump" (addition/subtraction hops)
  * Challenge types: "plot_point" (for plot mode) or "show_jump" (for jump mode)
  * Use warm, simple language ("Can you find where 7 lives on the number line?")
  * Operations: simple +1, +2, +3, +5 jumps; always start within range

- 3-5 (gradeBand "3-5"):
  * Use fractions, decimals, or mixed numbers as appropriate
  * Range can include negative numbers (e.g., -10 to 10)
  * All interaction modes available: "plot", "jump", "compare", "order"
  * Challenge types: "plot_point", "show_jump", "order_values", "find_between"
  * More formal language but still encouraging
  * Fractions: use halves, thirds, fourths, eighths; range typically 0-2 or 0-3
  * Decimals: range typically 0-5 or 0-10

INTERACTION MODE → CHALLENGE TYPE MAPPING:
- "plot" mode → challenges should be "plot_point" (student places a point at the correct value)
- "jump" mode → challenges should be "show_jump" (student shows the result of an operation)
                 MUST include an operations array with matching operation details
- "compare" mode → challenges can be "find_between" (find a value between two given numbers)
- "order" mode → challenges should be "order_values" (arrange values in order on the line)

REQUIREMENTS:
1. Generate 2-4 challenges with unique IDs ("c1", "c2", etc.)
2. Each challenge must have a clear instruction, targetValues array, and a helpful hint
3. targetValues must all fall within the specified range
4. For "show_jump" challenges: include an operations array where each operation has type, startValue, changeValue, and showJumpArc=false (student must figure out the endpoint)
5. For "plot_point" challenges: targetValues contains the exact value(s) to plot
6. For "order_values" challenges: targetValues contains 3-5 values to be ordered
7. For "find_between" challenges: targetValues contains exactly 2 boundary values (student finds a value between them)
8. Challenges should progress in difficulty (first one easier, last one harder)
9. Include 0-2 highlights as reference points on the line (optional)
10. Hints should guide without giving the answer directly

Return the complete number line data structure.`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: numberLineSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error("No valid number line data returned from Gemini API");
  }

  // ---------------------------------------------------------------------------
  // Validation & Defaults
  // ---------------------------------------------------------------------------

  // Ensure gradeBand is valid
  if (data.gradeBand !== "K-2" && data.gradeBand !== "3-5") {
    const lower = gradeLevel.toLowerCase();
    data.gradeBand =
      lower.includes("k") || lower.includes("1") || lower.includes("2")
        ? "K-2"
        : "3-5";
  }

  // Ensure numberType is valid
  const validNumberTypes = ["integer", "fraction", "decimal", "mixed"];
  if (!validNumberTypes.includes(data.numberType)) {
    data.numberType = data.gradeBand === "K-2" ? "integer" : "decimal";
  }

  // Ensure interactionMode is valid
  const validModes = ["plot", "jump", "compare", "order"];
  if (!validModes.includes(data.interactionMode)) {
    data.interactionMode = "plot";
  }

  // Ensure range exists and is reasonable
  if (!data.range || typeof data.range.min !== "number" || typeof data.range.max !== "number") {
    data.range = data.gradeBand === "K-2" ? { min: 0, max: 10 } : { min: 0, max: 10 };
  }
  if (data.range.min >= data.range.max) {
    data.range = { min: 0, max: data.gradeBand === "K-2" ? 20 : 10 };
  }

  // K-2 guardrails: force integers, keep range sane
  if (data.gradeBand === "K-2") {
    data.numberType = "integer";
    data.range.min = Math.max(-1, Math.round(data.range.min));
    data.range.max = Math.min(30, Math.round(data.range.max));
  }

  // Ensure challenges is an array with valid entries and unique IDs
  const validChallengeTypes = ["plot_point", "show_jump", "order_values", "find_between"];
  data.challenges = (data.challenges || [])
    .filter(
      (c: NumberLineChallenge) =>
        validChallengeTypes.includes(c.type) &&
        Array.isArray(c.targetValues) &&
        c.targetValues.length > 0
    )
    .map((c: NumberLineChallenge, i: number) => ({
      ...c,
      id: c.id || `c${i + 1}`,
      hint: c.hint || "Look carefully at the numbers on the line.",
    }));

  // Ensure at least one challenge
  if (data.challenges.length === 0) {
    const mid = Math.round((data.range.min + data.range.max) / 2);
    data.challenges = [
      {
        id: "c1",
        type: "plot_point" as const,
        instruction: `Can you find ${mid} on the number line?`,
        targetValues: [mid],
        hint: "Count the tick marks from the start.",
      },
    ];
  }

  // Ensure operations array exists for jump mode
  if (data.interactionMode === "jump") {
    if (!Array.isArray(data.operations) || data.operations.length === 0) {
      // Build operations from show_jump challenges
      const jumpChallenges = data.challenges.filter(
        (c: NumberLineChallenge) => c.type === "show_jump"
      );
      if (jumpChallenges.length > 0) {
        const first = jumpChallenges[0];
        const target = first.targetValues[0] ?? data.range.min + 3;
        const start = data.range.min;
        data.operations = [
          {
            type: "add" as const,
            startValue: start,
            changeValue: target - start,
            showJumpArc: false,
          },
        ];
      } else {
        // Fallback operation
        data.operations = [
          {
            type: "add" as const,
            startValue: data.range.min,
            changeValue: Math.min(3, data.range.max - data.range.min),
            showJumpArc: false,
          },
        ];
      }
    }

    // Validate each operation
    data.operations = data.operations.map((op: NumberLineOperation) => ({
      type: op.type === "subtract" ? "subtract" : "add",
      startValue: typeof op.startValue === "number" ? op.startValue : data.range.min,
      changeValue:
        typeof op.changeValue === "number" && op.changeValue > 0
          ? op.changeValue
          : 3,
      showJumpArc: typeof op.showJumpArc === "boolean" ? op.showJumpArc : false,
    }));
  } else {
    // Non-jump modes: operations not needed, keep if provided but default to empty
    if (!Array.isArray(data.operations)) {
      data.operations = [];
    }
  }

  // Ensure highlights is an array
  if (!Array.isArray(data.highlights)) {
    data.highlights = [];
  }

  console.log("Number Line Generated:", {
    topic,
    gradeBand: data.gradeBand,
    mode: data.interactionMode,
    numberType: data.numberType,
    range: `${data.range.min}-${data.range.max}`,
    challengeCount: data.challenges.length,
    operationCount: data.operations?.length || 0,
  });

  return data as NumberLineData;
};
