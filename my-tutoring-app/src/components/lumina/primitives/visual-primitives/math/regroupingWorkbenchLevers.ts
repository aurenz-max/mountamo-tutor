/**
 * regrouping-workbench's in-item levers (/add-support-tiers; report qa/eval-reports/regrouping-workbench-levers-2026-10-09.md).
 * The misses are what `regroupMiss` observes in the typed digits; there is no real-learner evidence.
 *
 * - every mode: `column_colors` (help) each place's column of the written problem and its answer box drawn in that
 *   place's block colour, with the place names over the columns; `operation_model` (help) a picture outside the item of
 *   what + or − does to blocks (two groups put together, or some crossed out of one group), captioned in words;
 *   `smaller_problem` (simplify) a same-mode problem one step smaller, built here.
 * - add_regroup / subtract_regroup also: `regroup_marks` (help) the session's regroup marks turned on (the count of a
 *   column that needs a trade drawn red, its Carry/Borrow button the only one), offered only where the session hides
 *   them; `trade_model` (help) a picture outside the item of ten ones becoming one ten (or one ten becoming ten ones).
 *
 * Leak rules (code): no lever text or scene fact carries a digit; a practice problem shares no operand and no result
 * with the learner's item, keeps the mode (a regroup mode keeps at least one trade, a no-regroup mode none), and is
 * strictly smaller (fewer columns, a shorter bottom number, or fewer trades).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { RegroupingChallenge } from './RegroupingWorkbench';
import { digitsOf, operandsOf, regroupColumns, resultOf, type RegroupMiss, type RegroupOperation } from './regroupingWorkbenchWorkspace';

export const COLUMN_COLORS_LEVER = 'column_colors';
export const OPERATION_MODEL_LEVER = 'operation_model';
export const REGROUP_MARKS_LEVER = 'regroup_marks';
export const TRADE_MODEL_LEVER = 'trade_model';
export const SMALLER_LEVER = 'smaller_problem';

const SIMPLER = '~simpler';
export const isPracticeRegroup = (c: Pick<RegroupingChallenge, 'id'>) => c.id.endsWith(SIMPLER);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

type Operands = { operand1: number; operand2: number };
const width = (n: number) => String(Math.abs(Math.floor(n))).length;

/** A small seeded generator, so the same item always opens the same practice problem (the journey row rebuilds it). */
function seeded(text: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Two operands, the top `w` digits wide and the bottom `wb` digits wide, whose column arithmetic trades only in the
 * ones column when `trade`, and nowhere otherwise; no carry out of the top column, and a take-away stays above zero.
 */
function buildOperands(op: RegroupOperation, w: number, wb: number, trade: boolean, rand: () => number): [number, number] {
  const pick = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const a: number[] = [], b: number[] = [];
  let carry = 0;
  for (let i = 0; i < w; i++) {
    const topA = i === w - 1, inB = i < wb, topB = i === wb - 1;
    const bMin = topB ? 1 : 0;
    if (op === 'addition') {
      if (i === 0 && trade) {
        const db = pick(Math.max(2, bMin), 9), da = pick(Math.max(10 - db, topA ? 1 : 0), 9);
        a.push(da); b.push(db); carry = 1;
      } else {
        const db = inB ? pick(bMin, Math.max(bMin, 4)) : 0;
        const da = pick(topA ? 1 : 0, Math.max(topA ? 1 : 0, 9 - carry - db));
        a.push(da); b.push(db); carry = 0;
      }
    } else if (i === 0 && trade) {
      const md = pick(0, 7), sd = pick(Math.max(md + 1, bMin), 9);
      a.push(md); b.push(sd); carry = 1;
    } else {
      const sd = inB ? pick(bMin, 5) : 0;
      const md = pick(Math.max(sd + carry, topA ? 1 : 0, topA && topB ? sd + carry + 1 : 0), 9);
      a.push(md); b.push(sd); carry = 0;
    }
  }
  const from = (ds: number[]) => ds.reduce((n, d, i) => n + d * 10 ** i, 0);
  return [from(a), from(b)];
}

/** The shape of a problem: its width, the bottom number's width, and how many trades it needs. */
export function problemShape(op: RegroupOperation, a: number, b: number) {
  const w = width(Math.max(a, b));
  return { w, wb: width(b), trades: regroupColumns(op, a, b, w + 1).length };
}

/**
 * The easier practice problem for `c`, or null when the item is already the smallest of its mode: fewer trades first
 * (a regroup mode keeps one, in the ones), then one column fewer, then a one-digit bottom number. Same operation and
 * mode, its own id, its result computed here. Deterministic per item.
 */
export function smallerProblem(c: RegroupingChallenge, op: RegroupOperation, fallback: Operands): RegroupingChallenge | null {
  if (isPracticeRegroup(c)) return null;
  const [a, b] = operandsOf(c, fallback);
  const shape = problemShape(op, a, b);
  const trade = shape.trades > 0;
  let target: { w: number; wb: number } | null = null;
  if (shape.trades >= 2) target = { w: shape.w, wb: Math.min(shape.wb, shape.w) };
  else if (shape.w >= 3) target = { w: shape.w - 1, wb: Math.min(shape.wb, shape.w - 1) };
  else if (shape.wb >= 2) target = { w: 2, wb: 1 };
  if (!target) return null;
  const rand = seeded(c.id);
  for (let tries = 0; tries < 40; tries++) {
    const [x, y] = buildOperands(op, target.w, target.wb, trade, rand);
    const simpler: RegroupingChallenge = {
      ...c, id: `${c.id}${SIMPLER}`, problem: `${x} ${op === 'addition' ? '+' : '-'} ${y}`,
      requiresRegrouping: trade, regroupCount: trade ? 1 : 0, hint: '', narration: '',
    };
    if (!simplerLeaks(c, simpler, op, fallback)) return simpler;
  }
  return null;
}

/**
 * Leak rule for a practice problem: never the learner's item (its id, either operand, its result), the same mode (a
 * trade where the item has one, none where it has none), strictly smaller, and a take-away above zero.
 */
export function simplerLeaks(parent: RegroupingChallenge, simpler: RegroupingChallenge, op: RegroupOperation, fallback: Operands): boolean {
  if (simpler.id === parent.id) return true;
  const [a, b] = operandsOf(parent, fallback), [x, y] = operandsOf(simpler, fallback);
  if ([x, y].some(n => n === a || n === b) || resultOf(op, x, y) === resultOf(op, a, b)) return true;
  if (resultOf(op, x, y) <= 0 || x <= 0 || y <= 0) return true;
  const p = problemShape(op, a, b), s = problemShape(op, x, y);
  if ((p.trades > 0) !== (s.trades > 0)) return true;
  const smaller = s.trades < p.trades || s.w < p.w || s.wb < p.wb;
  return !smaller || s.trades > p.trades || s.w > p.w;
}

// ── declarations ─────────────────────────────────────────────────────────

export interface RegroupLeverContext {
  operation: RegroupOperation;
  fallback: Operands;
  /** The session already draws the regroup marks (the easy tier's starting position). */
  marksShown: boolean;
}

export function regroupLevers(c: RegroupingChallenge | null, pulled: readonly string[], ctx: RegroupLeverContext): WorkspaceLever[] {
  if (!c || isPracticeRegroup(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly RegroupMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const [a, b] = operandsOf(c, ctx.fallback);
  const add = ctx.operation === 'addition';
  const regroups = regroupColumns(ctx.operation, a, b, width(Math.max(a, b)) + 1).length > 0;
  const tradeMisses: readonly RegroupMiss[] = add ? ['no_carry'] : ['smaller_from_larger', 'forgot_to_reduce'];
  const simpler = smallerProblem(c, ctx.operation, ctx.fallback);
  return [
    lever(COLUMN_COLORS_LEVER, 'help', 'shown', ['left_blank', 'misplaced_digits', 'column_slip', 'other_answer'],
      'The learner writes a digit in the wrong place, leaves a box empty, or slips in one column.',
      'Draws each place\'s column of the written problem and its answer box in the colour of that place\'s blocks, with '
        + 'the place names over the columns. No digit is added.'),
    lever(OPERATION_MODEL_LEVER, 'help', 'both', ['wrong_operation'],
      add ? 'The learner takes away instead of putting together.' : 'The learner puts together instead of taking away.',
      add ? 'Shows a picture outside the item: two small groups of plain dots joined into one group, captioned put '
          + 'together. Read the caption aloud; it uses none of the item\'s numbers.'
        : 'Shows a picture outside the item: one group of plain dots with some crossed out, captioned take away. Read the '
          + 'caption aloud; it uses none of the item\'s numbers.'),
    ...(regroups && !ctx.marksShown ? [lever(REGROUP_MARKS_LEVER, 'help', 'shown', tradeMisses,
      add ? 'The learner does not see that a column makes ten or more.' : 'The learner does not see that a top digit is too small.',
      `Draws the block count of each column that needs a trade in red, and shows the ${add ? 'Carry' : 'Borrow'} button `
        + 'only under that column. It writes no digit of the answer.')] : []),
    ...(regroups ? [lever(TRADE_MODEL_LEVER, 'help', 'both', tradeMisses,
      add ? 'The learner leaves out the carried ten.' : 'The learner takes the smaller digit from the larger, or forgets the next place is one less.',
      add ? 'Shows a picture outside the item: a column of ten small cubes joined into one rod, captioned ten ones make one '
          + 'ten. Read the caption aloud; it uses none of the item\'s numbers.'
        : 'Shows a picture outside the item: one rod leaving the tens and broken into ten small cubes in the ones, '
          + 'captioned one ten makes ten ones, and the tens have one less. Read the caption aloud; it uses none of the item\'s numbers.')] : []),
    ...(simpler ? [lever(SMALLER_LEVER, 'simplify', 'shown',
      regroups ? [...tradeMisses, 'column_slip', 'other_answer'] : ['column_slip', 'other_answer'],
      'This problem is too big to work through yet.',
      `Opens an easier ${add ? 'addition' : 'subtraction'} first, ${regroups ? 'with one trade, in the ones' : 'with no trade'} `
        + 'and fewer digits. It is not graded; the full item comes back after it.')] : []),
  ];
}

/** What the pulled help levers put on screen, for the tutor and JEV. No digit, no answer. */
export function leverFacts(c: RegroupingChallenge | null, pulled: readonly string[], operation: RegroupOperation): string {
  if (!c || isPracticeRegroup(c)) return '';
  const on = (id: string) => pulled.includes(id);
  const add = operation === 'addition';
  return [
    on(COLUMN_COLORS_LEVER) && 'Each column of the written problem and its answer box is drawn in its place\'s block colour, '
      + 'with the place names over the columns.',
    on(OPERATION_MODEL_LEVER) && (add ? 'Beside the problem is a picture outside the item: two small groups of dots joined '
      + 'into one, captioned put together.' : 'Beside the problem is a picture outside the item: one group of dots with some '
      + 'crossed out, captioned take away.'),
    on(REGROUP_MARKS_LEVER) && `The regroup marks are on: a column that needs a trade has its count drawn red and the only ${
      add ? 'Carry' : 'Borrow'} button.`,
    on(TRADE_MODEL_LEVER) && (add ? 'Beside the blocks is a picture outside the item: ten small cubes joined into one rod, '
      + 'captioned ten ones make one ten.' : 'Beside the blocks is a picture outside the item: one rod broken into ten small '
      + 'cubes, captioned one ten makes ten ones, and the tens have one less.'),
  ].filter((s): s is string => !!s).join(' ');
}

/** Leak rule for the help levers' words: no digit at all (the answer is written in digits). */
export const leverTextLeaks = (text: string) => /\d/.test(text);

/** The digits of a problem's answer, for the tests' "nowhere new on screen" checks. */
export const answerDigits = (op: RegroupOperation, a: number, b: number) => digitsOf(resultOf(op, a, b), width(resultOf(op, a, b)));
