import type { RhymeStudioData } from '../../../primitives/visual-primitives/literacy/RhymeStudio';
import { itemFromChallenge, itemsFromChallenge } from '../../../primitives/visual-primitives/literacy/rhymeStudioScript';
import { rhymeAssignment } from '../../../primitives/visual-primitives/literacy/rhymeStudioWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const MODES = ['recognition', 'identification', 'production', 'collection'];

/** Reject an item that cannot be asked: a target word, a comparison and a verdict to judge on recognition,
 *  and at least two choices with one that rhymes on identification. */
export const validateRhymeStudioData = (value: unknown): RhymeStudioData => validateChallengePool<RhymeStudioData>(value,
  c => {
    if (!c || !MODES.includes(c.mode) || typeof c.targetWord !== 'string' || !c.targetWord.trim()
      || typeof c.rhymeFamily !== 'string' || !c.rhymeFamily.trim()) return false;
    if (c.mode === 'recognition') return typeof c.comparisonWord === 'string' && !!c.comparisonWord.trim()
      && typeof c.doesRhyme === 'boolean';
    if (c.mode === 'identification') {
      const item = itemFromChallenge(c);
      return item.choices.length >= 2 && !!item.answer;
    }
    return true;
  },
  { pool: 'Generated rhyme studio has invalid lesson content.', item: 'A rhyme studio item cannot be asked.' });

/** What the live adapter needs from the rhyme studio; the catalog's `teachingWorkspace` declares the rest. */
export const rhymeStudioLiveDomain: WorkspaceDomain<RhymeStudioData> = {
  validate: validateRhymeStudioData,
  initialState: data => {
    const items = data.challenges.flatMap(c => itemsFromChallenge(c, data.supportTier ?? 'medium'));
    return workspaceOpening({ title: data.title, task: rhymeAssignment(items[0]).task, total: items.length });
  },
};
