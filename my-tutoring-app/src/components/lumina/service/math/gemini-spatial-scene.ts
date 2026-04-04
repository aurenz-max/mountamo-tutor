import { Type, Schema } from "@google/genai";
import {
  SpatialSceneData,
  SpatialSceneChallenge,
  SceneObject,
} from "../../primitives/visual-primitives/math/SpatialScene";
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
// Shared constants & helpers
// ---------------------------------------------------------------------------

const VALID_POSITIONS = [
  "above", "below", "beside", "left_of", "right_of",
  "between", "on", "under", "next_to", "in_front_of", "behind",
];

const SCENARIO_THEMES = [
  "a classroom with furniture and toys",
  "a farm with animals and buildings",
  "a park with playground equipment",
  "a garden with flowers and bugs",
  "a bedroom with toys and furniture",
  "a zoo with animals in enclosures",
];

const SHARED_CONTEXT = `
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

IMPORTANT SPATIAL RULES:
- ALL positions must be valid grid cells: row and col must be 0, 1, or 2.
- No two objects should occupy the same grid cell.
- Use simple, warm language appropriate for young children.
- Include helpful hints that guide without giving the answer.
`;

function clampGrid(value: number, gridSize: number): number {
  return Math.max(0, Math.min(gridSize - 1, Math.round(value)));
}

function randomTheme(): string {
  return SCENARIO_THEMES[Math.floor(Math.random() * SCENARIO_THEMES.length)];
}

interface FlatObj { [key: string]: unknown }

function collectSceneObjects(flat: FlatObj, maxSlots: number, gridSize: number): SceneObject[] {
  const objects: SceneObject[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const name = flat[`sceneObj${i}Name`];
    const image = flat[`sceneObj${i}Image`];
    const row = flat[`sceneObj${i}Row`];
    const col = flat[`sceneObj${i}Col`];
    if (typeof name === "string" && typeof image === "string" &&
        typeof row === "number" && typeof col === "number") {
      objects.push({
        name, image,
        position: { row: clampGrid(row, gridSize), col: clampGrid(col, gridSize) },
      });
    }
  }
  return objects;
}

function buildTargetObject(flat: FlatObj, gridSize: number): SceneObject | undefined {
  if (typeof flat.targetName === "string" && typeof flat.targetImage === "string") {
    return {
      name: flat.targetName,
      image: flat.targetImage,
      position: {
        row: typeof flat.targetRow === "number" ? clampGrid(flat.targetRow, gridSize) : 0,
        col: typeof flat.targetCol === "number" ? clampGrid(flat.targetCol, gridSize) : 0,
      },
    };
  }
  return undefined;
}

// Scene object schema fields (2 slots — enough for spatial reference)
function sceneObjFields(slots: number): Record<string, Schema> {
  const fields: Record<string, Schema> = {};
  for (let i = 0; i < slots; i++) {
    fields[`sceneObj${i}Name`] = { type: Type.STRING, description: `Scene object ${i + 1} name`, nullable: true };
    fields[`sceneObj${i}Image`] = { type: Type.STRING, description: `Scene object ${i + 1} emoji`, nullable: true };
    fields[`sceneObj${i}Row`] = { type: Type.NUMBER, description: `Scene object ${i + 1} row (0-2)`, nullable: true };
    fields[`sceneObj${i}Col`] = { type: Type.NUMBER, description: `Scene object ${i + 1} col (0-2)`, nullable: true };
  }
  return fields;
}

// Target object schema fields
const TARGET_FIELDS: Record<string, Schema> = {
  targetName: { type: Type.STRING, description: "Target object name" },
  targetImage: { type: Type.STRING, description: "Target object emoji" },
  targetRow: { type: Type.NUMBER, description: "Target object row (0-2)", nullable: true },
  targetCol: { type: Type.NUMBER, description: "Target object col (0-2)", nullable: true },
};

// Base challenge fields shared by all types
const BASE_FIELDS: Record<string, Schema> = {
  id: { type: Type.STRING, description: "Unique challenge ID (e.g., 'c1')" },
  instruction: { type: Type.STRING, description: "Student-facing instruction" },
  hint: { type: Type.STRING, description: "Hint shown after wrong attempts" },
};

// ---------------------------------------------------------------------------
// Per-mode schemas (flat, focused)
// ---------------------------------------------------------------------------

// identify & describe share the same schema
const identifyDescribeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challenges: {
      type: Type.ARRAY,
      description: "3 progressive challenges",
      items: {
        type: Type.OBJECT,
        properties: {
          ...BASE_FIELDS,
          ...sceneObjFields(2),
          ...TARGET_FIELDS,
          correctPosition: { type: Type.STRING, description: "Correct position word (above, below, beside, left_of, right_of, next_to)" },
          referenceObjectName: { type: Type.STRING, description: "Name of the reference object" },
          option0: { type: Type.STRING, description: "Answer option 1" },
          option1: { type: Type.STRING, description: "Answer option 2" },
          option2: { type: Type.STRING, description: "Answer option 3" },
          option3: { type: Type.STRING, description: "Answer option 4" },
        },
        required: ["id", "instruction", "hint", "targetName", "targetImage", "correctPosition", "referenceObjectName", "option0", "option1", "option2", "option3"],
      },
    },
  },
  required: ["challenges"],
};

const placeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challenges: {
      type: Type.ARRAY,
      description: "3 progressive challenges",
      items: {
        type: Type.OBJECT,
        properties: {
          ...BASE_FIELDS,
          ...sceneObjFields(2),
          targetName: { type: Type.STRING, description: "Target object name (student places this)" },
          targetImage: { type: Type.STRING, description: "Target object emoji" },
          correctCellRow: { type: Type.NUMBER, description: "Correct row for placement (0-2)" },
          correctCellCol: { type: Type.NUMBER, description: "Correct col for placement (0-2)" },
        },
        required: ["id", "instruction", "hint", "targetName", "targetImage", "correctCellRow", "correctCellCol"],
      },
    },
  },
  required: ["challenges"],
};

const followDirectionsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challenges: {
      type: Type.ARRAY,
      description: "2 progressive challenges",
      items: {
        type: Type.OBJECT,
        properties: {
          ...BASE_FIELDS,
          // 1 reference object already on the grid
          sceneObj0Name: { type: Type.STRING, description: "Reference object name" },
          sceneObj0Image: { type: Type.STRING, description: "Reference object emoji" },
          sceneObj0Row: { type: Type.NUMBER, description: "Reference object row (0-2)" },
          sceneObj0Col: { type: Type.NUMBER, description: "Reference object col (0-2)" },
          // 2 steps
          step0Instruction: { type: Type.STRING, description: "Step 1 instruction" },
          step0TargetName: { type: Type.STRING, description: "Step 1 target name" },
          step0TargetImage: { type: Type.STRING, description: "Step 1 target emoji" },
          step0CorrectRow: { type: Type.NUMBER, description: "Step 1 correct row (0-2)" },
          step0CorrectCol: { type: Type.NUMBER, description: "Step 1 correct col (0-2)" },
          step1Instruction: { type: Type.STRING, description: "Step 2 instruction" },
          step1TargetName: { type: Type.STRING, description: "Step 2 target name" },
          step1TargetImage: { type: Type.STRING, description: "Step 2 target emoji" },
          step1CorrectRow: { type: Type.NUMBER, description: "Step 2 correct row (0-2)" },
          step1CorrectCol: { type: Type.NUMBER, description: "Step 2 correct col (0-2)" },
        },
        required: ["id", "instruction", "hint", "sceneObj0Name", "sceneObj0Image", "sceneObj0Row", "sceneObj0Col",
          "step0Instruction", "step0TargetName", "step0TargetImage", "step0CorrectRow", "step0CorrectCol",
          "step1Instruction", "step1TargetName", "step1TargetImage", "step1CorrectRow", "step1CorrectCol"],
      },
    },
  },
  required: ["challenges"],
};

// ---------------------------------------------------------------------------
// Per-mode sub-generators
// ---------------------------------------------------------------------------

async function generateIdentifyDescribe(
  topic: string, gradeLevel: string, theme: string, mode: "identify" | "describe",
): Promise<SpatialSceneChallenge[]> {
  const modeLabel = mode === "identify"
    ? "identify — ask 'Where is X relative to Y?' with 4 position-word options"
    : "describe — show arrangement, ask student to pick the position word that describes it";

  const prompt = `
Create 3 spatial reasoning "${mode}" challenges for "${topic}" (${gradeLevel}).
Theme: ${theme}.

${SHARED_CONTEXT}

CHALLENGE TYPE: ${modeLabel}
- Place 2 scene objects on a 3×3 grid.
- Set targetName/targetImage/targetRow/targetCol for the object being asked about.
- Set referenceObjectName to the other object.
- correctPosition MUST accurately match the grid positions.
- option0..option3 = correctPosition + 3 distractors (all valid position words).
- Progress from easy to harder spatial relationships.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: identifyDescribeSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges) return [];

  const gridSize = 3;
  return (data.challenges as FlatObj[]).map((flat) => {
    const sceneObjects = collectSceneObjects(flat, 2, gridSize);
    const targetObject = buildTargetObject(flat, gridSize) ?? sceneObjects[0] ?? { name: "cat", image: "\u{1F431}", position: { row: 0, col: 0 } };
    const pos = typeof flat.correctPosition === "string" && VALID_POSITIONS.includes(flat.correctPosition)
      ? flat.correctPosition : "above";

    const options: string[] = [];
    for (let i = 0; i < 4; i++) {
      const v = flat[`option${i}`];
      if (typeof v === "string" && v.length > 0) options.push(v);
    }
    if (options.length < 2) options.push(pos, "above", "below", "beside");
    if (!options.includes(pos)) options[0] = pos;

    return {
      id: String(flat.id ?? `c${Math.random().toString(36).slice(2, 6)}`),
      type: mode,
      instruction: String(flat.instruction ?? "Where is the object?"),
      hint: String(flat.hint ?? "Look at the grid!"),
      sceneObjects: sceneObjects.length > 0 ? sceneObjects : [targetObject],
      targetObject,
      correctPosition: pos as SpatialSceneChallenge["correctPosition"],
      referenceObjectName: typeof flat.referenceObjectName === "string" ? flat.referenceObjectName : undefined,
      options,
    };
  });
}

async function generatePlace(
  topic: string, gradeLevel: string, theme: string,
): Promise<SpatialSceneChallenge[]> {
  const prompt = `
Create 3 spatial reasoning "place" challenges for "${topic}" (${gradeLevel}).
Theme: ${theme}.

${SHARED_CONTEXT}

CHALLENGE TYPE: place — student taps a grid cell to place an object.
- Place 1-2 reference scene objects on a 3×3 grid.
- Set targetName/targetImage for the object the student will place (do NOT set its row/col).
- Set correctCellRow/correctCellCol for where the target should go.
- Instruction says something like "Put the ball above the box".
- Progress from easy to harder positions.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: placeSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges) return [];

  const gridSize = 3;
  return (data.challenges as FlatObj[]).map((flat) => {
    const sceneObjects = collectSceneObjects(flat, 2, gridSize);
    const targetObject: SceneObject = {
      name: typeof flat.targetName === "string" ? flat.targetName : "ball",
      image: typeof flat.targetImage === "string" ? flat.targetImage : "\u{26BD}",
      position: { row: 0, col: 0 }, // placeholder — student places it
    };
    const correctCell = {
      row: typeof flat.correctCellRow === "number" ? clampGrid(flat.correctCellRow, gridSize) : 0,
      col: typeof flat.correctCellCol === "number" ? clampGrid(flat.correctCellCol, gridSize) : 0,
    };

    return {
      id: String(flat.id ?? `c${Math.random().toString(36).slice(2, 6)}`),
      type: "place" as const,
      instruction: String(flat.instruction ?? "Place the object!"),
      hint: String(flat.hint ?? "Think about where things go!"),
      sceneObjects: sceneObjects.length > 0 ? sceneObjects : [{ name: "house", image: "\u{1F3E0}", position: { row: 1, col: 1 } }],
      targetObject,
      correctPosition: "above" as const, // not used for place, but satisfies type
      correctCell,
    };
  });
}

async function generateFollowDirections(
  topic: string, gradeLevel: string, theme: string,
): Promise<SpatialSceneChallenge[]> {
  const prompt = `
Create 2 spatial reasoning "follow_directions" challenges for "${topic}" (${gradeLevel}).
Theme: ${theme}.

${SHARED_CONTEXT}

CHALLENGE TYPE: follow_directions — multi-step placement.
- Place 1 reference scene object on a 3×3 grid.
- Provide 2 steps. Each step tells the student to place an object at a position.
- Each step needs: instruction, target name/image, correct row/col.
- Example: "Put the cat above the house" then "Put the dog beside the house".
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: followDirectionsSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges) return [];

  const gridSize = 3;
  return (data.challenges as FlatObj[]).map((flat) => {
    const sceneObjects = collectSceneObjects(flat, 1, gridSize);
    const referenceObj = sceneObjects[0] ?? { name: "house", image: "\u{1F3E0}", position: { row: 1, col: 1 } };

    const steps: NonNullable<SpatialSceneChallenge["steps"]> = [];
    for (let i = 0; i < 2; i++) {
      const inst = flat[`step${i}Instruction`];
      const name = flat[`step${i}TargetName`];
      const image = flat[`step${i}TargetImage`];
      const row = flat[`step${i}CorrectRow`];
      const col = flat[`step${i}CorrectCol`];
      if (typeof inst === "string" && typeof name === "string" && typeof image === "string" &&
          typeof row === "number" && typeof col === "number") {
        const r = clampGrid(row, gridSize);
        const c = clampGrid(col, gridSize);
        steps.push({
          instruction: inst,
          targetObject: { name, image, position: { row: r, col: c } },
          correctCell: { row: r, col: c },
        });
      }
    }

    return {
      id: String(flat.id ?? `c${Math.random().toString(36).slice(2, 6)}`),
      type: "follow_directions" as const,
      instruction: String(flat.instruction ?? "Follow the directions!"),
      hint: String(flat.hint ?? "Read each step carefully!"),
      sceneObjects: [referenceObj],
      targetObject: referenceObj, // reference obj shown on grid
      correctPosition: "above" as const, // not used, satisfies type
      steps: steps.length > 0 ? steps : [
        { instruction: "Put the cat above the house", targetObject: { name: "cat", image: "\u{1F431}", position: { row: 0, col: 1 } }, correctCell: { row: 0, col: 1 } },
        { instruction: "Put the dog beside the house", targetObject: { name: "dog", image: "\u{1F415}", position: { row: 1, col: 2 } }, correctCell: { row: 1, col: 2 } },
      ],
    };
  });
}

// ---------------------------------------------------------------------------
// Fallbacks (used if all LLM calls fail)
// ---------------------------------------------------------------------------

const FALLBACKS: Record<string, SpatialSceneChallenge> = {
  identify: {
    id: "c1", type: "identify",
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
    id: "c1", type: "place",
    instruction: "Put the ball above the house!",
    hint: "Above means higher up on the grid.",
    sceneObjects: [{ name: "house", image: "\u{1F3E0}", position: { row: 2, col: 1 } }],
    targetObject: { name: "ball", image: "\u{26BD}", position: { row: 0, col: 1 } },
    correctPosition: "above",
    correctCell: { row: 1, col: 1 },
  },
  describe: {
    id: "c1", type: "describe",
    instruction: "Look at the star and the tree. Where is the star?",
    hint: "Is the star higher, lower, or next to the tree?",
    sceneObjects: [{ name: "tree", image: "\u{1F333}", position: { row: 1, col: 1 } }],
    targetObject: { name: "star", image: "\u{2B50}", position: { row: 0, col: 1 } },
    correctPosition: "above",
    referenceObjectName: "tree",
    options: ["above", "below", "beside", "next_to"],
  },
  follow_directions: {
    id: "c1", type: "follow_directions",
    instruction: "Follow the directions to set up the scene!",
    hint: "Read each step carefully and place the object in the right spot.",
    sceneObjects: [{ name: "house", image: "\u{1F3E0}", position: { row: 1, col: 1 } }],
    targetObject: { name: "house", image: "\u{1F3E0}", position: { row: 1, col: 1 } },
    correctPosition: "above",
    steps: [
      { instruction: "Put the cat above the house", targetObject: { name: "cat", image: "\u{1F431}", position: { row: 0, col: 1 } }, correctCell: { row: 0, col: 1 } },
      { instruction: "Put the dog beside the house", targetObject: { name: "dog", image: "\u{1F415}", position: { row: 1, col: 2 } }, correctCell: { row: 1, col: 2 } },
    ],
  },
};

// ---------------------------------------------------------------------------
// Orchestrator — public API (same signature as before)
// ---------------------------------------------------------------------------

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
  logEvalModeResolution("SpatialScene", config?.targetEvalMode, evalConstraint);

  const allowedTypes = evalConstraint?.allowedTypes
    ?? ["identify", "place", "describe", "follow_directions"];

  const theme = randomTheme();

  // -- Dispatch per-mode sub-generators in parallel --
  const generators: Promise<SpatialSceneChallenge[]>[] = [];

  if (allowedTypes.includes("identify")) {
    generators.push(
      generateIdentifyDescribe(topic, gradeLevel, theme, "identify")
        .catch((e) => { console.error("[SpatialScene] identify failed:", e); return []; }),
    );
  }
  if (allowedTypes.includes("describe")) {
    generators.push(
      generateIdentifyDescribe(topic, gradeLevel, theme, "describe")
        .catch((e) => { console.error("[SpatialScene] describe failed:", e); return []; }),
    );
  }
  if (allowedTypes.includes("place")) {
    generators.push(
      generatePlace(topic, gradeLevel, theme)
        .catch((e) => { console.error("[SpatialScene] place failed:", e); return []; }),
    );
  }
  if (allowedTypes.includes("follow_directions")) {
    generators.push(
      generateFollowDirections(topic, gradeLevel, theme)
        .catch((e) => { console.error("[SpatialScene] follow_directions failed:", e); return []; }),
    );
  }

  const results = await Promise.all(generators);
  let challenges = results.flat();

  // Re-index IDs
  challenges = challenges.map((ch, i) => ({ ...ch, id: `c${i + 1}` }));

  // -- Fallback if empty --
  if (challenges.length === 0) {
    const fallbackType = allowedTypes[0] ?? "identify";
    console.log(`[SpatialScene] All sub-generators failed — using ${fallbackType} fallback`);
    challenges = [FALLBACKS[fallbackType] ?? FALLBACKS.identify];
  }

  // -- Determine gradeBand --
  const gl = gradeLevel.toLowerCase();
  const gradeBand: "K" | "1" = gl.includes("kinder") || gl.includes("k") ? "K" : "1";

  const typeBreakdown = challenges.map((c) => c.type).join(", ");
  console.log(`[SpatialScene] Final: ${challenges.length} challenge(s) -> [${typeBreakdown}]`);

  return {
    title: `Spatial Scene: ${topic}`,
    description: `Explore spatial relationships with a ${theme}`,
    challenges,
    gridSize: 3,
    gradeBand,
  };
};
