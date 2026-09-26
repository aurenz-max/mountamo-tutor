// @vitest-environment jsdom
/**
 * 3D shape explorer on the teaching workspace: what is its own, plus its Pip surface. The generic
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
import { buildThreeDShapeItems, canonicalRiddleCluesFor } from './threeDShapeExplorerScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const CHALLENGES = {
  identify_3d: { id: 'i1', type: 'identify-3d', shape3d: 'cube' },
  '2d_vs_3d': { id: 'd1', type: '2d-vs-3d', mixedShapes: [{ name: 'circle', is3d: false }, { name: 'cube', is3d: true }] },
  match_real_world: { id: 'm1', type: 'match-to-real-world', matchPairs: [{ realWorldObject: 'ball', emoji: '⚽', shape3d: 'sphere' }] },
  faces_properties: { id: 'f1', type: 'faces-and-properties', displayShape: 'cube', propertyQuestions: [{ propertyKey: 'flatFaces' }] },
  shape_riddle: { id: 'r1', type: 'shape-riddle', shape3d: 'sphere', clues: canonicalRiddleCluesFor('sphere') },
} as const;
const data = (...challenges: unknown[]): Record<string, unknown> => ({ title: 'Solids', gradeBand: 'K', challenges });

it.each(Object.keys(CHALLENGES))('%s binds: the spoken answer is the key, printed only after credit', mode => {
  const d = data(CHALLENGES[mode as keyof typeof CHALLENGES]);
  const [item] = buildThreeDShapeItems(d.challenges as never).items;
  expect(item, `no askable ${mode} item`).toBeTruthy();
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: '3d-shape-explorer', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
  const h = mountWorkspace({ primitiveId: '3d-shape-explorer', evalMode: mode, data: d });
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(new RegExp(`^${item.answer}\\.`));
  expect(document.querySelector('p.text-emerald-300')).toBeNull();
});

it('a wrong answer reopens with nothing revealed; right answers complete once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: '3d-shape-explorer', evalMode: 'mixed', data: data(CHALLENGES.identify_3d, CHALLENGES.shape_riddle) });
  h.say('square'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.state().task!.phase).toBe('working');
  expect(document.querySelector('p.text-emerald-300')).toBeNull();
  h.say('cube'); h.feedback('correct');
  expect(screen.getByText('cube')).toBeTruthy();
  h.dispatch('advance'); h.confirmVisible();
  h.say('sphere'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit).toHaveBeenCalledOnce();
});

it('the replay button asks for the question silently, as the host, never the answer', () => {
  mountWorkspace({ primitiveId: '3d-shape-explorer', evalMode: 'identify_3d', data: data(CHALLENGES.identify_3d) });
  fireEvent.click(screen.getByRole('button', { name: 'Hear the question again' }));
  const [text, options] = seam.send.mock.calls.at(-1)!;
  expect(text).toContain('What shape is it?');
  expect(text).not.toMatch(/cube/);
  expect(options).toMatchObject({ silent: true, author: 'host' });
});

it('Pip points at the solid as a whole and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('solids');
  const h = mountWorkspace({ primitiveId: '3d-shape-explorer', evalMode: 'identify_3d', data: data(CHALLENGES.identify_3d),
    instanceId: 'solids', pipStore: store });
  expect(store.getActive()?.targets.map(t => t.id)).toEqual(['stimulus']);
  h.say('cube'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses a lab with nothing it can ask', () => {
  const adapter = LIVE_ADAPTERS['3d-shape-explorer'];
  expect(() => adapter.validate(data({ id: 'x', type: 'identify-3d', shape3d: 'hexagon' }))).toThrow();
  expect(adapter.validate(data(CHALLENGES.identify_3d))).toBeTruthy();
});
