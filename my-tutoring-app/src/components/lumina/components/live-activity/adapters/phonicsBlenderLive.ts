import type { PhonicsBlenderData } from '../../../primitives/visual-primitives/literacy/PhonicsBlender';
import { blendAssignment, blendItems } from '../../../primitives/visual-primitives/literacy/phonicsBlenderWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a word list that cannot be asked: every word needs a target and its letters. */
export function validatePhonicsBlenderData(value: unknown): PhonicsBlenderData {
  const d = value as PhonicsBlenderData;
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
    const items = blendItems(data.words);
    return workspaceOpening({ title: data.title, task: blendAssignment(items[0]).task, total: items.length });
  },
};
