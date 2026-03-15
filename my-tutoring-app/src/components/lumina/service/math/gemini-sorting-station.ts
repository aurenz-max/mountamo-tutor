import { Type, Schema } from "@google/genai";
import { SortingStationData } from "../../primitives/visual-primitives/math/SortingStation";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ============================================================================
// Eval Mode Docs — one entry per challenge type
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'sort-by-one': {
    promptDoc:
      `"sort-by-one": Sort objects by ONE visible attribute (color, shape, or size). Provide sortingAttribute and categories with matching rules. Example: Sort fruits by color into "Red" and "Yellow" bins.`,
    schemaDescription: "'sort-by-one' (single-attribute sort)",
  },
  'sort-by-attribute': {
    promptDoc:
      `"sort-by-attribute": Objects have multiple attributes; student picks how to sort. Provide sortingAttribute and categories. Objects should have multiple interesting attributes. Example: Sort animals — by size OR number of legs.`,
    schemaDescription: "'sort-by-attribute' (named-property sort)",
  },
  'count-and-compare': {
    promptDoc:
      `"count-and-compare": Objects are pre-sorted into groups. Student counts each group and answers a comparison question. Provide categories, comparisonQuestion, and correctComparison ('more', 'fewer', or 'equal'). Example: "Are there more red apples or green apples?"`,
    schemaDescription: "'count-and-compare' (quantify and compare groups)",
  },
  'odd-one-out': {
    promptDoc:
      `"odd-one-out": A group where one doesn't belong. Student identifies it. Provide oddOneOut (ID of the odd object) and oddOneOutReason. Example: 🍎🍊🍋🚗 — the car doesn't belong because it's not a fruit.`,
    schemaDescription: "'odd-one-out' (identify the exception)",
  },
  'two-attributes': {
    promptDoc:
      `"two-attributes": Find objects matching TWO attributes simultaneously. Provide categories with rules having EXACTLY two attribute keys. Use visually distinct emojis (prefer color + type). Do NOT use "size" as an attribute. Example: Find RED FRUITS → rule: { color: 'red', type: 'fruit' }.`,
    schemaDescription: "'two-attributes' (multi-criterion classification)",
  },
  'tally-record': {
    promptDoc:
      `"tally-record": Sort objects and record the count of each group using tallies. Provide categories. The showTallyChart flag should be true. Example: Sort the shapes and tally how many of each.`,
    schemaDescription: "'tally-record' (sort and tally counts)",
  },
};

/**
 * Schema definition for Sorting Station Data
 *
 * This schema defines the structure for sorting and categorization activities,
 * including attribute-based sorting, count-and-compare, odd-one-out,
 * and tally recording for K-1 data and classification skills.
 *
 * Each challenge presents objects with attributes that students sort
 * into categories based on rules.
 */
const sortingStationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the sorting activity (e.g., 'Sort the Animals!', 'Fruit Color Sort')"
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
            description: "Unique challenge ID (e.g., 'c1', 'c2')"
          },
          type: {
            type: Type.STRING,
            description: "Challenge type: 'sort-by-one', 'sort-by-attribute', 'count-and-compare', 'two-attributes', 'odd-one-out', 'tally-record'"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging (e.g., 'Can you sort the animals by color?')"
          },
          objects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: {
                  type: Type.STRING,
                  description: "Unique object ID (e.g., 'obj1', 'obj2')"
                },
                label: {
                  type: Type.STRING,
                  description: "Display label for the object (e.g., 'Red Apple', 'Blue Bird')"
                },
                emoji: {
                  type: Type.STRING,
                  description: "Single emoji representing the object (e.g., '🍎', '🐦')"
                },
                attributes: {
                  type: Type.OBJECT,
                  properties: {
                    color: {
                      type: Type.STRING,
                      description: "Color attribute (e.g., 'red', 'blue', 'green')"
                    },
                    shape: {
                      type: Type.STRING,
                      description: "Shape attribute (e.g., 'round', 'square', 'triangle')"
                    },
                    size: {
                      type: Type.STRING,
                      description: "Size attribute (e.g., 'big', 'small', 'medium')"
                    },
                    type: {
                      type: Type.STRING,
                      description: "Type/category attribute (e.g., 'fruit', 'animal', 'vehicle')"
                    }
                  },
                  description: "Key-value pairs of object attributes used for sorting"
                }
              },
              required: ["id", "label", "emoji", "attributes"]
            },
            description: "Array of sortable objects with attributes"
          },
          sortingAttribute: {
            type: Type.STRING,
            description: "The attribute to sort by (e.g., 'color', 'shape', 'size'). Used for sort-by-one and sort-by-attribute types."
          },
          categories: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: {
                  type: Type.STRING,
                  description: "Display label for the category (e.g., 'Red Things', 'Big Animals')"
                },
                rule: {
                  type: Type.OBJECT,
                  properties: {
                    color: {
                      type: Type.STRING,
                      description: "Color value to match"
                    },
                    shape: {
                      type: Type.STRING,
                      description: "Shape value to match"
                    },
                    size: {
                      type: Type.STRING,
                      description: "Size value to match"
                    },
                    type: {
                      type: Type.STRING,
                      description: "Type value to match"
                    }
                  },
                  description: "Rule defining which objects belong in this category (attribute key-value pairs to match)"
                }
              },
              required: ["label", "rule"]
            },
            description: "Categories to sort objects into. Required for sort-by-one, sort-by-attribute, count-and-compare, two-attributes, and tally-record."
          },
          oddOneOut: {
            type: Type.STRING,
            description: "ID of the object that doesn't belong (for odd-one-out challenges)"
          },
          oddOneOutReason: {
            type: Type.STRING,
            description: "Explanation of why this object doesn't belong (e.g., 'It's the only one that isn't round')"
          },
          comparisonQuestion: {
            type: Type.STRING,
            description: "Question about comparing sorted groups (e.g., 'Which group has more?'). For count-and-compare."
          },
          correctComparison: {
            type: Type.STRING,
            description: "Correct answer to comparison: 'more', 'fewer', or 'equal'. For count-and-compare."
          }
        },
        required: ["id", "type", "instruction", "objects"]
      },
      description: "Array of 3-5 progressive sorting challenges"
    },
    maxCategories: {
      type: Type.NUMBER,
      description: "Maximum number of sorting categories (2-4 for K-1)"
    },
    showCounts: {
      type: Type.BOOLEAN,
      description: "Whether to show count badges on categories"
    },
    showTallyChart: {
      type: Type.BOOLEAN,
      description: "Whether to show a tally chart for recording counts"
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' for Kindergarten, '1' for Grade 1"
    }
  },
  required: ["title", "challenges", "maxCategories", "showCounts", "showTallyChart", "gradeBand"]
};

/**
 * Generate sorting station data for interactive categorization activities
 *
 * Grade-aware content:
 * - Kindergarten: sort by one attribute (color/shape/size), 2-3 categories, simple objects
 * - Grade 1: sort by multiple attributes, odd-one-out reasoning, tally recording, comparisons
 *
 * Each challenge presents objects that students sort into categories based on rules.
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns SortingStationData with complete configuration
 */
interface SortingStationConfig {
  difficulty?: number;
  challengeTypes?: string[];
  maxCategories?: number;
  /** Target eval mode from the IRT calibration system. */
  targetEvalMode?: string;
}

export const generateSortingStation = async (
  topic: string,
  gradeLevel: string,
  config?: SortingStationConfig
): Promise<SortingStationData> => {
  // Resolve eval mode constraint (null = mixed difficulty)
  const evalConstraint = resolveEvalModeConstraint(
    'sorting-station',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('SortingStation', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(sortingStationSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : sortingStationSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create an educational sorting and categorization activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A sorting station is a workspace where students drag objects into categories
- Students learn to classify, sort by attributes, compare groups, and record data
- Key skills: attribute recognition, categorization, data organization, comparison, tallying
- Each challenge has its own set of objects and sorting rules

GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * Sort by ONE visible attribute at a time (color, shape, or size)
  * Use 2-3 categories maximum
  * 4-8 objects per challenge (keep it manageable)
  * Use very familiar, concrete objects kids know (animals, fruits, toys)
  * Simple, warm language ("Can you put the red ones together?")

- Grade 1 (gradeBand "1"):
  * Sort by one or two attributes
  * Use 2-4 categories
  * 5-10 objects per challenge
  * Introduce reasoning ("Why doesn't this one belong?")
  * Connect sorting to data collection and graphing concepts

${challengeTypeSection}

ADDITIONAL RULES FOR CHALLENGE TYPES:
- "sort-by-one": MUST have ≥2 categories. Every object MUST match exactly one category via its attributes. The instruction MUST ask students to sort/group — NEVER ask "which group has more" (that's count-and-compare) or "which doesn't belong" (that's odd-one-out).
- "sort-by-attribute": Same rules as sort-by-one — every object must fit a category.
- "two-attributes": Both attributes must be VISUALLY DISTINGUISHABLE through different emojis. Prefer color + type. Do NOT use "size". Use distinct emojis per combination.
- "count-and-compare": correctComparison must be 'more', 'fewer', or 'equal'.
- "odd-one-out": oddOneOut must be an object ID that appears in the objects array.
- "tally-record": set showTallyChart to true. Every object must match exactly one category. Category labels must match what the rule actually selects (e.g., if rule is {type: insect}, label must be "Insects", NOT "Insects & Amphibians").

${config ? `
CONFIGURATION HINTS:
${config.difficulty !== undefined ? `- Difficulty level (1-3): ${config.difficulty}` : ''}
${config.maxCategories !== undefined ? `- Max categories: ${config.maxCategories}` : ''}
` : ''}

REQUIREMENTS:
1. Generate 3-5 challenges${!evalConstraint ? ' that progress in difficulty' : ' all using the allowed challenge type(s) above'}
2. Use FUN, kid-friendly emojis for every object (single emoji per object)
3. Give each object a clear label and meaningful attributes
4. Object IDs should be unique across all challenges (e.g., 'obj1', 'obj2', ...)
5. Use warm, encouraging instruction text for young children
6. Every category rule must use attribute keys that exist on the objects
7. Make sure each challenge's objects have the attributes needed for sorting
8. Use age-appropriate vocabulary and themes kids love (animals, food, toys, nature)
9. Set maxCategories to the highest number of categories used across all challenges
10. Set showCounts to true so students see how many objects are in each bin
11. Set showTallyChart to true if any tally-record challenges are included

Return the complete sorting station configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid sorting station data returned from Gemini API');
  }

  // Validation: ensure gradeBand is valid
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  // Validation: ensure maxCategories is sensible
  if (!data.maxCategories || data.maxCategories < 2) {
    data.maxCategories = data.gradeBand === 'K' ? 3 : 4;
  }
  if (data.maxCategories > 6) {
    data.maxCategories = data.gradeBand === 'K' ? 3 : 4;
  }

  // Validation: ensure showCounts has a default
  if (data.showCounts === undefined || data.showCounts === null) {
    data.showCounts = true;
  }

  // Validation: ensure showTallyChart has a default
  if (data.showTallyChart === undefined || data.showTallyChart === null) {
    data.showTallyChart = false;
  }

  // Validate challenge types
  const validChallengeTypes = evalConstraint?.allowedTypes ?? [
    'sort-by-one', 'sort-by-attribute', 'count-and-compare',
    'two-attributes', 'odd-one-out', 'tally-record'
  ];

  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // Per-challenge validation
  for (const challenge of data.challenges) {
    // Ensure objects array exists
    if (!Array.isArray(challenge.objects)) {
      challenge.objects = [];
    }

    // Ensure each object has required fields
    for (const obj of challenge.objects) {
      if (!obj.id) obj.id = `obj_${Math.random().toString(36).slice(2, 7)}`;
      if (!obj.label) obj.label = obj.emoji || 'Object';
      if (!obj.emoji) obj.emoji = '⭐';
      if (!obj.attributes || typeof obj.attributes !== 'object') {
        obj.attributes = {};
      }
      // Strip "size" from two-attributes objects — not visually distinguishable
      if (challenge.type === 'two-attributes') {
        delete obj.attributes.size;
      }
    }

    // Ensure categories have valid structure when present
    if (Array.isArray(challenge.categories)) {
      for (const cat of challenge.categories) {
        if (!cat.label) cat.label = 'Group';
        if (!cat.rule || typeof cat.rule !== 'object') {
          cat.rule = {};
        }
      }
    }

    // ── Fix: sort-by-one / tally-record must have ≥2 categories covering ALL objects ──
    if (
      (challenge.type === 'sort-by-one' || challenge.type === 'sort-by-attribute' || challenge.type === 'tally-record') &&
      Array.isArray(challenge.categories) &&
      challenge.objects.length > 0
    ) {
      const sortAttr = challenge.sortingAttribute || 'type';

      // Rebuild categories from actual object attribute values so every object has a bin
      const valueSet = new Set<string>();
      for (const obj of challenge.objects) {
        const val = obj.attributes[sortAttr];
        if (val) valueSet.add(val);
      }

      // Only rebuild if fewer categories than distinct values (i.e. some objects are orphaned)
      if (valueSet.size > challenge.categories.length || challenge.categories.length < 2) {
        challenge.categories = Array.from(valueSet).map((val: string) => ({
          label: val.charAt(0).toUpperCase() + val.slice(1),
          rule: { [sortAttr]: val },
        }));
      } else {
        // Even if category count looks right, verify every object matches at least one
        const orphaned = challenge.objects.filter((obj: { attributes: Record<string, string> }) =>
          !challenge.categories.some((cat: { rule: Record<string, string> }) =>
            Object.entries(cat.rule).every(([k, v]) => obj.attributes[k] === v)
          )
        );
        if (orphaned.length > 0) {
          // Add missing categories for orphaned objects' attribute values
          const missingValues = new Set<string>();
          for (const obj of orphaned) {
            const val = obj.attributes[sortAttr];
            if (val) missingValues.add(val);
          }
          for (const val of missingValues) {
            if (!challenge.categories.some((c: { rule: Record<string, string> }) => c.rule[sortAttr] === val)) {
              challenge.categories.push({
                label: val.charAt(0).toUpperCase() + val.slice(1),
                rule: { [sortAttr]: val },
              });
            }
          }
        }
      }
    }

    // ── Fix: sort-by-one instructions must not contain patterns from other modes ──
    if (challenge.type === 'sort-by-one' && challenge.instruction) {
      const lowerInst = challenge.instruction.toLowerCase();
      // If instruction asks "which group has more" → retype as count-and-compare
      if (lowerInst.includes('which group has more') || lowerInst.includes('which has more') || lowerInst.includes('are there more')) {
        if (evalConstraint?.allowedTypes.includes('count-and-compare')) {
          challenge.type = 'count-and-compare';
          if (!challenge.correctComparison) challenge.correctComparison = 'more';
          if (!challenge.comparisonQuestion) challenge.comparisonQuestion = challenge.instruction;
        } else {
          // Can't retype — rewrite instruction to match sort-by-one
          const attr = challenge.sortingAttribute || 'type';
          challenge.instruction = `Can you sort these by ${attr}?`;
        }
      }
      // If instruction asks "odd one out" / "doesn't belong" → retype or rewrite
      if (lowerInst.includes('odd one out') || lowerInst.includes("doesn't belong") || lowerInst.includes('does not belong')) {
        if (evalConstraint?.allowedTypes.includes('odd-one-out')) {
          challenge.type = 'odd-one-out';
          if (!challenge.oddOneOut && challenge.objects.length > 0) {
            challenge.oddOneOut = challenge.objects[challenge.objects.length - 1].id;
          }
          if (!challenge.oddOneOutReason) challenge.oddOneOutReason = 'This one is different from the others.';
        } else {
          const attr = challenge.sortingAttribute || 'type';
          challenge.instruction = `Can you sort these by ${attr}?`;
        }
      }
    }

    // Validate two-attributes challenges
    if (challenge.type === 'two-attributes' && Array.isArray(challenge.categories)) {
      // Collect the set of attribute keys that actually exist on objects
      const objectAttrKeys = new Set<string>();
      for (const obj of challenge.objects) {
        for (const k of Object.keys(obj.attributes)) {
          if (obj.attributes[k]) objectAttrKeys.add(k); // skip empty values
        }
      }
      const availableKeys = Array.from(objectAttrKeys);

      for (const cat of challenge.categories) {
        if (!cat.rule || typeof cat.rule !== 'object') {
          cat.rule = {};
        }

        // Strip "size" from rules (already stripped from objects above)
        delete cat.rule.size;

        // Remove rule keys that don't exist on any object or have empty values
        for (const key of Object.keys(cat.rule)) {
          if (!objectAttrKeys.has(key) || !cat.rule[key]) {
            delete cat.rule[key];
          }
        }

        // If rule has fewer than 2 valid keys, rebuild from object attributes
        if (Object.keys(cat.rule).length < 2 && availableKeys.length >= 2) {
          // Find an object that produces a non-trivial split (some match, some don't)
          let bestRule: Record<string, string> | null = null;
          for (const obj of challenge.objects) {
            const candidateRule: Record<string, string> = {};
            candidateRule[availableKeys[0]] = obj.attributes[availableKeys[0]] || '';
            candidateRule[availableKeys[1]] = obj.attributes[availableKeys[1]] || '';
            // Skip if either value is empty
            if (!candidateRule[availableKeys[0]] || !candidateRule[availableKeys[1]]) continue;
            const matchCount = challenge.objects.filter((o: { attributes: Record<string, string> }) =>
              Object.entries(candidateRule).every(([k, v]) => o.attributes[k] === v)
            ).length;
            // Good split: some match, some don't
            if (matchCount > 0 && matchCount < challenge.objects.length) {
              bestRule = candidateRule;
              break;
            }
          }
          if (bestRule) {
            cat.rule = bestRule;
            cat.label = `${bestRule[availableKeys[0]]} ${bestRule[availableKeys[1]]}`.trim();
          }
        }
      }

      // Final safety: verify that the first category rule matches at least 1 (but not all) objects
      const cats = challenge.categories;
      if (cats.length > 0) {
        const rule = cats[0].rule;
        const ruleKeys = Object.keys(rule);
        const matchCount = challenge.objects.filter((o: { attributes: Record<string, string> }) =>
          ruleKeys.length >= 2 && ruleKeys.every(k => o.attributes[k] === rule[k])
        ).length;
        if (matchCount === 0 || matchCount === challenge.objects.length) {
          // Unsolvable or trivial — downgrade to sort-by-one so it's still usable
          challenge.type = 'sort-by-one';
          const firstKey = availableKeys[0] || 'type';
          challenge.sortingAttribute = firstKey;
          const values = new Set(
            challenge.objects.map((o: { attributes: Record<string, string> }) => o.attributes[firstKey]).filter(Boolean)
          );
          challenge.categories = Array.from(values).map((val: unknown) => {
            const v = String(val);
            return {
              label: v.charAt(0).toUpperCase() + v.slice(1),
              rule: { [firstKey]: v },
            };
          });
        }
      }
    }

    // Validate odd-one-out challenges
    if (challenge.type === 'odd-one-out') {
      const objectIds = challenge.objects.map((o: { id: string }) => o.id);
      if (challenge.oddOneOut && !objectIds.includes(challenge.oddOneOut)) {
        // Fall back to first object if the specified ID doesn't exist
        challenge.oddOneOut = objectIds[0] || undefined;
      }
      if (!challenge.oddOneOutReason) {
        challenge.oddOneOutReason = 'This one is different from the others.';
      }
    }

    // Validate count-and-compare challenges
    if (challenge.type === 'count-and-compare') {
      const validComparisons = ['more', 'fewer', 'equal'];
      if (!validComparisons.includes(challenge.correctComparison)) {
        challenge.correctComparison = 'more';
      }
      if (!challenge.comparisonQuestion) {
        challenge.comparisonQuestion = 'Which group has more?';
      }
    }

    // Enable tally chart if tally-record challenges exist
    if (challenge.type === 'tally-record') {
      data.showTallyChart = true;
    }
  }

  // Ensure at least one challenge
  if (data.challenges.length === 0) {
    const fallbackType = (evalConstraint?.allowedTypes[0] ?? 'sort-by-one') as 'sort-by-one';
    data.challenges = [{
      id: 'c1',
      type: fallbackType,
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
  }

  // Apply config overrides
  if (config) {
    if (config.maxCategories !== undefined) {
      data.maxCategories = config.maxCategories;
    }
  }

  return data as SortingStationData;
};
