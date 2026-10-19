/**
 * era-explorer's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one spoken pick from
 * three choices the ask names, judged by the tutor against its key. The card is `eraExplorer.card.ts`; this file holds
 * the content check, the items, the ask and key, the levers and the harness play.
 */
import type { EraExplorerData } from './EraExplorer';
import { spokenBoss } from '../../../components/live-activity/boss';
import { eraExplorerCard } from './eraExplorer.card';
import { ERA_LEVERS, eraLeverSession, practiceItem, practiceParent } from './eraExplorerLevers';
import {
  askFor, eraExplorerHarnessAnswers, eraItems, eraKey, eraSpokenMisses,
  type EraExplorerItem, type SpokenEraMiss,
} from './eraExplorerDomain';

/** Reject a lesson with nothing askable: the build gates drop a statement that names its own answer or copies
 *  a card, a menu the ear cannot tell apart, and a cause that restates the change. */
export function validateEraExplorerData(value: unknown): EraExplorerData {
  const d = value as EraExplorerData;
  if (!d || !Array.isArray(d.challenges)) throw new Error('Generated era explorer has invalid lesson content.');
  if (!eraItems(d).length) throw new Error('No era explorer question can be asked.');
  return d;
}

export const eraExplorerBoss = spokenBoss<EraExplorerData, EraExplorerItem, SpokenEraMiss>({
  card: eraExplorerCard,
  validate: validateEraExplorerData,
  items: eraItems,
  levers: ERA_LEVERS,
  speech: {
    ask: askFor,
    key: eraKey,
    misses: eraSpokenMisses,
    say: eraExplorerHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/history/EraExplorer.tsx',
    instanceId: 'era-explorer',
    defaults: { grade: 'Grade 2', mode: 'era_sort', topic: 'Life in pioneer times' },
    mounted: '[data-pip-object="stimulus"]',
    // The session item, or a practice item (`~simpler`, eraExplorerLevers.ts) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as EraExplorerData;
      const all = eraItems(data);
      const parent = ctx.itemId ? practiceParent(ctx.itemId, all) : null;
      return parent ? practiceItem(parent, eraLeverSession(all, data)) ?? undefined : all.find(i => i.id === ctx.itemId);
    },
  },
});
