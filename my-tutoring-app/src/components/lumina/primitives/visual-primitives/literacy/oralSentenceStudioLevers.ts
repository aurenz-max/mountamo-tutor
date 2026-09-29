/**
 * The in-item levers on oral-sentence-studio (`/add-support-tiers`, handoff 22 L4). The answer is one original spoken
 * sentence using both target words; the answer set is open, so no lever may show or say a sentence.
 *
 * - `sentence_strip` (help, both): two empty boxes, "Who?" and "What happens?", with the two word chips beside them.
 *   It shows the shape of a whole sentence and fills nothing in. Answers `fragment` and `words_listed`.
 * - `word_pictures` (help, both): a meaning picture under each target word (generated, `wordEmojis`). A picture that
 *   is one of the scene's own pictures is refused (`wordPicturesLeak`): it would map the word onto the scene's
 *   content and hand over the sentence. Answers `word_missing` and `word_misused`.
 *
 * `off_task` has no lever by decision: the fix is the task itself (this picture, this step, your own sentence),
 * which the tutor restates. No simplify: two words in one sentence is the mode; one word would be a different task.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { OralSentenceStudioItem } from './oralSentenceStudioScript';
import type { SpokenOralSentenceMiss } from './oralSentenceStudioWorkspace';

export const STRIP_LEVER = 'sentence_strip';
export const PICTURES_LEVER = 'word_pictures';
export const ORAL_SENTENCE_UNANSWERED: readonly SpokenOralSentenceMiss[] = ['off_task'];

/** Leak rule: true if a word picture is missing, doubled, or one of the scene's own pictures. */
export function wordPicturesLeak(item: OralSentenceStudioItem): boolean {
  const c = item.challenge;
  const pics = c.wordEmojis;
  if (!pics || pics.length !== 2 || !pics[0] || !pics[1] || pics[0] === pics[1]) return true;
  const scene = [c.settingEmoji, c.actorEmoji, c.actionEmoji, c.objectEmoji];
  return pics.some(p => scene.includes(p));
}

/** What the pulled levers put on screen, for the tutor. Never a sentence. */
export function leversOnScreen(item: OralSentenceStudioItem, pulled: readonly string[]): string | null {
  const lines = [
    pulled.includes(STRIP_LEVER) && 'two empty boxes, "Who?" and "What happens?", beside the two word chips; nothing is filled in',
    pulled.includes(PICTURES_LEVER) && !wordPicturesLeak(item)
      && `a picture under each word: ${item.challenge.targetWords[0]} ${item.challenge.wordEmojis![0]}, ${item.challenge.targetWords[1]} ${item.challenge.wordEmojis![1]}`,
  ].filter(Boolean);
  return lines.length ? lines.join('; ') : null;
}

/** The levers this item declares, with their state. */
export function oralSentenceLevers(item: OralSentenceStudioItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  const levers: WorkspaceLever[] = [{ id: STRIP_LEVER, kind: 'help', carrier: 'both', pulled: pulled.includes(STRIP_LEVER),
    answers: ['fragment', 'words_listed'] satisfies SpokenOralSentenceMiss[],
    when: 'The learner names things or lists the two words instead of saying a whole sentence.',
    does: 'Shows two empty boxes, Who? and What happens?, beside the word chips. Say what each box asks; never fill one in.' }];
  if (!wordPicturesLeak(item)) levers.push({ id: PICTURES_LEVER, kind: 'help', carrier: 'both', pulled: pulled.includes(PICTURES_LEVER),
    answers: ['word_missing', 'word_misused'] satisfies SpokenOralSentenceMiss[],
    when: 'The learner leaves a word out or uses one with the wrong meaning.',
    does: 'Puts a meaning picture under each word. Say what each word means; never say a sentence with it.' });
  return levers;
}
