// @vitest-environment jsdom
/**
 * The number-sequencer order_cards levers on the shared teaching workspace (handoff 21 M2): the real NumberSequencer,
 * TeachingSession and LiveLessonRuntime. A pull changes the train and the scene in one commit and names no card's
 * place; the easier train is ungraded and returns to the full item, which alone is credited.
 */
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

const seam = vi.hoisted(() => ({ conversation: [] as any[], send: vi.fn(), submit: vi.fn(), correct: vi.fn(),
  evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'train',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { playCorrect: seam.correct, playPerfect: vi.fn(),
  playStreak: vi.fn(), tap: vi.fn(), snap: vi.fn(), invalid: vi.fn(), isEnabled: () => true, getVolume: () => 1 } }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import NumberSequencer, { type NumberSequencerChallenge, type NumberSequencerData } from './NumberSequencer';

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.evaluationContext = null;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const cards = (id: string, sequence: number[]): NumberSequencerChallenge => ({ id, type: 'order-cards', instruction: '', sequence,
  correctAnswers: [...sequence].sort((a, b) => a - b), rangeMin: Math.min(...sequence), rangeMax: Math.max(...sequence) });

function mount(challenges: NumberSequencerChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const data = { instanceId: 'train', title: 'Number trains', gradeBand: '1', showNumberLine: false, showDotArrays: false,
    challenges } as NumberSequencerData;
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <NumberSequencer data={data} autoStart runtimePlanItemId="plan-train" runtimeEvalMode="order_cards" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const offer = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && (a.action as { operation: string }).operation === name);
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offer(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    let result: ReturnType<typeof runtime.dispatch> | undefined;
    act(() => { result = runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'train',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
    return result!;
  };
  const place = (...values: number[]) => values.forEach(v => act(() => {
    fireEvent.click(view.container.querySelector(`[data-card-id="card-${v}"]`)!); }));
  const levers = () => state().task!.workspace!.levers ?? [];
  const drawn = (kind: string) => view.container.querySelectorAll(`[data-lever="${kind}"]`);
  return { runtime, view, state, offer, dispatch, place, levers, drawn };
}

it('help pulls draw the steps and the card marks, name no place, and ride on the next attempt', () => {
  const h = mount([cards('one', [13, 14, 11, 12]), cards('two', [30, 22, 26])]);
  expect(h.levers().map(l => [l.id, l.kind])).toEqual([['train_steps', 'help'], ['card_marks', 'help'], ['three_cards', 'simplify']]);
  h.place(14, 13, 12, 11);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'reversed' });
  h.dispatch('pull_lever', { lever: 'train_steps' });
  expect(h.drawn('train-steps')).toHaveLength(1);
  expect(h.drawn('train-steps')[0].textContent).toBe('');
  h.dispatch('retry');
  h.dispatch('pull_lever', { lever: 'card_marks' });
  expect(h.drawn('card-marks')).toHaveLength(4);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/grow from the first place to the last.*sticks of ten/);
  h.place(11, 12, 13, 14);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['train_steps', 'card_marks'] });
});

it('the easier train is ungraded, uses none of the item\'s cards, and returns to the full item, which alone is credited', () => {
  const h = mount([cards('one', [13, 14, 11, 12]), cards('two', [30, 22, 26])]);
  h.place(11, 12, 14, 13);
  expect(h.dispatch('pull_lever', { lever: 'three_cards' }).status).toBe('committed');
  expect(h.state().task!.itemId).toBe('one:-1-answer~simpler');
  expect(h.offer('pull_lever')).toBeUndefined();
  const shown = Array.from(h.view.container.querySelectorAll('[data-card-id]')).map(c => Number(c.getAttribute('data-card-id')!.slice(5)));
  expect(shown).toHaveLength(3);
  expect(shown.some(n => [11, 12, 13, 14].includes(n))).toBe(false);
  const sorted = [...shown].sort((a, b) => a - b);
  expect(shown.every((n, i) => n !== sorted[i])).toBe(true);
  h.place(...sorted);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('one:-1-answer');
  h.place(11, 12, 13, 14);
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['one:-1-answer', false, false], ['one:-1-answer~simpler', true, true], ['one:-1-answer', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['three_cards'], assisted: true });
});
