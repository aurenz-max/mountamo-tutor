// @vitest-environment jsdom
/**
 * di-shapes' open build (`build_shape`) on the shared teaching workspace, mounted the way a lesson mounts it: an empty
 * dot grid under the stated ask, "I'm done!" commits the board's own verdict as a gesture with its miss, Try again
 * keeps the shape, a lever mark lands on the child's own shape, and a fixed shape is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());
// The live line is the shared layer's (its leak rules are tested there): here only what the board asks it.
const watch = vi.hoisted(() => vi.fn());
vi.mock('../../build-layer/buildLayer', () => ({ useBuildWatcher: (o: unknown) => { watch(o); return ''; } }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { Pt } from '../math/shapeMakeBuild';
import { BUILD_WITNESSES } from './diShapesBuild';
import { shapeItem } from './diShapesLevers';

beforeEach(() => { installRuntimeTimers();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) }); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); watch.mockReset(); });

const mount = (...shapes: Array<Parameters<typeof shapeItem>[0]>) => {
  const challenges = shapes.map((s, i) => shapeItem(s, 'build_shape', `b${i + 1}`, 'medium'));
  return mountWorkspace({ primitiveId: 'di-shapes', evalMode: 'build_shape', instanceId: 'shapes',
    data: { title: 'Shapes', description: 'Make it.', challengeType: 'build_shape', challenges } });
};
const build = (h: WorkspaceHarness, pts: Pt[]) => { for (const p of [...pts, pts[0]]) h.touch(`dot-${p.x}-${p.y}`); };
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));

it('opens bare: an empty grid under the stated ask, no lever on, nothing judged on screen', () => {
  const h = mount('hexagon');
  expect(q(h, '[data-build-ask]')[0].textContent).toBe('Make a hexagon.');
  expect(q(h, '[data-learner-shape], [data-corner], [data-lever]')).toHaveLength(0);
  expect(h.state().task!.workspace!.levers!.every(l => !l.pulled)).toBe(true);
  expect(h.state().task!.demand).toMatchObject({ kind: 'build_shape', cornersPlaced: 0, sides: 0 });
  h.close();
});

it('a wrong shape commits too_few_sides, Try again keeps it, a tick lever marks it, and a hexagon passes', () => {
  const h = mount('hexagon', 'triangle');
  build(h, BUILD_WITNESSES.pentagon[0]);
  expect(h.state().task!.demand).toMatchObject({ sides: 5, shapeClosed: 'yes' });
  h.press("I'm done!");
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'too_few_sides' });
  expect(q(h, '[data-build-verdict="not-right"]')).toHaveLength(1);

  h.dispatch('retry');
  expect(q(h, '[data-corner]')).toHaveLength(5);
  h.dispatch('pull_lever', { lever: 'side_ticks' });
  expect(q(h, '[data-lever="side_ticks"]')).toHaveLength(5);
  expect(h.view.container.textContent).not.toMatch(/\b5\b|\bfive\b|\bsix\b/i);

  h.press('Clear Shape');
  build(h, BUILD_WITNESSES.hexagon[1]);
  h.press("I'm done!");
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.find(a => a.itemId === 'b1' && a.correct)).toMatchObject({ correct: true, levers: ['side_ticks'] });
  // The observer advances; the next item opens on an empty grid.
  h.dispatch('advance'); h.confirmVisible();
  expect(q(h, '[data-build-ask]')[0].textContent).toBe('Make a triangle.');
  expect(q(h, '[data-corner]')).toHaveLength(0);
  h.close();
});

it('a square for "rectangle" is made_square; make_triangle opens an ungraded triangle build, then the rectangle returns', () => {
  const h = mount('rectangle');
  build(h, BUILD_WITNESSES.square[0]);
  h.press("I'm done!");
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'made_square' });
  h.dispatch('retry');
  h.dispatch('pull_lever', { lever: 'make_triangle' });
  expect(q(h, '[data-build-ask]')[0].textContent).toBe('Make a triangle.');
  expect(q(h, '[data-corner]')).toHaveLength(0);
  build(h, BUILD_WITNESSES.triangle[0]);
  h.press("I'm done!");
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'b1~simpler', correct: true });
  h.close();
});

it('the watcher is never told the shape name and never allowed a number', () => {
  const h = mount('pentagon');
  build(h, BUILD_WITNESSES.pentagon[0].slice(0, 3));
  const req = (watch.mock.calls.at(-1)?.[0] as { request: { task: string; numbers: string; neverSay: string[] } }).request;
  expect(req.numbers).toBe('never');
  expect(req.task).not.toMatch(/pentagon/i);
  expect(req.neverSay).toContain('pentagon');
  h.close();
});
