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
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { speakablePhoneme } from './phonemeVoice';
import { wordReadingMisses } from './spokenReadingMisses';
import type { SoundSwapChallenge } from './SoundSwap';
import { moveAsk } from './soundSwapScript';

export const swapAssignment = (c: SoundSwapChallenge): TeachingAssignment => {
  const misses = swapSpokenMisses(c);
  return { id: c.id, task: `The word is ${c.originalWord}. ${moveAsk(c)} Say the new word.`, response: 'speech',
    expectedAnswer: c.resultWord, ...(misses.length ? { misses } : {}) };
};

/**
 * The item's known wrong answers (handoff 20 Part B), from the ids `SWAP_MISSES` declares, most specific first:
 * the new word's sounds with no word, the starting word said back, an added sound put at the other end, a made-up
 * word. `other_position` is stated for addition only, where the other end is one place.
 */
export function swapSpokenMisses(c: SoundSwapChallenge): KnownMiss[] {
  const start = c.originalWord.toLowerCase(), result = c.resultWord.toLowerCase();
  const sound = (c.addPhoneme ?? '').replace(/\//g, '').trim();
  const moved = c.operation === 'addition' && /^[a-z]{1,2}$/.test(sound) && c.addPosition
    ? (c.addPosition === 'beginning' ? `${start}${sound}` : `${sound}${start}`) : null;
  return [
    ...wordReadingMisses(result, { only: ['sounds_no_word'], fact: `The new word is "${result}". ` }),
    { id: 'echo_start', pattern: `The starting word is "${start}" and the new word is "${result}". The learner says the starting word "${start}" back unchanged.`, examples: [start] },
    ...(moved ? [{ id: 'other_position', pattern: `The sound /${sound}/ goes at the ${c.addPosition} of "${start}" to make "${result}". The learner puts it at the other end instead and says "${moved}".`, examples: [moved] }] : []),
    { id: 'nonword', pattern: `The new word is "${result}", a real word. The learner says a made-up word that is not a real word and is neither "${start}" nor "${result}".` },
  ];
}

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
