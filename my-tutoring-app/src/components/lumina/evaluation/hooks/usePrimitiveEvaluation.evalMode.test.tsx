// @vitest-environment jsdom
/**
 * The submitted eval mode is a catalog key (handoff slice 3): the hook normalises
 * `metrics.evalMode` once at the boundary, and the normalised key is what the
 * result carries, so capture and the backend both read it.
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePrimitiveEvaluation } from './usePrimitiveEvaluation';
import type { TenFrameMetrics } from '../types';

const { submitEvaluation, manifest } = vi.hoisted(() => ({
  submitEvaluation: vi.fn().mockResolvedValue(undefined),
  manifest: { items: [] as Array<{ componentId: string; instanceId: string; config?: Record<string, unknown> }> },
}));
vi.mock('../contexts/EvaluationContext', () => ({ useEvaluationContext: () => ({ submitEvaluation }) }));
vi.mock('../../contexts/ExhibitContext', () => ({ useExhibitContext: () => ({ getObjectivesForComponent: () => [], manifestItems: manifest.items }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); manifest.items = []; });

const metrics = (evalMode: string): TenFrameMetrics => ({ type: 'ten-frame', evalMode, challengesCompleted: 5, challengesTotal: 5,
  subitizeAccuracy: 0, subitizeAverageTime: 0, makeTenCorrect: 0, makeTenTotal: 0, usedMakeTenStrategy: false,
  counterPlacementEfficiency: true, twoColorDecompositionsExplored: 0, attemptsCount: 5 } as TenFrameMetrics);

async function submitted(reported: string, instanceId = 'tf-1') {
  const onSubmit = vi.fn();
  const view = renderHook(() => usePrimitiveEvaluation<TenFrameMetrics>({ primitiveType: 'ten-frame', instanceId, onSubmit }));
  await act(async () => { view.result.current.submitResult(true, 80, metrics(reported)); });
  return onSubmit.mock.calls[0][0].metrics.evalMode as string;
}

describe('usePrimitiveEvaluation submits a catalog eval mode', () => {
  it('maps a challenge type to its one catalog mode (TF-6 class) and keeps a catalog mode as is', async () => {
    expect(await submitted('add')).toBe('operate');
    expect(await submitted('split')).toBe('decompose');
    expect(await submitted('subitize')).toBe('subitize');
  });
  it('lets a single-key manifest pin for this instance win, and ignores blends, mixed and other instances', async () => {
    manifest.items = [{ componentId: 'ten-frame', instanceId: 'tf-1', config: { targetEvalMode: 'operate' } }];
    expect(await submitted('subitize')).toBe('operate');
    manifest.items = [{ componentId: 'ten-frame', instanceId: 'tf-1', config: { targetEvalMode: 'operate|subitize' } }];
    expect(await submitted('subitize')).toBe('subitize');
    manifest.items = [{ componentId: 'ten-frame', instanceId: 'tf-1', config: { targetEvalMode: 'mixed' } }];
    expect(await submitted('add')).toBe('operate');
    manifest.items = [{ componentId: 'ten-frame', instanceId: 'tf-other', config: { targetEvalMode: 'operate' } }];
    expect(await submitted('subitize')).toBe('subitize');
  });
  it('keeps an unknown value and warns once in development', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await submitted('default', 'tf-a')).toBe('default');
    expect(await submitted('default', 'tf-b')).toBe('default');
    expect(warn.mock.calls.filter(([m]) => String(m).includes('ten-frame submitted "default"'))).toHaveLength(1);
    warn.mockRestore();
  });
});
