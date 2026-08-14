// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_VOICE_TURN_CONFIG } from './voiceTurnMachine';
import type { LoopEmission } from './judgedLoopModel';

let sharedClose: ((event: Record<string, unknown>) => void) | undefined;
let localEnabled: boolean | undefined;
let sharedSubscribeCount = 0;
const shared = {
  subscribe: (listener: { onTurnClose?: (event: Record<string, unknown>) => void }) => {
    sharedSubscribeCount += 1;
    sharedClose = listener.onTurnClose;
    return () => { sharedClose = undefined; };
  },
  isVoiceActive: () => false,
  reset: vi.fn(),
  lastTurnOpenAtRef: { current: null },
  floorsRef: { current: { ambientRms: 0, echoRms: 0 } },
  config: DEFAULT_VOICE_TURN_CONFIG,
};

vi.mock('@/contexts/LuminaAIContext', () => ({
  // 19b: the mic level is a SUBSCRIPTION now, not a context field. Stubbed
  // flat because nothing here asserts on the orb's spike ring.
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({
    conversation: [],
    isAudioPlaying: false,
    sessionMode: 'lesson',
    sessionResumeCount: 0,
    sharedVoiceTurns: shared,
    sendText: vi.fn(),
  }),
}));

vi.mock('./useLiveVoiceTurns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./useLiveVoiceTurns')>();
  return {
    ...actual,
    useLiveVoiceTurns: (options: { enabled: boolean }) => {
      localEnabled = options.enabled;
      return {
        isVoiceActive: () => false,
        reset: vi.fn(),
        lastTurnOpenAtRef: { current: null },
        floorsRef: shared.floorsRef,
        config: DEFAULT_VOICE_TURN_CONFIG,
      };
    },
  };
});

import { useJudgedSpeechLoop } from './useJudgedSpeechLoop';

describe('useJudgedSpeechLoop shared lesson turns', () => {
  /**
   * REGRESSION (DI BACKLOG 19b, 2026-08-14) — the lesson-mode resubscribe.
   *
   * This effect's deps run `handleVoiceTurnClose` → `dispatch` →
   * `schedulePendingCue` → `ctx`. The provider builds its value as a plain
   * object literal, so every one of those took a new identity on every provider
   * render — and while `micLevel` lived on that value, a provider render was
   * every audio frame. So in a lesson the judged loop UNSUBSCRIBED AND
   * RESUBSCRIBED from the shared turn authority 30-100 times a second, for the
   * whole run, on every judged surface.
   *
   * It never lost a turn (subscribe/unsubscribe are synchronous and a turn
   * closes between frames), which is why nothing caught it — the cost was pure
   * waste, and the same dependency shape one file over was the fatal
   * `verdictTimeoutMs` bug. `schedulePendingCue` reaches the tutor through
   * `sendTextRef` now, which makes the whole chain identity-stable.
   */
  it('subscribes to the shared turn authority ONCE, whatever the render rate', () => {
    sharedSubscribeCount = 0;
    const view = renderHook(
      ({ enabled }) => useJudgedSpeechLoop({ enabled, onEmission: () => {} }),
      { initialProps: { enabled: true } },
    );

    expect(sharedSubscribeCount).toBe(1);

    // 40 renders ≈ one second of microphone frames under the old regime, each
    // handing the hook a brand-new `ctx` object exactly as the provider does.
    for (let i = 0; i < 40; i++) act(() => { view.rerender({ enabled: true }); });

    expect(sharedSubscribeCount).toBe(1);
  });

  it('consumes provider closes without opening a second turn authority', () => {
    const emissions: LoopEmission[] = [];
    const closes: Record<string, unknown>[] = [];
    const view = renderHook(() => useJudgedSpeechLoop({
      enabled: true,
      onEmission: (event) => emissions.push(event),
      onVoiceTurnClose: (event) => closes.push(event),
    }));

    expect(localEnabled).toBe(false);
    expect(sharedClose).toBeTypeOf('function');

    act(() => {
      view.result.current.arm();
      sharedClose?.({
        kind: 'close',
        startedAt: 100,
        durationMs: 500,
        voicedMs: 585,
        peak: 0.1,
        duringTutorAudio: false,
        belowMinVoice: false,
      });
    });

    expect(closes).toHaveLength(1);
    expect(emissions.some((event) => event.kind === 'attempt-open')).toBe(true);
    expect(shared.reset).not.toHaveBeenCalled();
  });

  /**
   * REGRESSION — first lesson-integrated DI sitting (run 967e2399f310,
   * 2026-08-06): the child tapped start, the opening cue went out, and the loop
   * then ignored every answer. 9 voice turns above the bar, `attempts: 0`; every
   * hook-produced emission present in the run log, every reducer-produced one
   * missing. The loop was unarmed for the whole run.
   *
   * The mechanism is the interleave below. A pack arms inside `startRun`, which
   * runs `setRunning(true)` and `arm()` in ONE synchronous block — so the ref
   * write lands BEFORE React commits `enabled: true`. The disable→disarm effect
   * was level-triggered (`if (enabled) return`) on deps that change identity on
   * every render (`dispatch` → `schedulePendingCue` → `ctx`, and the lesson
   * provider rebuilds its context value on every mic-level frame). So any effect
   * pass still carrying `enabled === false` — a re-render racing the arm, or the
   * previous render's deferred passive effects flushing late — silently undid
   * the arm, and nothing ever re-armed it.
   *
   * Disabling must therefore disarm on the FALLING EDGE of `enabled`, not on
   * every pass that happens to observe it false.
   */
  it('keeps an arm that a still-disabled render pass lands on top of', () => {
    const emissions: LoopEmission[] = [];
    const view = renderHook(
      ({ enabled }) => useJudgedSpeechLoop({
        enabled,
        onEmission: (event) => emissions.push(event),
      }),
      { initialProps: { enabled: false } },
    );

    // startRun(): the cue goes out and the loop arms, all before the
    // `running: true` state update has been committed by React.
    act(() => { view.result.current.arm(); });

    // A render pass that still sees the pre-run `enabled: false`.
    act(() => { view.rerender({ enabled: false }); });

    // ...and only now does the run's own commit land.
    act(() => { view.rerender({ enabled: true }); });

    act(() => {
      sharedClose?.({
        kind: 'close',
        startedAt: 100,
        durationMs: 1286,
        voicedMs: 1371,
        peak: 0.0117,
        duringTutorAudio: false,
        belowMinVoice: false,
      });
    });

    expect(
      emissions.some((event) => event.kind === 'attempt-open'),
      'the learner spoke and the loop opened no attempt — it was disarmed',
    ).toBe(true);
  });

  /**
   * The failure mode that made the 2026-08-06 sitting a forensic dig: a deaf
   * loop is invisible. It opens no attempt, so `attempts`, `transcripts`,
   * `affirmed` and `unanchored` all read zero — identical to a child who never
   * spoke. Detection has to be hook-side: the reducer is deliberately inert when
   * disarmed (DI-3) and cannot tell "run in progress" from "idle between runs".
   */
  it('reports a real voice turn that closes into an unarmed live run', () => {
    const emissions: LoopEmission[] = [];
    renderHook(() => useJudgedSpeechLoop({
      enabled: true,
      onEmission: (event) => emissions.push(event),
    }));

    // Enabled, never armed — the learner answers anyway.
    act(() => {
      sharedClose?.({
        kind: 'close',
        startedAt: 100,
        durationMs: 1286,
        voicedMs: 1371,
        peak: 0.0117,
        duringTutorAudio: false,
        belowMinVoice: false,
      });
    });

    expect(emissions.some((event) => event.kind === 'loop-deaf')).toBe(true);
    expect(emissions.some((event) => event.kind === 'attempt-open')).toBe(false);
  });

  it('does not report a sub-minimum blip as a deaf loop', () => {
    const emissions: LoopEmission[] = [];
    renderHook(() => useJudgedSpeechLoop({
      enabled: true,
      onEmission: (event) => emissions.push(event),
    }));

    act(() => {
      sharedClose?.({
        kind: 'close',
        startedAt: 100,
        durationMs: 0,
        voicedMs: 85,
        peak: 0.008,
        duringTutorAudio: false,
        belowMinVoice: true,
      });
    });

    expect(emissions.some((event) => event.kind === 'loop-deaf')).toBe(false);
  });

  it('still disarms on a genuine falling edge', () => {
    const emissions: LoopEmission[] = [];
    const view = renderHook(
      ({ enabled }) => useJudgedSpeechLoop({
        enabled,
        onEmission: (event) => emissions.push(event),
      }),
      { initialProps: { enabled: true } },
    );

    act(() => { view.result.current.arm(); });
    act(() => { view.rerender({ enabled: false }); });
    act(() => { view.rerender({ enabled: true }); });

    // The run ended and was not restarted: a turn arriving now belongs to
    // nothing, and must not be credited to the finished run.
    act(() => {
      sharedClose?.({
        kind: 'close',
        startedAt: 100,
        durationMs: 1286,
        voicedMs: 1371,
        peak: 0.0117,
        duringTutorAudio: false,
        belowMinVoice: false,
      });
    });

    expect(emissions.some((event) => event.kind === 'attempt-open')).toBe(false);
  });
});
