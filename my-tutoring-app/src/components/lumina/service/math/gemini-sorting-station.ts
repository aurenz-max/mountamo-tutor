import { Type, Schema } from "@google/genai";
import {
  SortingStationData,
  SortingStationChallenge,
  SortingObject,
  SortingCategory,
} from "../../primitives/visual-primitives/math/SortingStation";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ============================================================================
// Eval Mode Docs — one entry per challenge type (kept for eval mode resolution)
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'sort-by-one': {
    promptDoc: `"sort-by-one": Sort objects by ONE visible attribute (color, shape, or size).`,
    schemaDescription: "'sort-by-one' (single-attribute sort)",
  },
  'sort-by-attribute': {
    promptDoc: `"sort-by-attribute": Objects have multiple attributes; student picks how to sort.`,
    schemaDescription: "'sort-by-attribute' (named-property sort)",
  },
  'count-and-compare': {
    promptDoc: `"count-and-compare": Objects are pre-sorted into groups. Student counts and compares.`,
    schemaDescription: "'count-and-compare' (quantify and compare groups)",
  },
  'odd-one-out': {
    promptDoc: `"odd-one-out": A group where one doesn't belong. Student identifies it.`,
    schemaDescription: "'odd-one-out' (identify the exception)",
  },
  'two-attributes': {
    promptDoc: `"two-attributes": Find objects matching TWO attributes simultaneously.`,
    schemaDescription: "'two-attributes' (multi-criterion classification)",
  },
  'tally-record': {
    promptDoc: `"tally-record": Sort objects and record the count of each group using tallies.`,
    schemaDescription: "'tally-record' (sort and tally counts)",
  },
};

type ChallengeType =
  | 'sort-by-one'
  | 'sort-by-attribute'
  | 'count-and-compare'
  | 'odd-one-out'
  | 'two-attributes'
  | 'tally-record';

// ============================================================================
// Within-mode difficulty = structural SUPPORT tier (config.difficulty)
// ============================================================================
// The two-field contract (same as counting-board / ten-frame): config.targetEvalMode
// says WHICH challenge type (task identity, matched to the objective by the manifest);
// config.difficulty says how much on-workspace SUPPORT the student gets while doing it
// ('easy' = max scaffolding, 'hard' = min). The tier is per-component — the manifest
// withdraws support across Introduce → Visualize → Apply, and personalization routes
// through this field.
//
// Sorting-station has BOTH support-tier axes:
//   1. Scaffolding withdrawal (resolveSupportStructure) — live count badges, a pre-placed
//      worked-example "model" item, instruction strategy-naming.
//   2. Structural problem difficulty (resolveProblemShape) — # of objects, # of bins/groups,
//      and distractor closeness (count-gap for compare, # shared attributes for odd-one-out,
//      near-miss ratio for two-attributes). All STRUCTURAL and grade-band-bounded — a harder
//      tier NEVER pushes the object count or bin count past the grade cap (K ≤ 3 bins,
//      G1 ≤ 4 bins; object count stays inside the grade band: K 4-6, G1 5-8).
// See memory: structural-difficulty-not-numeric, llm-window-code-builds-structure.

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
  /** Live per-bin count badges during the sort/count phase — the strongest self-check aid. */
  showCounts: boolean;
  /** Pre-place ONE non-asked worked-example item in its correct bin (sort-family modes only). */
  showModelExample: boolean;
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

interface ProblemShape {
  /** Target object count for this challenge (grade-band-bounded). */
  objectCount: number;
  /** Target number of categories/bins (capped by grade: K ≤ 3, G1 ≤ 4). */
  categoryCount: number;
  /** count-and-compare: minimum count gap between the two groups (≥3 easy → 1 hard). */
  compareGap?: number;
  /** odd-one-out: # of attributes the odd item SHARES with the majority (0 easy → 1+ hard). */
  oddSharedAttrs?: number;
  /** Prompt guidance describing the structural problem shape at this tier. */
  promptLines: string[];
}

/** Grade-band object-count window — the tier picks WITHIN this, never past it. */
function gradeObjectWindow(gradeBand: 'K' | '1'): { min: number; max: number } {
  return gradeBand === 'K' ? { min: 4, max: 6 } : { min: 5, max: 8 };
}

/** Hard cap on bins by grade band (mirrors the maxCategories clamp at the end). */
function gradeBinCap(gradeBand: 'K' | '1'): number {
  return gradeBand === 'K' ? 3 : 4;
}

/**
 * Resolve the on-workspace SCAFFOLDING structure for a tier on a pinned challenge type.
 * Withdraws help as the tier hardens — never changes the task identity, never changes counts.
 *
 * IDENTITY/LEAK GUARDS encoded here:
 * - sort-by-attribute / two-attributes: the category labels / attribute choice ARE the task,
 *   so the model item is NOT offered there (it would pre-name the very attribute being asked).
 * - count-and-compare's phase-2 locked badges are intrinsic and live in the component — this
 *   scaffold only withdraws the LIVE count badge during the counting phase.
 * - odd-one-out's reason is never shown on-screen; no model item, no pre-highlight.
 */
function resolveSupportStructure(pinnedType: ChallengeType, tier: SupportTier): SupportScaffold {
  // Live count badges: full support at easy, withdrawn at medium/hard so the student counts unaided.
  const showCounts = tier === 'easy';

  // Worked-example model item: only the sort-family modes where pre-placing a NON-asked item is
  // a legitimate fade (and does NOT pre-reveal the task). Excluded from sort-by-attribute /
  // two-attributes (label/attribute IS the task) and odd-one-out (never pre-highlight).
  const modelEligible = pinnedType === 'sort-by-one' || pinnedType === 'tally-record';
  const showModelExample = modelEligible && tier === 'easy';

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-workspace SCAFFOLDING level (${tier === 'easy' ? 'maximum support: live count badges help the student self-check, and one worked example is pre-placed where applicable' : tier === 'medium' ? 'moderate support: the student counts and sorts without live badges' : 'minimum support: the student works unaided and justifies how they sorted'}). Keep object counts and group counts within the pedagogical scope and grade band; a harder tier changes problem STRUCTURE (number of distractors, count gap, shared attributes), NEVER raw magnitude beyond the grade cap.`,
  ];

  switch (pinnedType) {
    case 'sort-by-one':
      promptLines.push(
        tier === 'easy'
          ? 'Use clearly separated attribute values so each object obviously belongs in one bin; the instruction may name the sorting attribute explicitly.'
          : tier === 'hard'
            ? 'Include at least one object whose attribute value is near a category boundary so the student must look carefully; the instruction should still name the attribute but not pre-classify any object.'
            : 'Use distinct attribute values; the instruction names the attribute without classifying objects.',
      );
      break;
    case 'sort-by-attribute':
      promptLines.push(
        tier === 'easy'
          ? 'Give exactly 2 sortable attributes with clearly distinct values so either choice is approachable; the instruction may nudge which attribute works well.'
          : tier === 'hard'
            ? 'Give exactly 2 sortable attributes, but make their values subtler/closer (and let the group count run to the upper end) so deciding which produces a clean sort is genuinely the challenge; do NOT name which attribute to use.'
            : 'Give exactly 2 sortable attributes; the student decides which to use without being told.',
      );
      break;
    case 'count-and-compare':
      promptLines.push(
        tier === 'easy'
          ? 'Make the two group sizes obviously different (a large gap) so the comparison is easy once counted.'
          : tier === 'hard'
            ? 'Make the group sizes close (a small gap) and use three groups so the student must count precisely before comparing.'
            : 'Use a moderate gap between two groups so counting matters but the comparison is still clear.',
      );
      break;
    case 'odd-one-out':
      promptLines.push(
        tier === 'easy'
          ? 'The odd object shares NO attributes with the majority — it is obviously different. Never state on-screen why it is odd.'
          : tier === 'hard'
            ? 'The odd object differs on a single subtle attribute and shares the rest with the majority, so the student must compare carefully. Never reveal which one or why on-screen.'
            : 'The odd object shares one attribute with the majority but clearly differs on another. Never reveal the answer on-screen.',
      );
      break;
    case 'two-attributes':
      promptLines.push(
        tier === 'easy'
          ? 'Use mostly single-attribute distractors (match only color OR only type) so the matching objects stand out; keep the target group clearly labeled.'
          : tier === 'hard'
            ? 'Use mostly near-miss distractors (match one of the two target attributes) so the student must check BOTH attributes on every object.'
            : 'Use a balanced mix of single-attribute and neither-attribute distractors.',
      );
      break;
    case 'tally-record':
      promptLines.push(
        tier === 'easy'
          ? 'Keep the live count badges on during the sort phase and pre-place one worked example so the student sees the recording rhythm; use few, well-separated groups.'
          : tier === 'hard'
            ? 'Hide the live count badges during the sort phase and use more groups so the student tracks each tally unaided.'
            : 'Hide the live count badges; the student sorts and tallies without live support.',
      );
      break;
  }

  return { showCounts, showModelExample, promptLines };
}

/**
 * Resolve the STRUCTURAL problem shape for a tier on a pinned challenge type.
 * Returns grade-band-bounded object/category counts plus the per-mode structural lever
 * (count gap, # shared attributes). The harder tier changes the SHAPE of the problem
 * (more distractors / smaller gap / more shared attributes), never the raw magnitude
 * beyond the grade cap. Code enforces the numeric levers in post-process.
 */
function resolveProblemShape(
  pinnedType: ChallengeType,
  tier: SupportTier,
  gradeBand: 'K' | '1',
): ProblemShape {
  const win = gradeObjectWindow(gradeBand);
  const binCap = gradeBinCap(gradeBand);
  // Object count ramps within the grade window: easy = low end, hard = high end (capped).
  const objectCount =
    tier === 'easy' ? win.min : tier === 'hard' ? win.max : Math.round((win.min + win.max) / 2);

  // Category/bin count ramps 2 → 3 → 4, hard-capped by grade.
  const baseBins = tier === 'easy' ? 2 : tier === 'hard' ? 4 : 3;
  const categoryCount = Math.min(baseBins, binCap);

  const promptLines: string[] = [];
  const shape: ProblemShape = { objectCount, categoryCount, promptLines };

  switch (pinnedType) {
    case 'sort-by-one':
    case 'sort-by-attribute':
    case 'tally-record':
      promptLines.push(
        `Use about ${objectCount} objects across about ${categoryCount} groups (stay within the grade band — do not exceed ${binCap} groups or ${win.max} objects).`,
      );
      break;
    case 'count-and-compare': {
      // Count-gap is the in-mode structural lever: ≥3 (obvious) → 2 → 1 (subtle).
      shape.compareGap = tier === 'easy' ? 3 : tier === 'hard' ? 1 : 2;
      const groups = tier === 'hard' ? Math.min(3, binCap) : 2;
      shape.categoryCount = groups;
      promptLines.push(
        `Pre-sort the objects into ${groups} groups whose sizes differ by ${tier === 'hard' ? 'exactly 1 (close — count precisely)' : tier === 'easy' ? 'at least 3 (an obvious difference)' : 'exactly 2'}. Keep total objects within ${win.max}.`,
      );
      break;
    }
    case 'odd-one-out': {
      // Shared-attribute count is the in-mode lever: 0 (obvious) → 1+ (subtle).
      shape.oddSharedAttrs = tier === 'easy' ? 0 : tier === 'hard' ? 2 : 1;
      shape.objectCount = tier === 'easy' ? Math.min(4, win.max) : tier === 'hard' ? win.max : Math.min(5, win.max);
      promptLines.push(
        `Use ${shape.objectCount} objects. The odd object should share ${shape.oddSharedAttrs === 0 ? 'NO attributes' : `${shape.oddSharedAttrs} attribute(s)`} with the majority, so it is ${tier === 'easy' ? 'obviously' : tier === 'hard' ? 'only subtly' : 'moderately'} different.`,
      );
      break;
    }
    case 'two-attributes': {
      // Near-miss ratio is prompt-shaped (no clean numeric handle on the LLM-authored set).
      shape.objectCount = tier === 'easy' ? Math.min(6, win.max) : tier === 'hard' ? win.max : Math.min(7, win.max);
      shape.categoryCount = 2;
      promptLines.push(
        `Use ${shape.objectCount} objects. Make ${tier === 'easy' ? 'few of the distractors near-misses (mostly match neither or only one attribute weakly)' : tier === 'hard' ? 'most distractors near-misses that match exactly ONE of the two target attributes' : 'a balanced set of near-miss and clear distractors'}.`,
      );
      break;
    }
  }

  return shape;
}

/** Concatenate the scaffolding + problem-shape prompt lines into one tier block. */
function buildTierPromptSection(
  pinnedType: ChallengeType,
  tier: SupportTier,
  gradeBand: 'K' | '1',
): string {
  const scaffold = resolveSupportStructure(pinnedType, tier);
  const shape = resolveProblemShape(pinnedType, tier, gradeBand);
  const lines = [...scaffold.promptLines, ...shape.promptLines];
  return `\n## WITHIN-MODE SUPPORT TIER (scaffolding level + problem STRUCTURE — NOT raw magnitude beyond the grade cap)\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
}

// ============================================================================
// Shared object schema — used by all modes
// ============================================================================

const objectItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING, description: "Display label (e.g., 'Red Apple')" },
    emoji: { type: Type.STRING, description: "Single emoji (e.g., '🍎')" },
    color: { type: Type.STRING, description: "Color attribute (e.g., 'red')" },
    shape: { type: Type.STRING, description: "Shape attribute (e.g., 'round')" },
    size: { type: Type.STRING, description: "Size attribute (e.g., 'big')" },
    type: { type: Type.STRING, description: "Type attribute (e.g., 'fruit')" },
  },
  required: ["label", "emoji"],
};

// ============================================================================
// Per-mode schemas — simple, focused, no cross-contamination
// ============================================================================

/** sort-by-one / sort-by-attribute / tally-record all use the same shape */
const sortSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Fun title for the activity" },
    description: { type: Type.STRING, description: "Brief educational description" },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          instruction: {
            type: Type.STRING,
            description: "Warm instruction asking students to sort (e.g., 'Can you sort the animals by color?')",
          },
          sortingAttribute: {
            type: Type.STRING,
            description: "Which attribute to sort by: 'color', 'shape', 'size', or 'type'",
          },
          objects: { type: Type.ARRAY, items: objectItemSchema },
        },
        required: ["instruction", "sortingAttribute", "objects"],
      },
    },
  },
  required: ["title", "description", "challenges"],
};

const countCompareSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Fun title" },
    description: { type: Type.STRING, description: "Brief description" },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          instruction: {
            type: Type.STRING,
            description: "Instruction asking students to count and compare groups",
          },
          sortingAttribute: {
            type: Type.STRING,
            description: "Attribute the objects are pre-sorted by: 'color', 'shape', 'size', or 'type'",
          },
          objects: { type: Type.ARRAY, items: objectItemSchema },
          comparisonQuestion: {
            type: Type.STRING,
            description: "The comparison question (e.g., 'Which group has more?')",
          },
          correctComparison: {
            type: Type.STRING,
            description: "Answer: 'more', 'fewer', or 'equal'",
          },
        },
        required: ["instruction", "sortingAttribute", "objects", "comparisonQuestion", "correctComparison"],
      },
    },
  },
  required: ["title", "description", "challenges"],
};

const oddOneOutSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Fun title" },
    description: { type: Type.STRING, description: "Brief description" },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          instruction: {
            type: Type.STRING,
            description: "Instruction asking which one doesn't belong",
          },
          objects: { type: Type.ARRAY, items: objectItemSchema },
          oddOneOutIndex: {
            type: Type.NUMBER,
            description: "Zero-based index of the object that doesn't belong",
          },
          oddOneOutReason: {
            type: Type.STRING,
            description: "Explanation of why it doesn't belong",
          },
        },
        required: ["instruction", "objects", "oddOneOutIndex", "oddOneOutReason"],
      },
    },
  },
  required: ["title", "description", "challenges"],
};

const twoAttributesSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Fun title" },
    description: { type: Type.STRING, description: "Brief description" },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          instruction: {
            type: Type.STRING,
            description: "Instruction asking students to find objects matching two attributes",
          },
          objects: { type: Type.ARRAY, items: objectItemSchema },
          targetColor: {
            type: Type.STRING,
            description: "First attribute value to match (a color, e.g., 'red')",
          },
          targetType: {
            type: Type.STRING,
            description: "Second attribute value to match (a type, e.g., 'fruit')",
          },
          categoryLabel: {
            type: Type.STRING,
            description: "Human label for the target group (e.g., 'Red Fruits')",
          },
        },
        required: ["instruction", "objects", "targetColor", "targetType", "categoryLabel"],
      },
    },
  },
  required: ["title", "description", "challenges"],
};

// ============================================================================
// Helpers
// ============================================================================

function gradeGuidance(gradeLevel: string): string {
  const isK = /[kK]|kinder/i.test(gradeLevel);
  return isK
    ? 'Kindergarten: 4-6 objects, 2-3 groups, very familiar concrete objects (animals, fruits, toys), simple warm language.'
    : 'Grade 1: 5-8 objects, 2-4 groups, introduce reasoning, connect to data concepts.';
}

function resolveGradeBand(gradeLevel: string): 'K' | '1' {
  return /[kK]|kinder/i.test(gradeLevel) ? 'K' : '1';
}

/** Convert flat LLM object fields into the component's SortingObject shape */
function toLuminaObjects(
  raw: Array<{ label: string; emoji: string; color?: string; shape?: string; size?: string; type?: string }>,
  idOffset: number,
): SortingObject[] {
  return raw.map((obj, j) => ({
    id: `obj${idOffset + j + 1}`,
    label: obj.label || obj.emoji || 'Object',
    emoji: obj.emoji || '⭐',
    attributes: {
      ...(obj.color && { color: obj.color }),
      ...(obj.shape && { shape: obj.shape }),
      ...(obj.size && { size: obj.size }),
      ...(obj.type && { type: obj.type }),
    },
  }));
}

/** Derive categories deterministically from actual object attribute values */
function deriveCategories(objects: SortingObject[], sortAttr: string): SortingCategory[] {
  const values = Array.from(new Set(objects.map(o => o.attributes[sortAttr]).filter(Boolean)));
  return values.map(v => ({
    label: v.charAt(0).toUpperCase() + v.slice(1),
    rule: { [sortAttr]: v },
  }));
}

// ============================================================================
// Sub-generators — one LLM call each, focused prompt + simple schema
// ============================================================================

async function generateSortChallenges(
  topic: string,
  gradeLevel: string,
  sortType: 'sort-by-one' | 'sort-by-attribute' | 'tally-record',
  count: number,
  tierSection: string,
): Promise<{ title: string; description: string; challenges: SortingStationChallenge[] }> {
  const typeGuide = {
    'sort-by-one':
      'Each challenge sorts by ONE attribute (color, shape, size, or type). ' +
      'Use a DIFFERENT sorting attribute for each challenge to create variety. ' +
      'Instruction MUST ask students to sort/group — NEVER ask "which has more" or "which doesn\'t belong".',
    'sort-by-attribute':
      'The student picks HOW to sort, so give every object EXACTLY TWO clean sortable attributes ' +
      '(e.g. color AND type) — no more. EVERY object must have BOTH attributes filled in, and each ' +
      'attribute must have ≥2 distinct values across the set, so BOTH axes form valid groups and ' +
      'the student has a real choice. Do NOT add a third or fourth attribute (size/shape) — extra ' +
      'axes are wasted authoring and get hidden from the chooser anyway.',
    'tally-record':
      'Sort objects and tally the count of each group. ' +
      'Each challenge sorts by ONE attribute. Every object MUST match a group. ' +
      'Instruction should mention tallying or recording counts.',
  }[sortType];

  const prompt = `
Create a sorting activity for teaching "${topic}" to ${gradeLevel} students.
${gradeGuidance(gradeLevel)}

TASK TYPE: ${sortType}
${typeGuide}
${tierSection}
Generate exactly ${count} challenges. Each challenge needs:
- A warm, encouraging instruction for young children
- A sortingAttribute (one of: color, shape, size, type)
- 4-8 objects with a label, emoji, and attributes (color, shape, size, type as relevant)
- Objects MUST have at least 2 distinct values for the sortingAttribute so there are 2+ groups
- Use fun kid-friendly emojis and themes kids love (animals, food, toys, nature)
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: sortSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) throw new Error(`No ${sortType} challenges returned`);

  const challenges: SortingStationChallenge[] = data.challenges.slice(0, count).map(
    (ch: { instruction: string; sortingAttribute: string; objects: Array<{ label: string; emoji: string; color?: string; shape?: string; size?: string; type?: string }> }, i: number) => {
      const sortAttr = ch.sortingAttribute || 'type';
      const objects = toLuminaObjects(ch.objects || [], i * 10);
      const categories = deriveCategories(objects, sortAttr);

      return {
        id: `c${i + 1}`,
        type: sortType,
        instruction: ch.instruction,
        sortingAttribute: sortAttr,
        objects,
        categories: categories.length >= 2 ? categories : deriveCategories(objects, 'type'),
      } as SortingStationChallenge;
    },
  );

  return { title: data.title, description: data.description, challenges };
}

async function generateCountCompareChallenges(
  topic: string,
  gradeLevel: string,
  count: number,
  tierSection: string,
): Promise<{ title: string; description: string; challenges: SortingStationChallenge[] }> {
  const prompt = `
Create a count-and-compare activity for teaching "${topic}" to ${gradeLevel} students.
${gradeGuidance(gradeLevel)}

TASK: Objects are pre-sorted into groups. Student counts each group and answers a comparison question.
${tierSection}
Generate exactly ${count} challenges. Each challenge needs:
- A warm instruction
- A sortingAttribute (color, shape, size, or type)
- 4-8 objects with attributes — groups MUST have DIFFERENT counts so there's a clear answer
- A comparisonQuestion (e.g., "Are there more red things or blue things?")
- correctComparison: 'more', 'fewer', or 'equal'

Make sure the groups have unequal sizes for 'more'/'fewer' answers.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: countCompareSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) throw new Error('No count-and-compare challenges returned');

  const challenges: SortingStationChallenge[] = data.challenges.slice(0, count).map(
    (ch: { instruction: string; sortingAttribute: string; objects: Array<{ label: string; emoji: string; color?: string; shape?: string; size?: string; type?: string }>; comparisonQuestion: string; correctComparison: string }, i: number) => {
      const sortAttr = ch.sortingAttribute || 'type';
      const objects = toLuminaObjects(ch.objects || [], i * 10);
      const categories = deriveCategories(objects, sortAttr);
      const validComparisons = ['more', 'fewer', 'equal'];

      return {
        id: `c${i + 1}`,
        type: 'count-and-compare' as const,
        instruction: ch.instruction,
        sortingAttribute: sortAttr,
        objects,
        categories,
        comparisonQuestion: ch.comparisonQuestion || 'Which group has more?',
        correctComparison: (validComparisons.includes(ch.correctComparison)
          ? ch.correctComparison
          : 'more') as 'more' | 'fewer' | 'equal',
      } satisfies SortingStationChallenge;
    },
  );

  return { title: data.title, description: data.description, challenges };
}

async function generateOddOneOutChallenges(
  topic: string,
  gradeLevel: string,
  count: number,
  tierSection: string,
): Promise<{ title: string; description: string; challenges: SortingStationChallenge[] }> {
  const prompt = `
Create an odd-one-out activity for teaching "${topic}" to ${gradeLevel} students.
${gradeGuidance(gradeLevel)}

TASK: Show a group of objects where ONE doesn't belong. Student finds it.
${tierSection}
Generate exactly ${count} challenges. Each challenge needs:
- A warm instruction asking "Which one doesn't belong?"
- 4-6 objects where ALL but ONE share a common attribute
- oddOneOutIndex: the ZERO-BASED INDEX of the object that doesn't belong
- oddOneOutReason: a kid-friendly explanation (e.g., "It's the only one that isn't round")

The odd object must be CLEARLY different from the majority group.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: oddOneOutSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) throw new Error('No odd-one-out challenges returned');

  const challenges: SortingStationChallenge[] = data.challenges.slice(0, count).map(
    (ch: { instruction: string; objects: Array<{ label: string; emoji: string; color?: string; shape?: string; size?: string; type?: string }>; oddOneOutIndex: number; oddOneOutReason: string }, i: number) => {
      const objects = toLuminaObjects(ch.objects || [], i * 10);
      const idx = Math.max(0, Math.min(ch.oddOneOutIndex ?? 0, objects.length - 1));

      return {
        id: `c${i + 1}`,
        type: 'odd-one-out' as const,
        instruction: ch.instruction,
        objects,
        oddOneOut: objects[idx]?.id,
        oddOneOutReason: ch.oddOneOutReason || 'This one is different from the others.',
      } satisfies SortingStationChallenge;
    },
  );

  return { title: data.title, description: data.description, challenges };
}

async function generateTwoAttributesChallenges(
  topic: string,
  gradeLevel: string,
  count: number,
  tierSection: string,
): Promise<{ title: string; description: string; challenges: SortingStationChallenge[] }> {
  const prompt = `
Create a two-attribute classification activity for teaching "${topic}" to ${gradeLevel} students.
${gradeGuidance(gradeLevel)}

TASK: Student finds objects matching TWO attributes at once (e.g., "Find red fruits").
${tierSection}
Generate exactly ${count} challenges. Each challenge needs:
- A warm instruction (e.g., "Can you find all the red fruits?")
- 6-8 objects with BOTH a color AND a type attribute — use visually distinct emojis
- targetColor: the color to match (e.g., 'red')
- targetType: the type to match (e.g., 'fruit')
- categoryLabel: human label (e.g., 'Red Fruits')

Objects must include:
- Some matching BOTH attributes (correct answers)
- Some matching only color (distractors)
- Some matching only type (distractors)
- Some matching neither (distractors)

Do NOT use "size" — it's not visually distinguishable via emoji.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: twoAttributesSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) throw new Error('No two-attributes challenges returned');

  const challenges: SortingStationChallenge[] = data.challenges.slice(0, count).map(
    (ch: { instruction: string; objects: Array<{ label: string; emoji: string; color?: string; shape?: string; size?: string; type?: string }>; targetColor: string; targetType: string; categoryLabel: string }, i: number) => {
      const objects = toLuminaObjects(ch.objects || [], i * 10);
      // Strip "size" from objects
      for (const obj of objects) delete obj.attributes.size;

      const targetRule: Record<string, string> = {
        color: ch.targetColor || 'red',
        type: ch.targetType || 'fruit',
      };

      // Verify at least 1 object matches both and at least 1 doesn't
      const matchCount = objects.filter(o =>
        Object.entries(targetRule).every(([k, v]) => o.attributes[k] === v),
      ).length;

      // If the split is trivial, fall back to sort-by-one
      if (matchCount === 0 || matchCount === objects.length) {
        const categories = deriveCategories(objects, 'type');
        return {
          id: `c${i + 1}`,
          type: 'sort-by-one' as const,
          instruction: ch.instruction,
          sortingAttribute: 'type',
          objects,
          categories,
        } satisfies SortingStationChallenge;
      }

      return {
        id: `c${i + 1}`,
        type: 'two-attributes' as const,
        instruction: ch.instruction,
        objects,
        categories: [
          { label: ch.categoryLabel || `${ch.targetColor} ${ch.targetType}`, rule: targetRule },
          { label: 'Others', rule: {} }, // component uses "doesn't match first rule" logic
        ],
      } satisfies SortingStationChallenge;
    },
  );

  return { title: data.title, description: data.description, challenges };
}

// ============================================================================
// Generator dispatch map
// ============================================================================

type SubGenerator = (
  topic: string,
  gradeLevel: string,
  count: number,
  tierSection: string,
) => Promise<{ title: string; description: string; challenges: SortingStationChallenge[] }>;

const GENERATOR_MAP: Record<string, SubGenerator> = {
  'sort-by-one': (t, g, n, ts) => generateSortChallenges(t, g, 'sort-by-one', n, ts),
  'sort-by-attribute': (t, g, n, ts) => generateSortChallenges(t, g, 'sort-by-attribute', n, ts),
  'tally-record': (t, g, n, ts) => generateSortChallenges(t, g, 'tally-record', n, ts),
  'count-and-compare': generateCountCompareChallenges,
  'odd-one-out': generateOddOneOutChallenges,
  'two-attributes': generateTwoAttributesChallenges,
};

// ============================================================================
// Orchestrator — delegates to sub-generators, runs in parallel, combines
// ============================================================================

interface SortingStationConfig {
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second axis of the two-field contract: targetEvalMode = which challenge type (task
   * identity), difficulty = how much on-workspace scaffolding + how structurally hard the
   * problem is within it. NEVER changes object/group magnitude beyond the grade cap.
   */
  difficulty?: string;
  challengeTypes?: string[];
  maxCategories?: number;
  targetEvalMode?: string;
}

export const generateSortingStation = async (
  ctx: GenerationContext,
): Promise<SortingStationData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as SortingStationConfig;
  const evalConstraint = resolveEvalModeConstraint(
    'sorting-station',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('SortingStation', config?.targetEvalMode, evalConstraint);

  const gradeBand = resolveGradeBand(gradeLevel);
  const allowedTypes = evalConstraint?.allowedTypes ?? Object.keys(GENERATOR_MAP);

  // ── Within-mode support tier ──
  // The eval mode owns WHICH challenge type; config.difficulty owns how much on-workspace
  // scaffolding + how structurally hard the problem is within it. The tier DRIVES application
  // (per challenge from its own mode, see end); pinnedType only chooses the prompt tone — a
  // mixed-mode session has no single mode to describe to the LLM.
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType = allowedTypes.length === 1 ? (allowedTypes[0] as ChallengeType) : undefined;
  const tierSection =
    pinnedType && supportTier ? buildTierPromptSection(pinnedType, supportTier, gradeBand) : '';

  // Determine how many challenges each sub-generator should produce.
  // Constrained (single type): 4 challenges from one generator.
  // Mixed (unconstrained): 1 challenge per type, run all in parallel.
  const isSingleMode = allowedTypes.length === 1;
  const challengesPerType = isSingleMode ? 4 : 1;

  // Launch all allowed sub-generators in parallel
  const results = await Promise.all(
    allowedTypes
      .filter(t => GENERATOR_MAP[t])
      .map(t => GENERATOR_MAP[t](topic, gradeLevel, challengesPerType, tierSection)),
  );

  // Combine: flatten challenges, re-number IDs, pick first title
  let allChallenges: SortingStationChallenge[] = [];
  let title = '';
  let description = '';
  let globalObjId = 0;

  for (const result of results) {
    if (!title && result.title) title = result.title;
    if (!description && result.description) description = result.description;

    for (const ch of result.challenges) {
      // Re-number challenge IDs sequentially
      const idx = allChallenges.length;
      ch.id = `c${idx + 1}`;

      // Re-number object IDs to be globally unique, tracking old→new mapping
      const idMap = new Map<string, string>();
      for (const obj of ch.objects) {
        globalObjId++;
        const newId = `obj${globalObjId}`;
        idMap.set(obj.id, newId);
        obj.id = newId;
      }

      // Update oddOneOut reference to match re-numbered ID
      if (ch.oddOneOut && idMap.has(ch.oddOneOut)) {
        ch.oddOneOut = idMap.get(ch.oddOneOut)!;
      }

      allChallenges.push(ch);
    }
  }

  // Fallback if all generators failed
  if (allChallenges.length === 0) {
    allChallenges = [{
      id: 'c1',
      type: 'sort-by-one',
      instruction: 'Can you sort these by color?',
      sortingAttribute: 'color',
      objects: [
        { id: 'obj1', label: 'Red Apple', emoji: '🍎', attributes: { color: 'red', type: 'fruit' } },
        { id: 'obj2', label: 'Yellow Banana', emoji: '🍌', attributes: { color: 'yellow', type: 'fruit' } },
        { id: 'obj3', label: 'Red Cherry', emoji: '🍒', attributes: { color: 'red', type: 'fruit' } },
        { id: 'obj4', label: 'Yellow Star', emoji: '⭐', attributes: { color: 'yellow', type: 'shape' } },
      ],
      categories: [
        { label: 'Red', rule: { color: 'red' } },
        { label: 'Yellow', rule: { color: 'yellow' } },
      ],
    }];
    title = 'Sorting Station';
    description = 'Sort objects into groups!';
  }

  // Compute maxCategories from actual data
  const maxCategories = Math.max(
    config?.maxCategories ?? 2,
    ...allChallenges
      .filter(ch => ch.categories)
      .map(ch => ch.categories!.length),
  );

  // ── Apply the support-tier structure deterministically (code owns the SUPPORT
  // structure + structural levers; the LLM only chose the objects/attributes). Gated ONLY
  // on a tier being present, resolved PER CHALLENGE from its own mode so blended/auto
  // sessions get difficulty too. Runs AFTER all structural assembly. ──
  let resolvedShowCounts = true; // default (no-tier path) is byte-identical to before
  if (supportTier) {
    // showCounts is a board-level flag; resolve it from the dominant pinned mode (or, for a
    // blend, the first challenge's mode). A live badge withdrawn at medium/hard for any
    // single-mode session is the intended behavior.
    const scaffoldModeForCounts = (pinnedType ?? (allChallenges[0]?.type as ChallengeType));
    resolvedShowCounts = resolveSupportStructure(scaffoldModeForCounts, supportTier).showCounts;

    for (const ch of allChallenges) {
      const mode = ch.type as ChallengeType;
      const scaffold = resolveSupportStructure(mode, supportTier);
      const shape = resolveProblemShape(mode, supportTier, gradeBand);

      // ── Worked-example model item (sort-family only; identity-safe by construction) ──
      // Pre-place ONE object NOT being asked about; the component excludes it from grading.
      if (scaffold.showModelExample && (mode === 'sort-by-one' || mode === 'tally-record')) {
        const cats = ch.categories ?? [];
        // Pick the model from a category with ≥2 members so removing it from the gradeable set
        // still leaves at least one object the student must place into that same bin (the bin
        // never becomes a freebie-only group).
        if (cats.length >= 2 && ch.objects.length >= 4) {
          let modelBin = -1;
          let candidate: SortingObject | undefined;
          for (let bi = 0; bi < cats.length; bi++) {
            const members = ch.objects.filter(o => objectMatchesRuleLocal(o, cats[bi].rule));
            if (members.length >= 2) {
              candidate = members[0];
              modelBin = bi;
              break;
            }
          }
          if (candidate && modelBin >= 0) {
            ch.modelItemId = candidate.id;
            ch.modelItemBin = modelBin;
          }
        }
      } else {
        // medium/hard or non-eligible modes: ensure no stale model leaks through.
        delete ch.modelItemId;
        delete ch.modelItemBin;
      }

      // ── Structural lever: count-and-compare count gap (code-enforced) ──
      if (mode === 'count-and-compare' && shape.compareGap != null) {
        enforceCompareGap(ch, shape.compareGap, gradeBand);
      }

      // NOTE: odd-one-out shared-attribute count and two-attributes near-miss ratio are
      // prompt-shaped (the LLM authors the attribute set); we do not post-hoc rewrite the
      // odd item or its reason — that would risk corrupting oddOneOut / leaking the answer.
    }

    console.log(
      `[SortingStation] Support tier "${supportTier}" applied per-challenge ` +
      `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'}) → showCounts=${resolvedShowCounts}, ` +
      `models=${allChallenges.filter(c => c.modelItemId).length}`,
    );
  }

  return {
    title: title || 'Sorting Station',
    description: description || 'Sort objects into groups!',
    challenges: allChallenges,
    maxCategories: Math.min(maxCategories, gradeBand === 'K' ? 3 : 4),
    showCounts: resolvedShowCounts,
    showTallyChart: allChallenges.some(ch => ch.type === 'tally-record'),
    gradeBand,
    ...(supportTier ? { supportTier } : {}),
  };
};

// ============================================================================
// Local helpers for tier application
// ============================================================================

function objectMatchesRuleLocal(obj: SortingObject, rule: Record<string, string>): boolean {
  return Object.entries(rule).every(([key, value]) => obj.attributes[key] === value);
}

/**
 * Code-enforce the count-and-compare group-size gap (structural lever). The bins are derived
 * deterministically from object attributes, so to widen/narrow the gap we trim the smaller
 * group's surplus objects until |a-b| === targetGap (clamped so neither group empties and the
 * total stays in the grade band). Never adds objects (would change magnitude up); only trims.
 */
function enforceCompareGap(
  ch: SortingStationChallenge,
  targetGap: number,
  gradeBand: 'K' | '1',
): void {
  const cats = ch.categories ?? [];
  if (cats.length < 2) return;

  // Bucket objects by the first matching category.
  const buckets: SortingObject[][] = cats.map(() => []);
  const unmatched: SortingObject[] = [];
  for (const obj of ch.objects) {
    const idx = cats.findIndex(c => objectMatchesRuleLocal(obj, c.rule));
    if (idx >= 0) buckets[idx].push(obj);
    else unmatched.push(obj);
  }

  // Use the two largest buckets as the compared groups.
  const order = buckets
    .map((b, i) => ({ i, n: b.length }))
    .sort((a, b) => b.n - a.n);
  if (order.length < 2 || order[1].n === 0) return;

  const bigIdx = order[0].i;
  const smallIdx = order[1].i;
  const big = buckets[bigIdx];
  const small = buckets[smallIdx];

  // Current gap; trim the larger group down so the gap matches the target (keep ≥1 each).
  const desiredBig = Math.max(small.length + targetGap, small.length + 1);
  if (big.length > desiredBig) {
    const removeCount = big.length - desiredBig;
    const removed = new Set(big.slice(big.length - removeCount).map(o => o.id));
    ch.objects = ch.objects.filter(o => !removed.has(o.id));
  }
  // If the natural gap is already ≤ target we leave it — never pad up (magnitude guard).
  // Re-derive categories so the component's auto-sort stays consistent (object set changed).
  if (ch.sortingAttribute) {
    const derived = deriveCategories(ch.objects, ch.sortingAttribute);
    if (derived.length >= 2) ch.categories = derived;
  }
  void gradeBand; // total already inside grade band; kept for signature symmetry
}
