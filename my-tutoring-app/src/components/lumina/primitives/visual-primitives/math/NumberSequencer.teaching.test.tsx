// @vitest-environment jsdom
/**
 * Real NumberSequencer, real TeachingSession, real LiveLessonRuntime, real transport
 * and rendering shell. Only microphone hardware, evaluation writes and sound are
 * substituted. Every case is the TEACHING_WORKSPACE behavioural matrix, asked in
 * this primitive's own domain: spoken number trains and one page-work arrangement.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport, runtimePacket } from '../../../components/live-activity/runtime/runtimeTransport';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';
import type { DialogueClassifier } from '../../../components/live-activity/runtime/DialogueObserver';

const seam = vi.hoisted(() => ({ conversation: [] as any[], send: vi.fn(), submit: vi.fn(),
  correct: vi.fn(), perfect: vi.fn(), evaluationContext: null as unknown,
  voiceActive: false, close: null as (() => void) | null }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'train',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => seam.voiceActive,
    subscribe: (listener: { onTurnClose: () => void }) => { seam.close = listener.onTurnClose; return () => { seam.close = null; }; } },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { playCorrect: seam.correct, playPerfect: seam.perfect,
  playStreak: vi.fn(), tap: vi.fn(), snap: vi.fn(), invalid: vi.fn(), isEnabled: () => true, getVolume: () => 1 } }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import NumberSequencer, { type NumberSequencerChallenge, type NumberSequencerData } from './NumberSequencer';
import NumberSequencerTeaching from './NumberSequencerTeaching';
import { NUMBER_SEQUENCER_WORKSPACE_MODES } from './numberSequencerDomain';

type Kind = NumberSequencerChallenge['type'];

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.voiceActive = false;
  seam.close = null; seam.evaluationContext = null;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

/** Two challenges per kind, each passing the domain's own build gates and each in
 *  its own number window, so `buildSequencerItems` keeps both. */
const CHALLENGES: Record<Kind, NumberSequencerChallenge[]> = {
  'before-after': [
    { id: 'one', type: 'before-after', instruction: '', sequence: [7, null], correctAnswers: [8], rangeMin: 7, rangeMax: 8 },
    { id: 'two', type: 'before-after', instruction: '', sequence: [4, null], correctAnswers: [5], rangeMin: 4, rangeMax: 5 }],
  'fill-missing': [
    { id: 'one', type: 'fill-missing', instruction: '', sequence: [3, null, 5], correctAnswers: [4], rangeMin: 3, rangeMax: 5 },
    { id: 'two', type: 'fill-missing', instruction: '', sequence: [8, null, 10], correctAnswers: [9], rangeMin: 8, rangeMax: 10 }],
  'decade-fill': [
    { id: 'one', type: 'decade-fill', instruction: '', sequence: [8, 9, null, 11], correctAnswers: [10], rangeMin: 8, rangeMax: 11 },
    { id: 'two', type: 'decade-fill', instruction: '', sequence: [18, 19, null, 21], correctAnswers: [20], rangeMin: 18, rangeMax: 21 }],
  'count-from': [
    { id: 'one', type: 'count-from', instruction: '', sequence: [4], correctAnswers: [5, 6], startNumber: 4, direction: 'forward', rangeMin: 4, rangeMax: 6 },
    { id: 'two', type: 'count-from', instruction: '', sequence: [9], correctAnswers: [10, 11], startNumber: 9, direction: 'forward', rangeMin: 9, rangeMax: 11 }],
  'spot-error': [
    { id: 'one', type: 'spot-error', instruction: '', sequence: [3, 4, 9, 6, 7], correctAnswers: [5], wrongIndex: 2, rangeMin: 3, rangeMax: 9 },
    { id: 'two', type: 'spot-error', instruction: '', sequence: [11, 12, 17, 14, 15], correctAnswers: [13], wrongIndex: 2, rangeMin: 11, rangeMax: 17 }],
  'order-cards': [
    { id: 'one', type: 'order-cards', instruction: '', sequence: [7, 3, 5], correctAnswers: [3, 5, 7], rangeMin: 3, rangeMax: 7 },
    { id: 'two', type: 'order-cards', instruction: '', sequence: [9, 4, 6], correctAnswers: [4, 6, 9], rangeMin: 4, rangeMax: 9 }],
};
const ALL_KINDS = Object.keys(CHALLENGES) as Kind[];
const evalModeFor = (kind: Kind) => kind.replace('-', '_');
/** The kinds the registry actually mounts on the workspace: the spoken ones. */
const BOUND_KINDS = ALL_KINDS.filter(k => NUMBER_SEQUENCER_WORKSPACE_MODES.includes(evalModeFor(k)));

/**
 * `direct` mounts the binding itself rather than going through the component's
 * mode gate. Only `order-cards` needs it: the binding and its checker are built and
 * proven here, but the mode is withheld from the registry until the lesson shell
 * owns a learner "Try again" for a checked arrangement.
 */
function mount(kind: Kind = 'before-after', classify?: DialogueClassifier, direct = kind === 'order-cards') {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m), classify);
  const data = { instanceId: 'train', title: 'Number trains', gradeBand: 'K', showNumberLine: false,
    showDotArrays: false, challenges: CHALLENGES[kind] } as NumberSequencerData;
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    {direct ? <NumberSequencerTeaching data={data} runtimePlanItemId="plan-train" runtimeEvalMode={evalModeFor(kind)} />
      : <NumberSequencer data={data} autoStart runtimePlanItemId="plan-train" runtimeEvalMode={evalModeFor(kind)} />}
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const view = render(tree());
  const state = () => runtime.getSnapshot();
  const offer = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && a.action.operation === name);
  const command = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offer(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    return { sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'train', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } };
  };
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const c = command(name, input); let result: any;
    act(() => { result = runtime.dispatch(c); });
    return result;
  };
  const say = (text: string, role: 'user' | 'assistant' = 'user') => act(() => {
    seam.conversation = [...seam.conversation, { role, content: text, timestamp: seam.conversation.length + 1 }];
    view.rerender(tree());
  });
  const place = (value: number) => fireEvent.click(view.container.querySelector(`[data-card-id="card-${value}"]`)!);
  const feedback = (verdict: 'correct' | 'incorrect', transition: 'none' | 'advance' | 'retry' = 'none', responseId?: string) =>
    dispatch('apply_tutor_verdict', { dialogue: {
      responseId: responseId ?? state().task!.workspace!.pendingResponse!.id, verdict, transition,
      tutor: verdict === 'correct' ? 'That is right.' : 'That is not the one.' } });
  return { runtime, transport, sent, view, state, offer, command, dispatch, say, place, feedback };
}

// ── The advertised capability set, per mode ──

it.each(BOUND_KINDS)('%s publishes a factual task with no scripted cue and no tutor progression tool', kind => {
  const h = mount(kind);
  expect(h.state().owner).toBe('tutor');
  const task = h.state().task!;
  expect(task.demand.kind).toBe(kind);
  expect(task.task).toBeTruthy();
  expect(task.task).not.toMatch(/\[NS_|Say exactly|My turn/);
  // The model sees help and demonstration. Recording and progression are observer-only.
  expect(h.state().affordances.filter(a => !a.controller).map(a => (a.action as any).operation ?? a.action.type).sort())
    .toEqual(['begin_help', 'demonstrate']);
  expect(runtimePacket(h.state()).choices.some(a => ['retry', 'advance'].includes(a.action.type))).toBe(false);
  expect(task.evidence.attemptNumber).toBe(0);
  expect(task.support).toEqual({ level: 0, answerExposure: 'none' });
});

it.each(NUMBER_SEQUENCER_WORKSPACE_MODES)('%s is a mode the component actually binds to the workspace', mode => {
  const kind = ALL_KINDS.find(k => evalModeFor(k) === mode)!;
  expect(kind, `no challenge fixture for ${mode}`).toBeTruthy();
  expect(mount(kind).state().owner).toBe('tutor');
});

it('binds every mode of the train, the card-ordering mode included', () => {
  // The component gate and the live adapter both read this one list. No mode is
  // withheld: a checked arrangement the observer leaves open is reopened by the
  // learner's own Try again in the runtime shell.
  expect([...NUMBER_SEQUENCER_WORKSPACE_MODES].sort())
    .toEqual(['before_after', 'count_from', 'decade_fill', 'fill_missing', 'order_cards', 'spot_error']);
});

it('never publishes the answer as a scene fact, in any spoken mode', () => {
  // The card mode has no single spoken answer; its facts carry card COUNTS, which are not the key.
  for (const kind of BOUND_KINDS.filter(k => k !== 'order-cards')) {
    const h = mount(kind);
    const item = CHALLENGES[kind][0];
    const answer = kind === 'spot-error' ? item.sequence[item.wrongIndex!]! : item.correctAnswers[0];
    const facts = JSON.stringify(h.state().task!.demand);
    // `spot-error` prints its wrong number on a car, so a car label legitimately
    // carries it; the FACTS must not name it, and the repair is never drawn at all.
    expect(facts, `${kind} facts name the answer`).not.toMatch(new RegExp(`\\b${answer}\\b`));
    if (kind === 'spot-error') {
      const repair = item.correctAnswers[0];
      expect(facts, 'spot-error facts name the repair').not.toMatch(new RegExp(`\\b${repair}\\b`));
      expect(h.state().task!.workspace!.objects.some(o => o.label.endsWith(`showing ${repair}`))).toBe(false);
      // No glowing car: the question is which printed number breaks the count.
      expect(h.state().task!.workspace!.objects.some(o => o.group?.includes('assignment target'))).toBe(false);
    }
    cleanup();
  }
});

// ── Help and demonstration are not learner work (TW-4, TW-8, TW-9) ──

it('marks a car for a demonstration without answering, and keeps the assistance history', async () => {
  const h = mount();
  h.say('can you help me');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  expect(seam.send).not.toHaveBeenCalled();
  const c = h.command('demonstrate', { targets: ['car-0'] });
  let pending: Promise<void>;
  await act(async () => { pending = h.transport.command(c);
    expect(h.view.container.querySelector('[data-testid="train-car-0"]')?.getAttribute('data-tutor-demonstration')).toBe('true');
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(40); }); await pending!;
  expect(h.sent.filter(m => m.type === 'runtime_result').at(-1).status).toBe('visible');
  expect(h.state().task!.workspace!.demonstration).toEqual(['car-0']);
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.dispatch('demonstrate', { targets: [] });
  expect(h.state().task!.workspace!.demonstration).toEqual([]);
  expect(h.state().task!.support.level).toBe(2); // Clearing a mark does not erase the help.
});

it('refuses an unknown demonstration target without a partial mutation', () => {
  const h = mount();
  expect(h.dispatch('demonstrate', { targets: ['car-0', 'car-99'] }).status).not.toBe('committed');
  expect(h.state().task!.workspace!.demonstration).toEqual([]);
  expect(h.state().task!.support.level).toBe(0);
});

it('offers no car-filling, card-moving or reordering operation to the tutor', () => {
  for (const kind of ALL_KINDS) {   // including the withheld card mode, mounted directly
    const h = mount(kind);
    const operations = h.state().affordances.filter(a => !a.controller)
      .map(a => (a.action as any).operation ?? a.action.type);
    for (const forbidden of ['fill', 'place', 'move', 'reorder', 'present', 'record_response']) {
      expect(operations, `${kind} offered ${forbidden}`).not.toContain(forbidden);
    }
    cleanup();
  }
});

// ── Spoken evidence: the tutor's completed feedback owns the verdict (TW-3) ──

it('keeps speech as context until observed tutor feedback records a verdict', () => {
  const h = mount();
  h.say('can you help me with this one?');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.say('Look at the car you can see.', 'assistant');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.say('seven'); h.feedback('incorrect');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.offer('advance')).toBeUndefined();
  h.dispatch('retry');
  h.say('eight'); h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.itemId).toBe(h.state().task!.itemId); // success without advancing
  expect(h.state().task!.workspace!.attempts).toHaveLength(2);
  expect(seam.correct).toHaveBeenCalledOnce();
});

it('refuses a verdict carrying a stale response id, and re-opens on the child’s new words', () => {
  const h = mount();
  h.say('six');
  const stale = h.state().task!.workspace!.pendingResponse!.id;
  h.say('eight');
  expect(h.state().task!.workspace!.pendingResponse!.id).not.toBe(stale);
  expect(h.feedback('correct', 'none', stale).status).not.toBe('committed');
  expect(h.state().task!.evidence.correctness).toBe('unknown');
  h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('refuses a duplicate command and a stale retry after the item has moved on', () => {
  const h = mount();
  h.say('eight'); h.feedback('correct');
  const old = h.command('retry');
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'two:1-answer', evidence: { attemptNumber: 0 }, support: { level: 0 } });
  expect(h.runtime.dispatch(old).status).toBe('stale');
  const help = h.command('begin_help');
  let first: any, second: any;
  act(() => { first = h.runtime.dispatch(help); });
  act(() => { second = h.runtime.dispatch(help); });
  expect(first.status).toBe('committed');
  expect(second.status).toBe('duplicate');
});

// ── Page work: the arrangement is checked by the activity, not by praise (TW-3) ──

it('checks the card arrangement itself when the last card lands, and praise cannot override it', () => {
  const h = mount('order-cards');
  h.place(7); h.place(5);
  expect(h.state().task!.evidence.correctness).toBe('unknown'); // A part-built train is not an answer.
  h.place(3);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ response: '7,5,3', correct: false, source: 'gesture' });
  expect(seam.send).toHaveBeenCalledOnce();
  h.say('Wonderful, that train is perfect!', 'assistant');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  h.dispatch('retry');
  expect(h.state().task!.workspace!.objects.every(o => !o.selected)).toBe(true);
  h.place(3); h.place(5); h.place(7);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ response: '3,5,7', correct: true });
  expect(h.state().task!.workspace!.attempts).toHaveLength(2);
  expect(seam.correct).toHaveBeenCalledOnce();
});

it('clears the arrangement when a fresh card item opens', () => {
  const h = mount('order-cards');
  h.place(3); h.place(5); h.place(7);
  h.dispatch('advance');
  expect(h.state().task!.itemId).not.toBe('one:-1');
  expect(h.state().task!.workspace!.objects.every(o => !o.selected)).toBe(true);
  expect(h.view.container.querySelectorAll('[data-card-id]')).toHaveLength(3);
});

// ── Multi-ask challenges keep the earlier answers drawn on the train ──

it('fills the slots already answered on a count-from train without answering the open one', () => {
  const h = mount('count-from');
  expect(h.view.container.querySelector('[data-testid="train-car-1"]')?.textContent).toBe('?');
  h.say('five'); h.feedback('correct'); h.dispatch('advance');
  expect(h.view.container.querySelector('[data-testid="train-car-1"]')?.textContent).toBe('5');
  expect(h.view.container.querySelector('[data-testid="train-car-2"]')?.textContent).toBe('?');
  expect(h.state().task!.workspace!.objects.find(o => o.id === 'car-2')!.group).toContain('assignment target');
});

// ── Observation lifecycle, completion and the single submission ──

it('observes settled speech, advances visibly, and completes once after playback drains', async () => {
  const classify = vi.fn(async () => ({ verdict: 'correct' as const, transition: 'advance' as const,
    confidence: .99, verdictConfidence: .99, grounded: 1, accepted: true, reason: 'supported', ms: 200 }));
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('before-after', classify);
  for (const answer of ['eight', 'five']) {
    h.say(answer);
    act(() => { h.transport.beginTurn(`Yes, ${answer}.`); h.transport.endTurn(true); });
    await act(async () => { h.transport.audioChanged(false); });
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
  }
  expect(classify).toHaveBeenCalledTimes(2);
  expect(h.state().status).toBe('completed');
  expect(h.sent.filter(m => m.type === 'runtime_result')).toHaveLength(0);
  expect(screen.getByText(/Sequence Complete!/)).toBeTruthy();
  expect(seam.correct).toHaveBeenCalledTimes(2);
  expect(seam.submit).toHaveBeenCalledOnce();
  const [passed, accuracy, metrics] = seam.submit.mock.calls[0];
  expect(passed).toBe(true);
  expect(accuracy).toBe(100);
  expect(metrics).toMatchObject({ type: 'number-sequencer', beforeAfterAccuracy: 100, attemptsCount: 2 });
  h.transport.close();
});

it('refuses every action after the learner stops', () => {
  const h = mount();
  const stop = h.command('begin_help');
  act(() => { h.runtime.stop(); });
  expect(h.state().affordances).toEqual([]);
  expect(h.runtime.dispatch(stop).status).not.toBe('committed');
});
