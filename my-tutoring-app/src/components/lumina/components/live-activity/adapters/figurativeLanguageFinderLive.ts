import type { FigurativeLanguageFinderData } from '../../../primitives/visual-primitives/literacy/FigurativeLanguageFinder';
import { figAssignment, figItems } from '../../../primitives/visual-primitives/literacy/figurativeSteps';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** A passage needs 2+ figures that sit inside one sentence; a build needs 3+ subjects. */
export function validateFigurativeLanguageFinderData(value: unknown): FigurativeLanguageFinderData {
  const d = value as FigurativeLanguageFinderData;
  if (!d || typeof d.title !== 'string') throw new Error('Generated figurative language finder has invalid lesson content.');
  const items = figItems(d);
  if (d.task === 'figurative_build' ? items.length < 3 : !items.some(i => i.kind === 'find'))
    throw new Error('A figurative language lesson needs figures to find or make.');
  return d;
}

/** What the live adapter needs from the finder; the catalog's `teachingWorkspace` declares the rest. */
export const figurativeLanguageFinderLiveDomain: WorkspaceDomain<FigurativeLanguageFinderData> = {
  validate: validateFigurativeLanguageFinderData,
  initialState: data => {
    const items = figItems(data);
    return workspaceOpening({ title: data.title, task: figAssignment(items[0]).task, total: items.length });
  },
};
