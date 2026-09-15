// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import HundredsChart, { type HundredsChartChallenge, type HundredsChartData } from '../primitives/visual-primitives/math/HundredsChart';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'chart' }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, ...tutor }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'chart'; });

const highlight: HundredsChartChallenge = { id: 'h1', type: 'highlight_sequence', instruction: 'Count by 2s.', skipValue: 2, startNumber: 2,
  givenCells: [], correctCells: [2, 4, 6, 8, 10], correctAnswer: '', options: [], hint: 'Try again.' };
const findSkip: HundredsChartChallenge = { id: 'f1', type: 'find_skip_value', instruction: 'What are we counting by?', skipValue: 5, startNumber: 5,
  givenCells: [5, 10], correctCells: [5, 10], correctAnswer: '5', options: ['2', '5', '10'], hint: 'Look again.' };
const data = (challenges: HundredsChartChallenge[]): HundredsChartData => ({ title: 'Chart', challenges, gridMax: 10, gradeBand: '1', instanceId: 'chart' });

function mount(input: HundredsChartData) {
  const store = new PipSurfaceStore();
  store.setActive('chart');
  const ui = () => <PipSurfaceContext.Provider value={store}><HundredsChart data={input} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => { tutor.isAudioPlaying = on; view.rerender(ui()); };
  const paint = (n: number) => {
    fireEvent.mouseDown(view.container.querySelector(`[data-pip-object="cell-${n}"]`)!);
    fireEvent.mouseUp(window);
  };
  return { store, speak, paint, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const before = (a: Element | null, b: Element | null) => !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('Hundreds Chart drives Pip from its check state', () => {
  it('points at the chart as a whole, never a cell; watches painted cells; celebrates only the full sequence', () => {
    const { store, speak, paint } = mount(data([highlight, findSkip]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'chart' });
    speak(false);
    paint(4);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'cell-4' });
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'cell-4' });
    for (const n of [2, 6, 8, 10]) paint(n);
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    // Praise that began on this challenge never makes Pip point into the next one.
    speak(true);
    fireEvent.click(screen.getByRole('button', { name: /next challenge/i }));
    expect(store.getActive()?.scopeId).toBe('f1');
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
  });

  it('find the skip: points at the chart, not an option; the dock sits between them; an option tap is watched', () => {
    const { store, speak, container, unmount } = mount(data([findSkip, highlight]));
    const dock = container.querySelector('[data-pip-dock="chart"]');
    expect(before(container.querySelector('[data-pip-object="chart"]'), dock)).toBe(true);
    expect(before(dock, container.querySelector('[data-pip-object="option-2"]'))).toBe(true);
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'chart' });
    speak(false);
    fireEvent.click(container.querySelector('[data-pip-object="option-5"]')!);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'option-5' });
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });

  it('ignores speech for another block', () => {
    tutor.activePrimitiveId = 'other';
    tutor.isAudioPlaying = true;
    const { store } = mount(data([highlight]));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });
});
