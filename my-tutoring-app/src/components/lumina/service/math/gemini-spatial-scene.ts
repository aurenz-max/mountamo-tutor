import { Type, Schema } from "@google/genai";
import { SpatialSceneData } from "../../primitives/visual-primitives/math/SpatialScene";
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
  identify: {
    promptDoc:
      `"identify": Multiple-choice: 'Where is the cat?' Student picks the position word. `
      + `Show scene objects on the grid, ask about a target object's position relative to a reference. `
      + `Provide correctPosition + 3 distractor position words in options.`,
    schemaDescription: "'identify' (pick the position word)",
  },
  place: {
    promptDoc:
      `"place": Student taps a grid cell to place an object at the described position: `
      + `'Put the ball above the box'. Set correctCellRow/correctCellCol to the target cell.`,
    schemaDescription: "'place' (tap grid cell to place object)",
  },
  describe: {
    promptDoc:
      `"describe": Student selects the correct position word for a shown arrangement. `
      + `Objects are already placed; student picks which position word describes the relationship. `
      + `Provide correctPosition + 3 distractors in options.`,
    schemaDescription: "'describe' (select position word for arrangement)",
  },
  follow_directions: {
    promptDoc:
      `"follow_directions": Multi-step placement: 'Put red ball above box AND blue ball beside tree'. `
      + `Provide 2-3 steps, each with instruction, target object, and correct cell.`,
    schemaDescription: "'follow_directions' (multi-step placement)",
  },
};

// ---------------------------------------------------------------------------
// Flattened Gemini schema (arrays -> indexed fields)
// ---------------------------------------------------------------------------

const spatialSceneSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the spatial scene activity",
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description",
    },
    gridSize: {
      type: Type.NUMBER,
      description: "Grid size: 3 (for 3x3) or 4 (for 4x4). Default 3.",
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' or '1'",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID (e.g., 'c1')" },
          type: {
            type: Type.STRING,
            description:
              "Challenge type: 'identify', 'place', 'describe', 'follow_directions'",
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging",
          },
          hint: { type: Type.STRING, description: "Hint shown after incorrect attempts" },

          // Flattened sceneObjects (max 4)
          sceneObj0Name: { type: Type.STRING, description: "1st scene object name", nullable: true },
          sceneObj0Image: { type: Type.STRING, description: "1st scene object emoji", nullable: true },
          sceneObj0Row: { type: Type.NUMBER, description: "1st scene object row (0-based)", nullable: true },
          sceneObj0Col: { type: Type.NUMBER, description: "1st scene object col (0-based)", nullable: true },
          sceneObj1Name: { type: Type.STRING, description: "2nd scene object name", nullable: true },
          sceneObj1Image: { type: Type.STRING, description: "2nd scene object emoji", nullable: true },
          sceneObj1Row: { type: Type.NUMBER, description: "2nd scene object row (0-based)", nullable: true },
          sceneObj1Col: { type: Type.NUMBER, description: "2nd scene object col (0-based)", nullable: true },
          sceneObj2Name: { type: Type.STRING, description: "3rd scene object name", nullable: true },
          sceneObj2Image: { type: Type.STRING, description: "3rd scene object emoji", nullable: true },
          sceneObj2Row: { type: Type.NUMBER, description: "3rd scene object row (0-based)", nullable: true },
          sceneObj2Col: { type: Type.NUMBER, description: "3rd scene object col (0-based)", nullable: true },
          sceneObj3Name: { type: Type.STRING, description: "4th scene object name", nullable: true },
          sceneObj3Image: { type: Type.STRING, description: "4th scene object emoji", nullable: true },
          sceneObj3Row: { type: Type.NUMBER, description: "4th scene object row (0-based)", nullable: true },
          sceneObj3Col: { type: Type.NUMBER, description: "4th scene object col (0-based)", nullable: true },

          // Flattened targetObject
          targetName: { type: Type.STRING, description: "Target object name", nullable: true },
          targetImage: { type: Type.STRING, description: "Target object emoji", nullable: true },
          targetRow: { type: Type.NUMBER, description: "Target object row (0-based)", nullable: true },
          targetCol: { type: Type.NUMBER, description: "Target object col (0-based)", nullable: true },

          // identify / describe fields
          correctPosition: {
            type: Type.STRING,
            description: "Correct position word: above, below, beside, left_of, right_of, between, on, under, next_to",
            nullable: true,
          },
          referenceObjectName: {
            type: Type.STRING,
            description: "Name of the reference object for the spatial relationship",
            nullable: true,
          },
          option0: { type: Type.STRING, description: "Answer option 1 (position word)", nullable: true },
          option1: { type: Type.STRING, description: "Answer option 2 (position word)", nullable: true },
          option2: { type: Type.STRING, description: "Answer option 3 (position word)", nullable: true },
          option3: { type: Type.STRING, description: "Answer option 4 (position word)", nullable: true },

          // place fields
          correctCellRow: { type: Type.NUMBER, description: "Correct cell row for placement", nullable: true },
          correctCellCol: { type: Type.NUMBER, description: "Correct cell col for placement", nullable: true },

          // follow_directions steps (max 3)
          step0Instruction: { type: Type.STRING, description: "Step 1 instruction", nullable: true },
          step0TargetName: { type: Type.STRING, description: "Step 1 target object name", nullable: true },
          step0TargetImage: { type: Type.STRING, description: "Step 1 target object emoji", nullable: true },
          step0CorrectRow: { type: Type.NUMBER, description: "Step 1 correct row", nullable: true },
          step0CorrectCol: { type: Type.NUMBER, description: "Step 1 correct col", nullable: true },
          step1Instruction: { type: Type.STRING, description: "Step 2 instruction", nullable: true },
          step1TargetName: { type: Type.STRING, description: "Step 2 target object name", nullable: true },
          step1TargetImage: { type: Type.STRING, description: "Step 2 target object emoji", nullable: true },
          step1CorrectRow: { type: Type.NUMBER, description: "Step 2 correct row", nullable: true },
          step1CorrectCol: { type: Type.NUMBER, description: "Step 2 correct col", nullable: true },
          step2Instruction: { type: Type.STRING, description: "Step 3 instruction", nullable: true },
          step2TargetName: { type: Type.STRING, description: "Step 3 target object name", nullable: true },
          step2TargetImage: { type: Type.STRING, description: "Step 3 target object emoji", nullable: true },
          step2CorrectRow: { type: Type.NUMBER, description: "Step 3 correct row", nullable: true },
          step2CorrectCol: { type: Type.NUMBER, description: "Step 3 correct col", nullable: true },
        },
        required: ["id", "type", "instruction", "hint"],
      },
      description: "Array of 5-6 progressive challenges",
    },
  },
  required: ["title", "description", "gridSize", "gradeBand", "challenges"],
};

// ---------------------------------------------------------------------------
// Valid position words
// ---------------------------------------------------------------------------

const VALID_POSITIONS = [
  "above", "below", "beside", "left_of", "right_of",
  "between", "on", "under", "next_to", "in_front_of", "behind",
];

// ---------------------------------------------------------------------------
// Flat -> structured helpers
// ---------------------------------------------------------------------------

interface FlatChallenge {
  [key: string]: unknown;
}

function collectSceneObjects(flat: FlatChallenge, maxSlots: number, gridSize: number) {
  const objects: { name: string; image: string; position: { row: number; col: number } }[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const name = flat[`sceneObj${i}Name`];
    const image = flat[`sceneObj${i}Image`];
    const row = flat[`sceneObj${i}Row`];
    const col = flat[`sceneObj${i}Col`];
    if (typeof name === "string" && typeof image === "string" &&
        typeof row === "number" && typeof col === "number") {
      objects.push({
        name,
        image,
        position: {
          row: clampGrid(row, gridSize),
          col: clampGrid(col, gridSize),
        },
      });
    }
  }
  return objects.length > 0 ? objects : undefined;
}

function collectOptions(flat: FlatChallenge, maxSlots: number) {
  const options: string[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const v = flat[`option${i}`];
    if (typeof v === "string" && v.length > 0) options.push(v);
  }
  return options.length > 0 ? options : undefined;
}

function collectSteps(flat: FlatChallenge, maxSlots: number, gridSize: number) {
  const steps: Array<{
    instruction: string;
    targetObject: { name: string; image: string; position: { row: number; col: number } };
    correctCell: { row: number; col: number };
  }> = [];
  for (let i = 0; i < maxSlots; i++) {
    const instruction = flat[`step${i}Instruction`];
    const name = flat[`step${i}TargetName`];
    const image = flat[`step${i}TargetImage`];
    const row = flat[`step${i}CorrectRow`];
    const col = flat[`step${i}CorrectCol`];
    if (typeof instruction === "string" && typeof name === "string" &&
        typeof image === "string" && typeof row === "number" && typeof col === "number") {
      const clampedRow = clampGrid(row, gridSize);
      const clampedCol = clampGrid(col, gridSize);
      steps.push({
        instruction,
        targetObject: {
          name,
          image,
          position: { row: clampedRow, col: clampedCol },
        },
        correctCell: { row: clampedRow, col: clampedCol },
      });
    }
  }
  return steps.length > 0 ? steps : undefined;
}

function clampGrid(value: number, gridSize: number): number {
  return Math.max(0, Math.min(gridSize - 1, Math.round(value)));
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate spatial scene data for grid-based spatial reasoning challenges.
 *
 * Grade-aware content:
 * - K: above, below, beside, next_to only.
 * - Grade 1: add left_of, right_of.
 */
export const generateSpatialScene = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<SpatialSceneData> => {
  // -- Resolve eval mode --
  const evalConstraint = resolveEvalModeConstraint(
    "spatial-scene",
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // -- Build mode-constrained schema --
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(spatialSceneSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : spatialSceneSchema;

  // -- Build prompt --
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const scenarioThemes = [
    "a classroom with furniture and toys",
    "a farm with animals and buildings",
    "a park with playground equipment",
    "a garden with flowers and bugs",
    "a bedroom with toys and furniture",
    "a zoo with animals in enclosures",
  ];
  const randomTheme = scenarioThemes[Math.floor(Math.random() * scenarioThemes.length)];

  const prompt = `
Create an educational spatial reasoning activity for teaching "${topic}" to ${gradeLevel} students.
Theme this activity around ${randomTheme}.

CONTEXT:
- Students interact with a 3x3 grid where emoji objects are placed.
- Grid positions are 0-based: row 0 is top, row 2 is bottom; col 0 is left, col 2 is right.
- Available emoji objects: cat, dog, ball, star, tree, house, car, flower, box, chair
  Use these emojis: cat=\u{1F431}, dog=\u{1F415}, ball=\u{26BD}, star=\u{2B50}, tree=\u{1F333}, house=\u{1F3E0}, car=\u{1F697}, flower=\u{1F338}, box=\u{1F4E6}, chair=\u{1FA91}
- Position words for K grade: ONLY above, below, beside, next_to
- Position words for Grade 1: above, below, beside, next_to, left_of, right_of
- Spatial relationships on the grid:
  * "above" = target row < reference row (same col)
  * "below" = target row > reference row (same col)
  * "left_of" = target col < reference col (same row)
  * "right_of" = target col > reference col (same row)
  * "beside" / "next_to" = same row, adjacent columns (col diff = 1)

${challengeTypeSection}

FIELD GUIDELINES PER CHALLENGE TYPE:
- "identify": Place 2-3 scene objects on the grid. Set targetName/targetImage/targetRow/targetCol for the object being asked about. Set referenceObjectName to the object it's positioned relative to. Set correctPosition to the accurate position word. Set option0..option3 with correctPosition + 3 distractors. The correctPosition MUST accurately reflect the grid positions.
- "place": Place 1-2 reference scene objects. Set targetName/targetImage (no targetRow/targetCol — student places it). Set correctCellRow/correctCellCol for where the target should go. Instruction describes the position relative to a reference.
- "describe": Place 2-3 scene objects + target on the grid. Set correctPosition to the word describing the target's position relative to a reference. Set option0..option3 with correctPosition + 3 distractors.
- "follow_directions": Place 1-2 reference scene objects. Use step0..step2 fields for 2-3 sequential placement steps. Each step has instruction, target name/image, and correct row/col.

IMPORTANT SPATIAL RULES:
- ALL positions must be valid grid cells: row and col must be 0, 1, or 2 (for a 3x3 grid).
- correctPosition MUST match the actual spatial relationship between target and reference on the grid.
- For "identify" and "describe": options MUST include the correctPosition.
- No two objects should occupy the same grid cell.
- Use simple, warm language appropriate for young children.

REQUIREMENTS:
1. Generate 5-6 challenges that progress in difficulty.
2. Use warm, encouraging instruction text appropriate for young children.
3. Include helpful hints that guide without giving the answer.
4. Set gradeBand to 'K' or '1' based on grade level.
5. Set gridSize to 3.
6. Vary challenge types across the set for engagement.
7. Place 2-4 scene objects per challenge for visual context.

Return the complete spatial scene configuration.
`;

  logEvalModeResolution("SpatialScene", config?.targetEvalMode, evalConstraint);

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
    throw new Error("No valid spatial scene data returned from Gemini API");
  }

  // -- Validate gradeBand --
  const validGrades = ["K", "1"];
  if (!validGrades.includes(data.gradeBand)) {
    const gl = gradeLevel.toLowerCase();
    if (gl.includes("kinder") || gl.includes("k")) data.gradeBand = "K";
    else data.gradeBand = "1";
  }

  // -- Validate gridSize --
  const gridSize = data.gridSize === 4 ? 4 : 3;
  data.gridSize = gridSize;

  // -- Reconstruct arrays from flat fields & validate --
  const validTypes = ["identify", "place", "describe", "follow_directions"];

  data.challenges = (data.challenges || [])
    .filter((c: FlatChallenge) => validTypes.includes(c.type as string))
    .map((flat: FlatChallenge) => {
      const challenge: Record<string, unknown> = {
        id: flat.id,
        type: flat.type,
        instruction: flat.instruction,
        hint: flat.hint || "Think about where things are on the grid!",
      };

      // Reconstruct sceneObjects
      const sceneObjects = collectSceneObjects(flat, 4, gridSize);
      challenge.sceneObjects = sceneObjects ?? [];

      // Reconstruct targetObject
      if (typeof flat.targetName === "string" && typeof flat.targetImage === "string") {
        const targetRow = typeof flat.targetRow === "number" ? clampGrid(flat.targetRow, gridSize) : 0;
        const targetCol = typeof flat.targetCol === "number" ? clampGrid(flat.targetCol, gridSize) : 0;
        challenge.targetObject = {
          name: flat.targetName,
          image: flat.targetImage,
          position: { row: targetRow, col: targetCol },
        };
      }

      switch (flat.type) {
        case "identify":
        case "describe": {
          // correctPosition
          const pos = typeof flat.correctPosition === "string" ? flat.correctPosition : "above";
          challenge.correctPosition = VALID_POSITIONS.includes(pos) ? pos : "above";
          if (typeof flat.referenceObjectName === "string") {
            challenge.referenceObjectName = flat.referenceObjectName;
          }
          // options
          const options = collectOptions(flat, 4);
          challenge.options = options ?? [challenge.correctPosition, "above", "below", "beside"];
          // Ensure correctPosition is in options
          if (
            Array.isArray(challenge.options) &&
            !(challenge.options as string[]).includes(challenge.correctPosition as string)
          ) {
            (challenge.options as string[])[0] = challenge.correctPosition as string;
          }
          break;
        }
        case "place": {
          if (typeof flat.correctCellRow === "number" && typeof flat.correctCellCol === "number") {
            challenge.correctCell = {
              row: clampGrid(flat.correctCellRow, gridSize),
              col: clampGrid(flat.correctCellCol, gridSize),
            };
          }
          break;
        }
        case "follow_directions": {
          const steps = collectSteps(flat, 3, gridSize);
          challenge.steps = steps ?? [];
          break;
        }
      }

      return challenge;
    });

  // -- Fallback if empty --
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? "identify";
    console.log(`[SpatialScene] No valid challenges - using ${fallbackType} fallback`);
    const fallbacks: Record<string, Record<string, unknown>> = {
      identify: {
        id: "c1",
        type: "identify",
        instruction: "Where is the cat? Is it above or below the box?",
        hint: "Look at the grid - is the cat higher or lower than the box?",
        sceneObjects: [
          { name: "box", image: "\u{1F4E6}", position: { row: 2, col: 1 } },
          { name: "tree", image: "\u{1F333}", position: { row: 1, col: 0 } },
        ],
        targetObject: { name: "cat", image: "\u{1F431}", position: { row: 0, col: 1 } },
        correctPosition: "above",
        referenceObjectName: "box",
        options: ["above", "below", "beside", "next_to"],
      },
      place: {
        id: "c1",
        type: "place",
        instruction: "Put the ball above the house!",
        hint: "Above means higher up on the grid.",
        sceneObjects: [
          { name: "house", image: "\u{1F3E0}", position: { row: 2, col: 1 } },
        ],
        targetObject: { name: "ball", image: "\u{26BD}", position: { row: 0, col: 1 } },
        correctCell: { row: 1, col: 1 },
      },
      describe: {
        id: "c1",
        type: "describe",
        instruction: "Look at the star and the tree. Where is the star?",
        hint: "Is the star higher, lower, or next to the tree?",
        sceneObjects: [
          { name: "tree", image: "\u{1F333}", position: { row: 1, col: 1 } },
        ],
        targetObject: { name: "star", image: "\u{2B50}", position: { row: 0, col: 1 } },
        correctPosition: "above",
        referenceObjectName: "tree",
        options: ["above", "below", "beside", "next_to"],
      },
      follow_directions: {
        id: "c1",
        type: "follow_directions",
        instruction: "Follow the directions to set up the scene!",
        hint: "Read each step carefully and place the object in the right spot.",
        sceneObjects: [
          { name: "house", image: "\u{1F3E0}", position: { row: 1, col: 1 } },
        ],
        targetObject: { name: "house", image: "\u{1F3E0}", position: { row: 1, col: 1 } },
        steps: [
          {
            instruction: "Put the cat above the house",
            targetObject: { name: "cat", image: "\u{1F431}", position: { row: 0, col: 1 } },
            correctCell: { row: 0, col: 1 },
          },
          {
            instruction: "Put the dog beside the house",
            targetObject: { name: "dog", image: "\u{1F415}", position: { row: 1, col: 2 } },
            correctCell: { row: 1, col: 2 },
          },
        ],
      },
    };
    data.challenges = [fallbacks[fallbackType] ?? fallbacks.identify];
  }

  // Final log
  const typeBreakdown = (data.challenges as Array<{ type: string }>)
    .map((c) => c.type)
    .join(", ");
  console.log(
    `[SpatialScene] Final: ${data.challenges.length} challenge(s) -> [${typeBreakdown}]`,
  );

  return data as SpatialSceneData;
};
