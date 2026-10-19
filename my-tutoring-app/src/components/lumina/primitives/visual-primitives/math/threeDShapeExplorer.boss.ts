/**
 * 3d-shape-explorer's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one spoken answer
 * the tutor judges against its key. The card is `threeDShapeExplorer.card.ts`; this file holds the content check, the
 * items, the ask and key, the levers and the harness play.
 */
import type { ThreeDShapeExplorerData } from './ThreeDShapeExplorer';
import { spokenBoss } from '../../../components/live-activity/boss';
import { threeDShapeExplorerCard } from './threeDShapeExplorer.card';
import { THREE_D_SHAPE_LEVERS, simplerFromId } from './threeDShapeExplorerLevers';
import {
  askFor, buildThreeDShapeItems, threeDShapeExplorerHarnessAnswers, threeDShapeKey, threeDShapeSpokenMisses,
  type SpokenSolidMiss, type ThreeDShapeItem,
} from './threeDShapeExplorerDomain';

/** The session's items: one spoken answer each, a compound challenge fanned out (unaskable ones dropped). */
export const threeDShapeItems = (d: ThreeDShapeExplorerData): ThreeDShapeItem[] => buildThreeDShapeItems(d.challenges ?? []).items;

/** Reject a lab the build would drop whole: no challenges, or none its truth-table gates can ask. A challenge the
 *  gates drop is dropped, as it always was; the lab runs if anything is left to ask. */
export function validateThreeDShapeExplorerData(value: unknown): ThreeDShapeExplorerData {
  const d = value as ThreeDShapeExplorerData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length)
    throw new Error('Generated 3D shape explorer has invalid lesson content.');
  if (!threeDShapeItems(d).length) throw new Error('No 3D shape challenge can be asked.');
  return d;
}

export const threeDShapeExplorerBoss = spokenBoss<ThreeDShapeExplorerData, ThreeDShapeItem, SpokenSolidMiss>({
  card: threeDShapeExplorerCard,
  validate: validateThreeDShapeExplorerData,
  items: threeDShapeItems,
  levers: THREE_D_SHAPE_LEVERS,
  speech: {
    ask: askFor,
    key: threeDShapeKey,
    misses: threeDShapeSpokenMisses,
    say: threeDShapeExplorerHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/math/ThreeDShapeExplorer.tsx',
    instanceId: 'solids',
    defaults: { grade: 'Kindergarten', mode: 'identify_3d', topic: 'Naming solid shapes: cube, sphere, cylinder, cone' },
    mounted: '[data-pip-object="stimulus"]',
    // The session item, or a practice item (`~simpler`, threeDShapeExplorerLevers.ts) rebuilt from its parent.
    current: ctx => {
      const items = threeDShapeItems(ctx.data as ThreeDShapeExplorerData);
      return items.find(i => i.id === ctx.itemId) ?? simplerFromId(ctx.itemId ?? '', items) ?? undefined;
    },
  },
});
