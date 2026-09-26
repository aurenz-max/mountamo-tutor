// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import MathFactFluency, { type MathFactFluencyChallenge, type MathFactFluencyData } from '../primitives/visual-primitives/math/MathFactFluency';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'facts' }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, db: {}, app: {} }));
// Math fact fluency runs only on the teaching workspace: Pip is exercised there, and hears the shared context.
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
beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'facts'; });

const base = { operation: 'addition' as const, operand1: 3, operand2: 2, result: 5, equation: '3 + 2 = 5', correctAnswer: 5, unknownPosition: 'result' as const };
const visualFact: MathFactFluencyChallenge = { ...base, id: 'vf', type: 'visual-fact', instruction: 'How many?', visualType: 'dot-array', visualCount: 5, options: [4, 5, 6] };
const solve: MathFactFluencyChallenge = { ...base, id: 'es', type: 'equation-solve', instruction: 'Solve it.' };
const pictureToEquation: MathFactFluencyChallenge = {
  ...base, id: 'm1', type: 'match', instruction: 'Which equation matches?', matchDirection: 'visual-to-equation', visualType: 'ten-frame', visualCount: 5,
  equationOptions: ['3 + 2 = 5', '2 + 2 = 4'],
};
const equationToPicture: MathFactFluencyChallenge = {
  ...base, id: 'm2', type: 'match', instruction: 'Which picture matches?', matchDirection: 'equation-to-visual',
  visualOptions: [{ type: 'dot-array', count: 4 }, { type: 'dot-array', count: 5 }],
};
const data = (challenges: MathFactFluencyChallenge[]): MathFactFluencyData => ({
  title: 'Facts', challenges, maxNumber: 5, includeSubtraction: false, showVisualAids: true,
  targetResponseTime: 3, adaptiveDifficulty: false, gradeBand: 'K', instanceId: 'facts',
});

function mount(input: MathFactFluencyData) {
  const store = new PipSurfaceStore();
  store.setActive('facts');
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const ui = () => <PipSurfaceContext.Provider value={store}><LiveRuntimeContext.Provider value={runtime}>
    <LiveRuntimeSurface runtime={runtime}><MathFactFluency data={input} runtimePlanItemId="plan-facts" runtimeEvalMode="mixed" /></LiveRuntimeSurface>
  </LiveRuntimeContext.Provider></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => { tutor.isAudioPlaying = on; act(() => { view.rerender(ui()); }); };
  /** The runtime's Try again or advance after a checked answer, as the shell offers it. */
  const offer = (type: 'retry' | 'advance') => {
    const s = runtime.getSnapshot();
    const a = s.affordances.find(x => x.action.type === type);
    expect(a, `no ${type} offered`).toBeTruthy();
    const commandId = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId, instanceId: 'facts', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a!.action }); });
    act(() => { runtime.confirmVisibleResponse(commandId); });
  };
  return { store, speak, offer, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id) ?? [];
const tap = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }));

describe('Math Fact Fluency drives Pip from its check state', () => {
  it('visual fact: points at the dots, follows a tapped number, celebrates only a right one; the next fact drops the touch', () => {
    const { store, speak, offer, container } = mount(data([visualFact, solve]));
    expect(container.querySelector('[data-pip-dock="facts"]')).not.toBeNull();
    expect(ids(store)).toEqual(expect.arrayContaining(['visual', 'problem', 'option-4', 'option-5', 'option-6']));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'visual' });
    speak(false);
    tap('4');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'option-4' });
    // The miss waits for Try again.
    offer('retry');
    tap('5');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    offer('advance');
    expect(store.getActive()?.scopeId).toBe('es');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });

  it('equation solve: points at the printed problem, never the stepper; a stepper tap is watched', () => {
    const { store, speak } = mount(data([solve]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'problem' });
    speak(false);
    tap('One more');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'entry' });
  });

  it('match: the picture when an equation is chosen, the equation when a picture is chosen — never a choice', () => {
    for (const [challenge, cue] of [[pictureToEquation, 'visual'], [equationToPicture, 'problem']] as const) {
      tutor.isAudioPlaying = true;
      const { store, unmount, container } = mount(data([challenge]));
      expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: cue });
      expect(container.querySelectorAll('[data-pip-dock]')).toHaveLength(1);
      unmount();
      expect(store.getActive()).toBeNull();
    }
  });

  it('speech for another block, or praise carried into the next fact, is not a cue', () => {
    tutor.activePrimitiveId = 'other-block';
    const { store, speak, offer } = mount(data([visualFact, solve]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
    speak(false);
    tutor.activePrimitiveId = 'facts';
    tap('5');
    speak(true); // praise
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    offer('advance');
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    speak(false);
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'problem' });
  });
});
