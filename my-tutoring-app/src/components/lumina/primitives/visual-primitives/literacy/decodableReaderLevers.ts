/**
 * The in-item levers on decodable-reader (`/add-support-tiers`, handoff 22 L3). The learner reads each story line
 * cold, then answers questions about the story out loud. No lever plays audio of an unread line.
 *
 * Pure: the component draws from these, the workspace publishes them, and the tests hold each leak rule.
 * - `tracking_underline` (help, read line): one underline under each word, left to right (the shared kit overlay).
 * - `sound_dots` (help, read line): a dot under each grapheme of every word of the line.
 * - `short_line` (simplify, read line): an ungraded three-word decodable line from the code pool, sharing no word
 *   with the story (R3). A three-word line has no shorter one.
 * - `story_region` (help, a one-word answer, only after a wrong answer): the story sentence the answer is in and its
 *   neighbour, shown whole. Leak rule: whole story sentences only, two of them, nothing inside them marked. In
 *   read-along the learner cannot read them, so the tutor reads the two aloud once, evenly (carrier `both`).
 * - `short_story` (simplify, read-along): an ungraded two-sentence practice story from the code pool with its own
 *   one-word question, sharing no content word with the story or any of its questions (R3). Same mode: the tutor
 *   reads it, the learner says one word from it.
 *
 * No lever on a choice question: fewer choices on the same question repeats it (R3), and a new question would spend
 * a later item. Spoken misses are declared (`DECODABLE_MISSES`) and not emitted until handoff 20 Part B lands.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { practiceLine, printedSet, wordsOf } from './decodablePracticeLines';
import { answerItemFromQuestion, contentWordsOf, passageTextFrom, sentenceText, type DecodableReaderItem, type DecodableReaderMode, type DecodableSentenceLike } from './decodableReaderScript';

export const TRACK_LEVER = 'tracking_underline';
export const DOTS_LEVER = 'sound_dots';
export const SHORT_LINE_LEVER = 'short_line';
export const REGION_LEVER = 'story_region';
export const SHORT_STORY_LEVER = 'short_story';

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
  if (item.kind !== 'answer_spoken' || !item.evidenceLine) return null;
  const texts = sentences.map(sentenceText);
  const at = texts.indexOf(item.evidenceLine);
  if (at < 0 || texts.length < 2) return null;
  return at > 0 ? [texts[at - 1], texts[at]] : [texts[0], texts[1]];
}

/** Leak rule for the region: true unless it is exactly two whole story sentences. */
export const regionLeak = (region: readonly string[], sentences: readonly DecodableSentenceLike[]) =>
  region.length !== 2 || region.some(r => !sentences.map(sentenceText).includes(r));

/** Read-along practice stories: two short sentences, a one-word answer stated in them, another content word beside it. */
export const PRACTICE_STORIES: readonly { sentences: readonly string[]; question: string; answer: string }[] = [
  { sentences: ['Ben has a red bus.', 'The bus is big.'], question: 'What does Ben have?', answer: 'bus' },
  { sentences: ['Liz got a pup.', 'The pup can jump.'], question: 'What did Liz get?', answer: 'pup' },
  { sentences: ['A hen sat in a box.', 'The box was big.'], question: 'What sat in the box?', answer: 'hen' },
  { sentences: ['Meg dug in the mud.', 'She got wet.'], question: 'Where did Meg dig?', answer: 'mud' },
  { sentences: ['A fox ran up a hill.', 'It hid in a log.'], question: 'What ran up the hill?', answer: 'fox' },
  { sentences: ['Dad has a cup.', 'It is hot.'], question: 'What does Dad have?', answer: 'cup' },
  { sentences: ['Kim saw a bug.', 'It was on a leaf.'], question: 'What did Kim see?', answer: 'bug' },
  { sentences: ['Jen has a pig.', 'The pig is in the pen.'], question: 'Where is the pig?', answer: 'pen' },
];

/** Words that carry no story content: sharing one is not rehearsing the story. */
const FUNCTION_WORDS = new Set(('a an the is it in on at to of and he she his her has had have was can did does do '
  + 'what who where up').split(' '));
const contentOf = (...texts: Array<string | undefined>) => Array.from(printedSet(...texts)).filter(w => !FUNCTION_WORDS.has(w));
const SIGHT = new Set(Array.from(FUNCTION_WORDS).concat('said', 'they', 'with', 'are'));
const asSentence = (text: string, i: number): DecodableSentenceLike => ({ id: `practice-s${i + 1}`,
  words: text.split(' ').map((t, j) => ({ id: `practice-s${i + 1}-${j + 1}`, text: t,
    phonicsPattern: SIGHT.has(wordsOf(t)[0] ?? '') ? 'sight' : 'cvc' })) });

/** What the session prints or says: the story, every question and every answer word. */
const sessionWords = (sentences: readonly DecodableSentenceLike[], session: readonly DecodableReaderItem[]) =>
  new Set(contentOf(...sentences.map(sentenceText), ...session.flatMap(i => [i.question, i.answerWord, i.storyText])));

/** R3 for a practice story: true when its story, question or answer shares a content word with the session. */
export const shortStoryLeak = (practice: DecodableReaderItem, sentences: readonly DecodableSentenceLike[],
  session: readonly DecodableReaderItem[]) => {
  const used = sessionWords(sentences, session);
  return contentOf(practice.storyText, practice.question, practice.answerWord).some(w => used.has(w));
};

/**
 * The easier practice item for a read-along question: a two-sentence story (the session story has three or more)
 * with its own one-word question, the first pool story that shares no content word with the session (R3).
 */
export function shortStory(item: DecodableReaderItem, sentences: readonly DecodableSentenceLike[],
  session: readonly DecodableReaderItem[] = []): DecodableReaderItem | null {
  if (item.kind !== 'answer_spoken' || !item.storyText || sentences.length < 3) return null;
  const used = sessionWords(sentences, [item, ...session]);
  const pick = PRACTICE_STORIES.find(p => !contentOf(...p.sentences, p.question, p.answer).some(w => used.has(w)));
  if (!pick) return null;
  const story = pick.sentences.map(asSentence);
  const built = answerItemFromQuestion({ question: pick.question, answerWord: pick.answer }, 0, 'read_along', story);
  if (!built) return null;
  return { ...built, id: `${item.id}~simpler`, storyText: passageTextFrom(story), storyContentWords: contentWordsOf(story) };
}

/** The practice item a simplify lever opens on this item, by kind (the component and the journey row share it). */
export const simplerFor = (item: DecodableReaderItem, sentences: readonly DecodableSentenceLike[],
  session: readonly DecodableReaderItem[] = []) =>
  item.kind === 'read_line' ? shortLine(item, sentences) : shortStory(item, sentences, session);

/** What the pulled levers put on screen, for the scene. Names the marks, never a word or the answer. */
export function leversOnScreen(pulled: readonly string[]): string | null {
  const on: string[] = [];
  if (pulled.includes(TRACK_LEVER)) on.push('an underline under each word of the line, left to right');
  if (pulled.includes(DOTS_LEVER)) on.push('a dot under each sound of every word of the line');
  if (pulled.includes(REGION_LEVER)) on.push('two sentences of the story are shown again, with nothing in them marked');
  return on.length ? `${on.join('; ')}; nothing is said` : null;
}

const lever = (id: string, kind: 'help' | 'simplify', pulled: readonly string[], answers: readonly string[], when: string,
  does: string, carrier: WorkspaceLever['carrier'] = 'shown'): WorkspaceLever =>
  ({ id, kind, carrier, pulled: pulled.includes(id), answers: [...answers], when, does });

/** The levers this item declares, with their state. */
export function decodableReaderLevers(item: DecodableReaderItem | null, pulled: readonly string[],
  sentences: readonly DecodableSentenceLike[], session: readonly DecodableReaderItem[] = []): WorkspaceLever[] {
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
  const readAlong = !!item.storyText;
  if (storyRegion(item, sentences)) out.push(readAlong
    ? lever(REGION_LEVER, 'help', pulled, ['lifted_word', 'retell'],
      'After a wrong answer: the learner says a story word that does not answer the question, or retells the story.',
      'Shows again, set apart, the two story sentences the answer is near, whole, with nothing in them marked. Read '
      + 'those two sentences aloud once, whole and evenly. Never stress, repeat or point to a word in them, never say '
      + 'which word answers, and do not ask the question in a new way.', 'both')
    : lever(REGION_LEVER, 'help', pulled, ['lifted_word'],
      'After a wrong answer: the learner says a story word that does not answer the question.',
      'Shows again the two story sentences the answer is near, whole, with nothing in them marked. '
      + 'Never say which word answers or point inside them.'));
  if (shortStory(item, sentences, session)) out.push(lever(SHORT_STORY_LEVER, 'simplify', pulled, ['lifted_word', 'retell'],
    'The learner cannot yet hold a story this long and pick the word that answers.',
    'Opens an easier practice story first: two short sentences, not from the lesson story, with its own question. '
    + 'Once it is on screen, read it aloud whole, exactly as printed, then ask its question; never make one up. It is not graded; the lesson story and its question come back after '
    + 'it. Never connect it to the lesson question or say what the two have in common.', 'both'));
  return out;
}
