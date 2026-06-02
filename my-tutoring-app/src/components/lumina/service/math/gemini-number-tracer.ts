import { Type, Schema } from "@google/genai";
import { NumberTracerData, NumberTracerChallenge } from '../../primitives/visual-primitives/math/NumberTracer';
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';
import { resolvePedagogicalScope, buildScopePromptSection } from '../scopeContext';

// ===========================================================================
// number-tracer is a HANDWRITING primitive: the interaction surface is a
// draw-the-digit canvas scored by stroke geometry + Gemini vision. Three of
// its four modes (trace/copy/write) are that task with progressively less
// scaffolding — they need only flat scalar fields and are trivially bounded.
//
// The fourth mode (`sequence`) is a *counting* task: "3, 4, __, 6 — write the
// missing number by hand". Its structure (a bounded run of consecutive ints
// with one blank) is PURE ARITHMETIC. Letting Flash-Lite emit that array
// caused a tab-killing OOM (unbounded run), a scope bleed ("counting 1-10" →
// values in the 1000s), and an answer desync (digit ≠ sequenceNumbers[missing]).
//
// So we split the generator (SP-3 orchestrator, per tape-diagram/sorting-station):
//   • generateHandwriting — clean 4-field schema, NO sequence fields.
//   • generateSequence — a MINIMAL LLM call picks only a scope-bound numeric
//     window (rangeMin/rangeMax + title); buildSequenceChallenges() then builds
//     the runs, blanks, answers, and hints deterministically. The LLM picks the
//     window (so "within 10" tightens correctly); CODE builds the structure
//     (so it can't overflow, bleed scope, or desync — all three bugs die by
//     construction, replacing the post-process guards entirely).
// ===========================================================================

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  trace: {
    promptDoc: 'trace: Student follows dotted numeral path with directional arrows showing stroke order.',
    schemaDescription: 'trace — showArrows:true, showModel:false',
  },
  copy: {
    promptDoc: 'copy: Model digit is visible nearby; student writes without dotted guide.',
    schemaDescription: 'copy — showArrows:false, showModel:true',
  },
  write: {
    promptDoc: 'write: Student writes digit from text prompt only — no model, no guide.',
    schemaDescription: 'write — showArrows:false, showModel:false',
  },
  sequence: {
    promptDoc: 'sequence: Student identifies and writes a missing number in a counting sequence (e.g. 3, 4, __, 6).',
    schemaDescription: 'sequence — sequenceNumbers array with missingIndex',
  },
};

// Handwriting modes only — the sub-set the LLM generates challenge data for.
// `sequence` is intentionally excluded: its data is built deterministically.
const HANDWRITING_DOCS: Record<string, ChallengeTypeDoc> = {
  trace: CHALLENGE_TYPE_DOCS.trace,
  copy: CHALLENGE_TYPE_DOCS.copy,
  write: CHALLENGE_TYPE_DOCS.write,
};

const HANDWRITING_TYPES = ['trace', 'copy', 'write'] as const;

// ---------------------------------------------------------------------------
// Shared config / helpers
// ---------------------------------------------------------------------------

interface NumberTracerConfig {
  targetEvalMode?: string;
  challengeCount?: number;
  gradeBand?: 'K' | '1';
  // Pedagogical-scope context injected by flattenManifestToLayout (scopeContext.ts).
  objectiveText?: string;
  objectiveVerb?: string;
  intent?: string;
  // Index signature so this satisfies ScopeBearingConfig (generators pass their
  // full config through to resolvePedagogicalScope).
  [key: string]: unknown;
}

function resolveGradeBand(config: NumberTracerConfig | undefined, gradeLevel: string): 'K' | '1' {
  if (config?.gradeBand === 'K' || config?.gradeBand === '1') return config.gradeBand;
  return gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
}

// The visible instruction is the most prominent text on screen. For trace/copy/
// write the target digit is shown anyway, so naming it is fine. For sequence the
// digit IS the hidden answer (UI renders "?" at missingIndex) — so the instruction
// must never name it. Synthesized deterministically (SP-17) — no LLM field, no leak.
function buildInstruction(challenge: NumberTracerChallenge): string {
  switch (challenge.type) {
    case 'trace':
      return `Trace the number ${challenge.digit}!`;
    case 'copy':
      return `Copy the number ${challenge.digit}!`;
    case 'write':
      return `Write the number ${challenge.digit}!`;
    case 'sequence':
      return `What's the missing number? Fill in the blank!`;
    default:
      return `Write the number ${challenge.digit}!`;
  }
}

// ---------------------------------------------------------------------------
// Handwriting sub-generator (trace / copy / write)
// ---------------------------------------------------------------------------

const handwritingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    gradeBand: { type: Type.STRING, enum: ['K', '1'] },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING, enum: ['trace', 'copy', 'write'] },
          digit: { type: Type.NUMBER },
          showModel: { type: Type.BOOLEAN },
          showArrows: { type: Type.BOOLEAN },
          hint: { type: Type.STRING },
        },
        // `strokePaths` / `instruction` / `sequenceNumbers` / `missingIndex` are
        // intentionally absent — strokePaths is canonical in the component
        // (getDigitPaths, NT-1/SP-6), instruction is synthesized (SP-17), and the
        // sequence fields belong to the deterministic sequence path only.
        required: ['id', 'type', 'digit', 'showModel', 'showArrows'],
      },
    },
  },
  required: ['title', 'description', 'gradeBand', 'challenges'],
};

async function generateHandwriting(
  topic: string,
  gradeLevel: string,
  gradeBand: 'K' | '1',
  allowedTypes: string[],
  challengeCount: number,
  config: NumberTracerConfig | undefined,
  evalConstraint: ReturnType<typeof resolveEvalModeConstraint>,
): Promise<{ title?: string; description?: string; challenges: NumberTracerChallenge[] }> {
  // Constrain the schema enum + prompt docs to the requested handwriting type(s).
  const activeSchema = constrainChallengeTypeEnum(handwritingSchema, allowedTypes, HANDWRITING_DOCS);
  // Only surface the IRT block when the constraint is a handwriting mode (not 'sequence').
  const handwritingConstraint =
    evalConstraint && allowedTypes.includes(evalConstraint.allowedTypes[0]) ? evalConstraint : null;
  const challengeTypeSection = buildChallengeTypePromptSection(handwritingConstraint, HANDWRITING_DOCS);

  const scope = resolvePedagogicalScope(topic, config, config?.intent);
  const scopeSection = buildScopePromptSection(scope);

  const prompt = `
Create a number writing practice activity for teaching "${topic}" to ${gradeLevel} students.
${scopeSection}
CONTEXT:
- This primitive builds handwriting fluency for numerals 0-20.
- Students progress through challenge types that gradually remove scaffolding.
- Each challenge has a single digit to write.

${challengeTypeSection}

DIGIT RANGES (ceiling — the SCOPE above may narrow these):
- Kindergarten (gradeBand "K"): digits 0-9
- Grade 1 (gradeBand "1"): digits 0-20

CHALLENGE RULES:
- For "trace": showArrows = true, showModel = false. Student follows a dotted path.
- For "copy": showArrows = false, showModel = true. Student copies a visible model digit.
- For "write": showArrows = false, showModel = false. Student writes from prompt alone.

HINTS:
- Provide a hint field that helps without giving away the answer (e.g. "Start at the top!").

REQUIREMENTS:
1. Generate ${challengeCount} challenges (vary the types present, within the allowed set)
2. Each challenge must have a unique id: c1, c2, c3, ...
3. Use a variety of digits — don't repeat the same digit across challenges
4. gradeBand must be "${gradeBand}"

Return the complete number tracer configuration.
`;

  // Bounded retry + degrade-to-skeleton. Generators run under Promise.all in the
  // build pipeline; an unhandled SyntaxError would fail the whole exhibit, so on
  // total failure we degrade rather than throw.
  let data: { gradeBand?: string; challenges?: unknown[]; title?: string; description?: string } | null = null;
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: activeSchema },
    });
    if (!result.text) {
      console.warn(`[NumberTracer] Empty handwriting response on attempt ${attempt}/${MAX_ATTEMPTS}.`);
      continue;
    }
    try {
      data = JSON.parse(result.text);
      break;
    } catch (err) {
      console.warn(
        `[NumberTracer] Handwriting JSON parse failed on attempt ${attempt}/${MAX_ATTEMPTS} `
        + `(${result.text.length} chars; finishReason=${result.candidates?.[0]?.finishReason ?? 'unknown'}). `
        + `${err instanceof Error ? err.message : err}`,
      );
    }
  }

  if (!data || typeof data !== 'object') {
    console.warn('[NumberTracer] All handwriting attempts failed — using fallback challenge.');
    data = { challenges: [] };
  }

  // ── Validation & defaults ──
  const maxDigit = gradeBand === 'K' ? 9 : 20;
  const allowedSet = new Set(allowedTypes);
  const challenges = ((data.challenges as NumberTracerChallenge[]) || []).filter(
    (c) => allowedSet.has(c.type),
  );

  for (const challenge of challenges) {
    challenge.strokePaths = [];

    // Enforce showArrows / showModel per type.
    if (challenge.type === 'trace') {
      challenge.showArrows = true;
      challenge.showModel = false;
    } else {
      // copy and write
      challenge.showArrows = false;
      challenge.showModel = challenge.type === 'copy';
    }

    // Clamp digit to grade ceiling.
    if (typeof challenge.digit !== 'number' || challenge.digit < 0) challenge.digit = 0;
    if (challenge.digit > maxDigit) challenge.digit = maxDigit;

    challenge.instruction = buildInstruction(challenge);
  }

  // Fallback if no valid challenges.
  if (challenges.length === 0) {
    const fallbackType = (allowedTypes[0] ?? 'trace') as NumberTracerChallenge['type'];
    console.log('[NumberTracer] No valid handwriting challenges — using fallback');
    const fb: NumberTracerChallenge = {
      id: 'c1',
      type: fallbackType,
      digit: 5,
      instruction: '',
      strokePaths: [],
      showModel: fallbackType === 'copy',
      showArrows: fallbackType === 'trace',
      hint: 'Start at the top!',
    };
    fb.instruction = buildInstruction(fb);
    challenges.push(fb);
  }

  return { title: data.title, description: data.description, challenges };
}

// ---------------------------------------------------------------------------
// Sequence sub-generator: LLM picks the scope window, code builds the rest
// ---------------------------------------------------------------------------

// The LLM's ONLY job here: choose a numeric window appropriate to the lesson
// scope. The schema carries no per-challenge data — nothing for Flash-Lite to
// overflow or desync.
const sequenceWindowSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    rangeMin: { type: Type.NUMBER, description: 'Smallest number that may appear, within the lesson scope.' },
    rangeMax: { type: Type.NUMBER, description: 'Largest number that may appear, within the lesson scope. Never exceed the topic/objective range.' },
  },
  required: ['rangeMin', 'rangeMax'],
};

/**
 * Build `count` missing-number sequence challenges deterministically inside a
 * bounded window. Correct by construction:
 *   • fixed run length (≤5) → never overflows the render row (kills OOM crash)
 *   • values drawn from the clamped window → never bleeds scope
 *   • digit = sequenceNumbers[missingIndex] → never desyncs from the answer
 */
function buildSequenceChallenges(
  rangeMin: number,
  rangeMax: number,
  count: number,
  maxDigit: number,
): NumberTracerChallenge[] {
  const RUN = 4; // numbers shown per sequence
  // Clamp the LLM-suggested window to the grade ceiling (safety net — advisory only).
  let lo = Math.max(0, Math.min(Number.isFinite(rangeMin) ? rangeMin : 0, maxDigit));
  let hi = Math.max(0, Math.min(Number.isFinite(rangeMax) ? rangeMax : maxDigit, maxDigit));
  if (hi < lo) [lo, hi] = [hi, lo];
  // Ensure the window is wide enough for a real run (≥3 numbers).
  if (hi - lo + 1 < 3) {
    hi = Math.min(maxDigit, lo + (RUN - 1));
    lo = Math.max(0, hi - (RUN - 1));
  }

  const challenges: NumberTracerChallenge[] = [];
  for (let i = 0; i < count; i++) {
    const runLen = Math.min(RUN, hi - lo + 1);
    const maxStart = hi - runLen + 1;          // inclusive upper bound for the run start
    const span = Math.max(1, maxStart - lo + 1);
    const start = lo + (i % span);             // walk the window across challenges for variety
    const seq = Array.from({ length: runLen }, (_, k) => start + k);
    // Blank an interior position when possible (more interesting than first/last).
    const missingIndex = runLen >= 3 ? 1 + (i % (runLen - 2)) : i % runLen;
    const challenge: NumberTracerChallenge = {
      id: `c${i + 1}`,
      type: 'sequence',
      digit: seq[missingIndex],
      instruction: '',
      strokePaths: [],
      showModel: false,
      showArrows: false,
      hint: 'Count up by ones — each number is one more than the last.',
      sequenceNumbers: seq,
      missingIndex,
    };
    challenge.instruction = buildInstruction(challenge);
    challenges.push(challenge);
  }
  return challenges;
}

async function generateSequence(
  topic: string,
  gradeLevel: string,
  gradeBand: 'K' | '1',
  challengeCount: number,
  config: NumberTracerConfig | undefined,
): Promise<{ title?: string; description?: string; challenges: NumberTracerChallenge[] }> {
  const maxDigit = gradeBand === 'K' ? 9 : 20;
  const scope = resolvePedagogicalScope(topic, config, config?.intent);
  const scopeSection = buildScopePromptSection(scope);

  const prompt = `
Pick the number window for a counting-sequence activity teaching "${topic}" to ${gradeLevel} students.
${scopeSection}
Students will see short runs of consecutive numbers with one number hidden, and must work out
and write the missing number by hand (e.g. "3, 4, ?, 6").

YOUR ONLY JOB: choose rangeMin and rangeMax — the smallest and largest numbers that may appear.
- They MUST stay within the lesson scope above. If the topic says "within 10", rangeMax must be ≤ 10.
- Grade ceiling: K ≤ 9, Grade 1 ≤ 20. The scope may narrow this further.
- Also write a short, warm title and description. Do NOT mention any specific missing number.

Return only the window.
`;

  // The structure is deterministic, so the LLM call is small and non-critical:
  // on any failure we fall back to the grade ceiling and still build valid data.
  let window: { rangeMin?: number; rangeMax?: number; title?: string; description?: string } | null = null;
  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: sequenceWindowSchema },
    });
    window = result.text ? JSON.parse(result.text) : null;
  } catch (err) {
    console.warn(`[NumberTracer] Sequence window generation failed — using grade ceiling. ${err instanceof Error ? err.message : err}`);
  }

  const rangeMin = typeof window?.rangeMin === 'number' ? window.rangeMin : 0;
  const rangeMax = typeof window?.rangeMax === 'number' ? window.rangeMax : maxDigit;

  const challenges = buildSequenceChallenges(rangeMin, rangeMax, challengeCount, maxDigit);
  console.log(`[NumberTracer] Sequence window [${rangeMin}, ${rangeMax}] → clamped run within ≤${maxDigit}, ${challenges.length} challenge(s).`);

  return { title: window?.title, description: window?.description, challenges };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function generateNumberTracer(
  topic: string,
  gradeLevel: string,
  config?: NumberTracerConfig,
): Promise<NumberTracerData> {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'number-tracer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('NumberTracer', config?.targetEvalMode, evalConstraint);

  const gradeBand = resolveGradeBand(config, gradeLevel);
  const totalCount = config?.challengeCount ?? 5;

  // Which paths does this eval mode need? (No constraint = full mixed activity.)
  const allowed = evalConstraint?.allowedTypes ?? ['trace', 'copy', 'write', 'sequence'];
  const handwritingTypes = allowed.filter((t) => (HANDWRITING_TYPES as readonly string[]).includes(t));
  const wantsHandwriting = handwritingTypes.length > 0;
  const wantsSequence = allowed.includes('sequence');

  // When both paths run (full activity), split the count so we don't double up.
  const seqCount = wantsHandwriting && wantsSequence ? Math.max(1, Math.round(totalCount * 0.3)) : totalCount;
  const hwCount = wantsHandwriting && wantsSequence ? Math.max(1, totalCount - seqCount) : totalCount;

  const [handwriting, sequence] = await Promise.all([
    wantsHandwriting
      ? generateHandwriting(topic, gradeLevel, gradeBand, handwritingTypes, hwCount, config, evalConstraint)
      : Promise.resolve(null),
    wantsSequence
      ? generateSequence(topic, gradeLevel, gradeBand, seqCount, config)
      : Promise.resolve(null),
  ]);

  // ── Combine — handwriting first (easier), then sequence (harder) ──
  const challenges: NumberTracerChallenge[] = [
    ...(handwriting?.challenges ?? []),
    ...(sequence?.challenges ?? []),
  ];

  // Re-id sequentially so merged challenges stay unique.
  challenges.forEach((c, i) => { c.id = `c${i + 1}`; });

  const data: NumberTracerData = {
    title: handwriting?.title ?? sequence?.title ?? 'Number Writing Practice',
    description: handwriting?.description ?? sequence?.description,
    gradeBand,
    challenges,
  };

  const typeBreakdown = challenges.map((c) => c.type).join(', ');
  console.log(`[NumberTracer] Final: ${challenges.length} challenge(s) → [${typeBreakdown}]`);

  return data;
}
