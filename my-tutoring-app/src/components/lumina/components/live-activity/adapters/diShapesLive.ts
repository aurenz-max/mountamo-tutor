import type { DiShapesData } from '../../../primitives/visual-primitives/direct-instruction/DiShapes';
import { shapesAskFor, shapesChallengeValid } from '../../../primitives/visual-primitives/direct-instruction/diShapesWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a pool whose items cannot be asked: a drawable shape with its answer word (and an object on real-object items). */
export const validateDiShapesData = (value: unknown) =>
  validateChallengePool<DiShapesData>(value, shapesChallengeValid, {
    pool: 'Generated shapes have invalid lesson content.',
    item: 'A shape item cannot run in the teaching workspace.' });

/** What the live adapter needs from this family; the catalog's `teachingWorkspace` declares the rest. */
export const diShapesLiveDomain: WorkspaceDomain<DiShapesData> = {
  validate: validateDiShapesData,
  initialState: data => workspaceOpening({ title: data.title, task: shapesAskFor(data.challenges[0]), total: data.challenges.length }),
};
