import { Type, Schema } from "@google/genai";
import {
  SortingStationData,
  SortingStationChallenge,
  SortingObject,
  SortingCategory,
} from "../../primitives/visual-primitives/math/SortingStation";
import { ai } from "../geminiClient";
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
): Promise<{ title: string; description: string; challenges: SortingStationChallenge[] }> {
  const typeGuide = {
    'sort-by-one':
      'Each challenge sorts by ONE attribute (color, shape, size, or type). ' +
      'Use a DIFFERENT sorting attribute for each challenge to create variety. ' +
      'Instruction MUST ask students to sort/group — NEVER ask "which has more" or "which doesn\'t belong".',
    'sort-by-attribute':
      'Objects have multiple interesting attributes. Student picks HOW to sort. ' +
      'Give objects at least 2-3 meaningful attributes so there are multiple valid sort criteria.',
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
): Promise<{ title: string; description: string; challenges: SortingStationChallenge[] }> {
  const prompt = `
Create a count-and-compare activity for teaching "${topic}" to ${gradeLevel} students.
${gradeGuidance(gradeLevel)}

TASK: Objects are pre-sorted into groups. Student counts each group and answers a comparison question.

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
): Promise<{ title: string; description: string; challenges: SortingStationChallenge[] }> {
  const prompt = `
Create an odd-one-out activity for teaching "${topic}" to ${gradeLevel} students.
${gradeGuidance(gradeLevel)}

TASK: Show a group of objects where ONE doesn't belong. Student finds it.

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
): Promise<{ title: string; description: string; challenges: SortingStationChallenge[] }> {
  const prompt = `
Create a two-attribute classification activity for teaching "${topic}" to ${gradeLevel} students.
${gradeGuidance(gradeLevel)}

TASK: Student finds objects matching TWO attributes at once (e.g., "Find red fruits").

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
) => Promise<{ title: string; description: string; challenges: SortingStationChallenge[] }>;

const GENERATOR_MAP: Record<string, SubGenerator> = {
  'sort-by-one': (t, g, n) => generateSortChallenges(t, g, 'sort-by-one', n),
  'sort-by-attribute': (t, g, n) => generateSortChallenges(t, g, 'sort-by-attribute', n),
  'tally-record': (t, g, n) => generateSortChallenges(t, g, 'tally-record', n),
  'count-and-compare': generateCountCompareChallenges,
  'odd-one-out': generateOddOneOutChallenges,
  'two-attributes': generateTwoAttributesChallenges,
};

// ============================================================================
// Orchestrator — delegates to sub-generators, runs in parallel, combines
// ============================================================================

interface SortingStationConfig {
  difficulty?: number;
  challengeTypes?: string[];
  maxCategories?: number;
  targetEvalMode?: string;
}

export const generateSortingStation = async (
  topic: string,
  gradeLevel: string,
  config?: SortingStationConfig,
): Promise<SortingStationData> => {
  const evalConstraint = resolveEvalModeConstraint(
    'sorting-station',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('SortingStation', config?.targetEvalMode, evalConstraint);

  const gradeBand = resolveGradeBand(gradeLevel);
  const allowedTypes = evalConstraint?.allowedTypes ?? Object.keys(GENERATOR_MAP);

  // Determine how many challenges each sub-generator should produce.
  // Constrained (single type): 4 challenges from one generator.
  // Mixed (unconstrained): 1 challenge per type, run all in parallel.
  const isSingleMode = allowedTypes.length === 1;
  const challengesPerType = isSingleMode ? 4 : 1;

  // Launch all allowed sub-generators in parallel
  const results = await Promise.all(
    allowedTypes
      .filter(t => GENERATOR_MAP[t])
      .map(t => GENERATOR_MAP[t](topic, gradeLevel, challengesPerType)),
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

      // Re-number object IDs to be globally unique
      for (const obj of ch.objects) {
        globalObjId++;
        obj.id = `obj${globalObjId}`;
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

  return {
    title: title || 'Sorting Station',
    description: description || 'Sort objects into groups!',
    challenges: allChallenges,
    maxCategories: Math.min(maxCategories, gradeBand === 'K' ? 3 : 4),
    showCounts: true,
    showTallyChart: allChallenges.some(ch => ch.type === 'tally-record'),
    gradeBand,
  };
};
