// @vitest-environment jsdom
/**
 * The 3d-shape-explorer levers (`/add-support-tiers`, class sweep 2026-10-08) on the shared teaching workspace, mounted
 * the way a lesson mounts it. A pull changes the screen and the scene fact in one commit and states no answer; the next
 * spoken attempt carries the lever; a refused pull changes nothing; an easier count is ungraded and gives the full item
 * back blank, which alone is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const mount = (mode: string, ...challenges: Record<string, unknown>[]) => mountWorkspace({
  primitiveId: '3d-shape-explorer', evalMode: mode, instanceId: 'solids', data: { title: 'Solids', gradeBand: 'K', challenges } });
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const onScreen = (h: WorkspaceHarness) => String(h.state().task!.demand.onScreen ?? '');
const snapshot = (h: WorkspaceHarness) => ({ html: h.view.container.innerHTML, levers: levers(h), fact: onScreen(h),
  attempts: h.state().task!.workspace!.attempts.length, item: h.state().task!.itemId });

it('identify: see_through draws dashed back edges and the fact says so in one commit; the next try carries the lever', () => {
  const h = mount('identify_3d', { id: 'i1', type: 'identify-3d', shape3d: 'cube' });
  expect(levers(h)).toEqual([['see_through', false], ['face_prints', false]]);
  h.say('square'); h.feedback('incorrect', 'retry');
  h.say('box'); h.feedback('incorrect', 'retry');
  // Two wrong answers: the observer pulls help.
  expect(observerLever(h.state(), true)).not.toBeNull();
  expect(q(h, '[data-see-through]')).toHaveLength(0);
  expect(onScreen(h)).toBe('');
  expect(h.dispatch('pull_lever', { lever: 'see_through' }).status).toBe('committed');
  expect(q(h, '[data-see-through]')).toHaveLength(3);
  expect(onScreen(h)).toMatch(/Dashed lines .* show its back/);
  expect(onScreen(h)).not.toMatch(/cube/i);
  expect(h.view.container.textContent).not.toMatch(/cube/i);
  h.say('cube'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['see_through'] });
  h.close();
});

it('identify: face_prints draws each flat face once, unnumbered', () => {
  const h = mount('identify_3d', { id: 'i1', type: 'identify-3d', shape3d: 'rectangular-prism' });
  h.dispatch('pull_lever', { lever: 'face_prints' });
  expect(q(h, '[data-face-print]')).toHaveLength(6);
  expect(h.view.container.textContent).not.toMatch(/\b6\b|six|prism/i);
  h.close();
});

it('a refused pull changes nothing: a lever pulled twice, a lever the item does not have', () => {
  // A sphere has nothing to print: face_prints is not offered there.
  const sphere = mount('identify_3d', { id: 'i1', type: 'identify-3d', shape3d: 'sphere' });
  expect(levers(sphere)).toEqual([['see_through', false]]);
  sphere.close();
  const h = mount('identify_3d', { id: 'i1', type: 'identify-3d', shape3d: 'cube' });
  h.dispatch('pull_lever', { lever: 'see_through' });
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'see_through' }).status).not.toBe('committed');
  expect(h.dispatch('pull_lever', { lever: 'model_property' }).status).not.toBe('committed');
  expect(h.dispatch('pull_lever', { lever: 'fewer_faces' }).status).not.toBe('committed');
  expect(snapshot(h)).toEqual(before);
  h.close();
});

it('faces: fewer_faces opens an ungraded count on a solid with fewer flat faces, then the full cube is credited', () => {
  const h = mount('faces_properties', { id: 'f1', type: 'faces-and-properties', displayShape: 'cube', propertyQuestions: [{ propertyKey: 'flatFaces' }] });
  const full = h.state().task!.itemId;
  expect(levers(h)).toEqual([['tint_surfaces', false], ['face_prints', false], ['fewer_faces', false]]);
  h.say('three'); h.feedback('incorrect', 'retry');
  expect(h.dispatch('pull_lever', { lever: 'fewer_faces' }).status).toBe('committed');
  const task = h.state().task!;
  expect(task.itemId).toBe(`${full}~simpler`);
  expect(task.workspace!.practice).toEqual({ returnsTo: full });
  expect(task.workspace!.expectedAnswer).toMatch(/^two\./);
  expect(q(h, '[data-practice-item]')).toHaveLength(1);
  expect(h.view.container.textContent).toMatch(/cylinder/i);
  expect(task.workspace!.levers ?? []).toEqual([]);
  // A retry on the easier item keeps it.
  h.say('three'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(`${full}~simpler`);
  expect(q(h, '[data-practice-item]')).toHaveLength(1);
  h.say('two'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  expect(q(h, '[data-practice-item]')).toHaveLength(0);
  expect(h.view.container.textContent).toMatch(/cube/i);
  expect(h.view.container.textContent).not.toMatch(/\bsix\b/);
  h.say('six'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [`${full}~simpler`, false, true], [`${full}~simpler`, true, true], [full, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['fewer_faces'] });
  h.close();
});

it('faces: tint_surfaces colours flat faces and the curved surface; model_property shows a different solid stacked', () => {
  const h = mount('faces_properties', { id: 'f1', type: 'faces-and-properties', displayShape: 'cylinder',
    propertyQuestions: [{ propertyKey: 'canStack' }] });
  expect(levers(h)).toEqual([['tint_surfaces', false], ['model_property', false]]);
  h.dispatch('pull_lever', { lever: 'tint_surfaces' });
  expect(q(h, '[data-pip-object="stimulus"] [data-surface="flat"]')).toHaveLength(2);
  expect(q(h, '[data-pip-object="stimulus"] [data-surface="curved"]')).toHaveLength(1);
  h.dispatch('pull_lever', { lever: 'model_property' });
  expect(q(h, '[data-lever="model_property"] [data-model-picture="stacked"]')).toHaveLength(1);
  expect(onScreen(h)).toMatch(/a cube stacked on another one like it\. It is not the learner's solid\./);
  expect(onScreen(h)).not.toMatch(/\byes\b/i);
  h.close();
});

it('match: solid_shelf draws all five solids unlabeled; the model card is a different object and solid', () => {
  const h = mount('match_real_world', { id: 'm1', type: 'match-to-real-world', matchPairs: [{ realWorldObject: 'can', shape3d: 'cylinder' }] });
  expect(levers(h)).toEqual([['solid_shelf', false], ['model_object', false]]);
  h.say('can'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'solid_shelf' });
  expect(q(h, '[data-shelf-solid]')).toHaveLength(5);
  h.dispatch('pull_lever', { lever: 'model_object' });
  expect(onScreen(h)).toMatch(/a ball beside a sphere/);
  expect(h.view.container.textContent).not.toMatch(/cylinder|cone/i);
  h.say('cylinder'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ assisted: true, levers: ['solid_shelf', 'model_object'] });
  h.close();
});

it('2d_vs_3d: edge_view turns a flat circle to a thin line, a cube stays drawn; no fact says flat or solid', () => {
  const h = mount('2d_vs_3d', { id: 'd1', type: '2d-vs-3d', mixedShapes: [{ name: 'circle', is3d: false }, { name: 'cube', is3d: true }] });
  h.dispatch('pull_lever', { lever: 'edge_view' });
  expect(q(h, '[data-edge-view="line"]')).toHaveLength(1);
  expect(onScreen(h)).not.toMatch(/flat|solid/i);
  h.say('flat'); h.feedback('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(q(h, '[data-edge-view]')).toHaveLength(0);
  h.dispatch('pull_lever', { lever: 'edge_view' });
  expect(q(h, '[data-edge-view="turned"]')).toHaveLength(1);
  expect(onScreen(h)).not.toMatch(/flat|solid/i);
  h.close();
});

it('easy counts start with the tint on screen; a starting lever is not recorded on the attempt', () => {
  const h = mount('faces_properties', { id: 'f1', type: 'faces-and-properties', displayShape: 'cube', supportTier: 'easy',
    propertyQuestions: [{ propertyKey: 'flatFaces' }] });
  expect(levers(h)[0]).toEqual(['tint_surfaces', true]);
  expect(q(h, '[data-surface="flat"]').length).toBeGreaterThan(0);
  h.say('six'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers ?? []).toEqual([]);
  h.close();
});
