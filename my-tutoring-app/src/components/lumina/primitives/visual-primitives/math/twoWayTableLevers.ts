/**
 * two-way-table's in-item levers (/add-support-tiers; report qa/eval-reports/two-way-table-levers-2026-10-09.md).
 * The misses are what `twoWayMiss` observes in the number typed; there is no real-learner evidence.
 *
 * - `outline_question` (help, every mode): outlines the cells the question is about: the one cell (joint), the whole
 *   row or column (marginal), the given row or column with the asked cell marked (conditional), the row and the column
 *   (independence). No number is written.
 * - `sum_frame` (help, where a total the question needs is hidden): writes each such total as its cells added up,
 *   "= ?". The sum is never written.
 * - `out_of_frame` (help, every mode): writes the probability in words: the group the question counts, divided by
 *   the group it is out of (everyone, or only the given group). Category names only, no number.
 * - `model_table` (help, every mode): a worked example on a different small table, same kind of question, its own
 *   numbers and an answer that is never the item's.
 * - `simpler_table` (simplify, every mode): the same kind of question on a 2 x 2 table of ten people, with the item's
 *   own category names, built here; ungraded practice.
 *
 * Leak rules (code): no lever's `when`/`does` text or scene fact carries a digit; the out-of frame carries no digit
 * outside the category names; the sum frame never writes a sum; the model's answer is outside the item's tolerance; a
 * practice table has its own id, ask, counts and answer, and keeps the mode.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { TwoWayTableChallenge, TwoWayTableChallengeType } from './TwoWayTable';
import {
  TWO_WAY_MISSES_BY_MODE, colSum, formatProbability, grandSum, locateTarget, matchesKey, probabilityOf, rowSum,
  totalsVisibility, type TableTarget, type TwoWayMiss,
} from './twoWayTableWorkspace';

export const OUTLINE_LEVER = 'outline_question';
export const SUM_LEVER = 'sum_frame';
export const OUT_OF_LEVER = 'out_of_frame';
export const MODEL_LEVER = 'model_table';
export const SIMPLER_LEVER = 'simpler_table';

const SIMPLER = '~simpler';
export const isPracticeTable = (c: Pick<TwoWayTableChallenge, 'id'>) => c.id.endsWith(SIMPLER);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

// ── help: what each lever draws ──────────────────────────────────────────

/** The cells `outline_question` outlines, and the asked cell it marks inside them (conditional, joint). */
export function outlineCells(c: TwoWayTableChallenge): { cells: Array<[number, number]>; mark: [number, number] | null } | null {
  const t = locateTarget(c);
  if (!t) return null;
  const R = c.frequencies.length, C = c.columnCategories.length;
  const rowCells = (r: number) => Array.from({ length: C }, (_, j) => [r, j] as [number, number]);
  const colCells = (j: number) => Array.from({ length: R }, (_, i) => [i, j] as [number, number]);
  const { row: r, col: k } = t;
  switch (c.challengeType) {
    case 'joint_probability': return r != null && k != null ? { cells: [[r, k]], mark: [r, k] } : null;
    case 'marginal_distribution': return r != null ? { cells: rowCells(r), mark: null } : k != null ? { cells: colCells(k), mark: null } : null;
    case 'conditional_probability':
      return r != null && k != null ? { cells: t.given === 'row' ? rowCells(r) : colCells(k), mark: [r, k] } : null;
    case 'independence_test': {
      if (r == null || k == null) return null;
      const cells = [...rowCells(r), ...colCells(k).filter(([i]) => i !== r)];
      return { cells, mark: null };
    }
  }
}

/** One total the question needs, written as its cells added up. */
export interface SumFrame { label: string; addends: number[] }

/** The totals the question needs that the table hides, as addition frames. Empty when every needed total is drawn. */
export function sumFrames(c: TwoWayTableChallenge): SumFrame[] {
  const t = locateTarget(c);
  if (!t) return [];
  const f = c.frequencies, { showRow, showCol, showGrand } = totalsVisibility(c);
  const row = (r: number): SumFrame => ({ label: `${c.rowCategories[r]} row`, addends: [...f[r]] });
  const col = (k: number): SumFrame => ({ label: `${c.columnCategories[k]} column`, addends: f.map(x => x[k]) });
  const all: SumFrame = { label: 'Everyone', addends: f.flat() };
  const out: SumFrame[] = [];
  const { row: r, col: k } = t;
  switch (c.challengeType) {
    case 'joint_probability': if (!showGrand) out.push(all); break;
    case 'marginal_distribution':
      if (r != null && !showRow) out.push(row(r));
      if (k != null && !showCol) out.push(col(k));
      if (!showGrand) out.push(all);
      break;
    case 'conditional_probability':
      if (t.given === 'row' && r != null && !showRow) out.push(row(r));
      if (t.given === 'col' && k != null && !showCol) out.push(col(k));
      break;
    case 'independence_test':
      if (r != null && !showRow) out.push(row(r));
      if (k != null && !showCol) out.push(col(k));
      if (!showGrand) out.push(all);
      break;
  }
  return out;
}

/** The probability in words: the group counted, divided by the group it is out of. Category names, no number. */
export function outOfFrame(c: TwoWayTableChallenge): string | null {
  const t = locateTarget(c);
  if (!t) return null;
  const R = t.row != null ? c.rowCategories[t.row] : '', C = t.col != null ? c.columnCategories[t.col] : '';
  switch (c.challengeType) {
    case 'joint_probability': return `P(${R} AND ${C}) = (how many are ${R} AND ${C}) ÷ (everyone in the table)`;
    case 'marginal_distribution': {
      const X = t.row != null ? R : C, axis = t.row != null ? 'row' : 'column';
      return `P(${X}) = (all ${X}: the whole ${axis} added up) ÷ (everyone in the table)`;
    }
    case 'conditional_probability':
      return t.given === 'row'
        ? `P(${C} | ${R}) = (how many ${R} are ${C}) ÷ (all ${R} only, not everyone)`
        : `P(${R} | ${C}) = (how many ${C} are ${R}) ÷ (all ${C} only, not everyone)`;
    case 'independence_test': return `P(${R}) × P(${C}) = (all ${R} ÷ everyone) × (all ${C} ÷ everyone)`;
  }
}

/** Leak rule for the out-of frame: no digit once the item's category names are taken out. */
export function outOfLeaks(c: TwoWayTableChallenge, text: string): boolean {
  let rest = text;
  for (const name of [...c.rowCategories, ...c.columnCategories].sort((a, b) => b.length - a.length)) rest = rest.split(name).join('');
  return /\d/.test(rest);
}

// ── help: the worked model, outside the item ─────────────────────────────

export const MODEL_ROWS = ['Small', 'Large'];
export const MODEL_COLS = ['Red', 'Blue'];
const MODEL_LABELS = { rowLabel: 'Size', columnLabel: 'Color' };
const MODEL_TABLES: number[][][] = [[[3, 2], [1, 4]], [[2, 3], [4, 1]], [[1, 4], [3, 2]], [[4, 1], [2, 3]], [[2, 2], [1, 5]]];

const tidy = (p: number) => formatProbability(p).replace(/0+$/, '').replace(/\.$/, '');

/** A worked table outside the item: its counts, the worked line, and its answer. */
export interface TableModel { rows: string[]; cols: string[]; rowLabel: string; columnLabel: string; frequencies: number[][];
  line: string; answer: number }

function modelTarget(type: TwoWayTableChallengeType): TableTarget {
  return type === 'marginal_distribution' ? { row: 0 } : type === 'conditional_probability' ? { row: 0, col: 1, given: 'row' } : { row: 0, col: 1 };
}

function modelLine(type: TwoWayTableChallengeType, f: number[][], p: number): string {
  const N = grandSum(f), [a, b] = f[0], [S, B] = [MODEL_ROWS[0], MODEL_COLS[1]];
  switch (type) {
    case 'joint_probability': return `P(${S} AND ${B}) = ${b} ÷ ${N} = ${tidy(p)}`;
    case 'marginal_distribution': return `P(${S}) = (${a} + ${b}) ÷ ${N} = ${a + b} ÷ ${N} = ${tidy(p)}`;
    case 'conditional_probability': return `P(${B} | ${S}) = ${b} ÷ (${a} + ${b}) = ${b} ÷ ${a + b} = ${tidy(p)}`;
    case 'independence_test': return `P(${S}) × P(${B}) = (${rowSum(f, 0)} ÷ ${N}) × (${colSum(f, 1)} ÷ ${N}) = ${tidy(p)}`;
  }
}

export function tableModel(c: TwoWayTableChallenge): TableModel | null {
  for (const f of MODEL_TABLES) {
    const p = probabilityOf(c.challengeType, f, modelTarget(c.challengeType));
    if (p == null || matchesKey(c, p) || tidy(p) === tidy(c.expectedProbability)) continue;
    return { rows: MODEL_ROWS, cols: MODEL_COLS, ...MODEL_LABELS, frequencies: f, line: modelLine(c.challengeType, f, p), answer: p };
  }
  return null;
}

// ── simplify ─────────────────────────────────────────────────────────────

/** Already a small table: nothing simpler to offer. */
const alreadySimple = (c: TwoWayTableChallenge) => c.frequencies.length <= 2 && c.columnCategories.length <= 2 && grandSum(c.frequencies) <= 20;

function practiceAsk(type: TwoWayTableChallengeType, rows: string[], cols: string[], t: TableTarget): string {
  const R = t.row != null ? rows[t.row] : '', C = t.col != null ? cols[t.col] : '';
  const tail = 'Enter your answer as a decimal between 0 and 1 (round to 2 decimals).';
  switch (type) {
    case 'joint_probability': return `Practice first: what is P(${R} AND ${C})? ${tail}`;
    case 'marginal_distribution': return `Practice first: what is P(${t.row != null ? R : C})? ${tail}`;
    case 'conditional_probability':
      return t.given === 'row'
        ? `Practice first: given a member is ${R}, what is the probability they are ${C}? Enter P(${C} | ${R}) as a decimal (round to 2 decimals).`
        : `Practice first: given a member is ${C}, what is the probability they are ${R}? Enter P(${R} | ${C}) as a decimal (round to 2 decimals).`;
    case 'independence_test':
      return `Practice first: if ${R} and ${C} were independent, the expected joint probability would be P(${R}) × P(${C}). `
        + 'Compute this expected joint probability (round to 2 decimals).';
  }
}

const PRACTICE_TABLES: number[][][] = [[[3, 2], [1, 4]], [[2, 3], [4, 1]], [[4, 1], [2, 3]], [[1, 4], [3, 2]], [[3, 2], [2, 3]], [[2, 3], [1, 4]],
  [[1, 2], [4, 3]], [[4, 3], [2, 1]]];

/**
 * The easier practice problem for `c`: the same kind of question on a 2 x 2 table of ten, with the item's first two
 * categories each way and an ask built here. Null when the item is already that small.
 */
export function simplerTable(c: TwoWayTableChallenge): TwoWayTableChallenge | null {
  if (isPracticeTable(c) || alreadySimple(c)) return null;
  const parent = locateTarget(c);
  if (!parent) return null;
  const rows = c.rowCategories.slice(0, 2), cols = c.columnCategories.slice(0, 2);
  const target: TableTarget = c.challengeType === 'marginal_distribution'
    ? (parent.row != null ? { row: 0 } : { col: 1 })
    : c.challengeType === 'conditional_probability' ? { row: 0, col: 1, given: parent.given } : { row: 0, col: 1 };
  for (const f of PRACTICE_TABLES) {
    const p = probabilityOf(c.challengeType, f, target);
    if (p == null) continue;
    const practice: TwoWayTableChallenge = {
      ...c, id: `${c.id}${SIMPLER}`, rowCategories: rows, columnCategories: cols, frequencies: f.map(r => [...r]),
      question: practiceAsk(c.challengeType, rows, cols, target), expectedProbability: Math.round(p * 10000) / 10000,
      tolerance: 0.02, hint: '', sumReminder: undefined, target,
    };
    if (!practiceLeaks(c, practice)) return practice;
  }
  return null;
}

/** Leak rule for a practice table: never the learner's item (id, ask, counts), never its answer, and the same mode. */
export function practiceLeaks(parent: TwoWayTableChallenge, practice: TwoWayTableChallenge): boolean {
  return practice.id === parent.id || practice.question === parent.question || practice.challengeType !== parent.challengeType
    || JSON.stringify(practice.frequencies) === JSON.stringify(parent.frequencies)
    || matchesKey(parent, practice.expectedProbability) || matchesKey(practice, parent.expectedProbability)
    || practice.question.includes(formatProbability(parent.expectedProbability));
}

// ── declarations ─────────────────────────────────────────────────────────

const ANSWERS: Record<string, Record<TwoWayTableChallengeType, readonly TwoWayMiss[]>> = {
  [OUTLINE_LEVER]: {
    joint_probability: ['wrong_cell', 'marginal_instead'],
    marginal_distribution: ['one_cell', 'other_marginal'],
    conditional_probability: ['wrong_cell', 'reversed_condition', 'marginal_instead'],
    independence_test: ['observed_joint', 'one_factor'],
  },
  [SUM_LEVER]: {
    joint_probability: ['near_miss', 'too_high', 'too_low'],
    marginal_distribution: ['one_cell', 'near_miss', 'too_high', 'too_low'],
    conditional_probability: ['near_miss', 'too_high', 'too_low'],
    independence_test: ['one_factor', 'near_miss', 'too_high', 'too_low'],
  },
  [OUT_OF_LEVER]: {
    joint_probability: ['row_denominator', 'column_denominator', 'marginal_instead', 'typed_count', 'near_miss', 'too_high', 'too_low'],
    marginal_distribution: ['one_cell', 'other_marginal', 'typed_count', 'near_miss', 'too_high', 'too_low'],
    conditional_probability: ['joint_instead', 'reversed_condition', 'marginal_instead', 'typed_count', 'near_miss', 'too_high', 'too_low'],
    independence_test: ['observed_joint', 'one_factor', 'added_factors', 'typed_count', 'near_miss', 'too_high', 'too_low'],
  },
};

export function twoWayLevers(c: TwoWayTableChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!c || isPracticeTable(c)) return [];
  const t = c.challengeType;
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly TwoWayMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const out: WorkspaceLever[] = [];
  if (outlineCells(c)) {
    out.push(lever(OUTLINE_LEVER, 'help', 'shown', ANSWERS[OUTLINE_LEVER][t],
      'The learner used the wrong cell, row or column for the question.',
      t === 'independence_test'
        ? 'Outlines the row and the column the question names in the table. No number is written.'
        : t === 'conditional_probability'
          ? 'Outlines the given row or column in the table and marks the asked cell inside it. No number is written.'
          : t === 'marginal_distribution'
            ? 'Outlines the whole row or column the question names in the table. No number is written.'
            : 'Outlines the one cell where the two named categories meet. No number is written.'));
  }
  if (sumFrames(c).length) {
    out.push(lever(SUM_LEVER, 'help', 'shown', ANSWERS[SUM_LEVER][t],
      'The learner used one cell for a total, or added a hidden total wrong.',
      'Under the table, writes each total the question needs that the table hides as its cells added up, equals a '
        + 'question mark. The sum is not written.'));
  }
  if (outOfFrame(c)) {
    out.push(lever(OUT_OF_LEVER, 'help', 'both', ANSWERS[OUT_OF_LEVER][t],
      'The learner divides by the wrong group, or types a count instead of a probability.',
      t === 'conditional_probability'
        ? 'Writes the probability in words under the table: how many of the given group are the asked category, divided by '
          + 'the given group only, not everyone. No number.'
        : t === 'independence_test'
          ? 'Writes the expected probability in words under the table: each category\'s total out of everyone, multiplied. '
            + 'No number.'
          : 'Writes the probability in words under the table: the group the question counts, divided by everyone in the '
            + 'table. No number.'));
  }
  if (tableModel(c)) {
    out.push(lever(MODEL_LEVER, 'help', 'both', TWO_WAY_MISSES_BY_MODE[t],
      'The learner does not know how this kind of probability is found from a table.',
      'Shows a worked example beside the table: a different small table with its own counts, the same kind of question, '
        + 'worked out. Read it aloud; it never shows the item\'s answer.'));
  }
  if (simplerTable(c)) {
    out.push(lever(SIMPLER_LEVER, 'simplify', 'shown', TWO_WAY_MISSES_BY_MODE[t],
      'This table is too big or its numbers too hard to work with yet.',
      'Opens an easier problem of the same kind first, on a small table of ten with the same category names. It is not '
        + 'graded; the full item comes back after it.'));
  }
  return out;
}

/** What the pulled help levers put on screen, for the tutor and JEV. No digit, no answer. */
export function leverFacts(c: TwoWayTableChallenge | null, pulled: readonly string[]): string {
  if (!c || isPracticeTable(c)) return '';
  const on = (id: string) => pulled.includes(id);
  return [
    on(OUTLINE_LEVER) && 'The cells the question is about are outlined in the table.',
    on(SUM_LEVER) && 'Under the table, each hidden total the question needs is written as its cells added up, equals a question mark.',
    on(OUT_OF_LEVER) && 'Under the table, the probability is written in words: the group counted, divided by the group it is out of.',
    on(MODEL_LEVER) && 'Beside the table is a worked example on a different small table, with its own counts and answer.',
  ].filter((s): s is string => !!s).join(' ');
}

/** Leak rule for the levers' words and facts: no digit at all. */
export const leverTextLeaks = (text: string) => /\d/.test(text);
