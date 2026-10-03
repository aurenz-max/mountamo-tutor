import type { AdditionFactStrategiesData } from '../../../primitives/visual-primitives/math/AdditionFactStrategies';
import { additionFactAssignment } from '../../../primitives/visual-primitives/math/additionFactStrategiesWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const digit = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 9;

/** Reject a fact the pad cannot answer: single-digit addends and a sum that matches them. */
export const validateAdditionFactStrategiesData = (value: unknown): AdditionFactStrategiesData =>
  validateChallengePool<AdditionFactStrategiesData>(value,
    c => !!c && digit(c.a) && digit(c.b) && c.sum === c.a + c.b,
    { pool: 'Generated addition fact strategies has invalid lesson content.', item: 'An addition fact cannot be checked.' });

/** What the live adapter needs from addition fact strategies; the catalog's `teachingWorkspace` declares the rest. */
export const additionFactStrategiesLiveDomain: WorkspaceDomain<AdditionFactStrategiesData> = {
  validate: validateAdditionFactStrategiesData,
  initialState: data => workspaceOpening({ title: data.title, task: additionFactAssignment(data.challenges[0]).task,
    total: data.challenges.length }),
};
