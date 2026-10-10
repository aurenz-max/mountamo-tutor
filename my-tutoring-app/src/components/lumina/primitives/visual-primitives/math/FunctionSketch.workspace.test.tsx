// @vitest-environment jsdom
/**
 * Function sketch on the teaching workspace: what is its own. The generic W1 contract
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
import type { FunctionSketchChallenge, FunctionSketchData } from './FunctionSketch';
import type { CurvePoint } from './canvas-2d/types';
import {
  EMPTY_WORK, FUNCTION_SKETCH_MISSES_BY_MODE, canvasPixel, familyMiss, functionSketchMiss, revealSketch, sketchScore,
} from './functionSketchWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

/** Taps on the canvas at graph points: one pointer down each, in canvas pixels (as the driver's one-point strokes). */
export function tapGraph(h: WorkspaceHarness, c: FunctionSketchChallenge, points: CurvePoint[]) {
  const canvas = h.view.container.querySelector('canvas[data-pip-object="canvas"]') as HTMLCanvasElement;
  expect(canvas, 'the canvas').toBeTruthy();
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: canvas.width, height: canvas.height,
    right: canvas.width, bottom: canvas.height, x: 0, y: 0, toJSON: () => ({}) });
  for (const p of points) {
    const at = canvasPixel(c, p);
    act(() => { fireEvent.mouseDown(canvas, { clientX: at.x, clientY: at.y }); });
  }
}
const press = (h: WorkspaceHarness, label: string | RegExp) => {
  const button = Array.from(h.view.container.querySelectorAll('button'))
    .find(b => typeof label === 'string' ? (b.textContent ?? '').trim() === label : label.test(b.textContent ?? ''));
  expect(button, `button ${label}`).toBeTruthy();
  act(() => { fireEvent.click(button!); });
};

const sample = (f: (x: number) => number, lo = -3, hi = 3): CurvePoint[] =>
  Array.from({ length: 20 }, (_, i) => { const x = lo + (i * (hi - lo)) / 19; return { x, y: f(x) }; });
const axes = { xLabel: 'x', xMin: -3, xMax: 3, yLabel: 'y', yMin: -6, yMax: 8 };

const classify: FunctionSketchChallenge = { ...axes, id: 'c1', type: 'classify-shape', instruction: 'What type of function is this curve?',
  classifyCurve: sample(x => x * x - 2), options: ['linear', 'quadratic', 'exponential', 'sinusoidal'], correctType: 'quadratic',
  classifyExplanation: 'It is a parabola.' };
const compare: FunctionSketchChallenge = { ...axes, id: 'm1', type: 'compare-functions', instruction: 'Two models are shown.',
  question: 'Which curve grows faster and faster?', curveA: sample(x => x + 1), curveB: sample(x => 2 ** x),
  labelA: 'Model A', labelB: 'Model B', correctCurve: 'B', compareExplanation: 'B is exponential.' };
const identify: FunctionSketchChallenge = { ...axes, id: 'i1', type: 'identify-features', instruction: 'Find the key features of this curve.',
  expression: 'y = 4 - x^2', referenceCurve: sample(x => 4 - x * x),
  features: [{ type: 'root', x: -2, y: 0, label: 'left root', tolerance: 0.36 }, { type: 'maximum', x: 0, y: 4, label: 'top', tolerance: 0.36 },
    { type: 'root', x: 2, y: 0, label: 'right root', tolerance: 0.36 }] };
const sketch: FunctionSketchChallenge = { ...axes, id: 's1', type: 'sketch-match', instruction: 'Sketch the function described.',
  sketchDescription: 'A parabola opening upward', sketchExpression: 'y = x^2 - 4', revealCurve: sample(x => x * x - 4), minPoints: 4,
  keyFeatures: [{ type: 'zero', description: 'left zero', x: -2, y: 0, tolerance: 0.48, weight: 0.25 },
    { type: 'intercept', description: 'y-intercept', x: 0, y: -4, tolerance: 0.48, weight: 0.5 },
    { type: 'zero', description: 'right zero', x: 2, y: 0, tolerance: 0.48, weight: 0.25 }] };
const lesson = (challenges: FunctionSketchChallenge[]): FunctionSketchData => ({ title: 'Function shapes', context: 'Reading graphs', challenges });

const flipped = revealSketch(sketch).map(p => ({ x: p.x, y: -p.y }));
type Act = { kind: 'choose'; label: string } | { kind: 'tap'; points: CurvePoint[] };
type Case = { mode: string; item: FunctionSketchChallenge; wrong: Act; miss: string; right: Act; blank: RegExp; secret: RegExp };
const CASES: Case[] = [
  { mode: 'classify-shape', item: classify, wrong: { kind: 'choose', label: 'linear' }, miss: 'line_for_curve',
    right: { kind: 'choose', label: 'quadratic' }, blank: /nothing chosen yet/, secret: /quadratic|parabola/ },
  { mode: 'compare-functions', item: compare, wrong: { kind: 'choose', label: 'Model A' }, miss: 'other_curve',
    right: { kind: 'choose', label: 'Model B' }, blank: /no curve chosen yet/, secret: /B is|answer is|exponential/ },
  { mode: 'identify-features', item: identify, wrong: { kind: 'tap', points: [{ x: -2, y: 0 }] }, miss: 'missed_extremum',
    right: { kind: 'tap', points: identify.features!.map(f => ({ x: f.x, y: f.y })) }, blank: /found none/, secret: /\(0, 4\)|\(-2, 0\)|\(2, 0\)/ },
  { mode: 'sketch-match', item: sketch, wrong: { kind: 'tap', points: flipped }, miss: 'upside_down',
    right: { kind: 'tap', points: revealSketch(sketch) }, blank: /no points placed yet/, secret: /left zero|y-intercept|\(0, -4\)/ },
];
const perform = (h: WorkspaceHarness, item: FunctionSketchChallenge, a: Act) => {
  if (a.kind === 'choose') press(h, a.label); else tapGraph(h, item, a.points);
  press(h, /Check Answer/);
};

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('function-sketch')!;
  const modes = (entry.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(FUNCTION_SKETCH_MISSES_BY_MODE);
  for (const { mode, item } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'function-sketch', pin: mode, objectiveIds: ['o'],
      data: lesson([item]) as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: checked by the activity, no key published; a wrong check names its miss and Try again clears it; the right one completes once',
  async ({ mode, item, wrong, miss, right, blank, secret }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'function-sketch', evalMode: mode, data: lesson([item]) as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    // The key never reaches the packet: not the family, the curve, a feature's place, or a key feature.
    const { choices: _c, ...rest } = task.demand as Record<string, unknown>;
    expect(JSON.stringify(rest)).not.toMatch(secret);
    expect(JSON.stringify(h.state().task)).not.toMatch(/correctType|correctCurve|keyFeatures|tolerance|explanation|exponential\./i);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    // Next is the runtime's, and the shell's Try again replaces any of the primitive's own.
    expect(h.view.container.textContent).not.toMatch(/Next Challenge|Finish/);

    perform(h, item, wrong);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
    // Nothing shows the right answer after a wrong check.
    expect(h.view.container.textContent).not.toMatch(/correct type is|answer is Curve|green curve/i);
    // Closed until Try again: the choices and Check do not count.
    expect(h.view.container.textContent).not.toMatch(/Check Answer/);
    h.dispatch('retry');
    expect(String(h.state().task!.demand.learnerWork)).toMatch(blank);

    perform(h, item, right);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'function-sketch', evalMode: 'classify-shape', data: lesson([classify]) as unknown as Record<string, unknown> });
  press(h, 'quadratic'); press(h, /Check Answer/);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the misses name what the work shows', () => {
  expect(familyMiss('quadratic', 'linear')).toBe('line_for_curve');
  expect(familyMiss('linear', 'exponential')).toBe('curve_for_line');
  expect(familyMiss('quadratic', 'cubic')).toBe('polynomial_degree');
  expect(familyMiss('exponential', 'quadratic')).toBe('growth_family');
  expect(familyMiss('periodic', 'quadratic')).toBe('periodic_family');
  expect(functionSketchMiss(identify, { ...EMPTY_WORK, found: [0, 1] })).toBe('missed_root');
  expect(functionSketchMiss(identify, { ...EMPTY_WORK, found: [0, 1, 2] })).toBeUndefined();
  expect(sketchScore(sketch, revealSketch(sketch))).toBeGreaterThanOrEqual(60);
  const flat = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map(x => ({ x, y: 6 }));
  expect(functionSketchMiss(sketch, { ...EMPTY_WORK, points: flat })).toBe('missed_intercept');
});

it('the adapter refuses an item its own check cannot read', () => {
  const validate = LIVE_ADAPTERS['function-sketch'].validate;
  expect(() => validate(lesson([{ ...classify, correctType: 'cubic' }]))).toThrow();
  expect(() => validate(lesson([{ ...classify, options: ['quadratic', 'quadratic', 'linear', 'cubic'] }]))).toThrow();
  // A straight line keyed as a curve, and a curve keyed as linear.
  expect(() => validate(lesson([{ ...classify, classifyCurve: sample(x => 2 * x) }]))).toThrow();
  expect(() => validate(lesson([{ ...classify, correctType: 'linear', options: ['linear', 'cubic', 'exponential', 'sinusoidal'] }]))).toThrow();
  expect(() => validate(lesson([{ ...compare, labelB: 'Model A' }]))).toThrow();
  expect(() => validate(lesson([{ ...identify, features: identify.features!.slice(0, 1) }]))).toThrow();
  // Key features off the function's own curve: drawing the answer would be marked wrong.
  expect(() => validate(lesson([{ ...sketch, keyFeatures: sketch.keyFeatures!.map(k => ({ ...k, y: k.y + 5 })) }]))).toThrow();
  expect(validate(lesson([classify, compare, identify, sketch]))).toBeTruthy();
});
