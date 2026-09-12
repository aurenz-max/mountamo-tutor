// @vitest-environment jsdom
import React from 'react';
import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
const state = vi.hoisted(() => ({ writes: [] as any[], locals: [] as any[] }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <p>Block complete</p> }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { playCorrect: vi.fn(), playIncorrect: vi.fn() } }));
vi.mock('../../../evaluation', async () => {
  const React = await import('react');
  return { useEvaluationContext: () => null, usePrimitiveEvaluation: (options: any) => {
    const [hasSubmitted, setSubmitted] = React.useState(false);
    return { hasSubmitted, elapsedMs: 0, submittedResult: null,
      submitResult: (success: boolean, score: number, metrics: any, studentWork: any) => {
        const result = { success, score, metrics, studentWork };
        (options.localOnly ? state.locals : state.writes).push(result);
        setSubmitted(true); options.onSubmit?.(result); return result;
      } };
  } };
});
vi.mock('./FractionTouch', async () => {
  const { usePrimitiveEvaluation } = await import('../../../evaluation');
  return { default: ({ data, localOnly }: any) => {
    const evaluation = usePrimitiveEvaluation({ primitiveType: 'fraction-circles', instanceId: data.instanceId, localOnly, onSubmit: data.onEvaluationSubmit });
    return <button onClick={() => evaluation.submitResult(true, 67, { type: 'fraction-circles', evalMode: 'touch_fraction', totalChallenges: 1, correctCount: 1, accuracy: 67, touchFractionAccuracy: 67, identifyAccuracy: 0, buildAccuracy: 0, compareAccuracy: 0, equivalentAccuracy: 0, attemptsCount: 2 }, { touches: ['wrong', 'right'] })}>Finish touch block</button>;
  } };
});
import FractionCircles from './FractionCircles';
it('hands off to a legacy task and submits only one aggregate with the touch score retained', () => {
  const onSubmit = vi.fn();
  render(<FractionCircles data={{ title: 'Fractions', instanceId: 'mixed', onEvaluationSubmit: onSubmit,
    challenges: [
      { id: 'touch', type: 'touch_fraction', numerator: 1, denominator: 2, instruction: 'Touch one half.', hint: '', narration: '' },
      { id: 'identify', type: 'identify', numerator: 1, denominator: 4, instruction: 'Name the fraction.', hint: '', narration: '' },
    ] }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Finish touch block' }));
  expect(state.writes).toHaveLength(0);
  fireEvent.change(screen.getByPlaceholderText('e.g. 3/4'), { target: { value: '1/4' } });
  fireEvent.click(screen.getByRole('button', { name: /check/i }));
  expect(state.locals).toHaveLength(2);
  expect(state.writes).toHaveLength(1);
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(state.writes[0]).toMatchObject({ score: 83.5, metrics: { evalMode: 'mixed', totalChallenges: 2, attemptsCount: 3, touchFractionAccuracy: 67, identifyAccuracy: 100 } });
});
