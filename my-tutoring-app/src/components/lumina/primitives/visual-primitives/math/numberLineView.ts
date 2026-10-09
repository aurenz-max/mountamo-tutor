/**
 * What the number line shows: the snap grid, the ticks and labels, and the auto-zoomed window. Pure, so the
 * component draws from it and the levers (`numberLineLevers.ts`) and the journey row derive the same labels
 * from the payload alone.
 */
import type { NumberLineChallenge, NumberLineData } from './NumberLine';

export interface Window { min: number; max: number }
export interface Tick { value: number; isMajor: boolean }

// Precision is fixed per number type, independent of zoom.
export function getSnapPrecision(numberType: string): number {
  if (numberType === 'integer') return 1;
  if (numberType === 'decimal') return 0.01;
  return 1 / 8; // fraction, mixed
}

export function getDefaultTickInterval(numberType: string, span: number): number {
  if (numberType === 'integer') {
    if (span <= 30) return 1;
    if (span <= 100) return 5;
    return 10;
  }
  let interval = getSnapPrecision(numberType);
  while (span / interval > 25) interval *= 2;
  return interval;
}

/** The interval at which tick labels are shown (coarser than tick marks). */
export function getLabelInterval(numberType: string, tickInterval: number, span: number): number {
  if (numberType !== 'integer') return tickInterval;
  if (tickInterval === 1) return span <= 10 ? 1 : span <= 20 ? 2 : 5;
  if (tickInterval === 5) return span <= 50 ? 5 : 10;
  return tickInterval;
}

export function lineTicks(min: number, max: number, numberType: string, customTickInterval?: number): Tick[] {
  const span = max - min;
  const interval = customTickInterval || getDefaultTickInterval(numberType, span);
  const labelIv = getLabelInterval(numberType, interval, span);
  const result: Tick[] = [];
  for (let v = Math.ceil(min / interval) * interval; v <= max + interval * 0.001; v += interval) {
    const rounded = Math.round(v * 1000) / 1000;
    const isMajor = numberType === 'integer'
      ? (labelIv <= interval || Math.round(rounded) % Math.round(labelIv) === 0)
      : Number.isInteger(rounded);
    result.push({ value: rounded, isMajor });
  }
  return result;
}

/**
 * Place and between items are fitted to the session's content (every item of the same kind), not to the item:
 * a window centred on one target put that target, or an exact missing number, in the middle of the line.
 * Jump and order keep the per-item fit (a jump's landing is off-centre; order is about relative position).
 */
const SESSION_FIT: ReadonlySet<NumberLineChallenge['type']> = new Set<NumberLineChallenge['type']>(['plot_point', 'find_between']);

/** The auto-zoom for a challenge: zoom level and centre, or null to leave the view as it is. */
export function autoView(data: Pick<NumberLineData, 'range' | 'operations' | 'highlights' | 'challenges'>, ch: NumberLineChallenge):
  { zoom: number; center: number } | null {
  const range = { min: data.range?.min ?? 0, max: data.range?.max ?? 10 };
  const session = SESSION_FIT.has(ch.type);
  const items = session ? (data.challenges ?? []).filter(c => c.type === ch.type) : [ch];
  const targets = (items.length ? items : [ch]).flatMap(c => c.targetValues ?? []);
  const ops = ch.operations?.length ? ch.operations : data.operations ?? [];
  const opValues = ops.flatMap(op => [op.startValue, op.type === 'add' ? op.startValue + op.changeValue : op.startValue - op.changeValue]);
  const highlights = (ch.highlights ?? data.highlights ?? []).map(h => h.value);
  const values = [...targets, ...opValues, ...highlights].filter(v => v >= range.min && v <= range.max);
  if (!values.length) return null;
  const total = range.max - range.min;
  const lo = Math.min(...values), hi = Math.max(...values);
  const contentSpan = Math.max(hi - lo, total * 0.04);
  // Per item: ~60% padding each side. Session fit: ~30%, since the content already spans every item.
  const windowSpan = contentSpan * (session ? 1.6 : 3.2);
  const zoom = Math.max(1, Math.min(5, total / windowSpan));
  const center = Math.max(range.min + total / zoom / 2, Math.min(range.max - total / zoom / 2, (lo + hi) / 2));
  return { zoom, center };
}

export function visibleWindow(range: Window, zoom: number, center: number): Window {
  const span = (range.max - range.min) / zoom;
  const min = Math.max(range.min, Math.min(center - span / 2, range.max - span));
  return { min, max: Math.min(range.max, min + span) };
}

/** The window the line settles on for `ch`, and its labelled values, from the payload alone. */
export function settledView(data: NumberLineData, ch: NumberLineChallenge): { window: Window; labels: number[] } {
  const range = { min: data.range?.min ?? 0, max: data.range?.max ?? 10 };
  const fit = autoView(data, ch);
  const window = fit ? visibleWindow(range, fit.zoom, fit.center) : range;
  const labels = lineTicks(window.min, window.max, data.numberType ?? 'integer', data.tickInterval).filter(t => t.isMajor).map(t => t.value);
  return { window, labels };
}
