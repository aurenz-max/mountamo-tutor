/**
 * matter-explorer's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one spoken answer
 * the tutor judges against its key. The card is `matterExplorer.card.ts`; this file holds the content check, the
 * items, the ask and key, the levers and the harness play.
 */
import type { MatterExplorerData } from './MatterExplorer';
import { spokenBoss } from '../../../components/live-activity/boss';
import { matterExplorerCard } from './matterExplorer.card';
import { MATTER_LEVERS, matterLeverSession, practiceItem, practiceParent } from './matterExplorerLevers';
import {
  askFor, itemsFromChallenges, matterExplorerHarnessAnswers, matterKey, matterSpokenMisses,
  type MatterExplorerItem, type SpokenMatterMiss,
} from './matterExplorerDomain';

/** The session's items, one per object, built exactly as the component builds them. */
export function matterItems(data: MatterExplorerData): MatterExplorerItem[] {
  return itemsFromChallenges(
    (data.challenges ?? []).map(c => ({ id: c.id, challengeType: c.type, objectId: c.objectId })),
    data.objects ?? [],
    { band: data.gradeBand === '1-2' ? '1-2' : 'K-1', tier: data.supportTier },
  );
}

/** Reject a lesson with nothing askable: the build gates drop an object whose name carries its state, a change that
 *  does not fit its object, a mystery with no safe clue. A payload with no challenges is the ungraded exploration
 *  shelf, which the workspace does not run. */
export function validateMatterExplorerData(value: unknown): MatterExplorerData {
  const d = value as MatterExplorerData;
  if (!d || !Array.isArray(d.objects) || !Array.isArray(d.challenges))
    throw new Error('Generated matter explorer has invalid lesson content.');
  if (!matterItems(d).length) throw new Error('No matter explorer challenge can be asked.');
  return d;
}

export const matterExplorerBoss = spokenBoss<MatterExplorerData, MatterExplorerItem, SpokenMatterMiss>({
  card: matterExplorerCard,
  validate: validateMatterExplorerData,
  items: matterItems,
  levers: MATTER_LEVERS,
  speech: {
    ask: askFor,
    key: matterKey,
    misses: matterSpokenMisses,
    say: matterExplorerHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/chemistry/MatterExplorer.tsx',
    instanceId: 'matter',
    defaults: { grade: 'Kindergarten', mode: 'sort', topic: 'Solids, liquids and gases around us' },
    mounted: '[data-pip-object="stimulus"]',
    // The session item, or a practice item (`~simpler`, matterExplorerLevers.ts) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as MatterExplorerData;
      const all = matterItems(data);
      const parent = ctx.itemId ? practiceParent(ctx.itemId, all) : null;
      return parent ? practiceItem(parent, matterLeverSession(data)) ?? undefined : all.find(i => i.id === ctx.itemId);
    },
  },
});
