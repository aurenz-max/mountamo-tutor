/**
 * tower-stacker's boss (`components/live-activity/boss.ts`), bespoke because every mode is an open build the
 * activity tests: the card is `towerStacker.card.ts`; this file validates a session, lists its towers, asks one,
 * carries the lever set and plays the harness.
 */
import type { TowerStackerData } from './TowerStacker';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { towerStackerCard } from './towerStacker.card';
import { TOWER_LEVERS, practiceParent, shorterTower } from './towerLevers';
import {
  MAX_HEIGHT, TOWER_MODES, referenceWindproof, towerHarnessInputs, windLimit, type TowerChallenge, type TowerMiss,
} from './towerWorkspace';

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

export const towerStackerBoss = defineBoss<TowerStackerData, TowerChallenge, TowerMiss>({
  card: towerStackerCard,
  validate: validateTowerStackerData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A build the activity tests: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: TOWER_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/engineering/TowerStacker.tsx',
    instanceId: 'tower',
    defaults: { grade: 'Grade 3', mode: 'build_windproof', topic: 'Building towers that stay up' },
    mounted: '[data-pip-object="workspace"]',
    // The session tower, or the easier practice tower (`~shorter`) rebuilt from its parent.
    current: ctx => {
      const all = (ctx.data as TowerStackerData).challenges ?? [];
      const parent = practiceParent(String(ctx.itemId ?? ''));
      const full = all.find(c => c.id === (parent ?? ctx.itemId));
      return parent && full ? shorterTower(full) ?? undefined : full;
    },
    // Clear a kept build, drop a tower that passes (flat beams; on build_few beams stood on end) and press I'm done!.
    // Wrong: a block column one short of the line, and on windproof a block column to the line the wind blows over.
    play: (right, c, ctx) => towerHarnessInputs(c, !right, ctx.demand),
  },
});
