// @vitest-environment jsdom
/** Real surface, session, runtime and transport. Only hardware/persistence are replaced. */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';
import type { DialogueClassifier } from '../../../components/live-activity/runtime/DialogueObserver';
import type { LearnerIntentClassifier } from '../../../components/live-activity/runtime/LearnerObserver';
import { runtimePacket } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ conversation: [] as any[], send: vi.fn(), submit: vi.fn(),
  correct: vi.fn(), perfect: vi.fn(), streak: vi.fn(),
  voiceActive: false, close: null as (() => void) | null }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'board',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => seam.voiceActive,
    subscribe: (listener: { onTurnClose: () => void }) => { seam.close = listener.onTurnClose; return () => { seam.close = null; }; } },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { playCorrect: seam.correct, playPerfect: seam.perfect,
  playStreak: seam.streak, tap: vi.fn(), invalid: vi.fn(), isEnabled: () => true, getVolume: () => 1 } }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import CountingBoard, { type CountingBoardChallenge, type CountingBoardData } from './CountingBoard';
import { evalModeForKind } from './countingBoardDomain';

type Kind = CountingBoardChallenge['type'];
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.voiceActive = false; seam.close = null;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function challenge(kind: Kind, id: string): CountingBoardChallenge {
  const base = { id, type: kind, instruction: 'Count the stars.', arrangement: 'scattered' as const, hint: '', narration: '', count: 5, targetAnswer: 5 };
  switch (kind) {
    case 'give_me_n': return { ...base, count: 8, targetAnswer: 3 };
    case 'count_on': return { ...base, count: 8, targetAnswer: 8, startFrom: 5 };
    case 'group_count': return { ...base, count: 6, targetAnswer: 6, arrangement: 'groups', groupSize: 2 };
    case 'compare': return { ...base, count: 7, targetAnswer: 4, arrangement: 'groups', compareGroups: [3, 4] };
    case 'take_away': return { ...base, count: 6, targetAnswer: 4, changeBy: 2 };
    case 'add_more': return { ...base, count: 4, targetAnswer: 6, changeBy: 2 };
    case 'subitize_perceptual': return { ...base, count: 3, targetAnswer: 3 };
    default: return base;
  }
}

async function mount(kind: Kind = 'give_me_n', classify?: DialogueClassifier, classifyLearner?: LearnerIntentClassifier) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m), classify, classifyLearner);
  const data: CountingBoardData = { instanceId: 'board', title: 'Counting stars', objects: { type: 'stars' }, gradeBand: 'K',
    challenges: [challenge(kind, 'one'), challenge(kind, 'two')] };
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <CountingBoard data={data} autoStart runtimePlanItemId="plan-board" runtimeEvalMode={evalModeForKind(kind)} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const view = render(tree());
  const state = () => runtime.getSnapshot();
  const offer = (name: string) => state().affordances.find(a => a.action.type === name || a.action.type === 'workspace' && a.action.operation === name);
  const command = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offer(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    return { sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'board', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } };
  };
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const c = command(name, input); let result: any;
    act(() => { result = runtime.dispatch(c); });
    return result;
  };
  const say = (text: string, role: 'user' | 'assistant' = 'user', metadata = {}) => act(() => {
    seam.conversation = [...seam.conversation, { role, content: text, timestamp: seam.conversation.length + 1, ...metadata }];
    view.rerender(tree());
  });
  const tap = (index: number) => fireEvent.click(view.container.querySelector(`[data-pip-object="object-${index}"]`)!);
  const give = () => fireEvent.click(screen.getByRole('button', { name: /give/i, hidden: true }));
  const feedback = (verdict: 'correct' | 'incorrect') => dispatch('apply_tutor_verdict', { dialogue: {
    responseId: state().task!.workspace!.pendingResponse!.id, verdict, transition: 'none',
    tutor: verdict === 'correct' ? 'That is correct!' : 'That answer is not correct.',
  } });
  return { runtime, transport, sent, view, state, offer, command, dispatch, say, tap, give, feedback };
}

it('handles help and demonstrations without scripting speech, grading, or changing learner work', async () => {
  const h = await mount();
  h.tap(0); h.tap(1);
  h.say('can you help me');
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  expect(h.offer('record_response')).toBeUndefined();
  expect(seam.send).not.toHaveBeenCalled();
  const c = h.command('demonstrate', { targets: ['object-2'] });
  let pending: Promise<void>;
  await act(async () => { pending = h.transport.command(c);
    expect(h.view.container.querySelector('[data-pip-object="object-2"]')?.getAttribute('data-tutor-demonstration')).toBe('true');
    expect(h.state().task!.demand.markedOnBoard).toBe(2);
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(40); }); await pending!;
  expect(h.sent.filter(m => m.type === 'runtime_result').at(-1).status).toBe('visible');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.dispatch('demonstrate', { targets: [] });
  expect(h.state().task!.support.level).toBe(2);
  expect(h.state().task!.workspace!.demonstration).toEqual([]);
  expect(h.state().task!.demand.markedOnBoard).toBe(2);
});

it('keeps the actual wrong selection, allows adaptive help, and never advances at a miss cap', async () => {
  const h = await mount();
  for (let attempt = 0; attempt < 4; attempt++) {
    const given = attempt % 2 ? 2 : 4;
    for (let n = 0; n < given; n++) h.tap(n);
    h.give();
    expect(h.state().task).toMatchObject({ itemId: 'one', phase: 'checked', demand: { markedOnBoard: given },
      evidence: { attemptNumber: attempt + 1, correctness: 'incorrect' } });
    expect(h.offer('advance')).toBeUndefined();
    h.say('My turn: count as you give them to me.', 'assistant');
    expect(h.state().task!.evidence.attemptNumber).toBe(attempt + 1);
    h.dispatch('begin_help');
    h.dispatch('retry');
  }
  h.tap(0); h.tap(1); h.tap(2); h.give();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true, assisted: true });
  const old = h.command('retry');
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'two', demand: { markedOnBoard: 0 }, evidence: { attemptNumber: 0 }, support: { level: 0 } });
  expect(h.runtime.dispatch(old).status).toBe('stale');
  expect(seam.submit).not.toHaveBeenCalled(); // Dev runtime evidence is not a legacy drill mastery score.
});

it('keeps speech as context until observed tutor feedback records a verdict', async () => {
  const h = await mount('count_all');
  h.say('can you help me count five?');
  expect(h.offer('record_response')).toBeUndefined();
  h.say('Yes, five stars.', 'assistant');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.say('four'); h.feedback('incorrect');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.offer('advance')).toBeUndefined();
  h.dispatch('retry');
  expect(h.offer('record_response')).toBeUndefined();
  h.say('five'); h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.itemId).toBe('one');
  const advance = h.command('advance');
  h.say('Yeah, please. Let us continue.');
  // Conversational speech does not invalidate an already checked Next action.
  expect(h.state().revision).toBe(advance.expectedRevision);
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('two');
});

it.each(['count_all', 'count_on', 'group_count', 'compare', 'give_me_n', 'take_away', 'add_more', 'recount_moved', 'subitize', 'subitize_perceptual'] as Kind[])(
  '%s has factual state and no legacy script or automatic runner', async kind => {
    const h = await mount(kind);
    expect(h.state().owner).toBe('tutor');
    expect(h.state().task!.demand.kind).toBe(kind);
    expect(h.offer('begin_help')).toBeTruthy();
    expect(seam.send).not.toHaveBeenCalled();
  });

it('does not turn a partial numeric question into an answer', async () => {
  const h = await mount('count_all');
  h.say('five', 'user', { isAudio: true, streamId: 1, transcriptFinished: false });
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.say(' or can you help me?', 'user', { isAudio: true, streamId: 1, transcriptFinished: true });
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.say('five', 'user', { isAudio: true, streamId: 2, transcriptFinished: false });
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.say('', 'user', { isAudio: true, streamId: 2, transcriptFinished: true });
  h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('protects hidden and timed stimuli and refuses unknown targets without a partial mutation', async () => {
  const h = await mount('subitize');
  expect(h.state().task!.workspace!.objects).toEqual([]);
  h.say('five'); expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.dispatch('present');
  expect(h.state().task!.workspace!.objects).toHaveLength(5);
  expect(h.offer('demonstrate')).toBeUndefined();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(h.state().task!.workspace!.objects).toEqual([]);
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.say('five'); h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('publishes finalized speech context at the voice boundary without grading it', async () => {
  const h = await mount('count_all');
  seam.voiceActive = true;
  h.say('one two three four five', 'user', { isAudio: true, streamId: 1, transcriptFinished: true });
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  await act(async () => { seam.voiceActive = false; seam.close?.(); await Promise.resolve(); });
  expect(h.state().task!.workspace!.lastResponse).toBeNull();
  expect(h.state().task!.workspace!.pendingResponse?.text).toBe('one two three four five');
  h.feedback('correct');
  expect(h.offer('advance')).toBeTruthy();
  expect(seam.send).not.toHaveBeenCalled();
});

it('refuses invalid targets, duplicate commands, and learner mutations after stop', async () => {
  const h = await mount();
  expect(h.dispatch('demonstrate', { targets: ['object-0', 'missing'] }).status).toBe('blocked');
  expect(h.state().task!.workspace!.demonstration).toEqual([]);
  const c = h.command('demonstrate', { targets: ['object-0'] });
  act(() => { expect(h.runtime.dispatch(c).status).toBe('committed'); });
  expect(h.runtime.dispatch(c).status).toBe('duplicate');
  expect(h.runtime.dispatch({ ...c, action: { ...c.action, input: { targets: ['object-1'] } } }).status).toBe('conflict');
  act(() => h.runtime.stop());
  h.tap(1); h.give();
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  expect(h.state().task!.demand.markedOnBoard).toBe(0);
});

it('records learner stimulus replay as assistance and can present the next item', async () => {
  const h = await mount('subitize');
  h.dispatch('present');
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(h.state().task!.support.level).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Show again' }));
  expect(h.state().task!.support.level).toBe(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  h.say('five'); h.feedback('correct'); h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('two');
  expect(h.dispatch('present').status).toBe('committed');
  expect(h.state().task!.workspace!.objects).toHaveLength(5);
  expect(h.state().task!.support.level).toBe(0);
});

it('finishes once after the final checked answer and waits for speech settlement', async () => {
  const h = await mount();
  for (let n = 0; n < 3; n++) h.tap(n); h.give(); h.dispatch('advance');
  for (let n = 0; n < 3; n++) h.tap(n); h.give();
  act(() => h.transport.beginTurn());
  const final = h.command('advance');
  let pending: Promise<void>;
  await act(async () => { pending = h.transport.command(final); });
  await act(async () => { await vi.advanceTimersByTimeAsync(40); }); await pending!;
  expect(h.sent.filter(m => m.type === 'runtime_result').at(-1).status).toBe('visible');
  expect(h.state().status).toBe('closing');
  act(() => h.transport.endTurn(true)); expect(h.state().status).toBe('closing');
  expect(screen.queryByText(/Counting Complete!/)).toBeNull();
  act(() => h.transport.audioChanged(false)); expect(h.state().status).toBe('completed');
  expect(h.state().affordances).toEqual([]);
  expect(screen.getByText(/Counting Complete!/)).toBeTruthy();
  expect(screen.getByText('You matched 2 boards of stars — you saw how many!')).toBeTruthy();
  expect(seam.correct).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(seam.perfect).toHaveBeenCalledOnce();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('chimes once for a checked success, never for help, wrong answers, or repeated correct text', async () => {
  const h = await mount('count_all');
  h.dispatch('begin_help'); h.say('four'); h.feedback('incorrect');
  expect(seam.correct).not.toHaveBeenCalled();
  h.say('five'); h.feedback('correct');
  expect(seam.correct).toHaveBeenCalledOnce();
  h.say('five'); h.say('Good work.', 'assistant'); h.dispatch('advance');
  expect(seam.correct).toHaveBeenCalledOnce();
  h.say('five'); h.feedback('correct');
  let pending!: Promise<void>;
  await act(async () => { pending = h.transport.command(h.command('advance')); });
  await act(async () => { await vi.advanceTimersByTimeAsync(80); }); await pending;
  expect(screen.getByText(/Counting Complete!/)).toBeTruthy();
  expect(screen.getByText(/with help/)).toBeTruthy();
  expect(seam.correct).toHaveBeenCalledTimes(2);
  expect(seam.submit).not.toHaveBeenCalled();
});

it.each(['1 2 3 4 6', '1 2 4 5', '1 2 3 3 4 5', 'one two four five', '5 4 3 2 1'])(
  'records a complete erroneous count without extracting a correct fragment: %s', async text => {
    const h = await mount('count_all');
    h.say(text);
    expect(h.state().task!.workspace!.lastResponse).toBeNull();
    h.feedback('incorrect');
    expect(h.state().task!.workspace!.lastResponse).toMatchObject({ response: text, correct: false });
    expect(h.state().task!.evidence.attemptNumber).toBe(1);
    expect(h.offer('advance')).toBeUndefined();
  });

it.each(['2 4 6', '1 2 3 4 5 6'])('allows the group counting task to be counted by groups or individuals: %s', async text => {
  const h = await mount('group_count');
  h.say(text); h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('observes checked speech, paints the next board, and completes without model progression tools', async () => {
  const classify = vi.fn(async (_request: Parameters<DialogueClassifier>[0]) => ({ verdict: 'correct' as const, transition: 'advance' as const,
    confidence: .99, verdictConfidence: .99, grounded: 1, accepted: true, reason: 'supported', ms: 200 }));
  const h = await mount('count_all', classify);
  for (const id of ['one', 'two']) {
    h.say('one two three four five');
    expect(h.state().task).toMatchObject({ itemId: id, phase: 'working' });
    expect(runtimePacket(h.state()).choices.some(a => ['retry', 'advance'].includes(a.action.type))).toBe(false);
    act(() => { h.transport.beginTurn('You found all five stars!'); h.transport.endTurn(true); });
    expect(h.state().task!.itemId).toBe(id);
    await act(async () => { h.transport.audioChanged(false); });
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
    expect(h.sent.some(m => m.type === 'dialogue_observation' && m.status === 'visible')).toBe(true);
  }
  expect(h.state().status).toBe('completed');
  expect(classify).toHaveBeenCalledTimes(2);
  expect(h.sent.filter(m => m.type === 'runtime_result')).toHaveLength(0);
  expect(h.sent.filter(m => m.type === 'text')).toHaveLength(1);
  expect(seam.submit).not.toHaveBeenCalled();
  h.transport.close();
});

it('observes a retry without overwriting the learner selection with a tutor demonstration', async () => {
  const classify = vi.fn(async (_request: Parameters<DialogueClassifier>[0]) => ({ verdict: 'incorrect' as const, transition: 'retry' as const,
    confidence: .99, verdictConfidence: .99, grounded: 1, accepted: true, reason: 'supported', ms: 200 }));
  const h = await mount('give_me_n', classify);
  h.dispatch('demonstrate', { targets: ['object-3'] });
  h.tap(0); h.tap(1); h.give();
  await act(async () => { h.transport.beginTurn('Try giving them again.'); h.transport.endTurn(false);
    await vi.advanceTimersByTimeAsync(80); });
  const request = classify.mock.calls[0][0];
  expect(request.activity!.objects.filter(o => o.selected).map(o => o.id)).toEqual(['object-0', 'object-1']);
  expect(request.activity!.demonstration).toEqual(['object-3']);
  expect(request.lastResponse).toMatchObject({ correct: false, assisted: true });
  expect(h.state().task).toMatchObject({ itemId: 'one', phase: 'working', support: { level: 2 } });
  expect(h.state().task!.workspace!.attempts).toHaveLength(1);
  expect(h.state().task!.workspace!.objects.every(o => !o.selected)).toBe(true);
  h.transport.close();
});


it('accepts the child correction while a slow retry observation is cancelled', async () => {
  let resolve!: (v: any) => void;
  const classify: DialogueClassifier = () => new Promise(r => { resolve = r; });
  const h = await mount('count_all', classify);
  h.say('six');
  act(() => { h.transport.beginTurn('Try counting again.'); h.transport.endTurn(false); });
  act(() => h.transport.dialogue.learnerStart());
  h.say('five');
  await act(async () => { resolve({ verdict: 'incorrect', transition: 'retry', confidence: 1, grounded: 1, accepted: true }); });
  expect(h.state().task!.workspace!.attempts).toEqual([]);
  expect(h.state().task!.workspace!.pendingResponse?.text).toBe('five');
  h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.transport.close();
});

it('keeps an explicit learner way forward when the observer is unavailable', async () => {
  const h = await mount('count_all', async () => { throw new Error('offline'); });
  h.say('six'); h.feedback('incorrect');
  await act(async () => { h.transport.beginTurn('Try again.'); h.transport.endTurn(false); });
  expect(h.state().task!.phase).toBe('checked');
  let recovery: Promise<void>;
  await act(async () => { recovery = h.transport.learnerProgress('retry'); });
  await act(async () => { await vi.advanceTimersByTimeAsync(80); }); await recovery!;
  expect(h.state().task!.phase).toBe('working');
  h.say('five'); h.feedback('correct');
  await act(async () => { recovery = h.transport.learnerProgress('advance'); });
  await act(async () => { await vi.advanceTimersByTimeAsync(80); }); await recovery!;
  expect(h.state().task).toMatchObject({ itemId: 'two', phase: 'working' });
  expect(h.sent.filter(m => m.type === 'runtime_result')).toHaveLength(0);
  h.transport.close();
});

const helpTurn = () => vi.fn(async (..._args: unknown[]) => ({ asksForHelp: .96, wantsToStop: .01, attemptsAnswer: .03,
  accepted: true, reason: 'observed', ms: 200 }));
const lastPacket = (sent: any[]) => sent.filter(m => m.type === 'runtime_state').at(-1).state;

it('sends learner signals with the packet, and a classified help request reaches the tutor without grading anything', async () => {
  const classifyLearner = helpTurn();
  const h = await mount('count_all', undefined, classifyLearner as never);
  h.transport.publish();
  expect(lastPacket(h.sent).learner.signals).toMatchObject({ itemId: 'one', attempts: 0, learnerTurns: 0, helpRequests: 0, helpRecorded: false });
  const revision = h.state().revision, before = h.sent.length;
  await act(async () => { h.transport.learnerText('I do not know', true); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
  const request = classifyLearner.mock.calls[0][0] as Record<string, unknown>;
  expect(request).toMatchObject({ learner: 'I do not know', task: h.state().task!.task, scope: { instanceId: 'board', itemId: 'one' } });
  expect(JSON.stringify(request)).not.toContain('expectedAnswer');
  const packet = lastPacket(h.sent.slice(before));
  expect(packet.learner.signals).toMatchObject({ learnerTurns: 1, helpRequests: 1, stopRequests: 0, turnsWithoutAnswer: 1 });
  expect(packet.learner.observations).toEqual([expect.objectContaining({ kind: 'learner_intent', helpRequested: true, attemptedAnswer: false })]);
  // Advisory: the scene, the tutor's action tickets and the learner's record are untouched.
  expect(packet.revision).toBe(revision);
  expect(h.state().task).toMatchObject({ phase: 'working', evidence: { attemptNumber: 0, correctness: 'unknown' }, support: { level: 0 } });
  expect(h.runtime.trace.getSnapshot().some(e => e.stage === 'learner_intent' && e.status === 'observed')).toBe(true);
  h.transport.close();
});

it('counts wrong attempts and a repeated wrong response, and never treats the host gesture message as a learner turn', async () => {
  const classifyLearner = helpTurn();
  const h = await mount('give_me_n', undefined, classifyLearner as never);
  for (let attempt = 0; attempt < 2; attempt++) {
    for (let n = 0; n < 4; n++) h.tap(n);
    h.give();
    expect(seam.send.mock.calls.at(-1)![1]).toMatchObject({ author: 'host' });
    act(() => h.transport.hostText());
    h.dispatch('retry');
  }
  expect(classifyLearner).not.toHaveBeenCalled();
  h.transport.publish();
  expect(lastPacket(h.sent).learner.signals).toMatchObject({ attempts: 2, wrongAttempts: 2, repeatedWrongResponse: true, learnerTurns: 0 });
  h.transport.close();
});

it('starts the signals again on the next item', async () => {
  const h = await mount('count_all', undefined, helpTurn() as never);
  await act(async () => { h.transport.learnerText('help', true); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
  seam.voiceActive = true;
  h.say('five', 'user', { isAudio: true, streamId: 1, transcriptFinished: true });
  await act(async () => { seam.voiceActive = false; seam.close?.(); await Promise.resolve(); });
  h.feedback('correct'); h.dispatch('advance');
  h.transport.publish();
  expect(lastPacket(h.sent).learner).toMatchObject({ signals: { itemId: 'two', learnerTurns: 0, helpRequests: 0, attempts: 0 }, observations: [] });
  h.transport.close();
});
