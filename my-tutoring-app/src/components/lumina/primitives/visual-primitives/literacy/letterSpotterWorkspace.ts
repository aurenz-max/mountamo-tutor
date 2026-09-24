/**
 * Letter spotter on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C2). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Name it is one
 * spoken letter (the one the starred word starts with). Find it (tap the one cell holding the
 * named letter) and match it (tap the little form of the big letter) are taps the activity checks.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { askFor, letterSpotterHarnessAnswers, type LetterSpotterItem } from './letterSpotterScript';

export function letterSpotterAssignment(item: LetterSpotterItem): TeachingAssignment {
  if (item.mode !== 'name-it') return { id: item.id, task: askFor(item), response: 'gesture' };
  return { id: item.id, task: askFor(item), response: 'speech',
    expectedAnswer: `The letter ${item.targetLetter.toUpperCase()}, the first letter of ${item.targetWord}. Its name or its `
      + `sound counts; ${item.targetWord} said back is not a letter.` };
}

export function letterSpotterScene(item: LetterSpotterItem): WorkspaceScene {
  const shown = item.mode === 'name-it'
    ? `A sentence with the first letter of ${item.targetWord} hidden behind a star. Do not say or spell that letter before the learner tries.`
    : item.mode === 'find-it'
      ? 'Sixteen letters in a grid; exactly one is the named letter. The learner taps it; the activity checks the tap.'
      : 'One big letter and some little letters. Do not name the big letter: matching its shape is the task. The learner '
        + 'taps a little letter; the activity checks the tap.';
  return { objects: [], facts: {
    shown,
    constraints: item.mode === 'name-it'
      ? 'The learner says the letter out loud. Tapping the sentence asks you to say the question again.'
      : 'The learner answers by tapping. You cannot tap. The hear-again control asks you to repeat the question only.',
  } };
}

/** How a tap reads to the tutor and the observer: which letter, never the key. */
export const describeLetterTap = (letter: string) => `Tapped the letter ${letter}.`;

/** What hear-again asks the tutor to say: the question only, never the answer. */
export const hearQuestionRequest = (item: LetterSpotterItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${askFor(item)}"`;

/** The journey's answers: the letter said, or the right and a wrong tap. */
export function letterSpotterJourneyAnswers(item: LetterSpotterItem): { correct: string; plainWrong: string; tapped?: { correct: string; wrong: string } } {
  const { correct, plainWrong, tapped } = letterSpotterHarnessAnswers(item);
  return { correct, plainWrong, tapped };
}
