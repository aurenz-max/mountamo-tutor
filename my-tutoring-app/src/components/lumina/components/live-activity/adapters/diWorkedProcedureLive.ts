import type { DiWorkedProcedureData } from '../../../primitives/visual-primitives/direct-instruction/DiWorkedProcedure';
import { workedProcedureAskFor, workedProcedureDataValid, workedProcedureItems }
  from '../../../primitives/visual-primitives/direct-instruction/diWorkedProcedureWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a payload whose problems cannot all be worked: the component would silently drop a problem the
 *  plan gates refuse, so the service boundary refuses the payload instead. */
export function validateDiWorkedProcedureData(value: unknown): DiWorkedProcedureData {
  const d = value as DiWorkedProcedureData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.problems) || !d.problems.length || d.problems.length > 6
      || new Set(d.problems.map(problem => problem?.id)).size !== d.problems.length)
    throw new Error('Generated subtraction problems have invalid lesson content.');
  if (!workedProcedureDataValid(d)) throw new Error('A subtraction problem cannot run in the teaching workspace.');
  return d;
}

/** What the live adapter needs from this family; the catalog's `teachingWorkspace` declares the rest. */
export const diWorkedProcedureLiveDomain: WorkspaceDomain<DiWorkedProcedureData> = {
  validate: validateDiWorkedProcedureData,
  initialState: data => {
    const items = workedProcedureItems(data);
    return workspaceOpening({ title: data.title, task: workedProcedureAskFor(items[0]), total: items.length });
  },
};
