// @vitest-environment jsdom
/**
 * W1 minimal binding, plain shape: the real NumberLine on the shared teaching workspace, with
 * the real TeachingSession, LiveLessonRuntime, transport and rendering shell. The line's own
 * Check commits a checked gesture; the runtime owns progression. Only microphone hardware,
 * evaluation writes, sound and the legacy AI-context hook are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), legacy: vi.fn(), view: {} as Record<string, unknown>,
  evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'line',
  conversation: [], sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
// The legacy context hook: records whether it was enabled, and exposes the visible window.
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: (o: { enabled?: boolean; primitiveData: Record<string, unknown> }) => {
  seam.view = o.primitiveData; if (o.enabled !== false) seam.legacy();
  return { sendText: seam.legacy, isConnected: true, isAudioPlaying: false, activePrimitiveId: 'line' };
} }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0, resetAttempt: vi.fn() }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import NumberLine, { type NumberLineData } from './NumberLine';

beforeEach(() => { vi.clearAllMocks();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 760, height: 240, right: 760, bottom: 240, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); seam.evaluationContext = null; });

const jump = (id: string, start: number, back: number) => ({ id, type: 'show_jump' as const, instruction: `Start at ${start} and hop back ${back}.`,
  hint: 'Count each hop.', targetValues: [start - back], startValue: start,
  operations: [{ type: 'subtract' as const, startValue: start, changeValue: back, showJumpArc: false }] });
const DATA: NumberLineData = { title: 'Hops', range: { min: 0, max: 20 }, gradeBand: 'K-2', numberType: 'integer',
  interactionMode: 'jump', supportTier: 'medium', challenges: [jump('j0', 8, 3), jump('j1', 15, 4)] } as NumberLineData;

function mount(evalMode = 'jump') {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data = { ...DATA, instanceId: 'line' } as NumberLineData;
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <NumberLine data={data} runtimePlanItemId="plan-line" runtimeEvalMode={evalMode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string) => {
    const s = state(), a = s.affordances.find(x => x.action.type === name)!;
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'line',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: a.action }); });
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const tap = (value: number) => {
    const svg = document.querySelector('svg[viewBox="0 0 760 240"]')!;
    const min = Number(seam.view.visibleMin), max = Number(seam.view.visibleMax);
    act(() => { fireEvent.click(svg, { clientX: 60 + ((value - min) / (max - min)) * 640 }); });
  };
  const check = () => act(() => { fireEvent.click(screen.getByRole('button', { name: /check/i })); });
  return { runtime, transport, sent, state, dispatch, confirmVisible, tap, check };
}

it('binds under tutor ownership: no tool-lab mount, no legacy context, no Next button', () => {
  const h = mount();
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe('Start at 8 and hop back 3.');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/"5"|: ?5[,}]/);
  expect(seam.legacy).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /next challenge/i })).toBeNull();
});

it('Check commits a wrong line, the line stays closed until Try again clears it, then a right one completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount();
  h.tap(6); h.check();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('Landed the jumps at 6');
  expect(screen.getByRole('button', { name: /check/i })).toHaveProperty('disabled', true);
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'Landed the jumps at none yet' });
  h.tap(5); h.check();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.task).toBe('Start at 15 and hop back 4.');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.tap(11); h.check();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0].slice(0, 2)).toEqual([true, 100]);
});
