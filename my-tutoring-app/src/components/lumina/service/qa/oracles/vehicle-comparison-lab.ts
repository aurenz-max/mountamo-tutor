import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray } from './helpers';
import { plausible } from '../../../primitives/visual-primitives/engineering/vehiclePlausibility';
import type { MetricKey } from '../../../primitives/visual-primitives/engineering/vehicleComparisonWorkspace';
import type { VehicleVisualKind } from '../../../primitives/visual-primitives/engineering/vehicleVisualKind';

/**
 * vehicle-comparison-lab oracle. Since 2026-10-16 code builds every item from the model's roster and the component
 * computes the key from the numbers on screen, so a stored key cannot drift. What can still ship wrong:
 *
 * - a statistic no real vehicle of that kind has (a jet at 9 km/h): wrong on screen, keyed consistently (ruling R24,
 *   `implausible-value`)
 * - an item with no single answer: a tie at the top of the asked column, or (constraint_tradeoff) no vehicle or a tie
 *   among those that meet the minimums (`answer-key-desync`)
 * - a trade-off whose overall leader meets every minimum (the minimums decide nothing), or a minimum every vehicle
 *   meets (`schema`)
 * - an item of a mode the pin did not ask for (`schema`)
 *
 * The leader is derived here from the cells, the way the table reads, not by calling the workspace's keyOf.
 */
const LOWER_WINS = new Set(['co2PerPassengerKm']);

interface Row { id: string; name: string; values: Record<string, number> }

function leader(rows: Row[], m: string): Row | null {
  if (rows.length === 1) return rows[0];
  if (rows.length < 2 || rows.some(r => typeof r.values[m] !== 'number')) return null;
  const sorted = [...rows].sort((a, b) => (LOWER_WINS.has(m) ? a.values[m] - b.values[m] : b.values[m] - a.values[m]));
  return sorted[0].values[m] !== sorted[1].values[m] ? sorted[0] : null;
}

export const vehicleComparisonLabOracle: ContentOracle = {
  componentId: 'vehicle-comparison-lab',
  verify(data): OracleResult {
    const violations: OracleViolation[] = [];
    const vehicles = asRecordArray(data.vehicles);
    const kindOf = new Map(vehicles.map(v => [String(v.id), v.visualKind as VehicleVisualKind | undefined]));
    const units = (data.items && asRecordArray(data.items)[0]?.units) as Record<string, string> | undefined;
    const pinned = Array.isArray(data.challengeTypes) ? data.challengeTypes.map(String) : [];

    // Every statistic the model wrote, judged once per vehicle.
    for (const v of vehicles) {
      const metrics = (v.metrics ?? {}) as Record<string, unknown>;
      for (const [m, raw] of Object.entries(metrics)) {
        const value = typeof raw === 'number' ? raw : (raw as { value?: unknown })?.value;
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        const unit = typeof raw === 'number' ? '' : String((raw as { unit?: unknown }).unit ?? '');
        if (!plausible(m as MetricKey, value, unit, v.visualKind as VehicleVisualKind | undefined)) {
          violations.push({ check: 'implausible-value', where: `${String(v.name)}.${m}`,
            detail: `${value} ${unit} is outside the range for a ${String(v.visualKind ?? 'vehicle')}` });
        }
      }
    }

    const items = asRecordArray(data.items);
    if (!items.length) violations.push({ check: 'schema', where: 'items', detail: 'no code-built items' });
    let checked = 0;
    for (const item of items) {
      checked++;
      const mode = String(item.mode ?? '');
      const where = `${String(item.id)}(${mode})`;
      if (pinned.length && !pinned.includes(mode)) violations.push({ check: 'schema', where, detail: `mode ${mode} was not asked for` });
      const rows = asRecordArray(item.rows).map(r => ({ id: String(r.id), name: String(r.name), values: (r.values ?? {}) as Record<string, number> }));
      const metric = String(item.metric ?? '');
      const itemUnits = (item.units ?? units ?? {}) as Record<string, string>;
      // A cell left on the table is a cell the learner reads: it must be plausible too (the roster filter's contract).
      for (const r of rows) for (const c of Array.isArray(item.columns) ? item.columns.map(String) : []) {
        const val = r.values[c];
        if (typeof val === 'number' && !plausible(c as MetricKey, val, itemUnits[c] ?? '', kindOf.get(r.id))) {
          violations.push({ check: 'implausible-value', where, detail: `${r.name} ${c} ${val} is on the table` });
        }
      }
      if (mode === 'constraint_tradeoff') {
        const mins = asRecordArray(item.minimums).map(n => ({ metric: String(n.metric), atLeast: Number(n.atLeast) }));
        const meets = (r: Row) => mins.every(n => (r.values[n.metric] ?? -Infinity) >= n.atLeast);
        const feasible = rows.filter(meets);
        if (!feasible.length || !leader(feasible, metric)) {
          violations.push({ check: 'answer-key-desync', where, detail: `${feasible.length} vehicles meet the minimums and none leads ${metric}` });
          continue;
        }
        const overall = leader(rows, metric);
        if (overall && meets(overall)) violations.push({ check: 'schema', where, detail: `${overall.name} leads ${metric} and meets every minimum: the minimums decide nothing` });
        for (const n of mins) if (rows.every(r => (r.values[n.metric] ?? -Infinity) >= n.atLeast)) {
          violations.push({ check: 'schema', where, detail: `every vehicle meets the ${n.metric} minimum` });
        }
        continue;
      }
      if (!leader(rows, metric)) violations.push({ check: 'answer-key-desync', where, detail: `no single leader of ${metric}` });
    }
    return { violations, uncheckedTypes: [], checkedChallenges: checked };
  },
};
