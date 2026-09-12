// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JudgedScriptRunnerOptions } from '../../../hooks/useJudgedScriptRunner';
import type { NumberBondItem } from './numberBondScript';
import type { NumberBondData } from './NumberBond';

const state = vi.hoisted(() => ({ index: 0, running: true, awaiting: false, cued: null as string | null,
  options: null as JudgedScriptRunnerOptions<NumberBondItem> | null, submit: vi.fn(), queue: vi.fn(), clearQueue: vi.fn(),
  evaluate: vi.fn(), timer: null as ReturnType<typeof setTimeout> | null,
}));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: state.evaluate }) }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: ({ run }: { run: { currentItem?: NumberBondItem } }) => <div data-testid="turn-kind">{run.currentItem?.answerKind}</div> }));
vi.mock('../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: (options: JudgedScriptRunnerOptions<NumberBondItem>) => {
    state.options = options;
    const item = options.pack.items[state.index];
    React.useEffect(() => { options.onItemOpened?.(item, 0); }, []);

    const clear = () => { if (state.timer) clearTimeout(state.timer); state.timer = null; };
    return { currentItem: item, currentIndex: state.index, running: state.running,
      stage: state.awaiting ? 'judging' : 'asking', canAttempt: state.running && !state.awaiting,
      cuedItemId: state.cued ?? item?.id, solvedIds: new Set<string>(),
      currentSolved: false, revealHeld: false, summary: null,
      micState: 'armed', statusLine: 'Your turn.', start: vi.fn(), hearStimulus: vi.fn(),
      armStillness: (commit: () => void, ms: number) => { clear(); state.timer = setTimeout(commit, ms); },
      clearStillness: clear, isAwaitingGesture: () => state.awaiting,
      submitGestureAttempt: (cue: string) => { if (state.awaiting) return; clear(); state.awaiting = true; state.submit(cue); },
      loop: { queueCue: state.queue, clearQueuedCue: state.clearQueue },
    };
  },
}));

import NumberBond from './NumberBond';
const data: NumberBondData = { title: 'Split and Say', challenges: [{ id: 'a', type: 'decompose', whole: 5, instruction: 'Split five.' }],
  maxNumber: 10, showCounters: true, showEquation: true, gradeBand: '1' };
const tray = (name: string) => within(screen.getByRole('region', { name: `${name} counter tray` }));
const put = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Move counter to ${name}` }));
const open = (index: number, affirmed = false) => {
  if (affirmed) act(() => state.options!.onAffirmed?.(state.options!.pack.items[state.index]));
  state.index = index; state.awaiting = false;
  act(() => state.options!.onItemOpened?.(state.options!.pack.items[index], index));
};
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); state.index = 0; state.running = true; state.awaiting = false; state.cued = null; state.timer = null;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Number Bond Split and Say runtime', () => {
  it('moves the same counters between parts, preserves partial work, and commits a settled split', () => {
    render(<NumberBond data={data} />);
    expect(tray('whole').getAllByRole('button', { name: /^Counter/ })).toHaveLength(5);
    put('left'); put('left');
    act(() => vi.advanceTimersByTime(8000));
    expect(state.submit).not.toHaveBeenCalled();
    put('right'); put('right'); put('right');
    act(() => vi.advanceTimersByTime(500));
    fireEvent.click(screen.getByRole('button', { name: 'Counter 2' })); put('right');
    expect(tray('left').getAllByRole('button', { name: /^Counter/ })).toHaveLength(1);
    expect(tray('right').getAllByRole('button', { name: /^Counter/ })).toHaveLength(4);
    act(() => vi.advanceTimersByTime(1200));
    expect(state.submit).toHaveBeenCalledTimes(1);
    expect(state.submit.mock.calls[0][0]).toContain('valid=true');
    expect(state.submit.mock.calls[0][0]).not.toContain('four');
  });
  it('freezes the chosen split for speech, hides the numeral answer, then retains the counters for another way', () => {
    const view = render(<NumberBond data={data} />);
    put('left'); put('left'); put('right'); put('right'); put('right');
    act(() => vi.advanceTimersByTime(1200));
    open(1, true); view.rerender(<NumberBond data={data} />);
    expect(screen.getByTestId('turn-kind').textContent).toBe('voice');
    expect(tray('right').getByText('How many here?')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Counter 1' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText('2 + 3 = 5')).toBeNull();
    expect(state.options!.pack.itemCue(state.options!.pack.items[1], { opening: false, howToPlay: true })).toContain('Private expected number: 3');
    open(2, true); view.rerender(<NumberBond data={data} />);
    expect(screen.getByText('2 + 3')).toBeTruthy();
    expect(tray('left').getAllByRole('button', { name: /^Counter/ })).toHaveLength(2);
    expect(tray('right').getAllByRole('button', { name: /^Counter/ })).toHaveLength(3);
  });
  it('allows returning and undoing counters, canceling pending completion', () => {
    render(<NumberBond data={data} />);
    for (let n = 0; n < 5; n++) put('right');
    fireEvent.click(screen.getByRole('button', { name: 'Bring back together' }));
    act(() => vi.advanceTimersByTime(2000));
    expect(state.submit).not.toHaveBeenCalled();
    expect(tray('whole').getAllByRole('button', { name: /^Counter/ })).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(tray('right').getAllByRole('button', { name: /^Counter/ })).toHaveLength(5);
    act(() => vi.advanceTimersByTime(1200));
    expect(state.submit).toHaveBeenCalledTimes(1);
  });
  it('supports native drag and ignores an out-of-range drop', () => {
    render(<NumberBond data={data} />);
    fireEvent.drop(screen.getByRole('region', { name: 'left counter tray' }), { dataTransfer: { getData: () => '3' } });
    expect(tray('left').getByRole('button', { name: 'Counter 4' })).toBeTruthy();
    fireEvent.drop(screen.getByRole('region', { name: 'right counter tray' }), { dataTransfer: { getData: () => '999' } });
    expect(tray('right').queryByRole('button', { name: /^Counter/ })).toBeNull();
  });
  it('attributes a capped construction and does not clear a split on spoken retry', () => {
    const view = render(<NumberBond data={data} />);
    open(1); view.rerender(<NumberBond data={data} />);
    expect(screen.getByText("Tutor's example")).toBeTruthy();
    const before = tray('right').getAllByRole('button', { name: /^Counter/ }).length;
    act(() => state.options!.onCorrectionRetry?.(state.options!.pack.items[1], 1));
    expect(tray('right').getAllByRole('button', { name: /^Counter/ })).toHaveLength(before);
  });
  it('runs a spoken teen interpretation, then preserves related-fact and equation modalities in a mixed session', () => {
    const mixed: NumberBondData = { ...data, challenges: [
      { id: 'teen', type: 'ten-and-ones', whole: 11, instruction: 'Ten and ones.' },
      { id: 'related', type: 'related-fact', whole: 5, part1: 2, instruction: 'Related facts.' },
      { id: 'equation', type: 'build-equation', whole: 5, part1: 2, instruction: 'Build.' }] };
    const view = render(<NumberBond data={mixed} />);
    for (let n = 0; n < 10; n++) put('left'); put('right');
    act(() => vi.advanceTimersByTime(1200));
    open(1, true); view.rerender(<NumberBond data={mixed} />);
    expect(state.options!.pack.itemCue(state.options!.pack.items[1], { opening: false, howToPlay: true })).toContain('One ten and how many ones?');
    expect(state.options!.pack.items
      .filter((item) => item.kind === 'related-fact' && item.answerKind === 'voice')
      .map((item) => item.answer)).toEqual([3, 2]);
    open(2, true); view.rerender(<NumberBond data={mixed} />);
    expect(screen.getByRole('region', { name: 'whole counter tray' })).toBeTruthy();
    expect(state.options!.pack.items.find((item) => item.interactionPhase === 'equation-build')?.answerKind).toBe('gesture');
  });
  it('keeps related-fact groups stable across join, say, separate, and say', () => {
    const related: NumberBondData = { ...data, challenges: [
      { id: 'related', type: 'related-fact', whole: 5, part1: 2, instruction: 'Use one model.' },
    ] };
    const view = render(<NumberBond data={related} />);
    fireEvent.click(screen.getByRole('button', { name: 'Join the groups' }));
    act(() => vi.advanceTimersByTime(1200));
    expect(state.submit.mock.calls.at(-1)?.[0]).toContain('action=join');

    open(1, true); view.rerender(<NumberBond data={related} />);
    expect(tray('whole').getAllByRole('button', { name: /^Counter/ })).toHaveLength(5);
    expect(state.options!.pack.itemCue(state.options!.pack.items[1], { opening: false, howToPlay: false })).toContain('Private expected number: 3');

    open(2, true); view.rerender(<NumberBond data={related} />);
    fireEvent.click(screen.getByRole('button', { name: 'Move blue group away' }));
    act(() => vi.advanceTimersByTime(1200));
    expect(state.submit.mock.calls.at(-1)?.[0]).toContain('action=separate-right');

    open(3, true); view.rerender(<NumberBond data={related} />);
    expect(tray('whole').getAllByRole('button', { name: /^Counter/ })).toHaveLength(2);
    expect(tray('right').getAllByRole('button', { name: /^Counter/ })).toHaveLength(3);
    expect(state.options!.pack.itemCue(state.options!.pack.items[3], { opening: false, howToPlay: false })).toContain('Private expected number: 2');
  });
  it('keeps the missing quantity covered and records optional counter support without scoring the moves', () => {
    const missing: NumberBondData = { ...data, supportTier: 'easy', challenges: [
      { id: 'missing', type: 'missing-part', whole: 7, part1: 3, instruction: 'Find the covered part.' },
    ] };
    render(<NumberBond data={missing} />);
    expect(screen.getByLabelText('Covered part, quantity hidden')).toBeTruthy();
    expect(screen.queryByText('4')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Use counters' }));
    put('left'); put('left'); put('left');
    act(() => vi.advanceTimersByTime(3000));
    expect(state.submit).not.toHaveBeenCalled();

    const item = state.options!.pack.items[0];
    act(() => state.options!.onAffirmed?.(item));
    act(() => state.options!.onFinished({
      outcomes: [{ id: item.id, solved: true, score: 100, corrections: 0, seconds: 1 }],
      accuracy: 100, passed: true, attemptsCount: 1, firstTryCount: 1, solvedCount: 1,
      hearTaps: 0, observations: [],
    }));
    const work = state.evaluate.mock.calls[0][3] as {
      missingPartEvidence: Record<string, { support: string; counterMoves: number }>;
    };
    expect(Object.values(work.missingPartEvidence)).toEqual([{ support: 'counters', counterMoves: 3 }]);
  });
  it('reveals the covered counters only on an explicit correction path', () => {
    const missing: NumberBondData = { ...data, challenges: [
      { id: 'missing', type: 'missing-part', whole: 7, part1: 3, instruction: 'Find the covered part.' },
    ] };
    const view = render(<NumberBond data={missing} />);
    expect(screen.getByLabelText('Covered part, quantity hidden')).toBeTruthy();
    act(() => state.options!.onCorrectionRetry?.(state.options!.pack.items[0], 1));
    view.rerender(<NumberBond data={missing} />);
    expect(screen.getByLabelText('4 covered counters revealed')).toBeTruthy();
    expect(screen.queryByLabelText('Covered part, quantity hidden')).toBeNull();
  });
  it('requires a build-equation response to match the action the learner chose', () => {
    const build: NumberBondData = { ...data, challenges: [
      { id: 'build', type: 'build-equation', whole: 7, part1: 3, instruction: 'Model and write.' },
    ] };
    const view = render(<NumberBond data={build} />);
    fireEvent.click(screen.getByRole('button', { name: 'Take away blue' }));
    act(() => vi.advanceTimersByTime(1200));
    open(1, true); view.rerender(<NumberBond data={build} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Equation keyboard entry' }), { target: { value: '3+4=7' } });
    act(() => vi.advanceTimersByTime(1400));
    expect(state.submit.mock.calls.at(-1)?.[0]).toContain('Show the taking-apart action you just did');

    act(() => {
      state.awaiting = false;
      state.options!.onCorrectionRetry?.(state.options!.pack.items[1], 1);
    });
    view.rerender(<NumberBond data={build} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Equation keyboard entry' }), { target: { value: '7-4=3' } });
    act(() => vi.advanceTimersByTime(1400));
    expect(state.submit.mock.calls.at(-1)?.[0]).toContain('that MATCHES');
  });
  it('records one fact-family equation at a time and keeps it through the next transform', () => {
    const family: NumberBondData = { ...data, challenges: [
      { id: 'family', type: 'fact-family', whole: 7, part1: 3, factFamily: ['3+4=7', '4+3=7', '7-3=4', '7-4=3'], instruction: 'Build the family.' },
    ] };
    const view = render(<NumberBond data={family} />);
    fireEvent.click(screen.getByRole('button', { name: 'Join the groups' }));
    act(() => vi.advanceTimersByTime(1200));
    open(1, true); view.rerender(<NumberBond data={family} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Equation keyboard entry' }), { target: { value: '7=3+4' } });
    act(() => vi.advanceTimersByTime(1400));
    expect(state.submit.mock.calls.at(-1)?.[0]).toContain('fault=match');

    open(2, true); view.rerender(<NumberBond data={family} />);
    expect(screen.getByText('Family record: 1 of 4')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Swap the groups' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Equation keyboard entry' })).toBeNull();
  });
});
