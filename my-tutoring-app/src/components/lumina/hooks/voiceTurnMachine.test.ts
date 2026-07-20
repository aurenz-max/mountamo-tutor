import { describe, expect, it } from 'vitest';
import {
  closeVoiceTurn,
  DEFAULT_VOICE_TURN_CONFIG,
  IDLE_VOICE_TURN,
  stepVoiceTurn,
  type VoiceTurnState,
} from './voiceTurnMachine';

const config = DEFAULT_VOICE_TURN_CONFIG; // 0.025 / ×2 / hold 0.6 / close 500ms / min 120ms

const run = (
  frames: Array<{ level: number; tutorAudible?: boolean; now: number }>,
  initial: VoiceTurnState = IDLE_VOICE_TURN,
) => {
  let state = initial;
  const events = [];
  for (const frame of frames) {
    const step = stepVoiceTurn(state, { tutorAudible: false, ...frame }, config);
    state = step.state;
    if (step.event) events.push(step.event);
  }
  return { state, events };
};

describe('voiceTurnMachine', () => {
  it('opens at the silence threshold when the tutor is quiet', () => {
    const { state, events } = run([
      { level: 0.01, now: 0 },
      { level: 0.026, now: 100 },
    ]);
    expect(state.active).toBe(true);
    expect(events).toEqual([{ kind: 'open', at: 100, duringTutorAudio: false }]);
  });

  it('DI-2: echo just above the silence bar does NOT open a turn over tutor audio', () => {
    // Probe run 2026-07-19 n8: echo blip peaked 0.033 while the tutor spoke,
    // chopping her cue line. Under the dual threshold the barge-in bar is
    // 0.05, so the blip never opens; real speech (n21 peak 0.219, n47 0.159)
    // still interrupts.
    const echo = run([{ level: 0.033, tutorAudible: true, now: 0 }]);
    expect(echo.state.active).toBe(false);
    expect(echo.events).toEqual([]);

    const speech = run([{ level: 0.159, tutorAudible: true, now: 0 }]);
    expect(speech.state.active).toBe(true);
    expect(speech.events).toEqual([{ kind: 'open', at: 0, duringTutorAudio: true }]);
  });

  it('holds an open turn down to the hysteresis floor of its opening bar', () => {
    const { state } = run([
      { level: 0.03, now: 0 },
      // hold floor = 0.025 * 0.6 = 0.015; 0.016 keeps the turn alive
      { level: 0.016, now: 200 },
    ]);
    expect(state.active).toBe(true);
    expect(state.lastAboveAt).toBe(200);
  });

  it('anchors a barge-in turn hold floor to the barge-in bar', () => {
    // 0.028 sits between the two hold floors: a silence-opened turn
    // (floor 0.025*0.6=0.015) is sustained by it, a barge-in turn
    // (floor 0.05*0.6=0.03) is not — even after the tutor goes quiet.
    const bargeIn = run([
      { level: 0.16, tutorAudible: true, now: 0 },
      { level: 0.028, tutorAudible: false, now: 200 },
      { level: 0.028, tutorAudible: false, now: 800 },
    ]);
    expect(bargeIn.state.active).toBe(false);

    const silenceOpened = run([
      { level: 0.03, now: 0 },
      { level: 0.028, now: 200 },
      { level: 0.028, now: 800 },
    ]);
    expect(silenceOpened.state.active).toBe(true);
  });

  it('closes after sustained silence and reports duration, peak, and provenance', () => {
    const { state, events } = run([
      { level: 0.1, tutorAudible: true, now: 0 },
      { level: 0.2, tutorAudible: true, now: 300 },
      { level: 0.001, now: 400 },
      { level: 0.001, now: 950 },
    ]);
    expect(state).toEqual(IDLE_VOICE_TURN);
    expect(events[1]).toEqual({
      kind: 'close',
      startedAt: 0,
      durationMs: 300,
      peak: 0.2,
      duringTutorAudio: true,
      belowMinVoice: false,
    });
  });

  it('flags sub-minVoice blips on close', () => {
    const { events } = run([
      { level: 0.03, now: 0 },
      { level: 0.03, now: 80 },
      { level: 0.001, now: 100 },
      { level: 0.001, now: 700 },
    ]);
    const close = events.find((event) => event.kind === 'close');
    expect(close).toMatchObject({ durationMs: 80, belowMinVoice: true });
  });

  it('force-close mirrors the open turn and is a no-op when idle', () => {
    const opened = run([{ level: 0.2, now: 0 }, { level: 0.2, now: 500 }]).state;
    const closed = closeVoiceTurn(opened, config);
    expect(closed.state).toEqual(IDLE_VOICE_TURN);
    expect(closed.event).toMatchObject({ kind: 'close', durationMs: 500, peak: 0.2 });
    expect(closeVoiceTurn(IDLE_VOICE_TURN, config)).toEqual({ state: IDLE_VOICE_TURN, event: null });
  });
});
