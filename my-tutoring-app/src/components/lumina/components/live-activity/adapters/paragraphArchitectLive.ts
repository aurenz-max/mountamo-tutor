import type { ParagraphArchitectData } from '../../../primitives/visual-primitives/literacy/ParagraphArchitect';
import { paragraphAssignment, paragraphsFrom } from '../../../primitives/visual-primitives/literacy/paragraphBuild';
import { stagesFor, writingAssignment } from '../../../primitives/visual-primitives/literacy/writingStages';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const KINDS = ['informational', 'narrative', 'opinion'];

/** A writing payload needs a topic and a paragraph type; a build payload needs every paragraph to pass the card gate. */
export function validateParagraphArchitectData(value: unknown): ParagraphArchitectData {
  const d = value as ParagraphArchitectData;
  if (!d || typeof d.title !== 'string') throw new Error('Generated paragraph architect has invalid lesson content.');
  if (d.task === 'paragraph_build') {
    if (!Array.isArray(d.paragraphs) || !d.paragraphs.length || d.paragraphs.length > 8
        || paragraphsFrom(d.paragraphs).length !== d.paragraphs.length)
      throw new Error('A paragraph builder set cannot be asked.');
    return d;
  }
  if (!KINDS.includes(d.paragraphType) || typeof d.topic !== 'string' || !d.topic.trim())
    throw new Error('A writing lesson needs a topic and a paragraph type.');
  return d;
}

/** What the live adapter needs from the paragraph architect; the catalog's `teachingWorkspace` declares the rest. */
export const paragraphArchitectLiveDomain: WorkspaceDomain<ParagraphArchitectData> = {
  validate: validateParagraphArchitectData,
  initialState: data => {
    if (data.task === 'paragraph_build') {
      const items = paragraphsFrom(data.paragraphs ?? []);
      return workspaceOpening({ title: data.title, task: paragraphAssignment(items[0]).task, total: items.length });
    }
    const stages = stagesFor(data);
    return workspaceOpening({ title: data.title, task: writingAssignment(stages[0]).task, total: stages.length });
  },
};
