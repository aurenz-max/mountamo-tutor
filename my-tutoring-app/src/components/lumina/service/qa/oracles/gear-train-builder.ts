import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray } from './helpers';

/**
 * Gear-train-builder oracle. The component judges the last gear with code (`gearMiss`), so the targets ARE the key:
 * each must be makeable from the tray (8, 12, 16, 24, 32 teeth) on a 6-gear track, and the ask must state what is
 * judged. This oracle counts every passing train itself (first and last teeth, length; middle gears never change the
 * speed), never the primitive's `referenceTrain`, so a shared wrong assumption cannot certify itself.
 *
 * Checks:
 * - answer-key-desync: no train of at most 6 gears meets the target, or only one does (not an open build).
 * - schema: an ask that does not state its way, speed, ratio or number of gears.
 * - answer-leak: an ask that names a tooth count (it would hand over a gear to use).
 * - clustering: fewer than 3 trains; a target repeated.
 */
const KNOWN = new Set(['build_direction', 'build_speed', 'build_ratio']);
const TRAY = [8, 12, 16, 24, 32];

function passingTrains(c: Record<string, unknown>): number {
  let n = 0;
  for (let len = 2; len <= 6; len++) {
    const way = len % 2 === 1 ? 'same' : 'opposite';
    if (len < Number(c.minGears ?? 2) || (c.way && c.way !== way)) continue;
    for (const a of TRAY) for (const b of TRAY) {
      const turns = a / b;
      if (c.type === 'build_speed' && (c.speed === 'faster' ? !(turns > 1) : !(turns < 1))) continue;
      if (c.type === 'build_ratio' && Math.abs(turns - Number(c.ratio)) > 1e-9) continue;
      n += TRAY.length ** (len - 2);
    }
  }
  return n;
}

export const gearTrainBuilderOracle: ContentOracle = {
  componentId: 'gear-train-builder',
  verify(data): OracleResult {
    const violations: OracleViolation[] = [];
    const items = asRecordArray(data.challenges);
    if (items.length < 3) violations.push({ check: 'clustering', where: 'challenges', detail: `only ${items.length} train(s) — mastery-over-demo requires 3+` });
    const unknown = Array.from(new Set(items.map(c => String(c.type)).filter(t => !KNOWN.has(t))));
    const seen = new Set<string>();
    let checked = 0;
    items.forEach((c, i) => {
      const where = String(c.id ?? `#${i + 1}`), ask = String(c.instruction ?? '');
      if (!KNOWN.has(String(c.type))) return;
      checked++;
      const ways = passingTrains(c);
      if (ways === 0) violations.push({ check: 'answer-key-desync', where, detail: 'no train of at most 6 gears from the tray meets this target' });
      else if (ways < 2) violations.push({ check: 'answer-key-desync', where, detail: 'only one train meets this target: not an open build' });
      if (c.way && !(c.way === 'same' ? /same way/ : /opposite way/).test(ask)) violations.push({ check: 'schema', where, detail: `the ask "${ask}" does not state the way` });
      if (c.type === 'build_speed' && !ask.includes(String(c.speed))) violations.push({ check: 'schema', where, detail: `the ask "${ask}" does not say ${c.speed}` });
      if (c.type === 'build_ratio') {
        const r = Number(c.ratio), n = r >= 1 ? r : Math.round(1 / r);
        if (!ask.includes(String(n))) violations.push({ check: 'schema', where, detail: `the ask "${ask}" does not state ${n}` });
      }
      if (c.type === 'build_direction' && !ask.includes(String(c.minGears))) violations.push({ check: 'schema', where, detail: `the ask "${ask}" does not state ${c.minGears} gears` });
      if (/\b(8|12|16|24|32)[- ]?(tooth|teeth)\b/i.test(ask)) violations.push({ check: 'answer-leak', where, detail: `the ask "${ask}" names a gear size` });
      const k = JSON.stringify([c.type, c.way, c.speed, c.ratio, c.minGears]);
      if (seen.has(k)) violations.push({ check: 'clustering', where, detail: 'target repeats' });
      seen.add(k);
    });
    return { violations, uncheckedTypes: unknown, checkedChallenges: checked };
  },
};
