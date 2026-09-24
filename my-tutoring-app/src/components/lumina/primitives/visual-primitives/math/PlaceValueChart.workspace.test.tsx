// @vitest-environment jsdom
/**
 * W1 minimal binding: the real PlaceValueChart on the shared teaching workspace, with
 * the real TeachingSession, LiveLessonRuntime, transport and rendering shell. Only
 * microphone hardware, evaluation writes and sound are substituted. The scripted
 * runner must never mount on this path; its context push would crash on this AI
 * mock, which has no `updateContext`.
 */
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

const seam = vi.hoisted(() => ({ conversation: [] as any[], send: vi.fn(), submit: vi.fn(),
  correct: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'chart',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { playCorrect: seam.correct, playPerfect: vi.fn(),
  playStreak: vi.fn(), tap: vi.fn(), tick: vi.fn(), snap: vi.fn(), invalid: vi.fn(), isEnabled: () => true, getVolume: () => 1 } }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import PlaceValueChart, { type PlaceValueChartData } from './PlaceValueChart';

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.evaluationContext = null;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

type Mode = 'identify' | 'build' | 'compare' | 'expanded_form';

/** Forty-five with the tens digit glowing: the four is in the tens place, worth forty. */
const challenge = (id: string, targetNumber = 45) => ({ id, targetNumber, highlightedDigitPlace: 1,
  minPlace: 0, maxPlace: 1, placeNameChoices: [], digitValueChoices: [] });

function mount(evalMode: Mode, challenges = [challenge('p1')]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data = { instanceId: 'chart', title: 'Place value', description: '', challengeType: evalMode,
    supportTier: 'medium', challenges } as unknown as PlaceValueChartData;
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <PlaceValueChart data={data} runtimePlanItemId="plan-chart" runtimeEvalMode={evalMode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const view = render(tree());
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const offer = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && a.action.operation === name);
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offer(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    const commandId = crypto.randomUUID(); lastCommand = commandId;
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId, instanceId: 'chart',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
  };
  const inputs = () => Array.from(view.container.querySelectorAll('input'));
  const write = (...digits: string[]) => digits.forEach((d, i) => act(() => { fireEvent.change(inputs()[i], { target: { value: d } }); }));
  const settle = () => act(() => { vi.advanceTimersByTime(4000); });
  const say = (text: string) => act(() => {
    seam.conversation = [...seam.conversation, { role: 'user', content: text, timestamp: seam.conversation.length + 1 }];
    view.rerender(tree());
  });
  const feedback = (verdict: 'correct' | 'incorrect', transition: 'none' | 'advance' | 'retry' = 'none') =>
    dispatch('apply_tutor_verdict', { dialogue: { responseId: state().task!.workspace!.pendingResponse!.id, verdict, transition,
      tutor: verdict === 'correct' ? 'Yes, that is right.' : 'Not quite.' } });
  return { runtime, transport, sent, view, state, offer, dispatch, confirmVisible, inputs, write, settle, say, feedback };
}

const tutorTools = (h: ReturnType<typeof mount>) => h.state().affordances.filter(a => !a.controller)
  .map(a => (a.action as { operation?: string }).operation ?? a.action.type).sort();

it.each(['identify', 'build', 'compare', 'expanded_form'] as const)(
  '%s binds the workspace under tutor ownership, with no runner cue and no demonstration', mode => {
    const h = mount(mode);
    expect(h.state().owner).toBe('tutor');
    expect(h.state().task!.task).not.toMatch(/Say exactly|\[PV/);
    expect(tutorTools(h)).toEqual(['begin_help']);
    expect(seam.send.mock.calls.flat().join(' ')).not.toMatch(/\[PV|Say exactly/);
    // The runner's re-ask button has nothing to call here; the learner asks the tutor.
    expect(h.view.container.querySelector('[aria-label="Hear the question again"]')).toBeNull();
  });

it('a printed number publishes its spoken key; a dictated number never publishes its digits', () => {
  const h = mount('identify');
  expect(h.state().task!.workspace!.expectedAnswer).toBe('tens');
  expect(h.state().task!.demand).toMatchObject({ printedNumber: 45, glowingDigit: 4 });
  cleanup();
  const b = mount('build');
  expect(b.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(b.state().task!.task).toContain('forty-five');
  expect(JSON.stringify(b.state().task!.demand)).not.toMatch(/45/);
});

it('build: the chart checks a still, full chart, Try again clears it, and a right one completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('build');
  h.write('4', '6'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('Wrote tens: 4, ones: 6');
  expect(h.offer('advance')).toBeUndefined();
  h.dispatch('retry');
  expect(h.inputs().map(i => i.value)).toEqual(['', '']);
  h.write('4', '5'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance');
  expect(h.state().status).not.toBe('completed');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][0]).toBe(true);
  expect(seam.correct).toHaveBeenCalledOnce();
});

it('build: a half-written chart that stays still commits and is checked wrong, as on the runner', () => {
  const h = mount('build');
  h.write('4'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(seam.send.mock.calls.at(-1)![0]).toContain('Wrote tens: 4, ones: empty');
});

it('identify: the place name reveal waits for the credited answer, then the value ask opens', () => {
  const h = mount('identify');
  const first = h.state().task!.itemId;
  expect(h.view.container.textContent).not.toContain('4 — tens');
  h.say('the ones'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.itemId).toBe(first);
  h.say('tens'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).not.toBe(first);
  expect(h.state().task!.workspace!.expectedAnswer).toBe('forty');
});
