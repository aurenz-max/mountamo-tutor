/**
 * The in-item levers on transport-challenge, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/transport-challenge-levers-2026-10-16.md). No real-learner evidence: the misses are what
 * `vehicleMiss` observes; the failures behind them are documented (the old catalog's commonStruggles: the fastest
 * vehicle picked without checking the budget, the cheapest per trip picked without counting trips, the CO2 limit
 * ignored) or inferred (the part-full trip not counted, one limit checked and the other not). Every lever starts
 * released; `config.difficulty` changes the items, not the levers.
 *
 * - `show_trips` (marks): each card draws the load split into that vehicle's trips, one block a trip, the last one
 *   part full when the load does not fill it, with the number of trips. No total, no limit.
 * - `times_setup` (marks): each card writes, for each limit, the multiplication that gives the total ("12 trips x $25
 *   a trip"), never its product.
 * - `smaller_job` (easier): a smaller job of the same kind with the first two cards, a load both fill evenly, and
 *   the same kinds of limits. Ungraded; this item comes back after it. Its answer is never this item's answer.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { TRANSPORT_MISSES } from './transportChallenge.card';
import {
  amountText, fillsEvenly, keyVehicle, perTripText, totalFor, tripsFor,
  type LimitType, type TransportItem, type TransportMiss, type TransportVehicle,
} from './transportWorkspace';

export const SHOW_TRIPS_LEVER = 'show_trips';
export const TIMES_SETUP_LEVER = 'times_setup';
export const SMALLER_JOB_LEVER = 'smaller_job';

/** show_trips: the vehicle's trips, and how full the last one is. */
export function tripLine(item: TransportItem, v: TransportVehicle): string {
  const trips = tripsFor(item, v), rest = item.load.amount - (trips - 1) * v.capacity;
  const unit = item.load.kind === 'people' ? 'people' : 'tons';
  if (trips === 1) return item.load.amount < v.capacity ? `1 trip, part full (${item.load.amount} of ${v.capacity} ${unit})` : '1 trip';
  return fillsEvenly(item, v) ? `${trips} full trips` : `${trips} trips: ${trips - 1} full, the last one carrying ${rest} ${unit}`;
}

/** times_setup: the multiplication for each limit, never its product. */
export const timesLines = (item: TransportItem, v: TransportVehicle): string[] =>
  item.limits.map(l => `${tripsFor(item, v)} trip${tripsFor(item, v) === 1 ? '' : 's'} × ${perTripText(v, l.type)}`);

/**
 * The leak rule for every lever line: no word that judges a vehicle against a limit, and, on a vehicle's own line, no
 * total of that vehicle that is not also its card figure (one trip's total is the card figure).
 */
export function leverLeak(item: TransportItem, line: string, v?: TransportVehicle): boolean {
  if (/\b(fits?|within|over|under|breaks?|keeps?|best|answer|cheapest|enough|too (much|many|slow))\b/i.test(line)) return true;
  return !!v && tripsFor(item, v) > 1 && item.limits.some(l => line.includes(amountText(l.type, totalFor(item, v, l.type))));
}

// ── Simplify: practice items ─────────────────────────────────────────────────────────────

const PRACTICE = '~simpler';
export const isPractice = (item: Pick<TransportItem, 'id'>) => item.id.endsWith(PRACTICE);
export const practiceParent = (id: string) => (id.endsWith(PRACTICE) ? id.slice(0, -PRACTICE.length) : null);
const SMALL_TRIPS = 12;

const roundUp = (n: number) => { for (const d of [100, 50, 10, 5, 1]) if (n >= d * 2) return Math.ceil(n / d) * d; return n; };

/**
 * The smaller job: the first two cards, a load both fill evenly in at most 12 trips, the same kinds of limits, set
 * so the mode's rule picks one vehicle; when one of the two answers this item, the other answers the smaller job.
 * Null when there is none.
 */
export function simplerItem(item: TransportItem): TransportItem | null {
  if (isPractice(item)) return null;
  const pair = item.vehicles.slice(0, 2), key = keyVehicle(item);
  if (pair.length < 2 || !key) return null;
  const banned = pair.some(v => v.id === key.id) ? key.id : null;
  const maxLoad = SMALL_TRIPS * Math.min(...pair.map(v => v.capacity));
  for (let amount = 1; amount <= maxLoad; amount++) {
    if (amount === item.load.amount) continue;
    const base = { ...item, id: `${item.id}${PRACTICE}`, title: 'A smaller job', load: { ...item.load, amount }, vehicles: pair };
    if (!pair.every(v => fillsEvenly(base, v) && tripsFor(base, v) <= SMALL_TRIPS) || pair.every(v => tripsFor(base, v) === 1)) continue;
    const totals = (t: LimitType) => pair.map(v => totalFor(base, v, t)).sort((a, b) => a - b);
    // Each limit at a round value between the two totals, below both, or above both.
    const options = (t: LimitType) => { const [lo, hi] = totals(t); return Array.from(new Set([lo === hi ? lo : roundBetween(lo, hi - 1), Math.max(1, lo - 1), roundUp(hi)])); };
    let combos: number[][] = [[]];
    for (const l of item.limits) combos = combos.flatMap(c => options(l.type).map(x => [...c, x]));
    for (const c of combos) {
      const s: TransportItem = { ...base, limits: item.limits.map((l, i) => ({ type: l.type, max: c[i] })) };
      const k = keyVehicle(s);
      if (k && k.id !== banned) return s;
    }
  }
  return null;
}
function roundBetween(lo: number, hi: number): number {
  for (const d of [100, 50, 10, 5, 1]) { const m = Math.ceil(lo / d) * d; if (m <= hi) return m; }
  return lo;
}

// ── The lever set ────────────────────────────────────────────────────────────────────────

/** The levers read nothing beside the item. */
export type TransportLeverContext = Record<string, never>;
export const NO_CONTEXT: TransportLeverContext = {};

/** The misses a lever answers on this item: the ones its mode names. */
const inMode = (item: TransportItem) => TRANSPORT_MISSES[item.mode];

/** In the order the observer offers them: on every miss a help lever comes before the smaller job. */
export const TRANSPORT_LEVERS = leverSet<TransportItem, TransportLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => TRANSPORT_MISSES[mode as TransportItem['mode']] ?? [],
  specs: [
    { id: SHOW_TRIPS_LEVER, type: 'marks', answers: ['forgot_round_up', 'cheapest_per_trip', 'over_limit'], answersOn: inMode,
      when: 'The learner does not know how many trips a vehicle needs, or does not count a part-full last trip.',
      does: 'Draws on each card the load split into that vehicle\'s trips, one block a trip, the last one part full when the load does not fill it, and writes the number of trips. It writes no total.',
      fact: (_on: unknown, item) => `Each card now draws its trips: ${item.vehicles.map(v => `${v.name}, ${tripLine(item, v)}`).join('; ')}.` },
    { id: TIMES_SETUP_LEVER, type: 'marks', answers: ['fewest_trips', 'cheapest_per_trip', 'one_limit_only', 'breaks_more', 'over_limit'],
      answersOn: inMode,
      when: 'The learner compares per-trip figures instead of totals, or checks only one limit.',
      does: 'Writes on each card, for each limit, the multiplication that gives the total (for example "12 trips × $25 a trip"). It writes no product.',
      fact: (_on: unknown, item) => `Each card now writes its multiplications, without the products: ${item.vehicles.map(v => `${v.name}, ${timesLines(item, v).join(' and ')}`).join('; ')}.` },
    { id: SMALLER_JOB_LEVER, type: 'easier', answers: 'all',
      when: 'The learner cannot hold the whole job at once.',
      does: 'Opens a smaller job with two of these vehicles and a load that fills every trip. It is not graded; this item comes back after it.',
      content: item => simplerItem(item) },
  ],
});

/** For tests: every miss this item's wrong picks show. */
export function possibleMisses(item: TransportItem, miss: (v: TransportVehicle) => TransportMiss): TransportMiss[] {
  const key = keyVehicle(item);
  return Array.from(new Set(item.vehicles.filter(v => v.id !== key?.id).map(miss)));
}
