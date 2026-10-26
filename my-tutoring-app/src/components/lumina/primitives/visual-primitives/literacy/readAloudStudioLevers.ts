/**
 * The in-item levers on read-aloud-studio (`/add-support-tiers`, handoff 22 L3). Each scored item is one printed
 * line read aloud and judged word for word; accuracy and the expression first read are cold reads, so no lever plays
 * audio of the line.
 *
 * Pure: the component draws from these, the workspace publishes them, and the tests hold each leak rule.
 * - `tracking_underline` (help): one underline under each word, left to right (the shared kit overlay).
 * - `sound_dots` (help): a dot under each grapheme of every word of the line.
 * - `short_line` (simplify): an ungraded three-word decodable line from the code pool that shares no word with the
 *   passage (R3); a dialogue practice line keeps the speaker. On expression it is offered on the scored reread step
 *   only, and the practice line is itself a reread: the tutor models it as one group, the learner reads it back
 *   (the mode's scored act, one line shorter). The plan and the cold first read get no practice line.
 *
 * The phrase-plan step is page work, not a read, and gets no lever. Spoken misses (`READ_ALOUD_MISSES`) are
 * emitted by `readAloudSpokenMisses`.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { practiceLine, printedSet, wordsOf } from './decodablePracticeLines';
import type { StudioItem } from './readAloudPhrasing';
import { READ_ALOUD_MISSES, readAloudStudioCard } from './readAloudStudio.card';

export { READ_ALOUD_MISSES };
export const TRACK_LEVER = 'tracking_underline';
export const DOTS_LEVER = 'sound_dots';
export const SHORT_LINE_LEVER = 'short_line';

/** Every word the passage prints, speakers included. */
export const passageWords = (items: readonly StudioItem[]) => printedSet(...items.flatMap(i => [i.text, i.speaker]));

/** The easier practice line: three pool words, none of them a passage word. */
export function shortLine(item: StudioItem, items: readonly StudioItem[]): StudioItem | null {
  if ((item.step && item.step !== 'reread') || item.wordCount <= 3) return null;
  const line = practiceLine(passageWords(items), 4);
  // The parent's stress word is a passage word: the practice line's model stresses nothing.
  return line ? { ...item, id: `${item.id}~simpler`, text: line.text, wordCount: wordsOf(line.text).length, modelGroups: [line.text],
    stressWord: undefined } : null;
}

/** R3: true when the practice line prints any passage word. */
export const shortLineLeak = (practice: StudioItem, items: readonly StudioItem[]) =>
  wordsOf(practice.text).some(w => passageWords(items).has(w));

/** A cold read (accuracy, the expression first read) hears nothing; dialogue and the expression reread already have
 *  the tutor's one model in the ask. */
const quiet = (item: StudioItem) => (item.kind === 'dialogue' || item.step === 'reread'
  ? ' Say the line only as your model, as the ask says; add no other reading of it.'
  : ' Nothing is said: do not read the line or any word of it.');
/** Not on the phrase-plan step: it is page work, not a read. */
const reading = (item: StudioItem) => item.step !== 'mark';

/** The levers as one lever set (`bossLevers.ts`); the lesson context is the session's items. */
export const READ_ALOUD_LEVERS = leverSet<StudioItem, readonly StudioItem[]>({
  modeOf: item => item.kind,
  missesOf: mode => readAloudStudioCard.modes[mode].misses,
  specs: [
    { id: TRACK_LEVER, type: 'marks', answers: ['word_swap', 'word_drop'], offer: reading,
      when: 'The learner swaps or drops a small word.',
      does: item => 'Draws an underline under each word of the line, left to right, so every word is its own place to look.' + quiet(item),
      fact: 'an underline under each word of the line, left to right; nothing is said' },
    { id: DOTS_LEVER, type: 'marks', answers: ['word_swap'], offer: reading,
      when: 'The learner reads a word as a different word.',
      does: item => 'Puts a dot under each sound of every word of the line.' + quiet(item),
      fact: 'a dot under each sound of every word of the line; nothing is said' },
    { id: SHORT_LINE_LEVER, type: 'easier', carrier: 'shown', answers: 'all', answersOn: item => READ_ALOUD_MISSES[item.kind],
      when: 'The learner cannot yet read a line this long.',
      does: item => 'Opens an easier practice line first: three new words, not from the passage. It is not graded; the line '
        + 'comes back after it.' + (item.step === 'reread' ? ' Model only the practice line, as its ask says; when the line '
        + 'comes back, its own ask gives its model. Never read the passage line or a word of it during the practice.' : ''),
      content: (item, items) => shortLine(item, items) },
  ],
});
