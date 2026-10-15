import type { AirplaneDioramaData } from '../../../primitives/visual-primitives/engineering/AirplaneDiorama';
import { airplaneAssignment } from '../../../primitives/visual-primitives/engineering/airplaneWorkspace';
import { AIRPLANE_PARTS, type AirplaneChallenge } from '../../../primitives/visual-primitives/engineering/airplaneModel';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

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

/** What the live adapter needs from the airplane diorama; the catalog's `teachingWorkspace` declares the rest. */
export const airplaneDioramaLiveDomain: WorkspaceDomain<AirplaneDioramaData> = {
  validate: validateAirplaneDioramaData,
  initialState: data => workspaceOpening({
    title: data.title, task: airplaneAssignment(data.challenges[0]).task, total: data.challenges.length,
  }),
};
