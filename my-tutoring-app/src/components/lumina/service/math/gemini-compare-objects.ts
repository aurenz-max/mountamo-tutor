import { Type, Schema } from "@google/genai";
import type {
  CompareObjectsData,
  CompareObjectsChallenge,
  CompareObject,
} from "../../primitives/visual-primitives/math/CompareObjects";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModeConstraint,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------

type ChallengeType = 'identify_attribute' | 'compare_two' | 'order_three' | 'non_standard';

const DEFAULT_INSTANCE_COUNT = 7; // tier fallback (T1 — fast-tap K-1 measurement)
const MAX_INSTANCE_COUNT = 8;

const COUNT_BY_MODE: Record<ChallengeType, number> = {
  identify_attribute: 7,
  compare_two: 7,
  order_three: 7,
  non_standard: 7,
};

function resolveCount(type: ChallengeType): number {
  return Math.max(1, Math.min(MAX_INSTANCE_COUNT, COUNT_BY_MODE[type] ?? DEFAULT_INSTANCE_COUNT));
}

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
// Within-mode support tiers (config.difficulty) — scaffolding + structural axis
//
// Two axes, both within ONE eval mode and NEVER changing magnitude:
//  1. Scaffolding (resolveSupportStructure) — withdraw on-screen read-outs.
//  2. Structural problem shape (resolveProblemShape) — discriminability gap,
//     distractor count. Code-enforced; in-mode; structural, not magnitude.
// See memory: structural-difficulty-not-numeric, add-support-tiers skill.
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

const TIER_GUARDRAIL =
  'Keep every number/answer within scope — this tier changes problem STRUCTURE '
  + '(discriminability gap, distractor count, on-screen read-outs), NOT raw magnitude.';

/** Scaffolding levers — perception read-outs withdrawn at harder tiers. */
interface SupportScaffold {
  /** non_standard: number the unit boxes 1..n (count-along aid). hard → unnumbered. */
  showUnitNumbers?: boolean;
  /** order_three weight: show the digital scale read-out. hard → order by platform drop. */
  showScaleReadout?: boolean;
  promptLines: string[];
}

function resolveSupportStructure(mode: ChallengeType, tier: SupportTier): SupportScaffold {
  const lines: string[] = [TIER_GUARDRAIL];
  switch (mode) {
    case 'non_standard': {
      const showUnitNumbers = tier !== 'hard';
      lines.push(showUnitNumbers
        ? 'Unit boxes are numbered 1..n so the student can count along.'
        : 'Unit boxes are UNNUMBERED — the student must count the units unaided.');
      return { showUnitNumbers, promptLines: lines };
    }
    case 'order_three': {
      const showScaleReadout = tier !== 'hard';
      lines.push(showScaleReadout
        ? 'Weight scales show a digital read-out the student can read and compare.'
        : 'Weight scales hide the read-out — the student orders by how far each platform sinks.');
      return { showScaleReadout, promptLines: lines };
    }
    default:
      // compare_two / identify_attribute have no on-screen read-out to withdraw;
      // their difficulty rides the structural axis (gap / distractor count).
      lines.push('Same task; difficulty comes from the structural axis below.');
      return { promptLines: lines };
  }
}

/** Structural problem-shape levers — in-mode, structural, NEVER magnitude. */
interface ProblemShape {
  /** compare_two: target |visualSize gap| between the two objects (discriminability). */
  compareGap?: number;
  /** order_three: target adjacent visualSize spacing between rank-ordered objects. */
  orderSpacing?: number;
  /** identify_attribute: max attribute options shown (fewer distractors = easier). */
  maxOptions?: number;
  promptLines: string[];
}

function resolveProblemShape(mode: ChallengeType, tier: SupportTier): ProblemShape {
  const lines: string[] = [];
  switch (mode) {
    case 'compare_two': {
      // visualSize is rendered on a 5..95 scale; the answer (actualValue) is untouched.
      const compareGap = tier === 'easy' ? 44 : tier === 'medium' ? 30 : 16;
      lines.push(tier === 'hard'
        ? 'Make the two objects CLOSE in size — a subtle difference the student must look carefully to see.'
        : tier === 'medium'
          ? 'Make the two objects moderately different in size.'
          : 'Make the two objects obviously different in size.');
      return { compareGap, promptLines: lines };
    }
    case 'order_three': {
      const orderSpacing = tier === 'easy' ? 28 : tier === 'medium' ? 20 : 12;
      lines.push(tier === 'hard'
        ? "Space the three objects' sizes CLOSE together — a subtle ordering."
        : tier === 'medium'
          ? "Space the three objects' sizes moderately apart."
          : "Space the three objects' sizes far apart, easy to rank.");
      return { orderSpacing, promptLines: lines };
    }
    case 'identify_attribute': {
      const maxOptions = tier === 'hard' ? 4 : 3;
      lines.push(`Offer ${maxOptions} attribute choices (${tier === 'hard' ? 'more distractors' : 'fewer distractors'}).`);
      return { maxOptions, promptLines: lines };
    }
    default:
      // non_standard: unitCount IS the answer/magnitude — no structural lever, scaffold-only.
      return { promptLines: lines };
  }
}

/** One ## SUPPORT TIER block fed to a single mode's sub-generator (tone + shape). */
function buildTierPromptSection(mode: ChallengeType, tier: SupportTier): string {
  const lines = [
    ...resolveSupportStructure(mode, tier).promptLines,
    ...resolveProblemShape(mode, tier).promptLines,
  ];
  return `\n## SUPPORT TIER "${tier}" (within-mode difficulty — scaffolding + problem shape)\n${lines.map(l => `- ${l}`).join('\n')}\n`;
}

// --- Deterministic structural enforcement (code owns the shape; LLM only the numbers) ---

/** Assign the two objects' visualSizes around a midpoint at the exact target gap,
 *  preserving actualValue rank so the render still matches the answer. */
function applyCompareGap(objects: CompareObject[], gap: number): void {
  const mid = 50;
  const [small, large] = [...objects].sort((a, b) => a.actualValue - b.actualValue);
  small.visualSize = clampVisualSize(mid - gap / 2);
  large.visualSize = clampVisualSize(mid + gap / 2);
}

/** Space three objects' visualSizes evenly by actualValue rank at the target spacing. */
function applyOrderSpacing(objects: CompareObject[], spacing: number): void {
  const mid = 50;
  [...objects]
    .sort((a, b) => a.actualValue - b.actualValue)
    .forEach((o, i) => { o.visualSize = clampVisualSize(mid + (i - 1) * spacing); });
}

/** Keep at most `max` options, always including the correct attribute. */
function trimOptions(options: string[], correct: string | undefined, max: number): string[] {
  if (options.length <= max) return options;
  const kept = options.slice(0, max);
  if (correct && !kept.includes(correct)) kept[max - 1] = correct;
  return kept;
}

// ---------------------------------------------------------------------------
// Per-type schemas (flat fields, no arrays inside challenges)
// ---------------------------------------------------------------------------

function buildIdentifyAttributeSchema(count: number): Schema {
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
        description: `Array of ${count} identify_attribute challenges`,
      },
    },
    required: ["title", "description", "gradeBand", "challenges"],
  };
}

function buildCompareTwoSchema(count: number): Schema {
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
        description: `Array of ${count} compare_two challenges`,
      },
    },
    required: ["title", "description", "gradeBand", "challenges"],
  };
}

function buildOrderThreeSchema(count: number): Schema {
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
            weightUnit: { type: Type.STRING, description: "Display unit shown on the scale readout for weight challenges (e.g. 'lbs', 'kg', 'stones', 'oz'). Required when attribute is 'weight'; ignored otherwise." },
          },
          required: [
            "id", "attribute", "comparisonWord", "hint",
            "obj0Name", "obj0VisualSize", "obj0ActualValue",
            "obj1Name", "obj1VisualSize", "obj1ActualValue",
            "obj2Name", "obj2VisualSize", "obj2ActualValue",
          ],
        },
        description: `Array of ${count} order_three challenges`,
      },
    },
    required: ["title", "description", "gradeBand", "challenges"],
  };
}

function buildNonStandardSchema(count: number): Schema {
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
        description: `Array of ${count} non_standard measurement challenges`,
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
  id?: string; attribute?: string;
  comparisonWord?: string; hint?: string;
  obj0Name?: string; obj0VisualSize?: number; obj0ActualValue?: number;
  obj1Name?: string; obj1VisualSize?: number; obj1ActualValue?: number;
  obj2Name?: string; obj2VisualSize?: number; obj2ActualValue?: number;
  weightUnit?: string;
}

function reconstructOrderThree(raw: RawOrderThree, index: number): CompareObjectsChallenge | null {
  if (!raw.id || !raw.attribute || !raw.comparisonWord || !raw.hint) {
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

  // Verify visualSize ranks consistent with actualValue. If they disagree the
  // student's visual ordering (read from visualSize) would contradict the
  // correctAnswer (computed from actualValue). Repair by snapping visualSize
  // to actualValue ranks so display always matches the answer.
  const byActualRank = [...objects].sort((a, b) => a.actualValue - b.actualValue);
  const byVisualRank = [...objects].sort((a, b) => a.visualSize - b.visualSize);
  const ranksMatch = byActualRank.every((o, i) => o.name === byVisualRank[i].name);
  if (!ranksMatch) {
    console.log(`[CompareObjects] order_three #${index} — repairing visualSize ranking to match actualValue ranking`);
    // Reassign visualSize to evenly-spaced values matching actualValue ranks (20, 50, 80)
    const targetSizes = [20, 50, 80];
    for (let r = 0; r < byActualRank.length; r++) {
      const target = byActualRank[r];
      const objRef = objects.find(o => o.name === target.name);
      if (objRef) objRef.visualSize = targetSizes[r];
    }
  }

  // Derive correctAnswer: sort objects by actualValue based on comparisonWord direction
  const isAscending = ['shorter', 'shorter_height', 'lighter', 'holds_less'].includes(raw.comparisonWord);
  const sorted = [...objects].sort((a, b) => isAscending ? a.actualValue - b.actualValue : b.actualValue - a.actualValue);
  const correctAnswer = sorted.map(o => o.name).join(', ');

  // Shuffle the display order so it isn't already the correct (or reverse) order.
  // correctAnswer is name-keyed so the shuffle doesn't change the ground truth.
  const displayObjects = shuffleNonTrivial(objects);

  const validAttributes = ['length', 'height', 'weight', 'capacity'];
  const attribute = validAttributes.includes(raw.attribute)
    ? raw.attribute as CompareObjectsChallenge['attribute']
    : 'length' as CompareObjectsChallenge['attribute'];

  // weightUnit only meaningful for weight challenges; default to 'lbs' if missing
  const weightUnit = attribute === 'weight'
    ? (typeof raw.weightUnit === 'string' && raw.weightUnit.trim() ? raw.weightUnit.trim() : 'lbs')
    : undefined;

  // SP-17: instruction is synthesized deterministically from comparisonWord+attribute so the
  // prose direction can never disagree with `correctAnswer`. Same fix as hundreds-chart HC-1/2/3.
  const instruction = buildOrderThreeInstruction(
    raw.comparisonWord as CompareObjectsChallenge['comparisonWord'],
    attribute,
  );

  return {
    id: raw.id,
    type: 'order_three',
    instruction,
    attribute,
    objects: displayObjects,
    correctAnswer,
    comparisonWord: raw.comparisonWord as CompareObjectsChallenge['comparisonWord'],
    hint: raw.hint,
    weightUnit,
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

// Synthesize the order_three instruction from comparisonWord+attribute so the
// prose direction always matches the direction used to compute correctAnswer.
// Removed `instruction` from the Gemini schema — see SP-17 (hundreds-chart fix).
function buildOrderThreeInstruction(
  comparisonWord: CompareObjectsChallenge['comparisonWord'],
  attribute: CompareObjectsChallenge['attribute'],
): string {
  const ascendingWords: CompareObjectsChallenge['comparisonWord'][] =
    ['shorter', 'shorter_height', 'lighter', 'holds_less'];
  const isAscending = ascendingWords.includes(comparisonWord);

  // [lowEnd, highEnd] for each attribute — kid-friendly superlatives
  const endpoints: Record<CompareObjectsChallenge['attribute'], [string, string]> = {
    length: ['shortest', 'longest'],
    height: ['shortest', 'tallest'],
    weight: ['lightest', 'heaviest'],
    capacity: ['holds the least', 'holds the most'],
  };

  const [low, high] = endpoints[attribute];
  return isAscending
    ? `Put these in order from ${low} to ${high}.`
    : `Put these in order from ${high} to ${low}.`;
}

// Shuffle an array of objects so the display order is neither the ascending
// nor descending sort by `actualValue` — otherwise tap-in-display-order solves
// any "put these in order" challenge trivially.
function shuffleNonTrivial(objects: CompareObject[]): CompareObject[] {
  if (objects.length < 2) return objects;
  const asc = [...objects].sort((a, b) => a.actualValue - b.actualValue).map(o => o.name);
  const desc = [...asc].reverse();
  const shuffled = [...objects];
  for (let attempt = 0; attempt < 10; attempt++) {
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const names = shuffled.map(o => o.name);
    const matchesAsc = names.every((n, i) => n === asc[i]);
    const matchesDesc = names.every((n, i) => n === desc[i]);
    if (!matchesAsc && !matchesDesc) return shuffled;
  }
  // Fallback: deterministic non-trivial rotation [1, 2, 0] (works for n≥3).
  return [objects[1], objects[2], objects[0]];
}

// ---------------------------------------------------------------------------
// Sub-generators (one Gemini call per challenge type)
// ---------------------------------------------------------------------------

async function generateIdentifyAttributeChallenges(
  topic: string,
  gradeLevel: string,
  count: number,
  tierSection = '',
): Promise<CompareObjectsChallenge[]> {
  const prompt = `
Create ${count} "identify the measurable attribute" challenges for teaching "${topic}" to ${gradeLevel} students.
${tierSection}

Each challenge shows two real-world objects side by side. The student must identify WHICH attribute
(length, height, weight, or capacity) these objects can be compared by.

RULES:
1. Vary the attribute across challenges (cover all 4 — length, height, weight, capacity — across the set)
2. Objects must be concrete, kid-friendly items (pencil, book, water bottle, box, backpack, etc.)
3. The two objects should differ clearly in the target attribute
4. correctAttribute MUST equal the attribute field
5. attributeOptions (attrOption0-3) should include the correct one plus 2-3 plausible distractors
6. Use warm, simple language for young children
7. obj0VisualSize and obj1VisualSize should be between 10 and 90, reflecting the relative difference
8. obj0ActualValue and obj1ActualValue should be realistic measurements (different from each other)
9. Vary the objects across challenges — don't reuse the same pair

Return exactly ${count} challenges.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: buildIdentifyAttributeSchema(count),
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) {
    console.log(`[CompareObjects] identify_attribute — no challenges returned`);
    return [];
  }

  const valid: CompareObjectsChallenge[] = [];
  let rejected = 0;
  const limit = Math.min(count, data.challenges.length);
  for (let i = 0; i < limit; i++) {
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
  count: number,
  attribute?: string,
  tierSection = '',
): Promise<CompareObjectsChallenge[]> {
  const attrHint = attribute
    ? `Focus ALL challenges on the "${attribute}" attribute.`
    : `Vary the attribute across challenges (use at least 2 different attributes from: length, height, weight, capacity).`;

  const prompt = `
Create ${count} "compare two objects" challenges for teaching "${topic}" to ${gradeLevel} students.
${tierSection}

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

Return exactly ${count} challenges.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: buildCompareTwoSchema(count),
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) {
    console.log(`[CompareObjects] compare_two — no challenges returned`);
    return [];
  }

  const valid: CompareObjectsChallenge[] = [];
  let rejected = 0;
  const limit = Math.min(count, data.challenges.length);
  for (let i = 0; i < limit; i++) {
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
  count: number,
  attribute?: string,
  tierSection = '',
): Promise<CompareObjectsChallenge[]> {
  const attrHint = attribute
    ? `Focus ALL challenges on the "${attribute}" attribute.`
    : `Vary the attribute across challenges (use at least 2 different attributes from: length, height, weight, capacity).`;

  const prompt = `
Create ${count} "order three objects" challenges for teaching "${topic}" to ${gradeLevel} students.
${tierSection}

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
5. visualSize values (10-90) must reflect relative differences between the three objects AND must rank consistently with actualValue (the object with the largest actualValue MUST have the largest visualSize, etc.)
6. Objects should be concrete, kid-friendly items
7. actualValues should be clearly separated (not too close together)
8. For weight challenges (attribute='weight'), include weightUnit: a kid-friendly unit shown on the scale readout. Use 'lbs' for US-style (default), or 'kg' for metric, or 'oz' for very light things (feather, pencil). Choose the unit that fits the objects being compared. Omit weightUnit for non-weight challenges.

Note: the student-facing instruction is synthesized from comparisonWord+attribute by the post-process — do NOT author it. Just pick the comparisonWord that fits the challenge.

Return exactly ${count} challenges.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: buildOrderThreeSchema(count),
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) {
    console.log(`[CompareObjects] order_three — no challenges returned`);
    return [];
  }

  const valid: CompareObjectsChallenge[] = [];
  let rejected = 0;
  const limit = Math.min(count, data.challenges.length);
  for (let i = 0; i < limit; i++) {
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
  count: number,
  tierSection = '',
): Promise<CompareObjectsChallenge[]> {
  const isKinder = gradeLevel.toLowerCase().includes('kinder') || gradeLevel === 'K';
  const maxUnits = isKinder ? 5 : 10;

  const prompt = `
Create ${count} "non-standard measurement" challenges for teaching "${topic}" to ${gradeLevel} students.
${tierSection}

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
8. Vary the unitCount across challenges (don't use the same number twice unless the count requires it)

Return exactly ${count} challenges.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: buildNonStandardSchema(count),
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) {
    console.log(`[CompareObjects] non_standard — no challenges returned`);
    return [];
  }

  const valid: CompareObjectsChallenge[] = [];
  let rejected = 0;
  const limit = Math.min(count, data.challenges.length);
  for (let i = 0; i < limit; i++) {
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
type CompareObjectsConfig = Partial<{
  targetEvalMode?: string;
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second axis of the two-field contract: targetEvalMode = which skill,
   * difficulty = within-mode scaffolding + structural shape. NEVER magnitude.
   */
  difficulty?: string;
}>;

export const generateCompareObjects = async (
  ctx: GenerationContext,
): Promise<CompareObjectsData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as CompareObjectsConfig;
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

  // ── Support tier (within-mode difficulty) ──
  const supportTier = normalizeSupportTier(config?.difficulty); // the STUDENT's tier — DRIVES application (single OR blend)
  // pinnedType is ONLY for logging which prompt path ran; each sub-generator gets
  // its OWN mode's tier section, so blends are described correctly per type.
  const pinnedType = evalConstraint && evalConstraint.allowedTypes.length === 1
    ? evalConstraint.allowedTypes[0] as ChallengeType
    : undefined;
  const sectionFor = (mode: ChallengeType): string =>
    supportTier ? buildTierPromptSection(mode, supportTier) : '';

  // ── Run sub-generators for allowed types in parallel ──
  const generators: Promise<CompareObjectsChallenge[]>[] = [];

  if (allowedTypes.includes('identify_attribute')) {
    generators.push(generateIdentifyAttributeChallenges(topic, gradeLevel, resolveCount('identify_attribute'), sectionFor('identify_attribute')));
  }
  if (allowedTypes.includes('compare_two')) {
    generators.push(generateCompareTwoChallenges(topic, gradeLevel, resolveCount('compare_two'), undefined, sectionFor('compare_two')));
  }
  if (allowedTypes.includes('order_three')) {
    generators.push(generateOrderThreeChallenges(topic, gradeLevel, resolveCount('order_three'), undefined, sectionFor('order_three')));
  }
  if (allowedTypes.includes('non_standard')) {
    generators.push(generateNonStandardChallenges(topic, gradeLevel, resolveCount('non_standard'), sectionFor('non_standard')));
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

  // ── Apply the support tier deterministically, per challenge from its OWN mode ──
  // Difficulty is a STUDENT property: a blended/auto session gets it too (single
  // mode just happens to give every challenge the same tier). Gate on supportTier
  // only — never on pinnedType — so blends aren't silently dropped. Runs AFTER the
  // order_three visualSize-rank repair so tier spacing wins. No-tier path is
  // byte-identical to before (every branch guarded).
  if (supportTier) {
    for (const ch of allChallenges) {
      const scaffold = resolveSupportStructure(ch.type, supportTier);
      const shape = resolveProblemShape(ch.type, supportTier);
      ch.supportTier = supportTier;

      // Scaffolding read-outs (perception aids)
      if (ch.type === 'non_standard') ch.showUnitNumbers = scaffold.showUnitNumbers;
      if (ch.type === 'order_three') ch.showScaleReadout = scaffold.showScaleReadout;

      // Structural problem shape (code-enforced; actualValue/answer untouched)
      if (shape.compareGap != null && ch.objects.length === 2) {
        applyCompareGap(ch.objects, shape.compareGap);
      }
      if (shape.orderSpacing != null && ch.objects.length >= 3) {
        applyOrderSpacing(ch.objects, shape.orderSpacing);
      }
      if (shape.maxOptions != null && ch.attributeOptions) {
        ch.attributeOptions = trimOptions(ch.attributeOptions, ch.correctAttribute, shape.maxOptions);
      }
    }
    console.log(`[CompareObjects] Support tier "${supportTier}" applied per-challenge (${pinnedType ? `single-mode ${pinnedType}` : 'blended'})`);
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
