import type { NumberSequencerData } from '../../../primitives/visual-primitives/math/NumberSequencer';
import { buildSequencerItems, sequencerChallengeValid, sequencerPackBase }
  from '../../../primitives/visual-primitives/math/numberSequencerScript';
import { RUNNER_GUIDANCE, runnerLessonStart, type LiveActivityAdapter } from './adapterContract';

/** The CATALOG eval modes, which are the mode names, not the challenge types. */
export const NUMBER_SEQUENCER_LIVE_MODES = ['count_from', 'before_after', 'fill_missing',
  'order_cards', 'spot_error', 'decade_fill'] as const;

/** Reject a train whose challenges cannot be ASKED before it reaches a five-year-old. */
export function validateNumberSequencerData(value: unknown): NumberSequencerData {
  const d = value as NumberSequencerData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated number sequencer has invalid lesson content.');
  // The same independent key check the component runs, at the service boundary:
  // a challenge the script would silently drop must not reach a mounted lesson.
  if (!d.challenges.every(sequencerChallengeValid))
    throw new Error('A number-sequencer challenge cannot run in the DI lesson.');
  if (!buildSequencerItems(d.challenges).items.length)
    throw new Error('A number-sequencer challenge cannot run in the DI lesson.');
  return d;
}

function numberSequencerState(data: NumberSequencerData) {
  const { items } = buildSequencerItems(data.challenges);
  return { ...data, ...sequencerPackBase(items).contextFor(items[0]),
    teachingOwner: 'number-sequencer-di', totalChallenges: items.length };
}

export const numberSequencerLive: LiveActivityAdapter<NumberSequencerData> = {
  teachingOwner: 'di-runner',
  modes: NUMBER_SEQUENCER_LIVE_MODES,
  canAdvance: false,
  grades: ['Kindergarten', 'Grade 1'],
  copy: {
    label: 'Number Train', checkbox: 'Number train', title: 'Learn with the Number Train',
    lessons: [['count_from', 'Count on from a number'], ['before_after', 'Before and after'],
      ['fill_missing', 'Fill the gaps'], ['order_cards', 'Put the cards in order'],
      ['spot_error', 'Spot the number that jumps'], ['decade_fill', 'Cross into the next ten']],
  },
  lessonStart: runnerLessonStart('number-sequencer'),
  guidance: RUNNER_GUIDANCE + ' Replay asks the same train again without clearing, reordering or filling anything, '
    + 'and a reminder is TEXT only — never claim to move a card, fill an empty space or reorder the train. '
    + 'This family has no worked example: a number train teaches the count sequence, which the counter '
    + 'example cannot draw, so do not offer or describe one.',
  validate: validateNumberSequencerData,
  initialState: numberSequencerState,
};
