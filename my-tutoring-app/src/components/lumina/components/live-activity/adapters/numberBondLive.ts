import type { NumberBondData } from '../../../primitives/visual-primitives/math/NumberBond';
import { buildBondItems } from '../../../primitives/visual-primitives/math/numberBondScript';
import { workspaceAssignment } from '../../../primitives/visual-primitives/math/numberBondWorkspace';
import { expandNumberBondInteractions } from '../../../primitives/visual-primitives/math/numberBondModes';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const BOND_TYPES = ['decompose', 'missing-part', 'related-fact', 'ten-and-ones', 'fact-family', 'build-equation'];

/** Reject a bond whose challenges cannot be ASKED before it reaches a five-year-old. */
export function validateNumberBondData(value: unknown): NumberBondData {
  const d = value as NumberBondData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !Number.isInteger(d.maxNumber) || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id
        || !BOND_TYPES.includes(c.type) || !Number.isInteger(c.whole)))
    throw new Error('Generated number bond has invalid lesson content.');
  // `buildBondItems` DROPS anything unaskable rather than repairing it, so an
  // empty expansion means this lesson would mount with nothing to ask.
  if (!bondItems(d).length) throw new Error('A number-bond challenge cannot run in the DI lesson.');
  return d;
}

/** The judged items the component would build, expanded exactly as it expands them. */
const bondItems = (d: NumberBondData) => expandNumberBondInteractions(
  buildBondItems(d.challenges, { band: d.gradeBand ?? 'K', maxNumber: d.maxNumber ?? 10 }).items);

/** What the live adapter needs from number bond; the catalog's `teachingWorkspace` declares the rest. */
export const numberBondLiveDomain: WorkspaceDomain<NumberBondData> = {
  validate: validateNumberBondData,
  initialState: data => {
    const items = bondItems(data);
    return workspaceOpening({ title: data.title, total: items.length,
      task: workspaceAssignment(items[0], { counters: [], found: [], tiles: [] }).task });
  },
};
