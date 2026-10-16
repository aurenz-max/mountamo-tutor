/**
 * vehicle-comparison-lab on the shared tutor/JEV teaching workspace (W1, plain shape; ROLLOUT C32).
 *
 * The model supplies a roster of real vehicles with their statistics; code builds every item and its key from those
 * numbers. Each item is a data table: some vehicles (rows) and some measures (columns), in an order that is not
 * sorted by any value. Each mode is a task:
 * - metric_leader: the ask names one column; the learner chooses the vehicle that leads it (the greatest value, or
 *   the lowest for CO2 per rider). easy: 3 rows, one column, the leader far ahead; medium: 4 rows and a second
 *   column whose leader is another vehicle; hard: 5 rows, two extra columns, and a close race, a lower-is-better
 *   column, or a value whose first digit is bigger than the leader's.
 * - evidence_choice: a job with one need, worded without naming any column. The learner chooses the vehicle AND the
 *   column whose numbers prove it. easy: 2 columns, medium 3, hard 4; another column always has a different leader.
 * - constraint_tradeoff: a job with minimums (people, cargo, distance or speed) and one priority. The learner first
 *   rules out the vehicles that miss a minimum, then chooses the one that leads the priority among the rest. The
 *   vehicle that leads the priority overall always misses a minimum. easy: one minimum; medium: two; hard: two, with
 *   two vehicles that each miss only one of them, and an extra column.
 * Every answer is one vehicle (with a column on evidence_choice), said aloud or tapped (J14).
 *
 * Pure: the component, the generator, the adapter, the journey row and the tests read the same items, checks, misses
 * and scene.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { VehicleVisualCategory, VehicleVisualKind } from './vehicleVisualKind';
import { plausible } from './vehiclePlausibility';

export type MetricKey =
  | 'topSpeed' | 'weight' | 'passengerCapacity' | 'cargoCapacity' | 'range' | 'yearIntroduced' | 'co2PerPassengerKm';
export const METRIC_KEYS: MetricKey[] = ['topSpeed', 'weight', 'passengerCapacity', 'cargoCapacity', 'range', 'yearIntroduced', 'co2PerPassengerKm'];
export type VehicleMode = 'metric_leader' | 'evidence_choice' | 'constraint_tradeoff';
export const VEHICLE_MODES: VehicleMode[] = ['metric_leader', 'evidence_choice', 'constraint_tradeoff'];
export type VehicleTier = 'easy' | 'medium' | 'hard';

// ── The roster as the model writes it ────────────────────────────────────────────────────

export interface VehicleMetric { value: number; unit: string; display: string }
export interface ComparisonVehicle {
  id: string;
  name: string;
  category: VehicleVisualCategory;
  visualKind?: VehicleVisualKind;
  imagePrompt?: string;
  imageUrl?: string | null;
  metrics: {
    topSpeed: VehicleMetric;
    weight: VehicleMetric;
    passengerCapacity: VehicleMetric;
    /** Tons of freight per trip; 0 for a people-only vehicle. Absent on older data. */
    cargoCapacity?: VehicleMetric;
    range: VehicleMetric;
    fuelType: string;
    yearIntroduced: number;
    costPerTrip: string | null;
    co2PerPassengerKm: number | null;
  };
  funFact: string;
}

// ── Measures ─────────────────────────────────────────────────────────────────────────────

/** A smaller number leads. */
export const LOWER_WINS: Partial<Record<MetricKey, true>> = { co2PerPassengerKm: true };
export const lowerWins = (m: MetricKey) => !!LOWER_WINS[m];
/** The column heading, and the label of its evidence button. */
export const METRIC_LABEL: Record<MetricKey, string> = {
  topSpeed: 'Top speed', weight: 'Weight', passengerCapacity: 'Passengers', cargoCapacity: 'Cargo', range: 'Range',
  yearIntroduced: 'Year introduced', co2PerPassengerKm: 'CO₂ per rider',
};
const METRIC_NAME: Record<MetricKey, string> = {
  topSpeed: 'top speed', weight: 'weight', passengerCapacity: 'passengers', cargoCapacity: 'cargo', range: 'range',
  yearIntroduced: 'year introduced', co2PerPassengerKm: 'CO₂ per rider',
};
/** What a column measures, in plain words (the column_meanings lever). */
export const METRIC_MEANING: Record<MetricKey, string> = {
  topSpeed: 'how fast it can go',
  weight: 'how heavy it is',
  passengerCapacity: 'how many people it can carry at once',
  cargoCapacity: 'how many tons of goods it can carry at a time',
  range: 'how far it can go before it must refuel or recharge',
  yearIntroduced: 'the year it was first built',
  co2PerPassengerKm: 'how many grams of CO₂ gas it gives off for each person, each kilometer',
};
const FIXED_UNIT: Partial<Record<MetricKey, string>> = {
  passengerCapacity: 'people', cargoCapacity: 'tons', co2PerPassengerKm: 'g', yearIntroduced: '',
};

// ── Items ────────────────────────────────────────────────────────────────────────────────

export interface VehicleRow {
  id: string;
  name: string;
  category: VehicleVisualCategory;
  visualKind?: VehicleVisualKind;
  values: Partial<Record<MetricKey, number>>;
}
interface ItemBase {
  id: string;
  /** The vehicles, in display order (never sorted by a value). */
  rows: VehicleRow[];
  /** The measures shown, in display order. */
  columns: MetricKey[];
  units: Partial<Record<MetricKey, string>>;
  /** metric_leader: the column asked; evidence_choice: the column the job needs; constraint_tradeoff: the priority. */
  metric: MetricKey;
}
export interface LeaderItem extends ItemBase { mode: 'metric_leader' }
export interface EvidenceItem extends ItemBase { mode: 'evidence_choice' }
export interface Minimum { metric: MetricKey; atLeast: number }
export interface TradeoffItem extends ItemBase { mode: 'constraint_tradeoff'; minimums: Minimum[] }
export type VehicleItem = LeaderItem | EvidenceItem | TradeoffItem;

export const unitOf = (item: Pick<ItemBase, 'units'>, m: MetricKey) => FIXED_UNIT[m] ?? item.units[m] ?? '';
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}
/** A cell as drawn: the number and its unit. */
export function cellText(item: Pick<ItemBase, 'units'>, row: VehicleRow, m: MetricKey): string {
  const v = row.values[m];
  if (v == null) return '—';
  if (m === 'yearIntroduced') return String(v);
  const unit = unitOf(item, m);
  return unit ? `${formatNumber(v)} ${unit}` : formatNumber(v);
}

export const better = (m: MetricKey, a: number, b: number) => (lowerWins(m) ? a < b : a > b);
/** Best first; rows without a value last. */
export function ranked(rows: VehicleRow[], m: MetricKey): VehicleRow[] {
  return [...rows].sort((a, b) => {
    const va = a.values[m], vb = b.values[m];
    if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1;
    return better(m, va, vb) ? -1 : better(m, vb, va) ? 1 : 0;
  });
}
/** The one row that leads a column, or null on a tie or a missing value. */
export function leaderOf(rows: VehicleRow[], m: MetricKey): VehicleRow | null {
  if (rows.length < 2 || rows.some(r => r.values[m] == null)) return null;
  const [a, b] = ranked(rows, m);
  return better(m, a.values[m]!, b.values[m]!) ? a : null;
}
export const meets = (row: VehicleRow, mins: Minimum[]) => mins.every(n => (row.values[n.metric] ?? -Infinity) >= n.atLeast);
export const feasibleRows = (item: TradeoffItem) => item.rows.filter(r => meets(r, item.minimums));

/** The vehicle (and, on evidence_choice, the column) that is right. */
export function keyOf(item: VehicleItem): { vehicle: string; evidence?: MetricKey } {
  const pool = item.mode === 'constraint_tradeoff' ? feasibleRows(item) : item.rows;
  const lead = pool.length === 1 ? pool[0] : leaderOf(pool, item.metric);
  return { vehicle: lead?.id ?? '', ...(item.mode === 'evidence_choice' ? { evidence: item.metric } : {}) };
}
export const rowById = (item: VehicleItem, id: string | null | undefined) => item.rows.find(r => r.id === id);
export const keyName = (item: VehicleItem) => rowById(item, keyOf(item).vehicle)?.name ?? '';

// ── The learner's work, the check and its misses ─────────────────────────────────────────

export interface VehicleWork { vehicle: string | null; evidence: MetricKey | null }
export const emptyWork = (): VehicleWork => ({ vehicle: null, evidence: null });
export const workComplete = (item: VehicleItem, w: VehicleWork) => !!w.vehicle && (item.mode !== 'evidence_choice' || !!w.evidence);

export function vehicleCorrect(item: VehicleItem | undefined, w: VehicleWork): boolean {
  if (!item || !workComplete(item, w)) return false;
  const key = keyOf(item);
  return w.vehicle === key.vehicle && (item.mode !== 'evidence_choice' || w.evidence === key.evidence);
}

export type LeaderMiss = 'leading_digit' | 'other_column_leader' | 'reversed' | 'runner_up' | 'not_leader';
export type EvidenceMiss = 'wrong_evidence' | 'other_column_leader' | 'misread_column' | 'not_leader';
export type TradeoffMiss = 'ignored_minimum' | 'reversed' | 'not_priority_leader';
export type VehicleMiss = LeaderMiss | EvidenceMiss | TradeoffMiss;
/** Each mode's misses, most specific first: an answer that fits two is named by the first. */
export const VEHICLE_MISSES: Record<VehicleMode, readonly VehicleMiss[]> = {
  metric_leader: ['leading_digit', 'other_column_leader', 'reversed', 'runner_up', 'not_leader'],
  evidence_choice: ['wrong_evidence', 'other_column_leader', 'misread_column', 'not_leader'],
  constraint_tradeoff: ['ignored_minimum', 'reversed', 'not_priority_leader'],
};

const firstDigit = (n: number) => Number(String(Math.floor(Math.abs(n))).replace(/^0+/, '')[0] ?? 0);
/** The chosen value would lead if only the first digits were compared, but loses on the whole number. */
const leadingDigitTrap = (m: MetricKey, chosen: number, lead: number) =>
  better(m, firstDigit(chosen), firstDigit(lead)) && better(m, lead, chosen);
const leadsOtherColumn = (item: VehicleItem, rowId: string, except: MetricKey) =>
  item.columns.some(c => c !== except && leaderOf(item.rows, c)?.id === rowId);

/** What one wrong vehicle shows, before the column is considered. */
function rowMiss(item: VehicleItem, chosen: string): VehicleMiss {
  if (item.mode === 'constraint_tradeoff') {
    const row = rowById(item, chosen);
    if (!row || !meets(row, item.minimums)) return 'ignored_minimum';
    const feasible = feasibleRows(item);
    if (feasible.length >= 3 && ranked(feasible, item.metric).at(-1)!.id === chosen) return 'reversed';
    return 'not_priority_leader';
  }
  const order = ranked(item.rows, item.metric);
  const lead = order[0], row = rowById(item, chosen);
  if (item.mode === 'evidence_choice') return leadsOtherColumn(item, chosen, item.metric) ? 'other_column_leader' : 'not_leader';
  if (row && leadingDigitTrap(item.metric, row.values[item.metric]!, lead.values[item.metric]!)) return 'leading_digit';
  if (leadsOtherColumn(item, chosen, item.metric)) return 'other_column_leader';
  if (order.length >= 3 && order.at(-1)!.id === chosen) return 'reversed';
  if (order[1]?.id === chosen) return 'runner_up';
  return 'not_leader';
}

export function comparisonMiss(item: VehicleItem, w: VehicleWork): VehicleMiss | undefined {
  if (!workComplete(item, w) || vehicleCorrect(item, w)) return undefined;
  const key = keyOf(item);
  if (item.mode === 'evidence_choice') {
    if (w.vehicle === key.vehicle) return 'wrong_evidence';
    const m = rowMiss(item, w.vehicle!);
    return m === 'other_column_leader' ? m : w.evidence === key.evidence ? 'misread_column' : 'not_leader';
  }
  return rowMiss(item, w.vehicle!);
}

// ── The ask ──────────────────────────────────────────────────────────────────────────────

/**
 * A job that needs one column, worded without naming any column and without the words of the column's meaning
 * (`METRIC_MEANING`), so the column_meanings card defines every column and matches none (replay r1, 10-16).
 */
export const NEED_JOB: Partial<Record<MetricKey, string>> = {
  topSpeed: 'A doctor has to reach a sick patient as soon as possible.',
  passengerCapacity: 'A whole school choir wants to ride together on one vehicle.',
  cargoCapacity: 'A farm has a mountain of potatoes to send to the city, in as few trips as possible.',
  range: 'The trip crosses a huge empty desert, with no towns or stations on the way.',
  co2PerPassengerKm: 'The town wants the trip that is kindest to the air we breathe.',
};
export const NEED_METRICS = Object.keys(NEED_JOB) as MetricKey[];
const PRIORITY: Partial<Record<MetricKey, string>> = {
  topSpeed: 'is the fastest',
  co2PerPassengerKm: 'puts the least CO₂ in the air for each rider',
  cargoCapacity: 'carries the most cargo',
  passengerCapacity: 'carries the most people',
  range: 'can go the farthest without refueling',
};
export const PRIORITY_METRICS = Object.keys(PRIORITY) as MetricKey[];
export const MINIMUM_METRICS: MetricKey[] = ['passengerCapacity', 'cargoCapacity', 'range', 'topSpeed'];
/**
 * The minimums a job with this priority would set: a people job does not ask for tons of cargo, nor a cargo job for
 * seats ("carry at least 5 people ... which carries the most cargo", 10-16). Searched first; any minimum after.
 */
const SUITED_MINIMUMS: Partial<Record<MetricKey, MetricKey[]>> = {
  topSpeed: ['passengerCapacity', 'cargoCapacity', 'range'],
  range: ['passengerCapacity', 'cargoCapacity', 'topSpeed'],
  passengerCapacity: ['range', 'topSpeed'],
  cargoCapacity: ['range', 'topSpeed'],
  co2PerPassengerKm: ['passengerCapacity', 'range', 'topSpeed'],
};
export function minimumText(item: Pick<ItemBase, 'units'>, n: Minimum): string {
  const v = formatNumber(n.atLeast);
  switch (n.metric) {
    case 'passengerCapacity': return `carry at least ${v} people`;
    case 'cargoCapacity': return `carry at least ${v} tons of cargo`;
    case 'range': return `go at least ${v} ${unitOf(item, 'range')} without refueling`;
    case 'topSpeed': return `reach at least ${v} ${unitOf(item, 'topSpeed')}`;
    default: return `have at least ${v} ${unitOf(item, n.metric)} of ${METRIC_NAME[n.metric]}`;
  }
}

const LEADER_ASK: Record<MetricKey, string> = {
  topSpeed: 'Which vehicle has the greatest top speed?',
  weight: 'Which vehicle is the heaviest?',
  passengerCapacity: 'Which vehicle carries the most passengers?',
  cargoCapacity: 'Which vehicle carries the most cargo?',
  range: 'Which vehicle has the longest range?',
  yearIntroduced: 'Which vehicle was introduced most recently?',
  co2PerPassengerKm: 'Which vehicle has the lowest CO₂ per rider?',
};

export function askOf(item: VehicleItem): string {
  if (item.mode === 'metric_leader') return `${LEADER_ASK[item.metric]} Read the ${METRIC_LABEL[item.metric]} column and choose.`;
  if (item.mode === 'evidence_choice') return `${NEED_JOB[item.metric]} Which vehicle should do the job, and which column's numbers prove it? Choose both.`;
  return `The job: the vehicle must ${item.minimums.map(n => minimumText(item, n)).join(' and ')}. Of the vehicles that can do that, which one ${PRIORITY[item.metric]}?`;
}

// ── Item space ───────────────────────────────────────────────────────────────────────────

export type Rng = () => number;
/** A seeded generator, so a lesson without stored items still builds the same items everywhere. */
export function seededRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = <T,>(xs: readonly T[], rng: Rng): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const pick = <T,>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)];

/** A number the model wrote as "unlimited" (99999) is not a statistic. */
const sentinel = (n: number) => n >= 999 && /^9+$/.test(String(Math.round(n)));
const rawValue = (v: ComparisonVehicle, m: MetricKey): { value: number; unit: string } | null => {
  let value: unknown, unit = '';
  if (m === 'yearIntroduced') value = v.metrics?.yearIntroduced;
  else if (m === 'co2PerPassengerKm') value = v.metrics?.co2PerPassengerKm;
  else { const metric = v.metrics?.[m]; value = metric?.value; unit = String(metric?.unit ?? '').trim(); }
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && !sentinel(value)
    && plausible(m, value, unit, v.visualKind) ? { value, unit } : null;
};

/** The roster as rows: one unit per measure (a value in another unit is left out), no sentinels. */
export function rosterRows(vehicles: ComparisonVehicle[]): { rows: VehicleRow[]; units: Partial<Record<MetricKey, string>> } {
  const units: Partial<Record<MetricKey, string>> = {};
  const rows: VehicleRow[] = vehicles.filter(v => v && v.id && v.name).map(v => ({
    id: v.id, name: v.name, category: v.category, ...(v.visualKind ? { visualKind: v.visualKind } : {}), values: {},
  }));
  for (const m of METRIC_KEYS) {
    const raws = vehicles.map(v => rawValue(v, m));
    let unit = '';
    if (!(m in FIXED_UNIT)) {
      const counts = new Map<string, number>();
      raws.forEach(r => { if (r) counts.set(r.unit.toLowerCase(), (counts.get(r.unit.toLowerCase()) ?? 0) + 1); });
      unit = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      units[m] = raws.find(r => r && r.unit.toLowerCase() === unit)?.unit ?? unit;
    }
    raws.forEach((r, i) => { if (r && rows[i] && (m in FIXED_UNIT || r.unit.toLowerCase() === unit)) rows[i].values[m] = r.value; });
  }
  return { rows, units };
}

export interface Roster {
  rows: VehicleRow[];
  units: Partial<Record<MetricKey, string>>;
  /** The measures the lesson is about, first; any measure at least three vehicles have may still be a column. */
  focus: MetricKey[];
}
const withValues = (rows: VehicleRow[], ms: MetricKey[]) => rows.filter(r => ms.every(m => r.values[m] != null));
const usable = (r: Roster) => METRIC_KEYS.filter(m => withValues(r.rows, [m]).length >= 3);
const preferFocus = (r: Roster, ms: MetricKey[]) => {
  const inFocus = ms.filter(m => r.focus.includes(m));
  return inFocus.length ? inFocus : ms;
};

const ROWS: Record<VehicleTier, number> = { easy: 3, medium: 4, hard: 5 };
const LEADER_EXTRA: Record<VehicleTier, number> = { easy: 0, medium: 1, hard: 2 };
const EVIDENCE_COLUMNS: Record<VehicleTier, number> = { easy: 2, medium: 3, hard: 4 };
const TRIES = 400;

/** Other columns that every row has, those whose leader differs from `lead` first. */
function extraColumns(r: Roster, rows: VehicleRow[], except: MetricKey[], lead: string, rng: Rng): MetricKey[] {
  const cands = shuffle(usable(r).filter(m => !except.includes(m) && rows.every(x => x.values[m] != null)), rng);
  const differs = (m: MetricKey) => { const l = leaderOf(rows, m); return !!l && l.id !== lead; };
  return [...cands.filter(m => differs(m) && r.focus.includes(m)), ...cands.filter(m => differs(m) && !r.focus.includes(m)),
    ...cands.filter(m => !differs(m))];
}

function leaderItem(r: Roster, tier: VehicleTier, rng: Rng, avoid: Set<MetricKey>): LeaderItem | null {
  const metrics = preferFocus(r, usable(r));
  for (let t = 0; t < TRIES; t++) {
    const strict = t < TRIES * 0.6;
    const fresh = metrics.filter(m => !avoid.has(m));
    const metric = pick(strict && fresh.length ? fresh : metrics, rng);
    if (tier === 'easy' && strict && lowerWins(metric)) continue;
    const pool = withValues(r.rows, [metric]);
    const rows = shuffle(pool, rng).slice(0, Math.min(ROWS[tier], pool.length));
    const lead = leaderOf(rows, metric);
    if (!lead) continue;
    const [first, second] = ranked(rows, metric).map(x => x.values[metric]!);
    const ratio = lowerWins(metric) ? (second === 0 ? Infinity : second / Math.max(first, 1e-9)) : first / Math.max(second, 1e-9);
    if (strict && tier === 'easy' && ratio < 1.5) continue;
    if (strict && tier === 'hard' && !(lowerWins(metric) || ratio <= 1.25
      || rows.some(x => x.id !== lead.id && leadingDigitTrap(metric, x.values[metric]!, lead.values[metric]!)))) continue;
    const extras = extraColumns(r, rows, [metric], lead.id, rng);
    const wanted = LEADER_EXTRA[tier];
    if (strict && wanted && (extras.length < wanted || leaderOf(rows, extras[0])?.id === lead.id)) continue;
    const columns = shuffle([metric, ...extras.slice(0, wanted)], rng);
    return { id: '', mode: 'metric_leader', rows, columns, units: r.units, metric };
  }
  return null;
}

function evidenceItem(r: Roster, tier: VehicleTier, rng: Rng, avoid: Set<MetricKey>): EvidenceItem | null {
  const metrics = preferFocus(r, usable(r).filter(m => NEED_METRICS.includes(m)));
  if (!metrics.length) return null;
  for (let t = 0; t < TRIES; t++) {
    const strict = t < TRIES * 0.6;
    const fresh = metrics.filter(m => !avoid.has(m));
    const metric = pick(strict && fresh.length ? fresh : metrics, rng);
    const pool = withValues(r.rows, [metric]);
    const rows = shuffle(pool, rng).slice(0, Math.min(ROWS[tier], pool.length));
    const lead = leaderOf(rows, metric);
    if (!lead) continue;
    const extras = extraColumns(r, rows, [metric], lead.id, rng).slice(0, EVIDENCE_COLUMNS[tier] - 1);
    const distractors = extras.filter(m => leaderOf(rows, m) && leaderOf(rows, m)!.id !== lead.id);
    // The column must matter: another column has another leader (hard: every other column does).
    if (!distractors.length) continue;
    if (strict && (extras.length < EVIDENCE_COLUMNS[tier] - 1 || (tier === 'hard' && distractors.length < extras.length))) continue;
    return { id: '', mode: 'evidence_choice', rows, columns: shuffle([metric, ...extras], rng), units: r.units, metric };
  }
  return null;
}

/** Thresholds are values a vehicle on the table has, so "at least" is met exactly by one. */
function tradeoffMinimums(rows: VehicleRow[], metric: MetricKey, mins: MetricKey[], tier: VehicleTier, strict: boolean, rng: Rng): Minimum[] | null {
  const overall = leaderOf(rows, metric);
  if (!overall) return null;
  const options = (m: MetricKey) => shuffle(Array.from(new Set(rows.map(x => x.values[m]!))), rng);
  const combos: Minimum[][] = mins.length === 1
    ? options(mins[0]).map(a => [{ metric: mins[0], atLeast: a }])
    : options(mins[0]).flatMap(a => options(mins[1]).map(b => [{ metric: mins[0], atLeast: a }, { metric: mins[1], atLeast: b }]));
  for (const c of combos) {
    if (meets(overall, c)) continue;
    // Each minimum rules out a vehicle.
    if (c.some(n => rows.every(x => meets(x, [n])))) continue;
    const feasible = rows.filter(x => meets(x, c));
    if (feasible.length < 2 || !leaderOf(feasible, metric)) continue;
    if (c.length === 2) {
      const missesOne = rows.filter(x => c.filter(n => !meets(x, [n])).length === 1);
      if (!missesOne.some(x => x.id === overall.id)) continue;
      if (strict && tier === 'hard' && missesOne.length < 2) continue;
    }
    return c;
  }
  return null;
}

function tradeoffItem(r: Roster, tier: VehicleTier, rng: Rng, avoid: Set<MetricKey>): TradeoffItem | null {
  const all = usable(r);
  const priorities = preferFocus(r, all.filter(m => PRIORITY_METRICS.includes(m)));
  for (let t = 0; t < TRIES; t++) {
    const strict = t < TRIES * 0.6;
    const fresh = priorities.filter(m => !avoid.has(m));
    if (!priorities.length) return null;
    const metric = pick(strict && fresh.length ? fresh : priorities, rng);
    const minPool = all.filter(m => (strict ? SUITED_MINIMUMS[metric] ?? MINIMUM_METRICS : MINIMUM_METRICS).includes(m) && m !== metric);
    const nMins = tier === 'easy' || (!strict && minPool.length < 2) ? 1 : 2;
    if (minPool.length < nMins) continue;
    const mins = shuffle(preferFocus(r, minPool), rng).slice(0, nMins);
    if (mins.length < nMins) continue;
    const pool = withValues(r.rows, [metric, ...mins]);
    const n = Math.min(tier === 'hard' ? 5 : 4, pool.length);
    if (n < 3) continue;
    const rows = shuffle(pool, rng).slice(0, n);
    const minimums = tradeoffMinimums(rows, metric, mins, tier, strict, rng);
    if (!minimums) continue;
    const extras = tier === 'hard' ? extraColumns(r, rows, [metric, ...mins], '', rng).slice(0, 1) : [];
    if (strict && tier === 'hard' && !extras.length) continue;
    return { id: '', mode: 'constraint_tradeoff', rows, columns: shuffle([...mins, metric, ...extras], rng), units: r.units, metric, minimums };
  }
  return null;
}

export const ITEM_COUNT: Record<VehicleMode, [number, number]> = { metric_leader: [3, 1], evidence_choice: [3, 1], constraint_tradeoff: [3, 1] };
const LOOSER: Record<VehicleTier, VehicleTier[]> = { easy: ['easy', 'medium'], medium: ['medium', 'easy', 'hard'], hard: ['hard', 'medium', 'easy'] };

/** The items of one mode: different measures first; a looser tier only when the roster cannot fill the asked one. */
export function buildModeItems(mode: VehicleMode, tier: VehicleTier, r: Roster, count: number, rng: Rng): VehicleItem[] {
  const out: VehicleItem[] = [];
  const used = new Set<MetricKey>();
  const seen = new Set<string>();
  const build = mode === 'metric_leader' ? leaderItem : mode === 'evidence_choice' ? evidenceItem : tradeoffItem;
  for (const t of LOOSER[tier]) {
    for (let k = 0; k < count * 4 && out.length < count; k++) {
      const item = build(r, t, rng, used);
      if (!item) break;
      const shape = `${item.metric}:${item.rows.map(x => x.id).sort().join(',')}`;
      if (seen.has(shape)) continue;
      seen.add(shape); used.add(item.metric); out.push(item);
    }
    if (out.length >= count) break;
  }
  return out;
}

export function buildVehicleItems(opts: { modes: VehicleMode[]; tier: VehicleTier; roster: Roster; rng: Rng }): VehicleItem[] {
  const out: VehicleItem[] = [];
  for (const mode of opts.modes) out.push(...buildModeItems(mode, opts.tier, opts.roster, ITEM_COUNT[mode][opts.modes.length === 1 ? 0 : 1], opts.rng));
  return out.map((item, i) => ({ ...item, id: `${item.mode}-${i + 1}` }));
}

// ── Lesson data → items ──────────────────────────────────────────────────────────────────

export interface VehicleItemsSource {
  title?: string;
  gradeBand?: string;
  vehicles?: ComparisonVehicle[];
  comparisonMetrics?: string[];
  challengeTypes?: string[];
  difficulty?: string;
  items?: VehicleItem[];
  /** Legacy generations (model-keyed missions, before 2026-10-16): read only for their modes. */
  challenges?: Array<{ type?: string }>;
}

export function rosterOf(d: VehicleItemsSource): Roster {
  const { rows, units } = rosterRows(Array.isArray(d.vehicles) ? d.vehicles : []);
  const focus = (d.comparisonMetrics ?? []).filter((m): m is MetricKey => (METRIC_KEYS as string[]).includes(m));
  return { rows, units, focus };
}
export const resolveTier = (d: VehicleItemsSource): VehicleTier => {
  const t = (d.difficulty ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};
/** The modes a lesson asks: its pin, else the legacy challenges' types, else by grade band. */
export function resolveVehicleModes(d: VehicleItemsSource): VehicleMode[] {
  const asked = (d.challengeTypes ?? []).filter((m): m is VehicleMode => (VEHICLE_MODES as string[]).includes(m));
  if (asked.length) return VEHICLE_MODES.filter(m => asked.includes(m));
  const legacy = (d.challenges ?? []).map(c => c?.type).filter((m): m is VehicleMode => (VEHICLE_MODES as string[]).includes(m ?? ''));
  if (legacy.length) return VEHICLE_MODES.filter(m => legacy.includes(m));
  return d.gradeBand === 'K-2' ? ['metric_leader'] : [...VEHICLE_MODES];
}

const validRow = (x: VehicleRow | undefined): x is VehicleRow => !!x && typeof x.id === 'string' && !!x.id
  && typeof x.name === 'string' && !!x.name.trim() && !!x.values && typeof x.values === 'object';

/** False when a stored item is not one code could have built (its key would not be computable). */
export function validVehicleItem(i: VehicleItem | undefined): i is VehicleItem {
  if (!i || typeof i.id !== 'string' || !(VEHICLE_MODES as string[]).includes(i.mode)) return false;
  if (!Array.isArray(i.rows) || i.rows.length < 2 || !i.rows.every(validRow)) return false;
  if (new Set(i.rows.map(x => x.id)).size !== i.rows.length) return false;
  if (!Array.isArray(i.columns) || !i.columns.length || !i.columns.every(c => (METRIC_KEYS as string[]).includes(c))) return false;
  if (!i.columns.includes(i.metric) || !i.units || typeof i.units !== 'object') return false;
  if (!i.rows.every(x => i.columns.every(c => typeof x.values[c] === 'number' && Number.isFinite(x.values[c]!)))) return false;
  if (i.mode === 'evidence_choice' && !NEED_JOB[i.metric]) return false;
  if (i.mode === 'constraint_tradeoff') {
    if (!Array.isArray(i.minimums) || !i.minimums.length || !i.minimums.every(n => i.columns.includes(n.metric) && typeof n.atLeast === 'number')) return false;
    const feasible = feasibleRows(i);
    if (!feasible.length || (feasible.length > 1 && !leaderOf(feasible, i.metric))) return false;
    return true;
  }
  return !!leaderOf(i.rows, i.metric);
}

/** Every item of the session: the stored, code-built items when valid, else built from the lesson's own roster. */
export function vehicleItems(d: VehicleItemsSource): VehicleItem[] {
  const stored = Array.isArray(d.items) ? d.items.filter(validVehicleItem) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  const roster = rosterOf(d);
  return buildVehicleItems({ modes: resolveVehicleModes(d), tier: resolveTier(d), roster,
    rng: seededRng(`${d.title ?? 'vehicles'}:${roster.rows.map(x => x.id).join(',')}`) });
}

// ── Assignment, spoken answers ───────────────────────────────────────────────────────────

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const rowPlace = (item: VehicleItem, id: string) => ORDINAL[item.rows.findIndex(x => x.id === id)] ?? '';
/** How a learner might name a column. */
const SAY_COLUMN: Record<MetricKey, string> = {
  topSpeed: '"top speed", "speed" or "how fast it goes"',
  weight: '"weight" or "how heavy it is"',
  passengerCapacity: '"passengers", "people" or "how many people it carries"',
  cargoCapacity: '"cargo", "goods" or "how much cargo it carries"',
  range: '"range" or "how far it can go"',
  yearIntroduced: '"year introduced" or "the year"',
  co2PerPassengerKm: '"CO2", "CO2 per rider" or "pollution"',
};

/** The answer a spoken reply is judged against, with the ways a learner says it. */
export function vehicleExpectedAnswer(item: VehicleItem): string {
  const key = keyOf(item), name = keyName(item);
  const vehicle = `"${name}" (any clear way of naming that vehicle, or its row, "the ${rowPlace(item, key.vehicle)} one")`;
  if (item.mode === 'evidence_choice') {
    return `Two parts, both needed: the vehicle ${vehicle}; and the evidence, the ${METRIC_LABEL[item.metric]} column (${SAY_COLUMN[item.metric]}). `
      + 'The right vehicle with another column, or only one part said, is not credited.';
  }
  const others = item.rows.filter(x => x.id !== key.vehicle).map(x => `"${x.name}"`).join(', ');
  return `${vehicle} counts. ${others} are wrong, and so is naming two or hedging between them.`;
}

const WHAT: Record<VehicleMiss, string> = {
  leading_digit: 'names a vehicle whose number starts with a bigger first digit but is the smaller number',
  other_column_leader: 'names the vehicle that leads a different column',
  reversed: 'names the vehicle at the other end of the column',
  runner_up: 'names the vehicle in second place',
  not_leader: 'names a vehicle that does not lead the column',
  wrong_evidence: 'names the right vehicle but a column that does not prove the job',
  misread_column: 'names the right column but a vehicle that does not lead it',
  ignored_minimum: 'names a vehicle that misses one of the minimums',
  not_priority_leader: 'names a vehicle that meets the minimums but does not lead the priority among them',
};

/** A spoken item's known wrong answers, most specific first, with the tap's miss ids. */
export function vehicleSpokenMisses(item: VehicleItem): KnownMiss[] {
  const key = keyOf(item);
  const groups = new Map<VehicleMiss, string[]>();
  for (const x of item.rows) {
    if (x.id === key.vehicle) continue;
    const m = item.mode === 'evidence_choice' ? (rowMiss(item, x.id) === 'other_column_leader' ? 'other_column_leader' : 'not_leader') : rowMiss(item, x.id);
    groups.set(m, [...(groups.get(m) ?? []), x.name]);
  }
  if (item.mode === 'evidence_choice') {
    const others = item.columns.filter(c => c !== item.metric).map(c => METRIC_LABEL[c]);
    if (others.length) groups.set('wrong_evidence', others.map(c => `${keyName(item)}, because of ${c.toLowerCase()}`));
  }
  const right = item.mode === 'evidence_choice' ? `"${keyName(item)}" with the ${METRIC_LABEL[item.metric]} column` : `"${keyName(item)}"`;
  return VEHICLE_MISSES[item.mode].filter(m => groups.has(m)).map(m => ({
    id: m, pattern: `The right answer is ${right}. The learner's answer ${WHAT[m]}: ${groups.get(m)!.map(x => `"${x}"`).join(', ')}.`,
    examples: groups.get(m)!.slice(0, 6),
  }));
}

const HOW = 'The learner answers by saying it, or by tapping a vehicle and pressing Check.';
const HOW_EVIDENCE = 'The learner answers by saying both, or by tapping a vehicle and a column button and pressing Check.';

export function workspaceAssignment(item: VehicleItem): TeachingAssignment {
  const misses = vehicleSpokenMisses(item);
  return { id: item.id, task: `${askOf(item)} ${item.mode === 'evidence_choice' ? HOW_EVIDENCE : HOW}`, response: 'speech',
    acceptsGesture: true, expectedAnswer: vehicleExpectedAnswer(item), ...(misses.length ? { misses } : {}) };
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface VehicleView {
  work: VehicleWork;
  /** Credited (or revealed on the scripted path): the answer and its reason are on screen. */
  solved: boolean;
}

export function describeVehicleWork(item: VehicleItem | undefined, w: VehicleWork): string {
  if (!item) return 'Nothing chosen yet';
  const name = rowById(item, w.vehicle)?.name;
  const parts = [name ? `Chose "${name}"` : '', item.mode === 'evidence_choice' && w.evidence ? `the ${METRIC_LABEL[w.evidence]} column as evidence` : ''].filter(Boolean);
  return parts.length ? parts.join(', with ') : 'Nothing chosen yet';
}

/** The reason shown once credited: the leader and its number. */
export function explanation(item: VehicleItem): string {
  const key = keyOf(item), row = rowById(item, key.vehicle);
  if (!row) return '';
  const cell = cellText(item, row, item.metric);
  if (item.mode === 'metric_leader') return `${row.name} leads the ${METRIC_LABEL[item.metric]} column with ${cell}.`;
  if (item.mode === 'evidence_choice') return `The job needs ${METRIC_MEANING[item.metric]}: the ${METRIC_LABEL[item.metric]} column. ${row.name} leads it with ${cell}.`;
  const ok = feasibleRows(item).map(x => x.name);
  return `${ok.join(', ')} ${ok.length === 1 ? 'meets' : 'meet'} every minimum. Of ${ok.length === 1 ? 'it' : 'those'}, ${row.name} ${PRIORITY[item.metric]} (${cell}).`;
}

const tableText = (item: VehicleItem) => item.rows
  .map((x, i) => `Row ${i + 1} ${x.name}: ${item.columns.map(c => `${METRIC_NAME[c]} ${cellText(item, x, c)}`).join(', ')}`).join('; ');

const CONSTRAINTS = 'The learner answers by saying it, or by tapping and pressing Check; the activity judges the tap. '
  + 'The rows are not sorted, and nothing on screen marks a leader, a winner or which vehicles meet a minimum. '
  + 'You cannot tap, choose or check for the learner.';

/** What is drawn and asked: the table as printed, never which row leads or which column fits. */
export function workspaceScene(item: VehicleItem, view: VehicleView): WorkspaceScene {
  const facts: Record<string, string> = {
    kind: item.mode,
    question: askOf(item),
    columns: item.columns.map(c => METRIC_LABEL[c]).join(', '),
    table: tableText(item),
    choices: item.rows.map((x, i) => `${i + 1}) ${x.name}`).join('  '),
  };
  if (item.mode === 'evidence_choice') facts.evidenceChoices = item.columns.map(c => METRIC_LABEL[c]).join(', ');
  facts.learnerWork = describeVehicleWork(item, view.work);
  if (view.solved) facts.shown = `The answer and its reason are now on screen: ${explanation(item)}`;
  facts.constraints = CONSTRAINTS;
  return { objects: [], facts };
}

// ── The journey's learner (liveJourneySpec row, the dry sweep) ───────────────────────────

/** The journey's answers: the key, and a wrong answer showing the mode's first-listed miss it can. */
export function vehicleHarnessAnswers(item: VehicleItem): { correct: VehicleWork; plainWrong: VehicleWork } {
  const key = keyOf(item);
  const correct: VehicleWork = { vehicle: key.vehicle, evidence: key.evidence ?? null };
  const rank = VEHICLE_MISSES[item.mode];
  const wrongs: VehicleWork[] = [
    ...item.rows.filter(x => x.id !== key.vehicle).map(x => ({ ...correct, vehicle: x.id })),
    ...(item.mode === 'evidence_choice' ? item.columns.filter(c => c !== item.metric).map(c => ({ ...correct, evidence: c })) : []),
  ];
  wrongs.sort((a, b) => rank.indexOf(comparisonMiss(item, a)!) - rank.indexOf(comparisonMiss(item, b)!));
  return { correct, plainWrong: wrongs[0] ?? correct };
}
