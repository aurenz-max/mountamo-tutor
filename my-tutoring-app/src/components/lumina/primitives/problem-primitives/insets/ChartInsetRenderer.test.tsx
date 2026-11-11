import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ChartInset } from '../../../types';
import { chartView } from '../../../service/insets/chartView';
import { ChartInsetRenderer } from './ChartInsetRenderer';

vi.mock('recharts', async (original) => {
  const actual = await original<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => React.cloneElement(children, { width: 500, height: 200 } as object),
  };
});

const chart = (chartType: ChartInset['chartType'], data: ChartInset['data'], yLabel?: string): ChartInset =>
  ({ insetType: 'chart', chartType, title: 't', data, ...(yLabel ? { yLabel } : {}) });
const dotXs = (html: string) => Array.from(html.matchAll(/class="recharts-dot[^"]*"[^>]*?cx="([\d.]+)"|cx="([\d.]+)"[^>]*?class="recharts-dot/g)).map(m => Number(m[1] ?? m[2]));

describe('chartView', () => {
  it('puts a line with number labels on a numeric axis, in ascending order', () => {
    const v = chartView(chart('line', [{ label: '1,960', value: 3 }, { label: '1900', value: 1 }, { label: '1950', value: 2 }]));
    expect(v.numericX).toBe(true);
    expect(v.rows.map(r => r.x)).toEqual([1900, 1950, 1960]);
  });

  it('keeps word labels, and bars with number labels, categorical and in the given order', () => {
    const line = chartView(chart('line', [{ label: 'Week 4', value: 1 }, { label: 'Week 1', value: 2 }, { label: 'Week 9', value: 3 }]));
    expect(line.numericX).toBe(false);
    expect(line.rows.map(r => r.name)).toEqual(['Week 4', 'Week 1', 'Week 9']);
    expect(chartView(chart('bar', [{ label: '2', value: 1 }, { label: '1', value: 2 }])).numericX).toBe(false);
  });

  it('builds one row per label and one key per group, whatever the group is called', () => {
    const v = chartView(chart('line', [{ label: '1', value: 10, group: 'U.S.' }, { label: '2', value: 20, group: 'U.S.' }, { label: '1', value: 30, group: 'Peru' }]));
    expect(v.series).toEqual(['U.S.', 'Peru']);
    expect(v.rows).toEqual([{ name: '1', x: 1, s0: 10, s1: 30 }, { name: '2', x: 2, s0: 20 }]);
  });

  it('keeps every point of one series even when a label repeats', () => {
    expect(chartView(chart('bar', [{ label: 'a', value: 1 }, { label: 'a', value: 2 }], 'Cats')).rows).toEqual([{ name: 'a', s0: 1 }, { name: 'a', s0: 2 }]);
    expect(chartView(chart('bar', [{ label: 'a', value: 1 }], 'Cats')).series).toEqual(['Cats']);
  });
});

describe('ChartInsetRenderer', () => {
  it('spaces line points by their numbers', () => {
    const [a, b, c] = dotXs(renderToStaticMarkup(<ChartInsetRenderer data={chart('line', [{ label: '1900', value: 1 }, { label: '1950', value: 2 }, { label: '1960', value: 3 }])} />));
    expect((b - a) / (c - b)).toBeCloseTo(5, 1);
  });

  it('spaces word labels evenly', () => {
    const [a, b, c] = dotXs(renderToStaticMarkup(<ChartInsetRenderer data={chart('line', [{ label: 'Mon', value: 1 }, { label: 'Tue', value: 2 }, { label: 'Fri', value: 3 }])} />));
    expect((b - a) / (c - b)).toBeCloseTo(1, 1);
  });

  it('draws one line per group with a legend and distinct dashes', () => {
    const html = renderToStaticMarkup(<ChartInsetRenderer data={chart('line', ['A', 'B'].flatMap(group => ['1', '2', '3'].map((label, i) => ({ label, value: i, group }))))} />);
    expect(html.match(/recharts-line-curve/g)).toHaveLength(2);
    expect(html).toContain('stroke-dasharray="7 4"');
    expect(html).toMatch(/recharts-legend-item-text[^>]*>A</);
    expect(html).toMatch(/recharts-legend-item-text[^>]*>B</);
  });

  it('draws one bar per group at each label', () => {
    const html = renderToStaticMarkup(<ChartInsetRenderer data={chart('bar', ['A', 'B', 'C'].flatMap(group => ['x', 'y'].map((label, i) => ({ label, value: i + 1, group }))))} />);
    expect(html.match(/class="recharts-rectangle/g)).toHaveLength(6);
  });

  it('still draws single-series bar and pie charts', () => {
    const points = [{ label: 'a', value: 2 }, { label: 'b', value: 3 }];
    expect(renderToStaticMarkup(<ChartInsetRenderer data={chart('bar', points)} />).match(/class="recharts-rectangle/g)).toHaveLength(2);
    expect(renderToStaticMarkup(<ChartInsetRenderer data={chart('pie', points)} />).match(/recharts-pie-sector/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
