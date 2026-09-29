/**
 * The in-item levers on phonics-blender (`/add-support-tiers`, handoff 22 L3 table, built in handoff 24; user OK
 * 09-28). The learner reads the letters and says the whole word, so every help lever here is visual: the voice
 * reading the item's letters, or its sounds in a row, would do the decoding (the literacy rule "no audio of unread
 * print"). The tutor's one voiced model is on a letter outside the session.
 *
 * - `blend_slide` (help, shown): the letter cards slide together over an arrow; nothing is said. Answers
 *   `sounds_no_word`. Not offered where the tier already joins the row.
 * - `sound_dots` (help, shown): a dot under each sound's letters (one dot for a digraph). Only where the hard tier
 *   joined the row: it re-segments it (user ruling 09-28). Answers `first_sound_changed`, `middle_sound_changed`,
 *   `last_sound_changed`.
 * - `tracking_arrow` (help, shown): an arrow under the row, pointing left to right. Answers `read_backwards`.
 * - `name_sound_model` (help, both): a letter no session word uses, with its name and its sound side by side; the
 *   tutor says both. Answers `letter_name`. Leak rule (`nameModelLeak`): the letter is in no session word.
 * - `short_word` (simplify, shown): an ungraded practice word first. cvc: a two-letter word (at, up); the other
 *   modes: a CVC word with the item's vowel letter. Leak rule (`practiceLeak`): never a session word, and a
 *   two-letter word is never a session word's ending (at for cat would give away most of it).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { BlendItem } from './phonicsBlenderScript';
import type { SpokenBlendMiss } from './phonicsBlenderWorkspace';
import { PRACTICE_WORDS } from './cvcSpellerLevers';
import { letterNameFor, spokenSoundFor } from './letterSoundLinkDomain';

export const SLIDE_LEVER = 'blend_slide';
export const DOTS_LEVER = 'sound_dots';
export const ARROW_LEVER = 'tracking_arrow';
export const NAME_MODEL_LEVER = 'name_sound_model';
export const SHORT_WORD_LEVER = 'short_word';

export type Segmentation = 'full' | 'word' | 'none';
const low = (s: string) => s.trim().toLowerCase();
const VOWELS = 'aeiou';

/** Every word the session asks. */
const sessionWords = (items: readonly BlendItem[]) => new Set(items.map(i => low(i.targetWord)));

// ── name_sound_model ─────────────────────────────────────────────────────────

export interface NameModel { letter: string; name: string; sound: string }
/** Held sounds first: the contrast between "em" and "mmm" is the easiest to hear. */
const MODEL_ORDER = 'msfnlrvzaotpdbgh'.split('');

export const nameModelLeak = (m: NameModel, items: readonly BlendItem[]) =>
  items.some(i => low(i.targetWord).includes(m.letter));

export function nameModelFor(items: readonly BlendItem[]): NameModel | null {
  for (const letter of MODEL_ORDER) {
    const name = letterNameFor(letter);
    const model = { letter, name: name ?? '', sound: spokenSoundFor(letter, `/${letter}/`) };
    if (name && !nameModelLeak(model, items)) return model;
  }
  return null;
}

// ── short_word ───────────────────────────────────────────────────────────────

const TWO_LETTER_WORDS = ['at', 'up', 'in', 'on', 'it', 'am', 'an', 'if', 'us'];
const vowelOf = (word: string) => low(word).split('').find(ch => VOWELS.includes(ch)) ?? '';

/** Leak rule for a practice word: a session word, or (two letters) the ending of a session word. */
export function practiceLeak(word: string, items: readonly BlendItem[]): boolean {
  const w = low(word);
  return sessionWords(items).has(w) || (w.length === 2 && items.some(i => low(i.targetWord).endsWith(w)));
}

const asItem = (id: string, word: string, emoji?: string): BlendItem => ({ id, targetWord: word, emoji,
  phonemes: word.split('').map((l, i) => ({ id: `${id}-p${i}`, letters: l, sound: `/${l === 'c' ? 'k' : l}/` })) });

/**
 * The practice word for `item`: one structural step less, same task (read the letters, say the word). cvc: a
 * two-letter word. The other modes: a CVC word with the item's vowel letter. Null when the pool has none.
 */
export function shortWordFor(item: BlendItem, mode: string, items: readonly BlendItem[]): BlendItem | null {
  const id = `${item.id}~simpler`;
  if (mode === 'cvc') {
    const word = TWO_LETTER_WORDS.find(w => !practiceLeak(w, items));
    return word ? asItem(id, word) : null;
  }
  const vowel = vowelOf(item.targetWord);
  const pick = PRACTICE_WORDS.find(p => p.word[1] === vowel && !p.word.includes('x') && !practiceLeak(p.word, items));
  return pick ? asItem(id, pick.word, pick.emoji) : null;
}

// ── the levers ───────────────────────────────────────────────────────────────

/** What the pulled levers put on screen, for the tutor. Never the word or a sound of it. */
export function leversOnScreen(pulled: readonly string[], items: readonly BlendItem[]): string | null {
  const model = pulled.includes(NAME_MODEL_LEVER) ? nameModelFor(items) : null;
  const parts = [
    pulled.includes(SLIDE_LEVER) && 'the letter cards slid close together over an arrow. Say nothing about the letters: the learner reads them',
    pulled.includes(DOTS_LEVER) && 'a dot under each sound\'s letters, one dot for two letters that make one sound',
    pulled.includes(ARROW_LEVER) && 'an arrow under the letters pointing from left to right',
    model && `a model on another letter, ${model.letter.toUpperCase()}: its name "${model.name}" beside its sound ${model.sound}. `
      + 'Say both; it is not a letter of this word',
  ].filter(Boolean);
  return parts.length ? parts.join('; ') : null;
}

export function phonicsBlenderLevers(item: BlendItem | null, mode: string, segmentation: Segmentation,
  pulled: readonly string[], items: readonly BlendItem[]): WorkspaceLever[] {
  if (!item) return [];
  const levers: WorkspaceLever[] = [];
  const add = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: SpokenBlendMiss[],
    when: string, does: string) => levers.push({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  if (segmentation !== 'none') add(SLIDE_LEVER, 'help', 'shown', ['sounds_no_word'],
    'The learner says the sounds but never the word.',
    'Slides the letter cards close together over an arrow, so the sounds run into one word. Say nothing about the letters.');
  if (segmentation === 'none') add(DOTS_LEVER, 'help', 'shown', ['first_sound_changed', 'middle_sound_changed', 'last_sound_changed'],
    'The learner says a close but different word.',
    'Puts a dot under each sound\'s letters in the joined word, one dot for two letters that make one sound.');
  add(ARROW_LEVER, 'help', 'shown', ['read_backwards'], 'The learner reads the letters from right to left.',
    'Draws an arrow under the letters pointing from left to right.');
  const model = nameModelFor(items);
  if (model) add(NAME_MODEL_LEVER, 'help', 'both', ['letter_name'], 'The learner says letter names instead of sounds.',
    'Shows another letter with its name and its sound side by side. Once it is on screen, say both. It is not a letter '
    + 'of this word.');
  if (shortWordFor(item, mode, items)) add(SHORT_WORD_LEVER, 'simplify', 'shown',
    ['sounds_no_word', 'first_sound_changed', 'middle_sound_changed', 'last_sound_changed'],
    'The learner still cannot blend this word after help.',
    `Opens an easier practice word first: ${mode === 'cvc' ? 'a word with two letters' : 'a short word with three letters'}. `
    + 'It is not graded; the full word comes back after it.');
  return levers;
}
