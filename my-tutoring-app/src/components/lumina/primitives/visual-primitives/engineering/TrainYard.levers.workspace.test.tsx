// @vitest-environment jsdom
/**
 * The train-yard levers on the shared teaching workspace: the real TrainYard, TeachingSession and
 * LiveLessonRuntime. `pull_lever` changes the screen and the scene in the same commit, names no car or count,
 * records the lever on the next attempt, and a simplify pull opens an ungraded easier job that returns to the
 * full job, which alone is credited.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn() }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'yard',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import TrainYard, { type TrainYardData } from './TrainYard';
import {
  buildTrainYardChallenge, carButtonName, carFor, fewestCars, fewestEngines, type TrainYardChallenge, type TrainYardTask,
} from './trainYardModel';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance',
    'requestAnimationFrame', 'cancelAnimationFrame'] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const seq = (values: number[]) => { let i = 0; return () => values[i++ % values.length]; };
const grain = (id: string, type: TrainYardTask, targetEngines = 2) => buildTrainYardChallenge(
  { title: 'Harvest Rush', cargo: 'grain', cargoForm: 'loose_bulk', from: 'Prairie Elevator', to: 'Port Lakeview', hillName: 'Cedar Hill' },
  { id, band: '3-5', type, rng: seq([.5, .3, .6, .4]), targetEngines });

function mount(evalMode: TrainYardTask, challenges: TrainYardChallenge[], supportTier?: 'easy') {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const data: TrainYardData = { instanceId: 'yard', title: 'Train Yard', description: 'Build trains.', challengeType: evalMode,
    gradeBand: '3-5', supportTier, challenges };
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <TrainYard data={data} runtimePlanItemId="plan-yard" runtimeEvalMode={evalMode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const offered = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && (a.action as { operation: string }).operation === name);
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offered(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    let receipt: ReturnType<typeof runtime.dispatch> | undefined;
    act(() => { receipt = runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'yard',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
    return receipt!;
  };
  const press = (name: string | RegExp, times = 1) => {
    for (let i = 0; i < times; i++) act(() => { fireEvent.click(screen.getByRole('button', { name })); });
    if (String(name).includes('Highball')) act(() => { vi.advanceTimersByTime(180_000); });
  };
  const lever = (kind: string) => view.container.querySelectorAll(`[data-lever="${kind}"]`);
  const levers = () => state().task!.workspace!.levers ?? [];
  return { state, offered, dispatch, press, lever, levers, view };
}

const SEND = /Highball/;

it('build_train: every help lever draws on screen, names no car or count, and the next attempt carries it', () => {
  const c = grain('ty-1', 'build_train');
  const h = mount('build_train', [c]);
  expect(h.levers().map(l => [l.id, l.kind])).toEqual([['cargo_picture', 'help'], ['model_match', 'help'], ['car_tally', 'help'],
    ['train_weight', 'help'], ['worked_hill', 'help'], ['smaller_job', 'simplify']]);
  // A wrong build: tank cars for grain.
  h.press('Add an engine', 2); h.press('Add a tank car', 3); h.press(SEND);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'wrong_car' });

  for (const [id, mark] of [['cargo_picture', 'cargo-picture'], ['model_match', 'model-match'], ['car_tally', 'car-tally'],
    ['train_weight', 'train-weight'], ['worked_hill', 'worked-hill']] as const) {
    const receipt = h.dispatch('pull_lever', { lever: id });
    expect(receipt.status, id).toBe('committed');
    expect(h.lever(mark), id).toHaveLength(1);
    expect(String(receipt.state.task!.demand.onScreen), id).not.toMatch(/hopper/i);
  }
  const demand = String(h.state().task!.demand.onScreen);
  expect(demand).not.toMatch(new RegExp(`\\b${fewestCars(c)} hopper|${fewestEngines(c)} engines\\b`, 'i'));
  // The tally labels only the learner's own (tank) cars.
  expect(Array.from(h.lever('tally')).map(t => t.textContent)).toEqual(['90', '180', '270']);
  expect(h.dispatch('pull_lever', { lever: 'car_tally' }).status).toBe('blocked');

  h.dispatch('retry');
  h.press('Add an engine', fewestEngines(c)); h.press('Add a hopper car', fewestCars(c)); h.press(SEND);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'ty-1', correct: true, assisted: true });
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers).toEqual(
    ['cargo_picture', 'model_match', 'car_tally', 'train_weight', 'worked_hill']);
});

it('match_car: a simplify pull opens a two-car practice job, ungraded, then the full job comes back and alone is credited', () => {
  const c = grain('ty-1', 'match_car');
  const h = mount('match_car', [c, grain('ty-2', 'match_car')]);
  h.press('Choose a tank car'); h.press(SEND);
  const receipt = h.dispatch('pull_lever', { lever: 'two_cars' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('ty-1~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'ty-1' });
  expect(h.view.container.querySelector('[data-practice-job]')).not.toBeNull();
  const choices = screen.getAllByRole('button', { name: /^Choose / }).map(b => b.getAttribute('aria-label'));
  expect(choices).toHaveLength(2);
  expect(h.offered('pull_lever')).toBeUndefined();

  // The practice job is not grain: its own car is one of the two.
  const practiceCar = receipt.state.task!.task.match(/boxes of toys/) ? 'boxcar' : undefined;
  expect(practiceCar).toBe('boxcar');
  h.press(`Choose ${carButtonName('boxcar')}`); h.press(SEND);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('ty-1');
  expect(h.view.container.querySelector('[data-practice-job]')).toBeNull();
  expect(screen.getAllByRole('button', { name: /^Choose / })).toHaveLength(6);

  h.press(`Choose ${carButtonName(carFor(c))}`); h.press(SEND);
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['ty-1', false, false], ['ty-1~simpler', true, true], ['ty-1', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['two_cars'], assisted: true });
});

it('enough_cars: Try again on the practice job keeps it; the tally follows the learner\'s own cars', () => {
  const c = grain('ty-1', 'enough_cars');
  const h = mount('enough_cars', [c]);
  expect(h.dispatch('pull_lever', { lever: 'car_tally' }).status).toBe('committed');
  expect(h.lever('car-tally')[0].textContent).toMatch(/Couple a car/);
  h.press('Add a hopper car', 2);
  expect(Array.from(h.lever('tally')).map(t => t.textContent)).toEqual(['100', '200']);
  expect(h.state().task!.demand.onScreen).toMatch(/2 hopper cars hold 200 tons/);
  h.press(SEND);
  expect(h.dispatch('pull_lever', { lever: 'whole_loads' }).status).toBe('committed');
  const practice = h.state().task!.itemId;
  expect(practice).toBe('ty-1~simpler');
  // A wrong practice build, Try again: still the practice job.
  h.press(`Add ${carButtonName('boxcar')}`, 1); h.press(SEND);
  h.dispatch('retry');
  expect(h.state().task!.itemId).toBe(practice);
});

it('enough_pull: the yard scale shows the train weight before a run and never the pull the hill needs', () => {
  const c = grain('ty-1', 'enough_pull');
  const h = mount('enough_pull', [c]);
  expect(h.dispatch('pull_lever', { lever: 'train_weight' }).status).toBe('committed');
  const scale = h.lever('train-weight')[0].textContent!;
  expect(scale).toMatch(/Yard scale/);
  h.press('Add an engine');
  expect(h.lever('train-weight')[0].textContent).not.toBe(scale);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/pull/);
});

it('easy starts with its help on screen: a starting position, not a recorded pull', () => {
  const c = grain('ty-1', 'enough_pull');
  const h = mount('enough_pull', [c], 'easy');
  expect(h.levers().find(l => l.id === 'train_weight')!.pulled).toBe(true);
  expect(h.lever('train-weight')).toHaveLength(1);
  h.press('Add an engine', fewestEngines(c)); h.press(SEND);
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers).toBeUndefined();
});
