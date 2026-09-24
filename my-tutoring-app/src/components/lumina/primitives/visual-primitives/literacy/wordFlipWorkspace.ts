/**
 * Word flip on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch B2). Its only teaching path: the scripted
 * speech loop was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer, the transformed word, judged against the challenge's `answer`.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WordFlipChallenge, WordFlipChallengeType } from './WordFlip';
import { countWord } from './wordFlipScript';

export const isPluralFlip = (type: WordFlipChallengeType): boolean => type !== 'past_ed' && type !== 'past_irregular';

/** The ask, with the answer nowhere in it: "Three what?" has one correct completion, the plural. */
export function flipAssignment(c: WordFlipChallenge): TeachingAssignment {
  const count = countWord(c.count ?? 2);
  const task = isPluralFlip(c.type)
    ? `There is one ${c.sourceWord}. Now there are ${count}. Say the word for ${count} of them: ${count} what?`
    : `Today I ${c.sourceWord}. It already happened yesterday. Say how it goes: yesterday I...`;
  return { id: c.id, task, response: 'speech', expectedAnswer: c.answer };
}

export function flipScene(c: WordFlipChallenge): WorkspaceScene {
  return { objects: [], facts: {
    change: isPluralFlip(c.type) ? `one to ${countWord(c.count ?? 2)}` : 'today to yesterday',
    constraints: 'The learner says the new word aloud. The word on the one-side card is printed; the new word is a '
      + 'blank until it is credited. Tapping the card asks you to say its word.',
  } };
}

/** What a tapped source card asks the tutor to say: the word unchanged, never the answer. */
export const sourceWordRequest = (sourceWord: string) =>
  `The learner tapped the word card. Say this word once, unchanged, and nothing else: "${sourceWord}".`;

/** The journey's answers: the word itself, or the source word said back (the signature error). */
export const flipHarnessAnswers = (c: WordFlipChallenge) => ({ correct: c.answer, plainWrong: c.sourceWord });
