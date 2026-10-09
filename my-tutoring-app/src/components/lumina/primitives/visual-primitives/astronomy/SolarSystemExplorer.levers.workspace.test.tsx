// @vitest-environment jsdom
/**
 * The solar-system-explorer levers on the shared teaching workspace, through the real component, TeachingSession and
 * LiveLessonRuntime, on the saved payloads: `pull_lever` changes the sky and the scene fact in one commit and names no
 * planet, the next spoken attempt records the lever, a refused pull changes nothing, and an easier item is ungraded
 * and returns to the full item, which alone is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import compare from '../../../components/live-activity/runtime/testing/w1-payloads/solar-system-explorer.compare_attribute.json';
import orbital from '../../../components/live-activity/runtime/testing/w1-payloads/solar-system-explorer.orbital_reasoning.json';
import identify from '../../../components/live-activity/runtime/testing/w1-payloads/solar-system-explorer.identify.json';
import order from '../../../components/live-activity/runtime/testing/w1-payloads/solar-system-explorer.order_from_sun.json';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

type Payload = { data: Record<string, any> };
/** The payload with its challenges cut to the listed ids, in order. */
const only = (p: Payload, ...ids: string[]) => ({ ...p.data, challenges: ids.map(id => p.data.challenges.find((c: any) => c.id === id)) });
const mount = (data: Record<string, unknown>, mode: string) =>
  mountWorkspace({ primitiveId: 'solar-system-explorer', evalMode: mode, data, instanceId: 'solar' });
type H = ReturnType<typeof mount>;
const levers = (h: H) => h.state().task!.workspace!.levers ?? [];
const drawn = (h: H, kind: string) => h.view.container.querySelectorAll(`[data-lever="${kind}"]`);
const PLANETS = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

it('biggest: star_mark and size_row change the sky and the scene in one commit, name no planet, and ride the next attempt', () => {
  const h = mount(only(compare as Payload, 'ssc-1'), 'compare_attribute');
  expect(levers(h).map(l => [l.id, l.kind])).toEqual([['star_mark', 'help'], ['size_row', 'help'], ['two_planets', 'simplify']]);
  expect(drawn(h, 'star-mark')).toHaveLength(0);
  h.say('the Sun'); h.feedback('incorrect', 'retry'); h.confirmVisible();

  h.dispatch('pull_lever', { lever: 'star_mark' });
  expect(drawn(h, 'star-mark')).toHaveLength(1);
  expect(h.state().task!.demand.onScreen).toMatch(/star outline/);
  h.dispatch('pull_lever', { lever: 'size_row' });
  const row = drawn(h, 'size-row');
  expect(row).toHaveLength(1);
  expect(row[0].textContent).toBe('');
  expect(row[0].querySelectorAll('[data-size-of]')).toHaveLength(8);
  const onScreen = String(h.state().task!.demand.onScreen);
  expect(onScreen).toMatch(/true sizes/);
  for (const p of PLANETS) expect(onScreen).not.toContain(p);

  h.say('Jupiter'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['star_mark', 'size_row'] });
});

it('a refused pull changes nothing: not the sky, the levers, the scene or the attempts', () => {
  const h = mount(only(compare as Payload, 'ssc-1'), 'compare_attribute');
  h.dispatch('pull_lever', { lever: 'star_mark' });
  const before = { levers: JSON.stringify(levers(h)), demand: JSON.stringify(h.state().task!.demand),
    attempts: h.state().task!.workspace!.attempts.length, html: h.view.container.innerHTML };
  for (const id of ['star_mark', 'trip_model', 'no_such_lever']) {
    expect(h.dispatch('pull_lever', { lever: id }).status).not.toBe('committed');
    expect(JSON.stringify(levers(h))).toBe(before.levers);
    expect(JSON.stringify(h.state().task!.demand)).toBe(before.demand);
    expect(h.state().task!.workspace!.attempts).toHaveLength(before.attempts);
    expect(h.view.container.innerHTML).toBe(before.html);
  }
});

it('shortest_year: two_planets opens an ungraded pair race, then the full sky comes back and alone is credited', () => {
  const h = mount(only(orbital as Payload, 'ssc-2'), 'orbital_reasoning');
  const spotlit = () => Array.from(h.view.container.querySelectorAll('[data-body-id] circle[stroke-dasharray="6 3"]'))
    .map(c => c.closest('[data-body-id]')!.getAttribute('data-body-id')).sort();
  expect(spotlit()).toEqual([]);
  h.say('Neptune'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  h.dispatch('pull_lever', { lever: 'trip_model' });
  expect(drawn(h, 'trip-model')).toHaveLength(1);
  expect(drawn(h, 'trip-model')[0].textContent).toBe('');

  h.dispatch('pull_lever', { lever: 'two_planets' });
  const task = h.state().task!;
  expect(task.itemId).toBe('ssc-2~simpler');
  expect(task.workspace!.practice).toEqual({ returnsTo: 'ssc-2' });
  expect(task.workspace!.expectedAnswer).toMatch(/^Venus\./);
  expect(h.offer('pull_lever')).toBeUndefined();
  expect(spotlit()).toEqual(['neptune', 'venus']);
  expect(drawn(h, 'trip-model')).toHaveLength(0);

  h.say('Venus'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('ssc-2');
  expect(spotlit()).toEqual([]);
  expect(h.view.container.querySelector('circle[stroke="#34d399"]')).toBeNull();
  h.say('Mercury'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['ssc-2', false, false], ['ssc-2~simpler', true, true], ['ssc-2', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['trip_model', 'two_planets'] });
  expect(h.view.container.querySelector('[data-body-id="mercury"] circle[stroke="#34d399"]')).not.toBeNull();
});

it('identify: close_up draws the glowing planet big with no name, and every label stays withheld', () => {
  const h = mount(only(identify as Payload, 'ssc-3'), 'identify');
  expect(levers(h).map(l => l.id)).toEqual(['star_mark', 'close_up']);
  h.dispatch('pull_lever', { lever: 'close_up' });
  expect(drawn(h, 'close-up')).toHaveLength(1);
  expect(drawn(h, 'close-up')[0].textContent).toBe('');
  expect(Array.from(h.view.container.querySelectorAll('svg text')).map(t => t.textContent)).not.toContain('Earth');
  expect(String(h.state().task!.demand.onScreen)).not.toContain('Earth');
});

it('position: first_ring brightens the first ring only; fewer_rings asks a nearer position', () => {
  const h = mount(only(order as Payload, 'ssc-3', 'ssc-1'), 'order_from_sun');
  expect(levers(h).map(l => l.id)).toEqual(['star_mark', 'first_ring', 'fewer_rings']);
  h.dispatch('pull_lever', { lever: 'first_ring' });
  const ring = drawn(h, 'first-ring');
  expect(ring).toHaveLength(1);
  expect(Number(ring[0].getAttribute('r'))).toBeCloseTo(0.39 * 180);
  h.dispatch('pull_lever', { lever: 'fewer_rings' });
  expect(h.state().task!.itemId).toBe('ssc-3~simpler');
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/^Earth\./);
  expect(drawn(h, 'first-ring')).toHaveLength(0);
});
