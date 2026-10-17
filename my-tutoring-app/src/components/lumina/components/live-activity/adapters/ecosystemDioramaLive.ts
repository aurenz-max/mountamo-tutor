import type { EcosystemDioramaData } from '../../../primitives/visual-primitives/biology/EcosystemDiorama';
import { ecosystemAssignment } from '../../../primitives/visual-primitives/biology/ecosystemWorkspace';
import {
  COVERS, ECOSYSTEM_TASKS, LOG_DAYS, warmthAt, type EcosystemChallenge,
} from '../../../primitives/visual-primitives/biology/ecosystemModel';
import { ANIMALS, WEATHERS, mostCommon, SEASONS } from '../../../primitives/visual-primitives/biology/ecosystemLife';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const isLog = (days: unknown) => Array.isArray(days) && days.length === LOG_DAYS && days.every(d => (WEATHERS as readonly string[]).includes(d));

/** Whether one item carries what its task needs, and its key agrees with the world model. */
function validItem(c: EcosystemChallenge): boolean {
  if (!c || typeof c.id !== 'string' || !c.id || !(ECOSYSTEM_TASKS as readonly string[]).includes(c.type)) return false;
  if (typeof c.instruction !== 'string' || !c.instruction.trim()) return false;
  switch (c.type) {
    case 'sun_test':
      return !!c.left?.name && !!c.right?.name && (warmthAt(c.left, 1) > warmthAt(c.right, 1) ? 'left' : 'right') === c.warmer;
    case 'season_from_log':
      return (SEASONS as readonly string[]).includes(c.season) && isLog(c.days) && mostCommon(c.days) != null;
    case 'compare_logs':
      return !!c.a?.label && !!c.b?.label && isLog(c.a.days) && isLog(c.b.days) && (c.answer === 'a' || c.answer === 'b') && !!c.ask;
    case 'plant_needs':
      return !!c.plant && !!c.start && ['sun', 'hut'].includes(c.start.spot) && Array.isArray(c.start.extras);
    case 'season_behavior':
      return Array.isArray(c.animals) && c.animals.length > 0 && c.animals.every(a => (ANIMALS as readonly string[]).includes(a));
    case 'keep_it_cool':
      return !!c.thing && Array.isArray(c.covers) && c.covers.length > 0 && c.covers.every(x => (COVERS as readonly string[]).includes(x));
  }
}

/** Reject an island tank the workspace cannot run. */
export function validateEcosystemDioramaData(value: unknown): EcosystemDioramaData {
  const d = value as EcosystemDioramaData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated island tank has no title.');
  const items = Array.isArray(d.challenges) ? d.challenges : [];
  if (!items.length || items.length > 12 || new Set(items.map(c => c?.id)).size !== items.length || items.some(c => !validItem(c)))
    throw new Error('Generated island tank has invalid lesson content.');
  return d;
}

/** What the live adapter needs from the island tank; the catalog's `teachingWorkspace` declares the rest. */
export const ecosystemDioramaLiveDomain: WorkspaceDomain<EcosystemDioramaData> = {
  validate: validateEcosystemDioramaData,
  initialState: data => workspaceOpening({
    title: data.title, task: ecosystemAssignment(data.challenges[0]).task, total: data.challenges.length,
  }),
};
