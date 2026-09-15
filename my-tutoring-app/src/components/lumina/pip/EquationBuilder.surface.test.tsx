// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import EquationBuilder, { type EquationBuilderChallenge, type EquationBuilderData } from '../primitives/visual-primitives/math/EquationBuilder';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'eq' }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, ...tutor }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'eq'; });

const build: EquationBuilderChallenge = { id: 'b1', type: 'build', instruction: 'Build 2 + 1 = 3', targetEquation: '2 + 1 = 3', availableTiles: ['2', '+', '1', '=', '3'] };
const missing: EquationBuilderChallenge = { id: 'm1', type: 'missing-value', instruction: 'What number makes it true?', equation: '4 + ? = 7', correctValue: 3, options: [2, 3, 4] };
const truth: EquationBuilderChallenge = { id: 't1', type: 'true-false', instruction: 'True or false?', displayEquation: '3 + 2 = 5', isTrue: true };
const balance: EquationBuilderChallenge = { id: 'bal', type: 'balance', instruction: 'Make both sides equal.', leftSide: '3 + 4', rightSide: '? + 2', correctAnswer: 5 };
const data = (challenges: EquationBuilderChallenge[]): EquationBuilderData => ({ title: 'Equations', challenges, maxNumber: 10, gradeBand: '1', instanceId: 'eq' });

function mount(input: EquationBuilderData) {
  const store = new PipSurfaceStore();
  store.setActive('eq');
  const ui = () => <PipSurfaceContext.Provider value={store}><EquationBuilder data={input} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => { tutor.isAudioPlaying = on; view.rerender(ui()); };
  return { store, speak, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const target = (store: PipSurfaceStore, id: string) => store.getActive()?.targets.find((t) => t.id === id)?.element;
const before = (a: Element | null, b: Element | null) => !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('Equation Builder drives Pip from its check state', () => {
  it('build: points at the slot row, never a tile; follows a tile to its slot; celebrates only a correct equation', () => {
    const { store, speak, container } = mount(data([build, missing]));
    const pool = container.querySelector('[data-pip-object="pool"]') as HTMLElement;
    expect(before(container.querySelector('[data-pip-object="workspace"]'), container.querySelector('[data-pip-dock="eq"]'))).toBe(true);
    expect(before(container.querySelector('[data-pip-dock="eq"]'), pool)).toBe(true);
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'workspace' });
    speak(false);
    fireEvent.click(within(pool).getByRole('button', { name: '2' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'slot-0' });
    expect(target(store, 'slot-0')?.textContent).toBe('2');
    fireEvent.click(target(store, 'slot-0')!);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'pool' });
    for (const tile of ['2', '+', '1', '=', '3']) fireEvent.click(within(pool).getByRole('button', { name: tile }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'slot-4' });
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    fireEvent.click(screen.getByRole('button', { name: /next challenge/i }));
    expect(store.getActive()?.scopeId).toBe('m1');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });

  it('missing value: points at the printed "?", with the dock between it and the options; a wrong pick is watched, not celebrated', () => {
    const { store, speak, container } = mount(data([missing, truth]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'gap' });
    expect(target(store, 'gap')?.textContent).toBe('?');
    const dock = container.querySelector('[data-pip-dock="eq"]');
    expect(before(target(store, 'gap')!, dock)).toBe(true);
    expect(before(dock, target(store, 'option-2')!)).toBe(true);
    speak(false);
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'option-2' });
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('true or false: points at the whole equation, never True or False; balance: points at the "?" and watches the number box', () => {
    const tf = mount(data([truth]));
    tf.speak(true);
    expect(pose(tf.store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'equation' });
    tf.speak(false);
    fireEvent.click(screen.getByRole('button', { name: 'False' }));
    expect(pose(tf.store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'truth-false' });
    tf.unmount();
    expect(tf.store.getActive()).toBeNull();

    const bal = mount(data([balance]));
    bal.speak(true);
    expect(pose(bal.store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'gap' });
    expect(target(bal.store, 'gap')?.textContent).toBe('?');
    bal.speak(false);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } });
    expect(pose(bal.store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'entry' });
  });

  it('ignores speech for another block and praise still playing after Next', () => {
    tutor.activePrimitiveId = 'other';
    const { store, speak } = mount(data([truth, missing]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
    tutor.activePrimitiveId = 'eq';
    speak(false);
    speak(true);
    expect(pose(store)?.gesture).toBe('point');
    speak(false);
    fireEvent.click(screen.getByRole('button', { name: 'True' }));
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    fireEvent.click(screen.getByRole('button', { name: /next challenge/i }));
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
  });
});
