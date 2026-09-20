import type { CompareObjectsData } from '../../../primitives/visual-primitives/math/CompareObjects';
import { buildCompareItems, compareObjectsPackBase }
  from '../../../primitives/visual-primitives/math/compareObjectsScript';
import { RUNNER_GUIDANCE, runnerLessonStart, type LiveActivityAdapter } from './adapterContract';

export const COMPARE_OBJECTS_LIVE_MODES = ['identify_attribute', 'compare_two',
  'order_three', 'non_standard'] as const;

const compareItems = (d: CompareObjectsData) =>
  buildCompareItems(d.challenges as any[], { band: d.gradeBand ?? 'K' } as any).items;

/** Reject a comparison whose challenges cannot be ASKED before they reach a five-year-old. */
export function validateCompareObjectsData(value: unknown): CompareObjectsData {
  const d = value as CompareObjectsData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? 'K')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated comparison has invalid lesson content.');
  // `buildCompareItems` DROPS anything unaskable rather than repairing it, so an
  // empty build means this lesson would mount with nothing to ask.
  if (!compareItems(d).length) throw new Error('A compare-objects challenge cannot run in the DI lesson.');
  return d;
}

function compareObjectsState(data: CompareObjectsData) {
  const items = compareItems(data);
  return { ...data, ...compareObjectsPackBase(items).contextFor(items[0]),
    teachingOwner: 'compare-objects-di', totalChallenges: items.length };
}

export const compareObjectsLive: LiveActivityAdapter<CompareObjectsData> = {
  teachingOwner: 'di-runner',
  modes: COMPARE_OBJECTS_LIVE_MODES,
  canAdvance: false,
  grades: ['Kindergarten', 'Grade 1'],
  copy: {
    label: 'Compare Objects', checkbox: 'Compare objects', title: 'Learn to Compare Objects',
    lessons: [['compare_two', 'Which one is longer'], ['identify_attribute', 'What are we measuring'],
      ['order_three', 'Put them in order'], ['non_standard', 'Measure with units']],
  },
  lessonStart: runnerLessonStart('compare-objects'),
  guidance: RUNNER_GUIDANCE + ' Replay asks the same comparison again without moving, lining up or measuring '
    + 'anything, and a reminder is TEXT only. This family has no worked example: the example surface states '
    + 'HOW MANY, and every mode here compares a continuous attribute, so do not offer or describe one.',
  validate: validateCompareObjectsData,
  initialState: compareObjectsState,
};
