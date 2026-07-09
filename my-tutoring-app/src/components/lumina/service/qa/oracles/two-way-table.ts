import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety } from './helpers';

/**
 * Two-way-table oracle — a CALCULATION oracle for the categorical-probability
 * family (joint_probability, marginal_distribution, conditional_probability,
 * independence_test). The primitive ships a single stored answer,
 * `expectedProbability`, judged against a free-typed decimal within `tolerance`.
 * Its flagship guarantee is answer-key-desync: that stored probability must be one
 * the table's own frequencies can actually PRODUCE for the operation the challenge
 * asks — a probability that no cell/row/col arithmetic yields is a correct
 * computation marked wrong (the vocabulary-explorer class), e.g. a wrong
 * denominator or a forgotten division.
 *
 * The component (TwoWayTable.tsx) judges correctness in handleCheck (:477-495):
 * correct = |parsed − expectedProbability| ≤ tolerance. So `expectedProbability` IS
 * the whole answer key. Which cell/row/col the question refers to is stated in
 * `question` text (+ the `answerTotalAxis`/`answerTotalIndex` hints for the
 * conditional denominator).
 *
 * THE INDEPENDENCE RULE: the oracle never reads `expectedProbability` to build its
 * expectation. From `frequencies` alone it recomputes the FULL SPACE of valid
 * answers for the challenge's operation and checks the stored key lands on one
 * (within the challenge's own tolerance):
 *  - joint_probability      : { freq[i][j] / grandTotal }
 *  - marginal_distribution  : { rowTotal[i] / grandTotal } ∪ { colTotal[j] / grandTotal }
 *  - conditional_probability: { freq[i][j] / rowTotal[i] } ∪ { freq[i][j] / colTotal[j] }
 *                             (tightened to the exact denominator when
 *                             answerTotalAxis/Index pin the conditioning row/col)
 *  - independence_test      : { (rowTotal[i]/grand) × (colTotal[j]/grand) }  — the
 *                             expected joint probability UNDER independence
 * A generator that divides by the wrong total, reads the wrong cell, or forgets to
 * divide produces a probability outside this space and is caught — WITHOUT porting
 * the exact question-parse (which would risk a shared wrong assumption).
 *
 * Why the space, not the exact answer: pinning the single intended answer would
 * require parsing which categories the `question` names — re-implementing the
 * generator's own selection. The candidate-space check is a genuinely independent
 * necessary condition: the real answer is always in the space, and an
 * arithmetically-impossible key never is. When the space check passes, the residual
 * "did it pick the RIGHT member of the space" contract is recorded in uncheckedTypes.
 *
 * Checks:
 *  - answer-key-desync : expectedProbability is within tolerance of SOME valid
 *    frequency-derived answer for the challenge's operation (see the space above).
 *  - scope             : probability is an intrinsic [0,1] domain — expectedProbability
 *    must lie in [0,1]. There is no external magnitude ceiling to bite (documented),
 *    so scope only enforces the [0,1] bound.
 *  - clustering        : the stored probabilities spread across the session (no
 *    "every answer is 0.5"), and no exact-duplicate card (same frequencies + same
 *    question twice).
 *  - schema            : ≥3 challenges (mastery-over-demo); a known challengeType;
 *    row/column category arrays; a rectangular `frequencies` matrix of non-negative
 *    integers sized rows×cols with a positive grand total; a numeric
 *    expectedProbability and a non-negative numeric tolerance.
 *
 * Deliberately NOT checked: answer-leak. Every question states the stimulus by
 * design (it names the categories and the table is the data the student reads), and
 * the easy-tier hint/sumReminder spell out the arithmetic on purpose — a leak test
 * would fire on the intended task. The RIGHT-member-of-the-space selection stays
 * with /eval-test (question phrasing / pedagogy). Leak/quality stays there too.
 */

const KNOWN_TYPES = new Set([
  'joint_probability',
  'marginal_distribution',
  'conditional_probability',
  'independence_test',
]);

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isNonNegInt(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 0;
}

/** Read `frequencies` as a rectangular non-negative-integer matrix, or null. */
function readMatrix(v: unknown, rows: number, cols: number): number[][] | null {
  if (!Array.isArray(v) || v.length !== rows) return null;
  const out: number[][] = [];
  for (const row of v) {
    if (!Array.isArray(row) || row.length !== cols || !row.every(isNonNegInt)) return null;
    out.push(row as number[]);
  }
  return out;
}

/** True when `p` is within `tol` of any candidate. */
function nearAny(p: number, candidates: number[], tol: number): boolean {
  return candidates.some((c) => Math.abs(p - c) <= tol);
}

export const twoWayTableOracle: ContentOracle = {
  componentId: 'two-way-table',
  verify(data): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const probs: number[] = [];
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.challengeType ?? '');
      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing challengeType)');
        continue;
      }

      const rowCats = Array.isArray(c.rowCategories) ? (c.rowCategories as unknown[]) : null;
      const colCats = Array.isArray(c.columnCategories) ? (c.columnCategories as unknown[]) : null;
      if (!rowCats || rowCats.length === 0 || !colCats || colCats.length === 0) {
        violations.push({ check: 'schema', where: id, detail: `rowCategories/columnCategories must be non-empty arrays; got ${JSON.stringify(c.rowCategories)} / ${JSON.stringify(c.columnCategories)}` });
        continue;
      }
      const freq = readMatrix(c.frequencies, rowCats.length, colCats.length);
      if (!freq) {
        violations.push({ check: 'schema', where: id, detail: `frequencies must be a ${rowCats.length}×${colCats.length} matrix of non-negative integers; got ${JSON.stringify(c.frequencies)}` });
        continue;
      }

      const ep = c.expectedProbability;
      if (!isNum(ep)) {
        violations.push({ check: 'schema', where: id, detail: `expectedProbability must be a number; got ${JSON.stringify(ep)}` });
        continue;
      }
      const expected = ep as number;
      const tolRaw = c.tolerance;
      if (tolRaw !== undefined && (!isNum(tolRaw) || (tolRaw as number) < 0)) {
        violations.push({ check: 'schema', where: id, detail: `tolerance must be a non-negative number when present; got ${JSON.stringify(tolRaw)}` });
      }
      // Compare within the challenge's own band; a floor covers rounded 2-dp keys.
      const tol = Math.max(isNum(tolRaw) ? (tolRaw as number) : 0.02, 0.01);

      // ── scope: probability is intrinsically [0,1]. ──
      if (expected < 0 || expected > 1) {
        violations.push({ check: 'scope', where: id, detail: `expectedProbability ${expected} is outside [0,1] — not a valid probability` });
      }

      // Totals — the independent re-derivation basis.
      const rowTotals = freq.map((r) => r.reduce((a, b) => a + b, 0));
      const colTotals = colCats.map((_, j) => freq.reduce((a, r) => a + r[j], 0));
      const grand = rowTotals.reduce((a, b) => a + b, 0);
      if (grand <= 0) {
        violations.push({ check: 'schema', where: id, detail: `frequencies sum to ${grand} — an empty table has no probabilities` });
        continue;
      }

      // ── Independence: the full space of valid answers for this operation. ──
      let candidates: number[] = [];
      if (type === 'joint_probability') {
        candidates = freq.flat().map((f) => f / grand);
      } else if (type === 'marginal_distribution') {
        candidates = [...rowTotals.map((t) => t / grand), ...colTotals.map((t) => t / grand)];
      } else if (type === 'conditional_probability') {
        const axis = c.answerTotalAxis;
        const idx = c.answerTotalIndex;
        if (axis === 'row' && isNum(idx) && rowTotals[idx as number] > 0) {
          candidates = freq[idx as number].map((f) => f / rowTotals[idx as number]);
        } else if (axis === 'col' && isNum(idx) && colTotals[idx as number] > 0) {
          candidates = freq.map((r) => r[idx as number] / colTotals[idx as number]);
        } else {
          // No usable hint → union of both conditioning directions.
          for (let ri = 0; ri < freq.length; ri++) {
            if (rowTotals[ri] > 0) for (const f of freq[ri]) candidates.push(f / rowTotals[ri]);
          }
          for (let cj = 0; cj < colCats.length; cj++) {
            if (colTotals[cj] > 0) for (let ri = 0; ri < freq.length; ri++) candidates.push(freq[ri][cj] / colTotals[cj]);
          }
        }
      } else {
        // independence_test: expected joint under independence = P(row)·P(col).
        for (const rt of rowTotals) for (const ct of colTotals) candidates.push((rt / grand) * (ct / grand));
      }

      checked++;
      if (candidates.length > 0 && !nearAny(expected, candidates, tol)) {
        // Round for a readable message without leaking the full space.
        const near = candidates.reduce((best, cand) => (Math.abs(cand - expected) < Math.abs(best - expected) ? cand : best), candidates[0]);
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `expectedProbability ${expected} is not produced by any ${type.replace(/_/g, ' ')} of the table (nearest valid value ${near.toFixed(4)}, tolerance ${tol}) — a correct computation would be marked wrong`,
        });
      }
      // The right-member-of-space selection (which categories the question names) is
      // not independently derivable without parsing the question.
      uncheckedTypes.add(`${type}(which-cell)`);

      probs.push(Math.round(expected * 1000) / 1000);
      bump(cardSeen, `${type}|${freq.map((r) => r.join('.')).join('/')}|${String(c.question ?? '')}`);
    }

    // ── clustering: probabilities spread across the session ──
    const variety = checkAnswerVariety(probs, 'challenges[].expectedProbability');
    if (variety) violations.push(variety);
    // ── clustering: no exact-duplicate card ──
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `identical card appears ${count}× — a duplicated challenge (${key.slice(0, 60)}…)` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}
