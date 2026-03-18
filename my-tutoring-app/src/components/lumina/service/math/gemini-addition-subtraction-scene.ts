import { Type, Schema } from "@google/genai";
import { AdditionSubtractionSceneData } from "../../primitives/visual-primitives/math/AdditionSubtractionScene";
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
  }
): Promise<AdditionSubtractionSceneData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'addition-subtraction-scene',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  const effectiveChallengeTypes = evalConstraint?.allowedTypes ?? config?.challengeTypes;

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(additionSubtractionSceneSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : additionSubtractionSceneSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create an educational addition and subtraction story activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- This is an animated story scene where objects join, leave, or are compared
- Students interact with concrete objects to build understanding of addition and subtraction
- The bridge from manipulatives to equations — stories make math meaningful
- Each challenge has a themed scene (pond, farm, playground, space, kitchen, garden)

${challengeTypeSection}

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

  return data;
};
