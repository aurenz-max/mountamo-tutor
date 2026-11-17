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
  frames: Array<{ level: number; tutorAudible?: boolean; appAudible?: boolean; now: number }>,
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

    // Speech clears the bar but only starts a pending turn (deferred commit, below).
    const speech = run([{ level: 0.159, tutorAudible: true, now: 0 }]);
    expect(speech.state).toMatchObject({ active: false, pending: true });
    expect(speech.events).toEqual([{ kind: 'pending', at: 0 }]);
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
      { level: 0.16, tutorAudible: true, now: 250 },
      { level: 0.028, tutorAudible: false, now: 400 },
      { level: 0.028, tutorAudible: false, now: 1000 },
    ]);
    expect(bargeIn.events.map((event) => event.kind)).toEqual(['pending', 'open', 'close']);
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
    expect(events.map((event) => event.kind)).toEqual(['pending', 'open', 'close']);
    expect(events[2]).toEqual({
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

describe('app sound effects (agent-canvas, 2026-11-15: a turn held 27 s while the child tapped)', () => {
  // Echo bar 0.05, its hold floor 0.03. A tap's echo at 0.028 clears the ambient bar (0.025) and hold (0.015).
  const TAP = 0.028;

  it('a tap heard by the mic opens no turn', () => {
    expect(run([{ level: TAP, appAudible: true, now: 0 }]).events).toEqual([]);
    expect(run([{ level: TAP, now: 0 }]).events).toMatchObject([{ kind: 'open' }]);
  });

  it('taps every half second do not hold an open turn: it closes after the learner stops', () => {
    const frames: Array<{ level: number; appAudible?: boolean; now: number }> = [{ level: 0.1, now: 0 }];
    for (let t = 100; t <= 3000; t += 100) frames.push({ level: t % 500 === 0 ? TAP : 0.005, appAudible: t % 500 === 0, now: t });
    const { events } = run(frames);
    expect(events.map(e => e.kind)).toEqual(['open', 'close']);
    expect(events[1]).toMatchObject({ durationMs: 0 });
    // Without the flag the same taps hold the turn to the end.
    const held = run(frames.map(({ appAudible: _a, ...f }) => f));
    expect(held.events.map(e => e.kind)).toEqual(['open']);
  });

  it('a voice above the echo bar still holds a turn over a sound effect', () => {
    const { events, state } = run([{ level: 0.1, now: 0 }, { level: 0.06, appAudible: true, now: 400 }, { level: 0.06, appAudible: true, now: 800 }]);
    expect(events.map(e => e.kind)).toEqual(['open']);
    expect(state.lastAboveAt).toBe(800);
  });
});

describe('deferred commit over tutor audio (2026-11-15: one loud frame cut the tutor off)', () => {
  const FRAME = 85.3;
  const cfg = { ...config, framePeriodMs: FRAME };
  const drive = (frames: Array<{ level: number; tutorAudible?: boolean; now: number }>) => {
    let state: VoiceTurnState = IDLE_VOICE_TURN;
    const events = [];
    for (const frame of frames) {
      const step = stepVoiceTurn(state, { tutorAudible: true, ...frame }, cfg);
      state = step.state;
      if (step.event) events.push(step.event);
    }
    return { state, events };
  };
  const LOUD = 0.16;
  const ECHO = 0.033; // above the barge-in hold floor (0.03), below its opening bar (0.05)

  it('a one-frame noise over the tutor never opens a turn, even with echo after it', () => {
    const frames = [{ level: LOUD, now: 0 }];
    for (let i = 1; i <= 8; i++) frames.push({ level: ECHO, now: i * FRAME });
    const { state, events } = drive(frames);
    expect(events.map((event) => event.kind)).toEqual(['pending', 'discard']);
    expect(state).toEqual(IDLE_VOICE_TURN);
  });

  it('speech over the tutor opens on its third frame, dated from its first', () => {
    const { events } = drive([{ level: LOUD, now: 0 }, { level: LOUD, now: FRAME }, { level: LOUD, now: 2 * FRAME }]);
    expect(events).toEqual([{ kind: 'pending', at: 0 }, { kind: 'open', at: 0, duringTutorAudio: true }]);
  });

  it('the tutor going quiet turns a pending turn into an immediate answer', () => {
    const { events, state } = drive([{ level: LOUD, now: 0 }, { level: 0.03, tutorAudible: false, now: FRAME }]);
    expect(events).toEqual([{ kind: 'pending', at: 0 }, { kind: 'open', at: 0, duringTutorAudio: false }]);
    expect(state.openBar).toBe(cfg.silenceThreshold);
  });

  it('answering into silence still opens on one frame', () => {
    expect(drive([{ level: 0.03, tutorAudible: false, now: 0 }]).events).toEqual([{ kind: 'open', at: 0, duringTutorAudio: false }]);
  });

  it('bargeInCommitMs 0 is the old behaviour, and force-close drops a pending turn silently', () => {
    const step = stepVoiceTurn(IDLE_VOICE_TURN, { level: LOUD, tutorAudible: true, now: 0 }, { ...cfg, bargeInCommitMs: 0 });
    expect(step.event).toEqual({ kind: 'open', at: 0, duringTutorAudio: true });
    const pending = drive([{ level: LOUD, now: 0 }]).state;
    expect(closeVoiceTurn(pending, cfg)).toEqual({ state: IDLE_VOICE_TURN, event: null });
  });
});
