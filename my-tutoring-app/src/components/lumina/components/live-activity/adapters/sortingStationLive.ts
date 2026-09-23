import type { SortingStationData } from '../../../primitives/visual-primitives/math/SortingStation';
import { askFor, itemsFromChallenges } from '../../../primitives/visual-primitives/math/sortingStationScript';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CHALLENGE_TYPES = ['sort-by-one', 'sort-by-attribute', 'count-and-compare',
  'two-attributes', 'odd-one-out', 'tally-record', 'sort-variety'];

/** The session's items, built exactly as the component builds them. */
const sortingItems = (d: SortingStationData) =>
  itemsFromChallenges(d.challenges as any[], { tier: d.supportTier, isPreReader: (d.gradeBand ?? 'K') === 'K' });

/** Reject a set of trays whose challenges cannot be ASKED before they reach a five-year-old. */
export function validateSortingStationData(value: unknown): SortingStationData {
  const d = value as SortingStationData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id
        || !CHALLENGE_TYPES.includes(c.type) || !Array.isArray(c.objects) || !c.objects.length))
    throw new Error('Generated sorting station has invalid lesson content.');
  // `itemsFromChallenges` DROPS anything unaskable rather than repairing it, so
  // an empty build means this lesson would mount with nothing to ask.
  if (!sortingItems(d).length) throw new Error('A sorting-station challenge cannot run in the lesson.');
  return d;
}

/** What the live adapter needs from the sorting station; the catalog's `teachingWorkspace` declares the rest. */
export const sortingStationLiveDomain: WorkspaceDomain<SortingStationData> = {
  validate: validateSortingStationData,
  initialState: d => { const items = sortingItems(d); return workspaceOpening({ title: d.title, task: askFor(items[0]), total: items.length }); },
};
