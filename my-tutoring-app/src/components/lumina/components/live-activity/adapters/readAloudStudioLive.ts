import type { ReadAloudStudioData } from '../../../primitives/visual-primitives/literacy/ReadAloudStudio';
import { scoredReadingItems, studioItems } from '../../../primitives/visual-primitives/literacy/readAloudPhrasing';
import { readAloudAssignment } from '../../../primitives/visual-primitives/literacy/readAloudStudioWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** The items exactly as the component builds them. */
export const readAloudItems = (data: ReadAloudStudioData) => studioItems(data.lines ?? [], data.fluencyFocus ?? 'accuracy');

/** Reject a passage with no line that can be asked honestly: the build gates drop a line outside the 3-8 word
 *  window, a sentinel-opening line, dialogue with no speaker. */
export function validateReadAloudStudioData(value: unknown): ReadAloudStudioData {
  const d = value as ReadAloudStudioData;
  if (!d || !Array.isArray(d.lines)) throw new Error('Generated read aloud studio has invalid lesson content.');
  if (!scoredReadingItems(readAloudItems(d)).length) throw new Error('No read aloud line can be asked.');
  return d;
}

/** What the live adapter needs from the passage; the catalog's `teachingWorkspace` declares the rest. */
export const readAloudStudioLiveDomain: WorkspaceDomain<ReadAloudStudioData> = {
  validate: validateReadAloudStudioData,
  initialState: data => {
    const items = readAloudItems(data);
    return workspaceOpening({ title: data.title || 'Read Aloud Studio', task: readAloudAssignment(items[0]).task, total: items.length });
  },
};
