import type { AtomBuilderData } from '../../../primitives/visual-primitives/chemistry/AtomBuilder';
import { passingBuilds } from '../../../primitives/visual-primitives/chemistry/atomBuild';
import { openAskOf, workspaceAssignment } from '../../../primitives/visual-primitives/chemistry/atomBuilderWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['build_element', 'identify', 'fill_shells', 'make_ion', 'make_isotope', 'find_on_table', 'make_atom'];
const count = (v: unknown) => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0);

/**
 * Reject an atom lesson whose items cannot be built on its tray: a classic target past the tray's limits or with no
 * count to check, or a make_atom ask no atom on the board passes.
 */
export function validateAtomBuilderData(value: unknown): AtomBuilderData {
  const d = value as AtomBuilderData;
  const max = d?.constraints?.maxProtons;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || typeof max !== 'number' || max < 1 || !d.showOptions
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type) || typeof c.instruction !== 'string'))
    throw new Error('Generated atom builder has invalid lesson content.');
  for (const c of d.challenges) {
    const ask = openAskOf(c);
    if (ask) {
      if (!passingBuilds(ask, max).length) throw new Error(`An atom-builder make_atom ask has no passing atom: "${c.instruction}".`);
      continue;
    }
    if (![c.targetProtons, c.targetNeutrons, c.targetElectrons].every(count)
        || (c.targetProtons === null && c.targetNeutrons === null && c.targetElectrons === null)
        || (c.targetProtons ?? 0) > max || (c.targetNeutrons ?? 0) > max + 10 || (c.targetElectrons ?? 0) > max + 4)
      throw new Error(`An atom-builder challenge cannot be built on the tray as generated: "${c.instruction}".`);
  }
  return d;
}

/** What the live adapter needs from the atom builder; the catalog's `teachingWorkspace` declares the rest. */
export const atomBuilderLiveDomain: WorkspaceDomain<AtomBuilderData> = {
  validate: validateAtomBuilderData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
