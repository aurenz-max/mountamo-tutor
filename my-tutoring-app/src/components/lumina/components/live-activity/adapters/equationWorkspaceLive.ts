import type { EquationWorkspaceChallenge, EquationWorkspaceData } from '../../../primitives/visual-primitives/math/EquationWorkspace';
import { mergeCommutingSteps, workspaceAssignment } from '../../../primitives/visual-primitives/math/equationWorkspaceDomain';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['guided-solve', 'solve', 'multi-step', 'identify-operation'];

/**
 * An item the activity can check: a known type, an equation and variable, at least one solution step, and every step
 * (and the identify key) an operation the menu offers, so the right answer can be tapped.
 */
function answerable(c: EquationWorkspaceChallenge): boolean {
  if (!c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)) return false;
  if (typeof c.equation !== 'string' || !c.equation.trim() || typeof c.targetVariable !== 'string' || !c.targetVariable.trim()) return false;
  if (!Array.isArray(c.solutionSteps) || !c.solutionSteps.length || !Array.isArray(c.availableOperations)) return false;
  const ids = new Set(c.availableOperations.map(o => o?.id));
  if (ids.size !== c.availableOperations.length || ids.size < 2) return false;
  if (!c.solutionSteps.every(s => s && ids.has(s.operationId) && typeof s.resultLatex === 'string')) return false;
  return c.type !== 'identify-operation' || ids.has(c.correctOperationId ?? c.solutionSteps[0].operationId);
}

export const validateEquationWorkspaceData = (value: unknown) => validateChallengePool<EquationWorkspaceData>(value,
  c => answerable(c) && answerable(mergeCommutingSteps(c)),
  { pool: 'Generated equation workspace has invalid lesson content.', item: 'An equation-workspace challenge cannot be answered from its menu.' });

/** What the live adapter needs from the equation workspace; the catalog's `teachingWorkspace` declares the rest. */
export const equationWorkspaceLiveDomain: WorkspaceDomain<EquationWorkspaceData> = {
  validate: validateEquationWorkspaceData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
