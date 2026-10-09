/**
 * histogram's shared bins and shape classifier: a value on the axis maximum is drawn, and an identify item's key is
 * the shape the drawn bars have.
 */
import { describe, expect, it } from 'vitest';
import type { HistogramShapeKind } from './Histogram';
import { classifyShape, computeBins } from './histogramWorkspace';

/** One value per count at each bar's middle (width 10 from 0), plus `extra` values. */
const values = (counts: number[], extra: number[] = []) => [...counts.flatMap((n, i) => Array<number>(n).fill(i * 10 + 5)), ...extra];
const read = (data: number[]) => classifyShape(data, computeBins(data, 10, 0));

describe('computeBins', () => {
  it('a score of 100 lands in the top bar, [90, 100]', () => {
    const data = [5, 15, 95, 100, 100];
    const bins = computeBins(data, 10, 0);
    expect(bins).toHaveLength(10);
    expect(bins[9]).toEqual({ start: 90, end: 100, count: 3 });
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(data.length);
  });

  it('a value on an inner edge still belongs to the bar on its right', () => {
    const bins = computeBins([10, 20, 25, 35], 10, 0);
    expect(bins.map(b => b.count)).toEqual([0, 1, 2, 1]);
  });
});

describe('classifyShape', () => {
  it.each<[HistogramShapeKind, number[]]>([
    ['symmetric', [1, 2, 4, 7, 9, 9, 7, 4, 2, 1]],
    ['symmetric', [0, 1, 3, 6, 8, 6, 3, 1, 0, 0]],
    ['right-skewed', [9, 8, 6, 4, 3, 2, 1, 1, 1, 0]],
    ['right-skewed', [7, 5, 3, 2, 1, 1]],
    ['left-skewed', [0, 1, 1, 1, 2, 3, 4, 6, 8, 9]],
    ['left-skewed', [1, 1, 2, 3, 5, 7]],
    ['bimodal', [1, 4, 7, 4, 1, 1, 4, 7, 4, 1]],
    ['bimodal', [2, 6, 2, 2, 6, 2]],
    ['uniform', [3, 4, 3, 3, 4, 3, 4, 3, 3, 4]],
    ['uniform', [4, 4, 4, 4, 4, 4]],
  ])('%s: %j', (shape, counts) => {
    expect(read(values(counts))).toBe(shape);
  });

  it('a left-skewed quiz set with scores of 100 reads left-skewed now that they are drawn', () => {
    expect(read(values([0, 1, 1, 1, 2, 3, 4, 5, 6, 2], [100, 100, 100, 100, 100]))).toBe('left-skewed');
  });

  it.each<[string, number[]]>([
    ['a mild skew', [2, 4, 6, 7, 6, 5, 4, 3, 2, 1]],
    ['a lumpy flat', [1, 6, 2, 5, 1, 6, 2, 5, 1, 6]],
    ['too few bars', [3, 9, 3]],
  ])('ambiguous: %s', (_what, counts) => {
    expect(read(values(counts))).toBeNull();
  });
});
