import type { BalanceScaleData } from '../../../primitives/visual-primitives/math/BalanceScale';
import { balanceTasks } from '../../../primitives/visual-primitives/math/balanceScaleWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a scale whose challenges the routed surface cannot ask. The default export routes
 * by data (match-and-add, weight workshop, or the plain solver), and each surface's own
 * builder throws on content it cannot run, so the same builders gate the lesson here.
 */
export function validateBalanceScaleData(value: unknown): BalanceScaleData {
  const d = value as BalanceScaleData | null;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || d.challenges.some(c => !c || typeof c.type !== 'string' || typeof c.instruction !== 'string'
        || !Array.isArray(c.leftSide) || !Array.isArray(c.rightSide) || !Number.isFinite(c.variableValue)))
    throw new Error('Generated balance scale has invalid lesson content.');
  try { if (!balanceTasks(d).length) throw new Error('empty'); }
  catch { throw new Error('A balance-scale challenge cannot run in the lesson.'); }
  return d;
}

/** What the live adapter needs from the balance scale; the catalog's `teachingWorkspace` declares the rest. */
export const balanceScaleLiveDomain: WorkspaceDomain<BalanceScaleData> = {
  validate: validateBalanceScaleData,
  initialState: d => { const tasks = balanceTasks(d); return workspaceOpening({ title: d.title, task: tasks[0], total: tasks.length }); },
};
