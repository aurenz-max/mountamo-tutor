import type { VocabularyExplorerData } from '../../../primitives/visual-primitives/core/VocabularyExplorer';
import { resolveKinds, validVocabItem, vocabItems, STUDY_TASK } from '../../../primitives/visual-primitives/core/vocabularyExplorerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a word set a mode cannot be asked on: no title or words, a stored item code could not have built from this
 * bank (every key is a word's id, so nothing else is trusted), repeated ids, or a requested kind with no item.
 */
export function validateVocabularyExplorerData(value: unknown): VocabularyExplorerData {
  const d = value as VocabularyExplorerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim() || !Array.isArray(d.terms) || d.terms.length < 3
      || d.terms.some(t => !t || typeof t.id !== 'string' || typeof t.word !== 'string' || !t.word.trim() || typeof t.definition !== 'string')
      || new Set(d.terms.map(t => t.id)).size !== d.terms.length)
    throw new Error('Generated vocabulary explorer has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validVocabItem(i, d.terms))) throw new Error('A generated vocabulary item is not one code can key.');
  const items = vocabItems(d);
  if (!items.length || new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated vocabulary items are missing or repeat an id.');
  for (const kind of resolveKinds(d)) {
    if (!items.some(i => i.kind === kind)) throw new Error(`The vocabulary ${kind} task has no item this word set can build.`);
  }
  return d;
}

/** What the live adapter needs from the word set; the catalog's `teachingWorkspace` declares the rest. */
export const vocabularyExplorerLiveDomain: WorkspaceDomain<VocabularyExplorerData> = {
  validate: validateVocabularyExplorerData,
  initialState: d => workspaceOpening({ title: d.title, task: STUDY_TASK, total: vocabItems(d).length }),
};
