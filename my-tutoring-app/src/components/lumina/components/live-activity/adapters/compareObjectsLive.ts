import type { CompareObjectsData } from '../../../primitives/visual-primitives/math/CompareObjects';
import { askFor, buildCompareItems } from '../../../primitives/visual-primitives/math/compareObjectsScript';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const compareItems = (d: CompareObjectsData) =>
  buildCompareItems(d.challenges as any[], { band: d.gradeBand ?? 'K' } as any).items;

/** Reject a comparison whose challenges cannot be ASKED before they reach a five-year-old. */
export function validateCompareObjectsData(value: unknown): CompareObjectsData {
  const d = value as CompareObjectsData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? 'K')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated comparison has invalid lesson content.');
  // `buildCompareItems` DROPS anything unaskable rather than repairing it, so an
  // empty build means this lesson would mount with nothing to ask.
  if (!compareItems(d).length) throw new Error('A compare-objects challenge cannot run in the lesson.');
  return d;
}

/** What the live adapter needs from compare objects; the catalog's `teachingWorkspace` declares the rest. */
export const compareObjectsLiveDomain: WorkspaceDomain<CompareObjectsData> = {
  validate: validateCompareObjectsData,
  initialState: d => { const items = compareItems(d); return workspaceOpening({ title: d.title, task: askFor(items[0]), total: items.length }); },
};
