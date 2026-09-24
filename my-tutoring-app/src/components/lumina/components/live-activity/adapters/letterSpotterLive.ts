import type { LetterSpotterData } from '../../../primitives/visual-primitives/literacy/LetterSpotter';
import { itemFromChallenge, itemsFromChallenges } from '../../../primitives/visual-primitives/literacy/letterSpotterScript';
import { letterSpotterAssignment } from '../../../primitives/visual-primitives/literacy/letterSpotterWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject an item the pack would drop: a grid without exactly one target, options without the answer, a sentence
 *  whose marked word is unsayable or starts with a digraph. */
export function validateLetterSpotterData(value: unknown): LetterSpotterData {
  const d = value as LetterSpotterData;
  const tier = d?.supportTier ?? 'medium';
  return validateChallengePool<LetterSpotterData>(value, c => !!c && itemFromChallenge(c, tier) !== null,
    { pool: 'Generated letter spotter has invalid lesson content.', item: 'A letter spotter item cannot be asked.' });
}

/** What the live adapter needs from the spotter; the catalog's `teachingWorkspace` declares the rest. */
export const letterSpotterLiveDomain: WorkspaceDomain<LetterSpotterData> = {
  validate: validateLetterSpotterData,
  initialState: data => {
    const items = itemsFromChallenges(data.challenges, data.supportTier ?? 'medium');
    return workspaceOpening({ title: data.title, task: letterSpotterAssignment(items[0]).task, total: items.length });
  },
};
