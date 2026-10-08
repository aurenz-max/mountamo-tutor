import type { MoleculeConstructorData } from '../../../primitives/visual-primitives/chemistry/MoleculeConstructor';
import { askParts, askNeeds } from '../../../primitives/visual-primitives/chemistry/moleculeBuild';
import { askOf, workspaceAssignment } from '../../../primitives/visual-primitives/chemistry/moleculeConstructorWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CHALLENGE_TYPES = ['free_build', 'build_target', 'identify', 'formula_write', 'predict_bonds', 'shape_predict', 'make_molecule'];

/** Reject a molecule lesson whose challenges cannot be attempted. */
export function validateMoleculeConstructorData(value: unknown): MoleculeConstructorData {
  const d = value as MoleculeConstructorData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || !Array.isArray(d.palette?.availableElements) || !d.palette.availableElements.length
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)))
    throw new Error('Generated molecule constructor has invalid lesson content.');
  // make_molecule needs an ask with at least one property whose atoms the palette offers.
  for (const c of d.challenges) {
    if (c.type !== 'make_molecule') continue;
    const ask = askOf(c);
    if (!askParts(ask).length || askNeeds(ask).some(e => !d.palette.availableElements.includes(e)))
      throw new Error(`A molecule-constructor make_molecule challenge cannot be answered as generated: "${c.instruction}".`);
  }
  return d;
}

/** What the live adapter needs from the molecule constructor; the catalog's `teachingWorkspace` declares the rest. */
export const moleculeConstructorLiveDomain: WorkspaceDomain<MoleculeConstructorData> = {
  validate: validateMoleculeConstructorData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
