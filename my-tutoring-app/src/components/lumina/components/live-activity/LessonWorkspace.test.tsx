// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LessonWorkspaceProvider, useLessonWorkspace } from './LessonWorkspace';
import { LiveRuntimeContext } from './runtime/LiveRuntimeContext';
import { KindergartenStage } from '../KindergartenStage';
import { ManifestOrderRenderer } from '../ManifestOrderRenderer';
import { EvaluationProvider, useEvaluationContext } from '../../evaluation';
import { ExhibitProvider } from '../../contexts/ExhibitContext';
import CountingBoard from '../../primitives/visual-primitives/math/CountingBoard';
import ShapeSorter from '../../primitives/visual-primitives/math/ShapeSorter';

const seam = vi.hoisted(() => ({ event: null as any, host: null as any, evaluations: null as any, outcome: [] as any[],
  submit: vi.fn(async (_result: any, _student?: string) => ({})), finished: vi.fn(),
  ai: { connectLesson: vi.fn(), disconnect: vi.fn(), sendActivityMessage: vi.fn(), sendText: vi.fn(), switchPrimitive: vi.fn(),
    isConnected: true, isListening: true, isAudioPlaying: false, activePrimitiveId: '', sessionMode: 'lesson', sessionResumeCount: 0,
    startListening: vi.fn(), stopListening: vi.fn(), conversation: [] as any[] } }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => seam.ai,
  LuminaAIProvider: ({ children, onActivityEvent, liveLessonRuntime }: any) => {
    seam.event = onActivityEvent;
    return <LiveRuntimeContext.Provider value={liveLessonRuntime}>{children}</LiveRuntimeContext.Provider>;
  } }));
vi.mock('../../config/primitiveRegistry', () => ({ getPrimitive: (id: string) => ({ supportsEvaluation: true,
  component: id === 'counting-board' ? CountingBoard : ShapeSorter }), SectionHeader: () => null, CenteredSectionHeader: () => null }));
vi.mock('../../evaluation/api/evaluationApi', () => ({ submitEvaluationToBackend: seam.submit }));
vi.mock('../../evaluation/diagnosis/captureMisconception', () => ({ captureMisconception: vi.fn(async () => ({ status: 'skipped' })) }));
vi.mock('../../evaluation/diagnosis/captureLearningObservation', () => ({ captureLearningObservation: vi.fn(async () => ({ status: 'skipped' })) }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../../utils/SoundManager', () => ({ SoundManager: { playCorrect: vi.fn(), playPerfect: vi.fn(), pop: vi.fn(),
  tap: vi.fn(), invalid: vi.fn(), playStreak: vi.fn(), isEnabled: () => true, getVolume: () => 1 } }));
vi.mock('../JudgedMicPanel', () => ({ default: () => null }));
// Animation is unrelated to ownership; keep the actual stage navigation and surfaces.
vi.mock('framer-motion', () => ({ AnimatePresence: ({ children }: any) => children,
  motion: { div: ({ children, ...props }: any) => <div>{children}</div>,
    button: ({ children, onClick, 'aria-label': label }: any) => <button onClick={onClick} aria-label={label}>{children}</button> } }));

const board = { componentId: 'counting-board', instanceId: 'count', title: 'Count', objectiveIds: ['o-count'], data: {
  title: 'Count blocks', objects: { type: 'blocks' }, gradeBand: 'K', challenges: [
    { id: 'c1', type: 'count_all', count: 5, targetAnswer: 5, arrangement: 'scattered', instruction: 'Count the blocks.', hint: '', narration: '' }] } };
const shapes = { componentId: 'shape-sorter', instanceId: 'shape', title: 'Shapes', objectiveIds: ['o-shape'], data: {
  title: 'Name shapes', gradeBand: 'K', challenges: [{ id: 's1', type: 'identify', ruleAttribute: 'shape', instruction: 'Name the shape.',
    shapes: [{ shape: 'triangle', color: 'red', size: 'medium', rotation: 0 }] }] } };
function Probe() { seam.host = useLessonWorkspace(); seam.evaluations = useEvaluationContext(); return null; }
let stream = 0;
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); stream = 0; seam.ai.conversation = []; seam.ai.isConnected = true; seam.ai.sessionResumeCount = 0;
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  // Two observers share fetch. The advisory learner-turn route is unavailable here, so a
  // one-shot outcome decision below is always consumed by the outcome observer.
  seam.outcome = [];
  vi.stubGlobal('fetch', vi.fn(async (url: unknown) => String(url).includes('observe-learner') ? { ok: false, json: async () => ({}) }
    : { ok: true, json: async () => seam.outcome.shift() ?? ({ verdict: 'correct', transition: 'advance',
      accepted: true, confidence: .99, verdictConfidence: .99, grounded: 1, reason: 'settled', ms: 1 }) }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function mount(reverse = false, scroll = false, counting: { section: typeof board; mode: string } = { section: board, mode: 'count' }) {
  const orderedComponents = reverse ? [shapes, counting.section] : [counting.section, shapes];
  const manifestItems = orderedComponents.map(s => ({ ...s, config: { targetEvalMode: s === shapes ? 'identify' : counting.mode } }));
  const objectives = orderedComponents.map(s => ({ id: s.objectiveIds[0], text: s.title, verb: 'identify',
    skillId: `skill-${s.instanceId}`, subskillId: `subskill-${s.instanceId}` }));
  const exhibit = { topic: 'Count and name', orderedComponents, manifest: { layout: manifestItems } } as any;
  const tree = () => <React.StrictMode><EvaluationProvider sessionId="lesson-test" curriculumSkillId="lesson-first-skill" curriculumSubskillId="lesson-first-subskill" localOnly={false} persistToStorage={false}>
    <ExhibitProvider objectives={objectives as any} manifestItems={manifestItems as any}>
      <LessonWorkspaceProvider exhibit={exhibit}><Probe />
        {scroll ? <ManifestOrderRenderer orderedComponents={orderedComponents as any} /> :
          <KindergartenStage orderedComponents={orderedComponents as any} onFinished={seam.finished} />}
      </LessonWorkspaceProvider>
    </ExhibitProvider></EvaluationProvider></React.StrictMode>;
  const view = render(tree());
  await act(async () => { seam.event({ type: 'session_ready' }); await vi.advanceTimersByTimeAsync(90); });
  const say = async (text: string) => {
    await act(async () => { seam.ai.conversation = [...seam.ai.conversation,
      { role: 'user', content: text, streamId: ++stream, isAudio: true, transcriptFinished: true }];
      seam.event({ type: 'runtime_learner_text', text, finished: true }); view.rerender(tree()); });
  };
  const feedback = async (text: string, audioPending = false) => {
    await act(async () => { seam.event({ type: 'runtime_turn_output', text }); seam.event({ type: 'runtime_turn_end', audioPending }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(90); });
  };
  return { view, tree, say, feedback, first: orderedComponents[0], second: orderedComponents[1] };
}

it.each([false, true])('submits actual tutor completion once through evaluation, navigates both orders (reverse=%s)', async reverse => {
  const h = await mount(reverse);
  const runtime = seam.host.runtime;
  expect(runtime.getSnapshot().instanceId).toBe(h.first.instanceId);
  expect(runtime.getSnapshot().objectiveId).toBe(h.first.objectiveIds[0]);
  expect(seam.submit).not.toHaveBeenCalled();
  await h.say(reverse ? 'triangle' : 'five');
  await h.feedback(reverse ? 'Correct, triangle!' : 'Correct, five blocks!', true);
  expect(seam.submit).not.toHaveBeenCalled();
  await act(async () => { seam.event({ type: 'runtime_audio_idle' }); });
  await act(async () => { await vi.advanceTimersByTimeAsync(90); });
  await act(async () => { await vi.advanceTimersByTimeAsync(1400); });
  expect(seam.submit).toHaveBeenCalledTimes(1);
  const result = seam.submit.mock.calls[0][0] as any;
  expect(result).toMatchObject({ instanceId: h.first.instanceId, success: true, score: 100,
    skillId: `skill-${h.first.instanceId}`, subskillId: `subskill-${h.first.instanceId}` });
  expect(result.studentWork.teachingAttempts).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(runtime.getSnapshot().instanceId).toBe(h.second.instanceId);
  expect(runtime.getSnapshot().task.workspace.pendingResponse).toBeUndefined();
  await h.say(reverse ? 'five' : 'triangle'); await h.feedback(reverse ? 'Five is correct!' : 'Triangle is correct!');
  await act(async () => { await vi.advanceTimersByTimeAsync(1400); });
  expect(seam.submit).toHaveBeenCalledTimes(2);
  expect(seam.evaluations.submittedResults).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1400); });
  expect(seam.submit).toHaveBeenCalledTimes(2);
  expect(runtime.getSnapshot().status).toBe('completed');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1400); });
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  expect(seam.finished).toHaveBeenCalledTimes(1);
});

it.each([false, true])('gives the learner a Try again when the observer leaves a checked gesture open (scroll=%s)', async scroll => {
  // The stall that once kept gesture modes out of lessons: a wrong handover is checked
  // by the board, the observer abstains on the tutor's reply, and nothing reopens the item.
  const handover = { ...board, data: { ...board.data, challenges: [{ id: 'g1', type: 'give_me_n', count: 8, targetAnswer: 3,
    arrangement: 'scattered', instruction: 'Give me three blocks.', hint: '', narration: '' }] } };
  const h = await mount(false, scroll, { section: handover, mode: 'give_me_n' });
  const runtime = seam.host.runtime;
  expect(runtime.getSnapshot()).toMatchObject({ instanceId: 'count', evalMode: 'give_me_n' });
  for (const index of [0, 1, 2, 3]) fireEvent.click(h.view.container.querySelector(`[data-pip-object="object-${index}"]`)!);
  fireEvent.click(screen.getByRole('button', { name: /give/i, hidden: true }));
  await act(async () => { await vi.advanceTimersByTimeAsync(90); });
  expect(runtime.getSnapshot().task).toMatchObject({ phase: 'checked', evidence: { correctness: 'incorrect' } });
  seam.outcome.push({ verdict: 'none', transition: 'none', accepted: false, confidence: 0, grounded: 0, reason: 'unclear', ms: 1 });
  await h.feedback('Hmm, let us look at those together.');
  expect(runtime.getSnapshot().task.phase).toBe('checked');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(120); });
  expect(runtime.getSnapshot().task).toMatchObject({ itemId: 'g1', phase: 'working' });
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
});

it('preserves unfinished work on scroll focus and rejects prior-surface commands and feedback', async () => {
  const h = await mount(false, true); const runtime = seam.host.runtime;
  const s = runtime.getSnapshot();
  const command = { sessionEpoch: s.sessionEpoch, instanceId: s.instanceId, itemId: s.task.itemId, expectedRevision: s.revision,
    commandId: 'old-scene', action: { type: 'workspace', operation: 'demonstrate', input: { targets: [s.task.workspace.objects[0].id] } } };
  act(() => { expect(runtime.dispatch(command).status).toBe('committed'); });
  const marks = runtime.getSnapshot().task.workspace.demonstration;
  await h.say('five'); await h.feedback('Five is correct.', true);
  act(() => seam.host.focus('shape'));
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(runtime.getSnapshot().instanceId).toBe('shape');
  expect(runtime.getSnapshot().task.workspace.pendingResponse).toBeUndefined();
  act(() => expect(runtime.dispatch({ ...command, commandId: 'late' }).status).toBe('stale'));
  await act(async () => { seam.event({ type: 'runtime_audio_idle' }); await vi.advanceTimersByTimeAsync(100); });
  expect(seam.submit).not.toHaveBeenCalled();
  act(() => seam.host.focus('count'));
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(runtime.getSnapshot().task.workspace.demonstration).toEqual(marks);
  expect(runtime.getSnapshot().task.workspace.pendingResponse).toBeUndefined();
  expect(runtime.getSnapshot().task.evidence.attemptNumber).toBe(0);
});

it('retains wrong attempts and assistance when tutor-guided correction completes the assignment', async () => {
  const h = await mount(); const runtime = seam.host.runtime;
  seam.outcome.push({ verdict: 'incorrect', transition: 'retry',
    accepted: true, confidence: .99, verdictConfidence: .99, grounded: 1, reason: 'retry', ms: 1 });
  await h.say('four'); await h.feedback('Not quite, try counting them again.');
  expect(seam.submit).not.toHaveBeenCalled();
  const state = runtime.getSnapshot();
  act(() => runtime.dispatch({ sessionEpoch: state.sessionEpoch, instanceId: state.instanceId, itemId: state.task.itemId,
    expectedRevision: state.revision, commandId: 'help', action: { type: 'workspace', operation: 'begin_help' } }));
  await h.say('five'); await h.feedback('Yes, five blocks!');
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(seam.submit).toHaveBeenCalledTimes(1);
  expect(seam.submit.mock.calls[0][0]).toMatchObject({ success: true, score: 67,
    diagnosisEvidence: { firstResponseScore: 0 }, studentWork: { teachingAttempts: [
      { correct: false, source: 'speech' }, { correct: true, assisted: true, source: 'speech' }] } });
});

it('reconnect preserves work, clears unfinished speech and invalidates old action tickets', async () => {
  const h = await mount(false, true); const runtime = seam.host.runtime;
  const original = runtime.getSnapshot();
  const cmd = { sessionEpoch: original.sessionEpoch, instanceId: original.instanceId, itemId: original.task.itemId,
    expectedRevision: original.revision, commandId: 'reconnected-old', action: { type: 'workspace', operation: 'begin_help' } };
  await h.say('five');
  await act(async () => { seam.event({ type: 'session_resuming' }); seam.ai.sessionResumeCount++;
    h.view.rerender(h.tree()); seam.event({ type: 'session_resumed' }); });
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(runtime.getSnapshot().task.workspace.pendingResponse).toBeUndefined();
  expect(runtime.getSnapshot().task.itemId).toBe(original.task.itemId);
  act(() => expect(runtime.dispatch(cmd).status).toBe('stale'));
  await h.feedback('That was right.');
  expect(seam.submit).not.toHaveBeenCalled();
  await h.say('five'); await h.feedback('Five is right.');
  expect(seam.submit).toHaveBeenCalledTimes(1);
});
