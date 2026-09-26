import type { PeriodicTableData } from '../../../types';
import { periodicAssignment, periodicItems } from '../../../primitives/chemistry-primitives/periodicTableWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a lesson with nothing askable: an exploration payload (no challenges) stays the free table, and the
 *  build gates drop an unresolved element, a position ask without a group, and a compare pair the ear cannot split. */
export function validatePeriodicTableData(value: unknown): PeriodicTableData {
  const d = value as PeriodicTableData;
  if (!d || !Array.isArray(d.challenges)) throw new Error('Generated periodic table has no judged challenges.');
  if (!periodicItems(d as never).length) throw new Error('No periodic table question can be asked.');
  return d;
}

/** What the live adapter needs from the lesson; the catalog's `teachingWorkspace` declares the rest. */
export const periodicTableLiveDomain: WorkspaceDomain<PeriodicTableData> = {
  validate: validatePeriodicTableData,
  initialState: data => {
    const items = periodicItems(data as never);
    return workspaceOpening({ title: data.title || 'Periodic Table', task: periodicAssignment(items[0]).task, total: items.length });
  },
};
