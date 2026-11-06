// @vitest-environment jsdom
/**
 * The real WaveTank on the shared teaching workspace, its only teaching path, with the real TeachingSession,
 * LiveLessonRuntime, transport and rendering shell. The 3D tank (WebGL) is replaced by a stub that records what it is
 * told to draw; the Live context, evaluation writes and sound are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown,
  scene: { size: 0, speed: 0, fell: null as boolean | null, crestMarks: false as boolean | undefined, startRings: false as boolean | undefined } }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'wave',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('./WaveScene', () => ({
  default: function Stub(p: { size: number; speed: number; run: { fell: boolean } | null; crestMarks?: boolean; startRings?: boolean }) {
    seam.scene = { size: p.size, speed: p.speed, fell: p.run?.fell ?? null, crestMarks: p.crestMarks, startRings: p.startRings };
    return <div data-wave-scene="stub" />;
  },
}));
import WaveTank, { type WaveTankData } from './WaveTank';
import { makeKnock, type WaveChallenge } from './waveModel';

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); seam.evaluationContext = null; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

// First wave size 2, speed 2; the tower needs size × speed ≥ 8 (medium: one step is not enough).
const ITEM = makeKnock('wave-1', { size: 2, speed: 2 }, 8, 5, 'medium');

function mount(challenges: WaveChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  const data: WaveTankData = { instanceId: 'wave', title: 'Waves That Knock Things Down', description: 'Change one thing.',
    challengeType: 'knock_it_down', gradeBand: '3-5', supportTier: 'medium', challenges };
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <WaveTank data={data} runtimePlanItemId="plan-wave" runtimeEvalMode="knock_it_down" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const dispatch = (name: string, input?: Record<string, unknown>) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'wave', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } as NonNullable<typeof a>['action'] }); });
  };
  const click = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const settle = () => act(() => { vi.advanceTimersByTime(30000); });
  const send = (size: number, speed: number) => {
    click(`Size ${size}`); click(`Speed ${speed}`);
    click('Send a wave');
    settle();
  };
  const demand = () => JSON.stringify(state().task!.demand);
  return { state, dispatch, click, send, settle, demand };
}

it('binds as a gesture with no key; the first wave plays; waves fill the notebook; a small change is too_small; Try again keeps the waves; one big change passes', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount([ITEM]);
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  expect(h.demand()).toContain('size 2, speed 2');
  expect(h.demand()).not.toContain('"need"');
  expect(seam.scene).toMatchObject({ size: 2, speed: 2, fell: false });
  h.settle();
  h.send(3, 2);
  expect(seam.scene).toMatchObject({ size: 3, speed: 2, fell: false });
  expect(h.demand()).toContain('wave 2: size 3, speed 2');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/stayed up. Change that same thing even more/)).toBeTruthy();
  h.dispatch('retry');
  expect(h.demand()).toContain('wave 2: size 3, speed 2');
  h.send(2, 4);
  expect(seam.scene.fell).toBe(true);
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('both settings changed is not a fair test; no change is no_change', () => {
  const h = mount([ITEM]);
  h.settle();
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/same as the first wave/)).toBeTruthy();
  h.dispatch('retry');
  h.send(5, 5);
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/changed both/)).toBeTruthy();
});

it('hard: the push size above the stop is locked', () => {
  mount([makeKnock('wave-1', { size: 2, speed: 1 }, 8, 2, 'hard')]).settle();
  expect(screen.getByRole('button', { name: 'Size 3' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Speed 5' }).hasAttribute('disabled')).toBe(false);
});

it('levers: crest marks, rings on the first wave, the energy bar after a wave; the easier tower is ungraded practice', () => {
  const h = mount([ITEM]);
  h.settle();
  const ids = () => (h.state().task!.workspace!.levers ?? []).map(l => l.id);
  expect(ids()).toEqual(['crest_marks', 'changes_marked', 'one_step_less']);
  h.dispatch('pull_lever', { lever: 'crest_marks' });
  expect(seam.scene.crestMarks).toBe(true);
  h.dispatch('pull_lever', { lever: 'changes_marked' });
  expect(seam.scene.startRings).toBe(true);
  h.send(3, 2);
  expect(screen.getByText('Changed')).toBeTruthy();
  expect(ids()).toEqual(['crest_marks', 'xray', 'changes_marked', 'one_step_less']);
  h.dispatch('pull_lever', { lever: 'xray' });
  expect(document.querySelector('[data-wave-energy]')).toBeTruthy();
  h.dispatch('pull_lever', { lever: 'one_step_less' });
  expect(h.state().task!.itemId).toBe('wave-1~easier');
  expect(screen.getByText('Practice')).toBeTruthy();
  expect(seam.scene.crestMarks).toBe(false);
  expect(document.querySelector('[data-wave-energy]')).toBeNull();
});

it('easy starts with the first wave ringed, and it is not a pull', () => {
  const h = mount([{ ...makeKnock('wave-1', { size: 2, speed: 2 }, 6, 5, 'easy'), startLevers: ['changes_marked'] }]);
  expect(seam.scene.startRings).toBe(true);
  expect(h.state().task!.workspace!.levers!.find(l => l.id === 'changes_marked')!.pulled).toBe(true);
});
