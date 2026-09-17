// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import TenFrame, { type TenFrameChallenge, type TenFrameData } from '../primitives/visual-primitives/math/TenFrame';

const phase = vi.hoisted(() => ({
  tutorSpeaking: false, stage: 'asking', currentSolved: false, index: 0,
  opened: null as null | ((item: { id: string }, index: number) => void),
}));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack, onItemOpened }: { pack: { items: Array<{ id: string }> }; onItemOpened: (item: { id: string }, index: number) => void }) => {
    phase.opened = onItemOpened;
    const item = pack.items[phase.index];
    return {
      currentItem: item, currentIndex: phase.index, ...phase, cuedItemId: item?.id,
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
      running: true, preparing: false, summary: null, revealHeld: false,
      armStillness: vi.fn(), clearStillness: vi.fn(), start: vi.fn(), hearStimulus: vi.fn(),
      isAwaitingGesture: () => false, submitGestureAttempt: vi.fn(),
    };
  },
}));
vi.mock('../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: vi.fn() }) }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useLuminaAIContext: () => ({ isConnected: false, isListening: false, sessionMode: 'idle', activePrimitiveId: null }) }));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { phase.tutorSpeaking = false; phase.stage = 'asking'; phase.currentSolved = false; phase.index = 0; });

const challenge = (id: string, type: TenFrameChallenge['type'], targetCount: number, extra: Partial<TenFrameChallenge> = {}): TenFrameChallenge => ({
  id, type, targetCount, instruction: '', hint: '', narration: '', ...extra,
});
const frame = (challenges: TenFrameChallenge[]): TenFrameData => ({
  title: 'Ten frame', mode: 'single', counters: { count: 0, color: 'red', positions: [] },
  challenges, gradeBand: 'K', instanceId: 'frame-instance',
});

function mount(input: TenFrameData) {
  const store = new PipSurfaceStore();
  store.setActive('frame-instance');
  const ui = (next: TenFrameData) => <PipSurfaceContext.Provider value={store}><TenFrame data={next} /></PipSurfaceContext.Provider>;
  return { store, ui, ...render(ui(input)) };
}

describe('Ten Frame drives Pip from its judged phases', () => {
  it('points at the frame, never a box; follows the child’s box; receives a placement', () => {
    phase.tutorSpeaking = true;
    const build = frame([challenge('b1', 'build', 4), challenge('b2', 'build', 6)]);
    const { store, container, rerender, ui } = mount(build);
    expect(container.querySelector('[data-pip-dock="frame-instance"]')).not.toBeNull();
    expect(store.getActive()?.pose).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'frame' });
    phase.tutorSpeaking = false;
    rerender(ui(build));
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'none' });
    fireEvent.click(container.querySelector('[data-pip-object="cell-3"]')!);
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'look', targetId: 'cell-3' });
    phase.stage = 'judging';
    rerender(ui(build));
    expect(store.getActive()?.pose).toEqual({ phase: 'checking', gesture: 'receive', targetId: 'cell-3' });
    phase.stage = 'asking'; phase.currentSolved = true;
    rerender(ui(build));
    expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });

    // The next item opens: the box the child touched on the last one is dropped.
    phase.currentSolved = false; phase.index = 1;
    rerender(ui(build));
    act(() => phase.opened?.({ id: 'b2' }, 1));
    expect(store.getActive()?.scopeId).toBe('b2');
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'none' });
  });

  it('waits, without receiving, on a spoken answer', () => {
    const add = frame([challenge('a1', 'add', 5, { addend1: 3, addend2: 2 })]);
    const { store, container, rerender, ui } = mount(add);
    fireEvent.click(container.querySelector('[data-pip-object="cell-0"]')!);
    phase.stage = 'judging';
    rerender(ui(add));
    expect(store.getActive()?.pose).toEqual({ phase: 'checking', gesture: 'look', targetId: 'cell-0' });
  });

  it('publishes only the frame on subitize, and unregisters on unmount', () => {
    phase.tutorSpeaking = true;
    const flash = frame([challenge('s1', 'subitize', 3, { flashDuration: 1500 })]);
    const { store, container, rerender, ui, unmount } = mount(flash);
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['frame']);
    expect(store.getActive()?.pose).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'frame' });
    phase.tutorSpeaking = false;
    rerender(ui(flash));
    fireEvent.click(container.querySelector('[data-pip-object="cell-1"]')!);
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
