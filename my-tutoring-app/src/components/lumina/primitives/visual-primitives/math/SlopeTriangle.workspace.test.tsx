// @vitest-environment jsdom
/**
 * Slope triangle on the teaching workspace: what is its own. The generic W1 contract
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
import type { SlopeTriangleChallenge, SlopeTriangleData } from './SlopeTriangle';
import { SLOPE_TRIANGLE_MISSES_BY_MODE, emptyWork, lineLabel, slopeTriangleMiss } from './slopeTriangleWorkspace';

beforeEach(() => { installRuntimeTimers(); vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const write = (h: WorkspaceHarness, label: string, text: string) => {
  const input = h.view.container.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
  expect(input, label).toBeTruthy();
  act(() => { fireEvent.change(input, { target: { value: text } }); });
};
const press = (h: WorkspaceHarness, label: string) => {
  const b = Array.from(h.view.container.querySelectorAll('button'))
    .find(x => (x.textContent ?? '').trim() === label || x.getAttribute('aria-label') === label);
  expect(b, label).toBeTruthy();
  act(() => { fireEvent.click(b!); });
};

const line = (slope: number, yIntercept: number, label: string) => ({ equation: label, slope, yIntercept, label });
const tri = (x: number, size: number, labels = false) => ({ position: { x, y: 0 }, size, showMeasurements: labels, showSlope: true,
  showAngle: false, notation: 'riseRun' as const });
const identify: SlopeTriangleChallenge = { id: 'i1', type: 'identify_slope', attachedLine: line(2, 1, 'y = 2x + 1'), triangle: tri(-1, 3),
  expectedRise: 6, expectedRun: 3, expectedSlope: 2, instruction: 'Look at the triangle on the line. Count the rise (vertical) and run (horizontal).',
  hint: 'The rise is 6.' };
const calculate: SlopeTriangleChallenge = { id: 'c1', type: 'calculate', attachedLine: line(-2 / 3, 2, 'y = -0.67x + 2'),
  triangle: { ...tri(0, 6, true), notation: 'deltaNotation' }, expectedRise: -4, expectedRun: 6, expectedSlope: -2 / 3,
  instruction: 'Use the triangle to calculate the slope of this line. Slope = rise ÷ run.', hint: '' };
const draw: SlopeTriangleChallenge = { id: 'd1', type: 'draw_triangle', attachedLine: line(-1, 2, 'y = -x + 2'),
  triangle: { ...tri(-2, 1), notation: 'deltaNotation', showSlope: false }, expectedRise: -3, expectedRun: 3, expectedSlope: -1,
  instruction: 'Drag the base point and resize the triangle so it sits on the line and reveals the slope.', hint: 'The rise will be -3.' };
const lesson = (challenges: SlopeTriangleChallenge[]): SlopeTriangleData => ({ title: 'Slope triangles', description: '',
  xRange: [-10, 10], yRange: [-10, 10], challenges });

type Step = [kind: 'write' | 'press', label: string, text?: string];
type Case = { mode: string; item: SlopeTriangleChallenge; wrong: Step[]; miss: string; right: Step[]; secret: RegExp; cleared: RegExp };
const CASES: Case[] = [
  { mode: 'identify_slope', item: identify, wrong: [['write', 'Rise', '3'], ['write', 'Run', '6']], miss: 'swapped',
    right: [['write', 'Rise', '6'], ['write', 'Run', '3']], secret: /rise (is |= )?6|\b2x|rise is/i, cleared: /nothing typed yet/ },
  { mode: 'calculate', item: calculate, wrong: [['write', 'Slope', '-3/2']], miss: 'reciprocal',
    right: [['write', 'Slope', '-2/3']], secret: /-2\/3|-0\.67|slope is/i, cleared: /nothing typed yet/ },
  // A build has no target on screen: the wrong triangle rises where the line falls; the right one is any run with its rise
  // (here run 2, rise -2, not the generated example's run 3).
  { mode: 'draw_triangle', item: draw, wrong: [['press', 'Longer run'], ['press', 'Longer run'], ['press', 'Higher rise'], ['press', 'Higher rise'],
    ['press', 'Higher rise']], miss: 'wrong_sign',
    right: [['press', 'Longer run'], ['press', 'Lower rise'], ['press', 'Lower rise']], secret: /rise (is |= )?-3|rise will be|target/i,
    cleared: /with run 1 and rise 0,/ },
];
const perform = (h: WorkspaceHarness, steps: Step[]) => {
  for (const [kind, label, text] of steps) (kind === 'write' ? write(h, label, text!) : press(h, label));
  press(h, 'Check');
};

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('slope-triangle')!;
  const modes = (entry.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(SLOPE_TRIANGLE_MISSES_BY_MODE);
  for (const { mode, item } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'slope-triangle', pin: mode, objectiveIds: ['o'],
      data: lesson([item]) as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: checked by the activity, no key published; a wrong check names its miss and Try again clears it; the right one completes once',
  async ({ mode, item, wrong, miss, right, secret, cleared }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'slope-triangle', evalMode: mode, data: lesson([item]) as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    // The key never reaches the packet: not the rise, the run (unless the ask states it) or the slope, nor the hint.
    expect(JSON.stringify(task.demand)).not.toMatch(secret);
    expect(JSON.stringify(h.state().task)).not.toMatch(/expectedRise|expectedSlope|hint/i);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    // Next and the hint are the tutor's and the shell's.
    expect(h.view.container.textContent).not.toMatch(/Next Triangle|Show hint/);

    perform(h, wrong);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
    expect(h.view.container.textContent).not.toMatch(secret);
    // Closed until Try again: the controls are off and a second check does not count.
    perform(h, mode === 'draw_triangle' ? [] : right);
    expect(h.state().task!.workspace!.attempts).toHaveLength(1);
    h.dispatch('retry');
    expect(String(h.state().task!.demand.learnerWork)).toMatch(cleared);

    perform(h, right);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'slope-triangle', evalMode: 'calculate', data: lesson([calculate]) as unknown as Record<string, unknown> });
  perform(h, [['write', 'Slope', '-4/6']]);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the line label masks the slope where the item asks for it', () => {
  expect(lineLabel(identify)).toBe('y = ?x + 1');
  expect(lineLabel(calculate)).toBe('y = ?x + 2');
  expect(lineLabel(draw)).toBe('y = -x + 2');
  const h = mountWorkspace({ primitiveId: 'slope-triangle', evalMode: 'calculate', data: lesson([calculate]) as unknown as Record<string, unknown> });
  expect(h.view.container.textContent).toContain('y = ?x + 2');
  expect(h.view.container.textContent).not.toContain('-0.67');
  expect(h.state().task!.demand.triangle).toBe('the triangle\'s legs are labelled Δy = -4 and Δx = 6');
});

it('slopeTriangleMiss names the pattern the work shows', () => {
  const legs = (rise: string, run: string) => slopeTriangleMiss(identify, { ...emptyWork(identify), rise, run });
  expect(legs('6', '3')).toBeUndefined();
  expect(legs('3', '6')).toBe('swapped');
  expect(legs('-6', '3')).toBe('rise_sign');
  expect(legs('6', '-3')).toBe('run_sign');
  expect(legs('2', '1')).toBe('same_ratio');
  expect(legs('5', '3')).toBe('rise_off');
  expect(legs('6', '4')).toBe('run_off');
  expect(legs('9', '9')).toBe('wrong_legs');
  expect(legs('', '3')).toBeUndefined();
  const slope = (s: string) => slopeTriangleMiss(calculate, { ...emptyWork(calculate), slope: s });
  expect(slope('-2/3')).toBeUndefined();
  expect(slope('-4/6')).toBeUndefined();
  expect(slope('2/3')).toBe('opposite_sign');
  expect(slope('-3/2')).toBe('reciprocal');
  expect(slope('3/2')).toBe('negative_reciprocal');
  expect(slope('-4')).toBe('rise_only');
  expect(slope('6')).toBe('run_only');
  expect(slope('5')).toBe('wrong_slope');
  // The line y = -x + 2: any run with the same rise downward fits.
  const built = (size: number, top: number) => slopeTriangleMiss(draw, { ...emptyWork(draw), size, top });
  expect(built(3, -3)).toBeUndefined();
  expect(built(5, -5)).toBeUndefined();
  expect(built(3, 0)).toBe('flat');
  expect(built(3, 3)).toBe('wrong_sign');
  expect(built(3, -2)).toBe('rise_off');
  expect(built(3, -6)).toBe('wrong_ratio');
  const half = { ...draw, attachedLine: line(0.5, 1, 'y = 0.5x + 1'), expectedRise: 2, expectedRun: 4, expectedSlope: 0.5 };
  expect(slopeTriangleMiss(half, { ...emptyWork(half), size: 2, top: 4 })).toBe('swapped');
  expect(slopeTriangleMiss(half, { ...emptyWork(half), size: 6, top: 3 })).toBeUndefined();
  expect(slopeTriangleMiss(half, { ...emptyWork(half), size: 3, top: 2 })).toBe('wrong_ratio');
});

it('the adapter refuses an item its own check cannot read', () => {
  const validate = LIVE_ADAPTERS['slope-triangle'].validate;
  expect(() => validate(lesson([{ ...identify, expectedRise: 5 }]))).toThrow();
  expect(() => validate(lesson([{ ...identify, triangle: tri(-1, 3, true) }]))).toThrow();
  expect(() => validate(lesson([{ ...calculate, triangle: { ...calculate.triangle, size: 4 } }]))).toThrow();
  expect(() => validate(lesson([{ ...draw, expectedRun: 9 }]))).toThrow();
  // A half-step rise (a 3/2 line with run 5) cannot be counted off the grid.
  expect(() => validate(lesson([{ ...calculate, attachedLine: line(1.5, 1, 'y = 1.5x + 1'), expectedSlope: 1.5, expectedRise: 7.5,
    expectedRun: 5, triangle: { ...calculate.triangle, size: 5 } }]))).toThrow();
  expect(validate(lesson([identify, calculate, draw]))).toBeTruthy();
});
