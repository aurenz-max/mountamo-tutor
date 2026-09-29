// @vitest-environment jsdom
/**
 * The ordinal-line build_sequence levers on the shared teaching workspace (handoff 21 M2): the real OrdinalLine,
 * TeachingSession and LiveLessonRuntime. A pull changes the line and the scene in one commit and places no picture;
 * the easier line is ungraded and returns to the full item, which alone is credited.
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
    default: return { ...base, characters: LINE, clues: [{ character: 'Duck', position: 3 }, { character: 'Fox', position: 1 },
      { character: 'Mole', position: 4 }, { character: 'Bear', position: 2 }] };
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

const levers = (h: ReturnType<typeof mount>) => h.state().task!.workspace!.levers ?? [];
const drawn = (h: ReturnType<typeof mount>, kind: string) => h.view.container.querySelectorAll(`[data-lever="${kind}"]`);

it('declares its levers on build_sequence only; the flag and the dots place no picture and ride on the next attempt', () => {
  expect(levers(mount('identify'))).toEqual([]);
  cleanup();
  const h = mount('build_sequence');
  expect(levers(h).map(l => [l.id, l.kind])).toEqual([['front_flag', 'help'], ['place_dots', 'help'], ['three_places', 'simplify']]);
  h.build('Mole', 'Duck', 'Bear', 'Fox'); h.settle();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'reversed' });
  h.dispatch('pull_lever', { lever: 'front_flag' });
  expect(drawn(h, 'front-flag')).toHaveLength(1);
  expect(drawn(h, 'front-flag')[0].closest('[data-pip-object]')!.getAttribute('data-pip-object')).toBe('slot-1');
  h.dispatch('pull_lever', { lever: 'place_dots' });
  expect(Array.from(drawn(h, 'place-dots')).map(d => d.children.length)).toEqual([1, 2, 3, 4]);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/flag marks the first place.*Dots under each place/);
  for (const n of ['Fox', 'Bear', 'Duck', 'Mole']) expect(String(h.state().task!.demand.onScreen)).not.toContain(n);
  h.dispatch('retry');
  h.build('Fox', 'Bear', 'Duck', 'Mole'); h.settle();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['front_flag', 'place_dots'] });
});

it('the easier line is three new pictures, ungraded, and returns to the full item, which alone is credited', () => {
  const h = mount('build_sequence');
  h.build('Bear', 'Fox', 'Duck', 'Mole'); h.settle();
  h.dispatch('pull_lever', { lever: 'three_places' });
  expect(h.state().task!.itemId).toBe('c0~simpler');
  expect(h.offer('pull_lever')).toBeUndefined();
  expect(h.view.container.querySelectorAll('[data-pip-object^="slot-"]')).toHaveLength(3);
  expect(h.view.container.querySelector('[data-pip-object="picture-Cat"]')!.textContent).toBe('🐱');
  // Spoken second, third, first: Cat second, Frog third, Owl first.
  h.build('Owl', 'Cat', 'Frog'); h.settle();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('c0');
  h.build('Fox', 'Bear', 'Duck', 'Mole'); h.settle();
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['c0', false, false], ['c0~simpler', true, true], ['c0', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['three_places'], assisted: true });
});
