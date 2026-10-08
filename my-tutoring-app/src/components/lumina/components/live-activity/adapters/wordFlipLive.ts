import type { WordFlipData } from '../../../primitives/visual-primitives/literacy/WordFlip';
import { flipAssignment } from '../../../primitives/visual-primitives/literacy/wordFlipWorkspace';
import { affixBuildAssignment } from '../../../primitives/visual-primitives/literacy/affixBuild';
import { inflectItemsFrom } from '../../../primitives/visual-primitives/literacy/inflectBuild';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['plural_s', 'plural_es', 'plural_y', 'irregulars', 'past_ed', 'past_irregular'];

/** Reject a challenge the frame cannot ask: every item needs its type, source word and code-derived answer. */
export const validateWordFlipData = (value: unknown): WordFlipData => {
  const d = value as WordFlipData;
  if (d?.task === 'build_inflect') {
    // The open build: every ask must survive the surface's own gate, so the session asks what was generated.
    if (typeof d.title !== 'string' || !Array.isArray(d.availableParts) || !Array.isArray(d.buildItems) || !d.buildItems.length
        || d.buildItems.length > 12) throw new Error('Generated word flip has invalid lesson content.');
    if (inflectItemsFrom(d.buildItems, d.availableParts, d.supportTier).length !== d.buildItems.length)
      throw new Error('A word-flip build ask cannot be asked.');
    return d;
  }
  return validateChallengePool<WordFlipData>(value,
    c => !!c && TYPES.includes(c.type) && typeof c.sourceWord === 'string' && !!c.sourceWord.trim()
      && typeof c.answer === 'string' && !!c.answer.trim(),
    { pool: 'Generated word flip has invalid lesson content.', item: 'A word-flip challenge cannot be asked.' });
};

/** What the live adapter needs from word flip; the catalog's `teachingWorkspace` declares the rest. */
export const wordFlipLiveDomain: WorkspaceDomain<WordFlipData> = {
  validate: validateWordFlipData,
  initialState: data => {
    if (data.task === 'build_inflect') {
      const items = inflectItemsFrom(data.buildItems ?? [], data.availableParts ?? [], data.supportTier);
      return workspaceOpening({ title: data.title, task: affixBuildAssignment(items[0]).task, total: items.length });
    }
    return workspaceOpening({ title: data.title, task: flipAssignment(data.challenges[0]).task, total: data.challenges.length });
  },
};
