/**
 * Scale drawers: one quantity across a wide span. Magnitude ladder (sizes across powers of ten),
 * band scale (named zones on one variable), range bars (who covers which values), metric switch
 * (the same things ranked by different measures). Code checks every spec before it is shown.
 */
import { compileExpr } from './drawerExpr';
import { num, text, type DrawerBase, type DrawerProblem } from './drawerSpecs';

// ---------------------------------------------------------------------------
// magnitude-ladder
// ---------------------------------------------------------------------------

export interface MagnitudeItem { label: string; value: number }
export interface DrawerMagnitudeLadderData extends DrawerBase {
  /** Unit of every value, e.g. "m" or "years". */
  unit: string;
  items: MagnitudeItem[];
}

/** Items smallest first: the renderer never trusts the model's order. */
export const ladderItems = (d: DrawerMagnitudeLadderData) => [...d.items].sort((a, b) => a.value - b.value);

export function magnitudeLadderProblems(d: DrawerMagnitudeLadderData): DrawerProblem[] {
  const p: DrawerProblem[] = [];
  if (!text(d.title) || !text(d.caption) || !text(d.unit)) p.push('title, caption and unit are required');
  if (!Array.isArray(d.items) || d.items.length < 4 || d.items.length > 8) return [...p, 'needs 4-8 items'];
  for (const x of d.items) if (!text(x.label) || !num(x.value) || x.value <= 0) p.push(`item "${x.label}" needs a label and a positive value`);
  if (new Set(d.items.map(x => x.label)).size !== d.items.length) p.push('item labels must be unique');
  if (p.length) return p;
  const s = ladderItems(d);
  // The scale switch is the point; under a factor of 1000 an ordinary scale shows everything.
  if (s[s.length - 1].value / s[0].value < 1000) p.push('the largest item must be at least 1000 times the smallest');
  return p;
}

// ---------------------------------------------------------------------------
// band-scale
// ---------------------------------------------------------------------------

export interface ScaleBand { from: number; to: number; label: string; /** May hold {formula in x}, e.g. "{10^(7-x)} times more acidic than water." */ text: string }
export interface ScaleMarker { label: string; value: number }
export interface DrawerBandScaleData extends DrawerBase {
  variable: string;
  unit: string;
  min: number; max: number; step: number; value: number;
  bands: ScaleBand[];
  markers: ScaleMarker[];
}

const FORMULA = /\{([^}]+)\}/g;

export function bandAt(d: DrawerBandScaleData, x: number): ScaleBand {
  return d.bands.find(b => x >= b.from && x < b.to) ?? d.bands[d.bands.length - 1];
}

/** The band's text with each {formula} evaluated at x. */
export function bandText(b: ScaleBand, x: number, fmt: (n: number) => string): string {
  return b.text.replace(FORMULA, (_m, src: string) => fmt(compileExpr(src)({ x })));
}

export function bandScaleProblems(d: DrawerBandScaleData): DrawerProblem[] {
  const p: DrawerProblem[] = [];
  if (!text(d.title) || !text(d.caption) || !text(d.variable)) p.push('title, caption and variable are required');
  if (![d.min, d.max, d.step, d.value].every(num) || d.min >= d.max || d.step <= 0) return [...p, 'min, max, step and value must be numbers with min < max'];
  if (d.value < d.min || d.value > d.max) p.push('value is outside min-max');
  if ((d.max - d.min) / d.step > 2000) p.push('step is too small for the range');
  if (!Array.isArray(d.bands) || d.bands.length < 2 || d.bands.length > 7) return [...p, 'needs 2-7 bands'];
  const close = (a: number, b: number) => Math.abs(a - b) <= (d.max - d.min) * 1e-9;
  if (!close(d.bands[0].from, d.min)) p.push(`the first band must start at ${d.min}`);
  if (!close(d.bands[d.bands.length - 1].to, d.max)) p.push(`the last band must end at ${d.max}`);
  d.bands.forEach((b, i) => {
    if (!text(b.label) || !text(b.text)) p.push(`band ${i + 1} needs a label and text`);
    if (!num(b.from) || !num(b.to) || b.from >= b.to) p.push(`band ${i + 1} needs from < to`);
    if (i && !close(b.from, d.bands[i - 1].to)) p.push(`band ${i + 1} must start where band ${i} ends (${d.bands[i - 1].to})`);
  });
  if (p.length) return p;
  // Every formula must give a finite number everywhere in its own band.
  for (const b of d.bands) {
    for (const x of [b.from, (b.from + b.to) / 2, b.to]) {
      try {
        const out = bandText(b, x, n => { if (!Number.isFinite(n)) throw new Error('not finite'); return String(n); });
        void out;
      } catch (e) { p.push(`band "${b.label}" text formula fails at ${x}: ${(e as Error).message}`); break; }
    }
  }
  if (!Array.isArray(d.markers) || d.markers.length > 8) p.push('markers: 0-8');
  else for (const m of d.markers) if (!text(m.label) || !num(m.value) || m.value < d.min || m.value > d.max) p.push(`marker "${m.label}" must sit inside ${d.min}-${d.max}`);
  return p;
}

// ---------------------------------------------------------------------------
// range-bars
// ---------------------------------------------------------------------------

export interface RangeItem { label: string; from: number; to: number }
export interface DrawerRangeBarsData extends DrawerBase {
  variable: string;
  unit: string;
  min: number; max: number; value: number;
  items: RangeItem[];
  landmarks: ScaleMarker[];
}

/** Log scale when the range spans more than two powers of ten; code decides, not the model. */
export const rangeIsLog = (d: DrawerRangeBarsData) => d.min > 0 && d.max / d.min >= 100;

/** Position 0..1 on the scale for a value, and back. */
export function rangeScale(d: DrawerRangeBarsData) {
  if (rangeIsLog(d)) {
    const lo = Math.log10(d.min), hi = Math.log10(d.max);
    return { pos: (v: number) => (Math.log10(v) - lo) / (hi - lo), val: (t: number) => 10 ** (lo + t * (hi - lo)) };
  }
  return { pos: (v: number) => (v - d.min) / (d.max - d.min), val: (t: number) => d.min + t * (d.max - d.min) };
}

export function rangeBarsProblems(d: DrawerRangeBarsData): DrawerProblem[] {
  const p: DrawerProblem[] = [];
  if (!text(d.title) || !text(d.caption) || !text(d.variable)) p.push('title, caption and variable are required');
  if (![d.min, d.max, d.value].every(num) || d.min >= d.max) return [...p, 'min, max and value must be numbers with min < max'];
  if (d.value < d.min || d.value > d.max) p.push('value is outside min-max');
  if (!Array.isArray(d.items) || d.items.length < 2 || d.items.length > 8) return [...p, 'needs 2-8 items'];
  if (new Set(d.items.map(x => x.label)).size !== d.items.length) p.push('item labels must be unique');
  for (const x of d.items) {
    if (!text(x.label) || !num(x.from) || !num(x.to) || x.from >= x.to) p.push(`item "${x.label}" needs from < to`);
    else if (x.from < d.min || x.to > d.max) p.push(`item "${x.label}" (${x.from}-${x.to}) must fit inside ${d.min}-${d.max}`);
  }
  if (!Array.isArray(d.landmarks) || d.landmarks.length > 6) p.push('landmarks: 0-6');
  else for (const m of d.landmarks) if (!text(m.label) || !num(m.value) || m.value < d.min || m.value > d.max) p.push(`landmark "${m.label}" must sit inside ${d.min}-${d.max}`);
  return p;
}

// ---------------------------------------------------------------------------
// metric-switch
// ---------------------------------------------------------------------------

export interface SwitchMetric { label: string; unit: string; digits: number }
/** values[i] is the item's value for metrics[i]. */
export interface SwitchItem { label: string; values: number[] }
export interface DrawerMetricSwitchData extends DrawerBase {
  /** The label of one item to highlight in every ranking. */
  follow: string;
  metrics: SwitchMetric[];
  items: SwitchItem[];
}

/** Item indexes, largest first, for metric m. */
export const rankBy = (d: DrawerMetricSwitchData, m: number) =>
  d.items.map((_, i) => i).sort((a, b) => d.items[b].values[m] - d.items[a].values[m]);

export function metricSwitchProblems(d: DrawerMetricSwitchData): DrawerProblem[] {
  const p: DrawerProblem[] = [];
  if (!text(d.title) || !text(d.caption)) p.push('title and caption are required');
  if (!Array.isArray(d.metrics) || d.metrics.length < 2 || d.metrics.length > 4) return [...p, 'needs 2-4 metrics'];
  if (!Array.isArray(d.items) || d.items.length < 3 || d.items.length > 10) return [...p, 'needs 3-10 items'];
  d.metrics.forEach((m, i) => {
    if (!text(m.label)) p.push(`metric ${i + 1} needs a label`);
    if (!num(m.digits) || m.digits < 0 || m.digits > 3) p.push(`metric ${i + 1} digits must be 0-3`);
  });
  if (new Set(d.items.map(x => x.label)).size !== d.items.length) p.push('item labels must be unique');
  for (const x of d.items) {
    if (!Array.isArray(x.values) || x.values.length !== d.metrics.length) p.push(`item "${x.label}" needs one value per metric (${d.metrics.length})`);
    else if (!x.values.every(v => num(v) && v >= 0)) p.push(`item "${x.label}" has a value that is not a non-negative number`);
  }
  if (d.follow && !d.items.some(x => x.label === d.follow)) p.push(`follow names "${d.follow}", which is not an item`);
  if (p.length) return p;
  // Switching must change the order, or the drawer teaches nothing.
  const orders = d.metrics.map((_, m) => rankBy(d, m).join(','));
  if (new Set(orders).size < 2) p.push('every metric ranks the items in the same order; pick metrics that disagree');
  return p;
}
