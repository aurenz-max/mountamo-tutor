// @vitest-environment jsdom
/**
 * States of matter on the teaching workspace: what is its own, plus its Pip surface. The generic
 * W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { PipSurfaceStore } from '../../../pip/PipSurfaceStore';

beforeEach(() => {
  installRuntimeTimers();
  // jsdom has no canvas; the particle view draws nothing and the tests read the workspace.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const CHALLENGES = {
  observe: { id: 'o1', challengeType: 'observe', substanceKey: 'water', startTemp: 50 },
  predict: { id: 'p1', challengeType: 'predict', kind: 'predict_state', substanceKey: 'wax', startTemp: 20, targetTemp: 200 },
  change: { id: 'p2', challengeType: 'predict', kind: 'predict_change', substanceKey: 'mercury', startTemp: 100, targetTemp: 400 },
  compare: { id: 'c1', challengeType: 'compare', kind: 'melt_first', pairKeys: ['coconutOil', 'butter'], startTemp: 4 },
} as const;
const MODE: Record<string, string> = { observe: 'observe', predict: 'predict', change: 'predict', compare: 'compare' };
const KEYS: Record<string, RegExp> = { observe: /^liquid\./, predict: /^liquid\. .*"solid", the state it is in now, is not it/, change: /^boiling\./, compare: /^Coconut Oil\./ };
const data = (...challenges: unknown[]): Record<string, unknown> => ({ title: 'Heat and matter', gradeBand: '3-5', challenges });
const mount = (d: Record<string, unknown>, mode: string, pipStore?: PipSurfaceStore) =>
  mountWorkspace({ primitiveId: 'states-of-matter', evalMode: mode, data: d, instanceId: 'states', pipStore });

it.each(Object.keys(CHALLENGES))('%s binds: the code-computed answer is the spoken key', name => {
  const d = data(CHALLENGES[name as keyof typeof CHALLENGES]);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'states-of-matter', pin: MODE[name], objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mount(d, MODE[name]);
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(KEYS[name]);
  expect(h.state().task!.task).not.toMatch(/Your turn/);
});

it('observe prints no state or temperature until credit, and the hard tier carries no rule', () => {
  const h = mount(data(CHALLENGES.observe), 'observe');
  expect(h.state().task!.demand.rule).toMatch(/slide past each other are a liquid/);
  expect(screen.queryByText(/°C/)).toBeNull();
  expect(screen.queryByRole('button', { name: /hear the question|check|next/i })).toBeNull();
  h.say('gas'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(screen.queryByText(/°C/)).toBeNull();
  h.say('a liquid'); h.feedback('correct');
  expect(screen.getAllByText(/Water at 50°C/).length).toBeGreaterThan(0);
  cleanup();
  expect(mount({ ...data(CHALLENGES.observe), supportTier: 'hard' }, 'observe').state().task!.demand.rule).toBeUndefined();
});

it('right answers complete once and submit per-mode accuracy', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(data(CHALLENGES.predict, CHALLENGES.compare), 'predict|compare');
  h.say('liquid'); h.feedback('correct', 'advance'); h.confirmVisible();
  h.say('coconut oil'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ challengesCorrect: 2, challengesTotal: 2, predictAccuracy: 100, compareAccuracy: 100 });
});

it('Pip outlines the bench and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('states');
  const h = mount(data(CHALLENGES.observe), 'observe', store);
  expect(store.getActive()?.targets.map(t => t.id)).toEqual(['stimulus']);
  h.say('liquid'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses a lesson with nothing askable', () => {
  const adapter = LIVE_ADAPTERS['states-of-matter'];
  expect(() => adapter.validate(data({ ...CHALLENGES.observe, substanceKey: 'unobtanium' }))).toThrow();
  expect(() => adapter.validate(data())).toThrow();
  expect(adapter.validate(data(CHALLENGES.observe))).toBeTruthy();
});
