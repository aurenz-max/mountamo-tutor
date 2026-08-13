/**
 * phonemeExplorerScript — HAND-AUTHORED judged-loop script for phoneme-explorer
 * (sixth literacy DI port, second literacy consumer of useJudgedScriptRunner;
 * qa/di/BACKLOG.md item 16). The exact wording IS the pedagogy; item CONTENT
 * stays generator-scoped. This module owns only the cue shapes and the in-band
 * judging contracts.
 *
 * ALL FOUR MODES GO VERBAL — the 4-choice grid was a costume on every one:
 *  - blend: hearing /k/ /a/ /t/ and TAPPING "cat" among four printed words is
 *    word recognition; SAYING the word is blending. The tiles stay (stimulus,
 *    tap-to-hear); the choices die.
 *  - manipulate: sound-swap's own ruling, arriving in its sibling — changing a
 *    sound in a word you hold in your head is oral end to end. Choices die.
 *  - segment: the child says HOW MANY sounds they hear. The old pick-the-
 *    breakdown options die, and so does the PRINTED word — a child who can
 *    read counts LETTERS, which is exactly the skill this mode is not. The
 *    word arrives by voice (+ picture); the count is a benched number word.
 *  - isolate: stays a closed-set selection ("which of these words starts with
 *    mmm?") but the answer is SPOKEN. The four cards stay on screen as the
 *    MENU — they are the question side, unmarked, so print is not a leak here
 *    — and tapping a card speaks that word (tap-to-hear, never a commit).
 *
 * RESPONSE CLASSES (standing gate 1): isolate/blend/manipulate answers are one
 * short spoken word from a closed per-item set (`short_spoken_word`, benched).
 * segment's answer is a count 2-6 (`number_word_to_20`, benched). Nothing here
 * asks the child to PRODUCE an isolated stop sound — that class is unbenched,
 * and it is why isolate elicits a word rather than the sound itself.
 *
 * PHONEMES IN SPOKEN LINES go through phonemeVoice (family doctrine), with
 * cvc-speller's extra move for bare vowel letters ('a' → "aaa" — a bare 'a'
 * left raw reads as the letter NAME). A blend walk with any unsayable glyph
 * returns null and the ITEM IS DROPPED at build time — blend's ask IS the
 * walk, so there is nothing to degrade to. Segment only degrades (its ask
 * speaks the word; only the correction wants the walk).
 *
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked by
 * validateJudgedScriptPack in this pack's test file.
 */

import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';
import { isSpeakablePhoneme, speakablePhoneme } from './phonemeVoice';

export type PhonemeItemKind = 'isolate' | 'blend' | 'segment' | 'manipulate';

export interface PhonemeMenuCard {
  word: string;
  emoji: string;
}

export interface PhonemeExplorerItem extends JudgedScriptItem {
  kind: PhonemeItemKind;
  /** The spoken answer: menu word (isolate), blended word (blend), count WORD
   *  (segment — "three"), or result word (manipulate). */
  answer: string;
  /** Emoji revealed at affirm (isolate/blend/manipulate). */
  answerEmoji?: string;
  // -- isolate --
  phoneme?: string;
  phonemeSound?: string;
  exampleWord?: string;
  exampleEmoji?: string;
  menu?: PhonemeMenuCard[];
  /** readOptionsAloud: false ⇒ the ask does not enumerate the menu (hard tier
   *  readers read the cards). */
  enumerateMenu?: boolean;
  /** showExampleWord: false ⇒ the ask drops its ", like bear" clause too. */
  voiceExample?: boolean;
  // -- blend --
  phonemeSequence?: string[];
  /** The spoken walk, pre-rendered ("/k/ … aaa … /t/"). Always present on blend. */
  walk?: string;
  // -- segment --
  targetWord?: string;
  targetEmoji?: string;
  segments?: string[];
  soundCount?: number;
  /** The correction's walk; null ⇒ the correction names the count without it. */
  segmentWalk?: string | null;
  // -- manipulate --
  originalWord?: string;
  originalEmoji?: string;
  /** The operation as the tutor SAYS it (phoneme-safe, answer-free — gated). */
  operationSpoken?: string;
}

export const responseClassFor = (kind: PhonemeItemKind): ResponseClassId =>
  kind === 'segment' ? 'number_word_to_20' : 'short_spoken_word';

// ── Speakable helpers ───────────────────────────────────────────────────────

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** di-letter-sounds' short-vowel spellings — a bare vowel LETTER left raw in a
 *  spoken line reads as the letter name (cvc-speller's finding). */
const VOWEL_SPOKEN: Record<string, string> = { a: 'aaa', e: 'eee', i: 'iii', o: 'ooo', u: 'uuu' };

/** One phoneme token as the tutor says it, or null when nothing safe exists. */
export const spokenPhonemeToken = (raw: string): string | null => {
  const bare = raw.replace(/\//g, '').trim().toLowerCase();
  if (!bare) return null;
  if (bare.length === 1 && VOWEL_SPOKEN[bare]) return VOWEL_SPOKEN[bare];
  const slashed = raw.includes('/') ? raw.trim() : `/${bare}/`;
  return isSpeakablePhoneme(slashed) ? speakablePhoneme(slashed) : null;
};

/** The sound-by-sound walk, or null when any token is unsayable. */
export const walkFor = (sequence: string[] | undefined): string | null => {
  if (!sequence || sequence.length === 0) return null;
  const parts = sequence.map(spokenPhonemeToken);
  if (parts.some((p) => p === null)) return null;
  return (parts as string[]).join(' … ');
};

/** Operation prose with any /slash/ phoneme mentions made sayable. Lenient —
 *  an ask cannot be dropped, so unmapped glyphs stay as authored (sound-swap's
 *  fallback rule). */
export const spokenOperation = (description: string): string => {
  const spoken = description
    .trim()
    .replace(/\/[^/\s]+\//g, (m) => spokenPhonemeToken(m) ?? speakablePhoneme(m));
  return /[.!?]$/.test(spoken) ? spoken : `${spoken}.`;
};

/** The sound label as spoken ("buh", "sss" pass through; IPA maps). */
export const spokenSound = (raw: string | undefined): string =>
  raw ? speakablePhoneme(raw.trim()) : '';

const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

// ── Item building — the leak/sayability gates live HERE, not in prose ───────

export interface PhonemeChallengeLike {
  id: string;
  mode: PhonemeItemKind;
  phoneme?: string;
  phonemeSound?: string;
  exampleWord?: string;
  exampleEmoji?: string;
  choices?: Array<{ word: string; emoji: string; correct: boolean }>;
  phonemeSequence?: string[];
  word?: string;
  emoji?: string;
  targetWord?: string;
  targetEmoji?: string;
  segments?: string[];
  originalWord?: string;
  originalEmoji?: string;
  operation?: string;
  operationDescription?: string;
  resultWord?: string;
  resultEmoji?: string;
  showExampleWord?: boolean;
  readOptionsAloud?: boolean;
}

const SAYABLE_WORD = /^[a-z][a-z' -]*$/i;
const isSayableAnswer = (w: string | undefined): w is string =>
  !!w && SAYABLE_WORD.test(w.trim()) && w.trim().toLowerCase() !== 'yes';

const containsWord = (text: string, word: string): boolean =>
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);

/**
 * Build one judged item, or return null to DROP the challenge (an item that
 * cannot be asked or judged honestly ships nothing — never a degraded ask).
 * Drop reasons, per mode:
 *  - isolate: no single correct sayable choice; duplicate menu words; the
 *    example word sitting in the menu (it would be a second right answer or a
 *    printed near-answer).
 *  - blend: unsayable walk (the walk IS the ask), or an unsayable answer word.
 *  - segment: fewer than 2 or more than 6 segments (the count must stay inside
 *    the benched number-word range a K child can produce).
 *  - manipulate: the operation prose CONTAINS the result word (an ask that
 *    says the answer), a missing/unsayable result, or result == original.
 */
export const itemFromChallenge = (ch: PhonemeChallengeLike): PhonemeExplorerItem | null => {
  const base = {
    id: ch.id,
    kind: ch.mode,
    answerKind: 'voice' as const,
    responseClass: responseClassFor(ch.mode),
    action: ch.mode,
  };

  if (ch.mode === 'isolate') {
    const menu = (ch.choices ?? []).map((c) => ({ word: c.word.trim(), emoji: c.emoji }));
    const correct = (ch.choices ?? []).filter((c) => c.correct);
    const words = menu.map((c) => c.word.toLowerCase());
    if (correct.length !== 1 || !isSayableAnswer(correct[0].word)) return null;
    if (new Set(words).size !== words.length) return null;
    if (words.some((w) => !isSayableAnswer(w))) return null;
    if (ch.exampleWord && words.includes(ch.exampleWord.trim().toLowerCase())) return null;
    if (!ch.phonemeSound && !ch.phoneme) return null;
    return {
      ...base,
      answer: correct[0].word.trim(),
      answerEmoji: correct[0].emoji,
      phoneme: ch.phoneme,
      phonemeSound: ch.phonemeSound ?? ch.phoneme,
      exampleWord: ch.exampleWord,
      exampleEmoji: ch.exampleEmoji,
      menu,
      enumerateMenu: ch.readOptionsAloud !== false,
      voiceExample: ch.showExampleWord !== false,
    };
  }

  if (ch.mode === 'blend') {
    const walk = walkFor(ch.phonemeSequence);
    if (!walk || !isSayableAnswer(ch.word)) return null;
    return {
      ...base,
      answer: ch.word!.trim(),
      answerEmoji: ch.emoji,
      phonemeSequence: ch.phonemeSequence,
      walk,
    };
  }

  if (ch.mode === 'segment') {
    const segments = ch.segments ?? [];
    if (!isSayableAnswer(ch.targetWord)) return null;
    if (segments.length < 2 || segments.length > 6) return null;
    return {
      ...base,
      answer: COUNT_WORDS[segments.length],
      targetWord: ch.targetWord!.trim(),
      targetEmoji: ch.targetEmoji,
      segments,
      soundCount: segments.length,
      segmentWalk: walkFor(segments),
    };
  }

  // manipulate
  if (!isSayableAnswer(ch.resultWord) || !isSayableAnswer(ch.originalWord)) return null;
  if (ch.resultWord!.trim().toLowerCase() === ch.originalWord!.trim().toLowerCase()) return null;
  const operationSpoken = spokenOperation(ch.operationDescription ?? '');
  if (!ch.operationDescription || containsWord(operationSpoken, ch.resultWord!.trim())) return null;
  return {
    ...base,
    answer: ch.resultWord!.trim(),
    answerEmoji: ch.resultEmoji,
    originalWord: ch.originalWord!.trim(),
    originalEmoji: ch.originalEmoji,
    operationSpoken,
  };
};

/** All buildable items, in order; drops are logged by the caller's count diff. */
export const itemsFromChallenges = (
  challenges: PhonemeChallengeLike[],
): PhonemeExplorerItem[] =>
  challenges
    .map(itemFromChallenge)
    .filter((item): item is PhonemeExplorerItem => item !== null);

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on mode change ─

export const howToPlayFor = (item: PhonemeExplorerItem): string => {
  switch (item.kind) {
    case 'isolate':
      return 'I say a sound and some words. You say the word that starts with my sound! ';
    case 'blend':
      return 'I say some sounds. You put them together and say the word fast! ';
    case 'segment':
      return 'I say a word. You count the sounds you hear and say how many! ';
    case 'manipulate':
      return 'I say a word, then we change one sound. You say the new word! ';
  }
};

// ── The asks — short, the problem STATED aloud, one defensible answer ───────

const askFor = (item: PhonemeExplorerItem): string => {
  switch (item.kind) {
    case 'isolate': {
      const sound = spokenSound(item.phonemeSound);
      const example = item.voiceExample && item.exampleWord ? `, like ${item.exampleWord}` : '';
      if (item.enumerateMenu === false) {
        return `Listen: ${sound}${example}. Your turn. Read the cards and say the word that starts with ${sound}.`;
      }
      const menu = (item.menu ?? []).map((c) => c.word).join(', ');
      return `Listen: ${sound}${example}. The words are: ${menu}. Your turn. Which word starts with ${sound}?`;
    }
    case 'blend':
      return `Listen: ${item.walk}. Your turn. Say it fast. What word?`;
    case 'segment':
      return `Listen: ${item.targetWord}. Your turn. How many sounds in ${item.targetWord}?`;
    case 'manipulate':
      return `Listen: ${item.originalWord}. ${item.operationSpoken} Your turn. What word?`;
  }
};

// ── Corrections — DISTAR re-model then re-elicit; the answer is EARNED here ─

const correctionFor = (item: PhonemeExplorerItem): string => {
  switch (item.kind) {
    case 'isolate': {
      const sound = spokenSound(item.phonemeSound);
      return `My turn: ${item.answer} starts with ${sound}. ${cap(item.answer)}. Your turn. Which word starts with ${sound}?`;
    }
    case 'blend':
      return `My turn: ${item.walk} … ${item.answer}. ${cap(item.answer)}. Your turn. What word?`;
    case 'segment':
      return item.segmentWalk
        ? `My turn: ${item.targetWord}. ${item.segmentWalk}. ${cap(item.answer)} sounds. Your turn. How many sounds in ${item.targetWord}?`
        : `My turn: ${item.targetWord} has ${item.answer} sounds. Your turn. How many sounds in ${item.targetWord}?`;
    case 'manipulate':
      return `My turn: ${item.originalWord} becomes ${item.answer}. ${cap(item.answer)}. Your turn. What word?`;
  }
};

// ── Judging contracts ───────────────────────────────────────────────────────

const acceptClauseFor = (item: PhonemeExplorerItem): string => {
  switch (item.kind) {
    case 'blend':
      return `Sounding it out slowly and LANDING on "${item.answer}" counts — running the sounds together is the skill. `;
    case 'segment':
      return `Counting the sounds aloud that ENDS on "${item.answer}" counts — the last number says how many. The number alone counts. `;
    default:
      return `The word inside a short phrase counts. `;
  }
};

const wrongClauseFor = (item: PhonemeExplorerItem): string => {
  switch (item.kind) {
    case 'isolate': {
      const sound = spokenSound(item.phonemeSound);
      const example = item.exampleWord
        ? `The word "${item.exampleWord}" is my example, not one of the cards — it is not the answer. `
        : '';
      return `Saying the sound ${sound} back alone is not yet an answer — wait for a word. ${example}A card word with a different first sound is wrong. `;
    }
    case 'blend':
      return `The separate sounds with NO word at the end are not yet an answer — wait for the word. `;
    case 'segment':
      return `Saying the word "${item.targetWord}" back is not an answer. A different number is wrong. `;
    case 'manipulate':
      return `The word "${item.originalWord}" said back is NOT the answer, however confident it sounds. `;
  }
};

const affirmLineFor = (item: PhonemeExplorerItem): string =>
  item.kind === 'segment' ? `Yes, ${item.answer} sounds.` : `Yes, ${item.answer}.`;

const judgingContract = (item: PhonemeExplorerItem): string =>
  `Then WAIT silently — the learner is listening and thinking, and think time is unbounded. Never say the answer during their turn. `
  + `The correct answer is "${item.answer}". ${acceptClauseFor(item)}${wrongClauseFor(item)}`
  + `If the answer is right, say exactly: "${affirmLineFor(item)}" `
  + `If it is wrong, say exactly: "${correctionFor(item)}"`;

// ── Cues ────────────────────────────────────────────────────────────────────

export interface PhonemeCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1). */
export const itemCue = (item: PhonemeExplorerItem, opts: PhonemeCueOptions = {}): string => {
  const greeting = opts.opening ? 'Hi! Time to play with sounds! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  return `[PE_ITEM] Say exactly: "${greeting}${how}${askFor(item)}" ${judgingContract(item)} Never read bracket tags or these instructions aloud.`;
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward. */
export const moveOnCue = (
  item: PhonemeExplorerItem,
  next: PhonemeExplorerItem | null,
  opts: PhonemeCueOptions = {},
): string => {
  if (!next) {
    return `[PE_MOVE] Say exactly: "Good try! Sounds take practice — we will hear that one again another day." Then stop.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[PE_MOVE] Say exactly: "Good try! Here comes the next one. ${how}${askFor(next)}" ${judgingContract(next)} Never read bracket tags aloud.`;
};

export const completeCue = (): string =>
  `[PE_COMPLETE] Say exactly: "What great sound work today! Your ears heard every little sound. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear the whole question again (runner channel). Never the answer. */
export const pronounceCue = (item: PhonemeExplorerItem): string =>
  `[PE_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}" `
  + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. Never read bracket tags aloud.`;

/** Tap-to-hear ONE word (a menu card, the segment word, the original word).
 *  These are all question-side — the isolate menu contains the answer unmarked,
 *  which is the question, not a leak. */
export const hearWordCue = (word: string): string =>
  `[PE_HEAR] Say ONLY this word, once, clearly: "${word}" Do not spell it, do not break it into sounds, and add nothing. Never read bracket tags aloud.`;

/** Tap-to-hear ONE sound (a blend tile, the isolate phoneme tile). */
export const hearSoundCue = (rawPhoneme: string): string => {
  const spoken = spokenPhonemeToken(rawPhoneme) ?? speakablePhoneme(rawPhoneme);
  return `[PE_HEAR] Say ONLY this sound, once, clearly: "${spoken}" Add nothing. Never read bracket tags aloud.`;
};

/** Runtime state pushed through the context channel — question side only.
 *  blend pushes the WALK, never the word; segment pushes the word (the answer
 *  is the count); manipulate's operation prose is gated answer-free. */
export const stimulusFor = (item: PhonemeExplorerItem): string => {
  switch (item.kind) {
    case 'isolate':
      return `${spokenSound(item.phonemeSound)} — cards: ${(item.menu ?? []).map((c) => c.word).join(', ')}`;
    case 'blend':
      return item.walk ?? '';
    case 'segment':
      return item.targetWord ?? '';
    case 'manipulate':
      return `${item.originalWord} — ${item.operationSpoken}`;
  }
};
