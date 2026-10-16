import type { CellBuilderData } from '../../../primitives/visual-primitives/biology/CellBuilder';
import { boardCards, resolveCellBuilderPhases, workspaceAssignment } from '../../../primitives/visual-primitives/biology/cellBuilderWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

/**
 * Reject a cell model a mission cannot be checked on: no structures, duplicate ids, or a mission's board empty or
 * missing its key (a region, a job card, an abundance on a needed structure).
 */
export function validateCellBuilderData(value: unknown): CellBuilderData {
  const d = value as CellBuilderData;
  if (!d || !text(d.title) || !Array.isArray(d.organelles) || d.organelles.length < 2 || !Array.isArray(d.functionMatches))
    throw new Error('Generated cell builder has invalid lesson content.');
  const ids = d.organelles.map(o => o?.id);
  if (new Set(ids).size !== ids.length || d.organelles.some(o => !o || !text(o.id) || !text(o.name) || typeof o.belongsInCell !== 'boolean'))
    throw new Error('A generated cell-builder structure has no id, name or keep/reject key.');
  const valid = d.organelles.filter(o => o.belongsInCell);
  if (!valid.length) throw new Error('A generated cell has no structure that belongs in it.');
  for (const phase of resolveCellBuilderPhases(d)) {
    const cards = boardCards(d, { id: phase, phase });
    if (!cards.length) throw new Error(`The cell-builder ${phase} board has no structure to answer.`);
    if (phase === 'cell_inventory' && !d.organelles.some(o => !o.belongsInCell))
      throw new Error('The cell-builder cell_inventory board has no structure to reject.');
    if (phase === 'organelle_placement' && valid.some(o => !o.correctZone))
      throw new Error('A needed structure has no best-fit region.');
    if (phase === 'structure_function' && cards.length < valid.length)
      throw new Error('A needed structure has no job card.');
  }
  return d;
}

/** What the live adapter needs from the cell builder; the catalog's `teachingWorkspace` declares the rest. */
export const cellBuilderLiveDomain: WorkspaceDomain<CellBuilderData> = {
  validate: validateCellBuilderData,
  initialState: d => {
    const phases = resolveCellBuilderPhases(d);
    return workspaceOpening({ title: d.title, task: workspaceAssignment(d, { id: phases[0], phase: phases[0] }).task, total: phases.length });
  },
};
