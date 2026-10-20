/**
 * timeline-explorer's domain: the items, checks, keys, misses and scene (the wiring is `timelineExplorer.card.ts` +
 * `timelineExplorer.boss.ts`).
 *
 * Gemini writes the timeline: 5-8 events, each with a date, a title, a description, a one-sentence clue that names
 * neither its title nor its date, and optionally the later event it led to (`ledTo`). Code builds every check item
 * from those events and keys it from their time order (`sortOrder`), so no model writes a question, an option or a key:
 * - identify: a clue; the learner says or taps the event it describes (options are event titles).
 * - date: an event's title; the learner says or taps when it happened (options are event dates).
 * - order: event cards in a mixed order; the learner moves them into time order, earliest at the top.
 * - cause_effect: causes and effects (event titles); the learner matches each cause to the event it led to.
 * `config.difficulty` sets the structure: easy has fewer options, far apart in time, and fewer cards or links; hard
 * has options and cards next to each other in time, and an extra effect that happened before every cause.
 * The eval modes pick the kinds: explore = identify; order = order and identify; connect = cause_effect and date.
 * identify and date are a short phrase said aloud or tapped (J14); order and cause_effect are gestures checked by code.
 *
 * Pure: the component, the generator, the boss and the tests read the same items, checks, misses and scene.
 */
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { KIND_MISSES, type ChoiceMiss, type OrderMiss, type TimelineMiss } from './timelineExplorer.card';

export { KIND_MISSES };
export type { ChoiceMiss, LinkMiss, OrderMiss, TimelineMiss } from './timelineExplorer.card';

export type TimelineMode = 'explore' | 'order' | 'connect';
export type TimelineKind = 'identify' | 'date' | 'order' | 'cause_effect';
export type TimelineTier = 'easy' | 'medium' | 'hard';
export const TIMELINE_KINDS: TimelineKind[] = ['identify', 'date', 'order', 'cause_effect'];
/** The kinds each eval mode asks, as the catalog's `challengeTypes`. */
export const MODE_KINDS: Record<TimelineMode, TimelineKind[]> = {
  explore: ['identify'], order: ['order', 'identify'], connect: ['cause_effect', 'date'],
};

export interface TimelineEvent {
  id: string;
  date: string;
  sortOrder: number;
  title: string;
  description: string;
  imagePrompt?: string;
  impact?: string;
  connection?: string;
  /** One sentence describing the event without its title's words or its date (identify items). */
  clue?: string;
  /** The id of a later event this one led to (cause_effect items). */
  ledTo?: string;
}

interface ChoiceBase { id: string; eventId: string; options: string[] }
export interface IdentifyItem extends ChoiceBase { kind: 'identify' }
export interface DateItem extends ChoiceBase { kind: 'date' }
export type ChoiceItem = IdentifyItem | DateItem;
export interface OrderItem { id: string; kind: 'order'; cards: string[] }
export interface LinkItem { id: string; kind: 'cause_effect'; causes: string[]; effects: string[] }
export type TimelineItem = ChoiceItem | OrderItem | LinkItem;

// ── Chronology ───────────────────────────────────────────────────────────────────────────

/** The events in time order. */
export const chronological = (events: readonly TimelineEvent[]): TimelineEvent[] =>
  events.map((e, i) => ({ e, i })).sort((a, b) => a.e.sortOrder - b.e.sortOrder || a.i - b.i).map(x => x.e);

export interface Deck { events: TimelineEvent[]; rank: Map<string, number>; byId: Map<string, TimelineEvent> }
export function deckOf(events: readonly TimelineEvent[]): Deck {
  const sorted = chronological(events);
  return { events: sorted, rank: new Map(sorted.map((e, i) => [e.id, i])), byId: new Map(sorted.map(e => [e.id, e])) };
}
const rankOf = (deck: Deck, id: string) => deck.rank.get(id) ?? -1;

/** Each cause and the later event it led to; one cause per effect. */
export function linksOf(deck: Deck): Array<[string, string]> {
  const out: Array<[string, string]> = [], used = new Set<string>();
  for (const e of deck.events) {
    const to = e.ledTo;
    if (!to || to === e.id || !deck.byId.has(to) || rankOf(deck, to) <= rankOf(deck, e.id) || used.has(to)) continue;
    used.add(to); out.push([e.id, to]);
  }
  return out;
}

// ── Words: what a clue or a card may not say ─────────────────────────────────────────────

const STOP = new Set(['the', 'and', 'that', 'this', 'with', 'from', 'into', 'their', 'there', 'they', 'were', 'was', 'have',
  'been', 'for', 'about', 'after', 'before', 'over', 'under', 'what', 'when', 'which', 'where', 'first', 'great', 'new']);
const stem = (w: string) => w.toLowerCase().replace(/['’]s$/, '').slice(0, 5);
const words = (s: string) => (s.match(/[A-Za-z][A-Za-z'’]+/g) ?? []).filter(w => w.length >= 4 && !STOP.has(w.toLowerCase()));
export const yearsIn = (s: string): string[] => Array.from(s.match(/\b\d{3,4}\b/g) ?? []);

/** The stems of an event's title that no other event's title shares: a text with one of them points at the event. */
export function uniqueTitleStems(deck: Deck, id: string): Set<string> {
  const own = new Set(words(deck.byId.get(id)?.title ?? '').map(stem));
  for (const e of deck.events) if (e.id !== id) for (const w of words(e.title)) own.delete(stem(w));
  return own;
}
export const mentions = (text: string, stems: Set<string>) => words(text).some(w => stems.has(stem(w)));

/** A clue that names its own event (a word only its title has) or its date. */
export function clueLeaks(deck: Deck, id: string): boolean {
  const e = deck.byId.get(id);
  const clue = e?.clue?.trim() ?? '';
  if (!e || clue.length < 12) return true;
  if (mentions(clue, uniqueTitleStems(deck, id))) return true;
  if (e.date.trim() && clue.toLowerCase().includes(e.date.trim().toLowerCase())) return true;
  return yearsIn(e.date).some(y => yearsIn(clue).includes(y));
}

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
/** A text with its dates taken out: years, month-and-day, centuries, eras. */
export function redactDates(text: string): string {
  return text
    .replace(new RegExp(`\\b(${MONTHS})(\\s+\\d{1,2}(st|nd|rd|th)?)?,?\\s*`, 'g'), '')
    .replace(/\b\d{1,2}(st|nd|rd|th)[- ]century\b/gi, 'a time')
    .replace(/\b(in|by|around|until|from)\s+(the\s+)?\d{3,4}s?\b/gi, '')
    .replace(/\b\d{3,4}s?\b/g, '')
    .replace(/\b(BCE|BC|CE|AD|A\.D\.|B\.C\.)\b/g, '')
    .replace(/\s+([,.;])/g, '$1').replace(/\s{2,}/g, ' ').replace(/^[,\s]+/, '').trim();
}

// ── Keys and checks ──────────────────────────────────────────────────────────────────────

export const orderKey = (deck: Deck, item: OrderItem) => [...item.cards].sort((a, b) => rankOf(deck, a) - rankOf(deck, b));
/** For each cause, the effect it led to. */
export function linkKey(deck: Deck, item: LinkItem): Record<string, string> {
  return Object.fromEntries(item.causes.map(c => [c, deck.byId.get(c)?.ledTo ?? '']));
}

/** The learner's work: a choice, the cards top to bottom, and the cause → effect pairs. */
export interface TimelineWork { choice: string | null; order: string[]; pairs: Record<string, string> }
export const emptyWork = (item: TimelineItem | undefined): TimelineWork =>
  ({ choice: null, order: item?.kind === 'order' ? [...item.cards] : [], pairs: {} });
export function workComplete(item: TimelineItem, w: TimelineWork): boolean {
  if (item.kind === 'order') return w.order.length === item.cards.length;
  if (item.kind === 'cause_effect') return item.causes.every(c => !!w.pairs[c]);
  return w.choice !== null;
}

export function timelineCorrect(deck: Deck, item: TimelineItem | undefined, w: TimelineWork): boolean {
  if (!item || !workComplete(item, w)) return false;
  if (item.kind === 'order') return orderKey(deck, item).every((id, i) => w.order[i] === id);
  if (item.kind === 'cause_effect') { const key = linkKey(deck, item); return item.causes.every(c => w.pairs[c] === key[c]); }
  return w.choice === item.eventId;
}

export const MODE_MISSES = (mode: TimelineMode): TimelineMiss[] => MODE_KINDS[mode].flatMap(k => [...KIND_MISSES[k]]);

function choiceMissOf(deck: Deck, item: ChoiceItem, chose: string): ChoiceMiss {
  const near = Math.abs(rankOf(deck, chose) - rankOf(deck, item.eventId)) === 1;
  return item.kind === 'identify' ? (near ? 'adjacent_event' : 'distant_event') : (near ? 'adjacent_date' : 'distant_date');
}

/** What a wrong order shows, read from the placed order alone (timeline-builder's ids). */
export function orderMissOf(seq: number[]): OrderMiss | undefined {
  const n = seq.length;
  if (seq.every((p, i) => p === i)) return undefined;
  if (seq.every((p, i) => p === n - 1 - i)) return 'reversed';
  const off = seq.flatMap((p, i) => (p === i ? [] : [i]));
  if (off.length === 2 && seq[off[0]] === off[1] && seq[off[1]] === off[0]) return off[1] - off[0] === 1 ? 'adjacent_swap' : 'two_swapped';
  if (seq.some((_, k) => seq.filter((__, i) => i !== k).every((p, i, rest) => i === 0 || p > rest[i - 1]))) return 'one_moved';
  return 'mixed_order';
}

export function timelineMiss(deck: Deck, item: TimelineItem | undefined, w: TimelineWork): TimelineMiss | undefined {
  if (!item || !workComplete(item, w) || timelineCorrect(deck, item, w)) return undefined;
  if (item.kind === 'order') {
    const key = orderKey(deck, item);
    return orderMissOf(w.order.map(id => key.indexOf(id)));
  }
  if (item.kind === 'cause_effect') {
    const key = linkKey(deck, item), caused = new Set(Object.values(key));
    if (item.causes.some(c => !caused.has(w.pairs[c]))) return 'used_extra';
    if (item.causes.some(c => rankOf(deck, w.pairs[c]) < rankOf(deck, c))) return 'effect_before_cause';
    const wrong = item.causes.filter(c => w.pairs[c] !== key[c]);
    if (wrong.length === 2 && w.pairs[wrong[0]] === key[wrong[1]] && w.pairs[wrong[1]] === key[wrong[0]]) return 'pairs_swapped';
    return 'mixed_links';
  }
  return choiceMissOf(deck, item, w.choice!);
}

// ── The ask ──────────────────────────────────────────────────────────────────────────────

export const titleOf = (deck: Deck, id: string) => deck.byId.get(id)?.title ?? id;
export const dateOf = (deck: Deck, id: string) => deck.byId.get(id)?.date ?? '';
/** What a choice button says: an event's title (identify) or its date (date). */
export const optionLabel = (deck: Deck, item: ChoiceItem, id: string) => (item.kind === 'identify' ? titleOf(deck, id) : dateOf(deck, id));

export function askOf(deck: Deck, item: TimelineItem): string {
  switch (item.kind) {
    case 'identify': return `Which event does this clue describe? "${deck.byId.get(item.eventId)?.clue?.trim() ?? ''}"`;
    case 'date': return `When did this happen: "${titleOf(deck, item.eventId)}"?`;
    case 'order': return 'Put these events in time order, with the earliest at the top.';
    case 'cause_effect': return `Match each cause to the event it led to.${item.effects.length > item.causes.length ? ' One event on the right was not caused by any of them.' : ''}`;
  }
}

// ── Item space ───────────────────────────────────────────────────────────────────────────

export type Rng = () => number;
/** A seeded generator, so a lesson without stored items builds the same items everywhere. */
export function seededRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const shuffle = <T,>(xs: readonly T[], rng: Rng): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

/** Events an identify item can ask: a clue that does not name the event. */
export const identifiable = (deck: Deck) => deck.events.filter(e => !clueLeaks(deck, e.id));
/** A title that says its own event's date or year: the date ask ("When did this happen: <title>?") would say the key. */
export function titleDates(deck: Deck, id: string): boolean {
  const e = deck.byId.get(id);
  if (!e) return true;
  const title = e.title.toLowerCase(), date = e.date.trim().toLowerCase();
  return (!!date && title.includes(date)) || yearsIn(e.date).some(y => yearsIn(e.title).includes(y));
}
/** Events a date item can ask: a title that does not say the date. */
export const datable = (deck: Deck) => deck.events.filter(e => !titleDates(deck, e.id));
const distinctBy = (deck: Deck, kind: 'identify' | 'date', ids: string[]) => {
  const seen = new Set<string>();
  return ids.filter(id => { const k = (kind === 'identify' ? titleOf(deck, id) : dateOf(deck, id)).trim().toLowerCase();
    if (!k || seen.has(k)) return false; seen.add(k); return true; });
};

/** The options of a choice item: easy 3 far apart in time; medium 4; hard 4 with the events next to it in time. */
export function choiceOptions(deck: Deck, kind: 'identify' | 'date', eventId: string, tier: TimelineTier, rng: Rng): string[] | null {
  const r = rankOf(deck, eventId);
  const others = shuffle(deck.events.map(e => e.id).filter(id => id !== eventId), rng);
  const near = others.filter(id => Math.abs(rankOf(deck, id) - r) === 1);
  const far = others.filter(id => Math.abs(rankOf(deck, id) - r) > 1);
  const n = tier === 'easy' ? 3 : 4;
  const order = tier === 'easy' ? [...far, ...near] : tier === 'hard' ? [...near, ...far] : others;
  const picked = distinctBy(deck, kind, [eventId, ...order]).slice(0, n);
  if (picked[0] !== eventId || picked.length < 3) return null;
  return shuffle(picked, rng);
}

/** The cards of an order item: easy 3 spread out; medium 4; hard 5 next to each other in time. */
export function orderCards(deck: Deck, tier: TimelineTier, rng: Rng, avoid: readonly string[] = []): string[] | null {
  const ids = deck.events.map(e => e.id), n = ids.length;
  const candidates: string[][] = [];
  if (tier === 'easy') {
    for (let a = 0; a < n; a++) for (let b = a + 2; b < n; b++) for (let c = b + 2; c < n; c++) candidates.push([ids[a], ids[b], ids[c]]);
    if (!candidates.length) for (let a = 0; a + 2 < n; a++) candidates.push([ids[a], ids[a + 1], ids[a + 2]]);
  } else if (tier === 'medium') {
    const pick = (k: number, from: number, acc: string[]) => { if (acc.length === k) { candidates.push(acc); return; } for (let i = from; i < n; i++) pick(k, i + 1, [...acc, ids[i]]); };
    pick(Math.min(4, n), 0, []);
  } else {
    const k = Math.min(5, n);
    for (let a = 0; a + k <= n; a++) candidates.push(ids.slice(a, a + k));
  }
  if (!candidates.length || candidates[0].length < 3) return null;
  const links = linksOf(deck);
  const score = (cs: string[]) => (links.some(([c, e]) => cs.includes(c) && cs.includes(e)) ? 0 : 2) + cs.filter(id => avoid.includes(id)).length;
  const ranked = shuffle(candidates, rng).sort((a, b) => score(a) - score(b));
  return startOrder(ranked[0], rng);
}

/** A mixed starting order that is neither the time order nor its reverse. */
function startOrder(cards: string[], rng: Rng): string[] {
  for (let i = 0; i < 20; i++) {
    const s = shuffle(cards, rng);
    if (s.some((id, k) => id !== cards[k]) && s.some((id, k) => id !== cards[cards.length - 1 - k])) return s;
  }
  return [cards[1], cards[0], ...cards.slice(2)];
}

/** A cause_effect item: easy 2 links, medium 3, hard 3 and an extra effect earlier than every cause. */
export function linkItemParts(deck: Deck, tier: TimelineTier, rng: Rng, links = linksOf(deck)): { causes: string[]; effects: string[] } | null {
  const want = tier === 'easy' ? 2 : 3;
  const extraFor = (set: Array<[string, string]>) => {
    const first = Math.min(...set.map(([c]) => rankOf(deck, c)));
    return deck.events.find(e => rankOf(deck, e.id) < first && !set.some(([c, x]) => c === e.id || x === e.id));
  };
  if (links.length < 2) return null;
  // Every set of links of the wanted size, best first: no event both a cause and an effect (a chain of "the next
  // event" asks only the order), and on hard an event earlier than every cause left over to be the extra effect.
  const sets: Array<Array<[string, string]>> = [];
  const size = Math.min(want, links.length);
  const pick = (from: number, acc: Array<[string, string]>) => { if (acc.length === size) { sets.push(acc); return; } for (let i = from; i < links.length; i++) pick(i + 1, [...acc, links[i]]); };
  pick(0, []);
  // Every link to the very next event: "what came next" answers it, not the causes (R6, 10-16). Only the hard tier's
  // extra effect, which defines that tier, outranks it.
  const nextOnly = (s: Array<[string, string]>) => s.every(([c, e]) => rankOf(deck, e) === rankOf(deck, c) + 1);
  const score = (s: Array<[string, string]>) => (tier === 'hard' && !extraFor(s) ? 8 : 0) + (nextOnly(s) ? 4 : 0)
    + (s.some(([c]) => s.some(([, e]) => e === c)) ? 2 : 0);
  const chosen = shuffle(sets, rng).sort((a, b) => score(a) - score(b))[0];
  const causes = chosen.map(([c]) => c), effects = chosen.map(([, e]) => e);
  const extra = tier === 'hard' ? extraFor(chosen) : undefined;
  if (extra) effects.push(extra.id);
  const causeOrder = shuffle(causes, rng);
  let effectOrder = shuffle(effects, rng);
  for (let i = 0; i < 10 && causeOrder.every((c, k) => effectOrder[k] === deck.byId.get(c)?.ledTo); i++) effectOrder = shuffle(effects, rng);
  return { causes: causeOrder, effects: effectOrder };
}

/** How many items of which kinds a session asks, by the kinds it was given. */
export function sessionPlan(kinds: readonly TimelineKind[]): TimelineKind[] {
  const has = (k: TimelineKind) => kinds.includes(k);
  if (kinds.length === 1 && has('identify')) return ['identify', 'identify', 'identify'];
  if (kinds.length === 2 && has('order') && has('identify')) return ['order', 'identify', 'order'];
  if (kinds.length === 2 && has('cause_effect') && has('date')) return ['cause_effect', 'date', 'date'];
  return TIMELINE_KINDS.filter(has);
}

export function buildTimelineItems(opts: { events: readonly TimelineEvent[]; kinds: readonly TimelineKind[]; tier: TimelineTier; rng: Rng }): TimelineItem[] {
  const deck = deckOf(opts.events), { tier, rng } = opts;
  const out: TimelineItem[] = [];
  const asked = new Set<string>(), carded: string[] = [];
  const identifyPool = shuffle(identifiable(deck).map(e => e.id), rng), datePool = shuffle(datable(deck).map(e => e.id), rng);
  let linkBuilt = false;
  for (const kind of sessionPlan(opts.kinds)) {
    if (kind === 'identify' || (kind === 'date')) {
      const pool = kind === 'identify' ? identifyPool : datePool;
      const id = pool.find(x => !asked.has(x));
      const options = id ? choiceOptions(deck, kind, id, tier, rng) : null;
      if (id && options) { asked.add(id); out.push({ id: '', kind, eventId: id, options }); }
    } else if (kind === 'order') {
      const cards = orderCards(deck, tier, rng, carded);
      if (cards) { carded.push(...cards); out.push({ id: '', kind, cards }); }
    } else if (!linkBuilt) {
      const parts = linkItemParts(deck, tier, rng);
      if (parts) { linkBuilt = true; out.push({ id: '', kind, ...parts }); }
      else {
        // Too few links for a matching: a date item in its place.
        const id = datePool.find(x => !asked.has(x));
        const options = id ? choiceOptions(deck, 'date', id, tier, rng) : null;
        if (id && options) { asked.add(id); out.push({ id: '', kind: 'date', eventId: id, options }); }
      }
    }
  }
  const counts: Record<string, number> = {};
  return out.map(i => { counts[i.kind] = (counts[i.kind] ?? 0) + 1; return { ...i, id: `${i.kind}-${counts[i.kind]}` }; });
}

// ── Lesson data → items ──────────────────────────────────────────────────────────────────

export interface TimelineItemsSource {
  title?: string;
  events?: TimelineEvent[];
  challengeTypes?: string[];
  difficulty?: string;
  items?: TimelineItem[];
  /** Legacy generations (model-written questions and keys): read only for their kinds. */
  challenges?: Array<{ type?: string }>;
}

export const resolveTier = (d: Pick<TimelineItemsSource, 'difficulty'>): TimelineTier => {
  const t = (d.difficulty ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};
/** The kinds a lesson asks: its pin, else the legacy challenges' types, else every kind. */
export function resolveKinds(d: TimelineItemsSource): TimelineKind[] {
  const valid = (xs: Array<string | undefined>) => TIMELINE_KINDS.filter(k => xs.includes(k));
  const pinned = valid(d.challengeTypes ?? []);
  if (pinned.length) return pinned;
  const legacy = valid((d.challenges ?? []).map(c => c?.type));
  return legacy.length ? legacy : [...TIMELINE_KINDS];
}

/** False when a stored item is not one code could have built from these events. */
export function validTimelineItem(deck: Deck, i: TimelineItem | undefined): i is TimelineItem {
  if (!i || typeof i.id !== 'string') return false;
  const known = (ids: unknown) => Array.isArray(ids) && ids.every(id => deck.byId.has(id as string)) && new Set(ids).size === ids.length;
  if (i.kind === 'identify' || i.kind === 'date') {
    return deck.byId.has(i.eventId) && known(i.options) && i.options.includes(i.eventId) && i.options.length >= 2
      && (i.kind === 'date' ? !titleDates(deck, i.eventId) : !clueLeaks(deck, i.eventId));
  }
  if (i.kind === 'order') return known(i.cards) && i.cards.length >= 2;
  if (i.kind === 'cause_effect') {
    if (!known(i.causes) || !known(i.effects) || i.causes.length < 2) return false;
    const key = linkKey(deck, i);
    return i.causes.every(c => i.effects.includes(key[c]) && rankOf(deck, key[c]) > rankOf(deck, c));
  }
  return false;
}

/** Every item of the session: the stored, code-built items when valid, else built from the lesson's own events. */
export function timelineItems(d: TimelineItemsSource): TimelineItem[] {
  const events = d.events ?? [];
  if (events.length < 3) return [];
  const deck = deckOf(events);
  const stored = Array.isArray(d.items) ? d.items.filter(i => validTimelineItem(deck, i)) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  return buildTimelineItems({ events, kinds: resolveKinds(d), tier: resolveTier(d), rng: seededRng(`${d.title ?? 'timeline'}:${events.length}`) });
}

// ── The session's check items, spoken keys ──────────────────────────────────────────────

/**
 * A check item as the boss and the component carry it: the item, the eval mode it belongs to, and the lesson's events
 * (so the ask, the key and the levers read the deck without the lesson).
 */
export type TimelineCheck = TimelineItem & { mode: TimelineMode; events: readonly TimelineEvent[] };

const DECKS = new WeakMap<readonly TimelineEvent[], Deck>();
/** The deck of a check's events, built once per events list. */
export function deckFor(events: readonly TimelineEvent[]): Deck {
  let deck = DECKS.get(events);
  if (!deck) { deck = deckOf(events); DECKS.set(events, deck); }
  return deck;
}

/** The eval mode an item kind belongs to in a session of these kinds (identify sits in order when cards are asked). */
export function modeOfKind(kind: TimelineKind, kinds: readonly TimelineKind[]): TimelineMode {
  if (kind === 'order') return 'order';
  if (kind === 'date' || kind === 'cause_effect') return 'connect';
  return kinds.includes('order') ? 'order' : 'explore';
}

/** An item as a check of this lesson. */
export const asCheck = (item: TimelineItem, mode: TimelineMode, events: readonly TimelineEvent[]): TimelineCheck => ({ ...item, mode, events });

/** Every check item of the session (`timelineItems`), carrying its mode and the events. */
export function timelineChecks(d: TimelineItemsSource): TimelineCheck[] {
  const events = d.events ?? [], kinds = resolveKinds(d);
  return timelineItems(d).map(i => asCheck(i, modeOfKind(i.kind, kinds), events));
}

const ORDINAL = ['first', 'second', 'third', 'fourth'];

/**
 * The key of a choice item: the event's title (identify) or its date (date), its place in the list, and for a date its
 * year alone. Null on a card item: the activity checks it.
 */
export function timelineKey(check: TimelineCheck): SpokenKey | null {
  if (check.kind !== 'identify' && check.kind !== 'date') return null;
  const deck = deckFor(check.events), answer = optionLabel(deck, check, check.eventId).trim();
  if (!answer) return null;
  const place = `the ${ORDINAL[check.options.indexOf(check.eventId)]} one`;
  const years = check.kind === 'date' ? yearsIn(answer).filter(y => y !== answer) : [];
  return {
    answer, alsoAccept: [...years, place],
    ...(check.kind === 'identify' ? { acceptRule: 'Words that clearly name that event and no other choice also count.' } : {}),
    signatureError: 'Naming two choices, or hedging between them, is not an answer.',
  };
}

/** A spoken item's known wrong answers, most specific first, with the tap's miss ids. */
export function timelineSpokenMisses(deck: Deck, item: ChoiceItem): KnownMiss[] {
  const groups = new Map<ChoiceMiss, string[]>();
  for (const id of item.options) if (id !== item.eventId) {
    const m = choiceMissOf(deck, item, id);
    groups.set(m, [...(groups.get(m) ?? []), optionLabel(deck, item, id)]);
  }
  const what: Record<ChoiceMiss, string> = {
    adjacent_event: 'names the event just before or just after it in time',
    distant_event: 'names an event far from it in time',
    adjacent_date: 'gives the date of the event just before or just after it',
    distant_date: 'gives a date far from it in time',
  };
  return KIND_MISSES[item.kind].flatMap(m => {
    const ex = groups.get(m as ChoiceMiss);
    return ex ? [{ id: m, pattern: `The learner's answer ${what[m as ChoiceMiss]}: ${ex.map(x => `"${x}"`).join(', ')}.`, examples: ex }] : [];
  });
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface TimelineView {
  /** The timeline exhibit is on screen and the check has not started. */
  reading: boolean;
  /** Events the learner has opened, and the one open now. */
  opened: number;
  openEvent: string | null;
  work: TimelineWork;
  /** Credited: the answer is shown on screen. */
  solved: boolean;
}

export function describeTimelineWork(deck: Deck, item: TimelineItem | undefined, w: TimelineWork): string {
  if (!item) return 'Nothing yet';
  if (item.kind === 'order') return `Cards, top to bottom: ${w.order.map((id, i) => `${i + 1}) ${titleOf(deck, id)}`).join('  ')}`;
  if (item.kind === 'cause_effect') {
    const made = item.causes.filter(c => w.pairs[c]).map(c => `"${titleOf(deck, c)}" → "${titleOf(deck, w.pairs[c])}"`);
    return made.length ? `Matched ${made.join('; ')}` : 'No pair matched yet';
  }
  return w.choice ? `Chose "${optionLabel(deck, item, w.choice)}"` : 'Nothing chosen yet';
}

/** What a credited item shows: the events in their place in time. */
export function solvedText(deck: Deck, item: TimelineItem): string {
  if (item.kind === 'order') return `In time order: ${orderKey(deck, item).map(id => `${titleOf(deck, id)} (${dateOf(deck, id)})`).join(', then ')}.`;
  if (item.kind === 'cause_effect') return item.causes.map(c => `${titleOf(deck, c)} led to ${titleOf(deck, deck.byId.get(c)?.ledTo ?? '')}.`).join(' ');
  return `${titleOf(deck, item.eventId)}: ${dateOf(deck, item.eventId)}.`;
}

/**
 * This timeline's own rules for each kind of item (the shared doctrine already forbids saying the answer and doing the
 * step): what is hidden, and the facts about the events that would answer the item.
 */
const NEVER_RETELL = 'never retell what an event was about; ask what the learner remembers of it';
const CONSTRAINTS: Record<TimelineKind, string> = {
  identify: "The timeline is hidden during the check. Never say which event fits the clue or an event's date, and "
    + `${NEVER_RETELL}. When you restate the clue, add no word from a choice's title. After a miss, never say which choice it was close to.`,
  date: "The timeline and its dates are hidden during the check. Never say an event's date or where an event falls in time "
    + `(first, last, next to another), and ${NEVER_RETELL}. After a miss, never say which choice it was close to.`,
  order: "No date is on any card. Never say an event's date, where an event falls in time, or which card comes before "
    + `another (never name a card or a pair to look at), and ${NEVER_RETELL}.`,
  cause_effect: "No date is on any card. Never say which effect goes with a cause, an event's date or where an event falls "
    + `in time, and ${NEVER_RETELL}.`,
};
const LEVER_CARDS = 'Describe a lever card only by what the scene says it shows.';

/** What is drawn and asked. Choices and cards named, never which is right; the answer only once credited. */
export function workspaceScene(deck: Deck, item: TimelineItem, view: TimelineView, meta: { title: string; span: string }): SceneOf {
  if (view.reading) {
    const open = view.openEvent ? deck.byId.get(view.openEvent) : undefined;
    return { objects: [], facts: {
      kind: 'reading',
      shown: `The timeline "${meta.title}" (${meta.span}), ${deck.events.length} events in time order. The learner opens each event to read it `
        + `(opened ${view.opened} of ${deck.events.length}); the questions open when they press Begin the questions, once every event is opened.`,
      ...(open ? { openEvent: `${open.title} (${open.date}): ${open.description}` } : {}),
      constraints: 'Nothing is asked yet: talk about the events freely while the learner reads.',
    } };
  }
  const facts: Record<string, string> = { kind: item.kind, question: askOf(deck, item) };
  if (item.kind === 'identify' || item.kind === 'date') {
    facts.choices = item.options.map((id, i) => `${i + 1}) ${optionLabel(deck, item, id)}`).join('  ');
  } else if (item.kind === 'order') {
    facts.shown = `${item.cards.length} event cards (titles only, no dates); the top is marked Earliest and the bottom Latest.`;
  } else {
    facts.causes = item.causes.map(c => titleOf(deck, c)).join(' | ');
    facts.effects = item.effects.map(e => titleOf(deck, e)).join(' | ');
  }
  if (view.solved) facts.answerShown = solvedText(deck, item);
  facts.learnerWork = describeTimelineWork(deck, item, view.work);
  facts.constraints = `${CONSTRAINTS[item.kind]} ${LEVER_CARDS}`;
  return { objects: [], facts } as SceneOf;
}

// ── The journey's learner (liveJourneySpec row, the dry sweep) ───────────────────────────

/** The journey's answers: the key, and a wrong answer that shows a named miss. */
export function timelineHarnessAnswers(deck: Deck, item: TimelineItem): { correct: TimelineWork; plainWrong: TimelineWork } {
  const work = emptyWork(item);
  if (item.kind === 'order') {
    const key = orderKey(deck, item), wrong = [key[1], key[0], ...key.slice(2)];
    return { correct: { ...work, order: key }, plainWrong: { ...work, order: wrong } };
  }
  if (item.kind === 'cause_effect') {
    const key = linkKey(deck, item), [a, b] = item.causes;
    return { correct: { ...work, pairs: key }, plainWrong: { ...work, pairs: { ...key, [a]: key[b], [b]: key[a] } } };
  }
  const near = item.options.filter(id => id !== item.eventId).sort((x, y) =>
    Math.abs(rankOf(deck, x) - rankOf(deck, item.eventId)) - Math.abs(rankOf(deck, y) - rankOf(deck, item.eventId)));
  return { correct: { ...work, choice: item.eventId }, plainWrong: { ...work, choice: near[0] } };
}

/** The Move-up presses that take the cards from one order to another. */
export function movesTo(deck: Deck, from: readonly string[], to: readonly string[]): string[] {
  const cur = [...from], out: string[] = [];
  to.forEach((id, p) => {
    let j = cur.indexOf(id);
    while (j > p) { out.push(`Move ${titleOf(deck, id)} up`); [cur[j - 1], cur[j]] = [cur[j], cur[j - 1]]; j--; }
  });
  return out;
}
