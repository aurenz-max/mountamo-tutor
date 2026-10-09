// @vitest-environment jsdom
/**
 * histogram levers on the teaching workspace: a pull changes the screen and the scene fact in the same commit, the
 * next attempt records it, a refused pull changes nothing, and the easier graph is ungraded practice with the full
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
import type { HistogramChallenge, HistogramChallengeType, HistogramData } from './Histogram';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const type = (h: WorkspaceHarness, text: string) => act(() => {
  fireEvent.change(h.view.container.querySelector('input[aria-label="Your answer"]')!, { target: { value: text } });
});
const check = (h: WorkspaceHarness) => h.press('Check Answer');
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

const values = (counts: number[]) => counts.flatMap((n, i) => Array<number>(n).fill(i * 10 + 5));
const base = { binWidth: 10, binStart: 0, contextTitle: 'Math quiz scores', xAxisLabel: 'Score', yAxisLabel: 'Frequency' };
const shape: HistogramChallenge = { ...base, id: 's1', challengeType: 'identify_shape', data: values([9, 6, 3, 2, 1]),
  prompt: 'Which best describes the shape of this distribution?', expectedShape: 'right-skewed',
  shapeOptions: ['symmetric', 'right-skewed', 'left-skewed', 'bimodal', 'uniform'] };
const modal: HistogramChallenge = { ...base, id: 'm1', challengeType: 'find_modal_bin', data: values([2, 5, 9, 4, 1]),
  prompt: 'Which bin contains the most score values?', expectedBinStart: 20, expectedBinEnd: 30 };
const freq: HistogramChallenge = { ...base, id: 'f1', challengeType: 'read_frequency', data: values([2, 5, 9, 7, 1]),
  prompt: 'How many values fall in the bin [30, 40)?', targetBinStart: 30, targetBinEnd: 40, targetFrequency: 7 };
const center: HistogramChallenge = { ...base, id: 'c1', challengeType: 'estimate_center', data: values([6, 7, 4, 2, 1, 1]),
  prompt: 'Estimate the mean (in score) of this data.', targetStatistic: 'mean', targetAnswer: 20, tolerance: 10 };
// The hard tier's starting position: no count labels, no stats panel.
const session = (t: HistogramChallengeType, c: HistogramChallenge): HistogramData => ({ title: 'Histograms', description: '',
  challengeType: t, challenges: [c], gradeBand: '6-7', showStatistics: false, showFrequencyLabels: false, supportTier: 'hard' });
const mount = (t: HistogramChallengeType, c: HistogramChallenge) => {
  const h = mountWorkspace({ primitiveId: 'histogram', evalMode: t, data: session(t, c) as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};

it('identify_shape: the outline draws in the same commit; the next attempt records it; a repeat pull changes nothing', () => {
  const h = mount('identify_shape', shape);
  expect(levers(h)).toEqual([['outline_tops', false], ['tail_model', false], ['peak_model', false], ['simpler_graph', false]]);
  h.press('Left-Skewed'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'skew_reversed' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'skew_reversed')).toBe('outline_tops');
  const receipt = h.dispatch('pull_lever', { lever: 'outline_tops' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/joins the tops/);
  expect(q(h, '[data-lever="outline-tops"]')).toHaveLength(1);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'outline_tops' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  // The tail model is the other skew, never the item's.
  expect(h.dispatch('pull_lever', { lever: 'tail_model' }).status).toBe('committed');
  expect(q(h, '[data-lever="tail-model"]')[0].textContent).toMatch(/^Left-Skewed/);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/Right-Skewed/i);
  h.dispatch('retry');
  h.press('Right-Skewed'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 's1', correct: true, levers: ['outline_tops', 'tail_model'] });
});

it('find_modal_bin: the level line sits at the tapped bar, never at the tallest; refused with nothing tapped', () => {
  const h = mount('find_modal_bin', modal);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'level_line' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.touch('bar-3'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'neighbor_bar' });
  expect(h.dispatch('pull_lever', { lever: 'level_line' }).status).toBe('committed');
  const line = q(h, '[data-lever="level-line"]')[0];
  const top3 = q(h, 'rect[data-pip-object="bar-3"]')[0], top2 = q(h, 'rect[data-pip-object="bar-2"]')[0];
  expect(line.getAttribute('y1')).toBe(top3.getAttribute('y'));
  expect(Number(top2.getAttribute('y'))).toBeLessThan(Number(line.getAttribute('y1')));
});

it('read_frequency: fade, axis names and count marks draw without writing the count', () => {
  const h = mount('read_frequency', freq);
  type(h, '30'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'bin_edge' });
  for (const id of ['isolate_bar', 'axis_names', 'count_marks']) expect(h.dispatch('pull_lever', { lever: id }).status, id).toBe('committed');
  expect(q(h, '[data-lever="count-marks"]')).toHaveLength(6);
  expect(q(h, '[data-lever="axis-names"]')[0].textContent).not.toMatch(/\d/);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\d/);
  expect(h.view.container.textContent).not.toMatch(/\b7\b(?!\d)/);
});

it('estimate_center: the count labels come back and the balance model carries no number', () => {
  const h = mount('estimate_center', center);
  expect(q(h, 'svg text[font-weight="bold"]')).toHaveLength(0);
  type(h, '5'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'too_low' });
  expect(h.dispatch('pull_lever', { lever: 'count_labels' }).status).toBe('committed');
  expect(q(h, 'svg text[font-weight="bold"]').length).toBeGreaterThan(0);
  expect(h.dispatch('pull_lever', { lever: 'balance_model' }).status).toBe('committed');
  expect(q(h, '[data-lever="balance-model"] svg text')).toHaveLength(0);
  expect(q(h, '[data-lever="balance-model"]')[0].textContent).not.toMatch(/\d/);
});

it('the simpler graph is ungraded practice of the same kind; the full item comes back blank and is credited after', () => {
  const h = mount('read_frequency', freq);
  type(h, '30'); check(h);
  const r = h.dispatch('pull_lever', { lever: 'simpler_graph' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('f1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'f1' });
  expect(r.state.task!.demand).toMatchObject({ bars: expect.stringMatching(/^4 bars/), learnerWork: 'nothing typed yet' });
  type(h, '5'); check(h);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('f1');
  expect(h.state().task!.demand).toMatchObject({ askedBin: 'the bar from 30 to 40 is outlined', learnerWork: 'nothing typed yet' });
  type(h, '7'); check(h);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['f1', false, false], ['f1~simpler', true, true], ['f1', true, false]]);
});
