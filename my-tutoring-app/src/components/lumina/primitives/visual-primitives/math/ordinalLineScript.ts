/**
 * ordinalLineScript — HAND-AUTHORED judged-loop script for ordinal-line
 * (qa/di/BACKLOG.md item 18 P4, the SIXTH math port after ten-frame,
 * addition-subtraction-scene, number-bond, compare-objects and shape-sorter). The exact
 * wording IS the pedagogy — these lines are authored per pack, never generated.
 * Item CONTENT (which characters, which context, which positions) is
 * generator-scoped; this module owns the cue shapes, the build gates and the
 * in-band judging contracts.
 *
 * ── WHY THIS PRIMITIVE, AND WHY ITS BLOCKER WAS FALSE ───────────────────────
 *
 * The queue said since 2026-08-14 that ordinal-line was gated by RESPONSE
 * CLASS, "ordinal words are unbenched". They are not: `ordinal_word` is
 * `status: 'benched'` in `judgedScriptContract.ts` and has been the whole time.
 * That one stale line kept this primitive off the Class-A list for three months
 * — which is why port 4 had to be found off-list — and it is struck in the
 * queue in the same slice as this pack.
 *
 * The second half of the same line — *"`identify` is a tap anyway"* — is not a
 * reason, it is THE DEFECT. The catalog labels mode 1 *"Identify — **Name**
 * ordinal position"* and the interaction was a tap on a character. A mode whose
 * own label is a speech act and whose surface is a button is the purest costume
 * this lane has found since compare-objects' attribute chips, and it is the
 * same argument one primitive later: ordinal vocabulary is taught by SAYING it.
 *
 * Nothing else gated it. `maxPosition` is clamped to ≤ 10 in the generator, so
 * every position a child ever names is inside the benched `first..tenth`
 * window: no #63, no new response class, no bench sitting owed.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1) ─────────────────────────────────
 *
 *   identify          → SPOKEN, forks by BAND — see below
 *   match             → SPOKEN ordinal word    ordinal_word      (benched)
 *   relative_position → SPOKEN character name  short_spoken_word (benched)
 *   sequence_story    → SPOKEN ordinal word    ordinal_word      (benched)
 *   build_sequence    → ARRANGED characters    manipulation      (benched)
 *
 * Four spoken, one placement — structurally the same shape compare-objects
 * shipped, which is a signal the pattern is settling rather than a coincidence
 * to copy blindly.
 *
 * ⭐ `identify` FORKS BY DIRECTION, AND THE TWO DIRECTIONS ARE DIFFERENT SKILLS
 * (handoff §3, and the one design decision this port had to make deliberately
 * rather than discover):
 *
 *   Direction A — position → name.  *"Who is third?"* → the child says the
 *     CHARACTER'S name (`short_spoken_word`). The ordinal is in the ASK.
 *   Direction B — name → position.  *"What place is the fox in?"* → the child
 *     says the ORDINAL WORD (`ordinal_word`). The ordinal is the ANSWER.
 *
 * ONLY DIRECTION B PRODUCES THE VOCABULARY THE MODE IS NAMED FOR. But Direction
 * A is the easier rung and is genuinely what a K teacher asks first, so both
 * ship, BAND-SPLIT, as ONE eval mode: A at Kindergarten, B at Grade 1, decided
 * in `itemFromChallenge` from `band`. Not two eval modes — they are the same
 * task identity at two difficulties, the βs are already spent, and a split
 * would cost a catalog change and an IRT re-anchor for no measurement gain.
 * (This is open decision 1 in the brief, taken as recommended; recorded in the
 * catalog `description` so the manifest knows what it routes to.)
 *
 * The fork also has a property worth naming: EACH DIRECTION'S ASK IS LEAK-CLEAN
 * BY CONSTRUCTION. Direction A names the ordinal and wants a name; Direction B
 * names the character and wants an ordinal. Neither ask can contain its own
 * answer, so `leakExemptSpanFor` is `undefined` on both — the only mode here
 * that needs an exempt span is the story, whose stimulus IS the answer key.
 *
 * WHY EACH SPOKEN MODE SPEAKS. Costume test — can a child who cannot do the
 * skill still perform this action correctly?
 *   - `identify`: yes, trivially — one tap on a lineup of five, and a wrong tap
 *     was told so instantly, so the child could walk the line until it landed.
 *   - `match`: yes — the click-era match column CONSUMED its entries, so the
 *     last pair of every grid had one option left and needed no reading at all
 *     (word-sorter's elimination leak, second sighting). Reading "3rd" aloud IS
 *     the skill and the word column is what hid it.
 *   - `relative_position`: yes — 3-4 name buttons is a guess floor of 1-in-3
 *     over a relation the child never has to state.
 *   - `sequence_story`: see below; it was a placement, and it was the SAME
 *     placement as `build_sequence`.
 *
 * ⭐ `sequence_story` IS THE ONE MODE WHOSE SHAPE THE BRIEF GOT WRONG, AND THE
 * CORRECTION MAKES THE PORT BETTER. The handoff's table says it is multiple
 * choice today; it is not — `OrdinalLine.tsx` renders it through
 * `renderBuildSequence(false)` and grades it with `checkBuildSequence`, i.e. it
 * is byte-for-byte the same drag-into-slots interaction as `build_sequence`,
 * differing only in whether the clues are printed as a list or as prose. Two
 * eval modes with two βs measuring one interaction is not a fork, it is a
 * duplicate. Making the story SPOKEN separates them properly: the story is a
 * LISTENING task (track a narrative, say a place), the build is a PLACEMENT
 * task (hear the clues, arrange the line). ASS's `solve_story` is the
 * precedent, and it is why the story text no longer prints — a pre-reader could
 * never use it, and a G1 reader who can re-read it is not listening.
 *
 * WHY THE BUILD KEPT ITS HANDS. `build_sequence` is the third unsayable shape:
 * the ARRANGEMENT is the answer. Reciting four names in order is a different,
 * memory-loaded task, and at the table the child physically moves the pieces.
 * The screen IS that page — honest work, not a concession the judge extracted.
 * Precedent: compare-objects `order_three`, number-bond `decompose`, ten-frame
 * `build`.
 *
 * ── THE SIGNATURE ERRORS ARE UNUSUALLY GOOD HERE ────────────────────────────
 *
 * Both were already written down in the catalog's `commonStruggles`, and both
 * are fluent, confident and wrong — the exact shape `discriminationFor` exists
 * to refuse:
 *
 *   1. COUNTING FROM THE WRONG END. On a line of five, target 2nd, the child
 *      says the 4th one — position `n + 1 − k`. Computed in CODE per item so
 *      the clause is exact, and it is the harness's `signatureWrong` on every
 *      line-reading mode.
 *   2. CARDINAL FOR ORDINAL — *"three"* for *"third"*. This is the misconception
 *      the ordinal modes exist to teach against, so it is WRONG and CORRECTED,
 *      never leniently accepted. It is also the pack's sharpest teaching moment:
 *      the correction is where *"three tells how many, third tells which one"*
 *      gets said, and it is said on a code-built counting walk.
 *
 * ── ⭐ WRITING THE SPOKEN ASK AUDITED THE CONTENT — FIVE FINDINGS ───────────
 *
 * (1) THE ORDINAL LABELS ARE AN ANSWER KEY IN PIXELS. `showPositionLabels`
 *     rendered `getOrdinalLabel(pos, labelFormat)` under EVERY character —
 *     literally `3rd (third)` when `labelFormat` is `'both'`. Harmless while a
 *     button graded it; the moment the ask is *"who is third?"* the child reads
 *     the answer off the screen, and in Direction B the label IS the answer,
 *     verbatim. THE THIRD PORT IN A ROW WITH THIS DEFECT (ten-frame's running
 *     counter, compare-objects' numbered unit boxes, now this). The component
 *     holds every ordinal label behind `runner.revealHeld`; the counting walk
 *     lives in the CORRECTION, where it is earned.
 *
 * (2) THE MATCH GRID PRINTS ITS OWN ANSWER KEY, TWICE OVER. The word column and
 *     the symbol column sit side by side, so "read 3rd aloud" is answerable by
 *     reading "third" off the next column — and the column CONSUMED its entries,
 *     so the last pair needed no reading at all. One judged ask per symbol, one
 *     card on screen, no word column: `itemsFromChallenge` expands a grid into
 *     N items (defect class 1, and this port's biggest measurement change).
 *
 * (3) A CHARACTER NAME MAY NOT CARRY AN ORDINAL. Defect class 11, one primitive
 *     old and now generalised rather than re-written: *"First-Place Freddie"* or
 *     *"Number Three"* answers the ask out loud, and on Direction B the name IS
 *     the answer. The refuse-list is `ORDINAL_TOKENS` in `spokenNameGates.ts`
 *     and it includes the CARDINAL words too, because a *"Three-Toed Sloth"* on
 *     a line whose third position gets asked hands the child the exact wrong
 *     answer the pack exists to refuse.
 *
 * (4) THE ASK MUST NAME WHICH END IS THE FRONT. `context` is one of race /
 *     parade / lunch-line / train / bookshelf and each draws a different start
 *     label (`START`, `Engine`, `Left`) — which a pre-reader cannot read.
 *     "Third" is meaningless without it, and counting from the wrong end is
 *     this primitive's #1 recorded misconception, so the ask STATES THE FRONT
 *     ALOUD ("Start counting at the engine…") on every line-reading mode.
 *
 * (5) `correctAnswer` COULD DISAGREE WITH `targetPosition`. The field is
 *     `string | number`, both forms are live, and the click era's `checkIdentify`
 *     just did `Number(correctAnswer)` — so a challenge whose key and whose
 *     target position disagreed graded against the key and drew the line from
 *     the target. Normalised once, then DROPPED on disagreement.
 *
 * ── CONTENT GATES (skill step 4) — KEEP OR DROP, NEVER BACKFILL ─────────────
 *
 * Every gate below is EXPORTED and the generator IMPORTS it, so there is one
 * predicate per rule on both sides of the wire (letter-spotter's two hand-synced
 * copies disagreeing live is the reason). Nothing is repaired into askability.
 *
 * The pack's generated-content surface is CHARACTER NAMES and STORY PROSE. Names
 * are bounded by `isSayableName` + `namesEarSeparable` + the ordinal refuse-list;
 * the story is bounded by `isSpeakableStory`, which is the stricter gate because
 * it is the only generated string this pack reads out VERBATIM — a double quote
 * in it would close the `Say exactly: "…"` span and turn the rest of the cue into
 * judge-side prose, and a story opening *"Yes, the animals lined up…"* would be
 * read by the engine as an affirmation.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked by
 * `checkPackGates` in this pack's test file over every cue it can emit.
 */

import {
  opensWithSentinel,
  type JudgedScriptItem,
  type JudgedCueSurface,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import { numberWordFor } from './countingBoardScript';
import {
  isSayableName,
  nameCarriesAny,
  namesEarSeparable,
  ORDINAL_TOKENS,
} from './spokenNameGates';

// ============================================================================
// Domain vocabulary
// ============================================================================

export type OrdinalLineKind =
  | 'identify'
  | 'match'
  | 'relative_position'
  | 'sequence_story'
  | 'build_sequence';

export type OrdinalBand = 'K' | '1';

export type OrdinalContext = 'race' | 'parade' | 'lunch-line' | 'train' | 'bookshelf';

/** Which way an `identify` ask runs. See the module docblock — the split is by
 *  BAND, inside ONE eval mode. */
export type OrdinalDirection = 'name_character' | 'name_place';

/** The benched window, `first..tenth`. The generator clamps `maxPosition` to 10
 *  already; this asserts it in the build gate so a future capacity change
 *  cannot launder an unbenched class into a spoken ask. */
export const MAX_POSITION = 10;

/** A line of two has no ordinal work in it — "first or second" is a coin flip
 *  and the wrong-end error is unreachable. */
export const MIN_LINE_LENGTH = 3;

/**
 * How many clues a child can hold FROM SPEECH. The click era printed them, so
 * the generator's `hard` tier happily emitted one clue per character — up to
 * ten. Spoken, that is not a harder task, it is an unanswerable one, so the
 * gate drops past four AND the generator stops producing them (the pair is the
 * point: a gate that drops every hard-tier item would delete a tier).
 */
export const MAX_SPOKEN_CLUES = 4;

/** The story is the one generated string this pack speaks verbatim. */
export const MAX_STORY_CHARS = 340;
export const MAX_STORY_WORDS = 70;

/** One challenge's worth of judged asks — a match grid can carry eight pairs
 *  and must not fill a session on its own. */
export const MAX_ITEMS_PER_CHALLENGE = 4;

export const ORDINAL_WORDS: readonly string[] = [
  'first', 'second', 'third', 'fourth', 'fifth',
  'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
];

export const ORDINAL_SYMBOLS: readonly string[] = [
  '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th',
];

export const VALID_CONTEXTS: readonly OrdinalContext[] =
  ['race', 'parade', 'lunch-line', 'train', 'bookshelf'];

export const ordinalWordFor = (position: number): string =>
  ORDINAL_WORDS[position - 1] ?? `${position}th`;

export const ordinalSymbolFor = (position: number): string =>
  ORDINAL_SYMBOLS[position - 1] ?? `${position}th`;

/** "3rd" → 3. Returns 0 for anything outside the benched window, so a caller
 *  can treat 0 as "not askable" without a second range check. */
export const positionOfSymbol = (symbol: unknown): number => {
  if (typeof symbol !== 'string') return 0;
  const idx = ORDINAL_SYMBOLS.indexOf(symbol.trim().toLowerCase());
  return idx === -1 ? 0 : idx + 1;
};

/**
 * WHICH END IS THE FRONT, IN WORDS A FIVE-YEAR-OLD OWNS. The screen labels it
 * (`START`, `Engine`, `Left`) and a pre-reader cannot read the label, so the
 * ask says it. `back` is judge-side only — it appears in the discrimination
 * clause that names the wrong-end error and never in a spoken line.
 */
const CONTEXT_ENDS: Record<OrdinalContext, { front: string; back: string }> = {
  race: { front: 'the starting line', back: 'the finish line' },
  parade: { front: 'the front of the parade', back: 'the end of the parade' },
  'lunch-line': { front: 'the front of the line', back: 'the back of the line' },
  train: { front: 'the engine', back: 'the caboose' },
  bookshelf: { front: 'the left end of the shelf', back: 'the right end of the shelf' },
};

export const frontOf = (context: OrdinalContext): string => CONTEXT_ENDS[context].front;
export const backOf = (context: OrdinalContext): string => CONTEXT_ENDS[context].back;

const int = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

/** Deterministic and stable across renders and across the wire — the component
 *  and the DI harness must agree on which position a story asks about. */
const hashOf = (value: string): number => {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
};

// ============================================================================
// Sayability + content gates — EXPORTED, and imported by the generator
// ============================================================================

/** Inside the benched `first..tenth` window, and a real position. */
export const isSayablePosition = (n: unknown): n is number =>
  int(n) && n >= 1 && n <= MAX_POSITION;

/**
 * A character name this pack may put in the tutor's mouth. Sayable, and free of
 * anything that states a POSITION — see finding 3. Exported as one predicate so
 * the generator refuses the same names the build gate would drop.
 */
export const isUsableCharacterName = (name: unknown): name is string =>
  isSayableName(name) && !nameCarriesAny(name, ORDINAL_TOKENS);

/**
 * The story, gated for VERBATIM speech. Stricter than any other generated
 * string in this pack because it is the only one read out whole:
 *   - a double quote CLOSES the `Say exactly: "…"` span, so everything after it
 *     becomes judge-side prose — the structural surface the performed-"[WAIT
 *     silently]" defect lived on;
 *   - a sentence opening with a verdict sentinel would be read by the engine as
 *     a judgment, and the story is 2-3 sentences of model prose;
 *   - length, because the child listens to the whole thing before the ask and
 *     then hears it AGAIN in the correction.
 */
export const isSpeakableStory = (text: unknown): text is string => {
  if (typeof text !== 'string') return false;
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length < 12 || trimmed.length > MAX_STORY_CHARS) return false;
  if (trimmed.split(' ').length > MAX_STORY_WORDS) return false;
  if (/["“”]/.test(trimmed)) return false;
  if (/[[\]{}<>]/.test(trimmed)) return false;
  return !opensWithSentinel(trimmed);
};

/**
 * THE LINE, gated as a spoken closed set. Every name is sayable, none states a
 * position, no two are confusable by ear, and the line is long enough to have
 * ordinal work in it and short enough to stay inside the benched window.
 * Returns the names in LINE order, or null.
 */
export const usableLineNames = (
  characters: readonly { name?: unknown }[] | undefined,
): string[] | null => {
  const names = (characters ?? [])
    .map((c) => (typeof c?.name === 'string' ? c.name.trim() : ''))
    .filter(Boolean);
  if (names.length !== (characters ?? []).length) return null;
  if (names.length < MIN_LINE_LENGTH || names.length > MAX_POSITION) return null;
  if (!names.every(isUsableCharacterName)) return null;
  if (!namesEarSeparable(names)) return null;
  return names;
};

/**
 * THE WRONG-END POSITION — the primitive's #1 recorded misconception, as
 * arithmetic. On a line of `n`, a child counting from the back instead of the
 * front lands on `n + 1 − k`.
 *
 * It collapses on the exact middle of an odd line (k = 3 of 5 → 3), where the
 * wrong-end error IS the right answer and there is no confident miss to name.
 * There the clause falls back to the ADJACENT position, which is the catalog's
 * third recorded struggle ("selects adjacent position (off by one)") — a real
 * error rather than an invented one. Returns 0 when even that is unreachable.
 */
export const signatureWrongPosition = (lineLength: number, position: number): number => {
  const wrongEnd = lineLength + 1 - position;
  if (wrongEnd !== position && wrongEnd >= 1 && wrongEnd <= lineLength) return wrongEnd;
  if (position + 1 <= lineLength) return position + 1;
  if (position - 1 >= 1) return position - 1;
  return 0;
};

/** True when the confident miss is the wrong-END error rather than the
 *  off-by-one fallback — the two get different prose. */
export const signatureIsWrongEnd = (lineLength: number, position: number): boolean =>
  lineLength + 1 - position !== position;

// ============================================================================
// Answer material — the fork, as code
// ============================================================================

export const answerKindFor = (kind: OrdinalLineKind): 'voice' | 'gesture' =>
  kind === 'build_sequence' ? 'gesture' : 'voice';

/** The `identify` split: A at Kindergarten, B at Grade 1 (module docblock). */
export const directionFor = (band: OrdinalBand): OrdinalDirection =>
  band === 'K' ? 'name_character' : 'name_place';

export const responseClassFor = (
  kind: OrdinalLineKind,
  direction: OrdinalDirection,
): ResponseClassId => {
  switch (kind) {
    case 'build_sequence': return 'manipulation';
    case 'relative_position': return 'short_spoken_word';
    case 'match': return 'ordinal_word';
    case 'sequence_story': return 'ordinal_word';
    case 'identify':
      return direction === 'name_character' ? 'short_spoken_word' : 'ordinal_word';
  }
};

/**
 * Task identity for the runner's how-to-play policy: when consecutive items
 * change `action`, the next cue re-speaks what to do. The two `identify`
 * directions get DIFFERENT actions — they never mix inside one band, but if a
 * blended session ever put them side by side the how-to-play must re-speak,
 * because the child is being asked for a different KIND of thing.
 */
export const actionFor = (
  kind: OrdinalLineKind,
  direction: OrdinalDirection,
): string => {
  switch (kind) {
    case 'identify':
      return direction === 'name_character' ? 'name-character' : 'name-place';
    case 'match': return 'read-symbol';
    case 'relative_position': return 'name-neighbour';
    case 'sequence_story': return 'story-place';
    case 'build_sequence': return 'arrange';
  }
};

export interface OrdinalLineItem extends JudgedScriptItem {
  kind: OrdinalLineKind;
  band: OrdinalBand;
  /** Which way the ask runs. Meaningful on `identify`; carried on every item so
   *  the stage and the verdict lines read from one field. */
  direction: OrdinalDirection;
  context: OrdinalContext;
  /** Character names in LINE order — index i is position i+1. */
  lineNames: string[];
  /**
   * The position the ask is ABOUT (1-indexed):
   *   identify           — the target position
   *   relative_position  — the ANCHOR the ask names (the answer is at ±1)
   *   match              — the symbol's position
   *   sequence_story     — the asked character's place
   *   build_sequence     — 0 (the whole line is the answer)
   */
  askPosition: number;
  /** relative_position: which side of the anchor. */
  relativeQuery: 'before' | 'after';
  /** match: the printed symbol the child reads aloud. */
  symbol: string;
  /** sequence_story: the story spoken verbatim, and who the ask is about. */
  storyText: string;
  storyName: string;
  /** build_sequence: the clues IN THE ORDER THEY ARE SPOKEN (the generator's
   *  `hard` tier scrambles that order, which is a real spoken lever). */
  clues: Array<{ name: string; position: number }>;
  /** THE ANSWER as the child says it. Empty on the gesture mode. */
  answerText: string;
  /** build_sequence: the correct arrangement, position 1..n. */
  answerOrder: string[];
}

// ============================================================================
// Build gates — DROP an unaskable item, never repair it into one
// ============================================================================

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface OrdinalLineChallengeLike {
  id: string;
  type: string;
  characters?: Array<{ name?: unknown; emoji?: unknown }>;
  targetPosition?: number;
  relativeQuery?: string;
  storyText?: string;
  clues?: Array<{ character?: unknown; position?: unknown }>;
  correctAnswer?: string | number;
  matchPairs?: Array<{ word?: unknown; symbol?: unknown }>;
  /** The click era's multiple-choice row. Declared so the shape is honest about
   *  what the generator still emits, and READ BY NOTHING: no item carries it, so
   *  a cached challenge cannot put the buttons back. */
  options?: Array<string | number>;
}

export interface OrdinalBuildContext {
  band: OrdinalBand;
  context: OrdinalContext;
}

/** The click-era type strings, mapped onto the eval-mode ids. */
const KIND_OF_TYPE: Record<string, OrdinalLineKind> = {
  identify: 'identify',
  match: 'match',
  'relative-position': 'relative_position',
  'sequence-story': 'sequence_story',
  'build-sequence': 'build_sequence',
};

const baseItemFields = (
  ch: OrdinalLineChallengeLike,
  kind: OrdinalLineKind,
  ctx: OrdinalBuildContext,
  lineNames: string[],
) => {
  const direction = directionFor(ctx.band);
  return {
    id: ch.id,
    kind,
    band: ctx.band,
    direction,
    context: ctx.context,
    lineNames,
    answerKind: answerKindFor(kind),
    responseClass: responseClassFor(kind, direction),
    action: actionFor(kind, direction),
    askPosition: 0,
    relativeQuery: 'after' as const,
    symbol: '',
    storyText: '',
    storyName: '',
    clues: [] as Array<{ name: string; position: number }>,
    answerText: '',
    answerOrder: [] as string[],
  };
};

/**
 * ONE CHALLENGE IS NOT ONE ITEM (defect class 1). A `match` grid of N pairs is
 * N judged asks — one per symbol — which is also what dissolves the elimination
 * leak the grid carried by construction. Every other mode is one item, and
 * returns an array of length 0 or 1 so the caller has one code path.
 *
 * Every rejection is a CONTENT fault the spoken ask exposed:
 *   - an unknown type, or a line the tutor cannot say / the judge cannot
 *     separate by ear / that names a position in a character's name;
 *   - a position outside the benched `first..tenth` window or off the line;
 *   - a key that disagrees with the target position, or with the line;
 *   - a symbol whose printed word is not the ordinal for that symbol;
 *   - a story that cannot be spoken verbatim, or that has no middle to ask about;
 *   - a clue set that is not a contiguous arrangement, or is longer than a child
 *     can hold from speech.
 * Nothing is backfilled: a placeholder here becomes a spoken ask the tutor has
 * to judge.
 */
export const itemsFromChallenge = (
  ch: OrdinalLineChallengeLike,
  ctx: OrdinalBuildContext,
): OrdinalLineItem[] => {
  const kind = KIND_OF_TYPE[ch?.type ?? ''];
  if (!kind || !ch?.id) return [];

  const lineNames = usableLineNames(ch.characters);
  if (!lineNames) return [];
  const n = lineNames.length;
  const base = baseItemFields(ch, kind, ctx, lineNames);

  if (kind === 'identify') {
    const pos = ch.targetPosition;
    if (!isSayablePosition(pos) || pos > n) return [];
    // Finding 5: the key and the target position are two fields and the click
    // era never had to justify the pairing.
    const declared = Number(String(ch.correctAnswer ?? '').trim());
    if (!Number.isFinite(declared) || declared !== pos) return [];
    return [{
      ...base,
      askPosition: pos,
      answerText: base.direction === 'name_character'
        ? lineNames[pos - 1]
        : ordinalWordFor(pos),
    }];
  }

  if (kind === 'match') {
    const pairs = ch.matchPairs ?? [];
    const items: OrdinalLineItem[] = [];
    const seen = new Set<number>();
    for (const pair of pairs) {
      if (items.length >= MAX_ITEMS_PER_CHALLENGE) break;
      const pos = positionOfSymbol(pair?.symbol);
      if (!pos || seen.has(pos)) continue;
      // The printed word and the printed symbol must be the SAME ordinal. The
      // click era only ever compared the two strings the model emitted against
      // each other; nothing checked either against the ordinal sequence.
      const word = typeof pair?.word === 'string' ? pair.word.trim().toLowerCase() : '';
      if (word !== ordinalWordFor(pos)) continue;
      seen.add(pos);
      items.push({
        ...base,
        id: `${ch.id}::p${pos}`,
        askPosition: pos,
        symbol: ordinalSymbolFor(pos),
        answerText: ordinalWordFor(pos),
      });
    }
    return items;
  }

  if (kind === 'relative_position') {
    const anchor = ch.targetPosition;
    if (!isSayablePosition(anchor) || anchor > n) return [];
    const query = ch.relativeQuery === 'before' ? 'before' : 'after';
    const answerIdx = query === 'before' ? anchor - 2 : anchor;
    if (answerIdx < 0 || answerIdx >= n) return [];
    const answerName = lineNames[answerIdx];
    // The key must agree with the LINE. A cached challenge whose options were
    // repaired but whose key was not is exactly this shape.
    if (String(ch.correctAnswer ?? '').trim() !== answerName) return [];
    return [{
      ...base,
      askPosition: anchor,
      relativeQuery: query,
      answerText: answerName,
    }];
  }

  if (kind === 'sequence_story') {
    const story = (ch.storyText ?? '').replace(/\s+/g, ' ').trim();
    if (!isSpeakableStory(story)) return [];
    const clues = normalizedClues(ch.clues, lineNames);
    if (!clues || clues.length < MIN_LINE_LENGTH) return [];
    // ASK ABOUT A MIDDLE POSITION. The first and last characters of a narrative
    // are free to a child who heard only the beginning or only the end
    // (primacy and recency), so the ask draws from the interior — which is the
    // part that requires actually tracking the story.
    const middles = clues.map((c) => c.position).filter((p) => p > 1 && p < clues.length);
    if (middles.length === 0) return [];
    const pos = middles[hashOf(ch.id) % middles.length];
    const name = clues.find((c) => c.position === pos)!.name;
    return [{
      ...base,
      askPosition: pos,
      storyText: story,
      storyName: name,
      clues,
      answerText: ordinalWordFor(pos),
    }];
  }

  // build_sequence
  const clues = normalizedClues(ch.clues, lineNames);
  if (!clues || clues.length < 2 || clues.length > MAX_SPOKEN_CLUES) return [];
  return [{
    ...base,
    clues,
    answerOrder: [...clues].sort((a, b) => a.position - b.position).map((c) => c.name),
  }];
};

/**
 * Clues, in the order the generator listed them (that order is SPOKEN, and the
 * `hard` tier scrambles it deliberately). Null unless every clue names a real
 * character exactly once and the positions are exactly `1..length` — a gappy
 * arrangement ("second and fourth") has slots nobody is told about, which under
 * a Check button was merely odd and out loud is unanswerable.
 */
const normalizedClues = (
  clues: OrdinalLineChallengeLike['clues'],
  lineNames: readonly string[],
): Array<{ name: string; position: number }> | null => {
  const list = clues ?? [];
  if (list.length === 0) return null;
  const out: Array<{ name: string; position: number }> = [];
  for (const clue of list) {
    const name = typeof clue?.character === 'string' ? clue.character.trim() : '';
    const position = clue?.position;
    if (!lineNames.includes(name)) return null;
    if (!isSayablePosition(position)) return null;
    out.push({ name, position });
  }
  if (new Set(out.map((c) => c.name)).size !== out.length) return null;
  const positions = new Set(out.map((c) => c.position));
  if (positions.size !== out.length) return null;
  for (let p = 1; p <= out.length; p++) if (!positions.has(p)) return null;
  return out;
};

/**
 * The whole session's items.
 *
 * DEDUP IS SESSION-WIDE, NOT CONSECUTIVE (defect class 2), and it needs TWO
 * SETS kept apart — port 7 merged its two and ran the pool dry.
 *
 *   `askedPositions` — the position an ask was ABOUT. The `characters` array is
 *     the SAME across every challenge of one session, so a second ask about the
 *     third position is recall of the first, whichever mode asks it.
 *   `namedCharacters` / `spokenOrdinals` — what has already been SAID ALOUD as
 *     an answer. Half two of the class bites here in a way it did not on
 *     compare-objects: on Direction A an already-named character coming back as
 *     the answer is free, and a `relative_position` answer sits at anchor ± 1,
 *     which the position set does not cover.
 *
 * The two answer sets stay separate from each other as well as from the
 * position set: a session that asked "who is third?" (answer "Fox") has spent
 * the character Fox but NOT the word "third", which is still an honest answer
 * to a `match` card the child has to read.
 */
export const itemsFromChallenges = (
  challenges: readonly OrdinalLineChallengeLike[],
  ctx: OrdinalBuildContext,
): { items: OrdinalLineItem[]; droppedChallenges: number } => {
  const items: OrdinalLineItem[] = [];
  const seenIds = new Set<string>();
  const askedPositions = new Set<number>();
  const namedCharacters = new Set<string>();
  const spokenOrdinals = new Set<string>();
  const seenArrangements = new Set<string>();
  let dropped = 0;

  for (const ch of challenges ?? []) {
    const built = itemsFromChallenge(ch, ctx);
    if (built.length === 0) { dropped++; continue; }
    let kept = 0;
    for (const item of built) {
      if (seenIds.has(item.id)) continue;

      if (item.kind === 'build_sequence') {
        const key = [...item.clues]
          .sort((a, b) => a.position - b.position)
          .map((c) => `${c.name}@${c.position}`)
          .join('|');
        if (seenArrangements.has(key)) continue;
        seenArrangements.add(key);
      } else {
        if (askedPositions.has(item.askPosition)) continue;
        const answer = item.answerText.toLowerCase();
        const answeredSet = item.responseClass === 'ordinal_word'
          ? spokenOrdinals
          : namedCharacters;
        if (answeredSet.has(answer)) continue;
        askedPositions.add(item.askPosition);
        answeredSet.add(answer);
      }

      seenIds.add(item.id);
      items.push(item);
      kept++;
    }
    if (kept === 0) dropped++;
  }
  return { items, droppedChallenges: dropped };
};

// ============================================================================
// The spoken surface
// ============================================================================

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** "the Fox and the Bear" — everything on screen, listed. */
const namedList = (names: readonly string[]): string => {
  const withArticles = names.map((n) => `the ${n}`);
  if (withArticles.length <= 1) return withArticles[0] ?? '';
  return `${withArticles.slice(0, -1).join(', ')} and ${withArticles[withArticles.length - 1]}`;
};

/** The counted walk, in ORDINALS — the model a Direction-A correction gives. */
const ordinalWalk = (upTo: number): string =>
  Array.from({ length: upTo }, (_, i) => ordinalWordFor(i + 1)).join(', ');

/** The counted walk, in CARDINALS — the first half of the cardinal/ordinal
 *  contrast every `ordinal_word` correction teaches. */
const cardinalWalk = (upTo: number): string =>
  Array.from({ length: upTo }, (_, i) => numberWordFor(i + 1)).join(', ');

/**
 * How-to-play — spoken on the OPENER and whenever the ACTION changes, never per
 * item. The `leadInFor` ladder every pack copies speaks per item and therefore
 * recites; DISTAR fades the model rather than re-reading it.
 *
 * ⚠️ NOTHING HERE MAY CONTAIN AN ORDINAL WORD. On three of the five modes the
 * answer IS an ordinal word, so a friendly "let us find who is first, second
 * and third!" would speak the answer inside the how-to-play before the ask —
 * word-builder's `collidesWithSpokenFrame` finding, in this pack's vocabulary.
 * The greeting is under the same rule.
 */
export const howToPlayFor = (item: OrdinalLineItem): string => {
  switch (item.kind) {
    case 'identify':
      return item.direction === 'name_character'
        ? 'Look at the line, then say the name of the one I ask for. '
        : 'Find the one I name, then say its place out loud. ';
    case 'match':
      return 'I will show you one card at a time. Read it out loud. ';
    case 'relative_position':
      return 'Look at the line, then say the name of the one I ask for. ';
    case 'sequence_story':
      return 'Listen to the whole story, then say the place I ask about. ';
    case 'build_sequence':
      return 'Touch the pictures one at a time to put them in their places. '
        + 'When you stop, I will look at your line. ';
  }
};

/**
 * The ask — code-owned at every band, and it STATES ITS PROBLEM ALOUD because a
 * pre-reader cannot read the names printed under the line or the label on the
 * end of it. Every line-reading ask names the FRONT (finding 4), which is also
 * what stops consecutive same-mode asks from being byte-identical recitation.
 *
 * `match` is the one invariant ask, and it is deliberately SHORT (six words):
 * that mode may name nothing on screen, because the symbol IS the answer, so
 * the repeat is a DI signal rather than a block the child listens through.
 */
export const askFor = (item: OrdinalLineItem): string => {
  const front = frontOf(item.context);
  switch (item.kind) {
    case 'identify':
      return item.direction === 'name_character'
        ? `Start counting at ${front}. Who is ${ordinalWordFor(item.askPosition)}?`
        : `Start counting at ${front}. What place is the ${item.lineNames[item.askPosition - 1]} in?`;
    case 'match':
      return 'Look at the card. What does it say?';
    case 'relative_position':
      return `Start counting at ${front}. `
        + `Who is right ${item.relativeQuery} the ${ordinalWordFor(item.askPosition)} one?`;
    case 'sequence_story':
      return `Listen. ${item.storyText} What place is the ${item.storyName} in?`;
    case 'build_sequence':
      return `Put them in their places. `
        + `${item.clues.map((c) => `The ${c.name} goes ${ordinalWordFor(c.position)}.`).join(' ')} `
        + `Touch them one at a time.`;
  }
};

/**
 * The span of the ask inside which the answer may legitimately appear.
 *
 * ONLY the story needs one, and that is a property of the direction fork rather
 * than luck: Direction A names the ordinal and wants a NAME, Direction B names
 * the character and wants an ORDINAL, `relative_position` names an anchor and
 * wants a neighbour, and `match` names nothing at all. The story's own stimulus
 * states every character's place by construction — that IS the task, a
 * listening task — so the exempt span is the story and nothing else: a leak in
 * the greeting, the how-to-play or the hand-over is still a leak.
 */
export const leakExemptSpanFor = (item: OrdinalLineItem): string | undefined =>
  item.kind === 'sequence_story' ? item.storyText : undefined;

// ── Verdict lines ───────────────────────────────────────────────────────────

const affirmFor = (item: OrdinalLineItem): string => {
  switch (item.kind) {
    case 'identify':
      return `Yes, the ${item.lineNames[item.askPosition - 1]} is ${ordinalWordFor(item.askPosition)}.`;
    case 'match':
      return `Yes, that card says ${item.answerText}.`;
    case 'relative_position': {
      const idx = item.relativeQuery === 'before' ? item.askPosition - 2 : item.askPosition;
      return `Yes, the ${item.lineNames[idx]} is right ${item.relativeQuery} `
        + `the ${ordinalWordFor(item.askPosition)} one.`;
    }
    default:
      return `Yes, the ${item.storyName} is ${item.answerText}.`;
  }
};

/**
 * Standing gate 3: open "My turn:", re-model, then re-elicit. The re-ask
 * inherits the WHOLE problem, because the child cannot read any of it.
 *
 * ⭐ THE COUNTING WALK LIVES HERE AND ONLY HERE. It is the scaffold the click
 * era printed under every character (finding 1) and the one thing that actually
 * teaches the skill, so it is EARNED rather than given — DISTAR's placement.
 *
 * ⭐ AND THE ORDINAL MODES TEACH THE CARDINAL CONTRAST IN IT, because "three"
 * for "third" is their signature error: the walk runs in CARDINALS, lands, and
 * then names the ordinal, so the child hears the two words attached to the same
 * count in the same breath.
 */
const correctionFor = (item: OrdinalLineItem): string => {
  const front = frontOf(item.context);
  switch (item.kind) {
    case 'identify': {
      const pos = item.askPosition;
      const name = item.lineNames[pos - 1];
      const ordinal = ordinalWordFor(pos);
      if (item.direction === 'name_character') {
        return `My turn: I start at ${front} and count — ${ordinalWalk(pos)}. `
          + `The ${name} is ${ordinal}. `
          + `Your turn. Who is ${ordinal}?`;
      }
      return `My turn: I start at ${front} and count — ${cardinalWalk(pos)}. `
        + `${cap(numberWordFor(pos))} tells how many; ${ordinal} tells which one. `
        + `The ${name} is ${ordinal}. `
        + `Your turn. What place is the ${name} in?`;
    }
    case 'match':
      return `My turn: I count up to this card — ${cardinalWalk(item.askPosition)}. `
        + `${cap(numberWordFor(item.askPosition))} tells how many; `
        + `${item.answerText} tells which one. This card says ${item.answerText}. `
        + `Your turn. What does it say?`;
    case 'relative_position': {
      const idx = item.relativeQuery === 'before' ? item.askPosition - 2 : item.askPosition;
      return `My turn: I start at ${front} and count — ${ordinalWalk(item.askPosition)}. `
        + `That is the ${item.lineNames[item.askPosition - 1]}. `
        + `The one right ${item.relativeQuery} is the ${item.lineNames[idx]}. `
        + `Your turn. Who is right ${item.relativeQuery} the ${ordinalWordFor(item.askPosition)} one?`;
    }
    default:
      return `My turn: listen again. ${item.storyText} `
        + `So the ${item.storyName} is ${item.answerText}. `
        + `Your turn. What place is the ${item.storyName} in?`;
  }
};

/**
 * The refuse clause and the accept clause — both halves load-bearing.
 *
 * The signature error per mode is the fluent, confident miss a tap surface used
 * to absorb silently, and on this primitive both of them were already written
 * down in the catalog's own `commonStruggles` rows: counting from the wrong end,
 * and the cardinal said for the ordinal.
 */
const discriminationFor = (item: OrdinalLineItem): string => {
  const n = item.lineNames.length;
  const back = backOf(item.context);
  const accepted = ACCEPT_ORDINAL;

  switch (item.kind) {
    case 'identify': {
      const wrongPos = signatureWrongPosition(n, item.askPosition);
      const wrongEnd = signatureIsWrongEnd(n, item.askPosition);
      const why = wrongEnd
        ? `a learner who counts from ${back} instead of the front lands there and says it without hesitating`
        : `a learner who is one off in the count lands there and says it without hesitating`;
      if (item.direction === 'name_character') {
        const wrongName = item.lineNames[wrongPos - 1] ?? '';
        return (wrongPos ? `"${wrongName}" is the confident wrong answer here — ${why}. ` : '')
          + `Accept the name on its own, or any words that name ONLY the `
          + `${item.lineNames[item.askPosition - 1]} — a different word for the same animal counts. `
          + `A pointing word with no name — "that one", "this one" — does not answer this question, `
          + `so treat it as wrong and give the correction, which asks for the name again. `;
      }
      const wrongOrdinal = wrongPos ? ordinalWordFor(wrongPos) : '';
      return (wrongPos ? `"${wrongOrdinal}" is the confident wrong answer here — ${why}. ` : '')
        + CARDINAL_REFUSAL(item.askPosition, item.answerText)
        + accepted(item.answerText);
    }
    case 'match':
      return CARDINAL_REFUSAL(item.askPosition, item.answerText)
        + `Reading the digit off the card — saying the number and then stopping — is the same miss. `
        + accepted(item.answerText);
    case 'relative_position': {
      const anchorName = item.lineNames[item.askPosition - 1];
      const idx = item.relativeQuery === 'before' ? item.askPosition - 2 : item.askPosition;
      const otherSide = item.relativeQuery === 'before' ? item.askPosition : item.askPosition - 2;
      const otherName = item.lineNames[otherSide] ?? '';
      return `"${anchorName}" is the confident wrong answer here — that is the one the question `
        + `POINTS AT, and a learner who finds it and stops names it quickly and surely. `
        + (otherName && otherName !== anchorName
          ? `"${otherName}" is the same miss from the other side: it is next to the right place but on the wrong side of it. `
          : '')
        + `Accept the name on its own, or any words that name ONLY the ${item.lineNames[idx]} — `
        + `a different word for the same animal counts. `
        + `A pointing word with no name — "that one", "the next one" — does not answer this question, `
        + `so treat it as wrong and give the correction, which asks for the name again. `;
    }
    default:
      return CARDINAL_REFUSAL(item.askPosition, item.answerText)
        + `Naming a DIFFERENT character's place is the other miss — the story says where each one `
        + `goes, and only the ${item.storyName}'s place answers this question. `
        + accepted(item.answerText);
  }
};

/**
 * ⭐ CARDINAL FOR ORDINAL IS WRONG AND CORRECTED, NEVER LENIENTLY ACCEPTED.
 * It is the misconception these modes exist to teach against — the catalog's own
 * second `commonStruggles` row — so accepting "three" for "third" would affirm
 * the exact confusion the lesson is for. Stated as a REFUSAL with the reason,
 * because a bare "do not accept it" reads as pedantry to a model that can hear
 * the child was close.
 */
const CARDINAL_REFUSAL = (position: number, ordinal: string): string =>
  `"${numberWordFor(position)}" — the counting number on its own — is the OTHER confident wrong `
  + `answer, and it is the mistake this lesson is for: it says how MANY, not which ONE. `
  + `It is WRONG however close it sounds, so give the correction, which is where the difference `
  + `between "${numberWordFor(position)}" and "${ordinal}" gets taught. `;

/**
 * The accept clause for an ordinal answer — the right answer that does not look
 * right. A five-year-old rarely produces the bare word.
 */
const ACCEPT_ORDINAL = (ordinal: string): string =>
  `Accept "${ordinal}" on its own, or inside the child's own phrasing — `
  + `"the ${ordinal} one", "${ordinal} place", "he is ${ordinal}" are all the same answer. `;

/**
 * ⚠️ THE WAIT IS DESCRIBED AS THE TUTOR'S STATE, NEVER AS AN IMPERATIVE — an
 * imperative aimed at the tutor gets PERFORMED (ten-frame voiced "[WAIT
 * silently]" to a child). `findPerformedStageDirections` keeps this structural.
 */
const judgingContract = (item: OrdinalLineItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner `
  + `looks and counts, and their think time is unbounded. `
  + `Never say the answer during their turn and never count the line out loud for them. `
  + `EVERY answer gets exactly one of the two replies below and nothing else — the first wrong `
  + `answer as much as the second. `
  + `The correct answer is "${item.answerText}". `
  + discriminationFor(item)
  + `If the answer is right, say exactly: "${affirmFor(item)}" and stop there — `
  + `add no praise, no encouragement and no mention of what comes next, and never carry on into `
  + `another question or another one of the pictures, even one you can see on the screen. `
  + `If it is wrong, say exactly: "${correctionFor(item)}" and stop there; that correction is the `
  + `whole turn, and it is the SAME line on every wrong answer, including a repeat of the same `
  + `wrong answer — never paraphrase it, never soften it, and never replace it with a hint of your own.`;

/** The gesture contract is a SILENCE contract: nothing to judge until the
 *  commit is described, and the arrangement is banned from the tutor's mouth
 *  for the whole item. */
const silenceContract = (): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers with their HANDS on `
  + `the screen, not with their voice, so you then stay completely silent. `
  + `Never say which picture goes where, never count the places out loud, and never read their line `
  + `back to them as they touch. Do not narrate what they are doing or fill the pause. `
  + `You will be told what line they made and whether it matches; only then do you speak.`;

/** Named at the end of every contract-carrying cue — it names the exact failure
 *  a drive produced rather than trusting a generic "don't read tags". */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

const contractFor = (item: OrdinalLineItem): string =>
  item.answerKind === 'gesture' ? silenceContract() : judgingContract(item);

// ============================================================================
// Cues
// ============================================================================

export interface OrdinalCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** ⚠️ No ordinal word may appear here — see `howToPlayFor`. */
const GREETING = 'Hi! Time to line up and count! ';

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line, never as a second catalog directive on the same turn). */
export const itemCue = (item: OrdinalLineItem, opts: OrdinalCueOptions = {}): string => {
  const greeting = opts.opening ? GREETING : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  return `[OL_ITEM] Say exactly: "${greeting}${how}${askFor(item)}" ${contractFor(item)} ${NEVER_PERFORM}`;
};

/**
 * The arrangement verdict — THE MATCH IS COMPUTED IN CODE against the clue
 * positions; the tutor is never asked to read the board. Not correctness-gated
 * anywhere upstream: an incomplete line and a reversed one both arrive here and
 * are corrected, which is what makes the item judgeable at all.
 *
 * The correction models the METHOD and never the arrangement — reading the right
 * line back and then asking for it again would not be a task.
 */
export const placementVerdictCue = (
  item: OrdinalLineItem,
  placed: readonly string[],
): string => {
  // ⚠️ THE LINE IS SPARSE, AND COMPACTING IT LIES TO THE TUTOR. A child who
  // fills the first and THIRD place has left a hole; a dense array reports that
  // as the first and SECOND, so the verdict head describes a board that is not
  // on the screen and the Tier-A evidence records the wrong error. Empty places
  // are carried as '' and named, and the match is computed positionally.
  const filled = placed.filter(Boolean);
  const complete = filled.length === item.answerOrder.length
    && placed.length >= item.answerOrder.length;
  const matches = complete
    && item.answerOrder.every((name, i) => placed[i] === name);
  const head =
    `[OL_PLACE] The learner made this line: `
    + `${filled.length ? placed.map((name) => name || 'an empty place').join(', ') : 'nothing'}; `
    + `the correct line is ${item.answerOrder.join(', ')} — that ${matches ? 'MATCHES' : 'does NOT match'}. `;

  if (matches) {
    return `${head}Say exactly: "Yes! Every one is in its own place." Never read bracket tags aloud.`;
  }
  const line = !complete
    ? `My turn: every one gets a place, and we fill them from ${frontOf(item.context)}. `
      + `Your turn — touch all ${item.answerOrder.length} of them.`
    : `My turn: I listen for the place word, then I count to it from ${frontOf(item.context)}. `
      + `Your turn — put them in their places again.`;
  return `${head}Say exactly: "${line}" Never read bracket tags aloud.`;
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward.
 *  It names NOTHING about the item just left — on this pack every item shares
 *  one line of characters, so a closing line that named the answer would very
 *  often name the next item's answer too (word-sorter's move-on leak). */
export const moveOnCue = (
  item: OrdinalLineItem,
  next: OrdinalLineItem | null,
  opts: OrdinalCueOptions = {},
): string => {
  if (!next) {
    return `[OL_MOVE] Say exactly: "Good try! Counting places takes practice — we will look at that one again another day." Then stop.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[OL_MOVE] Say exactly: "Good try! ${how}${askFor(next)}" ${contractFor(next)} ${NEVER_PERFORM}`;
};

export const completeCue = (): string =>
  `[OL_COMPLETE] Say exactly: "What great counting today! You found every place in the line. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear re-speaks the QUESTION, never the answer, and never a hint. On
 *  the story mode this is what REPLACES re-reading a printed story — the whole
 *  ask, story and all, said again. */
export const pronounceCue = (item: OrdinalLineItem): string =>
  `[OL_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}" `
  + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. Never read bracket tags aloud.`;

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY,
 * answer-free by construction. `match` names NO symbol (the symbol is the
 * question and reading it aloud is the answer) and the story names neither its
 * prose nor a place; every branch describes the task's SHAPE, never its value.
 */
export const stimulusFor = (item: OrdinalLineItem): string => {
  const n = item.lineNames.length;
  switch (item.kind) {
    case 'identify':
      return `a line of ${n} pictures, to be counted from ${frontOf(item.context)}`;
    case 'match':
      return `one place-symbol card on its own, waiting to be read`;
    case 'relative_position':
      return `a line of ${n} pictures with one place marked, to be counted from ${frontOf(item.context)}`;
    case 'sequence_story':
      return `the characters of a spoken story, shown out of order`;
    default:
      return `${item.answerOrder.length} empty places and a tray of pictures to put in them`;
  }
};

// ============================================================================
// The cue surface — one source for the component and the DI harness
// ============================================================================

/**
 * Everything ordinal-line ever sends the tutor. `OrdinalLine.tsx` spreads this
 * and adds what only a mounted component can own (status lines, and the
 * `diagnosisObservation` that reads the live board); the drive-plan endpoint
 * builds the identical cues for the headless judged-loop harness.
 */
export const ordinalLinePackBase = (
  items: OrdinalLineItem[],
): JudgedCueSurface<OrdinalLineItem> => ({
  primitiveType: 'ordinal-line',
  activityLine: 'live direct instruction ordinal position practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.kind,
    stimulus: stimulusFor(item),
  }),
});

// ============================================================================
// Harness answer material — what a right and a wrong child sound like
// ============================================================================

export interface OrdinalLineHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  /** Gesture items commit an ARRANGEMENT, not a word — see `placeCueForPlaced`. */
  placed?: { correct: number; wrong: number };
  leakTokens: string[];
  leakExemptSpan?: string | string[];
}

/**
 * The answers a headless student gives on a judged drive. Lives beside the
 * contract it mirrors: `discriminationFor` CLAIMS the judge refuses the
 * wrong-end count and the cardinal-for-ordinal, and this is those claims made
 * testable. Change one, change both.
 */
export const ordinalLineHarnessAnswers = (
  item: OrdinalLineItem,
): OrdinalLineHarnessAnswers => {
  const n = item.lineNames.length;
  const wrongPos = signatureWrongPosition(n, item.askPosition);
  const wrongEnd = signatureIsWrongEnd(n, item.askPosition);
  const wrongEndWhy = wrongEnd
    ? 'the wrong-end count — the line counted from the back, this primitive\'s #1 recorded misconception'
    : 'the off-by-one — one place past the target, the catalog\'s third recorded struggle';

  switch (item.kind) {
    case 'identify': {
      if (item.direction === 'name_character') {
        const wrongName = item.lineNames[wrongPos - 1] ?? item.lineNames[0];
        return {
          correct: item.answerText,
          plainWrong: 'that one',
          signatureWrong: { text: wrongName, why: wrongEndWhy },
          leakTokens: [item.answerText],
        };
      }
      return {
        correct: item.answerText,
        plainWrong: numberWordFor(item.askPosition),
        signatureWrong: { text: ordinalWordFor(wrongPos), why: wrongEndWhy },
        leakTokens: [item.answerText],
      };
    }
    case 'match':
      return {
        correct: item.answerText,
        plainWrong: ordinalWordFor(item.askPosition === 1 ? 2 : 1),
        signatureWrong: {
          text: numberWordFor(item.askPosition),
          why: 'the cardinal said for the ordinal — how many instead of which one, the misconception this mode exists to teach against',
        },
        leakTokens: [item.answerText],
      };
    case 'relative_position': {
      const anchorName = item.lineNames[item.askPosition - 1];
      return {
        correct: item.answerText,
        plainWrong: 'that one',
        signatureWrong: {
          text: anchorName,
          why: 'the anchor itself — the one the question points at, named by a learner who found it and stopped',
        },
        leakTokens: [item.answerText],
      };
    }
    case 'sequence_story':
      return {
        correct: item.answerText,
        plainWrong: ordinalWordFor(item.askPosition === 1 ? 2 : 1),
        signatureWrong: {
          text: numberWordFor(item.askPosition),
          why: 'the cardinal said for the ordinal — how many instead of which one',
        },
        leakTokens: [item.answerText],
        leakExemptSpan: leakExemptSpanFor(item),
      };
    default:
      return {
        correct: `arranged ${item.answerOrder.join(', ')}`,
        plainWrong: `arranged ${[...item.answerOrder].reverse().join(', ')}`,
        placed: { correct: 1, wrong: 0 },
        leakTokens: [],
      };
  }
};

/**
 * Harness-side gesture verdict builder, `DiPortAdapter.gestureVerdictCue`'s
 * one-number shape. THE ENCODING (internal to this module — `placed` values
 * above are produced here and decoded here, nowhere else): 1 = the correct
 * arrangement committed, 0 = the reversed one, which is the wrong-end error
 * arriving through the hands instead of the mouth.
 */
export const placeCueForPlaced = (item: OrdinalLineItem, placed: number): string =>
  placementVerdictCue(item, placed === 1 ? item.answerOrder : [...item.answerOrder].reverse());
