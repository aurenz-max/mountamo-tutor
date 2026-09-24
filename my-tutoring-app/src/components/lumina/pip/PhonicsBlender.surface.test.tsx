// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';

// Phonics blender runs only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'blend', conversation: [] as any[] }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, sessionMode: 'lesson', sendText: vi.fn(),
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} }, ...tutor,
}) }));
vi.mock('../evaluation', () => ({
  useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
import PhonicsBlender, { type PhonicsBlenderData } from '../primitives/visual-primitives/literacy/PhonicsBlender';

afterEach(cleanup);
beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'blend'; tutor.conversation = []; });

const makeData = (over: Partial<PhonicsBlenderData> = {}): PhonicsBlenderData => ({
  title: 'Blend', gradeLevel: 'K', patternType: 'cvc', instanceId: 'blend',
  words: [
    { id: 'w1', targetWord: 'cat', emoji: '🐱', phonemes: [
      { id: 'p1', sound: '/k/', letters: 'c' }, { id: 'p2', sound: '/a/', letters: 'a' }, { id: 'p3', sound: '/t/', letters: 't' }] },
    { id: 'w2', targetWord: 'dog', phonemes: [
      { id: 'p4', sound: '/d/', letters: 'd' }, { id: 'p5', sound: '/o/', letters: 'o' }, { id: 'p6', sound: '/g/', letters: 'g' }] },
  ],
  ...over,
});

function mount(data = makeData()) {
  const store = new PipSurfaceStore();
  store.setActive('blend');
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const ui = () => <PipSurfaceContext.Provider value={store}><LiveRuntimeContext.Provider value={runtime}>
    <LiveRuntimeSurface runtime={runtime}>
      <PhonicsBlender data={data} runtimePlanItemId="plan-blend" runtimeEvalMode="cvc" />
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
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'blend', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, input: { dialogue: { responseId: s.task!.workspace!.pendingResponse!.id,
        verdict: correct ? 'correct' : 'incorrect', transition, tutor: correct ? 'Yes, cat!' : 'Not quite.' } } } }); });
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  return { store, speak, say, verdict, confirmVisible, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Phonics Blender drives Pip from the workspace', () => {
  it('points at the letter row as a whole, never one card, and watches the card the child taps', () => {
    const { store, speak, container } = mount();
    expect(container.querySelector('[data-pip-dock="blend"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(expect.arrayContaining(['letters', 'letter-p1', 'letter-p2', 'letter-p3']));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'letters' });
    speak(false);
    fireEvent.click(screen.getByRole('button', { name: 'sound /a/' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'letter-p2' });
  });

  it('on the unsegmented tier Pip still outlines only the whole row', () => {
    const { store, speak } = mount(makeData({ showBlendPreview: 'none' }));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'letters' });
  });

  it('celebrates a credited word while it is held, with its picture', () => {
    const { store, say, verdict } = mount();
    say('cat');
    verdict(true, 'none');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    expect(screen.getByText('🐱')).toBeTruthy();
  });

  it('a credit that advances opens the next word, without the old picture or tap', () => {
    const { store, say, verdict, confirmVisible } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'sound /k/' }));
    say('cat');
    verdict(true, 'advance');
    confirmVisible();
    expect(store.getActive()?.scopeId).toBe('w2');
    expect(pose(store)?.targetId).not.toBe('letter-p1');
    expect(screen.queryByText('🐱')).toBeNull();
  });

  it('ignores speech for another block and unregisters on unmount', () => {
    tutor.activePrimitiveId = 'another-block';
    const { store, speak, unmount } = mount();
    speak(true);
    expect(pose(store)?.gesture).not.toBe('point');
    tutor.activePrimitiveId = 'blend';
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
