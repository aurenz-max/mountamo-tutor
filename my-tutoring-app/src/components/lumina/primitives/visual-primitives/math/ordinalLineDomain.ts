/**
 * ordinalLineDomain — what ordinal-line TEACHES, with no teaching engine attached: the item kinds, the place words,
 * the build gates that turn generator challenges into items (an unaskable challenge is DROPPED, never repaired), the
 * ask, the spoken key and its known misses, the line's own check of a build, the visible scene, and the harness
 * answer material. The boss (`ordinalLine.boss.ts`), the levers and the component read it; the generator imports its
 * gates from it.
 *
 * Why the modes are shaped as they are (moved from the retired scripted pack, 2026-10-20):
 *  - identify is ONE eval mode split by band: at Kindergarten the ask names a place and the learner says WHO is
 *    there; at Grade 1 it names a character and the learner says ITS PLACE, the ordinal vocabulary the standard is
 *    about. Each direction's ask names what the other wants, so neither ask contains its own answer.
 *  - match is ONE printed symbol at a time, read aloud: a word column printed the answer beside the question.
 *  - sequence_story is a listening task: the story is said, never printed, and the ask is about a MIDDLE place
 *    (the first and last are free to a child who heard only one end).
 *  - build_sequence is answered with the hands: the arrangement IS the answer, and at most four clues ship, which is
 *    what a child can hold from speech.
 *  - Every line-reading ask names the FRONT, because counting from the wrong end is the #1 recorded misconception
 *    and a pre-reader cannot read the end labels.
 *  - Positions stay inside first..tenth, character names never state a position ("First-Place Freddie"), and the
 *    names on one line are told apart by ear.
 */

import { opensWithSentinel } from '../../../hooks/judgedScriptContract';
import type { ResponseClassId, TeachingItem } from '../../../hooks/teachingItemContract';
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import { numberWordFor } from './countingBoardDomain';
import { isSayableName, nameCarriesAny, namesEarSeparable, ORDINAL_TOKENS } from './spokenNameGates';
import type { LineMiss } from './ordinalLine.card';

export type { LineMiss, SpokenOrdinalMiss } from './ordinalLine.card';

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
 * Task identity (`TeachingItem.action`). The two `identify` directions get
 * DIFFERENT actions: the child is asked for a different KIND of thing.
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

export interface OrdinalLineItem extends TeachingItem {
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
  /** The challenge's support tier, when the lesson pinned a difficulty (when the model lever comes). */
  supportTier?: SupportTier;
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
  supportTier?: SupportTier;
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
    ...(ch.supportTier ? { supportTier: ch.supportTier } : {}),
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
// The ask
// ============================================================================

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

/** Every place filled. The line is SPARSE: an empty place is carried as ''. */
export const placementComplete = (item: OrdinalLineItem, placed: readonly string[]): boolean =>
  placed.filter(Boolean).length === item.answerOrder.length && placed.length >= item.answerOrder.length;

/** The committed line is the answer line, place by place. The one code check for a build. */
export const placementMatches = (item: OrdinalLineItem, placed: readonly string[]): boolean =>
  placementComplete(item, placed) && item.answerOrder.every((name, i) => placed[i] === name);

// ============================================================================
// Harness answer material — what a right and a wrong child sound like
// ============================================================================

export interface OrdinalLineHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  /** Gesture items commit an ARRANGEMENT, not a word: 1 the clued line, 0 the reversed one. */
  placed?: { correct: number; wrong: number };
  leakTokens: string[];
  leakExemptSpan?: string | string[];
}

/**
 * The answers a headless student gives on a journey: the key's own answer, a
 * plainly wrong one, and the fluent miss the key's `signatureError` names (the
 * wrong-end count, the cardinal for the ordinal, the anchor itself).
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
        leakExemptSpan: item.storyText,
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

// ============================================================================
// The key, the known misses, the line's check, the scene
// ============================================================================

/**
 * The key a spoken item is judged against (`spokenKeyText` writes it); null on a build, which the line checks.
 * Where the answer is a place word, the counting number said alone is not it (it says how many, not which one);
 * where it is a name, a pointing word names no one.
 */
export function ordinalKey(item: OrdinalLineItem): SpokenKey | null {
  if (item.answerKind !== 'voice') return null;
  if (item.responseClass === 'ordinal_word') {
    return { answer: item.answerText, alsoAccept: [],
      acceptRule: `Counting aloud in place words and ending on ${item.answerText} is that answer.`,
      signatureError: `"${numberWordFor(item.askPosition)}", the counting number said alone, is not the answer: it says how many, not which one.` };
  }
  const anchor = item.kind === 'relative_position' ? item.lineNames[item.askPosition - 1] : '';
  return { answer: item.answerText, alsoAccept: [],
    acceptRule: `A count along the line that ends on the ${item.answerText} is that answer.`,
    signatureError: `${anchor ? `The ${anchor}, the one the question names, is not the answer. ` : ''}`
      + 'A pointing word such as "that one" names no one and is not the answer.' };
}

/**
 * A spoken item's known wrong answers, in precedence order, for the `spoken_miss` observer: the counting number for
 * the place word, the line counted from the other end, the one right beside the asked place; on relative_position the
 * anchor itself and the one on its other side.
 */
export function ordinalSpokenMisses(item: OrdinalLineItem): KnownMiss[] {
  if (item.answerKind === 'gesture') return [];
  const k = item.askPosition, names = item.lineNames, n = names.length, front = frontOf(item.context), back = backOf(item.context);
  const ord = ordinalWordFor(k), mirror = n + 1 - k;
  const inLine = (ps: number[]) => ps.filter(p => p >= 1 && p <= n && p !== k);
  const nameAt = (p: number) => names[p - 1];
  const wantsName = item.kind === 'relative_position' || item.kind === 'identify' && item.direction === 'name_character';
  // The line as the observer cannot see it: every place, counted from the front.
  const line = `Counting from ${front}, the line is: ${names.map((name, i) => `${ordinalWordFor(i + 1)} the ${name}`).join(', ')}.`;
  if (item.kind === 'relative_position') {
    const target = item.relativeQuery === 'before' ? k - 1 : k + 1, other = item.relativeQuery === 'before' ? k + 1 : k - 1;
    const asked = `The question asks who is right ${item.relativeQuery} the ${ordinalWordFor(k)} one, the ${nameAt(k)}: that is the ${nameAt(target)}.`;
    return [
      { id: 'said_anchor', pattern: `${line} The question names the ${ordinalWordFor(k)} one, the ${nameAt(k)}, and asks who is right `
        + `${item.relativeQuery} it. The learner's answer is the ${nameAt(k)} itself, the one the question names.`, examples: [nameAt(k)] },
      ...(inLine([other]).length ? [{ id: 'wrong_side', pattern: `${line} ${asked} The learner names the ${nameAt(other)}, who is right `
        + `${item.relativeQuery === 'before' ? 'after' : 'before'} the ${nameAt(k)} instead.`, examples: [nameAt(other)] }] : []),
    ];
  }
  const lineKinds = item.kind === 'identify';
  // The story's places are its clues; a printed card has no line, only the place words one away.
  const beside = (item.kind === 'sequence_story' ? [k - 1, k + 1].filter(p => p >= 1 && p <= item.clues.length)
    : item.kind === 'match' ? [k - 1, k + 1].filter(p => p >= 1 && p <= 10) : inLine([k - 1, k + 1])).filter(p => !(lineKinds && p === mirror));
  const say = (p: number) => wantsName ? `the ${nameAt(p)}` : ordinalWordFor(p);
  const fact = item.kind === 'match' ? `The card shows ${item.symbol}, which is read ${ord}.`
    : item.kind === 'sequence_story' ? `In the story the ${item.storyName} is ${ord}.`
    : wantsName ? `${line} The question asks who is ${ord}: the ${nameAt(k)}.` : `${line} The ${nameAt(k)} is ${ord}.`;
  return [
    ...(wantsName ? [] : [{ id: 'cardinal_for_ordinal', pattern: `${fact} The learner's answer is ${numberWordFor(k)}, the counting number, `
      + 'instead of the place word.', examples: [numberWordFor(k)] }]),
    ...(lineKinds && mirror !== k && mirror >= 1 ? [{ id: 'wrong_end', pattern: `${fact} The learner's answer is ${say(mirror)}, `
      + `${wantsName ? `who is ${ord}` : `the ${nameAt(k)}'s place`} counting from ${back}, the other end.`,
      examples: [wantsName ? nameAt(mirror) : ordinalWordFor(mirror)] }] : []),
    ...(beside.length ? [{ id: 'next_to_place', pattern: `${fact} The learner's answer is ${beside.map(say).join(' or ')}, `
      + `${wantsName ? `who ${beside.length > 1 ? 'are' : 'is'} ${beside.map(p => ordinalWordFor(p)).join(' and ')}` : 'a place word'}, one place away.`,
      examples: beside.map(p => wantsName ? nameAt(p) : ordinalWordFor(p)) }] : []),
  ];
}

/** Does the committed line put every picture in its clued place? Empty places are ''. */
export const lineMatches = placementMatches;

/**
 * What a wrong line shows (`TeachingAttempt.miss`): `place_left_empty` (not every place filled), `reversed` (the whole
 * line from the other end), `two_swapped` (only two pictures out of place), `other_order`. Undefined for a right line
 * and for the spoken kinds.
 */
export function lineMiss(item: OrdinalLineItem | null, placed: readonly string[]): LineMiss | undefined {
  if (!item || item.kind !== 'build_sequence' || placementMatches(item, placed)) return undefined;
  if (!placementComplete(item, placed)) return 'place_left_empty';
  const want = item.answerOrder;
  if (want.every((name, i) => placed[i] === want[want.length - 1 - i])) return 'reversed';
  return want.filter((name, i) => placed[i] !== name).length === 2 ? 'two_swapped' : 'other_order';
}

/** The committed line in the learner's terms, place 1 first. The line is SPARSE: an empty place is named, never compacted. */
export const describeLine = (item: OrdinalLineItem, placed: readonly string[]) => {
  const filled = placed.filter(Boolean).length;
  if (!filled) return 'Placed none of the pictures';
  const places = Array.from({ length: item.answerOrder.length }, (_, i) => placed[i] || 'empty');
  return `Placed ${filled} of ${item.answerOrder.length}, from the first place: ${places.join(', ')}`;
};

/**
 * What the tutor and the observer are shown. The constraints are this primitive's never-say facts the card's moves
 * and the shared doctrine do not already state: on a spoken line a place label is the answer, and the story and the
 * clues are heard, never printed.
 */
export function workspaceScene(item: OrdinalLineItem, view: { placedOrder: readonly string[]; markedPlace?: number }): WorkspaceScene {
  const front = frontOf(item.context);
  const facts = ((): Record<string, string | number> => {
    switch (item.kind) {
      case 'match':
        return { printedCard: item.symbol, constraints: 'Only the symbol is printed, never its word.' };
      case 'sequence_story':
        return { pictured: `${item.clues.map(c => c.name).join(', ')} (shuffled, not in story order)`,
          constraints: 'The story is never printed: the learner hears it only from you, as the task gives it, before answering.' };
      case 'build_sequence':
        return { places: item.answerOrder.length, line: describeLine(item, view.placedOrder),
          constraints: 'The clues are never printed: the learner hears them only from you, as the task gives them. '
            + 'Talk about a part-built line is teaching, not a verdict.' };
      default:
        return { pictured: `${item.lineNames.join(', ')} (from ${front})`, ...(view.markedPlace ? { markedPlace: view.markedPlace } : {}),
          constraints: 'The place labels under the line stay hidden until the answer is credited: here a place label is the answer. '
            + 'Never count the line aloud up to the place asked about.' };
    }
  })();
  return { objects: [], facts: { kind: item.kind, front, ...facts } };
}
