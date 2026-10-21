/**
 * Sentence order — sentence-builder's tile modes (simple, compound, complex, compound-complex) on the teaching workspace
 * (R12, OB-7L). The learner puts ALL the given tiles in order to make one sentence and presses "I'm done!". The
 * sentence is not printed first (the old target-meaning line WAS the sentence). An order the generator listed passes
 * in code; an order it did not list, with every tile used and the end mark last, goes to the shared literacy judge
 * (`unit: 'sentence'`), because tiles often have more than one good order.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import type { WordBuildJudgeRequest } from '../../../service/build-layer/wordBuildDecision';
import type { OrderMiss } from './sentenceBuilder.card';

export { ORDER_MISSES, type OrderMiss } from './sentenceBuilder.card';

export type TileRole = 'subject' | 'predicate' | 'object' | 'modifier' | 'conjunction' | 'punctuation';
export type OrderMode = 'simple' | 'compound' | 'complex' | 'compound_complex';
export interface OrderTile { id: string; text: string; role: TileRole }
export interface OrderItem {
  id: string;
  targetMeaning?: string;
  tiles: OrderTile[];
  validArrangements: string[][];
  hint?: string;
  /** The eval mode, from the lesson's sentence type (stamped by the boss's `items`). */
  mode?: OrderMode;
  /** The lesson's support tier, stamped on each item (when the model lever comes). */
  supportTier?: SupportTier;
}

/** The lesson's sentence type as its eval mode. */
export const ORDER_MODE: Record<string, OrderMode> = {
  simple: 'simple', compound: 'compound', complex: 'complex', 'compound-complex': 'compound_complex',
};

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

/**
 * A stable mixed order of a list (the same on every render) that is never an answer and holds no run of three that
 * sits together, in that order, in an answer: listed that way, a bank of tiles would read out the sentence. Compared
 * as lower-case text, so two "the" tiles are the same tile. When no salt finds such an order (a three-tile list has
 * few), it keeps the one with the fewest runs that is not an answer. `tail` stays last, unmixed (the end marks).
 */
export function mixedOrder<T>(list: readonly T[], textOf: (t: T) => string, answers: readonly (readonly string[])[], seed: string,
  tail: readonly T[] = []): T[] {
  const said = answers.map(a => a.map(s => s.toLowerCase()));
  const runs = new Set(said.flatMap(a => a.slice(0, -2).map((_, i) => a.slice(i, i + 3).join('\u0001'))));
  const whole = new Set(said.map(a => a.join('\u0001')));
  const score = (order: T[]) => {
    const words = [...order, ...tail].map(t => textOf(t).toLowerCase());
    if (whole.has(words.join('\u0001'))) return Infinity;
    return words.slice(0, -2).filter((_, i) => runs.has(words.slice(i, i + 3).join('\u0001'))).length;
  };
  let best: T[] = [...list], bestScore = score(best);
  for (let salt = 0; salt < 64 && bestScore > 0; salt++) {
    let h = salt;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const order = list.map((t, i) => ({ t, k: ((h ^ (i * 2654435761)) >>> 0) % 997 })).sort((a, b) => a.k - b.k).map(x => x.t);
    const s = score(order);
    if (s < bestScore) { best = order; bestScore = s; }
  }
  // Still an answer (a list too short to mix): turn it until it is not one.
  for (let n = 0; n < best.length && bestScore === Infinity; n++) { best = [...best.slice(1), best[0]]; bestScore = score(best); }
  return [...best, ...tail];
}

/** The bank order: never a listed answer order, and no three tiles together as an answer has them. */
export const bankOrder = (item: OrderItem): OrderTile[] =>
  mixedOrder(item.tiles, t => t.text, item.validArrangements.map(a => textOf(item, a)), item.id);

export const ordersFrom = (items: readonly OrderItem[]) => items.map(askableOrder).filter((i): i is OrderItem => !!i);

export const ORDER_ASK = 'Put all the tiles in order to make one sentence.';

export const orderJudgeRequest = (item: OrderItem, ids: readonly string[], grade?: string): WordBuildJudgeRequest => ({
  ask: `Make one sentence that makes sense from these tiles: ${item.tiles.map(t => t.text).join(' | ')}`,
  made: orderText(item, ids), unit: 'sentence', ...(grade ? { grade } : {}),
});

/**
 * What the tutor is told: the tiles in bank order (never an answer order, `bankOrder`) and the learner's row as text.
 * The moves are the card's; this says what the builder checks and how to teach it.
 */
export function orderScene(item: OrderItem, ids: readonly string[], inspectorSaid?: string): SceneOf {
  return { objects: [], facts: {
    ask: ORDER_ASK,
    tiles: bankOrder(item).map(t => t.text).join(' | '),
    sentence: ids.length ? orderText(item, ids) : 'empty',
    tilesPlaced: ids.length,
    tilesTotal: item.tiles.length,
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: 'Each tile is used once, and the sentence is never printed before. More than one order can be right. '
      + 'Ask what the sentence is about, or which tile tells who.',
  } };
}

// ── Levers (declared in `sentenceBuilderLevers.ts`) ─────────────────────────────
export const ROLES_LEVER = 'tile_roles';
export const MODEL_LEVER = 'model_sentence';
export const SHORTER_LEVER = 'shorter_sentence';

export const ROLE_LABEL: Record<TileRole, string> = {
  subject: 'who or what', predicate: 'does what', object: 'to what', modifier: 'more about it', conjunction: 'joining word', punctuation: 'end mark',
};
const MODELS: Record<OrderMode, string> = {
  simple: 'The bird sings a song.', compound: 'The sun came out, and the snow melted.',
  complex: 'When the bell rang, the children went outside.', compound_complex: 'When it rained, we stayed in, and we read books.',
};
/** A finished sentence of the item's kind with other words; null when the item's own sentence is the model. */
export function orderModelFor(item: OrderItem): string | null {
  const model = MODELS[item.mode ?? 'simple'];
  const own = item.validArrangements.map(a => orderText(item, a).toLowerCase());
  return own.includes(model.toLowerCase()) ? null : model;
}

const SHORTER = '~shorter';
/** The easier practice item: the first clause only (up to the joining word) with the end mark; null on a one-clause item. */
export function shorterFor(item: OrderItem): OrderItem | null {
  if (item.id.endsWith(SHORTER)) return null;
  const order = item.validArrangements[0];
  const cut = order.findIndex(id => item.tiles.find(t => t.id === id)?.role === 'conjunction');
  if (cut < 2) return null;
  const end = item.tiles.find(isEndTile);
  const keep = [...order.slice(0, cut), ...(end ? [end.id] : [])];
  return { id: `${item.id}${SHORTER}`, tiles: item.tiles.filter(t => keep.includes(t.id)), validArrangements: [keep],
    ...(item.mode ? { mode: item.mode } : {}), ...(item.supportTier ? { supportTier: item.supportTier } : {}) };
}
export const shorterParent = (id: string) => id.replace(/~shorter$/, '');

export function orderMissWords(miss: OrderMiss | undefined): string {
  switch (miss) {
    case 'tiles_left': return 'Use every tile in your sentence.';
    case 'end_mark_not_last': return 'The end mark goes at the very end.';
    case 'not_sense': return 'Read it out loud. Does it make sense? Try another order.';
    default: return 'Not quite. Try again.';
  }
}
