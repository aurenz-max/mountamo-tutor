// @vitest-environment jsdom
/**
 * The real TrainYard on the shared teaching workspace, its only teaching path, with the real
 * TeachingSession, LiveLessonRuntime, transport and rendering shell. Only the Live context,
 * evaluation writes, sound and animation frames are substituted (a headless run checks at once).
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'yard',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import TrainYard, { type TrainYardData } from './TrainYard';
import { buildTrainYardChallenge, fewestCars, fewestEngines, type TrainYardChallenge } from './trainYardModel';

// Fake frames and clock, so a Highball press runs the real animation to its end in one advance.
beforeEach(() => {
  vi.clearAllMocks(); seam.evaluationContext = null;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance',
    'requestAnimationFrame', 'cancelAnimationFrame'] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const seq = (values: number[]) => { let i = 0; return () => values[i++ % values.length]; };
const grainJob = (id: string): TrainYardChallenge => buildTrainYardChallenge(
  { title: 'Harvest Rush', cargo: 'grain', cargoForm: 'loose_bulk', from: 'Prairie Elevator', to: 'Port Lakeview', hillName: 'Cedar Hill' },
  { id, band: '3-5', rng: seq([.5, .3, .6, .4]), targetEngines: 2 });
const oilJob = (id: string): TrainYardChallenge => buildTrainYardChallenge(
  { title: 'Over the Mountain', cargo: 'heating oil', cargoForm: 'liquid', from: 'Bayside Refinery', to: 'Northfield', hillName: 'Raven Pass' },
  { id, band: 'K-2', rng: seq([.2, .7, .1]), targetEngines: 1 });

function mount(challenges: TrainYardChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  new RuntimeTransport(runtime, m => sent.push(m));
  const data: TrainYardData = { instanceId: 'yard', title: 'Train Yard', description: 'Build trains.', challengeType: 'build_train',
    gradeBand: '3-5', challenges };
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <TrainYard data={data} runtimePlanItemId="plan-yard" runtimeEvalMode="build_train" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'yard', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a!.action }); });
  };
  const press = (name: string | RegExp, times = 1) => {
    for (let i = 0; i < times; i++) act(() => { fireEvent.click(screen.getByRole('button', { name })); });
    // Highball runs the train; let it load, climb and arrive or stall.
    if (String(name).includes('Highball')) act(() => { vi.advanceTimersByTime(180_000); });
  };
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  return { runtime, state, dispatch, press, next };
}

/** Build the keyed train for a job through the real yard buttons. */
function buildKeyed(h: ReturnType<typeof mount>, c: TrainYardChallenge, carLabel: string) {
  h.press('Add an engine', fewestEngines(c));
  h.press(`Add a ${carLabel}`, fewestCars(c));
}

it('binds under tutor ownership; the key (car kind and counts) never reaches the tutor', () => {
  const c = grainJob('ty-1');
  const h = mount([c]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(c.instruction);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  const facts = JSON.stringify(h.state().task!.demand);
  expect(facts).not.toMatch(/hopper/i);
  expect(facts).not.toContain(`${fewestCars(c)} cars`);
  expect(seam.send.mock.calls.flat().join(' ')).not.toMatch(/hopper/i);
  // Nothing to send until the yard has an engine and a car.
  expect((screen.getByRole('button', { name: /Highball/ }) as HTMLButtonElement).disabled).toBe(true);
});

it('a wrong build is a checked miss with its evidence; Try again empties the yard but keeps the evidence; the keyed train completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const grain = grainJob('ty-1'), oil = oilJob('ty-2');
  const h = mount([grain, oil]);
  // Tank cars cannot carry grain.
  h.press('Add an engine', fewestEngines(grain));
  h.press('Add a tank car', fewestCars(grain));
  h.press(/Highball/);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/None of these cars can carry grain/)).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Add a hopper car' }) as HTMLButtonElement).disabled).toBe(true);
  // The run's evidence is now on screen, so it is in the scene.
  expect(JSON.stringify(h.state().task!.demand)).toMatch(/lastRunShowed/);
  h.dispatch('retry');
  // Try again empties the yard; the run's evidence stays on screen to rebuild from.
  expect(screen.getByText(/0 engines \+ 0 cars/)).toBeTruthy();
  expect(screen.getByText(/None of these cars can carry grain/)).toBeTruthy();
  buildKeyed(h, grain, 'hopper car');
  h.press(/Highball/);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(screen.getByText(/1 train =/)).toBeTruthy();
  h.next();
  expect(h.state().task!.itemId).toBe('ty-2');
  // A fresh job empties the yard.
  expect(screen.getByText(/0 engines \+ 0 cars/)).toBeTruthy();
  buildKeyed(h, oil, 'tank car');
  h.press(/Highball/);
  expect(h.state().task!.evidence.correctness).toBe('correct');
}, 20_000); // two jobs built through the real buttons, one press at a time

it.each([
  ['one engine short stalls on the hill', (c: TrainYardChallenge) => ({ engines: fewestEngines(c) - 1, cars: fewestCars(c) }), /Stalled on Cedar Hill/],
  ['a spare engine still climbs, but is not the fewest', (c: TrainYardChallenge) => ({ engines: fewestEngines(c) + 1, cars: fewestCars(c) }), /Could fewer engines/],
  ['one car short leaves cargo behind', (c: TrainYardChallenge) => ({ engines: fewestEngines(c), cars: fewestCars(c) - 1 }), /was left at Prairie Elevator/],
])('%s', (_name, build, message) => {
  const c = grainJob('ty-1');
  const want = build(c);
  const h = mount([c]);
  if (want.engines > 0) h.press('Add an engine', want.engines);
  else h.press('Add an engine');
  h.press('Add a hopper car', want.cars);
  if (want.engines === 0) h.press('Remove an engine');
  if (want.engines === 0) return; // no engine: nothing to send
  h.press(/Highball/);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(message)).toBeTruthy();
});

it('unbound (no runtime) renders the needs-the-tutor card, never the yard', () => {
  const data: TrainYardData = { instanceId: 'yard', title: 'Our yard', description: '', challengeType: 'build_train', gradeBand: 'K-2',
    challenges: [grainJob('ty-1')] };
  const { container } = render(<TrainYard data={data} runtimeEvalMode="build_train" />);
  expect(container.querySelector('[data-workspace-unbound="train-yard"]')).not.toBeNull();
  expect(screen.queryByRole('button', { name: /Highball|Add an engine/ })).toBeNull();
});
