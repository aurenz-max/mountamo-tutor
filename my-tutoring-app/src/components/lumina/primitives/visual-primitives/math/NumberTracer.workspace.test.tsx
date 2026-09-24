// @vitest-environment jsdom
/**
 * W1 minimal binding, plain shape: the real NumberTracer on the shared teaching workspace, with
 * the real TeachingSession, LiveLessonRuntime, transport and rendering shell. The canvas's own
 * Check commits a checked gesture; the runtime owns progression. jsdom has no 2D context, so the
 * vision judge is never reached and geometry decides, as on a failed judge request.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), legacy: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'tracer',
  conversation: [], sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: (o: { enabled?: boolean }) => {
  if (o.enabled !== false) seam.legacy();
  return { sendText: seam.legacy, isConnected: true, isAudioPlaying: false, activePrimitiveId: 'tracer' };
} }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import NumberTracer, { type NumberTracerData } from './NumberTracer';

beforeEach(() => { vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 500, height: 400,
    right: 500, bottom: 400, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); seam.evaluationContext = null; });

/** A vertical "1" as the guide draws it, and one challenge per numeral. */
const ONE = [[{ x: 250, y: 80 }, { x: 250, y: 320 }]];
const trace = (id: string, digit: number) => ({ id, type: 'trace' as const, digit, instruction: `Trace the number ${digit}.`,
  strokePaths: ONE, showModel: true, showArrows: true });
const DATA = { title: 'Numbers', gradeBand: 'K', challenges: [trace('t1', 1), trace('t2', 1)] } as unknown as NumberTracerData;

/** Dense points along each stroke, drawn with the mouse, offset by `dx` canvas pixels. */
function draw(strokes: { x: number; y: number }[][], dx = 0) {
  const canvas = document.querySelector('canvas[data-pip-object="canvas"]')!;
  for (const stroke of strokes) {
    const [a, b] = stroke;
    const points = Array.from({ length: 24 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / 23 + dx, y: a.y + ((b.y - a.y) * i) / 23 }));
    act(() => { fireEvent.mouseDown(canvas, { clientX: points[0].x, clientY: points[0].y }); });
    for (const p of points.slice(1)) act(() => { fireEvent.mouseMove(canvas, { clientX: p.x, clientY: p.y }); });
    act(() => { fireEvent.mouseUp(canvas); });
  }
}

function mount() {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <NumberTracer data={{ ...DATA, instanceId: 'tracer' } as NumberTracerData} runtimePlanItemId="plan-tracer" runtimeEvalMode="trace" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string) => {
    const s = state(), a = s.affordances.find(x => x.action.type === name)!;
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'tracer',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: a.action }); });
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const check = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^check$/i })); }); };
  return { transport, sent, state, dispatch, confirmVisible, check };
}

it('binds under tutor ownership: no tool-lab mount, no legacy context, no Next button', () => {
  const h = mount();
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe('Trace the number 1.');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(seam.legacy).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /^next$|finish/i })).toBeNull();
});

it('Check commits an off-guide trace, the canvas stays closed until Try again, then a right one completes once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount();
  draw(ONE, 160); await h.check();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('the canvas scored it');
  expect(screen.getByRole('button', { name: /^check$/i })).toHaveProperty('disabled', true);
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ strokesDrawn: 0 });
  draw(ONE); await h.check();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('t2');
  draw(ONE); await h.check();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
});

it('submits nothing without an evaluation provider (the live host)', async () => {
  const h = mount();
  draw(ONE); await h.check(); h.dispatch('advance'); h.confirmVisible();
  draw(ONE); await h.check(); h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).not.toHaveBeenCalled();
});
