import type { ParameterExplorerData } from '../../../primitives/visual-primitives/math/ParameterExplorer';
import {
  EMPTY_WORK, evaluateFormula, parameterCheck, parameterHarnessInput, settleChallenge, startingValues, workspaceAssignment,
  type Direction,
} from '../../../primitives/visual-primitives/math/parameterExplorerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['explore', 'predict-direction', 'predict-value', 'identify-relationship'];

/** Reject a parameter-explorer lesson whose challenges its own check cannot answer. */
export function validateParameterExplorerData(value: unknown): ParameterExplorerData {
  const d = value as ParameterExplorerData;
  if (!d || typeof d.title !== 'string' || typeof d.jsExpression !== 'string' || typeof d.formula !== 'string'
      || !Array.isArray(d.parameters) || d.parameters.length < 2
      || d.parameters.some(p => !p || typeof p.symbol !== 'string' || !(p.max > p.min) || !(p.default >= p.min && p.default <= p.max))
      || evaluateFormula(d.jsExpression, startingValues(d)) === null
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)))
    throw new Error('Generated parameter explorer has invalid lesson content.');
  for (const c of d.challenges) {
    // The key is the formula's at a setting on the slider (`settleChallenge` keeps it unchanged), and its own right
    // answer passes its own check.
    const settled = settleChallenge(d, c);
    const right = parameterHarnessInput(d, c, 'correct');
    const work = { ...EMPTY_WORK,
      direction: right?.kind === 'direction' ? (right.label === 'Increase' ? 'increase' : right.label === 'Decrease' ? 'decrease' : 'stay-same') as Direction : null,
      value: right?.kind === 'type' ? right.text : '',
      parameter: right?.kind === 'parameter' ? d.parameters.find(p => right.label.startsWith(`${p.symbol} (`))?.symbol ?? null : null,
      moved: right?.kind === 'move' ? [right.symbol] : [] };
    if (!settled || settled.prediction?.newValue !== c.prediction?.newValue || !right || !parameterCheck(d, c, work))
      throw new Error(`A parameter-explorer ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the parameter explorer; the catalog's `teachingWorkspace` declares the rest. */
export const parameterExplorerLiveDomain: WorkspaceDomain<ParameterExplorerData> = {
  validate: validateParameterExplorerData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d, d.challenges[0]).task, total: d.challenges.length }),
};
