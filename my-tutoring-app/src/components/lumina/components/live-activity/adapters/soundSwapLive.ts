import type { SoundSwapData } from '../../../primitives/visual-primitives/literacy/SoundSwap';
import { swapAssignment } from '../../../primitives/visual-primitives/literacy/soundSwapWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** The sound each operation names; the ask cannot be judged without it. */
const namesItsSound = (c: SoundSwapData['challenges'][number]) =>
  c.operation === 'addition' ? !!c.addPhoneme
    : c.operation === 'deletion' ? !!c.deletePhoneme
      : c.operation === 'substitution' ? !!c.oldPhoneme && !!c.newPhoneme : false;

/** Reject a challenge the stage cannot ask: a starting word with its sounds, the named sound and a result word. */
export const validateSoundSwapData = (value: unknown): SoundSwapData => validateChallengePool<SoundSwapData>(value,
  c => !!c && typeof c.originalWord === 'string' && !!c.originalWord.trim() && Array.isArray(c.originalPhonemes)
    && c.originalPhonemes.length > 0 && typeof c.resultWord === 'string' && !!c.resultWord.trim() && namesItsSound(c),
  { pool: 'Generated sound swap has invalid lesson content.', item: 'A sound-swap challenge cannot be asked.' });

/** What the live adapter needs from sound swap; the catalog's `teachingWorkspace` declares the rest. */
export const soundSwapLiveDomain: WorkspaceDomain<SoundSwapData> = {
  validate: validateSoundSwapData,
  initialState: data => workspaceOpening({ title: data.title, task: swapAssignment(data.challenges[0]).task,
    total: data.challenges.length }),
};
