// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';

// The CVC speller runs only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'cvc', conversation: [] as any[] }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, sessionMode: 'lesson', sendText: vi.fn(),
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} }, ...tutor,
}) }));
vi.mock('../evaluation', () => ({
  useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
import CvcSpeller, { type CvcSpellerChallenge, type CvcSpellerData } from '../primitives/visual-primitives/literacy/CvcSpeller';

afterEach(cleanup);
beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'cvc'; tutor.conversation = []; });

const challenge = (id: string, taskType: CvcSpellerChallenge['taskType'], word: string, over: Partial<CvcSpellerChallenge> = {}): CvcSpellerChallenge => ({
  id, taskType, targetWord: word, targetLetters: word.split(''), targetPhonemes: [], emoji: '🔤',
  imageDescription: word, distractorLetters: ['e'], ...over,
});
const data: CvcSpellerData = {
  title: 'Sounds', letterGroup: 2, availableLetters: [], gradeLevel: 'K', instanceId: 'cvc',
  challenges: [
    challenge('c1', 'fill-vowel', 'sat'),
    challenge('c2', 'word-sort', 'pig', { emoji: '🐷' }),
    challenge('c3', 'spell-word', 'hot', { distractorLetters: ['a'] }),
    challenge('c4', 'word-sort', 'bug', { showPictureCue: false }),
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('cvc');
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const ui = () => <PipSurfaceContext.Provider value={store}><LiveRuntimeContext.Provider value={runtime}>
    <LiveRuntimeSurface runtime={runtime}>
      <CvcSpeller data={data} runtimePlanItemId="plan-cvc" runtimeEvalMode="mixed" />
    </LiveRuntimeSurface></LiveRuntimeContext.Provider></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => act(() => { tutor.isAudioPlaying = on; view.rerender(ui()); });
  const say = (text: string) => act(() => {
    tutor.conversation = [...tutor.conversation, { role: 'user', content: text, timestamp: tutor.conversation.length + 1 }];
    view.rerender(ui());
  });
  let lastCommand = '';
  /** Credit the spoken answer and advance, as the observer commits it. */
  const creditAndAdvance = (text: string) => {
    say(text);
    const s = runtime.getSnapshot();
    const a = s.affordances.find(x => x.action.type === 'workspace' && x.action.operation === 'apply_tutor_verdict');
    expect(a, 'no pending verdict').toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'cvc', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, input: { dialogue: { responseId: s.task!.workspace!.pendingResponse!.id,
        verdict: 'correct', transition: 'advance', tutor: 'Yes, that is the middle sound.' } } } }); });
    act(() => { runtime.confirmVisibleResponse(lastCommand); });
  };
  /** The runtime's advance after a checked build, as the shell offers it. */
  const advance = () => {
    const s = runtime.getSnapshot();
    const a = s.affordances.find(x => x.action.type === 'advance');
    expect(a, 'no advance offered').toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'cvc', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a!.action }); });
    act(() => { runtime.confirmVisibleResponse(lastCommand); });
  };
  return { store, speak, creditAndAdvance, advance, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('CVC Speller drives Pip from the workspace, per mode', () => {
  it('fill-vowel points at the marked gap; word-sort at the picture', () => {
    const { store, speak, creditAndAdvance, container } = mount();
    expect(container.querySelector('[data-pip-dock="cvc"]')).not.toBeNull();
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'gap' });
    speak(false);
    creditAndAdvance('aaa');
    expect(store.getActive()?.scopeId).toBe('c2');
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'picture' });
  });

  it('spell-word points at the box row and watches the box each letter lands in', () => {
    const { store, speak, creditAndAdvance } = mount();
    creditAndAdvance('aaa');
    creditAndAdvance('iii');
    expect(store.getActive()?.scopeId).toBe('c3');
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'boxes' });
    speak(false);
    fireEvent.click(screen.getByRole('button', { name: 'letter h' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'box-0' });
    fireEvent.click(screen.getByRole('button', { name: 'letter o' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'box-1' });
    const targets = store.getActive()!.targets.map((t) => t.id);
    expect(targets.every((id) => ['boxes', 'box-0', 'box-1', 'box-2', 'picture'].includes(id))).toBe(true);
  });

  it('a credited word-sort answer builds its column; a withdrawn picture leaves no cue target', () => {
    const { store, speak, creditAndAdvance, advance, container } = mount();
    creditAndAdvance('aaa');
    creditAndAdvance('iii'); // pig: its "i" column is built from that credited answer
    fireEvent.click(screen.getByRole('button', { name: 'letter h' }));
    fireEvent.click(screen.getByRole('button', { name: 'letter o' }));
    fireEvent.click(screen.getByRole('button', { name: 'letter t' }));
    advance();
    expect(store.getActive()?.scopeId).toBe('c4');
    expect(container.textContent).toContain('like');
    expect(store.getActive()?.targets).toEqual([]);
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'none' });
  });

  it('ignores speech for another block and unregisters on unmount', () => {
    tutor.activePrimitiveId = 'another-block';
    const { store, speak, unmount } = mount();
    speak(true);
    expect(pose(store)?.gesture).not.toBe('point');
    tutor.activePrimitiveId = 'cvc';
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
