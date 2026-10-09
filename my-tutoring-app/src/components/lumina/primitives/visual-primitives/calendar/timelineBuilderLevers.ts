/**
 * timeline-builder's in-item levers (/add-support-tiers; report qa/eval-reports/timeline-builder-levers-2026-10-09.md).
 * No real-learner evidence: the misses are what `timelineMiss` observes; the catalog's commonStruggles name "places
 * events without reading" and "confuses two events close in time". The order of the events IS the answer, so no lever
 * places, numbers, ranks or names an event: every help lever draws the timeline's own scale, never an event on it.
 *
 * Help (the screen does more; the item is unchanged):
 * - `time_arrow` an arrow along the timeline from the start end (earlier) to the far end (later), a flag on slot 1's
 *   end. Answers `reversed` and `mixed_order` (which way time runs).
 * - `time_ruler` the scale itself drawn under the slots: the parts of a day as pictures (daily), every month from the
 *   start month to the end month (yearly), years at even steps (historical). The learner matches each card to a place
 *   on the ruler. Declared only where the scale ends can be read; never only the cards' own months or years, never a
 *   mark that is an event's name (`rulerLeaks`).
 *
 * Simplify (`fewer_events`): an ungraded practice timeline of the same kind with fewer events, far apart in time,
 * built by code from a fixed pool. Never the learner's events, so it never orders part of the item (`practiceLeaks`).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { TeachingAssignment } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TimelineBuilderChallenge, TimelineEvent } from './TimelineBuilder';
import type { TimelineMiss } from './timelineBuilderWorkspace';

export const ARROW_LEVER = 'time_arrow';
export const RULER_LEVER = 'time_ruler';
export const FEWER_LEVER = 'fewer_events';
export const PRACTICE_SUFFIX = '~simpler';
export const PRACTICE_NOTE = 'An easier practice timeline, ungraded; the full timeline comes back after it.';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export const isPracticeTimeline = (c: Pick<TimelineBuilderChallenge, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);
export const practiceParentId = (id: string | null | undefined) =>
  id?.endsWith(PRACTICE_SUFFIX) ? id.slice(0, -PRACTICE_SUFFIX.length) : null;

// ── time_ruler ─────────────────────────────────────────────────────────────

/** One mark on the ruler: what it says and, for the parts of a day, its picture. */
export interface RulerMark { label: string; icon?: string }

const DAY_PARTS: RulerMark[] = [
  { label: 'morning', icon: '🌅' }, { label: 'middle of the day', icon: '☀️' },
  { label: 'evening', icon: '🌇' }, { label: 'night', icon: '🌙' },
];
const MORNING_END = /morn|wake|sun ?up|sunrise|dawn|early|breakfast|\ba\.?m\b/i;
const NIGHT_END = /night|bed|even|moon|dark|sleep|sunset|star|dinner|late|\bp\.?m\b/i;

const monthOf = (s: string) => MONTHS.findIndex(m => new RegExp(`\\b${m}\\b`, 'i').test(s));
const yearOf = (s: string) => { const m = /\b(\d{3,4})s?\b/.exec(s); return m ? Number(m[1]) : null; };

/** Every month from the start month to the end month, wrapping past December (August → June). */
function monthRuler(c: TimelineBuilderChallenge): RulerMark[] | null {
  const a = monthOf(c.scaleStart), b = monthOf(c.scaleEnd);
  if (a < 0 || b < 0 || a === b) return null;
  const out: RulerMark[] = [];
  for (let i = a; ; i = (i + 1) % 12) { out.push({ label: MONTHS[i] }); if (i === b) break; }
  return out;
}

/** Years at an even step from the start year to the end year, 4 to 7 marks. */
function yearRuler(c: TimelineBuilderChallenge): RulerMark[] | null {
  const a = yearOf(c.scaleStart), b = yearOf(c.scaleEnd);
  if (a === null || b === null || b <= a) return null;
  const step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find(s => (b - a) / s <= 6);
  if (!step) return null;
  const years = [a];
  for (let y = Math.ceil(a / step) * step; y < b; y += step) if (y > a) years.push(y);
  years.push(b);
  return years.length >= 3 ? years.map(y => ({ label: String(y) })) : null;
}

/** The ruler the scale allows, before the leak rule; null where the scale ends cannot be read. */
function rawRuler(c: TimelineBuilderChallenge): RulerMark[] | null {
  if (c.type === 'daily') return MORNING_END.test(c.scaleStart) && NIGHT_END.test(c.scaleEnd) ? DAY_PARTS : null;
  if (c.type === 'yearly') return monthRuler(c);
  return yearRuler(c);
}

/** The months or years the cards themselves state, in the order the ruler would read them. */
function cardStamps(c: TimelineBuilderChallenge, marks: readonly RulerMark[]): string[] {
  const labels = marks.map(m => norm(m.label));
  return c.events.flatMap(e => {
    const text = `${e.label} ${e.description ?? ''}`;
    const hit = labels.find(l => new RegExp(`\\b${l}s?\\b`, 'i').test(text));
    return hit ? [hit] : [];
  });
}

/**
 * Leak rule: the ruler never names an event, and never is just the cards' own months or years (a ruler of exactly
 * the stamped months would read left to right as the order). It is the whole scale, more marks than the cards stamp.
 */
export function rulerLeaks(c: TimelineBuilderChallenge, marks: readonly RulerMark[]): boolean {
  // A mark that IS an event's name would put that event on the ruler. ("morning" beside "Morning Homeroom" is the
  // scale; matching the card to it is the learner's step.)
  const labels = new Set(c.events.map(e => norm(e.label)));
  if (marks.some(m => labels.has(norm(m.label)))) return true;
  const stamped = new Set(cardStamps(c, marks));
  return stamped.size > 0 && marks.every(m => stamped.has(norm(m.label)));
}

/** The ruler to draw under the slots, or null (no readable scale, or it would leak). */
export function timeRuler(c: TimelineBuilderChallenge | null | undefined): RulerMark[] | null {
  if (!c) return null;
  const marks = rawRuler(c);
  return marks && !rulerLeaks(c, marks) ? marks : null;
}

// ── fewer_events (simplify) ────────────────────────────────────────────────

type Seed = { label: string; description: string };
type PoolEntry = { scaleStart: string; scaleEnd: string; events: [Seed, Seed, Seed] };

/** Familiar sequences far apart in time, three events each; the card text matches the generator's kind per mode. */
const POOL: Record<TimelineBuilderChallenge['type'], PoolEntry[]> = {
  daily: [
    { scaleStart: 'Morning', scaleEnd: 'Night', events: [
      { label: 'Wake Up', description: 'Open your eyes and climb out of bed.' },
      { label: 'Eat Lunch', description: 'Have a meal in the middle of the day.' },
      { label: 'Go to Bed', description: 'Turn off the light and fall asleep.' }] },
    { scaleStart: 'Morning', scaleEnd: 'Night', events: [
      { label: 'Eat Breakfast', description: 'A bowl of cereal before the day starts.' },
      { label: 'Afternoon Snack', description: 'An apple after the busy part of the day.' },
      { label: 'Bedtime Story', description: 'Listen to a book while tucked in.' }] },
    { scaleStart: 'Sunrise', scaleEnd: 'Night', events: [
      { label: 'Sun Comes Up', description: 'The sky gets light outside the window.' },
      { label: 'Sun High in the Sky', description: 'Short shadows on the playground.' },
      { label: 'Stars Come Out', description: 'Little lights twinkle in the dark sky.' }] },
    { scaleStart: 'Morning', scaleEnd: 'Bedtime', events: [
      { label: 'Get Dressed', description: 'Put on clothes for the day.' },
      { label: 'Eat Dinner', description: 'Sit down for the last meal of the day.' },
      { label: 'Put On Pajamas', description: 'Get ready to sleep.' }] },
  ],
  yearly: [
    { scaleStart: 'January', scaleEnd: 'December', events: [
      { label: "New Year's Day", description: 'The year starts in January.' },
      { label: 'Fourth of July', description: 'Fireworks in July.' },
      { label: 'Winter Holidays', description: 'Lights and snow in December.' }] },
    { scaleStart: 'January', scaleEnd: 'December', events: [
      { label: "Valentine's Day", description: 'Cards and hearts in February.' },
      { label: 'Summer Vacation', description: 'School is out in June.' },
      { label: 'Halloween', description: 'Costumes and pumpkins in October.' }] },
    { scaleStart: 'January', scaleEnd: 'December', events: [
      { label: 'Build a Snowman', description: 'Cold snowy days in January.' },
      { label: 'Plant a Garden', description: 'Seeds go in the ground in April.' },
      { label: 'Rake the Leaves', description: 'Leaves fall from the trees in November.' }] },
    { scaleStart: 'January', scaleEnd: 'December', events: [
      { label: 'Spring Break', description: 'A week off school in March.' },
      { label: 'Back to School', description: 'New backpacks in September.' },
      { label: 'Last Day of the Year', description: 'Counting down in December.' }] },
  ],
  historical: [
    { scaleStart: '1800', scaleEnd: '2000', events: [
      { label: 'Light Bulb', description: 'Electric light bulbs lit homes starting around 1880.' },
      { label: 'First Airplane Flight', description: 'People first flew in an airplane in 1903.' },
      { label: 'Moon Landing', description: 'Astronauts walked on the Moon in 1969.' }] },
    { scaleStart: '1400', scaleEnd: '2000', events: [
      { label: 'Printing Press', description: 'Books were printed on a press around 1450.' },
      { label: 'Steam Train', description: 'Trains pulled by steam engines ran around 1830.' },
      { label: 'Smartphone', description: 'Phones with touch screens came out around 2007.' }] },
    { scaleStart: '1800', scaleEnd: '2000', events: [
      { label: 'First Photograph', description: 'The first photograph was taken around 1826.' },
      { label: 'Movie Theater', description: 'People watched films in theaters around 1905.' },
      { label: 'Home Video Game', description: 'Families played video games on a TV around 1972.' }] },
    { scaleStart: '1800', scaleEnd: '2020', events: [
      { label: 'Telephone', description: 'People first talked on a telephone in 1876.' },
      { label: 'Television', description: 'Families watched TV at home around 1940.' },
      { label: 'Tablet Computer', description: 'Touch screen tablets came out around 2010.' }] },
  ],
};

/** Every event label in the session: a practice timeline never shows one. */
const sessionLabels = (all: readonly TimelineBuilderChallenge[]) => new Set(all.flatMap(c => c.events.map(e => norm(e.label))));

/**
 * Leak rule for a practice timeline: never the item's id, never another kind, never as many events, and never an
 * event label from any timeline in the session (ordering part of the item would be part of its answer).
 */
export function practiceLeaks(p: TimelineBuilderChallenge, c: TimelineBuilderChallenge,
  all: readonly TimelineBuilderChallenge[]): boolean {
  const used = sessionLabels([c, ...all]);
  return p.id === c.id || p.type !== c.type || p.events.length >= c.events.length || p.events.length < 2
    || p.events.some(e => used.has(norm(e.label)));
}

/**
 * The practice timeline for a full item: the same kind, three events (two when the item has three), from the pool
 * entry the item's id picks, skipping any entry that shares an event with the session. Null on a two-event item and
 * on a practice item.
 */
export function practiceTimeline(c: TimelineBuilderChallenge | null | undefined,
  all: readonly TimelineBuilderChallenge[]): TimelineBuilderChallenge | null {
  if (!c || isPracticeTimeline(c) || c.events.length < 3) return null;
  const pool = POOL[c.type] ?? [];
  let start = 0;
  for (const ch of c.id) start = (start * 31 + ch.charCodeAt(0)) >>> 0;
  const n = c.events.length >= 4 ? 3 : 2;
  for (let k = 0; k < pool.length; k++) {
    const entry = pool[(start + k) % pool.length];
    const seeds = n === 3 ? entry.events : [entry.events[0], entry.events[2]];
    const events: TimelineEvent[] = seeds.map((s, i) => ({ id: `p-${i}`, label: s.label, description: s.description, correctPosition: i }));
    const p: TimelineBuilderChallenge = {
      id: `${c.id}${PRACTICE_SUFFIX}`, type: c.type, title: 'Practice timeline',
      instruction: `Put these ${n} events in order from ${entry.scaleStart} to ${entry.scaleEnd}.`,
      scaleStart: entry.scaleStart, scaleEnd: entry.scaleEnd, events, hint: '', narration: '',
    };
    if (!practiceLeaks(p, c, all)) return p;
  }
  return null;
}

export function practiceAssignment(p: TimelineBuilderChallenge): TeachingAssignment {
  return { id: p.id, task: p.instruction, response: 'gesture' };
}

// ── declarations ───────────────────────────────────────────────────────────

const ALL_MISSES: readonly TimelineMiss[] = ['reversed', 'adjacent_swap', 'two_swapped', 'one_moved', 'mixed_order'];

/** The levers on a full item. A practice timeline carries none. */
export function timelineLevers(c: TimelineBuilderChallenge | null | undefined, all: readonly TimelineBuilderChallenge[],
  pulled: readonly string[]): WorkspaceLever[] {
  if (!c || isPracticeTimeline(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly TimelineMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const ruler = timeRuler(c);
  const unit = c.type === 'daily' ? 'the parts of the day, as pictures' : c.type === 'yearly' ? 'every month of the scale' : 'years at even steps';
  return [
    lever(ARROW_LEVER, 'help', ['reversed', 'mixed_order'],
      'The learner puts the events backwards, or seems not to know which end of the timeline is earlier.',
      'Draws an arrow along the timeline from the earlier end to the later end, with a flag at the start. No event is on it.'),
    ...(ruler ? [lever(RULER_LEVER, 'help', ALL_MISSES,
      'The learner mixes up events that are close in time, or puts one event in the wrong place.',
      `Draws the timeline's scale under the slots: ${unit}, from the start to the end. No event is on it; the learner `
        + 'matches each card to a place on it. Never say which event goes where.')] : []),
    ...(practiceTimeline(c, all) ? [lever(FEWER_LEVER, 'simplify', ALL_MISSES,
      'The learner cannot order this many events yet.',
      'Opens an easier practice timeline of the same kind first, with fewer events far apart in time and none of these '
        + 'events. It is not graded; the full timeline comes back after it, blank.')] : []),
  ];
}

/** What the pulled help levers put on screen, for the tutor. Never an event (the leak test reads every label). */
export function timelineLeverFacts(c: TimelineBuilderChallenge, pulled: readonly string[]): string {
  const ruler = pulled.includes(RULER_LEVER) ? timeRuler(c) : null;
  const kind = c.type === 'daily' ? 'the parts of a day as pictures (morning, middle of the day, evening, night)'
    : c.type === 'yearly' ? 'every month in order' : 'years at even steps';
  return [
    pulled.includes(ARROW_LEVER) && `An arrow runs along the timeline from ${c.scaleStart} (earlier, flagged) on the left `
      + `to ${c.scaleEnd} (later) on the right. No event is on it.`,
    ruler && `Under the slots is the timeline's scale from ${c.scaleStart} to ${c.scaleEnd}: ${kind}. No event is on it.`,
  ].filter((s): s is string => !!s).join(' ');
}
