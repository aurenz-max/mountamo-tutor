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
    promptDoc: `"sort-by-one": Sort objects by ONE objective-relevant category or visible attribute.`,
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
    promptDoc: `"two-attributes": Find objects matching TWO criteria simultaneously; the primary criterion must express the lesson objective.`,
    schemaDescription: "'two-attributes' (multi-criterion classification)",
  },
  'tally-record': {
    promptDoc: `"tally-record": Sort objects and record the count of each group using tallies.`,
    schemaDescription: "'tally-record' (sort and tally counts)",
  },
  'sort-variety': {
    promptDoc: `"sort-variety": FLEXIBLE CLASSIFICATION — one fixed object set, sorted by a DIFFERENT valid rule each round (the rule rotation IS the taught skill). Renders as a single-attribute sort per round.`,
    schemaDescription: "'sort-variety' (re-sort the same set by a different rule)",
  },
};

type ChallengeType =
  | 'sort-by-one'
  | 'sort-by-attribute'
  | 'count-and-compare'
  | 'odd-one-out'
  | 'two-attributes'
  | 'tally-record'
  | 'sort-variety';

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
          ? 'Use mostly single-criterion distractors (match only the objective category OR only the secondary criterion) so the matching objects stand out; keep the target group clearly labeled.'
          : tier === 'hard'
            ? 'Use mostly near-miss distractors (match one of the two target criteria) so the student must check BOTH criteria on every object.'
            : 'Use a balanced mix of single-criterion and neither-criterion distractors.',
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
    case 'sort-variety':
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
    category: {
      type: Type.STRING,
      description: "Objective-relevant semantic category (e.g., 'need', 'want', 'firefighter', or 'triangle')",
    },
  },
  required: ["label", "emoji"],
};

/** Two-criterion mode always carries the objective category on every object. */
const twoAttributeObjectItemSchema: Schema = {
  ...objectItemSchema,
  required: ["label", "emoji", "category"],
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
            description: "Which attribute to sort by: 'category', 'color', 'shape', 'size', or 'type'",
          },
          objects: { type: Type.ARRAY, items: objectItemSchema },
          categoryEmojis: {
            type: Type.ARRAY,
            description: "One picture per bin: for each distinct sortingAttribute value (each group the objects sort into), a single emoji that stands for the WHOLE group so a pre-reader can tell the bins apart. NEVER reuse an object's own emoji; pick a general symbol (e.g. category 'need' → 🏠, 'want' → 🎁).",
            items: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING, description: "The sortingAttribute value this bin holds (e.g. 'need')" },
                emoji: { type: Type.STRING, description: "Single representative emoji for that whole group" },
              },
              required: ["value", "emoji"],
            },
          },
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
            description: "Attribute the objects are pre-sorted by: 'category', 'color', 'shape', 'size', or 'type'",
          },
          objects: { type: Type.ARRAY, items: objectItemSchema },
          categoryEmojis: {
            type: Type.ARRAY,
            description: "One picture per group: for each distinct sortingAttribute value, a single emoji standing for the WHOLE group so a pre-reader can tell the groups apart. NEVER reuse an object's own emoji.",
            items: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING, description: "The sortingAttribute value this group holds" },
                emoji: { type: Type.STRING, description: "Single representative emoji for that whole group" },
              },
              required: ["value", "emoji"],
            },
          },
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
          objects: { type: Type.ARRAY, items: twoAttributeObjectItemSchema },
          targetCategory: {
            type: Type.STRING,
            description: "Primary objective-relevant category to match (e.g., 'need', 'firefighter', or 'triangle')",
          },
          secondaryAttribute: {
            type: Type.STRING,
            description: "Secondary attribute name: 'color', 'shape', 'size', or 'type'",
          },
          secondaryValue: {
            type: Type.STRING,
            description: "Value to match for the secondary attribute",
          },
          categoryLabel: {
            type: Type.STRING,
            description: "Human label for the target group (e.g., 'Red Fruits')",
          },
        },
        required: ["instruction", "objects", "targetCategory", "secondaryAttribute", "secondaryValue", "categoryLabel"],
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

/**
 * Bind the interaction's classification rule to the per-component objective.
 * The broad topic provides context; ctx.intent is the actual task contract. A
 * semantic `category` axis lets needs/wants, community roles, and similar lessons
 * remain concept sorts instead of being silently replaced by color/size practice.
 */
export function buildSortingObjectiveSection(topic: string, intent?: string): string {
  const specificObjective = intent?.trim() || topic;
  return `
## OBJECTIVE BINDING (highest priority)
- Broad lesson topic: "${topic}"
- Specific objective for THIS activity: "${specificObjective}"
- Every challenge must assess that specific objective. Keep the SAME taught classification rule across challenges; create variety through different on-objective objects and examples, NEVER by switching to an unrelated color/size/shape sort.
- Use sortingAttribute "category" for conceptual rules such as need/want, community-helper role, tool owner, living/nonliving, or any other meaning-based grouping. Put that objective-relevant value in every object's category field.
- Use color, size, or shape as the sortingAttribute only when the specific objective explicitly teaches that perceptual attribute. For a shape-naming objective, shape is objective-relevant; color and size are distractor features, not replacement tasks.
- Do not turn a conceptual classification objective into a perceptual warm-up. The child's successful action must demonstrate the lesson objective.
`;
}

interface RawSortingObject {
  label: string;
  emoji: string;
  color?: string;
  shape?: string;
  size?: string;
  type?: string;
  category?: string;
}

/** Convert flat LLM object fields into the component's SortingObject shape */
function toLuminaObjects(
  raw: RawSortingObject[],
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
      ...(obj.category && { category: obj.category }),
    },
  }));
}

/** Derive categories deterministically from actual object attribute values.
 *  `emojiByValue` (lowercased value → emoji) attaches a picture-primary bin icon for the K
 *  render; it is optional and non-load-bearing (missing → the component falls back to a
 *  color-coded circle). */
function deriveCategories(
  objects: SortingObject[],
  sortAttr: string,
  emojiByValue?: Map<string, string>,
): SortingCategory[] {
  const values = Array.from(new Set(objects.map(o => o.attributes[sortAttr]).filter(Boolean)));
  return values.map(v => {
    const emoji = emojiByValue?.get(v.toLowerCase());
    return {
      label: v.charAt(0).toUpperCase() + v.slice(1),
      rule: { [sortAttr]: v },
      ...(emoji ? { bucketEmoji: emoji } : {}),
    };
  });
}

/** Build a lowercased value→emoji map from an LLM `categoryEmojis` array (best-effort). */
function buildEmojiByValue(
  categoryEmojis?: { value?: string; emoji?: string }[],
): Map<string, string> | undefined {
  if (!categoryEmojis?.length) return undefined;
  const map = new Map<string, string>();
  for (const ce of categoryEmojis) {
    if (ce?.value && ce?.emoji) map.set(ce.value.toLowerCase(), ce.emoji);
  }
  return map.size ? map : undefined;
}

// ============================================================================
// Sub-generators — one LLM call each, focused prompt + simple schema
// ============================================================================

async function generateSortChallenges(
  topic: string,
  intent: string | undefined,
  gradeLevel: string,
  sortType: 'sort-by-one' | 'sort-by-attribute' | 'tally-record',
  count: number,
  tierSection: string,
): Promise<{ title: string; description: string; challenges: SortingStationChallenge[] }> {
  const typeGuide = {
    'sort-by-one':
      'Each challenge sorts by ONE objective-relevant attribute (category, color, shape, size, or type). ' +
      'Use the SAME objective-relevant sorting axis in every challenge. Vary the objects, not the taught rule. ' +
      'Instruction MUST ask students to sort/group — NEVER ask "which has more" or "which doesn\'t belong".',
    'sort-by-attribute':
      'The student picks HOW to sort, so give every object EXACTLY TWO clean sortable attributes ' +
      '(prefer the objective category plus one other objective-relevant axis) — no more. EVERY object must have BOTH attributes filled in, and each ' +
      'attribute must have ≥2 distinct values across the set, so BOTH axes form valid groups and ' +
      'the student has a real choice. Both choices must stay inside the objective; do not offer an unrelated perceptual axis merely for variety. ' +
      'Do NOT add a third or fourth attribute — extra ' +
      'axes are wasted authoring and get hidden from the chooser anyway.',
    'tally-record':
      'Sort objects and tally the count of each group. ' +
      'Each challenge sorts by ONE attribute. Every object MUST match a group. ' +
      'Instruction should mention tallying or recording counts.',
  }[sortType];

  const prompt = `
Create a sorting activity for teaching "${topic}" to ${gradeLevel} students.
${gradeGuidance(gradeLevel)}
${buildSortingObjectiveSection(topic, intent)}

TASK TYPE: ${sortType}
${typeGuide}
${tierSection}
Generate exactly ${count} challenges. Each challenge needs:
- A warm, encouraging instruction for young children
- A sortingAttribute (one of: category, color, shape, size, type)
- 4-8 objects with a label, emoji, and only the objective-relevant attributes
- Objects MUST have at least 2 distinct values for the sortingAttribute so there are 2+ groups
- categoryEmojis: one entry per distinct sortingAttribute value (one per bin) giving a single emoji that stands for that WHOLE group, so a pre-reader can tell the bins apart. Pick a general symbol for the group, NEVER reuse an object's own emoji (e.g. 'need' → 🏠, 'want' → 🎁, 'living' → 🌱, 'non-living' → 🪨).
- Use familiar kid-friendly emojis and examples that belong to the objective; do not introduce an unrelated theme just for variety
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: sortSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) throw new Error(`No ${sortType} challenges returned`);

  const challenges: SortingStationChallenge[] = data.challenges.slice(0, count).map(
    (ch: { instruction: string; sortingAttribute: string; objects: RawSortingObject[]; categoryEmojis?: { value?: string; emoji?: string }[] }, i: number) => {
      const sortAttr = ch.sortingAttribute || 'type';
      const objects = toLuminaObjects(ch.objects || [], i * 10);
      const emojiByValue = buildEmojiByValue(ch.categoryEmojis);
      const categories = deriveCategories(objects, sortAttr, emojiByValue);

      return {
        id: `c${i + 1}`,
        type: sortType,
        instruction: ch.instruction,
        sortingAttribute: sortAttr,
        objects,
        categories: categories.length >= 2 ? categories : deriveCategories(objects, 'type', emojiByValue),
      } as SortingStationChallenge;
    },
  );

  return { title: data.title, description: data.description, challenges };
}

async function generateCountCompareChallenges(
  topic: string,
  intent: string | undefined,
  gradeLevel: string,
  count: number,
  tierSection: string,
): Promise<{ title: string; description: string; challenges: SortingStationChallenge[] }> {
  const prompt = `
Create a count-and-compare activity for teaching "${topic}" to ${gradeLevel} students.
${gradeGuidance(gradeLevel)}
${buildSortingObjectiveSection(topic, intent)}

TASK: Objects are pre-sorted into groups. Student counts each group and answers a comparison question.
${tierSection}
Generate exactly ${count} challenges. Each challenge needs:
- A warm instruction
- A sortingAttribute (category, color, shape, size, or type)
- 4-8 objects with attributes — groups MUST have DIFFERENT counts so there's a clear answer
- categoryEmojis: one entry per distinct sortingAttribute value (one per group) giving a single emoji standing for the WHOLE group so a pre-reader can tell the groups apart; NEVER reuse an object's own emoji
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
    (ch: { instruction: string; sortingAttribute: string; objects: RawSortingObject[]; comparisonQuestion: string; correctComparison: string; categoryEmojis?: { value?: string; emoji?: string }[] }, i: number) => {
      const sortAttr = ch.sortingAttribute || 'type';
      const objects = toLuminaObjects(ch.objects || [], i * 10);
      const categories = deriveCategories(objects, sortAttr, buildEmojiByValue(ch.categoryEmojis));
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
  intent: string | undefined,
  gradeLevel: string,
  count: number,
  tierSection: string,
): Promise<{ title: string; description: string; challenges: SortingStationChallenge[] }> {
  const prompt = `
Create an odd-one-out activity for teaching "${topic}" to ${gradeLevel} students.
${gradeGuidance(gradeLevel)}
${buildSortingObjectiveSection(topic, intent)}

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
    (ch: { instruction: string; objects: RawSortingObject[]; oddOneOutIndex: number; oddOneOutReason: string }, i: number) => {
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
  intent: string | undefined,
  gradeLevel: string,
  count: number,
  tierSection: string,
): Promise<{ title: string; description: string; challenges: SortingStationChallenge[] }> {
  const prompt = `
Create a two-attribute classification activity for teaching "${topic}" to ${gradeLevel} students.
${gradeGuidance(gradeLevel)}
${buildSortingObjectiveSection(topic, intent)}

TASK: Student finds objects matching TWO criteria at once. The PRIMARY criterion is always the objective-relevant category; the secondary criterion adds the two-attribute reasoning demand without replacing the lesson modality.
${tierSection}
Generate exactly ${count} challenges. Each challenge needs:
- A warm instruction that names the objective category first (e.g., "Which NEEDS are food?" or "Find the FIREFIGHTER tools")
- 6-8 objects. EVERY object must have an objective-relevant category plus the named secondary attribute.
- targetCategory: the objective category to match (e.g., 'need', 'firefighter', or 'triangle')
- secondaryAttribute: one of color, shape, size, or type
- secondaryValue: the value to match on that secondary attribute
- categoryLabel: a short human label that foregrounds the objective category

Objects must include:
- Some matching BOTH category and secondary attribute (correct answers)
- Some matching only the objective category (near-miss distractors)
- Some matching only the secondary attribute (near-miss distractors)
- Some matching neither (distractors)

The objective category is the MAIN modality. Never make color/size the knowledge being assessed unless the objective explicitly names it. Prefer a semantically relevant secondary type (food, tool, clothing) over color when the lesson supports one.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: twoAttributesSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) throw new Error('No two-attributes challenges returned');

  const challenges: SortingStationChallenge[] = data.challenges.slice(0, count).map(
    (ch: { instruction: string; objects: RawSortingObject[]; targetCategory: string; secondaryAttribute: string; secondaryValue: string; categoryLabel: string }, i: number) => {
      const objects = toLuminaObjects(ch.objects || [], i * 10);
      const allowedSecondaryAttributes = new Set(['color', 'shape', 'size', 'type']);
      const secondaryAttribute = allowedSecondaryAttributes.has(ch.secondaryAttribute)
        ? ch.secondaryAttribute
        : 'type';

      const targetRule: Record<string, string> = {
        category: ch.targetCategory,
        [secondaryAttribute]: ch.secondaryValue,
      };

      // Verify at least 1 object matches both and at least 1 doesn't
      const matchCount = objects.filter(o =>
        Object.entries(targetRule).every(([k, v]) => o.attributes[k] === v),
      ).length;

      // If the split is trivial, preserve the objective modality by falling back
      // to an objective-category sort (never to color/size/type).
      if (matchCount === 0 || matchCount === objects.length) {
        const categories = deriveCategories(objects, 'category');
        return {
          id: `c${i + 1}`,
          type: 'sort-by-one' as const,
          instruction: 'Sort these into their lesson groups.',
          sortingAttribute: 'category',
          objects,
          categories,
        } satisfies SortingStationChallenge;
      }

      return {
        id: `c${i + 1}`,
        type: 'two-attributes' as const,
        instruction: ch.instruction,
        sortingAttribute: `category + ${secondaryAttribute}`,
        objects,
        categories: [
          { label: ch.categoryLabel || `${ch.targetCategory} ${ch.secondaryValue}`, rule: targetRule },
          { label: 'Others', rule: {} }, // component uses "doesn't match first rule" logic
        ],
      } satisfies SortingStationChallenge;
    },
  );

  return { title: data.title, description: data.description, challenges };
}

/**
 * Objective binding for sort-variety (flexible classification). This is the R1
 * EXEMPTION recorded in the contract (G3): unlike every other mode, rotating the
 * sorting RULE across rounds IS the declared task — so this section INSTRUCTS the
 * axis-switch that buildSortingObjectiveSection forbids, while still fencing the
 * rotation to genuinely meaningful dimensions of the same on-topic object set
 * (never a perceptual axis picked for variety's sake). See docs/contracts/sorting-station.md.
 */
function buildVarietyObjectiveSection(topic: string, intent: string | undefined, rounds: number): string {
  const specificObjective = intent?.trim() || topic;
  return `
## OBJECTIVE BINDING — FLEXIBLE CLASSIFICATION (this mode's DECLARED task)
- Broad lesson topic: "${topic}"
- Specific objective for THIS activity: "${specificObjective}"
- The taught skill is FLEXIBLE CLASSIFICATION: the SAME set of objects can be correctly grouped in more than one way. Rotating the sorting RULE across rounds IS the objective — unlike a normal sort, you SHOULD change the sorting attribute each round.
- Provide ONE fixed set of objects, then ${rounds} rounds that each sort THOSE SAME objects by a DIFFERENT, genuinely meaningful dimension of them (for example: what kind of thing it is, how big it is, what it is used for, where it belongs).
- Every rotated dimension must be a REAL, sensible property of these specific objects. Do NOT invent a perceptual axis (like color) purely for variety if it is not a natural, meaningful property of the set.
- Keep every round on the same topic and the same object family; the variety comes from the RULE, never from swapping in an unrelated theme.
`;
}

/** Variety-mode objects: type, size, AND category are REQUIRED so the set always carries
 *  3 candidate axes (code then keeps whichever 2-3 actually split into groups). Forcing the
 *  fields is what makes flexible re-sorting reliable — an "at least two" ask flash-lite honors
 *  only ~half the time. */
const varietyObjectItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING, description: "Display label (e.g., 'Fire Truck')" },
    emoji: { type: Type.STRING, description: "Single emoji (e.g., '🚒')" },
    type: { type: Type.STRING, description: "What KIND it is — ONE simple lowercase word (e.g. 'truck', 'boat')." },
    size: { type: Type.STRING, description: "Size — ONE simple lowercase word, from a small shared set (e.g. 'big' or 'small')." },
    category: { type: Type.STRING, description: "A meaning group — ONE simple lowercase word, from a small shared set (e.g. 'land' or 'water')." },
  },
  required: ["label", "emoji", "type", "size", "category"],
};

/** sort-variety: one shared object set + N rounds, each round naming a different sort rule. */
const varietySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Fun title for the activity" },
    description: { type: Type.STRING, description: "Brief educational description" },
    objects: {
      type: Type.ARRAY,
      description: "ONE shared set of objects, each filling type, size, AND category with ONE simple lowercase word each (NEVER combine dimensions in a field, NEVER use slashes). Use a SMALL shared vocabulary so objects share groups (e.g. size is always 'big' or 'small'); each field must have 2+ distinct values across the set.",
      items: varietyObjectItemSchema,
    },
    rounds: {
      type: Type.ARRAY,
      description: "One entry per sorting rule you intend (code re-validates each against the objects). Each names a DIFFERENT single attribute field.",
      items: {
        type: Type.OBJECT,
        properties: {
          sortingAttribute: {
            type: Type.STRING,
            enum: ['category', 'type', 'size', 'shape', 'color'],
            description: "The ONE object field THIS round sorts by. MUST differ from every other round and MUST be a field you actually filled with 2+ distinct simple values across the objects.",
          },
          instruction: {
            type: Type.STRING,
            description: "Warm instruction naming THIS round's rule (e.g. 'Now sort them by size!').",
          },
          categoryEmojis: {
            type: Type.ARRAY,
            description: "One picture per bin for this round's values; a single emoji standing for the WHOLE group. NEVER reuse an object's own emoji.",
            items: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING, description: "The sortingAttribute value this bin holds" },
                emoji: { type: Type.STRING, description: "Single representative emoji for that whole group" },
              },
              required: ["value", "emoji"],
            },
          },
        },
        required: ["sortingAttribute", "instruction"],
      },
    },
  },
  required: ["title", "description", "objects", "rounds"],
};

async function generateVarietyChallenges(
  topic: string,
  intent: string | undefined,
  gradeLevel: string,
  count: number,
  tierSection: string,
): Promise<{ title: string; description: string; challenges: SortingStationChallenge[] }> {
  // 2-3 rounds is the flexible-classification sweet spot: enough to show the same
  // set groups multiple ways, few enough that every axis stays genuinely meaningful
  // (a 4th forced axis is where contrived perceptual sorts creep in).
  const roundCount = Math.min(3, Math.max(2, count - 1));

  const prompt = `
Create a FLEXIBLE-CLASSIFICATION sorting activity for teaching "${topic}" to ${gradeLevel} students.
${gradeGuidance(gradeLevel)}
${buildVarietyObjectiveSection(topic, intent, roundCount)}
${tierSection}
Provide ONE shared set of objects and ${roundCount} sorting rules.
- objects: 4-8 objects. Every object fills type, size, AND category, each with ONE simple lowercase word. Example: { "label": "Fire Truck", "emoji": "🚒", "type": "truck", "size": "big", "category": "land" }. NEVER put two ideas in one field, NEVER use slashes.
- Use a SMALL shared vocabulary so objects share groups (e.g. every object's size is 'big' or 'small'; category is 'land' or 'water'). Each field must have 2+ distinct values across the set so it forms real groups.
- rounds: ${roundCount} entries, each naming a DIFFERENT field (type / size / category), with a warm instruction naming that round's rule + categoryEmojis (one per group).
- Every round sorts the SAME objects; do not introduce new objects between rounds. Stay on the objective's topic and object family.
`;

  const binCap = gradeBinCap(resolveGradeBand(gradeLevel));

  // Build the rotated rounds from ONE generation. Code OWNS which axes are valid (derived
  // from the actual objects — each must split into 2..binCap real groups); the LLM only
  // supplies the object window + optional instruction/emoji hints. This makes "a different
  // rule each round" true by construction and caps bins at the grade band. Returns the
  // challenges (may be < 2 if the set is thin — the caller retries).
  const buildRounds = (data: {
    objects?: RawSortingObject[];
    rounds?: { sortingAttribute?: string; instruction?: string; categoryEmojis?: { value?: string; emoji?: string }[] }[];
  }): SortingStationChallenge[] => {
    const rawObjects = data.objects ?? [];
    const challenges: SortingStationChallenge[] = [];
    const usedAttrs = new Set<string>();

    const tryAddRound = (
      attr: string | undefined,
      instruction?: string,
      emojis?: { value?: string; emoji?: string }[],
    ): void => {
      const sortAttr = (attr || '').trim();
      if (!sortAttr || usedAttrs.has(sortAttr) || challenges.length >= roundCount) return;
      // Fresh object instances per round (same labels/attributes) so the orchestrator's
      // per-challenge id re-numbering stays independent; pedagogically it's still the same set.
      const objects = toLuminaObjects(rawObjects, challenges.length * 100);
      const groups = new Set(objects.map(o => o.attributes[sortAttr]).filter(Boolean));
      if (groups.size < 2 || groups.size > binCap) return; // must form 2..binCap real groups
      const categories = deriveCategories(objects, sortAttr, buildEmojiByValue(emojis));
      if (categories.length < 2) return;
      usedAttrs.add(sortAttr);
      challenges.push({
        id: `c${challenges.length + 1}`,
        type: 'sort-variety',
        instruction: instruction || `Sort them a new way — by ${sortAttr}!`,
        sortingAttribute: sortAttr,
        objects,
        categories,
      } satisfies SortingStationChallenge);
    };

    // 1. Honor the LLM's intended rounds first (keeps its instructions + emojis).
    for (const round of data.rounds ?? []) {
      tryAddRound(round.sortingAttribute, round.instruction, round.categoryEmojis);
    }
    // 2. Supplement from whatever OTHER required axes the objects carry, so a thin `rounds`
    //    still reaches roundCount. 'category' first (objective-relevant), then the rest.
    for (const attr of ['category', 'type', 'size', 'shape', 'color']) tryAddRound(attr);

    return challenges;
  };

  // Retry once: with type/size/category required, a single draw usually yields 2-3 axes, but
  // flash-lite occasionally collapses a field to one shared value (unsplittable). A second draw
  // almost always recovers; only then do we fail loudly rather than shipping a 1-rule "variety".
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: varietySchema },
    });
    const data = result.text ? JSON.parse(result.text) : null;
    if (!data?.objects?.length) continue;
    const challenges = buildRounds(data);
    if (challenges.length >= 2) {
      return { title: data.title, description: data.description, challenges };
    }
    console.warn(`[SortingStation] sort-variety attempt ${attempt + 1}: only ${challenges.length} rotatable rule(s), retrying`);
  }

  throw new Error('sort-variety: could not build 2+ rotatable rules after retry (object set lacked 2 separately-splittable axes)');
}

// ============================================================================
// Generator dispatch map
// ============================================================================

type SubGenerator = (
  topic: string,
  intent: string | undefined,
  gradeLevel: string,
  count: number,
  tierSection: string,
) => Promise<{ title: string; description: string; challenges: SortingStationChallenge[] }>;

const GENERATOR_MAP: Record<string, SubGenerator> = {
  'sort-by-one': (t, i, g, n, ts) => generateSortChallenges(t, i, g, 'sort-by-one', n, ts),
  'sort-by-attribute': (t, i, g, n, ts) => generateSortChallenges(t, i, g, 'sort-by-attribute', n, ts),
  'tally-record': (t, i, g, n, ts) => generateSortChallenges(t, i, g, 'tally-record', n, ts),
  'count-and-compare': generateCountCompareChallenges,
  'odd-one-out': generateOddOneOutChallenges,
  'two-attributes': generateTwoAttributesChallenges,
  'sort-variety': generateVarietyChallenges,
};

/**
 * The types an UNPINNED (mixed) session draws from. sort-variety is deliberately
 * EXCLUDED: it is a whole-session flexible-classification task (one shared set,
 * N rotated rules) — meaningless as a single interleaved challenge — so it runs
 * only when the eval mode is pinned or intent-resolved, never in a random mix.
 */
const MIXED_TYPES: readonly string[] = [
  'sort-by-one',
  'sort-by-attribute',
  'tally-record',
  'count-and-compare',
  'odd-one-out',
  'two-attributes',
];

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
  const { topic, intent } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as SortingStationConfig;
  const evalConstraint = resolveEvalModeConstraint(
    'sorting-station',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('SortingStation', config?.targetEvalMode, evalConstraint);

  const gradeBand = resolveGradeBand(gradeLevel);
  const allowedTypes = evalConstraint?.allowedTypes ?? MIXED_TYPES;

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
      .map(t => GENERATOR_MAP[t](topic, intent, gradeLevel, challengesPerType, tierSection)),
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
