import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type { GenerationContext } from "../generation/generationContext";

// Import data types from component (single source of truth)
import type {
  GravityDropTowerData,
  DropChallenge,
  DropChallengeType,
  DropObject,
} from '../../primitives/visual-primitives/physics/GravityDropTower';

import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// Re-export
export type { GravityDropTowerData, DropChallenge, DropChallengeType, DropObject };

// ============================================================================
// CHALLENGE TYPE DOCUMENTATION
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  observe: {
    promptDoc:
      `"observe": Student drops 1-2 objects and observes what happens. ` +
      `Simple MC: "What happened when you dropped it?", "Did it go up or down?", "Did the heavy one fall faster?" ` +
      `Use airResistance=false. 1-2 objects. Height 5-10m. Easiest difficulty. K-1.`,
    schemaDescription: "'observe' (drop and watch what happens)",
  },
  predict: {
    promptDoc:
      `"predict": Student predicts which of TWO objects lands first BEFORE dropping. ` +
      `Key misconception: heavier objects do NOT fall faster (without air). ` +
      `Use 2 objects with different masses. Can toggle airResistance to show difference. ` +
      `MC: "Which lands first?", "They land at the same time" is often correct (no air). Grades 1-3.`,
    schemaDescription: "'predict' (predict which lands first)",
  },
  compare: {
    promptDoc:
      `"compare": Drop objects from different heights or compare with/without air resistance. ` +
      `MC: "Which lands first when dropped from different heights?", "What changes when air resistance is on?" ` +
      `Use 1-2 objects. Vary heights. Toggle air resistance for comparison. Grades 2-4.`,
    schemaDescription: "'compare' (compare heights or air resistance effects)",
  },
  measure: {
    promptDoc:
      `"measure": Student observes fall time displayed on screen and answers measurement questions. ` +
      `MC: "How long did it take to fall from 5m?", "If height doubles, does time double?" ` +
      `Use 1 object, no air resistance. Heights 2-20m. Numeric-ish answers. Grades 4-5.`,
    schemaDescription: "'measure' (measure fall time and height relationship)",
  },
  calculate: {
    promptDoc:
      `"calculate": Use h = ½gt² (or t = √(2h/g)) to compute fall time or impact velocity (v = gt). ` +
      `Provide height and g=9.8. Student computes. MC with numeric answers. ` +
      `Heights 5-50m. 1 object, no air resistance. MS-HS level.`,
    schemaDescription: "'calculate' (compute fall time using h = ½gt²)",
  },
};

// ============================================================================
// WITHIN-MODE SUPPORT TIER (config.difficulty) — scaffolding level, NOT numbers
// ============================================================================

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

// ----------------------------------------------------------------------------
// Bespoke support scaffold — which on-screen / instructional helps are withdrawn
// per pinned mode. INVARIANT: a tier only removes scaffolding; it NEVER touches
// the objects, the height, airResistance, the question, or the correctAnswer.
// Two levers:
//   showReadouts (#1 perception): the live numeric overlays the student reads the
//     answer off of — fall speed (m/s), the land-time stamp, the running timer.
//     easy/medium = shown (self-check); hard = withdrawn (estimate/compute unaided).
//   nameStrategy + hintLevel (#2 instruction): easy names the governing gravity
//     idea in the instruction and gives a formula-grade hint; hard names nothing
//     and the hint is a conceptual nudge only. Words only — every number identical.
// ----------------------------------------------------------------------------

interface GravityDropTowerSupportScaffold {
  /** Show the live numeric speed/time readouts on the canvas (self-check overlay). */
  showReadouts: boolean;
  /** Name the governing gravity idea in the instruction (easy) vs. leave it neutral. */
  nameStrategy: boolean;
  /** 'formula' = explicit rule in the hint; 'concept' = nudge only. */
  hintLevel: 'formula' | 'concept';
  promptLines: string[];
}

function resolveSupportStructure(
  pinnedType: DropChallengeType,
  tier: SupportTier,
): GravityDropTowerSupportScaffold {
  const lead =
    'This tier changes only how much on-screen / instructional help the student gets. '
    + 'It NEVER changes the objects, the drop height, air resistance, the question, or the answer.';

  // Readouts are the answer-supporting numbers for any mode that reads time/speed.
  // For qualitative modes (observe/predict) they still confirm the outcome, so they
  // follow the same withdrawal ladder. Hidden at hard across every mode.
  const showReadouts = tier !== 'hard';
  const nameStrategy = tier === 'easy';
  const hintLevel: 'formula' | 'concept' = tier === 'easy' ? 'formula' : 'concept';

  const readoutNoun =
    pinnedType === 'measure' || pinnedType === 'calculate'
      ? 'fall time and speed'
      : pinnedType === 'compare'
        ? 'fall times and speeds for the objects'
        : 'falling speed and landing time';

  return {
    showReadouts,
    nameStrategy,
    hintLevel,
    promptLines: [
      lead,
      `The on-screen numeric readouts (${readoutNoun}) are ${showReadouts ? 'shown so the student can self-check' : 'WITHDRAWN — the student must estimate or compute the values unaided (the timer shows "?")'}.`,
      `The instruction ${nameStrategy ? 'NAMES the gravity idea at play (e.g. "without air, all objects fall at the same rate" / "fall time grows with the square root of height") so the student knows the strategy' : 'stays NEUTRAL — it sets up the drop WITHOUT naming the rule or the misconception; the student must decide what is going on'}.`,
      `The hint is ${hintLevel === 'formula' ? 'an explicit rule or formula' : 'a conceptual nudge only — no rule or formula stated'}.`,
      'Keep the title and description neutral — never state the support level or reveal which option is correct.',
    ],
  };
}

// ============================================================================
// OBJECT LIBRARY
// ============================================================================

interface ObjectTemplate {
  name: string;
  emoji: string;
  mass: number;
  dragCoeff: number;
}

// TODO: intent steers prompt text only; object/value library is code-picked (Tier-2).
const OBJECT_LIBRARY: ObjectTemplate[] = [
  { name: 'Marble',       emoji: '🔮', mass: 0.01,  dragCoeff: 0.1 },
  { name: 'Tennis Ball',   emoji: '🎾', mass: 0.06,  dragCoeff: 0.5 },
  { name: 'Baseball',      emoji: '⚾', mass: 0.15,  dragCoeff: 0.4 },
  { name: 'Brick',         emoji: '🧱', mass: 2.0,   dragCoeff: 0.2 },
  { name: 'Bowling Ball',  emoji: '🎳', mass: 7.0,   dragCoeff: 0.1 },
  { name: 'Watermelon',    emoji: '🍉', mass: 5.0,   dragCoeff: 0.3 },
  { name: 'Feather',       emoji: '🪶', mass: 0.003, dragCoeff: 5.0 },
  { name: 'Basketball',    emoji: '🏀', mass: 0.6,   dragCoeff: 0.6 },
  { name: 'Hammer',        emoji: '🔨', mass: 1.0,   dragCoeff: 0.15 },
  { name: 'Book',          emoji: '📕', mass: 0.5,   dragCoeff: 0.8 },
  { name: 'Rock',          emoji: '🪨', mass: 3.0,   dragCoeff: 0.1 },
  { name: 'Balloon',       emoji: '🎈', mass: 0.005, dragCoeff: 8.0 },
];

function findObject(name?: string, mass?: number): ObjectTemplate {
  if (name) {
    const match = OBJECT_LIBRARY.find(
      o => o.name.toLowerCase() === name.toLowerCase(),
    );
    if (match) return match;
  }
  if (mass != null) {
    // Find closest by mass
    let best = OBJECT_LIBRARY[0];
    let bestDiff = Math.abs(best.mass - mass);
    for (const o of OBJECT_LIBRARY) {
      const diff = Math.abs(o.mass - mass);
      if (diff < bestDiff) { best = o; bestDiff = diff; }
    }
    return best;
  }
  return OBJECT_LIBRARY[Math.floor(Math.random() * OBJECT_LIBRARY.length)];
}

// ============================================================================
// GEMINI SCHEMA — flat object fields to avoid nested array issues
// ============================================================================

const gravityDropTowerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Engaging title for the gravity drop activity',
    },
    description: {
      type: Type.STRING,
      description: 'What students will learn about gravity and falling',
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Unique ID (e.g., "c1")' },
          type: {
            type: Type.STRING,
            enum: ['observe', 'predict', 'compare', 'measure', 'calculate'],
            description: 'Challenge type',
          },
          instruction: {
            type: Type.STRING,
            description: 'Setup instruction. Do NOT reveal the answer.',
          },
          question: {
            type: Type.STRING,
            description: 'The MC question to answer.',
          },
          height: {
            type: Type.NUMBER,
            description: 'Drop height in meters (2-50)',
          },
          airResistance: {
            type: Type.BOOLEAN,
            description: 'Whether air resistance is enabled',
          },
          // Object 1 (always present)
          obj0Name: {
            type: Type.STRING,
            description: 'Object 1 name. MUST be one of: Marble, Tennis Ball, Baseball, Brick, Bowling Ball, Watermelon, Feather, Basketball, Hammer, Book, Rock, Balloon',
          },
          obj0Mass: {
            type: Type.NUMBER,
            description: 'Object 1 mass in kg',
          },
          // Object 2 (for predict/compare with 2 objects)
          obj1Name: {
            type: Type.STRING,
            description: 'Object 2 name (for 2-object challenges). Same name list as obj0.',
          },
          obj1Mass: {
            type: Type.NUMBER,
            description: 'Object 2 mass in kg (for 2-object challenges)',
          },
          correctAnswer: {
            type: Type.STRING,
            description: 'The correct answer',
          },
          distractor0: {
            type: Type.STRING,
            description: 'First wrong answer',
          },
          distractor1: {
            type: Type.STRING,
            description: 'Second wrong answer',
          },
          hint: {
            type: Type.STRING,
            description: 'Pedagogical hint that guides without giving the answer',
          },
        },
        required: [
          'id', 'type', 'instruction', 'question', 'height', 'airResistance',
          'obj0Name', 'obj0Mass', 'correctAnswer', 'distractor0', 'distractor1', 'hint',
        ],
      },
    },
  },
  required: ['title', 'description', 'challenges'],
};

// ============================================================================
// GRADE CONFIGURATION
// ============================================================================

const GRADE_CONFIGS: Record<string, { numChallenges: number; guidance: string }> = {
  K: {
    numChallenges: 3,
    guidance: 'Observe only. "Drop the ball — did it go UP or DOWN?" Super simple language. 1 object per challenge.',
  },
  '1': {
    numChallenges: 4,
    guidance: 'Observe + predict. "Which falls first — the bowling ball or the feather?" Start busting the misconception. No air resistance for most.',
  },
  '2': {
    numChallenges: 4,
    guidance: 'Predict + compare. Two objects of very different mass, same height, no air. "They land together!" Then toggle air on.',
  },
  '3': {
    numChallenges: 5,
    guidance: 'Predict + compare. Vary heights. "Does dropping from higher take longer?" Air resistance comparisons.',
  },
  '4': {
    numChallenges: 5,
    guidance: 'Compare + measure. Read fall times. "From 5m it took 1.0s. From 20m it took 2.0s. Did doubling height double the time?"',
  },
  '5': {
    numChallenges: 5,
    guidance: 'Measure challenges. Discover that time grows with √height, not linearly. Start introducing the concept of acceleration.',
  },
  '6': {
    numChallenges: 5,
    guidance: 'Measure + calculate. Introduce h = ½gt². Simple calculations: "From 5m, how long to fall?"',
  },
  '7': {
    numChallenges: 6,
    guidance: 'Calculate. Use h = ½gt² and v = gt. Find fall time, impact velocity. Heights 5-30m.',
  },
  '8': {
    numChallenges: 6,
    guidance: 'Calculate. More complex: "What height gives a 3-second fall?" Rearrange formula. Impact velocity.',
  },
};

// ============================================================================
// GENERATOR FUNCTION
// ============================================================================

type GravityDropTowerConfig = Partial<{
    targetEvalMode?: string;
    /** Per-component support tier from the manifest ('easy'|'medium'|'hard'). Second axis: difficulty = how much scaffolding within the mode. NEVER changes numbers. */
    difficulty?: string;
  }>;

export const generateGravityDropTower = async (
  ctx: GenerationContext,
): Promise<GravityDropTowerData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as GravityDropTowerConfig;
  // Per-primitive intent: the SPECIFIC objective the manifest assigned to THIS card.
  // Steers the authored title/description/instruction/question wording only — the
  // objects and grade-config numbers are code-picked (see OBJECT_LIBRARY / GRADE_CONFIGS).
  const intent = ctx.intent || "";
  const intentFocus = intent
    ? `

LEARNING FOCUS: The broad subject is "${topic}", but THIS activity must specifically target "${intent}".
Foreground this focus in the title, description, and each challenge's instruction/question wording.
Do not reveal the answer to any challenge the student will be asked.`
    : "";
  // Parse grade
  const gradeMatch = gradeLevel.match(/grade\s*(\d+|K)/i)?.[1]?.toUpperCase() || '3';
  const validGrades = Object.keys(GRADE_CONFIGS);
  const finalGrade = validGrades.includes(gradeMatch) ? gradeMatch : '3';
  const gradeConfig = GRADE_CONFIGS[finalGrade] || GRADE_CONFIGS['3'];

  // Resolve eval mode
  const evalConstraint = resolveEvalModeConstraint(
    'gravity-drop-tower',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(
        gravityDropTowerSchema,
        evalConstraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
      )
    : gravityDropTowerSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // ── Within-mode support tier (config.difficulty): scaffolding level, NOT numbers.
  //    pinnedType drives the prompt TONE only (a single pinned mode); the actual
  //    withdrawal is applied deterministically per challenge below from each
  //    challenge's OWN type, so a blended/auto session gets difficulty too. ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType: DropChallengeType | undefined =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as DropChallengeType)
      : undefined;
  const tierScaffold = pinnedType && supportTier ? resolveSupportStructure(pinnedType, supportTier) : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  const prompt = `
Create a Gravity Drop Tower activity for Grade ${finalGrade} students about gravity and falling objects.

Topic: ${topic}
Grade Guidance: ${gradeConfig.guidance}

THE KEY PHYSICS CONCEPT:
WITHOUT air resistance, ALL objects fall at the SAME rate regardless of mass.
A bowling ball and a feather dropped in a vacuum land at the SAME time.
This is the #1 misconception — most students (and adults!) think heavier = faster.
WITH air resistance, shape/drag coefficient matters — a feather floats, a rock plummets.

${challengeTypeSection}
${tierSection}${intentFocus}

Available objects (use EXACT names for obj0Name / obj1Name):
- Marble (0.01kg, low drag), Tennis Ball (0.06kg, medium drag)
- Baseball (0.15kg, medium drag), Brick (2kg, low drag)
- Bowling Ball (7kg, very low drag), Watermelon (5kg, medium drag)
- Feather (0.003kg, very high drag), Basketball (0.6kg, medium-high drag)
- Hammer (1kg, low drag), Book (0.5kg, high drag)
- Rock (3kg, very low drag), Balloon (0.005kg, extremely high drag)

For PREDICT challenges: use 2 objects with very different masses (e.g., Bowling Ball vs Feather).
For COMPARE challenges: vary heights OR toggle air resistance.
For MEASURE challenges: use heights where fall times are clean (e.g., 5m ≈ 1.01s, 20m ≈ 2.02s).
For CALCULATE challenges: use h = ½(9.8)t² → t = √(2h/9.8). Give height, ask for time.

IMPORTANT:
- obj0Name MUST be from the exact list above
- For 2-object challenges, include obj1Name and obj1Mass
- For 1-object challenges, omit obj1Name and obj1Mass
- NEVER reveal the answer in instruction or question text
- airResistance should be false for most challenges (the key insight is about NO air)
- Use airResistance=true only for explicit comparisons

Generate ${gradeConfig.numChallenges} challenges.
`;

  logEvalModeResolution('GravityDropTower', config?.targetEvalMode, evalConstraint);

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
    const challenges: (DropChallenge | null)[] = (raw.challenges || []).map((c: any, i: number) => {
      let type = c.type as DropChallengeType;

      // Force type into allowed set
      if (allowedTypes && !allowedTypes.includes(type)) {
        type = allowedTypes[0] as DropChallengeType;
      }

      // Validate required MC fields
      if (!c.instruction || !c.question || !c.correctAnswer || !c.distractor0 || !c.distractor1) {
        console.warn(`[GravityDropTower] Rejecting challenge ${i}: missing required fields`);
        rejectedCount++;
        return null;
      }

      // Reconstruct objects from flat fields
      const obj0 = findObject(c.obj0Name, c.obj0Mass);
      const objects: DropObject[] = [{
        name: obj0.name,
        emoji: obj0.emoji,
        mass: obj0.mass,
        dragCoeff: obj0.dragCoeff,
      }];

      // Second object if present
      if (c.obj1Name) {
        const obj1 = findObject(c.obj1Name, c.obj1Mass);
        objects.push({
          name: obj1.name,
          emoji: obj1.emoji,
          mass: obj1.mass,
          dragCoeff: obj1.dragCoeff,
        });
      }

      // For predict type, MUST have 2 objects
      if (type === 'predict' && objects.length < 2) {
        // Add a contrasting object
        const contrast = obj0.mass > 1
          ? findObject('Feather')
          : findObject('Bowling Ball');
        objects.push({
          name: contrast.name,
          emoji: contrast.emoji,
          mass: contrast.mass,
          dragCoeff: contrast.dragCoeff,
        });
      }

      const height = Math.max(2, Math.min(50, c.height || 10));

      const challenge: DropChallenge = {
        id: c.id || `c${i + 1}`,
        type,
        instruction: c.instruction,
        objects,
        height,
        airResistance: !!c.airResistance,
        question: c.question,
        correctAnswer: c.correctAnswer,
        distractor0: c.distractor0,
        distractor1: c.distractor1,
        hint: c.hint || 'Think about what gravity does to ALL objects equally!',
      };

      if (c.distractor2) {
        challenge.distractor2 = c.distractor2;
      }

      return challenge;
    });

    const validChallenges = challenges.filter((c): c is DropChallenge => c !== null);

    if (rejectedCount > 0) {
      console.warn(`[GravityDropTower] Rejected ${rejectedCount}/${challenges.length} challenges`);
    }

    if (validChallenges.length === 0) {
      console.error('[GravityDropTower] All challenges rejected — using fallback');
      return applySupportTier(buildFallback(finalGrade, config?.targetEvalMode), supportTier, pinnedType);
    }

    return applySupportTier(
      {
        title: raw.title || 'Gravity Drop Tower',
        description: raw.description || 'Discover how gravity makes things fall!',
        challenges: validChallenges,
      },
      supportTier,
      pinnedType,
    );
  } catch (error) {
    console.error('Error generating GravityDropTower content:', error);
    return applySupportTier(buildFallback(finalGrade, config?.targetEvalMode), supportTier, pinnedType);
  }
};

// ============================================================================
// SUPPORT-TIER APPLICATION (deterministic, per-challenge, AFTER all fixups)
// ============================================================================

/**
 * Withdraw on-screen / instructional scaffolding per the support tier. Display
 * lever (showReadouts) and the tutor channel (supportTier) only — NEVER touches
 * the objects, height, airResistance, question, or correctAnswer. Resolves the
 * scaffold from EACH challenge's OWN type so blended sessions get difficulty too.
 * Gated solely on supportTier being present (never on a single pinned mode).
 */
function applySupportTier(
  data: GravityDropTowerData,
  supportTier: SupportTier | null,
  pinnedType: DropChallengeType | undefined,
): GravityDropTowerData {
  if (!supportTier) return data;
  for (const ch of data.challenges) {
    const sc = resolveSupportStructure(ch.type, supportTier);
    // #1 perception lever — the only display field; the answer never reads it.
    ch.showReadouts = sc.showReadouts;
  }
  // Tutor channel: surface the tier so the live tutor's reveal policy is
  // scaffolding-aware (does not re-name a strategy the instruction withheld).
  data.supportTier = supportTier;
  console.log(`[gravity-drop-tower] Support tier "${supportTier}" applied per-challenge (${pinnedType ? 'single-mode ' + pinnedType : 'blended'})`);
  return data;
}

// ============================================================================
// FALLBACK
// ============================================================================

function buildFallback(grade: string, targetEvalMode?: string): GravityDropTowerData {
  const mode = (targetEvalMode || 'observe') as DropChallengeType;
  const challenges: DropChallenge[] = [];

  if (mode === 'observe' || !targetEvalMode) {
    challenges.push({
      id: 'f1',
      type: 'observe',
      instruction: 'Drop the bowling ball from the top of the tower.',
      objects: [{ name: 'Bowling Ball', emoji: '🎳', mass: 7.0, dragCoeff: 0.1 }],
      height: 10,
      airResistance: false,
      question: 'What happened when you dropped the bowling ball?',
      correctAnswer: 'It fell straight down to the ground',
      distractor0: 'It floated in the air',
      distractor1: 'It went sideways',
      hint: 'Gravity pulls everything DOWN toward the ground!',
    });
    challenges.push({
      id: 'f2',
      type: 'observe',
      instruction: 'Now drop the feather from the same height.',
      objects: [{ name: 'Feather', emoji: '🪶', mass: 0.003, dragCoeff: 5.0 }],
      height: 10,
      airResistance: false,
      question: 'Without air resistance, how does the feather fall compared to the bowling ball?',
      correctAnswer: 'It falls at the same speed — they would land together!',
      distractor0: 'The feather falls much slower',
      distractor1: 'The feather floats and never lands',
      hint: 'Without air to slow it down, gravity pulls the feather just as hard!',
    });
  }

  if (mode === 'predict') {
    challenges.push({
      id: 'f1',
      type: 'predict',
      instruction: 'A bowling ball and a feather are dropped at the same time from 10 meters. There is NO air resistance.',
      objects: [
        { name: 'Bowling Ball', emoji: '🎳', mass: 7.0, dragCoeff: 0.1 },
        { name: 'Feather', emoji: '🪶', mass: 0.003, dragCoeff: 5.0 },
      ],
      height: 10,
      airResistance: false,
      question: 'Which one lands first?',
      correctAnswer: 'They land at the same time!',
      distractor0: 'The bowling ball lands first because it is heavier',
      distractor1: 'The feather lands first because it is lighter',
      hint: 'Without air resistance, gravity pulls everything equally — mass does not matter!',
    });
    challenges.push({
      id: 'f2',
      type: 'predict',
      instruction: 'Now the SAME two objects are dropped WITH air resistance turned on.',
      objects: [
        { name: 'Bowling Ball', emoji: '🎳', mass: 7.0, dragCoeff: 0.1 },
        { name: 'Feather', emoji: '🪶', mass: 0.003, dragCoeff: 5.0 },
      ],
      height: 10,
      airResistance: true,
      question: 'With air resistance, which lands first now?',
      correctAnswer: 'The bowling ball lands first — air slows the feather',
      distractor0: 'They still land at the same time',
      distractor1: 'The feather lands first',
      hint: 'Air pushes against things as they fall. Flat, light things get slowed down the most!',
    });
  }

  if (mode === 'compare') {
    challenges.push({
      id: 'f1',
      type: 'compare',
      instruction: 'Drop a rock from 5 meters and from 20 meters. No air resistance.',
      objects: [{ name: 'Rock', emoji: '🪨', mass: 3.0, dragCoeff: 0.1 }],
      height: 20,
      airResistance: false,
      question: 'How does the fall time from 20m compare to 5m?',
      correctAnswer: 'It takes about twice as long from 20m (not 4x)',
      distractor0: 'It takes exactly 4 times as long',
      distractor1: 'It takes the same time regardless of height',
      hint: 'Higher up means longer fall, but the relationship is not simple doubling!',
    });
  }

  if (mode === 'measure') {
    challenges.push({
      id: 'f1',
      type: 'measure',
      instruction: 'Drop the baseball from 5 meters. Watch the timer carefully.',
      objects: [{ name: 'Baseball', emoji: '⚾', mass: 0.15, dragCoeff: 0.4 }],
      height: 5,
      airResistance: false,
      question: 'Approximately how long did it take to fall 5 meters?',
      correctAnswer: 'About 1.0 second',
      distractor0: 'About 0.5 seconds',
      distractor1: 'About 2.0 seconds',
      hint: 'From 5 meters, objects fall for about 1 second. Try using the timer!',
    });
  }

  if (mode === 'calculate') {
    challenges.push({
      id: 'f1',
      type: 'calculate',
      instruction: 'A rock is dropped from 20 meters. Use h = ½gt² where g = 9.8 m/s².',
      objects: [{ name: 'Rock', emoji: '🪨', mass: 3.0, dragCoeff: 0.1 }],
      height: 20,
      airResistance: false,
      question: 'How long does it take to hit the ground? (t = √(2h/g))',
      correctAnswer: 'About 2.02 seconds (t = √(40/9.8) ≈ 2.02)',
      distractor0: 'About 1.0 second',
      distractor1: 'About 4.08 seconds',
      hint: 'Use t = √(2 × 20 / 9.8) = √(40/9.8) = √4.08',
    });
  }

  return {
    title: 'Gravity Drop Tower',
    description: 'Discover how gravity makes things fall!',
    challenges: challenges.length > 0 ? challenges : [{
      id: 'f0',
      type: 'observe',
      instruction: 'Drop the ball and watch!',
      objects: [{ name: 'Baseball', emoji: '⚾', mass: 0.15, dragCoeff: 0.4 }],
      height: 10,
      airResistance: false,
      question: 'What happened?',
      correctAnswer: 'The ball fell down',
      distractor0: 'The ball went up',
      distractor1: 'Nothing happened',
      hint: 'Gravity pulls things down!',
    }],
  };
}
