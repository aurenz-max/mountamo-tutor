import type { PictureVocabularyData } from '../../../primitives/visual-primitives/literacy/PictureVocabulary';
import { itemFromChallenge, itemsFromChallenges } from '../../../primitives/visual-primitives/literacy/pictureVocabularyScript';
import { pictureVocabAssignment } from '../../../primitives/visual-primitives/literacy/pictureVocabularyWorkspace';
import { picturePairAssignment, picturePairItemsFrom } from '../../../primitives/visual-primitives/literacy/picturePairBuild';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** The open build (pair_build): every board must pass the pair surface's own gate. */
function validatePairBuild(d: PictureVocabularyData): PictureVocabularyData {
  if (typeof d.title !== 'string' || !Array.isArray(d.pairItems) || !d.pairItems.length || d.pairItems.length > 12
      || picturePairItemsFrom(d.pairItems, d.supportTier).length !== d.pairItems.length)
    throw new Error('Generated picture vocabulary has invalid lesson content.');
  return d;
}

/** Reject an item the pack would drop: cards without the target, a pair whose sides match, a scale whose blank is
 *  not the answer, a frame with no blank or one that speaks its own answer. */
export const validatePictureVocabularyData = (value: unknown): PictureVocabularyData =>
  (value as PictureVocabularyData)?.task === 'pair_build' ? validatePairBuild(value as PictureVocabularyData)
    : validateChallengePool<PictureVocabularyData>(value, c => !!c && itemFromChallenge(c) !== null,
      { pool: 'Generated picture vocabulary has invalid lesson content.', item: 'A picture vocabulary item cannot be asked.' });

/** What the live adapter needs from picture vocabulary; the catalog's `teachingWorkspace` declares the rest. */
export const pictureVocabularyLiveDomain: WorkspaceDomain<PictureVocabularyData> = {
  validate: validatePictureVocabularyData,
  initialState: data => {
    if (data.task === 'pair_build') return workspaceOpening({ title: data.title,
      task: picturePairAssignment(picturePairItemsFrom(data.pairItems ?? [], data.supportTier)[0]).task, total: data.pairItems?.length ?? 0 });
    const items = itemsFromChallenges(data.challenges);
    return workspaceOpening({ title: data.title, task: pictureVocabAssignment(items[0]).task, total: items.length });
  },
};
