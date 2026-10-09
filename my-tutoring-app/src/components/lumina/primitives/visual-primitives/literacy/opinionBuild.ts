/**
 * opinion-builder `build_opinion` — open build (OB-7L). The learner MAKES an OREO opinion from cards for EITHER side of
 * a question: an opinion first, a reason and an example that support THAT side, and the opinion said again last. They
 * tap cards in order and press "I'm done!". Many answers pass: either side, any of its reasons, either order of extra
 * reasons. A reason or example for the other side, an off-topic card, or a restatement of the other opinion is a miss.
 * Judged in code from each card's role and side (the generator writes them; `askableOpinion` keeps a set only when both
 * sides are complete).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { WritingPayload } from './writingStages';

export type OpinionRole = 'opinion' | 'reason' | 'example' | 'restate' | 'off_topic';
export type Side = 'yes' | 'no';
export interface OpinionCard { id: string; text: string; role: OpinionRole; side?: Side }
export interface OpinionItem { id: string; question: string; cards: OpinionCard[] }

export interface OpinionBuildData {
  title: string;
  task: 'opinion_build';
  opinions: OpinionItem[];
  gradeLevel?: string;
  supportTier?: 'easy' | 'medium' | 'hard';
}

export type OpinionMiss = 'opinion_not_first' | 'restate_not_last' | 'no_reason' | 'no_example' | 'other_side' | 'off_topic' | 'out_of_order';
export const OPINION_MISSES: readonly OpinionMiss[] = ['opinion_not_first', 'restate_not_last', 'no_reason', 'no_example', 'other_side', 'off_topic', 'out_of_order'];
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

export const opinionAssignment = (item: OpinionItem): TeachingAssignment => ({ id: item.id, task: askFor(item), response: 'gesture' });

export const describeOpinion = (item: OpinionItem, order: readonly string[]) =>
  order.length ? `Built: ${order.map(id => cardOf(item, id)?.text ?? '').join(' ')}` : 'Built nothing';

export function opinionScene(item: OpinionItem, order: readonly string[], inspectorSaid?: string): WorkspaceScene {
  return { objects: [], facts: {
    question: item.question,
    sides: item.cards.filter(c => c.role === 'opinion').map(c => c.text).join(' | '),
    cardsLeft: item.cards.length - order.length,
    answer: order.length ? order.map(id => cardOf(item, id)?.text ?? '').join(' ') : 'empty',
    cardsPlaced: order.length,
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: 'The learner picks either side. They tap cards into their answer in order (tap one in the answer to take it '
      + 'back) and press "I\'m done!". The builder checks the order and that every card supports the same side. Many '
      + 'answers pass, on either side. You cannot move a card.',
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

/** The easier practice set: one side only (the side of the first opinion card), plus one off-topic card. */
export function oneSideFor(item: OpinionItem): OpinionItem | null {
  const side = item.cards.find(c => c.role === 'opinion')?.side;
  const cards = item.cards.filter(c => c.side === side || c.role === 'off_topic').slice(0);
  return cards.length < item.cards.length ? { id: `${item.id}~side`, question: item.question, cards } : null;
}

const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly OpinionMiss[], when: string, does: string,
  pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier: 'shown', when, does, answers, pulled: pulled.includes(id) });

export function opinionLevers(item: OpinionItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  return [
    lever(FRAME_LEVER, 'help', ['opinion_not_first', 'restate_not_last', 'no_reason', 'no_example', 'out_of_order'],
      'The learner leaves out a part or puts the parts in the wrong order.',
      'Shows labelled spaces above the answer: Opinion, Reason, Example, Opinion again. No card is placed or named.', pulled),
    lever(MODEL_LEVER, 'help', ['other_side', 'off_topic', 'out_of_order'],
      'The learner mixes the two sides, or keeps a card about something else.',
      'Shows a finished OREO answer to a different question (a class pet), each part labelled, so the learner sees one side all the way through.',
      pulled),
    ...(oneSideFor(item) ? [lever(FEWER_LEVER, 'simplify', ['other_side', 'off_topic'],
      'The learner cannot keep the two sides apart on a full board.',
      'Opens a practice set with one side\'s cards only, plus one card about something else, ungraded. The full set comes back after it.',
      pulled)] : []),
  ];
}

export function opinionLeverFacts(pulled: readonly string[]): string | undefined {
  const notes = [
    pulled.includes(FRAME_LEVER) && 'Labelled spaces above the answer: Opinion, Reason, Example, Opinion again.',
    pulled.includes(MODEL_LEVER) && `A finished answer to "${MODEL_OPINION.question}" is shown with its parts labelled.`,
  ].filter(Boolean);
  return notes.length ? notes.join(' ') : undefined;
}

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
 *  component, so the live adapter imports no React tree. */
export const opinionWritingPayload = (d: { framework: 'oreo' | 'cer'; prompt: string;
    scaffold?: { claimStarters?: string[]; reasonStarters?: string[]; conclusionStarters?: string[] } }): WritingPayload => ({
  paragraphType: d.framework === 'cer' ? 'cer' : 'oreo', topic: d.prompt,
  topicSentenceFrames: d.scaffold?.claimStarters ?? [], detailSentenceFrames: d.scaffold?.reasonStarters ?? [],
  concludingSentenceFrames: d.scaffold?.conclusionStarters ?? [],
});
