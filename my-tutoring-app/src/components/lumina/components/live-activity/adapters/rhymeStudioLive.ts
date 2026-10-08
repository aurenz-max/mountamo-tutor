import type { RhymeStudioData } from '../../../primitives/visual-primitives/literacy/RhymeStudio';
import { itemFromChallenge, itemsFromChallenge } from '../../../primitives/visual-primitives/literacy/rhymeStudioScript';
import { rhymeAssignment } from '../../../primitives/visual-primitives/literacy/rhymeStudioWorkspace';
import { pairAssignment, pairItemsFrom } from '../../../primitives/visual-primitives/literacy/rhymePairBuild';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const MODES = ['recognition', 'identification', 'production', 'collection'];

/** The open build (pair_build): every board must pass the surface's own gate. */
function validatePairBuild(d: RhymeStudioData): RhymeStudioData {
  if (typeof d.title !== 'string' || !Array.isArray(d.pairItems) || !d.pairItems.length || d.pairItems.length > 12
      || pairItemsFrom(d.pairItems, d.supportTier).length !== d.pairItems.length)
    throw new Error('Generated rhyme studio has invalid lesson content.');
  return d;
}

/** Reject an item that cannot be asked: a target word, a comparison and a verdict to judge on recognition,
 *  and at least two choices with one that rhymes on identification. */
export const validateRhymeStudioData = (value: unknown): RhymeStudioData => (value as RhymeStudioData)?.task === 'pair_build'
  ? validatePairBuild(value as RhymeStudioData) : validateChallengePool<RhymeStudioData>(value,
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
    if (data.task === 'pair_build') return workspaceOpening({ title: data.title,
      task: pairAssignment(pairItemsFrom(data.pairItems ?? [], data.supportTier)[0]).task, total: data.pairItems?.length ?? 0 });
    const items = data.challenges.flatMap(c => itemsFromChallenge(c, data.supportTier ?? 'medium'));
    return workspaceOpening({ title: data.title, task: rhymeAssignment(items[0]).task, total: items.length });
  },
};
