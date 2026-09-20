import type { PlaceValueChartData } from '../../../primitives/visual-primitives/math/PlaceValueChart';
import { itemsFromChallenges, placeValuePackBase }
  from '../../../primitives/visual-primitives/math/placeValueScript';
import { RUNNER_GUIDANCE, runnerLessonStart, type LiveActivityAdapter } from './adapterContract';

export const PLACE_VALUE_LIVE_MODES = ['identify', 'build', 'compare', 'expanded_form'] as const;

/**
 * The session's judged items, built exactly as the component builds them: this
 * primitive pins ONE mode per session on the payload rather than per challenge,
 * so the mode comes from `challengeType`, not from a per-item field.
 */
const placeValueItems = (d: PlaceValueChartData) => itemsFromChallenges(d.challenges as any[], {
  mode: (PLACE_VALUE_LIVE_MODES as readonly string[]).includes(d.challengeType) ? d.challengeType : 'compare',
  tier: d.supportTier ?? 'medium',
} as any).items;

/** Reject a chart whose challenges cannot be ASKED before they reach a child. */
export function validatePlaceValueData(value: unknown): PlaceValueChartData {
  const d = value as PlaceValueChartData;
  if (!d || typeof d.title !== 'string'
      || !(PLACE_VALUE_LIVE_MODES as readonly string[]).includes(d.challengeType)
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated place value chart has invalid lesson content.');
  // `itemsFromChallenges` DROPS anything unaskable rather than repairing it, so
  // an empty build means this lesson would mount with nothing to ask.
  if (!placeValueItems(d).length) throw new Error('A place-value challenge cannot run in the DI lesson.');
  return d;
}

function placeValueState(data: PlaceValueChartData) {
  const items = placeValueItems(data);
  return { ...data, ...placeValuePackBase(items).contextFor(items[0]),
    teachingOwner: 'place-value-di', totalChallenges: items.length };
}

export const placeValueLive: LiveActivityAdapter<PlaceValueChartData> = {
  teachingOwner: 'di-runner',
  modes: PLACE_VALUE_LIVE_MODES,
  canAdvance: false,
  grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  copy: {
    label: 'Place Value Chart', checkbox: 'Place value chart', title: 'Learn with the Place Value Chart',
    lessons: [['identify', 'Which place is it in'], ['build', 'Write the number I say'],
      ['compare', 'What is the digit worth'], ['expanded_form', 'Break it into places']],
  },
  lessonStart: runnerLessonStart('place-value-chart'),
  guidance: RUNNER_GUIDANCE + ' Replay asks the same chart again without writing, clearing or highlighting '
    + 'anything, and a reminder is TEXT only. Never read a place name or a digit value off the screen — those '
    + 'are the answers. This family has no worked example: the example surface draws one flat row of counters '
    + 'and place value is about POSITION carrying magnitude, so do not offer or describe one.',
  validate: validatePlaceValueData,
  initialState: placeValueState,
};
