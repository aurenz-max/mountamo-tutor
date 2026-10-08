import type { SentenceBuilderData } from '../../../primitives/visual-primitives/literacy/SentenceBuilder';
import { sentenceAssignment, sentencesFrom } from '../../../primitives/visual-primitives/literacy/sentenceBuild';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Only the open build binds: a `sentence_build` payload whose every item passes the surface's gate. The tile-order
 * modes' payloads are refused here, so `workspaceBinding` leaves them on their own path.
 */
export function validateSentenceBuilderData(value: unknown): SentenceBuilderData {
  const d = value as SentenceBuilderData;
  if (!d || d.task !== 'sentence_build' || typeof d.title !== 'string' || !Array.isArray(d.sentences) || !d.sentences.length
      || d.sentences.length > 10 || sentencesFrom(d.sentences, d.supportTier).length !== d.sentences.length)
    throw new Error('Only a build_sentence payload runs on the teaching workspace.');
  return d;
}

/** What the live adapter needs from the sentence builder; the catalog's `teachingWorkspace` declares the rest. */
export const sentenceBuilderLiveDomain: WorkspaceDomain<SentenceBuilderData> = {
  validate: validateSentenceBuilderData,
  initialState: data => {
    const items = sentencesFrom(data.sentences ?? [], data.supportTier);
    return workspaceOpening({ title: data.title, task: sentenceAssignment(items[0]).task, total: items.length });
  },
};
