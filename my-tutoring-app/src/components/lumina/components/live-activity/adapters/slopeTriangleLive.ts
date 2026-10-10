import type { SlopeTriangleData } from '../../../primitives/visual-primitives/math/SlopeTriangle';
import { workspaceAssignment } from '../../../primitives/visual-primitives/math/slopeTriangleWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['identify_slope', 'calculate', 'draw_triangle'];
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

/** Reject a slope-triangle lesson whose challenges cannot be attempted. */
export function validateSlopeTriangleData(value: unknown): SlopeTriangleData {
  const d = value as SlopeTriangleData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || !Array.isArray(d.xRange) || !Array.isArray(d.yRange)
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim() || !c.attachedLine || !c.triangle))
    throw new Error('Generated slope triangle has invalid lesson content.');
  // Each item's key must be the triangle the canvas draws: the slope is the line's (not flat), the rise is slope x run in
  // whole grid steps, the run is a whole number the corners can reach, and a read item's drawn triangle is that run. A
  // read item never prints the rise and run it asks for.
  for (const c of d.challenges) {
    const { slope } = c.attachedLine;
    const { size, position } = c.triangle;
    let ok = [slope, c.attachedLine.yIntercept, c.expectedRise, c.expectedRun, c.expectedSlope, size, position?.x].every(finite)
      && near(c.expectedSlope, slope) && slope !== 0 && near(c.expectedRise, slope * c.expectedRun) && Number.isInteger(c.expectedRise)
      && Number.isInteger(c.expectedRun) && c.expectedRun >= 1 && c.expectedRun <= 8;
    if (ok && c.type !== 'draw_triangle') ok = size === c.expectedRun;
    if (ok && c.type === 'identify_slope') ok = !(c.triangle.showRiseRunLabels ?? c.triangle.showMeasurements);
    // A build starts flat (its top corner on the right angle) and is credited for any run whose rise fits the line;
    // `expectedRun`/`expectedRise` are one such triangle.
    if (ok && c.type === 'draw_triangle') ok = Number.isInteger(size) && size >= 1;
    if (!ok) throw new Error(`A slope-triangle ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the slope triangle; the catalog's `teachingWorkspace` declares the rest. */
export const slopeTriangleLiveDomain: WorkspaceDomain<SlopeTriangleData> = {
  validate: validateSlopeTriangleData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
