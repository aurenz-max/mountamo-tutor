import type { EraExplorerData } from '../../../primitives/visual-primitives/history/EraExplorer';
import { eraAssignment, eraItems } from '../../../primitives/visual-primitives/history/eraExplorerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a lesson with nothing askable: the build gates drop a statement that names its own answer or copies
 *  a card, a menu the ear cannot tell apart, and a cause that restates the change. */
export function validateEraExplorerData(value: unknown): EraExplorerData {
  const d = value as EraExplorerData;
  if (!d || !Array.isArray(d.challenges)) throw new Error('Generated era explorer has invalid lesson content.');
  if (!eraItems(d).length) throw new Error('No era explorer question can be asked.');
  return d;
}

/** What the live adapter needs from the lesson; the catalog's `teachingWorkspace` declares the rest. */
export const eraExplorerLiveDomain: WorkspaceDomain<EraExplorerData> = {
  validate: validateEraExplorerData,
  initialState: data => {
    const items = eraItems(data);
    return workspaceOpening({ title: data.title || 'Era Explorer', task: eraAssignment(items[0]).task, total: items.length });
  },
};
