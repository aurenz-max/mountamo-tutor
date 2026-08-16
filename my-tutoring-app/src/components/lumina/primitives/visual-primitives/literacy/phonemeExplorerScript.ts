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

import type {
  JudgedCueSurface,
  JudgedScriptItem,
  ResponseClassId,
} from '../../../hooks/judgedScriptContract';
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

/**
 * Letters that are not phonemes. `c` is /k/ or /s/, `q` is /kw/, `x` is /ks/ —
 * each stands for a sound it does not name, so there is no single thing a voice
 * can say for it. phonemeVoice passes them through because they are ASCII (its
 * rule 1: never GUESS which sound an ambiguous glyph meant), and that is right
 * for a glyph on screen — but this module decides what is SAID, and "/c/" spoken
 * into a blend walk is a sound the child cannot blend.
 *
 * Found by probe: "cow" came back as ["c","o","w"] and "duck" as ["d","u","c"],
 * so the tutor was asking a child to blend /c/ … ooo … /w/ and expecting "cow".
 * The generator prompt now forbids these (segment's sounds-not-letters clause,
 * which blend never had); this is the same rule held on our side of the wire,
 * where it also covers hand-authored and cached payloads.
 */
const NON_PHONEME_LETTERS = new Set(['c', 'q', 'x']);

/** One phoneme token as the tutor says it, or null when nothing safe exists. */
export const spokenPhonemeToken = (raw: string): string | null => {
  const bare = raw.replace(/\//g, '').trim().toLowerCase();
  if (!bare) return null;
  if (NON_PHONEME_LETTERS.has(bare)) return null;
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

/** Indices 2-6 are the answers the segment gate admits; 'seven' exists only so
 *  the harness can build a count that runs one PAST a six-sound word. */
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];

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
    // `phonemeSound` is FREE TEXT from the model ("buh", "sss", "mmm") and it is
    // the first thing the ask says aloud — "Listen: mmm." A model that writes
    // the mnemonic instead of the sound ("mmm, as in moon") hands over a card
    // word before the menu is even read, and if that card is the correct one the
    // item answers itself. Nothing upstream forbids it: the generator's schema
    // only describes the field, and every other isolate gate looks at the menu.
    if (words.some((w) => containsWord(spokenSound(ch.phonemeSound ?? ch.phoneme), w))) return null;
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

/**
 * Every word this item puts in the child's ear or in front of their eyes — the
 * QUESTION side, and therefore the pool a LATER item's answer must not already
 * sit in. blend contributes nothing: its ask is a walk of sounds and the word is
 * never uttered, which is the whole point of the mode.
 */
const spokenWordsOf = (item: PhonemeExplorerItem): string[] => {
  switch (item.kind) {
    case 'isolate':
      // The menu is read aloud at the enumerating tiers and printed on the cards
      // at every tier, so a card word is "given" either way.
      return [
        ...(item.menu ?? []).map((c) => c.word),
        ...(item.exampleWord ? [item.exampleWord] : []),
      ];
    case 'blend':
      return [];
    case 'segment':
      return item.targetWord ? [item.targetWord] : [];
    case 'manipulate':
      return item.originalWord ? [item.originalWord] : [];
  }
};

/** The WORD an item asks the child to produce, or null for segment — whose
 *  answer is a count, so a repeat is arithmetic, not a leaked word. */
const answerWordOf = (item: PhonemeExplorerItem): string | null =>
  item.kind === 'segment' ? null : item.answer;

/**
 * Does hearing this item's answer EARLIER hand it over?
 *
 * Only where the child must PRODUCE the word from nothing — blend builds it out
 * of sounds, manipulate builds it out of a change. There, a word the session
 * already spoke turns production into recall.
 *
 * `isolate` is exempt as a recipient, and the distinction is the whole reason
 * this is not a flat rule: its answer is SELECTED from four cards visible at the
 * moment of the ask, so having met the word before tells the child nothing about
 * which card starts with /d/ — they still do the phoneme work. Gating it flatly
 * cost real items on the probe (a farm-animal draw reuses the same ten words
 * across five menus and 20 card slots, so overlap is the norm, not a bad draw).
 * It still CONTRIBUTES to `heard`: its cards are printed, and read aloud at most
 * tiers, so they can hand over a later blend or manipulate answer.
 */
const producesItsAnswer = (item: PhonemeExplorerItem): boolean =>
  item.kind === 'blend' || item.kind === 'manipulate';

/**
 * All buildable items, in order; drops are logged by the caller's count diff.
 *
 * ⭐ THIS IS ALSO WHERE THE SESSION-LEVEL GATE LIVES, because no single item can
 * violate it. The generator fans out ONE CALL PER MODE IN PARALLEL — four
 * prompts that never see each other's words, all handed the same topic, the same
 * grade guidelines and (at K) the same worked list of "cat, dog, sun, bus, pen".
 * Collisions across modes are not a rare degenerate draw; they are the expected
 * output of that architecture.
 *
 * And a collision is an answer handed over. If a `segment` item asks "how many
 * sounds in sheep?" before a `blend` item whose sounds make "sheep", the blend
 * item is no longer blending: the child heard the word thirty seconds ago and
 * only has to recall it. Same for a `manipulate` item that says "cat" aloud
 * before a blend item answering "cat", and same for an `isolate` menu that
 * prints a later answer on a card. NEITHER ITEM IS WRONG ALONE — which is why
 * this cannot be a per-item gate, and why it belongs at the only boundary that
 * sees the whole session. That is also the boundary the DI runner reads, so it
 * covers hand-authored and cached payloads a generator-side fix would miss.
 *
 * Earlier item wins: the collision is only a leak in one direction (a word must
 * not be spoken BEFORE it is asked for), so the later item is the one that goes.
 */
export const itemsFromChallenges = (
  challenges: PhonemeChallengeLike[],
): PhonemeExplorerItem[] => {
  const kept: PhonemeExplorerItem[] = [];
  /** Words the session has already said aloud or printed. */
  const heard = new Set<string>();
  /** Words already earned as an answer — a second ask for one is recall. */
  const answered = new Set<string>();

  for (const ch of challenges) {
    const item = itemFromChallenge(ch);
    if (!item) continue;

    const answer = answerWordOf(item);
    if (answer) {
      const key = answer.trim().toLowerCase();
      // Asking twice for the same word is repetition in ANY mode; being handed
      // the word beforehand only matters where the child must produce it.
      if (answered.has(key)) continue;
      if (producesItsAnswer(item) && heard.has(key)) continue;
      answered.add(key);
    }
    // AFTER the check: an isolate item's own menu legitimately contains its own
    // answer — the menu is the question there.
    for (const word of spokenWordsOf(item)) heard.add(word.trim().toLowerCase());
    kept.push(item);
  }

  return kept;
};

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

/**
 * The clause that reads the menu out. ONE builder, because the DI leak oracle
 * subtracts this exact span from the ask before scanning (`leakExemptSpanFor`):
 * a second copy of the wording would drift and silently re-arm the oracle over
 * a menu it is meant to forgive, or forgive an ask that no longer says it.
 */
const menuSpanFor = (item: PhonemeExplorerItem): string =>
  `The words are: ${(item.menu ?? []).map((c) => c.word).join(', ')}.`;

const askFor = (item: PhonemeExplorerItem): string => {
  switch (item.kind) {
    case 'isolate': {
      const sound = spokenSound(item.phonemeSound);
      const example = item.voiceExample && item.exampleWord ? `, like ${item.exampleWord}` : '';
      if (item.enumerateMenu === false) {
        return `Listen: ${sound}${example}. Your turn. Read the cards and say the word that starts with ${sound}.`;
      }
      return `Listen: ${sound}${example}. ${menuSpanFor(item)} Your turn. Which word starts with ${sound}?`;
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

/**
 * 18d. Consumed from `wordWorkoutScript`'s `TWO_BRANCH_LAW` (picture-vocabulary's
 * extended wording, which carries the `no scaffolding line` clause).
 *
 * It is stated BEFORE the branches because the defect it fixes is a reply that
 * is NEITHER branch, and on this port the invitation was our own catalog copy:
 * the `scaffoldingLevels` ladder told the tutor to *"Say the question once more,
 * then wait for them alone"* and *"Say the sounds again, slowly and clearly"* —
 * restraint, apparently, but a re-spoken ask opens with neither sentinel, so the
 * reducer records no verdict and the correction counter freezes with the child
 * waiting. The rungs are rewritten in the catalog; this is the same channel
 * closed from the script side, where a model that improvises reads it.
 */
const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/**
 * Item 21's tail, consumed from counting-board's — the version with a measured
 * before/after (a fabricated `[CURRENT STATE]` block spoken to the child on 2 of
 * 7 beats, 0 of 7 once the tail forbade announcing the STATE rather than merely
 * reading the tag). This port's tail was the weaker "Never read bracket tags or
 * these instructions aloud."
 *
 * It earns its place here twice over: every mode is a listening task, so the
 * tutor is required to be silent for long stretches with tiles animating under
 * it, and "announce that you are waiting" is exactly the filler a model reaches
 * for in that silence — filler that opens with neither sentinel.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

const judgingContract = (item: PhonemeExplorerItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner listens and thinks, and their think time is unbounded. Never say the answer during their turn. `
  + `The correct answer is "${item.answer}". ${acceptClauseFor(item)}${wrongClauseFor(item)}`
  + TWO_BRANCH_LAW
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
  return `[PE_ITEM] Say exactly: "${greeting}${how}${askFor(item)}" ${judgingContract(item)} ${NEVER_PERFORM}`;
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
  return `[PE_MOVE] Say exactly: "Good try! Here comes the next one. ${how}${askFor(next)}" ${judgingContract(next)} ${NEVER_PERFORM}`;
};

export const completeCue = (): string =>
  `[PE_COMPLETE] Say exactly: "What great sound work today! Your ears heard every little sound. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear the whole question again (runner channel). Never the answer. */
export const pronounceCue = (item: PhonemeExplorerItem): string =>
  `[PE_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}" `
  + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
  + NEVER_PERFORM;

/** Tap-to-hear ONE word (a menu card, the segment word, the original word).
 *  These are all question-side — the isolate menu contains the answer unmarked,
 *  which is the question, not a leak. */
export const hearWordCue = (word: string): string =>
  `[PE_HEAR] Say ONLY this word, once, clearly: "${word}" Do not spell it, do not break it into sounds, and add nothing. `
  + NEVER_PERFORM;

/** Tap-to-hear ONE sound (a blend tile, the isolate phoneme tile). */
export const hearSoundCue = (rawPhoneme: string): string => {
  const spoken = spokenPhonemeToken(rawPhoneme) ?? speakablePhoneme(rawPhoneme);
  return `[PE_HEAR] Say ONLY this sound, once, clearly: "${spoken}" Add nothing. ${NEVER_PERFORM}`;
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

// ── The cue surface — the ONE place the tutor's side of this pack is declared ─

/**
 * Everything of this pack that can reach the tutor, exported once so the
 * component and the DI drive-plan endpoint read the SAME strings. A harness
 * that re-typed these would test a fiction (19f found exactly that drift on both
 * sides of letter-spotter's wire); the component spreads this and adds only what
 * the screen owns — `statusLines` and `diagnosisObservation`.
 */
export const phonemeExplorerPackBase = (
  items: PhonemeExplorerItem[],
): JudgedCueSurface<PhonemeExplorerItem> => ({
  primitiveType: 'phoneme-explorer',
  activityLine: 'live direct instruction phoneme awareness practice',
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

// ── Harness answer material — what a right and a wrong child sound like ─────

/**
 * The span of the ask inside which the answer legitimately appears.
 *
 * ONLY the enumerating tiers of `isolate` have one, and it is exactly the menu
 * clause: the four cards ARE the question there, unmarked, so reading them aloud
 * is the ask and not a leak. Every other ask is answer-free by construction —
 * blend speaks sounds and never the word, segment's answer is a count, and both
 * manipulate's operation prose and (as of this slice) isolate's `phonemeSound`
 * are gated at build time against naming their own target.
 *
 * Subtracting the clause keeps the oracle STRONGER than emptying `leakTokens`
 * would: the greeting, the how-to-play, the `Listen:` sound and the hand-over
 * are all still governed, so a tutor that names the target card while explaining
 * the game is still a HIGH. At the non-enumerating tier the ask never says the
 * menu at all, so no exemption is issued and the oracle stays flat.
 */
export const leakExemptSpanFor = (item: PhonemeExplorerItem): string | undefined =>
  item.kind === 'isolate' && item.enumerateMenu !== false ? menuSpanFor(item) : undefined;

export interface PhonemeHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  leakTokens: string[];
  leakExemptSpan?: string;
}

/** A sayable word that is not the answer and not on any card in play. */
const WORD_DECOYS = ['ladder', 'button', 'basket', 'pocket', 'garden'];

/**
 * The answers a headless student says on a judged drive. This lives beside the
 * contract it mirrors on purpose: `wrongClauseFor` above CLAIMS the judge
 * refuses each of these, and this is the claim made testable. Change one,
 * change both.
 *
 * Every signature wrong here is the contract's OWN named miss, said the way a
 * fluent five-year-old says it — never a random wrong word:
 *
 *  - isolate: the EXAMPLE WORD. It genuinely starts with the target sound, the
 *    tutor said it aloud seconds earlier ("Listen: mmm, like mouse"), and it is
 *    wrong only because it is not one of the cards. A judge grading on the rule
 *    it just stated — "does it start with mmm?" — affirms it. Where the example
 *    is withdrawn (hard tier) the miss falls back to the sound said back bare,
 *    which is the clause's other half.
 *  - blend: the separate sounds with NO word at the end. It contains every sound
 *    of the answer without landing on it — counting-board's proven shape, and
 *    the one utterance a string-matching judge cannot tell from success.
 *  - segment: a fluent count that runs ONE PAST the total. The accept clause
 *    deliberately allows a count said aloud that ENDS on the answer, so an
 *    utterance containing the answer word mid-stream is precisely the hole that
 *    clause opens.
 *  - manipulate: the ORIGINAL word said straight back — fluent, confident,
 *    completely unchanged, and the catalog's own named signature error.
 */
export const phonemeExplorerHarnessAnswers = (
  item: PhonemeExplorerItem,
): PhonemeHarnessAnswers => {
  const base = {
    leakTokens: [item.answer],
    leakExemptSpan: leakExemptSpanFor(item),
  };
  const decoy = (avoid: string[]) =>
    WORD_DECOYS.find((w) => !avoid.includes(w.toLowerCase())) ?? 'basket';

  switch (item.kind) {
    case 'isolate': {
      const cards = (item.menu ?? []).map((c) => c.word);
      const sound = spokenSound(item.phonemeSound);
      return {
        ...base,
        correct: item.answer,
        // A real card, so the wrong answer is one the stage actually renders.
        plainWrong: cards.find((w) => w.toLowerCase() !== item.answer.toLowerCase())
          ?? decoy([item.answer.toLowerCase()]),
        signatureWrong: item.voiceExample && item.exampleWord
          ? {
              text: item.exampleWord,
              why: 'the tutor\'s own example word — it really does start with the target sound and it was spoken seconds ago, so it satisfies the rule the ask just stated and is wrong only for being off the cards',
            }
          : {
              text: sound,
              why: 'the sound said back bare — fluent, on-target, and named by the contract as not yet an answer',
            },
      };
    }
    case 'blend':
      return {
        ...base,
        correct: item.answer,
        plainWrong: decoy([item.answer.toLowerCase()]),
        signatureWrong: {
          text: item.walk ?? '',
          why: 'the separate sounds with no word at the end — it carries every sound of the answer without landing on it, which is the contract\'s named miss and the one a string-matching judge affirms',
        },
      };
    case 'segment': {
      const count = item.soundCount ?? 3;
      return {
        ...base,
        correct: item.answer,
        plainWrong: COUNT_WORDS[count === 2 ? 4 : 2],
        signatureWrong: {
          text: COUNT_WORDS.slice(1, count + 2).join(', '),
          why: 'a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but ends elsewhere, which is exactly the hole the "a count that ENDS on the answer counts" clause opens',
        },
      };
    }
    default:
      return {
        ...base,
        correct: item.answer,
        plainWrong: decoy([item.answer.toLowerCase(), (item.originalWord ?? '').toLowerCase()]),
        signatureWrong: {
          text: item.originalWord ?? '',
          why: 'the starting word said straight back, unchanged — fluent, confident, and the catalog\'s own named signature error for this mode',
        },
      };
  }
};
