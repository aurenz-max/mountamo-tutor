/**
 * Formula lab on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C17).
 *
 * Pure: the component, the journey row and any probe read the same assignment, check and scene. Each challenge is
 * answered on the screen and checked by the activity's own code:
 * - free-explore: the changed quantity moved to its target (always credited; there is nothing to get wrong);
 * - predict-direction / predict-magnitude: the prediction placed on the track and locked. On the workspace path the
 *   lock is the checked answer, and the output stays hidden after a miss; the scripted path still tests first;
 * - construct-formula: the tokens arranged and checked. Any arrangement that uses every token and gives the same
 *   value as the hidden formula is credited (b * a for a * b), not only the generator's token order;
 * - transfer-apply: the output typed and checked within half a percent.
 * The tutor is never handed the direction, the strength, the hidden expression, or the output.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { FormulaLabChallenge, FormulaLabChallengeType, FormulaLabData, FormulaLabDirection } from './FormulaLab';
import { evaluateFormulaExpression } from './formulaLabMath';

type Lab = Pick<FormulaLabData, 'expression' | 'variables' | 'outputSymbol' | 'outputName' | 'outputUnit' | 'transferContext'>;

export const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 100000 || (abs > 0 && abs < 0.001)) return value.toExponential(2);
  return Number(value.toFixed(3)).toString();
};

export const valuesToScope = (variables: Lab['variables'], values: readonly number[]): Record<string, number> =>
  Object.fromEntries(variables.map((variable, index) => [variable.symbol, values[index]]));

export const tokenizeFormula = (expression: string): string[] =>
  expression.match(/(?:\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[()+\-*/^])/g) ?? [];

/** The track's dead band: a prediction within it reads as "stay about the same". */
export const SAME_BAND = 0.18;
export const directionFromPosition = (position: number): FormulaLabDirection =>
  position < -SAME_BAND ? 'decrease' : position > SAME_BAND ? 'increase' : 'stay-same';

export const directionLabel = (direction: FormulaLabDirection): string =>
  direction === 'stay-same' ? 'stay about the same' : direction;

/** Where the observed change sits on the track: the relative change of the output, clamped to −1..1. */
export function observedPosition(ch: FormulaLabChallenge): number {
  const relative = (ch.expectedTargetOutput - ch.expectedBaselineOutput) / Math.max(1, Math.abs(ch.expectedBaselineOutput));
  return Math.min(1, Math.max(-1, relative));
}

/** The magnitude score since birth: 100 at the observed marker, falling with distance; 70 passes. */
export const MAGNITUDE_PASS = 70;
export const magnitudeScore = (prediction: number, observed: number) =>
  Math.round(Math.max(0, 1 - Math.abs(prediction - observed) / 2) * 100);

/** The learner's work on the current challenge. */
export interface FormulaWork {
  /** Predict modes: where the prediction sits on the track, −1 (less) to 1 (more); null before one is placed. */
  prediction: number | null;
  /** construct-formula: the tokens picked, in order. */
  tokens: readonly string[];
  /** transfer-apply: the output typed. */
  answer: string;
  /** free-explore: the changed quantity's value now. */
  value: number | null;
}

export const EMPTY_WORK: FormulaWork = { prediction: null, tokens: [], answer: '', value: null };

const changed = (d: Lab, ch: FormulaLabChallenge) => {
  const index = d.variables.findIndex(v => v.symbol === ch.changedVariableSymbol);
  return { index, variable: index >= 0 ? d.variables[index] : null };
};

const close = (a: number, b: number, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));

/** Variable values the hidden formula and a built one are compared on: the item's own two, and two more. */
function comparisonScopes(d: Lab, ch: FormulaLabChallenge): Record<string, number>[] {
  const perturb = (k: number, c: number) => ch.baselineValues.map(v => v * k + c);
  return [ch.baselineValues, ch.targetValues, perturb(1.37, 0.29), perturb(0.61, 1.13)].map(vs => valuesToScope(d.variables, vs));
}

/** The built expression's value against the formula's on every comparison scope: 'same', 'inverse', or 'other'. */
function compareBuilt(d: Lab, ch: FormulaLabChallenge, tokens: readonly string[]): 'same' | 'inverse' | 'other' | 'invalid' {
  const built = tokens.join(' ');
  let compared = 0, same = true, inverse = true;
  for (const scope of comparisonScopes(d, ch)) {
    const want = evaluateFormulaExpression(d.expression, scope);
    if (want === null || !Number.isFinite(want)) continue;
    const got = evaluateFormulaExpression(built, scope);
    if (got === null || !Number.isFinite(got)) return 'invalid';
    compared++;
    if (!close(got, want)) same = false;
    if (want === 0 || !close(got, 1 / want)) inverse = false;
  }
  if (!compared) return 'invalid';
  return same ? 'same' : inverse ? 'inverse' : 'other';
}

const transferTolerance = (expected: number) => Math.max(1e-6, Math.abs(expected) * 0.005);

/** The activity's own check, and the score it records (the magnitude mode scores by distance). */
export function formulaCheck(d: Lab, ch: FormulaLabChallenge, work: FormulaWork): { correct: boolean; score: number } {
  const verdict = (correct: boolean) => ({ correct, score: correct ? 100 : 0 });
  switch (ch.type) {
    case 'free-explore': {
      const { index, variable } = changed(d, ch);
      return verdict(!!variable && work.value !== null && Math.abs(work.value - ch.targetValues[index]) <= variable.step / 2);
    }
    case 'predict-direction':
      return verdict(work.prediction !== null && directionFromPosition(work.prediction) === ch.correctDirection);
    case 'predict-magnitude': {
      if (work.prediction === null) return verdict(false);
      const score = magnitudeScore(work.prediction, observedPosition(ch));
      return { correct: score >= MAGNITUDE_PASS, score };
    }
    case 'construct-formula':
      return verdict(work.tokens.length === tokenizeFormula(d.expression).length && compareBuilt(d, ch, work.tokens) === 'same');
    case 'transfer-apply': {
      const answer = Number(work.answer);
      return verdict(work.answer.trim() !== '' && Number.isFinite(answer)
        && Math.abs(answer - ch.expectedTargetOutput) <= transferTolerance(ch.expectedTargetOutput));
    }
  }
}

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), named for the pattern on screen, drawn from the
 * catalog's commonStruggles (the same direction every time, arithmetic before structure, tokens in an invalid order):
 * - `opposite_direction`: predicted the output moves the other way;
 * - `missed_change`: predicted it stays about the same when it changes; `invented_change`: predicted a change when it
 *   stays about the same;
 * - `too_strong` / `too_weak` (magnitude): the right way, or near the centre, but too far from the observed marker;
 * - `incomplete`: fewer tokens than the formula has; `not_an_expression`: every token, in an order that is not a
 *   formula; `inverted`: every token, giving the reciprocal of the output (a divisor and a multiplier swapped);
 *   `operation_order`: every token, a valid formula, a different relationship;
 * - `used_starting_inputs` (transfer): the output at the starting values the scene still shows, not the new ones;
 *   `power_as_multiply`: a power worked as a multiplication; `near_miss`: within 5%; `too_high` / `too_low`.
 */
export type FormulaLabMiss = 'opposite_direction' | 'missed_change' | 'invented_change' | 'too_strong' | 'too_weak'
  | 'incomplete' | 'not_an_expression' | 'inverted' | 'operation_order'
  | 'used_starting_inputs' | 'power_as_multiply' | 'near_miss' | 'too_high' | 'too_low';

/** free-explore credits every finished move, so it names none. */
export const FORMULA_MISSES_BY_MODE: Record<string, readonly FormulaLabMiss[]> = {
  'predict-direction': ['opposite_direction', 'missed_change', 'invented_change'],
  'predict-magnitude': ['opposite_direction', 'too_strong', 'too_weak'],
  'construct-formula': ['incomplete', 'not_an_expression', 'inverted', 'operation_order'],
  'transfer-apply': ['used_starting_inputs', 'power_as_multiply', 'near_miss', 'too_high', 'too_low'],
};

export function formulaMiss(d: Lab, ch: FormulaLabChallenge, work: FormulaWork): FormulaLabMiss | undefined {
  if (formulaCheck(d, ch, work).correct) return undefined;
  switch (ch.type) {
    case 'free-explore':
      return undefined;
    case 'predict-direction': {
      if (work.prediction === null) return undefined;
      const said = directionFromPosition(work.prediction);
      if (ch.correctDirection === 'stay-same') return 'invented_change';
      return said === 'stay-same' ? 'missed_change' : 'opposite_direction';
    }
    case 'predict-magnitude': {
      if (work.prediction === null) return undefined;
      const p = work.prediction, o = observedPosition(ch);
      if (Math.abs(o) > SAME_BAND && Math.abs(p) > SAME_BAND && Math.sign(p) !== Math.sign(o)) return 'opposite_direction';
      return Math.abs(p) > Math.abs(o) ? 'too_strong' : 'too_weak';
    }
    case 'construct-formula': {
      if (work.tokens.length < tokenizeFormula(d.expression).length) return 'incomplete';
      const how = compareBuilt(d, ch, work.tokens);
      return how === 'invalid' ? 'not_an_expression' : how === 'inverse' ? 'inverted' : 'operation_order';
    }
    case 'transfer-apply': {
      const a = Number(work.answer), e = ch.expectedTargetOutput, tol = transferTolerance(e);
      if (!Number.isFinite(a) || work.answer.trim() === '') return undefined;
      if (!close(ch.expectedBaselineOutput, e, 0.005) && Math.abs(a - ch.expectedBaselineOutput) <= transferTolerance(ch.expectedBaselineOutput))
        return 'used_starting_inputs';
      if (d.expression.includes('^')) {
        const asMultiply = evaluateFormulaExpression(d.expression.replace(/\^/g, '*'), valuesToScope(d.variables, ch.targetValues));
        if (asMultiply !== null && !close(asMultiply, e, 0.005) && Math.abs(a - asMultiply) <= transferTolerance(asMultiply))
          return 'power_as_multiply';
      }
      if (Math.abs(a - e) <= Math.max(tol, Math.abs(e) * 0.05)) return 'near_miss';
      return a > e ? 'too_high' : 'too_low';
    }
  }
}

const strength = (p: number) => {
  const a = Math.abs(p);
  return a <= SAME_BAND ? 'little or no' : a < 0.45 ? 'a small' : a < 0.75 ? 'a moderate' : 'a large';
};

/** The learner's work in their terms, never the key. */
export function describeFormulaWork(d: Lab, ch: FormulaLabChallenge, work: FormulaWork): string {
  switch (ch.type) {
    case 'free-explore': {
      const { variable } = changed(d, ch);
      return work.value === null || !variable ? 'nothing moved yet'
        : `${variable.name} is set to ${formatNumber(work.value)} ${variable.unit}`;
    }
    case 'predict-direction':
    case 'predict-magnitude': {
      if (work.prediction === null) return 'no prediction placed yet';
      const dir = directionFromPosition(work.prediction);
      return ch.type === 'predict-magnitude'
        ? `predicts ${strength(work.prediction)} change in ${d.outputName}${dir === 'stay-same' ? '' : `, ${dir === 'increase' ? 'up' : 'down'}`}`
        : `predicts ${d.outputName} will ${directionLabel(dir)}`;
    }
    case 'construct-formula':
      return work.tokens.length ? `built ${d.outputSymbol} = ${work.tokens.join(' ')}` : 'no tokens chosen yet';
    case 'transfer-apply':
      return work.answer.trim() ? `entered ${work.answer.trim()} ${d.outputUnit}` : 'nothing entered yet';
  }
}

const pretty = (expression: string) => tokenizeFormula(expression)
  .map(t => (t === '*' ? '×' : t === '/' ? '÷' : t)).join(' ');

const MODE_LABEL: Record<FormulaLabChallengeType, string> = {
  'free-explore': 'free explore', 'predict-direction': 'predict the direction', 'predict-magnitude': 'predict direction and strength',
  'construct-formula': 'construct the formula', 'transfer-apply': 'transfer and apply',
};

/** The ask, as the screen states it. */
export function workspaceAssignment(d: Lab, ch: FormulaLabChallenge): TeachingAssignment {
  const { index, variable } = changed(d, ch);
  const name = variable?.name ?? ch.changedVariableSymbol, unit = variable?.unit ?? '';
  const from = `${formatNumber(ch.baselineValues[index] ?? 0)} ${unit}`.trim(), to = `${formatNumber(ch.targetValues[index] ?? 0)} ${unit}`.trim();
  const task = {
    'free-explore': `Move ${name} from ${from} to ${to} while every other quantity stays fixed, and watch what happens to ${d.outputName}.`,
    'predict-direction': `When ${name} changes from ${from} to ${to}, will ${d.outputName} increase, decrease, or stay about the same? `
      + 'Place your prediction on the track and press Lock prediction.',
    'predict-magnitude': `Predict how strongly ${d.outputName} will change, and which way, when ${name} moves from ${from} to ${to}. `
      + 'Place your prediction on the track and press Lock prediction.',
    'construct-formula': `Build the hidden right-hand side of ${d.outputSymbol} = ? from the tokens, then press Check formula.`,
    'transfer-apply': `${d.transferContext} Use the shown inputs to calculate ${d.outputName}, type it, and press Check.`.trim(),
  }[ch.type];
  return { id: ch.id, task, response: 'gesture' };
}

/** Every token of the formula, grouped and sorted (never in the formula's order). */
export const sortedTokens = (expression: string) => {
  const rank = (t: string) => (/^[()]$/.test(t) ? 2 : /^[+\-*/^]$/.test(t) ? 1 : 0);
  return tokenizeFormula(expression).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
};

export interface FormulaLabView extends FormulaWork {
  /** The living system's output is on screen (always in free-explore; after a credited prediction or check). */
  revealed: boolean;
}

/** What is drawn and asked. The direction, the strength, the hidden expression and the output are never named. */
export function workspaceScene(d: Lab, ch: FormulaLabChallenge, view: FormulaLabView): WorkspaceScene {
  const { index, variable } = changed(d, ch);
  const facts: Record<string, string> = {
    mode: MODE_LABEL[ch.type],
    quantities: d.variables.map(v => `${v.symbol} = ${v.name} (${v.unit})`).join('; '),
    output: `${d.outputSymbol} = ${d.outputName} (${d.outputUnit})`,
    formula: ch.type === 'construct-formula' && !view.revealed
      ? `hidden: the learner builds the right-hand side of ${d.outputSymbol} = ?`
      : `${d.outputSymbol} = ${pretty(d.expression)}`,
  };
  if (ch.type === 'construct-formula') {
    facts.tokens = `to arrange: ${sortedTokens(d.expression).join('  ')}${ch.groupFormulaTokens ? ' (sorted on screen into variables and values, operations, grouping)' : ''}`;
  } else if (ch.type === 'transfer-apply') {
    facts.newInputs = d.variables.map((v, i) => `${v.symbol} = ${formatNumber(ch.targetValues[i])} ${v.unit}`).join(', ');
    if (variable) facts.sceneStillShows = `the living system at the starting value, ${variable.name} ${formatNumber(ch.baselineValues[index])} ${variable.unit}`;
    if (ch.showSubstitutionSetup) facts.substitution = 'the formula with the new inputs written in is shown; the learner works it out';
    facts.outputShown = view.revealed ? 'yes' : 'no: hidden until the answer is checked';
  } else if (variable) {
    facts.changes = `${variable.name} from ${formatNumber(ch.baselineValues[index])} to ${formatNumber(ch.targetValues[index])} ${variable.unit}`;
    const fixed = d.variables.filter((_, i) => i !== index).map(v => `${v.name} ${formatNumber(ch.baselineValues[d.variables.indexOf(v)])} ${v.unit}`);
    if (fixed.length) facts.heldFixed = fixed.join(', ');
    facts.outputShown = ch.type === 'free-explore'
      ? `yes, the scene responds as the slider moves${ch.showLiveOutputReadout === false ? ' (no numeric readout)' : ''}`
      : view.revealed ? 'yes, after the checked prediction' : 'no: hidden until the prediction is checked';
    if (ch.type !== 'free-explore') facts.track = 'left is less, the centre is about the same, right is more; distance from the centre is how strong';
  }
  if (ch.strategyCue === 'visible') facts.strategyCue = 'a strategy card is shown';
  if (ch.requireJustification) facts.reasonRequired = 'the learner writes a short reason before locking or checking';
  facts.learnerWork = describeFormulaWork(d, ch, view);
  facts.constraints = {
    'free-explore': 'The learner drags the slider to the target; reaching it finishes the experiment.',
    'predict-direction': 'The learner drags the prediction on the track and presses Lock prediction; the activity checks the prediction.',
    'predict-magnitude': 'The learner drags the prediction on the track and presses Lock prediction; the activity scores how close it is.',
    'construct-formula': 'The learner taps tokens in order (Undo token takes the last back) and presses Check formula.',
    'transfer-apply': 'The learner types the output and presses Check.',
  }[ch.type] + ' You cannot move anything, type, or press a button.';
  return { objects: [], facts };
}

// ── harness ──────────────────────────────────────────────────────────────

export type FormulaHarnessInput =
  | { kind: 'value'; value: number }
  | { kind: 'predict'; percent: number; reason?: string }
  | { kind: 'build'; tokens: string[] }
  | { kind: 'type'; text: string; reason?: string };

const REASON = 'I looked at where the quantity sits in the formula.';

/**
 * The journey row's input for a challenge (`liveJourneySpec.ts`). `wrong` is the mode's signature miss: the other
 * direction, the far end of the track, the reciprocal or another order, the output at the starting values. null:
 * free-explore has no wrong move.
 */
export function formulaHarnessInput(d: Lab, ch: FormulaLabChallenge, intent: 'correct' | 'wrong'): FormulaHarnessInput | null {
  const wrong = intent === 'wrong';
  const reason = ch.requireJustification ? REASON : undefined;
  switch (ch.type) {
    case 'free-explore': {
      if (wrong) return null;
      const { index } = changed(d, ch);
      return { kind: 'value', value: ch.targetValues[index] };
    }
    case 'predict-direction': {
      const at = { increase: 60, decrease: -60, 'stay-same': 0 }[ch.correctDirection];
      return { kind: 'predict', percent: wrong ? (ch.correctDirection === 'increase' ? -60 : 60) : at, reason };
    }
    case 'predict-magnitude': {
      const o = observedPosition(ch);
      return { kind: 'predict', percent: wrong ? (o >= 0 ? -100 : 100) : Math.round(o * 100), reason };
    }
    case 'construct-formula': {
      const tokens = tokenizeFormula(d.expression);
      if (!wrong) return { kind: 'build', tokens };
      const candidates: string[][] = [];
      const slash = tokens.indexOf('/');
      if (slash > 0 && slash < tokens.length - 1) {
        const swapped = [...tokens];
        [swapped[slash - 1], swapped[slash + 1]] = [swapped[slash + 1], swapped[slash - 1]];
        candidates.push(swapped);
      }
      candidates.push([...tokens].reverse(), [...tokens.slice(1), tokens[0]], tokens.slice(0, -1));
      const pick = candidates.find(c => !formulaCheck(d, ch, { ...EMPTY_WORK, tokens: c }).correct);
      return { kind: 'build', tokens: pick ?? tokens.slice(0, -1) };
    }
    case 'transfer-apply': {
      const e = ch.expectedTargetOutput, b = ch.expectedBaselineOutput;
      const value = !wrong ? e : !close(b, e, 0.05) ? b : e * 1.5 + 1;
      return { kind: 'type', text: String(Number(value.toPrecision(10))), reason };
    }
  }
}
