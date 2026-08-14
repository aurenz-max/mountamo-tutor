// @vitest-environment jsdom
/**
 * The verdict-timeout TICK must survive context-identity churn.
 *
 * WHY THIS FILE EXISTS (found live 2026-08-10, cvc-speller port 4). The tick
 * effect depended on `dispatch`:
 *
 *     }, [enabled, dispatch]);        // TICK_MS is 1000
 *
 * `dispatch` → `schedulePendingCue` → `ctx`, and `LuminaAIContext` builds its
 * value as a PLAIN OBJECT LITERAL with no `useMemo`, while `setMicLevel` fires
 * on every audio frame. So the provider re-renders every ~10-40ms with a new
 * context identity, and this effect tore down and recreated a 1000ms interval
 * faster than it could ever fire — for an entire run.
 *
 * `verdictTimeoutMs` was therefore DEAD whenever the microphone was open, and
 * had been for four DI ports. Nothing noticed, because in those packs the tutor
 * always speaks: verdicts arrive through `tutor-text` and off-script through
 * `tutor-quiet`. `cvc-speller`'s `spell-word` is the first shape where the
 * tutor is deliberately SILENT, so the tick is the only thing that can close a
 * stray voice attempt — and `schedulePendingCue` refuses to send while an
 * attempt is open. One word said aloud mid-build jammed the lesson for good:
 * observed as a `[DI_CVC_BUILD]` cue that was never sent, while direct
 * `ctx.sendText` traffic (`[SAY_WORD]`) kept flowing past it.
 *
 * The bug was invisible to every existing test because they render once. This
 * one re-renders, which is the only condition under which it appears.
 */
import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';

/**
 * The real context, faithfully: a NEW object every call, exactly as
 * `LuminaAIContext` produces one per render because its value is an unmemoized
 * literal. Using a stable object here would make the test pass against the bug.
 */
vi.mock('@/contexts/LuminaAIContext', () => ({
  // 19b: the mic level is a SUBSCRIPTION now, not a context field. Stubbed
  // flat because nothing here asserts on the orb's spike ring.
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({
    isConnected: true,
    isListening: true,
    isAudioPlaying: false,
    micLevel: Math.random(),
    sessionMode: 'idle',
    sessionResumeCount: 0,
    conversation: [],
    sendText: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    startListening: vi.fn(),
    stopListening: vi.fn(),
    updateContext: vi.fn(),
  }),
}));

vi.mock('../useLiveVoiceTurns', () => ({
  useLiveVoiceTurns: () => ({
    isVoiceActive: () => false,
    reset: vi.fn(),
    floors: {},
    config: {},
  }),
}));

import { useJudgedSpeechLoop } from '../useJudgedSpeechLoop';

/** Only the 1000ms verdict scan — ignore the cue/verify-beat timers. */
const TICK_MS = 1000;

let setIntervalSpy: ReturnType<typeof vi.spyOn>;

const Harness: React.FC<{ onRerender: (fn: () => void) => void }> = ({ onRerender }) => {
  const [, setN] = useState(0);
  onRerender(() => setN((n) => n + 1));
  useJudgedSpeechLoop({ enabled: true, onEmission: () => {} });
  return null;
};

beforeEach(() => {
  setIntervalSpy = vi.spyOn(window, 'setInterval');
});
afterEach(() => {
  setIntervalSpy.mockRestore();
  cleanup();
});

const tickIntervals = () =>
  setIntervalSpy.mock.calls.filter((call: unknown[]) => call[1] === TICK_MS).length;

describe('useJudgedSpeechLoop · the verdict-timeout tick', () => {
  it('is created ONCE and survives re-renders that change context identity', () => {
    let rerender = () => {};
    render(<Harness onRerender={(fn) => { rerender = fn; }} />);

    const afterMount = tickIntervals();
    expect(afterMount).toBe(1);

    // 40 renders ≈ one second of microphone frames. Pre-fix this recreated the
    // interval 40 times, so it never lived long enough to fire even once.
    for (let i = 0; i < 40; i++) act(() => { rerender(); });

    expect(tickIntervals()).toBe(afterMount);
  });

  it('is torn down when the run is disabled', () => {
    const clearSpy = vi.spyOn(window, 'clearInterval');
    const Toggle: React.FC<{ enabled: boolean }> = ({ enabled }) => {
      useJudgedSpeechLoop({ enabled, onEmission: () => {} });
      return null;
    };
    const view = render(<Toggle enabled />);
    expect(tickIntervals()).toBe(1);
    view.rerender(<Toggle enabled={false} />);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
