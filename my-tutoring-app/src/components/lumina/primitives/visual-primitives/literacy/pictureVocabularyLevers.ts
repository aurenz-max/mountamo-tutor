/**
 * The in-item levers on picture-vocabulary, as one lever set (`bossLevers.ts`; `/add-support-tiers`, handoffs 22 L4 and
 * 24). The relation is the answer on the relation modes, so no lever acts on the item's own words: help there is a
 * worked model on words the session never uses (`modelFor`, leak rule `modelLeak`).
 *
 * - `function_cue` (clue; receptive_match, naming): a clue card the tutor says aloud, what the thing does or where it is
 *   found. Generated with the pool and gated by `clueLeak`: never the word, its sounds or letters.
 * - `two_cards_far` (easier; receptive_match): an ungraded practice item on a word the session never asks, with one
 *   card of another kind. Built from the session's own foil cards; never the current item's cards.
 * - `opposite_model`, `goes_with_model`, `scale_model`, `frame_model` (model; one per relation mode): two opposites with
 *   an arrow, two things that go together, a full three-word scale on growing bars, another sentence completed.
 * Pair boards (pair_build, the board's helpers in `picturePairBuild.ts`):
 * - `say_names` (legend): the tutor says every picture's name once, plainly, in board order.
 * - `model_pair` (model): one right pair of pictures not on this board.
 * - `small_board` (easier): a practice board of four pictures with one right pair.
 * No simplify on the relation modes: each item is already one word; a shorter scale or frame is a different task.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import { PICTURE_TAP_MISSES, PICTURE_VOCAB_SPOKEN_MISSES, pictureVocabularyCard, type PictureVocabMiss } from './pictureVocabulary.card';
import {
  asPictureBoard, clueLeak, isPictureBoard, type PictureBoard, type PictureVocabItem, type PictureVocabItemKind,
  type PictureVocabTapOption, type PictureVocabularyItem,
} from './pictureVocabularyDomain';
import {
  PP_MODEL_LEVER, PP_NAMES_LEVER, PP_SMALL_BOARD_LEVER, RELATION_WORDS, picturePairModelFor, picturePairSmallBoard,
  type PairPicture, type PicturePairItem,
} from './picturePairBuild';

export type { PictureVocabMiss };
export const CLUE_LEVER = 'function_cue';
export const TWO_CARDS_LEVER = 'two_cards_far';
export const MODEL_LEVER: Partial<Record<PictureVocabItemKind, string>> = {
  opposite: 'opposite_model', association: 'goes_with_model', gradable_scale: 'scale_model', sentence_frame: 'frame_model',
};

// ── Worked models for the relation modes ─────────────────────────────────────

export interface ModelCard { word: string; emoji: string }
/** A worked model: the cards in order, and for sentence_frame the completed sentence. */
export interface VocabModel { kind: PictureVocabItemKind; cards: ModelCard[]; sentence?: string }

const c = (word: string, emoji: string): ModelCard => ({ word, emoji });
const MODELS: Partial<Record<PictureVocabItemKind, ReadonlyArray<Omit<VocabModel, 'kind'>>>> = {
  opposite: [{ cards: [c('hot', '🔥'), c('cold', '🧊')] }, { cards: [c('up', '⬆️'), c('down', '⬇️')] },
    { cards: [c('day', '☀️'), c('night', '🌙')] }, { cards: [c('wet', '💧'), c('dry', '🏜️')] }, { cards: [c('fast', '🐇'), c('slow', '🐢')] }],
  association: [{ cards: [c('bread', '🍞'), c('butter', '🧈')] }, { cards: [c('needle', '🪡'), c('thread', '🧵')] },
    { cards: [c('brush', '🖌️'), c('paint', '🎨')] }, { cards: [c('bat', '🏏'), c('ball', '⚾')] }],
  gradable_scale: [{ cards: [c('cool', '🧊'), c('warm', '☕'), c('hot', '🔥')] }, { cards: [c('whisper', '🤫'), c('talk', '🗣️'), c('shout', '📢')] },
    { cards: [c('walk', '🚶'), c('jog', '🏃'), c('run', '💨')] }, { cards: [c('tiny', '🐜'), c('small', '🐭'), c('huge', '🐘')] }],
  sentence_frame: [{ cards: [c('spoon', '🥄')], sentence: 'We eat soup with a spoon.' },
    { cards: [c('moon', '🌙')], sentence: 'At night we can see the moon.' },
    { cards: [c('hat', '🎩')], sentence: 'I wear a hat on my head.' },
    { cards: [c('fly', '🐦')], sentence: 'A bird can fly in the sky.' }],
};

const low = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/** Every word the session says or shows on its items: answers, base words, scale words, frame words. */
function sessionVocab(items: readonly PictureVocabItem[]): Set<string> {
  return new Set(items.flatMap(i => [i.word, i.baseWord ?? '', ...(i.scaleWords ?? []),
    ...((i.frameDisplay ?? '').match(/[A-Za-z]+/g) ?? [])]).map(low).filter(Boolean));
}

/** Leak rule for a model: true when any of its words is a session word. */
export const modelLeak = (model: Omit<VocabModel, 'kind'>, items: readonly PictureVocabItem[]) => {
  const used = sessionVocab(items);
  return model.cards.some(card => used.has(low(card.word)));
};

/** The worked model for a relation item: the first in its pool whose words the session never uses. */
export function modelFor(item: PictureVocabItem, items: readonly PictureVocabItem[]): VocabModel | null {
  const found = (MODELS[item.kind] ?? []).find(m => !modelLeak(m, items));
  return found ? { kind: item.kind, ...found } : null;
}

/** The scene fact while a model is up: what it shows, in words the tutor says. Never the item's words. */
export function modelFact(m: VocabModel): string {
  const words = m.cards.map(card => card.word);
  switch (m.kind) {
    case 'opposite': return `A model on other words is shown: ${words[0]} and ${words[1]}, as pictures with an arrow between them. `
      + `Say "the opposite of ${words[0]} is ${words[1]}"; they are not this item's words.`;
    case 'association': return `A model on other words is shown: ${words[0]} and ${words[1]}, as pictures side by side. `
      + `Say "${words[0]} goes with ${words[1]}"; they are not this item's words.`;
    case 'gradable_scale': return `A model scale on other words is shown: ${words.join(', ')}, on bars that grow. Say them in `
      + 'order; they are not this item\'s words.';
    default: return `A model sentence on another word is shown: "${m.sentence}", with a picture of ${words[0]}. Say it; it is `
      + 'not this item\'s sentence.';
  }
}

/** What a checked wrong tap shows, from the recorded kinds. Undefined for a right tap or a non-tap item. */
export function pictureVocabMiss(item: PictureVocabItem, tapped: string): PictureVocabMiss | undefined {
  if (item.kind !== 'receptive_match' || low(tapped) === low(item.word)) return undefined;
  const target = item.options?.find(o => low(o.word) === low(item.word))?.category ?? item.category;
  const card = item.options?.find(o => low(o.word) === low(tapped))?.category;
  if (!target || !card) return 'other_picture';
  return target === card ? 'same_category' : 'other_category';
}

const clueFor = (item: PictureVocabItem) => (item.clue && !clueLeak(item.clue, item.word) ? item.clue : null);

/**
 * The practice item for `two_cards_far`: a target and a foil of another kind, both foil-only cards of the session
 * (never a session answer) and neither on the current item. Null when the session has no such pair.
 */
export function practiceItemFor(item: PictureVocabItem, items: readonly PictureVocabItem[]): PictureVocabItem | null {
  if (item.kind !== 'receptive_match') return null;
  const answers = new Set(items.map(i => low(i.word)));
  const onItem = new Set((item.options ?? []).map(o => low(o.word)));
  const seen = new Set<string>();
  const spare: PictureVocabTapOption[] = [];
  for (const o of items.flatMap(i => i.options ?? [])) {
    const w = low(o.word);
    if (answers.has(w) || onItem.has(w) || seen.has(w) || !o.category) continue;
    seen.add(w);
    spare.push(o);
  }
  for (const target of spare) {
    const foil = spare.find(o => o !== target && o.category !== target.category && o.emoji !== target.emoji);
    if (!foil) continue;
    // Order by word, not by role, so the answer is not always the first card.
    const options = [target, foil].sort((a, b) => a.word.localeCompare(b.word));
    return { ...item, id: `${item.id}~simpler`, word: target.word, emoji: target.emoji, category: target.category,
      options, clue: undefined };
  }
  return null;
}

/** Leak rule for a practice item: true if it asks a session answer or shows a card of the current item. */
export function practiceLeak(practice: PictureVocabItem, item: PictureVocabItem, items: readonly PictureVocabItem[]): boolean {
  const answers = new Set(items.map(i => low(i.word)));
  const onItem = new Set((item.options ?? []).map(o => low(o.word)));
  return (practice.options ?? []).some(o => answers.has(low(o.word)) || onItem.has(low(o.word)))
    || practice.kind !== item.kind;
}

// ── The lever set ────────────────────────────────────────────────────────────

/** What the set reads beyond the item: the session's word items (a model or practice item uses none of their words). */
export interface PictureVocabLeverContext { items: readonly PictureVocabItem[] }

const word = (item: PictureVocabularyItem) => (isPictureBoard(item) ? null : item);
const board = (item: PictureVocabularyItem) => (isPictureBoard(item) ? item : null);
const relationOf = (item: PictureVocabularyItem) => (isPictureBoard(item) ? item.relation : 'opposite');
const pairMisses = (item: PictureVocabularyItem) => (relationOf(item) === 'opposite' ? ['alike', 'not_opposite'] : ['same_kind', 'no_link']);

/** What each mode's model shows, and what it must never say, for the `support` fact. */
const SUPPORT_WORDS: Record<PictureVocabularyItem['kind'], { different: string; own: string }> = {
  receptive_match: { different: 'another word', own: 'which card shows the word' },
  naming: { different: 'another picture', own: 'this picture\'s name' },
  opposite: { different: 'two other words that are opposites', own: 'this word\'s opposite' },
  association: { different: 'two other things that go together', own: 'a thing that goes with this one' },
  gradable_scale: { different: 'another full scale of three words', own: 'the missing word' },
  sentence_frame: { different: 'another sentence, completed', own: 'the missing word' },
  pair_build: { different: 'one pair of pictures not on this board', own: 'a pair on this board' },
};

/** One model spec per relation mode: the same lever shape, its own id and words. */
const relationModel = (mode: 'opposite' | 'association' | 'gradable_scale' | 'sentence_frame', when: string, does: string) => ({
  id: MODEL_LEVER[mode]!, type: 'model' as const, modes: [mode], answers: [...PICTURE_VOCAB_SPOKEN_MISSES[mode]], when,
  does: `${does} Say them. They are not this item's words.`,
  content: (item: PictureVocabularyItem, ctx: PictureVocabLeverContext) => { const w = word(item); return w && modelFor(w, ctx.items); },
  fact: (m: VocabModel) => modelFact(m),
});

export const PICTURE_VOCAB_LEVERS = leverSet<PictureVocabularyItem, PictureVocabLeverContext>({
  modeOf: item => item.kind,
  missesOf: mode => pictureVocabularyCard.modes[mode].misses,
  // The clue card's words may never name the picture.
  answersOf: item => (isPictureBoard(item) ? [] : [item.word]),
  support: { tier: item => item.tier, different: item => SUPPORT_WORDS[item.kind].different, own: item => SUPPORT_WORDS[item.kind].own },
  specs: [
    { id: CLUE_LEVER, type: 'clue', modes: ['receptive_match', 'naming'],
      answers: [...PICTURE_TAP_MISSES, ...PICTURE_VOCAB_SPOKEN_MISSES.naming],
      answersOn: item => (item.kind === 'receptive_match' ? PICTURE_TAP_MISSES : PICTURE_VOCAB_SPOKEN_MISSES.naming),
      when: item => (item.kind === 'receptive_match' ? 'The learner taps a picture that is not the word.'
        : 'The learner says a group word or names another thing.'),
      does: 'Shows a clue card: what the thing does or where it is found. Say the clue. It never says the word or its sounds.',
      content: item => { const w = word(item); return w && clueFor(w); },
      fact: (clue: string) => `A clue card is shown: "${clue}". Say the clue; it is not the word.` },
    { id: TWO_CARDS_LEVER, type: 'easier', modes: ['receptive_match'], carrier: 'shown', answers: ['same_category'],
      when: 'The learner still cannot find the picture after the clue.',
      does: 'Opens an easier practice item first: another word with two very different pictures. Not graded; the full '
        + 'item comes back after it.',
      content: (item, ctx) => { const w = word(item); return w && practiceItemFor(w, ctx.items); } },
    relationModel('opposite', 'The learner says the word back or a word that is not its opposite.',
      'Shows two other words that are opposites, as pictures with an arrow between them.'),
    relationModel('association', 'The learner says the word back or something that does not go with it.',
      'Shows two other things that go together, as pictures side by side.'),
    relationModel('gradable_scale', 'The learner says a word already on the scale or one that does not fit the gap.',
      'Shows another full scale of three words on bars that grow.'),
    relationModel('sentence_frame', 'The learner says a word that does not make sense in the sentence.',
      'Shows another sentence, completed, with a picture of its last word.'),
    { id: PP_NAMES_LEVER, type: 'legend', modes: ['pair_build'], carrier: 'voiced', answers: ['alike', 'not_opposite', 'same_kind', 'no_link'],
      answersOn: pairMisses,
      when: item => `The learner puts together two pictures that do not ${relationOf(item) === 'opposite' ? 'mean opposite things' : 'go together'}.`,
      does: item => 'You say the name of every picture on the board once, plainly, in board order. Never group them, pause '
        + `between two that ${RELATION_WORDS[relationOf(item)]}, or say which ones ${RELATION_WORDS[relationOf(item)]}.`,
      fact: 'You are to say every picture name on the board once, plainly.' },
    { id: PP_MODEL_LEVER, type: 'model', modes: ['pair_build'], carrier: 'shown', answers: ['alike', 'not_opposite', 'same_kind', 'no_link'],
      answersOn: pairMisses,
      when: 'The learner still makes a wrong pair after hearing the names.',
      does: item => `Shows one pair of pictures that ${RELATION_WORDS[relationOf(item)]}, NOT on this board, and you say both `
        + `names and why they ${RELATION_WORDS[relationOf(item)]} in a few words. It is about those two pictures only: never `
        + 'point it at a picture on the board or say which board pictures pair up.',
      content: item => { const b = board(item); return b && picturePairModelFor(b); },
      fact: (m: [PairPicture, PairPicture], item) => `A model pair not on this board is shown: ${m[0].word} and ${m[1].word}. `
        + `Say both names and why they ${RELATION_WORDS[relationOf(item)]}.` },
    { id: PP_SMALL_BOARD_LEVER, type: 'easier', modes: ['pair_build'], carrier: 'shown', answers: ['alike', 'not_opposite', 'same_kind', 'no_link'],
      answersOn: pairMisses,
      when: 'The learner cannot find a pair on a board of eight.',
      does: item => `Opens a practice board of four pictures with one pair that ${RELATION_WORDS[relationOf(item)]}, ungraded. `
        + 'The full board comes back after it.',
      content: item => { const b = board(item); const small = b && picturePairSmallBoard(b); return b && small ? asPictureBoard(small, b.tier) : null; } },
  ],
});

/** The board levers bound for the shared pair surface: its items carry no mode or tier, so they are stamped. */
export function pictureBoardLevers(tier: SupportTier) {
  const bound = PICTURE_VOCAB_LEVERS.bind({ items: [] });
  const stamp = (item: PicturePairItem) => asPictureBoard(item, tier);
  return {
    declare: (item: PicturePairItem, pulled: readonly string[]) => bound.declare(stamp(item), pulled),
    onScreen: (item: PicturePairItem, pulled: readonly string[]) => bound.onScreen(stamp(item), pulled),
    simpler: (item: PicturePairItem, lever: string) => bound.simpler(stamp(item), lever) as PictureBoard | null,
    support: (item: PicturePairItem) => bound.support(stamp(item)),
  };
}
