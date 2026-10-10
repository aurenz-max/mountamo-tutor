/**
 * parameter-explorer's in-item levers (/add-support-tiers; report qa/eval-reports/parameter-explorer-levers-2026-10-09.md).
 * The misses are what `parameterMiss` observes on the chosen direction, the typed value or the chosen parameter; there is
 * no real-learner evidence.
 *
 * - predict-direction: `find_parameter` (help) rings the changed parameter wherever it sits in the formula;
 *   `model_pair` (help) a picture outside the item: y = k × x and y = k ÷ x with x moving from one number to the next,
 *   and what each gives; `simpler_problem` (simplify) the same mode on a parameter that only multiplies, doubled, when
 *   the item's parameter divides, is raised to a power or only adds.
 * - predict-value: `substitution` (help) the formula with the asked setting written in, not worked out (refused when it
 *   would print the answer); `scaling_model` (help) three rules outside the item with x doubled: y = k × x, y = k × x²,
 *   y = k ÷ x; `simpler_problem` (simplify) the same formula with one parameter doubled or halved from its start.
 * - identify-relationship: `double_marks` (help, where the output readout is on screen) a mark at each slider's start
 *   and at its double, and a Back to start button, so the learner can run the doubling test; `doubling_model` (help)
 *   three rules outside the item, y = k × x, y = k × x², y = x + k, with x doubled. No simplify: the lesson has one
 *   formula, and any smaller item on it asks the same question with the same key.
 * - explore credits every move and names no miss, so it has no lever.
 *
 * Leak rules (code): no lever text or fact names a direction, a value at the asked setting or a parameter that leads;
 * the models use letters the item does not use and none of its numbers; the substitution never prints the answer; a
 * practice item has its own id, keeps the mode and never repeats the item's setting.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { ParameterExplorerChallenge, ParameterExplorerData } from './ParameterExplorer';
import {
  askedOutput, evaluateFormula, formatOutput, formulaDirection, plainFormula, startingValues, type ParameterExplorerMiss,
} from './parameterExplorerWorkspace';

type Lab = Pick<ParameterExplorerData, 'formula' | 'jsExpression' | 'outputName' | 'outputUnit' | 'parameters'>;

export const FIND_PARAMETER_LEVER = 'find_parameter';
export const MODEL_PAIR_LEVER = 'model_pair';
export const SUBSTITUTION_LEVER = 'substitution';
export const SCALING_MODEL_LEVER = 'scaling_model';
export const DOUBLE_MARKS_LEVER = 'double_marks';
export const DOUBLING_MODEL_LEVER = 'doubling_model';
export const SIMPLER_LEVER = 'simpler_problem';

const SIMPLER = '~simpler';
export const isPracticeParameter = (c: Pick<ParameterExplorerChallenge, 'id'>) => c.id.endsWith(SIMPLER);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

const close = (a: number, b: number, rel = 1e-9) => a === b || Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b));
const onGrid = (p: Lab['parameters'][number], value: number) => {
  const k = (value - p.min) / (p.step > 0 ? p.step : 1);
  return value >= p.min && value <= p.max && Math.abs(k - Math.round(k)) < 1e-6 && !close(value, p.default);
};

/** The parameter only multiplies the output: doubling it from the start doubles the output (and the output is not 0). */
export function onlyMultiplies(d: Lab, symbol: string): boolean {
  const p = d.parameters.find(x => x.symbol === symbol);
  if (!p) return false;
  const f = evaluateFormula(d.jsExpression, startingValues(d));
  const g = evaluateFormula(d.jsExpression, { ...startingValues(d), [symbol]: p.default * 2 });
  return f !== null && g !== null && f !== 0 && close(g, 2 * f, 1e-6);
}

/** Doubled, else halved, on the slider's grid: the easy setting a simpler item moves to. */
const easySetting = (p: Lab['parameters'][number]) => [p.default * 2, p.default / 2].find(v => onGrid(p, v));

/**
 * The easier practice problem for `c`, or null when the item is already the simple shape or the mode has none:
 * - predict-direction: when the item's parameter does not only multiply, the same formula with a parameter that only
 *   multiplies, doubled (or halved);
 * - predict-value: the same formula with one parameter doubled or halved from its start (one that only multiplies
 *   first), never the item's setting, with an answer not within 5% of the item's.
 */
export function simplerParameter(d: Lab, c: ParameterExplorerChallenge): ParameterExplorerChallenge | null {
  if (isPracticeParameter(c) || !c.prediction) return null;
  const id = `${c.id}${SIMPLER}`;
  let practice: ParameterExplorerChallenge | null = null;
  if (c.type === 'predict-direction') {
    if (onlyMultiplies(d, c.prediction.varyParameter)) return null;
    for (const p of d.parameters.filter(x => x.symbol !== c.prediction!.varyParameter && onlyMultiplies(d, x.symbol))) {
      const newValue = easySetting(p);
      if (newValue === undefined) continue;
      const draft: ParameterExplorerChallenge = { ...c, id, instruction: '', prediction: { varyParameter: p.symbol, newValue, explanation: '' } };
      const direction = formulaDirection(d, draft);
      if (!direction) continue;
      practice = { ...draft, prediction: { ...draft.prediction!, correctDirection: direction } };
      break;
    }
  } else if (c.type === 'predict-value') {
    const key = askedOutput(d, c);
    if (key === null) return null;
    const order = [...d.parameters].sort((a, b) => Number(onlyMultiplies(d, b.symbol)) - Number(onlyMultiplies(d, a.symbol)));
    for (const p of order) {
      for (const newValue of [p.default * 2, p.default / 2].filter(v => onGrid(p, v))) {
        const draft: ParameterExplorerChallenge = { ...c, id, instruction: '',
          prediction: { varyParameter: p.symbol, newValue, tolerance: undefined, explanation: '' } };
        const answer = askedOutput(d, draft);
        if (answer === null) continue;
        const settled = { ...draft, prediction: { ...draft.prediction!, correctValue: answer } };
        if (!practiceLeaks(d, c, settled)) { practice = settled; break; }
      }
      if (practice) break;
    }
  }
  return practice && !practiceLeaks(d, c, practice) ? practice : null;
}

/** Leak rule for a practice problem: never the learner's item (its id, its setting, or an answer within 5% of its). */
export function practiceLeaks(d: Lab, parent: ParameterExplorerChallenge, practice: ParameterExplorerChallenge): boolean {
  if (practice.id === parent.id || practice.type !== parent.type || !practice.prediction || !parent.prediction) return true;
  const same = practice.prediction.varyParameter === parent.prediction.varyParameter;
  if (parent.type === 'predict-direction') return same;
  if (same && close(practice.prediction.newValue ?? NaN, parent.prediction.newValue ?? NaN)) return true;
  const a = askedOutput(d, parent), b = askedOutput(d, practice);
  return a === null || b === null || Math.abs(a - b) <= 0.05 * Math.abs(a);
}

// ── pictures outside the item ────────────────────────────────────────────

/** Two letters the item does not use, for models outside it. */
function modelLetters(d: Lab): [string, string] {
  const used = new Set([...d.parameters.map(p => p.symbol.toLowerCase()), d.formula.split('=')[0].trim().toLowerCase()]);
  const pairs: [string, string][] = [['x', 'y'], ['p', 'q'], ['a', 'b'], ['s', 'w'], ['j', 'z']];
  return pairs.find(([a, b]) => !used.has(a) && !used.has(b)) ?? ['n', 'u'];
}

/** Every number the item shows or answers with, so a model can avoid them. */
function itemNumbers(d: Lab, c: ParameterExplorerChallenge): Set<string> {
  const start = evaluateFormula(d.jsExpression, startingValues(d)), asked = askedOutput(d, c);
  const values = [...d.parameters.flatMap(p => [p.default, p.default * 2, p.min, p.max]), c.prediction?.newValue, start, asked];
  return new Set(values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).map(formatOutput));
}

export interface ModelRow { rule: string; from: number; to: number; outFrom: number; outTo: number }
export interface Model { input: string; output: string; rows: ModelRow[] }

const SETS: Array<[number, number, number]> = [[6, 2, 3], [12, 3, 4], [20, 4, 5], [30, 5, 6], [42, 6, 7], [90, 9, 10]];
const DOUBLING: Array<[number, number]> = [[3, 2], [5, 3], [2, 6], [7, 4], [4, 5], [3, 9], [6, 9], [7, 6], [2, 11]];

function pickModel(d: Lab, c: ParameterExplorerChallenge, build: (x: string, y: string) => Array<ModelRow[]>): Model | null {
  const [x, y] = modelLetters(d), avoid = itemNumbers(d, c);
  for (const rows of build(x, y)) {
    const shown = rows.flatMap(r => [r.from, r.to, r.outFrom, r.outTo, ...(r.rule.match(/\d+(\.\d+)?/g) ?? []).map(Number)]).map(formatOutput);
    if (!shown.some(n => avoid.has(n))) return { input: x, output: y, rows };
  }
  return null;
}

/** y = k × x and y = k ÷ x with x moving up one, on numbers none of the item's. */
export const modelPair = (d: Lab, c: ParameterExplorerChallenge) => pickModel(d, c, (x, y) => SETS.map(([k, from, to]) => [
  { rule: `${y} = ${k} × ${x}`, from, to, outFrom: k * from, outTo: k * to },
  { rule: `${y} = ${k} ÷ ${x}`, from, to, outFrom: k / from, outTo: k / to },
]));

/** y = k × x, y = k × x² and y = k ÷ x with x doubled, on numbers none of the item's. */
export const scalingModel = (d: Lab, c: ParameterExplorerChallenge) => pickModel(d, c, (x, y) => DOUBLING.map(([k, from]) => [
  { rule: `${y} = ${k} × ${x}`, from, to: from * 2, outFrom: k * from, outTo: k * from * 2 },
  { rule: `${y} = ${k} × ${x}²`, from, to: from * 2, outFrom: k * from * from, outTo: k * 4 * from * from },
  { rule: `${y} = ${k * from * 2} ÷ ${x}`, from, to: from * 2, outFrom: k * 2, outTo: k },
]));

/** y = k × x, y = k × x² and y = x + k with x doubled, on numbers none of the item's. */
export const doublingModel = (d: Lab, c: ParameterExplorerChallenge) => pickModel(d, c, (x, y) => DOUBLING.map(([k, from]) => [
  { rule: `${y} = ${k} × ${x}`, from, to: from * 2, outFrom: k * from, outTo: k * from * 2 },
  { rule: `${y} = ${k} × ${x}²`, from, to: from * 2, outFrom: k * from * from, outTo: k * 4 * from * from },
  { rule: `${y} = ${x} + ${k}`, from, to: from * 2, outFrom: from + k, outTo: from * 2 + k },
]));

/** The formula with the asked setting written in, not worked out. */
export function substitutionText(d: Lab, c: ParameterExplorerChallenge): string {
  const values = { ...startingValues(d), ...(c.prediction?.newValue !== undefined ? { [c.prediction.varyParameter]: c.prediction.newValue } : {}) };
  const [lhs, rhs] = plainFormula(d).includes(' = ') ? plainFormula(d).split(' = ') : ['', plainFormula(d)];
  const written = rhs.split(/([A-Za-z_][A-Za-z0-9_]*)/).map(t => (t in values ? formatOutput(values[t]) : t)).join('');
  return lhs ? `${lhs} = ${written}` : written;
}

/** Leak rule for the substitution: it never prints the answer as one of its numbers. */
export function substitutionLeaks(d: Lab, c: ParameterExplorerChallenge): boolean {
  const key = askedOutput(d, c);
  const numbers: string[] = substitutionText(d, c).match(/-?\d+(\.\d+)?(e[+-]?\d+)?/gi) ?? [];
  return key === null || numbers.includes(formatOutput(key));
}

/** The sliders whose double still fits on the slider, for the doubling marks. */
export const doubleMarks = (d: Lab) => d.parameters.filter(p => p.default !== 0 && p.default * 2 <= p.max && p.default * 2 >= p.min)
  .map(p => ({ symbol: p.symbol, start: p.default, double: p.default * 2 }));

/** Leak rule for lever words: no direction (predict-direction's key). */
export const DIRECTION_WORDS = /\b(increases?|decreases?|more|less|bigger|smaller|larger|grows?|shrinks?|up|down|higher|lower|rises?|falls?|stays? the same)\b/i;
export const leverTextLeaks = (text: string) => DIRECTION_WORDS.test(text);

// ── declarations ─────────────────────────────────────────────────────────

export interface ParameterLeverContext {
  /** The numeric output readout is on screen on this item (identify's doubling test needs it). */
  outputShown: boolean;
}

export function parameterLevers(d: Lab, c: ParameterExplorerChallenge | null, pulled: readonly string[],
  ctx: ParameterLeverContext): WorkspaceLever[] {
  if (!c || isPracticeParameter(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly ParameterExplorerMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const simpler = simplerParameter(d, c);
  switch (c.type) {
    case 'predict-direction': {
      const pair = modelPair(d, c);
      return [
        lever(FIND_PARAMETER_LEVER, 'help', 'shown', ['opposite_direction', 'missed_change', 'invented_change'],
          'The learner predicts without looking at where the changed parameter sits in the formula.',
          'Rings the changed parameter\'s symbol wherever it appears in the formula. Nothing else is written.'),
        ...(pair ? [lever(MODEL_PAIR_LEVER, 'help', 'both', ['opposite_direction', 'missed_change'],
          'The learner does not yet see how multiplying by a quantity differs from dividing by it.',
          'Shows a picture outside the item: two small rules, one that multiplies by a letter and one that divides by it, '
            + 'with the letter moving from one number to the next and what each rule gives. It uses none of the item\'s '
            + 'letters or numbers; ask which rule the item\'s formula is like.')] : []),
        ...(simpler ? [lever(SIMPLER_LEVER, 'simplify', 'shown', ['opposite_direction', 'missed_change', 'invented_change'],
          'The changed parameter divides, is raised to a power or only adds, and that is too hard to predict yet.',
          'Opens an easier prediction of the same kind first, on a parameter of the same formula that only multiplies, '
            + 'doubled or halved. It is not graded; the full item comes back after it.')] : []),
      ];
    }
    case 'predict-value': {
      const scaling = scalingModel(d, c);
      return [
        ...(!substitutionLeaks(d, c) ? [lever(SUBSTITUTION_LEVER, 'help', 'shown',
          ['unchanged_output', 'assumed_proportional', 'near_miss', 'opposite_direction', 'too_high', 'too_low'],
          'The learner cannot write the calculation at the new setting.',
          'Shows the formula with the new setting and the held values written in place of the letters. It does not work it out.')] : []),
        ...(scaling ? [lever(SCALING_MODEL_LEVER, 'help', 'both', ['assumed_proportional', 'unchanged_output', 'opposite_direction', 'too_high', 'too_low'],
          'The learner scales the output by the parameter\'s own ratio whatever its place in the formula.',
          'Shows a picture outside the item: three small rules (times a letter, times its square, divided by it), the '
            + 'letter doubled, and what each rule gives. It uses none of the item\'s letters or numbers.')] : []),
        ...(simpler ? [lever(SIMPLER_LEVER, 'simplify', 'shown',
          ['unchanged_output', 'assumed_proportional', 'near_miss', 'opposite_direction', 'too_high', 'too_low'],
          'The new setting makes the arithmetic too heavy to see the method.',
          'Opens an easier problem of the same kind first: the same formula with one parameter doubled or halved from its '
            + 'start. It is not graded; the full item comes back after it.')] : []),
      ];
    }
    case 'identify-relationship': {
      const marks = ctx.outputShown ? doubleMarks(d) : [];
      const model = doublingModel(d, c);
      return [
        ...(marks.length ? [lever(DOUBLE_MARKS_LEVER, 'help', 'shown', ['no_effect', 'largest_value', 'weaker_effect'],
          'The learner guesses instead of testing each parameter.',
          'Marks each slider\'s starting value and its double, and adds a Back to start button, so the learner can double '
            + 'one parameter at a time and watch the output readout. It names no parameter and no result.')] : []),
        ...(model ? [lever(DOUBLING_MODEL_LEVER, 'help', 'both', ['no_effect', 'largest_value', 'weaker_effect'],
          'The learner judges by the size of the numbers, not by where each parameter sits in the formula.',
          'Shows a picture outside the item: three small rules (times a letter, times its square, plus a number), the '
            + 'letter doubled, and what each rule gives. It uses none of the item\'s letters or numbers; ask which rule '
            + 'each parameter is like.')] : []),
      ];
    }
    default:
      return [];
  }
}

/** What the pulled help levers put on screen, for the tutor and JEV. No direction, value or leading parameter. */
export function leverFacts(d: Lab, c: ParameterExplorerChallenge | null, pulled: readonly string[]): string {
  if (!c || isPracticeParameter(c)) return '';
  const on = (id: string) => pulled.includes(id);
  return [
    on(FIND_PARAMETER_LEVER) && 'The changed parameter\'s symbol is ringed wherever it appears in the formula.',
    on(MODEL_PAIR_LEVER) && 'A picture outside the item shows one small rule that multiplies by a letter and one that divides by it, with what each gives as the letter moves to the next number.',
    on(SUBSTITUTION_LEVER) && `The formula is shown with the setting written in: ${substitutionText(d, c)}. It is not worked out.`,
    on(SCALING_MODEL_LEVER) && 'A picture outside the item shows three small rules (times a letter, times its square, divided by it) with the letter doubled and what each gives.',
    on(DOUBLE_MARKS_LEVER) && 'Each slider shows a mark at its starting value and at its double, and a Back to start button puts every slider back.',
    on(DOUBLING_MODEL_LEVER) && 'A picture outside the item shows three small rules (times a letter, times its square, plus a number) with the letter doubled and what each gives.',
  ].filter((s): s is string => !!s).join(' ');
}
