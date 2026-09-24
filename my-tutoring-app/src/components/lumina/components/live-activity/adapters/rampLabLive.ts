import type { RampLabData } from '../../../primitives/visual-primitives/engineering/RampLab';
import { rampAssignment, rampItems } from '../../../primitives/visual-primitives/engineering/rampLabWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const MODES = ['compare_conditions', 'find_threshold', 'plan_fair_test', 'design_with_budget', 'explain_from_trials'];

/** Reject a lab the workspace cannot run: free exploration grades nothing, and every challenge needs a mode and a brief. */
export function validateRampLabData(value: unknown): RampLabData {
  const d = value as RampLabData;
  if (!d || typeof d.title !== 'string' || d.freeExplore) throw new Error('Ramp lab free exploration has no graded items.');
  const items = rampItems(d);
  if (!items.length || items.length > 12 || new Set(items.map(c => c?.id)).size !== items.length
      || items.some(c => !c || !MODES.includes(c.mode) || typeof c.brief !== 'string' || !c.brief.trim()))
    throw new Error('Generated ramp lab has invalid lesson content.');
  return d;
}

/** What the live adapter needs from the ramp lab; the catalog's `teachingWorkspace` declares the rest. */
export const rampLabLiveDomain: WorkspaceDomain<RampLabData> = {
  validate: validateRampLabData,
  initialState: data => {
    const items = rampItems(data);
    return workspaceOpening({ title: data.title, task: rampAssignment(items[0]).task, total: items.length });
  },
};
