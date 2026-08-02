// @vitest-environment jsdom
/**
 * The engine's session-liveness ladder + resume signal (DI BACKLOG item 5).
 *
 * WHY THESE ARE PINNED BY TESTS (2026-07-31). The math-facts stress sitting's
 * Finding 1: from ~turn 15 the child kept answering — activity brackets kept
 * going out — with ZERO tutor output and no verdict, forever. Two mechanisms,
 * one observed behavior: a GoAway/resume restored the SESSION but nothing
 * re-cued the ITEM in flight (the pending verdict died with the old
 * connection), or generation wedged outright. The engine now owns both halves
 * of detection:
 *
 * - `session-resumed`: the context's sessionResumeCount changed while the run
 *   was live → the consumer re-cues the current item (its resync branch).
 * - `session-dead`: a cue was SENT and the tutor produced NOTHING — no audio
 *   rise, no output text — within CUE_DEAD_MS; SESSION_DEAD_CUES consecutive
 *   dead cues emit `session-dead` (and keep emitting on continued silence, so
 *   a failed recovery escalates).
 *
 * The load-bearing negative: liveness is cue→tutor-AUDIO, never cue→verdict.
 * A child may think 35.9s before answering (observed, benign) — the ladder
 * must NOT fire when the tutor's lead-in already played and the room went
 * quiet waiting on the child.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LoopEmission } from './judgedLoopModel';
import type { CueLogEvent } from './useJudgedSpeechLoop';

interface Msg { role: 'user' | 'assistant'; content: string; timestamp: number }

const ctxState: { conversation: Msg[]; isAudioPlaying: boolean; sessionResumeCount: number } = {
  conversation: [],
  isAudioPlaying: false,
  sessionResumeCount: 0,
};
const sentTexts: string[] = [];
vi.mock('@/contexts/LuminaAIContext', () => ({
  useLuminaAIContext: () => ({
    conversation: ctxState.conversation,
    isAudioPlaying: ctxState.isAudioPlaying,
    sessionResumeCount: ctxState.sessionResumeCount,
    sendText: (text: string) => { sentTexts.push(text); },
  }),
}));

vi.mock('./useLiveVoiceTurns', () => ({
  useLiveVoiceTurns: () => ({ isVoiceActive: () => false, reset: vi.fn() }),
}));

import { useJudgedSpeechLoop } from './useJudgedSpeechLoop';

/** Clears VERIFY_BEAT_MS (400ms) without touching CUE_DEAD_MS (10s). */
const BEAT = 500;
/** One dead-cue window (CUE_DEAD_MS) with margin under the next one. */
const DEAD_WINDOW = 10_100;

const setup = (over: { enabled?: boolean } = {}) => {
  const emissions: LoopEmission[] = [];
  const cues: CueLogEvent[] = [];
  const view = renderHook(
    ({ enabled }: { enabled: boolean }) => useJudgedSpeechLoop({
      enabled,
      onEmission: (e) => emissions.push(e),
      onCue: (e) => cues.push(e),
    }),
    { initialProps: { enabled: over.enabled ?? true } },
  );
  const beat = (ms = BEAT) => act(() => { vi.advanceTimersByTime(ms); });
  const kinds = () => emissions.map((e) => e.kind);
  const deadCues = () => cues.filter((c) => c.phase === 'dead');
  return { emissions, cues, view, beat, kinds, deadCues };
};

beforeEach(() => {
  vi.useFakeTimers();
  ctxState.conversation = [];
  ctxState.isAudioPlaying = false;
  ctxState.sessionResumeCount = 0;
  sentTexts.length = 0;
});
afterEach(() => vi.useRealTimers());

describe('useJudgedSpeechLoop — the resume signal (fix (i))', () => {
  it('emits session-resumed when sessionResumeCount changes mid-run', () => {
    const { kinds, view } = setup();
    act(() => {
      ctxState.sessionResumeCount = 1;
      view.rerender({ enabled: true });
    });
    expect(kinds()).toEqual(['session-resumed']);
  });

  it('never resends cue text itself — re-cueing is the consumer’s (pedagogy)', () => {
    const { view } = setup();
    act(() => {
      ctxState.sessionResumeCount = 1;
      view.rerender({ enabled: true });
    });
    expect(sentTexts).toEqual([]);
  });

  it('a resume while disabled is swallowed, not replayed on enable', () => {
    // A resume between runs is not this run's business: enabling must not
    // re-cue an item no cue was ever out for.
    const { kinds, view } = setup({ enabled: false });
    act(() => {
      ctxState.sessionResumeCount = 1;
      view.rerender({ enabled: false });
    });
    expect(kinds()).toEqual([]);
    act(() => view.rerender({ enabled: true }));
    expect(kinds()).toEqual([]);
  });

  it('a nonzero count at mount is baseline, not an event', () => {
    ctxState.sessionResumeCount = 3;
    const { kinds } = setup();
    expect(kinds()).toEqual([]);
  });
});

describe('useJudgedSpeechLoop — the dead-cue ladder (fix (ii), level 2)', () => {
  it('counts a dead cue and escalates to session-dead at two', () => {
    const { view, beat, kinds, deadCues } = setup();
    act(() => view.result.current.queueCue('[DI_ITEM] two plus one'));
    beat(); // sent
    expect(sentTexts).toHaveLength(1);

    beat(DEAD_WINDOW); // first window elapses in silence
    expect(deadCues()).toHaveLength(1);
    expect(kinds()).toEqual([]); // one dead cue is not yet a dead session

    beat(DEAD_WINDOW); // ~20s of proven tutor silence
    expect(deadCues()).toHaveLength(2);
    expect(kinds()).toEqual(['session-dead']);
    expect(view.result.current).toBeTruthy();
  });

  it('keeps escalating on continued silence — a failed recovery emits again', () => {
    const { beat, kinds, view } = setup();
    act(() => view.result.current.sendCueNow('[DI_ITEM] opener'));
    beat(DEAD_WINDOW);
    beat(DEAD_WINDOW);
    expect(kinds()).toEqual(['session-dead']);
    // Nothing recovers; the watch keeps running on the same silence.
    beat(DEAD_WINDOW);
    beat(DEAD_WINDOW);
    expect(kinds()).toEqual(['session-dead', 'session-dead']);
  });

  it('tutor AUDIO rise clears the watch — think-time never trips it', () => {
    // The false-trigger the doctrine forbids: the tutor spoke its lead-in,
    // then the child thought for 35+ seconds. cue→verdict silence is benign;
    // only cue→tutor-silence is death.
    const { view, beat, kinds, deadCues } = setup();
    act(() => view.result.current.queueCue('[DI_ITEM] three plus one'));
    beat(); // sent
    act(() => {
      ctxState.isAudioPlaying = true; // the lead-in starts
      view.rerender({ enabled: true });
    });
    act(() => {
      ctxState.isAudioPlaying = false; // …and ends
      view.rerender({ enabled: true });
    });
    beat(40_000); // unbounded child think-time
    expect(deadCues()).toHaveLength(0);
    expect(kinds()).toEqual([]);
  });

  it('tutor output TEXT clears the watch too (audio path muted, text alive)', () => {
    const { view, beat, kinds, deadCues } = setup();
    act(() => view.result.current.queueCue('[DI_ITEM] four plus one'));
    beat(); // sent
    act(() => {
      ctxState.conversation = [{ role: 'assistant', content: 'Listen: four plus one is five.', timestamp: 1 }];
      view.rerender({ enabled: true });
    });
    beat(40_000);
    expect(deadCues()).toHaveLength(0);
    expect(kinds()).toEqual([]);
  });

  it('a resume clears the pending watch — the re-cue re-arms it fresh', () => {
    const { view, beat, kinds } = setup();
    act(() => view.result.current.queueCue('[DI_ITEM] five plus zero'));
    beat(); // sent, watch armed
    act(() => {
      ctxState.sessionResumeCount = 1;
      view.rerender({ enabled: true });
    });
    expect(kinds()).toEqual(['session-resumed']);
    // The old cue's clock must not keep ticking against the NEW session.
    beat(DEAD_WINDOW);
    beat(DEAD_WINDOW);
    expect(kinds()).toEqual(['session-resumed']);
  });

  it('disabling stops the watch — a finished run cannot go session-dead', () => {
    const { view, beat, kinds, deadCues } = setup();
    act(() => view.result.current.queueCue('[DI_ITEM] one plus one'));
    beat(); // sent
    act(() => view.rerender({ enabled: false }));
    beat(60_000);
    expect(deadCues()).toHaveLength(0);
    expect(kinds()).toEqual([]);
  });

  it('the RUN OPENER arms the watch even though enabled has not committed yet', () => {
    // startRun's exact ordering: setRunning(true) and sendCueNow(opener) run in
    // the same synchronous frame, so at arm time the last committed render
    // still says enabled=false. A from-birth-dead session sends exactly ONE
    // cue — the opener — and the 2026-07-31 fault drive proved that gating the
    // arm on stale `enabled` put the whole ladder to sleep for the canonical
    // stall shape (child waits silently, no attempt ever opens). The arm must
    // be unconditional; the deadline callback checks enabled at FIRE time.
    const { view, beat, kinds, deadCues } = setup({ enabled: false });
    act(() => {
      view.result.current.sendCueNow('[DI_ITEM] opener into a dead session');
      // The setRunning(true) render commits right after the same frame.
      view.rerender({ enabled: true });
    });
    beat(DEAD_WINDOW);
    beat(DEAD_WINDOW);
    expect(deadCues()).toHaveLength(2);
    expect(kinds()).toEqual(['session-dead']);
  });

  it('a closing cue after disable still never counts dead (fire-time gate)', () => {
    // The inverse ordering: finishAndSubmit disables the loop, THEN the queued
    // closing cue goes out. The unconditional arm must not let a finished run
    // go session-dead — the deadline callback sees enabled=false and stands down.
    const { view, beat, kinds, deadCues } = setup();
    act(() => view.rerender({ enabled: false }));
    act(() => view.result.current.sendCueNow('[DI_COMPLETE] run recap'));
    beat(60_000);
    expect(deadCues()).toHaveLength(0);
    expect(kinds()).toEqual([]);
  });

  it('dead cues report through the cue channel without touching its ledger', () => {
    // `dead` is diagnostics beside the queued/sent/dropped arithmetic, not a
    // consumer of it — the stall counters must stay independently readable.
    const { view, beat, cues } = setup();
    act(() => view.result.current.queueCue('[DI_ITEM] two plus two'));
    beat();
    beat(DEAD_WINDOW);
    const count = (phase: CueLogEvent['phase']) => cues.filter((c) => c.phase === phase).length;
    expect(count('queued') - count('sent') - count('dropped')).toBe(0);
    expect(count('dead')).toBe(1);
    expect(cues.find((c) => c.phase === 'dead')?.text).toBe('[DI_ITEM] two plus two');
  });
});
