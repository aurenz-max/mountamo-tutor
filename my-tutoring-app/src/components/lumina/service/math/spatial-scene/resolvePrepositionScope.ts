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
 *   for that a 3×3 static grid cannot express (viewer-relative "in front of"/"behind"
 *   and the path class "through"/"around"/"across") are reported back so the caller can
 *   LOG the gap rather than pretend it was served. Queued in qa/la-k2-grammar/BACKLOG.md.
 *
 * 2026-08-05 (item 1) — containment `in` and two-reference `between` moved OUT of
 * `unsupported` and into their own eval modes (`place_in`, `place_between`). They are
 * NOT relative-position words: `in` targets an OCCUPIED cell (inverting contract R11,
 * which is why it forks into a new mode rather than editing `place`) and `between`
 * needs a SECOND reference the single-reference checker cannot take. So they never join
 * the relative window the legacy modes use — see RELATIVE_POSITIONS below.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../../geminiClient";
import type { PedagogicalScope } from "../../scopeContext";

/**
 * RELATIVE position words — one target, ONE reference, judged by `positionHolds`.
 * These are the words that may enter a lesson's position WINDOW and appear as an
 * `identify`/`describe` option. A word belongs here only if
 * `SUPPORTED_POSITION_SEMANTICS` defines an exact row/col rule for it AND
 * `positionHolds` implements that rule — otherwise the LLM could emit it with no
 * correctness owner.
 */
export const RELATIVE_POSITIONS = [
  "above", "below", "beside", "next_to", "left_of", "right_of", "on", "under",
] as const;

export type RelativePosition = (typeof RELATIVE_POSITIONS)[number];

/**
 * Prepositions this primitive serves through a DEDICATED eval mode rather than the
 * relative window, because each one breaks an assumption the relative modes rely on:
 *
 * - `in` — containment. The answer cell is the one the container OCCUPIES, inverting
 *   contract R11 (`place` targets an EMPTY cell) and needing a nested render. Served by
 *   eval mode `place_in`; forked rather than folded into `place` per the contract ladder.
 * - `between` — needs TWO reference objects; `positionHolds` takes one. Served by eval
 *   mode `place_between`, which judges the cell, not a word.
 */
export const MODE_POSITIONS = ["in", "between"] as const;

export type ModePosition = (typeof MODE_POSITIONS)[number];

/**
 * Every preposition the resolver may report as REQUESTED (i.e. that this primitive can
 * serve somehow). Words outside this list are reported as `unsupported` and logged.
 */
export const SUPPORTED_POSITIONS = [
  ...RELATIVE_POSITIONS, ...MODE_POSITIONS,
] as const;

export type SupportedPosition = RelativePosition | ModePosition;

/** The eval mode that serves each mode-scoped preposition. */
export const MODE_FOR_POSITION: Record<ModePosition, string> = {
  in: "place_in",
  between: "place_between",
};

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
  in: '"in" = INSIDE the container: the object goes in the SAME cell the container occupies, drawn nested inside it. Not near it, not on top of it — inside it.',
  between: '"between" = in a cell with one reference object on EACH side: all three share the same row (or the same column) and the target sits in the empty cell separating the two references.',
};

export interface PrepositionScope {
  /** Supported position words the lesson explicitly asked for. Empty = no request. */
  requested: SupportedPosition[];
  /** Position words the lesson asked for that this grid cannot express (logged, not served). */
  unsupported: string[];
}

/**
 * The extra eval modes a lesson's request implies.
 *
 * `in` and `between` are NOT relative-window words (see MODE_POSITIONS), so a lesson
 * asking for them is asking for a challenge TYPE, not a vocabulary widening. In a
 * blended session (no pinned mode) this is what turns the old "we cannot express that"
 * log line into served content.
 */
export function resolveRequestedModes(resolved: PrepositionScope | null): string[] {
  if (!resolved) return [];
  return MODE_POSITIONS
    .filter((p) => (resolved.requested as readonly string[]).includes(p))
    .map((p) => MODE_FOR_POSITION[p]);
}

// ---------------------------------------------------------------------------
// Grid truth — the executable form of SUPPORTED_POSITION_SEMANTICS (contract R12)
// ---------------------------------------------------------------------------

export interface GridCell {
  row: number;
  col: number;
}

/**
 * Does `word` truthfully describe target-relative-to-reference on the grid?
 *
 * This is `SUPPORTED_POSITION_SEMANTICS` in executable form — the two MUST stay in
 * lockstep, which is why they live side by side. The prose is what the LLM is told;
 * this is what the code judges.
 *
 * @returns true / false for a supported word; **null** for a word with no grid
 *          semantics at all (the checker cannot own it either way).
 */
export function positionHolds(
  word: string,
  target: GridCell,
  reference: GridCell,
): boolean | null {
  const dr = target.row - reference.row;
  const dc = target.col - reference.col;
  switch (word) {
    case "above": return dr < 0 && dc === 0;
    case "below": return dr > 0 && dc === 0;
    case "left_of": return dc < 0 && dr === 0;
    case "right_of": return dc > 0 && dr === 0;
    case "beside":
    case "next_to": return dr === 0 && Math.abs(dc) === 1;
    // CONTACT-scoped: adjacent only. `on` ⊂ `above`, `under` ⊂ `below` — that
    // containment is exactly what makes C3 possible and why the guard below exists.
    case "on": return dr === -1 && dc === 0;
    case "under": return dr === 1 && dc === 0;
    // Containment: the contained object OCCUPIES the container's cell. This is the
    // rule that inverts R11, which is why `in` is served by its own eval mode and is
    // never a relative-window option (see MODE_POSITIONS).
    case "in": return dr === 0 && dc === 0;
    // `between` is deliberately NOT judgeable here — it needs a SECOND reference.
    // Use betweenHolds(). Returning null keeps it out of every options list.
    default: return null;
  }
}

/**
 * Does `target` sit between reference `a` and reference `b`?
 *
 * The two-reference twin of `positionHolds` — the whole reason `between` could not be
 * served before (contract C2): the checker took one reference, so the word had no
 * correctness owner. All three must share a row or a column, with the target strictly
 * inside the span.
 */
export function betweenHolds(target: GridCell, a: GridCell, b: GridCell): boolean {
  if (a.row === b.row && target.row === a.row) {
    return target.col > Math.min(a.col, b.col) && target.col < Math.max(a.col, b.col);
  }
  if (a.col === b.col && target.col === a.col) {
    return target.row > Math.min(a.row, b.row) && target.row < Math.max(a.row, b.row);
  }
  return false;
}

/**
 * The single cell that lies between two reference objects, or null when the pair
 * admits no unambiguous answer (not collinear, adjacent with no gap, or a span wide
 * enough to hold more than one "between" cell).
 *
 * CODE OWNS THE ANSWER: the generator derives `correctCell` from this rather than
 * trusting an LLM-emitted cell ([[llm-window-code-builds-structure]]). A pair this
 * returns null for is REJECTED, never shipped with a guessed answer.
 */
export function resolveBetweenCell(a: GridCell, b: GridCell): GridCell | null {
  if (a.row === b.row) {
    const lo = Math.min(a.col, b.col);
    const hi = Math.max(a.col, b.col);
    return hi - lo === 2 ? { row: a.row, col: lo + 1 } : null;
  }
  if (a.col === b.col) {
    const lo = Math.min(a.row, b.row);
    const hi = Math.max(a.row, b.row);
    return hi - lo === 2 ? { row: lo + 1, col: a.col } : null;
  }
  return null;
}

export interface ExclusiveOptions {
  /** The key, repaired to the grid truth when the LLM's word was false for it. */
  correctPosition: string;
  /** Options with exactly ONE defensible entry; all others are false for this geometry. */
  options: string[];
  /** Options dropped because they were ALSO true — the C3 defect, per challenge. */
  removed: string[];
  /** Options dropped because they have no grid semantics / are outside the window. */
  outOfWindow: string[];
  /** The LLM's correctPosition was false for the geometry; the key was rewritten. */
  repairedKey: boolean;
  /** No window word is true of this geometry — there is no defensible answer at all. */
  unjudgeable: boolean;
}

/**
 * Contract R12 — an `identify`/`describe` options list may contain exactly ONE
 * defensible answer.
 *
 * WHY (C3, measured 2026-08-05): `above`/`on`, `below`/`under` and `beside`/`next_to`
 * are not mutually exclusive. `on` means "touching, directly above"; for an ADJACENT
 * same-column pair both `on` and `above` are true, so a child answering "above" against
 * a key of "on" is marked wrong for a correct answer. Cell-judged modes are immune;
 * these two single-key modes are not. Probe F found this in 4 of 18 challenges.
 *
 * The rule is geometry-driven, not a hardcoded synonym table, so it also covers the
 * pairs nobody listed — `beside` ⊂ `left_of`/`right_of` at Grade 1, for instance.
 *
 * Distractors are drawn from the lesson's own position window, so enforcing exclusivity
 * can never introduce a word R1/R2 excluded.
 */
export function enforceSingleDefensibleOption(
  correctPosition: string,
  rawOptions: string[],
  target: GridCell,
  reference: GridCell,
  positionWindow: RelativePosition[],
): ExclusiveOptions {
  const trueInWindow = positionWindow.filter((w) => positionHolds(w, target, reference) === true);

  // Nothing in the window describes this arrangement (e.g. a diagonal placement).
  // There is no answer to defend, so the caller drops the challenge rather than
  // shipping an unanswerable item.
  if (trueInWindow.length === 0) {
    return {
      correctPosition, options: rawOptions, removed: [], outOfWindow: [],
      repairedKey: false, unjudgeable: true,
    };
  }

  // The grid is ground truth. If the LLM's key is false for the arrangement it drew —
  // or true but outside the lesson's window (R1) — adopt a word that is both, preferring
  // one it already offered as an option.
  let key = correctPosition;
  let repairedKey = false;
  const keyValid = (positionWindow as readonly string[]).includes(key)
    && positionHolds(key, target, reference) === true;
  if (!keyValid) {
    key = trueInWindow.find((w) => rawOptions.includes(w)) ?? trueInWindow[0];
    repairedKey = true;
  }

  const removed: string[] = [];
  const outOfWindow: string[] = [];
  const kept: string[] = [key];
  const seen = new Set<string>([key]);

  for (const opt of rawOptions) {
    if (seen.has(opt)) continue;
    seen.add(opt);
    const holds = positionHolds(opt, target, reference);
    if (!(positionWindow as readonly string[]).includes(opt) || holds === null) {
      // Outside the lesson's window, or a word with no single-reference grid semantics
      // (`between` needs two references) — either way the checker cannot own it, so it
      // must not be offered. A distractor whose truth is unknown may in fact be TRUE.
      outOfWindow.push(opt);
    } else if (holds === true) {
      removed.push(opt); // ALSO defensible → the C3 trap
    } else {
      kept.push(opt);
    }
  }

  // Backfill from the window with words that are FALSE for this geometry, so the
  // student still chooses between real alternatives (contract R7: >= 2 options).
  // `!== false` (not `=== true`) so an unjudgeable word can never be backfilled either.
  const TARGET_OPTIONS = 4;
  for (const w of positionWindow) {
    if (kept.length >= TARGET_OPTIONS) break;
    if (seen.has(w) || positionHolds(w, target, reference) !== false) continue;
    seen.add(w);
    kept.push(w);
  }

  return { correctPosition: key, options: kept, removed, outOfWindow, repairedKey, unjudgeable: false };
}

/**
 * Move the answer off slot 0.
 *
 * Measured alongside C3: the LLM emitted `correctPosition` as `option0` in 18 of 18
 * probed challenges, and the component renders options in array order — so "always
 * tap the first button" solved every item without reading the grid. Pedagogy rule #1:
 * a challenge must not be trivially solvable from layout.
 *
 * Seeded by the challenge id so a given challenge always renders the same order
 * (stable across re-reads, and testable — no Math.random in the content path).
 */
export function placeAnswerSlot(options: string[], key: string, seed: string): string[] {
  if (options.length < 2) return options;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const slot = Math.abs(h) % options.length;
  const rest = options.filter((o) => o !== key);
  const out = [...rest];
  out.splice(slot, 0, key);
  return out;
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
        + "(for example: in front of, behind, through, around, across). "
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

- requested: which of these supported words the text asks the student to practise — ${SUPPORTED_POSITIONS.join(", ")}. Map natural phrasings onto this list ("on top of" -> on, "underneath"/"beneath" -> under, "next to"/"nextto" -> next_to, "to the left of" -> left_of, "inside"/"into" -> in, "in the middle of"/"in between" -> between). If the text names NO particular position words, return an empty array.
- unsupported: any other position or preposition words the text asks for that are not in that supported list (for example: in front of, behind, through, around, across). Empty array if there are none.`;

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
export function bandDefaultPositions(gradeBand: "K" | "1"): RelativePosition[] {
  return gradeBand === "K"
    ? ["above", "below", "beside", "next_to"]
    : ["above", "below", "beside", "next_to", "left_of", "right_of"];
}

/**
 * Compose the window the RELATIVE modes may use: the band default WIDENED by whatever
 * the lesson explicitly asked for. Never narrows — a resolved request can only add.
 *
 * `in` and `between` are filtered out by construction: they are served by their own
 * eval modes, not by widening this window (see MODE_POSITIONS). A lesson asking only
 * for containment therefore leaves the relative window at its band default — the math
 * K.G.1 guarantee (R1) survives a vocabulary the relative modes cannot judge.
 */
export function composePositionWindow(
  gradeBand: "K" | "1",
  resolved: PrepositionScope | null,
): RelativePosition[] {
  const base = bandDefaultPositions(gradeBand);
  if (!resolved || resolved.requested.length === 0) return base;
  const union = new Set<string>([...base, ...resolved.requested]);
  return RELATIVE_POSITIONS.filter((p) => union.has(p));
}
