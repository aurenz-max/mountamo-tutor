/**
 * Regrouping workbench on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C12).
 *
 * Pure: the component and any probe read the same assignment and scene. Every challenge is answered on the screen:
 * one digit typed in each answer box under the written problem, then Check. The activity's own check compares the
 * typed number with the operands' result, so the tutor is never handed the result or a digit of it. Trading blocks
 * (Carry / Borrow) is the learner's tool and is never checked.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { RegroupingChallenge } from './RegroupingWorkbench';

export type RegroupOperation = 'addition' | 'subtraction';
export const PLACE_NAMES = ['ones', 'tens', 'hundreds', 'thousands'] as const;
const sign = (op: RegroupOperation) => (op === 'addition' ? '+' : '−');

/** Digits of n, ones first, padded to `places`. */
export function digitsOf(n: number, places: number): number[] {
  const out: number[] = [];
  let x = Math.abs(Math.floor(n));
  for (let i = 0; i < places; i++) { out.push(x % 10); x = Math.floor(x / 10); }
  return out;
}
const fromDigits = (digits: readonly number[]) => digits.reduce((n, d, i) => n + d * 10 ** i, 0);
const digitCount = (n: number) => (n > 0 ? Math.floor(Math.log10(n)) + 1 : 1);

/**
 * The two operands, read from the problem string as the component always has (`"27 + 45"`, `"52 - 17"`); a part that
 * does not parse falls back to the session operand.
 */
export function operandsOf(c: Pick<RegroupingChallenge, 'problem'> | null, fallback: { operand1: number; operand2: number }): [number, number] {
  if (!c) return [fallback.operand1, fallback.operand2];
  const parts = c.problem.split(/[+\-−]/);
  return [parseInt(parts[0]?.trim(), 10) || fallback.operand1, parseInt(parts[1]?.trim(), 10) || fallback.operand2];
}

export const resultOf = (op: RegroupOperation, a: number, b: number) => (op === 'addition' ? a + b : a - b);

/**
 * The blocks before any trade: addition puts both numbers' blocks in each column together (27 + 45 is 12 ones and
 * 6 tens); subtraction starts from the top number. Never the result's digits, which would print the answer.
 */
export function startBlocks(op: RegroupOperation, a: number, b: number, places: number): number[] {
  const da = digitsOf(a, places), db = digitsOf(b, places);
  return op === 'addition' ? da.map((d, i) => d + db[i]) : da;
}

/** The trades the problem needs, column by column (ones first): carries for addition, borrows for subtraction. */
export function regroupColumns(op: RegroupOperation, a: number, b: number, places: number): number[] {
  const da = digitsOf(a, places), db = digitsOf(b, places), out: number[] = [];
  let carry = 0;
  for (let i = 0; i < places; i++) {
    if (op === 'addition') {
      if (da[i] + db[i] + carry >= 10) { out.push(i); carry = 1; } else carry = 0;
    } else if (da[i] - carry < db[i]) { out.push(i); carry = 1; } else carry = 0;
  }
  return out;
}

export function workspaceAssignment(c: RegroupingChallenge, op: RegroupOperation, fallback: { operand1: number; operand2: number }): TeachingAssignment {
  const [a, b] = operandsOf(c, fallback);
  return {
    id: c.id,
    task: `Find ${a} ${sign(op)} ${b}. Write the answer in the boxes under the problem, one digit in each place, then press Check.`,
    response: 'gesture',
  };
}

export interface RegroupView {
  operation: RegroupOperation;
  a: number;
  b: number;
  /** Columns drawn (the answer's digit count when it needs more than the session's place). */
  places: number;
  /** Typed answer digits, ones first; null is an empty box. */
  digits: readonly (number | null)[];
  /** Blocks in each column now, ones first. */
  blocks: readonly number[];
  /** Trades the learner has made on the blocks. */
  trades: number;
  /** Support aids on screen (the generation tier's starting positions, or a pulled lever). */
  regroupMarks: boolean;
  placeLabels: boolean;
  carryRow: boolean;
  columnBadges: boolean;
  algorithmShown: boolean;
  story?: string;
}

/** The typed number, empty boxes read as 0 (the activity's rule since birth). */
export const typedValue = (digits: readonly (number | null)[]) => digits.reduce<number>((sum, d, i) => sum + (d ?? 0) * 10 ** i, 0);

/** The activity's own check. */
export function regroupingMatches(view: RegroupView): boolean {
  return typedValue(view.digits) === resultOf(view.operation, view.a, view.b);
}

const tradeWord = (op: RegroupOperation, n: number) =>
  `${n} ${op === 'addition' ? 'carry' : 'borrow'} trade${n === 1 ? '' : 's'} made on the blocks`;

/** The learner's work in their own terms, never the key. */
export function describeRegroupWork(view: RegroupView): string {
  const written = view.digits.map((d, i) => (d === null ? null : `${d} in the ${PLACE_NAMES[i]}`)).filter(Boolean).reverse();
  const typed = written.length ? `Wrote ${written.join(', ')}` : 'No digits written yet';
  return view.trades ? `${tradeWord(view.operation, view.trades)}. ${typed}` : typed;
}

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the typed digits, drawn from the catalog's
 * commonStruggles (forgetting to carry or borrow, subtracting the smaller digit from the larger):
 * - `left_blank`: a box inside the answer's digits left empty;
 * - `wrong_operation`: the other operation's result (added on a take-away, or the other way round);
 * - `no_carry` (addition): every column's own sum without the carried one (27 + 45 written as 62);
 * - `smaller_from_larger` (subtraction): each column's smaller digit taken from its larger (52 − 17 written as 45);
 * - `forgot_to_reduce` (subtraction): ten given to the column, but the next column's top digit not made one less;
 * - `misplaced_digits`: the answer's digits in the wrong boxes;
 * - `column_slip`: one column's digit wrong, the rest right;
 * - `other_answer`: any other number.
 */
export type RegroupMiss = 'left_blank' | 'wrong_operation' | 'no_carry' | 'smaller_from_larger' | 'forgot_to_reduce'
  | 'misplaced_digits' | 'column_slip' | 'other_answer';

export const REGROUP_MISSES_BY_MODE: Record<string, readonly RegroupMiss[]> = {
  add_no_regroup: ['left_blank', 'wrong_operation', 'misplaced_digits', 'column_slip', 'other_answer'],
  subtract_no_regroup: ['left_blank', 'wrong_operation', 'misplaced_digits', 'column_slip', 'other_answer'],
  add_regroup: ['left_blank', 'wrong_operation', 'no_carry', 'misplaced_digits', 'column_slip', 'other_answer'],
  subtract_regroup: ['left_blank', 'wrong_operation', 'smaller_from_larger', 'forgot_to_reduce', 'misplaced_digits', 'column_slip', 'other_answer'],
};

/** The number a column-by-column bug writes, ones first through `places`. */
export function buggedResult(kind: 'no_carry' | 'smaller_from_larger' | 'forgot_to_reduce', a: number, b: number, places: number): number {
  const da = digitsOf(a, places), db = digitsOf(b, places);
  return fromDigits(da.map((d, i) => kind === 'no_carry' ? (d + db[i]) % 10
    : kind === 'smaller_from_larger' ? Math.abs(d - db[i])
    : (d < db[i] ? d + 10 - db[i] : d - db[i])));
}

export function regroupMiss(view: RegroupView): RegroupMiss | undefined {
  if (regroupingMatches(view)) return undefined;
  const { operation: op, a, b, places } = view;
  const answer = resultOf(op, a, b), typed = typedValue(view.digits);
  const want = digitsOf(answer, places), got = view.digits.map(d => d ?? 0);
  const width = digitCount(answer);
  if (view.digits.slice(0, width).some(d => d === null)) return 'left_blank';
  const other = op === 'addition' ? a - b : a + b;
  if (other >= 0 && typed === other) return 'wrong_operation';
  if (op === 'addition' && typed === buggedResult('no_carry', a, b, places)) return 'no_carry';
  if (op === 'subtraction' && typed === buggedResult('smaller_from_larger', a, b, places)) return 'smaller_from_larger';
  if (op === 'subtraction' && typed === buggedResult('forgot_to_reduce', a, b, places)) return 'forgot_to_reduce';
  const sorted = (xs: number[]) => [...xs].sort((x, y) => x - y).join();
  if (sorted(got) === sorted(want)) return 'misplaced_digits';
  if (want.filter((d, i) => d !== got[i]).length === 1) return 'column_slip';
  return 'other_answer';
}

/** What is drawn and asked. The problem, the blocks and the aids on screen are named; the result never is. */
export function workspaceScene(c: RegroupingChallenge, view: RegroupView): WorkspaceScene {
  const { operation: op, a, b, places } = view;
  const columns = PLACE_NAMES.slice(0, places).slice().reverse().join(', ');
  const verb = op === 'addition' ? 'Carry' : 'Borrow';
  const facts: Record<string, string> = {
    kind: op,
    problem: `${a} ${sign(op)} ${b} = ?`,
    columns: `${columns} (ones on the right)`,
    blocks: view.blocks.map((n, i) => `${PLACE_NAMES[i]} ${n}`).reverse().join(', '),
    blocksStart: op === 'addition'
      ? 'both numbers\' blocks were put together in each column before any trade'
      : 'the top number\'s blocks; the bottom number is not taken away on the blocks',
    tradeButton: `${verb} under a column ${op === 'addition'
      ? 'trades ten of its blocks for one in the next column'
      : 'breaks one block of the next column into ten for this column'}; ${view.regroupMarks
      ? 'it shows only under a column that needs a trade, and that column\'s count is drawn red'
      : 'it shows under every column, and no column is marked'}`,
    placeLabels: view.placeLabels ? 'shown above the block columns' : 'hidden',
    writtenProblem: view.algorithmShown ? `shown in columns beside the blocks, with ${view.carryRow
      ? `a ${op === 'addition' ? 'carry row above' : 'borrow row below'} that fills in as the learner trades` : 'no carry or borrow row'}`
      : 'hidden',
    ...(view.columnBadges ? { columnBadges: 'each column of blocks is tagged with how many blocks it holds' } : {}),
    ...(view.story ? { story: view.story } : {}),
    learnerWork: describeRegroupWork(view),
    constraints: 'The learner answers on the screen: types one digit in each answer box and presses Check; the activity '
      + 'checks the number itself. Trading blocks is the learner\'s choice and is never checked. You cannot type, trade '
      + 'or press Check for the learner.',
  };
  void c;
  return { objects: [], facts };
}

/** The journey row's digits (`liveJourneySpec.ts`): the result, or the mode's signature error. Ones first. */
export function regroupingHarnessDigits(op: RegroupOperation, a: number, b: number, places: number, intent: 'correct' | 'wrong'): number[] {
  const answer = resultOf(op, a, b);
  if (intent === 'correct') return digitsOf(answer, digitCount(answer));
  const needs = regroupColumns(op, a, b, places).length > 0;
  let wrong = needs ? buggedResult(op === 'addition' ? 'no_carry' : 'smaller_from_larger', a, b, places) : answer;
  if (wrong === answer) { const d = digitsOf(answer, places); d[0] = (d[0] + 1) % 10; wrong = fromDigits(d); }
  return digitsOf(wrong, Math.max(digitCount(wrong), digitCount(answer)));
}
