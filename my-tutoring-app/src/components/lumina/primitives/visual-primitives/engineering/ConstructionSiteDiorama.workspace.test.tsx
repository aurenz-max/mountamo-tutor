// @vitest-environment jsdom
/**
 * The real ConstructionSiteDiorama on the shared teaching workspace, its only teaching path, with the real
 * TeachingSession, LiveLessonRuntime, transport and rendering shell. The 3D scene (WebGL) is replaced by a pile
 * button and a truck button that finish each excavator action at once; the Live context, evaluation writes and
 * sound are substituted.
 */
import React, { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown,
  scene: { loaded: 0, departing: false, squash: false } }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'site',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('./ConstructionScene', () => ({
  default: function Stub(p: { onTap: (t: string) => void; disabled: boolean; loaded: number; departing: boolean; squash: boolean;
    action: { id: string } | null; onMoment: (id: string) => void; onIdle: (id: string) => void }) {
    seam.scene = { loaded: p.loaded, departing: p.departing, squash: p.squash };
    const id = p.action?.id;
    useEffect(() => { if (id) { p.onMoment(id); p.onIdle(id); } }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
    return <div data-construction-scene="stub">
      {['pile', 'truck'].map(t => <button key={t} type="button" onClick={() => { if (!p.disabled) p.onTap(t); }}>{`site-${t}`}</button>)}
    </div>;
  },
}));
import ConstructionSiteDiorama, { type ConstructionSiteDioramaData } from './ConstructionSiteDiorama';
import { buildLoadChallenge, type ConstructionBand, type Material } from './constructionModel';

beforeEach(() => { vi.clearAllMocks(); seam.evaluationContext = null; seam.scene = { loaded: 0, departing: false, squash: false }; });
afterEach(cleanup);

const load = (target: number, i: number, band: ConstructionBand = 'K-2', material: Material = 'dirt') =>
  buildLoadChallenge({ units: band === 'K-2' ? 'scoops' : 'tons', material, target }, 'the new playground', `cs-${i}`);

function mount(targets: number[], band: ConstructionBand = 'K-2') {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  const data: ConstructionSiteDioramaData = { instanceId: 'site', title: 'Load the Dump Truck', description: 'Load it.',
    challengeType: 'load_truck', gradeBand: band, companyName: 'Big Dig', challenges: targets.map((t, i) => load(t, i + 1, band)) };
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <ConstructionSiteDiorama data={data} runtimePlanItemId="plan-site" runtimeEvalMode="load_truck" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'site', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a!.action }); });
  };
  const tap = (t: 'pile' | 'truck') => act(() => { fireEvent.click(screen.getByRole('button', { name: `site-${t}` })); });
  const scoop = (n = 1) => { for (let i = 0; i < n; i++) { tap('pile'); tap('truck'); } };
  const send = () => act(() => { fireEvent.click(screen.getByRole('button', { name: 'Send the truck' })); });
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  return { state, dispatch, tap, scoop, send, next };
}

it('binds under tutor ownership; a tons ask keeps the scoop count out of everything the tutor sees', () => {
  const h = mount([6], '3-5');
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toContain('12 tons');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/"target"|6 scoops/);
});

it('digging and dumping loads one mound per scoop; an empty bucket on the truck takes one back out', () => {
  const h = mount([3]);
  h.scoop(2);
  expect(seam.scene.loaded).toBe(2);
  expect(JSON.stringify(h.state().task!.demand)).toContain('"scoopsInTruck":2');
  h.tap('truck'); // empty bucket: dig back out of the truck
  expect(seam.scene.loaded).toBe(1);
  h.tap('pile'); // full bucket over the pile: dump it back
  expect(seam.scene.loaded).toBe(1);
});

it('a wrong send is a named miss; Try again keeps the load; the right send drives off and completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount([4, 2]);
  h.scoop(3);
  h.send();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/The truck has 3 scoops\. The job needs more dirt/)).toBeTruthy();
  // Input stays closed until the runtime reopens the item.
  h.scoop(1);
  expect(seam.scene.loaded).toBe(3);
  h.dispatch('retry');
  expect(seam.scene.loaded).toBe(3);
  h.scoop(1);
  h.send();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(seam.scene.departing).toBe(true);
  h.send();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.next();
  expect(h.state().task!.itemId).toBe('cs-2');
  expect(seam.scene.loaded).toBe(0);
  expect(seam.scene.departing).toBe(false);
  h.scoop(2);
  h.send();
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('an overloaded tons truck squats on its springs and the scale reads the weight', () => {
  const h = mount([3], '3-5');
  h.scoop(4);
  h.send();
  expect(seam.scene.squash).toBe(true);
  expect(screen.getByText(/The scale reads 8 tons\. Too heavy!/)).toBeTruthy();
});

it('unbound (no runtime) renders the needs-the-tutor card, never the site', () => {
  const data: ConstructionSiteDioramaData = { instanceId: 'site', title: 'Site', description: '', challengeType: 'load_truck',
    gradeBand: 'K-2', companyName: 'Big Dig', challenges: [load(3, 1)] };
  const { container } = render(<ConstructionSiteDiorama data={data} runtimeEvalMode="load_truck" />);
  expect(container.querySelector('[data-workspace-unbound="construction-site-diorama"]')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'site-pile' })).toBeNull();
});
