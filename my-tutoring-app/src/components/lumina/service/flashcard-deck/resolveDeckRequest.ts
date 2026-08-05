/**
 * resolveDeckRequest.ts — Tier-2 review-scope resolver for flashcard-deck (reader-fit 14l).
 *
 * WHY THIS EXISTS
 * ---------------
 * A lesson's final assessment routinely asks for a BOUNDED REVIEW: "10 simple review
 * cards about the narrated light-bulb lesson", "recall all four helpers taught in the
 * lesson". That request arrives only in **intent prose** — no manifest producer stamps
 * `config.cardCount` anywhere in the repo (contract R6). So the generator saw no count,
 * defaulted to 15, and the prompt's own rules ("Cover key terms…", "Progress from basic
 * to more advanced concepts") invited it to fill the gap with untaught vocabulary
 * (`patent`, `prototype`, `Internet`) — turning the lesson's REVIEW into an
 * INTRODUCTION, assessed but never taught.
 *
 * This is the `scopeRangeResolver` template (14h) applied to a non-numeric axis: ONE
 * tiny schema-constrained flash-lite call, temperature 0, that turns topic + objective +
 * intent into the `{requestedCount, isReview, taughtConcepts}` the code-owned prompt
 * fork needs. Never a regex over intent prose ([[schema-over-regex-and-prompt]]).
 *
 * CONTRACT
 * - ONE flash-lite call, temperature 0. Only fires when the scope actually carries
 *   intent/objective text — otherwise there is nothing to resolve and no call is made.
 * - CONSTRAINT-PRESENCE FORK (contract C1): the resolver reports absence honestly.
 *   `requestedCount: null` + `isReview: false` means "no request" and the caller keeps
 *   the legacy open-study path untouched. It must never invent a count.
 * - Returns null on any parse/validation failure, so a resolver outage degrades to
 *   exactly today's behavior → no regression.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { PedagogicalScope } from "../scopeContext";

/** Upper sanity bound on an enumerated taught-concept list (house rule: bound ALL arrays). */
const MAX_TAUGHT_CONCEPTS = 12;

/**
 * Validity window for a resolved count. This is NOT a cap on lesson intent
 * ([[trust-intent-over-hardcoded-caps]], contract R8) — a value outside it is treated as
 * a FAILED resolution (→ legacy default), never clamped down to a ceiling.
 */
const MIN_VALID_COUNT = 1;
const MAX_VALID_COUNT = 40;

export interface DeckRequest {
  /** Exact number of cards the lesson explicitly asked for; null when none was requested. */
  requestedCount: number | null;
  /** True when the scope frames this deck as a review of material the lesson already taught. */
  isReview: boolean;
  /** The concepts the lesson actually taught — the ONLY material a review deck may cover. */
  taughtConcepts: string[];
}

const deckRequestSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    requestedCount: {
      type: Type.NUMBER,
      nullable: true,
      description:
        "The exact number of cards the text explicitly asks for (e.g. 'ten review cards' -> 10). "
        + "null if no specific number is requested anywhere in the text.",
    },
    isReview: {
      type: Type.BOOLEAN,
      description:
        "true if the text frames this deck as reviewing/recalling material the lesson ALREADY taught "
        + "(e.g. 'review the lesson', 'recall the four helpers taught'). "
        + "false if it is open study or an introduction to a new topic.",
    },
    taughtConcepts: {
      type: Type.ARRAY,
      maxItems: String(MAX_TAUGHT_CONCEPTS),
      description:
        "The specific concepts the lesson taught, named in the text. Empty array if the text "
        + "does not enumerate or clearly imply particular taught concepts.",
      items: {
        type: Type.STRING,
        description: "One taught concept, in the lesson's own words (2-5 words).",
      },
    },
  },
  required: ["requestedCount", "isReview", "taughtConcepts"],
};

/**
 * Resolve what a flashcard deck was actually asked for from its pedagogical scope.
 *
 * @param scope      The pedagogical scope (topic + objective + intent).
 * @param gradeLevel Grade-appropriate prose, for reading the request in context.
 * @returns The request, or null when there is nothing to resolve / resolution failed
 *          (→ caller keeps its existing default: no regression).
 */
export async function resolveDeckRequest(
  scope: PedagogicalScope,
  gradeLevel: string,
): Promise<DeckRequest | null> {
  // Nothing lesson-specific to bind → keep the open-study default (no call, no cost).
  if (!scope.intent && !scope.objectiveText) return null;

  try {
    const prompt = `A flashcard deck is being generated for a lesson. Read what the lesson asked for.

TOPIC: "${scope.topic}"
${scope.objectiveText ? `LEARNING OBJECTIVE: "${scope.objectiveText}"\n` : ''}${scope.intent ? `THIS DECK'S INTENT: "${scope.intent}"\n` : ''}GRADE: ${gradeLevel}

Report ONLY what the text above actually says. Do not infer, do not fill in a sensible default.

- requestedCount: the exact card count the text explicitly asks for ("10 simple review cards" -> 10, "a handful" -> null). If NO specific number appears, return null.
- isReview: true ONLY if the text describes reviewing, recalling, or assessing material the lesson ALREADY covered. An open topic to study, or an introduction to something new, is false.
- taughtConcepts: the specific things the lesson taught, as the text names them (e.g. "the light bulb", "electric light", "working at night"). If the text does not name or clearly imply particular taught concepts, return an empty array. Never add concepts that merely relate to the topic.`;

    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { temperature: 0, responseMimeType: "application/json", responseSchema: deckRequestSchema },
    });
    if (!result.text) return null;
    const parsed = JSON.parse(result.text);

    // Count: validate, never clamp. Out-of-window => unresolved, so the caller's default stands.
    let requestedCount: number | null = null;
    if (parsed?.requestedCount !== null && parsed?.requestedCount !== undefined) {
      const n = Math.round(Number(parsed.requestedCount));
      if (Number.isFinite(n) && n >= MIN_VALID_COUNT && n <= MAX_VALID_COUNT) requestedCount = n;
    }

    // Concepts: trim, drop empties, dedupe case-insensitively, bound the list.
    const seen = new Set<string>();
    const taughtConcepts = (Array.isArray(parsed?.taughtConcepts) ? parsed.taughtConcepts : [])
      .map((c: unknown) => (typeof c === 'string' ? c.trim() : ''))
      .filter((c: string) => {
        if (!c) return false;
        const key = c.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_TAUGHT_CONCEPTS);

    return { requestedCount, isReview: parsed?.isReview === true, taughtConcepts };
  } catch (e) {
    console.warn('[resolveDeckRequest] resolution failed:', e);
    return null;
  }
}
