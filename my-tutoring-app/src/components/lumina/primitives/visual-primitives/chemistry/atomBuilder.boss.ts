/**
 * atom-builder's boss (`components/live-activity/boss.ts`), bespoke because every item is a build on the particle tray
 * the activity checks: the card is `atomBuilder.card.ts`; this file validates a lesson, lists its challenges, asks one,
 * carries the lever set and plays the harness.
 */
import type { AtomBuilderChallenge, AtomBuilderData } from './AtomBuilder';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { passingBuilds } from './atomBuild';
import { atomHarnessInputs, openAskOf } from './atomBuilderWorkspace';
import { ATOM_LEVERS, practiceById } from './atomBuilderLevers';
import { atomBuilderCard, type AtomMiss } from './atomBuilder.card';

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

const ask = (c: AtomBuilderChallenge) => c.instruction;

export const atomBuilderBoss = defineBoss<AtomBuilderData, AtomBuilderChallenge, AtomMiss>({
  card: atomBuilderCard,
  validate: validateAtomBuilderData,
  items: d => d.challenges,
  ask,
  // A build the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, ask(c), null),
  levers: ATOM_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/chemistry/AtomBuilder.tsx',
    instanceId: 'atoms',
    defaults: { grade: 'Grade 7', mode: 'make_atom', topic: 'Atoms are made of protons, neutrons and electrons' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the ungraded practice item a simplify lever opened (`~first`, `~simpler`), rebuilt from
    // its parent with the same builder.
    current: ctx => {
      const all: AtomBuilderChallenge[] = (ctx.data as AtomBuilderData).challenges ?? [];
      return practiceById(all, String(ctx.itemId ?? '')) ?? all.find(c => c.id === ctx.itemId);
    },
    // Every item through the real tray (`atomHarnessInputs`): a classic item adds its target counts and presses Check
    // Answer (wrong: one electron more, `electrons_off`); make_atom builds the smallest atom the ask's menu proves passes
    // and presses "I'm done!" (wrong: one electron more, or an isotope pair kept unchanged, `same_neutrons`).
    play: (right, c, ctx) => atomHarnessInputs(c, !right, (ctx.data as AtomBuilderData).constraints?.maxProtons ?? 20, ctx.demand),
  },
});
