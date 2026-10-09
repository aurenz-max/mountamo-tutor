import type { ShapeComposerData } from '../../../primitives/visual-primitives/math/ShapeComposer';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CHALLENGE_TYPES = ['compose-match', 'compose-picture', 'decompose', 'free-create', 'how-many-ways'];

/** Reject a shape composer lesson whose challenges cannot be attempted. */
export function validateShapeComposerData(value: unknown): ShapeComposerData {
  const d = value as ShapeComposerData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated shape composer has invalid lesson content.');
  // Each type needs the material its own check reads, or it mounts unanswerable.
  for (const c of d.challenges) {
    const ok = c.type === 'compose-match'
      ? !!c.pieces?.length && c.pieces.every(p => p.shape && Number.isFinite(p.targetX) && Number.isFinite(p.targetY))
      : c.type === 'compose-picture'
        ? !!c.pictureSlots?.length && !!c.availableShapes?.length
          // The palette must hold every shape the picture's spots need.
          && c.pictureSlots.every(slot => (c.availableShapes ?? []).some(s => s.shape === slot.shape
            && s.count >= c.pictureSlots!.filter(x => x.shape === slot.shape).length))
      : c.type === 'decompose'
        ? !!c.compositeShapePath && !!c.expectedComponents?.length && c.expectedComponents.every(p => p.shape && p.count > 0)
      : c.type === 'how-many-ways'
        ? Number.isInteger(c.minimumPiecesNeeded) && (c.minimumPiecesNeeded ?? 0) > 0 && !!c.targetForComposition
      : !c.recipe || c.recipe.every(r => r.shape && r.count > 0);
    if (!ok) throw new Error(`A shape-composer ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the shape composer; the catalog's `teachingWorkspace` declares the rest. */
export const shapeComposerLiveDomain: WorkspaceDomain<ShapeComposerData> = {
  validate: validateShapeComposerData,
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges[0].instruction, total: d.challenges.length }),
};
