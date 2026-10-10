import type { MatrixDisplayData } from '../../../primitives/visual-primitives/math/MatrixDisplay';
import { workspaceAssignment } from '../../../primitives/visual-primitives/math/matrixDisplayWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['transpose', 'add', 'subtract', 'multiply', 'determinant', 'inverse'];
const isGrid = (m: unknown): m is number[][] => Array.isArray(m) && m.length > 0 && m.every(row => Array.isArray(row)
  && row.length === (m as unknown[][])[0].length && row.length > 0 && row.every(v => typeof v === 'number' && Number.isFinite(v)));

/** Reject a matrix lesson whose challenges cannot be attempted. */
export function validateMatrixDisplayData(value: unknown): MatrixDisplayData {
  const d = value as MatrixDisplayData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.challengeType)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated matrix display has invalid lesson content.');
  // Each item needs what its own check reads: the matrix, the second matrix of a two-matrix operation, and either a
  // determinant (determinant) or a result grid (every other operation).
  for (const c of d.challenges) {
    const two = c.challengeType === 'add' || c.challengeType === 'subtract' || c.challengeType === 'multiply';
    const ok = isGrid(c.values) && (!two || isGrid(c.secondMatrix?.values))
      && (c.challengeType === 'determinant'
        ? typeof c.expectedScalar === 'number' && Number.isFinite(c.expectedScalar)
        : c.expectedScalar === undefined && isGrid(c.expectedMatrix));
    if (!ok) throw new Error(`A matrix-display ${c.challengeType} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the matrix display; the catalog's `teachingWorkspace` declares the rest. */
export const matrixDisplayLiveDomain: WorkspaceDomain<MatrixDisplayData> = {
  validate: validateMatrixDisplayData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
