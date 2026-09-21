// @vitest-environment jsdom
// Real host, board, runtime, observer and playback hook. Only network and audio
// hardware are replaced; in particular, playback settlement is NOT injected.
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveRuntimeContext } from './runtime/LiveRuntimeContext';
import { useAudioPlayback } from '@/lib/hooks/useAudioPlayback';
import LiveActivitySandbox from './LiveActivitySandbox';
import CountingBoard from '../../primitives/visual-primitives/math/CountingBoard';
import ShapeSorter from '../../primitives/visual-primitives/math/ShapeSorter';

const seam = vi.hoisted(() => ({ event: null as any, playback: null as any, runtime: null as any,
  correct: vi.fn(), perfect: vi.fn(),
  ai: { connectLesson: vi.fn(), disconnect: vi.fn(), sendActivityMessage: vi.fn(), sendText: vi.fn(),
    isConnected: true, isListening: true, isAudioPlaying: false, activePrimitiveId: 'board', sessionMode: 'lesson',
    startListening: vi.fn(), stopListening: vi.fn(), conversation: [] as any[] } }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => seam.ai,
  LuminaAIProvider: ({ children, onActivityEvent, liveLessonRuntime }: any) => {
    seam.event = onActivityEvent; seam.runtime = liveLessonRuntime;
    seam.playback = useAudioPlayback({ onIdle: () => onActivityEvent({ type: 'runtime_audio_idle' }) });
    return <LiveRuntimeContext.Provider value={liveLessonRuntime}>{children}</LiveRuntimeContext.Provider>;
  } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'tester' } }) }));
vi.mock('../../evaluation', () => ({ useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: vi.fn(), elapsedMs: 0 }) }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../../utils/SoundManager', () => ({ SoundManager: { playCorrect: seam.correct, playPerfect: seam.perfect,
  tap: vi.fn(), invalid: vi.fn(), playStreak: vi.fn(), isEnabled: () => true, getVolume: () => 1 } }));
vi.mock('../JudgedMicPanel', () => ({ default: () => null }));
vi.mock('./liveRenderers', () => ({ LIVE_RENDERERS: { 'counting-board': (p: any) => <CountingBoard
  data={p.data} autoStart={p.autoStart} runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
  'shape-sorter': (p: any) => <ShapeSorter data={p.data} autoStart={p.autoStart}
    runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} /> } }));

const data = { instanceId: 'board', title: 'Count the blocks', objects: { type: 'blocks' }, gradeBand: 'K',
  challenges: [5, 8].map((n, i) => ({ id: `c${i + 1}`, type: 'count_all', count: n, targetAnswer: n,
    arrangement: 'scattered', instruction: 'Count the blocks.', hint: '', narration: '' })) };
let sources: Array<{ onended?: () => void; start: () => void; stop: () => void }>;
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); seam.ai.conversation = []; sources = [];
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  vi.stubGlobal('AudioContext', class {
    state = 'running'; currentTime = 0; destination = {};
    createBuffer(_channels: number, frames: number, rate: number) { return { duration: frames / rate, copyToChannel() {} }; }
    createBufferSource() { const source = { connect() {}, start() {}, stop() {}, onended: undefined as any }; sources.push(source); return source; }
    close() { return Promise.resolve(); }
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function startHost(counts?: number[], shapes = false) {
  let resolve!: (value: any) => void;
  const fetcher = vi.fn((url: string, _options?: RequestInit) => {
    if (url.endsWith('/observe-dialogue')) return new Promise(r => { resolve = r; });
    if (url.endsWith('/interpret-response')) throw new Error('Retired source-answer gate must not run');
    const payload = shapes ? { instanceId: 'board', title: 'Name the shapes', gradeBand: 'K', challenges: [
      { id: 'shapes', type: 'identify', ruleAttribute: 'shape', instruction: 'Name the shape.', shapes:
        ['triangle', 'rhombus'].map((shape, index) => ({ shape, color: index ? 'blue' : 'red', size: 'medium', rotation: 0 })) },
    ] } : counts ? { ...data, challenges: counts.map((count, i) => ({ ...data.challenges[0],
      id: `c${i + 1}`, count, targetAnswer: count })) } : data;
    return Promise.resolve({ ok: true, json: async () => ({ instanceId: 'board', data: payload }) });
  });
  vi.stubGlobal('fetch', fetcher);
  const tree = () => <React.StrictMode><LiveActivitySandbox /></React.StrictMode>;
  const view = render(tree());
  fireEvent.change(screen.getByLabelText('Activity'), { target: { value: shapes ? 'shape-sorter' : 'counting-board' } });
  fireEvent.click(screen.getByText('Start lesson'));
  await act(async () => { seam.event({ type: 'session_ready' }); seam.event({ type: 'activity_request', callId: 'create',
    args: { primitiveId: shapes ? 'shape-sorter' : 'counting-board', mode: shapes ? 'identify' : 'count',
      topic: shapes ? 'Shapes' : 'Counting', intent: shapes ? 'Name shapes' : 'Count objects' } }); });
  await act(async () => { await vi.advanceTimersByTimeAsync(80); });
  let stream = 0;
  const say = async (content: string) => act(async () => {
    seam.ai.conversation = [...seam.ai.conversation, { role: 'user', content, streamId: ++stream, isAudio: true, transcriptFinished: true }];
    seam.event({ type: 'runtime_learner_text', text: content, finished: true }); view.rerender(tree());
  });
  const speak = (text: string) => act(() => {
    seam.event({ type: 'runtime_turn_output', text });
    seam.playback.processAndPlayRawAudio(btoa('\0'.repeat(24000)));
    seam.playback.resetForNextTurn();
    seam.event({ type: 'runtime_turn_end', audioPending: seam.playback.hasPendingAudio() });
    seam.event({ type: 'runtime_turn_end', audioPending: seam.playback.hasPendingAudio() });
  });
  const drain = () => act(() => sources.forEach(s => s.onended?.()));
  const decide = async (decision: any = {}) => {
    await act(async () => resolve({ ok: true, json: async () => ({ verdict: 'correct', transition: 'advance',
      accepted: true, confidence: .99, verdictConfidence: .99, grounded: 1, reason: 'tutor_success_feedback_finished', ms: 300, ...decision }) }));
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
  };
  return { view, say, speak, drain, decide, fetcher };
}

it.each([false, true])('keeps demonstration tickets through speech finalization, but not a scene change (shapes=%s)', async shapes => {
  const h = await startHost(undefined, shapes);
  const state = seam.runtime.getSnapshot();
  const command = { sessionEpoch: state.sessionEpoch, commandId: 'demo-before-transcript', instanceId: state.instanceId,
    itemId: state.task.itemId, expectedRevision: state.revision,
    action: { type: 'workspace', operation: 'demonstrate', input: { targets: [state.task.workspace.objects[0].id] } } };
  await h.say('Can you show me?');
  expect(seam.runtime.getSnapshot().task.workspace.pendingResponse.text).toBe('Can you show me?');
  const previousResponse = seam.runtime.getSnapshot().task.workspace.pendingResponse.id;
  await h.say('Actually, I want to try first.');
  expect(seam.runtime.getSnapshot().revision).toBe(state.revision);
  act(() => expect(seam.runtime.dispatch(command).status).toBe('committed'));
  act(() => expect(seam.runtime.dispatch({ ...command, expectedRevision: seam.runtime.getSnapshot().revision,
    commandId: 'old-response', action: {
    type: 'workspace', operation: 'apply_tutor_verdict', input: { dialogue: {
      responseId: previousResponse, verdict: 'correct', transition: 'advance', tutor: 'Correct.' },
    },
  } }).status).toBe('blocked'));
  expect(seam.runtime.getSnapshot().task.evidence.attemptNumber).toBe(0);
  expect(h.view.container.querySelectorAll('[data-tutor-demonstration="true"]')).toHaveLength(1);
  act(() => expect(seam.runtime.dispatch({ ...command, commandId: 'old-after-scene-change' }).status).toBe('stale'));
});

it('reuses the host observer for shape naming, intermediate steps, retry, alternate names and settled completion', async () => {
  const h = await startHost(undefined, true);
  const task = () => seam.runtime.getSnapshot().task;
  const first = task().itemId;
  expect(task().workspace.expectedAnswer).toBe('triangle');
  expect(h.view.container.textContent).not.toContain('Say exactly');
  expect(task().demand.targetId).toBe('shape-0');
  const command = (targets: string[]) => {
    const state = seam.runtime.getSnapshot();
    return { sessionEpoch: state.sessionEpoch, commandId: crypto.randomUUID(), instanceId: state.instanceId,
      itemId: state.task.itemId, expectedRevision: state.revision, action: { type: 'workspace', operation: 'demonstrate', input: { targets } } };
  };
  const oldCommand = command(['shape-1']);
  act(() => {
    expect(seam.runtime.dispatch(command(['shape-0', 'missing'])).status).toBe('blocked');
    expect(h.view.container.querySelectorAll('[data-tutor-demonstration="true"]')).toHaveLength(0);
    expect(seam.runtime.dispatch(command(['shape-1'])).status).toBe('committed');
    expect(h.view.container.querySelector('[data-shape-id="shape-1"]')?.getAttribute('data-tutor-demonstration')).toBe('true');
    expect(h.view.container.querySelector('[data-assignment-target="true"]')?.getAttribute('data-shape-id')).toBe('shape-0');
  });
  expect(task().evidence.attemptNumber).toBe(0);
  expect(task().workspace.objects.every((o: any) => !o.selected)).toBe(true);
  h.speak('How many sides does the shape inside the gold ring have?'); h.drain();
  await h.say('tres'); h.speak('Yes, three sides. What is its name?'); h.drain();
  const request = JSON.parse(String(h.fetcher.mock.calls.filter(([url]) => url.endsWith('/observe-dialogue')).at(-1)![1]!.body));
  expect(request).toMatchObject({ expectedAnswer: 'triangle', priorTutor: 'How many sides does the shape inside the gold ring have?' });
  await h.decide({ accepted: false, verdict: 'none', transition: 'none' });
  expect(task().itemId).toBe(first); expect(task().evidence.attemptNumber).toBe(0);
  expect(seam.correct).not.toHaveBeenCalled();
  await h.say('circle'); h.speak('Not a circle. Have another try.'); h.drain();
  await h.decide({ verdict: 'incorrect', transition: 'retry' });
  expect(task().phase).toBe('working'); expect(task().support.level).toBe(2);
  expect(h.view.container.querySelectorAll('[data-tutor-demonstration="true"]')).toHaveLength(0);
  await h.say('triángulo'); h.speak('Correct, it is a triangle. How did you recognize it?'); h.drain();
  await h.decide({ transition: 'none' });
  expect(task().phase).toBe('checked'); expect(task().itemId).toBe(first);
  expect(task().workspace.attempts).toHaveLength(2);
  expect(task().workspace.lastResponse).toMatchObject({ correct: true, assisted: true, judgment: 'tutor' });
  await h.say('It has three sides.'); h.speak('Exactly. Let us try the next shape.'); h.drain();
  await h.decide();
  expect(task().itemId).not.toBe(first);
  expect(task().workspace.expectedAnswer).toContain('diamond');
  expect(task().support.level).toBe(0); expect(task().evidence.attemptNumber).toBe(0);
  act(() => expect(seam.runtime.dispatch(oldCommand).status).toBe('stale'));
  await h.say('diamond'); h.speak('Yes, diamond and rhombus are both names for this shape.');
  expect(screen.queryByText(/Shape Work Complete!/)).toBeNull();
  h.drain(); await h.decide();
  expect(seam.runtime.getSnapshot().status).toBe('completed');
  expect(screen.getByText(/Shape Work Complete!/)).toBeTruthy();
  expect(seam.correct).toHaveBeenCalledTimes(2);
  expect(seam.ai.sendText.mock.calls.some(([text]) => /Say exactly|\[SH_/.test(text))).toBe(false);
});

it.each(['f\u00fcnf', "It's 5:00.", 'six', 'Is this 5?'])('uses tutor feedback despite learner transcript %s and finishes with sound and summary', async learner => {
  const h = await startHost();
  await h.say(learner);
  expect(seam.runtime.getSnapshot().task.evidence.correctness).toBe('unknown');
  // The opted-in binding's learner facts are inspectable, and the inspector says they reach the tutor.
  expect(screen.getByTestId('learner-signals').textContent).toMatch(/sent to the tutor.*learnerTurns1/);
  expect(seam.correct).not.toHaveBeenCalled();
  h.speak("That's right, there are five fish on the board.");
  expect(h.fetcher.mock.calls.filter(([url]) => url.endsWith('/observe-dialogue'))).toHaveLength(0);
  h.drain(); await h.decide();
  expect(seam.runtime.getSnapshot().task.itemId).toBe('c2');
  expect(seam.runtime.getSnapshot().task.workspace.attempts[0]).toMatchObject({ response: learner,
    correct: true, judgment: 'tutor', tutorResponse: "That's right, there are five fish on the board." });
  expect(seam.correct).toHaveBeenCalledOnce();
  await h.say('ocho');
  h.speak('Spot on! There are eight fish here.'); h.drain(); await h.decide();
  expect(seam.runtime.getSnapshot().status).toBe('completed');
  expect(screen.getByText(/Counting Complete!/)).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(seam.correct).toHaveBeenCalledTimes(2); expect(seam.perfect).toHaveBeenCalledOnce();
  expect(screen.getByTestId('jev-inspector').textContent).toContain(learner);
});

it.each([false, true].flatMap(shapes => ['while audio drains', 'while JEV responds', 'recognized new words', 'confirmed interruption']
  .map(timing => ({ shapes, timing }))))('retains turn ownership with $timing (shapes=$shapes)', async ({ shapes, timing }) => {
  const h = await startHost(undefined, shapes);
  const first = seam.runtime.getSnapshot().task.itemId;
  await h.say(shapes ? 'triángulo' : 'f\u00fcnf'); h.speak(shapes ? 'Correct, a triangle!' : 'Correct, five!');
  if (timing === 'while audio drains') act(() => seam.event({ type: 'runtime_learner_start' }));
  h.drain();
  if (timing === 'while JEV responds') act(() => seam.event({ type: 'runtime_learner_start' }));
  if (timing === 'recognized new words') await h.say('Wait, can you help?');
  if (timing === 'confirmed interruption') act(() => seam.event({ type: 'runtime_interrupted' }));
  await h.decide();
  const cancelled = ['recognized new words', 'confirmed interruption'].includes(timing);
  expect(seam.runtime.getSnapshot().task.itemId === first).toBe(cancelled);
  expect(seam.runtime.getSnapshot().task.workspace.attempts).toHaveLength(cancelled ? 0 : 1);
});

it('records incorrect tutor feedback and retries, while help and encouragement remain ungraded', async () => {
  const h = await startHost(); await h.say('Can you help?'); h.speak('You are doing great. Let us count together.'); h.drain();
  await h.decide({ verdict: 'none', transition: 'none', accepted: false, grounded: 0 });
  expect(seam.runtime.getSnapshot().task.workspace.attempts).toEqual([]);
  await h.say('unreadable answer'); h.speak('Not quite, try counting again.'); h.drain();
  await h.decide({ verdict: 'incorrect', transition: 'retry' });
  expect(seam.runtime.getSnapshot().task).toMatchObject({ itemId: 'c1', phase: 'working', evidence: { correctness: 'incorrect' } });
  expect(seam.correct).not.toHaveBeenCalled();
});

it('keeps row answers open until feedback confirms the full assignment, then finishes normally', async () => {
  const h = await startHost([18, 5]);
  h.speak('How many blocks are in the first row?'); h.drain();
  await h.say('ocho');
  h.speak("That's correct, there are eight blocks in the first row! Now, how many are in the second row?"); h.drain();
  const request = JSON.parse(String(h.fetcher.mock.calls.filter(([url]) => url.endsWith('/observe-dialogue')).at(-1)![1]!.body));
  expect(request).toMatchObject({ expectedAnswer: '18', priorTutor: 'How many blocks are in the first row?' });
  await h.decide({ verdict: 'none', transition: 'none', accepted: false, grounded: 0 });
  await h.say('Another eight?');
  h.speak("That's right, eight in the second row too. Now count the last two."); h.drain();
  await h.decide({ verdict: 'none', transition: 'none', accepted: false, grounded: 0 });
  expect(seam.runtime.getSnapshot().task).toMatchObject({ itemId: 'c1', phase: 'working',
    evidence: { correctness: 'unknown', attemptNumber: 0 } });
  expect(seam.correct).not.toHaveBeenCalled();
  await h.say('8 + 8 = 16 + 2 = 18');
  h.speak('That is correct! There are eighteen blocks in total. Great job counting them all up!'); h.drain();
  await h.decide();
  expect(seam.runtime.getSnapshot().task.itemId).toBe('c2');
  expect(seam.runtime.getSnapshot().task.workspace.attempts).toHaveLength(1);
  expect(seam.correct).toHaveBeenCalledOnce();
  await h.say('f\u00fcnf'); h.speak('Correct, five blocks in total!'); h.drain(); await h.decide();
  expect(seam.runtime.getSnapshot().status).toBe('completed');
  expect(screen.getByText(/Counting Complete!/)).toBeTruthy();
});
