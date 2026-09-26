// @vitest-environment jsdom
/**
 * Periodic table on the teaching workspace: what is its own, plus its Pip surface. The generic
 * W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../components/live-activity/activityContract';
import { workspaceBinding } from '../components/live-activity/lessonWorkspacePlan';
import { PipSurfaceStore } from '../pip/PipSurfaceStore';
import PeriodicTable from './PeriodicTable';
import { periodicItems } from './chemistry-primitives/periodicTableWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

// Codes are all the generator writes: the element facts and keys come from the element table.
const BY_MODE: Record<string, any[]> = {
  explore: [{ id: 'f1', challengeType: 'explore', findBy: 'name', targetNumber: 8 },
    { id: 'f2', challengeType: 'explore', findBy: 'position', targetNumber: 11 }],
  identify: [{ id: 'n1', challengeType: 'identify', clueBy: 'symbol', targetNumber: 26 }],
  trend: [{ id: 't1', challengeType: 'trend', axis: 'size', pairNumbers: [3, 19] },
    { id: 't2', challengeType: 'trend', axis: 'valence', targetNumber: 15 }],
};
const MODES = Object.keys(BY_MODE);
const payload = (mode: string) => ({ title: 'The Periodic Table', challenges: BY_MODE[mode], supportTier: 'medium' as const });
const mount = (mode: string, pipStore?: PipSurfaceStore) =>
  mountWorkspace({ primitiveId: 'periodic-table', evalMode: mode, data: payload(mode), instanceId: 'periodic-table', pipStore });
const tap = (name: string) => fireEvent.click(document.querySelector(`[data-pip-object="element-${name}"]`)!);

it.each(MODES)('%s binds; a spoken ask publishes its key, a find does not', mode => {
  const items = periodicItems(payload(mode));
  expect(items.length).toBe(BY_MODE[mode].length);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'periodic-table', pin: mode, objectiveIds: ['o'], data: payload(mode) })).not.toBeNull();
  const task = mount(mode).state().task!;
  expect(task.task).not.toMatch(/Your turn/);
  if (mode === 'explore') expect(task.workspace!.expectedAnswer).toBeUndefined();
  else expect(task.workspace!.expectedAnswer).toBeTruthy();
});

it('the keys carry the signature misses', () => {
  expect(mount('identify').state().task!.workspace!.expectedAnswer).toMatch(/^"Iron".*letters F, e back/);
  cleanup();
  const h = mount('trend');
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/^"Potassium".*"Lithium" is wrong/);
  h.say('potassium'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/^five .*"15" is the group number/);
});

it('a wrong tap commits as a miss, rings the box, and Try again clears it; the right tap credits', () => {
  const h = mount('explore');
  expect(document.querySelector('button[aria-label="Hear the question again"]')).toBeNull();
  tap('nitrogen');
  expect(h.state().task!.phase).toBe('checked');
  expect(h.state().task!.workspace!.lastResponse?.correct).toBe(false);
  expect(h.state().task!.demand.tapped).toBe("The learner tapped Nitrogen's box.");
  expect(document.querySelector('.ring-red-400')).not.toBeNull();
  h.dispatch('retry'); h.confirmVisible();
  expect(document.querySelector('.ring-red-400')).toBeNull();
  tap('oxygen');
  expect(h.state().task!.workspace!.lastResponse?.correct).toBe(true);
  expect(document.querySelector('.ring-emerald-400')).not.toBeNull();
});

it('taps on a spoken ask do nothing', () => {
  const h = mount('identify');
  tap('iron');
  expect(h.state().task!.phase).toBe('working');
});

it('right answers complete once and submit the table metrics', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('explore');
  tap('oxygen'); h.dispatch('advance'); h.confirmVisible();
  tap('sodium'); h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'periodic-table', challengesCorrect: 2, findAccuracy: 100 });
});

it('Pip outlines the table and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('periodic-table');
  const h = mount('identify', store);
  expect(store.getActive()?.targets.map(t => t.id)).toEqual(['stimulus']);
  h.say('iron'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('no challenges is the exploration table; challenges outside a runtime show the needs-the-tutor card', () => {
  const adapter = LIVE_ADAPTERS['periodic-table'];
  expect(() => adapter.validate({ title: 'Explore' })).toThrow();
  expect(() => adapter.validate({ challenges: [{ id: 'x', challengeType: 'explore', findBy: 'name', targetNumber: 999 }] })).toThrow();
  const explore = render(<PeriodicTable data={{ title: 'Explore' }} />);
  expect(explore.container.querySelector('input[placeholder^="Search"]')).not.toBeNull();
  explore.unmount();
  const judged = render(<PeriodicTable data={payload('explore')} />);
  expect(judged.container.querySelector('[data-workspace-unbound]')).not.toBeNull();
});
