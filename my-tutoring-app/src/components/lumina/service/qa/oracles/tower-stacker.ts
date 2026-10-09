import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray } from './helpers';

/**
 * Tower-stacker oracle. The component judges a tower with code statics (`towerMiss`), so the targets ARE the key:
 * each must be buildable from the tray and, on windproof, must separate a plain tower from a wide one. This oracle
 * re-derives both with its own closed-form moments, never the primitive's `towerCuts`/`windLimit`, so a shared
 * wrong assumption cannot certify itself.
 *
 * Checks:
 * - answer-key-desync: a line at or above the top of the area (14) or below 2; a build_few cap below ceil(H/4) (a
 *   beam on end is 4 tall, the tallest piece); a windproof wind that a two-wide column of blocks to the line survives
 *   (no design lesson), or that a stack of flat beams to the line cannot (no tower passes).
 * - answer-leak: an ask that says how to make it stand (wide, base, balance, heavy, centre).
 * - schema: an ask that does not state a build_few cap.
 * - clustering: fewer than 3 towers; a height repeated within one mode.
 */
const KNOWN_TYPES = new Set(['build_tall', 'build_few', 'build_windproof']);
const LEAK = /\b(wide|wider|base|balance|heav(y|ier)|cent(er|re)|bottom)\b/i;

/** Overturning limit at the ground of a straight column `width` wide of unit-density rows 1 tall, to height H. */
const columnLimit = (width: number, height: number) => (width * height * (width / 2)) / ((height * height) / 2);

export const towerStackerOracle: ContentOracle = {
  componentId: 'tower-stacker',
  verify(data): OracleResult {
    const violations: OracleViolation[] = [];
    const items = asRecordArray(data.challenges);
    if (items.length < 3) violations.push({ check: 'clustering', where: 'challenges', detail: `only ${items.length} tower(s) — mastery-over-demo requires 3+` });
    const unknown = Array.from(new Set(items.map(c => String(c.type)).filter(t => !KNOWN_TYPES.has(t))));
    const seen = new Set<string>();
    let checked = 0;
    items.forEach((c, i) => {
      const where = String(c.id ?? `#${i + 1}`), type = String(c.type), h = Number(c.targetHeight), ask = String(c.instruction ?? '');
      if (!KNOWN_TYPES.has(type)) return;
      checked++;
      if (!Number.isInteger(h) || h < 2 || h >= 14) violations.push({ check: 'answer-key-desync', where, detail: `line at ${h} is outside the building area` });
      if (LEAK.test(ask)) violations.push({ check: 'answer-leak', where, detail: `the ask "${ask}" says how to make the tower stand` });
      if (type === 'build_few') {
        const cap = Number(c.maxPieces);
        if (!(cap >= Math.ceil(h / 4))) violations.push({ check: 'answer-key-desync', where, detail: `cap ${cap} is below the fewest pieces (${Math.ceil(h / 4)}) that reach ${h}` });
        if (!ask.includes(String(cap))) violations.push({ check: 'schema', where, detail: `the ask "${ask}" does not state the cap ${cap}` });
      }
      if (type === 'build_windproof') {
        const wind = Number(c.wind);
        if (!(wind > columnLimit(2, h))) violations.push({ check: 'answer-key-desync', where, detail: `wind ${wind} does not blow over a two-wide column of ${h}: no design lesson` });
        if (!(wind <= columnLimit(4, h))) violations.push({ check: 'answer-key-desync', where, detail: `wind ${wind} blows over a four-wide stack of beams of ${h}: no tower passes` });
      }
      const k = `${type}|${h}`;
      if (seen.has(k)) violations.push({ check: 'clustering', where, detail: `${type} to ${h} repeats` });
      seen.add(k);
    });
    return { violations, uncheckedTypes: unknown, checkedChallenges: checked };
  },
};
