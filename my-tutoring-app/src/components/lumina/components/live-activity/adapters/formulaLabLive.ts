import type { FormulaLabData } from '../../../primitives/visual-primitives/math/FormulaLab';
import { formulaCheck, formulaHarnessInput, workspaceAssignment } from '../../../primitives/visual-primitives/math/formulaLabWorkspace';
import { evaluateFormulaExpression, validateFormulaExpression } from '../../../primitives/visual-primitives/math/formulaLabMath';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['free-explore', 'predict-direction', 'predict-magnitude', 'construct-formula', 'transfer-apply'];

/** Reject a formula-lab lesson whose challenges its own check cannot answer. */
export function validateFormulaLabData(value: unknown): FormulaLabData {
  const d = value as FormulaLabData;
  if (!d || typeof d.title !== 'string' || typeof d.expression !== 'string' || !Array.isArray(d.variables) || !d.variables.length
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || !validateFormulaExpression(d.expression, d.variables.map(v => v.symbol))
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || !d.variables.some(v => v.symbol === c.changedVariableSymbol)
        || c.baselineValues?.length !== d.variables.length || c.targetValues?.length !== d.variables.length))
    throw new Error('Generated formula lab has invalid lesson content.');
  // Each challenge's key is what the formula gives, and its own right answer passes its own check.
  for (const c of d.challenges) {
    const scope = (values: number[]) => Object.fromEntries(d.variables.map((v, i) => [v.symbol, values[i]]));
    const target = evaluateFormulaExpression(d.expression, scope(c.targetValues));
    const right = formulaHarnessInput(d, c, 'correct');
    const work = { prediction: right?.kind === 'predict' ? right.percent / 100 : null, tokens: right?.kind === 'build' ? right.tokens : [],
      answer: right?.kind === 'type' ? right.text : '', value: right?.kind === 'value' ? right.value : null };
    if (target === null || Math.abs(target - c.expectedTargetOutput) > 1e-6 * Math.max(1, Math.abs(target))
        || !formulaCheck(d, c, work).correct)
      throw new Error(`A formula-lab ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the formula lab; the catalog's `teachingWorkspace` declares the rest. */
export const formulaLabLiveDomain: WorkspaceDomain<FormulaLabData> = {
  validate: validateFormulaLabData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d, d.challenges[0]).task, total: d.challenges.length }),
};
