// @vitest-environment jsdom
/**
 * W1 minimal binding: the real TenFrame on the shared teaching workspace, with the
 * real TeachingSession, LiveLessonRuntime, transport and rendering shell. Only
 * microphone hardware, evaluation writes and sound are substituted. The scripted
 * runner must never mount on this path; its context push would crash on this
 * AI mock, which has no `updateContext`.
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
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'frame',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { playCorrect: seam.correct, playPerfect: vi.fn(),
  playStreak: vi.fn(), tap: vi.fn(), snap: vi.fn(), invalid: vi.fn(), isEnabled: () => true, getVolume: () => 1 } }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import TenFrame, { type TenFrameChallenge, type TenFrameData } from './TenFrame';
import { tenFrameItems } from './tenFrame.boss';
/** The submission waits for the scoring pass (a fetch that rejects in jsdom, so every spoken attempt keeps its flow verdict). */
const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.evaluationContext = null;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const challenge = (id: string, type: TenFrameChallenge['type'], targetCount: number, extra: Partial<TenFrameChallenge> = {}): TenFrameChallenge =>
  ({ id, type, targetCount, instruction: 'Use the frame.', hint: '', narration: '', ...extra });

function mount(evalMode: string, challenges: TenFrameChallenge[], gradeBand: 'K' | '1-2' = 'K') {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data: TenFrameData = { instanceId: 'frame', title: 'Frame', gradeBand, counters: { count: 0, color: 'red', positions: [] },
    mode: challenges.some(c => c.type.endsWith('_teen')) ? 'double' : 'single', challenges };
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <TenFrame data={data} runtimePlanItemId="plan-frame" runtimeEvalMode={evalMode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const view = render(tree());
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  // The transport confirms a painted response; this test drives the runtime directly.
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const offer = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && a.action.operation === name);
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offer(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    let result: any;
    const commandId = crypto.randomUUID(); lastCommand = commandId;
    act(() => { result = runtime.dispatch({ sessionEpoch: 'test', commandId, instanceId: 'frame',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
    return result;
  };
  const tap = (...cells: number[]) => { for (const n of cells) act(() => {
    fireEvent.click(view.container.querySelector(`[data-pip-object="cell-${n}"]`)!); }); };
  const settle = () => act(() => { vi.advanceTimersByTime(3000); });
  const counters = () => view.container.querySelectorAll('circle').length;
  const say = (text: string) => act(() => {
    seam.conversation = [...seam.conversation, { role: 'user', content: text, timestamp: seam.conversation.length + 1 }];
    view.rerender(tree());
  });
  const feedback = (verdict: 'correct' | 'incorrect', transition: 'none' | 'advance' | 'retry' = 'none') =>
    dispatch('apply_tutor_verdict', { dialogue: { responseId: state().task!.workspace!.pendingResponse!.id, verdict, transition,
      tutor: verdict === 'correct' ? 'Yes, you saw five.' : 'Not quite.' } });
  return { runtime, transport, sent, view, state, offer, dispatch, confirmVisible, tap, settle, counters, say, feedback };
}

const tutorTools = (h: ReturnType<typeof mount>) => h.state().affordances.filter(a => !a.controller)
  .map(a => (a.action as { operation?: string }).operation ?? a.action.type).sort();

it.each([
  ['build', [challenge('b1', 'build', 4)], 'K'],
  ['make_ten', [challenge('m1', 'make_ten', 6)], 'K'],
  ['decompose', [challenge('d1', 'split', 5)], 'K'],
  ['build_teen', [challenge('t1', 'build_teen', 13)], 'K'],
  ['decompose_teen', [challenge('t1', 'decompose_teen', 14)], 'K'],
  ['operate', [challenge('o1', 'add', 7, { addend1: 3, addend2: 4 })], '1-2'],
  ['subitize', [challenge('s1', 'subitize', 5)], 'K'],
] as const)('%s binds the workspace under tutor ownership, with no runner cue and no demonstration', (mode, challenges, band) => {
  const h = mount(mode, [...challenges], band);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).not.toMatch(/Say exactly|\[TF_/);
  // Every kind declares in-item levers (tenFrameLevers.ts).
  expect(tutorTools(h)).toEqual(mode === 'subitize' ? ['begin_help', 'present', 'pull_lever'] : ['begin_help', 'pull_lever']);
  expect(seam.send.mock.calls.flat().join(' ')).not.toMatch(/\[TF_|Say exactly/);
});

it('build: the frame checks a still placement, Try again clears it, and a right one completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('build', [challenge('b1', 'build', 4)]);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  h.tap(0, 1, 2);
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.settle();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('3 counters on the frame');
  expect(h.offer('advance')).toBeUndefined();
  h.tap(3);
  expect(h.counters()).toBe(3);
  h.dispatch('retry');
  expect(h.counters()).toBe(0);
  h.tap(0, 1, 2, 3); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.view.container.textContent).toContain('4 counters!');
  h.dispatch('advance');
  expect(h.state().status).not.toBe('completed');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [passed, accuracy, metrics] = seam.submit.mock.calls[0];
  expect([passed, accuracy, metrics.evalMode]).toEqual([true, 67, 'build']);
  expect(seam.correct).toHaveBeenCalledOnce();
});

it('K make_ten commits the moment the frame is full, with no stillness wait', () => {
  const h = mount('make_ten', [challenge('m1', 'make_ten', 6)]);
  expect(h.counters()).toBe(6);
  h.tap(6, 7, 8, 9);
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('decompose: a repeated pair is checked wrong while another way remains', () => {
  const h = mount('decompose', [challenge('d1', 'split', 5), challenge('d2', 'split', 5)]);
  h.tap(0, 1); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.view.container.textContent).toContain('3 + 2 = 5');
  h.dispatch('advance');
  h.tap(0, 1); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(seam.send.mock.calls.at(-1)![0]).toContain('3 red and 2 yellow');
  h.dispatch('retry');
  h.tap(0); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('subitize: speech waits for the presented flash, and a credited answer restores the counters', () => {
  const h = mount('subitize', [challenge('s1', 'subitize', 5, { flashDuration: 1000 })]);
  expect(h.counters()).toBe(0);
  h.say('five');
  expect(h.state().task!.workspace!.pendingResponse).toBeUndefined();
  h.dispatch('present');
  expect(h.counters()).toBe(5);
  act(() => { vi.advanceTimersByTime(1000); });
  expect(h.counters()).toBe(0);
  expect(h.state().task!.demand.presentation).toBe('ready');
  h.say('five');
  expect(h.state().task!.workspace!.pendingResponse).toMatchObject({ text: 'five' });
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/^"five"\./);
  h.feedback('correct');
  expect(h.counters()).toBe(5);
  expect(h.view.container.textContent).toContain('5 — five counters!');
});

it('subitize: a retry keeps a presented quick look answerable; a re-show is assisted', () => {
  const h = mount('subitize', [challenge('s1', 'subitize', 3, { flashDuration: 1000 })]);
  h.dispatch('present');
  act(() => { vi.advanceTimersByTime(1000); });
  h.say('four'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.phase).toBe('working');
  expect(h.state().task!.demand.presentation).toBe('ready');
  expect(h.counters()).toBe(0);
  h.say('three');
  expect(h.state().task!.workspace!.pendingResponse).toMatchObject({ text: 'three' });
  h.dispatch('present');
  expect(h.state().task!.support.level).toBe(2);
});

it('subitize: the learner can start the first look, unassisted, when the tutor has not presented', () => {
  const h = mount('subitize', [challenge('s1', 'subitize', 4, { flashDuration: 1000 })]);
  const show = () => Array.from(h.view.container.querySelectorAll('button')).find(b => b.textContent === 'Show me');
  act(() => { fireEvent.click(show()!); });
  expect(h.counters()).toBe(4);
  expect(show()).toBeUndefined();
  act(() => { vi.advanceTimersByTime(1000); });
  expect(h.state().task!.demand.presentation).toBe('ready');
  expect(h.state().task!.support.level).toBe(0);
});

it.each(['mixed', 'build|subitize|decompose'])('a %s pin binds, and each item keeps its own kind across transitions', async pin => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(pin, [challenge('b1', 'build', 2), challenge('s1', 'subitize', 3, { flashDuration: 1000 }),
    challenge('d1', 'split', 4)]);
  expect(h.state().owner).toBe('tutor');
  // build: a placement, no quick look on offer; its levers are
  expect(tutorTools(h)).toEqual(['begin_help', 'pull_lever']);
  h.tap(0, 1); h.settle();
  h.dispatch('advance');
  // subitize: the frame from build is gone, the counters are hidden, and only now is present offered
  expect(h.state().task!.itemId).toBe('s1');
  expect(h.counters()).toBe(0);
  expect(tutorTools(h)).toEqual(['begin_help', 'present', 'pull_lever']);
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/^"three"\./);
  h.dispatch('present'); act(() => { vi.advanceTimersByTime(1000); });
  h.say('three'); h.feedback('correct', 'advance');
  // split: the whole group arrives, taps flip, and no spoken key is published
  expect(h.state().task!.itemId).toBe('d1');
  expect(h.counters()).toBe(4);
  expect(tutorTools(h)).toEqual(['begin_help', 'pull_lever']);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  h.tap(0); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0].slice(0, 2)).toEqual([true, 100]);
});

// The stage pins the scripted-path reader-fit suite held (contract R2, R4, R9, R10), on the workspace mount.
const cells = (h: ReturnType<typeof mount>) => h.view.container.querySelectorAll('[data-pip-object^="cell-"]').length;

it('decompose: the group arrives all red, empty boxes are inert, and a flip turned back leaves one group (R9)', () => {
  const h = mount('decompose', [challenge('d1', 'split', 5)]);
  expect(h.counters()).toBe(5);
  h.tap(7); h.settle();
  expect(h.counters()).toBe(5);
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.tap(0, 0); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.view.container.textContent).not.toMatch(/Counters:|\d \+ \d/);
});

it('build_teen: twenty boxes at K, the ten is fixed, and a full frame waits for stillness (R2 fork, R10)', () => {
  const h = mount('build_teen', [challenge('t1', 'build_teen', 13)]);
  expect(cells(h)).toBe(20);
  expect(h.counters()).toBe(10);
  h.tap(0);
  expect(h.counters()).toBe(10);
  h.tap(...Array.from({ length: 10 }, (_, i) => 10 + i));
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.settle();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  h.dispatch('retry');
  expect(h.counters()).toBe(10);
  h.tap(10, 11, 12); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.view.container.textContent).toContain('10 + 3 = 13');
});

it('decompose_teen: the group is scattered so no frame is full; ten turned yellow is right (R10)', () => {
  const h = mount('decompose_teen', [challenge('t1', 'decompose_teen', 14)]);
  const [item] = tenFrameItems({ challenges: [challenge('t1', 'decompose_teen', 14)], mode: 'double', gradeBand: 'K' });
  expect(h.counters()).toBe(14);
  expect([0, 1].map(f => item.seedCells!.filter(c => Math.floor(c / 10) === f).length)).not.toContain(10);
  h.tap(...item.seedCells!.slice(0, 10)); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.view.container.textContent).toContain('10 + 4 = 14');
});

it('operate: the frame is a working surface with no count readout, which would be the spoken answer', () => {
  const h = mount('operate', [challenge('o1', 'add', 7, { addend1: 3, addend2: 4 })], '1-2');
  h.tap(0, 1, 2); h.settle();
  expect(h.counters()).toBe(3);
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  expect(h.view.container.querySelector('[data-lever="running-count"]')).toBeNull();
});
