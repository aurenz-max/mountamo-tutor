import { teachingOpening, type WorkspaceDomain } from './adapterContract';
import type { IntroBriefingData } from '../../../types';
import { teachingTask, validateBriefTeaching } from '../../../primitives/curatorBriefWorkspace';

/** The lesson's opening screen, an ungraded teaching surface: three spoken beats, then the learner's Start. */
export const curatorBriefLiveDomain: WorkspaceDomain<IntroBriefingData> = {
  validate: validateBriefTeaching,
  initialState: d => teachingOpening({ title: d.topic, task: teachingTask(d), steps: 3 }),
};
