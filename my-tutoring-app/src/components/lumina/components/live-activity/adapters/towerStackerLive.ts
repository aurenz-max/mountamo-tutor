import type { TowerStackerData } from '../../../primitives/visual-primitives/engineering/TowerStacker';
import { TOWER_MODES, windLimit, referenceWindproof, MAX_HEIGHT, workspaceAssignment } from '../../../primitives/visual-primitives/engineering/towerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a tower session that cannot be attempted: no towers, an unknown mode, a line above the building area, a
 * build_few cap below the fewest pieces that reach the line, or a windproof wind the wide reference tower cannot stand.
 */
export function validateTowerStackerData(value: unknown): TowerStackerData {
  const d = value as TowerStackerData;
  const items = d?.challenges;
  if (!d || !Array.isArray(items) || !items.length || items.length > 8 || new Set(items.map(c => c?.id)).size !== items.length)
    throw new Error('Generated tower session has no towers to build.');
  for (const c of items) {
    if (!(TOWER_MODES as readonly string[]).includes(c?.type) || !Number.isInteger(c.targetHeight) || c.targetHeight < 2
        || c.targetHeight > MAX_HEIGHT || typeof c.instruction !== 'string')
      throw new Error(`A generated tower (${c?.id}) is not a buildable target.`);
    if (c.type === 'build_few' && !(Number(c.maxPieces) >= Math.ceil(c.targetHeight / 4)))
      throw new Error(`Tower ${c.id} allows too few pieces to reach its line.`);
    if (c.type === 'build_windproof' && !(Number(c.wind) > 0 && windLimit(referenceWindproof(c.targetHeight)) >= Number(c.wind)))
      throw new Error(`Tower ${c.id} has a wind no tower in the tray can stand.`);
  }
  return d;
}

/** What the live adapter needs from the tower session; the catalog's `teachingWorkspace` declares the rest. */
export const towerStackerLiveDomain: WorkspaceDomain<TowerStackerData> = {
  validate: validateTowerStackerData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
