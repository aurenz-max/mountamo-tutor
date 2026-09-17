import { expect, it, vi } from 'vitest';
import { TutorSpeechClock } from './TutorSpeechClock';

it('does not confuse pre-speech idle with settlement; waits for the actual turn and audio tail', () => {
  const clock = new TutorSpeechClock(), settled = vi.fn();
  clock.afterNextTurn(settled); clock.audio(false); expect(settled).not.toHaveBeenCalled();
  clock.output(); clock.end(true); expect(settled).not.toHaveBeenCalled();
  clock.audio(false); expect(settled).toHaveBeenCalledTimes(1);
  clock.audio(false); clock.end(false); expect(settled).toHaveBeenCalledTimes(1);
});

it('cancels an abandoned cue without attributing the next turn to it', () => {
  const clock = new TutorSpeechClock(), settled = vi.fn();
  const cancel = clock.afterNextTurn(settled); cancel(); clock.end(false);
  expect(settled).not.toHaveBeenCalled();
});
