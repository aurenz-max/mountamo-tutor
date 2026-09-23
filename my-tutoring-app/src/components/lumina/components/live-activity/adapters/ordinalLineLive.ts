import type { OrdinalLineData } from '../../../primitives/visual-primitives/math/OrdinalLine';
import { askFor, itemsFromChallenges } from '../../../primitives/visual-primitives/math/ordinalLineScript';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CONTEXTS = ['race', 'parade', 'lunch-line', 'train', 'bookshelf'];

const ordinalItems = (d: OrdinalLineData) =>
  itemsFromChallenges(d.challenges, { band: d.gradeBand ?? 'K', context: d.context ?? 'race' }).items;

/** Reject a line whose challenges cannot be ASKED before it reaches a five-year-old. */
export function validateOrdinalLineData(value: unknown): OrdinalLineData {
  const d = value as OrdinalLineData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !CONTEXTS.includes(d.context) || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated ordinal line has invalid lesson content.');
  // `itemsFromChallenges` DROPS anything unaskable rather than repairing it, so
  // an empty build means this lesson would mount with nothing to ask.
  if (!ordinalItems(d).length) throw new Error('An ordinal-line challenge cannot run in the lesson.');
  return d;
}

/** What the live adapter needs from the ordinal line; the catalog's `teachingWorkspace` declares the rest. */
export const ordinalLineLiveDomain: WorkspaceDomain<OrdinalLineData> = {
  validate: validateOrdinalLineData,
  initialState: d => { const items = ordinalItems(d); return workspaceOpening({ title: d.title, task: askFor(items[0]), total: items.length }); },
};
