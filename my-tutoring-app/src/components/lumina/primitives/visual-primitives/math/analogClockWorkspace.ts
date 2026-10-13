/**
 * Analog clock on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, C10).
 *
 * Pure: the component and any probe read the same assignment and scene. read, match and elapsed ask for one time or
 * duration and hand_name for one of two hands, so each may also be said aloud: the item is spoken with
 * `acceptsGesture`, and JEV judges it from the tutor's feedback against `expectedAnswer` (VB-1, 2026-10-13); a tap
 * and Check is still checked by the activity. set_time (hands moved), count_face (numbers touched in order) and
 * hear_time (a picture of a face, which has no name to say) stay tap-only. The tutor is never handed the time the
 * dial shows, the right option, which hand is asked for, or the elapsed duration.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { ClockChallenge } from './AnalogClock';

/** The modes whose answer is one thing a learner can say. */
export const isSpokenClock = (c: ClockChallenge) =>
  c.type === 'read' || c.type === 'match' || c.type === 'elapsed' || c.type === 'hand_name';

export function workspaceAssignment(challenge: ClockChallenge): TeachingAssignment {
  const expectedAnswer = clockExpectedAnswer(challenge);
  if (!expectedAnswer) return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
  const how = challenge.type === 'hand_name' ? 'saying which hand it is, the short one or the long one, or touching it'
    : challenge.type === 'elapsed' ? 'saying how long it took, or picking a duration' : 'saying the time, or picking it';
  return { id: challenge.id, task: `${challenge.instruction} The learner answers by ${how}.`,
    response: 'speech', acceptsGesture: true, expectedAnswer, misses: clockSpokenMisses(challenge) };
}

// ── Spoken times and durations ────────────────────────────────────────────────
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];
/** 0-59 in words: "forty-five". */
const words = (n: number) => n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
const hour12 = (h: number) => ((h % 12) + 12) % 12 || 12;
const clockTime = (hour: number, minute: number) => `${hour12(hour)}:${String(minute).padStart(2, '0')}`;

/** The plain readings of a time, "four forty-five" and "4:45": the forms a miss is spoken in. */
const plainTime = (hour: number, minute: number) => {
  const h = words(hour12(hour));
  return [minute === 0 ? `${h} o'clock` : `${h} ${minute < 10 ? `oh ${words(minute)}` : words(minute)}`, clockTime(hour, minute)];
};

/** Every natural way to say a time on the dial. */
export function spokenTimeForms(hour: number, minute: number): string[] {
  const h = words(hour12(hour)), next = words(hour12(hour + 1));
  const forms = plainTime(hour, minute);
  if (minute === 0) forms.push(h);
  if (minute === 15) forms.push(`quarter past ${h}`, `a quarter after ${h}`);
  if (minute === 30) forms.push(`half past ${h}`);
  if (minute === 45) forms.push(`quarter to ${next}`, `a quarter till ${next}`);
  if (minute > 0 && minute < 30) forms.push(`${words(minute)} past ${h}`, `${words(minute)} after ${h}`);
  if (minute > 30) forms.push(`${words(60 - minute)} to ${next}`);
  return forms;
}

const hoursText = (h: number) => h === 1 ? 'one hour' : `${words(h)} hours`;
const durationText = (mins: number) => {
  const h = Math.floor(mins / 60), m = mins % 60, ms = `${words(m)} minute${m === 1 ? '' : 's'}`;
  return h && m ? `${hoursText(h)} ${ms}` : h ? hoursText(h) : ms;
};

/** Every natural way to say a duration. */
export function spokenDurationForms(mins: number): string[] {
  const h = Math.floor(mins / 60), m = mins % 60;
  const forms = [durationText(mins)];
  if (h && m) forms.push(`${hoursText(h)} and ${words(m)} minutes`);
  if (h === 1 && m) forms.push(`${mins} minutes`);
  if (mins === 60) forms.push('an hour', 'sixty minutes');
  if (m === 30) forms.push(...(h ? [`${h === 1 ? 'an hour' : hoursText(h)} and a half`, `${words(h)} and a half hours`] : ['half an hour']));
  if (mins === 15) forms.push('a quarter of an hour');
  if (mins === 45) forms.push('three quarters of an hour');
  return forms;
}

const quoted = (forms: string[]) => forms.map(f => `"${f}"`).join(', ');

/** The one answer a spoken read, match, elapsed or hand_name item is judged against, with the ways of saying it. */
export function clockExpectedAnswer(c: ClockChallenge): string | undefined {
  if (!isSpokenClock(c)) return undefined;
  if (c.type === 'hand_name') {
    if (!c.targetHand) return undefined;
    const [is, isNot, small, big] = c.targetHand === 'hour' ? ['short', 'long', 'little', 'big'] : ['long', 'short', 'big', 'little'];
    return `the ${is} hand (the ${c.targetHand} hand is the ${is} one); said as "the ${is} one", "the ${is} hand" or "the `
      + `${small} one". Naming the ${isNot} one ("the ${isNot} hand", "the ${big} one") is not it. Saying only "the `
      + `${c.targetHand} hand" repeats the question without telling which hand that is, so it is not an answer yet.`;
  }
  if (c.type === 'elapsed') {
    const mins = elapsedMinutes(c);
    return `${durationText(mins)} (from ${clockTime(c.startHour ?? c.targetHour, c.startMinute ?? 0)} to `
      + `${clockTime(c.targetHour, c.targetMinute)}); said as ${quoted(spokenDurationForms(mins))}. Any other duration is `
      + 'not it, and naming the start or end time is a time, not how long it took.';
  }
  const { targetHour: hour, targetMinute: minute } = c;
  const next = words(hour12(hour + 1));
  return `${clockTime(hour, minute)}; said as ${quoted(spokenTimeForms(hour, minute))}. `
    + (minute > 30 ? `"... to ${next}" names the right time; "${next} ${words(minute)}" does not. ` : '')
    + (minute === 0 ? '' : `"${words(hour12(hour))} o'clock" alone, or the minutes with no hour, is not it. `)
    + 'Any other hour or minutes is not it.';
}

/** A spoken item's known wrong answers, with the tap's ids (`clockMiss`, the catalog's lists), in `timeMiss` order. */
export function clockSpokenMisses(c: ClockChallenge): KnownMiss[] {
  if (!isSpokenClock(c)) return [];
  if (c.type === 'hand_name') {
    if (!c.targetHand) return [];
    const other = c.targetHand === 'hour' ? 'long' : 'short';
    return [{ id: 'other_hand', pattern: `The learner names the ${other} hand, the one that tells the `
      + `${c.targetHand === 'hour' ? 'minutes' : 'hour'}.`, examples: [`the ${other} one`, `the ${other} hand`] }];
  }
  if (c.type === 'elapsed') {
    const want = elapsedMinutes(c);
    const wrong = clockOptions(c).map(durationMinutes).filter((m): m is number => m !== null && m !== want);
    const hourOff = [want + 60, ...(want > 60 ? [want - 60] : [])];
    const miss = (id: string, pattern: string, values: number[]): KnownMiss =>
      values.length ? { id, pattern, examples: values.slice(0, 4).map(durationText) } : { id, pattern };
    return [
      miss('hour_off', `The learner's duration is an hour off: ${hourOff.map(durationText).join(' or ')}.`, hourOff),
      miss('too_short', `The learner's duration is shorter than ${durationText(want)}, and not by exactly an hour.`,
        wrong.filter(m => m < want && want - m !== 60)),
      miss('too_long', `The learner's duration is longer than ${durationText(want)}, and not by exactly an hour.`,
        wrong.filter(m => m > want && m - want !== 60)),
    ];
  }
  const { targetHour: hour, targetMinute: minute } = c;
  const h = words(hour12(hour));
  const misses: KnownMiss[] = [];
  const swapped = { hour: minute / 5 || 12, minute: (hour % 12) * 5 };
  if (minute % 5 === 0 && swapped.minute !== minute) misses.push({ id: 'hands_swapped', pattern: 'The learner reads the '
    + `hour off the long hand and the minutes off the short hand: ${clockTime(swapped.hour, swapped.minute)}.`,
  examples: plainTime(swapped.hour, swapped.minute) });
  misses.push(
    { id: 'next_hour', pattern: `The minutes are right but the hour is one too many: ${clockTime(hour + 1, minute)}, the `
      + 'number the short hand is moving toward.', examples: plainTime(hour + 1, minute) },
    { id: 'previous_hour', pattern: `The minutes are right but the hour is one too few: ${clockTime(hour - 1, minute)}.`,
      examples: plainTime(hour - 1, minute) },
    { id: 'wrong_hour', pattern: `The minutes are right but the hour is two or more away from ${h}.` },
  );
  if (minute % 5 === 0 && minute > 0) misses.push({ id: 'minute_as_number', pattern: 'The learner takes the number the '
    + `long hand points at as the minutes: ${clockTime(hour, minute / 5)}.`,
  examples: Array.from(new Set([...plainTime(hour, minute / 5), `${h} ${words(minute / 5)}`])) });
  misses.push(
    { id: 'wrong_minute', pattern: `The hour is right (${h}) but the minutes are not ${words(minute)}`
      + (minute ? `, or the learner says ${h} o'clock.` : '.') },
    { id: 'other_time', pattern: 'Both the hour and the minutes are wrong.' },
  );
  return misses;
}

export interface ClockView {
  /** The option index picked (read, match, hear_time, elapsed). */
  selectedOption: number | null;
  /** hand_name: the hand touched, by what the learner sees (short = hour hand, long = minute hand). */
  pickedHand: 'hour' | 'minute' | null;
  /** count_face: the numbers touched so far, in order. */
  countedNumerals: readonly number[];
  /** The time the hands show now. */
  displayHour: number;
  displayMinute: number;
  /** Reading aids on screen (support tier). */
  minuteNumbersShown: boolean;
  handLegendShown: boolean;
  digitalEchoShown: boolean;
}

export const clockOptions = (c: ClockChallenge): string[] =>
  [c.option0, c.option1, c.option2, c.option3].filter((o): o is string => !!o);

const hhmm = (hour: number, minute: number) => {
  const h = ((hour % 12) + 12) % 12 || 12;
  return `${h}:${String(minute).padStart(2, '0')}`;
};

/** The learner's work in their own terms, never the key. */
export function describeClockWork(challenge: ClockChallenge, view: ClockView): string {
  const picked = view.selectedOption === null ? null : clockOptions(challenge)[view.selectedOption];
  switch (challenge.type) {
    case 'hand_name':
      return view.pickedHand ? `Touched the ${view.pickedHand === 'hour' ? 'short' : 'long'} hand` : 'No hand touched yet';
    case 'count_face': {
      const n = view.countedNumerals.length;
      return n === 0 ? 'No number touched yet' : n === 12 ? 'Touched 1 to 12 in order' : `Touched 1 to ${n} in order`;
    }
    // Which face, by its place only: the hour a face shows is what the learner is matching.
    case 'hear_time':
      return view.selectedOption === null ? 'No clock face picked yet' : `Picked clock face ${view.selectedOption + 1}`;
    case 'set_time':
      return `The hands show ${hhmm(view.displayHour, view.displayMinute)}`;
    case 'elapsed':
      return picked ? `Picked ${picked}` : 'No duration picked yet';
    default:
      return picked ? `Picked ${picked}` : 'No time picked yet';
  }
}

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the catalog's commonStruggles (the two
 * hands confused; the hour hand read as the next number near half past; the minute number read as minutes):
 * - hand_name: `other_hand`;
 * - read, match, hear_time and set_time: `hands_swapped` (the hour read off the long hand and the minutes off
 *   the short one), `next_hour` / `previous_hour` (the minutes right, the hour one number off), `wrong_hour`,
 *   `minute_as_number` (the number the long hand points at taken as the minutes: 3:03 for 3:15),
 *   `wrong_minute` (the hour right), `other_time`;
 * - elapsed: `hour_off` (an hour too long or short), `too_short`, `too_long`.
 * count_face has none: an out-of-order touch starts the count again and Check opens only at 12 in order.
 */
export type ClockMiss = 'other_hand'
  | 'hands_swapped' | 'next_hour' | 'previous_hour' | 'wrong_hour' | 'minute_as_number' | 'wrong_minute' | 'other_time'
  | 'hour_off' | 'too_short' | 'too_long';

const parseTime = (text: string | undefined): { hour: number; minute: number } | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text?.trim() ?? '');
  return m ? { hour: Number(m[1]), minute: Number(m[2]) } : null;
};

/** Minutes in a duration option ("1 hour 30 minutes", "45 minutes", "2 hours"). */
export function durationMinutes(text: string | undefined): number | null {
  const s = text?.trim() ?? '';
  const h = /(\d+)\s*hours?/.exec(s), m = /(\d+)\s*minutes?/.exec(s);
  return h || m ? Number(h?.[1] ?? 0) * 60 + Number(m?.[1] ?? 0) : null;
}

/** The elapsed duration the challenge asks for, in minutes, from its start and end times. */
export function elapsedMinutes(c: ClockChallenge): number {
  const start = ((c.startHour ?? c.targetHour) % 12) * 60 + (c.startMinute ?? 0);
  let end = (c.targetHour % 12) * 60 + c.targetMinute;
  if (end <= start) end += 720;
  return end - start;
}

/** A time that is not the target, read against it. Hours compare on the 12-hour dial. */
export function timeMiss(got: { hour: number; minute: number }, target: { hour: number; minute: number }): ClockMiss | undefined {
  const h = (n: number) => ((n % 12) + 12) % 12;
  const gh = h(got.hour), th = h(target.hour);
  if (gh === th && got.minute === target.minute) return undefined;
  // The long hand's number read as the hour, the short hand's number times five as the minutes.
  if (got.minute !== target.minute && gh === h(target.minute / 5) && got.minute === (th * 5) % 60) return 'hands_swapped';
  if (got.minute === target.minute) return gh === h(th + 1) ? 'next_hour' : gh === h(th - 1) ? 'previous_hour' : 'wrong_hour';
  if (gh === th && target.minute % 5 === 0 && target.minute > 0 && got.minute === target.minute / 5) return 'minute_as_number';
  return gh === th ? 'wrong_minute' : 'other_time';
}

export function clockMiss(challenge: ClockChallenge | null, view: ClockView): ClockMiss | undefined {
  if (!challenge) return undefined;
  const target = { hour: challenge.targetHour, minute: challenge.targetMinute };
  switch (challenge.type) {
    case 'hand_name':
      return view.pickedHand && challenge.targetHand && view.pickedHand !== challenge.targetHand ? 'other_hand' : undefined;
    case 'count_face':
      return undefined;
    case 'set_time':
      return timeMiss({ hour: view.displayHour, minute: view.displayMinute }, target);
    case 'elapsed': {
      if (view.selectedOption === null || view.selectedOption === challenge.correctOptionIndex) return undefined;
      const got = durationMinutes(clockOptions(challenge)[view.selectedOption]);
      if (got === null) return undefined;
      const want = elapsedMinutes(challenge);
      if (got === want) return undefined;
      if (Math.abs(got - want) === 60) return 'hour_off';
      return got < want ? 'too_short' : 'too_long';
    }
    default: {
      if (view.selectedOption === null || view.selectedOption === challenge.correctOptionIndex) return undefined;
      const got = parseTime(clockOptions(challenge)[view.selectedOption]);
      return got ? timeMiss(got, target) ?? 'other_time' : 'other_time';
    }
  }
}

/** What a spoken mode's answer is, which the scene withholds until the learner answers. */
const WITHHELD: Record<string, string> = {
  read: 'the time the clock shows or which choice is right', match: 'the time the clock shows or which choice is right',
  elapsed: 'how long it took or which duration is right', hand_name: 'whether the short or the long hand is the one asked for',
};

/** What is drawn and asked. The options on screen are listed; the time on the dial, the right one, never. */
export function workspaceScene(challenge: ClockChallenge, view: ClockView): WorkspaceScene {
  const drawn: Record<string, string | number> = {};
  // Only a support tier hides or shows the reading aids on purpose; an untiered session states neither.
  const aids = () => {
    if (!challenge.supportTier) return;
    drawn.minuteNumbers = view.minuteNumbersShown ? 'shown round the face (0, 5, 10 ... 55)' : 'hidden: do not name the minute positions';
    drawn.handLegend = view.handLegendShown ? 'shown (short = hour, long = minute)' : 'hidden: ask which hand is which';
  };
  switch (challenge.type) {
    case 'hand_name':
      drawn.clock = 'a clock face with numbers 1 to 12, one short hand and one long hand';
      drawn.howToAnswer = 'say which hand, the short one or the long one, or touch a hand and press Check';
      break;
    case 'count_face':
      drawn.clock = 'a clock face whose numbers 1 to 12 can each be touched';
      drawn.howToAnswer = 'touch the numbers from 1 to 12 in order; a number out of order starts the count again at 1; Check opens after 12';
      break;
    case 'hear_time':
      drawn.clockFaces = `${clockOptions(challenge).length} small clock faces, each showing a whole hour; there is no big clock`;
      drawn.howToAnswer = 'pick the clock face that shows the time in the question, then press Check';
      break;
    case 'set_time':
      drawn.clock = 'a clock face whose hands the learner moves; it starts at 12:00';
      drawn.howToAnswer = 'drag round the clock face, or slide the bar under it, to move the hands, then press Check';
      drawn.digitalTime = view.digitalEchoShown ? 'shown under the clock as the hands move' : 'hidden';
      aids();
      break;
    case 'elapsed':
      drawn.clock = 'a clock face showing the start time, with a stopwatch (Start, Stop, Reset) that runs its hands forward';
      drawn.durationChoices = clockOptions(challenge).join('; ');
      drawn.howToAnswer = 'say how long it took, or pick a duration and press Check';
      aids();
      break;
    default:
      drawn.clock = 'a clock face showing a time with its two hands; the time is the answer and is not given to you';
      drawn.timeChoices = clockOptions(challenge).join(', ');
      drawn.howToAnswer = 'say the time the clock shows, or pick it and press Check';
      aids();
  }
  return {
    objects: [],
    facts: {
      kind: challenge.type, ...drawn,
      learnerWork: describeClockWork(challenge, view),
      constraints: isSpokenClock(challenge)
        ? 'The learner says the answer, or picks or touches it and presses Check; a Check is checked by the activity. '
          + `Before the learner has answered, never name ${WITHHELD[challenge.type]}. You cannot touch or pick anything for the learner.`
        : 'The learner answers on the screen: touches the numbers, picks a clock face, '
          + 'or moves the hands, then presses Check; the activity checks it itself. You cannot touch, pick or move anything for the learner.',
    },
  };
}
