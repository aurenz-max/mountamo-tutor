// @vitest-environment jsdom
/**
 * spatial-path levers mounted the way a lesson mounts them. A pull changes the screen and the scene fact in one
 * commit and marks no route of the map; the next attempt records the lever; a repeat pull changes nothing; the easier
 * map is ungraded and the full item comes back blank after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { selectSpatialPathChallenges } from '../../../service/math/gemini-spatial-path';
import type { SpatialPathChallenge, SpatialPathData } from './SpatialPath';
import { threeRoutes } from './spatialPathLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const [THROUGH] = selectSpatialPathChallenges(3);
const DATA: SpatialPathData = { title: 'Path Explorer', description: 'Routes', challengeType: 'choose_route', challenges: [THROUGH], gradeBand: 'K' };
const mount = () => mountWorkspace({ primitiveId: 'spatial-path', evalMode: 'choose_route', instanceId: 'routes',
  data: DATA as unknown as Record<string, unknown> });
const numberOf = (c: SpatialPathChallenge, id: string) => c.routes.findIndex(r => r.id === id) + 1;
const choose = (h: WorkspaceHarness, n: number) => { h.touch(`route-${n}`); h.press('Animate this route'); };
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const wrongRoute = (c: SpatialPathChallenge) => c.routes.findIndex(r => r.id !== c.correctRouteId) + 1;
/** The map's key on screen: a green route or a relation label. */
const keyShown = (h: WorkspaceHarness) => q(h, 'path[stroke="#34d399"]').length + (h.view.container.textContent!.match(/Route \d: /g)?.length ?? 0);

it('help: a miss pulls the word picture in one commit, apart from the map; the next attempt records it; a repeat pull changes nothing', () => {
  const h = mount();
  expect(levers(h)).toEqual([['word_picture', false], ['watch_each', false], ['three_routes', false]]);
  choose(h, wrongRoute(THROUGH));
  const miss = attempts(h).at(-1)!.miss!;
  expect(nextLever(h.state().task!.workspace!.levers!, miss)).toBe('word_picture');
  h.dispatch('retry');
  const shownBefore = keyShown(h);
  const receipt = h.dispatch('pull_lever', { lever: 'word_picture' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toBe('Beside the map, a small picture shows a ball going through a hoop.');
  const picture = q(h, '[data-lever="word_picture"]');
  expect(picture).toHaveLength(1);
  // Not on the map, and no route number in it.
  expect(picture[0].closest('svg[aria-label^="Routes"]')).toBeNull();
  expect(picture[0].textContent).not.toMatch(/\d/);
  expect(keyShown(h)).toBe(shownBefore);
  const before = { demand: JSON.stringify(h.state().task!.demand), levers: levers(h), html: h.view.container.innerHTML };
  expect(h.dispatch('pull_lever', { lever: 'word_picture' }).status).toBe('blocked');
  expect({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h), html: h.view.container.innerHTML }).toEqual(before);
  choose(h, numberOf(THROUGH, THROUGH.correctRouteId));
  expect(attempts(h).at(-1)).toMatchObject({ itemId: THROUGH.id, correct: true, levers: ['word_picture'] });
  h.close();
});

it('help: watch each walks every route with one dot each and marks none', () => {
  const h = mount();
  choose(h, wrongRoute(THROUGH));
  h.dispatch('retry');
  expect(h.dispatch('pull_lever', { lever: 'watch_each' }).status).toBe('committed');
  expect(q(h, '[data-lever="watch_each"]')).toHaveLength(THROUGH.routes.length);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/A dot walks each of the 5 routes in turn/);
  expect(keyShown(h)).toBe(0);
  h.close();
});

it('simplify: the easier map is ungraded, Try again keeps it, and the full item comes back blank', () => {
  const h = mount();
  choose(h, wrongRoute(THROUGH));
  h.dispatch('retry');
  const easier = threeRoutes(THROUGH)!;
  const receipt = h.dispatch('pull_lever', { lever: 'three_routes' });
  expect(receipt.status).toBe('committed');
  expect(h.state().task!.itemId).toBe(easier.id);
  expect(h.state().task!.task).toBe(easier.instruction);
  expect(q(h, '[data-pip-object^="route-"]')).toHaveLength(3);
  expect(h.state().task!.workspace!.levers ?? []).toEqual([]);
  choose(h, wrongRoute(easier));
  expect(attempts(h).at(-1)).toMatchObject({ itemId: easier.id, correct: false, practice: true });
  h.dispatch('retry');
  expect(h.state().task!.itemId).toBe(easier.id);
  choose(h, numberOf(easier, easier.correctRouteId));
  expect(attempts(h).at(-1)).toMatchObject({ itemId: easier.id, correct: true, practice: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(THROUGH.id);
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No route chosen yet' });
  expect(q(h, '[data-pip-object^="route-"]')).toHaveLength(5);
  choose(h, numberOf(THROUGH, THROUGH.correctRouteId));
  expect(attempts(h).at(-1)).toMatchObject({ itemId: THROUGH.id, correct: true });
  h.close();
});
