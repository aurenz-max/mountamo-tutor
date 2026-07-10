import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Balance-scale oracle — a CALCULATION oracle for the linear-equation family
 * (equality / equality_hard / one_step / one_step_hard / two_step_intro /
 * two_step). Its flagship guarantee is answer-key-desync: the shipped
 * `variableValue` must be the value that ACTUALLY balances the two sides — the
 * vocabulary-explorer class (a correct solve marked wrong).
 *
 * WHAT THE COMPONENT JUDGES (BalanceScale.tsx):
 *  - calcSideValue (:259-261) sums each side as: every `isVariable` block counts
 *    as `activeVariableValue` (NOT its own `.value`, which is always 1); every
 *    other block counts as its `.value`. So a side is `varCount·x + constSum`.
 *  - handleVerify (:552-595) marks the answer correct iff
 *    `|typed − activeVariableValue| < 0.01` — `variableValue` is the stored key.
 *  - the scale reads BALANCED iff the two side totals tie AT that x (:265). If the
 *    equation is not actually balanced at `variableValue`, the on-screen scale and
 *    the graded answer disagree — the exact desync this oracle exists to catch.
 *  - the student isolates x by clicking a block to remove the SAME value from both
 *    sides (removeObject :415-458 requires a matching block on the other side); a
 *    coefficient (kx) is k separate variable blocks, solved by the divide op
 *    (:502-517, gated by isSideDivisibleBy). So a constant on the variable's side
 *    with no twin on the other side can never be cleared — the equation is
 *    unsolvable through the UI even when its arithmetic is sound.
 *
 * THE INDEPENDENCE RULE: the oracle NEVER reads `variableValue` as truth. It
 * re-derives the solution straight from the block layout —
 *   x = (rightConstSum − leftConstSum) / (leftVarCount − rightVarCount)
 * — the same linear equation the sides encode, solved a different way than the
 * generator built them, then checks that x equals the shipped `variableValue`.
 * A generator (or hand edit) that stored a mismatched answer, a cancelling
 * variable, or a non-integer solution can no longer false-pass.
 *
 * Checks:
 *  - answer-key-desync : the independently-solved x equals `variableValue`; there
 *    IS a variable to solve for; the variable does not cancel (leftVarCount ≠
 *    rightVarCount → a unique solution exists); and every constant on the
 *    variable's side has a matching block on the other side (else it can never be
 *    removed — the equation is unsolvable through the click interaction).
 *  - scope             : every constant block value AND `variableValue` honor the
 *    objective ceiling (ctx.scopeMax ?? topic ceiling ?? the gradeBand intrinsic:
 *    K-2→20, 3-4→50, 5→100 — the generator's own per-tier bounds).
 *  - clustering        : variableValues spread across challenges (no "every answer
 *    is 6"); no exact-duplicate equation (same block shape + answer).
 *  - schema            : ≥3 challenges (mastery-over-demo); leftSide/rightSide are
 *    non-empty object arrays with numeric values; `variableValue` is a POSITIVE
 *    INTEGER (K-5 whole-number contract); a kx equation (varCount>1) has the
 *    divide operation available to isolate x.
 *
 * Deliberately NOT checked: answer-leak. The per-challenge instruction/hint are
 * code-authored and never state x's value (they name only the visible constants,
 * which ARE the stimulus), and the LLM-authored wrapper title/description are
 * session-level — they cannot name any single equation's answer. A leak test here
 * would have nothing sound to bite on. Leak/pedagogy stays with /eval-test.
 */

const KNOWN_TYPES = new Set([
  'equality', 'equality_hard', 'one_step', 'one_step_hard', 'two_step_intro', 'two_step',
]);

// Per-band value ceiling from the generator's own bounds (CHALLENGE_TYPE_DOCS):
// K-2 "under 20", 3-4 "under 50", grade-5 "under 50" (results), a touch of headroom.
const INTRINSIC_BY_BAND: Record<string, number> = { 'K-2': 20, '3-4': 50, '5': 100 };
const DEFAULT_INTRINSIC = 50;

interface Side {
  varCount: number;
  constSum: number;
  constMulti: Map<number, number>; // constant value → count (for the removability check)
}

function summarizeSide(blocks: Array<Record<string, unknown>>): Side | null {
  let varCount = 0;
  let constSum = 0;
  const constMulti = new Map<number, number>();
  for (const b of blocks) {
    const isVar = b.isVariable === true;
    const v = b.value;
    if (typeof v !== 'number' || !isFinite(v)) return null;
    if (isVar) {
      varCount++;
    } else {
      constSum += v;
      constMulti.set(v, (constMulti.get(v) ?? 0) + 1);
    }
  }
  return { varCount, constSum, constMulti };
}

export const balanceScaleOracle: ContentOracle = {
  componentId: 'balance-scale',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const gradeBand = String(data.gradeBand ?? '');
    const intrinsic = INTRINSIC_BY_BAND[gradeBand] ?? DEFAULT_INTRINSIC;
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? intrinsic;

    const allowOps = Array.isArray(data.allowOperations)
      ? (data.allowOperations as unknown[]).map(String)
      : [];

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const varietyValues: Array<string | number> = [];
    const shapeSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.type ? `${c.type}#${i + 1}` : `#${i + 1}`);
      const type = String(c.type ?? '');
      if (!KNOWN_TYPES.has(type)) uncheckedTypes.add(type || '(missing type)');

      const left = Array.isArray(c.leftSide) ? asRecordArray(c.leftSide) : null;
      const right = Array.isArray(c.rightSide) ? asRecordArray(c.rightSide) : null;
      const variableValue = c.variableValue;

      if (!left || !right || left.length === 0 || right.length === 0) {
        violations.push({ check: 'schema', where: id, detail: `leftSide/rightSide must both be non-empty object arrays (left=${JSON.stringify(c.leftSide)}, right=${JSON.stringify(c.rightSide)})` });
        continue;
      }
      if (typeof variableValue !== 'number' || !isFinite(variableValue)) {
        violations.push({ check: 'schema', where: id, detail: `variableValue must be a finite number; got ${JSON.stringify(variableValue)}` });
        continue;
      }

      const ls = summarizeSide(left);
      const rs = summarizeSide(right);
      if (!ls || !rs) {
        violations.push({ check: 'schema', where: id, detail: `a block has a non-numeric value (left=${JSON.stringify(c.leftSide)}, right=${JSON.stringify(c.rightSide)})` });
        continue;
      }
      checked++;

      // ── answer-key-desync: independently solve the linear equation ──
      const totalVars = ls.varCount + rs.varCount;
      const denom = ls.varCount - rs.varCount;
      if (totalVars === 0) {
        violations.push({ check: 'answer-key-desync', where: id, detail: `no variable block on either side — there is nothing to solve for, yet variableValue=${variableValue}` });
      } else if (denom === 0) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `equal variable count on both sides (${ls.varCount} each) — the variable cancels, so no unique x exists, yet variableValue=${variableValue}`,
        });
      } else {
        const solvedX = (rs.constSum - ls.constSum) / denom;
        if (Math.abs(solvedX - variableValue) > 0.01) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `the equation ${ls.varCount}x+${ls.constSum} = ${rs.varCount}x+${rs.constSum} balances at x=${solvedX}, but variableValue=${variableValue} — a correct solve is marked wrong and the scale would mislabel balance`,
          });
        }
        if (!Number.isInteger(solvedX) || solvedX <= 0) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `the equation solves to x=${solvedX} — not a positive integer, which the K-5 whole-number block interaction cannot cleanly represent`,
          });
        }
      }

      // ── schema: variableValue itself must be a positive integer ──
      if (!Number.isInteger(variableValue) || variableValue <= 0) {
        violations.push({ check: 'schema', where: id, detail: `variableValue=${variableValue} is not a positive integer` });
      }

      // ── answer-key-desync: every constant on the variable's side is removable ──
      // Only the one-sided-variable layout the builders produce is modelled; a
      // variable on BOTH sides needs a different interaction and is left unchecked.
      if (Math.min(ls.varCount, rs.varCount) === 0 && totalVars > 0) {
        const varSide = ls.varCount > 0 ? ls : rs;
        const otherSide = ls.varCount > 0 ? rs : ls;
        varSide.constMulti.forEach((count, value) => {
          const twin = otherSide.constMulti.get(value) ?? 0;
          if (twin < count) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `constant block ${value} sits on the variable's side but has no matching block on the other side — the student cannot remove it to isolate x (unsolvable through the click interaction)`,
            });
          }
        });
        // A coefficient (kx) needs the divide operation to isolate x.
        if (varSide.varCount > 1 && allowOps.length > 0 && !allowOps.includes('divide')) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `${varSide.varCount} copies of x require the divide operation to isolate x, but allowOperations=[${allowOps.join(', ')}] omits it`,
          });
        }
      }

      // ── scope: every constant + the answer honor the objective ceiling ──
      const allConsts = [...Array.from(ls.constMulti.keys()), ...Array.from(rs.constMulti.keys()), variableValue];
      const over = allConsts.find((v) => Math.abs(v) > ceiling);
      if (over !== undefined) {
        violations.push({ check: 'scope', where: id, detail: `value ${over} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}", band "${gradeBand}")` });
      }

      varietyValues.push(variableValue);
      const shapeKey = `${sideShape(left)}=${sideShape(right)}|x=${variableValue}`;
      shapeSeen.set(shapeKey, (shapeSeen.get(shapeKey) ?? 0) + 1);
    }

    // ── clustering: answers spread; no duplicated equation ──
    const variety = checkAnswerVariety(varietyValues, 'challenges[].variableValue');
    if (variety) violations.push(variety);
    shapeSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `identical equation "${key}" appears ${count}× — a duplicated challenge` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};

/** Canonical shape of a side for duplicate detection: sorted var/const signature. */
function sideShape(blocks: Array<Record<string, unknown>>): string {
  return blocks
    .map((b) => (b.isVariable === true ? 'v' : `c${b.value}`))
    .sort()
    .join('|');
}
