/**
 * cvc-speller's domain: the items, the ask, the spoken key, the known misses, the boxes' check, the scene and the
 * content gate. Pure; the boss, the levers, the component and the tests read the same rules.
 *
 * Three task identities on one CVC word:
 *   - `fill-vowel` / `word-sort`: the learner hears the word and SAYS THE MIDDLE SOUND, judged against it. The sound
 *     is the answer, never the letter's name. The word is the stimulus and is always safe to say.
 *   - `spell-word`: the learner puts a letter in each of three boxes; the third letter is the commit and the boxes are
 *     checked here (`spellingMatches`, `cvcMiss`), so the spelling is never published to the tutor.
 * A `make_word` item is the shared letter build (`letterBuild.ts`); its checks live there.
 */
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import type { CvcSpellerChallenge, CvcSpellerData } from './CvcSpeller';
import type { CvcMiss } from './cvcSpeller.card';
import { letterAssignment, letterItemsFrom, type LetterBuildItem } from './letterBuild';
import { speakablePhoneme } from './phonemeVoice';
import { LETTER_NAME, childSound } from './spokenReadingMisses';

/** The three task identities of a word item; the catalog's eval modes name them with underscores. */
export type CvcTask = 'fill-vowel' | 'spell-word' | 'word-sort';
export const CVC_TASK_MODE: Record<CvcTask, 'fill_vowel' | 'spell_word' | 'word_sort'> = {
  'fill-vowel': 'fill_vowel', 'spell-word': 'spell_word', 'word-sort': 'word_sort',
};

/** One CVC item as the rules read it: letters and the vowel are code-derived from the word. */
export interface CvcItem {
  id: string;
  task: CvcTask;
  /** "cat": the stimulus. Always safe to say; never safe to spell aloud. */
  word: string;
  /** ['c','a','t']: the spell-word answer. */
  letters: string[];
  /** ['/k/','/æ/','/t/'] as the generator wrote them. */
  phonemes: string[];
  /** 'a': the middle letter, from `letters`. */
  vowelLetter: string;
  emoji: string;
}

/** A word item: the challenge, its eval mode and the lesson's tier (when the model lever comes). */
export type CvcWord = CvcSpellerChallenge & { mode: 'fill_vowel' | 'spell_word' | 'word_sort'; supportTier: SupportTier };
/** A build item: the shared letter build's ask, on make_word. */
export type CvcBuild = LetterBuildItem & { mode: 'make_word'; supportTier: SupportTier };
export type CvcSpellerItem = CvcWord | CvcBuild;

export const isCvcBuild = (item: CvcSpellerItem): item is CvcBuild => item.mode === 'make_word';

const tierOf = (data: Pick<CvcSpellerData, 'supportTier'>): SupportTier => data.supportTier ?? 'medium';

/** A challenge as a word item of this lesson. */
export const asCvcWord = (c: CvcSpellerChallenge, supportTier: SupportTier): CvcWord =>
  ({ ...c, mode: CVC_TASK_MODE[c.taskType], supportTier });
/** A letter-build ask as a build item of this lesson. */
export const asCvcBuild = (item: LetterBuildItem, supportTier: SupportTier): CvcBuild => ({ ...item, mode: 'make_word', supportTier });

/** The session's word items, each stamped with its mode and the lesson's tier. */
export const cvcWords = (data: Pick<CvcSpellerData, 'challenges' | 'supportTier'>): CvcWord[] =>
  (data.challenges ?? []).map(c => asCvcWord(c, tierOf(data)));

/** The session's build asks, through the shared build's own gate. */
export const cvcBuilds = (data: Pick<CvcSpellerData, 'buildItems' | 'supportTier'>): CvcBuild[] =>
  letterItemsFrom(data.buildItems ?? [], data.supportTier).map(i => asCvcBuild(i, tierOf(data)));

/** The session's items: the build asks on make_word, the challenges otherwise. */
export const cvcSpellerItems = (data: CvcSpellerData): CvcSpellerItem[] =>
  data.task === 'letter_build' ? cvcBuilds(data) : cvcWords(data);

/** The item as the rules read it. */
export function cvcItem(c: CvcSpellerChallenge): CvcItem {
  const letters = (c.targetLetters?.length === 3 ? c.targetLetters : c.targetWord.split(''))
    .map(l => (l ?? '').toLowerCase());
  return { id: c.id, task: c.taskType, word: c.targetWord, letters, phonemes: c.targetPhonemes ?? [],
    vowelLetter: letters[1] ?? '', emoji: c.emoji };
}

// ── The vowel, as it is said ─────────────────────────────────────────────────

/** Short vowels as the voice holds them: di-letter-sounds' own spellings, so a child hears one rendering. */
const SHORT_VOWEL_SPOKEN: Record<string, string> = { a: 'aaa', e: 'eee', i: 'iii', o: 'ooo', u: 'uuu' };
/** Short vowels said clipped. */
const VOWEL_SAID: Record<string, string> = { a: 'ah', e: 'eh', i: 'ih', o: 'aw', u: 'uh' };
/** The keyword anchor for each short vowel: shown only after credit, since before it is the answer. */
const VOWEL_KEYWORD: Record<string, string> = { a: 'apple', e: 'egg', i: 'itch', o: 'octopus', u: 'up' };

export const vowelKeyword = (letter: string): string => VOWEL_KEYWORD[letter.toLowerCase()] ?? '';

/**
 * The middle sound as it is said. Resolved from the vowel LETTER first: a generation that wrote `/a/` for `/æ/` would
 * otherwise reach the voice as the letter's name. Falls back to the generator's phoneme only off the five short vowels.
 */
export const spokenVowel = (item: CvcItem): string =>
  SHORT_VOWEL_SPOKEN[item.vowelLetter.toLowerCase()] ?? speakablePhoneme(item.phonemes[1] ?? item.vowelLetter);

// ── The ask and the key ──────────────────────────────────────────────────────

/** What the learner is asked: the word and the hand-over. Never the middle sound or a letter of the word. */
export function cvcAsk(item: CvcSpellerItem): string {
  if (isCvcBuild(item)) return letterAssignment(item).task;
  return item.taskType === 'spell-word'
    ? `Listen to the word ${item.targetWord} and put a letter in each box to spell it.`
    : `Listen to the word ${item.targetWord} and say the sound in the middle of it.`;
}

/**
 * The spoken key on a middle-sound item: the short vowel, a sound (in slashes, never the letter), however it arrives.
 * Null on a spelling (the boxes check it) and on a build (the build and the word judge do).
 */
export function cvcKey(item: CvcSpellerItem): SpokenKey | null {
  if (isCvcBuild(item) || item.taskType === 'spell-word') return null;
  const it = cvcItem(item), v = it.vowelLetter, name = LETTER_NAME[v];
  return { answer: `/${v}/`, alsoAccept: [spokenVowel(it), VOWEL_SAID[v]].filter(Boolean),
    acceptRule: `It is the short ${v} sound in the middle of ${it.word}: said clipped, held, or inside a short phrase, it counts.`,
    signatureError: `The whole word ${it.word} said back, its first or last sound, the letter's name${name ? ` "${name}"` : ''}, `
      + 'or another short vowel sound is not yet the middle sound.' };
}

/** A spoken item's known wrong answers, most specific first. A spelling is checked in code (`cvcMiss`). */
export function cvcSpokenMisses(c: CvcSpellerChallenge | CvcSpellerItem): KnownMiss[] {
  if ('mode' in c && isCvcBuild(c)) return [];
  const item = cvcItem(c as CvcSpellerChallenge);
  if (item.task === 'spell-word' || item.letters.length !== 3) return [];
  const [first, vowel, last] = item.letters, name = LETTER_NAME[vowel];
  // Short a and short o sound alike in many accents ("ah"), so neither is the other's example.
  const others = ['e', 'i', 'u', 'a', 'o'].filter(v => v !== vowel && `${v}${vowel}` !== 'ao' && `${v}${vowel}` !== 'oa').slice(0, 2);
  return [
    { id: 'whole_word', pattern: `The word is "${item.word}". The learner says the whole word "${item.word}" instead of only its middle sound.`, examples: [item.word] },
    ...(name ? [{ id: 'letter_name', pattern: `The middle letter of "${item.word}" is ${vowel}. The learner says its NAME, "${name}", instead of the short sound it makes in the word.`, examples: [name] }] : []),
    { id: 'first_sound', pattern: `The word "${item.word}" starts with the sound of "${first}". The learner says that FIRST sound, "${childSound(first)}", instead of the middle one.`, examples: [childSound(first)] },
    { id: 'last_sound', pattern: `The word "${item.word}" ends with the sound of "${last}". The learner says that LAST sound, "${childSound(last)}", instead of the middle one.`, examples: [childSound(last)] },
    { id: 'other_vowel', pattern: `The middle sound of "${item.word}" is the short ${vowel}. The learner says a different short vowel sound, like the ones in ${others.map(v => `"${VOWEL_KEYWORD[v]}"`).join(' or ')}.`,
      examples: others.map(v => VOWEL_SAID[v]) },
  ];
}

// ── The boxes ────────────────────────────────────────────────────────────────

/** The boxes, checked: each letter in its place. */
export const spellingMatches = (c: CvcSpellerChallenge, placed: ReadonlyArray<string | null>) =>
  cvcItem(c).letters.every((letter, i) => (placed[i] ?? '').toLowerCase() === letter);

/**
 * What a checked wrong spelling shows, box by box: `first_letter`, `middle_letter`, `last_letter` (only that box is
 * wrong), `letters_out_of_order` (the word's three letters in another order), `two_or_more_letters`.
 */
export function cvcMiss(c: CvcSpellerChallenge, placed: ReadonlyArray<string | null>): CvcMiss | undefined {
  const want = cvcItem(c).letters, got = want.map((_, i) => (placed[i] ?? '').toLowerCase());
  const wrong = want.map((l, i) => got[i] !== l);
  if (!wrong.some(Boolean)) return undefined;
  if ([...got].sort().join() === [...want].sort().join()) return 'letters_out_of_order';
  if (wrong.filter(Boolean).length > 1) return 'two_or_more_letters';
  return (['first_letter', 'middle_letter', 'last_letter'] as const)[wrong.indexOf(true)];
}

export const describeSpelling = (placed: ReadonlyArray<string | null>) =>
  `Put letters in the boxes: ${placed.map(l => l ?? '_').join(' ')}`;

// ── The scene ────────────────────────────────────────────────────────────────

/** What the tutor reads about a word item, beyond the ask and the levers. */
export function cvcScene(c: CvcSpellerChallenge, view: { boxes: ReadonlyArray<string | null>; tokens?: number; practice?: boolean }): SceneOf {
  if (c.taskType === 'spell-word') {
    return { objects: [], facts: { task: c.taskType,
      // The learner's own work, `_` for an empty box. Try again keeps the letters that were right.
      boxes: view.boxes.map(l => l ?? '_').join(' '),
      ...(view.tokens !== undefined ? { tokens_pushed: `${view.tokens} of 3` } : {}),
      ...(view.practice ? { practice: 'An easier practice word with four letters to choose from, ungraded. The full item comes back after it.' } : {}),
      constraints: 'Never name, sound out or spell a letter of the word. Hear It asks you to say the whole word only.' } };
  }
  return { objects: [], facts: { task: c.taskType,
    constraints: 'The middle letter is a blank until it is credited. Never say the middle sound of the word or a letter '
      + 'of it before credit. Hear It asks you to say the whole word only.' } };
}

/** What Hear It asks the tutor to say: the whole word, never a sound or a letter of it. */
export const hearWordRequest = (word: string) =>
  `The learner pressed Hear It. Say this word once, whole, and nothing else: "${word}".`;

// ── The harness ──────────────────────────────────────────────────────────────

/** The journey's spoken answers: the middle sound, or the whole word said back. */
export const cvcSay = (c: CvcSpellerChallenge) => {
  const item = cvcItem(c);
  return { correct: spokenVowel(item), plainWrong: item.word };
};

/**
 * The journey's letters for a spelling: the letters for the boxes still empty (`boxes` as published), right, or with
 * the first of them wrong (a distractor the bank always holds, else another letter of the word).
 */
export function cvcSpellLetters(c: CvcSpellerChallenge, boxes?: string): { correct: string[]; plainWrong: string[] } {
  const item = cvcItem(c);
  const open = (boxes ? boxes.split(' ') : ['_', '_', '_']).map((b, i) => (b === '_' ? i : -1)).filter(i => i >= 0);
  const correct = open.map(i => item.letters[i]);
  const wrongFor = (i: number) => (c.distractorLetters ?? []).map(l => l.toLowerCase()).find(l => l !== item.letters[i])
    ?? item.letters.find(l => l !== item.letters[i])!;
  return { correct, plainWrong: open.length ? [wrongFor(open[0]), ...correct.slice(1)] : [] };
}

// ── The content gate ─────────────────────────────────────────────────────────

const TASKS: readonly string[] = ['fill-vowel', 'spell-word', 'word-sort'];

/** The open build (make_word): every ask must pass the surface's own gate. */
function validateLetterBuild(d: CvcSpellerData): CvcSpellerData {
  if (typeof d.title !== 'string' || !Array.isArray(d.buildItems) || !d.buildItems.length || d.buildItems.length > 12
      || letterItemsFrom(d.buildItems, d.supportTier).length !== d.buildItems.length)
    throw new Error('Generated CVC speller has invalid lesson content.');
  return d;
}

/** Reject a challenge the board cannot ask: a three-letter word whose middle letter is a short vowel. */
export const validateCvcSpellerData = (value: unknown): CvcSpellerData => (value as CvcSpellerData)?.task === 'letter_build'
  ? validateLetterBuild(value as CvcSpellerData) : validateChallengePool<CvcSpellerData>(value,
  c => !!c && TASKS.includes(c.taskType) && typeof c.targetWord === 'string' && cvcItem(c).letters.length === 3
    && 'aeiou'.includes(cvcItem(c).vowelLetter),
  { pool: 'Generated CVC speller has invalid lesson content.', item: 'A CVC speller challenge cannot be asked.' });
