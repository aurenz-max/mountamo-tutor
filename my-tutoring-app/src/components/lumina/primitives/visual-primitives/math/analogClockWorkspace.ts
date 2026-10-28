/**
 * Analog clock on the shared tutor/JEV teaching workspace: the items, the ask, the spoken key, the activity's check and
 * the scene, which the boss (`analogClock.boss.ts`), the component, the levers and the tests read.
 *
 * read, match and elapsed ask for one time or duration and hand_name for one of two hands, so each may also be said
 * aloud: the boss hands the tutor its key (`clockKey`), and a pick or touch and Check is still checked by the activity.
 * set_time (hands moved), count_face (numbers touched in order) and hear_time (a picture of a face, which has no name to
 * say) have no key. The scene never states the time the dial shows, the right option, which hand is asked for, or the
 * elapsed duration.
 *
 * Pure: no React.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { AnalogClockData, ClockChallenge } from './AnalogClock';
import { CLOCK_MISSES, type ClockMiss } from './analogClock.card';

export { CLOCK_MISSES, type ClockMiss };

/** The modes whose answer is one thing a learner can say. */
export const isSpokenClock = (c: ClockChallenge) =>
  c.type === 'read' || c.type === 'match' || c.type === 'elapsed' || c.type === 'hand_name';

/** The lesson's items, in order. */
export const clockItems = (d: Pick<AnalogClockData, 'challenges'>): ClockChallenge[] => d.challenges ?? [];

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

// ── The ask and the key ──────────────────────────────────────────────────────

const HAND_MENU = ['the short one', 'the long one'];

/** The challenge's own words; hand_name adds its two answers, the closed menu its key reads. */
export const clockAsk = (c: ClockChallenge): string =>
  c.type === 'hand_name' ? `${c.instruction.trim()} The short one or the long one?` : c.instruction;

/** The key a spoken read, match, elapsed or hand_name item is judged against; null on the items answered on screen. */
export function clockKey(c: ClockChallenge): SpokenKey | null {
  if (!isSpokenClock(c)) return null;
  if (c.type === 'hand_name') {
    if (!c.targetHand) return null;
    const [is, isNot, small, big] = c.targetHand === 'hour' ? ['short', 'long', 'little', 'big'] : ['long', 'short', 'big', 'little'];
    return { answer: `the ${is} one`, alsoAccept: [`the ${is} hand`, `the ${small} one`], menu: HAND_MENU,
      signatureError: `Naming the ${isNot} one ("the ${isNot} hand", "the ${big} one") is wrong. Saying only "the `
        + `${c.targetHand} hand" repeats the question without telling which hand that is, so it is not an answer yet.` };
  }
  if (c.type === 'elapsed') {
    const [answer, ...alsoAccept] = spokenDurationForms(elapsedMinutes(c));
    return { answer, alsoAccept, signatureError: 'Any other duration is wrong, and so is the start time '
      + `(${clockTime(c.startHour ?? c.targetHour, c.startMinute ?? 0)}) or the end time (${clockTime(c.targetHour, c.targetMinute)}): `
      + 'a time is not how long it took.' };
  }
  const { targetHour: hour, targetMinute: minute } = c;
  const [answer, ...alsoAccept] = spokenTimeForms(hour, minute);
  const next = words(hour12(hour + 1));
  return { answer, alsoAccept, signatureError: (minute > 30 ? `"${next} ${words(minute)}" is wrong: it names the next hour. ` : '')
    + (minute === 0 ? '' : `"${words(hour12(hour))} o'clock" alone, or the minutes with no hour, is wrong. `)
    + 'Any other hour or minutes is wrong.' };
}

/** The journey's spoken answers: the key's own words, or the mode's signature error. */
export function clockHarnessWords(c: ClockChallenge): { correct: string; plainWrong: string } {
  const key = clockKey(c);
  if (!key) throw new Error(`analog-clock ${c.id}: a ${c.type} item has no spoken answer`);
  if (c.type === 'hand_name') return { correct: key.answer, plainWrong: c.targetHand === 'hour' ? 'the long one' : 'the short one' };
  if (c.type === 'elapsed') return { correct: key.answer, plainWrong: durationText(elapsedMinutes(c) + 60) };
  return { correct: key.answer, plainWrong: plainTime(c.targetHour + 1, c.targetMinute)[0] };
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
  /** set_time_ampm: the period picked. */
  pickedPeriod?: 'am' | 'pm' | null;
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
    case 'set_time_ampm':
      return `The hands show ${hhmm(view.displayHour, view.displayMinute)}; ${view.pickedPeriod
        ? `picked ${view.pickedPeriod === 'am' ? 'a.m.' : 'p.m.'}` : 'no a.m. or p.m. picked yet'}`;
    case 'elapsed':
      return picked ? `Picked ${picked}` : 'No duration picked yet';
    default:
      return picked ? `Picked ${picked}` : 'No time picked yet';
  }
}

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
    case 'set_time_ampm':
      // The hands first: a wrong time is that miss whatever the period; the right time with the wrong period is its own.
      return timeMiss({ hour: view.displayHour, minute: view.displayMinute }, target)
        ?? (view.pickedPeriod && view.pickedPeriod !== challenge.period ? 'wrong_period' : undefined);
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

// ── The scene ────────────────────────────────────────────────────────────────

const TEACH = 'Teaching is fine: one hand is short and one is long; ask which number the short hand is on or just past; '
  + 'count by fives round the face together without saying where the count stops.';
const BEFORE = 'Before the learner has answered, and after a wrong answer, never say';

/**
 * This item's never-say rules and what teaching it is, from the old catalog guidance, by mode. What the shared rules
 * already say is not repeated: reading the ask aloud (the time asked for on hear_time, the time to set on set_time),
 * confirming nothing on a board before Check, doing nothing for the learner.
 */
function constraintsOf(c: ClockChallenge): string {
  switch (c.type) {
    case 'hand_name':
      return `${BEFORE} whether the short or the long hand is the one asked for. Which hand tells the hour or the minutes is `
        + 'the question: say how each hand moves (one fast, one slow), and never tell the learner to pick the other hand, '
        + 'even after a wrong answer.';
    case 'count_face':
      return 'Counting aloud together from 1 is teaching.';
    case 'hear_time':
      return `${BEFORE} which face shows the time asked for. ${TEACH}`;
    case 'set_time':
      return TEACH;
    case 'set_time_ampm':
      return `${BEFORE} whether it is a.m. or p.m. The event decides it: ask when the event happens in the learner's own `
        + `day (before lunch or after lunch, in the morning or at night). A 12 on the clock does not mean the morning. ${TEACH}`;
    case 'elapsed':
      return `${BEFORE} how long it took or which duration is right. ${TEACH}`;
    default:
      return `${BEFORE} the time the clock shows or which choice is right. ${TEACH}`;
  }
}

/** What is drawn and asked. The options on screen are listed; the time on the dial, the right one, never. */
export function clockScene(challenge: ClockChallenge, view: ClockView): SceneOf {
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
      break;
    case 'count_face':
      drawn.clock = 'a clock face whose numbers 1 to 12 can each be touched';
      break;
    case 'hear_time':
      drawn.clockFaces = `${clockOptions(challenge).length} small clock faces, each showing a whole hour; there is no big clock`;
      break;
    case 'set_time':
      drawn.clock = 'a clock face whose hands the learner moves; it starts at 12:00';
      drawn.digitalTime = view.digitalEchoShown ? 'shown under the clock as the hands move' : 'hidden';
      aids();
      break;
    case 'set_time_ampm':
      drawn.clock = 'a clock face whose hands the learner moves; it starts at 12:00';
      drawn.periodButtons = 'two buttons under the clock, a.m. and p.m.; the learner picks one';
      drawn.digitalTime = view.digitalEchoShown ? 'shown under the clock as the hands move, with no a.m. or p.m.' : 'hidden';
      aids();
      break;
    case 'elapsed':
      drawn.clock = 'a clock face showing the start time, with a stopwatch that runs its hands forward';
      drawn.durationChoices = clockOptions(challenge).join('; ');
      aids();
      break;
    default:
      drawn.clock = 'a clock face showing a time with its two hands; the time is the answer and is not given to you';
      drawn.timeChoices = clockOptions(challenge).join(', ');
      aids();
  }
  return {
    objects: [],
    facts: { kind: challenge.type, ...drawn, learnerWork: describeClockWork(challenge, view), constraints: constraintsOf(challenge) },
  };
}
