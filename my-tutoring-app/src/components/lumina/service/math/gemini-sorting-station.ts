import { Type, Schema } from "@google/genai";
import { SortingStationData } from "../../primitives/visual-primitives/math/SortingStation";
import { ai } from "../geminiClient";

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
export const generateSortingStation = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{
    difficulty: number;
    challengeTypes: string[];
    maxCategories: number;
  }>
): Promise<SortingStationData> => {
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
  * Focus on sort-by-one, simple odd-one-out

- Grade 1 (gradeBand "1"):
  * Sort by one or two attributes
  * Use 2-4 categories
  * 5-10 objects per challenge
  * Include count-and-compare and tally-record challenges
  * Introduce reasoning ("Why doesn't this one belong?")
  * Connect sorting to data collection and graphing concepts

CHALLENGE TYPES (use a mix appropriate for the grade):
1. "sort-by-one": Sort objects by one visible attribute (color, shape, or size).
   - Provide sortingAttribute (e.g., "color") and categories with matching rules.
   - Example: Sort fruits by color into "Red" and "Yellow" bins.

2. "sort-by-attribute": Objects have multiple attributes; student picks how to sort.
   - Provide sortingAttribute and categories. Objects should have multiple interesting attributes.
   - Example: Sort animals — you could sort by size OR by number of legs.

3. "count-and-compare": Objects are pre-sorted into groups. Student counts each group and answers a comparison question.
   - Provide categories (pre-filled), comparisonQuestion, and correctComparison ('more', 'fewer', or 'equal').
   - Example: "Are there more red apples or green apples?"

4. "two-attributes": Find objects matching TWO attributes simultaneously.
   - Provide categories with rules that have EXACTLY two attribute keys.
   - IMPORTANT: Both attributes must be VISUALLY DISTINGUISHABLE through different emojis.
     Prefer color + type (e.g., "red fruit") or shape + type (e.g., "round animal").
     Do NOT use "size" as one of the two attributes — emojis cannot show size differences.
   - Use distinct emojis so each combination is visually unique (e.g., 🍎 for red fruit, 🐦 for blue animal).
   - Example: Find all the RED FRUITS → rule: { color: 'red', type: 'fruit' } with objects like 🍎🍒 matching and 🔵🐕 not matching.

5. "odd-one-out": A group where one doesn't belong. Student identifies it.
   - Provide oddOneOut (ID of the odd object) and oddOneOutReason.
   - Example: 🍎🍊🍋🚗 — the car doesn't belong because it's not a fruit.

6. "tally-record": Sort objects and record the count of each group using tallies.
   - Provide categories. The showTallyChart flag should be true.
   - Example: Sort the shapes and tally how many of each.

${config ? `
CONFIGURATION HINTS:
${config.difficulty !== undefined ? `- Difficulty level (1-3): ${config.difficulty}` : ''}
${config.challengeTypes ? `- Preferred challenge types: ${config.challengeTypes.join(', ')}` : ''}
${config.maxCategories !== undefined ? `- Max categories: ${config.maxCategories}` : ''}
` : ''}

REQUIREMENTS:
1. Generate 3-5 challenges that progress in difficulty
2. Use FUN, kid-friendly emojis for every object (single emoji per object)
3. Give each object a clear label and meaningful attributes
4. Object IDs should be unique across all challenges (e.g., 'obj1', 'obj2', ...)
5. Use warm, encouraging instruction text for young children
6. For Kindergarten: focus on sort-by-one and odd-one-out; use 2-3 categories; 4-8 objects
7. For Grade 1: include count-and-compare, two-attributes, and tally-record; up to 4 categories; 5-10 objects
8. Every category rule must use attribute keys that exist on the objects
9. For odd-one-out: the oddOneOut value must be an object ID that appears in the objects array
10. For count-and-compare: correctComparison must be 'more', 'fewer', or 'equal'
11. Make sure each challenge's objects have the attributes needed for sorting
12. Use age-appropriate vocabulary and themes kids love (animals, food, toys, nature)
13. Set maxCategories to the highest number of categories used across all challenges
14. Set showCounts to true so students see how many objects are in each bin
15. Set showTallyChart to true if any tally-record challenges are included

Return the complete sorting station configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: sortingStationSchema
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
  const validChallengeTypes = [
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

    // Validate two-attributes challenges: ensure the rule has at least 2 keys.
    // Note: we no longer strip "size" from rules because language/semantic challenges
    // (e.g. Parts of Speech) legitimately use "size" as a semantic attribute.
    // The prompt already discourages visual-size usage for emoji-based challenges.
    if (challenge.type === 'two-attributes' && Array.isArray(challenge.categories)) {
      for (const cat of challenge.categories) {
        if (cat.rule && typeof cat.rule === 'object') {
          const keys = Object.keys(cat.rule);
          if (keys.length < 2) {
            // Derive a sensible two-key rule from the objects' attributes
            const attrKeys = new Set<string>();
            for (const obj of challenge.objects) {
              for (const k of Object.keys(obj.attributes)) {
                attrKeys.add(k);
              }
            }
            const available = Array.from(attrKeys);
            if (available.length >= 2) {
              const first = challenge.objects[0];
              if (first) {
                cat.rule = {};
                cat.rule[available[0]] = first.attributes[available[0]] || '';
                cat.rule[available[1]] = first.attributes[available[1]] || '';
                cat.label = `${cat.rule[available[0]]} ${cat.rule[available[1]]}`.trim();
              }
            }
          }
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
    data.challenges = [{
      id: 'c1',
      type: 'sort-by-one' as const,
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
