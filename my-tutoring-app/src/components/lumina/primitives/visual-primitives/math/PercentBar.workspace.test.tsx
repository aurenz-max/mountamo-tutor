// @vitest-environment jsdom
/**
 * Percent bar on the teaching workspace: what is its own. The generic W1 contract
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
import type { PercentBarChallenge, PercentBarData } from './PercentBar';
import { PERCENT_MISSES_BY_MODE, percentMiss } from './percentBarWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const slide = (h: WorkspaceHarness, percent: number) => act(() => {
  const input = h.view.container.querySelector<HTMLInputElement>('input[aria-label="Percent on the bar"]');
  expect(input, 'the bar slider').toBeTruthy();
  fireEvent.change(input!, { target: { value: String(percent) } });
});
const check = (h: WorkspaceHarness) => h.press('Check Answer');
const ctx = { problemType: 'direct' as const, initialValue: 0, changeRate: 0, discountFactor: 0, finalValue: 0 };

const direct: PercentBarChallenge = { id: 'd1', type: 'direct', scenario: 'A jar holds 40 marbles.', wholeValue: 40,
  wholeValueLabel: 'Total Marbles', question: '30% of the marbles are blue. Show that percent on the bar.', targetPercent: 30,
  hint: 'Slide the bar to 30%.', context: ctx };
const discount: PercentBarChallenge = { id: 's1', type: 'subtraction', scenario: 'A shirt costs $40. The store offers a 20% discount.',
  wholeValue: 40, wholeValueLabel: 'Original Price ($)', question: 'What percent of the original price do you still pay? Show it on the bar.',
  targetPercent: 80, hint: 'Start at 100% and subtract: 100 - 20 = 80.', context: { ...ctx, problemType: 'subtraction' } };
const tip: PercentBarChallenge = { id: 'a1', type: 'addition', scenario: 'Your restaurant bill is $80. You decide to leave a 15% tip.',
  wholeValue: 80, wholeValueLabel: 'Bill ($)', question: 'Step 1', targetPercent: 115, maxPercent: 150, hint: '100 + 15 = 115.',
  context: { ...ctx, problemType: 'addition' },
  steps: [
    { kind: 'place', prompt: 'Step 1 — the tip: what percent of the bill is the tip? Place it on the bar.', wholeValue: 80,
      wholeValueLabel: 'Bill ($)', targetPercent: 15, maxPercent: 100, valueLabel: 'Tip ($)', recapLabel: 'Tip', hint: 'Place 15%.' },
    { kind: 'place', prompt: 'Step 2 — the total: including the tip, the total is what percent of the bill? Place the TOTAL on the bar.',
      wholeValue: 80, wholeValueLabel: 'Bill ($)', targetPercent: 115, maxPercent: 150, valueLabel: 'Total ($)', hint: '100% + 15% = 115%.' },
  ] };
const compare: PercentBarChallenge = { id: 'c1', type: 'comparison',
  scenario: 'Store A sells jeans for $40 at 30% off. Store B sells the same jeans for $60 at 50% off.', wholeValue: 40,
  wholeValueLabel: 'Store A Price ($)', question: 'Step 1', targetPercent: 70, hint: '100 - 30 = 70.', context: { ...ctx, problemType: 'comparison' },
  steps: [
    { kind: 'place', prompt: 'Step 1 — Store A: place the sale price as a percent of its original ($40).', wholeValue: 40,
      wholeValueLabel: 'Store A Original ($)', targetPercent: 70, maxPercent: 100, valueLabel: 'Sale Price ($)', recapLabel: 'Store A', hint: '70%.' },
    { kind: 'place', prompt: 'Step 2 — Store B: place the sale price as a percent of its original ($60).', wholeValue: 60,
      wholeValueLabel: 'Store B Original ($)', targetPercent: 50, maxPercent: 100, valueLabel: 'Sale Price ($)', recapLabel: 'Store B', hint: '50%.' },
    { kind: 'choice', prompt: 'Step 3 — which is cheaper?', options: [{ id: 'A', label: 'Store A', sublabel: '$28.00' },
      { id: 'B', label: 'Store B', sublabel: '$30.00' }], correctOptionId: 'A', hint: 'Compare the prices.' },
  ] };
const bar = (challenges: PercentBarChallenge[]): PercentBarData => ({ title: 'Percents', description: '', challenges,
  showPercentLabels: true, showValueLabels: true, benchmarkLines: [25, 50, 75], showCalculation: true });

/** `before`: steps answered right first (not commits); `wrong`: the miss; `right`: the rest from the missed step. */
type Step = { place: number } | { choose: string };
type Case = { mode: string; data: PercentBarData; before: Step[]; wrong: Step; miss: string; right: Step[]; secret: RegExp };
const CASES: Case[] = [
  { mode: 'identify_percent', data: bar([direct]), before: [], wrong: { place: 70 }, miss: 'complement', right: [{ place: 30 }], secret: /12\.00/ },
  { mode: 'find_part', data: bar([discount]), before: [], wrong: { place: 20 }, miss: 'placed_discount', right: [{ place: 80 }], secret: /\b80\b|32\.00/ },
  { mode: 'find_whole', data: bar([tip]), before: [{ place: 15 }], wrong: { place: 15 }, miss: 'rate_not_total', right: [{ place: 115 }],
    secret: /\b115\b|92\.00/ },
  { mode: 'convert', data: bar([compare]), before: [{ place: 70 }, { place: 50 }], wrong: { choose: 'Store B $30.00' }, miss: 'bigger_discount',
    right: [{ choose: 'Store A $28.00' }], secret: /cheaper is|Store A is/i },
];
const perform = (h: WorkspaceHarness, s: Step) => {
  if ('place' in s) slide(h, s.place); else h.press(s.choose);
  check(h);
};

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('percent-bar')!;
  const modes = (entry.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(PERCENT_MISSES_BY_MODE);
  for (const { mode, data } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'percent-bar', pin: mode, objectiveIds: ['o'],
      data: data as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: the bar and the options checked by the activity, no key published; a wrong step names its miss and Try again keeps the steps already right; the right one completes once',
  async ({ mode, data, before, wrong, miss, right, secret }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'percent-bar', evalMode: mode, data: data as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(task.demand)).not.toMatch(secret);
    expect(JSON.stringify(h.state().task)).not.toMatch(/targetPercent|correctOptionId|hint/i);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    // The bar starts empty, never at a step's percent; the hint and Next are the tutor's.
    expect(h.view.container.querySelector<HTMLInputElement>('input[aria-label="Percent on the bar"]')!.value).toBe('0');
    expect(h.view.container.textContent).not.toMatch(/Show Hint|Next Challenge/);

    // Steps right before the miss open the next step and commit nothing.
    for (const s of before) perform(h, s);
    expect(h.state().task!.evidence.attemptNumber).toBe(0);
    perform(h, wrong);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
    expect(h.view.container.textContent).not.toMatch(secret);
    // Input is closed until Try again.
    const open = Array.from(h.view.container.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button'))
      .filter(el => !el.disabled && /Percent on the bar|Store|Check Answer/.test((el.getAttribute('aria-label') ?? '') + el.textContent));
    expect(open).toEqual([]);
    const stepBefore = h.state().task!.demand.step;
    h.dispatch('retry');
    expect(h.state().task!.demand.step).toBe(stepBefore);
    expect(String(h.state().task!.demand.learnerWork)).toMatch(/set to 0%|no option chosen/);

    for (const s of right) perform(h, s);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'percent-bar', evalMode: 'find_part', data: bar([discount]) as unknown as Record<string, unknown> });
  slide(h, 80); check(h);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the tutor is told what is drawn: the step, the whole, the bar, the aids and what was found so far, never the percent', () => {
  const h = mountWorkspace({ primitiveId: 'percent-bar', evalMode: 'find_whole',
    data: { ...bar([tip]), showCalculation: false, benchmarkLines: [50] } as unknown as Record<string, unknown> });
  expect(h.state().task!.demand).toMatchObject({ step: '1 of 2', whole: '80 (Bill ($))', bar: '0% to 100%',
    onBar: expect.stringContaining('no calculation panel') });
  slide(h, 15); check(h);
  expect(h.state().task!.demand).toMatchObject({ step: '2 of 2', bar: '0% to 150%, with a line at 100% marking the whole',
    foundSoFar: 'Tip 15% = 12', learnerWork: 'Step 2 of 2: the bar is set to 0% of 80' });
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/\b115\b|\b92\b/);
});

it('percentMiss names the pattern the bar or the option shows', () => {
  const w = (stepIndex: number, percent: number, selected: string | null = null) => ({ stepIndex, percent, selected });
  expect(percentMiss(direct, w(0, 30))).toBeUndefined();
  expect(percentMiss(direct, w(0, 32))).toBeUndefined();
  expect(percentMiss(direct, w(0, 70))).toBe('complement');
  expect(percentMiss(direct, w(0, 12))).toBe('placed_value');
  expect(percentMiss(direct, w(0, 34))).toBe('near_miss');
  expect(percentMiss(direct, w(0, 50))).toBe('too_high');
  expect(percentMiss(direct, w(0, 5))).toBe('too_low');
  expect(percentMiss(discount, w(0, 20))).toBe('placed_discount');
  expect(percentMiss(discount, w(0, 32))).toBe('placed_value');
  expect(percentMiss(tip, w(1, 15))).toBe('rate_not_total');
  expect(percentMiss(tip, w(1, 100))).toBe('whole_only');
  expect(percentMiss(tip, w(1, 85))).toBe('took_off_rate');
  expect(percentMiss(tip, w(0, 12))).toBe('placed_value');
  expect(percentMiss(compare, w(0, 30))).toBe('placed_discount');
  expect(percentMiss(compare, w(2, 0, 'B'))).toBe('bigger_discount');
  // When the bigger discount is the right one, the other option is the price misread.
  const pricier = { ...compare, steps: compare.steps!.map(s => s.kind === 'choice' ? { ...s, prompt: 'Step 3 — which costs more?', correctOptionId: 'B' } : s) };
  expect(percentMiss(pricier, w(2, 0, 'A'))).toBe('other_price');
});

it('the adapter refuses a step its own check cannot read', () => {
  const validate = LIVE_ADAPTERS['percent-bar'].validate;
  expect(() => validate(bar([{ ...discount, targetPercent: 120 }]))).toThrow();
  expect(() => validate(bar([{ ...compare, steps: compare.steps!.map(s => s.kind === 'choice' ? { ...s, correctOptionId: 'C' } : s) }]))).toThrow();
  expect(validate(bar([direct, discount, tip, compare]))).toBeTruthy();
});
