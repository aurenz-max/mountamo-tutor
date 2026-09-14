// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import NumberSequencer, { type NumberSequencerData } from '../primitives/visual-primitives/math/NumberSequencer';

const phase = vi.hoisted(() => ({ tutorSpeaking: false, stage: 'asking', currentSolved: false, arm: vi.fn() }));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: Array<{ id: string }> } }) => ({
    currentItem: pack.items[0], currentIndex: 0, ...phase, cuedItemId: pack.items[0]?.id,
    canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
    running: true, preparing: false, summary: null, revealHeld: false, armStillness: phase.arm,
    start: vi.fn(), hearStimulus: vi.fn(), isAwaitingGesture: () => false, submitGestureAttempt: vi.fn(),
  }),
}));
vi.mock('../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: vi.fn() }) }));
vi.mock('../components/DiActionPanel', () => ({ default: () => null }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { phase.tutorSpeaking = false; phase.stage = 'asking'; phase.currentSolved = false; phase.arm.mockClear(); });

const base = { title: 'Trains', gradeBand: 'K' as const, showNumberLine: false, showDotArrays: false, instanceId: 'seq' };
const gap: NumberSequencerData = { ...base, challenges: [{ id: 'g', type: 'fill-missing', instruction: '',
  sequence: [5, 6, null, 8], correctAnswers: [7], rangeMin: 5, rangeMax: 8 }] };
const spot: NumberSequencerData = { ...base, challenges: [{ id: 's', type: 'spot-error', instruction: '',
  sequence: [1, 2, 8, 4, 5], correctAnswers: [3], wrongIndex: 2, rangeMin: 1, rangeMax: 8 }] };
const order: NumberSequencerData = { ...base, challenges: [{ id: 'o', type: 'order-cards', instruction: '',
  sequence: [3, 1, 4, 2], correctAnswers: [1, 2, 3, 4], rangeMin: 1, rangeMax: 4 }] };

function mount(input: NumberSequencerData) {
  const store = new PipSurfaceStore();
  store.setActive('seq');
  const ui = (next: NumberSequencerData) => <PipSurfaceContext.Provider value={store}><NumberSequencer data={next} /></PipSurfaceContext.Provider>;
  return { store, ui, ...render(ui(input)) };
}

describe('Number Sequencer drives Pip from its judged phases', () => {
  it('points at the highlighted gap during the cue, without showing its value', () => {
    phase.tutorSpeaking = true;
    const { store, container, rerender, ui } = mount(gap);
    expect(container.querySelector('[data-pip-dock="seq"]')).not.toBeNull();
    expect(store.getActive()?.pose).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'car-2' });
    expect(container.querySelector('[data-pip-object="car-2"]')?.textContent).toBe('?');
    expect(store.getActive()?.targets.map((t) => t.label).join(' ')).not.toContain('7');
    phase.tutorSpeaking = false; phase.stage = 'judging';
    rerender(ui(gap));
    expect(store.getActive()?.pose).toEqual({ phase: 'checking', gesture: 'look', targetId: 'car-2' });
    phase.currentSolved = true;
    rerender(ui(gap));
    expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('never singles out a car in spot-error', () => {
    phase.tutorSpeaking = true;
    const { store, rerender, ui } = mount(spot);
    expect(store.getActive()?.pose).toEqual({ phase: 'introducing', gesture: 'none' });
    phase.tutorSpeaking = false; phase.stage = 'judging';
    rerender(ui(spot));
    expect(store.getActive()?.pose.targetId).toBeUndefined();
  });

  it('follows the child’s own card moves in order-cards and receives the train', () => {
    phase.tutorSpeaking = true;
    const { store, container, rerender, ui, unmount } = mount(order);
    expect(store.getActive()?.pose.gesture).toBe('none');
    phase.tutorSpeaking = false;
    rerender(ui(order));
    fireEvent.click(container.querySelector('[data-pip-object="card-3"]')!);
    expect(phase.arm).toHaveBeenCalledOnce();
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'look', targetId: 'slot-0' });
    expect(store.getActive()?.targets.map((t) => t.id)).not.toContain('card-3');
    fireEvent.click(container.querySelector('[data-pip-object="slot-0"]')!);
    expect(store.getActive()?.pose.targetId).toBe('card-3');
    phase.stage = 'judging';
    rerender(ui(order));
    expect(store.getActive()?.pose).toMatchObject({ phase: 'checking', gesture: 'receive' });
    unmount();
    expect(store.getActive()).toBeNull();
  });

  it('drops the remembered move when a different activity replaces the item', () => {
    const { store, container, rerender, ui } = mount(order);
    fireEvent.click(container.querySelector('[data-pip-object="card-2"]')!);
    expect(store.getActive()?.pose.targetId).toBe('slot-0');
    const firstScope = store.getActive()?.scopeId;
    const next = { ...order, challenges: [{ ...order.challenges[0], id: 'o2' }] };
    rerender(ui(next));
    expect(store.getActive()?.scopeId).not.toBe(firstScope);
    expect(store.getActive()?.pose.targetId).toBeUndefined();
  });
});
