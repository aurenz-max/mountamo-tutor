/**
 * Parameter explorer on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C20).
 *
 * Pure: the component, the adapter, the journey row and any probe read the same assignment, check and scene. Every
 * item starts from the parameters' starting values (their defaults) and is checked by the activity's own code:
 * - explore: a slider moved since the item opened (credited; there is nothing to get wrong);
 * - predict-direction: Increase / Decrease / Stay Same against the direction the formula gives when the named
 *   parameter moves from its starting value to `prediction.newValue`, the others held;
 * - predict-value: the typed output against the formula at that setting, within a tolerance capped at 5%;
 * - identify-relationship: the parameter whose doubling (from the starting values, the others held) moves the output
 *   furthest. Computed here, never taken from the generator's key; an item where no parameter clearly leads is refused.
 * The ask for the three checked modes is built here from the data, so the text and the key cannot disagree. The tutor
 * is never handed the direction, the predicted value or the leading parameter, and in the predict modes the output is
 * hidden on screen until the answer is credited.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { ParameterDef, ParameterExplorerChallenge, ParameterExplorerData } from './ParameterExplorer';

type Lab = Pick<ParameterExplorerData, 'formula' | 'jsExpression' | 'outputName' | 'outputUnit' | 'parameters'>;
export type Direction = 'increase' | 'decrease' | 'stay-same';

/** Evaluate the generated JS expression with the parameters as named arguments. null when it is not a finite number. */
export function evaluateFormula(jsExpression: string, values: Record<string, number>): number | null {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...Object.keys(values), `"use strict"; return (${jsExpression});`);
    const result = fn(...Object.values(values));
    if (typeof result !== 'number' || !Number.isFinite(result)) return null;
    // Floating-point noise trimmed relative to size: a fixed 1e-6 rounded a 1e-11 output (G·M/r²) to 0.
    return Number(result.toPrecision(12));
  } catch {
    return null;
  }
}

/** A number as the screen prints it. */
export function formatOutput(value: number): string {
  if (Math.abs(value) >= 1e6 || (Math.abs(value) < 0.001 && value !== 0)) return value.toExponential(3);
  return parseFloat(value.toFixed(4)).toString();
}

export const startingValues = (d: Lab): Record<string, number> =>
  Object.fromEntries(d.parameters.map(p => [p.symbol, p.default]));

const withValue = (d: Lab, symbol: string, value: number) => ({ ...startingValues(d), [symbol]: value });
const startOutput = (d: Lab) => evaluateFormula(d.jsExpression, startingValues(d));
const param = (d: Lab, symbol: string | undefined): ParameterDef | null => d.parameters.find(p => p.symbol === symbol) ?? null;
const unitOf = (p: { unit?: string } | null) => (p?.unit ? ` ${p.unit}` : '');
/** Equal to a relative precision, at any size (an absolute floor made every change of a tiny output "the same"). */
const close = (a: number, b: number, rel = 1e-9) => a === b || Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b));

/** The output at the item's asked setting (the named parameter at `newValue`, the rest at their starting values). */
export function askedOutput(d: Lab, ch: ParameterExplorerChallenge): number | null {
  const p = ch.prediction;
  if (!p || p.newValue === undefined || !param(d, p.varyParameter)) return null;
  return evaluateFormula(d.jsExpression, withValue(d, p.varyParameter, p.newValue));
}

/** The direction the formula gives at the item's setting. null when the item names no setting it can evaluate. */
export function formulaDirection(d: Lab, ch: ParameterExplorerChallenge): Direction | null {
  const before = startOutput(d), after = askedOutput(d, ch);
  if (before === null || after === null) return null;
  return close(after, before) ? 'stay-same' : after > before ? 'increase' : 'decrease';
}

/**
 * predict-direction's key: the formula's direction. An older lesson with no `newValue` (the scripted path only; the
 * live adapter refuses it) falls back to the generator's word.
 */
export const directionKey = (d: Lab, ch: ParameterExplorerChallenge): Direction | null =>
  ch.prediction?.newValue === undefined ? ch.prediction?.correctDirection ?? null : formulaDirection(d, ch);

/** predict-value's tolerance: the generator's, kept between 0.5% (a rounded decimal passes) and 5% of the key. */
export function valueTolerance(ch: ParameterExplorerChallenge, key: number): number {
  const size = Math.abs(key);
  // Relative at every size: an absolute floor of 0.01 passed any typed number on a 1e-11 output.
  const floor = size > 0 ? size * 0.005 : 1e-6, cap = size > 0 ? size * 0.05 : 0.01;
  return Math.min(cap, Math.max(floor, ch.prediction?.tolerance ?? size * 0.01));
}

/** How far each parameter moves the output when it alone is doubled from the starting values. */
export function doublingEffects(d: Lab): Array<{ symbol: string; change: number }> | null {
  const base = startOutput(d);
  if (base === null) return null;
  const effects = d.parameters.map(p => ({ symbol: p.symbol, change: evaluateFormula(d.jsExpression, withValue(d, p.symbol, p.default * 2)) }));
  if (effects.some(e => e.change === null)) return null;
  return effects.map(e => ({ symbol: e.symbol, change: Math.abs((e.change as number) - base) }));
}

/** identify-relationship's key: the parameter whose doubling moves the output furthest, by at least 1.25× the next. */
export const DOMINANCE_MARGIN = 1.25;
export function dominantParameter(d: Lab): string | null {
  const effects = doublingEffects(d);
  if (!effects || effects.length < 2) return null;
  const [first, second] = [...effects].sort((a, b) => b.change - a.change);
  if (!(first.change > 0) || first.change < second.change * DOMINANCE_MARGIN) return null;
  return first.symbol;
}

/**
 * identify-relationship's key: the formula's leading parameter. Where none clearly leads (the live adapter refuses
 * that item and the generator drops it) the scripted path falls back to the generator's key.
 */
export const identifyKey = (d: Lab, ch: ParameterExplorerChallenge): string | null =>
  dominantParameter(d) ?? ch.correctParameter ?? null;

const inRange = (p: ParameterDef, v: number | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= p.min && v <= p.max && !close(v, p.default);
const snap = (p: ParameterDef, v: number) => {
  const step = p.step > 0 ? p.step : 1;
  return Math.min(p.max, Math.max(p.min, Number((p.min + Math.round((v - p.min) / step) * step).toFixed(6))));
};

/**
 * The generator's challenge made answerable by the activity's own check, or null to drop it (`gemini-parameter-explorer`;
 * the live adapter refuses what this would drop). Code owns the key:
 * - predict-direction: the setting is the generator's `newValue` when it lies on the slider and the formula agrees with
 *   its direction word; otherwise a quarter of the slider up or down, whichever gives that word. The key is the formula's.
 *   An explanation written for another setting is dropped (the result line states the effect).
 * - predict-value: `newValue` on the slider; `correctValue` is the formula's, and an explanation whose number disagreed
 *   is dropped.
 * - identify-relationship: the formula's leading parameter; no clear leader drops the item.
 */
export function settleChallenge(d: Lab, ch: ParameterExplorerChallenge): ParameterExplorerChallenge | null {
  const p = param(d, ch.prediction?.varyParameter);
  switch (ch.type) {
    case 'explore':
      return ch;
    case 'predict-direction': {
      if (!p || !ch.prediction) return null;
      const said = ch.prediction.correctDirection, given = ch.prediction.newValue;
      const quarter = (p.max - p.min) / 4;
      const candidates = [given, snap(p, p.default + quarter), snap(p, p.default - quarter)].filter(v => inRange(p, v));
      for (const newValue of candidates) {
        const settled = { ...ch, prediction: { ...ch.prediction, newValue } };
        const direction = formulaDirection(d, settled);
        if (!direction || (said && direction !== said)) continue;
        return { ...settled, prediction: { ...settled.prediction, correctDirection: direction,
          explanation: newValue === given ? settled.prediction.explanation : '' } };
      }
      return null;
    }
    case 'predict-value': {
      if (!p || !ch.prediction || !inRange(p, ch.prediction.newValue)) return null;
      const key = askedOutput(d, ch);
      if (key === null) return null;
      const said = ch.prediction.correctValue;
      const agrees = typeof said === 'number' && Math.abs(said - key) <= valueTolerance(ch, key);
      return { ...ch, prediction: { ...ch.prediction, correctValue: key, explanation: agrees ? ch.prediction.explanation : '' } };
    }
    case 'identify-relationship': {
      const key = dominantParameter(d);
      return key ? { ...ch, correctParameter: key } : null;
    }
  }
}

/** The learner's work on the current item. */
export interface ParameterWork {
  direction: Direction | null;
  /** predict-value: the typed prediction. */
  value: string;
  /** identify-relationship: the parameter chosen. */
  parameter: string | null;
  /** explore: the sliders moved since the item opened. */
  moved: readonly string[];
}
export const EMPTY_WORK: ParameterWork = { direction: null, value: '', parameter: null, moved: [] };

/** The activity's own check. */
export function parameterCheck(d: Lab, ch: ParameterExplorerChallenge, work: ParameterWork): boolean {
  switch (ch.type) {
    case 'explore':
      return work.moved.length > 0;
    case 'predict-direction': {
      const key = directionKey(d, ch);
      return key !== null && work.direction === key;
    }
    case 'predict-value': {
      const key = askedOutput(d, ch), typed = Number(work.value);
      return key !== null && work.value.trim() !== '' && Number.isFinite(typed) && Math.abs(typed - key) <= valueTolerance(ch, key);
    }
    case 'identify-relationship': {
      const key = identifyKey(d, ch);
      return key !== null && work.parameter === key;
    }
  }
}

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), named for the pattern on screen, drawn from the
 * catalog's commonStruggles (a divisor read as a multiplier, all sliders moved at once) and the formula's structure:
 * - `opposite_direction`: predicted the output moves the other way (a value typed on the wrong side of the start too);
 * - `missed_change`: Stay Same when the output changes; `invented_change`: a change when it stays the same;
 * - `unchanged_output`: typed the output at the starting values; `assumed_proportional`: typed the start scaled by the
 *   parameter's own ratio (new ÷ start) where the formula does not scale that way; `near_miss` within 5%;
 *   `too_high` / `too_low`;
 * - `no_effect`: chose a parameter whose doubling leaves the output where it is; `largest_value`: chose the parameter
 *   with the largest starting number; `weaker_effect`: another parameter that moves it less.
 */
export type ParameterExplorerMiss = 'opposite_direction' | 'missed_change' | 'invented_change'
  | 'unchanged_output' | 'assumed_proportional' | 'near_miss' | 'too_high' | 'too_low'
  | 'no_effect' | 'largest_value' | 'weaker_effect';

/** explore credits every move, so it names none. */
export const PARAMETER_MISSES_BY_MODE: Record<string, readonly ParameterExplorerMiss[]> = {
  'predict-direction': ['opposite_direction', 'missed_change', 'invented_change'],
  'predict-value': ['unchanged_output', 'assumed_proportional', 'near_miss', 'opposite_direction', 'too_high', 'too_low'],
  'identify-relationship': ['no_effect', 'largest_value', 'weaker_effect'],
};

/** The parameter's own ratio applied to the start: what a learner who assumes "output scales with it" types. */
function proportionalGuess(d: Lab, ch: ParameterExplorerChallenge): number | null {
  const p = param(d, ch.prediction?.varyParameter), base = startOutput(d), next = ch.prediction?.newValue;
  if (!p || base === null || next === undefined || p.default === 0) return null;
  return base * (next / p.default);
}

export function parameterMiss(d: Lab, ch: ParameterExplorerChallenge, work: ParameterWork): ParameterExplorerMiss | undefined {
  if (parameterCheck(d, ch, work)) return undefined;
  switch (ch.type) {
    case 'explore':
      return undefined;
    case 'predict-direction': {
      const key = directionKey(d, ch);
      if (!key || !work.direction) return undefined;
      if (key === 'stay-same') return 'invented_change';
      return work.direction === 'stay-same' ? 'missed_change' : 'opposite_direction';
    }
    case 'predict-value': {
      const key = askedOutput(d, ch), base = startOutput(d), typed = Number(work.value);
      if (key === null || base === null || work.value.trim() === '' || !Number.isFinite(typed)) return undefined;
      if (!close(key, base, 0.005) && Math.abs(typed - base) <= valueTolerance(ch, base)) return 'unchanged_output';
      const guess = proportionalGuess(d, ch);
      if (guess !== null && !close(guess, key, 0.005) && Math.abs(typed - guess) <= valueTolerance(ch, guess)) return 'assumed_proportional';
      if (Math.abs(typed - key) <= Math.abs(key) * 0.05) return 'near_miss';
      if (!close(key, base) && Math.sign(typed - base) !== Math.sign(key - base)) return 'opposite_direction';
      return typed > key ? 'too_high' : 'too_low';
    }
    case 'identify-relationship': {
      const effects = doublingEffects(d), chosen = effects?.find(e => e.symbol === work.parameter);
      if (!chosen) return undefined;
      if (chosen.change <= 1e-9) return 'no_effect';
      const largest = [...d.parameters].sort((a, b) => Math.abs(b.default) - Math.abs(a.default))[0];
      return largest?.symbol === work.parameter ? 'largest_value' : 'weaker_effect';
    }
  }
}

const DIRECTION_WORD: Record<Direction, string> = { increase: 'increase', decrease: 'decrease', 'stay-same': 'stay the same' };

/** The learner's work in their terms, never the key. */
export function describeParameterWork(d: Lab, ch: ParameterExplorerChallenge, work: ParameterWork): string {
  switch (ch.type) {
    case 'explore':
      return work.moved.length ? `moved ${work.moved.join(', ')}` : 'no slider moved yet';
    case 'predict-direction':
      return work.direction ? `predicts ${d.outputName} will ${DIRECTION_WORD[work.direction]}` : 'no direction chosen yet';
    case 'predict-value':
      return work.value.trim() ? `predicts ${d.outputName} = ${work.value.trim()}${unitOf({ unit: d.outputUnit })}` : 'nothing entered yet';
    case 'identify-relationship': {
      const p = param(d, work.parameter ?? undefined);
      return p ? `chose ${p.symbol} (${p.name})` : 'no parameter chosen yet';
    }
  }
}

const valueText = (p: ParameterDef, value: number) => `${formatOutput(value)}${unitOf(p)}`;
/** The other parameters at their starting values, as the ask states them. */
const heldText = (d: Lab, except?: string) => d.parameters.filter(p => p.symbol !== except)
  .map(p => `${p.symbol} = ${valueText(p, p.default)}`).join(', ');
/** ", while the others stay fixed", for the predict asks. */
const held = (d: Lab, except: string) => (d.parameters.length > 1
  ? ` while ${heldText(d, except)} ${d.parameters.length > 2 ? 'stay' : 'stays'} fixed` : '');

/**
 * The ask as the screen states it. The three checked modes are built from the data (the generator's instruction could
 * name a direction, an answer, or another definition of "strongest"); explore keeps the generator's instruction.
 */
export function promptFor(d: Lab, ch: ParameterExplorerChallenge): string {
  const p = param(d, ch.prediction?.varyParameter);
  switch (ch.type) {
    case 'explore':
      return ch.instruction;
    case 'predict-direction':
      if (!p || ch.prediction?.newValue === undefined) return ch.instruction;
      return `${p.name} (${p.symbol}) changes from ${valueText(p, p.default)} to ${valueText(p, ch.prediction.newValue)}`
        + held(d, p.symbol) + '. '
        + `Will ${d.outputName} increase, decrease, or stay the same?`;
    case 'predict-value':
      if (!p || ch.prediction?.newValue === undefined) return ch.instruction;
      return `${p.name} (${p.symbol}) changes from ${valueText(p, p.default)} to ${valueText(p, ch.prediction.newValue)}`
        + held(d, p.symbol) + '. '
        + `What will ${d.outputName} be?`;
    case 'identify-relationship':
      if (!dominantParameter(d)) return ch.instruction;
      return `Start from ${heldText(d)}. If you double one parameter and hold the others, which one changes ${d.outputName} the most?`;
  }
}

/**
 * What the screen states once the item is over (credited, or missed on the scripted path): the output at the asked
 * setting, or each parameter's doubling effect. Built from the formula, so it cannot contradict the check.
 */
export function resultText(d: Lab, ch: ParameterExplorerChallenge): string {
  const unit = unitOf({ unit: d.outputUnit }), p = param(d, ch.prediction?.varyParameter);
  if ((ch.type === 'predict-direction' || ch.type === 'predict-value') && p && ch.prediction?.newValue !== undefined) {
    const before = startOutput(d), after = askedOutput(d, ch);
    if (before === null || after === null) return '';
    return `With ${p.symbol} = ${valueText(p, ch.prediction.newValue)}, ${d.outputName} goes from ${formatOutput(before)}${unit} `
      + `to ${formatOutput(after)}${unit}.`;
  }
  if (ch.type === 'identify-relationship') {
    const effects = doublingEffects(d);
    if (!effects) return '';
    return 'Doubling each one alone changes ' + d.outputName + ' by: '
      + effects.map(e => `${e.symbol} ${formatOutput(e.change)}${unit}`).join(', ') + '.';
  }
  return '';
}

/** The ask, as the screen states it, plus the answer channel. */
export function workspaceAssignment(d: Lab, ch: ParameterExplorerChallenge): TeachingAssignment {
  const how = {
    explore: 'Move a slider, then press Done Exploring.',
    'predict-direction': 'Choose Increase, Decrease or Stay Same and press Check.',
    'predict-value': 'Type the prediction and press Check.',
    'identify-relationship': 'Choose one parameter and press Check.',
  }[ch.type];
  return { id: ch.id, task: `${promptFor(d, ch)} ${how}`.trim(), response: 'gesture' };
}

/**
 * The formula in plain symbols for a spoken tutor (LaTeX read aloud is noise): the drawn left side, the evaluated
 * right side with Math.pow as ^, Math.PI as π, × and ÷.
 */
export function plainFormula(d: Pick<Lab, 'formula' | 'jsExpression'>): string {
  const lhs = d.formula.split('=')[0].replace(/\\[a-z]+/gi, '').replace(/[{}$]/g, '').trim();
  let rhs = d.jsExpression;
  for (let guard = 0; guard < 6 && /Math\.pow\(/.test(rhs); guard++)
    rhs = rhs.replace(/Math\.pow\(\s*([^(),]+|\([^()]*\))\s*,\s*([^()]+?)\s*\)/g, (_, base: string, exp: string) =>
      `${/^[A-Za-z0-9_.]+$/.test(base.trim()) ? base.trim() : `(${base.trim()})`}^${exp.trim()}`);
  rhs = rhs.replace(/Math\.PI/g, 'π').replace(/Math\.sqrt/g, '√').replace(/Math\.E\b/g, 'e').replace(/Math\./g, '')
    .replace(/\s*\*\s*/g, ' × ').replace(/\s*\/\s*/g, ' ÷ ');
  return lhs ? `${lhs} = ${rhs}` : rhs;
}

const MODE_LABEL: Record<ParameterExplorerChallenge['type'], string> = {
  explore: 'explore', 'predict-direction': 'predict the direction', 'predict-value': 'predict the value',
  'identify-relationship': 'identify the strongest parameter',
};

export interface ParameterExplorerView extends ParameterWork {
  /** The sliders' values now. */
  values: Record<string, number>;
  /** Locked (held) parameters. */
  locked: readonly string[];
  /** The numeric output readout is on screen. */
  outputShown: boolean;
  /** The per-slider value readouts are on screen. */
  valuesShown: boolean;
  /** Observation cards on screen. */
  observations: readonly string[];
  /** The item is credited (the explanation and the output at the asked setting are on screen). */
  solved: boolean;
}

/** What is drawn and asked. The direction, the asked value and the leading parameter are never named. */
export function workspaceScene(d: Lab, ch: ParameterExplorerChallenge, view: ParameterExplorerView): WorkspaceScene {
  const facts: Record<string, string> = {
    mode: MODE_LABEL[ch.type],
    formula: plainFormula(d),
    output: `${d.outputName}${d.outputUnit ? ` (${d.outputUnit})` : ''}`,
    parameters: d.parameters.map(p => `${p.symbol} = ${p.name}, slider ${formatOutput(p.min)} to ${formatOutput(p.max)}${unitOf(p)}, starts at ${formatOutput(p.default)}`).join('; '),
  };
  facts.sliders = view.valuesShown
    ? d.parameters.map(p => `${p.symbol} ${formatOutput(view.values[p.symbol] ?? p.default)}${unitOf(p)}`).join(', ')
    : 'no value readouts beside the sliders';
  if (view.locked.length) facts.locked = view.locked.join(', ');
  if (view.outputShown) {
    const now = evaluateFormula(d.jsExpression, view.values);
    facts.outputShown = `yes: ${d.outputName} ${now === null ? '—' : formatOutput(now)}${unitOf({ unit: d.outputUnit })} at the sliders' values`;
  } else {
    facts.outputShown = 'no: hidden until the answer is checked';
  }
  if (view.observations.length) facts.observationCards = view.observations.join(' | ');
  if (ch.type === 'identify-relationship') {
    facts.choices = d.parameters.map(p => `${p.symbol} (${p.name})`).join(', ');
  }
  if (view.solved) facts.result = 'credited; the output at the asked setting and the explanation are on screen';
  facts.learnerWork = describeParameterWork(d, ch, view);
  facts.constraints = {
    explore: 'The learner moves the sliders (a lock holds one) and presses Done Exploring.',
    'predict-direction': 'The learner chooses Increase, Decrease or Stay Same and presses Check; the activity checks it against the formula.',
    'predict-value': 'The learner types a number and presses Check; the activity checks it against the formula.',
    'identify-relationship': 'The learner chooses one parameter and presses Check; the activity checks it against the formula.',
  }[ch.type] + ' You cannot move a slider, choose, type, or press a button.';
  return { objects: [], facts };
}

// ── harness ──────────────────────────────────────────────────────────────

export type ParameterHarnessInput =
  | { kind: 'move'; symbol: string; label: string; value: number }
  | { kind: 'direction'; label: string }
  | { kind: 'type'; text: string }
  | { kind: 'parameter'; label: string };

export const DIRECTION_LABEL: Record<Direction, string> = { increase: 'Increase', decrease: 'Decrease', 'stay-same': 'Stay Same' };
export const sliderLabel = (p: Pick<ParameterDef, 'name' | 'symbol'>) => `${p.name} (${p.symbol}) slider`;
export const parameterLabel = (p: Pick<ParameterDef, 'name' | 'symbol'>) => `${p.symbol} (${p.name})`;

/**
 * The journey row's input for a challenge (`liveJourneySpec.ts`). `wrong` is the mode's signature miss: the other
 * direction (a change where there is none), the output at the starting values, another parameter (the one with the
 * largest starting number first). null: explore has no wrong move.
 */
export function parameterHarnessInput(d: Lab, ch: ParameterExplorerChallenge, intent: 'correct' | 'wrong'): ParameterHarnessInput | null {
  const wrong = intent === 'wrong';
  switch (ch.type) {
    case 'explore': {
      if (wrong) return null;
      const p = d.parameters[0];
      const value = p.default + p.step <= p.max ? p.default + p.step : p.default - p.step;
      return { kind: 'move', symbol: p.symbol, label: sliderLabel(p), value };
    }
    case 'predict-direction': {
      const key = directionKey(d, ch);
      if (!key) return null;
      const said: Direction = !wrong ? key : key === 'increase' ? 'decrease' : 'increase';
      return { kind: 'direction', label: DIRECTION_LABEL[said] };
    }
    case 'predict-value': {
      const key = askedOutput(d, ch), base = startOutput(d);
      if (key === null || base === null) return null;
      const value = !wrong ? key : !close(key, base, 0.05) ? base : key * 1.5 + 1;
      return { kind: 'type', text: String(Number(value.toPrecision(10))) };
    }
    case 'identify-relationship': {
      const key = identifyKey(d, ch);
      if (!key) return null;
      const others = d.parameters.filter(p => p.symbol !== key).sort((a, b) => Math.abs(b.default) - Math.abs(a.default));
      const pick = wrong ? others[0] : param(d, key);
      return pick ? { kind: 'parameter', label: parameterLabel(pick) } : null;
    }
  }
}
