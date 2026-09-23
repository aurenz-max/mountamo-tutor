import type { TenFrameData } from '../../../primitives/visual-primitives/math/TenFrame';
import { askFor, itemsFromChallenges } from '../../../primitives/visual-primitives/math/tenFrameScript';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const itemsOf = (d: TenFrameData) => itemsFromChallenges(d.challenges, { capacity: d.mode === 'double' ? 20 : 10, band: d.gradeBand! });

/** Reject a generated frame whose challenges the component would drop, at the service boundary. */
export function validateTenFrameData(value: unknown): TenFrameData {
  const d = value as TenFrameData;
  if (!d || typeof d.title !== 'string' || !['single', 'double'].includes(d.mode)
      || !['K', '1-2'].includes(d.gradeBand ?? '') || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12 || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || typeof c.instruction !== 'string'))
    throw new Error('Generated ten frame has invalid lesson content.');
  if (itemsOf(d).length !== d.challenges.length) throw new Error('A ten-frame challenge cannot run in the lesson.');
  return d;
}

/** What the live adapter needs from ten-frame; the catalog's `teachingWorkspace` declares the rest. */
export const tenFrameLiveDomain: WorkspaceDomain<TenFrameData> = {
  validate: validateTenFrameData,
  initialState: d => { const items = itemsOf(d); return workspaceOpening({ title: d.title, task: askFor(items[0]), total: items.length }); },
};
