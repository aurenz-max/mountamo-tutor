// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const seam = vi.hoisted(() => ({ submissions: [] as unknown[][] }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, isAudioPlaying: false }) }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: seam.submissions.length > 0, submittedResult: null, elapsedMs: 0,
  submitResult: (...args: unknown[]) => seam.submissions.push(args) }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
import NumberTracer, { getDigitPaths, type NumberTracerChallenge } from './NumberTracer';
import { isDiagnosableFailure, type DiagnosisEvidence } from '../../../evaluation/diagnosis/types';

beforeEach(() => {
  seam.submissions = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: () => () => undefined, set: () => true }) as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,INK');
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 500, height: 400, right: 500, bottom: 400, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const run = (id: string, start: number, missingIndex: number, tier: NumberTracerChallenge['supportTier'] = 'hard'): NumberTracerChallenge => {
  const sequenceNumbers = [0, 1, 2, 3].map(k => start + k);
  return { id, type: 'sequence', digit: sequenceNumbers[missingIndex], instruction: "What's the missing number? Fill in the blank!", strokePaths: [],
    showModel: false, showArrows: false, hint: 'Count up by ones.', sequenceNumbers, missingIndex, showGhostDigit: false, showStrokeArrows: false, showStartDot: false, supportTier: tier };
};
/** The judge's replies, in order. */
function judge(...replies: Array<[writtenAs: string, score: number]>) {
  const queue = [...replies];
  vi.stubGlobal('fetch', vi.fn(async () => {
    const [writtenAs, score] = queue.shift()!;
    return { ok: true, json: async () => ({ recognized: score >= 50, score, variant: '', feedback: `Read ${writtenAs}.`, confidence: 95, writtenAs }) };
  }));
}
async function attempt(n: number) {
  const canvas = document.querySelector('canvas[data-pip-object="canvas"]') as HTMLCanvasElement;
  for (const stroke of getDigitPaths(n)) {
    await act(async () => { fireEvent.mouseDown(canvas, { clientX: stroke[0].x, clientY: stroke[0].y }); });
    for (const p of stroke.slice(1)) await act(async () => { fireEvent.mouseMove(canvas, { clientX: p.x, clientY: p.y }); });
    await act(async () => { fireEvent.mouseUp(canvas); });
  }
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check' })); });
}
const clear = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Clear' })); });
const next = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: /Next|Finish/ })); });
const submission = () => seam.submissions[0] as [boolean, number, { evalMode?: string }, { studentWork: { responses: unknown[] } }, unknown, DiagnosisEvidence | undefined];

it('records drawings read as another number; the submitted score still counts the accepted tries, and the first-response gate fires', async () => {
  render(<NumberTracer data={{ title: 'Missing numbers', gradeBand: 'K', instanceId: 'nt', challenges: [run('c1', 3, 1), run('c2', 5, 2), run('c3', 1, 1)] }} />);
  judge(['6', 10], ['4', 95], ['8', 15], ['7', 95], ['2', 95]);
  await attempt(6); await clear(); await attempt(4); await next();
  await attempt(8); await clear(); await attempt(7); await next();
  await attempt(2);

  expect(seam.submissions).toHaveLength(1);
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
});

it('attaches no evidence when every drawing was accepted, or rejected only for handwriting', async () => {
  const view = render(<NumberTracer data={{ title: 'Missing numbers', gradeBand: 'K', instanceId: 'nt', challenges: [run('c1', 3, 1), run('c2', 5, 2)] }} />);
  judge(['4', 95], ['7', 90]);
  await attempt(4); await next(); await attempt(7);
  expect(seam.submissions).toHaveLength(1);
  expect(submission()[5]).toBeUndefined();
  view.unmount();

  seam.submissions = [];
  render(<NumberTracer data={{ title: 'Missing numbers', gradeBand: 'K', instanceId: 'nt2', challenges: [run('c1', 3, 1)] }} />);
  judge(['4', 30], ['?', 0], ['4', 90]);
  await attempt(4); await clear(); await attempt(4); await clear(); await attempt(4);
  const [, , , work, , evidence] = submission();
  expect(work.studentWork.responses).toHaveLength(3);
  expect(evidence).toBeUndefined();
});
