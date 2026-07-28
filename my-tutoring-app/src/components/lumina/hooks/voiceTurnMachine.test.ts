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
      // No frame period supplied → voicedMs is the raw span, i.e. the exact
      // pre-2026-07-26 measurement. Callers that cannot tell us the period get
      // the old behaviour rather than a guess.
      voicedMs: 300,
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

  describe('frame quantisation (DI sitting 2026-07-26)', () => {
    // The machine samples the level once per capture frame — 85.3ms at
    // 48kHz/4096 — so `durationMs` spans first-above to last-above and misses
    // the closing frame's dwell. Against minVoiceMs=120 that quietly demanded
    // THREE frames of speech, and one-word answers ("five", "four") arrive in
    // two. Their activityEnd had already gone to Gemini, so the judge affirmed
    // answers the client then refused to own.
    const FRAME = 85.3;
    const quantised = { ...config, framePeriodMs: FRAME };

    /** An utterance spanning `frames` capture frames, then silence. */
    const utterance = (frames: number) => {
      const audio = Array.from({ length: frames }, (_, i) => ({ level: 0.045, now: i * FRAME }));
      const last = (frames - 1) * FRAME;
      return [...audio, { level: 0.001, now: last + FRAME }, { level: 0.001, now: last + FRAME + 600 }];
    };

    const closeOf = (frames: number, cfg = quantised) => {
      let state = IDLE_VOICE_TURN;
      let close;
      for (const frame of utterance(frames)) {
        const step = stepVoiceTurn(state, { tutorAudible: false, ...frame }, cfg);
        state = step.state;
        if (step.event?.kind === 'close') close = step.event;
      }
      return close;
    };

    it('a two-frame word is voice, not a blip — the answers the sitting lost', () => {
      // Measured span 85ms (one period), real speech ~171ms.
      expect(closeOf(2)).toMatchObject({ durationMs: 85, voicedMs: 170, belowMinVoice: false });
    });

    it('a one-frame blip is still rejected', () => {
      // Measured span 0ms, real speech ~85ms — under the bar either way.
      expect(closeOf(1)).toMatchObject({ durationMs: 0, voicedMs: 85, belowMinVoice: true });
    });

    it('without the fix that same two-frame word reads as a blip', () => {
      // The regression this guards: framePeriodMs 0 is the old measurement.
      expect(closeOf(2, config)).toMatchObject({ durationMs: 85, voicedMs: 85, belowMinVoice: true });
    });

    it('the bench probe turns clear the bar under both measurements', () => {
      // 2026-07-24 math-facts probe: 179/172/170ms — three frames, ~50ms of
      // margin. That is why the bar was never caught: the probe skated it.
      expect(closeOf(3, config)).toMatchObject({ durationMs: 171, belowMinVoice: false });
      expect(closeOf(3)).toMatchObject({ voicedMs: 256, belowMinVoice: false });
    });
  });

  it('force-close mirrors the open turn and is a no-op when idle', () => {
    const opened = run([{ level: 0.2, now: 0 }, { level: 0.2, now: 500 }]).state;
    const closed = closeVoiceTurn(opened, config);
    expect(closed.state).toEqual(IDLE_VOICE_TURN);
    expect(closed.event).toMatchObject({ kind: 'close', durationMs: 500, peak: 0.2 });
    expect(closeVoiceTurn(IDLE_VOICE_TURN, config)).toEqual({ state: IDLE_VOICE_TURN, event: null });
  });
});
