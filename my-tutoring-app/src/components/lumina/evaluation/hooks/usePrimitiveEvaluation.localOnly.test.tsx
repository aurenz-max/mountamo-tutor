// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePrimitiveEvaluation } from './usePrimitiveEvaluation';
import type { LetterWorkshopMetrics } from '../types';

const { submitEvaluation } = vi.hoisted(() => ({ submitEvaluation: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../contexts/EvaluationContext', () => ({ useEvaluationContext: () => ({ submitEvaluation }) }));
vi.mock('../../contexts/ExhibitContext', () => ({ useExhibitContext: () => ({ getObjectivesForComponent: () => [], manifestItems: [] }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const metrics: LetterWorkshopMetrics = { type: 'letter-workshop', challengeType: 'copy', totalChallenges: 1,
  correctCount: 1, attemptsCount: 1, firstTryCount: 1, hintsViewed: 0, overallAccuracy: 100, averageAttemptsPerChallenge: 1 };

describe('Provisional evaluation isolation', () => {
  it('calls the local consumer once without context submission or unmount persistence', () => {
    const onSubmit = vi.fn();
    const view = renderHook(() => usePrimitiveEvaluation<LetterWorkshopMetrics>({ primitiveType: 'letter-workshop',
      instanceId: 'practice', localOnly: true, autoSubmitOnUnmount: true, onSubmit }));
    act(() => { view.result.current.submitResult(true, 100, metrics, { attempts: [] }); });
    act(() => { view.result.current.submitResult(true, 100, metrics); });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(view.result.current.hasSubmitted).toBe(true);
    view.unmount();
    expect(submitEvaluation).not.toHaveBeenCalled();
  });
  it('retains normal adaptive submission by default', async () => {
    const view = renderHook(() => usePrimitiveEvaluation<LetterWorkshopMetrics>({ primitiveType: 'letter-workshop', instanceId: 'normal' }));
    await act(async () => { view.result.current.submitResult(true, 100, metrics); });
    expect(submitEvaluation).toHaveBeenCalledTimes(1);
  });
});
