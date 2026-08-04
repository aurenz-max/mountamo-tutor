import { Type, Schema } from "@google/genai";
import type {
  NumberSequencerChallenge,
  NumberSequencerData,
} from "../../primitives/visual-primitives/math/NumberSequencer";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModes,
  constrainChallengeTypeEnum,
  buildModeConstraintSection,
  type ChallengeTypeDoc,
} from "../evalMode";
import { resolvePedagogicalScope, buildScopePromptSection } from "../scopeContext";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'count-from': {
    promptDoc:
      `"count-from": Student continues counting from a starting number. `
      + `Provide startNumber, direction ("forward" or "backward"), and expected continuation in correctAnswers. `
      + `sequence=[] or [startNumber]. For K: forward only, 3-5 numbers. For Grade 1: forward or backward. `
      + `Concrete — full guidance, sequential counting.`,
    schemaDescription: "'count-from' (continue counting from value)",
  },
  'before-after': {
    promptDoc:
      `"before-after": A short 2-element sequence with one null. `
      + `Before: sequence=[null, 8], correctAnswers=[7]. After: sequence=[5, null], correctAnswers=[6]. `
      + `Keep instructions clear: "What number comes before/after X?" `
      + `Pictorial with prompts — adjacent number reasoning.`,
    schemaDescription: "'before-after' (identify adjacent numbers)",
  },
  'order-cards': {
    promptDoc:
      `"order-cards": Numbers presented in shuffled order (NO nulls in sequence). `
      + `sequence=[7, 3, 5, 1], correctAnswers=[1, 3, 5, 7] (sorted ascending). `
      + `For K: 3-4 cards. For Grade 1: 4-6 cards. `
      + `Pictorial with reduced prompts — sequence a set of numbers.`,
    schemaDescription: "'order-cards' (sequence a set of numbers)",
  },
  'fill-missing': {
    promptDoc:
      `"fill-missing": A number sequence with 1-3 null values representing blanks. `
      + `Example: sequence=[3, 4, null, 6, 7], correctAnswers=[5]. `
      + `correctAnswers contains ONLY the values that replace the nulls, in order. `
      + `For K: 1 blank. For Grade 1: 1-3 blanks. `
      + `Transitional — complete pattern gaps.`,
    schemaDescription: "'fill-missing' (complete pattern gaps)",
  },
  'decade-fill': {
    promptDoc:
      `"decade-fill": Sequence of decade numbers with some nulls. `
      + `Example: sequence=[10, null, 30, null, 50], correctAnswers=[20, 40]. `
      + `correctAnswers contains ONLY the values that replace the nulls, in order. `
      + `Grade 1 only (not Kindergarten). `
      + `Symbolic — cross decade boundaries.`,
    schemaDescription: "'decade-fill' (cross decade boundaries)",
  },
};

type ChallengeType =
  | 'count-from'
  | 'before-after'
  | 'order-cards'
  | 'fill-missing'
  | 'decade-fill';

// ---------------------------------------------------------------------------
// Within-mode difficulty = structural SUPPORT tier (config.difficulty)
// ---------------------------------------------------------------------------
// The two-field contract (same as counting-board / ten-frame): config.targetEvalMode
// says WHICH skill (task identity, matched to the objective by the manifest);
// config.difficulty says how much on-workspace SUPPORT the student gets while doing
// it ('easy' = max scaffolding, 'hard' = min). The tier is per-component. It NEVER
// changes the numbers or the range: rangeMin/rangeMax and the pedagogical scope own
// magnitude. A harder tier withdraws the CPA dot model + number-line reference and
// adds STRUCTURAL load (more blanks / more cards / a cross-hundred decade boundary),
// never a bigger number. See memory: structural-difficulty-not-numeric.

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
  /** CPA dot model under each number — the concrete representation lever (#3). */
  showDotArrays: boolean;
  /** Number-line tick reference — the perception/tracking lever (#1). */
  showNumberLine: boolean;
  /** Target structural load: how many blanks/slots/cards/missing-decades.
   *  Code enforces this via correctAnswers.length / sequence.length, NEVER by
   *  changing the magnitude of any number. null = leave the LLM's choice. */
  structuralCount: number | null;
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-workspace support structure for a tier on a pinned challenge type.
 * Support is withdrawn as the tier hardens (CPA dots → number line → bare), and the
 * structural load grows (more blanks/cards) — the SAME task, never a bigger number,
 * never a different mode.
 */
function resolveSupportStructure(pinnedType: ChallengeType, tier: SupportTier): SupportScaffold {
  // Default CPA/perception levers: easy = both on, medium = number line only,
  // hard = both off. (decade-fill keeps a thinner number-line ladder — see below.)
  let showDotArrays = tier === 'easy';
  let showNumberLine = tier !== 'hard';
  let structuralCount: number | null = null;

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-workspace SCAFFOLDING + STRUCTURAL load only (${tier === 'easy' ? 'maximum support: the dot model and number line help the student see and track the sequence' : tier === 'medium' ? 'moderate support: only the number line remains; the student tracks the values themselves' : 'minimum support: no dot model, no number line; the student reasons from the numbers alone'}). Keep every number within the pedagogical scope and the per-mode range; a harder tier NEVER means bigger numbers — only less on-screen help and more structural load (more blanks/cards, a harder boundary).`,
  ];

  switch (pinnedType) {
    case 'count-from':
      structuralCount = tier === 'easy' ? 3 : tier === 'medium' ? 4 : 5;
      promptLines.push(
        tier === 'easy'
          ? `Give EXACTLY ${structuralCount} continuation values in correctAnswers. The instruction should NAME the strategy and model the first step (e.g. "Start at 3, then say 4, 5, 6…"). Forward counting only.`
          : tier === 'medium'
            ? `Give EXACTLY ${structuralCount} continuation values in correctAnswers. The instruction states the task only ("Keep counting forward from N") without modelling the steps.`
            : `Give EXACTLY ${structuralCount} continuation values in correctAnswers. Bare instruction ("Continue the count"); for Grade 1 you may count backward to add structural load. Never enlarge the numbers beyond scope.`,
      );
      break;
    case 'before-after':
      // Structural axis is thin here (always a 2-cell sequence, 1 blank), so lean
      // on CPA + instruction. structuralCount stays 1 (the single adjacent blank).
      structuralCount = 1;
      promptLines.push(
        tier === 'easy'
          ? `Keep the single blank. The instruction should cue the DIRECTION explicitly ("What number comes right BEFORE 8? Count back one.").`
          : tier === 'medium'
            ? `Keep the single blank. Neutral instruction ("What number is missing?") — no direction-counting cue.`
            : `Keep the single blank. Bare prompt only; the student infers the adjacency relationship unaided.`,
      );
      break;
    case 'order-cards':
      structuralCount = tier === 'easy' ? 3 : tier === 'medium' ? 4 : 6;
      promptLines.push(
        `Provide EXACTLY ${structuralCount} cards (sequence has ${structuralCount} numbers, correctAnswers is the same ${structuralCount} sorted ascending). `
        + (tier === 'easy'
          ? 'Smaller, easy-to-order set.'
          : tier === 'hard'
            ? 'A larger set to order; no dot model or number line to lean on.'
            : 'A moderate set.'),
      );
      break;
    case 'fill-missing':
      structuralCount = tier === 'easy' ? 1 : tier === 'medium' ? 2 : 3;
      promptLines.push(
        tier === 'easy'
          ? `Use EXACTLY 1 blank (one null; correctAnswers has 1 value).`
          : tier === 'medium'
            ? `Use EXACTLY 2 blanks (two nulls; correctAnswers has 2 values). Keep the two blanks NON-ADJACENT so each is solved from its own neighbours.`
            : `Use EXACTLY 3 blanks (three nulls; correctAnswers has 3 values). Spread the blanks out (non-adjacent) so the student reconstructs more of the pattern unaided.`,
      );
      break;
    case 'decade-fill':
      // decade-fill is symbolic; keep a thinner CPA ladder (no dots — too many),
      // number line only as the easy/medium aid, withdrawn at hard.
      showDotArrays = false;
      showNumberLine = tier !== 'hard';
      structuralCount = tier === 'easy' ? 1 : tier === 'medium' ? 2 : 3;
      promptLines.push(
        tier === 'easy'
          ? `Use EXACTLY 1 missing decade (one null; correctAnswers has 1 value). Keep the chart visible so the surrounding decades support the answer.`
          : tier === 'medium'
            ? `Use EXACTLY 2 missing decades (two nulls; correctAnswers has 2 values), NON-ADJACENT so the visible decades around each still support it.`
            : `Use EXACTLY 3 missing decades (three nulls; correctAnswers has 3 values), non-adjacent, and spread across the visible range (≤ 100 — never beyond the grade ceiling). Keep at least one non-adjacent visible decade between gaps so visible decades never trivially reveal the missing ones.`,
      );
      break;
  }

  return { showDotArrays, showNumberLine, structuralCount, promptLines };
}

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

const numberSequencerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the sequencing activity (e.g., 'What Comes Next?', 'Fill in the Missing Numbers!')"
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
            description: "Unique challenge ID (e.g., 'seq1', 'seq2')"
          },
          type: {
            type: Type.STRING,
            description: "Challenge type: 'fill-missing' (complete pattern gaps), 'before-after' (identify adjacent numbers), 'order-cards' (sequence a set of numbers), 'count-from' (continue counting from value), 'decade-fill' (cross decade boundaries)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging (e.g., 'Can you fill in the missing number?')"
          },
          sequence: {
            type: Type.ARRAY,
            items: {
              type: Type.NUMBER,
              nullable: true,
              description: "A number in the sequence, or null for a blank the student must fill"
            },
            description: "The number sequence with nulls representing blanks. For order-cards: all numbers present but shuffled."
          },
          correctAnswers: {
            type: Type.ARRAY,
            items: {
              type: Type.NUMBER
            },
            description: "The correct answers. For fill-missing/before-after/decade-fill: the numbers that go in the blanks. For order-cards: the correctly sorted sequence. For count-from: the expected continuation numbers."
          },
          startNumber: {
            type: Type.NUMBER,
            description: "For count-from challenges: the number to start counting from"
          },
          direction: {
            type: Type.STRING,
            description: "For count-from challenges: 'forward' or 'backward'"
          },
          rangeMin: {
            type: Type.NUMBER,
            description: "Minimum number in the range for this challenge"
          },
          rangeMax: {
            type: Type.NUMBER,
            description: "Maximum number in the range for this challenge"
          }
        },
        required: ["id", "type", "instruction", "sequence", "correctAnswers", "rangeMin", "rangeMax"]
      },
      description: "Array of 4-6 progressive challenges"
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' for Kindergarten, '1' for Grade 1"
    },
    showNumberLine: {
      type: Type.BOOLEAN,
      description: "Whether to show a number line visual aid alongside the sequence"
    },
    showDotArrays: {
      type: Type.BOOLEAN,
      description: "Whether to show dot array representations for each number"
    }
  },
  required: ["title", "description", "challenges", "gradeBand", "showNumberLine", "showDotArrays"]
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type NumberSequencerConfig = {
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second axis of the two-field contract: targetEvalMode = which skill,
   * difficulty = how much on-screen scaffolding + structural load within it.
   * NEVER changes the numbers or the range.
   */
  difficulty?: string;
  challengeCount?: number;
  gradeBand?: 'K' | '1';
  /** Optional explicit numeric scope; skips topic/intent range resolution. */
  numberRange?: { min: number; max: number };
  /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
  targetEvalMode?: string;
  /** Intent or title from the manifest item. */
  intent?: string;
  /** Learning objective this component serves (injected by flattenManifestToLayout). */
  objectiveText?: string;
  /** Bloom's verb for the objective. */
  objectiveVerb?: string;
};

// ---------------------------------------------------------------------------
// Topic/intent numeric scope resolver (Tier 2 topic-fidelity fix)
// ---------------------------------------------------------------------------

const numberSequencerRangeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    hasExplicitRange: {
      type: Type.BOOLEAN,
      description: 'True only when topic/objective/intent explicitly names or clearly implies the numeric values this activity should use',
    },
    min: {
      type: Type.NUMBER,
      description: 'Smallest student-facing value requested by the lesson scope',
    },
    max: {
      type: Type.NUMBER,
      description: 'Largest student-facing value requested by the lesson scope; never above 120',
    },
  },
  required: ['hasExplicitRange', 'min', 'max'],
};

async function resolveNumberSequencerRange(
  topic: string,
  objectiveText: string | undefined,
  intent: string | undefined,
): Promise<{ min: number; max: number } | null> {
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `Resolve the numeric scope for one Grade-1 NUMBER SEQUENCER activity.

TOPIC: "${topic}"
${objectiveText ? `LEARNING OBJECTIVE: "${objectiveText}"\n` : ''}${intent ? `COMPONENT INTENT: "${intent}"\n` : ''}
Return hasExplicitRange=true ONLY when the lesson content itself names or clearly implies a numeric bound/window (examples: "within 20" -> 1..20; "count to 120" -> 1..120; "use 101 through 120" -> 101..120).
- Do NOT treat the words "Grade 1", challenge counts, dates, IDs, or generic "number practice" as numeric scope.
- Number-sequencer values are positive whole numbers. Clamp min to at least 1 and max to at most 120.
- If there is no explicit lesson range, return hasExplicitRange=false, min=1, max=100.`,
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: numberSequencerRangeSchema,
      },
    });
    if (!result.text) return null;
    const parsed = JSON.parse(result.text) as {
      hasExplicitRange?: unknown;
      min?: unknown;
      max?: unknown;
    };
    if (parsed.hasExplicitRange !== true) return null;
    const min = Math.max(1, Math.round(Number(parsed.min)));
    const max = Math.min(120, Math.round(Number(parsed.max)));
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
    return { min, max };
  } catch (error) {
    console.warn('[NumberSequencer] topic range resolution failed:', error);
    return null;
  }
}

function buildFallbackChallenge(
  type: ChallengeType,
  range: { min: number; max: number },
  ordinal = 0,
): NumberSequencerChallenge {
  const rangeLo = Math.max(1, Math.round(range.min));
  const hi = Math.max(rangeLo + 1, Math.round(range.max));
  const maxWindowStart = Math.max(rangeLo, hi - 4);
  const lo = Math.min(maxWindowStart, rangeLo + ordinal * 5);
  const values = Array.from(
    { length: Math.min(5, hi - lo + 1) },
    (_, index) => lo + index,
  );
  const last = values[values.length - 1];
  const id = `fallback${ordinal + 1}`;

  switch (type) {
    case 'count-from':
      return { id, type, instruction: `Count forward from ${lo}!`, sequence: [lo], correctAnswers: values.slice(1), rangeMin: lo, rangeMax: last, startNumber: lo, direction: 'forward' };
    case 'before-after':
      return { id, type, instruction: `What number comes after ${lo}?`, sequence: [lo, null], correctAnswers: [lo + 1], rangeMin: lo, rangeMax: lo + 1 };
    case 'order-cards': {
      const sorted = values.slice(0, Math.max(2, Math.min(4, values.length)));
      const rotation = 1 + (ordinal % Math.max(1, sorted.length - 1));
      const shuffled = [...sorted.slice(rotation), ...sorted.slice(0, rotation)];
      return { id, type, instruction: 'Put these numbers in order!', sequence: shuffled, correctAnswers: sorted, rangeMin: sorted[0], rangeMax: sorted[sorted.length - 1] };
    }
    case 'decade-fill':
    case 'fill-missing': {
      const blankIndex = ordinal % values.length;
      const sequence: (number | null)[] = [...values];
      const answer = values[blankIndex];
      sequence[blankIndex] = null;
      return { id, type, instruction: 'Can you find the missing number?', sequence, correctAnswers: [answer], rangeMin: values[0], rangeMax: last };
    }
  }
}

function challengeValues(challenge: Pick<NumberSequencerChallenge, 'sequence' | 'correctAnswers' | 'startNumber'>): number[] {
  return [
    ...challenge.sequence.filter((n): n is number => typeof n === 'number'),
    ...challenge.correctAnswers.filter((n): n is number => typeof n === 'number'),
    ...(typeof challenge.startNumber === 'number' ? [challenge.startNumber] : []),
  ];
}

function challengeFitsRange(
  challenge: Pick<NumberSequencerChallenge, 'sequence' | 'correctAnswers' | 'startNumber'>,
  range: { min: number; max: number },
): boolean {
  const values = challengeValues(challenge);
  return values.length > 0
    && values.every((value) => Number.isInteger(value) && value >= range.min && value <= range.max);
}

export const generateNumberSequencer = async (ctx: GenerationContext): Promise<NumberSequencerData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config: NumberSequencerConfig = { ...(ctx.raw as NumberSequencerConfig), intent: ctx.intent };
  // ── Resolve an explicit single mode / curated blend from the catalog. ──
  // Deliberately omit intent here: an unpinned session keeps the legacy mixed
  // behavior, while pins such as "count_from|before_after" are now understood as
  // a two-mode union instead of falling through as an unknown key (reader-fit 14h).
  const evalResolution = await resolveEvalModes(
    'number-sequencer',
    { targetEvalMode: config?.targetEvalMode },
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalResolution
    ? constrainChallengeTypeEnum(numberSequencerSchema, evalResolution.allowedTypes, CHALLENGE_TYPE_DOCS)
    : numberSequencerSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildModeConstraintSection(evalResolution, CHALLENGE_TYPE_DOCS);

  const canonicalGradeBand = ctx.grade
    ? (ctx.grade.toUpperCase() === 'K' ? 'K' : '1')
    : undefined;
  const gradeBand = config?.gradeBand
    ?? canonicalGradeBand
    ?? (gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1');
  const challengeCount = config?.challengeCount || 5;

  // Structured numeric scope. Grade 1 pays for one tiny resolver call only when
  // the manifest did not already provide a range. Generic/no-bound lessons retain
  // the legacy 1-100 default; an explicit lesson bound may extend through 120.
  const defaultNumberRange = gradeBand === 'K' ? { min: 1, max: 20 } : { min: 1, max: 100 };
  const gradeCapabilityMax = gradeBand === 'K' ? 20 : 120;
  let resolvedNumberRange = defaultNumberRange;
  if (config?.numberRange) {
    const min = Math.max(1, Math.round(config.numberRange.min));
    const max = Math.min(gradeCapabilityMax, Math.round(config.numberRange.max));
    if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
      resolvedNumberRange = { min, max };
    }
  } else if (gradeBand === '1') {
    const inferred = await resolveNumberSequencerRange(topic, ctx.objective.text, config?.intent);
    if (inferred) resolvedNumberRange = inferred;
  }
  console.log(
    `[NumberSequencer] numeric window: ${resolvedNumberRange.min}-${resolvedNumberRange.max} `
    + `(source=${config?.numberRange ? 'config' : resolvedNumberRange === defaultNumberRange ? 'grade-default' : 'topic-intent'})`,
  );

  // ── Within-mode support tier (config.difficulty) ──
  // The student's tier DRIVES the deterministic application below (per challenge).
  // pinnedType (exactly one mode) is used ONLY for the prompt tierSection tone.
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType =
    evalResolution?.allowedTypes.length === 1
      ? (evalResolution.allowedTypes[0] as ChallengeType)
      : undefined;
  const tierScaffold =
    pinnedType && supportTier ? resolveSupportStructure(pinnedType, supportTier) : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding + structural level — NOT number size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  // ── Pedagogical scope — binds output to the lesson objective (topic wins over grade band) ──
  const scope = resolvePedagogicalScope(topic, config, config?.intent);
  const scopeSection = buildScopePromptSection(scope);

  const prompt = `
Create an educational number sequencing activity for teaching "${topic}" to ${gradeLevel} students.
${scopeSection}
RESOLVED NUMERIC WINDOW — AUTHORITATIVE FOR THIS RENDER: ${resolvedNumberRange.min} through ${resolvedNumberRange.max}.
Every value in sequence, correctAnswers, startNumber, rangeMin, and rangeMax MUST stay inside this window.
CONTEXT:
- A number sequencer helps students build sequential number understanding
- Students practice recognizing number order, finding missing numbers, and counting forward/backward
- Key skills: number sequence, before/after, counting on/back, number ordering, decade patterns

${challengeTypeSection}
${tierSection}
${!evalResolution ? `
GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * Numbers range from 1-20
  * Simple sequences with 1 blank to fill
  * Before/after with small numbers (1-10 early, up to 20 later)
  * Order 3-4 cards with small numbers
  * Count forward only (no backward for early K)
  * Warm, playful language ("What number is hiding?")
  * showDotArrays: true (helps with number recognition)
  * showNumberLine: true (visual support)

- Grade 1 (gradeBand "1"):
  * Default broad practice uses numbers from 1-100
  * When the AUTHORITATIVE topic/objective/intent explicitly requires counting within 120, values may extend through 120; never exceed 120
  * Sequences with 2-3 blanks
  * Before/after with larger numbers
  * Order 4-6 cards
  * Count forward AND backward
  * Decade-fill challenges (10, 20, 30...)
  * Can handle skip counting by 2s, 5s, 10s
  * showDotArrays: false for numbers > 20 (too many dots)
  * showNumberLine: true
` : ''}

REQUIREMENTS:
1. Generate ${challengeCount} challenges
2. Progress from easier to harder challenges
3. Each challenge needs a unique id field (e.g., 'seq1', 'seq2', etc.)
4. CRITICAL: For fill-missing, before-after, and decade-fill, correctAnswers must contain ONLY the values that fill in the null positions, in order
5. CRITICAL: For order-cards, sequence must contain ONLY numbers (no nulls), and correctAnswers must be the sorted version
6. CRITICAL: For count-from, set startNumber and direction fields
7. rangeMin and rangeMax should reflect the actual number range used in that challenge
8. Use warm, encouraging instruction text appropriate for young children
9. For gradeBand "K": do NOT include decade-fill challenges, keep numbers 1-20
10. For gradeBand "1": This render's resolved numeric window is ${resolvedNumberRange.min}-${resolvedNumberRange.max}. Default broad practice stays at or below 100; use 101-120 only when the AUTHORITATIVE scope explicitly requires it; never exceed 120. ${evalResolution?.allowedTypes.includes('decade-fill') ? 'Include decade-fill because the active eval-mode set allows it.' : evalResolution ? 'Do NOT introduce decade-fill or any other challenge type outside the active eval-mode set.' : 'In a genuinely mixed session, include at least one decade-fill challenge.'}
11. Set gradeBand to "${gradeBand}"
12. Set showNumberLine based on grade level guidance above
13. Set showDotArrays based on grade level guidance above

Return the complete number sequencer configuration.
`;

  if (evalResolution) {
    console.log(
      `[NumberSequencer] evalMode: "${config?.targetEvalMode}" → schema enum: `
      + `[${evalResolution.allowedTypes.join(', ')}]`,
    );
  } else {
    console.log('[NumberSequencer] No targetEvalMode — full schema, mixed difficulty');
  }

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
    throw new Error('No valid number sequencer data returned from Gemini API');
  }

  // The resolved manifest/curriculum band is authoritative; never trust Gemini to
  // restamp it (especially when the canonical objective grade is available).
  data.gradeBand = gradeBand;

  // Validation: ensure booleans have defaults
  if (typeof data.showNumberLine !== 'boolean') {
    data.showNumberLine = true;
  }
  if (typeof data.showDotArrays !== 'boolean') {
    data.showDotArrays = data.gradeBand === 'K';
  }

  // Validate challenge types (safety net — schema enum handles the eval mode case)
  const validTypes = ['fill-missing', 'before-after', 'order-cards', 'count-from', 'decade-fill'];

  data.challenges = (data.challenges || []).filter((c: { type: string }) =>
    validTypes.includes(c.type)
      && (!evalResolution || evalResolution.allowedTypes.includes(c.type))
  );

  // Per-challenge validation
  for (const challenge of data.challenges) {
    // Ensure sequence is an array
    if (!Array.isArray(challenge.sequence)) {
      challenge.sequence = [];
    }

    // Ensure correctAnswers is an array
    if (!Array.isArray(challenge.correctAnswers)) {
      challenge.correctAnswers = [];
    }

    // Validate range bounds
    const maxForGrade = resolvedNumberRange.max;
    if (!challenge.rangeMin || challenge.rangeMin < 0) {
      challenge.rangeMin = 1;
    }
    if (!challenge.rangeMax || challenge.rangeMax > maxForGrade) {
      challenge.rangeMax = maxForGrade;
    }
    if (challenge.rangeMin > challenge.rangeMax) {
      challenge.rangeMin = 1;
    }

    // Validate Kindergarten constraints
    if (data.gradeBand === 'K') {
      // No decade-fill for K
      if (challenge.type === 'decade-fill') {
        challenge.type = 'fill-missing';
      }
      // Clamp numbers to 1-20
      challenge.sequence = challenge.sequence.map((n: number | null) =>
        n !== null ? Math.min(20, Math.max(1, n)) : null
      );
      challenge.correctAnswers = challenge.correctAnswers.map((n: number) =>
        Math.min(20, Math.max(1, n))
      );
    }

    // Validate count-from has required fields
    if (challenge.type === 'count-from') {
      if (typeof challenge.startNumber !== 'number') {
        challenge.startNumber = 1;
      }
      if (challenge.direction !== 'forward' && challenge.direction !== 'backward') {
        challenge.direction = 'forward';
      }
    }

    // For fill-missing / before-after: ensure null count in sequence matches correctAnswers length
    if (challenge.type === 'fill-missing' || challenge.type === 'before-after') {
      const nullCount = challenge.sequence.filter((v: number | null) => v === null).length;
      const answerCount = challenge.correctAnswers.length;
      if (nullCount !== answerCount && answerCount > 0) {
        // Rebuild sequence: place nulls at positions corresponding to correctAnswers
        const fullSeq = challenge.sequence.filter((v: number | null) => v !== null) as number[];
        const rebuilt: (number | null)[] = [];
        let ansIdx = 0;
        for (const num of fullSeq) {
          // Insert null before this number if it matches the next expected answer
          while (ansIdx < answerCount && challenge.correctAnswers[ansIdx] <= num) {
            rebuilt.push(null);
            ansIdx++;
          }
          rebuilt.push(num);
        }
        // Append remaining nulls
        while (ansIdx < answerCount) {
          rebuilt.push(null);
          ansIdx++;
        }
        challenge.sequence = rebuilt;
      }
    }

    // Validate order-cards has no nulls in sequence
    if (challenge.type === 'order-cards') {
      challenge.sequence = challenge.sequence.filter((n: number | null) => n !== null);
      if (challenge.sequence.length === 0) {
        // Fallback: convert to fill-missing
        challenge.type = 'fill-missing';
        challenge.sequence = [1, 2, null, 4, 5];
        challenge.correctAnswers = [3];
      }
    }
  }

  const beforeScopeFilter = data.challenges.length;
  data.challenges = (data.challenges as NumberSequencerChallenge[])
    .filter((challenge) => challengeFitsRange(challenge, resolvedNumberRange));
  if (data.challenges.length < beforeScopeFilter) {
    console.warn(
      `[NumberSequencer] Rejected ${beforeScopeFilter - data.challenges.length} challenge(s) outside `
      + `resolved range ${resolvedNumberRange.min}-${resolvedNumberRange.max}`,
    );
  }

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = (evalResolution?.allowedTypes[0] ?? 'fill-missing') as ChallengeType;
    console.log(`[NumberSequencer] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [buildFallbackChallenge(fallbackType, resolvedNumberRange)];
  }

  // ── Apply the support-tier structure deterministically (code owns the SUPPORT
  // structure; the LLM only chose the numbers). Withdraws the CPA dot model +
  // number-line reference and tunes structural load (blank/slot/card counts) per
  // challenge as the tier hardens — NEVER alters any number's magnitude or the
  // range. Runs AFTER all structural fixups so a 'hard' tier can withdraw them.
  // Gated ONLY on a tier being present (blends get difficulty too). ──
  if (supportTier) {
    type Ch = {
      type: ChallengeType;
      sequence: (number | null)[];
      correctAnswers: number[];
      direction?: string;
    };

    for (const ch of data.challenges as Ch[]) {
      const sc = resolveSupportStructure(ch.type, supportTier);
      if (sc.structuralCount == null) continue;
      const target = sc.structuralCount;

      // Re-shape structural load WITHOUT changing magnitudes. We only add/remove
      // blanks/cards from the values the LLM already chose, keeping the
      // correctAnswers ↔ null-count / sequence-length contract the check logic needs.
      if (ch.type === 'count-from') {
        // correctAnswers = the continuation values (the # of slots). Grow/shrink the
        // run by extending the arithmetic step the LLM established, never by scaling.
        const ans = ch.correctAnswers.filter((n) => typeof n === 'number');
        if (ans.length >= 2) {
          const step = ans[1] - ans[0];
          const start = ans[0];
          ch.correctAnswers = Array.from({ length: target }, (_, i) => start + step * i);
        } else if (ans.length === 1) {
          const dir = ch.direction === 'backward' ? -1 : 1;
          ch.correctAnswers = Array.from({ length: target }, (_, i) => ans[0] + dir * i);
        }
        // sequence stays [] or [startNumber] for count-from; canCheck reads countInputs
        // sized off correctAnswers.length, so the contract holds.
      } else if (ch.type === 'order-cards') {
        // sequence = the shuffled cards (no nulls); correctAnswers = sorted same set.
        // Resize the set by trimming the largest cards or extending by the established
        // step from the existing sorted values — magnitudes already in scope.
        const sorted = [...ch.correctAnswers].filter((n) => typeof n === 'number').sort((a, b) => a - b);
        if (sorted.length >= 1) {
          let set = sorted;
          if (set.length > target) {
            set = set.slice(0, target);
          } else if (set.length < target) {
            const step = set.length >= 2 ? Math.max(1, set[1] - set[0]) : 1;
            while (set.length < target) set.push(set[set.length - 1] + step);
          }
          ch.correctAnswers = [...set];
          // Re-shuffle the same values for the card pool (deterministic rotation).
          ch.sequence = [...set.slice(1), set[0]];
        }
      } else if (ch.type === 'fill-missing' || ch.type === 'decade-fill') {
        // Re-derive a complete value list (fill the existing nulls with the answers
        // in order), then choose `target` NON-ADJACENT positions to blank back out —
        // every value is one the LLM already produced, so nothing's magnitude changes.
        const answers = ch.correctAnswers.filter((n) => typeof n === 'number');
        // Reconstruct full sequence: walk sequence, substitute answers for nulls.
        let ai = 0;
        const full: number[] = [];
        let ok = true;
        for (const v of ch.sequence) {
          if (v === null) {
            if (ai < answers.length) full.push(answers[ai++]);
            else { ok = false; break; }
          } else if (typeof v === 'number') {
            full.push(v);
          }
        }
        // Only reshape when we have a clean full reconstruction and room to place
        // `target` non-adjacent blanks (need at least 2*target-1 positions).
        if (ok && ai === answers.length && full.length >= Math.max(2, 2 * target - 1)) {
          const want = Math.min(target, Math.floor((full.length + 1) / 2));
          // Pick interior, non-adjacent indices (avoid the first/last anchor when possible).
          const blankIdx: number[] = [];
          let pos = full.length >= 3 ? 1 : 0;
          while (blankIdx.length < want && pos < full.length) {
            blankIdx.push(pos);
            pos += 2; // guarantees non-adjacency
          }
          if (blankIdx.length === want) {
            const newSeq: (number | null)[] = full.map((n, i) => (blankIdx.includes(i) ? null : n));
            ch.sequence = newSeq;
            ch.correctAnswers = blankIdx.map((i) => full[i]);
          }
        }
        // before-after intentionally untouched here (always its single adjacent blank).
      }
    }

    // CPA / perception levers are component-global booleans (one per render), so they
    // can only be resolved for a single pinned mode. For a blend, leave the LLM/grade
    // defaults (the per-challenge structural load above still applies).
    if (tierScaffold) {
      data.showDotArrays = tierScaffold.showDotArrays;
      data.showNumberLine = tierScaffold.showNumberLine;
      // Honor the existing K>20 dot-suppression contract — never re-enable noisy dots.
      const maxNum = Math.max(
        0,
        ...(data.challenges as Array<{ sequence: (number | null)[]; correctAnswers: number[] }>).flatMap((c) =>
          [...c.sequence.filter((n): n is number => typeof n === 'number'), ...c.correctAnswers],
        ),
      );
      if (maxNum > 20) data.showDotArrays = false;
    }

    // Persist the tier so the live tutor matches what's on screen (per-challenge blends included).
    data.supportTier = supportTier;

    console.log(
      `[NumberSequencer] Support tier "${supportTier}" applied per-challenge `
      + `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'}) `
      + `→ dotArrays=${data.showDotArrays}, numberLine=${data.showNumberLine}`,
    );
  }

  // Support reshaping can extend an established arithmetic run. Re-apply the
  // structured ceiling afterward so harder never means larger/out-of-scope.
  const beforeFinalScopeFilter = data.challenges.length;
  data.challenges = (data.challenges as NumberSequencerChallenge[])
    .filter((challenge) => challengeFitsRange(challenge, resolvedNumberRange));
  if (data.challenges.length < beforeFinalScopeFilter) {
    console.warn(
      `[NumberSequencer] Rejected ${beforeFinalScopeFilter - data.challenges.length} post-tier challenge(s) `
      + `outside resolved range ${resolvedNumberRange.min}-${resolvedNumberRange.max}`,
    );
  }
  if (data.challenges.length === 0) {
    const fallbackType = (evalResolution?.allowedTypes[0] ?? 'fill-missing') as ChallengeType;
    data.challenges = [buildFallbackChallenge(fallbackType, resolvedNumberRange)];
  }

  // Filtering must not turn a mastery session into a one-card demo. Add distinct,
  // deterministic, in-range cards until the oracle's three-challenge floor holds.
  const minimumChallengeCount = Math.min(3, challengeCount);
  const fallbackType = (evalResolution?.allowedTypes[0] ?? 'fill-missing') as ChallengeType;
  const signatures = new Set(
    (data.challenges as NumberSequencerChallenge[]).map((challenge) =>
      `${challenge.type}|${challenge.sequence.join(',')}|${challenge.correctAnswers.join(',')}`,
    ),
  );
  for (let ordinal = 0; data.challenges.length < minimumChallengeCount && ordinal < 20; ordinal++) {
    const candidate = buildFallbackChallenge(fallbackType, resolvedNumberRange, ordinal);
    const signature = `${candidate.type}|${candidate.sequence.join(',')}|${candidate.correctAnswers.join(',')}`;
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    data.challenges.push(candidate);
  }

  // Derive the render/input window from the values the child actually sees or
  // produces. This keeps 101-120 work local and reachable instead of masking it
  // behind the old rangeMax=100 clamp. It also synchronizes the optional number
  // line and numeric input bounds with the challenge's answer source (G4).
  for (const challenge of data.challenges as Array<{
    sequence: (number | null)[];
    correctAnswers: number[];
    startNumber?: number;
    rangeMin: number;
    rangeMax: number;
  }>) {
    const values = challengeValues(challenge);
    if (values.length > 0) {
      challenge.rangeMin = Math.min(...values);
      challenge.rangeMax = Math.max(...values);
    }
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[NumberSequencer] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  return data;
};
