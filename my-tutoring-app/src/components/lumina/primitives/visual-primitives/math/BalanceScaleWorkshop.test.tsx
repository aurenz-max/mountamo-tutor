// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JudgedScriptRunnerOptions } from '../../../hooks/useJudgedScriptRunner';
import type { WorkshopItem } from './balanceWorkshopScript';
import type { BalanceScaleData } from './BalanceScale';

const state = vi.hoisted(() => ({ index: 0, running: true, awaiting: false, cued: null as string | null,
  options: null as JudgedScriptRunnerOptions<WorkshopItem> | null, submit: vi.fn(), queue: vi.fn(), clearQueue: vi.fn(),
  evaluate: vi.fn(), timer: null as ReturnType<typeof setTimeout> | null,
}));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: state.evaluate }) }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => <div data-testid="mic" /> }));
vi.mock('../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: (options: JudgedScriptRunnerOptions<WorkshopItem>) => {
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

import BalanceScaleWorkshop from './BalanceScaleWorkshop';
import type { BalanceScaleChallengeType } from './BalanceScale';
const fixture = (type: BalanceScaleChallengeType, target = 4, known = 0, parcels = 3): BalanceScaleData => ({
  title: 'Weights', description: 'Build the math.', leftSide: [], rightSide: [], variableValue: target,
  challenges: [0, 1].map(() => ({ type, variableValue: target,
    leftSide: [...Array.from({ length: parcels }, () => ({ value: 1, isVariable: true })), ...(known ? [{ value: known }] : [])],
    rightSide: [{ value: target * parcels + known }], instruction: 'Use weights.', hint: 'Watch.' })),
});
const pan = (side: string) => within(screen.getByRole('region', { name: `${side} pan` }));
const open = (index: number) => {
  state.index = index; state.awaiting = false;
  act(() => state.options?.onItemOpened?.(state.options.pack.items[index], index));
};
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); state.index = 0; state.running = true; state.awaiting = false; state.cued = null; state.timer = null;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('workshop touch and voice', () => {
  it('distributes actual units, allows uneven groups, and advances only once all groups match', () => {
    const data = fixture('one_step_hard', 2, 0, 2);
    const view = render(<BalanceScaleWorkshop data={data} />);
    expect(screen.queryByRole('spinbutton')).toBeNull();
    const add = (group: number) => fireEvent.click(screen.getByRole('button', { name: `Place unit in group ${group}` }));
    add(1); add(1); add(1); add(2);
    act(() => vi.advanceTimersByTime(1800));
    expect(state.submit).not.toHaveBeenCalled();
    expect(within(screen.getByRole('region', { name: 'Parcel group 1' })).getAllByRole('button', { name: /^Unit/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Unit 3' }));
    add(2);
    act(() => vi.advanceTimersByTime(900));
    expect(state.submit).toHaveBeenCalledTimes(1);
    expect(state.submit.mock.calls[0][0]).toContain('solved=true');
    open(1); view.rerender(<BalanceScaleWorkshop data={data} />);
    expect(screen.getByTestId('mic')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Unit 1' }) as HTMLButtonElement).disabled).toBe(true);
    open(2); view.rerender(<BalanceScaleWorkshop data={data} />);
    expect(state.options!.pack.itemCue(state.options!.pack.items[2], { opening: false, howToPlay: true })).toContain('what does one parcel weigh');
    open(3); view.rerender(<BalanceScaleWorkshop data={data} />);
    expect(within(screen.getByRole('region', { name: 'Unshared weight units' })).getAllByRole('button')).toHaveLength(4);
  });
  it('uses the selected unit or a dragged unit, and rejects forged drop values', () => {
    render(<BalanceScaleWorkshop data={fixture('one_step_hard', 2, 0, 2)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Unit 4' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place unit in group 2' }));
    expect(within(screen.getByRole('region', { name: 'Parcel group 2' })).getByRole('button', { name: 'Unit 4' })).toBeTruthy();
    fireEvent.drop(screen.getByRole('region', { name: 'Parcel group 1' }), { dataTransfer: { getData: () => '0' } });
    expect(within(screen.getByRole('region', { name: 'Parcel group 1' })).getByRole('button', { name: 'Unit 1' })).toBeTruthy();
    fireEvent.drop(screen.getByRole('region', { name: 'Parcel group 1' }), { dataTransfer: { getData: () => '900' } });
    expect(within(screen.getByRole('region', { name: 'Parcel group 1' })).getAllByRole('button', { name: /^Unit/ })).toHaveLength(1);
  });
  it('moves known weight independently, restores balance, then retains set-aside units while sharing', () => {
    const data = fixture('two_step_intro', 2, 1, 2);
    const view = render(<BalanceScaleWorkshop data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'Set aside known 1 weight' }));
    expect(screen.getByText('Right side is heavier')).toBeTruthy();
    expect(state.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Unit 1' }));
    act(() => vi.advanceTimersByTime(900));
    expect(state.submit.mock.calls[0][0]).toContain('solved=true');
    open(1); view.rerender(<BalanceScaleWorkshop data={data} />);
    expect(screen.getByRole('button', { name: 'Unit 1, set aside' })).toBeTruthy();
    open(2); view.rerender(<BalanceScaleWorkshop data={data} />);
    expect((screen.getByRole('button', { name: 'Unit 1, set aside' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(screen.getByRole('region', { name: 'Unshared weight units' })).getAllByRole('button')).toHaveLength(4);
  });
  it('cancels a transient match on undo/reset and gates controls until the current cue', () => {
    const data = fixture('one_step', 2, 5, 1);
    const view = render(<BalanceScaleWorkshop data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    act(() => vi.advanceTimersByTime(2000));
    expect(state.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset this step' }));
    act(() => vi.advanceTimersByTime(2000));
    expect(state.submit).not.toHaveBeenCalled();
    state.cued = 'previous-item';
    view.rerender(<BalanceScaleWorkshop data={data} />);
    expect(screen.queryByRole('button', { name: 'Add 2 weight' })).toBeNull();
  });
  it('keeps the chosen missing-part weights separate from the known load', () => {
    const data = fixture('one_step', 7, 5, 1);
    const view = render(<BalanceScaleWorkshop data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add 5 weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 weight' }));
    act(() => vi.advanceTimersByTime(900));
    open(1); view.rerender(<BalanceScaleWorkshop data={data} />);
    const row = within(screen.getByRole('region', { name: 'Chosen weights addition' }));
    expect(row.getByText('5')).toBeTruthy(); expect(row.getByText('2')).toBeTruthy(); expect(row.queryByText('7')).toBeNull();
    expect(pan('left').getByLabelText('Known left weight 5')).toBeTruthy();
  });
  it('preserves the first combination and rejects a reordered copy on the second build', () => {
    const data = fixture('equality_hard', 5, 0, 1);
    const view = render(<BalanceScaleWorkshop data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add 3 weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 weight' }));
    act(() => vi.advanceTimersByTime(900));
    open(1); view.rerender(<BalanceScaleWorkshop data={data} />);
    open(2); view.rerender(<BalanceScaleWorkshop data={data} />);
    expect(screen.getByText('3 + 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 3 weight' }));
    act(() => vi.advanceTimersByTime(1800));
    expect(state.submit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reset this step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 5 weight' }));
    act(() => vi.advanceTimersByTime(900));
    expect(state.submit).toHaveBeenCalledTimes(2);
  });
  it('adds equation lines only after the corresponding actions and withholds x until its quantity turn', () => {
    const data = fixture('two_step', 2, 1, 2);
    const view = render(<BalanceScaleWorkshop data={data} />);
    const notebook = () => within(screen.getByLabelText('Equation notebook'));
    expect(notebook().getByText('2x + 1 = 5')).toBeTruthy();
    expect(notebook().queryByText('2x = 4')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Set aside known 1 weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unit 1' }));
    expect(notebook().getByText('2x = 4')).toBeTruthy();
    act(() => vi.advanceTimersByTime(900));
    open(1); view.rerender(<BalanceScaleWorkshop data={data} />);
    open(2); view.rerender(<BalanceScaleWorkshop data={data} />);
    for (const group of [1, 1, 2, 2]) fireEvent.click(screen.getByRole('button', { name: `Place unit in group ${group}` }));
    expect(notebook().getByText('x = one group')).toBeTruthy();
    expect(notebook().queryByText('x = 2')).toBeNull();
    act(() => vi.advanceTimersByTime(900));
    open(3); view.rerender(<BalanceScaleWorkshop data={data} />);
    expect(notebook().queryByText('x = 2')).toBeNull();
    open(4); view.rerender(<BalanceScaleWorkshop data={data} />);
    expect(notebook().getByText('x = 2')).toBeTruthy();
  });
  it('attributes a capped hand demonstration and records numeric steps separately from explanation', () => {
    const data = fixture('two_step', 2, 1, 2);
    const view = render(<BalanceScaleWorkshop data={data} />);
    open(1); view.rerender(<BalanceScaleWorkshop data={data} />);
    expect(screen.getByText("Tutor's example includes a demonstrated step.")).toBeTruthy();
    const options = state.options!;
    options.onFinished({ outcomes: options.pack.items.map((item) => ({ id: item.id, solved: item.step !== 'remaining',
      score: item.step === 'remaining' ? 0 : 100, corrections: item.step === 'remaining' ? 2 : 0, seconds: 1 })),
      accuracy: 80, passed: true, attemptsCount: 12, firstTryCount: 10, solvedCount: 10, hearTaps: 0, observations: [] });
    const [passed, score, metrics, work] = state.evaluate.mock.calls[0];
    expect(passed).toBe(false); expect(score).toBe(0); expect(metrics.evalMode).toBe('two_step');
    expect(work.explanationIsCoaching).toBe(true);
    expect(work.results[0].modeledSteps).toContain('remaining');
    expect(work.results[0].outcomes.find((item: { step: string }) => item.step === 'explain').solved).toBe(true);
  });
});
