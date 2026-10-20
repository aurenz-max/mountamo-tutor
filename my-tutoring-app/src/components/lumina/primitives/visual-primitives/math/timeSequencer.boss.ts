/**
 * time-sequencer's boss, on the spoken preset (`components/live-activity/boss.ts`): time-of-day, before-after,
 * duration-compare and read-schedule are said (the tutor judges the words against the key) or tapped and checked (the
 * activity checks it), SAY_OR_SHOW items; the orders (sequence-3, sequence-5, clock-sequence) have no key, the activity
 * checks the board, and they play through `show`. The card is `timeSequencer.card.ts`; this file holds the content
 * check, the items, the ask and key, the levers and the harness play.
 */
import type { EventCard, TimeSequencerChallenge, TimeSequencerData } from './TimeSequencer';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { timeSequencerCard, type TimeSequencerMiss } from './timeSequencer.card';
import { TIME_LEVERS, practiceItem, practiceParent } from './timeSequencerLevers';
import { PERIODS, timeAsk, timeHarnessWords, timeItems, timeKey, timeModeOf, timeSpokenMisses } from './timeSequencerWorkspace';

const CHALLENGE_TYPES = ['sequence-events', 'clock-sequence', 'match-time-of-day', 'before-after', 'duration-compare', 'read-schedule'];
const card = (e: EventCard | undefined) => !!e && typeof e.id === 'string' && !!e.id && typeof e.label === 'string' && !!e.label.trim();
/** Cards a learner tells apart by name: distinct ids and labels. */
const cardsOk = (cards: EventCard[] | undefined, min: number) => Array.isArray(cards) && cards.length >= min && cards.every(card)
  && new Set(cards.map(e => e.id)).size === cards.length && new Set(cards.map(e => e.label.trim())).size === cards.length;

/** Whether the challenge carries the material its own check reads. */
function answerable(c: TimeSequencerChallenge): boolean {
  switch (c.type) {
    case 'sequence-events':
    case 'clock-sequence': {
      const ids = (c.events ?? []).map(e => e.id), order = c.correctOrder ?? [];
      return cardsOk(c.events, 2) && order.length === ids.length && new Set(order).size === order.length && order.every(id => ids.includes(id))
        && (c.type !== 'clock-sequence' || (c.events ?? []).every(e => Number.isInteger(e.clockHour)));
    }
    case 'match-time-of-day': return card(c.event) && (PERIODS as readonly string[]).includes(c.correctPeriod ?? '');
    case 'before-after':
      return card(c.referenceEvent) && (c.relation === 'before' || c.relation === 'after') && cardsOk(c.options, 2)
        && (c.options ?? []).some(e => e.id === c.correctEvent);
    case 'duration-compare':
      return card(c.eventA) && card(c.eventB) && c.eventA!.label.trim() !== c.eventB!.label.trim() && ['A', 'B', 'same'].includes(c.correctAnswer ?? '');
    default: {
      const options = c.activityOptions ?? (c.schedule ?? []).map(r => r.activity);
      return Array.isArray(c.schedule) && c.schedule.length >= 2 && !!c.targetTime && !!c.correctActivity
        && new Set(options).size === options.length && options.includes(c.correctActivity);
    }
  }
}

/** Reject a time-sequencer lesson whose challenges cannot be attempted. */
export function validateTimeSequencerData(value: unknown): TimeSequencerData {
  const d = value as TimeSequencerData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated time sequencer has invalid lesson content.');
  for (const c of d.challenges)
    if (!answerable(c)) throw new Error(`A time-sequencer ${c.type} challenge cannot be answered as generated.`);
  return d;
}

const check: DriverInput = { type: 'check' };

export const timeSequencerBoss = spokenBoss<TimeSequencerData, TimeSequencerChallenge, TimeSequencerMiss>({
  card: timeSequencerCard,
  validate: validateTimeSequencerData,
  items: timeItems,
  levers: TIME_LEVERS,
  speech: {
    ask: timeAsk,
    // The orders have no key: the activity checks the board.
    key: timeKey,
    misses: timeSpokenMisses,
    say: timeHarnessWords,
    modeOf: timeModeOf,
    // An order through its real cards (named by their `aria-label`), then Check. The start-here card is already placed
    // (and placed again after Try again): tapping it would take it out. A wrong order is the rest reversed.
    show: (right, c) => {
      const order = c.correctOrder ?? [];
      const rest = c.prelabelFirstSlot && order.length > 1 ? order.slice(1) : order;
      if (!right && rest.length < 2) throw new Error(`time-sequencer ${c.type}: one card left to place has no wrong order`);
      const label = (id: string) => c.events?.find(e => e.id === id)?.label ?? id;
      return [...(right ? rest : [...rest].reverse()).map((id): DriverInput => ({ type: 'choose', label: label(id) })), check];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/math/TimeSequencer.tsx',
    instanceId: 'times',
    defaults: { grade: 'Kindergarten', mode: 'sequence-3', topic: 'Daily routines and the order of the day' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice item a simplify lever opened (`~smaller`), rebuilt from its parent.
    current: ctx => {
      const items = timeItems(ctx.data as TimeSequencerData);
      const parent = practiceParent(ctx.itemId, items);
      return parent ? practiceItem(parent) ?? undefined : items.find(c => c.id === ctx.itemId);
    },
  },
});
