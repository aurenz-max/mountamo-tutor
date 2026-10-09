// @vitest-environment jsdom
/**
 * Histogram on the teaching workspace: what is its own. The generic W1 contract
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
import type { HistogramChallenge, HistogramData, HistogramChallengeType } from './Histogram';
import { HISTOGRAM_MISSES_BY_MODE, computeBins, frequencyAxis, histogramMiss } from './histogramWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const type = (h: WorkspaceHarness, text: string) => act(() => {
  const box = h.view.container.querySelector<HTMLInputElement>('input[aria-label="Your answer"]');
  expect(box, 'the answer box').toBeTruthy();
  fireEvent.change(box!, { target: { value: text } });
});
const check = (h: WorkspaceHarness) => h.press('Check Answer');

/** Bars of width 10 from 0: 2, 5, 9, 4, 1 (each value at its bar's middle). */
const values = (counts: number[]) => counts.flatMap((n, i) => Array<number>(n).fill(i * 10 + 5));
const base = { binWidth: 10, binStart: 0, contextTitle: 'Math quiz scores', xAxisLabel: 'Score', yAxisLabel: 'Frequency',
  hint: 'The answer is 4.' };
const shape: HistogramChallenge = { ...base, id: 's1', challengeType: 'identify_shape', data: values([9, 6, 3, 2, 1]),
  prompt: 'Which best describes the shape of this distribution?', expectedShape: 'right-skewed',
  shapeOptions: ['symmetric', 'right-skewed', 'left-skewed', 'bimodal', 'uniform'] };
const modal: HistogramChallenge = { ...base, id: 'm1', challengeType: 'find_modal_bin', data: values([2, 5, 9, 4, 1]),
  prompt: 'Which bin contains the most score values?', expectedBinStart: 20, expectedBinEnd: 30 };
const freq: HistogramChallenge = { ...base, id: 'f1', challengeType: 'read_frequency', data: values([2, 5, 9, 4, 1]),
  prompt: 'How many values fall in the bin [30, 40)?', targetBinStart: 30, targetBinEnd: 40, targetFrequency: 4 };
const center: HistogramChallenge = { ...base, id: 'c1', challengeType: 'estimate_center', data: values([2, 5, 9, 4, 1]),
  prompt: 'Estimate the mean (in score) of this data.', targetStatistic: 'mean', targetAnswer: 20, tolerance: 10 };
const session = (challengeType: HistogramChallengeType, challenges: HistogramChallenge[]): HistogramData => ({
  title: 'Histograms', description: '', challengeType, challenges, gradeBand: '6-7',
  showStatistics: challengeType !== 'estimate_center' });

type Step = { choose: string } | { bar: number } | { type: string };
type Case = { mode: HistogramChallengeType; data: HistogramData; wrong: Step; miss: string; right: Step; secret: RegExp; cleared: RegExp };
const CASES: Case[] = [
  { mode: 'identify_shape', data: session('identify_shape', [shape]), wrong: { choose: 'Left-Skewed' }, miss: 'skew_reversed',
    right: { choose: 'Right-Skewed' }, secret: /right-skewed|expectedShape/, cleared: /no shape chosen yet/ },
  { mode: 'find_modal_bin', data: session('find_modal_bin', [modal]), wrong: { bar: 3 }, miss: 'neighbor_bar', right: { bar: 2 },
    secret: /20 to 30|\[20, 30\)/, cleared: /no bar tapped yet/ },
  { mode: 'read_frequency', data: session('read_frequency', [freq]), wrong: { type: '30' }, miss: 'bin_edge', right: { type: '4' },
    secret: /\b4\b/, cleared: /nothing typed yet/ },
  { mode: 'estimate_center', data: session('estimate_center', [center]), wrong: { type: '45' }, miss: 'too_high', right: { type: '22' },
    secret: /\b20\b/, cleared: /nothing typed yet/ },
];
const perform = (h: WorkspaceHarness, s: Step) => {
  if ('choose' in s) h.press(s.choose);
  else if ('bar' in s) h.touch(`bar-${s.bar}`);
  else type(h, s.type);
  check(h);
};

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('histogram')!;
  const modes = (entry.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(HISTOGRAM_MISSES_BY_MODE);
  for (const { mode, data } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'histogram', pin: mode, objectiveIds: ['o'],
      data: data as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: checked by the activity, no key published; a wrong check names its miss and Try again clears it; the right one completes once',
  async ({ mode, data, wrong, miss, right, secret, cleared }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'histogram', evalMode: mode, data: data as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(task.demand)).not.toMatch(secret);
    expect(JSON.stringify(h.state().task)).not.toMatch(/targetFrequency|targetAnswer|expectedBin|hint|answer is/i);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    // The hint and the scripted retry are the tutor's.
    expect(h.view.container.textContent).not.toMatch(/Need a Hint|answer is/);

    perform(h, wrong);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
    expect(JSON.stringify(h.state().task!.demand)).not.toMatch(secret);
    // Input is closed until Try again.
    const open = Array.from(h.view.container.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button'))
      .filter(el => !el.disabled && /Your answer|Check Answer|Skewed|Symmetric|Bimodal|Uniform/
        .test((el.getAttribute('aria-label') ?? '') + el.textContent));
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

it('a tapped bar on a wrong check stays put until Try again', () => {
  const h = mountWorkspace({ primitiveId: 'histogram', evalMode: 'find_modal_bin', data: session('find_modal_bin', [modal]) as unknown as Record<string, unknown> });
  perform(h, { bar: 3 });
  h.touch('bar-2');
  expect(h.state().task!.demand.learnerWork).toBe('tapped the bar from 30 to 40');
});

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'histogram', evalMode: 'read_frequency', data: session('read_frequency', [freq]) as unknown as Record<string, unknown> });
  type(h, '4'); check(h);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the tutor is told what is drawn, never the heights or the key', () => {
  const h = mountWorkspace({ primitiveId: 'histogram', evalMode: 'read_frequency', data: session('read_frequency', [freq]) as unknown as Record<string, unknown> });
  expect(h.state().task!.demand).toMatchObject({
    bars: '5 bars of width 10 along "Score", from 0 to 50; each bar covers its left edge up to, not including, its right edge (the last bar includes its right edge)',
    frequencyAxis: '"Frequency" up the side, labelled every 1', countLabels: 'the bars carry no count labels',
    askedBin: 'the bar from 30 to 40 is outlined', learnerWork: 'nothing typed yet' });
  // No count labels drawn above the bars on a read-frequency item.
  expect(h.view.container.querySelectorAll('svg text[font-weight="bold"]').length).toBe(0);
});

it('the frequency axis is labelled on whole counts, so a bar of 9 reads 9', () => {
  expect(frequencyAxis(9)).toEqual({ top: 10, step: 1, minor: false });
  expect(frequencyAxis(13)).toEqual({ top: 14, step: 2, minor: true });
  expect(frequencyAxis(23)).toEqual({ top: 25, step: 5, minor: true });
  const h = mountWorkspace({ primitiveId: 'histogram', evalMode: 'read_frequency', data: session('read_frequency', [freq]) as unknown as Record<string, unknown> });
  const ticks = Array.from(h.view.container.querySelectorAll('svg text[text-anchor="end"]')).map(t => t.textContent);
  expect(ticks).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
});

it('histogramMiss names the pattern the choice, bar or number shows', () => {
  const w = (o: Partial<{ shape: any; binIndex: number; typed: string }>) => ({ shape: null, binIndex: null, typed: '', ...o });
  const bins = (c: HistogramChallenge) => computeBins(c.data, c.binWidth, c.binStart);
  expect(histogramMiss(shape, w({ shape: 'right-skewed' }), bins(shape))).toBeUndefined();
  expect(histogramMiss(shape, w({ shape: 'symmetric' }), bins(shape))).toBe('missed_skew');
  expect(histogramMiss({ ...shape, expectedShape: 'symmetric' }, w({ shape: 'left-skewed' }), bins(shape))).toBe('called_skewed');
  expect(histogramMiss({ ...shape, expectedShape: 'bimodal' }, w({ shape: 'symmetric' }), bins(shape))).toBe('peak_count');
  expect(histogramMiss({ ...shape, expectedShape: 'uniform' }, w({ shape: 'symmetric' }), bins(shape))).toBe('flat_vs_peaked');
  expect(histogramMiss(modal, w({ binIndex: 1 }), bins(modal))).toBe('neighbor_bar');
  expect(histogramMiss({ ...modal, data: values([5, 1, 9, 4, 2]) }, w({ binIndex: 0 }), bins({ ...modal, data: values([5, 1, 9, 4, 2]) }))).toBe('runner_up');
  expect(histogramMiss({ ...modal, data: values([1, 2, 9, 4, 5]) }, w({ binIndex: 0 }), bins({ ...modal, data: values([1, 2, 9, 4, 5]) }))).toBe('shorter_bar');
  expect(histogramMiss(freq, w({ typed: '40' }), bins(freq))).toBe('bin_edge');
  expect(histogramMiss(freq, w({ typed: '9' }), bins(freq))).toBe('neighbor_bar');
  expect(histogramMiss(freq, w({ typed: '21' }), bins(freq))).toBe('total_count');
  expect(histogramMiss(freq, w({ typed: '3' }), bins(freq))).toBe('off_by_one');
  expect(histogramMiss(freq, w({ typed: '15' }), bins(freq))).toBe('too_high');
  expect(histogramMiss(center, w({ typed: '75' }), bins(center))).toBe('off_axis');
  expect(histogramMiss({ ...center, targetAnswer: 40 }, w({ typed: '25' }), bins(center))).toBe('tallest_bar');
  expect(histogramMiss({ ...center, targetAnswer: 40, data: values([2, 9, 5, 4, 1]) }, w({ typed: '25' }), bins({ ...center, data: values([2, 9, 5, 4, 1]) }))).toBe('axis_middle');
  expect(histogramMiss(center, w({ typed: '2' }), bins(center))).toBe('too_low');
});

it('the adapter refuses an item its own check cannot read', () => {
  const validate = LIVE_ADAPTERS['histogram'].validate;
  expect(() => validate(session('read_frequency', [{ ...freq, targetBinStart: 70, targetBinEnd: 80 }]))).toThrow();
  expect(() => validate(session('find_modal_bin', [{ ...modal, expectedBinStart: 90 }]))).toThrow();
  expect(() => validate(session('identify_shape', [{ ...shape, shapeOptions: ['symmetric', 'uniform'] }]))).toThrow();
  expect(validate(session('read_frequency', [shape, modal, freq, center]))).toBeTruthy();
});
