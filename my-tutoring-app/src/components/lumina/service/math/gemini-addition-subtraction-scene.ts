import { Type, Schema } from "@google/genai";
import { AdditionSubtractionSceneData, AddSubChallenge } from "../../primitives/visual-primitives/math/AdditionSubtractionScene";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Valid object types — must match OBJECT_EMOJI in AdditionSubtractionScene.tsx
// ---------------------------------------------------------------------------

const VALID_OBJECT_TYPES = [
  'ducks', 'frogs', 'apples', 'birds', 'fish',
  'butterflies', 'dogs', 'cats', 'stars', 'flowers',
  'cookies', 'cupcakes', 'rockets', 'bunnies',
];

/** Scene-appropriate defaults when Gemini produces an invalid objectType */
const SCENE_DEFAULT_OBJECTS: Record<string, string> = {
  pond: 'ducks',
  farm: 'dogs',
  playground: 'cats',
  space: 'rockets',
  kitchen: 'cookies',
  garden: 'flowers',
};

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'act-out': {
    promptDoc:
      `"act-out": Student drags objects into the scene to act out the story. `
      + `Best for beginners — concrete manipulative interaction. `
      + `Story should clearly describe objects joining or leaving. `
      + `Use warm language ("Drag the ducks into the pond!").`,
    schemaDescription: "'act-out' (drag objects to act out story)",
  },
  'build-equation': {
    promptDoc:
      `"build-equation": Student constructs the matching equation from number/symbol tiles after seeing the story. `
      + `Requires understanding the relationship between story action and mathematical notation. `
      + `Story shows the action, student builds e.g. "3 + 2 = 5" from tiles.`,
    schemaDescription: "'build-equation' (construct equation from tiles)",
  },
  'solve-story': {
    promptDoc:
      `"solve-story": Student reads/hears the story and provides the missing number. `
      + `The unknownPosition field controls which part is hidden (result, change, or start). `
      + `For K: mostly unknownPosition='result'. For Grade 1: vary all three positions.`,
    schemaDescription: "'solve-story' (read story, find missing number)",
  },
  'create-story': {
    promptDoc:
      `"create-story": Given an equation, student matches or creates a story that fits. `
      + `Advanced challenge — requires reverse reasoning from symbols to context. `
      + `Provide the equation; the student must produce a matching story scenario.`,
    schemaDescription: "'create-story' (write story for given equation)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode difficulty (config.difficulty) — TWO axes off one enum.
//
// targetEvalMode = WHICH skill; difficulty = how hard WITHIN it. config.difficulty
// drives two dials at once:
//
//   AXIS 1 — scaffolding withdrawal ("how much help?", resolveSupportStructure):
//     act-out        → scene count-aids (grouped reveal + ordinal tap-badges)
//     build-equation → equation-tray distractors (exact → +distractors → full)
//     solve-story    → carries no scaffold of its own (its lever is structural below)
//     create-story   → open-ended; no support surface, no tier
//
//   AXIS 2 — problem STRUCTURE ("how hard a problem, structurally?",
//   resolveProblemShape): a genuinely harder problem SHAPE per tier, magnitude
//   held inside maxNumber, never crossing into another challenge type. Because
//   every problem here is a natural-language STORY, the structural fields are
//   coupled to the prose — so the lever is enforced by CONSTRAINING THE SCHEMA
//   ENUM per tier (the LLM then authors a fully self-consistent story+counts),
//   not by rewriting the narrative in post-process (brittle, desyncs the answer).
//     build-equation → storyType: join/separate → part-whole → compare
//                      (the story→equation mapping gets structurally harder)
//     solve-story    → unknownPosition: result(forward) → change → start(inverse)
//                      (inverse-reasoning depth — the answer IS the hidden slot)
//     act-out        → none: its interaction is "count the objects on screen",
//                      which has no clean in-mode structural lever (compare can't
//                      render — the scene shows one group, not a difference). It
//                      legitimately supports only AXIS 1.
//     create-story   → none.
// ---------------------------------------------------------------------------

type ChallengeType = 'act-out' | 'build-equation' | 'solve-story' | 'create-story';
type ChallengeStoryType = 'join' | 'separate' | 'compare' | 'part-whole';
type UnknownPosition = 'result' | 'change' | 'start';

/**
 * Guardrail shared by BOTH axes of config.difficulty (replaces the old
 * "numbers never change" line, which became a half-truth once AXIS 2 started
 * selecting harder story SHAPES). Structure changes (which story situation, which
 * quantity is unknown); magnitude does NOT.
 */
const TIER_GUARDRAIL =
  'This tier sets how much on-screen scaffolding the student gets AND the problem '
  + 'STRUCTURE (which story situation — join/separate vs part-whole vs compare — and '
  + 'which quantity is unknown). It must NEVER change the size of any number: keep every '
  + 'startCount / changeCount / resultCount within maxNumber exactly as you otherwise '
  + 'would. Harder means a harder SHAPE, never bigger numbers.';

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

interface SupportScaffold {
  /** act-out: tapping an object stamps its running ordinal count. */
  showCountBadges: boolean;
  /** act-out: change group animates in separately so the join is visible. */
  groupedReveal: boolean;
  /** build-equation: how many candidate number tiles the tray offers. */
  tilePalette: 'exact' | 'plus-distractors' | 'full';
  promptLines: string[];
}

/**
 * The easy→hard support gradient, per pinned mode. Returns null for create-story
 * (open-ended — no scaffold to withdraw). NEVER references number size.
 */
function resolveSupportStructure(pinnedType: ChallengeType, tier: SupportTier): SupportScaffold | null {
  if (pinnedType === 'create-story') return null;

  const lead = `SUPPORT TIER = "${tier}". ${TIER_GUARDRAIL}`;

  if (pinnedType === 'act-out') {
    const showCountBadges = tier !== 'hard';
    const groupedReveal = tier === 'easy';
    const lines = [lead];
    if (tier === 'easy') {
      lines.push('Scene aids ON (applied automatically): objects arrive in two groups so the join/separation is visible, and tapping numbers each object as it is counted. Write clear join/separate stories.');
    } else if (tier === 'medium') {
      lines.push('Scene aids PARTIAL (applied automatically): objects appear together, but tapping still numbers them as the student counts.');
    } else {
      lines.push('Scene aids WITHDRAWN (applied automatically): objects appear together with no counting numbers — the student must segment and count unaided.');
    }
    return { showCountBadges, groupedReveal, tilePalette: 'full', promptLines: lines };
  }

  if (pinnedType === 'build-equation') {
    const tilePalette: SupportScaffold['tilePalette'] =
      tier === 'easy' ? 'exact' : tier === 'medium' ? 'plus-distractors' : 'full';
    const lines = [lead];
    if (tier === 'easy') {
      lines.push('Equation tray restricted (applied automatically) to ONLY each story\'s three numbers plus operators — the student just arranges them. Keep every story a clear three-number relationship.');
    } else if (tier === 'medium') {
      lines.push('Equation tray adds a few distractor numbers (applied automatically) the student must reject.');
    } else {
      lines.push('Equation tray shows the full number range (applied automatically) — the student must pick the right numbers from many.');
    }
    return { showCountBadges: true, groupedReveal: true, tilePalette, promptLines: lines };
  }

  // solve-story has no scaffolding lever of its own — its difficulty is the
  // STRUCTURAL unknownPosition ladder (AXIS 2 / resolveProblemShape), enforced by
  // the schema enum so the LLM authors a story-consistent unknown. AXIS 1 only
  // carries the shared guardrail here.
  return { showCountBadges: true, groupedReveal: true, tilePalette: 'full', promptLines: [lead] };
}

/**
 * Build the restricted tile list for a build-equation challenge. Returns the
 * sorted number strings to offer (operators are appended by the component), or
 * undefined for the full palette. Deterministic — never changes the equation.
 */
function buildAllowedTiles(
  challenge: { startCount: number; changeCount: number; resultCount: number },
  palette: SupportScaffold['tilePalette'],
  maxNumber: number,
): string[] | undefined {
  if (palette === 'full') return undefined;
  const needed = Array.from(new Set([challenge.startCount, challenge.changeCount, challenge.resultCount]))
    .filter((n) => n >= 0 && n <= maxNumber);
  if (palette === 'exact') {
    return needed.sort((a, b) => a - b).map(String);
  }
  // plus-distractors: add up to 3 deterministic in-range numbers not already needed
  const set = new Set(needed);
  const distractors: number[] = [];
  for (let n = 0; n <= maxNumber && distractors.length < 3; n++) {
    if (!set.has(n)) distractors.push(n);
  }
  return Array.from(new Set([...needed, ...distractors])).sort((a, b) => a - b).map(String);
}

// ---------------------------------------------------------------------------
// AXIS 2 — structural problem difficulty (config.difficulty, second dial).
//
// A genuinely harder problem SHAPE per tier, magnitude held inside maxNumber and
// never crossing into another challenge type. The lever per pinned mode follows
// the CGI problem-type ladder (well-grounded in early-math research):
//   build-equation → storyType:        join/separate → part-whole → compare
//   solve-story    → unknownPosition:  result(forward) → change → start(inverse)
// act-out & create-story have no clean in-mode structural lever (AXIS-1 only).
//
// Because every problem here is a natural-language STORY, the structural fields
// are coupled to the prose. Rather than rewrite the narrative in post-process
// (brittle — it desyncs the story from the answer), we CONSTRAIN THE RESPONSE
// SCHEMA ENUM to the tier's target (see constrainStructuralEnums): the LLM then
// authors a fully self-consistent story + counts + fields for the forced shape.
// Constraints flow through the schema, not prompt prose. The component recomputes
// the answer from the (LLM-authored, now-constrained) counts/unknownPosition, so
// nothing is leaked and nothing can desync.
//
// In-mode FLOOR: easy keeps the simplest in-scope shape (result / join·separate)
// and never drops to a different challenge type. MAGNITUDE CAP: every count stays
// ≤ maxNumber (owned by the scope, untouched here).
// ---------------------------------------------------------------------------

interface ProblemShape {
  /** build-equation: storyType enum the schema is constrained to this tier. */
  allowedStoryTypes?: ChallengeStoryType[];
  /** solve-story: unknownPosition enum the schema is constrained to this tier. */
  allowedUnknownPositions?: UnknownPosition[];
  /** Prompt lines describing the structural intent (the schema enforces it). */
  promptLines: string[];
}

/**
 * Resolve the in-mode structural lever for a tier. Returns null for modes with no
 * clean structural lever (act-out, create-story) — those ride AXIS 1 only.
 */
function resolveProblemShape(pinnedType: ChallengeType, tier: SupportTier): ProblemShape | null {
  if (pinnedType === 'build-equation') {
    const allowedStoryTypes: ChallengeStoryType[] =
      tier === 'easy' ? ['join', 'separate']
      : tier === 'medium' ? ['part-whole']
      : ['compare'];
    const line =
      tier === 'easy'
        ? 'PROBLEM STRUCTURE: write JOIN or SEPARATE stories (a direct add-to / take-away action). The equation maps straight from the visible action — the easiest story→equation translation.'
        : tier === 'medium'
          ? 'PROBLEM STRUCTURE: write PART-WHOLE stories where BOTH parts are given and the student finds the WHOLE (e.g. "3 cats inside and 2 outside — how many in all/altogether?"). startCount and changeCount are the two parts; resultCount is the whole they combine to. Do NOT write MISSING-ADDEND stories (total given, one part given, "how many are LEFT / the REST / how many MORE came") — those put the whole in the wrong slot and break the equation.'
          : 'PROBLEM STRUCTURE: write COMPARE stories ("how many MORE / FEWER?", e.g. "4 red flowers and 2 blue — how many more red?"). The student must translate comparison language into a subtraction equation — the hardest mapping.';
    // build-equation is intrinsically a FORWARD task: the student builds the full
    // "start OP change = result" sentence, so the computed RESULT is always the
    // answer. Pinning unknownPosition='result' on the schema enum forces the LLM to
    // author story counts where startCount/changeCount are the givens and resultCount
    // is what's computed — which disambiguates part-whole away from missing-addend
    // (the medium-tier desync) by construction, not by post-process re-assembly.
    return { allowedStoryTypes, allowedUnknownPositions: ['result'], promptLines: [line] };
  }

  if (pinnedType === 'solve-story') {
    const allowedUnknownPositions: UnknownPosition[] =
      tier === 'easy' ? ['result']
      : tier === 'medium' ? ['change']
      : ['start'];
    const line =
      tier === 'easy'
        ? 'PROBLEM STRUCTURE: hide the RESULT (forward operation) — phrase every story to ask "how many now / how many left?". The student computes the outcome directly.'
        : tier === 'medium'
          ? 'PROBLEM STRUCTURE: hide the CHANGE — phrase every story to ask "how many came / went away?". The student works backward from the start and the result (an inverse step).'
          : 'PROBLEM STRUCTURE: hide the START — phrase every story to ask "how many were there before?". Full inverse reasoning from the change and the result — the hardest unknown position.';
    return { allowedUnknownPositions, promptLines: [line] };
  }

  // act-out (counting interaction — no clean structural lever) / create-story
  return null;
}

/**
 * Combined within-mode tier prompt block: AXIS 1 scaffolding tone
 * (resolveSupportStructure) PLUS AXIS 2 problem STRUCTURE (resolveProblemShape).
 * One section so the LLM sees both dials of config.difficulty together — though
 * the structural lever is ultimately ENFORCED on the schema enum, not left to the
 * LLM. Returns '' when neither axis applies (create-story / no tier).
 */
function buildTierPromptSection(pinnedType: ChallengeType, tier: SupportTier): string {
  const lines = [
    ...(resolveSupportStructure(pinnedType, tier)?.promptLines ?? []),
    ...(resolveProblemShape(pinnedType, tier)?.promptLines ?? []),
  ];
  if (lines.length === 0) return '';
  return `\n## WITHIN-MODE DIFFICULTY "${tier}" (scaffolding + problem STRUCTURE — NOT bigger numbers)\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
}

/**
 * Constrain the response-schema enums to the tier's structural target, so the LLM
 * authors a story whose storyType / unknownPosition is guaranteed in-band — the
 * narrative, counts, and fields stay mutually consistent by construction (no
 * post-process narrative rewriting). Deep-clones the schema; never mutates input.
 * When unknownPosition is constrained it is also made REQUIRED so the LLM always
 * commits to the (story-consistent) hidden slot.
 */
function constrainStructuralEnums(schema: Schema, shape: ProblemShape): Schema {
  const cloned: Schema = JSON.parse(JSON.stringify(schema));
  const items = (cloned.properties?.challenges as Schema | undefined)?.items as Schema | undefined;
  const props = items?.properties as Record<string, Schema> | undefined;
  if (!items || !props) return cloned;

  if (shape.allowedStoryTypes && props.storyType) {
    props.storyType.enum = [...shape.allowedStoryTypes];
    props.storyType.description =
      `Story situation — CONSTRAINED to this difficulty tier: ${shape.allowedStoryTypes.join(', ')}. `
      + `The storyText, counts, and operation MUST match this situation.`;
  }
  if (shape.allowedUnknownPositions && props.unknownPosition) {
    props.unknownPosition.enum = [...shape.allowedUnknownPositions];
    props.unknownPosition.description =
      `Which quantity is unknown — CONSTRAINED to this difficulty tier: ${shape.allowedUnknownPositions.join(', ')}. `
      + `Phrase the story so its question targets exactly this hidden value.`;
    const req = (items.required ?? []) as string[];
    if (!req.includes('unknownPosition')) items.required = [...req, 'unknownPosition'];
  }
  return cloned;
}

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

const additionSubtractionSceneSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the activity (e.g., 'Farm Addition Stories', 'Pond Subtraction Fun')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID (e.g., 'ch1', 'ch2')"
          },
          type: {
            type: Type.STRING,
            enum: ["act-out", "build-equation", "solve-story", "create-story"],
            description: "Challenge type: 'act-out' (drag objects to act out story), 'build-equation' (construct the equation from tiles), 'solve-story' (read story and find the answer), 'create-story' (given equation, write a story)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging"
          },
          storyText: {
            type: Type.STRING,
            description: "The story narrative (e.g., '3 ducks are swimming. 2 more ducks join them.')"
          },
          scene: {
            type: Type.STRING,
            enum: ["pond", "farm", "playground", "space", "kitchen", "garden"],
            description: "Scene theme for visual background"
          },
          objectType: {
            type: Type.STRING,
            enum: VALID_OBJECT_TYPES,
            description: "Type of objects in the story — MUST be one of the valid types"
          },
          operation: {
            type: Type.STRING,
            enum: ["addition", "subtraction"],
            description: "Whether this challenge involves addition or subtraction"
          },
          storyType: {
            type: Type.STRING,
            enum: ["join", "separate", "compare", "part-whole"],
            description: "Story situation type: 'join' (adding to), 'separate' (taking away), 'compare' (how many more/fewer), 'part-whole' (parts make a whole)"
          },
          startCount: {
            type: Type.INTEGER,
            description: "Starting number of objects"
          },
          changeCount: {
            type: Type.INTEGER,
            description: "Number of objects added or removed"
          },
          resultCount: {
            type: Type.INTEGER,
            description: "Final count after the operation"
          },
          equation: {
            type: Type.STRING,
            description: "The equation string (e.g., '3 + 2 = 5', '7 - 3 = 4')"
          },
          unknownPosition: {
            type: Type.STRING,
            enum: ["result", "change", "start"],
            description: "Which part of the equation is unknown for the student to solve. Optional — defaults to 'result'."
          }
        },
        required: [
          "id", "type", "instruction", "storyText", "scene", "objectType",
          "operation", "storyType", "startCount", "changeCount", "resultCount", "equation"
        ]
      },
      description: "Array of 4-8 progressive challenges"
    },
    maxNumber: {
      type: Type.INTEGER,
      description: "Maximum number used in any challenge (5 for K, 10 for Grade 1)"
    },
    showTenFrame: {
      type: Type.BOOLEAN,
      description: "Whether to show a ten-frame alongside the scene for counting support"
    },
    showEquationBar: {
      type: Type.BOOLEAN,
      description: "Whether to show the equation bar with draggable tiles"
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K", "1"],
      description: "Grade band: 'K' for Kindergarten, '1' for Grade 1"
    }
  },
  required: ["title", "challenges", "maxNumber", "showTenFrame", "showEquationBar", "gradeBand"]
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateAdditionSubtractionScene = async (
  topic: string,
  gradeLevel: string,
  config?: {
    maxNumber?: number;
    gradeBand?: string;
    challengeTypes?: string[];
    operations?: string[];
    storyTypes?: string[];
    /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
    targetEvalMode?: string;
    /**
     * Per-component difficulty tier from the manifest ('easy' | 'medium' | 'hard').
     * Second field of the two-field contract: targetEvalMode = which skill,
     * difficulty = how hard within it. Drives TWO axes: AXIS 1 = on-screen
     * scaffolding (how much help), AXIS 2 = problem STRUCTURE (storyType /
     * unknownPosition ladder). NEVER changes the size of any number.
     */
    difficulty?: string;
    /**
     * Per-component intent the manifest assigned to THIS scene (e.g. "Take away
     * within 5", "Make 5 by joining two groups"). `topic` is the broad lesson;
     * `intent` is the specific objective this primitive must serve. Shapes the
     * story focus + scope (the grade stays the ceiling). Never names an answer.
     */
    intent?: string;
  }
): Promise<AdditionSubtractionSceneData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'addition-subtraction-scene',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  const effectiveChallengeTypes = evalConstraint?.allowedTypes ?? config?.challengeTypes;

  // ── Resolve within-mode support tier (only when exactly ONE mode is pinned) ──
  const pinnedType = (evalConstraint && evalConstraint.allowedTypes.length === 1
    ? evalConstraint.allowedTypes[0]
    : undefined) as ChallengeType | undefined;
  const supportTier = normalizeSupportTier(config?.difficulty);
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  // AXIS 2: the structural problem shape for this pinned mode + tier (null for
  // act-out/create-story or no tier). Enforced via the schema enum below.
  const problemShape = pinnedType && supportTier
    ? resolveProblemShape(pinnedType, supportTier)
    : null;
  const tierSection = pinnedType && supportTier
    ? buildTierPromptSection(pinnedType, supportTier)
    : '';

  // ── Build mode-constrained schema (eval mode → then AXIS-2 structural enum) ──
  let activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(additionSubtractionSceneSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : additionSubtractionSceneSchema;
  if (problemShape) {
    activeSchema = constrainStructuralEnums(activeSchema, problemShape);
  }

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const intent = config?.intent?.trim();

  const prompt = `
Create an educational addition and subtraction story activity for teaching "${topic}" to ${gradeLevel} students.
${intent ? `
FOCUS FOR THIS ACTIVITY: the broad lesson is "${topic}", but THIS scene was specifically assigned to target: "${intent}". Make every challenge serve that focus (its operation, story situation, and what is asked). Stay within the number range the topic and this focus imply — the grade is the ceiling, never exceed it. Do NOT restate or reveal any answer in the story; the focus describes the OBJECTIVE, not the solution.
` : ''}
CONTEXT:
- This is an animated story scene where objects join, leave, or are compared
- Students interact with concrete objects to build understanding of addition and subtraction
- The bridge from manipulatives to equations — stories make math meaningful
- Each challenge has a themed scene (pond, farm, playground, space, kitchen, garden)

${challengeTypeSection}
${tierSection}
${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * Numbers within 5 (maxNumber = 5)
  * Focus on act-out and solve-story challenge types
  * Primarily join and separate story types
  * Simple, warm language with familiar objects (ducks, apples, bunnies)
  * Ten-frame support for counting
  * unknownPosition should usually be 'result'

- Grade 1 (gradeBand "1"):
  * Numbers within 10 (maxNumber = 10)
  * All four challenge types: act-out, build-equation, solve-story, create-story
  * All story types: join, separate, compare, part-whole
  * Vary unknownPosition: result, change, and occasionally start
  * More complex stories with multiple steps
  * Equation bar for building number sentences
` : ''}

STORY TYPES:
- "join": Objects are added together (e.g., "3 ducks are swimming. 2 more join them.")
- "separate": Objects are removed (e.g., "5 apples on the table. 2 are eaten.")
- "compare": Two groups compared (e.g., "4 red flowers and 2 blue flowers. How many more red?")
- "part-whole": Parts make a whole (e.g., "There are 3 cats inside and 2 outside. How many total?")

${(() => {
  const hints: string[] = [];
  if (config?.maxNumber) hints.push(`- Max number: ${config.maxNumber}`);
  if (config?.gradeBand) hints.push(`- Grade band: ${config.gradeBand}`);
  if (effectiveChallengeTypes) hints.push(`- Challenge types to include: ${effectiveChallengeTypes.join(', ')}`);
  if (config?.operations) hints.push(`- Operations to include: ${config.operations.join(', ')}`);
  if (config?.storyTypes) hints.push(`- Story types to include: ${config.storyTypes.join(', ')}`);
  return hints.length > 0 ? `CONFIGURATION HINTS:\n${hints.join('\n')}` : '';
})()}

REQUIREMENTS:
1. Generate 4-8 challenges that progress in difficulty
2. Use appropriate story contexts (join, separate, compare, part-whole)
3. Keep all numbers within maxNumber (5 for K, 10 for Grade 1)
4. Create engaging, relatable story texts that match the scene theme
5. CRITICAL: Equation strings MUST be mathematically accurate (e.g., "3 + 2 = 5", "7 - 3 = 4")
6. CRITICAL: resultCount must equal startCount + changeCount for addition, startCount - changeCount for subtraction
7. Generate unique IDs for each challenge (e.g., 'ch1', 'ch2', etc.)
8. objectType MUST be from this set: ${VALID_OBJECT_TYPES.join(', ')}. Match to scene (ducks for pond, rockets for space, cookies for kitchen, flowers for garden, etc.)
9. Progress from easier to harder
10. Use warm, child-friendly instruction text
11. Mix addition and subtraction operations across challenges
12. Set showTenFrame to true for K, false for Grade 1 unless numbers > 5
13. Set showEquationBar to true when build-equation challenges are included

Return the complete addition/subtraction scene configuration.
`;

  logEvalModeResolution('AdditionSubtractionScene', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid addition/subtraction scene data returned from Gemini API');
  }

  // ── Structural validation ──

  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  if (!data.maxNumber || data.maxNumber < 1) {
    data.maxNumber = data.gradeBand === 'K' ? 5 : 10;
  }

  if (typeof data.showTenFrame !== 'boolean') {
    data.showTenFrame = data.gradeBand === 'K';
  }
  if (typeof data.showEquationBar !== 'boolean') {
    data.showEquationBar = true;
  }
  // Support-tier scene levers default to full scaffolding (current behavior);
  // a pinned-mode tier may withdraw them at the end of the generator.
  if (typeof data.showCountBadges !== 'boolean') {
    data.showCountBadges = true;
  }
  if (typeof data.groupedReveal !== 'boolean') {
    data.groupedReveal = true;
  }

  // Valid enums
  const validChallengeTypes = ['act-out', 'build-equation', 'solve-story', 'create-story'];
  const validScenes = ['pond', 'farm', 'playground', 'space', 'kitchen', 'garden'];
  const validOperations = ['addition', 'subtraction'];
  const validStoryTypes = ['join', 'separate', 'compare', 'part-whole'];
  const validUnknownPositions = ['result', 'change', 'start'];

  // Filter to valid challenge types (safety net — schema enum handles the eval mode case)
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // Per-challenge validation
  for (const challenge of data.challenges) {
    if (!validScenes.includes(challenge.scene)) {
      challenge.scene = 'farm';
    }

    if (!validOperations.includes(challenge.operation)) {
      challenge.operation = 'addition';
    }

    if (!validStoryTypes.includes(challenge.storyType)) {
      challenge.storyType = challenge.operation === 'addition' ? 'join' : 'separate';
    }

    // AS-2: Derive operation from storyType — join→addition, separate→subtraction
    // compare & part-whole can be either, so leave as-is
    if (challenge.storyType === 'join') {
      challenge.operation = 'addition';
    } else if (challenge.storyType === 'separate') {
      challenge.operation = 'subtraction';
    }

    // AS-1: Clamp objectType to valid emoji set
    if (!VALID_OBJECT_TYPES.includes(challenge.objectType)) {
      challenge.objectType = SCENE_DEFAULT_OBJECTS[challenge.scene] || 'stars';
    }

    if (challenge.unknownPosition && !validUnknownPositions.includes(challenge.unknownPosition)) {
      challenge.unknownPosition = 'result';
    }

    // Ensure counts are non-negative integers
    challenge.startCount = Math.max(0, Math.round(challenge.startCount || 0));
    challenge.changeCount = Math.max(0, Math.round(challenge.changeCount || 0));
    challenge.resultCount = Math.max(0, Math.round(challenge.resultCount || 0));

    // Clamp to maxNumber
    if (challenge.startCount > data.maxNumber) challenge.startCount = data.maxNumber;
    if (challenge.changeCount > data.maxNumber) challenge.changeCount = data.maxNumber;
    if (challenge.resultCount > data.maxNumber) challenge.resultCount = data.maxNumber;

    // Fix resultCount to match operation
    if (challenge.operation === 'addition') {
      challenge.resultCount = challenge.startCount + challenge.changeCount;
    } else {
      if (challenge.startCount < challenge.changeCount) {
        const tmp = challenge.startCount;
        challenge.startCount = challenge.changeCount;
        challenge.changeCount = tmp;
      }
      challenge.resultCount = challenge.startCount - challenge.changeCount;
    }

    // Rebuild equation string to ensure accuracy
    if (challenge.operation === 'addition') {
      challenge.equation = `${challenge.startCount} + ${challenge.changeCount} = ${challenge.resultCount}`;
    } else {
      challenge.equation = `${challenge.startCount} - ${challenge.changeCount} = ${challenge.resultCount}`;
    }

    // Ensure id exists
    if (!challenge.id) {
      challenge.id = `ch${data.challenges.indexOf(challenge) + 1}`;
    }
  }

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'act-out';
    const fallbacks: Record<string, object> = {
      'act-out': {
        id: 'ch1',
        type: 'act-out',
        instruction: 'Watch the story and drag the ducks into the pond!',
        storyText: '2 ducks are swimming in the pond. 1 more duck joins them. How many ducks are there now?',
        scene: 'pond',
        objectType: 'ducks',
        operation: 'addition',
        storyType: 'join',
        startCount: 2,
        changeCount: 1,
        resultCount: 3,
        equation: '2 + 1 = 3',
      },
      'build-equation': {
        id: 'ch1',
        type: 'build-equation',
        instruction: 'Build the equation that matches the story!',
        storyText: '4 apples are on the table. 2 more apples are placed on the table.',
        scene: 'kitchen',
        objectType: 'apples',
        operation: 'addition',
        storyType: 'join',
        startCount: 4,
        changeCount: 2,
        resultCount: 6,
        equation: '4 + 2 = 6',
      },
      'solve-story': {
        id: 'ch1',
        type: 'solve-story',
        instruction: 'Read the story and find the missing number!',
        storyText: '5 flowers are in the garden. 2 flowers are picked. How many flowers are left?',
        scene: 'garden',
        objectType: 'flowers',
        operation: 'subtraction',
        storyType: 'separate',
        startCount: 5,
        changeCount: 2,
        resultCount: 3,
        equation: '5 - 2 = 3',
        unknownPosition: 'result',
      },
      'create-story': {
        id: 'ch1',
        type: 'create-story',
        instruction: 'Can you make up a story that matches this equation?',
        storyText: '',
        scene: 'farm',
        objectType: 'chickens',
        operation: 'addition',
        storyType: 'join',
        startCount: 3,
        changeCount: 2,
        resultCount: 5,
        equation: '3 + 2 = 5',
      },
    };
    console.log(`[AdditionSubtractionScene] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [fallbacks[fallbackType] ?? fallbacks['act-out']];
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[AdditionSubtractionScene] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  // Apply explicit config overrides
  if (config) {
    if (config.gradeBand === 'K' || config.gradeBand === '1') {
      data.gradeBand = config.gradeBand;
    }
    if (config.maxNumber !== undefined) {
      data.maxNumber = config.maxNumber;
    }
  }

  // ── Apply the within-mode difficulty deterministically (both axes) ──
  // Runs LAST, after all structural fixups. AXIS 1 (scaffolding) is code-owned;
  // AXIS 2 (problem structure) was enforced upstream by the schema enum, so here
  // we only VALIDATE it (clamp the rare stray to the tier floor) and keep the
  // answer-bearing fields mutually consistent. Gated on supportTier → the no-tier
  // path is byte-identical to before this skill ran.
  if (tierScaffold && pinnedType) {
    if (pinnedType === 'act-out') {
      data.showCountBadges = tierScaffold.showCountBadges;
      data.groupedReveal = tierScaffold.groupedReveal;
      console.log(
        `[AdditionSubtractionScene] Tier "${supportTier}" on mode "act-out" (scaffolding-only) → `
        + `countBadges=${data.showCountBadges}, groupedReveal=${data.groupedReveal}`,
      );
    } else if (pinnedType === 'build-equation') {
      // AXIS 2 is enforced by the SCHEMA enum (storyType + unknownPosition='result'),
      // so the LLM already authored a self-consistent storyText + operation + counts.
      // We must NOT re-derive operation from the forced storyType LABEL here: a story
      // the LLM wrote as take-away ("…how many are LEFT?") but the enum tagged
      // 'part-whole' is still a SUBTRACTION. The old code forced part-whole→addition and
      // recomputed result = start + change, desyncing the equation from the story (e.g.
      // "9 baked, ate 4, how many left?" → 9 + 4 = 13). TRUST the LLM's operation; only
      // clamp a stray storyType and keep the arithmetic consistent for THAT operation.
      const allowed = problemShape?.allowedStoryTypes;
      if (allowed) {
        for (const ch of data.challenges as AddSubChallenge[]) {
          if (!allowed.includes(ch.storyType)) ch.storyType = allowed[0];
          if (ch.operation === 'subtraction' && ch.startCount < ch.changeCount) {
            const t = ch.startCount; ch.startCount = ch.changeCount; ch.changeCount = t;
          }
          ch.resultCount = ch.operation === 'addition'
            ? ch.startCount + ch.changeCount
            : ch.startCount - ch.changeCount;
          ch.equation = `${ch.startCount} ${ch.operation === 'addition' ? '+' : '-'} ${ch.changeCount} = ${ch.resultCount}`;
        }
      }
      for (const ch of data.challenges as AddSubChallenge[]) {
        const tiles = buildAllowedTiles(ch, tierScaffold.tilePalette, data.maxNumber);
        if (tiles) ch.allowedTiles = tiles;
        else delete ch.allowedTiles;
      }
      console.log(
        `[AdditionSubtractionScene] Tier "${supportTier}" on mode "build-equation" → `
        + `tilePalette=${tierScaffold.tilePalette}, storyTypes=[${allowed?.join(', ') ?? 'n/a'}] `
        + `(schema-enforced) → ${(data.challenges as AddSubChallenge[]).map((c) => `${c.storyType}:${c.equation}`).join(' | ')}`,
      );
    } else if (pinnedType === 'solve-story') {
      // AXIS 2: unknownPosition is the structural lever, enforced by the schema enum
      // so the LLM-authored story already targets the right hidden slot. Validate &
      // clamp the rare stray to the tier floor; the component recomputes the answer
      // from unknownPosition, so nothing is leaked.
      const allowed = problemShape?.allowedUnknownPositions;
      if (allowed) {
        for (const ch of data.challenges as AddSubChallenge[]) {
          if (!ch.unknownPosition || !allowed.includes(ch.unknownPosition)) {
            ch.unknownPosition = allowed[0];
          }
        }
        console.log(
          `[AdditionSubtractionScene] Tier "${supportTier}" on mode "solve-story" → `
          + `unknownPosition constrained to [${allowed.join(', ')}] (schema-enforced) → `
          + `${(data.challenges as AddSubChallenge[]).map((c) => c.unknownPosition).join(', ')}`,
        );
      }
    }
  }

  return data;
};
