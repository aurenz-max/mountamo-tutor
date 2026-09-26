import type { CauseEffectChainData } from '../../../primitives/visual-primitives/history/CauseEffectChain';
import { causeEffectAssignment, causeEffectItems } from '../../../primitives/visual-primitives/history/causeEffectChainWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a lesson with nothing askable: the build gates drop an unspeakable card, an identify chain with no
 *  non-cause, a chain page with a stray non-cause, and a root pick whose cards cannot be told apart by ear. */
export function validateCauseEffectChainData(value: unknown): CauseEffectChainData {
  const d = value as CauseEffectChainData;
  if (!d || !Array.isArray(d.challenges)) throw new Error('Generated cause-effect chain has invalid lesson content.');
  if (!causeEffectItems(d).length) throw new Error('No cause-effect chain question can be asked.');
  return d;
}

/** What the live adapter needs from the lesson; the catalog's `teachingWorkspace` declares the rest. */
export const causeEffectChainLiveDomain: WorkspaceDomain<CauseEffectChainData> = {
  validate: validateCauseEffectChainData,
  initialState: data => {
    const items = causeEffectItems(data);
    return workspaceOpening({ title: data.title || 'Cause and Effect', task: causeEffectAssignment(items[0]).task, total: items.length });
  },
};
