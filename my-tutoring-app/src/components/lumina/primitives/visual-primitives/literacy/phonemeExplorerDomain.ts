/**
 * phoneme-explorer's domain: the items, their gates, the ask, the spoken key, the scene and the harness answers.
 * Pure. The boss (`phonemeExplorer.boss.ts`) and the component read it; the tutor teaches in its own words, so
 * nothing here writes a cue, a correction or a judging contract (those went with the scripted runner, 2026-10-19).
 *
 * ALL SIX MODES GO VERBAL — the 4-choice grid was a costume on every one:
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
 *  - medial: isolate's minimal-pair sibling for the MIDDLE sound (2026-09-05).
 *    The tutor SAYS a CVC word and the child SAYS the card word with the same
 *    middle sound. The stimulus word is NEVER PRINTED — segment's rule for the
 *    same reason one step further in: a child who can read "cat" and "hat" can
 *    match the letter `a` on sight and never hear a vowel. The picture (+ tap-
 *    to-hear) carries it, and only the four cards are print.
 *  - ending: the target and four menu words are heard; every spelling stays
 *    hidden until feedback. The learner says the picture-card word with the
 *    same final phoneme, and the correction emphasizes that final sound.
 *
 * RESPONSE CLASSES (standing gate 1): isolate/ending/medial/blend/manipulate answers
 * are one short spoken word from a closed per-item set (`short_spoken_word`,
 * benched). segment's answer is a count 2-6 (`number_word_to_20`, benched).
 * Nothing here asks the child to PRODUCE an isolated sound — that class is
 * unbenched, and it is why isolate elicits a word rather than the sound itself
 * and why `medial` is a minimal-pair CHOICE rather than "say the middle sound".
 *
 * PHONEMES IN SPOKEN LINES go through phonemeVoice (family doctrine), with
 * cvc-speller's extra move for bare vowel letters ('a' → "aaa" — a bare 'a'
 * left raw reads as the letter NAME). A blend walk with any unsayable glyph
 * returns null and the ITEM IS DROPPED at build time — blend's ask IS the
 * walk, so there is nothing to degrade to. Segment only degrades (its ask
 * speaks the word; only the correction wants the walk).
 */

import type {
  JudgedScriptItem,
  ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { isSpeakablePhoneme, speakablePhoneme } from './phonemeVoice';
import { LETTER_NAME, wordReadingMisses } from './spokenReadingMisses';
import { stableShuffle } from '../../../utils/choiceOrder';

export type PhonemeItemKind = 'isolate' | 'ending' | 'medial' | 'blend' | 'segment' | 'manipulate';

export interface PhonemeMenuCard {
  word: string;
  emoji: string;
}

export interface PhonemeExplorerItem extends JudgedScriptItem {
  kind: PhonemeItemKind;
  /** The spoken answer: menu word (isolate, medial), blended word (blend),
   *  count WORD (segment — "three"), or result word (manipulate). */
  answer: string;
  /** Emoji revealed at affirm (isolate/ending/medial/blend/manipulate). */
  answerEmoji?: string;
  // -- isolate --
  phoneme?: string;
  phonemeSound?: string;
  exampleWord?: string;
  exampleEmoji?: string;
  // -- isolate + ending + medial (closed-set menus answered aloud) --
  menu?: PhonemeMenuCard[];
  /** readOptionsAloud: false ⇒ the ask does not enumerate the menu (hard tier
   *  readers read the cards). */
  enumerateMenu?: boolean;
  /** showExampleWord: false ⇒ the ask drops its ", like bear" clause too. */
  voiceExample?: boolean;
  // -- medial (targetWord/targetEmoji are shared with segment) --
  /** The middle vowel as the tutor SAYS it ("aaa"). CORRECTION-ONLY — naming it
   *  in the ask would turn "same middle sound as cat?" into "which has aaa?",
   *  handing over the extraction step that IS the skill. */
  vowelSpoken?: string;
  // -- ending --
  /** The final phoneme as the tutor says it ("/p/"). Correction/affirmation only. */
  finalPhonemeSpoken?: string;
  // -- blend --
  phonemeSequence?: string[];
  /** The spoken walk, pre-rendered ("/k/ … aaa … /t/"). Always present on blend. */
  walk?: string;
  // -- segment + medial --
  targetWord?: string;
  targetEmoji?: string;
  // -- segment --
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

/**
 * Shuffle every closed-set menu without mutating generator data.
 *
 * The session seed makes a fresh lesson eligible for a fresh layout; item id
 * and menu content keep different questions independent. Because the shuffled
 * items feed both the renderer and the judged script pack, an enumerated menu
 * is always spoken in the same order in which its cards appear.
 */
export const shufflePhonemeMenus = (
  items: readonly PhonemeExplorerItem[],
  sessionSeed: string,
): PhonemeExplorerItem[] => items.map((item) => {
  if (!item.menu || item.menu.length < 2) return item;

  const menu = stableShuffle(
    item.menu,
    `${sessionSeed}|${item.id}|${item.menu.map((card) => card.word.toLowerCase()).join('|')}`,
  );
  return { ...item, menu };
});

export const responseClassFor = (kind: PhonemeItemKind): ResponseClassId =>
  kind === 'segment' ? 'number_word_to_20' : 'short_spoken_word';

/** The kinds whose answer is CHOSEN from an on-screen menu of four cards. */
const isMenuKind = (kind: PhonemeItemKind): boolean =>
  kind === 'isolate' || kind === 'ending' || kind === 'medial';

// ── Speakable helpers ───────────────────────────────────────────────────────

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
  /** medial — the SHORT vowel letter in the middle of targetWord ('a'…'u'). */
  vowel?: string;
  /** ending — the single final consonant phoneme in targetWord. */
  finalPhoneme?: string;
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
 *  - medial: the same menu gates, plus an unsayable/absent middle vowel (the
 *    CORRECTION is built on it and has nothing to degrade to), plus the
 *    STIMULUS WORD sitting in the menu — "cat" on a card when the ask is
 *    "which has the same middle sound as cat" is a card that answers itself.
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

  if (isMenuKind(ch.mode)) {
    const menu = (ch.choices ?? []).map((c) => ({ word: c.word.trim(), emoji: c.emoji }));
    const correct = (ch.choices ?? []).filter((c) => c.correct);
    const words = menu.map((c) => c.word.toLowerCase());
    if (correct.length !== 1 || !isSayableAnswer(correct[0].word)) return null;
    if (new Set(words).size !== words.length) return null;
    if (words.some((w) => !isSayableAnswer(w))) return null;

    if (ch.mode === 'ending') {
      const finalPhonemeSpoken = spokenPhonemeToken(ch.finalPhoneme ?? '');
      if (!finalPhonemeSpoken || !isSayableAnswer(ch.targetWord)) return null;
      // The tutor speaks the target; including it as a card would allow the
      // child to echo the target rather than compare final phonemes.
      if (words.includes(ch.targetWord!.trim().toLowerCase())) return null;
      return {
        ...base,
        answer: correct[0].word.trim(),
        answerEmoji: correct[0].emoji,
        targetWord: ch.targetWord!.trim(),
        targetEmoji: ch.targetEmoji,
        finalPhonemeSpoken,
        menu,
        // Ending words are intentionally hidden on screen before the attempt;
        // the spoken menu is stimulus access and is never tier-withdrawn.
        enumerateMenu: true,
      };
    }

    if (ch.mode === 'medial') {
      // The middle vowel is CORRECTION-ONLY furniture, but the correction is
      // the one place the answer is earned — an item whose vowel cannot be
      // said has no correction to fall back to, so it ships nothing.
      const vowelSpoken = spokenPhonemeToken(ch.vowel ?? '');
      if (!vowelSpoken || !isSayableAnswer(ch.targetWord)) return null;
      // The ask SAYS the stimulus word ("Listen: cat … same middle sound as
      // cat?"). A card carrying that same word is a card the child can answer
      // by repeating what they just heard, without hearing a vowel at all.
      if (words.includes(ch.targetWord!.trim().toLowerCase())) return null;
      return {
        ...base,
        answer: correct[0].word.trim(),
        answerEmoji: correct[0].emoji,
        targetWord: ch.targetWord!.trim(),
        targetEmoji: ch.targetEmoji,
        vowelSpoken,
        menu,
        enumerateMenu: ch.readOptionsAloud !== false,
      };
    }

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
    case 'ending':
      return [
        ...(item.menu ?? []).map((c) => c.word),
        ...(item.targetWord ? [item.targetWord] : []),
      ];
    case 'medial':
      // Same as isolate for the cards, PLUS the stimulus: unlike isolate's
      // phoneme tile, medial's stimulus is a whole word the tutor speaks.
      return [
        ...(item.menu ?? []).map((c) => c.word),
        ...(item.targetWord ? [item.targetWord] : []),
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
 * The three MENU kinds (`isolate`, `ending`, `medial`) are exempt as recipients, and the
 * distinction is the whole reason this is not a flat rule: their answer is
 * SELECTED from four cards visible at the moment of the ask, so having met the
 * word before tells the child nothing about which card starts with /d/ or
 * carries the middle sound — they still do the phoneme work. Gating it flatly
 * cost real items on the probe (a farm-animal draw reuses the same ten words
 * across five menus and 20 card slots, so overlap is the norm, not a bad draw).
 * They still CONTRIBUTE to `heard`: their cards are printed, and read aloud at
 * most tiers, so they can hand over a later blend or manipulate answer.
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

// ── The asks — short, the problem STATED aloud, one defensible answer ───────

/**
 * The clause that reads the menu out. ONE builder, because the DI leak oracle
 * subtracts this exact span from the ask before scanning (`leakExemptSpanFor`):
 * a second copy of the wording would drift and silently re-arm the oracle over
 * a menu it is meant to forgive, or forgive an ask that no longer says it.
 */
const menuSpanFor = (item: PhonemeExplorerItem): string =>
  `The words are: ${(item.menu ?? []).map((c) => c.word).join(', ')}.`;

export const askFor = (item: PhonemeExplorerItem): string => {
  switch (item.kind) {
    case 'isolate': {
      const sound = spokenSound(item.phonemeSound);
      const example = item.voiceExample && item.exampleWord ? `, like ${item.exampleWord}` : '';
      if (item.enumerateMenu === false) {
        return `Listen: ${sound}${example}. Your turn. Read the cards and say the word that starts with ${sound}.`;
      }
      return `Listen: ${sound}${example}. ${menuSpanFor(item)} Your turn. Which word starts with ${sound}?`;
    }
    case 'ending':
      // The final sound is deliberately unnamed until feedback. Extracting it
      // from the target word is the skill, just as in the medial mode.
      return `Listen: ${item.targetWord}. ${menuSpanFor(item)} Your turn. Which word has the same ending sound as ${item.targetWord}?`;
    case 'medial': {
      // The ask NEVER names the vowel. "Which word has aaa in the middle?"
      // hands over the extraction step — pulling the middle sound out of a
      // whole word is the skill; matching a named sound is isolate wearing a
      // different label. The vowel is spoken only in the correction, where the
      // answer is earned.
      if (item.enumerateMenu === false) {
        return `Listen: ${item.targetWord}. Your turn. Read the cards and say the one with the same middle sound as ${item.targetWord}.`;
      }
      return `Listen: ${item.targetWord}. ${menuSpanFor(item)} Your turn. Which word has the same middle sound as ${item.targetWord}?`;
    }
    case 'blend':
      return `Listen: ${item.walk}. Your turn. Say it fast. What word?`;
    case 'segment':
      return `Listen: ${item.targetWord}. Your turn. How many sounds in ${item.targetWord}?`;
    case 'manipulate':
      return `Listen: ${item.originalWord}. ${item.operationSpoken} Your turn. What word?`;
  }
};

// ── The key, the misses and the scene ───────────────────────────────────────

const cardWords = (item: PhonemeExplorerItem) => (item.menu ?? []).map((c) => c.word);

/**
 * The spoken key. A menu kind whose ask reads the cards out is a menu key (the ask says every card); at the tier
 * where the learner reads the cards, the ask says none of them, so the key is the answer alone.
 */
export function phonemeKey(item: PhonemeExplorerItem): SpokenKey {
  const menu = isMenuKind(item.kind) && item.enumerateMenu !== false ? { menu: cardWords(item) } : {};
  switch (item.kind) {
    case 'isolate':
      return { answer: item.answer, alsoAccept: [], ...menu,
        acceptRule: `It is the card that starts with ${spokenSound(item.phonemeSound)}.`,
        ...(item.exampleWord ? { signatureError: `The example word ${item.exampleWord} is not a card, so it is not the answer.` } : {}) };
    case 'ending':
      return { answer: item.answer, alsoAccept: [], ...menu,
        acceptRule: `It is the card with the same ending sound as ${item.targetWord}.`,
        signatureError: `${item.targetWord} said back is not a card.` };
    case 'medial':
      return { answer: item.answer, alsoAccept: [], ...menu,
        acceptRule: `It is the card with the same middle sound as ${item.targetWord}.`,
        signatureError: `${item.targetWord} said back is not a card.` };
    case 'blend':
      return { answer: item.answer, alsoAccept: [],
        acceptRule: `Sounding it out and landing on ${item.answer} counts.`,
        signatureError: 'The sounds with no word at the end do not.' };
    case 'segment':
      return { answer: item.answer, alsoAccept: item.soundCount != null ? [String(item.soundCount)] : [],
        acceptRule: `Counting the sounds aloud and ending on ${item.answer} counts.`,
        signatureError: 'A count that runs past it does not.' };
    case 'manipulate':
      return { answer: item.answer, alsoAccept: [],
        signatureError: `${item.originalWord} said back unchanged is not it.` };
  }
}

/**
 * A spoken item's known wrong answers (handoff 20 Part B), from the ids the card declares. isolate: the example word
 * said back, the letter's name. blend: the sounds with no word, a real word one sound off. The other modes have no
 * saved payload to measure a list against yet, so they name none.
 */
export function phonemeSpokenMisses(item: PhonemeExplorerItem): KnownMiss[] {
  if (item.kind === 'blend' && item.phonemeSequence?.length) {
    return wordReadingMisses(item.answer, { sounds: item.phonemeSequence, nearId: 'near_word', only: ['sounds_no_word', 'near_word'],
      fact: `The sounds on the tiles are ${item.phonemeSequence.join(', ')}, and they blend into "${item.answer.toLowerCase()}". ` });
  }
  if (item.kind !== 'isolate') return [];
  const menu = cardWords(item).join(', '), letter = (item.phoneme ?? '').toLowerCase(), name = LETTER_NAME[letter];
  const example = item.exampleWord?.toLowerCase();
  const onMenu = (item.menu ?? []).some(c => c.word.toLowerCase() === example);
  return [
    ...(example && item.voiceExample && !onMenu ? [{ id: 'echo_stimulus', pattern: `The example word is "${example}", and it is not one of the cards (${menu}). The learner says "${example}", the example word, instead of a card.`, examples: [example] }] : []),
    ...(name && letter.length === 1 ? [{ id: 'letter_name', pattern: `The sound is written with the letter ${letter.toUpperCase()}. The learner says the letter's NAME, "${name}", and no card word.`, examples: [name, letter.toUpperCase()] }] : []),
  ];
}

/** What is drawn and asked, for the tutor. Never the answer. */
export function phonemeScene(item: PhonemeExplorerItem, opts: { namingCards?: boolean } = {}): SceneOf {
  const facts: Record<string, string> = {};
  if (item.menu?.length) {
    facts.cards = cardWords(item).join(', ');
    facts.namingCards = opts.namingCards ? 'Read every card aloud, in screen order, evenly.'
      : item.enumerateMenu === false ? 'The learner reads the cards: do not read them aloud.'
        : 'You may say the card words aloud.';
  }
  const shown = (() => {
    switch (item.kind) {
      case 'isolate': return 'The letter for the sound and the cards are shown.';
      case 'ending': return 'Only pictures are shown: the target word and the card words are not printed until credit.';
      case 'medial': return 'The target word is never printed; the cards are.';
      case 'blend': return 'The sounds are shown as separate tiles; the word appears only after credit.';
      case 'segment': return 'The word is never printed (a reader would count letters); the count appears only after credit.';
      case 'manipulate': return 'The starting word and the change are printed; the new word appears only after credit.';
    }
  })();
  facts.constraints = `The learner answers out loud. ${shown} Tapping a card, tile or picture asks you to say that word `
    + 'or sound only.';
  return { objects: [], facts };
}

/** What a tapped card or picture asks the tutor to say: that word only. */
export const hearWordRequest = (word: string) => `The learner tapped a card. Say only this word, once: "${word}".`;

/** What a tapped tile asks the tutor to say: that sound only. */
export const hearSoundRequest = (raw: string) =>
  `The learner tapped a sound. Say only this sound, once: ${spokenPhonemeToken(raw) ?? speakablePhoneme(raw)}.`;

// ── Harness answer material — what a right and a wrong child sound like ─────

/**
 * The span of the ask inside which the answer legitimately appears.
 *
 * ONLY the enumerating tiers of the MENU kinds (`isolate`, `ending`, `medial`) have one,
 * and it is exactly the menu clause: the four cards ARE the question there,
 * unmarked, so reading them aloud is the ask and not a leak. Every other ask is
 * answer-free by construction — blend speaks sounds and never the word,
 * segment's answer is a count, and manipulate's operation prose, isolate's
 * `phonemeSound` and medial's stimulus word are all gated at build time against
 * naming their own target.
 *
 * Subtracting the clause keeps the oracle STRONGER than emptying `leakTokens`
 * would: the greeting, the how-to-play, the `Listen:` sound or word and the
 * hand-over are all still governed, so a tutor that names the target card while
 * explaining the game is still a HIGH. At the non-enumerating tier the ask never
 * says the menu at all, so no exemption is issued and the oracle stays flat.
 */
export const leakExemptSpanFor = (item: PhonemeExplorerItem): string | undefined =>
  isMenuKind(item.kind) && item.enumerateMenu !== false ? menuSpanFor(item) : undefined;

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
 *  - medial: the STIMULUS WORD said straight back. It is the exact analogue of
 *    isolate's example — it really does carry the target middle sound (it is
 *    where the target middle sound came from) and the tutor spoke it seconds
 *    ago, so a judge grading the rule the ask states affirms it. It is wrong
 *    only for being my word rather than one of the cards.
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
    case 'ending': {
      const cards = (item.menu ?? []).map((c) => c.word);
      return {
        ...base,
        correct: item.answer,
        plainWrong: cards.find((w) => w.toLowerCase() !== item.answer.toLowerCase())
          ?? decoy([item.answer.toLowerCase()]),
        signatureWrong: {
          text: item.targetWord ?? '',
          why: 'the tutor\'s own stimulus word said straight back — it carries the final sound but is not one of the picture-card choices',
        },
      };
    }
    case 'medial': {
      const cards = (item.menu ?? []).map((c) => c.word);
      return {
        ...base,
        correct: item.answer,
        // A real card, so the wrong answer is one the stage actually renders.
        plainWrong: cards.find((w) => w.toLowerCase() !== item.answer.toLowerCase())
          ?? decoy([item.answer.toLowerCase()]),
        signatureWrong: {
          text: item.targetWord ?? '',
          why: 'the tutor\'s own stimulus word said straight back — it is where the target middle sound came from, so it satisfies the rule the ask just stated and is wrong only for being off the cards',
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
