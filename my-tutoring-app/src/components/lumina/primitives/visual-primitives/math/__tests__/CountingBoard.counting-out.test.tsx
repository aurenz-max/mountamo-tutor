// @vitest-environment jsdom
/**
 * The K counting-out family on the BOARD (2026-09-08 — slice 7,
 * `counting-extensions`). The judged script's own suite proves the wording;
 * this proves the thing the child's hands touch, on the real runner:
 *
 *  1. give_me_n — a tap hands one over, a second tap puts it back, and the
 *     handover button is the commit (nothing commits on a stray tap).
 *  2. take_away — the first `changeBy` taps take objects OFF the board; a tap
 *     after that counts what is left instead of removing more.
 *  3. add_more — the extras render faint from the start and only a tap puts
 *     one on, so putting one on never re-flows what was already counted.
 *  4. recount_moved — counting the last object moves the set, clears the count
 *     trace, and FREEZES the board: being unable to re-count is the task.
 *  5. count_on @ K — the started group is under a basket, so it cannot be
 *     counted; at Grade 1 it stays visible (the band fork).
 *
 * The speech engine is inert-stubbed exactly as the reader-fit suite does: this
 * drives display and manipulation, not the judged loop.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ctxState = vi.hoisted(() => ({
  isConnected: true,
  isListening: true,
  isAudioPlaying: false,
  sessionMode: 'idle' as 'idle' | 'lesson',
  sessionResumeCount: 0,
  conversation: [] as Array<{ role: string; content: string }>,
}));
vi.mock('@/contexts/LuminaAIContext', () => ({
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({
    ...ctxState,
    sendText: vi.fn(),
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    startListening: vi.fn(() => { ctxState.isListening = true; }),
    stopListening: vi.fn(),
    updateContext: vi.fn(),
  }),
}));
vi.mock('../../../../hooks/useJudgedSpeechLoop', () => ({
  useJudgedSpeechLoop: (options: { onCue?: (e: { phase: string; text: string }) => void }) => ({
    voiceTurns: {},
    queueCue: vi.fn(),
    submitGestureAttempt: vi.fn(),
    sendCueNow: vi.fn((text: string) => options.onCue?.({ phase: 'sent', text })),
    clearQueuedCue: vi.fn(),
    arm: vi.fn(),
    disarm: vi.fn(),
    reset: vi.fn(),
    isAwaitingJudgment: () => false,
    config: {},
  }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import CountingBoard, { type CountingBoardChallenge, type CountingBoardData } from '../CountingBoard';

const challenge = (
  id: string,
  type: CountingBoardChallenge['type'],
  count: number,
  extra: Partial<CountingBoardChallenge> = {},
): CountingBoardChallenge => ({
  id,
  type,
  instruction: 'Have a go.',
  targetAnswer: count,
  count,
  arrangement: 'line',
  hint: 'Look carefully.',
  narration: 'Off we go.',
  ...extra,
});

const data = (
  gradeBand: CountingBoardData['gradeBand'],
  challenges: CountingBoardChallenge[],
): CountingBoardData => ({
  title: 'Counting-out family test',
  objects: { type: 'stars' },
  challenges,
  gradeBand,
});

const tappableObjects = () => document.querySelectorAll('g.cursor-pointer');
const allObjects = () => document.querySelectorAll('svg text[font-size="24"]');
const countBadges = () => document.querySelectorAll('circle[fill="#eab308"]');
/** Objects drawn faint are the add_more extras still waiting to be put on. */
const faintObjects = () =>
  Array.from(allObjects()).filter((el) => (el as SVGTextElement).style.opacity === '0.25');

const startRun = async () => {
  await act(async () => {
    fireEvent.click(screen.getByLabelText('Tap to start'));
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 200)); });
};

beforeEach(() => {
  cleanup();
  ctxState.isListening = false;
  ctxState.isAudioPlaying = false;
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn() },
    configurable: true,
  });
});
afterEach(() => cleanup());

describe('give_me_n — the handover is the answer', () => {
  it('a tap hands one over and a second tap puts it back', async () => {
    render(<CountingBoard data={data('K', [
      challenge('g1', 'give_me_n', 8, { targetAnswer: 3 }),
      challenge('g2', 'give_me_n', 7, { targetAnswer: 2 }),
    ])} />);
    expect(allObjects()).toHaveLength(8);

    await startRun();
    fireEvent.click(tappableObjects()[0]);
    fireEvent.click(tappableObjects()[1]);
    expect(countBadges()).toHaveLength(2);

    // Putting one back is the child correcting an over-count, not a mistake to
    // be scolded — and the remaining one renumbers to "1".
    fireEvent.click(tappableObjects()[0]);
    expect(countBadges()).toHaveLength(1);
  });

  it('the handover button is the commit, and only after something is taken', async () => {
    render(<CountingBoard data={data('K', [
      challenge('g1', 'give_me_n', 8, { targetAnswer: 3 }),
      challenge('g2', 'give_me_n', 7, { targetAnswer: 2 }),
    ])} />);
    const give = () => screen.getByText('Give them to me').closest('button')!;
    expect(give().disabled).toBe(true);

    await startRun();
    expect(give().disabled).toBe(true);   // nothing taken yet
    fireEvent.click(tappableObjects()[0]);
    expect(give().disabled).toBe(false);
  });
});

describe('take_away — off the board, then count what is left', () => {
  it('the first changeBy taps remove; the next one counts', async () => {
    render(<CountingBoard data={data('K', [
      challenge('t1', 'take_away', 6, { targetAnswer: 4, changeBy: 2 }),
      challenge('t2', 'take_away', 5, { targetAnswer: 3, changeBy: 2 }),
    ])} />);
    expect(allObjects()).toHaveLength(6);

    await startRun();
    fireEvent.click(tappableObjects()[0]);
    fireEvent.click(tappableObjects()[0]);
    // Two are off the board — and neither one counted as a count.
    expect(allObjects()).toHaveLength(4);
    expect(countBadges()).toHaveLength(0);

    // The quota is met, so the next tap counts what is left.
    fireEvent.click(tappableObjects()[0]);
    expect(allObjects()).toHaveLength(4);
    expect(countBadges()).toHaveLength(1);
  });
});

describe('add_more — the extras arrive faint and a tap puts them on', () => {
  it('renders start + changeBy objects, with the extras faint until tapped', async () => {
    render(<CountingBoard data={data('K', [
      challenge('a1', 'add_more', 4, { targetAnswer: 6, changeBy: 2 }),
      challenge('a2', 'add_more', 3, { targetAnswer: 5, changeBy: 2 }),
    ])} />);
    // The board is laid out for the FINAL total from the start, so putting one
    // on never re-flows the objects the child has already counted.
    expect(allObjects()).toHaveLength(6);
    expect(faintObjects()).toHaveLength(2);

    await startRun();
    fireEvent.click(tappableObjects()[4]);
    expect(faintObjects()).toHaveLength(1);
    // Putting one on is not counting it.
    expect(countBadges()).toHaveLength(0);
  });
});

describe('recount_moved — the number has to be held, not re-counted', () => {
  it('counting the last object moves the set, clears the trace and freezes the board', async () => {
    render(<CountingBoard data={data('K', [
      challenge('m1', 'recount_moved', 4),
      challenge('m2', 'recount_moved', 5),
    ])} />);

    await startRun();
    expect(tappableObjects()).toHaveLength(4);
    fireEvent.click(tappableObjects()[0]);
    fireEvent.click(tappableObjects()[1]);
    fireEvent.click(tappableObjects()[2]);
    expect(countBadges()).toHaveLength(3);

    fireEvent.click(tappableObjects()[3]);
    // The set moved: the count tags are gone (they would BE the answer, sitting
    // on screen while the child is asked for it) and nothing is tappable.
    expect(countBadges()).toHaveLength(0);
    expect(tappableObjects()).toHaveLength(0);
    expect(allObjects()).toHaveLength(4);
    expect(screen.getByText(/they moved/i)).toBeTruthy();
  });
});

describe('count_on — the K basket is the band fork', () => {
  it('K covers the started group so it cannot be counted', () => {
    render(<CountingBoard data={data('K', [
      challenge('k1', 'count_on', 8, { targetAnswer: 8, startFrom: 5 }),
      challenge('k2', 'count_on', 7, { targetAnswer: 7, startFrom: 4 }),
    ])} />);
    // Only the objects to count on are drawn; the started five are under cover.
    expect(allObjects()).toHaveLength(3);
    expect(screen.getByText('🧺')).toBeTruthy();
  });

  it('Grade 1 keeps the started group visible (the contract G1 band)', () => {
    render(<CountingBoard data={data('1', [
      challenge('g1', 'count_on', 8, { targetAnswer: 8, startFrom: 5 }),
      challenge('g2', 'count_on', 7, { targetAnswer: 7, startFrom: 4 }),
    ])} />);
    expect(allObjects()).toHaveLength(8);
    expect(screen.queryByText('🧺')).toBeNull();
  });
});
