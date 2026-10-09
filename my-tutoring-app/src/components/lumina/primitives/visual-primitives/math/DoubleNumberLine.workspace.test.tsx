// @vitest-environment jsdom
/**
 * Double number line on the teaching workspace: what is its own. The generic W1 contract
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
import type { DoubleNumberLineChallenge, DoubleNumberLineData } from './DoubleNumberLine';
import { RATIO_LINE_MISSES_BY_MODE, ratioLineMiss } from './doubleNumberLineWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const LABEL = (top: number) => `Cookies when Cups is ${top}`;
const type = (h: WorkspaceHarness, top: number, text: string) => act(() => {
  const input = h.view.container.querySelector<HTMLInputElement>(`input[aria-label="${LABEL(top)}"]`);
  expect(input, 'the answer box').toBeTruthy();
  fireEvent.change(input!, { target: { value: text } });
});
const check = (h: WorkspaceHarness) => h.press('Check Answer');

const scales = { topScale: { min: 0, max: 8, interval: 1 }, bottomScale: { min: 0, max: 24, interval: 3 } };
const ORIGIN = { topValue: 0, bottomValue: 0, label: 'Start' };
const equivalent: DoubleNumberLineChallenge = { id: 'e1', challengeType: 'equivalent_ratios', ...scales,
  prompt: 'The unit rate is 1 Cups = 3 Cookies. Use it to find Cookies when Cups = 5.', hint: 'Multiply 5 × 3 (the unit rate).',
  givenPoints: [ORIGIN, { topValue: 1, bottomValue: 3, label: 'Unit Rate' }], targetPoints: [{ topValue: 5, bottomValue: 15, label: 'Find for 5' }] };
const missing: DoubleNumberLineChallenge = { id: 'm1', challengeType: 'find_missing', ...scales,
  prompt: 'Given 2 Cups = 6 Cookies, find Cookies when Cups = 7.', hint: 'First find the unit rate: 6 ÷ 2 = 3. Then multiply by 7.',
  givenPoints: [ORIGIN, { topValue: 2, bottomValue: 6, label: 'Given' }], targetPoints: [{ topValue: 7, bottomValue: 21, label: 'Find for 7' }] };
const rate: DoubleNumberLineChallenge = { id: 'u1', challengeType: 'unit_rate', ...scales,
  prompt: 'Given 4 Cups = 12 Cookies, find the unit rate: when Cups = 1, what is Cookies?', hint: 'Divide: 12 ÷ 4.',
  givenPoints: [ORIGIN, { topValue: 4, bottomValue: 12, label: 'Given' }], targetPoints: [{ topValue: 1, bottomValue: 3, label: 'Unit Rate' }] };
const line = (challenges: DoubleNumberLineChallenge[]): DoubleNumberLineData => ({ title: 'Baking', description: 'Cups to cookies.',
  topLabel: 'Cups', bottomLabel: 'Cookies', unitRate: 3, contextQuestion: 'A recipe turns cups of flour into cookies.', challenges });

type Case = { mode: string; data: DoubleNumberLineData; top: number; wrong: string; miss: string; right: string; secret: RegExp };
const CASES: Case[] = [
  { mode: 'equivalent_ratios', data: line([equivalent]), top: 5, wrong: '8', miss: 'added_rate', right: '15', secret: /\b15\b/ },
  { mode: 'find_missing', data: line([missing]), top: 7, wrong: '11', miss: 'added_difference', right: '21', secret: /\b21\b|\b3 Cookies\b|÷/ },
  { mode: 'unit_rate', data: line([rate]), top: 1, wrong: '12', miss: 'gave_given', right: '3', secret: /= 3\b|\b3 Cookies|÷/ },
];

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('double-number-line')!;
  const modes = (entry.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(RATIO_LINE_MISSES_BY_MODE);
  for (const { mode, data } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'double-number-line', pin: mode, objectiveIds: ['o'],
      data: data as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: the typed value checked by the activity, no key published; a wrong one names its miss and Try again clears the box; the right one completes once',
  async ({ mode, data, top, wrong, miss, right, secret }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'double-number-line', evalMode: mode, data: data as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(task.demand)).not.toMatch(secret);
    expect(JSON.stringify(h.state().task)).not.toMatch(/bottomValue|unitRate|hint/i);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    // The hint (it names the operation and numbers) and Next are the tutor's; no bottom tick prints the answer.
    expect(h.view.container.textContent).not.toMatch(/Multiply|Divide|First find|Next Challenge/);
    const bottomLine = h.view.container.querySelectorAll('.relative.h-1')[1];
    const bottomTicks = Array.from(bottomLine.querySelectorAll('span.font-mono')).map(s => s.textContent);
    expect(bottomTicks).toContain('?');
    expect(bottomTicks).not.toContain(right);

    type(h, top, wrong); check(h);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
    expect(h.view.container.textContent).not.toMatch(/Multiply|Divide|First find/);
    // Input is closed until Try again.
    const box = h.view.container.querySelector<HTMLInputElement>(`input[aria-label="${LABEL(top)}"]`)!;
    expect(box.disabled).toBe(true);
    h.dispatch('retry');
    expect(h.view.container.querySelector<HTMLInputElement>(`input[aria-label="${LABEL(top)}"]`)!.value).toBe('');
    expect(String(h.state().task!.demand.learnerWork)).toMatch(/nothing typed yet/);

    type(h, top, right); check(h);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'double-number-line', evalMode: 'find_missing', data: line([missing]) as unknown as Record<string, unknown> });
  type(h, 7, '21'); check(h);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the tutor is told what is drawn: the lines, the given pair, the asked top value and the typed work, never the bottom value', () => {
  const h = mountWorkspace({ primitiveId: 'double-number-line', evalMode: 'find_missing', data: line([missing]) as unknown as Record<string, unknown> });
  expect(h.state().task!.demand).toMatchObject({
    lines: expect.stringContaining('bottom line Cookies, 0 to 24'),
    given: 'a given point: Cups 2 matches Cookies 6',
    target: expect.stringContaining('Cups 7 is marked on the top line'),
  });
  type(h, 7, '9');
  expect(h.state().task!.demand.learnerWork).toBe('typed 9 for Cookies at Cups = 7');
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/\b21\b/);
});

it('ratioLineMiss names the pattern the typed number shows', () => {
  const m = (c: DoubleNumberLineChallenge, v: string) => ratioLineMiss(c, [v]);
  expect(m(equivalent, '15')).toBeUndefined();
  expect(m(equivalent, '5')).toBe('gave_top');
  expect(m(equivalent, '3')).toBe('stopped_at_rate');
  expect(m(equivalent, '8')).toBe('added_rate');
  expect(m(equivalent, '18')).toBe('one_unit_off');
  expect(m(equivalent, '40')).toBe('too_high');
  expect(m(equivalent, '1')).toBe('too_low');
  expect(m(missing, '6')).toBe('gave_given');
  expect(m(missing, '11')).toBe('added_difference');
  expect(m(missing, '10')).toBe('added_rate');
  expect(m(rate, '0.33')).toBe('inverted_rate');
  expect(m(rate, '48')).toBe('multiplied_not_divided');
  expect(m(rate, '12')).toBe('gave_given');
  expect(m(rate, '8')).toBe('subtracted');
  expect(m(rate, '1')).toBe('gave_top');
});

it('the adapter refuses a target its own check cannot read', () => {
  const validate = LIVE_ADAPTERS['double-number-line'].validate;
  expect(() => validate(line([{ ...missing, targetPoints: [{ topValue: 9, bottomValue: 27 }] }]))).toThrow();
  expect(() => validate(line([{ ...missing, targetPoints: [] }]))).toThrow();
  expect(validate(line([equivalent, missing, rate]))).toBeTruthy();
});
