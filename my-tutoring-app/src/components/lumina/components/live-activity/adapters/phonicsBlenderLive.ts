import type { PhonicsBlenderData } from '../../../primitives/visual-primitives/literacy/PhonicsBlender';
import { blendAssignment, blendItems } from '../../../primitives/visual-primitives/literacy/phonicsBlenderWorkspace';
import { letterAssignment, letterItemsFrom } from '../../../primitives/visual-primitives/literacy/letterBuild';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a word list that cannot be asked: every word needs a target and its letters. */
export function validatePhonicsBlenderData(value: unknown): PhonicsBlenderData {
  const d = value as PhonicsBlenderData;
  if (d?.task === 'letter_build') {
    // The open build (build_blend): every ask must pass the surface's own gate.
    if (typeof d.title !== 'string' || !Array.isArray(d.buildItems) || !d.buildItems.length || d.buildItems.length > 12
        || letterItemsFrom(d.buildItems, d.supportTier).length !== d.buildItems.length)
      throw new Error('Generated phonics blender has invalid lesson content.');
    return d;
  }
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.words) || !d.words.length || d.words.length > 12
      || new Set(d.words.map(w => w?.id)).size !== d.words.length
      || d.words.some(w => !w || typeof w.id !== 'string' || !w.id || typeof w.targetWord !== 'string' || !w.targetWord.trim()
        || !Array.isArray(w.phonemes) || !w.phonemes.length
        || w.phonemes.some(p => !p || typeof p.id !== 'string' || typeof p.letters !== 'string' || !p.letters
          || typeof p.sound !== 'string')))
    throw new Error('Generated phonics blender has invalid lesson content.');
  return d;
}

/** What the live adapter needs from the blender; the catalog's `teachingWorkspace` declares the rest. */
export const phonicsBlenderLiveDomain: WorkspaceDomain<PhonicsBlenderData> = {
  validate: validatePhonicsBlenderData,
  initialState: data => {
    if (data.task === 'letter_build') return workspaceOpening({ title: data.title,
      task: letterAssignment(letterItemsFrom(data.buildItems ?? [], data.supportTier)[0]).task, total: data.buildItems?.length ?? 0 });
    const items = blendItems(data.words);
    return workspaceOpening({ title: data.title, task: blendAssignment(items[0]).task, total: items.length });
  },
};
