import type { NumberLineData } from '../../../primitives/visual-primitives/math/NumberLine';
import type { LiveActivityAdapter } from './adapterContract';

export const ACTIVITY_MODES = ['identify', 'plot', 'jump', 'order', 'between'] as const;

/** Validate the renderer contract at the service boundary, including jump arithmetic. */
export function validateActivityData(value: unknown): NumberLineData {
  const d = value as NumberLineData | null;
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!d || typeof d.title !== 'string' || !d.range || !finite(d.range.min) || !finite(d.range.max)
      || d.range.min >= d.range.max || !Array.isArray(d.challenges) || !d.challenges.length
      || d.challenges.length > 12) throw new Error('Generated number line has no valid challenges or range');
  const inRange = (v: unknown) => finite(v) && v >= d.range.min && v <= d.range.max;
  for (const c of d.challenges) {
    if (!c || typeof c.id !== 'string' || typeof c.instruction !== 'string' || typeof c.hint !== 'string'
        || !['plot_point', 'show_jump', 'order_values', 'find_between'].includes(c.type)
        || !Array.isArray(c.targetValues) || !c.targetValues.length || !c.targetValues.every(inRange))
      throw new Error('Generated number line has an invalid challenge');
    if (c.exactTargetValue !== undefined && !inRange(c.exactTargetValue)) throw new Error('Invalid missing value');
    if (c.type === 'show_jump') {
      if (!inRange(c.startValue) || !Array.isArray(c.operations) || !c.operations.length) throw new Error('Missing jump operations');
      let landing = c.startValue!;
      for (const [index, op] of Array.from(c.operations.entries())) {
        if (!op || !['add', 'subtract'].includes(op.type) || !finite(op.changeValue) || op.changeValue < 0
            || !finite(op.startValue) || Math.abs(op.startValue - landing) > 0.0001) throw new Error('Invalid jump operation');
        landing += op.type === 'add' ? op.changeValue : -op.changeValue;
        if (!inRange(landing)) throw new Error('Jump leaves the number line');
        if (Math.abs(landing - c.targetValues[index]) > 0.0001) throw new Error('Jump answer does not match its operations');
      }
      if (c.targetValues.length !== c.operations.length) throw new Error('Missing jump answer');
    }
  }
  return d;
}

export function initialActivityState(data: NumberLineData) {
  const first = data.challenges![0];
  return {
    ...data, rangeMin: data.range.min, rangeMax: data.range.max,
    visibleMin: data.range.min, visibleMax: data.range.max,
    numberType: data.numberType ?? 'integer', interactionMode: data.interactionMode ?? 'plot',
    gradeBand: data.gradeBand ?? 'K-2', totalChallenges: data.challenges!.length,
    currentChallengeIndex: 0, instruction: first.instruction, challengeType: first.type,
    targetValues: first.targetValues, exactTargetValue: first.exactTargetValue,
    placedPoints: [], jumpEndPoints: [], orderedPlacements: [], attemptNumber: 1, zoomLevel: 1,
    currentPhase: first.type === 'show_jump' ? 'operate' : first.type === 'order_values' ? 'compare' : 'plot',
    supportTier: data.supportTier ?? 'easy',
  };
}

export const numberLineLive: LiveActivityAdapter<NumberLineData> = {
  teachingOwner: 'tutor',
  modes: ACTIVITY_MODES,
  canAdvance: true,
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  copy: {
    label: 'Number Line', checkbox: 'Number line', title: 'Learn with Number Line',
    lessons: [['jump', 'Subtraction jumps'], ['plot', 'Plot points'], ['order', 'Order values'], ['between', 'Find between']],
  },
  lessonStart: (grade, mode) => `[LESSON_START] Begin a number-line lesson now for ${grade}, mode ${mode}. `
    + `Call request_activity with primitiveId number-line, mode ${mode}, topic subtraction on a number line, and matching intent. `
    + 'Use two practice challenges. Do not greet before mounting. Teach from the mounted instruction and use the advertised '
    + 'runtime actions for help and progression.',
  guidance: 'Use the first challenge instruction. Targets and operations are tutor reference: do not reveal answers. After [ANSWER_CORRECT], use the advertised runtime advance action when available; wait for its visible receipt before asking the next challenge. The final checked item completes automatically. Use replay to repeat the instruction, retry to clear an incorrect response, and advertised reminders or examples when the learner asks for help. Return keeps the original work. Never claim to move or highlight points. Legacy advance_activity is only for hosts without runtime choices. Component feedback is correctness evidence.',
  validate: validateActivityData,
  initialState: initialActivityState,
};
