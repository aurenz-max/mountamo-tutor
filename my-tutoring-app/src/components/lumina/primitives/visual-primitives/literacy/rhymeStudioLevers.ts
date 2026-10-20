/**
 * The in-item levers on rhyme-studio, as one lever set (`bossLevers.ts`; `/add-support-tiers`, handoff 22 L2). Every
 * word answer here is spoken, so no lever may put a choice or a tap where the learner had to say a word, and no lever
 * may stretch, split or light the item's own words (contract R2): any emphasis on them answers the item. Help acts on
 * a code-owned model set outside the session (`rhymeModels.ts`); simplify opens a NEW ungraded item from a family the
 * session does not use, in the same mode (a collection practises production).
 *
 * Word items:
 * - `contrast_model` (model; recognition, identification): beside the item, a model rhyme pair whose endings light up
 *   together and a model same-start pair whose first sounds light up (bee/tree, bee/bus).
 * - `name_choices` (legend; identification, only where the tier withdrew the read-aloud): each choice card gets a
 *   speaker mark and the tutor reads every choice, evenly, in screen order.
 * - `onset_swap_model` (model; production, collection): a model word with its first sound swapped twice (sock, rock,
 *   lock), the strategy shown on words that are not the target's family.
 * - `onset_strip` (clue; production, collection): six picture cards, each a single first sound, never the target's
 *   own. The learner puts one on the front of the ending; nothing composes a word for them.
 * - `far_pair` / `far_foil_item` / `dense_family_item` (easier): an easier practice item of the same mode.
 * Pair boards (pair_build, the board's helpers in `rhymePairBuild.ts`):
 * - `say_names` (legend): the tutor says every picture's name once, plainly, in board order.
 * - `model_pair` (model): one rhyming pair of pictures not on this board.
 * - `small_board` (easier): a practice board of four pictures with one rhyming pair.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { RHYME_MISSES, rhymeStudioCard } from './rhymeStudio.card';
import {
  asRhymeBoard, isRhymeBoard, itemFromChallenge, rhymeSessionWords, type RhymeBoard, type RhymeItem, type RhymeStudioItem,
  type RhymeTier,
} from './rhymeStudioDomain';
import { freeFamilies, onsetOf, pickModelRhymeSet, rimeOfWord, type PicturedWord, type RhymeModelSet } from './rhymeModels';
import { MODEL_LEVER as MODEL_PAIR_LEVER, NAMES_LEVER, SMALL_BOARD_LEVER, modelPairFor, smallBoardFor, type RhymePairItem } from './rhymePairBuild';

export { MODEL_PAIR_LEVER, NAMES_LEVER, SMALL_BOARD_LEVER };
export const CONTRAST_LEVER = 'contrast_model';
export const NAME_CHOICES_LEVER = 'name_choices';
export const SWAP_LEVER = 'onset_swap_model';
export const STRIP_LEVER = 'onset_strip';
export const FAR_PAIR_LEVER = 'far_pair';
export const FAR_FOIL_LEVER = 'far_foil_item';
export const DENSE_LEVER = 'dense_family_item';

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

/**
 * The practice item for `item`, in its own mode, from families the session does not use. Recognition: a clean rhyme
 * or a clean non-rhyme (sharing neither first sound nor vowel), chosen by the id so the verdict is not the item's.
 * Identification: a new target with two choices, the rhyme and a far foil. Production and collection: an open
 * production item on a family with many rhymes a child knows. Null if no family is free.
 */
export function practiceItemFor(item: RhymeItem, items: readonly RhymeItem[]): RhymeItem | null {
  const id = `${item.id}~simpler`;
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

// ── the lever set ────────────────────────────────────────────────────────────

/** What the set reads beyond the item: the session's word items (a model or practice item uses none of their words). */
export interface RhymeLeverContext { items: readonly RhymeItem[] }

const CLOSED = ['recognition', 'identification'] as const;
const OPEN = ['production', 'collection'] as const;
const BOARD = ['pair_build'] as const;
const word = (item: RhymeStudioItem) => (isRhymeBoard(item) ? null : item);
const board = (item: RhymeStudioItem) => (isRhymeBoard(item) ? item : null);

/** What each mode's model shows, and what it must never say, for the `support` fact. */
const SUPPORT_WORDS: Record<RhymeStudioItem['mode'], { different: string; own: string }> = {
  recognition: { different: 'a rhyming pair and a same-start pair on other words', own: 'whether these two words rhyme' },
  identification: { different: 'a rhyming pair and a same-start pair on other words', own: 'which choice rhymes' },
  production: { different: 'one word with its first sound changed, on other words', own: 'a word that rhymes with this one' },
  collection: { different: 'one word with its first sound changed, on other words', own: 'a word that rhymes with this one' },
  pair_build: { different: 'one rhyming pair of pictures not on this board', own: 'a pair on this board' },
};

export const RHYME_LEVERS = leverSet<RhymeStudioItem, RhymeLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => rhymeStudioCard.modes[mode].misses,
  // The onset strip's fact names first sounds only; the identification answer is the one word it may never name.
  answersOf: item => (isRhymeBoard(item) || item.mode !== 'identification' ? [] : [item.answer]),
  support: { tier: item => item.tier, different: item => SUPPORT_WORDS[item.mode].different, own: item => SUPPORT_WORDS[item.mode].own },
  specs: [
    { id: CONTRAST_LEVER, type: 'model', modes: CLOSED,
      answers: ['yes_same_start', 'yes_no_rhyme', 'no_to_rhyme', 'onset_foil', 'echo_target'],
      answersOn: item => (item.mode === 'recognition' ? RHYME_MISSES.recognition : ['onset_foil', 'echo_target']),
      when: 'The learner goes by how words start, or cannot yet hear whether two endings match.',
      does: 'Shows a model beside the item on other words: a rhyming pair whose endings light up together and a pair that '
        + 'only starts the same. Say the model words; never this item\'s words stretched or split.',
      content: (_item, ctx) => contrastModelFor(ctx.items),
      fact: (m: RhymeModelSet) => `Beside the item, a model on other words: ${m.words[0].word} and ${m.words[1].word}, whose `
        + `endings light up together, and ${m.words[0].word} and ${m.onsetFoil.word}, whose first sounds light up. Say those `
        + 'words; they are not this item\'s words.' },
    { id: NAME_CHOICES_LEVER, type: 'legend', modes: ['identification'], carrier: 'both', answers: ['off_menu', 'echo_target'],
      when: 'The learner says a word that is not a choice, or the target back.',
      does: 'Marks each choice card with a speaker: read every choice aloud in screen order, evenly, stressing none.',
      offer: item => !isRhymeBoard(item) && !item.namesChoices,
      fact: 'A speaker mark sits on each choice card: read every choice aloud in the order shown, the same way each time.' },
    { id: FAR_PAIR_LEVER, type: 'easier', modes: ['recognition'], answers: ['no_to_rhyme', 'yes_no_rhyme'],
      when: 'The learner still cannot tell after help.',
      does: 'Opens an easier practice pair first: two short picture words far apart, or a clean rhyme. Not graded; the full '
        + 'item comes back after it.',
      content: (item, ctx) => { const w = word(item); return w && practiceItemFor(w, ctx.items); } },
    { id: FAR_FOIL_LEVER, type: 'easier', modes: ['identification'], answers: ['onset_foil', 'off_menu', 'echo_target'],
      when: 'The learner still cannot tell after help.',
      does: 'Opens an easier practice item first: a new word and two choices, one clearly different. Not graded; the full '
        + 'item comes back after it.',
      content: (item, ctx) => { const w = word(item); return w && practiceItemFor(w, ctx.items); } },
    { id: SWAP_LEVER, type: 'model', modes: OPEN, answers: ['echo_target', 'same_start', 'meaning_neighbour'],
      when: 'The learner says the word back, a word that starts the same, or a word that means something close.',
      does: 'Shows a model word on another family with its first sound changed twice (like sock, rock, lock). Say each.',
      content: (_item, ctx) => swapModelFor(ctx.items),
      fact: (m: RhymeModelSet) => `A model of changing the first sound: ${m.words.slice(0, 3).map(w => w.word).join(', ')}. `
        + 'Say each one; they are not this item\'s family.' },
    { id: STRIP_LEVER, type: 'clue', modes: OPEN, carrier: 'both', answers: ['nonword', 'same_start', 'already_collected'],
      answersOn: item => (!isRhymeBoard(item) && item.mode === 'collection' ? ['nonword', 'already_collected', 'same_start'] : ['nonword', 'same_start']),
      when: 'The learner cannot think of a word, or says a made-up one.',
      does: 'Puts six picture cards under the word, each one first sound. The learner tries each sound on the front of the '
        + 'ending. Never say a whole word made from a card.',
      content: item => { const w = word(item); return w ? onsetCardsFor(w) : null; },
      fact: (cards: typeof ONSET_CARDS) => `Picture cards under the word, one first sound each: ${cards.map(c => `/${c.sound}/`).join(' ')}. `
        + 'The learner puts one on the front of the ending. You may say a single sound; never put one together with the '
        + 'ending yourself.' },
    { id: DENSE_LEVER, type: 'easier', modes: OPEN, answers: ['nonword', 'meaning_neighbour', 'echo_target'],
      when: 'The learner still cannot find a rhyme after help.',
      does: 'Opens an easier practice word first, one with many rhymes a child knows. Not graded; the full item comes back '
        + 'after it.',
      content: (item, ctx) => { const w = word(item); return w && practiceItemFor(w, ctx.items); } },
    { id: NAMES_LEVER, type: 'legend', modes: BOARD, carrier: 'voiced', answers: ['no_rhyme', 'same_start'],
      when: 'The learner puts together two pictures that do not rhyme, or two that only start the same.',
      does: 'You say the name of every picture on the board once, plainly, in board order. Never stretch an ending, group '
        + 'them, or say which rhyme.',
      fact: 'You are to say every picture name on the board once, plainly.' },
    { id: MODEL_PAIR_LEVER, type: 'model', modes: BOARD, carrier: 'shown', answers: ['no_rhyme', 'same_start'],
      when: 'The learner still pairs pictures that do not rhyme after hearing the names.',
      does: 'Shows one rhyming pair of pictures that are NOT on this board, with their names said by you, so the learner '
        + 'hears two endings that match.',
      content: item => { const b = board(item); return b && modelPairFor(b); },
      fact: (m: NonNullable<ReturnType<typeof modelPairFor>>) => `A model pair not on this board is shown: ${m[0].word} and `
        + `${m[1].word}. Say both names.` },
    { id: SMALL_BOARD_LEVER, type: 'easier', modes: BOARD, carrier: 'shown', answers: ['no_rhyme', 'same_start'],
      when: 'The learner cannot find a pair on a board of eight.',
      does: 'Opens a practice board of four pictures with one rhyming pair, ungraded. The full board comes back after it.',
      content: item => { const b = board(item); const small = b && smallBoardFor(b); return b && small ? asRhymeBoard(small, b.tier) : null; } },
  ],
});

/** The board levers bound for the shared pair surface: its items carry no mode or tier, so they are stamped. */
export function rhymeBoardLevers(tier: RhymeTier) {
  const bound = RHYME_LEVERS.bind({ items: [] });
  const stamp = (item: RhymePairItem) => asRhymeBoard(item, tier);
  return {
    declare: (item: RhymePairItem, pulled: readonly string[]) => bound.declare(stamp(item), pulled),
    onScreen: (item: RhymePairItem, pulled: readonly string[]) => bound.onScreen(stamp(item), pulled),
    simpler: (item: RhymePairItem, lever: string) => bound.simpler(stamp(item), lever) as RhymeBoard | null,
    support: (item: RhymePairItem) => bound.support(stamp(item)),
  };
}

/** The misses each spoken mode names, for the tests. */
export { RHYME_MISSES };
