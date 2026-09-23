import type { BaseTenBlocksData } from '../../../primitives/visual-primitives/math/BaseTenBlocks';
import { itemsFromChallenges, usesBaseTenDi } from '../../../primitives/visual-primitives/math/baseTenScript';
import type { BtMode } from '../../../primitives/visual-primitives/math/baseTenModel';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CHALLENGE_TYPES = ['build_number', 'read_blocks', 'regroup', 'add_with_blocks', 'subtract_with_blocks'];

/** The judged mat's items, built exactly as the component builds them (a homogeneous read/regroup payload). */
const judgedItems = (d: BaseTenBlocksData) =>
  itemsFromChallenges(d.challenges ?? [], (d.challenges?.[0]?.type ?? 'read_blocks') as BtMode);

/** Reject a mat whose challenges cannot be asked before it reaches a child. */
export function validateBaseTenData(value: unknown): BaseTenBlocksData {
  const d = value as BaseTenBlocksData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || !d.challenges.every(c => c && CHALLENGE_TYPES.includes(c.type) && typeof c.instruction === 'string'
        && typeof c.targetNumber === 'number' && Number.isFinite(c.targetNumber)))
    throw new Error('Generated base-ten blocks has invalid lesson content.');
  // A read/regroup payload the judged mat cannot ask (every number dropped) falls back to the click surface,
  // which still checks it, so only a payload with nothing at all is refused above.
  return d;
}

/** What the live adapter needs from the block mat; the catalog's `teachingWorkspace` declares the rest. */
export const baseTenBlocksLiveDomain: WorkspaceDomain<BaseTenBlocksData> = {
  validate: validateBaseTenData,
  initialState: d => {
    if (usesBaseTenDi(d.challenges)) {
      const items = judgedItems(d);
      return workspaceOpening({ title: d.title, task: items[0].actionContract.instruction, total: items.length });
    }
    return workspaceOpening({ title: d.title, task: d.challenges![0].instruction, total: d.challenges!.length });
  },
};
