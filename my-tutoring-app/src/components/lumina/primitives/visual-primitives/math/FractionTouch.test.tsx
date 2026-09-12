// @vitest-environment jsdom
import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
const state = vi.hoisted(() => ({ options: null as any, awaiting: false, canAttempt: true, submit: vi.fn(), evaluate: vi.fn() }));
vi.mock('../../../hooks/useJudgedScriptRunner', () => ({ useJudgedScriptRunner: (options: any) => {
  state.options = options;
  return { currentItem: options.pack.items[0], currentIndex: 0, currentSolved: false, running: true,
    stage: 'asking', canAttempt: state.canAttempt, isAwaitingGesture: () => state.awaiting,
    submitGestureAttempt: state.submit, hearStimulus: vi.fn(), solvedIds: new Set() };
} }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: state.evaluate }) }));
vi.mock('../../../components/DiActionPanel', () => ({ default: ({ currentItem }: any) => <p>{currentItem.actionContract.instruction}</p> }));
import FractionTouch from './FractionTouch';
const data = { title: 'Fractions', challenges: [{ id: 'a', type: 'touch_fraction' as const, numerator: 1, denominator: 3, instruction: '', hint: '', narration: '' }] };
beforeEach(() => { cleanup(); state.awaiting = false; state.canAttempt = true; vi.clearAllMocks(); });
it('shows three unlabeled circle choices and sends code verdicts only for armed touches', () => {
  const { rerender } = render(<FractionTouch data={data} />);
  const choices = screen.getAllByRole('button', { name: /Picture/ });
  expect(choices).toHaveLength(3);
  expect(choices.every(c => c.textContent === '')).toBe(true);
  fireEvent.click(choices[0]); expect(state.submit).toHaveBeenCalledTimes(1);
  state.awaiting = true; rerender(<FractionTouch data={data} />);
  fireEvent.click(choices[1]); expect(state.submit).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: /Next|Check/ })).toBeNull();
});
it('reports touch mode and preserves correction-weighted scores and failed outcomes', () => {
  render(<FractionTouch data={data} />);
  state.options.onFinished({ passed: false, accuracy: 0, solvedCount: 0, attemptsCount: 3, outcomes: [{ id: 'a', solved: false, corrections: 2, score: 0 }], diagnosisEvidence: { source: 'test' } });
  expect(state.evaluate).toHaveBeenCalledWith(false, 0, expect.objectContaining({ evalMode: 'touch_fraction', correctCount: 0, attemptsCount: 3, touchFractionAccuracy: 0 }), expect.objectContaining({ taps: {} }), undefined, { source: 'test' });
});
