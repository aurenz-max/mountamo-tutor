// @vitest-environment jsdom
/**
 * The Pulse host on the teaching workspace: a real PulseActivityRenderer, real runtime,
 * observer, transport and evaluation provider, and the real primitives of all six families
 * that bind every catalog mode. Only the Live socket, the model calls behind the observers,
 * the Pulse backend and sound are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { useJudgedScriptRunner } from '../hooks/useJudgedScriptRunner';
import type { PulseItemSpec } from './types';

const seam = vi.hoisted(() => ({ event: null as any, runtime: null as any, outcome: [] as any[], results: [] as any[],
  pulseSubmit: vi.fn(), ai: { connectLesson: vi.fn(), disconnect: vi.fn(), sendActivityMessage: vi.fn(), sendText: vi.fn(),
    switchPrimitive: vi.fn(), isConnected: true, isListening: true, isAudioPlaying: false, activePrimitiveId: '',
    sessionMode: 'lesson', sessionResumeCount: 0, startListening: vi.fn(), stopListening: vi.fn(), conversation: [] as any[] } }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => seam.ai,
  LuminaAIProvider: ({ children, onActivityEvent, liveLessonRuntime }: any) => {
    // Pulse renders no provider of its own here; the workspace scope's provider is the one that matters.
    if (liveLessonRuntime) { seam.event = onActivityEvent; seam.runtime = liveLessonRuntime; }
    return <LiveRuntimeContext.Provider value={liveLessonRuntime ?? null}>{children}</LiveRuntimeContext.Provider>;
  } }));
vi.mock('../hooks/useJudgedScriptRunner', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useJudgedScriptRunner')>();
  return { ...actual, useJudgedScriptRunner: vi.fn(actual.useJudgedScriptRunner) };
});
vi.mock('../config/primitiveRegistry', async () => {
  const components: Record<string, React.ComponentType<any>> = {
    'counting-board': (await import('../primitives/visual-primitives/math/CountingBoard')).default,
    'number-sequencer': (await import('../primitives/visual-primitives/math/NumberSequencer')).default,
    'letter-sound-link': (await import('../primitives/visual-primitives/literacy/LetterSoundLink')).default,
    'di-math-facts': (await import('../primitives/visual-primitives/direct-instruction/DiMathFacts')).default,
    'di-letter-sounds': (await import('../primitives/visual-primitives/direct-instruction/DiLetterSounds')).default,
    'di-word-reading': (await import('../primitives/visual-primitives/direct-instruction/DiWordReading')).default,
  };
  // Records the evaluation exactly as Pulse receives it, then hands it on unchanged.
  const recording = (Real: React.ComponentType<any>) => (props: any) => <Real {...props} data={{ ...props.data,
    onEvaluationSubmit: (result: any) => { seam.results.push(result); props.data.onEvaluationSubmit(result); } }} />;
  const registry = Object.fromEntries(Object.entries(components).map(([id, Real]) =>
    [id, { supportsEvaluation: true, component: recording(Real) }]));
  return { getPrimitive: (id: string) => registry[id] };
});
vi.mock('./pulseApi', () => ({ pulseApi: { submitResult: seam.pulseSubmit } }));
vi.mock('../components/AIHelper', () => ({ AIHelper: () => <div data-testid="ai-helper" /> }));
vi.mock('../components/CuratorCompanion', () => ({ CuratorCompanion: () => <div data-testid="tutor-face" /> }));
vi.mock('./FrontierContextCard', () => ({ FrontierContextCard: () => null }));
vi.mock('../primitives/KnowledgeCheck', () => ({ KnowledgeCheck: () => null }));
vi.mock('../evaluation/api/evaluationApi', () => ({ submitEvaluationToBackend: vi.fn(async () => ({})) }));
vi.mock('../evaluation/diagnosis/captureMisconception', () => ({ captureMisconception: vi.fn(async () => ({ status: 'skipped' })) }));
vi.mock('../evaluation/diagnosis/captureLearningObservation', () => ({ captureLearningObservation: vi.fn(async () => ({ status: 'skipped' })) }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: { playCorrect: vi.fn(), playPerfect: vi.fn(), pop: vi.fn(), tap: vi.fn(),
  snap: vi.fn(), invalid: vi.fn(), playStreak: vi.fn(), isEnabled: () => true, getVolume: () => 1 } }));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('../components/DiActionPanel', () => ({ default: () => null }));
vi.mock('framer-motion', () => ({ AnimatePresence: ({ children }: any) => children,
  motion: { div: ({ children }: any) => <div>{children}</div>,
    button: ({ children, onClick, 'aria-label': label }: any) => <button onClick={onClick} aria-label={label}>{children}</button> } }));
import { PulseActivityRenderer } from './PulseActivityRenderer';

/** One generated payload per family, each on its pinned mode, with the answers a learner says. */
const FAMILIES = {
  'counting-board': { mode: 'count', answers: ['five'], data: { title: 'Count blocks', objects: { type: 'blocks' }, gradeBand: 'K',
    challenges: [{ id: 'c1', type: 'count_all', count: 5, targetAnswer: 5, arrangement: 'scattered', instruction: 'Count the blocks.', hint: '', narration: '' }] } },
  'number-sequencer': { mode: 'before_after', answers: ['eight', 'five'], data: { title: 'Number trains', gradeBand: 'K',
    showNumberLine: false, showDotArrays: false, challenges: [
      { id: 'one', type: 'before-after', instruction: '', sequence: [7, null], correctAnswers: [8], rangeMin: 7, rangeMax: 8 },
      { id: 'two', type: 'before-after', instruction: '', sequence: [4, null], correctAnswers: [5], rangeMin: 4, rangeMax: 5 }] } },
  'letter-sound-link': { mode: 'see_hear', answers: ['mmm', 't'], data: { title: 'Letter sounds', letterGroup: 1,
    cumulativeLetters: ['m', 's', 't', 'b', 'p'], challenges: [
      { id: 'm1', mode: 'see-hear', targetLetter: 'm', targetSound: '/m/', keywordWord: 'map', keywordImage: '🗺️' },
      { id: 't1', mode: 'see-hear', targetLetter: 't', targetSound: '/t/', keywordWord: 'tent', keywordImage: '⛺' }] } },
  'di-math-facts': { mode: 'answer_fact', answers: ['three', 'four'], data: { title: 'Math facts', description: 'Say each answer.',
    challengeType: 'answer_fact', challenges: [
      { id: 'a1', challengeType: 'answer_fact', a: 2, b: 1, display: '2 + 1', problem: 'two plus one', answerWord: 'three', answerNumeral: 3, solvedDisplay: '2 + 1 = 3' },
      { id: 'a2', challengeType: 'answer_fact', a: 3, b: 1, display: '3 + 1', problem: 'three plus one', answerWord: 'four', answerNumeral: 4, solvedDisplay: '3 + 1 = 4' }] } },
  'di-letter-sounds': { mode: 'letter_sound', answers: ['mmm', 'aaa'], data: { title: 'Letter sounds', description: 'Say each sound.',
    challengeType: 'letter_sound', challenges: [
      { id: 'm1', challengeType: 'letter_sound', letter: 'm', spoken: 'mmm', keyword: 'moon', emoji: '🌙', elicitation: 'isolated' },
      { id: 'a1', challengeType: 'letter_sound', letter: 'a', spoken: 'aaa', keyword: 'apple', emoji: '🍎', elicitation: 'keyword' }] } },
  'di-word-reading': { mode: 'cvc_reading', answers: ['sam', 'mat'], data: { title: 'Word reading', description: 'Read each word.',
    challengeType: 'cvc_reading', challenges: [
      { id: 'c1', challengeType: 'cvc_reading', word: 'sam', wordType: 'cvc', graphemes: ['s', 'a', 'm'] },
      { id: 'c2', challengeType: 'cvc_reading', word: 'mat', wordType: 'cvc', graphemes: ['m', 'a', 't'] }] } },
} as const;
type Family = keyof typeof FAMILIES;

/** What Pulse records as the eval mode on the scripted drill, per family (slice 1 evidence):
 *  counting-board reports its first challenge's catalog mode from the shared `handleFinished`,
 *  the DI packs report the session `challengeType`, and number-sequencer and letter-sound-link
 *  report none, so the item's `eval_mode_name` is recorded. */
const RECORDED: Record<Family, { reported: string | undefined; recorded: string }> = {
  'counting-board': { reported: 'count', recorded: 'count' },
  'number-sequencer': { reported: undefined, recorded: 'before_after' },
  'letter-sound-link': { reported: undefined, recorded: 'see_hear' },
  'di-math-facts': { reported: 'answer_fact', recorded: 'answer_fact' },
  'di-letter-sounds': { reported: 'letter_sound', recorded: 'letter_sound' },
  'di-word-reading': { reported: 'cvc_reading', recorded: 'cvc_reading' },
};

interface ItemInput { family: Family; mode?: string; data?: unknown }
const spec = (index: number, input: ItemInput): PulseItemSpec => ({ item_id: `pulse-item-00${index}`, band: 'current',
  subskill_id: `sub-${input.family}`, skill_id: `skill-${input.family}`, subject: 'MATHEMATICS', description: `Practice ${input.family}`,
  target_mode: 2, target_beta: 2, eval_mode_name: 'mode' in input ? input.mode : FAMILIES[input.family].mode,
  lesson_group_id: 'current-g', primitive_affinity: input.family });
const hydrated = (s: PulseItemSpec, input: ItemInput) => ({ manifestItem: { instanceId: s.item_id, problemText: s.description,
  difficulty: 'medium', visualPrimitive: { componentId: input.family, intent: s.description, successCriteria: { description: '' } },
  standardProblem: null }, visualData: input.data ?? FAMILIES[input.family].data });
const response = (complete: boolean) => ({ theta_update: { new_theta: 2, sigma: 1 }, gate_update: null, gate_progress: null,
  irt: null, leapfrog: null, session_progress: { is_complete: complete } });

let stream = 0;
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); stream = 0; seam.results = []; seam.outcome = []; seam.event = null; seam.runtime = null;
  Object.assign(seam.ai, { conversation: [], isConnected: true, sessionResumeCount: 0 });
  seam.pulseSubmit.mockImplementation(async () => response(false));
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function mount(inputs: ItemInput[]) {
  const specs = inputs.map((input, i) => spec(i, input));
  const lines = [JSON.stringify({ type: 'complete', items: specs.map((s, i) => hydrated(s, inputs[i])) }) + '\n'];
  // Two observers and the hydration stream share fetch, so every call is routed by URL.
  vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
    const route = String(url);
    if (route.includes('pulse-stream')) {
      const encoder = new TextEncoder();
      return { ok: true, body: { getReader: () => ({ read: async () =>
        lines.length ? { done: false, value: encoder.encode(lines.shift()!) } : { done: true, value: undefined } }) } };
    }
    if (route.includes('observe-learner')) return { ok: false, json: async () => ({}) };
    const next = seam.outcome.shift();
    return { ok: true, json: async () => (typeof next === 'function' ? next() : next) ?? ({ verdict: 'correct', transition: 'advance',
      accepted: true, confidence: .99, verdictConfidence: .99, grounded: 1, reason: 'settled', ms: 1 }) };
  }));
  const complete = vi.fn();
  const tree = () => <PulseActivityRenderer sessionId="pulse-session" items={specs} gradeLevel="elementary" onSessionComplete={complete} />;
  const view = render(tree());
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  const ready = async () => { await act(async () => { seam.event?.({ type: 'session_ready' }); await vi.advanceTimersByTimeAsync(90); }); };
  const say = async (text: string) => {
    await act(async () => { seam.ai.conversation = [...seam.ai.conversation,
      { role: 'user', content: text, streamId: ++stream, isAudio: true, transcriptFinished: true }];
      seam.event({ type: 'runtime_learner_text', text, finished: true }); view.rerender(tree()); });
  };
  const feedback = async (text: string) => {
    await act(async () => { seam.event({ type: 'runtime_turn_output', text }); seam.event({ type: 'runtime_turn_end', audioPending: false }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(90); });
  };
  const answerAll = async (family: Family) => {
    for (const answer of FAMILIES[family].answers) { await say(answer); await feedback(`Yes, ${answer}!`); }
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  };
  const next = async (name: 'Next' | 'Finish Session') => {
    fireEvent.click(screen.getByRole('button', { name }));
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  };
  return { view, tree, specs, complete, ready, say, feedback, answerAll, next };
}

const workspace = () => screen.queryByRole('region', { name: 'Lesson workspace' });

it('mounts a bound item on the workspace with one lesson session, and never the scripted runner', async () => {
  const h = await mount([{ family: 'counting-board' }]);
  expect(workspace()).toBeTruthy();
  expect(useJudgedScriptRunner).not.toHaveBeenCalled();
  expect(screen.queryByTestId('ai-helper')).toBeNull();
  expect(screen.getByTestId('tutor-face')).toBeTruthy();
  expect(seam.ai.connectLesson).toHaveBeenCalledTimes(1);
  const info = seam.ai.connectLesson.mock.calls[0][0];
  expect(info).toMatchObject({ exhibit_id: 'pulse-session', runtimeLesson: { sessionEpoch: seam.runtime.sessionEpoch },
    firstPrimitive: { primitive_type: 'counting-board', instance_id: h.specs[0].item_id, tutoring: null, owns_opening: true } });
  expect(info.firstPrimitive.primitive_data.teachingGuidance).toBeTruthy();
  expect(seam.runtime.getSnapshot()).toMatchObject({ owner: 'tutor', instanceId: h.specs[0].item_id,
    objectiveId: 'sub-counting-board', evalMode: 'count' });
});

it('binds an item with no resolved mode (a frontier probe) as mixed, on the workspace', async () => {
  await mount([{ family: 'counting-board', mode: undefined } as ItemInput]);
  expect(workspace()).toBeTruthy();
  expect(seam.ai.connectLesson).toHaveBeenCalledTimes(1);
  expect(seam.runtime.getSnapshot()).toMatchObject({ owner: 'tutor', evalMode: 'mixed' });
});

it.each([
  ['a mode the family does not have', { family: 'counting-board', mode: 'identify' }],
] as const)('keeps the scripted drill and the per-item AI helper for %s', async (_, input) => {
  await mount([input as ItemInput]);
  expect(workspace()).toBeNull();
  expect(useJudgedScriptRunner).toHaveBeenCalled();
  expect(screen.getByTestId('ai-helper')).toBeTruthy();
  expect(screen.queryByTestId('tutor-face')).toBeNull();
  expect(seam.ai.connectLesson).not.toHaveBeenCalled();
});

it.each(Object.keys(FAMILIES) as Family[])('%s submits once, and Pulse records what the scripted drill records', async family => {
  const h = await mount([{ family }]);
  expect(workspace()).toBeTruthy();
  await h.ready();
  const Next = () => screen.getByRole('button', { name: 'Finish Session' }) as HTMLButtonElement;
  expect(Next().disabled).toBe(true);
  await h.answerAll(family);
  expect(seam.runtime.getSnapshot().status).toBe('completed');
  expect(seam.results).toHaveLength(1);
  expect(seam.results[0]).toMatchObject({ primitiveType: family, instanceId: h.specs[0].item_id, success: true, score: 100,
    skillId: `skill-${family}`, subskillId: `sub-${family}` });
  expect(seam.results[0].metrics.evalMode).toBe(RECORDED[family].reported);
  expect(Next().disabled).toBe(false);
  seam.pulseSubmit.mockImplementationOnce(async () => response(true));
  await h.next('Finish Session');
  expect(seam.pulseSubmit).toHaveBeenCalledTimes(1);
  expect(seam.pulseSubmit.mock.calls[0]).toEqual(['pulse-session', { item_id: h.specs[0].item_id, score: 10,
    primitive_type: family, eval_mode: RECORDED[family].recorded, duration_ms: expect.any(Number) }]);
  expect(h.complete).toHaveBeenCalledTimes(1);
  expect(seam.results).toHaveLength(1);
  expect(useJudgedScriptRunner).not.toHaveBeenCalled();
});

it('tears the scope down between items, and an observation still in flight lands nowhere', async () => {
  // The one way a result can outlive its item: a checked handover whose tutor reply the observer
  // is still classifying when the learner presses Next challenge, then Pulse's Next.
  const handover = { ...FAMILIES['counting-board'].data, challenges: [{ id: 'g1', type: 'give_me_n', count: 8, targetAnswer: 3,
    arrangement: 'scattered', instruction: 'Give me three blocks.', hint: '', narration: '' }] };
  const h = await mount([{ family: 'counting-board', mode: 'give_me_n', data: handover }, { family: 'di-math-facts' }]);
  await h.ready();
  const first = seam.runtime, oldEvent = seam.event;
  for (const index of [0, 1, 2]) fireEvent.click(h.view.container.querySelector(`[data-pip-object="object-${index}"]`)!);
  fireEvent.click(screen.getByRole('button', { name: /give/i, hidden: true }));
  await act(async () => { await vi.advanceTimersByTimeAsync(90); });
  expect(first.getSnapshot().task).toMatchObject({ phase: 'checked', evidence: { correctness: 'correct' } });
  let release: (() => void) | undefined;
  seam.outcome.push(() => new Promise(resolve => { release = () => resolve({ verdict: 'correct', transition: 'advance',
    accepted: true, confidence: .99, verdictConfidence: .99, grounded: 1, reason: 'late', ms: 1 }); }));
  await h.feedback('Yes, three blocks!');
  expect(release, 'no observation in flight').toBeTypeOf('function');
  fireEvent.click(screen.getByRole('button', { name: 'Next challenge' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(first.getSnapshot().status).toBe('completed');
  expect(seam.results).toHaveLength(1);
  const s = first.getSnapshot();
  const oldCommand = { sessionEpoch: s.sessionEpoch, instanceId: s.instanceId, itemId: 'g1', expectedRevision: s.revision,
    commandId: 'old', action: { type: 'workspace', operation: 'begin_help' } };

  await h.next('Next');
  expect(seam.ai.disconnect).toHaveBeenCalledTimes(1);
  expect(seam.ai.connectLesson).toHaveBeenCalledTimes(2);
  const second = seam.runtime;
  expect(second).not.toBe(first);
  expect(second.getSnapshot()).toMatchObject({ instanceId: h.specs[1].item_id, evalMode: 'answer_fact' });
  await h.ready();
  const before = second.getSnapshot();
  await act(async () => { release!(); oldEvent({ type: 'runtime_learner_text', text: 'four', finished: true });
    oldEvent({ type: 'runtime_turn_output', text: 'Correct!' }); oldEvent({ type: 'runtime_turn_end' });
    await vi.advanceTimersByTimeAsync(200); });
  act(() => { expect(first.dispatch(oldCommand).status).not.toBe('committed'); });
  expect(second.getSnapshot().revision).toBe(before.revision);
  expect(second.getSnapshot().task.evidence.attemptNumber).toBe(0);
  expect(second.getSnapshot().task.workspace.pendingResponse).toBeUndefined();
  expect(seam.results).toHaveLength(1);
  expect(seam.pulseSubmit).toHaveBeenCalledTimes(1);
  expect(seam.pulseSubmit.mock.calls[0][1]).toMatchObject({ item_id: h.specs[0].item_id, score: 10, eval_mode: 'give_me_n' });
});

it('keeps the surface inert while the tutor is disconnected, and a resume keeps work but not unfinished speech', async () => {
  const h = await mount([{ family: 'di-math-facts' }]);
  await h.ready();
  const fieldset = () => workspace()!.querySelector('fieldset')!;
  expect(fieldset().disabled).toBe(false);
  await h.say('three'); await h.feedback('Yes, three!');
  const runtime = seam.runtime;
  const original = runtime.getSnapshot();
  expect(original.task.evidence.attemptNumber).toBe(0);
  const staleTicket = { sessionEpoch: original.sessionEpoch, instanceId: original.instanceId, itemId: original.task.itemId,
    expectedRevision: original.revision, commandId: 'pre-drop', action: { type: 'workspace', operation: 'begin_help' } };
  await h.say('four');
  expect(runtime.getSnapshot().task.workspace.pendingResponse).toBeTruthy();
  // The socket drops: the learner sees the tutor face's reconnect, and the workspace takes no input.
  await act(async () => { seam.event({ type: 'session_resuming' }); seam.ai.isConnected = false; h.view.rerender(h.tree()); });
  expect(fieldset().disabled).toBe(true);
  expect(screen.getByTestId('tutor-face')).toBeTruthy();
  await act(async () => { seam.ai.isConnected = true; seam.ai.sessionResumeCount++; h.view.rerender(h.tree());
    seam.event({ type: 'session_resumed' }); await vi.advanceTimersByTimeAsync(100); });
  expect(fieldset().disabled).toBe(false);
  expect(runtime.getSnapshot().task.itemId).toBe(original.task.itemId);
  expect(runtime.getSnapshot().task.workspace.pendingResponse).toBeUndefined();
  act(() => expect(runtime.dispatch(staleTicket).status).toBe('stale'));
  await h.feedback('That was right.');
  expect(seam.results).toHaveLength(0);
  await h.say('four'); await h.feedback('Yes, four!');
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(seam.results).toHaveLength(1);
  expect(seam.results[0]).toMatchObject({ success: true, score: 100 });
  expect(seam.ai.connectLesson).toHaveBeenCalledTimes(1);
});
