import type { GearTrainBuilderData } from '../../../primitives/visual-primitives/engineering/GearTrainBuilder';
import { GEAR_MODES, MAX_GEARS, TEETH, gearMiss, referenceTrain, workspaceAssignment } from '../../../primitives/visual-primitives/engineering/gearWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

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

/** What the live adapter needs from the gear session; the catalog's `teachingWorkspace` declares the rest. */
export const gearTrainBuilderLiveDomain: WorkspaceDomain<GearTrainBuilderData> = {
  validate: validateGearTrainBuilderData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
