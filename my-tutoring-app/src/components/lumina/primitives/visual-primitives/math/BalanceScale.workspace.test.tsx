// @vitest-environment jsdom
/**
 * W1 minimal binding: the real BalanceScale family (all three surfaces the default export routes
 * to) on the shared teaching workspace, with the real TeachingSession, LiveLessonRuntime, transport
 * and rendering shell. Only microphone hardware, evaluation writes, sound and the legacy AI-context
 * hook are substituted. The scripted runner must never mount on this path.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

const seam = vi.hoisted(() => ({ conversation: [] as any[], send: vi.fn(), submit: vi.fn(), legacy: vi.fn(),
  runner: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'scale',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: (o: { enabled?: boolean }) => {
  if (o.enabled !== false) seam.legacy();
  return { sendText: seam.legacy, isConnected: true, isAudioPlaying: false, activePrimitiveId: 'scale' };
} }));
vi.mock('../../../hooks/useJudgedScriptRunner', () => ({ useJudgedScriptRunner: () => { seam.runner(); throw new Error('runner mounted'); } }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import BalanceScale, { type BalanceScaleChallenge, type BalanceScaleData } from './BalanceScale';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { getComponentById } from '../../../service/manifest/catalog';
const balanceLive = LIVE_ADAPTERS['balance-scale'];

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.evaluationContext = null; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const x = (parcels = 1) => ({ value: parcels, isVariable: true });
const ch = (type: BalanceScaleChallenge['type'], leftSide: any[], rightSide: any[], variableValue: number): BalanceScaleChallenge =>
  ({ type, leftSide, rightSide, variableValue, instruction: `Solve ${type}.`, hint: 'Keep it balanced.' });
/** One valid challenge per catalog mode, each satisfying its surface's own builder. */
const CHALLENGE: Record<string, BalanceScaleChallenge> = {
  equality: ch('equality', [x()], [{ value: 5 }], 5),
  equality_hard: ch('equality_hard', [x()], [{ value: 4 }], 4),
  one_step: ch('one_step', [x(), { value: 3 }], [{ value: 8 }], 5),
  one_step_hard: ch('one_step_hard', [x(2)], [{ value: 6 }], 3),
  two_step_intro: ch('two_step_intro', [x(2), { value: 1 }], [{ value: 7 }], 3),
  two_step: ch('two_step', [x(2), { value: 1 }], [{ value: 7 }], 3),
};

function mount(evalMode: string, challenges: BalanceScaleChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data = { instanceId: 'scale', title: 'Balance', description: 'Balance it.', gradeBand: 'K-2', leftSide: [], rightSide: [],
    variableValue: 0, challenges } as BalanceScaleData;
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <BalanceScale data={data} runtimePlanItemId="plan-scale" runtimeEvalMode={evalMode} />
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
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'scale',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
  };
  const press = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const settle = () => act(() => { vi.advanceTimersByTime(2000); });
  const say = (text: string) => act(() => {
    seam.conversation = [...seam.conversation, { role: 'user', content: text, timestamp: seam.conversation.length + 1 }];
    view.rerender(tree());
  });
  const feedback = (verdict: 'correct' | 'incorrect', transition: 'none' | 'advance' | 'retry' = 'none') =>
    dispatch('apply_tutor_verdict', { dialogue: { responseId: state().task!.workspace!.pendingResponse!.id, verdict, transition,
      tutor: verdict === 'correct' ? 'Yes, that is right.' : 'Not quite.' } });
  /** Advance a solved item and show its receipt, as the shell does. */
  const next = () => { dispatch('advance'); confirmVisible(); };
  return { runtime, transport, sent, view, state, offer, dispatch, confirmVisible, press, settle, say, feedback, next };
}

const tutorTools = (h: ReturnType<typeof mount>) => h.state().affordances.filter(a => !a.controller)
  .map(a => (a.action as { operation?: string }).operation ?? a.action.type).sort();

it.each(Object.keys(CHALLENGE))('%s binds the workspace under tutor ownership; its hands key is never published', mode => {
  const h = mount(mode, [CHALLENGE[mode]]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).not.toMatch(/Say exactly|\[B[EW]_/);
  expect(tutorTools(h)).toEqual(['begin_help']);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  // The scene names what is drawn; the weight being found is never one of its facts.
  expect(String(h.state().task!.demand!.scale)).not.toMatch(new RegExp(`(weighs|weight|target|x =) ${CHALLENGE[mode].variableValue}\\b`));
  expect(seam.runner).not.toHaveBeenCalled();
  expect(seam.legacy).not.toHaveBeenCalled();
  expect(seam.send.mock.calls.flat().join(' ')).not.toMatch(/\[B[EW]_|Say exactly/);
});

it('equality: exploration never commits, a balanced load does, and the spoken steps publish their key', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('equality', [CHALLENGE.equality]);
  h.press('Add 3 weight'); h.settle();
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.press('Add 2 weight'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(seam.send.mock.calls.at(-1)![1]).toMatchObject({ author: 'host' });
  h.next();
  expect(h.state().task!.itemId).toBe('balance-1-total');
  expect(h.state().task!.workspace!.expectedAnswer).toBe('5');
  h.say('six'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.state().task!.phase).toBe('working');
  h.say('five'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('balance-1-infer');
  h.say('five'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ evalMode: 'equality', totalChallenges: 1, correctCount: 1 });
  expect(seam.runner).not.toHaveBeenCalled();
});

it('one_step (workshop): the completed load commits, then the added weight is spoken', () => {
  const h = mount('one_step', [CHALLENGE.one_step]);
  h.press('Add 5 weight'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.next();
  expect(h.state().task!.itemId).toBe('workshop-1-added');
  expect(h.state().task!.workspace!.expectedAnswer).toBe('5');
  expect(screen.queryByText('Say that again')).toBeNull();
});

it('two_step (workshop): separate and share commit through the real controls; the explanation is spoken', () => {
  const h = mount('two_step', [CHALLENGE.two_step]);
  h.press('Set aside known 1 weight'); h.press('Unit 1'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.next();
  expect(h.state().task!.workspace!.expectedAnswer).toBe('6');
  h.say('six'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('workshop-1-share');
  h.press('Place unit in group 1'); h.settle();
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  for (let i = 0; i < 2; i++) h.press('Place unit in group 1');
  for (let i = 0; i < 3; i++) h.press('Place unit in group 2');
  h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.next();
  for (const said of ['three', 'three']) { h.say(said); h.feedback('correct', 'advance'); h.confirmVisible(); }
  expect(h.state().task!.itemId).toBe('workshop-1-explain');
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/one equal group per parcel/);
});

it('the plain solver (mixed session): a wrong typed x is checked, Try again clears it, and a right one completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('mixed', [ch('one_step', [x(), { value: 3 }], [{ value: 5 }, { value: 3 }], 5), CHALLENGE.equality]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.itemId).toBe('bs-1');
  expect(screen.queryByText(/Show Answer/)).toBeNull();
  h.press('Start Solving');
  act(() => { fireEvent.click(screen.getAllByTitle('Click to remove 3 from both sides')[0]); });
  const typed = () => screen.getByRole('spinbutton', { name: 'Value of x' }) as HTMLInputElement;
  act(() => { fireEvent.change(typed(), { target: { value: '4' } }); });
  h.press(/^check$/i);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(typed().disabled).toBe(true);
  h.dispatch('retry');
  expect(typed().value).toBe('');
  act(() => { fireEvent.change(typed(), { target: { value: '5' } }); });
  h.press(/^check$/i);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(screen.queryByRole('button', { name: /Next Equation/ })).toBeNull();
  h.next();
  expect(h.state().task!.itemId).toBe('bs-2');
  expect(seam.legacy).not.toHaveBeenCalled();
});

it('the packet carries learner signals for the current item', () => {
  const h = mount('equality', [CHALLENGE.equality]);
  act(() => h.transport.publish());
  const packet = h.sent.filter(m => m.type === 'runtime_state').at(-1).state;
  expect(packet.learner.signals).toMatchObject({ itemId: 'balance-1-build', attempts: 0, learnerTurns: 0, helpRequests: 0 });
  h.transport.close();
});

it('advertises every catalog mode under tutor ownership, inside the guidance cap', () => {
  expect([...balanceLive.modes].sort()).toEqual((getComponentById('balance-scale')?.evalModes ?? []).map(m => m.evalMode).sort());
  expect(balanceLive).toMatchObject({ teachingOwner: 'tutor', canAdvance: false, tutoring: null, bindsTeachingWorkspace: true });
  expect(balanceLive.guidance.length).toBeLessThanOrEqual(2000);
  expect(balanceLive.guidance).not.toMatch(/say exactly/i);
});
