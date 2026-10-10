// @vitest-environment jsdom
/** function-sketch's levers on the teaching workspace (`functionSketchLevers.ts`). */
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
import type { FunctionSketchChallenge, FunctionSketchData } from './FunctionSketch';
import type { CurvePoint } from './canvas-2d/types';
import { canvasPixel, revealSketch } from './functionSketchWorkspace';
import { sample } from './functionSketchLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });
const press = (h: WorkspaceHarness, label: string | RegExp) => {
  const b = q(h, 'button').find(x => typeof label === 'string' ? (x.textContent ?? '').trim() === label : label.test(x.textContent ?? ''));
  expect(b, String(label)).toBeTruthy();
  act(() => { fireEvent.click(b!); });
};
function tap(h: WorkspaceHarness, c: FunctionSketchChallenge, points: CurvePoint[]) {
  const canvas = h.view.container.querySelector('canvas[data-pip-object="canvas"]') as HTMLCanvasElement;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: canvas.width, height: canvas.height,
    right: canvas.width, bottom: canvas.height, x: 0, y: 0, toJSON: () => ({}) });
  for (const p of points) { const at = canvasPixel(c, p); act(() => { fireEvent.mouseDown(canvas, { clientX: at.x, clientY: at.y }); }); }
}
/** Visible text, one node per word boundary. */
const screen = (h: WorkspaceHarness) => {
  const walker = document.createTreeWalker(h.view.container, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n.textContent ?? '');
  return parts.join(' ');
};

const axes = { xLabel: 'x', xMin: -3, xMax: 3, yLabel: 'y', yMin: -6, yMax: 8 };
const classify: FunctionSketchChallenge = { ...axes, id: 'c1', type: 'classify-shape', instruction: 'What type of function is this curve?',
  classifyCurve: sample(x => x * x - 2, -3, 3), options: ['linear', 'quadratic', 'exponential', 'sinusoidal'], correctType: 'quadratic' };
const compare: FunctionSketchChallenge = { ...axes, id: 'm1', type: 'compare-functions', instruction: 'Two models are shown.',
  question: 'Which curve grows faster and faster?', curveA: sample(x => x + 1, -3, 3), curveB: sample(x => 2 ** x, -3, 3),
  labelA: 'Model A', labelB: 'Model B', correctCurve: 'B' };
const identify: FunctionSketchChallenge = { ...axes, id: 'i1', type: 'identify-features', instruction: 'Find the key features of this curve.',
  expression: 'y = 4 - x^2', referenceCurve: sample(x => 4 - x * x, -3, 3), showFeatureHints: false, showFeatureLabels: false,
  features: [{ type: 'root', x: -2, y: 0, label: 'left root', tolerance: 0.36 }, { type: 'maximum', x: 0, y: 4, label: 'top', tolerance: 0.36 }] };
const sketch: FunctionSketchChallenge = { ...axes, id: 's1', type: 'sketch-match', instruction: 'Sketch the function described.',
  sketchExpression: 'y = x^2 - 4', revealCurve: sample(x => x * x - 4, -3, 3), minPoints: 4,
  keyFeatures: [{ type: 'zero', description: '', x: -2, y: 0, tolerance: 0.48, weight: 0.25 },
    { type: 'intercept', description: '', x: 0, y: -4, tolerance: 0.48, weight: 0.5 }, { type: 'zero', description: '', x: 2, y: 0, tolerance: 0.48, weight: 0.25 }] };
const lesson = (c: FunctionSketchChallenge): FunctionSketchData => ({ title: 'Function shapes', context: 'Reading graphs', challenges: [c] });
const mount = (c: FunctionSketchChallenge) => {
  const h = mountWorkspace({ primitiveId: 'function-sketch', evalMode: c.type, data: lesson(c) as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};
const flipped = revealSketch(sketch).map(p => ({ x: p.x, y: -p.y }));

it('identify, hard tier: the guide shows in the same commit; the next attempt records the lever; a repeat pull changes nothing', () => {
  const h = mount(identify);
  expect(levers(h)).toEqual([['feature_guide', false], ['axis_glow', false], ['feature_names', false], ['model_features', false],
    ['simpler_item', false]]);
  tap(h, identify, [{ x: -2, y: 0 }]); press(h, /Check Answer/);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'missed_extremum' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'missed_extremum')).toBe('feature_guide');
  const receipt = h.dispatch('pull_lever', { lever: 'feature_guide' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/a maximum or minimum is where it turns/);
  expect(q(h, '[data-lever="feature-guide"]')).toHaveLength(1);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'feature_guide' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  // The names lever names kinds in the list, never places.
  expect(h.dispatch('pull_lever', { lever: 'feature_names' }).status).toBe('committed');
  expect(q(h, '.text-xs').map(b => b.textContent).join(' ')).toMatch(/root.*maximum/);
  h.dispatch('retry');
  tap(h, identify, [{ x: -2, y: 0 }, { x: 0, y: 4 }]); press(h, /Check Answer/);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'i1', correct: true, levers: ['feature_guide', 'feature_names'] });
});

it('every help lever draws without the key, on every mode', () => {
  for (const [c, wrong, key] of [
    [classify, () => press(mountH, 'linear'), /quadratic/g],
    [compare, () => press(mountH, 'Model A'), /Model B/g],
    [sketch, () => tap(mountH, sketch, flipped), /\(0, -4\)|x = ±?2/g],
  ] as Array<[FunctionSketchChallenge, () => void, RegExp]>) {
    mountH = mount(c);
    wrong(); press(mountH, /Check Answer/);
    const count = (s: string) => (s.match(key) ?? []).length;
    const before = screen(mountH);
    const factsBefore = JSON.stringify(mountH.state().task!.demand);
    for (const l of mountH.state().task!.workspace!.levers!.filter(x => x.kind === 'help'))
      expect(mountH.dispatch('pull_lever', { lever: l.id }).status, `${c.id} ${l.id}`).toBe('committed');
    // A gallery names every choice once more, the key among them, so it singles none out.
    const grew = count(screen(mountH)) - count(before);
    const options = c.options ?? [];
    expect(grew, `${c.id}: ${screen(mountH)}`).toBe(options.length ? 1 : 0);
    for (const o of options) expect((screen(mountH).match(new RegExp(o, 'g')) ?? []).length - (before.match(new RegExp(o, 'g')) ?? []).length).toBe(1);
    expect(count(JSON.stringify(mountH.state().task!.demand)) - count(factsBefore), c.id).toBe(options.length ? 1 : 0);
    cleanup();
  }
});
let mountH: WorkspaceHarness;

it('the levers draw what they say', () => {
  const h = mount(classify);
  press(h, 'linear'); press(h, /Check Answer/);
  for (const id of ['family_gallery', 'turn_marks', 'equal_steps']) expect(h.dispatch('pull_lever', { lever: id }).status, id).toBe('committed');
  expect(q(h, '[data-lever="family-gallery"] figcaption').map(f => f.textContent)).toEqual(classify.options);
  expect(q(h, '[data-lever="family-gallery"] path').length).toBe(4);
  expect(q(h, '[data-lever="turn-marks"]')).toHaveLength(1);
  expect(q(h, '[data-lever="equal-steps"]')).toHaveLength(1);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/staircase of equal steps/);
  cleanup();
  const g = mount(sketch);
  tap(g, sketch, flipped); press(g, /Check Answer/);
  expect(attempts(g).at(-1)).toMatchObject({ correct: false, miss: 'upside_down' });
  expect(g.dispatch('pull_lever', { lever: 'flip_model' }).status).toBe('committed');
  expect(q(g, '[data-lever="flip-model"] figcaption').map(f => f.textContent)).toEqual(['y = x² opens up', 'y = -x² opens down']);
});

it('the simpler item is ungraded practice of the same kind; the full item comes back blank and is credited after', () => {
  const h = mount(classify);
  press(h, 'linear'); press(h, /Check Answer/);
  const r = h.dispatch('pull_lever', { lever: 'simpler_item' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('c1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'c1' });
  expect(r.state.task!.task).toBe('Practice first: which family does this curve belong to?');
  // Two far choices, neither the item's key.
  const choices = String(r.state.task!.demand.choices);
  expect(choices).not.toMatch(/quadratic/);
  press(h, 'linear'); press(h, /Check Answer/);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('c1');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'nothing chosen yet' });
  press(h, 'quadratic'); press(h, /Check Answer/);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['c1', false, false], ['c1~simpler', true, true], ['c1', true, false]]);
});
