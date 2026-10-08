import type { ParagraphArchitectData } from '../../../primitives/visual-primitives/literacy/ParagraphArchitect';
import { paragraphAssignment, paragraphsFrom } from '../../../primitives/visual-primitives/literacy/paragraphBuild';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Only the open build binds: a `paragraph_build` payload whose every paragraph passes the surface's gate. The writing
 * modes' payloads (frames and a model paragraph) are refused here, so `workspaceBinding` leaves them on their own path.
 */
export function validateParagraphArchitectData(value: unknown): ParagraphArchitectData {
  const d = value as ParagraphArchitectData;
  if (!d || d.task !== 'paragraph_build' || typeof d.title !== 'string' || !Array.isArray(d.paragraphs) || !d.paragraphs.length
      || d.paragraphs.length > 8 || paragraphsFrom(d.paragraphs).length !== d.paragraphs.length)
    throw new Error('Only a build_paragraph payload runs on the teaching workspace.');
  return d;
}

/** What the live adapter needs from the paragraph builder; the catalog's `teachingWorkspace` declares the rest. */
export const paragraphArchitectLiveDomain: WorkspaceDomain<ParagraphArchitectData> = {
  validate: validateParagraphArchitectData,
  initialState: data => {
    const items = paragraphsFrom(data.paragraphs ?? []);
    return workspaceOpening({ title: data.title, task: paragraphAssignment(items[0]).task, total: items.length });
  },
};
