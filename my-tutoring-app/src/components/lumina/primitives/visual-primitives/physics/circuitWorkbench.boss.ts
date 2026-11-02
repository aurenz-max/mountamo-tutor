/**
 * circuit-workbench's boss (`components/live-activity/boss.ts`), bespoke because light_it is a build: the learner wires
 * the battery and bulb on the 3D workbench and presses I'm done!, and the activity's own check judges. The card is
 * `circuitWorkbench.card.ts`; this file validates a lesson, lists its items, asks one and names the harness.
 */
import type { CircuitWorkbenchData } from './CircuitWorkbench';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { circuitWorkbenchCard, type CircuitMissName } from './circuitWorkbench.card';
import { CIRCUIT_TASKS, clipsOf, goalMet, type CircuitChallenge } from './circuitModel';
import { allLit, loopFor, type BreakChallenge } from './breakModel';
import { condByKey, conductorFair, type CondThing, type ConductorChallenge } from './conductorModel';
import { switchWorks } from './switchModel';
import { arrangementOf } from './twoBulbModel';
import { DEVICES } from './deviceModel';
import { magnetByKey, magnetFair, type MagnetThing } from './magnetModel';
import { CIRCUIT_LEVERS, practiceItem, practiceParent } from './circuitLevers';

/** A break item: one bulb or red-then-blue, its loop wires, and a fault that leaves it dark. */
function validBreak(c: BreakChallenge): boolean {
  const two = c.bulbs.length === 2;
  if (!(c.bulbs.length === 1 && c.bulbs[0] === 'red') && !(two && c.bulbs[0] === 'red' && c.bulbs[1] === 'blue')) return false;
  if (JSON.stringify(c.wires) !== JSON.stringify(loopFor(c.bulbs))) return false;
  const f = c.fault;
  if (!f || !['dead_battery', 'burnt_bulb', 'loose_wire'].includes(f.kind)) return false;
  if (f.kind === 'burnt_bulb' && !c.bulbs.includes(f.bulb!)) return false;
  if (f.kind === 'loose_wire' && !(Number.isInteger(f.wire) && f.wire! >= 0 && f.wire! < c.wires.length)) return false;
  return !allLit(c, []);
}

const knownThing = (t: CondThing | undefined) => !!t && condByKey(t.key)?.material === t.material && condByKey(t.key)?.shiny === t.shiny;

/** A conductor item: 2-3 known tests and 1-2 known things to sort, fair (`conductorFair`). */
function validConductor(c: ConductorChallenge): boolean {
  const tested = Array.isArray(c.tested) ? c.tested : [], toSort = Array.isArray(c.toSort) ? c.toSort : [];
  if (tested.length < 2 || tested.length > 3 || toSort.length < 1 || toSort.length > 2) return false;
  return [...tested, ...toSort].every(knownThing) && conductorFair(c);
}

/** One item: known bulbs, a target among them, start wires between known clips that do not already meet the goal. */
function validItem(c: CircuitChallenge): boolean {
  if (!c || typeof c.id !== 'string' || !c.id || !(CIRCUIT_TASKS as readonly string[]).includes(c.type)) return false;
  if (typeof c.instruction !== 'string' || !c.instruction.trim()) return false;
  if (c.type === 'find_the_break') return Array.isArray(c.bulbs) && validBreak(c);
  if (c.type === 'conductor_test') return validConductor(c);
  if (c.type === 'magnet_test') {
    const known = (t: MagnetThing) => !!t && magnetByKey(t.key)?.material === t.material;
    return Array.isArray(c.tested) && Array.isArray(c.toSort) && c.tested.length >= 2 && c.tested.length <= 3 && c.toSort.length >= 1
      && c.toSort.length <= 2 && [...c.tested, ...c.toSort].every(known) && magnetFair(c);
  }
  if (c.type === 'build_device') return c.device in DEVICES && Number.isInteger(c.maxWires) && c.maxWires >= 2;
  if (c.type === 'two_bulbs') {
    const clips = clipsOf(['red', 'blue']);
    return (c.arrangement === 'row' || c.arrangement === 'side_by_side') && Array.isArray(c.start) && c.maxWires >= 4
      && arrangementOf(c.start) !== c.arrangement
      && c.start.every(w => Array.isArray(w) && w.length === 2 && w[0] !== w[1] && clips.includes(w[0]) && clips.includes(w[1]));
  }
  if (c.type === 'add_a_switch') {
    const clips = clipsOf(['red'], true);
    return Array.isArray(c.start) && c.maxWires >= Math.max(3, c.start.length) && !switchWorks(c.start)
      && c.start.every(w => Array.isArray(w) && w.length === 2 && w[0] !== w[1] && clips.includes(w[0]) && clips.includes(w[1]));
  }
  const bulbs = Array.isArray(c.bulbs) ? c.bulbs : [];
  if (!bulbs.length || bulbs.length > 2 || new Set(bulbs).size !== bulbs.length || bulbs.some(b => b !== 'red' && b !== 'blue')) return false;
  if (!bulbs.includes(c.target)) return false;
  const clips = clipsOf(bulbs);
  const start = Array.isArray(c.start) ? c.start : [];
  if (start.some(w => !Array.isArray(w) || w.length !== 2 || w[0] === w[1] || !clips.includes(w[0]) || !clips.includes(w[1]))) return false;
  if (!Number.isInteger(c.maxWires) || c.maxWires < Math.max(2, start.length)) return false;
  return !goalMet(c, start);
}

/** Reject a workbench session the workspace cannot run. */
export function validateCircuitWorkbenchData(value: unknown): CircuitWorkbenchData {
  const d = value as CircuitWorkbenchData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated workbench has no title.');
  const items = Array.isArray(d.challenges) ? d.challenges : [];
  if (!items.length || items.length > 12 || new Set(items.map(c => c?.id)).size !== items.length || items.some(c => !validItem(c)))
    throw new Error('Generated workbench has invalid lesson content.');
  return d;
}

export const circuitWorkbenchBoss = defineBoss<CircuitWorkbenchData, CircuitChallenge, CircuitMissName>({
  card: circuitWorkbenchCard,
  validate: validateCircuitWorkbenchData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A build the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: CIRCUIT_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/physics/CircuitWorkbench.tsx',
    instanceId: 'workbench',
    defaults: { grade: 'Kindergarten', mode: 'light_it', topic: 'Make a bulb light: a closed loop' },
    mounted: '[data-pip-object="workspace"]',
    // An easier item (`~easier`) is rebuilt from its parent with the same builder.
    current: ctx => {
      const challenges: CircuitChallenge[] = ctx.data.challenges ?? [];
      const parent = practiceParent(ctx.itemId, challenges);
      return parent ? practiceItem(parent) ?? undefined : challenges.find(c => c.id === ctx.itemId);
    },
    // The bulb lights only as the 3D workbench (WebGL) runs, which the dry sweep's jsdom cannot draw
    // (journey-sweep-baseline: J1 by design); CircuitWorkbench.workspace.test.tsx drives the commit through a stubbed scene.
    play: () => {
      throw new Error('Circuit-workbench runs a 3D workbench, not driven at W1');
    },
  },
});
