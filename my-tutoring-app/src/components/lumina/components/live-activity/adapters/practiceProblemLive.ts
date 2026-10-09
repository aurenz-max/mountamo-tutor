import type { PracticeProblemData } from '../../../primitives/visual-primitives/math/PracticeProblem';
import { workspaceAssignment } from '../../../primitives/visual-primitives/math/practiceProblemWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a practice problem the judge cannot check: one problem, a worked solution of 2+ steps, an answer. */
export function validatePracticeProblemData(value: unknown): PracticeProblemData {
  const d = value as PracticeProblemData;
  if (!d || typeof d.title !== 'string' || !d.problem || typeof d.problem.statement !== 'string' || !d.problem.statement.trim()
      || !Array.isArray(d.steps) || d.steps.length < 2
      || d.steps.some(s => !s || typeof s.title !== 'string' || typeof s.canonicalBody !== 'string' || !s.canonicalBody.trim())
      || typeof d.canonicalAnswer !== 'string' || !d.canonicalAnswer.trim())
    throw new Error('Generated practice problem has no checkable worked solution.');
  return d;
}

/** What the live adapter needs from the practice problem; the catalog's `teachingWorkspace` declares the rest. */
export const practiceProblemLiveDomain: WorkspaceDomain<PracticeProblemData> = {
  validate: validatePracticeProblemData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d).task, total: 1 }),
};
