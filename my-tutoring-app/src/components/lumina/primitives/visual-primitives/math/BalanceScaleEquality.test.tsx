// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JudgedScriptRunnerOptions } from '../../../hooks/useJudgedScriptRunner';
import type { EqualityItem } from './balanceEqualityScript';
import type { BalanceScaleData } from './BalanceScale';

const state = vi.hoisted(() => ({ index: 0, running: true, awaiting: false, cued: null as string | null,
  options: null as JudgedScriptRunnerOptions<EqualityItem> | null, submit: vi.fn(), queue: vi.fn(), clearQueue: vi.fn(),
  evaluate: vi.fn(), timer: null as ReturnType<typeof setTimeout> | null,
}));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: state.evaluate }) }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => <div data-testid="mic" /> }));
vi.mock('../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: (options: JudgedScriptRunnerOptions<EqualityItem>) => {
    state.options = options;
    const item = options.pack.items[state.index];
    const clear = () => { if (state.timer) clearTimeout(state.timer); state.timer = null; };
    return { currentItem: item, currentIndex: state.index, running: state.running,
      stage: state.awaiting ? 'judging' : 'asking', canAttempt: state.running && !state.awaiting,
      cuedItemId: state.cued ?? item?.id, solvedIds: new Set<string>(),
      micState: 'armed', statusLine: 'Your turn.', start: vi.fn(), hearStimulus: vi.fn(),
      armStillness: (commit: () => void, ms: number) => { clear(); state.timer = setTimeout(commit, ms); },
      clearStillness: clear, isAwaitingGesture: () => state.awaiting,
      submitGestureAttempt: (cue: string) => { if (state.awaiting) return; clear(); state.awaiting = true; state.submit(cue); },
      loop: { queueCue: state.queue, clearQueuedCue: state.clearQueue },
    };
  },
}));

import BalanceScaleEquality from './BalanceScaleEquality';
const data: BalanceScaleData = { title: 'Keep It Balanced', description: 'Find the mystery.', gradeBand: 'K-2',
  leftSide: [], rightSide: [], variableValue: 5, challenges: [
    { type: 'equality', leftSide: [{ value: 1, isVariable: true }, { value: 3 }], rightSide: [{ value: 5 }, { value: 3 }],
      variableValue: 5, instruction: 'Find the mystery.', hint: 'Remove three.' },
    { type: 'equality', leftSide: [{ value: 1, isVariable: true }, { value: 2 }], rightSide: [{ value: 4 }, { value: 2 }],
      variableValue: 4, instruction: 'Find the mystery.', hint: 'Remove two.' },
  ] };
const pan = (side: string) => within(screen.getByRole('region', { name: `${side} pan` }));
const open = (index: number) => {
  state.index = index; state.awaiting = false;
  act(() => state.options?.onItemOpened?.(state.options.pack.items[index], index));
};
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); state.index = 0; state.running = true; state.awaiting = false; state.cued = null; state.timer = null;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('weight matching touch / voice sequence', () => {
  it('starts with a hidden proportional block and empty right pan; exploration is ungraded', () => {
    render(<BalanceScaleEquality data={data} />);
    const left = screen.getByLabelText('Left weight; number hidden');
    expect(left.style.height).toBe('40px');
    expect(pan('right').getByText('Place weights here')).toBeTruthy();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByTestId('mic')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add 3 weight' }));
    expect(pan('right').getByRole('button', { name: 'Remove 3 weight, block 0' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(1800));
    expect(state.queue).toHaveBeenCalledTimes(1);
    expect(state.submit).not.toHaveBeenCalled();
    expect(state.evaluate).not.toHaveBeenCalled();
  });
  it('waits for a settled exact match, cancels transient matches, and submits once', () => {
    render(<BalanceScaleEquality data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add 3 weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 weight' }));
    act(() => vi.advanceTimersByTime(400));
    expect(state.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 weight' }));
    act(() => vi.advanceTimersByTime(1800));
    expect(state.submit).not.toHaveBeenCalled();
    expect(screen.getByText('Right side is heavier')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove 1 weight, block 2' }));
    act(() => vi.advanceTimersByTime(900));
    expect(state.submit).toHaveBeenCalledTimes(1);
    expect(state.submit.mock.calls[0][0]).toContain('solved=true');
    act(() => vi.advanceTimersByTime(3000));
    expect(state.submit).toHaveBeenCalledTimes(1);
  });
  it('supports undo and clearing without preserving a pending match', () => {
    render(<BalanceScaleEquality data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add 5 weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    act(() => vi.advanceTimersByTime(2000));
    expect(state.submit).not.toHaveBeenCalled();
    expect(pan('right').getByText('Place weights here')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add 3 weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear weights' }));
    expect(pan('right').queryByRole('button')).toBeNull();
  });
  it('gathers the exact chosen blocks into addition, asks the left weight next, then resets', () => {
    const view = render(<BalanceScaleEquality data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add 3 weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 weight' }));
    act(() => vi.advanceTimersByTime(900));
    open(1); view.rerender(<BalanceScaleEquality data={data} />);
    const row = within(screen.getByRole('region', { name: 'Add your right-side weights' }));
    expect(row.getByText('3')).toBeTruthy();
    expect(row.getByText('2')).toBeTruthy();
    expect(row.queryByText('5')).toBeNull();
    expect(screen.getByTestId('mic')).toBeTruthy();
    expect(pan('right').queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add 1 weight' })).toBeNull();
    open(2); view.rerender(<BalanceScaleEquality data={data} />);
    expect(within(screen.getByRole('region', { name: 'Add your right-side weights' })).getByText('5')).toBeTruthy();
    expect(screen.getByLabelText('Left weight; number hidden')).toBeTruthy();
    expect(state.options!.pack.itemCue(state.options!.pack.items[2], { opening: false, howToPlay: true }))
      .toContain('Since the scales are balanced, what weight is the left side?');
    open(3); view.rerender(<BalanceScaleEquality data={data} />);
    expect(pan('right').getByText('Place weights here')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Add your right-side weights' })).toBeNull();
  });
  it('gates manipulation until the current cue and initial start', () => {
    state.running = false;
    const view = render(<BalanceScaleEquality data={data} />);
    expect(screen.getByTestId('mic')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Add 1 weight' }) as HTMLButtonElement).disabled).toBe(true);
    state.running = true; state.cued = 'previous-item';
    view.rerender(<BalanceScaleEquality data={data} />);
    expect((screen.getByRole('button', { name: 'Add 1 weight' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('keeps total and inference evidence separate; a correct inference cannot erase a failed sum', () => {
    render(<BalanceScaleEquality data={data} />);
    const options = state.options!;
    const outcomes = options.pack.items.map((item) => ({ id: item.id, solved: item.step !== 'total',
      score: item.step === 'total' ? 0 : 100, corrections: item.step === 'total' ? 2 : 0, seconds: 1 }));
    options.onFinished({ outcomes, accuracy: 67, passed: true, attemptsCount: 10,
      firstTryCount: 4, solvedCount: 4, hearTaps: 0, observations: [] });
    const [passed, score, metrics, work] = state.evaluate.mock.calls[0];
    expect(passed).toBe(false); expect(score).toBe(0);
    expect(metrics.correctCount).toBe(0);
    expect(work.explorationIsUngraded).toBe(true);
    expect(work.results[0].inference.solved).toBe(true);
    expect(work.results[0].total.solved).toBe(false);
  });
  it('preserves the hard-mode evaluation identity', () => {
    const hard = { ...data, challenges: data.challenges!.map((challenge) => ({ ...challenge, type: 'equality_hard' as const })) };
    render(<BalanceScaleEquality data={hard} />);
    const options = state.options!;
    expect(options.pack.contextFor(options.pack.items[0]).challengeType).toBe('equality_hard');
    options.onFinished({ outcomes: options.pack.items.map((item) => ({ id: item.id, solved: true, score: 100, corrections: 0, seconds: 1 })),
      accuracy: 100, passed: true, attemptsCount: 6, firstTryCount: 6, solvedCount: 6, hearTaps: 0, observations: [] });
    expect(state.evaluate.mock.calls[0][2].evalMode).toBe('equality_hard');
    expect(state.evaluate.mock.calls[0][2].attemptsCount).toBe(4);
  });
});
