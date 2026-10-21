/**
 * life-cycle-sequencer's boss (`components/live-activity/boss.ts`), bespoke because its one mode is a board the
 * activity checks: the card is `lifeCycleSequencer.card.ts`; this file validates a lesson, gives its one sequence,
 * asks it, carries the lever set and plays the harness.
 */
import type { LifeCycleSequencerData } from './LifeCycleSequencer';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { lifeCycleItem, tapPlaces, type CycleMiss, type LifeCycleItem } from './lifeCycleSequencerWorkspace';
import { LIFE_CYCLE_LEVERS, lifeCycleJourneyItem } from './lifeCycleSequencerLevers';
import { lifeCycleSequencerCard } from './lifeCycleSequencer.card';

/**
 * A sequence the activity's check can answer: titled, an instruction, 2+ uniquely-keyed labelled stages whose
 * positions are exactly 0..n-1. The payload is one sequence, not a challenge pool.
 */
export function validateLifeCycleSequencerData(value: unknown): LifeCycleSequencerData {
  const d = value as LifeCycleSequencerData;
  if (!d || typeof d.title !== 'string' || typeof d.instructions !== 'string' || !d.instructions.trim()
      || (d.cycleType !== 'linear' && d.cycleType !== 'circular') || !Array.isArray(d.stages) || d.stages.length < 2)
    throw new Error('Generated life cycle sequencer has invalid lesson content.');
  if (new Set(d.stages.map(s => s?.id)).size !== d.stages.length
      || d.stages.some(s => !s || typeof s.id !== 'string' || !s.id || typeof s.label !== 'string' || !s.label.trim())
      || ![...d.stages.map(s => s.correctPosition)].sort((a, b) => a - b).every((p, i) => p === i))
    throw new Error('The life cycle stages cannot be ordered as generated.');
  return d;
}

export const lifeCycleSequencerBoss = defineBoss<LifeCycleSequencerData, LifeCycleItem, CycleMiss>({
  card: lifeCycleSequencerCard,
  validate: validateLifeCycleSequencerData,
  items: d => [lifeCycleItem(d)],
  ask: c => c.instructions,
  // An order the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instructions, null),
  levers: LIFE_CYCLE_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/biology/LifeCycleSequencer.tsx',
    instanceId: 'cycle',
    defaults: { grade: 'Grade 1', mode: 'sequence', topic: 'The life cycle of a butterfly' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the practice sequence a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => lifeCycleJourneyItem(ctx.data as LifeCycleSequencerData, ctx.itemId) ?? undefined,
    // The one item through its real controls: at K-2 a tap on a picture places it in the next empty slot; older bands
    // tap the card, then its slot. Then Check Answer. A wrong order trades the first two stages (`adjacent_swap`).
    play: (right, c) => {
      const ordered = [...c.stages].sort((a, b) => a.correctPosition - b.correctPosition);
      const order = right ? ordered : [ordered[1], ordered[0], ...ordered.slice(2)];
      const card = (id: string): DriverInput => ({ type: 'touch', target: `card-${id}` });
      return [...order.flatMap((s, i): DriverInput[] => (tapPlaces(c) ? [card(s.id)]
        : [card(s.id), { type: 'touch', target: `slot-${i + 1}` }])), { type: 'check' }];
    },
  },
});
