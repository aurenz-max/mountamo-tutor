/**
 * resolvePrepositionScope.ts — Tier-2 preposition-window resolver for spatial-scene
 * (LA K-2 grammar density lane, 2026-08-05).
 *
 * WHY THIS EXISTS
 * ---------------
 * `spatial-scene` was authored for math K.G.1 positional language, so its generator
 * hardcodes the position-word window in the prompt:
 *
 *     "Position words for K grade: ONLY above, below, beside, next_to"
 *
 * That is correct for its math consumer and WRONG as a global cap. The published
 * Kindergarten Language Arts curriculum routes here too — the manifest curator
 * genuinely selects spatial-scene for LA004-05-B ("Follow single-step instructions
 * using common prepositions… 'Put the pencil in the box'") and LA004-01-F ("Apply
 * prepositions (in, on, under, between)"). Measured 2026-08-05: the curator's own
 * intent said *"Put the ball UNDER the table"* and the generator returned
 * above / below / beside — the hardcoded window silently overrode lesson intent.
 * A cap below what the lesson asked for is a bug, not a safety rail
 * ([[trust-intent-over-hardcoded-caps]]).
 *
 * This is the `resolveDeckRequest` template (14l) applied to a vocabulary axis: ONE
 * tiny schema-constrained flash-lite call, temperature 0, turning topic + objective +
 * intent into the position words the lesson actually asked for. Never a regex over
 * intent prose ([[schema-over-regex-and-prompt]]).
 *
 * CONTRACT
 * - ONE flash-lite call, temperature 0. Fires only when the scope carries
 *   intent/objective text — otherwise there is nothing to resolve and no call is made.
 * - REQUEST-PRESENCE FORK: the resolver reports absence honestly. An empty
 *   `requested` means "the lesson named no position words", and the caller keeps its
 *   existing grade-band window untouched — so the math K.G.1 consumer is unchanged.
 *   It must never invent a preposition.
 * - WIDENS ONLY. The resolved set is UNIONed with the band window; it can never
 *   remove a word the band already allowed.
 * - Returns null on any parse/validation failure, so a resolver outage degrades to
 *   exactly today's behavior → no regression.
 * - `unsupported` is honest saturation, not silent truncation: words the lesson asked
 *   for that a 3×3 static grid cannot express (containment "in", two-reference
 *   "between", viewer-relative "in front of"/"behind", and the path class
 *   "through"/"around"/"across") are reported back so the caller can LOG the gap
 *   rather than pretend it was served. Queued in qa/la-k2-grammar/BACKLOG.md.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../../geminiClient";
import type { PedagogicalScope } from "../../scopeContext";

/**
 * Position words this generator can place on a 3×3 grid AND judge deterministically.
 * A word belongs here only if `SUPPORTED_POSITION_SEMANTICS` below defines an exact
 * row/col rule for it — otherwise the LLM could emit it with no correctness owner.
 */
export const SUPPORTED_POSITIONS = [
  "above", "below", "beside", "next_to", "left_of", "right_of", "on", "under",
] as const;

export type SupportedPosition = (typeof SUPPORTED_POSITIONS)[number];

/** Upper sanity bound (house rule: bound ALL schema arrays). */
const MAX_UNSUPPORTED = 8;

/**
 * Exact grid semantics per supported word. These strings are injected into the
 * generator prompt so the LLM places objects the checker will actually accept.
 *
 * The `on`/`under` pair is deliberately CONTACT-scoped (adjacent, same column) while
 * `above`/`below` allow any vertical distance — that distinction is the pedagogical
 * content of the LA preposition skill, not decoration.
 */
export const SUPPORTED_POSITION_SEMANTICS: Record<SupportedPosition, string> = {
  above: '"above" = target row < reference row, SAME column (any vertical distance)',
  below: '"below" = target row > reference row, SAME column (any vertical distance)',
  left_of: '"left_of" = target col < reference col, SAME row',
  right_of: '"right_of" = target col > reference col, SAME row',
  beside: '"beside" = SAME row, adjacent column (col difference exactly 1)',
  next_to: '"next_to" = SAME row, adjacent column (col difference exactly 1)',
  on: '"on" = resting ON TOP of and TOUCHING the reference: target row = reference row - 1, SAME column (rows must be adjacent). Use "on" only when the objects touch; if there is a gap, the word is "above".',
  under: '"under" = directly BENEATH and TOUCHING the reference: target row = reference row + 1, SAME column (rows must be adjacent). Use "under" only when the objects touch; if there is a gap, the word is "below".',
};

export interface PrepositionScope {
  /** Supported position words the lesson explicitly asked for. Empty = no request. */
  requested: SupportedPosition[];
  /** Position words the lesson asked for that this grid cannot express (logged, not served). */
  unsupported: string[];
}

const prepositionScopeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    requested: {
      type: Type.ARRAY,
      maxItems: String(SUPPORTED_POSITIONS.length),
      description:
        "The position words from the supported list that the text explicitly asks the student to practise. "
        + "Empty array if the text names no particular position words.",
      items: {
        type: Type.STRING,
        format: "enum",
        enum: [...SUPPORTED_POSITIONS],
        description: "One supported position word.",
      },
    },
    unsupported: {
      type: Type.ARRAY,
      maxItems: String(MAX_UNSUPPORTED),
      description:
        "Position/preposition words the text asks for that are NOT in the supported list "
        + "(for example: in, between, in front of, behind, through, around, across). "
        + "Empty array if there are none.",
      items: { type: Type.STRING, description: "One requested word not in the supported list." },
    },
  },
  required: ["requested", "unsupported"],
};

/**
 * Resolve which position words a spatial-scene lesson actually asked for.
 *
 * @param scope      The pedagogical scope (topic + objective + intent).
 * @param gradeLevel Grade-appropriate prose, for reading the request in context.
 * @returns The resolved scope, or null when there is nothing to resolve / resolution
 *          failed (→ caller keeps its grade-band window: no regression).
 */
export async function resolvePrepositionScope(
  scope: PedagogicalScope,
  gradeLevel: string,
): Promise<PrepositionScope | null> {
  // Nothing lesson-specific to bind → keep the band default (no call, no cost).
  if (!scope.intent && !scope.objectiveText) return null;

  try {
    const prompt = `A spatial-position activity is being generated for a lesson. Read what the lesson asked for.

TOPIC: "${scope.topic}"
${scope.objectiveText ? `LEARNING OBJECTIVE: "${scope.objectiveText}"\n` : ''}${scope.intent ? `THIS ACTIVITY'S INTENT: "${scope.intent}"\n` : ''}GRADE: ${gradeLevel}

Report ONLY the position words the text above actually names. Do not infer, do not fill in a sensible default, do not add words that merely relate to the topic.

- requested: which of these supported words the text asks the student to practise — ${SUPPORTED_POSITIONS.join(", ")}. Map natural phrasings onto this list ("on top of" -> on, "underneath"/"beneath" -> under, "next to"/"nextto" -> next_to, "to the left of" -> left_of). If the text names NO particular position words, return an empty array.
- unsupported: any other position or preposition words the text asks for that are not in that supported list (for example: in, inside, between, in front of, behind, through, around, across). Empty array if there are none.`;

    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { temperature: 0, responseMimeType: "application/json", responseSchema: prepositionScopeSchema },
    });
    if (!result.text) return null;
    const parsed = JSON.parse(result.text);

    // Requested: keep only genuinely supported words, dedupe, preserve canonical order.
    const asked = new Set(
      (Array.isArray(parsed?.requested) ? parsed.requested : [])
        .map((p: unknown) => (typeof p === 'string' ? p.trim().toLowerCase() : '')),
    );
    const requested = SUPPORTED_POSITIONS.filter((p) => asked.has(p));

    // Unsupported: trim, drop empties, dedupe case-insensitively, bound the list.
    const seen = new Set<string>();
    const unsupported = (Array.isArray(parsed?.unsupported) ? parsed.unsupported : [])
      .map((w: unknown) => (typeof w === 'string' ? w.trim() : ''))
      .filter((w: string) => {
        if (!w) return false;
        const key = w.toLowerCase();
        if (seen.has(key) || (SUPPORTED_POSITIONS as readonly string[]).includes(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_UNSUPPORTED);

    return { requested, unsupported };
  } catch (e) {
    console.warn('[resolvePrepositionScope] resolution failed:', e);
    return null;
  }
}

/**
 * Grade-band default window — the behavior that shipped for the math K.G.1 consumer.
 * Contract R1: with no lesson request, K stays exactly {above, below, beside, next_to}.
 */
export function bandDefaultPositions(gradeBand: "K" | "1"): SupportedPosition[] {
  return gradeBand === "K"
    ? ["above", "below", "beside", "next_to"]
    : ["above", "below", "beside", "next_to", "left_of", "right_of"];
}

/**
 * Compose the window the generator may use: the band default WIDENED by whatever the
 * lesson explicitly asked for. Never narrows — a resolved request can only add.
 */
export function composePositionWindow(
  gradeBand: "K" | "1",
  resolved: PrepositionScope | null,
): SupportedPosition[] {
  const base = bandDefaultPositions(gradeBand);
  if (!resolved || resolved.requested.length === 0) return base;
  const union = new Set<SupportedPosition>([...base, ...resolved.requested]);
  return SUPPORTED_POSITIONS.filter((p) => union.has(p));
}
