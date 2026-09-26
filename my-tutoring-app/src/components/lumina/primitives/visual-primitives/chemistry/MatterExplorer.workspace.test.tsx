// @vitest-environment jsdom
/**
 * Matter explorer on the teaching workspace: what is its own, plus its Pip surface. The generic
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

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const OBJECTS = [
  { id: 'rock', name: 'rock', state: 'solid', canChangeState: false,
    properties: { color: 'grey', texture: 'rough', transparency: 'opaque', flexibility: 'rigid', shape: 'keeps_shape', weight: 'heavy' } },
  { id: 'milk', name: 'milk', state: 'liquid', canChangeState: false,
    properties: { color: 'white', texture: 'smooth', transparency: 'opaque', flexibility: 'flows', shape: 'takes_container', weight: 'medium' } },
  { id: 'air', name: 'air', state: 'gas', canChangeState: false,
    properties: { color: 'clear', texture: 'smooth', transparency: 'transparent', flexibility: 'flows', shape: 'fills_space', weight: 'light' } },
  { id: 'egg', name: 'egg', state: 'solid', canChangeState: false, everydayChange: 'cook',
    properties: { color: 'brown', texture: 'smooth', transparency: 'opaque', flexibility: 'rigid', shape: 'keeps_shape', weight: 'light' } },
];
const CHALLENGES = {
  sort: { id: 'sort-rock', type: 'sort', instruction: 'Say the state.', objectId: 'rock' },
  property: { id: 'property-milk', type: 'property', instruction: 'In a cup?', objectId: 'milk' },
  change: { id: 'change-egg', type: 'change', instruction: 'Can it go back?', objectId: 'egg' },
  mystery: { id: 'mystery-air', type: 'mystery', instruction: 'Guess the state.', objectId: 'air' },
} as const;
const KEYS: Record<string, RegExp> = { sort: /^solid\./, property: /^it takes the shape of the cup\./, change: /^it is changed for ever\./, mystery: /^gas\./ };
const data = (...challenges: unknown[]): Record<string, unknown> => ({ title: 'Matter', objects: OBJECTS, challenges, gradeBand: 'K-1' });
const mount = (d: Record<string, unknown>, mode: string, pipStore?: PipSurfaceStore) =>
  mountWorkspace({ primitiveId: 'matter-explorer', evalMode: mode, data: d, instanceId: 'matter', pipStore });

it.each(Object.keys(CHALLENGES))('%s binds: the code-computed answer is the spoken key', mode => {
  const d = data(CHALLENGES[mode as keyof typeof CHALLENGES]);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'matter-explorer', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mount(d, mode);
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(KEYS[mode]);
  expect(h.state().task!.task).not.toMatch(/Your turn/);
});

it('mystery keeps the object secret from the screen and the tutor until credit', () => {
  const h = mount(data(CHALLENGES.mystery), 'mystery');
  const told = JSON.stringify({ task: h.state().task!.task, demand: h.state().task!.demand, key: h.state().task!.workspace!.expectedAnswer });
  expect(told).not.toMatch(/\bair\b/);
  expect(screen.getByText('a secret thing')).toBeTruthy();
  h.say('liquid'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(screen.getByText('a secret thing')).toBeTruthy();
  h.say('a gas'); h.feedback('correct');
  expect(screen.getByText('It was the air — a gas')).toBeTruthy();
});

it('the easy tier carries the rule, the hard tier does not', () => {
  expect(mount(data(CHALLENGES.sort), 'sort').state().task!.demand.rule).toMatch(/A solid keeps its own shape/);
  cleanup();
  expect(mount({ ...data(CHALLENGES.sort), supportTier: 'hard' }, 'sort').state().task!.demand.rule).toBeUndefined();
});

it('the state badge waits for credit; right answers complete once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(data(CHALLENGES.sort, CHALLENGES.change), 'sort|change');
  expect(screen.queryByText(/Solid$/)).toBeNull();
  expect(screen.queryByRole('button', { name: /hear the question|check|next/i })).toBeNull();
  h.say('solid'); h.feedback('correct', 'advance'); h.confirmVisible();
  h.say('for ever'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ sortingCorrect: 1, sortingTotal: 1, changesJudged: 1, changesTotal: 1 });
});

it('Pip outlines the bench and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('matter');
  const h = mount(data(CHALLENGES.sort), 'sort', store);
  expect(store.getActive()?.targets.map(t => t.id)).toEqual(['stimulus']);
  h.say('solid'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses a lesson with nothing askable', () => {
  const adapter = LIVE_ADAPTERS['matter-explorer'];
  expect(() => adapter.validate({ ...data(CHALLENGES.sort), objects: [{ ...OBJECTS[0], name: 'solid rock' }] })).toThrow();
  expect(() => adapter.validate(data())).toThrow();
  expect(adapter.validate(data(CHALLENGES.sort))).toBeTruthy();
});
