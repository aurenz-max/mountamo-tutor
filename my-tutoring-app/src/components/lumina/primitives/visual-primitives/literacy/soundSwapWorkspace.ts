/**
 * Sound swap on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch B2). Its only teaching path: the scripted
 * speech loop was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer, the new word, judged against `resultWord`. The move names its sound every
 * time: an unnamed target has many right answers.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { speakablePhoneme } from './phonemeVoice';
import type { SoundSwapChallenge } from './SoundSwap';
import { moveAsk } from './soundSwapScript';

export const swapAssignment = (c: SoundSwapChallenge): TeachingAssignment => ({
  id: c.id,
  task: `The word is ${c.originalWord}. ${moveAsk(c)} Say the new word.`,
  response: 'speech',
  expectedAnswer: c.resultWord,
});

export function swapScene(c: SoundSwapChallenge, view: { highlighted: boolean }): WorkspaceScene {
  return { objects: [], facts: {
    operation: c.operation,
    constraints: 'The learner says the new word aloud. The starting word and its sounds are printed; the new word '
      + 'is not shown until it is credited. Tapping a sound asks you for that sound.'
      + (view.highlighted ? ' The sound to change is highlighted.' : ''),
  } };
}

/** What a tapped sound asks the tutor to say: that sound only, never the new word. */
export const swapSoundRequest = (raw: string) => `The learner tapped a sound. Say only that sound, once: ${speakablePhoneme(raw)}.`;

/** The journey's answers: the new word, or the starting word said back unchanged. */
export const swapHarnessAnswers = (c: SoundSwapChallenge) => ({ correct: c.resultWord, plainWrong: c.originalWord });
