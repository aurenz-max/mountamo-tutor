// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import MeasureLab, { type MeasureLabChallenge, type MeasureLabData } from '../primitives/visual-primitives/math/MeasureLab';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'lab' }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, ...tutor }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

beforeEach(() => { vi.useFakeTimers(); tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'lab'; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const balance: MeasureLabChallenge = {
  id: 'bal', type: 'balance_predict', prompt: 'Which is heavier?',
  left: { id: 'apple', name: 'the apple', emoji: '🍎', weight: 2 },
  right: { id: 'feather', name: 'the feather', emoji: '🪶', weight: 1 },
  expectedChoice: 'apple',
};
const capacity: MeasureLabChallenge = {
  id: 'cap', type: 'capacity_predict', prompt: 'Which holds more?', unitName: 'cups',
  containerA: { id: 'jug', name: 'the jug', shape: 'tall', capacity: 3 },
  containerB: { id: 'bowl', name: 'the bowl', shape: 'wide', capacity: 5 },
  expectedChoice: 'bowl',
};
const pour: MeasureLabChallenge = {
  id: 'pour', type: 'pour_count', prompt: 'How many cups fill the pot?', unitName: 'cups',
  container: { id: 'pot', name: 'the pot', shape: 'round', capacity: 2 }, expectedCount: 2, options: [1, 2, 3],
};
const order: MeasureLabChallenge = {
  id: 'ord', type: 'order_capacity', prompt: 'Put the jars in order.',
  containers: [
    { id: 'j1', name: 'jar 1', shape: 'round', capacity: 6, filled: 4 },
    { id: 'j2', name: 'jar 2', shape: 'round', capacity: 6, filled: 1 },
    { id: 'j3', name: 'jar 3', shape: 'round', capacity: 6, filled: 3 },
  ],
  expectedOrder: ['j2', 'j3', 'j1'],
};
const data = (challenges: MeasureLabChallenge[]): MeasureLabData => ({
  title: 'Measure', description: '', challengeType: challenges[0].type, challenges, instanceId: 'lab',
});

function mount(input: MeasureLabData) {
  const store = new PipSurfaceStore();
  store.setActive('lab');
  const ui = () => <PipSurfaceContext.Provider value={store}><MeasureLab data={input} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => { tutor.isAudioPlaying = on; view.rerender(ui()); };
  return { store, speak, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id) ?? [];
const tap = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('Measure Lab drives Pip from its own test state', () => {
  it('heavier: outlines the pair before the prediction, the scale after; watches the beam settle; celebrates only the verdict', () => {
    const { store, speak, container } = mount(data([balance, order]));
    expect(container.querySelector('[data-pip-dock="lab"]')).not.toBeNull();
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'objects' });
    speak(false);
    tap(/the apple/);
    expect(ids(store)).not.toContain('objects');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'scale' });
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'scale' });
    speak(false);
    tap(/Put the apple on/); tap(/Put the feather on/);
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'scale' });
    act(() => { vi.advanceTimersByTime(900); });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(store.getActive()?.scopeId).toBe('ord');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });

  it('holds more: outlines both containers, never one; watches both fill', () => {
    const { store, speak } = mount(data([capacity]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'containers' });
    expect(ids(store)).toEqual(expect.arrayContaining(['container-jug', 'container-bowl']));
    speak(false);
    tap(/the jug/);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'container-jug' });
    tap(/Pour cups into both/);
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'containers' });
    act(() => { vi.advanceTimersByTime(900); });
    // A wrong prediction is not a celebration.
    expect(pose(store)?.phase).toBe('working');
  });

  it('how many cups: the container while pouring, the cups row once full — never a number', () => {
    const { store, speak } = mount(data([pour, order]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'container' });
    speak(false);
    const cups = screen.getAllByRole('button', { name: 'Pour one in' });
    fireEvent.click(cups[0]);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'container' });
    fireEvent.click(cups[1]);
    expect(ids(store)).toEqual(expect.arrayContaining(['count-1', 'count-2', 'count-3']));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'cups' });
    speak(false);
    tap(/^2$/);
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('least to most: outlines the jars as a group and follows a tapped jar', () => {
    const { store, speak } = mount(data([order]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'containers' });
    speak(false);
    tap(/jar 3/);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'container-j3' });
  });

  it('speech for another block is not a cue; unmount clears the surface', () => {
    tutor.activePrimitiveId = 'other-block';
    const { store, speak, unmount } = mount(data([balance]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
