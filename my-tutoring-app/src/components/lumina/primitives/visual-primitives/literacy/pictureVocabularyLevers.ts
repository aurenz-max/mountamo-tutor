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
 * Opposite, association, gradable_scale and sentence_frame name no misses and have no lever yet.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { clueLeak, type PictureVocabItem, type PictureVocabTapOption } from './pictureVocabularyScript';
import type { SpokenPictureVocabMiss } from './pictureVocabularyWorkspace';

export const CLUE_LEVER = 'function_cue';
export const TWO_CARDS_LEVER = 'two_cards_far';

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
export function leversOnScreen(item: PictureVocabItem, pulled: readonly string[]): string | null {
  const clue = pulled.includes(CLUE_LEVER) ? clueFor(item) : null;
  return clue ? `a clue card: "${clue}". Say the clue; it is not the word` : null;
}

/** The levers this item declares, with their state. */
export function pictureVocabLevers(item: PictureVocabItem | null, pulled: readonly string[], items: readonly PictureVocabItem[]): WorkspaceLever[] {
  if (!item || (item.kind !== 'receptive_match' && item.kind !== 'naming')) return [];
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
