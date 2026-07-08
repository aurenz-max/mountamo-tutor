import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Area-model oracle — a CALCULATION oracle for the place-value area-model
 * multiplication / perimeter / factoring family. Like array-grid (and unlike
 * comparison-builder), the primitive ships NO stored answer key: a challenge is
 * just two integer arrays — `factor1Parts[]` and `factor2Parts[]` — plus display
 * flags. The component derives EVERY correct value live from those two arrays,
 * so there is no separate `correctAnswer`/`total` field that could disagree with
 * the parts. "Trusting the shipped key" therefore means trusting that the two
 * parts arrays describe a WELL-FORMED, IN-SCOPE, correctly-decomposed model —
 * which is exactly what this oracle re-derives.
 *
 * The component (AreaModel.tsx) judges correctness as:
 *  - per grid cell   (handleCellSubmit, :503-505):
 *      correctAnswer = factor1Parts[col] * factor2Parts[row];
 *      isCorrect = studentAnswerNum === correctAnswer.
 *  - grand total     (handleSumSubmit, :228, :540):
 *      correctSum = totalProduct = (Σ factor1Parts) * (Σ factor2Parts).
 *      Note Σ_row Σ_col f1[col]·f2[row] === (Σf1)(Σf2) identically, so the grand
 *      total is ALWAYS internally consistent with the cells — there is nothing to
 *      desync numerically. The area model's VALIDITY instead rests on the parts
 *      being a real place-value decomposition (below).
 *  - perimeter       (handlePerimeterSubmit, :230, :592):
 *      totalPerimeter = 2 * (Σ factor1Parts + Σ factor2Parts).
 *  - factor mode     (handleFactorCheck, :648-649):
 *      the student must re-enter factor1Parts (top) and factor2Parts (left)
 *      index-by-index; correct = every entry === the stored part.
 *
 * THE INDEPENDENCE RULE: the oracle never reads a stored product/total (there is
 * none). It recomputes Σparts, the product (Σf1·Σf2) and the perimeter itself,
 * and — crucially — validates the place-value SHAPE of each decomposition
 * STRUCTURALLY (each grid-mode part must be a single non-zero digit times a power
 * of ten, `d·10^k`, with the parts occupying DISTINCT places), which is a
 * different derivation from the generator's top-down subtractive `decomposeByPlace`
 * (gemini-area-model.ts:220-236). A generator whose decomposition routine drifts
 * (e.g. emitting [12, 5] for 17, or [10, 40] with two tens) can no longer
 * false-pass: the model the student sees would label a column/row with a value
 * that is not a valid place of the factor it claims to multiply.
 *
 * Checks:
 *  - answer-key-desync : (a) parts must be positive integers — a part < 1 or
 *    non-integer makes a cell's correctAnswer ≤ 0 / NaN and, in factor mode, an
 *    unreachable dimension (the array-grid "unreachable correct state" class).
 *    (b) grid-mode place-value integrity — every part is a `d·10^k` place value
 *    and no two parts share a place; otherwise the shipped area model does not
 *    represent a valid place-value decomposition of the factors it multiplies.
 *    (c) DEFENSIVE: if a generation ever adds a stored `total`/`product`/
 *    `correctAnswer`/`factor1`/`factor2`/`perimeter`, it must equal the value
 *    re-derived from the parts (today none are shipped — see header).
 *  - scope             : the quantity the student PRODUCES honors the objective
 *    ceiling — the PRODUCT (Σf1·Σf2) for grid/multiply/factor modes, the
 *    PERIMETER (2·(Σf1+Σf2)) for perimeter mode. "Area models to 100" emitting a
 *    25×47=1175 model is content past the objective. Ceiling = ctx.scopeMax ??
 *    topic ceiling ?? the mode's intrinsic max (build_model 250, find_area/factor
 *    2500, multiply 25000, perimeter 150 — from the generator's operand ranges).
 *  - clustering        : within the (single-mode) session the produced quantity
 *    must spread (no "every model totals 1175"), and no exact-duplicate card —
 *    same ORDERED (Σf1, Σf2) pair twice. Transposes (25×47 vs 47×25) are DISTINCT
 *    cards (a transposed grid is a different visual task and a different set of
 *    cell answers), following the array-grid reflection ruling.
 *  - schema            : challenges present, ≥3 (mastery-over-demo); each has
 *    non-empty integer factor1Parts/factor2Parts arrays.
 *
 * Deliberately NOT checked:
 *  - answer-leak. The manipulative IS the model made visible: showDimensions
 *    labels the factor parts on the headers by design, and factor mode shows the
 *    partial products for the student to reverse. The title/description are
 *    number-free by schema (gemini-area-model.ts:84-93). A leak test would fire on
 *    the intended visual exposure — worse than an honest gap. Leak/quality stays
 *    with /eval-test.
 *  - "correct click marked wrong" desync in its classic form is STRUCTURALLY
 *    impossible here: with no separate stored key, the parts define an
 *    always-self-consistent answer. So answer-key-desync above is reinterpreted
 *    (as in array-grid) to mean degenerate / ill-formed / non-place-value models.
 *  - perimeter place-value integrity: perimeter sides are whole numbers (5-30),
 *    NOT place-value decompositions, so the `d·10^k` shape check is grid-mode only.
 */

const KNOWN_MODES = new Set(['build_model', 'find_area', 'perimeter', 'multiply', 'factor']);
// Modes whose parts are genuine place-value decompositions (grid columns/rows).
// perimeter is excluded: its parts are single whole side lengths.
const GRID_MODES = new Set(['build_model', 'find_area', 'multiply', 'factor']);

// Intrinsic ceilings on the produced quantity, from the generator's operand
// ranges (gemini-area-model.ts): build_model 9×25=225, find_area/factor
// 49×49=2401, multiply 499×49=24451, perimeter 2·(30+29)=118 — rounded up so a
// legitimate max-range generation never trips scope when no topic ceiling exists.
const INTRINSIC_BY_MODE: Record<string, number> = {
  build_model: 250,
  find_area: 2500,
  factor: 2500,
  multiply: 25000,
  perimeter: 150,
};
const DEFAULT_INTRINSIC = 2500;

function isInt(v: unknown): v is number {
  return Number.isInteger(v);
}

function sum(parts: number[]): number {
  return parts.reduce((s, v) => s + v, 0);
}

/**
 * Place index of a valid place-value part: 40 → 1, 7 → 0, 100 → 2. Returns -1
 * when `p` is NOT a single non-zero digit times a power of ten (e.g. 12, 205,
 * 0) — i.e. not a legal place of a decomposition. This is a STRUCTURAL check on
 * the emitted value, independent of how the generator built it.
 */
function placeOf(p: number): number {
  const s = String(p);
  return /^[1-9]0*$/.test(s) ? s.length - 1 : -1;
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export const areaModelOracle: ContentOracle = {
  componentId: 'area-model',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const mode = String(data.challengeType ?? '');
    if (!KNOWN_MODES.has(mode)) {
      // Generic parts/scope/clustering still apply below; only place-value
      // integrity and the perimeter-vs-product scope target are mode-specific.
      uncheckedTypes.add(mode || '(missing challengeType)');
    }
    const isGrid = GRID_MODES.has(mode);
    const isPerimeter = mode === 'perimeter';
    const intrinsic = INTRINSIC_BY_MODE[mode] ?? DEFAULT_INTRINSIC;
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? intrinsic;

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    // The quantity the student produces per challenge (for the variety check),
    // and ordered-pair duplicate-card tracking.
    const primaryValues: number[] = [];
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const f1 = c.factor1Parts;
      const f2 = c.factor2Parts;

      if (!Array.isArray(f1) || !Array.isArray(f2) || f1.length === 0 || f2.length === 0) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `missing/empty parts: factor1Parts=${JSON.stringify(f1)} factor2Parts=${JSON.stringify(f2)}`,
        });
        continue;
      }
      if (!f1.every(isInt) || !f2.every(isInt)) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `non-integer parts: factor1Parts=${JSON.stringify(f1)} factor2Parts=${JSON.stringify(f2)}`,
        });
        continue;
      }
      const p1 = f1 as number[];
      const p2 = f2 as number[];

      // ── answer-key-desync (a): parts must be positive — a part < 1 makes a
      //    cell correctAnswer ≤ 0 (and an unreachable factor-mode dimension). ──
      if (p1.some((v) => v < 1) || p2.some((v) => v < 1)) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `non-positive part in [${p1.join(', ')}] × [${p2.join(', ')}] — a cell's correct product would be ≤ 0, an unreachable correct state`,
        });
        continue;
      }
      checked++;

      // ── Independence: recompute the factors, product and perimeter ourselves ──
      const f1Total = sum(p1);
      const f2Total = sum(p2);
      const product = f1Total * f2Total;
      const perimeter = 2 * (f1Total + f2Total);

      // ── answer-key-desync (b): grid-mode place-value integrity ──
      if (isGrid) {
        for (const [label, parts] of [['factor1Parts', p1], ['factor2Parts', p2]] as const) {
          const places = parts.map(placeOf);
          if (places.some((k) => k < 0)) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `${label}=[${parts.join(', ')}] contains a non-place value (not d·10^k) — the area-model header would label a column/row with a value that is not a valid place of the factor`,
            });
          } else if (new Set(places).size !== places.length) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `${label}=[${parts.join(', ')}] has two parts at the same place — not a valid place-value decomposition of ${sum(parts)}`,
            });
          }
        }
      }

      // ── answer-key-desync (c): DEFENSIVE stored-field agreement (none shipped
      //    today; guards a future generation that adds a redundant key). ──
      for (const key of ['total', 'product', 'correctAnswer'] as const) {
        if (key in c && isInt(c[key]) && (c[key] as number) !== product) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `stored ${key}=${c[key]} disagrees with re-derived product (Σf1·Σf2 = ${f1Total}·${f2Total} = ${product})`,
          });
        }
      }
      if ('factor1' in c && isInt(c.factor1) && (c.factor1 as number) !== f1Total) {
        violations.push({ check: 'answer-key-desync', where: id, detail: `stored factor1=${c.factor1} ≠ Σfactor1Parts (${f1Total})` });
      }
      if ('factor2' in c && isInt(c.factor2) && (c.factor2 as number) !== f2Total) {
        violations.push({ check: 'answer-key-desync', where: id, detail: `stored factor2=${c.factor2} ≠ Σfactor2Parts (${f2Total})` });
      }
      if ('perimeter' in c && isInt(c.perimeter) && (c.perimeter as number) !== perimeter) {
        violations.push({ check: 'answer-key-desync', where: id, detail: `stored perimeter=${c.perimeter} ≠ 2·(Σf1+Σf2) (${perimeter})` });
      }

      // ── scope: the quantity the student produces honors the objective ceiling ──
      const primary = isPerimeter ? perimeter : product;
      const primaryLabel = isPerimeter ? 'perimeter' : 'product';
      if (primary > ceiling) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `${primaryLabel} ${isPerimeter ? `2·(${f1Total}+${f2Total})` : `${f1Total}×${f2Total}`}=${primary} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
        });
      }
      primaryValues.push(primary);

      // Ordered (Σf1, Σf2) pair — a byte-identical model card. Transposes distinct.
      bump(cardSeen, `${f1Total}x${f2Total}`);
    }

    // ── clustering: the produced quantity spreads; no duplicated model card ──
    const variety = checkAnswerVariety(primaryValues, `${mode || 'challenges'}[].${isPerimeter ? 'perimeter' : 'product'}`);
    if (variety) violations.push(variety);
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical model "${key}" (Σf1 × Σf2) appears ${count}× — a duplicated card`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
