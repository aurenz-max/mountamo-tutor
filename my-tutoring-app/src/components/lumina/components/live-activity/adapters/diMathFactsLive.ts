import type { DiMathFactsData } from '../../../primitives/visual-primitives/direct-instruction/DiMathFacts';
import { askFor, buildMathFactItems, mathFactChallengeValid, DI_MATH_FACTS_WORKSPACE_MODES }
  from '../../../primitives/visual-primitives/direct-instruction/diMathFactsDomain';
import { validateChallengePool, workspaceLessonStart, type LiveActivityAdapter } from './adapterContract';

/** Reject a pool whose items cannot be ASKED before they reach a five-year-old:
 *  a desynced answer word, or a stimulus carrying its own solution. */
export const validateDiMathFactsData = (value: unknown) =>
  validateChallengePool<DiMathFactsData>(value, mathFactChallengeValid, {
    pool: 'Generated math facts have invalid lesson content.',
    item: 'A math-fact item cannot run in the teaching workspace.' });

function diMathFactsState(data: DiMathFactsData) {
  const items = buildMathFactItems(data.challenges);
  return { title: data.title, instruction: askFor(items[0]), teachingOwner: 'tutor',
    totalChallenges: items.length,
    interaction: 'Teach from liveRuntime.task and its workspace. The child says the answer out loud; '
      + 'judge what you hear and say so naturally. The host records your completed feedback and handles retry '
      + 'and advance.' };
}

export const diMathFactsLive: LiveActivityAdapter<DiMathFactsData> = {
  tutoring: null,
  teachingOwner: 'tutor',
  // All five task identities are the same act — meet the printed problem, say
  // the number out loud — so they bind to one workspace rather than to five.
  // What differs is what the facts license: counting up, counting back, or no
  // counting route at all when the task is to name a printed numeral.
  modes: DI_MATH_FACTS_WORKSPACE_MODES,
  challengeTypes: data => data.challenges.map(c => c.challengeType),
  bindsTeachingWorkspace: true,
  canAdvance: false, // The dialogue observer owns checked progression.
  // The catalog entry scopes this pack to kindergarten and grade 1 fact fluency.
  grades: ['Kindergarten', 'Grade 1'],
  copy: {
    label: 'Math Facts', checkbox: 'Math facts', title: 'Say the Answer Out Loud',
    lessons: [['name_numeral', 'Name the printed numeral'],
      ['counting_next', 'Say the number that comes next'],
      ['answer_fact', 'Answer a printed addition fact'],
      ['fact_review', 'Mixed review of facts we know'],
      ['subtraction_fact', 'Answer a take-away fact']],
  },
  lessonStart: workspaceLessonStart('math-facts', 'di-math-facts'),
  // No example sentence anywhere below: a quoted sentence in this position becomes
  // the tutor's whole script (the letter-sounds finding). Length is also a hard
  // gate — `live_activity_tools.parse_activity_spec` caps guidance at 2000
  // characters and closes the socket with `Invalid activity offer` above it.
  guidance: 'You own the teaching conversation. Read the task and the workspace facts, then teach. '
    + 'The gold-bordered card shows ONE printed problem; the child answers it out loud. '
    + 'The answer is NOT on the card: the facts carry it so you can judge, not so you can supply it. '
    + 'Give the child a chance first, and never name an answer still to come. '
    + 'The one exception is naming a printed numeral: there the numeral itself is the answer. '
    + 'The support fact says how much you may model before they answer; at the cold tier, nothing. '
    + 'Judge the audio you hear against the assignment fact and say your verdict naturally. The transcript is '
    + 'noisy supporting context, never the answer. A different number is wrong however close it is, but '
    + 'young-child pronunciation of the right one is correct. The counting-route fact says whether counting '
    + 'to the answer is a legitimate route, and which way; where it is, a child who counts and then says the '
    + 'number has answered. Echoing a number out of the problem is a common miss, not a near answer. '
    + 'When the answer is right, say so and name the number back to the child in the same breath, in your own '
    + 'words. Praise that names no number is generic and credits nothing. Asking for a smaller step is good '
    + 'teaching, but praise straight after one credits only that step: return to the whole fact before '
    + 'affirming. '
    + 'Use begin_help before guiding questions, explanations or a demonstration. Use demonstrate with the '
    + 'target "problem", or a term target from workspace.objects, and [] to clear; wait for the visible result '
    + 'before saying anything is marked. '
    + 'No other scene action exists: you cannot write the answer, change the problem, or answer for the child. '
    + 'Teach one step at a time. The host records your completed feedback, so do not call a '
    + 'recording or progression tool, and do not request another activity. '
    + 'No correction cap and no scripted wording.',
  validate: validateDiMathFactsData,
  initialState: diMathFactsState,
};
