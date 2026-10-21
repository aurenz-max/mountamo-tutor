/**
 * molecule-constructor's boss (`components/live-activity/boss.ts`), bespoke because every item is a build or a typed
 * answer the activity checks: the card is `moleculeConstructor.card.ts`; this file validates a lesson, lists its
 * challenges, asks one, carries the lever set and plays the harness.
 */
import type { MoleculeConstructorChallenge, MoleculeConstructorData } from './MoleculeConstructor';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { askNeeds, askParts } from './moleculeBuild';
import { askOf, moleculeHarnessInputs, moleculeTask } from './moleculeConstructorWorkspace';
import { MOLECULE_LEVERS, simplerMolecule } from './moleculeConstructorLevers';
import { moleculeConstructorCard, type MoleculeMiss } from './moleculeConstructor.card';

const CHALLENGE_TYPES = ['free_build', 'build_target', 'identify', 'formula_write', 'predict_bonds', 'shape_predict', 'make_molecule'];
const SIMPLER = '~simpler';

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

export const moleculeConstructorBoss = defineBoss<MoleculeConstructorData, MoleculeConstructorChallenge, MoleculeMiss>({
  card: moleculeConstructorCard,
  validate: validateMoleculeConstructorData,
  items: d => d.challenges,
  ask: moleculeTask,
  // A build or a typed answer the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, moleculeTask(c), null),
  levers: MOLECULE_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/chemistry/MoleculeConstructor.tsx',
    instanceId: 'molecules',
    defaults: { grade: 'Grade 4', mode: 'make_molecule', topic: 'Atoms bond to make molecules' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice item a simplify lever opened (`~simpler`: make_molecule's smaller ask,
    // a smaller target or drawn molecule), rebuilt from its parent with the session's data.
    current: ctx => {
      const data = ctx.data as MoleculeConstructorData;
      const all = data.challenges ?? [];
      const id = String(ctx.itemId ?? '');
      const parent = id.endsWith(SIMPLER) ? all.find(c => `${c.id}${SIMPLER}` === id) : undefined;
      return parent ? simplerMolecule(parent, { challenges: all, palette: data.palette }) ?? undefined : all.find(c => c.id === id);
    },
    // Every type through its real controls (`moleculeHarnessInputs`): make_molecule builds a molecule the ask's menu
    // proves passes and presses "I'm done!" (wrong: one hydrogen short, `open_valence`); build_target adds the target's
    // atoms and joins them (wrong: one atom short, `atoms_off`); identify and formula_write type; the free types join
    // two hydrogens (wrong: two unjoined, `no_bonds`).
    play: (right, c, ctx) => moleculeHarnessInputs(c, !right, ctx.demand),
  },
});
