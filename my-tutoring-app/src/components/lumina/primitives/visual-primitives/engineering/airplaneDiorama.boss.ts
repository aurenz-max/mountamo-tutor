/**
 * airplane-diorama's boss (`components/live-activity/boss.ts`), bespoke because one mode is a tap on the 3D jet and
 * the other a fuel load the flight checks: the card is `airplaneDiorama.card.ts`; this file validates a lesson, lists
 * its items, asks one and names the harness.
 */
import type { AirplaneDioramaData } from './AirplaneDiorama';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { airplaneDioramaCard, type AirplaneMiss } from './airplaneDiorama.card';
import { AIRPLANE_PARTS, tanksNeeded, type AirplaneChallenge } from './airplaneModel';

const posInt = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n > 0;

/** An item the workspace can run: a find with a known part, or a trip with whole positive numbers. */
function validItem(c: AirplaneChallenge | undefined): boolean {
  if (!c || typeof c.id !== 'string' || !c.id || typeof c.instruction !== 'string' || !c.instruction.trim()) return false;
  if (c.type === 'find_part') return (AIRPLANE_PARTS as readonly string[]).includes(c.part);
  if (c.type === 'flight_plan') {
    return typeof c.from === 'string' && !!c.from && typeof c.to === 'string' && !!c.to && c.from !== c.to
      && (c.units === 'hops' || c.units === 'km') && posInt(c.distance) && posInt(c.perTank)
      && Number.isInteger(c.spare) && c.spare >= 0;
  }
  return false;
}

/** Reject a jet the workspace cannot run: every item needs an id, an instruction and valid content for its task. */
export function validateAirplaneDioramaData(value: unknown): AirplaneDioramaData {
  const d = value as AirplaneDioramaData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated airplane has no title.');
  const items = Array.isArray(d.challenges) ? d.challenges : [];
  if (!items.length || items.length > 12 || new Set(items.map(c => c?.id)).size !== items.length || !items.every(validItem))
    throw new Error('Generated airplane has invalid lesson content.');
  return d;
}

export const airplaneDioramaBoss = defineBoss<AirplaneDioramaData, AirplaneChallenge, AirplaneMiss>({
  card: airplaneDioramaCard,
  validate: validateAirplaneDioramaData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A tap or a flight the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  drive: {
    component: 'primitives/visual-primitives/engineering/AirplaneDiorama.tsx',
    instanceId: 'jet',
    defaults: { grade: 'Grade 1', mode: 'find_part', topic: 'The parts of an airplane and what each part does' },
    mounted: '[data-airplane-scene]',
    // find_part: the answer is a tap on a mesh of the 3D jet (WebGL), which the dry sweep's jsdom cannot draw
    // (journey-sweep-baseline: J1 by design); AirplaneDiorama.workspace.test.tsx drives the commit through a stubbed
    // scene. flight_plan: load the tanks with the loader's buttons and press Fly. Wrong: one tank too many.
    play: (right, c) => {
      if (c.type !== 'flight_plan') throw new Error('Airplane-diorama find_part is a tap on the 3D jet, not driven at W1');
      const n = tanksNeeded(c) + (right ? 0 : 1);
      return [...Array.from({ length: n }, (): DriverInput => ({ type: 'choose', label: 'Add a tank' })), { type: 'choose', label: 'Fly!' }];
    },
  },
});
