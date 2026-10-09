import type { SentenceBuilderData } from '../../../primitives/visual-primitives/literacy/SentenceBuilder';
import { sentenceAssignment, sentencesFrom } from '../../../primitives/visual-primitives/literacy/sentenceBuild';
import { orderAssignment, ordersFrom } from '../../../primitives/visual-primitives/literacy/sentenceOrder';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Every item must pass its surface's gate: the word-tile build, or the tile-order challenges. */
export function validateSentenceBuilderData(value: unknown): SentenceBuilderData {
  const d = value as SentenceBuilderData;
  if (!d || typeof d.title !== 'string') throw new Error('Generated sentence builder has invalid lesson content.');
  if (d.task === 'sentence_build') {
    if (!Array.isArray(d.sentences) || !d.sentences.length || d.sentences.length > 10
        || sentencesFrom(d.sentences, d.supportTier).length !== d.sentences.length)
      throw new Error('A sentence build item cannot be asked.');
    return d;
  }
  if (!Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 10
      || ordersFrom(d.challenges).length !== d.challenges.length)
    throw new Error('A sentence builder challenge cannot be asked.');
  return d;
}

/** What the live adapter needs from the sentence builder; the catalog's `teachingWorkspace` declares the rest. */
export const sentenceBuilderLiveDomain: WorkspaceDomain<SentenceBuilderData> = {
  validate: validateSentenceBuilderData,
  initialState: data => {
    if (data.task === 'sentence_build') {
      const items = sentencesFrom(data.sentences ?? [], data.supportTier);
      return workspaceOpening({ title: data.title, task: sentenceAssignment(items[0]).task, total: items.length });
    }
    const items = ordersFrom(data.challenges);
    return workspaceOpening({ title: data.title, task: orderAssignment(items[0]).task, total: items.length });
  },
};
