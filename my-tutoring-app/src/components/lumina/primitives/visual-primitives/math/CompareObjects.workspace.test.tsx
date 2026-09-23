// @vitest-environment jsdom
/**
 * W1 minimal binding: the real CompareObjects on the shared teaching workspace, with
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
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'measure',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { playCorrect: seam.correct, playPerfect: vi.fn(),
  playStreak: vi.fn(), tap: vi.fn(), snap: vi.fn(), invalid: vi.fn(), isEnabled: () => true, getVolume: () => 1 } }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import CompareObjects, { type CompareObjectsData } from './CompareObjects';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { getComponentById } from '../../../service/manifest/catalog';
const compareObjectsLive = LIVE_ADAPTERS['compare-objects'];

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.evaluationContext = null;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

type Kind = 'compare_two' | 'identify_attribute' | 'order_three' | 'non_standard';
const obj = (name: string, size: number, value: number) => ({ name, visualSize: size, actualValue: value });
const PAIR = [obj('pencil', 120, 12), obj('crayon', 60, 6)];

/** One challenge per mode, each satisfying `itemFromChallenge`'s own gates. */
function challengeFor(kind: Kind, id = kind): Record<string, any> {
  const base = { id, type: kind, attribute: 'length' };
  switch (kind) {
    case 'compare_two': return { ...base, comparisonWord: 'longer', correctAnswer: 'pencil', objects: PAIR };
    case 'identify_attribute': return { ...base, correctAttribute: 'length', attributeOptions: ['length', 'weight'], objects: PAIR };
    case 'order_three': return { ...base, comparisonWord: 'longer', correctAnswer: 'ruler,pencil,crayon',
      objects: [obj('pencil', 120, 12), obj('ruler', 200, 30), obj('crayon', 60, 6)] };
    default: return { ...base, unitName: 'cube', unitCount: 5, objects: [obj('pencil', 120, 12)] };
  }
}

function mount(evalMode: string, challenges: Record<string, any>[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data = { instanceId: 'measure', title: 'Comparing things', gradeBand: '1', challenges } as unknown as CompareObjectsData;
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <CompareObjects data={data} runtimePlanItemId="plan-measure" runtimeEvalMode={evalMode} />
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
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId, instanceId: 'measure',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
  };
  const touch = (...names: string[]) => { for (const n of names) act(() => {
    fireEvent.click(view.container.querySelector(`[data-pip-object="pick-${n}"]`)!); }); };
  const settle = () => act(() => { vi.advanceTimersByTime(4000); });
  const say = (text: string) => act(() => {
    seam.conversation = [...seam.conversation, { role: 'user', content: text, timestamp: seam.conversation.length + 1 }];
    view.rerender(tree());
  });
  const feedback = (verdict: 'correct' | 'incorrect', transition: 'none' | 'advance' | 'retry' = 'none') =>
    dispatch('apply_tutor_verdict', { dialogue: { responseId: state().task!.workspace!.pendingResponse!.id, verdict, transition,
      tutor: verdict === 'correct' ? 'Yes, that is right.' : 'Not quite.' } });
  return { runtime, transport, sent, view, state, offer, dispatch, confirmVisible, touch, settle, say, feedback };
}

const tutorTools = (h: ReturnType<typeof mount>) => h.state().affordances.filter(a => !a.controller)
  .map(a => (a.action as { operation?: string }).operation ?? a.action.type).sort();

it.each(['compare_two', 'identify_attribute', 'order_three', 'non_standard'] as const)(
  '%s binds the workspace under tutor ownership, with no runner cue and no demonstration', kind => {
    const h = mount(kind, [challengeFor(kind)]);
    expect(h.state().owner).toBe('tutor');
    expect(h.state().task!.task).not.toMatch(/Say exactly|\[CO_/);
    expect(tutorTools(h)).toEqual(['begin_help']);
    expect(seam.send.mock.calls.flat().join(' ')).not.toMatch(/\[CO_|Say exactly/);
  });

it.each([['compare_two', 'pencil'], ['identify_attribute', 'length'], ['non_standard', '5']] as const)(
  '%s publishes its spoken key; the order key is never published', (kind, key) => {
    expect(mount(kind, [challengeFor(kind)]).state().task!.workspace!.expectedAnswer).toBe(key);
    cleanup();
    expect(mount('order_three', [challengeFor('order_three')]).state().task!.workspace!.expectedAnswer).toBeUndefined();
  });

it('order_three: the board checks a still arrangement, Try again clears it, and a right one completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('order_three', [challengeFor('order_three')]);
  h.touch('crayon', 'pencil', 'ruler');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.settle();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('crayon, pencil, ruler');
  expect(h.offer('advance')).toBeUndefined();
  h.dispatch('retry');
  expect(h.view.container.querySelectorAll('[data-pip-object^="pick-"] .absolute').length).toBe(0);
  h.touch('ruler', 'pencil', 'crayon'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.view.container.textContent).toContain('ruler  →  pencil  →  crayon');
  h.dispatch('advance');
  expect(h.state().status).not.toBe('completed');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0].slice(0, 2)).toEqual([true, 67]);
  expect(seam.correct).toHaveBeenCalledOnce();
});

it('order_three: a partial arrangement commits on stillness and is checked wrong', () => {
  const h = mount('order_three', [challengeFor('order_three')]);
  h.touch('ruler'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(seam.send.mock.calls.at(-1)![0]).toContain('Touched 1 of 3');
});

it('non_standard: the unit numbers stay hidden until the spoken count is credited', () => {
  const h = mount('non_standard', [challengeFor('non_standard')]);
  const numbered = () => h.view.container.querySelectorAll('.border-dashed span').length;
  expect(numbered()).toBe(0);
  h.say('six'); h.feedback('incorrect', 'retry');
  expect(numbered()).toBe(0);
  h.say('five');
  expect(h.state().task!.workspace!.pendingResponse).toMatchObject({ text: 'five' });
  h.feedback('correct');
  expect(numbered()).toBe(5);
  expect(h.view.container.textContent).toContain('5 cubes');
});

it('a mixed pin binds, and each item keeps its own response channel across transitions', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('mixed', [challengeFor('compare_two'), challengeFor('order_three')]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.workspace!.expectedAnswer).toBe('pencil');
  h.say('the pencil'); h.feedback('correct', 'advance');
  expect(h.state().task!.itemId).toBe('order_three');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  h.touch('ruler', 'pencil', 'crayon'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit.mock.calls[0].slice(0, 2)).toEqual([true, 100]);
});

it('the packet carries learner signals for the current item', () => {
  const h = mount('compare_two', [challengeFor('compare_two')]);
  act(() => h.transport.publish());
  const packet = h.sent.filter(m => m.type === 'runtime_state').at(-1).state;
  expect(packet.learner.signals).toMatchObject({ itemId: 'compare_two', attempts: 0, learnerTurns: 0, helpRequests: 0 });
  h.transport.close();
});

it('advertises every catalog mode under tutor ownership, inside the guidance cap', () => {
  expect([...compareObjectsLive.modes].sort()).toEqual((getComponentById('compare-objects')?.evalModes ?? []).map(m => m.evalMode).sort());
  expect(compareObjectsLive).toMatchObject({ teachingOwner: 'tutor', canAdvance: false, tutoring: null, bindsTeachingWorkspace: true });
  expect(compareObjectsLive.guidance.length).toBeLessThanOrEqual(2000);
  expect(compareObjectsLive.guidance).not.toMatch(/say exactly/i);
});
