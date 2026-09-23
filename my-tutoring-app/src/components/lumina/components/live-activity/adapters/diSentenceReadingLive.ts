import type { DiSentenceReadingData } from '../../../primitives/visual-primitives/direct-instruction/DiSentenceReading';
import { askFor, buildSentenceReadingItems, sentenceReadingChallengeValid }
  from '../../../primitives/visual-primitives/direct-instruction/diSentenceReadingDomain';
import { type WorkspaceDomain, validateChallengePool } from './adapterContract';

/** Reject a pool whose items cannot be ASKED before they reach a five-year-old. */
export const validateDiSentenceReadingData = (value: unknown) =>
  validateChallengePool<DiSentenceReadingData>(value, sentenceReadingChallengeValid, {
    pool: 'Generated sentence reading has invalid lesson content.',
    item: 'A sentence-reading item cannot run in the teaching workspace.' });

function diSentenceReadingState(data: DiSentenceReadingData) {
  const items = buildSentenceReadingItems(data.challenges);
  return { title: data.title, instruction: askFor(), teachingOwner: 'tutor',
    totalChallenges: items.length,
    interaction: 'Teach from liveRuntime.task and its workspace. The child reads the printed sentence out loud; '
      + 'judge what you hear and say so naturally. The host records your completed feedback and handles retry '
      + 'and advance.' };
}

/** What the live adapter needs from this family; the catalog's `teachingWorkspace` declares the rest. */
export const diSentenceReadingLiveDomain: WorkspaceDomain<DiSentenceReadingData> = { validate: validateDiSentenceReadingData, initialState: diSentenceReadingState };

