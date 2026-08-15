/**
 * wordWorkoutScript — HAND-AUTHORED judged-loop script for word-workout
 * (SIXTEENTH literacy DI port, and the last of Phase 1; qa/di/BACKLOG.md item
 * 16). The exact wording IS the pedagogy; these lines are authored per pack,
 * never generated. Item CONTENT (the words, the chains, the sentences) stays
 * generator-scoped; this module owns the cue shapes, the build gates, and the
 * judging contracts.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1 — the table picture) ─────────────
 *
 * Word-workout is a CVC DECODING primitive, so the table picture is a teacher
 * with a card in front of one child saying "read it". FOUR OF FIVE ITEM KINDS
 * ARE SPOKEN; one is a tap, and it is a tap because the answer has no spoken
 * form, not because the judge found it hard:
 *
 *   real_word        two printed words, one real and one a pseudoword. The
 *                    child decodes BOTH and SAYS the real one →
 *                    `short_spoken_word`. The queue predicted a tap held back
 *                    by a sentinel collision on "yes"; the challenge never
 *                    carried a yes/no question at all — it carries `realWord`
 *                    and `nonsenseWord`, so the natural answer is the word.
 *                    Saying it is also better pedagogy than pointing at it:
 *                    the child has to decode both to produce one.
 *   picture_tap      the word is printed and the answer is WHICH PICTURE it
 *                    means → `manipulation`. Receptive identification, the
 *                    picture-vocabulary `receptive_match` precedent: naming the
 *                    referent aloud would just echo the printed word, which is
 *                    decoding evidence and not meaning evidence. Pointing at
 *                    the referent is the meaning evidence, so the tap is the
 *                    honest page-work — the unsayable FORM/POSITION shape.
 *   chain_word       one word of a substitution chain, read aloud →
 *                    `short_spoken_word` (di-word-reading's own material).
 *   read_sentence    the decodable sentence read aloud → `sentence_read_aloud`,
 *                    benched by di-sentence-reading at 3-8 words per judged
 *                    utterance. MIN/MAX_SENTENCE_WORDS are IMPORTED from the
 *                    pack that benched them (decodable-reader's rule): a future
 *                    sitting moves the ceiling in exactly one place.
 *   answer_question  the comprehension answer, one word the sentence states →
 *                    `short_spoken_word`. Structurally story-talk's
 *                    who_what_where: the answer is inside the stimulus, which
 *                    is the comprehension task rather than a leak, and the
 *                    harness subtracts the stimulus with `leakExemptSpan`.
 *
 * ONE CHALLENGE IS NOT ONE ITEM. A chain of five words is five judged reads and
 * a sentence is a read PLUS a question (decodable-reader's split, second use).
 * The click era judged neither: `handleChainAdvance` recorded `correct: true,
 * score: 100` for every chain, whatever came out of the child's mouth, and the
 * sentence was "read" by pressing a button called "I Read It!".
 *
 * ── EVERYTHING PRINTED IS DECODED COLD, AND THAT DELETED THREE CHANNELS ────
 *
 * The leak here is the AUDIO channel, not the screen: the words, the chain and
 * the sentence are all printed BECAUSE decoding print is the skill, so what the
 * tutor must never do is say them first. Three click-era affordances did
 * exactly that and are gone:
 *   - the per-card speaker buttons on real-vs-nonsense (`allowPronounce`).
 *     Hearing "cat" beside "zat" decides the item from oral vocabulary with
 *     zero decoding — the costume test, applied to a scaffold.
 *   - the whole-sentence model read (`allowSentenceModelRead`).
 *   - the per-word tap-to-hear inside the sentence, which let a child hear
 *     every word and echo the line back (decodable-reader deleted the same
 *     channel for the same reason).
 * Tap-to-hear survives as the QUESTION side only: what to do, and — for the
 * comprehension item — the question again. Never a word of the print.
 *
 * The one printed thing that is NOT the task is the comprehension ANSWER: it
 * sits inside the sentence the child has just read, so the stage must not
 * highlight it before the affirm, and `stimulusFor` never pushes it.
 *
 * ── WHAT THE SUPPORT TIER STILL BUYS ───────────────────────────────────────
 *
 * `chainCueLevel` is the surviving lever and it now drives TWO channels: the
 * amber changed-letter highlight on screen, and whether the chain correction
 * NAMES what changed. At 'none' — where noticing the change is the task — the
 * correction re-models the word alone. That is the skill's "tier levers that
 * governed improvised tutor turns move into the scripted ask", applied to the
 * one lever whose intent survives the port. The other three tier fields died
 * with the affordances they withdrew (above); the instruction line's fade is
 * now structural — the how-to-play is spoken on the opening and on an action
 * change, and every repeat ask is the short form.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn"), collision-checked by
 * validateJudgedScriptPack in this pack's test file. Because generated words
 * are interpolated into spoken lines, anything opening a sentence with a
 * sentinel is DROPPED at build (`opensWithSentinel`) — and "yes" is itself a
 * CVC-shaped real word a short-e pool can draw, which is why the verdict-word
 * gate is not theoretical here.
 */

import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';
import { judgedAnswerMix, opensWithSentinel, type JudgedCueSurface } from '../../../hooks/judgedScriptContract';
import {
  MAX_SENTENCE_WORDS,
  MIN_SENTENCE_WORDS,
} from '../direct-instruction/diSentenceReadingScript';

/** The benched judged-utterance window, re-exported so the component, the
 *  generator and the tests read the SAME numbers the bench sitting set. */
export { MAX_SENTENCE_WORDS, MIN_SENTENCE_WORDS };
/** Re-exported so the generator imports its build gates from ONE address. */
export { opensWithSentinel };

export type WordWorkoutMode =
  | 'real-vs-nonsense'
  | 'picture-match'
  | 'word-chains'
  | 'sentence-reading';

/** What ONE judged elicitation asks for. A mode expands to one or more. */
export type WordWorkoutItemKind =
  | 'real_word'
  | 'picture_tap'
  | 'chain_word'
  | 'read_sentence'
  | 'answer_question';

export type ChainCueLevel = 'full' | 'highlight-only' | 'none';

export interface WordWorkoutPictureOption {
  word: string;
  emoji: string;
}

export interface WordWorkoutItem extends JudgedScriptItem {
  kind: WordWorkoutItemKind;
  /** The challenge this item came from — the stage groups by it. */
  challengeId: string;

  // real_word
  /** The two words in ON-SCREEN order (deterministic, so speech and print
   *  agree about "the first one" even though naming a position is not an
   *  answer here). */
  pair?: [string, string];
  realWord?: string;
  nonsenseWord?: string;

  // picture_tap
  /** The printed word. NEVER spoken by the tutor and never pushed as runtime
   *  state — reading it is the first half of the task. */
  targetWord?: string;
  options?: WordWorkoutPictureOption[];

  // chain_word
  chain?: string[];
  chainIndex?: number;
  /** Which letter changed from the previous chain word (undefined on the
   *  first word of a chain). */
  changedIndex?: number;
  chainCueLevel?: ChainCueLevel;
  /** First word of a chain — the ask says a new chain is starting. */
  chainStart?: boolean;

  // read_sentence + answer_question
  sentence?: string;
  /** The decodable words of the sentence — the phonics tint, and the leak
   *  tokens the cold read is scanned against. */
  cvcWords?: string[];
  question?: string;
  answerWord?: string;
}

/**
 * The table picture, per item kind. `picture_tap` is the only hands answer and
 * it is the unsayable-referent shape, not a judge workaround — see the fork in
 * the docblock. Written as functions so both directions are PINNED in the test
 * file: a later kind that wanted a gesture would have to change this and be
 * seen doing it.
 */
export const answerKindFor = (kind: WordWorkoutItemKind): 'voice' | 'gesture' =>
  kind === 'picture_tap' ? 'gesture' : 'voice';

/** Standing gate 1: the benched class each answer belongs to. */
export const responseClassFor = (kind: WordWorkoutItemKind): ResponseClassId => {
  switch (kind) {
    case 'picture_tap':
      return 'manipulation';
    case 'read_sentence':
      return 'sentence_read_aloud';
    default:
      return 'short_spoken_word';
  }
};

// ── Build gates — DROP an unaskable item, never repair it into one ──────────

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface WordWorkoutChallengeLike {
  id: string;
  mode?: WordWorkoutMode;
  realWord?: string;
  nonsenseWord?: string;
  targetWord?: string;
  targetImage?: string;
  distractorImages?: Array<{ word?: string; image?: string }>;
  chain?: string[];
  changedPositions?: number[];
  chainCueLevel?: ChainCueLevel;
  sentence?: string;
  cvcWords?: string[];
  sightWords?: string[];
  comprehensionQuestion?: string;
  comprehensionAnswer?: string;
}

/** The question is spoken in one breath and printed beside the sentence. */
export const MAX_QUESTION_CHARS = 120;

/** Words that are their own verdict class. "yes" is CVC-shaped and a short-e
 *  pool can draw it, so this gate is load-bearing rather than defensive. */
const VERDICT_WORDS: ReadonlySet<string> = new Set(['yes', 'yeah', 'no', 'nope']);

/** Printed/spoken form. A stray `"` would close the `Say exactly: "…"` span. */
export const sanitize = (raw: string): string =>
  (raw ?? '').replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();

const cap = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const stripEnd = (value: string): string => value.replace(/[.!?]+$/, '').trim();

const asQuestion = (value: string): string =>
  /[.!?]$/.test(value.trim()) ? value.trim() : `${value.trim()}?`;

const ensureStop = (value: string): string =>
  /[.!?]$/.test(value.trim()) ? value.trim() : `${value.trim()}.`;

export const wordsIn = (text: string): number =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

/** No blank markers and no bracket tags — both get read aloud, and a bracket
 *  tag is the shape the model has been proven to fabricate control messages
 *  from (letter-spotter's `[LSP_TAP]`). */
const isSpeakable = (text: string): boolean =>
  text.trim().length > 0 && !/[_[\]{}]/.test(text);

/**
 * Common CVC words a five-year-old could know — the "is this actually a
 * nonsense word" oracle, and the ONE thing the live probe proved the model
 * cannot be trusted with (2026-08-14 run: it drew "ran"/"pan" and "bag"/"fag"
 * as real/nonsense PAIRS, both of which are two real words, so the ask "which
 * one is a real word?" had two right answers).
 *
 * The criterion is deliberately "a word a K-2 child could know", not "in a
 * dictionary": if the child cannot know it is a word, they cannot answer with
 * it, and the item still has exactly one defensible answer. So "pan" is here
 * and "lat" is not. Used ONLY NEGATIVELY — a word missing from this list is
 * never assumed fake for any other purpose — because a positive requirement
 * would drop good chains over an unlisted rime.
 */
export const COMMON_CVC_WORDS: ReadonlySet<string> = new Set([
  // short a
  'cab', 'dab', 'gab', 'jab', 'lab', 'nab', 'tab',
  'bad', 'dad', 'fad', 'had', 'lad', 'mad', 'pad', 'sad',
  'bag', 'gag', 'hag', 'lag', 'nag', 'rag', 'sag', 'tag', 'wag',
  'bam', 'dam', 'ham', 'jam', 'ram', 'yam',
  'ban', 'can', 'fan', 'man', 'pan', 'ran', 'tan', 'van',
  'cap', 'gap', 'lap', 'map', 'nap', 'rap', 'sap', 'tap', 'yap', 'zap',
  'bat', 'cat', 'fat', 'hat', 'mat', 'pat', 'rat', 'sat', 'vat',
  'fax', 'max', 'tax', 'wax',
  // short e
  'bed', 'fed', 'led', 'red', 'wed',
  'beg', 'keg', 'leg', 'peg',
  'den', 'hen', 'men', 'pen', 'ten',
  'bet', 'get', 'jet', 'let', 'met', 'net', 'pet', 'set', 'vet', 'wet', 'yet',
  'gem', 'hem',
  // short i
  'bib', 'fib', 'rib',
  'bid', 'did', 'hid', 'kid', 'lid', 'rid',
  'big', 'dig', 'fig', 'gig', 'jig', 'pig', 'rig', 'wig', 'zig',
  'dim', 'him', 'rim',
  'bin', 'fin', 'kin', 'pin', 'sin', 'tin', 'win',
  'dip', 'hip', 'lip', 'nip', 'rip', 'sip', 'tip', 'zip',
  'bit', 'fit', 'hit', 'kit', 'lit', 'pit', 'sit', 'wit',
  'fix', 'mix', 'six',
  // short o
  'bob', 'cob', 'gob', 'job', 'lob', 'mob', 'rob', 'sob',
  'cod', 'god', 'nod', 'pod', 'rod', 'sod',
  'bog', 'cog', 'dog', 'fog', 'hog', 'jog', 'log',
  'mom', 'tom',
  'con', 'don', 'son', 'ton', 'won',
  'bop', 'cop', 'hop', 'mop', 'pop', 'top',
  'cot', 'dot', 'got', 'hot', 'jot', 'lot', 'not', 'pot', 'rot', 'tot',
  'box', 'fox',
  // short u
  'cub', 'cup', 'dub', 'hub', 'nub', 'pub', 'rub', 'sub', 'tub',
  'bud', 'cud', 'dud', 'mud',
  'bug', 'dug', 'hug', 'jug', 'lug', 'mug', 'pug', 'rug', 'tug',
  'bum', 'gum', 'hum', 'mum', 'rum', 'sum', 'yum',
  'bun', 'fun', 'gun', 'nun', 'pun', 'run', 'sun',
  'pup', 'sup',
  'bus', 'pus',
  'but', 'cut', 'gut', 'hut', 'jut', 'nut', 'rut',
]);

/**
 * Strings that must never reach a five-year-old, real word or not. The same
 * probe drew "fag" as a nonsense word; a K-2 surface needs this gate whether or
 * not the word is real, and the generator is not the place to enforce it
 * (a prompt is advisory, this is not).
 */
const BLOCKED_WORDS: ReadonlySet<string> = new Set([
  'ass', 'arse', 'cock', 'cum', 'dick', 'fag', 'fuck', 'jizz', 'piss',
  'rape', 'sex', 'shit', 'slut', 'tit', 'tits', 'twat', 'wank',
]);

export const isRealCvcWord = (word: string): boolean =>
  COMMON_CVC_WORDS.has((word ?? '').trim().toLowerCase());

export const isBlockedWord = (word: string): boolean =>
  BLOCKED_WORDS.has((word ?? '').trim().toLowerCase());

/** Does any word of this text sit on the blocklist? */
export const textIsClean = (text: string): boolean =>
  !(text ?? '')
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter(Boolean)
    .some((word) => BLOCKED_WORDS.has(word));

/** One printable, sayable, non-verdict CVC-ish word: 2-5 letters, alphabetic.
 *  Deliberately not a hard CVC regex — chains legitimately run 4-letter words
 *  ("stop"/"step" style pools) and the vowel-scope sanitizer upstream owns
 *  which vowels are in play. What it refuses is junk: digits, spaces, model
 *  deliberation, and the verdict words. */
export const isSayableWord = (word: string): boolean => {
  const w = (word ?? '').trim().toLowerCase();
  return /^[a-z]{2,5}$/.test(w) && !VERDICT_WORDS.has(w) && !BLOCKED_WORDS.has(w);
};

/**
 * Can these two words be told apart BY EAR? The child says one of them out
 * loud, and the judge is handed both, so a pair differing only in its final
 * stop ("cat" / "cak") cannot be honestly scored from audio — that is the one
 * thing that could have blocked this mode, and the generator's own pools do
 * not do it (cat/zat, bed/zeb, pig/zib, dog/zot, bus/zub all change the ONSET).
 *
 * So the gate is the onset: same length, different first letter. Leniency is
 * not the alternative — it would affirm the pseudoword half the time.
 * Exported because the generator runs the same gate on its side of the wire.
 */
export const pairEarSeparable = (real: string, nonsense: string): boolean => {
  const a = (real ?? '').trim().toLowerCase();
  const b = (nonsense ?? '').trim().toLowerCase();
  return a.length === b.length && a.length > 0 && a[0] !== b[0] && a !== b;
};

/** Whole-word contains, case-insensitive ("hat" does not match "that") — the
 *  same predicate on both sides of the wire, so they agree about what "the
 *  answer is in the sentence" means. */
export const containsWord = (haystack: string, word: string): boolean => {
  const escaped = (word ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return false;
  return new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`, 'i').test(haystack ?? '');
};

/** Exactly one character differs, same length — the chain's own rule,
 *  re-checked at the seam it protects rather than trusted from the payload. */
const oneLetterApart = (a: string, b: string): number | null => {
  if (a.length !== b.length) return null;
  let index = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (index >= 0) return null;
    index = i;
  }
  return index < 0 ? null : index;
};

/**
 * One challenge → zero or more judged items. Nothing here backfills: a
 * placeholder in a judged loop becomes a spoken ask the tutor must stand
 * behind, so a broken challenge ships nothing and the session runs shorter.
 */
export const itemsFromChallenge = (ch: WordWorkoutChallengeLike): WordWorkoutItem[] => {
  if (!ch?.id) return [];
  const base = { challengeId: ch.id };

  switch (ch.mode) {
    case 'real-vs-nonsense': {
      const real = sanitize(ch.realWord ?? '').toLowerCase();
      const nonsense = sanitize(ch.nonsenseWord ?? '').toLowerCase();
      if (!isSayableWord(real) || !isSayableWord(nonsense)) return [];
      if (!pairEarSeparable(real, nonsense)) return [];
      // THE PROBE'S FINDING: the "nonsense" word is sometimes a real word
      // ("ran"/"pan"), which gives the ask two right answers. An ambiguous ask
      // is not a harder task, it is a broken one — so the pair ships nothing.
      if (isRealCvcWord(nonsense)) return [];
      if (opensWithSentinel(real) || opensWithSentinel(nonsense)) return [];
      // Deterministic order from the challenge id — the same shuffle the click
      // era used, kept so print and the pack agree on what is where.
      const seed = ch.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const pair: [string, string] = seed % 2 === 0 ? [real, nonsense] : [nonsense, real];
      return [{
        ...base,
        id: ch.id,
        kind: 'real_word',
        answerKind: answerKindFor('real_word'),
        responseClass: responseClassFor('real_word'),
        action: 'real_word',
        pair,
        realWord: real,
        nonsenseWord: nonsense,
      }];
    }

    case 'picture-match': {
      const target = sanitize(ch.targetWord ?? '').toLowerCase();
      const targetImage = sanitize(ch.targetImage ?? '');
      if (!isSayableWord(target) || !targetImage) return [];
      if (opensWithSentinel(target)) return [];
      const distractors = (ch.distractorImages ?? [])
        .map((d) => ({
          word: sanitize(d?.word ?? '').toLowerCase(),
          emoji: sanitize(d?.image ?? ''),
        }))
        .filter((d) => d.word && d.emoji && d.word !== target && isSayableWord(d.word));
      // One distractor is a fair 1-of-2 choice; none is not a choice at all.
      if (distractors.length === 0) return [];
      const options = [{ word: target, emoji: targetImage }, ...distractors];
      const seed = ch.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      for (let i = options.length - 1; i > 0; i--) {
        const j = (seed + i) % (i + 1);
        [options[i], options[j]] = [options[j], options[i]];
      }
      return [{
        ...base,
        id: ch.id,
        kind: 'picture_tap',
        answerKind: answerKindFor('picture_tap'),
        responseClass: responseClassFor('picture_tap'),
        action: 'picture_tap',
        targetWord: target,
        options,
      }];
    }

    case 'word-chains': {
      const chain = (ch.chain ?? []).map((w) => sanitize(w).toLowerCase());
      if (chain.length < 2) return [];
      if (!chain.every((w) => isSayableWord(w) && !opensWithSentinel(w))) return [];
      const changed: Array<number | undefined> = [undefined];
      for (let i = 1; i < chain.length; i++) {
        const index = oneLetterApart(chain[i - 1], chain[i]);
        // A step that is not a one-letter substitution is not this mode.
        if (index === null) return [];
        changed.push(index);
      }
      const cueLevel = ch.chainCueLevel ?? 'full';
      return chain.map((word, i): WordWorkoutItem => ({
        ...base,
        id: `${ch.id}-w${i + 1}`,
        kind: 'chain_word',
        answerKind: answerKindFor('chain_word'),
        responseClass: responseClassFor('chain_word'),
        action: 'chain_word',
        chain,
        chainIndex: i,
        changedIndex: changed[i],
        chainCueLevel: cueLevel,
        chainStart: i === 0,
      }));
    }

    case 'sentence-reading': {
      const sentence = sanitize(ch.sentence ?? '');
      if (!isSpeakable(sentence) || opensWithSentinel(sentence)) return [];
      if (!textIsClean(sentence)) return [];
      const words = wordsIn(sentence);
      // The BENCHED judged-utterance window — a hard cap, never a knob.
      if (words < MIN_SENTENCE_WORDS || words > MAX_SENTENCE_WORDS) return [];
      const cvcWords = (ch.cvcWords ?? [])
        .map((w) => sanitize(w).toLowerCase())
        .filter((w) => isSayableWord(w) && containsWord(sentence, w));

      const read: WordWorkoutItem = {
        ...base,
        id: `${ch.id}-read`,
        kind: 'read_sentence',
        answerKind: answerKindFor('read_sentence'),
        responseClass: responseClassFor('read_sentence'),
        action: 'read_sentence',
        sentence,
        cvcWords,
      };

      const question = asQuestion(sanitize(ch.comprehensionQuestion ?? ''));
      const answer = sanitize(ch.comprehensionAnswer ?? '').toLowerCase();
      const askable =
        isSpeakable(question)
        && textIsClean(question)
        && question.length <= MAX_QUESTION_CHARS
        && !opensWithSentinel(question)
        && isSayableWord(answer)
        && !opensWithSentinel(answer)
        // The answer must be IN the sentence — the accept clause, the
        // correction and the harness's exempt span are all written against it.
        && containsWord(sentence, answer)
        // …and must not be askable off the question alone.
        && !containsWord(question, answer);

      // A sentence with no askable question is still a real read. The read is
      // never dropped for the question's sake.
      if (!askable) return [read];
      return [read, {
        ...base,
        id: `${ch.id}-q`,
        kind: 'answer_question',
        answerKind: answerKindFor('answer_question'),
        responseClass: responseClassFor('answer_question'),
        action: 'answer_question',
        sentence,
        cvcWords,
        question,
        answerWord: answer,
      }];
    }

    default:
      return [];
  }
};

/** Build the session, dropping what cannot be asked. */
export const itemsFromChallenges = (challenges: WordWorkoutChallengeLike[]): WordWorkoutItem[] =>
  (challenges ?? []).flatMap((ch) => itemsFromChallenge(ch));

/** The generator's side of the same gate — one address, both sides of the wire. */
export const challengeAskable = (ch: WordWorkoutChallengeLike): boolean =>
  itemsFromChallenge(ch).length > 0;

// ── Small helpers the cues and the stage share ──────────────────────────────

/** The word this item is about, for the single-word kinds. */
export const chainWordOf = (item: WordWorkoutItem): string =>
  item.chain?.[item.chainIndex ?? 0] ?? '';

const previousChainWord = (item: WordWorkoutItem): string =>
  (item.chainIndex ?? 0) > 0 ? item.chain?.[(item.chainIndex ?? 0) - 1] ?? '' : '';

const positionLabel = (index: number | undefined, length: number): string => {
  if (index === undefined) return 'first';
  if (index === 0) return 'first';
  if (index === length - 1) return 'last';
  return 'middle';
};

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on action change ─
//
// It names WHAT TO DO for this kind of turn, which is the only thing that
// changes between them. It is NOT recited per item: the runner passes
// `howToPlay` on the opening cue and when the ACTION changes, and every plain
// repeat ask below is the short form (the 2026-08-13 rulings).

export const howToPlayFor = (item: WordWorkoutItem): string => {
  switch (item.kind) {
    case 'real_word':
      return 'I show you two words. One is a real word and one is just silly sounds. You read them both and tell me the real one! ';
    case 'picture_tap':
      return 'I show you a word and some pictures. You read the word, then tap the picture it means! ';
    case 'chain_word':
      return 'Here come words that change by just one letter. You read each one out loud, all by yourself! ';
    case 'read_sentence':
      return 'I show you a little sentence. You read it out loud, all by yourself! ';
    case 'answer_question':
      return 'Now I ask you about the sentence, and you tell me out loud! ';
  }
};

// ── The asks ────────────────────────────────────────────────────────────────
//
// Every ask STATES its problem aloud (a K-2 reader may not be able to read the
// screen, and every correction re-ask inherits the ask) — but never the PRINT,
// which is the stimulus and the target both. The repeat asks are short DI
// signals, not recitations.

export const askFor = (item: WordWorkoutItem): string => {
  switch (item.kind) {
    case 'real_word':
      return 'Your turn. Read them both. Which one is a real word?';
    case 'picture_tap':
      return 'Your turn. Read the word, then tap its picture.';
    case 'chain_word':
      return 'Your turn. Read it.';
    case 'read_sentence':
      return 'Your turn. Read the sentence.';
    case 'answer_question':
      return `Your turn. ${item.question}`;
  }
};

/** A new chain is starting and the screen just re-drew — said only when the
 *  how-to-play is not (it already announces the action). */
const chainLeadFor = (item: WordWorkoutItem): string =>
  item.kind === 'chain_word' && item.chainStart ? 'Here comes a new chain. ' : '';

/**
 * Everything printed here is decoded COLD. The omitted model already withholds
 * it (the tutor may speak only what "Say exactly" quotes), but this makes it
 * explicit per item — the catalog is a second channel that could otherwise
 * read the word aloud, and a guard hidden in an omission is only half applied
 * (di-sentence-reading's tier gotcha).
 */
const coldReadGuard = (item: WordWorkoutItem): string => {
  switch (item.kind) {
    case 'real_word':
      return ' Both words are printed in front of the learner and reading them IS the task: do not say either word, or any part of either word, before they do.';
    case 'picture_tap':
      return ' The word is printed in front of the learner and reading it IS the first half of the task: do not say it, or sound it out, before they answer.';
    case 'chain_word':
      return ' The word is printed in front of the learner and is read cold on purpose: do not say it, or any part of it, before they do.';
    case 'read_sentence':
      return ' The sentence is printed in front of the learner and is read cold on purpose: do not read it, or any part of it, before they do.';
    case 'answer_question':
      return '';
  }
};

// ── Verdict lines ───────────────────────────────────────────────────────────

/** Affirmations open "Yes," (engine sentinel) and ECHO the target, which is
 *  what makes the accept clauses safe: a child who answered inside a phrase
 *  hears the canonical form back as the model. */
export const affirmFor = (item: WordWorkoutItem): string => {
  switch (item.kind) {
    case 'real_word':
      return `Yes, ${item.realWord} is a real word!`;
    case 'picture_tap':
      return `Yes! That word says ${item.targetWord}.`;
    case 'chain_word':
      return `Yes, ${chainWordOf(item)}.`;
    case 'read_sentence':
      return `Yes, that says ${ensureStop(item.sentence ?? '')}`;
    case 'answer_question':
      return `Yes, ${item.answerWord}.`;
  }
};

/**
 * Corrections open "My turn:", re-model, then re-elicit (standing gate 3). The
 * answer is EARNED here — this is the first place the tutor may say the print.
 *
 * Each kind's re-model is the teaching move for ITS skill:
 *  - real_word contrasts the pair, because "which is real" is a discrimination
 *    and modelling only the right word teaches half of it;
 *  - chain_word names what changed — UNLESS the support tier withdrew that cue
 *    on screen, where noticing the change is the task and the tutor would hand
 *    back exactly the scaffold the tier removed;
 *  - answer_question re-reads the sentence the answer came from, which teaches
 *    the looking-back move instead of just handing over a word
 *    (decodable-reader's evidence-line rule).
 */
export const correctionFor = (item: WordWorkoutItem): string => {
  switch (item.kind) {
    case 'real_word':
      return `My turn: ${item.realWord} is a real word. ${cap(item.nonsenseWord ?? '')} is just silly sounds. Your turn. Which one is a real word?`;
    case 'picture_tap':
      return `My turn: this word says ${item.targetWord}. Your turn. Tap the ${item.targetWord}.`;
    case 'chain_word': {
      const word = chainWordOf(item);
      const previous = previousChainWord(item);
      if (!previous || item.chainCueLevel === 'none') {
        return `My turn: ${word}. Your turn. Read it.`;
      }
      const where = positionLabel(item.changedIndex, word.length);
      return `My turn: ${previous}, ${word}. Only the ${where} letter changed. Your turn. Read it.`;
    }
    case 'read_sentence':
      return `My turn: ${ensureStop(item.sentence ?? '')} Your turn. Read it again.`;
    case 'answer_question':
      return `My turn: ${ensureStop(item.sentence ?? '')} ${cap(item.answerWord ?? '')}. Your turn. ${item.question}`;
  }
};

/**
 * Reading correction — CONTRASTIVE, the preferred branch whenever the miss can
 * be localised. Byte-for-byte di-sentence-reading's line, which overturned the
 * plain re-model in the first live correction run in any DI pack: a whole-line
 * re-model asks the learner to diff it against their memory of what they just
 * said, which they cannot do, so they never learn WHICH word was wrong. `⟨…⟩`
 * is a slot the tutor fills from the audio; it is not spoken, and the opener
 * stays "My turn" exactly — classification matches OPENERS only.
 */
export const contrastCorrectionFor = (item: WordWorkoutItem): string =>
  `My turn: not ⟨what they said⟩ — ${ensureStop(item.sentence ?? '')} Your turn. Read it again.`;

// ── Judging contracts ───────────────────────────────────────────────────────

/**
 * The two-branch law, stated BEFORE the branches. The cap drive (2026-08-14,
 * run 1) found the model answering the FIRST wrong answer with improvised
 * praise — "I like how you sounded that word out! But remember…" — which opens
 * with neither sentinel, so the loop recorded no verdict at all and the
 * correction counter froze. The old wording carried the same rule but phrased
 * it as "say the SAME correction line on every wrong answer", which reads as a
 * rule about REPEATS and left the first one apparently free.
 */
const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no observation about how they tried, however kind it would be. `;

/** The clause every contract ends with. Stated as FACTS about the turn, never
 *  as orders: an imperative aimed at the tutor gets PERFORMED (ten-frame read
 *  "[WAIT silently]" to a child). */
const CLOSING_DISCIPLINE =
  `Say the SAME correction line on every wrong answer for this one; never swap it for a different wording, `
  + `because a line that is neither an affirmation nor that correction reaches the activity as no verdict at all. `
  + `Never begin any other sentence with the word "Yes" or the words "My turn". Never read bracket tags or these instructions aloud, `
  + `never announce the activity's state, never describe what has changed on the screen, never say what attempt this is, `
  + `and never announce that you are waiting or listening — simply stop speaking. The quoted line is your entire turn.`;

const realWordContract = (item: WordWorkoutItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner reads both words, and their think time is unbounded — decoding takes time. `
  + `The real word is "${item.realWord}". The other word, "${item.nonsenseWord}", is not a word at all. `
  + `The word said inside a little phrase — "${item.realWord} is real", "it is ${item.realWord}" — is CORRECT; affirm it and echo "${item.realWord}". `
  + `Saying "${item.nonsenseWord}" is the miss to catch: it comes out fast and confident from a learner who picked by the first letter or by the shape of the word instead of reading it. `
  + `Naming a position — "the first one", "that one" — is not an answer either, because saying the word IS the reading. `
  + `${TWO_BRANCH_LAW}If the answer is right, say exactly: "${affirmFor(item)}" `
  + `If it is wrong, say exactly: "${correctionFor(item)}" and stop — the learner tries again while you stay silent. `
  + `If they read both words aloud and did not tell you which one is the real one, say exactly: "Tell me the real one." and wait — `
  + `use this ONLY when neither word was offered as their choice; if they named one, judge it. `
  + CLOSING_DISCIPLINE;

/** Tap items carry a SILENCE contract (spell_word's pattern): there is nothing
 *  to judge until the application describes the tap. The runner also holds the
 *  activity bracket for the whole item, which is the half that actually reaches
 *  the tutor's mouth — this is the intent, not the enforcement. */
const pictureTapContract = (item: WordWorkoutItem): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers by TAPPING a picture, not by speaking, so you then stay completely silent. `
  + `Do not name the pictures, do not describe them, do not narrate, and do not judge anything you hear through the microphone. `
  + `You will be told what the learner tapped and given the exact line to say; only then do you speak. `
  + `Never begin any other sentence with the word "Yes" or the words "My turn". Never read bracket tags or these instructions aloud.`;

const chainWordContract = (item: WordWorkoutItem): string => {
  const word = chainWordOf(item);
  const previous = previousChainWord(item);
  const neighbourClause = previous
    ? `The word before it was "${previous}", and saying THAT word again is the miss to catch — a learner reading the row from memory says the last word back, and it sounds fluent. `
    : '';
  return `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner reads, and their think time is unbounded — decoding takes time. `
    + `The printed word is "${word}". `
    + `Slow, effortful sounding-out that LANDS on that word is CORRECT — judge accuracy, never speed, and a learner who catches and fixes their own slip has read it. `
    + neighbourClause
    + `A different word is a different word, however close it sounds; do not accept a near miss to be kind. `
    + `${TWO_BRANCH_LAW}If they read it right, say exactly: "${affirmFor(item)}" `
    + `If they read a different word, or you cannot make out a word at all, say exactly: "${correctionFor(item)}" and stop — the learner tries again while you stay silent. `
    + CLOSING_DISCIPLINE;
};

const readSentenceContract = (item: WordWorkoutItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner reads, and their think time is unbounded — decoding takes time. `
  + `Judge the audio you heard against the printed sentence "${item.sentence}" read aloud, every word in order.\n`
  + `${TWO_BRANCH_LAW}\n`
  + `- Every word read correctly and in order, including after they catch and fix their own slip: say exactly: "${affirmFor(item)}" and stop.\n`
  + `- A word skipped, added, or read as a DIFFERENT word, and you can tell WHICH words came out wrong: say exactly: "${contrastCorrectionFor(item)}" and stop — the learner tries again while you stay silent. Replace ⟨what they said⟩ with the words they actually read in place of the printed ones — just those words, not the whole sentence ("not the pot", "not ran fast"). Never speak the ⟨ ⟩ marks, and change nothing else in the line. Naming their error is the point of this branch: it is the only way they learn WHICH word to fix.\n`
  + `- Anything else — silence, an unintelligible attempt, or a miss you cannot pin to particular words: say exactly: "${correctionFor(item)}" and stop — the learner tries again while you stay silent.\n`
  + `The commonest miss is a small word swapped for another small word — "the" for "a", "and" for "then". It sounds fluent and it is still wrong. `
  + `The learner may pause in the middle; a pause is part of one reading, so wait for them to finish the whole sentence before judging it. `
  + `If they miss the SAME word again, use the contrast branch again — do not fall back to the plain re-model, and do not invent a third wording. `
  + `Never begin any other sentence with the word "Yes" or the words "My turn". Never read bracket tags or these instructions aloud, `
  + `never announce the activity's state, never describe what has changed on the screen, never say what attempt this is, `
  + `and never announce that you are waiting or listening — simply stop speaking. The quoted line is your entire turn.`;

/**
 * Comprehension. THE ANSWER IS INSIDE THE SENTENCE the learner just read and is
 * still printed in front of them, so the contract cannot carry a flat "never
 * say the answer" about the print — but it CAN about your own mouth, and that
 * is the line that matters: you never say the word, never point at the part of
 * the sentence holding it, and never answer for them.
 *
 * The signature error is the one this task manufactures: a word lifted straight
 * out of the sentence that does not answer the question. It arrives fluent and
 * confident precisely BECAUSE it came from the text.
 */
const answerQuestionContract = (item: WordWorkoutItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner thinks about the sentence, and their think time is unbounded. `
  + `The answer word is printed in the sentence in front of them and finding it there IS the task. What you never do is say it, read the sentence out for them, tell them which part holds it, or answer for them. `
  + `The correct answer is "${item.answerWord}". `
  + `The answer said inside a phrase or a short sentence — "on the ${item.answerWord}" — is CORRECT; affirm it and echo "${item.answerWord}". `
  + `A different word that truly names the same thing is CORRECT too; affirm it and echo "${item.answerWord}". `
  + `A word from the sentence that does NOT answer this question is wrong, however confident it sounds — it sounds right because it came from the sentence, and that is exactly the miss to catch. `
  + `The question said back to you, or the whole sentence read out again, is not an answer either. `
  + `${TWO_BRANCH_LAW}If the answer is right, say exactly: "${affirmFor(item)}" `
  + `If it is wrong, say exactly: "${correctionFor(item)}" and stop — the learner tries again while you stay silent. `
  + CLOSING_DISCIPLINE;

const contractFor = (item: WordWorkoutItem): string => {
  switch (item.kind) {
    case 'real_word':
      return realWordContract(item);
    case 'picture_tap':
      return pictureTapContract(item);
    case 'chain_word':
      return chainWordContract(item);
    case 'read_sentence':
      return readSentenceContract(item);
    case 'answer_question':
      return answerQuestionContract(item);
  }
};

// ── Cues ────────────────────────────────────────────────────────────────────

export interface WordWorkoutCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

const GREETING = 'Hi! Time for a word workout! ';

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line; the catalog only forbids adding to it). */
export const itemCue = (item: WordWorkoutItem, opts: WordWorkoutCueOptions = {}): string => {
  const greeting = opts.opening ? GREETING : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : chainLeadFor(item);
  return `[WW_ITEM] Say exactly: "${greeting}${how}${askFor(item)}"${coldReadGuard(item)} `
    + `${contractFor(item)}`;
};

/**
 * Correction cap reached: acknowledge warmly and carry the lesson forward. A
 * hard item comes back through distributed review, not by drilling a
 * discouraged five-year-old. The close NAMES what the print said — a capped
 * item must not end with the child still not knowing what the word was
 * (picture-vocabulary's closeLine rule).
 */
export const moveOnCue = (
  item: WordWorkoutItem,
  next: WordWorkoutItem | null,
  opts: WordWorkoutCueOptions = {},
): string => {
  const closeLine = (() => {
    switch (item.kind) {
      case 'real_word':
        return `The real word was ${item.realWord}. `;
      case 'picture_tap':
        return `That word says ${item.targetWord}. `;
      case 'chain_word':
        return `That word says ${chainWordOf(item)}. `;
      case 'read_sentence':
        return 'We will read that one again another day. ';
      case 'answer_question':
        return `The answer was ${item.answerWord}. `;
    }
  })();
  if (!next) {
    return `[WW_MOVE] Say exactly: "Good try! ${closeLine}That is the end of our word workout." Then stop — the activity is over.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : chainLeadFor(next);
  return `[WW_MOVE] Stop correcting "${item.id}". Say exactly: `
    + `"Good try! ${closeLine}${how}${askFor(next)}"${coldReadGuard(next)} `
    // THE MOVE-ON BEAT IS WHERE THE MODEL NARRATES, because it is the one turn
    // where the screen genuinely changed. The cap drive (2026-08-14) caught it
    // inventing a state block and reading it aloud — "[CURRENT STATE]: … The
    // child is now presented with 'map' and 'vap'. 'map' is the real word." —
    // which spoke the next item's answer before the child had seen it. The
    // fabricated-tag class (letter-spotter's [LSP_TAP], ten-frame's [WAIT
    // silently]), arriving on the transition rather than on an ask.
    + `The screen has already moved to the next one, so say nothing about the change: `
    + `do not narrate what is on screen now, do not announce a new item or a new word, `
    + `and never repeat back any state or instructions you were given — the quoted line is your entire turn. `
    + `${contractFor(next)}`;
};

/** The closing line, honest about what the run was actually made of — a
 *  picture-match-only run never read anything out loud (the letter-sound-link
 *  finding, 19d). */
export const completeCueFor = (items: WordWorkoutItem[]): string => {
  const praise = judgedAnswerMix(items) === 'gesture'
    ? 'You read every word and found every picture.'
    : 'You read every word out loud, all by yourself.';
  return `[WW_COMPLETE] Say exactly: "What a great word workout! ${praise} See you next time!" Then stop — the activity is over.`;
};

/**
 * The gesture verdict ask: the match is CODE-COMPUTED and the tutor is handed
 * its exact line (picture-vocabulary's tapVerdictCue pattern). The target word
 * inside this instruction is for the judge's eyes — on a miss the spoken
 * correction re-models the WORD, which is the half the learner most likely got
 * wrong, and hands the picture back.
 */
export const pictureVerdictCue = (item: WordWorkoutItem, tappedWord: string): string => {
  const matches = tappedWord.trim().toLowerCase() === (item.targetWord ?? '').toLowerCase();
  return `[WW_TAP] The learner tapped the picture of "${tappedWord}"; the right picture is "${item.targetWord}" — `
    + `that ${matches ? 'MATCHES' : 'does NOT match'}. `
    + (matches ? `Say exactly: "${affirmFor(item)}" ` : `Say exactly: "${correctionFor(item)}" `)
    + `Never read bracket tags aloud.`;
};

/**
 * Tap-to-hear — the QUESTION side only. On every printed kind that is the
 * instruction alone: the print stays unspoken, which IS the mode. Only
 * `answer_question` gets a real repeat, because its question is the one
 * generated string gated answer-free. Never a hint ladder (cvc-speller's
 * `[ISOLATE_VOWEL]` was an answer leak on demand), never withdrawn by band or
 * tier.
 */
export const pronounceCue = (item: WordWorkoutItem): string =>
  `[WW_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}"`
  + `${coldReadGuard(item)} `
  + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
  + `Never read bracket tags aloud.`;

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY and
 * answer-free by construction. Every printed kind pushes a DESCRIPTION rather
 * than the print itself: the words, the chain and the sentence are all read
 * cold, and a state block the model decides to narrate is exactly how item 21
 * leaked an answer in production.
 */
export const stimulusFor = (item: WordWorkoutItem): string => {
  switch (item.kind) {
    case 'real_word':
      return 'two printed words, one real and one made up';
    case 'picture_tap':
      return 'a printed word and the pictures beside it';
    case 'chain_word':
      return 'the word lit up in the chain';
    case 'read_sentence':
      return 'the printed sentence';
    case 'answer_question':
      return item.question ?? '';
  }
};

// ── The exported cue surface — ONE source for component, harness and tests ──

export const wordWorkoutPackBase = (
  items: WordWorkoutItem[],
): JudgedCueSurface<WordWorkoutItem> => ({
  primitiveType: 'word-workout',
  activityLine: 'live direct instruction CVC word reading practice',
  items,
  itemCue,
  moveOnCue,
  completeCue: () => completeCueFor(items),
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.kind,
    stimulus: stimulusFor(item),
  }),
});

// ── Harness answer material — what a right and a wrong child sound like ─────

export interface WordWorkoutHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  tapped?: { correct: string; wrong: string };
  leakTokens: string[];
  leakExemptSpan?: string;
}

/** A plainly wrong answer that is not the target and is nowhere in the print,
 *  so a refusal is about the answer rather than about a word the tutor has
 *  just been shown. */
const PLAIN_WRONG_POOL = ['trombone', 'pineapple', 'walrus'] as const;

const plainWrongFor = (haystack: string, target: string): string =>
  PLAIN_WRONG_POOL.find((word) => word !== target && !containsWord(haystack, word)) ?? 'trombone';

/**
 * Per item kind. The signature wrong is the one each contract CLAIMS the judge
 * refuses, so driving it is what turns that clause from prose into evidence:
 *  - real_word: the pseudoword, said confidently — and the acoustic question
 *    this port owes a mic run (can the judge hear "zat" as not-"cat"?);
 *  - chain_word: the PREVIOUS word of the chain, which is what a learner
 *    reading the row from memory says;
 *  - read_sentence: one small word swapped for another;
 *  - answer_question: a word lifted out of the sentence that does not answer
 *    the question.
 */
export const wordWorkoutHarnessAnswers = (item: WordWorkoutItem): WordWorkoutHarnessAnswers => {
  switch (item.kind) {
    case 'real_word':
      return {
        correct: item.realWord ?? '',
        plainWrong: plainWrongFor(`${item.realWord} ${item.nonsenseWord}`, item.realWord ?? ''),
        signatureWrong: {
          text: item.nonsenseWord ?? '',
          why: 'the pseudoword said confidently — the learner who picked by first letter or word shape instead of reading',
        },
        leakTokens: [item.realWord ?? '', item.nonsenseWord ?? ''].filter(Boolean),
      };

    case 'picture_tap': {
      const wrong = (item.options ?? []).find(
        (option) => option.word !== item.targetWord,
      )?.word ?? '';
      return {
        correct: `tapped ${item.targetWord}`,
        plainWrong: `tapped ${wrong || 'a different picture'}`,
        tapped: { correct: item.targetWord ?? '', wrong },
        leakTokens: [item.targetWord ?? ''].filter(Boolean),
      };
    }

    case 'chain_word': {
      const word = chainWordOf(item);
      const previous = previousChainWord(item);
      return {
        correct: word,
        plainWrong: plainWrongFor((item.chain ?? []).join(' '), word),
        signatureWrong: previous
          ? {
              text: previous,
              why: 'the previous word of the chain — what a learner reading the row from memory says, and it sounds fluent',
            }
          : undefined,
        leakTokens: [word],
      };
    }

    case 'read_sentence': {
      const sentence = item.sentence ?? '';
      return {
        correct: sentence,
        plainWrong: sentence.split(/\s+/).slice(0, -1).join(' ') || 'nothing',
        signatureWrong: /\bthe\b/i.test(sentence)
          ? {
              text: sentence.replace(/\bthe\b/i, 'a'),
              why: 'a small word swapped for another small word — the commonest miss, and it sounds fluent',
            }
          : undefined,
        // The DECODABLE words only. Scanning every word of the line would fire
        // on the ask's own instruction ("read the sentence" shares "the"), but
        // a decodable word appearing in the ask is the tutor reading the line
        // before the child — which is the cold-read violation this mode owes.
        leakTokens: [...(item.cvcWords ?? [])],
      };
    }

    case 'answer_question': {
      const sentence = item.sentence ?? '';
      const answer = item.answerWord ?? '';
      const distractor = (item.cvcWords ?? []).find((w) => w !== answer);
      return {
        correct: answer,
        plainWrong: plainWrongFor(sentence, answer),
        signatureWrong: distractor
          ? {
              text: distractor,
              why: 'a word lifted straight out of the sentence that does not answer the question — fluent because it came from the text',
            }
          : undefined,
        leakTokens: [answer],
        // The sentence is PRINTED, not spoken: the tutor never reads it before
        // the verdict, so nothing is exempt here. (Unlike story-talk, whose
        // stimulus is a read-aloud.)
      };
    }
  }
};
