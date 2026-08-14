// @vitest-environment jsdom
/**
 * The turn authority runs on AUDIO FRAMES, not on renders.
 *
 * WHY THIS FILE EXISTS (DI BACKLOG 19b, 2026-08-14). Until this slice the mic
 * level was a field on the LuminaAIContext value, and `useLiveVoiceTurns`
 * stepped its machine inside a `useEffect` keyed on it. Every ~10-40ms frame
 * therefore had to become provider state and re-render the entire tree under
 * the provider before a turn could open — 30-100 whole-tree renders a second to
 * move one float, and a new `ctx` identity each time, which is the churn that
 * killed `verdictTimeoutMs` for four ports (see
 * `useJudgedSpeechLoop.tick.test.tsx`).
 *
 * The level is a subscription now. That makes this the load-bearing seam of the
 * whole judged family: if the subscription is wrong, no turn ever opens and
 * every DI surface goes deaf — a far worse failure than the churn it replaced.
 * So this pins the mechanism from both sides: frames alone must open and close a
 * turn WITHOUT a render, and renders alone must not resubscribe.
 */
import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';

// Everything below drives the transport-taking variant directly, which is the
// provider's own entry point. The context is stubbed only so importing the
// module does not drag Firebase in.
vi.mock('@/contexts/LuminaAIContext', () => ({
  useLuminaAIContext: () => ({}),
}));

import { useLiveVoiceTurnsWithTransport } from '../useLiveVoiceTurns';
import { DEFAULT_VOICE_TURN_CONFIG } from '../voiceTurnMachine';
import { VOICE_CALIBRATION_MIN_SAMPLES } from '../voiceTurnCalibration';
import type { VoiceTurnEvent } from '../voiceTurnMachine';

/** A frame at the real capture cadence: 4096 samples at 48kHz. */
const FRAME_MS = 85.3;
/** Comfortably under the ambient bar — this is what calibrates the floor. */
const QUIET = 0.001;
/** Comfortably over it, and over MIN_BARGE_BAR too. */
const LOUD = 0.09;

/** The provider's publish side, in miniature. */
function makeMicSource() {
  const listeners = new Set<(level: number) => void>();
  let subscribeCount = 0;
  return {
    get subscribeCount() { return subscribeCount; },
    get listenerCount() { return listeners.size; },
    subscribeMicLevel: (listener: (level: number) => void) => {
      subscribeCount += 1;
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    /** Publish n frames, advancing the fake clock one frame period each. */
    publish(level: number, frames = 1) {
      for (let i = 0; i < frames; i++) {
        now += FRAME_MS;
        act(() => { listeners.forEach((listener) => listener(level)); });
      }
    },
  };
}

let now = 0;

const setup = (opts: { enabled?: boolean } = {}) => {
  const mic = makeMicSource();
  const sendActivityStart = vi.fn();
  const sendActivityEnd = vi.fn();
  const opens: Array<Extract<VoiceTurnEvent, { kind: 'open' }>> = [];
  const closes: Array<Extract<VoiceTurnEvent, { kind: 'close' }>> = [];

  let rerender = () => {};
  let setEnabled = (_: boolean) => {};

  const Harness: React.FC = () => {
    const [n, setN] = useState(0);
    const [enabled, setLocalEnabled] = useState(opts.enabled ?? true);
    rerender = () => setN((v) => v + 1);
    setEnabled = setLocalEnabled;
    useLiveVoiceTurnsWithTransport(
      {
        enabled,
        onTurnOpen: (event) => { opens.push(event); },
        onTurnClose: (event) => { closes.push(event); },
      },
      {
        // A NEW transport object every render, exactly like the provider's —
        // the hook must not treat that as a reason to resubscribe.
        subscribeMicLevel: mic.subscribeMicLevel,
        micFramePeriodMs: FRAME_MS,
        isTutorAudible: false,
        sendActivityStart,
        sendActivityEnd,
      },
    );
    return <span data-testid="renders">{n}</span>;
  };

  const view = render(<Harness />);
  return {
    mic, opens, closes, sendActivityStart, sendActivityEnd, view,
    rerender: () => act(() => { rerender(); }),
    setEnabled: (value: boolean) => act(() => { setEnabled(value); }),
  };
};

beforeEach(() => {
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('useLiveVoiceTurns · frames, not renders', () => {
  it('opens and closes a turn from published frames alone, with no re-render', () => {
    const t = setup();
    const rendersBefore = t.view.getByTestId('renders').textContent;

    // Calibration beat: the machine refuses to open before the ambient regime
    // has its bar, and that is deliberate (a phantom turn on an arbitrary
    // device floor is worse than a late one).
    t.mic.publish(QUIET, VOICE_CALIBRATION_MIN_SAMPLES);
    expect(t.opens).toHaveLength(0);

    // The child speaks.
    t.mic.publish(LOUD, 4);
    expect(t.opens).toHaveLength(1);
    expect(t.sendActivityStart).toHaveBeenCalledTimes(1);

    // …and stops. silenceCloseMs of quiet closes the turn.
    const quietFrames = Math.ceil(DEFAULT_VOICE_TURN_CONFIG.silenceCloseMs / FRAME_MS) + 2;
    t.mic.publish(QUIET, quietFrames);
    expect(t.closes).toHaveLength(1);
    expect(t.sendActivityEnd).toHaveBeenCalledTimes(1);
    // Four frames over the bar at 85.3ms ≈ 341ms of voice — a real answer, not
    // a blip, so the loop above may anchor an attempt on it.
    expect(t.closes[0].belowMinVoice).toBe(false);

    // THE POINT: none of that cost a render. The whole turn — calibration,
    // open, activity brackets, close — happened outside React.
    expect(t.view.getByTestId('renders').textContent).toBe(rendersBefore);
  });

  it('subscribes ONCE across a storm of re-renders', () => {
    const t = setup();
    expect(t.mic.subscribeCount).toBe(1);

    // 40 renders ≈ one second of frames under the old regime. Each hands the
    // hook a brand-new transport object.
    for (let i = 0; i < 40; i++) t.rerender();

    expect(t.mic.subscribeCount).toBe(1);
    expect(t.mic.listenerCount).toBe(1);
  });

  it('unsubscribes when disabled and picks the frames back up when re-enabled', () => {
    const t = setup();
    t.mic.publish(QUIET, VOICE_CALIBRATION_MIN_SAMPLES);

    t.setEnabled(false);
    expect(t.mic.listenerCount).toBe(0);
    t.mic.publish(LOUD, 4);
    expect(t.opens).toHaveLength(0);

    t.setEnabled(true);
    expect(t.mic.listenerCount).toBe(1);
    t.mic.publish(LOUD, 4);
    expect(t.opens).toHaveLength(1);
  });

  it('drops its listener on unmount — a dead hook must not keep judging frames', () => {
    const t = setup();
    expect(t.mic.listenerCount).toBe(1);
    t.view.unmount();
    expect(t.mic.listenerCount).toBe(0);
  });
});
