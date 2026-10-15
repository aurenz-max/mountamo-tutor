/**
 * The decodable-reader difficulty ladder: grade x support tier -> how much text one sentence holds, how many
 * sentences the story has, and what the words ask of the decoder. One table, read by the generator (prompt and
 * retry gate) and by the script (which sentences are askable), so the two never disagree on a sentence's length.
 *
 * WHY THIS SHAPE (2026-10-14). Before, `config.difficulty` changed nothing: every passage at a grade had the same
 * 3-8 word window, sentence count and pattern list. Connected-text difficulty is structural (sentence length,
 * story length, decoding load), so the tier moves those, and Gemini writes the story inside them. Code counts the
 * words of every sentence; nothing here trusts the model's own phonics tags.
 *
 * The ladder runs K-5. Above grade 2 the passage is no longer phonics-controlled: it is grade-level connected
 * text with multisyllabic words, read aloud a sentence at a time, still followed by comprehension questions.
 *
 * LIVE BENCH STATUS. `sentence_read_aloud` is benched at 3-8 words (di-sentence-reading, 2026-07-25). Windows
 * whose max is above 8 (grade 1 hard and up) are UNBENCHED until a Live sitting shows the tutor still catches a
 * single dropped, added or swapped word at that length. `UNBENCHED_ABOVE` marks the line; a session with no tier
 * keeps the benched 3-8 window exactly as before.
 */
import { MAX_SENTENCE_WORDS, MIN_SENTENCE_WORDS } from '../direct-instruction/diSentenceReadingDomain';

export type ReaderTier = 'easy' | 'medium' | 'hard';
export type ReaderGrade = 'K' | '1' | '2' | '3' | '4' | '5';
export const READER_GRADES: readonly ReaderGrade[] = ['K', '1', '2', '3', '4', '5'];

export interface SentenceWindow { min: number; max: number }

export interface ReaderRung {
  window: SentenceWindow;
  /** Sentences in the story. */
  sentences: [number, number];
  /** What the words ask of the reader at this rung (prompt text). */
  words: string;
  /** How the sentences are built at this rung (prompt text). */
  syntax: string;
}

/** The benched window: every session without a tier, and read-along. */
export const BENCHED_WINDOW: SentenceWindow = { min: MIN_SENTENCE_WORDS, max: MAX_SENTENCE_WORDS };
export const UNBENCHED_ABOVE = MAX_SENTENCE_WORDS;

const rung = (min: number, max: number, sentences: [number, number], words: string, syntax: string): ReaderRung =>
  ({ window: { min, max }, sentences, words, syntax });

export const READER_LADDER: Readonly<Record<ReaderGrade, Readonly<Record<ReaderTier, ReaderRung>>>> = {
  K: {
    easy: rung(3, 5, [2, 3], 'CVC words with the short vowel a or i, plus only the sight words the, a, I, is, can, see',
      'One simple statement per sentence: subject, verb, one more word ("The cat sat.", "I see a pig.")'),
    medium: rung(4, 6, [3, 4], 'CVC words with any short vowel, plus common sight words (the, a, is, it, I, and, to, can, see, my, we, go)',
      'Simple statements; one sentence may add a place ("The dog is in the mud.")'),
    // K stays CVC + sight words at every tier (the K decode gate checks it); hard adds sight words and joined ideas.
    hard: rung(5, 8, [4, 5], 'CVC words with any short vowel, plus the full kindergarten sight list (the, a, is, it, I, and, to, can, see, my, we, go, he, she, you, look, are, said)',
      'Two short ideas in some sentences, joined by "and" ("The cat ran and hid in a box.")'),
  },
  '1': {
    easy: rung(3, 6, [3, 4], 'CVC words, ck/ss/ll endings and sight words; one blend or digraph word per sentence at most',
      'Simple statements in time order'),
    medium: rung(5, 8, [4, 6], 'blends (stop, frog, nest), digraphs (ship, chat, bath) and silent-e words (cake, bike, home), plus grade 1 sight words (was, are, they, said, have, from)',
      'Statements and one question or exclamation; "and" or "but" joins two ideas'),
    hard: rung(6, 10, [5, 7], 'every grade 1 pattern: blends, digraphs, silent e, vowel teams (rain, play, feet, boat), -ed and -ing endings, two-syllable compounds (sunset, backpack)',
      'Varied sentences: time words (then, next), "because", one line of dialogue in quotation marks'),
  },
  '2': {
    easy: rung(4, 8, [4, 6], 'grade 1 patterns (blends, digraphs, silent e, common vowel teams) and grade 2 sight words',
      'Clear statements in time order'),
    medium: rung(6, 10, [5, 7], 'r-controlled vowels (farm, bird, corn), vowel teams and diphthongs (coin, cloud, town), -ed/-ing/-er endings',
      'Sentences joined with because, when, so; one line of dialogue'),
    hard: rung(8, 12, [6, 8], 'two-syllable words (basket, rabbit, garden, under), less common vowel teams (ou, ew, au), prefixes un- and re-, irregular past tense',
      'Complex sentences with a clause ("When the rain stopped, the kids ran outside."), dialogue with a speaker tag'),
  },
  '3': {
    easy: rung(5, 10, [5, 7], 'common two-syllable words and grade 3 high-frequency words',
      'Mostly simple and compound sentences'),
    medium: rung(7, 12, [6, 8], 'multisyllabic words with prefixes and suffixes (unhappy, careful, quickly), irregular plurals',
      'A mix of simple, compound and complex sentences; dialogue'),
    hard: rung(9, 15, [7, 9], 'three-syllable words (adventure, remember, beautiful), a few topic words the story explains',
      'Complex sentences with a clause at the start or end; varied sentence openings'),
  },
  '4': {
    easy: rung(6, 12, [6, 8], 'grade 4 vocabulary the story makes clear',
      'Simple and compound sentences'),
    medium: rung(8, 14, [7, 9], 'multisyllabic and domain words, words with Latin roots (port, rupt, struct) in context',
      'Complex sentences, dialogue, a time shift'),
    hard: rung(10, 18, [8, 10], 'precise, less common words whose meaning comes from context',
      'Long complex sentences with two clauses; varied structure and openings'),
  },
  '5': {
    easy: rung(6, 12, [6, 8], 'grade 5 vocabulary the story makes clear',
      'Simple and compound sentences'),
    medium: rung(8, 14, [7, 9], 'multisyllabic and domain words, Greek and Latin roots in context',
      'Complex sentences, dialogue, a time shift'),
    hard: rung(10, 18, [8, 10], 'precise academic words whose meaning comes from context, figurative phrases',
      'Long complex sentences with two clauses; varied structure and openings'),
  },
};

export const readerGrade = (grade: string | null | undefined): ReaderGrade | null =>
  (READER_GRADES as readonly string[]).includes(grade ?? '') ? (grade as ReaderGrade) : null;

/** The rung for a grade and tier; null without a tier (the benched legacy window applies). */
export function readerRung(grade: string | null | undefined, tier: string | null | undefined): ReaderRung | null {
  const g = readerGrade(grade);
  if (!g || (tier !== 'easy' && tier !== 'medium' && tier !== 'hard')) return null;
  return READER_LADDER[g][tier];
}

/**
 * The window a payload's sentences are judged in. A stamped window is clamped to [MIN_SENTENCE_WORDS, 18] so a
 * stray value can never admit a phrase or a paragraph; no stamp is the benched 3-8.
 */
export function sentenceWindowOf(stamp: Partial<SentenceWindow> | null | undefined): SentenceWindow {
  const min = Math.max(MIN_SENTENCE_WORDS, Math.floor(stamp?.min ?? MIN_SENTENCE_WORDS));
  const max = Math.min(18, Math.floor(stamp?.max ?? MAX_SENTENCE_WORDS));
  return max >= min ? { min, max } : BENCHED_WINDOW;
}
