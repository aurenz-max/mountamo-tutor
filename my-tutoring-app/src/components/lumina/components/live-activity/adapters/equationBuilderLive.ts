import type { EquationBuilderData } from '../../../primitives/visual-primitives/math/EquationBuilder';
import { equationBuilderAssignment, evaluateEquation, matchesAcceptedForm, parseEquationTokens }
  from '../../../primitives/visual-primitives/math/equationBuilderWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Whether the pool holds every token of an equation, counting repeats. */
const buildable = (form: string, tiles: string[]) => {
  const pool = [...tiles];
  return parseEquationTokens(form).every(t => { const i = pool.indexOf(t); if (i < 0) return false; pool.splice(i, 1); return true; });
};

/** Reject a challenge the builder cannot check: its answer must be reachable with the controls it draws. */
export const validateEquationBuilderData = (value: unknown): EquationBuilderData => validateChallengePool<EquationBuilderData>(value,
  c => {
    if (!c || typeof c.instruction !== 'string' || !c.instruction) return false;
    switch (c.type) {
      case 'build': return typeof c.targetEquation === 'string' && evaluateEquation(c.targetEquation)
        && Array.isArray(c.availableTiles) && buildable(c.targetEquation, c.availableTiles);
      case 'rewrite': return typeof c.originalEquation === 'string' && Array.isArray(c.acceptedForms)
        && Array.isArray(c.availableTiles) && c.acceptedForms.some(f => buildable(f, c.availableTiles!)
          && !matchesAcceptedForm(parseEquationTokens(c.originalEquation!), [f]));
      case 'missing-value': return typeof c.equation === 'string' && typeof c.correctValue === 'number'
        && Array.isArray(c.options) && c.options.includes(c.correctValue);
      case 'true-false': return typeof c.displayEquation === 'string' && typeof c.isTrue === 'boolean';
      case 'balance': return typeof c.leftSide === 'string' && typeof c.rightSide === 'string'
        && c.rightSide.includes('?') && typeof c.correctAnswer === 'number';
      default: return false;
    }
  },
  { pool: 'Generated equation builder has invalid lesson content.', item: 'An equation-builder challenge cannot be checked.' });

/** What the live adapter needs from the equation builder; the catalog's `teachingWorkspace` declares the rest. */
export const equationBuilderLiveDomain: WorkspaceDomain<EquationBuilderData> = {
  validate: validateEquationBuilderData,
  initialState: data => workspaceOpening({ title: data.title, task: equationBuilderAssignment(data.challenges[0]).task,
    total: data.challenges.length }),
};
