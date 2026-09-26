import type { OralSentenceStudioData } from '../../../primitives/visual-primitives/literacy/OralSentenceStudio';
import { itemsFromChallenges } from '../../../primitives/visual-primitives/literacy/oralSentenceStudioScript';
import { oralSentenceAssignment } from '../../../primitives/visual-primitives/literacy/oralSentenceStudioWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a lesson with nothing askable: the build gates drop a label with a control word, a word pair that is not
 *  two distinct words, example sentences that miss a word or the scene, a story line the examples copy. */
export function validateOralSentenceStudioData(value: unknown): OralSentenceStudioData {
  const d = value as OralSentenceStudioData;
  if (!d || !Array.isArray(d.challenges)) throw new Error('Generated oral sentence studio has invalid lesson content.');
  if (!itemsFromChallenges(d.challenges).length) throw new Error('No oral sentence studio challenge can be asked.');
  return d;
}

/** What the live adapter needs from the lesson; the catalog's `teachingWorkspace` declares the rest. */
export const oralSentenceStudioLiveDomain: WorkspaceDomain<OralSentenceStudioData> = {
  validate: validateOralSentenceStudioData,
  initialState: data => {
    const items = itemsFromChallenges(data.challenges);
    return workspaceOpening({ title: data.title || 'Oral Sentence Studio', task: oralSentenceAssignment(items[0]).task, total: items.length });
  },
};
