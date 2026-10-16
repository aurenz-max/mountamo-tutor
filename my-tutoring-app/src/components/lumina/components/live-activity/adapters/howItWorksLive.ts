import type { HowItWorksData } from '../../../primitives/visual-primitives/core/HowItWorks';
import {
  askOf, howItems, isPictures, processSteps, resolveHowModes, validHowItem,
} from '../../../primitives/visual-primitives/core/howItWorksWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a process the questions cannot be asked on: no title, fewer than three steps, a stored item code could not
 * have built over these steps (every key is a step index or the steps' order, so nothing else is trusted), or a
 * requested mode with no item.
 */
export function validateHowItWorksData(value: unknown): HowItWorksData {
  const d = value as HowItWorksData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated how-it-works has invalid lesson content.');
  const steps = processSteps(d);
  if (steps.length < 3) throw new Error('A how-it-works process needs at least three steps to ask about.');
  if (Array.isArray(d.items) && d.items.some(i => !validHowItem(i, steps))) throw new Error('A generated how-it-works item is not one code can key.');
  const items = howItems(d);
  if (!items.length) throw new Error('No how-it-works question could be built from these steps.');
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated how-it-works items repeat an id.');
  for (const mode of resolveHowModes(d) ?? []) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The how-it-works ${mode} mode has no item.`);
  }
  return d;
}

/** What the live adapter needs from how-it-works; the catalog's `teachingWorkspace` declares the rest. */
export const howItWorksLiveDomain: WorkspaceDomain<HowItWorksData> = {
  validate: validateHowItWorksData,
  initialState: d => {
    const items = howItems(d);
    return workspaceOpening({ title: d.title, task: askOf(processSteps(d), items[0], isPictures(d), d.preReader?.question), total: items.length });
  },
};
