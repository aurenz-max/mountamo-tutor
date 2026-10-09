import type { DistributionExplorerData, DistributionChallenge } from '../../../primitives/distribution-explorer/types';
import { distributionChoices, distributionCorrect, workspaceAssignment }
  from '../../../primitives/distribution-explorer/distributionExplorerWorkspace';
import { FAMILIES } from '../../../lib/probability';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['guided_exploration', 'identify', 'compute', 'predict_shape'];
const key = (ch: DistributionChallenge, picked: string) =>
  distributionCorrect(ch, { picked, explored: false, family: 'binomial', params: {} });

/**
 * An item its own check can answer: a guided exploration always can; a choice item needs exactly one choice the check
 * credits, at least two choices, and labels that differ on screen (two values that format alike cannot be told apart).
 */
function answerable(ch: DistributionChallenge): boolean {
  if (ch.type === 'guided_exploration') return true;
  if (ch.type === 'identify' && !(ch.correctFamily in FAMILIES)) return false;
  const choices = distributionChoices(ch);
  return choices.length >= 2 && new Set(choices.map(c => c.label)).size === choices.length
    && choices.filter(c => key(ch, c.key)).length === 1;
}

/** Reject a distribution-explorer lesson whose challenges cannot be attempted. */
export function validateDistributionExplorerData(value: unknown): DistributionExplorerData {
  const d = value as DistributionExplorerData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || !d.initial || !(d.initial.family in FAMILIES)
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || typeof c.prompt !== 'string' || !c.prompt.trim()))
    throw new Error('Generated distribution explorer has invalid lesson content.');
  for (const c of d.challenges) {
    if (!answerable(c)) throw new Error(`A distribution-explorer ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the distribution explorer; the catalog's `teachingWorkspace` declares the rest. */
export const distributionExplorerLiveDomain: WorkspaceDomain<DistributionExplorerData> = {
  validate: validateDistributionExplorerData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
