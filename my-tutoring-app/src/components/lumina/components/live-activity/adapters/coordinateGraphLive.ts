import type { CoordinateGraphData } from '../../../primitives/visual-primitives/math/CoordinateGraph';
import { optionIsKey, optionsOf, workspaceAssignment } from '../../../primitives/visual-primitives/math/coordinateGraphWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['plot_point', 'read_point', 'find_slope', 'find_intercept'];
const int = (n: unknown) => typeof n === 'number' && Number.isInteger(n);

/** Reject a coordinate-graph lesson whose challenges cannot be attempted. */
export function validateCoordinateGraphData(value: unknown): CoordinateGraphData {
  const d = value as CoordinateGraphData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || !int(d.gridMin) || !int(d.gridMax) || d.gridMax - d.gridMin < 2
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated coordinate graph has invalid lesson content.');
  // Each item needs what its own check reads: a point on the grid to plot or read, two points that make a line that is
  // not vertical, and four different choices of which exactly one, the one `correctOptionIndex` names, is the key.
  const inGrid = (n: number) => n >= d.gridMin && n <= d.gridMax;
  for (const c of d.challenges) {
    let ok = [c.x1, c.y1, c.x2, c.y2].every(int) && inGrid(c.x1) && inGrid(c.y1);
    if (ok && c.type !== 'plot_point') {
      const opts = optionsOf(c);
      const keys = opts.filter(o => optionIsKey(c, o));
      ok = opts.length === 4 && new Set(opts.map(o => o.replace(/\s/g, ''))).size === 4 && keys.length === 1
        && opts[c.correctOptionIndex ?? -1] === keys[0];
    }
    if (ok && (c.type === 'find_slope' || c.type === 'find_intercept')) ok = c.x1 !== c.x2 && inGrid(c.x2) && inGrid(c.y2);
    if (!ok) throw new Error(`A coordinate-graph ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the coordinate graph; the catalog's `teachingWorkspace` declares the rest. */
export const coordinateGraphLiveDomain: WorkspaceDomain<CoordinateGraphData> = {
  validate: validateCoordinateGraphData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
