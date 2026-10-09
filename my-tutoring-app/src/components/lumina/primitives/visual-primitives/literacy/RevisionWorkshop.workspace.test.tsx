// @vitest-environment jsdom
/**
 * revision-workshop on the real teaching workspace (OB-7L): typed revisions and reorganize, with real generations as
 * payloads. The Live context, evaluation writes, sound and the judge's HTTP call are substituted.
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
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'rv',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import RevisionWorkshop, { type RevisionWorkshopData } from './RevisionWorkshop';
import detailsPayload from '../../../components/live-activity/runtime/testing/w1-payloads/revision-workshop.add_details.json';
import combinePayload from '../../../components/live-activity/runtime/testing/w1-payloads/revision-workshop.combine_sentences.json';
import orderPayload from '../../../components/live-activity/runtime/testing/w1-payloads/revision-workshop.reorganize.json';
import { getComponentById } from '../../../service/manifest/catalog';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { orderMiss, revisionItems, revisionLevers, revisionShapeMiss } from './revisionSteps';

const details = (detailsPayload as unknown as { data: RevisionWorkshopData }).data;
const combine = (combinePayload as unknown as { data: RevisionWorkshopData }).data;
const order = (orderPayload as unknown as { data: RevisionWorkshopData }).data;
const MODES: [string, RevisionWorkshopData][] = [['add_details', details], ['combine_sentences', combine], ['reorganize', order]];
let verdicts: { met: boolean; miss?: string; realWord: number; fits: number; judge: string }[] = [];
const judged: { params: Record<string, unknown> }[] = [];
beforeEach(() => {
  vi.clearAllMocks(); seam.evaluationContext = null; verdicts = []; judged.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => { judged.push(JSON.parse(init.body)); return { ok: true, json: async () => verdicts.shift() }; }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('revision rules (pure)', () => {
  it('code names an unchanged, a still-split combine, and a longer "concise" sentence; reorganize checks the targets order', () => {
    const [d] = revisionItems(details);
    expect(revisionShapeMiss(d, d.original)).toBe('unchanged');
    expect(revisionShapeMiss(d, 'Sand.')).toBe('too_short');
    expect(revisionShapeMiss(d, 'I played in the soft, warm sand and built a tall castle with towers.')).toBeUndefined();
    const [c] = revisionItems(combine);
    expect(revisionShapeMiss(c, 'I went to the beach. Then I built a huge sandcastle.')).toBe('not_combined');
    expect(revisionShapeMiss(c, 'I went to the beach and built a huge sandcastle.')).toBeUndefined();
    const concise = { ...c, skill: 'concision' as const, original: 'The very big huge dog was really very big.' };
    expect(revisionShapeMiss(concise, 'The very big huge dog was really very big and large.')).toBe('not_shorter');
    const ids = order.targets.map(t => t.targetId);
    expect(orderMiss(order, ids)).toBeUndefined();
    expect(orderMiss(order, [...ids].reverse())).toBe('wrong_order');
  });

  it('every mode binds; every named miss is answered by a lever or declared unanswered', () => {
    const tw = getComponentById('revision-workshop')!.teachingWorkspace!;
    for (const [mode, data] of MODES) {
      expect(workspaceBinding({ instanceId: mode, primitiveId: 'revision-workshop', pin: mode, objectiveIds: ['o'], data }), mode).not.toBeNull();
      const answered = new Set(revisionLevers(revisionItems(data)[0], []).flatMap(l => l.answers ?? []));
      const unanswered = new Set(tw.unanswered?.[mode] ?? []);
      for (const m of tw.misses![mode]) expect(answered.has(m) || unanswered.has(m), `${mode} ${m}`).toBe(true);
    }
  });

  it('the model answer is never on screen', () => {
    for (const [mode, data] of MODES) {
      if (mode === 'reorganize') continue;
      mount(data, mode);
      for (const t of data.targets) if (t.idealRevision && t.idealRevision !== t.originalText) expect(document.body.textContent).not.toContain(t.idealRevision);
      cleanup();
    }
  });
});

function mount(data: RevisionWorkshopData, mode: string) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <RevisionWorkshop data={{ ...data, instanceId: 'rv' }} runtimePlanItemId="plan-rv" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const retry = () => {
    const s = state(); const a = s.affordances.find(x => x.action.type === 'retry')!;
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'rv', itemId: s.task!.itemId, expectedRevision: s.revision, action: a.action }); });
  };
  return { state, retry };
}

const type = (v: string) => act(() => { fireEvent.change(screen.getByRole('textbox', { name: 'Your revision' }), { target: { value: v } }); });
const done = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); }); };

describe('revision-workshop on the workspace', () => {
  it('add details: an unchanged sentence misses in code with no judge call; a judged revision passes', async () => {
    const h = mount(details, 'add_details');
    type(details.targets[0].originalText);
    await done();
    expect(judged).toHaveLength(0);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/same as before/)).toBeTruthy();
    h.retry();
    type('I played in the soft, warm sand and built a tall castle with three towers.');
    verdicts.push({ met: true, realWord: 0.98, fits: 0.9, judge: 'jev' });
    await done();
    expect(judged[0].params).toMatchObject({ unit: 'writing', context: details.draft });
    expect(String(judged[0].params.ask)).toContain(details.targets[0].originalText);
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });

  it('combine: a revision the judge says does a different job is wrong_job', async () => {
    const h = mount(combine, 'combine_sentences');
    type('I went to the beach and the sun was hot.');
    verdicts.push({ met: false, miss: 'wrong_meaning', realWord: 0.9, fits: 0.1, judge: 'jev' });
    await done();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/Read the task again/)).toBeTruthy();
  });

  it('reorganize: the board never opens in the answer order; the targets order passes in code', async () => {
    const h = mount(order, 'reorganize');
    const ids = order.targets.map(t => t.targetId);
    const board = screen.getAllByRole('button', { name: /^sentence / }).map(b => b.getAttribute('aria-label')!.slice(9));
    expect(board).not.toEqual(ids);
    for (const id of [...ids].reverse()) act(() => { fireEvent.click(screen.getByRole('button', { name: `sentence ${id}` })); });
    await done();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    h.retry();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Clear' })); });
    for (const id of ids) act(() => { fireEvent.click(screen.getByRole('button', { name: `sentence ${id}` })); });
    await done();
    expect(judged).toHaveLength(0);
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });
});
