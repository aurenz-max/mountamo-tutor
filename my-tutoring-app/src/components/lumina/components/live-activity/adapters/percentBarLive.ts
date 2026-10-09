import type { PercentBarData } from '../../../primitives/visual-primitives/math/PercentBar';
import { challengeSteps, workspaceAssignment } from '../../../primitives/visual-primitives/math/percentBarWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['direct', 'subtraction', 'addition', 'comparison'];

/** Reject a percent-bar lesson whose challenges cannot be attempted. */
export function validatePercentBarData(value: unknown): PercentBarData {
  const d = value as PercentBarData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type) || typeof c.scenario !== 'string'))
    throw new Error('Generated percent bar has invalid lesson content.');
  // Each step needs what its own check reads: a percent the bar can reach, or the right option among the options.
  for (const c of d.challenges) {
    const ok = challengeSteps(c).every(s => s.kind === 'place'
      ? Number.isFinite(s.targetPercent) && s.targetPercent >= 0 && s.targetPercent <= (s.maxPercent ?? 100) && s.wholeValue > 0
      : Array.isArray(s.options) && s.options.some(o => o.id === s.correctOptionId));
    if (!ok) throw new Error(`A percent-bar ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the percent bar; the catalog's `teachingWorkspace` declares the rest. */
export const percentBarLiveDomain: WorkspaceDomain<PercentBarData> = {
  validate: validatePercentBarData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
