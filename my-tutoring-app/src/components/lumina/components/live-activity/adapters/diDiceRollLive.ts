import type { DiDiceRollData } from '../../../primitives/visual-primitives/direct-instruction/DiDiceRoll';
import { diceAskFor, diceChallengeValid } from '../../../primitives/visual-primitives/direct-instruction/diDiceRollWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a pool whose items cannot be asked: die faces 1-6 and an answer that matches them. */
export const validateDiDiceRollData = (value: unknown) =>
  validateChallengePool<DiDiceRollData>(value, diceChallengeValid, {
    pool: 'Generated dice practice has invalid lesson content.',
    item: 'A dice item cannot run in the teaching workspace.' });

/** What the live adapter needs from this family; the catalog's `teachingWorkspace` declares the rest. */
export const diDiceRollLiveDomain: WorkspaceDomain<DiDiceRollData> = {
  validate: validateDiDiceRollData,
  initialState: data => workspaceOpening({ title: data.title, task: diceAskFor(data.challenges[0]), total: data.challenges.length }),
};
