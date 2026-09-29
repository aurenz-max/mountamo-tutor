/**
 * The in-item levers on decodable-reader (`/add-support-tiers`, handoff 22 L3). The learner reads each story line
 * cold, then answers questions about the story out loud. No lever plays audio of an unread line.
 *
 * Pure: the component draws from these, the workspace publishes them, and the tests hold each leak rule.
 * - `tracking_underline` (help, read line): one underline under each word, left to right (the shared kit overlay).
 * - `sound_dots` (help, read line): a dot under each grapheme of every word of the line.
 * - `short_line` (simplify, read line): an ungraded three-word decodable line from the code pool, sharing no word
 *   with the story (R3). A three-word line has no shorter one.
 * - `story_region` (help, a one-word answer in decode modes, only after a wrong answer): the story sentence the
 *   answer is in and its neighbour, shown whole. Leak rule: whole story sentences only, two of them, nothing inside
 *   them marked. Read-along keeps the whole story on screen already, so it has no region lever.
 *
 * No lever on a choice question: fewer choices on the same question repeats it (R3), and a new question would spend
 * a later item. Spoken misses are declared (`DECODABLE_MISSES`) and not emitted until handoff 20 Part B lands.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { practiceLine, printedSet, wordsOf } from './decodablePracticeLines';
import { sentenceText, type DecodableReaderItem, type DecodableReaderMode, type DecodableSentenceLike } from './decodableReaderScript';

export const TRACK_LEVER = 'tracking_underline';
export const DOTS_LEVER = 'sound_dots';
export const SHORT_LINE_LEVER = 'short_line';
export const REGION_LEVER = 'story_region';

/** The misses a spoken answer will name, per mode. `other_choice` and `retell` have no lever (see above). */
export const DECODABLE_MISSES = {
  literal: ['word_swap', 'word_skip', 'lifted_word', 'retell'],
  sequence: ['word_swap', 'word_skip', 'other_choice', 'retell'],
  inference: ['word_swap', 'word_skip', 'other_choice', 'retell'],
  main_idea: ['word_swap', 'word_skip', 'other_choice', 'retell'],
  read_along: ['lifted_word', 'retell'],
} as const satisfies Record<DecodableReaderMode, readonly string[]>;

/** The easier practice line for a read line: three pool words, none of them a story word. */
export function shortLine(item: DecodableReaderItem, sentences: readonly DecodableSentenceLike[]): DecodableReaderItem | null {
  if (item.kind !== 'read_line' || item.wordCount <= 3) return null;
  const line = practiceLine(printedSet(...sentences.map(sentenceText)), 4);
  if (!line) return null;
  const words = line.text.split(' ').map((text, i) => ({ id: `practice-${i + 1}`, text,
    phonicsPattern: /^[a-z][aeiou][a-z]\W*$/i.test(text) ? 'cvc' : 'other' }));
  return { ...item, id: `${item.id}~simpler`, text: line.text, wordCount: words.length, words };
}

/** R3 for a practice line: true when it prints any story word. */
export const shortLineLeak = (practice: DecodableReaderItem, sentences: readonly DecodableSentenceLike[]) =>
  wordsOf(practice.text).some(w => printedSet(...sentences.map(sentenceText)).has(w));

/** The two whole story sentences around a one-word answer: its sentence and the one before it (or after, at the start). */
export function storyRegion(item: DecodableReaderItem, sentences: readonly DecodableSentenceLike[]): string[] | null {
  if (item.kind !== 'answer_spoken' || item.storyText || !item.evidenceLine) return null;
  const texts = sentences.map(sentenceText);
  const at = texts.indexOf(item.evidenceLine);
  if (at < 0 || texts.length < 2) return null;
  return at > 0 ? [texts[at - 1], texts[at]] : [texts[0], texts[1]];
}

/** Leak rule for the region: true unless it is exactly two whole story sentences. */
export const regionLeak = (region: readonly string[], sentences: readonly DecodableSentenceLike[]) =>
  region.length !== 2 || region.some(r => !sentences.map(sentenceText).includes(r));

/** What the pulled levers put on screen, for the scene. Names the marks, never a word or the answer. */
export function leversOnScreen(pulled: readonly string[]): string | null {
  const on: string[] = [];
  if (pulled.includes(TRACK_LEVER)) on.push('an underline under each word of the line, left to right');
  if (pulled.includes(DOTS_LEVER)) on.push('a dot under each sound of every word of the line');
  if (pulled.includes(REGION_LEVER)) on.push('two sentences of the story are shown again, with nothing in them marked');
  return on.length ? `${on.join('; ')}; nothing is said` : null;
}

const lever = (id: string, kind: 'help' | 'simplify', pulled: readonly string[], answers: readonly string[], when: string,
  does: string): WorkspaceLever => ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers: [...answers], when, does });

/** The levers this item declares, with their state. */
export function decodableReaderLevers(item: DecodableReaderItem | null, pulled: readonly string[],
  sentences: readonly DecodableSentenceLike[]): WorkspaceLever[] {
  if (!item) return [];
  const out: WorkspaceLever[] = [];
  if (item.kind === 'read_line') {
    out.push(lever(TRACK_LEVER, 'help', pulled, ['word_swap', 'word_skip'], 'The learner swaps or skips a small word.',
      'Draws an underline under each word of the line, left to right, so every word is its own place to look. '
      + 'Nothing is said: do not read the line or any word of it.'));
    out.push(lever(DOTS_LEVER, 'help', pulled, ['word_swap'], 'The learner reads a word as a different word.',
      'Puts a dot under each sound of every word of the line. Nothing is said: do not read the line or any word of it.'));
    if (shortLine(item, sentences)) out.push(lever(SHORT_LINE_LEVER, 'simplify', pulled, ['word_swap', 'word_skip'],
      'The learner cannot yet read a line this long.',
      'Opens an easier practice line first: three new words, not from the story. It is not graded; the story line comes back after it.'));
  }
  if (storyRegion(item, sentences)) out.push(lever(REGION_LEVER, 'help', pulled, ['lifted_word'],
    'After a wrong answer: the learner says a story word that does not answer the question.',
    'Shows again the two story sentences the answer is near, whole, with nothing in them marked. '
    + 'Never say which word answers or point inside them.'));
  return out;
}
