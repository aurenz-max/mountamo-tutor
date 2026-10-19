/**
 * Sorting station's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one spoken answer
 * the tutor judges against its key. The card is `sortingStation.card.ts`; this file holds the content check, the
 * items, the ask and key, the levers and the harness play.
 */
import type { SortingStationData } from './SortingStation';
import { spokenBoss } from '../../../components/live-activity/boss';
import { sortingStationCard } from './sortingStation.card';
import { SORTING_LEVERS, simplerFromParent } from './sortingStationLevers';
import {
  askFor, itemsFromChallenges, sortingStationGiven, sortingStationHarnessAnswers, sortingStationKey, sortingStationSpokenMisses,
  type SortingChallengeLike, type SortingStationItem, type SortingStationMode, type SpokenSortingMiss,
} from './sortingStationDomain';

const CHALLENGE_TYPES: readonly SortingStationMode[] = ['sort-by-one', 'sort-by-attribute', 'count-and-compare',
  'two-attributes', 'odd-one-out', 'tally-record', 'sort-variety'];

/** The session's items, built from the generated challenges. */
export const sortingStationItems = (d: SortingStationData): SortingStationItem[] =>
  itemsFromChallenges(d.challenges as SortingChallengeLike[], { tier: d.supportTier, isPreReader: (d.gradeBand ?? 'K') === 'K' });

/** Reject a set of trays whose challenges cannot be ASKED before they reach a five-year-old. */
export function validateSortingStationData(value: unknown): SortingStationData {
  const d = value as SortingStationData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id
        || !CHALLENGE_TYPES.includes(c.type) || !Array.isArray(c.objects) || !c.objects.length))
    throw new Error('Generated sorting station has invalid lesson content.');
  // `itemsFromChallenges` DROPS anything unaskable rather than repairing it, so an empty build means this lesson
  // would mount with nothing to ask.
  if (!sortingStationItems(d).length) throw new Error('A sorting-station challenge cannot run in the lesson.');
  return d;
}

export const sortingStationBoss = spokenBoss<SortingStationData, SortingStationItem, SpokenSortingMiss>({
  card: sortingStationCard,
  validate: validateSortingStationData,
  items: sortingStationItems,
  levers: SORTING_LEVERS,
  speech: {
    ask: askFor,
    key: sortingStationKey,
    given: sortingStationGiven,
    misses: sortingStationSpokenMisses,
    say: sortingStationHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/math/SortingStation.tsx',
    instanceId: 'station',
    defaults: { grade: 'Kindergarten', mode: 'sort_one', topic: 'Sorting objects into groups by one attribute' },
    mounted: '[data-station-page]',
    // The session item, or an easier item (`~simpler`, sortingStationLevers.ts) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as SortingStationData, items = sortingStationItems(data);
      const found = items.find(i => i.id === ctx.itemId);
      if (found) return found;
      const parent = items.find(i => `${i.id}~simpler` === ctx.itemId);
      return parent ? simplerFromParent(parent, data.challenges.find(c => c.id === parent.challengeId) ?? null) ?? undefined : undefined;
    },
  },
});
