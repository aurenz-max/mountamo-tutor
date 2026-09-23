import type { DiMathFactsData } from '../../../primitives/visual-primitives/direct-instruction/DiMathFacts';
import { askFor, buildMathFactItems, mathFactChallengeValid }
  from '../../../primitives/visual-primitives/direct-instruction/diMathFactsDomain';
import { type WorkspaceDomain, validateChallengePool } from './adapterContract';

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

/** What the live adapter needs from this family; the catalog's `teachingWorkspace` declares the rest. */
export const diMathFactsLiveDomain: WorkspaceDomain<DiMathFactsData> = { validate: validateDiMathFactsData, initialState: diMathFactsState };

