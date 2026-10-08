import type { SyllableClapperData } from '../../../primitives/visual-primitives/literacy/SyllableClapper';
import { itemFromChallenge, itemsFromChallenges } from '../../../primitives/visual-primitives/literacy/syllableClapperScript';
import { syllableAssignment } from '../../../primitives/visual-primitives/literacy/syllableClapperWorkspace';
import { letterAssignment, letterItemsFrom } from '../../../primitives/visual-primitives/literacy/letterBuild';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a word the pack would drop (unsayable, a split that does not spell it, a variable count) or ask twice. */
export function validateSyllableClapperData(value: unknown): SyllableClapperData {
  const b = value as SyllableClapperData;
  if (b?.task === 'letter_build') {
    // The open build (build_parts): every syllable ask must pass the surface's own gate.
    if (typeof b.title !== 'string' || !Array.isArray(b.buildItems) || !b.buildItems.length || b.buildItems.length > 12
        || b.buildItems.some(i => i?.kind !== 'syllables') || letterItemsFrom(b.buildItems, b.supportTier).length !== b.buildItems.length)
      throw new Error('Generated syllable clapper has invalid lesson content.');
    return b;
  }
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
    if (data.task === 'letter_build') return workspaceOpening({ title: data.title,
      task: letterAssignment(letterItemsFrom(data.buildItems ?? [], data.supportTier)[0]).task, total: data.buildItems?.length ?? 0 });
    const items = itemsFromChallenges(data.challenges);
    return workspaceOpening({ title: data.title, task: syllableAssignment(items[0]).task, total: items.length });
  },
};
