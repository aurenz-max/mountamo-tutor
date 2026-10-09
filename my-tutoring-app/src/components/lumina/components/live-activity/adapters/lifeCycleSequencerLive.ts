import type { LifeCycleSequencerData } from '../../../primitives/visual-primitives/biology/LifeCycleSequencer';
import { lifeCycleItem, workspaceAssignment } from '../../../primitives/visual-primitives/biology/lifeCycleSequencerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * A sequence the activity's check can answer: titled, an instruction, 2+ uniquely-keyed labelled stages whose
 * positions are exactly 0..n-1. The payload is one sequence, not a challenge pool.
 */
export function validateLifeCycleSequencerData(value: unknown): LifeCycleSequencerData {
  const d = value as LifeCycleSequencerData;
  if (!d || typeof d.title !== 'string' || typeof d.instructions !== 'string' || !d.instructions.trim()
      || (d.cycleType !== 'linear' && d.cycleType !== 'circular') || !Array.isArray(d.stages) || d.stages.length < 2)
    throw new Error('Generated life cycle sequencer has invalid lesson content.');
  if (new Set(d.stages.map(s => s?.id)).size !== d.stages.length
      || d.stages.some(s => !s || typeof s.id !== 'string' || !s.id || typeof s.label !== 'string' || !s.label.trim())
      || ![...d.stages.map(s => s.correctPosition)].sort((a, b) => a - b).every((p, i) => p === i))
    throw new Error('The life cycle stages cannot be ordered as generated.');
  return d;
}

/** What the live adapter needs from the life cycle sequencer; the catalog's `teachingWorkspace` declares the rest. */
export const lifeCycleSequencerLiveDomain: WorkspaceDomain<LifeCycleSequencerData> = {
  validate: validateLifeCycleSequencerData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(lifeCycleItem(d)).task, total: 1 }),
};
