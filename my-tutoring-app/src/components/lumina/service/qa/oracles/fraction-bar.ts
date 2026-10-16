import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, checkUniqueOptions, parseScopeCeiling } from './helpers';
import { cutInto, equalBuildMiss, equalWays, makesEqual, readBuild } from '../../../primitives/visual-primitives/math/fractionEqualBuild';

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
 *    larger_denominators denominator window's top).
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
 *
 * build_equal (the open build) has no choice questions: its contract is that the target is a proper fraction
 * with another equal split the bar can make, that split passes the bar's own judge (`makesEqual`), the target's
 * own split does not (`same_pieces`), the instruction states the target, K-2 stays within fourths, and no two
 * builds ask for the same value. Its choice arrays are empty by design and not checked.
 *
 * compare has no choice questions either: two proper fractions, the stored `relation` equal to the one cross-
 * multiplication gives (the component checks the pick against it), both denominators under the ceiling, the
 * support tier's pair kind (easy same denominator, medium same numerator, hard neither), no pair twice in either
 * order, at most one equal pair, and not every pair answered by the same symbol.
 */

const KNOWN_TYPES = new Set(['identify', 'build', 'larger_denominators', 'compare', 'add_subtract', 'build_equal']);
// Intrinsic denominator ceiling when neither the harness nor the topic names one:
// the top of the larger_denominators denominator window (gemini-fraction-bar.ts:308-323).
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
    if (sessionType === 'build_equal') return verifyEqualBuild(data, challenges, violations, uncheckedTypes);
    if (sessionType === 'compare') return verifyCompare(data, challenges, violations, uncheckedTypes, ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? INTRINSIC_MAX_DENOMINATOR);

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

/** build_equal: every target can be made another way and only another way; see the header. */
function verifyEqualBuild(data: Record<string, unknown>, challenges: Record<string, unknown>[], violations: OracleViolation[],
  uncheckedTypes: Set<string>): OracleResult {
  const band = data.gradeBand === 'K-2' ? 'K-2' : '3-5';
  if (challenges.length < 3) violations.push({ check: 'schema', where: 'challenges', detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3+` });
  const values = new Map<string, number>();
  let checked = 0;
  challenges.forEach((c, i) => {
    const where = String(c.id ?? `#${i + 1}`);
    const n = c.numerator, d = c.denominator;
    if (!isInt(n) || !isInt(d) || n < 1 || n >= d) {
      violations.push({ check: 'schema', where, detail: `target must be a proper fraction with whole parts; got ${JSON.stringify(n)}/${JSON.stringify(d)}` });
      return;
    }
    checked++;
    const target = { numerator: n, denominator: d };
    const way = equalWays(n, d, band)[0];
    const shadeFirst = (pieces: number, shaded: number) => readBuild(cutInto(pieces).map((p, k) => ({ ...p, shaded: k < shaded })));
    if (!way || !makesEqual(target, shadeFirst(way.pieces, way.shaded)))
      violations.push({ check: 'answer-key-desync', where, detail: `${n}/${d}: no other equal split of the bar passes the judge (band ${band})` });
    if (equalBuildMiss(target, shadeFirst(d, n)) !== 'same_pieces')
      violations.push({ check: 'answer-key-desync', where, detail: `${n}/${d}: the target's own split is not the same_pieces miss` });
    if (typeof c.instruction !== 'string' || !c.instruction.includes(`${n}/${d}`))
      violations.push({ check: 'schema', where, detail: `instruction does not state the target ${n}/${d}` });
    if (band === 'K-2' && d > 4) violations.push({ check: 'scope', where, detail: `K-2 target ${n}/${d} beyond fourths` });
    const key = (n / d).toFixed(6);
    values.set(key, (values.get(key) ?? 0) + 1);
  });
  values.forEach((count, key) => {
    if (count > 1) violations.push({ check: 'clustering', where: 'challenges[]', detail: `${count} builds ask for the same value ${Number(key)}` });
  });
  return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
}

/** compare: the key is the relation the pair really has, and the tier's pair kind holds; see the header. */
function verifyCompare(data: Record<string, unknown>, challenges: Record<string, unknown>[], violations: OracleViolation[],
  uncheckedTypes: Set<string>, ceiling: number): OracleResult {
  if (challenges.length < 3) violations.push({ check: 'schema', where: 'challenges', detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3+` });
  const tier = data.supportTier;
  const pairs = new Map<string, number>();
  const symbols = new Set<string>();
  let equal = 0;
  let checked = 0;
  challenges.forEach((c, i) => {
    const where = String(c.id ?? `#${i + 1}`);
    const second = (c.compareWith ?? {}) as Record<string, unknown>;
    const [a, b, x, y] = [c.numerator, c.denominator, second.numerator, second.denominator];
    if (![a, b, x, y].every(isInt) || (a as number) < 1 || (a as number) >= (b as number) || (x as number) < 1 || (x as number) >= (y as number)) {
      violations.push({ check: 'schema', where, detail: `compare needs two proper fractions; got ${JSON.stringify(a)}/${JSON.stringify(b)} and ${JSON.stringify(x)}/${JSON.stringify(y)}` });
      return;
    }
    const [n, d, m, e] = [a, b, x, y] as number[];
    checked++;
    const truth = n * e > m * d ? '>' : n * e < m * d ? '<' : '=';
    if (c.relation !== truth) violations.push({ check: 'answer-key-desync', where, detail: `${n}/${d} vs ${m}/${e}: key ${JSON.stringify(c.relation)}, true relation ${truth}` });
    symbols.add(truth);
    if (truth === '=') equal++;
    for (const den of [d, e]) if (den > ceiling) violations.push({ check: 'scope', where, detail: `denominator ${den} exceeds objective ceiling ${ceiling}` });
    const kind = d === e ? 'easy' : n === m ? 'medium' : 'hard';
    if ((tier === 'easy' || tier === 'medium' || tier === 'hard') && kind !== tier)
      violations.push({ check: 'scope', where, detail: `${tier} tier pair ${n}/${d} vs ${m}/${e} is a ${kind}-kind pair` });
    const key = [`${n}/${d}`, `${m}/${e}`].sort().join('|');
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
  });
  pairs.forEach((count, key) => {
    if (count > 1) violations.push({ check: 'clustering', where: 'challenges[]', detail: `pair ${key} appears ${count}×` });
  });
  if (equal > 1) violations.push({ check: 'clustering', where: 'challenges[]', detail: `${equal} equal pairs; at most one` });
  if (checked >= 4 && symbols.size === 1) violations.push({ check: 'clustering', where: 'challenges[].relation', detail: `every pair is answered ${Array.from(symbols)[0]}` });
  return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
}
