// @vitest-environment jsdom
/**
 * The ten-frame build levers on the shared teaching workspace (handoff 18 B1), mounted the way a lesson
 * mounts it. A pull changes the frame in the same commit; the easier build is ungraded practice that
 * returns to the full item, and only the full item is credited, with its levers recorded.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const data = (showCount: boolean) => ({ title: 'Build', mode: 'single', gradeBand: 'K',
  showOptions: { showCount, showEquation: false, showEmptyCount: false, allowFlip: false },
  challenges: [7, 3].map((n, i) => ({ id: `b${i}`, type: 'build', targetCount: n, instruction: `Put ${n} counters on the ten frame!` })) });
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
/** Tap `n` empty cells, then let the frame settle and check itself. */
const place = (h: WorkspaceHarness, n: number) => { for (let c = 0; c < n; c++) h.touch(`cell-${c}`); h.settle(3500); };
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';

it('without a starting count, pulling running_count shows the count on the frame in the same commit', () => {
  const h = mountWorkspace({ primitiveId: 'ten-frame', evalMode: 'build', data: data(false), instanceId: 'frame' });
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([['running_count', false], ['five_frame', false], ['smaller_build', false]]);
  place(h, 6);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: false });
  const before = text(h);
  h.dispatch('pull_lever', { lever: 'running_count' });
  expect(text(h)).not.toBe(before);
  expect(levers(h).find(l => l.id === 'running_count')!.pulled).toBe(true);
  h.dispatch('pull_lever', { lever: 'five_frame' });
  expect(h.view.container.querySelector('[data-lever="five-frame"]')).toBeTruthy();
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/\b7\b/);
  h.close();
});

it('the easier build is ungraded practice, then the full build is credited with its lever', () => {
  const h = mountWorkspace({ primitiveId: 'ten-frame', evalMode: 'build', data: data(true), instanceId: 'frame' });
  // Easy / no tier: the running count starts pulled, and that is not a pull.
  expect(levers(h).find(l => l.id === 'running_count')!.pulled).toBe(true);
  place(h, 6);
  h.dispatch('pull_lever', { lever: 'smaller_build' });
  expect(h.state().task).toMatchObject({ itemId: 'b0~smaller' });
  expect(h.state().task!.workspace!.practice).toEqual({ returnsTo: 'b0' });
  place(h, 4);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'b0' });
  place(h, 7);
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['b0', false, false], ['b0~smaller', true, true], ['b0', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['smaller_build'], assisted: true });
  h.close();
});

it('a wrong placement records what the frame showed, and the observer answers that miss with its lever', () => {
  const h = mountWorkspace({ primitiveId: 'ten-frame', evalMode: 'build', data: data(false), instanceId: 'frame' });
  place(h, 6);                                                      // 7 to build: one short
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'one_short' });
  expect(observerLever(h.state(), true)).toBe('running_count');
  h.close();
});

it('the running count already showing, a frame filled past the number opens the five-frame', () => {
  const h = mountWorkspace({ primitiveId: 'ten-frame', evalMode: 'build', data: data(true), instanceId: 'frame' });
  place(h, 10);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'filled_frame' });
  expect(observerLever(h.state(), true)).toBe('five_frame');
  h.close();
});
