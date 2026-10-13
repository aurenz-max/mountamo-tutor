/**
 * Growth and chance drawers: unit chain (a rate multiplied up step by step), ratio scaler (a
 * recipe that keeps its ratio), growth race (adding against multiplying), chance run (an
 * experiment repeated until it settles). Code computes every number and checks every spec.
 */
import { compileExpr, type Env } from './drawerExpr';
import { corners, defaultInputs, IDENT, num, RESERVED, text, type DrawerBase, type DrawerProblem, type ModelSliderInput } from './drawerSpecs';

/** A known fact the spec must reproduce, as in model-slider. */
export interface DrawerFactCheck { set: Env; expect: number; tolerance: number; fact: string }

/** Tolerance capped at 5% of the expected value, so a wide tolerance cannot pass a wrong formula. */
const agrees = (got: number, c: DrawerFactCheck) =>
  Math.abs(got - c.expect) <= Math.min(Math.abs(c.tolerance), Math.max(Math.abs(c.expect) * 0.05, 1e-6));

function inputProblems(inputs: ModelSliderInput[], max: number): DrawerProblem[] {
  const p: DrawerProblem[] = [];
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > max) return [`needs 1-${max} inputs`];
  for (const x of inputs) {
    if (!IDENT.test(x.id ?? '') || RESERVED.has(x.id)) p.push(`"${x.id}" is not a usable name`);
    if (!text(x.label)) p.push(`input ${x.id} needs a label`);
    if (![x.min, x.max, x.step, x.value].every(num) || x.min >= x.max || x.step <= 0) p.push(`input ${x.id} has a bad range`);
    else if (x.value < x.min || x.value > x.max) p.push(`input ${x.id} default is outside its range`);
    else if ((x.max - x.min) / x.step > 1000) p.push(`input ${x.id} has too many steps`);
  }
  if (new Set(inputs.map(x => x.id)).size !== inputs.length) p.push('input ids must be unique');
  return p;
}

// ---------------------------------------------------------------------------
// unit-chain
// ---------------------------------------------------------------------------

export interface UnitChainStep { /** Multiplier as a formula over input ids, e.g. "60" or "years". */ times: string; label: string; why: string }
export interface DrawerUnitChainData extends DrawerBase {
  /** What the final number counts, e.g. "heartbeats". */
  finalNoun: string;
  inputs: ModelSliderInput[];
  startExpr: string;
  startLabel: string;
  steps: UnitChainStep[];
  /** A fact about the final value. */
  check: DrawerFactCheck;
}

/** The value at the start and after each step. */
export function unitChainValues(d: DrawerUnitChainData, env: Env): number[] {
  const out = [compileExpr(d.startExpr)(env)];
  for (const s of d.steps) out.push(out[out.length - 1] * compileExpr(s.times)(env));
  return out;
}

export function unitChainProblems(d: DrawerUnitChainData): DrawerProblem[] {
  const p: DrawerProblem[] = [];
  if (!text(d.title) || !text(d.caption) || !text(d.finalNoun) || !text(d.startLabel)) p.push('title, caption, finalNoun and startLabel are required');
  p.push(...inputProblems(d.inputs, 2));
  if (!Array.isArray(d.steps) || d.steps.length < 2 || d.steps.length > 6) p.push('needs 2-6 steps');
  if (p.length) return p;
  for (const s of d.steps) if (!text(s.label) || !text(s.why)) p.push('every step needs a label and a reason');
  for (const src of [d.startExpr, ...d.steps.map(s => s.times)]) {
    try { compileExpr(src); } catch (e) { p.push((e as Error).message); }
  }
  if (p.length) return p;
  for (const env of [defaultInputs(d), ...corners(d.inputs)]) {
    try {
      const vals = unitChainValues(d, env);
      if (!vals.every(v => Number.isFinite(v) && v > 0)) return [`every value must be a positive number; at ${JSON.stringify(env)} the chain gives ${vals.join(', ')}`];
    } catch (e) { return [(e as Error).message]; }
  }
  const c = d.check;
  if (!c || !text(c.fact) || !num(c.expect) || !num(c.tolerance)) return ['check needs a fact, an expected value and a tolerance'];
  for (const k of Object.keys(c.set ?? {})) if (!d.inputs.some(x => x.id === k)) return [`check sets unknown input ${k}`];
  const got = unitChainValues(d, { ...defaultInputs(d), ...c.set }).at(-1)!;
  return agrees(got, c) ? [] : [`check failed: "${c.fact}" expects ${c.expect}, the chain gives ${got}`];
}

// ---------------------------------------------------------------------------
// ratio-scaler
// ---------------------------------------------------------------------------

export interface RatioIngredient { label: string; amount: number; unit: string }
export interface DrawerRatioScalerData extends DrawerBase {
  /** How much the base recipe makes, in unitLabel. */
  base: number;
  unitLabel: string;
  min: number; max: number; step: number; value: number;
  ingredients: RatioIngredient[];
}

export function ratioScalerProblems(d: DrawerRatioScalerData): DrawerProblem[] {
  const p: DrawerProblem[] = [];
  if (!text(d.title) || !text(d.caption) || !text(d.unitLabel)) p.push('title, caption and unitLabel are required');
  if (![d.base, d.min, d.max, d.step, d.value].every(num) || d.min >= d.max || d.step <= 0 || d.base <= 0 || d.min <= 0) return [...p, 'base, min, max, step and value must be positive numbers with min < max'];
  if (d.base < d.min || d.base > d.max) p.push('base must be inside min-max, so the original recipe is on the slider');
  if (d.value < d.min || d.value > d.max) p.push('value is outside min-max');
  if ((d.max - d.min) / d.step > 200) p.push('step is too small for the range');
  if (!Array.isArray(d.ingredients) || d.ingredients.length < 2 || d.ingredients.length > 7) return [...p, 'needs 2-7 ingredients'];
  for (const x of d.ingredients) if (!text(x.label) || !num(x.amount) || x.amount <= 0) p.push(`ingredient "${x.label}" needs a label and a positive amount`);
  return p;
}

/** Greatest common divisor of two positive integers. */
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** "3/2" for 12 of a base of 8; whole numbers stay whole. */
export function scaleFactor(value: number, base: number): string {
  if (!Number.isInteger(value) || !Number.isInteger(base)) return `${Number((value / base).toFixed(2))}`;
  const g = gcd(value, base);
  return base / g === 1 ? `${value / g}` : `${value / g}/${base / g}`;
}

/** Kitchen amounts: nearest half, third, quarter or eighth when close, otherwise two decimals. */
export function formatAmount(v: number): string {
  const whole = Math.floor(v + 1e-9);
  const frac = v - whole;
  if (frac < 0.01) return `${whole}`;
  for (const den of [2, 3, 4, 8]) {
    const n = Math.round(frac * den);
    if (n > 0 && n < den && Math.abs(frac - n / den) < 0.01) {
      const g = gcd(n, den);
      return `${whole ? `${whole} ` : ''}${n / g}/${den / g}`;
    }
  }
  return `${Number(v.toFixed(2))}`;
}

// ---------------------------------------------------------------------------
// growth-race
// ---------------------------------------------------------------------------

export interface GrowthSeries { label: string; /** Formula in x, e.g. "10*x" or "0.01*2^x". */ expr: string }
export interface DrawerGrowthRaceData extends DrawerBase {
  xLabel: string;
  /** Unit of the series values, e.g. "$" or "bacteria". */
  unit: string;
  min: number; max: number; value: number;
  series: GrowthSeries[];
  /** A fact about one series at one x. */
  check: { series: number; at: number; expect: number; tolerance: number; fact: string };
}

export const growthAt = (d: DrawerGrowthRaceData, i: number, x: number) => compileExpr(d.series[i].expr)({ x });

/** The x from which the multiplying series (index 1) stays ahead to the end, or null if it never does. */
export function crossingX(d: DrawerGrowthRaceData): number | null {
  if (growthAt(d, 1, d.max) <= growthAt(d, 0, d.max)) return null;
  let x = d.max;
  while (x > d.min && growthAt(d, 1, x - 1) > growthAt(d, 0, x - 1)) x--;
  return x;
}

export function growthRaceProblems(d: DrawerGrowthRaceData): DrawerProblem[] {
  const p: DrawerProblem[] = [];
  if (!text(d.title) || !text(d.caption) || !text(d.xLabel)) p.push('title, caption and xLabel are required');
  if (![d.min, d.max, d.value].every(v => Number.isInteger(v)) || d.min >= d.max || d.max - d.min > 200) return [...p, 'min, max and value must be whole numbers, min < max, at most 200 apart'];
  if (d.value < d.min || d.value > d.max) p.push('value is outside min-max');
  if (!Array.isArray(d.series) || d.series.length !== 2) return [...p, 'needs exactly 2 series'];
  for (const s of d.series) {
    if (!text(s.label)) p.push('every series needs a label');
    try { compileExpr(s.expr); } catch (e) { p.push(`series "${s.label}": ${(e as Error).message}`); }
  }
  if (p.length) return p;
  for (let x = d.min; x <= d.max; x++) {
    for (let i = 0; i < 2; i++) {
      let v: number;
      try { v = growthAt(d, i, x); } catch (e) { return [`series "${d.series[i].label}": ${(e as Error).message}`]; }
      if (!Number.isFinite(v) || v < 0) return [`series "${d.series[i].label}" is not a non-negative number at x=${x}`];
    }
  }
  // The race reads as "adding leads, then multiplying overtakes": the first series leads at the start, the second at the end.
  if (growthAt(d, 1, d.min) > growthAt(d, 0, d.min)) p.push(`series "${d.series[0].label}" must be ahead (or level) at x=${d.min}`);
  if (crossingX(d) === null) p.push(`series "${d.series[1].label}" never overtakes "${d.series[0].label}" by x=${d.max}; the race needs a crossing`);
  const c = d.check;
  if (!c || !text(c.fact) || ![c.series, c.at, c.expect, c.tolerance].every(num) || (c.series !== 0 && c.series !== 1)) return [...p, 'check needs a series (0 or 1), an x, an expected value and a tolerance'];
  if (c.at < d.min || c.at > d.max) return [...p, 'check x is outside min-max'];
  const got = growthAt(d, c.series, c.at);
  if (!agrees(got, { set: {}, ...c })) p.push(`check failed: "${c.fact}" expects ${c.expect}, the formula gives ${got}`);
  return p;
}

// ---------------------------------------------------------------------------
// chance-run
// ---------------------------------------------------------------------------

export interface ChanceSource { label: string; /** Equally likely outcomes; repeat one to weight it. */ outcomes: string[] }
export interface DrawerChanceRunData extends DrawerBase {
  sources: ChanceSource[];
  /** 'sum': add the numbers that come up. 'together': the result is the set of outcomes, order ignored. */
  combine: 'sum' | 'together';
}

const resultKey = (d: DrawerChanceRunData, picks: string[]) =>
  d.combine === 'sum' ? String(picks.reduce((s, x) => s + Number(x), 0)) : [...picks].sort().join(' + ');

/** Every possible result and its exact chance, in display order. */
export function chanceDistribution(d: DrawerChanceRunData): Array<{ key: string; p: number }> {
  let combos: Array<{ picks: string[]; p: number }> = [{ picks: [], p: 1 }];
  for (const s of d.sources) {
    combos = combos.flatMap(c => s.outcomes.map(o => ({ picks: [...c.picks, o], p: c.p / s.outcomes.length })));
  }
  const m = new Map<string, number>();
  for (const c of combos) { const k = resultKey(d, c.picks); m.set(k, (m.get(k) ?? 0) + c.p); }
  const out = Array.from(m.entries()).map(([key, p]) => ({ key, p }));
  return d.combine === 'sum' ? out.sort((a, b) => Number(a.key) - Number(b.key)) : out;
}

/** One trial's result. */
export function chanceTrial(d: DrawerChanceRunData, rand: () => number = Math.random): string {
  return resultKey(d, d.sources.map(s => s.outcomes[Math.floor(rand() * s.outcomes.length)]));
}

export function chanceRunProblems(d: DrawerChanceRunData): DrawerProblem[] {
  const p: DrawerProblem[] = [];
  if (!text(d.title) || !text(d.caption)) p.push('title and caption are required');
  if (d.combine !== 'sum' && d.combine !== 'together') p.push('combine must be sum or together');
  if (!Array.isArray(d.sources) || d.sources.length < 1 || d.sources.length > 3) return [...p, 'needs 1-3 sources'];
  for (const s of d.sources) {
    if (!text(s.label) || !Array.isArray(s.outcomes) || s.outcomes.length < 2 || s.outcomes.length > 12) p.push(`source "${s.label}" needs a label and 2-12 outcomes`);
    else if (!s.outcomes.every(text)) p.push(`source "${s.label}" has an empty outcome`);
    else if (d.combine === 'sum' && !s.outcomes.every(o => num(Number(o)) && o.trim() !== '')) p.push(`source "${s.label}" outcomes must be numbers to add them`);
  }
  if (p.length) return p;
  const n = chanceDistribution(d).length;
  if (n < 2) p.push('the experiment has only one possible result');
  if (n > 24) p.push(`the experiment has ${n} possible results; at most 24 fit on the chart`);
  return p;
}
