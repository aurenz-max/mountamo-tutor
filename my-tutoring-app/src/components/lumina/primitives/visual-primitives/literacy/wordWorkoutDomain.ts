/**
 * word-workout's domain: the build gates, the items, the ask, the spoken key, the scene and the picture check. Pure:
 * the boss (`wordWorkout.boss.ts`), the component, the levers and the generator read it. The tutor teaches in its own
 * words from the boss; nothing here writes a line for it to say.
 *
 * ── WHAT EACH ITEM ASKS FOR ────────────────────────────────────────────────
 *
 * Word-workout is an EARLY DECODING primitive, so the table picture is a teacher with a card in front of one child
 * saying "read it". Every item kind is spoken except picture_tap; that one is a tap because the answer has no spoken
 * form, not because the judge found it hard:
 *
 *   real_word        two printed words, one real and one a pseudoword. The child decodes BOTH and SAYS the real one.
 *                    Saying it is better pedagogy than pointing at it: the child has to decode both to produce one.
 *   picture_tap      the word is printed and the answer is WHICH PICTURE it means. Receptive identification (the
 *                    picture-vocabulary `receptive_match` precedent): naming the referent aloud would just echo the
 *                    printed word, which is decoding evidence and not meaning evidence.
 *   chain_word       one word of a substitution chain, read aloud.
 *   read_sentence    the decodable sentence read aloud, within the benched 3-8 word window. MIN/MAX_SENTENCE_WORDS
 *                    are IMPORTED from the pack that benched them, so the ceiling moves in exactly one place.
 *   answer_question  the comprehension answer, one word the sentence states. The answer is inside the stimulus,
 *                    which is the comprehension task rather than a leak.
 *   read_extended_word
 *                    one code-bounded inflected or compound word, cold-read before its parts are shown.
 *   answer_word_meaning
 *                    a separate comprehension turn, included only when the objective names comprehension.
 *   read_context_word / choose_context_word
 *                    two near-spelled words are read cold one at a time; only then does the sentence appear for a
 *                    separately scored fit.
 *
 * ONE CHALLENGE IS NOT ONE ITEM. A chain of five words is five judged reads and a sentence is a read PLUS a question.
 *
 * ── EVERYTHING PRINTED IS DECODED COLD ─────────────────────────────────────
 *
 * The leak here is the AUDIO channel, not the screen: the words, the chain and the sentence are printed BECAUSE
 * decoding print is the skill, so what the tutor must never do is say them first. The ask never names the print, and
 * the scene's `constraints` says so per item. Tap-to-hear survives as the QUESTION side only. The one printed thing
 * that is NOT the task is the comprehension ANSWER: it sits inside the sentence the child has just read, so the stage
 * must not mark it before the credit.
 *
 * `chainCueLevel` is the support tier's one render lever: the amber changed-letter highlight and the delta chip.
 *
 * Generated words are interpolated into spoken asks, so anything opening with a verdict word ("yes") is DROPPED at
 * build (`opensWithSentinel`); "yes" is itself a CVC-shaped real word a short-e pool can draw.
 */

import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';
import { opensWithSentinel } from '../../../hooks/judgedScriptContract';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import { WORD_WORKOUT_SPOKEN_MISSES, type WordWorkoutMiss } from './wordWorkout.card';
import {
  MAX_SENTENCE_WORDS,
  MIN_SENTENCE_WORDS,
} from '../direct-instruction/diSentenceReadingDomain';
import {
  earlyContextTrialFor,
  earlyExtendedWordFor,
  type EarlyExtendedWordMode,
} from './wordWorkoutEarlyDecoding';

/** The benched judged-utterance window, re-exported so the component, the
 *  generator and the tests read the SAME numbers the bench sitting set. */
export { MAX_SENTENCE_WORDS, MIN_SENTENCE_WORDS };
/** Re-exported so the generator imports its build gates from ONE address. */
export { opensWithSentinel };

export type WordWorkoutMode =
  | 'real-vs-nonsense'
  | 'picture-match'
  | 'word-chains'
  | 'sentence-reading'
  | 'inflected-word'
  | 'compound-word'
  | 'context-discrimination';

/** What ONE judged elicitation asks for. A mode expands to one or more. */
export type WordWorkoutItemKind =
  | 'real_word'
  | 'picture_tap'
  | 'chain_word'
  | 'read_sentence'
  | 'answer_question'
  | 'read_extended_word'
  | 'answer_word_meaning'
  | 'read_context_word'
  | 'choose_context_word';

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

  // inflected-word + compound-word
  wordMode?: EarlyExtendedWordMode;
  decodingParts?: string[];
  meaningSentence?: string;
  acceptedAnswers?: string[];

  // context-discrimination
  contextWords?: [string, string];
  contextSentence?: string;
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
    case 'answer_word_meaning':
    case 'choose_context_word':
      return 'closed_set_choice';
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
  // Early decoding beyond isolated CVC. Content is hydrated from the
  // code-owned pool; Gemini supplies only one of these keys.
  includeMeaning?: boolean;
  contextTrialId?: string;
}

/** The question is spoken in one breath and printed beside the sentence. */
export const MAX_QUESTION_CHARS = 120;

/** Words that are their own verdict class. "yes" is CVC-shaped and a short-e
 *  pool can draw it, so this gate is load-bearing rather than defensive. */
const VERDICT_WORDS: ReadonlySet<string> = new Set(['yes', 'yeah', 'no', 'nope']);

/** Printed/spoken form. A stray `"` would close the `Say exactly: "…"` span. */
export const sanitize = (raw: string): string =>
  (raw ?? '').replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();

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

const SIMPLE_CVC_SOUNDS: Readonly<Record<string, string>> = {
  a: '/a/', b: '/b/', c: '/k/', d: '/d/', e: '/e/', f: '/f/', g: '/g/',
  h: '/h/', i: '/i/', j: '/j/', k: '/k/', l: '/l/', m: '/m/', n: '/n/',
  o: '/o/', p: '/p/', r: '/r/', s: '/s/', t: '/t/', u: '/u/', v: '/v/',
  w: '/w/', y: '/y/', z: '/z/',
};

const simpleCvcModel = (word: string): string[] =>
  word.split('').map((letter) => SIMPLE_CVC_SOUNDS[letter] ?? `/${letter}/`);

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

    case 'inflected-word':
    case 'compound-word': {
      const entry = earlyExtendedWordFor(ch.targetWord ?? '', ch.mode);
      if (!entry || opensWithSentinel(entry.word)) return [];
      const read: WordWorkoutItem = {
        ...base,
        id: `${ch.id}-read`,
        kind: 'read_extended_word',
        answerKind: answerKindFor('read_extended_word'),
        responseClass: responseClassFor('read_extended_word'),
        action: 'read_extended_word',
        targetWord: entry.word,
        wordMode: entry.mode,
        decodingParts: [...entry.decodingParts],
      };
      if (!ch.includeMeaning) return [read];
      return [read, {
        ...base,
        id: `${ch.id}-meaning`,
        kind: 'answer_word_meaning',
        answerKind: answerKindFor('answer_word_meaning'),
        responseClass: responseClassFor('answer_word_meaning'),
        action: 'answer_word_meaning',
        targetWord: entry.word,
        wordMode: entry.mode,
        meaningSentence: entry.meaningSentence,
        question: entry.meaningQuestion,
        answerWord: entry.meaningAnswer,
        acceptedAnswers: [...entry.acceptedMeaningAnswers],
      }];
    }

    case 'context-discrimination': {
      const trial = earlyContextTrialFor(ch.contextTrialId ?? '');
      if (!trial || trial.words.some((word) => opensWithSentinel(word))) return [];
      const contextWords: [string, string] = [trial.words[0], trial.words[1]];
      const reads = contextWords.map((word, index): WordWorkoutItem => ({
        ...base,
        id: `${ch.id}-read-${index + 1}`,
        kind: 'read_context_word',
        answerKind: answerKindFor('read_context_word'),
        responseClass: responseClassFor('read_context_word'),
        action: 'read_context_word',
        targetWord: word,
        decodingParts: simpleCvcModel(word),
        contextWords,
      }));
      return [...reads, {
        ...base,
        id: `${ch.id}-context`,
        kind: 'choose_context_word',
        answerKind: answerKindFor('choose_context_word'),
        responseClass: responseClassFor('choose_context_word'),
        action: 'choose_context_word',
        targetWord: trial.answer,
        answerWord: trial.answer,
        acceptedAnswers: [trial.answer],
        contextWords,
        contextSentence: trial.sentence,
      }];
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

/** Build the session, dropping what cannot be asked. Inflected/compound meaning
 *  checks are deferred until every new word has been cold-read: after the tutor
 *  models one attempted word, the next word is therefore an independent
 *  transfer check rather than an immediate recall of the model. */
export const itemsFromChallenges = (challenges: WordWorkoutChallengeLike[]): WordWorkoutItem[] => {
  const expanded = (challenges ?? []).flatMap((ch) => itemsFromChallenge(ch));
  return [
    ...expanded.filter((item) => item.kind !== 'answer_word_meaning'),
    ...expanded.filter((item) => item.kind === 'answer_word_meaning'),
  ];
};

/** The generator's side of the same gate — one address, both sides of the wire. */
export const challengeAskable = (ch: WordWorkoutChallengeLike): boolean =>
  itemsFromChallenge(ch).length > 0;

// ── Small helpers the ask, the key and the stage share ──────────────────────

/** The word this item is about, for the single-word kinds. */
export const chainWordOf = (item: WordWorkoutItem): string =>
  item.chain?.[item.chainIndex ?? 0] ?? '';

const previousChainWord = (item: WordWorkoutItem): string =>
  (item.chainIndex ?? 0) > 0 ? item.chain?.[(item.chainIndex ?? 0) - 1] ?? '' : '';

/** The catalog eval mode an item belongs to. */
export function wordWorkoutEvalMode(item: Pick<WordWorkoutItem, 'kind' | 'wordMode'>): WordWorkoutEvalMode {
  switch (item.kind) {
    case 'real_word': return 'real_vs_nonsense';
    case 'picture_tap': return 'picture_match';
    case 'chain_word': return 'word_chains';
    case 'read_extended_word': case 'answer_word_meaning': return item.wordMode === 'compound-word' ? 'read_compound' : 'read_inflected';
    case 'read_context_word': case 'choose_context_word': return 'choose_in_context';
    case 'read_sentence': case 'answer_question': return 'sentence_reading';
  }
}
export type WordWorkoutEvalMode = keyof typeof WORD_WORKOUT_SPOKEN_MISSES | 'picture_match';

// ── The ask ─────────────────────────────────────────────────────────────────
//
// Every ask states its problem aloud (a K-2 reader may not read the screen), but never the PRINT, which is the stimulus
// and the target both. The repeat asks are short signals, not recitations.

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
    case 'read_extended_word':
    case 'read_context_word':
      return 'Your turn. Read this word.';
    case 'answer_word_meaning':
      return `Listen: ${ensureStop(item.meaningSentence ?? '')} Your turn. ${item.question}`;
    case 'choose_context_word':
      return `Listen: ${(item.contextSentence ?? '').replace('___', 'blank')} Which word fits the blank?`;
  }
};

/** What the ask says by design: a meaning question's own words ("how many cats") are the question, not its answer. */
export const wordWorkoutGiven = (item: WordWorkoutItem): string[] =>
  item.kind === 'answer_word_meaning' && item.question ? [item.question] : [];

// ── The key ─────────────────────────────────────────────────────────────────

const SOUNDED_OUT = 'Slow sounding-out that lands on the whole word counts, and so does a slip the learner fixes.';

/**
 * The spoken key, or null on a picture tap (the activity checks it; the tutor is never told the word). Each signature
 * error is the wrong answer that arrives fluent and confident: the made-up word, the chain word before, the base
 * alone, the near neighbour, a word lifted from the sentence, a small word swapped.
 */
export function wordWorkoutKey(item: WordWorkoutItem): SpokenKey | null {
  switch (item.kind) {
    case 'picture_tap':
      return null;
    case 'real_word':
      return { answer: item.realWord ?? '', alsoAccept: [],
        acceptRule: `The word inside a little phrase ("${item.realWord} is real") counts.`,
        signatureError: `"${item.nonsenseWord}", the made-up word, is wrong, and so is a position ("the first one") instead of the word.` };
    case 'chain_word': {
      const previous = previousChainWord(item);
      return { answer: chainWordOf(item), alsoAccept: [], acceptRule: SOUNDED_OUT,
        signatureError: previous ? `"${previous}", the word before it in the chain, said again is wrong.` : 'A different word is wrong, however close it sounds.' };
    }
    case 'read_extended_word': {
      const base = item.decodingParts?.[0];
      return { answer: item.targetWord ?? '', alsoAccept: [], acceptRule: SOUNDED_OUT,
        signatureError: base ? `"${base}" alone, without the rest of the word, is wrong.` : 'A different word is wrong.' };
    }
    case 'read_context_word': {
      const neighbour = item.contextWords?.find(word => word !== item.targetWord);
      return { answer: item.targetWord ?? '', alsoAccept: [], acceptRule: SOUNDED_OUT,
        signatureError: neighbour ? `"${neighbour}", the other printed word, is wrong.` : 'A different word is wrong.' };
    }
    case 'read_sentence':
      return { answer: item.sentence ?? '', alsoAccept: [],
        acceptRule: 'Every word read in order; a slip the learner fixes counts, and a pause in the middle is part of one reading.',
        signatureError: 'A skipped, added or changed word is wrong, a small word swapped ("a" for "the") included.' };
    case 'answer_question':
      return { answer: item.answerWord ?? '', alsoAccept: [],
        acceptRule: `The word inside a phrase ("on the ${item.answerWord}") counts, and so does a word that truly names the same thing.`,
        signatureError: 'Another word from the sentence that does not answer the question is wrong, and so is the sentence read out again.' };
    case 'answer_word_meaning': {
      const answer = item.answerWord ?? '';
      return { answer, alsoAccept: (item.acceptedAnswers ?? []).filter(a => a !== answer),
        acceptRule: 'A short phrase or sentence that gives this meaning counts.',
        signatureError: `"${item.targetWord}" read again does not answer the meaning question.` };
    }
    case 'choose_context_word': {
      const other = item.contextWords?.find(word => word !== item.answerWord);
      return { answer: item.answerWord ?? '', alsoAccept: [],
        acceptRule: 'The word inside a phrase counts.',
        signatureError: `"${other}", the word that does not fit, is wrong, and so is reading both words without choosing one.` };
    }
  }
}

/**
 * A spoken item's known wrong answers (handoff 20 Part B). Real or silly: the made-up word said as the real one. The
 * other spoken modes have no saved payload to measure a list against yet.
 */
export function wordWorkoutSpokenMisses(item: WordWorkoutItem): KnownMiss[] {
  if (item.kind !== 'real_word' || !item.realWord || !item.nonsenseWord) return [];
  const real = item.realWord.toLowerCase(), fake = item.nonsenseWord.toLowerCase();
  return [{ id: 'said_nonword', pattern: `The two printed words are "${real}", a real word, and "${fake}", a made-up word. The learner says "${fake}", the made-up one, as the real word.`, examples: [fake] }];
}

// ── The scene ───────────────────────────────────────────────────────────────

/** What is printed, and this item's never-say rule. */
const PRINTED: Record<WordWorkoutItemKind, { printed: string; constraints?: string }> = {
  real_word: { printed: 'Two printed words, one real and one made up.',
    constraints: 'Reading them is the task: do not say either word, or any part of one, before the learner does.' },
  picture_tap: { printed: 'A printed word and pictures beside it.',
    constraints: 'Reading the word is half the task: do not say it, sound it out or name a picture before the learner taps.' },
  chain_word: { printed: 'A chain of printed words that change by one letter; the current one is lit.',
    constraints: 'Do not say the lit word, or any part of it, before the learner does.' },
  read_sentence: { printed: 'A printed sentence.',
    constraints: 'Do not read the sentence, or any part of it, before the learner does.' },
  answer_question: { printed: 'The sentence the learner just read, and a question about it.',
    constraints: 'Do not read the sentence for the learner or say which part of it holds the answer.' },
  read_extended_word: { printed: 'One printed word with an ending or two word parts.',
    constraints: 'Do not say the word, its parts or any sound in it before the learner does.' },
  answer_word_meaning: { printed: 'The word the learner just read, a short sentence and a question about its meaning.' },
  read_context_word: { printed: 'Two similar printed words; the lit one is to be read.',
    constraints: 'Do not say the lit word, its parts or any sound in it before the learner does.' },
  choose_context_word: { printed: 'The two words the learner read and a sentence with a blank.' },
};

export function wordWorkoutScene(item: WordWorkoutItem): SceneOf {
  const { printed, constraints } = PRINTED[item.kind];
  const facts: Record<string, string> = { printed };
  if (item.kind === 'answer_question') facts.question = item.question ?? '';
  if (item.kind === 'choose_context_word') facts.words = (item.contextWords ?? []).join(' or ');
  if (constraints) facts.constraints = constraints;
  return { objects: [], facts };
}

/** What a checked wrong picture tap shows (`WordWorkoutMiss`, in the card). */
export function wordWorkoutMiss(item: WordWorkoutItem, tapped: string): WordWorkoutMiss | undefined {
  const want = (item.targetWord ?? '').toLowerCase(), got = tapped.toLowerCase();
  if (item.kind !== 'picture_tap' || !want || !got || got === want) return undefined;
  if (got[0] === want[0]) return 'same_start';
  if (want.length > 2 && got.slice(-2) === want.slice(-2)) return 'same_end';
  return want.length === 3 && got.length === 3 && got[1] === want[1] ? 'same_vowel' : 'other_word';
}

/** How a picture tap reads to the tutor and the observer: which picture, never the key. */
export const describePictureTap = (word: string) => `Tapped the picture of ${word}.`;

/** What the hear-again button asks the tutor to say: the instruction or question, never the print. */
export const hearQuestionRequest = (item: WordWorkoutItem) => {
  const { constraints } = PRINTED[item.kind];
  return `The learner tapped to hear the question again. Say only this, once: "${askFor(item)}"${constraints ? ` ${constraints}` : ''}`;
};

// ── The harness: what a right and a wrong child sound like ──────────────────

/** A plainly wrong answer that is not the target and is nowhere in the print. */
const PLAIN_WRONG_POOL = ['trombone', 'pineapple', 'walrus'] as const;
const plainWrongFor = (haystack: string, target: string): string =>
  PLAIN_WRONG_POOL.find((word) => word !== target && !containsWord(haystack, word)) ?? 'trombone';

/** The journey's answers: the key's own words, or a plainly different one. Picture match answers by tapping. */
export function wordWorkoutHarnessAnswers(item: WordWorkoutItem): { correct: string; plainWrong: string; tapped?: { correct: string; wrong: string } } {
  switch (item.kind) {
    case 'picture_tap': {
      const wrong = (item.options ?? []).find(option => option.word !== item.targetWord)?.word ?? '';
      return { correct: `tapped ${item.targetWord}`, plainWrong: `tapped ${wrong || 'a different picture'}`,
        tapped: { correct: item.targetWord ?? '', wrong } };
    }
    case 'read_sentence': {
      const sentence = item.sentence ?? '';
      return { correct: sentence, plainWrong: sentence.split(/\s+/).slice(0, -1).join(' ') || 'nothing' };
    }
    case 'answer_word_meaning':
      return { correct: item.answerWord ?? '',
        plainWrong: plainWrongFor(`${item.meaningSentence} ${(item.acceptedAnswers ?? []).join(' ')}`, item.answerWord ?? '') };
    case 'choose_context_word':
      return { correct: item.answerWord ?? '',
        plainWrong: plainWrongFor(`${item.contextSentence} ${(item.contextWords ?? []).join(' ')}`, item.answerWord ?? '') };
    default: {
      const correct = wordWorkoutKey(item)!.answer;
      const print = [item.realWord, item.nonsenseWord, ...(item.chain ?? []), ...(item.contextWords ?? []), item.sentence, item.targetWord]
        .filter(Boolean).join(' ');
      return { correct, plainWrong: plainWrongFor(print, correct) };
    }
  }
}
