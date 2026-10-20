/**
 * Periodic table's boss, on the spoken preset (`components/live-activity/boss.ts`): Name It and Trends are spoken
 * answers the tutor judges against the key; an Element Hunt has no key (the activity checks the tap, and the tutor is
 * never told where the box is), so it plays through `show`. The card is `periodicTable.card.ts`; this file holds the
 * content check, the items, the ask and key, the levers and the harness play. A payload with no askable challenge is
 * the ungraded exploration table, which no workspace session binds.
 */
import type { PeriodicTableData as Data } from '../types';
import { spokenBoss } from '../components/live-activity/boss';
import { periodicTableCard, type PeriodicMiss, type SpokenPeriodicMiss } from './periodicTable.card';
import { PERIODIC_LEVERS, periodicPracticeItem, periodicPracticeParent } from './chemistry-primitives/periodicTableLevers';
import {
  askFor, itemsFromChallenges, periodicHarnessAnswers, periodicKey, periodicSpokenMisses,
  type PeriodicChallengeLike, type PeriodicTableItem, type PeriodicTier,
} from './chemistry-primitives/periodicTableDomain';

/** The lesson's data, as the boss reads it: a judged table always has a title. */
type PeriodicTableData = Data & { title: string };

/** The session's items, built through the family's own gates (an unaskable item, or one on an element an earlier item
 *  used, is dropped). */
export const periodicItems = (data: { challenges?: PeriodicChallengeLike[]; supportTier?: PeriodicTier }): PeriodicTableItem[] =>
  itemsFromChallenges(data.challenges ?? [], data.supportTier ?? 'medium');

/** Reject a lesson with nothing askable: an exploration payload (no challenges) stays the free table, and the build
 *  gates drop an unresolved element, a position ask without a group, and a compare pair the ear cannot split. */
export function validatePeriodicTableData(value: unknown): PeriodicTableData {
  const d = value as Data;
  if (!d || !Array.isArray(d.challenges)) throw new Error('Generated periodic table has no judged challenges.');
  if (!periodicItems(d as never).length) throw new Error('No periodic table question can be asked.');
  // The title is optional on the lesson type: an untitled table is named for what it is.
  return { ...d, title: d.title || 'Periodic Table' };
}

export const periodicTableBoss = spokenBoss<PeriodicTableData, PeriodicTableItem, PeriodicMiss | SpokenPeriodicMiss>({
  card: periodicTableCard,
  validate: validatePeriodicTableData,
  items: periodicItems,
  levers: PERIODIC_LEVERS,
  speech: {
    ask: askFor,
    // An Element Hunt has no key: the activity checks the tap.
    key: periodicKey,
    misses: periodicSpokenMisses,
    say: periodicHarnessAnswers,
    // A tap on a box, by element name: the right box, or the box beside it.
    show: (right, item) => {
      const { tapped } = periodicHarnessAnswers(item);
      return [{ type: 'touch', target: `element-${(right ? tapped!.correct : tapped!.wrong).toLowerCase()}` }];
    },
  },
  drive: {
    component: 'primitives/PeriodicTable.tsx',
    instanceId: 'periodic-table',
    defaults: { grade: 'Grade 8', mode: 'explore', topic: 'Organization of the periodic table' },
    mounted: '[data-pip-object^="element-"]',
    // The session item, or a practice item (`~simpler`) rebuilt from its parent.
    current: ctx => {
      const items = periodicItems(ctx.data as never);
      const parent = periodicPracticeParent(ctx.itemId, items);
      return parent ? periodicPracticeItem(parent, items) ?? undefined : items.find(i => i.id === ctx.itemId);
    },
  },
});
