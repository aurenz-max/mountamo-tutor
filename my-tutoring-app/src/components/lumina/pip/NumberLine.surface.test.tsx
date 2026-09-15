// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import NumberLine, { type NumberLineChallenge, type NumberLineData } from '../primitives/visual-primitives/math/NumberLine';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'line' }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, ...tutor }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

beforeEach(() => {
  tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'line';
  // The svg is drawn 1:1 with its 760-wide viewBox, so a click's clientX is an svg x.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 760, height: 240, right: 760, bottom: 240, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const plot: NumberLineChallenge = { id: 'plot', type: 'plot_point', instruction: 'Put dots on 2 and 8.', targetValues: [2, 8], hint: '' };
const jump: NumberLineChallenge = {
  id: 'jump', type: 'show_jump', instruction: 'Start at 3 and hop 2.', targetValues: [5], hint: '',
  operations: [{ type: 'add', startValue: 3, changeValue: 2, showJumpArc: false }],
};
const order: NumberLineChallenge = { id: 'order', type: 'order_values', instruction: 'Put these on the line.', targetValues: [2, 8, 5], hint: '' };
const between: NumberLineChallenge = { id: 'between', type: 'find_between', instruction: 'Find a number between 4 and 6.', targetValues: [4, 6], hint: '' };
const data = (challenges: NumberLineChallenge[]): NumberLineData => ({
  title: 'Line', range: { min: 0, max: 10 }, challenges, gradeBand: 'K-2', numberType: 'integer', instanceId: 'line',
});

function mount(input: NumberLineData) {
  const store = new PipSurfaceStore();
  store.setActive('line');
  const ui = () => <PipSurfaceContext.Provider value={store}><NumberLine data={input} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => { tutor.isAudioPlaying = on; view.rerender(ui()); };
  return { store, speak, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id) ?? [];

describe('Number Line drives Pip from its check state', () => {
  it('plot: outlines the whole line, follows a placement, celebrates only a right one; the next challenge drops the touch', () => {
    const { store, speak, container } = mount(data([plot, jump]));
    expect(container.querySelector('[data-pip-dock="line"]')).not.toBeNull();
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'line' });
    speak(false);
    const svg = container.querySelector('[data-pip-object="line"]')!;
    // Targets 2 and 8 keep the whole 0-10 line in view: x = 60 + 64 * value.
    fireEvent.click(svg, { clientX: 60 + 64 * 5 });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'line' });
    fireEvent.click(svg, { clientX: 60 });
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'line' });
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    fireEvent.click(svg, { clientX: 60 + 64 * 2 });
    fireEvent.click(svg, { clientX: 60 + 64 * 8 });
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    fireEvent.click(screen.getByRole('button', { name: /Next Challenge/ }));
    expect(store.getActive()?.scopeId).toBe('jump');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });

  it('jump: rings the marked start, never the line where the hop lands', () => {
    tutor.isAudioPlaying = true;
    const { store } = mount(data([jump]));
    expect(ids(store)).toEqual(expect.arrayContaining(['line', 'start']));
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'start' });
    expect(store.getActive()?.targets.find((t) => t.id === 'start')?.element.textContent).toContain('Start: 3');
  });

  it('order and find-between: the chips as a row; the line as a whole', () => {
    for (const [challenge, cue] of [[order, 'values'], [between, 'line']] as const) {
      tutor.isAudioPlaying = true;
      const { store, unmount } = mount(data([challenge]));
      expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: cue });
      unmount();
      expect(store.getActive()).toBeNull();
    }
    tutor.isAudioPlaying = false;
    const { store } = mount(data([order]));
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'value-1' });
  });

  it('speech for another block is not a cue', () => {
    tutor.activePrimitiveId = 'other-block';
    const { store, speak } = mount(data([plot]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });
});
