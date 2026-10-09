// @vitest-environment jsdom
/**
 * R12 (user ruling 2026-10-08): paragraph-architect's writing modes and sentence-builder's tile modes on the real
 * teaching workspace, with real generations as payloads. The Live context, evaluation writes, sound and the judge's
 * HTTP call are substituted.
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
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'om',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import ParagraphArchitect, { type ParagraphArchitectData } from './ParagraphArchitect';
import SentenceBuilder, { type SentenceBuilderData } from './SentenceBuilder';
import writingPayload from '../../../components/live-activity/runtime/testing/w1-payloads/paragraph-architect.informational.json';
import complexPayload from '../../../components/live-activity/runtime/testing/w1-payloads/sentence-builder.compound_complex.json';
import compoundPayload from '../../../components/live-activity/runtime/testing/w1-payloads/sentence-builder.compound.json';
import { getComponentById } from '../../../service/manifest/catalog';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { stagesFor, writingLevers, writingShapeMiss } from './writingStages';
import { bankOrder, orderLevers, orderText, orderVerdict, ordersFrom, shorterFor } from './sentenceOrder';

const writing = (writingPayload as unknown as { data: ParagraphArchitectData }).data;
const compound = (compoundPayload as unknown as { data: SentenceBuilderData }).data;
type Verdict = { met: boolean; miss?: string; realWord: number; fits: number; judge: string };
let verdicts: Verdict[] = [];
const judged: { action: string; params: Record<string, unknown> }[] = [];
beforeEach(() => {
  vi.clearAllMocks(); seam.evaluationContext = null; verdicts = []; judged.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
    judged.push(JSON.parse(init.body));
    return { ok: true, json: async () => verdicts.shift() };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mountWith(node: React.ReactElement) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>{node}</LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let last = '';
  const dispatch = (name: string) => {
    const s = state(); const a = s.affordances.find(x => x.action.type === name)!;
    last = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: last, instanceId: 'om', itemId: s.task!.itemId, expectedRevision: s.revision, action: a.action }); });
  };
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(last); }); };
  const done = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); }); };
  return { state, dispatch, next, done };
}

describe('paragraph-architect writing modes (rules)', () => {
  it('four steps per paragraph type; code catches a blank, a short line and a repeat', () => {
    expect(stagesFor(writing).map(s => s.job)).toEqual(['topic', 'fact', 'fact', 'closing']);
    expect(stagesFor({ ...writing, paragraphType: 'opinion' }).map(s => s.job)).toEqual(['opinion', 'reason', 'reason', 'restate']);
    expect(stagesFor({ ...writing, paragraphType: 'narrative' }).map(s => s.job)).toEqual(['beginning', 'middle', 'middle', 'end']);
    expect(writingShapeMiss('Sharks are ___ in the sea.', [], [])).toBe('blank_left');
    expect(writingShapeMiss('Sharks swim.', [], [])).toBe('too_short');
    expect(writingShapeMiss('Sharks swim very fast.', [], ['Sharks swim very fast.'])).toBe('repeat');
    expect(writingShapeMiss('Sharks swim very fast.', [], [])).toBeUndefined();
  });

  it('every writing mode binds; every named miss is answered by a lever or declared unanswered', () => {
    for (const mode of ['informational', 'narrative', 'opinion'])
      expect(workspaceBinding({ instanceId: 'w', primitiveId: 'paragraph-architect', pin: mode, objectiveIds: ['o'],
        data: { ...writing, paragraphType: mode } }), mode).not.toBeNull();
    const tw = getComponentById('paragraph-architect')!.teachingWorkspace!;
    const answered = new Set(writingLevers(stagesFor(writing)[0], []).flatMap(l => l.answers ?? []));
    for (const m of tw.misses!.informational) if (!tw.unanswered!.informational.includes(m)) expect(answered.has(m), m).toBe(true);
  });
});

describe('paragraph-architect writing modes on the workspace', () => {
  it('a short line misses in code; an accepted sentence joins the paragraph and the next step opens', async () => {
    const h = mountWith(<ParagraphArchitect data={{ ...writing, instanceId: 'om' }} runtimePlanItemId="plan-om" runtimeEvalMode="informational" />);
    expect(h.state().task!.task).toMatch(/Write the first sentence/);
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    const box = screen.getByRole('textbox', { name: 'Your sentence' });
    act(() => { fireEvent.change(box, { target: { value: 'Sharks swim.' } }); });
    await h.done();
    expect(judged).toHaveLength(0);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    h.dispatch('retry');
    act(() => { fireEvent.change(screen.getByRole('textbox', { name: 'Your sentence' }), { target: { value: 'Sharks are fish that live in the ocean.' } }); });
    verdicts.push({ met: true, realWord: 0.98, fits: 0.95, judge: 'jev' });
    await h.done();
    expect(judged[0].params).toMatchObject({ unit: 'writing', made: 'Sharks are fish that live in the ocean.', context: '' });
    expect(h.state().task!.evidence.correctness).toBe('correct');
    expect(screen.getByTestId('ws-paragraph').textContent).toContain('Sharks are fish that live in the ocean.');
    h.next();
    expect(h.state().task!.task).toMatch(/fact about/);
    act(() => { fireEvent.change(screen.getByRole('textbox', { name: 'Your sentence' }), { target: { value: 'Sharks have many sharp teeth.' } }); });
    verdicts.push({ met: false, miss: 'wrong_meaning', realWord: 0.97, fits: 0.1, judge: 'jev+flash' });
    await h.done();
    expect(judged[1].params.context).toBe('Sharks are fish that live in the ocean.');
    expect(screen.getByText(/Does your sentence do that job/)).toBeTruthy();
  });
});

describe('sentence-builder tile modes', () => {
  const items = ordersFrom(compound.challenges);
  it('a listed order passes in code; tiles left and a misplaced end mark miss; an unlisted full order goes to the judge', () => {
    const c = items[0]; const a = c.validArrangements[0];
    expect(orderVerdict(c, a)).toBeUndefined();
    expect(orderVerdict(c, a.slice(0, -2))).toBe('tiles_left');
    expect(orderVerdict(c, [a[a.length - 1], ...a.slice(0, -1)])).toBe('end_mark_not_last');
    const swapped = [...a]; [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(orderVerdict(c, swapped)).toBe('judge');
    expect(orderText(c, a)).toMatch(/^[A-Z].*\.$/);
    expect(bankOrder(c).map(t => t.id)).not.toEqual(a);
    const long = items.find(i => shorterFor(i)) ?? ordersFrom((complexPayload as unknown as { data: SentenceBuilderData }).data.challenges).find(i => shorterFor(i))!;
    expect(shorterFor(long)!.tiles.length).toBeLessThan(long.tiles.length);
    const tw = getComponentById('sentence-builder')!.teachingWorkspace!;
    const answered = new Set(orderLevers(c, []).flatMap(l => l.answers ?? []));
    for (const m of tw.misses!.compound) expect(answered.has(m), m).toBe(true);
  });

  it('on the workspace: the sentence is never printed first; tiles left miss; the listed order passes with no judge call', async () => {
    const h = mountWith(<SentenceBuilder data={{ ...compound, instanceId: 'om' }} runtimePlanItemId="plan-om" runtimeEvalMode="compound" />);
    const c = items[0];
    expect(screen.queryByText(c.targetMeaning ?? '§')).toBeNull();
    const tap = (id: string) => act(() => { fireEvent.click(screen.getByRole('button', { name: `tile ${c.tiles.find(t => t.id === id)!.text}` })); });
    tap(c.validArrangements[0][0]);
    await h.done();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    h.dispatch('retry');
    for (const id of c.validArrangements[0].slice(1)) tap(id);
    await h.done();
    expect(judged).toHaveLength(0);
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });
});
