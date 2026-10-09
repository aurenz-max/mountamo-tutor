import type { ShapeTracerChallenge, ShapeTracerData } from '../../../primitives/visual-primitives/math/ShapeTracer';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CHALLENGE_TYPES = ['trace', 'complete', 'draw-from-description', 'connect-dots'];
const point = (p: unknown) => !!p && Number.isFinite((p as { x: number }).x) && Number.isFinite((p as { y: number }).y);
const points = (ps: unknown, min: number) => Array.isArray(ps) && ps.length >= min && ps.every(point);

/** Each type needs the material its own check reads, or it mounts unanswerable. */
function answerable(c: ShapeTracerChallenge): boolean {
  switch (c.type) {
    case 'trace': return points(c.tracePath, 3);
    case 'complete': return points(c.remainingVertices, 1) && Array.isArray(c.drawnSides)
      && c.drawnSides.every(s => s && point(s.from) && point(s.to));
    case 'draw-from-description': return !c.requiredProperties
      || (c.requiredProperties.sides ?? c.requiredProperties.corners ?? 3) >= 3;
    default: {
      const n = c.dots?.length ?? 0, order = c.correctOrder ?? [];
      return points(c.dots, 3) && order.length === n && new Set(order).size === n && order.every(i => Number.isInteger(i) && i >= 0 && i < n);
    }
  }
}

/** Reject a shape lesson whose challenges cannot be attempted. */
export function validateShapeTracerData(value: unknown): ShapeTracerData {
  const d = value as ShapeTracerData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated shape tracer has invalid lesson content.');
  for (const c of d.challenges) {
    if (!answerable(c)) throw new Error(`A shape-tracer ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the shape tracer; the catalog's `teachingWorkspace` declares the rest. */
export const shapeTracerLiveDomain: WorkspaceDomain<ShapeTracerData> = {
  validate: validateShapeTracerData,
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges[0].instruction, total: d.challenges.length }),
};
