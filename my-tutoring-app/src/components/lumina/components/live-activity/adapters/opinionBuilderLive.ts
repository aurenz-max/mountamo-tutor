import type { OpinionBuilderData } from '../../../primitives/visual-primitives/literacy/OpinionBuilder';
import { opinionAssignment, opinionsFrom, opinionWritingPayload } from '../../../primitives/visual-primitives/literacy/opinionBuild';
import { stagesFor, writingAssignment } from '../../../primitives/visual-primitives/literacy/writingStages';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** A writing payload needs a question and a framework; a build payload needs every question to pass the card gate. */
export function validateOpinionBuilderData(value: unknown): OpinionBuilderData {
  const d = value as OpinionBuilderData;
  if (!d || typeof d.title !== 'string') throw new Error('Generated opinion builder has invalid lesson content.');
  if (d.task === 'opinion_build') {
    if (!Array.isArray(d.opinions) || !d.opinions.length || d.opinions.length > 6 || opinionsFrom(d.opinions).length !== d.opinions.length)
      throw new Error('An opinion builder set cannot be asked.');
    return d;
  }
  if (!['oreo', 'cer'].includes(d.framework) || typeof d.prompt !== 'string' || !d.prompt.trim())
    throw new Error('An opinion lesson needs a question and a framework.');
  return d;
}

/** What the live adapter needs from the opinion builder; the catalog's `teachingWorkspace` declares the rest. */
export const opinionBuilderLiveDomain: WorkspaceDomain<OpinionBuilderData> = {
  validate: validateOpinionBuilderData,
  initialState: data => {
    if (data.task === 'opinion_build') {
      const items = opinionsFrom(data.opinions ?? []);
      return workspaceOpening({ title: data.title, task: opinionAssignment(items[0]).task, total: items.length });
    }
    const stages = stagesFor(opinionWritingPayload(data));
    return workspaceOpening({ title: data.title, task: writingAssignment(stages[0]).task, total: stages.length });
  },
};
