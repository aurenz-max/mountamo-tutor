// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';

// You & Me runs only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'pair', conversation: [] as any[] }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, sessionMode: 'lesson', sendText: vi.fn(),
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} }, ...tutor,
}) }));
vi.mock('../evaluation', () => ({
  useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
import YouAndMe, { type YouAndMeData } from '../primitives/visual-primitives/literacy/YouAndMe';

afterEach(cleanup);
beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'pair'; tutor.conversation = []; });

const scene = {
  sceneId: 'bag', type: 'describe_action' as const,
  participants: [{ name: 'Maya', emoji: '👧' }, { name: 'Leo', emoji: '👦' }] as YouAndMeData['challenges'][number]['participants'],
  actor: 0 as const, object: 'bag', objectEmoji: '🎒', action: 'packed the bag',
};
const data: YouAndMeData = {
  title: 'You & Me', description: 'Trade roles', gradeLevel: 'K', challengeType: 'describe_action', instanceId: 'pair',
  challenges: [{ ...scene, id: 'bag-a', speaker: 0 }, { ...scene, id: 'bag-b', speaker: 1 }],
};

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('pair');
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const ui = () => <PipSurfaceContext.Provider value={store}><LiveRuntimeContext.Provider value={runtime}>
    <LiveRuntimeSurface runtime={runtime}>
      <YouAndMe data={data} runtimePlanItemId="plan-pair" runtimeEvalMode="describe_action" />
    </LiveRuntimeSurface></LiveRuntimeContext.Provider></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => act(() => { tutor.isAudioPlaying = on; view.rerender(ui()); });
  const credit = (text: string, transition: 'none' | 'advance') => {
    act(() => { tutor.conversation = [...tutor.conversation, { role: 'user', content: text, timestamp: tutor.conversation.length + 1 }];
      view.rerender(ui()); });
    const s = runtime.getSnapshot();
    const a = s.affordances.find(x => x.action.type === 'workspace' && x.action.operation === 'apply_tutor_verdict')!;
    const commandId = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId, instanceId: 'pair', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a.action, input: { dialogue: { responseId: s.task!.workspace!.pendingResponse!.id,
        verdict: 'correct', transition, tutor: 'Yes, you told it as Maya.' } } } }); });
    act(() => { runtime.confirmVisibleResponse(commandId); });
  };
  return { ...view, store, speak, credit };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('You & Me drives Pip from the workspace', () => {
  it('outlines the whole scene, never one partner, and points at it while the tutor speaks', () => {
    const { store, speak, container } = mount();
    expect(container.querySelector('[data-pip-dock="pair"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['scene']);
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'scene' });
  });

  it('celebrates only the credited sentence; the next turn takes its own scope; unregisters on unmount', () => {
    const { store, credit, unmount } = mount();
    credit('I packed the bag.', 'none');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
    const second = mount();
    second.credit('I packed the bag.', 'advance');
    expect(second.store.getActive()?.scopeId).toContain('bag-b');
    expect(pose(second.store)?.phase).not.toBe('celebrating');
  });
});
