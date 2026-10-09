import type { EventCard, TimeSequencerChallenge, TimeSequencerData } from '../../../primitives/visual-primitives/math/TimeSequencer';
import { PERIODS } from '../../../primitives/visual-primitives/math/timeSequencerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

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

/** What the live adapter needs from the time sequencer; the catalog's `teachingWorkspace` declares the rest. */
export const timeSequencerLiveDomain: WorkspaceDomain<TimeSequencerData> = {
  validate: validateTimeSequencerData,
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges[0].instruction, total: d.challenges.length }),
};
