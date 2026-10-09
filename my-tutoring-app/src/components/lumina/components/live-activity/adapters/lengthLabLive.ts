import type { LengthLabData } from '../../../primitives/visual-primitives/math/LengthLab';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CHALLENGE_TYPES = ['compare', 'tile_and_count', 'order', 'indirect', 'estimate_then_tile', 'two_unit_compare'];
const len = (n: unknown) => Number.isInteger(n) && (n as number) > 0;

/** Reject a length lesson whose challenges cannot be attempted. */
export function validateLengthLabData(value: unknown): LengthLabData {
  const d = value as LengthLabData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim() || !c.objectName0 || !len(c.objectLength0)))
    throw new Error('Generated length lab has invalid lesson content.');
  // Each type needs the material its own check reads, or it mounts unanswerable.
  for (const c of d.challenges) {
    const order = (c.correctOrderCsv ?? '').split(',').map(s => s.trim());
    const names = [c.objectName0, c.objectName1, c.objectName2];
    const ok = c.type === 'compare' ? !!c.objectName1 && ['longer', 'shorter', 'same'].includes(c.correctAnswer)
      : c.type === 'tile_and_count' ? len(c.correctUnitCount ?? c.objectLength0)
      : c.type === 'estimate_then_tile' ? (c.estimateOptions ?? []).includes(c.correctUnitCount || c.objectLength0)
      : c.type === 'two_unit_compare' ? len(c.correctUnitCount) && len(c.correctUnitCountB)
        && c.correctUnitCount !== c.correctUnitCountB && (c.unitType || d.unitType) !== (c.unitTypeB || d.unitType)
      : c.type === 'order' ? !!c.objectName1 && !!c.objectName2 && order.length === 3
        && order.every(n => names.includes(n)) && new Set(order).size === 3
      : !!c.objectName1 && !!c.clue0 && !!c.clue1 && [c.objectName0, c.objectName1, 'same'].includes(c.correctAnswer);
    if (!ok) throw new Error(`A length-lab ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the length lab; the catalog's `teachingWorkspace` declares the rest. */
export const lengthLabLiveDomain: WorkspaceDomain<LengthLabData> = {
  validate: validateLengthLabData,
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges[0].instruction, total: d.challenges.length }),
};
