/**
 * The in-item levers on di-word-reading (`/add-support-tiers`, DI family 5; table
 * qa/support-levers/di-word-reading-lever-table-2026-10-03.md). No real-learner evidence: the misses are what
 * `diWordReadingSpokenMisses` names, and the catalog's `commonStruggles`.
 *
 * DI's correction is a PARALLEL-ITEM model (user ruling 2026-10-02): a different word, read, then the child's. Help on
 * the child's own word is visual only: a voice on unread print would do the decoding (the literacy rule).
 *
 * Help:
 * - `model_word` (every item): a small card with a DIFFERENT word. Decodable: a picturable CVC word with its picture,
 *   which the tutor blends ("sss-uuu-nnn, sun"). Sight: a different sight word, said whole. Never a session word,
 *   never sharing a letter with the item (so the blend says none of its sounds and it is never one letter off or a rime
 *   neighbour), never the item reversed, never a look-alike of a sight item either way round.
 * - `blend_slide` (decodable): the printed letters slide together over an arrow. Nothing plays.
 * - `sound_dots` (decodable): a dot under each letter, one stop per sound for a finger.
 * - `tracking_arrow` (decodable): an arrow under the word, left to right.
 * Simplify:
 * - `short_word` (decodable items): an ungraded two-letter word (at, up, in…), the same act with one sound fewer (R7).
 *   Never a session word, and never the start or end of one (at for cat gives away most of it).
 * A sight word the child does not know gets no lever (R6): it has no decodable path, and hearing it is the answer.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { PRACTICE_WORDS } from '../literacy/cvcSpellerLevers';
import { SIGHT_LOOKALIKES } from '../literacy/spokenReadingMisses';
import { buildWordReadingItems, type WordReadingItem } from './diWordReadingDomain';

export const MODEL_WORD = 'model_word';
export const BLEND_SLIDE = 'blend_slide';
export const SOUND_DOTS = 'sound_dots';
export const TRACKING_ARROW = 'tracking_arrow';
export const SHORT_WORD = 'short_word';

/** Sight models: the menu's eight and a few the menu never asks, so a six-sight session still has some. */
export const SIGHT_POOL = ['the', 'see', 'go', 'to', 'is', 'we', 'my', 'and', 'you', 'are', 'was', 'said', 'of'];
const TWO_LETTER_WORDS = ['at', 'up', 'in', 'on', 'it', 'am', 'an', 'if', 'us'];
const POSITION = ['first_sound_changed', 'middle_sound_changed', 'last_sound_changed'];

/** The blend for a model word, e.g. "sss-uuu-nnn". */
const HELD: Record<string, string> = { a: 'aaa', e: 'eee', i: 'iii', o: 'ooo', u: 'uuu', m: 'mmm', s: 'sss', f: 'fff', r: 'rrr',
  n: 'nnn', l: 'lll', v: 'vvv', z: 'zzz', c: 'k', x: 'ks' };
export const blendOf = (word: string) => word.split('').map(l => HELD[l] ?? l).join('-');

export interface WordModel { word: string; emoji?: string; decodable: boolean }

const decodable = (item: WordReadingItem) => item.letters.length > 0;
const sharesLetter = (a: string, b: string) => a.split('').some(l => b.includes(l));
const lookAlike = (a: string, b: string) => (SIGHT_LOOKALIKES[a] ?? []).includes(b) || (SIGHT_LOOKALIKES[b] ?? []).includes(a);

/** The model's leak rule against the child's word and the session. */
export function modelLeaks(model: string, item: WordReadingItem, items: readonly WordReadingItem[]): boolean {
  const w = item.word;
  return items.some(i => i.word === model) || sharesLetter(model, w) || model === w.split('').reverse().join('')
    || lookAlike(model, w);
}

/** The model a word's `model_word` shows, or null. Deterministic: prefers a word sharing no letter with any session word. */
export function modelFor(item: WordReadingItem, items: readonly WordReadingItem[]): WordModel | null {
  const clean = (word: string) => Number(items.some(i => sharesLetter(word, i.word)));
  if (decodable(item)) {
    const pick = PRACTICE_WORDS.filter(p => !modelLeaks(p.word, item, items)).sort((a, b) => clean(a.word) - clean(b.word))[0];
    return pick ? { word: pick.word, emoji: pick.emoji, decodable: true } : null;
  }
  const pick = SIGHT_POOL.filter(w => !modelLeaks(w, item, items)).sort((a, b) => clean(a) - clean(b))[0];
  return pick ? { word: pick, decodable: false } : null;
}

/** The two-letter practice word `short_word` opens, as an item of the same mode, or null. */
export function shortWordFor(item: WordReadingItem, items: readonly WordReadingItem[]): WordReadingItem | null {
  if (!decodable(item) || item.letters.length < 3) return null;
  const word = TWO_LETTER_WORDS.find(w => !items.some(i => i.word === w || i.word.startsWith(w) || i.word.endsWith(w)));
  if (!word) return null;
  const [built] = buildWordReadingItems([{ id: `${item.id}~simpler`, challengeType: item.challengeType, word, wordType: 'cvc',
    graphemes: word.split(''), supportTier: item.supportTier }]);
  return built ?? null;
}

export const startingLevers = (item: WordReadingItem, items: readonly WordReadingItem[]): string[] =>
  item.supportTier === 'easy' && modelFor(item, items) ? [MODEL_WORD] : [];

export function wordLevers(item: WordReadingItem | null, pulled: readonly string[], items: readonly WordReadingItem[]): WorkspaceLever[] {
  if (!item) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: string[], when: string,
    does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const out: WorkspaceLever[] = [];
  const dec = decodable(item);
  if (modelFor(item, items)) out.push(lever(MODEL_WORD, 'help', 'both',
    dec ? ['letter_name', 'sounds_no_word', 'read_backwards', ...POSITION] : ['letter_name', 'sounds_no_word', 'similar_word'],
    'The learner spells the word, says sounds with no word, says a different word, or does not know how to start.',
    dec
      ? 'Shows a small card with a DIFFERENT word and its picture (onScreen names it). Read it as your turn, sounds then the '
        + 'word, sweeping left to right ("My turn: sss-uuu-nnn, sun"). Then ask the learner to read their own word. Never sound '
        + 'out, name, or rhyme their word.'
      : 'Shows a small card with a DIFFERENT sight word (onScreen names it). Say it once, whole, as your turn ("My turn: this word '
        + 'is …"); never sound it out. Then ask the learner to read their own word. Never say their word.'));
  if (dec) {
    out.push(lever(BLEND_SLIDE, 'help', 'shown', ['sounds_no_word'],
      'The learner says the sounds and never the whole word.',
      'Slides the printed letters together over an arrow. Nothing plays; say "slide them together", never the word.'));
    out.push(lever(SOUND_DOTS, 'help', 'shown', POSITION,
      'The learner says a real word with one sound changed.',
      'Puts a dot under each letter: one stop per sound for a finger. Say nothing about which sound.'));
    out.push(lever(TRACKING_ARROW, 'help', 'shown', ['read_backwards'],
      'The learner reads the word backwards.',
      'Draws an arrow under the word pointing left to right.'));
  }
  if (shortWordFor(item, items)) out.push(lever(SHORT_WORD, 'simplify', 'shown', ['letter_name', 'sounds_no_word', ...POSITION],
    'This word is too long to blend yet.',
    'Opens a shorter word first, two letters, same job: read it. It is not graded; the full word comes back after it. Do not read it for the learner.'));
  return out;
}

/** What the pulled levers put on screen, as a scene fact. Names the model; never the child's word. */
export function wordLeverFacts(item: WordReadingItem | null, pulled: readonly string[], items: readonly WordReadingItem[]): string {
  if (!item) return '';
  const model = pulled.includes(MODEL_WORD) ? modelFor(item, items) : null;
  return [
    model && (model.decodable
      ? `Beside the learner's word, a model card shows a different word with its picture: "${model.word}", read ${blendOf(model.word)}, ${model.word}. It is not this word.`
      : `Beside the learner's word, a model card shows a different sight word: "${model.word}", said whole. It is not this word.`),
    pulled.includes(BLEND_SLIDE) && 'The printed letters slide together over an arrow.',
    pulled.includes(SOUND_DOTS) && 'A dot sits under each printed letter.',
    pulled.includes(TRACKING_ARROW) && 'An arrow under the word points left to right.',
  ].filter((s): s is string => !!s).join(' ');
}
