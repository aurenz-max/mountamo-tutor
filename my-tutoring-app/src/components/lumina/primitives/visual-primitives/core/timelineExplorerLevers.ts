/**
 * The in-item levers on timeline-explorer (`/add-support-tiers`; report
 * qa/eval-reports/timeline-explorer-levers-2026-10-16.md). No real-learner evidence: the misses are what
 * `timelineMiss` observes; the failures behind them are documented (the old catalog's commonStruggles: confuses similar
 * events, struggles with chronological ordering, skips the middle events, does not read the Impact lines) or inferred.
 * The time order IS the answer, so no lever places, numbers or dates the item's own key. Every lever starts released;
 * `config.difficulty` changes the items, not the levers.
 *
 * Help (the screen does more; the item is unchanged):
 * - `show_timeline` (identify): the timeline strip comes back, every event's title in time order with its date. The
 *   clue names neither its event's title words nor its date (`clueLeaks`), so the strip does not point at the answer.
 * - `before_after` (date): a card naming the events just before and just after this one in time, by title, no dates.
 * - `date_line` (date): the date choices laid out in time order on a line. It does not say which is this event's.
 * - `read_cards` (order, cause_effect): under each card, what the learner read about it, with every date taken out
 *   (`redactDates`). On cause_effect a card that names its partner's title words is left out (`cardLine`).
 * - `led_to` (order): an arrow between two cards where one event led to the other, never enough arrows to fix the
 *   whole order (`linksLeaveDoubt`).
 * - `show_dates` (cause_effect): each card's date, only when the dates leave more than one matching in which every
 *   effect comes after its cause (`datesLeaveDoubt`).
 *
 * Simplify (an ungraded practice item of the same kind, then the full item back; never the learner's own key):
 * - `two_choices` (identify) and `two_dates` (date): another event's clue or title with two choices far apart in time.
 * - `fewer_cards` (order): three cards spread out in time, sharing at most one card with the item.
 * - `two_links` (cause_effect): two links whose events are not on the item.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  clueLeaks, dateOf, deckOf, identifiable, KIND_MISSES, linksOf, mentions, orderKey, redactDates, titleOf, uniqueTitleStems,
  type ChoiceItem, type Deck, type LinkItem, type OrderItem, type TimelineItem, type TimelineMiss, linkKey,
} from './timelineExplorerWorkspace';

export const SHOW_TIMELINE_LEVER = 'show_timeline';
export const BEFORE_AFTER_LEVER = 'before_after';
export const DATE_LINE_LEVER = 'date_line';
export const READ_CARDS_LEVER = 'read_cards';
export const LED_TO_LEVER = 'led_to';
export const SHOW_DATES_LEVER = 'show_dates';
export const TWO_CHOICES_LEVER = 'two_choices';
export const TWO_DATES_LEVER = 'two_dates';
export const FEWER_CARDS_LEVER = 'fewer_cards';
export const TWO_LINKS_LEVER = 'two_links';

const rank = (deck: Deck, id: string) => deck.rank.get(id) ?? -1;

// ── Help: what each lever draws ──────────────────────────────────────────────────────────

/** before_after: the titles of the events next to this one in time. */
export function neighbours(deck: Deck, item: ChoiceItem): { before?: string; after?: string } {
  const r = rank(deck, item.eventId);
  return { before: deck.events[r - 1]?.title, after: deck.events[r + 1]?.title };
}
/**
 * The card names only the neighbours that exist. "Nothing comes before it" would tell the learner to take the earliest
 * date choice, which is the key (replay 2026-10-16: "which date fits the very first event?").
 */
export function beforeAfterLines(deck: Deck, item: ChoiceItem): string[] {
  const n = neighbours(deck, item);
  return [...(n.before ? [`Just before it: ${n.before}.`] : []), ...(n.after ? [`Just after it: ${n.after}.`] : [])];
}

/** date_line: the date choices in time order. */
export const dateLine = (deck: Deck, item: ChoiceItem): string[] =>
  [...item.options].sort((a, b) => rank(deck, a) - rank(deck, b)).map(id => dateOf(deck, id));

/** read_cards: one card's line; on a matching, null when it names its partner (the event it led to, or that led to it). */
export function cardLine(deck: Deck, id: string, partners: readonly string[] = []): string | null {
  const e = deck.byId.get(id);
  if (!e?.description) return null;
  const line = redactDates(e.description);
  if (!line || partners.some(p => mentions(line, uniqueTitleStems(deck, p)))) return null;
  return line;
}
export function cardLines(deck: Deck, item: OrderItem | LinkItem): Record<string, string> {
  const out: Record<string, string> = {};
  if (item.kind === 'order') { for (const id of item.cards) { const l = cardLine(deck, id); if (l) out[id] = l; } return out; }
  const key = linkKey(deck, item);
  for (const c of item.causes) { const l = cardLine(deck, c, item.effects); if (l) out[c] = l; }
  for (const e of item.effects) {
    const partners = item.causes.filter(c => key[c] === e);
    const l = cardLine(deck, e, [...partners, ...item.causes]); if (l) out[e] = l;
  }
  return out;
}

/** Every order of the cards that keeps each arrow's cause above its effect. */
function orderingsCount(cards: readonly string[], arrows: ReadonlyArray<[string, string]>): number {
  const perms = (xs: string[]): string[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [x, ...p])));
  return perms([...cards]).filter(p => arrows.every(([a, b]) => p.indexOf(a) < p.indexOf(b))).length;
}
/**
 * The arrows led_to may draw: links between the item's cards that share no card (a chain of arrows would spell out
 * the order), as many as leave more than one order possible.
 */
export function ledToArrows(deck: Deck, item: OrderItem): Array<[string, string]> {
  const among = linksOf(deck).filter(([c, e]) => item.cards.includes(c) && item.cards.includes(e));
  const out: Array<[string, string]> = [];
  for (const l of among) {
    if (out.some(([a, b]) => l.includes(a) || l.includes(b))) continue;
    if (orderingsCount(item.cards, [...out, l]) >= 2) out.push(l);
  }
  return out;
}
export const linksLeaveDoubt = (item: OrderItem, arrows: ReadonlyArray<[string, string]>) => orderingsCount(item.cards, arrows) >= 2;

/** show_dates is offered only when "an effect comes after its cause" leaves more than one matching. */
export function datesLeaveDoubt(deck: Deck, item: LinkItem): boolean {
  const perms = (xs: string[], k: number): string[][] => (k === 0 ? [[]] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)], k - 1).map(p => [x, ...p])));
  return perms(item.effects, item.causes.length).filter(p => item.causes.every((c, i) => rank(deck, p[i]) > rank(deck, c))).length >= 2;
}

/** The leak rule for every lever line on a choice item: never the item's own date or a word only its title has. */
export function choiceLineLeaks(deck: Deck, item: ChoiceItem, line: string): boolean {
  const e = deck.byId.get(item.eventId)!;
  if (item.kind === 'date') return line.includes(e.date) || (e.date.match(/\b\d{3,4}\b/g) ?? []).some(y => line.includes(y));
  return mentions(line, uniqueTitleStems(deck, item.eventId));
}

// ── Simplify: practice items ─────────────────────────────────────────────────────────────

const PRACTICE = '~simpler';
export const isPractice = (item: Pick<TimelineItem, 'id'>) => item.id.endsWith(PRACTICE);
export const practiceParent = (id: string) => (id.endsWith(PRACTICE) ? id.slice(0, -PRACTICE.length) : null);

/**
 * The simpler item, or null when none can be built without repeating the item's own key. `session` is every item of
 * the session, so a practice item does not answer another item either, when it can avoid it.
 */
export function simplerItem(deck: Deck, item: TimelineItem, session: readonly TimelineItem[] = []): TimelineItem | null {
  if (isPractice(item)) return null;
  const id = `${item.id}${PRACTICE}`;
  if (item.kind === 'identify' || item.kind === 'date') {
    const asked = new Set(session.flatMap(i => (i.kind === 'identify' || i.kind === 'date' ? [i.eventId] : [])));
    const pool = (item.kind === 'identify' ? identifiable(deck) : deck.events).map(e => e.id).filter(x => x !== item.eventId);
    const target = pool.find(x => !asked.has(x)) ?? pool[0];
    if (!target) return null;
    const far = deck.events.map(e => e.id).filter(x => x !== target && x !== item.eventId)
      .filter(x => (item.kind === 'identify' ? titleOf(deck, x) !== titleOf(deck, target) : dateOf(deck, x) !== dateOf(deck, target)))
      .sort((a, b) => Math.abs(rank(deck, b) - rank(deck, target)) - Math.abs(rank(deck, a) - rank(deck, target)))[0];
    if (!far) return null;
    const options = rank(deck, target) % 2 ? [far, target] : [target, far];
    return { id, kind: item.kind, eventId: target, options };
  }
  if (item.kind === 'order') {
    const ids = deck.events.map(e => e.id), n = ids.length;
    let best: string[] | null = null, bestShared = 9;
    for (let a = 0; a < n; a++) for (let b = a + 2; b < n; b++) for (let c = b + 2; c < n; c++) {
      const cs = [ids[a], ids[b], ids[c]], shared = cs.filter(x => item.cards.includes(x)).length;
      if (shared <= 1 && shared < bestShared) { best = cs; bestShared = shared; }
    }
    if (!best) return null;
    return { id, kind: 'order', cards: [best[1], best[2], best[0]] };
  }
  const onItem = new Set([...item.causes, ...item.effects]);
  const free = linksOf(deck).filter(([c, e]) => !onItem.has(c) && !onItem.has(e)).slice(0, 2);
  if (free.length < 2) return null;
  return { id, kind: 'cause_effect', causes: free.map(([c]) => c), effects: [free[1][1], free[0][1]] };
}

// ── Levers on the current item ───────────────────────────────────────────────────────────

const lever = (id: string, kind: WorkspaceLever['kind'], pulled: readonly string[], answers: readonly TimelineMiss[], when: string, does: string): WorkspaceLever =>
  ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
const PRACTICE_NOTE = 'It is not graded; this item comes back after it.';

/** The levers on the current session item. A practice item has none. */
export function timelineLevers(deck: Deck, item: TimelineItem | undefined, pulled: readonly string[], session: readonly TimelineItem[] = []): WorkspaceLever[] {
  if (!item || isPractice(item)) return [];
  const out: WorkspaceLever[] = [];
  const simpler = simplerItem(deck, item, session);
  if (item.kind === 'identify') {
    if (!clueLeaks(deck, item.eventId)) {
      out.push(lever(SHOW_TIMELINE_LEVER, 'help', pulled, KIND_MISSES.identify, 'The learner does not remember the events, or mixes up two of them.',
        'Brings back the timeline strip: every event title in time order with its date. It does not mark which event the clue describes.'));
    }
    if (simpler) out.push(lever(TWO_CHOICES_LEVER, 'simplify', pulled, KIND_MISSES.identify, 'The learner cannot pick among the choices.',
      `Opens another event's clue with only two choices, far apart in time. ${PRACTICE_NOTE}`));
    return out;
  }
  if (item.kind === 'date') {
    out.push(lever(BEFORE_AFTER_LEVER, 'help', pulled, KIND_MISSES.date, 'The learner does not know where this event falls in time.',
      'Shows a card naming the events just before and just after this one on the timeline, by title only, with no dates.'));
    out.push(lever(DATE_LINE_LEVER, 'help', pulled, ['distant_date'], 'The learner guesses a date far from the right time.',
      'Lays the date choices out in time order on a line. It does not say which date belongs to this event.'));
    if (simpler) out.push(lever(TWO_DATES_LEVER, 'simplify', pulled, KIND_MISSES.date, 'The learner cannot pick among the dates.',
      `Opens another event with only two dates, far apart in time. ${PRACTICE_NOTE}`));
    return out;
  }
  if (item.kind === 'order') {
    if (Object.keys(cardLines(deck, item)).length) {
      out.push(lever(READ_CARDS_LEVER, 'help', pulled, KIND_MISSES.order, 'The learner does not remember what the events were.',
        'Writes under each card what the learner read about that event, with every date taken out.'));
    }
    if (ledToArrows(deck, item).length) {
      out.push(lever(LED_TO_LEVER, 'help', pulled, ['adjacent_swap', 'two_swapped', 'one_moved', 'mixed_order', 'reversed'],
        'The learner does not use what caused what to put events in order.',
        'Draws a "led to" arrow between cards where one event led to the other. It does not order the other cards.'));
    }
    if (simpler) out.push(lever(FEWER_CARDS_LEVER, 'simplify', pulled, KIND_MISSES.order, 'The learner cannot order this many cards.',
      `Opens three other events, spread out in time, to put in order. ${PRACTICE_NOTE}`));
    return out;
  }
  if (Object.keys(cardLines(deck, item)).length) {
    out.push(lever(READ_CARDS_LEVER, 'help', pulled, KIND_MISSES.cause_effect, 'The learner does not remember what the events were.',
      'Writes under each card what the learner read about that event, with every date taken out; a card that would name its partner gets no line.'));
  }
  if (datesLeaveDoubt(deck, item)) {
    out.push(lever(SHOW_DATES_LEVER, 'help', pulled, ['used_extra', 'effect_before_cause'], 'The learner matches an effect that happened before its cause.',
      "Writes each card's date beside it. The dates alone do not decide the pairs."));
  }
  if (simpler) out.push(lever(TWO_LINKS_LEVER, 'simplify', pulled, KIND_MISSES.cause_effect, 'The learner cannot match this many pairs.',
    `Opens two other causes and their effects to match. ${PRACTICE_NOTE}`));
  return out;
}

/** What the pulled levers put on screen, as a scene fact. Never the key. */
export function leverFact(deck: Deck, item: TimelineItem | undefined, pulled: readonly string[]): string {
  if (!item || isPractice(item)) return '';
  const parts: string[] = [];
  if (item.kind === 'identify' && pulled.includes(SHOW_TIMELINE_LEVER)) {
    parts.push(`The timeline strip is on screen: ${deck.events.map(e => `${e.title} (${e.date})`).join(', then ')}. Nothing marks the clue's event.`);
  }
  if (item.kind === 'date') {
    if (pulled.includes(BEFORE_AFTER_LEVER)) parts.push(`A card: ${beforeAfterLines(deck, item).join(' ')}`);
    if (pulled.includes(DATE_LINE_LEVER)) parts.push(`The date choices on a line in time order: ${dateLine(deck, item).join(', ')}.`);
  }
  if ((item.kind === 'order' || item.kind === 'cause_effect') && pulled.includes(READ_CARDS_LEVER)) {
    parts.push('Under each card, what the learner read about it, with the dates taken out.');
  }
  if (item.kind === 'order' && pulled.includes(LED_TO_LEVER)) {
    parts.push(`"Led to" arrows: ${ledToArrows(deck, item).map(([a, b]) => `${titleOf(deck, a)} led to ${titleOf(deck, b)}`).join('; ')}.`);
  }
  if (item.kind === 'cause_effect' && pulled.includes(SHOW_DATES_LEVER)) {
    parts.push(`Each card shows its date: ${[...item.causes, ...item.effects].map(id => `${titleOf(deck, id)} (${dateOf(deck, id)})`).join(', ')}.`);
  }
  return parts.join(' ');
}

/** For tests: every miss this item's work can show. */
export function possibleMisses(deck: Deck, item: TimelineItem, miss: (w: { choice: string | null; order: string[]; pairs: Record<string, string> }) => TimelineMiss | undefined): TimelineMiss[] {
  const out = new Set<TimelineMiss>();
  if (item.kind === 'identify' || item.kind === 'date') {
    for (const id of item.options) { const m = miss({ choice: id, order: [], pairs: {} }); if (m) out.add(m); }
  } else if (item.kind === 'order') {
    const perms = (xs: string[]): string[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [x, ...p])));
    for (const p of perms(orderKey(deck, item))) { const m = miss({ choice: null, order: p, pairs: {} }); if (m) out.add(m); }
  } else {
    const perms = (xs: string[], k: number): string[][] => (k === 0 ? [[]] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)], k - 1).map(p => [x, ...p])));
    for (const p of perms(item.effects, item.causes.length)) {
      const m = miss({ choice: null, order: [], pairs: Object.fromEntries(item.causes.map((c, i) => [c, p[i]])) }); if (m) out.add(m);
    }
  }
  return Array.from(out);
}

export { deckOf };
