/**
 * The in-item levers on di-letter-sounds (`/add-support-tiers`, DI family 4; table
 * qa/support-levers/di-letter-sounds-lever-table-2026-10-03.md). No real-learner evidence: the misses are what
 * `diLetterSoundSpokenMisses` names, and the catalog's `commonStruggles`.
 *
 * DI's correction is a PARALLEL-ITEM model (user ruling 2026-10-02): a different letter, its sound said, then the
 * child's letter again.
 *
 * Help (the screen shows more; the question is unchanged):
 * - `model_sound` (every mode): a small card with a DIFFERENT letter and its picture (first_sound_in_word: a different
 *   picture and its word). Never the item's letter or its sound (c and k both say /k/), never its confusable or
 *   voicing partner (that primes `other_sound`), never a letter of the item's keyword (so never its last sound), never a
 *   letter or picture of an item still to come. Same kind of sound as the item: held, clipped or short vowel; held only
 *   on first_sound_in_word (the mode floor).
 * - `sound_arrow` (letter_sound, review; held letters only): DISTAR's continuous-sound mark under the printed letter, a
 *   ball and a long arrow. It says "hold it", never which sound. Never on a stop or a vowel.
 * - `keyword_picture` (letter_sound, review; ruling R4): the keyword picture. It starts on screen only at easy; at medium
 *   and hard it is a pull, recorded as help, because a child who hears first sounds can answer from it.
 * - `first_box` (first_sound_in_word): a row of empty boxes under the picture, one per sound of the word, the first lit.
 *   No letter, no sound.
 * No simplify on any mode: another letter asks the same thing, not less, and every onset item is already at the mode
 * floor (one held continuant).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { LETTER_SOUND_MENU, type LetterSoundMenuEntry } from './diLetterSoundsMenu';
import type { LetterSoundItem } from './diLetterSoundsDomain';

export const MODEL_SOUND = 'model_sound';
export const SOUND_ARROW = 'sound_arrow';
export const KEYWORD_PICTURE = 'keyword_picture';
export const FIRST_BOX = 'first_box';

const HELD = new Set(['s', 'n', 'm', 'f', 'l', 'r', 'v', 'z']);
/** Confusable and voicing partners, and letters that share a sound: a model of one primes the other. */
const PARTNERS: ReadonlyArray<readonly [string, string]> = [['m', 'n'], ['f', 'v'], ['s', 'z'], ['t', 'd'], ['p', 'b'],
  ['k', 'g'], ['c', 'g'], ['c', 'k'], ['e', 'i']];
const partners = (a: string, b: string) => PARTNERS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** Sounds per held keyword, for `first_box` (fish is f-i-sh: 3 sounds, 4 letters). */
export const KEYWORD_SOUNDS: Readonly<Record<string, number>> = { moon: 3, sun: 3, fish: 3, ring: 3, nest: 4, leaf: 3, van: 3, zebra: 5 };

type Kind = 'held' | 'clipped' | 'vowel';
const kindOf = (e: { elicitation: string; articulation?: string }): Kind =>
  e.elicitation === 'keyword' ? 'vowel' : e.articulation === 'clipped' ? 'clipped' : 'held';

const isGrapheme = (item: LetterSoundItem) => item.challengeType !== 'first_sound_in_word';
const MENU = Object.values(LETTER_SOUND_MENU);

/** The model letter for an item, or null when no menu letter passes the leak rules. Deterministic per item. */
export function modelFor(item: LetterSoundItem, items: readonly LetterSoundItem[]): LetterSoundMenuEntry | null {
  const at = items.findIndex(i => i.id === item.id);
  const coming = at < 0 ? [] : items.slice(at + 1);
  const later = new Set(coming.map(i => i.letter.toLowerCase())), laterWords = new Set(coming.map(i => i.keyword.toLowerCase()));
  const anywhere = new Set(items.map(i => i.letter.toLowerCase()));
  const l = item.letter.toLowerCase(), word = item.keyword.toLowerCase();
  const kind: Kind = item.challengeType === 'first_sound_in_word' ? 'held' : kindOf(item);
  const pass = (m: LetterSoundMenuEntry) => m.letter !== l && m.spoken !== item.spoken && !partners(m.letter, l)
    && !word.includes(m.letter) && !later.has(m.letter) && !laterWords.has(m.keyword) && m.keyword !== word
    && kindOf(m) === kind;
  // A letter the session never asks is best; a past one is allowed (it does not return).
  return MENU.filter(pass).sort((a, b) => Number(anywhere.has(a.letter)) - Number(anywhere.has(b.letter)))[0] ?? null;
}

/** Levers an item's tier starts with on screen (no tier is easy). Not a pull; never recorded. */
export function startingLevers(item: LetterSoundItem, items: readonly LetterSoundItem[]): string[] {
  if (item.supportTier !== 'easy') return [];
  return [...(modelFor(item, items) ? [MODEL_SOUND] : []), ...(isGrapheme(item) ? [KEYWORD_PICTURE] : [])];
}

/** The keyword picture is on screen: always on an onset item (it carries the spoken word), else only as a lever. */
export const pictureShown = (item: LetterSoundItem, pulled: readonly string[]) =>
  !isGrapheme(item) || pulled.includes(KEYWORD_PICTURE);

export function letterLevers(item: LetterSoundItem | null, pulled: readonly string[], items: readonly LetterSoundItem[]): WorkspaceLever[] {
  if (!item) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: string[], when: string,
    does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const onset = item.challengeType === 'first_sound_in_word';
  const out: WorkspaceLever[] = [];
  if (modelFor(item, items)) out.push(lever(MODEL_SOUND, 'help', 'both',
    ['keyword_word', 'letter_name', 'added_vowel', 'other_sound', ...(onset ? ['last_sound'] : [])],
    'The learner says a word, a letter name, or another sound, or does not know how to start.',
    onset
      ? 'Shows a small card with a DIFFERENT picture and its word (onScreen names it). Say it as your turn: the word, then '
        + 'its first sound ("My turn: leaf … lll"). Then ask for the first sound of the learner\'s own word. Never say their '
        + 'word\'s first sound, and never stretch its start.'
      : 'Shows a small card with a DIFFERENT letter and its picture (onScreen names it). Say its sound as your turn ("My turn: '
        + 'this letter says lll, like leaf"), held or clipped as onScreen says. After a letter name you may add "its name is …; '
        + 'its sound is …" for the MODEL letter only. Then ask the learner\'s letter again. Never say their letter\'s sound or '
        + 'its picture word.'));
  if (isGrapheme(item) && kindOf(item) === 'held' && HELD.has(item.letter.toLowerCase())) out.push(lever(SOUND_ARROW, 'help', 'shown',
    ['added_vowel'], 'The learner adds a vowel after the sound ("muh") instead of holding it.',
    'Draws a ball and a long arrow under the printed letter: hold the sound while a finger moves along it. Say "hold it", never the sound.'));
  if (isGrapheme(item)) out.push(lever(KEYWORD_PICTURE, 'help', 'shown', ['other_sound', 'letter_name'],
    'The learner says another letter\'s sound or the letter\'s name.',
    'Shows the letter\'s picture above it. Do not name the picture or say its first sound; let the learner use it.'));
  if (onset && KEYWORD_SOUNDS[item.keyword.toLowerCase()]) out.push(lever(FIRST_BOX, 'help', 'shown', ['last_sound'],
    'The learner says the last sound of the word.',
    'Draws a row of empty boxes under the picture, one per sound of the word, the first one lit: the first box is the start of the word. Nothing is written in the boxes.'));
  return out;
}

const soundOf = (m: LetterSoundMenuEntry) => kindOf(m) === 'held' ? `the held sound ${m.spoken}`
  : kindOf(m) === 'clipped' ? `the short clipped sound ${m.spoken}` : `the short vowel sound ${m.spoken}`;

/** What the pulled levers put on screen, as a scene fact. Names the model; never the child's answer. */
export function letterLeverFacts(item: LetterSoundItem | null, pulled: readonly string[], items: readonly LetterSoundItem[]): string {
  if (!item) return '';
  const model = pulled.includes(MODEL_SOUND) ? modelFor(item, items) : null;
  const onset = item.challengeType === 'first_sound_in_word';
  return [
    model && (onset
      ? `Beside the learner's picture, a model card shows a different picture, a ${model.keyword}, with its word; its first sound is ${soundOf(model)}. It is not this word.`
      : `Beside the learner's letter, a model card shows a different letter, ${model.letter}, with its picture, a ${model.keyword}; it says ${soundOf(model)}. It is not this letter.`),
    pulled.includes(SOUND_ARROW) && 'A ball and a long arrow under the printed letter show the sound is held.',
    isGrapheme(item) && pulled.includes(KEYWORD_PICTURE) && 'The letter\'s picture is shown above it.',
    onset && pulled.includes(FIRST_BOX) && `A row of ${KEYWORD_SOUNDS[item.keyword.toLowerCase()]} empty boxes under the picture, one per sound of the word; the first box is lit.`,
  ].filter((s): s is string => !!s).join(' ');
}
