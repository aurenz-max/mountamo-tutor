/**
 * The in-item levers on vehicle-comparison-lab (`/add-support-tiers`; report
 * qa/eval-reports/vehicle-comparison-lab-levers-2026-10-16.md). No real-learner evidence: the misses are what
 * `comparisonMiss` observes; the failures behind them are documented (the old catalog's commonStruggles: looks only
 * at speed, struggles with the constraints) or inferred (compares numbers by their first digit, reads the wrong
 * column, forgets that a smaller CO2 number is better, picks the impressive vehicle instead of the one the job
 * needs). Every lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `count_digits` (help; every mode): writes under each number in the asked column (evidence_choice: every column)
 *   how many digits its whole number has. It orders and marks nothing.
 * - `smaller_is_better` (help; a lower-is-better column asked): a card saying a smaller CO2 number means less pollution.
 * - `focus_column` (help; metric_leader with other columns): fades every column but the one the ask names.
 * - `column_meanings` (help; evidence_choice): a card saying what each column measures, in plain words, every column alike.
 * - `mark_minimums` (help; constraint_tradeoff): a tick or a cross beside each minimum cell of every row. It does not
 *   mark the priority column.
 * - `two_rows` (simplify; metric_leader, 3+ rows): the same column on two other vehicles, ungraded, then the full item.
 * - `fewer_columns` (simplify; evidence_choice): the same job on fewer vehicles (not the one that leads) and two
 *   columns, ungraded, then the full item.
 * - `one_minimum` (simplify; constraint_tradeoff): one minimum, without the vehicle that answers the full item,
 *   ungraded, then the full item.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  cellText, comparisonMiss, emptyWork, feasibleRows, keyOf, leaderOf, lowerWins, meets, METRIC_LABEL, METRIC_MEANING,
  minimumText, ranked, VEHICLE_MISSES,
  type EvidenceItem, type LeaderItem, type MetricKey, type TradeoffItem, type VehicleItem, type VehicleMiss, type VehicleRow,
} from './vehicleComparisonWorkspace';

export const COUNT_DIGITS_LEVER = 'count_digits';
export const SMALLER_IS_BETTER_LEVER = 'smaller_is_better';
export const FOCUS_COLUMN_LEVER = 'focus_column';
export const COLUMN_MEANINGS_LEVER = 'column_meanings';
export const MARK_MINIMUMS_LEVER = 'mark_minimums';
export const TWO_ROWS_LEVER = 'two_rows';
export const FEWER_COLUMNS_LEVER = 'fewer_columns';
export const ONE_MINIMUM_LEVER = 'one_minimum';

/** The columns count_digits writes under. */
export const digitColumns = (item: VehicleItem): MetricKey[] => (item.mode === 'evidence_choice' ? item.columns : [item.metric]);
export const digitCount = (n: number) => String(Math.floor(Math.abs(n))).length;
export const digitNote = (n: number) => `${digitCount(n)} digit${digitCount(n) === 1 ? '' : 's'}`;

/** smaller_is_better: the card. */
export const smallerLine = (m: MetricKey) => `For ${METRIC_LABEL[m]}, a smaller number is better: it means less pollution.`;
/** column_meanings: one line per column, in the table's order. */
export const meaningLines = (item: VehicleItem) => item.columns.map(c => `${METRIC_LABEL[c]}: ${METRIC_MEANING[c]}.`);
/** mark_minimums: per row and minimum, met or not. */
export const minimumMarks = (item: TradeoffItem, row: VehicleRow) => item.minimums.map(n => ({ metric: n.metric, met: meets(row, [n]) }));

/** The leak rule for every lever line: no word that ranks a vehicle or names a winner. */
export function rankLeak(line: string): boolean {
  return /\b(leads?|leader|winner|wins|best|most|greatest|highest|largest|biggest|fastest|farthest|top choice|first place|qualif\w*|the answer)\b/i.test(line);
}

// ── Simplify: practice items ─────────────────────────────────────────────────────────────

const PRACTICE = '~simpler';
export const isPractice = (item: Pick<VehicleItem, 'id'>) => item.id.endsWith(PRACTICE);
export const practiceParent = (id: string) => (id.endsWith(PRACTICE) ? id.slice(0, -PRACTICE.length) : null);

/** The simpler item, or null. Never the full item's answer vehicle, and never shrinks twice. */
export function simplerItem(item: VehicleItem): VehicleItem | null {
  if (isPractice(item)) return null;
  const id = `${item.id}${PRACTICE}`;
  const key = keyOf(item).vehicle;
  if (item.mode === 'metric_leader') {
    // The two vehicles behind the leader: a near pair is still a comparison, never the full item's leader.
    const order = ranked(item.rows, item.metric).filter(x => x.id !== key);
    const pair = order.slice(0, 2);
    if (pair.length < 2 || !leaderOf(pair, item.metric)) return null;
    const rows = item.rows.filter(x => pair.includes(x));
    return { ...item, id, rows, columns: [item.metric] } as LeaderItem;
  }
  if (item.mode === 'evidence_choice') {
    const rows = item.rows.filter(x => x.id !== key);
    const lead = leaderOf(rows, item.metric);
    if (rows.length < 2 || !lead) return null;
    const other = item.columns.find(c => c !== item.metric && leaderOf(rows, c) && leaderOf(rows, c)!.id !== lead.id);
    if (!other) return null;
    return { ...item, id, rows, columns: item.columns.filter(c => c === item.metric || c === other) } as EvidenceItem;
  }
  const rows = item.rows.filter(x => x.id !== key);
  const overall = leaderOf(rows, item.metric);
  for (const n of item.minimums) {
    const s: TradeoffItem = { ...item, id, rows, minimums: [n], columns: item.columns.filter(c => c === n.metric || c === item.metric) };
    const feasible = feasibleRows(s);
    if (!feasible.length || (feasible.length > 1 && !leaderOf(feasible, s.metric))) continue;
    // The trap stays: the vehicle that leads the priority overall misses the minimum.
    if (!overall || meets(overall, [n])) continue;
    if (keyOf(s).vehicle === key) continue;
    return s;
  }
  return null;
}

// ── Levers on the current item ───────────────────────────────────────────────────────────

const lever = (id: string, kind: WorkspaceLever['kind'], pulled: readonly string[], answers: readonly VehicleMiss[], when: string, does: string): WorkspaceLever =>
  ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });

/** The levers on the current session item. A practice item has none. */
export function vehicleLevers(item: VehicleItem | undefined, pulled: readonly string[]): WorkspaceLever[] {
  if (!item || isPractice(item)) return [];
  const out: WorkspaceLever[] = [];
  const simpler = simplerItem(item);
  const lower = lowerWins(item.metric);
  const smaller = () => lever(SMALLER_IS_BETTER_LEVER, 'help', pulled, ['reversed'],
    'The learner chose the largest number where a smaller number is better.',
    `Shows a card: for ${METRIC_LABEL[item.metric]}, a smaller number means less pollution.`);
  const digits = (answers: readonly VehicleMiss[], where: string) => lever(COUNT_DIGITS_LEVER, 'help', pulled, answers,
    'The learner compares the numbers by their first digit, or misreads how big they are.',
    `Writes under each number ${where} how many digits it has. It orders and marks nothing.`);
  if (item.mode === 'metric_leader') {
    if (lower) out.push(smaller());
    if (item.columns.length > 1) {
      out.push(lever(FOCUS_COLUMN_LEVER, 'help', pulled, ['other_column_leader'], 'The learner reads a different column from the one asked.',
        `Fades every column except ${METRIC_LABEL[item.metric]}.`));
    }
    out.push(digits(['leading_digit', 'reversed', 'runner_up', 'not_leader'], `in the ${METRIC_LABEL[item.metric]} column`));
    if (simpler) {
      out.push(lever(TWO_ROWS_LEVER, 'simplify', pulled, VEHICLE_MISSES.metric_leader, 'The learner cannot compare several numbers at once.',
        `Opens the same column on just two other vehicles first. It is not graded; this item comes back after it.`));
    }
    return out;
  }
  if (item.mode === 'evidence_choice') {
    out.push(lever(COLUMN_MEANINGS_LEVER, 'help', pulled, ['wrong_evidence', 'other_column_leader'],
      'The learner does not connect the job to a column, or picks a vehicle for a different reason than the job.',
      'Shows a card saying what each column measures, in plain words, every column alike.'));
    out.push(digits(['misread_column', 'not_leader', 'other_column_leader'], 'in every column'));
    if (lower) out.push(smaller());
    if (simpler) {
      out.push(lever(FEWER_COLUMNS_LEVER, 'simplify', pulled, VEHICLE_MISSES.evidence_choice, 'The learner is lost in a big table.',
        'Opens the same job on fewer vehicles and two columns first. It is not graded; this item comes back after it.'));
    }
    return out;
  }
  out.push(lever(MARK_MINIMUMS_LEVER, 'help', pulled, ['ignored_minimum'], 'The learner picks a vehicle that misses a minimum.',
    `Puts a tick or a cross beside each vehicle's ${item.minimums.map(n => METRIC_LABEL[n.metric]).join(' and ')} number: ticked when it meets the minimum.`));
  if (lower) out.push(smaller());
  out.push(digits(['reversed', 'not_priority_leader'], `in the ${METRIC_LABEL[item.metric]} column`));
  if (simpler) {
    out.push(lever(ONE_MINIMUM_LEVER, 'simplify', pulled, VEHICLE_MISSES.constraint_tradeoff, 'The learner cannot hold two minimums at once.',
      'Opens a job with one minimum on a smaller table first. It is not graded; this item comes back after it.'));
  }
  return out;
}

/** What the pulled levers put on screen, as a scene fact. Never a key or a ranking. */
export function leverFact(item: VehicleItem | undefined, pulled: readonly string[]): string {
  if (!item || isPractice(item)) return '';
  const parts: string[] = [];
  if (pulled.includes(SMALLER_IS_BETTER_LEVER)) parts.push(`A card: ${smallerLine(item.metric)}`);
  if (pulled.includes(FOCUS_COLUMN_LEVER)) parts.push(`Every column except ${METRIC_LABEL[item.metric]} is faded.`);
  if (pulled.includes(COLUMN_MEANINGS_LEVER)) parts.push(`A card says what each column measures: ${meaningLines(item).join(' ')}`);
  if (pulled.includes(COUNT_DIGITS_LEVER)) {
    parts.push(`Under each number ${item.mode === 'evidence_choice' ? '' : `in the ${METRIC_LABEL[item.metric]} column `}its digit count is written: `
      + digitColumns(item).map(c => item.rows.map(r => `${r.name} ${cellText(item, r, c)} (${digitNote(r.values[c]!)})`).join(', ')).join('; ')
      + '.');
  }
  if (pulled.includes(MARK_MINIMUMS_LEVER) && item.mode === 'constraint_tradeoff') {
    parts.push(`Beside each minimum number is a tick when it meets "${item.minimums.map(n => minimumText(item, n)).join('" and "')}", a cross when not: `
      + item.rows.map(r => `${r.name} ${minimumMarks(item, r).map(m => `${METRIC_LABEL[m.metric]} ${m.met ? 'tick' : 'cross'}`).join(', ')}`).join('; ')
      + '.');
  }
  return parts.join(' ');
}

/** For tests: every miss this item's work can show. */
export function possibleMisses(item: VehicleItem): VehicleMiss[] {
  const out = new Set<VehicleMiss>();
  const key = keyOf(item);
  const works = [
    ...item.rows.map(r => ({ ...emptyWork(), vehicle: r.id, evidence: key.evidence ?? null })),
    ...(item.mode === 'evidence_choice' ? item.rows.flatMap(r => item.columns.map(c => ({ vehicle: r.id, evidence: c }))) : []),
  ];
  for (const w of works) { const m = comparisonMiss(item, w); if (m) out.add(m); }
  return Array.from(out);
}
