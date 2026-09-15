// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import TimeSequencer, { type TimeSequencerChallenge, type TimeSequencerData } from '../primitives/visual-primitives/math/TimeSequencer';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'time' }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, ...tutor }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'time'; });

const card = (id: string, label: string, emoji = '⭐') => ({ id, label, emoji });
const sequence: TimeSequencerChallenge = {
  id: 'seq', type: 'sequence-events', instruction: 'Put these in order.',
  events: [card('wake', 'Wake up'), card('eat', 'Eat breakfast'), card('bus', 'Ride the bus')],
  correctOrder: ['wake', 'eat', 'bus'],
};
const periodOf: TimeSequencerChallenge = {
  id: 'tod', type: 'match-time-of-day', instruction: 'When do you do this?', event: card('sleep', 'Go to sleep'), correctPeriod: 'night',
};
const beforeAfter: TimeSequencerChallenge = {
  id: 'ba', type: 'before-after', instruction: 'What happens before lunch?', referenceEvent: card('lunch', 'Eat lunch'), relation: 'before',
  options: [card('recess', 'Morning recess'), card('dinner', 'Eat dinner')], correctEvent: 'recess',
};
const duration: TimeSequencerChallenge = {
  id: 'dur', type: 'duration-compare', instruction: 'Which takes longer?', eventA: card('brush', 'Brush teeth'), eventB: card('school', 'School day'), correctAnswer: 'B',
};
const schedule: TimeSequencerChallenge = {
  id: 'sch', type: 'read-schedule', instruction: 'Read the schedule.', targetTime: '10:00',
  schedule: [{ time: '9:00', activity: 'Math', emoji: '➕' }, { time: '10:00', activity: 'Art', emoji: '🎨' }],
  correctActivity: 'Art', activityOptions: ['Math', 'Art'],
};
const data = (challenges: TimeSequencerChallenge[]): TimeSequencerData => ({ title: 'Time', gradeBand: '1', challenges, instanceId: 'time' });

function mount(input: TimeSequencerData) {
  const store = new PipSurfaceStore();
  store.setActive('time');
  const ui = () => <PipSurfaceContext.Provider value={store}><TimeSequencer data={input} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => { tutor.isAudioPlaying = on; view.rerender(ui()); };
  return { store, speak, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id) ?? [];
const tap = (label: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));

describe('Time Sequencer drives Pip from its check state', () => {
  it('ordering: outlines the list, follows the moved card, celebrates only the right order; the next challenge drops the touch', () => {
    const { store, speak, container } = mount(data([sequence, periodOf]));
    expect(container.querySelector('[data-pip-dock="time"]')).not.toBeNull();
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'events' });
    speak(false);
    tap('Ride the bus');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'card-bus' });
    tap('Wake up'); tap('Eat breakfast');
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'card-eat' });
    tap('Ride the bus'); tap('Wake up'); tap('Eat breakfast');
    tap('Wake up'); tap('Eat breakfast'); tap('Ride the bus');
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    fireEvent.click(screen.getByRole('button', { name: /next challenge/i }));
    expect(store.getActive()?.scopeId).toBe('tod');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });

  it('time of day: points at the named event card, never a period; follows a period tap', () => {
    const { store, speak } = mount(data([periodOf]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'event' });
    expect(ids(store)).toEqual(expect.arrayContaining(['event', 'period-morning', 'period-night']));
    speak(false);
    tap('Morning');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'period-morning' });
  });

  it('before/after, duration and schedule: the reference card, the pair, the table — never a choice', () => {
    for (const [challenge, cue] of [[beforeAfter, 'reference'], [duration, 'durations'], [schedule, 'schedule']] as const) {
      tutor.isAudioPlaying = true;
      const { store, unmount } = mount(data([challenge]));
      expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: cue });
      unmount();
      expect(store.getActive()).toBeNull();
    }
  });

  it('speech for another block, or praise carried over from the last challenge, is not a cue', () => {
    tutor.activePrimitiveId = 'other-block';
    const { store, speak } = mount(data([periodOf, schedule]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
    speak(false);
    tutor.activePrimitiveId = 'time';
    tap('Night');
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    speak(true); // praise for the right period
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    fireEvent.click(screen.getByRole('button', { name: /next challenge/i }));
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    speak(false);
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'schedule' });
  });
});
