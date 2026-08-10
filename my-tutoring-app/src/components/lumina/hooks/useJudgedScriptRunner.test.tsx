// @vitest-environment jsdom
/**
 * useJudgedScriptRunner — the extracted progression policy, driven through
 * emissions exactly as the engine would emit them.
 *
 * What this locks in (each rule names the port that proved it):
 *  1. start() sends ONE opening cue then arms (SWAP-1 / DI-GREET-1 order).
 *  2. Affirm queues the NEXT item's cue BEFORE re-pointing the screen; the
 *     last affirm queues the complete cue and finishes with a summary.
 *  3. Corrections cap (2) then moveOnCue — never drill in place.
 *  4. Gesture rules (cvc-speller): no-verdict and resync are ignored on a
 *     build item; unanchored-verdict is applied only while a build awaits
 *     judgment; a second commit is refused while one is pending.
 *  5. Tier-A diagnosis: observations collect at corrections and the judge's
 *     finished line attaches as judgeFeedback; a failed run assembles
 *     DiagnosisEvidence preferring the judge-backed observation.
 *  6. loop-deaf re-arms (DiMathFacts recovery pilot).
 *
 * The live loop itself is NOT driven here — it cannot be done honestly in
 * jsdom (see SoundSwap.di.test.tsx's header). The engine below the seam has
 * its own suite (judgedLoopModel.test.ts); this file tests OUR policy above
 * that seam, through the same emission types the engine emits.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import type { LoopEmission, LoopAttempt } from './judgedLoopModel';

const sendText = vi.hoisted(() => vi.fn());
const ctxState = vi.hoisted(() => ({
  isConnected: true,
  isListening: true,
  isAudioPlaying: false,
  micLevel: 0,
  sessionMode: 'idle' as 'idle' | 'lesson',
  sessionResumeCount: 0,
  conversation: [] as Array<{ role: string; content: string }>,
}));
vi.mock('@/contexts/LuminaAIContext', () => ({
  useLuminaAIContext: () => ({
    ...ctxState,
    sendText,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    startListening: vi.fn(() => { ctxState.isListening = true; }),
    stopListening: vi.fn(),
    updateContext: vi.fn(),
  }),
}));

/** The engine is mocked at the seam: we capture onEmission and hand back a
 *  recording stub, then drive emissions as the reducer would emit them. */
const loopStub = vi.hoisted(() => {
  const stub = {
    onEmission: null as ((emission: LoopEmission) => void) | null,
    enabled: false,
    queueCue: vi.fn(),
    sendCueNow: vi.fn(),
    submitGestureAttempt: vi.fn(),
    clearQueuedCue: vi.fn(),
    arm: vi.fn(),
    disarm: vi.fn(),
    reset: vi.fn(),
    isAwaitingJudgment: () => false,
    voiceTurns: {},
    config: {},
  };
  return stub;
});
vi.mock('./useJudgedSpeechLoop', () => ({
  useJudgedSpeechLoop: (options: { enabled: boolean; onEmission?: (e: LoopEmission) => void }) => {
    loopStub.onEmission = options.onEmission ?? null;
    loopStub.enabled = options.enabled;
    return loopStub;
  },
}));

vi.mock('../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
  type JudgedScriptRun,
  type JudgedScriptRunnerOptions,
} from './useJudgedScriptRunner';
import type { JudgedScriptItem, JudgedScriptPack } from './judgedScriptContract';

interface TestItem extends JudgedScriptItem {
  word: string;
}

const voiceItem = (id: string, word: string): TestItem => ({
  id, word, answerKind: 'voice', responseClass: 'short_spoken_word', action: 'say',
});
const gestureItem = (id: string, word: string): TestItem => ({
  id, word, answerKind: 'gesture', responseClass: 'manipulation', action: 'build',
});

const makePack = (
  items: TestItem[],
  overrides: Partial<JudgedScriptPack<TestItem>> = {},
): JudgedScriptPack<TestItem> => ({
  primitiveType: 'test-pack',
  activityLine: 'test activity',
  items,
  itemCue: (item, opts) => `[ITEM]${opts.opening ? '(opening)' : ''}${opts.howToPlay ? '(how)' : ''} ${item.word}`,
  moveOnCue: (item, next) => `[MOVE] ${item.word} -> ${next?.word ?? 'end'}`,
  completeCue: () => '[COMPLETE]',
  pronounceCue: (item) => `[PRONOUNCE] ${item.word}`,
  contextFor: (item) => ({ word: item.word }),
  ...overrides,
});

const voiceAttempt: LoopAttempt = {
  source: 'voice',
  turn: { openedAt: 0, closedAt: 500, durationMs: 500, peak: 0.2, duringTutorAudio: false },
  transcript: null,
  transcriptAt: null,
};

let run: JudgedScriptRun<TestItem>;
const Probe: React.FC<{ options: JudgedScriptRunnerOptions<TestItem> }> = ({ options }) => {
  run = useJudgedScriptRunner(options);
  return null;
};

const emit = (emission: LoopEmission) => act(() => { loopStub.onEmission?.(emission); });
const verdict = (judgment: 'affirmed' | 'corrected' | 'off-script' | 'no-verdict') =>
  emit({ kind: 'verdict', judgment, attempt: voiceAttempt, misses: 0 });

const mount = (
  items: TestItem[],
  packOverrides: Partial<JudgedScriptPack<TestItem>> = {},
  optionOverrides: Partial<JudgedScriptRunnerOptions<TestItem>> = {},
) => {
  const onFinished = vi.fn<(summary: JudgedRunSummary) => void>();
  const options: JudgedScriptRunnerOptions<TestItem> = {
    pack: makePack(items, packOverrides),
    instanceId: 'test-1',
    gradeLevel: 'K',
    onFinished,
    ...optionOverrides,
  };
  render(<Probe options={options} />);
  return { onFinished };
};

const startRun = async () => act(async () => { await run.start(); });

beforeEach(() => {
  vi.clearAllMocks();
  ctxState.isConnected = true;
  ctxState.isListening = true;
  ctxState.sessionMode = 'idle';
});
afterEach(cleanup);

describe('start', () => {
  it('sends the opening cue with one job, then arms — in that order', async () => {
    mount([voiceItem('i1', 'cat'), voiceItem('i2', 'dog')]);
    await startRun();
    expect(run.running).toBe(true);
    expect(run.stage).toBe('asking');
    expect(loopStub.sendCueNow).toHaveBeenCalledTimes(1);
    expect(loopStub.sendCueNow.mock.calls[0][0]).toBe('[ITEM](opening)(how) cat');
    expect(loopStub.arm).toHaveBeenCalledTimes(1);
    expect(loopStub.reset.mock.invocationCallOrder[0])
      .toBeLessThan(loopStub.sendCueNow.mock.invocationCallOrder[0]);
    expect(loopStub.sendCueNow.mock.invocationCallOrder[0])
      .toBeLessThan(loopStub.arm.mock.invocationCallOrder[0]);
  });

  it('opens the first item through onItemOpened', async () => {
    const onItemOpened = vi.fn();
    mount([voiceItem('i1', 'cat')], {}, { onItemOpened });
    await startRun();
    expect(onItemOpened).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }), 0);
  });
});

describe('progression', () => {
  it('affirm queues the next cue and advances; last affirm completes and finishes', async () => {
    const { onFinished } = mount([voiceItem('i1', 'cat'), voiceItem('i2', 'dog')]);
    await startRun();

    verdict('affirmed');
    expect(loopStub.queueCue).toHaveBeenCalledWith('[ITEM] dog');
    expect(run.currentIndex).toBe(1);
    expect(run.solvedIds.has('i1')).toBe(true);
    expect(onFinished).not.toHaveBeenCalled();

    verdict('affirmed');
    expect(loopStub.queueCue).toHaveBeenCalledWith('[COMPLETE]');
    expect(run.running).toBe(false);
    expect(run.stage).toBe('done');
    expect(onFinished).toHaveBeenCalledTimes(1);
    const summary = onFinished.mock.calls[0][0];
    expect(summary.solvedCount).toBe(2);
    expect(summary.accuracy).toBe(100);
    expect(summary.passed).toBe(true);
    expect(run.summary).toEqual(summary);
  });

  it('re-speaks the how-to-play when the ACTION changes between items', async () => {
    mount([voiceItem('i1', 'cat'), gestureItem('i2', 'dog')]);
    await startRun();
    verdict('affirmed');
    expect(loopStub.queueCue).toHaveBeenCalledWith('[ITEM](how) dog');
  });

  it('corrections under the cap retry in place; the cap moves on', async () => {
    const onCorrectionRetry = vi.fn();
    const { onFinished } = mount(
      [voiceItem('i1', 'cat'), voiceItem('i2', 'dog')],
      {},
      { onCorrectionRetry },
    );
    await startRun();

    verdict('corrected');
    expect(onCorrectionRetry).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }), 1);
    expect(run.currentIndex).toBe(0);
    expect(loopStub.queueCue).not.toHaveBeenCalled();

    verdict('corrected');
    expect(run.currentIndex).toBe(0);

    verdict('corrected'); // third strike: capped
    expect(loopStub.queueCue).toHaveBeenCalledWith('[MOVE] cat -> dog');
    expect(run.currentIndex).toBe(1);
    expect(run.solvedIds.has('i1')).toBe(false);

    verdict('affirmed');
    const summary = onFinished.mock.calls[0][0];
    expect(summary.solvedCount).toBe(1);
    expect(summary.outcomes[0]).toMatchObject({ id: 'i1', solved: false, corrections: 3 });
    expect(summary.accuracy).toBe(50); // (0 + 100) / 2
  });

  it('off-script verdicts change nothing', async () => {
    mount([voiceItem('i1', 'cat')]);
    await startRun();
    verdict('off-script');
    expect(run.currentIndex).toBe(0);
    expect(loopStub.queueCue).not.toHaveBeenCalled();
  });
});

describe('resync and recovery', () => {
  it('re-cues the current item on resync (voice item)', async () => {
    mount([voiceItem('i1', 'cat')]);
    await startRun();
    loopStub.queueCue.mockClear();
    emit({ kind: 'resync', misses: 2 });
    expect(loopStub.queueCue).toHaveBeenCalledWith('[ITEM](how) cat');
  });

  it('ignores resync mid-build but re-cues on session-resumed (cvc rules)', async () => {
    mount([gestureItem('g1', 'cat')]);
    await startRun();
    loopStub.queueCue.mockClear();
    emit({ kind: 'resync', misses: 2 });
    expect(loopStub.queueCue).not.toHaveBeenCalled();
    emit({ kind: 'session-resumed' });
    expect(loopStub.queueCue).toHaveBeenCalledWith('[ITEM](how) cat');
  });

  it('re-arms on loop-deaf', async () => {
    mount([voiceItem('i1', 'cat')]);
    await startRun();
    loopStub.arm.mockClear();
    emit({ kind: 'loop-deaf', turn: voiceAttempt.turn });
    expect(loopStub.arm).toHaveBeenCalledTimes(1);
  });
});

describe('gesture rules (cvc-speller, the anchor’s first caller)', () => {
  it('submitGestureAttempt locks until the verdict lands', async () => {
    mount([gestureItem('g1', 'cat'), gestureItem('g2', 'dog')]);
    await startRun();

    act(() => run.submitGestureAttempt('[VERDICT] built c-a-t'));
    expect(loopStub.submitGestureAttempt).toHaveBeenCalledTimes(1);
    expect(run.stage).toBe('judging');
    expect(run.isAwaitingGesture()).toBe(true);

    act(() => run.submitGestureAttempt('[VERDICT] again'));
    expect(loopStub.submitGestureAttempt).toHaveBeenCalledTimes(1); // refused

    verdict('affirmed');
    expect(run.isAwaitingGesture()).toBe(false);
    expect(run.currentIndex).toBe(1);
  });

  it('ignores no-verdict on a build item (child talking while working)', async () => {
    mount([gestureItem('g1', 'cat')]);
    await startRun();
    const before = run.statusLine;
    verdict('no-verdict');
    expect(run.statusLine).toBe(before);
    expect(run.currentIndex).toBe(0);
  });

  it('applies unanchored-verdict only while a build awaits judgment', async () => {
    mount([gestureItem('g1', 'cat'), gestureItem('g2', 'dog')]);
    await startRun();

    emit({ kind: 'unanchored-verdict', judgment: 'affirmed' });
    expect(run.currentIndex).toBe(0); // nothing pending: dropped

    act(() => run.submitGestureAttempt('[VERDICT] built c-a-t'));
    emit({ kind: 'unanchored-verdict', judgment: 'affirmed' });
    expect(run.currentIndex).toBe(1); // pending build: adopted
    expect(run.solvedIds.has('g1')).toBe(true);
  });
});

describe('diagnosis (Tier-A evidence)', () => {
  it('collects observations at corrections, attaches the judge’s finished line, and assembles evidence on a failed run', async () => {
    const { onFinished } = mount([voiceItem('i1', 'cat')], {
      diagnosisObservation: (item, { lastHeard }) => ({
        challenge: `Say ${item.word}.`,
        expected: item.word,
        observed: lastHeard ? `Heard "${lastHeard}".` : 'Judged wrong from audio.',
      }),
    });
    await startRun();

    emit({ kind: 'attempt-open', attempt: voiceAttempt });
    emit({
      kind: 'attempt-transcript', attempt: voiceAttempt, text: 'cap', responseMs: 900, commitLagMs: 400,
    });
    verdict('corrected');
    emit({ kind: 'verdict-text', judgment: 'corrected', text: 'My turn: not cap — cat.' });
    verdict('corrected');
    verdict('corrected'); // capped → run ends unsolved

    const summary = onFinished.mock.calls[0][0];
    expect(summary.passed).toBe(false);
    expect(summary.observations[0]).toMatchObject({
      observed: 'Heard "cap".',
      judgeFeedback: 'My turn: not cap — cat.',
    });
    expect(summary.diagnosisEvidence).toMatchObject({
      challengeSummary: 'Say cat.',
      judgeFeedback: 'My turn: not cap — cat.',
    });
  });
});

describe('tap-to-hear', () => {
  it('speaks the stimulus silently and never advances anything', async () => {
    mount([voiceItem('i1', 'cat')]);
    await startRun();
    act(() => run.hearStimulus());
    expect(sendText).toHaveBeenCalledWith('[PRONOUNCE] cat', { silent: true });
    expect(run.stimulusTapped).toBe(true);
    expect(run.currentIndex).toBe(0);
  });
});
