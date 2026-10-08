import type { WordBuilderData } from '../../../types';
import { itemFromTarget, itemsFromTargets } from '../../../primitives/visual-primitives/literacy/wordBuilderScript';
import { wordBuilderAssignment } from '../../../primitives/visual-primitives/literacy/wordBuilderWorkspace';
import { affixBuildAssignment, buildItemsFrom, type BuildPart } from '../../../primitives/visual-primitives/literacy/affixBuild';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a word the pack would drop: parts that do not spell it, a clue that contains it, an unsayable part. */
export function validateWordBuilderData(value: unknown): WordBuilderData {
  const d = value as WordBuilderData;
  if (d?.task === 'build_affix') {
    // The open build: every ask must survive the component's own gate, so the session asks what was generated.
    if (typeof d.title !== 'string' || !Array.isArray(d.availableParts) || !Array.isArray(d.buildItems) || !d.buildItems.length
        || d.buildItems.length > 12) throw new Error('Generated word builder has invalid lesson content.');
    if (buildItemsFrom(d.buildItems, d.availableParts as BuildPart[], d.supportTier).length !== d.buildItems.length)
      throw new Error('A word builder ask cannot be asked.');
    return d;
  }
  const complexity = d?.complexityLevel ?? 'compound_affix';
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.targets) || !d.targets.length || d.targets.length > 12
      || !Array.isArray(d.availableParts))
    throw new Error('Generated word builder has invalid lesson content.');
  if (!d.targets.every(t => !!t && itemFromTarget(t, d.availableParts, complexity) !== null))
    throw new Error('A word builder word cannot be asked.');
  // A word that repeats or sits inside an earlier word or clue would be asked with its answer already said.
  if (itemsFromTargets(d.targets, d.availableParts, complexity).length !== d.targets.length)
    throw new Error('A word builder word repeats an earlier word or clue.');
  return d;
}

/** What the live adapter needs from the builder; the catalog's `teachingWorkspace` declares the rest. */
export const wordBuilderLiveDomain: WorkspaceDomain<WordBuilderData> = {
  validate: validateWordBuilderData,
  initialState: data => {
    if (data.task === 'build_affix') {
      const items = buildItemsFrom(data.buildItems ?? [], data.availableParts as BuildPart[], data.supportTier);
      return workspaceOpening({ title: data.title, task: affixBuildAssignment(items[0]).task, total: items.length });
    }
    const items = itemsFromTargets(data.targets, data.availableParts, data.complexityLevel ?? 'compound_affix');
    return workspaceOpening({ title: data.title, task: wordBuilderAssignment(items[0]).task, total: items.length });
  },
};
