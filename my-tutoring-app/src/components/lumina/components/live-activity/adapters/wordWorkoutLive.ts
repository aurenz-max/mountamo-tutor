import type { WordWorkoutData } from '../../../primitives/visual-primitives/literacy/WordWorkout';
import { challengeAskable, itemsFromChallenges } from '../../../primitives/visual-primitives/literacy/wordWorkoutScript';
import { wordWorkoutAssignment } from '../../../primitives/visual-primitives/literacy/wordWorkoutWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a challenge the pack would drop: a pair that is not ear-separable, a chain step that is not one letter,
 *  a sentence outside the read-aloud window, a word outside the code-owned pools. */
export const validateWordWorkoutData = (value: unknown): WordWorkoutData => validateChallengePool<WordWorkoutData>(value,
  c => !!c && challengeAskable(c),
  { pool: 'Generated word workout has invalid lesson content.', item: 'A word workout challenge cannot be asked.' });

/** What the live adapter needs from the workout; the catalog's `teachingWorkspace` declares the rest. */
export const wordWorkoutLiveDomain: WorkspaceDomain<WordWorkoutData> = {
  validate: validateWordWorkoutData,
  initialState: data => {
    const items = itemsFromChallenges(data.challenges);
    return workspaceOpening({ title: data.title, task: wordWorkoutAssignment(items[0]).task, total: items.length });
  },
};
