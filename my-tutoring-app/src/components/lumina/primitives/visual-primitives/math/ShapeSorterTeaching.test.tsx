// @vitest-environment jsdom
/**
 * Real ShapeSorter, real TeachingSession, real LiveLessonRuntime, real transport
 * and rendering shell. Only microphone hardware, evaluation writes and sound are
 * substituted. `identify` was the naming pilot (shape-sorter-teaching-2026-09-19);
 * `find_real_object`, `count` and `sort` are this slice's own risks: the real
 * object's own name must never read as the answer, the geometry fact must never
 * be nameable as "the learner counted", and the shape's own name must never pass
 * as a sort group.
 */
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport, runtimePacket } from '../../../components/live-activity/runtime/runtimeTransport';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';
import type { DialogueClassifier } from '../../../components/live-activity/runtime/DialogueObserver';

const seam = vi.hoisted(() => ({ conversation: [] as any[], send: vi.fn(), submit: vi.fn(),
  correct: vi.fn(), evaluationContext: null as unknown, voiceActive: false, close: null as (() => void) | null }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'shapes',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => seam.voiceActive,
    subscribe: (listener: { onTurnClose: () => void }) => { seam.close = listener.onTurnClose; return () => { seam.close = null; }; } },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { playCorrect: seam.correct, playPerfect: vi.fn(),
  playStreak: vi.fn(), tap: vi.fn(), snap: vi.fn(), invalid: vi.fn(), isEnabled: () => true, getVolume: () => 1 } }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import ShapeSorter, { type ShapeSorterData } from './ShapeSorter';
import { itemsFromChallenges, workspaceAssignment, workspaceScene } from './shapeSorterDomain';
import { shapeSorterLive, validateShapeSorterData } from '../../../components/live-activity/adapters/shapeSorterLive';

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.voiceActive = false;
  seam.close = null; seam.evaluationContext = null;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const shape = (kind: string, color: string, rotation = 0) => ({ shape: kind, color, size: 'medium' as const, rotation });

type Mode = 'identify' | 'find_real_object' | 'count' | 'sort';

/** One challenge per mode, each satisfying the domain's own build gates. */
function challengeFor(mode: Mode): ShapeSorterData['challenges'][number] {
  if (mode === 'find_real_object') return { id: 'c1', type: 'identify-real-object', ruleAttribute: 'shape',
    instruction: 'Look at each thing.', shapes: [
      { shape: 'rectangle', color: 'blue', size: 'large', rotation: 0, realObject: 'door', realObjectId: 'door' },
      { shape: 'circle', color: 'cyan', size: 'large', rotation: 0, realObject: 'clock face', realObjectId: 'clock' }] };
  if (mode === 'count') return { id: 'c1', type: 'count', ruleAttribute: 'shape', targetValue: 'hexagon',
    instruction: 'Look at this shape.', shapes: [shape('hexagon', 'blue')] };
  if (mode === 'sort') return { id: 'c1', type: 'sort', ruleAttribute: 'sides',
    instruction: 'Look at the shape.',
    shapes: [shape('triangle', 'red'), shape('square', 'blue'), shape('triangle', 'green'), shape('rectangle', 'yellow')] };
  return { id: 'c1', type: 'identify', ruleAttribute: 'shape',
    instruction: 'Look at the shape.', shapes: [shape('triangle', 'red'), shape('square', 'blue')] };
}

const ALL_MODES: Mode[] = ['identify', 'find_real_object', 'count', 'sort'];

function mount(mode: Mode = 'identify', classify?: DialogueClassifier, gradeBand: 'K' | '1' = '1') {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m), classify);
  const data = { instanceId: 'shapes', title: 'Shapes', gradeBand, challenges: [challengeFor(mode)] } as ShapeSorterData;
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <ShapeSorter data={data} runtimePlanItemId="plan-shapes" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const view = render(tree());
  const state = () => runtime.getSnapshot();
  const offer = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && a.action.operation === name);
  const command = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offer(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    return { sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'shapes', itemId: s.task!.itemId,
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
  const feedback = (verdict: 'correct' | 'incorrect', transition: 'none' | 'advance' | 'retry' = 'none', responseId?: string) =>
    dispatch('apply_tutor_verdict', { dialogue: {
      responseId: responseId ?? state().task!.workspace!.pendingResponse!.id, verdict, transition,
      tutor: verdict === 'correct' ? 'That is right.' : 'That is different.' } });
  return { runtime, transport, sent, view, state, offer, command, dispatch, say, feedback };
}

// ── The advertised capability set, per mode ──

it.each(ALL_MODES)('%s publishes its own task with no scripted cue and no tutor progression tool', mode => {
  const h = mount(mode);
  expect(h.state().owner).toBe('tutor');
  const task = h.state().task!;
  expect(task.task).toBeTruthy();
  expect(task.task).not.toMatch(/\[SHS_|Say exactly|My turn|Your turn/);
  expect(JSON.stringify(task)).not.toMatch(/Say exactly/i);
  expect(h.state().affordances.filter(a => !a.controller).map(a => (a.action as any).operation ?? a.action.type).sort())
    .toEqual(['begin_help', 'demonstrate']);
  expect(runtimePacket(h.state()).choices.some(a => ['retry', 'advance'].includes(a.action.type))).toBe(false);
  expect(task.evidence.attemptNumber).toBe(0);
  cleanup();
});

// ── Rendering matches the mode: only the whole objects genuinely visible ──

it('shows the whole pool with the target ringed for plain identify, and mounts nothing for count or a mat', () => {
  const h = mount('identify');
  expect(h.view.container.querySelectorAll('[data-shape-id]')).toHaveLength(2);
  expect(h.view.container.querySelector('[data-pip-object="shape"]')).toBeTruthy();
  expect(h.view.container.querySelector('[data-shape-id="mat-0"]')).toBeNull();
});

it('shows exactly one object for a real-object item, never the whole pool', () => {
  const h = mount('find_real_object');
  expect(h.view.container.querySelectorAll('[data-shape-id]')).toHaveLength(1);
  expect(screen.getByText('door')).toBeTruthy();
  expect(h.view.container.textContent).not.toContain('clock face');
});

it('shows exactly one large shape for count, with no comparison shapes and no mats', () => {
  const h = mount('count');
  expect(h.view.container.querySelectorAll('[data-shape-id]')).toHaveLength(1);
  expect(h.view.container.querySelector('[data-shape-id="mat-0"]')).toBeNull();
});

it('shows the pool ringed and every printed mat for sort', () => {
  const h = mount('sort');
  expect(h.view.container.querySelectorAll('[data-shape-id^="shape-"]').length).toBeGreaterThan(1);
  expect(h.view.container.querySelectorAll('[data-shape-id^="mat-"]').length).toBeGreaterThanOrEqual(2);
  expect(h.view.container.textContent).toMatch(/3 sides/);
  expect(h.view.container.textContent).toMatch(/4 sides/);
});

// ── The scene never leaks the answer, but the tutor DOES get it (TW-9) ──

it('never states a learner response as a scene fact, for any mode', () => {
  for (const mode of ALL_MODES) {
    const h = mount(mode);
    const task = h.state().task!;
    expect(task.evidence.correctness).toBe('unknown');
    expect(task.workspace!.objects.every(o => !o.selected)).toBe(true);
    expect(JSON.stringify(task.demand)).not.toMatch(/"(said|answered|produced|counted|heard)":/);
    cleanup();
  }
});

it('publishes exactly the domain assignment and scene the verdict probe replays, per mode', () => {
  for (const mode of ALL_MODES) {
    const h = mount(mode);
    const built = itemsFromChallenges([challengeFor(mode)], { isPreReader: false });
    const item = built[0];
    const { task, expectedAnswer, response } = workspaceAssignment(item);
    const scene = workspaceScene(item, challengeFor(mode).shapes);
    expect(h.state().task, mode).toMatchObject({ task, demand: { ...scene.facts, response, presentation: 'ready' } });
    expect(h.state().task!.workspace, mode).toMatchObject({ objects: scene.objects, expectedAnswer });
    cleanup();
  }
});

// ── TW-2: instructional progress, verdict and advance are separate ──

it('holds success on the item without advancing, then advances on a fresh commit', () => {
  const h = mount('count');
  h.say('six'); h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.offer('advance')).toBeTruthy();
  expect(h.state().status).not.toBe('completed');
});

it('preserves the earlier wrong attempt and its assistance when a correction is accepted', () => {
  const h = mount('sort');
  h.dispatch('begin_help');
  h.say('4 sides'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.evidence.attemptNumber).toBe(1);
  h.say('3 sides'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts).toHaveLength(2);
  expect(h.state().task!.support.level).toBe(2);
});

// ── Help and demonstration are not learner work (TW-4, TW-8, TW-9) ──

it('marks a whole shape for a demonstration without recording an attempt, on every mode', () => {
  for (const mode of ALL_MODES) {
    const h = mount(mode);
    const target = h.state().task!.workspace!.objects[0].id;
    h.dispatch('demonstrate', { targets: [target] });
    expect(h.view.container.querySelector(`[data-shape-id="${target}"]`)?.getAttribute('data-tutor-demonstration')).toBe('true');
    expect(h.state().task!.evidence.attemptNumber).toBe(0);
    h.dispatch('demonstrate', { targets: [] });
    expect(h.state().task!.workspace!.demonstration).toEqual([]);
    expect(h.state().task!.support.level).toBe(2); // Clearing a mark does not erase the help.
    cleanup();
  }
});

it('refuses an unknown demonstration target on a sort mat without a partial mutation', () => {
  const h = mount('sort');
  expect(h.dispatch('demonstrate', { targets: ['mat-99'] }).status).not.toBe('committed');
  expect(h.state().task!.workspace!.demonstration).toEqual([]);
});

// ── Spoken evidence: the tutor's completed feedback owns the verdict (TW-3) ──

it('keeps speech as context until observed tutor feedback records a verdict', () => {
  const h = mount('sort');
  h.say('can you help me?');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.say('4 sides'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.offer('advance')).toBeUndefined();
  h.say('3 sides'); h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.workspace!.attempts).toHaveLength(2);
  expect(seam.correct).toHaveBeenCalledOnce();
});

it('refuses a verdict carrying a stale response id, and re-opens on new words', () => {
  const h = mount('identify');
  h.say('circle');
  const stale = h.state().task!.workspace!.pendingResponse!.id;
  h.say('triangle');
  expect(h.state().task!.workspace!.pendingResponse!.id).not.toBe(stale);
  expect(h.feedback('correct', 'none', stale).status).not.toBe('committed');
  expect(h.state().task!.evidence.correctness).toBe('unknown');
  h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

// ── Observation lifecycle and completion ──

it('observes settled speech, advances visibly, and completes once after playback drains', async () => {
  const classify = vi.fn(async () => ({ verdict: 'correct' as const, transition: 'advance' as const,
    confidence: .99, verdictConfidence: .99, grounded: 1, accepted: true, reason: 'supported', ms: 200 }));
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('count', classify);
  h.say('six');
  await act(async () => { h.transport.beginTurn('That is right, six.'); h.transport.endTurn(true); });
  await act(async () => { h.transport.audioChanged(false); });
  await act(async () => { await vi.advanceTimersByTimeAsync(80); });
  expect(classify).toHaveBeenCalledOnce();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [passed, accuracy] = seam.submit.mock.calls[0];
  expect(passed).toBe(true);
  expect(accuracy).toBe(100);
  h.transport.close();
});

it('refuses every action after the learner stops', () => {
  const h = mount('identify');
  const help = h.command('begin_help');
  act(() => { h.runtime.stop(); });
  expect(h.state().affordances).toEqual([]);
  expect(h.runtime.dispatch(help).status).not.toBe('committed');
});

// ── The registry row: what the route accepts and what the model is told ──

it('advertises every catalog mode under tutor ownership', () => {
  expect(shapeSorterLive.modes).toEqual(['identify', 'find_real_object', 'count', 'sort']);
  expect(shapeSorterLive.teachingOwner).toBe('tutor');
  expect(shapeSorterLive.canAdvance).toBe(false);
  expect(shapeSorterLive.tutoring).toBeNull();
  expect(shapeSorterLive.copy.lessons.map(([mode]) => mode)).toEqual(shapeSorterLive.modes);
});

it('keeps guidance inside the backend offer cap, with no sentence for the tutor to recite', () => {
  expect(shapeSorterLive.guidance.length).toBeLessThanOrEqual(2000);
  expect(shapeSorterLive.guidance).not.toMatch(/say exactly|Say exactly/);
});

// ── The pool gates: what cannot be drawn truthfully is rejected, not repaired ──

it('accepts every valid challenge type and rejects a real-object shape with no known object', () => {
  for (const mode of ALL_MODES) expect(validateShapeSorterData({ title: 'Shapes', gradeBand: 'K',
    challenges: [challengeFor(mode)] } as ShapeSorterData)).toBeTruthy();
  const bad = challengeFor('find_real_object');
  expect(() => validateShapeSorterData({ title: 'Shapes', gradeBand: 'K',
    challenges: [{ ...bad, shapes: [{ ...bad.shapes[0], realObjectId: 'not-real' as any }] }] })).toThrow();
  const plain = challengeFor('identify');
  expect(() => validateShapeSorterData({ title: 'Shapes', gradeBand: 'K',
    challenges: [{ ...plain, shapes: [{ ...plain.shapes[0], realObjectId: 'clock' as any }] }] })).toThrow();
});
