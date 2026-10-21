// @vitest-environment jsdom
/**
 * number-tracer's check, mounted the way a lesson mounts it: which drawings go to the vision judge, what image it is
 * sent, and that no guide is ever painted for a sequence item's hidden answer. Only the canvas 2D context and the
 * judge's fetch are substituted.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));

import React from 'react';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getDigitPaths, type NumberTracerChallenge } from './NumberTracer';

/** Every 2D call per canvas element, so the on-screen canvas and the judged image can be told apart. */
const calls = new Map<HTMLCanvasElement, Array<[string, unknown[], string]>>();
beforeEach(() => {
  installRuntimeTimers();
  calls.clear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    const log = calls.get(this) ?? []; calls.set(this, log);
    const state: Record<string, unknown> = {};
    return new Proxy(state, {
      get: (_, key: string) => key in state ? state[key] : (...args: unknown[]) => { log.push([key, args, String(state.fillStyle ?? '')]); },
      set: (_, key: string, value) => { state[key] = value; return true; },
    }) as never;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,INK');
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 500, height: 400, right: 500, bottom: 400, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const item = (patch: Partial<NumberTracerChallenge>): NumberTracerChallenge => ({ id: 'c1', type: 'trace', digit: 3, instruction: 'Write', strokePaths: [], showModel: false, showArrows: true, ...patch });
const mount = (challenges: NumberTracerChallenge[]) =>
  mountWorkspace({ primitiveId: 'number-tracer', evalMode: challenges[0].type, data: { title: 'Numbers', gradeBand: 'K', challenges } as never, instanceId: 'nt' });
const screenCanvas = (h: WorkspaceHarness) => h.view.container.querySelector('canvas[data-pip-object="canvas"]') as HTMLCanvasElement;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.lastResponse;

/** Draw numeral `n` along its canonical path (geometry ~100 against itself). */
async function write(canvas: HTMLCanvasElement, n: number) {
  for (const stroke of getDigitPaths(n)) {
    await act(async () => { fireEvent.mouseDown(canvas, { clientX: stroke[0].x, clientY: stroke[0].y }); });
    for (const p of stroke.slice(1)) await act(async () => { fireEvent.mouseMove(canvas, { clientX: p.x, clientY: p.y }); });
    await act(async () => { fireEvent.mouseUp(canvas); });
  }
}
const check = async (h: WorkspaceHarness) => act(async () => { fireEvent.click(h.view.getByRole('button', { name: 'Check' })); });
const judged = (response: unknown) => vi.fn(async (_url: string, init: RequestInit) => ({ ok: true, json: async () => response, init }));

it('NT-6: sequence asks the judge even when geometry is a perfect match, and a rejection holds', async () => {
  const fetch = judged({ recognized: false, score: 10, variant: '', feedback: 'That looks like a 2.', confidence: 99 });
  vi.stubGlobal('fetch', fetch);
  const h = mount([item({ type: 'sequence', digit: 3, sequenceNumbers: [1, 2, 3, 4], missingIndex: 2, showArrows: false })]);
  await write(screenCanvas(h), 3);
  await check(h);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toMatchObject({ action: 'evaluateDigitDrawing', params: { targetDigit: 3, challengeType: 'sequence' } });
  expect(last(h)).toMatchObject({ correct: false });
  expect(h.view.getByText('That looks like a 2.')).toBeTruthy();
  h.close();
});

it('trace keeps the position-bound geometry shortcut: a close trace is accepted with no judge call', async () => {
  const fetch = judged({});
  vi.stubGlobal('fetch', fetch);
  const h = mount([item({ type: 'trace', digit: 3 }), item({ id: 'c2' })]);
  await write(screenCanvas(h), 3);
  await check(h);
  expect(fetch).not.toHaveBeenCalled();
  expect(last(h)).toMatchObject({ correct: true });
  h.close();
});

it('NT-5: the judged image is the learner ink alone on the dark ground, not the transparent on-screen canvas', async () => {
  const fetch = judged({ recognized: true, score: 90, variant: '', feedback: 'Nice 3!', confidence: 95 });
  vi.stubGlobal('fetch', fetch);
  const h = mount([item({ type: 'copy', digit: 3, showModel: true, showArrows: false, supportTier: 'easy', showGhostDigit: true, showStartDot: true }), item({ id: 'c2', type: 'copy' })]);
  const onScreen = screenCanvas(h);
  await write(onScreen, 3);
  await check(h);
  const offscreen = Array.from(calls.keys()).filter(c => c !== onScreen);
  expect(offscreen).toHaveLength(1);
  const log = calls.get(offscreen[0])!;
  expect(log[0]).toEqual(['fillRect', [0, 0, 500, 400], '#020617']);
  // Only ink: one moveTo per stroke of the written numeral, no dashed guide, no start dot.
  expect(log.filter(([k]) => k === 'moveTo')).toHaveLength(getDigitPaths(3).length);
  expect(log.some(([k]) => k === 'setLineDash' || k === 'arc')).toBe(false);
  expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledTimes(1);
  expect(vi.mocked(HTMLCanvasElement.prototype.toDataURL).mock.contexts[0]).toBe(offscreen[0]);
  expect(last(h)).toMatchObject({ correct: true });
  h.close();
});

it('a failed judge request falls back to geometry instead of leaving the check hanging', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const h = mount([item({ type: 'write', digit: 3, showArrows: false }), item({ id: 'c2', type: 'write' })]);
  await write(screenCanvas(h), 3);
  await check(h);
  expect(h.view.queryByText('Checking your writing…')).toBeNull();
  expect(last(h)).toMatchObject({ correct: true });
  h.close();
});

it('NT-7: a sequence item never paints a guide for its hidden answer, even with tier flags on; trace still does', () => {
  const guideCalls = (c: HTMLCanvasElement) => (calls.get(c) ?? []).filter(([k, a]) => k === 'setLineDash' && (a[0] as number[])[0] === 4 || k === 'arc').length;
  const seq = mount([item({ type: 'sequence', digit: 1, sequenceNumbers: [0, 1, 2, 3], missingIndex: 1, supportTier: 'easy', showGhostDigit: true, showStartDot: true, showStrokeArrows: true })]);
  expect(guideCalls(screenCanvas(seq))).toBe(0);
  seq.close(); seq.view.unmount();
  const trace = mount([item({ type: 'trace', digit: 1, supportTier: 'easy', showGhostDigit: true, showStartDot: true, showStrokeArrows: true })]);
  expect(guideCalls(screenCanvas(trace))).toBeGreaterThan(0);
  trace.close();
});
