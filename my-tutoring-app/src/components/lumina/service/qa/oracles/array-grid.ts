import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Array-grid oracle — a CALCULATION oracle for the rows × columns = product
 * contract. Where math-fact-fluency re-derives op1(+|-)op2, this one re-derives
 * the ARRAY total: product = targetRows × targetColumns, computed INDEPENDENTLY
 * from the two dimensions. Note the primitive ships NO product/total field —
 * the component computes it live — so "trusting the shipped key" here means
 * trusting that the shipped (targetRows, targetColumns) describe a REACHABLE,
 * in-scope task, which is exactly what we re-derive and check.
 *
 * The component (ArrayGrid.tsx) judges correctness as:
 *  - targetProduct = targetRows * targetColumns  (ArrayGrid.tsx:171).
 *  - build_array / count_array (handleSubmitCountOrBuild, :402-404):
 *    correctArray = currentRows === targetRows && currentColumns === targetColumns,
 *    correctTotal = studentTotal === targetProduct, isCorrect = both.
 *  - multiply_array (handleSubmitMultiply, :464-467):
 *    correctRows/Columns === target dims AND studentTotal === targetProduct.
 *  In build_array the student SELECTS the dimensions from button panels that
 *  render 1..min(maxRows,6) rows and 1..min(maxColumns,8) columns (:177-178,
 *  :685-720). If a target dimension exceeds that panel the correct state
 *  (arrayBuilt, :396-397) can NEVER be produced — the shipped key points at an
 *  unreachable state, the array-grid analogue of "the correct answer isn't
 *  among the options." Pre-built modes (count/multiply) type freely, so the
 *  button cap does not gate them.
 *
 * Checks:
 *  - answer-key-desync : dimensions must be positive integers, and in build_array
 *    both target dims must be selectable from the capped button panel (otherwise
 *    the correct state is unreachable and the student is marked wrong forever).
 *  - scope             : the product (rows × columns — the multiplication fact /
 *    total the student computes) must honor the objective ceiling. "Multiplication
 *    to 20" generating a 5×8=40 array is content past the objective. Ceiling =
 *    ctx.scopeMax ?? topic ceiling ?? the primitive's intrinsic max (6×8 = 48).
 *  - clustering        : products must spread (no "every array totals 12"), and
 *    no exact-duplicate array — same ORDERED (rows, columns) pair twice is a
 *    byte-identical card. (3×5 and 5×3 are DIFFERENT student tasks — different
 *    visual, different rows/cols answers in multiply mode — so they are NOT a
 *    duplicate even though the generator dedups them commutatively.)
 *
 * Deliberately NOT checked: answer-leak. The manipulative IS the answer made
 * visible: count/multiply modes render the array pre-built at exactly
 * targetRows×targetColumns items for the student to count, and build_array
 * states the target dimensions in its instruction ("Build an array with N rows
 * and M columns", :677) — both by design. The product itself never appears as
 * text (title/description are number-free by schema, gemini-array-grid.ts:162-169),
 * so there is no textual answer field to leak. A leak test would fire on the
 * intended visual/dimension exposure — worse than an honest gap. Leak/quality
 * stays with /eval-test.
 */

const KNOWN_TYPES = new Set(['build_array', 'count_array', 'multiply_array']);

// Component-side button-panel caps (ArrayGrid.tsx:177-178, :199-200 mirror).
const ROW_BUTTON_CAP = 6;
const COL_BUTTON_CAP = 8;
// Intrinsic product ceiling when neither the harness nor the topic names one.
const INTRINSIC_MAX_PRODUCT = ROW_BUTTON_CAP * COL_BUTTON_CAP; // 48

export const arrayGridOracle: ContentOracle = {
  componentId: 'array-grid',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const sessionType = String(data.challengeType ?? '');
    const isBuild = sessionType === 'build_array';
    if (!KNOWN_TYPES.has(sessionType)) {
      // Generic product/scope/clustering still apply below; only the build-mode
      // reachability model is type-specific, so record the honesty gap.
      uncheckedTypes.add(sessionType || '(missing challengeType)');
    }

    // Effective selectable ranges the build-mode panel actually renders.
    const maxRows = Number.isInteger(data.maxRows) ? (data.maxRows as number) : ROW_BUTTON_CAP;
    const maxColumns = Number.isInteger(data.maxColumns) ? (data.maxColumns as number) : COL_BUTTON_CAP;
    const rowButtonCap = Math.min(maxRows, ROW_BUTTON_CAP);
    const colButtonCap = Math.min(maxColumns, COL_BUTTON_CAP);

    // Objective ceiling on the PRODUCT (the multiplication fact). Harness scopeMax
    // wins, then a "to N"/"within N" topic, else the primitive's intrinsic max.
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? INTRINSIC_MAX_PRODUCT;

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const products: number[] = [];
    // Keyed on the ORDERED (rows, columns) pair: a byte-identical array card.
    // Commutative reflections (3×5 vs 5×3) are distinct tasks, not duplicates.
    const pairSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const where = id;

      const rows = c.targetRows;
      const cols = c.targetColumns;
      if (!Number.isInteger(rows) || !Number.isInteger(cols)) {
        violations.push({
          check: 'schema',
          where,
          detail: `dimensions not integers: targetRows=${JSON.stringify(rows)} targetColumns=${JSON.stringify(cols)}`,
        });
        continue;
      }
      const r = rows as number;
      const col = cols as number;

      if (r < 1 || col < 1) {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `degenerate array ${r}×${col} — a dimension below 1 has no reachable correct state`,
        });
        continue;
      }
      checked++;

      // ── Independence: compute the product ourselves (the component's targetProduct) ──
      const product = r * col;
      products.push(product);

      // ── answer-key-desync: build-mode target must be selectable from the panel ──
      if (isBuild) {
        if (r > rowButtonCap) {
          violations.push({
            check: 'answer-key-desync',
            where,
            detail: `targetRows ${r} exceeds the build panel (1..${rowButtonCap}) — the ${r}×${col} array can never be built, so the correct state is unreachable`,
          });
        }
        if (col > colButtonCap) {
          violations.push({
            check: 'answer-key-desync',
            where,
            detail: `targetColumns ${col} exceeds the build panel (1..${colButtonCap}) — the ${r}×${col} array can never be built, so the correct state is unreachable`,
          });
        }
      }

      // ── scope: the product honors the objective ceiling ──
      if (product > ceiling) {
        violations.push({
          check: 'scope',
          where,
          detail: `product ${r}×${col}=${product} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
        });
      }

      // Ordered-pair duplicate tracking.
      const pairKey = `${r}x${col}`;
      pairSeen.set(pairKey, (pairSeen.get(pairKey) ?? 0) + 1);
    }

    // ── clustering: products spread, no duplicated array card ──
    const variety = checkAnswerVariety(products, 'challenges[].product');
    if (variety) violations.push(variety);
    pairSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical array "${key}" appears ${count}× — a duplicated card`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
