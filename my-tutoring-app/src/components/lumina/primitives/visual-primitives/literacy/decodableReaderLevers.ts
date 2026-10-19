/**
 * The in-item levers on decodable-reader (`/add-support-tiers`, handoff 22 L3), as one lever set (`bossLevers.ts`).
 * The learner reads each story line cold, then answers questions about the story out loud. No lever plays audio of an
 * unread line.
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
 * a later item.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { decodableReaderCard } from './decodableReader.card';
import { practiceLine, printedSet, wordsOf } from './decodablePracticeLines';
import { answerItemFromQuestion, contentWordsOf, passageTextFrom, sentenceText, type DecodableReaderItem, type DecodableSentenceLike } from './decodableReaderDomain';

export { DECODABLE_MISSES } from './decodableReader.card';

export const TRACK_LEVER = 'tracking_underline';
export const DOTS_LEVER = 'sound_dots';
export const SHORT_LINE_LEVER = 'short_line';
export const REGION_LEVER = 'story_region';
export const SHORT_STORY_LEVER = 'short_story';

/** What the levers read: the lesson's story sentences and its items. */
export interface DecodableLeverContext {
  sentences: readonly DecodableSentenceLike[];
  items: readonly DecodableReaderItem[];
}

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
  return { ...built, id: `${item.id}~simpler`, mode: 'read_along', storyText: passageTextFrom(story), storyContentWords: contentWordsOf(story) };
}

/** The practice item a simplify lever opens on this item, by kind (the component and the journey row share it). */
export const simplerFor = (item: DecodableReaderItem, sentences: readonly DecodableSentenceLike[],
  session: readonly DecodableReaderItem[] = []) =>
  item.kind === 'read_line' ? shortLine(item, sentences) : shortStory(item, sentences, session);

const DECODE = ['literal', 'sequence', 'inference', 'main_idea'] as const;
const isLine = (item: DecodableReaderItem) => item.kind === 'read_line';
const REGION_WHY = 'Shows two whole story sentences again, the answer\'s sentence among them and nothing marked: it is '
  + 'not a clue in words (the sentences hold the answer by design) and not a mark on what is on screen.';
const REGION_FACT = 'Two sentences of the story are shown again, with nothing in them marked.';

export const DECODABLE_LEVERS = leverSet<DecodableReaderItem, DecodableLeverContext>({
  modeOf: item => item.mode ?? 'literal',
  missesOf: mode => decodableReaderCard.modes[mode as keyof typeof decodableReaderCard.modes].misses,
  specs: [
    { id: TRACK_LEVER, type: 'marks', modes: DECODE, answers: ['word_swap', 'word_skip'],
      when: 'The learner swaps or skips a small word.',
      does: 'Draws an underline under each word of the line, left to right, so every word is its own place to look. '
        + 'Nothing is said: do not read the line or any word of it.',
      offer: isLine, fact: 'An underline is under each word of the line, left to right; nothing is said.' },
    { id: DOTS_LEVER, type: 'marks', modes: DECODE, answers: ['word_swap'],
      when: 'The learner reads a word as a different word.',
      does: 'Puts a dot under each sound of every word of the line. Nothing is said: do not read the line or any word of it.',
      offer: isLine, fact: 'A dot is under each sound of every word of the line; nothing is said.' },
    { id: SHORT_LINE_LEVER, type: 'easier', modes: DECODE, carrier: 'shown', answers: ['word_swap', 'word_skip'],
      when: 'The learner cannot yet read a line this long.',
      does: 'Opens an easier practice line first: three new words, not from the story. It is not graded; the story line comes back after it.',
      content: (item, ctx) => shortLine(item, ctx.sentences) },
    // literal only: sequence, inference and main_idea ask choice questions, which have no region.
    { id: REGION_LEVER, type: 'custom', modes: ['literal'], carrier: 'shown', why: REGION_WHY, answers: ['lifted_word'],
      when: 'After a wrong answer: the learner says a story word that does not answer the question.',
      does: 'Shows again the two story sentences the answer is near, whole, with nothing in them marked. '
        + 'Never say which word answers or point inside them.',
      content: (item, ctx) => storyRegion(item, ctx.sentences), fact: REGION_FACT },
    { id: REGION_LEVER, type: 'custom', modes: ['read_along'], carrier: 'both', why: REGION_WHY, answers: ['lifted_word', 'retell'],
      when: 'After a wrong answer: the learner says a story word that does not answer the question, or retells the story.',
      does: 'Shows again, set apart, the two story sentences the answer is near, whole, with nothing in them marked. Read '
        + 'those two sentences aloud once, whole and evenly. Never stress, repeat or point to a word in them, never say '
        + 'which word answers, and do not ask the question in a new way.',
      content: (item, ctx) => storyRegion(item, ctx.sentences), fact: REGION_FACT },
    { id: SHORT_STORY_LEVER, type: 'easier', modes: ['read_along'], answers: ['lifted_word', 'retell'],
      when: 'The learner cannot yet hold a story this long and pick the word that answers.',
      does: 'Opens an easier practice story first: two short sentences, not from the lesson story, with its own question. '
        + 'Once it is on screen, read it aloud whole, exactly as printed, then ask its question; never make one up. It is '
        + 'not graded; the lesson story and its question come back after it. Never connect it to the lesson question or '
        + 'say what the two have in common.',
      content: (item, ctx) => shortStory(item, ctx.sentences, ctx.items) },
  ],
});
