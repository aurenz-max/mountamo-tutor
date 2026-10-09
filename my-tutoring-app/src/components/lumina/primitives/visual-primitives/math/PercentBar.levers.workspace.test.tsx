// @vitest-environment jsdom
/**
 * percent-bar levers on the teaching workspace: a pull changes the screen and the scene fact in the same commit, the
 * next attempt records it, a refused pull changes nothing, and the easier problem is ungraded practice with the full
 * item back after it.
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
import type { PercentBarChallenge, PercentBarData } from './PercentBar';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const slide = (h: WorkspaceHarness, percent: number) => act(() => {
  fireEvent.change(h.view.container.querySelector('input[aria-label="Percent on the bar"]')!, { target: { value: String(percent) } });
});
const check = (h: WorkspaceHarness) => h.press('Check Answer');
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

const ctx = { problemType: 'subtraction' as const, initialValue: 0, changeRate: 0, discountFactor: 0, finalValue: 0 };
const discount: PercentBarChallenge = { id: 's1', type: 'subtraction', scenario: 'A $40 shirt is 30% off.', wholeValue: 40,
  wholeValueLabel: 'Original Price ($)', question: 'What percent of the original price do you still pay? Show it on the bar.',
  targetPercent: 70, hint: '100 - 30 = 70.', context: ctx };
const compare: PercentBarChallenge = { id: 'c1', type: 'comparison', scenario: 'Store A: $40 at 30% off. Store B: $60 at 50% off.',
  wholeValue: 40, wholeValueLabel: 'Store A ($)', question: 'Step 1', targetPercent: 70, hint: '', context: { ...ctx, problemType: 'comparison' },
  steps: [
    { kind: 'place', prompt: 'Step 1 — Store A.', wholeValue: 40, wholeValueLabel: 'Store A Original ($)', targetPercent: 70, recapLabel: 'Store A', hint: '' },
    { kind: 'place', prompt: 'Step 2 — Store B.', wholeValue: 60, wholeValueLabel: 'Store B Original ($)', targetPercent: 50, recapLabel: 'Store B', hint: '' },
    { kind: 'choice', prompt: 'Step 3 — which is cheaper?', options: [{ id: 'A', label: 'Store A', sublabel: '$28.00' },
      { id: 'B', label: 'Store B', sublabel: '$30.00' }], correctOptionId: 'A', hint: '' },
  ] };
// The hard tier's starting position: no labels, no guide lines, no readout, no calculation panel.
const bar = (c: PercentBarChallenge): PercentBarData => ({ title: 'Percents', description: '', challenges: [c],
  showPercentLabels: false, showValueLabels: false, benchmarkLines: [], showCalculation: false, doubleBar: false });
const mount = (mode: string, c: PercentBarChallenge) => {
  const h = mountWorkspace({ primitiveId: 'percent-bar', evalMode: mode, data: bar(c) as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};

it('find_part: the parts of the bar are named in the same commit, with no digit; the next attempt records the lever; a repeat pull changes nothing', () => {
  const h = mount('find_part', discount);
  expect(levers(h)).toEqual([['value_bar', false], ['tenths', false], ['fill_names', false], ['discount_model', false], ['simpler_problem', false]]);
  slide(h, 30); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'placed_discount' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'placed_discount')).toBe('fill_names');
  const receipt = h.dispatch('pull_lever', { lever: 'fill_names' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/the rest of the whole/);
  expect(q(h, '[data-lever="fill-names"]')[0].textContent).toBe('the partthe rest of the whole');
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'fill_names' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  slide(h, 70); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 's1', correct: true, levers: ['fill_names'] });
});

it('every help lever draws without a digit or any of the item\'s numbers', () => {
  const h = mount('find_part', discount);
  slide(h, 30); check(h);
  for (const id of ['value_bar', 'tenths', 'discount_model']) expect(h.dispatch('pull_lever', { lever: id }).status).toBe('committed');
  expect(q(h, '[data-lever="tenths"]')).toHaveLength(9);
  for (const sel of ['[data-lever="tenths"]', '[data-lever="discount-model"]']) for (const el of q(h, sel)) expect(el.textContent).not.toMatch(/\d/);
  expect(q(h, '[data-lever="value-bar"]')[0].textContent).not.toMatch(/[1-9]/);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\d/);
  expect(h.view.container.textContent).not.toMatch(/\b70\b|28\.00/);
});

it('convert: a bar lever is refused on the compare step with nothing changed; the compare picture draws there', () => {
  const h = mount('convert', compare);
  slide(h, 70); check(h);
  slide(h, 50); check(h);
  h.press('Store B $30.00'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'bigger_discount' });
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'tenths' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  expect(h.dispatch('pull_lever', { lever: 'compare_model' }).status).toBe('committed');
  expect(q(h, '[data-lever="compare-model"]')[0].textContent).toMatch(/Compare what is still paid/);
  h.dispatch('retry');
  expect(h.state().task!.demand.step).toBe('3 of 3');
  h.press('Store A $28.00'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['compare_model'] });
});

it('the simpler problem is ungraded practice of the same kind; the full item comes back blank and is credited after', () => {
  const h = mount('find_part', discount);
  slide(h, 30); check(h);
  const r = h.dispatch('pull_lever', { lever: 'simpler_problem' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('s1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 's1' });
  expect(r.state.task!.demand).toMatchObject({ scenario: 'Practice first: something costs $40 and is 25% off.',
    learnerWork: 'the bar is set to 0% of 40' });
  expect(JSON.stringify(r.state.task!.demand)).not.toMatch(/\b70\b|30%/);
  slide(h, 75); check(h);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('s1');
  expect(h.state().task!.demand).toMatchObject({ scenario: 'A $40 shirt is 30% off.', learnerWork: 'the bar is set to 0% of 40' });
  slide(h, 70); check(h);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['s1', false, false], ['s1~simpler', true, true], ['s1', true, false]]);
});
