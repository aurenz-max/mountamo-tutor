// @vitest-environment jsdom
/**
 * Habitat diorama on the teaching workspace: what is its own, plus its Pip surface. The generic
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

const ORGANISMS = [
  { id: 'oak', commonName: 'Oak Tree', role: 'producer', imagePrompt: 'oak', position: { x: '15%', y: '30%' }, description: 'Makes food.', adaptations: ['leaves'] },
  { id: 'hare', commonName: 'Snowshoe Hare', role: 'primary-consumer', imagePrompt: 'hare', position: { x: '40%', y: '65%' }, description: 'Eats leaves.', adaptations: ['feet'] },
  { id: 'fox', commonName: 'Red Fox', role: 'secondary-consumer', imagePrompt: 'fox', position: { x: '68%', y: '55%' }, description: 'Hunts hare.', adaptations: ['ears'] },
  { id: 'fungus', commonName: 'Shelf Fungus', role: 'decomposer', imagePrompt: 'fungus', position: { x: '28%', y: '80%' }, description: 'Breaks down wood.', adaptations: ['enzymes'] },
];
const CHALLENGES = {
  observe: { id: 'observe', type: 'observe', prompt: 'It makes its own food from sunlight.', explanation: 'Trees make food from sunlight.',
    focusOrganismId: 'oak', optionOrganismIds: ['oak', 'hare', 'fox'] },
  connect: { id: 'connect', type: 'connect', prompt: 'Complete the hare feeding relationship.', explanation: 'The fox hunts the hare.', fromId: 'hare', toId: 'fox' },
  predict: { id: 'predict', type: 'predict', prompt: 'Think about the change.', explanation: 'Fewer foxes means more hares.',
    disruptionEvent: 'A sickness removes most of the foxes', affectedOrganismId: 'hare', expectedTrend: 'increase', optionOrganismIds: ['hare', 'oak', 'fungus'] },
  restore: { id: 'restore', type: 'restore', prompt: 'Return the decomposer to a viable layer.', explanation: 'Dead wood collects by soil.',
    restorationEntityId: 'fungus', restorationZone: 'ground' },
  defend: { id: 'defend', type: 'defend', prompt: 'The fox depends on the oak tree.', explanation: 'The hare eats the oak and the fox eats the hare.',
    evidenceChoices: [{ id: 'e1', text: 'The hare eats oak leaves and the fox eats hares.' }, { id: 'e2', text: 'Foxes have large pointed ears.' }],
    correctEvidenceId: 'e1' },
} as const;
const data = (...challenges: unknown[]): Record<string, unknown> => ({
  primitiveType: 'habitat-diorama', gradeBand: '3-5',
  habitat: { name: 'Forest Web', biome: 'forest', climate: 'cool and wet', description: 'A connected forest.' },
  organisms: ORGANISMS,
  relationships: [{ fromId: 'hare', toId: 'fox', type: 'predation', description: 'Fox hunts hare.' },
    { fromId: 'oak', toId: 'hare', type: 'predation', description: 'Hare eats oak.' }],
  environmentalFeatures: [{ id: 'stream', name: 'Stream', description: 'Fresh water.', position: { x: '80%', y: '75%' } }],
  challenges,
});
const SPOKEN: Record<string, string> = { observe: 'Oak Tree', predict: 'Snowshoe Hare', defend: 'The hare eats oak leaves' };

it.each(Object.keys(CHALLENGES))('%s binds: the spoken key is published, the tap key is not', mode => {
  const d = data(CHALLENGES[mode as keyof typeof CHALLENGES]);
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'habitat-diorama', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: 'habitat-diorama', evalMode: mode, data: d, instanceId: 'habitat' });
  const workspace = h.state().task!.workspace!;
  if (SPOKEN[mode]) expect(workspace.expectedAnswer).toMatch(new RegExp(`^${SPOKEN[mode]}`));
  else {
    expect(workspace.expectedAnswer).toBeUndefined();
    // The key is not in the scene: every organism and every zone is listed, none singled out.
    expect(JSON.stringify(h.state().task!.demand)).not.toMatch(mode === 'connect' ? /Red Fox is/ : /\bground\b(?! layer)/i);
  }
});

it('connect: tapping the start is exploration; a wrong destination is a miss Try again reopens; the right one completes once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'habitat-diorama', evalMode: 'connect|restore', data: data(CHALLENGES.connect, CHALLENGES.restore), instanceId: 'habitat' });
  h.press('Snowshoe Hare');
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  h.press('Oak Tree');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: false, response: 'Connected Snowshoe Hare to Oak Tree.' });
  h.dispatch('retry'); h.confirmVisible();
  h.press('Red Fox');
  h.dispatch('advance'); h.confirmVisible();
  h.press('Ground layer');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true, response: 'Placed Shelf Fungus in the Ground layer zone.' });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'habitat-diorama', totalChallenges: 2, correctChallenges: 2, modelChallenges: 2 });
});

it('a spoken item keeps the explanation hidden until credit', () => {
  const h = mountWorkspace({ primitiveId: 'habitat-diorama', evalMode: 'observe', data: data(CHALLENGES.observe), instanceId: 'habitat' });
  expect(screen.queryByText('Trees make food from sunlight.')).toBeNull();
  expect(screen.queryByRole('button', { name: /check|next|submit|hear the question/i })).toBeNull();
  h.say('Red Fox'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(screen.queryByText('Trees make food from sunlight.')).toBeNull();
  h.say('the oak tree'); h.feedback('correct');
  expect(screen.getByText('Trees make food from sunlight.')).toBeTruthy();
});

it('Pip outlines the habitat and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('habitat');
  const h = mountWorkspace({ primitiveId: 'habitat-diorama', evalMode: 'observe', data: data(CHALLENGES.observe), instanceId: 'habitat', pipStore: store });
  expect(store.getActive()?.targets.map(t => t.id)).toEqual(['stimulus']);
  h.say('Oak Tree'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses a habitat with nothing askable; no challenges stays the exploration diorama', () => {
  const adapter = LIVE_ADAPTERS['habitat-diorama'];
  expect(() => adapter.validate(data({ ...CHALLENGES.connect, fromId: 'fox', toId: 'hare' }))).toThrow();
  expect(() => adapter.validate(data())).toThrow();
  expect(adapter.validate(data(CHALLENGES.observe))).toBeTruthy();
});
