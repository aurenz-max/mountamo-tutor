import type { SpellingPatternExplorerData } from '../../../primitives/visual-primitives/literacy/SpellingPatternExplorer';
import { dictationAssignment, dictationItems } from '../../../primitives/visual-primitives/literacy/spellingPatternExplorerWorkspace';
import { letterAssignment, letterItemsFrom } from '../../../primitives/visual-primitives/literacy/letterBuild';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Every mode binds. The classic modes: a title, pattern words and 1-10 dictation words of letters (each word is one
 * item). The open build (`pattern_build`): every ask passes the letter surface's own gate.
 */
export function validateSpellingPatternExplorerData(value: unknown): SpellingPatternExplorerData {
  const d = value as SpellingPatternExplorerData;
  if (!d || typeof d.title !== 'string') throw new Error('Generated spelling pattern explorer has invalid lesson content.');
  if (d.task === 'letter_build') {
    if (!Array.isArray(d.buildItems) || !d.buildItems.length || d.buildItems.length > 12
        || letterItemsFrom(d.buildItems, d.supportTier).length !== d.buildItems.length)
      throw new Error('Generated spelling pattern build has an ask the board cannot run.');
    return d;
  }
  if (!Array.isArray(d.patternWords) || !d.patternWords.length || typeof d.highlightPattern !== 'string'
      || !Array.isArray(d.dictationWords) || !d.dictationWords.length || d.dictationWords.length > 10
      || dictationItems(d.dictationWords).length !== d.dictationWords.length)
    throw new Error('Generated spelling pattern explorer has invalid lesson content.');
  return d;
}

/** What the live adapter needs from the explorer; the catalog's `teachingWorkspace` declares the rest. */
export const spellingPatternExplorerLiveDomain: WorkspaceDomain<SpellingPatternExplorerData> = {
  validate: validateSpellingPatternExplorerData,
  initialState: data => {
    if (data.task === 'letter_build') {
      const items = letterItemsFrom(data.buildItems ?? [], data.supportTier);
      return workspaceOpening({ title: data.title, task: letterAssignment(items[0]).task, total: items.length });
    }
    const items = dictationItems(data.dictationWords, data.dictationHints);
    return workspaceOpening({ title: data.title, task: dictationAssignment(items[0]).task, total: items.length });
  },
};
