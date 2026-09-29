/**
 * The in-item levers on a CVC spelling (`/add-support-tiers`, handoff 22 L1; spoken modes handoff 24).
 *
 * Pure: the component draws from these, the workspace publishes them, and the tests hold each leak rule.
 * Four levers, one per group of `cvcMiss` patterns (qa/eval-reports/cvc-speller-levers-2026-09-28.md):
 * - `vowel_keywords` (help): a strip of every vowel in the letter group with its keyword picture. Answers
 *   `middle_letter`. Leak rule: at least two vowels, all drawn alike; none is marked.
 * - `consonant_keywords` (help): a keyword picture under every consonant in the bank, distractors included.
 *   Answers `first_letter` / `last_letter`. Leak rule: no keyword pictures a word of the session (a cat
 *   under `c` on a "cat" item answers the first box), so a colliding keyword falls back to the next one.
 * - `sound_tokens` (help): three blank tokens the learner pushes into the boxes, one per sound they say.
 *   Answers `letters_out_of_order` / `two_or_more_letters`. Leak rule: a token carries no letter and moves
 *   only on the learner's tap; the count of three is the same for every CVC word.
 * - `small_word` (simplify): an ungraded practice word first, a new picturable CVC word inside the letter
 *   group with a four-letter bank. Answers `two_or_more_letters`. Leak rule: never a session word, never a
 *   session word's rime, and at most one letter in the same box as the learner's item.
 *
 * fill_vowel and word_sort (the middle sound, said aloud). A vowel keyword is the answer there (contract R3),
 * so the one lever acts on a word outside the item:
 * - `middle_model` (help, both): another picture word in three boxes with the middle box lit; the tutor says the
 *   model word and its middle sound. Answers `whole_word`, `first_sound`, `last_sound` (which part of the word is
 *   wanted) and `letter_name` (a sound, said short, not a name). Leak rule (`middleModelLeak`): never a session word
 *   or picture, and its middle sound is none the session asks; when every short vowel is asked, a long-vowel word
 *   (rain, feet, boat) from phoneme-explorer's pool is the model.
 * - `other_vowel` has no lever by decision: any cue that separates short vowels names the item's vowel, or teaches
 *   on a practice word a vowel that answers a session item. No simplify: a practice word asks the same task with
 *   no fewer steps, and one with the item's vowel answers the item.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { cvcUsableLetters, groupVowels, isCvcSpelling, normalizeLetterGroup, type LetterGroup } from '../../../service/literacy/letterGroups';
import type { CvcSpellerChallenge } from './CvcSpeller';
import { CVC_POOL, LONG_MIDDLE_POOL, type CvcWord } from './phonemeExplorerLevers';
import { speakablePhoneme } from './phonemeVoice';

export const VOWEL_LEVER = 'vowel_keywords';
export const KEYWORD_LEVER = 'consonant_keywords';
export const TOKENS_LEVER = 'sound_tokens';
export const SMALL_WORD_LEVER = 'small_word';
export const MIDDLE_MODEL_LEVER = 'middle_model';

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

export interface Keyword { word: string; emoji: string }

/** Keyword pictures, in order of preference. The first that pictures no session word is used. */
const KEYWORDS: Record<string, readonly Keyword[]> = {
  a: [{ word: 'apple', emoji: '🍎' }], e: [{ word: 'egg', emoji: '🥚' }], i: [{ word: 'itch', emoji: '🤏' }],
  o: [{ word: 'octopus', emoji: '🐙' }], u: [{ word: 'up', emoji: '⬆️' }],
  s: [{ word: 'sun', emoji: '☀️' }, { word: 'sock', emoji: '🧦' }],
  t: [{ word: 'tent', emoji: '⛺' }, { word: 'tiger', emoji: '🐯' }],
  p: [{ word: 'pig', emoji: '🐷' }, { word: 'penguin', emoji: '🐧' }],
  n: [{ word: 'net', emoji: '🥅' }, { word: 'nose', emoji: '👃' }],
  c: [{ word: 'cat', emoji: '🐱' }, { word: 'car', emoji: '🚗' }],
  k: [{ word: 'kite', emoji: '🪁' }, { word: 'key', emoji: '🔑' }],
  h: [{ word: 'hat', emoji: '🎩' }, { word: 'horse', emoji: '🐴' }],
  r: [{ word: 'rabbit', emoji: '🐇' }, { word: 'rainbow', emoji: '🌈' }],
  m: [{ word: 'moon', emoji: '🌙' }, { word: 'map', emoji: '🗺️' }],
  d: [{ word: 'dog', emoji: '🐶' }, { word: 'duck', emoji: '🦆' }],
  g: [{ word: 'goat', emoji: '🐐' }, { word: 'gift', emoji: '🎁' }],
  l: [{ word: 'leaf', emoji: '🍃' }, { word: 'lion', emoji: '🦁' }],
  f: [{ word: 'fish', emoji: '🐟' }, { word: 'frog', emoji: '🐸' }],
  b: [{ word: 'bat', emoji: '🦇' }, { word: 'ball', emoji: '⚽' }],
  j: [{ word: 'juice', emoji: '🧃' }, { word: 'jar', emoji: '🫙' }],
  z: [{ word: 'zebra', emoji: '🦓' }],
  w: [{ word: 'web', emoji: '🕸️' }, { word: 'worm', emoji: '🪱' }],
  v: [{ word: 'van', emoji: '🚐' }, { word: 'violin', emoji: '🎻' }],
  y: [{ word: 'yo-yo', emoji: '🪀' }, { word: 'yarn', emoji: '🧶' }],
  x: [{ word: 'box', emoji: '📦' }, { word: 'fox', emoji: '🦊' }],
};

/**
 * What the session shows as stimuli: its words, their pictures and the middle vowels it asks. A keyword, model or
 * practice word must be none of them.
 */
export interface SessionStimuli { words: readonly string[]; emojis: readonly string[]; vowels: readonly string[] }
export const sessionStimuli = (challenges: readonly CvcSpellerChallenge[]): SessionStimuli => ({
  words: challenges.map(c => c.targetWord.toLowerCase()), emojis: challenges.map(c => c.emoji).filter(Boolean),
  vowels: challenges.map(c => (c.targetLetters?.[1] ?? c.targetWord[1] ?? '').toLowerCase()).filter(Boolean),
});

const pictures = (k: Keyword, s: SessionStimuli) => s.words.includes(k.word) || s.emojis.includes(k.emoji);

/** The keyword for `letter` that pictures no session word, or null. */
export const keywordFor = (letter: string, s: SessionStimuli): Keyword | null =>
  (KEYWORDS[letter.toLowerCase()] ?? []).find(k => !pictures(k, s)) ?? null;

/** Leak rule for keyword pictures: true when any pictures a session word. */
export const keywordsLeak = (drawn: readonly Keyword[], s: SessionStimuli) => drawn.some(k => pictures(k, s));

/** The vowel strip: every vowel of the letter group (and the item's own, if a scope raised it), with its keyword. */
export function vowelStrip(c: CvcSpellerChallenge, letterGroup: number | undefined, s: SessionStimuli): Array<{ letter: string } & Keyword> {
  const group = normalizeLetterGroup(letterGroup) ?? 4;
  const vowel = (c.targetLetters?.[1] ?? c.targetWord[1] ?? '').toLowerCase();
  const letters = Array.from(new Set([...groupVowels(group), ...(VOWELS.has(vowel) ? [vowel] : [])])).sort();
  const strip = letters.map(letter => ({ letter, keyword: keywordFor(letter, s) }));
  return strip.every(v => v.keyword) ? strip.map(v => ({ letter: v.letter, ...v.keyword! })) : [];
}

/** Leak rule for the vowel strip: fewer than two vowels would mark the answer. */
export const vowelStripLeak = (strip: readonly { letter: string }[]) => new Set(strip.map(v => v.letter)).size < 2;

// ── small_word: the practice word ────────────────────────────────────────────

/** Picturable CVC words, continuant onsets first (a held first sound is easier to hear). Each picture names its word. */
export const PRACTICE_WORDS: readonly Keyword[] = [
  { word: 'sun', emoji: '☀️' }, { word: 'map', emoji: '🗺️' }, { word: 'man', emoji: '👨' }, { word: 'net', emoji: '🥅' },
  { word: 'fan', emoji: '🪭' }, { word: 'fox', emoji: '🦊' }, { word: 'van', emoji: '🚐' }, { word: 'log', emoji: '🪵' },
  { word: 'leg', emoji: '🦵' }, { word: 'rat', emoji: '🐀' }, { word: 'nut', emoji: '🥜' }, { word: 'web', emoji: '🕸️' },
  { word: 'cat', emoji: '🐱' }, { word: 'dog', emoji: '🐶' }, { word: 'pig', emoji: '🐷' }, { word: 'hat', emoji: '🎩' },
  { word: 'bat', emoji: '🦇' }, { word: 'bus', emoji: '🚌' }, { word: 'cup', emoji: '🥤' }, { word: 'bed', emoji: '🛏️' },
  { word: 'pen', emoji: '🖊️' }, { word: 'bug', emoji: '🐛' }, { word: 'hen', emoji: '🐔' }, { word: 'pan', emoji: '🍳' },
  { word: 'pin', emoji: '📌' }, { word: 'tap', emoji: '🚰' }, { word: 'bag', emoji: '👜' }, { word: 'can', emoji: '🥫' },
  { word: 'tub', emoji: '🛁' }, { word: 'cap', emoji: '🧢' }, { word: 'box', emoji: '📦' }, { word: 'hut', emoji: '🛖' },
];

/** Letters a K reader confuses by shape or sound: a distractor from these is not far. */
const NEAR: Record<string, string> = {
  b: 'dp', d: 'bpt', p: 'bdq', m: 'nw', n: 'mhu', h: 'n', w: 'm', t: 'fd', f: 't', c: 'k', k: 'cg', g: 'k',
  s: 'z', z: 's', v: 'f', l: 'i', i: 'le', e: 'ia', a: 'eo', o: 'au', u: 'on',
};
const near = (a: string, b: string) => (NEAR[a] ?? '').includes(b) || (NEAR[b] ?? '').includes(a);

const rime = (w: string) => w.slice(1).toLowerCase();
const samePositions = (a: string, b: string) => a.split('').filter((l, i) => l === b[i]).length;

/** Leak rule for a practice word: true when it repeats a session word or rime, or shares two boxes with the item. */
export function practiceLeak(word: string, item: CvcSpellerChallenge, s: SessionStimuli): boolean {
  const w = word.toLowerCase();
  return s.words.includes(w) || s.words.some(sw => rime(sw) === rime(w)) || samePositions(w, item.targetWord.toLowerCase()) > 1;
}

/**
 * The practice word for `c`, or null when none keeps every rule: in the letter group, a real CVC spelling, no
 * session word or rime, its picture no session picture, and a far consonant for the fourth bank letter. Same
 * mode (three boxes from a bank), one structural step less: four bank letters instead of five.
 */
export function smallerWord(c: CvcSpellerChallenge, letterGroup: number | undefined, s: SessionStimuli,
  vowelFocus?: string): CvcSpellerChallenge | null {
  if (c.taskType !== 'spell-word') return null;
  const group: LetterGroup = normalizeLetterGroup(letterGroup) ?? 4;
  const usable = cvcUsableLetters(group);
  for (const p of PRACTICE_WORDS) {
    const letters = p.word.split('');
    if (!isCvcSpelling(p.word) || !letters.every(l => usable.includes(l))) continue;
    // An objective that names a vowel (`short-a`) keeps the practice word on it (contract R1).
    if (vowelFocus && letters[1] !== vowelFocus.slice(-1)) continue;
    if (practiceLeak(p.word, c, s) || s.emojis.includes(p.emoji)) continue;
    const far = usable.find(l => !VOWELS.has(l) && !letters.includes(l) && !letters.some(t => near(t, l)));
    if (!far) continue;
    return {
      id: `${c.id}~simpler`, taskType: 'spell-word', targetWord: p.word, targetLetters: letters, targetPhonemes: [],
      emoji: p.emoji, imageDescription: p.word, distractorLetters: [far], showPictureCue: true, practiceBank: true,
    };
  }
  return null;
}

/** The practice item's bank: its own three letters and one far distractor, never topped up (contract R5). */
export const isPracticeWord = (c: CvcSpellerChallenge) => !!c.practiceBank;

// ── middle_model: the spoken modes' model word ──────────────────────────────

const middleOf = (w: CvcWord) => (w.phon ?? w.sounds)[1];
const SHORT_SAID: Record<string, string> = { a: 'ah', e: 'eh', i: 'ih', o: 'aw', u: 'uh' };
/** The model word's middle sound as the tutor says it: a short vowel as the pack says it, a long one as its name. */
export const modelMiddleSaid = (w: CvcWord) => SHORT_SAID[middleOf(w)] ?? speakablePhoneme(`/${middleOf(w)}/`);

/** Leak rule for the model: true when it is a session word or picture, or its middle sound is one the session asks. */
export const middleModelLeak = (w: CvcWord, s: SessionStimuli) =>
  s.words.includes(w.word) || s.emojis.includes(w.emoji) || s.vowels.includes(middleOf(w));

/** The model word for a spoken item: CVC first, then a long-vowel word when the session asks every short vowel. */
export function middleModelFor(c: CvcSpellerChallenge, s: SessionStimuli): CvcWord | null {
  if (c.taskType === 'spell-word') return null;
  return [...CVC_POOL, ...LONG_MIDDLE_POOL].find(w => !middleModelLeak(w, s)) ?? null;
}

/**
 * The levers this spelling declares, with their state. Empty on the spoken modes. A lever is declared only
 * when pulling it would change the screen and pass its leak rule.
 */
export function cvcLevers(c: CvcSpellerChallenge | null, pulled: readonly string[], letterGroup: number | undefined,
  s: SessionStimuli, bank: readonly string[], vowelFocus?: string): WorkspaceLever[] {
  if (!c) return [];
  if (c.taskType !== 'spell-word') return middleModelFor(c, s) ? [{
    id: MIDDLE_MODEL_LEVER, kind: 'help', carrier: 'both', pulled: pulled.includes(MIDDLE_MODEL_LEVER),
    answers: ['whole_word', 'first_sound', 'last_sound', 'letter_name'],
    when: 'The learner says the whole word, its first or last sound, or a letter name.',
    does: 'Shows another picture word in three boxes with the middle box lit. Say that word, then its middle sound, '
      + 'short; never this item\'s sound.',
  }] : [];
  const levers: WorkspaceLever[] = [];
  const strip = vowelStrip(c, letterGroup, s);
  if (strip.length && !vowelStripLeak(strip)) levers.push({
    id: VOWEL_LEVER, kind: 'help', carrier: 'shown', pulled: pulled.includes(VOWEL_LEVER), answers: ['middle_letter'],
    when: 'The learner puts the wrong letter in the middle box.',
    does: 'Shows every vowel of this letter group with its keyword picture (apple, egg...), all alike, above the letters.',
  });
  const consonants = bank.filter(l => !VOWELS.has(l));
  if (consonants.length && consonants.every(l => keywordFor(l, s))) levers.push({
    id: KEYWORD_LEVER, kind: 'help', carrier: 'shown', pulled: pulled.includes(KEYWORD_LEVER), answers: ['first_letter', 'last_letter'],
    when: 'The learner puts the wrong letter in the first or last box.',
    does: 'Puts a keyword picture under every consonant in the letter bank, so each letter shows a word that starts with its sound.',
  });
  levers.push({
    id: TOKENS_LEVER, kind: 'help', carrier: 'shown', pulled: pulled.includes(TOKENS_LEVER),
    answers: ['letters_out_of_order', 'two_or_more_letters'],
    when: 'The learner mixes up the order of the letters, or gets two or more boxes wrong.',
    does: 'Shows three blank sound tokens above the boxes. The learner says the word slowly and taps a token into a box for each sound, left to right, then spells.',
  });
  if (smallerWord(c, letterGroup, s, vowelFocus)) levers.push({
    id: SMALL_WORD_LEVER, kind: 'simplify', carrier: 'shown', pulled: pulled.includes(SMALL_WORD_LEVER), answers: ['two_or_more_letters'],
    when: 'The learner cannot yet spell a word with this many letters to choose from.',
    does: 'Opens an easier practice word first: a different short word with only four letters to choose from. '
      + 'It is not graded; the full item comes back after it.',
  });
  return levers;
}
