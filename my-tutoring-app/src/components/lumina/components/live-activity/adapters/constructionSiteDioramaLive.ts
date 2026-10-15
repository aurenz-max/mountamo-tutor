import type { ConstructionSiteDioramaData } from '../../../primitives/visual-primitives/engineering/ConstructionSiteDiorama';
import { constructionAssignment } from '../../../primitives/visual-primitives/engineering/constructionWorkspace';
import { CONSTRUCTION_TASKS, MATERIALS } from '../../../primitives/visual-primitives/engineering/constructionModel';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a work site the workspace cannot run: every load needs an id, an instruction, a material and a count. */
export function validateConstructionSiteDioramaData(value: unknown): ConstructionSiteDioramaData {
  const d = value as ConstructionSiteDioramaData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated work site has no title.');
  const loads = Array.isArray(d.challenges) ? d.challenges : [];
  if (!loads.length || loads.length > 12 || new Set(loads.map(c => c?.id)).size !== loads.length
      || loads.some(c => !c || typeof c.id !== 'string' || !c.id || !(CONSTRUCTION_TASKS as readonly string[]).includes(c.type)
        || !(MATERIALS as readonly string[]).includes(c.material)
        || !Number.isInteger(c.target) || c.target < 1
        || (c.units === 'tons' && (!c.scoopTons || c.capacityTons !== c.target * c.scoopTons))
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated work site has invalid lesson content.');
  return d;
}

/** What the live adapter needs from the work site; the catalog's `teachingWorkspace` declares the rest. */
export const constructionSiteDioramaLiveDomain: WorkspaceDomain<ConstructionSiteDioramaData> = {
  validate: validateConstructionSiteDioramaData,
  initialState: data => workspaceOpening({
    title: data.title, task: constructionAssignment(data.challenges[0]).task, total: data.challenges.length,
  }),
};
