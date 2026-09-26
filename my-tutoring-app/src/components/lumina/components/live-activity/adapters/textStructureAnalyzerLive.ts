import type { TextStructureAnalyzerData } from '../../../primitives/visual-primitives/literacy/TextStructureAnalyzer';
import { textStructureAssignment, textStructureItems } from '../../../primitives/visual-primitives/literacy/textStructureAnalyzerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a passage with nothing askable: the build gates drop a signal word the passage does not contain, a
 *  menu the ear cannot separate, an idea that repeats a mat's name. */
export function validateTextStructureAnalyzerData(value: unknown): TextStructureAnalyzerData {
  const d = value as TextStructureAnalyzerData;
  if (!d || typeof d.passage !== 'string' || !Array.isArray(d.structureOptions))
    throw new Error('Generated text structure analyzer has invalid lesson content.');
  if (!textStructureItems(d, d.instanceId ?? 'text-structure-analyzer').items.length)
    throw new Error('No text structure question can be asked.');
  return d;
}

/** What the live adapter needs from the passage; the catalog's `teachingWorkspace` declares the rest. */
export const textStructureAnalyzerLiveDomain: WorkspaceDomain<TextStructureAnalyzerData> = {
  validate: validateTextStructureAnalyzerData,
  initialState: data => {
    const { items } = textStructureItems(data, data.instanceId ?? 'text-structure-analyzer');
    return workspaceOpening({ title: data.title || 'Text Structure', task: textStructureAssignment(items[0]).task, total: items.length });
  },
};
