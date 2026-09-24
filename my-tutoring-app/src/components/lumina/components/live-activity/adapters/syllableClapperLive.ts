import type { SyllableClapperData } from '../../../primitives/visual-primitives/literacy/SyllableClapper';
import { itemFromChallenge, itemsFromChallenges } from '../../../primitives/visual-primitives/literacy/syllableClapperScript';
import { syllableAssignment } from '../../../primitives/visual-primitives/literacy/syllableClapperWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a word the pack would drop (unsayable, a split that does not spell it, a variable count) or ask twice. */
export function validateSyllableClapperData(value: unknown): SyllableClapperData {
  const d = validateChallengePool<SyllableClapperData>(value, c => !!c && itemFromChallenge(c) !== null,
    { pool: 'Generated syllable clapper has invalid lesson content.', item: 'A syllable clapper word cannot be asked.' });
  if (itemsFromChallenges(d.challenges).length !== d.challenges.length)
    throw new Error('A syllable clapper word is asked twice.');
  return d;
}

/** What the live adapter needs from the clapper; the catalog's `teachingWorkspace` declares the rest. */
export const syllableClapperLiveDomain: WorkspaceDomain<SyllableClapperData> = {
  validate: validateSyllableClapperData,
  initialState: data => {
    const items = itemsFromChallenges(data.challenges);
    return workspaceOpening({ title: data.title, task: syllableAssignment(items[0]).task, total: items.length });
  },
};
