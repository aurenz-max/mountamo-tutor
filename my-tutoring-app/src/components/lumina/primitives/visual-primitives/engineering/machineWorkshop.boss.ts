/**
 * machine-workshop's boss (`components/live-activity/boss.ts`), bespoke because spin_to_push is a build: the learner
 * fits two parts into a real machine's empty slot, runs it, and the activity's own check judges it. The card is
 * `machineWorkshop.card.ts`; this file validates a lesson, lists its items, asks one and names the harness.
 */
import type { MachineWorkshopData } from './MachineWorkshop';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { machineWorkshopCard, type MachineMiss } from './machineWorkshop.card';
import { MACHINE_TASKS, assemblyErrors, machineFair, type MachineChallenge } from './machineModel';
import { atlasMachine, fidelityErrors } from './machineAtlas';

/** One item: a real machine whose chain assembles, with a tray where exactly the two promised builds work. */
function validItem(c: MachineChallenge): boolean {
  if (!c || typeof c.id !== 'string' || !c.id || !(MACHINE_TASKS as readonly string[]).includes(c.type)) return false;
  if (typeof c.instruction !== 'string' || !c.instruction.trim() || typeof c.name !== 'string' || !c.name) return false;
  if (!Array.isArray(c.stages) || !Array.isArray(c.tray) || !c.tray.length) return false;
  const chain = c.stages.map(s => s.kind);
  if (assemblyErrors(chain).length) return false;
  const atlas = atlasMachine(c.machine);
  if (!atlas || fidelityErrors(atlas, chain).length) return false;
  if (c.stages.some(s => typeof s.job !== 'string' || !s.job.trim())) return false;
  return machineFair(c);
}

/** Reject a machine workshop session the workspace cannot run. */
export function validateMachineWorkshopData(value: unknown): MachineWorkshopData {
  const d = value as MachineWorkshopData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated machine workshop session has no title.');
  const items = Array.isArray(d.challenges) ? d.challenges : [];
  if (!items.length || items.length > 6 || new Set(items.map(c => c?.id)).size !== items.length || items.some(c => !validItem(c)))
    throw new Error('Generated machine workshop session has invalid lesson content.');
  return d;
}

export const machineWorkshopBoss = defineBoss<MachineWorkshopData, MachineChallenge, MachineMiss>({
  card: machineWorkshopCard,
  validate: validateMachineWorkshopData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A build the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  drive: {
    component: 'primitives/visual-primitives/engineering/MachineWorkshop.tsx',
    instanceId: 'machine',
    defaults: { grade: 'Grade 4', mode: 'spin_to_push', topic: 'How machines turn spinning into up-and-down motion' },
    mounted: '[data-pip-object="workspace"]',
    current: ctx => (ctx.data.challenges as MachineChallenge[] | undefined)?.find(c => c.id === ctx.itemId),
    // Not driven by the dry sweep yet (journey-sweep-baseline: J1); MachineWorkshop.workspace.test.tsx drives the commit
    // through the part buttons.
    play: () => {
      throw new Error('Machine-workshop is not driven at W1 yet');
    },
  },
});
