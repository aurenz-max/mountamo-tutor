import type { ChartInset } from '../../types';

/** What every chart is made of, whichever renderer draws it. */
export type ChartData = Pick<ChartInset, 'chartType' | 'yLabel' | 'data'>;

export interface ChartView {
  /** One display name per series; a row holds series i under the key `s${i}`, so a name like "U.S." is never a data path. */
  series: string[];
  rows: Array<Record<string, string | number>>;
  /** A line chart whose labels are all numbers: the x-axis is drawn to scale and `x` is on every row, in ascending order. */
  numericX: boolean;
}

const labelNumber = (label: string): number | null => {
  const s = label.trim().replace(/,(?=\d{3}(\D|$))/g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};

/** Turns a chart's list of points into one row per x position and one key per series. */
export function chartView(inset: ChartData): ChartView {
  const seriesOf = (d: ChartInset['data'][number]) => d.group?.trim() || inset.yLabel || 'Value';
  const series = Array.from(new Set(inset.data.map(seriesOf)));

  // One series keeps one row per point, so data that repeats a label still draws every point.
  const byKey = new Map<string, Record<string, string | number>>();
  inset.data.forEach((d, i) => {
    const key = series.length > 1 ? d.label : String(i);
    const row = byKey.get(key) ?? { name: d.label };
    row[`s${series.indexOf(seriesOf(d))}`] = d.value;
    byKey.set(key, row);
  });
  const rows = Array.from(byKey.values());

  const xs = rows.map(r => labelNumber(String(r.name)));
  const numericX = inset.chartType === 'line' && xs.every(x => x !== null) && new Set(xs).size === rows.length;
  if (!numericX) return { series, rows, numericX };

  rows.forEach((r, i) => { r.x = xs[i] as number; });
  rows.sort((a, b) => (a.x as number) - (b.x as number));
  return { series, rows, numericX };
}

/** A y-axis on round numbers that always holds zero, so a bar's height is its value. */
export function chartAxis(values: number[]) {
  const lo = Math.min(0, ...values), hi = Math.max(0, ...values);
  const raw = (hi - lo || 1) / 5, mag = 10 ** Math.floor(Math.log10(raw)), n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  const bottom = Math.floor(lo / step) * step;
  const top = Math.max(Math.ceil(hi / step) * step, bottom + step);
  return { bottom, top, step, ticks: Array.from({ length: Math.round((top - bottom) / step) + 1 }, (_, i) => bottom + i * step) };
}

const optionNumber = (option: string): number | null => {
  const found = option.replace(/,(?=\d{3})/g, '').match(/-?\d+(?:\.\d+)?/g);
  return found?.length === 1 ? Number(found[0]) : null;
};

/**
 * When the key is a plotted value between two axis marks, a child estimates it. A quarter of the space between marks
 * (about 10 pixels on the kit's chart) is the closest two estimates can be told apart, so a nearer wrong option is a guess.
 */
export function optionsTooClose(values: number[], step: number, options: string[], right: string): string | null {
  const key = optionNumber(right), near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  if (key === null || options.some(o => optionNumber(o) === null) || !values.some(v => near(v, key))) return null;
  if (near(Math.round(key / step) * step, key)) return null;
  const close = options.find(o => o !== right && Math.abs((optionNumber(o) as number) - key) < step / 4);
  return close ? `"${close}" and "${right}" are too close to tell apart on this graph, whose axis is marked every ${step}: space the options at least ${step / 4} apart, or ask about a point on a mark` : null;
}

/** Why these points cannot be drawn as this kind of chart, as a sentence the author can act on, or null. */
export function chartDataError(chartType: string, data: ChartInset['data']): string | null {
  if (!['bar', 'line', 'pie'].includes(chartType)) return 'chartType must be bar, line or pie';
  const groups = Array.from(new Set(data.map(d => d.group ?? '')));
  const grouped = data.some(d => d.group);
  if (grouped) {
    if (chartType === 'pie') return 'a pie shows one set of parts, so leave group out';
    if (data.some(d => !d.group)) return 'give every point a group, or none of them';
    if (groups.length < 2 || groups.length > 4) return `a chart compares 2-4 groups, got ${groups.length}; for one set of data, leave group out`;
  }
  const perGroup = groups.map(g => data.filter(d => (d.group ?? '') === g).length);
  const each = grouped ? ' per group' : '';
  if (perGroup.some(n => n < 2 || n > 12)) return `a chart needs 2-12 data points${each}, got ${perGroup.join(', ')}`;
  if (data.some(d => !d.label || !Number.isFinite(d.value))) return 'every data point needs a label and a numeric value';
  if (new Set(data.map(d => `${d.group ?? ''}|${d.label}`.toLowerCase())).size !== data.length) return `two data points${grouped ? ' in one group' : ''} share a label`;
  if (chartType === 'pie' && (data.length > 6 || data.some(d => d.value < 0))) return 'a pie has 2-6 slices, none negative';
  if (chartType === 'pie' && !data.some(d => d.value > 0)) return 'a pie needs at least one slice larger than 0';
  if (chartType === 'line' && perGroup.some(n => n < 3)) return `a line chart needs at least 3 points${each}`;
  if (chartType === 'bar' && grouped) {
    if (new Set(data.map(d => d.label)).size * groups.length !== data.length) return 'every group needs a bar for every label, because a missing bar reads as zero';
    if (data.length > 24) return `a grouped bar chart holds at most 24 bars, got ${data.length}`;
  }
  return null;
}

/** A chart in words, every value included, for a reader that cannot see the drawing (the tutor, a blind solve). */
export function chartWords(chart: ChartData & { title?: string; xLabel?: string }): string {
  const axes = [chart.xLabel && `across: ${chart.xLabel}`, chart.yLabel && `up: ${chart.yLabel}`].filter(Boolean).join('; ');
  const head = `a ${chart.chartType} chart${chart.title ? ` "${chart.title}"` : ''}${axes ? ` (${axes})` : ''}`;
  const points = (data: ChartInset['data']) => data.map(d => `${d.label} ${d.value}`).join(', ');
  const groups = Array.from(new Set(chart.data.map(d => d.group).filter(Boolean)));
  if (!groups.length) return `${head}: ${points(chart.data)}`;
  return `${head}: ${groups.map(g => `${g}: ${points(chart.data.filter(d => d.group === g))}`).join('; ')}`;
}
