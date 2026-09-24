// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';

// Sound swap runs only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'swap', conversation: [] as any[] }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, sessionMode: 'lesson', sendText: vi.fn(),
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} }, ...tutor,
}) }));
vi.mock('../evaluation', () => ({
  useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
import SoundSwap, { type SoundSwapData } from '../primitives/visual-primitives/literacy/SoundSwap';

afterEach(cleanup);
beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'swap'; tutor.conversation = []; });

const data: SoundSwapData = {
  title: 'Swap', gradeLevel: 'K', instanceId: 'swap',
  challenges: [
    { id: 'c1', operation: 'substitution', originalWord: 'cat', originalPhonemes: ['/k/', '/a/', '/t/'], originalImage: 'a cat',
      oldPhoneme: '/k/', newPhoneme: '/b/', substitutePosition: 'beginning', resultWord: 'bat', resultPhonemes: ['/b/', '/a/', '/t/'], resultImage: 'a bat' },
    { id: 'c2', operation: 'addition', originalWord: 'an', originalPhonemes: ['/a/', '/n/'], originalImage: 'an',
      addPhoneme: '/p/', addPosition: 'beginning', resultWord: 'pan', resultPhonemes: ['/p/', '/a/', '/n/'], resultImage: 'a pan' },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('swap');
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const ui = () => <PipSurfaceContext.Provider value={store}><LiveRuntimeContext.Provider value={runtime}>
    <LiveRuntimeSurface runtime={runtime}>
      <SoundSwap data={data} runtimePlanItemId="plan-swap" runtimeEvalMode="mixed" />
    </LiveRuntimeSurface></LiveRuntimeContext.Provider></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => act(() => { tutor.isAudioPlaying = on; view.rerender(ui()); });
  const say = (text: string) => act(() => {
    tutor.conversation = [...tutor.conversation, { role: 'user', content: text, timestamp: tutor.conversation.length + 1 }];
    view.rerender(ui());
  });
  let lastCommand = '';
  /** The observer's committed verdict on the pending spoken answer. */
  const verdict = (correct: boolean, transition: 'none' | 'advance' | 'retry') => {
    const s = runtime.getSnapshot();
    const a = s.affordances.find(x => x.action.type === 'workspace' && x.action.operation === 'apply_tutor_verdict');
    expect(a, 'no pending verdict').toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'swap', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, input: { dialogue: { responseId: s.task!.workspace!.pendingResponse!.id,
        verdict: correct ? 'correct' : 'incorrect', transition, tutor: correct ? 'Yes, bat!' : 'Not quite.' } } } }); });
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  return { store, speak, say, verdict, confirmVisible, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Sound Swap drives Pip from the workspace', () => {
  it('points at the starting word, never the highlighted sound to change; watches the tile the child taps', () => {
    const { store, speak, container } = mount();
    expect(container.querySelector('[data-pip-dock="swap"]')).not.toBeNull();
    expect(container.querySelector('[data-target="true"]')?.getAttribute('data-pip-object')).toBe('sound-0');
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'word' });
    speak(false);
    fireEvent.click(screen.getByRole('button', { name: 'sound /a/' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'sound-1' });
  });

  it('celebrates a credited word while it is held, and shows the new word only then', () => {
    const { store, say, verdict } = mount();
    expect(screen.queryByText('bat')).toBeNull();
    say('bat');
    verdict(true, 'none');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    expect(screen.getByText('bat')).toBeTruthy();
  });

  it('a credit that advances opens the next item without the old result', () => {
    const { store, say, verdict, confirmVisible } = mount();
    say('bat');
    verdict(true, 'advance');
    confirmVisible();
    expect(store.getActive()?.scopeId).toBe('c2');
    expect(screen.queryByText('bat')).toBeNull();
    expect(screen.queryByText('pan')).toBeNull();
  });

  it('ignores speech for another block and unregisters on unmount', () => {
    tutor.activePrimitiveId = 'another-block';
    const { store, speak, unmount } = mount();
    speak(true);
    expect(pose(store)?.gesture).not.toBe('point');
    tutor.activePrimitiveId = 'swap';
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
