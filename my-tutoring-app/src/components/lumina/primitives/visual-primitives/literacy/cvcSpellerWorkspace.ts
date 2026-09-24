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
import { spokenVowel, type CvcItem } from './cvcSpellerScript';

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
  return { id: c.id, task: `Listen to the word ${item.word} and say the sound in the middle of it.`, response: 'speech',
    expectedAnswer: `the middle sound of ${item.word}: the short ${item.vowelLetter} sound, "${spokenVowel(item)}"` };
}

/** The boxes, checked with the pack's rule: each letter in its place. */
export const spellingMatches = (c: CvcSpellerChallenge, placed: ReadonlyArray<string | null>) =>
  cvcItem(c).letters.every((letter, i) => (placed[i] ?? '').toLowerCase() === letter);

export const describeSpelling = (placed: ReadonlyArray<string | null>) =>
  `Put letters in the boxes: ${placed.map(l => l ?? '_').join(' ')}`;

export function cvcScene(c: CvcSpellerChallenge, view: { boxes: ReadonlyArray<string | null> }): WorkspaceScene {
  if (c.taskType === 'spell-word') {
    return { objects: [], facts: { task: c.taskType,
      // The learner's own work, `_` for an empty box. Try again keeps the letters that were right.
      boxes: view.boxes.map(l => l ?? '_').join(' '),
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
