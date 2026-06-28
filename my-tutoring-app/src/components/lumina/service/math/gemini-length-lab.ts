import { Type, Schema } from "@google/genai";
import { LengthLabData } from "../../primitives/visual-primitives/math/LengthLab";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  compare: {
    promptDoc:
      `"compare": Two objects on a baseline. Student picks longer/shorter/same. `
      + `correctAnswer is 'longer', 'shorter', or 'same' referring to object0 relative to object1. `
      + `Make length differences obvious (at least 2 units apart for K). `
      + `Use warm language ("Which one is longer? Point to it!").`,
    schemaDescription: "'compare' (which is longer/shorter)",
  },
  tile_and_count: {
    promptDoc:
      `"tile_and_count": Student tiles unit objects (cubes, paper clips) end-to-end along an object `
      + `and counts them. correctUnitCount MUST equal objectLength0 (the length of the object being measured). `
      + `unitType should match the top-level unitType. `
      + `Use encouraging language ("How many cubes long is the pencil?").`,
    schemaDescription: "'tile_and_count' (measure with unit objects)",
  },
  order: {
    promptDoc:
      `"order": Three objects shown. Student arranges from shortest to longest. `
      + `correctOrderCsv is comma-separated names sorted by length ascending. `
      + `MUST provide objectName2, objectLength2, objectColor2 for the third object. `
      + `All three objects must have different lengths. `
      + `Use language like "Put these in order from shortest to longest!"`,
    schemaDescription: "'order' (arrange shortest to longest)",
  },
  indirect: {
    promptDoc:
      `"indirect": Two objects can't be placed side-by-side. Student uses clues about a reference `
      + `object to compare transitively. MUST provide clue0, clue1, referenceObjectName, `
      + `referenceObjectLength, referenceObjectColor. correctAnswer should be the name of the longer object. `
      + `Example clues: "The pencil is shorter than the string", "The string is shorter than the ribbon". `
      + `Grade 1 only (requires logical reasoning).`,
    schemaDescription: "'indirect' (transitive comparison with clues)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tiers (config.difficulty → scaffolding + structural shape)
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/** Reworded guardrail: this tier changes problem STRUCTURE (length gaps,
 *  spread, scaffolding withdrawal), NEVER raw magnitude — every length stays
 *  within the 1-12 scope. */
const TIER_GUARDRAIL =
  'Keep every object length within the 1-12 scope. This tier changes problem '
  + 'STRUCTURE (how close the lengths are, how much on-screen help) and how much '
  + 'the workspace helps the student self-check — NOT the size of the numbers.';

/** Per-primitive scaffold levers (bespoke). null fields = lever N/A for that mode. */
interface SupportScaffold {
  /** compare/order — unit-cell dividers on the bars so the student can COUNT cells. */
  showUnitTicks: boolean;
  /** tile_and_count — live "not enough / too many / perfect fit" self-check text. */
  showAlignmentFeedback: boolean;
  /** indirect (#2 instruction-as-scaffold) — clue-chain strategy tip, or null to withdraw. */
  instructionTip: string | null;
  promptLines: string[];
}

/** Structural problem shape (2nd axis) — magnitude-free levers, code-enforced. */
interface ProblemShape {
  /** compare — exact |len0-len1| gap (subtle → obvious). */
  compareGap: number | null;
  /** order — exact min adjacent-length gap (tight → wide spread). */
  orderMinGap: number | null;
  promptLines: string[];
}

/** Scaffolding withdrawal (how much help) per mode + tier. */
function resolveSupportStructure(mode: string, tier: SupportTier): SupportScaffold {
  const ticksOn = tier !== 'hard';
  switch (mode) {
    case 'compare':
      return {
        showUnitTicks: ticksOn,
        showAlignmentFeedback: false,
        instructionTip: null,
        promptLines: [
          tier === 'hard'
            ? 'HARD: the bars carry no unit gridlines — the student must judge length by eye.'
            : 'Bars show unit gridlines so the student can count cells to self-check.',
        ],
      };
    case 'order':
      return {
        showUnitTicks: ticksOn,
        showAlignmentFeedback: false,
        instructionTip: null,
        promptLines: [
          tier === 'hard'
            ? 'HARD: no gridlines on the bars — order them by visual length alone.'
            : 'Bars show unit gridlines so the student can count cells while ordering.',
        ],
      };
    case 'tile_and_count':
      return {
        showUnitTicks: false, // ticks on the measured object would leak the count
        showAlignmentFeedback: tier === 'easy',
        instructionTip: null,
        promptLines: [
          tier === 'easy'
            ? 'The tiling workspace gives live "not enough / too many / perfect fit" feedback to self-check.'
            : 'The live fit feedback is withdrawn — the student must judge end-to-end alignment alone.',
        ],
      };
    case 'indirect':
      return {
        showUnitTicks: false,
        showAlignmentFeedback: false,
        instructionTip:
          tier === 'easy'
            ? '(Tip: read the clues like a chain — one object is shorter than the reference, and the reference is shorter than the other.)'
            : tier === 'medium'
              ? '(Read both clues carefully before you choose.)'
              : null, // hard: strategy fully withdrawn
        promptLines: [
          tier === 'hard'
            ? 'HARD: the instruction does NOT name the chaining strategy — bare transitive question.'
            : 'The instruction names the clue-chain strategy to scaffold the transitive reasoning.',
        ],
      };
    default:
      return { showUnitTicks: false, showAlignmentFeedback: false, instructionTip: null, promptLines: [] };
  }
}

/** Structural shape (how hard a problem) per mode + tier. One in-mode lever each. */
function resolveProblemShape(mode: string, tier: SupportTier): ProblemShape {
  switch (mode) {
    case 'compare': {
      const compareGap = tier === 'easy' ? 4 : tier === 'medium' ? 2 : 1;
      return {
        compareGap,
        orderMinGap: null,
        promptLines: [
          `Length difference between the two objects: ${compareGap} unit(s) (${
            tier === 'hard' ? 'subtle — close lengths' : tier === 'medium' ? 'moderate' : 'obvious'
          }).`,
        ],
      };
    }
    case 'order': {
      const orderMinGap = tier === 'easy' ? 3 : tier === 'medium' ? 2 : 1;
      return {
        compareGap: null,
        orderMinGap,
        promptLines: [
          `Adjacent objects differ by about ${orderMinGap} unit(s) (${
            tier === 'hard' ? 'tight — hard to tell apart' : tier === 'medium' ? 'moderate spread' : 'wide spread'
          }).`,
        ],
      };
    }
    default:
      return { compareGap: null, orderMinGap: null, promptLines: [] };
  }
}

/** Merge scaffolding + structural prompt lines into one tier block (LLM tone). */
function buildTierPromptSection(mode: string, tier: SupportTier): string {
  const lines = [
    ...resolveSupportStructure(mode, tier).promptLines,
    ...resolveProblemShape(mode, tier).promptLines,
  ];
  return `\n## WITHIN-MODE SUPPORT TIER "${tier}"\n- ${TIER_GUARDRAIL}\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
}

// ── Code-enforced structural levers (don't trust the LLM to hit an exact gap) ──

interface CompareLike {
  objectLength0: number;
  objectLength1: number;
  correctAnswer: string;
}

/** Force |len0-len1| to exactly `gap`, preserving direction + 1-12 scope. */
function applyCompareGap(ch: CompareLike, gap: number): void {
  if (ch.correctAnswer === 'same') return; // gap lever N/A for equal-length pairs
  const obj0Longer = ch.objectLength0 >= ch.objectLength1;
  let shorter = Math.min(ch.objectLength0, ch.objectLength1);
  let longer = shorter + gap;
  if (longer > 12) { longer = 12; shorter = 12 - gap; }
  if (shorter < 1) { shorter = 1; longer = 1 + gap; }
  ch.objectLength0 = obj0Longer ? longer : shorter;
  ch.objectLength1 = obj0Longer ? shorter : longer;
  ch.correctAnswer = ch.objectLength0 > ch.objectLength1 ? 'longer'
    : ch.objectLength0 < ch.objectLength1 ? 'shorter' : 'same';
}

interface OrderLike {
  objectName0: string; objectLength0: number;
  objectName1: string; objectLength1: number;
  objectName2?: string; objectLength2?: number;
  correctOrderCsv?: string;
  correctAnswer: string;
}

/** Re-space the three lengths to exact adjacent gap `minGap`, keeping rank order
 *  (shortest stays shortest) + 1-12 scope. correctOrderCsv is preserved. */
function applyOrderSpread(ch: OrderLike, minGap: number): void {
  if (ch.objectLength2 == null || !ch.objectName2) return;
  const slots = [
    { key: 0, name: ch.objectName0, length: ch.objectLength0 },
    { key: 1, name: ch.objectName1, length: ch.objectLength1 },
    { key: 2, name: ch.objectName2, length: ch.objectLength2 },
  ];
  const ranked = [...slots].sort((a, b) => a.length - b.length);
  const base = Math.max(1, Math.min(12 - 2 * minGap, ranked[0].length));
  const newLens = [base, base + minGap, base + 2 * minGap];
  ranked.forEach((r, i) => { r.length = newLens[i]; });
  for (const r of ranked) {
    if (r.key === 0) ch.objectLength0 = r.length;
    else if (r.key === 1) ch.objectLength1 = r.length;
    else ch.objectLength2 = r.length;
  }
  // ranked is ascending → names in rank order = shortest→longest
  ch.correctOrderCsv = ranked.map((r) => r.name).join(',');
  ch.correctAnswer = ch.correctOrderCsv;
}

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

const lengthLabSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the length lab activity (e.g., 'Which is Longer?', 'Measure with Cubes!')",
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID (e.g., 'c1', 'c2')",
          },
          type: {
            type: Type.STRING,
            description:
              "Challenge type: 'compare' (which is longer/shorter), 'tile_and_count' (measure with unit objects), 'order' (arrange shortest to longest), 'indirect' (transitive comparison with clues)",
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging",
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after incorrect attempts",
          },
          narration: {
            type: Type.STRING,
            description: "AI narration for this challenge (used by the tutor to introduce it)",
          },
          objectName0: {
            type: Type.STRING,
            description: "Name of the first object (e.g., 'pencil', 'crayon', 'ribbon')",
          },
          objectLength0: {
            type: Type.NUMBER,
            description: "Length of the first object in unit cells (integer 1-12)",
          },
          objectColor0: {
            type: Type.STRING,
            description: "CSS color for the first object (e.g., '#4A90D9')",
          },
          objectName1: {
            type: Type.STRING,
            description: "Name of the second object",
          },
          objectLength1: {
            type: Type.NUMBER,
            description: "Length of the second object in unit cells (integer 1-12)",
          },
          objectColor1: {
            type: Type.STRING,
            description: "CSS color for the second object",
          },
          objectName2: {
            type: Type.STRING,
            description: "Name of the third object (required for 'order' type)",
          },
          objectLength2: {
            type: Type.NUMBER,
            description: "Length of the third object in unit cells (required for 'order' type)",
          },
          objectColor2: {
            type: Type.STRING,
            description: "CSS color for the third object (required for 'order' type)",
          },
          correctAnswer: {
            type: Type.STRING,
            description: "Correct answer: 'longer'/'shorter'/'same' for compare, object name for indirect",
          },
          correctUnitCount: {
            type: Type.NUMBER,
            description: "For tile_and_count: correct number of units (must equal objectLength0)",
          },
          unitType: {
            type: Type.STRING,
            description: "Unit type for tiling: 'cubes', 'paper_clips', 'bears', 'erasers'",
          },
          correctOrderCsv: {
            type: Type.STRING,
            description: "For order: comma-separated object names sorted shortest to longest",
          },
          referenceObjectName: {
            type: Type.STRING,
            description: "For indirect: name of the reference object used for transitive comparison",
          },
          referenceObjectLength: {
            type: Type.NUMBER,
            description: "For indirect: length of the reference object in unit cells",
          },
          referenceObjectColor: {
            type: Type.STRING,
            description: "For indirect: CSS color of the reference object",
          },
          clue0: {
            type: Type.STRING,
            description: "For indirect: first clue about the reference object",
          },
          clue1: {
            type: Type.STRING,
            description: "For indirect: second clue about the reference object",
          },
        },
        required: [
          "id", "type", "instruction", "hint", "narration",
          "objectName0", "objectLength0", "objectColor0",
          "objectName1", "objectLength1", "objectColor1",
          "correctAnswer",
        ],
      },
      description: "Array of 3-5 progressive measurement challenges",
    },
    unitType: {
      type: Type.STRING,
      description: "Default unit for tiling challenges: 'cubes', 'paper_clips', 'bears', 'erasers'",
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' for Kindergarten, '1' for Grade 1",
    },
  },
  required: ["title", "description", "challenges", "unitType", "gradeBand"],
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate length lab data for interactive measurement activities
 *
 * Grade-aware content:
 * - K: direct visual comparison (longer/shorter/same), tiling with cubes
 * - Grade 1: ordering 3 objects, indirect comparison with clues
 */
type LengthLabConfig = Partial<{
  targetEvalMode?: string;
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second field of the two-field contract: targetEvalMode = which skill,
   * difficulty = how much on-screen scaffolding (and structural shape) within it.
   * NEVER changes raw magnitude — only structure and help.
   */
  difficulty?: string;
}>;

export const generateLengthLab = async (
  ctx: GenerationContext,
): Promise<LengthLabData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as LengthLabConfig;
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    'length-lab',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Resolve support tier (the STUDENT's tier — drives application) ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  // pinnedType is ONLY for the prompt tone (single-mode sessions get a tier block).
  const pinnedType = evalConstraint?.allowedTypes.length === 1
    ? evalConstraint.allowedTypes[0] : undefined;
  const tierSection = pinnedType && supportTier
    ? buildTierPromptSection(pinnedType, supportTier) : '';

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(lengthLabSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : lengthLabSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // Randomize objects so Gemini doesn't repeat the same items
  const objectPool = [
    'pencil', 'crayon', 'marker', 'shoe', 'book', 'spoon',
    'ribbon', 'straw', 'toothbrush', 'fork', 'feather', 'paintbrush',
  ];
  const shuffled = objectPool.sort(() => Math.random() - 0.5);
  const sampleObjects = shuffled.slice(0, 4).join(', ');

  const colorPool = ['#4A90D9', '#E57373', '#81C784', '#FFB74D', '#BA68C8', '#4DD0E1', '#F06292'];
  const sampleColors = colorPool.sort(() => Math.random() - 0.5).slice(0, 3).join(', ');

  const validUnitTypes = ['cubes', 'paper_clips', 'bears', 'erasers'];
  const randomUnit = validUnitTypes[Math.floor(Math.random() * validUnitTypes.length)];

  const prompt = `
Create an educational length measurement activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A length lab is a workspace where students compare and measure objects visually
- Objects are displayed as colored bars on a baseline grid (1-12 unit cells)
- Students learn measurement concepts: direct comparison, non-standard units, ordering

${challengeTypeSection}
${tierSection}
${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * Focus on direct comparison: "Which is longer?" "Which is shorter?"
  * Use compare and tile_and_count types
  * Keep lengths between 2-8 units with obvious differences (at least 2 units apart)
  * Concrete, familiar objects kids can relate to
  * Simple, warm language ("Look at these two things! Which one is longer?")

- Grade 1 (gradeBand "1"):
  * Add ordering 3 objects and indirect comparison
  * Lengths can go up to 12 units
  * Introduce non-standard measurement vocabulary
  * Connect measurement to number concepts
` : ''}

OBJECT SUGGESTIONS for this session: ${sampleObjects}
COLOR SUGGESTIONS: ${sampleColors}
UNIT TYPE for tiling: ${randomUnit}

REQUIREMENTS:
1. Generate 3-5 challenges that progress in difficulty
2. Use K-appropriate objects that children know well (pencil, crayon, marker, shoe, book, spoon, ribbon, straw, etc.)
3. Object lengths MUST be integers between 1 and 12
4. Object colors MUST be valid CSS hex colors (e.g., '#4A90D9')
5. For compare challenges:
   - correctAnswer must be 'longer', 'shorter', or 'same' (object0 relative to object1)
   - Make length differences obvious: at least 2 units apart
6. For tile_and_count challenges:
   - correctUnitCount MUST equal objectLength0
   - Set unitType to '${randomUnit}'
7. For order challenges:
   - MUST provide objectName2, objectLength2, objectColor2
   - All three lengths must be different
   - correctOrderCsv = comma-separated names sorted shortest to longest
8. For indirect challenges (Grade 1 only):
   - MUST provide clue0, clue1, referenceObjectName, referenceObjectLength, referenceObjectColor
   - correctAnswer = name of the longer object
   - Clues must allow transitive reasoning
9. Use warm, encouraging language appropriate for young children
10. Include meaningful hints that guide without giving the answer
11. Include narration text the AI tutor can use

Return the complete length lab configuration.
`;

  logEvalModeResolution('LengthLab', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid length lab data returned from Gemini API');
  }

  // ── Structural validation ──

  // Validate gradeBand
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  // Validate unitType
  if (!validUnitTypes.includes(data.unitType)) {
    data.unitType = 'cubes';
  }

  // CSS hex color validation
  const isValidColor = (c: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(c);

  const validChallengeTypes = ['compare', 'tile_and_count', 'order', 'indirect'];

  // Filter to valid challenge types
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type),
  );

  // ── Per-challenge validation ──
  for (const challenge of data.challenges) {
    // Clamp lengths to 1-12
    challenge.objectLength0 = Math.max(1, Math.min(12, Math.round(challenge.objectLength0 || 3)));
    challenge.objectLength1 = Math.max(1, Math.min(12, Math.round(challenge.objectLength1 || 5)));

    // Validate colors — default to safe values
    if (!isValidColor(challenge.objectColor0)) challenge.objectColor0 = '#4A90D9';
    if (!isValidColor(challenge.objectColor1)) challenge.objectColor1 = '#E57373';

    // Type-specific validation
    switch (challenge.type) {
      case 'compare': {
        // Ensure correctAnswer is valid
        const validAnswers = ['longer', 'shorter', 'same'];
        if (!validAnswers.includes(challenge.correctAnswer)) {
          // Derive from lengths
          if (challenge.objectLength0 > challenge.objectLength1) {
            challenge.correctAnswer = 'longer';
          } else if (challenge.objectLength0 < challenge.objectLength1) {
            challenge.correctAnswer = 'shorter';
          } else {
            challenge.correctAnswer = 'same';
          }
        }
        // Verify answer matches actual lengths
        const expected =
          challenge.objectLength0 > challenge.objectLength1 ? 'longer'
          : challenge.objectLength0 < challenge.objectLength1 ? 'shorter'
          : 'same';
        if (challenge.correctAnswer !== expected) {
          challenge.correctAnswer = expected;
        }
        break;
      }

      case 'tile_and_count': {
        // correctUnitCount must equal objectLength0
        challenge.correctUnitCount = challenge.objectLength0;
        // Ensure unitType is valid
        if (!challenge.unitType || !validUnitTypes.includes(challenge.unitType)) {
          challenge.unitType = data.unitType;
        }
        // Set a default correctAnswer if empty
        if (!challenge.correctAnswer) {
          challenge.correctAnswer = String(challenge.correctUnitCount);
        }
        break;
      }

      case 'order': {
        // Validate third object exists
        if (!challenge.objectName2 || challenge.objectLength2 == null) {
          challenge.objectName2 = 'straw';
          challenge.objectLength2 = Math.max(1, Math.min(12,
            Math.round((challenge.objectLength0 + challenge.objectLength1) / 2) + 1));
        }
        challenge.objectLength2 = Math.max(1, Math.min(12, Math.round(challenge.objectLength2)));
        if (!isValidColor(challenge.objectColor2 || '')) {
          challenge.objectColor2 = '#81C784';
        }

        // Ensure all lengths are distinct
        const lengths = [
          { name: challenge.objectName0, length: challenge.objectLength0 },
          { name: challenge.objectName1, length: challenge.objectLength1 },
          { name: challenge.objectName2, length: challenge.objectLength2 },
        ];
        // If duplicates, nudge
        if (lengths[0].length === lengths[1].length) lengths[1].length = Math.min(12, lengths[1].length + 1);
        if (lengths[1].length === lengths[2].length) lengths[2].length = Math.min(12, lengths[2].length + 1);
        if (lengths[0].length === lengths[2].length) lengths[2].length = Math.min(12, lengths[2].length + 2);
        challenge.objectLength0 = lengths[0].length;
        challenge.objectLength1 = lengths[1].length;
        challenge.objectLength2 = lengths[2].length;

        // LL-1: Ensure all names are unique — name-keyed UI removes all items sharing a name
        const usedOrderNames = new Set<string>([lengths[0].name]);
        for (let i = 1; i < lengths.length; i++) {
          if (usedOrderNames.has(lengths[i].name)) {
            const alt = objectPool.find(n => !usedOrderNames.has(n));
            if (alt) lengths[i].name = alt;
          }
          usedOrderNames.add(lengths[i].name);
        }
        challenge.objectName0 = lengths[0].name;
        challenge.objectName1 = lengths[1].name;
        challenge.objectName2 = lengths[2].name;

        // Compute correct order CSV
        const sorted = [...lengths].sort((a, b) => a.length - b.length);
        challenge.correctOrderCsv = sorted.map(o => o.name).join(',');

        // Always sync correctAnswer with computed correctOrderCsv
        challenge.correctAnswer = challenge.correctOrderCsv;

        // LL-2: Derive instruction from actual names — prevents free-composed wrong-name bug
        challenge.instruction = `Put the ${lengths[0].name}, ${lengths[1].name}, and ${lengths[2].name} in order from shortest to longest!`;

        break;
      }

      case 'indirect': {
        // Validate reference object fields
        if (!challenge.referenceObjectName) challenge.referenceObjectName = 'string';
        if (challenge.referenceObjectLength == null) {
          challenge.referenceObjectLength = Math.round(
            (challenge.objectLength0 + challenge.objectLength1) / 2);
        }
        challenge.referenceObjectLength = Math.max(1, Math.min(12, Math.round(challenge.referenceObjectLength)));
        if (!isValidColor(challenge.referenceObjectColor || '')) {
          challenge.referenceObjectColor = '#FFB74D';
        }

        // LL-3, LL-4: Ensure object lengths differ by at least 2 (so a reference point can fit between them)
        if (Math.abs(challenge.objectLength0 - challenge.objectLength1) < 2) {
          if (challenge.objectLength0 >= challenge.objectLength1) {
            challenge.objectLength0 = Math.min(12, challenge.objectLength1 + 2);
          } else {
            challenge.objectLength1 = Math.min(12, challenge.objectLength0 + 2);
          }
        }

        // LL-3, LL-4: Clamp referenceObjectLength to be STRICTLY between the two object lengths
        const indShorter = Math.min(challenge.objectLength0, challenge.objectLength1);
        const indLonger = Math.max(challenge.objectLength0, challenge.objectLength1);
        if (challenge.referenceObjectLength <= indShorter || challenge.referenceObjectLength >= indLonger) {
          challenge.referenceObjectLength = Math.round((indShorter + indLonger) / 2);
          if (challenge.referenceObjectLength <= indShorter) challenge.referenceObjectLength = indShorter + 1;
          if (challenge.referenceObjectLength >= indLonger) challenge.referenceObjectLength = indLonger - 1;
        }

        // LL-3, LL-4: Derive clues from corrected lengths — always regenerate for accuracy
        const refName = challenge.referenceObjectName;
        const indShortName = challenge.objectLength0 < challenge.objectLength1
          ? challenge.objectName0 : challenge.objectName1;
        const indLongName = challenge.objectLength0 < challenge.objectLength1
          ? challenge.objectName1 : challenge.objectName0;
        challenge.clue0 = `The ${indShortName} is shorter than the ${refName}.`;
        challenge.clue1 = `The ${refName} is shorter than the ${indLongName}.`;

        // correctAnswer = name of the longer object (always derived)
        challenge.correctAnswer = challenge.objectLength0 > challenge.objectLength1
          ? challenge.objectName0
          : challenge.objectName1;
        break;
      }
    }
  }

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'compare';
    console.log(`[LengthLab] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [{
      id: 'c1',
      type: fallbackType,
      instruction: 'Which one is longer? Point to it!',
      hint: 'Look at how far each one stretches. Which goes further?',
      narration: "Let's compare these two things! Which one is longer?",
      objectName0: 'pencil',
      objectLength0: 7,
      objectColor0: '#4A90D9',
      objectName1: 'crayon',
      objectLength1: 4,
      objectColor1: '#E57373',
      correctAnswer: 'longer',
    }];
  }

  // ── Apply support tier deterministically (per challenge, from its OWN mode) ──
  // Difficulty is a STUDENT property, so a blended/auto session gets it too —
  // gate only on a tier being present, never on pinnedType.
  if (supportTier) {
    for (const ch of data.challenges) {
      const sc = resolveSupportStructure(ch.type, supportTier);
      const shape = resolveProblemShape(ch.type, supportTier);
      ch.supportTier = supportTier;

      // #1 perception aids (guarded per mode; protects the count-leak contract)
      if (ch.type === 'compare' || ch.type === 'order') {
        ch.showUnitTicks = sc.showUnitTicks;
      }
      if (ch.type === 'tile_and_count') {
        ch.showAlignmentFeedback = sc.showAlignmentFeedback;
      }

      // #2 instruction-as-scaffold (indirect): append the chain tip, or leave bare
      if (ch.type === 'indirect' && sc.instructionTip) {
        ch.instruction = `${ch.instruction} ${sc.instructionTip}`;
      }

      // structural shape (code-enforced exact levers; guarded so no-tier path is byte-identical)
      if (ch.type === 'compare' && shape.compareGap != null) {
        applyCompareGap(ch, shape.compareGap);
      }
      if (ch.type === 'order' && shape.orderMinGap != null) {
        applyOrderSpread(ch, shape.orderMinGap);
      }
    }
    console.log(
      `[LengthLab] Support tier "${supportTier}" applied per-challenge `
      + `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'})`,
    );
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map(c => c.type).join(', ');
  console.log(`[LengthLab] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  return data;
};
