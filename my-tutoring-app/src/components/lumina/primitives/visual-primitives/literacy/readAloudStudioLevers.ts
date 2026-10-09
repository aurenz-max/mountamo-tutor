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
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { practiceLine, printedSet, wordsOf } from './decodablePracticeLines';
import type { StudioItem } from './readAloudPhrasing';

export const TRACK_LEVER = 'tracking_underline';
export const DOTS_LEVER = 'sound_dots';
export const SHORT_LINE_LEVER = 'short_line';

export const READ_ALOUD_MISSES = {
  accuracy: ['word_swap', 'word_drop'],
  expression: ['word_swap', 'word_drop'],
  dialogue: ['word_swap', 'word_drop', 'paraphrase'],
} as const;

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

/** What the pulled levers put on screen, for the scene. Names the marks, never a word. */
export function leversOnScreen(pulled: readonly string[]): string | null {
  const on: string[] = [];
  if (pulled.includes(TRACK_LEVER)) on.push('an underline under each word of the line, left to right');
  if (pulled.includes(DOTS_LEVER)) on.push('a dot under each sound of every word of the line');
  return on.length ? `${on.join('; ')}; nothing is said` : null;
}

const lever = (id: string, kind: 'help' | 'simplify', pulled: readonly string[], answers: readonly string[], when: string,
  does: string): WorkspaceLever => ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers: [...answers], when, does });

/** The levers this item declares, with their state. None on the phrase-plan step. */
export function readAloudLevers(item: StudioItem | null, pulled: readonly string[], items: readonly StudioItem[]): WorkspaceLever[] {
  if (!item || item.step === 'mark') return [];
  // A cold read (accuracy, the expression first read) hears nothing; dialogue and the expression reread already have
  // the tutor's one model in the ask.
  const quiet = item.kind === 'dialogue' || item.step === 'reread'
    ? ' Say the line only as your model, as the ask says; add no other reading of it.'
    : ' Nothing is said: do not read the line or any word of it.';
  const out = [
    lever(TRACK_LEVER, 'help', pulled, ['word_swap', 'word_drop'], 'The learner swaps or drops a small word.',
      'Draws an underline under each word of the line, left to right, so every word is its own place to look.' + quiet),
    lever(DOTS_LEVER, 'help', pulled, ['word_swap'], 'The learner reads a word as a different word.',
      'Puts a dot under each sound of every word of the line.' + quiet),
  ];
  if (shortLine(item, items)) out.push(lever(SHORT_LINE_LEVER, 'simplify', pulled,
    item.kind === 'dialogue' ? ['word_swap', 'word_drop', 'paraphrase'] : ['word_swap', 'word_drop'],
    'The learner cannot yet read a line this long.',
    'Opens an easier practice line first: three new words, not from the passage. It is not graded; the line comes back after it.'
      + (item.step === 'reread' ? ' Model only the practice line, as its ask says; when the line comes back, its own ask'
        + ' gives its model. Never read the passage line or a word of it during the practice.' : '')));
  return out;
}
