// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import SpatialScene, { type SpatialSceneChallenge, type SpatialSceneData } from '../primitives/visual-primitives/math/SpatialScene';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'scene' as string | null }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, db: {}, app: {} }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, isAudioPlaying: tutor.isAudioPlaying, activePrimitiveId: tutor.activePrimitiveId }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

beforeEach(() => { Object.assign(tutor, { isAudioPlaying: false, activePrimitiveId: 'scene' }); });
afterEach(cleanup);

const IDENTIFY: SpatialSceneChallenge = {
  id: 'id1', type: 'identify', instruction: 'Where is the bird?',
  sceneObjects: [
    { name: 'bird', image: '🐦', position: { row: 0, col: 1 } },
    { name: 'tree', image: '🌳', position: { row: 1, col: 1 } },
    { name: 'cat', image: '🐱', position: { row: 2, col: 0 } },
    { name: 'ball', image: '⚽', position: { row: 2, col: 2 } },
  ],
  targetObject: { name: 'bird', image: '🐦', position: { row: 0, col: 1 } },
  correctPosition: 'above', referenceObjectName: 'tree', options: ['above', 'below', 'beside', 'next_to'],
};
const PLACE: SpatialSceneChallenge = {
  id: 'pl1', type: 'place', instruction: 'Put the ball above the box',
  sceneObjects: [{ name: 'box', image: '📦', position: { row: 2, col: 1 } }, { name: 'tree', image: '🌳', position: { row: 0, col: 0 } }],
  targetObject: { name: 'ball', image: '⚽', position: { row: 0, col: 0 } },
  correctPosition: 'above', correctCell: { row: 1, col: 1 },
};
const data: SpatialSceneData = { title: 'Where?', gridSize: 3, gradeBand: 'K', instanceId: 'scene', challenges: [IDENTIFY, PLACE] };

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><SpatialScene data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const rerender = () => act(() => { view.rerender(ui()); });
  return { ...view, store, rerender };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Spatial Scene drives Pip from its check state', () => {
  it('points at the scene as a whole, never a word button; follows the child’s tap; celebrates only a correct answer', async () => {
    const { store, rerender, container } = mount();
    expect(container.querySelector('[data-pip-dock="scene"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['scene']);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'scene' });
    tutor.isAudioPlaying = true;
    rerender();
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'scene' });
    tutor.isAudioPlaying = false;
    rerender();
    const below = screen.getByRole('button', { name: 'Below' });
    fireEvent.pointerDown(below);
    fireEvent.click(below);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'touched' });
    expect(store.getActive()?.targets.find((t) => t.id === 'touched')?.element).toBe(below);
    const above = screen.getByRole('button', { name: 'Above' });
    fireEvent.pointerDown(above);
    fireEvent.click(above);
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(await screen.findByText(/next challenge/i)).toBeTruthy();
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('place outlines the grid, never a cell; a new challenge drops the old touch; speech for another block is ignored', async () => {
    const { store, rerender } = mount();
    const above = screen.getByRole('button', { name: 'Above' });
    fireEvent.pointerDown(above);
    fireEvent.click(above);
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    fireEvent.click(await screen.findByText(/next challenge/i));
    expect(store.getActive()?.scopeId).toBe('pl1');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'scene' });
    tutor.activePrimitiveId = 'someone-else';
    tutor.isAudioPlaying = true;
    rerender();
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'scene' });
    tutor.activePrimitiveId = 'scene';
    tutor.isAudioPlaying = false;
    rerender();
    tutor.isAudioPlaying = true;
    rerender();
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'scene' });
  });

  it('unregisters on unmount', () => {
    const { store, unmount } = mount();
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
