/**
 * histogram levers: the leak rules per mode, the simplify builder over many item shapes, and "this wrong answer,
 * then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { HistogramChallenge, HistogramChallengeType, HistogramShapeKind } from './Histogram';
import {
  BALANCE_MODEL_LEVER, COUNT_LABELS_LEVER, SIMPLER_LEVER, histogramLevers, leverFacts, leverTextLeaks, peakModel,
  practiceLeaks, simplerHistogram, tailModel,
} from './histogramLevers';
import { HISTOGRAM_MISSES_BY_MODE, SHAPE_LABEL, computeBins, histogramCorrect, histogramHarnessInput } from './histogramWorkspace';

const SHAPES: HistogramShapeKind[] = ['symmetric', 'right-skewed', 'left-skewed', 'bimodal', 'uniform'];
const values = (counts: number[], start: number, width: number) =>
  counts.flatMap((n, i) => Array<number>(n).fill(start + i * width + Math.floor(width / 2)));
const AXES = [{ s: 0, w: 10, n: 10 }, { s: 130, w: 5, n: 10 }, { s: 1, w: 2, n: 10 }, { s: 0, w: 5, n: 6 }];
const COUNTS = [[2, 5, 9, 4, 1, 0, 1, 2, 0, 1], [9, 6, 3, 2, 1, 1], [1, 1, 2, 3, 5, 8], [4, 4, 5, 4, 3, 4, 4], [3, 7, 2, 1, 6, 8, 2]];

/** Items of every mode across the generator's axes and a spread of bar heights. */
function items(mode: HistogramChallengeType): HistogramChallenge[] {
  const out: HistogramChallenge[] = [];
  let k = 0;
  for (const { s, w } of AXES) for (const counts of COUNTS) {
    const data = values(counts, s, w), bins = computeBins(data, w, s);
    const base = { id: `${mode}-${k++}`, challengeType: mode, data, binWidth: w, binStart: s, contextTitle: 'Scores',
      xAxisLabel: 'Score', yAxisLabel: 'Frequency', prompt: `Item ${k}?` };
    if (mode === 'identify_shape') for (const shape of SHAPES) out.push({ ...base, id: `${base.id}-${shape}`, expectedShape: shape, shapeOptions: SHAPES });
    if (mode === 'find_modal_bin') {
      const top = bins.reduce((b, x, i) => (x.count > bins[b].count ? i : b), 0);
      out.push({ ...base, expectedBinStart: bins[top].start, expectedBinEnd: bins[top].end });
    }
    if (mode === 'read_frequency') for (const b of bins.filter(x => x.count > 0)) {
      out.push({ ...base, id: `${base.id}-${b.start}`, targetBinStart: b.start, targetBinEnd: b.end, targetFrequency: b.count });
    }
    if (mode === 'estimate_center') for (const stat of ['mean', 'median'] as const) {
      out.push({ ...base, id: `${base.id}-${stat}`, targetStatistic: stat, tolerance: w,
        targetAnswer: Math.round((data.reduce((a, v) => a + v, 0) / data.length) / w) * w });
    }
  }
  return out;
}
const MODES = Object.keys(HISTOGRAM_MISSES_BY_MODE) as HistogramChallengeType[];

describe('simplify builder', () => {
  it.each(MODES)('%s: same mode, its own id and ask, not the item\'s answer, credited by its own check, deterministic', (mode) => {
    const all = items(mode);
    for (const c of all) {
      const s = simplerHistogram(c);
      expect(s, c.id).not.toBeNull();
      expect(s!.id).toBe(`${c.id}~simpler`);
      expect(s!.challengeType).toBe(mode);
      expect(practiceLeaks(c, s!)).toBe(false);
      const input = histogramHarnessInput(s!, 'correct');
      const bins = computeBins(s!.data, s!.binWidth, s!.binStart);
      const work = input.kind === 'choose' ? { shape: SHAPES.find(x => SHAPE_LABEL[x] === input.label)!, binIndex: null, typed: '' }
        : input.kind === 'bar' ? { shape: null, binIndex: input.index, typed: '' } : { shape: null, binIndex: null, typed: input.text };
      expect(histogramCorrect(s!, work, bins), c.id).toBe(true);
      // The practice answer is not the item's: credited on the practice graph, not on the learner's item.
      if (mode !== 'find_modal_bin') expect(histogramCorrect(c, work, computeBins(c.data, c.binWidth, c.binStart)), c.id).toBe(false);
      expect(simplerHistogram(c)).toEqual(s);
      expect(simplerHistogram(s!)).toBeNull();
    }
    expect(all.length).toBeGreaterThan(10);
  });

  it('the leak rule refuses the learner\'s own graph and answer', () => {
    const c = items('read_frequency')[0];
    expect(practiceLeaks(c, { ...c, id: 'x~simpler' })).toBe(true);
    const s = simplerHistogram(c)!;
    expect(practiceLeaks(c, { ...s, targetFrequency: c.targetFrequency })).toBe(true);
    const e = items('estimate_center')[0];
    expect(practiceLeaks(e, { ...simplerHistogram(e)!, targetAnswer: e.targetAnswer })).toBe(true);
  });
});

describe('leak rules', () => {
  it.each(MODES)('%s: no lever text or fact carries a digit or the item\'s shape name', (mode) => {
    for (const c of items(mode)) {
      const levers = histogramLevers(c, [], { countLabelsShown: false });
      for (const l of levers) expect(leverTextLeaks(c, l.when + ' ' + l.does), `${c.id} ${l.id}`).toBe(false);
      expect(leverTextLeaks(c, leverFacts(c, levers.map(l => l.id))), c.id).toBe(false);
    }
  });

  it('a model graph is never the item\'s shape', () => {
    for (const shape of SHAPES) {
      const c = { ...items('identify_shape')[0], expectedShape: shape };
      expect(tailModel(c)!.shape).not.toBe(shape);
      expect(peakModel(c)!.shape).not.toBe(shape);
    }
  });

  it('count_labels is offered only where the session withdrew the labels', () => {
    const c = items('estimate_center')[0];
    expect(histogramLevers(c, [], { countLabelsShown: true }).map(l => l.id)).not.toContain(COUNT_LABELS_LEVER);
    expect(histogramLevers(c, [], { countLabelsShown: false }).map(l => l.id)).toContain(COUNT_LABELS_LEVER);
  });
});

describe('this wrong answer, then this lever', () => {
  it('the catalog declares levers and every miss is answered by a help lever on every item', () => {
    expect(getComponentById('histogram')!.teachingWorkspace!.levers).toBe(true);
    for (const mode of MODES) for (const c of items(mode)) {
      const levers = histogramLevers(c, [], { countLabelsShown: true });
      for (const miss of HISTOGRAM_MISSES_BY_MODE[mode]) {
        expect(levers.some(l => l.kind === 'help' && l.answers?.includes(miss)), `${c.id} ${miss}`).toBe(true);
      }
      expect(levers.at(-1)!.id).toBe(SIMPLER_LEVER);
    }
  });

  it.each([
    ['identify_shape', 'skew_reversed', 'outline_tops'],
    ['identify_shape', 'peak_count', 'outline_tops'],
    ['find_modal_bin', 'neighbor_bar', 'level_line'],
    ['read_frequency', 'bin_edge', 'axis_names'],
    ['read_frequency', 'neighbor_bar', 'isolate_bar'],
    ['read_frequency', 'off_by_one', 'count_marks'],
    ['estimate_center', 'off_axis', 'axis_names'],
    ['estimate_center', 'tallest_bar', BALANCE_MODEL_LEVER],
    ['estimate_center', 'axis_middle', COUNT_LABELS_LEVER],
  ] as const)('%s %s → %s', (mode, miss, lever) => {
    expect(nextLever(histogramLevers(items(mode)[0], [], { countLabelsShown: false }), miss)).toBe(lever);
  });

  it('a pulled lever is skipped for the next one that answers the miss', () => {
    const c = items('identify_shape')[0];
    expect(nextLever(histogramLevers(c, ['outline_tops'], { countLabelsShown: true }), 'skew_reversed')).toBe('tail_model');
    expect(nextLever(histogramLevers(c, ['outline_tops'], { countLabelsShown: true }), 'flat_vs_peaked')).toBe('peak_model');
  });
});
