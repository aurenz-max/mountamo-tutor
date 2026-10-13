/**
 * Time sequencer on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md).
 *
 * Pure: the component and any probe read the same assignment and scene. A tap is checked by the activity's own
 * check. A one-choice challenge (a time of day, the card before or after, which takes longer, the activity at a
 * schedule time) may also be said aloud: the item is spoken with `acceptsGesture`, and JEV judges it from the
 * tutor's feedback against `expectedAnswer` (VB-1, 2026-10-13). An order (sequence-events, clock-sequence) is
 * several answers at once: it stays tap-only, and the tutor is never handed `correctOrder` or the clock hours.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { EventCard, TimeSequencerChallenge } from './TimeSequencer';

export const PERIODS = ['morning', 'afternoon', 'evening', 'night'] as const;
export type Period = typeof PERIODS[number];

export function workspaceAssignment(challenge: TimeSequencerChallenge): TeachingAssignment {
  const expectedAnswer = timeExpectedAnswer(challenge);
  if (!expectedAnswer) return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
  return { id: challenge.id, task: `${challenge.instruction} The learner answers by saying it, or tapping one choice and `
    + 'pressing Check.', response: 'speech', acceptsGesture: true, expectedAnswer, misses: timeSpokenMisses(challenge) };
}

const SHORT_STOP = new Set(['the', 'a', 'an', 'your', 'my', 'our', 'to', 'at', 'in', 'of', 'on', 'and', 'up', 'out',
  'with', 'for', 'some', 'back', 'from', 'into', 'off']);
const contentWords = (s: string) => s.toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/)
  .filter(w => w.length > 2 && !SHORT_STOP.has(w));
/** A word of a label that no other named label has, for a short way of saying it ("Board the big yellow bus": "bus"). */
function ownWord(label: string, others: readonly string[]): string | undefined {
  const taken = new Set(others.flatMap(contentWords));
  return contentWords(label).reverse().find(w => !taken.has(w));
}
const quoted = (labels: readonly string[]) => labels.map(l => `"${l}"`).join(', ');
const sayAs = (label: string, others: readonly string[]) => {
  const own = ownWord(label, others);
  return `said as "${label}" or a shorter way of saying the same activity${own ? ` (such as "${own}" or "the ${own}")` : ''}`;
};

/** The one answer a spoken choice is judged against, with the natural ways a learner says it; none for an order. */
export function timeExpectedAnswer(c: TimeSequencerChallenge): string | undefined {
  if (c.type === 'match-time-of-day') {
    const p = c.correctPeriod;
    if (!p) return undefined;
    const night = p === 'night' ? ', "at night" or "nighttime"' : '';
    return `${cap(p)} ("${c.event?.label ?? 'the activity'}" happens in the ${p}); said as "${p}", "in the ${p}"${night} `
      + `or in a sentence such as "I do it in the ${p}". Any other time of day is not it.`;
  }
  if (c.type === 'before-after') {
    const key = c.options?.find(o => o.id === c.correctEvent);
    if (!key) return undefined;
    const others = (c.options ?? []).filter(o => o.id !== key.id).map(o => o.label), ref = c.referenceEvent?.label ?? '';
    return `the card "${key.label}" (it happens ${c.relation} "${ref}"); ${sayAs(key.label, [...others, ref])}. `
      + `Another card${others.length ? ` (${quoted(others)})` : ''}${ref ? ` or "${ref}" itself` : ''} is not it.`;
  }
  if (c.type === 'duration-compare') {
    const a = c.eventA?.label, b = c.eventB?.label;
    if (!a || !b || !c.correctAnswer) return undefined;
    if (c.correctAnswer === 'same') return `about the same ("${a}" and "${b}" take about the same time); said as "the same", `
      + '"about the same", "same time" or "they take the same". Naming either one as taking longer is not it.';
    const [long, short] = c.correctAnswer === 'A' ? [a, b] : [b, a];
    const which = c.correctAnswer === 'A' ? 'the first one' : 'the second one';
    // Two content words where the label has them ("A whole school day": "school day"); one word reads too thin.
    const short2 = contentWords(long).slice(-2).join(' ') || long;
    return `"${long}" (it takes longer than "${short}"); said as "${long}", a shorter way of saying the same activity `
      + `(such as "${short2}" or "the ${short2}"), or "${which}". "${short}", or "about the same", is not it.`;
  }
  if (c.type === 'read-schedule') {
    const key = c.correctActivity;
    if (!key) return undefined;
    const others = Array.from(new Set([...(c.activityOptions ?? []), ...(c.schedule ?? []).map(r => r.activity)])).filter(o => o !== key);
    return `"${key}", the activity in the row at ${c.targetTime}; ${sayAs(key, others)}. Another activity on the schedule `
      + 'or among the choices is not it.';
  }
  return undefined;
}

/**
 * A spoken choice's known wrong answers, with the tap's ids (`timeSequencerMiss`, the catalog's lists), most specific
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
    const key = c.options?.find(o => o.id === c.correctEvent);
    if (!key) return [];
    const others = (c.options ?? []).filter(o => o.id !== key.id).map(o => o.label), ref = c.referenceEvent?.label;
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
    const said = Array.from(new Set([...(c.activityOptions ?? []), ...rows.map(r => r.activity)])).filter(o => o !== key);
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

/** What a spoken mode's answer is, which the scene withholds until the learner answers. */
const WITHHELD: Partial<Record<TimeSequencerChallenge['type'], string>> = {
  'match-time-of-day': 'the time of day the activity happens in',
  'before-after': 'which card is the answer',
  'duration-compare': 'which activity takes longer, or whether they take about the same time',
  'read-schedule': 'the activity at the asked time',
};

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

const isOrdering = (c: TimeSequencerChallenge) => c.type === 'sequence-events' || c.type === 'clock-sequence';
const labelOf = (cards: readonly EventCard[] | undefined, id: string | null) => cards?.find(e => e.id === id)?.label ?? id ?? '';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the work the check reads. Only the
 * observable pattern:
 * - ordering: `reversed` (the whole day backwards), `swapped_pair` (exactly two cards trade places),
 *   `wrong_first` (the day starts on the wrong card), `out_of_order`;
 * - time of day: `next_period` (a neighbouring part of the day: the catalog's afternoon/evening boundary),
 *   `far_period` (the opposite part of the day);
 * - before-after: `other_event`;
 * - duration: `said_same` (one is longer, the learner said the same), `missed_same`, `shorter_one`;
 * - schedule: `next_row` (the activity one row above or below the time), `other_row`, `not_on_schedule`.
 */
export type TimeSequencerMiss = 'reversed' | 'swapped_pair' | 'wrong_first' | 'out_of_order'
  | 'next_period' | 'far_period' | 'other_event'
  | 'said_same' | 'missed_same' | 'shorter_one'
  | 'next_row' | 'other_row' | 'not_on_schedule';

function orderMiss(got: readonly string[], key: readonly string[]): TimeSequencerMiss | undefined {
  if (got.length !== key.length || got.every((id, i) => id === key[i])) return undefined;
  if (got.length > 1 && got.every((id, i) => id === key[key.length - 1 - i])) return 'reversed';
  if (got.filter((id, i) => id !== key[i]).length === 2) return 'swapped_pair';
  return got[0] !== key[0] ? 'wrong_first' : 'out_of_order';
}

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

/** What is drawn and asked. Cards are listed alphabetically, never in the day's order; no answer is named. */
export function workspaceScene(challenge: TimeSequencerChallenge, view: TimeView): WorkspaceScene {
  const drawn: Record<string, string | number> = {};
  if (isOrdering(challenge)) {
    drawn.cards = (challenge.events ?? []).map(e => e.label).sort((a, b) => a.localeCompare(b)).join(', ');
    drawn.howToAnswer = 'tap the cards in the order they happen in the day; tapping a placed card takes it back out; '
      + 'press Check once every card is placed';
    if (challenge.showClockFace) drawn.clockFaces = 'each card shows an analog clock face at a whole hour beside its picture; '
      + 'the hours are not listed here: ask the learner where the short hand points';
    if (challenge.prelabelFirstSlot && (challenge.correctOrder?.length ?? 0) > 1) drawn.startHere = 'the first card of the day starts already placed';
  } else if (challenge.type === 'match-time-of-day') {
    drawn.activity = challenge.event?.label ?? '';
    drawn.choices = (challenge.periodChoices ?? PERIODS).map(cap).join(', ');
  } else if (challenge.type === 'before-after') {
    drawn.referenceCard = challenge.referenceEvent?.label ?? '';
    drawn.relation = challenge.relation ?? '';
    drawn.options = (challenge.options ?? []).map(e => e.label).join(', ');
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
    facts: {
      kind: challenge.type, ...drawn,
      learnerWork: describeTimeWork(challenge, view),
      constraints: isOrdering(challenge)
        ? 'The learner answers on the screen: taps the cards in order and presses Check; the activity checks the work '
          + 'itself. You cannot tap or order cards for the learner.'
        : 'The learner says the answer or taps one choice, then presses Check; a tap is checked by the activity. Before '
          + `the learner has answered, never name ${WITHHELD[challenge.type] ?? 'the answer'}. You cannot tap for the learner.`,
    },
  };
}
