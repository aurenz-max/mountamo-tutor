// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_VOICE_TURN_CONFIG } from './voiceTurnMachine';
import type { LoopEmission } from './judgedLoopModel';
import type { CueLogEvent } from './useJudgedSpeechLoop';

let sharedClose: ((event: Record<string, unknown>) => void) | undefined;
let localEnabled: boolean | undefined;
let sharedSubscribeCount = 0;
/** Live holds on the provider's ref-counted bracket (item 31). */
let holds = 0;
interface Msg { role: 'user' | 'assistant'; content: string; timestamp: number }
const ctxState: { conversation: Msg[]; sentTexts: string[] } = { conversation: [], sentTexts: [] };
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
    conversation: ctxState.conversation,
    isAudioPlaying: false,
    sessionMode: 'lesson',
    sessionResumeCount: 0,
    sharedVoiceTurns: shared,
    sendText: (text: string) => { ctxState.sentTexts.push(text); },
    holdVoiceTurns: () => {
      holds += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        holds -= 1;
      };
    },
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

/**
 * ITEM 31 (qa/di/BACKLOG.md, 2026-09-04) — LESSON FOCUS. The scroll layout
 * keeps every block mounted, and a run the student scrolled away from keeps
 * running. Lesson-bench sitting de90b50f9e1b: ten-frame was left one second
 * into a build item; its gesture hold (ref-counted in the provider, released
 * only on run end, a voice item, or unmount) outlived the student's attention,
 * so di-spoken-practice three blocks down was deaf for 149s — not one
 * activity_start. counting-board, left mid-item on a VOICE item, was still
 * armed and subscribed, so once the hold lifted a spoken "three" would have
 * been judged twice. `active` is the runner's word for "the lesson is pointed
 * at this block"; while false the loop holds nothing, hears nothing, reads
 * nothing and sends nothing — and takes all four back the moment it is true.
 */
describe('lesson focus — item 31', () => {
  const close = () => ({
    kind: 'close',
    startedAt: 100,
    durationMs: 500,
    voicedMs: 585,
    peak: 0.1,
    duringTutorAudio: false,
    belowMinVoice: false,
  });
  const judged = (emissions: LoopEmission[]) => emissions.filter((event) =>
    event.kind === 'verdict'
    || event.kind === 'unanchored-verdict'
    || event.kind === 'phantom-transcript'
    || event.kind === 'attempt-open');

  it('a gesture item holds the shared bracket only while its primitive is active', () => {
    holds = 0;
    const view = renderHook(
      ({ active }) => useJudgedSpeechLoop({
        enabled: true, listenForVoice: false, active, onEmission: () => {},
      }),
      { initialProps: { active: true } },
    );
    expect(holds).toBe(1);

    act(() => { view.rerender({ active: false }); });
    expect(holds, 'the student scrolled away and the hold outlived them').toBe(0);

    act(() => { view.rerender({ active: true }); });
    expect(holds, 'back on the block mid-build: the bracket is held again').toBe(1);

    view.unmount();
    expect(holds).toBe(0);
  });

  it('an inactive loop neither consumes shared turns nor the conversation, and takes both back on return', () => {
    const emissions: LoopEmission[] = [];
    ctxState.conversation = [];
    const view = renderHook(
      ({ active }) => useJudgedSpeechLoop({
        enabled: true, active, onEmission: (event) => emissions.push(event),
      }),
      { initialProps: { active: true } },
    );
    act(() => { view.result.current.arm(); });

    act(() => { view.rerender({ active: false }); });
    expect(sharedClose, 'unsubscribed from the shared turn authority').toBeUndefined();

    // Another block's exchange: the child answers IT and the tutor affirms IT.
    ctxState.conversation = [
      { role: 'user', content: 'three', timestamp: 1 },
      { role: 'assistant', content: 'Yes, three.', timestamp: 2 },
    ];
    act(() => { view.rerender({ active: false }); });
    expect(judged(emissions), "another block's answer was judged here").toHaveLength(0);

    act(() => { view.rerender({ active: true }); });
    expect(judged(emissions), "the other block's exchange replayed on return").toHaveLength(0);
    expect(sharedClose).toBeTypeOf('function');

    // Still armed where it left off: the next turn on THIS block is an attempt.
    act(() => { sharedClose?.(close()); });
    expect(emissions.some((event) => event.kind === 'attempt-open')).toBe(true);
  });

  it('a queued cue waits while the primitive is inactive and fires on return', () => {
    vi.useFakeTimers();
    try {
      const cues: CueLogEvent[] = [];
      ctxState.sentTexts = [];
      const view = renderHook(
        ({ active }) => useJudgedSpeechLoop({
          enabled: true, active, onEmission: () => {}, onCue: (event) => cues.push(event),
        }),
        { initialProps: { active: false } },
      );
      act(() => { view.result.current.queueCue('[ITEM] next'); });
      act(() => { vi.advanceTimersByTime(500); });
      expect(ctxState.sentTexts, 'asked its question over another block').toHaveLength(0);
      expect(cues.some((cue) => cue.phase === 'blocked' && cue.reason === 'inactive')).toBe(true);

      act(() => { view.rerender({ active: true }); });
      act(() => { vi.advanceTimersByTime(500); });
      expect(ctxState.sentTexts).toEqual(['[ITEM] next']);
    } finally {
      vi.useRealTimers();
    }
  });
});
