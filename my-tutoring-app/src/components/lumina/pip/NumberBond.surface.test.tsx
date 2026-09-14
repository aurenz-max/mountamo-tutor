// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import NumberBond, { type NumberBondData } from '../primitives/visual-primitives/math/NumberBond';

const phase = vi.hoisted(() => ({ tutorSpeaking: false, stage: 'asking', currentSolved: false, index: 0 }));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack, onItemOpened }: { pack: { items: Array<{ id: string }> }; onItemOpened?: (item: unknown, index: number) => void }) => {
    const item = pack.items[phase.index];
    React.useEffect(() => { if (item) onItemOpened?.(item, phase.index); }, [item?.id]);
    return {
      currentItem: item, currentIndex: phase.index, ...phase, cuedItemId: item?.id,
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
      running: true, preparing: false, summary: null, revealHeld: false, micState: 'armed', statusLine: '',
      start: vi.fn(), hearStimulus: vi.fn(), armStillness: vi.fn(), clearStillness: vi.fn(),
      isAwaitingGesture: () => false, submitGestureAttempt: vi.fn(),
      loop: { queueCue: vi.fn(), clearQueuedCue: vi.fn() },
    };
  },
}));
vi.mock('../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: vi.fn() }) }));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { phase.tutorSpeaking = false; phase.stage = 'asking'; phase.currentSolved = false; phase.index = 0; });

const base = { title: 'Bonds', maxNumber: 10, showCounters: true, showEquation: true, gradeBand: '1' as const, instanceId: 'bond' };
const split: NumberBondData = { ...base, challenges: [{ id: 'a', type: 'decompose', whole: 5, instruction: 'Split five.' }] };

function mount(input: NumberBondData) {
  const store = new PipSurfaceStore();
  store.setActive('bond');
  const ui = (next: NumberBondData) => <PipSurfaceContext.Provider value={store}><NumberBond data={next} /></PipSurfaceContext.Provider>;
  return { store, ui, ...render(ui(input)) };
}

describe('Number Bond drives Pip from its judged phases', () => {
  it('points at the bond while cued, follows the child’s counter moves, and receives the split', () => {
    phase.tutorSpeaking = true;
    const { store, rerender, ui, unmount } = mount(split);
    expect(store.getActive()?.pose).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'board' });
    phase.tutorSpeaking = false;
    rerender(ui(split));
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'none' });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Move counter to left' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move counter to left' }));
    expect(screen.getByRole('region', { name: 'left counter tray' }).querySelectorAll('[aria-label^="Counter"]')).toHaveLength(1);
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'look', targetId: 'board' });
    phase.stage = 'judging';
    rerender(ui(split));
    expect(store.getActive()?.pose).toMatchObject({ phase: 'checking', gesture: 'receive', targetId: 'board' });
    phase.stage = 'asking'; phase.currentSolved = true;
    rerender(ui(split));
    expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });

  it('points at the slot row, never at a tile, when an equation is built', () => {
    const build: NumberBondData = { ...base, challenges: [{ id: 'b', type: 'build-equation', whole: 7, part1: 3, instruction: 'Build it.' }] };
    const { store, container, rerender, ui } = mount(build);
    const buildIndex = (() => {
      for (let i = 0; i < 8; i++) {
        phase.index = i;
        rerender(ui(build));
        if (container.querySelector('[data-pip-object="equation"]')) return i;
      }
      return -1;
    })();
    expect(buildIndex).toBeGreaterThanOrEqual(0);
    phase.tutorSpeaking = true;
    rerender(ui(build));
    expect(store.getActive()?.pose).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'equation' });
    expect(store.getActive()?.targets.map((t) => t.id).sort()).toEqual(['board', 'equation']);
  });
});
