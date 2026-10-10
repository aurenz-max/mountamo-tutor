import type { SystemsEquationsVisualizerData } from '../../../primitives/visual-primitives/math/SystemsEquationsVisualizer';
import { onLine, workspaceAssignment } from '../../../primitives/visual-primitives/math/systemsEquationsWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['graph', 'substitution', 'elimination'];
const num = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Reject a systems-of-equations lesson whose challenges cannot be attempted. */
export function validateSystemsEquationsData(value: unknown): SystemsEquationsVisualizerData {
  const d = value as SystemsEquationsVisualizerData;
  const range = (r: unknown) => Array.isArray(r) && r.length === 2 && num(r[0]) && num(r[1]) && r[0] < r[1];
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || !range(d.xRange) || !range(d.yRange)
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated systems of equations has invalid lesson content.');
  // Each item needs what its own check reads: two drawable lines that are not parallel and both pass through the
  // item's (expectedX, expectedY), so the one point that solves both is the key the check compares against.
  for (const c of d.challenges) {
    const eqs = [c.equationA, c.equationB];
    const key = { x: c.expectedX, y: c.expectedY };
    const ok = num(c.expectedX) && num(c.expectedY)
      && eqs.every(e => e && typeof e.display === 'string' && e.display.trim() && num(e.slope) && num(e.yIntercept))
      && Math.abs(c.equationA.slope - c.equationB.slope) > 1e-9
      && eqs.every(e => onLine(e, key));
    if (!ok) throw new Error(`A systems-equations ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the systems visualizer; the catalog's `teachingWorkspace` declares the rest. */
export const systemsEquationsLiveDomain: WorkspaceDomain<SystemsEquationsVisualizerData> = {
  validate: validateSystemsEquationsData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
