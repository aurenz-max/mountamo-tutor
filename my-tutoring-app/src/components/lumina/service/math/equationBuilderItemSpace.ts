/**
 * equation-builder equations from an item space (service/itemSpace, skill /add-item-space).
 *
 * The LLM chose the equations, and every tier and most runs gave the same ones (5 + 3, 12 − 5,
 * 6 + ? = 10, 14 − ? = 8; 10-13 probe); the tier moved only the option count and spread. With a tier
 * and an objective the resolver fits to add-sub-20, code picks each fact at the tier's beta band.
 *
 * Which items each mode can draw (contract, item-space clause): one step, every number within the
 * lesson's maxNumber, additions only when the lesson has no subtraction.
 *   - missing-result: the result unknown (a op b = ?).
 *   - missing-operand: the change or start unknown (a op ? = c, ? op b = c); the space decides which.
 *   - true-false: a result-unknown fact shown with a claimed result, true or false. A false claim is
 *     one of the space's wrong answers: a far one at easy, a near one (a known mistake) otherwise.
 * build-simple (copy an equation), rewrite (transform one) and make-n (open build) are not a space's
 * task. balance-both-sides draws from equivalence-20 instead (`equivalenceFitsLesson`, below).
 */
import type { AddSub20Item } from '../itemSpace/addSub20';
import type { ItemSpace } from '../itemSpace';
import { sidesOf, type Equivalence20Item } from '../itemSpace/equivalence20';

export type EbSpaceMode = 'missing-result' | 'missing-operand' | 'true-false';
export const EB_SPACE_MODES: readonly string[] = ['missing-result', 'missing-operand', 'true-false'];

export function itemFitsMode(it: AddSub20Item, mode: EbSpaceMode, maxNumber: number, subtraction: boolean): boolean {
  if (it.steps.length !== 1) return false;
  const { a, b, op } = it.steps[0];
  const r = op === '+' ? a + b : a - b;
  if (Math.max(a, b, r) > maxNumber || (!subtraction && op === '-')) return false;
  return mode === 'missing-operand' ? it.unknown !== 'result' : it.unknown === 'result';
}

const ans = (it: AddSub20Item): number => {
  const { a, b, op } = it.steps[0];
  return it.unknown === 'change' ? b : it.unknown === 'start' ? a : op === '+' ? a + b : a - b;
};

/** The equation with `?` in the unknown slot, or with a claimed result for true-false. */
export function equationOf(it: AddSub20Item, claim?: number): string {
  const { a, b, op } = it.steps[0];
  const r = op === '+' ? a + b : a - b;
  if (claim != null) return `${a} ${op} ${b} = ${claim}`;
  if (it.unknown === 'change') return `${a} ${op} ? = ${r}`;
  if (it.unknown === 'start') return `? ${op} ${b} = ${r}`;
  return `${a} ${op} ${b} = ?`;
}

/** Wrong values from the space's mistakes, inside 0..maxNumber; near ones first when `near`. */
function wrongValues(space: ItemSpace<any>, it: AddSub20Item, maxNumber: number, near: boolean): number[] {
  const answer = ans(it);
  const d = space.distractors(it);
  const order = near ? [...d.filter((x) => x.distance === 'near'), ...d.filter((x) => x.distance === 'far')]
    : [...d.filter((x) => x.distance === 'far'), ...d.filter((x) => x.distance === 'near')];
  const out: number[] = [];
  const add = (v: number) => { if (Number.isInteger(v) && v >= 0 && v <= maxNumber && v !== answer && !out.includes(v)) out.push(v); };
  order.forEach((x) => add(Number(x.value)));
  for (const k of near ? [1, -1, 2, -2, 3, -3] : [3, -3, 4, -4, 5, -5, 2, -2]) add(answer + k);
  for (let v = 0; v <= maxNumber; v++) add(v);
  return out;
}

/** Multiple-choice options for a missing value: the answer and `count` − 1 wrong values. */
export function optionsFor(
  space: ItemSpace<any>, it: AddSub20Item, maxNumber: number, count: number, spread: 'far' | 'near' | undefined,
  rand: () => number = Math.random,
): number[] {
  const wrong = wrongValues(space, it, maxNumber, spread !== 'far');
  return [ans(it), ...wrong.slice(0, count - 1)].sort(() => rand() - 0.5);
}

/** A true-false claim: the answer when `isTrue`, else a wrong value (far at easy, near otherwise). */
export function claimFor(space: ItemSpace<any>, it: AddSub20Item, maxNumber: number, isTrue: boolean, easy: boolean): number {
  return isTrue ? ans(it) : wrongValues(space, it, maxNumber, !easy)[0];
}

export const answerOfItem = ans;

/** A plain instruction for the mode; it names no number, so it cannot drift from the equation. */
export function codeInstruction(mode: EbSpaceMode): string {
  return mode === 'true-false' ? 'Is this equation true or false?'
    : mode === 'missing-operand' ? 'What number is missing? Both sides must be the same.'
      : 'What number makes this equation true?';
}

/**
 * balance-both-sides from equivalence-20: the reversed form (12 = 5 + ?) and an operation on both sides
 * (8 + 4 = ? + 5). The standard form a ± b = ? is missing-result's task, not this mode's. Every printed
 * number, the known side's total and the box stay within the lesson's maxNumber; no minus sign unless
 * the lesson subtracts.
 */
export function equivalenceFitsLesson(it: Equivalence20Item, maxNumber: number, subtraction: boolean): boolean {
  if (it.kind === 'standard') return false;
  const { left, right } = sidesOf(it);
  if (!subtraction && /-/.test(`${left} ${right}`)) return false;
  const numbers = [...(`${left} ${right}`.match(/\d+/g) ?? []).map(Number), it.answer];
  const known = typeof it.known === 'number' ? it.known : it.known.op === '+' ? it.known.a + it.known.b : it.known.a - it.known.b;
  return Math.max(known, ...numbers) <= maxNumber;
}

export const balanceSidesOf = sidesOf;
export const BALANCE_INSTRUCTION = 'What number makes both sides the same amount?';
