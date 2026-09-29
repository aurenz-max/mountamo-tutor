// @vitest-environment jsdom
/**
 * The compare-objects order_three levers on the shared teaching workspace (handoff 21 M2): the real CompareObjects,
 * TeachingSession and LiveLessonRuntime. `pull_lever` changes the board and the scene in one commit, names no object's
 * place, records the lever on the next attempt, and the easier order is ungraded and returns to the full item.
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
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'measure',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { playCorrect: seam.correct, playPerfect: vi.fn(),
  playStreak: vi.fn(), tap: vi.fn(), snap: vi.fn(), invalid: vi.fn(), isEnabled: () => true, getVolume: () => 1 } }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import CompareObjects, { type CompareObjectsData } from './CompareObjects';
/** The submission waits for the scoring pass (a fetch that rejects in jsdom, so every spoken attempt keeps its flow verdict). */
const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.evaluationContext = null;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

type Kind = 'compare_two' | 'identify_attribute' | 'order_three' | 'non_standard';
const obj = (name: string, size: number, value: number) => ({ name, visualSize: size, actualValue: value });
const PAIR = [obj('pencil', 120, 12), obj('crayon', 60, 6)];

/** One challenge per mode, each satisfying `itemFromChallenge`'s own gates. */
function challengeFor(kind: Kind, id: string = kind): Record<string, any> {
  const base = { id, type: kind, attribute: 'length' };
  switch (kind) {
    case 'compare_two': return { ...base, comparisonWord: 'longer', correctAnswer: 'pencil', objects: PAIR };
    case 'identify_attribute': return { ...base, correctAttribute: 'length', attributeOptions: ['length', 'weight'], objects: PAIR };
    case 'order_three': return { ...base, comparisonWord: 'longer', correctAnswer: 'ruler,pencil,crayon',
      objects: [obj('pencil', 50, 12), obj('ruler', 60, 30), obj('crayon', 40, 6)] };
    default: return { ...base, unitName: 'cube', unitCount: 5, objects: [obj('pencil', 120, 12)] };
  }
}

function mount(evalMode: string, challenges: Record<string, any>[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data = { instanceId: 'measure', title: 'Comparing things', gradeBand: '1', challenges } as unknown as CompareObjectsData;
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <CompareObjects data={data} runtimePlanItemId="plan-measure" runtimeEvalMode={evalMode} />
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
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId, instanceId: 'measure',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
  };
  const touch = (...names: string[]) => { for (const n of names) act(() => {
    fireEvent.click(view.container.querySelector(`[data-pip-object="pick-${n}"]`)!); }); };
  const settle = () => act(() => { vi.advanceTimersByTime(4000); });
  const say = (text: string) => act(() => {
    seam.conversation = [...seam.conversation, { role: 'user', content: text, timestamp: seam.conversation.length + 1 }];
    view.rerender(tree());
  });
  const feedback = (verdict: 'correct' | 'incorrect', transition: 'none' | 'advance' | 'retry' = 'none') =>
    dispatch('apply_tutor_verdict', { dialogue: { responseId: state().task!.workspace!.pendingResponse!.id, verdict, transition,
      tutor: verdict === 'correct' ? 'Yes, that is right.' : 'Not quite.' } });
  return { runtime, transport, sent, view, state, offer, dispatch, confirmVisible, touch, settle, say, feedback };
}

const levers = (h: ReturnType<typeof mount>) => h.state().task!.workspace!.levers ?? [];
const drawn = (h: ReturnType<typeof mount>, kind: string) => h.view.container.querySelectorAll(`[data-lever="${kind}"]`);

it('order_three pulls change the board without naming a place', () => {
  const h = mount('order_three', [challengeFor('order_three')]);
  expect(levers(h).map(l => [l.id, l.kind])).toEqual([['order_steps', 'help'], ['touch_slots', 'help'], ['measure_grid', 'help'],
    ['far_three', 'simplify']]);
  h.touch('crayon', 'pencil', 'ruler'); h.settle();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'reversed' });
  h.dispatch('pull_lever', { lever: 'order_steps' });
  expect(drawn(h, 'order-steps')).toHaveLength(1);
  expect(drawn(h, 'order-steps')[0].textContent).toBe('');
  h.dispatch('pull_lever', { lever: 'touch_slots' });
  h.dispatch('pull_lever', { lever: 'measure_grid' });
  expect(drawn(h, 'measure-grid')).toHaveLength(1);
  const demand = h.state().task!.demand;
  expect(demand.onScreen).toMatch(/wordless bars/);
  for (const n of ['ruler', 'pencil', 'crayon']) expect(String(demand.onScreen)).not.toContain(n);

  h.dispatch('retry');
  h.touch('ruler');
  expect(Array.from(drawn(h, 'touch-slots')[0].children).map(d => d.getAttribute('data-filled'))).toEqual(['true', 'false', 'false']);
  h.touch('pencil', 'crayon'); h.settle();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true,
    levers: ['order_steps', 'touch_slots', 'measure_grid'] });
});

it('the easier order is ungraded and returns to the full item, which alone is credited', () => {
  const h = mount('order_three', [challengeFor('order_three')]);
  h.touch('pencil', 'ruler', 'crayon'); h.settle();
  h.dispatch('pull_lever', { lever: 'far_three' });
  expect(h.state().task!.itemId).toBe('order_three~simpler');
  expect(h.state().task!.workspace!.practice).toEqual({ returnsTo: 'order_three' });
  expect(h.offer('pull_lever')).toBeUndefined();
  // Blue, pink, green ribbon drawn middle, biggest, smallest: longest first is pink, blue, green.
  h.touch('pink ribbon', 'blue ribbon', 'green ribbon'); h.settle();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('order_three');
  expect(h.view.container.querySelector('[data-pip-object="pick-ruler"]')).toBeTruthy();
  h.touch('ruler', 'pencil', 'crayon'); h.settle();
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['order_three', false, false], ['order_three~simpler', true, true], ['order_three', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['far_three'], assisted: true });
});

// ── The spoken modes (handoff 23 step 2) ─────────────────────────────────────

const close = (id = 'compare_two') => ({ ...challengeFor('compare_two', id), objects: [obj('pencil', 60, 12), obj('crayon', 50, 6)] });

it('compare_two: word_model shows a fixed model pair beside the picture; the next spoken attempt carries it', () => {
  const h = mount('compare_two', [challengeFor('compare_two')]);
  expect(levers(h).map(l => [l.id, l.kind])).toEqual([['word_model', 'help']]);
  h.say('the crayon'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'word_model' });
  const model = drawn(h, 'word-model');
  expect(model).toHaveLength(1);
  expect(model[0].getAttribute('data-glow')).toBe('0');
  expect(model[0].textContent).toBe('');
  const demand = h.state().task!.demand;
  expect(demand.onScreen).toMatch(/model pair of plain shapes shows what "longer" means/);
  for (const n of ['pencil', 'crayon']) expect(String(demand.onScreen)).not.toContain(n);
  h.say('the pencil'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['word_model'] });
});

it('compare_two: far_pair on a close pair is an ungraded easier pair, then the full pair is credited', () => {
  const h = mount('compare_two', [close(), { ...challengeFor('identify_attribute', 'next') }]);
  expect(levers(h).map(l => l.id)).toEqual(['word_model', 'far_pair']);
  h.say('crayon'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'far_pair' });
  const task = h.state().task!;
  expect(task.itemId).toBe('compare_two~simpler');
  expect(task.workspace!.practice).toEqual({ returnsTo: 'compare_two' });
  expect(task.workspace!.expectedAnswer).toBe('blue ribbon');
  h.say('blue ribbon'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('compare_two');
  h.say('pencil'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['compare_two', false, false], ['compare_two~simpler', true, true], ['compare_two', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['far_pair'] });
});

it('identify_attribute: menu_pictures shows every choice alike; fewer_choices greys out one wrong one', () => {
  const three = { ...challengeFor('identify_attribute'), attributeOptions: ['length', 'weight', 'capacity'] };
  const h = mount('identify_attribute', [three]);
  expect(levers(h).map(l => [l.id, l.kind])).toEqual([['menu_pictures', 'help'], ['fewer_choices', 'simplify']]);
  h.dispatch('pull_lever', { lever: 'menu_pictures' });
  const options = () => Array.from(drawn(h, 'menu-pictures')[0].querySelectorAll('[data-option]'));
  expect(options().map(o => o.getAttribute('data-dropped'))).toEqual(['false', 'false', 'false']);
  h.dispatch('pull_lever', { lever: 'fewer_choices' });
  const dropped = options().filter(o => o.getAttribute('data-dropped') === 'true').map(o => o.getAttribute('data-option'));
  expect(dropped).toHaveLength(1);
  expect(dropped[0]).not.toBe('length');
  expect(h.state().task!.demand.onScreen).toMatch(/greyed out/);
  h.say('how long they are'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ assisted: true, levers: ['menu_pictures', 'fewer_choices'] });
});

it('non_standard: tap_boxes makes the boxes tappable and fills only the taps; shorter_measure opens a shorter measure', () => {
  const eight = { ...challengeFor('non_standard'), unitCount: 8 };
  const h = mount('non_standard', [eight]);
  expect(levers(h).map(l => l.id)).toEqual(['tap_boxes', 'five_marks', 'shorter_measure']);
  expect(h.view.container.querySelectorAll('button[data-unit-box]')).toHaveLength(0);
  h.dispatch('pull_lever', { lever: 'tap_boxes' });
  const boxes = () => Array.from(h.view.container.querySelectorAll('button[data-unit-box]'));
  expect(boxes()).toHaveLength(8);
  act(() => { fireEvent.click(boxes()[0]); fireEvent.click(boxes()[1]); });
  expect(boxes().map(b => b.getAttribute('data-filled'))).toEqual(['true', 'true', 'false', 'false', 'false', 'false', 'false', 'false']);
  expect(h.view.container.querySelector('[data-lever="tap-boxes"]')!.textContent).toBe('');
  h.dispatch('pull_lever', { lever: 'five_marks' });
  expect(Array.from(drawn(h, 'five-marks')).map(b => b.getAttribute('data-unit-box'))).toEqual(['4']);
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/\b8\b/);
  h.say('nine'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'shorter_measure' });
  expect(h.state().task!.itemId).toBe('non_standard~simpler');
  expect(h.state().task!.workspace!.expectedAnswer).toBe('4');
  expect(boxes()).toHaveLength(4);
  h.say('four'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('non_standard');
  expect(boxes()).toHaveLength(8);
});
