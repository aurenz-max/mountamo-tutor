// @vitest-environment jsdom
/**
 * The real OpenBuilder on the shared teaching workspace, its only teaching path, with the real
 * TeachingSession, LiveLessonRuntime, transport and rendering shell. The Live context, evaluation
 * writes, sound, the board picture (jsdom cannot rasterize) and the judge's HTTP call are substituted;
 * the physics is real.
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
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'ob',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../build-layer/buildLayer', async (orig) => ({ ...(await orig<typeof import('../../build-layer/buildLayer')>()),
  svgPicture: async () => 'P'.repeat(200) }));
import OpenBuilder, { type OpenBuilderData } from './OpenBuilder';
import { SCENES, placeBlock, presetProjects, type OpenBuilderChallenge, type OpenBuilderVerdict, type Placed } from './openBuilderModel';

const bridge = (id: string): OpenBuilderChallenge => ({ ...presetProjects(['bridge'])[0], id });

let verdicts: OpenBuilderVerdict[] = [];
const judged: { action: string; params: Record<string, unknown> }[] = [];
beforeEach(() => {
  vi.clearAllMocks(); seam.evaluationContext = null; verdicts = []; judged.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
    judged.push(JSON.parse(init.body));
    return { ok: true, json: async () => verdicts.shift() };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mount(challenges: OpenBuilderChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  const data: OpenBuilderData = { instanceId: 'ob', title: 'Little Builders', description: 'Build.', challengeType: 'build_to_goal',
    gradeBand: 'K-2', challenges };
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <OpenBuilder data={data} runtimePlanItemId="plan-ob" runtimeEvalMode="build_to_goal" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'ob', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a!.action }); });
  };
  const click = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const drop = (block: string, col: number) => { click(`Choose ${block}`); click(`Drop in column ${col}`); };
  const done = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); }); };
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  return { state, dispatch, click, drop, done, next };
}

it('blocks rest on the river banks: a long block across the gap stays up, one in the gap falls in', () => {
  const scene = SCENES.bridge;
  const across = placeBlock(scene, [], 'long', 'blue', 3) as Placed[];
  expect(across[0].row).toBe(2);
  const inRiver = placeBlock(scene, [], 'small', 'blue', 5) as Placed[];
  expect(inRiver[0].row).toBe(0);
  const capped = placeBlock(scene, placeBlock(scene, [], 'triangle', 'coral', 0) as Placed[], 'small', 'blue', 0);
  expect(capped).toEqual({ error: 'Nothing can sit on top of a triangle.' });
});

it('binds under tutor ownership with the goal as the task and nothing to withhold', () => {
  const h = mount([bridge('ob-1')]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(bridge('x').goal);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect((screen.getByRole('button', { name: "I'm done!" }) as HTMLButtonElement).disabled).toBe(true);
});

it('the judge gets a picture; a miss shows its question, which STAYS through Try again; a met build completes', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount([bridge('ob-1'), bridge('ob-2')]);
  h.drop('plank', 3);
  verdicts.push({ met: false, miss: 'does_not_work', noticed: 'Your blue plank sits on the left bank.',
    nudge: 'Can the car reach the other side of the river?' });
  await h.done();
  expect(judged[0]).toMatchObject({ action: 'judgeOpenBuild', params: { sceneId: 'bridge', goal: bridge('x').goal } });
  expect((judged[0].params.image as string).length).toBeGreaterThan(100);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/Can the car reach the other side/)).toBeTruthy();
  h.dispatch('retry');
  // The build and the buddy's question are both still there while the learner revises.
  expect(document.querySelector('[data-block-id="plank-1"]')).not.toBeNull();
  expect(screen.getByText(/Can the car reach the other side/)).toBeTruthy();
  h.drop('long block', 5);
  expect(screen.getByText(/Can the car reach the other side/)).toBeTruthy();
  verdicts.push({ met: true, noticed: 'Your long block reaches all the way to the right bank.', nudge: '' });
  await h.done();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(screen.getByText(/You did it/)).toBeTruthy();
  h.next();
  expect(h.state().task!.itemId).toBe('ob-2');
  expect(document.querySelector('[data-block-id]')).toBeNull();
  expect(screen.queryByText(/Can the car reach/)).toBeNull();
});

it('a judge that cannot be reached commits nothing', async () => {
  const h = mount([bridge('ob-1')]);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
  h.drop('small block', 1);
  await h.done();
  expect(h.state().task!.evidence.correctness).not.toBe('incorrect');
  expect(screen.getByText(/could not look just now/)).toBeTruthy();
});

it('unbound (no runtime) renders the needs-the-tutor card, never the board', () => {
  const data: OpenBuilderData = { instanceId: 'ob', title: 'Our board', description: '', challengeType: 'build_to_goal',
    gradeBand: 'K-2', challenges: [bridge('ob-1')] };
  const { container } = render(<OpenBuilder data={data} runtimeEvalMode="build_to_goal" />);
  expect(container.querySelector('[data-workspace-unbound="open-builder"]')).not.toBeNull();
  expect(screen.queryByRole('button', { name: "I'm done!" })).toBeNull();
});
