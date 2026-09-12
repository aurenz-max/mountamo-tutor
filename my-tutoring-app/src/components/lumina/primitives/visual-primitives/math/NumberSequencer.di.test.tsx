// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { buildSequencerItems, type SequencerItem } from './numberSequencerScript';
const state = vi.hoisted(() => ({ index: 0, running: true, canAttempt: true, revealHeld: false,
  hasSubmitted: false, summary: null as any, options: null as any, arm: vi.fn(), submit: vi.fn(), evaluation: vi.fn() }));
const sounds = vi.hoisted(() => ({ snap: vi.fn(), tap: vi.fn() }));
const phaseSummary = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useJudgedScriptRunner', () => ({ useJudgedScriptRunner: (options: any) => {
  state.options = options;
  return { ...state, currentIndex: state.index, currentItem: options.pack.items[state.index], solvedIds: new Set(),
    stage: 'asking', armStillness: state.arm, submitGestureAttempt: state.submit, isAwaitingGesture: () => false,
    hearStimulus: vi.fn() };
} }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: state.hasSubmitted,
  submittedResult: state.hasSubmitted ? { score: 84 } : null, elapsedMs: 42000, submitResult: state.evaluation }) }));
vi.mock('../../../components/DiActionPanel', () => ({ default: ({ currentItem }: { currentItem: SequencerItem }) => <div>{currentItem.actionContract.instruction}</div> }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: (props: any) => {
  phaseSummary(props); return <div>Sequence Complete!</div>;
} }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: sounds }));
import NumberSequencer, { type NumberSequencerData } from './NumberSequencer';
const data: NumberSequencerData = { title: 'The answer is five', gradeBand: 'K', showNumberLine: false, showDotArrays: true,
  challenges: [{ id: 'a', type: 'before-after', instruction: 'Say five', sequence: [null, 6], correctAnswers: [5], rangeMin: 5, rangeMax: 6 },
    { id: 'b', type: 'before-after', instruction: 'Say nine', sequence: [8, null], correctAnswers: [9], rangeMin: 8, rangeMax: 9 }] };
afterEach(cleanup);
beforeEach(() => { state.index = 0; state.running = true; state.canAttempt = true; state.revealHeld = false;
  state.hasSubmitted = false; state.summary = null; vi.clearAllMocks(); });
it('withholds every answer channel until affirmation and holds the affirmed train across advance', () => {
  const view = render(<NumberSequencer data={data} />);
  expect(screen.getByTestId('train-car-0').textContent).toBe('?');
  expect(screen.queryByText('The answer is five')).toBeNull();
  expect(screen.queryByRole('spinbutton')).toBeNull();
  expect(screen.queryByRole('button', { name: /check|next/i })).toBeNull();
  act(() => { state.options.onAffirmed(state.options.pack.items[0]); state.index = 1; state.revealHeld = true; });
  view.rerender(<NumberSequencer data={data} />);
  expect(screen.getByTestId('train-car-0').textContent).toBe('5');
  state.revealHeld = false; view.rerender(<NumberSequencer data={data} />);
  expect(screen.getByTestId('train-car-0').textContent).toBe('8');
  expect(screen.getByTestId('train-car-1').textContent).toBe('?');
});
it('never marks the spot-error position or supplies a sorted reference before a verdict', () => {
  render(<NumberSequencer data={{ ...data, showNumberLine: true, challenges: [{ id: 'e', type: 'spot-error', instruction: '',
    sequence: [1, 2, 8, 4, 5], correctAnswers: [3], wrongIndex: 2, rangeMin: 1, rangeMax: 8 }] }} />);
  expect(screen.getByTestId('train-car-2').className).toBe(screen.getByTestId('train-car-1').className);
  expect(screen.queryByLabelText('Number line reference')).toBeNull();
});
it('commits incomplete ordering through stillness and disables manipulation before the run', () => {
  const order: NumberSequencerData = { ...data, showNumberLine: true, challenges: [{ id: 'o', type: 'order-cards', instruction: '',
    sequence: [3, 1, 4, 2], correctAnswers: [1, 2, 3, 4], rangeMin: 1, rangeMax: 4 }] };
  state.running = false; state.canAttempt = false;
  const view = render(<NumberSequencer data={order} />);
  fireEvent.click(screen.getByRole('button', { name: 'Place 3' })); expect(state.arm).not.toHaveBeenCalled();
  state.running = true; state.canAttempt = true; view.rerender(<NumberSequencer data={order} />);
  fireEvent.click(screen.getByRole('button', { name: 'Place 3' }));
  expect(state.arm).toHaveBeenCalledWith(expect.any(Function), 3000);
  act(() => state.arm.mock.calls[0][0]());
  expect(state.submit.mock.calls[0][0]).toContain('correct=false; placed=3');
  expect(screen.queryByLabelText('Number line reference')).toBeNull();
});
it('sounds card placement and removal only when ordering is interactive', () => {
  const order: NumberSequencerData = { ...data, challenges: [{ id: 'o', type: 'order-cards', instruction: '',
    sequence: [3, 1, 4, 2], correctAnswers: [1, 2, 3, 4], rangeMin: 1, rangeMax: 4 }] };
  state.running = false; state.canAttempt = false;
  const view = render(<NumberSequencer data={order} />);
  fireEvent.click(screen.getByRole('button', { name: 'Place 3' }));
  expect(sounds.snap).not.toHaveBeenCalled();
  state.running = true; state.canAttempt = true; view.rerender(<NumberSequencer data={order} />);
  fireEvent.click(screen.getByRole('button', { name: 'Place 3' }));
  expect(sounds.snap).toHaveBeenCalledOnce();
  expect(sounds.tap).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove 3' }));
  expect(sounds.tap).toHaveBeenCalledOnce();
});
it('renders the shared phase summary from the judged outcome ledger', () => {
  state.hasSubmitted = true;
  const summaryItems = buildSequencerItems(data.challenges).items;
  state.summary = { outcomes: summaryItems.map((summaryItem, index) => ({ id: summaryItem.id,
    solved: true, corrections: index, score: index === 0 ? 100 : 67 })) };
  render(<NumberSequencer data={data} />);
  expect(screen.getByText('Sequence Complete!')).toBeTruthy();
  expect(phaseSummary).toHaveBeenCalledWith(expect.objectContaining({
    overallScore: 84,
    durationMs: 42000,
    heading: 'Sequence Complete!',
    celebrationMessage: 'You practiced each number sequence!',
    phases: [
      expect.objectContaining({ label: 'Before & After', score: 100, attempts: 1, firstTry: true }),
      expect.objectContaining({ label: 'Before & After', score: 67, attempts: 2, firstTry: false }),
    ],
  }));
});
it('submits the tutor outcomes with item provenance and modality, without rescoring', () => {
  render(<NumberSequencer data={data} />);
  const outcomes = state.options.pack.items.map((i: SequencerItem) => ({ id: i.id, score: 67, solved: true, corrections: 1 }));
  act(() => state.options.onFinished({ outcomes, accuracy: 67, solvedCount: 2, attemptsCount: 4, diagnosisEvidence: undefined }));
  expect(state.evaluation).toHaveBeenCalledWith(true, 67, expect.objectContaining({ accuracy: 67, beforeAfterAccuracy: 67, attemptsCount: 4 }),
    expect.objectContaining({ challengeResults: expect.arrayContaining([expect.objectContaining({ sourceId: 'a', viaVoice: true, score: 67 })]) }), undefined, undefined);
});
