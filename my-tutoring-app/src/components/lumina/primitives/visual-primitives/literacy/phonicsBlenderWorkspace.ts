/**
 * Phonics blender on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch B2). Its only teaching path: the scripted
 * speech loop was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer, the whole word, so the observer judges it against `targetWord`.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { speakablePhoneme } from './phonemeVoice';
import type { BlendItem } from './phonicsBlenderScript';

export const blendAssignment = (item: BlendItem): TeachingAssignment => ({
  id: item.id,
  task: 'Blend the sounds of the letters on screen and say the whole word out loud.',
  response: 'speech',
  expectedAnswer: item.targetWord,
});

export interface BlendView {
  /** How much segmentation help the letter row gives (the support tier). */
  segmentation: 'full' | 'word' | 'none';
}

export function blendScene(item: BlendItem, view: BlendView): WorkspaceScene {
  return { objects: [], facts: {
    letters: item.phonemes.map(p => p.letters).join(view.segmentation === 'none' ? '' : ' '),
    constraints: 'The learner says the word aloud. Tapping a letter asks you for its sound. '
      + 'The word is never printed, and its picture appears only after the word is credited.'
      + (view.segmentation === 'none'
        ? ' The letters are joined as one word at this level: do not split it into sounds for the learner.'
        : ''),
  } };
}

/** What a tapped letter asks the tutor to say: its sound, never the word (the word is the answer). */
export const soundRequest = (raw: string) => `The learner tapped a letter. Say only its sound, once: ${speakablePhoneme(raw)}.`;

/** The journey's answers: the word itself, or a plainly different word. */
export function blendHarnessAnswers(item: BlendItem): { correct: string; plainWrong: string } {
  const wrong = ['dog', 'sun', 'hen', 'map'].find(candidate => candidate !== item.targetWord) ?? 'dog';
  return { correct: item.targetWord, plainWrong: wrong };
}

export const blendItems = (words: ReadonlyArray<{ id: string; targetWord: string; phonemes: BlendItem['phonemes']; emoji?: string }>): BlendItem[] =>
  words.map(w => ({ id: w.id, targetWord: w.targetWord, phonemes: w.phonemes, emoji: w.emoji }));
