import type { RegroupingWorkbenchData } from '../../../primitives/visual-primitives/math/RegroupingWorkbench';
import { operandsOf, resultOf, workspaceAssignment } from '../../../primitives/visual-primitives/math/regroupingWorkbenchWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const PROBLEM = /^\s*(\d+)\s*([+\-−])\s*(\d+)\s*$/;

/** Reject a regrouping lesson whose challenges cannot be attempted. */
export function validateRegroupingWorkbenchData(value: unknown): RegroupingWorkbenchData {
  const d = value as RegroupingWorkbenchData;
  if (!d || typeof d.title !== 'string' || !['addition', 'subtraction'].includes(d.operation)
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || typeof c.problem !== 'string'))
    throw new Error('Generated regrouping workbench has invalid lesson content.');
  // The component grades on the session operation with the operands read from the problem string, so the string's
  // sign must agree with it and a take-away must not go below zero (the digit boxes cannot write a negative).
  for (const c of d.challenges) {
    const m = PROBLEM.exec(c.problem);
    const [a, b] = operandsOf(c, d);
    const ok = !!m && (m[2] === '+') === (d.operation === 'addition') && resultOf(d.operation, a, b) >= 0;
    if (!ok) throw new Error(`A regrouping-workbench challenge "${c.problem}" cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the regrouping workbench; the catalog's `teachingWorkspace` declares the rest. */
export const regroupingWorkbenchLiveDomain: WorkspaceDomain<RegroupingWorkbenchData> = {
  validate: validateRegroupingWorkbenchData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0], d.operation, d).task,
    total: d.challenges.length }),
};
