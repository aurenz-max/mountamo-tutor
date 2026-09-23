import type { DiWordReadingData } from '../../../primitives/visual-primitives/direct-instruction/DiWordReading';
import { askFor, buildWordReadingItems, wordReadingChallengeValid }
  from '../../../primitives/visual-primitives/direct-instruction/diWordReadingDomain';
import { type WorkspaceDomain, validateChallengePool } from './adapterContract';

/** Reject a pool whose items cannot be ASKED before they reach a five-year-old. */
export const validateDiWordReadingData = (value: unknown) =>
  validateChallengePool<DiWordReadingData>(value, wordReadingChallengeValid, {
    pool: 'Generated word reading has invalid lesson content.',
    item: 'A word-reading item cannot run in the teaching workspace.' });

function diWordReadingState(data: DiWordReadingData) {
  const items = buildWordReadingItems(data.challenges);
  return { title: data.title, instruction: askFor(items[0]), teachingOwner: 'tutor',
    totalChallenges: items.length,
    interaction: 'Teach from liveRuntime.task and its workspace. The child reads the printed word out loud; '
      + 'judge what you hear and say so naturally. The host records your completed feedback and handles retry '
      + 'and advance.' };
}

/** What the live adapter needs from this family; the catalog's `teachingWorkspace` declares the rest. */
export const diWordReadingLiveDomain: WorkspaceDomain<DiWordReadingData> = { validate: validateDiWordReadingData, initialState: diWordReadingState };

