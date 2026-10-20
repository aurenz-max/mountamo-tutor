/**
 * The in-item levers on vehicle-comparison-lab, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/vehicle-comparison-lab-levers-2026-10-16.md). No real-learner evidence: the misses are what
 * `comparisonMiss` observes; the failures behind them are documented (the old catalog's commonStruggles: looks only
 * at speed, struggles with the constraints) or inferred (compares numbers by their first digit, reads the wrong
 * column, forgets that a smaller CO2 number is better, picks the impressive vehicle instead of the one the job
 * needs). Every lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `count_digits` (marks; every mode): writes under each number in the asked column (evidence_choice: every column)
 *   how many digits its whole number has. It orders and marks nothing.
 * - `smaller_is_better` (clue; a lower-is-better column asked): a card saying a smaller CO2 number means less pollution.
 * - `focus_column` (layout; metric_leader with other columns): fades every column but the one the ask names.
 * - `column_meanings` (meaning; evidence_choice): a card saying what each column measures, in plain words, every column alike.
 * - `mark_minimums` (marks; constraint_tradeoff): a tick or a cross beside each minimum cell of every row. It does not
 *   mark the priority column.
 * - `two_rows` (easier; metric_leader, 3+ rows): the same column on two other vehicles, ungraded, then the full item.
 * - `fewer_columns` (easier; evidence_choice): the same job on fewer vehicles (not the one that leads) and two
 *   columns, ungraded, then the full item.
 * - `one_minimum` (easier; constraint_tradeoff): one minimum, without the vehicle that answers the full item,
 *   ungraded, then the full item.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { VEHICLE_MISSES } from './vehicleComparisonLab.card';
import {
  cellText, comparisonMiss, emptyWork, feasibleRows, keyName, keyOf, leaderOf, lowerWins, meets, METRIC_LABEL, METRIC_MEANING,
  minimumText, ranked,
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

// ── The lever set ────────────────────────────────────────────────────────────────────────

const PRACTICE_NOTE = 'It is not graded; this item comes back after it.';
type Mode = VehicleItem['mode'];
const digitsWhere = (item: VehicleItem) => (item.mode === 'evidence_choice' ? 'in every column' : `in the ${METRIC_LABEL[item.metric]} column`);
const countDigits = (mode: Mode, answers: readonly VehicleMiss[]) => ({
  id: COUNT_DIGITS_LEVER, type: 'marks' as const, modes: [mode], answers,
  when: 'The learner compares the numbers by their first digit, or misreads how big they are.',
  does: (item: VehicleItem) => `Writes under each number ${digitsWhere(item)} how many digits it has. It orders and marks nothing.`,
  fact: (_on: unknown, item: VehicleItem) => `Under each number ${item.mode === 'evidence_choice' ? '' : `in the ${METRIC_LABEL[item.metric]} column `}`
    + 'its digit count is written: '
    + digitColumns(item).map(c => item.rows.map(r => `${r.name} ${cellText(item, r, c)} (${digitNote(r.values[c]!)})`).join(', ')).join('; ') + '.',
});
const smallerIsBetter = (modes: readonly Mode[], answers: readonly VehicleMiss[]) => ({
  id: SMALLER_IS_BETTER_LEVER, type: 'clue' as const, modes, answers,
  when: 'The learner chose the largest number where a smaller number is better.',
  does: (item: VehicleItem) => `Shows a card: for ${METRIC_LABEL[item.metric]}, a smaller number means less pollution.`,
  offer: (item: VehicleItem) => lowerWins(item.metric),
  fact: (_on: unknown, item: VehicleItem) => `A card: ${smallerLine(item.metric)}`,
});

/** The levers read nothing beside the item. */
export type VehicleLeverContext = Record<string, never>;
export const NO_CONTEXT: VehicleLeverContext = {};

/** In the order the observer offers them: on every miss a help lever comes before the item's easier one. */
export const VEHICLE_LEVERS = leverSet<VehicleItem, VehicleLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => VEHICLE_MISSES[mode as Mode] ?? [],
  // No card's words name the vehicle that answers the item.
  answersOf: item => [keyName(item)],
  specs: [
    { id: MARK_MINIMUMS_LEVER, type: 'marks', modes: ['constraint_tradeoff'], answers: ['ignored_minimum'],
      when: 'The learner picks a vehicle that misses a minimum.',
      does: item => `Puts a tick or a cross beside each vehicle's ${item.mode === 'constraint_tradeoff'
        ? item.minimums.map(n => METRIC_LABEL[n.metric]).join(' and ') : ''} number: ticked when it meets the minimum.`,
      fact: (_on: unknown, item) => (item.mode !== 'constraint_tradeoff' ? ''
        : `Beside each minimum number is a tick when it meets "${item.minimums.map(n => minimumText(item, n)).join('" and "')}", a cross when not: `
          + item.rows.map(r => `${r.name} ${minimumMarks(item, r).map(m => `${METRIC_LABEL[m.metric]} ${m.met ? 'tick' : 'cross'}`).join(', ')}`).join('; ')
          + '.') },
    smallerIsBetter(['metric_leader', 'constraint_tradeoff'], ['reversed']),
    { id: FOCUS_COLUMN_LEVER, type: 'layout', modes: ['metric_leader'], answers: ['other_column_leader'],
      when: 'The learner reads a different column from the one asked.',
      does: item => `Fades every column except ${METRIC_LABEL[item.metric]}.`,
      offer: item => item.columns.length > 1,
      fact: (_on: unknown, item) => `Every column except ${METRIC_LABEL[item.metric]} is faded.` },
    { id: COLUMN_MEANINGS_LEVER, type: 'meaning', modes: ['evidence_choice'], answers: ['wrong_evidence', 'other_column_leader'],
      when: 'The learner does not connect the job to a column, or picks a vehicle for a different reason than the job.',
      does: 'Shows a card saying what each column measures, in plain words, every column alike.',
      content: item => meaningLines(item),
      fact: (lines: string[]) => `A card says what each column measures: ${lines.join(' ')}` },
    countDigits('metric_leader', ['leading_digit', 'reversed', 'runner_up', 'not_leader']),
    countDigits('evidence_choice', ['misread_column', 'not_leader', 'other_column_leader']),
    countDigits('constraint_tradeoff', ['reversed', 'not_priority_leader']),
    // On evidence_choice a lower-is-better column is the job's own (the cleanest trip): the largest number there misreads it.
    smallerIsBetter(['evidence_choice'], ['misread_column', 'not_leader']),
    { id: TWO_ROWS_LEVER, type: 'easier', modes: ['metric_leader'], answers: 'all',
      when: 'The learner cannot compare several numbers at once.',
      does: `Opens the same column on just two other vehicles first. ${PRACTICE_NOTE}`,
      content: item => simplerItem(item) },
    { id: FEWER_COLUMNS_LEVER, type: 'easier', modes: ['evidence_choice'], answers: 'all',
      when: 'The learner is lost in a big table.',
      does: `Opens the same job on fewer vehicles and two columns first. ${PRACTICE_NOTE}`,
      content: item => simplerItem(item) },
    { id: ONE_MINIMUM_LEVER, type: 'easier', modes: ['constraint_tradeoff'], answers: 'all',
      when: 'The learner cannot hold two minimums at once.',
      does: `Opens a job with one minimum on a smaller table first. ${PRACTICE_NOTE}`,
      content: item => simplerItem(item) },
  ],
});

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
