// @vitest-environment jsdom
/**
 * Coordinate graph on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { CoordinateGraphChallenge, CoordinateGraphData } from './CoordinateGraph';
import { COORDINATE_MISSES_BY_MODE, coordinateMiss, maskedEquation, planePixel, type GridPoint } from './coordinateGraphWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

/** A tap on the plane at a grid crossing: one pointer up in the viewBox (identity screen matrix, as the driver). */
export function tapCrossing(h: WorkspaceHarness, p: GridPoint, grid = { gridMin: -10, gridMax: 10 }) {
  const svg = h.view.container.querySelector('[data-pip-object="plane"]') as SVGSVGElement;
  expect(svg, 'the plane').toBeTruthy();
  Object.assign(svg, { getScreenCTM: () => ({ inverse: () => ({}) }),
    createSVGPoint: () => ({ x: 0, y: 0, matrixTransform() { return this; } }) });
  const at = planePixel(grid.gridMin, grid.gridMax, p);
  act(() => {
    const e = new MouseEvent('pointerup', { bubbles: true, cancelable: true, button: 0, clientX: at.x, clientY: at.y });
    Object.assign(e, { pointerId: 1, pointerType: 'mouse', isPrimary: true });
    svg.dispatchEvent(e);
  });
}
const choose = (h: WorkspaceHarness, label: string) => {
  const button = Array.from(h.view.container.querySelectorAll('button')).find(b => (b.textContent ?? '').trim() === label);
  expect(button, `choice ${label}`).toBeTruthy();
  act(() => { fireEvent.click(button!); });
};

const base = { hint: 'The answer is (3, -2).', x2: 0, y2: 0 };
const plot: CoordinateGraphChallenge = { ...base, id: 'p1', type: 'plot_point', instruction: 'Plot the point (3, -2).', x1: 3, y1: -2 };
const read: CoordinateGraphChallenge = { ...base, id: 'r1', type: 'read_point', instruction: 'What are the coordinates of the highlighted point?',
  x1: -4, y1: 6, option0: '(6, -4)', option1: '(-4, 6)', option2: '(4, 6)', option3: '(-4, -6)', correctOptionIndex: 1 };
const slope: CoordinateGraphChallenge = { ...base, id: 's1', type: 'find_slope', instruction: 'Find the slope of the line through the two points.',
  x1: -3, y1: 1, x2: 3, y2: 5, option0: '3/2', option1: '-2/3', option2: '2/3', option3: '4', correctOptionIndex: 2 };
const intercept: CoordinateGraphChallenge = { ...base, id: 'i1', type: 'find_intercept', instruction: 'Where does this line cross the y-axis?',
  x1: 2, y1: 7, x2: 3, y2: 9, option0: '2', option1: '-3', option2: '3', option3: '7', correctOptionIndex: 2, equationLabel: 'y = 2x + 3' };
const graph = (challenges: CoordinateGraphChallenge[]): CoordinateGraphData => ({ title: 'The coordinate plane', challenges, gridMin: -10, gridMax: 10 });

type Act = { kind: 'plot'; point: GridPoint } | { kind: 'choose'; label: string };
type Case = { mode: string; item: CoordinateGraphChallenge; wrong: Act; miss: string; right: Act; secret: RegExp };
const CASES: Case[] = [
  { mode: 'plot_point', item: plot, wrong: { kind: 'plot', point: { x: -2, y: 3 } }, miss: 'swapped',
    right: { kind: 'plot', point: { x: 3, y: -2 } }, secret: /placed a point at \(3, -2\)/ },
  { mode: 'read_point', item: read, wrong: { kind: 'choose', label: '(6, -4)' }, miss: 'swapped',
    right: { kind: 'choose', label: '(-4, 6)' }, secret: /\(-4, 6\)/ },
  { mode: 'find_slope', item: slope, wrong: { kind: 'choose', label: '3/2' }, miss: 'reciprocal',
    right: { kind: 'choose', label: '2/3' }, secret: /2\/3|slope is/ },
  { mode: 'find_intercept', item: intercept, wrong: { kind: 'choose', label: '2' }, miss: 'slope_instead',
    right: { kind: 'choose', label: '3' }, secret: /\+ 3|\(0, 3\)|intercept is/ },
];
const perform = (h: WorkspaceHarness, a: Act) => (a.kind === 'plot' ? tapCrossing(h, a.point) : choose(h, a.label));

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('coordinate-graph')!;
  const modes = (entry.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(COORDINATE_MISSES_BY_MODE);
  for (const { mode, item } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'coordinate-graph', pin: mode, objectiveIds: ['o'],
      data: graph([item]) as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: checked by the activity, no key published; a wrong tap names its miss and Try again clears it; the right one completes once',
  async ({ mode, item, wrong, miss, right, secret }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'coordinate-graph', evalMode: mode, data: graph([item]) as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    // The key never reaches the packet: not the pair, the slope or the intercept, nor the hint or the option index.
    const { choices: _c, ...rest } = task.demand as Record<string, unknown>;
    expect(JSON.stringify(rest)).not.toMatch(secret);
    expect(JSON.stringify(h.state().task)).not.toMatch(/correctOptionIndex|hint|answer is/i);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    // Continue and the hint are the tutor's, and the shell's Try again replaces the primitive's own.
    expect(h.view.container.textContent).not.toMatch(/Continue|answer is|Try again!/);

    perform(h, wrong);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
    // Nothing shows the right answer after a wrong tap.
    expect(h.view.container.textContent).not.toMatch(/correct answer is/i);
    // Closed until Try again: a second tap does not count.
    perform(h, right);
    expect(h.state().task!.workspace!.attempts).toHaveLength(1);
    h.dispatch('retry');
    expect(String(h.state().task!.demand.learnerWork)).toMatch(/no point placed yet|nothing chosen yet/);

    perform(h, right);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'coordinate-graph', evalMode: 'plot_point', data: graph([plot]) as unknown as Record<string, unknown> });
  tapCrossing(h, { x: 3, y: -2 });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the intercept item draws its equation with the intercept masked', () => {
  const h = mountWorkspace({ primitiveId: 'coordinate-graph', evalMode: 'find_intercept', data: graph([intercept]) as unknown as Record<string, unknown> });
  expect(maskedEquation(intercept)).toBe('y = 2x + ?');
  expect(h.view.container.textContent).toContain('y = 2x + ?');
  expect(h.view.container.textContent).not.toContain('y = 2x + 3');
  expect(h.state().task!.demand.equation).toBe('a label on the line reads y = 2x + ?');
});

it('the slope item names only what the plane labels', () => {
  const h = mountWorkspace({ primitiveId: 'coordinate-graph', evalMode: 'find_slope',
    data: graph([{ ...slope, showRiseRunLabels: false, showPointLabels: false }]) as unknown as Record<string, unknown> });
  expect(h.state().task!.demand).toMatchObject({ points: 'the two points are not labelled',
    triangle: 'a dashed rise and run triangle is drawn, without numbers', line: 'the line rises from left to right' });
});

it('coordinateMiss names the pattern the point or choice shows', () => {
  const at = (x: number, y: number) => coordinateMiss(plot, { placed: { x, y }, chosen: null });
  expect(at(3, -2)).toBeUndefined();
  expect(at(-2, 3)).toBe('swapped');
  expect(at(-3, 2)).toBe('both_signs');
  expect(at(-3, -2)).toBe('x_sign');
  expect(at(3, 2)).toBe('y_sign');
  expect(at(3, 0)).toBe('one_axis');
  expect(at(4, -2)).toBe('off_by_one');
  expect(at(7, 7)).toBe('wrong_point');
  const pick = (c: CoordinateGraphChallenge, i: number) => coordinateMiss(c, { placed: null, chosen: i });
  expect(pick(read, 2)).toBe('x_sign');
  expect(pick(read, 3)).toBe('y_sign');
  expect(pick(slope, 1)).toBe('opposite_sign');
  expect(pick(slope, 3)).toBe('rise_only');
  expect(pick(intercept, 1)).toBe('opposite_sign');
  expect(pick(intercept, 3)).toBe('point_y');
});

it('the adapter refuses an item its own check cannot read', () => {
  const validate = LIVE_ADAPTERS['coordinate-graph'].validate;
  expect(() => validate(graph([{ ...read, correctOptionIndex: 0 }]))).toThrow();
  expect(() => validate(graph([{ ...slope, option0: '4/6' }]))).toThrow();
  expect(() => validate(graph([{ ...intercept, x2: 2 }]))).toThrow();
  expect(() => validate(graph([{ ...plot, x1: 12 }]))).toThrow();
  expect(validate(graph([plot, read, slope, intercept]))).toBeTruthy();
});
