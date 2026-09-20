import type { SortingStationData } from '../../../primitives/visual-primitives/math/SortingStation';
import { itemsFromChallenges, sortingStationPackBase }
  from '../../../primitives/visual-primitives/math/sortingStationScript';
import { RUNNER_GUIDANCE, runnerLessonStart, type LiveActivityAdapter } from './adapterContract';

export const SORTING_STATION_LIVE_MODES = ['sort_one', 'sort_attribute', 'sort_variety',
  'count_compare', 'odd_one_out', 'two_attributes', 'tally_record'] as const;

const CHALLENGE_TYPES = ['sort-by-one', 'sort-by-attribute', 'count-and-compare',
  'two-attributes', 'odd-one-out', 'tally-record', 'sort-variety'];

const sortingItems = (d: SortingStationData) =>
  itemsFromChallenges(d.challenges as any[], { band: d.gradeBand ?? 'K', tier: d.supportTier ?? 'easy' } as any);

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
  if (!sortingItems(d).length) throw new Error('A sorting-station challenge cannot run in the DI lesson.');
  return d;
}

function sortingStationState(data: SortingStationData) {
  const items = sortingItems(data);
  return { ...data, ...sortingStationPackBase(items).contextFor(items[0]),
    teachingOwner: 'sorting-station-di', totalChallenges: items.length };
}

export const sortingStationLive: LiveActivityAdapter<SortingStationData> = {
  teachingOwner: 'di-runner',
  modes: SORTING_STATION_LIVE_MODES,
  canAdvance: false,
  grades: ['Kindergarten', 'Grade 1'],
  copy: {
    label: 'Sorting Station', checkbox: 'Sorting station', title: 'Learn with the Sorting Station',
    lessons: [['sort_one', 'Sort into groups'], ['sort_attribute', 'Find the sorting rule'],
      ['sort_variety', 'Sort a mixed set'], ['count_compare', 'Count and compare groups'],
      ['odd_one_out', 'Find the odd one out'], ['two_attributes', 'Match two things at once'],
      ['tally_record', 'Record what you sorted']],
  },
  lessonStart: runnerLessonStart('sorting-station'),
  guidance: RUNNER_GUIDANCE + ' Every ask here is answered OUT LOUD; nothing is dragged. Replay asks the same '
    + 'question again without sorting, moving, counting or revealing anything, and a reminder is TEXT only. '
    + 'This family has no worked example: the example surface draws identical counters, which have no attribute '
    + 'to sort by, so do not offer or describe one. On a count or compare ask the tray badges are the answer and '
    + 'stay hidden — never read a count off the screen.',
  validate: validateSortingStationData,
  initialState: sortingStationState,
};
