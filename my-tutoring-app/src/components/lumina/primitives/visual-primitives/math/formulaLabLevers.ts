/**
 * formula-lab's in-item levers (/add-support-tiers; report qa/eval-reports/formula-lab-levers-2026-10-09.md).
 * The misses are what `formulaMiss` observes on the locked prediction, the build or the typed output; there is no
 * real-learner evidence.
 *
 * - predict modes: `find_quantity` (help) rings the changed quantity's symbol wherever it sits in the formula;
 *   `model_pair` (help) a picture outside the item: y = k × x and y = k ÷ x, each with x going up, and what y does;
 *   `track_scale` (help, magnitude) word marks on the track: to zero, halves, no change, half as much again, doubles;
 *   `simpler_problem` (simplify) the same mode on a quantity that only multiplies, doubled, when the item's quantity
 *   divides or is raised to a power.
 * - construct-formula: `group_tokens` (help, where the session does not already group them) the tokens sorted into
 *   variables and values, operations, grouping; `value_check` (help) what the learner's build gives at the starting
 *   values beside what the living system gives; `order_card` (help) the order of operations on a and b. No simplify:
 *   every smaller build is a piece of the hidden formula.
 * - transfer-apply: `substitution` (help, where the session does not already show it) the formula with the new inputs
 *   written in; `new_inputs` (help) the living system moved to the new inputs, its output still hidden; `order_card`;
 *   `simpler_problem` (simplify) the same formula on friendlier inputs.
 * - free-explore credits every finished move and names no miss, so it has no lever.
 *
 * Leak rules (code): no lever names a direction, an amount of change, a token order or the item's output; the model
 * pair and the order card use none of the item's symbols, and the pair none of its numbers or track positions; the
 * substitution is refused when it would print the answer; a practice item has its own id and keeps the mode, and
 * never repeats the item's changed quantity (predict) or its inputs and answer (transfer).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { FormulaLabChallenge, FormulaLabData } from './FormulaLab';
import { evaluateFormulaExpression } from './formulaLabMath';
import { formatNumber, observedPosition, tokenizeFormula, valuesToScope, type FormulaLabMiss } from './formulaLabWorkspace';

type Lab = Pick<FormulaLabData, 'expression' | 'variables' | 'outputSymbol' | 'outputName'>;

export const FIND_QUANTITY_LEVER = 'find_quantity';
export const MODEL_PAIR_LEVER = 'model_pair';
export const TRACK_SCALE_LEVER = 'track_scale';
export const GROUP_TOKENS_LEVER = 'group_tokens';
export const VALUE_CHECK_LEVER = 'value_check';
export const ORDER_CARD_LEVER = 'order_card';
export const SUBSTITUTION_LEVER = 'substitution';
export const NEW_INPUTS_LEVER = 'new_inputs';
export const SIMPLER_LEVER = 'simpler_problem';

const SIMPLER = '~simpler';
export const isPracticeFormula = (c: Pick<FormulaLabChallenge, 'id'>) => c.id.endsWith(SIMPLER);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

const close = (a: number, b: number, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));
const output = (d: Lab, values: readonly number[]) => evaluateFormulaExpression(d.expression, valuesToScope(d.variables, values));
const onGrid = (d: Lab, i: number, value: number) => {
  const v = d.variables[i], k = (value - v.min) / v.step;
  return value >= v.min && value <= v.max && Math.abs(k - Math.round(k)) < 1e-9;
};

/** The quantity only multiplies the output: doubling it doubles the output (and the output is not zero). */
export function onlyMultiplies(d: Lab, values: readonly number[], i: number): boolean {
  const f = output(d, values);
  const doubled = [...values]; doubled[i] = values[i] * 2;
  const g = output(d, doubled);
  return f !== null && g !== null && f !== 0 && close(g, 2 * f, 1e-9);
}

/**
 * The easier practice problem for `c`, or null when the item is already the simple shape or the mode has none:
 * - predict modes: when the changed quantity divides or is raised to a power, the same lab with a quantity that only
 *   multiplies, doubled (or halved when doubling leaves its range), every other value as on the item;
 * - transfer-apply: the same formula on friendly inputs (2, 3, 4, 5, 10 or 1, on each slider's grid), none equal to
 *   the item's, with an answer not within 5% of the item's.
 */
export function simplerFormula(d: Lab, c: FormulaLabChallenge): FormulaLabChallenge | null {
  if (isPracticeFormula(c)) return null;
  const id = `${c.id}${SIMPLER}`;
  const base = { ...c, id, strategyCue: undefined, requireJustification: false };
  let practice: FormulaLabChallenge | null = null;
  if (c.type === 'predict-direction' || c.type === 'predict-magnitude') {
    const at = d.variables.findIndex(v => v.symbol === c.changedVariableSymbol);
    if (at < 0 || onlyMultiplies(d, c.baselineValues, at)) return null;
    const j = d.variables.findIndex((_, i) => i !== at && onlyMultiplies(d, c.baselineValues, i));
    if (j < 0) return null;
    const b = c.baselineValues[j];
    // Doubled, else halved (to the nearest grid value when an odd value has no exact half).
    const moved = [b * 2, b / 2, Math.round(b / 2), Math.floor(b / 2)].find(x => x !== b && onGrid(d, j, x));
    if (moved === undefined) return null;
    const targetValues = [...c.baselineValues]; targetValues[j] = moved;
    const from = output(d, c.baselineValues), to = output(d, targetValues);
    if (from === null || to === null) return null;
    practice = { ...base, changedVariableSymbol: d.variables[j].symbol, targetValues, expectedBaselineOutput: from,
      expectedTargetOutput: to, correctDirection: to > from ? 'increase' : to < from ? 'decrease' : 'stay-same' };
  } else if (c.type === 'transfer-apply') {
    const friendly = [2, 3, 4, 5, 10, 1];
    const targetValues = d.variables.map((_, i) => friendly.find(f => onGrid(d, i, f) && !close(f, c.targetValues[i])
      && !close(f, c.baselineValues[i])));
    if (targetValues.some(v => v === undefined)) return null;
    const answer = output(d, targetValues as number[]);
    if (answer === null) return null;
    practice = { ...base, targetValues: targetValues as number[], expectedTargetOutput: answer, showSubstitutionSetup: true };
  }
  return practice && !practiceLeaks(c, practice) ? practice : null;
}

/** Leak rule for a practice problem: never the learner's item (its id, its changed quantity, its inputs or answer),
 *  and the same mode. */
export function practiceLeaks(parent: FormulaLabChallenge, practice: FormulaLabChallenge): boolean {
  if (practice.id === parent.id || practice.type !== parent.type) return true;
  if (parent.type === 'transfer-apply')
    return practice.targetValues.some((v, i) => close(v, parent.targetValues[i]))
      || Math.abs(practice.expectedTargetOutput - parent.expectedTargetOutput) <= 0.05 * Math.abs(parent.expectedTargetOutput);
  return practice.changedVariableSymbol === parent.changedVariableSymbol;
}

// ── pictures and words outside the item ─────────────────────────────────

/** Two letters the item does not use, for models outside it. */
function modelLetters(d: Lab): [string, string] {
  const used = new Set([...d.variables.map(v => v.symbol), d.outputSymbol]);
  const pairs: [string, string][] = [['x', 'y'], ['p', 'q'], ['a', 'b'], ['s', 'r']];
  return pairs.find(([a, b]) => !used.has(a) && !used.has(b)) ?? ['n', 'z'];
}

export interface ModelPair { input: string; output: string; rows: { rule: string; from: number; to: number; outFrom: number; outTo: number }[] }

/** Every number the item shows or answers with, and its track position, so a model can avoid them. */
function itemNumbers(d: Lab, c: FormulaLabChallenge): Set<string> {
  return new Set([...c.baselineValues, ...c.targetValues, c.expectedBaselineOutput, c.expectedTargetOutput,
    Math.round(observedPosition(c) * 100), Math.round(Math.abs(observedPosition(c)) * 100)].map(formatNumber));
}

/** y = k × x and y = k ÷ x with x going up, on numbers none of the item's; null when no set avoids them all. */
export function modelPair(d: Lab, c: FormulaLabChallenge): ModelPair | null {
  const [x, y] = modelLetters(d), avoid = itemNumbers(d, c);
  for (const [k, from, to] of [[6, 2, 3], [20, 4, 5], [12, 3, 4], [30, 5, 6], [42, 6, 7], [90, 9, 10]]) {
    const rows = [{ rule: `${y} = ${k} × ${x}`, from, to, outFrom: k * from, outTo: k * to },
      { rule: `${y} = ${k} ÷ ${x}`, from, to, outFrom: k / from, outTo: k / to }];
    const shown = rows.flatMap(r => [k, r.from, r.to, r.outFrom, r.outTo]).map(formatNumber);
    if (!shown.some(n => avoid.has(n))) return { input: x, output: y, rows };
  }
  return null;
}

/** The order-of-operations card, on two letters the item does not use. No number but the 2 of a square. */
export function orderCard(d: Lab): string[] {
  const [a, b] = modelLetters(d);
  return [
    'Brackets first, then powers, then × and ÷ from left to right, then + and −.',
    `A power belongs to what is right before ^: ${a} ^ 2 means ${a} × ${a}.`,
    `${a} ÷ ${b} is not ${b} ÷ ${a}: the quantity after ÷ is the one that divides.`,
    'A finished formula uses every token.',
  ];
}

/** Word marks for the prediction track, left to right, at −1, −0.5, 0, 0.5, 1. */
export const TRACK_MARKS = ['drops to zero', 'halves', 'no change', 'half as much again', 'doubles'] as const;

/** The formula with the new inputs written in, as the substitution setup prints it. */
export function substitutionText(d: Lab, c: FormulaLabChallenge): string {
  return tokenizeFormula(d.expression).map(t => {
    const i = d.variables.findIndex(v => v.symbol === t);
    return i >= 0 ? formatNumber(c.targetValues[i]) : t === '*' ? '×' : t === '/' ? '÷' : t;
  }).join(' ');
}

/** Leak rule for the substitution: it never prints the answer as one of its numbers. */
export const substitutionLeaks = (d: Lab, c: FormulaLabChallenge) =>
  substitutionText(d, c).split(' ').includes(formatNumber(c.expectedTargetOutput));

/** Leak rule for lever words: no direction or amount of change (the predict modes' key). */
export const DIRECTION_WORDS = /\b(increase|decrease|more|less|bigger|smaller|larger|grow|shrink|up|down|higher|lower|rises?|falls?)\b/i;
export const leverTextLeaks = (text: string) => DIRECTION_WORDS.test(text);

// ── declarations ─────────────────────────────────────────────────────────

export interface FormulaLeverContext {
  /** The session already sorts the construct tokens into groups (a starting position). */
  tokensGrouped: boolean;
  /** The session already shows the substitution setup on transfer (a starting position). */
  substitutionShown: boolean;
}

export function formulaLevers(d: Lab, c: FormulaLabChallenge | null, pulled: readonly string[], ctx: FormulaLeverContext): WorkspaceLever[] {
  if (!c || isPracticeFormula(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly FormulaLabMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const simpler = simplerFormula(d, c);
  const order = lever(ORDER_CARD_LEVER, 'help', 'shown',
    c.type === 'construct-formula' ? ['operation_order', 'inverted', 'not_an_expression', 'incomplete']
      : ['power_as_multiply', 'near_miss', 'too_high', 'too_low'],
    'The learner puts operations in the wrong order, or works a power as a multiplication.',
    'Shows a card outside the item: brackets, then powers, then × and ÷, then + and −; a power belongs to what is right '
      + 'before ^; a ÷ b is not b ÷ a. It uses letters the item does not use.');
  switch (c.type) {
    case 'predict-direction':
    case 'predict-magnitude': {
      const magnitude = c.type === 'predict-magnitude';
      const pair = modelPair(d, c);
      return [
        lever(FIND_QUANTITY_LEVER, 'help', 'shown', magnitude ? ['opposite_direction'] : ['opposite_direction', 'missed_change', 'invented_change'],
          'The learner predicts without looking at where the changed quantity sits in the formula.',
          'Rings the changed quantity\'s symbol wherever it appears in the formula. Nothing else is written.'),
        ...(pair ? [lever(MODEL_PAIR_LEVER, 'help', 'both', magnitude ? ['opposite_direction'] : ['opposite_direction', 'missed_change'],
          'The learner does not yet see how multiplying by a quantity differs from dividing by it.',
          'Shows a picture outside the item: two small rules, one that multiplies by a letter and one that divides by it, '
            + 'with the letter going from one number to the next and what each rule gives. It uses none of the item\'s '
            + 'quantities or numbers; ask which rule the item\'s formula is like.')] : []),
        ...(magnitude ? [lever(TRACK_SCALE_LEVER, 'help', 'shown', ['too_strong', 'too_weak'],
          'The learner has the direction but not how far along the track the change sits.',
          'Labels the track in words: drops to zero at the left end, halves, no change at the centre, half as much again, '
            + 'doubles at the right end. No number is written.')] : []),
        ...(simpler ? [lever(SIMPLER_LEVER, 'simplify', 'shown', magnitude ? ['opposite_direction', 'too_strong', 'too_weak']
          : ['opposite_direction', 'missed_change', 'invented_change'],
          'The changed quantity divides or is raised to a power, and that is too hard to predict yet.',
          'Opens an easier prediction of the same kind first, on a quantity of the same formula that only multiplies, '
            + 'doubled or halved. It is not graded; the full item comes back after it.')] : []),
      ];
    }
    case 'construct-formula':
      return [
        ...(!ctx.tokensGrouped ? [lever(GROUP_TOKENS_LEVER, 'help', 'shown', ['incomplete', 'not_an_expression'],
          'The learner strings tokens together without a plan.',
          'Sorts the remaining tokens into three groups: variables and values, operations, grouping. The order inside '
            + 'each group is shuffled.')] : []),
        lever(VALUE_CHECK_LEVER, 'help', 'shown', ['inverted', 'operation_order', 'not_an_expression', 'incomplete'],
          'The learner builds a formula that does not behave like the living system.',
          'Shows, at the starting values, the value the learner\'s own build gives beside the value the living system '
            + 'gives, updating as they build. It shows no token and no order.'),
        order,
      ];
    case 'transfer-apply':
      return [
        ...(!ctx.substitutionShown && !substitutionLeaks(d, c) ? [lever(SUBSTITUTION_LEVER, 'help', 'shown',
          ['used_starting_inputs', 'near_miss', 'too_high', 'too_low'],
          'The learner cannot set up the calculation with the new inputs.',
          'Shows the formula with the new inputs written in place of the letters. It does not work it out.')] : []),
        lever(NEW_INPUTS_LEVER, 'help', 'shown', ['used_starting_inputs'],
          'The learner uses the starting values the living system still shows.',
          'Moves the living system to the new inputs, so the scene and the card agree. The output stays hidden.'),
        order,
        ...(simpler ? [lever(SIMPLER_LEVER, 'simplify', 'shown', ['used_starting_inputs', 'power_as_multiply', 'near_miss', 'too_high', 'too_low'],
          'The new inputs make the arithmetic too heavy to see the method.',
          'Opens an easier problem of the same kind first: the same formula on small whole inputs, with the setup written '
            + 'in. It is not graded; the full item comes back after it.')] : []),
      ];
    default:
      return [];
  }
}

/** What the pulled help levers put on screen, for the tutor and JEV. No direction, order or answer. */
export function leverFacts(d: Lab, c: FormulaLabChallenge | null, pulled: readonly string[]): string {
  if (!c || isPracticeFormula(c)) return '';
  const on = (id: string) => pulled.includes(id);
  return [
    on(FIND_QUANTITY_LEVER) && 'The changed quantity\'s symbol is ringed wherever it appears in the formula.',
    on(MODEL_PAIR_LEVER) && 'Beside the track is a picture outside the item: one small rule that multiplies by a letter and one that divides by it, with what each gives as the letter moves.',
    on(TRACK_SCALE_LEVER) && 'The track is labelled in words: drops to zero, halves, no change, half as much again, doubles.',
    on(GROUP_TOKENS_LEVER) && 'The remaining tokens are sorted into variables and values, operations, and grouping.',
    on(VALUE_CHECK_LEVER) && 'A panel shows, at the starting values, what the learner\'s build gives beside what the living system gives.',
    on(ORDER_CARD_LEVER) && 'A card outside the item shows the order of operations, what a power belongs to, and that division is not reversible, on letters the item does not use.',
    on(SUBSTITUTION_LEVER) && 'The formula is shown with the new inputs written in; it is not worked out.',
    on(NEW_INPUTS_LEVER) && 'The living system now shows the new inputs; its output stays hidden.',
  ].filter((s): s is string => !!s).join(' ');
}
