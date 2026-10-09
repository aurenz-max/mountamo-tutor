// @vitest-environment jsdom
/**
 * opinion-builder on the real teaching workspace (OB-7L): `build_opinion` cards and the OREO/CER writing steps, with
 * real generations as payloads. The Live context, evaluation writes, sound and the judge's HTTP call are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'op',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import OpinionBuilder, { opinionWritingPayload, type OpinionBuilderData } from './OpinionBuilder';
import buildPayload from '../../../components/live-activity/runtime/testing/w1-payloads/opinion-builder.build_opinion.json';
import oreoPayload from '../../../components/live-activity/runtime/testing/w1-payloads/opinion-builder.oreo.json';
import { getComponentById } from '../../../service/manifest/catalog';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { askableOpinion, boardOrder, oneSideFor, opinionLevers, opinionMiss, opinionsFrom, type OpinionItem } from './opinionBuild';
import { stagesFor } from './writingStages';

const build = (buildPayload as unknown as { data: OpinionBuilderData }).data;
const oreo = (oreoPayload as unknown as { data: OpinionBuilderData }).data;
const items = opinionsFrom(build.opinions!);
const card = (q: OpinionItem, role: string, side?: string, n = 0) => q.cards.filter(c => c.role === role && (!side || c.side === side))[n].id;
let verdicts: { met: boolean; miss?: string; realWord: number; fits: number; judge: string }[] = [];
const judged: { params: Record<string, unknown> }[] = [];
beforeEach(() => {
  vi.clearAllMocks(); seam.evaluationContext = null; verdicts = []; judged.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => { judged.push(JSON.parse(init.body)); return { ok: true, json: async () => verdicts.shift() }; }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('build_opinion rules (pure)', () => {
  const q = items[0];
  it('either side passes; mixing sides, an off-topic card, a missing part or the wrong order is named', () => {
    for (const side of ['yes', 'no']) expect(opinionMiss(q, [card(q, 'opinion', side), card(q, 'reason', side), card(q, 'example', side), card(q, 'restate', side)]), side).toBeUndefined();
    expect(opinionMiss(q, [card(q, 'opinion', 'yes'), card(q, 'reason', 'yes'), card(q, 'reason', 'yes', 1), card(q, 'example', 'yes'), card(q, 'restate', 'yes')])).toBeUndefined();
    expect(opinionMiss(q, [card(q, 'opinion', 'yes'), card(q, 'reason', 'no'), card(q, 'example', 'yes'), card(q, 'restate', 'yes')])).toBe('other_side');
    expect(opinionMiss(q, [card(q, 'opinion', 'yes'), card(q, 'reason', 'yes'), card(q, 'off_topic'), card(q, 'restate', 'yes')])).toBe('off_topic');
    expect(opinionMiss(q, [card(q, 'opinion', 'yes'), card(q, 'reason', 'yes'), card(q, 'restate', 'yes')])).toBe('no_example');
    expect(opinionMiss(q, [card(q, 'opinion', 'yes'), card(q, 'example', 'yes'), card(q, 'reason', 'yes'), card(q, 'restate', 'yes')])).toBe('out_of_order');
    expect(opinionMiss(q, [card(q, 'reason', 'yes'), card(q, 'opinion', 'yes'), card(q, 'example', 'yes'), card(q, 'restate', 'yes')])).toBe('opinion_not_first');
  });

  it('a set needs both sides complete; the board never opens on an opinion; one-side practice is smaller', () => {
    expect(askableOpinion({ ...items[0], cards: items[0].cards.filter(c => !(c.role === 'example' && c.side === 'no')) })).toBeNull();
    for (const i of items) expect(boardOrder(i)[0].role).not.toBe('opinion');
    expect(oneSideFor(items[0])!.cards.every(c => c.side !== 'no')).toBe(true);
  });

  it('both shapes bind; every named miss is answered by a lever or declared unanswered', () => {
    expect(workspaceBinding({ instanceId: 'b', primitiveId: 'opinion-builder', pin: 'build_opinion', objectiveIds: ['o'], data: build })).not.toBeNull();
    expect(workspaceBinding({ instanceId: 'w', primitiveId: 'opinion-builder', pin: 'oreo', objectiveIds: ['o'], data: oreo })).not.toBeNull();
    const tw = getComponentById('opinion-builder')!.teachingWorkspace!;
    const answered = new Set(opinionLevers(items[0], []).flatMap(l => l.answers ?? []));
    for (const m of tw.misses!.build_opinion) expect(answered.has(m), m).toBe(true);
    expect(stagesFor(opinionWritingPayload(oreo)).map(s => s.job)).toEqual(['opinion', 'reason', 'example', 'restate']);
    expect(stagesFor({ ...opinionWritingPayload(oreo), paragraphType: 'cer' }).map(s => s.job)).toEqual(['claim', 'evidence', 'reasoning', 'conclusion']);
  });
});

function mount(data: OpinionBuilderData, mode: string) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <OpinionBuilder data={{ ...data, instanceId: 'op' }} runtimePlanItemId="plan-op" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const retry = () => {
    const s = state(); const a = s.affordances.find(x => x.action.type === 'retry')!;
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'op', itemId: s.task!.itemId, expectedRevision: s.revision, action: a.action }); });
  };
  return { state, retry };
}

describe('opinion-builder on the workspace', () => {
  it('build_opinion: a reason from the other side misses; Try again keeps the answer; one side all the way passes', () => {
    const h = mount(build, 'build_opinion'); const q = items[0];
    const tap = (id: string) => act(() => { fireEvent.click(screen.getByRole('button', { name: `card ${id}` })); });
    [card(q, 'opinion', 'no'), card(q, 'reason', 'yes'), card(q, 'example', 'no'), card(q, 'restate', 'no')].forEach(tap);
    act(() => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); });
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/for the other side/)).toBeTruthy();
    h.retry();
    act(() => { fireEvent.click(screen.getByRole('button', { name: `take out ${card(q, 'reason', 'yes')}` })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: `take out ${card(q, 'example', 'no')}` })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: `take out ${card(q, 'restate', 'no')}` })); });
    [card(q, 'reason', 'no'), card(q, 'example', 'no'), card(q, 'restate', 'no')].forEach(tap);
    act(() => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); });
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });

  it('OREO writing: the question is the topic; an accepted opinion joins the answer', async () => {
    const h = mount(oreo, 'oreo');
    expect(h.state().task!.task).toMatch(/Write your opinion/);
    act(() => { fireEvent.change(screen.getByRole('textbox', { name: 'Your sentence' }), { target: { value: 'I think kids should not have homework.' } }); });
    verdicts.push({ met: true, realWord: 0.98, fits: 0.9, judge: 'jev' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); });
    expect(judged[0].params).toMatchObject({ unit: 'writing' });
    expect(String(judged[0].params.ask)).toContain(oreo.prompt);
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });
});
