import { Type, Schema } from "@google/genai";
import { CountingBoardData } from "../../primitives/visual-primitives/math/CountingBoard";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------

type ChallengeType =
  | 'count_all'
  | 'subitize'
  | 'subitize_perceptual'
  | 'count_on'
  | 'group_count'
  | 'compare';

const DEFAULT_INSTANCE_COUNT = 7; // tier fallback (T1 — fast-tap K-1 counting)
const MAX_INSTANCE_COUNT = 8;

const COUNT_BY_MODE: Record<ChallengeType, number> = {
  count_all: 7,
  subitize: 7,
  subitize_perceptual: 7,
  count_on: 5,
  group_count: 5,
  compare: 5,
};

function resolveCount(allowedTypes?: readonly string[]): number {
  // Single-mode session: look up the per-mode count.
  if (allowedTypes && allowedTypes.length === 1) {
    const mode = allowedTypes[0] as ChallengeType;
    const fromTable = COUNT_BY_MODE[mode];
    if (fromTable != null) {
      return Math.max(1, Math.min(MAX_INSTANCE_COUNT, fromTable));
    }
  }
  // Mixed-mode (no eval mode) — fall back to the tier default.
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
  count_all: {
    promptDoc:
      `"count_all": Tap each object one by one. targetAnswer = count. `
      + `Use warm language ("Can you count all the bears? Touch each one!"). `
      + `K: counts 1-20, Grade 1: counts 1-30. Full scaffolding — concrete 1:1 correspondence.`,
    schemaDescription: "'count_all' (tap each to count)",
  },
  subitize: {
    promptDoc:
      `"subitize": Objects are always visible. Student looks and quickly recognizes how many `
      + `without counting one by one, then types their answer. `
      + `Best for small counts (1-5 for K, up to 10 for Grade 1). `
      + `Use encouraging language like "How many do you see right away?"`,
    schemaDescription: "'subitize' (quick visual recognition)",
  },
  subitize_perceptual: {
    promptDoc:
      `"subitize_perceptual": Flash 1-3 objects briefly. Student picks the matching finger-count hand image from 3 options. `
      + `count MUST be 1, 2, or 3. arrangement MUST be 'scattered' or 'groups'. `
      + `Instructions must AVOID numerals — say "How many do you see?" not "Is it 2 or 3?". `
      + `Hints and narration must also AVOID digit characters (0-9). `
      + `Pre-K only. Use very warm language: "Wow! How many?"`,
    schemaDescription: "'subitize_perceptual' (pre-K hand-image answer)",
  },
  count_on: {
    promptDoc:
      `"count_on": Some objects are pre-counted. Student counts the rest and gives total. `
      + `Set startFrom (the known starting count). `
      + `Example: startFrom=5, count=8 means student counts on 3 more from 5. `
      + `targetAnswer = count. Grade 1 only.`,
    schemaDescription: "'count_on' (start from known group)",
  },
  group_count: {
    promptDoc:
      `"group_count": Objects in groups. Use arrangement 'groups' with groupSize of 2, 3, 4, or 5. `
      + `Use only 2-3 groups total (so count = groupSize × numGroups, e.g. 3 groups of 4 = 12). `
      + `targetAnswer = count. Grade 1 only.`,
    schemaDescription: "'group_count' (count by groups)",
  },
  compare: {
    promptDoc:
      `"compare": Two groups visible side by side. "Which has more?" `
      + `MUST use arrangement='groups'. groupSize = the larger group's count. `
      + `count = total of both groups. targetAnswer = the larger group's count. `
      + `The two groups should differ by at least 2 so the difference is visible. Grade 1 only.`,
    schemaDescription: "'compare' (which has more)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode difficulty = structural SUPPORT tier (config.difficulty)
// ---------------------------------------------------------------------------
// The two-field contract (same as ten-frame): config.targetEvalMode says WHICH
// skill (task identity, matched to the objective by the manifest); config.difficulty
// says how much on-workspace SUPPORT the student gets while doing it ('easy' = max
// scaffolding, 'hard' = min). The tier is per-component — the manifest withdraws
// support across Introduce → Visualize → Apply, and personalization routes through
// this field. It NEVER changes the counts: the per-mode count table + grade band
// own those. A harder tier means LESS help tracking the count, never a bigger count.
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
  /** Live "Counted: N / total" tally — the strongest self-check scaffold. */
  showRunningCount: boolean;
  /** Per-object cardinality number tags (which objects are already counted). */
  showLastNumber: boolean;
  /** Pre-segmentation rings for group_count/compare — visually does the grouping. */
  showGroupCircles: boolean;
  /** Forced arrangement for count/subitize ('line' easiest to track/perceive,
   *  'scattered' hardest). null = let the LLM vary it (medium). group_count and
   *  compare own 'groups' structurally, so this never applies to them. */
  arrangement: 'line' | 'scattered' | null;
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-workspace support structure for a tier on a pinned challenge type.
 * Support is withdrawn as the tier hardens; the per-mode lines reframe the SAME
 * task with less scaffolding — never a different task, never bigger counts.
 */
function resolveSupportStructure(pinnedType: ChallengeType, tier: SupportTier): SupportScaffold {
  const showRunningCount = tier === 'easy';
  const showLastNumber = tier !== 'hard';
  const showGroupCircles = tier !== 'hard';
  const arrangement: 'line' | 'scattered' | null =
    tier === 'easy' ? 'line' : tier === 'hard' ? 'scattered' : null;

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-workspace SCAFFOLDING only (${tier === 'easy' ? 'maximum support: the workspace helps the student keep track and self-check' : tier === 'medium' ? 'moderate support: the student tracks the count themselves' : 'minimum support: the student works unaided and explains how they kept track'}). Keep every count within the pedagogical scope and per-mode range; a harder tier NEVER means bigger counts, only less help tracking them.`,
  ];
  switch (pinnedType) {
    case 'count_all':
    case 'count_on':
      promptLines.push(
        tier === 'easy'
          ? 'Arrange the objects in a neat line and keep the running tally and per-object number tags visible so the student can self-check one-to-one as they tap.'
          : tier === 'hard'
            ? 'Scatter the objects and hide the running tally; hints should ask the student to organize their own counting path and explain how they avoided missing or double-counting.'
            : 'Use varied arrangements; the student tracks the count themselves while per-object tags confirm which were already counted.',
      );
      break;
    case 'subitize':
    case 'subitize_perceptual':
      promptLines.push(
        tier === 'easy'
          ? 'Arrange the objects in a clear line or small even cluster so the quantity is easy to perceive at a glance; hints may name the quantity.'
          : tier === 'hard'
            ? 'Scatter the objects in irregular positions; hints should prompt the student to break the set into parts (e.g. "a group of 3 and 2 more") rather than naming the total.'
            : 'Use varied arrangements; hints should point to a recognizable sub-group rather than naming the count.',
      );
      break;
    case 'group_count':
    case 'compare':
      promptLines.push(
        tier === 'easy'
          ? 'Show the grouping rings so each group is visually pre-segmented; the student counts the groups with full visual support.'
          : tier === 'hard'
            ? 'Hide the grouping rings; the student must mentally segment the set and justify how they grouped to reach the total.'
            : 'Show the grouping rings, but the student should find the total before leaning on them.',
      );
      break;
  }
  return { showRunningCount, showLastNumber, showGroupCircles, arrangement, promptLines };
}

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

function buildCountingBoardSchema(count: number): Schema {
  return {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the counting activity (e.g., 'Count the Bears!', 'How Many Stars?')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    objects: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          description: "Object type (theme for all challenges): 'bears', 'apples', 'stars', 'blocks', 'fish', 'butterflies'"
        }
      },
      required: ["type"]
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
            description: "Challenge type: 'count_all' (tap each to count), 'subitize' (quick visual recognition), 'count_on' (start from known group), 'group_count' (count by groups), 'compare' (which has more)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging (e.g., 'Can you count all the bears?')"
          },
          targetAnswer: {
            type: Type.NUMBER,
            description: "The correct answer — must equal count for this challenge"
          },
          count: {
            type: Type.NUMBER,
            description: "Number of objects for this challenge (1-30). Vary across challenges for progression. K: 1-20, Grade 1: 1-30."
          },
          arrangement: {
            type: Type.STRING,
            description: "How objects are arranged for this challenge: 'scattered' (random, harder), 'line' (in a row, easier), 'groups' (clustered), 'circle' (ring pattern). Vary across challenges."
          },
          groupSize: {
            type: Type.NUMBER,
            description: "For 'groups' arrangement: objects per group (e.g., 5 for counting by 5s). Required when arrangement is 'groups'."
          },
          startFrom: {
            type: Type.NUMBER,
            description: "For count_on challenges: the known starting count. Student counts on from here."
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after 2+ incorrect attempts"
          },
          narration: {
            type: Type.STRING,
            description: "AI narration for this challenge (used by the tutor to introduce it)"
          }
        },
        required: ["id", "type", "instruction", "targetAnswer", "count", "arrangement", "hint", "narration"]
      },
      description: `Array of exactly ${count} progressive challenges, each with its own count and arrangement`
    },
    showOptions: {
      type: Type.OBJECT,
      properties: {
        showRunningCount: {
          type: Type.BOOLEAN,
          description: "Show the running count as student taps objects"
        },
        showGroupCircles: {
          type: Type.BOOLEAN,
          description: "Show visual grouping circles (for group counting)"
        },
        highlightOnTap: {
          type: Type.BOOLEAN,
          description: "Highlight objects when tapped/counted"
        },
        showLastNumber: {
          type: Type.BOOLEAN,
          description: "Show the count number on each counted object (cardinality emphasis)"
        }
      },
      required: ["showRunningCount", "showGroupCircles", "highlightOnTap", "showLastNumber"]
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' for Kindergarten, '1' for Grade 1"
    }
  },
  required: ["title", "description", "objects", "challenges", "showOptions", "gradeBand"]
  };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate counting board data for interactive counting activities
 *
 * Grade-aware content:
 * - Early K: count 1-5, scattered/line, count_all only
 * - Mid K: subitize 1-5 (quick visual recognition), count 1-10
 * - Late K: count to 20, cardinality emphasis
 * - Grade 1: count on, group count by 2s/5s/10s, counts to 30
 *
 * Each challenge has its own count and arrangement for progressive difficulty.
 */
export const generateCountingBoard = async (
  topic: string,
  gradeLevel: string,
  config?: {
    objectType?: string;
    count?: number;
    arrangement?: string;
    groupSize?: number;
    gradeBand?: 'K' | '1';
    challengeTypes?: string[];
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * The second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-workspace scaffolding within it. NEVER changes counts.
     */
    difficulty?: string;
    /**
     * Per-component intent the manifest stamps (e.g. "Count groups up to five").
     * Combined with `topic` to bound the counts: a tighter scope in either string
     * caps every challenge's count. Absent → grade-band defaults stand.
     */
    intent?: string;
  }
): Promise<CountingBoardData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'counting-board',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // For config.challengeTypes without an eval mode, use them as a hint
  const effectiveChallengeTypes = evalConstraint?.allowedTypes ?? config?.challengeTypes;

  // ── Within-mode support tier (only meaningful within ONE pinned mode) ──
  // The eval mode owns WHAT skill; config.difficulty owns how much on-workspace
  // scaffolding within it. A mixed-mode session (no single pinned type) has no
  // single tier surface, so the tier scaffold applies only when exactly one mode
  // is selected.
  const pinnedType =
    evalConstraint?.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as ChallengeType)
      : undefined;
  const supportTier = normalizeSupportTier(config?.difficulty);
  const tierScaffold =
    pinnedType && supportTier ? resolveSupportStructure(pinnedType, supportTier) : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT count size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  // ── Resolve per-mode instance count (§5a tier table) ──
  const targetCount = resolveCount(evalConstraint?.allowedTypes);

  // ── Build mode-constrained schema ──
  const baseSchema = buildCountingBoardSchema(targetCount);
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(baseSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : baseSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // Randomize starting parameters so Gemini doesn't always pick the same counts
  const startCounts = [3, 4, 5, 6, 7, 8];
  const randomStartCount = startCounts[Math.floor(Math.random() * startCounts.length)];
  const arrangements = ['scattered', 'line', 'circle'];
  const randomArrangement = arrangements[Math.floor(Math.random() * arrangements.length)];
  const objectTypes = ['bears', 'apples', 'stars', 'blocks', 'fish', 'butterflies'];
  const randomObject = objectTypes[Math.floor(Math.random() * objectTypes.length)];
  // Randomize count-on parameters: startFrom 3-7, total 2-5 more than startFrom
  const countOnStart = 3 + Math.floor(Math.random() * 5);       // 3-7
  const countOnExtra = 2 + Math.floor(Math.random() * 4);       // 2-5
  const countOnTotal = countOnStart + countOnExtra;              // 5-12

  const intentLine = config?.intent ? `\n- Lesson intent: "${config.intent}"` : '';

  const prompt = `
Create an educational counting board activity for teaching "${topic}" to ${gradeLevel} students.${intentLine}

## TOPIC SCOPE (highest priority — overrides the grade range and any starting-count suggestion below)
The topic is "${topic}"${config?.intent ? ` and the intent is "${config.intent}"` : ''}. If the topic or intent names an upper count bound (e.g. "Counting to 5" → 5, "Numbers within 10" → 10, "Count to twenty" → 20), then EVERY challenge's count MUST be at or below that bound — no exceptions, including the first challenge. The grade level is only the CEILING; a tighter topic bound always wins. When the bound is small, hold the counts at or just below it across the ${targetCount} challenges (repeat/vary near the bound) rather than progressing past it. If the topic implies no specific bound, use the grade-appropriate range below. Do NOT name the bound number inside any student-facing instruction, hint, or narration — it must not reveal the answer.

CONTEXT:
- A counting board is a workspace with countable objects (bears, apples, stars, etc.)
- Students tap/click objects to count them one by one (one-to-one correspondence)
- Key skills: counting, subitizing, cardinality, counting on, grouping
- Each challenge gets its OWN count and arrangement, so the board changes between challenges

${challengeTypeSection}
${tierSection}
${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * Early K: count 1-5 objects, line arrangement, count_all only
  * Mid K: subitize 1-5 (quick visual recognition), count 1-10
  * Late K: count to 20, scattered arrangement (harder), emphasize cardinality
  * Use concrete, fun objects kids love (bears, apples, fish, butterflies)
  * Simple, warm language ("Can you count all the bears? Touch each one!")

- Grade 1 (gradeBand "1"):
  * Count on from a known group (e.g., "There are 5 bears. Count on to find all of them")
  * Group counting by 2s, 5s, 10s (arrangement: groups)
  * Counts up to 30
  * Subitize larger groups (up to 10)
  * Connect counting to addition concepts
` : ''}

COUNT-ON PARAMETERS (if generating count_on challenges):
- For this session use startFrom=${countOnStart} and count=${countOnTotal} (so the student counts on ${countOnExtra} more).

GROUP-COUNT GUIDELINES (if generating group_count challenges):
- Set arrangement to 'groups' and provide groupSize (2, 3, 4, or 5)
- Use only 2-3 groups total (so count = groupSize × numGroups, e.g. 3 groups of 4 = 12)

${(() => {
  const hints: string[] = [];
  if (config?.objectType) hints.push(`- Object type: ${config.objectType}`);
  if (config?.count) hints.push(`- Suggested starting count: ${config.count}`);
  if (config?.arrangement) hints.push(`- Suggested starting arrangement: ${config.arrangement}`);
  if (config?.groupSize) hints.push(`- Group size: ${config.groupSize}`);
  if (config?.gradeBand) hints.push(`- Grade band: ${config.gradeBand}`);
  if (effectiveChallengeTypes) hints.push(`- Challenge types to include: ${effectiveChallengeTypes.join(', ')}`);
  return hints.length > 0 ? `CONFIGURATION HINTS:\n${hints.join('\n')}` : '';
})()}

REQUIREMENTS:
1. Generate exactly ${targetCount} challenges that progress in difficulty
2. IMPORTANT: Each challenge has its own count and arrangement — vary them!
3. Use ${randomObject} as the object theme and a ${randomArrangement} arrangement for the first challenge. For variety, vary the counts across challenges — you may start near ${randomStartCount} and build upward ONLY when the TOPIC SCOPE allows; if the topic's bound is small, keep every count at or below that bound instead of progressing past it
4. Use warm, encouraging instruction text for young children
5. For each challenge, targetAnswer MUST equal that challenge's count
6. Include meaningful hints that guide without giving the answer
7. Include narration text the AI tutor can use
8. Set showOptions:
   - showRunningCount: true for count_all, false for subitize
   - showGroupCircles: true for group_count
   - highlightOnTap: always true
   - showLastNumber: true (emphasizes cardinality)
9. Choose kid-friendly objects that match the topic context
10. objects.type defines the emoji theme for ALL challenges (e.g., 'stars')

Return the complete counting board configuration.
`;

  logEvalModeResolution('CountingBoard', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid counting board data returned from Gemini API');
  }

  // ── Structural validation ──

  // Validation: ensure gradeBand is valid
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  // Validation: ensure object type is valid
  const validTypes = ['bears', 'apples', 'stars', 'blocks', 'fish', 'butterflies', 'custom'];
  if (!validTypes.includes(data.objects?.type)) {
    data.objects = { type: 'stars' };
  }

  // Filter to valid challenge types (safety net — schema enum handles the eval mode case)
  const validChallengeTypes = ['count_all', 'subitize', 'subitize_perceptual', 'count_on', 'group_count', 'compare'];
  const validArrangements = ['scattered', 'line', 'groups', 'circle'];

  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // Clamp to the per-mode target count (§5a) — Gemini may overshoot or undershoot.
  if (Array.isArray(data.challenges) && data.challenges.length > targetCount) {
    data.challenges = data.challenges.slice(0, targetCount);
  }

  // ── Per-challenge validation ──

  for (const challenge of data.challenges) {
    // Validate arrangement
    if (!validArrangements.includes(challenge.arrangement)) {
      challenge.arrangement = 'scattered';
    }

    // group_count: force 2-3 groups of 2-5 objects for reasonable layout
    if (challenge.type === 'group_count') {
      challenge.arrangement = 'groups';
      const validGroupSizes = [2, 3, 4, 5];
      const gs = validGroupSizes.includes(challenge.groupSize)
        ? challenge.groupSize
        : validGroupSizes[Math.floor(Math.random() * validGroupSizes.length)];
      const numGroups = Math.random() < 0.5 ? 2 : 3;
      challenge.groupSize = gs;
      challenge.count = gs * numGroups;
    }

    // compare: force 2 groups with different sizes so one is visibly "more"
    if (challenge.type === 'compare') {
      challenge.arrangement = 'groups';
      // Pick two distinct group sizes (larger 4-8, smaller 2-5, at least 2 apart)
      const larger = 4 + Math.floor(Math.random() * 5);            // 4-8
      const smaller = Math.max(1, larger - 2 - Math.floor(Math.random() * 3)); // at least 2 less
      // groupSize = larger so first group is the big one
      challenge.groupSize = larger;
      challenge.count = larger + smaller;
      challenge.targetAnswer = larger;
    }

    // Validate count
    if (!challenge.count || challenge.count < 1) {
      challenge.count = 5;
    }
    if (data.gradeBand === 'K' && challenge.count > 20) {
      challenge.count = 20;
    }
    if (challenge.count > 30) {
      challenge.count = 30;
    }

    // Pre-K perceptual subitize: clamp count to [1, 3] and constrain arrangement.
    // Also sanitize any digit characters from student-facing strings — the UI
    // contract for this mode is that NO numerals appear anywhere.
    if (challenge.type === 'subitize_perceptual') {
      if (challenge.count < 1) challenge.count = 1;
      if (challenge.count > 3) challenge.count = 3;
      if (challenge.arrangement !== 'scattered' && challenge.arrangement !== 'groups') {
        challenge.arrangement = 'scattered';
      }
      const stripDigits = (s: string) =>
        (s ?? '').replace(/[0-9]/g, '').replace(/\s{2,}/g, ' ').trim() || 'How many do you see?';
      challenge.instruction = stripDigits(challenge.instruction);
      challenge.hint = stripDigits(challenge.hint);
      challenge.narration = stripDigits(challenge.narration);
    }

    // Force targetAnswer = count (except compare, where targetAnswer = larger group)
    if (['count_all', 'group_count', 'count_on', 'subitize', 'subitize_perceptual'].includes(challenge.type)) {
      challenge.targetAnswer = challenge.count;
    }

    // Ensure groupSize exists when arrangement is 'groups'
    if (challenge.arrangement === 'groups' && !challenge.groupSize) {
      challenge.groupSize = Math.min(5, challenge.count);
    }
  }

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'count_all';
    const fallbacks: Record<string, { type: string; count: number; arrangement: string; instruction: string; targetAnswer: number; hint: string; narration: string; groupSize?: number; startFrom?: number }> = {
      count_all: { type: 'count_all', count: 5, arrangement: 'scattered', instruction: `Can you count all the ${data.objects?.type || 'stars'}?`, targetAnswer: 5, hint: 'Touch each one as you count!', narration: "Let's count together! Touch each one as you count." },
      subitize: { type: 'subitize', count: 4, arrangement: 'scattered', instruction: 'How many do you see right away?', targetAnswer: 4, hint: 'Look at the whole group — how many?', narration: "Look carefully — how many do you see without counting?" },
      subitize_perceptual: { type: 'subitize_perceptual', count: 2, arrangement: 'scattered', instruction: 'How many do you see?', targetAnswer: 2, hint: 'Look quickly — how many?', narration: 'Look carefully. How many do you see?' },
      count_on: { type: 'count_on', count: 8, arrangement: 'scattered', instruction: 'There are 5 already. Count on to find the total!', targetAnswer: 8, hint: 'Start from 5 and keep counting: 6, 7, 8...', narration: "Some are already counted. Count on from there!", startFrom: 5 },
      group_count: { type: 'group_count', count: 8, arrangement: 'groups', instruction: 'Count the groups! How many altogether?', targetAnswer: 8, hint: 'Count each group, then add them up!', narration: "Let's count by groups!", groupSize: 4 },
      compare: { type: 'compare', count: 11, arrangement: 'groups', instruction: 'Which group has more?', targetAnswer: 7, hint: 'Count each group and compare!', narration: "Which side has more? Let's find out!", groupSize: 7 },
    };
    console.log(`[CountingBoard] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [{ id: 'c1', ...fallbacks[fallbackType] ?? fallbacks.count_all }];
  }

  // Enable group circles if any challenge uses groups (compare or group_count)
  const hasGroupChallenges = data.challenges.some(
    (c: { type: string }) => c.type === 'compare' || c.type === 'group_count'
  );
  if (hasGroupChallenges && data.showOptions) {
    data.showOptions.showGroupCircles = true;
  }

  // ── Apply the support-tier structure deterministically (code owns the SUPPORT
  // structure; the LLM only chose counts/arrangements). Withdraws scaffolds as the
  // tier hardens — never alters the counts. Runs AFTER the group-circle enable so
  // a 'hard' tier can withdraw the rings. ──
  if (tierScaffold && pinnedType) {
    if (!data.showOptions) {
      data.showOptions = { showRunningCount: true, showGroupCircles: false, highlightOnTap: true, showLastNumber: true };
    }
    data.showOptions.showRunningCount = tierScaffold.showRunningCount;
    data.showOptions.showLastNumber = tierScaffold.showLastNumber;
    // Grouping rings are the support lever for group_count/compare only.
    if (pinnedType === 'group_count' || pinnedType === 'compare') {
      data.showOptions.showGroupCircles = tierScaffold.showGroupCircles;
    }
    // Arrangement is the tracking/perception lever for count + subitize. group_count
    // and compare own 'groups' structurally, so the tier never overrides them.
    if (
      tierScaffold.arrangement &&
      (pinnedType === 'count_all' || pinnedType === 'count_on' ||
        pinnedType === 'subitize' || pinnedType === 'subitize_perceptual')
    ) {
      // subitize_perceptual is clamped to scattered/groups upstream — only relax it
      // toward 'scattered', never to 'line' (its hand-image UI assumes 1-3 scattered).
      const arr = tierScaffold.arrangement;
      for (const ch of data.challenges as Array<{ type: string; arrangement: string }>) {
        if (ch.type !== pinnedType) continue;
        if (pinnedType === 'subitize_perceptual' && arr !== 'scattered') continue;
        ch.arrangement = arr;
      }
    }
    console.log(`[CountingBoard] Support tier "${supportTier}" on mode "${pinnedType}" → runningCount=${data.showOptions.showRunningCount}, lastNumber=${data.showOptions.showLastNumber}, groupCircles=${data.showOptions.showGroupCircles}, arrangement=${tierScaffold.arrangement ?? 'varied'}`);
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[CountingBoard] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  // Apply explicit config overrides
  if (config) {
    if (config.objectType !== undefined) data.objects.type = config.objectType;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
    // count/arrangement/groupSize overrides apply per-challenge as defaults
    if (config.count !== undefined || config.arrangement !== undefined || config.groupSize !== undefined) {
      for (const challenge of data.challenges) {
        if (config.count !== undefined) challenge.count = config.count;
        if (config.arrangement !== undefined) challenge.arrangement = config.arrangement;
        if (config.groupSize !== undefined) challenge.groupSize = config.groupSize;
        // Re-force targetAnswer after override
        if (['count_all', 'group_count', 'count_on', 'subitize'].includes(challenge.type)) {
          challenge.targetAnswer = challenge.count;
        }
      }
    }
  }

  return data;
};
