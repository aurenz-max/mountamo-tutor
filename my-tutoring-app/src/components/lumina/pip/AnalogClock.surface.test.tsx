// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import AnalogClock, { type AnalogClockData, type ClockChallenge } from '../primitives/visual-primitives/math/AnalogClock';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'clock' }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, ...tutor }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => {
  tutor.isAudioPlaying = false;
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

const ch = (id: string, type: ClockChallenge['type'], over: Partial<ClockChallenge> = {}): ClockChallenge => ({
  id, type, instruction: 'Look at the clock.', targetHour: 3, targetMinute: 0, hint: 'Look at the short hand.',
  option0: '3:00', option1: '6:00', option2: '9:00', option3: '12:00', correctOptionIndex: 0, ...over,
});
const clock = (challenges: ClockChallenge[]): AnalogClockData => ({ title: 'Clock', gradeBand: 'K', challenges, instanceId: 'clock' });

function mount(input: AnalogClockData) {
  const store = new PipSurfaceStore();
  store.setActive('clock');
  const ui = () => <PipSurfaceContext.Provider value={store}><AnalogClock data={input} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => { tutor.isAudioPlaying = on; view.rerender(ui()); };
  return { store, speak, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id);

describe('Analog Clock drives Pip from its check state', () => {
  it('read: outlines the face, follows the child’s choice, celebrates only a right answer', () => {
    const { store, speak, container } = mount(clock([ch('r1', 'read'), ch('r2', 'read')]));
    expect(container.querySelector('[data-pip-dock="clock"]')).not.toBeNull();
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'clock' });
    speak(false);
    const wrong = screen.getByRole('button', { name: '6:00' });
    fireEvent.pointerDown(wrong);
    fireEvent.click(wrong);
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'touched' });
    const right = screen.getByRole('button', { name: '3:00' });
    fireEvent.pointerDown(right);
    fireEvent.click(right);
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('hand_name: outlines the dial, never a hand, and watches a touched hand as the dial', () => {
    const { store, speak, container } = mount(clock([ch('h1', 'hand_name', { targetHand: 'hour' }), ch('h2', 'read')]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'clock' });
    speak(false);
    const hand = screen.getByRole('button', { name: /short/ });
    fireEvent.pointerDown(hand);
    fireEvent.click(hand);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'clock' });
    expect(ids(store)).toEqual(['clock']);
    expect(store.getActive()?.targets[0].element).toBe(container.querySelector('svg[aria-label="Analog clock"]')?.parentElement);
  });

  it('set_time: dragging a hand is watched as the dial', () => {
    const { store, container } = mount(clock([ch('s1', 'set_time')]));
    fireEvent.pointerDown(container.querySelector('svg[aria-label="Analog clock"] line[stroke="rgba(255,255,255,0.9)"]')!);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'clock' });
  });

  it('hear_time: never publishes the hidden dial and outlines the option faces as a whole', () => {
    const { store, speak, unmount } = mount(clock([ch('t1', 'hear_time')]));
    speak(true);
    expect(ids(store)).toEqual(['options']);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'options' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
