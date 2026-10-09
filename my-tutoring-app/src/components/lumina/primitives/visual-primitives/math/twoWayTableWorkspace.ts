/**
 * Two-way table on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C19).
 *
 * Pure: the component and any probe read the same assignment and scene. Every mode is a gesture item checked by the
 * activity's own Check: a typed probability within the item's tolerance of `expectedProbability`. The tutor is never
 * handed the answer: not the probability, not the division that gives it, not a total the table hides.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TwoWayTableChallenge, TwoWayTableChallengeType } from './TwoWayTable';

/** Which cell, row or column the question names; `given` is the conditioning axis of a conditional item. */
export interface TableTarget {
  row?: number;
  col?: number;
  given?: 'row' | 'col';
}

// ── table arithmetic ─────────────────────────────────────────────────────

export const rowSum = (f: number[][], r: number) => (f[r] ?? []).reduce((s, v) => s + v, 0);
export const colSum = (f: number[][], c: number) => f.reduce((s, row) => s + (row[c] ?? 0), 0);
export const grandSum = (f: number[][]) => f.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);

/** The probability a target asks for, computed from the counts. */
export function probabilityOf(type: TwoWayTableChallengeType, f: number[][], t: TableTarget): number | null {
  const N = grandSum(f);
  if (N <= 0) return null;
  const { row: r, col: c } = t;
  switch (type) {
    case 'joint_probability': return r == null || c == null ? null : f[r][c] / N;
    case 'marginal_distribution': return r != null ? rowSum(f, r) / N : c != null ? colSum(f, c) / N : null;
    case 'conditional_probability': {
      if (r == null || c == null || !t.given) return null;
      const d = t.given === 'row' ? rowSum(f, r) : colSum(f, c);
      return d > 0 ? f[r][c] / d : null;
    }
    case 'independence_test': return r == null || c == null ? null : (rowSum(f, r) / N) * (colSum(f, c) / N);
  }
}

const near = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) <= eps;
const mentions = (q: string, name: string) => q.includes(name);

/**
 * The item's target: the generator's `target`, or (an older payload) the one cell / row / column whose probability is
 * the item's `expectedProbability` and whose categories the question names. Null when none fits.
 */
export function locateTarget(ch: TwoWayTableChallenge): TableTarget | null {
  const f = ch.frequencies;
  const fits = (t: TableTarget) => {
    const p = probabilityOf(ch.challengeType, f, t);
    return p != null && near(p, ch.expectedProbability);
  };
  if (ch.target && fits(ch.target)) return ch.target;
  const R = ch.rowCategories.length, C = ch.columnCategories.length, q = ch.question ?? '';
  const candidates: TableTarget[] = [];
  if (ch.challengeType === 'marginal_distribution') {
    for (let r = 0; r < R; r++) candidates.push({ row: r });
    for (let c = 0; c < C; c++) candidates.push({ col: c });
  } else {
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (ch.challengeType === 'conditional_probability') candidates.push({ row: r, col: c, given: 'row' }, { row: r, col: c, given: 'col' });
      else candidates.push({ row: r, col: c });
    }
  }
  const named = (t: TableTarget) => (t.row == null || mentions(q, ch.rowCategories[t.row]))
    && (t.col == null || mentions(q, ch.columnCategories[t.col]));
  return candidates.find(t => fits(t) && named(t)) ?? candidates.find(fits) ?? null;
}

// ── the activity's check ─────────────────────────────────────────────────

/** The answer box's reading: a decimal, a percent with %, or a number above 1 read as a percent. */
export function parseProbabilityInput(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.endsWith('%')) {
    const v = parseFloat(s.slice(0, -1));
    return Number.isFinite(v) ? v / 100 : null;
  }
  const v = parseFloat(s);
  if (!Number.isFinite(v)) return null;
  return v > 1 ? v / 100 : v;
}

export const formatProbability = (p: number) => p.toFixed(2);
const tolOf = (ch: TwoWayTableChallenge) => ch.tolerance ?? 0.02;

export function matchesKey(ch: TwoWayTableChallenge, value: number): boolean {
  return Math.abs(value - ch.expectedProbability) <= tolOf(ch) + 1e-9;
}

/** The activity's own check. An empty or non-numeric entry is not a check at all (the caller does not commit it). */
export function twoWayCorrect(ch: TwoWayTableChallenge, typed: string): boolean {
  const v = parseProbabilityInput(typed);
  return v != null && matchesKey(ch, v);
}

/** The learner's work in words, never the key. */
export function describeTwoWayWork(typed: string): string {
  const t = typed.trim();
  return t ? `typed ${t}` : 'nothing typed yet';
}

// ── misses ───────────────────────────────────────────────────────────────

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), from the number typed, drawn from the catalog's
 * commonStruggles (joint and marginal confused, a conditional divided by everyone, independence misread):
 * - joint: `row_denominator` / `column_denominator` the cell out of its own row or column (a conditional);
 *   `marginal_instead` the whole row or column out of everyone; `wrong_cell` another cell out of everyone;
 * - marginal: `one_cell` one cell of the row or column out of everyone (not added up); `other_marginal` another row's
 *   or column's total out of everyone;
 * - conditional: `joint_instead` the cell out of everyone; `reversed_condition` the cell out of the other axis's total
 *   (the condition swapped); `marginal_instead` a row or column total out of everyone; `wrong_cell` another cell of the
 *   given group out of the group;
 * - independence: `observed_joint` the cell out of everyone (what was observed, not expected); `one_factor` P(A) or
 *   P(B) alone; `added_factors` P(A) + P(B);
 * - every mode: `typed_count` a count from the table typed as the answer; `near_miss` within 0.05; else `too_high` /
 *   `too_low`.
 */
export type TwoWayMiss = 'row_denominator' | 'column_denominator' | 'marginal_instead' | 'wrong_cell' | 'one_cell'
  | 'other_marginal' | 'joint_instead' | 'reversed_condition' | 'observed_joint' | 'one_factor' | 'added_factors'
  | 'typed_count' | 'near_miss' | 'too_high' | 'too_low';

const SIZE: readonly TwoWayMiss[] = ['typed_count', 'near_miss', 'too_high', 'too_low'];
export const TWO_WAY_MISSES_BY_MODE: Record<TwoWayTableChallengeType, readonly TwoWayMiss[]> = {
  joint_probability: ['row_denominator', 'column_denominator', 'marginal_instead', 'wrong_cell', ...SIZE],
  marginal_distribution: ['one_cell', 'other_marginal', ...SIZE],
  conditional_probability: ['joint_instead', 'reversed_condition', 'marginal_instead', 'wrong_cell', ...SIZE],
  independence_test: ['observed_joint', 'one_factor', 'added_factors', ...SIZE],
};

/** The values each signature miss stands for on this item, most specific first. Shared by the check and the harness. */
export function signatureValues(ch: TwoWayTableChallenge): Array<[TwoWayMiss, number]> {
  const t = locateTarget(ch);
  if (!t) return [];
  const f = ch.frequencies, N = grandSum(f), R = f.length, C = ch.columnCategories.length;
  const out: Array<[TwoWayMiss, number]> = [];
  const { row: r, col: c } = t;
  if (ch.challengeType === 'joint_probability' && r != null && c != null) {
    out.push(['row_denominator', f[r][c] / rowSum(f, r)], ['column_denominator', f[r][c] / colSum(f, c)],
      ['marginal_instead', rowSum(f, r) / N], ['marginal_instead', colSum(f, c) / N]);
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) if (i !== r || j !== c) out.push(['wrong_cell', f[i][j] / N]);
  } else if (ch.challengeType === 'marginal_distribution') {
    if (r != null) {
      for (let j = 0; j < C; j++) out.push(['one_cell', f[r][j] / N]);
      for (let i = 0; i < R; i++) if (i !== r) out.push(['other_marginal', rowSum(f, i) / N]);
      for (let j = 0; j < C; j++) out.push(['other_marginal', colSum(f, j) / N]);
    } else if (c != null) {
      for (let i = 0; i < R; i++) out.push(['one_cell', f[i][c] / N]);
      for (let j = 0; j < C; j++) if (j !== c) out.push(['other_marginal', colSum(f, j) / N]);
      for (let i = 0; i < R; i++) out.push(['other_marginal', rowSum(f, i) / N]);
    }
  } else if (ch.challengeType === 'conditional_probability' && r != null && c != null && t.given) {
    const byRow = t.given === 'row';
    out.push(['joint_instead', f[r][c] / N], ['reversed_condition', f[r][c] / (byRow ? colSum(f, c) : rowSum(f, r))],
      ['marginal_instead', (byRow ? rowSum(f, r) : colSum(f, c)) / N], ['marginal_instead', (byRow ? colSum(f, c) : rowSum(f, r)) / N]);
    const group = byRow ? rowSum(f, r) : colSum(f, c);
    if (byRow) { for (let j = 0; j < C; j++) if (j !== c) out.push(['wrong_cell', f[r][j] / group]); }
    else for (let i = 0; i < R; i++) if (i !== r) out.push(['wrong_cell', f[i][c] / group]);
  } else if (ch.challengeType === 'independence_test' && r != null && c != null) {
    const pA = rowSum(f, r) / N, pB = colSum(f, c) / N;
    out.push(['observed_joint', f[r][c] / N], ['one_factor', pA], ['one_factor', pB]);
    if (pA + pB <= 1) out.push(['added_factors', pA + pB]);
  }
  return out.filter(([, v]) => Number.isFinite(v));
}

/** Every count the table holds: its cells and every row, column and grand total. */
export function tableCounts(ch: TwoWayTableChallenge): number[] {
  const f = ch.frequencies;
  return [...f.flat(), ...f.map((_, r) => rowSum(f, r)), ...ch.columnCategories.map((_, c) => colSum(f, c)), grandSum(f)];
}

export function twoWayMiss(ch: TwoWayTableChallenge, typed: string): TwoWayMiss | undefined {
  const value = parseProbabilityInput(typed);
  if (value == null || matchesKey(ch, value)) return undefined;
  for (const [miss, v] of signatureValues(ch)) {
    // A two-place answer of the pattern: rounded or cut off, so within 0.01.
    if (!matchesKey(ch, v) && Math.abs(value - v) < 0.01) return miss;
  }
  const raw = typed.trim();
  if (/^\d+$/.test(raw) && Number(raw) >= 2 && tableCounts(ch).includes(Number(raw))) return 'typed_count';
  const key = ch.expectedProbability;
  if (Math.abs(value - key) <= 0.05) return 'near_miss';
  return value > key ? 'too_high' : 'too_low';
}

// ── what the tutor is told ───────────────────────────────────────────────

export function workspaceAssignment(ch: TwoWayTableChallenge): TeachingAssignment {
  return { id: ch.id, task: ch.question, response: 'gesture' };
}

/** Which totals the table draws: the support tier's flags, else the legacy single switch. */
export function totalsVisibility(ch: TwoWayTableChallenge): { showRow: boolean; showCol: boolean; showGrand: boolean } {
  const tiered = ch.supportTier != null;
  return {
    showRow: tiered ? !!ch.showRowTotals : ch.showTotals,
    showCol: tiered ? !!ch.showColTotals : ch.showTotals,
    showGrand: tiered ? !!ch.showGrandTotal : ch.showTotals,
  };
}

const KIND: Record<TwoWayTableChallengeType, string> = {
  joint_probability: 'joint probability: one cell, both categories at once, out of everyone',
  marginal_distribution: 'marginal probability: one category, its whole row or column, out of everyone',
  conditional_probability: 'conditional probability: one category within a given group, out of that group only',
  independence_test: 'independence: the joint probability expected if the two categories were independent, P(A) times P(B)',
};

/** What is drawn and asked. Totals are named only where the table draws them; the probability never. */
export function workspaceScene(ch: TwoWayTableChallenge, view: { typed: string }): WorkspaceScene {
  const f = ch.frequencies;
  const { showRow, showCol, showGrand } = totalsVisibility(ch);
  const facts: Record<string, string> = {
    kind: KIND[ch.challengeType],
    scenario: ch.scenario,
    rows: `${ch.rowLabel}: ${ch.rowCategories.join(', ')}`,
    columns: `${ch.columnLabel}: ${ch.columnCategories.join(', ')}`,
    cells: ch.rowCategories.map((rc, r) => `${rc}: ${ch.columnCategories.map((cc, c) => `${cc} ${f[r]?.[c]}`).join(', ')}`).join('; '),
    totals: [
      showRow ? `row totals drawn: ${ch.rowCategories.map((rc, r) => `${rc} ${rowSum(f, r)}`).join(', ')}` : 'row totals hidden',
      showCol ? `column totals drawn: ${ch.columnCategories.map((cc, c) => `${cc} ${colSum(f, c)}`).join(', ')}` : 'column totals hidden',
      showGrand ? `grand total drawn: ${grandSum(f)}` : 'grand total hidden',
    ].join('; '),
  };
  if (ch.sumReminder) facts.reminder = `under the table: ${ch.sumReminder}`;
  facts.learnerWork = describeTwoWayWork(view.typed);
  facts.constraints = 'The learner types a probability in the answer box (a decimal from 0 to 1, or a percent with %) '
    + 'and presses Check. The activity checks it itself, within 0.02. You cannot type, or press Check.';
  return { objects: [], facts };
}

/** The journey row's input: the key to two places, or the item's first signature miss that is not itself right. */
export function twoWayHarnessText(ch: TwoWayTableChallenge, intent: 'correct' | 'wrong'): string {
  const key = ch.expectedProbability;
  if (intent === 'correct') return formatProbability(key);
  const ok = (v: number) => v > 0 && v <= 1 && !matchesKey(ch, Number(formatProbability(v)));
  const signature = signatureValues(ch).find(([, v]) => ok(v));
  if (signature) return formatProbability(signature[1]);
  return formatProbability(key + 0.3 <= 1 ? key + 0.3 : key / 3);
}
