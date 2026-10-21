/**
 * opinion-builder `build_opinion` — open build (OB-7L). The learner MAKES an OREO opinion from cards for EITHER side of
 * a question: an opinion first, a reason and an example that support THAT side, and the opinion said again last. They
 * tap cards in order and press "I'm done!". Many answers pass: either side, any of its reasons, either order of extra
 * reasons. A reason or example for the other side, an off-topic card, or a restatement of the other opinion is a miss.
 * Judged in code from each card's role and side (the generator writes them; `askableOpinion` keeps a set only when both
 * sides are complete).
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import type { OpinionMiss } from './opinionBuilder.card';
import type { WritingPayload } from './writingStages';

export { OPINION_MISSES, type OpinionMiss } from './opinionBuilder.card';

export type OpinionRole = 'opinion' | 'reason' | 'example' | 'restate' | 'off_topic';
export type Side = 'yes' | 'no';
export interface OpinionCard { id: string; text: string; role: OpinionRole; side?: Side }
export interface OpinionItem {
  id: string;
  question: string;
  cards: OpinionCard[];
  /** The lesson's support tier, stamped on each question (when the model lever comes). */
  supportTier?: SupportTier;
}

export interface OpinionBuildData {
  title: string;
  task: 'opinion_build';
  opinions: OpinionItem[];
  gradeLevel?: string;
  supportTier?: 'easy' | 'medium' | 'hard';
}

export const MAX_CARD_CHARS = 120;

const cardOf = (item: OpinionItem, id: string) => item.cards.find(c => c.id === id);

/** The answer's miss, or undefined: opinion first, 1-2 reasons and an example for its side, the same side restated last. */
export function opinionMiss(item: OpinionItem, order: readonly string[]): OpinionMiss | undefined {
  const cards = order.map(id => cardOf(item, id)).filter((c): c is OpinionCard => !!c);
  const first = cards[0], last = cards[cards.length - 1];
  if (first?.role !== 'opinion') return 'opinion_not_first';
  if (last?.role !== 'restate' || cards.length < 2) return 'restate_not_last';
  const middle = cards.slice(1, -1);
  if (middle.some(c => c.role === 'off_topic')) return 'off_topic';
  if ([...middle, last].some(c => c.side !== first.side)) return 'other_side';
  if (middle.some(c => c.role === 'opinion' || c.role === 'restate')) return 'out_of_order';
  if (!middle.some(c => c.role === 'reason')) return 'no_reason';
  if (!middle.some(c => c.role === 'example')) return 'no_example';
  // An example backs a reason, so it comes after the first reason.
  if (middle.findIndex(c => c.role === 'example') < middle.findIndex(c => c.role === 'reason')) return 'out_of_order';
  return undefined;
}

/** A set ships with, for EACH side, one opinion, one restatement, 1+ reasons and 1+ examples, plus 1-2 off-topic cards. */
export function askableOpinion(item: OpinionItem): OpinionItem | null {
  const cards = (item?.cards ?? []).filter(c => c && typeof c.text === 'string' && c.text.trim() && c.text.length <= MAX_CARD_CHARS
    && !/^\s*(yes|my turn)\b/i.test(c.text));
  if (!item?.question?.trim()) return null;
  const n = (role: OpinionRole, side?: Side) => cards.filter(c => c.role === role && (!side || c.side === side)).length;
  for (const side of ['yes', 'no'] as Side[]) {
    if (n('opinion', side) !== 1 || n('restate', side) !== 1 || n('reason', side) < 1 || n('example', side) < 1) return null;
  }
  if (n('off_topic') < 1 || n('off_topic') > 2) return null;
  if (new Set(cards.map(c => c.text.trim().toLowerCase())).size !== cards.length || new Set(cards.map(c => c.id)).size !== cards.length) return null;
  return { ...item, cards };
}

export const opinionsFrom = (items: readonly OpinionItem[]) =>
  items.map(askableOpinion).filter((i): i is OpinionItem => !!i).map((i, n) => ({ ...i, id: i.id || `o${n + 1}` }));

/** A lesson's askable questions, each stamped with the lesson's support tier. */
export const opinionItemsOf = (d: { opinions?: readonly OpinionItem[]; supportTier?: SupportTier }) =>
  opinionsFrom(d.opinions ?? []).map(o => (d.supportTier ? { ...o, supportTier: d.supportTier } : o));

/** Stable per item and never opening on an opinion card with its restatement last. */
export function boardOrder(item: OpinionItem): OpinionCard[] {
  let h = 0;
  for (const ch of item.id + item.question) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const out = item.cards.map((c, i) => ({ c, k: ((h ^ (i * 2654435761)) >>> 0) % 997 })).sort((a, b) => a.k - b.k).map(x => x.c);
  if (out[0]?.role === 'opinion') out.push(out.shift()!);
  return out;
}

export const askFor = (item: OpinionItem) =>
  `${item.question} Pick a side and build your answer: your opinion first, a reason and an example for it, then your opinion again.`;

export const describeOpinion = (item: OpinionItem, order: readonly string[]) =>
  order.length ? `Built: ${order.map(id => cardOf(item, id)?.text ?? '').join(' ')}` : 'Built nothing';

/**
 * What the tutor is told: the question, the two opinions (one per side, so no order), and the learner's answer as text.
 * The cards are never listed, so no passing order is. The moves are the card's; this says what the builder checks.
 */
export function opinionScene(item: OpinionItem, order: readonly string[], inspectorSaid?: string): SceneOf {
  return { objects: [], facts: {
    question: item.question,
    sides: item.cards.filter(c => c.role === 'opinion').map(c => c.text).join(' | '),
    cardsLeft: item.cards.length - order.length,
    answer: order.length ? order.map(id => cardOf(item, id)?.text ?? '').join(' ') : 'empty',
    cardsPlaced: order.length,
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: 'The learner picks either side. The builder checks the order and that every card supports the same side. '
      + 'Many answers pass, on either side.',
  } };
}

export const readCardRequest = (text: string) => `The learner asked to hear a card. Read only this sentence, once: "${text}"`;

// ── Levers ───────────────────────────────────────────────────────────────────
export const FRAME_LEVER = 'oreo_frame';
export const MODEL_LEVER = 'model_opinion';
export const FEWER_LEVER = 'one_side';

export const MODEL_OPINION = {
  question: 'Should every class have a pet?',
  parts: [['Opinion', 'I think every class should have a pet.'], ['Reason', 'A pet teaches us to take care of animals.'],
    ['Example', 'Our class fed our fish every morning.'], ['Opinion again', 'That is why every class should have a pet.']] as const,
};

/** The model answer is not offered on a question about pets: it would be the learner's own question. */
export const modelOpinionFor = (item: OpinionItem) => (/\bpets?\b/i.test(item.question) ? null : MODEL_OPINION);

const SIDE = '~side';
/** The easier practice set: one side only (the side of the first opinion card), plus one off-topic card. */
export function oneSideFor(item: OpinionItem): OpinionItem | null {
  if (item.id.endsWith(SIDE)) return null;
  const side = item.cards.find(c => c.role === 'opinion')?.side;
  const cards = item.cards.filter(c => c.side === side || c.role === 'off_topic');
  return cards.length < item.cards.length ? { id: `${item.id}${SIDE}`, question: item.question, cards } : null;
}
export const sideParent = (id: string) => id.replace(/~side$/, '');

export function opinionMissWords(miss: OpinionMiss | undefined): string {
  switch (miss) {
    case 'opinion_not_first': return 'Start with the card that tells what you think.';
    case 'restate_not_last': return 'End with the card that says your opinion again.';
    case 'no_reason': return 'Add a reason: why do you think that?';
    case 'no_example': return 'Add an example that shows your reason is true.';
    case 'other_side': return 'One of your cards is for the other side. Does every card agree with your opinion?';
    case 'off_topic': return 'One card is not about this question. Which one?';
    case 'out_of_order': return 'Check the order: opinion, reason, example, then your opinion again.';
    default: return 'Not quite. Try again.';
  }
}

/** OREO/CER writing reads the question as the topic and the scaffold's starters per step. Lives here, not in the
 *  component, so the boss imports no React tree. */
export const opinionWritingPayload = (d: { framework: 'oreo' | 'cer'; prompt: string; supportTier?: SupportTier;
    scaffold?: { claimStarters?: string[]; reasonStarters?: string[]; conclusionStarters?: string[] } }): WritingPayload => ({
  paragraphType: d.framework === 'cer' ? 'cer' : 'oreo', topic: d.prompt,
  topicSentenceFrames: d.scaffold?.claimStarters ?? [], detailSentenceFrames: d.scaffold?.reasonStarters ?? [],
  concludingSentenceFrames: d.scaffold?.conclusionStarters ?? [],
  ...(d.supportTier ? { supportTier: d.supportTier } : {}),
});
