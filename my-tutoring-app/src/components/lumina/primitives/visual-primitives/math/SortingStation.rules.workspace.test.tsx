// @vitest-environment jsdom
/**
 * K math audit CV1 on the real SortingStation, with the real TeachingSession, LiveLessonRuntime, transport and shell
 * (the harness of SortingStation.workspace.test.tsx): the child's own rule is the rule the next sort uses (R15), a
 * say-the-rule ask takes the tap beside the voice and the activity checks it (R16), and a size sort draws its cards at
 * their sizes (R14).
 */
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

const seam = vi.hoisted(() => ({ conversation: [] as any[], send: vi.fn(), submit: vi.fn(), correct: vi.fn() }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'station',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { playCorrect: seam.correct, playPerfect: vi.fn(),
  playStreak: vi.fn(), tap: vi.fn(), tick: vi.fn(), snap: vi.fn(), invalid: vi.fn(), isEnabled: () => true, getVolume: () => 1 } }));
import SortingStation, { type SortingStationData } from './SortingStation';

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = [];
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const card = (id: string, label: string, emoji: string, attributes: Record<string, string>) => ({ id, label, emoji, attributes });
const SIX = [card('o1', 'Apple', '🍎', { color: 'red', type: 'fruit' }), card('o2', 'Banana', '🍌', { color: 'yellow', type: 'fruit' }),
  card('o3', 'Cherry', '🍒', { color: 'red', type: 'fruit' }), card('o4', 'Duck', '🦆', { color: 'yellow', type: 'toy' }),
  card('o5', 'Car', '🚗', { color: 'red', type: 'toy' }), card('o6', 'Star', '⭐', { color: 'yellow', type: 'toy' })];
const BY_COLOR = [{ label: 'Red', rule: { color: 'red' } }, { label: 'Yellow', rule: { color: 'yellow' } }];

function mount(evalMode: string, challenge: Record<string, unknown>) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  const data = { instanceId: 'station', title: 'Sorting', maxCategories: 2, showCounts: false, showTallyChart: false,
    gradeBand: 'K', supportTier: 'medium', challenges: [{ id: 'c1', instruction: 'Sort.', ...challenge }] } as unknown as SortingStationData;
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <SortingStation data={data} runtimePlanItemId="plan-station" runtimeEvalMode={evalMode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const view = render(tree());
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && x.action.operation === name);
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
      tutor: verdict === 'correct' ? 'Yes.' : 'Not quite.' } });
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  return { runtime, view, state, say, feedback, confirmVisible, dispatch };
}

it('sort_attribute: planned by colour, the child chooses kind, is credited, and the next sort is by kind', () => {
  const h = mount('sort_attribute', { type: 'sort-by-attribute', sortingAttribute: 'color', categories: BY_COLOR, objects: SIX });
  const pick = h.state().task!;
  expect(pick.itemId).toBe('c1::rule');
  // The key the tutor judges against accepts the child's own valid rule.
  expect(pick.workspace!.expectedAnswer).toMatch(/type/);
  h.say('by what kind of thing they are'); h.feedback('correct', 'advance'); h.confirmVisible();
  const next = h.state().task!;
  expect(next.itemId).toMatch(/^c1::o/);
  expect(next.task).toMatch(/Fruit, or Toy\?/);
  expect(next.task).not.toMatch(/Red|Yellow/);
  // The trays on screen are the child's rule's trays.
  expect(h.view.container.querySelector('[data-pip-object="tray-fruit"]')).toBeTruthy();
  expect(h.view.container.querySelector('[data-pip-object="tray-red"]')).toBeNull();
});

it('sort_attribute: the planned rule, said, keeps the planned trays', () => {
  const h = mount('sort_attribute', { type: 'sort-by-attribute', sortingAttribute: 'color', categories: BY_COLOR, objects: SIX });
  h.say('colour'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.task).toMatch(/Red, or Yellow\?/);
});

it('say_rule: the finished sort has unnamed trays; a wrong chip is checked wrong, the rule chip is credited', () => {
  const h = mount('say_rule', { type: 'say-rule', sortingAttribute: 'color', categories: BY_COLOR, objects: SIX });
  const page = h.view.container;
  const first = h.state().task!;
  expect((first.demand as Record<string, unknown>).response).toBe('speech');
  expect(page.querySelector('[data-asked-tray="true"]')).toBeTruthy();
  // No tray name, picture or colour on the page: each of those is the rule.
  const sortText = page.querySelector('[data-pip-object="finished-sort"]')!.textContent!;
  expect(sortText).not.toMatch(/Red|Yellow|🔴|🟡/);
  const chips = Array.from(page.querySelectorAll('[data-rule-chip]')).map(c => c.getAttribute('data-rule-chip')!);
  expect(chips).toContain('Red');
  const wrong = chips.find(c => c !== 'Red')!;
  act(() => { fireEvent.click(page.querySelector(`[data-rule-chip="${wrong}"]`)!); });
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: false, source: 'gesture' });
  // The tutor reopens the item (the shared retry), and the child taps again.
  h.dispatch('retry');
  act(() => { fireEvent.click(page.querySelector('[data-rule-chip="Red"]')!); });
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true, source: 'gesture' });
});

it('a size sort draws each card at its size, the same object big and small', () => {
  const sized = [card('b1', 'Ball', '⚽', { size: 'big' }), card('b2', 'Ball', '⚽', { size: 'small' }),
    card('b3', 'Bear', '🧸', { size: 'big' }), card('b4', 'Duck', '🦆', { size: 'small' })];
  const h = mount('sort_one', { type: 'sort-by-one', sortingAttribute: 'size', objects: sized,
    categories: [{ label: 'Big', rule: { size: 'big' } }, { label: 'Small', rule: { size: 'small' } }] });
  const row = h.view.container.querySelector('[data-pip-object="cards"]')!;
  const px = (id: string) => (row.querySelector(`[data-card-emoji="${id}"]`) as HTMLElement).style.fontSize;
  expect(px('b1')).toBe('64px');
  expect(px('b2')).toBe('32px');
  expect(px('b3')).toBe(px('b1'));
  // A sort by another rule over cards that carry no size is drawn uniformly.
  cleanup();
  const flat = mount('sort_one', { type: 'sort-by-one', sortingAttribute: 'color', categories: BY_COLOR, objects: SIX });
  expect(flat.view.container.querySelector('[data-pip-object="cards"]')).toBeNull();
  expect((flat.view.container.querySelector('[data-card-emoji]') as HTMLElement).style.fontSize).toBe('');
});
