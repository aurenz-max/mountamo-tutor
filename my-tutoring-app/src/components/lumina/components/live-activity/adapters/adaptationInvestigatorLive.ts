import { teachingOpening, type WorkspaceDomain } from './adapterContract';
import type { AdaptationInvestigatorData } from '../../../primitives/visual-primitives/biology/AdaptationInvestigator';
import { TEACHING_CARDS, teachingTask, validateAdaptationTeaching }
  from '../../../primitives/visual-primitives/biology/adaptationInvestigatorWorkspace';

/** An ungraded teaching surface: the catalog's `teachingWorkspace.ungraded` supplies modes, copy and doctrine. */
export const adaptationInvestigatorLiveDomain: WorkspaceDomain<AdaptationInvestigatorData> = {
  validate: validateAdaptationTeaching,
  initialState: d => teachingOpening({ title: `${d.organism}: ${d.adaptation.trait}`, task: teachingTask(d), steps: TEACHING_CARDS.length }),
};
