// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import LengthLab, { type LengthLabChallenge, type LengthLabData } from '../primitives/visual-primitives/math/LengthLab';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'length' }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, ...tutor }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'length'; });

const ch = (id: string, type: LengthLabChallenge['type'], over: Partial<LengthLabChallenge> = {}): LengthLabChallenge => ({
  id, type, instruction: 'Measure.', hint: '', narration: '',
  objectName0: 'pencil', objectLength0: 5, objectColor0: '#f00', objectName1: 'crayon', objectLength1: 3, objectColor1: '#0f0',
  correctAnswer: 'longer', correctUnitCount: 5, ...over,
});
const lab = (challenges: LengthLabChallenge[]): LengthLabData => ({
  title: 'Lengths', description: '', unitType: 'cubes', gradeBand: 'K', challenges, instanceId: 'length',
});

function mount(input: LengthLabData) {
  const store = new PipSurfaceStore();
  store.setActive('length');
  const ui = (next: LengthLabData) => <PipSurfaceContext.Provider value={store}><LengthLab data={next} /></PipSurfaceContext.Provider>;
  return { store, ui, ...render(ui(input)) };
}
const speak = (on: boolean, rerender: (ui: React.ReactElement) => void, ui: () => React.ReactElement) => {
  tutor.isAudioPlaying = on;
  rerender(ui());
};
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Length Lab drives Pip from its check state', () => {
  it('compare: points at the objects, follows the child’s choice, celebrates only a right answer', () => {
    const data = lab([ch('c1', 'compare'), ch('c2', 'compare')]);
    const { store, rerender, ui } = mount(data);
    const again = () => ui(data);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
    speak(true, rerender, again);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'objects' });
    speak(false, rerender, again);
    const right = screen.getByRole('button', { name: 'pencil is longer' });
    fireEvent.pointerDown(right);
    fireEvent.click(right);
    expect(store.getActive()?.targets.find((t) => t.id === 'touched')?.element).toBe(right);
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });

    // Praise still playing when the child moves on does not point into the next item.
    speak(true, rerender, again);
    fireEvent.click(screen.getByRole('button', { name: /Next Challenge/ }));
    expect(store.getActive()?.scopeId).toBe('c2');
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
  });

  it('a wrong answer is watched, not celebrated; speech for another block is ignored', () => {
    const data = lab([ch('c1', 'compare'), ch('c2', 'compare')]);
    const { store, rerender, ui } = mount(data);
    const wrong = screen.getByRole('button', { name: 'pencil is shorter' });
    fireEvent.pointerDown(wrong);
    fireEvent.click(wrong);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'touched' });
    tutor.activePrimitiveId = 'another-block';
    speak(true, rerender, () => ui(data));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'touched' });
  });

  it('two units: points at the object and the row being laid, then the whole workspace for the question', () => {
    const data = lab([ch('t1', 'two_unit_compare', { unitType: 'cubes', unitTypeB: 'paper_clips', correctUnitCountB: 2 })]);
    const { store, container, rerender, ui } = mount(data);
    const again = () => ui(data);
    speak(true, rerender, again);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'measure-a' });
    const lay = () => {
      const plus = screen.getAllByRole('button', { name: '+' }).pop()!;
      fireEvent.click(plus);
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    };
    lay();
    rerender(again());
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'measure-b' });
    lay();
    rerender(again());
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'workspace' });
    expect(container.querySelector('[data-pip-dock="length"]')).not.toBeNull();
  });

  it('guess first: the guess row is outlined as a whole, then the object to measure', () => {
    const data = lab([ch('e1', 'estimate_then_tile', { estimateOptions: [3, 5, 8] })]);
    const { store, rerender, ui, unmount } = mount(data);
    speak(true, rerender, () => ui(data));
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'workspace' });
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'measure' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
