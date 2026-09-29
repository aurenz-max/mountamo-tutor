/**
 * The in-item levers on rhyme-studio (`/add-support-tiers`, handoff 22 L2), the pilot for spoken levers. Every
 * answer here is spoken, so no lever may put a choice or a tap where the learner had to say a word (R2), and no
 * lever may stretch, split or light the item's own words (contract R2): any emphasis on them answers the item.
 * Help acts on a code-owned model set outside the session (`rhymeModels.ts`); simplify opens a NEW ungraded
 * item from a family the session does not use (R3), in the same mode.
 *
 * - `contrast_model` (help; recognition, identification): beside the item, a model rhyme pair whose endings
 *   light up together and a model same-start pair whose first sounds light up (bee/tree, bee/bus).
 * - `name_choices` (help; identification, only where the tier withdrew the read-aloud): each choice card gets a
 *   speaker mark and the tutor may read the choices, evenly, in screen order.
 * - `onset_swap_model` (help; production, collection): a model word with its first sound swapped twice
 *   (sock, rock, lock), the strategy shown on words that are not the target's family.
 * - `onset_strip` (help; production, collection): six picture cards, each a single first sound, never the
 *   target's own. The learner puts one on the front of the ending; nothing composes a word for them.
 * - `far_pair` / `far_foil_item` / `dense_family_item` (simplify): an easier practice item of the same mode.
 *
 * Misses: every mode here is judged from speech, and spoken misses are not emitted yet (handoff 20 Part B).
 * The ids below are the ones they will carry; until then `nextLever` goes help-first and the catalog lists
 * them as unanswered for J9.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { itemFromChallenge, rhymeSessionWords, type RhymeItem } from './rhymeStudioScript';
import { freeFamilies, onsetOf, pickModelRhymeSet, rimeOfWord, type PicturedWord, type RhymeModelSet } from './rhymeModels';

export const CONTRAST_LEVER = 'contrast_model';
export const NAME_CHOICES_LEVER = 'name_choices';
export const SWAP_LEVER = 'onset_swap_model';
export const STRIP_LEVER = 'onset_strip';
export const FAR_PAIR_LEVER = 'far_pair';
export const FAR_FOIL_LEVER = 'far_foil_item';
export const DENSE_LEVER = 'dense_family_item';

/** The misses a spoken rhyme answer will name once spoken misses land (handoff 20 Part B). */
export const RHYME_MISSES = {
  recognition: ['yes_same_start', 'yes_no_rhyme', 'no_to_rhyme'],
  identification: ['onset_foil', 'echo_target', 'off_menu'],
  production: ['echo_target', 'same_start', 'meaning_neighbour', 'nonword'],
  collection: ['echo_target', 'same_start', 'meaning_neighbour', 'nonword', 'already_collected'],
} as const;
export type RhymeMiss = typeof RHYME_MISSES[keyof typeof RHYME_MISSES][number];

/** Single first sounds, each on a picture whose word is long enough never to rhyme with a CVC target. */
export const ONSET_CARDS: ReadonlyArray<PicturedWord & { sound: string }> = [
  { sound: 'b', word: 'banana', emoji: '🍌' }, { sound: 'm', word: 'monkey', emoji: '🐒' },
  { sound: 's', word: 'sandwich', emoji: '🥪' }, { sound: 'f', word: 'feather', emoji: '🪶' },
  { sound: 'r', word: 'rabbit', emoji: '🐰' }, { sound: 'h', word: 'horse', emoji: '🐴' },
  { sound: 'p', word: 'penguin', emoji: '🐧' }, { sound: 'l', word: 'lemon', emoji: '🍋' },
  { sound: 't', word: 'tiger', emoji: '🐯' },
];
const STRIP_SIZE = 6;

/** A stable 0/1 from an id, so a practice verdict or choice order is not predictable from the item. */
const bit = (id: string) => id.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 2;

/** The model set for recognition and identification: a rhyme pair and a same-start pair, off the session. */
export const contrastModelFor = (items: readonly RhymeItem[]): RhymeModelSet | null =>
  pickModelRhymeSet(rhymeSessionWords(items));

/** The model set for production and collection: three words one first sound apart, off the session. */
export const swapModelFor = (items: readonly RhymeItem[]): RhymeModelSet | null =>
  pickModelRhymeSet(rhymeSessionWords(items), { swap: true });

/** The onset cards for an item: never the target's own first sound (saying it back is not a rhyme). */
export const onsetCardsFor = (item: RhymeItem) =>
  ONSET_CARDS.filter(c => c.sound !== onsetOf(item.targetWord)).slice(0, STRIP_SIZE);

/** First sounds of the words a collection already holds: their cards show as used. */
export const usedOnsets = (collected: readonly string[]) => new Set(collected.map(onsetOf).filter(Boolean));

/** Leak rule for a model set: true if any of its words, or their endings, is the session's. */
export const modelLeak = (model: RhymeModelSet, items: readonly RhymeItem[]) => {
  const used = rhymeSessionWords(items);
  return [...model.words, model.onsetFoil].some(w => used.words.has(w.word) || used.rimes.has(rimeOfWord(w.word)));
};

/** Two free families whose words share no first sound and no vowel with each other: a clean rhyme and a clean foil. */
function farFamilies(items: readonly RhymeItem[]) {
  const free = freeFamilies(rhymeSessionWords(items));
  for (const a of free) {
    const vowel = a.rime.replace(/[^aeiou]/g, '');
    const b = free.find(f => f !== a && f.rime.replace(/[^aeiou]/g, '') !== vowel);
    if (!b) continue;
    const foil = b.words.find(w => !a.words.slice(0, 2).some(x => onsetOf(x.word) === onsetOf(w.word)));
    if (foil) return { a, foil };
  }
  return null;
}

const practiceId = (item: RhymeItem) => `${item.id}~simpler`;

/**
 * The practice item for `item`, in its own mode, from families the session does not use. Recognition: a clean
 * rhyme or a clean non-rhyme (sharing neither first sound nor vowel), chosen by the id so the verdict is not
 * the item's. Identification: a new target with two choices, the rhyme and a far foil. Production and
 * collection: an open production item on a family with many rhymes a child knows. Null if no family is free.
 */
export function practiceItemFor(item: RhymeItem, items: readonly RhymeItem[]): RhymeItem | null {
  const id = practiceId(item);
  if (item.mode === 'production' || item.mode === 'collection') {
    const family = freeFamilies(rhymeSessionWords(items))[0];
    if (!family) return null;
    const [target] = family.words;
    return itemFromChallenge({ id, mode: 'production', targetWord: target.word, targetWordEmoji: target.emoji,
      rhymeFamily: `-${family.rime}` }, item.tier);
  }
  const far = farFamilies(items);
  if (!far) return null;
  const [target, rhyme] = far.a.words;
  if (item.mode === 'recognition') {
    const rhymes = bit(item.id) === 0;
    const other = rhymes ? rhyme : far.foil;
    return itemFromChallenge({ id, mode: 'recognition', targetWord: target.word, targetWordEmoji: target.emoji,
      rhymeFamily: `-${far.a.rime}`, comparisonWord: other.word, comparisonWordEmoji: other.emoji, doesRhyme: rhymes }, item.tier);
  }
  const options = [{ word: rhyme.word, image: rhyme.emoji, isCorrect: true }, { word: far.foil.word, image: far.foil.emoji, isCorrect: false }];
  return itemFromChallenge({ id, mode: 'identification', targetWord: target.word, targetWordEmoji: target.emoji,
    rhymeFamily: `-${far.a.rime}`, options: bit(item.id) === 0 ? options : options.reverse(),
    tutorNamesOptions: item.namesChoices }, item.tier);
}

/** Leak rule for a practice item: true if it uses a word or an ending the session uses, or changes the mode. */
export const practiceLeak = (practice: RhymeItem, item: RhymeItem, items: readonly RhymeItem[]) => {
  const used = rhymeSessionWords(items);
  const words = [practice.targetWord, practice.comparisonWord ?? '', ...practice.choices.map(c => c.word)].filter(Boolean);
  const sameMode = practice.mode === item.mode || (item.mode === 'collection' && practice.mode === 'production');
  return !sameMode || words.some(w => used.words.has(w) || used.rimes.has(rimeOfWord(w)));
};

/** What a pulled help lever put on screen, for the tutor: the model's words, never the item's. */
export function leversOnScreen(item: RhymeItem, pulled: readonly string[], items: readonly RhymeItem[]): string | null {
  const parts: string[] = [];
  const contrast = pulled.includes(CONTRAST_LEVER) ? contrastModelFor(items) : null;
  if (contrast) {
    const [a, b] = contrast.words;
    parts.push(`beside the item, a model on other words: ${a.word} and ${b.word}, whose endings light up together, `
      + `and ${a.word} and ${contrast.onsetFoil.word}, whose first sounds light up. Say those words; they are not this item's words`);
  }
  if (pulled.includes(NAME_CHOICES_LEVER)) parts.push('a speaker mark on each choice card: read every choice aloud in the order shown, the same way each time');
  const swap = pulled.includes(SWAP_LEVER) ? swapModelFor(items) : null;
  if (swap) parts.push(`a model of changing the first sound: ${swap.words.slice(0, 3).map(w => w.word).join(', ')}. `
    + 'Say each one; they are not this item\'s family');
  if (pulled.includes(STRIP_LEVER)) parts.push(`picture cards under the word, one first sound each: ${onsetCardsFor(item).map(c => `/${c.sound}/`).join(' ')}. `
    + 'The learner puts one on the front of the ending. You may say a single sound; never put one together with the ending yourself');
  return parts.length ? parts.join('; ') : null;
}

/** The levers this item declares, with their state. */
export function rhymeStudioLevers(item: RhymeItem | null, pulled: readonly string[], items: readonly RhymeItem[]): WorkspaceLever[] {
  if (!item) return [];
  const levers: WorkspaceLever[] = [];
  const add = (id: string, kind: WorkspaceLever['kind'], answers: readonly RhymeMiss[], when: string, does: string) =>
    levers.push({ id, kind, carrier: 'both', pulled: pulled.includes(id), answers, when, does });
  const practice = practiceItemFor(item, items);
  if (item.mode === 'recognition' || item.mode === 'identification') {
    if (contrastModelFor(items)) add(CONTRAST_LEVER, 'help',
      item.mode === 'recognition' ? ['yes_same_start', 'yes_no_rhyme', 'no_to_rhyme'] : ['onset_foil', 'echo_target'],
      'The learner goes by how words start, or cannot yet hear whether two endings match.',
      'Shows a model beside the item on other words: a rhyming pair whose endings light up together and a pair that '
      + 'only starts the same. Say the model words; never this item\'s words stretched or split.');
    if (item.mode === 'identification' && !item.namesChoices) add(NAME_CHOICES_LEVER, 'help', ['off_menu', 'echo_target'],
      'The learner says a word that is not a choice, or the target back.',
      'Marks each choice card with a speaker: read every choice aloud in screen order, evenly, stressing none.');
    if (practice) add(item.mode === 'recognition' ? FAR_PAIR_LEVER : FAR_FOIL_LEVER, 'simplify',
      item.mode === 'recognition' ? ['no_to_rhyme', 'yes_no_rhyme'] : ['onset_foil', 'off_menu', 'echo_target'],
      'The learner still cannot tell after help.',
      item.mode === 'recognition'
        ? 'Opens an easier practice pair first: two short picture words far apart, or a clean rhyme. Not graded; the full item comes back after it.'
        : 'Opens an easier practice item first: a new word and two choices, one clearly different. Not graded; the full item comes back after it.');
  } else {
    if (swapModelFor(items)) add(SWAP_LEVER, 'help', ['echo_target', 'same_start', 'meaning_neighbour'],
      'The learner says the word back, a word that starts the same, or a word that means something close.',
      'Shows a model word on another family with its first sound changed twice (like sock, rock, lock). Say each.');
    add(STRIP_LEVER, 'help', item.mode === 'collection' ? ['nonword', 'already_collected', 'same_start'] : ['nonword', 'same_start'],
      'The learner cannot think of a word, or says a made-up one.',
      'Puts six picture cards under the word, each one first sound. The learner tries each sound on the front of the ending. '
      + 'Never say a whole word made from a card.');
    if (practice) add(DENSE_LEVER, 'simplify', ['nonword', 'meaning_neighbour', 'echo_target'],
      'The learner still cannot find a rhyme after help.',
      'Opens an easier practice word first, one with many rhymes a child knows. Not graded; the full item comes back after it.');
  }
  return levers;
}
