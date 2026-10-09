// @vitest-environment jsdom
/**
 * Coordinate graph levers on the teaching workspace: a pull changes the plane and the scene fact in one commit, the
 * next attempt records it, a repeat pull changes nothing, no help lever shows the key, and the simpler item is ungraded
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
import type { CoordinateGraphChallenge, CoordinateGraphData } from './CoordinateGraph';
import { planePixel, type GridPoint } from './coordinateGraphWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });
const choose = (h: WorkspaceHarness, label: string) => {
  const b = q(h, 'button').find(x => (x.textContent ?? '').trim() === label);
  expect(b, label).toBeTruthy();
  act(() => { fireEvent.click(b!); });
};
function tap(h: WorkspaceHarness, p: GridPoint) {
  const svg = h.view.container.querySelector('[data-pip-object="plane"]') as SVGSVGElement;
  Object.assign(svg, { getScreenCTM: () => ({ inverse: () => ({}) }), createSVGPoint: () => ({ x: 0, y: 0, matrixTransform() { return this; } }) });
  const at = planePixel(-10, 10, p);
  act(() => { svg.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: at.x, clientY: at.y })); });
}

const hard = { supportTier: 'hard' as const, showHoverReadout: false, showAxisLabels: false, showRiseRunGuides: false, showRiseRunLabels: false,
  showPointLabels: false, showEquationLabel: false, showInterceptMarker: false };
const slope: CoordinateGraphChallenge = { ...hard, id: 's1', type: 'find_slope', instruction: 'Find the slope of the line through the two points.',
  hint: '', x1: -4, y1: -3, x2: 2, y2: 1, option0: '3/2', option1: '-2/3', option2: '2/3', option3: '4', correctOptionIndex: 2 };
const read: CoordinateGraphChallenge = { id: 'r1', type: 'read_point', instruction: 'What are the coordinates of the highlighted point?',
  hint: '', x1: -4, y1: 7, x2: 0, y2: 0, option0: '(4, -7)', option1: '(-4, 7)', option2: '(-7, 4)', option3: '(-4, 6)', correctOptionIndex: 1 };
const plot: CoordinateGraphChallenge = { id: 'p1', type: 'plot_point', instruction: 'Plot the point (5, -8).', hint: '', x1: 5, y1: -8, x2: 0, y2: 0 };
const intercept: CoordinateGraphChallenge = { ...hard, id: 'i1', type: 'find_intercept', instruction: 'Where does this line cross the y-axis?',
  hint: '', x1: 2, y1: 1, x2: 4, y2: 5, option0: '-3', option1: '2', option2: '3', option3: '1', correctOptionIndex: 0, equationLabel: 'y = 2x - 3' };
const graph = (c: CoordinateGraphChallenge): CoordinateGraphData => ({ title: 'Plane', challenges: [c], gridMin: -10, gridMax: 10 });
const mount = (c: CoordinateGraphChallenge) => {
  const h = mountWorkspace({ primitiveId: 'coordinate-graph', evalMode: c.type, data: graph(c) as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};

it('slope, hard tier: the triangle draws in the same commit; the next attempt records the lever; a repeat pull changes nothing', () => {
  const h = mount(slope);
  expect(levers(h)).toEqual([['rise_run_triangle', false], ['unit_steps', false], ['slope_frame', false], ['model_line', false],
    ['simpler_item', false]]);
  choose(h, '3/2');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'reciprocal' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'reciprocal')).toBe('rise_run_triangle');
  const lines = q(h, 'line').length;
  const receipt = h.dispatch('pull_lever', { lever: 'rise_run_triangle' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/triangle is drawn/);
  expect(q(h, 'line').length).toBe(lines + 2);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'rise_run_triangle' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  choose(h, '2/3');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 's1', correct: true, levers: ['rise_run_triangle'] });
});

/** Visible text, one node per word boundary (textContent runs "-1" and "-3" together). */
const screen = (h: WorkspaceHarness) => {
  const walker = document.createTreeWalker(h.view.container, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n.textContent ?? '');
  return parts.join(' ');
};

it('every help lever draws without the key, on every mode', () => {
  for (const [c, wrong, key] of [
    [slope, '3/2', /2\/3|slope is/], [read, '(4, -7)', /\(-4, 7\)/], [intercept, '2', /(?<![\d/])-3(?![\d/])|intercept is -3/],
  ] as const) {
    const h = mount(c);
    choose(h, wrong);
    const screenBefore = screen(h);
    const count = (s: string) => (s.match(new RegExp(key.source, 'g')) ?? []).length;
    for (const l of h.state().task!.workspace!.levers!.filter(x => x.kind === 'help'))
      expect(h.dispatch('pull_lever', { lever: l.id }).status, `${c.id} ${l.id}`).toBe('committed');
    expect(count(screen(h)), `${c.id}: ${screen(h)}`).toBe(count(screenBefore));
    const { choices: _c, ...facts } = h.state().task!.demand as Record<string, unknown>;
    expect(JSON.stringify(facts), c.id).not.toMatch(key);
    cleanup();
  }
});

it('the levers draw what they say', () => {
  const h = mount(read);
  choose(h, '(4, -7)');
  for (const id of ['axis_guide', 'every_line', 'drop_lines', 'model_point']) expect(h.dispatch('pull_lever', { lever: id }).status, id).toBe('committed');
  expect(q(h, '[data-lever="axis-guide"] text').map(t => t.textContent)).toEqual(['x: across →', 'y: up ↑ or down ↓', '(+, +)', '(−, +)', '(−, −)', '(+, −)']);
  expect(q(h, '[data-lever="model-point"] text')[0].textContent).toMatch(/^Example \(/);
  // Every line numbered: the odd lines too, both axes.
  expect(q(h, 'svg text').filter(t => t.textContent === '7')).toHaveLength(2);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/Every grid line on both axes is numbered/);
  cleanup();
  const g = mount(intercept);
  choose(g, '2');
  expect(g.dispatch('pull_lever', { lever: 'crossing_marker' }).status).toBe('committed');
  expect(q(g, 'svg text').map(t => t.textContent)).toContain('?');
  expect(g.dispatch('pull_lever', { lever: 'model_line' }).status).toBe('committed');
  expect(q(g, '[data-lever="model-line"] p')[0].textContent).toMatch(/meets the y-axis at y = /);
});

it('the simpler item is ungraded practice of the same kind; the full item comes back blank and is credited after', () => {
  const h = mount(plot);
  tap(h, { x: -8, y: 5 });
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'swapped' });
  const r = h.dispatch('pull_lever', { lever: 'simpler_item' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('p1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'p1' });
  expect(r.state.task!.task).toBe('Practice first: plot the point (2, -3).');
  expect(r.state.task!.demand).toMatchObject({ learnerWork: 'no point placed yet' });
  tap(h, { x: 2, y: -3 });
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('p1');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'no point placed yet' });
  tap(h, { x: 5, y: -8 });
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['p1', false, false], ['p1~simpler', true, true], ['p1', true, false]]);
});
