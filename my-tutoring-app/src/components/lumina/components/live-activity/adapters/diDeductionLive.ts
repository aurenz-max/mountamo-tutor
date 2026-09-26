import type { DiDeductionData } from '../../../primitives/visual-primitives/direct-instruction/DiDeduction';
import { deductionAskFor, deductionDataValid, deductionItems } from '../../../primitives/visual-primitives/direct-instruction/diDeductionWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a payload whose rules cannot all be asked: the component would silently drop a rule the plan
 *  gates refuse, so the service boundary refuses the payload instead. */
export function validateDiDeductionData(value: unknown): DiDeductionData {
  const d = value as DiDeductionData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.rules) || !d.rules.length || d.rules.length > 6
      || new Set(d.rules.map(rule => rule?.id)).size !== d.rules.length)
    throw new Error('Generated deduction rules have invalid lesson content.');
  if (!deductionDataValid(d)) throw new Error('A deduction rule cannot run in the teaching workspace.');
  return d;
}

/** What the live adapter needs from this family; the catalog's `teachingWorkspace` declares the rest. */
export const diDeductionLiveDomain: WorkspaceDomain<DiDeductionData> = {
  validate: validateDiDeductionData,
  initialState: data => {
    const items = deductionItems(data);
    return workspaceOpening({ title: data.title, task: deductionAskFor(items[0]), total: items.length });
  },
};
