// @vitest-environment jsdom
/**
 * The real SkidSteerYard on the shared teaching workspace, its only teaching path, with the real TeachingSession,
 * LiveLessonRuntime, transport and rendering shell. The 3D scene (WebGL) is replaced by a stub that finishes each
 * move at once; the levers and Go are the component's own buttons. The Live context, evaluation writes and sound are
 * substituted.
 */
import React, { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown,
  scene: { itemKey: '', moves: 0 } }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'skid-yard',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('./SkidSteerScene', () => ({
  default: function Stub(p: { itemKey: string; move: { id: string } | null; onDone: (id: string) => void }) {
    seam.scene.itemKey = p.itemKey;
    const id = p.move?.id;
    useEffect(() => { if (id) { seam.scene.moves++; p.onDone(id); } }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
    return <div data-skid-steer-scene="stub" />;
  },
}));
import SkidSteerYard, { type SkidSteerYardData } from './SkidSteerYard';
import { buildSetLevers, type Lever, type MatchAttachmentChallenge, type Room, type Side } from './skidSteerModel';

beforeEach(() => { vi.clearAllMocks(); seam.evaluationContext = null; seam.scene = { itemKey: '', moves: 0 }; });
afterEach(cleanup);

function mount(turns: Array<[Side, Room]>) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  const things = ['hay bale', 'dirt pile', 'log pile'] as const;
  const data: SkidSteerYardData = { instanceId: 'skid-yard', title: 'Drive the Skid Steer', description: 'Turn it.',
    challengeType: 'set_levers', gradeBand: 'K-2',
    challenges: turns.map(([side, room], i) => buildSetLevers(things[i % 3], side, room, `ss-${i + 1}`)) };
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <SkidSteerYard data={data} runtimePlanItemId="plan-skid" runtimeEvalMode="set_levers" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'skid-yard', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a!.action }); });
  };
  const lever = (side: Side, l: Lever) => act(() => {
    fireEvent.click(document.querySelector(`[data-pip-object="lever-${side}-${l}"]`)!);
  });
  const go = () => act(() => { fireEvent.click(screen.getByRole('button', { name: 'Go' })); });
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  return { state, dispatch, lever, go, next };
}

it('binds under tutor ownership with a gesture check and no key in anything the tutor sees', () => {
  const h = mount([['left', 'boxed']]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toContain('face the hay bale');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  const demand = JSON.stringify(h.state().task!.demand);
  expect(demand).toContain('left side stopped, right side stopped');
  expect(demand).not.toMatch(/left side back, right side forward|\bspin it\b/);
});

it('both levers on stop is not a move: no commit, a hint to move a lever', () => {
  const h = mount([['right', 'open']]);
  h.go();
  expect(h.state().task!.evidence.correctness).toBe('unknown');
  expect(seam.scene.moves).toBe(0);
  expect(screen.getByText(/Both levers are on stop/)).toBeTruthy();
});

it('a pivot that bumps in a boxed yard is a named miss; Try again keeps the levers; the spin completes', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount([['left', 'boxed'], ['right', 'open']]);
  h.lever('right', 'fwd'); // left stopped, right forward: pivots left around the left wheels
  h.go();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.state().task!.workspace!.attempts.at(-1)!.miss).toBe('bumped');
  expect(screen.getByText(/bumped the barrier\. That turn needs more room/)).toBeTruthy();
  // Input stays closed until the runtime reopens the item.
  h.lever('left', 'back');
  expect(JSON.stringify(h.state().task!.demand)).toContain('left side stopped, right side forward');
  h.dispatch('retry');
  expect(JSON.stringify(h.state().task!.demand)).toContain('left side stopped, right side forward');
  h.lever('left', 'back');
  h.go();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(screen.getByText(/spun left right where it stood, and now it faces the hay bale/)).toBeTruthy();
  h.next();
  expect(h.state().task!.itemId).toBe('ss-2');
  expect(JSON.stringify(h.state().task!.demand)).toContain('left side stopped, right side stopped');
  h.lever('left', 'fwd'); // a pivot right around the right wheels: the open yard has room
  h.go();
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('turning away and driving straight are their own misses', () => {
  const h = mount([['left', 'open']]);
  h.lever('left', 'fwd');
  h.go();
  expect(h.state().task!.workspace!.attempts.at(-1)!.miss).toBe('wrong_way');
  h.dispatch('retry');
  h.lever('right', 'fwd');
  h.go();
  expect(h.state().task!.workspace!.attempts.at(-1)!.miss).toBe('drove_straight');
});

it('unbound (no runtime) renders the needs-the-tutor card, never the yard', () => {
  const data: SkidSteerYardData = { instanceId: 'skid-yard', title: 'Yard', description: '', challengeType: 'set_levers',
    gradeBand: 'K-2', challenges: [buildSetLevers('hay bale', 'left', 'open', 'ss-1')] };
  const { container } = render(<SkidSteerYard data={data} runtimeEvalMode="set_levers" />);
  expect(container.querySelector('[data-workspace-unbound="skid-steer-yard"]')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Go' })).toBeNull();
});

it('a job: a bare plate to start, Do the job with nothing on is no try, the near miss is named, the right tool completes', () => {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  const job: MatchAttachmentChallenge = { id: 'ss-1', type: 'match_attachment', job: 'move_pallet',
    options: ['broom', 'bucket', 'forks', 'auger'], instruction: 'Lift the pallet of bricks off the ground. Pick the attachment for the job, then press Do the job.' };
  const data: SkidSteerYardData = { instanceId: 'skid-yard', title: 'Tools', description: '', challengeType: 'match_attachment',
    gradeBand: 'K-2', challenges: [job] };
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <SkidSteerYard data={data} runtimePlanItemId="plan-skid" runtimeEvalMode="match_attachment" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const demand = () => JSON.stringify(state().task!.demand);
  const tap = (a: string) => act(() => { fireEvent.click(document.querySelector(`[data-pip-object="tool-${a}"]`)!); });
  const doJob = () => act(() => { fireEvent.click(screen.getByRole('button', { name: 'Do the job' })); });
  expect(demand()).toContain('nothing yet (a bare quick-attach plate)');
  expect(demand()).not.toMatch(/pallet forks fit|use the pallet forks/);
  doJob();
  expect(state().task!.evidence.correctness).toBe('unknown');
  expect(screen.getByText(/The plate is empty/)).toBeTruthy();
  tap('bucket');
  expect(demand()).toContain('"attachedNow":"bucket"');
  doJob();
  expect(state().task!.workspace!.attempts.at(-1)!.miss).toBe('near_tool');
  expect(screen.getByText(/The bucket could not slide under the pallet/)).toBeTruthy();
  const s = state();
  const retry = s.affordances.find(x => x.action.type === 'retry' || (x.action as { operation?: string }).operation === 'retry')!;
  act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'skid-yard', itemId: s.task!.itemId,
    expectedRevision: s.revision, action: retry.action }); });
  expect(demand()).toContain('"attachedNow":"bucket"'); // Try again keeps the tool on
  tap('forks');
  doJob();
  expect(state().task!.evidence.correctness).toBe('correct');
});
