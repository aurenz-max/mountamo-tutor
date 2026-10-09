// @vitest-environment jsdom
/**
 * number-tracer levers (`numberTracerLevers.ts`), mounted the way a lesson mounts it: a help pull changes the screen and
 * the scene fact in one commit and is recorded on the next attempt; a refused pull changes nothing; an easier item is
 * ungraded, the full item comes back blank, and only its answer is credited. jsdom has no 2D context, so the canvas's
 * guides are read off its `data-guides`, and the vision judge is never reached: geometry decides.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';
import type { NumberTracerChallenge, PathPoint } from './NumberTracer';
import { getDigitPaths } from './numberTracerPaths';
import {
  COUNT_DOTS_LEVER, COUNT_ON_LEVER, DOTS_LEVER, FIRST_PART_LEVER, GHOST_LEVER, MODEL_STROKES_LEVER, TRACE_PART_LEVER,
} from './numberTracerLevers';

beforeEach(() => {
  installRuntimeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 500, height: 400,
    right: 500, bottom: 400, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const ch = (id: string, type: NumberTracerChallenge['type'], digit: number, extra: Partial<NumberTracerChallenge> = {}): NumberTracerChallenge =>
  ({ id, type, digit, instruction: `Do the ${type} ${digit}!`, strokePaths: [], showModel: type === 'copy', showArrows: false, ...extra });
const mount = (evalMode: string, challenges: NumberTracerChallenge[]) =>
  mountWorkspace({ primitiveId: 'number-tracer', evalMode, data: { title: 'Numbers', gradeBand: 'K', challenges } as never, instanceId: 'tracer' });
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const guides = (h: WorkspaceHarness) => h.view.container.querySelector('canvas')!.getAttribute('data-guides') ?? '';
/** What a refused pull must leave alone (the runtime revision may still move). */
const unchanged = (h: WorkspaceHarness) => JSON.stringify({ d: demand(h), l: levers(h), a: attempts(h), html: h.view.container.innerHTML });

/** Dense points along every stroke, drawn with the mouse, offset by `dx` canvas pixels. */
function draw(h: WorkspaceHarness, paths: PathPoint[][], dx = 0) {
  const canvas = h.view.container.querySelector('canvas')!;
  for (const stroke of paths) {
    const points = stroke.slice(1).flatMap((b, k) => {
      const a = stroke[k];
      return Array.from({ length: 12 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / 12 + dx, y: a.y + ((b.y - a.y) * i) / 12 }));
    }).concat([{ x: stroke[stroke.length - 1].x + dx, y: stroke[stroke.length - 1].y }]);
    act(() => { fireEvent.mouseDown(canvas, { clientX: points[0].x, clientY: points[0].y }); });
    for (const p of points.slice(1)) act(() => { fireEvent.mouseMove(canvas, { clientX: p.x, clientY: p.y }); });
    act(() => { fireEvent.mouseUp(canvas); });
  }
}
const check = async (h: WorkspaceHarness) => {
  await act(async () => { fireEvent.click(h.view.getByRole('button', { name: /^check$/i })); });
};

it('trace: an off-guide trace, then start_dots: the dots and the fact in one commit, recorded on the next try', async () => {
  const h = mount('trace', [ch('t1', 'trace', 4)]);
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([
    [GHOST_LEVER, 'help', true], [DOTS_LEVER, 'help', false], ['stroke_arrows', 'help', false], [TRACE_PART_LEVER, 'simplify', false]]);
  expect(guides(h)).toBe('ghost');
  draw(h, getDigitPaths(4), 160); await check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'shape_off' });
  expect(observerLever(h.state(), true)).toBe(DOTS_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: DOTS_LEVER });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toContain('A green dot marks where each of the 3 strokes starts');
  expect(guides(h)).toBe('ghost start_dots');
  // A second pull, and a lever this item does not have, are refused and change nothing.
  const before = unchanged(h);
  expect(h.dispatch('pull_lever', { lever: DOTS_LEVER }).status).toBe('blocked');
  expect(h.dispatch('pull_lever', { lever: FIRST_PART_LEVER }).status).toBe('blocked');
  expect(unchanged(h)).toBe(before);
  h.dispatch('retry');
  draw(h, getDigitPaths(4)); await check(h);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 't1', correct: true, assisted: true, levers: [DOTS_LEVER] });
  h.close();
});

it('trace: trace_part opens one ungraded stroke, then the whole numeral comes back blank and is credited', async () => {
  const h = mount('trace', [ch('t1', 'trace', 4)]);
  draw(h, getDigitPaths(4), 160); await check(h);
  const receipt = h.dispatch('pull_lever', { lever: TRACE_PART_LEVER });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('t1~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 't1' });
  expect(demand(h)).toMatchObject({ strokesDrawn: 0, practice: expect.stringMatching(/ungraded.*one stroke/) });
  expect(levers(h)).toEqual([]);
  expect(h.view.container.textContent).toContain('Trace this part of the 4!');
  draw(h, [getDigitPaths(4)[0]]); await check(h);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('t1');
  expect(demand(h)).toMatchObject({ strokesDrawn: 0 });
  expect(h.view.container.textContent).toContain('Do the trace 4!');
  draw(h, getDigitPaths(4)); await check(h);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['t1', false, false], ['t1~simpler', true, true], ['t1', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ assisted: true, levers: [TRACE_PART_LEVER] });
  h.close();
});

it('write: first_part draws the opening of the first stroke only; nothing else on the canvas', () => {
  const h = mount('write', [ch('w1', 'write', 5)]);
  expect(levers(h).map(l => l.id)).toEqual([DOTS_LEVER, FIRST_PART_LEVER]);
  expect(guides(h)).toBe('');
  const receipt = h.dispatch('pull_lever', { lever: FIRST_PART_LEVER });
  expect(receipt.status).toBe('committed');
  expect(guides(h)).toBe('first_part');
  expect(String(receipt.state.task!.demand.onScreen)).toBe(
    'The opening part of the first stroke is drawn dotted on the canvas; the rest of the canvas is blank.');
  h.close();
});

it('copy: model_strokes draws the model as numbered strokes beside the canvas; the canvas gets no ghost', () => {
  const h = mount('copy', [ch('k1', 'copy', 4)]);
  expect(h.view.container.querySelector('[data-lever="model-strokes"]')).toBeNull();
  const receipt = h.dispatch('pull_lever', { lever: MODEL_STROKES_LEVER });
  expect(receipt.status).toBe('committed');
  expect(Array.from(h.view.container.querySelectorAll('[data-lever="model-strokes"] [data-stroke]')).map(g => g.textContent)).toEqual(['1', '2', '3']);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/model is drawn as its strokes/);
  expect(guides(h)).not.toMatch(/start_dots|first_part|arrows/);
  h.close();
});

it('sequence: count_dots puts dots under the shown numbers only; count_on_run opens a different run with the gap last', () => {
  const h = mount('sequence', [ch('s1', 'sequence', 4, { sequenceNumbers: [2, 3, 4, 5], missingIndex: 2 })]);
  expect(levers(h).map(l => l.id)).toEqual([COUNT_DOTS_LEVER, COUNT_ON_LEVER]);
  const receipt = h.dispatch('pull_lever', { lever: COUNT_DOTS_LEVER });
  expect(receipt.status).toBe('committed');
  const rows = Array.from(h.view.container.querySelectorAll('[data-lever="count-dots"]'));
  expect(rows.map(r => [r.getAttribute('data-dots'), r.children.length])).toEqual([['2', 2], ['3', 3], ['gap', 0], ['5', 5]]);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/\d/);
  expect(guides(h)).toBe('');
  const easier = h.dispatch('pull_lever', { lever: COUNT_ON_LEVER });
  expect(easier.status).toBe('committed');
  expect(easier.state.task!.itemId).toBe('s1~simpler');
  expect(demand(h).printedSequence).toBe('0, 1, 2, _');
  expect(h.view.container.querySelectorAll('[data-lever="count-dots"]')).toHaveLength(0);
  h.close();
});
