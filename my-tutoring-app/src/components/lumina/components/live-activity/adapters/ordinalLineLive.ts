import type { OrdinalLineData } from '../../../primitives/visual-primitives/math/OrdinalLine';
import { itemsFromChallenges, ordinalLinePackBase } from '../../../primitives/visual-primitives/math/ordinalLineScript';
import { RUNNER_GUIDANCE, runnerLessonStart, type LiveActivityAdapter } from './adapterContract';

export const ORDINAL_LINE_LIVE_MODES = ['identify', 'match', 'relative_position',
  'sequence_story', 'build_sequence'] as const;

const CONTEXTS = ['race', 'parade', 'lunch-line', 'train', 'bookshelf'];

const ordinalItems = (d: OrdinalLineData) =>
  itemsFromChallenges(d.challenges, { band: d.gradeBand ?? 'K', context: d.context ?? 'race' }).items;

/** Reject a line whose challenges cannot be ASKED before it reaches a five-year-old. */
export function validateOrdinalLineData(value: unknown): OrdinalLineData {
  const d = value as OrdinalLineData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !CONTEXTS.includes(d.context) || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated ordinal line has invalid lesson content.');
  // `itemsFromChallenges` DROPS anything unaskable rather than repairing it, so
  // an empty build means this lesson would mount with nothing to ask.
  if (!ordinalItems(d).length) throw new Error('An ordinal-line challenge cannot run in the DI lesson.');
  return d;
}

function ordinalLineState(data: OrdinalLineData) {
  const items = ordinalItems(data);
  return { ...data, ...ordinalLinePackBase(items).contextFor(items[0]),
    teachingOwner: 'ordinal-line-di', totalChallenges: items.length };
}

export const ordinalLineLive: LiveActivityAdapter<OrdinalLineData> = {
  teachingOwner: 'di-runner',
  modes: ORDINAL_LINE_LIVE_MODES,
  canAdvance: false,
  grades: ['Kindergarten', 'Grade 1'],
  copy: {
    label: 'Ordinal Line', checkbox: 'Ordinal line', title: 'Learn with the Ordinal Line',
    lessons: [['identify', 'Which place is it'], ['relative_position', 'Before and after in line'],
      ['match', 'Read the place card'], ['sequence_story', 'Listen to the story'],
      ['build_sequence', 'Put them in their places']],
  },
  lessonStart: runnerLessonStart('ordinal-line'),
  guidance: RUNNER_GUIDANCE + ' Replay asks the same line again without moving, placing or highlighting anybody, '
    + 'and a reminder is TEXT only. This family has no worked example: the example surface states HOW MANY, '
    + 'and every mode here teaches WHICH PLACE, so do not offer or describe one.',
  validate: validateOrdinalLineData,
  initialState: ordinalLineState,
};
