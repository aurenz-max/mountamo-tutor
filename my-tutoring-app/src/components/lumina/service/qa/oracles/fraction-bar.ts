import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, checkUniqueOptions, parseScopeCeiling } from './helpers';

/**
 * Fraction-bar oracle — a REACHABILITY oracle for the numerator/denominator
 * answer contract. fraction-bar ships no boolean "correct" flag: the answer IS
 * the (numerator, denominator) pair, and the component judges three separate
 * correct states per challenge. The oracle's job is to prove all three states
 * are actually reachable from the shipped data — the array-grid "unreachable
 * correct state" class applied to a three-phase flow.
 *
 * The component (FractionBar.tsx) runs EVERY challengeType through the SAME
 * three within-challenge phases (FractionBar.tsx:29-33, :88), so the two MC
 * choice arrays are live in all four modes — there is no mode where they go
 * unused. It judges correctness as:
 *  - Phase 1 numerator MC (handleCheckNumerator, :392): correct when the picked
 *    choice === `numerator`. The choices rendered are exactly `numeratorChoices`
 *    (:787). If `numerator` ∉ `numeratorChoices` the correct choice cannot be
 *    clicked — the vocabulary-explorer "correct answer isn't among the options"
 *    desync, here surfaced as an unreachable MC state.
 *  - Phase 2 denominator MC (handleCheckDenominator, :442): correct when the
 *    picked choice === `denominator`, choices are `denominatorChoices` (:835).
 *    Same reachability requirement on `denominator`.
 *  - Phase 3 build (handleSubmitBuild, :501): correct when `shadedCount ===
 *    numerator`. The bar renders exactly `denominator` shadeable cells (:914)
 *    and `shadedCount` ranges 0..denominator (togglePartition, :481-490). So the
 *    correct shade state exists only when 0 ≤ numerator ≤ denominator; an
 *    improper `numerator > denominator` can NEVER be shaded (only `denominator`
 *    cells exist) — the build phase is unwinnable.
 *
 * THE INDEPENDENCE RULE: the oracle never trusts that "the generator included
 * the right choices." It re-derives each phase's correct state the way the
 * COMPONENT judges it — choice===numerator, choice===denominator,
 * shadedCount===numerator — and checks that state is actually present in the
 * choice array / on the bar. It reasons from the fraction (num, den), the same
 * source the component's three handlers read, not from any stored key. A
 * generator whose choice builder drops the correct value (or emits an improper
 * fraction) can no longer false-pass.
 *
 * Checks:
 *  - answer-key-desync : the fraction must be well-formed AND every correct state
 *    reachable — denominator ≥ 1, 0 ≤ numerator ≤ denominator (proper; improper is
 *    unshadeable on a denominator-cell bar), `numerator` ∈ numeratorChoices, and
 *    `denominator` ∈ denominatorChoices. Any miss marks a correct student wrong.
 *  - scope             : the denominator (partition count — the magnitude the
 *    session teaches) must honor the objective ceiling. A "denominators to 8"
 *    topic emitting twelfths is content past the objective. Ceiling =
 *    ctx.scopeMax ?? topic ceiling ?? the primitive's intrinsic max (12, the
 *    compare-mode denominator window's top).
 *  - clustering        : the FRACTIONS must spread across the set. Keyed on the
 *    whole fraction "num/den", NOT the numerator — `identify` is all unit
 *    fractions (numerator always 1), so a numerator-keyed variety check would
 *    false-fire on every clean identify generation. Also flags an exact-duplicate
 *    fraction card, but ONLY outside `identify`: identify draws from a 5-fraction
 *    pool and cycles it at count 7 (identifyOperands, gemini-fraction-bar.ts:270-289),
 *    so a repeated card there is in-contract, not a desync — the other modes dedup.
 *  - schema            : numerator/denominator integers; both choice arrays are
 *    non-empty integer arrays with unique options (checkUniqueOptions); ≥3
 *    challenges (mastery-over-demo).
 *
 * Deliberately NOT checked: answer-leak. The fraction itself is the prompt — the
 * top display (:701-705), every phase heading, and the build instruction all
 * state "numerator/denominator" by design (it's a recognition/construction task,
 * not a hidden-answer task), and the choice arrays are meant to contain the
 * answer. A leak test would fire on the intended stimulus, worse than an honest
 * gap. Leak/quality stays with /eval-test.
 *
 * uncheckedTypes: none — the four modes share one data shape and one three-phase
 * contract, so every mode is fully covered by the checks above.
 */

const KNOWN_TYPES = new Set(['identify', 'build', 'compare', 'add_subtract']);
// Intrinsic denominator ceiling when neither the harness nor the topic names one:
// the top of the compare-mode denominator window (gemini-fraction-bar.ts:308-323).
const INTRINSIC_MAX_DENOMINATOR = 12;

function isInt(v: unknown): v is number {
  return Number.isInteger(v);
}

function intArray(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length === 0 || !v.every(isInt)) return null;
  return v as number[];
}

export const fractionBarOracle: ContentOracle = {
  componentId: 'fraction-bar',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const sessionType = String(data.challengeType ?? '');
    if (!KNOWN_TYPES.has(sessionType)) {
      // The reachability/scope/clustering checks below are type-agnostic (one shared
      // shape), so they still run; record the honesty gap on the mode label only.
      uncheckedTypes.add(sessionType || '(missing challengeType)');
    }
    // identify intentionally cycles a 5-fraction pool → repeated cards are in-contract.
    const allowDuplicateCards = sessionType === 'identify';

    // Objective ceiling on the DENOMINATOR. Harness scopeMax wins, then a "to N"
    // topic, else the primitive's intrinsic max denominator.
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? INTRINSIC_MAX_DENOMINATOR;

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    // Clustering keyed on the WHOLE fraction (identify numerators are all 1).
    const fractionKeys: string[] = [];
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const where = id;

      const num = c.numerator;
      const den = c.denominator;
      if (!isInt(num) || !isInt(den)) {
        violations.push({
          check: 'schema',
          where,
          detail: `numerator/denominator not integers: numerator=${JSON.stringify(num)} denominator=${JSON.stringify(den)}`,
        });
        continue;
      }
      const n = num as number;
      const d = den as number;

      const numChoices = intArray(c.numeratorChoices);
      const denChoices = intArray(c.denominatorChoices);
      if (numChoices === null || denChoices === null) {
        violations.push({
          check: 'schema',
          where,
          detail: `choice arrays must be non-empty integer arrays; got numeratorChoices=${JSON.stringify(c.numeratorChoices)} denominatorChoices=${JSON.stringify(c.denominatorChoices)}`,
        });
        continue;
      }
      checked++;

      // ── answer-key-desync: fraction well-formed + every correct state reachable ──
      if (d < 1) {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `denominator ${d} < 1 — no bar to shade, the build phase has no reachable correct state`,
        });
      }
      if (n < 0) {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `numerator ${n} < 0 — a negative shade target is unreachable on the bar`,
        });
      }
      // Build reachability: the bar has exactly `d` cells, shadedCount ∈ [0, d].
      if (n > d) {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `improper ${n}/${d}: the bar renders only ${d} cell(s), so shadedCount can never reach ${n} — the build phase is unwinnable`,
        });
      }
      // Phase 1 MC reachability: the correct numerator must be a selectable choice.
      if (!numChoices.includes(n)) {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `numerator ${n} is absent from numeratorChoices [${numChoices.join(', ')}] — the correct choice can never be clicked`,
        });
      }
      // Phase 2 MC reachability: the correct denominator must be a selectable choice.
      if (!denChoices.includes(d)) {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `denominator ${d} is absent from denominatorChoices [${denChoices.join(', ')}] — the correct choice can never be clicked`,
        });
      }

      // ── schema: MC options must be unique (a repeated option is a dead choice) ──
      const numDup = checkUniqueOptions(numChoices, `${id}.numeratorChoices`);
      if (numDup) violations.push(numDup);
      const denDup = checkUniqueOptions(denChoices, `${id}.denominatorChoices`);
      if (denDup) violations.push(denDup);

      // ── scope: the denominator (partition count) honors the objective ceiling ──
      if (d > ceiling) {
        violations.push({
          check: 'scope',
          where,
          detail: `denominator ${d} in ${n}/${d} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
        });
      }

      const key = `${n}/${d}`;
      fractionKeys.push(key);
      cardSeen.set(key, (cardSeen.get(key) ?? 0) + 1);
    }

    // ── clustering: the fractions spread (no "every card is 1/2") ──
    const variety = checkAnswerVariety(fractionKeys, 'challenges[].fraction');
    if (variety) violations.push(variety);
    // ── clustering: no exact-duplicate fraction card (identify's pool cycles, so exempt) ──
    if (!allowDuplicateCards) {
      cardSeen.forEach((count, key) => {
        if (count > 1) {
          violations.push({
            check: 'clustering',
            where: 'challenges[]',
            detail: `identical fraction "${key}" appears ${count}× — a duplicated card`,
          });
        }
      });
    }

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
