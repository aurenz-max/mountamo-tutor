/**
 * The in-item levers on word-workout (`/add-support-tiers`, handoff 22): picture match (L1) and the spoken read
 * modes (L3). Every printed word here is read cold, so every help lever is a visual mark from the shared kit
 * overlay (`LuminaPrintSupport`) and nothing is said: no audio of unread print.
 *
 * Pure: the component draws from these, the workspace publishes them, and the tests hold each leak rule.
 * - `sound_dots` (help): a dot under each grapheme of the printed word or words and a left-to-right arrow. Leak
 *   rule: visual only, the letters unchanged, no picture marked.
 * - `two_far_pictures` (simplify, picture match): an ungraded practice item first, a new printed CVC word and two
 *   pictures, the foil sharing neither its first nor its last letter. Both words use only the lesson's vowels
 *   (contract R1), so in a one-vowel lesson the foil shares the vowel. Leak rule: never a session word or a session
 *   word's rime, and no session picture.
 * - `changed_letter` (help, word chains where the tier hid the change): the letter that changed from the word
 *   before is lit. Its place only.
 * - `short_chain` (simplify, word chains): two new words, only the first letter changes, the change lit.
 * - `chunk_divider` (help, inflected and compound, only after a first try): a bar between the base and its ending,
 *   or the two words. The word's chunks are shown only after a cold attempt (contract R10), so a pull before one is refused.
 * - `easier_ending` (simplify, inflected -ing/-ed): a new pool word with the -s ending.
 * - `tracking_underline` (help, sentence reading): one underline under each word, left to right.
 * - `three_word_sentence` (simplify, sentence reading): a new three-word decodable line from the code pool.
 * - `question_word_icon` (help, the sentence question): an icon for the kind of answer (who, what, where).
 *
 * Every simplify item is built here from a code pool and prints no word the session prints (R3).
 * Spoken misses are declared (`WORD_WORKOUT_SPOKEN_MISSES`) and not emitted until handoff 20 Part B lands.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { chunkBreak, dotsLeak, graphemes } from '../../../ui/printSupport';
import { PRACTICE_WORDS } from './cvcSpellerLevers';
import { practiceLine, printedSet, wordsOf } from './decodablePracticeLines';
import { EARLY_EXTENDED_WORDS } from './wordWorkoutEarlyDecoding';
import { COMMON_CVC_WORDS, type WordWorkoutItem } from './wordWorkoutScript';

export { dotsLeak, graphemes };

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

/** The catalog eval mode an item belongs to. */
export function wordWorkoutEvalMode(item: WordWorkoutItem): keyof typeof WORD_WORKOUT_SPOKEN_MISSES | 'picture_match' {
  switch (item.kind) {
    case 'real_word': return 'real_vs_nonsense';
    case 'picture_tap': return 'picture_match';
    case 'chain_word': return 'word_chains';
    case 'read_extended_word': case 'answer_word_meaning': return item.wordMode === 'compound-word' ? 'read_compound' : 'read_inflected';
    case 'read_context_word': case 'choose_context_word': return 'choose_in_context';
    case 'read_sentence': case 'answer_question': return 'sentence_reading';
  }
}

/**
 * The misses a spoken answer will name, per mode: what was said, never a guessed cause. None is emitted until
 * spoken misses land (handoff 20 Part B), so the catalog lists every one as unanswered for J9 until then.
 * `wrong_fit` (choose in context) gets no lever by decision: with two printed words, any mark about fit points at
 * the answer, and the ask already says the sentence aloud.
 */
export const WORD_WORKOUT_SPOKEN_MISSES = {
  real_vs_nonsense: ['said_nonword'],
  word_chains: ['previous_word', 'other_word'],
  read_inflected: ['base_only', 'other_word'],
  read_compound: ['base_only', 'other_word'],
  choose_in_context: ['misread_word', 'wrong_fit'],
  sentence_reading: ['word_swap', 'word_skip', 'lifted_word'],
} as const;

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

/** The practice item a simplify lever opens, or null. */
export function practiceFor(id: string, item: WordWorkoutItem, items: readonly WordWorkoutItem[], vowels: readonly string[]): WordWorkoutItem | null {
  switch (id) {
    case TWO_PICTURES_LEVER: return twoFarPictures(item, items, vowels);
    case SHORT_CHAIN_LEVER: return shortChain(item, items, vowels);
    case EASIER_ENDING_LEVER: return easierEnding(item, items, vowels);
    case SHORT_SENTENCE_LEVER: return threeWordSentence(item, items);
    default: return null;
  }
}

/** R3 for a spoken practice item: true when any word it prints is a word the session prints. */
export function spokenPracticeLeak(practice: WordWorkoutItem, items: readonly WordWorkoutItem[]): boolean {
  const printed = printedBySession(items);
  const words = practice.kind === 'read_sentence' ? wordsOf(practice.sentence)
    : practice.kind === 'chain_word' ? [...(practice.chain ?? [])] : [practice.targetWord ?? ''];
  return words.some(w => printed.has(w.toLowerCase()));
}

/** What the pulled levers put on screen, for the scene. Names the marks, never a word or the answer. */
export function leversOnScreen(item: WordWorkoutItem, pulled: readonly string[]): string | null {
  const on: string[] = [];
  if (pulled.includes(DOTS_LEVER)) on.push(item.kind === 'real_word' ? 'a dot under each sound of both printed words and an arrow under them'
    : 'a dot under each sound of the printed word and an arrow under it, left to right');
  if (pulled.includes(CHANGED_LETTER_LEVER)) on.push('the letter that changed from the word before is lit');
  if (pulled.includes(CHUNK_LEVER)) on.push('a bar between the two parts of the word');
  if (pulled.includes(TRACK_LEVER)) on.push('an underline under each word of the sentence, left to right');
  const icon = pulled.includes(QUESTION_ICON_LEVER) ? questionIcon(item) : null;
  if (icon) on.push(`an icon beside the question showing the answer is ${icon.label}`);
  return on.length ? `${on.join('; ')}; nothing is said` : null;
}

const lever = (id: string, kind: 'help' | 'simplify', pulled: readonly string[], answers: readonly string[], when: string,
  does: string): WorkspaceLever => ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers: [...answers], when, does });

const NOTHING_SAID = ' Nothing is said: do not read the word or its sounds.';

/** The levers this item declares, with their state. */
export function wordWorkoutLevers(item: WordWorkoutItem | null, pulled: readonly string[], items: readonly WordWorkoutItem[],
  vowels: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  const out: WorkspaceLever[] = [];
  switch (item.kind) {
    case 'picture_tap': {
      if (!item.targetWord) return [];
      const all = ['same_start', 'same_end', 'same_vowel', 'other_word'];
      out.push(lever(DOTS_LEVER, 'help', pulled, all,
        'The learner taps a picture without reading the whole word, for example one that only starts the same.',
        'Puts a dot under each sound of the printed word and an arrow under it, left to right, so the learner reads every sound. '
        + 'Nothing is said: do not read the word or its sounds.'));
      if (twoFarPictures(item, items, vowels)) out.push(lever(TWO_PICTURES_LEVER, 'simplify', pulled, all,
        'The learner cannot yet tell apart pictures whose words look alike.',
        'Opens an easier practice item first: a different short word and only two pictures, the other one starting and ending differently. '
        + 'It is not graded; the full item comes back after it.'));
      break;
    }
    case 'real_word':
      out.push(lever(DOTS_LEVER, 'help', pulled, ['said_nonword'], 'The learner says the made-up word, picked by its first letter or shape.',
        'Puts a dot under each sound of both printed words and an arrow under them, so the learner reads every sound of each.'
        + ' Nothing is said: do not read either word or its sounds.'));
      break;
    case 'chain_word':
      if (item.chainCueLevel === 'none' && item.changedIndex !== undefined) out.push(lever(CHANGED_LETTER_LEVER, 'help', pulled, ['previous_word'],
        'The learner says the word before it again, reading the row from memory.',
        'Lights the one letter that changed from the word before: its place only.' + NOTHING_SAID));
      out.push(lever(DOTS_LEVER, 'help', pulled, ['other_word'], 'The learner reads a different word.',
        'Puts a dot under each sound of the lit word and an arrow under it.' + NOTHING_SAID));
      if (shortChain(item, items, vowels)) out.push(lever(SHORT_CHAIN_LEVER, 'simplify', pulled, ['previous_word', 'other_word'],
        'The learner cannot yet read a word that changed by one letter.',
        'Opens an easier practice item first: two new words where only the first letter changes, the change lit. '
        + 'It is not graded; the chain comes back after it.'));
      break;
    case 'read_extended_word':
      if (chunkFor(item) !== null) out.push(lever(CHUNK_LEVER, 'help', pulled, ['base_only'],
        'After a first try: the learner reads only the first part of the word.',
        `Draws a bar between the ${item.wordMode === 'compound-word' ? 'two small words' : 'base and its ending'}.` + NOTHING_SAID));
      if (easierEnding(item, items, vowels)) out.push(lever(EASIER_ENDING_LEVER, 'simplify', pulled, ['base_only', 'other_word'],
        'The learner cannot yet read a word with this ending.',
        'Opens an easier practice word first: a different word with the -s ending. It is not graded; the word comes back after it.'));
      break;
    case 'read_context_word':
      out.push(lever(DOTS_LEVER, 'help', pulled, ['misread_word'], 'The learner reads the lit word as its near neighbour or another word.',
        'Puts a dot under each sound of the lit word and an arrow under it.' + NOTHING_SAID));
      break;
    case 'read_sentence':
      out.push(lever(TRACK_LEVER, 'help', pulled, ['word_swap', 'word_skip'], 'The learner swaps or skips a small word.',
        'Draws an underline under each word of the sentence, left to right, so every word is its own place to look.'
        + ' Nothing is said: do not read the sentence or any word of it.'));
      if (threeWordSentence(item, items)) out.push(lever(SHORT_SENTENCE_LEVER, 'simplify', pulled, ['word_swap', 'word_skip'],
        'The learner cannot yet read a sentence this long.',
        'Opens an easier practice sentence first: three new words. It is not graded; the sentence comes back after it.'));
      break;
    case 'answer_question': {
      const icon = questionIcon(item);
      if (icon) out.push(lever(QUESTION_ICON_LEVER, 'help', pulled, ['lifted_word'],
        'The learner says a word from the sentence that does not answer the question.',
        `Shows an icon beside the question for the kind of answer: ${icon.label}. It names the kind, never the word.`));
      break;
    }
    // Meaning and fit answers get no lever (see WORD_WORKOUT_SPOKEN_MISSES).
    case 'answer_word_meaning':
    case 'choose_context_word':
      break;
  }
  return out;
}
