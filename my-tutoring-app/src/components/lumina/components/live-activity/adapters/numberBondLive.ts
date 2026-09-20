import type { NumberBondData } from '../../../primitives/visual-primitives/math/NumberBond';
import { buildBondItems, numberBondPackBase } from '../../../primitives/visual-primitives/math/numberBondScript';
import { expandNumberBondInteractions } from '../../../primitives/visual-primitives/math/numberBondModes';
import { RUNNER_GUIDANCE, runnerLessonStart, type LiveActivityAdapter } from './adapterContract';

/** The CATALOG eval modes, which use underscores where the challenge types use hyphens. */
export const NUMBER_BOND_LIVE_MODES = ['decompose', 'ten_and_ones', 'missing_part',
  'related_fact', 'fact_family', 'build_equation'] as const;

const BOND_TYPES = ['decompose', 'missing-part', 'related-fact', 'ten-and-ones', 'fact-family', 'build-equation'];

/** Reject a bond whose challenges cannot be ASKED before it reaches a five-year-old. */
export function validateNumberBondData(value: unknown): NumberBondData {
  const d = value as NumberBondData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !Number.isInteger(d.maxNumber) || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id
        || !BOND_TYPES.includes(c.type) || !Number.isInteger(c.whole)))
    throw new Error('Generated number bond has invalid lesson content.');
  // `buildBondItems` DROPS anything unaskable rather than repairing it, so an
  // empty expansion means this lesson would mount with nothing to ask.
  if (!bondItems(d).length) throw new Error('A number-bond challenge cannot run in the DI lesson.');
  return d;
}

/** The judged items the component would build, expanded exactly as it expands them. */
const bondItems = (d: NumberBondData) => expandNumberBondInteractions(
  buildBondItems(d.challenges, { band: d.gradeBand ?? 'K', maxNumber: d.maxNumber ?? 10 }).items);

function numberBondState(data: NumberBondData) {
  const items = bondItems(data);
  return { ...data, ...numberBondPackBase(items).contextFor(items[0]),
    teachingOwner: 'number-bond-di', totalChallenges: items.length };
}

export const numberBondLive: LiveActivityAdapter<NumberBondData> = {
  teachingOwner: 'di-runner',
  modes: NUMBER_BOND_LIVE_MODES,
  canAdvance: false,
  grades: ['Kindergarten', 'Grade 1'],
  copy: {
    label: 'Number Bond', checkbox: 'Number bond', title: 'Learn with Number Bonds',
    lessons: [['decompose', 'Make the whole two ways'], ['missing_part', 'Find the missing part'],
      ['related_fact', 'The same bond both ways'], ['ten_and_ones', 'A ten and some more'],
      ['fact_family', 'Build the fact family'], ['build_equation', 'Build a number sentence']],
  },
  lessonStart: runnerLessonStart('number-bond'),
  guidance: RUNNER_GUIDANCE + ' Replay asks the same bond again without moving a counter, a tile or a part, '
    + 'and a reminder is TEXT only — never claim to move, place, highlight or count anything. '
    + 'The fact-family and build-equation modes offer no worked example: the example surface draws a '
    + 'part-and-part-make-whole fact, not the act of writing a number sentence.',
  validate: validateNumberBondData,
  initialState: numberBondState,
};
