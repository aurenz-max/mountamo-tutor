// @vitest-environment jsdom
/**
 * The real AirplaneDiorama on the shared teaching workspace, its only teaching path, with the real
 * TeachingSession, LiveLessonRuntime, transport and rendering shell. The 3D scene (WebGL) is replaced by
 * one button per part, so a test can "tap" a part; the Live context, evaluation writes and sound are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown, scene: { showing: null as string | null, flying: false } }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'jet',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('./AirplaneScene', () => ({
  default: (p: { onTapPart: (part: string) => void; disabled: boolean; showing: string | null; flying: boolean }) => {
    seam.scene.showing = p.showing; seam.scene.flying = p.flying;
    return <div data-airplane-scene="stub">
      {['wings', 'engines', 'tail', 'cockpit', 'gear', 'cabin', 'nose'].map(part =>
        <button key={part} type="button" onClick={() => { if (!p.disabled) p.onTapPart(part); }}>{`jet-${part}`}</button>)}
    </div>;
  },
}));
import AirplaneDiorama, { type AirplaneDioramaData } from './AirplaneDiorama';
import { buildAirplaneChallenge, buildFlightPlanChallenge, type AirplaneBand, type AirplaneChallenge, type AirplanePart } from './airplaneModel';

beforeEach(() => { vi.clearAllMocks(); seam.evaluationContext = null; seam.scene = { showing: null, flying: false }; });
afterEach(cleanup);

const ask = (part: AirplanePart, i: number, band: AirplaneBand = 'K-2') => buildAirplaneChallenge(part, { id: `ap-${i}`, band });

function mount(parts: (AirplanePart | AirplaneChallenge)[], band: AirplaneBand = 'K-2') {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: unknown[] = [];
  new RuntimeTransport(runtime, m => sent.push(m));
  const data: AirplaneDioramaData = { instanceId: 'jet', title: 'Parts of a Jet', description: 'Find the parts.', challengeType: 'find_part',
    gradeBand: band, airlineName: 'Bluebird', challenges: parts.map((p, i) => typeof p === 'string' ? ask(p, i + 1, band) : p) };
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <AirplaneDiorama data={data} runtimePlanItemId="plan-jet" runtimeEvalMode="find_part" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'jet', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a!.action }); });
  };
  const tap = (part: AirplanePart) => act(() => { fireEvent.click(screen.getByRole('button', { name: `jet-${part}` })); });
  const press = (label: string, times = 1) => { for (let i = 0; i < times; i++) act(() => { fireEvent.click(screen.getByRole('button', { name: label })); });
    if (label === 'Fly!') act(() => { vi.advanceTimersByTime(10_000); }); };
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  return { state, dispatch, tap, press, next };
}

it('binds under tutor ownership; a job ask keeps the part out of everything the tutor sees', () => {
  const h = mount(['engines'], '3-5');
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe('Find the part that pushes the plane forward and tap it.');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/engine/i);
  expect(seam.send.mock.calls.flat().join(' ')).not.toMatch(/engine/i);
});

it('a wrong tap is a named miss that names what was tapped; Try again reopens; the right tap shows the part and completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(['wings', 'cockpit']);
  h.tap('tail');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText("That's the tail. Look again for the wings.")).toBeTruthy();
  expect(JSON.stringify(h.state().task!.demand)).toContain('"lastTapped":"the tail"');
  // Input stays closed until the runtime reopens the item.
  h.tap('wings');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  h.dispatch('retry');
  h.tap('wings');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(seam.scene.showing).toBe('wings');
  expect(screen.getByText(/Watch: the flaps/)).toBeTruthy();
  // A second tap after the find does not commit again.
  h.tap('nose');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.next();
  expect(h.state().task!.itemId).toBe('ap-2');
  expect(seam.scene.showing).toBeNull();
  expect(screen.queryByText(/Watch:/)).toBeNull();
  h.tap('cockpit');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('unbound (no runtime) renders the needs-the-tutor card, never the jet', () => {
  const data: AirplaneDioramaData = { instanceId: 'jet', title: 'Jet', description: '', challengeType: 'find_part', gradeBand: 'K-2',
    airlineName: 'Bluebird', challenges: [ask('wings', 1)] };
  const { container } = render(<AirplaneDiorama data={data} runtimeEvalMode="find_part" />);
  expect(container.querySelector('[data-workspace-unbound="airplane-diorama"]')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'jet-wings' })).toBeNull();
});

it('flight plan: the scene keeps the tank count from the tutor; the flight is the check with named misses', () => {
  // Fake frames and clock: Fly runs the real flight animation to its end in one advance.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  try {
    seam.evaluationContext = { lesson: 'test' };
    const trip = buildFlightPlanChallenge({ from: 'Pine Hill', to: 'Bay Town', cargo: 'the school band' },
      { units: 'km', distance: 1200, perTank: 300 }, 'ap-1');
    const second = buildFlightPlanChallenge({ from: 'Elm', to: 'Snow Peak', cargo: 'a team of skiers' },
      { units: 'km', distance: 800, perTank: 200 }, 'ap-2');
    const h = mount([trip, second], '3-5');
    expect(h.state().task!.task).toContain('1,200 km away');
    expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/\b5 tanks\b/);
    // The loader starts empty, so Fly is closed.
    expect((screen.getByRole('button', { name: 'Fly!' }) as HTMLButtonElement).disabled).toBe(true);
    h.press('Add a tank', 4);
    h.press('Fly!');
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/tanks were empty/)).toBeTruthy();
    expect(JSON.stringify(h.state().task!.demand)).toContain('"tanksLoaded":4');
    // Input stays closed until the runtime reopens the item; Try again empties the loader.
    expect((screen.getByRole('button', { name: 'Add a tank' }) as HTMLButtonElement).disabled).toBe(true);
    h.dispatch('retry');
    expect(screen.getByText('Tanks: 0')).toBeTruthy();
    h.press('Add a tank', 5);
    h.press('Fly!');
    expect(h.state().task!.evidence.correctness).toBe('correct');
    expect(screen.getByText(/^Yes! The jet reached Bay Town with 1 spare tank left/)).toBeTruthy();
    expect(seam.scene.showing).toBe('engines');
  } finally { vi.useRealTimers(); }
});

it('a mixed session runs a find, then a trip on the same jet', () => {
  // Fake frames and clock: Fly runs the real flight animation to its end in one advance.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  try {
    const trip = buildFlightPlanChallenge({ from: 'Elm', to: 'Snow Peak', cargo: 'a team of skiers' },
      { units: 'hops', distance: 3, perTank: 1 }, 'ap-2');
    const h = mount(['nose', trip]);
    expect(screen.queryByRole('button', { name: 'Fly!' })).toBeNull();
    h.tap('nose');
    h.next();
    expect(h.state().task!.itemId).toBe('ap-2');
    expect(seam.scene.showing).toBeNull();
    // A tap on the jet is not an answer on a trip.
    h.tap('wings');
    expect(h.state().task!.evidence.correctness).not.toBe('incorrect');
    h.press('Add a tank', 2);
    h.press('Fly!');
    expect(screen.getByText(/Out of fuel! The jet flew 2 hops and had to land 1 hop short of Snow Peak/)).toBeTruthy();
  } finally { vi.useRealTimers(); }
});
