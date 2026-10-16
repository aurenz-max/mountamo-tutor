import type { PhExplorerData } from '../../../primitives/visual-primitives/chemistry/PhExplorer';
import { askOf, phItems, resolvePhModes } from '../../../primitives/visual-primitives/chemistry/phExplorerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a lab a mode cannot be asked on: no substances, duplicate ids, a pH off the 0-14 scale, or a requested mode
 * with no item (test needs a substance litmus reads plainly; indicator one off a colour edge). Every key is computed
 * from the pH values, so nothing else is trusted from the generator.
 */
export function validatePhExplorerData(value: unknown): PhExplorerData {
  const d = value as PhExplorerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim() || !Array.isArray(d.substances) || !d.substances.length)
    throw new Error('Generated pH explorer has invalid lesson content.');
  const ids = d.substances.map(s => s?.id);
  if (new Set(ids).size !== ids.length || d.substances.some(s => !s || typeof s.id !== 'string' || !s.name?.trim()
      || !Number.isFinite(s.pH) || s.pH < 0 || s.pH > 14))
    throw new Error('A generated pH-explorer substance has no id, name or pH on the scale.');
  const items = phItems(d);
  for (const mode of resolvePhModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The pH-explorer ${mode} mode has no item to ask on these substances.`);
  }
  return d;
}

/** What the live adapter needs from the pH explorer; the catalog's `teachingWorkspace` declares the rest. */
export const phExplorerLiveDomain: WorkspaceDomain<PhExplorerData> = {
  validate: validatePhExplorerData,
  initialState: d => {
    const items = phItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
