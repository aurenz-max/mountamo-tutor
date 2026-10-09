/**
 * Time sequencer on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md).
 *
 * Pure: the component and any probe read the same assignment and scene. Every challenge is answered on the
 * screen (cards tapped in order, or one choice) and checked by the activity's own check, so the tutor is never
 * handed `correctOrder`, `correctPeriod`, `correctEvent`, `correctAnswer` or `correctActivity`.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { EventCard, TimeSequencerChallenge } from './TimeSequencer';

export const PERIODS = ['morning', 'afternoon', 'evening', 'night'] as const;
export type Period = typeof PERIODS[number];

export function workspaceAssignment(challenge: TimeSequencerChallenge): TeachingAssignment {
  return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
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
      constraints: 'The learner answers on the screen: taps the cards in order, or taps one choice, and presses Check; '
        + 'the activity checks the work itself. You cannot tap or order cards for the learner.',
    },
  };
}
