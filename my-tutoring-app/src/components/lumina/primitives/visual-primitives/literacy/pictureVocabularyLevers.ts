/**
 * The in-item levers on picture-vocabulary (`/add-support-tiers`, handoff 22 L4).
 *
 * receptive_match: the tutor says a word and the learner taps its picture from four. A wrong tap is named against
 * the target's kind (`pictureVocabMiss`): `same_category` (another animal for "dog"), `other_category`, or
 * `other_picture` when the payload records no kinds (older payloads).
 * naming: the learner says the picture's name; misses are spoken (`category_word`, `other_thing`).
 *
 * - `function_cue` (help, both; receptive_match and naming): a clue card the tutor says aloud, what the thing does or
 *   where it is found. Generated with the pool and gated by `clueLeak`: never the word, its sounds or letters.
 * - `two_cards_far` (simplify, shown; receptive_match): an ungraded practice item on a word the session never asks,
 *   with one card of another kind. Built from the session's own foil cards; never the current item's cards (R3).
 *
 * Opposite, association, gradable_scale and sentence_frame (handoff 24): one help lever each, a worked model on words
 * the session never uses, shown as pictures and said by the tutor (`modelFor`). The relation is the answer on these
 * modes, so a lever never acts on the item's own words (the literacy rule "model pair outside the item").
 * - `opposite_model`: two pictures with an arrow between them (hot and cold). Answers `said_base_word`, `not_opposite`.
 * - `goes_with_model`: two pictures that go together (bread and butter). Answers `said_base_word`, `no_link`.
 * - `scale_model`: a full three-word scale on growing bars (cool, warm, hot). Answers `given_rung`, `off_scale`.
 * - `frame_model`: another sentence, completed, with its picture. Answers `does_not_fit`.
 * Leak rule (`modelLeak`): no model word is a word, base word, scale word or frame word of the session. No simplify:
 * each mode's item is already one word; a shorter scale or frame would be a different task.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { clueLeak, type PictureVocabItem, type PictureVocabTapOption } from './pictureVocabularyScript';
import type { SpokenPictureVocabMiss } from './pictureVocabularyWorkspace';
import type { PictureVocabItemKind } from './pictureVocabularyScript';

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

/** Every word the session says or shows on its relation items: answers, base words, scale words, frame words. */
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

/** What the model puts on screen, in words the tutor says. Never the item's words. */
export function modelOnScreen(m: VocabModel): string {
  const words = m.cards.map(card => card.word);
  switch (m.kind) {
    case 'opposite': return `a model on other words: ${words[0]} and ${words[1]}, as pictures with an arrow between them. Say "the opposite of ${words[0]} is ${words[1]}"; they are not this item's words`;
    case 'association': return `a model on other words: ${words[0]} and ${words[1]}, as pictures side by side. Say "${words[0]} goes with ${words[1]}"; they are not this item's words`;
    case 'gradable_scale': return `a model scale on other words: ${words.join(', ')}, on bars that grow. Say them in order; they are not this item's words`;
    default: return `a model sentence on another word: "${m.sentence}", with a picture of ${words[0]}. Say it; it is not this item's sentence`;
  }
}

export type PictureVocabMiss = 'same_category' | 'other_category' | 'other_picture';

const low = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/** What a checked wrong tap shows, from the recorded kinds. Undefined for a right tap or a non-tap item. */
export function pictureVocabMiss(item: PictureVocabItem, tapped: string): PictureVocabMiss | undefined {
  if (item.kind !== 'receptive_match' || low(tapped) === low(item.word)) return undefined;
  const target = item.options?.find(o => low(o.word) === low(item.word))?.category ?? item.category;
  const card = item.options?.find(o => low(o.word) === low(tapped))?.category;
  if (!target || !card) return 'other_picture';
  return target === card ? 'same_category' : 'other_category';
}

const clueFor = (item: PictureVocabItem) =>
  item.clue && !clueLeak(item.clue, item.word) ? item.clue : null;

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

/** What the pulled help lever put on screen, for the tutor. */
export function leversOnScreen(item: PictureVocabItem, pulled: readonly string[], items: readonly PictureVocabItem[] = []): string | null {
  const modelId = MODEL_LEVER[item.kind];
  const model = modelId && pulled.includes(modelId) ? modelFor(item, items) : null;
  if (model) return modelOnScreen(model);
  const clue = pulled.includes(CLUE_LEVER) ? clueFor(item) : null;
  return clue ? `a clue card: "${clue}". Say the clue; it is not the word` : null;
}

const MODEL_WHEN: Partial<Record<PictureVocabItemKind, [readonly SpokenPictureVocabMiss[], string, string]>> = {
  opposite: [['said_base_word', 'not_opposite'], 'The learner says the word back or a word that is not its opposite.',
    'Shows two other words that are opposites, as pictures with an arrow between them.'],
  association: [['said_base_word', 'no_link'], 'The learner says the word back or something that does not go with it.',
    'Shows two other things that go together, as pictures side by side.'],
  gradable_scale: [['given_rung', 'off_scale'], 'The learner says a word already on the scale or one that does not fit the gap.',
    'Shows another full scale of three words on bars that grow.'],
  sentence_frame: [['does_not_fit'], 'The learner says a word that does not make sense in the sentence.',
    'Shows another sentence, completed, with a picture of its last word.'],
};

/** The levers this item declares, with their state. */
export function pictureVocabLevers(item: PictureVocabItem | null, pulled: readonly string[], items: readonly PictureVocabItem[]): WorkspaceLever[] {
  if (!item) return [];
  const modelId = MODEL_LEVER[item.kind], spec = MODEL_WHEN[item.kind];
  if (modelId && spec) return modelFor(item, items) ? [{ id: modelId, kind: 'help', carrier: 'both', pulled: pulled.includes(modelId),
    answers: spec[0], when: spec[1], does: `${spec[2]} Say them. They are not this item's words.` }] : [];
  if (item.kind !== 'receptive_match' && item.kind !== 'naming') return [];
  const levers: WorkspaceLever[] = [];
  const tap = item.kind === 'receptive_match';
  if (clueFor(item)) levers.push({ id: CLUE_LEVER, kind: 'help', carrier: 'both', pulled: pulled.includes(CLUE_LEVER),
    answers: tap ? ['same_category', 'other_category', 'other_picture'] satisfies PictureVocabMiss[]
      : ['category_word', 'other_thing'] satisfies SpokenPictureVocabMiss[],
    when: tap ? 'The learner taps a picture that is not the word.' : 'The learner says a group word or names another thing.',
    does: 'Shows a clue card: what the thing does or where it is found. Say the clue. It never says the word or its sounds.' });
  if (tap && practiceItemFor(item, items)) levers.push({ id: TWO_CARDS_LEVER, kind: 'simplify', carrier: 'shown',
    pulled: pulled.includes(TWO_CARDS_LEVER), answers: ['same_category'] satisfies PictureVocabMiss[],
    when: 'The learner still cannot find the picture after the clue.',
    does: 'Opens an easier practice item first: another word with two very different pictures. Not graded; the full item comes back after it.' });
  return levers;
}
