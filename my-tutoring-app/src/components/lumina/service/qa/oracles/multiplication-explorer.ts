import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, parseScopeCeiling } from './helpers';

/**
 * multiplication-explorer oracle — a CALCULATION oracle for a SINGLE-FACT
 * primitive. The whole activity explores ONE fact (`data.fact` = factor1 ×
 * factor2 = product) through many representations; the component judges EVERY
 * challenge's typed answer against that single shared fact.
 *
 * The component (MultiplicationExplorer.tsx:630-643) judges correctness as:
 *   getExpectedAnswer(): hiddenValue==='product' → fact.product
 *                        hiddenValue==='factor1' → fact.factor1
 *                        hiddenValue==='factor2' → fact.factor2
 *                        (null / anything else)  → fact.product   // default
 *   isCorrect = parseInt(answer) === getExpectedAnswer()
 * There is NO per-challenge `correctAnswer` field and the per-challenge
 * `targetFact` string is NOT consulted by the judge — the answer is derived
 * purely from the ONE shared `data.fact`.
 *
 * THE INDEPENDENCE RULE here: each challenge carries its own `targetFact`
 * string (e.g. "2 × 5 = 10") which — with its instruction — is the fact the
 * student is actually asked to work. We re-derive the student's INTENDED answer
 * by PARSING that string (a field the generator never reconciles against
 * `fact`), then compare it to what the component would actually JUDGE (the
 * shared `fact[hiddenValue]`). We never trust `fact.product`; we recompute it
 * from the factors. This catches the live bug seen in build/fluency modes where
 * the generator emits 5 DIFFERENT facts as challenges but the component grades
 * them all against one product — a student who correctly solves "2 × 5 = 10" is
 * marked wrong because the judge only accepts 20.
 *
 * Checks:
 *  - answer-key-desync : (a) shipped fact.product must equal factor1 × factor2
 *    (regression guard — the generator reconciles this at line 507); (b) each
 *    challenge's targetFact must be internally consistent (a × b = c); (c) the
 *    intended answer parsed from targetFact+hiddenValue must equal the shared
 *    fact's judged answer for that hiddenValue — the core cross-check; (d) a
 *    missing_factor challenge must hide a FACTOR (factor1/factor2), never the
 *    product, else the judge accepts the product while the prompt asks for a
 *    factor.
 *  - scope             : shared factors + product AND every targetFact's
 *    factors/product within [1, ceiling]; ceiling = scopeMax ?? topic ?? 144.
 *  - answer-leak       : the on-screen product readout (showOptions.showProduct
 *    drives the big fact header + every per-rep "= product") must be OFF
 *    whenever any challenge's asked value IS the product (hiddenValue==='product').
 *    This is the exact code-owned guard the generator enforces (lines 615/672);
 *    re-deriving it independently makes it a regression guard. Narrow by design —
 *    see the deliberate skip below.
 *  - clustering        : no exact-duplicate challenge card (same type +
 *    hiddenValue + targetFact + instruction). The student would see a
 *    byte-identical card twice.
 *
 * Deliberately NOT checked:
 *  - answer-variety ("every answer is N"): this is a SINGLE-FACT primitive — the
 *    component judges nearly every challenge (build/connect/commutative/
 *    distributive/fluency) against the SAME shared product by design, so the
 *    judged answers legitimately cluster on one value. A checkAnswerVariety over
 *    judged answers would false-positive on every valid single-mode session. The
 *    meaningful clustering signal here is the duplicate-card check above.
 *  - broad answer-leak (text scan): the factors appear in instructions by design
 *    ("Build 2 packs of 5 stickers"), and showProduct legitimately renders the
 *    product for factor-hidden (missing_factor) challenges where the product is
 *    GIVEN. A whole-number text-leak test would false-positive constantly and
 *    route phantom bugs to /eval-fix — worse than an honest gap. Instruction
 *    quality / pedagogy stays with /eval-test.
 *
 * All six challenge types share the one answer contract above, so none are left
 * unchecked numerically. Whether a connect/commutative/distributive challenge
 * actually TEACHES its relationship is qualitative — that stays /eval-test's job.
 */

const VALID_TYPES = new Set(['build', 'connect', 'commutative', 'distributive', 'missing_factor', 'fluency']);
const VALID_HIDDEN = new Set(['factor1', 'factor2', 'product']);
const INTRINSIC_CEILING = 144; // grades 3-4 reach 12 × 12; grade 2 products ≤ 50.

interface ParsedFact {
  factors: number[];
  rhs: number;
}

/** Parse a "a × b = c" fact string into its integer factors and RHS, separator-agnostic. */
function parseTargetFact(tf: string): ParsedFact | null {
  const parts = tf.split('=');
  if (parts.length !== 2) return null;
  const factors = (parts[0].match(/-?\d+/g) ?? []).map((n) => parseInt(n, 10));
  const rhsMatch = parts[1].match(/-?\d+/);
  if (factors.length < 2 || !rhsMatch) return null;
  return { factors, rhs: parseInt(rhsMatch[0], 10) };
}

/** The component's answer selector, parameterised over a (factor1, factor2, product) source. */
function answerFor(hiddenValue: string, factor1: number, factor2: number, product: number): number {
  if (hiddenValue === 'factor1') return factor1;
  if (hiddenValue === 'factor2') return factor2;
  return product; // 'product' and every non-factor value (incl. null) → product default
}

export const multiplicationExplorerOracle: ContentOracle = {
  componentId: 'multiplication-explorer',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    // Objective ceiling wins when the topic/harness carries one; else the
    // primitive's intrinsic max (12 × 12 = 144). "within 25" → products ≤ 25.
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? INTRINSIC_CEILING;

    // ── Shared fact: re-derive the product from the factors, never trust it ──
    const fact = (typeof data.fact === 'object' && data.fact !== null ? data.fact : {}) as Record<string, unknown>;
    const f1 = fact.factor1;
    const f2 = fact.factor2;
    const factOk = Number.isInteger(f1) && Number.isInteger(f2);
    const sharedF1 = factOk ? (f1 as number) : NaN;
    const sharedF2 = factOk ? (f2 as number) : NaN;
    const sharedProduct = sharedF1 * sharedF2; // INDEPENDENT — not fact.product

    if (!factOk) {
      violations.push({ check: 'schema', where: 'fact', detail: `fact.factor1/factor2 not integers: ${JSON.stringify(fact)}` });
    } else {
      // (a) regression guard: shipped product must match the factors.
      if (fact.product !== sharedProduct) {
        violations.push({
          check: 'answer-key-desync',
          where: 'fact',
          detail: `shipped fact.product ${JSON.stringify(fact.product)} but ${sharedF1} × ${sharedF2} = ${sharedProduct}`,
        });
      }
      // scope: the shared fact itself.
      for (const [label, val] of [['factor1', sharedF1], ['factor2', sharedF2], ['product', sharedProduct]] as const) {
        if (!Number.isInteger(val) || val < 1 || val > ceiling) {
          violations.push({
            check: 'scope',
            where: `fact.${label}`,
            detail: `${label} ${val} outside [1, ${ceiling}] (topic "${ctx.topic}")`,
          });
        }
      }
    }

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    // ── answer-leak (code-owned): product readout must be off when the product is asked ──
    const showProduct = (data.showOptions as Record<string, unknown> | undefined)?.showProduct === true;
    const anyProductHidden = challenges.some((c) => c.hiddenValue === 'product');
    if (showProduct && anyProductHidden) {
      violations.push({
        check: 'answer-leak',
        where: 'showOptions.showProduct',
        detail: `showProduct is true while a challenge hides the product (hiddenValue==='product') — the on-screen "= ${sharedProduct}" readout is the answer`,
      });
    }

    const taskSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const type = String(c.type ?? '');
      const id = String(c.id ?? `#${i + 1}`);
      const where = `${id}(${type})`;

      if (!VALID_TYPES.has(type)) {
        uncheckedTypes.add(type);
        continue;
      }
      checked++;

      const hiddenValue = c.hiddenValue == null ? 'product' : String(c.hiddenValue);
      if (c.hiddenValue != null && !VALID_HIDDEN.has(hiddenValue)) {
        violations.push({ check: 'schema', where, detail: `invalid hiddenValue ${JSON.stringify(c.hiddenValue)} — component silently defaults it to the product` });
      }

      // (d) missing_factor must hide a FACTOR, not the product.
      if (type === 'missing_factor' && hiddenValue !== 'factor1' && hiddenValue !== 'factor2') {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `missing_factor hides "${hiddenValue}" — the judge would accept the product while the prompt asks for a factor`,
        });
      }

      // ── Parse the challenge's own targetFact and re-derive the INTENDED answer ──
      const targetFact = String(c.targetFact ?? '');
      const parsed = parseTargetFact(targetFact);
      if (!parsed) {
        violations.push({ check: 'schema', where, detail: `targetFact "${targetFact}" is not a parseable "a × b = c" fact` });
      } else {
        const [ta, tb] = parsed.factors;
        const tProduct = parsed.factors.reduce((a, b) => a * b, 1); // INDEPENDENT product from the string

        // (b) targetFact internal consistency.
        if (tProduct !== parsed.rhs) {
          violations.push({
            check: 'answer-key-desync',
            where,
            detail: `targetFact "${targetFact}" is inconsistent: ${parsed.factors.join(' × ')} = ${tProduct}, not ${parsed.rhs}`,
          });
        }
        // targetFact scope (the student is presented THIS fact).
        for (const [label, val] of [['factor1', ta], ['factor2', tb], ['product', tProduct]] as const) {
          if (val < 1 || val > ceiling) {
            violations.push({ check: 'scope', where, detail: `targetFact ${label} ${val} outside [1, ${ceiling}] (topic "${ctx.topic}")` });
          }
        }

        // (c) THE CORE CROSS-CHECK: intended answer (from this challenge's
        // targetFact) vs the answer the component actually judges (shared fact).
        if (factOk) {
          const intended = answerFor(hiddenValue, ta, tb, tProduct);
          const judged = answerFor(hiddenValue, sharedF1, sharedF2, sharedProduct);
          if (intended !== judged) {
            violations.push({
              check: 'answer-key-desync',
              where,
              detail: `challenge asks "${targetFact}" (hiddenValue="${hiddenValue}") → student answers ${intended}, but the component judges against the shared fact ${sharedF1} × ${sharedF2} = ${sharedProduct} → only ${judged} is accepted`,
            });
          }
        }
      }

      // clustering: byte-identical challenge card.
      const taskKey = `${type}|${hiddenValue}|${targetFact.replace(/\s+/g, ' ').trim()}|${String(c.instruction ?? '').replace(/\s+/g, ' ').trim()}`;
      taskSeen.set(taskKey, (taskSeen.get(taskKey) ?? 0) + 1);
    }

    taskSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `identical challenge "${key}" appears ${count}× — a duplicated card` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
