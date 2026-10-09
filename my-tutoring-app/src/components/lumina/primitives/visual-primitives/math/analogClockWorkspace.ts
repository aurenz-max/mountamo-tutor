/**
 * Analog clock on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, C10).
 *
 * Pure: the component and any probe read the same assignment and scene. Every challenge is answered on the
 * screen (a touched hand, the numbers touched in order, a picked time, face or duration, or hands moved) and
 * checked by the activity's own check, so the tutor is never handed the time the dial shows, the right
 * option, which hand is asked for, or the elapsed duration.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { ClockChallenge } from './AnalogClock';

export function workspaceAssignment(challenge: ClockChallenge): TeachingAssignment {
  return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
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
      drawn.howToAnswer = 'touch a hand, then press Check';
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
      drawn.howToAnswer = 'pick how long it took, then press Check';
      aids();
      break;
    default:
      drawn.clock = 'a clock face showing a time with its two hands; the time is the answer and is not given to you';
      drawn.timeChoices = clockOptions(challenge).join(', ');
      drawn.howToAnswer = 'pick the time the clock shows, then press Check';
      aids();
  }
  return {
    objects: [],
    facts: {
      kind: challenge.type, ...drawn,
      learnerWork: describeClockWork(challenge, view),
      constraints: 'The learner answers on the screen: touches a hand or the numbers, picks a time, a clock face or a duration, '
        + 'or moves the hands, then presses Check; the activity checks it itself. You cannot touch, pick or move anything for the learner.',
    },
  };
}
