/**
 * objectiveNumberWindow.ts — the objective's OWN arithmetic scope, for the
 * generators that pick their numbers in CODE.
 *
 * WHY THIS EXISTS
 * ---------------
 * Arithmetic generators took `maxNumber` from the grade band alone (K 5, G1 10).
 * So a Kindergarten objective that says "make 10" or "add within 10" got content
 * that could not reach 10 — the cap silently rewrote the lesson into a different
 * one. A cap below what the objective asks for is a bug
 * ([[trust-intent-over-hardcoded-caps]]).
 *
 * This is a CONFIG-AXIS FORK, not an edit to the band default: the resolved
 * ceiling feeds the SAME `maxNumber` axis an explicit `config.maxNumber` already
 * drives, so every consumer that reads the band default reads it unchanged when
 * the lesson names no scope of its own (the common case). Read the lesson's
 * words, schema not regex ([[schema-over-regex-and-prompt]]).
 *
 * NOT `resolveScopeRange` (scopeRangeResolver.ts). That resolver hard-clamps to
 * the grade ceiling and can only ever NARROW — correct where the band is the
 * authority, wrong here, where raising K past its default IS the repair. This
 * one keys on `hasExplicitScope`, so a lesson that names no range leaves the
 * band default in place instead of drifting up to the primitive's capacity.
 *
 * CONTRACT
 * - ONE flash-lite call, temperature 0. Callers gate it on `config.maxNumber`
 *   being absent — an explicit manifest scope still wins outright.
 * - `ceiling` is the PRIMITIVE'S real capacity (what its visuals can draw or its
 *   response classes can answer), not the grade's. Never pass a grade band here.
 * - Returns null on failure, on general practice, and on a scope that equals the
 *   band default — all three paths leave the caller byte-identical to before.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "./geminiClient";

/** The smallest ceiling with enough distinct problems under it to fill a session
 *  (mirrors ordinal-line's MIN_LINE_LENGTH: three items, not one repeated). */
export const MIN_NUMBER_WINDOW = 3;

const numberWindowSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    hasExplicitScope: {
      type: Type.BOOLEAN,
      description:
        "True ONLY if the topic/intent names a specific number range or target "
        + "('add within 10', 'making 10', 'sums to 20', 'subtract within 5'). "
        + "False for general addition/subtraction practice with no stated range.",
    },
    maxNumber: {
      type: Type.NUMBER,
      description:
        "The largest number any count in this lesson may reach — the total for "
        + "'making 10' (10), the bound for 'within 5' (5). Whole number.",
    },
  },
  required: ["hasExplicitScope", "maxNumber"],
};

export interface ObjectiveNumberWindowRequest {
  /** Broad lesson topic. */
  topic: string;
  /** Per-component intent the manifest assigned to this instance. */
  intent?: string;
  /** Full objective text, where the caller has it (`ctx.scope.objectiveText`).
   *  Often the only place the range is stated in so many words. */
  objectiveText?: string;
  /** Grade-appropriate prose, for the prompt. */
  gradeLevel: string;
  /** What this generator uses TODAY when nothing is named. A resolved scope
   *  equal to it returns null, so the unchanged path stays unchanged. */
  bandDefault: number;
  /** The PRIMITIVE'S capacity ceiling — see the contract note above. */
  ceiling: number;
  /** Log tag, e.g. 'AdditionSubtractionScene'. */
  logPrefix: string;
}

/** Reads the lesson's OWN topic + intent + objective for the arithmetic ceiling
 *  it is about. Returns null on failure or general practice → band default. */
export async function resolveObjectiveNumberWindow(
  req: ObjectiveNumberWindowRequest,
): Promise<number | null> {
  const { topic, intent, objectiveText, gradeLevel, bandDefault, ceiling, logPrefix } = req;
  // Where the objective text is available it is named in the read-list too, so
  // "solve addition word problems within 10" binds even when the manifest's
  // per-component intent paraphrases the range away.
  const sources = objectiveText ? 'topic/intent/objective' : 'topic/intent';
  try {
    const prompt = `An addition/subtraction lesson needs its number scope inferred from what it is teaching.

TOPIC: "${topic}"
${objectiveText ? `OBJECTIVE: "${objectiveText}"
` : ''}${intent ? `INTENT: "${intent}"
` : ''}GRADE: ${gradeLevel}

Return the largest number any count in THIS lesson may reach.
- Read the ${sources} for an explicit range or target: "add within 5" → 5; "making 10" → 10; "sums to 20" → 20.
- If the lesson is general addition/subtraction practice with NO stated range, set hasExplicitScope=false.
- Numbers run from 0 to ${ceiling}. Report what THIS lesson's words ask for, even when that sits above the usual ${gradeLevel} range — the objective is the authority on its own scope.`;
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: numberWindowSchema,
      },
    });
    if (!result.text) return null;
    const parsed = JSON.parse(result.text);
    if (!parsed?.hasExplicitScope) return null;

    const max = Math.round(Number(parsed?.maxNumber));
    if (!Number.isFinite(max)) return null;
    // MIN_NUMBER_WINDOW floors the scope at a range with real arithmetic in it:
    // a lesson bounded at 2 can only ask 1+1, and three challenges drawn from it
    // are the same challenge three times ([[mastery-over-demo]]).
    const bounded = Math.max(MIN_NUMBER_WINDOW, Math.min(max, ceiling));
    // A scope equal to the band default is not a change — let the default stand,
    // so the no-scope and same-scope paths stay byte-identical to before.
    if (bounded === bandDefault) return null;
    return bounded;
  } catch (e) {
    console.warn(`[${logPrefix}] number window resolution failed:`, e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveObjectiveRange — the same rule as above for any code-picked number
// window, with a floor as well as a ceiling (math-k audit 2026-11-10, class
// finding "K caps below the objective").
//
// Seven K generators fixed a band below what the objective names: tracer 0-9
// for "write 0-20", bonds to 5 for "within 10", compare-numbers to 10 for
// "compare 11-20", sorting 4-6 for "up to 10 per group". `resolveScopeRange`
// cannot repair these: it clamps to the band and so can only narrow. This one
// reads the lesson's own range, bounds it by the PRIMITIVE'S capacity, and
// returns null when the lesson names no range, so the band default stands and
// the no-scope path stays unchanged.
// ─────────────────────────────────────────────────────────────────────────────

const objectiveRangeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    hasExplicitScope: {
      type: Type.BOOLEAN,
      description:
        "True ONLY if the topic/intent/objective names a specific number range or bound "
        + "for this quantity ('write numbers 0-20', 'within 10', 'compare numbers 11 to 20', "
        + "'up to 10 objects', 'count back from 10'). False when no range is stated.",
    },
    min: { type: Type.NUMBER, description: "Smallest value the lesson names. Whole number." },
    max: { type: Type.NUMBER, description: "Largest value the lesson names. Whole number." },
  },
  required: ["hasExplicitScope", "min", "max"],
};

export interface ObjectiveRangeRequest {
  topic: string;
  intent?: string;
  objectiveText?: string;
  gradeLevel: string;
  /** Plain-language name of what the range bounds, e.g. "the numerals the child traces". */
  quantity: string;
  /** The window the generator uses today when nothing is named. */
  bandDefault: { min: number; max: number };
  /** The PRIMITIVE'S capacity (what it can draw or score), not the grade band. */
  capacity: { min: number; max: number };
  logPrefix: string;
}

/** The objective's own {min,max} for a code-picked quantity, bounded by the
 *  primitive's capacity. Null on failure, no stated range, or a range equal to
 *  the band default — all three leave the caller on its default. */
export async function resolveObjectiveRange(
  req: ObjectiveRangeRequest,
): Promise<{ min: number; max: number } | null> {
  const { topic, intent, objectiveText, gradeLevel, quantity, bandDefault, capacity, logPrefix } = req;
  if (!intent && !objectiveText && !topic) return null;
  try {
    const prompt = `A math activity picks ${quantity} in code. Infer the range THIS lesson names.

TOPIC: "${topic}"
${objectiveText ? `OBJECTIVE: "${objectiveText}"\n` : ''}${intent ? `INTENT: "${intent}"\n` : ''}GRADE: ${gradeLevel}

- Read the topic/intent/objective for an explicit range or bound: "write numbers 0 to 20" → 0..20; "within 10" → 0..10; "compare numbers 11-20" → 11..20; "count back from 10" → 0..10; "up to 10 in a group" → 1..10.
- If no range is stated for ${quantity}, set hasExplicitScope=false.
- Values can run from ${capacity.min} to ${capacity.max}. Report what the lesson's words ask for, even above the usual ${gradeLevel} range: the objective is the authority on its own scope.`;
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: { temperature: 0, responseMimeType: 'application/json', responseSchema: objectiveRangeSchema },
    });
    if (!result.text) return null;
    const parsed = JSON.parse(result.text);
    if (!parsed?.hasExplicitScope) return null;
    let min = Math.round(Number(parsed?.min));
    let max = Math.round(Number(parsed?.max));
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    if (min > max) [min, max] = [max, min];
    min = Math.max(capacity.min, Math.min(min, capacity.max));
    max = Math.max(capacity.min, Math.min(max, capacity.max));
    // A window too small for a session of distinct items is no window.
    if (max - min + 1 < MIN_NUMBER_WINDOW) return null;
    if (min === bandDefault.min && max === bandDefault.max) return null;
    console.log(`[${logPrefix}] objective range → ${min}-${max} (band ${bandDefault.min}-${bandDefault.max})`);
    return { min, max };
  } catch (e) {
    console.warn(`[${logPrefix}] objective range resolution failed:`, e);
    return null;
  }
}
