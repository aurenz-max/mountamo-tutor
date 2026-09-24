import type { PhonemeExplorerData } from '../../../primitives/visual-primitives/literacy/PhonemeExplorer';
import { itemFromChallenge, itemsFromChallenges } from '../../../primitives/visual-primitives/literacy/phonemeExplorerScript';
import { phonemeAssignment } from '../../../primitives/visual-primitives/literacy/phonemeExplorerWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject an item the pack would drop: an unsayable blend walk, the answer inside the operation prose, an example
 *  word sitting in the menu. */
export const validatePhonemeExplorerData = (value: unknown): PhonemeExplorerData =>
  validateChallengePool<PhonemeExplorerData>(value, c => !!c && itemFromChallenge(c) !== null,
    { pool: 'Generated phoneme explorer has invalid lesson content.', item: 'A phoneme explorer item cannot be asked.' });

/** What the live adapter needs from the explorer; the catalog's `teachingWorkspace` declares the rest. */
export const phonemeExplorerLiveDomain: WorkspaceDomain<PhonemeExplorerData> = {
  validate: validatePhonemeExplorerData,
  initialState: data => {
    const items = itemsFromChallenges(data.challenges);
    return workspaceOpening({ title: data.title, task: phonemeAssignment(items[0]).task, total: items.length });
  },
};
