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
import { buildScopePromptSection, type PedagogicalScope } from '../scopeContext';
import type { GenerationContext } from '../generation/generationContext';

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

// ===========================================================================
// Within-mode SUPPORT TIER (config.difficulty)
// ===========================================================================
// Two-field contract: config.targetEvalMode says WHICH skill (the task identity —
// trace / copy / write / sequence, matched to the objective by the manifest);
// config.difficulty says how much on-canvas TRACING SUPPORT the student gets while
// doing it. The tier withdraws *tracing scaffolds* — the ghost (dotted) digit path
// the student traces over, the directional stroke-order arrows, and the green
// "start here" dot. It NEVER changes the digit, the counting sequence, the scope,
// or the deterministic RUN, and never changes the eval mode.
//
// easy = ghost digit + stroke arrows + start dot; medium = start dot + faint ghost,
// no arrows; hard = no ghost, no arrows, no dot (write the digit/missing number from
// memory of its shape). See memory: structural-difficulty-not-numeric.
//
// The handwriting evaluation (stroke geometry + Gemini Vision re-scoring) is wholly
// independent of these show* flags — they only gate which guides are PAINTED, never
// what is scored, so a hard tier is genuinely less help, not a different answer.

type ChallengeType = 'trace' | 'copy' | 'write' | 'sequence';

// SupportTier ('easy' | 'medium' | 'hard') is now normalized centrally and arrives
// as `ctx.supportTier` — the per-generator normalizeSupportTier copy is retired.
// See service/generation/generationContext.ts.
type SupportTier = 'easy' | 'medium' | 'hard';

interface SupportScaffold {
  /** The ghost (dotted) digit path painted under the canvas for the student to
   *  trace over. The strongest tracing scaffold — withdrawing it leaves the
   *  student forming the numeral from memory of its shape. */
  showGhostDigit: boolean;
  /** Directional stroke-order arrows along the ghost path (which way each stroke
   *  flows). */
  showStrokeArrows: boolean;
  /** The green "start here" dot at the first point of the stroke. */
  showStartDot: boolean;
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-canvas tracing-support structure for a tier on a pinned mode.
 * Support is withdrawn as the tier hardens; the SAME digit / sequence stays the
 * target. The tier only WITHDRAWS guides a mode already shows — it never adds a
 * guide the mode's task identity excludes (write shows nothing at any tier; copy's
 * visible model digit is the mode, not a withdrawable scaffold).
 *
 *   easy   = ghost digit + stroke arrows + start dot
 *   medium = start dot + faint ghost, no arrows
 *   hard   = no ghost, no arrows, no dot (write from memory of the digit shape)
 */
function resolveSupportStructure(pinnedType: ChallengeType, tier: SupportTier): SupportScaffold {
  // Default (used by trace, and as the ceiling for copy/sequence): the withdrawal ladder.
  const showGhostDigit = tier !== 'hard';
  const showStrokeArrows = tier === 'easy';
  const showStartDot = tier !== 'hard';

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-canvas TRACING SCAFFOLDING only `
    + `(${tier === 'easy'
      ? 'maximum support: the ghost digit path, the stroke-order arrows, and the green "start here" dot all help the student form the numeral'
      : tier === 'medium'
        ? 'moderate support: the stroke-order arrows are withdrawn, but a faint ghost digit and the start dot remain'
        : 'minimum support: no ghost digit, no arrows, no start dot — the student writes the numeral from memory of its shape'}). `
    + `Keep the SAME digit, the SAME counting sequence, and the SAME range at every tier — a harder tier withdraws tracing help, `
    + `it NEVER changes the number, the sequence, the scope, or the deterministic run.`,
  ];

  switch (pinnedType) {
    case 'trace':
      promptLines.push(
        tier === 'easy'
          ? 'Keep the dotted ghost numeral, the directional stroke arrows, and the start dot fully visible; the student traces along the guide.'
          : tier === 'hard'
            ? 'Show no ghost numeral, no arrows, and no start dot; hints should ask the student to recall the digit shape and decide their own stroke path.'
            : 'Withdraw the stroke arrows; keep a faint ghost numeral and the start dot so the student forms the stroke with lighter support.',
      );
      break;
    case 'copy':
      promptLines.push(
        'The visible MODEL digit stays at every tier (it is what defines copy mode). '
        + (tier === 'easy'
          ? 'Additionally paint the on-canvas ghost guide and the start dot so the student can trace as well as copy.'
          : tier === 'hard'
            ? 'Withdraw the on-canvas ghost guide and start dot — the student copies the model unaided onto a blank canvas.'
            : 'Withdraw the stroke arrows; keep a faint on-canvas ghost and the start dot beside the model.'),
      );
      break;
    case 'write':
      promptLines.push(
        'Write mode shows no on-canvas guide at any tier (its task identity is "no support") — '
        + 'there is nothing to withdraw, so the tier changes only the hint wording: '
        + (tier === 'hard'
          ? 'hints should not describe the strokes; encourage recall of the digit shape.'
          : 'hints may gently cue where the numeral begins.'),
      );
      break;
    case 'sequence':
      promptLines.push(
        'The sequence and its hidden position never change with the tier. '
        + (tier === 'easy'
          ? 'Paint the ghost of the missing numeral and the start dot so the student can trace the answer once they work it out.'
          : tier === 'hard'
            ? 'Show no ghost and no start dot — the student works out the missing number and writes it from memory.'
            : 'Withdraw the stroke arrows; keep a faint ghost and the start dot once the student has the missing number.'),
      );
      break;
  }
  return { showGhostDigit, showStrokeArrows, showStartDot, promptLines };
}

// ---------------------------------------------------------------------------
// Shared config / helpers
// ---------------------------------------------------------------------------

interface NumberTracerConfig {
  targetEvalMode?: string;
  challengeCount?: number;
  gradeBand?: 'K' | '1';
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second axis of the two-field contract: targetEvalMode = which skill,
   * difficulty = how much on-canvas tracing scaffolding within it. NEVER changes
   * the digit, the counting sequence, the scope, or the deterministic run.
   */
  difficulty?: string;
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
  scope: PedagogicalScope,
  evalConstraint: ReturnType<typeof resolveEvalModeConstraint>,
  tierSection: string,
): Promise<{ title?: string; description?: string; challenges: NumberTracerChallenge[] }> {
  // Constrain the schema enum + prompt docs to the requested handwriting type(s).
  const activeSchema = constrainChallengeTypeEnum(handwritingSchema, allowedTypes, HANDWRITING_DOCS);
  // Only surface the IRT block when the constraint is a handwriting mode (not 'sequence').
  const handwritingConstraint =
    evalConstraint && allowedTypes.includes(evalConstraint.allowedTypes[0]) ? evalConstraint : null;
  const challengeTypeSection = buildChallengeTypePromptSection(handwritingConstraint, HANDWRITING_DOCS);

  // Pedagogical scope is resolved once at the registry boundary (ctx.scope).
  const scopeSection = buildScopePromptSection(scope);

  const prompt = `
Create a number writing practice activity for teaching "${topic}" to ${gradeLevel} students.
${scopeSection}
CONTEXT:
- This primitive builds handwriting fluency for numerals 0-20.
- Students progress through challenge types that gradually remove scaffolding.
- Each challenge has a single digit to write.

${challengeTypeSection}
${tierSection}
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
  scope: PedagogicalScope,
  tierSection: string,
): Promise<{ title?: string; description?: string; challenges: NumberTracerChallenge[] }> {
  const maxDigit = gradeBand === 'K' ? 9 : 20;
  // Pedagogical scope is resolved once at the registry boundary (ctx.scope).
  const scopeSection = buildScopePromptSection(scope);

  const prompt = `
Pick the number window for a counting-sequence activity teaching "${topic}" to ${gradeLevel} students.
${scopeSection}${tierSection}
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

export async function generateNumberTracer(ctx: GenerationContext): Promise<NumberTracerData> {
  const { topic, scope } = ctx;
  // Historically the registry handler passed the grade-context PROSE as this
  // generator's "gradeLevel"; preserve that so prompts stay byte-identical.
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as NumberTracerConfig;

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'number-tracer',
    ctx.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('NumberTracer', ctx.targetEvalMode, evalConstraint);

  const gradeBand = resolveGradeBand(config, gradeLevel);
  const totalCount = (config?.challengeCount as number | undefined) ?? 5;

  // ── Within-mode support tier — normalized centrally, arrives as ctx.supportTier ──
  const supportTier = ctx.supportTier;
  // pinnedType is ONLY for the prompt tone (a curated blend has no single mode to describe).
  const pinnedType =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as ChallengeType)
      : undefined;
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier) : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number size)\n`
      + `${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

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
      ? generateHandwriting(topic, gradeLevel, gradeBand, handwritingTypes, hwCount, scope, evalConstraint, tierSection)
      : Promise.resolve(null),
    wantsSequence
      ? generateSequence(topic, gradeLevel, gradeBand, seqCount, scope, tierSection)
      : Promise.resolve(null),
  ]);

  // ── Combine — handwriting first (easier), then sequence (harder) ──
  const challenges: NumberTracerChallenge[] = [
    ...(handwriting?.challenges ?? []),
    ...(sequence?.challenges ?? []),
  ];

  // Re-id sequentially so merged challenges stay unique.
  challenges.forEach((c, i) => { c.id = `c${i + 1}`; });

  // ── Apply the support tier PER CHALLENGE (after all structural fixups) ──
  // Gate ONLY on a tier being present, and resolve each challenge's scaffold from
  // its OWN mode (ch.type) so a blended session is also tiered. This withdraws
  // TRACING GUIDES only (the ghost digit, the stroke arrows, the start dot) — it
  // never touches the digit, the sequenceNumbers/missingIndex, or the deterministic
  // run. `showModel`/`showArrows` (the eval-mode task-identity flags) are left
  // intact; the tier guards are NEW fields the component reads independently.
  if (supportTier) {
    for (const ch of challenges) {
      const sc = resolveSupportStructure(ch.type as ChallengeType, supportTier);
      // write mode never paints an on-canvas guide at any tier — keep it guide-free
      // (the tier only changed its hint wording in the prompt).
      if (ch.type === 'write') {
        ch.showGhostDigit = false;
        ch.showStrokeArrows = false;
        ch.showStartDot = false;
      } else {
        ch.showGhostDigit = sc.showGhostDigit;
        ch.showStrokeArrows = sc.showStrokeArrows;
        ch.showStartDot = sc.showStartDot;
      }
      ch.supportTier = supportTier;
    }
    console.log(
      `[NumberTracer] Support tier "${supportTier}" applied per-challenge `
      + `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'}) — tracing guides only, run untouched`,
    );
  }

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
