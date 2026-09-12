import { Type, Schema } from "@google/genai";
import { NumberBondData } from "../../primitives/visual-primitives/math/NumberBond";
// The ONE shared validity predicate for a bond's known part (1..whole−1),
// IMPORTED from the script module — the DI build gates drop against the same
// predicate this generator repairs against, so the two sides of the wire
// cannot drift (numberBondScript.ts, `isValidBondPart`).
import { isValidBondPart } from "../../primitives/visual-primitives/math/numberBondScript";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModeConstraint,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import { buildScopePromptSection } from "../scopeContext";
import { resolveTeenWindow, teenSweep, TEEN_MIN as TEEN_WHOLE_MIN, TEEN_MAX as TEEN_WHOLE_MAX } from "./teenWindow";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  decompose: {
    promptDoc:
      `"decompose": Student finds ALL ways to split a whole into two parts. `
      + `part1 and part2 should be null (student discovers them). `
      + `allPairs MUST include every unique pair [a, b] where a + b = whole and a <= b. `
      + `Example for whole=5: [[0,5],[1,4],[2,3]]. Concrete manipulative with full guidance.`,
    schemaDescription: "'decompose' (find all pairs)",
  },
  'ten-and-ones': {
    promptDoc:
      `"ten-and-ones": The whole is a TEEN NUMBER, 11-19, and the student splits it into a full TEN `
      + `and the ones left over — the only accepted pair (CCSS K.NBT.1, "14 = 10 + 4"). `
      + `Set whole to the teen number; part1 and part2 should be null (the student produces both). `
      + `VARY the whole across challenges — nine teen numbers exist, so do not repeat one in a set. `
      + `Concrete manipulative; the student builds it with their hands, then says the ones.`,
    schemaDescription: "'ten-and-ones' (split a teen number into a ten and the ones)",
  },
  'missing-part': {
    promptDoc:
      `"missing-part": Given the whole and one part, find the other. `
      + `Set part1 to the known part, part2 to null (student finds it). `
      + `part1 MUST be between 1 and whole-1 — never 0 and never the whole. `
      + `The child SAYS the missing part out loud to the live tutor. The hidden group stays covered; counters are optional support.`,
    schemaDescription: "'missing-part' (find unknown part)",
  },
  'related-fact': {
    promptDoc:
      `"related-fact": The SPOKEN fact family — the child says two related facts over ONE bond, `
      + `the addition fact and then its matching subtraction. `
      + `Set part1 and part2 to the two parts (part1 + part2 = whole). `
      + `part1 and part2 MUST BE DIFFERENT — a symmetric bond like 3 and 3 gives both turns the `
      + `same answer, and the activity DROPS the challenge rather than ask it. `
      + `Both parts must be between 1 and whole-1. The same colored counters join before turn 1 and one group separates before turn 2. Kindergarten and Grade 1.`,
    schemaDescription: "'related-fact' (say the addition fact, then its related subtraction)",
  },
  'fact-family': {
    promptDoc:
      `"fact-family": Student constructs every distinct related equation. `
      + `Set part1 and part2 to the two parts. `
      + `For unequal parts, factFamily MUST have 4 distinct forms: ["a+b=w","b+a=w","w-a=b","w-b=a"]. `
      + `For equal parts, emit only the 2 distinct forms ["a+a=w","w-a=a"] — never duplicate them. Grade 1 only.`,
    schemaDescription: "'fact-family' (all distinct related equations)",
  },
  'build-equation': {
    promptDoc:
      `"build-equation": Student constructs a specific equation from the bond. `
      + `Set part1 and part2 to the two parts. `
      + `targetEquation remains a valid source fixture, but the runtime asks the student to choose and perform an action, then build the equation matching that committed action. `
      + `MIX valid addition AND subtraction source forms across challenges. `
      + `Grade 1 only. Transitional symbolic/pictorial.`,
    schemaDescription: "'build-equation' (construct equation — mix + and −)",
  },
};

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------
// All number-bond modes are T2 in the §5a tier table. B4 sweep replaces the
// prompt's "3-5" range with a templated per-mode count. The existing
// `challengeCount` config still wins when set (manifest override path).

type NumberBondChallengeType =
  | 'decompose'
  | 'missing-part'
  | 'related-fact'
  | 'ten-and-ones'
  | 'fact-family'
  | 'build-equation';

// `ten-and-ones` is the one mode whose whole LEAVES the 2..maxNumber window:
// its wholes are the teen numbers the objective names, and its answer is a
// placement rather than a spoken number, so neither the K cap of 5 nor the
// Grade-1 cap of 10 binds it. The window and the sweep are shared with
// ten-frame's two teen modes (`teenWindow.ts`).

const DEFAULT_INSTANCE_COUNT = 5; // T2 fallback
const MAX_INSTANCE_COUNT = 6;

const COUNT_BY_MODE: Record<NumberBondChallengeType, number> = {
  // Under the DI judged loop each decompose challenge EXPANDS into one judged
  // turn per pair (~3 at K, ~5 at G1), so 5 challenges meant ~24 tutor-judged
  // turns at G1 (live probe, 2026-08-14). 3 keeps a session at ~9-15 turns —
  // the same student-visible volume the other modes get. Manifest
  // challengeCount still overrides.
  decompose: 3,
  // One judged turn per item (no pair expansion — there is exactly one right
  // pair), and nine distinct teen numbers to draw from, so a five-item session
  // is still all-distinct content.
  'ten-and-ones': 5,
  'missing-part': 5,    // T2 — B4 bump 3-5 → 5
  // Each challenge EXPANDS into two judged turns (the addition fact, then its
  // related subtraction), so 3 challenges is 6 tutor-judged turns — the same
  // student-visible volume `missing-part` gets from 5 one-turn challenges.
  'related-fact': 3,
  'fact-family': 5,     // T2 — B4 bump 3-5 → 5
  'build-equation': 5,  // T2 — B4 bump 3-5 → 5
};

// ---------------------------------------------------------------------------
// Within-mode difficulty = structural SUPPORT tier (config.difficulty)
// ---------------------------------------------------------------------------
// The two-field contract: config.targetEvalMode says WHICH skill (task identity,
// matched to the objective by the manifest); config.difficulty says how much
// on-workspace SUPPORT the student gets while doing it ('easy' = max scaffolding,
// 'hard' = min). It NEVER changes the magnitude: the grade band + maxNumber own
// the whole/part ranges. A harder tier means LESS visible help (dots, the live
// equation mirror, the fact-family worked example) and — for missing-part — a
// structurally harder unknown SIDE, never a bigger number.
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

/**
 * The structural lever for missing-part: WHICH side is the unknown.
 *  - 'larger'  → unknown is the LARGER part (known = smaller). Easiest: count up.
 *  - 'smaller' → unknown is the SMALLER part (known = larger).
 *  - null      → either part may be unknown (let the generator's choice stand).
 */
type UnknownSide = 'larger' | 'smaller' | null;

interface SupportScaffold {
  /** Persistent counters. In model-based modes these are the learning objects,
   *  not a removable answer hint; Missing Part keeps them behind an explicit
   *  learner-requested support action. */
  showCounters: boolean;
  /** Live part-whole equation mirror (`? + ? = whole`, `p1 + p2 = whole`). The
   *  free part-whole frame; withdrawn at the harder tiers. */
  showEquation: boolean;
  /** Fact-family worked-example helper (all distinct forms). Reveals the whole task if
   *  left up at hard — gate it. easy → visible+expanded, medium → collapsed,
   *  hard → hidden. */
  showFactFamilyHelper: boolean;
  /** Whether to offer an early hint (before the usual 2-attempt gate). Currently
   *  prompt-only tone for missing-part; the component still gates the hint panel
   *  on attempts, so this rides the instruction/narration warmth. */
  showEarlyHint: boolean;
  /** missing-part structural lever: which side the student must find. */
  unknownSide: UnknownSide;
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-workspace support structure for a tier on a pinned challenge type.
 * Optional scaffolding is withdrawn as the tier hardens; the SAME task keeps
 * its concrete model and number range. The unknown-side lever for
 * missing-part is STRUCTURAL (harder problem) and is CODE-ENFORCED below, not
 * trusted to the LLM.
 */
function resolveSupportStructure(
  pinnedType: NumberBondChallengeType,
  tier: SupportTier,
): SupportScaffold {
  // Defaults — refined per-mode below.
  let showCounters = tier !== 'hard';
  let showEquation = tier === 'easy';
  let showFactFamilyHelper = tier !== 'hard';
  let showEarlyHint = tier === 'easy';
  let unknownSide: UnknownSide = null;

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this changes optional scaffolding and (for missing-part) the unknown SIDE only. Persistent counters remain wherever they are the learning model, and no answer-bearing equation appears before the assessed response. Keep every whole and part within the grade band and maxNumber; a harder tier NEVER means bigger numbers or a different assessment.`,
  ];

  switch (pinnedType) {
    case 'decompose':
    case 'ten-and-ones':
      // Counters are the objects being manipulated, not a removable hint.
      showCounters = true;
      showEquation = false; // The runtime reveals the equation after the spoken interpretation.
      promptLines.length = 0;
      promptLines.push('Split and Say uses a fixed set of movable counters at every support tier. Students move them between the whole and both parts, then say one highlighted part. '
        + 'Never print live part counts or the equation before the spoken answer. Preserve the same number bounds across support tiers. '
        + (pinnedType === 'ten-and-ones' ? 'The split must contain a full ten; the spoken answer is the remaining ones.' : 'Each new pair has one hand construction and one spoken interpretation.'));
      break;

    case 'missing-part':
      showCounters = true;
      showEquation = false;
      showEarlyHint = tier === 'easy';
      // Structural unknown-side lever (code-enforced): easy → unknown is the
      // LARGER part (count up from a small known part — easiest); medium →
      // unknown is the SMALLER part; hard → either part (no steer).
      unknownSide = tier === 'easy' ? 'larger' : tier === 'medium' ? 'smaller' : null;
      promptLines.push(
        tier === 'easy'
          ? 'Introduce the optional counter workspace explicitly. Keep the unknown group covered and do not show an equation until after the spoken answer.'
          : tier === 'hard'
            ? 'Start with the compact whole/known/covered bond. Keep the counter workspace available on request and reveal no answer-bearing label or equation.'
            : 'Start with the covered bond and make the optional counter workspace available on request. Hide the equation until affirmation.',
      );
      break;

    case 'related-fact':
      showCounters = true;
      showEquation = false;
      showFactFamilyHelper = false;
      promptLines.push('Keep stable colored counter groups across join, spoken addend, separation, and spoken remainder. Do not print the highlighted group count or either equation before its spoken response.');
      break;

    case 'fact-family':
      showCounters = true;
      showFactFamilyHelper = tier !== 'hard';
      promptLines.push(
        tier === 'easy'
          ? 'Keep the movable counter groups visible and the different-bond worked example available. Build one transformation-linked equation at a time.'
          : tier === 'hard'
            ? 'Keep the counter model visible but hide the worked example. The student transforms the model and constructs each distinct form.'
            : 'Keep the counter model visible; the different-bond worked example is available but collapsed.',
      );
      break;

    case 'build-equation':
      showCounters = true;
      showFactFamilyHelper = false;
      showEquation = false;
      promptLines.push(
        tier === 'easy'
          ? 'Keep the movable counter groups visible. Prompt the student to choose a join or separation action, then build its equation; never prefill the equation.'
          : tier === 'hard'
            ? 'Keep the model visible without a symbolic helper. The equation must match the committed action.'
            : 'Keep the movable model visible and use a neutral tile workspace after the action.',
      );
      break;
  }

  return { showCounters, showEquation, showFactFamilyHelper, showEarlyHint, unknownSide, promptLines };
}

// ---------------------------------------------------------------------------
// Per-type field relevance — controls which fields appear in the schema
// ---------------------------------------------------------------------------

/** Fields relevant to each challenge type (beyond the always-required id/type/instruction/whole) */
const CHALLENGE_TYPE_FIELDS: Record<string, string[]> = {
  decompose: ['allPairs'],
  // No optional fields: both parts are the student's to place, and the ten is
  // fixed by the mode rather than carried on the wire.
  'ten-and-ones': [],
  'missing-part': ['part1'],
  // Both parts travel: the mode asks a fact about each of them in turn, and the
  // activity needs them to differ before it will build the pair.
  'related-fact': ['part1', 'part2'],
  'fact-family': ['part1', 'part2', 'factFamily'],
  'build-equation': ['part1', 'part2', 'targetEquation'],
};

/** All optional challenge-level field definitions (reusable across schema builds) */
const OPTIONAL_FIELD_SCHEMAS: Record<string, Schema> = {
  part1: {
    type: Type.NUMBER,
    description: "First part (nullable — null when student must find it). For missing-part: the known part.",
    nullable: true,
  },
  part2: {
    type: Type.NUMBER,
    description: "Second part (nullable — null when student must find it).",
    nullable: true,
  },
  allPairs: {
    type: Type.ARRAY,
    items: { type: Type.ARRAY, items: { type: Type.NUMBER } },
    description: "ALL valid pairs [a, b] where a + b = whole and a <= b. E.g., for 5: [[0,5],[1,4],[2,3]].",
  },
  factFamily: {
    type: Type.ARRAY,
    items: { type: Type.STRING },
    description: "Every distinct related form: 4 for unequal parts, 2 for equal parts.",
  },
  targetEquation: {
    type: Type.STRING,
    description: "The equation to construct (e.g., '3+2=5').",
  },
};

// ---------------------------------------------------------------------------
// Schema builder
// ---------------------------------------------------------------------------

/**
 * Build a Gemini schema tailored to the allowed challenge types.
 * When constrained to a single type (e.g. decompose-only), irrelevant
 * fields like factFamily / targetEquation are omitted entirely so the
 * LLM focuses on the fields that matter.
 */
function buildNumberBondSchema(allowedTypes?: string[]): Schema {
  // Determine which optional fields to include
  const types = allowedTypes ?? Object.keys(CHALLENGE_TYPE_FIELDS);
  const fieldSet: Record<string, boolean> = {};
  for (let ti = 0; ti < types.length; ti++) {
    const fields = CHALLENGE_TYPE_FIELDS[types[ti]] ?? [];
    for (let fi = 0; fi < fields.length; fi++) {
      fieldSet[fields[fi]] = true;
    }
  }

  // Build challenge item properties — always include core fields
  const challengeProps: Record<string, Schema> = {
    id: { type: Type.STRING, description: "Unique challenge ID (e.g., 'c1', 'c2')" },
    type: {
      type: Type.STRING,
      description: types.length === 1
        ? `Challenge type: always '${types[0]}'`
        : `Challenge type: ${types.map(t => CHALLENGE_TYPE_DOCS[t]?.schemaDescription ?? t).join(', ')}`,
      ...(allowedTypes ? { enum: allowedTypes } : {}),
    },
    instruction: {
      type: Type.STRING,
      description: "Student-facing instruction, warm and encouraging. MUST reference the same 'whole' number used in the challenge.",
    },
    whole: { type: Type.NUMBER, description: "The whole number in the bond (e.g., 5). The instruction MUST match this number." },
  };

  // Add only the relevant optional fields
  const activeFields = Object.keys(fieldSet);
  for (let i = 0; i < activeFields.length; i++) {
    const field = activeFields[i];
    if (OPTIONAL_FIELD_SCHEMAS[field]) {
      challengeProps[field] = OPTIONAL_FIELD_SCHEMAS[field];
    }
  }

  return {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "Title for the number bond activity (e.g., 'Break Apart 5!', 'Number Bond Fun')",
      },
      description: {
        type: Type.STRING,
        description: "Brief educational description of what students will learn",
      },
      maxNumber: {
        type: Type.NUMBER,
        description: "Maximum whole number used in challenges. 5 for Kindergarten, 10 for Grade 1.",
      },
      showCounters: {
        type: Type.BOOLEAN,
        description: "Whether to show visual counters (dots) alongside the bond diagram",
      },
      showEquation: {
        type: Type.BOOLEAN,
        description: "Whether to display the equation representation below the bond",
      },
      gradeBand: {
        type: Type.STRING,
        description: "Grade band: 'K' for Kindergarten, '1' for Grade 1",
      },
      challenges: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: challengeProps,
          required: ["id", "type", "instruction", "whole"],
        },
        description: `Array of 3-6 progressive challenges${types.length === 1 ? ` (all type '${types[0]}')` : ''}`,
      },
    },
    required: ["title", "description", "maxNumber", "showCounters", "showEquation", "gradeBand", "challenges"],
  };
}

// ---------------------------------------------------------------------------
// Instruction ↔ whole consistency helpers
// ---------------------------------------------------------------------------

/** Check whether the instruction text mentions the correct whole number */
function instructionMatchesWhole(instruction: string | undefined, whole: number): boolean {
  if (!instruction) return false;
  // Look for the whole number as a standalone token (not part of a larger number)
  const regex = new RegExp(`\\b${whole}\\b`);
  return regex.test(instruction);
}

/** Generate a safe instruction that always references the correct whole */
function generateInstruction(type: string, whole: number): string {
  switch (type) {
    case 'decompose':
      return `Find all the ways to break apart ${whole}. How many pairs can you find?`;
    case 'ten-and-ones':
      return `The whole is ${whole}. Break it into a ten and some more!`;
    case 'missing-part':
      return `The whole is ${whole}. One part is shown — can you find the missing part?`;
    case 'related-fact':
      return `The whole is ${whole}. Say the two facts that go with this number bond.`;
    case 'fact-family':
      return `Build every distinct equation for this number bond with ${whole}.`;
    case 'build-equation':
      return `Use the tiles to build an equation with ${whole}.`;
    default:
      return `Work with the number ${whole}.`;
  }
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate number bond data for interactive part-part-whole activities
 *
 * Grade-aware content:
 * - Kindergarten (K): maxNumber 5, focus on decompose and missing-part
 * - Grade 1: maxNumber 10, may include all 6 challenge types
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns NumberBondData with complete configuration
 */
type NumberBondConfig = Partial<{
  maxNumber: number;
  challengeTypes: string[];
  challengeCount: number;
  /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
  targetEvalMode: string;
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * The second axis of the two-field contract: targetEvalMode = which skill,
   * difficulty = how much on-workspace scaffolding within it. NEVER changes numbers.
   */
  difficulty: string;
}>;

export const generateNumberBond = async (
  ctx: GenerationContext,
): Promise<NumberBondData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const scopeSection = buildScopePromptSection(ctx.scope);
  const config = ctx.raw as NumberBondConfig;
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'number-bond',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // For config.challengeTypes without an eval mode, use them as a hint
  const effectiveChallengeTypes = evalConstraint?.allowedTypes ?? config?.challengeTypes;

  // The teen mode carries its own number window, so every cap below has to
  // know about it before it fires.
  const hasTeenType = !!evalConstraint?.allowedTypes.includes('ten-and-ones');

  // ── Resolve per-mode instance count up-front ──
  const pinnedType =
    evalConstraint?.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as NumberBondChallengeType)
      : undefined;
  const instanceCount = Math.max(
    1,
    Math.min(
      MAX_INSTANCE_COUNT,
      config?.challengeCount ??
        (pinnedType ? COUNT_BY_MODE[pinnedType] : undefined) ??
        DEFAULT_INSTANCE_COUNT,
    ),
  );

  // ── Within-mode support tier (config.difficulty). The STUDENT's tier DRIVES
  // application per-challenge below; pinnedType only sets the prompt tone (a
  // blend has no single mode to describe to the LLM). ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const tierScaffold =
    pinnedType && supportTier ? resolveSupportStructure(pinnedType, supportTier) : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  // ── Build mode-constrained schema (strips irrelevant fields per type) ──
  const activeSchema = buildNumberBondSchema(evalConstraint?.allowedTypes ?? effectiveChallengeTypes);

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create an educational number bond activity for teaching "${topic}" to ${gradeLevel} students.
${scopeSection}
CONTEXT:
- A number bond shows part-part-whole relationships: a whole number connected to two parts that add up to it
- Students learn to decompose numbers, find missing parts, build equations, and understand fact families
- This builds addition/subtraction fluency through visual part-part-whole reasoning

${challengeTypeSection}
${tierSection}
${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * maxNumber: 5 (wholes range from 2 to 5)
  * Focus on 'decompose', 'missing-part' and 'related-fact' types ONLY — EXCEPT 'ten-and-ones',
    which is a Kindergarten place-value mode (CCSS K.NBT.1) whose wholes are 11-19
  * Use warm, playful language ("Can you break apart 4? How many ways?")
  * showCounters: true (visual dots help young learners)
  * showEquation: false (K students work visually, not symbolically)

- Grade 1 (gradeBand "1"):
  * maxNumber: 10 (wholes range from 3 to 10)
  * May include all 6 types: decompose, missing-part, related-fact, ten-and-ones, fact-family, build-equation
  * More formal but still encouraging language
  * showCounters: true
  * showEquation: true (Grade 1 connects bonds to equations)
` : ''}

${(() => {
  const hints: string[] = [];
  if (config?.maxNumber) hints.push(`- Max number: ${config.maxNumber}`);
  if (effectiveChallengeTypes) hints.push(`- Challenge types to include: ${effectiveChallengeTypes.join(', ')}`);
  hints.push(`- Number of challenges: ${instanceCount}`);
  return hints.length > 0 ? `CONFIGURATION HINTS:\n${hints.join('\n')}` : '';
})()}

REQUIREMENTS:
1. Generate EXACTLY ${instanceCount} challenges that progress in difficulty
2. Start with smaller wholes and simpler types, increase gradually
3. Use warm, encouraging instruction text for young children
4. For Kindergarten: ONLY use 'decompose', 'missing-part', 'related-fact' and 'ten-and-ones' types
4b. For 'ten-and-ones', the whole is a TEEN NUMBER 11-19 (never 10, never 20) and both
    parts are null — the student places the ten and the ones. Vary the whole across the set.
5. For Grade 1: mix all 6 types, progressing from decompose to symbolic relationships
6. For decompose challenges, allPairs MUST include ALL valid unique pairs (a <= b)
7. For fact-family challenges, factFamily MUST contain every DISTINCT family form: 4 for unequal parts, 2 for equal parts
8. Vary the whole numbers across challenges (don't repeat the same whole consecutively)
9. Ensure part1 + part2 = whole whenever parts are specified
10. For missing-part, choose part1 values that are not trivially 0 or equal to whole
10b. For related-fact, part1 and part2 must both be 1..whole-1 AND DIFFERENT from each other
    (never 2 and 2 for a whole of 4) — the two spoken turns must not share an answer
11. CRITICAL: Each challenge's "instruction" text MUST reference the SAME number as its "whole" field. If whole is 5, the instruction must say 5 — never a different number.

Return the complete number bond configuration.
`;

  logEvalModeResolution('NumberBond', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid number bond data returned from Gemini API');
  }

  // ---- Validation & defaults ----

  // Validate gradeBand
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  // Validate maxNumber. A ten-and-ones session is pinned to the teen window at
  // every band — the K cap of 5 and the global cap of 10 are about SPOKEN and
  // symbolic answers, and this mode has neither.
  if (hasTeenType) {
    data.maxNumber = TEEN_WHOLE_MAX;
  } else {
    if (!data.maxNumber || data.maxNumber < 2) {
      data.maxNumber = data.gradeBand === 'K' ? 5 : 10;
    }
    if (data.gradeBand === 'K' && data.maxNumber > 5) {
      data.maxNumber = 5;
    }
    if (data.maxNumber > 10) {
      data.maxNumber = 10;
    }
  }

  // Ensure booleans
  if (typeof data.showCounters !== 'boolean') {
    data.showCounters = true;
  }
  if (typeof data.showEquation !== 'boolean') {
    data.showEquation = data.gradeBand === '1';
  }

  // Valid challenge types (safety net — schema enum handles eval mode case)
  const validTypes = ['decompose', 'missing-part', 'related-fact', 'ten-and-ones', 'fact-family', 'build-equation'];
  // `related-fact` is K-legal and `fact-family` is not, deliberately: both teach
  // the inverse relationship, but one is said out loud and the other is typed,
  // and typing is what the pre-reader band excludes
  // (qa/reader-fit/k-band-floor-2026-09-08.md).
  const kOnlyTypes = ['decompose', 'missing-part', 'related-fact', 'ten-and-ones'];

  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validTypes.includes(c.type)
  );

  // For K, strip out fact-family and build-equation
  if (data.gradeBand === 'K') {
    data.challenges = data.challenges.filter(
      (c: { type: string }) => kOnlyTypes.includes(c.type)
    );
  }

  // Defensive count clamp — Gemini occasionally over-shoots even with an
  // explicit count in the prompt. Trim to instanceCount when over; if under,
  // accept the shorter list as-is.
  if (data.challenges.length > instanceCount) {
    data.challenges = data.challenges.slice(0, instanceCount);
  }

  // ── The teen wholes are CODE-OWNED ───────────────────────────────────────
  // Assigned from the lesson's own window, not left to the model: a live
  // ten-frame draw against "16-19" came back mostly 13-15, and the same drift
  // here would silently put a teen-number lesson back inside the cap this mode
  // exists to escape. See `teenWindow.ts`.
  {
    const teenChallenges = (data.challenges as Array<{ type: string; whole: number }>)
      .filter((ch) => ch.type === 'ten-and-ones');
    if (teenChallenges.length > 0) {
      const window = resolveTeenWindow(ctx.scope?.objectiveText, ctx.scope?.intent, topic);
      const sweep = teenSweep(window, teenChallenges.length);
      teenChallenges.forEach((ch, i) => { ch.whole = sweep[i]; });
      console.log(
        `[NumberBond] Teen window ${window.start}-${window.end} from the lesson text `
        + `→ ${teenChallenges.length} item(s): [${sweep.join(', ')}]`,
      );
    }
  }

  // Per-challenge validation
  let buildEqIndex = 0;
  for (const challenge of data.challenges) {
    // Capture original whole before clamping (to detect instruction drift)
    const originalWhole = challenge.whole;

    // Ensure whole is within range. ten-and-ones has its own window: a whole
    // of ten or twenty has no "ten and some more" to make, so it is repaired
    // into 11-19 rather than clamped against maxNumber.
    if (challenge.type === 'ten-and-ones') {
      if (!Number.isInteger(challenge.whole) || challenge.whole < TEEN_WHOLE_MIN) {
        challenge.whole = TEEN_WHOLE_MIN + 3;
      }
      if (challenge.whole > TEEN_WHOLE_MAX) {
        challenge.whole = TEEN_WHOLE_MAX;
      }
    } else {
      if (!challenge.whole || challenge.whole < 2) {
        challenge.whole = data.gradeBand === 'K' ? 4 : 7;
      }
      if (challenge.whole > data.maxNumber) {
        challenge.whole = data.maxNumber;
      }
    }

    // If whole was clamped, the instruction likely references the wrong number — regenerate it
    if (originalWhole !== challenge.whole || !instructionMatchesWhole(challenge.instruction, challenge.whole)) {
      challenge.instruction = generateInstruction(challenge.type, challenge.whole);
    }

    // ten-and-ones: BOTH parts are the student's to place, and the accepted
    // pair is fixed by the mode (a ten and the rest), so nothing about it
    // travels on the wire. Clearing the other fields keeps a stray part1 from
    // rendering as a given.
    if (challenge.type === 'ten-and-ones') {
      challenge.part1 = null;
      challenge.part2 = null;
      challenge.allPairs = null;
      challenge.factFamily = null;
      challenge.targetEquation = null;
    }

    // Compute allPairs for decompose if missing or incomplete
    if (challenge.type === 'decompose') {
      const expectedPairs: [number, number][] = [];
      for (let a = 0; a <= Math.floor(challenge.whole / 2); a++) {
        expectedPairs.push([a, challenge.whole - a]);
      }
      // Always recompute — never trust Gemini's allPairs
      challenge.allPairs = expectedPairs;
      // Nullify parts for decompose (student discovers them)
      challenge.part1 = null;
      challenge.part2 = null;
    }

    // Validate missing-part. The known part must be 1..whole−1 (shared DI
    // gate): 0 slipped the old `< 0` check and, spoken, would put the whole
    // itself in the child's mouth as "the other part".
    if (challenge.type === 'missing-part') {
      if (!isValidBondPart(challenge.whole, challenge.part1)) {
        challenge.part1 = Math.max(1, Math.floor(challenge.whole / 2));
      }
      challenge.part2 = null;
      challenge.allPairs = null;
      challenge.factFamily = null;
      challenge.targetEquation = null;
    }

    // Validate related-fact. Two spoken turns share one bond, so BOTH parts are
    // real and they must DIFFER — with part1 === part2 the addition turn and the
    // subtraction turn have the same answer and a child who repeats themselves
    // scores the second one. The script drops a symmetric bond outright, so the
    // repair here is what keeps a draw from losing challenges to it.
    if (challenge.type === 'related-fact') {
      // A whole of 2 has only the symmetric split; nothing to repair it into.
      if (challenge.whole < 3) challenge.whole = data.gradeBand === 'K' ? 5 : 7;
      let p1 = isValidBondPart(challenge.whole, challenge.part1)
        ? (challenge.part1 as number)
        : Math.max(1, Math.floor(challenge.whole / 3));
      if (p1 * 2 === challenge.whole) p1 = p1 > 1 ? p1 - 1 : p1 + 1;
      challenge.part1 = p1;
      challenge.part2 = challenge.whole - p1;
      challenge.allPairs = null;
      challenge.factFamily = null;
      challenge.targetEquation = null;
    }

    // Validate fact-family. `??` kept a generated part1 of 0 (degenerate
    // family: 0+w=w twice); the shared gate repairs it like any other
    // out-of-range part.
    if (challenge.type === 'fact-family') {
      const p1 = isValidBondPart(challenge.whole, challenge.part1)
        ? challenge.part1
        : Math.max(1, Math.floor(challenge.whole / 3));
      const p2 = challenge.whole - p1;
      challenge.part1 = p1;
      challenge.part2 = p2;
      // Required FORM coverage differs from mathematical equivalence. Unequal
      // parts need both addition orders and both subtraction directions; equal
      // parts have only one distinct form of each operation.
      challenge.factFamily = p1 === p2
        ? [`${p1}+${p2}=${challenge.whole}`, `${challenge.whole}-${p1}=${p2}`]
        : [
          `${p1}+${p2}=${challenge.whole}`,
          `${p2}+${p1}=${challenge.whole}`,
          `${challenge.whole}-${p1}=${p2}`,
          `${challenge.whole}-${p2}=${p1}`,
        ];
      challenge.instruction = `Build all ${p1 === p2 ? 2 : 4} distinct equations for this number bond with ${challenge.whole}.`;
      challenge.allPairs = null;
      challenge.targetEquation = null;
    }

    // Validate build-equation (same shared-gate repair as fact-family).
    if (challenge.type === 'build-equation') {
      const p1 = isValidBondPart(challenge.whole, challenge.part1)
        ? challenge.part1
        : Math.max(1, Math.floor(challenge.whole / 2));
      const p2 = challenge.whole - p1;
      challenge.part1 = p1;
      challenge.part2 = p2;

      // Validate targetEquation — must use the correct numbers and be mathematically valid
      if (challenge.targetEquation) {
        const eq = challenge.targetEquation.replace(/\s+/g, '');
        const w = challenge.whole;
        const validForms = [
          `${p1}+${p2}=${w}`, `${p2}+${p1}=${w}`,
          `${w}-${p1}=${p2}`, `${w}-${p2}=${p1}`,
        ];
        if (!validForms.includes(eq)) {
          challenge.targetEquation = null; // force regeneration below
        }
      }

      // If no valid targetEquation, cycle through fact-family forms
      if (!challenge.targetEquation) {
        const w = challenge.whole;
        const forms = [
          `${p1}+${p2}=${w}`,
          `${w}-${p1}=${p2}`,
          `${w}-${p2}=${p1}`,
          `${p2}+${p1}=${w}`,
        ];
        challenge.targetEquation = forms[buildEqIndex % forms.length];
        buildEqIndex++;
      }

      challenge.allPairs = null;
      challenge.factFamily = null;
    }
  }

  // Ensure at least one challenge (use eval constraint fallback type)
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'decompose';
    const w = data.gradeBand === 'K' ? 4 : 7;
    const pairs: [number, number][] = [];
    for (let a = 0; a <= Math.floor(w / 2); a++) {
      pairs.push([a, w - a]);
    }

    const fallbacks: Record<string, object> = {
      decompose: {
        type: 'decompose',
        instruction: `Can you find all the ways to break apart ${w}?`,
        whole: w,
        part1: null,
        part2: null,
        allPairs: pairs,
        factFamily: null,
        targetEquation: null,
      },
      'ten-and-ones': {
        type: 'ten-and-ones',
        instruction: `The whole is 14. Break it into a ten and some more!`,
        whole: 14,
        part1: null,
        part2: null,
        allPairs: null,
        factFamily: null,
        targetEquation: null,
      },
      'missing-part': {
        type: 'missing-part',
        instruction: `The whole is ${w}. One part is 2. What is the other part?`,
        whole: w,
        part1: 2,
        part2: null,
        allPairs: null,
        factFamily: null,
        targetEquation: null,
      },
      'related-fact': {
        type: 'related-fact',
        instruction: `Join the parts of ${w}, then undo the relationship.`,
        whole: w,
        part1: 1,
        part2: w - 1,
        allPairs: null,
        factFamily: null,
        targetEquation: null,
      },
      'fact-family': {
        type: 'fact-family',
        instruction: `Transform the bond and build each distinct related equation.`,
        whole: w,
        part1: 3,
        part2: w - 3,
        allPairs: null,
        factFamily: [`3+${w - 3}=${w}`, `${w - 3}+3=${w}`, `${w}-3=${w - 3}`, `${w}-${w - 3}=3`],
        targetEquation: null,
      },
      'build-equation': {
        type: 'build-equation',
        instruction: `Choose an action on the bond, then build the matching equation.`,
        whole: w,
        part1: 3,
        part2: w - 3,
        allPairs: null,
        factFamily: null,
        targetEquation: `3+${w - 3}=${w}`,
      },
    };

    console.log(`[NumberBond] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [{ id: 'c1', ...(fallbacks[fallbackType] ?? fallbacks.decompose) }];
  }

  // Apply explicit config overrides
  if (config) {
    // A manifest maxNumber override must not shrink a teen session back under
    // its own window — every item would then be repaired out of the objective.
    if (config.maxNumber !== undefined && !hasTeenType) {
      data.maxNumber = Math.min(config.maxNumber, data.gradeBand === 'K' ? 5 : 10);
    }
  }

  // ── Apply the support-tier structure deterministically (code owns the SUPPORT
  // structure; the LLM only chose the numbers). Withdraws scaffolds as the tier
  // hardens and enforces the missing-part unknown SIDE — never alters magnitude.
  // Gated only on a tier being present and resolved PER CHALLENGE from its own
  // type, so blended/auto sessions get difficulty too. Runs at the very end so
  // structural fixups can't re-enable a withdrawn scaffold. ──
  if (supportTier) {
    // showFactFamilyHelper defaults to current (always-shown) behavior — only
    // set it when a tier is present, so the no-tier path stays byte-identical.
    // A primitive-level (not per-challenge) flag: derive it from the strictest
    // tier requirement across the challenge mix (hide only if NO challenge wants
    // it). In practice eval-mode sessions are single-mode so this is exact.
    let anyWantsHelper = false;

    for (const ch of data.challenges as Array<{
      type: NumberBondChallengeType;
      whole: number;
      part1?: number | null;
    }>) {
      const sc = resolveSupportStructure(ch.type, supportTier);
      if (sc.showFactFamilyHelper) anyWantsHelper = true;

      // Missing-part structural lever: choose WHICH value is the known part so
      // the UNKNOWN is the larger/smaller side. part1 = the KNOWN part; the
      // component computes the answer as whole - part1. We never touch `whole`
      // or `maxNumber` — only which of the two complementary parts is revealed.
      if (ch.type === 'missing-part' && sc.unknownSide) {
        // Current known part (validated upstream to be 1.. whole-1).
        const known = ch.part1 ?? Math.max(1, Math.floor(ch.whole / 2));
        const other = ch.whole - known;
        const smaller = Math.min(known, other);
        const larger = Math.max(known, other);
        // unknown = 'larger' → known is the smaller; unknown = 'smaller' → known
        // is the larger. Keep the known part a non-trivial 1.. whole-1 value;
        // if the bond is symmetric (smaller === larger) either choice is fine.
        const newKnown = sc.unknownSide === 'larger' ? smaller : larger;
        // Guard: never let the known part become 0 or the whole (would trivialize
        // or break the "find the OTHER part" contract). Stepper bounds 0..maxNumber
        // are NOT narrowed — only which part is shown changes.
        if (newKnown >= 1 && newKnown < ch.whole) {
          ch.part1 = newKnown;
        }
      }
    }

    // FactFamilyHelper visibility (new field; defaults to true when no tier).
    data.showFactFamilyHelper = anyWantsHelper;
    // Persist the tier for the live tutor so its reveal level matches the screen.
    data.supportTier = supportTier;

    // showCounters / showEquation are primitive-level booleans in this primitive.
    // For a single pinned mode, apply that mode's scaffold directly. For a blend,
    // OR across the challenge mix (a scaffold stays ON if ANY challenge needs it),
    // since these are not per-challenge fields — the per-challenge unknown-side
    // and helper-gating above carry the finer-grained withdrawal.
    if (pinnedType) {
      const sc = resolveSupportStructure(pinnedType, supportTier);
      data.showCounters = sc.showCounters;
      data.showEquation = sc.showEquation;
    } else {
      let anyCounters = false;
      let anyEquation = false;
      for (const ch of data.challenges as Array<{ type: NumberBondChallengeType }>) {
        const sc = resolveSupportStructure(ch.type, supportTier);
        if (sc.showCounters) anyCounters = true;
        if (sc.showEquation) anyEquation = true;
      }
      data.showCounters = anyCounters;
      data.showEquation = anyEquation;
    }

    console.log(
      `[NumberBond] Support tier "${supportTier}" applied per-challenge `
      + `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'}) → `
      + `counters=${data.showCounters}, equation=${data.showEquation}, factFamilyHelper=${data.showFactFamilyHelper}`,
    );
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c) => c.type).join(', ');
  console.log(`[NumberBond] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  return data;
};
