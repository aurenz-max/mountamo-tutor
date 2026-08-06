import { Type, Schema } from "@google/genai";
import {
  SpatialSceneData,
  SpatialSceneChallenge,
  SceneObject,
} from "../../primitives/visual-primitives/math/SpatialScene";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection } from "../scopeContext";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import {
  resolvePrepositionScope,
  composePositionWindow,
  enforceSingleDefensibleOption,
  placeAnswerSlot,
  resolveRequestedModes,
  resolveBetweenCell,
  SUPPORTED_POSITION_SEMANTICS,
  type RelativePosition,
} from "./spatial-scene/resolvePrepositionScope";

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
  place_in: {
    promptDoc:
      `"place_in": CONTAINMENT. Student taps the cell the CONTAINER occupies to put an object `
      + `INSIDE it: 'Put the pencil in the box'. Name a container already on the grid; the object `
      + `goes in the container's own cell, not next to it.`,
    schemaDescription: "'place_in' (put an object inside a container)",
  },
  place_between: {
    promptDoc:
      `"place_between": TWO-REFERENCE placement. Student taps the empty cell that sits between `
      + `two named objects: 'Put the ball between the box and the tree'. The two references share `
      + `a row or a column with exactly one empty cell separating them.`,
    schemaDescription: "'place_between' (place an object between two objects)",
  },
};

// ---------------------------------------------------------------------------
// Support tiers (within-mode scaffolding withdrawal) — FIXED harness
// ---------------------------------------------------------------------------

type ChallengeType =
  | "identify" | "place" | "describe" | "follow_directions"
  | "place_in" | "place_between";

/** The four modes that shipped before the containment/two-reference fork. */
const RELATIVE_CHALLENGE_TYPES: ChallengeType[] = [
  "identify", "place", "describe", "follow_directions",
];

type SupportTier = "easy" | "medium" | "hard";

const SUPPORT_TIERS: readonly SupportTier[] = ["easy", "medium", "hard"];

/**
 * Read the manifest's support tier. The manifest schema enum-constrains
 * config.difficulty to exactly these values, so this is a STRICT lookup.
 * Unknown/absent → null (no tier applied; grade-band defaults stand).
 */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? "";
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/**
 * Bespoke spatial-scene scaffolds. The tier withdraws PERCEPTION/REFERENCE-FRAME
 * aids only — it never changes the scene layout, the asked object, or which spatial
 * relation is the answer (that axis is owned by the eval mode). Levers discovered
 * from SpatialScene.tsx: the bordered grid (reference frame), the object name labels,
 * and a NEW position-hint band that labels the position of OTHER (non-asked) objects.
 */
interface SupportScaffold {
  /** Render clear cell borders so the student has an explicit coordinate frame
   *  (rows/cols visible). At hard, the grid fades so position is judged unaided. */
  showGrid: boolean;
  /** Object name labels under each emoji (identity cue). Withdrawn at hard. */
  showObjectLabels: boolean;
  /** Show position-word hints on OTHER objects (never the asked relation) so the
   *  student infers the target relation by analogy. Easy only. ANSWER-LEAK GUARD:
   *  the component only labels non-target/non-reference relations. */
  showPositionHints: boolean;
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-workspace support structure for a tier on a pinned challenge type.
 * Support is withdrawn as the tier hardens; the per-mode lines reframe the SAME
 * task with less scaffolding — never a different relation, never a different scene.
 */
function resolveSupportStructure(pinnedType: ChallengeType, tier: SupportTier): SupportScaffold {
  const showGrid = tier !== "hard";
  const showObjectLabels = tier !== "hard";
  const showPositionHints = tier === "easy";

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-workspace SCAFFOLDING only (${
      tier === "easy"
        ? "maximum support: the reference-frame grid, object name labels, and example position hints on OTHER objects help the student read positions"
        : tier === "medium"
          ? "moderate support: the grid and object labels remain, but no example position hints"
          : "minimum support: no reference grid, no labels — the student reasons about relative position unaided and explains how they know"
    }). Keep the SAME scene layout and the SAME asked spatial relation; a harder tier NEVER changes which relation is asked or moves objects — it only removes reading aids.`,
  ];
  switch (pinnedType) {
    case "identify":
    case "describe":
      promptLines.push(
        tier === "easy"
          ? "Keep the asked relation simple and clearly separated (e.g. a clear above/below along one column). Hints may name a reference direction (sky=above, ground=below)."
          : tier === "hard"
            ? "Hints must NOT name the position word; ask the student to compare the two objects' rows/columns themselves and justify the relationship."
            : "Hints point to which two objects to compare without naming the position word.",
      );
      break;
    case "place":
      promptLines.push(
        tier === "easy"
          ? "The instruction names the relation plainly ('Put the ball ABOVE the box'); hints may restate where 'above' is on the grid."
          : tier === "hard"
            ? "Hints must NOT restate where the relation maps on the grid; ask the student to reason from the relation word to the cell themselves."
            : "Hints confirm the relation word but let the student locate the cell.",
      );
      break;
    case "place_in":
      promptLines.push(
        tier === "easy"
          ? "The instruction names the container plainly ('Put the ball IN the box'); hints may say that 'in' means inside the container itself."
          : tier === "hard"
            ? "Hints must NOT say where 'in' maps on the grid and must NOT name the container; ask the student which object could HOLD the item."
            : "Hints name the container but let the student work out that 'in' means the container's own square.",
      );
      break;
    case "place_between":
      promptLines.push(
        tier === "easy"
          ? "The instruction names both reference objects plainly ('Put the ball BETWEEN the box and the tree'); hints may say to look for the empty square with one object on each side."
          : tier === "hard"
            ? "Hints must NOT describe the empty square or name both references again; ask the student what 'between' means when there is an object on each side."
            : "Hints restate the two reference objects but let the student find the square that has one on each side.",
      );
      break;
    case "follow_directions":
      promptLines.push(
        tier === "easy"
          ? "Steps are short and reference a single fixed object; hints may restate the relation."
          : tier === "hard"
            ? "Hints must NOT restate each step's relation; ask the student to track placed objects and reason step-to-step unaided."
            : "Hints help the student keep track of already-placed objects without naming the relation.",
      );
      break;
  }
  return { showGrid, showObjectLabels, showPositionHints, promptLines };
}

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

/**
 * Build the shared prompt context for a resolved position-word WINDOW.
 *
 * Was a fixed const whose K line read "ONLY above, below, beside, next_to". That is the
 * math K.G.1 vocabulary and it silently overrode LA lessons that asked for on/under
 * ([[trust-intent-over-hardcoded-caps]]). The window is now composed per lesson —
 * band default, WIDENED by what the lesson actually asked for — and only the words in
 * that window get their grid semantics stated, so the LLM is never invited to emit a
 * relation the checker cannot judge.
 */
function buildSharedContext(positionWindow: RelativePosition[]): string {
  const semantics = positionWindow
    .map((p) => `  * ${SUPPORTED_POSITION_SEMANTICS[p]}`)
    .join("\n");

  return `
CONTEXT:
- Students interact with a 3x3 grid where emoji objects are placed.
- Grid positions are 0-based: row 0 is top, row 2 is bottom; col 0 is left, col 2 is right.
- Available emoji objects: cat, dog, ball, star, tree, house, car, flower, box, chair
  Use these emojis: cat=\u{1F431}, dog=\u{1F415}, ball=\u{26BD}, star=\u{2B50}, tree=\u{1F333}, house=\u{1F3E0}, car=\u{1F697}, flower=\u{1F338}, box=\u{1F4E6}, chair=\u{1FA91}
- Position words you may use for THIS lesson: ONLY ${positionWindow.join(", ")}.
  Never use a position word outside that list.
- Spatial relationships on the grid:
${semantics}

IMPORTANT SPATIAL RULES:
- ALL positions must be valid grid cells: row and col must be 0, 1, or 2.
- No two objects should occupy the same grid cell.
- Use simple, warm language appropriate for young children.
- Include helpful hints that guide without giving the answer.
`;
}

/**
 * Containment vocabulary for `place_in`.
 *
 * The shared object list is chosen for RELATIVE position ("the cat is above the tree"),
 * and most of it cannot hold anything — "put the ball in the star" teaches the wrong
 * meaning of `in`, which is the whole content of the skill. The prompt offers this list
 * and `NON_CONTAINERS` rejects the obvious violations the LLM still produces.
 */
const CONTAINER_OBJECTS: Array<[string, string]> = [
  ["box", "\u{1F4E6}"], ["basket", "\u{1F9FA}"], ["backpack", "\u{1F392}"],
  ["cup", "\u{1F964}"], ["bowl", "\u{1F963}"], ["house", "\u{1F3E0}"], ["car", "\u{1F697}"],
];

/** Objects nothing can be "in". A challenge naming one as the container is dropped. */
const NON_CONTAINERS = new Set(["ball", "star", "flower", "cat", "dog", "tree", "chair"]);

function clampGrid(value: number, gridSize: number): number {
  return Math.max(0, Math.min(gridSize - 1, Math.round(value)));
}

/** Resolve a scene object by name, tolerant of casing/whitespace drift from the LLM. */
function findObject(objects: SceneObject[], name: unknown): SceneObject | undefined {
  if (typeof name !== "string") return undefined;
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return objects.find((o) => o.name.trim().toLowerCase() === key);
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

// Scene object schema fields — ALL required (SP-14: nullable fields cause Gemini to drop them)
function sceneObjFields(slots: number): Record<string, Schema> {
  const fields: Record<string, Schema> = {};
  for (let i = 0; i < slots; i++) {
    fields[`sceneObj${i}Name`] = { type: Type.STRING, description: `Scene object ${i + 1} name` };
    fields[`sceneObj${i}Image`] = { type: Type.STRING, description: `Scene object ${i + 1} emoji` };
    fields[`sceneObj${i}Row`] = { type: Type.NUMBER, description: `Scene object ${i + 1} row (0-2)` };
    fields[`sceneObj${i}Col`] = { type: Type.NUMBER, description: `Scene object ${i + 1} col (0-2)` };
  }
  return fields;
}

function sceneObjRequiredFields(slots: number): string[] {
  const fields: string[] = [];
  for (let i = 0; i < slots; i++) {
    fields.push(`sceneObj${i}Name`, `sceneObj${i}Image`, `sceneObj${i}Row`, `sceneObj${i}Col`);
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

// identify & describe share the same schema (4 scene object slots for a populated grid)
const IDENTIFY_DESCRIBE_SLOTS = 4;
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
          ...sceneObjFields(IDENTIFY_DESCRIBE_SLOTS),
          ...TARGET_FIELDS,
          correctPosition: { type: Type.STRING, description: "Correct position word (above, below, beside, left_of, right_of, next_to)" },
          referenceObjectName: { type: Type.STRING, description: "Name of the reference object" },
          option0: { type: Type.STRING, description: "Answer option 1" },
          option1: { type: Type.STRING, description: "Answer option 2" },
          option2: { type: Type.STRING, description: "Answer option 3" },
          option3: { type: Type.STRING, description: "Answer option 4" },
        },
        required: ["id", "instruction", "hint", ...sceneObjRequiredFields(IDENTIFY_DESCRIBE_SLOTS), "targetName", "targetImage", "targetRow", "targetCol", "correctPosition", "referenceObjectName", "option0", "option1", "option2", "option3"],
      },
    },
  },
  required: ["challenges"],
};

const PLACE_SLOTS = 4;
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
          ...sceneObjFields(PLACE_SLOTS),
          targetName: { type: Type.STRING, description: "Target object name (student places this)" },
          targetImage: { type: Type.STRING, description: "Target object emoji" },
          correctCellRow: { type: Type.NUMBER, description: "Correct row for placement (0-2)" },
          correctCellCol: { type: Type.NUMBER, description: "Correct col for placement (0-2)" },
        },
        required: ["id", "instruction", "hint", ...sceneObjRequiredFields(PLACE_SLOTS), "targetName", "targetImage", "correctCellRow", "correctCellCol"],
      },
    },
  },
  required: ["challenges"],
};

/**
 * `place_in` — containment. NOTE what is absent: no correctCellRow/Col. The answer is
 * the container's own cell, derived in code from `containerName`, so the LLM cannot
 * emit a placement that contradicts the container it drew.
 */
const PLACE_IN_SLOTS = 4;
const placeInSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challenges: {
      type: Type.ARRAY,
      description: "3 progressive challenges",
      items: {
        type: Type.OBJECT,
        properties: {
          ...BASE_FIELDS,
          ...sceneObjFields(PLACE_IN_SLOTS),
          containerName: { type: Type.STRING, description: "Name of the container object already on the grid (must be one of the sceneObj slots)" },
          targetName: { type: Type.STRING, description: "Name of the object the student puts INSIDE the container (must NOT be on the grid yet)" },
          targetImage: { type: Type.STRING, description: "Target object emoji" },
        },
        required: ["id", "instruction", "hint", ...sceneObjRequiredFields(PLACE_IN_SLOTS), "containerName", "targetName", "targetImage"],
      },
    },
  },
  required: ["challenges"],
};

/**
 * `place_between` — two references. Also deliberately without correctCellRow/Col: the
 * cell is derived from the two reference positions by `resolveBetweenCell`.
 */
const PLACE_BETWEEN_SLOTS = 4;
const placeBetweenSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challenges: {
      type: Type.ARRAY,
      description: "3 progressive challenges",
      items: {
        type: Type.OBJECT,
        properties: {
          ...BASE_FIELDS,
          ...sceneObjFields(PLACE_BETWEEN_SLOTS),
          referenceAName: { type: Type.STRING, description: "First reference object name (must be one of the sceneObj slots)" },
          referenceBName: { type: Type.STRING, description: "Second reference object name (must be one of the sceneObj slots)" },
          targetName: { type: Type.STRING, description: "Name of the object the student places between them (must NOT be on the grid yet)" },
          targetImage: { type: Type.STRING, description: "Target object emoji" },
        },
        required: ["id", "instruction", "hint", ...sceneObjRequiredFields(PLACE_BETWEEN_SLOTS), "referenceAName", "referenceBName", "targetName", "targetImage"],
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
  tierSection: string, sharedContext: string, positionWindow: RelativePosition[],
): Promise<SpatialSceneChallenge[]> {
  const modeLabel = mode === "identify"
    ? "identify — ask 'Where is X relative to Y?' with 4 position-word options"
    : "describe — show arrangement, ask student to pick the position word that describes it";

  const prompt = `
Create 3 spatial reasoning "${mode}" challenges for "${topic}" (${gradeLevel}).
Theme: ${theme}.

${sharedContext}
${tierSection}
CHALLENGE TYPE: ${modeLabel}
- Place 4 scene objects on a 3×3 grid. 2 are key objects (target + reference), 2 are backdrop objects that make the scene feel alive but aren't part of the question.
- ALL 4 scene object slots (sceneObj0..sceneObj3) MUST be filled — no empty slots.
- Each scene object must occupy a UNIQUE grid cell.
- Set targetName/targetImage/targetRow/targetCol for the object being asked about.
- The target object MUST also be one of the 4 sceneObj slots (same name, image, row, col).
- Set referenceObjectName to the reference object (must also be one of the 4 sceneObj slots).
- correctPosition MUST accurately match the grid positions.
- option0..option3 = correctPosition + 3 distractors (all valid position words).
- EXACTLY ONE option may be true of the arrangement. Every distractor must be FALSE for
  where you actually put the objects. Watch the overlapping pairs: "on" is also "above",
  "under" is also "below", and "beside" and "next_to" mean the same thing — never put two
  words that are both true in the same option list.
- Vary which option slot holds the answer; do NOT always make option0 correct.
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
  const validChallenges = (data.challenges as FlatObj[]).map((flat) => {
    const sceneObjects = collectSceneObjects(flat, IDENTIFY_DESCRIBE_SLOTS, gridSize);
    const targetObject = buildTargetObject(flat, gridSize) ?? sceneObjects[0] ?? { name: "cat", image: "\u{1F431}", position: { row: 0, col: 0 } };

    // SS-1: Reject challenges where Gemini dropped all scene objects
    if (sceneObjects.length === 0) {
      console.warn(`[SpatialScene] ${mode}: Rejected challenge with 0 scene objects`);
      return null;
    }

    // SS-3: Ensure targetObject is in sceneObjects (derive by position match)
    const targetInScene = sceneObjects.some(
      (o) => o.position.row === targetObject.position.row && o.position.col === targetObject.position.col,
    );
    if (!targetInScene) {
      sceneObjects.push(targetObject);
    }

    // SS-3: Ensure referenceObject is in sceneObjects
    const refName = typeof flat.referenceObjectName === "string" ? flat.referenceObjectName : undefined;
    if (refName && !sceneObjects.some((o) => o.name === refName)) {
      // Find an unused cell for the reference object
      const usedCells = new Set(sceneObjects.map((o) => `${o.position.row},${o.position.col}`));
      let refPos = { row: 1, col: 1 };
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (!usedCells.has(`${r},${c}`)) { refPos = { row: r, col: c }; break; }
        }
        if (!usedCells.has(`${refPos.row},${refPos.col}`)) break;
      }
      sceneObjects.push({ name: refName, image: "📦", position: refPos });
    }

    let pos = typeof flat.correctPosition === "string" && VALID_POSITIONS.includes(flat.correctPosition)
      ? flat.correctPosition : "above";

    let options: string[] = [];
    for (let i = 0; i < 4; i++) {
      const v = flat[`option${i}`];
      if (typeof v === "string" && v.trim().length > 0) options.push(v.trim().toLowerCase());
    }

    const challengeId = String(flat.id ?? `c${Math.random().toString(36).slice(2, 6)}`);

    // R12 — EXACTLY ONE DEFENSIBLE OPTION. These two modes judge a single position
    // word, and `on` ⊂ `above` / `under` ⊂ `below` / `beside` ≡ `next_to`, so an
    // options list can otherwise carry two correct answers and mark a right answer
    // wrong (contract C3, measured 4/18 pre-fix). The grid is ground truth: the code
    // decides which words are defensible, the LLM only drew the scene.
    const refPos = refName ? sceneObjects.find((o) => o.name === refName)?.position : undefined;
    if (refPos) {
      const t = targetObject.position;
      const ex = enforceSingleDefensibleOption(pos, options, t, refPos, positionWindow);
      if (ex.unjudgeable) {
        console.warn(
          `[SpatialScene] ${mode}: Rejected challenge ${challengeId} — no position word in `
          + `[${positionWindow.join(", ")}] describes target(${t.row},${t.col}) vs `
          + `${refName}(${refPos.row},${refPos.col}); nothing to defend.`,
        );
        return null;
      }
      if (ex.removed.length) {
        console.warn(
          `[SpatialScene] ${mode} ${challengeId}: dropped also-correct option(s) `
          + `[${ex.removed.join(", ")}] against key "${ex.correctPosition}" (C3/R12).`,
        );
      }
      if (ex.repairedKey) {
        console.warn(
          `[SpatialScene] ${mode} ${challengeId}: correctPosition "${pos}" is false for the `
          + `arrangement it drew — repaired to "${ex.correctPosition}".`,
        );
      }
      if (ex.outOfWindow.length) {
        console.warn(
          `[SpatialScene] ${mode} ${challengeId}: dropped out-of-window option(s) `
          + `[${ex.outOfWindow.join(", ")}] (R1).`,
        );
      }
      pos = ex.correctPosition;
      options = ex.options;
    } else {
      // R6 guarantees a resolvable reference; if one is somehow missing the geometry
      // cannot be judged, so degrade to the pre-R12 behavior rather than crash.
      console.warn(`[SpatialScene] ${mode} ${challengeId}: reference "${refName}" unresolved — R12 guard skipped.`);
      if (options.length < 2) options.push(pos, "above", "below", "beside");
      if (!options.includes(pos)) options[0] = pos;
    }

    // The answer must not always be the first button: pre-fix, correctPosition was
    // option0 in 18 of 18 probed challenges and the component renders array order,
    // so "tap the first one" solved every item without reading the grid.
    options = placeAnswerSlot(options, pos, `${mode}:${challengeId}:${pos}`);

    return {
      id: challengeId,
      type: mode,
      instruction: String(flat.instruction ?? "Where is the object?"),
      hint: String(flat.hint ?? "Look at the grid!"),
      sceneObjects,
      targetObject,
      correctPosition: pos as SpatialSceneChallenge["correctPosition"],
      referenceObjectName: refName,
      options,
    };
  });

  return validChallenges.filter((c): c is NonNullable<typeof c> => c !== null);
}

async function generatePlace(
  topic: string, gradeLevel: string, theme: string, tierSection: string, sharedContext: string,
): Promise<SpatialSceneChallenge[]> {
  const prompt = `
Create 3 spatial reasoning "place" challenges for "${topic}" (${gradeLevel}).
Theme: ${theme}.

${sharedContext}
${tierSection}
CHALLENGE TYPE: place — student taps a grid cell to place an object.
- Place 4 scene objects on a 3×3 grid as the existing scene (reference + backdrop objects).
- ALL 4 scene object slots (sceneObj0..sceneObj3) MUST be filled — no empty slots.
- Each scene object must occupy a UNIQUE grid cell.
- Set targetName/targetImage for the object the student will place (do NOT set its row/col).
- Set correctCellRow/correctCellCol for where the target should go (must be an EMPTY cell).
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
  const validChallenges = (data.challenges as FlatObj[]).map((flat) => {
    const sceneObjects = collectSceneObjects(flat, PLACE_SLOTS, gridSize);
    const targetObject: SceneObject = {
      name: typeof flat.targetName === "string" ? flat.targetName : "ball",
      image: typeof flat.targetImage === "string" ? flat.targetImage : "\u{26BD}",
      position: { row: 0, col: 0 }, // placeholder — student places it
    };
    const correctCell = {
      row: typeof flat.correctCellRow === "number" ? clampGrid(flat.correctCellRow, gridSize) : 0,
      col: typeof flat.correctCellCol === "number" ? clampGrid(flat.correctCellCol, gridSize) : 0,
    };

    // SS-1: Reject challenges where Gemini dropped all scene objects
    if (sceneObjects.length === 0) {
      console.warn("[SpatialScene] place: Rejected challenge with 0 scene objects");
      return null;
    }

    return {
      id: String(flat.id ?? `c${Math.random().toString(36).slice(2, 6)}`),
      type: "place" as const,
      instruction: String(flat.instruction ?? "Place the object!"),
      hint: String(flat.hint ?? "Think about where things go!"),
      sceneObjects,
      targetObject,
      correctPosition: "above" as const, // not used for place, but satisfies type
      correctCell,
    };
  });

  return validChallenges.filter((c): c is NonNullable<typeof c> => c !== null);
}

/**
 * `place_in` — containment enactment ("Put the pencil in the box").
 *
 * FORKED FROM `place`, NOT AN EDIT OF IT (contract R11 + the fork ladder). `place`
 * requires `correctCell` to be an EMPTY cell and the component only offers a tap
 * affordance on empty cells; containment inverts both — the answer is the cell the
 * container OCCUPIES. Serving it inside `place` would have ablated the math K.G.1
 * consumer's guarantee, so it became its own eval mode instead.
 *
 * The LLM draws the scene and names the container; CODE derives the answer cell from
 * the container's position, so a challenge can never ship a cell that contradicts the
 * container it drew.
 */
async function generatePlaceIn(
  topic: string, gradeLevel: string, theme: string, tierSection: string, sharedContext: string,
): Promise<SpatialSceneChallenge[]> {
  // Entropy belongs in the PROMPT, and a shuffled MENU is not enough: offered the
  // container list in a random order, flash-lite still returned box / house / car on
  // 5 of 5 probed runs — it anchors on the shared object vocabulary, not on the order.
  // So the code ASSIGNS the container per challenge and the LLM only writes the scene
  // around it ([[llm-window-code-builds-structure]]).
  const shuffled = [...CONTAINER_OBJECTS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const picks = shuffled.slice(0, 3);
  const containerList = shuffled.map(([n, e]) => `${n}=${e}`).join(", ");
  const assignment = picks
    .map(([n, e], i) => `  - Challenge ${i + 1}: the container is the ${n} (${e}).`)
    .join("\n");

  const prompt = `
Create 3 spatial reasoning "place_in" challenges for "${topic}" (${gradeLevel}).
Theme: ${theme}.

${sharedContext}
${tierSection}
CHALLENGE TYPE: place_in — CONTAINMENT. The student taps the container's own square to put an object INSIDE it.
- ${SUPPORTED_POSITION_SEMANTICS.in}
- Place 4 scene objects on a 3×3 grid. ONE of them is the CONTAINER.
- ALL 4 scene object slots (sceneObj0..sceneObj3) MUST be filled — no empty slots.
- Each scene object must occupy a UNIQUE grid cell.
- The container MUST be something that can actually hold an object. Containers you may use: ${containerList}.
  NEVER use a ball, star, flower, tree, chair or an animal as the container — nothing goes INSIDE those.
- USE EXACTLY THESE CONTAINERS, one per challenge — do not substitute your own:
${assignment}
  Put that container on the grid as one of the sceneObj slots (with the emoji shown above)
  and set containerName to its name.
- Set targetName/targetImage to a SMALL object that fits inside it, and use a DIFFERENT
  small object in each challenge (crayon, block, apple, key, coin, sock, spoon, ball, star).
  The target must NOT already be on the grid — the student is the one who puts it there.
- The instruction must use the word "in": "Put the crayon IN the box". Write it in plain
  words with no emoji.
- Do NOT say where the container is on the grid, and do NOT tell the student which square
  to tap — working out that "in" means the container's own square IS the skill.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: placeInSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges) return [];

  const gridSize = 3;
  const validChallenges = (data.challenges as FlatObj[]).map((flat) => {
    const challengeId = String(flat.id ?? `c${Math.random().toString(36).slice(2, 6)}`);
    const sceneObjects = collectSceneObjects(flat, PLACE_IN_SLOTS, gridSize);

    // SS-1: no empty grids.
    if (sceneObjects.length === 0) {
      console.warn("[SpatialScene] place_in: Rejected challenge with 0 scene objects");
      return null;
    }

    // The container is the correctness anchor — no container, no answer.
    const container = findObject(sceneObjects, flat.containerName);
    if (!container) {
      console.warn(
        `[SpatialScene] place_in ${challengeId}: container "${String(flat.containerName)}" is not on `
        + `the grid — rejected (the answer cell is the container's own cell).`,
      );
      return null;
    }
    if (NON_CONTAINERS.has(container.name.trim().toLowerCase())) {
      console.warn(
        `[SpatialScene] place_in ${challengeId}: "${container.name}" cannot hold anything — `
        + `rejected rather than teach "in" with a container that isn't one.`,
      );
      return null;
    }

    const targetName = typeof flat.targetName === "string" ? flat.targetName.trim() : "";
    if (!targetName || targetName.toLowerCase() === container.name.trim().toLowerCase()) {
      console.warn(`[SpatialScene] place_in ${challengeId}: target is missing or IS the container — rejected.`);
      return null;
    }
    // The student places the target, so it must not already be drawn on the grid.
    const preplaced = findObject(sceneObjects, targetName);
    const scene = preplaced ? sceneObjects.filter((o) => o !== preplaced) : sceneObjects;
    if (preplaced) {
      console.warn(
        `[SpatialScene] place_in ${challengeId}: target "${targetName}" was already on the grid — `
        + `removed so the student is the one who places it.`,
      );
    }

    return {
      id: challengeId,
      type: "place_in" as const,
      instruction: String(flat.instruction ?? `Put the ${targetName} in the ${container.name}!`),
      hint: String(flat.hint ?? "Something can go INSIDE it — tap that square."),
      sceneObjects: scene,
      targetObject: {
        name: targetName,
        image: typeof flat.targetImage === "string" ? flat.targetImage : "\u{26BD}",
        position: { row: 0, col: 0 }, // placeholder — the student places it
      },
      correctPosition: "in" as const,
      referenceObjectName: container.name,
      // CODE OWNS THE ANSWER: the container's own cell, never an LLM-emitted cell.
      correctCell: { row: container.position.row, col: container.position.col },
    };
  });

  return validChallenges.filter((c): c is NonNullable<typeof c> => c !== null);
}

/**
 * `place_between` — two-reference enactment ("Put the ball between the box and the tree").
 *
 * The half of contract C2 that a single-reference checker could not own: `between`
 * needs TWO reference objects. The LLM draws the scene and names the pair; CODE derives
 * the answer with `resolveBetweenCell`, so a pair that admits no unambiguous answer
 * (not collinear, adjacent, or the gap already occupied) is REJECTED rather than
 * shipped with a guess. Unlike `place_in` this honors R11 — the answer cell is empty.
 */
async function generatePlaceBetween(
  topic: string, gradeLevel: string, theme: string, tierSection: string, sharedContext: string,
): Promise<SpatialSceneChallenge[]> {
  const prompt = `
Create 3 spatial reasoning "place_between" challenges for "${topic}" (${gradeLevel}).
Theme: ${theme}.

${sharedContext}
${tierSection}
CHALLENGE TYPE: place_between — TWO REFERENCE OBJECTS. The student taps the empty square that has one named object on each side.
- ${SUPPORTED_POSITION_SEMANTICS.between}
- Place 4 scene objects on a 3×3 grid. TWO of them are the reference objects.
- ALL 4 scene object slots (sceneObj0..sceneObj3) MUST be filled — no empty slots.
- Each scene object must occupy a UNIQUE grid cell.
- CRITICAL LAYOUT RULE: the two reference objects must share a row OR a column and be
  EXACTLY TWO steps apart, so there is exactly ONE square between them.
  Valid: reference A at row 1 col 0 and reference B at row 1 col 2 -> the square between is row 1 col 1.
  Valid: reference A at row 0 col 2 and reference B at row 2 col 2 -> the square between is row 1 col 2.
  Invalid: references that touch, sit diagonally, or are in different rows AND different columns.
- THE SQUARE BETWEEN THEM MUST BE EMPTY — do not put a third object there.
- Set referenceAName / referenceBName to those two objects' names (exactly as in their sceneObj slots).
- Set targetName/targetImage to the object the student places. It must NOT already be on the grid.
- The instruction must use the word "between" and name BOTH references: "Put the ball BETWEEN the box and the tree".
- Do NOT say which square that is — the student has to work it out.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: placeBetweenSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges) return [];

  const gridSize = 3;
  const validChallenges = (data.challenges as FlatObj[]).map((flat) => {
    const challengeId = String(flat.id ?? `c${Math.random().toString(36).slice(2, 6)}`);
    const sceneObjects = collectSceneObjects(flat, PLACE_BETWEEN_SLOTS, gridSize);

    // SS-1: no empty grids.
    if (sceneObjects.length === 0) {
      console.warn("[SpatialScene] place_between: Rejected challenge with 0 scene objects");
      return null;
    }

    const refA = findObject(sceneObjects, flat.referenceAName);
    const refB = findObject(sceneObjects, flat.referenceBName);
    if (!refA || !refB || refA === refB) {
      console.warn(
        `[SpatialScene] place_between ${challengeId}: needs TWO distinct references on the grid, got `
        + `"${String(flat.referenceAName)}" / "${String(flat.referenceBName)}" — rejected.`,
      );
      return null;
    }

    // CODE OWNS THE ANSWER. A pair with no single cell between them has no defensible
    // answer at all, so it is dropped rather than shipped with a guessed cell.
    const correctCell = resolveBetweenCell(refA.position, refB.position);
    if (!correctCell) {
      console.warn(
        `[SpatialScene] place_between ${challengeId}: ${refA.name}(${refA.position.row},${refA.position.col}) `
        + `and ${refB.name}(${refB.position.row},${refB.position.col}) have no single cell between them — rejected.`,
      );
      return null;
    }
    // R11 holds for THIS mode: the tap target must be an empty cell.
    const blocker = sceneObjects.find(
      (o) => o.position.row === correctCell.row && o.position.col === correctCell.col,
    );
    if (blocker) {
      console.warn(
        `[SpatialScene] place_between ${challengeId}: the cell between ${refA.name} and ${refB.name} is `
        + `occupied by "${blocker.name}" — rejected (nothing to place there).`,
      );
      return null;
    }

    const targetName = typeof flat.targetName === "string" ? flat.targetName.trim() : "";
    if (!targetName || findObject(sceneObjects, targetName)) {
      console.warn(
        `[SpatialScene] place_between ${challengeId}: target "${targetName}" is missing or already on the `
        + `grid — rejected (the student must be the one who places it).`,
      );
      return null;
    }

    return {
      id: challengeId,
      type: "place_between" as const,
      instruction: String(
        flat.instruction ?? `Put the ${targetName} between the ${refA.name} and the ${refB.name}!`,
      ),
      hint: String(flat.hint ?? "Look for the empty square with one object on each side."),
      sceneObjects,
      targetObject: {
        name: targetName,
        image: typeof flat.targetImage === "string" ? flat.targetImage : "\u{26BD}",
        position: { row: 0, col: 0 }, // placeholder — the student places it
      },
      correctPosition: "between" as const,
      referenceObjectName: refA.name,
      referenceObjectName2: refB.name,
      correctCell,
    };
  });

  return validChallenges.filter((c): c is NonNullable<typeof c> => c !== null);
}

async function generateFollowDirections(
  topic: string, gradeLevel: string, theme: string, tierSection: string, sharedContext: string,
): Promise<SpatialSceneChallenge[]> {
  const prompt = `
Create 2 spatial reasoning "follow_directions" challenges for "${topic}" (${gradeLevel}).
Theme: ${theme}.

${sharedContext}
${tierSection}
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
      { name: "cat", image: "\u{1F431}", position: { row: 0, col: 1 } },
      { name: "box", image: "\u{1F4E6}", position: { row: 2, col: 1 } },
      { name: "tree", image: "\u{1F333}", position: { row: 1, col: 0 } },
      { name: "flower", image: "\u{1F338}", position: { row: 2, col: 2 } },
    ],
    targetObject: { name: "cat", image: "\u{1F431}", position: { row: 0, col: 1 } },
    correctPosition: "above",
    referenceObjectName: "box",
    // R12: exactly one option is true of the layout above, and it is not slot 0.
    options: ["below", "above", "beside", "next_to"],
  },
  place: {
    id: "c1", type: "place",
    instruction: "Put the ball above the house!",
    hint: "Above means higher up on the grid.",
    sceneObjects: [
      { name: "house", image: "\u{1F3E0}", position: { row: 2, col: 1 } },
      { name: "tree", image: "\u{1F333}", position: { row: 1, col: 0 } },
      { name: "car", image: "\u{1F697}", position: { row: 2, col: 2 } },
      { name: "flower", image: "\u{1F338}", position: { row: 0, col: 0 } },
    ],
    targetObject: { name: "ball", image: "\u{26BD}", position: { row: 0, col: 1 } },
    correctPosition: "above",
    correctCell: { row: 1, col: 1 },
  },
  describe: {
    id: "c1", type: "describe",
    instruction: "Look at the star and the tree. Where is the star?",
    hint: "Is the star higher, lower, or next to the tree?",
    sceneObjects: [
      { name: "star", image: "\u{2B50}", position: { row: 0, col: 1 } },
      { name: "tree", image: "\u{1F333}", position: { row: 1, col: 1 } },
      { name: "dog", image: "\u{1F415}", position: { row: 2, col: 0 } },
      { name: "house", image: "\u{1F3E0}", position: { row: 2, col: 2 } },
    ],
    targetObject: { name: "star", image: "\u{2B50}", position: { row: 0, col: 1 } },
    correctPosition: "above",
    referenceObjectName: "tree",
    // R12: star(0,1) is adjacent-above tree(1,1) — `on` would ALSO be true, so it is
    // deliberately absent. Answer is not slot 0.
    options: ["beside", "next_to", "above", "below"],
  },
  place_in: {
    id: "c1", type: "place_in",
    instruction: "Put the ball in the box!",
    hint: "Which one of these could hold a ball inside it?",
    sceneObjects: [
      { name: "box", image: "\u{1F4E6}", position: { row: 1, col: 1 } },
      { name: "tree", image: "\u{1F333}", position: { row: 0, col: 0 } },
      { name: "cat", image: "\u{1F431}", position: { row: 2, col: 2 } },
      { name: "flower", image: "\u{1F338}", position: { row: 0, col: 2 } },
    ],
    targetObject: { name: "ball", image: "\u{26BD}", position: { row: 0, col: 0 } },
    correctPosition: "in",
    referenceObjectName: "box",
    // Containment: the answer is the cell the box OCCUPIES (contract R11 inverted).
    correctCell: { row: 1, col: 1 },
  },
  place_between: {
    id: "c1", type: "place_between",
    instruction: "Put the ball between the box and the tree!",
    hint: "Find the empty square with one thing on each side.",
    sceneObjects: [
      { name: "box", image: "\u{1F4E6}", position: { row: 1, col: 0 } },
      { name: "tree", image: "\u{1F333}", position: { row: 1, col: 2 } },
      { name: "house", image: "\u{1F3E0}", position: { row: 0, col: 0 } },
      { name: "cat", image: "\u{1F431}", position: { row: 2, col: 2 } },
    ],
    targetObject: { name: "ball", image: "\u{26BD}", position: { row: 0, col: 0 } },
    correctPosition: "between",
    referenceObjectName: "box",
    referenceObjectName2: "tree",
    correctCell: { row: 1, col: 1 },
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

type SpatialSceneConfig = Partial<{
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill/relation,
     * difficulty = how much reference-frame scaffolding within it. NEVER changes the
     * scene layout or which relation is asked.
     */
    difficulty?: string;
  }>;

export const generateSpatialScene = async (
  ctx: GenerationContext,
): Promise<SpatialSceneData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as SpatialSceneConfig;
  // -- Resolve eval mode --
  // The pin may be a BLEND ("place_in|place|place_between") — resolveLessonEvalModes
  // emits that syntax and the published LA004-01-F objective measurably produces it.
  // `resolveEvalModeConstraint` matches ONE key exactly, so a blend pin used to fall
  // through to "generate every mode"; with six modes that is a 17-challenge session
  // instead of the three the curator chose. Parsed here rather than in the shared
  // helper, which ~60 other generators depend on.
  const pin = config?.targetEvalMode?.trim();
  const pinKeys = pin && pin !== "mixed" ? pin.split("|").map((k) => k.trim()).filter(Boolean) : [];
  const pinConstraints = pinKeys
    .map((k) => resolveEvalModeConstraint("spatial-scene", k, CHALLENGE_TYPE_DOCS))
    .filter((c): c is NonNullable<typeof c> => c !== null);
  const evalConstraint = pinConstraints.length === 1 ? pinConstraints[0] : null;
  logEvalModeResolution("SpatialScene", pin, evalConstraint);
  const pinnedTypes = pinConstraints.length
    ? Array.from(new Set(pinConstraints.flatMap((c) => c.allowedTypes)))
    : null;
  if (pinConstraints.length > 1) {
    console.log(
      `[SpatialScene] evalMode blend: [${pinConstraints.map((c) => c.definition.evalMode).join(" + ")}] `
      + `→ types [${pinnedTypes!.join(", ")}]`,
    );
  }

  // -- Determine gradeBand (needed BEFORE dispatch: it seeds the position window) --
  const gl = gradeLevel.toLowerCase();
  const gradeBand: "K" | "1" = gl.includes("kinder") || gl.includes("k") ? "K" : "1";

  // -- Resolve the position-word WINDOW from what the lesson actually asked for --
  // Band default WIDENED by the resolved request; never narrowed. With no request
  // (or a resolver outage) this is exactly the shipped band vocabulary, so the math
  // K.G.1 consumer is unchanged (contract R1). See resolvePrepositionScope.ts.
  const prepositionScope = await resolvePrepositionScope(ctx.scope, gradeLevel);
  const positionWindow = composePositionWindow(gradeBand, prepositionScope);
  if (prepositionScope?.requested.length) {
    console.log(
      `[SpatialScene] Lesson asked for [${prepositionScope.requested.join(", ")}] → `
      + `window ${gradeBand}=[${positionWindow.join(", ")}]`,
    );
  }
  if (prepositionScope?.unsupported.length) {
    // Honest saturation, never silent truncation: say what we could not serve.
    // `in` and `between` are no longer in this list — they route to their own modes.
    console.warn(
      `[SpatialScene] Lesson asked for position words this 3x3 grid cannot express: `
      + `[${prepositionScope.unsupported.join(", ")}] — served with the supported window instead. `
      + `See qa/la-k2-grammar/BACKLOG.md.`,
    );
  }

  // `in` and `between` are challenge TYPES here, not window words: containment inverts
  // R11 and `between` needs a second reference, so each forked into its own eval mode.
  // In a BLENDED session (nothing pinned) a lesson that named them gets that mode; a
  // lesson that did not — every math K.G.1 lesson — keeps exactly the four it had.
  const requestedModes = resolveRequestedModes(prepositionScope);
  const allowedTypes = pinnedTypes ?? [...RELATIVE_CHALLENGE_TYPES, ...requestedModes];
  if (!pinnedTypes && requestedModes.length) {
    console.log(`[SpatialScene] Lesson request adds mode(s) [${requestedModes.join(", ")}] to the blend`);
  }

  // -- Resolve support tier (drives application; pinnedType only shapes prompt tone) --
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType =
    evalConstraint?.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as ChallengeType)
      : undefined;
  const tierScaffold =
    pinnedType && supportTier ? resolveSupportStructure(pinnedType, supportTier) : null;
  // Authoritative scope (topic + objective + intent) folded into the threaded
  // tierSection so it reaches all sub-prompts with no signature change. The LLM
  // authors the scene objects, so this binds the intent's theme/focus to what's
  // shown. scope-context-contract wire; correctness is code-owned downstream.
  const scopeSection = buildScopePromptSection(ctx.scope);
  const tierSection = (tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT scene/relation change)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join("\n")}\n`
    : "") + scopeSection;

  const theme = randomTheme();
  const sharedContext = buildSharedContext(positionWindow);

  // -- Dispatch per-mode sub-generators in parallel --
  const generators: Promise<SpatialSceneChallenge[]>[] = [];

  if (allowedTypes.includes("identify")) {
    generators.push(
      generateIdentifyDescribe(topic, gradeLevel, theme, "identify", tierSection, sharedContext, positionWindow)
        .catch((e) => { console.error("[SpatialScene] identify failed:", e); return []; }),
    );
  }
  if (allowedTypes.includes("describe")) {
    generators.push(
      generateIdentifyDescribe(topic, gradeLevel, theme, "describe", tierSection, sharedContext, positionWindow)
        .catch((e) => { console.error("[SpatialScene] describe failed:", e); return []; }),
    );
  }
  if (allowedTypes.includes("place")) {
    generators.push(
      generatePlace(topic, gradeLevel, theme, tierSection, sharedContext)
        .catch((e) => { console.error("[SpatialScene] place failed:", e); return []; }),
    );
  }
  if (allowedTypes.includes("follow_directions")) {
    generators.push(
      generateFollowDirections(topic, gradeLevel, theme, tierSection, sharedContext)
        .catch((e) => { console.error("[SpatialScene] follow_directions failed:", e); return []; }),
    );
  }
  if (allowedTypes.includes("place_in")) {
    generators.push(
      generatePlaceIn(topic, gradeLevel, theme, tierSection, sharedContext)
        .catch((e) => { console.error("[SpatialScene] place_in failed:", e); return []; }),
    );
  }
  if (allowedTypes.includes("place_between")) {
    generators.push(
      generatePlaceBetween(topic, gradeLevel, theme, tierSection, sharedContext)
        .catch((e) => { console.error("[SpatialScene] place_between failed:", e); return []; }),
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

  // -- Apply support tier per-challenge (scaffolding withdrawal only) --
  // Gated ONLY on supportTier being present, resolved from each challenge's OWN
  // mode (ch.type) so blended/auto sessions get it too. Code owns the scaffold
  // STRUCTURE; the LLM only chose the scene/numbers. The checker reads
  // correctPosition/correctCell only — never these show* flags — so withdrawing
  // a scaffold can never leak or invalidate the answer.
  if (supportTier) {
    challenges = challenges.map((ch) => {
      const sc = resolveSupportStructure(ch.type as ChallengeType, supportTier);
      return {
        ...ch,
        supportTier,
        showGrid: sc.showGrid,
        showObjectLabels: sc.showObjectLabels,
        showPositionHints: sc.showPositionHints,
      };
    });
    console.log(
      `[SpatialScene] Support tier "${supportTier}" applied per-challenge `
      + `(${pinnedType ? `single-mode ${pinnedType}` : "blended"}) → `
      + `grid=${supportTier !== "hard"}, labels=${supportTier !== "hard"}, positionHints=${supportTier === "easy"}`,
    );
  }

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
