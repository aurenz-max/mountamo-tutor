import type { DiLetterSoundsData } from '../../../primitives/visual-primitives/direct-instruction/DiLetterSounds';
import { askFor, buildLetterSoundItems, letterSoundChallengeValid, DI_LETTER_SOUNDS_MAX_ITEMS }
  from '../../../primitives/visual-primitives/direct-instruction/diLetterSoundsDomain';
import { type WorkspaceDomain, validateChallengePool } from './adapterContract';

/** Reject a pool whose items cannot be ASKED before they reach a five-year-old. */
export const validateDiLetterSoundsData = (value: unknown) =>
  validateChallengePool<DiLetterSoundsData>(value, letterSoundChallengeValid, {
    pool: 'Generated letter sounds has invalid lesson content.',
    item: 'A letter-sound item cannot run in the teaching workspace.' }, DI_LETTER_SOUNDS_MAX_ITEMS);

function diLetterSoundsState(data: DiLetterSoundsData) {
  const items = buildLetterSoundItems(data.challenges);
  return { title: data.title, instruction: askFor(items[0]), teachingOwner: 'tutor',
    totalChallenges: items.length,
    interaction: 'Teach from liveRuntime.task and its workspace. The child answers out loud; judge what you '
      + 'hear and say so naturally. The host records your completed feedback and handles retry and advance.' };
}

/** What the live adapter needs from this family; the catalog's `teachingWorkspace` declares the rest. */
export const diLetterSoundsLiveDomain: WorkspaceDomain<DiLetterSoundsData> = { validate: validateDiLetterSoundsData, initialState: diLetterSoundsState };

