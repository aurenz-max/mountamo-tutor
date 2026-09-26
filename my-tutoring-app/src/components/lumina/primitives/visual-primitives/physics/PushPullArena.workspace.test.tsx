// @vitest-environment jsdom
/**
 * Push-pull arena on the teaching workspace: what is its own, plus its Pip surface. The generic
 * W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { PipSurfaceStore } from '../../../pip/PipSurfaceStore';
import { itemsFromChallenges } from './pushPullArenaScript';

beforeEach(() => {
  installRuntimeTimers();
  // jsdom has no canvas; the arena draws nothing and the tests read the workspace.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  // design's force slider (Radix) measures itself.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const CHALLENGES = {
  observe: { id: 'o1', type: 'observe', instruction: 'Tap Go and watch.', objectName: 'ball', objectWeight: 2, objectEmoji: '⚽',
    surface: 'wood', pushStrength: 5, pushDirection: 'pull' },
  predict: { id: 'p1', type: 'predict', instruction: 'Will it move?', objectName: 'toy car', objectWeight: 2, objectEmoji: '🚗',
    surface: 'wood', pushStrength: 8, pushDirection: 'push' },
  compare: { id: 'c1', type: 'compare', instruction: 'Which slides farther?', objectName: 'feather', objectWeight: 1, objectEmoji: '🪶',
    object2Name: 'rock', object2Weight: 9, object2Emoji: '🪨', surface: 'wood', pushStrength: 5, pushDirection: 'push' },
  design: { id: 'd1', type: 'design', instruction: 'What push does it need?', objectName: 'balloon', objectWeight: 1, objectEmoji: '🎈',
    surface: 'ice', pushStrength: 5, pushDirection: 'push', goalDescription: 'Move it across the ice.' },
} as const;
const data = (...challenges: unknown[]): Record<string, unknown> => ({ title: 'Forces', description: 'Pushes and pulls', theme: 'toys', challenges });
const mount = (d: Record<string, unknown>, mode: string, pipStore?: PipSurfaceStore) =>
  mountWorkspace({ primitiveId: 'push-pull-arena', evalMode: mode, data: d, instanceId: 'arena', pipStore });

it.each(Object.keys(CHALLENGES))('%s binds: the code-computed answer is the spoken key', mode => {
  const d = data(CHALLENGES[mode as keyof typeof CHALLENGES]);
  const [item] = itemsFromChallenges(d.challenges as never);
  expect(item, `no decisive ${mode} item`).toBeTruthy();
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'push-pull-arena', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mount(d, mode);
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(new RegExp(`^${item.spokenAnswer}\\.`));
  expect(h.state().task!.task).not.toMatch(/Your turn/);
});

it('observe is not ready for an answer until the learner presses Go', () => {
  const h = mount(data(CHALLENGES.observe), 'observe');
  expect(h.state().task!.demand.presentation).toBe('not ready');
  fireEvent.click(screen.getByRole('button', { name: 'Go!' }));
  expect(h.state().task!.demand.presentation).toBe('ready');
});

it('a wrong answer reopens without running the push; right answers complete once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(data(CHALLENGES.predict, CHALLENGES.compare), 'mixed');
  h.say('stays'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.state().task!.phase).toBe('working');
  expect(screen.queryByRole('button', { name: 'Moving…' })).toBeNull();
  h.say('moves'); h.feedback('correct', 'advance'); h.confirmVisible();
  h.say('feather'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit).toHaveBeenCalledOnce();
});

it('Pip outlines the arena and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('arena');
  const h = mount(data(CHALLENGES.predict), 'predict', store);
  expect(store.getActive()?.targets.map(t => t.id)).toEqual(['stimulus']);
  h.say('moves'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses an arena with nothing decisive to ask', () => {
  const adapter = LIVE_ADAPTERS['push-pull-arena'];
  expect(() => adapter.validate(data({ ...CHALLENGES.compare, object2Weight: 1 }))).toThrow();
  expect(adapter.validate(data(CHALLENGES.observe))).toBeTruthy();
});
