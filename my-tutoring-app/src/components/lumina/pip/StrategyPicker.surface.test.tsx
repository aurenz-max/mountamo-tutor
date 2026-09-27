// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import StrategyPicker, { type StrategyPickerData } from '../primitives/visual-primitives/math/StrategyPicker';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'strategy' as string | null }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, db: {}, app: {} }));
// The strategy picker runs only on the teaching workspace: Pip is exercised there, and hears the shared context.
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, sessionMode: 'lesson', sendText: vi.fn(), conversation: [],
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} }, ...tutor,
}) }));
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
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const ui = () => <PipSurfaceContext.Provider value={store}><LiveRuntimeContext.Provider value={runtime}>
    <LiveRuntimeSurface runtime={runtime}><StrategyPicker data={data} runtimePlanItemId="plan-strategy" runtimeEvalMode="guided" /></LiveRuntimeSurface>
  </LiveRuntimeContext.Provider></PipSurfaceContext.Provider>;
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
