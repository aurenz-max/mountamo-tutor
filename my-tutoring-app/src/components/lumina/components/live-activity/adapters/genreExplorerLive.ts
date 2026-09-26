import type { GenreExplorerData } from '../../../primitives/visual-primitives/literacy/GenreExplorer';
import { itemsFromPayload } from '../../../primitives/visual-primitives/literacy/genreExplorerScript';
import { genreAssignment } from '../../../primitives/visual-primitives/literacy/genreExplorerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a lesson with nothing askable: the build gates drop an excerpt that names a genre, a heading-form
 *  feature, a menu the ear cannot separate. */
export function validateGenreExplorerData(value: unknown): GenreExplorerData {
  const d = value as GenreExplorerData;
  if (!d || !Array.isArray(d.excerpts) || !Array.isArray(d.features))
    throw new Error('Generated genre explorer has invalid lesson content.');
  if (!itemsFromPayload(d).items.length) throw new Error('No genre explorer question can be asked.');
  return d;
}

/** What the live adapter needs from the lesson; the catalog's `teachingWorkspace` declares the rest. */
export const genreExplorerLiveDomain: WorkspaceDomain<GenreExplorerData> = {
  validate: validateGenreExplorerData,
  initialState: data => {
    const { items } = itemsFromPayload(data);
    return workspaceOpening({ title: data.title || 'Genre Explorer', task: genreAssignment(items[0]).task, total: items.length });
  },
};
