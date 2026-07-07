import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Factor-tree oracle — a CALCULATION oracle over primality / prime-factorization.
 * Unlike math-fact-fluency (which re-derives an arithmetic RESULT the generator
 * shipped), factor-tree ships NO answer key at all: each challenge carries only a
 * `rootValue`, and the student builds the tree interactively while the component
 * validates every split live (factor1 × factor2 === node.value, both > 1) and
 * declares the challenge solved when all leaves are prime. So the shipped "key"
 * IS the rootValue, and the only thing that can silently be wrong is a rootValue
 * that the component's own completion rule can NEVER reach.
 *
 * The component (FactorTree.tsx) judges a challenge complete at:
 *  - `canSplit = isLeaf && !node.isPrime` (only composite leaves are splittable), and
 *  - `treeNowComplete = allLeavesPrime(tree) && leavesNow.length > 1` (FactorTree.tsx:234),
 *    recorded correct in the completion effect (FactorTree.tsx:362-373).
 * Therefore a rootValue is COMPLETABLE iff it is a composite ≥ 4 — a prime (or 1,
 * or < 4) roots to a single un-splittable leaf the student can never resolve, so the
 * "find the prime factorization of {rootValue}" banner poses an impossible task.
 * That is the desync this oracle makes unshippable.
 *
 * INDEPENDENCE: we re-derive primality by full trial-division factorization
 * (primeFactorize below), a different code path than the component's `isPrime` +
 * interactive `getFactorPairs` split loop — and than the generator's hand-picked
 * CANDIDATE_POOLS. A rootValue is valid iff our independent factorization yields
 * ≥ 2 prime factors (with multiplicity). We never trust the pool membership or any
 * generator claim of "composite".
 *
 * Checks:
 *  - answer-key-desync : every rootValue must be a completable composite (integer,
 *    ≥ 2 prime factors) — a prime / 1 / non-integer root is an unsolvable challenge.
 *  - scope             : every rootValue within [1, ceiling]. The generator only
 *    NARROWS its code-owned pool to the lesson scope when the narrowed pool can still
 *    fill the session; when it can't (e.g. an assessment pool of 40-100 under a
 *    "to 24" topic) the full pool stands and blows the ceiling — live-catchable here.
 *  - clustering        : rootValues must spread (no "every tree is 12"), and no
 *    exact-duplicate rootValue (the challenge's full task identity is the rootValue
 *    alone — the only per-challenge field — so a repeated value is a duplicated card).
 *  - schema            : ≥ 3 challenges (mastery-over-demo); rootValue must be an integer.
 *
 * Deliberately NOT checked: answer-leak. The rootValue is shown to the student by
 * design ("Find the prime factorization of {rootValue}") — that IS the question — and
 * the ANSWER (the prime factorization) is never present in the generated data at all;
 * the student computes it live and the component validates it. There is nothing in the
 * payload that could leak an answer, so a leak check would only manufacture false
 * positives. Instruction/title quality (the prompt asks Gemini not to name a specific
 * composite) stays with /eval-test.
 *
 * uncheckedTypes: none — challenges carry no per-challenge `type` discriminant (the
 * eval mode / challengeType is session-level and consumed by the generator into mode
 * flags; it never reaches the per-challenge data). Every challenge is checked.
 */

/**
 * Independent full prime factorization by trial division. Returns the sorted list of
 * prime factors WITH multiplicity ([] for non-integers and n < 2). Different path from
 * the component's isPrime/getFactorPairs and the generator's pool membership.
 */
function primeFactorize(n: number): number[] {
  if (!Number.isInteger(n) || n < 2) return [];
  const factors: number[] = [];
  let temp = n;
  for (let d = 2; d * d <= temp; d++) {
    while (temp % d === 0) {
      factors.push(d);
      temp /= d;
    }
  }
  if (temp > 1) factors.push(temp);
  return factors;
}

export const factorTreeOracle: ContentOracle = {
  componentId: 'factor-tree',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const challenges = asRecordArray(data.challenges);

    // Objective ceiling wins when the topic/harness carries one; else fall back to the
    // primitive's intrinsic max (the widest candidate pool spans 6..100).
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? 100;

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const rootValues: number[] = [];
    // Full task identity is the rootValue alone — it is the only per-challenge field.
    // A repeated rootValue is a byte-identical card the student would see twice.
    const rootSeen = new Map<number, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const where = `${id}`;
      const rootValue = c.rootValue;

      if (!Number.isInteger(rootValue)) {
        violations.push({
          check: 'schema',
          where,
          detail: `rootValue is not an integer: ${JSON.stringify(rootValue)}`,
        });
        continue;
      }
      const root = rootValue as number;
      checked++;
      rootValues.push(root);
      rootSeen.set(root, (rootSeen.get(root) ?? 0) + 1);

      // ── answer-key-desync: rootValue must be a COMPLETABLE composite ──
      // Independent factorization: ≥ 2 prime factors ⟺ composite ⟺ the component's
      // completion rule (allLeavesPrime && leavesNow.length > 1) is reachable.
      const primes = primeFactorize(root);
      if (primes.length < 2) {
        const why =
          primes.length === 1
            ? `${root} is prime`
            : root < 2
            ? `${root} has no prime factorization`
            : `${root} is a unit`;
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `rootValue ${root} is not a completable composite (${why}) — the tree can never reach all-prime leaves, so "find the prime factorization of ${root}" is unsolvable`,
        });
      }

      // ── scope: rootValue within the objective ceiling ──
      if (root > ceiling || root <= 0) {
        violations.push({
          check: 'scope',
          where,
          detail: `rootValue ${root} outside (0, ${ceiling}] (topic "${ctx.topic}")`,
        });
      }
    }

    // ── clustering: rootValues spread; no exact-duplicate composite ──
    const variety = checkAnswerVariety(rootValues, 'challenges[].rootValue');
    if (variety) violations.push(variety);
    rootSeen.forEach((count, root) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `rootValue ${root} appears ${count}× — a duplicated challenge card`,
        });
      }
    });

    // No per-challenge type discriminant exists in this primitive's data — nothing to
    // leave unchecked. Every present challenge is checked above.
    return { violations, uncheckedTypes: [], checkedChallenges: checked };
  },
};
