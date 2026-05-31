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

// ---------------------------------------------------------------------------
// Gemini JSON schema
// ---------------------------------------------------------------------------

const baseSchema: Schema = {
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
          type: { type: Type.STRING, enum: ['trace', 'copy', 'write', 'sequence'] },
          digit: { type: Type.NUMBER },
          showModel: { type: Type.BOOLEAN },
          showArrows: { type: Type.BOOLEAN },
          hint: { type: Type.STRING },
          sequenceNumbers: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          missingIndex: { type: Type.NUMBER },
        },
        // NOTE: `strokePaths` and `instruction` are intentionally NOT in the schema.
        //   - strokePaths: canonical stroke order lives in the component (getDigitPaths);
        //     a required deeply-nested coord array overflowed Flash Lite's output cap (NT-1, SP-6).
        //   - instruction: synthesized deterministically via buildInstruction() to prevent the
        //     sequence-mode answer leak — the LLM must never own answer-adjacent prose (SP-17).
        required: ['id', 'type', 'digit', 'showModel', 'showArrows'],
      },
    },
  },
  required: ['title', 'description', 'gradeBand', 'challenges'],
};

// ---------------------------------------------------------------------------
// Deterministic instruction synthesis (SP-17)
// ---------------------------------------------------------------------------
// The visible instruction is the most prominent text on screen. For trace/copy/
// write the target digit is shown anyway, so naming it is fine. For sequence the
// digit IS the hidden answer (UI renders "?" at missingIndex) — letting the LLM
// write this prose risks leaking it (violates CLAUDE.md's no-answer-reveal rule).
// Synthesize it from the same data that drives the visuals so it can never desync
// or leak by construction.

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
// Generator
// ---------------------------------------------------------------------------

export async function generateNumberTracer(
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string; challengeCount?: number }>,
): Promise<NumberTracerData> {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'number-tracer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(baseSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : baseSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);
  const challengeCount = config?.challengeCount ?? 5;

  const prompt = `
Create a number writing practice activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- This primitive builds handwriting fluency for numerals 0-20.
- Students progress through challenge types that gradually remove scaffolding.
- Each challenge has a single digit to write or identify.

${challengeTypeSection}

DIGIT RANGES:
- Kindergarten (gradeBand "K"): choose digits 0-9
- Grade 1 (gradeBand "1"): choose digits 0-20

CHALLENGE RULES:
- For "trace": showArrows = true, showModel = false. Student follows a dotted path.
- For "copy": showArrows = false, showModel = true. Student copies a visible model digit.
- For "write": showArrows = false, showModel = false. Student writes from prompt alone.
- For "sequence": Provide sequenceNumbers (4-5 numbers in order, e.g. [3, 4, 5, 6]).
    Set missingIndex to indicate which position is blank (0-based index).
    Set digit to the number at missingIndex (the correct answer).
    showArrows = false, showModel = false.

HINTS:
- Provide a hint field that helps without giving away the answer.
  Examples: "Start at the top!", "Count on your fingers!", "Count up by ones from the start."
- For "sequence" challenges, the hint must NOT name or reveal the missing number.
  Nudge the strategy instead (e.g., "Count up by ones", "Each number is one more than the last").

REQUIREMENTS:
1. Generate ${challengeCount} challenges (vary the types present)
2. Each challenge must have a unique id: c1, c2, c3, ...
3. Use a variety of digits — don't repeat the same digit across challenges
4. Progress from easier (trace) to harder (write/sequence) where possible
5. gradeBand must be "K" or "1"

Return the complete number tracer configuration.
`;

  logEvalModeResolution('NumberTracer', config?.targetEvalMode, evalConstraint);

  // History: this generator used to set maxOutputTokens: 4096, added on the theory
  // that Flash-Lite was falling into a repetition loop and ballooning the response.
  // That diagnosis was wrong — the logs showed the response dying at a *consistent*
  // ~4700-char ceiling every time with clean mid-JSON truncation, which is the
  // signature of hitting the token cap itself (thinking + visible output share the
  // budget), not a runaway. The cap was the bug. We now omit maxOutputTokens to
  // match every other primitive generator and inherit the model's full output
  // budget; the payload is a handful of small challenge objects, so there's room
  // to spare. The bounded retry + fallback stay as a cheap backstop: the loop is
  // stochastic, and on total failure we degrade to the fallback below rather than
  // throwing — generators run under Promise.all in the build pipeline, where one
  // unhandled SyntaxError fails the whole exhibit.
  let data: any = null;
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
      },
    });

    if (!result.text) {
      console.warn(`[NumberTracer] Empty response on attempt ${attempt}/${MAX_ATTEMPTS}.`);
      continue;
    }
    try {
      data = JSON.parse(result.text);
      break;
    } catch (err) {
      console.warn(
        `[NumberTracer] JSON parse failed on attempt ${attempt}/${MAX_ATTEMPTS} `
        + `(${result.text.length} chars; finishReason=${result.candidates?.[0]?.finishReason ?? 'unknown'}). `
        + `${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // All attempts failed — degrade to an empty-challenges skeleton so the existing
  // fallback path below yields a valid single-challenge activity instead of crashing.
  if (!data || typeof data !== 'object') {
    console.warn('[NumberTracer] All generation attempts failed — using fallback challenge.');
    data = { challenges: [] };
  }

  // ── Validation & Defaults ──

  // gradeBand default
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  // Validate challenges array
  const validTypes = ['trace', 'copy', 'write', 'sequence'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validTypes.includes(c.type)
  );

  // Per-challenge defaults and normalization
  for (const challenge of data.challenges as NumberTracerChallenge[]) {
    // Ensure strokePaths is always an empty array (hardcoded in component)
    challenge.strokePaths = [];

    // Enforce showArrows / showModel per type
    if (challenge.type === 'trace') {
      challenge.showArrows = true;
      challenge.showModel = false;
    } else if (challenge.type === 'copy') {
      challenge.showArrows = false;
      challenge.showModel = true;
    } else {
      // write and sequence
      challenge.showArrows = false;
      challenge.showModel = false;
    }

    // Clamp digit to valid range
    const maxDigit = data.gradeBand === 'K' ? 9 : 20;
    if (typeof challenge.digit !== 'number' || challenge.digit < 0) {
      challenge.digit = 0;
    }
    if (challenge.digit > maxDigit) {
      challenge.digit = maxDigit;
    }

    // Validate sequence fields
    if (challenge.type === 'sequence') {
      if (!Array.isArray(challenge.sequenceNumbers) || challenge.sequenceNumbers.length < 3) {
        // Fallback: build a simple 4-number sequence around the digit
        const start = Math.max(0, challenge.digit - 1);
        challenge.sequenceNumbers = [start, start + 1, start + 2, start + 3];
        challenge.missingIndex = 1;
        challenge.digit = challenge.sequenceNumbers[1];
      }
      if (
        typeof challenge.missingIndex !== 'number' ||
        challenge.missingIndex < 0 ||
        challenge.missingIndex >= challenge.sequenceNumbers.length
      ) {
        challenge.missingIndex = 1;
        challenge.digit = challenge.sequenceNumbers[1];
      }
    }

    // Synthesize the visible instruction deterministically (SP-17) — after digit
    // is finalized (sequence sets digit from sequenceNumbers above) so it's correct.
    challenge.instruction = buildInstruction(challenge);
  }

  // Fallback if no valid challenges
  if (data.challenges.length === 0) {
    console.log('[NumberTracer] No valid challenges — using fallback');
    data.challenges = [
      {
        id: 'c1',
        type: 'trace' as const,
        digit: 5,
        instruction: 'Trace the number 5!',
        strokePaths: [],
        showModel: false,
        showArrows: true,
        hint: 'Start at the top!',
      },
    ];
  }

  // Log summary
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map(c => c.type).join(', ');
  console.log(`[NumberTracer] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  return data as NumberTracerData;
}
