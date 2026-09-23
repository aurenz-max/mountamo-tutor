// @vitest-environment jsdom
/**
 * W1 minimal binding: the real OrdinalLine on the shared teaching workspace, with the
 * real TeachingSession, LiveLessonRuntime, transport and rendering shell. Only
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
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'line-up',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { playCorrect: seam.correct, playPerfect: vi.fn(),
  playStreak: vi.fn(), tap: vi.fn(), tick: vi.fn(), snap: vi.fn(), invalid: vi.fn(), isEnabled: () => true, getVolume: () => 1 } }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import OrdinalLine, { type OrdinalLineData } from './OrdinalLine';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { getComponentById } from '../../../service/manifest/catalog';
const ordinalLineLive = LIVE_ADAPTERS['ordinal-line'];

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.evaluationContext = null;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

type Mode = 'identify' | 'match' | 'relative_position' | 'sequence_story' | 'build_sequence';

const LINE = [{ name: 'Fox', emoji: '🦊' }, { name: 'Bear', emoji: '🐻' }, { name: 'Duck', emoji: '🦆' }, { name: 'Mole', emoji: '🐹' }];
const CLUES = [{ character: 'Fox', position: 1 }, { character: 'Bear', position: 2 }, { character: 'Duck', position: 3 }];

/** One challenge per mode, each satisfying `itemsFromChallenge`'s own gates. */
function challengeFor(mode: Mode): Record<string, unknown> {
  const base = { id: 'c0', type: mode.replace('_', '-'), instruction: '', characters: LINE.slice(0, 3) };
  switch (mode) {
    case 'identify': return { ...base, characters: LINE, targetPosition: 3, correctAnswer: '3' };
    case 'relative_position': return { ...base, targetPosition: 2, relativeQuery: 'after', correctAnswer: 'Duck' };
    case 'match': return { ...base, matchPairs: [{ symbol: '2nd', word: 'second' }] };
    case 'sequence_story': return { ...base, clues: CLUES,
      storyText: 'The Fox got to the front. The Bear came along next. The Duck came along at the end.' };
    default: return { ...base, clues: CLUES };
  }
}

function mount(evalMode: Mode, band: 'K' | '1' = 'K') {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data = { instanceId: 'line-up', title: 'The line up', gradeBand: band, maxPosition: 4, context: 'race',
    showOrdinalLabels: true, labelFormat: 'symbol', challenges: [challengeFor(evalMode)] } as unknown as OrdinalLineData;
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <OrdinalLine data={data} runtimePlanItemId="plan-line" runtimeEvalMode={evalMode} />
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
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId, instanceId: 'line-up',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
  };
  const touch = (id: string) => act(() => {
    fireEvent.click(view.container.querySelector(`[data-pip-object="${id}"]`)!);
  });
  /** Picture then place, for each name in turn: the page's own two-tap mechanic. */
  const build = (...names: string[]) => names.forEach((name, i) => { touch(`picture-${name}`); touch(`slot-${i + 1}`); });
  const settle = () => act(() => { vi.advanceTimersByTime(4000); });
  const say = (text: string) => act(() => {
    seam.conversation = [...seam.conversation, { role: 'user', content: text, timestamp: seam.conversation.length + 1 }];
    view.rerender(tree());
  });
  const feedback = (verdict: 'correct' | 'incorrect', transition: 'none' | 'advance' | 'retry' = 'none') =>
    dispatch('apply_tutor_verdict', { dialogue: { responseId: state().task!.workspace!.pendingResponse!.id, verdict, transition,
      tutor: verdict === 'correct' ? 'Yes, that is right.' : 'Not quite.' } });
  return { runtime, transport, sent, view, state, offer, dispatch, confirmVisible, touch, build, settle, say, feedback };
}

const tutorTools = (h: ReturnType<typeof mount>) => h.state().affordances.filter(a => !a.controller)
  .map(a => (a.action as { operation?: string }).operation ?? a.action.type).sort();

it.each(['identify', 'match', 'relative_position', 'sequence_story', 'build_sequence'] as const)(
  '%s binds the workspace under tutor ownership, with no runner cue and no demonstration', mode => {
    const h = mount(mode);
    expect(h.state().owner).toBe('tutor');
    expect(h.state().task!.task).not.toMatch(/Say exactly|\[OL/);
    expect(tutorTools(h)).toEqual(['begin_help']);
    expect(seam.send.mock.calls.flat().join(' ')).not.toMatch(/\[OL|Say exactly/);
    // The runner's re-ask button has nothing to call here; the learner asks the tutor.
    expect(h.view.container.querySelector('[aria-label="Hear the question again"]')).toBeNull();
  });

it('a spoken item publishes its spoken key; a build never publishes its answer line', () => {
  const h = mount('identify');
  expect(h.state().task!.workspace!.expectedAnswer).toBe('Duck');
  expect(h.state().task!.demand).toMatchObject({ kind: 'identify', front: 'the starting line' });
  cleanup();
  const g1 = mount('identify', '1');
  expect(g1.state().task!.workspace!.expectedAnswer).toBe('third');
  cleanup();
  const b = mount('build_sequence');
  expect(b.state().task!.workspace!.expectedAnswer).toBeUndefined();
  // The clues are the spoken task; the scene reports only what the learner placed.
  expect(b.state().task!.task).toContain('The Fox goes first.');
  expect(b.state().task!.demand).toMatchObject({ places: 3, line: 'Placed none of the pictures' });
});

it('build: the line checks a still, full line, Try again clears it, and a right one completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('build_sequence');
  h.build('Duck', 'Bear', 'Fox'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('Placed 3 of 3, from the first place: Duck, Bear, Fox');
  expect(h.offer('advance')).toBeUndefined();
  h.dispatch('retry');
  expect(h.view.container.querySelector('[data-pip-object="picture-Fox"]')).not.toBeNull();
  h.build('Fox', 'Bear', 'Duck'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance');
  expect(h.state().status).not.toBe('completed');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][0]).toBe(true);
  expect(seam.correct).toHaveBeenCalledOnce();
});

it('build: a part-filled line that stays still commits and is checked wrong, as on the runner', () => {
  const h = mount('build_sequence');
  h.touch('picture-Fox'); h.touch('slot-1'); h.touch('picture-Duck'); h.touch('slot-3'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(seam.send.mock.calls.at(-1)![0]).toContain('Placed 2 of 3, from the first place: Fox, empty, Duck');
});

it('identify: the place labels wait for the credited answer; a wrong answer reopens the same item', () => {
  const h = mount('identify');
  const first = h.state().task!.itemId;
  expect(h.view.container.textContent).not.toMatch(/3rd/);
  h.say('the bear'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.itemId).toBe(first);
  expect(h.state().status).not.toBe('completed');
  h.say('duck'); h.feedback('correct');
  expect(h.view.container.textContent).toMatch(/3rd/);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
});

it('the packet carries learner signals for the current item', () => {
  const h = mount('relative_position');
  act(() => h.transport.publish());
  const packet = h.sent.filter(m => m.type === 'runtime_state').at(-1).state;
  expect(packet.learner.signals).toMatchObject({ attempts: 0, learnerTurns: 0, helpRequests: 0 });
  h.transport.close();
});

it('advertises every catalog mode under tutor ownership, inside the guidance cap', () => {
  expect([...ordinalLineLive.modes].sort()).toEqual((getComponentById('ordinal-line')?.evalModes ?? []).map(m => m.evalMode).sort());
  expect(ordinalLineLive).toMatchObject({ teachingOwner: 'tutor', canAdvance: false, tutoring: null, bindsTeachingWorkspace: true });
  expect(ordinalLineLive.guidance.length).toBeLessThanOrEqual(2000);
  expect(ordinalLineLive.guidance).not.toMatch(/say exactly/i);
});
