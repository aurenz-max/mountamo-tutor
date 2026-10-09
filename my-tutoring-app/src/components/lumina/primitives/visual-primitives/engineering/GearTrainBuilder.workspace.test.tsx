// @vitest-environment jsdom
/**
 * gear-train-builder on the shared teaching workspace (W1) and its three open builds: the real GearTrainBuilder,
 * TeachingSession and LiveLessonRuntime. Every item is a checked gesture with a named miss and no published key; the
 * build starts on an empty track, commits at "I'm done!", keeps the train through Try again, and its levers come on a miss.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';
import { validateGearTrainBuilderData } from '../../../components/live-activity/adapters/gearTrainBuilderLive';
import { getComponentById } from '../../../service/manifest/catalog';
import { gearTrainBuilderOracle } from '../../../service/qa/oracles/gear-train-builder';
import {
  GEAR_MODES, MIXED_MODES, gearAsk, gearChallenges, gearMiss, referenceTrain, type GearChallenge,
} from './gearWorkspace';
import { gearLevers, simplerTrain } from './gearLevers';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), watch: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'gears',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, submitResult: seam.submit, resetAttempt: vi.fn(), elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
vi.mock('../../build-layer/buildLayer', () => ({ useBuildWatcher: (o: unknown) => { seam.watch(o); return ''; } }));
import GearTrainBuilder, { type GearTrainBuilderData } from './GearTrainBuilder';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); seam.evaluationContext = null; });

const make = (t: Omit<GearChallenge, 'id' | 'instruction'>, id: string): GearChallenge => ({ ...t, id, instruction: gearAsk(t) });
const SAME3 = make({ type: 'build_direction', way: 'same', minGears: 3 }, 'd1');
const OPP4 = make({ type: 'build_direction', way: 'opposite', minGears: 4 }, 'd2');
const FASTER = make({ type: 'build_speed', speed: 'faster', minGears: 2 }, 's1');
const TIMES3 = make({ type: 'build_ratio', ratio: 3, minGears: 2 }, 'r1');
const TWICE_SAME = make({ type: 'build_ratio', ratio: 2, way: 'same', minGears: 3 }, 'r2');

function controls(container: HTMLElement) {
  const press = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const touch = (target: string) => act(() => { fireEvent.click(container.querySelector(`[data-pip-object="${target}"]`)!); });
  const add = (...teeth: number[]) => teeth.forEach(t => touch(`tray-${t}`));
  const gears = () => container.querySelectorAll('[data-placed]').length;
  return { press, touch, add, gears };
}

function mount(challenges: GearChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const data: GearTrainBuilderData = { title: 'Gears', challengeType: challenges[0].type, challenges, instanceId: 'gears' };
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <GearTrainBuilder data={data} runtimePlanItemId="plan-gears" runtimeEvalMode={challenges[0].type} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = s.affordances.find(x => x.action.type === name
      || x.action.type === 'workspace' && (x.action as { operation: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    let receipt: ReturnType<typeof runtime.dispatch> | undefined;
    act(() => { receipt = runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'gears',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
    return receipt!;
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const ws = () => state().task!.workspace!;
  const demand = () => state().task!.demand as Record<string, unknown>;
  return { state, dispatch, confirmVisible, view, ws, demand, ...controls(view.container) };
}

it.each([SAME3, FASTER, TIMES3])('$type mounts under tutor ownership as a gesture item with no published key', c => {
  const h = mount([c]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(c.instruction);
  expect(h.ws().expectedAnswer).toBeUndefined();
  expect(JSON.stringify(h.demand())).not.toMatch(/"way"|"ratio"|"speed"|clockwise|faster|opposite/i);
  expect(screen.queryByRole('button', { name: /next/i })).toBeNull();
});

it('opens on an empty track with no arrows or counts; levers start bare; the watcher may not say how a gear turns', () => {
  const h = mount([TWICE_SAME]);
  expect(h.gears()).toBe(0);
  expect(screen.getByRole('button', { name: "I'm done!" })).toHaveProperty('disabled', true);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(screen.queryByRole('button', { name: /turn the crank/i })).toBeNull();
  expect(h.demand()).toMatchObject({ kind: 'build_ratio', gearsPlaced: 0, learnerWork: 'No gears yet' });
  expect(h.ws().levers!.map(l => [l.id, l.kind, l.pulled])).toEqual([
    ['direction_arrows', 'help', false], ['try_spin', 'help', false], ['simpler_train', 'simplify', false]]);
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false,
    request: expect.objectContaining({ numbers: 'never', neverSay: expect.arrayContaining(['faster', 'same', 'turns', 'clockwise']) }) }));
});

it('build_direction: one gear too many turns the last gear the wrong way; Try again keeps the train; taking one out passes', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const h = mount([SAME3, OPP4]);
  vi.setSystemTime(Date.now() + 2000);
  h.add(16, 16);
  h.press("I'm done!");
  expect(h.ws().attempts.at(-1)).toMatchObject({ correct: false, miss: 'too_few_gears' });
  h.dispatch('retry');
  vi.setSystemTime(Date.now() + 2000);
  h.add(12, 24);
  h.press("I'm done!");
  expect(h.ws().attempts.at(-1)).toMatchObject({ correct: false, miss: 'wrong_direction' });
  expect(screen.getByText(/^Not yet\./).textContent).not.toMatch(/same|opposite|add|take|remove|\d/i);
  h.dispatch('retry');
  expect(h.gears()).toBe(4);
  vi.setSystemTime(Date.now() + 2000);
  h.touch('gear-g3');
  expect(h.demand()).toMatchObject({ gearsPlaced: 3, firstGearTeeth: 16, lastGearTeeth: 24,
    workHistory: expect.stringContaining('gearsPlaced 0 → 4 → 3') });
  h.press("I'm done!");
  expect(h.ws().attempts.at(-1)).toMatchObject({ itemId: 'd1', correct: true, response: '3 gears, first to last: 16 teeth, 16 teeth, 24 teeth' });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('d2');
  expect(h.gears()).toBe(0);
});

it('build_speed: a bigger last gear is not faster; the arrows and the trial crank show and count, out of the picture', () => {
  const h = mount([FASTER]);
  h.add(12, 24);
  h.press("I'm done!");
  expect(h.ws().attempts.at(-1)).toMatchObject({ correct: false, miss: 'not_faster' });
  expect(h.dispatch('pull_lever', { lever: 'direction_arrows' }).status).toBe('committed');
  expect(Array.from(h.view.container.querySelectorAll('[data-lever="direction-arrow"]')).map(a => a.getAttribute('data-way'))).toEqual(['1', '-1']);
  expect(h.dispatch('pull_lever', { lever: 'try_spin' }).status).toBe('committed');
  expect(String(h.demand().onScreen)).toMatch(/Turn the crank/);
  h.dispatch('retry');
  h.press('Clear');
  h.add(24, 12);
  // Without animation frames the trial spin lands at once, so the counts are final when read.
  const raf = globalThis.requestAnimationFrame;
  (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = undefined;
  h.press(/turn the crank/i);
  globalThis.requestAnimationFrame = raf;
  expect(h.view.container.querySelector('[data-lever="turn-counts"]')!.textContent).toBe('First gear: 6 turnsLast gear: 12 turns');
  expect(h.ws().attempts).toHaveLength(1);
  const picture = h.view.container.querySelector('svg[data-build-scene="gears"]')!.cloneNode(true) as SVGSVGElement;
  picture.querySelectorAll('[data-aid]').forEach(n => n.remove());
  expect(picture.querySelectorAll('[data-placed]')).toHaveLength(2);
  expect(picture.textContent).toBe('');
  h.press("I'm done!");
  expect(h.ws().attempts.at(-1)).toMatchObject({ correct: true, levers: ['direction_arrows', 'try_spin'] });
});

it('build_ratio: the gears swapped turn too slowly; the right pair passes, with idlers anywhere', () => {
  const h = mount([TIMES3]);
  h.add(8, 24);
  h.press("I'm done!");
  expect(h.ws().attempts.at(-1)).toMatchObject({ correct: false, miss: 'too_slow' });
  h.dispatch('retry');
  h.press('Clear');
  h.add(24, 32, 12, 8);
  h.press("I'm done!");
  expect(h.ws().attempts.at(-1)).toMatchObject({ correct: true });
});

it('the simplify lever opens an ungraded train without the way, then the full item comes back empty', () => {
  const h = mount([TWICE_SAME]);
  h.add(16, 8);
  h.press("I'm done!");
  expect(h.ws().attempts.at(-1)).toMatchObject({ miss: 'too_few_gears' });
  const receipt = h.dispatch('pull_lever', { lever: 'simpler_train' });
  expect(receipt.state.task!.itemId).toBe('r2~simpler');
  expect(receipt.state.task!.task).toBe('Build a gear train where the last gear turns 2 times for every 1 turn of the first gear.');
  expect(h.gears()).toBe(0);
  h.add(16, 8);
  h.press("I'm done!");
  expect(h.ws().lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('r2');
  expect(h.gears()).toBe(0);
});

it('scripted path (the tester, no tutor): a miss keeps the train, Next train opens an empty track, the session submits once', () => {
  const data: GearTrainBuilderData = { title: 'Gears', challengeType: 'build_direction', challenges: [SAME3, OPP4], instanceId: 'gears' };
  const view = render(<GearTrainBuilder data={data} />);
  const c = controls(view.container);
  c.add(16, 16);
  c.press("I'm done!");
  expect(screen.getByText(/^Not yet\./)).toBeTruthy();
  c.add(16);
  c.press("I'm done!");
  c.press(/next train/i);
  expect(c.gears()).toBe(0);
  c.add(8, 12, 16, 24);
  c.press("I'm done!");
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'gear-train-builder', trainsBuilt: 2, firstTryCount: 1 });
  expect(seam.send).not.toHaveBeenCalled();
});

it('the check, targets, levers, oracle and catalog wiring', () => {
  const train = (...teeth: number[]) => teeth.map((t, i) => ({ id: `x${i}`, teeth: t }));
  expect(gearMiss(SAME3, train(32, 8, 12))).toBeUndefined();
  expect(gearMiss(SAME3, train(32, 8))).toBe('too_few_gears');
  expect(gearMiss(OPP4, train(8, 8, 8, 8, 8))).toBe('wrong_direction');
  expect(gearMiss(FASTER, train(16, 16))).toBe('not_faster');
  expect(gearMiss(make({ type: 'build_speed', speed: 'slower', minGears: 2 }, 'x'), train(16, 8))).toBe('not_slower');
  expect(gearMiss(TIMES3, train(32, 8))).toBe('too_fast');
  expect(gearMiss(TWICE_SAME, train(16, 8, 8))).toBeUndefined();
  expect(gearMiss(TWICE_SAME, train(16, 24, 32, 8))).toBe('wrong_direction');
  // Every session of every band and mode: 3 distinct trains, buildable, many trains pass each.
  for (const band of ['K-1', '2-3', '4-5'] as const) {
    for (const modes of [...GEAR_MODES.map(m => [m]), MIXED_MODES[band]]) {
      const challenges = gearChallenges(modes, band);
      expect(challenges).toHaveLength(3);
      const data = { title: 'Gears', challenges };
      expect(gearTrainBuilderOracle.verify(data as never, { componentId: 'gear-train-builder' } as never).violations).toEqual([]);
      expect(() => validateGearTrainBuilderData(data)).not.toThrow();
      for (const c of challenges) {
        expect(gearMiss(c, referenceTrain(c).map((teeth, i) => ({ id: `r${i}`, teeth })))).toBeUndefined();
        const easier = simplerTrain(c);
        if (easier) expect(gearMiss(easier, referenceTrain(easier).map((teeth, i) => ({ id: `e${i}`, teeth })))).toBeUndefined();
      }
    }
  }
  expect(simplerTrain(SAME3)).toBeNull();
  expect(simplerTrain(OPP4)).toMatchObject({ minGears: 2, way: 'opposite' });
  expect(gearLevers(SAME3, []).map(l => l.id)).toEqual(['direction_arrows', 'try_spin']);
  const entry = getComponentById('gear-train-builder')!;
  expect(entry.evalModes!.map(m => [m.evalMode, m.beta])).toEqual([['build_direction', 2.0], ['build_speed', 2.8], ['build_ratio', 3.6]]);
  expect(entry.teachingWorkspace!.misses).toMatchObject({ build_ratio: ['too_few_gears', 'too_fast', 'too_slow', 'wrong_direction'] });
});
