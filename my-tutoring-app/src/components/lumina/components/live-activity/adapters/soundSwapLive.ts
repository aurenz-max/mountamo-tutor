import type { SoundSwapData } from '../../../primitives/visual-primitives/literacy/SoundSwap';
import { swapAssignment } from '../../../primitives/visual-primitives/literacy/soundSwapWorkspace';
import { letterAssignment, letterItemsFrom } from '../../../primitives/visual-primitives/literacy/letterBuild';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** The sound each operation names; the ask cannot be judged without it. */
const namesItsSound = (c: SoundSwapData['challenges'][number]) =>
  c.operation === 'addition' ? !!c.addPhoneme
    : c.operation === 'deletion' ? !!c.deletePhoneme
      : c.operation === 'substitution' ? !!c.oldPhoneme && !!c.newPhoneme : false;

/** The open build (swap_build): every ask must pass the surface's own gate. */
function validateLetterBuild(d: SoundSwapData): SoundSwapData {
  if (typeof d.title !== 'string' || !Array.isArray(d.buildItems) || !d.buildItems.length || d.buildItems.length > 12
      || letterItemsFrom(d.buildItems, d.supportTier).length !== d.buildItems.length)
    throw new Error('Generated sound swap has invalid lesson content.');
  return d;
}

/** Reject a challenge the stage cannot ask: a starting word with its sounds, the named sound and a result word. */
export const validateSoundSwapData = (value: unknown): SoundSwapData => (value as SoundSwapData)?.task === 'letter_build'
  ? validateLetterBuild(value as SoundSwapData) : validateChallengePool<SoundSwapData>(value,
  c => !!c && typeof c.originalWord === 'string' && !!c.originalWord.trim() && Array.isArray(c.originalPhonemes)
    && c.originalPhonemes.length > 0 && typeof c.resultWord === 'string' && !!c.resultWord.trim() && namesItsSound(c),
  { pool: 'Generated sound swap has invalid lesson content.', item: 'A sound-swap challenge cannot be asked.' });

/** What the live adapter needs from sound swap; the catalog's `teachingWorkspace` declares the rest. */
export const soundSwapLiveDomain: WorkspaceDomain<SoundSwapData> = {
  validate: validateSoundSwapData,
  initialState: data => data.task === 'letter_build'
    ? workspaceOpening({ title: data.title, task: letterAssignment(letterItemsFrom(data.buildItems ?? [], data.supportTier)[0]).task,
      total: data.buildItems?.length ?? 0 })
    : workspaceOpening({ title: data.title, task: swapAssignment(data.challenges[0]).task, total: data.challenges.length }),
};
