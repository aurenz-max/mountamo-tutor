/**
 * gear-train-builder's boss (`components/live-activity/boss.ts`), bespoke because every mode is an open build the
 * activity tests: the card is `gearTrainBuilder.card.ts`; this file validates a session, lists its trains, asks one,
 * carries the lever set and plays the harness.
 */
import type { GearTrainBuilderData } from './GearTrainBuilder';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { gearTrainBuilderCard } from './gearTrainBuilder.card';
import { GEAR_LEVERS, practiceParent, simplerTrain } from './gearLevers';
import {
  GEAR_MODES, MAX_GEARS, TEETH, gearHarnessInputs, gearMiss, referenceTrain, type GearChallenge, type GearMiss,
} from './gearWorkspace';

/**
 * Reject a gear session that cannot be attempted: no trains, an unknown mode, or a target no train from the tray
 * makes on the track (checked by building the reference train and judging it).
 */
export function validateGearTrainBuilderData(value: unknown): GearTrainBuilderData {
  const d = value as GearTrainBuilderData;
  const items = d?.challenges;
  if (!d || !Array.isArray(items) || !items.length || items.length > 8 || new Set(items.map(c => c?.id)).size !== items.length)
    throw new Error('Generated gear session has no trains to build.');
  for (const c of items) {
    if (!(GEAR_MODES as readonly string[]).includes(c?.type) || typeof c.instruction !== 'string' || !(c.minGears >= 2))
      throw new Error(`A generated gear train (${c?.id}) is not a buildable target.`);
    const ref = referenceTrain(c);
    if (ref.length > MAX_GEARS || ref.some(t => !TEETH.includes(t)) || gearMiss(c, ref.map((teeth, i) => ({ id: `r${i}`, teeth }))))
      throw new Error(`Gear train ${c.id} cannot be built from the tray on the track.`);
  }
  return d;
}

export const gearTrainBuilderBoss = defineBoss<GearTrainBuilderData, GearChallenge, GearMiss>({
  card: gearTrainBuilderCard,
  validate: validateGearTrainBuilderData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A build the activity tests: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: GEAR_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/engineering/GearTrainBuilder.tsx',
    instanceId: 'gears',
    defaults: { grade: 'Grade 4', mode: 'build_ratio', topic: 'Gears in clocks and bicycles' },
    mounted: '[data-pip-object="workspace"]',
    // The session train, or the easier practice train (`~simpler`) rebuilt from its parent.
    current: ctx => {
      const all = (ctx.data as GearTrainBuilderData).challenges ?? [];
      const parent = practiceParent(String(ctx.itemId ?? ''));
      const full = all.find(c => c.id === (parent ?? ctx.itemId));
      return parent && full ? simplerTrain(full) ?? undefined : full;
    },
    // Clear a kept train, add a train that passes and press I'm done!. Wrong: one gear more where a way is asked
    // (the last gear turns the other way), else the first and last gear swapped (the speed turned round).
    play: (right, c, ctx) => gearHarnessInputs(c, !right, ctx.demand),
  },
});
