// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';

// Bar model runs only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'bars' }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, sessionMode: 'lesson', conversation: [], sendText: vi.fn(),
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} }, ...tutor,
}) }));
vi.mock('../evaluation', () => ({
  useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
import BarModel, { type BarModelChallenge, type BarModelData } from '../primitives/visual-primitives/math/BarModel';

afterEach(cleanup);
beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'bars'; });

const rows = [{ label: 'Dogs', value: 3, emoji: '🐶' }, { label: 'Cats', value: 5, emoji: '🐱' }];
const ch = (id: string, over: Partial<BarModelChallenge>): BarModelChallenge => ({
  id, evalMode: 'most_least', graphStyle: 'picture', prompt: 'Which has the most?', values: rows,
  scale: { step: 1, max: 7 }, targetBarIndex: 1, ...over,
});
const bars = (challenges: BarModelChallenge[]): BarModelData => ({ title: 'Pets', description: '', challenges, instanceId: 'bars' });

function mount(input: BarModelData) {
  const store = new PipSurfaceStore();
  store.setActive('bars');
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const ui = () => <PipSurfaceContext.Provider value={store}><LiveRuntimeContext.Provider value={runtime}>
    <LiveRuntimeSurface runtime={runtime}>
      <BarModel data={input} runtimePlanItemId="plan-bars" runtimeEvalMode={input.challenges[0].evalMode} />
    </LiveRuntimeSurface></LiveRuntimeContext.Provider></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => { tutor.isAudioPlaying = on; view.rerender(ui()); };
  /** A shell action the runtime offers (Try again, Next challenge), dispatched as the learner's. */
  let lastCommand = '';
  const dispatch = (name: string) => {
    const s = runtime.getSnapshot();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && x.action.operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'bars', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a!.action }); });
  };
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  return { store, speak, dispatch, next, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const cueOf = (challenge: BarModelChallenge) => {
  const { store, speak, unmount } = mount(bars([challenge, ch('next', { evalMode: challenge.evalMode })]));
  speak(true);
  const cue = pose(store);
  unmount();
  return cue;
};

describe('Bar Model drives Pip from its check state', () => {
  it('most/fewest: outlines the whole graph, follows the row the child taps, celebrates only the right row', () => {
    const { store, speak, dispatch, next, container } = mount(bars([ch('m1', {}), ch('m2', {})]));
    expect(container.querySelector('[data-pip-dock="bars"]')).not.toBeNull();
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'graph' });
    speak(false);
    const [dogs] = Array.from(container.querySelectorAll('[data-pip-object^="row-"] button'));
    fireEvent.pointerDown(dogs);
    fireEvent.click(dogs);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'touched' });
    expect(store.getActive()?.targets.find((t) => t.id === 'touched')?.element).toBe(dogs);
    // A checked miss stays closed until Try again on the shell.
    dispatch('retry');
    const cats = container.querySelectorAll('[data-pip-object^="row-"] button')[1];
    fireEvent.pointerDown(cats);
    fireEvent.click(cats);
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    next();
    expect(store.getActive()?.scopeId).toBe('m2');
  });

  it('points at a row only while the screen marks it', () => {
    const read = ch('r1', { evalMode: 'picture_graph', targetBarIndex: 0, expectedValue: 3, options: [2, 3, 4], showTargetHighlight: true });
    expect(cueOf(read)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'row-0' });
    expect(cueOf({ ...read, showTargetHighlight: false })).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'graph' });
  });

  it('match starts at the group to count; build_graph at its controls; spoken graphs at the graph', () => {
    const match = ch('x1', { evalMode: 'match_to_bar', sourceItems: [{ emoji: '🐱', categoryIndex: 1 }], stimulusCount: 5 });
    expect(cueOf(match)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'source' });
    const build = ch('b1', { evalMode: 'build_graph', graphStyle: 'scaled_bar', expectedDataset: rows, expectedScaleStep: 1 });
    expect(cueOf(build)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'controls' });
    const spoken = ch('s1', { evalMode: 'say_what_it_shows' });
    expect(cueOf(spoken)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'graph' });
  });

  it('ignores speech for another block and unregisters on unmount', () => {
    tutor.activePrimitiveId = 'another-block';
    const { store, speak, unmount } = mount(bars([ch('m1', {})]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
    tutor.activePrimitiveId = 'bars';
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
