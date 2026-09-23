// @vitest-environment jsdom
/**
 * W1 minimal binding: the real SortingStation on the shared teaching workspace, with
 * the real TeachingSession, LiveLessonRuntime, transport and rendering shell. Only
 * microphone hardware, evaluation writes and sound are substituted. The scripted
 * runner must never mount on this path; its context push would crash on this AI
 * mock, which has no `updateContext`.
 */
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

const seam = vi.hoisted(() => ({ conversation: [] as any[], send: vi.fn(), submit: vi.fn(),
  correct: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'station',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { playCorrect: seam.correct, playPerfect: vi.fn(),
  playStreak: vi.fn(), tap: vi.fn(), tick: vi.fn(), snap: vi.fn(), invalid: vi.fn(), isEnabled: () => true, getVolume: () => 1 } }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import SortingStation, { type SortingStationData } from './SortingStation';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { getComponentById } from '../../../service/manifest/catalog';
const sortingStationLive = LIVE_ADAPTERS['sorting-station'];

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.evaluationContext = null;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const fruit = (id: string, label: string, color: string, size = 'Big') =>
  ({ id, label, emoji: '', attributes: { color, size } });
const FRUITS = [fruit('o1', 'apple', 'Red'), fruit('o2', 'banana', 'Yellow'), fruit('o3', 'cherry', 'Red'),
  fruit('o4', 'lemon', 'Yellow'), fruit('o5', 'strawberry', 'Red', 'Small')];
const CATEGORIES = [{ label: 'Red', rule: { color: 'Red' } }, { label: 'Yellow', rule: { color: 'Yellow' } }];

/** The catalog mode and the challenge type the generator emits for it. */
const MODES = [['sort_one', 'sort-by-one'], ['sort_attribute', 'sort-by-attribute'], ['sort_variety', 'sort-variety'],
  ['count_compare', 'count-and-compare'], ['odd_one_out', 'odd-one-out'], ['two_attributes', 'two-attributes']] as const;

function challengeFor(type: string): Record<string, any> {
  const base = { id: 'c1', type, instruction: 'Sort by color.', sortingAttribute: 'color', categories: CATEGORIES, objects: FRUITS };
  switch (type) {
    case 'count-and-compare': return { ...base, comparisonQuestion: 'Which group has more?', correctComparison: 'more' };
    case 'odd-one-out': return { ...base, oddOneOut: 'o5', oddOneOutReason: 'It is the only small one.' };
    case 'two-attributes': return { ...base, targetCategory: 'Red', secondaryAttribute: 'size', secondaryValue: 'Big' };
    default: return base;
  }
}

function mount(evalMode: string, type: string) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data = { instanceId: 'station', title: 'Colors', maxCategories: 2, showCounts: false, showTallyChart: false,
    gradeBand: 'K', supportTier: 'medium', challenges: [challengeFor(type)] } as unknown as SortingStationData;
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <SortingStation data={data} runtimePlanItemId="plan-station" runtimeEvalMode={evalMode} />
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
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId, instanceId: 'station',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
  };
  const say = (text: string) => act(() => {
    seam.conversation = [...seam.conversation, { role: 'user', content: text, timestamp: seam.conversation.length + 1 }];
    view.rerender(tree());
  });
  const feedback = (verdict: 'correct' | 'incorrect', transition: 'none' | 'advance' | 'retry' = 'none') =>
    dispatch('apply_tutor_verdict', { dialogue: { responseId: state().task!.workspace!.pendingResponse!.id, verdict, transition,
      tutor: verdict === 'correct' ? 'Yes, that is right.' : 'Not quite.' } });
  return { runtime, transport, sent, view, state, offer, dispatch, confirmVisible, say, feedback };
}

const tutorTools = (h: ReturnType<typeof mount>) => h.state().affordances.filter(a => !a.controller)
  .map(a => (a.action as { operation?: string }).operation ?? a.action.type).sort();

it.each(MODES)('%s binds the workspace under tutor ownership, spoken, with no runner cue', (mode, type) => {
  const h = mount(mode, type);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).not.toMatch(/Say exactly|\[SS_/);
  expect(h.state().task!.workspace!.expectedAnswer).toBeTruthy();
  expect(tutorTools(h)).toEqual(['begin_help']);
  expect(seam.send.mock.calls.flat().join(' ')).not.toMatch(/\[SS_|Say exactly/);
});

it('a count item keeps its tray counts hidden, and the scene says so', () => {
  const h = mount('count_compare', 'count-and-compare');
  const demand = h.state().task!.demand as Record<string, unknown>;
  expect(String(demand.constraints)).toContain('counts are hidden');
  expect(JSON.stringify(demand)).not.toMatch(/"3"|"2"/);
});

it('a wrong answer reopens the item; the right one files the card and completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('sort_one', 'sort-by-one');
  const first = h.state().task!;
  expect(first.workspace!.expectedAnswer).toBe('Red');
  h.say('yellow'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.itemId).toBe(first.itemId);
  const ids: string[] = [first.itemId];
  for (let guard = 0; guard < 10 && h.state().status !== 'completed'; guard++) {
    h.say(h.state().task!.workspace!.expectedAnswer!); h.feedback('correct', 'advance'); h.confirmVisible();
    if (h.state().task && !ids.includes(h.state().task!.itemId)) ids.push(h.state().task!.itemId);
  }
  expect(h.state().status).toBe('completed');
  expect(ids.length).toBeGreaterThan(1);
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][0]).toBe(true);
});

it('a verdict that credits and advances in one step still files the card (onAffirmed at the commit)', () => {
  const h = mount('sort_one', 'sort-by-one');
  const tray = (label: string) => h.view.container.querySelector(`[data-pip-object="tray-${label.toLowerCase()}"]`)!;
  const cards = (label: string) => tray(label).querySelectorAll('.flex-wrap > div').length;
  const first = h.state().task!, group = first.workspace!.expectedAnswer!;
  expect(cards(group)).toBe(0);
  h.say(group); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).not.toBe(first.itemId);
  expect(cards(group)).toBe(1);
});

it('the packet carries learner signals for the current item', () => {
  const h = mount('sort_one', 'sort-by-one');
  act(() => h.transport.publish());
  const packet = h.sent.filter(m => m.type === 'runtime_state').at(-1).state;
  expect(packet.learner.signals).toMatchObject({ attempts: 0, learnerTurns: 0, helpRequests: 0 });
  h.transport.close();
});

it('advertises every catalog mode under tutor ownership, inside the guidance cap', () => {
  expect([...sortingStationLive.modes].sort()).toEqual((getComponentById('sorting-station')?.evalModes ?? []).map(m => m.evalMode).sort());
  expect(sortingStationLive).toMatchObject({ teachingOwner: 'tutor', canAdvance: false, tutoring: null, bindsTeachingWorkspace: true });
  expect(sortingStationLive.guidance.length).toBeLessThanOrEqual(2000);
  expect(sortingStationLive.guidance).not.toMatch(/say exactly/i);
});
