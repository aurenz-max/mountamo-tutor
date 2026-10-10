// @vitest-environment jsdom
/**
 * spatial-path on the teaching workspace (W1, plain shape): what is its own. A route is a checked gesture (the map
 * compares route ids); no route number, and no unchecked route's movement, reaches the tutor; a wrong check names the
 * movement the route made, stays closed, keeps the key hidden, and Try again clears the map; a right check completes
 * once. The generic W1 contract runs in `runtime/workspaceContract.test.tsx`.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { validateSpatialPathData } from '../../../components/live-activity/adapters/spatialPathLive';
import { getComponentById } from '../../../service/manifest/catalog';
import { selectSpatialPathChallenges } from '../../../service/math/gemini-spatial-path';
import type { SpatialPathData } from './SpatialPath';
import { routeMiss } from './spatialPathWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const [THROUGH, AROUND] = selectSpatialPathChallenges(3);
const DATA: SpatialPathData = { title: 'Path Explorer', description: 'Routes', challengeType: 'choose_route',
  challenges: [THROUGH, AROUND], gradeBand: 'K' };
const MODES = (getComponentById('spatial-path')?.evalModes ?? []).map(m => m.evalMode);

const mount = (mode: string) => mountWorkspace({ primitiveId: 'spatial-path', evalMode: mode, instanceId: 'routes',
  data: DATA as unknown as Record<string, unknown> });
const numberOf = (c: typeof THROUGH, routeId: string) => c.routes.findIndex(r => r.id === routeId) + 1;
const choose = (h: WorkspaceHarness, n: number) => { h.touch(`route-${n}`); h.press('Animate this route'); };
const advance = (h: WorkspaceHarness) => { h.dispatch('advance'); h.confirmVisible(); };
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const green = (h: WorkspaceHarness) => h.view.container.querySelectorAll('path[stroke="#34d399"]').length;

it('the catalog declares choose_route', () => { expect(MODES).toEqual(['choose_route']); });

it.each(MODES)('%s binds as a gesture item with no key, no scripted cue and no Next of its own', mode => {
  const h = mount(mode);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(THROUGH.instruction);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  const packet = JSON.stringify(h.packet());
  // Neither the correct route's number nor any route's movement beside its number reaches the tutor.
  expect(packet).not.toMatch(/route-(over|under|through|around|across)|correctRouteId|Route \d: /);
  expect(packet).not.toMatch(new RegExp(`route ${numberOf(THROUGH, THROUGH.correctRouteId)}\\b`, 'i'));
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.view.container.textContent).not.toMatch(/Next route|See results/);
  h.close();
});

it('a wrong route names its movement, stays closed with the key hidden, and Try again clears the map; a right one completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('choose_route');
  const wrong = THROUGH.routes.findIndex(r => r.id !== THROUGH.correctRouteId);
  choose(h, wrong + 1);
  expect(last(h)).toMatchObject({ correct: false, miss: `went_${THROUGH.routes[wrong].relation}` });
  expect(green(h)).toBe(0);
  expect(h.view.container.textContent).not.toMatch(/Try another route/);
  // Closed until Try again: a touch changes nothing.
  const work = h.state().task!.demand.learnerWork;
  h.touch(`route-${numberOf(THROUGH, THROUGH.correctRouteId)}`);
  expect(h.state().task!.demand.learnerWork).toBe(work);
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No route chosen yet' });
  choose(h, numberOf(THROUGH, THROUGH.correctRouteId));
  expect(last(h)).toMatchObject({ correct: true });
  expect(green(h)).toBeGreaterThan(0);
  advance(h);
  expect(h.state().task!.itemId).toBe(AROUND.id);
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No route chosen yet' });
  choose(h, numberOf(AROUND, AROUND.correctRouteId));
  advance(h);
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work2, , evidence] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'spatial-path', challengeType: 'choose_route', correctCount: 2 });
  expect(work2.teachingAttempts).toHaveLength(3);
  expect(evidence.phases).toEqual([expect.objectContaining({ itemId: THROUGH.id, miss: `went_${THROUGH.routes[wrong].relation}` })]);
  h.close();
});

it('routeMiss names the chosen movement; the validator refuses an uncheckable challenge', () => {
  expect(routeMiss(THROUGH, 'route-over')).toBe('went_over');
  expect(routeMiss(THROUGH, THROUGH.correctRouteId)).toBeUndefined();
  expect(validateSpatialPathData(DATA)).toBe(DATA);
  expect(() => validateSpatialPathData({ ...DATA, challenges: [{ ...THROUGH, correctRouteId: 'route-nowhere' }] })).toThrow();
  expect(() => validateSpatialPathData({ ...DATA, challenges: [{ ...THROUGH, routes: THROUGH.routes.slice(0, 2) }] })).toThrow();
});
