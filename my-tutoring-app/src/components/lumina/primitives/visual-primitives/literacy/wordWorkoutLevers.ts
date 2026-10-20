/**
 * The in-item levers on word-workout (`/add-support-tiers`, handoff 22): picture match (L1) and the spoken read
 * modes (L3), declared once as a lever set (`components/live-activity/bossLevers.ts`). Every printed word here is read
 * cold, so every help lever is a visual mark from the shared kit overlay (`LuminaPrintSupport`) and nothing is said:
 * no audio of unread print.
 *
 * Pure: the component draws from these, the boss carries the set, and the tests hold each leak rule.
 * - `sound_dots` (marks): a dot under each grapheme of the printed word or words and a left-to-right arrow. Leak
 *   rule: visual only, the letters unchanged, no picture marked.
 * - `two_far_pictures` (easier, picture match): an ungraded practice item first, a new printed CVC word and two
 *   pictures, the foil sharing neither its first nor its last letter. Both words use only the lesson's vowels
 *   (contract R1), so in a one-vowel lesson the foil shares the vowel. Leak rule: never a session word or a session
 *   word's rime, and no session picture.
 * - `changed_letter` (marks, word chains where the tier hid the change): the letter that changed from the word
 *   before is lit. Its place only.
 * - `short_chain` (easier, word chains): two new words, only the first letter changes, the change lit.
 * - `chunk_divider` (marks, inflected and compound, only after a first try): a bar between the base and its ending,
 *   or the two words. The word's chunks are shown only after a cold attempt (contract R10), so it is offered only
 *   once the item has had a wrong answer.
 * - `easier_ending` (easier, inflected -ing/-ed): a new pool word with the -s ending.
 * - `tracking_underline` (marks, sentence reading): one underline under each word, left to right.
 * - `three_word_sentence` (easier, sentence reading): a new three-word decodable line from the code pool.
 * - `question_word_icon` (clue, the sentence question): an icon for the kind of answer (who, what, where).
 *
 * Every easier item is built here from a code pool and prints no word the session prints (R3).
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { chunkBreak, dotsLeak, graphemes } from '../../../ui/printSupport';
import { PRACTICE_WORDS } from './cvcSpellerLevers';
import { practiceLine, printedSet, wordsOf } from './decodablePracticeLines';
import { EARLY_EXTENDED_WORDS } from './wordWorkoutEarlyDecoding';
import { WORD_WORKOUT_SPOKEN_MISSES, wordWorkoutCard } from './wordWorkout.card';
import { COMMON_CVC_WORDS, wordWorkoutEvalMode, type WordWorkoutItem } from './wordWorkoutDomain';

export { dotsLeak, graphemes, WORD_WORKOUT_SPOKEN_MISSES, wordWorkoutEvalMode };

export const DOTS_LEVER = 'sound_dots';
export const TWO_PICTURES_LEVER = 'two_far_pictures';
export const CHANGED_LETTER_LEVER = 'changed_letter';
export const SHORT_CHAIN_LEVER = 'short_chain';
export const CHUNK_LEVER = 'chunk_divider';
export const EASIER_ENDING_LEVER = 'easier_ending';
export const TRACK_LEVER = 'tracking_underline';
export const SHORT_SENTENCE_LEVER = 'three_word_sentence';
export const QUESTION_ICON_LEVER = 'question_word_icon';

const rime = (w: string) => w.slice(1).toLowerCase();

/** What the session prints or pictures: target words and every picture word and emoji. */
export function sessionWords(items: readonly WordWorkoutItem[]): { words: Set<string>; emojis: Set<string> } {
  const words = new Set<string>(), emojis = new Set<string>();
  for (const i of items) {
    for (const w of [i.targetWord, i.realWord, i.nonsenseWord, i.answerWord, ...(i.chain ?? []), ...(i.options ?? []).map(o => o.word)]) {
      if (w) words.add(w.toLowerCase());
    }
    for (const o of i.options ?? []) if (o.emoji) emojis.add(o.emoji);
  }
  return { words, emojis };
}

/** The lesson's vowels: the objective's mastered vowels, else the vowels of the session's printed words. */
export function lessonVowels(masteredVowels: readonly string[] | undefined, items: readonly WordWorkoutItem[]): string[] {
  const named = (masteredVowels ?? []).map(v => v.toLowerCase()).filter(v => 'aeiou'.includes(v) && v.length === 1);
  if (named.length) return named;
  const printed = items.flatMap(i => [i.targetWord, ...(i.pair ?? []), ...(i.chain ?? []), ...(i.contextWords ?? [])]);
  return Array.from(new Set(printed.flatMap(w => (w ?? '').split('').filter(l => 'aeiou'.includes(l)))));
}

const inScope = (word: string, vowels: readonly string[]) => word.split('').filter(l => 'aeiou'.includes(l)).every(v => vowels.includes(v));
/** Far for a picture foil: neither the first nor the last letter is the same (the vowel may be, in a one-vowel lesson). */
const farFoil = (a: string, b: string) => a[0] !== b[0] && a.slice(-1) !== b.slice(-1) && rime(a) !== rime(b);

/** Leak rule for a practice item: true when it prints a session word or rime, pictures a session picture, uses a
 *  vowel outside the lesson, or offers a foil that starts or ends like the word. */
export function practiceLeak(practice: WordWorkoutItem, items: readonly WordWorkoutItem[], vowels: readonly string[]): boolean {
  const s = sessionWords(items), word = practice.targetWord ?? '';
  const sessionTargets = items.map(i => i.targetWord).filter((w): w is string => !!w);
  return s.words.has(word) || sessionTargets.some(t => rime(t) === rime(word))
    || (practice.options ?? []).some(o => s.emojis.has(o.emoji) || !inScope(o.word, vowels)
      || (o.word !== word && (s.words.has(o.word) || !farFoil(o.word, word))));
}

/** The practice item for `item`: a new CVC word and one picture foil far from it, all in the lesson's vowels. */
export function twoFarPictures(item: WordWorkoutItem, items: readonly WordWorkoutItem[], vowels: readonly string[]): WordWorkoutItem | null {
  if (item.kind !== 'picture_tap' || !vowels.length) return null;
  const s = sessionWords(items);
  const fresh = PRACTICE_WORDS.filter(p => !s.words.has(p.word) && !s.emojis.has(p.emoji) && inScope(p.word, vowels));
  for (const target of fresh) {
    if (items.some(i => i.targetWord && rime(i.targetWord) === rime(target.word))) continue;
    const foil = fresh.find(p => p.word !== target.word && farFoil(p.word, target.word));
    if (!foil) continue;
    const options = [target, foil].sort((a, b) => a.word.localeCompare(b.word)).map(p => ({ word: p.word, emoji: p.emoji }));
    return { ...item, id: `${item.id}~simpler`, targetWord: target.word, options };
  }
  return null;
}

// ── L3: the spoken read modes ───────────────────────────────────────────────

/** Every word the session prints, sentences and near words included: a practice item may use none of them (R3). */
export function printedBySession(items: readonly WordWorkoutItem[]): Set<string> {
  const out = printedSet(...items.flatMap(i => [i.sentence, i.contextSentence, ...(i.pair ?? []), ...(i.contextWords ?? []),
    ...(i.decodingParts ?? []).filter(p => !p.includes('/'))]));
  sessionWords(items).words.forEach(w => out.add(w));
  return out;
}

/** Real CVC words a practice item never prints to a five-year-old. */
const PRACTICE_SKIP = new Set(['god', 'gun', 'sin', 'rum', 'pus', 'bum', 'nun', 'pub', 'hag', 'gut', 'fat', 'fib', 'gob', 'sod']);

/** The practice chain for a chain word: two new words, only the first letter changes; no session word or rime. */
export function shortChain(item: WordWorkoutItem, items: readonly WordWorkoutItem[], vowels: readonly string[]): WordWorkoutItem | null {
  if (item.kind !== 'chain_word' || !vowels.length) return null;
  const printed = printedBySession(items);
  const sessionRimes = new Set(items.flatMap(i => i.chain ?? []).map(rime));
  const pool = Array.from(COMMON_CVC_WORDS)
    .filter(w => !PRACTICE_SKIP.has(w) && inScope(w, vowels) && !printed.has(w) && !sessionRimes.has(rime(w)));
  for (const a of pool) {
    const b = pool.find(x => x !== a && rime(x) === rime(a));
    if (b) return { ...item, id: `${item.id}~simpler`, chain: [a, b], chainIndex: 1, changedIndex: 0, chainCueLevel: 'full', chainStart: false };
  }
  return null;
}

/** The practice word for an -ing or -ed word: a new pool word with the -s ending, in the lesson's vowels. */
export function easierEnding(item: WordWorkoutItem, items: readonly WordWorkoutItem[], vowels: readonly string[]): WordWorkoutItem | null {
  if (item.kind !== 'read_extended_word' || item.wordMode !== 'inflected-word') return null;
  if (EARLY_EXTENDED_WORDS.find(e => e.word === item.targetWord)?.kind === 'ending-s') return null;
  const printed = printedBySession(items);
  const entry = EARLY_EXTENDED_WORDS.find(e => e.kind === 'ending-s' && e.scopeVowels.every(v => vowels.includes(v))
    && !printed.has(e.word) && !printed.has(e.decodingParts[0]));
  return entry ? { ...item, id: `${item.id}~simpler`, targetWord: entry.word, decodingParts: [...entry.decodingParts] } : null;
}

/** The practice sentence for a sentence read: a new three-word decodable line sharing no word with the session. */
export function threeWordSentence(item: WordWorkoutItem, items: readonly WordWorkoutItem[]): WordWorkoutItem | null {
  if (item.kind !== 'read_sentence' || wordsOf(item.sentence).length <= 3) return null;
  const line = practiceLine(printedBySession(items), 4);
  return line ? { ...item, id: `${item.id}~simpler`, sentence: line.text, cvcWords: wordsOf(line.text).filter(w => COMMON_CVC_WORDS.has(w)) } : null;
}

/** The kind-of-answer icon for a who, what or where question. It shows the kind of answer, never the word. */
export const QUESTION_ICONS: Readonly<Record<string, { icon: string; label: string }>> = {
  who: { icon: '👤', label: 'a person or animal' }, what: { icon: '📦', label: 'a thing' }, where: { icon: '📍', label: 'a place' },
};
export const questionIcon = (item: WordWorkoutItem) =>
  item.kind === 'answer_question' ? QUESTION_ICONS[(item.question ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? ''] ?? null : null;

/** The chunk divider's place in an inflected or compound word, or null. */
export const chunkFor = (item: WordWorkoutItem) =>
  item.kind === 'read_extended_word' ? chunkBreak(item.targetWord ?? '', item.decodingParts ?? []) : null;

/** R3 for a spoken practice item: true when any word it prints is a word the session prints. */
export function spokenPracticeLeak(practice: WordWorkoutItem, items: readonly WordWorkoutItem[]): boolean {
  const printed = printedBySession(items);
  const words = practice.kind === 'read_sentence' ? wordsOf(practice.sentence)
    : practice.kind === 'chain_word' ? [...(practice.chain ?? [])] : [practice.targetWord ?? ''];
  return words.some(w => printed.has(w.toLowerCase()));
}

// ── The lever set ───────────────────────────────────────────────────────────

/** One lesson's context: its items, its vowels, and the session item that has had a wrong answer. */
export interface WordWorkoutLeverCtx {
  items: readonly WordWorkoutItem[];
  vowels: readonly string[];
  /** The session item with a first wrong try: an extended word's chunks show only after one (contract R12). */
  missed?: string;
}

const NOTHING_SAID = ' Nothing is said: do not read the word or its sounds.';
const DOTS_FACT = 'A dot under each sound of the printed word and an arrow under it, left to right; nothing is said.';
const dotsOn = (...kinds: WordWorkoutItem['kind'][]) => (item: WordWorkoutItem) => (kinds.includes(item.kind) ? true : null);

export const WORD_WORKOUT_LEVERS = leverSet<WordWorkoutItem, WordWorkoutLeverCtx>({
  modeOf: wordWorkoutEvalMode,
  missesOf: mode => wordWorkoutCard.modes[mode].misses,
  answersOf: item => [item.answerWord ?? ''].filter(Boolean),
  specs: [
    { id: CHANGED_LETTER_LEVER, type: 'marks', modes: ['word_chains'], answers: ['previous_word'],
      when: 'The learner says the word before it again, reading the row from memory.',
      does: `Lights the one letter that changed from the word before: its place only.${NOTHING_SAID}`,
      content: item => (item.kind === 'chain_word' && item.chainCueLevel === 'none' && item.changedIndex !== undefined ? item.changedIndex : null),
      fact: 'The letter that changed from the word before is lit; nothing is said.' },
    { id: DOTS_LEVER, type: 'marks', modes: ['picture_match'], answers: 'all', content: dotsOn('picture_tap'),
      when: 'The learner taps a picture without reading the whole word, for example one that only starts the same.',
      does: `Puts a dot under each sound of the printed word and an arrow under it, left to right, so the learner reads every sound.${NOTHING_SAID}`,
      fact: DOTS_FACT },
    { id: DOTS_LEVER, type: 'marks', modes: ['real_vs_nonsense'], answers: ['said_nonword'], content: dotsOn('real_word'),
      when: 'The learner says the made-up word, picked by its first letter or shape.',
      does: 'Puts a dot under each sound of both printed words and an arrow under them, so the learner reads every sound of each.'
        + ' Nothing is said: do not read either word or its sounds.',
      fact: 'A dot under each sound of both printed words and an arrow under them; nothing is said.' },
    { id: DOTS_LEVER, type: 'marks', modes: ['word_chains'], answers: ['other_word'], content: dotsOn('chain_word'),
      when: 'The learner reads a different word.',
      does: `Puts a dot under each sound of the lit word and an arrow under it.${NOTHING_SAID}`, fact: DOTS_FACT },
    { id: DOTS_LEVER, type: 'marks', modes: ['choose_in_context'], answers: ['misread_word'], content: dotsOn('read_context_word'),
      when: 'The learner reads the lit word as its near neighbour or another word.',
      does: `Puts a dot under each sound of the lit word and an arrow under it.${NOTHING_SAID}`, fact: DOTS_FACT },
    { id: TWO_PICTURES_LEVER, type: 'easier', modes: ['picture_match'], answers: 'all',
      when: 'The learner cannot yet tell apart pictures whose words look alike.',
      does: 'Opens an easier practice item first: a different short word and only two pictures, the other one starting and ending '
        + 'differently. It is not graded; the full item comes back after it.',
      content: (item, ctx) => twoFarPictures(item, ctx.items, ctx.vowels) },
    { id: SHORT_CHAIN_LEVER, type: 'easier', modes: ['word_chains'], answers: ['previous_word', 'other_word'],
      when: 'The learner cannot yet read a word that changed by one letter.',
      does: 'Opens an easier practice item first: two new words where only the first letter changes, the change lit. '
        + 'It is not graded; the chain comes back after it.',
      content: (item, ctx) => shortChain(item, ctx.items, ctx.vowels) },
    { id: CHUNK_LEVER, type: 'marks', modes: ['read_inflected', 'read_compound'], answers: ['base_only'],
      when: 'After a first try: the learner reads only the first part of the word.',
      does: item => `Draws a bar between the ${item.wordMode === 'compound-word' ? 'two small words' : 'base and its ending'}.${NOTHING_SAID}`,
      content: chunkFor, offer: (item, ctx) => ctx.missed === item.id,
      fact: 'A bar between the two parts of the word; nothing is said.' },
    { id: EASIER_ENDING_LEVER, type: 'easier', modes: ['read_inflected'], answers: ['base_only', 'other_word'],
      when: 'The learner cannot yet read a word with this ending.',
      does: 'Opens an easier practice word first: a different word with the -s ending. It is not graded; the word comes back after it.',
      content: (item, ctx) => easierEnding(item, ctx.items, ctx.vowels) },
    { id: TRACK_LEVER, type: 'marks', modes: ['sentence_reading'], answers: ['word_swap', 'word_skip'], content: dotsOn('read_sentence'),
      when: 'The learner swaps or skips a small word.',
      does: 'Draws an underline under each word of the sentence, left to right, so every word is its own place to look.'
        + ' Nothing is said: do not read the sentence or any word of it.',
      fact: 'An underline under each word of the sentence, left to right; nothing is said.' },
    { id: SHORT_SENTENCE_LEVER, type: 'easier', modes: ['sentence_reading'], answers: ['word_swap', 'word_skip'],
      when: 'The learner cannot yet read a sentence this long.',
      does: 'Opens an easier practice sentence first: three new words. It is not graded; the sentence comes back after it.',
      content: (item, ctx) => threeWordSentence(item, ctx.items) },
    // Shown, not said: the icon names the kind of answer, never the word.
    { id: QUESTION_ICON_LEVER, type: 'clue', carrier: 'shown', modes: ['sentence_reading'], answers: ['lifted_word'],
      when: 'The learner says a word from the sentence that does not answer the question.',
      does: item => `Shows an icon beside the question for the kind of answer: ${questionIcon(item)?.label}. It names the kind, never the word.`,
      content: questionIcon,
      fact: (icon: { label: string }) => `An icon beside the question shows the answer is ${icon.label}.` },
  ],
});

/** The practice item the item's mode's easier lever opens, or null (the journey rebuilds `~simpler` items with it). */
export const practiceFor = (item: WordWorkoutItem, ctx: WordWorkoutLeverCtx): WordWorkoutItem | null =>
  WORD_WORKOUT_LEVERS.specs.filter(spec => spec.type === 'easier')
    .map(spec => WORD_WORKOUT_LEVERS.simpler(item, ctx, spec.id)).find(Boolean) ?? null;
