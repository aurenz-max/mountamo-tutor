// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BalanceScaleData } from '../primitives/visual-primitives/math/BalanceScale';
import type { WorkspaceInput } from '../components/live-activity/runtime/contract';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';

// Balance scale runs only on the teaching workspace, so Pip is exercised there: the runtime owns
// progression, and the tutor's audio is the Live context's.
const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'balance', conversation: [] as any[] }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, sessionMode: 'lesson', sendText: vi.fn(),
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} }, ...tutor,
}) }));
vi.mock('../evaluation', () => ({
  useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: vi.fn() }),
}));
vi.mock('../components/DiActionPanel', () => ({ default: () => null }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

import BalanceScaleEquality from '../primitives/visual-primitives/math/BalanceScaleEquality';

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(tutor, { isAudioPlaying: false, activePrimitiveId: 'balance', conversation: [] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const data: BalanceScaleData = { title: 'Keep It Balanced', description: '', gradeBand: 'K-2', leftSide: [], rightSide: [], variableValue: 5,
  instanceId: 'balance', challenges: [
    { type: 'equality', leftSide: [{ value: 1, isVariable: true }, { value: 3 }], rightSide: [{ value: 5 }, { value: 3 }], variableValue: 5, instruction: '', hint: '' },
    { type: 'equality', leftSide: [{ value: 1, isVariable: true }, { value: 2 }], rightSide: [{ value: 4 }, { value: 2 }], variableValue: 4, instruction: '', hint: '' },
  ] };

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('balance');
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const ui = () => <PipSurfaceContext.Provider value={store}><LiveRuntimeContext.Provider value={runtime}>
    <LiveRuntimeSurface runtime={runtime}>
      <BalanceScaleEquality data={data} runtimePlanItemId="plan-balance" runtimeEvalMode="equality" />
    </LiveRuntimeSurface></LiveRuntimeContext.Provider></PipSurfaceContext.Provider>;
  const view = render(ui());
  const refresh = () => view.rerender(ui());
  const speak = (on: boolean) => { tutor.isAudioPlaying = on; refresh(); };
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && x.action.operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'balance', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  /** Advance a solved item and show its receipt, as the shell does. */
  const next = () => { dispatch('advance'); confirmVisible(); };
  /** The learner says the answer and the tutor affirms it and moves on. */
  const answer = (text: string) => {
    act(() => { tutor.conversation = [...tutor.conversation, { role: 'user', content: text, timestamp: tutor.conversation.length + 1 }]; refresh(); });
    dispatch('apply_tutor_verdict', { dialogue: { responseId: state().task!.workspace!.pendingResponse!.id, verdict: 'correct',
      transition: 'advance', tutor: 'Yes, that is right.' } });
    confirmVisible();
  };
  const press = (name: string) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  /** Load the right pan to the target and let it settle, so the build step commits. */
  const balance = (weights: number[]) => { for (const w of weights) press(`Add ${w} weight`); act(() => { vi.advanceTimersByTime(900); }); };
  return { store, speak, state, next, answer, press, balance, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Balance Scale (equality) drives Pip from its workspace phases', () => {
  it('build: points at the right pan, never a tray weight; follows the child’s weights; celebrates the settled balance', () => {
    const { store, speak, press, container } = mount();
    speak(true);
    const dock = container.querySelector('[data-pip-dock="balance"]')!;
    expect(dock).not.toBeNull();
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'right' });
    expect(dock.compareDocumentPosition(container.querySelector('[data-pip-object="tray"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    speak(false);
    press('Add 3 weight');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'right' });
    press('Remove 3 weight, block 0');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'tray' });
    press('Add 5 weight');
    act(() => { vi.advanceTimersByTime(900); });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('total: points at the gathered weights (no total printed); the tray is gone', () => {
    const { store, speak, balance, next, state, container } = mount();
    balance([5]); next();
    expect(state().task!.itemId).toBe('balance-1-total');
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'sum' });
    expect(container.querySelector('[data-pip-object="tray"]')).toBeNull();
  });

  it('infer: points at the left weight, whose number stays hidden; a new problem drops the child’s last touch', () => {
    const { store, speak, press, balance, next, answer, state, container, unmount } = mount();
    press('Add 2 weight');
    expect(pose(store)?.targetId).toBe('right');
    balance([3]); next();
    answer('five');
    expect(state().task!.itemId).toBe('balance-1-infer');
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'left' });
    expect(container.querySelector('[data-pip-object="left"]')?.textContent).toBe('');
    speak(false);
    answer('five');
    expect(store.getActive()?.scopeId).toBe('balance-2-build');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
