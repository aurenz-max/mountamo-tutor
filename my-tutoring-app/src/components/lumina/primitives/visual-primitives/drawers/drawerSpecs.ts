/**
 * Drawer specs: what each drawer kind's generator emits, and the code checks a spec must pass
 * before a learner sees it. Pure, so the generator, the component and the tests share one
 * definition. A drawer is ungraded exposition: Gemini writes data, the renderer draws it, and
 * code computes every number shown.
 */
import { compileExpr, type Env } from './drawerExpr';

export interface DrawerBase {
  title: string;
  /** One sentence: what to look for. */
  caption: string;
  instanceId?: string;
}

/** A check failure, in words a developer can act on. */
export type DrawerProblem = string;

export const IDENT = /^[A-Za-z_]\w*$/;
export const RESERVED = new Set(['min', 'max', 'sqrt', 'abs', 'round', 'floor', 'ceil', 'log10', 'ln', 'exp']);
export const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
export const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// ---------------------------------------------------------------------------
// model-slider: inputs on sliders, outputs from formulas
// ---------------------------------------------------------------------------

export interface ModelSliderInput { id: string; label: string; unit: string; min: number; max: number; step: number; value: number }
export interface ModelSliderOutput { id: string; label: string; unit: string; expr: string; digits: number; primary?: boolean }
export interface ModelSliderCheck {
  /** Input settings for the known fact; inputs not named keep their default. */
  set: Env;
  output: string;
  expect: number;
  tolerance: number;
  /** The fact in words, e.g. "At 50 km/h on a dry road a car needs about 28 m to stop." */
  fact: string;
}
export interface DrawerModelSliderData extends DrawerBase {
  inputs: ModelSliderInput[];
  outputs: ModelSliderOutput[];
  /** Output ids drawn as one stacked bar (their sum), or empty for no bar. */
  barParts: string[];
  check: ModelSliderCheck;
}

/** Every output at one input setting, in order, so later outputs can use earlier ones. */
export function evaluateModel(d: Pick<DrawerModelSliderData, 'outputs'>, inputs: Env): Env {
  const env: Env = { ...inputs };
  for (const o of d.outputs) env[o.id] = compileExpr(o.expr)(env);
  return env;
}

export const defaultInputs = (d: Pick<DrawerModelSliderData, 'inputs'>): Env =>
  Object.fromEntries(d.inputs.map(x => [x.id, x.value]));

/** Every combination of each input's min and max: where a formula most often goes wrong. */
export function corners(inputs: ModelSliderInput[]): Env[] {
  return inputs.reduce<Env[]>((acc, x) => acc.flatMap(e => [{ ...e, [x.id]: x.min }, { ...e, [x.id]: x.max }]), [{}]);
}

export function modelSliderProblems(d: DrawerModelSliderData): DrawerProblem[] {
  const p: DrawerProblem[] = [];
  if (!text(d.title) || !text(d.caption)) p.push('title and caption are required');
  if (!Array.isArray(d.inputs) || d.inputs.length < 1 || d.inputs.length > 3) p.push('needs 1-3 inputs');
  if (!Array.isArray(d.outputs) || d.outputs.length < 1 || d.outputs.length > 3) p.push('needs 1-3 outputs');
  if (p.length) return p;
  const ids = [...d.inputs.map(x => x.id), ...d.outputs.map(o => o.id)];
  if (new Set(ids).size !== ids.length) p.push('input and output ids must be unique');
  for (const id of ids) if (!IDENT.test(id) || RESERVED.has(id)) p.push(`"${id}" is not a usable name`);
  for (const x of d.inputs) {
    if (!text(x.label)) p.push(`input ${x.id} needs a label`);
    if (![x.min, x.max, x.step, x.value].every(num) || x.min >= x.max || x.step <= 0) p.push(`input ${x.id} has a bad range`);
    else {
      if (x.value < x.min || x.value > x.max) p.push(`input ${x.id} default is outside its range`);
      if ((x.max - x.min) / x.step > 1000) p.push(`input ${x.id} has too many steps`);
    }
  }
  for (const o of d.outputs) {
    if (!text(o.label)) p.push(`output ${o.id} needs a label`);
    if (!num(o.digits) || o.digits < 0 || o.digits > 3) p.push(`output ${o.id} digits must be 0-3`);
    try { compileExpr(o.expr); } catch (e) { p.push(`output ${o.id}: ${(e as Error).message}`); }
  }
  if (!Array.isArray(d.barParts) || (d.barParts.length !== 0 && d.barParts.length < 2)) p.push('barParts is empty or names 2-3 outputs');
  else for (const id of d.barParts) if (!d.outputs.some(o => o.id === id)) p.push(`barParts names unknown output ${id}`);
  if (p.length) return p;
  // Every output must be a finite number at the default and at every corner of the input space.
  for (const env of [defaultInputs(d), ...corners(d.inputs)]) {
    try {
      const out = evaluateModel(d, env);
      for (const o of d.outputs) if (!Number.isFinite(out[o.id])) { p.push(`output ${o.id} is not a number at ${JSON.stringify(env)}`); break; }
      for (const id of d.barParts) if (out[id] < 0) { p.push(`bar part ${id} is negative at ${JSON.stringify(env)}`); break; }
    } catch (e) { return [(e as Error).message]; }
    if (p.length) return p;
  }
  return checkProblems(d);
}

function checkProblems(d: DrawerModelSliderData): DrawerProblem[] {
  const c = d.check;
  if (!c || !text(c.fact) || !num(c.expect) || !num(c.tolerance) || !d.outputs.some(o => o.id === c.output))
    return ['check needs a fact, an output id, an expected value and a tolerance'];
  for (const k of Object.keys(c.set ?? {})) if (!d.inputs.some(x => x.id === k)) return [`check sets unknown input ${k}`];
  // A fact at the starting setting can be met by fitting a constant to it; one elsewhere tests the formula.
  const defaults = defaultInputs(d);
  if (!Object.entries(c.set ?? {}).some(([k, v]) => v !== defaults[k])) return ['check must use a setting different from the starting values'];
  // A tolerance wider than 5% of the expected value proves nothing.
  const tol = Math.min(Math.abs(c.tolerance), Math.max(Math.abs(c.expect) * 0.05, 1e-6));
  const got = evaluateModel(d, { ...defaultInputs(d), ...c.set })[c.output];
  return Math.abs(got - c.expect) <= tol ? [] : [`check failed: "${c.fact}" expects ${c.expect}, the formula gives ${got}`];
}

// ---------------------------------------------------------------------------
// part-whole: a whole split into parts, with an optional breakdown of one part
// ---------------------------------------------------------------------------

export interface PartWholePart { label: string; value: number; /** Label of the part this one breaks down; empty for a top-level part. */ parent: string }
export interface DrawerPartWholeData extends DrawerBase {
  /** What the whole is, e.g. "the air". */
  wholeLabel: string;
  /** Unit of every value, e.g. "%" or "million km³". */
  unit: string;
  total: number;
  parts: PartWholePart[];
}

export const topParts = (d: DrawerPartWholeData) => d.parts.filter(x => !x.parent);
export const childParts = (d: DrawerPartWholeData, label: string) => d.parts.filter(x => x.parent === label);

export function partWholeProblems(d: DrawerPartWholeData): DrawerProblem[] {
  const p: DrawerProblem[] = [];
  if (!text(d.title) || !text(d.caption) || !text(d.wholeLabel)) p.push('title, caption and wholeLabel are required');
  if (!num(d.total) || d.total <= 0) p.push('total must be a positive number');
  if (!Array.isArray(d.parts)) return [...p, 'parts are required'];
  const labels = d.parts.map(x => x.label);
  if (new Set(labels).size !== labels.length) p.push('part labels must be unique');
  for (const x of d.parts) {
    if (!text(x.label) || !num(x.value) || x.value <= 0) p.push(`part "${x.label}" needs a label and a positive value`);
    if (x.parent && !d.parts.some(y => y.label === x.parent && !y.parent)) p.push(`part "${x.label}" breaks down "${x.parent}", which is not a top-level part`);
  }
  const top = topParts(d);
  if (top.length < 2 || top.length > 6) p.push('needs 2-6 top-level parts');
  if (p.length) return p;
  const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(b) * 0.005, 1e-9);
  const sum = top.reduce((s, x) => s + x.value, 0);
  if (!close(sum, d.total)) p.push(`top-level parts sum to ${sum}, not the total ${d.total}`);
  for (const t of top) {
    const kids = childParts(d, t.label);
    if (kids.length === 1) p.push(`"${t.label}" has a breakdown of only one part`);
    if (kids.length > 1) {
      const s = kids.reduce((a, x) => a + x.value, 0);
      if (!close(s, t.value)) p.push(`the breakdown of "${t.label}" sums to ${s}, not ${t.value}`);
    }
  }
  return p;
}

/** Largest-remainder rounding of top-level parts into 100 squares. */
export function waffleCells(d: DrawerPartWholeData): number[] {
  const raw = topParts(d).map(x => (x.value / d.total) * 100);
  const cells = raw.map(Math.floor);
  const left = 100 - cells.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, i]) => { cells[i]++; });
  return cells;
}

// ---------------------------------------------------------------------------
// cause-chain: a linear chain of effects revealed one link at a time
// ---------------------------------------------------------------------------

export interface CauseChainNode { id: string; label: string }
export interface CauseChainLink { from: string; to: string; /** 'same': the next thing moves the same way; 'opposite': the other way. */ effect: 'same' | 'opposite'; because: string }
export interface DrawerCauseChainData extends DrawerBase {
  /** In order: the first node is the change the learner starts. */
  nodes: CauseChainNode[];
  /** links[i] joins nodes[i] to nodes[i + 1]. */
  links: CauseChainLink[];
}

export function causeChainProblems(d: DrawerCauseChainData): DrawerProblem[] {
  const p: DrawerProblem[] = [];
  if (!text(d.title) || !text(d.caption)) p.push('title and caption are required');
  if (!Array.isArray(d.nodes) || d.nodes.length < 3 || d.nodes.length > 5) return [...p, 'needs 3-5 nodes'];
  if (!Array.isArray(d.links) || d.links.length !== d.nodes.length - 1) return [...p, 'needs one link between each pair of neighbouring nodes'];
  if (new Set(d.nodes.map(n => n.id)).size !== d.nodes.length) p.push('node ids must be unique');
  d.nodes.forEach(n => { if (!text(n.id) || !text(n.label)) p.push('every node needs an id and a label'); });
  d.links.forEach((l, i) => {
    if (l.from !== d.nodes[i].id || l.to !== d.nodes[i + 1].id) p.push(`link ${i + 1} must join ${d.nodes[i].id} to ${d.nodes[i + 1].id}`);
    if (l.effect !== 'same' && l.effect !== 'opposite') p.push(`link ${i + 1} effect must be same or opposite`);
    if (!text(l.because)) p.push(`link ${i + 1} needs a reason`);
  });
  return p;
}

/** Direction of every node after the first moves `start` (+1 up, -1 down). */
export function propagate(d: DrawerCauseChainData, start: 1 | -1): Array<1 | -1> {
  const dirs: Array<1 | -1> = [start];
  d.links.forEach((l, i) => { dirs.push((l.effect === 'same' ? dirs[i] : -dirs[i]) as 1 | -1); });
  return dirs;
}
