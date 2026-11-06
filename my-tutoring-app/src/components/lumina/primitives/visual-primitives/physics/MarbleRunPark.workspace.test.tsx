// @vitest-environment jsdom
/**
 * The real MarbleRunPark on the shared teaching workspace, its only teaching path, with the real TeachingSession,
 * LiveLessonRuntime, transport and rendering shell. The 3D park (WebGL) is replaced by a stub that records what it is
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
  scene: { peg: null as number | null, outcome: null as string | null, topLine: false as boolean | undefined, pegMarks: null as unknown } }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'marble',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('./MarbleScene', () => ({
  default: function Stub(p: { peg: number | null; run: { outcome: string } | null; topLine?: boolean; pegMarks?: unknown }) {
    seam.scene = { peg: p.peg, outcome: p.run?.outcome ?? null, topLine: p.topLine, pegMarks: p.pegMarks ?? null };
    return <div data-marble-scene="stub" />;
  },
}));
import MarbleRunPark, { type MarbleRunParkData } from './MarbleRunPark';
import { lowestWorking, makeLoop, pegOutcomes, type MarbleChallenge } from './marbleModel';

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); seam.evaluationContext = null; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const ITEM = makeLoop('loop-1', 1, [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4], false, 'lowest');

function mount(challenges: MarbleChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  const data: MarbleRunParkData = { instanceId: 'marble', title: 'Just High Enough', description: 'Find it.',
    challengeType: 'make_the_loop', gradeBand: '3-5', challenges };
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <MarbleRunPark data={data} runtimePlanItemId="plan-marble" runtimeEvalMode="make_the_loop" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const dispatch = (name: string, input?: Record<string, unknown>) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'marble', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } as NonNullable<typeof a>['action'] }); });
  };
  const click = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const runFrom = (peg: number) => {
    click(`Peg ${peg + 1}`);
    click('Let it go');
    act(() => { vi.advanceTimersByTime(30000); });
  };
  const demand = () => JSON.stringify(state().task!.demand);
  return { state, dispatch, click, runFrom, demand };
}

it('binds as a gesture with no key; runs fill the notebook; a peg below the loop top is too_low; Try again keeps the runs; the lowest working peg passes', () => {
  seam.evaluationContext = { lesson: 'test' };
  const low = lowestWorking(ITEM);
  const h = mount([ITEM]);
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  expect(h.demand()).toContain('the top of the loop is level with peg 4');
  // Nothing to commit before the marble is on a peg.
  expect(screen.getByRole('button', { name: "I'm done!" }).hasAttribute('disabled')).toBe(true);
  h.runFrom(1);
  expect(seam.scene).toMatchObject({ peg: 1, outcome: pegOutcomes(ITEM)[1] });
  expect(screen.getByText('Lab notebook')).toBeTruthy();
  expect(h.demand()).toContain('run 1: from peg 2');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/cannot even get as high as the top of the loop/)).toBeTruthy();
  h.dispatch('retry');
  expect(h.demand()).toContain('run 1: from peg 2');
  h.runFrom(low);
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('level with the top still fails (top_height_only); a higher working peg is not the lowest', () => {
  const low = lowestWorking(ITEM);
  const h = mount([ITEM]);
  h.click('Peg 4');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/as high as the top of the loop, but the marble still fell/)).toBeTruthy();
  h.dispatch('retry');
  h.click(`Peg ${low + 2}`);
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/a lower peg works too/)).toBeTruthy();
});

it('easy: any working peg passes', () => {
  const h = mount([makeLoop('loop-1', 1, [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4], false, 'any')]);
  h.click('Peg 8');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('levers: the loop-top line, the energy bar on a peg, rings on run pegs; the easier loop is ungraded practice', () => {
  const h = mount([ITEM]);
  const ids = () => (h.state().task!.workspace!.levers ?? []).map(l => l.id);
  expect(ids()).toEqual(['loop_top_line', 'one_step_less']);
  h.dispatch('pull_lever', { lever: 'loop_top_line' });
  expect(seam.scene.topLine).toBe(true);
  expect(h.demand()).toContain('dashed line');
  h.runFrom(1);
  h.runFrom(lowestWorking(ITEM) + 1);
  expect(ids()).toEqual(['loop_top_line', 'xray', 'peg_results', 'one_step_less']);
  h.dispatch('pull_lever', { lever: 'xray' });
  expect(document.querySelector('[data-marble-energy]')).toBeTruthy();
  h.dispatch('pull_lever', { lever: 'peg_results' });
  const marks = seam.scene.pegMarks as (boolean | null)[];
  expect(marks[1]).toBe(false);
  expect(marks[lowestWorking(ITEM) + 1]).toBe(true);
  expect(marks.filter(m => m != null)).toHaveLength(2);
  h.dispatch('pull_lever', { lever: 'one_step_less' });
  expect(h.state().task!.itemId).toBe('loop-1~easier');
  expect(screen.getByText('Practice')).toBeTruthy();
  expect(seam.scene.topLine).toBe(false);
  expect(seam.scene.pegMarks).toBeNull();
  expect(screen.queryByText('Lab notebook')).toBeNull();
});

it('easy starts with the loop-top line drawn, and it is not a pull', () => {
  const h = mount([{ ...makeLoop('loop-1', 1, [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4], false, 'any'), startLevers: ['loop_top_line'] }]);
  expect(seam.scene.topLine).toBe(true);
  expect(h.state().task!.workspace!.levers!.find(l => l.id === 'loop_top_line')!.pulled).toBe(true);
});
