/**
 * Time sequencer on the shared tutor/JEV teaching workspace: the items, the ask, the spoken key, the activity's check
 * and the scene, which the boss (`timeSequencer.boss.ts`), the component, the levers and the tests read.
 *
 * A one-choice challenge (a time of day, the card before or after, which takes longer, the activity at a schedule time)
 * may be said aloud: the boss hands the tutor its key (`timeKey`), and a tap and Check is still checked by the activity.
 * An order (sequence-events, clock-sequence) is several answers at once: it has no key, and the tutor is never handed
 * `correctOrder` or the clock hours.
 *
 * Pure: no React.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { EventCard, TimeSequencerChallenge, TimeSequencerData } from './TimeSequencer';
import { TIME_MISSES, type TimeSequencerMiss } from './timeSequencer.card';

export { TIME_MISSES, type TimeSequencerMiss };

export const PERIODS = ['morning', 'afternoon', 'evening', 'night'] as const;
export type Period = typeof PERIODS[number];

/** The lesson's items, in order. */
export const timeItems = (d: Pick<TimeSequencerData, 'challenges'>): TimeSequencerChallenge[] => d.challenges ?? [];

export const isOrdering = (c: Pick<TimeSequencerChallenge, 'type'>) => c.type === 'sequence-events' || c.type === 'clock-sequence';

/** The item's eval mode: the challenge type, except that sequence-events is sequence-3 or sequence-5 by its card count. */
export function timeModeOf(c: Pick<TimeSequencerChallenge, 'type' | 'events'>): string {
  switch (c.type) {
    case 'sequence-events': return (c.events?.length ?? 0) >= 4 ? 'sequence-5' : 'sequence-3';
    case 'match-time-of-day': return 'time-of-day';
    default: return c.type;
  }
}

const SHORT_STOP = new Set(['the', 'a', 'an', 'your', 'my', 'our', 'to', 'at', 'in', 'of', 'on', 'and', 'up', 'out',
  'with', 'for', 'some', 'back', 'from', 'into', 'off']);
const contentWords = (s: string) => s.toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/)
  .filter(w => w.length > 2 && !SHORT_STOP.has(w));
/** A word of a label that no other named text has, for a short way of saying it ("Board the big yellow bus": "yellow"). */
function ownWord(label: string, others: readonly string[]): string | undefined {
  const taken = new Set(others.flatMap(contentWords));
  return contentWords(label).reverse().find(w => !taken.has(w));
}
const quoted = (labels: readonly string[]) => labels.map(l => `"${l}"`).join(', ');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "Morning, afternoon, evening, or night?" */
const menuQuestion = (words: readonly string[]) => {
  const [first, ...rest] = words;
  if (!rest.length) return `${cap(first)}?`;
  return `${[cap(first), ...rest.slice(0, -1)].join(', ')}${rest.length > 1 ? ',' : ''} or ${rest[rest.length - 1]}?`;
};
const SHORTER = 'A shorter way of saying the same activity also counts.';

const periodChoices = (c: TimeSequencerChallenge): readonly Period[] => c.periodChoices ?? PERIODS;
const keyCard = (c: TimeSequencerChallenge) => c.options?.find(o => o.id === c.correctEvent);
const optionLabels = (c: TimeSequencerChallenge) => (c.options ?? []).map(o => o.label);
const durationMenu = (c: TimeSequencerChallenge) => [c.eventA?.label ?? '', c.eventB?.label ?? '', 'about the same'];
const scheduleChoices = (c: TimeSequencerChallenge) =>
  Array.from(new Set([...(c.activityOptions ?? []), ...(c.schedule ?? []).map(r => r.activity)]));

/** The challenge's own words; a one-choice challenge whose choices are pictures says them, the menu its key reads.
 *  A schedule's choices are print the learner reads, so its ask is the instruction alone. */
export function timeAsk(c: TimeSequencerChallenge): string {
  const ask = c.instruction.trim();
  if (c.type === 'match-time-of-day') return `${ask} ${menuQuestion(periodChoices(c))}`;
  if (c.type === 'before-after') return `${ask} ${menuQuestion(optionLabels(c))}`;
  if (c.type === 'duration-compare') return `${ask} ${menuQuestion(durationMenu(c))}`;
  return ask;
}

/** The key a spoken choice is judged against; null on an order, answered on screen. */
export function timeKey(c: TimeSequencerChallenge): SpokenKey | null {
  if (c.type === 'match-time-of-day') {
    const p = c.correctPeriod;
    if (!p) return null;
    return { answer: p, alsoAccept: [`in the ${p}`, ...(p === 'night' ? ['at night', 'nighttime'] : [])],
      menu: periodChoices(c), acceptRule: `A sentence that says it, such as "I do it in the ${p}", counts.`,
      signatureError: 'Any other time of day is wrong.' };
  }
  if (c.type === 'before-after') {
    const key = keyCard(c);
    if (!key) return null;
    const others = optionLabels(c).filter(l => l !== key.label), ref = c.referenceEvent?.label ?? '';
    const own = ownWord(key.label, [...others, ref, c.instruction]);
    return { answer: key.label, alsoAccept: own ? [own, `the ${own}`] : [], menu: optionLabels(c), acceptRule: SHORTER,
      signatureError: `Another card${others.length ? ` (${quoted(others)})` : ''}${ref ? `, or "${ref}" itself,` : ''} is wrong.` };
  }
  if (c.type === 'duration-compare') {
    const a = c.eventA?.label, b = c.eventB?.label;
    if (!a || !b || !c.correctAnswer) return null;
    if (c.correctAnswer === 'same') return { answer: 'about the same', alsoAccept: ['the same', 'same time', 'they take the same'],
      menu: durationMenu(c), signatureError: 'Naming either one as taking longer is wrong.' };
    const [long, short] = c.correctAnswer === 'A' ? [a, b] : [b, a];
    // Two content words where the label has them ("A whole school day": "school day"); one word reads too thin.
    const short2 = contentWords(long).slice(-2).join(' ');
    const also = [...(short2 && short2 !== long.toLowerCase() ? [short2, `the ${short2}`] : []),
      c.correctAnswer === 'A' ? 'the first one' : 'the second one'];
    return { answer: long, alsoAccept: also, menu: durationMenu(c), acceptRule: SHORTER,
      signatureError: `"${short}", or "about the same", is wrong.` };
  }
  if (c.type === 'read-schedule') {
    const key = c.correctActivity;
    if (!key) return null;
    const own = ownWord(key, [...scheduleChoices(c).filter(o => o !== key), c.instruction]);
    return { answer: key, alsoAccept: own ? [own, `the ${own}`] : [], acceptRule: SHORTER,
      signatureError: 'Another activity on the schedule or among the choices is wrong.' };
  }
  return null;
}

/** The journey's spoken answers: the key's own words, or another choice on screen. */
export function timeHarnessWords(c: TimeSequencerChallenge): { correct: string; plainWrong: string } {
  const key = timeKey(c);
  if (!key) throw new Error(`time-sequencer ${c.id}: a ${c.type} item has no spoken answer`);
  const other = (choices: readonly string[]) => {
    const wrong = choices.find(x => x && x.toLowerCase() !== key.answer.toLowerCase());
    if (!wrong) throw new Error(`time-sequencer ${c.id}: no wrong choice to say`);
    return wrong;
  };
  if (c.type === 'duration-compare') return { correct: key.answer, plainWrong: other(durationMenu(c).slice(0, 2).reverse()) };
  return { correct: key.answer, plainWrong: other(c.type === 'match-time-of-day' ? periodChoices(c)
    : c.type === 'before-after' ? optionLabels(c) : scheduleChoices(c)) };
}

/**
 * A spoken choice's known wrong answers, with the tap's ids (`timeSequencerMiss`, the card's lists), most specific
 * first. Each pattern names the answer and the wrong answer the learner gives.
 */
export function timeSpokenMisses(c: TimeSequencerChallenge): KnownMiss[] {
  if (c.type === 'match-time-of-day') {
    const key = PERIODS.indexOf(c.correctPeriod as Period);
    if (key < 0) return [];
    const near = [PERIODS[(key + 3) % 4], PERIODS[(key + 1) % 4]], far = PERIODS[(key + 2) % 4];
    const fact = `The answer is ${PERIODS[key]}.`;
    return [
      { id: 'next_period', pattern: `${fact} The learner's answer is ${near.join(' or ')}, a neighbouring part of the day.`, examples: near },
      { id: 'far_period', pattern: `${fact} The learner's answer is ${far}, the opposite part of the day.`, examples: [far] },
    ];
  }
  if (c.type === 'before-after') {
    const key = keyCard(c);
    if (!key) return [];
    const others = optionLabels(c).filter(l => l !== key.label), ref = c.referenceEvent?.label;
    return [{ id: 'other_event', pattern: `The answer is "${key.label}". The learner names another card`
      + `${others.length ? `: ${quoted(others)}` : ''}${ref ? ` (or "${ref}", the card the question is about)` : ''}.`,
    examples: [...others, ...(ref ? [ref] : [])] }];
  }
  if (c.type === 'duration-compare') {
    const a = c.eventA?.label, b = c.eventB?.label;
    if (!a || !b || !c.correctAnswer) return [];
    if (c.correctAnswer === 'same') return [{ id: 'missed_same', pattern: `"${a}" and "${b}" take about the same time, but `
      + 'the learner names one of them as taking longer.', examples: [a, b] }];
    const short = c.correctAnswer === 'A' ? b : a;
    return [
      { id: 'said_same', pattern: 'The learner says the two take about the same time, though one takes longer.', examples: ['the same', 'about the same'] },
      { id: 'shorter_one', pattern: `The learner names "${short}", the quicker one, as taking longer.`, examples: [short] },
    ];
  }
  if (c.type === 'read-schedule') {
    const key = c.correctActivity, rows = c.schedule ?? [];
    if (!key) return [];
    const at = rows.findIndex(r => r.time === c.targetTime);
    const said = scheduleChoices(c).filter(o => o !== key);
    const rowOf = (o: string) => rows.findIndex(r => r.activity === o);
    const next = said.filter(o => rowOf(o) >= 0 && at >= 0 && Math.abs(rowOf(o) - at) === 1);
    const other = said.filter(o => rowOf(o) >= 0 && !next.includes(o)), off = said.filter(o => rowOf(o) < 0);
    const fact = `The answer is "${key}", the activity at ${c.targetTime}.`;
    return [
      ...(next.length ? [{ id: 'next_row', pattern: `${fact} The learner's answer is ${quoted(next)}, the activity one row above or below.`, examples: next }] : []),
      ...(other.length ? [{ id: 'other_row', pattern: `${fact} The learner's answer is ${quoted(other)}, from another row of the schedule.`, examples: other }] : []),
      ...(off.length ? [{ id: 'not_on_schedule', pattern: `${fact} The learner's answer is ${quoted(off)}, a choice that is not on the schedule.`, examples: off }] : []),
    ];
  }
  return [];
}

export interface TimeView {
  /** Card ids in the order the learner tapped them (sequence-events, clock-sequence). */
  order: readonly string[];
  period: string | null;
  /** The before-after option card picked, by id. */
  picked: string | null;
  duration: 'A' | 'B' | 'same' | null;
  activity: string | null;
}

export const EMPTY_TIME_VIEW: TimeView = { order: [], period: null, picked: null, duration: null, activity: null };

const labelOf = (cards: readonly EventCard[] | undefined, id: string | null) => cards?.find(e => e.id === id)?.label ?? id ?? '';

/** The learner's work in their own terms, never the key. */
export function describeTimeWork(challenge: TimeSequencerChallenge, view: TimeView): string {
  switch (challenge.type) {
    case 'sequence-events':
    case 'clock-sequence': {
      if (!view.order.length) return 'No card placed yet';
      const left = (challenge.events?.length ?? 0) - view.order.length;
      return `Placed in order: ${view.order.map(id => labelOf(challenge.events, id)).join(', ')}`
        + (left > 0 ? `; ${left} card${left === 1 ? '' : 's'} not placed yet` : '');
    }
    case 'match-time-of-day': return view.period ? `Picked ${cap(view.period)}` : 'No time of day picked yet';
    case 'before-after': return view.picked ? `Picked ${labelOf(challenge.options, view.picked)}` : 'No card picked yet';
    case 'duration-compare':
      return view.duration === 'same' ? 'Chose: about the same'
        : view.duration ? `Chose ${(view.duration === 'A' ? challenge.eventA : challenge.eventB)?.label ?? view.duration} as taking longer`
          : 'No activity chosen yet';
    default: return view.activity ? `Picked "${view.activity}"` : 'No activity picked yet';
  }
}

function orderMiss(got: readonly string[], key: readonly string[]): TimeSequencerMiss | undefined {
  if (got.length !== key.length || got.every((id, i) => id === key[i])) return undefined;
  if (got.length > 1 && got.every((id, i) => id === key[key.length - 1 - i])) return 'reversed';
  if (got.filter((id, i) => id !== key[i]).length === 2) return 'swapped_pair';
  return got[0] !== key[0] ? 'wrong_first' : 'out_of_order';
}

/** What a wrong answer shows (`TeachingAttempt.miss`), from the work the check reads; the ids are the card's. */
export function timeSequencerMiss(challenge: TimeSequencerChallenge | null, view: TimeView): TimeSequencerMiss | undefined {
  if (!challenge) return undefined;
  switch (challenge.type) {
    case 'sequence-events':
    case 'clock-sequence':
      return orderMiss(view.order, challenge.correctOrder ?? []);
    case 'match-time-of-day': {
      const got = PERIODS.indexOf(view.period as Period), key = PERIODS.indexOf(challenge.correctPeriod as Period);
      if (got < 0 || key < 0 || got === key) return undefined;
      // The day is a cycle: night runs into morning.
      return (got - key + 4) % 4 === 2 ? 'far_period' : 'next_period';
    }
    case 'before-after':
      return view.picked && view.picked !== challenge.correctEvent ? 'other_event' : undefined;
    case 'duration-compare': {
      const got = view.duration, key = challenge.correctAnswer;
      if (!got || got === key) return undefined;
      if (got === 'same') return 'said_same';
      return key === 'same' ? 'missed_same' : 'shorter_one';
    }
    default: {
      const got = view.activity;
      if (!got || got === challenge.correctActivity) return undefined;
      const rows = challenge.schedule ?? [];
      const at = rows.findIndex(r => r.time === challenge.targetTime), picked = rows.findIndex(r => r.activity === got);
      if (picked < 0) return 'not_on_schedule';
      return at >= 0 && Math.abs(picked - at) === 1 ? 'next_row' : 'other_row';
    }
  }
}

// ── The scene ────────────────────────────────────────────────────────────────

const BEFORE = 'Before the learner has answered, and after a wrong answer, never say';
const OWN_DAY = 'Asking about the learner\'s own day (what do you do when you wake up? is it light or dark then?) is '
  + 'teaching; then stop and let the learner answer: never answer it for them or tie it to a choice (not "that is the '
  + 'morning", not "a cookie is quick").';
const NO_CLOCK = 'No clock time is printed at this grade: never say a time, a clock or a number.';

/**
 * This item's never-say rules and what teaching it is, from the old catalog guidance, by type. What the shared rules
 * already say is not repeated: reading the instruction and the card names aloud, ruling no choice out, confirming
 * nothing on a board before Check, doing nothing for the learner.
 */
function constraintsOf(c: TimeSequencerChallenge, preReader: boolean): string {
  const k = preReader ? ` ${NO_CLOCK}` : '';
  switch (c.type) {
    case 'sequence-events': return `${BEFORE} the order, or which card comes first or next. ${OWN_DAY}${k}`;
    case 'clock-sequence': return `${BEFORE} the order, or which card comes first or next. Each card's clock face is the `
      + 'task: ask where the short hand points, and never say the hour.';
    case 'match-time-of-day': return `${BEFORE} the time of day the activity happens in. ${OWN_DAY}${k}`;
    case 'before-after': return `${BEFORE} which card is the answer. ${OWN_DAY}${k}`;
    case 'duration-compare': return `${BEFORE} which activity takes longer, or whether they take about the same time. ${OWN_DAY}${k}`;
    default: return `${BEFORE} what happens at the asked time. Helping the learner find the asked time in the table and `
      + 'read across is teaching; never read the activity in that row out.';
  }
}

/** What is drawn and asked. Cards are listed alphabetically, never in the day's order; no answer is named. */
export function timeScene(challenge: TimeSequencerChallenge, view: TimeView, preReader = false): SceneOf {
  const drawn: Record<string, string | number> = {};
  if (isOrdering(challenge)) {
    drawn.cards = (challenge.events ?? []).map(e => e.label).sort((a, b) => a.localeCompare(b)).join(', ');
    if (challenge.showClockFace) drawn.clockFaces = 'each card shows an analog clock face at a whole hour beside its picture; '
      + 'the hours are not listed here';
    if (challenge.prelabelFirstSlot && (challenge.correctOrder?.length ?? 0) > 1) drawn.startHere = 'the first card of the day starts already placed';
  } else if (challenge.type === 'match-time-of-day') {
    drawn.activity = challenge.event?.label ?? '';
    drawn.choices = periodChoices(challenge).map(cap).join(', ');
  } else if (challenge.type === 'before-after') {
    drawn.referenceCard = challenge.referenceEvent?.label ?? '';
    drawn.relation = challenge.relation ?? '';
    drawn.options = optionLabels(challenge).join(', ');
  } else if (challenge.type === 'duration-compare') {
    drawn.cardA = challenge.eventA?.label ?? '';
    drawn.cardB = challenge.eventB?.label ?? '';
    drawn.choices = 'card A, card B, or About the Same';
  } else {
    drawn.scheduleRows = (challenge.schedule ?? []).length;
    drawn.targetTime = challenge.targetTime ?? '';
    drawn.schedule = 'a table of clock times and activities; the row at the asked time is highlighted';
    drawn.options = (challenge.activityOptions ?? (challenge.schedule ?? []).map(r => r.activity)).join(', ');
  }
  // Perception anchors on the cards, when the support tier shows them.
  if (challenge.showTimeAnchors && challenge.type !== 'match-time-of-day') drawn.timesPrinted = 'a typical clock time is printed on the cards';
  if (challenge.showSkyCue && challenge.type !== 'match-time-of-day') drawn.skyPicture = 'a sky strip on the cards shows the sun or moon at that time of day';
  if (challenge.showStrategyHint && challenge.strategyHint) drawn.strategyOnScreen = challenge.strategyHint;
  return {
    objects: [],
    facts: { kind: challenge.type, ...drawn, learnerWork: describeTimeWork(challenge, view),
      constraints: constraintsOf(challenge, preReader) },
  };
}
