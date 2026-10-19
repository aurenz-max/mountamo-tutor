/**
 * The in-item levers on oral-sentence-studio (`/add-support-tiers`, handoff 22 L4), as one lever set (`bossLevers.ts`).
 * The answer is one original spoken sentence using both target words; the answer set is open, so no lever may show or
 * say a sentence.
 *
 * - `sentence_strip` (custom, both): two empty boxes, "Who?" and "What happens?", with the two word chips beside them.
 *   It shows the shape of a whole sentence and fills nothing in. Answers `fragment` and `words_listed`.
 * - `word_pictures` (meaning): a meaning picture under each target word (generated, `wordEmojis`). A picture that is
 *   one of the scene's own pictures is refused (`wordPicturesLeak`): it would map the word onto the scene's content and
 *   hand over the sentence. Answers `word_missing` and `word_misused`.
 *
 * `off_task` has no lever by decision (the card lists it unanswered). No simplify: two words in one sentence is the
 * mode; one word would be a different task. No model lever, so the set declares no `support`.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { oralSentenceStudioCard } from './oralSentenceStudio.card';
import type { OralSentenceStudioItem } from './oralSentenceStudioDomain';

export const STRIP_LEVER = 'sentence_strip';
export const PICTURES_LEVER = 'word_pictures';

/** Leak rule: true if a word picture is missing, doubled, or one of the scene's own pictures. */
export function wordPicturesLeak(item: OralSentenceStudioItem): boolean {
  const c = item.challenge;
  const pics = c.wordEmojis;
  if (!pics || pics.length !== 2 || !pics[0] || !pics[1] || pics[0] === pics[1]) return true;
  const scene = [c.settingEmoji, c.actorEmoji, c.actionEmoji, c.objectEmoji];
  return pics.some(p => scene.includes(p));
}

export const ORAL_SENTENCE_LEVERS = leverSet<OralSentenceStudioItem, void>({
  modeOf: item => item.mode,
  missesOf: mode => oralSentenceStudioCard.modes[mode].misses,
  // The example sentences: no lever's words may say one.
  answersOf: item => item.challenge.acceptedSentences,
  specs: [
    { id: STRIP_LEVER, type: 'custom', carrier: 'both', answers: ['fragment', 'words_listed'],
      why: 'Adds an empty two-part sentence frame beside the word chips, which no stock type does.',
      when: 'The learner names things or lists the two words instead of saying a whole sentence.',
      does: 'Shows two empty boxes, Who? and What happens?, beside the word chips. Say what each box asks; never fill one in.',
      fact: 'two empty boxes, "Who?" and "What happens?", beside the two word chips; nothing is filled in' },
    { id: PICTURES_LEVER, type: 'meaning', answers: ['word_missing', 'word_misused'],
      when: 'The learner leaves a word out or uses one with the wrong meaning.',
      does: 'Puts a meaning picture under each word. Say what each word means; never say a sentence with it.',
      content: item => (wordPicturesLeak(item) ? null : item.challenge.wordEmojis!),
      fact: (pics: [string, string], item) =>
        `a picture under each word: ${item.challenge.targetWords[0]} ${pics[0]}, ${item.challenge.targetWords[1]} ${pics[1]}` },
  ],
});
