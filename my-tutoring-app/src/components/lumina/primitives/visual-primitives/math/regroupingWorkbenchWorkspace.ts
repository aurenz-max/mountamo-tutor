/**
 * Regrouping workbench's domain: the column arithmetic, the activity's check and its misses, and the scene the tutor
 * reads. The boss (`regroupingWorkbench.boss.ts`) builds the assignment.
 *
 * Pure: the component and any probe read the same scene. Every challenge is answered on the screen: one digit typed in
 * each answer box under the written problem, then Check. The activity's own check compares the typed number with the
 * operands' result, so the tutor is never handed the result or a digit of it. The blocks are the learner's model: the
 * child puts the two numbers' blocks together (addition) or takes the bottom number's blocks away (subtraction), trading
 * with Carry / Borrow where a column needs it. The blocks never gate the check; whether they ended at the answer is
 * recorded beside it (`blocksModelled`), so a typed answer with no block work is never read as modelled work.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { RegroupingChallenge } from './RegroupingWorkbench';
import type { RegroupMiss, RegroupMode } from './regroupingWorkbench.card';

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
 * The blocks before the learner acts: the top number's blocks in each column, and beside them the bottom number's
 * (`pending`), still to be put together (addition) or taken away (subtraction). Starting from both numbers already
 * together printed the answer whenever no column regrouped (24 + 12 opened as 3 tens and 6 ones).
 */
export function startBlocks(a: number, b: number, places: number): { blocks: number[]; pending: number[] } {
  return { blocks: digitsOf(a, places), pending: digitsOf(b, places) };
}

/** A column is settled once nothing is left to put together or take away and it needs no trade: its count is final. */
export function columnSettled(op: RegroupOperation, blocks: readonly number[], pending: readonly number[], i: number, places: number): boolean {
  if (pending[i] > 0) return false;
  return op === 'subtraction' || blocks[i] < 10 || i === places - 1;
}

/** The blocks ended at the answer: every column's work done and every needed trade made. */
export function blocksModelled(view: Pick<RegroupView, 'operation' | 'a' | 'b' | 'places' | 'blocks' | 'pending'>): boolean {
  const want = digitsOf(resultOf(view.operation, view.a, view.b), view.places);
  return view.pending.every(n => n === 0) && want.every((d, i) => view.blocks[i] === d);
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

/** The item's operation, from its problem's sign (the boss's validator holds it to the session's operation). */
export const operationOf = (c: Pick<RegroupingChallenge, 'problem'>): RegroupOperation =>
  (c.problem.includes('+') ? 'addition' : 'subtraction');

const NO_FALLBACK = { operand1: 0, operand2: 0 };

/** The item's eval mode, from its structure: its operation, and whether any column needs a trade. */
export function modeOf(c: Pick<RegroupingChallenge, 'problem'>): RegroupMode {
  const op = operationOf(c), [a, b] = operandsOf(c, NO_FALLBACK);
  const trades = regroupColumns(op, a, b, String(Math.max(a, b)).length + 1).length > 0;
  return `${op === 'addition' ? 'add' : 'subtract'}_${trades ? 'regroup' : 'no_regroup'}`;
}

/** What the learner is asked: the problem. Never its result. */
export function regroupAsk(c: Pick<RegroupingChallenge, 'problem'>): string {
  const [a, b] = operandsOf(c, NO_FALLBACK);
  return `Find ${a} ${sign(operationOf(c))} ${b}.`;
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
  /** The bottom number's blocks in each column not yet put together (addition) or taken away (subtraction). */
  pending: readonly number[];
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
  const verb = view.operation === 'addition' ? 'put together' : 'taken away';
  const left = PLACE_NAMES.slice(0, view.places).filter((_, i) => view.pending[i] > 0).reverse();
  const untouched = view.trades === 0 && digitsOf(view.b, view.places).every((d, i) => view.pending[i] === d);
  const blocks = left.length === 0 ? `Blocks ${verb} in every column`
    : untouched ? 'Blocks not used yet' : `Blocks not yet ${verb} in the ${left.join(' and ')}`;
  return [view.trades ? tradeWord(view.operation, view.trades) : '', blocks, typed].filter(Boolean).join('. ');
}

export { REGROUP_MISSES_BY_MODE, type RegroupMiss, type RegroupMode } from './regroupingWorkbench.card';

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
export function workspaceScene(c: RegroupingChallenge, view: RegroupView): SceneOf {
  const { operation: op, a, b, places } = view;
  const columns = PLACE_NAMES.slice(0, places).slice().reverse().join(', ');
  const verb = op === 'addition' ? 'Carry' : 'Borrow';
  const facts: Record<string, string> = {
    kind: op,
    problem: `${a} ${sign(op)} ${b} = ?`,
    columns: `${columns} (ones on the right)`,
    blocks: view.blocks.map((n, i) => `${PLACE_NAMES[i]} ${n}`).reverse().join(', '),
    blocksStart: op === 'addition'
      ? 'each column starts with the top number\'s blocks and the bottom number\'s blocks beside them; Put together under a column joins them'
      : 'each column starts with the top number\'s blocks; Take away under a column removes the bottom number\'s blocks for that column, '
        + 'only when the column holds enough',
    ...(view.pending.some(n => n > 0) ? {
      [op === 'addition' ? 'blocksBeside' : 'stillToTakeAway']: view.pending
        .map((n, i) => (n > 0 ? `${PLACE_NAMES[i]} ${n}` : '')).filter(Boolean).reverse().join(', '),
    } : {}),
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
    // How the learner answers is the card's `moves`; only what is this problem's own is said here.
    constraints: `The blocks are the learner's tool; the check reads the typed number only.${view.regroupMarks ? ''
      : ' No column is marked: which column needs a trade is the learner\'s to find.'}`,
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
