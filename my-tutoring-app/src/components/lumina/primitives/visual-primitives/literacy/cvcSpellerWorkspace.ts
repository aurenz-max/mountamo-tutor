/**
 * CVC speller on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch B2). Its only teaching path: the scripted
 * speech loop was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Two channels:
 *   - `fill-vowel` / `word-sort`: the learner SAYS the middle sound, judged against it.
 *   - `spell-word`: the learner puts a letter in each box; the third letter is the commit
 *     and the boxes are checked in code, so the spelling is never published.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { CvcSpellerChallenge } from './CvcSpeller';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { spokenVowel, type CvcItem } from './cvcSpellerScript';
import { LETTER_NAME, childSound } from './spokenReadingMisses';

/** The item as the pack's helpers read it: letters and the vowel are code-derived from the word. */
export function cvcItem(c: CvcSpellerChallenge): CvcItem {
  const letters = (c.targetLetters?.length === 3 ? c.targetLetters : c.targetWord.split(''))
    .map(l => (l ?? '').toLowerCase());
  return { id: c.id, task: c.taskType, word: c.targetWord, letters, phonemes: c.targetPhonemes ?? [],
    vowelLetter: letters[1] ?? '', emoji: c.emoji };
}

export function cvcAssignment(c: CvcSpellerChallenge): TeachingAssignment {
  const item = cvcItem(c);
  if (item.task === 'spell-word') {
    return { id: c.id, task: `Listen to the word ${item.word} and put a letter in each box to spell it.`, response: 'gesture' };
  }
  const misses = cvcSpokenMisses(c);
  return { id: c.id, task: `Listen to the word ${item.word} and say the sound in the middle of it.`, response: 'speech',
    expectedAnswer: `the middle sound of ${item.word}: the short ${item.vowelLetter} sound, "${spokenVowel(item)}"`,
    ...(misses.length ? { misses } : {}) };
}

/** What a wrong spoken middle sound shows (handoff 20 Part B). */
export type SpokenCvcMiss = 'whole_word' | 'letter_name' | 'first_sound' | 'last_sound' | 'other_vowel';

const VOWEL_SAID: Record<string, string> = { a: 'ah', e: 'eh', i: 'ih', o: 'aw', u: 'uh' };
const VOWEL_KEYWORD: Record<string, string> = { a: 'apple', e: 'egg', i: 'itch', o: 'octopus', u: 'up' };

/** A spoken item's known wrong answers, most specific first. Spell-word is checked in code (`cvcMiss`). */
export function cvcSpokenMisses(c: CvcSpellerChallenge): KnownMiss[] {
  const item = cvcItem(c);
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

/** The boxes, checked with the pack's rule: each letter in its place. */
export const spellingMatches = (c: CvcSpellerChallenge, placed: ReadonlyArray<string | null>) =>
  cvcItem(c).letters.every((letter, i) => (placed[i] ?? '').toLowerCase() === letter);

/**
 * What a checked wrong spelling shows (handoff 20), box by box: `first_letter`, `middle_letter`, `last_letter`
 * (only that box is wrong), `letters_out_of_order` (the word's three letters in another order),
 * `two_or_more_letters`. fill_vowel and word_sort are spoken (Part B).
 */
export type CvcMiss = 'first_letter' | 'middle_letter' | 'last_letter' | 'letters_out_of_order' | 'two_or_more_letters';

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

/** What each pulled lever put on screen, in terms that state no letter of the word. */
const ON_SCREEN: Record<string, string> = {
  vowel_keywords: 'a strip of every vowel in this letter group, each with its keyword picture, all alike',
  consonant_keywords: 'a keyword picture under every consonant in the letter bank',
  sound_tokens: 'three blank sound tokens above the boxes, pushed by the learner one per sound they say',
};

export function cvcScene(c: CvcSpellerChallenge, view: { boxes: ReadonlyArray<string | null>; levers?: readonly string[];
  tokens?: number; practice?: boolean }): WorkspaceScene {
  if (c.taskType === 'spell-word') {
    const shown = (view.levers ?? []).map(id => ON_SCREEN[id]).filter(Boolean);
    return { objects: [], facts: { task: c.taskType,
      // The learner's own work, `_` for an empty box. Try again keeps the letters that were right.
      boxes: view.boxes.map(l => l ?? '_').join(' '),
      ...(shown.length ? { levers_on_screen: shown.join('; ') } : {}),
      ...(view.tokens !== undefined ? { tokens_pushed: `${view.tokens} of 3` } : {}),
      ...(view.practice ? { practice: 'An easier practice word with four letters to choose from, ungraded. The full item comes back after it.' } : {}),
      constraints: 'The learner taps letters from the bank into three boxes; the third letter is checked by the '
        + 'activity itself. Tapping a filled box empties it. Hear It asks you to say the word.' } };
  }
  return { objects: [], facts: { task: c.taskType,
    constraints: 'The learner says the middle sound aloud. The middle letter is a blank until it is credited. '
      + 'Hear It asks you to say the word.' } };
}

/** What Hear It asks the tutor to say: the whole word, never a sound or a letter of it. */
export const hearWordRequest = (word: string) =>
  `The learner pressed Hear It. Say this word once, whole, and nothing else: "${word}".`;

/**
 * The journey's answers. A spoken item: the middle sound, or the whole word said back. A spelling:
 * the letters for the boxes still empty (`boxes` as published), right or with the first of them wrong.
 */
export function cvcHarnessAnswers(c: CvcSpellerChallenge, boxes?: string): { correct: string[]; plainWrong: string[] } {
  const item = cvcItem(c);
  if (item.task === 'spell-word') {
    const open = (boxes ? boxes.split(' ') : ['_', '_', '_']).map((b, i) => (b === '_' ? i : -1)).filter(i => i >= 0);
    const correct = open.map(i => item.letters[i]);
    // A letter the bank always holds that is wrong in the first open box: a distractor, else another letter of the word.
    const wrongFor = (i: number) => (c.distractorLetters ?? []).map(l => l.toLowerCase()).find(l => l !== item.letters[i])
      ?? item.letters.find(l => l !== item.letters[i])!;
    return { correct, plainWrong: open.length ? [wrongFor(open[0]), ...correct.slice(1)] : [] };
  }
  return { correct: [spokenVowel(item)], plainWrong: [item.word] };
}
