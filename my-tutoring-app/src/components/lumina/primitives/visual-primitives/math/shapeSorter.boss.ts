/**
 * Shape sorter's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one spoken answer
 * the tutor judges against its key. The card is `shapeSorter.card.ts`; this file holds the content check, the
 * items, the ask and key, the levers and the harness play.
 */
import type { ShapeSorterData } from './ShapeSorter';
import { spokenBoss } from '../../../components/live-activity/boss';
import { shapeSorterCard } from './shapeSorter.card';
import { SHAPE_SORTER_LEVERS, simplerFromId } from './shapeSorterLevers';
import {
  SHAPE_PROPERTIES, itemsFromChallenges, shapeSorterAsk, shapeSorterHarnessAnswers, shapeSorterKey, shapeSorterSpokenMisses,
  type ShapeSorterChallengeType, type ShapeSorterItem, type ShapeSorterShapeLike, type SpokenShapeMiss,
} from './shapeSorterDomain';
import { realWorldShapeObjectById } from '../shared/realWorldShapeObjects';

const VALID_TYPES: readonly ShapeSorterChallengeType[] = ['identify', 'identify-real-object', 'count', 'sort'];

export const shapeSorterItems = (d: ShapeSorterData): ShapeSorterItem[] =>
  itemsFromChallenges(d.challenges, { isPreReader: (d.gradeBand ?? 'K') === 'K' });

/** The shapes an item draws: its practice shape, or its challenge's pool. */
export const shapesOf = (d: ShapeSorterData, item: ShapeSorterItem): readonly ShapeSorterShapeLike[] =>
  item.practiceShapes ?? d.challenges.find(c => c.id === item.challengeId)?.shapes ?? [];

/** Reject a pool whose challenges cannot be ASKED before they reach a five-year-old. */
export function validateShapeSorterData(value: unknown): ShapeSorterData {
  const d = value as ShapeSorterData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? 'K')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || !VALID_TYPES.includes(c.type) || !Array.isArray(c.shapes) || !c.shapes.length
        || c.shapes.some(s => !s || !Object.hasOwn(SHAPE_PROPERTIES, s.shape) || !['small', 'medium', 'large'].includes(s.size)
          || typeof s.color !== 'string' || !Number.isFinite(s.rotation) || s.emoji
          || (c.type === 'identify-real-object'
            ? (!s.realObjectId || !realWorldShapeObjectById(s.realObjectId))
            : (!!s.realObjectId || !!s.realObject)))))
    throw new Error('Generated shape sorter has invalid lesson content.');
  // `itemsFromChallenges` DROPS anything unaskable rather than repairing it, so an empty build means this lesson
  // would mount with nothing to ask.
  if (!shapeSorterItems(d).length) throw new Error('A shape-sorter challenge cannot run in the naming workspace.');
  return d;
}

export const shapeSorterBoss = spokenBoss<ShapeSorterData, ShapeSorterItem, SpokenShapeMiss>({
  card: shapeSorterCard,
  validate: validateShapeSorterData,
  items: shapeSorterItems,
  levers: SHAPE_SORTER_LEVERS,
  speech: {
    ask: shapeSorterAsk,
    key: shapeSorterKey,
    misses: shapeSorterSpokenMisses,
    say: shapeSorterHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/math/ShapeSorter.tsx',
    instanceId: 'shapes',
    defaults: { grade: 'Kindergarten', mode: 'identify', topic: 'Naming flat shapes by their sides and corners' },
    mounted: '[data-assignment-target="true"]',
    probes: { demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' } },
    // The session item, or a practice item (`~simpler`, shapeSorterLevers.ts) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as ShapeSorterData, items = shapeSorterItems(data);
      return items.find(i => i.id === ctx.itemId) ?? simplerFromId(ctx.itemId ?? '', items, item => shapesOf(data, item))?.item;
    },
  },
});
