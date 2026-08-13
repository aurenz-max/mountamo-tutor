// @vitest-environment jsdom
/**
 * The engine's two DIAGNOSTIC channels — `onVoiceTurnClose` and `onCue`.
 *
 * WHY THEY ARE PINNED BY TESTS (2026-07-26). The sustained-miss sitting ended in
 * a hard stall: the tutor affirmed an item, the pack never advanced, and the
 * model then authored the application's own next message. Two candidate causes
 * were indistinguishable from any record that existed at the time —
 *
 *   (a) the verdict never reached the pack (an attempt was missing, so the judge
 *       ruled `unanchored-verdict`), or
 *   (b) the verdict landed, a cue was composed, and the verify beat never
 *       released it.
 *
 * Both look identical from outside: tutor quiet, surface frozen. These channels
 * are what tells them apart, so their contracts are behaviour, not decoration:
 *
 * - EVERY voice close is reported, `belowMinVoice` blips included. Those blips
 *   have already had `activityEnd` sent for them by `useLiveVoiceTurns` (the
 *   bracket must go out immediately to interrupt), so Gemini hears and may judge
 *   a turn this hook deliberately refuses to anchor. That is desync channel (a)
 *   originating on OUR side, and filtering the blip out of the callback — which
 *   this hook did until now — was what made it the one channel with no trace.
 * - Cues report as a LEDGER: every `sent`/`dropped` consumes one `queued`, so
 *   `queued − sent − dropped > 0` is a clean read of channel (b).
 *
 * Neither channel may influence progression; the emission assertions here exist
 * partly to hold that line.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LoopEmission } from './judgedLoopModel';
import type { CueLogEvent } from './useJudgedSpeechLoop';

interface Msg { role: 'user' | 'assistant'; content: string; timestamp: number }

const ctxState: { conversation: Msg[]; isAudioPlaying: boolean } = {
  conversation: [],
  isAudioPlaying: false,
};
const sentTexts: string[] = [];
const sentOptions: Array<Record<string, unknown> | undefined> = [];
vi.mock('@/contexts/LuminaAIContext', () => ({
  useLuminaAIContext: () => ({
    conversation: ctxState.conversation,
    isAudioPlaying: ctxState.isAudioPlaying,
    sendText: (text: string, options?: Record<string, unknown>) => {
      sentTexts.push(text);
      sentOptions.push(options);
    },
  }),
}));

let closeVoiceTurn: (event: Record<string, unknown>) => void = () => {};
const voiceState = { active: false };
vi.mock('./useLiveVoiceTurns', () => ({
  useLiveVoiceTurns: (options: { onTurnClose: (e: Record<string, unknown>) => void }) => {
    closeVoiceTurn = options.onTurnClose;
    return { isVoiceActive: () => voiceState.active, reset: vi.fn() };
  },
}));

import { useJudgedSpeechLoop } from './useJudgedSpeechLoop';

/** Long enough to clear VERIFY_BEAT_MS (400ms) without reaching the 8s
 *  verdict timeout, which would inject a `no-verdict` into the emissions. */
const BEAT = 500;

const closeEvent = (over: Record<string, unknown> = {}) => ({
  belowMinVoice: false, startedAt: 1000, durationMs: 600, peak: 0.2, duringTutorAudio: false, ...over,
});

const setup = () => {
  const emissions: LoopEmission[] = [];
  const cues: CueLogEvent[] = [];
  const closes: Array<Record<string, unknown>> = [];
  const view = renderHook(() => useJudgedSpeechLoop({
    enabled: true,
    onEmission: (e) => emissions.push(e),
    onCue: (e) => cues.push(e),
    onVoiceTurnClose: (e) => closes.push(e),
  }));

  const learnerTurnCloses = (over: Record<string, unknown> = {}) => act(() => {
    closeVoiceTurn(closeEvent(over));
  });
  const beat = (ms = BEAT) => act(() => { vi.advanceTimersByTime(ms); });

  return { emissions, cues, closes, view, learnerTurnCloses, beat };
};

const phases = (cues: CueLogEvent[]) => cues.map((c) => c.phase);
const ledger = (cues: CueLogEvent[]) => {
  const count = (phase: CueLogEvent['phase']) => cues.filter((c) => c.phase === phase).length;
  return count('queued') - count('sent') - count('dropped');
};

describe('useJudgedSpeechLoop — voice-close reporting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ctxState.conversation = [];
    ctxState.isAudioPlaying = false;
    voiceState.active = false;
    sentTexts.length = 0;
  });
  afterEach(() => vi.useRealTimers());

  it('reports a belowMinVoice blip but opens NO attempt for it', () => {
    // The blip's activityEnd already reached Gemini, so it can be judged. If the
    // callback stayed behind the min-voice gate the run log would show a verdict
    // arriving out of nowhere with nothing before it.
    const { emissions, closes, view, learnerTurnCloses } = setup();
    act(() => view.result.current.arm());
    learnerTurnCloses({ belowMinVoice: true, durationMs: 90 });

    expect(closes).toHaveLength(1);
    expect(closes[0]).toMatchObject({ belowMinVoice: true, durationMs: 90 });
    expect(emissions.map((e) => e.kind)).toEqual([]);
  });

  it('a verdict after a blip-only turn is RETRO-ANCHORED, not discarded', () => {
    // The exact shape of the 2026-07-26 stall: Gemini judged a turn the client
    // declined to own. Discarding the verdict lost a correct answer the tutor
    // had already affirmed and froze the run. It is now rebuilt from the blip
    // and flagged, so progression continues and the log still says the turn
    // detector is marginal.
    const { emissions, closes, view, learnerTurnCloses } = setup();
    act(() => view.result.current.arm());
    learnerTurnCloses({ belowMinVoice: true, durationMs: 90 });
    act(() => {
      ctxState.isAudioPlaying = true;
      ctxState.conversation = [{ role: 'assistant', content: 'Yes, two plus one is three.', timestamp: 1 }];
      view.rerender();
    });

    expect(closes).toHaveLength(1);
    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toMatchObject({
      kind: 'verdict',
      judgment: 'affirmed',
      retroAnchored: true,
      misses: 0,
    });
  });

  it('a sentinel with no learner trace at all is still unanchored', () => {
    // The retro-anchor must not launder spontaneous tutor speech into a
    // judgment — that is what `unanchored-verdict` is still for.
    const { emissions, view } = setup();
    act(() => view.result.current.arm());
    act(() => {
      ctxState.isAudioPlaying = true;
      ctxState.conversation = [{ role: 'assistant', content: 'Yes, that is right.', timestamp: 1 }];
      view.rerender();
    });
    expect(emissions).toEqual([{ kind: 'unanchored-verdict', judgment: 'affirmed' }]);
  });

  it('carries the learner’s words when a phantom transcript is the only trace', () => {
    // Gemini transcribed the answer even though no turn was anchored; that text
    // is the strongest retro-anchor there is, and evidence consumers need it.
    const { emissions, view } = setup();
    act(() => view.result.current.arm());
    act(() => {
      ctxState.conversation = [{ role: 'user', content: 'four', timestamp: 1 }];
      view.rerender();
    });
    act(() => {
      ctxState.isAudioPlaying = true;
      ctxState.conversation = [
        ...ctxState.conversation,
        { role: 'assistant', content: 'Yes, two plus two is four.', timestamp: 2 },
      ];
      view.rerender();
    });

    expect(emissions.map((e) => e.kind)).toEqual(['phantom-transcript', 'verdict']);
    expect(emissions[1]).toMatchObject({
      kind: 'verdict',
      judgment: 'affirmed',
      retroAnchored: true,
      attempt: { transcript: 'four' },
    });
  });

  it('still anchors an attempt for a turn above the bar', () => {
    const { emissions, closes, view, learnerTurnCloses } = setup();
    act(() => view.result.current.arm());
    learnerTurnCloses();
    expect(closes).toHaveLength(1);
    expect(emissions.map((e) => e.kind)).toEqual(['attempt-open']);
  });
});

describe('useJudgedSpeechLoop — the cue ledger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ctxState.conversation = [];
    ctxState.isAudioPlaying = false;
    voiceState.active = false;
    sentTexts.length = 0;
  });
  afterEach(() => vi.useRealTimers());

  it('balances queued → sent for a cue that goes out', () => {
    const { cues, view, beat } = setup();
    act(() => view.result.current.arm());
    act(() => view.result.current.queueCue('[DI_ITEM] two plus one'));
    expect(phases(cues)).toEqual(['queued']);

    beat();
    expect(phases(cues)).toEqual(['queued', 'sent']);
    expect(sentTexts).toEqual(['[DI_ITEM] two plus one']);
    expect(ledger(cues)).toBe(0);
  });

  it('sendCueNow balances too, so the ledger reads the same for openers', () => {
    const { cues, view } = setup();
    act(() => view.result.current.sendCueNow('[DI_ITEM] opener'));
    expect(phases(cues)).toEqual(['queued', 'sent']);
    expect(ledger(cues)).toBe(0);
  });

  it('reports a block WITHOUT consuming the queue, then sends on the release edge', () => {
    // `blocked` on its own is normal — the cue waits. What the ledger must not
    // do is call a held cue spoken.
    const { cues, view, learnerTurnCloses, beat } = setup();
    act(() => view.result.current.arm());
    learnerTurnCloses();                       // an attempt is now pending
    act(() => view.result.current.queueCue('[DI_ITEM] next fact'));
    beat();
    expect(phases(cues)).toEqual(['queued', 'blocked']);
    expect(cues[1].reason).toBe('attempt');
    expect(ledger(cues)).toBe(1);              // composed, not yet spoken
    expect(sentTexts).toEqual([]);

    // The tutor judges the attempt: the verdict clears it and releases the cue.
    act(() => {
      ctxState.isAudioPlaying = false;
      ctxState.conversation = [{ role: 'assistant', content: 'Yes, three.', timestamp: 1 }];
      view.rerender();
    });
    beat();
    expect(phases(cues)).toEqual(['queued', 'blocked', 'sent']);
    expect(ledger(cues)).toBe(0);
  });

  it('a stalled cue leaves the ledger non-zero — the stall signature', () => {
    // Voice never settles, so the beat keeps finding the gate shut. Nothing is
    // sent and nothing is dropped: exactly the state the sitting ended in.
    const { cues, view, beat } = setup();
    act(() => view.result.current.arm());
    voiceState.active = true;
    act(() => view.result.current.queueCue('[DI_ITEM] four plus one'));
    beat();
    expect(sentTexts).toEqual([]);
    expect(ledger(cues)).toBe(1);
  });

  it('an overwritten cue is reported dropped, never silently replaced', () => {
    // The sitting's item-1 shape: the correction cap queued a [DI_MOVE_ON] that
    // an affirmation then replaced with the next [DI_ITEM]. The move-on was
    // never spoken, and nothing said so.
    const { cues, view, beat } = setup();
    act(() => view.result.current.arm());
    voiceState.active = true;
    act(() => view.result.current.queueCue('[DI_MOVE_ON] stop correcting'));
    act(() => view.result.current.queueCue('[DI_ITEM] five plus zero'));
    voiceState.active = false;
    beat();

    expect(phases(cues)).toEqual(['queued', 'dropped', 'queued', 'sent']);
    expect(cues[1].text).toBe('[DI_MOVE_ON] stop correcting');
    expect(sentTexts).toEqual(['[DI_ITEM] five plus zero']);
    expect(ledger(cues)).toBe(0);
  });
});

describe('useJudgedSpeechLoop — off-script cut-in (run f634f61b2b42)', () => {
  // After a verdict the model has nothing scripted left to say — the next
  // thing the child must hear is the queued cue. The live run: a stray noise
  // after "Yes, six." drew an IMPROVISED turn (an invented item, recited in
  // cue format), and the audio block held the real cue behind it for 40
  // seconds. A tutor turn that begins after the queue-time line has finished
  // is off-script by definition, and the script cuts it.
  beforeEach(() => {
    vi.useFakeTimers();
    ctxState.conversation = [];
    ctxState.isAudioPlaying = false;
    voiceState.active = false;
    sentTexts.length = 0;
    sentOptions.length = 0;
  });
  afterEach(() => vi.useRealTimers());

  it('cuts an improvised turn instead of waiting behind it', () => {
    const { cues, view, beat } = setup();
    act(() => view.result.current.arm());
    // The verdict line is playing when the runner queues the next item's cue.
    act(() => { ctxState.isAudioPlaying = true; view.rerender(); });
    act(() => view.result.current.queueCue('[SAY_ITEM] four times two'));
    beat();
    expect(sentTexts).toEqual([]); // the scripted line is never cut
    // The verdict line ends…
    act(() => { ctxState.isAudioPlaying = false; view.rerender(); });
    // …and before the beat releases the cue, the tutor starts a turn nobody
    // cued. The cue ships THROUGH it, with interrupt.
    act(() => { ctxState.isAudioPlaying = true; view.rerender(); });
    beat();

    expect(sentTexts).toEqual(['[SAY_ITEM] four times two']);
    expect(sentOptions[0]).toMatchObject({ interrupt: true });
    expect(cues.find((c) => c.phase === 'sent')?.cutIn).toBe(true);
    expect(ledger(cues)).toBe(0);
  });

  it('never cuts a verdict line whose audio lags its transcript', () => {
    // The race the stamp guards: the affirm-path queue runs off the verdict
    // TRANSCRIPT, which can arrive before the verdict AUDIO starts. That
    // audio is a scripted line — it blocks the cue and is never interrupted.
    const { cues, view, learnerTurnCloses, beat } = setup();
    act(() => view.result.current.arm());
    learnerTurnCloses(); // an attempt is open, so the verdict anchors
    act(() => {
      ctxState.conversation = [{ role: 'assistant', content: 'Yes, six.', timestamp: 1 }];
      view.rerender();
    });
    act(() => view.result.current.queueCue('[SAY_ITEM] four times two'));
    // Only now does the verdict line's audio start.
    act(() => { ctxState.isAudioPlaying = true; view.rerender(); });
    beat();
    expect(sentTexts).toEqual([]);
    expect(cues.some((c) => c.phase === 'blocked' && c.reason === 'audio')).toBe(true);

    // The line finishes; the cue ships plainly on the release edge.
    act(() => { ctxState.isAudioPlaying = false; view.rerender(); });
    beat();
    expect(sentTexts).toEqual(['[SAY_ITEM] four times two']);
    expect(sentOptions[0]).toMatchObject({ interrupt: false });
    expect(cues.find((c) => c.phase === 'sent')?.cutIn).toBeUndefined();
  });
});
