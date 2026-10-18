/**
 * The in-item levers on di-sentence-reading (`/add-support-tiers`, DI family 6; table
 * qa/support-levers/di-sentence-reading-lever-table-2026-10-03.md). No real-learner evidence: the misses are what
 * `diSentenceSpokenMisses` names (`word_skip`, `word_swap`), the bench's deliberate omissions and `commonStruggles`.
 *
 * The answer IS the printed sentence, so a voice on it reads it for the child. Help on the item is marks that read
 * nothing; the voice carries only the model, a DIFFERENT sentence (user ruling 2026-10-02).
 *
 * Help:
 * - `model_sentence` (every mode): a small card with a DIFFERENT menu sentence of the mode's pool (decodable,
 *   sight-heavy, or any), which the tutor reads as "My turn". It shares no word with the item, so the tutor reads no
 *   word of the child's sentence; it is no session sentence; a sentence sharing no word with any session sentence is
 *   preferred. Decodable modes also draw on the shared all-CVC practice lines ("Sam can hop."), since almost every
 *   decodable menu sentence has "the" or "a".
 * - `tracking_underline` (every mode): an underline under each word and a left-to-right arrow. Every word the same.
 * - `sound_dots` (not sight_phrase_sentence): a dot under each letter of each CVC word; none under an irregular word.
 *   Refused when the sentence has no CVC word.
 * Simplify (ungraded; then the full sentence returns):
 * - `short_line` (decodable_sentence, read_sentence, sentence_review): a 3-word decodable line from the shared practice
 *   pool that shares no word with anything the session prints (literacy R3). decodable_sentence takes only all-CVC
 *   lines. Refused on a 3-word item (the mode floor).
 * - `short_sight_line` (sight_phrase_sentence): a shorter sight-heavy menu sentence that shares no word with the ITEM
 *   (R8: sight sentences share "you", "can", "see" across a session, so the rule is item-scoped). Refused on 3 words.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { diSentenceReadingCard } from './diSentenceReading.card';
import { PRACTICE_LINES, practiceLineLeak, printedSet, wordsOf } from '../literacy/decodablePracticeLines';
import { buildSentenceReadingItems, type SentenceReadingItem } from './diSentenceReadingDomain';
import { SENTENCE_MENU } from './diSentenceReadingMenu';

export const MODEL_SENTENCE = 'model_sentence';
export const TRACKING_UNDERLINE = 'tracking_underline';
export const SOUND_DOTS = 'sound_dots';
export const SHORT_LINE = 'short_line';
export const SHORT_SIGHT_LINE = 'short_sight_line';

const CONSONANT = 'bcdfghjklmnpqrstvwxz';
/** CVC in shape but read irregularly: no dots under them. */
const IRREGULAR_CVC = new Set(['was', 'put', 'his', 'has', 'of']);
/** A word of the sentence a finger can sound out: consonant, short vowel, consonant, one letter each. */
export const isCvcWord = (word: string) => {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  return w.length === 3 && CONSONANT.includes(w[0]) && 'aeiou'.includes(w[1]) && CONSONANT.includes(w[2]) && !IRREGULAR_CVC.has(w);
};

const MENU = Object.values(SENTENCE_MENU);
const allCvc = (t: string) => wordsOf(t).every(w => isCvcWord(w) || w === 'a');
/** The model pool: the menu sentences of the mode, and for a decodable mode the shared all-CVC practice lines too,
 *  because almost every decodable menu sentence has "the" or "a" and a long item would otherwise have no model. */
const poolFor = (item: SentenceReadingItem): string[] => item.challengeType === 'sight_phrase_sentence'
  ? MENU.filter(e => e.sightHeavy).map(e => e.text)
  : [...MENU.filter(e => item.challengeType !== 'decodable_sentence' || e.decodable).map(e => e.text),
    ...PRACTICE_LINES.map(l => l.text).filter(allCvc)];
const sharesWord = (a: string, b: string) => { const bs = new Set(wordsOf(b)); return wordsOf(a).some(w => bs.has(w)); };
const sameText = (a: string, b: string) => wordsOf(a).join(' ') === wordsOf(b).join(' ');

/** The model sentence for an item, or null when no menu sentence passes. Deterministic. */
export function modelFor(item: SentenceReadingItem, items: readonly SentenceReadingItem[]): string | null {
  const ok = poolFor(item).filter(t => !sharesWord(t, item.text) && !items.some(i => sameText(i.text, t)));
  const clean = (t: string) => Number(items.some(i => sharesWord(t, i.text)));
  return [...ok].sort((a, b) => clean(a) - clean(b) || wordsOf(a).length - wordsOf(b).length)[0] ?? null;
}

const asItem = (item: SentenceReadingItem, text: string): SentenceReadingItem | null =>
  buildSentenceReadingItems([{ id: `${item.id}~simpler`, challengeType: item.challengeType, supportTier: item.supportTier,
    text, wordCount: wordsOf(text).length }])[0] ?? null;

/** The easier line a simplify lever opens, or null. */
export function simplerLine(item: SentenceReadingItem, lever: string, items: readonly SentenceReadingItem[]): SentenceReadingItem | null {
  if (item.wordCount <= 3) return null;
  if (lever === SHORT_LINE && item.challengeType !== 'sight_phrase_sentence') {
    const printed = printedSet(...items.map(i => i.text));
    const model = modelFor(item, items);
    const line = PRACTICE_LINES.find(l => wordsOf(l.text).length === 3 && !practiceLineLeak(l.text, printed) && l.text !== model
      && (item.challengeType !== 'decodable_sentence' || allCvc(l.text)));
    return line ? asItem(item, line.text) : null;
  }
  if (lever === SHORT_SIGHT_LINE && item.challengeType === 'sight_phrase_sentence') {
    const line = MENU.filter(e => e.sightHeavy && wordsOf(e.text).length <= 4 && wordsOf(e.text).length < item.wordCount
      && !sharesWord(e.text, item.text) && !items.some(i => sameText(i.text, e.text)))[0];
    return line ? asItem(item, line.text) : null;
  }
  return null;
}

/** What the levers read beyond the item: the session's sentences, so a model or practice line shares no word with one. */
export interface SentenceLeverContext { items: readonly SentenceReadingItem[] }

const PRACTICE = 'Opens a shorter line first. The learner reads it; do not read it for them. It is not graded; the full sentence comes back after it.';
const DECODABLE_MODES = ['decodable_sentence', 'read_sentence', 'sentence_review'];

/** Every lever of the pack, by type, in the order the tutor sees them. */
export const SENTENCE_LEVERS = leverSet<SentenceReadingItem, SentenceLeverContext>({
  modeOf: item => item.challengeType,
  missesOf: mode => diSentenceReadingCard.modes[mode]?.misses ?? [],
  support: { tier: item => item.supportTier ?? 'easy', different: 'a different sentence', own: 'this sentence' },
  specs: [
    { id: MODEL_SENTENCE, type: 'model', answers: 'all',
      when: 'The learner leaves out or changes a word, or does not know how to start.',
      does: 'Shows a small card with a DIFFERENT sentence (onScreen gives it). Read it as your turn, one word at a time, pointing '
        + '("My turn: …"). Then ask the learner to read their own sentence. Never read their sentence or any word of it, and '
        + 'never say "so yours says…".',
      content: (item, { items }) => modelFor(item, items),
      fact: (model: string) => `Beside the learner's sentence, a model card shows a different sentence: "${model}". It shares no word with theirs.` },
    { id: TRACKING_UNDERLINE, type: 'marks', answers: ['word_skip'],
      when: 'The learner skips a word.',
      does: 'Draws a line under every word and an arrow pointing left to right: touch each word in turn. Read none of them.',
      fact: 'A line sits under every printed word, with an arrow pointing left to right.' },
    { id: SOUND_DOTS, type: 'marks', modes: DECODABLE_MODES, answers: ['word_swap'],
      offer: item => wordsOf(item.text).some(isCvcWord),
      when: 'The learner reads a word as a different word.',
      does: 'Puts a dot under each letter of the words that can be sounded out (none under the others). Say nothing about which word.',
      fact: 'Dots sit under the letters of the words that can be sounded out.' },
    { id: SHORT_LINE, type: 'easier', modes: DECODABLE_MODES, carrier: 'shown', answers: ['word_skip', 'word_swap'],
      when: 'This sentence is too long to read yet.', does: PRACTICE, content: (item, { items }) => simplerLine(item, SHORT_LINE, items) },
    { id: SHORT_SIGHT_LINE, type: 'easier', modes: ['sight_phrase_sentence'], carrier: 'shown', answers: ['word_skip', 'word_swap'],
      when: 'This sentence is too long to read yet.', does: PRACTICE, content: (item, { items }) => simplerLine(item, SHORT_SIGHT_LINE, items) },
  ],
});
