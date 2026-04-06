import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';

// Import data types from component (single source of truth)
import type {
  PushPullArenaData,
  PushPullChallenge,
  PushPullChallengeType,
  ArenaSurface,
  PushPullDirection,
  ArenaTheme,
} from '../../primitives/visual-primitives/physics/PushPullArena';

import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// Re-export for convenience
export type {
  PushPullArenaData,
  PushPullChallenge,
  PushPullChallengeType,
  ArenaSurface,
  PushPullDirection,
  ArenaTheme,
};

// ============================================================================
// CHALLENGE TYPE DOCUMENTATION REGISTRY
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  observe: {
    promptDoc:
      `"observe": Hands-on exploration. Student pushes/pulls an object and observes the result. `
      + `MC questions like "Did the ball move?", "Which direction?", "Did it move fast or slow?" `
      + `Include the pushStrength (1-10) and pushDirection ('push' or 'pull'). Easiest difficulty. K-1.`,
    schemaDescription: "'observe' (push/pull and answer about what happened)",
  },
  predict: {
    promptDoc:
      `"predict": Prediction before action. Given object weight, surface, and push strength, `
      + `student predicts whether it will move, how far, or what direction BEFORE seeing the simulation. `
      + `Include pushStrength (1-10) and pushDirection. Medium difficulty. Grades 1-2.`,
    schemaDescription: "'predict' (predict outcome before simulation)",
  },
  compare: {
    promptDoc:
      `"compare": Side-by-side comparison. TWO objects with different weights on the same surface, `
      + `or same object on two different surfaces. Student determines which moves more/less or which `
      + `needs more effort. MUST include object2Name, object2Weight, object2Emoji for the second object. `
      + `Medium-high difficulty. Grades 2-3.`,
    schemaDescription: "'compare' (compare two objects or surfaces)",
  },
  design: {
    promptDoc:
      `"design": Goal-directed. Student must determine the right force to achieve a specific goal `
      + `(move heavy object to a target, stop a sliding object, balance opposing forces). `
      + `Include goalDescription. Highest difficulty. Grades 4-5.`,
    schemaDescription: "'design' (set up forces to achieve a goal)",
  },
};

// ============================================================================
// DETERMINISTIC OBJECT LIBRARY
// ============================================================================

interface ObjectTemplate {
  name: string;
  weight: number;
  emoji: string;
}

const OBJECT_LIBRARY: ObjectTemplate[] = [
  { name: 'Tennis Ball', weight: 1, emoji: '🎾' },
  { name: 'Soccer Ball', weight: 2, emoji: '⚽' },
  { name: 'Toy Car', weight: 2, emoji: '🚗' },
  { name: 'Book', weight: 3, emoji: '📕' },
  { name: 'Brick', weight: 4, emoji: '🧱' },
  { name: 'Backpack', weight: 5, emoji: '🎒' },
  { name: 'Watermelon', weight: 6, emoji: '🍉' },
  { name: 'Dog', weight: 7, emoji: '🐕' },
  { name: 'Barrel', weight: 8, emoji: '🛢️' },
  { name: 'Rock', weight: 9, emoji: '🪨' },
  { name: 'Refrigerator', weight: 10, emoji: '🧊' },
];

function pickObject(weight?: number, name?: string): ObjectTemplate {
  // Prefer name match (case-insensitive) so the rendered object matches the instruction text
  if (name) {
    const byName = OBJECT_LIBRARY.find(
      o => o.name.toLowerCase() === name.toLowerCase(),
    );
    if (byName) return byName;
  }
  if (weight != null) {
    return OBJECT_LIBRARY.find(o => o.weight === weight)
      ?? OBJECT_LIBRARY[Math.min(weight - 1, OBJECT_LIBRARY.length - 1)];
  }
  return OBJECT_LIBRARY[Math.floor(Math.random() * OBJECT_LIBRARY.length)];
}

function pickContrastingPair(): [ObjectTemplate, ObjectTemplate] {
  // Pick one light (1-3) and one heavy (7-10)
  const light = OBJECT_LIBRARY.filter(o => o.weight <= 3);
  const heavy = OBJECT_LIBRARY.filter(o => o.weight >= 7);
  return [
    light[Math.floor(Math.random() * light.length)],
    heavy[Math.floor(Math.random() * heavy.length)],
  ];
}

// ============================================================================
// GEMINI SCHEMA — flat fields, minimal complexity
// ============================================================================

const pushPullArenaSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Engaging, age-appropriate title for the push/pull activity',
    },
    description: {
      type: Type.STRING,
      description: 'Clear description of what students will learn about forces and motion',
    },
    theme: {
      type: Type.STRING,
      enum: ['playground', 'toys', 'sports', 'animals'],
      description: 'Visual theme for the arena',
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: 'Unique challenge ID (e.g., "c1", "c2")',
          },
          type: {
            type: Type.STRING,
            enum: ['observe', 'predict', 'compare', 'design'],
            description: 'Challenge type',
          },
          instruction: {
            type: Type.STRING,
            description: 'Clear instruction for the student. Do NOT reveal the answer.',
          },
          surface: {
            type: Type.STRING,
            enum: ['ice', 'wood', 'carpet', 'grass'],
            description: 'Surface type for this challenge',
          },
          pushStrength: {
            type: Type.NUMBER,
            description: 'Force strength 1-10 (for observe/predict). Omit for compare/design.',
          },
          pushDirection: {
            type: Type.STRING,
            enum: ['push', 'pull'],
            description: 'Force direction (for observe/predict). Omit for compare/design.',
          },
          // Object info (Gemini picks names/weights that match the scenario)
          objectName: {
            type: Type.STRING,
            description: 'Name of primary object. MUST be one of: Tennis Ball, Soccer Ball, Toy Car, Book, Brick, Backpack, Watermelon, Dog, Barrel, Rock, Refrigerator',
          },
          objectWeight: {
            type: Type.NUMBER,
            description: 'Weight of primary object (1-10 kg)',
          },
          object2Name: {
            type: Type.STRING,
            description: 'Name of second object for compare mode. MUST be from the object list above. Omit for non-compare.',
          },
          object2Weight: {
            type: Type.NUMBER,
            description: 'Weight of second object for compare mode (1-10 kg). Omit for non-compare.',
          },
          goalDescription: {
            type: Type.STRING,
            description: 'Goal description for design mode (e.g., "Move the rock past the red line"). Omit for non-design.',
          },
          correctAnswer: {
            type: Type.STRING,
            description: 'The correct answer to the MC question',
          },
          distractor0: {
            type: Type.STRING,
            description: 'First wrong answer option',
          },
          distractor1: {
            type: Type.STRING,
            description: 'Second wrong answer option',
          },
          hint: {
            type: Type.STRING,
            description: 'Pedagogical hint that guides without giving away the answer',
          },
        },
        required: [
          'id', 'type', 'instruction', 'surface', 'objectName', 'objectWeight',
          'correctAnswer', 'distractor0', 'distractor1', 'hint',
        ],
      },
      description: 'Array of challenges',
    },
  },
  required: ['title', 'description', 'theme', 'challenges'],
};

// ============================================================================
// GRADE CONFIGURATION
// ============================================================================

const GRADE_CONFIGS: Record<string, { numChallenges: number; guidance: string }> = {
  K: {
    numChallenges: 4,
    guidance: 'Focus on observe. "Push the ball! Did it move?" Simple vocabulary. Objects they know (ball, toy car).',
  },
  '1': {
    numChallenges: 4,
    guidance: 'Observe + simple predict. "What happens if you push harder?" Compare fast vs slow.',
  },
  '2': {
    numChallenges: 5,
    guidance: 'Predict + compare. "Which is harder to push — the book or the rock?" Introduce surface differences.',
  },
  '3': {
    numChallenges: 5,
    guidance: 'Compare + design. Two objects, different surfaces. "Can forces cancel out?" Introduce friction vocabulary.',
  },
  '4': {
    numChallenges: 6,
    guidance: 'Design challenges. Force arrows, net force concepts. "What force do you need to move the barrel across carpet?"',
  },
  '5': {
    numChallenges: 6,
    guidance: 'Full range including design. Balanced/unbalanced forces. "How can two pushes cancel each other?"',
  },
};

const SURFACES: ArenaSurface[] = ['ice', 'wood', 'carpet', 'grass'];

// ============================================================================
// GENERATOR FUNCTION
// ============================================================================

export const generatePushPullArena = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<PushPullArenaData> => {
  // Parse grade
  const gradeMatch = gradeLevel.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '1';
  const validGrades = ['K', '1', '2', '3', '4', '5'];
  const finalGrade = validGrades.includes(gradeMatch) ? gradeMatch : '1';
  const gradeConfig = GRADE_CONFIGS[finalGrade] || GRADE_CONFIGS['1'];

  // Resolve eval mode constraint
  const evalConstraint = resolveEvalModeConstraint(
    'push-pull-arena',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // Build constrained schema
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(
        pushPullArenaSchema,
        evalConstraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
      )
    : pushPullArenaSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // Build prompt
  const prompt = `
Create a Push & Pull Arena activity for Grade ${finalGrade} students about forces and motion.

Topic: ${topic}
Grade Guidance: ${gradeConfig.guidance}

Available surfaces: ice (very slippery), wood (moderate friction), carpet (high friction), grass (high friction).

Physics rules the student should discover:
- A PUSH makes things move AWAY. A PULL brings things CLOSER.
- BIGGER push/pull = FASTER movement.
- HEAVIER objects need BIGGER forces to move.
- ICE is slippery (objects slide far). CARPET is rough (objects stop quickly).
- If the push is too weak for a heavy object on a rough surface, it WON'T MOVE AT ALL.
- Two opposite pushes can CANCEL OUT (balanced forces = no movement).

${challengeTypeSection}

Available objects (use EXACT names in objectName / object2Name):
- Tennis Ball (1kg), Soccer Ball (2kg), Toy Car (2kg), Book (3kg)
- Brick (4kg), Backpack (5kg), Watermelon (6kg)
- Dog (7kg), Barrel (8kg), Rock (9kg), Refrigerator (10kg)

IMPORTANT: The objectName you choose MUST match one of these exact names.
The objectWeight MUST match that object's weight from the list above.
Use the same object name in your instruction text as in the objectName field.

For OBSERVE challenges: include pushStrength (1-10) and pushDirection ('push' or 'pull').
For PREDICT challenges: include pushStrength (1-10) and pushDirection.
For COMPARE challenges: include object2Weight (different from objectWeight). Both get same push.
For DESIGN challenges: include goalDescription.

Generate ${gradeConfig.numChallenges} challenges. NEVER reveal the answer in the instruction.
Use warm, age-appropriate language for Grade ${finalGrade}.
Vary surfaces across challenges for variety.
`;

  logEvalModeResolution('PushPullArena', config?.targetEvalMode, evalConstraint);

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: activeSchema,
      },
    });

    const raw = JSON.parse(result.text || '{}');
    const allowedTypes = evalConstraint?.allowedTypes;

    // ── Post-process challenges ──
    let rejectedCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const challenges: (PushPullChallenge | null)[] = (raw.challenges || []).map((c: any, i: number) => {
      let type = c.type as PushPullChallengeType;

      // Force type to match eval constraint
      if (allowedTypes && !allowedTypes.includes(type)) {
        type = allowedTypes[0] as PushPullChallengeType;
      }

      // Validate required fields
      if (!c.instruction || !c.correctAnswer || !c.distractor0 || !c.distractor1) {
        console.warn(`[PushPullArena] Rejecting challenge ${i}: missing required MC fields`);
        rejectedCount++;
        return null;
      }

      const surface: ArenaSurface = SURFACES.includes(c.surface) ? c.surface : 'wood';
      const weight = Math.max(1, Math.min(10, Math.round(c.objectWeight || 3)));

      // Look up object from library by name first, then weight
      const obj = pickObject(weight, c.objectName);

      const challenge: PushPullChallenge = {
        id: c.id || `c${i + 1}`,
        type,
        instruction: c.instruction,
        objectName: obj.name,
        objectWeight: obj.weight,
        objectEmoji: obj.emoji,
        surface,
        correctAnswer: c.correctAnswer,
        distractor0: c.distractor0,
        distractor1: c.distractor1,
        hint: c.hint || 'Think about how heavy the object is and how slippery the surface is.',
      };

      // Type-specific fields
      if (type === 'observe' || type === 'predict') {
        challenge.pushStrength = Math.max(1, Math.min(10, Math.round(c.pushStrength || 5)));
        challenge.pushDirection = c.pushDirection === 'pull' ? 'pull' : 'push';
      }

      if (type === 'compare') {
        if (!c.object2Weight) {
          // No second object — pick a contrasting one
          const [, heavy] = pickContrastingPair();
          challenge.object2Name = heavy.name;
          challenge.object2Weight = heavy.weight;
          challenge.object2Emoji = heavy.emoji;
        } else {
          const obj2Weight = Math.max(1, Math.min(10, Math.round(c.object2Weight)));
          const obj2 = pickObject(obj2Weight, c.object2Name);
          challenge.object2Name = obj2.name;
          challenge.object2Weight = obj2.weight;
          challenge.object2Emoji = obj2.emoji;
        }
        // Compare mode gets a moderate default push
        challenge.pushStrength = 5;
        challenge.pushDirection = 'push';
      }

      if (type === 'design') {
        challenge.goalDescription = c.goalDescription || 'Move the object across the arena';
        challenge.pushStrength = 5;
        challenge.pushDirection = 'push';
      }

      return challenge;
    });

    const validChallenges = challenges.filter((c): c is PushPullChallenge => c !== null);

    if (rejectedCount > 0) {
      console.warn(`[PushPullArena] Rejected ${rejectedCount}/${challenges.length} challenges`);
    }

    if (validChallenges.length === 0) {
      console.error('[PushPullArena] All challenges rejected — using fallback');
      return buildFallback(finalGrade, config?.targetEvalMode);
    }

    const theme: ArenaTheme = ['playground', 'toys', 'sports', 'animals'].includes(raw.theme)
      ? raw.theme
      : 'playground';

    return {
      title: raw.title || 'Push & Pull Arena',
      description: raw.description || 'Explore how pushes and pulls make things move!',
      theme,
      challenges: validChallenges,
    };
  } catch (error) {
    console.error('Error generating PushPullArena content:', error);
    return buildFallback(finalGrade, config?.targetEvalMode);
  }
};

// ============================================================================
// FALLBACK
// ============================================================================

function buildFallback(grade: string, targetEvalMode?: string): PushPullArenaData {
  const mode = (targetEvalMode || 'observe') as PushPullChallengeType;

  const fallbackChallenges: PushPullChallenge[] = [];

  if (mode === 'observe' || !targetEvalMode) {
    fallbackChallenges.push({
      id: 'f1',
      type: 'observe',
      instruction: 'Push the tennis ball on the wood floor. What happens?',
      objectName: 'Tennis Ball',
      objectWeight: 1,
      objectEmoji: '🎾',
      surface: 'wood',
      pushStrength: 5,
      pushDirection: 'push',
      correctAnswer: 'The ball rolls across the floor',
      distractor0: 'The ball does not move',
      distractor1: 'The ball flies into the air',
      hint: 'A tennis ball is very light — even a small push will move it!',
    });
    fallbackChallenges.push({
      id: 'f2',
      type: 'observe',
      instruction: 'Now push the heavy rock on carpet. Does it move?',
      objectName: 'Rock',
      objectWeight: 9,
      objectEmoji: '🪨',
      surface: 'carpet',
      pushStrength: 3,
      pushDirection: 'push',
      correctAnswer: 'The rock barely moves or stays still',
      distractor0: 'The rock slides far across the carpet',
      distractor1: 'The rock bounces',
      hint: 'Heavy objects on rough surfaces are very hard to push!',
    });
  }

  if (mode === 'predict') {
    fallbackChallenges.push({
      id: 'f1',
      type: 'predict',
      instruction: 'A soccer ball (2kg) is on ice. You push with force 4. What will happen?',
      objectName: 'Soccer Ball',
      objectWeight: 2,
      objectEmoji: '⚽',
      surface: 'ice',
      pushStrength: 4,
      pushDirection: 'push',
      correctAnswer: 'The ball slides a long way on the slippery ice',
      distractor0: 'The ball does not move',
      distractor1: 'The ball stops immediately',
      hint: 'Ice is very slippery — there is almost no friction to slow things down!',
    });
    fallbackChallenges.push({
      id: 'f2',
      type: 'predict',
      instruction: 'The same soccer ball is now on grass. Same push (force 4). What changes?',
      objectName: 'Soccer Ball',
      objectWeight: 2,
      objectEmoji: '⚽',
      surface: 'grass',
      pushStrength: 4,
      pushDirection: 'push',
      correctAnswer: 'The ball moves but stops much sooner than on ice',
      distractor0: 'The ball goes just as far as on ice',
      distractor1: 'The ball does not move at all',
      hint: 'Grass has much more friction than ice — it slows things down!',
    });
  }

  if (mode === 'compare') {
    fallbackChallenges.push({
      id: 'f1',
      type: 'compare',
      instruction: 'Both the tennis ball and the rock get the same push on wood. Which moves more?',
      objectName: 'Tennis Ball',
      objectWeight: 1,
      objectEmoji: '🎾',
      object2Name: 'Rock',
      object2Weight: 9,
      object2Emoji: '🪨',
      surface: 'wood',
      pushStrength: 5,
      pushDirection: 'push',
      correctAnswer: 'The tennis ball moves much more because it is lighter',
      distractor0: 'The rock moves more because it is heavier',
      distractor1: 'They move the same distance',
      hint: 'Heavier things are harder to push — they need more force!',
    });
  }

  if (mode === 'design') {
    fallbackChallenges.push({
      id: 'f1',
      type: 'design',
      instruction: 'You need to move the heavy barrel across the carpet. What should you do?',
      objectName: 'Barrel',
      objectWeight: 8,
      objectEmoji: '🛢️',
      surface: 'carpet',
      goalDescription: 'Move the barrel all the way across',
      pushStrength: 5,
      pushDirection: 'push',
      correctAnswer: 'Use a very strong push (force 9 or 10)',
      distractor0: 'Use a gentle push (force 2)',
      distractor1: 'Pull instead of push',
      hint: 'The barrel is very heavy and carpet has lots of friction — you need a BIG force!',
    });
  }

  return {
    title: 'Push & Pull Arena',
    description: 'Explore how pushes and pulls make things move!',
    theme: 'playground',
    challenges: fallbackChallenges.length > 0 ? fallbackChallenges : [{
      id: 'f0',
      type: 'observe',
      instruction: 'Push the ball! What happens?',
      objectName: 'Tennis Ball',
      objectWeight: 1,
      objectEmoji: '🎾',
      surface: 'wood',
      pushStrength: 5,
      pushDirection: 'push',
      correctAnswer: 'The ball rolls forward',
      distractor0: 'Nothing happens',
      distractor1: 'The ball goes backwards',
      hint: 'Try pushing the ball and watch what happens!',
    }],
  };
}
