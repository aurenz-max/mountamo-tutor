/**
 * analog-clock's in-item levers (/add-support-tiers; report qa/eval-reports/analog-clock-levers-2026-10-09.md).
 * No real-learner evidence: the misses are what `clockMiss` observes (journey scripted wrongs) and the catalog's
 * commonStruggles. Pure: the component draws from these, the workspace publishes them, the tests hold each leak rule.
 * Every lever starts released; the generator's tier aids (minute numbers, hand legend, set_time echo) stay the starting
 * positions, and an aid the tier already shows is declared pulled.
 *
 * - `running_model` (help; hand_name, read, match, set_time): a small second clock beside the item, at an hour two or
 *   more away from the item's, runs through one hour: the long hand goes all the way round while the short hand moves
 *   from one number to the next. Which hand tells the hour IS the answer on hand_name, so the help acts on this model
 *   outside the item and labels no hand. Leak rule (`modelLeaks`): the model never passes through the item's hour.
 * - `round_arrow` (help; count_face): a dashed arrow round the face from the 1, the way the count goes. No number is
 *   marked. count_face has no miss (an out-of-order touch restarts the count).
 * - `short_hands` (help; hear_time): every face draws its short hand thick and yellow and its long hand faint. The same
 *   on every face, so no face is singled out.
 * - `hand_legend` (help; read, match, set_time), `minute_numbers` (help; those and elapsed): the tier's reading aids,
 *   on at runtime. Never the legend on hand_name (it is the answer there).
 * - `digital_echo` (help; set_time only): the digital time under the clock as the hands move. The target is given, so
 *   the echo checks the learner's own setting; never on read, match or elapsed, where the time is the answer.
 * - `start_and_sweep` (help; elapsed): faint copies of the hands where they started, and, as the stopwatch runs, the
 *   path the long hand has swept shaded: one ring per full turn. Drawn from the learner's own run; no number.
 * - `simpler_item` (simplify): an ungraded item of the same mode, built here, then the full item back blank.
 *   read / match: a whole hour, two choices far apart. hear_time: two faces, six hours apart. set_time: a whole hour
 *   (none when the item is already on the hour). elapsed: whole hours from a whole-hour start (none when the item is
 *   already whole hours). Leak rule (`practiceLeaks`): never the item's time, duration or right option.
 * - hand_name has no simplify lever: two hands and one touch is already the plainest ask; a simpler one would name the
 *   hand or ask about length instead of what the hand tells.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { ClockChallenge } from './AnalogClock';
import { clockOptions, durationMinutes, elapsedMinutes, type ClockMiss } from './analogClockWorkspace';

export const RUNNING_MODEL_LEVER = 'running_model';
export const ROUND_ARROW_LEVER = 'round_arrow';
export const SHORT_HANDS_LEVER = 'short_hands';
export const HAND_LEGEND_LEVER = 'hand_legend';
export const MINUTE_NUMBERS_LEVER = 'minute_numbers';
export const DIGITAL_ECHO_LEVER = 'digital_echo';
export const START_SWEEP_LEVER = 'start_and_sweep';
export const SIMPLER_LEVER = 'simpler_item';

const PRACTICE_SUFFIX = '~simpler';
export const isPracticeClock = (c: Pick<ClockChallenge, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);
/** The session item a practice id stands in for. */
export const practiceParent = (id: string | null | undefined, challenges: readonly ClockChallenge[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

/** 1..12 on the dial. */
export const dialHour = (h: number) => ((((h - 1) % 12) + 12) % 12) + 1;
const same12 = (a: number, b: number) => dialHour(a) === dialHour(b);
const hhmm = (h: number, m: number) => `${dialHour(h)}:${String(m).padStart(2, '0')}`;

// ── running_model ────────────────────────────────────────────────────────────

/** The hour the model clock runs from (it runs to the next hour): four hours past the item's. */
export const runningModelHour = (itemHour: number) => dialHour(itemHour + 4);
/** Leak rule: the model's hour and the next one stay two or more hours from the item's hour. */
export function modelLeaks(itemHour: number, modelHour: number): boolean {
  const d = (a: number, b: number) => { const x = Math.abs(dialHour(a) - dialHour(b)) % 12; return Math.min(x, 12 - x); };
  return d(modelHour, itemHour) < 2 || d(modelHour + 1, itemHour) < 2;
}

// ── start_and_sweep ──────────────────────────────────────────────────────────

/** The minutes the learner has run the hands forward from the start time (0 before any run). */
export function sweptMinutes(start: { hour: number; minute: number }, now: { hour: number; minute: number }): number {
  const at = (t: { hour: number; minute: number }) => (t.hour % 12) * 60 + t.minute;
  return (at(now) - at(start) + 720) % 720;
}

// ── which aids a mode may take ───────────────────────────────────────────────

const READS_TIME = new Set<ClockChallenge['type']>(['read', 'match', 'set_time', 'elapsed']);
/** Leak rule: the legend says which hand is the hour; on hand_name that is the answer. Not on elapsed (no hand miss). */
export const legendOffered = (mode: ClockChallenge['type']) => mode === 'read' || mode === 'match' || mode === 'set_time';
export const minuteNumbersOffered = (mode: ClockChallenge['type']) => READS_TIME.has(mode);
/** Leak rule: a digital readout of the dial is the answer everywhere but set_time, whose target is given. */
export const echoOffered = (mode: ClockChallenge['type']) => mode === 'set_time';
export const modelOffered = (mode: ClockChallenge['type']) => mode === 'hand_name' || mode === 'read' || mode === 'match' || mode === 'set_time';

// ── simpler items ────────────────────────────────────────────────────────────

const HOUR_WORDS = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
const durationLabel = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return [h ? `${h} hour${h > 1 ? 's' : ''}` : '', m ? `${m} minutes` : ''].filter(Boolean).join(' ');
};

/** A whole hour four hours on from the item's, so neither it nor the foil six hours on is the item's hour or next to it. */
const practiceHour = (itemHour: number) => dialHour(itemHour + 4);

/** read / match: a whole hour, two choices six hours apart. */
export function twoChoices(c: ClockChallenge): ClockChallenge {
  const p = practiceHour(c.targetHour), foil = dialHour(p + 6), right = dialHour(c.targetHour) % 2;
  const options = right === 0 ? [hhmm(p, 0), hhmm(foil, 0)] : [hhmm(foil, 0), hhmm(p, 0)];
  return {
    id: `${c.id}${PRACTICE_SUFFIX}`, type: c.type,
    instruction: c.type === 'match' ? 'Find the digital time for this clock.' : 'What time does this clock show?',
    targetHour: p, targetMinute: 0, option0: options[0], option1: options[1], correctOptionIndex: right, hint: '',
  };
}

/** hear_time: two faces, six hours apart. */
export function twoFaces(c: ClockChallenge): ClockChallenge {
  return { ...twoChoices(c), type: 'hear_time', instruction: `Which clock shows ${HOUR_WORDS[practiceHour(c.targetHour) % 12]} o'clock?` };
}

/** set_time: a whole hour. Null when the item is already on the hour. */
export function onTheHour(c: ClockChallenge): ClockChallenge | null {
  if (c.targetMinute === 0) return null;
  const p = practiceHour(c.targetHour);
  return { id: `${c.id}${PRACTICE_SUFFIX}`, type: 'set_time', instruction: `Set the clock to ${hhmm(p, 0)}.`,
    targetHour: p, targetMinute: 0, hint: '' };
}

/** elapsed: whole hours from a whole-hour start. Null when the item is already whole hours. */
export function wholeHours(c: ClockChallenge): ClockChallenge | null {
  const d = elapsedMinutes(c);
  if (d % 60 === 0) return null;
  const want = Math.floor(d / 60) === 1 ? 120 : 60;
  const start = dialHour((c.startHour ?? c.targetHour) + 3), end = dialHour(start + want / 60);
  const foils = [30, 60, 120, 180].filter(m => m !== want && m !== d).slice(0, 2);
  const right = dialHour(start) % 3;
  const options = foils.map(durationLabel);
  options.splice(right, 0, durationLabel(want));
  return {
    id: `${c.id}${PRACTICE_SUFFIX}`, type: 'elapsed',
    instruction: `The clock starts at ${hhmm(start, 0)} and stops at ${hhmm(end, 0)}. How much time passed?`,
    targetHour: end, targetMinute: 0, startHour: start, startMinute: 0,
    option0: options[0], option1: options[1], option2: options[2], correctOptionIndex: right, hint: '',
  };
}

export function practiceItem(c: ClockChallenge): ClockChallenge | null {
  if (isPracticeClock(c)) return null;
  switch (c.type) {
    case 'read': case 'match': return twoChoices(c);
    case 'hear_time': return twoFaces(c);
    case 'set_time': return onTheHour(c);
    case 'elapsed': return wholeHours(c);
    default: return null;
  }
}

/**
 * Leak rule for a practice item: never the item itself, its time, its duration or its right option, and it must be
 * solvable (its key option is its own time or duration).
 */
export function practiceLeaks(parent: ClockChallenge, p: ClockChallenge): boolean {
  if (p.id === parent.id || p.type !== parent.type) return true;
  const options = clockOptions(p), parentRight = parent.correctOptionIndex === undefined ? undefined : clockOptions(parent)[parent.correctOptionIndex];
  if (parentRight && options.includes(parentRight)) return true;
  if (p.type === 'elapsed') {
    const d = elapsedMinutes(p);
    return d === elapsedMinutes(parent) || options.some(o => durationMinutes(o) === elapsedMinutes(parent))
      || durationMinutes(options[p.correctOptionIndex ?? -1]) !== d;
  }
  if (same12(p.targetHour, parent.targetHour) && p.targetMinute === parent.targetMinute) return true;
  if (options.includes(hhmm(parent.targetHour, parent.targetMinute))) return true;
  if (p.type === 'set_time') return false;
  return options[p.correctOptionIndex ?? -1] !== hhmm(p.targetHour, p.targetMinute) || new Set(options).size !== options.length;
}

// ── declarations ─────────────────────────────────────────────────────────────

/** The tier aids already on screen: such a lever is declared pulled, so it is not offered again. */
export interface ClockLeverView { legendShown: boolean; minuteNumbersShown: boolean; echoShown: boolean }
export const PLAIN_CLOCK_VIEW: ClockLeverView = { legendShown: false, minuteNumbersShown: false, echoShown: false };

const TIME_MISSES: ClockMiss[] = ['hands_swapped', 'next_hour', 'previous_hour', 'wrong_hour', 'minute_as_number', 'wrong_minute', 'other_time'];

export function analogClockLevers(c: ClockChallenge | null, pulled: readonly string[], view: ClockLeverView = PLAIN_CLOCK_VIEW): WorkspaceLever[] {
  if (!c || isPracticeClock(c)) return [];
  const mode = c.type, levers: WorkspaceLever[] = [];
  const add = (id: string, kind: WorkspaceLever['kind'], answers: readonly ClockMiss[], when: string, does: string, shown = false,
    carrier: WorkspaceLever['carrier'] = 'shown') => levers.push({ id, kind, carrier, pulled: shown || pulled.includes(id), answers, when, does });

  if (mode === 'count_face') {
    add(ROUND_ARROW_LEVER, 'help', [], 'The learner loses their place going round, or starts the count again and again.',
      'Draws a dashed arrow round the face from the first number, the way the count goes. No number is marked.');
    return levers;
  }
  if (mode === 'hear_time') {
    add(SHORT_HANDS_LEVER, 'help', ['next_hour', 'previous_hour', 'wrong_hour'],
      'The learner picks a face whose short hand is on another number.',
      'On every clock face the short hand turns thick and yellow and the long hand faint. Every face changes the same way.');
  }
  if (legendOffered(mode)) add(HAND_LEGEND_LEVER, 'help', ['hands_swapped', 'wrong_hour'],
    'The learner reads the hour off the long hand, or mixes the two hands up.',
    'Shows a key under the clock: the short hand is the hour hand, the long hand is the minute hand.', view.legendShown, 'both');
  if (minuteNumbersOffered(mode)) add(MINUTE_NUMBERS_LEVER, 'help',
    mode === 'elapsed' ? ['too_short', 'too_long'] : ['minute_as_number', 'wrong_minute', 'other_time'],
    'The learner reads the number the long hand points at as the minutes, or miscounts the minutes.',
    'Writes the minute counts by fives just outside each number round the face.', view.minuteNumbersShown);
  if (modelOffered(mode)) add(RUNNING_MODEL_LEVER, 'help',
    mode === 'hand_name' ? ['other_hand'] : ['hands_swapped', 'next_hour', 'previous_hour', 'wrong_hour'],
    mode === 'hand_name' ? 'The learner touches the other hand.'
      : 'The learner reads the hour one number off (near half past), or mixes the hands up.',
    'Puts a small second clock beside this one, at another time, running through one hour: the long hand goes all the '
      + 'way round while the short hand moves from one number to the next. No hand is labelled.', false, 'both');
  if (echoOffered(mode)) add(DIGITAL_ECHO_LEVER, 'help', TIME_MISSES,
    'The learner cannot tell whether the hands show the time asked for.',
    'Shows the time the hands show, in digits, under the clock as the hands move.', view.echoShown);
  if (mode === 'elapsed') add(START_SWEEP_LEVER, 'help', ['hour_off', 'too_short', 'too_long'],
    'The learner loses count of the hours or minutes that pass.',
    'Leaves faint copies of the hands where they started, and as the stopwatch runs shades the path the long hand '
      + 'sweeps: one ring for each full turn. No number is drawn.');
  if (practiceItem(c)) add(SIMPLER_LEVER, 'simplify',
    mode === 'elapsed' ? ['hour_off', 'too_short', 'too_long'] : mode === 'hear_time' ? ['next_hour', 'previous_hour', 'wrong_hour'] : TIME_MISSES,
    'A help lever is already on screen and the learner still cannot do this one.',
    mode === 'elapsed' ? 'Opens an easier one first: whole hours from a whole-hour start. Not graded; the full item comes back after it.'
      : mode === 'set_time' ? 'Opens an easier one first: set a time on the hour. Not graded; the full item comes back after it.'
        : 'Opens an easier one first: a time on the hour with two choices far apart. Not graded; the full item comes back after it.');
  return levers;
}

/** What the pulled help levers put on screen, for the tutor. Pictures only: no digit (`/\d/` is the leak test). */
export function leverFacts(c: ClockChallenge | null, pulled: readonly string[]): string {
  if (!c) return '';
  const on = (id: string) => pulled.includes(id);
  return [
    on(ROUND_ARROW_LEVER) && 'A dashed arrow runs round the face from the first number, the way the count goes.',
    on(SHORT_HANDS_LEVER) && 'On every clock face the short hand is thick and yellow and the long hand faint.',
    on(HAND_LEGEND_LEVER) && 'A key under the clock says the short hand is the hour hand and the long hand the minute hand.',
    on(MINUTE_NUMBERS_LEVER) && 'The minute counts by fives are written just outside each number round the face.',
    on(RUNNING_MODEL_LEVER) && 'A small second clock beside this one, at another time, runs through one hour over and over: '
      + 'its long hand goes all the way round while its short hand moves from one number to the next. No hand is labelled.',
    on(DIGITAL_ECHO_LEVER) && 'The time the hands show is written in digits under the clock as they move.',
    on(START_SWEEP_LEVER) && 'Faint copies of the hands mark where they started; as the stopwatch runs, the path the long '
      + 'hand sweeps is shaded, one ring for each full turn.',
  ].filter((s): s is string => !!s).join(' ');
}
