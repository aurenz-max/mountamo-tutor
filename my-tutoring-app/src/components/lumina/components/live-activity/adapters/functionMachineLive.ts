import type { FunctionMachineData } from '../../../primitives/visual-primitives/math/FunctionMachine';
import { evaluateRule, makeRuleTarget } from '../../../primitives/visual-primitives/math/functionMachineDomain';
import { workspaceAssignment } from '../../../primitives/visual-primitives/math/functionMachineWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CHALLENGE_TYPES = ['observe', 'predict', 'discover_rule', 'create_rule', 'make_rule'];

/** Reject a function-machine lesson whose challenges cannot be attempted: every rule runs on its inputs, or names a pair. */
export function validateFunctionMachineData(value: unknown): FunctionMachineData {
  const d = value as FunctionMachineData;
  if (!d || typeof d.title !== 'string' || !CHALLENGE_TYPES.includes(d.challengeType) || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || typeof c.rule !== 'string' || !Array.isArray(c.inputQueue)))
    throw new Error('Generated function machine has invalid lesson content.');
  for (const c of d.challenges) {
    const ok = d.challengeType === 'make_rule' ? !!makeRuleTarget(c)
      : c.inputQueue.length >= 2 && c.inputQueue.every(x => typeof x === 'number' && evaluateRule(c.rule, x) !== null);
    if (!ok) throw new Error(`A function-machine ${d.challengeType} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the function machine; the catalog's `teachingWorkspace` declares the rest. */
export const functionMachineLiveDomain: WorkspaceDomain<FunctionMachineData> = {
  validate: validateFunctionMachineData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0], d.challengeType).task,
    total: d.challenges.length }),
};
