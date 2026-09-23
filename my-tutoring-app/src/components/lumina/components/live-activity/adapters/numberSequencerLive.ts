import type { NumberSequencerData } from '../../../primitives/visual-primitives/math/NumberSequencer';
import { buildSequencerItems, sequencerChallengeValid, askFor }
  from '../../../primitives/visual-primitives/math/numberSequencerDomain';
import { type WorkspaceDomain } from './adapterContract';

/** Reject a train whose challenges cannot be ASKED before it reaches a five-year-old. */
export function validateNumberSequencerData(value: unknown): NumberSequencerData {
  const d = value as NumberSequencerData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated number sequencer has invalid lesson content.');
  // The same independent key check the component runs, at the service boundary:
  // a challenge the domain would silently drop must not reach a mounted lesson.
  if (!d.challenges.every(sequencerChallengeValid))
    throw new Error('A number-sequencer challenge cannot run in the DI lesson.');
  if (!buildSequencerItems(d.challenges).items.length)
    throw new Error('A number-sequencer challenge cannot run in the DI lesson.');
  return d;
}

function numberSequencerState(data: NumberSequencerData) {
  const { items } = buildSequencerItems(data.challenges);
  return { title: data.title, instruction: askFor(items[0]), teachingOwner: 'tutor', totalChallenges: items.length,
    interaction: 'Teach from liveRuntime.task and its workspace. Judge spoken answers naturally; the host records '
      + 'your completed feedback and handles retry/advance. The train checks a card arrangement itself.' };
}

/** What the live adapter needs from this family; the catalog's `teachingWorkspace` declares the rest. */
export const numberSequencerLiveDomain: WorkspaceDomain<NumberSequencerData> = { validate: validateNumberSequencerData, initialState: numberSequencerState };

