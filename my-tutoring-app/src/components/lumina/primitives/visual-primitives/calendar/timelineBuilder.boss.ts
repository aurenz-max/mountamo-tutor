/**
 * timeline-builder's boss (`components/live-activity/boss.ts`), bespoke because every mode is a board the activity
 * checks: the card is `timelineBuilder.card.ts`; this file validates a lesson, lists its timelines, asks one, carries
 * the lever set and plays the harness.
 */
import type { TimelineBuilderChallenge, TimelineBuilderData } from './TimelineBuilder';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { TIMELINE_LEVERS, practiceParentId, practiceTimeline } from './timelineBuilderLevers';
import { timelineBuilderCard, type TimelineMiss } from './timelineBuilder.card';

const TYPES = ['daily', 'yearly', 'historical'];

/** A challenge the activity's check can answer: 2+ labelled events whose positions are exactly 0..n-1. */
const answerable = (c: TimelineBuilderChallenge) => !!c && typeof c.id === 'string' && !!c.id && TYPES.includes(c.type)
  && typeof c.instruction === 'string' && !!c.instruction.trim() && Array.isArray(c.events) && c.events.length >= 2
  && new Set(c.events.map(e => e?.id)).size === c.events.length
  && c.events.every(e => e && typeof e.label === 'string' && !!e.label.trim())
  && [...c.events.map(e => e.correctPosition)].sort((a, b) => a - b).every((p, i) => p === i);

/** Reject a timeline-builder lesson whose challenges cannot be ordered. */
export function validateTimelineBuilderData(value: unknown): TimelineBuilderData {
  const d = value as TimelineBuilderData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated timeline builder has invalid lesson content.');
  for (const c of d.challenges)
    if (!answerable(c)) throw new Error('A timeline-builder challenge cannot be ordered as generated.');
  return d;
}

export const timelineBuilderBoss = defineBoss<TimelineBuilderData, TimelineBuilderChallenge, TimelineMiss>({
  card: timelineBuilderCard,
  validate: validateTimelineBuilderData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // An order the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: TIMELINE_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/calendar/TimelineBuilder.tsx',
    instanceId: 'timeline',
    defaults: { grade: 'Grade 2', mode: 'sequence-daily', topic: 'Ordering the events of a school day' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the practice timeline a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const all = (ctx.data as TimelineBuilderData).challenges ?? [];
      const parentId = practiceParentId(ctx.itemId);
      const parent = parentId ? all.find(c => c.id === parentId) : undefined;
      return parent ? practiceTimeline(parent, all) ?? undefined : all.find(c => c.id === ctx.itemId);
    },
    // Every mode through its real controls: tap an event in the bank, tap its slot, then Check Order. A wrong order
    // trades the first two events (`adjacent_swap`), every slot still filled.
    play: (right, c) => {
      const ordered = [...c.events].sort((a, b) => a.correctPosition - b.correctPosition);
      const order = right ? ordered : [ordered[1], ordered[0], ...ordered.slice(2)];
      return [...order.flatMap((e, i): DriverInput[] => [{ type: 'choose', label: e.label }, { type: 'choose', label: `Slot ${i + 1}` }]),
        { type: 'check' }];
    },
  },
});
