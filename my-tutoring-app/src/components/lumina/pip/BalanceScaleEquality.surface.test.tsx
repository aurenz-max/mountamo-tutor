// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JudgedScriptRunnerOptions } from '../hooks/useJudgedScriptRunner';
import type { EqualityItem } from '../primitives/visual-primitives/math/balanceEqualityScript';
import type { BalanceScaleData } from '../primitives/visual-primitives/math/BalanceScale';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';

const phase = vi.hoisted(() => ({ index: 0, tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false,
  options: null as JudgedScriptRunnerOptions<EqualityItem> | null }));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: (options: JudgedScriptRunnerOptions<EqualityItem>) => {
    phase.options = options;
    const item = options.pack.items[phase.index];
    return { currentItem: item, currentIndex: phase.index, cuedItemId: item?.id, running: true, preparing: false,
      tutorSpeaking: phase.tutorSpeaking, stage: phase.stage, currentSolved: phase.currentSolved, revealHeld: phase.revealHeld,
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set<string>(),
      start: vi.fn(), hearStimulus: vi.fn(), armStillness: vi.fn(), clearStillness: vi.fn(),
      isAwaitingGesture: () => phase.stage === 'judging', submitGestureAttempt: vi.fn(),
      loop: { queueCue: vi.fn(), clearQueuedCue: vi.fn() } };
  },
}));
vi.mock('../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: vi.fn() }) }));
vi.mock('../components/DiActionPanel', () => ({ default: () => null }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

import BalanceScaleEquality from '../primitives/visual-primitives/math/BalanceScaleEquality';

afterEach(cleanup);
beforeEach(() => { Object.assign(phase, { index: 0, tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false }); });

const data: BalanceScaleData = { title: 'Keep It Balanced', description: '', gradeBand: 'K-2', leftSide: [], rightSide: [], variableValue: 5,
  instanceId: 'balance', challenges: [
    { type: 'equality', leftSide: [{ value: 1, isVariable: true }, { value: 3 }], rightSide: [{ value: 5 }, { value: 3 }], variableValue: 5, instruction: '', hint: '' },
    { type: 'equality', leftSide: [{ value: 1, isVariable: true }, { value: 2 }], rightSide: [{ value: 4 }, { value: 2 }], variableValue: 4, instruction: '', hint: '' },
  ] };

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('balance');
  const ui = () => <PipSurfaceContext.Provider value={store}><BalanceScaleEquality data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const refresh = () => view.rerender(ui());
  const open = (index: number) => {
    phase.index = index; phase.stage = 'asking'; phase.currentSolved = false;
    act(() => phase.options?.onItemOpened?.(phase.options.pack.items[index], index));
  };
  act(() => phase.options?.onItemOpened?.(phase.options.pack.items[0], 0));
  return { store, refresh, open, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Balance Scale (equality) drives Pip from its judged phases', () => {
  it('build: points at the right pan, never a tray weight; follows the child’s weights; receives the settled pan', () => {
    phase.tutorSpeaking = true;
    const { store, refresh, container } = mount();
    const dock = container.querySelector('[data-pip-dock="balance"]')!;
    expect(dock).not.toBeNull();
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'right' });
    expect(dock.compareDocumentPosition(container.querySelector('[data-pip-object="tray"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    phase.tutorSpeaking = false; refresh();
    fireEvent.click(screen.getByRole('button', { name: 'Add 3 weight' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'right' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove 3 weight, block 0' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'tray' });
    phase.stage = 'judging'; refresh();
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'receive', targetId: 'tray' });
    phase.currentSolved = true; refresh();
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('total: points at the gathered weights (no total printed) and keeps watching them while the spoken sum is judged', () => {
    const { store, refresh, open, container } = mount();
    open(1);
    phase.tutorSpeaking = true; refresh();
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'sum' });
    expect(container.querySelector('[data-pip-object="tray"]')).toBeNull();
    phase.tutorSpeaking = false; phase.stage = 'judging'; refresh();
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'sum' });
  });

  it('infer: points at the left weight, whose number stays hidden; a new problem drops the child’s last touch', () => {
    const { store, refresh, open, container, unmount } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 weight' }));
    expect(pose(store)?.targetId).toBe('right');
    open(2);
    phase.tutorSpeaking = true; refresh();
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'left' });
    expect(container.querySelector('[data-pip-object="left"]')?.textContent).toBe('');
    phase.tutorSpeaking = false;
    open(3); refresh();
    expect(store.getActive()?.scopeId).toBe(phase.options?.pack.items[3].id);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
