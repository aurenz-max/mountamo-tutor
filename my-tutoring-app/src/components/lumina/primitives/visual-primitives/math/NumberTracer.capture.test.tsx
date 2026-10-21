// @vitest-environment jsdom
/**
 * number-tracer's misconception evidence, mounted the way a lesson mounts it under an evaluation provider: every
 * checked drawing is recorded, and only drawings the judge read as another number make the evidence. Only the canvas
 * 2D context and the judge's fetch are substituted.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));

import React from 'react';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getDigitPaths, type NumberTracerChallenge } from './NumberTracer';
import { isDiagnosableFailure, type DiagnosisEvidence } from '../../../evaluation/diagnosis/types';

beforeEach(() => {
  installRuntimeTimers();
  seam.evaluationContext = { lesson: 'test' };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: () => () => undefined, set: () => true }) as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,INK');
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 500, height: 400, right: 500, bottom: 400, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const run = (id: string, start: number, missingIndex: number, tier: NumberTracerChallenge['supportTier'] = 'hard'): NumberTracerChallenge => {
  const sequenceNumbers = [0, 1, 2, 3].map(k => start + k);
  return { id, type: 'sequence', digit: sequenceNumbers[missingIndex], instruction: "What's the missing number? Fill in the blank!", strokePaths: [],
    showModel: false, showArrows: false, hint: 'Count up by ones.', sequenceNumbers, missingIndex, showGhostDigit: false, showStrokeArrows: false, showStartDot: false, supportTier: tier };
};
const mount = (challenges: NumberTracerChallenge[], instanceId = 'nt') =>
  mountWorkspace({ primitiveId: 'number-tracer', evalMode: 'sequence', data: { title: 'Missing numbers', gradeBand: 'K', challenges } as never, instanceId });
/** The judge's replies, in order. */
function judge(...replies: Array<[writtenAs: string, score: number]>) {
  const queue = [...replies];
  vi.stubGlobal('fetch', vi.fn(async () => {
    const [writtenAs, score] = queue.shift()!;
    return { ok: true, json: async () => ({ recognized: score >= 50, score, variant: '', feedback: `Read ${writtenAs}.`, confidence: 95, writtenAs }) };
  }));
}
async function attempt(h: WorkspaceHarness, n: number) {
  const canvas = h.view.container.querySelector('canvas[data-pip-object="canvas"]') as HTMLCanvasElement;
  for (const stroke of getDigitPaths(n)) {
    await act(async () => { fireEvent.mouseDown(canvas, { clientX: stroke[0].x, clientY: stroke[0].y }); });
    for (const p of stroke.slice(1)) await act(async () => { fireEvent.mouseMove(canvas, { clientX: p.x, clientY: p.y }); });
    await act(async () => { fireEvent.mouseUp(canvas); });
  }
  await act(async () => { fireEvent.click(h.view.getByRole('button', { name: 'Check' })); });
}
/** The observer's Try again, and its advance once the item is right. */
const retry = (h: WorkspaceHarness) => { h.dispatch('retry'); };
const next = (h: WorkspaceHarness) => { h.dispatch('advance'); h.confirmVisible(); };
const submission = () => seam.submit.mock.calls[0] as [boolean, number, { evalMode?: string }, { studentWork: { responses: unknown[] } }, unknown, DiagnosisEvidence | undefined];

it('records drawings read as another number; the submitted score still counts the accepted tries, and the first-response gate fires', async () => {
  const h = mount([run('c1', 3, 1), run('c2', 5, 2), run('c3', 1, 1)]);
  judge(['6', 10], ['4', 95], ['8', 15], ['7', 95], ['2', 95]);
  await attempt(h, 6); retry(h); await attempt(h, 4); next(h);
  await attempt(h, 8); retry(h); await attempt(h, 7); next(h);
  await attempt(h, 2); next(h);

  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, score, metrics, work, , evidence] = submission();
  expect([success, score, metrics.evalMode]).toEqual([true, 95, 'sequence']);
  expect(work.studentWork.responses).toHaveLength(5);
  expect(evidence?.firstResponseScore).toBe(33);
  expect(evidence?.observed).toBe('run 3, ?, 5, 6, try 1: wrote 6; run 5, 6, ?, 8, try 1: wrote 8');
  expect(evidence?.phases?.map(p => [p.itemId, p.expected, p.observed])).toEqual([
    ['c1', '4', 'Incorrect: the judge read the drawing as 6 (score 10)'], ['c1', '4', 'Correct: the judge read 4 (handwriting score 95)'],
    ['c2', '7', 'Incorrect: the judge read the drawing as 8 (score 15)'], ['c2', '7', 'Correct: the judge read 7 (handwriting score 95)'],
    ['c3', '2', 'Correct: the judge read 2 (handwriting score 95)']]);
  expect(evidence?.phases?.[0].support).toBe('Try 1; no tracing guide; hint not shown; support tier hard.');
  expect(isDiagnosableFailure({ success, score }, evidence)).toBe(true);
  h.close();
});

it('attaches no evidence when every drawing was accepted, or rejected only for handwriting', async () => {
  const h = mount([run('c1', 3, 1), run('c2', 5, 2)]);
  judge(['4', 95], ['7', 90]);
  await attempt(h, 4); next(h); await attempt(h, 7); next(h);
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(submission()[5]).toBeUndefined();
  h.close(); h.view.unmount();

  seam.submit.mockClear();
  const h2 = mount([run('c1', 3, 1)], 'nt2');
  judge(['4', 30], ['?', 0], ['4', 90]);
  await attempt(h2, 4); retry(h2); await attempt(h2, 4); retry(h2); await attempt(h2, 4); next(h2);
  const [, , , work, , evidence] = submission();
  expect(work.studentWork.responses).toHaveLength(3);
  expect(evidence).toBeUndefined();
  h2.close();
});
