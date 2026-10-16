import type { MixingAndDissolvingData } from '../../../primitives/visual-primitives/chemistry/MixingAndDissolving';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['dissolve_sort', 'particle_explain', 'factor_test', 'saturation', 'separate', 'concentration', 'classify'];

/** Reject a lab whose challenges cannot be attempted: every check reads the challenge's own `correctOptionIndex`. */
export function validateMixingAndDissolvingData(value: unknown): MixingAndDissolvingData {
  const d = value as MixingAndDissolvingData;
  if (!d || typeof d.title !== 'string' || !d.solvent || typeof d.solvent.name !== 'string'
      || !Array.isArray(d.substances) || !d.substances.length
      || d.substances.some(s => !s || typeof s.id !== 'string' || typeof s.name !== 'string' || !s.name.trim())
      || new Set(d.substances.map(s => s.id)).size !== d.substances.length)
    throw new Error('Generated mixing and dissolving lab has invalid lesson content.');
  const chs = Array.isArray(d.challenges) ? d.challenges : [];
  if (!chs.length || chs.length > 12) throw new Error('Generated mixing and dissolving lab has no askable challenge.');
  if (new Set(chs.map(c => c?.id)).size !== chs.length) throw new Error('Mixing and dissolving challenge ids repeat.');
  for (const c of chs) {
    if (!c || typeof c.id !== 'string' || !TYPES.includes(c.type) || typeof c.instruction !== 'string' || !c.instruction.trim()
        || !Array.isArray(c.options) || c.options.length < 2 || c.options.some(o => typeof o !== 'string' || !o.trim())
        || new Set(c.options.map(o => o.trim().toLowerCase())).size !== c.options.length
        || !Number.isInteger(c.correctOptionIndex) || c.correctOptionIndex < 0 || c.correctOptionIndex >= c.options.length)
      throw new Error('A mixing-and-dissolving challenge cannot be answered as generated.');
  }
  return d;
}

/** What the live adapter needs from the lab; the catalog's `teachingWorkspace` declares the rest. */
export const mixingAndDissolvingLiveDomain: WorkspaceDomain<MixingAndDissolvingData> = {
  validate: validateMixingAndDissolvingData,
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges[0].instruction, total: d.challenges.length }),
};
