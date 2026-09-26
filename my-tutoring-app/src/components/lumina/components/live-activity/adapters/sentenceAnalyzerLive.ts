import type { SentenceAnalyzerData } from '../../../primitives/visual-primitives/literacy/SentenceAnalyzer';
import { itemsFromPayload } from '../../../primitives/visual-primitives/literacy/sentenceAnalyzerScript';
import { sentenceAssignment } from '../../../primitives/visual-primitives/literacy/sentenceAnalyzerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a lesson with nothing askable: the build gates drop a label outside the grade's wall, a word with no
 *  clean role, a side item with no subject boundary. */
export function validateSentenceAnalyzerData(value: unknown): SentenceAnalyzerData {
  const d = value as SentenceAnalyzerData;
  if (!d || !Array.isArray(d.challenges)) throw new Error('Generated sentence analyzer has invalid lesson content.');
  if (!itemsFromPayload(d).items.length) throw new Error('No sentence analyzer question can be asked.');
  return d;
}

/** What the live adapter needs from the lesson; the catalog's `teachingWorkspace` declares the rest. */
export const sentenceAnalyzerLiveDomain: WorkspaceDomain<SentenceAnalyzerData> = {
  validate: validateSentenceAnalyzerData,
  initialState: data => {
    const { items } = itemsFromPayload(data);
    return workspaceOpening({ title: data.title || 'Sentence Analyzer', task: sentenceAssignment(items[0]).task, total: items.length });
  },
};
