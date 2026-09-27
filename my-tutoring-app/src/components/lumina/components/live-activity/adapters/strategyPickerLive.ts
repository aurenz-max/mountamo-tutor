import type { StrategyPickerData } from '../../../primitives/visual-primitives/math/StrategyPicker';
import { strategyPickerAssignment } from '../../../primitives/visual-primitives/math/strategyPickerWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const strings = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.every(s => typeof s === 'string');

/** Reject a challenge the picker cannot check: its answer must be reachable with the controls it draws. */
export const validateStrategyPickerData = (value: unknown): StrategyPickerData => validateChallengePool<StrategyPickerData>(value,
  c => {
    if (!c || typeof c.instruction !== 'string' || !c.instruction || !c.problem) return false;
    const { operand1, operand2, operation, result } = c.problem;
    if (typeof c.problem.equation !== 'string' || typeof result !== 'number'
      || result !== (operation === 'subtraction' ? operand1 - operand2 : operand1 + operand2)) return false;
    // The stepper runs 0..20.
    const reachable = result >= 0 && result <= 20;
    switch (c.type) {
      case 'guided-strategy':
      case 'try-another': return reachable && typeof c.assignedStrategy === 'string';
      case 'choose-your-strategy': return reachable && strings(c.availableStrategies);
      // One option is the answer handed over, not a choice.
      case 'match-strategy': return typeof c.workedSolution === 'string' && !!c.workedSolution && strings(c.strategyOptions)
        && c.strategyOptions.length >= 2 && typeof c.correctStrategy === 'string' && c.strategyOptions.includes(c.correctStrategy);
      case 'compare': return strings(c.strategies) && typeof c.comparisonQuestion === 'string' && !!c.comparisonQuestion;
      default: return false;
    }
  },
  { pool: 'Generated strategy picker has invalid lesson content.', item: 'A strategy-picker challenge cannot be checked.' });

/** What the live adapter needs from the strategy picker; the catalog's `teachingWorkspace` declares the rest. */
export const strategyPickerLiveDomain: WorkspaceDomain<StrategyPickerData> = {
  validate: validateStrategyPickerData,
  initialState: data => workspaceOpening({ title: data.title, task: strategyPickerAssignment(data.challenges[0]).task,
    total: data.challenges.length }),
};
