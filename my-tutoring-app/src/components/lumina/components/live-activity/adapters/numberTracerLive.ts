import type { NumberTracerData } from '../../../primitives/visual-primitives/math/NumberTracer';
import type { LiveActivityAdapter } from './adapterContract';

export const NUMBER_TRACER_LIVE_MODES = ['trace', 'copy', 'write', 'sequence'] as const;

/** Reject a writing set whose challenges cannot be attempted. */
export function validateNumberTracerData(value: unknown): NumberTracerData {
  const d = value as NumberTracerData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id
        || !NUMBER_TRACER_LIVE_MODES.includes(c.type as any)
        || typeof c.instruction !== 'string' || !c.instruction.trim()
        || !Number.isInteger(c.digit) || c.digit < 0 || c.digit > 20))
    throw new Error('Generated number tracer has invalid lesson content.');
  // A `sequence` ask has to say WHICH box is empty, or there is nothing to write.
  if (d.challenges.some(c => c.type === 'sequence'
      && (!Array.isArray(c.sequenceNumbers) || !c.sequenceNumbers.length
        || !Number.isInteger(c.missingIndex) || c.missingIndex! < 0
        || c.missingIndex! >= c.sequenceNumbers!.length)))
    throw new Error('A number-tracer sequence challenge has no writable blank.');
  return d;
}

function numberTracerState(data: NumberTracerData) {
  const first = data.challenges[0];
  return {
    ...data,
    teachingOwner: 'tutor',
    totalChallenges: data.challenges.length,
    currentChallengeIndex: 0,
    challengeType: first.type,
    instruction: first.instruction,
    showModel: first.showModel ?? true,
    showArrows: first.showArrows ?? true,
    attemptNumber: 1,
    // `digit` is the ANSWER on every type here, so it stays out of the mounted state.
  };
}

export const numberTracerLive: LiveActivityAdapter<NumberTracerData> = {
  teachingOwner: 'tutor',
  modes: NUMBER_TRACER_LIVE_MODES,
  canAdvance: true,
  grades: ['Kindergarten', 'Grade 1'],
  copy: {
    label: 'Number Tracer', checkbox: 'Number tracer', title: 'Learn to Write Numbers',
    lessons: [['trace', 'Trace the number'], ['copy', 'Copy the number'],
      ['write', 'Write it from memory'], ['sequence', 'Fill the empty box']],
  },
  lessonStart: (grade, mode) => `[LESSON_START] Begin a number-writing lesson now for ${grade}, mode ${mode}. `
    + `Call request_activity with primitiveId number-tracer, mode ${mode}, a matching topic and intent. `
    + 'Use two practice challenges. Do not greet before mounting. Teach from the mounted instruction and use '
    + 'the advertised runtime actions for help and progression.',
  guidance: 'Use the current challenge instruction. The target numeral is the ANSWER on every mode here — never '
    + 'say it, spell it or describe its shape before the check. After a checked success, use the advertised '
    + 'advance action and wait for its visible receipt before introducing the next challenge. Use retry to clear '
    + 'an incorrect drawing, replay to focus and re-read the instruction, and the advertised reminders when the '
    + 'learner asks for help. Never claim to draw, trace, erase or highlight anything — every reminder is TEXT '
    + 'only. This family has no worked example: a row of counters cannot show how a numeral is formed. The '
    + 'component feedback line is the correctness evidence.',
  validate: validateNumberTracerData,
  initialState: numberTracerState,
};
