import { Type, Schema } from "@google/genai";
import { TenFrameData, TenFrameChallenge } from "../../primitives/visual-primitives/math/TenFrame";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModes,
  constrainChallengeTypeEnum,
  buildModeConstraintSection,
  type ChallengeTypeDoc,
} from "../evalMode";
import { resolvePedagogicalScope, buildScopePromptSection } from "../scopeContext";

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------

type ChallengeType = 'build' | 'subitize' | 'make_ten' | 'add' | 'subtract';

const DEFAULT_INSTANCE_COUNT = 7; // tier fallback (T1 — fast-tap K-1 number sense)
const MAX_INSTANCE_COUNT = 8;

const COUNT_BY_MODE: Record<ChallengeType, number> = {
  build: 7,        // T1 bump — fast-tap "place N counters"
  subitize: 7,     // T1 bump — flash & identify
  make_ten: 7,     // T1 bump — closest match to PRD "count_shown" (counters shown, find complement)
  add: 5,          // hold at current (operate mode)
  subtract: 5,     // hold at current (operate mode)
};

function resolveCount(allowedTypes?: string[]): number {
  // Single-call generator: pick the count for the active eval mode's first allowed type.
  // When no eval mode is active (mixed-mode session), fall back to DEFAULT_INSTANCE_COUNT.
  if (allowedTypes && allowedTypes.length > 0) {
    const firstType = allowedTypes[0] as ChallengeType;
    const perMode = COUNT_BY_MODE[firstType];
    if (perMode != null) {
      return Math.max(1, Math.min(MAX_INSTANCE_COUNT, perMode));
    }
  }
  return Math.max(1, Math.min(MAX_INSTANCE_COUNT, DEFAULT_INSTANCE_COUNT));
}

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------
// Each entry provides:
//   promptDoc     — injected into the Gemini prompt (only for allowed types)
//   schemaDescription — concise label for the schema enum description
//
// When an eval mode is active, only the relevant entries are included.
// When no eval mode, all entries are included for mixed-difficulty generation.

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  build: {
    promptDoc:
      `"build": Student places exactly N counters on the frame. targetCount = N. `
      + `Use warm language ("Put 5 counters on the frame!"). `
      + `Numbers 1-7 for K, 1-10 for grades 1-2. Full scaffolding — concrete manipulative.`,
    schemaDescription: "'build' (place counters)",
  },
  subitize: {
    promptDoc:
      `"subitize": Counters flash briefly, student types how many they saw. `
      + `Set flashDuration: 1500-2000ms for K, 1000-1500ms for grades 1-2. `
      + `Numbers 1-5 for K, 1-10 for grades 1-2. Vary arrangements for perceptual fluency.`,
    schemaDescription: "'subitize' (flash and identify count)",
  },
  make_ten: {
    promptDoc:
      `"make_ten": Frame shows some counters, student enters how many more to fill the frame. `
      + `For single frame: make 10. For double frame: make 20. `
      + `targetCount = number of counters ALREADY shown (must be < frame capacity). `
      + `Use varied starting counts (3-8 for single frame). Focus on number bonds to 10.`,
    schemaDescription: "'make_ten' (find complement to 10)",
  },
  add: {
    promptDoc:
      `"add": The frame starts EMPTY — no counters are pre-placed; the student places both addends. `
      + `Provide addend1 and addend2 (both > 0) and set targetCount = addend1 + addend2 (the sum). `
      + `Use numbers that encourage the make-ten strategy (e.g., addend1=8, addend2=5; addend1=7, addend2=6).`,
    schemaDescription: "'add' (addition)",
  },
  subtract: {
    promptDoc:
      `"subtract": Student removes counters from a pre-filled frame. `
      + `MUST set startCount (counters shown initially) AND targetCount (counters remaining). `
      + `Example: startCount=7, targetCount=4 means "start with 7, take away 3, 4 remain". `
      + `startCount MUST be greater than targetCount.`,
    schemaDescription: "'subtract' (subtraction)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode difficulty = structural SUPPORT tier (config.difficulty)
// ---------------------------------------------------------------------------
// The two-field contract: config.evalMode says WHICH skill (task identity,
// matched to the objective by the manifest); config.difficulty says how much
// on-frame SUPPORT the student gets while doing it ('easy' = max scaffolding,
// 'hard' = min). The tier is per-component — the manifest withdraws support
// across Introduce → Visualize → Apply, and personalization routes through this
// field. It NEVER changes the target numbers: the pedagogical scope owns those.
// See memory: structural-difficulty-not-numeric.

type SupportTier = 'easy' | 'medium' | 'hard';

const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/**
 * Read the manifest's support tier. The manifest schema enum-constrains
 * config.difficulty to exactly these values, so this is a STRICT lookup.
 * Unknown/absent → null (no tier applied; grade-band defaults stand).
 */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

interface SupportScaffold {
  /** Numeric count readout under the frame (build/make_ten/operate). */
  showCount: boolean;
  /** Equation display alongside the frame (operate modes). */
  showEquation: boolean;
  /** Subitize flash window (ms) — longer = more support. */
  flashDuration: number;
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-frame support structure for a tier on a pinned challenge type.
 * Support is withdrawn as the tier hardens; the per-mode lines reframe the SAME
 * task with less scaffolding — never a different task, never bigger numbers.
 */
function resolveSupportStructure(pinnedType: ChallengeType, tier: SupportTier): SupportScaffold {
  const flashDuration = tier === 'easy' ? 2000 : tier === 'medium' ? 1500 : 1000;
  const showCount = tier === 'easy';
  const showEquation = tier === 'easy';

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-frame SCAFFOLDING only (${tier === 'easy' ? 'maximum support: the frame helps the student self-check' : tier === 'medium' ? 'moderate support: the student tracks the quantity themselves' : 'minimum support: the student works unaided and justifies their thinking'}). Keep every target number within the pedagogical scope above; a harder tier NEVER means bigger numbers.`,
  ];
  switch (pinnedType) {
    case 'subitize':
      promptLines.push(
        tier === 'easy'
          ? 'Arrange flashed counters in standard ten-frame order (fill row 1 left-to-right, then row 2) so the quantity is easy to recognize. Hints should name the quantity.'
          : tier === 'hard'
            ? 'Scatter flashed counters in irregular, non-standard positions; hints should prompt the student to break the count into parts (e.g. "a full row of 5 and 2 more").'
            : 'Use varied arrangements; hints should point to the row-of-5 anchor rather than naming the count.',
      );
      break;
    case 'build':
    case 'make_ten':
      promptLines.push(
        tier === 'easy'
          ? 'Keep the running count visible so the student can self-check while placing counters; narration names the target.'
          : tier === 'hard'
            ? 'Hide the running count; narration/hints should ask the student to explain or find more than one way to reach the target (e.g. two number bonds that make 10).'
            : 'Hide the running count; the student tracks the quantity themselves while applying the strategy.',
      );
      break;
    case 'add':
    case 'subtract':
      promptLines.push(
        tier === 'easy'
          ? 'Show the equation alongside the frame to connect symbols to counters; narration walks the steps.'
          : tier === 'hard'
            ? 'Hide the equation; narration/hints should ask the student to justify the make-ten strategy or compare two ways to reach the answer.'
            : 'Hide the equation; the student works the operation from the frame alone.',
      );
      break;
  }
  return { showCount, showEquation, flashDuration, promptLines };
}

// ---------------------------------------------------------------------------
// Deterministic instruction synthesis (SP-17)
// ---------------------------------------------------------------------------
// The student-facing prompt is the one field whose numbers must match what the
// frame renders and the component scores. The component owns those numbers
// (targetCount, startCount, addends, frame capacity), so we synthesize the
// instruction from them rather than asking the LLM for a parallel text that can
// drift. Single source of truth → no consistency guard can ever false-negative.

function buildInstruction(ch: TenFrameChallenge, mode: 'single' | 'double'): string {
  const frameTarget = mode === 'double' ? 20 : 10;
  switch (ch.type) {
    case 'build':
      return `Put ${ch.targetCount} counters on the ten frame!`;
    case 'subitize':
      return 'How many counters did you see?';
    case 'make_ten':
      return `There are ${ch.targetCount} counters on the frame. How many more do you need to make ${frameTarget}?`;
    case 'add':
      return `Show ${ch.addend1} + ${ch.addend2} on the frame!`;
    case 'subtract': {
      const remove = (ch.startCount ?? ch.targetCount) - ch.targetCount;
      return `The frame starts with ${ch.startCount} counters. Take away ${remove}. How many are left?`;
    }
    default:
      return `Build ${ch.targetCount} on the ten frame!`;
  }
}

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

function buildTenFrameSchema(count: number): Schema {
  return {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the ten frame activity (e.g., 'Building Numbers to 10', 'Make Ten!')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    mode: {
      type: Type.STRING,
      description: "Frame mode: 'single' for one 2x5 frame (numbers 0-10), 'double' for two frames (numbers 0-20)"
    },
    counters: {
      type: Type.OBJECT,
      properties: {
        count: {
          type: Type.NUMBER,
          description: "Initial number of counters to place (usually 0 for build challenges)"
        },
        color: {
          type: Type.STRING,
          description: "Counter color: 'red', 'yellow', 'blue', or 'green'"
        },
        positions: {
          type: Type.ARRAY,
          items: { type: Type.NUMBER },
          description: "Initial counter positions (0-9 for single, 0-19 for double). Usually empty array for build challenges."
        }
      },
      required: ["count", "color", "positions"]
    },
    twoColorMode: {
      type: Type.OBJECT,
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description: "Whether two-color decomposition is active"
        },
        color1Count: {
          type: Type.NUMBER,
          description: "Number of counters in color 1"
        },
        color2Count: {
          type: Type.NUMBER,
          description: "Number of counters in color 2"
        },
        color1: {
          type: Type.STRING,
          description: "First counter color"
        },
        color2: {
          type: Type.STRING,
          description: "Second counter color"
        }
      },
      required: ["enabled", "color1Count", "color2Count", "color1", "color2"]
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID (e.g., 'c1', 'c2')"
          },
          type: {
            type: Type.STRING,
            description: "Challenge type: 'build' (place counters), 'subitize' (flash and identify count), 'make_ten' (find complement to 10), 'add' (addition), 'subtract' (subtraction)"
          },
          targetCount: {
            type: Type.NUMBER,
            description: "Target number for this challenge (0-10 for single, 0-20 for double)"
          },
          startCount: {
            type: Type.NUMBER,
            description: "For subtract challenges: how many counters are pre-filled on the frame before removal. E.g. startCount=7, targetCount=4 means 'start with 7, take away 3, 4 remain'."
          },
          addend1: {
            type: Type.NUMBER,
            description: "For 'add' challenges only: the first addend. Must be > 0 and addend1 + addend2 = targetCount (e.g., addend1=8, addend2=5, targetCount=13)."
          },
          addend2: {
            type: Type.NUMBER,
            description: "For 'add' challenges only: the second addend. Must be > 0 and addend1 + addend2 = targetCount."
          },
          flashDuration: {
            type: Type.NUMBER,
            description: "Duration in ms for subitize flash (e.g., 1500). Only used for subitize challenges."
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after 2+ incorrect attempts"
          },
          narration: {
            type: Type.STRING,
            description: "AI narration for this challenge (used by the tutor to introduce the challenge)"
          }
        },
        required: ["id", "type", "targetCount", "hint", "narration"]
      },
      description: `Array of exactly ${count} progressive challenges`
    },
    showOptions: {
      type: Type.OBJECT,
      properties: {
        showCount: {
          type: Type.BOOLEAN,
          description: "Show counter count below the frame"
        },
        showEquation: {
          type: Type.BOOLEAN,
          description: "Show equation representation (for add/subtract)"
        },
        showEmptyCount: {
          type: Type.BOOLEAN,
          description: "Show the number of empty spaces"
        },
        allowFlip: {
          type: Type.BOOLEAN,
          description: "Allow flipping counter colors"
        }
      },
      required: ["showCount", "showEquation", "showEmptyCount", "allowFlip"]
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' for Kindergarten, '1-2' for Grades 1-2"
    }
  },
  required: ["title", "description", "mode", "counters", "challenges", "showOptions", "gradeBand"]
  };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type TenFrameConfig = {
  mode?: 'single' | 'double';
  gradeBand?: 'K' | '1-2';
  challengeTypes?: string[];
  counterColor?: string;
  twoColorEnabled?: boolean;
  /**
   * Eval mode that pins which challenge types to generate. Set by the MANIFEST
   * (curator matches the mode to the objective) and by the eval-test tester —
   * both write this single field. Resolved through the catalog constraint.
   */
  targetEvalMode?: string;
  /** Intent from the manifest item. */
  intent?: string;
  /** Learning objective this component serves (injected by flattenManifestToLayout). */
  objectiveText?: string;
  /**
   * Bloom's verb for the objective (injected by flattenManifestToLayout).
   * Scope context only — surfaced as the COGNITIVE LEVEL line in the prompt.
   * NOT the difficulty source: config.difficulty owns the support tier.
   */
  objectiveVerb?: string;
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * The second axis of the two-field contract: evalMode = which skill,
   * difficulty = how much on-frame scaffolding within it.
   */
  difficulty?: string;
};

export const generateTenFrame = async (ctx: GenerationContext): Promise<TenFrameData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config: TenFrameConfig = { ...(ctx.raw as TenFrameConfig), intent: ctx.intent };
  // ── Resolve eval mode(s): single | curated blend | mixed ──
  // An explicit config.targetEvalMode (tester / curator) pins exactly that mode
  // with NO LLM call. Otherwise the generator resolves its OWN mode set from the
  // component intent via a flash-lite enum micro-call scoped to ten-frame's modes
  // (see resolveEvalModes). null = genuine mixed → schema left unconstrained.
  const resolution = await resolveEvalModes(
    'ten-frame',
    { targetEvalMode: config?.targetEvalMode, intent: config?.intent, objectiveText: config?.objectiveText },
    CHALLENGE_TYPE_DOCS,
  );
  const allowedTypes = resolution?.allowedTypes;

  // For config.challengeTypes without a resolved mode, use them as a hint.
  const effectiveChallengeTypes = allowedTypes ?? config?.challengeTypes;

  // ── Within-mode support tier (only meaningful within ONE pinned mode) ──
  // The eval mode owns WHAT skill; config.difficulty owns how much on-frame
  // scaffolding within it. A curated BLEND has no single tier surface, so the
  // tier scaffold applies only when exactly one mode is selected.
  const pinnedType = allowedTypes?.[0] as ChallengeType | undefined;
  const supportTier = normalizeSupportTier(config?.difficulty);
  const tierScaffold =
    resolution && resolution.modes.length === 1 && pinnedType && supportTier
      ? resolveSupportStructure(pinnedType, supportTier)
      : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number size)\n${tierScaffold.promptLines.map((l: string) => `- ${l}`).join('\n')}\n`
    : '';

  // ── Resolve per-mode instance count (PRD §5a) ──
  const count = resolveCount(allowedTypes);

  // ── Build mode-constrained schema ──
  // When mode(s) are resolved, the schema enum restricts challenge.type to the
  // union of the selected modes' types so Gemini *cannot* produce others.
  const baseSchema = buildTenFrameSchema(count);
  const activeSchema = resolution
    ? constrainChallengeTypeEnum(baseSchema, resolution.allowedTypes, CHALLENGE_TYPE_DOCS)
    : baseSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildModeConstraintSection(resolution, CHALLENGE_TYPE_DOCS);

  // ── Pedagogical scope — binds output to the lesson objective (topic wins over grade band) ──
  const scope = resolvePedagogicalScope(topic, config, config?.intent);
  const scopeSection = buildScopePromptSection(scope);

  const prompt = `
Create an educational ten frame activity for teaching "${topic}" to ${gradeLevel} students.
${scopeSection}
CONTEXT:
- A ten frame is a 2×5 rectangular grid used to build number sense
- Students place counters (colored circles) on the grid to represent numbers
- Key skills: subitizing (instant recognition), composing/decomposing numbers, making 10
- The frame makes the relationship to 5 and 10 highly visible

${challengeTypeSection}
${tierSection}
${!resolution ? `
GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * Build challenges with numbers 1-10 (single frame)
  * Subitize flash with numbers 1-5 (short flash durations, 1500-2000ms)
  * Two-color decomposition (e.g., 3 red + 4 yellow = 7)
  * Focus on "how many?" and "how many more to make 5/10?"
  * Use single frame mode ONLY
  * Simple, encouraging language ("Put 4 counters on the frame!")

- Grades 1-2 (gradeBand "1-2"):
  * Make-ten challenges (given some counters, find the complement to 10)
  * Addition using double frames (e.g., 8 + 5 = 13)
  * Subtraction with counters (start with N, remove some)
  * Subitize with larger numbers (up to 10), faster flash (1000-1500ms)
  * Can use double frame for numbers 11-20
  * Build on make-ten strategy for mental math
` : ''}

SUBTRACTION GUIDELINES (if generating subtract challenges):
- Always include startCount for subtract challenges (it controls how many counters appear)
- Use numbers within 10 for single frame (startCount ≤ 10)
- startCount MUST be greater than targetCount (the student removes startCount − targetCount counters)

${(() => {
  const hints: string[] = [];
  if (config?.mode) hints.push(`- Frame mode: ${config.mode}`);
  if (config?.gradeBand) hints.push(`- Grade band: ${config.gradeBand}`);
  if (effectiveChallengeTypes) hints.push(`- Challenge types to include: ${effectiveChallengeTypes.join(', ')}`);
  if (config?.counterColor) hints.push(`- Counter color: ${config.counterColor}`);
  if (config?.twoColorEnabled) hints.push(`- Two-color decomposition: enabled`);
  return hints.length > 0 ? `CONFIGURATION HINTS:\n${hints.join('\n')}` : '';
})()}

IMPORTANT — NO INSTRUCTION TEXT:
Do NOT write any student-facing instruction text. The app generates the on-screen prompt
deterministically from the numeric fields (type, targetCount, startCount, addend1/addend2),
so the displayed problem always matches what the frame shows. Your job is to choose
pedagogically sound NUMBERS, not to phrase the question. Topic flavor lives in title/description.

REQUIREMENTS:
1. Generate exactly ${count} challenges that progress in difficulty
2. Start with easier challenges and build up
3. For 'add' challenges, provide addend1 and addend2 (both > 0) whose sum equals targetCount
4. Set initial counter count and positions to 0/empty for build challenges
5. For subitize challenges, use flashDuration between 1000-2000ms
6. For make_ten challenges, targetCount should be the number of counters ALREADY on the frame (must be less than frame capacity: <10 for single, <20 for double)
7. Include meaningful hints that guide without giving the answer
8. Include narration text the AI tutor can use to introduce each challenge
9. For Kindergarten: stick to single frame, numbers 1-10, build and subitize only
10. For Grades 1-2: can include make_ten, add, subtract, and double frame
11. Set showOptions appropriately:
    - showCount: true for build challenges, false for subitize
    - showEmptyCount: false for make_ten (showing empty count leaks the complement answer)
    - showEquation: true for add/subtract

Return the complete ten frame configuration.
`;

  console.log(
    `[TenFrame] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join('+')} (${resolution.source})` : 'mixed'} → types [${(allowedTypes ?? ['all']).join(', ')}]`,
  );

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
    throw new Error('No valid ten frame data returned from Gemini API');
  }

  // ── Structural validation (mode, gradeBand, counters) ──

  if (data.mode !== 'single' && data.mode !== 'double') {
    data.mode = 'single';
  }

  if (data.gradeBand !== 'K' && data.gradeBand !== '1-2') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1-2';
  }

  if (data.gradeBand === 'K' && data.mode === 'double') {
    data.mode = 'single';
  }

  // make_ten is pedagogically "complement to 10" — the catalog label/beta and the tutor
  // scaffold all assume a single 10-frame. Pin it to single frame here (and again after
  // config overrides). A double-frame "make 20" is a different skill → separate eval mode.
  const isMakeTenEvalMode =
    resolution?.allowedTypes.length === 1 && resolution.allowedTypes[0] === 'make_ten';
  if (isMakeTenEvalMode) {
    data.mode = 'single';
  }

  // Filter to valid challenge types (safety net — schema enum handles the eval mode case)
  const validTypes = ['build', 'subitize', 'make_ten', 'add', 'subtract'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validTypes.includes(c.type)
  );

  // Clamp to the per-mode instance count (PRD §5a) — Gemini occasionally returns more.
  if (Array.isArray(data.challenges) && data.challenges.length > count) {
    data.challenges = data.challenges.slice(0, count);
  }

  // ── Domain-specific validation ──

  // Validate subtract challenges: ensure startCount is present and sensible
  for (const ch of data.challenges as Array<{ type: string; startCount?: number; targetCount: number; instruction: string }>) {
    if (ch.type === 'subtract') {
      const maxCount = data.mode === 'double' ? 20 : 10;
      if (ch.startCount == null || ch.startCount <= 0) {
        ch.startCount = Math.min(ch.targetCount + 2, maxCount);
      }
      if (ch.startCount <= ch.targetCount) {
        ch.startCount = Math.min(ch.targetCount + 1, maxCount);
      }
      if (ch.startCount > maxCount) ch.startCount = maxCount;
    }
  }

  // make_ten: keep targetCount within frame capacity so the pre-fill + complement are valid.
  for (const ch of data.challenges as TenFrameChallenge[]) {
    if (ch.type === 'make_ten') {
      const frameTarget = data.mode === 'double' ? 20 : 10;
      if (ch.targetCount < 0 || ch.targetCount >= frameTarget) {
        ch.targetCount = Math.max(1, frameTarget - 3);
      }
    }
  }

  // add: addends are the source of truth; derive targetCount from them. If Gemini
  // omitted or gave inconsistent addends, derive a make-ten-friendly split.
  for (const ch of data.challenges as TenFrameChallenge[]) {
    if (ch.type === 'add') {
      const maxCount = data.mode === 'double' ? 20 : 10;
      const a1 = typeof ch.addend1 === 'number' && ch.addend1 > 0 ? ch.addend1 : null;
      const a2 = typeof ch.addend2 === 'number' && ch.addend2 > 0 ? ch.addend2 : null;
      if (a1 != null && a2 != null && a1 + a2 <= maxCount) {
        ch.targetCount = a1 + a2;
      } else {
        const sum = Math.max(2, Math.min(ch.targetCount || 0, maxCount));
        const second = Math.max(1, Math.min(5, sum - 1));
        ch.addend2 = second;
        ch.addend1 = sum - second;
        ch.targetCount = sum;
      }
    }
  }

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = resolution?.allowedTypes[0] ?? 'build';
    // instruction is synthesized below — these objects only carry the numeric fields.
    const fallbacks: Record<string, Omit<TenFrameChallenge, 'id' | 'instruction'>> = {
      build: { type: 'build', targetCount: 5, hint: 'Fill up one whole row!', narration: "Let's start by building the number 5 on the ten frame." },
      subitize: { type: 'subitize', targetCount: 4, hint: 'Think about how many fit in one row.', narration: "Watch carefully — how many counters flash on the frame?", flashDuration: 1500 },
      make_ten: { type: 'make_ten', targetCount: 6, hint: 'Count the empty spaces!', narration: "Some counters are already here. How many more do we need?" },
      add: { type: 'add', targetCount: 7, addend1: 3, addend2: 4, hint: 'Place 3, then add 4 more.', narration: "Let's add these numbers using the ten frame." },
      subtract: { type: 'subtract', targetCount: 5, startCount: 8, hint: 'Click counters to remove them!', narration: "Let's practice taking away." },
    };
    console.log(`[TenFrame] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [{ id: 'c1', ...fallbacks[fallbackType] ?? fallbacks.build }];
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[TenFrame] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  // Ensure counter positions is an array
  if (!data.counters) {
    data.counters = { count: 0, color: 'red', positions: [] };
  }
  if (!Array.isArray(data.counters.positions)) {
    data.counters.positions = [];
  }

  // Apply explicit config overrides from manifest
  if (config) {
    if (config.mode !== undefined) data.mode = config.mode;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
    if (config.counterColor !== undefined) data.counters.color = config.counterColor;
  }

  // make_ten stays single-frame even if the manifest passed a double-frame override.
  if (isMakeTenEvalMode) data.mode = 'single';

  // ── Apply the support-tier structure deterministically (code owns the SUPPORT
  // structure; the LLM only chose numbers). Withdraws scaffolds as the tier
  // hardens — never alters the target numbers. ──
  if (tierScaffold && pinnedType) {
    if (!data.showOptions) {
      data.showOptions = { showCount: true, showEquation: false, showEmptyCount: false, allowFlip: false };
    }
    // Count readout supports build/make_ten/operate; subitize is flashed, so its
    // count display stays off regardless of tier.
    if (pinnedType !== 'subitize') {
      data.showOptions.showCount = tierScaffold.showCount;
    }
    if (pinnedType === 'add' || pinnedType === 'subtract') {
      data.showOptions.showEquation = tierScaffold.showEquation;
    }
    // make_ten: showing empty spaces leaks the complement — force off at every tier.
    if (pinnedType === 'make_ten') {
      data.showOptions.showEmptyCount = false;
    }
    // subitize: flash window is the support lever.
    if (pinnedType === 'subitize') {
      for (const ch of data.challenges as TenFrameChallenge[]) {
        if (ch.type === 'subitize') ch.flashDuration = tierScaffold.flashDuration;
      }
    }
    console.log(`[TenFrame] Support tier "${supportTier}" on mode "${pinnedType}" → showCount=${data.showOptions.showCount}, showEquation=${data.showOptions.showEquation}, flash=${tierScaffold.flashDuration}`);
  }

  // Synthesize every instruction from the now-final numeric fields. Runs last so it
  // reflects the settled frame mode — the on-screen prompt can never contradict the frame.
  for (const ch of data.challenges as TenFrameChallenge[]) {
    ch.instruction = buildInstruction(ch, data.mode);
  }

  return data;
};
