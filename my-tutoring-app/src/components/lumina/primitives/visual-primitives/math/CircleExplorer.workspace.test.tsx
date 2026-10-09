// @vitest-environment jsdom
/**
 * Circle explorer on the teaching workspace: what is its own. The generic W1 contract
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
import type { CircleExplorerChallenge, CircleExplorerData } from './CircleExplorer';
import { CIRCLE_MISSES_BY_MODE, circleMiss } from './circleExplorerWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const box = (h: WorkspaceHarness) => h.view.container.querySelector<HTMLInputElement>('input[aria-label="Your answer"]');
const type = (h: WorkspaceHarness, text: string) => act(() => {
  expect(box(h), 'the answer box').toBeTruthy();
  fireEvent.change(box(h)!, { target: { value: text } });
});
const check = (h: WorkspaceHarness) => h.press('Check');

const base = { narration: 'A bike wheel is shaped like this circle.', hint: 'Use C = 2 × π × r.', unitLabel: 'cm',
  usePiApprox: true, given: 'radius' as const };
const discover: CircleExplorerChallenge = { ...base, id: 'p1', type: 'discover_pi', given: 'diameter', radius: 5,
  instruction: 'Unroll the circumference, then find how many diameters fit around: C ÷ d.', answerKind: 'ratio',
  expectedAnswer: 3.14, tolerance: 0.15 };
const around: CircleExplorerChallenge = { ...base, id: 'c1', type: 'circumference', radius: 7, answerKind: 'length',
  instruction: 'Find the circumference — the distance all the way around.', expectedAnswer: 43.96, tolerance: 0.88 };
const inside: CircleExplorerChallenge = { ...base, id: 'a1', type: 'area', radius: 6, answerKind: 'area',
  instruction: 'Find the area — the amount of space inside the circle.', expectedAnswer: 113.04, tolerance: 2.26 };
const back: CircleExplorerChallenge = { ...base, id: 'r1', type: 'reverse', radius: 7, answerKind: 'length',
  reverseGiven: 'circumference', givenValue: 44, instruction: 'The circumference is given. Work backward to find the radius.',
  expectedAnswer: 7, tolerance: 0.2 };
const half: CircleExplorerChallenge = { ...base, id: 's1', type: 'composite', radius: 6, answerKind: 'area',
  compositeShape: 'semicircle_area', instruction: 'Find the area of this semicircle — half of a full circle.',
  expectedAnswer: 56.52, tolerance: 1.13 };
const lesson = (challenges: CircleExplorerChallenge[]): CircleExplorerData => ({ title: 'Circles', description: '',
  challengeType: challenges[0].type, challenges });

type Case = { mode: string; data: CircleExplorerData; unroll?: boolean; wrong: string; miss: string; right: string; secret: RegExp };
const CASES: Case[] = [
  { mode: 'discover_pi', data: lesson([discover]), unroll: true, wrong: '0.32', miss: 'inverse_ratio', right: '3.14', secret: /3\.14|3\.1\b/ },
  { mode: 'circumference', data: lesson([around]), wrong: '21.98', miss: 'pi_times_radius', right: '43.96', secret: /43\.96|\b44\b/ },
  { mode: 'area', data: lesson([inside]), wrong: '37.68', miss: 'circumference_formula', right: '113.04', secret: /113/ },
  { mode: 'reverse', data: lesson([back]), wrong: '14', miss: 'diameter_not_radius', right: '7', secret: /\b7\b/ },
  { mode: 'composite', data: lesson([half]), wrong: '113.04', miss: 'whole_circle', right: '56.52', secret: /56\.5/ },
];

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('circle-explorer')!;
  const modes = (entry.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(CIRCLE_MISSES_BY_MODE);
  for (const { mode, data } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'circle-explorer', pin: mode, objectiveIds: ['o'],
      data: data as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: checked by the activity, no key published; a wrong check names its miss and Try again clears it; the right one completes once',
  async ({ mode, data, unroll, wrong, miss, right, secret }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'circle-explorer', evalMode: mode, data: data as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(task.demand)).not.toMatch(secret);
    expect(JSON.stringify(h.state().task)).not.toMatch(/expectedAnswer|hint|tolerance/i);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    // The hint and Next are the tutor's.
    expect(h.view.container.textContent).not.toMatch(/Show hint|Next Circle/);
    expect(h.view.container.textContent).not.toMatch(secret);

    if (unroll) {
      expect(box(h)!.disabled, 'discover π waits for the unroll').toBe(true);
      h.press('Unroll the circumference');
      expect(String(h.state().task!.demand.learnerWork)).toMatch(/^unrolled the circumference/);
      expect(h.view.container.textContent).not.toMatch(secret);
    }
    type(h, wrong); check(h);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
    expect(JSON.stringify(h.state().task!.demand)).not.toMatch(secret);
    expect(h.view.container.textContent).not.toMatch(secret);
    // Input is closed until Try again.
    expect(box(h)!.disabled).toBe(true);
    h.dispatch('retry');
    expect(String(h.state().task!.demand.learnerWork)).toMatch(/nothing typed yet/);
    expect(box(h)!.disabled).toBe(false);

    type(h, right); check(h);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'circle-explorer', evalMode: 'circumference', data: lesson([around]) as unknown as Record<string, unknown> });
  type(h, '43.96'); check(h);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the tutor is told what the figure prints, the answer box and its unit, never the answer', () => {
  const h = mountWorkspace({ primitiveId: 'circle-explorer', evalMode: 'reverse', data: lesson([back]) as unknown as Record<string, unknown> });
  expect(h.state().task!.demand).toMatchObject({ figure: 'a circle labelled C = 44 cm; a dashed radius labelled r = ?',
    answerBox: 'r = [box] cm', learnerWork: 'nothing typed yet' });
  cleanup();
  const hard = { ...around, given: 'diameter' as const, showFormulaReveal: false };
  const g = mountWorkspace({ primitiveId: 'circle-explorer', evalMode: 'circumference', data: lesson([hard]) as unknown as Record<string, unknown> });
  expect(String(g.state().task!.demand.figure)).toMatch(/diameter drawn across and labelled d = 14 cm/);
  expect(String(g.state().task!.demand.formulaLabels)).toMatch(/^withheld/);
});

it('circleMiss names the pattern the number shows', () => {
  const w = (typed: string) => ({ typed, unrolled: true, sliced: false });
  expect(circleMiss(discover, w('3.14'))).toBeUndefined();
  expect(circleMiss(discover, w('3'))).toBeUndefined();
  expect(circleMiss(discover, w('31.4'))).toBe('typed_length');
  expect(circleMiss(around, w('21.98'))).toBe('pi_times_radius');
  expect(circleMiss(around, w('153.86'))).toBe('area_formula');
  expect(circleMiss(around, w('14'))).toBe('no_pi');
  expect(circleMiss({ ...around, given: 'diameter' }, w('87.92'))).toBe('two_pi_times_diameter');
  expect(circleMiss(inside, w('18.84'))).toBe('pi_times_radius');
  expect(circleMiss(inside, w('452.16'))).toBe('diameter_squared');
  expect(circleMiss(inside, w('36'))).toBe('no_pi');
  expect(circleMiss(back, w('22'))).toBe('divided_by_two_only');
  const fromArea = { ...back, reverseGiven: 'area' as const, givenValue: 153.86 };
  expect(circleMiss(fromArea, w('49'))).toBe('no_square_root');
  expect(circleMiss(fromArea, w('12.4'))).toBe('no_pi_divide');
  expect(circleMiss(half, w('226.08'))).toBe('diameter_as_radius');
  const rim = { ...half, compositeShape: 'semicircle_perimeter' as const, answerKind: 'length' as const, expectedAnswer: 30.84, tolerance: 0.62 };
  expect(circleMiss(rim, w('18.84'))).toBe('curve_only');
  expect(circleMiss(rim, w('24.84'))).toBe('radius_edge');
  const square = { ...half, compositeShape: 'circle_in_square' as const, radius: 5, squareSide: 10, expectedAnswer: 21.5, tolerance: 0.5 };
  expect(circleMiss(square, w('78.5'))).toBe('circle_area');
  expect(circleMiss(square, w('100'))).toBe('square_area');
  expect(circleMiss(square, w('178.5'))).toBe('added');
  expect(circleMiss(around, w('42'))).toBe('near_miss');
  expect(circleMiss(around, w('300'))).toBe('too_high');
});

it('the adapter refuses an item its own check cannot read', () => {
  const validate = LIVE_ADAPTERS['circle-explorer'].validate;
  expect(() => validate(lesson([{ ...back, givenValue: undefined }]))).toThrow();
  expect(() => validate(lesson([{ ...half, compositeShape: undefined }]))).toThrow();
  expect(validate(lesson([discover, around, inside, back, half]))).toBeTruthy();
});
