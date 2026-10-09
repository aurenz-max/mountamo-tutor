// @vitest-environment jsdom
/**
 * Ratio table on the teaching workspace: what is its own. The generic W1 contract
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
import type { RatioTableChallenge, RatioTableData } from './RatioTable';
import { RATIO_MISSES_BY_MODE, buildRatioAsk, ratioMiss } from './ratioTableWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const input = (h: WorkspaceHarness, label: string) => h.view.container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
const type = (h: WorkspaceHarness, text: string) => act(() => {
  expect(input(h, 'Your answer'), 'the answer box').toBeTruthy();
  fireEvent.change(input(h, 'Your answer')!, { target: { value: text } });
});
const slide = (h: WorkspaceHarness, value: number) => act(() => {
  expect(input(h, 'Multiplier'), 'the slider').toBeTruthy();
  fireEvent.change(input(h, 'Multiplier')!, { target: { value: String(value) } });
});
const check = (h: WorkspaceHarness) => h.press('Check Answer');

const base = { hint: 'Multiply by 3: the answer is 36.', rowLabels: ['Cups of Flour', 'Cookies'] as [string, string] };
const missing: RatioTableChallenge = { ...base, id: 'm1', type: 'missing-value', baseRatio: [2, 12], targetMultiplier: 3,
  hiddenValue: 'scaled-second', instruction: 'If 2 cups make 12 cookies, how many cookies do 6 cups make?' };
const find: RatioTableChallenge = { ...base, id: 'f1', type: 'find-multiplier', baseRatio: [4, 10], targetMultiplier: 2.5,
  instruction: 'A recipe for 4 cups makes 10 cookies. A bigger batch uses 10 cups and makes 25 cookies. What multiplier was used?' };
const rate: RatioTableChallenge = { ...base, id: 'u1', type: 'unit-rate', baseRatio: [6, 48], targetMultiplier: 1,
  instruction: '6 cups make 48 cookies. How many cookies per cup?' };
const build: RatioTableChallenge = { ...base, id: 'b1', type: 'build-ratio', baseRatio: [3, 12], targetMultiplier: 4,
  instruction: buildRatioAsk({ baseRatio: [3, 12], rowLabels: base.rowLabels, targetMultiplier: 4 }) };
const table = (challenges: RatioTableChallenge[]): RatioTableData => ({ title: 'Ratios', description: '', challenges,
  showUnitRate: true, showBarChart: true, maxMultiplier: 10 });

type Step = { type: string } | { slide: number };
type Case = { mode: string; data: RatioTableData; wrong: Step; miss: string; right: Step; secret: RegExp; cleared: RegExp };
const CASES: Case[] = [
  { mode: 'missing_value', data: table([missing]), wrong: { type: '16' }, miss: 'added_difference', right: { type: '36' },
    secret: /\b36\b/, cleared: /nothing typed yet/ },
  { mode: 'find_multiplier', data: table([find]), wrong: { type: '6' }, miss: 'difference', right: { type: '2.5' },
    secret: /×2\.5|\b2\.5\b/, cleared: /nothing typed yet/ },
  { mode: 'unit_rate', data: table([rate]), wrong: { type: '0.125' }, miss: 'inverse_rate', right: { type: '8' },
    secret: /\b8\b/, cleared: /nothing typed yet/ },
  { mode: 'build_ratio', data: table([build]), wrong: { slide: 5 }, miss: 'one_step_off', right: { slide: 4 },
    secret: /×4\b/, cleared: /slider is at ×1,/ },
];
const perform = (h: WorkspaceHarness, s: Step) => {
  if ('type' in s) type(h, s.type); else slide(h, s.slide);
  check(h);
};

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('ratio-table')!;
  const modes = (entry.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(RATIO_MISSES_BY_MODE);
  for (const { mode, data } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'ratio-table', pin: mode, objectiveIds: ['o'],
      data: data as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: checked by the activity, no key published; a wrong check names its miss and Try again clears it; the right one completes once',
  async ({ mode, data, wrong, miss, right, secret, cleared }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'ratio-table', evalMode: mode, data: data as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(task.demand)).not.toMatch(secret);
    expect(JSON.stringify(h.state().task)).not.toMatch(/targetMultiplier|hint|answer is/i);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    // The hint and Next are the tutor's.
    expect(h.view.container.textContent).not.toMatch(/Hint \(|Next Challenge|answer is/);
    expect(h.view.container.textContent).not.toMatch(secret);

    perform(h, wrong);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
    expect(JSON.stringify(h.state().task!.demand)).not.toMatch(secret);
    // Input is closed until Try again.
    const open = Array.from(h.view.container.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button'))
      .filter(el => !el.disabled && /Your answer|Multiplier|Check Answer/.test((el.getAttribute('aria-label') ?? '') + el.textContent));
    expect(open).toEqual([]);
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
  const h = mountWorkspace({ primitiveId: 'ratio-table', evalMode: 'missing_value', data: table([missing]) as unknown as Record<string, unknown> });
  type(h, '36'); check(h);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the tutor is told what is drawn: both columns with the hidden cell as ?, the aids, never the answer', () => {
  const h = mountWorkspace({ primitiveId: 'ratio-table', evalMode: 'missing_value',
    data: { ...table([missing]), showBarChart: false } as unknown as Record<string, unknown> });
  expect(h.state().task!.demand).toMatchObject({ baseColumn: '2 Cups of Flour to 12 Cookies', scaledColumn: '×3: 6 Cups of Flour, ? Cookies',
    aids: 'a unit-rate banner showing how many Cookies per 1 Cups of Flour; no bar chart', learnerWork: 'nothing typed yet' });
});

it('a missing value whose hidden row starts at 1 hides the multiplier, which would be the answer; so does the banner on a multiplier equal to the rate', () => {
  const one: RatioTableChallenge = { ...missing, id: 'm2', baseRatio: [1, 12], targetMultiplier: 4, hiddenValue: 'scaled-first',
    instruction: '1 cup makes 12 cookies. How many cups make 48 cookies?' };
  const h = mountWorkspace({ primitiveId: 'ratio-table', evalMode: 'missing_value', data: table([one]) as unknown as Record<string, unknown> });
  expect(h.view.container.textContent).toMatch(/Scaled ×\?/);
  expect(h.view.container.textContent).not.toMatch(/Scaled ×4/);
  expect(h.state().task!.demand.scaledColumn).toBe('×?: ? Cups of Flour, 48 Cookies');
  cleanup();
  const same: RatioTableChallenge = { ...find, id: 'f2', baseRatio: [2, 6], targetMultiplier: 3 };
  const g = mountWorkspace({ primitiveId: 'ratio-table', evalMode: 'find_multiplier', data: table([same]) as unknown as Record<string, unknown> });
  expect(g.view.container.textContent).not.toMatch(/Unit Rate:/);
  expect(g.state().task!.demand.aids).toMatch(/no unit-rate banner/);
});

it('ratioMiss names the pattern the number or the slider shows', () => {
  const w = (typed: string, multiplier = 1) => ({ typed, multiplier });
  expect(ratioMiss(missing, w('36'))).toBeUndefined();
  expect(ratioMiss(missing, w('16'))).toBe('added_difference');
  expect(ratioMiss(missing, w('12'))).toBe('unscaled');
  expect(ratioMiss(missing, w('6'))).toBe('copied_known');
  expect(ratioMiss(missing, w('3'))).toBe('multiplier');
  expect(ratioMiss(missing, w('35'))).toBe('near_miss');
  expect(ratioMiss(missing, w('90'))).toBe('too_high');
  expect(ratioMiss(find, w('6'))).toBe('difference');
  expect(ratioMiss(find, w('10'))).toBe('scaled_value');
  expect(ratioMiss(find, w('0.4'))).toBe('inverse');
  expect(ratioMiss(rate, w('0.125'))).toBe('inverse_rate');
  expect(ratioMiss(rate, w('42'))).toBe('difference');
  expect(ratioMiss(rate, w('48'))).toBe('typed_quantity');
  expect(ratioMiss(build, w('', 3))).toBe('one_step_off');
  expect(ratioMiss(build, w('', 3.8))).toBe('near_miss');
  expect(ratioMiss(build, w('', 8))).toBe('too_high');
});

it('the adapter refuses an item its own check cannot read', () => {
  const validate = LIVE_ADAPTERS['ratio-table'].validate;
  expect(() => validate(table([{ ...missing, baseRatio: [0, 12] }]))).toThrow();
  expect(() => validate(table([{ ...build, targetMultiplier: 14 }]))).toThrow();
  expect(validate(table([missing, find, rate, build]))).toBeTruthy();
});

it('the build ask names the scaled value to reach, never the multiplier', () => {
  expect(build.instruction).toBe('The base ratio is 3 to 12 (Cups of Flour to Cookies). Move the slider to build an equivalent ratio where Cookies is 48.');
  expect(buildRatioAsk({ baseRatio: [4, 25], rowLabels: ['A', 'B'], targetMultiplier: 3.5 })).not.toMatch(/3\.5/);
});
