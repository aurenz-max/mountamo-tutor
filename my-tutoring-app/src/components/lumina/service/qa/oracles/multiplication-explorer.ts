import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, parseScopeCeiling } from './helpers';

/**
 * multiplication-explorer oracle — a CALCULATION oracle. Each challenge carries
 * its OWN `targetFact` string ("2 × 5 = 10"); a fluency drill legitimately varies
 * the fact per challenge while the exploration modes (build/connect/…) keep the
 * one shared `data.fact`.
 *
 * The component (MultiplicationExplorer.tsx, post-fix 2026-07-07) judges each
 * challenge against its OWN fact:
 *   activeFact = parseTargetFact(currentChallenge.targetFact) ?? data.fact
 *   getExpectedAnswer(): hiddenValue==='product' → activeFact.product
 *                        hiddenValue==='factor1' → activeFact.factor1
 *                        hiddenValue==='factor2' → activeFact.factor2
 *                        (null / anything else)  → activeFact.product   // default
 *   isCorrect = parseInt(answer) === getExpectedAnswer()
 * The equation display renders `activeFact` too, so what's asked and what's judged
 * can never disagree. `parseTargetFact` recomputes the product from the factors —
 * a shipped "= p" that disagrees is ignored. `data.fact` is now only the display
 * source for the shared representations and the fallback when a targetFact can't
 * be parsed.
 *
 * (History: before the fix, the component judged EVERY challenge against the one
 * shared `data.fact`, so a fluency session emitting 5 different facts marked
 * correct answers wrong. This oracle caught it — 20 desyncs across 5 runs. The
 * fix moved the judge onto the per-challenge targetFact; the check below now
 * verifies that contract instead of the shared-fact one.)
 *
 * THE INDEPENDENCE RULE: parse each challenge's `targetFact` OURSELVES and
 * recompute the product from the factors — never trust the shipped RHS or
 * `fact.product`. Then verify the fact the student is asked-and-judged on is
 * self-consistent, in scope, and that the hidden slot is coherent.
 *
 * Checks:
 *  - answer-key-desync : (a) missing_factor must hide a FACTOR (factor1/factor2),
 *    never the product — else the judge accepts the product while the prompt asks
 *    for a factor; (b) shipped fact.product must equal factor1 × factor2
 *    (regression guard on the generator's reconciliation at line 507).
 *  - schema            : targetFact must parse as "a × b = c" and be internally
 *    consistent (a × b === c). The component recomputes the product from the
 *    factors, so an inconsistent RHS no longer misgrades — but it is still a
 *    generator defect (a self-contradictory fact string) worth surfacing.
 *  - scope             : every targetFact's factors + product AND the shared
 *    fact within [1, ceiling]; ceiling = scopeMax ?? topic ?? 144.
 *  - answer-leak       : the on-screen product readout (showOptions.showProduct
 *    drives the big header + per-rep "= product") must be OFF whenever any
 *    challenge hides the product — the exact code-owned guard the generator
 *    enforces (lines 615/672), re-derived here as a regression guard.
 *  - clustering        : no exact-duplicate challenge card (same type +
 *    hiddenValue + targetFact + instruction).
 *
 * Deliberately NOT checked:
 *  - answer-variety ("every answer is N"): the exploration modes (build/connect/
 *    commutative/distributive) legitimately drill the ONE shared fact across
 *    several challenges, so judged answers cluster on one value by design. A
 *    checkAnswerVariety over judged answers would false-positive on every valid
 *    single-fact session. The duplicate-card check is the meaningful signal.
 *  - broad answer-leak (text scan): factors appear in instructions by design
 *    ("Build 2 packs of 5 stickers"), and showProduct legitimately renders the
 *    product for factor-hidden (missing_factor) challenges where the product is
 *    GIVEN. A whole-number text-leak test would false-positive constantly.
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
      // (b) regression guard: shipped product must match the factors.
      if (fact.product !== sharedProduct) {
        violations.push({
          check: 'answer-key-desync',
          where: 'fact',
          detail: `shipped fact.product ${JSON.stringify(fact.product)} but ${sharedF1} × ${sharedF2} = ${sharedProduct}`,
        });
      }
      // scope: the shared fact itself (drives the representations).
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
        detail: `showProduct is true while a challenge hides the product (hiddenValue==='product') — the on-screen "= product" readout is the answer`,
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

      // (a) missing_factor must hide a FACTOR, not the product.
      if (type === 'missing_factor' && hiddenValue !== 'factor1' && hiddenValue !== 'factor2') {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `missing_factor hides "${hiddenValue}" — the judge would accept the product while the prompt asks for a factor`,
        });
      }

      // ── Parse the challenge's own targetFact — the fact the student is asked AND judged on ──
      const targetFact = String(c.targetFact ?? '');
      const parsed = parseTargetFact(targetFact);
      if (!parsed) {
        violations.push({ check: 'schema', where, detail: `targetFact "${targetFact}" is not a parseable "a × b = c" fact` });
      } else {
        const [ta, tb] = parsed.factors;
        const tProduct = parsed.factors.reduce((a, b) => a * b, 1); // INDEPENDENT product from the string

        // targetFact internal consistency. The component recomputes the product
        // from the factors, so an inconsistent RHS no longer misgrades — but a
        // self-contradictory fact string is still a generator defect.
        if (tProduct !== parsed.rhs) {
          violations.push({
            check: 'schema',
            where,
            detail: `targetFact "${targetFact}" is inconsistent: ${parsed.factors.join(' × ')} = ${tProduct}, not ${parsed.rhs}`,
          });
        }
        // scope: the student is presented AND graded on THIS fact.
        for (const [label, val] of [['factor1', ta], ['factor2', tb], ['product', tProduct]] as const) {
          if (val < 1 || val > ceiling) {
            violations.push({ check: 'scope', where, detail: `targetFact ${label} ${val} outside [1, ${ceiling}] (topic "${ctx.topic}")` });
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
