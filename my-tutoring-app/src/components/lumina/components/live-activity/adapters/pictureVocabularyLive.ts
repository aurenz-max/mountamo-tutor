import type { PictureVocabularyData } from '../../../primitives/visual-primitives/literacy/PictureVocabulary';
import { itemFromChallenge, itemsFromChallenges } from '../../../primitives/visual-primitives/literacy/pictureVocabularyScript';
import { pictureVocabAssignment } from '../../../primitives/visual-primitives/literacy/pictureVocabularyWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject an item the pack would drop: cards without the target, a pair whose sides match, a scale whose blank is
 *  not the answer, a frame with no blank or one that speaks its own answer. */
export const validatePictureVocabularyData = (value: unknown): PictureVocabularyData =>
  validateChallengePool<PictureVocabularyData>(value, c => !!c && itemFromChallenge(c) !== null,
    { pool: 'Generated picture vocabulary has invalid lesson content.', item: 'A picture vocabulary item cannot be asked.' });

/** What the live adapter needs from picture vocabulary; the catalog's `teachingWorkspace` declares the rest. */
export const pictureVocabularyLiveDomain: WorkspaceDomain<PictureVocabularyData> = {
  validate: validatePictureVocabularyData,
  initialState: data => {
    const items = itemsFromChallenges(data.challenges);
    return workspaceOpening({ title: data.title, task: pictureVocabAssignment(items[0]).task, total: items.length });
  },
};
