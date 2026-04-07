import { Type, Schema } from "@google/genai";
import type {
  CompareObjectsData,
  CompareObjectsChallenge,
  CompareObject,
} from "../../primitives/visual-primitives/math/CompareObjects";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify_attribute: {
    promptDoc:
      `"identify_attribute": Two objects shown. Student picks which measurable attribute `
      + `(length, height, weight, capacity) can be compared between them. `
      + `attributeOptions has 3-4 choices, one is correctAttribute. `
      + `Both objects differ visually in the correct attribute. `
      + `K: concrete objects (pencil vs crayon), Grade 1: varied contexts.`,
    schemaDescription: "'identify_attribute' (pick the measurable attribute)",
  },
  compare_two: {
    promptDoc:
      `"compare_two": Two objects shown. Student picks which is taller/shorter/heavier/etc. `
      + `correctAnswer must be one of the two object names. `
      + `comparisonWord describes the comparison ('longer','shorter','taller','shorter_height','heavier','lighter','holds_more','holds_less'). `
      + `Objects must have clearly different actualValues so the answer is unambiguous. `
      + `visualSize should reflect the actual difference so the visual matches reality.`,
    schemaDescription: "'compare_two' (which object is taller/heavier/longer)",
  },
  order_three: {
    promptDoc:
      `"order_three": Three objects shown. Student orders them by attribute. `
      + `correctAnswer is comma-separated names in the correct order (smallest to largest or vice versa based on comparisonWord). `
      + `comparisonWord is the ordering direction. `
      + `All three objects MUST have distinct actualValues so the ordering is unambiguous. `
      + `visualSize values should reflect the relative differences.`,
    schemaDescription: "'order_three' (order 3 objects by attribute)",
  },
  non_standard: {
    promptDoc:
      `"non_standard": One object measured using non-standard units (paper clips, cubes, crayons). `
      + `attribute is always 'length'. unitName is the measuring unit. `
      + `unitCount is an integer (2-10) representing how many units fit. `
      + `The object's visualSize should be proportional: visualSize = unitCount * 10 (roughly). `
      + `K: simple objects (pencil, book), small unitCounts (2-5). Grade 1: up to 10.`,
    schemaDescription: "'non_standard' (measure with non-standard units)",
  },
};

// ---------------------------------------------------------------------------
// Per-type schemas (flat fields, no arrays inside challenges)
// ---------------------------------------------------------------------------

function buildIdentifyAttributeSchema(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Activity title" },
      description: { type: Type.STRING, description: "Brief educational description" },
      gradeBand: { type: Type.STRING, description: "Grade band: 'K' or '1'" },
      challenges: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Unique ID (e.g. 'ia1')" },
            instruction: { type: Type.STRING, description: "Student instruction (e.g. 'What can we measure about these objects?')" },
            attribute: { type: Type.STRING, description: "The correct measurable attribute: 'length', 'height', 'weight', or 'capacity'" },
            hint: { type: Type.STRING, description: "Hint for wrong answers" },
            // Flat object fields
            obj0Name: { type: Type.STRING, description: "First object name (e.g. 'pencil')" },
            obj0VisualSize: { type: Type.NUMBER, description: "First object relative visual size 10-90" },
            obj0ActualValue: { type: Type.NUMBER, description: "First object hidden measurement value" },
            obj1Name: { type: Type.STRING, description: "Second object name (e.g. 'crayon')" },
            obj1VisualSize: { type: Type.NUMBER, description: "Second object relative visual size 10-90" },
            obj1ActualValue: { type: Type.NUMBER, description: "Second object hidden measurement value" },
            // Flat attribute options
            correctAttribute: { type: Type.STRING, description: "The correct attribute (must match 'attribute' field)" },
            attrOption0: { type: Type.STRING, description: "First attribute choice" },
            attrOption1: { type: Type.STRING, description: "Second attribute choice" },
            attrOption2: { type: Type.STRING, description: "Third attribute choice" },
            attrOption3: { type: Type.STRING, description: "Fourth attribute choice (optional distractor)" },
          },
          required: [
            "id", "instruction", "attribute", "hint",
            "obj0Name", "obj0VisualSize", "obj0ActualValue",
            "obj1Name", "obj1VisualSize", "obj1ActualValue",
            "correctAttribute", "attrOption0", "attrOption1", "attrOption2",
          ],
        },
        description: "Array of 4 identify_attribute challenges",
      },
    },
    required: ["title", "description", "gradeBand", "challenges"],
  };
}

function buildCompareTwoSchema(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Activity title" },
      description: { type: Type.STRING, description: "Brief educational description" },
      gradeBand: { type: Type.STRING, description: "Grade band: 'K' or '1'" },
      challenges: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Unique ID (e.g. 'ct1')" },
            instruction: { type: Type.STRING, description: "Student instruction (e.g. 'Which is taller?')" },
            attribute: { type: Type.STRING, description: "Attribute being compared: 'length', 'height', 'weight', or 'capacity'" },
            comparisonWord: { type: Type.STRING, description: "Comparison word: 'longer','shorter','taller','shorter_height','heavier','lighter','holds_more','holds_less'" },
            correctAnswer: { type: Type.STRING, description: "Name of the object that wins the comparison (MUST match obj0Name or obj1Name)" },
            hint: { type: Type.STRING, description: "Hint for wrong answers" },
            obj0Name: { type: Type.STRING, description: "First object name" },
            obj0VisualSize: { type: Type.NUMBER, description: "First object relative visual size 10-90" },
            obj0ActualValue: { type: Type.NUMBER, description: "First object hidden measurement value" },
            obj1Name: { type: Type.STRING, description: "Second object name" },
            obj1VisualSize: { type: Type.NUMBER, description: "Second object relative visual size 10-90" },
            obj1ActualValue: { type: Type.NUMBER, description: "Second object hidden measurement value" },
          },
          required: [
            "id", "instruction", "attribute", "comparisonWord", "correctAnswer", "hint",
            "obj0Name", "obj0VisualSize", "obj0ActualValue",
            "obj1Name", "obj1VisualSize", "obj1ActualValue",
          ],
        },
        description: "Array of 5 compare_two challenges",
      },
    },
    required: ["title", "description", "gradeBand", "challenges"],
  };
}

function buildOrderThreeSchema(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Activity title" },
      description: { type: Type.STRING, description: "Brief educational description" },
      gradeBand: { type: Type.STRING, description: "Grade band: 'K' or '1'" },
      challenges: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Unique ID (e.g. 'ot1')" },
            instruction: { type: Type.STRING, description: "Student instruction (e.g. 'Put these in order from shortest to tallest')" },
            attribute: { type: Type.STRING, description: "Attribute: 'length', 'height', 'weight', or 'capacity'" },
            comparisonWord: { type: Type.STRING, description: "Ordering direction: 'longer','shorter','taller','shorter_height','heavier','lighter','holds_more','holds_less'" },
            hint: { type: Type.STRING, description: "Hint for wrong answers" },
            obj0Name: { type: Type.STRING, description: "First object name" },
            obj0VisualSize: { type: Type.NUMBER, description: "First object relative visual size 10-90" },
            obj0ActualValue: { type: Type.NUMBER, description: "First object hidden measurement value" },
            obj1Name: { type: Type.STRING, description: "Second object name" },
            obj1VisualSize: { type: Type.NUMBER, description: "Second object relative visual size 10-90" },
            obj1ActualValue: { type: Type.NUMBER, description: "Second object hidden measurement value" },
            obj2Name: { type: Type.STRING, description: "Third object name" },
            obj2VisualSize: { type: Type.NUMBER, description: "Third object relative visual size 10-90" },
            obj2ActualValue: { type: Type.NUMBER, description: "Third object hidden measurement value" },
          },
          required: [
            "id", "instruction", "attribute", "comparisonWord", "hint",
            "obj0Name", "obj0VisualSize", "obj0ActualValue",
            "obj1Name", "obj1VisualSize", "obj1ActualValue",
            "obj2Name", "obj2VisualSize", "obj2ActualValue",
          ],
        },
        description: "Array of 4 order_three challenges",
      },
    },
    required: ["title", "description", "gradeBand", "challenges"],
  };
}

function buildNonStandardSchema(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Activity title" },
      description: { type: Type.STRING, description: "Brief educational description" },
      gradeBand: { type: Type.STRING, description: "Grade band: 'K' or '1'" },
      challenges: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Unique ID (e.g. 'ns1')" },
            instruction: { type: Type.STRING, description: "Student instruction (e.g. 'How many paper clips long is the pencil?')" },
            hint: { type: Type.STRING, description: "Hint for wrong answers" },
            obj0Name: { type: Type.STRING, description: "Object being measured (e.g. 'pencil')" },
            obj0VisualSize: { type: Type.NUMBER, description: "Object visual size 20-90 (proportional to unitCount)" },
            obj0ActualValue: { type: Type.NUMBER, description: "Object actual length value" },
            unitName: { type: Type.STRING, description: "Non-standard unit name (e.g. 'paper clip', 'cube', 'crayon')" },
            unitCount: { type: Type.NUMBER, description: "Integer count of units (2-10). K: 2-5, Grade 1: up to 10." },
          },
          required: [
            "id", "instruction", "hint",
            "obj0Name", "obj0VisualSize", "obj0ActualValue",
            "unitName", "unitCount",
          ],
        },
        description: "Array of 4 non_standard measurement challenges",
      },
    },
    required: ["title", "description", "gradeBand", "challenges"],
  };
}

// ---------------------------------------------------------------------------
// Reconstruction helpers (flat Gemini fields → structured CompareObjectsChallenge)
// ---------------------------------------------------------------------------

interface RawIdentifyAttribute {
  id?: string; instruction?: string; attribute?: string; hint?: string;
  obj0Name?: string; obj0VisualSize?: number; obj0ActualValue?: number;
  obj1Name?: string; obj1VisualSize?: number; obj1ActualValue?: number;
  correctAttribute?: string;
  attrOption0?: string; attrOption1?: string; attrOption2?: string; attrOption3?: string;
}

function reconstructIdentifyAttribute(raw: RawIdentifyAttribute, index: number): CompareObjectsChallenge | null {
  if (!raw.id || !raw.instruction || !raw.attribute || !raw.hint) {
    console.log(`[CompareObjects] REJECT identify_attribute #${index} — missing core fields`);
    return null;
  }
  if (!raw.obj0Name || raw.obj0VisualSize == null || raw.obj0ActualValue == null
    || !raw.obj1Name || raw.obj1VisualSize == null || raw.obj1ActualValue == null) {
    console.log(`[CompareObjects] REJECT identify_attribute #${index} — missing object fields`);
    return null;
  }
  if (!raw.correctAttribute || !raw.attrOption0 || !raw.attrOption1 || !raw.attrOption2) {
    console.log(`[CompareObjects] REJECT identify_attribute #${index} — missing attribute options`);
    return null;
  }

  const objects: CompareObject[] = [
    { name: raw.obj0Name, visualSize: clampVisualSize(raw.obj0VisualSize), actualValue: raw.obj0ActualValue },
    { name: raw.obj1Name, visualSize: clampVisualSize(raw.obj1VisualSize), actualValue: raw.obj1ActualValue },
  ];

  const attributeOptions = [raw.attrOption0, raw.attrOption1, raw.attrOption2];
  if (raw.attrOption3) attributeOptions.push(raw.attrOption3);

  // Ensure correctAttribute is in the options
  const correctAttribute = raw.correctAttribute;
  if (!attributeOptions.includes(correctAttribute)) {
    console.log(`[CompareObjects] REJECT identify_attribute #${index} — correctAttribute "${correctAttribute}" not in options [${attributeOptions.join(', ')}]`);
    return null;
  }

  const validAttributes = ['length', 'height', 'weight', 'capacity'];
  const attribute = validAttributes.includes(raw.attribute)
    ? raw.attribute as CompareObjectsChallenge['attribute']
    : 'length' as CompareObjectsChallenge['attribute'];

  return {
    id: raw.id,
    type: 'identify_attribute',
    instruction: raw.instruction,
    attribute,
    objects,
    correctAnswer: correctAttribute, // component reads correctAttribute for this type
    comparisonWord: 'longer', // not used for identify_attribute but required by interface
    hint: raw.hint,
    attributeOptions,
    correctAttribute,
  };
}

interface RawCompareTwo {
  id?: string; instruction?: string; attribute?: string;
  comparisonWord?: string; correctAnswer?: string; hint?: string;
  obj0Name?: string; obj0VisualSize?: number; obj0ActualValue?: number;
  obj1Name?: string; obj1VisualSize?: number; obj1ActualValue?: number;
}

function reconstructCompareTwo(raw: RawCompareTwo, index: number): CompareObjectsChallenge | null {
  if (!raw.id || !raw.instruction || !raw.attribute || !raw.comparisonWord || !raw.correctAnswer || !raw.hint) {
    console.log(`[CompareObjects] REJECT compare_two #${index} — missing core fields`);
    return null;
  }
  if (!raw.obj0Name || raw.obj0VisualSize == null || raw.obj0ActualValue == null
    || !raw.obj1Name || raw.obj1VisualSize == null || raw.obj1ActualValue == null) {
    console.log(`[CompareObjects] REJECT compare_two #${index} — missing object fields`);
    return null;
  }

  const objects: CompareObject[] = [
    { name: raw.obj0Name, visualSize: clampVisualSize(raw.obj0VisualSize), actualValue: raw.obj0ActualValue },
    { name: raw.obj1Name, visualSize: clampVisualSize(raw.obj1VisualSize), actualValue: raw.obj1ActualValue },
  ];

  // correctAnswer must match one of the object names
  if (raw.correctAnswer !== raw.obj0Name && raw.correctAnswer !== raw.obj1Name) {
    console.log(`[CompareObjects] REJECT compare_two #${index} — correctAnswer "${raw.correctAnswer}" doesn't match either object name ("${raw.obj0Name}", "${raw.obj1Name}")`);
    return null;
  }

  // Validate comparisonWord
  const validComparisonWords = ['longer', 'shorter', 'taller', 'shorter_height', 'heavier', 'lighter', 'holds_more', 'holds_less'];
  if (!validComparisonWords.includes(raw.comparisonWord)) {
    console.log(`[CompareObjects] REJECT compare_two #${index} — invalid comparisonWord "${raw.comparisonWord}"`);
    return null;
  }

  // Verify correctAnswer is logically correct based on comparisonWord and actualValues
  const correctObj = objects.find(o => o.name === raw.correctAnswer)!;
  const otherObj = objects.find(o => o.name !== raw.correctAnswer)!;
  const isGreaterWord = ['longer', 'taller', 'heavier', 'holds_more'].includes(raw.comparisonWord);
  if (isGreaterWord && correctObj.actualValue <= otherObj.actualValue) {
    console.log(`[CompareObjects] REJECT compare_two #${index} — correctAnswer "${raw.correctAnswer}" (value=${correctObj.actualValue}) should be greater for "${raw.comparisonWord}" but isn't`);
    return null;
  }
  if (!isGreaterWord && correctObj.actualValue >= otherObj.actualValue) {
    console.log(`[CompareObjects] REJECT compare_two #${index} — correctAnswer "${raw.correctAnswer}" (value=${correctObj.actualValue}) should be lesser for "${raw.comparisonWord}" but isn't`);
    return null;
  }

  const validAttributes = ['length', 'height', 'weight', 'capacity'];
  const attribute = validAttributes.includes(raw.attribute)
    ? raw.attribute as CompareObjectsChallenge['attribute']
    : 'length' as CompareObjectsChallenge['attribute'];

  return {
    id: raw.id,
    type: 'compare_two',
    instruction: raw.instruction,
    attribute,
    objects,
    correctAnswer: raw.correctAnswer,
    comparisonWord: raw.comparisonWord as CompareObjectsChallenge['comparisonWord'],
    hint: raw.hint,
  };
}

interface RawOrderThree {
  id?: string; instruction?: string; attribute?: string;
  comparisonWord?: string; hint?: string;
  obj0Name?: string; obj0VisualSize?: number; obj0ActualValue?: number;
  obj1Name?: string; obj1VisualSize?: number; obj1ActualValue?: number;
  obj2Name?: string; obj2VisualSize?: number; obj2ActualValue?: number;
}

function reconstructOrderThree(raw: RawOrderThree, index: number): CompareObjectsChallenge | null {
  if (!raw.id || !raw.instruction || !raw.attribute || !raw.comparisonWord || !raw.hint) {
    console.log(`[CompareObjects] REJECT order_three #${index} — missing core fields`);
    return null;
  }
  if (!raw.obj0Name || raw.obj0VisualSize == null || raw.obj0ActualValue == null
    || !raw.obj1Name || raw.obj1VisualSize == null || raw.obj1ActualValue == null
    || !raw.obj2Name || raw.obj2VisualSize == null || raw.obj2ActualValue == null) {
    console.log(`[CompareObjects] REJECT order_three #${index} — missing object fields`);
    return null;
  }

  const objects: CompareObject[] = [
    { name: raw.obj0Name, visualSize: clampVisualSize(raw.obj0VisualSize), actualValue: raw.obj0ActualValue },
    { name: raw.obj1Name, visualSize: clampVisualSize(raw.obj1VisualSize), actualValue: raw.obj1ActualValue },
    { name: raw.obj2Name, visualSize: clampVisualSize(raw.obj2VisualSize), actualValue: raw.obj2ActualValue },
  ];

  // Ensure all three have distinct actualValues
  const values = objects.map(o => o.actualValue);
  if (new Set(values).size !== 3) {
    console.log(`[CompareObjects] REJECT order_three #${index} — duplicate actualValues: [${values.join(', ')}]`);
    return null;
  }

  // Validate comparisonWord
  const validComparisonWords = ['longer', 'shorter', 'taller', 'shorter_height', 'heavier', 'lighter', 'holds_more', 'holds_less'];
  if (!validComparisonWords.includes(raw.comparisonWord)) {
    console.log(`[CompareObjects] REJECT order_three #${index} — invalid comparisonWord "${raw.comparisonWord}"`);
    return null;
  }

  // Derive correctAnswer: sort objects by actualValue based on comparisonWord direction
  const isAscending = ['shorter', 'shorter_height', 'lighter', 'holds_less'].includes(raw.comparisonWord);
  const sorted = [...objects].sort((a, b) => isAscending ? a.actualValue - b.actualValue : b.actualValue - a.actualValue);
  const correctAnswer = sorted.map(o => o.name).join(', ');

  const validAttributes = ['length', 'height', 'weight', 'capacity'];
  const attribute = validAttributes.includes(raw.attribute)
    ? raw.attribute as CompareObjectsChallenge['attribute']
    : 'length' as CompareObjectsChallenge['attribute'];

  return {
    id: raw.id,
    type: 'order_three',
    instruction: raw.instruction,
    attribute,
    objects,
    correctAnswer,
    comparisonWord: raw.comparisonWord as CompareObjectsChallenge['comparisonWord'],
    hint: raw.hint,
  };
}

interface RawNonStandard {
  id?: string; instruction?: string; hint?: string;
  obj0Name?: string; obj0VisualSize?: number; obj0ActualValue?: number;
  unitName?: string; unitCount?: number;
}

function reconstructNonStandard(raw: RawNonStandard, index: number): CompareObjectsChallenge | null {
  if (!raw.id || !raw.instruction || !raw.hint) {
    console.log(`[CompareObjects] REJECT non_standard #${index} — missing core fields`);
    return null;
  }
  if (!raw.obj0Name || raw.obj0VisualSize == null || raw.obj0ActualValue == null) {
    console.log(`[CompareObjects] REJECT non_standard #${index} — missing object fields`);
    return null;
  }
  if (!raw.unitName || raw.unitCount == null) {
    console.log(`[CompareObjects] REJECT non_standard #${index} — missing unit fields`);
    return null;
  }

  // Verify unitCount is a positive integer
  const unitCount = Math.round(raw.unitCount);
  if (unitCount < 1 || unitCount > 20) {
    console.log(`[CompareObjects] REJECT non_standard #${index} — unitCount ${raw.unitCount} out of range [1,20]`);
    return null;
  }

  const objects: CompareObject[] = [
    { name: raw.obj0Name, visualSize: clampVisualSize(raw.obj0VisualSize), actualValue: raw.obj0ActualValue },
  ];

  return {
    id: raw.id,
    type: 'non_standard',
    instruction: raw.instruction,
    attribute: 'length', // non_standard is always length
    objects,
    correctAnswer: String(unitCount), // component compares parseInt(answer) === unitCount
    comparisonWord: 'longer', // not used for non_standard but required by interface
    hint: raw.hint,
    unitName: raw.unitName,
    unitCount,
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function clampVisualSize(v: number): number {
  return Math.max(5, Math.min(95, Math.round(v)));
}

// ---------------------------------------------------------------------------
// Sub-generators (one Gemini call per challenge type)
// ---------------------------------------------------------------------------

async function generateIdentifyAttributeChallenges(
  topic: string,
  gradeLevel: string,
): Promise<CompareObjectsChallenge[]> {
  const prompt = `
Create 4 "identify the measurable attribute" challenges for teaching "${topic}" to ${gradeLevel} students.

Each challenge shows two real-world objects side by side. The student must identify WHICH attribute
(length, height, weight, or capacity) these objects can be compared by.

RULES:
1. Each challenge should focus on a DIFFERENT attribute (vary across length, height, weight, capacity)
2. Objects must be concrete, kid-friendly items (pencil, book, water bottle, box, backpack, etc.)
3. The two objects should differ clearly in the target attribute
4. correctAttribute MUST equal the attribute field
5. attributeOptions (attrOption0-3) should include the correct one plus 2-3 plausible distractors
6. Use warm, simple language for young children
7. obj0VisualSize and obj1VisualSize should be between 10 and 90, reflecting the relative difference
8. obj0ActualValue and obj1ActualValue should be realistic measurements (different from each other)
9. Vary the objects across challenges — don't reuse the same pair

Return 4 challenges.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: buildIdentifyAttributeSchema(),
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) {
    console.log(`[CompareObjects] identify_attribute — no challenges returned`);
    return [];
  }

  const valid: CompareObjectsChallenge[] = [];
  let rejected = 0;
  for (let i = 0; i < data.challenges.length; i++) {
    const ch = reconstructIdentifyAttribute(data.challenges[i], i);
    if (ch) valid.push(ch);
    else rejected++;
  }
  if (rejected > 0) {
    console.log(`[CompareObjects] identify_attribute: ${rejected} rejected, ${valid.length} valid`);
  }
  return valid;
}

async function generateCompareTwoChallenges(
  topic: string,
  gradeLevel: string,
  attribute?: string,
): Promise<CompareObjectsChallenge[]> {
  const attrHint = attribute
    ? `Focus ALL challenges on the "${attribute}" attribute.`
    : `Vary the attribute across challenges (use at least 2 different attributes from: length, height, weight, capacity).`;

  const prompt = `
Create 5 "compare two objects" challenges for teaching "${topic}" to ${gradeLevel} students.

Each challenge shows two objects. The student picks which object is longer/shorter/taller/heavier/etc.

RULES:
1. ${attrHint}
2. Objects must be concrete, kid-friendly items that differ in the target attribute
3. correctAnswer MUST exactly match one of the two object names (obj0Name or obj1Name)
4. comparisonWord must be one of: 'longer', 'shorter', 'taller', 'shorter_height', 'heavier', 'lighter', 'holds_more', 'holds_less'
5. Match comparisonWord to attribute:
   - length → 'longer' or 'shorter'
   - height → 'taller' or 'shorter_height'
   - weight → 'heavier' or 'lighter'
   - capacity → 'holds_more' or 'holds_less'
6. The correct object MUST have a higher actualValue for "more" words (longer, taller, heavier, holds_more) or lower actualValue for "less" words (shorter, shorter_height, lighter, holds_less)
7. actualValues must differ by at least 20% so the comparison is clear
8. visualSize values (10-90) should reflect the actual difference
9. Use warm, encouraging language

Return 5 challenges.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: buildCompareTwoSchema(),
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) {
    console.log(`[CompareObjects] compare_two — no challenges returned`);
    return [];
  }

  const valid: CompareObjectsChallenge[] = [];
  let rejected = 0;
  for (let i = 0; i < data.challenges.length; i++) {
    const ch = reconstructCompareTwo(data.challenges[i], i);
    if (ch) valid.push(ch);
    else rejected++;
  }
  if (rejected > 0) {
    console.log(`[CompareObjects] compare_two: ${rejected} rejected, ${valid.length} valid`);
  }
  return valid;
}

async function generateOrderThreeChallenges(
  topic: string,
  gradeLevel: string,
  attribute?: string,
): Promise<CompareObjectsChallenge[]> {
  const attrHint = attribute
    ? `Focus ALL challenges on the "${attribute}" attribute.`
    : `Vary the attribute across challenges (use at least 2 different attributes from: length, height, weight, capacity).`;

  const prompt = `
Create 4 "order three objects" challenges for teaching "${topic}" to ${gradeLevel} students.

Each challenge shows three objects. The student orders them from smallest to largest (or largest to smallest).

RULES:
1. ${attrHint}
2. All three objects must have DISTINCT actualValues (no ties)
3. comparisonWord determines ordering direction:
   - 'longer'/'taller'/'heavier'/'holds_more' → order from MOST to LEAST (biggest first)
   - 'shorter'/'shorter_height'/'lighter'/'holds_less' → order from LEAST to MOST (smallest first)
4. Match comparisonWord to attribute:
   - length → 'longer' or 'shorter'
   - height → 'taller' or 'shorter_height'
   - weight → 'heavier' or 'lighter'
   - capacity → 'holds_more' or 'holds_less'
5. visualSize values (10-90) must reflect relative differences between the three objects
6. Objects should be concrete, kid-friendly items
7. actualValues should be clearly separated (not too close together)
8. Use warm, encouraging instructions

Return 4 challenges.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: buildOrderThreeSchema(),
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) {
    console.log(`[CompareObjects] order_three — no challenges returned`);
    return [];
  }

  const valid: CompareObjectsChallenge[] = [];
  let rejected = 0;
  for (let i = 0; i < data.challenges.length; i++) {
    const ch = reconstructOrderThree(data.challenges[i], i);
    if (ch) valid.push(ch);
    else rejected++;
  }
  if (rejected > 0) {
    console.log(`[CompareObjects] order_three: ${rejected} rejected, ${valid.length} valid`);
  }
  return valid;
}

async function generateNonStandardChallenges(
  topic: string,
  gradeLevel: string,
): Promise<CompareObjectsChallenge[]> {
  const isKinder = gradeLevel.toLowerCase().includes('kinder') || gradeLevel === 'K';
  const maxUnits = isKinder ? 5 : 10;

  const prompt = `
Create 4 "non-standard measurement" challenges for teaching "${topic}" to ${gradeLevel} students.

Each challenge shows ONE object and a row of non-standard units (paper clips, cubes, crayons, etc.)
laid end-to-end below it. The student counts the units to determine the object's length.

RULES:
1. Each challenge uses a DIFFERENT unit (vary: paper clip, cube, crayon, eraser, block, button)
2. Each challenge uses a DIFFERENT object to measure (vary: pencil, book, ribbon, shoe, ruler, spoon)
3. unitCount must be a positive integer between 2 and ${maxUnits}
4. obj0VisualSize should be roughly unitCount * 10 (so the visual matches the unit count)
5. obj0ActualValue should equal unitCount (the measurement in non-standard units)
6. instruction should ask "How many [units] long is the [object]?" — do NOT reveal the answer
7. Use warm, encouraging language for young children
8. Vary the unitCount across challenges (don't use the same number twice)

Return 4 challenges.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: buildNonStandardSchema(),
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) {
    console.log(`[CompareObjects] non_standard — no challenges returned`);
    return [];
  }

  const valid: CompareObjectsChallenge[] = [];
  let rejected = 0;
  for (let i = 0; i < data.challenges.length; i++) {
    const ch = reconstructNonStandard(data.challenges[i], i);
    if (ch) valid.push(ch);
    else rejected++;
  }
  if (rejected > 0) {
    console.log(`[CompareObjects] non_standard: ${rejected} rejected, ${valid.length} valid`);
  }
  return valid;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Generate CompareObjects data for K-1 measurement comparison activities.
 *
 * Uses orchestrator pattern: one Gemini call per challenge type.
 * When targetEvalMode is set, only the relevant sub-generator(s) run.
 * When no eval mode, all 4 types are generated for a mixed-difficulty session.
 */
export const generateCompareObjects = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<CompareObjectsData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'compare-objects',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  logEvalModeResolution('CompareObjects', config?.targetEvalMode, evalConstraint);

  const allowedTypes = evalConstraint?.allowedTypes ?? [
    'identify_attribute', 'compare_two', 'order_three', 'non_standard',
  ];

  // ── Run sub-generators for allowed types in parallel ──
  const generators: Promise<CompareObjectsChallenge[]>[] = [];

  if (allowedTypes.includes('identify_attribute')) {
    generators.push(generateIdentifyAttributeChallenges(topic, gradeLevel));
  }
  if (allowedTypes.includes('compare_two')) {
    generators.push(generateCompareTwoChallenges(topic, gradeLevel));
  }
  if (allowedTypes.includes('order_three')) {
    generators.push(generateOrderThreeChallenges(topic, gradeLevel));
  }
  if (allowedTypes.includes('non_standard')) {
    generators.push(generateNonStandardChallenges(topic, gradeLevel));
  }

  const results = await Promise.all(generators);
  const allChallenges = results.flat();

  // ── Fallback if all challenges were rejected ──
  if (allChallenges.length === 0) {
    console.log(`[CompareObjects] WARNING: All challenges rejected — generating fallback`);
    const fallbackType = allowedTypes[0] ?? 'compare_two';
    allChallenges.push(buildFallbackChallenge(fallbackType));
  }

  // ── Assign sequential IDs to prevent duplicates ──
  for (let i = 0; i < allChallenges.length; i++) {
    allChallenges[i].id = `co-${i + 1}`;
  }

  const gradeBand = gradeLevel.toLowerCase().includes('kinder') || gradeLevel === 'K' ? 'K' : '1';
  const typeBreakdown = allChallenges.map(c => c.type).join(', ');
  console.log(`[CompareObjects] Final: ${allChallenges.length} challenge(s) → [${typeBreakdown}]`);

  return {
    title: `Compare Objects: ${topic}`,
    description: `Compare and measure real-world objects by their attributes`,
    challenges: allChallenges,
    gradeBand: gradeBand as 'K' | '1',
  };
};

// ---------------------------------------------------------------------------
// Fallback challenges (last resort if Gemini produces nothing valid)
// ---------------------------------------------------------------------------

function buildFallbackChallenge(type: string): CompareObjectsChallenge {
  switch (type) {
    case 'identify_attribute':
      return {
        id: 'fallback-1',
        type: 'identify_attribute',
        instruction: 'What can we measure about these objects?',
        attribute: 'length',
        objects: [
          { name: 'pencil', visualSize: 70, actualValue: 19 },
          { name: 'crayon', visualSize: 40, actualValue: 9 },
        ],
        correctAnswer: 'length',
        comparisonWord: 'longer',
        hint: 'Look at how long each one is!',
        attributeOptions: ['length', 'weight', 'capacity'],
        correctAttribute: 'length',
      };
    case 'order_three':
      return {
        id: 'fallback-1',
        type: 'order_three',
        instruction: 'Put these in order from tallest to shortest!',
        attribute: 'height',
        objects: [
          { name: 'sunflower', visualSize: 80, actualValue: 150 },
          { name: 'tulip', visualSize: 50, actualValue: 60 },
          { name: 'daisy', visualSize: 30, actualValue: 30 },
        ],
        correctAnswer: 'sunflower, tulip, daisy',
        comparisonWord: 'taller',
        hint: 'Look at which plant is the tallest!',
      };
    case 'non_standard':
      return {
        id: 'fallback-1',
        type: 'non_standard',
        instruction: 'How many paper clips long is the pencil?',
        attribute: 'length',
        objects: [
          { name: 'pencil', visualSize: 50, actualValue: 5 },
        ],
        correctAnswer: '5',
        comparisonWord: 'longer',
        hint: 'Count each paper clip carefully!',
        unitName: 'paper clip',
        unitCount: 5,
      };
    case 'compare_two':
    default:
      return {
        id: 'fallback-1',
        type: 'compare_two',
        instruction: 'Which is longer?',
        attribute: 'length',
        objects: [
          { name: 'jump rope', visualSize: 75, actualValue: 200 },
          { name: 'shoelace', visualSize: 35, actualValue: 80 },
        ],
        correctAnswer: 'jump rope',
        comparisonWord: 'longer',
        hint: 'Look at which one stretches farther!',
      };
  }
}
