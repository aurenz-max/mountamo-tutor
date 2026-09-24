import type { WordSorterData } from '../../../primitives/visual-primitives/literacy/WordSorter';
import { itemsFromChallenge, itemsFromChallenges } from '../../../primitives/visual-primitives/literacy/wordSorterScript';
import { wordSorterAssignment } from '../../../primitives/visual-primitives/literacy/wordSorterWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const buildOptions = (d: WordSorterData) => ({ tier: d.supportTier, isPreReader: (d.gradeLevel ?? 'K') === 'K' });

/** Reject a challenge the pack would drop entirely: labels a child cannot say back, a word with no defensible group. */
export function validateWordSorterData(value: unknown): WordSorterData {
  const d = value as WordSorterData;
  return validateChallengePool<WordSorterData>(value, c => !!c && itemsFromChallenge(c, buildOptions(d)).length > 0,
    { pool: 'Generated word sorter has invalid lesson content.', item: 'A word sorter challenge cannot be asked.' });
}

/** What the live adapter needs from the sorter; the catalog's `teachingWorkspace` declares the rest. */
export const wordSorterLiveDomain: WorkspaceDomain<WordSorterData> = {
  validate: validateWordSorterData,
  initialState: data => {
    const items = itemsFromChallenges(data.challenges, buildOptions(data));
    return workspaceOpening({ title: data.title, task: wordSorterAssignment(items[0]).task, total: items.length });
  },
};
