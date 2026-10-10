// @vitest-environment jsdom
/**
 * Slope triangle levers on the teaching workspace: a pull changes the card and the scene fact in one commit, the next
 * attempt records it, a repeat pull changes nothing, no help lever shows the key, and the simpler item is ungraded
 * practice with the full item back after it.
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
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { SlopeTriangleChallenge, SlopeTriangleData } from './SlopeTriangle';

beforeEach(() => { installRuntimeTimers(); vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });
const write = (h: WorkspaceHarness, label: string, text: string) => {
  const input = h.view.container.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
  act(() => { fireEvent.change(input, { target: { value: text } }); });
};
const press = (h: WorkspaceHarness, label: string) => {
  const b = Array.from(h.view.container.querySelectorAll('button'))
    .find(x => (x.textContent ?? '').trim() === label || x.getAttribute('aria-label') === label);
  expect(b, label).toBeTruthy();
  act(() => { fireEvent.click(b!); });
};
/** Visible text, one node per word boundary. */
const screen = (h: WorkspaceHarness) => {
  const walker = document.createTreeWalker(h.view.container, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n.textContent ?? '');
  return parts.join(' ');
};

const line = (slope: number, yIntercept: number, label: string) => ({ equation: label, slope, yIntercept, label });
const tri = (x: number, size: number, labels = false) => ({ position: { x, y: 0 }, size, showMeasurements: labels, showSlope: true,
  showAngle: false, notation: 'riseRun' as const });
const identify: SlopeTriangleChallenge = { id: 'i1', type: 'identify_slope', attachedLine: line(-2, 1, 'y = -2x + 1'), triangle: tri(-1, 3),
  expectedRise: -6, expectedRun: 3, expectedSlope: -2, instruction: 'Count the rise and run.', hint: '' };
const calculate: SlopeTriangleChallenge = { id: 'c1', type: 'calculate', attachedLine: line(2 / 3, -3, 'y = 0.67x - 3'),
  triangle: { ...tri(0, 6), notation: 'deltaNotation', showRiseRunLabels: false }, expectedRise: 4, expectedRun: 6, expectedSlope: 2 / 3,
  instruction: 'Calculate the slope.', hint: '', supportTier: 'hard' };
const draw: SlopeTriangleChallenge = { id: 'd1', type: 'draw_triangle', attachedLine: line(0.5, 2, 'y = 0.5x + 2'),
  triangle: { ...tri(-3, 1), notation: 'deltaNotation' }, expectedRise: 2, expectedRun: 4, expectedSlope: 0.5,
  instruction: 'Build the triangle.', hint: '' };
const lesson = (c: SlopeTriangleChallenge): SlopeTriangleData => ({ title: 'Slope', description: '', xRange: [-10, 10], yRange: [-10, 10], challenges: [c] });
const mount = (c: SlopeTriangleChallenge) => {
  const h = mountWorkspace({ primitiveId: 'slope-triangle', evalMode: c.type, data: lesson(c) as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};

it('identify: a pull changes the card and the fact in one commit; the next attempt records it; a repeat pull changes nothing', () => {
  const h = mount(identify);
  expect(levers(h)).toEqual([['count_ticks', false], ['leg_names', false], ['sign_frame', false], ['model_triangle', false],
    ['simpler_item', false]]);
  write(h, 'Rise', '6'); write(h, 'Run', '3'); press(h, 'Check');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'rise_sign' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'rise_sign')).toBe('sign_frame');
  const receipt = h.dispatch('pull_lever', { lever: 'sign_frame' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/goes down is negative/);
  expect(h.view.container.querySelector('[data-lever="sign-frame"]')).toBeTruthy();
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'sign_frame' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  write(h, 'Rise', '-6'); write(h, 'Run', '3'); press(h, 'Check');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'i1', correct: true, levers: ['sign_frame'] });
});

it('every help lever draws without the key, on every mode', () => {
  for (const [c, wrong, key] of [
    [identify, () => [['Rise', '3'], ['Run', '-6']], /(?<![\d.])6(?![\d.])|(?<![\d./-])3(?![\d./])|rise (is|=) -?6/],
    [calculate, () => [['Slope', '3/2']], /2\/3|0\.67|slope is/],
  ] as const) {
    const h = mount(c);
    for (const [label, text] of wrong()) write(h, label, text);
    press(h, 'Check');
    expect(attempts(h).at(-1)?.correct).toBe(false);
    const count = (s: string) => (s.match(new RegExp(key.source, 'g')) ?? []).length;
    const screenBefore = screen(h);
    for (const l of h.state().task!.workspace!.levers!.filter(x => x.kind === 'help'))
      expect(h.dispatch('pull_lever', { lever: l.id }).status, `${c.id} ${l.id}`).toBe('committed');
    expect(count(screen(h)), `${c.id}: ${screen(h)}`).toBe(count(screenBefore));
    expect(String(h.state().task!.demand.onScreen), c.id).not.toMatch(key);
    cleanup();
  }
});

it('calculate, hard tier: leg_labels prints the legs and the model shows another triangle', () => {
  const h = mount(calculate);
  expect(levers(h).map(([id]) => id)).toEqual(['leg_labels', 'count_ticks', 'formula_frame', 'model_triangle', 'simpler_item']);
  expect(h.state().task!.demand.triangle).toBe('the triangle\'s legs carry no numbers');
  write(h, 'Slope', '4'); press(h, 'Check');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'rise_only' });
  expect(h.dispatch('pull_lever', { lever: 'leg_labels' }).status).toBe('committed');
  expect(h.state().task!.demand.triangle).toBe('the triangle\'s legs are labelled Δy = 4 and Δx = 6');
  expect(h.dispatch('pull_lever', { lever: 'model_triangle' }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="model-triangle"] figcaption')!.textContent).toMatch(/^Example: rise \d, run \d, so slope = /);
});

it('the simpler item is ungraded practice of the same kind; the full item comes back blank and is credited after', () => {
  const h = mount(draw);
  press(h, 'Longer run'); press(h, 'Check');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'flat' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'flat')).toBe('build_frame');
  const r = h.dispatch('pull_lever', { lever: 'simpler_item' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('d1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'd1' });
  expect(r.state.task!.task).toMatch(/lands back on the line/);
  expect(String(r.state.task!.demand.learnerWork)).toMatch(/with run 1 and rise 0,/);
  // The practice line has slope one: run 1, rise 1 fits.
  press(h, 'Higher rise'); press(h, 'Check');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('d1');
  expect(String(h.state().task!.demand.learnerWork)).toMatch(/with run 1 and rise 0,/);
  // Any run whose rise fits: run 2, rise 1 on a line of slope one half.
  press(h, 'Longer run'); press(h, 'Higher rise'); press(h, 'Check');
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['d1', false, false], ['d1~simpler', true, true], ['d1', true, false]]);
});

it('draw: no lever prints a run or a rise to build', () => {
  const h = mount(draw);
  press(h, 'Higher rise'); press(h, 'Check');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false });
  for (const l of h.state().task!.workspace!.levers!.filter(x => x.kind === 'help'))
    expect(h.dispatch('pull_lever', { lever: l.id }).status, l.id).toBe('committed');
  const text = h.view.container.querySelector('[data-lever="build-frame"]')!.textContent ?? '';
  expect(text).not.toMatch(/\d/);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/rise of 2(?!\d)|run of 4(?!\d)/);
});
