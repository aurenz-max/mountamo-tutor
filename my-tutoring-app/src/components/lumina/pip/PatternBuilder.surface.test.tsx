// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import PatternBuilder, { type PatternBuilderChallenge, type PatternBuilderData } from '../primitives/visual-primitives/math/PatternBuilder';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'pattern' }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, db: {}, app: {} }));
// The pattern builder runs only on the teaching workspace: Pip is exercised there, and hears the shared context.
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, sessionMode: 'lesson', sendText: vi.fn(), conversation: [],
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} }, ...tutor,
}) }));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'pattern'; });

const challenge = (id: string, type: PatternBuilderChallenge['type'], extra: Partial<PatternBuilderChallenge> = {}): PatternBuilderChallenge => ({
  id, type, instruction: 'Look at the pattern.', answer: '', hint: '', narration: '', ...extra,
});
const data = (challenges: PatternBuilderChallenge[]): PatternBuilderData => ({
  title: 'Patterns', patternType: 'repeating', gradeBand: 'K-1', instanceId: 'pattern',
  sequence: { given: ['red', 'blue', 'red', 'blue'], hidden: ['red', 'blue'], core: ['red', 'blue'], rule: null },
  tokens: { available: ['red', 'blue', 'green'], type: 'colors' },
  challenges,
});

function mount(input: PatternBuilderData) {
  const store = new PipSurfaceStore();
  store.setActive('pattern');
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const ui = () => <PipSurfaceContext.Provider value={store}><LiveRuntimeContext.Provider value={runtime}>
    <LiveRuntimeSurface runtime={runtime}><PatternBuilder data={input} runtimePlanItemId="plan-pattern" runtimeEvalMode="mixed" /></LiveRuntimeSurface>
  </LiveRuntimeContext.Provider></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => { tutor.isAudioPlaying = on; act(() => { view.rerender(ui()); }); };
  const tap = (id: string) => fireEvent.click(view.container.querySelector(`[data-pip-object="${id}"]`)!);
  /** The runtime's Try again or advance after a checked answer, as the shell offers it. */
  const offer = (type: 'retry' | 'advance') => {
    const s = runtime.getSnapshot();
    const a = s.affordances.find(x => x.action.type === type);
    expect(a, `no ${type} offered`).toBeTruthy();
    const commandId = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId, instanceId: 'pattern', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a!.action }); });
    act(() => { runtime.confirmVisibleResponse(commandId); });
  };
  return { store, speak, tap, offer, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id) ?? [];
const checkButton = () => screen.getByRole('button', { name: /check/i });

describe('Pattern Builder drives Pip from its check state', () => {
  it('extend: points at the next "?" slot, then the row once full; follows palette taps; celebrates only a right extension', () => {
    const { store, speak, tap, offer, container } = mount(data([challenge('e1', 'extend'), challenge('e2', 'extend')]));
    expect(container.querySelector('[data-pip-dock="pattern"]')).not.toBeNull();
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'slot-0' });
    expect(ids(store)).not.toContain('seq-0'); // the given tokens are not choices here
    speak(false);
    tap('token-0'); // red
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'token-0' });
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'slot-1' });
    speak(false);
    tap('token-2'); // green — wrong
    fireEvent.click(checkButton());
    speak(true); // the correction
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'pattern' });
    speak(false);
    // The miss waits for Try again, which clears the blanks.
    offer('retry');
    tap('token-0'); // red
    tap('token-1'); // blue
    fireEvent.click(checkButton());
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    offer('advance');
    expect(store.getActive()?.scopeId).toBe('e2');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });

  it('extend: taking the last placed token back is watched on its slot', () => {
    const { store, tap } = mount(data([challenge('e1', 'extend')]));
    tap('token-0');
    tap('slot-0');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'slot-0' });
  });

  it('identify the core: outlines the row, never a token; follows the child’s selection', () => {
    const { store, speak, tap } = mount(data([challenge('i1', 'identify_core')]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'pattern' });
    expect(ids(store)).toEqual(expect.arrayContaining(['pattern', 'seq-0', 'seq-3']));
    speak(false);
    tap('seq-1');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'seq-1' });
  });

  it('create and translate: points at the build zone; removing a built token is watched as the zone', () => {
    const { store, speak, tap, unmount } = mount(data([challenge('c1', 'create')]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'build' });
    speak(false);
    tap('token-0');
    fireEvent.click(screen.getByText('R', { selector: '[data-pip-object="build"] div' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'build' });
    unmount();
    expect(store.getActive()).toBeNull();

    tutor.isAudioPlaying = true;
    const translate = mount(data([challenge('t1', 'translate', { translationMapping: { red: 'circle', blue: 'square' } })]));
    expect(pose(translate.store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'build' });
  });

  it('ignores speech for another block', () => {
    tutor.activePrimitiveId = 'other-block';
    const { store, speak } = mount(data([challenge('e1', 'extend')]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });
});
