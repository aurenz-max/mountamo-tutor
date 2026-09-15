// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import CalendarExplorer, { type CalendarExplorerChallenge, type CalendarExplorerData } from '../primitives/visual-primitives/calendar/CalendarExplorer';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'cal' }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, ...tutor }),
}));
const phase = vi.hoisted(() => ({
  tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, running: true, preparing: false, index: 0, staleCue: false,
}));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: Array<{ id: string }> } }) => {
    const item = pack.items[phase.index] ?? null;
    return {
      currentItem: item, currentIndex: phase.index, ...phase, cuedItemId: phase.staleCue ? 'previous' : item?.id ?? null,
      summary: null, micState: 'armed', statusLine: '', start: vi.fn(), hearStimulus: vi.fn(),
    };
  },
}));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => {
  tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'cal';
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, running: true, preparing: false, index: 0, staleCue: false });
});

const base = { month: 3, year: 2025, hint: '', narration: '' };
// March 2025: the 1st is a Saturday, the 14th a Friday.
const findDate: CalendarExplorerChallenge = { ...base, id: 'date', type: 'identify', question: 'Tap March 14.', correctAnswer: '14', options: [], todayDate: 14 };
const whatDay: CalendarExplorerChallenge = { ...base, id: 'day', type: 'identify', question: 'What day is today?', correctAnswer: 'Friday', options: ['Thursday', 'Friday'], todayDate: 14 };
const countDays: CalendarExplorerChallenge = { ...base, id: 'count', type: 'count', question: 'How many Mondays?', correctAnswer: '5', options: ['4', '5'], targetDayOfWeek: 'Monday' };
const offset: CalendarExplorerChallenge = { ...base, id: 'offset', type: 'day_offset', question: 'What day is 2 days after Monday?', correctAnswer: 'Wednesday', options: ['Tuesday', 'Wednesday'], startDay: 'Monday', offsetDays: 2 };
const grid = (challenges: CalendarExplorerChallenge[]): CalendarExplorerData => ({ title: 'Calendar', challenges, gradeBand: 'K', instanceId: 'cal' });

function mount(input: CalendarExplorerData) {
  const store = new PipSurfaceStore();
  store.setActive('cal');
  const ui = () => <PipSurfaceContext.Provider value={store}><CalendarExplorer data={input} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => { tutor.isAudioPlaying = on; view.rerender(ui()); };
  const update = (next: Partial<typeof phase>) => { Object.assign(phase, next); view.rerender(ui()); };
  return { store, speak, update, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id) ?? [];

describe('Calendar Explorer (tap) drives Pip from its check state', () => {
  it('a date is the answer: outlines the grid, never the starred cell; follows a tap; celebrates only a right check', () => {
    const { store, speak, container } = mount(grid([findDate, whatDay]));
    expect(container.querySelector('[data-pip-dock="cal"]')).not.toBeNull();
    expect(ids(store)).toEqual(expect.arrayContaining(['grid', 'today', 'date-13']));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'grid' });
    speak(false);
    fireEvent.click(screen.getByTestId('date-13'));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'date-13' });
    fireEvent.click(screen.getByTestId('date-14'));
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    fireEvent.click(screen.getByRole('button', { name: /Next Question/ }));
    expect(store.getActive()?.scopeId).toBe('day');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });

  it('an option is the answer: rings the star the screen marks as today; follows an option tap', () => {
    const { store, speak } = mount(grid([whatDay]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'today' });
    speak(false);
    fireEvent.click(screen.getByRole('button', { name: 'Thursday' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'option-0' });
  });

  it('count: the grid, never the target column; days forward: the start card', () => {
    for (const [challenge, cue] of [[countDays, 'grid'], [offset, 'offset']] as const) {
      tutor.isAudioPlaying = true;
      const { store, unmount } = mount(grid([challenge]));
      expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: cue });
      unmount();
      expect(store.getActive()).toBeNull();
    }
  });

  it('speech for another block is not a cue', () => {
    tutor.activePrimitiveId = 'other-block';
    const { store, speak } = mount(grid([whatDay]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });
});

const chain: CalendarExplorerChallenge[] = ['Monday', 'Tuesday'].map((day, i) => ({
  ...base, id: `chain-${i}`, type: 'day_sequence', question: '', correctAnswer: '', options: [],
  currentDay: day, expectedDay: i ? 'Wednesday' : 'Tuesday', chainPosition: i + 1,
}));

describe('Calendar Explorer (spoken chain) drives Pip from the judged runner', () => {
  it('idle before start; outlines the listen card on the cue; watches it while judged; celebrates the affirmed turn', () => {
    phase.running = false;
    const { store, update, container } = mount(grid(chain));
    expect(container.querySelector('[data-pip-dock="cal"]')).not.toBeNull();
    expect(ids(store)).toEqual(['stimulus']);
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ running: true, tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stimulus' });
    update({ tutorSpeaking: false, stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'stimulus' });
    update({ stage: 'asking', currentSolved: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('a cue still naming the previous turn is not a cue', () => {
    const { store, update, unmount } = mount(grid(chain));
    update({ index: 1, tutorSpeaking: true, staleCue: true });
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
