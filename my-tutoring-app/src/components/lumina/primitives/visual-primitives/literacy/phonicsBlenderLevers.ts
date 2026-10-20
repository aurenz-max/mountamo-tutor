/**
 * The in-item levers on phonics-blender, as one lever set (`bossLevers.ts`; `/add-support-tiers`, handoff 22 L3 table,
 * built in handoff 24; user OK 09-28). The learner reads the letters and says the whole word, so every help lever on a
 * spoken item is visual: the voice reading the item's letters, or its sounds in a row, would do the decoding (the
 * literacy rule "no audio of unread print"). The tutor's one voiced model is on a letter outside the session.
 *
 * Spoken items (cvc, cvce_blend, digraph, advanced):
 * - `blend_slide` (layout): the letter cards slide together over an arrow; nothing is said. Not offered where the
 *   tier already joins the row.
 * - `sound_dots` (marks): a dot under each sound's letters (one dot for a digraph). Only where the hard tier joined the
 *   row: it re-segments it (user ruling 09-28).
 * - `tracking_arrow` (marks): an arrow under the row, pointing left to right.
 * - `name_sound_model` (model): a letter no session word uses, its name and its sound side by side; the tutor says
 *   both. Leak rule (`nameModelLeak`): the letter is in no session word.
 * - `short_word` (easier): an ungraded practice word first. cvc: a two-letter word (at, up); the other modes: a CVC
 *   word with the item's vowel letter. Leak rule (`practiceLeak`): never a session word, and a two-letter word is never
 *   a session word's ending (at for cat would give away most of it).
 * Build items (build_blend, the shared letter build's helpers in `letterBuild.ts`):
 * - `pattern_card` (clue): the shape the ask fixes ("two consonants + an ending"), no tile to choose.
 * - `model_word` (model): one solved build on tiles the item's bank does not have (bl + ack = black).
 * - `small_bank` (easier): the same ask, one word, only the tiles two answers need.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { SPOKEN_BLEND_MODES, phonicsBlenderCard } from './phonicsBlender.card';
import { asBuild, asWord, isBuild, type BlendBuild, type BlendItem, type BlendWord, type PhonicsBlenderItem, type Segmentation } from './phonicsBlenderDomain';
import { modelFor, patternFor, smallBankFor } from './letterBuild';
import { PRACTICE_WORDS } from './cvcSpellerLevers';
import { letterNameFor, spokenSoundFor } from './letterSoundLinkDomain';

export const SLIDE_LEVER = 'blend_slide';
export const DOTS_LEVER = 'sound_dots';
export const ARROW_LEVER = 'tracking_arrow';
export const NAME_MODEL_LEVER = 'name_sound_model';
export const SHORT_WORD_LEVER = 'short_word';
export const PATTERN_LEVER = 'pattern_card';
export const MODEL_WORD_LEVER = 'model_word';
export const SMALL_BANK_LEVER = 'small_bank';

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
export function shortWordFor(item: BlendWord, items: readonly BlendItem[]): BlendWord | null {
  const id = `${item.id}~simpler`;
  if (item.mode === 'cvc') {
    const word = TWO_LETTER_WORDS.find(w => !practiceLeak(w, items));
    return word ? asWord(asItem(id, word), item.mode, item.supportTier) : null;
  }
  const vowel = vowelOf(item.targetWord);
  const pick = PRACTICE_WORDS.find(p => p.word[1] === vowel && !p.word.includes('x') && !practiceLeak(p.word, items));
  return pick ? asWord(asItem(id, pick.word, pick.emoji), item.mode, item.supportTier) : null;
}

// ── the lever set ────────────────────────────────────────────────────────────

/** What the set reads beyond the item: the session's words (leak rules) and the tier's segmentation of the row. */
export interface BlendLeverContext { words: readonly BlendItem[]; segmentation: Segmentation }

const SPOKEN = SPOKEN_BLEND_MODES;
const BUILD = ['build_blend'] as const;
const word = (item: PhonicsBlenderItem) => (isBuild(item) ? null : item);
const build = (item: PhonicsBlenderItem) => (isBuild(item) ? item : null);

export const BLEND_LEVERS = leverSet<PhonicsBlenderItem, BlendLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => phonicsBlenderCard.modes[mode].misses,
  answersOf: item => (isBuild(item) ? item.examples : [item.targetWord]),
  // Both models show a different item solved; the lesson's tier says when (items carry it, default medium).
  support: { tier: item => item.supportTier,
    different: item => (isBuild(item) ? 'one solved word on tiles this item does not have' : 'another letter no word in this session has'),
    own: item => (isBuild(item) ? 'a word that answers this ask' : 'this word') },
  specs: [
    { id: SLIDE_LEVER, type: 'layout', modes: SPOKEN, answers: ['sounds_no_word'],
      offer: (_item, ctx) => ctx.segmentation !== 'none',
      when: 'The learner says the sounds but never the word.',
      does: 'Slides the letter cards close together over an arrow, so the sounds run into one word. Say nothing about the letters.',
      fact: 'The letter cards slid close together over an arrow. Say nothing about the letters: the learner reads them.' },
    { id: DOTS_LEVER, type: 'marks', modes: SPOKEN, answers: ['first_sound_changed', 'middle_sound_changed', 'last_sound_changed'],
      offer: (_item, ctx) => ctx.segmentation === 'none',
      when: 'The learner says a close but different word.',
      does: 'Puts a dot under each sound\'s letters in the joined word, one dot for two letters that make one sound.',
      fact: 'A dot sits under each sound\'s letters, one dot for two letters that make one sound.' },
    { id: ARROW_LEVER, type: 'marks', modes: SPOKEN, answers: ['read_backwards'],
      when: 'The learner reads the letters from right to left.',
      does: 'Draws an arrow under the letters pointing from left to right.',
      fact: 'An arrow under the letters points from left to right.' },
    // The model letter is named only in the scene fact once pulled (letter-spotter replay 09-29).
    { id: NAME_MODEL_LEVER, type: 'model', modes: SPOKEN, answers: ['letter_name'],
      when: 'The learner says letter names instead of sounds.',
      does: 'Shows another letter with its name and its sound side by side. Once it is on screen, say both. It is not a '
        + 'letter of this word.',
      content: (_item, ctx) => nameModelFor(ctx.words),
      fact: (m: NameModel) => `A model on another letter, ${m.letter.toUpperCase()}: its name "${m.name}" beside its sound `
        + `${m.sound}. Say both; it is not a letter of this word.` },
    { id: SHORT_WORD_LEVER, type: 'easier', modes: SPOKEN, carrier: 'shown',
      answers: ['sounds_no_word', 'first_sound_changed', 'middle_sound_changed', 'last_sound_changed'],
      when: 'The learner still cannot blend this word after help.',
      does: item => `Opens an easier practice word first: ${item.mode === 'cvc' ? 'a word with two letters' : 'a short word with three letters'}. `
        + 'It is not graded; the full word comes back after it.',
      content: (item, ctx) => { const w = word(item); return w ? shortWordFor(w, ctx.words) : null; } },
    { id: PATTERN_LEVER, type: 'clue', modes: BUILD, carrier: 'shown', answers: ['wrong_order', 'no_blend'],
      when: 'The learner\'s word has its tiles in the wrong order or no blend where the ask wants one.',
      does: 'Shows a pattern card above the boxes with the shape the ask fixes, such as two consonants + an ending. No tile '
        + 'the learner must choose is shown.',
      content: item => { const b = build(item); return b ? patternFor(b) : null; },
      fact: (pattern: string) => `A pattern card above the boxes shows: ${pattern}.` },
    { id: MODEL_WORD_LEVER, type: 'model', modes: BUILD, answers: ['not_a_word'],
      when: 'The learner makes tiles that are not a real word.',
      does: 'Shows one solved word of the same kind on tiles this item does not have, so the learner sees how a real word '
        + 'comes out. It shares no answer with this item.',
      content: item => { const b = build(item); return b ? modelFor(b) : null; },
      fact: (model: string) => `A solved example on other tiles is shown: ${model}.` },
    { id: SMALL_BANK_LEVER, type: 'easier', modes: BUILD, carrier: 'shown', answers: ['not_a_word'],
      when: 'The learner keeps making tiles that are not a word, or cannot start with so many tiles.',
      does: 'Opens the same ask first with fewer tiles, one word only. It is not graded; the full item comes back after it.',
      content: item => { const b = build(item); const small = b && smallBankFor(b); return b && small ? asBuild(small, b.supportTier) : null; } },
  ],
});

/** The build levers bound for the shared letter build surface: its items carry no mode or tier, so they are stamped. */
export function buildLevers(ctx: BlendLeverContext, supportTier: BlendBuild['supportTier']) {
  const bound = BLEND_LEVERS.bind(ctx);
  const stamp = (item: Parameters<typeof asBuild>[0]) => asBuild(item, supportTier);
  return {
    declare: (item: Parameters<typeof asBuild>[0], pulled: readonly string[]) => bound.declare(stamp(item), pulled),
    onScreen: (item: Parameters<typeof asBuild>[0], pulled: readonly string[]) => bound.onScreen(stamp(item), pulled),
    simpler: (item: Parameters<typeof asBuild>[0], lever: string) => bound.simpler(stamp(item), lever) as BlendBuild | null,
    support: (item: Parameters<typeof asBuild>[0]) => bound.support(stamp(item)),
  };
}

