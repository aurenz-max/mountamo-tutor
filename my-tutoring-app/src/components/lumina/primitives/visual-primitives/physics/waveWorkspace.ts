/**
 * Wave Tank's scene on the shared tutor/JEV teaching workspace. Every item is an experiment the activity checks (the
 * card, `waveTank.card.ts`, names the moves; the boss gives the assignment), so no key reaches the tutor. The scene
 * carries what is drawn and what the learner's waves did: the first wave's settings, the paddle's settings now, the
 * stuck size stop on hard, and each wave. The tower's need is never in it: the learner finds out by sending waves.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import { LEVELS, runOutcome, waveWords, type KnockChallenge, type WaveRun } from './waveModel';

export interface KnockView {
  size: number;
  speed: number;
  /** The waves so far, oldest first. */
  runs: readonly WaveRun[];
  /** A wave is moving now. */
  running: boolean;
}

export function knockScene(c: KnockChallenge, view: KnockView): SceneOf {
  const facts: Record<string, string | number> = {
    tank: 'a long glass wave tank drawn in 3D, with grid squares on the back glass: a paddle at the left end with a box '
      + `of push-size knobs (1-${LEVELS}) and push-speed knobs (1-${LEVELS}), a cork floating in the middle, and a sandy `
      + `beach at the right end with a tower of ${c.blocks} blocks on it`,
    step: view.running ? 'a wave is moving down the tank' : view.runs.length ? 'sending waves and deciding' : 'setting the paddle for the next wave',
    goal: c.instruction,
    firstWave: `size ${c.start.size}, speed ${c.start.speed} (${waveWords(c.start.size, c.start.speed)}): ${runOutcome({ fell: false })}`,
    paddle: `set to size ${view.size}, speed ${view.speed}`,
    ...(c.sizeCap < LEVELS ? { sizeStop: `the push-size knobs above ${c.sizeCap} are locked` } : {}),
    waves: view.runs.length
      ? view.runs.map((r, i) => `wave ${i + 2}: size ${r.size}, speed ${r.speed} (${waveWords(r.size, r.speed)}): ${runOutcome(r)}`).join('; ')
      : 'none yet after the first',
    constraints: 'Before each wave the learner says aloud whether it will knock the tower down; the guess is never graded. '
      + 'A lab notebook under the tank lists each wave. The cork bobs up and down where it is as waves pass.',
  };
  return { objects: [], facts };
}
