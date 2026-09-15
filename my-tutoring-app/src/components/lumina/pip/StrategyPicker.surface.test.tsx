// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import StrategyPicker, { type StrategyPickerData } from '../primitives/visual-primitives/math/StrategyPicker';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'strategy' as string | null }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, db: {}, app: {} }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, isAudioPlaying: tutor.isAudioPlaying, activePrimitiveId: tutor.activePrimitiveId }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

beforeEach(() => { Object.assign(tutor, { isAudioPlaying: false, activePrimitiveId: 'strategy' }); });
afterEach(cleanup);

const problem = { equation: '3 + 4 = ?', operation: 'addition' as const, operand1: 3, operand2: 4, result: 7 };
const data: StrategyPickerData = {
  title: 'Strategies', maxNumber: 10, operations: ['addition'], strategiesIntroduced: ['counting-on', 'doubles'], gradeBand: '1', instanceId: 'strategy',
  challenges: [
    { id: 's1', type: 'guided-strategy', instruction: 'Count on from 3.', problem, assignedStrategy: 'counting-on', strategySteps: ['Start at 3', 'Count 4 more'] },
    { id: 's2', type: 'guided-strategy', instruction: 'Count on again.', problem: { ...problem, equation: '5 + 2 = ?', operand1: 5, operand2: 2 }, assignedStrategy: 'counting-on' },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><StrategyPicker data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const refresh = () => act(() => { view.rerender(ui()); });
  return { ...view, store, refresh };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Strategy Picker drives Pip from its check state', () => {
  it('outlines the problem and strategy workspace, follows a touch inside it, and ignores touches outside', () => {
    const { store, refresh, container } = mount();
    expect(container.querySelector('[data-pip-dock="strategy"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['workspace']);
    tutor.isAudioPlaying = true;
    refresh();
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'workspace' });
    tutor.isAudioPlaying = false;
    refresh();
    const workspace = container.querySelector('[data-pip-object="workspace"]') as HTMLElement;
    const control = workspace.querySelector('button, input') as HTMLElement;
    expect(control).not.toBeNull();
    fireEvent.pointerDown(control);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'touched' });
    expect(screen.queryByText('Next Challenge')).toBeNull();
  });

  it('ignores another block’s speech and unregisters on unmount', () => {
    const { store, refresh, unmount } = mount();
    tutor.activePrimitiveId = 'someone-else';
    tutor.isAudioPlaying = true;
    refresh();
    expect(pose(store)?.gesture).not.toBe('point');
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
