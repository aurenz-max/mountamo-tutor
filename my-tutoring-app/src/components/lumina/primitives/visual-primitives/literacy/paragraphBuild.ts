/**
 * paragraph-architect `build_paragraph` — open build (qa/open-build/ROADMAP.md, OB-3L L6). The learner MAKES an
 * informative paragraph from sentence cards: a topic sentence, details, and a closing sentence, with two details that
 * belong to a different topic mixed in. They tap cards into the paragraph in order and press "I'm done!". Many
 * paragraphs pass: any two or more on-topic details, in any order, between the topic sentence and the closing.
 * Judged in code from the cards' roles (the generator writes them; `askableParagraph` keeps a set only when its roles
 * are complete and distinct).
 *
 * Serves LA002-02-a/b/c (curriculum design review 2026-10-07): opening with the topic, grouping facts that belong,
 * closing without a new fact. Writing a sentence is NOT judged here (that is brief 1); this is organization.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';

export type CardRole = 'topic' | 'detail' | 'off_topic' | 'closing';
export interface SentenceCard { id: string; text: string; role: CardRole }

export interface ParagraphItem {
  id: string;
  /** What the paragraph is about, in a child's words ("sharks"). Printed in the ask. */
  topic: string;
  cards: SentenceCard[];
}

export interface ParagraphBuildData {
  title: string;
  task: 'paragraph_build';
  paragraphs: ParagraphItem[];
  gradeLevel?: string;
  supportTier?: 'easy' | 'medium' | 'hard';
}

export type ParagraphMiss = 'topic_not_first' | 'closing_not_last' | 'too_few_details' | 'off_topic_detail';
export const PARAGRAPH_MISSES: readonly ParagraphMiss[] = ['topic_not_first', 'closing_not_last', 'too_few_details', 'off_topic_detail'];

export const MAX_CARD_CHARS = 110;
/** A closing opens with a wrap-up phrase, so it cannot also serve as the topic sentence. */
export const WRAP_UP = /^(now you know|that is (why|how)|these (are|facts)|this is (why|how)|so,? |as you can see|all in all|in the end|that'?s (why|how))/i;
export const MIN_DETAILS = 2;

const roleOf = (item: ParagraphItem, id: string) => item.cards.find(c => c.id === id)?.role;

/** The paragraph's miss, or undefined when it is topic first, 2+ belonging details, closing last. */
export function paragraphMiss(item: ParagraphItem, order: readonly string[]): ParagraphMiss | undefined {
  const roles = order.map(id => roleOf(item, id));
  if (roles[0] !== 'topic') return 'topic_not_first';
  if (roles[roles.length - 1] !== 'closing' || roles.length < 2) return 'closing_not_last';
  const middle = roles.slice(1, -1);
  // One topic and one closing per set, so the middle holds only facts: on topic or not.
  if (middle.includes('off_topic')) return 'off_topic_detail';
  if (middle.length < MIN_DETAILS) return 'too_few_details';
  return undefined;
}

/** A set ships with exactly one topic and one closing, 3+ details, 1-2 off-topic cards, distinct short texts. */
export function askableParagraph(item: ParagraphItem): ParagraphItem | null {
  const cards = (item?.cards ?? []).filter(c => c && typeof c.text === 'string' && c.text.trim().length > 0
    && c.text.length <= MAX_CARD_CHARS && !/^\s*(yes|my turn)\b/i.test(c.text));
  const count = (r: CardRole) => cards.filter(c => c.role === r).length;
  if (!item?.topic?.trim() || count('topic') !== 1 || count('closing') !== 1 || count('detail') < 3
    || count('off_topic') < 1 || count('off_topic') > 2) return null;
  if (new Set(cards.map(c => c.text.trim().toLowerCase())).size !== cards.length) return null;
  // A closing that could open the paragraph (Dolphins are wonderful ocean animals.) makes a fair order fail.
  if (!WRAP_UP.test(cards.find(c => c.role === 'closing')!.text)) return null;
  if (new Set(cards.map(c => c.id)).size !== cards.length) return null;
  return { ...item, cards };
}

export const paragraphsFrom = (items: readonly ParagraphItem[]) =>
  items.map(askableParagraph).filter((i): i is ParagraphItem => !!i).map((i, n) => ({ ...i, id: i.id || `p${n + 1}` }));

/** The board order: stable per item id (the same order on every render), never the paragraph's order. */
export function boardOrder(item: ParagraphItem): SentenceCard[] {
  let h = 0;
  for (const ch of item.id + item.topic) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const keyed = item.cards.map((c, i) => ({ c, k: ((h ^ (i * 2654435761)) >>> 0) % 997 }));
  const out = keyed.sort((a, b) => a.k - b.k).map(x => x.c);
  // Never open with the topic sentence first and the closing last: the board would show the answer's frame.
  if (out[0]?.role === 'topic' && out[out.length - 1]?.role === 'closing') out.push(out.shift()!);
  return out;
}

export const askFor = (item: ParagraphItem) =>
  `Build a paragraph about ${item.topic}: a sentence that tells the topic first, at least two facts that belong, and a closing sentence last.`;

export const paragraphAssignment = (item: ParagraphItem): TeachingAssignment =>
  ({ id: item.id, task: askFor(item), response: 'gesture' });

export const describeParagraph = (item: ParagraphItem, order: readonly string[]) =>
  order.length ? `Built: ${order.map(id => item.cards.find(c => c.id === id)?.text ?? '').join(' ')}` : 'Built nothing';

/** What the tutor is told: the cards and the learner's paragraph as text, never which card has which job. */
export function paragraphScene(item: ParagraphItem, order: readonly string[], inspectorSaid?: string): WorkspaceScene {
  return { objects: [], facts: {
    ask: askFor(item),
    cards: boardOrder(item).map(c => c.text).join(' | '),
    paragraph: order.length ? order.map(id => item.cards.find(c => c.id === id)?.text ?? '').join(' ') : 'empty',
    sentencesPlaced: order.length,
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: 'The learner taps sentence cards into the paragraph in order (tap one in the paragraph to take it back), '
      + 'may tap a card\'s speaker to hear it read, and presses "I\'m done!". The builder checks the order and that every '
      + 'fact belongs to the topic. Many paragraphs pass. You cannot move a card.',
  } };
}

export const readCardRequest = (text: string) => `The learner asked to hear a sentence card. Read only this sentence, once: "${text}"`;

// ── Levers ───────────────────────────────────────────────────────────────────
export const FRAME_LEVER = 'paragraph_frame';
export const MODEL_LEVER = 'model_paragraph';
export const FEWER_LEVER = 'fewer_cards';

/** A solved paragraph on another topic (code-owned), as the model. */
export const MODEL_PARAGRAPH = {
  topic: 'frogs',
  sentences: ['Frogs are animals that live near water.', 'They have long legs for jumping.', 'They catch bugs with their tongues.',
    'Now you know about frogs.'],
};

/** The easier practice set: the topic, two details, the closing, one off-topic card. */
export function fewerCardsFor(item: ParagraphItem): ParagraphItem | null {
  const pick = (r: CardRole, n: number) => item.cards.filter(c => c.role === r).slice(0, n);
  const cards = [...pick('topic', 1), ...pick('detail', 2), ...pick('off_topic', 1), ...pick('closing', 1)];
  return cards.length < item.cards.length ? { id: `${item.id}~fewer`, topic: item.topic, cards } : null;
}

const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly ParagraphMiss[], when: string, does: string,
  pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier: 'shown', when, does, answers, pulled: pulled.includes(id) });

export function paragraphLevers(item: ParagraphItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  return [
    lever(FRAME_LEVER, 'help', ['topic_not_first', 'closing_not_last', 'too_few_details'],
      'The learner puts the topic sentence or the closing in the wrong place, or uses fewer than two facts.',
      'Shows labelled spaces above the paragraph: Topic sentence, Fact, Fact, Closing sentence. No card is placed or named.', pulled),
    lever(MODEL_LEVER, 'help', ['off_topic_detail', 'topic_not_first', 'closing_not_last'],
      'The learner keeps a fact about something else, or the order is still not right after the frame.',
      'Shows a solved paragraph about frogs (not this topic) with its parts labelled, so the learner sees what belongs.', pulled),
    ...(fewerCardsFor(item) ? [lever(FEWER_LEVER, 'simplify', ['off_topic_detail', 'too_few_details'],
      'The learner cannot sort the cards on a board of eight.',
      'Opens a practice set of five cards (one topic sentence, two facts, one fact about something else, one closing), ungraded. The full set comes back after it.',
      pulled)] : []),
  ];
}

export function paragraphLeverFacts(pulled: readonly string[]): string | undefined {
  const notes = [
    pulled.includes(FRAME_LEVER) && 'Labelled spaces above the paragraph: Topic sentence, Fact, Fact, Closing sentence.',
    pulled.includes(MODEL_LEVER) && `A solved paragraph about ${MODEL_PARAGRAPH.topic} is shown with its parts labelled.`,
  ].filter(Boolean);
  return notes.length ? notes.join(' ') : undefined;
}

export function paragraphMissWords(miss: ParagraphMiss | undefined, topic: string): string {
  switch (miss) {
    case 'topic_not_first': return `Which sentence tells what the whole paragraph is about? That one goes first.`;
    case 'closing_not_last': return 'Which sentence wraps it up? That one goes last.';
    case 'too_few_details': return `Add more facts about ${topic} in the middle.`;
    case 'off_topic_detail': return `Read each fact. Is every one about ${topic}?`;
    default: return 'Not quite. Try again.';
  }
}
