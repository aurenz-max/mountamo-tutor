// @vitest-environment jsdom
/**
 * `commitCheck` keeps a plain primitive's books on the scripted path (handoff 19, slice 4): the attempt is
 * counted, a correct check records the base result, and a richer record the primitive wrote survives.
 * The workspace path's books are covered through real primitives (the fraction-circles mixed chain's
 * aggregate attempts and accuracy come from these records).
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useScriptedProgress } from './useWorkspaceProgress';

const challenges = [{ id: 'a' }, { id: 'b' }];
const options = { challenges, getChallengeId: (c: { id: string }) => c.id, instanceId: 'test',
  workspace: { current: null }, assignment: (c: { id: string }) => ({ id: c.id, task: 'Do it.', response: 'gesture' as const }) };

it('counts every check and records a correct one, keeping the primitive\'s own fields', () => {
  const { result } = renderHook(() => useScriptedProgress(options));
  act(() => result.current.commitCheck('3 pieces', false, 'too_many'));
  expect(result.current.currentAttempts).toBe(1);
  expect(result.current.results).toEqual([]);
  act(() => result.current.recordResult({ challengeId: 'a', correct: true, attempts: 2, score: 80 }));
  act(() => result.current.commitCheck('2 pieces', true));
  expect(result.current.currentAttempts).toBe(2);
  expect(result.current.results).toEqual([{ challengeId: 'a', correct: true, attempts: 2, score: 80 }]);
});
