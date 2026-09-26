import type { DiWordProblemSetupData } from '../../../primitives/visual-primitives/direct-instruction/DiWordProblemSetup';
import { wordProblemAskFor, wordProblemDataValid, wordProblemItems }
  from '../../../primitives/visual-primitives/direct-instruction/diWordProblemWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a payload whose stories cannot all be set up: the component would silently drop a story the plan
 *  gates refuse, so the service boundary refuses the payload instead. */
export function validateDiWordProblemSetupData(value: unknown): DiWordProblemSetupData {
  const d = value as DiWordProblemSetupData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.problems) || !d.problems.length || d.problems.length > 6
      || new Set(d.problems.map(problem => problem?.id)).size !== d.problems.length)
    throw new Error('Generated word problems have invalid lesson content.');
  if (!wordProblemDataValid(d)) throw new Error('A word problem cannot run in the teaching workspace.');
  return d;
}

/** What the live adapter needs from this family; the catalog's `teachingWorkspace` declares the rest. */
export const diWordProblemSetupLiveDomain: WorkspaceDomain<DiWordProblemSetupData> = {
  validate: validateDiWordProblemSetupData,
  initialState: data => {
    const items = wordProblemItems(data);
    return workspaceOpening({ title: data.title, task: wordProblemAskFor(items[0]), total: items.length });
  },
};
