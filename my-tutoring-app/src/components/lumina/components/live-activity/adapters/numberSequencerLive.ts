import type { NumberSequencerData } from '../../../primitives/visual-primitives/math/NumberSequencer';
import { buildSequencerItems, sequencerChallengeValid, askFor, NUMBER_SEQUENCER_WORKSPACE_MODES }
  from '../../../primitives/visual-primitives/math/numberSequencerDomain';
import { workspaceGuidance, workspaceLessonStart, type LiveActivityAdapter } from './adapterContract';

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

export const numberSequencerLive: LiveActivityAdapter<NumberSequencerData> = {
  tutoring: null,
  teachingOwner: 'tutor',
  // The CATALOG eval modes, which are the mode names, not the challenge types.
  modes: NUMBER_SEQUENCER_WORKSPACE_MODES,
  bindsTeachingWorkspace: true,
  canAdvance: false, // The dialogue observer owns checked progression.
  grades: ['Kindergarten', 'Grade 1'],
  copy: {
    label: 'Number Train', checkbox: 'Number train', title: 'Learn with the Number Train',
    lessons: [['count_from', 'Count on from a number'], ['before_after', 'Before and after'],
      ['fill_missing', 'Fill the gaps'], ['order_cards', 'Put the cards in order'],
      ['spot_error', 'Spot the number that jumps'], ['decade_fill', 'Cross into the next ten']],
  },
  lessonStart: workspaceLessonStart('number-train', 'number-sequencer'),
  // Teaching ownership, spoken verdicts, crediting, help and progression come from
  // WORKSPACE_DOCTRINE (adapterContract.ts); this names only the train's own facts.
  guidance: workspaceGuidance('The glowing car marks the space the current question is about; judge a spoken answer against that question. '
    + 'On the card-ordering mode the train checks the arrangement itself once the last card is placed; '
    + 'praise or doubt about a part-built train is teaching, not a verdict. '
    + 'Use demonstrate with visible car or card IDs to draw purple dashed tutor marks on the cars or cards you are '
    + 'discussing, and [] to clear them. You cannot fill an empty car, move a card into a place, reorder the train '
    + 'or count for the learner. Counting along out loud is teaching; the number the learner says is the answer.'),
  validate: validateNumberSequencerData,
  initialState: numberSequencerState,
};
