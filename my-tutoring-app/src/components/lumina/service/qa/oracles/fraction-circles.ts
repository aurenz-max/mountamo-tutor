import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Fraction-circles oracle — a CALCULATION oracle for the four fraction-circle
 * modes (identify / build / compare / equivalent). Like array-grid, the
 * component ships NO stored answer key: every mode computes correctness LIVE
 * from (numerator, denominator) at check time, so "trusting the key" here means
 * trusting that the shipped fraction describes a REACHABLE, in-scope task — which
 * is exactly what this oracle re-derives from the numbers.
 *
 * How the component (FractionCircles.tsx) judges correctness, per type:
 *  - identify   (checkIdentify, :348-352): parses the student's "n/d" and calls
 *    fractionsEquivalent(userNum, userDen, numerator, denominator). Correct state
 *    is reachable for any well-formed proper/whole fraction (den ≥ 1, 0 ≤ num ≤ den).
 *  - build      (checkBuild, :381): correct = shadedSlices.size === numerator. The
 *    student can shade 0..denominator slices, so the target is reachable iff
 *    0 ≤ numerator ≤ denominator (numerator > denominator ⇒ the size can never
 *    equal it ⇒ the correct state is unreachable, the array-grid class).
 *  - compare    (checkCompare, :409-413): derives the correct choice from the two
 *    VALUES — leftVal = numerator/denominator vs rightVal = compareFraction.* —
 *    ships no key. The oracle guards the STIMULUS: compareFraction present,
 *    well-formed, and not byte-identical to the base (identical circles = nothing
 *    to compare, a degenerate "which is larger" task).
 *  - equivalent (checkEquivalent, :450-454): correct = fractionsEquivalent(
 *    shadedSlices.size, equivalentDenominator, numerator, denominator). The student
 *    shades builtNum ∈ 0..equivalentDenominator; the ONLY builtNum that satisfies
 *    it is numerator*equivalentDenominator/denominator. If that is not an integer,
 *    NO shading is ever correct — an unreachable correct state / answer-key desync.
 *
 * fractionsEquivalent (FractionCircles.tsx:156-160) simplifies both fractions via
 * gcd and compares reduced (n, d); this oracle mirrors that reduction with its own
 * gcd/simplify (below) — never importing the component's — so the equivalence and
 * duplicate-card logic are re-derived independently.
 *
 * THE INDEPENDENCE RULE: the fraction IS the key. The oracle recomputes
 * well-formedness and (for equivalent) REACHABILITY straight from the numbers —
 * numerator*equivalentDenominator % denominator === 0 — rather than assuming the
 * generator picked a compatible equivalentDenominator (it has a post-process that
 * *tries* to, but a shared bug there would false-pass if the oracle trusted it).
 *
 * Checks:
 *  - answer-key-desync : fraction well-formed (den ≥ 1, 0 ≤ num ≤ den — covers
 *    identify naming AND build reachability); equivalent-mode reachability (an
 *    integer equivalent numerator exists for equivalentDenominator); compare-mode
 *    operands valid and not identical to the base.
 *  - scope             : every denominator the student reads or builds
 *    (denominator, compareFraction.denominator, equivalentDenominator) honors the
 *    objective ceiling. "Denominators to 12" with a 1/16 circle is past scope.
 *    Ceiling = ctx.scopeMax ?? topic ceiling ?? gradeBand intrinsic (K-2→4, 3-5→12).
 *  - clustering        : the base fraction VALUES spread (no "every card is 1/2",
 *    detected on the REDUCED value so 2/4 and 1/2 count as the same), and no
 *    exact-duplicate fraction card (same displayed identity per type).
 *  - schema            : required numeric fields present/integer; ≥3 challenges
 *    (mastery-over-demo).
 *
 * Deliberately NOT checked: answer-leak. The manipulative IS the fraction made
 * visible — identify pre-shades numerator/denominator for the student to read,
 * build/compare/equivalent state the target fraction in the instruction and (at
 * easy/medium tiers) render numeric labels by design. A leak test would fire on
 * the intended visual/label exposure, worse than an honest gap. The scaffold
 * flags (showTotalPieces/showWorkingCount/showFractionLabels) are DISPLAY-ONLY and
 * never read by any checker (generator comment, gemini-fraction-circles.ts:146-148),
 * so they cannot desync an answer and are not verified here. Leak/quality/tier
 * withdrawal stays with /eval-test.
 */

const KNOWN_TYPES = new Set(['identify', 'build', 'compare', 'equivalent']);

// Intrinsic denominator ceiling when neither the harness nor the topic names one.
// Mirrors the generator's GRADE_BAND_DENOMINATORS max (gemini-fraction-circles.ts:36-39).
const INTRINSIC_BY_BAND: Record<string, number> = { 'K-2': 4, '3-5': 12 };
const DEFAULT_INTRINSIC = 12;

function isInt(v: unknown): v is number {
  return Number.isInteger(v);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Reduce a fraction the way FractionCircles.simplify does — for the variety key. */
function reduce(n: number, d: number): string {
  const g = gcd(Math.abs(n), Math.abs(d)) || 1;
  return `${n / g}/${d / g}`;
}

export const fractionCirclesOracle: ContentOracle = {
  componentId: 'fraction-circles',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const gradeBand = String(data.gradeBand ?? '');
    const intrinsic = INTRINSIC_BY_BAND[gradeBand] ?? DEFAULT_INTRINSIC;
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? intrinsic;

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    // Reduced base-fraction value per challenge, for the variety check.
    const baseValues: string[] = [];
    // Displayed-identity cards (per type) for exact-duplicate detection.
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.type ?? '');
      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing type)');
        continue;
      }

      const num = c.numerator;
      const den = c.denominator;
      if (!isInt(num) || !isInt(den)) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `numerator/denominator must be integers; got ${JSON.stringify(num)}/${JSON.stringify(den)}`,
        });
        continue;
      }
      const n = num as number;
      const d = den as number;
      checked++;

      // ── answer-key-desync: the base fraction must be well-formed. den < 1 has no
      //    circle; num > den can never be built (shadedSlices.size ≤ den) and can't
      //    be a proper shaded reading — the correct state is unreachable. ──
      if (d < 1) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `denominator ${d} < 1 — the circle has no slices, so no fraction can be shown`,
        });
      }
      if (n < 0 || n > d) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `numerator ${n} out of range 0..${d} — the target ${n}/${d} can never be shaded/named (unreachable correct state)`,
        });
      }

      // ── scope: the base denominator honors the objective ceiling ──
      if (d > ceiling) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `denominator ${d} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
        });
      }

      baseValues.push(reduce(n, d));

      if (type === 'compare') {
        const cf = c.compareFraction as Record<string, unknown> | undefined;
        const cnum = cf?.numerator;
        const cden = cf?.denominator;
        if (!cf || !isInt(cnum) || !isInt(cden)) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `compare needs an integer compareFraction {numerator, denominator}; got ${JSON.stringify(cf)}`,
          });
        } else {
          const cn = cnum as number;
          const cd = cden as number;
          // ── answer-key-desync: the comparison operand must be a valid fraction ──
          if (cd < 1 || cn < 0 || cn > cd) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `compareFraction ${cn}/${cd} is malformed (need den ≥ 1, 0 ≤ num ≤ den) — it can't render a valid comparison`,
            });
          } else if (cn === n && cd === d) {
            // Byte-identical circles — nothing to compare (degenerate task).
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `compareFraction ${cn}/${cd} is identical to the base ${n}/${d} — nothing to compare`,
            });
          }
          // ── scope: the comparison denominator honors the ceiling too ──
          if (isInt(cd) && cd > ceiling) {
            violations.push({
              check: 'scope',
              where: id,
              detail: `compareFraction denominator ${cd} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
            });
          }
          cardSeen.set(`compare:${n}/${d}vs${cn}/${cd}`, (cardSeen.get(`compare:${n}/${d}vs${cn}/${cd}`) ?? 0) + 1);
        }
        continue;
      }

      if (type === 'equivalent') {
        const eq = c.equivalentDenominator;
        if (!isInt(eq)) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `equivalent needs an integer equivalentDenominator; got ${JSON.stringify(eq)}`,
          });
        } else {
          const e = eq as number;
          if (e < 1) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `equivalentDenominator ${e} < 1 — the target circle has no slices`,
            });
          } else if ((n * e) % d !== 0) {
            // ── Independence flagship: recompute reachability from the numbers.
            //    The only correct build is numerator*equivalentDenominator/denominator;
            //    if it's not an integer, NO shading is ever accepted. ──
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `no integer equivalent of ${n}/${d} exists with denominator ${e} (${n}×${e}/${d} = ${(n * e) / d} is not whole) — the correct state is unreachable`,
            });
          }
          if (e > ceiling) {
            violations.push({
              check: 'scope',
              where: id,
              detail: `equivalentDenominator ${e} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
            });
          }
          cardSeen.set(`equivalent:${n}/${d}->${e}`, (cardSeen.get(`equivalent:${n}/${d}->${e}`) ?? 0) + 1);
        }
        continue;
      }

      // identify / build — the displayed identity is just the base fraction.
      const key = `${type}:${n}/${d}`;
      cardSeen.set(key, (cardSeen.get(key) ?? 0) + 1);
    }

    // ── clustering: base fraction values must spread (reduced, so 2/4 == 1/2) ──
    const variety = checkAnswerVariety(baseValues, 'challenges[].fraction');
    if (variety) violations.push(variety);

    // ── clustering: no exact-duplicate fraction card ──
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical fraction card "${key}" appears ${count}× — a duplicated card`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
