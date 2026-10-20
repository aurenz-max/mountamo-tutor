/**
 * analog-clock's in-item levers, every mode, as one lever set (`bossLevers.ts`; /add-support-tiers, report
 * qa/eval-reports/analog-clock-levers-2026-10-09.md). No real-learner evidence: the misses are what `clockMiss` observes (journey scripted wrongs) and the catalog's
 * commonStruggles. Pure: the component draws from these, the workspace publishes them, the tests hold each leak rule.
 * Every lever starts released; the generator's tier aids (minute numbers, hand legend, set_time echo) stay the starting
 * positions, and an aid the tier already shows is declared pulled.
 *
 * - `running_model` (custom: a second clock, not a solved item; hand_name, read, match, set_time): a small second clock beside the item, at an hour two or
 *   more away from the item's, runs through one hour: the long hand goes all the way round while the short hand moves
 *   from one number to the next. Which hand tells the hour IS the answer on hand_name, so the help acts on this model
 *   outside the item and labels no hand. Leak rule (`modelLeaks`): the model never passes through the item's hour.
 * - `round_arrow` (marks; count_face): a dashed arrow round the face from the 1, the way the count goes. No number is
 *   marked. count_face has no miss (an out-of-order touch restarts the count).
 * - `short_hands` (marks; hear_time): every face draws its short hand thick and yellow and its long hand faint. The same
 *   on every face, so no face is singled out.
 * - `hand_legend` (meaning; read, match, set_time), `minute_numbers` (marks; those and elapsed): the tier's reading aids,
 *   on at runtime. Never the legend on hand_name (it is the answer there).
 * - `digital_echo` (custom: a new readout; set_time only): the digital time under the clock as the hands move. The target is given, so
 *   the echo checks the learner's own setting; never on read, match or elapsed, where the time is the answer.
 * - `start_and_sweep` (marks; elapsed): faint copies of the hands where they started, and, as the stopwatch runs, the
 *   path the long hand has swept shaded: one ring per full turn. Drawn from the learner's own run; no number.
 * - `simpler_item` (easier): an ungraded item of the same mode, built here, then the full item back blank.
 *   read / match: a whole hour, two choices far apart. hear_time: two faces, six hours apart. set_time: a whole hour
 *   (none when the item is already on the hour). elapsed: whole hours from a whole-hour start (none when the item is
 *   already whole hours). Leak rule (`practiceLeaks`): never the item's time, duration or right option.
 * - hand_name has no simplify lever: two hands and one touch is already the plainest ask; a simpler one would name the
 *   hand or ask about length instead of what the hand tells.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { ClockChallenge } from './AnalogClock';
import { CLOCK_MISSES, clockKey, clockOptions, durationMinutes, elapsedMinutes } from './analogClockWorkspace';

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

/** What the running model does and shows, in every mode it is offered in. No hand is labelled. */
const RUNNING_MODEL_DOES = 'Puts a small second clock beside this one, at another time, running through one hour: the long '
  + 'hand goes all the way round while the short hand moves from one number to the next. No hand is labelled.';
const RUNNING_MODEL_FACT = 'A small second clock beside this one, at another time, runs through one hour over and over: '
  + 'its long hand goes all the way round while its short hand moves from one number to the next. No hand is labelled.';

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

// ── the lever set ────────────────────────────────────────────────────────────

/** The tier aids already on screen: such a lever is declared pulled, so it is not offered again. */
export interface ClockLeverView { legendShown: boolean; minuteNumbersShown: boolean; echoShown: boolean }
export const PLAIN_CLOCK_VIEW: ClockLeverView = { legendShown: false, minuteNumbersShown: false, echoShown: false };

/** The levers a tier aid already on screen counts as pulled, on the modes that offer them. */
export function tierPulled(c: ClockChallenge | null, view: ClockLeverView): string[] {
  if (!c) return [];
  return [
    ...(view.legendShown && legendOffered(c.type) ? [HAND_LEGEND_LEVER] : []),
    ...(view.minuteNumbersShown && minuteNumbersOffered(c.type) ? [MINUTE_NUMBERS_LEVER] : []),
    ...(view.echoShown && echoOffered(c.type) ? [DIGITAL_ECHO_LEVER] : []),
  ];
}

const READS = ['read', 'match', 'set_time'];
const NEW_PICTURE = 'It draws something new beside or under the clock, not marks on what is already drawn.';
const SIMPLER = 'Not graded; the full item comes back after it.';

export const CLOCK_LEVERS = leverSet<ClockChallenge, ClockLeverView>({
  modeOf: c => c.type,
  missesOf: mode => CLOCK_MISSES[mode as keyof typeof CLOCK_MISSES] ?? [],
  // The legend's words must never name a spoken item's answer.
  answersOf: c => { const key = clockKey(c); return key ? [key.answer, ...key.alsoAccept] : []; },
  specs: [
    { id: ROUND_ARROW_LEVER, type: 'marks', modes: ['count_face'], answers: [],
      when: 'The learner loses their place going round, or starts the count again and again.',
      does: 'Draws a dashed arrow round the face from the first number, the way the count goes. No number is marked.',
      fact: 'A dashed arrow runs round the face from the first number, the way the count goes.' },
    { id: SHORT_HANDS_LEVER, type: 'marks', modes: ['hear_time'], answers: ['next_hour', 'previous_hour', 'wrong_hour'],
      when: 'The learner picks a face whose short hand is on another number.',
      does: 'On every clock face the short hand turns thick and yellow and the long hand faint. Every face changes the same way.',
      fact: 'On every clock face the short hand is thick and yellow and the long hand faint.' },
    { id: HAND_LEGEND_LEVER, type: 'meaning', modes: READS, answers: ['hands_swapped', 'wrong_hour'],
      when: 'The learner reads the hour off the long hand, or mixes the two hands up.',
      does: 'Shows a key under the clock: the short hand is the hour hand, the long hand is the minute hand.',
      fact: 'A key under the clock says the short hand is the hour hand and the long hand the minute hand.' },
    { id: MINUTE_NUMBERS_LEVER, type: 'marks', modes: READS, answers: ['minute_as_number', 'wrong_minute', 'other_time'],
      when: 'The learner reads the number the long hand points at as the minutes, or miscounts the minutes.',
      does: 'Writes the minute counts by fives just outside each number round the face.',
      fact: 'The minute counts by fives are written just outside each number round the face.' },
    { id: MINUTE_NUMBERS_LEVER, type: 'marks', modes: ['elapsed'], answers: ['too_short', 'too_long'],
      when: 'The learner reads the number the long hand points at as the minutes, or miscounts the minutes.',
      does: 'Writes the minute counts by fives just outside each number round the face.',
      fact: 'The minute counts by fives are written just outside each number round the face.' },
    { id: RUNNING_MODEL_LEVER, type: 'custom', carrier: 'both', modes: ['hand_name'], answers: ['other_hand'],
      why: 'It runs a second clock at another time to show how the two hands move, not a solved item of this kind.',
      when: 'The learner touches the other hand.',
      does: RUNNING_MODEL_DOES, fact: RUNNING_MODEL_FACT },
    { id: RUNNING_MODEL_LEVER, type: 'custom', carrier: 'both', modes: READS,
      answers: ['hands_swapped', 'next_hour', 'previous_hour', 'wrong_hour'],
      why: 'It runs a second clock at another time to show how the two hands move, not a solved item of this kind.',
      when: 'The learner reads the hour one number off (near half past), or mixes the hands up.',
      does: RUNNING_MODEL_DOES, fact: RUNNING_MODEL_FACT },
    { id: DIGITAL_ECHO_LEVER, type: 'custom', carrier: 'shown', modes: ['set_time'], answers: 'all', why: NEW_PICTURE,
      when: 'The learner cannot tell whether the hands show the time asked for.',
      does: 'Shows the time the hands show, in digits, under the clock as the hands move.',
      fact: 'The time the hands show is written in digits under the clock as they move.' },
    { id: START_SWEEP_LEVER, type: 'marks', modes: ['elapsed'], answers: ['hour_off', 'too_short', 'too_long'],
      when: 'The learner loses count of the hours or minutes that pass.',
      does: 'Leaves faint copies of the hands where they started, and as the stopwatch runs shades the path the long hand '
        + 'sweeps: one ring for each full turn. No number is drawn.',
      fact: 'Faint copies of the hands mark where they started; as the stopwatch runs, the path the long hand sweeps is '
        + 'shaded, one ring for each full turn.' },
    { id: SIMPLER_LEVER, type: 'easier', carrier: 'shown', modes: ['read', 'match'], answers: 'all', content: practiceItem,
      when: 'A help lever is already on screen and the learner still cannot do this one.',
      does: `Opens an easier one first: a time on the hour with two choices far apart. ${SIMPLER}` },
    { id: SIMPLER_LEVER, type: 'easier', carrier: 'shown', modes: ['set_time'], answers: 'all', content: practiceItem,
      when: 'A help lever is already on screen and the learner still cannot do this one.',
      does: `Opens an easier one first: set a time on the hour. ${SIMPLER}` },
    { id: SIMPLER_LEVER, type: 'easier', carrier: 'shown', modes: ['hear_time'], answers: 'all', content: practiceItem,
      when: 'A help lever is already on screen and the learner still cannot do this one.',
      does: `Opens an easier one first: a time on the hour with two choices far apart. ${SIMPLER}` },
    { id: SIMPLER_LEVER, type: 'easier', carrier: 'shown', modes: ['elapsed'], answers: 'all', content: practiceItem,
      when: 'A help lever is already on screen and the learner still cannot do this one.',
      does: `Opens an easier one first: whole hours from a whole-hour start. ${SIMPLER}` },
  ],
});
