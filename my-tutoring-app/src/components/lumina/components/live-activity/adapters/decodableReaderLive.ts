import type { DecodableReaderData } from '../../../primitives/visual-primitives/literacy/DecodableReader';
import { itemsFromChallenges } from '../../../primitives/visual-primitives/literacy/decodableReaderScript';
import { decodableReaderAssignment } from '../../../primitives/visual-primitives/literacy/decodableReaderWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a story the pack would not ask: no passage, or nothing left once the build gates drop
 *  lines outside the 3-8 word window and questions whose answer the story does not hold. */
export function validateDecodableReaderData(value: unknown): DecodableReaderData {
  const d = value as DecodableReaderData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.passage?.sentences) || !d.passage.sentences.length)
    throw new Error('Generated decodable reader has invalid lesson content.');
  if (!itemsFromChallenges(d).items.length) throw new Error('A decodable reader story has nothing that can be asked.');
  return d;
}

/** What the live adapter needs from the reader; the catalog's `teachingWorkspace` declares the rest. */
export const decodableReaderLiveDomain: WorkspaceDomain<DecodableReaderData> = {
  validate: validateDecodableReaderData,
  initialState: data => {
    const { items } = itemsFromChallenges(data);
    return workspaceOpening({ title: data.title, task: decodableReaderAssignment(items[0]).task, total: items.length });
  },
};
