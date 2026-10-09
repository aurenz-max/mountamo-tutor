import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Ten-frame oracle. Checks the `build`-type challenges (the birth mode):
 * - targetCount is an integer within the topic's scope ceiling (or the frame's
 *   intrinsic capacity: 10 single / 20 double) — the "Counting to 10 taught 0-20" class
 * - the set carries 3+ challenges (mastery-over-demo) with answer variety
 */
export const tenFrameOracle: ContentOracle = {
  componentId: 'ten-frame',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const frameCapacity = data.mode === 'double' ? 20 : 10;
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? frameCapacity;

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const targets: number[] = [];
    let checked = 0;
    for (const c of challenges) {
      const id = String(c.id ?? `#${checked}`);
      const type = String(c.type ?? '');
      if (type === 'build_pair') {
        // Open build: the total is code-owned, 3..10 inside the scope bound, and every total is asked twice.
        checked++;
        const t = c.targetCount;
        if (!Number.isInteger(t) || (t as number) < 3 || (t as number) > Math.min(10, ceiling)) {
          violations.push({ check: 'scope', where: id, detail: `build_pair total ${JSON.stringify(t)} outside [3, ${Math.min(10, ceiling)}]` });
        }
        if (/\d+\s*(\+|and)\s*\d+/.test(`${c.hint ?? ''} ${c.narration ?? ''}`)) {
          violations.push({ check: 'leak', where: id, detail: 'hint or narration names a pair' });
        }
        continue;
      }
      if (type !== 'build') {
        uncheckedTypes.add(type);
        continue;
      }
      checked++;
      const target = c.targetCount;
      if (!Number.isInteger(target)) {
        violations.push({ check: 'schema', where: id, detail: `targetCount ${JSON.stringify(target)} is not an integer` });
        continue;
      }
      const t = target as number;
      targets.push(t);
      if (t < 1 || t > ceiling) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `targetCount ${t} outside [1, ${ceiling}] (topic "${ctx.topic}", frame capacity ${frameCapacity})`,
        });
      }
    }

    const variety = checkAnswerVariety(targets, 'challenges[].targetCount');
    if (variety) violations.push(variety);

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
