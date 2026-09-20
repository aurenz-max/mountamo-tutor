import type { ComparisonBuilderData } from '../../../primitives/visual-primitives/math/ComparisonBuilder';
import type { LiveActivityAdapter } from './adapterContract';

export const COMPARISON_BUILDER_LIVE_MODES = ['compare_groups', 'compare_numbers',
  'order', 'one_more_less'] as const;

const CHALLENGE_TYPES = ['compare-groups', 'compare-numbers', 'order', 'one-more-one-less'];

/** Reject a comparison whose challenges cannot be attempted. */
export function validateComparisonBuilderData(value: unknown): ComparisonBuilderData {
  const d = value as ComparisonBuilderData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id
        || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated comparison builder has invalid lesson content.');
  // Each type needs the material its own ask is built from, or it mounts unanswerable.
  for (const c of d.challenges) {
    const ok = c.type === 'compare-groups'
        ? Number.isInteger(c.leftGroup?.count) && Number.isInteger(c.rightGroup?.count)
          && ['more', 'less', 'equal'].includes(c.correctAnswer ?? '')
      : c.type === 'compare-numbers'
        ? Number.isInteger(c.leftNumber) && Number.isInteger(c.rightNumber)
          && ['<', '>', '='].includes(c.correctSymbol ?? '')
      : c.type === 'order'
        ? Array.isArray(c.numbers) && c.numbers.length >= 3 && c.numbers.every(Number.isInteger)
          && new Set(c.numbers).size === c.numbers.length
      : Number.isInteger(c.targetNumber) && ['one-more', 'one-less', 'both'].includes(c.askFor ?? '');
    if (!ok) throw new Error('A comparison-builder challenge cannot be answered as generated.');
  }
  return d;
}

function comparisonBuilderState(data: ComparisonBuilderData) {
  const first = data.challenges[0];
  return {
    ...data,
    teachingOwner: 'tutor',
    totalChallenges: data.challenges.length,
    currentChallengeIndex: 0,
    challengeType: first.type,
    instruction: first.instruction,
    direction: first.direction ?? '',
    attemptNumber: 1,
    // `correctAnswer`, `correctSymbol` and the sorted arrangement are the ANSWER
    // on their modes, so none of them reaches the mounted tutor state.
  };
}

export const comparisonBuilderLive: LiveActivityAdapter<ComparisonBuilderData> = {
  teachingOwner: 'tutor',
  modes: COMPARISON_BUILDER_LIVE_MODES,
  canAdvance: true,
  grades: ['Kindergarten', 'Grade 1'],
  copy: {
    label: 'Comparison Builder', checkbox: 'Comparison builder', title: 'Learn to Compare',
    lessons: [['compare_groups', 'Which group has more'], ['compare_numbers', 'Compare two numbers'],
      ['order', 'Put numbers in order'], ['one_more_less', 'One more and one less']],
  },
  lessonStart: (grade, mode) => `[LESSON_START] Begin a comparison lesson now for ${grade}, mode ${mode}. `
    + `Call request_activity with primitiveId comparison-builder, mode ${mode}, a matching topic and intent. `
    + 'Use two practice challenges. Do not greet before mounting. Teach from the mounted instruction and use '
    + 'the advertised runtime actions for help and progression.',
  guidance: 'Use the current challenge instruction. The comparison word, the symbol, the sorted order and the '
    + 'stepped number are each the ANSWER on their own mode — never say one before the check. After a checked '
    + 'success, use the advertised advance action and wait for its visible receipt before introducing the next '
    + 'challenge. Use retry to clear an incorrect response, replay to focus and re-read the instruction, and the '
    + 'advertised reminders when the learner asks for help. Never claim to select, move, match or count anything '
    + '— every reminder is TEXT only. When the learner needs to SEE the method, request the advertised example: '
    + 'it shows two DIFFERENT rows of counters stacked and matched up, never the learner\'s own groups. After '
    + 'its visible receipt, say both counts and which row has counters left over with no partner, then return '
    + 'to the saved task. The component feedback line is the correctness evidence.',
  validate: validateComparisonBuilderData,
  initialState: comparisonBuilderState,
};
