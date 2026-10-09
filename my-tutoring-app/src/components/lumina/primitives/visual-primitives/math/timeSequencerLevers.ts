/**
 * time-sequencer's in-item levers (/add-support-tiers; report qa/eval-reports/time-sequencer-levers-2026-10-09.md).
 * The misses are what `timeSequencerMiss` observes; there is no real-learner evidence.
 *
 * Ordering (sequence-3, sequence-5, clock-sequence). The order of the cards is the answer, so no lever places,
 * numbers or ranks a card.
 * - `sky_strip` (help, sequence modes): the sun-position strip on every card (the easy tier's picture anchor, now
 *   pullable). Each card shows its own time of day; the cards stay where they are. Not on clock-sequence, where
 *   reading the face is the task and a sky picture would let the learner skip it.
 * - `face_numbers` (help, clock-sequence): every face drawn larger with all twelve numbers round it.
 * - `far_apart_cards` (simplify): the same number of cards, spread far apart across the day (a few hours apart, not
 *   minutes), built from a bank that shares no word with the learner's cards. Ungraded.
 *
 * time-of-day. The time of day is the answer, so nothing is drawn on the item's own card (a sky strip there draws
 * the period's own picture).
 * - `day_anchors` (help): beside each choice, a picture of one other familiar activity at that time of day. The
 *   anchors never share a word with the item's activity.
 * - `two_choices` (simplify): another activity with only two choices, its own time and the opposite one.
 *
 * before-after. The picked card is the answer.
 * - `relation_model` (help): a model day of three OTHER cards in order, the first marked "before" and the last
 *   "after" the middle one. Never the reference card or an option.
 * - `two_cards` (simplify): another reference card with two options, one on the asked side and one far on the
 *   other side of the day.
 *
 * duration-compare. Which takes longer (or about the same) is the answer.
 * - `duration_model` (help): two OTHER pairs drawn as bars, one long against short and one about the same.
 * - `far_pair` (simplify): another pair, very short against very long.
 *
 * read-schedule (Grade 1-2). The activity at the asked time is the answer; the asked row is already highlighted.
 * - `option_pictures` (help): each answer choice shows its own row's picture from the schedule.
 * - `short_schedule` (simplify): a three-row schedule of whole hours, other activities, another asked time.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { EventCard, ScheduleEntry, TimeSequencerChallenge } from './TimeSequencer';
import { PERIODS, type Period, type TimeSequencerMiss } from './timeSequencerWorkspace';

export const SKY_STRIP_LEVER = 'sky_strip';
export const FACE_NUMBERS_LEVER = 'face_numbers';
export const FAR_APART_LEVER = 'far_apart_cards';
export const DAY_ANCHORS_LEVER = 'day_anchors';
export const TWO_CHOICES_LEVER = 'two_choices';
export const RELATION_MODEL_LEVER = 'relation_model';
export const TWO_CARDS_LEVER = 'two_cards';
export const DURATION_MODEL_LEVER = 'duration_model';
export const FAR_PAIR_LEVER = 'far_pair';
export const OPTION_PICTURES_LEVER = 'option_pictures';
export const SHORT_SCHEDULE_LEVER = 'short_schedule';

export const PRACTICE_SUFFIX = '~smaller';
export const PRACTICE_NOTE = 'An easier practice item, ungraded; the full item comes back after it.';
export const isPractice = (c: Pick<TimeSequencerChallenge, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);
export const practiceParent = (id: string | null | undefined, challenges: readonly TimeSequencerChallenge[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

// ── Word families: the leak rule for every bank card ───────────────────────────
// Two labels clash when they share a content word, after synonyms are folded into one family. A bank card that
// clashes with any label in the learner's item is never shown (as a model or in a practice item).

const STOP = new Set(['the', 'a', 'an', 'your', 'you', 'to', 'at', 'in', 'of', 'on', 'and', 'go', 'goes', 'eat', 'have',
  'put', 'get', 'my', 'with', 'take', 'for', 'up', 'it', 'is', 'do', 'one', 'all', 'some', 'time', 'out', 'yummy', 'fun',
  'big', 'little', 'whole', 'our', 'we', 'from', 'off', 'into']);
const FAMILY: Record<string, string> = {
  wake: 'wake', woke: 'wake', waking: 'wake', alarm: 'wake',
  breakfast: 'breakfast', cereal: 'breakfast', pancakes: 'breakfast',
  lunch: 'lunch', lunches: 'lunch', picnic: 'lunch', sandwich: 'lunch',
  dinner: 'dinner', supper: 'dinner', table: 'dinner',
  snack: 'snack', cookie: 'snack', apple: 'snack', banana: 'snack', fruit: 'snack', bite: 'snack',
  drink: 'drink', water: 'drink', sip: 'drink', juice: 'drink', milk: 'drink', cup: 'drink',
  sleep: 'sleep', asleep: 'sleep', bed: 'sleep', bedtime: 'sleep', dream: 'sleep', nap: 'sleep', pajamas: 'sleep',
  cozy: 'sleep', light: 'light', lamp: 'light', store: 'shop', shopping: 'shop', plants: 'garden', garden: 'garden',
  bath: 'bath', shower: 'bath', wash: 'bath', hands: 'bath',
  teeth: 'teeth', brush: 'teeth', toothbrush: 'teeth',
  school: 'school', class: 'school', bus: 'school', backpack: 'school', bag: 'school', teacher: 'school',
  park: 'play', play: 'play', playing: 'play', playground: 'play', outside: 'play', games: 'play', swing: 'play',
  recess: 'play', bike: 'play', ball: 'play',
  read: 'story', reading: 'story', book: 'story', books: 'story', story: 'story', stories: 'story',
  dressed: 'dress', clothes: 'dress', shoes: 'dress', shoe: 'dress', socks: 'dress', coat: 'dress',
  movie: 'movie', tv: 'movie', show: 'movie', cartoon: 'movie',
  blink: 'blink', eyes: 'blink', clap: 'clap', clapping: 'clap',
  art: 'art', paint: 'art', painting: 'art', draw: 'art', drawing: 'art', pictures: 'art',
  music: 'music', sing: 'music', song: 'music',
};
const wordsOf = (label: string) => label.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
  .filter(w => w.length > 1 && !STOP.has(w)).map(w => FAMILY[w] ?? w);

/** Leak rule: a bank card shares no content word (or word family) with any label in the learner's item. */
export function clashes(label: string, itemLabels: readonly string[]): boolean {
  const mine = new Set(wordsOf(label));
  return itemLabels.some(other => wordsOf(other).some(w => mine.has(w)));
}

/** Every activity named on the learner's item, cards and choices together. */
export function itemLabels(c: TimeSequencerChallenge): string[] {
  return [
    ...(c.events ?? []).map(e => e.label), c.event?.label, c.referenceEvent?.label, ...(c.options ?? []).map(e => e.label),
    c.eventA?.label, c.eventB?.label, ...(c.schedule ?? []).map(r => r.activity), ...(c.activityOptions ?? []),
  ].filter((s): s is string => !!s);
}

/** The first alternative that does not clash with the item, or null. */
const pick = <T extends { label: string }>(alts: readonly T[], avoid: readonly string[]) =>
  alts.find(a => !clashes(a.label, avoid)) ?? null;

// ── Banks ──────────────────────────────────────────────────────────────────────

type BankCard = { label: string; emoji: string };
type DayCard = BankCard & { hour24: number };

/** Five slots across the day, a few hours apart, each with alternatives. Morning, midday, afternoon, evening, night. */
const DAY_SLOTS: readonly (readonly DayCard[])[] = [
  [{ label: 'Wake up', emoji: '🌅', hour24: 7 }, { label: 'Get dressed', emoji: '👕', hour24: 7.5 }, { label: 'Open the curtains', emoji: '🪟', hour24: 7 },
    { label: 'Feed the cat', emoji: '🐈', hour24: 7.5 }],
  [{ label: 'Eat lunch', emoji: '🥪', hour24: 12 }, { label: 'Have a picnic', emoji: '🧺', hour24: 12 },
    { label: 'Go to the store', emoji: '🛒', hour24: 12 }],
  [{ label: 'Play at the park', emoji: '🛝', hour24: 15 }, { label: 'Ride a bike', emoji: '🚲', hour24: 15 }, { label: 'Paint a picture', emoji: '🎨', hour24: 15 }],
  [{ label: 'Eat dinner', emoji: '🍝', hour24: 18 }, { label: 'Set the table', emoji: '🍽️', hour24: 18 },
    { label: 'Water the plants', emoji: '🪴', hour24: 18 }],
  [{ label: 'Go to sleep', emoji: '😴', hour24: 20.5 }, { label: 'Put on pajamas', emoji: '👚', hour24: 20 },
    { label: 'Turn off the light', emoji: '💡', hour24: 20.5 }, { label: 'Look at the moon', emoji: '🌙', hour24: 21 }],
];

/** clock-sequence: whole hours inside one half of the day (the afternoon and evening), two hours apart. */
const CLOCK_SLOTS: readonly (readonly DayCard[])[] = [
  [{ label: 'Eat lunch', emoji: '🥪', hour24: 13 }, { label: 'Have a picnic', emoji: '🧺', hour24: 13 },
    { label: 'Go to the store', emoji: '🛒', hour24: 13 }],
  [{ label: 'Play at the park', emoji: '🛝', hour24: 15 }, { label: 'Ride a bike', emoji: '🚲', hour24: 15 },
    { label: 'Water the plants', emoji: '🪴', hour24: 15 }],
  [{ label: 'Eat dinner', emoji: '🍝', hour24: 17 }, { label: 'Paint a picture', emoji: '🎨', hour24: 17 }],
  [{ label: 'Take a bath', emoji: '🛁', hour24: 19 }, { label: 'Read a story', emoji: '📖', hour24: 19 }],
  [{ label: 'Go to sleep', emoji: '😴', hour24: 21 }, { label: 'Put on pajamas', emoji: '👚', hour24: 21 },
    { label: 'Turn off the light', emoji: '💡', hour24: 21 }, { label: 'Look at the moon', emoji: '🌙', hour24: 21 }],
];

/** Which slots n cards take: spread as far apart as the bank allows. */
const SLOTS_FOR: Record<number, readonly number[]> = { 2: [0, 4], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] };

const PERIOD_BANK: Record<Period, readonly BankCard[]> = {
  morning: [{ label: 'Wake up', emoji: '🌅' }, { label: 'Eat breakfast', emoji: '🥣' }, { label: 'Get dressed', emoji: '👕' }],
  afternoon: [{ label: 'Eat lunch', emoji: '🥪' }, { label: 'Play at the park', emoji: '🛝' }, { label: 'Ride a bike', emoji: '🚲' }],
  evening: [{ label: 'Eat dinner', emoji: '🍝' }, { label: 'Set the table', emoji: '🍽️' }, { label: 'Take a bath', emoji: '🛁' }],
  night: [{ label: 'Go to sleep', emoji: '😴' }, { label: 'Put on pajamas', emoji: '👚' }, { label: 'Look at the moon', emoji: '🌙' },
    { label: 'Turn off the light', emoji: '💡' }],
};

/** duration-compare pairs: [short, long], very far apart; and pairs that take about the same time. */
const FAR_PAIRS: readonly (readonly [BankCard, BankCard])[] = [
  [{ label: 'Blink your eyes', emoji: '👀' }, { label: 'Sleep all night', emoji: '😴' }],
  [{ label: 'Clap your hands once', emoji: '👏' }, { label: 'A whole day at school', emoji: '🏫' }],
  [{ label: 'Take one bite', emoji: '😋' }, { label: 'Watch a whole movie', emoji: '🎬' }],
  [{ label: 'Say hi', emoji: '👋' }, { label: 'Ride a long car trip', emoji: '🚗' }],
];
const SAME_PAIRS: readonly (readonly [BankCard, BankCard])[] = [
  [{ label: 'Put on your left sock', emoji: '🧦' }, { label: 'Put on your right sock', emoji: '🧦' }],
  [{ label: 'Clap two times', emoji: '👏' }, { label: 'Stomp two times', emoji: '🦶' }],
  [{ label: 'Say your name', emoji: '🗣️' }, { label: 'Wave hello', emoji: '👋' }],
];

/** read-schedule: whole hours, two hours apart; none at a half hour. */
const SCHEDULE_SLOTS: readonly (readonly (ScheduleEntry & { label: string })[])[] = [
  [{ time: '9:00 AM', activity: 'Morning circle', label: 'Morning circle', emoji: '⭕' },
    { time: '9:00 AM', activity: 'Feed the fish', label: 'Feed the fish', emoji: '🐟' }],
  [{ time: '11:00 AM', activity: 'Music class', label: 'Music class', emoji: '🎵' },
    { time: '11:00 AM', activity: 'Build with blocks', label: 'Build with blocks', emoji: '🧱' }],
  [{ time: '1:00 PM', activity: 'Art class', label: 'Art class', emoji: '🎨' },
    { time: '1:00 PM', activity: 'Plant seeds', label: 'Plant seeds', emoji: '🌱' }],
];
const SCHEDULE_TIMES_ALT = ['10:00 AM', '12:00 PM', '2:00 PM'];

/** A small stable number from an id, so a practice item is the same every time it is built for one item. */
const seed = (id: string) => Array.from(id).reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7);

const timeText = (hour24: number) => {
  const h = Math.floor(hour24), m = Math.round((hour24 - h) * 60), h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const asEvent = (card: DayCard, i: number, clock: boolean): EventCard => ({
  id: `p${i + 1}`, label: card.label, emoji: card.emoji, typicalTime: timeText(card.hour24),
  dayFraction: Math.round((card.hour24 / 24) * 1000) / 1000, ...(clock ? { clockHour: card.hour24 % 12 } : {}),
});

const practiceBase = (c: TimeSequencerChallenge, fields: Partial<TimeSequencerChallenge>): TimeSequencerChallenge => ({
  id: `${c.id}${PRACTICE_SUFFIX}`, type: c.type, instruction: c.instruction, showSkyCue: c.showSkyCue,
  showTimeAnchors: c.showTimeAnchors, showClockFace: c.showClockFace, ...fields,
});

// ── Ordering ───────────────────────────────────────────────────────────────────

const isOrdering = (c: TimeSequencerChallenge) => c.type === 'sequence-events' || c.type === 'clock-sequence';

/** The same number of cards, far apart across the day (or the afternoon, on clock-sequence). Null when the bank
 *  cannot avoid the item's words, or the item has more than five cards. */
export function farApartCards(c: TimeSequencerChallenge): TimeSequencerChallenge | null {
  if (!isOrdering(c) || isPractice(c)) return null;
  const n = c.events?.length ?? 0, slots = SLOTS_FOR[n];
  if (!slots) return null;
  const clock = c.type === 'clock-sequence', bank = clock ? CLOCK_SLOTS : DAY_SLOTS, avoid = itemLabels(c);
  const cards = slots.map(s => pick(bank[s], avoid));
  if (cards.some(x => !x)) return null;
  const events = (cards as DayCard[]).map((card, i) => asEvent(card, i, clock));
  return practiceBase(c, {
    instruction: clock ? 'Look at the clocks and put these cards in order.' : 'Put these cards in the order they happen in the day.',
    events, correctOrder: events.map(e => e.id),
  });
}

// ── time-of-day ────────────────────────────────────────────────────────────────

/** One anchor activity per time of day, none sharing a word with the item's activity. Null if a period has none. */
export function dayAnchors(c: TimeSequencerChallenge): Record<Period, BankCard> | null {
  if (c.type !== 'match-time-of-day') return null;
  const avoid = itemLabels(c), out = {} as Record<Period, BankCard>;
  for (const p of PERIODS) {
    const a = pick(PERIOD_BANK[p], avoid);
    if (!a) return null;
    out[p] = a;
  }
  return out;
}

const opposite = (p: Period) => PERIODS[(PERIODS.indexOf(p) + 2) % 4];

/** Another activity, two choices: its own time of day and the opposite one. Never the item's time of day. */
export function twoChoices(c: TimeSequencerChallenge): TimeSequencerChallenge | null {
  if (c.type !== 'match-time-of-day' || isPractice(c)) return null;
  const avoid = itemLabels(c);
  for (const p of ['morning', 'night', 'afternoon', 'evening'] as Period[]) {
    if (p === c.correctPeriod) continue;
    const a = pick(PERIOD_BANK[p], avoid);
    if (!a) continue;
    const choices: Period[] = seed(c.id) % 2 ? [p, opposite(p)] : [opposite(p), p];
    return practiceBase(c, {
      instruction: `When do you ${a.label.charAt(0).toLowerCase()}${a.label.slice(1)}?`,
      event: { id: 'p1', label: a.label, emoji: a.emoji }, correctPeriod: p,
      periodChoices: choices.sort((x, y) => PERIODS.indexOf(x) - PERIODS.indexOf(y)),
    });
  }
  return null;
}

// ── before-after ───────────────────────────────────────────────────────────────

/** Three other cards in day order (morning, afternoon, night), for the before/after model. */
export function relationModel(c: TimeSequencerChallenge): BankCard[] | null {
  if (c.type !== 'before-after') return null;
  const avoid = itemLabels(c);
  const cards = [0, 2, 4].map(s => pick(DAY_SLOTS[s], avoid));
  return cards.some(x => !x) ? null : cards as BankCard[];
}

/** Another reference (the afternoon) with two options: one on the asked side, one far on the other side. */
export function twoCards(c: TimeSequencerChallenge): TimeSequencerChallenge | null {
  if (c.type !== 'before-after' || isPractice(c) || !c.relation) return null;
  const avoid = itemLabels(c);
  const ref = pick(DAY_SLOTS[2], avoid);
  const right = pick(DAY_SLOTS[c.relation === 'after' ? 3 : 1], avoid);
  const foil = pick(DAY_SLOTS[c.relation === 'after' ? 0 : 4], avoid);
  if (!ref || !right || !foil) return null;
  const opts: EventCard[] = [{ id: 'p1', label: right.label, emoji: right.emoji }, { id: 'p2', label: foil.label, emoji: foil.emoji }];
  if (seed(c.id) % 2) opts.reverse();
  return practiceBase(c, {
    instruction: `What happens ${c.relation} this one?`,
    referenceEvent: asEvent(ref, 9, false), relation: c.relation, options: opts, correctEvent: 'p1',
  });
}

// ── duration-compare ───────────────────────────────────────────────────────────

/** Two other pairs for the bar model: one short against long, one about the same. */
export function durationModel(c: TimeSequencerChallenge): { far: readonly [BankCard, BankCard]; same: readonly [BankCard, BankCard] } | null {
  if (c.type !== 'duration-compare') return null;
  const avoid = itemLabels(c);
  const ok = (p: readonly [BankCard, BankCard]) => !clashes(p[0].label, avoid) && !clashes(p[1].label, avoid);
  const far = FAR_PAIRS.find(ok), same = SAME_PAIRS.find(ok);
  return far && same ? { far, same } : null;
}

/** Another pair, very short against very long (never the model's pair). Which side is long is fixed per item. */
export function farPair(c: TimeSequencerChallenge): TimeSequencerChallenge | null {
  if (c.type !== 'duration-compare' || isPractice(c)) return null;
  const avoid = itemLabels(c), model = durationModel(c)?.far;
  const pair = FAR_PAIRS.find(p => p !== model && !clashes(p[0].label, avoid) && !clashes(p[1].label, avoid));
  if (!pair) return null;
  const longFirst = seed(c.id) % 2 === 1;
  const [a, b] = longFirst ? [pair[1], pair[0]] : [pair[0], pair[1]];
  return practiceBase(c, {
    instruction: 'Which one takes longer?',
    eventA: { id: 'pA', label: a.label, emoji: a.emoji }, eventB: { id: 'pB', label: b.label, emoji: b.emoji },
    correctAnswer: longFirst ? 'A' : 'B',
  });
}

// ── read-schedule ──────────────────────────────────────────────────────────────

/** Each answer choice's picture: its own row's, or none when the choice is not on the schedule. */
export function optionPictures(c: TimeSequencerChallenge): Record<string, string> {
  const out: Record<string, string> = {};
  for (const o of c.activityOptions ?? (c.schedule ?? []).map(r => r.activity)) {
    const row = (c.schedule ?? []).find(r => r.activity === o);
    if (row?.emoji) out[o] = row.emoji;
  }
  return out;
}

/** Three rows of whole hours, other activities, an asked time that is not the item's. */
export function shortSchedule(c: TimeSequencerChallenge): TimeSequencerChallenge | null {
  if (c.type !== 'read-schedule' || isPractice(c)) return null;
  const avoid = itemLabels(c);
  const rows = SCHEDULE_SLOTS.map(s => pick(s, avoid));
  if (rows.some(r => !r)) return null;
  const parentTimes = new Set([...(c.schedule ?? []).map(r => r.time), c.targetTime ?? '']);
  // Times the item does not use, so the asked time is never the item's.
  const times = rows.map((r, i) => [r!.time, SCHEDULE_TIMES_ALT[i]].find(t => !parentTimes.has(t)));
  if (times.some(t => !t)) return null;
  const schedule: ScheduleEntry[] = rows.map((r, i) => ({ time: times[i]!, activity: r!.activity, emoji: r!.emoji }));
  const at = seed(c.id) % 3, target = schedule[at];
  const rot = (seed(c.id) >> 2) % 3;
  return practiceBase(c, {
    instruction: `What happens at ${target.time}?`, schedule, targetTime: target.time, correctActivity: target.activity,
    activityOptions: [...schedule.slice(rot), ...schedule.slice(0, rot)].map(r => r.activity),
  });
}

// ── Every mode ─────────────────────────────────────────────────────────────────

export function practiceItem(c: TimeSequencerChallenge): TimeSequencerChallenge | null {
  switch (c.type) {
    case 'sequence-events': case 'clock-sequence': return farApartCards(c);
    case 'match-time-of-day': return twoChoices(c);
    case 'before-after': return twoCards(c);
    case 'duration-compare': return farPair(c);
    case 'read-schedule': return shortSchedule(c);
  }
  return null;
}

/** Leak rule for a practice item: a new id, and no activity sharing a word with the learner's item. */
export function practiceLeaks(parent: TimeSequencerChallenge, simpler: TimeSequencerChallenge): boolean {
  const avoid = itemLabels(parent);
  return simpler.id === parent.id || simpler.type !== parent.type || itemLabels(simpler).some(l => clashes(l, avoid))
    || (parent.type === 'match-time-of-day' && simpler.correctPeriod === parent.correctPeriod)
    || (parent.type === 'read-schedule' && simpler.targetTime === parent.targetTime);
}

/** The sky strip needs every card's time of day; clock-sequence never gets it (the face is the task). */
const skyOffered = (c: TimeSequencerChallenge) =>
  c.type === 'sequence-events' && (c.events?.length ?? 0) > 1 && (c.events ?? []).every(e => typeof e.dayFraction === 'number');
const facesOffered = (c: TimeSequencerChallenge) =>
  c.type === 'clock-sequence' && (c.events ?? []).every(e => typeof e.clockHour === 'number');

const ORDER_MISSES: TimeSequencerMiss[] = ['reversed', 'swapped_pair', 'wrong_first', 'out_of_order'];

/** The levers on a session item. A tier aid already on screen (the sky strip) counts as pulled. */
export function timeSequencerLevers(c: TimeSequencerChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!c || isPractice(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly TimeSequencerMiss[], when: string, does: string,
    on = false): WorkspaceLever => ({ id, kind, carrier: 'shown', pulled: on || pulled.includes(id), answers, when, does });
  const simpler = !!practiceItem(c);
  switch (c.type) {
    case 'sequence-events':
    case 'clock-sequence': return [
      ...(skyOffered(c) ? [lever(SKY_STRIP_LEVER, 'help', ORDER_MISSES,
        'The learner puts the day in the wrong order: backwards, two cards traded, or the wrong card first.',
        'Puts a sky strip on every card: the sun or moon drawn where it is at that card\'s time of day. The cards stay '
          + 'where they are; none is placed or numbered.', !!c.showSkyCue)] : []),
      ...(facesOffered(c) ? [lever(FACE_NUMBERS_LEVER, 'help', ORDER_MISSES,
        'The learner puts the clock cards in the wrong order, or cannot read where the short hand points.',
        'Draws every clock face larger, with all twelve numbers round it. No card is placed or named.')] : []),
      ...(simpler ? [lever(FAR_APART_LEVER, 'simplify', ORDER_MISSES,
        'The learner cannot order cards this close together in the day yet.',
        'Opens an easier practice first: the same number of other cards, a few hours apart in the day. It is not '
          + 'graded; the full item comes back after it, with no card placed.')] : []),
    ];
    case 'match-time-of-day': return [
      ...(dayAnchors(c) ? [lever(DAY_ANCHORS_LEVER, 'help', ['next_period', 'far_period'],
        'The learner picks the wrong time of day.',
        'Puts a picture of one other everyday activity beside each time-of-day choice (another thing people do in '
          + 'that part of the day). The activity on the card is not among them.')] : []),
      ...(simpler ? [lever(TWO_CHOICES_LEVER, 'simplify', ['next_period', 'far_period'],
        'The learner cannot tell neighbouring times of day apart yet.',
        'Opens an easier practice first: another activity with only two time-of-day choices, far apart. It is not '
          + 'graded; the full item comes back after it.')] : []),
    ];
    case 'before-after': return [
      ...(relationModel(c) ? [lever(RELATION_MODEL_LEVER, 'help', ['other_event'],
        'The learner picks a card that does not come right before or after, or mixes up before and after.',
        'Shows a model day of three other cards in order above the choices, the first marked "before" and the last '
          + 'marked "after" the middle one. None of them is on the item.')] : []),
      ...(simpler ? [lever(TWO_CARDS_LEVER, 'simplify', ['other_event'],
        'The learner cannot pick between cards this close in the day yet.',
        'Opens an easier practice first: another card with only two choices, far apart in the day. It is not '
          + 'graded; the full item comes back after it.')] : []),
    ];
    case 'duration-compare': return [
      ...(durationModel(c) ? [lever(DURATION_MODEL_LEVER, 'help', ['said_same', 'missed_same', 'shorter_one'],
        'The learner picks the shorter activity, or mixes up "about the same" with "longer".',
        'Shows two other pairs above the cards, each activity with a bar as long as it takes: one very short '
          + 'against very long, one pair with bars the same length. The item\'s cards get no bar.')] : []),
      ...(simpler ? [lever(FAR_PAIR_LEVER, 'simplify', ['said_same', 'shorter_one'],
        'The learner cannot compare two activities this close in length yet.',
        'Opens an easier practice first: another pair, one very short and one very long. It is not graded; the '
          + 'full item comes back after it.')] : []),
    ];
    case 'read-schedule': return [
      ...(Object.keys(optionPictures(c)).length > 1 ? [lever(OPTION_PICTURES_LEVER, 'help', ['next_row', 'other_row', 'not_on_schedule'],
        'The learner reads across the wrong row, or picks an activity that is not on the schedule.',
        'Puts beside each answer choice the picture its row has in the schedule (none for a choice that is not '
          + 'on the schedule).')] : []),
      ...(simpler ? [lever(SHORT_SCHEDULE_LEVER, 'simplify', ['next_row', 'other_row', 'not_on_schedule'],
        'The learner cannot find the time in a schedule this long yet.',
        'Opens an easier practice first: a schedule of three rows on whole hours, other activities and another '
          + 'time. It is not graded; the full item comes back after it.')] : []),
    ];
  }
  return [];
}

/** What the pulled help levers put on screen, for the tutor. Never the order, the period, the pick or the row. */
export function leverFacts(c: TimeSequencerChallenge | null, pulled: readonly string[]): string {
  if (!c) return '';
  const on = (id: string) => pulled.includes(id);
  const parts: string[] = [];
  if (on(SKY_STRIP_LEVER) && !c.showSkyCue) parts.push('Every card now has a sky strip with the sun or moon drawn at that card\'s time of day.');
  if (on(FACE_NUMBERS_LEVER)) parts.push('Every clock face is drawn larger with all twelve numbers round it.');
  if (on(DAY_ANCHORS_LEVER)) {
    const a = dayAnchors(c);
    if (a) parts.push(`Beside each time-of-day choice is a picture of another everyday activity in that part of the day: ${PERIODS.map(p => a[p].label).join('; ')} (in the order of the choices).`);
  }
  if (on(RELATION_MODEL_LEVER)) {
    const m = relationModel(c);
    if (m) parts.push(`Above the choices is a model day of three other cards in order: ${m[0].label}, then ${m[1].label}, then ${m[2].label}; ${m[0].label} is marked "before" and ${m[2].label} "after" ${m[1].label}.`);
  }
  if (on(DURATION_MODEL_LEVER)) {
    const m = durationModel(c);
    if (m) parts.push(`Above the cards are two other pairs with bars as long as each takes: ${m.far[0].label} (a short bar) and ${m.far[1].label} (a long bar); ${m.same[0].label} and ${m.same[1].label} (bars the same length).`);
  }
  if (on(OPTION_PICTURES_LEVER)) parts.push('Each answer choice now shows the picture its row has in the schedule; a choice not on the schedule has none.');
  return parts.join(' ');
}
