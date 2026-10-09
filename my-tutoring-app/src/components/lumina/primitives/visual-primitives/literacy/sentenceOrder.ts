/**
 * Sentence order — sentence-builder's tile modes (simple, compound, complex, compound-complex) on the teaching workspace
 * (R12, OB-7L). The learner puts ALL the given tiles in order to make one sentence and presses "I'm done!". The
 * sentence is not printed first (the old target-meaning line WAS the sentence). An order the generator listed passes
 * in code; an order it did not list, with every tile used and the end mark last, goes to the shared literacy judge
 * (`unit: 'sentence'`), because tiles often have more than one good order.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { WordBuildJudgeRequest } from '../../../service/build-layer/wordBuildDecision';

export type TileRole = 'subject' | 'predicate' | 'object' | 'modifier' | 'conjunction' | 'punctuation';
export interface OrderTile { id: string; text: string; role: TileRole }
export interface OrderItem { id: string; targetMeaning?: string; tiles: OrderTile[]; validArrangements: string[][]; hint?: string }

export type OrderMiss = 'tiles_left' | 'end_mark_not_last' | 'not_sense';
export const ORDER_MISSES: readonly OrderMiss[] = ['tiles_left', 'end_mark_not_last', 'not_sense'];

/** The end mark (. ? !); a comma is punctuation too, but sits inside the sentence. */
export const isEndTile = (t: OrderTile | undefined) => !!t && t.role === 'punctuation' && /^[.?!]$/.test(t.text.trim());

const textOf = (item: OrderItem, ids: readonly string[]) => ids.map(id => item.tiles.find(t => t.id === id)?.text ?? '');

/** The sentence as the learner sees it: words joined, first letter capital, end mark attached. */
export function orderText(item: OrderItem, ids: readonly string[]): string {
  const parts = textOf(item, ids);
  const out = parts.reduce((s, p) => (/^[.?!,]$/.test(p) ? s + p : s ? `${s} ${p}` : p), '');
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Code's check: undefined when listed (pass), 'judge' when well-formed but unlisted, else the miss. */
export function orderVerdict(item: OrderItem, ids: readonly string[]): OrderMiss | 'judge' | undefined {
  if (ids.length < item.tiles.length) return 'tiles_left';
  const last = item.tiles.find(t => t.id === ids[ids.length - 1]);
  if (item.tiles.some(isEndTile) && !isEndTile(last)) return 'end_mark_not_last';
  // Compared as text: two commas (or two "the" tiles) are interchangeable, whichever one the learner tapped first.
  const said = textOf(item, ids).join(' ').toLowerCase();
  if (item.validArrangements.some(a => a.length === ids.length && textOf(item, a).join(' ').toLowerCase() === said)) return undefined;
  return 'judge';
}

/** An item ships with 3+ tiles, every listed arrangement using every tile once, and one end mark at most. */
export function askableOrder(item: OrderItem): OrderItem | null {
  const ids = new Set((item?.tiles ?? []).map(t => t.id));
  if (ids.size < 3 || ids.size !== item.tiles.length) return null;
  const arrangements = (item.validArrangements ?? []).filter(a => a.length === ids.size && new Set(a).size === ids.size && a.every(id => ids.has(id)));
  if (!arrangements.length || item.tiles.filter(isEndTile).length > 1) return null;
  return { ...item, validArrangements: arrangements };
}

/** The bank order: stable per item (the same on every render) and never a listed answer order. */
export function bankOrder(item: OrderItem): OrderTile[] {
  let h = 0;
  for (const ch of item.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const out = item.tiles.map((t, i) => ({ t, k: ((h ^ (i * 2654435761)) >>> 0) % 997 })).sort((a, b) => a.k - b.k).map(x => x.t);
  const isAnswer = (ts: OrderTile[]) => item.validArrangements.some(a => a.every((id, i) => id === ts[i]?.id));
  for (let n = 0; n < out.length && isAnswer(out); n++) out.push(out.shift()!);
  return out;
}

export const ordersFrom =(items: readonly OrderItem[]) => items.map(askableOrder).filter((i): i is OrderItem => !!i);

export const ORDER_ASK = 'Put all the tiles in order to make one sentence.';
export const orderAssignment = (item: OrderItem): TeachingAssignment => ({ id: item.id, task: ORDER_ASK, response: 'gesture' });

export const orderJudgeRequest = (item: OrderItem, ids: readonly string[], grade?: string): WordBuildJudgeRequest => ({
  ask: `Make one sentence that makes sense from these tiles: ${item.tiles.map(t => t.text).join(' | ')}`,
  made: orderText(item, ids), unit: 'sentence', ...(grade ? { grade } : {}),
});

export function orderScene(item: OrderItem, ids: readonly string[], inspectorSaid?: string): WorkspaceScene {
  return { objects: [], facts: {
    ask: ORDER_ASK,
    tiles: item.tiles.map(t => t.text).join(' | '),
    sentence: ids.length ? orderText(item, ids) : 'empty',
    tilesPlaced: ids.length,
    tilesTotal: item.tiles.length,
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: 'The learner taps tiles into a row (tap one in the row to take it back) and presses "I\'m done!". Every '
      + 'tile is used once. The builder checks the order; more than one order can be right. You cannot move a tile.',
  } };
}

// ── Levers ───────────────────────────────────────────────────────────────────
export const ROLES_LEVER = 'tile_roles';
export const MODEL_LEVER = 'model_sentence';
export const SHORTER_LEVER = 'shorter_sentence';

export const ROLE_LABEL: Record<TileRole, string> = {
  subject: 'who or what', predicate: 'does what', object: 'to what', modifier: 'more about it', conjunction: 'joining word', punctuation: 'end mark',
};
const MODELS: Record<string, string> = {
  simple: 'The bird sings a song.', compound: 'The sun came out, and the snow melted.',
  complex: 'When the bell rang, the children went outside.', 'compound-complex': 'When it rained, we stayed in, and we read books.',
};
export const modelFor = (sentenceType: string) => MODELS[sentenceType] ?? MODELS.simple;

/** The easier practice item: the first clause only (up to the joining word) with the end mark; null on a one-clause item. */
export function shorterFor(item: OrderItem): OrderItem | null {
  const order = item.validArrangements[0];
  const cut = order.findIndex(id => item.tiles.find(t => t.id === id)?.role === 'conjunction');
  if (cut < 2) return null;
  const end = item.tiles.find(isEndTile);
  const keep = [...order.slice(0, cut), ...(end ? [end.id] : [])];
  return { id: `${item.id}~shorter`, tiles: item.tiles.filter(t => keep.includes(t.id)), validArrangements: [keep] };
}

const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly OrderMiss[], when: string, does: string,
  pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier: 'shown', when, does, answers, pulled: pulled.includes(id) });

export function orderLevers(item: OrderItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  return [
    lever(ROLES_LEVER, 'help', ['not_sense', 'end_mark_not_last'],
      'The learner\'s order does not make sense, or the end mark is not last.',
      'Labels every tile with its job (who or what, does what, joining word, end mark). No tile is placed.', pulled),
    lever(MODEL_LEVER, 'help', ['not_sense', 'tiles_left'],
      'The learner still cannot make a sentence of this kind, or leaves tiles out.',
      'Shows one finished sentence of the same kind with other words.', pulled),
    ...(shorterFor(item) ? [lever(SHORTER_LEVER, 'simplify', ['not_sense', 'tiles_left'],
      'The learner cannot order this many tiles.',
      'Opens a practice item with the first part of the sentence only (up to the joining word) and the end mark, ungraded. The full item comes back after it.',
      pulled)] : []),
  ];
}

export function orderMissWords(miss: OrderMiss | undefined): string {
  switch (miss) {
    case 'tiles_left': return 'Use every tile in your sentence.';
    case 'end_mark_not_last': return 'The end mark goes at the very end.';
    case 'not_sense': return 'Read it out loud. Does it make sense? Try another order.';
    default: return 'Not quite. Try again.';
  }
}
