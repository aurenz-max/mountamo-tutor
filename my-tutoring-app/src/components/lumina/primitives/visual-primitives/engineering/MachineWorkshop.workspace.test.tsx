// @vitest-environment jsdom
/**
 * The real MachineWorkshop on the shared teaching workspace, its only teaching path, with the real TeachingSession,
 * LiveLessonRuntime, transport and rendering shell. The 3D bench (WebGL) is replaced by a stub that records what it is
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
  scene: { build: null as unknown, solved: false, running: false } }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'machine',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('./MachineBench', () => ({ PartIcon: () => null,
  default: function Stub(p: { build: unknown; solved: boolean; run: unknown }) {
    seam.scene = { build: p.build, solved: p.solved, running: !!p.run };
    return <div data-machine-scene="stub" />;
  },
}));
import MachineWorkshop, { type MachineWorkshopData } from './MachineWorkshop';
import { buildItem, seededRng, type MachineChallenge } from './machineModel';
import { MACHINE_ATLAS, atlasWords } from './machineAtlas';

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); seam.evaluationContext = null; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const JACK = buildItem('machine-1', atlasWords(MACHINE_ATLAS[0]), 'medium', '3-5', seededRng(2));
const MILL = buildItem('machine-2', atlasWords(MACHINE_ATLAS.find(m => m.id === 'stamp_mill')!), 'easy', '3-5', seededRng(3));

function mount(challenges: MachineChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  const data: MachineWorkshopData = { instanceId: 'machine', title: 'The Right Size', description: 'Build it.',
    challengeType: 'spin_to_push', gradeBand: '3-5', challenges };
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <MachineWorkshop data={data} runtimePlanItemId="plan-machine" runtimeEvalMode="spin_to_push" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const dispatch = (name: string) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'machine', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a!.action as NonNullable<typeof a>['action'] }); });
  };
  const click = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const fit = (shaft: string, slider: string) => { click(`Shaft part: ${shaft}`); click(`Slider part: ${slider}`); };
  // Joining the second part runs the machine; let the run play out.
  const run = () => { act(() => { vi.advanceTimersByTime(10000); }); };
  const demand = () => JSON.stringify(state().task!.demand);
  return { state, dispatch, click, fit, run, demand };
}

it('binds as a gesture with no key; the scene names the machine and slot but not the converter; runs fill the notebook', () => {
  const h = mount([JACK]);
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  expect(h.demand()).toContain('pump jack');
  expect(h.demand()).toContain('the missing part (empty: the learner builds it)');
  expect(h.demand()).not.toMatch(/Turns spinning into up-and-down/);
  expect(screen.getByRole('button', { name: "I'm done!" }).hasAttribute('disabled')).toBe(true);
  h.fit('large crank disc', 'long connecting rod');
  expect(seam.scene.build).toEqual({ driver: 'crank-large', link: 'rod-long' });
  h.run();
  expect(screen.getByText('Lab notebook')).toBeTruthy();
  expect(h.demand()).toContain('run 1: a large crank disc with a long connecting rod: it went up and down too far');
});

it('a wrong pair commits wrong_pair; Try again keeps the build and notebook; the medium crank and long rod work and reveal the principle', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount([JACK]);
  h.fit('cam', 'long connecting rod');
  h.run();
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/that wheel has no peg/)).toBeTruthy();
  h.dispatch('retry');
  expect(h.demand()).toContain('run 1: a cam with a long connecting rod');
  h.click('Shaft part: medium crank disc');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(seam.scene.solved).toBe(true);
  expect(screen.getByText(/A real pump jack uses a crank and a connecting rod too/)).toBeTruthy();
});

it('sizes are named misses: a short rod jams, a small crank is too short', () => {
  const h = mount([JACK]);
  h.fit('medium crank disc', 'short connecting rod');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  // The feedback card, the bench's outcome badge, and the notebook row for the run that joining the rod started.
  expect(screen.getAllByText(/twisted sideways and locked/).length).toBe(3);
  h.dispatch('retry');
  h.click('Shaft part: small crank disc');
  h.click('Slider part: long connecting rod');
  h.click("I'm done!");
  expect(screen.getByText(/not far enough/)).toBeTruthy();
});

it('a crank works where the real machine uses a cam, and the feedback says what the real one uses', () => {
  const h = mount([MILL]);
  h.fit('crank disc', 'connecting rod');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(screen.getByText(/a real stamp mill uses a cam and a follower/)).toBeTruthy();
});
