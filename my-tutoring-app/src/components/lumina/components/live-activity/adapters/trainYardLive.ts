import type { TrainYardData } from '../../../primitives/visual-primitives/engineering/TrainYard';
import { trainYardAssignment } from '../../../primitives/visual-primitives/engineering/trainYardWorkspace';
import { TRAIN_YARD_TASKS } from '../../../primitives/visual-primitives/engineering/trainYardModel';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a yard the workspace cannot run: every job needs an id, an instruction, a load and a hill. */
export function validateTrainYardData(value: unknown): TrainYardData {
  const d = value as TrainYardData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated train yard has no title.');
  const jobs = Array.isArray(d.challenges) ? d.challenges : [];
  if (!jobs.length || jobs.length > 12 || new Set(jobs.map(c => c?.id)).size !== jobs.length
      || jobs.some(c => !c || typeof c.id !== 'string' || !c.id || !TRAIN_YARD_TASKS.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()
        || typeof c.amount !== 'number' || !(c.amount > 0) || !Number.isFinite(c.grade)))
    throw new Error('Generated train yard has invalid lesson content.');
  return d;
}

/** What the live adapter needs from the train yard; the catalog's `teachingWorkspace` declares the rest. */
export const trainYardLiveDomain: WorkspaceDomain<TrainYardData> = {
  validate: validateTrainYardData,
  initialState: data => workspaceOpening({
    title: data.title, task: trainYardAssignment(data.challenges[0]).task, total: data.challenges.length,
  }),
};
