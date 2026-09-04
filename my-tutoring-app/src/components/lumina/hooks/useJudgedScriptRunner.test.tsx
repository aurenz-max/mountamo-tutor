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
  sessionMode: 'idle' as 'idle' | 'lesson',
  /** The block the lesson is pointed at (viewport-driven in production). */
  activePrimitiveId: null as string | null,
  sessionResumeCount: 0,
  conversation: [] as Array<{ role: string; content: string }>,
}));
vi.mock('@/contexts/LuminaAIContext', () => ({
  // 19b: the mic level is a SUBSCRIPTION now, not a context field. Stubbed
  // flat because nothing here asserts on the orb's spike ring.
  useMicLevel: () => 0,
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
    onCue: null as ((event: { phase: string; text: string }) => void) | null,
    enabled: false,
    active: true as boolean | undefined,
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
  // The engine reports 'queued' when a cue joins the queue and 'sent' only when
  // it reaches the floor, and the GAP between the two is what every stimulus
  // test below is about. `sendCueNow` reaches the floor immediately; a queued
  // cue's 'sent' is fired by hand, because in production it lands whenever the
  // tutor stops talking.
  stub.sendCueNow.mockImplementation((text: string) => {
    stub.onCue?.({ phase: 'sent', text });
  });
  stub.queueCue.mockImplementation((text: string) => {
    stub.onCue?.({ phase: 'queued', text });
  });
  return stub;
});
vi.mock('./useJudgedSpeechLoop', () => ({
  useJudgedSpeechLoop: (options: {
    enabled: boolean;
    active?: boolean;
    onEmission?: (e: LoopEmission) => void;
    onCue?: (e: { phase: string; text: string }) => void;
  }) => {
    loopStub.onEmission = options.onEmission ?? null;
    loopStub.onCue = options.onCue ?? null;
    loopStub.enabled = options.enabled;
    loopStub.active = options.active;
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
const Probe: React.FC<{ options: JudgedScriptRunnerOptions<TestItem>; nonce?: number }> = ({ options }) => {
  run = useJudgedScriptRunner(options);
  return null;
};

const emit = (emission: LoopEmission) => act(() => { loopStub.onEmission?.(emission); });
const verdict = (judgment: 'affirmed' | 'corrected' | 'off-script' | 'no-verdict') =>
  emit({ kind: 'verdict', judgment, attempt: voiceAttempt, misses: 0 });

/** A queued cue reaches the floor. */
const cueSent = (text = '[cue]') => act(() => { loopStub.onCue?.({ phase: 'sent', text }); });

/** The provider does not re-render on an audio flip by itself (19b took the
 *  per-frame value out of the context), so the harness re-renders explicitly. */
let refresh: () => void = () => {};
const setTutorSpeaking = (playing: boolean) => {
  ctxState.isAudioPlaying = playing;
  refresh();
};
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

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
  const view = render(<Probe options={options} nonce={0} />);
  let nonce = 0;
  refresh = () => { act(() => { view.rerender(<Probe options={options} nonce={++nonce} />); }); };
  return { onFinished };
};

const startRun = async () => act(async () => { await run.start(); });

beforeEach(() => {
  vi.clearAllMocks();
  ctxState.isConnected = true;
  ctxState.isListening = true;
  ctxState.isAudioPlaying = false;
  ctxState.sessionMode = 'idle';
  ctxState.activePrimitiveId = null;
  refresh = () => {};
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

  /**
   * REGRESSION — every judged port was UNSTARTABLE IN A LESSON (found live
   * 2026-08-14, user, on the 19b mic drive: `ten-frame` then `counting-board`).
   *
   * A lesson opens ONE shared microphone at connect, so `ctx.isListening` is
   * true before the child has done anything. `micState` read that alone, so the
   * orb painted 'armed' — and `armed` is exactly the state in which
   * `LuminaMicListener` renders the live surface INSTEAD of the tap-to-start
   * button. So there was no start affordance to press: `start()` was
   * unreachable, `running` stayed false, and `canAttempt` held every tap on the
   * board dead — beneath an orb captioned *"I'm listening"* and a status line
   * reading *"Tap the microphone to start."* Meanwhile the shared lesson tutor
   * improvised over `primitive_data` and asked for counters the board would not
   * accept.
   *
   * `isListening` answers "is the mic hardware open"; the orb asks "is this RUN
   * listening for an answer". Only `running` answers that.
   */
  it('offers the start gesture in a LESSON, where the mic is already open', async () => {
    ctxState.sessionMode = 'lesson';
    ctxState.isListening = true;   // the provider opened it at connect
    mount([voiceItem('i1', 'cat')]);

    // Pre-start: 'idle' is what makes LuminaMicListener render the button.
    expect(run.micState).toBe('idle');
    expect(run.canAttempt).toBe(false);

    await startRun();

    expect(run.running).toBe(true);
    expect(run.micState).toBe('armed');
    expect(run.canAttempt).toBe(true);
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

/**
 * THE STIMULUS CLOCK (19c) — absorbed from ten-frame, where it was ~40 hand-
 * written lines and two documented footguns, and where `counting-board` had
 * never picked up the fix at all.
 *
 * Every case here was a drive, not a design review: the tutor talking over her
 * own flash (drive 3), the flash firing on the tail of the PREVIOUS item's
 * affirmation (drive 5, user: *"the very next one flashes way too fast"*), and
 * the silent-session case where a child would otherwise be asked about a frame
 * that never flashed.
 */
describe('the stimulus clock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const stimulusMount = (
    items: TestItem[],
    overrides: Partial<JudgedScriptRunnerOptions<TestItem>> = {},
  ) => {
    const onPresentStimulus = vi.fn();
    mount(items, {}, { onPresentStimulus, ...overrides });
    return { onPresentStimulus };
  };

  it('waits for her to have spoken for THIS item and stopped, then a breath', async () => {
    const { onPresentStimulus } = stimulusMount([voiceItem('i1', 'cat')]);
    await startRun();

    // Her line has been sent but she has not started speaking: silence here is
    // "not yet", not "finished". A level-triggered gate fires on this state.
    expect(onPresentStimulus).not.toHaveBeenCalled();
    advance(5000);
    expect(onPresentStimulus).not.toHaveBeenCalled();

    setTutorSpeaking(true);
    advance(5000);
    expect(onPresentStimulus).not.toHaveBeenCalled();   // never over her voice

    setTutorSpeaking(false);
    advance(699);
    expect(onPresentStimulus).not.toHaveBeenCalled();   // the breath
    advance(1);
    expect(onPresentStimulus).toHaveBeenCalledTimes(1);
    expect(onPresentStimulus).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }), 0);

    // Once per arm: a later silence is not a second stimulus.
    setTutorSpeaking(true);
    setTutorSpeaking(false);
    advance(5000);
    expect(onPresentStimulus).toHaveBeenCalledTimes(1);
  });

  /**
   * REGRESSION — the falling edge alone fires on the WRONG utterance.
   *
   * On an affirm the runner queues the next item's cue and opens the item in
   * the same dispatch, but a queued cue waits for the floor. So item 2 is on
   * screen for the whole tail of item 1's affirmation, and a bare "she spoke,
   * then stopped" latch fills on that tail and fires the stimulus in the gap
   * BEFORE item 2's ask is ever spoken. Removing the `cuedItemId` clause in
   * effect (1) fails exactly this test.
   */
  it('does not fire on the tail of the previous item’s affirmation', async () => {
    const { onPresentStimulus } = stimulusMount([voiceItem('i1', 'cat'), voiceItem('i2', 'dog')]);
    await startRun();
    cueSent('[ITEM] cat');
    setTutorSpeaking(true);
    setTutorSpeaking(false);
    advance(700);
    expect(onPresentStimulus).toHaveBeenCalledTimes(1);

    // Item 2 opens while she is still affirming item 1 — its cue is QUEUED.
    setTutorSpeaking(true);
    verdict('affirmed');
    expect(run.currentIndex).toBe(1);

    // Her affirmation drains. The screen is on item 2; her line was not.
    setTutorSpeaking(false);
    advance(5000);
    expect(onPresentStimulus).toHaveBeenCalledTimes(1);

    // NOW item 2's cue reaches the floor and she asks it.
    cueSent('[ITEM] dog');
    setTutorSpeaking(true);
    setTutorSpeaking(false);
    advance(700);
    expect(onPresentStimulus).toHaveBeenCalledTimes(2);
    expect(onPresentStimulus).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'i2' }), 1);
  });

  it('presents anyway if her audio never arrives — a child cannot answer about a frame that never flashed', async () => {
    const { onPresentStimulus } = stimulusMount([voiceItem('i1', 'cat')]);
    await startRun();
    advance(11_999);
    expect(onPresentStimulus).not.toHaveBeenCalled();
    advance(1);                    // the safety net trips…
    expect(onPresentStimulus).not.toHaveBeenCalled();
    advance(700);                  // …and the breath still happens
    expect(onPresentStimulus).toHaveBeenCalledTimes(1);
  });

  it('re-arms on a correction retry, so the re-flash waits for her CORRECTION', async () => {
    const { onPresentStimulus } = stimulusMount([voiceItem('i1', 'cat')]);
    await startRun();
    cueSent('[ITEM] cat');
    setTutorSpeaking(true);
    setTutorSpeaking(false);
    advance(700);
    expect(onPresentStimulus).toHaveBeenCalledTimes(1);

    // No new cue is SENT on a correction — `cuedItemId` still names this item,
    // which is what lets the gate catch her correction line.
    verdict('corrected');
    setTutorSpeaking(true);
    advance(5000);
    expect(onPresentStimulus).toHaveBeenCalledTimes(1);
    setTutorSpeaking(false);
    advance(700);
    expect(onPresentStimulus).toHaveBeenCalledTimes(2);
  });

  it('skips items the pack says own no stimulus', async () => {
    const { onPresentStimulus } = stimulusMount(
      [voiceItem('i1', 'cat'), voiceItem('i2', 'dog')],
      { stimulus: { when: (item) => item.id === 'i2' } },
    );
    await startRun();
    cueSent();
    setTutorSpeaking(true);
    setTutorSpeaking(false);
    advance(5000);
    expect(onPresentStimulus).not.toHaveBeenCalled();

    setTutorSpeaking(true);
    verdict('affirmed');
    cueSent();
    setTutorSpeaking(false);
    advance(700);
    expect(onPresentStimulus).toHaveBeenCalledTimes(1);
    expect(onPresentStimulus).toHaveBeenCalledWith(expect.objectContaining({ id: 'i2' }), 1);
  });

  /**
   * REGRESSION, INHERITED FROM ten-frame drive 2 (2026-08-13) — the frame NEVER
   * flashed. The screen sat on "Get ready to look…" forever while the tutor
   * asked "How many counters did you see?" against an empty frame.
   *
   * The prep timer lived in an effect that depended on the flash callback, that
   * callback closed over `runner` (a fresh object every render), and back then
   * `ctx.micLevel` updated once per audio frame — so the effect tore down and
   * re-armed its timer many times a second and it could never reach its
   * deadline. 19b removed that particular amplifier; the invariant is what
   * matters and it moved here with the timer: A STIMULUS TIMER MUST SURVIVE ITS
   * CONSUMER RE-RENDERING. Every dep in the three gate effects is a primitive
   * for this reason. Test under re-render, never at rest.
   */
  it('fires while the consumer re-renders continuously', async () => {
    const { onPresentStimulus } = stimulusMount([voiceItem('i1', 'cat')]);
    await startRun();
    cueSent();
    setTutorSpeaking(true);
    advance(2000);
    setTutorSpeaking(false);

    for (let i = 0; i < 10; i++) {
      advance(100);
      refresh();
    }
    expect(onPresentStimulus).toHaveBeenCalledTimes(1);
  });

  it('never fires after the run has finished', async () => {
    const { onPresentStimulus } = stimulusMount([voiceItem('i1', 'cat')]);
    await startRun();
    cueSent();
    setTutorSpeaking(true);
    verdict('affirmed');           // last item → finish()
    setTutorSpeaking(false);
    advance(20_000);
    expect(onPresentStimulus).not.toHaveBeenCalled();
  });
});

/**
 * THE STILLNESS CLOSE (19c) — a hands turn's analogue of the mic's silence
 * bracket. Four ports wrote their own, with nine hand-tuned constants between
 * them; what none of them could get wrong once is the CANCEL list, which is the
 * reason the window belongs to the runner.
 */
describe('the stillness close', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('commits when the board stops changing, and every touch resets the window', async () => {
    const commit = vi.fn();
    mount([gestureItem('g1', 'cat')]);
    await startRun();

    act(() => run.armStillness(commit, 3000));
    advance(2999);
    expect(commit).not.toHaveBeenCalled();
    act(() => run.armStillness(commit, 3000));   // the child touched it again
    advance(2999);
    expect(commit).not.toHaveBeenCalled();
    advance(1);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('uses the runner default when a call names no window', async () => {
    const commit = vi.fn();
    mount([gestureItem('g1', 'cat')], {}, { stillnessMs: 1500 });
    await startRun();
    act(() => run.armStillness(commit));
    advance(1499);
    expect(commit).not.toHaveBeenCalled();
    advance(1);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  /**
   * REGRESSION — the previous item's board must never commit into this item's
   * turn. This is the cancel every port had to remember by hand, at five sites.
   */
  it('is cancelled by the item advance, the correction retry and the commit', async () => {
    const commit = vi.fn();
    mount([gestureItem('g1', 'cat'), gestureItem('g2', 'dog'), gestureItem('g3', 'pig')]);
    await startRun();

    act(() => run.armStillness(commit, 3000));
    verdict('affirmed');                 // item advance
    advance(5000);
    expect(commit).not.toHaveBeenCalled();

    act(() => run.armStillness(commit, 3000));
    verdict('corrected');                // correction retry
    advance(5000);
    expect(commit).not.toHaveBeenCalled();

    act(() => run.armStillness(commit, 3000));
    act(() => run.submitGestureAttempt('[VERDICT] built'));   // the commit itself
    advance(5000);
    expect(commit).not.toHaveBeenCalled();
  });

  it('clearStillness cancels it — starting over is thinking, not an answer', async () => {
    const commit = vi.fn();
    mount([gestureItem('g1', 'cat')]);
    await startRun();
    act(() => run.armStillness(commit, 3000));
    act(() => run.clearStillness());
    advance(5000);
    expect(commit).not.toHaveBeenCalled();
  });
});

/**
 * THE REVEAL HOLD (18b, ruled 2026-08-15) — the reveal opens on the affirmation
 * and closes when her cue for the NEXT item is SENT.
 *
 * The bug it replaces was invisible and family-wide: ports set a reward in
 * `onAffirmed` and cleared it in `onItemOpened`, and the runner fires both IN
 * ONE DISPATCH on the advance path — so the reveal painted on the last item and
 * nowhere else, in all four math ports, for a month.
 */
describe('the reveal hold', () => {
  it('holds through her affirmation, then closes on the next item’s cue', async () => {
    mount([voiceItem('i1', 'cat'), voiceItem('i2', 'dog')]);
    await startRun();
    expect(run.revealHeld).toBe(false);

    verdict('affirmed');
    // The screen is ALREADY on item 2 and item 2 is not solved — which is why a
    // `currentSolved` gate showed nothing here.
    expect(run.currentIndex).toBe(1);
    expect(run.currentSolved).toBe(false);
    expect(run.revealHeld).toBe(true);

    cueSent('[ITEM] dog');
    expect(run.revealHeld).toBe(false);
  });

  it('holds into the summary on the last item, where the complete cue names the same item', async () => {
    mount([voiceItem('i1', 'cat')]);
    await startRun();
    verdict('affirmed');
    expect(run.revealHeld).toBe(true);
    cueSent('[COMPLETE]');
    expect(run.revealHeld).toBe(true);
  });

  it('a capped item reveals nothing', async () => {
    mount([voiceItem('i1', 'cat'), voiceItem('i2', 'dog')]);
    await startRun();
    verdict('corrected');
    verdict('corrected');
    verdict('corrected');   // capped → move on
    expect(run.currentIndex).toBe(1);
    expect(run.revealHeld).toBe(false);
  });
});

describe('tap-to-hear', () => {
  it('speaks the stimulus silently and never advances anything', async () => {
    mount([voiceItem('i1', 'cat')]);
    await startRun();
    act(() => run.hearStimulus());
    // `scripted` is load-bearing here, not incidental: a [PRONOUNCE] cue is a
    // say-exactly line, so the server must not prepend its [CURRENT STATE]
    // block — the Live model narrates that preamble aloud, and on a judged
    // item the preamble names the answer (ten-frame --di drive, 2026-08-14).
    expect(sendText).toHaveBeenCalledWith('[PRONOUNCE] cat', { silent: true, scripted: true });
    expect(run.stimulusTapped).toBe(true);
    expect(run.currentIndex).toBe(0);
  });
});

/**
 * ITEM 31 (qa/di/BACKLOG.md, 2026-09-04) — the scroll layout keeps every block
 * mounted, so a lesson holds several live runners at once and only the one the
 * lesson is pointed at may own the floor. The runner tells the loop which one it
 * is; the loop does the gating (its own suite covers what "inactive" withholds).
 * Lesson-bench sitting de90b50f9e1b: ten-frame left mid-build kept the shared
 * bracket and di-spoken-practice, three blocks down, was deaf for 149s.
 */
describe('lesson focus (item 31)', () => {
  it('tells the loop whether this block is the one the lesson is pointed at', () => {
    ctxState.sessionMode = 'lesson';
    ctxState.activePrimitiveId = 'some-other-block';
    mount([voiceItem('i1', 'cat')]);
    expect(loopStub.active).toBe(false);

    // The student scrolls to this block: the viewport switch lands.
    ctxState.activePrimitiveId = 'test-1';
    refresh();
    expect(loopStub.active).toBe(true);

    // Tracking has not started (no switch yet): fail OPEN, never deafen a pack.
    ctxState.activePrimitiveId = null;
    refresh();
    expect(loopStub.active).toBe(true);
  });

  it('is always active outside a lesson, whatever the provider points at', () => {
    ctxState.sessionMode = 'idle';
    ctxState.activePrimitiveId = 'some-other-block';
    mount([voiceItem('i1', 'cat')]);
    expect(loopStub.active).toBe(true);
  });
});
