// @vitest-environment jsdom
/**
 * The real CircuitWorkbench on the shared teaching workspace, its only teaching path, with the real TeachingSession,
 * LiveLessonRuntime, transport and rendering shell. The 3D workbench (WebGL) is replaced by a stub that records what it
 * is told to draw; the Live context, evaluation writes and sound are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown,
  scene: { lit: [] as string[], short: false, powered: false, wires: [] as unknown[], xray: null as unknown } }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'workbench',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('./CircuitScene', () => ({
  default: function Stub(p: { lit: string[]; short: boolean; powered: boolean; wires: unknown[]; xray?: unknown }) {
    seam.scene = { lit: p.lit, short: p.short, powered: p.powered, wires: p.wires, xray: p.xray ?? null };
    return <div data-circuit-scene="stub" />;
  },
}));
import CircuitWorkbench, { type CircuitWorkbenchData } from './CircuitWorkbench';
import { makeLightIt, wire, type CircuitChallenge } from './circuitModel';
import { makeBreak } from './breakModel';
import { condByKey, makeConductor } from './conductorModel';
import { makeSwitch } from './switchModel';
import { makeTwoBulb } from './twoBulbModel';
import { makeDevice } from './deviceModel';
import { magnetByKey, makeMagnet } from './magnetModel';

beforeEach(() => { vi.clearAllMocks(); seam.evaluationContext = null; });
afterEach(() => { cleanup(); });

// One wire from + to the bulb's left clip; then two bulbs, light the red one only.
const items = (): CircuitChallenge[] => [
  makeLightIt('light-1', ['red'], 'red', [wire('bat+', 'red.left')]),
  makeLightIt('light-2', ['red', 'blue'], 'red', []),
];

function mount(challenges: CircuitChallenge[] = items()) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  const data: CircuitWorkbenchData = { instanceId: 'workbench', title: 'Light the Bulb', description: 'Wire it.',
    challengeType: 'light_it', gradeBand: 'K-2', challenges };
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <CircuitWorkbench data={data} runtimePlanItemId="plan-workbench" runtimeEvalMode="light_it" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: Record<string, unknown>) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'workbench', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } as NonNullable<typeof a>['action'] }); });
    return state();
  };
  const click = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  const demand = () => JSON.stringify(state().task!.demand);
  const connect = (a: string, b: string) => { click(`Clip: ${a}`); click(`Clip: ${b}`); };
  return { state, dispatch, click, next, demand, connect };
}

it('binds as a gesture build; the guess puts the battery in; a short is a named miss; Try again keeps the wires; the loop passes', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount();
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  expect(h.demand()).toContain('the battery is not in yet');
  // No wiring before the guess.
  expect(screen.queryByRole('button', { name: "Clip: the battery's + end" })).toBeNull();
  h.click('Guess it will light');
  expect(seam.scene.powered).toBe(true);
  expect(h.demand()).toContain('nothing is lit');
  expect(h.demand()).toContain('guessed it would light');
  // A short beside the bulb: nothing lights, the battery warms.
  h.connect("the battery's + end", "the battery's − end");
  expect(seam.scene.short).toBe(true);
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/battery gets warm/)).toBeTruthy();
  h.dispatch('retry');
  expect(seam.scene.wires).toHaveLength(2);
  h.click("Remove the wire from the battery's + end to the battery's − end");
  h.connect("the bulb's right clip", "the battery's − end");
  expect(seam.scene.lit).toEqual(['red']);
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(screen.getByText(/closed loop/)).toBeTruthy();
  h.next();
  expect(h.state().task!.itemId).toBe('light-2');
  expect(seam.scene).toMatchObject({ powered: false, wires: [] });
});

it('two bulbs: lighting both in a row is a named miss; the red bulb alone passes', () => {
  const h = mount([items()[1]]);
  h.click('Guess it will stay off');
  h.connect("the battery's + end", "the red bulb's left clip");
  h.connect("the red bulb's right clip", "the blue bulb's left clip");
  h.connect("the blue bulb's right clip", "the battery's − end");
  expect(seam.scene.lit).toEqual(['red', 'blue']);
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/Both bulbs lit/)).toBeTruthy();
  h.dispatch('retry');
  h.click("Remove the wire from the blue bulb's left clip to the red bulb's right clip");
  h.click("Remove the wire from the battery's − end to the blue bulb's right clip");
  h.connect("the red bulb's right clip", "the battery's − end");
  expect(seam.scene.lit).toEqual(['red']);
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('find the break: a guess opens the fixes; naming a part that did not fix it is a named miss; Try again keeps the tests', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount([makeBreak('break-1', ['red'], { kind: 'burnt_bulb', bulb: 'red' })]);
  expect(h.demand()).toContain('everything is dark');
  expect(screen.queryByRole('button', { name: 'Try a new battery' })).toBeNull();
  h.click('Guess: the battery');
  h.click('Try a new battery');
  expect(seam.scene.lit).toEqual([]);
  expect(h.demand()).toContain('put in a new battery: still dark');
  h.click('Try a new bulb');
  expect(seam.scene.lit).toEqual(['red']);
  h.click('Broken: the battery');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/which change made it light/)).toBeTruthy();
  h.dispatch('retry');
  expect(screen.getByText('Still dark')).toBeTruthy();
  h.click('Broken: the bulb');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('conductor test: guesses put things in the gap; a call fooled by shine is a named miss; Try again keeps the tests', () => {
  seam.evaluationContext = { lesson: 'test' };
  const c = (k: string) => condByKey(k)!;
  const h = mount([makeConductor('cond-1', [c('spoon'), c('straw')], [c('rusty-nail')])]);
  expect(h.demand()).toContain('the rusty nail (made of metal, dull)');
  expect(h.demand()).not.toContain('rusty nail: tested');
  h.click('Guess the metal spoon will leave it off');
  expect(seam.scene.lit).toEqual(['red']);
  h.click('Guess the plastic straw will light the bulb');
  expect(seam.scene.lit).toEqual([]);
  h.click('The rusty nail leaves it off');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/Shiny or dull does not decide it/)).toBeTruthy();
  h.dispatch('retry');
  expect(screen.getByText('It lit the bulb.')).toBeTruthy();
  h.click('The rusty nail lights the bulb');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(seam.scene.lit).toEqual(['red']);
});

it('add a switch: a loop that never reaches the battery is a named miss; Try again keeps the wires; in the loop it passes', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount([makeSwitch('switch-1', [wire('bat+', 'red.left'), wire('red.right', 'sw.left')])]);
  h.click('Guess it will stay off');
  h.connect("the switch's right clip", "the bulb's left clip");
  h.click('Turn the switch on');
  expect(seam.scene.lit).toEqual([]);
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/still does not light/)).toBeTruthy();
  h.dispatch('retry');
  h.click("Remove the wire from the bulb's left clip to the switch's right clip");
  h.connect("the switch's right clip", "the battery's − end");
  expect(seam.scene.lit).toEqual(['red']);
  h.click('Turn the switch off');
  expect(seam.scene.lit).toEqual([]);
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('two bulbs: a row when asked side by side is a named miss; taking a bulb out tests it; side by side passes', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount([makeTwoBulb('two-1', 'side_by_side', [])]);
  h.click('Guess it will stay off');
  h.connect("the battery's + end", "the red bulb's left clip");
  h.connect("the red bulb's right clip", "the blue bulb's left clip");
  h.connect("the blue bulb's right clip", "the battery's − end");
  expect(seam.scene.lit).toEqual(['red', 'blue']);
  h.click('Take out the red bulb');
  expect(seam.scene.lit).toEqual([]);
  h.click('Put the red bulb back');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/they are in a row/)).toBeTruthy();
  h.dispatch('retry');
  h.click("Remove the wire from the blue bulb's left clip to the red bulb's right clip");
  h.connect("the red bulb's right clip", "the battery's − end");
  h.connect("the battery's + end", "the blue bulb's left clip");
  h.click('Take out the red bulb');
  expect(seam.scene.lit).toEqual(['blue']);
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('levers: x-ray once the battery is in draws charge that stops where the path stops; the easier item is ungraded practice', () => {
  const h = mount([makeLightIt('light-1', ['red'], 'red', [wire('bat+', 'bat-')])]);
  expect((h.state().task!.workspace!.levers ?? []).map(l => l.id)).toEqual(['one_step_less']);
  h.click('Guess it will light');
  expect((h.state().task!.workspace!.levers ?? []).map(l => l.id)).toEqual(['xray', 'one_step_less']);
  h.dispatch('pull_lever', { lever: 'xray' });
  expect(seam.scene.xray).toMatchObject({ flowing: true, fast: true });
  h.dispatch('pull_lever', { lever: 'one_step_less' });
  expect(h.state().task!.itemId).toBe('light-1~easier');
  expect(screen.getByText('Practice')).toBeTruthy();
  expect(seam.scene.wires).toHaveLength(1);
  expect(seam.scene.xray).toBeNull();
});

it('build a device: a doorbell with no switch is a named miss; the buzzer with a switch in the loop passes', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount([makeDevice('device-1', 'doorbell')]);
  h.click('Take a buzzer');
  h.connect("the battery's + end", "the buzzer's left clip");
  h.connect("the buzzer's right clip", "the battery's − end");
  expect(seam.scene.lit).toEqual(['buzzer']);
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/Look at the tray again/)).toBeTruthy();
  h.dispatch('retry');
  h.click('Take a switch');
  h.click("Remove the wire from the battery's − end to the buzzer's right clip");
  h.connect("the buzzer's right clip", "the switch's left clip");
  h.connect("the switch's right clip", "the battery's − end");
  expect(seam.scene.lit).toEqual([]);
  h.click('Turn the switch on');
  expect(seam.scene.lit).toEqual(['buzzer']);
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('magnet test: calling a copper coin pulled is "all metal sticks"; the right calls pass', () => {
  seam.evaluationContext = { lesson: 'test' };
  const k = (x: string) => magnetByKey(x)!;
  const h = mount([makeMagnet('magnet-1', [k('paper-clip'), k('foil'), k('eraser')], [k('nail'), k('penny')])]);
  for (const t of ['steel paper clip', 'piece of aluminium foil', 'eraser']) h.click(`Guess the magnet pulls the ${t}`);
  expect(screen.getByText('It jumped up to the magnet.')).toBeTruthy();
  h.click('The magnet pulls the iron nail');
  h.click('The magnet pulls the copper coin');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/Not every metal/)).toBeTruthy();
  h.dispatch('retry');
  h.click('The magnet does not pull the copper coin');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});
