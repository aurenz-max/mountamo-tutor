// @vitest-environment jsdom
/**
 * Spatial scene on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
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
import { getComponentById } from '../../../service/manifest/catalog';
import type { SpatialSceneChallenge } from './SpatialScene';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const objects = [
  { name: 'box', image: '📦', position: { row: 2, col: 1 } },
  { name: 'tree', image: '🌳', position: { row: 0, col: 0 } },
];
const ball = { name: 'ball', image: '⚽', position: { row: 0, col: 0 } };
const IDENTIFY: SpatialSceneChallenge = { id: 'id1', type: 'identify', instruction: 'Where is the tree?', sceneObjects: objects,
  targetObject: objects[1], correctPosition: 'above', referenceObjectName: 'box', options: ['above', 'below'] };
const DIRECTIONS: SpatialSceneChallenge = { id: 'fd1', type: 'follow_directions', instruction: 'Follow the steps', sceneObjects: objects,
  targetObject: ball, correctPosition: 'above', steps: [
    { instruction: 'Put the ball above the box', targetObject: ball, correctCell: { row: 1, col: 1 } },
    { instruction: 'Put the cat beside the tree', targetObject: { ...ball, name: 'cat', image: '🐱' }, correctCell: { row: 0, col: 1 } },
  ] };
const DESCRIBE_SCENE: SpatialSceneChallenge = { id: 'ds1', type: 'describe_scene', instruction: 'Tell where the ball is',
  sceneObjects: [{ ...ball, position: { row: 2, col: 1 } }, { name: 'box', image: '📦', position: { row: 0, col: 1 } }],
  targetObject: { ...ball, position: { row: 2, col: 1 } }, correctPosition: 'in_front_of', referenceObjectName: 'box',
  scenePerspective: 'viewer_depth' };
const scene = (challenges: SpatialSceneChallenge[]) => ({ title: 'Where?', gridSize: 3, gradeBand: 'K', challenges });
const cell = (h: ReturnType<typeof mountWorkspace>, row: number, col: number) =>
  act(() => { fireEvent.click(h.view.container.querySelector(`[data-pip-object="cell-${row}-${col}"]`)!); });

it('every catalog mode binds', () => {
  for (const mode of (getComponentById('spatial-scene')?.evalModes ?? []).map(m => m.evalMode)) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'spatial-scene', pin: mode, objectiveIds: ['o'],
      data: scene([IDENTIFY]) }), mode).not.toBeNull();
  }
});

it('a word choice is checked by the scene; the key is not published', () => {
  const h = mountWorkspace({ primitiveId: 'spatial-scene', evalMode: 'identify', data: scene([IDENTIFY]) });
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  act(() => { fireEvent.click(screen.getByRole('button', { name: 'Below' })); });
  act(() => { fireEvent.click(screen.getByRole('button', { name: /check/i })); });
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect((screen.getByRole('button', { name: 'Above' }) as HTMLButtonElement).disabled).toBe(true);
});

it('follow directions: a wrong step is a checked miss that keeps the placed steps; the last right step succeeds', () => {
  const h = mountWorkspace({ primitiveId: 'spatial-scene', evalMode: 'follow_directions', data: scene([DIRECTIONS]) });
  cell(h, 1, 1);
  expect(h.state().task!.demand).toMatchObject({ step: '2 of 2' });
  cell(h, 2, 2);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  h.dispatch('retry');
  expect(h.view.container.querySelector('[data-pip-object="cell-1-1"]')!.textContent).toContain('⚽');
  cell(h, 0, 1);
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('describe_scene is spoken, judged on relation and reference; the model shows only once credited; completes once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  // Two items: a one-item deck shows its summary the moment the description is credited.
  const h = mountWorkspace({ primitiveId: 'spatial-scene', evalMode: 'mixed', data: scene([DESCRIBE_SCENE, IDENTIFY]) });
  const key = h.state().task!.workspace!.expectedAnswer!;
  expect(key).toContain('"in front of"');
  expect(key).toContain('box');
  expect(h.state().task!.task).not.toMatch(/in front of/);
  expect(screen.queryByText(/is in front of the box/)).toBeNull();
  h.say('The ball is behind the box.'); h.feedback('incorrect', 'retry');
  h.say('The ball is in front of the box.'); h.feedback('correct');
  expect(screen.getByText(/is in front of the box/)).toBeTruthy();
  h.dispatch('advance'); h.confirmVisible();
  act(() => { fireEvent.click(screen.getByRole('button', { name: 'Above' })); });
  act(() => { fireEvent.click(screen.getByRole('button', { name: /check/i })); });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
});

it('the adapter refuses a word choice whose options lack the answer', () => {
  expect(() => LIVE_ADAPTERS['spatial-scene'].validate(scene([{ ...IDENTIFY, options: ['below', 'beside'] }]))).toThrow();
});
