import type { ShapeBuilderData } from '../../../primitives/visual-primitives/math/ShapeBuilder';
import { askOf } from '../../../primitives/visual-primitives/math/shapeBuilderWorkspace';
import { askIsOpen } from '../../../primitives/visual-primitives/math/shapeMakeBuild';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CHALLENGE_TYPES = ['build', 'measure', 'classify', 'classify_by_lines', 'compose', 'find_symmetry', 'coordinate_shape', 'make_shape'];

/** Reject a shape-builder lesson whose challenges cannot be attempted. */
export function validateShapeBuilderData(value: unknown): ShapeBuilderData {
  const d = value as ShapeBuilderData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated shape builder has invalid lesson content.');
  // Each type needs the material its own check reads, or it mounts unanswerable.
  const shapes = (d.preloadedShapes ?? []).filter(s => Array.isArray(s?.vertices) && s.vertices.length >= 3);
  for (const c of d.challenges) {
    const ok = c.type === 'make_shape' ? askIsOpen(askOf(c), Math.min(d.grid?.size?.rows ?? 10, d.grid?.size?.columns ?? 10))
      : c.type === 'classify' || c.type === 'classify_by_lines'
        ? shapes.length > 0 && (d.classificationCategories ?? []).length > 0 && shapes.every(s => !!s.correctCategory)
        : c.type === 'measure' || c.type === 'find_symmetry' ? shapes.length > 0
          : true;
    if (!ok) throw new Error(`A shape-builder ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the shape builder; the catalog's `teachingWorkspace` declares the rest. */
export const shapeBuilderLiveDomain: WorkspaceDomain<ShapeBuilderData> = {
  validate: validateShapeBuilderData,
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges[0].instruction, total: d.challenges.length }),
};
